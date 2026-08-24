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
import { vercel } from "@ai-hero/sandcastle/sandboxes/vercel";
import { branchFor, loadConfig } from "./lib/config.js";
import { Gh, LABELS } from "./lib/github.js";
import { assertNoFootprint, prepareTargetRepo } from "./lib/target-repo.js";

const CHECKPOINT_MARKER = "<!-- machinai:checkpoint -->";

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
      remove: [LABELS.ready, LABELS.revise, LABELS.stuck, LABELS.planReview],
    });
  }

  const resuming = attempt > 1;
  const budgetMinutes = Math.round(cfg.budgetMs / 60_000);

  let result: sandcastle.RunResult;
  try {
    result = await sandcastle.run({
      name: `#${cfg.issueNumber}`,
      cwd: target.dir,
      agent: sandcastle.claudeCode(cfg.model, {
        env: {
          // The agent talks to GitHub itself; same scoped token, no extra grant.
          GH_TOKEN: cfg.githubToken,
          GH_REPO: cfg.repo,
        },
      }),
      sandbox: vercel({
        token: cfg.vercelToken,
        teamId: cfg.vercelTeamId,
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
        REPO: cfg.repo,
        ISSUE_NUMBER: cfg.issueNumber,
        ISSUE_TITLE: cfg.issueTitle,
        BRANCH: branch,
        BASE_BRANCH: cfg.baseBranch,
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
          onSandboxReady: [{ command: cfg.installCmd, timeoutMs: 10 * 60_000 }],
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
      gh.comment(
        cfg.issueNumber,
        `${CHECKPOINT_MARKER}\n**Attempt ${attempt} failed before the agent finished.**\n\n\`\`\`\n${message.slice(0, 2000)}\n\`\`\``,
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
        `${CHECKPOINT_MARKER}\n**Attempt ${attempt} produced no commits.**\n\n` +
          `The agent ran but did not change anything. That usually means the story is ambiguous ` +
          `or the work is already done. Worth a human look before spending another run.`,
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
    gh.setLabels(cfg.issueNumber, {
      add: [LABELS.inReview],
      remove: [LABELS.inProgress],
    });
    console.log(pr ? `opened/updated PR #${pr}` : "pushed; PR not created");
  } else {
    // Out of budget with real work committed: hand it straight back for
    // another attempt on the same branch.
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
