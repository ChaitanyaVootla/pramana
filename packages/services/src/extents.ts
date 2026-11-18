import {
  claimIdsInBlock,
  entityRefsInBlock,
  dateBounds,
  extentYearsLabel,
  isUuid,
  pointInMultiPolygon,
  pointInPolygon,
  rewindMultiPolygon,
  ringAreaKm2,
  roundMultiPolygon,
  simplifyMultiPolygon,
  type Bbox,
  type MultiPolygonGeometry,
} from "@pramana/core";
import { claimEntities, claims, entities, entityLinks, extents, getDb, pages, type DbOrTx } from "@pramana/db";
import { and, asc, eq, gte, inArray, isNotNull, lte, or, sql, type SQL } from "drizzle-orm";
import { NotFoundError } from "./util";

/**
 * Historical extents (borders) for maps. Years are astronomical integers,
 * inclusive (-317 = 318 BCE). Geometry is a simplified GeoJSON MultiPolygon;
 * every feature carries its licence and attribution, which the UI must show.
 */
export interface ExtentFeature {
  id: string;
  name: string;
  /** The linked entity, if any. */
  entity: { id: string; slug: string; label: string; kind: string } | null;
  fromYear: number;
  toYear: number;
  /** "318–316 BCE". */
  yearsLabel: string;
  /** Omitted when the caller asked for metadata only. */
  geometry?: MultiPolygonGeometry;
  bbox: Bbox;
  areaKm2: number | null;
  dataset: string;
  datasetRef: string | null;
  certainty: string;
  license: string;
  attribution: string;
  sourceId: string | null;
  note: string | null;
  version: number;
}

export interface ExtentQueryOptions {
  db?: DbOrTx;
  /** Include geometry (default true). */
  geometry?: boolean;
  /** Only these datasets. */
  dataset?: string;
  /** Only extents linked to these entity ids. */
  entityIds?: string[];
  limit?: number;
}

type Row = typeof extents.$inferSelect;
type EntityBrief = { id: string; slug: string; label: string; kind: string };

async function toFeatures(
  db: DbOrTx,
  rows: Row[],
  withGeometry: boolean,
): Promise<ExtentFeature[]> {
  const ids = [...new Set(rows.map((r) => r.entityId).filter((id): id is string => Boolean(id)))];
  const briefs = ids.length
    ? await db
        .select({ id: entities.id, slug: entities.slug, label: entities.label, kind: entities.kind })
        .from(entities)
        .where(inArray(entities.id, ids))
    : [];
  const byId = new Map<string, EntityBrief>(briefs.map((b) => [b.id, b]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    entity: r.entityId ? (byId.get(r.entityId) ?? null) : null,
    fromYear: r.fromYear,
    toYear: r.toYear,
    yearsLabel: extentYearsLabel(r.fromYear, r.toYear),
    ...(withGeometry ? { geometry: r.geometry } : {}),
    bbox: [r.minLon, r.minLat, r.maxLon, r.maxLat],
    areaKm2: r.areaKm2,
    dataset: r.dataset,
    datasetRef: r.datasetRef,
    certainty: r.certainty,
    license: r.license,
    attribution: r.attribution,
    sourceId: r.sourceId,
    note: r.note,
    version: r.version,
  }));
}

function bboxCondition(bbox: Bbox | undefined): SQL | undefined {
  if (!bbox) return undefined;
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return and(
    lte(extents.minLon, maxLon),
    gte(extents.maxLon, minLon),
    lte(extents.minLat, maxLat),
    gte(extents.maxLat, minLat),
  );
}

/**
 * Extents in force in an astronomical year (fromYear <= year <= toYear),
 * optionally only those whose bounding box meets `bbox`. Largest first, so
 * small polities draw on top.
 */
export async function extentsAt(
  year: number,
  bbox?: Bbox,
  options: ExtentQueryOptions = {},
): Promise<ExtentFeature[]> {
  const db = options.db ?? getDb();
  const rows = await db
    .select()
    .from(extents)
    .where(
      and(
        lte(extents.fromYear, Math.floor(year)),
        gte(extents.toYear, Math.floor(year)),
        bboxCondition(bbox),
        options.dataset ? eq(extents.dataset, options.dataset) : undefined,
        options.entityIds?.length ? inArray(extents.entityId, options.entityIds) : undefined,
      ),
    )
    .orderBy(asc(extents.fromYear))
    .limit(Math.min(options.limit ?? 500, 2000));
  rows.sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0));
  return toFeatures(db, rows, options.geometry !== false);
}

/** Every extent of the given entities, oldest first. */
export async function extentsForEntities(
  db: DbOrTx,
  entityIds: string[],
  options: { geometry?: boolean } = {},
): Promise<ExtentFeature[]> {
  if (!entityIds.length) return [];
  const rows = await db
    .select()
    .from(extents)
    .where(inArray(extents.entityId, entityIds))
    .orderBy(asc(extents.fromYear), asc(extents.name));
  return toFeatures(db, rows, options.geometry !== false);
}

/** An entity's extents over time (by slug or id), oldest first. */
export async function extentsForEntity(
  entityRef: string,
  options: { geometry?: boolean; db?: DbOrTx } = {},
): Promise<ExtentFeature[]> {
  const db = options.db ?? getDb();
  const [row] = await db
    .select({ id: entities.id })
    .from(entities)
    .where(isUuid(entityRef) ? eq(entities.id, entityRef) : eq(entities.slug, entityRef))
    .limit(1);
  if (!row) throw new NotFoundError(`entity "${entityRef}" not found`);
  return extentsForEntities(db, [row.id], options);
}

/** Extents of a dataset overlapping a year range (for review and import checks). */
export async function extentsBetween(
  fromYear: number,
  toYear: number,
  options: ExtentQueryOptions & { bbox?: Bbox } = {},
): Promise<ExtentFeature[]> {
  const db = options.db ?? getDb();
  const rows = await db
    .select()
    .from(extents)
    .where(
      and(
        lte(extents.fromYear, toYear),
        gte(extents.toYear, fromYear),
        bboxCondition(options.bbox),
        options.dataset ? eq(extents.dataset, options.dataset) : undefined,
        options.entityIds?.length
          ? inArray(extents.entityId, options.entityIds)
          : undefined,
      ),
    )
    .orderBy(asc(extents.fromYear), asc(extents.name))
    .limit(Math.min(options.limit ?? 2000, 5000));
  return toFeatures(db, rows, options.geometry !== false);
}

/**
 * One extent as the atlas draws it: just enough to filter by year, label and
 * link, with geometry simplified for a regional map. Licences and attribution
 * are returned once per dataset (see AtlasExtents) instead of on every row.
 */
export interface AtlasExtent {
  id: string;
  /** The entity's label when linked, else the dataset's name for the polity. */
  name: string;
  entityId: string | null;
  entitySlug: string | null;
  /** The linked entity's kind: "culture" outlines are culture areas, not states. */
  entityKind: string | null;
  /** The dataset's own name for it (for caveats keyed on the dataset's rows). */
  datasetName: string;
  dataset: string;
  fromYear: number;
  toYear: number;
  /** "268–232 BCE": the years this outline is drawn for. */
  yearsLabel: string;
  /** The dataset's area for the whole polity (unclipped), km². */
  areaKm2: number | null;
  bbox: Bbox;
  /** Where to write the name: well inside the largest part, [lon, lat]. */
  labelAt: [number, number];
  geometry: MultiPolygonGeometry;
  /**
   * The outline to stroke, when it differs from the polygon's rings: the
   * dataset's shape was clipped to our import window, and the cut is not a
   * border, so those edges are left out. Absent: stroke the polygon itself.
   */
  outline?: { type: "MultiLineString"; coordinates: [number, number][][] };
}

export interface AtlasExtents {
  extents: AtlasExtent[];
  /** Each dataset drawn, with the licence and attribution it requires. */
  datasets: { dataset: string; license: string; attribution: string }[];
}

/**
 * Every extent overlapping [fromYear, toYear] (and `bbox`, if given), with
 * geometry simplified at `tolerance` degrees (Douglas–Peucker; default 0.03°,
 * about 3 km, invisible at subcontinent scale) and rounded to 0.01°, so a
 * whole scrubber range arrives in one small response and the client filters
 * by year. Largest first, so smaller polities draw on top.
 */
export async function extentsForAtlas(
  fromYear: number,
  toYear: number,
  options: { bbox?: Bbox; tolerance?: number; db?: DbOrTx } = {},
): Promise<AtlasExtents> {
  const db = options.db ?? getDb();
  const tolerance = Math.min(0.5, Math.max(0, options.tolerance ?? 0.03));
  const rows = await db
    .select()
    .from(extents)
    .where(and(lte(extents.fromYear, Math.ceil(toYear)), gte(extents.toYear, Math.floor(fromYear)), bboxCondition(options.bbox)))
    .orderBy(asc(extents.fromYear))
    .limit(5000);
  rows.sort((a, b) => (b.areaKm2 ?? 0) - (a.areaKm2 ?? 0));
  const ids = [...new Set(rows.map((r) => r.entityId).filter((id): id is string => Boolean(id)))];
  const briefs = ids.length
    ? await db
        .select({ id: entities.id, slug: entities.slug, label: entities.label, kind: entities.kind })
        .from(entities)
        .where(inArray(entities.id, ids))
    : [];
  const byId = new Map(briefs.map((b) => [b.id, b]));
  const datasets = new Map<string, AtlasExtents["datasets"][number]>();
  const out: AtlasExtent[] = [];
  for (const r of rows) {
    const simplified = tolerance > 0 ? simplifyMultiPolygon(r.geometry.coordinates, tolerance) : r.geometry.coordinates;
    const coordinates = rewindMultiPolygon(roundMultiPolygon(simplified, 2));
    // A polity too small to survive simplification is too small to see at atlas scale.
    if (!coordinates.length) continue;
    const entity = r.entityId ? byId.get(r.entityId) : undefined;
    datasets.set(r.dataset, { dataset: r.dataset, license: r.license, attribution: r.attribution });
    out.push({
      id: r.id,
      labelAt: labelPoint(r.id, r.version, r.geometry.coordinates),
      name: entity?.label ?? r.name,
      entityId: r.entityId,
      entitySlug: entity?.slug ?? null,
      entityKind: entity?.kind ?? null,
      datasetName: r.name,
      dataset: r.dataset,
      fromYear: r.fromYear,
      toYear: r.toYear,
      yearsLabel: extentYearsLabel(r.fromYear, r.toYear),
      areaKm2: r.areaKm2,
      bbox: [r.minLon, r.minLat, r.maxLon, r.maxLat],
      geometry: { type: "MultiPolygon", coordinates },
      ...outlineWithoutClip(coordinates, CLIP_WINDOWS[r.dataset]),
    });
  }
  return { extents: out, datasets: [...datasets.values()] };
}

type Polygon = MultiPolygonGeometry["coordinates"][number];

/** Distance (degrees, longitude scaled by latitude) from a point to a polygon's nearest edge. */
function edgeDistance(p: [number, number], polygon: Polygon): number {
  const k = Math.cos((p[1] * Math.PI) / 180);
  let best = Infinity;
  for (const ring of polygon) {
    for (let i = 1; i < ring.length; i++) {
      const [ax, ay] = ring[i - 1]!;
      const [bx, by] = ring[i]!;
      const dx = (bx - ax) * k;
      const dy = by - ay;
      const px = (p[0] - ax) * k;
      const py = p[1] - ay;
      const t = dx || dy ? Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy))) : 0;
      best = Math.min(best, Math.hypot(px - t * dx, py - t * dy));
    }
  }
  return best;
}

const labelCache = new Map<string, [number, number]>();

/**
 * A point well inside the largest polygon of an outline (a coarse pole of
 * inaccessibility: a grid search, refined twice), so a polity's name is
 * written once, in its heartland, rather than once per map tile. Cached per
 * extent version.
 */
export function labelPoint(id: string, version: number, mp: MultiPolygonGeometry["coordinates"]): [number, number] {
  const key = `${id}:${version}`;
  const hit = labelCache.get(key);
  if (hit) return hit;
  const largest = mp.reduce((a, b) => (ringAreaKm2(b[0]!) > ringAreaKm2(a[0]!) ? b : a));
  const outer = largest[0]!;
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of outer) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
  let best: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2];
  let bestD = pointInPolygon(best, largest) ? edgeDistance(best, largest) : -1;
  let [w, h] = [x1 - x0, y1 - y0];
  let [cx, cy] = best;
  for (const n of [14, 7, 7]) {
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n; j++) {
        const p: [number, number] = [cx - w / 2 + (w * i) / n, cy - h / 2 + (h * j) / n];
        if (!pointInPolygon(p, largest)) continue;
        const d = edgeDistance(p, largest);
        if (d > bestD) [best, bestD] = [p, d];
      }
    [cx, cy] = best;
    [w, h] = [(w / n) * 2.5, (h / n) * 2.5];
  }
  const out: [number, number] = [Math.round(best[0] * 100) / 100, Math.round(best[1] * 100) / 100];
  if (labelCache.size > 5000) labelCache.clear();
  labelCache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// When a place belongs on a map of a given year
// ---------------------------------------------------------------------------

/**
 * The years a place, site, inscription or event matters on a map, from what
 * the database records (nothing is inferred beyond it):
 *
 *   own       its own date: an event's span; a monument's or inscription's
 *             making, or a city's founding, onward (null ends are open)
 *   attested  for things without a date of their own: the years our dated
 *             claims mention it, and the spans of the periods and polities it
 *             is linked to (Pāṭaliputra with the Maurya Empire)
 *
 * The atlas fades things in and out around these years, so a map of 250 BCE
 * does not show Jallianwala Bagh, and one of 1950 does not show the Kalinga war.
 */
export interface PlaceTime {
  own: [number | null, number | null] | null;
  attested: [number, number][];
  /** Of those, the years dated claims mention it (narrower than a linked period's span). */
  mentions?: [number, number][];
  /** Names a source dates (Bombay, then "Mumbai" from 1995): the label for those years. */
  names?: { label: string; from: number | null; to: number | null }[];
}

export async function placeTimes(ids: string[], db: DbOrTx = getDb()): Promise<Map<string, PlaceTime>> {
  const out = new Map<string, PlaceTime>();
  if (!ids.length) return out;
  const own = await db
    .select({
      id: entities.id,
      start: entities.sortStart,
      end: entities.sortEnd,
      when: entities.when,
      aliases: entities.aliases,
    })
    .from(entities)
    .where(inArray(entities.id, ids));
  for (const r of own) {
    const names = (r.aliases ?? []).flatMap((a) => {
      if (!a.when || (a.lang && a.lang !== "en")) return [];
      const b = dateBounds(a.when);
      return [{ label: a.label, from: b.startMin, to: b.endMax }];
    });
    if (r.start === null && !names.length) continue;
    // An unknown end ("-0489/": founded then, end not recorded) is no end on a map:
    // the place stands from its founding on (dateBounds counts it as the start alone).
    const unknownEnd = /\/$/.test(r.when?.edtf ?? "");
    out.set(r.id, {
      own: r.start === null ? null : [r.start, unknownEnd ? null : r.end],
      attested: [],
      ...(names.length ? { names } : {}),
    });
  }

  const add = (id: string, from: number, to: number) => {
    const t = out.get(id) ?? { own: null, attested: [] };
    t.attested.push([Math.floor(Math.min(from, to)), Math.ceil(Math.max(from, to))]);
    out.set(id, t);
  };
  // Dated claims that mention the place.
  const mentions = await db
    .select({ id: claimEntities.entityId, start: claims.sortStart })
    .from(claimEntities)
    .innerJoin(claims, eq(claims.id, claimEntities.claimId))
    .where(and(inArray(claimEntities.entityId, ids), isNotNull(claims.sortStart)));
  for (const m of mentions) {
    add(m.id, m.start!, m.start!);
    const t = out.get(m.id)!;
    (t.mentions ??= []).push([Math.floor(m.start!), Math.ceil(m.start!)]);
  }
  // Dated periods and polities it is linked to, either way round.
  const links = await db
    .select({ fromId: entityLinks.fromId, toId: entityLinks.toId })
    .from(entityLinks)
    .where(or(inArray(entityLinks.fromId, ids), inArray(entityLinks.toId, ids)));
  const others = [...new Set(links.flatMap((l) => [l.fromId, l.toId]))];
  const dated = others.length
    ? await db
        .select({ id: entities.id, kind: entities.kind, start: entities.sortStart, end: entities.sortEnd })
        .from(entities)
        .where(and(inArray(entities.id, others), isNotNull(entities.sortStart)))
    : [];
  const span = new Map(dated.filter((d) => ["period", "polity", "culture"].includes(d.kind)).map((d) => [d.id, d]));
  const wanted = new Set(ids);
  for (const l of links)
    for (const [self, other] of [
      [l.fromId, l.toId],
      [l.toId, l.fromId],
    ] as const) {
      const d = span.get(other);
      if (wanted.has(self) && d) add(self, d.start!, d.end ?? d.start!);
    }
  for (const t of out.values()) t.attested.sort((a, b) => a[0] - b[0]);
  return out;
}

/**
 * The window each dataset's rows were clipped to at import (scripts/import/
 * cliopatria.ts: WINDOW). Clipping leaves vertices exactly on its edges.
 */
const CLIP_WINDOWS: Record<string, [number, number, number, number]> = {
  "cliopatria-v0.2.1": [55, 0, 100, 42],
};

/**
 * The rings of a clipped shape as lines, without the segments that run along
 * the clip window (both ends on the same edge): those are where our import cut
 * the polity off, not where its border was. Returns nothing when no segment
 * lies on the window (the polygon's own rings are the outline).
 */
export function outlineWithoutClip(
  mp: MultiPolygonGeometry["coordinates"],
  window: [number, number, number, number] | undefined,
): { outline?: { type: "MultiLineString"; coordinates: [number, number][][] } } {
  if (!window) return {};
  const [w, s, e, n] = window;
  const eps = 1e-6;
  const onEdge = (a: number[], b: number[]) =>
    (Math.abs(a[0]! - w) < eps && Math.abs(b[0]! - w) < eps) ||
    (Math.abs(a[0]! - e) < eps && Math.abs(b[0]! - e) < eps) ||
    (Math.abs(a[1]! - s) < eps && Math.abs(b[1]! - s) < eps) ||
    (Math.abs(a[1]! - n) < eps && Math.abs(b[1]! - n) < eps);
  const lines: [number, number][][] = [];
  let cut = false;
  for (const polygon of mp)
    for (const ring of polygon) {
      // Start the walk just after a clipped segment, so a line is never split at the ring's seam.
      const k = ring.findIndex((p, i) => i > 0 && onEdge(ring[i - 1]!, p));
      if (k < 0) {
        lines.push(ring as [number, number][]);
        continue;
      }
      cut = true;
      const open = ring.slice(0, -1);
      const m = open.length;
      let run: [number, number][] = [];
      for (let i = 0; i <= m; i++) {
        const a = open[(k + i - 1 + m) % m]!;
        const b = open[(k + i) % m]!;
        if (onEdge(a, b)) {
          if (run.length > 1) lines.push(run);
          run = [b as [number, number]];
        } else {
          if (!run.length) run.push(a as [number, number]);
          run.push(b as [number, number]);
        }
      }
      if (run.length > 1) lines.push(run);
    }
  return cut ? { outline: { type: "MultiLineString", coordinates: lines } } : {};
}

/**
 * A cheap fingerprint of all borders (how many, and the latest change), so a
 * cache of atlas responses can tell when a changeset has altered them.
 */
export async function extentsVersion(db: DbOrTx = getDb()): Promise<string> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int`, at: sql<string>`coalesce(max(${extents.updatedAt})::text, '')` })
    .from(extents);
  return `${row?.n ?? 0}@${row?.at ?? ""}`;
}

/**
 * The pages that discuss each of these entities: through a claim on the page
 * that names it, or a block that refers to it directly. For the places index
 * ("discussed in: The Maurya Empire").
 */
export async function placePages(
  ids: string[],
  db: DbOrTx = getDb(),
): Promise<Map<string, { slug: string; title: string }[]>> {
  const out = new Map<string, { slug: string; title: string }[]>();
  if (!ids.length) return out;
  const wanted = new Set(ids);
  const rows = await db.select({ slug: pages.slug, title: pages.title, blocks: pages.blocks, position: pages.position }).from(pages);
  rows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const add = (id: string, p: { slug: string; title: string }) => {
    const list = out.get(id) ?? [];
    if (!list.some((x) => x.slug === p.slug)) list.push(p);
    out.set(id, list);
  };
  for (const page of rows) {
    const claimIds = new Set<string>();
    const refs = new Set<string>();
    for (const b of page.blocks) {
      claimIdsInBlock(b).forEach((c) => claimIds.add(c));
      entityRefsInBlock(b).forEach((r) => refs.add(r));
    }
    const named = claimIds.size
      ? await db
          .select({ id: claimEntities.entityId })
          .from(claimEntities)
          .where(and(inArray(claimEntities.claimId, [...claimIds]), inArray(claimEntities.entityId, ids)))
      : [];
    const direct = refs.size
      ? await db
          .select({ id: entities.id })
          .from(entities)
          .where(and(inArray(entities.id, ids), or(inArray(entities.slug, [...refs]), inArray(entities.id, [...refs].filter(isUuid)))))
      : [];
    for (const { id } of [...named, ...direct]) if (wanted.has(id)) add(id, { slug: page.slug, title: page.title });
  }
  return out;
}

/** One extent whose outline contains a point (no geometry: for "whose land it was"). */
export interface ExtentAtPoint {
  id: string;
  name: string;
  entity: { id: string; slug: string; label: string } | null;
  fromYear: number;
  toYear: number;
}

type PointCache = Map<string, { version: string; rows: ExtentAtPoint[] }>;
const pointCache: PointCache = ((globalThis as { __pramanaExtentsAtPoint?: PointCache }).__pramanaExtentsAtPoint ??= new Map());

/**
 * Every extent whose outline contains a point, oldest first: the bounding-box
 * query, then an exact point-in-polygon test, done once per point and kept
 * until the borders change (extentsVersion), since entity pages ask the same
 * question on every visit.
 */
export async function extentsContaining(point: [number, number], db: DbOrTx = getDb()): Promise<ExtentAtPoint[]> {
  const key = `${point[0].toFixed(4)},${point[1].toFixed(4)}`;
  const version = await extentsVersion(db);
  const hit = pointCache.get(key);
  if (hit && hit.version === version) return hit.rows;
  const [x, y] = point;
  const rows = await db
    .select({ id: extents.id, name: extents.name, entityId: extents.entityId, fromYear: extents.fromYear, toYear: extents.toYear, geometry: extents.geometry })
    .from(extents)
    .where(bboxCondition([x, y, x, y]))
    .orderBy(asc(extents.fromYear));
  const inside = rows.filter((r) => pointInMultiPolygon(point, r.geometry.coordinates));
  const ids = [...new Set(inside.map((r) => r.entityId).filter((id): id is string => Boolean(id)))];
  const briefs = ids.length
    ? await db.select({ id: entities.id, slug: entities.slug, label: entities.label }).from(entities).where(inArray(entities.id, ids))
    : [];
  const byId = new Map(briefs.map((b) => [b.id, b]));
  const out = inside.map((r) => ({
    id: r.id,
    name: r.name,
    entity: r.entityId ? (byId.get(r.entityId) ?? null) : null,
    fromYear: r.fromYear,
    toYear: r.toYear,
  }));
  if (pointCache.size > 2000) pointCache.clear();
  pointCache.set(key, { version, rows: out });
  return out;
}
