import type { DraftStory } from "./types";

/**
 * The last remaining fixtures, and the only ones that should exist.
 *
 * Everything else now reads from GitHub. What is left feeds the planner preview
 * on the home screen — a feature that is not built yet — and that screen says so
 * plainly rather than pretending to work.
 *
 * Phase 4 replaces these with a real `claude -p` decomposition and this file
 * goes away.
 */

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
