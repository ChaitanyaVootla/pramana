import { actors, changesets, getDb, notes, sessions } from "@pramana/db";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

/**
 * Presence: is the reader's AI connected right now? An agent session counts as
 * connected while it has made a call recently and has not disconnected. Each
 * call touches the session (see touchSession); the sessions trigger pushes
 * that over the live event stream.
 */

/** A session with no call for this long no longer counts as connected. */
export const PRESENCE_WINDOW_MS = 10 * 60_000;

export interface AgentSessionView {
  id: string;
  /** The agent's handle, e.g. claude-code. */
  agent: string;
  /** The client's self-reported name and version. */
  client: { name?: string; version?: string };
  /** How it connected: "http" or "stdio" (older sessions: null). */
  transport: string | null;
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
  notes: number;
  changesets: number;
  active: boolean;
  /** Started by a script that runs by itself (meta.automation, e.g. the approval pipeline), not by the reader's AI. */
  automated: boolean;
}

export async function listAgentSessions(
  options: {
    /** Only sessions acting for this human: a learner sees only their own AI sessions. */
    forActorId: string;
    activeOnly?: boolean;
    id?: string;
    limit?: number;
  },
): Promise<AgentSessionView[]> {
  const db = getDb();
  const since = new Date(Date.now() - PRESENCE_WINDOW_MS);
  const where = [eq(actors.kind, "agent")];
  where.push(eq(sessions.onBehalfOfId, options.forActorId));
  if (options.id) where.push(eq(sessions.id, options.id));
  if (options.activeOnly) where.push(isNull(sessions.endedAt), gt(sessions.lastSeenAt, since));
  const rows = await db
    .select({
      id: sessions.id,
      agent: actors.handle,
      client: sessions.client,
      meta: sessions.meta,
      startedAt: sessions.startedAt,
      lastSeenAt: sessions.lastSeenAt,
      endedAt: sessions.endedAt,
      notes: sql<number>`(select count(*)::int from ${notes} where ${notes.sessionId} = ${sessions.id})`,
      changesets: sql<number>`(select count(*)::int from ${changesets} where ${changesets.sessionId} = ${sessions.id})`,
    })
    .from(sessions)
    .innerJoin(actors, eq(actors.id, sessions.actorId))
    .where(and(...where))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(Math.min(options.limit ?? 20, 100));
  return rows.map((r) => ({
    id: r.id,
    agent: r.agent,
    client: r.client,
    transport: typeof r.meta.transport === "string" ? r.meta.transport : null,
    startedAt: r.startedAt,
    lastSeenAt: r.lastSeenAt,
    endedAt: r.endedAt,
    notes: r.notes,
    changesets: r.changesets,
    active: !r.endedAt && r.lastSeenAt > since,
    automated: typeof r.meta.automation === "string",
  }));
}

export interface Presence {
  connected: boolean;
  /** Connected sessions, most recently active first. */
  sessions: AgentSessionView[];
}

export async function getPresence(forActorId: string): Promise<Presence> {
  // A script running by itself (the approval pipeline) is not the reader's AI being there.
  const active = (await listAgentSessions({ forActorId, activeOnly: true, limit: 10 }))
    .filter((s) => !s.automated)
    .slice(0, 5);
  return { connected: active.length > 0, sessions: active };
}
