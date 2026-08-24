"use client";

import { useState } from "react";
import { GitMerge, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Panel, Section } from "./pieces";

/**
 * The two things you can do from a beach: take it, or say what's wrong.
 * Feedback becomes an issue comment plus a `machinai:revise` label, which
 * re-dispatches onto the same branch.
 */
export function ReviewActions() {
  const [feedback, setFeedback] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Section title="Your call">
      {open ? (
        <Panel className="p-1.5">
          <Textarea
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Archiving should keep the habit visible in history filters. Also the 60-char cap needs a visible counter."
            className="resize-none border-0 bg-transparent text-base shadow-none focus-visible:ring-0 md:text-sm"
          />
          <div className="flex items-center justify-between gap-3 px-2.5 pb-2 pt-1">
            <p className="text-xs text-muted-foreground">
              Posts as a comment and sends it back for another pass.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={!feedback.trim()}>
                Send back
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1">
            <GitMerge className="size-4" />
            Merge and close #22
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setOpen(true)}
          >
            <MessageSquare className="size-4" />
            Request changes
          </Button>
        </div>
      )}
    </Section>
  );
}
