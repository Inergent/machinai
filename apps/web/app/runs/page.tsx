import Link from "next/link";
import { Page } from "@/components/machinai/shell";
import { Empty, Mono, Section } from "@/components/machinai/pieces";
import { RunBadge } from "@/components/machinai/state";
import { duration, since } from "@/lib/format";
import { NOW, runs } from "@/lib/fixtures/data";

export default function RunsPage() {
  const live = runs.filter((r) => r.state === "running" || r.state === "queued");
  const past = runs.filter((r) => r.state !== "running" && r.state !== "queued");

  if (runs.length === 0) {
    return (
      <Page title="Runs" lead="Every build attempt, newest first.">
        <Empty
          title="No runs yet"
          body="Green-light a story and the first run shows up here."
        />
      </Page>
    );
  }

  return (
    <Page title="Runs" lead="Every build attempt, newest first.">
      {live.length > 0 && (
        <Section title="Live">
          <ul className="space-y-2">
            {live.map((r) => (
              <li key={r.id}>
                <RunRow run={r} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Finished">
        <ul className="space-y-2">
          {past.map((r) => (
            <li key={r.id}>
              <RunRow run={r} />
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}

function RunRow({ run }: { run: (typeof runs)[number] }) {
  return (
    <Link
      href={`/runs/${run.id}`}
      className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors duration-150 hover:border-foreground/15"
    >
      <Mono className="mt-0.5 w-9 shrink-0 text-muted-foreground">
        #{run.storyNumber}
      </Mono>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{run.storyTitle}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Mono>attempt {run.attempt}/{run.maxAttempts}</Mono>
          <Mono>{duration(run.elapsedMs)}</Mono>
          <span>{since(run.startedAt, NOW)}</span>
        </div>
      </div>
      <div className="shrink-0">
        <RunBadge state={run.state} />
      </div>
    </Link>
  );
}
