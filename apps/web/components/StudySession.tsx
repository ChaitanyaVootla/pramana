"use client";

import { CONFIDENT_ERROR_RECHECK_DAYS, type Sureness } from "@pramana/core";
import type { StudyCard } from "@pramana/services";
import { Check, CircleAlert, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { answer as queueAnswer, useOfflineStudy, useStudyCards } from "@/components/learn/offline";
import { SurenessPicker } from "@/components/learn/Sureness";
import { Button } from "@/components/ui/button";
import { SURENESS_LABELS } from "@/lib/labels";

const REL = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

/** "in 10 minutes", "tomorrow", "in 4 days". */
function whenAgain(due: Date, now = Date.now()): string {
  const min = Math.round((due.getTime() - now) / 60_000);
  if (min < 60) return REL.format(Math.max(1, min), "minute");
  const h = Math.round(min / 60);
  if (h < 24) return REL.format(h, "hour");
  const d = Math.round(h / 24);
  if (d < 45) return REL.format(d, "day");
  return REL.format(Math.round(d / 30), "month");
}

/**
 * One card at a time. Before the answer the learner says how sure they are
 * (three levels); after it, whether they were right. The FSRS rating follows
 * from the two (see ratingFor in @pramana/core): wrong is "again", right but
 * guessing is "hard", right is "good", and right, sure and easy is "easy".
 * Being sure and wrong is flagged: the card comes back within minutes, later
 * in this session, and again soon after the first right answer.
 */
export function StudySession({
  cards: fromServer,
  totalDue,
  children,
}: {
  cards: StudyCard[];
  /** All cards due, when more than this session holds. */
  totalDue?: number;
  /** Shown when there is nothing to study. */
  children?: React.ReactNode;
}) {
  const { cards, source } = useStudyCards(fromServer);
  if (!cards.length) return <>{children}</>;
  return <Session key={source} cards={cards} totalDue={source === "server" ? totalDue : undefined} />;
}

/** A quiet line while answers wait on this device. */
function SyncState() {
  const { offline, pending } = useOfflineStudy();
  if (!offline && pending === 0) return null;
  return (
    <p role="status" className="mt-2 font-sans text-sm text-ink-3">
      {offline ? "Offline: your answers are kept on this device and will sync when you are back online." : "Sending your answers…"}
      {pending > 0 && <span className="tnum"> {pending} waiting.</span>}
    </p>
  );
}

function Session({ cards: initial, totalDue }: { cards: StudyCard[]; totalDue?: number }) {
  const [queue, setQueue] = useState(initial);
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [sureness, setSureness] = useState<Sureness | null>(null);
  const [surprise, setSurprise] = useState(false);
  const [last, setLast] = useState<{ due: Date } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const card = queue[index];
  const reviewed = index;

  if (!card) {
    return (
      <section className="mx-auto max-w-(--reading-w)">
        <h2 className="text-xl text-ink">
          Done: you reviewed {reviewed} {reviewed === 1 ? "card" : "cards"}.
        </h2>
        <p className="mt-2 max-w-(--measure) font-sans text-note text-ink-2">
          Each one comes back just before you would forget it. Read on in the meantime, and add claims to your reviews as you go.
        </p>
      </section>
    );
  }

  const next = () => {
    setIndex((i) => i + 1);
    setSureness(null);
    setSurprise(false);
    setError(null);
  };

  const answer = (correct: boolean, easy = false) =>
    start(async () => {
      if (!sureness) return;
      // Queued on the device first, then sent: the same path online and offline.
      const r = await queueAnswer({ claimId: card.claimId, correct, sureness, ...(easy ? { easy } : {}) }).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      });
      if (!r) return;
      setLast(r.nextDue ? { due: r.nextDue } : null);
      if (!correct && sureness === "high") {
        // Asked once more before the session ends.
        if (!requeued.has(card.cardId)) {
          setQueue((q) => [...q, { ...card, confidentError: true }]);
          setRequeued((s) => new Set(s).add(card.cardId));
        }
        setSurprise(true);
        return;
      }
      next();
    });

  return (
    // One reading-width column (--reading-w, set by the appearance panel): progress on top, the question cut into the page as a field, the answer and its buttons below.
    <section aria-label="Study card" className="mx-auto max-w-(--reading-w)">
      <div className="flex items-center gap-4 font-sans text-sm text-ink-3 tnum">
        <span className="shrink-0">
          Card {index + 1} of {queue.length}
          {totalDue !== undefined && totalDue > initial.length && <span className="hidden sm:inline">, {totalDue - initial.length} more due after these</span>}
        </span>
        {/* Progress in ink on the rule (indigo bars are years). */}
        <div
          role="progressbar"
          aria-label="Cards reviewed"
          aria-valuemin={0}
          aria-valuemax={queue.length}
          aria-valuenow={index}
          className="h-1 flex-1 overflow-hidden rounded-full bg-rule"
        >
          <div className="h-full rounded-full bg-ink/75 transition-[width] duration-200" style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
        <span className="shrink-0">{card.reps === 0 ? "new to you" : `seen ${card.reps} ${card.reps === 1 ? "time" : "times"}`}</span>
      </div>
      {last && !surprise && (
        <p className="mt-2 font-sans text-sm text-ink-3" role="status">
          The last card comes back {whenAgain(last.due)}.
        </p>
      )}
      <SyncState />

      <div className="field mt-4 p-4">
        {card.confidentError && (
          <p className="mb-2 font-sans text-sm text-turmeric-ink">Last time you were sure of this and it was wrong. This checks that the correction held.</p>
        )}
        <p className="font-serif text-xl text-ink">{card.front.question}</p>
        {!sureness && (
          <div className="mt-6">
            <SurenessPicker onPick={setSureness} hint="Choose one to see the answer. Over time you will see whether your confidence matches what you know." />
          </div>
        )}
      </div>

      {sureness && (
        <div className="mt-6">
          <p className="font-sans text-sm text-ink-3">You said: {SURENESS_LABELS[sureness].toLowerCase()}.</p>
          <p className="mt-2 text-lg text-ink">{card.back.answer}</p>
          {card.back.claim !== card.back.answer && <p className="mt-2 border-l-2 border-indigo-tint pl-3 text-base text-ink-2">{card.back.claim}</p>}
          {card.back.corrections.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-l-2 border-turmeric pl-4 text-note text-ink">
              {card.back.corrections.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 font-sans text-sm text-ink-3">
            {card.back.sources.length > 0 && <span className="evidence-standard">From {card.back.sources.join("; ")}. </span>}
            <Link href={`/c/${card.claimId}`} className="text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo">
              See the evidence
            </Link>
          </p>

          {surprise ? (
            <div role="status" className="mt-7 border-l-2 border-turmeric pl-4 font-sans text-note text-ink">
              <p className="font-semibold">You were sure, and it was wrong.</p>
              <p className="mt-1 text-ink-2">
                Take a moment with the answer: confident mistakes are the ones most often fixed by feedback, and the old idea tends to creep back. It
                comes back later in this session, and again within {CONFIDENT_ERROR_RECHECK_DAYS} days once you have it right.
              </p>
              <Button className="mt-3" onClick={next}>
                Next card
              </Button>
            </div>
          ) : (
            <fieldset className="mt-7 font-sans">
              <legend className="text-ui text-ink">Were you right?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={pending} onClick={() => answer(true)} title={sureness === "low" ? "A right guess comes back a little sooner" : undefined}>
                  <Check /> I was right
                </Button>
                {sureness === "high" && (
                  <Button variant="outline" disabled={pending} onClick={() => answer(true, true)}>
                    <Check /> Right, and it was easy
                  </Button>
                )}
                <Button variant="outline" disabled={pending} onClick={() => answer(false)} className={sureness === "high" ? "col-span-2" : undefined}>
                  <X /> I was wrong
                </Button>
              </div>
              <p className="mt-2 text-sm text-ink-3">
                {sureness === "low" ? "A right guess comes back a little sooner than an answer you knew." : "Wrong answers come back within minutes."}
              </p>
            </fieldset>
          )}
          {error && (
            <p role="alert" className="mt-3 flex items-center gap-1.5 font-sans text-ui text-madder">
              <CircleAlert className="size-4" aria-hidden /> {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
