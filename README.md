# machinai

Describe it. Walk away. Come back to a pull request.

machinai turns an idea into a decomposed backlog of user stories, then runs
coding agents in the cloud to build them — one pull request per story — while
you review progress and leave feedback from your phone.

## Status

**Phase 1: mock UI.** Every screen renders from `apps/web/lib/fixtures/`. There
is no backend, no auth, no GitHub integration, and no agent. The fixture types
in `lib/fixtures/types.ts` are the data contract the real backend will satisfy.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js 16 + Tailwind v4 + shadcn/ui. Mobile-first. |
| `packages/harness` | *(Phase 2)* Sandcastle orchestration. Takes arguments, never `github.event.*`. |
| `packages/planner` | *(Phase 4)* Idea → stories, as a `claude -p` call. |

## Develop

```bash
npm install
npm run dev
```

## Design rules

- Two font families: Geist Sans for what a human wrote, Geist Mono for what a
  machine produced (issue numbers, branches, SHAs, durations, log lines).
- One accent (`#4C7DFF`), used only for the primary action and the running
  state. Everything else is neutral.
- Motion communicates state or does not happen. The pulsing dot means a run is
  genuinely live.
- Group with whitespace before reaching for a border. One level of elevation,
  ever.
