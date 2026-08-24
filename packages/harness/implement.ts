/**
 * Build one story: clone the target repo, run a coding agent in a Vercel
 * sandbox on a per-issue branch, push the result, and report back to GitHub.
 *
 * Takes every input as an argument (see lib/config.ts). It reads nothing from
 * GitHub Actions, so the same entrypoint runs from a laptop, an Actions
 * runner, or a Vercel Sandbox daemon.
 *
 *   npx tsx implement.ts
 */
import { join } from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";
import { vercelSandbox } from "./lib/vercel-sandbox.js";
import { branchFor, loadConfig } from "./lib/config.js";
import { Gh, LABELS } from "./lib/github.js";
import { assertNoFootprint, prepareTargetRepo } from "./lib/target-repo.js";

/** Counted toward a story's attempt budget: the agent actually ran. */
const CHECKPOINT_MARKER = "<!-- machinai:checkpoint -->";
/** Not counted: machinai itself broke before the agent got a turn. */
const INFRA_MARKER = "<!-- machinai:infra-failure -->";

/**
 * The agent writes its status inside <checkpoint> tags; the host posts it. That
 * keeps every GitHub write on this side of the sandbox boundary.
 */
function extractCheckpoint(stdout: string): string | null {
  const match = /<checkpoint>([\s\S]*?)<\/checkpoint>/i.exec(stdout);
  const body = match?.[1]?.trim();
  return body ? body : null;
}

function checkpointComment(
  attempt: number,
  maxAttempts: number,
  outcome: string,
  agentNote: string | null,
): string {
  return [
    CHECKPOINT_MARKER,
    `**Attempt ${attempt} of ${maxAttempts} — ${outcome}**`,
    "",
    agentNote ?? "_The agent did not leave a checkpoint note._",
  ].join("\n");
}

async function main() {
  const cfg = loadConfig();
  const branch = branchFor(cfg.issueNumber);
  const gh = new Gh(cfg.repo, cfg.githubToken);

  const attempt = gh.attemptCount(cfg.issueNumber, CHECKPOINT_MARKER) + 1;
  if (attempt > cfg.maxAttempts) {
    gh.setLabels(cfg.issueNumber, {
      add: [LABELS.stuck],
      remove: [LABELS.inProgress, LABELS.ready],
    });
    gh.comment(
      cfg.issueNumber,
      `${CHECKPOINT_MARKER}\n**machinai stopped after ${cfg.maxAttempts} attempts.**\n\n` +
        `Nothing further will run on this story until something changes. Either the story needs ` +
        `sharper acceptance criteria, or it is blocked on a decision only you can make. ` +
        `Leave feedback and re-apply \`${LABELS.ready}\` to try again.`,
    );
    console.error(`Attempt ceiling reached (${cfg.maxAttempts}).`);
    process.exit(1);
  }

  console.log(
    `machinai: ${cfg.repo}#${cfg.issueNumber} → ${branch} (attempt ${attempt}/${cfg.maxAttempts})`,
  );

  const target = prepareTargetRepo({
    repo: cfg.repo,
    baseBranch: cfg.baseBranch,
    githubToken: cfg.githubToken,
    workdir: cfg.workdir,
  });

  if (!cfg.dryRun) {
    gh.setLabels(cfg.issueNumber, {
      add: [LABELS.inProgress],
      remove: [
        LABELS.ready,
        LABELS.revise,
        LABELS.stuck,
        LABELS.blocked,
        LABELS.planReview,
      ],
    });
  }

  const resuming = attempt > 1;
  const budgetMinutes = Math.round(cfg.budgetMs / 60_000);

  // Gathered on the host: it has gh, git and the token, and doing it here keeps
  // the prompt deterministic instead of depending on what the sandbox image
  // happens to ship.
  const issueContext = gh.issueContext(cfg.issueNumber);
  const recentCommits = target.git(
    "log", "-n", "10", "--format=%h %ad %s", "--date=short",
  );
  const branchProgress = (() => {
    try {
      const log = target.git(
        "log",
        "--format=%h %s",
        `origin/${cfg.baseBranch}..origin/${branch}`,
      );
      return log || "(branch exists but has no commits yet)";
    } catch {
      return "(nothing yet — this is the first attempt on this branch)";
    }
  })();

  let result: sandcastle.RunResult;
  try {
    result = await sandcastle.run({
      name: `#${cfg.issueNumber}`,
      cwd: target.dir,
      // Sandcastle only forwards a process.env key into the sandbox if that key
      // is *declared* in a .env file, and machinai deliberately has no
      // .sandcastle directory — so the agent's credential has to be handed over
      // explicitly here, or it starts up unauthenticated.
      //
      // No GH_TOKEN, deliberately: the sandbox reads GitHub only through the
      // injected prompt and writes to it not at all, so a tenant credential
      // never enters an agent environment.
      agent: sandcastle.claudeCode(cfg.model, { env: cfg.agentEnv }),
      sandbox: vercelSandbox({
        token: cfg.vercelToken,
        teamId: cfg.vercelTeamId,
        projectId: cfg.vercelProjectId,
        timeout: cfg.budgetMs,
        resources: { vcpus: cfg.vcpus },
      }),
      // Deterministic and reused: a second attempt resumes this branch's
      // worktree instead of starting over.
      branchStrategy: {
        type: "branch",
        branch,
        baseBranch: `origin/${cfg.baseBranch}`,
      },
      promptFile: join(import.meta.dirname, "prompts", "implement.md"),
      promptArgs: {
        ISSUE_CONTEXT: issueContext,
        RECENT_COMMITS: recentCommits,
        BRANCH_PROGRESS: branchProgress,
        REPO: cfg.repo,
        ISSUE_NUMBER: cfg.issueNumber,
        ISSUE_TITLE: cfg.issueTitle,
        BRANCH: branch,
        INSTALL_CMD: cfg.installCmd,
        TEST_CMD: cfg.testCmd,
        ATTEMPT: attempt,
        MAX_ATTEMPTS: cfg.maxAttempts,
        BUDGET_MINUTES: budgetMinutes,
        RESUME_NOTE: resuming
          ? "This branch already has work on it from an earlier attempt. Read the checkpoint comments on the issue, then continue from where that attempt stopped — do not start over."
          : "This is the first attempt on this story.",
      },
      maxIterations: cfg.maxIterations,
      hooks: {
        sandbox: {
          onSandboxReady: [
            // Sandcastle's vercel() passes `runtime`, never `image`, so we land
            // on the node22 runtime (Amazon Linux 2023) rather than the
            // `universal` managed image. It ships git, node and curl — but not
            // Claude Code, so the agent has to install itself.
            {
              command: "curl -fsSL https://claude.ai/install.sh | bash",
              timeoutMs: 5 * 60_000,
            },
            { command: cfg.installCmd, timeoutMs: 10 * 60_000 },
          ],
        },
      },
      logging: { type: "stdout" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!cfg.dryRun) {
      gh.setLabels(cfg.issueNumber, {
        add: [LABELS.blocked],
        remove: [LABELS.inProgress],
      });
      // INFRA_MARKER, not CHECKPOINT_MARKER: the run died before the agent
      // could do anything, so this is machinai's fault, not the story's. It
      // must not consume one of the story's attempts.
      gh.comment(
        cfg.issueNumber,
        `${INFRA_MARKER}\n**machinai failed to run** (attempt ${attempt} was not spent).\n\n\`\`\`\n${message.slice(0, 2000)}\n\`\`\``,
      );
    }
    throw error;
  }

  const complete = Boolean(result.completionSignal);
  const commits = result.commits.length;
  console.log(
    `agent finished: ${commits} commit(s), ${complete ? "signalled COMPLETE" : "hit the budget"}`,
  );

  if (commits === 0) {
    if (!cfg.dryRun) {
      gh.setLabels(cfg.issueNumber, {
        add: [LABELS.blocked],
        remove: [LABELS.inProgress],
      });
      gh.comment(
        cfg.issueNumber,
        checkpointComment(
          attempt,
          cfg.maxAttempts,
          "no commits",
          extractCheckpoint(result.stdout) ??
            "The agent ran but changed nothing. That usually means the story is ambiguous, or the work is already done. Worth a look before spending another run.",
        ),
      );
    }
    return;
  }

  // The promise we make to every user of machinai, checked before we push.
  assertNoFootprint(target, branch);

  if (cfg.dryRun) {
    console.log(`dry run: would push ${branch} and report to #${cfg.issueNumber}`);
    return;
  }

  target.git("push", "--force-with-lease", "origin", branch);

  const agentNote = extractCheckpoint(result.stdout);

  if (complete) {
    const pr = gh.ensurePullRequest({
      branch,
      baseBranch: cfg.baseBranch,
      title: cfg.issueTitle,
      body:
        `Closes #${cfg.issueNumber}\n\n` +
        `Built by machinai in ${attempt} attempt${attempt === 1 ? "" : "s"}. ` +
        `Nobody has reviewed this yet — that part is yours.\n`,
    });
    gh.comment(
      cfg.issueNumber,
      checkpointComment(
        attempt,
        cfg.maxAttempts,
        pr ? `complete, PR #${pr} open for review` : "complete",
        agentNote,
      ),
    );
    gh.setLabels(cfg.issueNumber, {
      add: [LABELS.inReview],
      remove: [LABELS.inProgress],
    });
    console.log(pr ? `opened/updated PR #${pr}` : "pushed; PR not created");
  } else {
    // Out of budget with real work committed: hand it straight back for
    // another attempt on the same branch.
    gh.comment(
      cfg.issueNumber,
      checkpointComment(
        attempt,
        cfg.maxAttempts,
        `out of budget with ${commits} commit(s) — resuming on the same branch`,
        agentNote,
      ),
    );
    gh.setLabels(cfg.issueNumber, {
      add: [LABELS.ready],
      remove: [LABELS.inProgress],
    });
    console.log(`checkpointed at ${commits} commit(s); re-queued for attempt ${attempt + 1}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
