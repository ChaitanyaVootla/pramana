import type { ChapterProgress, PageProgress } from "@pramana/services";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { TimeStrip } from "@/components/time/TimeStrip";
import { ChapterStepsSeal } from "./ChapterProgressSeal";
import { cn } from "@/lib/utils";

/** What a learner has done in a chapter, in words. */
function chapterStatus(c: ChapterProgress): string {
  const parts: string[] = [];
  if (c.guessed) parts.push("guessed");
  if (c.checkItems > 0)
    parts.push(
      c.checked === 0
        ? "not checked yet"
        : `${c.checkedRight} of ${c.checked} right in the check${c.checkItems > c.checked ? `, ${c.checkItems - c.checked} not tried` : ""}`,
    );
  if (c.inDeck > 0) parts.push(`${c.inDeck} of ${c.claims} in your reviews`);
  return parts.length ? parts.join(", ") : c.due > 0 ? "" : "not started";
}

/**
 * Each era as one compact row: a strip with a cell per part (filled once its
 * check is answered, tinted once guessed or in your reviews), and a line of
 * words. Opening a row lists the parts, each placed in the era's time span.
 */
export function StudyMap({ pages, known = {} }: { pages: PageProgress[]; known?: Record<string, { known: number; inDeck: number; due: number }> }) {
  return (
    <div className="divide-y divide-rule-soft border-y border-rule-soft">
      {pages.map((p) => {
        const within: [number, number] | null =
          p.bounds && p.bounds.startMin !== null ? [p.bounds.startMin, p.bounds.endMax ?? p.bounds.startMin + 1] : null;
        const checked = p.chapters.filter((c) => c.checked > 0).length;
        const k = known[p.slug];
        const summary = [
          checked ? `${checked} of ${p.chapters.length} parts checked` : p.visited ? `${p.chapters.length} parts, none checked yet` : `${p.chapters.length} parts to explore`,
          ...(k && k.inDeck ? [`${k.known} of ${k.inDeck} ${k.inDeck === 1 ? "card" : "cards"} remembered`] : []),
        ].join(", ");
        const due = k?.due ?? p.chapters.reduce((a, c) => a + c.due, 0);
        return (
          <details key={p.slug} className="group py-3">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1.5 font-sans [&::-webkit-details-marker]:hidden">
              <span className="min-w-[12rem] flex-1">
                <span className="font-heading text-lg text-ink">{p.title}</span>
                {p.whenLabel && <span className="ml-2 text-sm text-ink-3 tnum">{p.whenLabel}</span>}
                <span className="block text-sm text-ink-3">
                  {summary}
                  {due > 0 && <span className="font-medium text-indigo">, {due} due</span>}
                </span>
              </span>
              <span className="flex gap-0.5" aria-hidden>
                {p.chapters.map((c) => (
                  <span
                    key={c.id}
                    className={cn("h-2.5 w-4 rounded-[2px]", c.checked > 0 ? "bg-ink-2" : c.guessed || c.inDeck > 0 ? "bg-ink-3" : "bg-rule")}
                  />
                ))}
              </span>
              <ChevronDown className="size-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <ol className="mt-2 divide-y divide-rule-soft font-sans text-ui">
              {p.chapters.map((c, i) => {
                const mark: [number, number] | null =
                  c.bounds && c.bounds.startMin !== null ? [c.bounds.startMin, c.bounds.endMax ?? c.bounds.startMin] : null;
                const active = c.guessed || c.checked > 0 || c.inDeck > 0;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/p/${p.slug}#${c.id}`}
                      className="grid grid-cols-[1.5rem_3rem_minmax(0,1fr)] items-baseline gap-x-2 py-2 no-underline hover:bg-rule-soft/40 sm:grid-cols-[1.5rem_3rem_minmax(0,1fr)_auto]"
                    >
                      <span className="text-ink-3 tnum">{i + 1}.</span>
                      <span className="self-center">{within && mark ? <TimeStrip within={within} mark={mark} /> : null}</span>
                      <span className={cn("flex items-baseline gap-2", active ? "text-ink" : "text-ink-2")}>
                        <ChapterStepsSeal steps={c.steps} className="translate-y-px" />
                        {c.title}
                      </span>
                      <span className="col-start-3 text-sm text-ink-3 sm:col-start-4 sm:text-right">
                        {chapterStatus(c)}
                        {c.due > 0 && (
                          <span className="font-medium text-indigo">
                            {chapterStatus(c) ? ", " : ""}
                            {c.due} due
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
