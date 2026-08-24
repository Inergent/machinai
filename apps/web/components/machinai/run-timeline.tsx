import { Check, Minus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { duration } from "@/lib/format";
import type { RunStep } from "@/lib/fixtures/types";

/**
 * The screen you stare at from the beach. A vertical stepper where exactly one
 * node can be live, and the live node is the only thing on the page that moves.
 */
export function RunTimeline({ steps }: { steps: RunStep[] }) {
  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        const { state } = step;
        const muted = state === "pending" || state === "skipped";

        return (
          <li key={step.id} className="relative flex gap-3.5 pb-6 last:pb-0">
            {/* connector */}
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[11px] top-6 bottom-0 w-px",
                  state === "done" ? "bg-state-done/35" : "bg-border",
                )}
              />
            )}

            <StepNode state={state} />

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p
                  className={cn(
                    "text-sm",
                    state === "active" && "font-medium text-foreground",
                    muted && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.durationMs !== undefined && (
                  <span className="tabular font-mono text-xs text-muted-foreground">
                    {duration(step.durationMs)}
                  </span>
                )}
              </div>
              {step.detail && (
                <p
                  className={cn(
                    "mt-1 font-mono text-xs",
                    state === "failed"
                      ? "text-state-blocked"
                      : "text-muted-foreground",
                  )}
                >
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepNode({ state }: { state: RunStep["state"] }) {
  const base = "relative grid size-6 shrink-0 place-items-center rounded-full";

  if (state === "done") {
    return (
      <span className={cn(base, "bg-state-done/15 text-state-done")}>
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className={cn(base, "bg-state-blocked/15 text-state-blocked")}>
        <X className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "skipped") {
    return (
      <span className={cn(base, "bg-secondary text-muted-foreground")}>
        <Minus className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className={cn(base, "bg-state-running/15")}>
        <span className="absolute size-6 rounded-full bg-state-running/40 animate-state-halo" />
        <span className="relative size-2.5 rounded-full bg-state-running animate-state-pulse" />
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-secondary")}>
      <span className="size-2 rounded-full border border-border" />
    </span>
  );
}
