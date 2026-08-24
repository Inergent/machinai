import { installationToken, loadAppConfig } from "@/lib/github-app";
import { projectRef } from "@/lib/github-data";
import { currentSession } from "@/lib/session";

/**
 * Green-light a story from the UI.
 *
 * Applies the label rather than dispatching a build directly, so there is
 * exactly one path into a run and GitHub stays the source of truth for what is
 * queued. It also means this endpoint needs no dispatch credential.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return new Response("Not signed in", { status: 401 });

  let issueNumber: unknown;
  try {
    ({ issueNumber } = (await request.json()) as { issueNumber?: unknown });
  } catch {
    return new Response("Expected a JSON body", { status: 400 });
  }
  if (!Number.isInteger(issueNumber)) {
    return new Response("issueNumber must be an integer", { status: 400 });
  }

  const ref = projectRef();
  const { token } = await installationToken(ref.installationId, loadAppConfig(), [
    ref.repo,
  ]);

  const res = await fetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/issues/${issueNumber}/labels`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "machinai",
      },
      body: JSON.stringify({ labels: ["machinai:ready"] }),
    },
  );

  if (!res.ok) {
    return new Response(`GitHub refused the label: ${await res.text()}`, {
      status: 502,
    });
  }
  return Response.json({ ok: true });
}
