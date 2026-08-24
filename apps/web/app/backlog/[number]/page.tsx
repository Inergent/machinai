import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, GitPullRequest, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/machinai/shell";
import { Mono, Panel, Section } from "@/components/machinai/pieces";
import { StoryBadge } from "@/components/machinai/state";
import { SignInPrompt } from "@/components/machinai/sign-in";
import { BuildButton } from "@/components/machinai/build-button";
import { since } from "@/lib/format";
import {
  getStory,
  openPullRequestFor,
  projectRef,
  storyCheckpoints,
} from "@/lib/github-data";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: PageProps<"/backlog/[number]">) {
  const session = await currentSession();
  if (!session) return <SignInPrompt />;

  const { number } = await params;
  const ref = projectRef();
  const story = await getStory(ref, Number(number));
  if (!story) notFound();

  const now = new Date();
  const checkpoints = await storyCheckpoints(ref, story.number).catch(() => []);
  const pr = await openPullRequestFor(ref, story.number);
  const buildable =
    story.state === "draft" ||
    story.state === "ready" ||
    story.state === "blocked" ||
    story.state === "stuck";

  return (
    <Page
      title={story.title}
      lead={story.body}
      back={{ href: "/backlog", label: "Backlog" }}
      actions={
        pr ? (
          <Button size="sm" asChild>
            <Link href={`/review/${pr}`}>
              <GitPullRequest className="size-4" />
              Review
            </Link>
          </Button>
        ) : buildable ? (
          <BuildButton issueNumber={story.number} />
        ) : null
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <StoryBadge state={story.state} />
        <Mono className="text-muted-foreground">#{story.number}</Mono>
        {story.attempts > 0 && (
          <Mono className="text-muted-foreground">
            attempt {story.attempts}/{story.maxAttempts}
          </Mono>
        )}
        <span className="text-xs text-muted-foreground">
          updated {since(story.updatedAt, now)}
        </span>
        <a
          href={`https://github.com/${ref.owner}/${ref.repo}/issues/${story.number}`}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          on GitHub
        </a>
      </div>

      {story.blockedBy.length > 0 && (
        <Section title="Blocked by">
          <ul className="space-y-2">
            {story.blockedBy.map((n) => (
              <li key={n}>
                <Link
                  href={`/backlog/${n}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors duration-150 hover:border-foreground/15"
                >
                  <Lock className="size-3.5 text-muted-foreground" />
                  <Mono className="text-muted-foreground">#{n}</Mono>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            machinai green-lights this automatically once every blocker closes.
          </p>
        </Section>
      )}

      {story.acceptanceCriteria.length > 0 && (
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
      )}

      {checkpoints.length > 0 && (
        <Section
          title="What the agent reported"
          aside={
            <Mono className="text-muted-foreground">{checkpoints.length}</Mono>
          }
        >
          <div className="space-y-2.5">
            {checkpoints
              .slice()
              .reverse()
              .map((c) => (
                <Panel
                  key={c.createdAt}
                  className="whitespace-pre-wrap px-4 py-3.5 text-sm leading-relaxed text-foreground/85"
                >
                  {c.body}
                </Panel>
              ))}
          </div>
        </Section>
      )}
    </Page>
  );
}
