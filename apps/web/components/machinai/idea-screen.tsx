"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Page } from "./shell";
import { Empty, Mono, Panel, Section } from "./pieces";
import { draftPrd, draftStories } from "@/lib/fixtures/data";
import type { DraftStory } from "@/lib/fixtures/types";
import { cn } from "@/lib/utils";

type Phase = "idle" | "thinking" | "prd" | "stories" | "ready";

const EXAMPLE =
  "A habit tracker where one missed day doesn't wipe your streak, and a single accountability partner can see how you're doing.";

/**
 * Phase 1 fakes the planner stream on a timer. Phase 3 replaces `advance()`
 * with a real dispatch and swaps these setTimeouts for the job's progress —
 * the rendering below does not change.
 */
export function IdeaScreen() {
  const [idea, setIdea] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [prdChars, setPrdChars] = useState(0);
  const [shown, setShown] = useState(0);
  const [drafts, setDrafts] = useState<DraftStory[]>(draftStories);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const at = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  function plan() {
    if (!idea.trim()) return;
    setDrafts(draftStories);
    setPrdChars(0);
    setShown(0);
    setPhase("thinking");

    at(900, () => {
      setPhase("prd");
      // Type the PRD out rather than popping it in — it reads as work happening.
      let i = 0;
      const tick = () => {
        i += 7;
        setPrdChars(i);
        if (i < draftPrd.length) timers.current.push(setTimeout(tick, 16));
        else {
          setPhase("stories");
          draftStories.forEach((_, n) =>
            at(260 * (n + 1), () => setShown(n + 1)),
          );
          at(260 * draftStories.length + 400, () => setPhase("ready"));
        }
      };
      tick();
    });
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("idle");
    setIdea("");
    setPrdChars(0);
    setShown(0);
  }

  const busy = phase === "thinking" || phase === "prd" || phase === "stories";
  const visible = drafts.slice(0, phase === "idle" ? 0 : shown);

  return (
    <Page
      title="Describe it"
      lead="One or two sentences is enough. machinai writes the stories, works out what blocks what, and files them as issues."
      actions={
        phase !== "idle" && (
          <Button variant="ghost" size="sm" onClick={reset}>
            Start over
          </Button>
        )
      }
    >
      {phase === "idle" && (
        <>
          <Panel className="p-1.5">
            <Textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder={EXAMPLE}
              rows={4}
              className="resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0 md:text-sm"
            />
            <div className="flex items-center justify-between gap-3 px-2.5 pb-2 pt-1">
              <button
                type="button"
                onClick={() => setIdea(EXAMPLE)}
                className="text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
              >
                Use an example
              </button>
              <Button size="sm" onClick={plan} disabled={!idea.trim()}>
                Plan it
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </Panel>

          <Section title="How it goes">
            <ol className="grid gap-3 sm:grid-cols-3">
              {[
                ["Describe", "You write the idea. Two sentences."],
                ["Approve", "Edit the stories, then file them as issues."],
                ["Walk away", "Agents build. You review from your phone."],
              ].map(([t, d], i) => (
                <li key={t} className="rounded-xl border border-border bg-card p-4">
                  <Mono className="text-muted-foreground">0{i + 1}</Mono>
                  <p className="mt-2 text-sm font-medium">{t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{d}</p>
                </li>
              ))}
            </ol>
          </Section>
        </>
      )}

      {phase !== "idle" && (
        <>
          <Panel className="px-4 py-3.5">
            <p className="text-sm text-muted-foreground">{idea}</p>
          </Panel>

          <Section
            title="Product brief"
            aside={
              busy && phase !== "thinking" ? (
                <Mono className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  writing
                </Mono>
              ) : null
            }
          >
            {phase === "thinking" ? (
              <div className="space-y-2.5">
                {[100, 82, 91].map((w, i) => (
                  <div
                    key={i}
                    className="h-3.5 animate-pulse rounded bg-secondary"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            ) : (
              <Brief
                text={draftPrd.slice(0, prdChars)}
                caret={phase === "prd"}
              />
            )}
          </Section>

          {visible.length > 0 && (
            <Section
              title="Proposed stories"
              aside={
                <Mono className="text-muted-foreground">
                  {visible.length} of {draftStories.length}
                </Mono>
              }
            >
              <ul className="space-y-2.5">
                {visible.map((s, i) => (
                  <DraftCard
                    key={s.tempId}
                    story={s}
                    index={i}
                    all={drafts}
                    onRemove={() =>
                      setDrafts((d) => d.filter((x) => x.tempId !== s.tempId))
                    }
                  />
                ))}
              </ul>
            </Section>
          )}

          {phase === "ready" && (
            <div className="sticky bottom-24 mt-8 md:bottom-6">
              <Panel className="flex flex-wrap items-center justify-between gap-3 p-3 shadow-lg shadow-black/5">
                <p className="pl-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {drafts.length} stories
                  </span>{" "}
                  ready to file to{" "}
                  <Mono className="text-foreground">Inergent/orbital</Mono>
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <X className="size-4" />
                    Discard
                  </Button>
                  <Button size="sm">
                    <Check className="size-4" />
                    File as issues
                  </Button>
                </div>
              </Panel>
            </div>
          )}

          {phase === "ready" && drafts.length === 0 && (
            <Empty
              title="Every story removed"
              body="Nothing left to file. Start over with a different description."
              action={
                <Button size="sm" variant="outline" onClick={reset}>
                  Start over
                </Button>
              }
            />
          )}
        </>
      )}
    </Page>
  );
}


/**
 * The planner emits markdown, so the brief renders it — just paragraphs and
 * bold, which is all a PRD needs. Anything richer would be a library we do not
 * need yet.
 */
function Brief({ text, caret }: { text: string; caret: boolean }) {
  const paragraphs = text.split("\n\n");
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/85">
      {paragraphs.map((para, pi) => (
        <p key={pi}>
          {para.split(/(\*\*[^*]+\*\*)/g).map((chunk, ci) =>
            chunk.startsWith("**") && chunk.endsWith("**") ? (
              <strong key={ci} className="font-medium text-foreground">
                {chunk.slice(2, -2)}
              </strong>
            ) : (
              <span key={ci}>{chunk}</span>
            ),
          )}
          {caret && pi === paragraphs.length - 1 && (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-primary animate-state-pulse" />
          )}
        </p>
      ))}
    </div>
  );
}

function DraftCard({
  story,
  index,
  all,
  onRemove,
}: {
  story: DraftStory;
  index: number;
  all: DraftStory[];
  onRemove: () => void;
}) {
  const blockers = story.blockedBy
    .map((id) => all.find((s) => s.tempId === id)?.title)
    .filter(Boolean) as string[];

  return (
    <li
      className="group rounded-xl border border-border bg-card p-4"
      style={{ animation: "machinai-rise 260ms cubic-bezier(0.22,1,0.36,1) both" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Mono className="text-muted-foreground">{story.epicTitle}</Mono>
          <p className="mt-1 text-sm font-medium">{story.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Mono
            className={cn(
              "rounded px-1.5 py-0.5",
              story.size === "L"
                ? "bg-state-review/15 text-state-review"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {story.size}
          </Mono>
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${story.title}`}
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-state-blocked focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{story.body}</p>

      <ul className="mt-3 space-y-1">
        {story.acceptanceCriteria.map((c) => (
          <li key={c} className="flex gap-2 text-xs text-muted-foreground">
            <Check className="mt-0.5 size-3 shrink-0 text-state-done" />
            {c}
          </li>
        ))}
      </ul>

      {blockers.length > 0 && (
        <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
          Waits for <span className="text-foreground/80">{blockers.join(", ")}</span>
        </p>
      )}

      <span className="sr-only">Story {index + 1}</span>
    </li>
  );
}
