import { after } from "next/server";
import {
  dispatchCredential,
  dispatchBuild,
  installationToken,
  loadAppConfig,
  parseBlockedBy,
  verifySignature,
} from "@/lib/github-app";

/**
 * Where the AFK loop actually starts.
 *
 * A story gets the `machinai:ready` label — from the app, from GitHub Mobile,
 * from anywhere — and this turns that into a running agent. Nothing is
 * installed in the user's repo to make it work; the GitHub App delivers the
 * event and the credential.
 */

export const runtime = "nodejs";

const LABEL = {
  ready: "machinai:ready",
  revise: "machinai:revise",
  blocked: "machinai:blocked",
} as const;

/**
 * Per-project build settings. Phase 5 reads these from a database.
 *
 * Empty commands are deliberate: the harness detects them from the checkout.
 * A default of `npm ci` fails on any repo without a lockfile, which is a poor
 * first impression for "point machinai at any repo".
 */
const DEFAULTS = {
  baseBranch: "main",
  installCmd: "",
  testCmd: "",
};

type IssueEvent = {
  action: string;
  label?: { name: string };
  issue: {
    number: number;
    title: string;
    body: string | null;
    state: string;
    pull_request?: unknown;
  };
  repository: { full_name: string; default_branch: string };
  installation?: { id: number };
};

export async function POST(request: Request) {
  // Signature must be checked against the raw bytes — re-serialising the
  // parsed JSON produces different bytes and never matches.
  const raw = await request.text();

  let config;
  try {
    config = loadAppConfig();
  } catch (error) {
    console.error("webhook: app not configured", error);
    return new Response("GitHub App not configured", { status: 503 });
  }

  if (
    !verifySignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      config.webhookSecret,
    )
  ) {
    return new Response("Bad signature", { status: 401 });
  }

  const event = request.headers.get("x-github-event");

  let payload: IssueEvent;
  try {
    payload = JSON.parse(raw) as IssueEvent;
  } catch {
    // 400, not 500: GitHub retries 5xx, and a body that will not parse now
    // will not parse on the retry either.
    return new Response("Malformed JSON", { status: 400 });
  }

  // Acknowledge fast. GitHub retries on a slow response, and a retry here
  // means a duplicate agent run.
  if (event !== "issues" || payload.action !== "labeled") {
    return Response.json({ ok: true, ignored: `${event}.${payload.action}` });
  }

  const labelName = payload.label?.name;
  if (labelName !== LABEL.ready && labelName !== LABEL.revise) {
    return Response.json({ ok: true, ignored: labelName });
  }

  // Same reasoning as the parse failure: a payload missing the fields this
  // event type is defined to carry is malformed, so reject it permanently
  // rather than letting a property access throw a retryable 500.
  if (!payload.issue || !payload.repository?.full_name) {
    return new Response("Payload missing issue or repository", { status: 400 });
  }

  // A GitHub issue number can be a pull request; building one would be
  // nonsense.
  if (payload.issue.pull_request) {
    return Response.json({ ok: true, ignored: "pull request, not an issue" });
  }
  if (payload.issue.state !== "open") {
    return Response.json({ ok: true, ignored: "issue is closed" });
  }

  const installationId = payload.installation?.id;
  if (!installationId) {
    return Response.json(
      { ok: false, error: "no installation on payload" },
      { status: 400 },
    );
  }

  const repo = payload.repository.full_name;
  const [owner, name] = repo.split("/");
  const issueNumber = payload.issue.number;

  // Dispatch after responding, so GitHub gets its 200 immediately.
  after(async () => {
    try {
      const { token } = await installationToken(installationId, config, [name!]);

      // The scheduler is deterministic on purpose: machinai owns the
      // dependency graph, and no model decides what runs next.
      const blockers = parseBlockedBy(payload.issue.body ?? "");
      const open: number[] = [];
      for (const n of blockers) {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/issues/${n}`,
          {
            headers: {
              authorization: `Bearer ${token}`,
              accept: "application/vnd.github+json",
              "user-agent": "machinai",
            },
          },
        );
        if (res.ok) {
          const blocker = (await res.json()) as { state: string };
          if (blocker.state === "open") open.push(n);
        }
      }

      if (open.length > 0) {
        await comment(
          repo,
          issueNumber,
          token,
          `Not started yet — still waiting on ${open
            .map((n) => `#${n}`)
            .join(", ")}. machinai green-lights this automatically once they close.`,
        );
        await setLabels(repo, issueNumber, token, {
          add: [LABEL.blocked],
          remove: [LABEL.ready],
        });
        return;
      }

      let dispatchToken: string;
      try {
        dispatchToken = await dispatchCredential();
      } catch (error) {
        await comment(
          repo,
          issueNumber,
          token,
          `machinai received this but cannot start a build — its dispatch credential is not configured.\n\n\`${error instanceof Error ? error.message : String(error)}\``,
        );
        return;
      }

      await dispatchBuild({
        dispatchToken,
        installationId,
        targetRepo: repo,
        issueNumber,
        issueTitle: payload.issue.title,
        baseBranch: payload.repository.default_branch || DEFAULTS.baseBranch,
        installCmd: DEFAULTS.installCmd,
        testCmd: DEFAULTS.testCmd,
      });

      console.log(`dispatched build for ${repo}#${issueNumber} (${owner})`);
    } catch (error) {
      console.error(`dispatch failed for ${repo}#${issueNumber}`, error);
    }
  });

  return Response.json({ ok: true, queued: `${repo}#${issueNumber}` });
}

async function comment(
  repo: string,
  issueNumber: number,
  token: string,
  body: string,
): Promise<void> {
  await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "machinai",
    },
    body: JSON.stringify({ body }),
  });
}

async function setLabels(
  repo: string,
  issueNumber: number,
  token: string,
  opts: { add?: string[]; remove?: string[] },
): Promise<void> {
  const base = `https://api.github.com/repos/${repo}/issues/${issueNumber}/labels`;
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
    "user-agent": "machinai",
  };

  for (const label of opts.remove ?? []) {
    await fetch(`${base}/${encodeURIComponent(label)}`, {
      method: "DELETE",
      headers,
    }).catch(() => {});
  }
  if (opts.add?.length) {
    await fetch(base, {
      method: "POST",
      headers,
      body: JSON.stringify({ labels: opts.add }),
    }).catch(() => {});
  }
}
