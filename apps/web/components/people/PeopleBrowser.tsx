"use client";

import { formatYear } from "@pramana/core";
import type { EntityCard } from "@pramana/services";
import Link from "next/link";
import { useMemo, useState } from "react";
import { initialOf } from "@/lib/names";
import { EntityThumb } from "@/components/media";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface PeopleAge {
  id: string;
  label: string;
  whenLabel: string | null;
  from: number;
  to: number;
  pageSlug: string | null;
}

interface Bar {
  role: string;
  from: number;
  to: number;
  approximate: boolean;
  label: string;
}

interface Row {
  person: EntityCard;
  bars: Bar[];
  from: number;
  to: number;
  age: string | null;
  /** Linked to a state that is not an age of Indian history (Sargon, Alexander): met here, from elsewhere. */
  elsewhere: string | null;
}

const ROLE_WORDS: Record<string, string> = {
  reign: "reigned",
  life: "lived",
  floruit: "active",
  activity: "active",
};

/** A person's reign and life (or whatever spans they have), as bars. */
function barsOf(p: EntityCard): Bar[] {
  const spans = (p.spans ?? []).filter((s) => s.bounds.startMin !== null && s.role in ROLE_WORDS);
  const bars = spans.map((s) => ({
    role: s.role,
    from: s.bounds.startMin!,
    to: s.bounds.endMax ?? s.bounds.startMin! + 1,
    approximate: s.bounds.approximate,
    label: `${ROLE_WORDS[s.role]} ${s.label.replace(/^(reigned|lived|born|died)\s+/i, "")}`,
  }));
  if (bars.length) return bars;
  if (p.bounds?.startMin == null) return [];
  return [
    {
      role: "when",
      from: p.bounds.startMin,
      to: p.bounds.endMax ?? p.bounds.startMin + 1,
      approximate: p.bounds.approximate,
      label: p.whenLabel ?? "",
    },
  ];
}

/**
 * The age a reader would meet this person in: of the ages on the spine that
 * contain the middle of their span, one with a page first, then the shortest.
 */
function ageOf(from: number, to: number, ages: PeopleAge[]): string | null {
  const mid = (from + to) / 2;
  const holding = ages
    .filter((a) => a.from <= mid && a.to >= mid)
    .sort(
      (a, b) =>
        Number(Boolean(b.pageSlug)) - Number(Boolean(a.pageSlug)) ||
        a.to - a.from - (b.to - b.from),
    );
  return holding[0]?.id ?? null;
}

/** Ticks at round historical years (3000 BCE, 2500 BCE, 1 CE…), returned as astronomical positions. */
function ticks(from: number, to: number, count: number): number[] {
  const raw = (to - from) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const toHist = (astro: number) => (astro <= 0 ? astro - 1 : astro);
  const out: number[] = [];
  for (let h = Math.ceil(toHist(from) / step) * step; h <= toHist(to); h += step) {
    if (h === 0) continue;
    out.push(h < 0 ? h + 1 : h);
  }
  return out;
}

/**
 * Everyone the pages mention, grouped by the age you would meet them in,
 * each group on its own line of time so contemporaries line up. Reigns are
 * solid, lives faint; approximate ends fade. Filter to one age.
 */
export function PeopleBrowser({
  people,
  ages,
  affiliations = {},
}: {
  people: EntityCard[];
  ages: PeopleAge[];
  /** Person id → the states, ages and cultures they are linked to. */
  affiliations?: Record<string, { id: string; kind: string; label: string }[]>;
}) {
  const [filter, setFilter] = useState<string>("all");
  const rows = useMemo<Row[]>(
    () =>
      people
        .map((person) => {
          const bars = barsOf(person);
          if (!bars.length) return null;
          const from = Math.min(...bars.map((b) => b.from));
          const to = Math.max(...bars.map((b) => b.to));
          // A person linked to an age on the spine is met there; one linked only to other states
          // (Akkad, Macedonia) is met in the age of their time, marked as from elsewhere.
          const links = affiliations[person.id] ?? [];
          const own = ages.find((a) => links.some((l) => l.id === a.id));
          const foreign = !own && links.length ? links[0]!.label : null;
          return {
            person,
            bars,
            from,
            to,
            age: own?.id ?? ageOf(from, to, ages),
            elsewhere: foreign,
          };
        })
        .filter((r): r is Row => r !== null)
        .sort((a, b) => a.from - b.from),
    [people, ages, affiliations],
  );
  const undated = people.filter((p) => !rows.some((r) => r.person.id === p.id));
  const groups = useMemo(() => {
    const out: { age: PeopleAge | null; rows: Row[] }[] = [];
    for (const a of ages) {
      const rs = rows.filter((r) => r.age === a.id);
      if (rs.length) out.push({ age: a, rows: rs });
    }
    const rest = rows.filter((r) => !r.age);
    if (rest.length) out.push({ age: null, rows: rest });
    return out;
  }, [rows, ages]);
  const shown = filter === "all" ? groups : groups.filter((g) => (g.age?.id ?? "other") === filter);

  return (
    <div>
      {groups.length > 1 && (
        <ToggleGroup
          value={[filter]}
          onValueChange={(v) => setFilter((v as string[])[0] ?? "all")}
          aria-label="Show people from one age"
          className="flex-wrap justify-start gap-1.5"
        >
          <ToggleGroupItem
            value="all"
            className="h-7 rounded-sm border border-rule bg-paper px-2.5 font-sans text-xs font-medium text-ink-2 data-[pressed]:border-transparent data-[pressed]:bg-indigo-wash data-[pressed]:text-indigo"
          >
            Everyone <span className="ml-1.5 text-ink-3 tnum">{rows.length}</span>
          </ToggleGroupItem>
          {groups.map((g) => (
            <ToggleGroupItem
              key={g.age?.id ?? "other"}
              value={g.age?.id ?? "other"}
              className="h-7 rounded-sm border border-rule bg-paper px-2.5 font-sans text-xs font-medium text-ink-2 data-[pressed]:border-transparent data-[pressed]:bg-indigo-wash data-[pressed]:text-indigo"
            >
              {g.age?.label ?? "Other times"}{" "}
              <span className="ml-1.5 text-ink-3 tnum">{g.rows.length}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}

      <div className="mt-5 space-y-8">
        {shown.map((g) => (
          <Group key={g.age?.id ?? "other"} age={g.age} rows={g.rows} />
        ))}
      </div>

      {undated.length > 0 && filter === "all" && (
        <section className="mt-12" aria-labelledby="undated-h">
          <h2 id="undated-h" className="text-xl text-ink">
            Without dates yet
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 font-sans text-ui">
            {undated.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/e/${p.slug}`}
                  className="inline-flex min-h-8 items-center gap-2 rounded-sm border border-rule bg-paper px-2 text-sm no-underline hover:border-ink-3/60"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Group({ age, rows: all }: { age: PeopleAge | null; rows: Row[] }) {
  // People born long after the age (its excavators and scholars) are listed apart, so the line of
  // time is the age's own and not 3000 BCE to 2000 CE.
  const later = age ? all.filter((r) => r.from > age.to + 50) : [];
  const rows = all.filter((r) => !later.includes(r));
  if (!rows.length) return <Studied age={age} rows={later} alone />;
  const lo = Math.min(...rows.map((r) => r.from), age?.from ?? Infinity);
  const hi = Math.max(...rows.map((r) => r.to), age?.to ?? -Infinity);
  const pad = Math.max(5, (hi - lo) * 0.03);
  const [a, b] = [lo - pad, hi + pad];
  const pct = (v: number) => ((v - a) / (b - a)) * 100;
  const marks = ticks(a, b, 6);
  return (
    <section className="border-t border-rule pt-3" aria-labelledby={`age-${age?.id ?? "other"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`age-${age?.id ?? "other"}`} className="text-xl text-ink">
          {age ? (
            age.pageSlug ? (
              <Link href={`/p/${age.pageSlug}`} className="no-underline hover:underline">
                {age.label}
              </Link>
            ) : (
              age.label
            )
          ) : (
            "Other times"
          )}
          {age?.whenLabel && (
            <span className="ml-3 font-sans text-sm text-ink-3 tnum">{age.whenLabel}</span>
          )}
        </h2>
        <span className="font-sans text-sm text-ink-3 tnum">
          {all.length} {all.length === 1 ? "person" : "people"}
        </span>
      </header>

      <div className="pt-1 pb-2">
        {/* The axis: on wide screens beside the names, on phones under each name. */}
        <div
          className="relative hidden h-6 font-sans text-xs text-ink-3 tnum md:ml-[16.75rem] md:block"
          aria-hidden
        >
          {marks.map((t) => (
            <span
              key={t}
              className="absolute top-1 -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct(t)}%` }}
            >
              {formatYear(t, { era: "auto" })}
            </span>
          ))}
        </div>
        <ol className="relative">
          {rows.map((r) => (
            <PersonRow key={r.person.id} row={r} pct={pct} marks={marks} age={age} />
          ))}
        </ol>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-ink-3 md:ml-[16.75rem]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-indigo" aria-hidden /> reign, or life when
            that is all we have
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-4 rounded-full bg-indigo-tint" aria-hidden /> lifetime of a
            ruler
          </span>
          {age && (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-4 rounded-[2px] bg-indigo-wash ring-1 ring-indigo-tint/60"
                aria-hidden
              />{" "}
              {age.label}
            </span>
          )}
          <span className="md:hidden">
            {formatYear(Math.floor(a), { era: "auto" })} to{" "}
            {formatYear(Math.ceil(b), { era: "auto" })}
          </span>
        </p>
      </div>
      {later.length > 0 && <Studied age={age} rows={later} />}
    </section>
  );
}

/** Who found and studied the age, long after it: names and dates, without a shared line of time. */
function Studied({
  age,
  rows,
  alone = false,
}: {
  age: PeopleAge | null;
  rows: Row[];
  alone?: boolean;
}) {
  const list = (
    <div className={cn("px-5 pb-4 font-sans", !alone && "border-t border-rule-soft pt-3")}>
      <h3 className="font-sans text-xs font-medium text-ink-3">Who found and studied it</h3>
      <ul className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <li key={r.person.id}>
            <Link
              href={`/e/${r.person.slug}`}
              className="text-ui text-ink no-underline hover:underline"
            >
              {r.person.label}
            </Link>
            <span className="ml-2 text-xs text-ink-3 tnum">
              {r.bars.map((b) => b.label).join("; ")}
            </span>
            {r.person.description && (
              <span className="block line-clamp-1 text-sm text-ink-2">{r.person.description}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
  if (!alone) return list;
  return (
    <section className="border-t border-rule pt-3" aria-labelledby={`age-${age?.id ?? "other"}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`age-${age?.id ?? "other"}`} className="text-xl text-ink">
          {age?.pageSlug ? (
            <Link href={`/p/${age.pageSlug}`} className="no-underline hover:underline">
              {age.label}
            </Link>
          ) : (
            (age?.label ?? "Other times")
          )}
          {age?.whenLabel && (
            <span className="ml-3 font-sans text-sm text-ink-3 tnum">{age.whenLabel}</span>
          )}
        </h2>
        <span className="font-sans text-sm text-ink-3 tnum">
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </span>
      </header>
      <div className="pt-3">{list}</div>
    </section>
  );
}

function PersonRow({
  row: r,
  pct,
  marks,
  age,
}: {
  row: Row;
  pct: (v: number) => number;
  marks: number[];
  age: PeopleAge | null;
}) {
  const p = r.person;
  const initial = initialOf(p);
  const bars = [...r.bars].sort((x, y) => Number(x.role === "reign") - Number(y.role === "reign"));
  const title = r.bars.map((b) => b.label).join("; ");
  return (
    <li>
      <Link
        href={`/e/${p.slug}`}
        className="group grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-md py-2 no-underline transition-colors hover:bg-rule-soft/50 md:grid-cols-[2.5rem_12.75rem_minmax(0,1fr)]"
        title={`${p.label}: ${title}`}
      >
        {p.image ? (
          <EntityThumb image={p.image} size={40} decorative />
        ) : (
          <span
            className="flex size-10 items-center justify-center rounded-md bg-indigo-wash font-heading text-lg text-indigo"
            lang={initial.lang}
            aria-hidden
          >
            {initial.char}
          </span>
        )}
        <span className="min-w-0 font-sans">
          <span className="block truncate text-ui font-medium text-ink group-hover:underline">
            {p.label}
          </span>
          {/* The meta line wraps rather than cutting off a date. */}
          <span className="block text-xs leading-snug text-ink-3 tnum">
            {r.elsewhere && <span className="text-ink-2">From {r.elsewhere}, </span>}
            {title}
          </span>
        </span>
        <span className="relative col-span-2 h-4 md:col-span-1" aria-hidden>
          {age && (
            <span
              className="absolute inset-y-0 rounded-[2px] bg-indigo-wash"
              style={{ left: `${pct(age.from)}%`, width: `${pct(age.to) - pct(age.from)}%` }}
            />
          )}
          {marks.map((t) => (
            <span
              key={t}
              className="absolute inset-y-0 w-px bg-rule-soft"
              style={{ left: `${pct(t)}%` }}
            />
          ))}
          {bars.map((b, i) => (
            <span
              key={i}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 rounded-full",
                b.role === "life" && bars.length > 1 ? "h-1.5 bg-indigo-tint" : "h-2.5 bg-indigo",
                b.approximate &&
                  "[mask-image:linear-gradient(90deg,transparent,black_15%,black_85%,transparent)]",
              )}
              style={{ left: `${pct(b.from)}%`, width: `max(${pct(b.to) - pct(b.from)}%, 4px)` }}
            />
          ))}
        </span>
      </Link>
    </li>
  );
}
