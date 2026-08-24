# machinai — working notes

Read this before changing anything. Most of what follows was learned by a run
failing, not by reading documentation.

## What this is

A story goes into a GitHub backlog, gets a label, and comes back as a pull
request. The user watches from their phone. Target repos stay clean — machinai
never commits a single file to them.

| Path | What it does | Runs where |
| --- | --- | --- |
| `apps/web` | UI + GitHub webhook receiver | Vercel |
| `packages/harness` | Clones a repo, runs an agent in a sandbox, opens a PR | GitHub Actions |
| `scripts/register-github-app.mjs` | One-click App registration (two roles) | Locally, once |
| `.github/workflows/build.yml` | The orchestrator host | GitHub Actions |
| `.github/workflows/deploy.yml` | Ships `apps/web` on push to `main` | GitHub Actions |

## Two rules that are load-bearing

**1. Zero footprint.** Nothing machinai-shaped may ever be committed to a target
repo. Sandcastle anchors `.sandcastle/worktrees|logs|patches` to the host repo
directory — which *is* the user's checkout — so `lib/target-repo.ts` writes those
paths into `.git/info/exclude` (per-clone, never committed) and
`assertNoFootprint()` inspects the branch before any push. Do not weaken either.

**2. The harness takes arguments, never ambient context.** `packages/harness`
must not read `github.event.*`, `GITHUB_*`, or anything that only exists on an
Actions runner. Everything enters through `lib/config.ts`. This is what lets the
orchestrator move into a Vercel Sandbox daemon later as a deployment change
rather than a rewrite.

## Sandcastle (v0.12.0) — pinned, and here is why

Pre-1.0, and its Vercel provider is the least-exercised path in it.

- **The bundled Vercel provider drops stdin.** Its `exec()` reads only `cwd`,
  `onLine` and `sudo`, ignoring the `stdin` option its own interface documents.
  The Claude agent provider invokes `claude --print … -p -` — trailing dash,
  prompt on stdin. Paired as shipped, the prompt vanishes with no error and the
  agent burns every iteration asking what you wanted. `lib/vercel-sandbox.ts` is
  our replacement; delete it if upstream fixes this.
- **`@vercel/sandbox` has no `stdin` parameter either**, so we write the payload
  to a file in the sandbox and prepend `cat <file> |`.
- **We do not get the `universal` image.** Sandcastle passes `runtime`, never
  `image`, so sandboxes are **Amazon Linux 2023 / node22**: `git`, `node`,
  `curl`, `python3` present; **no `claude`, no `gh`, no `jq`, no `rg`**. Claude
  Code is installed by a startup hook. SDK 1.10.2 has no `image` parameter at
  all, so this is not a preference.
- **Env vars are not forwarded unless declared in a `.env` file.** machinai has
  no `.sandcastle` directory by design, so the agent's credential is passed
  explicitly via `claudeCode(model, { env })`. Miss this and the agent boots
  unauthenticated.
- **Windows hosts need `core.autocrlf=false`, `core.eol=lf`, and
  `core.longpaths=true`** on the clone. Sandcastle replays sandbox commits with
  `git am`; CRLF context lines make every patch fail, and nested worktrees blow
  past `MAX_PATH`. Both are set in `prepareTargetRepo`.

## The sandbox does no GitHub I/O

Reads are fetched on the host and injected as a prompt argument; writes happen on
the host from the agent's `<checkpoint>` block. So **no GitHub token ever enters
a sandbox** — which is what multi-tenant will need — and prompts do not depend on
what the image ships.

## Two GitHub Apps, deliberately

| App | Permissions | Installed on |
| --- | --- | --- |
| `machinai` | contents, issues, pull_requests (write), metadata | the user's repo |
| `machinai-dispatch` | **actions:write**, metadata | `Inergent/machinai` only |

The customer-facing app has **no `actions` permission**. Triggering our own CI is
machinai's infrastructure, not something a customer should grant — asking for
`actions:write` at install time would rightly alarm people.

Register either with `node scripts/register-github-app.mjs [customer|dispatch]`.
Use the manifest flow, not the web form: two fine-grained PATs in a row were
created with Resource owner set to the personal account instead of the org, which
produces a token that reads public data fine and 403s on everything else.

**Testing a credential means exercising the exact permission you need.** Reading
a public repo proves nothing. To check `actions:write`, POST a dispatch to a
nonexistent workflow: 404 means granted, 403 means not.

## Never assume build commands

`lib/detect.ts` reads the checkout — lockfile first, then `packageManager`, then
`package.json`, then Python markers. Hardcoding `npm ci` breaks on the first repo
without a lockfile, which is most of them. Explicit config always wins.

## Budget and checkpoints

Vercel Hobby caps a sandbox **session** at 45 minutes, so runs get 40 and end
deliberately. Out of budget with commits is a **checkpoint, not a failure**: the
branch is re-queued and the next attempt resumes it, because
`branchStrategy: { type: "branch" }` reuses the worktree.

Attempts are counted from machinai's own checkpoint comments — GitHub is the
state store, there is no database. Infra failures use a **different marker** so a
machinai bug never consumes one of a story's five attempts.

## Webhook rules

- Verify `X-Hub-Signature-256` against the **raw bytes**. Re-serialising parsed
  JSON produces different bytes and would never match.
- Respond **before** dispatching (`after()`). GitHub retries a slow webhook, and
  a retry means two agents on one branch.
- Malformed payloads get **400, not 500** — GitHub retries 5xx forever.

## From the AI-native SDLC playbook

- The agent **may never edit a test to make it pass**. It says so and stops.
  Without this rule an agent under iteration pressure edits the assertion.
- **machinai never auto-merges.** The merge is always a human tap.
- The artifact chain (intent → spec → plan → PR) lives in issue **content**, not
  files, which is what keeps zero footprint intact.

## Deploying

`apps/web` deploys via `.github/workflows/deploy.yml` on push to `main`, and
pins the `machinai-dev.vercel.app` alias. Do not deploy by hand: a fix was once
committed but never shipped, and the live webhook kept overriding the very
detection meant to replace it. The alias must stay pinned or every deploy moves
the URL the GitHub App calls.

## Verifying a change

```bash
npm run build --workspace=apps/web        # typecheck + build
cd packages/harness && npx tsc --noEmit   # harness typecheck
```

End to end: reset the testbed (close the PR, delete `machinai/issue-1`, clear
labels and comments), then add `machinai:ready` to
[`Inergent/machinai-testbed`](https://github.com/Inergent/machinai-testbed)
issue #1 and watch `gh run list --repo Inergent/machinai`.

Secrets live in the scratchpad, never here — **this repo is public**.
