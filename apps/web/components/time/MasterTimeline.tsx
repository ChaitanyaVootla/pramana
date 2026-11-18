"use client";

import type { TimelineItem } from "@pramana/services";
import { Minus, Plus } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  DEEP_START,
  NOW,
  shortYear,
  textWidth,
  unitScale,
  yearLabel,
  type LearnedItem,
  type ScaleMode,
} from "@/lib/time";
import {
  PAPER_PALETTE,
  LAYERS,
  ROOMY,
  buildMarks,
  renderAxis,
  renderLanes,
  type LayerId,
} from "./lanes";
import { MIN_SPAN, clampWin, useMeasuredText, useTimeWindow, useWidth } from "./useTimeWindow";
import { PickedLine, usePick } from "./Picked";
import { YearCursor, type CursorStop } from "./YearCursor";

export { LAYERS, type LayerId };

/**
 * The master timeline for the home page and /timeline: the time-rule with
 * layers. Ages, rulers and people, events, places and inscriptions, and "when
 * we learned it" (publications and decipherments) each get a lane; labels are
 * packed into rows and flip left near the right edge. Soft ends mean
 * approximate dates, dotted means traditional, dots are single years.
 *
 * Stretched scale by default (12% / 36% / 22% / 30% across 7000–1000 BCE,
 * 1000 BCE–600 CE, 600–1500, 1500–now, with the breaks marked on the axis);
 * "True scale" is one click away. Drag to pan, Ctrl/⌘ + scroll or +/− to
 * zoom, a brush on the minimap to choose a window. Arrow keys pan, + and −
 * zoom, 0 resets. Every mark is a link.
 *
 * Drawing is shared with PeriodTimeline (./lanes, ./useTimeWindow).
 */

export interface MasterTimelineProps {
  /** Dated entities of any kind; each goes to the layer for its kind. */
  items: TimelineItem[];
  /** Publications and decipherments, for "When we learned it". */
  learned?: LearnedItem[];
  /** Entity id → page slug: ages with a page link to it and are lit. */
  pageByEntity?: Record<string, string>;
  /** Layers shown at first. Default: everything but places. */
  defaultLayers?: LayerId[];
  defaultScale?: ScaleMode;
  /** Light up this entity as well. */
  focusId?: string;
  /** Rows per lane before labels are dropped. Default 10. */
  maxRows?: number;
  /** Accessible name of the band. */
  label?: string;
  /** "modifier" (default): Ctrl/⌘ + wheel zooms, so the page scrolls; "zoom": a plain wheel zooms. */
  wheel?: "zoom" | "modifier";
  /**
   * A draggable year cursor (as on PeriodTimeline; see YearCursor). Bridge it
   * to the atlas bus with `cursor={bus.year}` and
   * `onCursorChange={(y) => bus.setYear(y)}`; the window follows it.
   */
  cursor?: number | null;
  onCursorChange?: (year: number, opts: { final: boolean }) => void;
  /** Years the cursor may take. Default the whole rule. */
  cursorRange?: [number, number];
  cursorStops?: CursorStop[];
  cursorChanges?: number[];
  cursorLabel?: string;
}

const AXIS_Y = 28;
const MM_H = 30;
const FULL: [number, number] = [0, 1];

export function MasterTimeline({
  items,
  learned = [],
  pageByEntity = {},
  defaultLayers = ["ages", "people", "events", "learned"],
  defaultScale = "stretched",
  focusId,
  maxRows = 10,
  label = "Timeline of Indian history",
  wheel,
  cursor = null,
  onCursorChange,
  cursorRange,
  cursorStops,
  cursorChanges,
  cursorLabel = "Year",
}: MasterTimelineProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  useMeasuredText(); // re-render with measured label widths once the UI font has loaded
  const marks = useMemo(
    () => buildMarks(items, learned, pageByEntity, focusId),
    [items, learned, pageByEntity, focusId],
  );
  const counts = useMemo(() => {
    const c = Object.fromEntries(LAYERS.map((l) => [l.id, 0])) as Record<LayerId, number>;
    for (const m of marks) c[m.layer]++;
    return c;
  }, [marks]);

  const [layers, setLayers] = useState<LayerId[]>(defaultLayers);
  const [mode, setMode] = useState<ScaleMode>(defaultScale);
  const from = useMemo(() => Math.min(DEEP_START, ...marks.map((m) => m.e.start)), [marks]);
  const U = useMemo(() => unitScale(mode, from, NOW), [mode, from]);

  const [wrapRef, W] = useWidth<HTMLDivElement>(1248);
  const compact = W < 640;
  const X0 = compact ? 12 : 136;
  const X1 = W - (compact ? 12 : 20);
  const plotW = Math.max(1, X1 - X0);

  const { win, setWin, span, zoomIn, zoomOut, showAll, bandProps } = useTimeWindow({
    wheel: wheel ?? "modifier",
    home: FULL,
    X0,
    plotW,
  });
  const px = (year: number) => X0 + ((U(year) - win[0]) / (win[1] - win[0])) * plotW;
  const yearAt = (x: number) => U.invert(win[0] + ((x - X0) / plotW) * (win[1] - win[0]));

  const changeMode = (next: ScaleMode) => {
    if (next === mode) return;
    const nextU = unitScale(next, from, NOW);
    setWin(([a, b]) => (b - a >= 0.999 ? FULL : [nextU(U.invert(a)), nextU(U.invert(b))]));
    setMode(next);
  };

  // Rows only grow while you pan and zoom, so the band does not jump in height.
  const hw = useRef<{ key: string; rows: Partial<Record<LayerId, number>> }>({ key: "", rows: {} });
  const hwKey = `${mode}|${layers.join(",")}|${Math.round(W / 80)}|${span >= 0.999}`;
  if (hw.current.key !== hwKey) hw.current = { key: hwKey, rows: {} };

  const { picked, onPick, clear } = usePick(onCursorChange, cursorRange);
  const active = LAYERS.filter((l) => layers.includes(l.id));
  const lanes = renderLanes({
    onPick,
    picked: picked?.key ?? null,
    marks,
    layers: active,
    px,
    X0,
    X1,
    top: AXIS_Y + 22,
    palette: PAPER_PALETTE,
    sizes: ROOMY,
    uid,
    titles: compact ? "top" : "side",
    gutterX: 16,
    maxRows: (id) => (id === "ages" ? (compact ? 14 : Math.min(10, maxRows)) : maxRows),
    minRows: (id) => hw.current.rows[id] ?? 0,
  });
  Object.assign(hw.current.rows, lanes.rows);
  const H = (active.length ? lanes.bottom : AXIS_Y + 60) + 16;
  const visibleFrom = yearAt(X0);
  const visibleTo = yearAt(X1);

  // Keep the cursor in view when it is set from elsewhere (the atlas, Play).
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
  const cursorX = cursor === null ? null : px(cursor);
  const yearsShown = Math.max(1, visibleTo - visibleFrom);
  const cursorStep = [1, 2, 5, 10, 25, 50, 100, 250].find((st) => st >= yearsShown / 120) ?? 250;

  // ---- minimap ------------------------------------------------------------
  const ageMarks = useMemo(() => marks.filter((m) => m.layer === "ages"), [marks]);
  const mmx = (u: number) => X0 + u * plotW;
  const mmU = (clientX: number, el: Element) =>
    (clientX - el.getBoundingClientRect().left - X0) / plotW;
  const brush = useRef<{
    mode: "move" | "left" | "right" | "select";
    anchor: number;
    win: [number, number];
    startX: number;
    moved: boolean;
  } | null>(null);
  const onMmDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const uu = mmU(e.clientX, e.currentTarget);
    const xL = mmx(win[0]);
    const xR = mmx(win[1]);
    const xp = mmx(uu);
    const modeB =
      Math.abs(xp - xL) <= 6
        ? "left"
        : Math.abs(xp - xR) <= 6
          ? "right"
          : xp > xL && xp < xR
            ? "move"
            : "select";
    brush.current = { mode: modeB, anchor: uu, win, startX: e.clientX, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMmMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const b = brush.current;
    if (!b) return;
    if (!b.moved && Math.abs(e.clientX - b.startX) < 3) return;
    b.moved = true;
    const uu = Math.min(1, Math.max(0, mmU(e.clientX, e.currentTarget)));
    if (b.mode === "move") {
      const d = uu - b.anchor;
      setWin([b.win[0] + d, b.win[1] + d]);
    } else if (b.mode === "left") setWin([Math.min(uu, b.win[1] - MIN_SPAN), b.win[1]]);
    else if (b.mode === "right") setWin([b.win[0], Math.max(uu, b.win[0] + MIN_SPAN)]);
    else setWin([Math.min(uu, b.anchor), Math.max(uu, b.anchor)]);
  };
  const onMmUp = () => {
    const b = brush.current;
    if (b && !b.moved && b.mode === "select") {
      const s = b.win[1] - b.win[0];
      setWin(clampWin([b.anchor - s / 2, b.anchor + s / 2]));
    }
    brush.current = null;
  };

  const windowText = `${yearLabel(Math.max(from, visibleFrom))} to ${
    visibleTo >= NOW - 1 ? "now" : yearLabel(visibleTo)
  }`;

  return (
    <div className="font-sans" ref={wrapRef}>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-3">
        <span className="text-sm text-ink-3">Show</span>
        <ToggleGroup
          multiple
          value={layers}
          onValueChange={(v) => setLayers(LAYERS.map((l) => l.id).filter((id) => v.includes(id)))}
          spacing={1.5}
          className="flex-wrap"
          aria-label="Layers"
        >
          {LAYERS.map((l) => {
            const on = layers.includes(l.id);
            return (
              <ToggleGroupItem
                key={l.id}
                value={l.id}
                // A tag (docs/visual.md §4): evidence when on, neutral when off.
                className={cn(
                  badgeVariants({ variant: on ? "evidence" : "neutral" }),
                  "h-7 gap-1.5 px-2 hover:text-ink aria-pressed:bg-indigo-wash aria-pressed:text-indigo",
                )}
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px]"
                  style={{ background: on ? l.swatch : "var(--rule)" }}
                />
                {l.label}
                {counts[l.id] > 0 && (
                  <span className="font-normal text-ink-3 tabular">{counts[l.id]}</span>
                )}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        <span className="hidden flex-1 md:block" />
        <ToggleGroup
          value={[mode]}
          onValueChange={(v) => v[0] && changeMode(v[0] as ScaleMode)}
          spacing={0}
          aria-label="Scale"
          className="gap-1"
        >
          <ToggleGroupItem
            value="true"
            title="Every century the same width"
            className="relative h-[30px] rounded-sm bg-transparent px-2 text-sm font-medium text-ink-3 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-ink after:opacity-0 hover:bg-transparent hover:text-ink aria-pressed:bg-transparent aria-pressed:text-ink aria-pressed:after:opacity-100"
          >
            True scale
          </ToggleGroupItem>
          <ToggleGroupItem
            value="stretched"
            title="The early millennia squeezed, so recent centuries have room"
            className="relative h-[30px] rounded-sm bg-transparent px-2 text-sm font-medium text-ink-3 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-ink after:opacity-0 hover:bg-transparent hover:text-ink aria-pressed:bg-transparent aria-pressed:text-ink aria-pressed:after:opacity-100"
          >
            Stretched
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={zoomIn}
            disabled={span <= MIN_SPAN * 1.01}
            aria-label="Zoom in"
            className="size-[30px] rounded-md bg-paper text-ink-2"
          >
            <Plus />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={zoomOut}
            disabled={span >= 0.999}
            aria-label="Zoom out"
            className="size-[30px] rounded-md bg-paper text-ink-2"
          >
            <Minus />
          </Button>
          {span < 0.999 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={showAll}
              className="h-[30px] text-sm text-indigo"
            >
              Show all
            </Button>
          )}
        </div>
      </div>

      {/* What was picked on the band, above it (a tall band would push it out of view). */}
      <PickedLine mark={picked} onClear={clear} reserve={Boolean(onPick)} />
      {/* The band */}
      <div className="border-y border-rule pt-3 pb-3 text-ink-2">
        <div
          {...bandProps}
          role="group"
          aria-roledescription="timeline"
          aria-label={`${label}. Showing ${windowText}. Left and right move, up and down go through the items, Enter ${onPick ? "picks" : "opens"} one, plus and minus zoom, 0 shows everything.`}
          className="relative cursor-grab touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
        >
          <svg
            width="100%"
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="block overflow-visible text-xs tabular"
            fontFamily="var(--font-sans)"
          >
            <defs>
              <clipPath id={`${uid}-clip`}>
                <rect x={X0 - 6} y={0} width={plotW + 12} height={H} />
              </clipPath>
              {lanes.defs}
            </defs>
            {renderAxis({
              px,
              X0,
              X1,
              y: AXIS_Y,
              bottom: H,
              from,
              visibleFrom,
              visibleTo,
              mode,
              palette: PAPER_PALETTE,
              avoid:
                cursorX === null
                  ? null
                  : [
                      cursorX - (textWidth(shortYear(cursor!), 11) + 14) / 2,
                      cursorX + (textWidth(shortYear(cursor!), 11) + 14) / 2,
                    ],
            })}
            {active.length ? (
              lanes.nodes
            ) : (
              <text x={X0} y={AXIS_Y + 34} fill={PAPER_PALETTE.lane} fontStyle="italic">
                Choose a layer above to see it here.
              </text>
            )}
            {cursorX !== null && cursorX >= X0 - 1 && cursorX <= X1 + 1 && (
              <g pointerEvents="none">
                <line
                  x1={cursorX}
                  x2={cursorX}
                  y1={AXIS_Y}
                  y2={H}
                  stroke={PAPER_PALETTE.on}
                  strokeWidth={1.5}
                  strokeOpacity={0.9}
                />
                <circle cx={cursorX} cy={AXIS_Y} r={3.5} fill={PAPER_PALETTE.on} />
              </g>
            )}
          </svg>
          {cursor !== null && onCursorChange && (
            <YearCursor
              year={cursor}
              onChange={onCursorChange}
              range={cursorRange ?? [Math.round(from), NOW - 1]}
              stops={cursorStops ?? []}
              changes={cursorChanges}
              px={px}
              yearAt={yearAt}
              X0={X0}
              X1={X1}
              strip={AXIS_Y + 10}
              step={cursorStep}
              label={cursorLabel}
              tone="paper"
            />
          )}
        </div>

        {/* Minimap with a brush: drag across it to choose a stretch of time */}
        <svg
          width="100%"
          height={MM_H}
          viewBox={`0 0 ${W} ${MM_H}`}
          className="mt-1 block cursor-crosshair touch-none select-none"
          onPointerDown={onMmDown}
          onPointerMove={onMmMove}
          onPointerUp={onMmUp}
          onPointerCancel={onMmUp}
          aria-hidden
        >
          <line x1={X0} x2={X1} y1={MM_H / 2} y2={MM_H / 2} stroke={PAPER_PALETTE.tick} />
          {ageMarks.map((m, i) => (
            <rect
              key={m.key}
              x={mmx(U(m.e.start))}
              y={MM_H / 2 - 5 + (i % 2) * 5}
              width={Math.max(1.5, mmx(U(m.e.end)) - mmx(U(m.e.start)))}
              height={4}
              rx={1}
              fill={m.hot ? PAPER_PALETTE.on : PAPER_PALETTE.era}
            />
          ))}
          <rect
            x={mmx(win[0])}
            y={2}
            width={Math.max(3, mmx(win[1]) - mmx(win[0]))}
            height={MM_H - 4}
            rx={3}
            fill={PAPER_PALETTE.on}
            fillOpacity={span >= 0.999 ? 0.04 : 0.12}
            stroke={PAPER_PALETTE.on}
            strokeOpacity={span >= 0.999 ? 0.25 : 0.7}
            className="cursor-grab"
          />
          {span < 0.999 &&
            [win[0], win[1]].map((uu, i) => (
              <rect
                key={i}
                x={mmx(uu) - 1.5}
                y={8}
                width={3}
                height={MM_H - 16}
                rx={1}
                fill={PAPER_PALETTE.on}
                className="cursor-ew-resize"
              />
            ))}
        </svg>

        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-3 pt-2 text-xs text-ink-3 sm:px-5">
          <span aria-live="polite" className="tabular">
            {span < 0.999 ? `Showing ${windowText}` : `${yearLabel(from)} to now`}
          </span>
          <span>
            {compact
              ? "Drag to move. Use + and − to zoom."
              : `Drag to move. ${wheel === "zoom" ? "Scroll" : "Hold Ctrl or ⌘ and scroll"} to zoom, or drag across the strip above. Click anything to open it.`}
          </span>
        </div>
      </div>

      <Legend />
    </div>
  );
}

/** How to read the marks; shared with PeriodTimeline (`compact` drops the layer swatches). */
export function Legend({ compact = false }: { compact?: boolean }) {
  const sw = "inline-block h-[7px] w-[26px] rounded-[1px] align-[-1px]";
  return (
    <ul
      className={
        compact
          ? "flex flex-wrap gap-x-3 gap-y-1 pt-2 text-xs text-ink-3"
          : "flex flex-wrap gap-x-5 gap-y-2 px-1 pt-3 text-sm text-ink-2"
      }
    >
      {!compact && (
        <li className="flex items-center gap-2">
          <span aria-hidden className={sw} style={{ background: "var(--indigo)" }} />
          dated
        </li>
      )}
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className={compact ? "inline-block h-[5px] w-[18px] rounded-[1px]" : sw}
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--indigo) 40%, var(--indigo) 60%, transparent)",
          }}
        />
        {compact ? "approximate" : "soft ends: approximate"}
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden
          className={compact ? "inline-block h-[5px] w-[18px] rounded-[1px]" : sw}
          style={{
            background:
              "repeating-linear-gradient(90deg, var(--indigo) 0 3px, transparent 3px 6px)",
          }}
        />
        {compact ? "traditional" : "dotted: traditional, no contemporary record"}
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden className="inline-block size-[7px] rounded-full bg-indigo" />a single year
      </li>
      {!compact && (
        <>
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block size-[8px] rounded-full border-[1.5px] border-indigo"
            />
            when we learned it
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden className={sw} style={{ background: "var(--sandstone)" }} />
            places and inscriptions
          </li>
        </>
      )}
    </ul>
  );
}
