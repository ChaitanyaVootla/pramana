import { formatYear } from "@pramana/core";
import { spanLabel } from "@/lib/time";
import { cn } from "@/lib/utils";

export interface Span {
  from: number;
  to: number;
  approximate?: boolean;
}

/**
 * When a source was written, against the events it is cited for, on one
 * axis: the distance between them is the first thing to weigh in a source.
 * A sentence says it in words ("written about 500 years after").
 */
export function WrittenWhen({
  events,
  written,
  edition,
  editionIsWriting,
}: {
  events: Span | null;
  written: Span | null;
  edition: number | null;
  /** Scholarship and reference works are written when published; an edition of an old text is not. */
  editionIsWriting: boolean;
}) {
  const rows: { key: string; label: string; span: Span; tone: string; dates: string }[] = [];
  if (events)
    rows.push({
      key: "events",
      label: "What it is cited for",
      span: events,
      tone: "bg-indigo-tint",
      dates: spanLabel(events.from, events.to, events.approximate),
    });
  if (written)
    rows.push({
      key: "written",
      label: "When it was written",
      span: written,
      tone: "bg-indigo",
      dates: spanLabel(written.from, written.to, written.approximate),
    });
  if (edition !== null && (!written || Math.abs(edition - written.to) > 5))
    rows.push({
      key: "edition",
      label: "This edition",
      span: { from: edition, to: edition + 1 },
      tone: "bg-sandstone",
      dates: formatYear(edition, { era: "auto" }),
    });
  if (rows.length < 2) return null;

  const lo = Math.min(...rows.map((r) => r.span.from));
  const hi = Math.max(...rows.map((r) => r.span.to));
  const pad = Math.max(5, (hi - lo) * 0.05);
  const [a, b] = [lo - pad, Math.max(hi, Math.min(hi + pad, new Date().getFullYear()))];
  const pct = (v: number) => ((v - a) / (b - a)) * 100;
  const writtenAt =
    written ?? (edition !== null && editionIsWriting ? { from: edition, to: edition + 1 } : null);
  const gap = events && writtenAt ? Math.round(writtenAt.from - events.to) : null;
  const sentence =
    gap === null
      ? edition !== null && !editionIsWriting && !written
        ? "We have not recorded when the original was written; the date here is this edition's."
        : null
      : gap <= 10
        ? "Written at the time of the events it is cited for."
        : `Written about ${(gap >= 1000 ? Math.round(gap / 100) * 100 : gap >= 100 ? Math.round(gap / 10) * 10 : gap).toLocaleString("en-GB")} years after the events it is cited for.`;

  // What the gap means for a reader weighing it.
  const meaning =
    gap === null
      ? null
      : gap <= 10
        ? "So it can be a witness's account, told from the writer's own point of view."
        : editionIsWriting && gap > 300
          ? "So it is a modern reading of older evidence: a guide to what the sources mean, not a witness."
          : gap > 300
            ? "So it passes on older traditions; nobody who wrote it saw the events."
            : "So it was written from memory, records or older texts, not by a witness.";

  return (
    <section aria-labelledby="written-h">
      <h2 id="written-h" className="font-sans text-ui font-semibold text-ink">
        Written when?
      </h2>
      {sentence && <p className="mt-1 font-serif text-lg leading-snug text-ink">{sentence}</p>}
      {meaning && <p className="mt-1 font-sans text-note text-ink-2">{meaning}</p>}
      <div className="mt-4 space-y-2 font-sans" role="list">
        {rows.map((r) => (
          <div
            key={r.key}
            role="listitem"
            className="grid grid-cols-1 items-center gap-x-4 gap-y-1 sm:grid-cols-[10rem_minmax(0,1fr)_8rem]"
          >
            <span className="text-sm text-ink-2">{r.label}</span>
            <span className="relative h-2.5 rounded-full bg-rule-soft" aria-hidden>
              <span
                className={cn(
                  "absolute inset-y-0 rounded-full",
                  r.tone,
                  r.span.approximate &&
                    "[mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]",
                )}
                style={{
                  left: `${pct(r.span.from)}%`,
                  width: `max(${pct(r.span.to) - pct(r.span.from)}%, 6px)`,
                }}
              />
            </span>
            <span className="text-sm text-ink tnum sm:text-right">{r.dates}</span>
          </div>
        ))}
      </div>
      <p
        className="mt-2 flex justify-between font-sans text-xs text-ink-3 tnum sm:ml-[11rem] sm:mr-[9rem]"
        aria-hidden
      >
        <span>{formatYear(Math.floor(a), { era: "auto" })}</span>
        <span>{formatYear(Math.ceil(b), { era: "auto" })}</span>
      </p>
    </section>
  );
}
