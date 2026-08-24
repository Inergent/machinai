/**
 * Every input the harness needs, resolved from explicit arguments.
 *
 * The harness must never read `github.event.*`, `GITHUB_*`, or anything else
 * that only exists on a GitHub Actions runner. That rule is what lets Phase 6
 * move this process into a Vercel Sandbox daemon as a deployment change rather
 * than a rewrite — so keep this file the single place inputs enter.
 */

export interface HarnessConfig {
  /** owner/name of the repo being built. Never machinai's own repo. */
  readonly repo: string;
  readonly issueNumber: number;
  readonly issueTitle: string;
  readonly baseBranch: string;

  /** Per-project build commands, supplied by the caller. */
  readonly installCmd: string;
  readonly testCmd: string;

  /** GitHub App installation token, scoped to `repo`. Expires in ~1 hour. */
  readonly githubToken: string;

  /**
   * Vercel credential. An OIDC token (what `vercel link` / `vercel env pull`
   * writes to .env.local, ~12h) works locally; CI needs a longer-lived
   * VERCEL_TOKEN since OIDC is unavailable off-platform.
   */
  readonly vercelToken: string;
  readonly vercelTeamId: string;

  /** Where the target repo gets cloned. */
  readonly workdir: string;

  /** Which attempt this is, and the ceiling before we give up on the story. */
  readonly attempt: number;
  readonly maxAttempts: number;

  /**
   * Wall-clock budget for the sandbox. Kept under Vercel Hobby's 45-minute
   * session cap so we end the run deliberately instead of being killed.
   */
  readonly budgetMs: number;
  readonly maxIterations: number;
  readonly vcpus: number;
  readonly model: string;

  /** When true, do everything except push, comment, or open a PR. */
  readonly dryRun: boolean;
}

class ConfigError extends Error {}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new ConfigError(`Missing required env var: ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ConfigError(`${name} must be a number`);
  return n;
}

export function loadConfig(): HarnessConfig {
  // Fail before we provision anything. Without a Claude credential the agent
  // dies *inside* the sandbox, after the microVM has already been paid for.
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    throw new ConfigError(
      "No Claude credential. Set CLAUDE_CODE_OAUTH_TOKEN (run `claude setup-token`) " +
        "or ANTHROPIC_API_KEY before running the harness.",
    );
  }

  const repo = req("MACHINAI_REPO");
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new ConfigError(`MACHINAI_REPO must be "owner/name", got: ${repo}`);
  }

  return {
    repo,
    issueNumber: num("MACHINAI_ISSUE_NUMBER", NaN),
    issueTitle: req("MACHINAI_ISSUE_TITLE"),
    baseBranch: process.env.MACHINAI_BASE_BRANCH || "main",
    installCmd: process.env.MACHINAI_INSTALL_CMD || "npm ci",
    testCmd: process.env.MACHINAI_TEST_CMD || "npm test",
    githubToken: req("MACHINAI_GITHUB_TOKEN"),
    vercelToken:
      process.env.VERCEL_TOKEN || req("VERCEL_OIDC_TOKEN"),
    vercelTeamId: req("VERCEL_TEAM_ID"),
    workdir: process.env.MACHINAI_WORKDIR || ".machinai-work",
    attempt: num("MACHINAI_ATTEMPT", 1),
    maxAttempts: num("MACHINAI_MAX_ATTEMPTS", 5),
    // 40 minutes: under the 45-minute Hobby session cap with room to commit
    // and comment before the platform would cut us off.
    budgetMs: num("MACHINAI_BUDGET_MS", 40 * 60_000),
    maxIterations: num("MACHINAI_MAX_ITERATIONS", 40),
    vcpus: num("MACHINAI_VCPUS", 2),
    model: process.env.MACHINAI_MODEL || "claude-opus-4-8",
    dryRun: process.env.MACHINAI_DRY_RUN === "1",
  };
}

/** Deterministic so re-running a story resumes its branch instead of forking. */
export const branchFor = (issueNumber: number) => `machinai/issue-${issueNumber}`;
