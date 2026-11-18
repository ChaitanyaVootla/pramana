/**
 * The shared drawing engine of the layered timelines (MasterTimeline,
 * PeriodTimeline): marks from timeline items, lanes by kind, label packing,
 * and the axis. Pure functions returning SVG; colours come from a palette of
 * CSS variables so both light and dark themes (and any token refresh) apply.
 */
import type { TimelineItem } from "@pramana/services";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  NOW,
  fitText,
  isDiscoveryEvent,
  itemExtent,
  mid,
  packFree,
  pickTicks,
  shortYear,
  stretchBreaks,
  textWidth,
  type Extent,
  type Footprint,
  type LearnedItem,
  type ScaleMode,
  type Tick,
} from "@/lib/time";
import { BAND_ON, DOTTED, SoftGradient, fadeFractions } from "./marks";
import styles from "./time.module.css";

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

export interface Palette {
  era: string;
  person: string;
  event: string;
  place: string;
  learned: string;
  /** The lit thing (an age with a page, the focus). */
  on: string;
  /** Text inside a lit bar. */
  onText: string;
  /** Text inside an ordinary age bar. */
  inText: string;
  label: string;
  strong: string;
  lane: string;
  tick: string;
  /** The surface behind the marks (fills rings and axis breaks). */
  bg: string;
  /** Wash behind the focus period. */
  focusWash: string;
}

/** On the deep-indigo band. */
export const BAND_PALETTE: Palette = {
  era: "var(--band-era)",
  person: "var(--band-person)",
  event: "var(--band-event)",
  place: "var(--sandstone)",
  learned: "var(--band-event)",
  on: BAND_ON,
  onText: "var(--indigo-deep)",
  inText: "var(--band-event)",
  label: "var(--band-label)",
  strong: "var(--band-event)",
  lane: "var(--band-lane)",
  tick: "var(--band-tick)",
  bg: "var(--indigo-deep)",
  focusWash: "color-mix(in oklab, var(--band-on) 7%, transparent)",
};

/**
 * On the page (no box, docs/visual.md §5). Label halos take the surface
 * beneath: the ground by default; a parent on paper (a tile) sets
 * `--timeline-bg: var(--paper)`.
 */
export const PAPER_PALETTE: Palette = {
  era: "var(--indigo-tint)",
  person: "var(--indigo)",
  event: "var(--indigo)",
  place: "var(--sandstone)",
  learned: "var(--indigo)",
  on: "var(--indigo)",
  onText: "var(--primary-foreground)",
  inText: "var(--ink)",
  label: "var(--ink-2)",
  strong: "var(--ink)",
  lane: "var(--ink-3)",
  tick: "var(--rule)",
  bg: "var(--timeline-bg, var(--background))",
  focusWash: "color-mix(in oklab, var(--indigo-wash) 60%, transparent)",
};

// ---------------------------------------------------------------------------
// Layers and marks
// ---------------------------------------------------------------------------

export type LayerId = "ages" | "people" | "events" | "places" | "learned";

export interface LayerDef {
  id: LayerId;
  label: string;
  /** Short title for narrow lanes. */
  short: string;
  kinds?: string[];
  color: keyof Pick<Palette, "era" | "person" | "event" | "place" | "learned">;
  /** Swatch colour on paper (toggles, legend). */
  swatch: string;
  empty: string;
}

export const LAYERS: LayerDef[] = [
  {
    id: "ages",
    label: "Ages",
    short: "Ages",
    kinds: ["period", "polity", "culture"],
    color: "era",
    swatch: "var(--indigo)",
    empty: "No ages with dates yet.",
  },
  {
    id: "people",
    label: "Rulers and people",
    short: "People",
    kinds: ["person"],
    color: "person",
    swatch: "var(--indigo)",
    empty: "No people with dates yet.",
  },
  {
    id: "events",
    label: "Events",
    short: "Events",
    kinds: ["event"],
    color: "event",
    swatch: "var(--indigo)",
    empty: "No events with dates yet.",
  },
  {
    id: "places",
    label: "Places and inscriptions",
    short: "Places",
    kinds: ["place", "site", "inscription"],
    color: "place",
    swatch: "var(--sandstone)",
    empty: "No places or inscriptions with dates yet.",
  },
  {
    id: "learned",
    label: "When we learned it",
    short: "Learned",
    color: "learned",
    swatch: "var(--indigo)",
    empty: "No publication or decipherment dates yet. They appear as sources are added.",
  },
];

export interface Mark {
  key: string;
  layer: LayerId;
  /** Text drawn beside the mark. */
  text: string;
  /** The item's own name. */
  label: string;
  /** Full description, for the tooltip and the link's accessible name. */
  title: string;
  href: string | null;
  e: Extent;
  /** Lit: an age with a page, or the focus. */
  hot: boolean;
  /** Only in the story as someone who wrote about it (an author): drawn thin and muted. */
  quiet?: boolean;
  /** Lower is more important when labels compete for room. */
  rank: number;
}

/** Where an item links: its page if it has one, else its entity or claim page. */
export function hrefOf(item: TimelineItem, pageByEntity: Record<string, string>): string | null {
  if (item.type === "claim") return `/c/${item.id}`;
  const page = pageByEntity[item.id];
  return page ? `/p/${page}` : item.slug ? `/e/${item.slug}` : null;
}

export function buildMarks(
  items: TimelineItem[],
  learned: LearnedItem[],
  pageByEntity: Record<string, string>,
  focusId?: string,
  /** People who appear only as writers about the subject: quieter, and last to keep a label. */
  quietIds?: ReadonlySet<string>,
): Mark[] {
  const out: Mark[] = [];
  for (const item of items) {
    const layer: LayerId | undefined =
      item.type === "claim"
        ? "events"
        : isDiscoveryEvent(item)
          ? "learned"
          : LAYERS.find((l) => l.kinds?.includes(item.kind))?.id;
    if (!layer) continue;
    const e = itemExtent(item);
    if (!e) continue;
    const hot = Boolean(pageByEntity[item.id]) || item.id === focusId;
    const quiet = !hot && layer === "people" && Boolean(quietIds?.has(item.id));
    const when = e.point ? `${e.approximate ? "c. " : ""}${shortYear(mid(e))}` : null;
    out.push({
      key: item.id,
      label: item.label,
      layer,
      // The year after an event's name, unless the name already says it ("Partition of Bengal (1905)").
      text:
        when && layer !== "people" && !item.label.includes(shortYear(mid(e)).replace(/ CE$/, ""))
          ? `${item.label} ${when}`
          : item.label,
      title: `${item.label}, ${e.whenLabel}`,
      href: hrefOf(item, pageByEntity),
      e,
      hot,
      quiet,
      // Who keeps a label when room is short: the lit age, ages, rulers by
      // reign, events, other people, and last the traditional or uncertain.
      rank: hot
        ? 0
        : quiet
          ? 7
          : layer === "ages"
            ? 1
            : e.uncertain
              ? 6
              : e.role === "reign" || /\breign/i.test(e.whenLabel)
                ? 2
                : layer === "events"
                  ? 3
                  : 4,
    });
  }
  for (const l of learned) {
    out.push({
      key: `learned-${l.id}`,
      label: l.label,
      layer: "learned",
      text: `${l.label} ${shortYear(l.year)}`,
      title: `${l.label}, ${l.whenLabel}`,
      href: l.href,
      e: {
        start: l.year,
        end: l.year + 1,
        softStart: 0,
        softEnd: 0,
        open: false,
        point: true,
        approximate: false,
        uncertain: false,
        whenLabel: l.whenLabel,
        role: null,
      },
      hot: false,
      rank: 4,
    });
  }
  return out.sort((a, b) => a.e.start - b.e.start);
}

// ---------------------------------------------------------------------------
// Axis
// ---------------------------------------------------------------------------

export function renderAxis(o: {
  px: (year: number) => number;
  X0: number;
  X1: number;
  y: number;
  bottom: number;
  from: number;
  visibleFrom: number;
  visibleTo: number;
  mode: ScaleMode;
  palette: Palette;
  size?: number;
  gap?: number;
  /** An x range to keep clear of tick labels (the year cursor's flag). */
  avoid?: [number, number] | null;
}): ReactNode {
  const { px, X0, X1, y, bottom, palette: p } = o;
  const size = o.size ?? 12;
  const plotW = X1 - X0;
  const breaks = o.mode === "stretched" ? stretchBreaks() : [];
  const ticks = pickTicks(Math.max(o.from, o.visibleFrom), Math.min(NOW - 30, o.visibleTo), px, {
    gap: o.gap ?? 26,
    size,
    extra: [o.from, ...breaks],
    density: Math.max(4, Math.min(60, plotW / 30)),
  })
    // Labels are centred on their tick; drop the ones that would hang off either end.
    .filter((t) => t.x <= X0 + 2 || t.x - textWidth(t.label, size) / 2 >= X0 - 10)
    .filter((t) => t.x + textWidth(t.label, size) / 2 <= X1 - (px(NOW) <= X1 + 1 ? 34 : 0))
    // Labels as drawn (the first may be anchored at its start): drop any that
    // would touch the one before it, or the cursor's flag.
    .reduce<{ t: Tick; a: number; b: number }[]>((kept, t) => {
      const w = textWidth(t.label, size);
      const a = t.x <= X0 + 2 ? t.x : t.x - w / 2;
      const b = a + w;
      const prev = kept[kept.length - 1];
      if (prev && a < prev.b + 12) return kept;
      if (o.avoid && b > o.avoid[0] - 6 && a < o.avoid[1] + 6) return kept;
      kept.push({ t, a, b });
      return kept;
    }, [])
    .map((k) => k.t);
  const showNow = px(NOW) <= X1 + 1;
  return (
    <g fontSize={size}>
      <line x1={X0} x2={X1} y1={y} y2={y} stroke={p.tick} />
      {ticks.map((t) => {
        const atBreak = breaks.includes(t.year);
        return (
          <g key={t.year}>
            <line
              x1={t.x}
              x2={t.x}
              y1={atBreak ? y + 6 : y - 4}
              y2={bottom}
              stroke={t.year === 1 ? p.lane : p.tick}
              strokeOpacity={t.year === 1 ? 0.45 : 0.6}
              strokeDasharray={t.year === 1 ? "2 3" : undefined}
            />
            <text x={t.x} y={y - 9} textAnchor={t.x <= X0 + 2 ? "start" : "middle"} fill={p.lane}>
              {t.label}
            </text>
          </g>
        );
      })}
      {breaks.map((b) => {
        const bx = px(b);
        if (bx < X0 + 4 || bx > X1 - 4) return null;
        return (
          <g key={b}>
            <title>The scale changes here</title>
            <rect x={bx - 4} y={y - 2} width={8} height={4} fill={p.bg} />
            <path
              d={`M${bx - 5} ${y + 4.5} L${bx - 1} ${y - 4.5} M${bx + 1} ${y + 4.5} L${bx + 5} ${y - 4.5}`}
              stroke={p.label}
              fill="none"
            />
          </g>
        );
      })}
      {showNow && (
        <>
          <line x1={px(NOW)} x2={px(NOW)} y1={y - 5} y2={y + 5} stroke={p.on} strokeWidth={1.5} />
          <text x={px(NOW)} y={y - 9} textAnchor="end" fill={p.on} fontWeight={600}>
            now
          </text>
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

export interface LaneSizes {
  /** Row height and bar height for ages, and for everything else. */
  ageRow: number;
  ageBar: number;
  row: number;
  bar: number;
  dot: number;
  font: number;
  /** Space between lanes. */
  gap: number;
}

export const ROOMY: LaneSizes = {
  ageRow: 20,
  ageBar: 14,
  row: 22,
  bar: 7,
  dot: 3.5,
  font: 12,
  gap: 22,
};
export const TIGHT: LaneSizes = {
  ageRow: 18,
  ageBar: 14,
  row: 17,
  bar: 5,
  dot: 3,
  font: 11.5,
  gap: 12,
};

export interface LanesInput {
  marks: Mark[];
  layers: LayerDef[];
  px: (year: number) => number;
  X0: number;
  X1: number;
  top: number;
  palette: Palette;
  sizes: LaneSizes;
  uid: string;
  /** Lane titles: "side" in a left gutter at `gutterX`, "top" above each lane, or none. */
  titles: "side" | "top" | "none";
  gutterX?: number;
  /** Maximum rows per lane (labels beyond are dropped; marks stay). */
  maxRows: (layer: LayerId) => number;
  /** Rows to reserve at least (keeps heights steady while panning). */
  minRows?: (layer: LayerId) => number;
  /** Pack the most important labels first instead of left to right. */
  byImportance?: boolean;
  /** Longest label, in px; longer ones are truncated. */
  maxLabel?: number;
  /** Show the "nothing here" sentences. */
  emptyText?: boolean;
  /**
   * In an explorer, a click picks a mark instead of leaving the page (a
   * modified click still opens it in a new tab). The picked mark is outlined.
   */
  onPick?: (m: Mark) => void;
  picked?: string | null;
}

export interface LanesOutput {
  nodes: ReactNode;
  defs: ReactNode[];
  bottom: number;
  rows: Partial<Record<LayerId, number>>;
}

type Side = "in" | "right" | "left";

export function renderLanes(o: LanesInput): LanesOutput {
  const { px, X0, X1, palette: p, sizes: s, uid } = o;
  const defs: ReactNode[] = [];
  const nodes: ReactNode[] = [];
  const rowsUsed: Partial<Record<LayerId, number>> = {};
  const pxPerYear = Math.abs(px(1000) - px(0)) / 1000;
  let y = o.top;

  o.layers.forEach((layer, li) => {
    const top = y;
    const isAges = layer.id === "ages";
    const rowH = isAges ? s.ageRow : s.row;
    const titleH = o.titles === "top" ? s.font + 6 : 0;
    const contentTop = top + titleH;
    const layerMarks = o.marks.filter((m) => m.layer === layer.id);
    const color = p[layer.color];

    type Placed = {
      m: Mark;
      x0: number;
      x1: number;
      dot: boolean;
      side: Side;
      text: string;
      w: number;
    };
    const placed: Placed[] = [];
    const prints: Footprint[] = [];
    for (const m of layerMarks) {
      const dot = m.e.point || (!isAges && px(m.e.end) - px(m.e.start) < 3);
      const x0 = px(dot ? mid(m.e) : m.e.start);
      const x1 = dot ? x0 : px(m.e.end);
      if (x1 < X0 - 2 || x0 > X1 + 2) continue;
      let text = o.maxLabel ? fitText(m.text, o.maxLabel, s.font) : m.text;
      const extra = m.hot ? 6 : 0;
      let w = text ? textWidth(text, s.font) + extra : 0;
      const vis0 = Math.max(x0, X0);
      const vis1 = Math.min(x1, X1);
      const gap = dot ? s.dot + 5 : 6;
      const roomR = X1 - (vis1 + gap);
      const roomL = vis0 - gap - X0;
      let side: Side;
      if (isAges && vis1 - vis0 > w + 12) side = "in";
      else if (w <= roomR) side = "right";
      else if (w <= roomL) side = "left";
      else {
        // Neither side has room: shorten the label to the roomier side, or drop it.
        side = roomR >= roomL ? "right" : "left";
        text = fitText(text, Math.max(0, Math.max(roomR, roomL) - extra), s.font);
        w = text ? textWidth(text, s.font) + extra : 0;
      }
      const markL = vis0 - (dot ? s.dot + 1 : 0);
      const markR = vis1 + (dot ? s.dot + 1 : 0);
      const left = side === "left" ? vis0 - gap - w : markL;
      const right = side === "in" ? markR : side === "right" ? (w ? vis1 + gap + w : markR) : markR;
      placed.push({ m, x0, x1, dot, side, text, w });
      prints.push({ left, right, markLeft: markL, markRight: markR });
    }
    const order = placed
      .map((_, i) => i)
      .sort((a, b) =>
        o.byImportance
          ? placed[a]!.m.rank - placed[b]!.m.rank || prints[a]!.left - prints[b]!.left
          : prints[a]!.left - prints[b]!.left,
      );
    const packed = packFree(
      order.map((i) => prints[i]!),
      { gap: isAges ? 8 : 10, maxRows: o.maxRows(layer.id) },
    );
    const rowOf: { row: number; labelled: boolean }[] = [];
    order.forEach((i, k) => (rowOf[i] = packed.placed[k]!));
    const rows = Math.min(
      o.maxRows(layer.id),
      Math.max(placed.length ? packed.rows : 1, o.minRows?.(layer.id) ?? 0),
    );
    rowsUsed[layer.id] = rows;
    const sideTitleH = o.titles === "side" ? 34 : 0;
    const height = Math.max(titleH + rows * rowH, sideTitleH);

    nodes.push(
      <g key={layer.id}>
        {li > 0 && (
          <line
            x1={o.titles === "side" ? (o.gutterX ?? 16) : X0}
            x2={X1}
            y1={top - o.sizes.gap / 2 - 1}
            y2={top - o.sizes.gap / 2 - 1}
            stroke={p.tick}
            strokeOpacity={0.7}
          />
        )}
        {o.titles !== "none" && (
          <text
            x={o.titles === "side" ? (o.gutterX ?? 16) : X0}
            y={top + (o.titles === "top" ? s.font - 1 : 11)}
            fill={p.lane}
            fontSize={o.titles === "top" ? s.font - 0.5 : 12.5}
            fontWeight={500}
          >
            {o.titles === "top"
              ? layer.label
              : wrapLabel(layer.label, 13).map((line, i) => (
                  <tspan key={i} x={o.gutterX ?? 16} dy={i ? 15 : 0}>
                    {line}
                  </tspan>
                ))}
          </text>
        )}
        {o.emptyText !== false &&
          (layerMarks.length === 0 ? (
            <text x={X0} y={contentTop + rowH / 2 + 3} fill={p.lane} fontStyle="italic">
              {layer.empty}
            </text>
          ) : placed.length === 0 ? (
            <text x={X0} y={contentTop + rowH / 2 + 3} fill={p.lane} fontStyle="italic">
              Nothing here in this stretch of time.
            </text>
          ) : null)}
        <g clipPath={`url(#${uid}-clip)`}>
          {placed.map((pl, i) => {
            const { row, labelled } = rowOf[i]!;
            if (row < 0) return null;
            const cy = contentTop + row * rowH + rowH / 2;
            const { m } = pl;
            const gid = `${uid}-${layer.id}-${i}`;
            const fill = m.hot ? p.on : color;
            const barW = Math.max(3, pl.x1 - pl.x0);
            let shape: ReactNode;
            if (pl.dot) {
              shape =
                layer.id === "learned" ? (
                  <circle
                    cx={pl.x0}
                    cy={cy}
                    r={s.dot}
                    fill={p.bg}
                    stroke={fill}
                    strokeWidth={1.5}
                  />
                ) : (
                  <circle cx={pl.x0} cy={cy} r={m.hot ? s.dot + 1 : s.dot} fill={fill} />
                );
            } else if (m.e.uncertain) {
              shape = (
                <line
                  x1={pl.x0}
                  x2={pl.x0 + barW}
                  y1={cy}
                  y2={cy}
                  stroke={fill}
                  strokeWidth={isAges ? Math.min(6, s.ageBar / 2) : Math.max(2.5, s.bar * 0.45)}
                  strokeLinecap="round"
                  strokeDasharray={isAges ? "2 5" : DOTTED}
                />
              );
            } else {
              const f = fadeFractions(barW, pxPerYear, m.e);
              const fade = f.l || f.r;
              if (fade)
                defs.push(
                  <SoftGradient
                    key={gid}
                    id={gid}
                    color={fill}
                    fadeL={f.l}
                    fadeR={f.r}
                    floor={0.1}
                  />,
                );
              const h = isAges ? s.ageBar : m.quiet ? Math.max(2, s.bar * 0.5) : s.bar;
              shape = (
                <rect
                  x={pl.x0}
                  y={cy - h / 2}
                  width={barW}
                  height={h}
                  rx={Math.min(2, h / 3)}
                  fill={fade ? `url(#${gid})` : fill}
                />
              );
            }
            if (m.quiet) shape = <g opacity={0.5}>{shape}</g>;
            const vis0 = Math.max(pl.x0, X0);
            const vis1 = Math.min(pl.x1, X1);
            const gap = pl.dot ? s.dot + 5 : 6;
            const inside = pl.side === "in";
            const text =
              labelled && pl.text ? (
                <text
                  x={pl.side === "in" ? vis0 + 6 : pl.side === "right" ? vis1 + gap : vis0 - gap}
                  y={cy + s.font / 3}
                  textAnchor={pl.side === "left" ? "end" : "start"}
                  fill={
                    inside
                      ? m.hot
                        ? p.onText
                        : p.inText
                      : m.hot
                        ? p.strong
                        : isAges
                          ? p.strong
                          : m.quiet
                            ? p.lane
                            : p.label
                  }
                  fontWeight={m.hot ? 600 : isAges ? 500 : 400}
                  fontSize={s.font}
                  // A halo of the surface behind names outside their bars, so a
                  // cursor line under them never strikes through the letters.
                  {...(inside
                    ? {}
                    : {
                        stroke: p.bg,
                        strokeWidth: 3,
                        strokeLinejoin: "round" as const,
                        paintOrder: "stroke",
                      })}
                  // A shortened name is only a picture of the name: hidden from assistive
                  // technology, so the link is named by its whole label (which begins with
                  // the same words) and never seems to say something other than it shows.
                  {...(pl.text.endsWith("…") ? { "aria-hidden": true } : {})}
                >
                  {/* A shortened name's ellipsis is decoration: the accessible name holds the whole. */}
                  {pl.text.endsWith("…") ? (
                    <>
                      {pl.text.slice(0, -1)}
                      <tspan aria-hidden="true">…</tspan>
                    </>
                  ) : (
                    pl.text
                  )}
                </text>
              ) : null;
            const hitL = labelled ? prints[i]!.left : prints[i]!.markLeft;
            const hitR = labelled ? prints[i]!.right : prints[i]!.markRight;
            const body = (
              <>
                <rect
                  className={styles.hit}
                  x={hitL - 2}
                  y={cy - rowH / 2 + 1}
                  width={Math.max(8, hitR - hitL + 4)}
                  height={rowH - 2}
                  rx={3}
                />
                {shape}
                {text}
              </>
            );
            // The tooltip's <title> sits on a group around the link, not inside it:
            // inside, it counts as the link's visible text and its name would not match.
            return m.href ? (
              <g key={m.key}>
                <title>{m.title}</title>
                <Link
                  href={m.href}
                  className={styles.mark}
                  data-picked={o.picked === m.key ? "" : undefined}
                  onClick={(ev) => {
                    if (!o.onPick || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button !== 0)
                      return;
                    ev.preventDefault();
                    o.onPick(m);
                  }}
                  // The name starts with the words shown (speech input matches them),
                  // then the dates if the label does not already carry them.
                  aria-label={
                    m.text.includes(m.e.whenLabel) ? m.text : `${m.text}, ${m.e.whenLabel}`
                  }
                  // One tab stop for the whole band: marks are reached with the arrow keys (useTimeWindow).
                  tabIndex={-1}
                  data-mark=""
                  draggable={false}
                >
                  {body}
                </Link>
              </g>
            ) : (
              <g key={m.key}>
                <title>{m.title}</title>
                {body}
              </g>
            );
          })}
        </g>
      </g>,
    );
    y = top + height + s.gap;
  });
  return { nodes, defs, bottom: y - s.gap, rows: rowsUsed };
}

/** Splits a lane title into lines of at most `max` characters, at spaces. */
function wrapLabel(s: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    if (line && (line + " " + word).length > max) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}
