import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/machinai/shell";
import { Empty, Mono, Section, StoryRow } from "@/components/machinai/pieces";
import { SignInPrompt } from "@/components/machinai/sign-in";
import { listEpics, listStories, projectRef, type Epic } from "@/lib/github-data";
import { EpicList } from "@/components/machinai/epic-list";
import { currentSession } from "@/lib/session";
import type { Story, StoryState } from "@/lib/types";

// Always live: a backlog that disagrees with GitHub is worse than a slow page.
export const dynamic = "force-dynamic";

/**
 * Grouped by what you can do about it, not by raw label. "Needs you" first,
 * because it is the only group that costs you attention.
 */
const GROUPS: { key: string; title: string; hint: string; states: StoryState[] }[] =
  [
    {
      key: "needs-you",
      title: "Needs you",
      hint: "Review finished work, or unblock something stuck",
      states: ["in-review", "stuck", "revise"],
    },
    {
      key: "working",
      title: "In progress",
      hint: "machinai is working on these right now",
      states: ["in-progress"],
    },
    {
      key: "queue",
      title: "Ready to start",
      hint: "Approved, waiting to start",
      states: ["ready"],
    },
    {
      key: "waiting",
      title: "Waiting",
      hint: "Waiting on other work, or not approved yet",
      states: ["blocked", "draft"],
    },
    { key: "done", title: "Done", hint: "Built and merged", states: ["done"] },
  ];

export default async function BacklogPage() {
  const session = await currentSession();
  if (!session) return <SignInPrompt />;

  const ref = projectRef();
  let stories: Story[] = [];
  let epics: Epic[] = [];
  let error: string | null = null;
  try {
    [stories, epics] = await Promise.all([listStories(ref), listEpics(ref)]);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const groups = GROUPS.map((g) => ({
    ...g,
    items: stories.filter((s) => g.states.includes(s.state)),
  })).filter((g) => g.items.length > 0);

  return (
    <Page
      title="Work"
      lead={`Every story is an issue in ${ref.owner}/${ref.repo}. Labels are the state machine, so nothing here can drift from what GitHub says.`}
    >
      {error ? (
        <Empty title="Could not read your work" body={error} />
      ) : stories.length === 0 ? (
        <Empty
          title="Nothing to build yet"
          body="Describe what you want and machinai will break it into tasks."
          action={
            <Button size="sm" asChild>
              <Link href="/">Describe it</Link>
            </Button>
          }
        />
      ) : (
        <>
          {epics.length > 0 && (
            <Section
              title="Features"
              aside={
                <Mono className="text-muted-foreground">{epics.length}</Mono>
              }
            >
              <p className="-mt-1 mb-3 text-xs text-muted-foreground">
                Each one takes several tasks to finish
              </p>
              <EpicList epics={epics} stories={stories} />
            </Section>
          )}

          {groups.map((g) => (
          <Section
            key={g.key}
            title={g.title}
            aside={<Mono className="text-muted-foreground">{g.items.length}</Mono>}
          >
            <p className="-mt-1 mb-3 text-xs text-muted-foreground">{g.hint}</p>
            <ul className="space-y-2">
              {g.items.map((s) => (
                <li key={s.number}>
                  <StoryRow story={s} />
                </li>
              ))}
            </ul>
          </Section>
          ))}
        </>
      )}
    </Page>
  );
}
