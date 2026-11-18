import { z } from "zod";
import { EntityRef, Ref } from "./ids";

/**
 * A page spec says what a page shows and where, so each page can be shaped to
 * its subject: an empire wants shifting borders, a movement wants its places
 * and turning points, an overview wants every age at once. The spec is data,
 * validated here and stored with the page; the web app reads it and falls back
 * to sensible defaults for anything left out.
 */

/** A year worth stopping at on the atlas scrubber (a conquest, a partition). */
export const AtlasStop = z.object({
  /** Astronomical year (-260 = 261 BCE). */
  year: z.number().int().min(-10000).max(3000),
  /** Short, plain label: "Kalinga conquered". */
  label: z.string().min(1).max(80),
  /** The claim that dates it, when there is one. */
  claimId: Ref.optional(),
});
export type AtlasStop = z.infer<typeof AtlasStop>;

/** The map with a time scrubber: borders that move as the year changes. */
export const AtlasSpec = z.object({
  /** Polities whose borders are emphasised; the page's own entity is added when omitted. */
  focus: z.array(EntityRef).max(12).default([]),
  /** Years the scrubber covers, astronomical. Defaults to the page entity's span, padded. */
  range: z.tuple([z.number().int(), z.number().int()]).optional(),
  /** Year shown first. Defaults to the year the focus polity was largest. */
  initialYear: z.number().int().optional(),
  stops: z.array(AtlasStop).max(30).default([]),
  /** Draw the borders of neighbours and contemporaries, faintly. */
  neighbours: z.boolean().default(true),
  /** Start with today's place names shown. */
  modernLabels: z.boolean().default(false),
  /** Initial view, when the places and borders do not frame the subject well: [west, south, east, north]. */
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type AtlasSpec = z.infer<typeof AtlasSpec>;

/** Panels the hero can carry beside the title, in order. */
export const HeroPanel = z.enum(["atlas", "timeline", "already_know", "media"]);
/** Panels in the reading rail, top to bottom. */
export const RailPanel = z.enum(["atlas", "timeline", "in_this_part", "notes"]);

export const PageSpec = z.object({
  hero: z
    .object({
      /** The lead image (a media record id). */
      media: Ref.optional(),
      panels: z.array(HeroPanel).max(4).optional(),
    })
    .default({}),
  rail: z.object({ panels: z.array(RailPanel).max(6).optional() }).default({}),
  atlas: AtlasSpec.optional(),
  timeline: z
    .object({
      /** Initial view of the period timeline, astronomical years. Defaults to the page entity's span. */
      range: z.tuple([z.number().int(), z.number().int()]).optional(),
    })
    .optional(),
  /** Where the chapter outline goes: beside the reading column, or nowhere (short pages). */
  outline: z.enum(["sidebar", "none"]).default("sidebar"),
});
export type PageSpec = z.infer<typeof PageSpec>;
export type PageSpecInput = z.input<typeof PageSpec>;

/** The spec to render with when a page has none stored. */
export function defaultPageSpec(kind: string): PageSpec {
  const spec = PageSpec.parse({});
  if (kind === "era") return { ...spec, atlas: AtlasSpec.parse({}) };
  return spec;
}

/** Entity refs a spec makes (for loading and integrity checks). */
export function entityRefsInSpec(spec: PageSpec | null | undefined): string[] {
  return spec?.atlas?.focus ?? [];
}

/** Claim ids a spec makes (for loading and integrity checks). */
export function claimIdsInSpec(spec: PageSpec | null | undefined): string[] {
  return (spec?.atlas?.stops ?? []).flatMap((s) => (s.claimId ? [s.claimId] : []));
}

/** Media record ids a spec shows (the hero's lead image). */
export function mediaRefsInSpec(spec: PageSpec | null | undefined): string[] {
  return spec?.hero?.media ? [spec.hero.media] : [];
}
