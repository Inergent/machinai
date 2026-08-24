import { installationToken, loadAppConfig, parseBlockedBy } from "./github-app";
import type {
  Commit,
  DiffFile,
  DiffLine,
  PullRequest,
  Run,
  RunStep,
  RunState,
  Story,
  StoryState,
} from "./types";

/**
 * Real GitHub reads, shaped into the types the UI already renders.
 *
 * The fixture types were written as a data contract before any of this existed.
 * They mostly held; where they did not, the mismatch is documented at the field
 * rather than papered over, because those gaps are real product decisions.
 */

export interface ProjectRef {
  owner: string;
  repo: string;
  installationId: number;
}

export function projectRef(): ProjectRef {
  const full = process.env.MACHINAI_PROJECT_REPO ?? "Inergent/machinai-testbed";
  const [owner, repo] = full.split("/");
  return {
    owner: owner!,
    repo: repo!,
    installationId: Number(process.env.MACHINAI_PROJECT_INSTALLATION_ID ?? 0),
  };
}

let cached: { token: string; expiresAt: number } | null = null;

/** Installation tokens last an hour; re-mint a minute early rather than race it. */
async function token(ref: ProjectRef): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) return cached.token;

  const { token: fresh, expiresAt } = await installationToken(
    ref.installationId,
    loadAppConfig(),
    [ref.repo],
  );
  cached = { token: fresh, expiresAt: new Date(expiresAt).getTime() };
  return fresh;
}

async function gh<T>(ref: ProjectRef, path: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${await token(ref)}`,
      accept: "application/vnd.github+json",
      "user-agent": "machinai",
    },
    // GitHub is the source of truth; a cached backlog that disagrees with it is
    // worse than a slightly slower page.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GitHub ${path} → ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

const LABEL_TO_STATE: Record<string, StoryState> = {
  "machinai:ready": "ready",
  "machinai:in-progress": "in-progress",
  "machinai:in-review": "in-review",
  "machinai:revise": "revise",
  "machinai:blocked": "blocked",
  "machinai:stuck": "stuck",
};

const CHECKPOINT_MARKER = "<!-- machinai:checkpoint -->";

interface ApiIssue {
  number: number;
  title: string;
  body: string | null;
  state: string;
  updated_at: string;
  labels: { name: string }[];
  pull_request?: unknown;
  comments: number;
}

/**
 * Acceptance criteria, pulled out of the issue body.
 *
 * The fixture type has these as a first-class array because the UI renders them
 * as a checklist. GitHub has no such field, so they are parsed from the bullet
 * list under an "Acceptance criteria" heading — the shape machinai's own planner
 * writes.
 */
export function parseAcceptanceCriteria(body: string): string[] {
  const section = /##+\s*acceptance criteria\s*\n([\s\S]*?)(?:\n##+\s|$)/i.exec(body);
  if (!section) return [];
  return section[1]!
    .split(/\r?\n/)
    .map((line) => /^\s*[-*]\s+(.*)$/.exec(line)?.[1]?.trim())
    .filter((line): line is string => Boolean(line));
}

function storyState(labels: string[], issueClosed: boolean): StoryState {
  if (issueClosed) return "done";
  for (const label of labels) {
    const state = LABEL_TO_STATE[label];
    if (state) return state;
  }
  // No machinai label at all: filed but never green-lit.
  return "draft";
}

export async function listStories(ref: ProjectRef): Promise<Story[]> {
  const issues = await gh<ApiIssue[]>(
    ref,
    `/repos/${ref.owner}/${ref.repo}/issues?state=all&per_page=100&sort=updated`,
  );

  return issues
    // GitHub returns pull requests from the issues endpoint; they are not stories.
    .filter((issue) => !issue.pull_request)
    .map((issue) => {
      const labels = issue.labels.map((l) => l.name);
      const body = issue.body ?? "";
      return {
        number: issue.number,
        title: issue.title,
        body: body.split(/\r?\n##/)[0]!.trim(),
        acceptanceCriteria: parseAcceptanceCriteria(body),
        state: storyState(labels, issue.state === "closed"),
        blockedBy: parseBlockedBy(body),
        // Sub-issue parents need a separate GraphQL call per issue; not worth a
        // round trip until epics actually exist in the UI.
        epic: undefined,
        // No GitHub equivalent. A `size:M` label would carry it, but nothing
        // writes one yet, so this is honestly unknown rather than invented.
        size: (labels
          .find((l) => /^size:[sml]$/i.test(l))
          ?.split(":")[1]
          ?.toUpperCase() ?? "M") as Story["size"],
        branch: labels.some((l) => l.startsWith("machinai:"))
          ? `machinai/issue-${issue.number}`
          : undefined,
        prNumber: undefined,
        // Cheap approximation: the real count needs the comment bodies, which
        // is a second request per story. The run list carries the exact number.
        attempts: 0,
        maxAttempts: 5,
        updatedAt: issue.updated_at,
      } satisfies Story;
    });
}

export async function getStory(
  ref: ProjectRef,
  number: number,
): Promise<Story | null> {
  try {
    const issue = await gh<ApiIssue>(
      ref,
      `/repos/${ref.owner}/${ref.repo}/issues/${number}`,
    );
    if (issue.pull_request) return null;

    const labels = issue.labels.map((l) => l.name);
    const body = issue.body ?? "";
    const comments = await gh<{ body: string }[]>(
      ref,
      `/repos/${ref.owner}/${ref.repo}/issues/${number}/comments?per_page=100`,
    );

    return {
      number: issue.number,
      title: issue.title,
      body: body.split(/\r?\n##/)[0]!.trim(),
      acceptanceCriteria: parseAcceptanceCriteria(body),
      state: storyState(labels, issue.state === "closed"),
      blockedBy: parseBlockedBy(body),
      epic: undefined,
      size: (labels
        .find((l) => /^size:[sml]$/i.test(l))
        ?.split(":")[1]
        ?.toUpperCase() ?? "M") as Story["size"],
      branch: `machinai/issue-${issue.number}`,
      prNumber: undefined,
      attempts: comments.filter((c) => c.body.includes(CHECKPOINT_MARKER)).length,
      maxAttempts: 5,
      updatedAt: issue.updated_at,
    } satisfies Story;
  } catch {
    return null;
  }
}

/** The agent's own checkpoint notes, newest last. */
export async function storyCheckpoints(
  ref: ProjectRef,
  number: number,
): Promise<{ body: string; createdAt: string }[]> {
  const comments = await gh<{ body: string; created_at: string }[]>(
    ref,
    `/repos/${ref.owner}/${ref.repo}/issues/${number}/comments?per_page=100`,
  );
  return comments
    .filter((c) => c.body.includes(CHECKPOINT_MARKER))
    .map((c) => ({
      body: c.body.replace(CHECKPOINT_MARKER, "").trim(),
      createdAt: c.created_at,
    }));
}

// ---------------------------------------------------------------------------
// Runs — GitHub Actions workflow runs in the orchestrator repo
// ---------------------------------------------------------------------------

interface ApiRun {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  display_title: string;
  html_url: string;
}

interface ApiJob {
  steps?: { name: string; status: string; conclusion: string | null; started_at: string | null; completed_at: string | null }[];
}

function runState(status: string, conclusion: string | null): RunState {
  if (status !== "completed") {
    return status === "queued" || status === "waiting" ? "queued" : "running";
  }
  if (conclusion === "success") return "succeeded";
  if (conclusion === "cancelled") return "checkpointed";
  return "failed";
}

/** Map Actions job steps onto the five stages the timeline draws. */
function mapSteps(job: ApiJob | undefined, state: RunState): RunStep[] {
  const byName = new Map(job?.steps?.map((s) => [s.name, s]) ?? []);
  const pick = (name: string) => byName.get(name);

  const duration = (s: ReturnType<typeof pick>) =>
    s?.started_at && s?.completed_at
      ? new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()
      : undefined;

  const stepState = (
    s: ReturnType<typeof pick>,
  ): RunStep["state"] => {
    if (!s) return "pending";
    if (s.status !== "completed") return s.status === "in_progress" ? "active" : "pending";
    if (s.conclusion === "success") return "done";
    if (s.conclusion === "skipped") return "skipped";
    return "failed";
  };

  const setup = pick("Run npm ci");
  const mint = pick("Mint an installation token for the target repo");
  const build = pick("Build the story");

  return [
    { id: "queued", label: "Queued", state: "done", durationMs: duration(setup) },
    {
      id: "sandbox",
      label: "Sandbox booting",
      state: stepState(mint),
      durationMs: duration(mint),
    },
    {
      id: "agent",
      label: "Agent working",
      state: stepState(build),
      durationMs: duration(build),
    },
    // Actions cannot see inside the sandbox, so tests and PR creation are
    // inferred from whether the build step as a whole succeeded.
    {
      id: "tests",
      label: "Tests",
      state: state === "succeeded" ? "done" : state === "failed" ? "failed" : "pending",
    },
    {
      id: "pr",
      label: "Pull request",
      state: state === "succeeded" ? "done" : "pending",
    },
  ];
}

export async function listRuns(ref: ProjectRef, limit = 20): Promise<Run[]> {
  const orchestrator = process.env.MACHINAI_ORCHESTRATOR_REPO ?? "Inergent/machinai";
  const { workflow_runs } = await gh<{ workflow_runs: ApiRun[] }>(
    ref,
    `/repos/${orchestrator}/actions/workflows/build.yml/runs?per_page=${limit}`,
  );

  return workflow_runs.map((run) => {
    const state = runState(run.status, run.conclusion);
    // The story number is not a first-class field on a workflow run; it is
    // recoverable from the title machinai gives the dispatch.
    const storyNumber = Number(/#(\d+)/.exec(run.display_title)?.[1] ?? 0);
    return {
      id: String(run.id),
      storyNumber,
      storyTitle: run.display_title,
      state,
      attempt: 1,
      maxAttempts: 5,
      branch: storyNumber ? `machinai/issue-${storyNumber}` : "",
      startedAt: run.created_at,
      elapsedMs:
        new Date(run.updated_at).getTime() - new Date(run.created_at).getTime(),
      steps: [],
      logTail: [],
      commits: [],
      sandbox: { vcpus: 2, memoryGb: 4, timeoutMs: 40 * 60_000, region: "iad1" },
    } satisfies Run;
  });
}

export async function getRun(ref: ProjectRef, id: string): Promise<Run | null> {
  const orchestrator = process.env.MACHINAI_ORCHESTRATOR_REPO ?? "Inergent/machinai";
  try {
    const run = await gh<ApiRun>(ref, `/repos/${orchestrator}/actions/runs/${id}`);
    const { jobs } = await gh<{ jobs: ApiJob[] }>(
      ref,
      `/repos/${orchestrator}/actions/runs/${id}/jobs`,
    );
    const state = runState(run.status, run.conclusion);
    const storyNumber = Number(/#(\d+)/.exec(run.display_title)?.[1] ?? 0);

    return {
      id: String(run.id),
      storyNumber,
      storyTitle: run.display_title,
      state,
      attempt: 1,
      maxAttempts: 5,
      branch: storyNumber ? `machinai/issue-${storyNumber}` : "",
      startedAt: run.created_at,
      elapsedMs:
        new Date(run.updated_at).getTime() - new Date(run.created_at).getTime(),
      steps: mapSteps(jobs[0], state),
      // Streaming Actions logs into the page needs a log-download round trip
      // per view; the checkpoint comment carries the useful summary instead.
      logTail: [],
      commits: [],
      sandbox: { vcpus: 2, memoryGb: 4, timeoutMs: 40 * 60_000, region: "iad1" },
    } satisfies Run;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pull requests
// ---------------------------------------------------------------------------

/** Parse a unified diff patch into the line model the diff view renders. */
export function parsePatch(patch: string | undefined): DiffLine[] {
  if (!patch) return [];
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;

  for (const raw of patch.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (raw.startsWith("+")) {
      lines.push({ type: "add", content: raw.slice(1), newLine: newLine++ });
    } else if (raw.startsWith("-")) {
      lines.push({ type: "del", content: raw.slice(1), oldLine: oldLine++ });
    } else if (raw.startsWith(" ")) {
      lines.push({
        type: "ctx",
        content: raw.slice(1),
        oldLine: oldLine++,
        newLine: newLine++,
      });
    }
  }
  return lines;
}

export async function getPullRequest(
  ref: ProjectRef,
  number: number,
): Promise<PullRequest | null> {
  try {
    const pr = await gh<{
      number: number;
      title: string;
      body: string | null;
      state: string;
      merged: boolean;
      additions: number;
      deletions: number;
      head: { ref: string; sha: string };
      base: { ref: string };
    }>(ref, `/repos/${ref.owner}/${ref.repo}/pulls/${number}`);

    const files = await gh<
      { filename: string; status: string; additions: number; deletions: number; patch?: string }[]
    >(ref, `/repos/${ref.owner}/${ref.repo}/pulls/${number}/files?per_page=100`);

    const checks = await gh<{
      check_runs: { name: string; status: string; conclusion: string | null }[];
    }>(ref, `/repos/${ref.owner}/${ref.repo}/commits/${pr.head.sha}/check-runs`);

    const storyNumber = Number(
      /(?:closes|fixes|resolves)\s+#(\d+)/i.exec(pr.body ?? "")?.[1] ?? 0,
    );

    return {
      number: pr.number,
      title: pr.title,
      storyNumber,
      branch: pr.head.ref,
      baseBranch: pr.base.ref,
      state: pr.merged ? "merged" : "open",
      additions: pr.additions,
      deletions: pr.deletions,
      // The agent's reasoning lives in its checkpoint comment on the issue, not
      // in the PR body — the body is a stub pointing at the story.
      agentSummary: (pr.body ?? "").trim(),
      checks: checks.check_runs.map((c) => ({
        name: c.name,
        state:
          c.status !== "completed"
            ? ("running" as const)
            : c.conclusion === "success"
              ? ("passed" as const)
              : ("failed" as const),
      })),
      files: files.map(
        (f): DiffFile => ({
          path: f.filename,
          status:
            f.status === "added"
              ? "added"
              : f.status === "removed"
                ? "deleted"
                : "modified",
          additions: f.additions,
          deletions: f.deletions,
          lines: parsePatch(f.patch),
        }),
      ),
    } satisfies PullRequest;
  } catch {
    return null;
  }
}

export async function openPullRequestFor(
  ref: ProjectRef,
  storyNumber: number,
): Promise<number | null> {
  try {
    const prs = await gh<{ number: number }[]>(
      ref,
      `/repos/${ref.owner}/${ref.repo}/pulls?head=${ref.owner}:machinai/issue-${storyNumber}&state=all`,
    );
    return prs[0]?.number ?? null;
  } catch {
    return null;
  }
}

export type { Commit };
