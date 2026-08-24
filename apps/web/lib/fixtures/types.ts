/**
 * The machinai data contract.
 *
 * Phase 1 renders entirely from fixtures shaped by these types. Phase 5 swaps
 * the fixture imports for real GitHub reads without touching a component, so
 * treat every field here as a promise about what the backend will supply.
 */

export type StoryState =
  | "draft"
  | "ready"
  | "in-progress"
  | "in-review"
  | "revise"
  | "blocked"
  | "stuck"
  | "done";

export type Size = "S" | "M" | "L";

export interface Story {
  /** GitHub issue number. The only identity a story has. */
  number: number;
  title: string;
  /** As-a / I-want / so-that, as markdown. */
  body: string;
  acceptanceCriteria: string[];
  state: StoryState;
  /** Issue numbers that must close before this is eligible. */
  blockedBy: number[];
  /** Parent epic's issue number, via GitHub sub-issues. */
  epic?: number;
  size: Size;
  branch?: string;
  prNumber?: number;
  attempts: number;
  maxAttempts: number;
  updatedAt: string;
}

export interface Epic {
  number: number;
  title: string;
  summary: string;
}

export type RunStepId = "queued" | "sandbox" | "agent" | "tests" | "pr";
export type RunStepState = "pending" | "active" | "done" | "failed" | "skipped";

export interface RunStep {
  id: RunStepId;
  label: string;
  state: RunStepState;
  durationMs?: number;
  detail?: string;
}

export type RunState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "checkpointed"
  | "stuck";

export interface LogLine {
  ts: string;
  text: string;
  level?: "info" | "warn" | "error";
}

export interface Commit {
  sha: string;
  message: string;
  at: string;
  additions: number;
  deletions: number;
}

export interface TestResult {
  passed: number;
  failed: number;
  total: number;
  durationMs: number;
  failures: string[];
}

export interface Run {
  id: string;
  storyNumber: number;
  storyTitle: string;
  state: RunState;
  attempt: number;
  maxAttempts: number;
  branch: string;
  startedAt: string;
  /** Wall clock. Sandbox sessions are capped at 45 min on Vercel Hobby. */
  elapsedMs: number;
  steps: RunStep[];
  logTail: LogLine[];
  commits: Commit[];
  tests?: TestResult;
  prNumber?: number;
  /** Why the run ended early, when it did. */
  note?: string;
  sandbox: { vcpus: number; memoryGb: number; timeoutMs: number; region: string };
}

export interface Project {
  repo: string;
  baseBranch: string;
  installCmd: string;
  testCmd: string;
  buildCmd: string;
  connectedAt: string;
}

export interface Meter {
  label: string;
  used: number;
  /** null means unmetered — a public repo has unlimited Actions minutes. */
  limit: number | null;
  unit: string;
}

export interface Usage {
  periodEndsAt: string;
  meters: Meter[];
}

export type DiffLineType = "add" | "del" | "ctx";

export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLine?: number;
  newLine?: number;
}

export interface DiffFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

export interface PullRequest {
  number: number;
  title: string;
  storyNumber: number;
  branch: string;
  baseBranch: string;
  state: "open" | "merged";
  additions: number;
  deletions: number;
  files: DiffFile[];
  checks: { name: string; state: "passed" | "failed" | "running" }[];
  agentSummary: string;
}

/** A story the planner has proposed but nobody has filed yet. */
export interface DraftStory {
  tempId: string;
  title: string;
  body: string;
  acceptanceCriteria: string[];
  size: Size;
  /** References other drafts by tempId — real numbers don't exist yet. */
  blockedBy: string[];
  epicTitle: string;
}
