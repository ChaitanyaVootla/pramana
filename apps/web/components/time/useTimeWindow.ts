"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { enableTextMeasuring } from "@/lib/time";

/**
 * Pan and zoom for the layered timelines. The window is a range in UNIT
 * space ([0, 1] is the whole scale, linear or stretched), so the same code
 * serves both scales.
 *
 * Gestures: drag to pan (a click that did not move still follows its link),
 * Ctrl/⌘ + wheel zooms at the pointer, a horizontal swipe pans; plain
 * vertical scrolling is left to the page. Keys: left and right pan (Shift:
 * further), up and down go through the items in view, + and − zoom, 0 or Home
 * resets, Escape returns from an item to the band.
 */

/** Zoom stops for the buttons: each halves the window. */
export const STOPS = [
  1,
  1 / 2,
  1 / 4,
  1 / 8,
  1 / 16,
  1 / 32,
  1 / 64,
  1 / 128,
  1 / 256,
  1 / 512,
  1 / 1024,
];
export const MIN_SPAN = STOPS[STOPS.length - 1]!;

export type Win = [number, number];

export function clampWin([a, b]: Win): Win {
  let span = Math.min(1, Math.max(MIN_SPAN, b - a));
  if (!Number.isFinite(span)) span = 1;
  let lo = (a + b) / 2 - span / 2;
  lo = Math.min(1 - span, Math.max(0, lo));
  return [lo, lo + span];
}

export function useTimeWindow({
  home,
  X0,
  plotW,
  wheel = "modifier",
}: {
  /**
   * "zoom": a plain vertical wheel zooms at the pointer (fine pointers only;
   * for side panels). "modifier": only Ctrl/⌘ + wheel zooms, so the page
   * scrolls under a full-width timeline.
   */
  wheel?: "zoom" | "modifier";
  /** The window to open on and to reset to. */
  home: Win;
  /** Left edge and width of the plot, in px within the band element. */
  X0: number;
  plotW: number;
}) {
  const [win, setWinRaw] = useState<Win>(() => clampWin(home));
  const setWin = useCallback(
    (next: Win | ((w: Win) => Win)) =>
      setWinRaw((w) => {
        const n = clampWin(typeof next === "function" ? next(w) : next);
        // Same window: keep the state, so callers may set it freely (no re-render).
        return Math.abs(n[0] - w[0]) < 1e-12 && Math.abs(n[1] - w[1]) < 1e-12 ? w : n;
      }),
    [],
  );
  const homeKey = `${home[0]}|${home[1]}`;
  const homeRef = useRef(home);
  homeRef.current = home;
  useEffect(() => setWinRaw(clampWin(homeRef.current)), [homeKey]);

  const span = win[1] - win[0];
  const atHome =
    Math.abs(win[0] - clampWin(home)[0]) < 1e-6 && Math.abs(win[1] - clampWin(home)[1]) < 1e-6;

  const zoomTo = useCallback(
    (nextSpan: number, anchorX?: number) =>
      setWin(([a, b]) => {
        const anchor = anchorX === undefined ? (a + b) / 2 : a + ((anchorX - X0) / plotW) * (b - a);
        const k = nextSpan / (b - a);
        return [anchor - (anchor - a) * k, anchor + (b - anchor) * k];
      }),
    [X0, plotW, setWin],
  );
  const zoomIn = () => zoomTo(STOPS.find((s) => s < span * 0.99) ?? MIN_SPAN);
  const zoomOut = () => zoomTo([...STOPS].reverse().find((s) => s > span * 1.01) ?? 1);
  const panBy = (fraction: number) =>
    setWin(([a, b]) => [a + (b - a) * fraction, b + (b - a) * fraction]);
  const reset = () => setWin(home);
  const showAll = () => setWin([0, 1]);

  // Wheel (non-passive, so the page does not scroll while zooming). Only
  // calls preventDefault when the window actually changes, so at the limits
  // the page scrolls on as usual.
  const bandRef = useRef<HTMLDivElement>(null);
  const winRef = useRef(win);
  winRef.current = win;
  useEffect(() => {
    const el = bandRef.current;
    if (!el) return;
    const fine = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
    const plainZooms = wheel === "zoom" && fine;
    const onWheel = (e: WheelEvent) => {
      const [a, b] = winRef.current;
      const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      let next: Win | null = null;
      if (horizontal && !e.ctrlKey && !e.metaKey) {
        const d = (e.deltaX / plotW) * (b - a);
        next = clampWin([a + d, b + d]);
      } else if (e.ctrlKey || e.metaKey || plainZooms) {
        const rect = el.getBoundingClientRect();
        const k = Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
        const anchor = a + ((e.clientX - rect.left - X0) / plotW) * (b - a);
        next = clampWin([anchor - (anchor - a) * k, anchor + (b - anchor) * k]);
      }
      if (!next || (Math.abs(next[0] - a) < 1e-9 && Math.abs(next[1] - b) < 1e-9)) return;
      e.preventDefault();
      setWinRaw(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [X0, plotW, wheel]);

  const drag = useRef<{ x: number; win: Win; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  const bandProps = {
    ref: bandRef,
    tabIndex: 0,
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      drag.current = { x: e.clientX, win, moved: false, id: e.pointerId };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (!d.moved && Math.abs(dx) < 4) return;
      if (!d.moved) {
        d.moved = true;
        // Capture only once it is a drag, so a plain click still reaches its link.
        e.currentTarget.setPointerCapture(d.id);
      }
      const du = (dx / plotW) * (d.win[1] - d.win[0]);
      setWin([d.win[0] - du, d.win[1] - du]);
    },
    onPointerUp: () => {
      if (drag.current?.moved) {
        suppressClick.current = true;
        setTimeout(() => (suppressClick.current = false), 0);
      }
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
    onClickCapture: (e: ReactMouseEvent) => {
      if (suppressClick.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onKeyDown: (e: ReactKeyboardEvent) => {
      const step = e.shiftKey ? 0.5 : 0.1;
      // Up and down go through the items in view (the band is one tab stop;
      // its marks are not), Escape comes back to the band, Enter opens a mark.
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Escape") {
        const band = bandRef.current;
        if (!band) return;
        if (e.key === "Escape") {
          if (document.activeElement === band) return;
          band.focus();
          e.preventDefault();
          return;
        }
        const box = band.getBoundingClientRect();
        const marks = Array.from(band.querySelectorAll<SVGElement>("[data-mark]")).filter((m) => {
          const r = m.getBoundingClientRect();
          return r.right > box.left && r.left < box.right;
        });
        if (!marks.length) return;
        const at = marks.indexOf(document.activeElement as SVGElement);
        const next =
          at < 0
            ? e.key === "ArrowDown"
              ? 0
              : marks.length - 1
            : at + (e.key === "ArrowDown" ? 1 : -1);
        marks[Math.max(0, Math.min(marks.length - 1, next))]!.focus();
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowLeft") panBy(-step);
      else if (e.key === "ArrowRight") panBy(step);
      else if (e.key === "+" || e.key === "=") zoomIn();
      else if (e.key === "-" || e.key === "_") zoomOut();
      else if (e.key === "0" || e.key === "Home") reset();
      else return;
      e.preventDefault();
    },
  };

  return { win, setWin, span, atHome, zoomIn, zoomOut, panBy, reset, showAll, bandProps };
}

/** The element's content width, measured (with a default before mount). */
export function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  /** Whether `width` is measured yet (before that it is `initial`, as on the server). */
  const [measured, setMeasured] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry!.contentRect.width));
      setMeasured(true);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width, measured] as const;
}

/**
 * Measure label widths in the real UI font once it has loaded (and again if
 * fonts change), re-rendering the caller. Before that, widths are estimated.
 */
export function useMeasuredText(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    const enable = () => {
      if (!alive) return;
      // The computed family of the UI face, read from a probe with the font-sans class.
      const probe = document.createElement("span");
      probe.className = "font-sans";
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      document.body.appendChild(probe);
      const family = getComputedStyle(probe).fontFamily;
      probe.remove();
      enableTextMeasuring(family);
      setVersion((v) => v + 1);
    };
    enable();
    document.fonts?.ready.then(enable);
    document.fonts?.addEventListener?.("loadingdone", enable);
    return () => {
      alive = false;
      document.fonts?.removeEventListener?.("loadingdone", enable);
    };
  }, []);
  return version;
}
