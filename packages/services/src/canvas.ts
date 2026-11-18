import {
  CANVAS_DEFAULT_SIZE,
  CANVAS_MAX_ITEMS,
  CanvasAddItemsInput,
  CanvasArrangeInput,
  CanvasCreateInput,
  CanvasItemContent,
  CanvasItemPatch,
  CanvasLinkInput,
  CanvasMeta,
  canvasItemRefs,
  claimIdsInBlock,
  entityRefsInBlock,
  flowLayout,
  formatFuzzyDate,
  mediaRefsInBlock,
  toFuzzyDate,
  isUuid,
  listOrder,
  placeNew,
  readingOrder,
  settle,
  tidy,
  uuidv7,
  type Block,
  type CanvasItemKind,
  type CanvasLayout,
  type Placed,
} from "@pramana/core";
import {
  actors,
  canvasItems,
  canvasLinks,
  canvases,
  citations,
  claims,
  excerpts,
  getDb,
  media,
  pages,
  type DbOrTx,
} from "@pramana/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { listEvents, recordEvent, type AuditEntry } from "./audit";
import { ownerOf, PermissionError, requireHuman, type ActorContext } from "./context";
import { loadMediaCards, searchMedia, type MediaCard } from "./media";
import { listNotes, ownNoteIds, type NoteView } from "./notes";
import {
  getPageView,
  listPages,
  loadClaimCards,
  loadEntityCards,
  loadExcerptCards,
  mapFeatures,
  search,
  timelineItems,
  type ClaimCard,
  type EntityCard,
  type ExcerptCard,
  type VizData,
} from "./queries";
import { NotFoundError, ValidationError } from "./util";

/**
 * Canvases: a learner's own boards (see packages/core/src/canvas.ts). They
 * are personal workspace, so writes apply at once, without a changeset; each
 * is validated, limited to the owner, and recorded as an audit event whose
 * subject is the canvas. Every change bumps the canvas's version, which
 * notifies open pages (Postgres NOTIFY on `canvases`).
 *
 * The owner is the person: the local human in the web app, or the human an
 * agent acts for over MCP. Reads render referenced content live, as it is now.
 */

export interface CanvasSummary {
  id: string;
  title: string;
  description: string | null;
  version: number;
  itemCount: number;
  /** Items by kind, for the list's one-line summary. */
  kinds: Partial<Record<CanvasItemKind, number>>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanvasActor {
  kind: string;
  handle: string;
  name: string;
}

/** What an item shows, loaded live; `missing` when what it refers to is gone. */
export type CanvasItemData =
  | { kind: "claim"; claim: ClaimCard }
  | { kind: "entity"; entity: EntityCard }
  | {
      kind: "chapter";
      page: { id: string; slug: string; title: string };
      chapter: {
        id: string;
        index: number;
        total: number;
        title: string;
        promise: string | null;
        when: string | null;
        brief: { happened: string; howWeKnow: string } | null;
      };
      /** The part's own blocks (for "full"). */
      blocks: Block[];
      claims: Record<string, ClaimCard>;
      entities: Record<string, EntityCard>;
      media: Record<string, MediaCard>;
    }
  | { kind: "excerpt"; excerpt: ExcerptCard; claims: { id: string; text: string }[] }
  | { kind: "media"; media: MediaCard }
  /** Maps and timelines load their own data in the browser (the atlas's embeds), from the item's ids. */
  | { kind: "map" }
  | { kind: "timeline" }
  | { kind: "note"; note: NoteView }
  | { kind: "viz"; data: VizData | null }
  | { kind: "text" }
  | { kind: "section" }
  | { kind: "missing"; what: string };

export interface CanvasItemView {
  id: string;
  kind: CanvasItemKind;
  content: CanvasItemContent;
  layout: CanvasLayout;
  addedBy: CanvasActor;
  /** "pending": the learner's AI added it and the learner has not kept it yet. */
  status: "kept" | "pending";
  batchId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  data: CanvasItemData;
}

export interface CanvasLinkView {
  id: string;
  from: string;
  to: string;
  relation: string;
  label: string | null;
  addedBy: CanvasActor;
  status: "kept" | "pending";
  batchId: string | null;
}

export interface CanvasView extends CanvasSummary {
  items: CanvasItemView[];
  /** Study notes about this canvas (an AI explaining how the pieces connect), newest first. */
  notes: NoteView[];
  links: CanvasLinkView[];
  /** Recent changes, newest first (who: the learner, or their AI). */
  activity: AuditEntry[];
  /** Links from claims, entities etc. in captions and text (for the Markdown links). */
  linked: { entities: Record<string, EntityCard>; claims: Record<string, { id: string; text: string }> };
}

async function ownCanvas(db: DbOrTx, ctx: ActorContext, id: string) {
  if (!isUuid(id)) throw new NotFoundError(`canvas ${id} not found`);
  const row = await db.query.canvases.findFirst({
    where: and(eq(canvases.id, id), eq(canvases.ownerId, ownerOf(ctx))),
  });
  if (!row) throw new NotFoundError(`canvas ${id} not found`);
  return row;
}

async function bump(db: DbOrTx, id: string): Promise<number> {
  const [row] = await db
    .update(canvases)
    .set({ version: sql`${canvases.version} + 1`, updatedAt: new Date() })
    .where(eq(canvases.id, id))
    .returning({ version: canvases.version });
  return row!.version;
}

// ---------------------------------------------------------------------------
// References: slugs become ids, and only things that exist can be added
// ---------------------------------------------------------------------------

async function exists(db: DbOrTx, table: typeof claims | typeof excerpts | typeof media, ids: string[]) {
  const want = [...new Set(ids)];
  if (!want.length) return new Set<string>();
  const rows = await db.select({ id: table.id }).from(table).where(inArray(table.id, want));
  return new Set(rows.map((r) => r.id));
}

/** Validates an item and resolves its references (entity and page slugs become ids). A note must be the owner's. */
async function resolveContent(db: DbOrTx, raw: unknown, owner: string): Promise<CanvasItemContent> {
  const content = CanvasItemContent.parse(raw);
  const refs = canvasItemRefs(content);
  const entityCards = await loadEntityCards(db, refs.entities);
  const missing: string[] = refs.entities.filter((r) => !entityCards.has(r)).map((r) => `entity "${r}"`);
  const check = async (table: Parameters<typeof exists>[1] | "notes", ids: string[], what: string) => {
    const found = table === "notes" ? await ownNoteIds(db, owner, ids) : await exists(db, table, ids);
    ids.filter((i) => !found.has(i)).forEach((i) => missing.push(`${what} ${i}`));
  };
  await Promise.all([
    check(claims, refs.claims, "claim"),
    check(excerpts, refs.excerpts, "excerpt"),
    check(media, refs.media, "media"),
    check("notes", refs.notes, "note"),
  ]);
  let pageId: string | null = null;
  if (content.kind === "chapter") {
    const page = await db.query.pages.findFirst({
      where: isUuid(content.page) ? eq(pages.id, content.page) : eq(pages.slug, content.page),
    });
    if (!page) missing.push(`page "${content.page}"`);
    else if (!page.blocks.some((b) => b.id === content.chapterId && b.type === "chapter"))
      missing.push(`chapter "${content.chapterId}" on page "${page.slug}"`);
    else pageId = page.id;
  }
  if (missing.length) throw new NotFoundError(`not found: ${missing.join(", ")}`);
  const id = (ref: string) => entityCards.get(ref)!.id;
  switch (content.kind) {
    case "entity":
      return { ...content, entity: id(content.entity) };
    case "chapter":
      return { ...content, page: pageId! };
    case "map":
      return { ...content, places: [...new Set(content.places.map(id))], focus: [...new Set(content.focus.map(id))] };
    case "timeline":
      return { ...content, entities: [...new Set(content.entities.map(id))] };
    case "claim": {
      // Remember the words as placed (always from the claim itself), so the tile can say if they change later.
      const [row] = await db.select({ text: claims.text }).from(claims).where(eq(claims.id, content.claimId));
      return { ...content, placed: { text: row!.text } };
    }
    case "excerpt": {
      const card = (await loadExcerptCards(db, [content.excerptId])).get(content.excerptId)!;
      return { ...content, placed: { quote: card.quote, locator: card.locatorLabel } };
    }
    default:
      return content;
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * What an agent adds arrives pending: the learner sees it marked as their AI's,
 * and keeps it or takes the whole batch back. What the learner adds is kept.
 */
function pendingFor(ctx: ActorContext, batch: string) {
  return { status: (ctx.kind === "human" ? "kept" : "pending") as "kept" | "pending", batchId: batch };
}

type ItemRow = typeof canvasItems.$inferSelect;
const asPlaced = (r: Pick<ItemRow, "id" | "layout" | "kind">): Placed => ({
  id: r.id,
  layout: r.layout,
  ...(r.kind === "section" ? { section: true } : {}),
});

/** Places new items (after the rest unless given a place) and pushes any overlaps down. */
function layoutNew(
  existing: Placed[],
  added: { id: string; content: CanvasItemContent; layout?: CanvasLayout }[],
): Map<string, CanvasLayout> {
  const all = [...existing];
  const fixed: string[] = [];
  for (const a of added) {
    const section = a.content.kind === "section";
    const layout = a.layout ?? placeNew(all, CANVAS_DEFAULT_SIZE[a.content.kind], { section });
    if (a.layout) fixed.push(a.id);
    all.push({ id: a.id, layout, ...(section ? { section } : {}) });
  }
  return new Map(settle(all, fixed).map((p) => [p.id, p.layout]));
}

async function writeLayouts(db: DbOrTx, before: Placed[], after: Placed[]): Promise<number> {
  const was = new Map(before.map((p) => [p.id, JSON.stringify(p.layout)]));
  let n = 0;
  for (const p of after) {
    if (was.get(p.id) === JSON.stringify(p.layout)) continue;
    await db.update(canvasItems).set({ layout: p.layout, updatedAt: new Date() }).where(eq(canvasItems.id, p.id));
    n++;
  }
  return n;
}

export async function createCanvas(ctx: ActorContext, raw: CanvasCreateInput): Promise<CanvasSummary> {
  const input = CanvasCreateInput.parse(raw);
  const db = getDb();
  const owner = ownerOf(ctx);
  const id = uuidv7();
  const batch = uuidv7();
  await db.transaction(async (tx) => {
    await tx.insert(canvases).values({ id, ownerId: owner, title: input.title, description: input.description ?? null });
    if (input.items.length) {
      const resolved = await Promise.all(input.items.map((i) => resolveContent(tx, i.content, ownerOf(ctx))));
      const added = resolved.map((content, i) => ({ id: uuidv7(), content, layout: input.items[i]!.layout }));
      const layouts = layoutNew([], added);
      await tx.insert(canvasItems).values(
        added.map((a) => ({
          id: a.id,
          canvasId: id,
          kind: a.content.kind,
          content: a.content,
          layout: layouts.get(a.id)!,
          addedById: ctx.actorId,
          ...pendingFor(ctx, batch),
        })),
      );
    }
    await recordEvent(tx, ctx, {
      action: "canvas.created",
      subjectType: "canvas",
      subjectId: id,
      data: { title: input.title, items: input.items.length },
    });
  });
  return summaryOf(id);
}

export async function updateCanvas(
  ctx: ActorContext,
  id: string,
  raw: { title?: string; description?: string | null },
): Promise<CanvasSummary> {
  const db = getDb();
  const row = await ownCanvas(db, ctx, id);
  const next = CanvasMeta.parse({
    title: raw.title ?? row.title,
    description: raw.description === null ? undefined : (raw.description ?? row.description ?? undefined),
  });
  await db.transaction(async (tx) => {
    await tx
      .update(canvases)
      .set({ title: next.title, description: next.description ?? null })
      .where(eq(canvases.id, id));
    await bump(tx, id);
    await recordEvent(tx, ctx, {
      action: "canvas.updated",
      subjectType: "canvas",
      subjectId: id,
      data: { title: next.title, ...(next.title !== row.title ? { was: row.title } : {}) },
    });
  });
  return summaryOf(id);
}

export async function deleteCanvas(ctx: ActorContext, id: string): Promise<void> {
  const db = getDb();
  const row = await ownCanvas(db, ctx, id);
  await db.transaction(async (tx) => {
    const [n] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(canvasItems)
      .where(eq(canvasItems.canvasId, id));
    await tx.delete(canvases).where(eq(canvases.id, id));
    await recordEvent(tx, ctx, {
      action: "canvas.deleted",
      subjectType: "canvas",
      subjectId: id,
      data: { title: row.title, items: n?.n ?? 0 },
    });
  });
}

export async function addCanvasItems(
  ctx: ActorContext,
  canvasId: string,
  raw: CanvasAddItemsInput,
): Promise<{ ids: string[]; batch: string; version: number }> {
  const input = CanvasAddItemsInput.parse(raw);
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(canvasItems).where(eq(canvasItems.canvasId, canvasId));
    if (rows.length + input.items.length > CANVAS_MAX_ITEMS)
      throw new ValidationError(`a canvas holds at most ${CANVAS_MAX_ITEMS} items (this one has ${rows.length})`);
    const resolved = await Promise.all(input.items.map((i) => resolveContent(tx, i.content, ownerOf(ctx))));
    const added = resolved.map((content, i) => ({ id: uuidv7(), content, layout: input.items[i]!.layout }));
    const batch = uuidv7();
    const before = rows.map(asPlaced);
    const layouts = layoutNew(before, added);
    await tx.insert(canvasItems).values(
      added.map((a) => ({
        id: a.id,
        canvasId,
        kind: a.content.kind,
        content: a.content,
        layout: layouts.get(a.id)!,
        addedById: ctx.actorId,
        ...pendingFor(ctx, batch),
      })),
    );
    // Items given a place may have pushed others down.
    await writeLayouts(tx, before, before.map((p) => ({ ...p, layout: layouts.get(p.id)! })));
    const version = await bump(tx, canvasId);
    await recordEvent(tx, ctx, {
      action: "canvas.items_added",
      subjectType: "canvas",
      subjectId: canvasId,
      data: { batch, items: added.map((a) => ({ id: a.id, kind: a.content.kind })) },
    });
    return { ids: added.map((a) => a.id), batch, version };
  });
}

export async function updateCanvasItem(
  ctx: ActorContext,
  canvasId: string,
  itemId: string,
  raw: CanvasItemPatch,
  options: { refreshPlaced?: boolean } = {},
): Promise<{ version: number }> {
  const patch = CanvasItemPatch.parse(raw);
  if (!patch.content && !patch.layout && !options.refreshPlaced)
    throw new ValidationError("give content or layout to change");
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(canvasItems).where(eq(canvasItems.canvasId, canvasId));
    const row = rows.find((r) => r.id === itemId);
    if (!row) throw new NotFoundError(`item ${itemId} not found on canvas ${canvasId}`);
    let content = patch.content || options.refreshPlaced ? await resolveContent(tx, patch.content ?? row.content, ownerOf(ctx)) : row.content;
    // The words as first placed stay, while the item still shows the same claim or quote ("Updated since").
    const old = row.content;
    if (!options.refreshPlaced && (old.kind === "claim" || old.kind === "excerpt") && old.placed && content.kind === old.kind) {
      const same = old.kind === "claim" ? content.kind === "claim" && content.claimId === old.claimId : content.kind === "excerpt" && content.excerptId === old.excerptId;
      if (same) content = { ...content, placed: old.placed } as CanvasItemContent;
    }
    await tx
      .update(canvasItems)
      .set({ content, kind: content.kind, updatedAt: new Date(), version: sql`${canvasItems.version} + 1` })
      .where(eq(canvasItems.id, itemId));
    if (patch.layout) {
      const before = rows.map(asPlaced);
      const moved = before.map((p) => (p.id === itemId ? { ...p, layout: patch.layout! } : p));
      await writeLayouts(tx, before, settle(moved, [itemId]));
    }
    const version = await bump(tx, canvasId);
    await recordEvent(tx, ctx, {
      action: "canvas.item_updated",
      subjectType: "canvas",
      subjectId: canvasId,
      data: {
        item: itemId,
        kind: content.kind,
        fields: [patch.content && "content", patch.layout && "layout", options.refreshPlaced && "placed"].filter(Boolean),
      },
    });
    return { version };
  });
}

export async function removeCanvasItems(
  ctx: ActorContext,
  canvasId: string,
  ids: string[],
): Promise<{ removed: number; version: number }> {
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  const want = [...new Set(ids)].filter(isUuid);
  if (!want.length) throw new ValidationError("name the items to remove");
  return db.transaction(async (tx) => {
    const gone = await tx
      .delete(canvasItems)
      .where(and(eq(canvasItems.canvasId, canvasId), inArray(canvasItems.id, want)))
      .returning({ id: canvasItems.id, kind: canvasItems.kind });
    if (!gone.length) throw new NotFoundError("none of those items are on this canvas");
    const version = await bump(tx, canvasId);
    await recordEvent(tx, ctx, {
      action: "canvas.items_removed",
      subjectType: "canvas",
      subjectId: canvasId,
      data: { items: gone },
    });
    return { removed: gone.length, version };
  });
}

export async function arrangeCanvas(
  ctx: ActorContext,
  canvasId: string,
  raw: CanvasArrangeInput,
): Promise<{ moved: number; version: number }> {
  const input = CanvasArrangeInput.parse(raw);
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(canvasItems).where(eq(canvasItems.canvasId, canvasId));
    const known = new Set(rows.map((r) => r.id));
    const unknown = [...input.layouts.map((l) => l.id), ...(input.order ?? [])].filter((id) => !known.has(id));
    if (unknown.length) throw new NotFoundError(`not on this canvas: ${[...new Set(unknown)].join(", ")}`);
    const before = rows.map(asPlaced);
    let next = input.order ? flowLayout(before, input.order) : before;
    if (input.layouts.length) {
      const given = new Map(input.layouts.map((l) => [l.id, l.layout]));
      next = settle(
        next.map((p) => (given.has(p.id) ? { ...p, layout: given.get(p.id)! } : p)),
        [...given.keys()],
      );
    }
    if (input.tidy) next = tidy(next);
    const moved = await writeLayouts(tx, before, next);
    const version = moved ? await bump(tx, canvasId) : (await ownCanvas(tx, ctx, canvasId)).version;
    if (moved)
      await recordEvent(tx, ctx, {
        action: "canvas.arranged",
        subjectType: "canvas",
        subjectId: canvasId,
        data: { moved, ...(input.order ? { order: true } : {}), ...(input.tidy ? { tidy: true } : {}) },
      });
    return { moved, version };
  });
}

/** Draws lines between items, each with a relation (supports, contradicts, causes...). A line already drawn is returned, not drawn again. */
export async function addCanvasLinks(
  ctx: ActorContext,
  canvasId: string,
  raw: CanvasLinkInput[],
): Promise<{ ids: string[]; batch: string; version: number }> {
  const links = raw.map((l) => CanvasLinkInput.parse(l));
  if (!links.length || links.length > 100) throw new ValidationError("give 1 to 100 links");
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: canvasItems.id }).from(canvasItems).where(eq(canvasItems.canvasId, canvasId));
    const known = new Set(rows.map((r) => r.id));
    const unknown = links.flatMap((l) => [l.from, l.to]).filter((id) => !known.has(id));
    if (unknown.length) throw new NotFoundError(`not on this canvas: ${[...new Set(unknown)].join(", ")}`);
    // A line that is already there (same two items, same direction, same relation) is not drawn
    // twice: its id is returned in its place, and a batch of nothing new changes nothing.
    const existing = await tx
      .select({ id: canvasLinks.id, fromId: canvasLinks.fromId, toId: canvasLinks.toId, relation: canvasLinks.relation })
      .from(canvasLinks)
      .where(eq(canvasLinks.canvasId, canvasId));
    const key = (from: string, to: string, relation: string) => `${from}>${to}:${relation}`;
    const byKey = new Map(existing.map((e) => [key(e.fromId, e.toId, e.relation), e.id]));
    const batch = uuidv7();
    const values: (typeof canvasLinks.$inferInsert & { id: string; relation: string })[] = [];
    const ids = links.map((l) => {
      const k = key(l.from, l.to, l.relation);
      const known = byKey.get(k);
      if (known) return known;
      const id = uuidv7();
      byKey.set(k, id);
      values.push({
        id,
        canvasId,
        fromId: l.from,
        toId: l.to,
        relation: l.relation,
        label: l.label ?? null,
        addedById: ctx.actorId,
        ...pendingFor(ctx, batch),
      });
      return id;
    });
    if (!values.length) {
      const [row] = await tx.select({ version: canvases.version }).from(canvases).where(eq(canvases.id, canvasId));
      return { ids, batch, version: row!.version };
    }
    await tx.insert(canvasLinks).values(values);
    const version = await bump(tx, canvasId);
    await recordEvent(tx, ctx, {
      action: "canvas.links_added",
      subjectType: "canvas",
      subjectId: canvasId,
      data: { batch, links: values.map((v) => ({ id: v.id, relation: v.relation })) },
    });
    return { ids, batch, version };
  });
}

export async function updateCanvasLink(
  ctx: ActorContext,
  canvasId: string,
  linkId: string,
  patch: { relation?: string; label?: string | null },
): Promise<{ version: number }> {
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  const row = await db.query.canvasLinks.findFirst({
    where: and(eq(canvasLinks.id, linkId), eq(canvasLinks.canvasId, canvasId)),
  });
  if (!row) throw new NotFoundError(`link ${linkId} not found on canvas ${canvasId}`);
  const next = CanvasLinkInput.parse({
    from: row.fromId,
    to: row.toId,
    relation: patch.relation ?? row.relation,
    label: patch.label === null ? undefined : (patch.label ?? row.label ?? undefined),
  });
  return db.transaction(async (tx) => {
    await tx.update(canvasLinks).set({ relation: next.relation, label: next.label ?? null }).where(eq(canvasLinks.id, linkId));
    const version = await bump(tx, canvasId);
    await recordEvent(tx, ctx, {
      action: "canvas.link_updated",
      subjectType: "canvas",
      subjectId: canvasId,
      data: { link: linkId, relation: next.relation },
    });
    return { version };
  });
}

export async function removeCanvasLinks(ctx: ActorContext, canvasId: string, ids: string[]): Promise<{ removed: number; version: number }> {
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  const want = [...new Set(ids)].filter(isUuid);
  if (!want.length) throw new ValidationError("name the links to remove");
  return db.transaction(async (tx) => {
    const gone = await tx
      .delete(canvasLinks)
      .where(and(eq(canvasLinks.canvasId, canvasId), inArray(canvasLinks.id, want)))
      .returning({ id: canvasLinks.id });
    if (!gone.length) throw new NotFoundError("none of those links are on this canvas");
    const version = await bump(tx, canvasId);
    await recordEvent(tx, ctx, { action: "canvas.links_removed", subjectType: "canvas", subjectId: canvasId, data: { links: gone.map((g) => g.id) } });
    return { removed: gone.length, version };
  });
}

/**
 * The learner's answer to what their AI added: keep it (it becomes theirs) or
 * take back a whole batch at once. Only the person decides, never the agent.
 */
export async function decideCanvasBatch(
  ctx: ActorContext,
  canvasId: string,
  decision: { batch?: string; items?: string[]; keep: boolean },
): Promise<{ items: number; links: number; version: number }> {
  requireHuman(ctx, "Keeping or taking back what your AI added");
  const db = getDb();
  await ownCanvas(db, ctx, canvasId);
  const itemIds = (decision.items ?? []).filter(isUuid);
  if (!decision.batch && !itemIds.length) throw new ValidationError("name a batch or items");
  if (decision.batch && !isUuid(decision.batch)) throw new ValidationError("batch must be an id");
  return db.transaction(async (tx) => {
    const itemWhere = and(
      eq(canvasItems.canvasId, canvasId),
      eq(canvasItems.status, "pending"),
      decision.batch ? eq(canvasItems.batchId, decision.batch) : inArray(canvasItems.id, itemIds),
    );
    const linkWhere = and(
      eq(canvasLinks.canvasId, canvasId),
      eq(canvasLinks.status, "pending"),
      decision.batch ? eq(canvasLinks.batchId, decision.batch) : inArray(canvasLinks.fromId, itemIds),
    );
    let items: { id: string }[];
    let links: { id: string }[];
    if (decision.keep) {
      items = await tx.update(canvasItems).set({ status: "kept" }).where(itemWhere).returning({ id: canvasItems.id });
      links = await tx.update(canvasLinks).set({ status: "kept" }).where(linkWhere).returning({ id: canvasLinks.id });
    } else {
      links = await tx.delete(canvasLinks).where(linkWhere).returning({ id: canvasLinks.id });
      items = await tx.delete(canvasItems).where(itemWhere).returning({ id: canvasItems.id });
    }
    const version = items.length || links.length ? await bump(tx, canvasId) : (await ownCanvas(tx, ctx, canvasId)).version;
    if (items.length || links.length)
      await recordEvent(tx, ctx, {
        action: decision.keep ? "canvas.kept" : "canvas.taken_back",
        subjectType: "canvas",
        subjectId: canvasId,
        data: { batch: decision.batch ?? null, items: items.map((i) => i.id), links: links.map((l) => l.id) },
      });
    return { items: items.length, links: links.length, version };
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

async function summaries(db: DbOrTx, rows: (typeof canvases.$inferSelect)[]): Promise<CanvasSummary[]> {
  if (!rows.length) return [];
  const counts = await db
    .select({ canvasId: canvasItems.canvasId, kind: canvasItems.kind, n: sql<number>`count(*)::int` })
    .from(canvasItems)
    .where(
      inArray(
        canvasItems.canvasId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(canvasItems.canvasId, canvasItems.kind);
  return rows.map((r) => {
    const mine = counts.filter((c) => c.canvasId === r.id);
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      version: r.version,
      itemCount: mine.reduce((n, c) => n + c.n, 0),
      kinds: Object.fromEntries(mine.map((c) => [c.kind, c.n])),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

async function summaryOf(id: string): Promise<CanvasSummary> {
  const db = getDb();
  const row = await db.query.canvases.findFirst({ where: eq(canvases.id, id) });
  return (await summaries(db, [row!]))[0]!;
}

/** The owner's canvases, most recently changed first. */
export async function listCanvases(ctx: ActorContext): Promise<CanvasSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(canvases)
    .where(eq(canvases.ownerId, ownerOf(ctx)))
    .orderBy(desc(canvases.updatedAt));
  return summaries(db, rows);
}

/** The blocks of one chapter: the chapter block and what follows it, up to the next chapter. */
function chapterBlocks(blocks: Block[], chapterId: string): { index: number; total: number; blocks: Block[] } | null {
  const heads = blocks.flatMap((b, i) => (b.type === "chapter" ? [i] : []));
  const at = blocks.findIndex((b) => b.id === chapterId && b.type === "chapter");
  if (at < 0) return null;
  const next = heads.find((i) => i > at) ?? blocks.length;
  return { index: heads.indexOf(at), total: heads.length, blocks: blocks.slice(at + 1, next) };
}

function whenLabel(when: Parameters<typeof toFuzzyDate>[0] | undefined): string | null {
  if (!when) return null;
  try {
    return formatFuzzyDate(toFuzzyDate(when));
  } catch {
    return null;
  }
}

const LINK_RE = /\]\((claim|entity):([^)\s]+)\)/g;
function linksIn(md: string | undefined, scheme: "claim" | "entity"): string[] {
  if (!md) return [];
  return [...md.matchAll(LINK_RE)].filter((m) => m[1] === scheme).map((m) => m[2]!);
}

/** One canvas with every item loaded live, for the owner. */
export async function getCanvas(ctx: ActorContext, id: string): Promise<CanvasView> {
  const db = getDb();
  const row = await ownCanvas(db, ctx, id);
  const rows = await db
    .select()
    .from(canvasItems)
    .where(eq(canvasItems.canvasId, id))
    .orderBy(asc(canvasItems.id));
  const contents = rows.map((r) => CanvasItemContent.safeParse(r.content));

  // Everything referenced, loaded in one pass per kind.
  const want = { claims: new Set<string>(), entities: new Set<string>(), excerpts: new Set<string>(), media: new Set<string>(), notes: new Set<string>(), pages: new Set<string>() };
  const linkedClaims = new Set<string>();
  const linkedEntities = new Set<string>();
  for (const c of contents) {
    if (!c.success) continue;
    const refs = canvasItemRefs(c.data);
    for (const k of Object.keys(want) as (keyof typeof want)[]) refs[k].forEach((r) => want[k].add(r));
    const md = [c.data.caption, c.data.kind === "text" ? c.data.markdown : undefined];
    md.forEach((m) => {
      linksIn(m, "claim").forEach((x) => linkedClaims.add(x));
      linksIn(m, "entity").forEach((x) => linkedEntities.add(x));
    });
  }
  const linkRows = await db.select().from(canvasLinks).where(eq(canvasLinks.canvasId, id)).orderBy(asc(canvasLinks.id));
  const authorIds = [row.ownerId, ...new Set([...rows, ...linkRows].map((r) => r.addedById))];
  const [claimCards, entityCards, excerptCards, mediaCards, noteViews, pageViews, adders] = await Promise.all([
    loadClaimCards(db, [...want.claims]),
    loadEntityCards(db, [...want.entities, ...linkedEntities]),
    loadExcerptCards(db, [...want.excerpts]),
    loadMediaCards(db, [...want.media]),
    want.notes.size ? listNotes(ctx, { ids: [...want.notes], status: "all", limit: 200 }) : Promise.resolve([] as NoteView[]),
    Promise.all(
      [...want.pages].map((p) =>
        getPageView(p).then(
          (v) => [p, v] as const,
          () => [p, null] as const,
        ),
      ),
    ),
    db
      .select()
      .from(actors)
      .where(inArray(actors.id, authorIds)),
  ]);
  // Archived notes still show on a canvas that holds them: the learner chose to keep them there.
  const notesById = new Map(noteViews.map((n) => [n.id, n]));
  const pagesById = new Map(pageViews);
  const actorsById = new Map(adders.map((a) => [a.id, a]));
  const citedBy = want.excerpts.size
    ? await db
        .select({ excerptId: citations.excerptId, id: claims.id, text: claims.text })
        .from(citations)
        .innerJoin(claims, eq(claims.id, citations.claimId))
        .where(inArray(citations.excerptId, [...want.excerpts]))
    : [];
  const linkedClaimRows = linkedClaims.size
    ? await db
        .select({ id: claims.id, text: claims.text })
        .from(claims)
        .where(inArray(claims.id, [...linkedClaims].filter(isUuid)))
    : [];

  const items: CanvasItemView[] = [];
  for (const [i, r] of rows.entries()) {
    const parsed = contents[i]!;
    const adder = actorsById.get(r.addedById);
    const base = {
      id: r.id,
      layout: r.layout,
      status: r.status,
      batchId: r.batchId,
      addedBy: { kind: adder?.kind ?? "human", handle: adder?.handle ?? "", name: adder?.displayName ?? "" },
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
    if (!parsed.success) {
      items.push({
        ...base,
        kind: "text",
        content: { kind: "text", markdown: "This item could not be read." },
        data: { kind: "missing", what: "item" },
      });
      continue;
    }
    const content = parsed.data;
    items.push({ ...base, kind: content.kind, content, data: await itemData(db, content, { claimCards, entityCards, excerptCards, mediaCards, notesById, pagesById, citedBy }) });
  }

  const summary = (await summaries(db, [row]))[0]!;
  return {
    ...summary,
    items: listOrder(items.map((i) => ({ ...i, ...(i.kind === "section" ? { section: true } : {}) }))).map(({ section: _s, ...i }) => i as CanvasItemView),
    notes: await listNotes(ctx, { subject: { type: "canvas", id }, limit: 20 }),
    links: linkRows.map((l) => {
      const by = actorsById.get(l.addedById);
      return {
        id: l.id,
        from: l.fromId,
        to: l.toId,
        relation: l.relation,
        label: l.label,
        status: l.status,
        batchId: l.batchId,
        addedBy: { kind: by?.kind ?? "agent", handle: by?.handle ?? "", name: by?.displayName ?? "" },
      };
    }),
    activity: await listEvents({ subjectId: id, limit: 20, viewer: ownerOf(ctx) }),
    linked: {
      entities: Object.fromEntries([...linkedEntities].flatMap((ref) => (entityCards.get(ref) ? [[ref, entityCards.get(ref)!]] : []))),
      claims: Object.fromEntries(linkedClaimRows.map((c) => [c.id, c])),
    },
  };
}

interface Loaded {
  claimCards: Map<string, ClaimCard>;
  entityCards: Map<string, EntityCard>;
  excerptCards: Map<string, ExcerptCard>;
  mediaCards: Map<string, MediaCard>;
  notesById: Map<string, NoteView>;
  pagesById: Map<string, Awaited<ReturnType<typeof getPageView>> | null>;
  citedBy: { excerptId: string; id: string; text: string }[];
}

async function itemData(db: DbOrTx, content: CanvasItemContent, l: Loaded): Promise<CanvasItemData> {
  switch (content.kind) {
    case "claim": {
      const claim = l.claimCards.get(content.claimId);
      return claim ? { kind: "claim", claim } : { kind: "missing", what: "claim" };
    }
    case "entity": {
      const entity = l.entityCards.get(content.entity);
      return entity ? { kind: "entity", entity } : { kind: "missing", what: "entity" };
    }
    case "chapter": {
      const view = l.pagesById.get(content.page);
      const head = view?.page.blocks.find((b) => b.id === content.chapterId && b.type === "chapter");
      const part = view ? chapterBlocks(view.page.blocks, content.chapterId) : null;
      if (!view || !head || head.type !== "chapter" || !part || view.page.status !== "published")
        return { kind: "missing", what: "part" };
      const claimIds = new Set<string>();
      const ents = new Set<string>([...head.places, ...head.people]);
      const mediaIds = new Set<string>();
      for (const b of [head, ...part.blocks]) {
        claimIdsInBlock(b).forEach((x) => claimIds.add(x));
        entityRefsInBlock(b).forEach((x) => ents.add(x));
        mediaRefsInBlock(b).forEach((x) => mediaIds.add(x));
      }
      const pick = <T>(rec: Record<string, T>, keys: Iterable<string>) =>
        Object.fromEntries([...keys].flatMap((k) => (rec[k] ? [[k, rec[k]!]] : [])));
      return {
        kind: "chapter",
        page: { id: view.page.id, slug: view.page.slug, title: view.page.title },
        chapter: {
          id: head.id,
          index: part.index,
          total: part.total,
          title: head.title,
          promise: head.promise ?? null,
          when: whenLabel(head.when),
          brief: head.brief ?? null,
        },
        blocks: part.blocks,
        claims: pick(view.claims, claimIds),
        entities: pick(view.entities, ents),
        media: pick(view.media, mediaIds),
      };
    }
    case "excerpt": {
      const excerpt = l.excerptCards.get(content.excerptId);
      if (!excerpt) return { kind: "missing", what: "quote" };
      return {
        kind: "excerpt",
        excerpt,
        claims: l.citedBy.filter((c) => c.excerptId === excerpt.id).map(({ id, text }) => ({ id, text })),
      };
    }
    case "media": {
      const m = l.mediaCards.get(content.mediaId);
      return m ? { kind: "media", media: m } : { kind: "missing", what: "picture" };
    }
    case "map":
      return { kind: "map" };
    case "timeline":
      return { kind: "timeline" };
    case "note": {
      const note = l.notesById.get(content.noteId);
      return note ? { kind: "note", note } : { kind: "missing", what: "study note" };
    }
    case "viz": {
      const v = content.viz;
      if (v.kind === "timeline")
        return {
          kind: "viz",
          data: { kind: "timeline", items: await timelineItems(db, { entityIds: v.entityIds, claimIds: v.claimIds, linkedTo: v.linkedTo }) },
        };
      if (v.kind === "map")
        return { kind: "viz", data: { kind: "map", features: await mapFeatures(db, { entityIds: v.entityIds, linkedTo: v.linkedTo }) } };
      return { kind: "viz", data: null };
    }
    case "text":
      return { kind: "text" };
    case "section":
      return { kind: "section" };
  }
}

/**
 * Where a thing already is on the owner's canvases (for "Add to canvas":
 * which boards already hold this claim). Matches the item's main reference.
 */
export async function canvasesHolding(
  ctx: ActorContext,
  ref: { kind: CanvasItemKind; id: string; chapterId?: string },
): Promise<string[]> {
  const db = getDb();
  const key =
    ref.kind === "claim"
      ? { claimId: ref.id }
      : ref.kind === "entity"
        ? { entity: ref.id }
        : ref.kind === "excerpt"
          ? { excerptId: ref.id }
          : ref.kind === "media"
            ? { mediaId: ref.id }
            : ref.kind === "note"
              ? { noteId: ref.id }
              : ref.kind === "chapter"
                ? { page: ref.id, chapterId: ref.chapterId }
                : null;
  if (!key) return [];
  const rows = await db
    .selectDistinct({ id: canvasItems.canvasId })
    .from(canvasItems)
    .innerJoin(canvases, eq(canvases.id, canvasItems.canvasId))
    .where(
      and(
        eq(canvases.ownerId, ownerOf(ctx)),
        eq(canvasItems.kind, ref.kind),
        sql`${canvasItems.content} @> ${JSON.stringify(key)}::jsonb`,
      ),
    );
  return rows.map((r) => r.id);
}

export interface CanvasFind {
  claims: { id: string; text: string; kind: string }[];
  entities: { id: string; slug: string; label: string; kind: string; whenLabel: string | null }[];
  parts: { page: string; pageTitle: string; chapterId: string; title: string }[];
  media: { id: string; title: string }[];
}

/** What the board's insert search offers: claims, people and places, parts of pages, and pictures. */
export async function findForCanvas(query: string): Promise<CanvasFind> {
  const q = query.trim();
  if (!q) return { claims: [], entities: [], parts: [], media: [] };
  const fold = (s: string) => s.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
  const words = fold(q).split(/\s+/).filter(Boolean);
  const [hits, pictures, pageList] = await Promise.all([
    search(q, { types: ["claims", "entities", "pages"], limit: 8 }),
    searchMedia(q, { limit: 6 }).catch(() => []),
    listPages(),
  ]);
  const matchedPages = new Set(hits.pages.map((p) => p.slug));
  const parts: CanvasFind["parts"] = [];
  for (const p of pageList) {
    const view = await getPageView(p.slug).catch(() => null);
    if (!view) continue;
    for (const b of view.page.blocks) {
      if (b.type !== "chapter") continue;
      const hay = fold(`${b.title} ${b.promise ?? ""}`);
      if (matchedPages.has(p.slug) || words.every((w) => hay.includes(w)))
        parts.push({ page: p.slug, pageTitle: p.title, chapterId: b.id, title: b.title });
    }
  }
  return {
    claims: hits.claims.map(({ id, text, kind }) => ({ id, text, kind })),
    entities: hits.entities,
    parts: parts.slice(0, 12),
    media: pictures.map((m) => ({ id: m.id, title: m.title })),
  };
}
