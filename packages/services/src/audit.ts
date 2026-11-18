import { uuidv7 } from "@pramana/core";
import { actors, events, getDb, type DbOrTx } from "@pramana/db";
import { and, desc, eq, isNull, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import type { ActorContext } from "./context";

export interface EventInput {
  action: string;
  subjectType?: string;
  subjectId?: string;
  changesetId?: string;
  rationale?: string;
  data?: Record<string, unknown>;
}

export async function recordEvent(
  db: DbOrTx,
  ctx: ActorContext,
  input: EventInput,
): Promise<string> {
  const id = uuidv7();
  await db.insert(events).values({
    id,
    actorId: ctx.actorId,
    onBehalfOfId: ctx.onBehalfOfId,
    sessionId: ctx.sessionId,
    action: input.action,
    subjectType: input.subjectType ?? null,
    subjectId: input.subjectId ?? null,
    changesetId: input.changesetId ?? null,
    rationale: input.rationale ?? null,
    data: input.data ?? {},
  });
  return id;
}

export interface AuditEntry {
  id: string;
  at: Date;
  action: string;
  subjectType: string | null;
  subjectId: string | null;
  changesetId: string | null;
  sessionId: string | null;
  rationale: string | null;
  data: Record<string, unknown>;
  actor: { handle: string; kind: string; displayName: string };
  onBehalfOf: { handle: string; displayName: string } | null;
}

/**
 * Actions on a learner's own things (notes, canvases, views, study answers and reviews), by the first
 * part of the action name. Only that learner sees them in the log; content changes are for everyone.
 */
export const PERSONAL_ACTIONS = ["note", "canvas", "view", "card", "cards", "guess", "check", "belief", "first_steps"];

export async function listEvents(
  filter: {
    subjectId?: string;
    changesetId?: string;
    sessionId?: string;
    before?: Date;
    limit?: number;
    /** Whose personal events to include (the human, as `ownerOf`); without one, none are. */
    viewer?: string;
  } = {},
): Promise<AuditEntry[]> {
  const db = getDb();
  const kind = sql<string>`split_part(${events.action}, '.', 1)`;
  const mine = filter.viewer
    ? or(
        eq(events.onBehalfOfId, filter.viewer),
        and(isNull(events.onBehalfOfId), eq(events.actorId, filter.viewer)),
      )
    : undefined;
  const conditions: SQL[] = [mine ? or(notInArray(kind, PERSONAL_ACTIONS), mine)! : notInArray(kind, PERSONAL_ACTIONS)];
  if (filter.subjectId) conditions.push(eq(events.subjectId, filter.subjectId));
  if (filter.changesetId) conditions.push(eq(events.changesetId, filter.changesetId));
  if (filter.sessionId) conditions.push(eq(events.sessionId, filter.sessionId));
  if (filter.before) conditions.push(lt(events.at, filter.before));
  const rows = await db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(events.id))
    .limit(Math.min(filter.limit ?? 100, 500));
  const actorRows = await db.select().from(actors);
  const byId = new Map(actorRows.map((a) => [a.id, a]));
  return rows.map((r) => {
    const actor = byId.get(r.actorId)!;
    const behalf = r.onBehalfOfId ? byId.get(r.onBehalfOfId) : undefined;
    return {
      id: r.id,
      at: r.at,
      action: r.action,
      subjectType: r.subjectType,
      subjectId: r.subjectId,
      changesetId: r.changesetId,
      sessionId: r.sessionId,
      rationale: r.rationale,
      data: r.data,
      actor: { handle: actor.handle, kind: actor.kind, displayName: actor.displayName },
      onBehalfOf: behalf ? { handle: behalf.handle, displayName: behalf.displayName } : null,
    };
  });
}
