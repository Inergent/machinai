"use client";

import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Applies `machinai:ready`, which is all it takes — the webhook does the rest.
 *
 * Deliberately not a direct dispatch: the label *is* the state, so routing
 * through it keeps GitHub and machinai in agreement even if this request is
 * retried, and means a tap here and a tap in GitHub Mobile do the same thing.
 */
export function BuildButton({ issueNumber }: { issueNumber: number }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function build() {
    setState("sending");
    try {
      const res = await fetch("/api/build", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ issueNumber }),
      });
      if (!res.ok) throw new Error(await res.text());
      setState("sent");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  if (state === "sent") {
    return (
      <p className="text-sm text-state-running">
        Queued — refresh in a moment to see the run.
      </p>
    );
  }

  return (
    <div className="text-right">
      <Button size="sm" onClick={build} disabled={state === "sending"}>
        {state === "sending" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Play className="size-4" />
        )}
        Build
      </Button>
      {state === "error" && (
        <p className="mt-1.5 max-w-xs text-xs text-state-blocked">{message}</p>
      )}
    </div>
  );
}
