import { cn } from "@/lib/utils";
import type { RunState, StoryState } from "@/lib/fixtures/types";

/**
 * The whole app's colour vocabulary lives here. Five states, five tokens.
 * Nothing else in the UI is allowed to introduce a colour.
 */
type Tone = "running" | "done" | "review" | "blocked" | "idle";

const TONE_DOT: Record<Tone, string> = {
  running: "bg-state-running",
  done: "bg-state-done",
  review: "bg-state-review",
  blocked: "bg-state-blocked",
  idle: "bg-state-idle",
};

const TONE_TEXT: Record<Tone, string> = {
  running: "text-state-running",
  done: "text-state-done",
  review: "text-state-review",
  blocked: "text-state-blocked",
  idle: "text-muted-foreground",
};

export const STORY_TONE: Record<StoryState, Tone> = {
  draft: "idle",
  ready: "running",
  "in-progress": "running",
  "in-review": "review",
  revise: "review",
  blocked: "idle",
  stuck: "blocked",
  done: "done",
};

export const STORY_LABEL: Record<StoryState, string> = {
  draft: "Draft",
  ready: "Ready",
  "in-progress": "Building",
  "in-review": "Needs review",
  revise: "Revising",
  blocked: "Blocked",
  stuck: "Stuck",
  done: "Done",
};

export const RUN_TONE: Record<RunState, Tone> = {
  queued: "idle",
  running: "running",
  succeeded: "done",
  failed: "blocked",
  checkpointed: "review",
  stuck: "blocked",
};

export const RUN_LABEL: Record<RunState, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  checkpointed: "Checkpointed",
  stuck: "Stuck",
};

/**
 * The signature element: a dot that pulses only while work is genuinely
 * happening. Motion here means "this is live", so it is never decorative.
 */
export function StatusDot({
  tone,
  live = false,
  className,
}: {
  tone: Tone;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex size-2 shrink-0", className)}
      aria-hidden="true"
    >
      {live && (
        <span
          className={cn(
            "absolute inset-0 rounded-full animate-state-halo",
            TONE_DOT[tone],
          )}
        />
      )}
      <span
        className={cn(
          "relative size-2 rounded-full",
          TONE_DOT[tone],
          live && "animate-state-pulse",
        )}
      />
    </span>
  );
}

export function StateBadge({
  tone,
  label,
  live = false,
  className,
}: {
  tone: Tone;
  label: string;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        "bg-secondary",
        TONE_TEXT[tone],
        className,
      )}
    >
      <StatusDot tone={tone} live={live} />
      {label}
    </span>
  );
}

export function StoryBadge({ state }: { state: StoryState }) {
  return (
    <StateBadge
      tone={STORY_TONE[state]}
      label={STORY_LABEL[state]}
      live={state === "in-progress"}
    />
  );
}

export function RunBadge({ state }: { state: RunState }) {
  return (
    <StateBadge
      tone={RUN_TONE[state]}
      label={RUN_LABEL[state]}
      live={state === "running"}
    />
  );
}

export type { Tone };
