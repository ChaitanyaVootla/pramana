import { z } from "zod";
import { BlockId } from "./blocks";
import { EntityRef } from "./ids";
import {
  Appearance,
  DEFAULT_APPEARANCE,
  EVIDENCE_DENSITIES,
  LINE_WIDTHS,
  TEXT_SIZES,
  THEMES,
} from "./appearance";
import { AtlasStop, type PageSpec } from "./pagespec";

/**
 * "Your view": one learner's arrangement of an era or entity page, laid over
 * the page's own spec. It never changes the page (the site's content and spec
 * stay as reviewed); it changes what this learner sees and where, so the page
 * can be shaped to what they need to understand it. The learner sets it by
 * hand, or their AI does (after a quiz shows confusion, say); every change by
 * an AI says so and can be undone.
 */

/** Panels a view can hide or show. Era pages: hero and rail panels; entity pages: sections. */
export const ViewPanel = z.enum([
  // era pages
  "atlas",
  "timeline",
  "already_know",
  "media",
  "in_this_part",
  "notes",
  "meanwhile",
  "outline",
  // entity pages
  "when",
  "held",
  "claims",
  "links",
  "nearby",
  "pages",
  "history",
]);
export type ViewPanel = z.infer<typeof ViewPanel>;

export const ERA_VIEW_PANELS = [
  "already_know",
  "media",
  "meanwhile",
  "atlas",
  "timeline",
  "in_this_part",
  "notes",
  "outline",
] as const satisfies readonly ViewPanel[];
/** Entity page sections the learner can hide (the head, with when and offices held, always shows). */
export const ENTITY_VIEW_PANELS = [
  "atlas",
  "claims",
  "links",
  "nearby",
  "pages",
  "history",
] as const satisfies readonly ViewPanel[];

/** Rail panels that can be ordered (the page spec's RailPanel). */
export const ViewRailPanel = z.enum(["atlas", "timeline", "in_this_part", "notes"]);

export const ViewAnnotation = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i),
  /** What it is written on: a claim, or a block (a chapter) of the page. */
  claimId: z.uuid().optional(),
  blockId: BlockId.optional(),
  /** Markdown; claim and entity links welcome. */
  markdown: z.string().min(1).max(2000),
});
export type ViewAnnotation = z.infer<typeof ViewAnnotation>;


export const UserView = z.object({
  /** Panels not shown. */
  hide: z.array(ViewPanel).max(20).default([]),
  /** Panels shown although the page leaves them out (a separate timeline in the rail). */
  show: z.array(ViewPanel).max(20).default([]),
  /** The rail's panels, top to bottom; panels left out keep the page's order after these. */
  railOrder: z.array(ViewRailPanel).max(4).optional(),
  atlas: z
    .object({
      /** Years of the page's own stops to leave off the scrubber. */
      hideStops: z.array(z.number().int()).max(30).default([]),
      /** The learner's own stops (a year worth returning to). */
      stops: z.array(AtlasStop).max(10).default([]),
      /** Year the map opens on. */
      initialYear: z.number().int().min(-10000).max(3000).optional(),
      /** Show today's place names. */
      modernLabels: z.boolean().optional(),
    })
    .default({ hideStops: [], stops: [] }),
  /** How the page opens: the one-minute versions, or every part in full. */
  reading: z.enum(["skim", "full"]).optional(),
  /** Parts the learner has already read stay folded to their one-minute version. */
  foldKnown: z.boolean().default(false),
  /** Words to know are explained where they appear, not only on hover. */
  explainWords: z.boolean().default(false),
  /** People and places drawn stronger wherever they appear (chips, the map). */
  emphasis: z.array(EntityRef).max(24).default([]),
  /** Claims the learner marked: to remember, or to come back to. */
  highlights: z
    .array(z.object({ claimId: z.uuid(), tone: z.enum(["remember", "question"]).default("remember") }))
    .max(200)
    .default([]),
  /** The learner's own notes on claims and parts. */
  annotations: z.array(ViewAnnotation).max(100).default([]),
  /** Study notes (an AI's explainer, written for this learner) shown at the top of a part. */
  pinnedNotes: z.array(z.object({ noteId: z.uuid(), blockId: BlockId })).max(30).default([]),
  /** The appearance panel's choices: only on the site-wide view. */
  appearance: Appearance.optional(),
});
export type UserView = z.infer<typeof UserView>;
export type UserViewInput = z.input<typeof UserView>;

export const EMPTY_VIEW: UserView = UserView.parse({});

/**
 * A partial change: only the keys given are replaced (lists whole). `null`
 * clears a setting back to the page's own (reading mode, rail order, the
 * map's opening year and modern names).
 */
export const UserViewPatch = z.object({
  hide: UserView.shape.hide.unwrap().optional(),
  show: UserView.shape.show.unwrap().optional(),
  railOrder: z.array(ViewRailPanel).max(4).nullable().optional(),
  atlas: z
    .object({
      hideStops: z.array(z.number().int()).max(30).optional(),
      stops: z.array(AtlasStop).max(10).optional(),
      initialYear: z.number().int().min(-10000).max(3000).nullable().optional(),
      modernLabels: z.boolean().nullable().optional(),
    })
    .optional(),
  reading: z.enum(["skim", "full"]).nullable().optional(),
  foldKnown: z.boolean().optional(),
  explainWords: z.boolean().optional(),
  emphasis: UserView.shape.emphasis.unwrap().optional(),
  highlights: UserView.shape.highlights.unwrap().optional(),
  annotations: UserView.shape.annotations.unwrap().optional(),
  pinnedNotes: UserView.shape.pinnedNotes.unwrap().optional(),
  /** Only the keys given change; `theme: null` lets the device decide again; `null` clears all of it. */
  appearance: z
    .object({
      text: z.enum(TEXT_SIZES).optional(),
      width: z.enum(LINE_WIDTHS).optional(),
      density: z.enum(EVIDENCE_DENSITIES).optional(),
      theme: z.enum(THEMES).nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type UserViewPatch = z.input<typeof UserViewPatch>;

function merge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) delete out[k];
    else out[k] = v;
  }
  return out;
}

/** Applies a patch: only the keys the patch names change. */
export function patchUserView(view: UserView, raw: UserViewPatch): UserView {
  const { atlas, appearance, ...rest } = UserViewPatch.parse(raw);
  const next = merge(view, rest);
  next.atlas = merge(view.atlas, atlas ?? {});
  if (appearance === null) delete next.appearance;
  else if (appearance) next.appearance = merge(view.appearance ?? DEFAULT_APPEARANCE, appearance);
  return UserView.parse(next);
}

export function isEmptyView(view: UserView): boolean {
  return JSON.stringify(UserView.parse(view)) === JSON.stringify(EMPTY_VIEW);
}

/** One recorded change to a view, kept so it can be undone. */
export const UserViewChange = z.object({
  at: z.iso.datetime(),
  by: z.object({
    kind: z.enum(["human", "agent", "importer", "system"]),
    handle: z.string().max(200),
    name: z.string().max(200),
  }),
  /** Why (an AI says what it saw: "you mixed up the two Chandraguptas"). */
  note: z.string().max(500).optional(),
  /** The view before this change. */
  before: UserView,
  /** The learner has seen this change and kept it (an AI's change is announced until then). */
  kept: z.boolean().optional(),
});
export type UserViewChange = z.infer<typeof UserViewChange>;
export const VIEW_HISTORY_MAX = 20;

// ---------------------------------------------------------------------------
// Merging a view over a page spec
// ---------------------------------------------------------------------------

/** The hero panels a spec shows when it names none (kept in step with the web app's era layout). */
export const DEFAULT_HERO_PANELS = ["media", "already_know"] as const;

/** The rail panels a spec shows when it names none. */
export function defaultRailPanels(spec: PageSpec): ("atlas" | "timeline" | "in_this_part" | "notes")[] {
  return spec.atlas ? ["atlas", "in_this_part", "notes"] : ["timeline", "in_this_part", "notes"];
}

/**
 * The page spec as this learner sees it. Only what the spec decides is
 * changed here (panels, the rail's order, the atlas's stops, opening year and
 * modern names); the rest of the view (reading mode, emphasis, highlights) is
 * read by the page itself.
 */
export function applyUserView(spec: PageSpec, raw: UserView | null | undefined): PageSpec {
  if (!raw) return spec;
  const view = UserView.parse(raw);
  const hidden = new Set<string>(view.hide);
  const shown = new Set<string>(view.show);

  const heroBase: string[] = [...(spec.hero.panels ?? DEFAULT_HERO_PANELS)];
  const hero = heroBase.filter((p) => !hidden.has(p)) as NonNullable<PageSpec["hero"]["panels"]>;

  const railBase: string[] = [...(spec.rail.panels ?? defaultRailPanels(spec))];
  for (const p of ViewRailPanel.options) if (shown.has(p) && !railBase.includes(p)) railBase.push(p);
  const ordered = [
    ...(view.railOrder ?? []).filter((p) => railBase.includes(p)),
    ...railBase.filter((p) => !(view.railOrder ?? []).includes(p as never)),
  ];
  const rail = ordered.filter((p) => !hidden.has(p)) as NonNullable<PageSpec["rail"]["panels"]>;

  const atlas = spec.atlas
    ? {
        ...spec.atlas,
        stops: [
          ...spec.atlas.stops.filter((s) => !view.atlas.hideStops.includes(s.year)),
          ...view.atlas.stops,
        ].sort((a, b) => a.year - b.year),
        initialYear: view.atlas.initialYear ?? spec.atlas.initialYear,
        modernLabels: view.atlas.modernLabels ?? spec.atlas.modernLabels,
      }
    : undefined;

  return {
    ...spec,
    hero: { ...spec.hero, panels: hero },
    rail: { ...spec.rail, panels: rail },
    ...(atlas ? { atlas } : {}),
    outline: hidden.has("outline") ? "none" : spec.outline,
  };
}

/** True when the view hides this panel (for page sections the spec does not decide). */
export function viewHides(view: UserView | null | undefined, panel: ViewPanel): boolean {
  return Boolean(view?.hide.includes(panel));
}

// ---------------------------------------------------------------------------
// Saying what a view changes, in words
// ---------------------------------------------------------------------------

const PANEL_WORDS: Record<ViewPanel, string> = {
  atlas: "the map",
  timeline: "the timeline",
  already_know: "names you'll meet",
  media: "the lead picture",
  in_this_part: "in this part",
  notes: "study notes",
  meanwhile: "meanwhile elsewhere",
  outline: "the contents",
  when: "when",
  held: "offices held",
  claims: "what we can say",
  links: "connections",
  nearby: "nearby places",
  pages: "pages",
  history: "the record of changes",
};

export function panelWords(panel: ViewPanel): string {
  return PANEL_WORDS[panel];
}

function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

/** Plain lines for what a view changes from the page as published ("Hides the map"). */
export function describeUserView(raw: UserView): string[] {
  const view = UserView.parse(raw);
  const out: string[] = [];
  if (view.hide.length) out.push(`Hides ${list(view.hide.map(panelWords))}`);
  if (view.show.length) out.push(`Shows ${list(view.show.map(panelWords))}`);
  if (view.railOrder?.length) out.push(`Puts ${panelWords(view.railOrder[0]!)} first in the side panel`);
  if (view.reading) out.push(view.reading === "skim" ? "Opens on the short versions" : "Opens every part in full");
  if (view.foldKnown) out.push("Keeps parts you have read folded");
  if (view.explainWords) out.push("Explains words where they appear");
  if (view.atlas.modernLabels !== undefined)
    out.push(view.atlas.modernLabels ? "Shows today's place names" : "Hides today's place names");
  if (view.atlas.initialYear !== undefined) out.push("Opens the map on a year of your choice");
  if (view.atlas.hideStops.length)
    out.push(`Leaves ${view.atlas.hideStops.length} ${view.atlas.hideStops.length === 1 ? "turning point" : "turning points"} off the map`);
  if (view.atlas.stops.length)
    out.push(`Adds ${view.atlas.stops.length} ${view.atlas.stops.length === 1 ? "year" : "years"} of your own to the map`);
  if (view.emphasis.length)
    out.push(`Brings out ${view.emphasis.length} ${view.emphasis.length === 1 ? "name" : "names"}`);
  if (view.highlights.length)
    out.push(`Marks ${view.highlights.length} ${view.highlights.length === 1 ? "claim" : "claims"}`);
  if (view.annotations.length)
    out.push(`${view.annotations.length} ${view.annotations.length === 1 ? "note" : "notes"} of your own`);
  if (view.pinnedNotes.length)
    out.push(`${view.pinnedNotes.length} study ${view.pinnedNotes.length === 1 ? "note" : "notes"} pinned to parts`);
  out.push(...describeAppearance(view.appearance));
  return out;
}

/** The appearance choices that differ from the defaults, in words ("Larger text"). */
export function describeAppearance(a: Appearance | undefined): string[] {
  if (!a) return [];
  const out: string[] = [];
  if (a.text === "large") out.push("Larger text");
  if (a.text === "small") out.push("Smaller text");
  if (a.width === "wide") out.push("Wider lines");
  if (a.density === "quiet") out.push("Shows only the evidence mark on each claim");
  if (a.density === "full") out.push("Shows quotations and checks in the text");
  if (a.theme === "dark") out.push("Dark theme");
  if (a.theme === "light") out.push("Light theme");
  return out;
}

/** What one change did, in words: the lines of the new view that the old one did not have, or "Reset". */
export function describeViewChange(before: UserView, after: UserView): string[] {
  if (isEmptyView(after) && !isEmptyView(before)) return ["Put the page back as published"];
  const was = new Set(describeUserView(before));
  const now = describeUserView(after);
  const added = now.filter((l) => !was.has(l));
  const gone = describeUserView(before).filter((l) => !now.includes(l));
  return [...added, ...gone.map((l) => `No longer: ${l.charAt(0).toLowerCase()}${l.slice(1)}`)];
}
