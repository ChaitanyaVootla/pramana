import type { EntityCard } from "@pramana/services";
import Link from "next/link";
import { EntityThumb } from "@/components/media";
import { TimeStrip } from "@/components/time/TimeStrip";
import { stripMark } from "@/lib/era";
import { NOW, unitScale } from "@/lib/time";
import { cn } from "@/lib/utils";

/** The first sentence of a description, at most about two lines. */
function firstClause(text: string | null): string | null {
  if (!text) return null;
  const cut = text.split(/(?<=\.)\s/)[0]!;
  return cut.length > 170 ? `${cut.slice(0, 167).replace(/\s+\S*$/, "")}…` : cut;
}

/**
 * The ages of Indian history as an index: one row per age, in order, with
 * where it sits in the whole span (recent centuries get more room, as on the
 * home page), what it was, and whether its page is written yet.
 */
export function AgesIndex({ ages, title }: { ages: EntityCard[]; title?: string }) {
  const start = Math.min(-6999, ...ages.map((a) => a.bounds?.startMin ?? 0));
  const u = unitScale("stretched", start, NOW);
  const written = ages.filter((a) => a.pageSlug).length;
  return (
    <section aria-labelledby="ages-index" className="max-w-none">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="ages-index" className="text-2xl text-ink">
          {title ?? "Ages"}
        </h2>
        <p className="font-sans text-sm text-ink-3 tnum">
          {ages.length} ages, {written} written so far
        </p>
      </div>
      <ol className="mt-4 divide-y divide-rule-soft border-y border-rule-soft">
        {ages.map((a) => {
          const href = a.pageSlug ? `/p/${a.pageSlug}` : `/e/${a.slug}`;
          const deva = a.aliases.find((x) => x.script === "Deva");
          const b = a.bounds;
          const mark = b ? stripMark(b) : null;
          return (
            <li key={a.id}>
              <Link
                href={href}
                className="group grid grid-cols-[minmax(0,1fr)] items-center gap-x-5 gap-y-2 py-4 no-underline sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
              >
                <span className="font-sans text-sm text-ink-3 tnum">
                  {a.whenLabel}
                  {mark !== null && (
                    <TimeStrip
                      within={[0, 1]}
                      mark={typeof mark === "number" ? u(mark) : [u(mark[0]), u(mark[1])]}
                      approximate={b?.approximate}
                      width={128}
                      height={5}
                      className="mt-1.5 block"
                    />
                  )}
                </span>
                <span className="flex min-w-0 items-start gap-3">
                  {a.image && <EntityThumb image={a.image} size={48} decorative />}
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-xl leading-snug group-hover:underline",
                        a.pageSlug ? "text-ink" : "text-ink-2",
                      )}
                    >
                      {a.label}
                      {deva && (
                        <span
                          lang={deva.lang}
                          className="ml-2 font-deva text-base font-normal text-ink-3"
                        >
                          {deva.label}
                        </span>
                      )}
                    </span>
                    {firstClause(a.description) && (
                      <span className="mt-0.5 block font-sans text-note leading-snug text-ink-2">
                        {firstClause(a.description)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="font-sans text-sm sm:text-right">
                  {a.pageSlug ? (
                    <span className="inline-flex items-center gap-1 font-medium text-indigo">
                      Read the page
                    </span>
                  ) : (
                    <span className="text-ink-3">Not written yet</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
