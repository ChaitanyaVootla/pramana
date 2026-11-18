import { pointInPolygon } from "@pramana/core";
import { describe, expect, it } from "vitest";
import { labelPoint, outlineWithoutClip } from "./extents";

describe("labelPoint", () => {
  it("writes an L-shaped polity's name inside it, not at its bounding-box centre", () => {
    // An L: the bbox centre (5, 5) lies outside the shape.
    const L = [[[0, 0], [10, 0], [10, 3], [3, 3], [3, 10], [0, 10], [0, 0]]] as [number, number][][];
    const at = labelPoint("l", 1, [L]);
    expect(pointInPolygon(at, L)).toBe(true);
  });

  it("uses the largest part of a multipolygon", () => {
    const islet = [[[50, 50], [51, 50], [51, 51], [50, 51], [50, 50]]] as [number, number][][];
    const main = [[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]] as [number, number][][];
    const [x, y] = labelPoint("m", 1, [islet, main]);
    expect(Math.abs(x - 10)).toBeLessThan(2);
    expect(Math.abs(y - 10)).toBeLessThan(2);
  });
});

describe("outlineWithoutClip", () => {
  const W: [number, number, number, number] = [55, 0, 100, 42];

  it("leaves out the edges our import cut along the clip window", () => {
    // A polity cut off at 55°E: its west side runs along the window.
    const ring = [[55, 10], [60, 10], [60, 20], [55, 20], [55, 10]] as [number, number][];
    const { outline } = outlineWithoutClip([[ring]], W);
    expect(outline?.coordinates).toEqual([[[55, 10], [60, 10], [60, 20], [55, 20]]]);
  });

  it("strokes an uncut shape as it is", () => {
    const ring = [[60, 10], [70, 10], [70, 20], [60, 20], [60, 10]] as [number, number][];
    expect(outlineWithoutClip([[ring]], W)).toEqual({});
  });
});
