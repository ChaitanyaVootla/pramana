"use client";

import { CircleAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { stopAutoApprovalAction } from "@/app/actions";
import { Button } from "@/components/ui/button";

const WHEN = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * While the person has asked agents to approve for them, /review says so, in
 * their own words, with a way to stop it. Stopping asks for a second press,
 * so it is never done by accident.
 */
export function StopAutoApproval({ since, instruction }: { since: string; instruction: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const stop = () =>
    start(async () => {
      const r = await stopAutoApprovalAction("");
      if (!r.ok) return setError(r.error);
      toast.success(r.message ?? "Auto-approval is off.");
      router.refresh();
    });
  return (
    <section
      aria-labelledby="auto-approval"
      className="mt-8 rounded-lg border border-indigo-tint bg-indigo-wash/50 px-5 py-4 font-sans"
    >
      <h2
        id="auto-approval"
        className="flex items-center gap-2 font-sans text-ui font-semibold text-ink"
      >
        <ShieldCheck className="size-4 text-indigo" aria-hidden /> Auto-approval is on
      </h2>
      <p className="mt-1 max-w-[70ch] text-note text-ink-2">
        Since {WHEN.format(new Date(since))} UTC, Claude Code approves proposals for you, under your
        instruction: <q className="text-ink">{instruction}</q>. Each approval it makes is marked
        “Approved for you” and names this instruction.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <Button variant="destructive" size="sm" disabled={pending} onClick={stop}>
              Yes, stop auto-approval
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Keep it on
            </Button>
            <span className="text-sm text-ink-3">
              From then on, every proposal waits here for you.
            </span>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="bg-paper"
            onClick={() => setConfirming(true)}
          >
            Stop auto-approval
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-madder">
          <CircleAlert className="size-4" aria-hidden /> {error}
        </p>
      )}
    </section>
  );
}
