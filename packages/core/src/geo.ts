/**
 * Small, dependency-free planar geometry for GeoJSON polygons in lon/lat
 * degrees: bounding boxes, rectangle clipping (Sutherland–Hodgman), line
 * simplification (Douglas–Peucker), point-in-polygon (ray casting), ring
 * orientation and geodesic area. Good enough for preparing and querying
 * historical extents at map scale; not a GIS.
 */

export type Position = [number, number];
export type Ring = Position[];
export type PolygonCoords = Ring[];
export type MultiPolygonCoords = PolygonCoords[];
/** [minLon, minLat, maxLon, maxLat] */
export type BboxTuple = [number, number, number, number];

export function bboxOf(coords: MultiPolygonCoords | PolygonCoords | Ring): BboxTuple | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as Position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(coords);
  return minX === Infinity ? null : [minX, minY, maxX, maxY];
}

export function bboxIntersects(a: BboxTuple, b: BboxTuple): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

function samePoint(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function close(ring: Ring): Ring {
  if (ring.length && !samePoint(ring[0]!, ring[ring.length - 1]!)) return [...ring, ring[0]!];
  return ring;
}

/** Drops consecutive duplicate positions (e.g. after rounding). */
function dedupe(ring: Ring): Ring {
  const out: Ring = [];
  for (const p of ring) if (!out.length || !samePoint(out[out.length - 1]!, p)) out.push(p);
  return out;
}

/** A closed ring needs three distinct corners: four positions, first = last. */
function validRing(ring: Ring): boolean {
  return ring.length >= 4 && Math.abs(signedRingArea(ring)) > 0;
}

// ---------------------------------------------------------------------------
// Clipping
// ---------------------------------------------------------------------------

type Edge = (p: Position) => boolean;

/**
 * Clips a ring to a rectangle (Sutherland–Hodgman). The rectangle is convex, so
 * the result is one ring; where a concave ring leaves and re-enters, the pieces
 * are joined along the rectangle's edge (zero-width seams), which fills and
 * renders correctly. Returns null when nothing remains.
 */
export function clipRingToBbox(ring: Ring, bbox: BboxTuple): Ring | null {
  const [minX, minY, maxX, maxY] = bbox;
  const edges: { inside: Edge; cross: (a: Position, b: Position) => Position }[] = [
    {
      inside: (p) => p[0] >= minX,
      cross: (a, b) => [minX, a[1] + ((b[1] - a[1]) * (minX - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[0] <= maxX,
      cross: (a, b) => [maxX, a[1] + ((b[1] - a[1]) * (maxX - a[0])) / (b[0] - a[0])],
    },
    {
      inside: (p) => p[1] >= minY,
      cross: (a, b) => [a[0] + ((b[0] - a[0]) * (minY - a[1])) / (b[1] - a[1]), minY],
    },
    {
      inside: (p) => p[1] <= maxY,
      cross: (a, b) => [a[0] + ((b[0] - a[0]) * (maxY - a[1])) / (b[1] - a[1]), maxY],
    },
  ];
  // Work on the open ring (without the closing duplicate).
  let points: Position[] = dedupe(ring);
  if (points.length > 1 && samePoint(points[0]!, points[points.length - 1]!)) points.pop();
  for (const edge of edges) {
    if (!points.length) break;
    const input = points;
    points = [];
    for (let i = 0; i < input.length; i++) {
      const current = input[i]!;
      const previous = input[(i + input.length - 1) % input.length]!;
      const curIn = edge.inside(current);
      const prevIn = edge.inside(previous);
      if (curIn) {
        if (!prevIn) points.push(edge.cross(previous, current));
        points.push(current);
      } else if (prevIn) {
        points.push(edge.cross(previous, current));
      }
    }
  }
  const out = close(dedupe(points));
  return validRing(out) ? out : null;
}

/** Clips each polygon to the rectangle; holes that vanish are dropped, polygons too. */
export function clipMultiPolygon(mp: MultiPolygonCoords, bbox: BboxTuple): MultiPolygonCoords {
  const out: MultiPolygonCoords = [];
  for (const polygon of mp) {
    const box = bboxOf(polygon);
    if (!box || !bboxIntersects(box, bbox)) continue;
    const inside = box[0] >= bbox[0] && box[1] >= bbox[1] && box[2] <= bbox[2] && box[3] <= bbox[3];
    if (inside) {
      out.push(polygon);
      continue;
    }
    const [outer, ...holes] = polygon;
    const clipped = outer ? clipRingToBbox(outer, bbox) : null;
    if (!clipped) continue;
    const keptHoles = holes
      .map((h) => clipRingToBbox(h, bbox))
      .filter((h): h is Ring => h !== null);
    out.push([clipped, ...keptHoles]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Simplification
// ---------------------------------------------------------------------------

function segmentDistance(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Douglas–Peucker line simplification: keeps the end points and every point
 * farther than `tolerance` (in coordinate units, here degrees) from the
 * simplified line. Iterative, so long borders do not overflow the stack.
 */
export function douglasPeucker(points: readonly Position[], tolerance: number): Position[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxDistance = -1;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(points[i]!, points[first]!, points[last]!);
      if (d > maxDistance) {
        maxDistance = d;
        index = i;
      }
    }
    if (index !== -1 && maxDistance > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Simplifies a closed ring. The ring is split at the point farthest from its
 * start so both halves have distinct end points. Returns null if the ring
 * collapses (it is smaller than the tolerance).
 */
export function simplifyRing(ring: Ring, tolerance: number): Ring | null {
  const open = dedupe(ring);
  if (open.length > 1 && samePoint(open[0]!, open[open.length - 1]!)) open.pop();
  if (open.length < 3) return null;
  let far = 0;
  let farDistance = -1;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i]![0] - open[0]![0], open[i]![1] - open[0]![1]);
    if (d > farDistance) {
      farDistance = d;
      far = i;
    }
  }
  const a = douglasPeucker(open.slice(0, far + 1), tolerance);
  const b = douglasPeucker([...open.slice(far), open[0]!], tolerance);
  const out = close(dedupe([...a, ...b.slice(1)]));
  return validRing(out) ? out : null;
}

export function simplifyMultiPolygon(mp: MultiPolygonCoords, tolerance: number): MultiPolygonCoords {
  const out: MultiPolygonCoords = [];
  for (const [outer, ...holes] of mp) {
    const simplified = outer ? simplifyRing(outer, tolerance) : null;
    if (!simplified) continue;
    const keptHoles = holes
      .map((h) => simplifyRing(h, tolerance))
      .filter((h): h is Ring => h !== null);
    out.push([simplified, ...keptHoles]);
  }
  return out;
}

/** Rounds coordinates (5 decimals ≈ 1 m, 3 ≈ 100 m) and drops rings that collapse. */
export function roundMultiPolygon(mp: MultiPolygonCoords, decimals: number): MultiPolygonCoords {
  const f = 10 ** decimals;
  const round = (p: Position): Position => [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f];
  const out: MultiPolygonCoords = [];
  for (const [outer, ...holes] of mp) {
    const o = outer ? close(dedupe(outer.map(round))) : [];
    if (!validRing(o)) continue;
    out.push([o, ...holes.map((h) => close(dedupe(h.map(round)))).filter(validRing)]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Orientation, area, containment
// ---------------------------------------------------------------------------

/** Shoelace area in square degrees; positive = counterclockwise. */
export function signedRingArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i]![0] * ring[i + 1]![1] - ring[i + 1]![0] * ring[i]![1];
  }
  return sum / 2;
}

/** RFC 7946 winding: outer rings counterclockwise, holes clockwise. */
export function rewindMultiPolygon(mp: MultiPolygonCoords): MultiPolygonCoords {
  return mp.map((polygon) =>
    polygon.map((ring, i) => {
      const ccw = signedRingArea(ring) > 0;
      return (i === 0) === ccw ? ring : [...ring].reverse();
    }),
  );
}

const EARTH_RADIUS_KM = 6371.0088;

/** Geodesic area of a ring on a sphere, km² (Chamberlain & Duquette 2007). */
export function ringAreaKm2(ring: Ring): number {
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[i + 1]!;
    sum += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad));
  }
  return Math.abs((sum * EARTH_RADIUS_KM * EARTH_RADIUS_KM) / 2);
}

export function multiPolygonAreaKm2(mp: MultiPolygonCoords): number {
  let total = 0;
  for (const [outer, ...holes] of mp) {
    if (!outer) continue;
    total += ringAreaKm2(outer) - holes.reduce((s, h) => s + ringAreaKm2(h), 0);
  }
  return total;
}

/** Ray casting; points exactly on an edge may fall either way. */
export function pointInRing(point: Position, ring: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(point: Position, polygon: PolygonCoords): boolean {
  const [outer, ...holes] = polygon;
  if (!outer || !pointInRing(point, outer)) return false;
  return !holes.some((h) => pointInRing(point, h));
}

export function pointInMultiPolygon(point: Position, mp: MultiPolygonCoords): boolean {
  return mp.some((polygon) => pointInPolygon(point, polygon));
}

export function countPositions(mp: MultiPolygonCoords): number {
  return mp.reduce((n, polygon) => n + polygon.reduce((m, ring) => m + ring.length, 0), 0);
}
