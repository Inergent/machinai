import Link from "next/link";
import { notFound } from "next/navigation";
import { GitPullRequest } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/machinai/shell";
import { Mono, Panel, Section } from "@/components/machinai/pieces";
import { RunBadge } from "@/components/machinai/state";
import { RunTimeline } from "@/components/machinai/run-timeline";
import { SignInPrompt } from "@/components/machinai/sign-in";
import { duration, since } from "@/lib/format";
import {
  getRun,
  openPullRequestFor,
  projectRef,
  storyCheckpoints,
} from "@/lib/github-data";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const session = await currentSession();
  if (!session) return <SignInPrompt />;

  const { id } = await params;
  const ref = projectRef();
  const run = await getRun(ref, id);
  if (!run) notFound();

  const now = new Date();
  const budgetPct = Math.min(
    100,
    Math.round((run.elapsedMs / run.sandbox.timeoutMs) * 100),
  );

  // The agent's own account of the run. Actions can see the job, not what
  // happened inside the sandbox — the checkpoint is where that lives.
  const checkpoints = run.storyNumber
    ? await storyCheckpoints(ref, run.storyNumber).catch(() => [])
    : [];
  const latest = checkpoints.at(-1);
  const pr = run.storyNumber ? await openPullRequestFor(ref, run.storyNumber) : null;

  return (
    <Page
      title={run.storyTitle}
      back={{ href: "/runs", label: "Builds" }}
      actions={
        pr ? (
          <Button size="sm" asChild>
            <Link href={`/review/${pr}`}>
              <GitPullRequest className="size-4" />
              Review PR
            </Link>
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <RunBadge state={run.state} />
        {run.storyNumber > 0 && (
          <Link
            href={`/backlog/${run.storyNumber}`}
            className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            #{run.storyNumber}
          </Link>
        )}
        {run.branch && <Mono className="text-muted-foreground">{run.branch}</Mono>}
        <span className="text-xs text-muted-foreground">
          started {since(run.startedAt, now)}
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
            className={`h-full rounded-full ${budgetPct >= 90 ? "bg-state-review" : "bg-state-running"}`}
            style={{ width: `${Math.max(budgetPct, 1.5)}%` }}
          />
        </div>
        <p className="mt-2.5 text-xs text-muted-foreground">
          Vercel Hobby caps a session at 45 minutes, so machinai stops at 40 and
          commits what it has — the next attempt resumes on the same branch.
        </p>
      </Section>

      <Section
        title="Progress notes"
        aside={
          checkpoints.length > 1 ? (
            <Mono className="text-muted-foreground">
              attempt {checkpoints.length}
            </Mono>
          ) : null
        }
      >
        {latest ? (
          <Panel className="whitespace-pre-wrap px-4 py-3.5 text-sm leading-relaxed text-foreground/85">
            {latest.body}
          </Panel>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No progress notes yet.
          </p>
        )}
      </Section>
    </Page>
  );
}
