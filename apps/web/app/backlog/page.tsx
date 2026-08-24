import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/machinai/shell";
import { Empty, Mono, Section, StoryRow } from "@/components/machinai/pieces";
import { stories } from "@/lib/fixtures/data";
import type { Story, StoryState } from "@/lib/fixtures/types";

/**
 * Grouped by what you can do about it, not by raw label. "Needs you" first,
 * because that is the only group that costs you attention.
 */
const GROUPS: { key: string; title: string; hint: string; states: StoryState[] }[] =
  [
    {
      key: "needs-you",
      title: "Needs you",
      hint: "Review a PR or unblock a stuck story",
      states: ["in-review", "stuck", "revise"],
    },
    {
      key: "working",
      title: "Working",
      hint: "Agents are on these right now",
      states: ["in-progress"],
    },
    {
      key: "queue",
      title: "Ready to build",
      hint: "Green-lit and waiting for a slot",
      states: ["ready"],
    },
    {
      key: "waiting",
      title: "Waiting",
      hint: "Blocked by another story, or not green-lit yet",
      states: ["blocked", "draft"],
    },
    { key: "done", title: "Done", hint: "Merged", states: ["done"] },
  ];

export default function BacklogPage() {
  const groups = GROUPS.map((g) => ({
    ...g,
    items: stories.filter((s) => g.states.includes(s.state)),
  })).filter((g) => g.items.length > 0);

  const ready = stories.filter((s) => s.state === "ready");

  return (
    <Page
      title="Backlog"
      lead="Every story is a GitHub issue. Labels are the state machine, so nothing here can drift from what GitHub says."
      actions={
        ready.length > 0 ? (
          <Button size="sm" asChild>
            <Link href={`/backlog/${ready[0].number}`}>
              Build {ready.length === 1 ? "next" : `${ready.length} ready`}
            </Link>
          </Button>
        ) : null
      }
    >
      {stories.length === 0 ? (
        <Empty
          title="Nothing in the backlog"
          body="Describe what you want built and machinai will write the stories."
          action={
            <Button size="sm" asChild>
              <Link href="/">Describe it</Link>
            </Button>
          }
        />
      ) : (
        groups.map((g) => (
          <Section
            key={g.key}
            title={g.title}
            aside={<Mono className="text-muted-foreground">{g.items.length}</Mono>}
          >
            <p className="-mt-1 mb-3 text-xs text-muted-foreground">{g.hint}</p>
            <ul className="space-y-2">
              {g.items.map((s: Story) => (
                <li key={s.number}>
                  <StoryRow story={s} />
                </li>
              ))}
            </ul>
          </Section>
        ))
      )}
    </Page>
  );
}
