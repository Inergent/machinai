import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Work out how to install and test a repository by looking at it.
 *
 * "Point machinai at any repo" cannot survive hardcoded defaults. `npm ci` is
 * the right CI command right up until the repo has no lockfile, or uses pnpm,
 * or is a Python project — and then it fails on the very first step with an
 * error that has nothing to do with the story.
 *
 * Explicit settings always win; this only fills in what the caller left blank.
 */

export interface Commands {
  install: string;
  test: string;
  /** How each value was arrived at, for the run log. */
  source: { install: string; test: string };
}

interface PackageJson {
  scripts?: Record<string, string>;
  packageManager?: string;
}

function readPackageJson(dir: string): PackageJson | null {
  const path = join(dir, "package.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  } catch {
    return null;
  }
}

/** Lockfile first — it names the package manager unambiguously. */
function detectInstall(dir: string): { cmd: string; why: string } {
  const has = (f: string) => existsSync(join(dir, f));

  if (has("pnpm-lock.yaml")) {
    return { cmd: "pnpm install --frozen-lockfile", why: "pnpm-lock.yaml" };
  }
  if (has("yarn.lock")) {
    return { cmd: "yarn install --frozen-lockfile", why: "yarn.lock" };
  }
  if (has("bun.lockb") || has("bun.lock")) {
    return { cmd: "bun install --frozen-lockfile", why: "bun lockfile" };
  }
  if (has("package-lock.json") || has("npm-shrinkwrap.json")) {
    // The only case where `npm ci` is valid: it hard-fails without a lockfile.
    return { cmd: "npm ci", why: "package-lock.json" };
  }

  const pkg = readPackageJson(dir);
  if (pkg) {
    const pm = pkg.packageManager ?? "";
    if (pm.startsWith("pnpm")) return { cmd: "pnpm install", why: "packageManager field" };
    if (pm.startsWith("yarn")) return { cmd: "yarn install", why: "packageManager field" };
    if (pm.startsWith("bun")) return { cmd: "bun install", why: "packageManager field" };
    return { cmd: "npm install", why: "package.json, no lockfile" };
  }

  if (has("requirements.txt")) {
    return { cmd: "pip install -r requirements.txt", why: "requirements.txt" };
  }
  if (has("pyproject.toml")) {
    return { cmd: "uv sync || pip install -e .", why: "pyproject.toml" };
  }

  return { cmd: "true", why: "nothing to install" };
}

function detectTest(dir: string, install: string): { cmd: string; why: string } {
  const pkg = readPackageJson(dir);
  const runner = install.split(" ")[0] ?? "npm";

  if (pkg?.scripts?.test) {
    // `npm test` works for yarn and pnpm too, but staying with the detected
    // package manager keeps a single toolchain in play.
    const cmd = runner === "npm" ? "npm test" : `${runner} test`;
    return { cmd, why: "package.json test script" };
  }

  if (existsSync(join(dir, "pyproject.toml")) || existsSync(join(dir, "pytest.ini"))) {
    return { cmd: "pytest", why: "python project" };
  }

  // No test command is a real signal, not an error: the agent is told there is
  // nothing to run, rather than being handed a command that will fail.
  return { cmd: "", why: "no test script found" };
}

export function detectCommands(
  dir: string,
  overrides: { install?: string; test?: string },
): Commands {
  const install = overrides.install
    ? { cmd: overrides.install, why: "configured" }
    : detectInstall(dir);
  const test = overrides.test
    ? { cmd: overrides.test, why: "configured" }
    : detectTest(dir, install.cmd);

  return {
    install: install.cmd,
    test: test.cmd,
    source: { install: install.why, test: test.why },
  };
}
