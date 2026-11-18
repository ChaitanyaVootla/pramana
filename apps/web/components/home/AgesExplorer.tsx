"use client";

import { formatYear, type AtlasSpec, type Representation, type VerificationLevel } from "@pramana/core";
import type { MapFeature, TimelineItem } from "@pramana/services";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { Atlas } from "@/components/atlas/Atlas";
import { AtlasProvider, useAtlasBus } from "@/components/atlas/bus";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { CommonsImage, ImaginingTag, type ImageFile } from "@/components/media/image";
import { useWidth } from "@/components/time/useTimeWindow";
import { NOW, unitScale } from "@/lib/time";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

export interface Age {
  id: string;
  slug: string;
  label: string;
  deva: string | null;
  whenLabel: string | null;
  from: number;
  to: number;
  approximate: boolean;
  description: string | null;
  /** The age's own page, when it has one. */
  page: { slug: string; claims: number } | null;
}

/** How far the learner has got through a written age (from agesStrip). */
export interface AgeProgress {
  state: "untouched" | "begun" | "read" | "remembered";
  partsStudied: number;
  parts: number;
}

/** What an age's page holds, for the column beside the map: a picture, who and where, two claims. */
export interface AgeDetail {
  image: (ImageFile & { attribution: string; representation: Representation }) | null;
  people: { slug: string; label: string }[];
  places: { slug: string; label: string }[];
  claims: { id: string; text: string; level: VerificationLevel }[];
}

const STATE_WORDS: Record<AgeProgress["state"], string> = {
  untouched: "not started",
  begun: "begun",
  read: "a part read in full",
  remembered: "a part remembered later",
};

const LANE = 30;
/** Astronomical years (-6999 is 7000 BCE). */
const TICKS = [-6999, -2999, -1499, -499, 1, 500, 1000, 1500, 1900];
const labelWidth = (label: string) => label.length * 6.4 + 14;

/**
 * The home page's way in: every age of Indian history on one band, and the
 * atlas below it. Picking an age shows its borders (when we have them, from
 * 600 BCE) and what it is; moving the atlas's year shows which age that was.
 */
export function AgesExplorer(props: {
  ages: Age[];
  places: MapFeature[];
  timeline: TimelineItem[];
  pageByEntity: Record<string, string>;
  spec: AtlasSpec;
  /** The learner's progress by page slug, drawn under each age's bar. */
  progress?: Record<string, AgeProgress>;
  /** Each written age's picture, people, places and two claims, by age id. */
  details?: Record<string, AgeDetail>;
  /** The overview page ("How the ages are drawn"). */
  overviewHref?: string | null;
}) {
  return (
    <AtlasProvider initialYear={props.spec.initialYear ?? null}>
      <Explorer {...props} />
    </AtlasProvider>
  );
}

function Explorer({
  ages,
  places,
  timeline,
  pageByEntity,
  spec,
  progress = {},
  details = {},
  overviewHref = null,
}: Parameters<typeof AgesExplorer>[0]) {
  const bus = useAtlasBus();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [picked, setPicked] = useState<string | null>(null);
  const range = spec.range ?? [-600, 1950];
  const year = bus.year ?? spec.initialYear ?? null;

  // The age being shown: the one picked, else the ones the atlas year falls in.
  const current = useMemo(() => {
    if (picked) return ages.filter((a) => a.id === picked);
    if (year === null) return [];
    return ages.filter((a) => a.from <= year && a.to >= year);
  }, [ages, picked, year]);

  const pick = (a: Age) => {
    setPicked(a.id);
    if (a.to >= range[0] && a.from <= range[1]) {
      const mid = Math.floor((Math.max(a.from, range[0]) + Math.min(a.to, range[1])) / 2);
      bus.setYear(mid, { fromReader: true });
    }
  };

  return (
    <div className="grid gap-4">
      {/* Phones get the compact age line at the top of the page instead of this band's stacked lanes. */}
      <div className="hidden md:block">
        <AgesBand
          ages={ages}
          year={year}
          range={range}
          active={new Set(current.map((a) => a.id))}
          onPick={pick}
          progress={progress}
          overviewHref={overviewHref}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="min-w-0 rounded-md border border-rule bg-paper p-2 sm:p-3">
          <Atlas
            spec={spec}
            span={null}
            places={places}
            timeline={timeline}
            pageByEntity={pageByEntity}
            variant={desktop ? "full" : "inline"}
            showTimeline={false}
            mapHeightClass="h-[280px] lg:h-[560px]"
          />
        </div>
        <aside aria-live="polite" className="min-w-0">
          <div
            key={current.map((a) => a.id).join(",") || "none"}
            className="animate-in fade-in grid gap-5 duration-200"
          >
            {current.length ? (
              current
                .slice(0, 2)
                .map((a, i) => (
                  <AgeCard
                    key={a.id}
                    age={a}
                    progress={a.page ? progress[a.page.slug] : undefined}
                    detail={i === 0 ? details[a.id] : undefined}
                  />
                ))
            ) : (
              <p className="border-t border-rule pt-3 font-sans text-note text-ink-2">
                {year !== null
                  ? `No age on our spine covers ${formatYear(year)} yet.`
                  : "Pick an age on the band above."}
              </p>
            )}
            {picked && (
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="justify-self-start font-sans text-sm text-ink-3 hover:text-ink hover:underline"
              >
                Follow the map&apos;s year instead
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * The age at the map's year, beside the map: its picture, who and where, two
 * claims with their seals, and the way in. Type and rules, no box.
 */
function AgeCard({ age, progress, detail }: { age: Age; progress?: AgeProgress; detail?: AgeDetail }) {
  return (
    <article className="border-t border-rule pt-3">
      {detail?.image && (
        <Link
          href={age.page ? `/p/${age.page.slug}` : `/e/${age.slug}`}
          className="relative mb-3 block aspect-[16/9] overflow-hidden rounded-md bg-field"
          aria-label={`${age.label}: open the page`}
        >
          {/* The page's largest paint on wide screens: fetched at once, at most 960px wide. */}
          <CommonsImage file={detail.image} fill eager max={960} sizes="(min-width: 1024px) 30rem, 100vw" />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
          <ImaginingTag representation={detail.image.representation} className="absolute top-2 left-2" />
          <span className="absolute right-2.5 bottom-1.5 left-2.5 truncate text-right font-sans text-[0.6875rem] text-white/85">
            {detail.image.attribution}
          </span>
        </Link>
      )}
      <p className="font-sans text-sm text-ink-3 tnum">{age.whenLabel}</p>
      <h3 className="mt-0.5 text-2xl leading-tight text-ink">
        {age.label}
        {age.deva && (
          <span lang="hi" className="ml-2 font-deva text-2xl text-ink-2">
            {age.deva}
          </span>
        )}
      </h3>
      {age.description && (
        <p className="mt-2 font-sans text-note leading-snug text-ink-2">{age.description}</p>
      )}
      {detail && (detail.people.length > 0 || detail.places.length > 0) && (
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-sans text-sm">
          {detail.people.length > 0 && (
            <>
              <dt className="text-ink-3">People</dt>
              <dd className="min-w-0 text-ink-2">
                {detail.people.map((p, i) => (
                  <Fragment key={p.slug}>
                    {i > 0 && ", "}
                    <Link href={`/e/${p.slug}`} className="text-ink no-underline hover:text-indigo hover:underline">
                      {p.label}
                    </Link>
                  </Fragment>
                ))}
              </dd>
            </>
          )}
          {detail.places.length > 0 && (
            <>
              <dt className="text-ink-3">Places</dt>
              <dd className="min-w-0 text-ink-2">
                {detail.places.map((p, i) => (
                  <Fragment key={p.slug}>
                    {i > 0 && ", "}
                    <Link href={`/e/${p.slug}`} className="text-sandstone-ink no-underline hover:underline">
                      {p.label}
                    </Link>
                  </Fragment>
                ))}
              </dd>
            </>
          )}
        </dl>
      )}
      {detail && detail.claims.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {detail.claims.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              <EvidenceSeal level={c.level} className="mt-1.5" />
              <Link href={`/c/${c.id}`} className="font-serif text-note leading-snug text-ink no-underline hover:text-indigo">
                {c.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {age.page ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 font-sans">
          <Link
            href={`/p/${age.page.slug}`}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3.5 text-ui font-medium text-primary-foreground no-underline transition-colors hover:bg-[color-mix(in_oklch,var(--primary),var(--indigo-deep)_35%)]"
          >
            <BookOpen className="size-4" aria-hidden /> Read the page
          </Link>
          <span className="text-sm text-ink-3 tnum">
            {age.page.claims} claims
            {progress && progress.state !== "untouched"
              ? `, ${progress.partsStudied} of ${progress.parts} parts studied`
              : ""}
          </span>
        </p>
      ) : (
        <p className="mt-3 font-sans text-sm text-ink-3">
          No page yet.{" "}
          <Link href={`/e/${age.slug}`} className="text-indigo no-underline hover:underline">
            What we have
          </Link>
        </p>
      )}
    </article>
  );
}

/**
 * The band's scale: the stretched scale, then each written age's span widened to hold its name (plus a
 * little air), the remaining years compressed in proportion. Piecewise linear, so the cursor and the ticks
 * read from the same function. Unwritten ages keep their natural share.
 */
function roomScale(base: (year: number) => number, ages: Age[], widthPx: number): (year: number) => number {
  const written = ages.filter((a) => a.page && a.to > a.from);
  if (!written.length || widthPx <= 0) return base;
  const stops = [...new Set([NOW, ...written.flatMap((a) => [a.from, a.to])])].sort((x, y) => x - y);
  const first = Math.min(...ages.map((a) => a.from), -7000);
  if (stops[0]! > first) stops.unshift(first);
  // Each segment's length under the base scale, stretched where a written age needs the room.
  const lengths = stops.slice(1).map((to, i) => {
    const from = stops[i]!;
    const natural = Math.max(0, base(to) - base(from));
    let factor = 1;
    for (const a of written) {
      if (a.from <= from && a.to >= to) {
        const span = Math.max(1e-6, base(a.to) - base(a.from));
        factor = Math.max(factor, (labelWidth(a.label) + 12) / widthPx / span);
      }
    }
    return natural * factor;
  });
  const total = lengths.reduce((s, l) => s + l, 0) || 1;
  const positions = [0];
  for (const l of lengths) positions.push(positions[positions.length - 1]! + l / total);
  return (year: number) => {
    if (year <= stops[0]!) return base(year) < 0 ? base(year) : 0;
    if (year >= stops[stops.length - 1]!) return 1 + (base(year) - 1);
    let i = 1;
    while (i < stops.length - 1 && stops[i]! < year) i++;
    const a = stops[i - 1]!;
    const b = stops[i]!;
    return positions[i - 1]! + ((year - a) / (b - a)) * (positions[i]! - positions[i - 1]!);
  };
}

/** Every age on one stretched band (recent centuries get more room), packed into lanes so overlaps stay readable. */
/**
 * Each age's lane and where its label goes, packed at `packW` pixels: a label
 * that does not fit inside its bar sits just after it (or, at the right edge,
 * before it), and the lane keeps room for it.
 */
function packAges(ages: Age[], u: (t: number) => number, packW: number) {
  const ends: number[] = [];
  return [...ages]
    .sort((a, b) => a.from - b.from)
    .map((a) => {
      const p0 = u(a.from) * packW;
      const p1 = Math.max(p0 + 6, u(a.to) * packW);
      const lw = labelWidth(a.label);
      const side: "inside" | "after" | "before" =
        p1 - p0 >= lw ? "inside" : p1 + 4 + lw <= packW ? "after" : "before";
      const packLeft = side === "before" ? Math.max(0, p0 - 4 - lw) : p0;
      let lane = ends.findIndex((e) => e + 4 <= packLeft);
      if (lane < 0) lane = ends.length;
      ends[lane] = side === "after" ? p1 + 4 + lw : p1;
      return { a, lane, side };
    });
}

function AgesBand({
  ages,
  year,
  range,
  active,
  onPick,
  progress,
  overviewHref,
}: {
  ages: Age[];
  year: number | null;
  range: [number, number];
  active: Set<string>;
  onPick: (a: Age) => void;
  progress: Record<string, AgeProgress>;
  overviewHref: string | null;
}) {
  const [ref, width, measured] = useWidth<HTMLDivElement>(1200);
  const start = Math.min(-7000, ...ages.map((a) => a.from));
  // The stretched scale gives recent centuries more room; on top of it every written age is guaranteed a
  // bar at least as wide as its name (the Maurya Empire was a 50px sliver), the rest giving way a little.
  const u = useMemo(() => roomScale(unitScale("stretched", start, NOW), ages, Math.min(width, 1200)), [start, ages, width]);

  // Rows are packed at a width of at most 1200px; wider screens only add room.
  const placed = useMemo(() => packAges(ages, u, Math.min(width, 1200)), [ages, u, width]);
  // Before the band is measured (the server's render) its height is reserved for the lanes a
  // phone or a wide screen will need, so the atlas below doesn't jump when it is.
  const reserved = useMemo(() => {
    const lanesAt = (w: number) => {
      const p = packAges(ages, roomScale(unitScale("stretched", start, NOW), ages, w), w);
      return Math.max(1, ...p.map((x) => x.lane + 1)) * LANE + 18 + 24;
    };
    return { "--band-phone": `${lanesAt(358)}px`, "--band-wide": `${lanesAt(1200)}px` } as CSSProperties;
  }, [ages, start]);
  // Tick labels are about 60px wide and kept 24px from the edges: drop any that would touch.
  const ticks = useMemo(() => {
    const at = (t: number) => Math.min(width - 24, Math.max(24, u(t) * width));
    const out: number[] = [];
    for (const t of TICKS)
      if (t >= start && (!out.length || at(t) - at(out.at(-1)!) > 72)) out.push(t);
    return out;
  }, [start, u, width]);
  const lanes = Math.max(1, ...placed.map((p) => p.lane + 1));

  const anyProgress = ages.some((a) => a.page && progress[a.page.slug]?.state !== "untouched" && progress[a.page.slug]);
  return (
    <div>
      <div
        ref={ref}
        className={cn("relative font-sans", !measured && "h-(--band-phone) sm:h-(--band-wide)")}
        style={measured ? { height: lanes * LANE + 18 + 24 } : reserved}
      >
        {/* The years the atlas can show. */}
        <div
          className="absolute top-4 rounded-sm bg-sandstone-wash"
          style={{
            left: `${u(range[0]) * 100}%`,
            width: `${(u(range[1]) - u(range[0])) * 100}%`,
            height: lanes * LANE + 4,
          }}
          aria-hidden
        />
        {/* Positions are percentages, so the band is right before it is measured. */}
        {placed.map(({ a, lane, side }) => {
          const on = active.has(a.id);
          const prog = a.page ? progress[a.page.slug] : undefined;
          const studied = prog && prog.state !== "untouched" ? prog : undefined;
          const name = `${a.label}${a.whenLabel ? `, ${a.whenLabel}` : ""}`;
          const l = u(a.from) * 100;
          const r = Math.max(u(a.to) * 100, l);
          const top = lane * LANE + 18;
          return (
            <Fragment key={a.id}>
              <button
                type="button"
                onClick={() => onPick(a)}
                title={`${name}${studied ? `: ${STATE_WORDS[studied.state]}, ${studied.partsStudied} of ${studied.parts} parts studied` : ""}`}
                aria-label={`${name}${a.page ? ", has a page" : ""}${studied ? `, ${STATE_WORDS[studied.state]}` : ""}`}
                aria-pressed={on}
                className={cn(
                  "absolute flex h-6 items-center overflow-hidden rounded-sm px-1.5 text-left text-xs font-medium whitespace-nowrap transition-[box-shadow,background-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  a.page
                    ? "bg-indigo text-white hover:bg-indigo/90 dark:text-chuna"
                    : "bg-indigo-tint text-ink hover:bg-indigo-tint/80",
                  on && "ring-2 ring-ink ring-offset-1 ring-offset-chuna",
                )}
                style={{ left: `${l}%`, width: `${r - l}%`, minWidth: 6, top }}
              >
                {side === "inside" ? a.label : ""}
                {/* The learner's way through the age: an ink line along the bottom of its bar. */}
                {studied && studied.parts > 0 && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-[3px] bg-white/90 dark:bg-chuna/90"
                    style={{ width: `${Math.round((studied.partsStudied / studied.parts) * 100)}%` }}
                  />
                )}
              </button>
              {side !== "inside" && (
                <span
                  aria-hidden
                  onClick={() => onPick(a)}
                  className={cn(
                    "absolute flex h-6 cursor-pointer items-center text-xs font-medium whitespace-nowrap text-ink-2 hover:text-ink",
                    on && "text-ink",
                  )}
                  style={
                    side === "after"
                      ? { left: `calc(${r}% + 4px)`, top }
                      : { right: `calc(${100 - l}% + 4px)`, top }
                  }
                >
                  {a.label}
                </span>
              )}
            </Fragment>
          );
        })}
        {year !== null && year >= start && (
          <div
            className="pointer-events-none absolute top-0 w-px bg-ink transition-[left] duration-200"
            style={{ left: `${u(year) * 100}%`, height: lanes * LANE + 20 }}
            aria-hidden
          >
            <span className="absolute top-0 left-1 rounded-sm bg-ink px-1 text-[0.6875rem] leading-4 font-medium whitespace-nowrap text-chuna tnum">
              {formatYear(year, { era: "auto" })}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-5 text-xs text-ink-3 tnum" aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `clamp(24px, ${u(t) * 100}%, calc(100% - 24px))` }}
            >
              {formatYear(t, { era: "auto" })}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 font-sans text-xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-indigo" aria-hidden /> has a page
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[2px] bg-indigo-tint" aria-hidden /> not written yet
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[2px] bg-sandstone-wash ring-1 ring-sandstone/30"
            aria-hidden
          />{" "}
          years with borders on the map
        </span>
        {anyProgress && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[3px] w-3 bg-ink/70 dark:bg-white/80" aria-hidden /> how far you have got
          </span>
        )}
        <span>Recent centuries get more room.</span>
        {overviewHref && (
          <Link href={overviewHref} className="ml-auto text-ink-3 no-underline hover:text-ink hover:underline">
            How the ages are drawn
          </Link>
        )}
      </p>
    </div>
  );
}
