import {
  describeViewChange,
  EMPTY_VIEW,
  isUuid,
  patchUserView,
  SITE_VIEW_ID,
  UserView,
  UserViewChange,
  uuidv7,
  VIEW_HISTORY_MAX,
  type UserViewPatch,
} from "@pramana/core";
import { actors, entities, getDb, pages, userViews, type DbOrTx } from "@pramana/db";
import { and, eq } from "drizzle-orm";
import { recordEvent } from "./audit";
import { ownerOf, PermissionError, type ActorContext } from "./context";
import { ownNoteIds } from "./notes";
import { NotFoundError } from "./util";

/**
 * Panels that hold claims, including contested ones and corrections. Only the
 * learner may hide them; an AI tailoring a page may bring things forward, never
 * take disagreement out of view.
 */
const LEARNER_ONLY_HIDE = new Set(["claims"]);

/**
 * "Your view": a learner's own arrangement of an era or entity page (see
 * packages/core/src/userview.ts), and their one site-wide view (subject
 * "site": the appearance panel's choices). Personal, so changes apply at once;
 * each is validated, recorded as an audit event, and kept in the view's
 * history with the view before it, so any change (the learner's or their AI's)
 * can be undone. The page's own content and spec are never touched.
 */

export type ViewSubjectType = "page" | "entity" | "site";

export interface ViewChangeView {
  at: string;
  by: UserViewChange["by"];
  note: string | null;
  /** What the change did, in words. */
  lines: string[];
  kept: boolean;
}

export interface UserViewState {
  subject: { type: ViewSubjectType; id: string };
  view: UserView;
  version: number;
  /** Newest first. */
  changes: ViewChangeView[];
  /** The latest change, when an AI made it and the learner has not kept or undone it yet. */
  pendingAiChange: ViewChangeView | null;
}

async function subjectId(db: DbOrTx, type: ViewSubjectType, ref: string): Promise<string> {
  // One site, so one site-wide view per learner; the ref is not needed.
  if (type === "site") return SITE_VIEW_ID;
  if (type === "page") {
    const row = await db.query.pages.findFirst({
      where: isUuid(ref) ? eq(pages.id, ref) : eq(pages.slug, ref),
      columns: { id: true },
    });
    if (!row) throw new NotFoundError(`page "${ref}" not found`);
    return row.id;
  }
  const row = await db.query.entities.findFirst({
    where: isUuid(ref) ? eq(entities.id, ref) : eq(entities.slug, ref),
    columns: { id: true },
  });
  if (!row) throw new NotFoundError(`entity "${ref}" not found`);
  return row.id;
}

function changeViews(history: UserViewChange[]): ViewChangeView[] {
  const out: ViewChangeView[] = [];
  history.forEach((h, i) => {
    const after = history[i + 1]?.before;
    out.push({
      at: h.at,
      by: h.by,
      note: h.note ?? null,
      // The view after a change is the next change's "before" (or the current view, filled in below).
      lines: after ? describeViewChange(h.before, after) : [],
      kept: Boolean(h.kept),
    });
  });
  return out;
}

function stateOf(type: ViewSubjectType, id: string, row: typeof userViews.$inferSelect | undefined): UserViewState {
  if (!row) return { subject: { type, id }, view: EMPTY_VIEW, version: 0, changes: [], pendingAiChange: null };
  const view = UserView.parse(row.view);
  const history = row.history.map((h) => UserViewChange.parse(h));
  const changes = changeViews(history);
  const last = changes.at(-1);
  if (last) last.lines = describeViewChange(history.at(-1)!.before, view);
  const pending = last && last.by.kind === "agent" && !last.kept ? last : null;
  return { subject: { type, id }, view, version: row.version, changes: changes.reverse(), pendingAiChange: pending };
}

async function load(db: DbOrTx, owner: string, type: ViewSubjectType, id: string) {
  return db.query.userViews.findFirst({
    where: and(eq(userViews.ownerId, owner), eq(userViews.subjectType, type), eq(userViews.subjectId, id)),
  });
}

/** The learner's view of a page or entity (an empty view when they have none). */
export async function getUserView(ctx: ActorContext, type: ViewSubjectType, ref: string): Promise<UserViewState> {
  const db = getDb();
  const id = await subjectId(db, type, ref);
  return stateOf(type, id, await load(db, ownerOf(ctx), type, id));
}

/** Every view the learner has (for an AI to see what it already tailored). */
export async function listUserViews(ctx: ActorContext): Promise<UserViewState[]> {
  const rows = await getDb().select().from(userViews).where(eq(userViews.ownerId, ownerOf(ctx)));
  return rows.map((r) => stateOf(r.subjectType, r.subjectId, r));
}

async function actorOf(db: DbOrTx, ctx: ActorContext): Promise<UserViewChange["by"]> {
  const row = await db.query.actors.findFirst({ where: eq(actors.id, ctx.actorId) });
  return { kind: ctx.kind, handle: ctx.handle, name: row?.displayName ?? ctx.handle };
}

/** Study notes a view pins must exist and be the owner's. */
async function checkRefs(db: DbOrTx, view: UserView, owner: string): Promise<void> {
  const ids = [...new Set(view.pinnedNotes.map((p) => p.noteId))];
  if (!ids.length) return;
  const found = await ownNoteIds(db, owner, ids);
  const missing = ids.filter((i) => !found.has(i));
  if (missing.length) throw new NotFoundError(`study note not found: ${missing.join(", ")}`);
}

async function write(
  ctx: ActorContext,
  type: ViewSubjectType,
  ref: string,
  next: (current: UserView) => UserView,
  options: { note?: string; action: string },
): Promise<UserViewState> {
  const db = getDb();
  const owner = ownerOf(ctx);
  const id = await subjectId(db, type, ref);
  return db.transaction(async (tx) => {
    const row = await load(tx, owner, type, id);
    const current = row ? UserView.parse(row.view) : EMPTY_VIEW;
    const view = UserView.parse(next(current));
    if (JSON.stringify(view) === JSON.stringify(current)) return stateOf(type, id, row);
    if (ctx.kind !== "human") {
      const hidden = view.hide.filter((p) => LEARNER_ONLY_HIDE.has(p) && !current.hide.includes(p));
      if (hidden.length)
        throw new PermissionError(
          `only the learner can hide ${hidden.join(", ")}: an AI may bring things forward, not take claims out of view`,
        );
    }
    await checkRefs(tx, view, owner);
    const change = UserViewChange.parse({
      at: new Date().toISOString(),
      by: await actorOf(tx, ctx),
      ...(options.note ? { note: options.note.slice(0, 500) } : {}),
      before: current,
    });
    const history = [...(row?.history ?? []), change].slice(-VIEW_HISTORY_MAX);
    let saved: typeof userViews.$inferSelect;
    if (row) {
      [saved] = (await tx
        .update(userViews)
        .set({ view, history, version: row.version + 1, updatedAt: new Date() })
        .where(eq(userViews.id, row.id))
        .returning()) as [typeof userViews.$inferSelect];
    } else {
      [saved] = (await tx
        .insert(userViews)
        .values({ id: uuidv7(), ownerId: owner, subjectType: type, subjectId: id, view, history })
        .returning()) as [typeof userViews.$inferSelect];
    }
    // The event's subject is the learner's view, never the page or entity: personal activity stays
    // out of the public history of content.
    await recordEvent(tx, ctx, {
      action: options.action,
      subjectType: "user_view",
      subjectId: saved.id,
      rationale: options.note,
      data: { about: { type, id }, changes: describeViewChange(current, view) },
    });
    return stateOf(type, id, saved);
  });
}

/** Changes the learner's view (only the keys given). `note` says why; an AI should always give one. */
export function setUserView(
  ctx: ActorContext,
  type: ViewSubjectType,
  ref: string,
  patch: UserViewPatch,
  note?: string,
): Promise<UserViewState> {
  return write(ctx, type, ref, (v) => patchUserView(v, patch), { note, action: "view.changed" });
}

/** Back to the page as published (recorded, so it can be undone too). */
export function resetUserView(
  ctx: ActorContext,
  type: ViewSubjectType,
  ref: string,
  note?: string,
): Promise<UserViewState> {
  return write(ctx, type, ref, () => EMPTY_VIEW, { note, action: "view.reset" });
}

/** Undoes the latest change: the view goes back to what it was before it. */
export async function undoUserView(ctx: ActorContext, type: ViewSubjectType, ref: string): Promise<UserViewState> {
  const db = getDb();
  const owner = ownerOf(ctx);
  const id = await subjectId(db, type, ref);
  return db.transaction(async (tx) => {
    const row = await load(tx, owner, type, id);
    const last = row?.history.at(-1);
    if (!row || !last) return stateOf(type, id, row);
    const undone = UserViewChange.parse(last);
    const view = UserView.parse(undone.before);
    const history = row.history.slice(0, -1);
    const [saved] = (await tx
      .update(userViews)
      .set({ view, history, version: row.version + 1, updatedAt: new Date() })
      .where(eq(userViews.id, row.id))
      .returning()) as [typeof userViews.$inferSelect];
    await recordEvent(tx, ctx, {
      action: "view.undone",
      subjectType: "user_view",
      subjectId: row.id,
      data: {
        about: { type, id },
        undid: { by: undone.by.handle, at: undone.at },
        changes: describeViewChange(UserView.parse(row.view), view),
      },
    });
    return stateOf(type, id, saved);
  });
}

/** The learner keeps their AI's latest change: it stops being announced. */
export async function keepUserViewChange(ctx: ActorContext, type: ViewSubjectType, ref: string): Promise<UserViewState> {
  const db = getDb();
  const owner = ownerOf(ctx);
  const id = await subjectId(db, type, ref);
  const row = await load(db, owner, type, id);
  const last = row?.history.at(-1);
  if (!row || !last || last.kept) return stateOf(type, id, row);
  const history = [...row.history.slice(0, -1), { ...last, kept: true }];
  const [saved] = (await db
    .update(userViews)
    .set({ history, version: row.version + 1 })
    .where(eq(userViews.id, row.id))
    .returning()) as [typeof userViews.$inferSelect];
  await recordEvent(db, ctx, {
    action: "view.kept",
    subjectType: "user_view",
    subjectId: row.id,
    data: { about: { type, id }, by: last.by.handle },
  });
  return stateOf(type, id, saved);
}

