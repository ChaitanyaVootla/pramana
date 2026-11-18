import type { VerificationLevel } from "@pramana/core";
import { Check, Circle, X } from "lucide-react";
import Link from "next/link";
import { SEAL_NOT_TRUTH, SEAL_WHY } from "@/lib/labels";
import type { CheckState } from "@/components/pages/checks";
import { cn } from "@/lib/utils";

export interface ChainStep {
  label: string;
  detail: string;
  /** A quieter aside after the detail. */
  note?: string;
  state: CheckState;
  href?: string;
}

/**
 * The chain of evidence at a glance, before the detail: for each source, one
 * line per step from the words to the work, each marked checked or open, read
 * top to bottom like the detailed chain below it.
 */
export function ChainOverview({ rows }: { rows: { key: string; steps: ChainStep[] }[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-5 space-y-4">
      {rows.map((r) => (
        <ol key={r.key} className="field px-4 py-3 font-sans" aria-label="The chain, step by step">
          {r.steps.map((s, i) => {
            const Icon = s.state === "ok" ? Check : s.state === "bad" ? X : Circle;
            const line = (
              <>
                <span className="w-24 shrink-0 text-xs font-medium text-ink-3">{s.label}</span>
                <span className="min-w-0 flex-1 text-sm leading-snug text-ink">
                  {s.detail}
                  {s.note && <span className="text-ink-3">, {s.note}</span>}
                </span>
              </>
            );
            return (
              <li key={i} className="relative flex items-start gap-2.5 py-1">
                <Icon
                  className={cn(
                    "mt-0.5 size-3.5 shrink-0",
                    s.state === "ok"
                      ? "text-indigo"
                      : s.state === "bad"
                        ? "text-madder"
                        : "text-ink-3",
                  )}
                  strokeWidth={s.state === "ok" ? 2.5 : 1.75}
                  aria-hidden
                />
                {s.href ? (
                  <a
                    href={s.href}
                    className="flex min-w-0 flex-1 items-baseline gap-3 no-underline hover:[&>span:last-child]:underline"
                  >
                    {line}
                  </a>
                ) : (
                  <span className="flex min-w-0 flex-1 items-baseline gap-3">{line}</span>
                )}
              </li>
            );
          })}
        </ol>
      ))}
    </div>
  );
}

const LADDER: { level: VerificationLevel; words: string }[] = [
  { level: 1, words: "A source is cited." },
  { level: 2, words: "The quoted words were found in our stored copy of it." },
  { level: 3, words: "An AI reviewer judged that the words say what they are cited for." },
  { level: 4, words: "A person confirmed it." },
];

/** What the four cells of the seal mean, why each step matters, with this claim's step marked. */
export function SealLadder({
  level,
  here = "This claim is here.",
}: {
  level: VerificationLevel;
  here?: string | null;
}) {
  return (
    <div className="font-sans text-sm">
      <ol className="space-y-2">
        {LADDER.map((s) => (
          <li
            key={s.level}
            className={cn("flex items-start gap-2.5", s.level <= level ? "text-ink" : "text-ink-3")}
          >
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-[2px]",
                s.level <= level
                  ? s.level === 4
                    ? "bg-sage"
                    : "bg-indigo"
                  : "border border-ink-3/50",
              )}
              aria-hidden
            />
            <span>
              {s.words}
              {s.level === level && here && (
                <span className="ml-1.5 font-medium text-indigo">{here}</span>
              )}
              <span className="mt-0.5 block text-xs leading-snug text-ink-3">
                {SEAL_WHY[s.level as 0 | 1 | 2 | 3 | 4]}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs leading-snug text-ink-3">{SEAL_NOT_TRUTH}</p>
      <Link
        href="/insights"
        className="mt-2 inline-block text-xs font-medium text-indigo no-underline hover:underline"
      >
        How well sourced is the whole site?
      </Link>
    </div>
  );
}
