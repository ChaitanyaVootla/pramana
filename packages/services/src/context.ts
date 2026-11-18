import { uuidv7, type ActorKind } from "@pramana/core";
import { actors, getDb, requireEnv, sessions, type DbOrTx } from "@pramana/db";
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

/**
 * Who is acting. Every write records the actor, the human they act for (if
 * any), and the session. An agent acting via MCP is `{ kind: "agent",
 * onBehalfOfId: <human> }`; the human using the web UI is `{ kind: "human" }`.
 */
export interface ActorContext {
  actorId: string;
  kind: ActorKind;
  handle: string;
  onBehalfOfId: string | null;
  sessionId: string | null;
}

export class PermissionError extends Error {
  override name = "PermissionError";
}

/** The person whose personal data this is: the human, or the human an agent acts for. */
export function ownerOf(ctx: ActorContext): string {
  const owner = ctx.kind === "human" ? ctx.actorId : ctx.onBehalfOfId;
  if (!owner) throw new PermissionError(`${ctx.kind} "${ctx.handle}" acts for no one, so has no personal data`);
  return owner;
}

export async function ensureActor(
  handle: string,
  kind: ActorKind,
  displayName: string,
  db: DbOrTx = getDb(),
): Promise<{ id: string; kind: ActorKind; handle: string }> {
  const existing = await db.query.actors.findFirst({ where: eq(actors.handle, handle) });
  if (existing) {
    if (existing.kind !== kind) {
      throw new Error(`actor "${handle}" exists with kind ${existing.kind}, not ${kind}`);
    }
    return { id: existing.id, kind: existing.kind, handle: existing.handle };
  }
  const id = uuidv7();
  await db.insert(actors).values({ id, kind, handle, displayName }).onConflictDoNothing();
  const row = await db.query.actors.findFirst({ where: eq(actors.handle, handle) });
  return { id: row!.id, kind: row!.kind, handle: row!.handle };
}

/** The local human user (MVP: single user, no authentication). */
export async function humanContext(): Promise<ActorContext> {
  const handle = requireEnv("PRAMANA_USER_HANDLE", "me");
  const name = process.env.PRAMANA_USER_NAME ?? handle;
  const human = await ensureActor(handle, "human", name);
  return { actorId: human.id, kind: "human", handle, onBehalfOfId: null, sessionId: null };
}

/**
 * An agent acting for the local human, with a new session row. `client` is
 * the MCP client's self-reported name/version (e.g. claude-code).
 */
export async function startAgentSession(options: {
  agentHandle?: string;
  client?: { name?: string; version?: string };
  meta?: Record<string, unknown>;
}): Promise<ActorContext> {
  const handle = options.agentHandle ?? requireEnv("PRAMANA_AGENT_HANDLE", "claude-code");
  const agent = await ensureActor(handle, "agent", handle);
  const human = await humanContext();
  const sessionId = uuidv7();
  await getDb()
    .insert(sessions)
    .values({
      id: sessionId,
      actorId: agent.id,
      onBehalfOfId: human.actorId,
      client: options.client ?? {},
      meta: options.meta ?? {},
    });
  return { actorId: agent.id, kind: "agent", handle, onBehalfOfId: human.actorId, sessionId };
}

/**
 * Records that the session is active (presence). At most every 15 seconds, so
 * a burst of tool calls is one write (and one live event).
 */
export async function touchSession(ctx: ActorContext): Promise<void> {
  if (!ctx.sessionId) return;
  await getDb()
    .update(sessions)
    .set({ lastSeenAt: new Date(), endedAt: null })
    .where(
      and(
        eq(sessions.id, ctx.sessionId),
        or(
          lt(sessions.lastSeenAt, sql`now() - interval '15 seconds'`),
          isNotNull(sessions.endedAt),
        ),
      ),
    );
}

/** The client disconnected cleanly: it no longer counts as connected. */
export async function endSession(ctx: ActorContext): Promise<void> {
  if (!ctx.sessionId) return;
  await getDb()
    .update(sessions)
    .set({ endedAt: new Date() })
    .where(and(eq(sessions.id, ctx.sessionId), isNull(sessions.endedAt)));
}

/** Non-human automation (importers, seed scripts), optionally acting for the user. */
export async function systemContext(
  handle: string,
  kind: "importer" | "system" = "system",
): Promise<ActorContext> {
  const actor = await ensureActor(handle, kind, handle);
  const human = await humanContext();
  return { actorId: actor.id, kind, handle, onBehalfOfId: human.actorId, sessionId: null };
}

export function requireHuman(ctx: ActorContext, what: string): void {
  if (ctx.kind !== "human") {
    throw new PermissionError(
      `${what} requires a human reviewer (acting as ${ctx.kind} "${ctx.handle}")`,
    );
  }
}
