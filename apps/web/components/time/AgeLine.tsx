import Link from "next/link";
import type { Age, AgeProgress } from "@/components/home/AgesExplorer";
import { formatYear } from "@pramana/core";
import { NOW, unitScale } from "@/lib/time";
import { cn } from "@/lib/utils";
import { AgeLineLive } from "./AgeLineLive";

/**
 * The line is time (docs/visual.md §1): the home's age band carried through
 * as one slim rule at the head of era and entity pages, and first on the phone
 * home. Every age is a segment on the stretched scale (written ages indigo,
 * the rest tinted; a learner's way through an age as a hairline under it),
 * the age this page belongs to is lit and named, and a cursor marks the
 * subject's own date. Each segment links to its page; the ends link back to
 * the home band. Orientation, not decoration: no motion, nothing follows the
 * scroll. A server component: positions are percentages. On a page with an
 * atlas, the cursor is the map's year and the lit age sets it (AgeLineLive).
 */
export function AgeLine({
  ages,
  focus = null,
  mark = null,
  markLabel,
  progress = {},
  position,
  indexHref,
  size = "slim",
  onPick,
  canPick = () => true,
  className,
}: {
  ages: Age[];
  /** The age this page belongs to (its entity id or slug): lit and named. */
  focus?: string | null;
  /** The subject's own date, as an astronomical year or a span; drawn as the cursor. */
  mark?: number | [number, number] | null;
  /** Words for the cursor ("c. 268–232 BCE"). Default: the year(s). */
  markLabel?: string;
  /** How far the learner has got in each written age, by page slug. */
  progress?: Record<string, AgeProgress>;
  /** The lit age's place in the spine ("age 5 of 16"), linked to `indexHref` (the overview page). */
  position?: { index: number; total: number };
  indexHref?: string;
  /** `slim` for page heads (36px); `compact` for phones (24px, the cursor and the lit age only). */
  size?: "slim" | "compact";
  /**
   * The line as the map's time control (on /timeline and /places, through AgeLinePicker):
   * an age the map can show (`canPick`) is a button that moves the map there, the lit age
   * follows the map's year, and its label offers its page. Pages with a subject leave it unset.
   */
  onPick?: (age: Age) => void;
  canPick?: (age: Age) => boolean;
  className?: string;
}) {
  if (!ages.length) return null;
  const start = Math.min(-7000, ...ages.map((a) => a.from));
  const u = unitScale("stretched", start, NOW);
  const pct = (y: number) => Math.min(100, Math.max(0, u(y) * 100));
  const lit = ages.find((a) => a.id === focus || a.slug === focus) ?? null;
  const compact = size === "compact";
  const [m0, m1] = mark === null ? [null, null] : Array.isArray(mark) ? mark : [mark, mark];
  // When the subject *is* the lit age (an era page), its bar says it all: no cursor, no second date.
  const markIsLit =
    lit !== null && m0 !== null && m1 !== null && m1 !== m0 && Math.abs(m0 - lit.from) <= 1 && Math.abs(m1 - lit.to) <= 1;
  // The lit age's name, dates and place in the spine (linked) under the bar, at every width.
  const showLabel = lit !== null;
  const h = compact ? 40 : 36;
  // Where the lit label starts, so an end label is dropped rather than written over on a phone.
  const litLeft = lit ? pct(lit.from) : null;
  const litRight = lit ? pct(lit.from) > 60 : false;
  const ruleY = compact ? 14 : 18;
  const cursorAt = m0 === null || markIsLit ? null : pct(m0);
  const words =
    markLabel ?? (m0 === null ? "" : m1 !== null && m1 !== m0 ? `${formatYear(m0)} – ${formatYear(m1)}` : formatYear(m0));
  // The cursor's words sit over the cursor, pulled in at the ends so they never leave the line.
  const chipAlign = cursorAt === null ? "" : cursorAt < 8 ? "translate-x-0" : cursorAt > 92 ? "-translate-x-full" : "-translate-x-1/2";

  const cursor = cursorAt !== null && (
    <>
      <span aria-hidden className="absolute w-px bg-ink" style={{ left: `${cursorAt}%`, top: compact ? 4 : 8, height: compact ? 16 : 20 }} />
      {m1 !== null && m1 !== m0 && (
        <span
          aria-hidden
          className="absolute h-px bg-ink"
          style={{ left: `${cursorAt}%`, width: `${Math.max(0.25, pct(m1) - cursorAt)}%`, top: ruleY + (compact ? 6 : 9) }}
        />
      )}
      <span
        className={cn("absolute top-0 rounded-sm bg-ink px-1 text-[11px] leading-[14px] whitespace-nowrap text-chuna tnum", chipAlign)}
        style={{ left: `${cursorAt}%`, top: compact ? -2 : 0 }}
      >
        {words}
      </span>
    </>
  );

  // Sub-rows: ages in start order; one whose years begin inside the last age of the upper row drops to the
  // lower row (the Marathas within the Mughal years, the Company within the Raj), so no segment covers another.
  const lane = new Map<string, 0 | 1>();
  {
    let upperEnd = -Infinity;
    for (const a of [...ages].sort((x, y) => x.from - y.from || y.to - x.to)) {
      if (a.from < upperEnd - 1) lane.set(a.id, 1);
      else {
        lane.set(a.id, 0);
        upperEnd = Math.max(upperEnd, a.to);
      }
    }
  }

  return (
    <nav
      aria-label={lit ? `Where ${lit.label} sits among the ages` : "The ages of Indian history"}
      className={cn("relative w-full font-sans select-none", className)}
      style={{ height: h }}
    >
      {/* The rule itself: time, end to end. */}
      <Link
        href="/"
        aria-label="All the ages, on the home page"
        className="absolute inset-x-0 block bg-rule hover:bg-ink-3"
        style={{ top: ruleY, height: 1 }}
      />
      {ages.map((a) => {
        const l = pct(a.from);
        const r = Math.max(pct(a.to), l + 0.25);
        const on = lit?.id === a.id;
        // An age inside another's years sits in the lower sub-row, so a mouse can reach both.
        const lower = lane.get(a.id) === 1;
        const prog = a.page ? progress[a.page.slug] : undefined;
        const studied = prog && prog.state !== "untouched" && prog.parts > 0 ? prog : undefined;
        const when = a.whenLabel ? `, ${a.whenLabel}` : "";
        const segment = {
          className: cn(
            "absolute block rounded-[1px] transition-colors",
            a.page ? "bg-indigo hover:bg-indigo-deep dark:hover:bg-indigo-tint" : "bg-indigo-tint hover:bg-indigo/60",
            on && "ring-1 ring-ink ring-offset-1 ring-offset-chuna",
          ),
          style: {
            left: `${l}%`,
            // Never thinner than 6px (the home band's floor), so the newest, shortest age can still be hit.
            width: `max(calc(${r - l}% - 1px), 6px)`,
            // Two sub-rows share the rule's height: the upper straddles the rule, the lower hangs under it.
            top: lower ? ruleY + (compact ? 2 : 3) : on ? ruleY - (compact ? 4 : 6) : ruleY - (compact ? 2 : 3),
            height: on && !lower ? (compact ? 9 : 13) : lower ? (compact ? 3 : 4) : compact ? 5 : 7,
          },
        };
        const inner = (
          <>
            <span className="sr-only">{a.label}</span>
            {studied && (
              <span
                aria-hidden
                className="absolute bottom-0 left-0 h-px bg-white/90 dark:bg-chuna/90"
                style={{ width: `${Math.round((studied.partsStudied / studied.parts) * 100)}%` }}
              />
            )}
          </>
        );
        // The map's time control: an age the map can show moves it there; its page is under the line.
        if (onPick && canPick(a))
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a)}
              title={`${a.label}${when}: show on the map`}
              aria-pressed={on}
              {...segment}
            >
              {inner}
            </button>
          );
        return (
          <Link
            key={a.id}
            href={a.page ? `/p/${a.page.slug}` : `/e/${a.slug}`}
            title={`${a.label}${when}${a.page ? "" : " (not written yet)"}`}
            aria-current={on ? "location" : undefined}
            {...segment}
          >
            {inner}
          </Link>
        );
      })}
      {/* The lit age's name and dates under its bar, with its place in the spine linked to the list of ages. */}
      {lit && showLabel && (
        <p
          className={cn(
            "absolute truncate text-ink-2",
            compact ? "top-[22px] max-w-[82%] text-[11px]" : "top-[26px] max-w-[46%] text-xs",
            litRight ? "-translate-x-full text-right" : "",
          )}
          style={{ left: `${litRight ? pct(lit.to) : pct(lit.from)}%` }}
        >
          {/* As the map's time control, the lit age's name is the way to its page. */}
          {onPick ? (
            <Link
              href={lit.page ? `/p/${lit.page.slug}` : `/e/${lit.slug}`}
              title={lit.page ? `Open the page: ${lit.label}` : `About ${lit.label}`}
              className="text-indigo underline decoration-indigo-tint underline-offset-2 hover:decoration-indigo"
            >
              {lit.label}
            </Link>
          ) : (
            lit.label
          )}
          {lit.whenLabel ? <span className="text-ink-3 tnum">, {lit.whenLabel}</span> : null}
          {position && (
            <>
              <span className="text-ink-3">, </span>
              <Link
                href={indexHref ?? "/"}
                className="text-ink-3 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink-3 tnum"
              >
                age {position.index + 1} of {position.total}
              </Link>
            </>
          )}
        </p>
      )}
      {/* The cursor: the subject's own date, in ink; on a page with an atlas, the map's year,
          and the lit age's segment moves it (AgeLineLive, a client island). */}
      {lit ? (
        <AgeLineLive start={start} lit={lit} compact={compact} ruleY={ruleY} fallback={cursor} follow={Boolean(onPick)} />
      ) : (
        cursor
      )}
      {/* The ends: where the line starts and stops. An end gives way to the lit label when they would meet. */}
      {/* On a phone a right-hand label (up to 82% wide) can reach the left end too. */}
      {!(showLabel && ((!litRight && litLeft !== null && litLeft < (compact ? 28 : 12)) || (litRight && compact))) && (
        <span aria-hidden className={cn("absolute left-0 text-[11px] text-ink-3 tnum", compact ? "top-[22px]" : "top-[26px]")}>
          {/* The scale starts at astronomical −7000; the home band names that end "7000 BCE". */}
          {formatYear(start === -7000 ? -6999 : start)}
        </span>
      )}
      {!(showLabel && litRight) && (
        <span aria-hidden className={cn("absolute right-0 text-[11px] text-ink-3", compact ? "top-[22px]" : "top-[26px]")}>
          now
        </span>
      )}
    </nav>
  );
}
