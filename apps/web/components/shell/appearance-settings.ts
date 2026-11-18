/*
 * The appearance settings (docs/visual.md §4): text size, line width,
 * evidence density and theme. The schema is core's `Appearance`; the choices
 * live per learner in their site-wide user view, and are mirrored to a cookie
 * so the server can set the attributes on <html> before paint when the view
 * cannot be read. Shared by the server (layout.tsx) and the panel
 * (components/shell/Appearance.tsx), so this module has no "use client".
 */

import {
  Appearance,
  DEFAULT_APPEARANCE,
  EVIDENCE_DENSITIES,
  LINE_WIDTHS,
  TEXT_SIZES,
  THEMES,
} from "@pramana/core";

export type AppearanceSettings = Appearance;
export type TextSize = Appearance["text"];
export type LineWidth = Appearance["width"];
export type EvidenceDensity = Appearance["density"];
export type Theme = (typeof THEMES)[number];

export { DEFAULT_APPEARANCE, TEXT_SIZES, LINE_WIDTHS, THEMES, EVIDENCE_DENSITIES as DENSITIES };
export const APPEARANCE_KEY = "pramana:appearance";
export const APPEARANCE_COOKIE = "pramana_appearance";

/** Parses a stored value, keeping only known keys and values (the rest fall back to the defaults). */
export function parseAppearance(raw: string | null | undefined): AppearanceSettings {
  if (!raw) return DEFAULT_APPEARANCE;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof Appearance, unknown>>;
    const pick = <T extends string>(options: readonly T[], value: unknown): T | undefined =>
      options.includes(value as T) ? (value as T) : undefined;
    return Appearance.parse({
      text: pick(TEXT_SIZES, v.text),
      width: pick(LINE_WIDTHS, v.width),
      density: pick(EVIDENCE_DENSITIES, v.density),
      theme: pick(THEMES, v.theme),
    });
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** The attributes for <html>; the server sets them, the panel keeps them current. The theme is a class next-themes sets. */
export function appearanceAttributes(a: AppearanceSettings): Record<string, string> {
  return { "data-text": a.text, "data-width": a.width, "data-density": a.density };
}

/** The cookie that lets the server render the right attributes before the view is read. */
export function appearanceCookie(a: AppearanceSettings): string {
  return `${APPEARANCE_COOKIE}=${encodeURIComponent(JSON.stringify(a))}; path=/; max-age=31536000; samesite=lax`;
}
