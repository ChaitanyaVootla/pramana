import { z } from "zod";

// Kept apart from userview.ts, which needs blocks and dates (and so the EDTF
// parser): the appearance panel is on every page, and needs only these.

/**
 * The appearance panel's choices (docs/visual.md §4), kept per learner in the
 * site-wide view (subject "site", one row per learner) so they follow the
 * learner between devices. Text size scales the root em; line width sets the
 * measure; evidence density shows or hides citation detail; the theme is
 * device, light or dark.
 */
export const TEXT_SIZES = ["small", "standard", "large"] as const;
export const LINE_WIDTHS = ["standard", "wide"] as const;
export const EVIDENCE_DENSITIES = ["quiet", "standard", "full"] as const;
export const THEMES = ["system", "light", "dark"] as const;
export const Appearance = z.object({
  text: z.enum(TEXT_SIZES).default("standard"),
  width: z.enum(LINE_WIDTHS).default("standard"),
  density: z.enum(EVIDENCE_DENSITIES).default("standard"),
  /** Unset: the device decides. */
  theme: z.enum(THEMES).optional(),
});
export type Appearance = z.infer<typeof Appearance>;
export type AppearanceInput = z.input<typeof Appearance>;
export const DEFAULT_APPEARANCE: Appearance = Appearance.parse({});

/** The subject id of a learner's site-wide view (there is one site, so one fixed id). */
export const SITE_VIEW_ID = "00000000-0000-0000-0000-000000000000";
