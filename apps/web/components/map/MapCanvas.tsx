"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import type { Geometry } from "@pramana/core";
import type { MapFeature, PlaceTime } from "@pramana/services";
import type {
  GeoJSONSource,
  Map as MlMap,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Popup,
} from "maplibre-gl";
import { RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { datedLabel } from "@/lib/era";
import { cn } from "@/lib/utils";
import {
  buildBasemapStyle,
  FONT_BOLD,
  FONT_ITALIC,
  FONT_REGULAR,
  paletteFor,
  reliefLayers,
  reliefSources,
  type MapTheme,
} from "./style";
import { StateTweens } from "./tween";
import { timeWeight } from "./time";

export { timeWeight };

/**
 * The map engine shared by the atlas, the full map, the context-rail mini-map
 * and place chips, drawn on our own history basemap (see ./style.ts): relief,
 * rivers, seas and physical regions first; present-day cities and borders only
 * as a faint, optional reference.
 *
 * Encodings: places are sandstone, events turmeric; certainty is opacity for
 * points (solid = exact, lighter = approximate, faint = conjectural).
 * Historical extents (borders) are soft areas with dashed edges, because
 * ancient borders are reconstructions: the subject's polities in indigo, their
 * neighbours faint and in italics.
 *
 * The map is created once (again only when the theme changes). New places,
 * borders, a new `year` or new highlights update its sources in place, so
 * nothing flashes and the camera stays where the reader left it; the camera
 * moves only on first load, on "Reset view", and when something is pinned
 * with `frame`.
 */

export interface MapExtent {
  id: string;
  name: string;
  geometry: Geometry;
  /** The page's own polity, its neighbours, or neither (every polity alike). Default "focus". */
  emphasis?: "focus" | "neighbour" | "plain";
  /** The polity it outlines: hovering or pinning that entity highlights it. */
  entityId?: string | null;
  /** Inclusive astronomical years; with the `year` prop only those in force are drawn. */
  fromYear?: number;
  toYear?: number;
  /** "268–232 BCE", shown when the outline is clicked. */
  yearsLabel?: string;
  /** Where the polity's name links to. */
  href?: string | null;
  /** Where to write its name, [lon, lat]; default: MapLibre places it inside the outline. */
  labelAt?: [number, number];
  /** The line to stroke instead of the polygon's rings (a clipped shape without its cut edges). */
  outline?: Geometry;
  /** A culture area, not a state (the Indus civilisation): hatched, and named as such. */
  culture?: boolean;
  /** Which reconstruction it is ("Cliopatria"), for "as drawn by …". */
  source?: string;
  /** A known limit of the dataset for this outline, said on hover and tap. */
  caveat?: string | null;
}

/** What the reader is pointing at (see components/atlas/bus.tsx). Ids may be any entity; those without geography are ignored. */
export interface MapHighlight {
  hover?: string[];
  pinned?: { ids: string[]; nonce: number; frame: boolean } | null;
  emphasis?: string[];
}

export interface MapCanvasProps {
  features: MapFeature[];
  extents?: MapExtent[];
  /**
   * The year shown: only the extents in force are drawn (instant; no refetch,
   * no camera move), and places fade in and out around their dates (see
   * timeWeight).
   */
  year?: number | null;
  /**
   * A second year to compare with: its borders are drawn as a dotted outline
   * over the year shown (never blended: two reconstructions, side by side).
   */
  compareYear?: number | null;
  /** Outline these extents dotted, whatever their years (two states compared); wins over `compareYear`. */
  compareIds?: string[] | null;
  /** Fit this view when its key changes (the reader chose something to look at). */
  frame?: { key: string; bounds: [number, number, number, number] } | null;
  /** A control in a pinned place's card ("Add to a board"). */
  cardAction?: (place: { id: string; label: string }) => ReactNode;
  /** Keep the hidden list of the places drawn (default true); off where the page lists them itself. */
  listPlaces?: boolean;
  /** How many years before and after its date a place fades over. Default 25. */
  timeWindow?: number;
  /** Pixel height; omit it and give `className` height classes instead, so the server paints the final height. */
  height?: number;
  /** Classes for the map box (its height, e.g. "h-[280px] lg:h-[560px]"); with none, `height` (default 380) applies. */
  className?: string;
  /** Smaller presentation (rail, chips): fewer labels and controls, still zoomable. */
  compact?: boolean;
  /** Feature to emphasise. */
  focusId?: string;
  /** Present-day cities and borders as a faint reference layer. */
  modernLabels?: boolean;
  center?: [number, number];
  zoom?: number;
  /** The view to open on and reset to: [west, south, east, north]. Default: the places and focus borders. */
  bounds?: [number, number, number, number];
  onSelect?: (slug: string) => void;
  /** A place drawn on the map was clicked (instead of the default popup). */
  onSelectEntity?: (id: string, slug: string) => void;
  /** The reader dismissed the pinned place's label. */
  onUnpin?: () => void;
  /** A place on the map is under the pointer (or no longer: null), so the page can light it too. */
  onHoverEntity?: (id: string | null) => void;
  highlight?: MapHighlight;
  /**
   * Draw every other known place faintly underneath (default true), so zooming
   * out shows the wider world rather than an empty map.
   */
  context?: boolean;
  /** Attribution for the borders, added to the map's attribution control. */
  extentAttribution?: string;
  /** No border or rounding (when the map sits flush inside a card). */
  flush?: boolean;
  /** Extra overlay content (the atlas's year), drawn above the map. */
  children?: React.ReactNode;
  /** A click or tap on the map (not a drag), at [lon, lat]. With it, the cursor is a crosshair. */
  onPick?: (lngLat: [number, number]) => void;
  /** Simple markers, updated in place: a guess (indigo ring) or an answer (sandstone dot, named). */
  pins?: MapPin[];
  /** The camera came to rest (after a drag, zoom, key press or fly). */
  onViewChange?: (center: [number, number], zoom: number) => void;
  /**
   * Called once, when the map has first drawn in full: the basemap's first
   * view, and the borders it was given (if any) with it.
   */
  onPainted?: () => void;
  /**
   * Hold the first framing until `bounds` arrive (the atlas fits to its
   * subject's borders once they load), so the map frames once, not twice.
   */
  waitForBounds?: boolean;
  /**
   * A pinned place gets a small card (default). Off (the atlas as a strip):
   * only its ring and its name, so nothing covers the map.
   */
  pinCards?: boolean;
  /**
   * Rivers the page names (its river entities, by their names and aliases):
   * their courses from our Natural Earth river layer are drawn stronger and
   * named along the line. Rivers we cannot match are simply not drawn.
   */
  rivers?: { id: string; names: string[] }[];
  /** The map's name for assistive technology ("Map: Maurya Empire, 252 BCE, 7 places"). */
  label?: string;
  /**
   * Credit the map's data as a line of text under it instead of MapLibre's
   * attribution button (which is a tab stop): for small maps such as questions.
   */
  attributionAsText?: boolean;
  /** Short notes written on the map at a place ("Aśoka conquers Kalinga"): the atlas's turning points. */
  annotations?: MapAnnotation[];
}

export interface MapAnnotation {
  id: string;
  at: [number, number];
  text: string;
}

export interface MapPin {
  id: string;
  at: [number, number];
  tone: "guess" | "answer";
  label?: string;
}

let workersSet = false;

/** Resolves when `el` is within 300 px of the viewport and the browser has a moment. */
function whenNearAndIdle(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const idle = () =>
      "requestIdleCallback" in window
        ? window.requestIdleCallback(() => resolve(), { timeout: 400 })
        : setTimeout(resolve, 30);
    if (typeof IntersectionObserver === "undefined") return idle();
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        idle();
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
  });
}

// One fetch of the context layer per page load, shared by all maps.
let contextCache: Promise<MapFeature[]> | null = null;
function loadContext(): Promise<MapFeature[]> {
  contextCache ??= fetch("/api/places")
    .then((r) => (r.ok ? (r.json() as Promise<MapFeature[]>) : []))
    .catch(() => []);
  return contextCache;
}

function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

type Bounds = [[number, number], [number, number]];
type Coord = [number, number];

function coordsOf(geometry: unknown, out: Coord[] = []): Coord[] {
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") out.push(c as Coord);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk((geometry as { coordinates?: unknown } | null)?.coordinates);
  return out;
}

/**
 * Bounds of some coordinates, never smaller than `minSpan` ([longitude°,
 * latitude°]): a page with one or two places still shows the region around
 * them, not a close-up of a river bend.
 */
/** The middle of a shape's bounding box, where a name can go when it has no label point. */
function centreOf(geometry: unknown): Coord | null {
  const cs = coordsOf(geometry);
  if (!cs.length) return null;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of cs) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

function boundsOf(coords: Coord[], minSpan: [number, number]): Bounds | null {
  if (coords.length === 0) return null;
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const [x, y] of coords) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  if (x1 - x0 < minSpan[0]) [x0, x1] = [cx - minSpan[0] / 2, cx + minSpan[0] / 2];
  if (y1 - y0 < minSpan[1]) [y0, y1] = [cy - minSpan[1] / 2, cy + minSpan[1] / 2];
  return [
    [x0, Math.max(-60, y0)],
    [x1, Math.min(70, y1)],
  ];
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** The name for a year: one a source dates to it (Mumbai from 1995), else the usual one. */
export function nameAt(
  label: string,
  time: PlaceTime | undefined,
  year: number | null | undefined,
): string {
  if (year === null || year === undefined || !time?.names?.length) return label;
  return time.names.find((n) => (n.from ?? -1e5) <= year && (n.to ?? 1e5) >= year)?.label ?? label;
}

function placeData(
  features: MapFeature[],
  focusId: string | undefined,
  labels?: Map<string, string>,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature" as const,
      geometry: f.geo.geometry as never,
      properties: {
        id: f.id,
        slug: f.slug,
        label: labels?.get(f.id) ?? f.label,
        kind: f.kind,
        when: placeWhen(f),
        certainty: f.geo.certainty,
        focus: f.id === focusId ? 1 : 0,
      },
    })),
  };
}

function contextData(items: MapFeature[], labels?: Map<string, string>): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.map((f) => ({
      type: "Feature" as const,
      geometry: f.geo.geometry as never,
      properties: { id: f.id, slug: f.slug, label: labels?.get(f.id) ?? f.label },
    })),
  };
}

/**
 * Each source's names live in a source of their own: MapLibre lays out a
 * source's tiles with all its layers, so shapes and dots sharing a source with
 * text would wait for the fonts (fetched from the tile server) before drawing.
 */
const NAME_SOURCES: Record<string, string | string[]> = {
  places: "place-names",
  context: "context-names",
  // The borders' strokes too: drawn from outlines without the import's clip edges.
  extents: ["extent-shape-names", "extent-lines"],
};

/** Data for a source and, for places and context, for its names' source too. */
function setSource(map: MlMap, id: "places" | "context", data: GeoJSON.FeatureCollection) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
  (map.getSource(NAME_SOURCES[id] as string) as GeoJSONSource | undefined)?.setData(data);
}

const TIER = { focus: 2, plain: 1, neighbour: 0 } as const;

function extentData(extents: MapExtent[], strokes = false): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: extents.map((e) => ({
      type: "Feature" as const,
      geometry: (strokes && e.outline ? e.outline : e.geometry) as never,
      properties: {
        id: e.id,
        name: e.name,
        entityId: e.entityId ?? "",
        tier: TIER[e.emphasis ?? "focus"],
        from: e.fromYear ?? -100000,
        to: e.toYear ?? 100000,
        years: e.yearsLabel ?? "",
        href: e.href ?? "",
        named: e.labelAt ? 1 : 0,
        culture: e.culture ? 1 : 0,
        src: e.source ?? "",
        caveat: e.caveat ?? "",
      },
    })),
  };
}

function extentNameData(extents: MapExtent[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: extents
      .filter((e) => e.labelAt)
      .map((e) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: e.labelAt! },
        properties: {
          culture: e.culture ? 1 : 0,
          id: e.id,
          name: e.name,
          tier: TIER[e.emphasis ?? "focus"],
          from: e.fromYear ?? -100000,
          to: e.toYear ?? 100000,
        },
      })),
  };
}

/** Feature-state helpers for paint expressions: each key tweens 0..1. */
const st = (key: string) => ["coalesce", ["feature-state", key], 0];
const lit = ["max", st("h"), st("p")];
/** Belongs to the year shown (1 when the map has no year), or is pointed at. */
const vis = ["max", ["coalesce", ["feature-state", "t"], 1], lit, st("e")];

export function MapCanvas({
  features,
  extents = [],
  year,
  timeWindow = 25,
  compareYear = null,
  compareIds = null,
  frame = null,
  cardAction,
  listPlaces = true,
  height,
  className,
  compact = false,
  focusId,
  modernLabels = false,
  center,
  zoom,
  bounds,
  onSelect,
  onSelectEntity,
  onUnpin,
  onHoverEntity,
  highlight,
  context = true,
  extentAttribution,
  flush = false,
  children,
  onPick,
  pins,
  onViewChange,
  onPainted,
  annotations,
  waitForBounds = false,
  pinCards = true,
  rivers,
  label,
  attributionAsText = false,
}: MapCanvasProps) {
  const regionLabel =
    label ??
    (features.length
      ? `Map: ${features.length} ${features.length === 1 ? "place" : "places"}`
      : "Map");
  const ref = useRef<HTMLDivElement>(null);
  const [cardSlot, setCardSlot] = useState<{ el: HTMLElement; id: string; label: string } | null>(
    null,
  );
  const mapRef = useRef<MlMap | null>(null);
  const tweensRef = useRef<StateTweens | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(0); // bumps each time a map finishes loading
  /** The first view's tiles are in (until then a quiet "Loading map…" shows). */
  const [painted, setPainted] = useState(false);
  const paintedFired = useRef(false);
  const bordersDrawn = useRef(false);
  /** Something went wrong with the map itself; shown with a way to start again. */
  const [trouble, setTrouble] = useState<"lost" | "slow" | null>(null);
  /** Bumped to build the map afresh (after a lost context or a stalled load). */
  const [rebuild, setRebuild] = useState(0);
  const theme: MapTheme = resolvedTheme === "dark" ? "dark" : "light";

  // Latest props, read by the map's event handlers and on (re)load.
  const latest = useRef({
    onHoverEntity,
    annotations,
    waitForBounds,
    onPick,
    onViewChange,
    onPainted,
    features,
    extents,
    focusId,
    onSelect,
    onSelectEntity,
    onUnpin,
    center,
    zoom,
    bounds,
  });
  latest.current = {
    onHoverEntity,
    annotations,
    waitForBounds,
    onPick,
    onViewChange,
    onPainted,
    features,
    extents,
    focusId,
    onSelect,
    onSelectEntity,
    onUnpin,
    center,
    zoom,
    bounds,
  };
  const contextRef = useRef<MapFeature[]>([]);
  const cameraRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const mapHoverRef = useRef<string | null>(null);
  const mapHoverExtentRef = useRef<string | null>(null);
  const userMoved = useRef(false);
  /** The map has been framed (once; after that only the reader moves it). */
  const homed = useRef(false);
  const noteDataRef = useRef<(map: MlMap, notes: MapAnnotation[]) => GeoJSON.FeatureCollection>(
    () => EMPTY,
  );
  const regionLabelRef = useRef(regionLabel);
  regionLabelRef.current = regionLabel;
  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute("aria-label", regionLabel);
  }, [regionLabel]);
  const framedPin = useRef<number | null>(null);
  const contextIds = useRef<string[]>([]);
  const contextLoaded = useRef(false);

  // The view to open on and to reset to.
  const homeView = () => {
    const { center: c, zoom: z, bounds: b, features: fs, extents: xs } = latest.current;
    if (c) return { center: c, zoom: z ?? 3.4 };
    if (b)
      return {
        bounds: [
          [b[0], b[1]],
          [b[2], b[3]],
        ] as Bounds,
      };
    const coords: Coord[] = [];
    fs.forEach((f) => coordsOf(f.geo.geometry, coords));
    xs.filter((e) => e.emphasis !== "neighbour").forEach((e) => coordsOf(e.geometry, coords));
    const box = boundsOf(coords, compact ? [10, 8] : [22, 16]);
    return box ? { bounds: box } : { center: [79, 22] as [number, number], zoom: 3.4 };
  };
  const goHome = (duration: number) => {
    const map = mapRef.current;
    if (!map) return;
    const v = homeView();
    if ("bounds" in v && v.bounds)
      // Room at the top for the controls and at the bottom for the year badge.
      map.fitBounds(v.bounds, {
        padding: compact
          ? { top: 30, bottom: 40, left: 16, right: 16 }
          : { top: 48, bottom: 64, left: 40, right: 40 },
        maxZoom: compact ? 6 : 7,
        duration,
      });
    else if ("center" in v) map.easeTo({ center: v.center, zoom: v.zoom, duration });
  };

  // Create the map: once, and again when the theme or the presentation changes.
  useEffect(() => {
    if (!ref.current) return;
    let disposed = false;
    let resizer: ResizeObserver | null = null;

    (async () => {
      // MapLibre (about 280 KB compressed) loads only once the map is near the
      // viewport and the browser is idle, so it never competes with the page's
      // first paint, and a map further down a phone's page costs nothing until
      // the reader gets there.
      if (!ref.current) return;
      await whenNearAndIdle(ref.current);
      if (disposed || !ref.current) return;
      const maplibre = await import("maplibre-gl");
      if (disposed || !ref.current) return;
      // Served from /public (copied by scripts/copy-maplibre-worker.mjs).
      maplibre.setWorkerUrl("/maplibre-gl-worker.mjs");
      // More workers than the default two, so decoding the basemap's terrain
      // tiles does not hold up our borders and places (set before any map exists).
      if (!workersSet) {
        workersSet = true;
        maplibre.setWorkerCount(Math.min(6, Math.max(2, (navigator.hardwareConcurrency || 4) - 1)));
      }
      const pal = paletteFor(theme);
      const colors = {
        accent: token("--indigo", pal.accent),
        sandstone: token("--sandstone", "#a9774b"),
        turmeric: token("--turmeric", "#a8730a"),
        ink: token("--ink", "#171c33"),
        ink2: token("--ink-2", "#4a4f63"),
        ink3: token("--ink-3", "#6f7383"),
        paper: token("--paper", "#fcfbf8"),
      };
      // Touch screens keep two-finger gestures so the page still scrolls; on
      // desktop the wheel zooms directly.
      const touch = window.matchMedia("(pointer: coarse)").matches;
      const keep = cameraRef.current;
      const map = new maplibre.Map({
        container: ref.current,
        // Relief comes later (below): land, water, borders and places paint first.
        style: buildBasemapStyle(theme, { modern: modernLabels, compact, relief: false }),
        center: keep?.center ?? center ?? [79, 22],
        zoom: keep?.zoom ?? zoom ?? 3.4,
        minZoom: 2,
        maxZoom: 12,
        attributionControl: attributionAsText ? false : { compact: true },
        cooperativeGestures: touch,
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: false,
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = map;
      // A new map (a theme change, a reload) starts with no filters or states:
      // forget what the last one had, so the year and names are applied afresh.
      yearApplied.current = false;
      drawn.current = new Set();
      fading.current.clear();
      ghosts.current.clear();
      extentsKey.current = -1;
      namedKey.current = {};
      labelsRef.current = {};
      // Never a silent grey box: a lost graphics context (too many maps, a GPU
      // reset) or a map that does not load says so, and offers to start again.
      setTrouble(null);
      map.getCanvas().addEventListener("webglcontextlost", () => setTrouble("lost"));
      const slow = setTimeout(() => {
        if (!disposed && !map.isStyleLoaded()) setTrouble("slow");
      }, 15_000);
      map.once("style.load", () => clearTimeout(slow));
      // One landmark per map: the wrapper is the region; the canvas only carries its name.
      map.getCanvas().removeAttribute("role");
      map.getCanvas().setAttribute("aria-label", regionLabelRef.current);
      // For scripted checks in development (scripts/screenshot.ts and the like).
      if (process.env.NODE_ENV !== "production")
        (ref.current as HTMLElement & { __map?: MlMap }).__map = map;
      map.addControl(
        new maplibre.NavigationControl({ showCompass: false, showZoom: !compact }),
        "top-right",
      );
      // A new width (a wider rail, a rotated phone) frames the subject again,
      // unless the reader has moved the map; a new height (the atlas folding
      // to a strip) never does.
      let lastWidth = ref.current.clientWidth;
      // Resized on every change of the box (a page's layout settling, a board's tile
      // being dragged), and once more on the next frame, so a height reached at
      // the end of a CSS transition is drawn too, never left as a blank band.
      let settle = 0;
      resizer = new ResizeObserver(() => {
        map.resize();
        map.triggerRepaint();
        cancelAnimationFrame(settle);
        settle = requestAnimationFrame(() => {
          if (mapRef.current !== map) return;
          map.resize();
          map.triggerRepaint();
        });
        const w = ref.current?.clientWidth ?? lastWidth;
        if (Math.abs(w - lastWidth) > 4 && homed.current && !userMoved.current) goHome(0);
        lastWidth = w;
      });
      resizer.observe(ref.current);
      map.on("movestart", (e) => {
        if ((e as { originalEvent?: unknown }).originalEvent) userMoved.current = true;
      });
      map.on("moveend", () => {
        const notes = latest.current.annotations ?? [];
        if (notes.length)
          (map.getSource("notes") as GeoJSONSource | undefined)?.setData(
            noteDataRef.current(map, notes),
          );
        const c = map.getCenter();
        cameraRef.current = { center: [c.lng, c.lat], zoom: map.getZoom() };
        latest.current.onViewChange?.([c.lng, c.lat], map.getZoom());
      });
      // MapLibre fires "click" only for a press without a drag.
      map.on("click", (e) => latest.current.onPick?.([e.lngLat.lng, e.lngLat.lat]));

      // Our layers go on as soon as the style is parsed, not on "load": that
      // waits for every basemap tile (hillshade, relief) of the first view, and
      // a slow tile server would leave the map veiled with no borders or places.
      // Once land and water are in ("load" waits for the first view's tiles), the
      // relief goes under them: the raster terrain is the heaviest part, and a
      // map that showed it first looked like bare hills with nothing on them.
      // The first time the map settles with its borders drawn, it has painted in full.
      const onIdle = () => {
        if (disposed || paintedFired.current) return;
        if (latest.current.extents.length && !bordersDrawn.current) return;
        paintedFired.current = true;
        map.off("idle", onIdle);
        latest.current.onPainted?.();
      };
      map.once("load", () => {
        if (disposed) return;
        setPainted(true);
        map.on("idle", onIdle);
        const sources = reliefSources() ?? {};
        for (const [id, src] of Object.entries(sources))
          if (!map.getSource(id)) map.addSource(id, src as never);
        for (const layer of reliefLayers(theme) ?? [])
          if (!map.getLayer(layer.id))
            map.addLayer(layer as never, map.getLayer("sand") ? "sand" : undefined);
      });
      map.once("style.load", () => {
        if (disposed) return;
        map.resize();
        const halo = paletteFor(theme).halo;
        const dark = theme === "dark";
        tweensRef.current = new StateTweens(map, 300, NAME_SOURCES);

        // ---- borders
        map.addSource("extents", {
          type: "geojson",
          data: EMPTY,
          promoteId: "id",
          attribution: extentAttribution,
        });
        map.addSource("extent-lines", { type: "geojson", data: EMPTY, promoteId: "id" });
        const tier = ["get", "tier"];
        const culture = ["==", ["get", "culture"], 1];
        // In force in the year shown: borders crossfade between years, never morph.
        const yv = ["coalesce", ["feature-state", "y"], 1];
        map.addImage("hatch", hatch(colors.ink3, dark), { pixelRatio: 2 });
        map.addLayer({
          id: "extents-fill",
          type: "fill",
          source: "extents",
          filter: ["!", culture] as never,
          paint: {
            "fill-color": ["match", tier, 0, colors.ink3, colors.accent] as never,
            "fill-opacity": [
              "*",
              yv,
              [
                "+",
                ["match", tier, 2, dark ? 0.2 : 0.13, 1, dark ? 0.12 : 0.08, dark ? 0.06 : 0.04],
                ["*", lit, 0.12],
              ],
            ] as never,
          },
        });
        // Culture areas: hatched, softer, so they do not read as a state.
        map.addLayer({
          id: "extents-culture",
          type: "fill",
          source: "extents",
          filter: culture as never,
          paint: {
            "fill-pattern": "hatch",
            "fill-opacity": ["*", yv, ["+", 0.7, ["*", lit, 0.3]]] as never,
          },
        });
        map.addLayer({
          id: "extents-line",
          type: "line",
          source: "extent-lines",
          paint: {
            "line-color": [
              "case",
              culture,
              colors.ink3,
              ["match", tier, 0, colors.ink3, colors.accent],
            ] as never,
            "line-width": [
              "+",
              ["case", culture, 0.8, ["match", tier, 2, dark ? 2 : 1.6, 1, 1.1, 0.8]],
              ["*", lit, 1.2],
            ] as never,
            "line-opacity": [
              "*",
              yv,
              [
                "+",
                ["case", culture, 0.5, ["match", tier, 2, 0.9, 1, 0.7, dark ? 0.5 : 0.4]],
                ["*", lit, 0.3],
              ],
            ] as never,
            "line-dasharray": [3, 2],
          },
        });
        // Two states compared, both in the atlas's indigo and told apart by pattern: the
        // first filled with a solid edge (see the compare effect), the second unfilled with a
        // heavy dotted ink edge, and named. (Hatching means a culture area; colours carry meaning.)
        map.addLayer({
          id: "extents-pair",
          type: "line",
          source: "extent-lines",
          filter: ["in", ["get", "id"], ["literal", []]] as never,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": colors.ink,
            "line-width": compact ? 2.4 : 2.8,
            "line-opacity": dark ? 0.9 : 0.85,
            "line-dasharray": [0.1, 1.8],
          },
        });
        // Comparing two years: the other year's outlines, dotted, in the ink colour
        // (so they read in both themes against the indigo fills of the year shown).
        map.addLayer({
          id: "extents-compare",
          type: "line",
          source: "extent-lines",
          filter: ["in", ["get", "id"], ["literal", []]] as never,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": colors.ink,
            "line-width": ["match", tier, 2, 1.8, 1.2] as never,
            "line-opacity": dark ? 0.75 : 0.65,
            "line-dasharray": [0.6, 2],
          },
        });
        // The onion-skin: the subject's outline from just before a change, fading out.
        map.addLayer({
          id: "extents-ghost",
          type: "line",
          source: "extent-lines",
          filter: ["in", ["get", "id"], ["literal", []]] as never,
          paint: {
            "line-color": colors.accent,
            "line-width": 1,
            "line-opacity": ["*", 0.7, ["coalesce", ["feature-state", "g"], 0]] as never,
          },
        });

        // ---- context: other known places, faint and small, labelled only when zoomed in
        map.addSource("context", { type: "geojson", data: EMPTY, promoteId: "id" });
        map.addSource("context-names", { type: "geojson", data: EMPTY, promoteId: "id" });
        const ctxT = ["coalesce", ["feature-state", "t"], 1];
        map.addLayer({
          id: "context-points",
          type: "circle",
          source: "context",
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 2.2, 7, 4],
            "circle-color": colors.sandstone,
            "circle-opacity": ["*", 0.35, ctxT] as never,
            "circle-stroke-color": colors.paper,
            "circle-stroke-width": 1,
            "circle-stroke-opacity": ["*", 0.5, ctxT] as never,
          },
        });
        map.addLayer({
          id: "context-labels",
          type: "symbol",
          source: "context-names",
          minzoom: compact ? 6 : 4.6,
          layout: {
            "text-field": ["get", "label"],
            "text-font": FONT_REGULAR,
            "text-size": 11,
            "text-offset": [0, 0.8],
            "text-anchor": "top",
            "text-optional": true,
          },
          paint: {
            "text-color": colors.ink,
            "text-opacity": ["*", 0.55, ctxT] as never,
            "text-halo-color": halo,
            "text-halo-width": 1.2,
          },
        });
        if (context) {
          void loadContext().then((all) => {
            contextRef.current = all;
            contextLoaded.current = true;
            contextIds.current = [];
            if (disposed || !map.getSource("context")) return;
            const own = new Set(latest.current.features.map((f) => f.id));
            const shownCtx = all.filter((f) => !own.has(f.id) && f.geo.geometry.type === "Point");
            contextIds.current = shownCtx.map((f) => f.id);
            setSource(map, "context", contextData(shownCtx));
            timeRef.current();
          });
          map.on("click", "context-points", (e) => {
            if (!shown(e.features?.[0])) return;
            const slug = (e.features?.[0]?.properties as { slug?: string } | undefined)?.slug;
            if (slug) window.location.href = `/e/${slug}`;
          });
        }

        // ---- rivers the page names: their courses, stronger, named along the line
        map.addLayer({
          id: "rivers-named",
          type: "line",
          source: "rivers",
          filter: ["in", ["downcase", ["coalesce", ["get", "name"], ""]], ["literal", []]] as never,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": dark ? "#7fb2e0" : "#2f6fa8",
            "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2, 7, 3.5] as never,
            "line-opacity": 0.95,
          },
        });
        map.addLayer({
          id: "rivers-named-labels",
          type: "symbol",
          source: "rivers",
          filter: ["in", ["downcase", ["coalesce", ["get", "name"], ""]], ["literal", []]] as never,
          layout: {
            "symbol-placement": "line",
            "text-field": ["get", "name"],
            "text-font": FONT_ITALIC,
            "text-size": compact ? 11.5 : 13,
            "text-letter-spacing": 0.06,
            "symbol-spacing": 260,
          },
          paint: {
            "text-color": dark ? "#9cc4ea" : "#24598a",
            "text-halo-color": halo,
            "text-halo-width": 1.8,
          },
        });

        // ---- the page's places
        map.addSource("places", { type: "geojson", data: EMPTY, promoteId: "id" });
        map.addSource("place-names", { type: "geojson", data: EMPTY, promoteId: "id" });
        const isArea = ["in", ["geometry-type"], ["literal", ["Polygon", "MultiPolygon"]]];
        map.addLayer({
          id: "place-areas",
          type: "fill",
          source: "places",
          filter: isArea as never,
          paint: {
            "fill-color": colors.sandstone,
            "fill-opacity": ["+", 0.14, ["*", lit, 0.16], ["*", st("e"), 0.06]] as never,
          },
        });
        const isPoint = ["==", ["geometry-type"], "Point"] as never;
        const base = ["case", ["==", ["get", "focus"], 1], compact ? 5.5 : 7, compact ? 4 : 5.5];
        // A ring that opens out around what is highlighted.
        map.addLayer({
          id: "points-ring",
          type: "circle",
          source: "places",
          filter: isPoint,
          paint: {
            "circle-radius": ["+", base, ["*", lit, 7]] as never,
            "circle-color": colors.accent,
            "circle-opacity": ["*", lit, 0.14] as never,
            "circle-stroke-color": colors.accent,
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": ["*", lit, 0.85] as never,
          },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: "places",
          filter: isPoint,
          paint: {
            "circle-radius": ["+", base, ["*", lit, 1.5], ["*", st("e"), 1]] as never,
            "circle-color": ["match", ["get", "kind"], "event", colors.turmeric, colors.sandstone],
            "circle-stroke-color": [
              "interpolate",
              ["linear"],
              lit,
              0,
              colors.paper,
              1,
              colors.accent,
            ] as never,
            "circle-stroke-width": ["+", 1.75, ["*", lit, 0.75]] as never,
            "circle-opacity": [
              "*",
              vis,
              [
                "min",
                1,
                [
                  "+",
                  ["match", ["get", "certainty"], "conjectural", 0.45, "approximate", 0.8, 1],
                  ["*", ["max", lit, st("e")], 0.4],
                ],
              ],
            ] as never,
            "circle-stroke-opacity": [
              "*",
              vis,
              ["match", ["get", "certainty"], "conjectural", 0.6, 1],
            ] as never,
          },
        });
        map.addLayer({
          id: "point-labels",
          type: "symbol",
          source: "place-names",
          filter: isPoint,
          layout: {
            "text-field": ["get", "label"],
            "text-font": [
              "case",
              ["==", ["get", "focus"], 1],
              ["literal", FONT_BOLD],
              ["literal", FONT_REGULAR],
            ] as never,
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              compact ? 10 : 11.5,
              7,
              compact ? 12 : 13.5,
              10,
              compact ? 13 : 15,
            ] as never,
            "text-offset": [0, 0.95],
            "text-anchor": "top",
            "text-optional": true,
            "text-max-width": 9,
          },
          paint: {
            "text-color": colors.ink,
            "text-halo-color": halo,
            "text-halo-width": 1.6,
            // Hidden while the same name is drawn on top (highlighted); faded with the year.
            "text-opacity": ["*", ["-", 1, lit], vis] as never,
          },
        });

        // ---- names of polities, above the places' names (they are the atlas's subject):
        // the subject's upright, neighbours in italics. Written once, at the label
        // point the server chose; outlines without one are labelled by MapLibre.
        map.addSource("extent-names", { type: "geojson", data: EMPTY, promoteId: "id" });
        map.addSource("extent-shape-names", { type: "geojson", data: EMPTY, promoteId: "id" });
        const names = (id: string, source: string, filter?: unknown) =>
          map.addLayer({
            id,
            type: "symbol",
            source,
            ...(filter ? { filter: filter as never } : {}),
            layout: {
              // A culture area says so under its name.
              "text-field": [
                "case",
                culture,
                ["format", ["get", "name"], {}, "\nculture area", { "font-scale": 0.82 }],
                ["get", "name"],
              ] as never,
              "text-font": [
                "case",
                culture,
                ["literal", FONT_ITALIC],
                [
                  "match",
                  tier,
                  2,
                  ["literal", FONT_BOLD],
                  1,
                  ["literal", FONT_REGULAR],
                  ["literal", FONT_ITALIC],
                ],
              ] as never,
              // Names grow as you zoom in (and shrink out), so they stay readable
              // without crowding a whole-subcontinent view.
              "text-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                ["match", tier, 2, compact ? 11 : 13, 1, compact ? 9.5 : 11, compact ? 9 : 10.5],
                6,
                [
                  "match",
                  tier,
                  2,
                  compact ? 13.5 : 16,
                  1,
                  compact ? 12 : 13.5,
                  compact ? 11 : 12.5,
                ],
                9,
                ["match", tier, 2, compact ? 15 : 18, 1, compact ? 13.5 : 15, compact ? 12.5 : 14],
              ] as never,
              "text-letter-spacing": ["match", tier, 0, 0.04, 0.08] as never,
              "text-transform": ["match", tier, 2, "uppercase", "none"] as never,
              "text-max-width": 8,
              "symbol-sort-key": ["-", 2, tier] as never,
              "text-padding": 4,
            },
            paint: {
              "text-color": [
                "case",
                culture,
                colors.ink2,
                ["match", tier, 0, colors.ink2, colors.accent],
              ] as never,
              "text-halo-color": halo,
              "text-halo-width": 1.8,
              "text-halo-blur": 0.5,
              "text-opacity": [
                "*",
                yv,
                ["+", ["match", tier, 0, 0.8, 1], ["*", lit, 0.2]],
              ] as never,
            },
          });
        names("extents-label", "extent-shape-names", ["!=", ["get", "named"], 1]);
        names("extent-names", "extent-names");
        // The second of two states compared, named in ink. Under the first's
        // names (placed after them), it moves around its point to find room.
        map.addSource("pair-names", { type: "geojson", data: EMPTY });
        map.addLayer(
          {
            id: "pair-names",
            type: "symbol",
            source: "pair-names",
            layout: {
              "text-field": ["get", "name"],
              "text-font": FONT_BOLD,
              "text-size": compact ? 11 : 13,
              "text-transform": "uppercase",
              "text-letter-spacing": 0.08,
              "text-max-width": 8,
              "text-variable-anchor": [
                "top",
                "bottom",
                "left",
                "right",
                "top-left",
                "bottom-right",
              ],
              "text-radial-offset": 1.1,
              "text-padding": 2,
            },
            paint: {
              "text-color": colors.ink,
              "text-halo-color": halo,
              "text-halo-width": 1.8,
              "text-halo-blur": 0.5,
            },
          },
          "extents-label",
        );

        // Invisible: loads the bold glyphs of every place's name up front, so a
        // highlighted name appears at once rather than after a font request.
        map.addLayer({
          id: "warm-bold-glyphs",
          type: "symbol",
          source: "place-names",
          layout: {
            "text-field": ["get", "label"],
            "text-font": FONT_BOLD,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-opacity": 0 },
        });

        // ---- notes on the map (turning points): a ring at the place and the note above it
        map.addSource("notes", { type: "geojson", data: EMPTY });
        map.addLayer({
          id: "notes-ring",
          type: "circle",
          source: "notes",
          paint: {
            "circle-radius": compact ? 9 : 11,
            "circle-color": "rgba(0,0,0,0)",
            "circle-stroke-color": colors.accent,
            "circle-stroke-width": 1.5,
            "circle-stroke-opacity": 0.9,
            "circle-opacity-transition": { duration: 250, delay: 0 },
          },
        });
        map.addLayer({
          id: "notes-text",
          type: "symbol",
          source: "notes",
          layout: {
            "text-field": ["get", "text"],
            "text-font": FONT_ITALIC,
            "text-size": compact ? 12 : 14,
            "text-anchor": ["coalesce", ["get", "anchor"], "bottom"] as never,
            "text-offset": [0, -1.15],
            "text-max-width": 12,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": colors.accent, "text-halo-color": halo, "text-halo-width": 2.2 },
        });

        // ---- pins (questions: where the reader guessed, where the answer is)
        map.addSource("pins", { type: "geojson", data: EMPTY });
        map.addLayer({
          id: "pins",
          type: "circle",
          source: "pins",
          paint: {
            "circle-radius": [
              "match",
              ["get", "tone"],
              "guess",
              compact ? 6 : 7,
              compact ? 5 : 6,
            ] as never,
            "circle-color": [
              "match",
              ["get", "tone"],
              "guess",
              "rgba(0,0,0,0)",
              colors.sandstone,
            ] as never,
            "circle-stroke-color": [
              "match",
              ["get", "tone"],
              "guess",
              colors.accent,
              colors.paper,
            ] as never,
            "circle-stroke-width": ["match", ["get", "tone"], "guess", 2.5, 1.75] as never,
          },
        });
        map.addLayer({
          id: "pin-labels",
          type: "symbol",
          source: "pins",
          filter: ["has", "label"],
          layout: {
            "text-field": ["get", "label"],
            "text-font": FONT_BOLD,
            "text-size": compact ? 11.5 : 13,
            "text-offset": [0, 1.1],
            "text-anchor": "top",
            "text-allow-overlap": true,
          },
          paint: { "text-color": colors.ink, "text-halo-color": halo, "text-halo-width": 2 },
        });

        // ---- highlighted names, drawn last so they are never hidden by others
        map.addSource("lit", { type: "geojson", data: EMPTY });
        map.addLayer({
          id: "lit-labels",
          type: "symbol",
          source: "lit",
          layout: {
            "text-field": ["get", "label"],
            "text-font": FONT_BOLD,
            "text-size": compact ? 11.5 : 13.5,
            "text-offset": [0, 1.15],
            "text-anchor": "top",
            "text-allow-overlap": true,
            "text-ignore-placement": true,
            "text-max-width": 10,
          },
          paint: {
            "text-color": colors.ink,
            "text-halo-color": halo,
            "text-halo-width": 2,
            "text-opacity": 0,
            "text-opacity-transition": { duration: 200, delay: 0 },
          },
        });

        if (keep) homed.current = true;
        else if (!latest.current.waitForBounds) {
          goHome(0);
          homed.current = true;
        }

        // Clicking a place: tell the page, or show a small card.
        const select = (e: MapLayerMouseEvent) => {
          const props = e.features?.[0]?.properties as
            | { id: string; slug: string; label: string; when: string; certainty: string }
            | undefined;
          if (!props || !shown(e.features?.[0])) return;
          const l = latest.current;
          if (l.onSelectEntity) return l.onSelectEntity(props.id, props.slug);
          if (l.onSelect) return l.onSelect(props.slug);
          popupRef.current?.remove();
          popupRef.current = new maplibre.Popup({ closeButton: false, focusAfterOpen: false })
            .setLngLat(e.lngLat)
            .setDOMContent(placeCard(props))
            .addTo(map);
        };
        map.on("click", "points", select);
        // An outline under the pointer: which reconstruction it is, for which years, and its caveat.
        const outlineAt = (point: import("maplibre-gl").PointLike) => {
          if (
            map.queryRenderedFeatures(point, { layers: ["points", "context-points"] }).some(shown)
          )
            return null;
          const f = map
            .queryRenderedFeatures(point, { layers: ["extents-fill", "extents-culture"] })
            .find((x) => ((x.state as { y?: number } | undefined)?.y ?? 1) > 0.5);
          return f ? (f.properties as ExtentProps) : null;
        };
        // Clicking an outline (and not a place on it) names it, and tells the page about its polity.
        map.on("click", (e) => {
          const p = outlineAt(e.point);
          if (!p) return;
          hoverPopup?.remove();
          popupRef.current?.remove();
          popupRef.current = new maplibre.Popup({
            closeButton: false,
            focusAfterOpen: false,
            className: "extent-popup",
            maxWidth: "260px",
          })
            .setLngLat(e.lngLat)
            .setDOMContent(extentCard(p, true))
            .addTo(map);
          if (p.entityId) latest.current.onSelectEntity?.(p.entityId, "");
        });
        // Hovering one (fine pointers) says the same, quietly, and lights it.
        let hoverPopup: Popup | null = null;
        let hoverId: string | null = null;
        if (window.matchMedia("(hover: hover)").matches)
          map.on("mousemove", (e) => {
            const p = e.originalEvent.buttons ? null : outlineAt(e.point);
            const id = p?.id ?? null;
            if (id !== hoverId) {
              hoverId = id;
              mapHoverExtentRef.current = id;
              applyRef.current();
              hoverPopup?.remove();
              hoverPopup = p
                ? new maplibre.Popup({
                    closeButton: false,
                    closeOnClick: false,
                    focusAfterOpen: false,
                    className: "extent-hover",
                    offset: 12,
                    maxWidth: "240px",
                  })
                    .setDOMContent(extentCard(p, false))
                    .setLngLat(e.lngLat)
                    .addTo(map)
                : null;
            } else hoverPopup?.setLngLat(e.lngLat);
          });
        map.getCanvasContainer().addEventListener("mouseleave", () => {
          hoverPopup?.remove();
          hoverPopup = null;
          hoverId = null;
          if (mapHoverExtentRef.current) {
            mapHoverExtentRef.current = null;
            applyRef.current();
          }
        });
        // Clicking anywhere but a place lets go of the pinned one.
        map.on("click", (e) => {
          if (!map.queryRenderedFeatures(e.point, { layers: ["points"] }).some(shown))
            latest.current.onUnpin?.();
        });
        map.on("mousemove", "points", (e) => {
          const id = shown(e.features?.[0])
            ? ((e.features?.[0]?.properties as { id?: string } | undefined)?.id ?? null)
            : null;
          map.getCanvas().style.cursor = id ? "pointer" : latest.current.onPick ? "crosshair" : "";
          if (id === mapHoverRef.current) return;
          mapHoverRef.current = id;
          latest.current.onHoverEntity?.(id);
          applyRef.current();
        });
        map.on("mouseenter", "points", (e) => {
          if (!shown(e.features?.[0])) return;
          map.getCanvas().style.cursor = "pointer";
          mapHoverRef.current =
            (e.features?.[0]?.properties as { id?: string } | undefined)?.id ?? null;
          applyRef.current();
        });
        map.on("mouseleave", "points", () => {
          map.getCanvas().style.cursor = latest.current.onPick ? "crosshair" : "";
          mapHoverRef.current = null;
          latest.current.onHoverEntity?.(null);
          applyRef.current();
        });
        setReady((n) => n + 1);
      });
    })();

    return () => {
      disposed = true;
      resizer?.disconnect();
      tweensRef.current?.stop();
      tweensRef.current = null;
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Data, highlights and the year are applied in place below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, compact, context, rebuild]);

  // Places: replace the source data. The map frames once (when it opens, or
  // when the bounds it waits for arrive) and never again on its own.
  const placesKey = features.map((f) => f.id).join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setSource(map, "places", placeData(features, focusId, labelsRef.current.places));
    if (!homed.current && !waitForBounds) {
      goHome(0);
      homed.current = true;
      widenForNotes.current(latest.current.annotations ?? []);
    }
    applyRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, focusId, ready, bounds?.join(","), waitForBounds]);

  // The year: which of the borders already loaded are drawn. Those that come
  // into force fade in and those that lapse fade out (~250 ms, feature-state
  // y); shapes are never interpolated, which would show territory nobody
  // mapped. After a change the subject's previous outline lingers as a faint
  // hairline for about a second (the onion-skin, feature-state g).
  const drawn = useRef<Set<string>>(new Set());
  const fading = useRef<Map<string, number>>(new Map());
  const ghosts = useRef<Map<string, number>>(new Map());
  const yearApplied = useRef(false);
  /** How many extents the filters were last built for (new data rebuilds them). */
  const extentsKey = useRef(-1);
  const filterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyYearRef = useRef<() => void>(() => {});
  applyYearRef.current = () => {
    const map = mapRef.current;
    const tw = tweensRef.current;
    if (!map || !tw) return;
    const unnamed = ["!=", ["get", "named"], 1];
    const layers = ["extents-fill", "extents-culture", "extents-line", "extent-names"];
    if (year === null || year === undefined) {
      for (const id of layers) if (map.getLayer(id)) map.setFilter(id, null);
      if (map.getLayer("extents-fill"))
        map.setFilter("extents-fill", ["!=", ["get", "culture"], 1] as never);
      if (map.getLayer("extents-culture"))
        map.setFilter("extents-culture", ["==", ["get", "culture"], 1] as never);
      if (map.getLayer("extents-label")) map.setFilter("extents-label", unnamed as never);
      return;
    }
    const now = performance.now();
    const xs = latest.current.extents;
    const inForce = xs.filter((e) => (e.fromYear ?? -1e5) <= year && (e.toYear ?? 1e5) >= year);
    const next = new Set(inForce.map((e) => e.id));
    // Most years draw the same borders as the year before (they change only at
    // a dataset's change points): then nothing is refiltered or re-tiled, which
    // is what keeps Play and dragging smooth over thousands of shapes.
    if (
      yearApplied.current &&
      !fading.current.size &&
      !ghosts.current.size &&
      next.size === drawn.current.size &&
      [...next].every((id) => drawn.current.has(id)) &&
      extentsKey.current === xs.length
    )
      return;
    extentsKey.current = xs.length;
    const first = !yearApplied.current;
    yearApplied.current = true;
    const tier = new Map(xs.map((e) => [e.id, e.emphasis ?? "focus"]));
    const newGhosts: string[] = [];
    for (const id of drawn.current)
      if (!next.has(id)) {
        fading.current.set(id, now + 280);
        // Only the subject's outlines leave a ghost; neighbours would clutter it.
        if (!first && tier.get(id) === "focus") {
          ghosts.current.set(id, now + 1300);
          newGhosts.push(id);
        }
      }
    for (const id of next) fading.current.delete(id);
    for (const [id, until] of fading.current) if (until < now) fading.current.delete(id);
    for (const [id, until] of ghosts.current) if (until < now) ghosts.current.delete(id);
    drawn.current = next;

    const ids = [...next, ...fading.current.keys()];
    for (const source of ["extents", "extent-names"]) {
      // Borders seen for the first time fade in too (except when the map opens);
      // "extents" states are mirrored to the outlines' own names.
      if (!first)
        for (const id of next)
          if (tw.value(source, id, "y") === undefined)
            tw.set(source, id, "y", 1, { from: 0, duration: 250 });
      tw.sync(source, ids, { y: (id) => (next.has(id) ? 1 : 0) });
    }
    for (const id of newGhosts) tw.pulse("extents", id, "g", 1, 0, 1200);

    const only = ["in", ["get", "id"], ["literal", ids]];
    const withCulture = (c: boolean) => ["all", only, [c ? "==" : "!=", ["get", "culture"], 1]];
    if (map.getLayer("extents-fill")) map.setFilter("extents-fill", withCulture(false) as never);
    if (map.getLayer("extents-culture"))
      map.setFilter("extents-culture", withCulture(true) as never);
    for (const id of ["extents-line", "extent-names"])
      if (map.getLayer(id)) map.setFilter(id, only as never);
    if (map.getLayer("extents-label"))
      map.setFilter("extents-label", ["all", only, unnamed] as never);
    if (map.getLayer("extents-ghost"))
      map.setFilter("extents-ghost", [
        "in",
        ["get", "id"],
        ["literal", [...ghosts.current.keys()]],
      ] as never);
    // Drop the faded-out and the ghosts from the filters once they are gone.
    if (filterTimer.current) clearTimeout(filterTimer.current);
    if (fading.current.size || ghosts.current.size)
      filterTimer.current = setTimeout(
        () => applyYearRef.current(),
        fading.current.size ? 300 : 1350,
      );
  };
  useEffect(() => {
    if (ready) applyYearRef.current();
    return () => {
      if (filterTimer.current) clearTimeout(filterTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, ready, extents]);

  // Borders: replace the data (after the year's filter is set, above, so the
  // tiles are built once, not twice); the camera stays (except to frame a map that
  // had nothing else to frame when it opened).
  const framedBorders = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("extents") as GeoJSONSource | undefined)?.setData(extentData(extents));
    if (extents.length) bordersDrawn.current = true;
    (map.getSource("extent-lines") as GeoJSONSource | undefined)?.setData(
      extentData(extents, true),
    );
    // Outlines without a label point are named by MapLibre, from a source of their own.
    (map.getSource("extent-shape-names") as GeoJSONSource | undefined)?.setData(
      extentData(extents.filter((e) => !e.labelAt)),
    );
    (map.getSource("extent-names") as GeoJSONSource | undefined)?.setData(extentNameData(extents));
    if (
      !framedBorders.current &&
      extents.length &&
      !features.length &&
      !bounds &&
      !center &&
      !userMoved.current &&
      !waitForBounds
    )
      goHome(0);
    if (extents.length) framedBorders.current = true;
    applyRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extents, ready]);

  // The year compared with: its outlines (only those in force then), or none.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getLayer("extents-compare")) return;
    // Another year: its outlines dotted in ink. Another state: its own dotted layer, and the
    // first state's edge drawn solid, so the two read apart by pattern alone.
    const ids =
      compareIds || compareYear === null
        ? []
        : extents
            .filter((e) => (e.fromYear ?? -1e5) <= compareYear && (e.toYear ?? 1e5) >= compareYear)
            .map((e) => e.id);
    map.setFilter("extents-compare", ["in", ["get", "id"], ["literal", ids]] as never);
    const pair = ["in", ["get", "id"], ["literal", compareIds ?? []]] as never;
    map.setPaintProperty("extents-line", "line-dasharray", compareIds ? [1, 0] : [3, 2]);
    if (map.getLayer("extents-pair")) map.setFilter("extents-pair", pair);
    (map.getSource("pair-names") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: extents
        .filter((e) => compareIds?.includes(e.id))
        .flatMap((e) => {
          const at = e.labelAt ?? centreOf(e.geometry);
          return at
            ? [
                {
                  type: "Feature" as const,
                  geometry: { type: "Point" as const, coordinates: at },
                  properties: { name: e.name },
                },
              ]
            : [];
        }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareYear, compareIds?.join(","), extents, ready]);

  // A view the reader asked for (two states compared): fit it once per choice.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !frame) return;
    const [w, s, e, n] = frame.bounds;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      {
        padding: compact
          ? { top: 30, bottom: 40, left: 16, right: 16 }
          : { top: 48, bottom: 64, left: 40, right: 40 },
        maxZoom: compact ? 6 : 7,
        duration: reducedMotion() ? 0 : 600,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.key, ready]);

  // Places by year: fade each in or out (feature-state t), and name only those
  // that belong (a filter, so hidden names do not crowd out the others).
  const timeRef = useRef<() => void>(() => {});
  const labelsRef = useRef<Partial<Record<"places" | "context", Map<string, string>>>>({});
  const namedKey = useRef<Record<string, string>>({});
  timeRef.current = () => {
    const map = mapRef.current;
    const tw = tweensRef.current;
    if (!map || !tw || year === null || year === undefined) return;
    // Dates come with the context layer: wait for it, so places are placed in time once, not faded later.
    if (context && !contextLoaded.current) return;
    const timeOf = new Map(contextRef.current.map((c) => [c.id, c]));
    const apply = (
      source: "places" | "context",
      layer: string,
      items: { id: string; kind: string; label: string; time?: PlaceTime }[],
    ) => {
      const named: string[] = [];
      const w = new Map<string, number>();
      for (const f of items) {
        const r = timeWeight(f.kind, f.time ?? timeOf.get(f.id)?.time, year, timeWindow);
        w.set(f.id, r.w);
        if (r.label) named.push(f.id);
      }
      tw.sync(
        source,
        items.map((f) => f.id),
        { t: (id) => w.get(id) ?? 1 },
      );
      // Names by the year, where a source dates them: rewrite the source only when one changes.
      const labels = new Map<string, string>();
      for (const f of items as { id: string; label: string; time?: PlaceTime }[]) {
        const n = nameAt(f.label, f.time ?? timeOf.get(f.id)?.time, year);
        if (n !== f.label) labels.set(f.id, n);
      }
      const lk = [...labels].map(([id, n]) => `${id}=${n}`).join("|");
      if (
        (labelsRef.current[source]?.size
          ? [...labelsRef.current[source]!].map(([id, n]) => `${id}=${n}`).join("|")
          : "") !== lk
      ) {
        labelsRef.current[source] = labels;
        if (source === "places")
          setSource(
            map,
            "places",
            placeData(latest.current.features, latest.current.focusId, labels),
          );
        else
          setSource(
            map,
            "context",
            contextData(contextIds.current.map((id) => timeOf.get(id)!).filter(Boolean), labels),
          );
      }
      const key = named.join(",");
      if (namedKey.current[layer] === key || !map.getLayer(layer)) return;
      namedKey.current[layer] = key;
      const base = layer === "point-labels" ? ["==", ["geometry-type"], "Point"] : null;
      const only = ["in", ["get", "id"], ["literal", named]];
      map.setFilter(layer, (base ? ["all", base, only] : only) as never);
    };
    apply("places", "point-labels", latest.current.features);
    apply(
      "context",
      "context-labels",
      contextIds.current.map((id) => timeOf.get(id)!).filter(Boolean),
    );
  };
  useEffect(() => {
    if (ready) timeRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, timeWindow, ready, placesKey]);

  // Highlights: feature-state tweens (no camera move), names on top, and the pinned card.
  const hoverKey = highlight?.hover?.join(",") ?? "";
  const emphasisKey = highlight?.emphasis?.join(",") ?? "";
  const pinned = highlight?.pinned ?? null;
  const applyRef = useRef<() => void>(() => {});
  applyRef.current = () => {
    const map = mapRef.current;
    const tw = tweensRef.current;
    if (!map || !tw) return;
    const hover = new Set([
      ...(highlight?.hover ?? []),
      ...(mapHoverRef.current ? [mapHoverRef.current] : []),
    ]);
    const pin = new Set(pinned?.ids ?? []);
    const emph = new Set(highlight?.emphasis ?? []);
    const placeIds = latest.current.features.map((f) => f.id);
    tw.sync("places", placeIds, {
      h: (id) => hover.has(id),
      p: (id) => pin.has(id),
      e: (id) => emph.has(id),
    });
    const polityOf = new Map(latest.current.extents.map((x) => [x.id, x.entityId ?? ""]));
    for (const source of ["extents", "extent-names"])
      tw.sync(source, [...polityOf.keys()], {
        h: (id) => hover.has(polityOf.get(id)!) || id === mapHoverExtentRef.current,
        p: (id) => pin.has(polityOf.get(id)!),
      });
    // Names drawn on top: what is hovered, and what is pinned (a single pinned place has its card instead).
    const carded = pinCards && pin.size === 1 ? [...pin][0] : null;
    const lit = latest.current.features.filter(
      (f) =>
        (hover.has(f.id) || pin.has(f.id)) && f.id !== carded && f.geo.geometry.type === "Point",
    );
    (map.getSource("lit") as GeoJSONSource | undefined)?.setData(
      placeData(lit, undefined, labelsRef.current.places),
    );
    if (map.getLayer("lit-labels"))
      map.setPaintProperty("lit-labels", "text-opacity", lit.length ? 1 : 0);
  };
  useEffect(() => {
    if (ready) applyRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverKey, emphasisKey, pinned?.nonce, pinned === null, ready, pinCards]);

  // Pinning frames what was pinned (when asked) and labels a single place with a card.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    popupRef.current?.remove();
    popupRef.current = null;
    if (!pinned?.ids.length) return;
    const ids = new Set(pinned.ids);
    const places = [
      ...latest.current.features,
      ...contextRef.current.filter((c) => !latest.current.features.some((f) => f.id === c.id)),
    ].filter((f) => ids.has(f.id));
    const polities = latest.current.extents.filter(
      (x) =>
        x.entityId &&
        ids.has(x.entityId) &&
        (year == null || ((x.fromYear ?? -1e5) <= year && (x.toYear ?? 1e5) >= year)),
    );
    const coords: Coord[] = [];
    places.forEach((p) => coordsOf(p.geo.geometry, coords));
    polities.forEach((x) => coordsOf(x.geometry, coords));
    if (!coords.length) return; // nothing with geography: ignore quietly
    const duration = reducedMotion() ? 0 : 800;
    // Frame a pin once, when it is new; a re-run (the strip folding) only redraws its card.
    const fresh = framedPin.current !== pinned.nonce;
    framedPin.current = pinned.nonce;
    if (pinned.frame && fresh) {
      if (places.length === 1 && !polities.length && places[0]!.geo.geometry.type === "Point") {
        // One point: bring it into view at about the zoom the reader has, wide
        // enough to show the region around it (zoom in only from far out). With
        // a card, the point sits below the centre so the card fits above it,
        // clear of the year in the bottom corner.
        const z = Math.min(compact ? 4.5 : 6, Math.max(compact ? 3.1 : 4, map.getZoom()));
        const below = pinCards ? Math.round(map.getCanvas().clientHeight * 0.24) : 0;
        map.easeTo({ center: coords[0]!, zoom: z, offset: [0, below], duration });
      } else {
        const box = boundsOf(coords, compact ? [12, 9] : [14, 10]);
        if (box)
          map.fitBounds(box, { padding: compact ? 24 : 56, maxZoom: compact ? 5 : 6, duration });
      }
    }
    if (places.length === 1 && pinCards) {
      const p = places[0]!;
      const at =
        p.geo.geometry.type === "Point" ? (p.geo.geometry.coordinates as Coord) : coords[0]!;
      // Where it is today too, for a reader who doesn't know the old name ("Today Patna").
      void Promise.all([import("maplibre-gl"), todayNear(at)]).then(([maplibre, today]) => {
        if (mapRef.current !== map) return;
        const content = placeCard({
          slug: p.slug,
          label: p.label,
          when: placeWhen(p),
          certainty: p.geo.certainty,
          today,
        });
        // A slot the page's control (cardAction) is rendered into, through a portal.
        const slot = document.createElement("div");
        slot.style.marginTop = "6px";
        content.appendChild(slot);
        const popup = new maplibre.Popup({
          closeButton: false,
          closeOnClick: false,
          // Never take focus: on phones the page would scroll back up to the map.
          focusAfterOpen: false,
          offset: 14,
          className: "pin-popup",
        })
          .setLngLat(at)
          .setDOMContent(content)
          .addTo(map);
        popup.on("close", () => setCardSlot((cur) => (cur?.el === slot ? null : cur)));
        setCardSlot({ el: slot, id: p.id, label: p.label });
        popupRef.current = popup;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned?.nonce, pinned === null, ready, pinCards]);

  // A note the reader brought up (a stop they chose, or the stop the page opens
  // on) that would sit off the map widens the view just enough to show it.
  const widenForNotes = useRef<(notes: MapAnnotation[]) => void>(() => {});
  widenForNotes.current = (notes) => {
    const map = mapRef.current;
    if (!map || !notes.length) return;
    // The place must be in view (with a small margin); the text then leans away
    // from the nearer edge (noteData), so it never needs a wider view.
    const canvas = map.getCanvas();
    const [W, H] = [canvas.clientWidth, canvas.clientHeight];
    const outside = notes.filter((a) => {
      const p = map.project(a.at);
      return p.x < 24 || p.x > W - 24 || p.y < 44 || p.y > H - 28;
    });
    if (!outside.length) return;
    const b = map.getBounds();
    const xs = [b.getWest(), b.getEast(), ...outside.map((a) => a.at[0])];
    const ys = [b.getSouth(), b.getNorth(), ...outside.map((a) => a.at[1])];
    map.fitBounds(
      [
        [Math.min(...xs), Math.min(...ys)],
        [Math.max(...xs), Math.max(...ys)],
      ],
      {
        padding: { left: 24, right: 24, top: 44, bottom: 28 },
        maxZoom: map.getZoom(),
        duration: reducedMotion() ? 0 : 600,
      },
    );
  };

  /** Notes as map data, each anchored so its text stays inside the map. */
  noteDataRef.current = (map, notes) => noteData(map, notes);
  const noteData = (map: MlMap, notes: MapAnnotation[]): GeoJSON.FeatureCollection => {
    const W = map.getCanvas().clientWidth;
    const charPx = compact ? 6.6 : 7.7;
    return {
      type: "FeatureCollection",
      features: notes.map((a) => {
        const x = map.project(a.at).x;
        const half = (a.text.length * charPx) / 2 + 8;
        const anchor = x > W - half ? "bottom-right" : x < half ? "bottom-left" : "bottom";
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: a.at },
          properties: { id: a.id, text: a.text, anchor },
        };
      }),
    };
  };

  // Notes: replace the data in place (no camera move).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    widenForNotes.current(annotations ?? []);
    (map.getSource("notes") as GeoJSONSource | undefined)?.setData(
      noteData(map, annotations ?? []),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, ready]);

  // Rivers the page names: a filter on the river layer already drawn.
  // Names compared plainly: lower case, no diacritics, no "river" ("Sutlej river" is Natural Earth's "Sutlej").
  const plain = (n: string) =>
    n
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .toLowerCase()
      .replace(/\s+river$|^river\s+/g, "")
      .trim();
  const riverKey = [...new Set((rivers ?? []).flatMap((r) => r.names.map(plain)))].join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const names = riverKey ? riverKey.split("|") : [];
    // Natural Earth writes "Ganges"; our pages may say "Ganga": both are among an entity's names.
    const f = ["in", ["downcase", ["coalesce", ["get", "name"], ""]], ["literal", names]];
    for (const id of ["rivers-named", "rivers-named-labels"])
      if (map.getLayer(id)) map.setFilter(id, f as never);
  }, [riverKey, ready]);

  // Pins: replace the data in place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("pins") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: (pins ?? []).map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: p.at },
        properties: { id: p.id, tone: p.tone, ...(p.label ? { label: p.label } : {}) },
      })),
    });
  }, [pins, ready]);

  // Picking: a crosshair over the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.getCanvas().style.cursor = onPick ? "crosshair" : "";
  }, [onPick, ready]);

  // Toggle the present-day layers in place.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Names too on a small map: without them the dots say nothing.
    const vis = modernLabels ? "visible" : "none";
    for (const id of ["modern-borders", "modern-cities", "modern-city-labels", "modern-places-osm"])
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
  }, [modernLabels, ready]);

  return (
    <div className={cn("relative", className && height === undefined && "h-full")}>
      <div
        ref={ref}
        className={cn(
          "w-full overflow-hidden bg-rule-soft transition-[height] duration-300 ease-out motion-reduce:transition-none",
          !flush && "rounded-md border border-rule",
          className,
        )}
        // A number sets the height here; otherwise the classes do (or the old default when there are none).
        style={height !== undefined ? { height } : className ? undefined : { height: 380 }}
        role="region"
        aria-label={regionLabel}
      />
      <button
        type="button"
        onClick={() => goHome(reducedMotion() ? 0 : 500)}
        className={cn(
          "absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-md bg-paper/90 px-2 py-1 font-sans text-xs text-ink-2 border border-rule backdrop-blur transition-[color,opacity] hover:text-ink",
          !ready && "opacity-0",
        )}
        // Named by its visible words; the icon-only compact button says the same.
        {...(compact ? { "aria-label": "Reset view", title: "Reset view" } : {})}
      >
        <RotateCcw className="size-3" aria-hidden />
        {!compact && "Reset view"}
      </button>
      {children}
      {trouble && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-paper/70 backdrop-blur-sm">
          <p className="flex items-center gap-2 rounded-md border border-rule bg-paper px-3 py-1 font-sans text-xs text-ink-2">
            {trouble === "lost"
              ? "The map stopped drawing."
              : "The map is taking a long time to load."}
            <button
              type="button"
              onClick={() => {
                setTrouble(null);
                setRebuild((n) => n + 1);
              }}
              className="rounded-sm bg-indigo-wash px-2 font-medium text-indigo hover:bg-indigo hover:text-paper"
            >
              {trouble === "lost" ? "Reload map" : "Retry"}
            </button>
          </p>
        </div>
      )}
      {ready > 0 && !painted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded-md bg-paper/90 px-2.5 py-0.5 font-sans text-xs text-ink-3 border border-rule backdrop-blur">
            Loading map…
          </span>
        </div>
      )}
      {!ready && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 animate-pulse bg-rule-soft/60",
            !flush && "rounded-md",
          )}
        />
      )}
      {attributionAsText && (
        <p className="mt-1 font-sans text-[11px] leading-4 text-ink-3">
          Map: © OpenStreetMap contributors, OpenFreeMap; Natural Earth; terrain Mapzen / AWS
          {extentAttribution ? `. ${extentAttribution}` : ""}.
        </p>
      )}
      {cardSlot && cardAction && createPortal(cardAction(cardSlot), cardSlot.el)}
      {/* The places drawn, as links: the canvas itself is not reachable by keyboard. */}
      {listPlaces && features.length > 0 && (
        <div className="visually-hidden">
          {/* Not a heading: the map may sit anywhere in a page's outline. */}
          <p>Places on this map</p>
          <ul>
            {features.map((f) => (
              <li key={f.id}>
                <a href={`/e/${f.slug}`}>{f.label}</a>
                {f.whenLabel ? `, ${f.whenLabel}` : ""}
                {f.geo.certainty !== "exact" ? `, location ${f.geo.certainty}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface ExtentProps {
  id: string;
  name: string;
  entityId: string;
  years: string;
  href: string;
  culture: number;
  src: string;
  caveat: string;
}

/**
 * What an outline is: "Maurya Empire. As drawn by Cliopatria for 268–232 BCE:
 * one reconstruction; its uncertainty is not drawn." (the dataset's own caveat,
 * Bennett et al. 2025), plus any known limit of the row.
 */
function extentCard(p: ExtentProps, linked: boolean): HTMLElement {
  const by = p.src ? `As drawn by ${p.src}` : "As drawn";
  const meta = [
    p.culture ? "A culture area, not a state." : "",
    p.years ? `${by} for ${p.years}: one reconstruction; its uncertainty is not drawn.` : "",
    p.caveat,
  ]
    .filter(Boolean)
    .join(" ");
  return card(p.name, linked && p.href ? p.href : null, meta);
}

/** A diagonal hatch for culture areas, in the theme's quiet ink. */
function hatch(color: string, dark: boolean) {
  const size = 12;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  g.strokeStyle = color;
  g.globalAlpha = dark ? 0.55 : 0.45;
  g.lineWidth = 1.5;
  g.beginPath();
  for (const o of [-size, 0, size]) {
    g.moveTo(o, size);
    g.lineTo(o + size, 0);
  }
  g.stroke();
  return g.getImageData(0, 0, size, size);
}

/** A rendered feature the reader can see (not faded out for the year shown). */
function shown(f: MapGeoJSONFeature | undefined): boolean {
  if (!f) return false;
  const t = (f.state as { t?: number } | undefined)?.t;
  return t === undefined || t > 0.15;
}

/** A small card for a popup: a linked name and a quiet line under it. */
function card(label: string, href: string | null, meta: string): HTMLElement {
  const el = document.createElement("div");
  const name = document.createElement(href ? "a" : "span");
  if (href) (name as HTMLAnchorElement).href = href;
  name.textContent = label;
  name.style.fontWeight = "600";
  el.appendChild(name);
  if (meta) {
    const m = document.createElement("div");
    m.textContent = meta;
    m.style.color = "var(--ink-3)";
    el.appendChild(m);
  }
  return el;
}

let citiesLoad: Promise<{ name: string; at: Coord }[]> | null = null;

/** Present-day cities (the basemap's own list), loaded once. */
function modernCities(): Promise<{ name: string; at: Coord }[]> {
  citiesLoad ??= fetch("/geo/cities.geojson")
    .then((r) => r.json() as Promise<GeoJSON.FeatureCollection<GeoJSON.Point, { name: string }>>)
    .then((d) =>
      d.features.map((f) => ({ name: f.properties.name, at: f.geometry.coordinates as Coord })),
    )
    .catch(() => {
      citiesLoad = null;
      return [];
    });
  return citiesLoad;
}

/** "Today Patna" (within 4 km), "Near today's Varanasi" (within 60 km), or nothing. */
async function todayNear(at: Coord): Promise<string | null> {
  const km = (a: Coord, b: Coord) => {
    const rad = Math.PI / 180;
    const x = (b[0] - a[0]) * rad * Math.cos(((a[1] + b[1]) / 2) * rad);
    const y = (b[1] - a[1]) * rad;
    return Math.hypot(x, y) * 6371;
  };
  let best: { name: string; d: number } | null = null;
  for (const c of await modernCities()) {
    const d = km(at, c.at);
    if (!best || d < best.d) best = { name: c.name, d };
  }
  if (!best || best.d > 60) return null;
  return best.d <= 4 ? `Today ${best.name}` : `Near today’s ${best.name}`;
}

/** A place's date in the page's own words ("founded c. 490 BCE (traditional)"). */
function placeWhen(f: MapFeature): string {
  return datedLabel({ kind: f.kind, when: f.when ?? null, whenLabel: f.whenLabel }) ?? "";
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Its name, its date, then where it is: "Today Patna, location approximate". */
function placeCard(p: {
  slug: string;
  label: string;
  when: string;
  certainty: string;
  today?: string | null;
}): HTMLElement {
  const el = card(p.label, `/e/${p.slug}`, capital(p.when));
  const where = [p.today, p.certainty !== "exact" ? `location ${p.certainty}` : ""]
    .filter(Boolean)
    .join(", ");
  if (where) {
    const m = document.createElement("div");
    m.textContent = capital(where);
    m.style.color = "var(--ink-3)";
    el.appendChild(m);
  }
  return el;
}
