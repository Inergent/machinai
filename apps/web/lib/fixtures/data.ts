import type {
  DraftStory,
  Epic,
  Project,
  PullRequest,
  Run,
  Story,
  Usage,
} from "./types";

/** Fixed clock so the mock renders identically on server and client. */
export const NOW = new Date("2026-08-23T18:42:00Z");

export const project: Project = {
  repo: "Inergent/orbital",
  baseBranch: "main",
  installCmd: "npm ci",
  testCmd: "npm test",
  buildCmd: "npm run build",
  connectedAt: "2026-08-19T14:02:00Z",
};

export const epics: Epic[] = [
  {
    number: 12,
    title: "Accounts & access",
    summary: "Sign-in, sessions, and the permission model everything else assumes.",
  },
  {
    number: 13,
    title: "Habit tracking core",
    summary: "Creating habits, logging completions, and the streak calculation.",
  },
  {
    number: 14,
    title: "Social accountability",
    summary: "Partners, shared streaks, and the nudge system.",
  },
];

export const stories: Story[] = [
  {
    number: 21,
    title: "Email + password sign-in",
    body: "As a returning user, I want to sign in with email and password so that I can reach my habits on any device.",
    acceptanceCriteria: [
      "Invalid credentials show an inline error, never a redirect",
      "Session survives a full page reload",
      "Rate-limited to 5 attempts per minute per address",
    ],
    state: "done",
    blockedBy: [],
    epic: 12,
    size: "M",
    branch: "machinai/issue-21",
    prNumber: 44,
    attempts: 1,
    maxAttempts: 5,
    updatedAt: "2026-08-21T09:12:00Z",
  },
  {
    number: 22,
    title: "Create and archive a habit",
    body: "As a user, I want to create a habit with a name and cadence so that I can start tracking it.",
    acceptanceCriteria: [
      "Cadence supports daily and specific weekdays",
      "Archiving hides a habit without deleting its history",
      "Name is required and capped at 60 characters",
    ],
    state: "in-review",
    blockedBy: [],
    epic: 13,
    size: "M",
    branch: "machinai/issue-22",
    prNumber: 47,
    attempts: 2,
    maxAttempts: 5,
    updatedAt: "2026-08-23T18:31:00Z",
  },
  {
    number: 23,
    title: "Streak calculation with grace days",
    body: "As a user, I want one missed day not to reset my streak so that a single bad day does not undo a month of work.",
    acceptanceCriteria: [
      "A streak survives exactly one missed scheduled day",
      "Two consecutive misses reset it to zero",
      "Timezone comes from the user profile, not the request",
    ],
    state: "in-progress",
    blockedBy: [],
    epic: 13,
    size: "L",
    branch: "machinai/issue-23",
    attempts: 2,
    maxAttempts: 5,
    updatedAt: "2026-08-23T18:42:00Z",
  },
  {
    number: 24,
    title: "Invite an accountability partner",
    body: "As a user, I want to invite someone by email so that we can see each other's streaks.",
    acceptanceCriteria: [
      "Invite expires after 7 days",
      "Either side can revoke at any time",
      "Revoking removes historical visibility immediately",
    ],
    state: "blocked",
    blockedBy: [23],
    epic: 14,
    size: "M",
    attempts: 0,
    maxAttempts: 5,
    updatedAt: "2026-08-22T16:20:00Z",
  },
  {
    number: 25,
    title: "Weekly summary email",
    body: "As a user, I want a Monday summary of last week so that I start the week knowing where I stand.",
    acceptanceCriteria: [
      "Sends 08:00 in the recipient's timezone",
      "Skips entirely if no habits were logged",
      "One-click unsubscribe honoured within one send cycle",
    ],
    state: "stuck",
    blockedBy: [],
    epic: 14,
    size: "L",
    branch: "machinai/issue-25",
    attempts: 5,
    maxAttempts: 5,
    updatedAt: "2026-08-23T11:04:00Z",
  },
  {
    number: 26,
    title: "Habit detail view with 90-day heatmap",
    body: "As a user, I want to see a habit's history at a glance so that I can spot the pattern behind a broken streak.",
    acceptanceCriteria: [
      "Renders 90 days without horizontal scroll on a phone",
      "Empty days are visually distinct from unscheduled days",
    ],
    state: "ready",
    blockedBy: [],
    epic: 13,
    size: "M",
    attempts: 0,
    maxAttempts: 5,
    updatedAt: "2026-08-23T08:55:00Z",
  },
  {
    number: 27,
    title: "Nudge a partner who missed two days",
    body: "As an accountability partner, I want to send a one-tap nudge so that I can help without composing a message.",
    acceptanceCriteria: [
      "At most one nudge per partner per day",
      "Nudges are opt-out per habit",
    ],
    state: "blocked",
    blockedBy: [24],
    epic: 14,
    size: "S",
    attempts: 0,
    maxAttempts: 5,
    updatedAt: "2026-08-22T16:22:00Z",
  },
  {
    number: 28,
    title: "Export habit history as CSV",
    body: "As a user, I want to export my history so that I own my data if I leave.",
    acceptanceCriteria: [
      "One row per habit per day",
      "Streams rather than buffering the whole file",
    ],
    state: "draft",
    blockedBy: [],
    epic: 13,
    size: "S",
    attempts: 0,
    maxAttempts: 5,
    updatedAt: "2026-08-23T18:40:00Z",
  },
];

export const runs: Run[] = [
  {
    id: "run_8f21",
    storyNumber: 23,
    storyTitle: "Streak calculation with grace days",
    state: "running",
    attempt: 2,
    maxAttempts: 5,
    branch: "machinai/issue-23",
    startedAt: "2026-08-23T18:19:00Z",
    elapsedMs: 23 * 60_000 + 14_000,
    sandbox: { vcpus: 2, memoryGb: 4, timeoutMs: 40 * 60_000, region: "iad1" },
    steps: [
      { id: "queued", label: "Queued", state: "done", durationMs: 4_000 },
      {
        id: "sandbox",
        label: "Sandbox booting",
        state: "done",
        durationMs: 11_000,
        detail: "vercel/sandbox/universal · 2 vCPU · iad1",
      },
      {
        id: "agent",
        label: "Agent working",
        state: "active",
        durationMs: 22 * 60_000 + 59_000,
        detail: "iteration 24 of 40",
      },
      { id: "tests", label: "Tests", state: "pending" },
      { id: "pr", label: "Pull request", state: "pending" },
    ],
    logTail: [
      { ts: "18:41:02", text: "RED  streak survives a single missed day" },
      { ts: "18:41:18", text: "wrote lib/streak.ts (+64)" },
      { ts: "18:41:44", text: "GREEN 3 passing, 1 failing" },
      {
        ts: "18:42:01",
        text: "grace day still resets across a DST boundary",
        level: "warn",
      },
      { ts: "18:42:09", text: "reading lib/time/zones.ts" },
    ],
    commits: [
      {
        sha: "a3f19c2",
        message: "RALPH: streak core with single grace day (#23)",
        at: "2026-08-23T18:31:00Z",
        additions: 118,
        deletions: 12,
      },
    ],
  },
  {
    id: "run_7c04",
    storyNumber: 22,
    storyTitle: "Create and archive a habit",
    state: "succeeded",
    attempt: 2,
    maxAttempts: 5,
    branch: "machinai/issue-22",
    startedAt: "2026-08-23T17:38:00Z",
    elapsedMs: 31 * 60_000 + 42_000,
    prNumber: 47,
    sandbox: { vcpus: 2, memoryGb: 4, timeoutMs: 40 * 60_000, region: "iad1" },
    steps: [
      { id: "queued", label: "Queued", state: "done", durationMs: 3_000 },
      { id: "sandbox", label: "Sandbox booting", state: "done", durationMs: 9_000 },
      {
        id: "agent",
        label: "Agent working",
        state: "done",
        durationMs: 28 * 60_000,
        detail: "completed at iteration 19",
      },
      {
        id: "tests",
        label: "Tests",
        state: "done",
        durationMs: 2 * 60_000 + 30_000,
        detail: "34 passed",
      },
      { id: "pr", label: "Pull request", state: "done", detail: "#47 opened" },
    ],
    logTail: [
      { ts: "18:08:12", text: "34 passing" },
      { ts: "18:08:40", text: "pushed machinai/issue-22" },
      { ts: "18:09:02", text: "opened PR #47" },
      { ts: "18:09:03", text: "<promise>COMPLETE</promise>" },
    ],
    commits: [
      {
        sha: "b71e408",
        message: "RALPH: habit model + create form (#22)",
        at: "2026-08-23T17:56:00Z",
        additions: 204,
        deletions: 6,
      },
      {
        sha: "c02d5aa",
        message: "RALPH: archive without cascading delete (#22)",
        at: "2026-08-23T18:07:00Z",
        additions: 61,
        deletions: 18,
      },
    ],
    tests: { passed: 34, failed: 0, total: 34, durationMs: 150_000, failures: [] },
  },
  {
    id: "run_6b93",
    storyNumber: 23,
    storyTitle: "Streak calculation with grace days",
    state: "checkpointed",
    attempt: 1,
    maxAttempts: 5,
    branch: "machinai/issue-23",
    startedAt: "2026-08-23T17:31:00Z",
    elapsedMs: 40 * 60_000,
    note: "Hit the 40-minute sandbox budget. Committed progress and left a status comment; attempt 2 resumed on the same branch.",
    sandbox: { vcpus: 2, memoryGb: 4, timeoutMs: 40 * 60_000, region: "iad1" },
    steps: [
      { id: "queued", label: "Queued", state: "done", durationMs: 3_000 },
      { id: "sandbox", label: "Sandbox booting", state: "done", durationMs: 10_000 },
      {
        id: "agent",
        label: "Agent working",
        state: "done",
        durationMs: 39 * 60_000,
        detail: "checkpointed at iteration 40",
      },
      { id: "tests", label: "Tests", state: "skipped", detail: "budget reached" },
      { id: "pr", label: "Pull request", state: "skipped" },
    ],
    logTail: [
      { ts: "18:10:44", text: "2 minutes of budget left — checkpointing", level: "warn" },
      { ts: "18:11:02", text: "committed work in progress" },
      { ts: "18:11:20", text: "commented status on issue #23" },
    ],
    commits: [
      {
        sha: "9d4e771",
        message: "RALPH: WIP streak scaffolding, timezone open (#23)",
        at: "2026-08-23T18:11:00Z",
        additions: 87,
        deletions: 3,
      },
    ],
  },
  {
    id: "run_5a17",
    storyNumber: 25,
    storyTitle: "Weekly summary email",
    state: "stuck",
    attempt: 5,
    maxAttempts: 5,
    branch: "machinai/issue-25",
    startedAt: "2026-08-23T10:22:00Z",
    elapsedMs: 38 * 60_000 + 11_000,
    note: "Five attempts, same failure each time: no mail provider is configured, so the send path cannot be tested. Needs a decision from you before a sixth run is worth spending.",
    sandbox: { vcpus: 2, memoryGb: 4, timeoutMs: 40 * 60_000, region: "iad1" },
    steps: [
      { id: "queued", label: "Queued", state: "done", durationMs: 3_000 },
      { id: "sandbox", label: "Sandbox booting", state: "done", durationMs: 12_000 },
      { id: "agent", label: "Agent working", state: "done", durationMs: 34 * 60_000 },
      {
        id: "tests",
        label: "Tests",
        state: "failed",
        durationMs: 44_000,
        detail: "2 failed",
      },
      { id: "pr", label: "Pull request", state: "skipped" },
    ],
    logTail: [
      { ts: "10:59:31", text: "MAIL_PROVIDER unset; falling back to console transport" },
      { ts: "10:59:48", text: "summary.spec.ts: expected 1 send, got 0", level: "error" },
      { ts: "11:00:02", text: "unsubscribe.spec.ts: token verification failed", level: "error" },
      { ts: "11:04:00", text: "attempt 5 of 5 exhausted", level: "error" },
    ],
    commits: [],
    tests: {
      passed: 12,
      failed: 2,
      total: 14,
      durationMs: 44_000,
      failures: [
        "summary.spec.ts › sends on Monday 08:00 local",
        "unsubscribe.spec.ts › honours one-click unsubscribe",
      ],
    },
  },
];

export const pullRequest: PullRequest = {
  number: 47,
  title: "Create and archive a habit",
  storyNumber: 22,
  branch: "machinai/issue-22",
  baseBranch: "main",
  state: "open",
  additions: 265,
  deletions: 24,
  agentSummary:
    "Added the habit model with a cadence enum, a create form, and archiving as a soft flag so history survives. Archiving deliberately does not cascade — the streak calculation in #23 still reads those rows. The 60-character name cap is enforced in both the schema and the form.",
  checks: [
    { name: "typecheck", state: "passed" },
    { name: "test", state: "passed" },
    { name: "build", state: "running" },
  ],
  files: [
    {
      path: "lib/habits/model.ts",
      status: "added",
      additions: 48,
      deletions: 0,
      lines: [
        { type: "add", content: "export type Cadence =", newLine: 1 },
        { type: "add", content: '  | { kind: "daily" }', newLine: 2 },
        { type: "add", content: '  | { kind: "weekdays"; days: Weekday[] };', newLine: 3 },
        { type: "add", content: "", newLine: 4 },
        { type: "add", content: "export interface Habit {", newLine: 5 },
        { type: "add", content: "  id: string;", newLine: 6 },
        { type: "add", content: "  name: string; // capped at 60 chars", newLine: 7 },
        { type: "add", content: "  cadence: Cadence;", newLine: 8 },
        { type: "add", content: "  archivedAt: string | null;", newLine: 9 },
        { type: "add", content: "}", newLine: 10 },
      ],
    },
    {
      path: "lib/habits/archive.ts",
      status: "modified",
      additions: 19,
      deletions: 11,
      lines: [
        {
          type: "ctx",
          content: "export async function archive(id: string) {",
          oldLine: 3,
          newLine: 3,
        },
        { type: "del", content: "  await db.habit.delete({ where: { id } });", oldLine: 4 },
        {
          type: "add",
          content: "  // Soft archive: the streak maths in #23 still reads these rows.",
          newLine: 4,
        },
        { type: "add", content: "  await db.habit.update({", newLine: 5 },
        { type: "add", content: "    where: { id },", newLine: 6 },
        {
          type: "add",
          content: "    data: { archivedAt: new Date().toISOString() },",
          newLine: 7,
        },
        { type: "add", content: "  });", newLine: 8 },
        { type: "ctx", content: "}", oldLine: 5, newLine: 9 },
      ],
    },
    {
      path: "app/habits/new/page.tsx",
      status: "added",
      additions: 96,
      deletions: 0,
      lines: [
        { type: "add", content: "export default function NewHabitPage() {", newLine: 1 },
        { type: "add", content: "  return <HabitForm maxNameLength={60} />;", newLine: 2 },
        { type: "add", content: "}", newLine: 3 },
      ],
    },
  ],
};

export const usage: Usage = {
  periodEndsAt: "2026-09-01T00:00:00Z",
  meters: [
    { label: "Sandbox memory", used: 61.4, limit: 420, unit: "GB-hr" },
    { label: "Sandbox active CPU", used: 0.9, limit: 5, unit: "hr" },
    { label: "Sandbox creations", used: 38, limit: 5000, unit: "" },
    { label: "Actions minutes", used: 412, limit: null, unit: "min" },
  ],
};

/** What the planner streams back before anything is filed as an issue. */
export const draftPrd = `A habit tracker where streaks survive real life and a partner keeps you honest.

**Who it's for.** People who have abandoned three habit apps because one missed day wiped a month of progress.

**The wedge.** One grace day per streak, and a single accountability partner who can see it. Not a social network — one person.

**Not in scope.** Gamification, points, badges, public leaderboards.`;

export const draftStories: DraftStory[] = [
  {
    tempId: "d1",
    epicTitle: "Accounts & access",
    title: "Email + password sign-in",
    body: "As a returning user, I want to sign in with email and password so that I can reach my habits on any device.",
    acceptanceCriteria: [
      "Invalid credentials show an inline error, never a redirect",
      "Session survives a full page reload",
    ],
    size: "M",
    blockedBy: [],
  },
  {
    tempId: "d2",
    epicTitle: "Habit tracking core",
    title: "Create and archive a habit",
    body: "As a user, I want to create a habit with a name and cadence so that I can start tracking it.",
    acceptanceCriteria: [
      "Cadence supports daily and specific weekdays",
      "Archiving hides a habit without deleting its history",
    ],
    size: "M",
    blockedBy: ["d1"],
  },
  {
    tempId: "d3",
    epicTitle: "Habit tracking core",
    title: "Log a completion for today",
    body: "As a user, I want to tick a habit off so that today counts toward my streak.",
    acceptanceCriteria: ["One tap from the habit list", "Undo available for 30 seconds"],
    size: "S",
    blockedBy: ["d2"],
  },
  {
    tempId: "d4",
    epicTitle: "Habit tracking core",
    title: "Streak calculation with grace days",
    body: "As a user, I want one missed day not to reset my streak so that a single bad day does not undo a month of work.",
    acceptanceCriteria: [
      "A streak survives exactly one missed scheduled day",
      "Two consecutive misses reset it to zero",
      "Timezone comes from the user profile, not the request",
    ],
    size: "L",
    blockedBy: ["d3"],
  },
  {
    tempId: "d5",
    epicTitle: "Social accountability",
    title: "Invite an accountability partner",
    body: "As a user, I want to invite someone by email so that we can see each other's streaks.",
    acceptanceCriteria: ["Invite expires after 7 days", "Either side can revoke"],
    size: "M",
    blockedBy: ["d4"],
  },
  {
    tempId: "d6",
    epicTitle: "Social accountability",
    title: "Nudge a partner who missed two days",
    body: "As an accountability partner, I want to send a one-tap nudge so that I can help without composing a message.",
    acceptanceCriteria: ["At most one nudge per partner per day"],
    size: "S",
    blockedBy: ["d5"],
  },
];

// ---- derived helpers -------------------------------------------------------

export const storyByNumber = (n: number) => stories.find((s) => s.number === n);
export const runById = (id: string) => runs.find((r) => r.id === id);
export const runsForStory = (n: number) => runs.filter((r) => r.storyNumber === n);
export const activeRun = () => runs.find((r) => r.state === "running");
export const epicByNumber = (n?: number) =>
  n === undefined ? undefined : epics.find((e) => e.number === n);
