import { createHmac, timingSafeEqual, createSign } from "node:crypto";

/**
 * GitHub App plumbing: verify what arrives, mint what we need to act.
 *
 * This is the piece that makes zero footprint possible. A target repo grants
 * access by installing the app — no workflow file committed, no PAT pasted —
 * and we exchange a short-lived JWT for a per-repo token that expires in an
 * hour.
 */

export interface AppConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
}

export function loadAppConfig(): AppConfig {
  const appId = process.env.GH_APP_ID;
  const webhookSecret = process.env.GH_WEBHOOK_SECRET;
  // Vercel env vars are single-line, so the PEM is stored with escaped
  // newlines and restored here.
  const privateKey = process.env.GH_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!appId || !privateKey || !webhookSecret) {
    throw new Error(
      "GitHub App is not configured: need GH_APP_ID, GH_APP_PRIVATE_KEY and GH_WEBHOOK_SECRET.",
    );
  }
  return { appId, privateKey, webhookSecret };
}

/**
 * Verify the `X-Hub-Signature-256` header against the raw body.
 *
 * Must run on the *raw* bytes — re-serialising the parsed JSON will not
 * reproduce GitHub's payload and the signature will never match.
 */
export function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual throws on a length mismatch.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** App-level JWT, good for ten minutes. Only used to fetch installation tokens. */
function appJwt(config: AppConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    // Backdated by a minute so mild clock skew between us and GitHub is fine.
    iat: now - 60,
    exp: now + 9 * 60,
    iss: config.appId,
  };

  const b64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${b64(header)}.${b64(payload)}`;

  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(config.privateKey)
    .toString("base64url");

  return `${unsigned}.${signature}`;
}

export interface InstallationToken {
  token: string;
  expiresAt: string;
}

/**
 * Mint a token scoped to one installation, and optionally to specific repos.
 *
 * Valid for one hour. A run must finish inside that — which is why the sandbox
 * budget is 40 minutes.
 */
export async function installationToken(
  installationId: number,
  config: AppConfig,
  repositories?: string[],
): Promise<InstallationToken> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${appJwt(config)}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "machinai",
      },
      body: repositories ? JSON.stringify({ repositories }) : undefined,
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not mint an installation token: ${response.status} ${await response.text()}`,
    );
  }

  const body = (await response.json()) as {
    token: string;
    expires_at: string;
  };
  return { token: body.token, expiresAt: body.expires_at };
}

/**
 * Fire the build workflow in machinai's own repo against someone else's repo.
 *
 * Note the credential: this uses `MACHINAI_DISPATCH_TOKEN`, *not* the
 * installation token. Two different things are going on and they should not
 * share a credential:
 *
 *  - The installation token grants access to the customer's repo. They granted
 *    it by installing the app, and it carries no `actions` permission because
 *    machinai has no business running workflows in their repo.
 *  - Triggering our own CI is machinai's infrastructure, on machinai's repo.
 *
 * Keeping them separate also means the app never has to ask a customer for
 * `actions: write`, which would be an alarming permission to request and an
 * unnecessary one to hold.
 *
 * The installation id is passed as an input rather than a token: the workflow
 * mints its own fresh one, so a queued run cannot start with a token that has
 * already expired.
 */
export async function dispatchCredential(): Promise<string> {
  // Preferred: a second GitHub App holding only `actions: write`, installed on
  // our orchestrator repo alone. It never expires from our point of view, and
  // its permissions are declared in a manifest rather than typed into a form.
  const appId = process.env.GH_DISPATCH_APP_ID;
  const privateKey = process.env.GH_DISPATCH_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const installationId = process.env.GH_DISPATCH_INSTALLATION_ID;

  if (appId && privateKey && installationId) {
    const { token } = await installationToken(Number(installationId), {
      appId,
      privateKey,
      // Unused for token minting; the dispatch app has no webhook.
      webhookSecret: "",
    });
    return token;
  }

  // Fallback: a fine-grained PAT with Actions write. Works, but its creation
  // form quietly produces a token with no org access if Resource owner is left
  // as the personal account — which is exactly what happened here, twice.
  const pat = process.env.MACHINAI_DISPATCH_TOKEN;
  if (pat) return pat;

  throw new Error(
    "No dispatch credential: set GH_DISPATCH_APP_ID + GH_DISPATCH_APP_PRIVATE_KEY + GH_DISPATCH_INSTALLATION_ID, or MACHINAI_DISPATCH_TOKEN.",
  );
}

export async function dispatchBuild(opts: {
  dispatchToken: string;
  installationId: number;
  targetRepo: string;
  issueNumber: number;
  issueTitle: string;
  baseBranch: string;
  installCmd: string;
  testCmd: string;
}): Promise<void> {
  const orchestrator = process.env.MACHINAI_ORCHESTRATOR_REPO ?? "Inergent/machinai";

  const response = await fetch(
    `https://api.github.com/repos/${orchestrator}/actions/workflows/build.yml/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.dispatchToken}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "machinai",
      },
      body: JSON.stringify({
        ref: process.env.MACHINAI_ORCHESTRATOR_REF ?? "main",
        inputs: {
          repo: opts.targetRepo,
          issue_number: String(opts.issueNumber),
          issue_title: opts.issueTitle,
          base_branch: opts.baseBranch,
          install_cmd: opts.installCmd,
          test_cmd: opts.testCmd,
          installation_id: String(opts.installationId),
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Workflow dispatch failed: ${response.status} ${await response.text()}`,
    );
  }
}

/**
 * Issue numbers this story waits on, parsed from `Blocked by #12, #13` lines in
 * the body.
 *
 * The dependency graph lives in issue *content* rather than a file, which is
 * what keeps zero footprint intact while still giving the scheduler something
 * to read — and keeps it visible to a human looking at the issue.
 */
export function parseBlockedBy(body: string): number[] {
  const found = new Set<number>();
  const line = /^\s*blocked\s+by\s*:?\s*(.+)$/gim;

  for (const match of body.matchAll(line)) {
    for (const ref of match[1]!.matchAll(/#(\d+)/g)) {
      found.add(Number(ref[1]));
    }
  }
  return [...found];
}
