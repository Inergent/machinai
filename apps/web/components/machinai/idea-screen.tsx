"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Page } from "./shell";
import { Mono, Panel, Section } from "./pieces";

type Phase = "idle" | "sending" | "sent" | "error";

const EXAMPLE =
  "A habit tracker where one missed day doesn't wipe your streak, and a single accountability partner can see how you're doing.";

/**
 * Idea in, filed backlog out.
 *
 * Decomposition runs on a GitHub Actions runner and takes a couple of minutes,
 * so this fires and hands over to the backlog rather than pretending to stream.
 * An honest handoff reads better than a fake progress bar.
 */
export function IdeaScreen() {
  const [idea, setIdea] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");

  async function plan() {
    if (idea.trim().length < 10) return;
    setPhase("sending");
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      if (!res.ok) throw new Error(await res.text());
      setPhase("sent");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  if (phase === "sent") {
    return (
      <Page
        title="Planning"
        lead="machinai is breaking your idea into tasks. This takes a couple of minutes."
      >
        <Panel className="px-4 py-3.5">
          <p className="text-sm text-muted-foreground">{idea}</p>
        </Panel>

        <Section title="What happens next">
          <ol className="space-y-3">
            {[
              "Tasks are written out with a clear definition of done, so machinai can check its own work.",
              "Anything that is not waiting on something else starts building straight away.",
              "The rest start on their own as the work they depend on finishes.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3 text-sm">
                <Mono className="mt-0.5 shrink-0 text-muted-foreground">
                  0{i + 1}
                </Mono>
                <span className="text-foreground/85">{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="flex-1">
            <Link href="/backlog">See the plan</Link>
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setIdea("");
              setPhase("idle");
            }}
          >
            Describe something else
          </Button>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Describe it"
      lead="One or two sentences is enough. machinai breaks it into tasks, works out the order, and starts building the ones that are ready."
    >
      <Panel className="p-1.5">
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder={EXAMPLE}
          rows={4}
          disabled={phase === "sending"}
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
          <Button
            size="sm"
            onClick={plan}
            disabled={idea.trim().length < 10 || phase === "sending"}
          >
            {phase === "sending" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            Plan it
          </Button>
        </div>
      </Panel>

      {phase === "error" && (
        <p className="mt-3 text-sm text-state-blocked">{message}</p>
      )}

      <Section title="How it goes">
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            ["Describe", "You write the idea. Two sentences."],
            ["Approve", "Approve the tasks you want built."],
            ["Walk away", "machinai builds. You review from your phone."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-xl border border-border bg-card p-4">
              <Mono className="text-muted-foreground">0{i + 1}</Mono>
              <p className="mt-2 text-sm font-medium">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Before you do">
        <Panel className="px-4 py-3.5">
          <p className="flex gap-2.5 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-4 shrink-0 text-state-done" />
            <span>
              Tasks that are not waiting on anything start building right away,
              so this does real work. Each one costs a little compute.
            </span>
          </p>
        </Panel>
      </Section>
    </Page>
  );
}
