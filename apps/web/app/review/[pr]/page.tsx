import { notFound } from "next/navigation";
import { Page } from "@/components/machinai/shell";
import { Mono, Panel, Section } from "@/components/machinai/pieces";
import { ReviewActions } from "@/components/machinai/review-actions";
import { DiffView } from "@/components/machinai/pieces";
import { pullRequest } from "@/lib/fixtures/data";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return [{ pr: String(pullRequest.number) }];
}

export default async function ReviewPage({ params }: PageProps<"/review/[pr]">) {
  const { pr } = await params;
  if (Number(pr) !== pullRequest.number) notFound();
  const prData = pullRequest;

  return (
    <Page
      title={prData.title}
      lead="The agent's work, ready for your call."
      back={{
        href: `/backlog/${prData.storyNumber}`,
        label: `Story #${prData.storyNumber}`,
      }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Mono className="text-muted-foreground">PR #{prData.number}</Mono>
        <Mono className="text-muted-foreground">
          {prData.branch} → {prData.baseBranch}
        </Mono>
        <Mono>
          <span className="text-state-done">+{prData.additions}</span>{" "}
          <span className="text-state-blocked">−{prData.deletions}</span>
        </Mono>
      </div>

      <Section title="What the agent did">
        <Panel className="px-4 py-3.5">
          <p className="text-sm leading-relaxed text-foreground/85">
            {prData.agentSummary}
          </p>
        </Panel>
      </Section>

      <Section title="Checks">
        <ul className="flex flex-wrap gap-2">
          {prData.checks.map((c) => (
            <li
              key={c.name}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-mono text-xs",
                c.state === "passed" && "text-state-done",
                c.state === "failed" && "text-state-blocked",
                c.state === "running" && "text-state-running",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  c.state === "passed" && "bg-state-done",
                  c.state === "failed" && "bg-state-blocked",
                  c.state === "running" && "bg-state-running animate-state-pulse",
                )}
              />
              {c.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Changes"
        aside={
          <Mono className="text-muted-foreground">{prData.files.length} files</Mono>
        }
      >
        <div className="space-y-3">
          {prData.files.map((f) => (
            <DiffView key={f.path} file={f} />
          ))}
        </div>
      </Section>

      <ReviewActions />
    </Page>
  );
}
