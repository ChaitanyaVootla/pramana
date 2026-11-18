"use client";

import { Check, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveChangesetAction, rejectChangesetAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Approve or reject one proposal. Rejecting needs a note, because the author
 * reads it. Approvals are one at a time: a proposal that builds on others
 * still waiting cannot be approved until those are, each on its own.
 */
export function ReviewActions({
  id,
  waitingOn,
}: {
  id: string;
  /** Proposals this one builds on that are still waiting, in the order to review them. */
  waitingOn: { id: string; title: string }[];
}) {
  const pendingDependencies = waitingOn.length;
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = (fn: () => ReturnType<typeof approveChangesetAction>) =>
    start(async () => {
      const r = await fn();
      setStatus(r.ok ? { ok: true, text: r.message ?? "Done." } : { ok: false, text: r.error });
      if (r.ok) {
        toast.success(r.message ?? "Done.");
        router.refresh();
      }
    });

  return (
    <div className="grid gap-3 font-sans">
      <div className="grid gap-1.5">
        <label htmlFor="decision-note" className="text-ui text-ink">
          Note to the author
          <span className="text-ink-3"> (needed to reject)</span>
        </label>
        <Textarea
          id="decision-note"
          value={note}
          placeholder="What you checked, or what needs fixing."
          onChange={(e) => setNote(e.target.value)}
          className="bg-paper font-sans text-note md:text-note"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending || pendingDependencies > 0}
          onClick={() => run(() => approveChangesetAction(id, note, false))}
        >
          <Check />
          Approve and apply
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => run(() => rejectChangesetAction(id, note))}
        >
          Reject
        </Button>
      </div>
      {pendingDependencies > 0 && (
        <div className="text-sm text-ink-2">
          <p>
            This builds on{" "}
            {pendingDependencies === 1 ? "a proposal" : `${pendingDependencies} proposals`} still
            waiting. Review {pendingDependencies === 1 ? "it" : "them"} first:
          </p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            {waitingOn.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/review/${d.id}`}
                  className="text-indigo underline decoration-indigo-tint underline-offset-3"
                >
                  {d.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
      {status && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-1.5 text-ui",
            status.ok ? "text-sage" : "text-madder",
          )}
        >
          {status.ok ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <CircleAlert className="size-4" aria-hidden />
          )}
          {status.text}
        </p>
      )}
    </div>
  );
}
