/**
 * Turn an idea into a filed backlog.
 *
 * Runs `claude -p` directly on the host — decomposition reads nothing and
 * executes nothing, so it needs no sandbox and costs no Vercel quota. That is
 * the whole reason this is a separate package from the harness.
 *
 *   MACHINAI_IDEA="..." npx tsx plan.ts
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractPlan, PlanError, validatePlan, type DraftStory } from "./lib/schema.js";

interface Config {
  repo: string;
  idea: string;
  githubToken: string;
  model: string;
  dryRun: boolean;
}

function loadConfig(): Config {
  const req = (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
  };
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "No Claude credential. Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY.",
    );
  }
  return {
    repo: req("MACHINAI_REPO"),
    idea: req("MACHINAI_IDEA"),
    githubToken: req("MACHINAI_GITHUB_TOKEN"),
    model: process.env.MACHINAI_MODEL || "claude-opus-4-8",
    dryRun: process.env.MACHINAI_DRY_RUN === "1",
  };
}

function gh(cfg: Config, args: string[], input?: string): string {
  return execFileSync("gh", args, {
    encoding: "utf8",
    input,
    env: { ...process.env, GH_TOKEN: cfg.githubToken },
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
}

/**
 * Enough of the repo for the planner to avoid proposing what already exists.
 * Deliberately small — a file listing and the README, not the whole codebase.
 */
function repoContext(cfg: Config): string {
  const safe = (fn: () => string, fallback: string) => {
    try {
      return fn() || fallback;
    } catch {
      return fallback;
    }
  };

  const tree = safe(
    () =>
      gh(cfg, [
        "api",
        `repos/${cfg.repo}/git/trees/HEAD?recursive=1`,
        "--jq",
        '[.tree[] | select(.type=="blob") | .path] | .[0:200] | join("\\n")',
      ]),
    "(empty repository)",
  );

  const readme = safe(
    () =>
      Buffer.from(
        gh(cfg, ["api", `repos/${cfg.repo}/readme`, "--jq", ".content"]).replace(
          /\s/g,
          "",
        ),
        "base64",
      )
        .toString("utf8")
        .slice(0, 4000),
    "(no README)",
  );

  const openIssues = safe(
    () =>
      gh(cfg, [
        "issue",
        "list",
        "--repo",
        cfg.repo,
        "--state",
        "open",
        "--limit",
        "50",
        "--json",
        "number,title",
        "--jq",
        '[.[] | "#\\(.number) \\(.title)"] | join("\\n")',
      ]),
    "(none)",
  );

  return [
    "## Files",
    tree,
    "",
    "## README",
    readme,
    "",
    "## Stories already filed — do not duplicate these",
    openIssues,
  ].join("\n");
}

function runPlanner(cfg: Config): string {
  const template = readFileSync(
    join(import.meta.dirname, "prompts", "plan.md"),
    "utf8",
  );
  const prompt = template
    .replace("{{IDEA}}", cfg.idea)
    .replace("{{REPO_CONTEXT}}", repoContext(cfg));

  // Piped on stdin rather than passed as an argument: a repo listing plus a
  // README runs well past the shell's argument limit.
  return execFileSync(
    "claude",
    ["--print", "--model", cfg.model, "--permission-mode", "plan", "-p", "-"],
    { encoding: "utf8", input: prompt, maxBuffer: 32 * 1024 * 1024 },
  );
}

/** Body written to the issue. `parseAcceptanceCriteria` in the web app reads this shape. */
function issueBody(story: DraftStory, blockers: number[]): string {
  const lines = [story.body, "", "## Acceptance criteria", ""];
  for (const c of story.acceptanceCriteria) lines.push(`- ${c}`);
  if (blockers.length > 0) {
    lines.push("", `Blocked by ${blockers.map((n) => `#${n}`).join(", ")}`);
  }
  lines.push("", `<!-- machinai:epic ${story.epic} -->`);
  return lines.join("\n");
}

async function main() {
  const cfg = loadConfig();
  console.log(`planning "${cfg.idea.slice(0, 80)}" for ${cfg.repo}`);

  const raw = runPlanner(cfg);
  const plan = validatePlan(extractPlan(raw));

  console.log(`\n${plan.brief}\n`);
  console.log(`${plan.stories.length} stories:`);
  for (const s of plan.stories) {
    const deps = s.blockedBy.length ? ` (after ${s.blockedBy.join(", ")})` : "";
    console.log(`  [${s.size}] ${s.title}${deps}`);
  }

  if (cfg.dryRun) {
    console.log("\ndry run: nothing filed");
    return;
  }

  // Two passes. Issue numbers do not exist until the issue does, so
  // dependencies can only be written once every story has a number.
  const numbers = new Map<string, number>();
  for (const story of plan.stories) {
    const url = gh(
      cfg,
      [
        "issue",
        "create",
        "--repo",
        cfg.repo,
        "--title",
        story.title,
        "--body-file",
        "-",
      ],
      issueBody(story, []),
    );
    const number = Number(url.trim().split("/").pop());
    numbers.set(story.id, number);
    console.log(`  filed #${number}  ${story.title}`);
  }

  for (const story of plan.stories) {
    if (story.blockedBy.length === 0) continue;
    const number = numbers.get(story.id)!;
    const blockers = story.blockedBy
      .map((id) => numbers.get(id))
      .filter((n): n is number => n !== undefined);
    gh(
      cfg,
      ["issue", "edit", String(number), "--repo", cfg.repo, "--body-file", "-"],
      issueBody(story, blockers),
    );
  }

  // Only unblocked stories are green-lit. The rest are picked up automatically
  // as their blockers close, so the backlog drains without further input.
  const ready = plan.stories.filter((s) => s.blockedBy.length === 0);
  for (const story of ready) {
    const number = numbers.get(story.id)!;
    try {
      gh(cfg, ["label", "create", "machinai:ready", "--repo", cfg.repo, "--color", "4C7DFF", "--force"]);
      gh(cfg, ["issue", "edit", String(number), "--repo", cfg.repo, "--add-label", "machinai:ready"]);
    } catch {
      console.warn(`  could not green-light #${number}`);
    }
  }

  console.log(
    `\nfiled ${plan.stories.length} stories; ${ready.length} green-lit, ${plan.stories.length - ready.length} waiting on dependencies`,
  );
}

main().catch((error: unknown) => {
  if (error instanceof PlanError) {
    // A rejected decomposition is a content problem, worth showing plainly
    // rather than as a stack trace.
    console.error(`\nThe plan was rejected: ${error.message}`);
    process.exit(2);
  }
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
