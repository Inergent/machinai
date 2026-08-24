import Link from "next/link";
import { notFound } from "next/navigation";
import { GitPullRequest, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/machinai/shell";
import {
  CommitList,
  LogTail,
  Mono,
  Panel,
  Section,
  TestSummary,
} from "@/components/machinai/pieces";
import { RunBadge } from "@/components/machinai/state";
import { RunTimeline } from "@/components/machinai/run-timeline";
import { duration, since } from "@/lib/format";
import { NOW, runById, runs } from "@/lib/fixtures/data";

export function generateStaticParams() {
  return runs.map((r) => ({ id: r.id }));
}

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const run = runById(id);
  if (!run) notFound();

  const live = run.state === "running";
  const budgetPct = Math.min(
    100,
    Math.round((run.elapsedMs / run.sandbox.timeoutMs) * 100),
  );

  return (
    <Page
      title={run.storyTitle}
      lead={run.note}
      back={{ href: "/runs", label: "Runs" }}
      actions={
        live ? (
          <Button size="sm" variant="outline">
            <Square className="size-4" />
            Stop
          </Button>
        ) : run.prNumber ? (
          <Button size="sm" asChild>
            <Link href={`/review/${run.prNumber}`}>
              <GitPullRequest className="size-4" />
              Review PR
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <RunBadge state={run.state} />
        <Link
          href={`/backlog/${run.storyNumber}`}
          className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          #{run.storyNumber}
        </Link>
        <Mono className="text-muted-foreground">{run.branch}</Mono>
        <Mono className="text-muted-foreground">
          attempt {run.attempt}/{run.maxAttempts}
        </Mono>
        <span className="text-xs text-muted-foreground">
          started {since(run.startedAt, NOW)}
        </span>
      </div>

      <Section title="Progress">
        <Panel className="p-5">
          <RunTimeline steps={run.steps} />
        </Panel>
      </Section>

      <Section
        title="Sandbox budget"
        aside={
          <Mono className="text-muted-foreground">
            {duration(run.elapsedMs)} / {duration(run.sandbox.timeoutMs)}
          </Mono>
        }
      >
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full ${
              budgetPct >= 90 ? "bg-state-review" : "bg-state-running"
            }`}
            style={{ width: `${Math.max(budgetPct, 1.5)}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          {run.sandbox.vcpus} vCPU · {run.sandbox.memoryGb} GB ·{" "}
          {run.sandbox.region}. Vercel Hobby caps a session at 45 minutes, so
          machinai stops at 40 and commits what it has — the next attempt resumes
          on the same branch.
        </p>
      </Section>

      <Section
        title="Log"
        aside={
          live ? (
            <Mono className="text-state-running">live</Mono>
          ) : (
            <Mono className="text-muted-foreground">last {run.logTail.length}</Mono>
          )
        }
      >
        <LogTail lines={run.logTail} />
      </Section>

      {run.tests && (
        <Section title="Tests">
          <TestSummary tests={run.tests} />
        </Section>
      )}

      <Section
        title="Commits"
        aside={<Mono className="text-muted-foreground">{run.commits.length}</Mono>}
      >
        <CommitList commits={run.commits} />
      </Section>
    </Page>
  );
}
