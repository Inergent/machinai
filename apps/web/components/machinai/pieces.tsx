import Link from "next/link";
import { GitBranch, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { compact, duration, pct, since } from "@/lib/format";
import type {
  Commit,
  DiffFile,
  LogLine,
  Meter,
  Story,
  TestResult,
} from "@/lib/fixtures/types";
import { StoryBadge } from "./state";

/** Section heading. Grouping is done with space, not boxes. */
export function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-9 first:mt-0", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {aside}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** One level of elevation, ever. */
export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}

export function Mono({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("tabular font-mono text-xs", className)}>{children}</span>
  );
}

export function StoryRow({ story, now = new Date() }: { story: Story; now?: Date }) {
  const blocked = story.state === "blocked";
  return (
    <Link
      href={`/backlog/${story.number}`}
      className={cn(
        "flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors duration-150",
        "hover:border-foreground/15",
      )}
    >
      <Mono className="mt-0.5 w-9 shrink-0 text-muted-foreground">
        #{story.number}
      </Mono>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{story.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{since(story.updatedAt, now)}</span>
          {story.branch && (
            <span className="inline-flex items-center gap-1">
              <GitBranch className="size-3" />
              <Mono>{story.branch}</Mono>
            </span>
          )}
          {blocked && (
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" />
              blocked by{" "}
              <Mono>{story.blockedBy.map((n) => `#${n}`).join(", ")}</Mono>
            </span>
          )}
          {story.state === "stuck" && (
            <Mono className="text-state-blocked">
              attempt {story.attempts}/{story.maxAttempts}
            </Mono>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <StoryBadge state={story.state} />
      </div>
    </Link>
  );
}

export function LogTail({ lines }: { lines: LogLine[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <pre className="min-w-max px-4 py-3 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span className="tabular shrink-0 text-muted-foreground/60">
              {line.ts}
            </span>
            <span
              className={cn(
                line.level === "error" && "text-state-blocked",
                line.level === "warn" && "text-state-review",
                !line.level && "text-foreground/80",
              )}
            >
              {line.text}
            </span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function CommitList({ commits }: { commits: Commit[] }) {
  if (commits.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        No commits yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {commits.map((c) => (
        <li key={c.sha} className="flex items-start gap-3 px-4 py-3">
          <Mono className="mt-0.5 shrink-0 text-muted-foreground">{c.sha}</Mono>
          <p className="min-w-0 flex-1 text-sm">{c.message}</p>
          <Mono className="mt-0.5 shrink-0">
            <span className="text-state-done">+{c.additions}</span>{" "}
            <span className="text-state-blocked">−{c.deletions}</span>
          </Mono>
        </li>
      ))}
    </ul>
  );
}

export function TestSummary({ tests }: { tests: TestResult }) {
  const failed = tests.failed > 0;
  return (
    <Panel className="px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span
          className={cn(
            "text-sm font-medium",
            failed ? "text-state-blocked" : "text-state-done",
          )}
        >
          {failed ? `${tests.failed} failed` : `${tests.passed} passed`}
        </span>
        <Mono className="text-muted-foreground">
          {tests.total} tests · {duration(tests.durationMs)}
        </Mono>
      </div>
      {tests.failures.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {tests.failures.map((f) => (
            <li key={f} className="font-mono text-xs text-state-blocked">
              {f}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function MeterBar({ meter }: { meter: Meter }) {
  const limit = meter.limit;
  const percent = limit === null ? 0 : pct(meter.used, limit);
  const hot = percent >= 80;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{meter.label}</span>
        <Mono className={cn(hot ? "text-state-review" : "text-muted-foreground")}>
          {compact(meter.used)}
          {meter.unit && ` ${meter.unit}`}
          {limit === null ? (
            <span className="text-muted-foreground"> · unlimited</span>
          ) : (
            <span className="text-muted-foreground">
              {" "}
              / {compact(limit)}
            </span>
          )}
        </Mono>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            limit === null
              ? "bg-state-idle/40"
              : hot
                ? "bg-state-review"
                : "bg-state-running",
          )}
          style={{ width: limit === null ? "100%" : `${Math.max(percent, 1.5)}%` }}
        />
      </div>
    </div>
  );
}

/** Diff that stays readable one-handed: no side-by-side, no wrapping. */
export function DiffView({ file }: { file: DiffFile }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-2.5">
        <Mono className="min-w-0 truncate text-foreground">{file.path}</Mono>
        <Mono className="shrink-0">
          <span className="text-state-done">+{file.additions}</span>{" "}
          <span className="text-state-blocked">−{file.deletions}</span>
        </Mono>
      </div>
      <div className="overflow-x-auto">
        <pre className="min-w-max font-mono text-xs leading-relaxed">
          {file.lines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 px-4",
                line.type === "add" && "bg-state-done/10",
                line.type === "del" && "bg-state-blocked/10",
              )}
            >
              <span className="tabular w-8 shrink-0 select-none text-right text-muted-foreground/50">
                {line.newLine ?? line.oldLine ?? ""}
              </span>
              <span
                className={cn(
                  "w-2 shrink-0 select-none",
                  line.type === "add" && "text-state-done",
                  line.type === "del" && "text-state-blocked",
                  line.type === "ctx" && "text-transparent",
                )}
              >
                {line.type === "add" ? "+" : line.type === "del" ? "−" : " "}
              </span>
              <span className="text-foreground/85">{line.content || " "}</span>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}

export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
