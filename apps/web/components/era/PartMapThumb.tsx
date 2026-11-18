"use client";

import type { ExtentFeature, MapFeature } from "@pramana/services";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// No loading box of its own: the static drawing below stays until the live map has painted.
const MiniMap = dynamic(() => import("@/components/map/MiniMap").then((m) => m.MiniMap), {
  ssr: false,
  loading: () => null,
});

const HEIGHT = 140;

/** Borders in force in a year, fetched once per year for every part that shows it. */
const bordersByYear = new Map<number, Promise<ExtentFeature[]>>();
function bordersAt(year: number): Promise<ExtentFeature[]> {
  let p = bordersByYear.get(year);
  if (!p) {
    p = fetch(`/api/extents?year=${year}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: ExtentFeature[]) => d.filter((e) => e.geometry))
      .catch(() => {
        bordersByYear.delete(year);
        return [];
      });
    bordersByYear.set(year, p);
  }
  return p;
}

/** The year's borders, and whether they have arrived (a part with no year has none to wait for). */
function useBordersAt(year: number | null) {
  const [rows, setRows] = useState<ExtentFeature[]>([]);
  const [ready, setReady] = useState(year === null);
  useEffect(() => {
    if (year === null) return setReady(true);
    let live = true;
    setReady(false);
    void bordersAt(Math.round(year)).then((d) => {
      if (!live) return;
      setRows(d);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [year]);
  return [rows, ready] as const;
}

type Ring = [number, number][];
function ringsOf(g: GeoJSON.Geometry): Ring[] {
  if (g.type === "Polygon") return g.coordinates as Ring[];
  if (g.type === "MultiPolygon") return (g.coordinates as Ring[][]).flat();
  return [];
}
function pointOf(g: GeoJSON.Geometry): [number, number] | null {
  if (g.type === "Point") return g.coordinates as [number, number];
  const r = ringsOf(g)[0];
  if (!r?.length) return null;
  const [sx, sy] = r.reduce(([x, y], [a, b]) => [x + a, y + b], [0, 0]);
  return [sx / r.length, sy / r.length];
}

/** Web Mercator, in MapLibre's world pixels at zoom 0 (512 wide), so the drawing frames as the live map will. */
const merc = ([lon, lat]: [number, number]): [number, number] => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * 512, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 512];
};

/**
 * The part's map drawn at once, as the live map will frame it (its places and
 * the page's own borders, with MapLibre's compact padding and zoom limit): the
 * borders of the year and the places as dots. No tiles, so it is there on the
 * first paint, and the live map fades in over it.
 */
function StaticPartMap({
  places,
  extents,
  width,
}: {
  places: MapFeature[];
  extents: { id: string; geometry: GeoJSON.Geometry; emphasis: "focus" | "neighbour" }[];
  width: number;
}) {
  const drawing = useMemo(() => {
    const coords: [number, number][] = [];
    places.forEach((p) => {
      const at = pointOf(p.geo.geometry);
      if (at) coords.push(at);
    });
    extents
      .filter((e) => e.emphasis === "focus")
      .forEach((e) => ringsOf(e.geometry).forEach((r) => coords.push(...r)));
    if (!coords.length) coords.push([79, 22]);
    // As MapCanvas frames a compact map: at least 10° by 8°, padded, never past zoom 6.
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of coords) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
    if (x1 - x0 < 10) [x0, x1] = [cx - 5, cx + 5];
    if (y1 - y0 < 8) [y0, y1] = [cy - 4, cy + 4];
    const [ax, ay] = merc([x0, y1]);
    const [bx, by] = merc([x1, y0]);
    const pad = { top: 30, bottom: 40, left: 16, right: 16 };
    const availW = Math.max(1, width - pad.left - pad.right);
    const availH = Math.max(1, HEIGHT - pad.top - pad.bottom);
    const scale = Math.min(availW / (bx - ax), availH / (by - ay), 2 ** 6);
    const ox = pad.left + availW / 2 - ((ax + bx) / 2) * scale;
    const oy = pad.top + availH / 2 - ((ay + by) / 2) * scale;
    const xy = (c: [number, number]) => {
      const [x, y] = merc(c);
      return [x * scale + ox, y * scale + oy] as const;
    };
    const path = (g: GeoJSON.Geometry) =>
      ringsOf(g)
        .map(
          (r) =>
            r
              .map((c, i) => {
                const [x, y] = xy(c);
                return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
              })
              .join("") + "Z",
        )
        .join("");
    return {
      borders: extents.map((e) => ({ id: e.id, d: path(e.geometry), focus: e.emphasis === "focus" })),
      dots: places.flatMap((p) => {
        const at = pointOf(p.geo.geometry);
        return at ? [{ id: p.id, at: xy(at) }] : [];
      }),
    };
  }, [places, extents, width]);
  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      aria-hidden
      className="absolute inset-0 rounded-md border border-rule bg-[#fbfbfd] dark:bg-[#191d47]"
    >
      {drawing.borders
        .filter((b) => !b.focus)
        .map((b) => (
          <path
            key={b.id}
            d={b.d}
            className="fill-none stroke-[#9498b8] dark:stroke-[#585e94]"
            strokeWidth={0.8}
            strokeDasharray="3 2"
          />
        ))}
      {drawing.borders
        .filter((b) => b.focus)
        .map((b) => (
          <path
            key={b.id}
            d={b.d}
            className="fill-indigo/10 stroke-indigo"
            strokeWidth={1.2}
            strokeDasharray="4 2"
          />
        ))}
      {drawing.dots.map((d) => (
        <circle
          key={d.id}
          cx={d.at[0]}
          cy={d.at[1]}
          r={4}
          className="fill-sandstone stroke-paper"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

/**
 * A small map for one part on a phone: its places, and the borders of its
 * year. A static drawing is there at once; the live map (zoomable, with land
 * and water) is mounted only while the part is on or near the screen, so a
 * page of nine parts never holds nine live maps, and it fades in once painted.
 */
export function PartMapThumb({
  places,
  year,
  yearLabel,
  focusEntityId,
}: {
  places: MapFeature[];
  year: number | null;
  yearLabel: string | null;
  focusEntityId?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [painted, setPainted] = useState(false);
  const [width, setWidth] = useState(358);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(Boolean(e?.isIntersecting)), {
      rootMargin: "50% 0px",
    });
    io.observe(el);
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth) || 358));
    ro.observe(el);
    return () => {
      io.disconnect();
      ro.disconnect();
    };
  }, []);
  // A map mounted again (scrolled away and back) fades in afresh.
  useEffect(() => {
    if (!near) setPainted(false);
  }, [near]);
  const [borders, bordersReady] = useBordersAt(year);
  const extents = useMemo(
    () =>
      borders.map((e) => ({
        id: e.id,
        name: e.entity?.label ?? e.name,
        geometry: e.geometry!,
        emphasis: (e.entity?.id === focusEntityId ? "focus" : "neighbour") as "focus" | "neighbour",
      })),
    [borders, focusEntityId],
  );
  if (!places.length && year === null) return null;
  return (
    <figure
      className="mt-4"
      aria-label={yearLabel ? `Map of this part, ${yearLabel}` : "Map of this part"}
    >
      <div ref={ref} className="relative overflow-hidden rounded-md" style={{ height: HEIGHT }}>
        <StaticPartMap places={places} extents={extents} width={width} />
        {/* Mounted once the year's borders are in, so its first full paint includes them. */}
        {near && bordersReady && (
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none",
              painted ? "opacity-100" : "opacity-0",
            )}
          >
            <MiniMap
              features={places}
              extents={extents}
              height={HEIGHT}
              focusId={focusEntityId ?? undefined}
              onPainted={() => setPainted(true)}
            />
          </div>
        )}
        {yearLabel && (
          <span className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-paper/90 px-2 py-0.5 font-sans text-xs font-medium text-ink shadow-card tnum">
            {yearLabel}
          </span>
        )}
      </div>
      {borders.length > 0 && (
        <figcaption className="mt-1 font-sans text-xs text-ink-3">
          Borders are reconstructions, after Cliopatria (Seshat), CC BY 4.0.
        </figcaption>
      )}
    </figure>
  );
}
