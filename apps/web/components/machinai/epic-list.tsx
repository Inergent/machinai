import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Epic } from "@/lib/github-data";
import type { Story } from "@/lib/types";
import { Mono } from "./pieces";
import { StatusDot } from "./state";

/**
 * Features, and how far through each one is.
 *
 * The state-grouped list below answers "what needs me right now". This answers
 * the other question — "is the thing I asked for actually getting built" — which
 * a flat backlog cannot, because a feature is only ever visible as the six
 * unrelated-looking stories it was cut into.
 */
export function EpicList({
  epics,
  stories,
}: {
  epics: Epic[];
  stories: Story[];
}) {
  const byNumber = new Map(stories.map((s) => [s.number, s]));

  return (
    <ul className="space-y-2">
      {epics.map((epic) => {
        const members = epic.storyNumbers
          .map((n) => byNumber.get(n))
          .filter((s): s is Story => Boolean(s));

        const done = members.filter((s) => s.state === "done").length;
        const total = members.length || epic.total;
        const building = members.some((s) => s.state === "in-progress");
        const needsYou = members.some(
          (s) => s.state === "in-review" || s.state === "stuck",
        );
        const percent = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <li key={epic.number}>
            <Link
              href={`/backlog/${epic.number}`}
              className="block rounded-xl border border-border bg-card px-4 py-3.5 transition-colors duration-150 hover:border-foreground/15"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{epic.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <Mono>#{epic.number}</Mono>
                    <span>
                      {done} of {total} done
                    </span>
                    {building && (
                      <span className="inline-flex items-center gap-1.5 text-state-running">
                        <StatusDot tone="running" live />
                        building
                      </span>
                    )}
                    {needsYou && !building && (
                      <span className="inline-flex items-center gap-1.5 text-state-review">
                        <StatusDot tone="review" />
                        needs you
                      </span>
                    )}
                  </div>
                </div>
                <Mono
                  className={cn(
                    "mt-0.5 shrink-0",
                    percent === 100 ? "text-state-done" : "text-muted-foreground",
                  )}
                >
                  {percent}%
                </Mono>
              </div>

              <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    percent === 100 ? "bg-state-done" : "bg-state-running",
                  )}
                  style={{ width: `${Math.max(percent, 1.5)}%` }}
                />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
