import type { CanvasLayout } from "@pramana/core";

/**
 * The board's grid in pixels: a column is 96px and a row 48px, both multiples
 * of the 16px dot grid drawn on the ground, with a 16px gap between tiles.
 */
export const COL = 96;
export const ROW = 48;
export const GAP = 16;

export function toPx(l: CanvasLayout) {
  return { x: l.x * COL, y: l.y * ROW, width: l.w * COL - GAP, height: l.h * ROW - GAP };
}

export function fromPx(p: { x: number; y: number; width: number; height: number }): CanvasLayout {
  return {
    x: Math.max(0, Math.round(p.x / COL)),
    y: Math.max(0, Math.round(p.y / ROW)),
    w: Math.max(1, Math.min(24, Math.round((p.width + GAP) / COL))),
    h: Math.max(1, Math.min(48, Math.round((p.height + GAP) / ROW))),
  };
}

export function sameLayout(a: CanvasLayout, b: CanvasLayout): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}
