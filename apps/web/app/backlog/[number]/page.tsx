import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, GitPullRequest, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/machinai/shell";
import { Mono, Panel, Section } from "@/components/machinai/pieces";
import { RunBadge, StoryBadge } from "@/components/machinai/state";
import { duration, since } from "@/lib/format";
import {
  NOW,
  epicByNumber,
  runsForStory,
  stories,
  storyByNumber,
} from "@/lib/fixtures/data";

export function generateStaticParams() {
  return stories.map((s) => ({ number: String(s.number) }));
}

export default async function StoryPage({
  params,
}: PageProps<"/backlog/[number]">) {
  const { number } = await params;
  const story = storyByNumber(Number(number));
  if (!story) notFound();

  const epic = epicByNumber(story.epic);
  const history = runsForStory(story.number);
  const blockers = story.blockedBy
    .map((n) => storyByNumber(n))
    .filter(Boolean) as NonNullable<ReturnType<typeof storyByNumber>>[];

  const canBuild = story.state === "ready" || story.state === "draft";
  const building = story.state === "in-progress";

  return (
    <Page
      title={story.title}
      lead={story.body}
      back={{ href: "/backlog", label: "Backlog" }}
      actions={
        <div className="flex items-center gap-2">
          {building ? (
            <Button size="sm" variant="outline">
              <Square className="size-4" />
              Stop
            </Button>
          ) : canBuild ? (
            <Button size="sm">
              <Play className="size-4" />
              Build
            </Button>
          ) : story.prNumber ? (
            <Button size="sm" asChild>
              <Link href={`/review/${story.prNumber}`}>
                <GitPullRequest className="size-4" />
                Review
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StoryBadge state={story.state} />
        <Mono className="text-muted-foreground">#{story.number}</Mono>
        {epic && (
          <Mono className="text-muted-foreground">{epic.title}</Mono>
        )}
        <Mono className="text-muted-foreground">size {story.size}</Mono>
        <span className="text-xs text-muted-foreground">
          updated {since(story.updatedAt, NOW)}
        </span>
      </div>

      {story.state === "stuck" && (
        <Panel className="mt-6 border-state-blocked/30 px-4 py-3.5">
          <p className="text-sm font-medium text-state-blocked">
            Stopped after {story.attempts} attempts
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            machinai will not spend another run until something changes. Leave
            feedback on the issue, or edit the acceptance criteria and re-green-light
            it.
          </p>
        </Panel>
      )}

      {blockers.length > 0 && (
        <Section title="Blocked by">
          <ul className="space-y-2">
            {blockers.map((b) => (
              <li key={b.number}>
                <Link
                  href={`/backlog/${b.number}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-150 hover:border-foreground/15"
                >
                  <Mono className="w-9 shrink-0 text-muted-foreground">
                    #{b.number}
                  </Mono>
                  <span className="min-w-0 flex-1 text-sm">{b.title}</span>
                  <StoryBadge state={b.state} />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            machinai green-lights this automatically once every blocker closes.
          </p>
        </Section>
      )}

      <Section title="Acceptance criteria">
        <ul className="space-y-2">
          {story.acceptanceCriteria.map((c) => (
            <li key={c} className="flex gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-state-done" />
              <span className="text-foreground/85">{c}</span>
            </li>
          ))}
        </ul>
      </Section>

      {history.length > 0 && (
        <Section title="Runs">
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/runs/${r.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-150 hover:border-foreground/15"
                >
                  <RunBadge state={r.state} />
                  <Mono className="text-muted-foreground">
                    attempt {r.attempt}/{r.maxAttempts}
                  </Mono>
                  <Mono className="text-muted-foreground">
                    {duration(r.elapsedMs)}
                  </Mono>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {since(r.startedAt, NOW)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  );
}
