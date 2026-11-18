import type { Aggregate } from "@pramana/core";
import { cn } from "@/lib/utils";

/**
 * Plain HTML charts for /insights: every chart is also text (a caption with
 * the numbers, and sr-only lists), so it reads without the colours. Colours
 * follow the app's rule that colour carries meaning: indigo shades for
 * verification levels, green only for "checked by a person", ink greys for
 * everything else.
 */

export interface Part {
  key: string;
  label: string;
  value: number;
  className: string;
}

const PCT = new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 0 });
export const pct = (n: number, d: number) => (d ? PCT.format(n / d) : "–");

/** One horizontal bar split into parts, with the parts named below in a legend. */
export function StackBar({ parts, label, className, legend = true }: { parts: Part[]; label: string; className?: string; legend?: boolean }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const words = parts.filter((p) => p.value > 0).map((p) => `${p.label} ${p.value}`).join(", ");
  return (
    <div className={cn("font-sans", className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-rule-soft" role="img" aria-label={`${label}: ${words || "none"}`}>
        {total > 0 &&
          parts.map((p) =>
            p.value > 0 ? <span key={p.key} className={cn("h-full", p.className)} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} /> : null,
          )}
      </div>
      {legend && (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-3 tnum" aria-hidden>
          {parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <li key={p.key} className="flex items-center gap-1">
                <span className={cn("inline-block size-2 rounded-[2px]", p.className)} />
                {p.label} {p.value}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

/** A list of counts with a bar each, longest first. */
export function CountList({ counts, labels = {}, className }: { counts: Record<string, number>; labels?: Record<string, string>; className?: string }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <ul className={cn("space-y-1 font-sans text-ui", className)}>
      {rows.map(([k, n]) => (
        <li key={k} className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-2">
          <span className="truncate text-ink-2">{labels[k] ?? k.replace(/_/g, " ")}</span>
          <span className="h-2 rounded-full bg-ink-3/45" style={{ width: `${(n / max) * 100}%` }} aria-hidden />
          <span className="text-right text-ink-3 tnum">{n}</span>
        </li>
      ))}
    </ul>
  );
}

/** What an aggregate shows: its value, or why it is withheld, and always how many answered. */
export function Withheld({ a, minGroup }: { a: Aggregate<unknown>; minGroup: number }) {
  return (
    <span className="font-sans text-sm text-ink-3 tnum">
      {a.responses} {a.responses === 1 ? "answer" : "answers"} from {a.learners} {a.learners === 1 ? "learner" : "learners"}
      {a.value === null && <>; shown once {minGroup} or more have answered</>}
    </span>
  );
}

export const LEVEL_PARTS: Record<number, { label: string; className: string }> = {
  0: { label: "No source", className: "bg-transparent border border-dashed border-ink-3/70" },
  1: { label: "Cited", className: "bg-indigo/35" },
  2: { label: "Quote found", className: "bg-indigo/70" },
  3: { label: "AI-checked", className: "bg-indigo" },
  4: { label: "Checked by a person", className: "bg-sage" },
};

export const TIER_PARTS: Record<string, { label: string; className: string }> = {
  primary: { label: "From the time", className: "bg-ink/75" },
  secondary: { label: "Modern scholarship", className: "bg-ink-3/60" },
  tertiary: { label: "Reference only", className: "bg-ink-3/25" },
  none: { label: "No source", className: "bg-transparent border border-dashed border-ink-3/70" },
};

export const QUOTE_PARTS: Record<string, { label: string; className: string }> = {
  exact: { label: "Word for word", className: "bg-indigo" },
  fuzzy: { label: "Close match", className: "bg-indigo/55" },
  human_attested: { label: "Checked by a person", className: "bg-sage" },
  no_quote: { label: "Location only", className: "bg-ink-3/30" },
  not_found: { label: "Not found", className: "bg-turmeric" },
  no_snapshot: { label: "No stored copy", className: "bg-ink-3/15" },
  unchecked: { label: "Not checked", className: "bg-ink-3/15" },
};

/** Citations by whether their words support the claim. Unsupported is the one judgment that warns. */
export const SUPPORT_PARTS: Record<string, { label: string; className: string }> = {
  human_confirmed: { label: "Supports, checked by a person", className: "bg-sage" },
  human_partial: { label: "Partly, checked by a person", className: "bg-sage/50" },
  ai_supports: { label: "Supports", className: "bg-indigo" },
  ai_partial: { label: "Only partly", className: "bg-indigo/45" },
  ai_unsupported: { label: "Does not support", className: "bg-madder/80" },
  human_rejected: { label: "Does not support, checked by a person", className: "bg-madder" },
  stale: { label: "Judged before a change, needs a new look", className: "bg-turmeric/60" },
  unchecked: { label: "Not judged yet", className: "bg-ink-3/15" },
  no_quote: { label: "Location only, cannot be judged", className: "bg-ink-3/30" },
};

export function partsOf(counts: Record<string | number, number>, spec: Record<string, { label: string; className: string }>): Part[] {
  return Object.entries(spec).map(([key, s]) => ({ key, label: s.label, className: s.className, value: counts[key] ?? 0 }));
}
