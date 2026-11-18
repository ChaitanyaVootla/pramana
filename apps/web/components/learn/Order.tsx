"use client";

import { formatYear, type Sureness } from "@pramana/core";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SurenessPicker } from "./Sureness";

/**
 * Putting things in order, earliest first: tap them in sequence (keyboard and
 * screen-reader friendly buttons, no dragging), then say how sure you are.
 * Used by chapter checks (dated claims) and first steps (ages).
 */

/** A stable shuffle (by a hash of the ids), never the right order itself. */
export function shuffled(ids: string[], right: string[]): string[] {
  const h = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const out = [...ids].sort((a, b) => h(a) - h(b));
  if (out.length > 1 && out.every((id, i) => right[i] === id)) out.push(out.shift()!);
  return out;
}

export function OrderPicker({
  ids,
  right,
  labels,
  hints,
  disabled,
  onSubmit,
}: {
  ids: string[];
  /** The right order, so the shuffle never starts with it. */
  right: string[];
  labels: Map<string, string>;
  /** A short line under each label (what an age is), for novices. */
  hints?: Map<string, string | null>;
  disabled?: boolean;
  onSubmit: (order: string[], sureness: Sureness) => void;
}) {
  const pool = useMemo(() => shuffled(ids, right), [ids, right]);
  const [picked, setPicked] = useState<string[]>([]);
  const left = pool.filter((id) => !picked.includes(id));
  return (
    <>
      <p className="mt-1 font-sans text-sm text-ink-3">Tap them from earliest to latest.</p>
      <div className="mt-3 grid gap-4 font-sans sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-ink-3">To place</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {left.map((id) => (
              <li key={id}>
                <Button variant="outline" className="h-auto min-h-9 w-full flex-col items-start justify-start gap-0 py-1.5 text-left whitespace-normal" disabled={disabled} onClick={() => setPicked((p) => [...p, id])}>
                  <span>{labels.get(id)}</span>
                  {hints?.get(id) && <span className="text-xs font-normal text-ink-3">{hints.get(id)}</span>}
                </Button>
              </li>
            ))}
            {!left.length && <li className="text-sm text-ink-3">All placed.</li>}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-3">Your order</p>
          <ol className="mt-1.5 flex flex-col gap-1.5" aria-live="polite">
            {pool.map((_, i) => {
              const id = picked[i];
              return (
                <li key={i} className={cn("flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-ui", id ? "border-indigo-tint bg-indigo-wash text-ink" : "border-dashed border-rule text-ink-3")}>
                  <span className="w-4 shrink-0 tnum">{i + 1}.</span>
                  <span className="flex-1">{id ? labels.get(id) : i === 0 ? "earliest" : i === pool.length - 1 ? "latest" : ""}</span>
                  {id && (
                    <Button variant="ghost" size="icon-xs" aria-label={`Take out ${labels.get(id)}`} disabled={disabled} onClick={() => setPicked((p) => p.filter((x) => x !== id))}>
                      <X aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      {picked.length === pool.length && (
        <SurenessPicker className="mt-4" onPick={(s) => onSubmit(picked, s)} disabled={disabled} hint="Choosing one checks your order." />
      )}
    </>
  );
}

/**
 * The right order: the items at their real dates on a small time line,
 * numbered as in the list below it (a number the learner put in the wrong
 * place is drawn hollow), then the list with dates and the learner's mistakes.
 */
export function OrderResult({
  order,
  given,
  labels,
  years,
  dates,
}: {
  order: string[];
  given: string[];
  labels: Map<string, string>;
  /** Astronomical start year of each item, for placing it. */
  years: Map<string, number>;
  /** "c. 261 BCE": shown in the list. */
  dates: Map<string, string | null>;
}) {
  const pts = order.map((id) => ({ id, year: years.get(id) ?? 0 }));
  const lo = Math.min(...pts.map((p) => p.year));
  const hi = Math.max(...pts.map((p) => p.year));
  const span = Math.max(1, hi - lo);
  return (
    <>
      <div aria-hidden className="mt-4 font-sans">
        <div className="relative mx-3 h-7">
          <div className="absolute top-1/2 right-0 left-0 h-px bg-indigo-tint" />
          {pts.map((p, i) => (
            <span
              key={p.id}
              className={cn(
                "absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-xs font-semibold tnum ring-2 ring-paper",
                given[i] === p.id ? "bg-indigo text-white" : "border border-ink-3 bg-paper text-ink-2",
              )}
              style={{ left: `${((p.year - lo) / span) * 100}%` }}
            >
              {i + 1}
            </span>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-3 tnum">
          <span>{formatYear(lo)}</span>
          <span>{formatYear(hi)}</span>
        </div>
      </div>
      <ol className="mt-3 space-y-1 font-sans text-ui text-ink-2">
        {order.map((id, i) => (
          <li key={id} className="flex gap-2">
            <span className="w-4 shrink-0 text-ink-3 tnum">{i + 1}.</span>
            <span>
              <span className="text-ink">{labels.get(id)}</span>
              {dates.get(id) && <span className="text-ink-3 tnum">, {dates.get(id)}</span>}
              {given[i] === id ? (
                <span className="sr-only"> (you had this right)</span>
              ) : (
                <span className="block text-sm text-ink-3">You put “{labels.get(given[i] ?? "")}” here.</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
