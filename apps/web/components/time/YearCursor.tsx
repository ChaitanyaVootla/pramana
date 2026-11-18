"use client";

import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { shortYear } from "@/lib/time";
import { BAND_ON } from "./marks";

/**
 * The draggable year cursor of a timeline (the atlas scrubber), drawn as an
 * HTML overlay on the timeline's axis strip so it is a real slider (WAI-ARIA
 * slider pattern): drag the handle or anywhere on the strip, tap a stop, or
 * use the keys. With `changes` (the years the borders change), the arrows go
 * to the previous or next change, so every press shows something new, and
 * Shift + arrow moves one year; without them the arrows step. Page Up goes to
 * the next stop and Page Down to the previous one (as ARIA sliders increase
 * and decrease), Home and End to the ends of the range. The keys are described
 * to screen readers (aria-describedby).
 * Dragging snaps to stops, then changes, within a few pixels; changes are
 * marked as small ticks under the axis.
 * Pointer events stop here, so the timeline does not pan underneath.
 */

export interface CursorStop {
  year: number;
  label: string;
  /** "peak": the year the subject was largest (drawn differently). */
  kind?: "stop" | "peak";
}

export interface YearCursorProps {
  year: number;
  onChange: (year: number, opts: { final: boolean }) => void;
  range: [number, number];
  stops: CursorStop[];
  /** Year → x within the plot, and back. */
  px: (year: number) => number;
  yearAt: (x: number) => number;
  X0: number;
  X1: number;
  /** Height of the strip (the axis band). */
  strip: number;
  /** Years per arrow press, when there are no changes. */
  step: number;
  /** Years where what the cursor shows changes (borders); sorted or not. */
  changes?: number[];
  /** "paper" (default) on a card; "band" on the deep-indigo master timeline. */
  tone?: "paper" | "band";
  label: string;
}

const SNAP_PX = 7;

/** Change ticks at least 4 px apart, so a busy century reads as a fine comb, not a smear. */
function thin(changes: number[], px: (y: number) => number): number[] {
  const out: number[] = [];
  let last = -Infinity;
  for (const c of [...changes].sort((a, b) => a - b)) {
    const x = px(c);
    if (x - last >= 4) {
      out.push(c);
      last = x;
    }
  }
  return out;
}

export function YearCursor({
  year,
  onChange,
  range,
  stops,
  px,
  yearAt,
  X0,
  X1,
  strip,
  step,
  label,
  changes = [],
  tone = "paper",
}: YearCursorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const drag = useRef<number | null>(null);
  const clamp = (y: number) => Math.round(Math.min(range[1], Math.max(range[0], y)));

  const fromPointer = (clientX: number) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = clientX - rect.left;
    const near =
      stops.find((s) => Math.abs(px(s.year) - x) <= SNAP_PX)?.year ??
      changes.find((c) => Math.abs(px(c) - x) <= SNAP_PX / 2);
    return clamp(near ?? yearAt(x));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = e.pointerId;
    handle.current?.focus({ preventScroll: true });
    onChange(fromPointer(e.clientX), { final: false });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId) return;
    e.stopPropagation();
    onChange(fromPointer(e.clientX), { final: false });
  };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current !== e.pointerId) return;
    drag.current = null;
    e.stopPropagation();
    onChange(fromPointer(e.clientX), { final: true });
  };

  const sorted = [...stops].sort((a, b) => a.year - b.year);
  const onKeyDown = (e: KeyboardEvent) => {
    let next: number | null = null;
    const back = e.key === "ArrowLeft" || e.key === "ArrowDown";
    const fwd = e.key === "ArrowRight" || e.key === "ArrowUp";
    const ch = [...changes].sort((a, b) => a - b);
    if ((back || fwd) && ch.length && !e.shiftKey)
      next = back
        ? ([...ch].reverse().find((c) => c < year) ?? range[0])
        : (ch.find((c) => c > year) ?? range[1]);
    else if (back || fwd) {
      const by = ch.length ? 1 : step * (e.shiftKey ? 10 : 1);
      next = year + (back ? -by : by);
    } else if (e.key === "PageDown")
      // As ARIA sliders do: Page Down goes back (to the previous stop), Page Up on (to the next).
      next = [...sorted].reverse().find((s) => s.year < year)?.year ?? range[0];
    else if (e.key === "PageUp") next = sorted.find((s) => s.year > year)?.year ?? range[1];
    else if (e.key === "Home") next = range[0];
    else if (e.key === "End") next = range[1];
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    onChange(clamp(next), { final: true });
  };

  const x = px(year);
  const visible = x >= X0 - 1 && x <= X1 + 1;
  const at = stops.find((s) => s.year === year);
  const flag = shortYear(year);

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 top-0 cursor-ew-resize touch-none select-none"
      style={{ height: strip }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      {/* Where the borders change: small ticks under the axis. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        {thin(changes, px).map((c) => {
          const cx = px(c);
          return cx < X0 || cx > X1 ? null : (
            <line
              key={c}
              x1={cx}
              x2={cx}
              y1={strip - 9}
              y2={strip - 5}
              stroke={tone === "band" ? BAND_ON : "var(--indigo)"}
              strokeOpacity={0.45}
            />
          );
        })}
      </svg>
      {stops.map((s) => {
        const sx = px(s.year);
        if (sx < X0 - 2 || sx > X1 + 2) return null;
        const on = s.year === year;
        return (
          <button
            key={`${s.kind ?? "stop"}${s.year}`}
            type="button"
            tabIndex={-1}
            title={`${s.label}, ${shortYear(s.year)}`}
            aria-label={`${s.label}, ${shortYear(s.year)}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onChange(s.year, { final: true });
            }}
            className="absolute bottom-0 flex size-6 -translate-x-1/2 translate-y-1/2 items-center justify-center"
            style={{ left: sx, bottom: 9 }}
          >
            <span
              className={cn(
                "block size-2 rotate-45 border transition-colors",
                s.kind === "peak"
                  ? "rounded-full border-sandstone bg-paper"
                  : on
                    ? tone === "band"
                      ? "border-band-on bg-band-on"
                      : "border-indigo bg-indigo"
                    : tone === "band"
                      ? "border-band-on bg-indigo-deep"
                      : "border-indigo bg-paper",
              )}
            />
          </button>
        );
      })}
      <div
        ref={handle}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={range[0]}
        aria-valuemax={range[1]}
        aria-valuenow={year}
        aria-valuetext={at ? `${flag}: ${at.label}` : flag}
        aria-describedby={helpId}
        onKeyDown={onKeyDown}
        className={cn(
          // py-1 makes the handle a 24 px tall target around its 16 px flag.
          "group absolute -top-1 -translate-x-1/2 rounded-sm py-1 outline-none",
          !visible && "pointer-events-none opacity-0",
        )}
        style={{ left: Math.min(X1, Math.max(X0, x)) }}
      >
        <span
          className={cn(
            "block rounded-sm px-1.5 py-px font-sans text-[11px] font-semibold leading-4 whitespace-nowrap tabular ring-offset-2 group-focus-visible:ring-2 group-focus-visible:ring-ring",
            tone === "band"
              ? "bg-band-on text-indigo-deep ring-offset-indigo-deep"
              : "bg-indigo text-paper ring-offset-card",
          )}
        >
          {flag}
        </span>
      </div>
      <span id={helpId} className="visually-hidden">
        {changes.length
          ? "Left and right arrows go to the previous or next change in the borders; with Shift, one year. "
          : `Arrows move ${step} ${step === 1 ? "year" : "years"}; with Shift, ${step * 10}. `}
        {stops.length ? "Page Up and Page Down go to the next or previous turning point. " : ""}
        Home and End go to the first and last year.
      </span>
    </div>
  );
}
