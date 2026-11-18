/**
 * Builds the static geography layers for the history basemap from Natural
 * Earth (public domain, https://www.naturalearthdata.com): physical region
 * labels (mountain ranges, deserts, plateaus, plains), seas, rivers, and major
 * modern cities as faint reference points. Clipped to South Asia and its
 * neighbours and written to apps/web/public/geo/*.geojson.
 *
 *   pnpm tsx scripts/geo/build-basemap-data.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { douglasPeucker } from "@pramana/core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "apps", "web", "public", "geo");
const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";
/** [minLon, minLat, maxLon, maxLat]: Iran to Myanmar, Sri Lanka to Central Asia. */
const BBOX: [number, number, number, number] = [44, -2, 104, 46];

type Pos = [number, number];
interface Feature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

const inBox = ([x, y]: Pos) => x >= BBOX[0] && x <= BBOX[2] && y >= BBOX[1] && y <= BBOX[3];

function positions(c: unknown, acc: Pos[] = []): Pos[] {
  if (Array.isArray(c) && typeof c[0] === "number") acc.push(c as Pos);
  else if (Array.isArray(c)) c.forEach((x) => positions(x, acc));
  return acc;
}

/** Keeps lines (or parts of multi-lines) with any vertex in the box; rounds coordinates. */
function clipLines(f: Feature): Feature | null {
  // Simplify (0.01° is invisible at the zooms this basemap is used at) and round to ~100 m.
  const tidy = (l: Pos[]): Pos[] =>
    (douglasPeucker(l, 0.01) as Pos[]).map((p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100] as Pos);
  if (f.geometry.type === "LineString") {
    const line = f.geometry.coordinates as Pos[];
    return line.some(inBox) ? { ...f, geometry: { type: "LineString", coordinates: tidy(line) } } : null;
  }
  if (f.geometry.type === "MultiLineString") {
    const parts = (f.geometry.coordinates as Pos[][]).filter((l) => l.some(inBox)).map(tidy);
    return parts.length ? { ...f, geometry: { type: "MultiLineString", coordinates: parts } } : null;
  }
  return null;
}

/** Natural Earth files differ in key case (NAME vs name): read case-insensitively. */
function pick(props: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const lower = Object.fromEntries(Object.entries(props).map(([k, v]) => [k.toLowerCase(), v]));
  return Object.fromEntries(keys.filter((k) => lower[k] !== undefined && lower[k] !== null && lower[k] !== "").map((k) => [k, lower[k]]));
}

async function load(name: string): Promise<Feature[]> {
  const res = await fetch(`${BASE}/${name}.geojson`);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return ((await res.json()) as { features: Feature[] }).features;
}

async function save(name: string, features: Feature[]) {
  const body = JSON.stringify({ type: "FeatureCollection", features });
  await writeFile(join(out, `${name}.geojson`), body);
  console.log(`${name}: ${features.length} features, ${(body.length / 1024).toFixed(0)} KB`);
}

await mkdir(out, { recursive: true });

// Physical regions as label points: ranges, deserts, plateaus, plains, deltas.
const regions = (await load("ne_10m_geography_regions_points"))
  .filter((f) => inBox(f.geometry.coordinates as Pos))
  .map((f) => ({ ...f, properties: pick(f.properties, ["name", "featurecla", "scalerank", "min_zoom", "label"]) }))
  .filter((f) => f.properties.name);
// Region polygons: label anchors for large features (e.g. the Thar, the Deccan).
const regionPolys = (await load("ne_10m_geography_regions_polys"))
  .filter((f) => positions(f.geometry.coordinates).some(inBox))
  .map((f) => ({
    type: "Feature" as const,
    // Label at the polygon's bounding-box centre; geometry itself is not drawn.
    geometry: (() => {
      const ps = positions(f.geometry.coordinates);
      const xs = ps.map((p) => p[0]);
      const ys = ps.map((p) => p[1]);
      return { type: "Point", coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] };
    })(),
    properties: pick(f.properties, ["name", "featurecla", "scalerank", "min_zoom", "label"]),
  }))
  .filter((f) => inBox(f.geometry.coordinates as Pos) && f.properties.name);
await save("regions", [...regionPolys, ...regions]);

// Seas, gulfs and bays.
const marine = (await load("ne_10m_geography_marine_polys"))
  .filter((f) => positions(f.geometry.coordinates).some(inBox))
  .map((f) => {
    const ps = positions(f.geometry.coordinates).filter(inBox);
    const xs = ps.map((p) => p[0]);
    const ys = ps.map((p) => p[1]);
    return {
      type: "Feature" as const,
      geometry: { type: "Point", coordinates: [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] },
      properties: pick(f.properties, ["name", "featurecla", "scalerank", "min_zoom", "label"]),
    };
  });
await save("marine", marine);

// Rivers with names (the 10m set carries scalerank for width and label priority).
const rivers = (await load("ne_10m_rivers_lake_centerlines"))
  .map((f) => clipLines({ ...f, properties: pick(f.properties, ["name", "featurecla", "scalerank", "min_zoom"]) }))
  .filter((f): f is Feature => f !== null);
await save("rivers", rivers);

// Major modern cities: present-day reference points, shown faintly.
const cities = (await load("ne_10m_populated_places_simple"))
  .filter((f) => inBox(f.geometry.coordinates as Pos) && Number(f.properties.scalerank ?? 10) <= 5)
  .map((f) => ({ ...f, properties: pick(f.properties, ["name", "nameascii", "adm0name", "featurecla", "scalerank", "min_zoom", "pop_max", "adm0cap"]) }));
await save("cities", cities);

await writeFile(
  join(out, "SOURCES.md"),
  "Natural Earth (public domain), https://www.naturalearthdata.com — via github.com/nvkelso/natural-earth-vector.\nBuilt by scripts/geo/build-basemap-data.ts; clipped to 44–104°E, 2°S–46°N.\n",
);
