import {
  isUuid,
  NoteInput,
  noteTarget,
  type NoteSubject,
  type NoteTarget,
  NoteStatus,
  uuidv7,
  type NoteSubjectType,
  type VizSpec,
} from "@pramana/core";
import {
  actors,
  claims,
  entities,
  getDb,
  notes,
  pages,
  sessions,
  sources,
  type DbOrTx,
} from "@pramana/db";
import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { recordEvent } from "./audit";
import { ownerOf, PermissionError, type ActorContext } from "./context";
import { mapFeatures, timelineItems, type VizData } from "./queries";
import { NotFoundError, ValidationError } from "./util";

/**
 * Notes are an agent's (or the user's) answers and annotations during a study
 * session: shown live beside what they are about, never mistaken for reviewed
 * content. A note can later be turned into page content through a changeset.
 *
 * Each note has a subject (general, page, entity, claim, source or canvas) and
 * may also name the page the reader was on, so it shows there too.
 *
 * Notes are personal: every read is for one learner (ownerOf the context), who
 * sees the notes they posted and the ones their own agents posted for them.
 */

export interface NoteSubjectView {
  type: NoteSubjectType;
  id: string | null;
  /** What to call it: the page title, entity name, claim text… ("" once the subject is gone). */
  label: string;
  /** Where it lives in the web app. */
  href: string | null;
}

export interface NoteView {
  id: string;
  title: string;
  body: string;
  subject: NoteSubjectView;
  pageId: string | null;
  anchorBlockId: string | null;
  /** The chapter (or block) title when the note is anchored to one. */
  anchorLabel: string | null;
  claimIds: string[];
  viz: VizSpec | null;
  vizData: VizData | null;
  status: NoteStatus;
  sessionId: string | null;
  /** Who posted it: the client's self-reported name, else the actor's name or handle. */
  author: string;
  /** Posted by an agent (the reader's AI), not by the reader. */
  byAgent: boolean;
  /** The agent's client, as it names itself (e.g. "claude-code"); null if it gave none. */
  client: string | null;
  createdAt: Date;
}

type Row = typeof notes.$inferSelect;

async function findPage(db: DbOrTx, ref: string) {
  const page = await db.query.pages.findFirst({
    where: isUuid(ref) ? eq(pages.id, ref) : eq(pages.slug, ref),
  });
  if (!page) throw new NotFoundError(`page "${ref}" not found`);
  return page;
}

/**
 * Titles of the owner's canvases among `ids` (another learner's canvas is not found). Canvases live in
 * their own table (owned by the canvas feature); look them up without a schema import.
 */
async function canvasTitles(db: DbOrTx, ids: string[], owner: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ids.length) return out;
  const [exists] = await db.execute<{ t: string | null }>(
    sql`select to_regclass('public.canvases')::text as t`,
  );
  if (!exists?.t) return out;
  const rows = await db.execute<{ id: string; title: string }>(
    sql`select id::text as id, title from canvases where owner_id = ${owner} and id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`,
  );
  for (const r of rows) out.set(r.id, r.title);
  return out;
}

/** The title of one of the owner's canvases, or null when they have no such canvas. */
export async function canvasTitle(id: string, owner: string): Promise<string | null> {
  return (await canvasTitles(getDb(), [id], owner)).get(id) ?? null;
}

/** Runs a lookup only when there is something to look up. */
function some<T>(ids: string[], load: (ids: string[]) => Promise<T[]>): Promise<T[]> {
  return ids.length ? load(ids) : Promise.resolve([]);
}

/** The id of a note's subject (null for general), checking that it exists (a canvas: that it is the owner's). */
export async function noteSubjectId(
  db: DbOrTx,
  s: NoteTarget["subject"] | NoteSubject,
  owner: string,
): Promise<string | null> {
  switch (s.type) {
    case "general":
      return null;
    case "page":
      return (await findPage(db, s.page)).id;
    case "entity": {
      const row = await db.query.entities.findFirst({
        where: isUuid(s.entity) ? eq(entities.id, s.entity) : eq(entities.slug, s.entity),
      });
      if (!row) throw new NotFoundError(`entity "${s.entity}" not found`);
      return row.id;
    }
    case "claim": {
      const row = await db.query.claims.findFirst({ where: eq(claims.id, s.id) });
      if (!row) throw new NotFoundError(`claim ${s.id} not found`);
      return row.id;
    }
    case "source": {
      const row = await db.query.sources.findFirst({ where: eq(sources.id, s.id) });
      if (!row) throw new NotFoundError(`source ${s.id} not found`);
      return row.id;
    }
    case "canvas": {
      if (!(await canvasTitles(db, [s.id], owner)).has(s.id)) {
        throw new NotFoundError(`canvas ${s.id} not found`);
      }
      return s.id;
    }
  }
}

/** Resolves and checks the subject, page and block of a note before it is written. */
export async function resolveNoteTarget(db: DbOrTx, input: NoteInput, owner: string) {
  const target = noteTarget(input);
  const subjectId = await noteSubjectId(db, target.subject, owner);
  let pageId: string | null = null;
  if (target.page) {
    const page = await findPage(db, target.page);
    pageId = page.id;
    if (target.block && !page.blocks.some((b) => b.id === target.block)) {
      throw new ValidationError(
        `page "${page.slug}" has no block "${target.block}" (chapter ids are in get_page)`,
      );
    }
  }
  return { subjectType: target.subject.type, subjectId, pageId, anchorBlockId: target.block };
}

export async function postNote(ctx: ActorContext, raw: unknown): Promise<NoteView> {
  const input = NoteInput.parse(raw);
  const db = getDb();
  const owner = ownerOf(ctx);
  const target = await resolveNoteTarget(db, input, owner);
  // The same note posted again (a retried call, a script run twice) is the one already shown.
  const [same] = await db
    .select()
    .from(notes)
    .where(
      and(
        noteOwnedBy(owner),
        inArray(notes.status, ["live", "pinned"]),
        eq(notes.title, input.title),
        eq(notes.body, input.body),
        eq(notes.subjectType, target.subjectType),
        target.subjectId ? eq(notes.subjectId, target.subjectId) : isNull(notes.subjectId),
        target.pageId ? eq(notes.pageId, target.pageId) : isNull(notes.pageId),
        target.anchorBlockId ? eq(notes.anchorBlockId, target.anchorBlockId) : isNull(notes.anchorBlockId),
      ),
    )
    .limit(1);
  if (same) return (await toViews([same], owner))[0]!;
  const id = uuidv7();
  const [row] = await db
    .insert(notes)
    .values({
      id,
      sessionId: ctx.sessionId,
      actorId: ctx.actorId,
      onBehalfOfId: ctx.onBehalfOfId,
      ...target,
      title: input.title,
      body: input.body,
      claimIds: input.claimIds,
      viz: input.viz ?? null,
    })
    .returning();
  await recordEvent(db, ctx, {
    action: "note.posted",
    subjectType: "note",
    subjectId: id,
    data: {
      title: input.title,
      about: target.subjectType,
      aboutId: target.subjectId,
      pageId: target.pageId,
    },
  });
  return (await toViews([row!], owner))[0]!;
}

async function vizDataFor(db: DbOrTx, viz: VizSpec | null): Promise<VizData | null> {
  if (viz?.kind === "timeline") {
    return {
      kind: "timeline",
      items: await timelineItems(db, {
        entityIds: viz.entityIds,
        claimIds: viz.claimIds,
        linkedTo: viz.linkedTo,
      }),
    };
  }
  if (viz?.kind === "map") {
    return {
      kind: "map",
      features: await mapFeatures(db, { entityIds: viz.entityIds, linkedTo: viz.linkedTo }),
    };
  }
  return null;
}

function idsOf(rows: Row[], type: NoteSubjectType): string[] {
  return [
    ...new Set(rows.filter((r) => r.subjectType === type && r.subjectId).map((r) => r.subjectId!)),
  ];
}

/** Batch-loads subject labels, anchors and authors for a list of the owner's notes. */
async function toViews(rows: Row[], owner: string): Promise<NoteView[]> {
  if (!rows.length) return [];
  const db = getDb();
  const present = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  const pageIds = present([...idsOf(rows, "page"), ...rows.map((r) => r.pageId)]);
  const [pageRows, entityRows, claimRows, sourceRows, canvases, sessionRows, actorRows] =
    await Promise.all([
      some(pageIds, (ids) =>
        db
          .select({ id: pages.id, slug: pages.slug, title: pages.title, blocks: pages.blocks })
          .from(pages)
          .where(inArray(pages.id, ids)),
      ),
      some(idsOf(rows, "entity"), (ids) =>
        db
          .select({ id: entities.id, slug: entities.slug, label: entities.label })
          .from(entities)
          .where(inArray(entities.id, ids)),
      ),
      some(idsOf(rows, "claim"), (ids) =>
        db.select({ id: claims.id, text: claims.text }).from(claims).where(inArray(claims.id, ids)),
      ),
      some(idsOf(rows, "source"), (ids) =>
        db
          .select({ id: sources.id, title: sources.title })
          .from(sources)
          .where(inArray(sources.id, ids)),
      ),
      canvasTitles(db, idsOf(rows, "canvas"), owner),
      some(present(rows.map((r) => r.sessionId)), (ids) =>
        db
          .select({ id: sessions.id, client: sessions.client })
          .from(sessions)
          .where(inArray(sessions.id, ids)),
      ),
      some(present(rows.map((r) => r.actorId)), (ids) =>
        db
          .select({
            id: actors.id,
            kind: actors.kind,
            handle: actors.handle,
            displayName: actors.displayName,
          })
          .from(actors)
          .where(inArray(actors.id, ids)),
      ),
    ]);
  const page = new Map(pageRows.map((p) => [p.id, p]));
  const entity = new Map(entityRows.map((e) => [e.id, e]));
  const claim = new Map(claimRows.map((c) => [c.id, c]));
  const source = new Map(sourceRows.map((s) => [s.id, s]));
  const client = new Map(sessionRows.map((s) => [s.id, s.client.name]));
  const actor = new Map(actorRows.map((a) => [a.id, a]));

  const subjectOf = (r: Row): NoteSubjectView => {
    const type = r.subjectType as NoteSubjectType;
    const id = r.subjectId;
    // A subject deleted since the note was posted.
    const missing = { type, id, label: "", href: null };
    switch (type) {
      case "general":
        return { type, id: null, label: "General", href: null };
      case "page": {
        const p = page.get(id!);
        return p ? { type, id, label: p.title, href: `/p/${p.slug}` } : missing;
      }
      case "entity": {
        const e = entity.get(id!);
        return e ? { type, id, label: e.label, href: `/e/${e.slug}` } : missing;
      }
      case "claim": {
        const c = claim.get(id!);
        return c ? { type, id, label: c.text, href: `/c/${id}` } : missing;
      }
      case "source": {
        const s = source.get(id!);
        return s ? { type, id, label: s.title, href: `/s/${id}` } : missing;
      }
      case "canvas": {
        const title = canvases.get(id!);
        return title ? { type, id, label: title, href: `/canvas/${id}` } : missing;
      }
    }
  };

  return Promise.all(
    rows.map(async (r) => {
      const onPage = r.pageId ? page.get(r.pageId) : undefined;
      const block = r.anchorBlockId
        ? onPage?.blocks.find((b) => b.id === r.anchorBlockId)
        : undefined;
      const a = actor.get(r.actorId);
      return {
        id: r.id,
        title: r.title,
        body: r.body,
        subject: subjectOf(r),
        pageId: r.pageId,
        anchorBlockId: r.anchorBlockId,
        anchorLabel: block && "title" in block && block.title ? block.title : null,
        claimIds: r.claimIds,
        viz: r.viz,
        vizData: await vizDataFor(db, r.viz),
        status: r.status as NoteStatus,
        sessionId: r.sessionId,
        author:
          (r.sessionId && client.get(r.sessionId)) || a?.displayName || a?.handle || "unknown",
        byAgent: a?.kind === "agent",
        client: (r.sessionId && client.get(r.sessionId)) || null,
        createdAt: r.createdAt,
      };
    }),
  );
}

export interface NoteFilter {
  /** Notes about this subject. `{ type: "general" }` = notes about nothing in particular. */
  subject?: { type: NoteSubjectType; id?: string | null };
  /** Notes that show on this page: about it, or posted while reading it. Null = general notes. */
  pageId?: string | null;
  /** Default: live and pinned. */
  status?: NoteStatus | "shown" | "all";
  ids?: string[];
  sessionId?: string;
  /** Pagination: notes older than this note id. */
  before?: string;
  limit?: number;
}

/** Notes that belong to this learner: posted by them, or by an agent (or script) acting for them. */
export function noteOwnedBy(owner: string): SQL {
  return or(eq(notes.onBehalfOfId, owner), and(isNull(notes.onBehalfOfId), eq(notes.actorId, owner)))!;
}

function conditions(owner: string, filter: NoteFilter): SQL[] {
  const out: SQL[] = [noteOwnedBy(owner)];
  const status = filter.status ?? "shown";
  if (status === "shown") out.push(inArray(notes.status, ["live", "pinned"]));
  else if (status !== "all") out.push(eq(notes.status, status));
  if (filter.ids?.length) out.push(inArray(notes.id, filter.ids));
  if (filter.subject) {
    out.push(eq(notes.subjectType, filter.subject.type));
    if (filter.subject.id) out.push(eq(notes.subjectId, filter.subject.id));
  }
  if (filter.pageId === null) out.push(isNull(notes.pageId), eq(notes.subjectType, "general"));
  else if (filter.pageId) {
    out.push(
      or(
        eq(notes.pageId, filter.pageId),
        and(eq(notes.subjectType, "page"), eq(notes.subjectId, filter.pageId)),
      )!,
    );
  }
  if (filter.sessionId) out.push(eq(notes.sessionId, filter.sessionId));
  if (filter.before) out.push(lt(notes.id, filter.before));
  return out;
}

/**
 * One of each note: the same title and body about the same thing, posted twice (before posting
 * became idempotent), shows once. Rows come pinned first, then newest, so the kept one is the
 * pinned or newest.
 */
function withoutRepeats(rows: Row[]): Row[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = JSON.stringify([r.title, r.body, r.subjectType, r.subjectId, r.pageId, r.anchorBlockId]);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Which of these notes are the owner's (canvases and views may only hold the owner's notes). */
export async function ownNoteIds(db: DbOrTx, owner: string, ids: string[]): Promise<Set<string>> {
  const want = [...new Set(ids)];
  if (!want.length) return new Set();
  const rows = await db
    .select({ id: notes.id })
    .from(notes)
    .where(and(inArray(notes.id, want), noteOwnedBy(owner)));
  return new Set(rows.map((r) => r.id));
}

/** The viewer's notes, pinned first, then newest first. */
export async function listNotes(viewer: ActorContext, filter: NoteFilter = {}): Promise<NoteView[]> {
  const owner = ownerOf(viewer);
  const rows = await getDb()
    .select()
    .from(notes)
    .where(and(...conditions(owner, filter)))
    .orderBy(sql`${notes.status} = 'pinned' desc`, desc(notes.id))
    .limit(Math.min(filter.limit ?? 50, 200));
  return toViews(withoutRepeats(rows), owner);
}

/** How many of the viewer's notes there are of each subject type and status (for the history's filters). */
export async function noteCounts(viewer: ActorContext) {
  const rows = await getDb()
    .select({ type: notes.subjectType, status: notes.status, n: sql<number>`count(*)::int` })
    .from(notes)
    .where(and(...conditions(ownerOf(viewer), { status: "all" })))
    .groupBy(notes.subjectType, notes.status);
  return rows.map((r) => ({
    type: r.type as NoteSubjectType,
    status: r.status as NoteStatus,
    count: r.n,
  }));
}

const STATUS_ACTION: Record<NoteStatus, string> = {
  live: "note.restored",
  pinned: "note.pinned",
  archived: "note.archived",
};

/**
 * Pin (keep it first), archive (hide it everywhere but the history) or restore
 * a note. The reader can change any of their notes; an agent only the ones it posted.
 */
export async function setNoteStatus(
  ctx: ActorContext,
  id: string,
  status: NoteStatus,
): Promise<void> {
  NoteStatus.parse(status);
  const db = getDb();
  // Another learner's note is not found, the same as one that does not exist.
  const row = await db.query.notes.findFirst({ where: and(eq(notes.id, id), noteOwnedBy(ownerOf(ctx))) });
  if (!row) throw new NotFoundError(`note ${id} not found`);
  if (ctx.kind !== "human" && row.actorId !== ctx.actorId) {
    throw new PermissionError(
      `only the reader, or the agent that posted it, can change note ${id}`,
    );
  }
  if (row.status === status) return;
  await db.update(notes).set({ status }).where(eq(notes.id, id));
  await recordEvent(db, ctx, {
    action: STATUS_ACTION[status],
    subjectType: "note",
    subjectId: id,
    data: { from: row.status },
  });
}

export async function archiveNote(ctx: ActorContext, id: string): Promise<void> {
  await setNoteStatus(ctx, id, "archived");
}
