"use client";

import type { LearnedToday as LearnedTodayData } from "@pramana/services";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { ClaimItem } from "@/components/era/ClaimItem";
import { LINK } from "@/components/pages/Shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "What you learned today", short: a line on what was answered, then the
 * questions answered right ("You can now answer") and those coming back, each
 * opening to the claim and its seal, a few at a time with the rest folded. Common beliefs met (misconceptions,
 * refuted claims) never appear as facts: each is a turmeric-ruled row that
 * opens to what the evidence shows. Counts are of answers given, never of
 * cards not yet seen.
 */
export function LearnedToday({ data, title = "What you learned today", limit = 4 }: { data: LearnedTodayData; title?: string; limit?: number }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const beliefsMet = data.beliefs ?? [];
  if (!data.claims.length && !beliefsMet.length) return null;
  const open = (id: string) => router.push(`/c/${id}`);
  const { guesses, checks, reviews, right } = data.counts;
  const answered = guesses + checks + reviews;
  const missed = answered - right;
  const beliefs = beliefsMet.length ? ` You looked again at ${beliefsMet.length === 1 ? "a common belief" : `${beliefsMet.length} common beliefs`}.` : "";
  // What they got right first ("You can now answer"), then what comes back ("Coming back soon").
  const ordered = [...data.claims.filter((c) => c.correct !== false), ...data.claims.filter((c) => c.correct === false)];
  const facts = all ? ordered : ordered.slice(0, limit);
  const room = all ? beliefsMet.length : Math.max(0, limit - facts.length);
  const shownBeliefs = beliefsMet.slice(0, Math.max(room, data.claims.length ? 0 : 1));
  const hidden = data.claims.length - facts.length + beliefsMet.length - shownBeliefs.length;
  return (
    <section aria-labelledby="learned-today" className="font-sans">
      <h2 id="learned-today" className="scroll-mt-28 font-serif text-xl text-ink">
        {title}
      </h2>
      <p className="mt-1 text-sm text-ink-2 tnum">
        {answered > 0 && `You answered ${answered} ${answered === 1 ? "question" : "questions"} and got ${right} right.`}
        {missed > 0 && " The ones you missed come back soon, which is how they stick."}
        {beliefs}
      </p>
      {[
        { label: "You can now answer", rows: facts.filter((c) => c.correct !== false) },
        { label: "Coming back soon", rows: facts.filter((c) => c.correct === false) },
      ]
        .filter((g) => g.rows.length > 0)
        .map((g) => (
          <div key={g.label}>
            <p className="mt-3 text-sm text-ink-3">{g.label}</p>
            <ul className="mt-1 divide-y divide-rule border-y border-rule">
              {g.rows.map((c) => {
                const claim = data.cards[c.claimId];
                if (!claim) return null;
                return (
                  <li key={c.claimId}>
                    <details className="group">
                      <summary className="flex min-h-10 cursor-pointer list-none items-baseline gap-2 py-2 text-ui text-ink hover:text-indigo [&::-webkit-details-marker]:hidden">
                        <ChevronRight className="size-3.5 shrink-0 translate-y-0.5 text-ink-3 transition-transform group-open:rotate-90" aria-hidden />
                        {claim.learning?.prompt ?? claim.text}
                      </summary>
                      <ul className="-ml-4 pb-2 pl-5">
                        <ClaimItem claim={claim} onSelect={open} />
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      {shownBeliefs.length > 0 && (
        <ul className="mt-4 space-y-3">
          {shownBeliefs.map((b) => {
            const belief = data.cards[b.claimId];
            if (!belief) return null;
            return (
              <li key={b.claimId} className="border-l-2 border-turmeric pl-4">
                <details className="group">
                  <summary className="cursor-pointer list-none text-sm text-ink-2 [&::-webkit-details-marker]:hidden">
                    A common belief you looked at: <span className="font-serif text-base text-ink-2 italic">“{belief.text}”</span>
                    <span className="ml-1 text-ink-3 group-open:hidden">What the evidence shows</span>
                  </summary>
                  {b.corrections.length > 0 ? (
                    <ul className="-ml-4 mt-1 space-y-0.5">
                      {b.corrections.map((id) => (
                        <ClaimItem key={id} claim={data.cards[id]} onSelect={open} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-ink-3">
                      The evidence says otherwise.{" "}
                      <Link href={`/c/${belief.id}`} className={LINK}>
                        See why
                      </Link>
                    </p>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      )}
      {!all && hidden > 0 && (
        <Button variant="link" size="sm" className="mt-1 px-0" onClick={() => setAll(true)}>
          Show all {data.claims.length + beliefsMet.length}
        </Button>
      )}
    </section>
  );
}

/**
 * The recap in one line, for places other than /learn (home): "Today you met
 * 11 claims and 2 common beliefs. See them". The full list stays on /learn.
 */
export function LearnedTodayLine({ data, className }: { data: LearnedTodayData; className?: string }) {
  const facts = data.claims.length;
  const beliefs = (data.beliefs ?? []).length;
  if (!facts && !beliefs) return null;
  const met = [
    facts ? `${facts} ${facts === 1 ? "claim" : "claims"}` : "",
    beliefs ? `${beliefs} common ${beliefs === 1 ? "belief" : "beliefs"}` : "",
  ].filter(Boolean);
  return (
    <p className={cn("font-sans text-sm text-ink-2 tnum", className)}>
      Today you met {met.join(" and ")}.{" "}
      <Link href="/learn#learned-today" className={LINK}>
        See them
      </Link>
    </p>
  );
}
