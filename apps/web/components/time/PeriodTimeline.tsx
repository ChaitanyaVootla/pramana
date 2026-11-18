"use client";

import type { TimelineItem } from "@pramana/services";
import { Minus, Plus, Undo2 } from "lucide-react";
import { useEffect, useId, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DEEP_START,
  NOW,
  shortYear,
  spanLabel,
  textWidth,
  unitScale,
  type ScaleMode,
} from "@/lib/time";
import {
  BAND_PALETTE,
  LAYERS,
  PAPER_PALETTE,
  TIGHT,
  buildMarks,
  renderAxis,
  renderLanes,
  type LayerId,
} from "./lanes";
import { MIN_SPAN, useMeasuredText, useTimeWindow, useWidth } from "./useTimeWindow";
import { PickedLine, usePick } from "./Picked";
import { YearCursor, type CursorStop } from "./YearCursor";

/**
 * A small timeline that opens zoomed into one period: the era page's side
 * panel (320–420 px wide) and timeline blocks in pages and notes.
 *
 * Pass ALL the items you have, not just the period's: zooming out reveals the
 * neighbouring ages, people and events. Lanes by kind (ages; rulers and people,
 * drawn by their reign where recorded; events as dots). Soft ends mean an
 * approximate date, dotted means traditional, dots are single years. Labels
 * never overlap: when crowded, the most important keep their label (the lit
 * age, then ages, then reigns, then events), long ones are shortened, and the
 * rest show only their mark (the name is in its tooltip and link).
 *
 * Drag to pan; Zoom out, Zoom in, and "Back to <label>"; keys: arrows pan,
 * + and − zoom, 0 goes back. Colours are theme tokens only.
 *
 * With `cursor`, a year cursor runs through the lanes and can be dragged
 * along the axis (the atlas scrubber; see YearCursor). The window follows the
 * cursor when it is moved out of view (a date chosen elsewhere, "Play").
 */

export interface PeriodTimelineProps {
  /** Dated items: entities of any kind, and claims (shown with events). */
  items: TimelineItem[];
  /** The period to open on. Years are astronomical (0 = 1 BCE). */
  focus: { from: number; to: number; id?: string; label: string };
  /** Entity id → page slug: those link to their page (and are lit); others to /e/<slug>. */
  pageByEntity?: Record<string, string>;
  /** Maximum height of the plot in px (controls not included); it shrinks to fit. Default 240. */
  height?: number;
  /** No lane titles or legend, tighter rows: for very small slots. */
  compact?: boolean;
  /** "paper" (default) on a card or the page; "band" on deep indigo. */
  tone?: "paper" | "band";
  /** Default "stretched", so zooming all the way out stays readable. */
  scale?: ScaleMode;
  /** Lanes to draw, in order. Default ages, people, events (and places when there are any). */
  layers?: LayerId[];
  /**
   * "zoom" (default for panels: compact or tone "paper"): a plain wheel zooms at
   * the pointer on fine pointers, a horizontal swipe pans. "modifier": only
   * Ctrl/⌘ + wheel zooms (default for tone "band").
   */
  wheel?: "zoom" | "modifier";
  /** A draggable year cursor (astronomical year); omit for none. */
  cursor?: number | null;
  /** Called while dragging (`final` false) and when the cursor is let go or set by a key or stop. */
  onCursorChange?: (year: number, opts: { final: boolean }) => void;
  /** Years the cursor may take. Default: the focus period. */
  cursorRange?: [number, number];
  /** Marked years on the axis, to click or step to (Page Up/Down). */
  cursorStops?: CursorStop[];
  /** Years where what the cursor shows changes: the arrows go from one to the next. */
  cursorChanges?: number[];
  /** Accessible name of the cursor. Default "Year". */
  cursorLabel?: string;
  /** What the header says at the home view; default "<focus label>, <focus years>". */
  focusCaption?: string;
  /** People who appear only as writers about the subject (authors): drawn thin and muted. */
  quietIds?: string[];
  className?: string;
}

const AXIS_Y = 22;

export function PeriodTimeline({
  items,
  focus,
  pageByEntity,
  height = 240,
  compact = false,
  tone = "paper",
  scale = "stretched",
  layers,
  wheel,
  cursor = null,
  onCursorChange,
  cursorRange,
  cursorStops,
  cursorChanges,
  cursorLabel = "Year",
  focusCaption,
  quietIds,
  className,
}: PeriodTimelineProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useMeasuredText(); // re-render with measured label widths once the UI font has loaded
  const palette = tone === "band" ? BAND_PALETTE : PAPER_PALETTE;
  const pages = useMemo(() => pageByEntity ?? {}, [pageByEntity]);
  const quietKey = quietIds?.join(",") ?? "";
  const marks = useMemo(
    () =>
      buildMarks(items, [], pages, focus.id, quietKey ? new Set(quietKey.split(",")) : undefined),
    [items, pages, focus.id, quietKey],
  );
  const from = useMemo(
    () => Math.min(DEEP_START, focus.from, ...marks.map((m) => m.e.start)),
    [marks, focus.from],
  );
  const U = useMemo(() => unitScale(scale, from, NOW), [scale, from]);

  const [wrapRef, W] = useWidth<HTMLDivElement>(360);
  const X0 = 8;
  const X1 = Math.max(X0 + 40, W - 8);
  const plotW = X1 - X0;

  // Open on the period with a little air either side.
  const u0 = U(focus.from);
  const u1 = U(Math.max(focus.to, focus.from + 1));
  const pad = Math.max((u1 - u0) * 0.08, MIN_SPAN / 4);
  const home: [number, number] = [u0 - pad, u1 + pad];
  const { win, setWin, span, atHome, zoomIn, zoomOut, reset, bandProps } = useTimeWindow({
    wheel: wheel ?? (compact || tone === "paper" ? "zoom" : "modifier"),
    home,
    X0,
    plotW,
  });
  const px = (year: number) => X0 + ((U(year) - win[0]) / (win[1] - win[0])) * plotW;
  const yearAt = (x: number) => U.invert(win[0] + ((x - X0) / plotW) * (win[1] - win[0]));

  // Lanes: by default, the ones that have something to show anywhere.
  const active = LAYERS.filter((l) =>
    layers
      ? layers.includes(l.id)
      : (l.id === "ages" || l.id === "people" || l.id === "events" || l.id === "places") &&
        marks.some((m) => m.layer === l.id),
  );
  const sizes = compact ? { ...TIGHT, gap: 8 } : TIGHT;
  const titleH = compact ? 0 : sizes.font + 6;
  // Share the rows the height allows by demand: how many marks each lane has
  // around the period (fixed, so lanes do not jump while panning). Ages get at
  // most two rows (three when tall).
  const budget = Math.max(
    active.length,
    Math.floor((height - AXIS_Y - 14 - active.length * (titleH + sizes.gap)) / sizes.row),
  );
  const near = (m: (typeof marks)[number]) => {
    const a = U(m.e.start);
    const b = U(m.e.end);
    return b >= home[0] - (home[1] - home[0]) && a <= home[1] + (home[1] - home[0]);
  };
  const demand = Object.fromEntries(
    active.map((l) => [l.id, marks.filter((m) => m.layer === l.id && near(m)).length]),
  ) as Record<LayerId, number>;
  const alloc = Object.fromEntries(active.map((l) => [l.id, 1])) as Record<LayerId, number>;
  const cap = (id: LayerId) => (id === "ages" ? (height >= 300 ? 3 : 2) : Infinity);
  for (let left = budget - active.length; left > 0; left--) {
    const next = active
      .map((l) => l.id)
      .filter((id) => alloc[id] < Math.min(cap(id), demand[id]))
      .sort((a, b) => demand[b] / alloc[b] - demand[a] / alloc[a])[0];
    if (!next) break;
    alloc[next]++;
  }
  const rowsFor = (id: LayerId) => alloc[id] ?? 1;

  // The lanes depend on the window, not on the cursor: laid out once per
  // window, so dragging or playing the cursor costs only the cursor.
  const pickRange = cursorRange ?? [Math.round(focus.from), Math.round(focus.to)];
  const { picked, onPick, clear } = usePick(
    cursor !== null ? onCursorChange : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useMemo(() => pickRange, [pickRange[0], pickRange[1]]),
  );
  const activeKey = active.map((l) => l.id).join(",");
  const rowsKey = active.map((l) => rowsFor(l.id)).join(",");
  const lanes = useMemo(
    () =>
      renderLanes({
        marks,
        layers: active,
        px,
        X0,
        X1,
        top: AXIS_Y + 14,
        palette,
        sizes,
        uid,
        titles: compact ? "none" : "top",
        maxRows: rowsFor,
        minRows: rowsFor,
        byImportance: true,
        maxLabel: Math.max(60, Math.min(220, plotW * 0.55)),
        emptyText: !compact,
        onPick,
        picked: picked?.key ?? null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [marks, win[0], win[1], W, activeKey, rowsKey, compact, palette, uid, U, onPick, picked],
  );
  const H = Math.min(height, lanes.bottom + 10);

  const visibleFrom = yearAt(X0);
  const visibleTo = yearAt(X1);
  const windowText =
    visibleTo >= NOW - 1
      ? `${spanLabel(visibleFrom, visibleFrom)} to now`
      : spanLabel(visibleFrom, visibleTo);
  // Keep the cursor in view: when it is set outside the window, pan to it.
  const cursorU = cursor === null ? null : U(cursor);
  useEffect(() => {
    if (cursorU === null) return;
    setWin(([a, b]) => {
      const m = (b - a) * 0.04;
      if (cursorU >= a + m && cursorU <= b - m) return [a, b];
      const shift = cursorU < a + m ? cursorU - (a + m) : cursorU - (b - m);
      return [a + shift, b + shift];
    });
  }, [cursorU, setWin]);
  const yearsShown = Math.max(1, visibleTo - visibleFrom);
  const cursorStep = [1, 2, 5, 10, 25, 50, 100].find((s) => s >= yearsShown / 120) ?? 100;
  const cursorX = cursor === null ? null : px(cursor);
  // The flag over the axis (YearCursor): tick labels keep clear of it.
  const cursorFlag: [number, number] | null =
    cursorX === null
      ? null
      : [
          cursorX - (textWidth(shortYear(cursor!), 11) + 14) / 2,
          cursorX + (textWidth(shortYear(cursor!), 11) + 14) / 2,
        ];

  const fx0 = Math.max(X0, px(focus.from));
  const fx1 = Math.min(X1, px(focus.to));

  return (
    <div ref={wrapRef} className={cn("font-sans", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pb-1.5">
        <span className="min-w-0 truncate text-xs text-ink-3 tabular" aria-live="polite">
          {atHome
            ? (focusCaption ?? `${focus.label}, ${spanLabel(focus.from, focus.to - 1e-6)}`)
            : windowText}
        </span>
        <div className="flex items-center gap-1">
          {!atHome && (
            <Button
              variant="ghost"
              size="xs"
              onClick={reset}
              className="max-w-[16rem] truncate text-indigo"
            >
              <Undo2 data-icon="inline-start" aria-hidden />
              <span className="truncate">Back to {focus.label}</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-xs"
            onClick={zoomOut}
            disabled={span >= 0.999}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <Minus />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={zoomIn}
            disabled={span <= MIN_SPAN * 1.01}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <Plus />
          </Button>
        </div>
      </div>
      <div
        {...bandProps}
        role="group"
        aria-roledescription="timeline"
        aria-label={`Timeline around ${focus.label}, showing ${windowText}. Left and right move, up and down go through the items, Enter ${onPick ? "picks" : "opens"} one, plus and minus zoom, 0 goes back to ${focus.label}.`}
        className={cn(
          "relative cursor-grab touch-pan-y overflow-hidden rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing",
          tone === "band" ? "bg-indigo-deep" : "border-y border-rule",
        )}
      >
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block text-xs tabular"
          fontFamily="var(--font-sans)"
        >
          <defs>
            <clipPath id={`${uid}-clip`}>
              <rect x={X0 - 4} y={0} width={plotW + 8} height={H} />
            </clipPath>
            {lanes.defs}
          </defs>
          {fx1 > fx0 && (
            <rect
              x={fx0}
              y={AXIS_Y + 1}
              width={fx1 - fx0}
              height={H - AXIS_Y - 1}
              fill={palette.focusWash}
            />
          )}
          {renderAxis({
            px,
            X0,
            X1,
            y: AXIS_Y,
            bottom: H,
            from,
            visibleFrom,
            visibleTo,
            mode: scale,
            palette,
            size: 11,
            gap: compact ? 10 : 16,
            avoid: cursorFlag,
          })}
          {/* The cursor line runs behind the lanes, so it never strikes through a name. */}
          {cursorX !== null && cursorX >= X0 - 1 && cursorX <= X1 + 1 && (
            <g pointerEvents="none">
              <line
                x1={cursorX}
                x2={cursorX}
                y1={AXIS_Y}
                y2={H}
                stroke={palette.on}
                strokeWidth={1.5}
                strokeOpacity={0.85}
              />
              <circle cx={cursorX} cy={AXIS_Y} r={3.5} fill={palette.on} />
            </g>
          )}
          {active.length ? (
            lanes.nodes
          ) : (
            <text x={X0} y={AXIS_Y + 30} fill={palette.lane} fontStyle="italic">
              Nothing dated to show yet.
            </text>
          )}
        </svg>
        {cursor !== null && onCursorChange && (
          <YearCursor
            year={cursor}
            onChange={onCursorChange}
            range={cursorRange ?? [Math.round(focus.from), Math.round(focus.to)]}
            stops={cursorStops ?? []}
            changes={cursorChanges}
            px={px}
            yearAt={yearAt}
            X0={X0}
            X1={X1}
            strip={AXIS_Y + 10}
            step={cursorStep}
            label={cursorLabel}
          />
        )}
      </div>
      <PickedLine mark={picked} onClear={clear} />
    </div>
  );
}
