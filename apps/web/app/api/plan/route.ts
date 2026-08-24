import { dispatchCredential } from "@/lib/github-app";
import { projectRef } from "@/lib/github-data";
import { currentSession } from "@/lib/session";

/**
 * Kick off a decomposition.
 *
 * Fires the planning workflow and returns immediately — the run takes a couple
 * of minutes and the result appears as filed issues, so there is nothing useful
 * to wait for.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return new Response("Not signed in", { status: 401 });

  let idea: unknown;
  try {
    ({ idea } = (await request.json()) as { idea?: unknown });
  } catch {
    return new Response("Expected a JSON body", { status: 400 });
  }
  if (typeof idea !== "string" || idea.trim().length < 10) {
    return new Response(
      "Describe the idea in a sentence or two — ten characters is not enough to plan from.",
      { status: 400 },
    );
  }
  if (idea.length > 4000) {
    return new Response("That idea is too long; trim it to the essentials.", {
      status: 400,
    });
  }

  const ref = projectRef();
  const orchestrator =
    process.env.MACHINAI_ORCHESTRATOR_REPO ?? "Inergent/machinai";

  let token: string;
  try {
    token = await dispatchCredential();
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : String(error),
      { status: 503 },
    );
  }

  const res = await fetch(
    `https://api.github.com/repos/${orchestrator}/actions/workflows/plan.yml/dispatches`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
        "user-agent": "machinai",
      },
      body: JSON.stringify({
        ref: process.env.MACHINAI_ORCHESTRATOR_REF ?? "main",
        inputs: {
          repo: `${ref.owner}/${ref.repo}`,
          idea: idea.trim(),
          dry_run: "false",
        },
      }),
    },
  );

  if (!res.ok) {
    return new Response(`Could not start planning: ${await res.text()}`, {
      status: 502,
    });
  }
  return Response.json({ ok: true });
}
