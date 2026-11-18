/**
 * Time helpers for the time-rule components (components/time/*).
 *
 * Years are ASTRONOMICAL decimal years throughout (0 = 1 BCE, -321 = 322 BCE),
 * as produced by `dateBounds` in @pramana/core. Never use JS Date for BCE.
 * Labels go through `formatYear` / `fromAstronomicalYear`.
 */
import { formatYear, fromAstronomicalYear } from "@pramana/core";
import { scaleLinear, type ScaleLinear } from "d3-scale";
import type { TimelineItem } from "@pramana/services";

/** The end of the current year: the right edge of every rule ("now"). */
export const NOW = new Date().getUTCFullYear() + 1;
/** The left edge of the full rule: 7000 BCE. */
export const DEEP_START = -6999;

/** Astronomical position of a HISTORICAL year (-500 = 500 BCE, 1 = 1 CE). */
export function astro(historical: number): number {
  return historical < 0 ? historical + 1 : historical;
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

export type ScaleMode = "stretched" | "true";

/**
 * The stretched scale gives recent, densely documented centuries more room:
 * 12% for 7000–1000 BCE, 36% for 1000 BCE–600 CE, 22% for 600–1500, 30% for 1500–now.
 */
export const STRETCH: { from: number; to: number; share: number }[] = [
  { from: DEEP_START, to: astro(-1000), share: 0.12 },
  { from: astro(-1000), to: 600, share: 0.36 },
  { from: 600, to: 1500, share: 0.22 },
  { from: 1500, to: NOW, share: 0.3 },
];

/**
 * A scale from astronomical year to a unit position in [0, 1] over [from, to].
 * Stretched: piecewise linear (d3 polylinear); it extrapolates beyond the ends.
 */
export function unitScale(
  mode: ScaleMode,
  from: number = DEEP_START,
  to: number = NOW,
): ScaleLinear<number, number> {
  if (mode === "true") return scaleLinear().domain([from, to]).range([0, 1]);
  const stops = [Math.min(from, STRETCH[0]!.from), ...STRETCH.map((s) => s.to)];
  stops[stops.length - 1] = Math.max(to, NOW);
  const range = [0];
  for (const s of STRETCH) range.push(range[range.length - 1]! + s.share);
  return scaleLinear().domain(stops).range(range);
}

/** Interior break points of the stretched scale (where the density changes). */
export function stretchBreaks(): number[] {
  return STRETCH.slice(1).map((s) => s.from);
}

// ---------------------------------------------------------------------------
// Year labels
// ---------------------------------------------------------------------------

/** "322 BCE", "1 CE", "1500 CE". */
export function yearLabel(a: number): string {
  return formatYear(a);
}

/** "261 BCE", "1206" (drops CE from 1000 CE on, as in running text). */
export function shortYear(a: number): string {
  return formatYear(a, { era: "auto" });
}

/** "322–185 BCE", "185 BCE – 320 CE", "1206–1526". */
export function spanLabel(from: number, to: number, approximate = false): string {
  const a = fromAstronomicalYear(Math.floor(from));
  const b = fromAstronomicalYear(Math.floor(to));
  const c = approximate ? "c. " : "";
  if (a.year === b.year && a.era === b.era) return `${c}${shortYear(from)}`;
  if (a.era === b.era) return `${c}${a.year}–${b.year}${a.era === "BCE" ? " BCE" : b.year < 1000 ? " CE" : ""}`;
  return `${c}${a.year} ${a.era} – ${b.year} ${b.era}`;
}

/** "about 2,300 years ago" (rounded to two significant figures, or to 10 under 1000). */
export function yearsAgo(a: number, now: number = NOW - 1): string {
  const n = now - a;
  if (n < 1) return "this year";
  if (n < 2) return "a year ago";
  const round = n < 100 ? 1 : n < 1000 ? 10 : 100;
  const v = Math.round(n / round) * round;
  return `${round === 1 ? "" : "about "}${v.toLocaleString("en-GB")} years ago`;
}

/** Estimated width of a label in a UI sans (Inter-like) at `size` px. */
function estimateWidth(s: string, size: number): number {
  let w = 0;
  for (const ch of s) {
    if (/[iljtfrI.,:;'’()\s|]/.test(ch)) w += 0.3;
    else if (/[mwMW]/.test(ch)) w += 0.85;
    else if (/[A-Z0-9]/.test(ch)) w += 0.63;
    else w += 0.55;
  }
  return w * size;
}

/*
 * In the browser, after mount and once fonts have loaded (see `useMeasuredText`
 * in components/time/useTimeWindow.ts), widths are measured with canvas
 * `measureText` in the computed UI font. Before that (and on the server) they
 * are estimated, so server and first client render agree (no hydration mismatch).
 */
let measureCtx: CanvasRenderingContext2D | null = null;
let measureFamily = "";
const measured = new Map<string, number>();

/** Switches `textWidth` to real measurement in the given font family (client only). */
export function enableTextMeasuring(family: string): void {
  if (typeof document === "undefined") return;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  measureFamily = family;
  measured.clear();
}

/** Rendered width of a label at `size` px (weight 500, the heavier of our label weights). */
export function textWidth(s: string, size = 12): number {
  if (!measureCtx || !measureFamily) return estimateWidth(s, size);
  const key = `${size}|${s}`;
  const hit = measured.get(key);
  if (hit !== undefined) return hit;
  measureCtx.font = `500 ${size}px ${measureFamily}`;
  const w = measureCtx.measureText(s).width;
  measured.set(key, w);
  return w;
}

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

export interface Tick {
  year: number; // astronomical
  label: string;
  x: number;
}

const STEPS = [5000, 1000, 500, 250, 100, 50, 25, 10, 5, 1];

/**
 * Round historical years (7000 BCE, 500 BCE, 1 CE, 1500 CE) in [from, to],
 * chosen coarse-first so labels never collide. `x` maps an astronomical year
 * to pixels. Works for linear and stretched scales alike.
 */
export function pickTicks(
  from: number,
  to: number,
  x: (year: number) => number,
  opts: {
    gap?: number;
    size?: number;
    label?: (a: number) => string;
    /** Years to place first (e.g. the scale's break points). */
    extra?: number[];
    /** At most about this many steps across the window (default 40). */
    density?: number;
  } = {},
): Tick[] {
  const gap = opts.gap ?? 14;
  const size = opts.size ?? 12;
  const label = opts.label ?? yearLabel;
  const out: (Tick & { w: number })[] = [];
  const fits = (px: number, w: number) =>
    out.every((t) => Math.abs(t.x - px) >= (t.w + w) / 2 + gap);
  const tryAdd = (a: number) => {
    if (a < from || a > to || out.some((t) => t.year === a)) return;
    const l = label(a);
    const w = textWidth(l, size);
    const px = x(a);
    if (fits(px, w)) out.push({ year: a, label: l, x: px, w });
  };
  for (const a of opts.extra ?? []) tryAdd(a);
  const hFrom = from <= 0 ? from - 1 : from;
  const hTo = to <= 0 ? to - 1 : to;
  // Steps much finer than the window (1625 CE on a 9,000-year rule) are noise.
  const minStep = (hTo - hFrom) / (opts.density ?? 40);
  for (const step of STEPS) {
    if (step < minStep || (hTo - hFrom) / step > 600) break;
    for (let h = Math.ceil(hFrom / step) * step; h <= hTo; h += step) {
      if (h === 0) {
        if (step <= 1000) tryAdd(1); // "1 CE" stands in for year zero, which does not exist
        continue;
      }
      tryAdd(astro(h));
    }
  }
  return out.sort((a, b) => a.x - b.x).map(({ w: _w, ...t }) => t);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** What a mark needs: where it starts and ends, and how sure we are. */
export interface Extent {
  start: number;
  end: number;
  /** Years of fuzz at each end (from EDTF bounds; 0 when exact to the year). */
  softStart: number;
  softEnd: number;
  /** No end date: still going. */
  open: boolean;
  /** Shorter than about a year: drawn as a dot. */
  point: boolean;
  approximate: boolean;
  /** Uncertain or traditional: drawn dotted. */
  uncertain: boolean;
  /** The label of the span drawn ("reigned c. 322–298 BCE"). */
  whenLabel: string;
  /** Which span this is ("reign", "life"...), when known. */
  role: string | null;
}

type Bounds = TimelineItem["bounds"];

function extentOf(b: Bounds, whenLabel: string, role: string | null): Extent | null {
  const start = b.startMin ?? b.startMax ?? b.endMin;
  const open = b.endMax === null && b.endMin === null;
  const end = b.endMax ?? b.endMin ?? (open ? NOW : null);
  if (start === null || end === null) return null;
  const softStart = b.startMax !== null && b.startMin !== null ? b.startMax - b.startMin : 0;
  const softEnd = b.endMax !== null && b.endMin !== null ? b.endMax - b.endMin : 0;
  return {
    start,
    end: Math.max(end, start),
    softStart: softStart > 1.01 ? softStart : 0,
    softEnd: softEnd > 1.01 ? softEnd : 0,
    open,
    point: !open && end - start <= 1.01,
    approximate: b.approximate,
    uncertain: b.uncertain || /tradition/i.test(whenLabel),
    whenLabel,
    role,
  };
}

/** Preferred span roles per kind: rulers by reign, then life, then floruit. */
export const ROLE_PREFERENCE: Record<string, string[]> = {
  person: ["reign", "life", "floruit"],
};

/**
 * The extent to draw for an item. Uses `spans` when present (preferring a
 * ruler's reign), otherwise the item's own bounds.
 */
export function itemExtent(item: TimelineItem, roles?: string[]): Extent | null {
  const prefs = roles ?? ROLE_PREFERENCE[item.kind] ?? [];
  for (const role of prefs) {
    const span = item.spans?.find((s) => s.role === role);
    if (span) {
      const e = extentOf(span.bounds, span.label, role);
      if (e) return e;
    }
  }
  return extentOf(item.bounds, item.whenLabel, item.role ?? null);
}

/** Midpoint of an extent (where a dot goes). */
export function mid(e: Extent): number {
  return (e.start + e.end) / 2;
}

// ---------------------------------------------------------------------------
// Label packing
// ---------------------------------------------------------------------------

export interface Footprint {
  /** Pixel range the mark and its label occupy. */
  left: number;
  right: number;
  /** Pixel range of the mark alone (used when the label has to be dropped). */
  markLeft: number;
  markRight: number;
}

/**
 * Greedy row packing: each footprint goes in the first row whose last
 * occupant ends before it starts. Beyond `maxRows`, the label is dropped and
 * the mark alone is placed where it fits (`labelled: false`).
 * Input must be sorted by `left`.
 */
export function packRows(
  items: Footprint[],
  opts: { gap?: number; maxRows?: number } = {},
): { rows: number; placed: { row: number; labelled: boolean }[] } {
  const gap = opts.gap ?? 8;
  const maxRows = opts.maxRows ?? 12;
  const ends: number[] = [];
  const placed = items.map((f) => {
    let row = ends.findIndex((e) => e + gap <= f.left);
    if (row === -1 && ends.length < maxRows) row = ends.length;
    if (row !== -1) {
      ends[row] = f.right;
      return { row, labelled: true };
    }
    row = ends.findIndex((e) => e + 2 <= f.markLeft);
    if (row === -1) row = ends.indexOf(Math.min(...ends));
    ends[row] = Math.max(ends[row]!, f.markRight);
    return { row, labelled: false };
  });
  return { rows: Math.max(1, ends.length), placed };
}

/**
 * Packing for small sets where order means priority, not position: each
 * footprint goes in the lowest row where it overlaps nothing. Input order is
 * kept (put what should sit nearest the axis first).
 */
export function packByPriority(items: Footprint[], gap = 8, maxRows = 8): number[] {
  const rows: [number, number][][] = [];
  return items.map((f) => {
    const free = (row: [number, number][]) =>
      row.every(([l, r]) => f.right + gap <= l || f.left >= r + gap);
    let i = rows.findIndex(free);
    if (i === -1) {
      if (rows.length < maxRows) i = rows.push([]) - 1;
      else i = rows.length - 1;
    }
    rows[i]!.push([f.left, f.right]);
    return i;
  });
}

/**
 * Interval packing in priority order with label dropping: each footprint goes
 * in the lowest row where it overlaps nothing; with no room and no rows left,
 * its label is dropped and the mark alone goes where it fits; with no room even
 * for the mark, `row` is -1 and the item is not drawn (zooming in reveals it). Put the most
 * important items first; with input sorted by `left` this is plain greedy packing.
 */
export function packFree(
  items: Footprint[],
  opts: { gap?: number; maxRows?: number } = {},
): { rows: number; placed: { row: number; labelled: boolean }[] } {
  const gap = opts.gap ?? 8;
  const maxRows = Math.max(1, opts.maxRows ?? 12);
  const rows: [number, number][][] = [];
  const fits = (row: [number, number][], l: number, r: number, g: number) =>
    row.every(([a, b]) => r + g <= a || l >= b + g);
  const placed = items.map((f) => {
    let i = rows.findIndex((row) => fits(row, f.left, f.right, gap));
    if (i === -1 && rows.length < maxRows) i = rows.push([]) - 1;
    if (i !== -1) {
      rows[i]!.push([f.left, f.right]);
      return { row: i, labelled: true };
    }
    i = rows.findIndex((row) => fits(row, f.markLeft, f.markRight, 2));
    if (i === -1) return { row: -1, labelled: false }; // no room at all: not drawn
    rows[i]!.push([f.markLeft, f.markRight]);
    return { row: i, labelled: false };
  });
  return { rows: Math.max(1, rows.length), placed };
}

/** Truncates `s` with an ellipsis so it renders within `maxPx`. */
export function fitText(s: string, maxPx: number, size = 12): string {
  if (textWidth(s, size) <= maxPx) return s;
  let out = s;
  while (out.length > 1 && textWidth(`${out}…`, size) > maxPx) out = out.slice(0, -1);
  out = out.trimEnd();
  return out.length >= 3 ? `${out}…` : "";
}

// ---------------------------------------------------------------------------
// "When we learned it"
// ---------------------------------------------------------------------------

/** A moment in the history of our knowledge: a publication, a decipherment. */
export interface LearnedItem {
  id: string;
  label: string;
  /** Astronomical year. */
  year: number;
  whenLabel: string;
  href: string | null;
}

/** Events that are about how we know (decipherments), rather than history itself. */
export function isDiscoveryEvent(item: TimelineItem): boolean {
  return item.kind === "event" && /deciph|decod|rediscover/i.test(item.label);
}
