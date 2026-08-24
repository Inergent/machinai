import Link from "next/link";
import { Page } from "@/components/machinai/shell";
import { Empty, Mono, Section } from "@/components/machinai/pieces";
import { RunBadge } from "@/components/machinai/state";
import { SignInPrompt } from "@/components/machinai/sign-in";
import { duration, since } from "@/lib/format";
import { listRuns, projectRef } from "@/lib/github-data";
import { currentSession } from "@/lib/session";
import type { Run } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const session = await currentSession();
  if (!session) return <SignInPrompt />;

  const now = new Date();
  let runs: Run[] = [];
  let error: string | null = null;
  try {
    runs = await listRuns(projectRef());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const live = runs.filter((r) => r.state === "running" || r.state === "queued");
  const past = runs.filter((r) => r.state !== "running" && r.state !== "queued");

  return (
    <Page title="Runs" lead="Every build attempt, newest first.">
      {error ? (
        <Empty title="Could not read runs" body={error} />
      ) : runs.length === 0 ? (
        <Empty
          title="No runs yet"
          body="Green-light a story and the first run shows up here."
        />
      ) : (
        <>
          {live.length > 0 && (
            <Section title="Live">
              <ul className="space-y-2">
                {live.map((r) => (
                  <li key={r.id}>
                    <RunRow run={r} now={now} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Finished">
            <ul className="space-y-2">
              {past.map((r) => (
                <li key={r.id}>
                  <RunRow run={r} now={now} />
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </Page>
  );
}

function RunRow({ run, now }: { run: Run; now: Date }) {
  return (
    <Link
      href={`/runs/${run.id}`}
      className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors duration-150 hover:border-foreground/15"
    >
      <Mono className="mt-0.5 w-9 shrink-0 text-muted-foreground">
        {run.storyNumber ? `#${run.storyNumber}` : "—"}
      </Mono>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{run.storyTitle}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Mono>{duration(run.elapsedMs)}</Mono>
          <span>{since(run.startedAt, now)}</span>
        </div>
      </div>
      <div className="shrink-0">
        <RunBadge state={run.state} />
      </div>
    </Link>
  );
}
