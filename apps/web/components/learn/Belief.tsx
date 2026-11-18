"use client";

import type { Belief } from "@pramana/core";
import type { PageView } from "@pramana/services";
import { CircleAlert } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { recordBeliefAction } from "@/app/learn/actions";
import { Button } from "@/components/ui/button";
import { BELIEF_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { usePageLearning } from "./store";
import { radioArrows } from "./Sureness";

const CHOICES: Belief[] = ["yes", "no", "unsure"];

/**
 * "Did you believe this?" under a misconception: one tap that records the
 * learner's prior belief. A belief they held goes into their reviews, so the
 * correction comes back.
 */
export function BeliefTap({ blockId, claimId, view, className }: { blockId: string; claimId: string; view: PageView; className?: string }) {
  const legendId = useId();
  const { state, update } = usePageLearning(view.page.id);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = state.data?.beliefs[blockId];

  const pick = (belief: Belief) =>
    start(async () => {
      const r = await recordBeliefAction({ page: view.page.id, blockId, belief });
      if (!r.ok) return setError(r.error);
      setError(null);
      update((d) => ({
        ...d,
        beliefs: { ...d.beliefs, [blockId]: belief },
        inDeck: belief === "yes" ? [...new Set([...d.inDeck, claimId])] : d.inDeck,
      }));
    });

  return (
    <div className={cn("font-sans", className)}>
      <p id={legendId} className="text-sm text-ink-2">
        Before reading this, did you believe it?
      </p>
      <div role="radiogroup" aria-labelledby={legendId} className="mt-1.5 flex flex-wrap gap-1.5" onKeyDown={radioArrows}>
        {CHOICES.map((b, i) => (
          <Button
            key={b}
            size="sm"
            role="radio"
            aria-checked={current === b}
            tabIndex={current ? (current === b ? 0 : -1) : i === 0 ? 0 : -1}
            variant={current === b ? "secondary" : "outline"}
            disabled={pending || state.status !== "ready"}
            onClick={() => pick(b)}
          >
            {BELIEF_LABELS[b]}
          </Button>
        ))}
      </div>
      {current && (
        <p role="status" className="mt-1.5 text-sm text-ink-3">
          {current === "yes"
            ? "Many people do. It is in your reviews now, so the correction comes back."
            : current === "no"
              ? "Noted. It helps to know which stories you have already set aside."
              : "Noted. The evidence below is the place to start."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm text-madder">
          <CircleAlert className="size-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}
