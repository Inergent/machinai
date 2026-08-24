import { Page } from "@/components/machinai/shell";
import { Mono, Panel, Section } from "@/components/machinai/pieces";
import { SignInPrompt } from "@/components/machinai/sign-in";
import { projectRef } from "@/lib/github-data";
import { currentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function UsagePage() {
  const session = await currentSession();
  if (!session) return <SignInPrompt />;

  const ref = projectRef();
  const orchestrator =
    process.env.MACHINAI_ORCHESTRATOR_REPO ?? "Inergent/machinai";

  return (
    <Page
      title="Settings"
      lead="What machinai is pointed at, and what it costs to run."
    >
      <Section title="Project">
        <Panel className="divide-y divide-border">
          {[
            ["Repository", `${ref.owner}/${ref.repo}`],
            ["Orchestrator", orchestrator],
            ["Install / test", "detected from the checkout"],
            ["Sandbox budget", "40 min per attempt, 5 attempts per story"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <Mono className="min-w-0 truncate text-foreground">{value}</Mono>
            </div>
          ))}
        </Panel>
        <p className="mt-3 text-xs text-muted-foreground">
          machinai adds no files to your repository. It reads and writes through
          a GitHub App, so nothing of ours is ever committed.
        </p>
      </Section>

      <Section title="Cost">
        <Panel className="px-4 py-3.5">
          <p className="text-sm text-muted-foreground">
            Vercel does not expose sandbox usage through an API, so these meters
            are read from the dashboard rather than shown here. Hobby pauses
            sandbox creation at the quota instead of billing overage, so this
            cannot run up a bill.
          </p>
          <a
            href="https://vercel.com/inergent/~/usage"
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Open Vercel usage →
          </a>
        </Panel>
      </Section>

      <Section title="Signed in">
        <Panel className="flex items-center justify-between gap-4 px-4 py-3">
          <Mono className="text-foreground">{session.login}</Mono>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </Panel>
      </Section>
    </Page>
  );
}
