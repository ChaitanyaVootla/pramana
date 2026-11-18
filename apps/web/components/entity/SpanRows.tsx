"use client";

import { formatYear } from "@pramana/core";
import { usePointAt } from "@/components/atlas/bus";
import { cn } from "@/lib/utils";

export interface SpanRow {
  key: string;
  label: React.ReactNode;
  /** "268–232 BCE". */
  dates: string;
  from: number;
  to: number;
  approximate?: boolean;
  /** strong: the subject's own span; faint: context (the state they ruled); place: a polity holding a place. */
  tone?: "strong" | "faint" | "place";
  /** A note under the row (how the date was set). */
  note?: string | null;
  /** Several stretches on one row (a place that changed hands and came back). */
  stretches?: { from: number; to: number }[];
  /** Entity ids to light on the atlas while pointing at the row. */
  pointAt?: string[];
  /** Picking the row shows the atlas in this year. */
  year?: number;
}

/**
 * Spans on one shared axis: a life against a reign against the state they
 * ruled, or the states a place lay in over the centuries. Bars are placed in
 * proportion; approximate ends fade.
 */
export function SpanRows({
  rows,
  className,
  label,
  onYear,
}: {
  rows: SpanRow[];
  className?: string;
  label: string;
  /** Rows with a year become buttons that show the atlas in that year. */
  onYear?: (year: number) => void;
}) {
  if (!rows.length) return null;
  const lo = Math.min(...rows.map((r) => r.from));
  const hi = Math.max(...rows.map((r) => r.to));
  const pad = Math.max(2, (hi - lo) * 0.06);
  // Round ends (500 BCE, 1900), and never past the present: a holder that lasts
  // to today does not push the axis into the future.
  const step = [10, 50, 100, 500].find((s) => (hi - lo) / s <= 12) ?? 1000;
  const now = new Date().getUTCFullYear();
  const a = roundYear(lo - pad, step, "down");
  const b = Math.max(hi, Math.min(now, roundYear(hi + pad, step, "up")));
  const pct = (y: number) => ((y - a) / (b - a)) * 100;
  return (
    <div className={cn("font-sans", className)} role="list" aria-label={label}>
      {rows.map((r) => (
        <Row key={r.key} row={r} pct={pct} onYear={onYear} />
      ))}
      <div className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-[10rem_minmax(0,1fr)]" aria-hidden>
        <span className="hidden sm:block" />
        <div className="flex justify-between text-xs text-ink-3 tnum">
          <span>{formatYear(Math.floor(a), { era: "auto" })}</span>
          <span>{formatYear(Math.floor(b), { era: "auto" })}</span>
        </div>
      </div>
    </div>
  );
}

function Row({
  row: r,
  pct,
  onYear,
}: {
  row: SpanRow;
  pct: (y: number) => number;
  onYear?: (year: number) => void;
}) {
  const point = usePointAt(r.pointAt);
  const parts = r.stretches?.length ? r.stretches : [{ from: r.from, to: r.to }];
  const fill =
    r.tone === "faint" ? "bg-indigo-tint" : r.tone === "place" ? "bg-sandstone/70" : "bg-indigo";
  return (
    <div
      role="listitem"
      className={cn(
        "group/row -mx-2 grid grid-cols-1 items-center gap-x-4 gap-y-1 rounded-md px-2 py-1.5 transition-colors sm:grid-cols-[10rem_minmax(0,1fr)]",
        onYear && r.year !== undefined && "hover:bg-rule-soft/60",
      )}
      {...point}
    >
      <div className="min-w-0 text-ui leading-tight text-ink">{r.label}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div className="relative h-2 min-w-0 flex-1 rounded-full bg-rule-soft">
            {parts.map((p, i) => {
              const left = pct(p.from);
              const width = Math.max(0.8, pct(p.to) - left);
              return (
                <span
                  key={i}
                  className={cn(
                    "absolute inset-y-0 rounded-full",
                    fill,
                    r.approximate &&
                      "[mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]",
                  )}
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: 3 }}
                />
              );
            })}
          </div>
          {onYear && r.year !== undefined ? (
            <button
              type="button"
              onClick={() => onYear(r.year!)}
              className="w-[8.5rem] shrink-0 rounded-sm text-right text-sm text-ink-2 tnum hover:text-indigo focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`${r.dates}: show the map in ${formatYear(r.year)}`}
              title={`Show the map in ${formatYear(r.year)}`}
            >
              {r.dates}
            </button>
          ) : (
            <span className="w-[8.5rem] shrink-0 text-right text-sm text-ink-2 tnum">
              {r.dates}
            </span>
          )}
        </div>
        {r.note && <p className="mt-0.5 text-xs leading-snug text-ink-3">{r.note}</p>}
      </div>
    </div>
  );
}

/**
 * An astronomical year rounded to a step as people write years (500 BCE, 1 CE,
 * 1900), not as the astronomical number (-500 would print as "501 BCE").
 */
function roundYear(astro: number, step: number, dir: "down" | "up"): number {
  if (astro <= 0) {
    // BCE: historical year = 1 - astronomical; rounding down in time is up in BCE years.
    const bce = 1 - astro;
    const r = dir === "down" ? Math.ceil(bce / step) * step : Math.floor(bce / step) * step;
    return r <= 0 ? 1 : 1 - r;
  }
  const r = dir === "down" ? Math.floor(astro / step) * step : Math.ceil(astro / step) * step;
  return r <= 0 ? 1 : r;
}
