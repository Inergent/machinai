import { Page } from "@/components/machinai/shell";
import { MeterBar, Mono, Panel, Section } from "@/components/machinai/pieces";
import { project, usage } from "@/lib/fixtures/data";

export default function UsagePage() {
  const resets = new Date(usage.periodEndsAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <Page
      title="Usage"
      lead="The prototype runs entirely on free tiers. These are the meters that decide whether it keeps running."
    >
      <Section
        title="This period"
        aside={<Mono className="text-muted-foreground">resets {resets}</Mono>}
      >
        <Panel className="space-y-5 p-5">
          {usage.meters.map((m) => (
            <MeterBar key={m.label} meter={m} />
          ))}
        </Panel>
        <p className="mt-3 text-xs text-muted-foreground">
          Vercel Hobby pauses sandbox creation at the quota rather than billing
          overage, so this cannot run up a bill. Provisioned memory is the meter
          that binds first — active CPU stays low because agent runs are mostly
          waiting on model calls.
        </p>
      </Section>

      <Section title="Project">
        <Panel className="divide-y divide-border">
          {[
            ["Repository", project.repo],
            ["Base branch", project.baseBranch],
            ["Install", project.installCmd],
            ["Test", project.testCmd],
            ["Build", project.buildCmd],
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
          machinai adds no files to this repository. It reads and writes through a
          GitHub App, so nothing of ours is ever committed.
        </p>
      </Section>
    </Page>
  );
}
