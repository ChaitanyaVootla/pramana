"use client";

import type { AtlasSpec } from "@pramana/core";
import type { AtlasExtent, AtlasExtents, MapFeature, TimelineItem } from "@pramana/services";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { MapExtent, MapHighlight } from "@/components/map/MapCanvas";
import { PeriodTimeline } from "@/components/time/PeriodTimeline";
import type { CursorStop } from "@/components/time/YearCursor";
import { Button } from "@/components/ui/button";
import { shortYear, spanLabel } from "@/lib/time";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { useAtlasActions, useAtlasBus, useAtlasSuggest } from "./bus";
import { EmptyState } from "@/components/ui/empty-state";
import { caveatFor, DATASET_NAME, gapNote, gapState } from "./caveats";
import type { MapEmbedConfig } from "./embed";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import { ComparePanel, politiesOf } from "./ComparePanel";
import { MapKey } from "./MapKey";

const MapCanvas = dynamic(() => import("@/components/map/MapCanvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="h-full rounded-md bg-rule-soft" />,
});

/**
 * The atlas: the page's places on a map whose borders shift with the year,
 * over a period timeline whose cursor is the year (drag it, tap a stop, or
 * press Play). One request loads every border of the scrubber's range; moving
 * the year only filters what is already on the map, so scrubbing is instant
 * and the camera never moves on its own.
 *
 * All shared state goes through the atlas bus (components/atlas/bus.tsx): the
 * year, what is hovered, pinned and emphasised. The page can drive it (a date
 * chip sets the year, a claim pins its places); without a provider (e.g. on
 * /places) the atlas keeps the year and the pin itself.
 *
 * The page's own polity and the spec's focus polities are drawn strong, in
 * indigo; neighbours faintly, named in italics. With no focus at all (the
 * places index) every polity is drawn alike.
 */
export interface AtlasProps {
  /** Resolved spec: `focus` holds entity ids. */
  spec: AtlasSpec;
  /** The page's own polity or period. */
  focusEntityId?: string | null;
  /** The page entity's years (astronomical), used when the spec has no range. */
  span: [number, number] | null;
  /** The page's places: always drawn and named. */
  places: MapFeature[];
  /** Dated items for the timeline's lanes. */
  timeline?: TimelineItem[];
  pageByEntity?: Record<string, string>;
  /** rail: side panel, map above a compact timeline; inline: stacked in the page (phones); full: a page of its own. */
  variant?: "rail" | "inline" | "full";
  /** A fixed pixel height for the map (embeds, rails). Leave it out to size by breakpoint classes. */
  mapHeight?: number;
  /**
   * Height classes for the map box ("h-[280px] lg:h-[560px]"): the server paints the final height at every
   * width, so nothing under the map moves after hydration. Wins over `mapHeight`.
   */
  mapHeightClass?: string;
  /** A place on the map was clicked (it is also pinned on the bus). */
  onSelectEntity?: (id: string) => void;
  /**
   * What the atlas is of (the page title: "Maurya Empire"). The timeline reads
   * "<title>, <span>" with the subject's own years, not the padded window.
   */
  title?: string;
  /**
   * Whether `span` is the subject's own years (default). When it is only the
   * stretch of time the atlas shows (a place read in the Maurya age), the
   * timeline says "Years shown: …" instead of pairing it with the title.
   */
  spanIsOwn?: boolean;
  /**
   * Claim id → the ids of the places it is about. At a stop whose claim names
   * a place on the map, the stop's label is written there.
   */
  claimPlaces?: Record<string, string[]>;
  /**
   * A strip (about 160 px of map and the year) while the page needs the room,
   * e.g. while a claim's evidence is open. Toggling never remounts the map or
   * moves the camera.
   */
  collapsed?: boolean;
  /** Draw borders (default true); off, the atlas shows places on the basemap only. */
  borders?: boolean;
  /** A still map at its year: no Play, stops or timeline (an embedded picture of one moment). */
  still?: boolean;
  /** The lines under the map: what is drawn, its source and limits (default true). */
  caption?: boolean;
  /** The year shown changed (settled, not every frame of a drag): for a board saving its item's state. */
  onYearChange?: (year: number) => void;
  /** What the marks mean: "open" shows the key; "toggle" puts a Key button by the controls (default, except in the rail). */
  legend?: "open" | "toggle" | false;
  /**
   * A control beside Compare that takes this map as a board item (canvas's
   * "Add to a board"): given the map as it stands, as an embed config.
   */
  capture?: (config: MapEmbedConfig) => React.ReactNode;
  /** "Add to a board" for the map and for a pinned place (default true; off inside a board). */
  addToCanvas?: boolean;
  /** The page lists the places itself: no hidden list of them for screen readers. */
  listPlaces?: boolean;
  /** Draw the atlas's own period timeline (default true); off where the page has its own scrubber. */
  showTimeline?: boolean;
  /**
   * People who appear on the page only as writers about it (claim role
   * "author": Megasthenes on the Mauryas, Marx on 1857): drawn thin and muted
   * in the people lane, and the last to keep a label.
   */
  writers?: string[];
  /**
   * Rivers the page names (its river entities: id, label and aliases). Their
   * courses are drawn from our Natural Earth river layer: for ages without
   * borders (the Vedic hymns' rivers), and wherever a page is about rivers.
   */
  rivers?: { id: string; names: string[] }[];
  /**
   * Keep the year and the pinned place in the address (?year=-260&pin=kalinga),
   * so a view can be linked and reopened. Default true.
   */
  urlState?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Data: one request per range, shared by every atlas on the page
// ---------------------------------------------------------------------------

const requests = new Map<string, Promise<AtlasExtents>>();

function loadExtents(
  from: number,
  to: number,
  tolerance: number,
  bbox?: [number, number, number, number],
): Promise<AtlasExtents> {
  const q = new URLSearchParams({
    from: String(from),
    to: String(to),
    tolerance: String(tolerance),
  });
  if (bbox) q.set("bbox", bbox.join(","));
  const url = `/api/extents?${q}`;
  let p = requests.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) =>
        r.ok ? (r.json() as Promise<AtlasExtents>) : Promise.reject(new Error(String(r.status))),
      )
      .catch((e: unknown) => {
        requests.delete(url); // a retry fetches again
        throw e;
      });
    requests.set(url, p);
  }
  return p;
}

/** How long a long range may take before its opening century is fetched to draw first. */
const CENTURY_AFTER_MS = 400;

/**
 * Every extent of the range; years outside it (a date chip far from the
 * page's period) load their century on demand.
 */
function useExtents(
  range: [number, number],
  year: number,
  bbox?: [number, number, number, number],
  /** False: fetch nothing (an atlas drawn without borders). */
  enabled = true,
) {
  const [pool, setPool] = useState<Map<string, AtlasExtent>>(() => new Map());
  const [datasets, setDatasets] = useState<AtlasExtents["datasets"]>([]);
  const [loading, setLoading] = useState(true);
  /** The whole range is in (not just the opening century). */
  const [complete, setComplete] = useState(false);
  /** The range's request failed (network, server): said as such, never as "no borders". */
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const tolerance = range[1] - range[0] > 600 ? 0.06 : 0.03;
  const bboxKey = bbox?.join(",");
  const outside = year < range[0] || year > range[1] ? Math.floor(year / 100) * 100 : null;

  const merge = useCallback((d: AtlasExtents) => {
    if (!d.extents.length) return;
    setPool((cur) => {
      const missing = d.extents.filter((e) => !cur.has(e.id));
      if (!missing.length) return cur;
      const next = new Map(cur);
      missing.forEach((e) => next.set(e.id, e));
      return next;
    });
    setDatasets((cur) => {
      const add = d.datasets.filter((x) => !cur.some((c) => c.dataset === x.dataset));
      return add.length ? [...cur, ...add] : cur;
    });
  }, []);

  // A long range (the places index: 3000 BCE to 1950) is a big response. The
  // server keeps it warm, so it usually arrives at once and is the only
  // request; if it is slow (a cold server), the opening year's century is
  // fetched meanwhile and drawn first.
  const openedAt = useRef(year);
  useEffect(() => {
    let alive = true;
    if (!enabled) {
      setLoading(false);
      setComplete(true);
      return;
    }
    let arrived = false;
    const first =
      range[1] - range[0] > 600
        ? setTimeout(() => {
            if (!alive || arrived) return;
            const c = Math.floor(openedAt.current / 100) * 100;
            loadExtents(c, c + 99, tolerance, bbox)
              .then((d) => {
                if (!alive || arrived) return;
                merge(d);
                if (d.extents.length) setLoading(false);
              })
              .catch(() => {}); // the whole range follows (and says so if it fails)
          }, CENTURY_AFTER_MS)
        : null;
    let again: ReturnType<typeof setTimeout> | null = null;
    loadExtents(range[0], range[1], tolerance, bbox)
      .then((d) => {
        arrived = true;
        if (!alive) return;
        merge(d);
        setFailed(false);
        setLoading(false);
        setComplete(true);
      })
      .catch(() => {
        if (!alive) return;
        setFailed(true);
        setLoading(false);
        // Try again by itself, waiting longer each time (1, 2, 4, 8… s, at most 30 s).
        again = setTimeout(
          () => alive && setAttempt((a) => a + 1),
          Math.min(30_000, 1000 * 2 ** attempt),
        );
      });
    return () => {
      alive = false;
      if (again) clearTimeout(again);
      if (first) clearTimeout(first);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range[0], range[1], tolerance, bboxKey, merge, attempt, enabled]);

  useEffect(() => {
    if (outside === null || !enabled) return;
    let alive = true;
    const t = setTimeout(
      () =>
        void loadExtents(outside, outside + 99, tolerance, bbox)
          .then((d) => alive && merge(d))
          .catch(() => {}),
      150,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outside, tolerance, bboxKey, merge]);

  const extents = useMemo(() => [...pool.values()], [pool]);
  return { extents, datasets, loading, complete, failed, retry };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "about 3.9 million km²", "about 450,000 km²". */
function areaLabel(km2: number): string {
  if (km2 >= 1_000_000) return `about ${(km2 / 1_000_000).toFixed(1)} million km²`;
  const r = km2 >= 100_000 ? 10_000 : 1_000;
  return `about ${(Math.round(km2 / r) * r).toLocaleString("en-GB")} km²`;
}

/** The scrubber's years: the spec's, else the subject's span with some air, else the whole historical record we draw. */
function rangeOf(spec: AtlasSpec, span: [number, number] | null): [number, number] {
  if (spec.range) return [Math.min(...spec.range), Math.max(...spec.range)];
  if (span) {
    const pad = Math.max(20, Math.round((span[1] - span[0]) * 0.15));
    return [Math.round(span[0] - pad), Math.round(span[1] + pad)];
  }
  return [-600, 1950];
}

/** The whole record the atlas draws, as /places loads it (and the server keeps warm). */
const RECORD: [number, number] = [-2999, 1950];

/** [west, south, east, north] of the subcontinent, for framing. */
const SUBCONTINENT: [number, number, number, number] = [66, 6, 97, 37];

const NO_EXTENTS: MapExtent[] = [];

/** Height of the map while the atlas is a strip (collapsed). */
const COLLAPSED_H = 160;

const DATASET_CREDIT: Record<string, { text: string; href: string }> = {
  "cliopatria-v0.2.1": {
    text: "Cliopatria (Seshat), CC BY 4.0",
    href: "https://github.com/Seshat-Global-History-Databank/cliopatria",
  },
};

// ---------------------------------------------------------------------------
// The atlas
// ---------------------------------------------------------------------------

export function Atlas({
  spec,
  focusEntityId,
  span,
  places,
  timeline,
  pageByEntity,
  variant = "rail",
  mapHeight,
  mapHeightClass,
  onSelectEntity,
  title,
  spanIsOwn = true,
  urlState = true,
  claimPlaces,
  collapsed = false,
  showTimeline = true,
  borders = true,
  still = false,
  caption: showCaption = true,
  onYearChange,
  legend,
  capture: captureProp,
  addToCanvas = true,
  listPlaces = true,
  writers,
  rivers,
  className,
}: AtlasProps) {
  const bus = useAtlasBus();
  const full = variant === "full";
  const range = useMemo(() => rangeOf(spec, span), [spec, span]);
  const [r0, r1] = range;
  const focusKey = [...spec.focus, focusEntityId ?? ""].join(",");
  const focusIds = useMemo(
    () => new Set([...spec.focus, ...(focusEntityId ? [focusEntityId] : [])]),
    [focusKey],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  // Focus refs are entity ids once resolved; slugs are accepted too.
  const isFocus = useCallback(
    (e: AtlasExtent) =>
      Boolean(
        (e.entityId && focusIds.has(e.entityId)) || (e.entitySlug && focusIds.has(e.entitySlug)),
      ),
    [focusIds],
  );

  // ---- the year: the bus's (or our own), shown at once while dragging or playing
  const [ownYear, setOwnYear] = useState<number | null>(spec.initialYear ?? null);
  const [draft, setDraft] = useState<number | null>(null);
  const draftRef = useRef(draft);
  /** The reader has moved the year or pinned something (only then is the address kept). */
  const urlTouched = useRef(false);
  /** A second year to compare with (the reader's choice), or none. */
  const [compareYear, setCompareYear] = useState<number | null>(null);
  draftRef.current = draft;
  const committedRaw = bus.live ? bus.year : ownYear;
  const {
    extents: pool,
    datasets,
    loading,
    complete,
    failed,
    retry,
  } = useExtents(range, draft ?? committedRaw ?? r0, spec.bounds, borders);

  // The focus polity at its largest: the default year, and a mark on the scrubber.
  const peak = useMemo(() => {
    let best: AtlasExtent | null = null;
    for (const e of pool)
      if (
        isFocus(e) &&
        (e.areaKm2 ?? 0) > (best?.areaKm2 ?? 0) &&
        e.toYear >= r0 &&
        e.fromYear <= r1
      )
        best = e;
    return best;
  }, [pool, isFocus, r0, r1]);
  const defaultYear =
    spec.initialYear ?? (peak ? Math.max(r0, peak.fromYear) : Math.round((r0 + r1) / 2));
  const committed = committedRaw ?? defaultYear;
  const year = draft ?? committed;
  const yearRef = useRef(year);
  yearRef.current = year;

  const write = useCallback(
    (y: number) => {
      if (bus.live) bus.setYear(y);
      else setOwnYear(y);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bus.live, bus.setYear],
  );
  // While dragging, the map follows every move; the bus hears at most a few times a second.
  const lastWrite = useRef(0);
  const setYear = useCallback(
    (y: number, opts: { final: boolean }) => {
      urlTouched.current = true;
      if (opts.final) {
        setDraft(null);
        write(y);
        return;
      }
      setDraft(y);
      const now = performance.now();
      if (now - lastWrite.current > 300) {
        lastWrite.current = now;
        write(y);
      }
    },
    [write],
  );

  // The settled year, for whoever keeps the atlas's state (a board item).
  const yearChangeRef = useRef(onYearChange);
  yearChangeRef.current = onYearChange;
  const reportedYear = useRef(committed);
  useEffect(() => {
    if (committed === reportedYear.current) return;
    reportedYear.current = committed;
    yearChangeRef.current?.(committed);
  }, [committed]);

  // ---- a year chosen elsewhere (a date chip, a claim): glide to it
  const glide = useRef(0);
  const [moved, setMoved] = useState<number | null>(null);
  const movedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seenNonce = useRef(bus.yearNonce);
  useEffect(() => {
    if (bus.yearNonce === seenNonce.current) return;
    seenNonce.current = bus.yearNonce;
    urlTouched.current = true;
    const target = bus.year;
    if (target === null) return;
    // The year shown before this commit (yearRef already holds the new one).
    const from = shownBefore.current;
    if (target !== from) {
      setMoved(target);
      clearTimeout(movedTimer.current);
      movedTimer.current = setTimeout(() => setMoved(null), 3000);
    }
    if (reducedMotion() || from === target) return;
    cancelAnimationFrame(glide.current);
    const t0 = performance.now();
    const dur = 650;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - (1 - k) ** 3;
      if (k < 1) {
        setDraft(Math.round(from + (target - from) * e));
        glide.current = requestAnimationFrame(step);
      } else setDraft(null);
    };
    glide.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(glide.current);
  }, [bus.yearNonce, bus.year]);
  // Declared after the effect above, so that effect still sees the year shown before.
  const shownBefore = useRef(year);
  useEffect(() => {
    shownBefore.current = year;
  });

  // ---- stops: the spec's turning points, and the focus polity's largest extent
  const stops = useMemo(() => [...spec.stops].sort((a, b) => a.year - b.year), [spec.stops]);
  const cursorStops = useMemo<CursorStop[]>(() => {
    const s: CursorStop[] = stops.map((x) => ({ year: x.year, label: x.label }));
    if (peak && !s.some((x) => x.year === Math.max(r0, peak.fromYear)))
      s.push({
        year: Math.max(r0, peak.fromYear),
        label: `${peak.name} at its largest`,
        kind: "peak",
      });
    return s;
  }, [stops, peak, r0]);
  const atStop = stops.find((s) => s.year === year) ?? null;
  const prevStop = [...stops].reverse().find((s) => s.year < year) ?? null;
  const nextStop = stops.find((s) => s.year > year) ?? null;

  const playSpan = useMemo<[number, number]>(() => {
    if (!span) return range;
    const a = Math.max(r0, Math.floor(span[0]));
    // The span ends where the next year begins (-183.0…): its last year is the floor.
    const b = Math.min(r1, Math.floor(span[1]));
    return a < b ? [a, b] : range;
  }, [span, range, r0, r1]);
  // ---- play: move through the range (reduced motion: hop from one change of borders to the next)
  const [playing, setPlaying] = useState(false);
  // Years where the borders that matter change: the focus polities' (or, with
  // no focus, the large states' and culture areas') outlines begin or end. The
  // scrubber snaps to them and the arrows step between them.
  const borderChanges = useMemo(() => {
    const ys = new Set<number>();
    for (const e of pool) {
      if (focusIds.size ? !isFocus(e) : (e.areaKm2 ?? 0) < 400_000 && e.entityKind !== "culture")
        continue;
      for (const y of [e.fromYear, e.toYear + 1]) if (y > r0 && y <= r1) ys.add(y);
    }
    return [...ys].sort((a, b) => a - b);
  }, [pool, r0, r1, focusIds, isFocus]);
  const changes = useMemo(
    () => [...new Set([...borderChanges, ...stops.map((s) => s.year)])].sort((a, b) => a - b),
    [borderChanges, stops],
  );
  useEffect(() => {
    if (!playing) return;
    // Play covers the subject's own years (its span, within the range), else the range.
    const [p0, p1] = playSpan;
    const start = yearRef.current >= p1 || yearRef.current < p0 ? p0 : yearRef.current;
    if (reducedMotion()) {
      let y = start;
      const hop = () => {
        const next = changes.find((c) => c > y) ?? p1;
        y = next;
        setYear(y, { final: y >= p1 });
        if (y >= p1) setPlaying(false);
      };
      hop();
      const id = setInterval(hop, 1400);
      return () => clearInterval(id);
    }
    // About 12 s for a short period, up to 24 s for the whole record.
    const perSecond = (p1 - p0) / Math.min(24, Math.max(12, (p1 - p0) / 100));
    const t0 = performance.now();
    let raf = 0;
    let last = start;
    const tick = (t: number) => {
      const y = Math.min(p1, Math.round(start + ((t - t0) / 1000) * perSecond));
      if (y !== last) {
        last = y;
        setYear(y, { final: y >= p1 });
      }
      if (y >= p1) setPlaying(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // Leave the year where playing stopped.
      const d = draftRef.current;
      setDraft(null);
      if (d !== null) write(d);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const scrub = useCallback(
    (y: number, opts: { final: boolean }) => {
      setPlaying(false);
      setYear(y, opts);
    },
    [setYear],
  );

  // ---- what the map draws
  const styled = useCallback(
    (e: AtlasExtent): MapExtent => ({
      id: e.id,
      name: e.name,
      geometry: e.geometry,
      emphasis: !focusIds.size ? "plain" : isFocus(e) ? "focus" : "neighbour",
      entityId: e.entityId,
      fromYear: e.fromYear,
      toYear: e.toYear,
      yearsLabel: e.yearsLabel,
      labelAt: e.labelAt,
      outline: e.outline,
      culture: e.entityKind === "culture",
      source: DATASET_NAME[e.dataset] ?? e.dataset,
      caveat: caveatFor(e.dataset, e.datasetName, e.fromYear, e.toYear),
      href:
        e.entityId && pageByEntity?.[e.entityId]
          ? `/p/${pageByEntity[e.entityId]}`
          : e.entitySlug
            ? `/e/${e.entitySlug}`
            : null,
    }),
    [focusIds, isFocus, pageByEntity],
  );
  const extents = useMemo<MapExtent[]>(
    () => pool.filter((e) => spec.neighbours || isFocus(e)).map(styled),
    [pool, isFocus, spec.neighbours, styled],
  );
  // ---- comparing two states, each at its largest, whatever their years
  const [comparing, setComparing] = useState(false);
  const [pair, setPairState] = useState<[string | null, string | null]>([null, null]);
  // Every state the atlas has borders for, loaded when Compare opens: a page's
  // own range holds only its neighbours in time (the Mauryas', not the Guptas').
  const [record, setRecord] = useState<AtlasExtent[] | null>(null);
  useEffect(() => {
    if (!comparing || record) return;
    let alive = true;
    loadExtents(RECORD[0], RECORD[1], 0.06)
      .then((d) => alive && setRecord(d.extents))
      .catch(() => alive && setRecord([]));
    return () => {
      alive = false;
    };
  }, [comparing, record]);
  const comparable = useMemo(() => {
    if (!record?.length) return pool;
    const ids = new Set(pool.map((e) => e.id));
    return [...pool, ...record.filter((e) => !ids.has(e.id))];
  }, [pool, record]);
  const polities = useMemo(() => politiesOf(comparable), [comparable]);
  // The page's own state, which Compare starts from.
  const subjectKey = useMemo(() => {
    const own = (id: string | null | undefined) =>
      id ? pool.find((e) => e.entityId === id || e.entitySlug === id)?.entityId : undefined;
    return own(focusEntityId) ?? spec.focus.map(own).find(Boolean) ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, focusEntityId, focusKey]);
  const pairOf = (k: string | null) => (k ? polities.find((p) => p.key === k) : undefined);
  const pairA = pairOf(pair[0]);
  const pairB = pairOf(pair[1]);
  const paired = pairA && pairB ? ([pairA, pairB] as const) : null;
  const pairYear = paired
    ? Math.round((paired[0].peak.fromYear + paired[0].peak.toYear) / 2)
    : null;
  // Moving the year (a drag, Play, a date elsewhere) ends the pair: the map follows the year again.
  const pairFrom = useRef<number | null>(null);
  const setPair = (next: [string | null, string | null]) => {
    pairFrom.current = year;
    setPairState(next);
  };
  useEffect(() => {
    if (pairFrom.current !== null && year !== pairFrom.current) {
      pairFrom.current = null;
      setPairState([null, null]);
    }
  }, [year]);
  const pairExtents = useMemo<MapExtent[] | null>(
    () =>
      paired
        ? comparable.flatMap((e): MapExtent[] =>
            e.id === paired[0].peak.id
              ? [{ ...styled(e), emphasis: "focus" as const }]
              : e.id === paired[1].peak.id
                ? [{ ...styled(e), emphasis: "plain" as const }]
                : [],
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparable, styled, paired?.[0].peak.id, paired?.[1].peak.id],
  );
  const pairFrame = useMemo(() => {
    if (!paired) return null;
    const [a, b] = [paired[0].peak.bbox, paired[1].peak.bbox];
    return {
      key: `${paired[0].peak.id}|${paired[1].peak.id}`,
      bounds: [
        Math.min(a[0], b[0]),
        Math.min(a[1], b[1]),
        Math.max(a[2], b[2]),
        Math.max(a[3], b[3]),
      ] as [number, number, number, number],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paired?.[0].peak.id, paired?.[1].peak.id]);

  const inForce = pool.filter(
    (e) => e.fromYear <= year && e.toYear >= year && (spec.neighbours || isFocus(e)),
  );
  const focusNow = inForce.filter((e) => isFocus(e));
  // Known limits of what is drawn this year, said once under the map.
  const caveats = [
    ...new Set(
      inForce.flatMap((e) => {
        const c = caveatFor(e.dataset, e.datasetName, e.fromYear, e.toYear);
        return c ? [`${e.name}: ${c}`] : [];
      }),
    ),
  ];

  // ---- pointing: the bus's, or our own pin without one
  const [ownPin, setOwnPin] = useState<MapHighlight["pinned"]>(null);
  const pinNonce = useRef(0);
  const highlight = useMemo<MapHighlight>(
    () =>
      bus.live
        ? { hover: bus.hover, pinned: bus.pinned, emphasis: bus.emphasis }
        : { pinned: ownPin },
    [bus.live, bus.hover, bus.pinned, bus.emphasis, ownPin],
  );
  const selectRef = useRef(onSelectEntity);
  selectRef.current = onSelectEntity;
  const onSelect = useCallback(
    (id: string) => {
      if (bus.live) bus.pin([id], { frame: false });
      else
        setOwnPin((cur) =>
          cur?.ids.length === 1 && cur.ids[0] === id
            ? null
            : { ids: [id], nonce: ++pinNonce.current, frame: false },
        );
      selectRef.current?.(id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bus.live, bus.pin],
  );
  // A place hovered on the map lights it elsewhere on the page too (its chip, its row).
  const onHoverEntity = useCallback(
    (id: string | null) => {
      if (bus.live) bus.setHover(id ? [id] : []);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bus.live, bus.setHover],
  );
  const onUnpin = useCallback(
    () => (bus.live ? bus.clearPin() : setOwnPin(null)),
    [bus.live, bus.clearPin],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- the address: ?year=…&pin=… (read once on arrival, then kept up to date quietly)
  const pinnedIds = highlight.pinned?.ids ?? [];
  const pinKey = pinnedIds.join(",");
  const slugOf = useCallback(
    (id: string) =>
      places.find((p) => p.id === id)?.slug ??
      pool.find((e) => e.entityId === id)?.entitySlug ??
      id,
    [places, pool],
  );
  const urlRead = useRef(false);
  useEffect(() => {
    if (!urlState || urlRead.current) return;
    urlRead.current = true;
    const q = new URLSearchParams(window.location.search);
    const y = Number(q.get("year"));
    if (q.has("year") && Number.isFinite(y)) {
      urlTouched.current = true;
      write(Math.round(y));
    }
    const c = Number(q.get("compare"));
    if (q.has("compare") && Number.isFinite(c)) {
      urlTouched.current = true;
      setCompareYear(Math.round(c));
    }
    const pin = q.get("pin");
    const f = pin ? places.find((p) => p.slug === pin || p.id === pin) : undefined;
    if (f) {
      urlTouched.current = true;
      if (bus.live) bus.pin([f.id], { frame: true, toggle: false });
      else setOwnPin({ ids: [f.id], nonce: ++pinNonce.current, frame: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlState]);
  useEffect(() => {
    if (!urlState || !urlRead.current) return;
    // Leave the address alone until the reader changes something.
    if (!urlTouched.current && !pinKey) return;
    const t = setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("year", String(committed));
      if (pinnedIds.length === 1) url.searchParams.set("pin", slugOf(pinnedIds[0]!));
      else url.searchParams.delete("pin");
      if (compareYear !== null) url.searchParams.set("compare", String(compareYear));
      else url.searchParams.delete("compare");
      if (url.href !== window.location.href)
        window.history.replaceState(window.history.state, "", url);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, pinKey, urlState, compareYear]);

  // At a stop, its label on the map at the place its claim is about.
  const stopClaim = atStop?.claimId;
  const annotations = useMemo(() => {
    if (!atStop || !stopClaim) return [];
    const ids = claimPlaces?.[stopClaim] ?? [];
    return places
      .filter((p) => ids.includes(p.id) && p.geo.geometry.type === "Point")
      .slice(0, 1)
      .map((p) => ({
        id: p.id,
        at: p.geo.geometry.coordinates as [number, number],
        text: atStop.label,
      }));
  }, [atStop, stopClaim, claimPlaces, places]);

  // What changed between the year compared with and the year shown: only what
  // the extents say (which states are drawn, and the focus's area as the
  // dataset gives it).
  const comparison = useMemo(() => {
    if (paired) {
      const [a, b] = paired;
      const about = (p: (typeof paired)[number]) =>
        `${p.name}, ${p.peak.yearsLabel}${p.peak.areaKm2 ? `, ${areaLabel(p.peak.areaKm2)}` : ""}`;
      return {
        title: "Each at its largest, as the borders dataset draws it:",
        text: `${about(a)} (filled); ${about(b)} (dotted).`,
        rows: [about(a), about(b)] as [string, string],
      };
    }
    if (compareYear === null || compareYear === year) return null;
    // Until the whole range is in, a year outside the opening century has no borders yet.
    if (!complete)
      return {
        title: `${shortYear(compareYear)} (dotted) and ${shortYear(year)}:`,
        text: "loading the borders of both years…",
      };
    const at = (y: number) =>
      pool.filter((e) => e.fromYear <= y && e.toYear >= y && (spec.neighbours || isFocus(e)));
    const key = (e: AtlasExtent) => e.entityId ?? e.name;
    const a = at(compareYear);
    const b = at(year);
    const ka = new Set(a.map(key));
    const kb = new Set(b.map(key));
    const byArea = (xs: AtlasExtent[]) =>
      [...new Map(xs.map((e) => [key(e), e])).values()].sort(
        (x, y) => (y.areaKm2 ?? 0) - (x.areaKm2 ?? 0),
      );
    const list = (xs: AtlasExtent[]) =>
      xs.length > 4
        ? `${xs
            .slice(0, 4)
            .map((e) => e.name)
            .join(", ")} and ${xs.length - 4} more`
        : xs.map((e) => e.name).join(", ");
    const appeared = byArea(b.filter((e) => !ka.has(key(e))));
    const gone = byArea(a.filter((e) => !kb.has(key(e))));
    const areaOf = (xs: AtlasExtent[]) =>
      xs.filter(isFocus).reduce((n, e) => n + (e.areaKm2 ?? 0), 0);
    const [fa, fb] = [areaOf(a), areaOf(b)];
    const parts: string[] = [];
    if (focusIds.size && (fa || fb) && fa !== fb) {
      const d = fb - fa;
      // The focus by the name it has in the later year (or the earlier).
      const name = (b.find(isFocus) ?? a.find(isFocus))?.name ?? "The focus";
      parts.push(
        !fb
          ? `${name}: no longer drawn`
          : !fa
            ? `${name}: not yet drawn in ${shortYear(compareYear)}`
            : `${name}: ${d > 0 ? "larger" : "smaller"} by ${areaLabel(Math.abs(d))}`,
      );
    }
    if (appeared.length) parts.push(`drawn now, not then: ${list(appeared)}`);
    if (gone.length) parts.push(`drawn then, not now: ${list(gone)}`);
    if (!parts.length) parts.push("the same states are drawn in both years");
    return {
      title: `${shortYear(compareYear)} (dotted) and ${shortYear(year)}:`,
      text: `${parts.join("; ")}.`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    compareYear,
    year,
    pool,
    isFocus,
    focusIds,
    spec.neighbours,
    complete,
    paired?.[0].key,
    paired?.[1].key,
  ]);

  // The map as a board item: the page's own control, else canvas's "Add to a board".
  const capture =
    captureProp ??
    (addToCanvas
      ? (c: MapEmbedConfig) => (
          <AddToCanvas
            content={{
              kind: "map",
              year: c.year,
              range: c.range,
              places: c.places ?? [],
              focus: c.focus ?? [],
              borders: c.borders,
              bounds: c.bounds,
              title: c.title,
            }}
            what="this map"
            size="xs"
            // In a narrow rail the row is full: the icon alone, its name kept for screen readers. A full atlas
            // shows the label from 768px by CSS, so the row paints the same before and after hydration.
            icon={full ? "narrow" : true}
          />
        )
      : undefined);
  const [modern, setModern] = useState(spec.modernLabels);
  const keyMode = legend ?? (variant === "rail" ? false : "toggle");
  const [keyOpen, setKeyOpen] = useState(keyMode === "open");
  const keyId = useId();
  const credit = datasets.map(
    (d) => DATASET_CREDIT[d.dataset] ?? { text: d.attribution, href: "" },
  );
  // The map's height, as classes the server can paint (a JS media query answers only after hydration and
  // would move everything under the map). A phone keeps the full atlas to about a third of the screen, so
  // what follows it is in reach. Callers with a fixed pixel height (embeds, rails) keep it.
  const heightClass =
    mapHeightClass ??
    (mapHeight === undefined
      ? full
        ? "h-[320px] md:h-[560px]"
        : variant === "inline"
          ? "h-[280px]"
          : "h-[260px]"
      : undefined);
  const height = heightClass ? undefined : mapHeight;
  // The lanes: the ages (periods and cultures), people and events given, but
  // a polity only when it is this atlas's subject (in focus) or has a page.
  // Other states are on the map already; as bars they read as noise (a dynasty
  // spanning the whole rule, a distant empire's colony).
  const items = useMemo(
    () =>
      (timeline ?? []).filter(
        (i) =>
          i.kind !== "polity" ||
          focusIds.has(i.id) ||
          (i.slug !== null && focusIds.has(i.slug)) ||
          Boolean(pageByEntity?.[i.id]),
      ),
    [timeline, focusIds, pageByEntity],
  );
  const focusLabel = focusNow[0]?.name ?? peak?.name ?? "this period";
  const atLargest = peak !== null && focusNow.some((e) => e.id === peak.id);
  // Nothing in force this year (and it is not still loading or failing): the gap, over the map.
  // Not in a narrow rail, where it would cover the map; the caption says it there.
  const gap =
    variant !== "rail" &&
    borders &&
    !collapsed &&
    !loading &&
    !failed &&
    complete &&
    !paired &&
    !inForce.length
      ? gapState(year)
      : null;
  const focusArea = focusNow.reduce((n, e) => n + (e.areaKm2 ?? 0), 0);
  const caption =
    failed && !complete && !inForce.length
      ? "Couldn’t load the borders; trying again."
      : loading
        ? "Loading borders…"
        : focusNow.length
          ? focusNow.length > 2
            ? // Many focus states (the janapadas): name the two smallest, count the rest.
              `${focusNow
                .slice()
                .sort((x, y) => (x.areaKm2 ?? 0) - (y.areaKm2 ?? 0))
                .slice(0, 2)
                .map((e) => e.name)
                .join(
                  ", ",
                )} and ${focusNow.length - 2} more; borders as drawn for ${focusNow[0]!.yearsLabel}`
            : `${focusLabel}${atLargest ? " at its largest" : ""}${focusArea ? `, ${areaLabel(focusArea)}` : ""}; borders as drawn for ${focusNow[0]!.yearsLabel}`
          : inForce.length
            ? `${inForce.length} ${inForce.length === 1 ? "state" : "states"} drawn for ${shortYear(year)}`
            : gapNote(year); // the reason; over the map, the empty state says it at more length
  // The view: the focus polities' borders over the subject's years (the
  // places alone can sit in one corner of an empire). Spec bounds win.
  const focusBounds = useMemo<[number, number, number, number] | undefined>(() => {
    const [a, b] = span ?? range;
    const all = pool
      .filter((e) => isFocus(e) && e.fromYear <= b && e.toYear >= a)
      .map((e) => e.bbox);
    // A focus empire centred outside the subcontinent (the Achaemenids on the
    // Mahājanapadas page) should not pull the view west: frame those centred
    // inside it, if any.
    const inside = all.filter(([w, s0, e, n]) => {
      const [cx, cy] = [(w + e) / 2, (s0 + n) / 2];
      return (
        cx >= SUBCONTINENT[0] &&
        cx <= SUBCONTINENT[2] &&
        cy >= SUBCONTINENT[1] &&
        cy <= SUBCONTINENT[3]
      );
    });
    const boxes = inside.length ? inside : all;
    if (!boxes.length) return undefined;
    return [
      Math.min(...boxes.map((x) => x[0])),
      Math.min(...boxes.map((x) => x[1])),
      Math.max(...boxes.map((x) => x[2])),
      Math.max(...boxes.map((x) => x[3])),
    ];
  }, [pool, isFocus, span, range]);

  return (
    <div data-atlas className={cn("font-sans", className)}>
      {/* The map's height is reserved before it loads (and before hydration), so nothing below it jumps. */}
      <div
        className={cn(
          "transition-[height,min-height] duration-300 ease-out motion-reduce:transition-none",
          !collapsed && heightClass,
        )}
        style={
          collapsed
            ? { height: COLLAPSED_H, minHeight: COLLAPSED_H }
            : height !== undefined
              ? { minHeight: height }
              : undefined
        }
      >
        <MapCanvas
          features={places}
          extents={borders ? (pairExtents ?? extents) : NO_EXTENTS}
          year={pairYear ?? year}
          compareYear={paired ? null : compareYear}
          compareIds={paired ? [paired[1].peak.id] : null}
          frame={pairFrame}
          listPlaces={listPlaces}
          cardAction={
            addToCanvas
              ? (p) => (
                  <AddToCanvas
                    content={{ kind: "entity", entity: p.id }}
                    what={p.label}
                    size="xs"
                  />
                )
              : undefined
          }
          timeWindow={Math.min(80, Math.max(8, Math.round((r1 - r0) * 0.06)))}
          height={collapsed ? COLLAPSED_H : height}
          className={heightClass && !collapsed ? "h-full" : undefined}
          compact={!full}
          focusId={focusEntityId ?? undefined}
          modernLabels={modern}
          bounds={spec.bounds ?? focusBounds}
          waitForBounds={!spec.bounds && focusIds.size > 0 && loading}
          highlight={highlight}
          annotations={collapsed ? undefined : annotations}
          pinCards={!collapsed}
          rivers={rivers}
          label={`Map: ${title ?? focusLabel}, ${shortYear(committed)}, ${places.length} ${places.length === 1 ? "place" : "places"}`}
          onSelectEntity={onSelect}
          onUnpin={onUnpin}
          onHoverEntity={onHoverEntity}
          extentAttribution={
            credit.length ? `Borders: ${credit.map((c) => c.text).join("; ")}` : undefined
          }
        >
          {collapsed ? (
            // The strip: the year as one small chip in a corner, so the map keeps the room.
            <div className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[60%] truncate rounded-md border border-rule bg-paper/90 px-2 text-xs leading-5 text-ink-2 backdrop-blur tabular">
              <span className="font-medium text-ink">{shortYear(year)}</span>
              {atStop && <span className="text-indigo">, {atStop.label}</span>}
            </div>
          ) : paired ? null : (
            <div
              className={cn(
                "pointer-events-none absolute bottom-2 left-2 max-w-[70%] rounded-md bg-paper/90 border border-rule backdrop-blur",
                full ? "px-3 py-2" : "px-2 py-1",
              )}
            >
              <div
                className={cn(
                  "font-serif leading-none text-ink tabular",
                  full ? "text-3xl" : "text-lg",
                )}
              >
                {shortYear(year)}
              </div>
              {atStop && (
                <div className="mt-1 truncate text-xs leading-4 text-indigo">{atStop.label}</div>
              )}
            </div>
          )}
          {/* The page offers a year (the part being read); only a click applies it. */}
          {/* Notes at the top of the map, one under the other, each only when it applies. */}
          {!collapsed && (
            <div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center gap-1.5 px-12">
              {!playing && <SuggestPill year={year} />}
              {/* A click elsewhere moved the map: said here, where it moved (docs/visual.md §6). */}
              {moved !== null && (
                <p
                  role="status"
                  className="animate-in fade-in rounded-md border border-rule bg-paper/95 px-2.5 text-xs leading-6 text-ink-2 backdrop-blur duration-200"
                >
                  Map moved to {shortYear(moved)}
                </p>
              )}
              {/* No borders for the year shown: the gap is shown, not left blank. */}
              {gap && !playing && (
                <EmptyState
                  size="sm"
                  title={gap.title}
                  className="pointer-events-none max-w-sm bg-paper/95 backdrop-blur"
                >
                  {gap.why}
                </EmptyState>
              )}
              {failed && !complete ? (
                // Not "no borders": the request failed. It retries by itself; the button tries now.
                <p className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-paper/95 py-0.5 pr-0.5 pl-2.5 text-xs leading-5 text-ink-2 border border-rule backdrop-blur">
                  Couldn’t load the borders
                  <button
                    type="button"
                    onClick={retry}
                    className="rounded-sm bg-indigo-wash px-2 font-medium text-indigo transition-colors hover:bg-indigo hover:text-paper"
                  >
                    Retry
                  </button>
                </p>
              ) : null}
            </div>
          )}
        </MapCanvas>
      </div>

      {/* Everything below the map steps aside while the atlas is a strip (kept mounted). */}
      <div hidden={collapsed}>
        {/* On a phone the row wraps rather than running off the edge (the Key was clipped at 390). */}
        <div className={cn("mt-2 flex flex-wrap items-center gap-x-1 gap-y-1", still && "hidden")}>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={
              playing
                ? "Pause"
                : `Play from ${shortYear(year >= playSpan[1] || year < playSpan[0] ? playSpan[0] : year)} to ${shortYear(playSpan[1])}`
            }
          >
            {playing ? (
              <Pause data-icon="inline-start" aria-hidden />
            ) : (
              <Play data-icon="inline-start" aria-hidden />
            )}
            {playing ? "Pause" : "Play"}
          </Button>
          {stops.length > 0 && (
            <div
              role="group"
              aria-label="Turning points"
              className="flex min-w-0 flex-1 items-center"
              onKeyDown={(e) => {
                const to =
                  e.key === "ArrowLeft" ? prevStop : e.key === "ArrowRight" ? nextStop : null;
                if (!to) return;
                e.preventDefault();
                scrub(to.year, { final: true });
              }}
            >
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                disabled={!prevStop}
                onClick={() => prevStop && scrub(prevStop.year, { final: true })}
                aria-label={
                  prevStop
                    ? `Previous: ${prevStop.label}, ${shortYear(prevStop.year)}`
                    : "No earlier turning point"
                }
                title={prevStop ? `${prevStop.label}, ${shortYear(prevStop.year)}` : undefined}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                disabled={!nextStop}
                onClick={() => nextStop && scrub(nextStop.year, { final: true })}
                aria-label={
                  nextStop
                    ? `Next: ${nextStop.label}, ${shortYear(nextStop.year)}`
                    : "No later turning point"
                }
                title={nextStop ? `${nextStop.label}, ${shortYear(nextStop.year)}` : undefined}
              >
                <ChevronRight />
              </Button>
              <span className="ml-0.5 min-w-0 truncate text-xs text-ink-3 tabular">
                {/* The long form from 768px, the count below it: by CSS, so a phone's first paint (the server
                    assumes a wide screen) and its hydrated layout agree. */}
                {full ? (
                  <>
                    <span className="hidden md:inline">
                      {nextStop
                        ? `Next: ${nextStop.label}, ${shortYear(nextStop.year)}`
                        : atStop
                          ? `${stops.indexOf(atStop) + 1} of ${stops.length}`
                          : `${stops.length} turning points`}
                    </span>
                    <span className="md:hidden">
                      {atStop ? `${stops.indexOf(atStop) + 1} of ${stops.length}` : ""}
                    </span>
                  </>
                ) : atStop ? (
                  `${stops.indexOf(atStop) + 1} of ${stops.length}`
                ) : (
                  ""
                )}
              </span>
            </div>
          )}
          {/* The toggles, at the right; on a phone a row of their own (not one stray button wrapped). */}
          <div className="ml-auto flex items-center gap-x-1 max-sm:w-full max-sm:justify-end">
            {/* Compare: keep this year, then move the scrubber; its borders stay as a dotted outline. */}
            <Button
              variant={compareYear === null && !paired ? "ghost" : "outline"}
              size="xs"
              className={cn(
                "shrink-0",
                compareYear === null && !paired ? "text-ink-3" : "text-indigo",
              )}
              aria-expanded={compareYear === null && !paired ? comparing : undefined}
              onClick={() => {
                urlTouched.current = true;
                if (compareYear !== null || paired) {
                  setCompareYear(null);
                  setPairState([null, null]);
                  pairFrom.current = null;
                } else {
                  if (!comparing && !pair[0] && !pair[1] && subjectKey)
                    setPairState([subjectKey, null]);
                  setComparing((c) => !c);
                }
              }}
            >
              {compareYear !== null
                ? `Comparing with ${shortYear(compareYear)} ×`
                : paired
                  ? "Stop comparing ×"
                  : "Compare"}
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 text-ink-3"
              aria-pressed={modern}
              onClick={() => setModern((m) => !m)}
            >
              {modern ? "Hide today’s names" : "Today’s names"}
            </Button>
            {capture?.({
              year: committed,
              range,
              places: places.map((p) => p.id),
              focus: [...focusIds],
              borders,
              ...(spec.bounds ? { bounds: spec.bounds } : {}),
              ...(title ? { title } : {}),
            })}
            {keyMode === "toggle" && (
              <Button
                variant="ghost"
                size="xs"
                className="shrink-0 text-ink-3"
                aria-pressed={keyOpen}
                aria-controls={keyOpen ? keyId : undefined}
                onClick={() => setKeyOpen((k) => !k)}
              >
                Key
              </Button>
            )}
          </div>
        </div>
        {comparing && compareYear === null && (
          <ComparePanel
            year={year}
            near={range}
            polities={polities}
            pair={pair}
            onPair={setPair}
            loading={!record}
            onKeepYear={() => {
              setPairState([null, null]);
              pairFrom.current = null;
              setCompareYear(year);
              setComparing(false);
            }}
            onClose={() => {
              setComparing(false);
              setPairState([null, null]);
              pairFrom.current = null;
            }}
          />
        )}
        {keyOpen && keyMode && (
          <MapKey
            id={keyId}
            className="mt-2"
            focusLabel={focusIds.size ? focusLabel : null}
            shows={{
              focus: borders ? focusNow.filter((e) => e.entityKind !== "culture").length : 0,
              others: borders
                ? inForce.filter(
                    (e) => e.entityKind !== "culture" && !(focusIds.size && isFocus(e)),
                  ).length
                : 0,
              cultures: borders ? inForce.filter((e) => e.entityKind === "culture").length : 0,
              places: places.filter((p) => p.kind !== "event").length,
              events: places.filter((p) => p.kind === "event").length,
              uncertain: places.filter((p) => p.geo.certainty !== "exact").length,
              compare: paired
                ? `${paired[1].name} at its largest, to compare`
                : compareYear === null
                  ? null
                  : `Borders in ${shortYear(compareYear)}, to compare`,
            }}
          />
        )}

        {showTimeline && !still && (
          <PeriodTimeline
            className="mt-2"
            items={items}
            focus={{
              from: r0,
              // The timeline's periods end where the next year begins.
              to: r1 + 1,
              id: focusEntityId ?? undefined,
              label: title ?? (full ? "the whole record" : (peak?.name ?? "this period")),
            }}
            pageByEntity={pageByEntity}
            height={full ? 190 : 168}
            compact={!full}
            layers={["ages", "people", "events"]}
            cursor={year}
            onCursorChange={scrub}
            cursorRange={range}
            cursorStops={cursorStops}
            cursorChanges={borderChanges}
            cursorLabel="Year shown on the map"
            quietIds={writers}
            focusCaption={
              !span
                ? undefined
                : !spanIsOwn
                  ? `Years shown: ${spanLabel(span[0], span[1])}`
                  : title
                    ? `${title}, ${spanLabel(span[0], span[1])}`
                    : undefined
            }
          />
        )}

        {rivers && rivers.length > 0 && (
          <p className="mt-2 text-xs leading-5 text-ink-3">
            <span
              className="mr-1.5 inline-block h-0.5 w-4 rounded-full bg-[#2f6fa8] align-middle dark:bg-[#7fb2e0]"
              aria-hidden
            />
            Rivers named on this page, drawn along their present courses (Natural Earth), which may
            differ from ancient ones.
          </p>
        )}
        {comparison && "rows" in comparison && comparison.rows ? (
          // Two states: a key to the map's two styles (filled with a solid edge, unfilled and dotted).
          <div className="mt-2 text-xs leading-5 text-ink-2" aria-live="polite">
            <p className="font-medium text-ink">{comparison.title}</p>
            <ul className="mt-0.5 space-y-0.5">
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-3 w-4 shrink-0 rounded-[2px] border-[1.5px] border-indigo bg-indigo/25"
                  aria-hidden
                />
                <span>
                  <span className="sr-only">Filled: </span>
                  {comparison.rows[0]}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-1 h-3 w-4 shrink-0 rounded-[2px] border-2 border-dotted border-ink"
                  aria-hidden
                />
                <span>
                  <span className="sr-only">Dotted: </span>
                  {comparison.rows[1]}
                </span>
              </li>
            </ul>
          </div>
        ) : (
          comparison && (
            <p className="mt-2 text-xs leading-5 text-ink-2" aria-live="polite">
              <span className="font-medium text-ink">{comparison.title}</span> {comparison.text}
            </p>
          )
        )}
        {/* One line on what is drawn; the source and its limits, quieter, under it. */}
        {/* With borders off there is nothing to say about borders. */}
        {/* Comparing two states, the comparison line above says what is drawn. */}
        {showCaption && borders && !paired && (
          <p className="mt-2 line-clamp-2 min-h-5 text-xs leading-5 text-ink-2" title={caption}>
            {caption}
          </p>
        )}
        {/* Without a caption the credit stays in the map's attribution (its "i" button). */}
        {showCaption && borders && (credit.length > 0 || caveats.length > 0) && (
          <p className="text-[11px] leading-4 text-ink-3">
            {credit.length > 0 && (
              <>
                Borders:{" "}
                {credit.map((c, i) => (
                  <span key={c.text}>
                    {i > 0 && "; "}
                    {c.href ? (
                      <a
                        href={c.href}
                        className="text-ink-3 underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {c.text}
                      </a>
                    ) : (
                      c.text
                    )}
                  </span>
                ))}
                {", reconstructions."}
              </>
            )}
            {caveats.length > 0 && ` ${caveats.join(" ")}`}
          </p>
        )}
      </div>
      {/* The map's content as text: the polities drawn this year. */}
      <div className="visually-hidden">
        <p>Borders drawn for {shortYear(committed)}</p>
        <ul>
          {inForce
            .slice()
            .sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0))
            .map((e) => (
              <li key={e.id}>
                {e.name}
                {e.entityKind === "culture" ? " (a culture area, not a state)" : ""}
                {e.areaKm2 ? `, ${areaLabel(e.areaKm2)}` : ""}, as drawn by{" "}
                {DATASET_NAME[e.dataset] ?? e.dataset} for {e.yearsLabel}
              </li>
            ))}
        </ul>
      </div>
      <span className="visually-hidden" aria-live="polite">
        {draft === null
          ? `Map shows ${shortYear(committed)}${atStop ? `: ${atStop.label}` : ""}`
          : ""}
      </span>
    </div>
  );
}

/**
 * "This part: c. 261 BCE · Show": the year the page offers, while it is not the
 * one shown. It reads the offer from its own context, so a page updating it on
 * every scroll re-renders only this pill, never the map or the timeline.
 */
function SuggestPill({ year }: { year: number }) {
  const suggestion = useAtlasSuggest();
  const { setYear } = useAtlasActions();
  if (!suggestion || suggestion.year === year) return null;
  return (
    <p className="pointer-events-auto flex max-w-full items-center gap-1.5 rounded-md bg-paper/95 py-0.5 pr-0.5 pl-2.5 text-xs leading-5 text-ink-2 border border-rule backdrop-blur">
      <span className="truncate">This part: {suggestion.label}</span>
      <button
        type="button"
        onClick={() => setYear(suggestion.year, { fromReader: true })}
        className="shrink-0 rounded-sm bg-indigo-wash px-2 font-medium text-indigo transition-colors hover:bg-indigo hover:text-paper"
      >
        Show
      </button>
    </p>
  );
}
