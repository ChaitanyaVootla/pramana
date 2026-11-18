import { z } from "zod";
import { BlockId, VizSpec } from "./blocks";
import { EntityRef } from "./ids";
import { PageRef } from "./ops";

/**
 * A canvas is a learner's own board: anything on the site (claims, people and
 * places, a chapter, a quote, a picture, a map of a year, a timeline, a study
 * note, a chart) placed side by side with their own words. It is personal
 * workspace, not published content, so it does not go through changesets;
 * every change is still validated here and recorded as an audit event.
 *
 * Items hold references, not copies: a claim on a canvas is rendered from the
 * claim as it is now, with its current evidence. A reference to something
 * since deleted is shown as missing, never as stale text.
 */

/**
 * The board is a grid of cells (in the UI a column is 96px and a row 48px).
 * Items flow into the first 12 columns (a comfortable width to read across);
 * the learner may spread them further to either side of that.
 */
export const CANVAS_COLUMNS = 12;
export const CANVAS_MAX_COLUMNS = 200;
export const CANVAS_MAX_ITEMS = 200;
const MAX_ROWS = 4000;
const MAX_W = 24;
const MAX_H = 48;

/** Where an item sits: column, row, width in columns, height in rows. */
export const CanvasLayout = z
  .object({
    x: z.number().int().min(0).max(CANVAS_MAX_COLUMNS - 1),
    y: z.number().int().min(0).max(MAX_ROWS),
    w: z.number().int().min(1).max(MAX_W),
    h: z.number().int().min(1).max(MAX_H),
  })
  .refine((l) => l.x + l.w <= CANVAS_MAX_COLUMNS, {
    message: `an item must fit on the board (x + w <= ${CANVAS_MAX_COLUMNS})`,
  });
export type CanvasLayout = z.infer<typeof CanvasLayout>;

const year = z.number().int().min(-10000).max(3000);

/** Fields every item may carry: a heading of the learner's own and a line on why it is here. */
const common = {
  title: z.string().min(1).max(200).optional(),
  /** Markdown (claim and entity links welcome): the learner's (or their AI's) note on this item. */
  caption: z.string().min(1).max(2000).optional(),
};

export const CanvasItemContent = z.discriminatedUnion("kind", [
  z.object({
    ...common,
    kind: z.literal("claim"),
    claimId: z.uuid(),
    /** Show the sources under the claim (default), or only the claim and its seal. */
    citations: z.boolean().default(true),
    /** The claim's words when it was placed (set by the server), to say if it has changed since. */
    placed: z.object({ text: z.string().max(5000) }).optional(),
  }),
  z.object({ ...common, kind: z.literal("entity"), entity: EntityRef }),
  /** One part of an era page, by the chapter block's id. */
  z.object({
    ...common,
    kind: z.literal("chapter"),
    page: PageRef,
    chapterId: BlockId,
    /** "brief": the one-minute version and its claims; "full": the part's text as well. */
    show: z.enum(["brief", "full"]).default("brief"),
  }),
  z.object({
    ...common,
    kind: z.literal("excerpt"),
    excerptId: z.uuid(),
    /**
     * The words as they were when placed (set by the server). The tile shows
     * the source as it is now, and says so, with the difference, if it changed.
     */
    placed: z.object({ quote: z.string().max(20000).nullable(), locator: z.string().max(300) }).optional(),
  }),
  z.object({ ...common, kind: z.literal("media"), mediaId: z.uuid() }),
  /** A live map of one year (the atlas's MapEmbed): the places named, the borders of the polities in focus. */
  z
    .object({
      ...common,
      kind: z.literal("map"),
      /** Astronomical year whose borders are drawn (-260 = 261 BCE). */
      year: year.optional(),
      /** Years a scrubber covers (with Play). Omit for a still map of `year`. */
      range: z.tuple([year, year]).optional(),
      places: z.array(EntityRef).max(100).default([]),
      /** Polities drawn strong; the rest faint. */
      focus: z.array(EntityRef).max(12).default([]),
      /** Draw borders at all (false: the places on the land only). */
      borders: z.boolean().default(true),
      /** Initial view: [west, south, east, north]. */
      bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    })
    .refine((m) => !m.range || m.range[0] < m.range[1], {
      path: ["range"],
      message: "range must run from an earlier year to a later one",
    }),
  /** A timeline of a span of years (the atlas's TimelineEmbed), with the entities named. */
  z
    .object({
      ...common,
      kind: z.literal("timeline"),
      range: z.tuple([year, year]),
      /** Entities for its lanes. Empty: the ages. */
      entities: z.array(EntityRef).max(200).default([]),
      /** A cursor at this year. */
      year: year.optional(),
      lanes: z.array(z.enum(["ages", "people", "events"])).max(3).optional(),
    })
    .refine((t) => t.range[0] < t.range[1], {
      path: ["range"],
      message: "range must run from an earlier year to a later one",
    }),
  z.object({ ...common, kind: z.literal("note"), noteId: z.uuid() }),
  /** A chart or table: the same specs as page and note visuals (Vega-Lite data inline). */
  z.object({ ...common, kind: z.literal("viz"), viz: VizSpec }),
  z.object({ ...common, kind: z.literal("text"), markdown: z.string().min(1).max(20000) }),
  /** A heading across the board. The items under it, down to the next section, are its group. */
  z.object({ ...common, kind: z.literal("section"), title: z.string().min(1).max(200) }),
]);
export type CanvasItemContent = z.infer<typeof CanvasItemContent>;
export type CanvasItemContentInput = z.input<typeof CanvasItemContent>;
export type CanvasItemKind = CanvasItemContent["kind"];
export const CANVAS_ITEM_KINDS = [
  "claim",
  "entity",
  "chapter",
  "excerpt",
  "media",
  "map",
  "timeline",
  "note",
  "viz",
  "text",
  "section",
] as const satisfies readonly CanvasItemKind[];

/** Size a new item gets when none is given, in columns and rows. */
export const CANVAS_DEFAULT_SIZE: Record<CanvasItemKind, { w: number; h: number }> = {
  claim: { w: 4, h: 5 },
  entity: { w: 4, h: 4 },
  chapter: { w: 6, h: 9 },
  excerpt: { w: 4, h: 5 },
  media: { w: 4, h: 7 },
  map: { w: 8, h: 10 },
  timeline: { w: 8, h: 6 },
  note: { w: 4, h: 6 },
  viz: { w: 6, h: 8 },
  text: { w: 4, h: 3 },
  section: { w: 12, h: 1 },
};

export const CanvasMeta = z.object({
  title: z.string().trim().min(1).max(120),
  /** Markdown: what the board is for. */
  description: z.string().max(2000).optional(),
});
export type CanvasMeta = z.infer<typeof CanvasMeta>;

export const CanvasCreateInput = CanvasMeta.extend({
  items: z
    .array(z.object({ content: CanvasItemContent, layout: CanvasLayout.optional() }))
    .max(CANVAS_MAX_ITEMS)
    .default([]),
});
export type CanvasCreateInput = z.input<typeof CanvasCreateInput>;

export const CanvasAddItemsInput = z.object({
  items: z
    .array(
      z.object({
        content: CanvasItemContent,
        /** Where it goes. Omitted: after the last item, filling the row first. */
        layout: CanvasLayout.optional(),
      }),
    )
    .min(1)
    .max(50),
});
export type CanvasAddItemsInput = z.input<typeof CanvasAddItemsInput>;

export const CanvasItemPatch = z.object({
  /** The whole new content (same kind or another). */
  content: CanvasItemContent.optional(),
  layout: CanvasLayout.optional(),
});
export type CanvasItemPatch = z.input<typeof CanvasItemPatch>;

/**
 * Arranging the board: explicit places for some items, or an order to lay
 * every item out in (row by row, each keeping its size, sections starting a
 * new row), or both (the order first, then the places). Overlaps are always
 * resolved by moving the later item down.
 */
export const CanvasArrangeInput = z
  .object({
    layouts: z
      .array(z.object({ id: z.uuid(), layout: CanvasLayout }))
      .max(CANVAS_MAX_ITEMS)
      .default([]),
    order: z.array(z.uuid()).max(CANVAS_MAX_ITEMS).optional(),
    /** Close the gaps: every item moves up as far as it can. */
    tidy: z.boolean().default(false),
  })
  .refine((a) => a.layouts.length > 0 || a.order !== undefined || a.tidy, {
    message: "give layouts, an order, or tidy: true",
  });
export type CanvasArrangeInput = z.input<typeof CanvasArrangeInput>;

/** How two items on a board are related (a line between them). */
export const CanvasRelation = z.enum([
  "supports",
  "contradicts",
  "causes",
  "precedes",
  "same_as",
  "questions",
  "related",
]);
export type CanvasRelation = z.infer<typeof CanvasRelation>;

export const CanvasLinkInput = z
  .object({
    from: z.uuid(),
    to: z.uuid(),
    relation: CanvasRelation.default("related"),
    /** A few words of the learner's own on the line. */
    label: z.string().trim().min(1).max(80).optional(),
  })
  .refine((l) => l.from !== l.to, { message: "a link joins two different items" });
export type CanvasLinkInput = z.input<typeof CanvasLinkInput>;

/** Ids an item refers to, by kind (for loading live and for checking that they exist). */
export function canvasItemRefs(content: CanvasItemContent): {
  claims: string[];
  entities: string[];
  pages: string[];
  excerpts: string[];
  media: string[];
  notes: string[];
} {
  const out = {
    claims: [] as string[],
    entities: [] as string[],
    pages: [] as string[],
    excerpts: [] as string[],
    media: [] as string[],
    notes: [] as string[],
  };
  switch (content.kind) {
    case "claim":
      out.claims.push(content.claimId);
      break;
    case "entity":
      out.entities.push(content.entity);
      break;
    case "chapter":
      out.pages.push(content.page);
      break;
    case "excerpt":
      out.excerpts.push(content.excerptId);
      break;
    case "media":
      out.media.push(content.mediaId);
      break;
    case "map":
      out.entities.push(...content.places, ...content.focus);
      break;
    case "timeline":
      out.entities.push(...content.entities);
      break;
    case "note":
      out.notes.push(content.noteId);
      break;
    case "viz":
      if (content.viz.kind === "timeline" || content.viz.kind === "map")
        out.entities.push(
          ...(content.viz.entityIds ?? []),
          ...(content.viz.linkedTo ? [content.viz.linkedTo] : []),
        );
      if (content.viz.kind === "timeline") out.claims.push(...(content.viz.claimIds ?? []));
      if (content.viz.kind === "lineage") out.claims.push(content.viz.claimId);
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Layout: a grid where items keep the place they were given. Moving or
// resizing one pushes whatever it lands on down; nothing else moves, so the
// board keeps the learner's spatial intent. "Tidy" closes the gaps.
// ---------------------------------------------------------------------------

export interface Placed {
  id: string;
  layout: CanvasLayout;
  /** Sections span the board and start their group. */
  section?: boolean;
}

export function overlaps(a: CanvasLayout, b: CanvasLayout): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function byPosition(a: Placed, b: Placed): number {
  return a.layout.y - b.layout.y || a.layout.x - b.layout.x || (a.id < b.id ? -1 : 1);
}

/** Reading order (rows top to bottom, then left to right): the order of the stacked list on phones. */
export function readingOrder<T extends Placed>(items: T[]): T[] {
  return [...items].sort(byPosition);
}

/** Keeps a layout inside the board's columns. */
export function clampLayout(l: CanvasLayout): CanvasLayout {
  const w = Math.max(1, Math.min(MAX_W, Math.round(l.w)));
  const x = Math.max(0, Math.min(CANVAS_MAX_COLUMNS - w, Math.round(l.x)));
  return {
    x,
    y: Math.max(0, Math.min(MAX_ROWS, Math.round(l.y))),
    w,
    h: Math.max(1, Math.min(MAX_H, Math.round(l.h))),
  };
}

/**
 * Resolves overlaps. Items in `fixed` (the ones just moved) keep their place;
 * every other item that overlaps something placed before it moves down just
 * far enough, in reading order, so the push cascades. Returns new layouts.
 */
export function settle<T extends Placed>(items: T[], fixed: string[] = []): T[] {
  const pinned = new Set(fixed);
  const placed: T[] = [];
  const order = [
    ...items.filter((i) => pinned.has(i.id)).sort(byPosition),
    ...items.filter((i) => !pinned.has(i.id)).sort(byPosition),
  ];
  for (const item of order) {
    let layout = clampLayout(item.layout);
    if (!pinned.has(item.id)) {
      for (;;) {
        const hit = placed.filter((p) => overlaps(p.layout, layout));
        if (!hit.length) break;
        layout = { ...layout, y: Math.max(...hit.map((p) => p.layout.y + p.layout.h)) };
      }
    }
    placed.push({ ...item, layout });
  }
  const byId = new Map(placed.map((p) => [p.id, p]));
  return items.map((i) => byId.get(i.id)!);
}

/** Closes vertical gaps: each item, in reading order, moves up as far as it can. */
export function tidy<T extends Placed>(items: T[]): T[] {
  const placed: T[] = [];
  for (const item of readingOrder(items)) {
    let layout = clampLayout(item.layout);
    while (layout.y > 0 && !placed.some((p) => overlaps(p.layout, { ...layout, y: layout.y - 1 })))
      layout = { ...layout, y: layout.y - 1 };
    placed.push({ ...item, layout });
  }
  const byId = new Map(placed.map((p) => [p.id, p]));
  return items.map((i) => byId.get(i.id)!);
}

/**
 * Fits a board that runs wider than a screen: its columns (groups of items
 * whose spans overlap side to side, such as sections set next to each other)
 * are kept whole and flowed into rows at most `columns` wide, left to right,
 * one row under the next. A board already that narrow, or one column, is left
 * as it is.
 */
export function wrapToWidth<T extends Placed>(items: T[], columns: number): T[] {
  const width = Math.max(1, Math.floor(columns));
  if (!items.length || Math.max(...items.map((i) => i.layout.x + i.layout.w)) <= width) return items;
  // Columns: runs of x where some item stands, split where no item spans the gap.
  const spans = [...items].sort((a, b) => a.layout.x - b.layout.x);
  const blocks: { x0: number; x1: number; members: T[] }[] = [];
  for (const i of spans) {
    const last = blocks.at(-1);
    if (last && i.layout.x < last.x1) {
      last.members.push(i);
      last.x1 = Math.max(last.x1, i.layout.x + i.layout.w);
    } else blocks.push({ x0: i.layout.x, x1: i.layout.x + i.layout.w, members: [i] });
  }
  if (blocks.length < 2) return items;
  const moved = new Map<string, CanvasLayout>();
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const b of blocks) {
    const w = b.x1 - b.x0;
    const top = Math.min(...b.members.map((m) => m.layout.y));
    const h = Math.max(...b.members.map((m) => m.layout.y + m.layout.h)) - top;
    if (x > 0 && x + w > width) {
      y += rowH + 1;
      x = 0;
      rowH = 0;
    }
    for (const m of b.members) moved.set(m.id, { ...m.layout, x: m.layout.x - b.x0 + x, y: m.layout.y - top + y });
    x += w + 1;
    rowH = Math.max(rowH, h);
  }
  return items.map((i) => ({ ...i, layout: moved.get(i.id) ?? i.layout }));
}

/** The lowest row any item reaches. */
export function boardBottom(items: Placed[]): number {
  return items.reduce((m, i) => Math.max(m, i.layout.y + i.layout.h), 0);
}

/**
 * Where a new item of this size goes: beside the last item in reading order
 * if the row has room, else on a new row under everything. Sections always
 * start a new row.
 */
export function placeNew(
  items: Placed[],
  size: { w: number; h: number },
  options: { section?: boolean } = {},
): CanvasLayout {
  const w = options.section ? CANVAS_COLUMNS : Math.min(CANVAS_COLUMNS, size.w);
  const bottom = boardBottom(items);
  const last = readingOrder(items).at(-1);
  if (last && !options.section && !last.section) {
    const row = last.layout.y;
    for (let x = 0; x + w <= CANVAS_COLUMNS; x++) {
      const at = { x, y: row, w, h: size.h };
      if (x >= last.layout.x && !items.some((i) => overlaps(i.layout, at))) return at;
    }
  }
  return { x: 0, y: bottom, w, h: size.h };
}

/**
 * Lays items out in the given order, row by row, each keeping its size;
 * sections take a row of their own. Items not named keep their relative order
 * after the named ones.
 */
export function flowLayout<T extends Placed>(items: T[], order: string[]): T[] {
  const index = new Map(order.map((id, i) => [id, i]));
  const rest = readingOrder(items.filter((i) => !index.has(i.id)));
  const named = items
    .filter((i) => index.has(i.id))
    .sort((a, b) => index.get(a.id)! - index.get(b.id)!);
  const out: T[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const item of [...named, ...rest]) {
    const w = item.section ? CANVAS_COLUMNS : Math.min(CANVAS_COLUMNS, item.layout.w);
    if (item.section || x + w > CANVAS_COLUMNS) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
    out.push({ ...item, layout: { x, y, w, h: item.layout.h } });
    x += w;
    rowH = Math.max(rowH, item.layout.h);
    if (item.section) {
      y += rowH;
      x = 0;
      rowH = 0;
    }
  }
  const byId = new Map(out.map((p) => [p.id, p]));
  return items.map((i) => byId.get(i.id)!);
}

/**
 * The items a section heads: those under it (their columns overlap the
 * section's) down to the next section across the same columns. Sections side
 * by side are columns of a board, each with its own group. Moving a section
 * moves its group with it.
 */
export function sectionGroup(items: Placed[], sectionId: string): string[] {
  const section = items.find((i) => i.id === sectionId);
  if (!section?.section) return [];
  const { x, y: top, w } = section.layout;
  const across = (l: CanvasLayout) => l.x < x + w && x < l.x + l.w;
  const next = readingOrder(items).find(
    (i) => i.section && i.id !== sectionId && i.layout.y > top && across(i.layout),
  );
  const end = next ? next.layout.y : Infinity;
  return items
    .filter((i) => i.id !== sectionId && !i.section && across(i.layout) && i.layout.y >= top && i.layout.y < end)
    .map((i) => i.id);
}

/**
 * The order of the phone list and of an AI reading the board: items under no
 * section first, then each section (in reading order) followed by its group.
 */
export function listOrder<T extends Placed>(items: T[]): T[] {
  const ordered = readingOrder(items);
  const placed = new Set<string>();
  const out: T[] = [];
  const sections = ordered.filter((i) => i.section);
  const grouped = new Map(sections.map((s) => [s.id, new Set(sectionGroup(items, s.id))]));
  const inSome = new Set([...grouped.values()].flatMap((g) => [...g]));
  for (const i of ordered) if (!i.section && !inSome.has(i.id)) (out.push(i), placed.add(i.id));
  for (const s of sections) {
    out.push(s);
    placed.add(s.id);
    for (const i of ordered) if (grouped.get(s.id)!.has(i.id) && !placed.has(i.id)) (out.push(i), placed.add(i.id));
  }
  return out;
}

/**
 * Moves one item (and, for a section, its group by the same rows) to a new
 * layout, then pushes whatever it lands on down.
 */
export function moveItem<T extends Placed>(items: T[], id: string, to: CanvasLayout): T[] {
  const item = items.find((i) => i.id === id);
  if (!item) return items;
  const target = clampLayout(to);
  const group = item.section ? new Set(sectionGroup(items, id)) : new Set<string>();
  const dy = target.y - item.layout.y;
  const moved = items.map((i) =>
    i.id === id
      ? { ...i, layout: target }
      : group.has(i.id)
        ? { ...i, layout: { ...i.layout, y: Math.max(0, i.layout.y + dy) } }
        : i,
  );
  return settle(moved, [id, ...group]);
}

/**
 * Moves an item one step in reading order (the phone list's "Move up" and
 * "Move down", and the keyboard): it swaps places with its neighbour, each
 * keeping its size, and overlaps are pushed down.
 */
export function stepItem<T extends Placed>(items: T[], id: string, delta: -1 | 1): T[] {
  const order = readingOrder(items);
  const i = order.findIndex((x) => x.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return items;
  const a = order[i]!;
  const b = order[j]!;
  const fit = (x: number, w: number) => Math.min(x, CANVAS_MAX_COLUMNS - w);
  const swapped = items.map((it) =>
    it.id === a.id
      ? { ...it, layout: { ...a.layout, x: fit(b.layout.x, a.layout.w), y: b.layout.y } }
      : it.id === b.id
        ? { ...it, layout: { ...b.layout, x: fit(a.layout.x, b.layout.w), y: a.layout.y } }
        : it,
  );
  // Moving up, the item lands first; moving down, its neighbour does.
  const settled = settle(swapped, [delta < 0 ? a.id : b.id]);
  // A swap within a row of unequal widths can leave the two in their old order; then flow them.
  const next = readingOrder(settled).map((x) => x.id);
  if (next.indexOf(a.id) < next.indexOf(b.id) === delta < 0) return settled;
  const ids = order.map((x) => x.id);
  [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  return flowLayout(items, ids);
}
