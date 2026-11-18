"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { Mark } from "./lanes";

/**
 * Picking a mark in an explorer (a timeline with a year cursor): the click
 * moves the year to where the item begins and names it under the band, with
 * an explicit link to its page, so exploring never leaves the page by accident.
 */
export function usePick(
  onCursorChange: ((year: number, opts: { final: boolean }) => void) | undefined,
  range: [number, number] | undefined,
) {
  const [picked, setPicked] = useState<Mark | null>(null);
  const onPick = useCallback(
    (m: Mark) => {
      setPicked((cur) => (cur?.key === m.key ? null : m));
      const y = Math.round(m.e.point ? (m.e.start + m.e.end) / 2 : m.e.start);
      const [a, b] = range ?? [-1e5, 1e5];
      onCursorChange?.(Math.min(b, Math.max(a, y)), { final: true });
    },
    [onCursorChange, range],
  );
  const clear = useCallback(() => setPicked(null), []);
  return { picked, onPick: onCursorChange ? onPick : undefined, clear };
}

export function PickedLine({
  mark,
  onClear,
  reserve = false,
}: {
  mark: Mark | null;
  onClear: () => void;
  /** Keep its line even when nothing is picked (above a band, so the band never jumps). */
  reserve?: boolean;
}) {
  return (
    <p
      aria-live="polite"
      className={mark || reserve ? "my-2 min-h-5 truncate font-sans text-sm text-ink-2" : undefined}
    >
      {!mark && reserve && (
        <span className="text-ink-3">
          Click anything on the timeline to move the year to it; its page opens from here.
        </span>
      )}
      {mark && (
        <>
          <span className="font-medium text-ink">{mark.label}</span>
          <span className="tnum text-ink-3">, {mark.e.whenLabel}</span>
          {mark.href && (
            <Link
              href={mark.href}
              className="ml-3 text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo"
            >
              Open the page
            </Link>
          )}
          <button
            type="button"
            onClick={onClear}
            className="ml-3 text-ink-3 underline-offset-3 hover:text-ink hover:underline"
          >
            Clear
          </button>
        </>
      )}
    </p>
  );
}
