/**
 * Register the machinai GitHub App in one click.
 *
 * GitHub's App Manifest flow lets us declare every permission, event and URL up
 * front, so you confirm a prepared app instead of filling in a twenty-field
 * form and getting one of them subtly wrong. GitHub hands back the app id,
 * private key, webhook secret and OAuth credentials in a single exchange.
 *
 *   node scripts/register-github-app.mjs
 *
 * Credentials are written to the scratchpad, never into this repository —
 * machinai is public.
 */
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const PORT = Number(process.env.PORT || 7777);
const ORG = process.env.MACHINAI_ORG || "Inergent";
const WEBHOOK_BASE =
  process.env.MACHINAI_WEBHOOK_BASE || "https://machinai-dev.vercel.app";

/**
 * Two apps, deliberately.
 *
 * `customer` is what a user installs on their repository. It can read stories
 * and push branches, and it has no `actions` permission at all — machinai has
 * no business running workflows inside someone else's repo, and asking for that
 * at install time would rightly alarm people.
 *
 * `dispatch` is machinai's own infrastructure credential. It only ever gets
 * installed on our orchestrator repo, and it exists so triggering our CI never
 * requires widening what customers grant. A fine-grained PAT can do this job
 * too, but its creation form has one field — Resource owner — that silently
 * produces a token with no org access at all, which is a bad trap to leave in
 * a setup path.
 */
const ROLE = (process.argv[2] || "customer").toLowerCase();

const ROLES = {
  customer: {
    name: process.env.MACHINAI_APP_NAME || "machinai",
    description:
      "Turns GitHub issues into pull requests. machinai reads a story, builds it in an isolated cloud sandbox, and opens a PR for you to review — without adding a single file to your repository.",
    permissions: {
      contents: "write",
      issues: "write",
      pull_requests: "write",
      metadata: "read",
    },
    events: ["issues", "issue_comment", "pull_request", "pull_request_review"],
    webhook: true,
    credsFile: "machinai-github-app.json",
    blurb: [
      ["Contents", "read &amp; write", "clone, push agent branches"],
      ["Issues", "read &amp; write", "read stories, comment, label"],
      ["Pull requests", "read &amp; write", "open PRs"],
      ["Metadata", "read", ""],
    ],
  },
  dispatch: {
    name: process.env.MACHINAI_APP_NAME || "machinai-dispatch",
    description:
      "machinai's internal credential for triggering its own build workflow. Install this only on the machinai orchestrator repository — never on a project repo.",
    permissions: { actions: "write", metadata: "read" },
    events: [],
    webhook: false,
    credsFile: "machinai-dispatch-app.json",
    blurb: [
      ["Actions", "read &amp; write", "start the build workflow"],
      ["Metadata", "read", ""],
    ],
  },
};

const role = ROLES[ROLE];
if (!role) {
  console.error(`Unknown role "${ROLE}". Use "customer" or "dispatch".`);
  process.exit(1);
}

const APP_NAME = role.name;
const OUT = process.env.MACHINAI_APP_CREDS || resolve(process.env.TEMP || "/tmp", role.credsFile);

const state = randomBytes(16).toString("hex");

const manifest = {
  name: APP_NAME,
  url: WEBHOOK_BASE,
  description: role.description,
  ...(role.webhook
    ? {
        hook_attributes: {
          url: `${WEBHOOK_BASE}/api/github/webhook`,
          active: true,
        },
      }
    : {}),
  redirect_url: `http://localhost:${PORT}/callback`,
  public: false,
  // Exactly what this role needs and nothing more.
  default_permissions: role.permissions,
  default_events: role.events,
};

const page = `<!doctype html>
<meta charset="utf-8">
<title>Register machinai</title>
<style>
  :root { color-scheme: dark; }
  body { background:#0b0d12; color:#e6e9ef; font:16px/1.6 ui-sans-serif,system-ui,sans-serif;
         display:grid; place-items:center; min-height:100vh; margin:0; padding:24px; }
  .card { max-width:33rem; }
  h1 { font-size:1.5rem; margin:0 0 .5rem; letter-spacing:-.02em; }
  p  { color:#8b93a7; margin:.5rem 0; }
  ul { color:#8b93a7; padding-left:1.1rem; }
  code { font:14px ui-monospace,monospace; color:#e6e9ef; }
  button { margin-top:1.5rem; background:#4c7dff; color:#0b0d12; border:0; border-radius:8px;
           padding:.7rem 1.1rem; font-size:.95rem; font-weight:600; cursor:pointer; }
  button:hover { background:#6b93ff; }
</style>
<div class="card">
  <h1>Register <code>${APP_NAME}</code></h1>
  <p>This creates <code>${APP_NAME}</code> on the <code>${ORG}</code> organisation with exactly these permissions:</p>
  <ul>
    ${role.blurb
      .map(
        ([name, level, why]) =>
          `<li>${name} — ${level}${why ? ` <span style="opacity:.7">(${why})</span>` : ""}</li>`,
      )
      .join("\n    ")}
  </ul>
  <p>Nothing is installed on any repository yet — you choose that in the next step.</p>
  <form method="post" action="https://github.com/organizations/${ORG}/settings/apps/new?state=${state}">
    <input type="hidden" name="manifest" value='${JSON.stringify(manifest).replaceAll("'", "&apos;")}'>
    <button type="submit">Create the app on GitHub</button>
  </form>
</div>`;

const done = (title, body) => `<!doctype html>
<meta charset="utf-8"><title>${title}</title>
<style>
  :root { color-scheme: dark; }
  body { background:#0b0d12; color:#e6e9ef; font:16px/1.6 ui-sans-serif,system-ui,sans-serif;
         display:grid; place-items:center; min-height:100vh; margin:0; padding:24px; }
  div { max-width:33rem; }
  h1 { font-size:1.5rem; margin:0 0 .5rem; }
  p { color:#8b93a7; }
  code { font:14px ui-monospace,monospace; color:#e6e9ef; }
</style>
<div><h1>${title}</h1>${body}</div>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page);
    return;
  }

  if (url.pathname !== "/callback") {
    res.writeHead(404).end("not found");
    return;
  }

  if (url.searchParams.get("state") !== state) {
    res.writeHead(400, { "content-type": "text/html; charset=utf-8" });
    res.end(done("State mismatch", "<p>Start over — this response did not come from the request we made.</p>"));
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("missing code");
    return;
  }

  try {
    const response = await fetch(
      `https://api.github.com/app-manifests/${code}/conversions`,
      {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "machinai-setup",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    const app = await response.json();

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(
      OUT,
      JSON.stringify(
        {
          appId: app.id,
          slug: app.slug,
          name: app.name,
          clientId: app.client_id,
          clientSecret: app.client_secret,
          webhookSecret: app.webhook_secret,
          privateKey: app.pem,
          htmlUrl: app.html_url,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );

    console.log(`\n  App created: ${app.name} (id ${app.id})`);
    console.log(`  Credentials: ${OUT}`);
    console.log(`  Install it:  ${app.html_url}/installations/new\n`);

    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      done(
        "machinai is registered",
        `<p>App <code>${app.name}</code> (id <code>${app.id}</code>) is created, and its credentials are saved locally.</p>
         <p>Last step — choose which repositories it can see:</p>
         <p><a style="color:#4c7dff" href="${app.html_url}/installations/new">Install machinai →</a></p>
         <p style="margin-top:1.5rem">You can close this tab afterwards.</p>`,
      ),
    );
  } catch (error) {
    console.error("Exchange failed:", error);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(done("Exchange failed", `<p><code>${String(error)}</code></p>`));
  } finally {
    setTimeout(() => server.close(), 1500);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Open http://localhost:${PORT} to register the machinai app.`);
  console.log(`  Org: ${ORG}   Webhook: ${WEBHOOK_BASE}/api/github/webhook\n`);
});
