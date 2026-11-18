import type { AgeStripItem } from "@pramana/services";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STATE_WORDS: Record<AgeStripItem["state"], string> = {
  untouched: "not started",
  begun: "begun",
  read: "a part read in full",
  remembered: "a part remembered later",
};

/**
 * "Where you've been": the written ages of Indian history in time order, one
 * cell each, drawn as the home's age band draws them (docs/visual.md §1): an
 * indigo bar for each written age, and the learner's way through it as a
 * hairline in ink under the bar, as long as the share of its parts studied. The
 * names underneath, and the words for screen readers, say the same.
 */
export function AgesStrip({ ages, begun, spine = 0, className }: { ages: AgeStripItem[]; begun: number; spine?: number; className?: string }) {
  if (!ages.length) return null;
  // The strip holds the written ages; the spine counts every age, written or not, as the era pages' "age 5 of 16" does.
  const ofAll = spine > ages.length ? `; ${spine} ages in all` : "";
  return (
    <section aria-labelledby="ages-strip" className={cn("@container font-sans", className)}>
      <h2 id="ages-strip" className="text-ui font-semibold text-ink">
        {begun ? "Where you have been" : `${ages.length} written ages to explore`}{" "}
        <span className="font-normal text-ink-3 tnum">
          {begun ? `${begun} of ${ages.length} written ages begun${ofAll}` : `each fills in as you begin it${ofAll}`}
        </span>
      </h2>
      {/* In a narrow place the ages wrap (two rows of four on a phone, four rows of two in the deck column), so each name has room to read. */}
      <ol
        className="mt-2 grid grid-cols-2 gap-x-1 gap-y-2 @xs:grid-cols-4 @2xl:grid-cols-[repeat(var(--ages),minmax(0,1fr))] @2xl:gap-y-1"
        style={{ "--ages": ages.length } as React.CSSProperties}
      >
        {ages.map((a) => (
          <li key={a.slug} className="min-w-0">
            <Link href={`/p/${a.slug}`} className="group block no-underline" title={`${a.title}${a.whenLabel ? `, ${a.whenLabel}` : ""}: ${STATE_WORDS[a.state]}`}>
              <span aria-hidden className="block">
                <span className="block h-2.5 rounded-[2px] bg-indigo transition-colors group-hover:bg-indigo-deep dark:group-hover:bg-indigo-tint" />
                {/* Progress is a line in ink under the bar, never a colour of its own (indigo is for years). */}
                <span className="mt-0.5 block h-0.5">
                  {a.state !== "untouched" && a.parts > 0 && (
                    <span
                      className="block h-full rounded-full bg-ink"
                      style={{ width: `${Math.max(6, Math.round((a.partsStudied / a.parts) * 100))}%` }}
                    />
                  )}
                </span>
              </span>
              <span className={cn("mt-1 block text-[0.6875rem] leading-snug break-words hyphens-auto @2xl:text-xs", a.state === "untouched" ? "text-ink-3" : "text-ink-2")}>{a.title.replace(/^The /, "")}</span>
              <span className="sr-only">
                {a.whenLabel ? `, ${a.whenLabel}` : ""}: {STATE_WORDS[a.state]}
                {a.partsStudied ? `, ${a.partsStudied} of ${a.parts} parts studied` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
