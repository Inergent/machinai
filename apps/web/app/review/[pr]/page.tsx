import { notFound } from "next/navigation";
import { Page } from "@/components/machinai/shell";
import { DiffView, Mono, Panel, Section } from "@/components/machinai/pieces";
import { SignInPrompt } from "@/components/machinai/sign-in";
import { getPullRequest, projectRef, storyCheckpoints } from "@/lib/github-data";
import { currentSession } from "@/lib/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: PageProps<"/review/[pr]">) {
  const session = await currentSession();
  if (!session) return <SignInPrompt />;

  const { pr } = await params;
  const ref = projectRef();
  const pull = await getPullRequest(ref, Number(pr));
  if (!pull) notFound();

  // The PR body is a stub pointing at the story; the agent's reasoning lives in
  // its checkpoint on the issue, which is what a reviewer actually wants.
  const checkpoints = pull.storyNumber
    ? await storyCheckpoints(ref, pull.storyNumber).catch(() => [])
    : [];
  const summary = checkpoints.at(-1)?.body ?? pull.agentSummary;

  return (
    <Page
      title={pull.title}
      lead={
        pull.state === "merged"
          ? "Merged."
          : "Finished work, ready for your call."
      }
      back={
        pull.storyNumber
          ? {
              href: `/backlog/${pull.storyNumber}`,
              label: `Task #${pull.storyNumber}`,
            }
          : { href: "/backlog", label: "Work" }
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Mono className="text-muted-foreground">PR #{pull.number}</Mono>
        <Mono className="text-muted-foreground">
          {pull.branch} → {pull.baseBranch}
        </Mono>
        <Mono>
          <span className="text-state-done">+{pull.additions}</span>{" "}
          <span className="text-state-blocked">−{pull.deletions}</span>
        </Mono>
        <a
          href={`https://github.com/${ref.owner}/${ref.repo}/pull/${pull.number}`}
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          on GitHub
        </a>
      </div>

      {summary && (
        <Section title="What machinai did">
          <Panel className="whitespace-pre-wrap px-4 py-3.5 text-sm leading-relaxed text-foreground/85">
            {summary}
          </Panel>
        </Section>
      )}

      {pull.checks.length > 0 && (
        <Section title="Checks">
          <ul className="flex flex-wrap gap-2">
            {pull.checks.map((c) => (
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
                    c.state === "running" &&
                      "bg-state-running animate-state-pulse",
                  )}
                />
                {c.name}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Changes"
        aside={
          <Mono className="text-muted-foreground">{pull.files.length} files</Mono>
        }
      >
        <div className="space-y-3">
          {pull.files.map((f) => (
            <DiffView key={f.path} file={f} />
          ))}
        </div>
      </Section>
    </Page>
  );
}
