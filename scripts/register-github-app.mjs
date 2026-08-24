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
const APP_NAME = process.env.MACHINAI_APP_NAME || "machinai";
const WEBHOOK_BASE =
  process.env.MACHINAI_WEBHOOK_BASE || "https://machinai-dev.vercel.app";
const OUT =
  process.env.MACHINAI_APP_CREDS ||
  resolve(process.env.TEMP || "/tmp", "machinai-github-app.json");

const state = randomBytes(16).toString("hex");

const manifest = {
  name: APP_NAME,
  url: WEBHOOK_BASE,
  description:
    "Turns GitHub issues into pull requests. machinai reads a story, builds it in an isolated cloud sandbox, and opens a PR for you to review — without adding a single file to your repository.",
  hook_attributes: { url: `${WEBHOOK_BASE}/api/github/webhook`, active: true },
  redirect_url: `http://localhost:${PORT}/callback`,
  public: false,
  // Exactly what the loop needs and nothing more.
  default_permissions: {
    contents: "write", // clone, push the machinai/* branch
    issues: "write", // read the story, comment, label
    pull_requests: "write", // open and update the PR
    metadata: "read", // required by GitHub alongside the above
  },
  default_events: [
    "issues", // the machinai:ready label is the trigger
    "issue_comment", // feedback on a story
    "pull_request", // merged / closed transitions
    "pull_request_review",
  ],
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
  <h1>Register the machinai app</h1>
  <p>This creates a GitHub App on the <code>${ORG}</code> organisation with exactly these permissions:</p>
  <ul>
    <li>Contents — read &amp; write <span style="opacity:.7">(clone, push agent branches)</span></li>
    <li>Issues — read &amp; write <span style="opacity:.7">(read stories, comment, label)</span></li>
    <li>Pull requests — read &amp; write <span style="opacity:.7">(open PRs)</span></li>
    <li>Metadata — read</li>
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
