import { describe, expect, it } from "vitest";
import {
  bboxOf,
  clipMultiPolygon,
  clipRingToBbox,
  douglasPeucker,
  multiPolygonAreaKm2,
  pointInMultiPolygon,
  pointInPolygon,
  rewindMultiPolygon,
  roundMultiPolygon,
  signedRingArea,
  simplifyRing,
  type Position,
  type Ring,
} from "./geo";

const square = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];

describe("douglasPeucker", () => {
  it("drops points within tolerance and keeps the end points", () => {
    const line: Position[] = [
      [0, 0],
      [1, 0.01],
      [2, -0.01],
      [3, 5],
      [4, 0],
    ];
    expect(douglasPeucker(line, 0.1)).toEqual([
      [0, 0],
      [2, -0.01],
      [3, 5],
      [4, 0],
    ]);
    expect(douglasPeucker(line, 10)).toEqual([
      [0, 0],
      [4, 0],
    ]);
  });
  it("simplifies a closed ring and drops rings smaller than the tolerance", () => {
    const wobbly: Ring = [[0, 0], [5, 0.001], [10, 0], [10, 10], [5, 10.001], [0, 10], [0, 0]];
    const out = simplifyRing(wobbly, 0.01)!;
    expect(out[0]).toEqual(out[out.length - 1]);
    expect(out).toHaveLength(5);
    expect(simplifyRing(square(0, 0, 0.001, 0.001), 0.01)).toBeNull();
  });
});

describe("clipping", () => {
  it("clips a ring to a rectangle", () => {
    const clipped = clipRingToBbox(square(-5, -5, 5, 5), [0, 0, 10, 10])!;
    expect(bboxOf(clipped)).toEqual([0, 0, 5, 5]);
    expect(Math.abs(signedRingArea(clipped))).toBeCloseTo(25);
    expect(clipped[0]).toEqual(clipped[clipped.length - 1]);
  });
  it("drops polygons outside and keeps those inside untouched", () => {
    const inside = [square(1, 1, 2, 2)];
    const outside = [square(20, 20, 30, 30)];
    expect(clipMultiPolygon([inside, outside], [0, 0, 10, 10])).toEqual([inside]);
  });
  it("clips a concave (U-shaped) polygon to one ring with the right area", () => {
    const u: Ring = [[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]];
    const clipped = clipRingToBbox(u, [0, 2, 3, 3])!;
    // Two 1x1 prongs remain, joined by a zero-width seam along y = 2.
    expect(Math.abs(signedRingArea(clipped))).toBeCloseTo(2);
  });
});

describe("containment, winding, area, rounding", () => {
  const donut = [square(0, 0, 10, 10), square(4, 4, 6, 6)];
  it("respects holes", () => {
    expect(pointInPolygon([2, 2], donut)).toBe(true);
    expect(pointInPolygon([5, 5], donut)).toBe(false);
    expect(pointInMultiPolygon([15, 5], [donut])).toBe(false);
  });
  it("rewinds to RFC 7946 orientation", () => {
    const [outer, hole] = rewindMultiPolygon([[[...square(0, 0, 10, 10)].reverse(), square(4, 4, 6, 6)]])[0]!;
    expect(signedRingArea(outer!)).toBeGreaterThan(0);
    expect(signedRingArea(hole!)).toBeLessThan(0);
  });
  it("computes geodesic area", () => {
    // One degree square at the equator is about 12,364 km².
    expect(multiPolygonAreaKm2([[square(0, 0, 1, 1)]])).toBeGreaterThan(12300);
    expect(multiPolygonAreaKm2([[square(0, 0, 1, 1)]])).toBeLessThan(12400);
  });
  it("rounds and removes collapsed rings", () => {
    const out = roundMultiPolygon([[square(0.12344, 0.12344, 1.98766, 1.98766)], [square(0, 0, 0.0001, 0.0001)]], 2);
    expect(out).toEqual([[square(0.12, 0.12, 1.99, 1.99)]]);
  });
});
