"use client";

import { formatYear } from "@pramana/core";
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useAtlasBus } from "@/components/atlas/bus";
import { NOW, unitScale } from "@/lib/time";
import { cn } from "@/lib/utils";

/** How often a drag tells the page's atlas (every bus listener re-renders on a year). */
const WRITE_MS = 120;

/**
 * The live part of the AgeLine (a client island in a server component): on a
 * page with an atlas, the cursor is the map's year, and the lit age's own
 * segment is a slider for it (click, drag, or the arrow keys). Other segments
 * stay links. Without an atlas, or until the map's year moves, it is the line's
 * own cursor (`fallback`). It moves only when the year does.
 */
export function AgeLineLive({
  start,
  lit,
  compact,
  ruleY,
  fallback,
  follow = false,
}: {
  /** The scale's start (AgeLine's `start`), so positions match the server's. */
  start: number;
  /** The lit age: the years the slider covers. */
  lit: { label: string; from: number; to: number };
  compact: boolean;
  ruleY: number;
  /**
   * The server's cursor: the subject's own dates ("reigned c. 268–232 BCE"), or nothing on an
   * era page (its lit bar is the subject). Shown until the map's year moves.
   */
  fallback: ReactNode;
  /** The line is the map's time control (no subject, as on /timeline): show the map's year at once. */
  follow?: boolean;
}) {
  const bus = useAtlasBus();
  const [draft, setDraft] = useState<number | null>(null);
  const lastWrite = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const opened = useRef(bus.year);
  // Said for screen readers when the reader moves the map from here (the chip shows it on screen).
  const [said, setSaid] = useState("");
  if (!bus.live) return <>{fallback}</>;

  const u = unitScale("stretched", start, NOW);
  const pct = (y: number) => Math.min(100, Math.max(0, u(y) * 100));
  const clamp = (y: number) => Math.round(Math.min(lit.to, Math.max(lit.from, y)));
  const year = draft ?? bus.year;
  // The line's own mark stays until the map's year moves from the one the page opened on.
  const showCursor = year !== null && (follow || draft !== null || year !== opened.current);
  const l = pct(lit.from);
  const r = Math.max(pct(lit.to), l + 0.25);

  // The year under the pointer: the slider spans the lit age's segment.
  const yearAt = (clientX: number) => {
    const el = box.current?.parentElement;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return clamp(u.invert((clientX - rect.left) / rect.width));
  };
  const write = (y: number, final: boolean) => {
    const now = performance.now();
    if (final || now - lastWrite.current > WRITE_MS) {
      lastWrite.current = now;
      // A click glides the map there (and says so); a drag moves it as it goes.
      bus.setYear(y, { fromReader: final && !moved.current });
      if (final) setSaid(`Map moved to ${formatYear(y)}`);
    }
  };
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const y = yearAt(e.clientX);
    if (y === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    moved.current = false;
    setDraft(y);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (draft === null) return;
    const y = yearAt(e.clientX);
    if (y === null || y === draft) return;
    moved.current = true;
    setDraft(y);
    write(y, false);
  };
  const onUp = () => {
    if (draft === null) return;
    write(draft, true);
    setDraft(null);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = {
      ArrowLeft: -1,
      ArrowDown: -1,
      ArrowRight: 1,
      ArrowUp: 1,
      PageDown: -10,
      PageUp: 10,
    }[e.key];
    const to =
      e.key === "Home"
        ? lit.from
        : e.key === "End"
          ? lit.to
          : step !== undefined
            ? (year ?? lit.from) + step
            : null;
    if (to === null) return;
    e.preventDefault();
    moved.current = true;
    bus.setYear(clamp(to));
    setSaid(`Map moved to ${formatYear(clamp(to))}`);
  };

  const at = year === null || !showCursor ? null : pct(year);
  const chipAlign =
    at === null
      ? ""
      : at < 8
        ? "translate-x-0"
        : at > 92
          ? "-translate-x-full"
          : "-translate-x-1/2";
  return (
    <>
      {/* The lit age's segment, as a slider for the map's year. */}
      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Year on the map"
        aria-valuemin={lit.from}
        aria-valuemax={lit.to}
        aria-valuenow={year ?? undefined}
        aria-valuetext={year === null ? undefined : formatYear(year)}
        title={`Move the map to a year in ${lit.label}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        // It reads as something to take hold of: a pointer, and on hover a quiet indigo ring over the lit segment.
        className="absolute z-[1] cursor-pointer touch-none rounded-[1px] outline-none transition-shadow duration-150 hover:shadow-[0_0_0_2px_var(--indigo-tint)] active:cursor-ew-resize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        style={{
          // At least 24px wide, so a short age (the Mauryas, on a phone) can still be grabbed.
          left: `calc(${(l + r) / 2}% - max(${(r - l) / 2}%, 12px))`,
          width: `max(${r - l}%, 24px)`,
          top: ruleY - (compact ? 8 : 10),
          height: compact ? 16 : 20,
        }}
      />
      {at === null ? (
        fallback
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute w-px bg-ink"
            style={{ left: `${at}%`, top: compact ? 4 : 8, height: compact ? 16 : 20 }}
          />
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute top-0 rounded-sm bg-ink px-1 text-[11px] leading-[14px] whitespace-nowrap text-chuna tnum",
              chipAlign,
            )}
            style={{ left: `${at}%`, top: compact ? -2 : 0 }}
          >
            {formatYear(year!)}
          </span>
        </>
      )}
      <span role="status" className="sr-only">
        {said}
      </span>
    </>
  );
}
