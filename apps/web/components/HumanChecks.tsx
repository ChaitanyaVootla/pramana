"use client";

import { Check, CircleAlert } from "lucide-react";
import { useState, useTransition } from "react";
import { attestExcerptAction, judgeSupportAction } from "@/app/actions";
import { Disclosure } from "@/components/pages/Disclosure";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Your own review of one citation: does the excerpt support the claim? Did you check the quote yourself? */
export function HumanChecks({
  citationId,
  excerptId,
  path,
  quoteChecked,
}: {
  citationId: string;
  excerptId: string;
  path: string;
  quoteChecked: boolean;
}) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setStatus(r.ok ? { ok: true, text: r.message ?? "Saved." } : { ok: false, text: r.error });
    });

  return (
    <Disclosure summary="Check this citation yourself">
      <div className="grid max-w-[40rem] gap-3 font-sans">
        <p className="text-note text-ink-2">
          Open the source, find the passage, and say whether it says what the claim says. Your judgement is recorded under your name; a
          person&rsquo;s confirmation is what turns the seal green.
        </p>
        <div className="grid gap-1.5">
          <label className="text-ui text-ink" htmlFor={`note-${citationId}`}>
            What did you compare it with?
          </label>
          <Textarea
            id={`note-${citationId}`}
            value={note}
            placeholder="For example: checked against the 1925 printed edition, p. 47."
            onChange={(e) => setNote(e.target.value)}
            className="bg-paper font-sans text-note md:text-note"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => run(() => judgeSupportAction(citationId, "supports", note, path))}>
            Confirm it supports the claim
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => run(() => judgeSupportAction(citationId, "partial", note, path))}>
            It partly supports it
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => run(() => judgeSupportAction(citationId, "unsupported", note, path))}>
            It does not support it
          </Button>
          {!quoteChecked && (
            <Button variant="ghost" disabled={pending} onClick={() => run(() => attestExcerptAction(excerptId, note, path))}>
              I found the quote in the source
            </Button>
          )}
        </div>
        {status && (
          <p role="status" className={cn("flex items-center gap-1.5 text-ui", status.ok ? "text-sage" : "text-madder")}>
            {status.ok ? <Check className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
            {status.text}
          </p>
        )}
      </div>
    </Disclosure>
  );
}
