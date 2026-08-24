import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Clone and harden the repo we're building. Nothing machinai-shaped may ever
 * be committed to it.
 */

export interface TargetRepo {
  /** Absolute path to the checkout. */
  readonly dir: string;
  readonly repo: string;
  git(...args: string[]): string;
}

/** Paths Sandcastle creates inside the host repo dir as it works. */
const SANDCASTLE_ARTIFACTS = [
  ".sandcastle/",
  ".machinai-work/",
];

function run(dir: string, cmd: string, args: string[]): string {
  return execFileSync(cmd, args, {
    cwd: dir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

/**
 * The zero-footprint guarantee.
 *
 * Sandcastle anchors `.sandcastle/worktrees`, `/logs`, and `/patches` to the
 * host repo directory — which for us *is* the user's checkout. Those are
 * working-tree artifacts, but the agent commits inside the sandbox and a stray
 * `git add -A` would sweep them into the user's history.
 *
 * `.git/info/exclude` is the right tool: it ignores paths for this clone only
 * and is itself never committed, so the user's repo gains nothing — not even a
 * .gitignore line.
 */
function excludeMachinaiArtifacts(dir: string): void {
  const excludePath = join(dir, ".git", "info", "exclude");
  mkdirSync(join(dir, ".git", "info"), { recursive: true });

  const current = existsSync(excludePath)
    ? readFileSync(excludePath, "utf8")
    : "";
  const missing = SANDCASTLE_ARTIFACTS.filter(
    (p) => !current.split(/\r?\n/).includes(p),
  );
  if (missing.length === 0) return;

  appendFileSync(
    excludePath,
    `\n# machinai working artifacts — local to this clone, never committed\n${missing.join("\n")}\n`,
  );
}

/** Clone with an installation token, or reuse and refresh an existing clone. */
export function prepareTargetRepo(opts: {
  repo: string;
  baseBranch: string;
  githubToken: string;
  workdir: string;
}): TargetRepo {
  const dir = resolve(opts.workdir);
  const authUrl = `https://x-access-token:${opts.githubToken}@github.com/${opts.repo}.git`;

  if (dir.length > 40 && process.platform === "win32") {
    console.warn(
      `warning: workdir path is ${dir.length} chars. Sandcastle nests worktrees ` +
        `under .sandcastle/worktrees/<branch>/, so a long root can still exceed ` +
        `Windows MAX_PATH even with core.longpaths. Prefer something like C:\\mi.`,
    );
  }

  if (!existsSync(join(dir, ".git"))) {
    mkdirSync(dir, { recursive: true });
    // Full history: Sandcastle's worktrees and branch reuse need real refs,
    // and a shallow clone breaks resuming an existing machinai/* branch.
    execFileSync("git", ["clone", "-c", "core.longpaths=true", authUrl, dir], {
      stdio: "inherit",
    });
  } else {
    run(dir, "git", ["remote", "set-url", "origin", authUrl]);
    run(dir, "git", ["fetch", "origin", "--prune"]);
  }

  const git = (...args: string[]) => run(dir, "git", args);

  git("config", "user.name", "machinai[bot]");
  git("config", "user.email", "machinai[bot]@users.noreply.github.com");
  // Keep the token out of any log or error Sandcastle might surface.
  git("config", "credential.helper", "");

  // Sandcastle moves commits out of an isolated sandbox as patches and replays
  // them with `git am`. On a Windows host with the usual global
  // core.autocrlf=true, the checkout has CRLF endings while the sandbox
  // produced an LF patch, so every context line mismatches and the apply fails
  // with "Patch application failed at step 1". A bot clone should never
  // translate endings anyway — this is the correct setting on every platform,
  // not a Windows workaround.
  git("config", "core.autocrlf", "false");
  git("config", "core.eol", "lf");

  // Sandcastle nests worktrees at .sandcastle/worktrees/<branch>/, which on
  // Windows pushes real file paths past the 260-character MAX_PATH limit and
  // fails with "Filename too long" during cleanup.
  git("config", "core.longpaths", "true");

  excludeMachinaiArtifacts(dir);

  git("checkout", opts.baseBranch);
  git("reset", "--hard", `origin/${opts.baseBranch}`);

  return { dir, repo: opts.repo, git };
}

/**
 * Assert the zero-footprint promise held. Called after every run; a failure
 * here means we are about to pollute someone's repository, so it throws rather
 * than warns.
 */
export function assertNoFootprint(target: TargetRepo, branch: string): void {
  const tracked = target.git(
    "ls-tree",
    "-r",
    "--name-only",
    branch,
  );
  const offenders = tracked
    .split(/\r?\n/)
    .filter(
      (p) =>
        p.startsWith(".sandcastle/") ||
        p.startsWith(".machinai") ||
        p.includes("machinai-work"),
    );

  if (offenders.length > 0) {
    throw new Error(
      `Zero-footprint violation: ${branch} contains machinai artifacts:\n  ${offenders.join("\n  ")}`,
    );
  }
}
