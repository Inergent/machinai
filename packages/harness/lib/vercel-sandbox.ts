import { execFileSync } from "node:child_process";
import { mkdir, readFile, unlink, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";
import {
  createIsolatedSandboxProvider,
  type ExecResult,
  type IsolatedSandboxHandle,
  type IsolatedSandboxProvider,
} from "@ai-hero/sandcastle";

/**
 * A Vercel sandbox provider that actually delivers stdin.
 *
 * ## Why this file exists
 *
 * Sandcastle's bundled `sandboxes/vercel` provider (v0.12.0) reads only `cwd`,
 * `onLine` and `sudo` from its exec options — it silently ignores `stdin`,
 * even though `IsolatedSandboxHandle.exec` documents it as
 * "pipes the string to the child process's stdin and closes it".
 *
 * That matters because Sandcastle's own Claude Code agent provider invokes
 * `claude --print ... -p -`, where the trailing `-` means *read the prompt from
 * stdin*. Pair the two as shipped and the prompt is dropped without an error:
 * the agent boots, authenticates, and then burns every iteration asking what
 * you wanted. We watched it do exactly that for 20 iterations.
 *
 * ## Why it emulates rather than forwards
 *
 * `@vercel/sandbox`'s `runCommand` accepts `stdout` and `stderr` Writables but
 * has no `stdin` parameter, so there is nothing to forward to. Instead we write
 * the payload to a file inside the sandbox and prepend `cat <file> |` to the
 * command. That satisfies the documented contract — the process reads the bytes
 * on stdin and sees EOF — and keeps the payload off the argv, which is the
 * 128 KB limit the interface comment is warning about.
 *
 * Everything else mirrors the bundled provider. Drop this file if upstream
 * fixes the gap.
 */

const WORKTREE_PATH = "/vercel/sandbox/workspace";
const MAX_TAIL_CHARS = 64 * 1024;

export interface VercelSandboxOptions {
  readonly token?: string;
  readonly teamId?: string;
  readonly projectId?: string;
  /** Milliseconds before the sandbox self-terminates. */
  readonly timeout?: number;
  readonly resources?: { vcpus: number };
  readonly runtime?: string;
  readonly env?: Record<string, string>;
}

/** Keeps the tail of a stream bounded so a chatty agent can't exhaust V8's max string. */
class BoundedTail {
  private chunks: string[] = [];
  private length = 0;
  constructor(
    private readonly limit: number,
    private readonly joiner: string,
  ) {}
  push(chunk: string): void {
    this.chunks.push(chunk);
    this.length += chunk.length + this.joiner.length;
    while (this.length > this.limit && this.chunks.length > 1) {
      const dropped = this.chunks.shift();
      this.length -= (dropped?.length ?? 0) + this.joiner.length;
    }
  }
  toString(): string {
    return this.chunks.join(this.joiner);
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export const vercelSandbox = (
  options?: VercelSandboxOptions,
): IsolatedSandboxProvider =>
  createIsolatedSandboxProvider({
    name: "vercel",
    env: options?.env,
    create: async (createOptions): Promise<IsolatedSandboxHandle> => {
      const { Sandbox } = await import("@vercel/sandbox");

      const sandbox = await Sandbox.create({
        ...(options?.token ? { token: options.token } : {}),
        ...(options?.teamId ? { teamId: options.teamId } : {}),
        ...(options?.projectId ? { projectId: options.projectId } : {}),
        ...(options?.timeout ? { timeout: options.timeout } : {}),
        ...(options?.resources ? { resources: options.resources } : {}),
        ...(options?.runtime ? { runtime: options.runtime } : {}),
        env: createOptions.env,
      } as Parameters<typeof Sandbox.create>[0]);

      await sandbox.mkDir(WORKTREE_PATH);

      let stdinSeq = 0;

      const handle: IsolatedSandboxHandle = {
        worktreePath: WORKTREE_PATH,

        exec: async (command, opts): Promise<ExecResult> => {
          let finalCommand = command;

          // The whole point of this file.
          if (opts?.stdin !== undefined) {
            const path = `/tmp/sandcastle-stdin-${process.pid}-${stdinSeq++}`;
            await sandbox.writeFiles([
              { path, content: Buffer.from(opts.stdin, "utf8") },
            ]);
            // `rm` after the pipe so a long prompt can't pile up across
            // iterations; `cat` has already opened the fd by then.
            finalCommand = `cat ${shellQuote(path)} | { ${command}; }; __rc=$?; rm -f ${shellQuote(path)}; exit $__rc`;
          }

          const cwd = opts?.cwd ?? WORKTREE_PATH;
          const sudo = opts?.sudo ? { sudo: true } : {};

          // Streaming path. Sandcastle requires line-by-line delivery here —
          // idle-timeout enforcement and live output both depend on it.
          if (opts?.onLine) {
            const onLine = opts.onLine;
            const stdoutTail = new BoundedTail(MAX_TAIL_CHARS, "\n");
            const stderrTail = new BoundedTail(MAX_TAIL_CHARS, "");
            let partial = "";

            const stdout = new Writable({
              write(chunk, _enc, cb) {
                const text = partial + String(chunk);
                const lines = text.split("\n");
                partial = lines.pop() ?? "";
                for (const line of lines) {
                  stdoutTail.push(line);
                  onLine(line);
                }
                cb();
              },
              final(cb) {
                if (partial) {
                  stdoutTail.push(partial);
                  onLine(partial);
                  partial = "";
                }
                cb();
              },
            });

            const stderr = new Writable({
              write(chunk, _enc, cb) {
                stderrTail.push(String(chunk));
                cb();
              },
            });

            const result = await sandbox.runCommand({
              cmd: "sh",
              args: ["-c", finalCommand],
              cwd,
              stdout,
              stderr,
              ...sudo,
            });

            return {
              stdout: stdoutTail.toString(),
              stderr: stderrTail.toString(),
              exitCode: result.exitCode,
            };
          }

          const result = await sandbox.runCommand({
            cmd: "sh",
            args: ["-c", finalCommand],
            cwd,
            ...sudo,
          });

          return {
            stdout: await result.stdout(),
            stderr: await result.stderr(),
            exitCode: result.exitCode,
          };
        },

        copyIn: async (hostPath, sandboxPath): Promise<void> => {
          const info = await stat(hostPath);
          if (info.isDirectory()) {
            const tarPath = join(tmpdir(), `machinai-copyin-${Date.now()}.tar.gz`);
            execFileSync("tar", ["-czf", tarPath, "-C", hostPath, "."]);
            try {
              const content = await readFile(tarPath);
              const remote = `/tmp/machinai-copyin-${Date.now()}.tar.gz`;
              await sandbox.writeFiles([{ path: remote, content }]);
              await sandbox.runCommand({
                cmd: "sh",
                args: [
                  "-c",
                  `mkdir -p ${shellQuote(sandboxPath)} && tar -xzf ${shellQuote(remote)} -C ${shellQuote(sandboxPath)} && rm -f ${shellQuote(remote)}`,
                ],
              });
            } finally {
              await unlink(tarPath).catch(() => {});
            }
          } else {
            await sandbox.writeFiles([
              { path: sandboxPath, content: await readFile(hostPath) },
            ]);
          }
        },

        copyFileOut: async (sandboxPath, hostPath): Promise<void> => {
          const buffer = await sandbox.readFileToBuffer({ path: sandboxPath });
          if (!buffer) {
            throw new Error(`File not found in sandbox: ${sandboxPath}`);
          }
          await mkdir(dirname(hostPath), { recursive: true });
          await writeFile(hostPath, buffer);
        },

        close: async (): Promise<void> => {
          await sandbox.stop();
        },
      };

      return handle;
    },
  });
