/**
 * Shared SVG pieces for the time-rule family. Server-safe (no hooks).
 * Colours are always CSS variables from globals.css so light and dark themes
 * both work; gradient stops take them through `style`.
 */

/** The white of "the current thing" on the band. */
export const BAND_ON = "var(--band-on)";

/**
 * A horizontal gradient for a bar whose ends are approximate: it fades in over
 * `fadeL` and out over `fadeR` (fractions of the bar's width). Each bar needs
 * its own id because the fractions depend on its width.
 */
export function SoftGradient({
  id,
  color,
  fadeL,
  fadeR,
  floor = 0,
}: {
  id: string;
  color: string;
  fadeL: number;
  fadeR: number;
  /** Opacity at the very ends. */
  floor?: number;
}) {
  const l = Math.min(0.45, Math.max(0, fadeL));
  const r = Math.min(0.45, Math.max(0, fadeR));
  return (
    <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" style={{ stopColor: color, stopOpacity: l ? floor : 1 }} />
      <stop offset={l} style={{ stopColor: color, stopOpacity: 1 }} />
      <stop offset={1 - r} style={{ stopColor: color, stopOpacity: 1 }} />
      <stop offset="1" style={{ stopColor: color, stopOpacity: r ? floor : 1 }} />
    </linearGradient>
  );
}

/** Fade length at each end of a bar, as fractions of its width. */
export function fadeFractions(
  widthPx: number,
  pxPerYear: number,
  e: { approximate: boolean; softStart: number; softEnd: number; open: boolean },
): { l: number; r: number } {
  if (widthPx <= 4) return { l: 0, r: 0 };
  const base = e.approximate ? Math.min(18, widthPx * 0.2) : 0;
  const l = Math.max(base, e.softStart * pxPerYear) / widthPx;
  const r = e.open ? 0 : Math.max(base, e.softEnd * pxPerYear) / widthPx;
  return { l, r };
}

/** Dotted stroke for traditional or uncertain dates. */
export const DOTTED = "1 5";
