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
  /**
   * Set only on a hosted site with sign-in (see `setHumanResolver`): the owner
   * edits content; a signed-in learner keeps only their own learning; a guest
   * (not signed in) reads and writes nothing personal. Absent locally, where the
   * one local user is the owner.
   */
  role?: "owner" | "learner" | "guest";
}

export class PermissionError extends Error {
  override name = "PermissionError";
}

/** A guest tried to keep something: the site asks them to sign in. */
export class SignInRequired extends PermissionError {
  override name = "SignInRequired";
  constructor(what = "Keeping your progress") {
    super(`${what} needs you to sign in.`);
  }
}

/**
 * The guest's actor id is never stored, so reads scoped to it find nothing and
 * any personal write that slips past the checks fails its foreign key.
 */
export const GUEST_ACTOR_ID = "00000000-0000-7000-8000-000000000000";

export function guestContext(): ActorContext {
  return {
    actorId: GUEST_ACTOR_ID,
    kind: "human",
    handle: "guest",
    onBehalfOfId: null,
    sessionId: null,
    role: "guest",
  };
}

export function isGuest(ctx: ActorContext): boolean {
  return ctx.role === "guest";
}

/** Whether this person may change content (approve, reject, attest): the owner, or the local user. */
export function canEditContent(ctx: ActorContext): boolean {
  return ctx.role === undefined || ctx.role === "owner";
}

type HumanResolver = () => Promise<ActorContext>;
const RESOLVER = Symbol.for("pramana.humanResolver");

/**
 * A hosted web app with sign-in resolves the human per request (from its
 * session cookie) instead of the one local user in the environment. Kept on
 * globalThis so every bundle in the server process sees the same resolver.
 */
export function setHumanResolver(resolver: HumanResolver | null): void {
  (globalThis as Record<symbol, unknown>)[RESOLVER] = resolver ?? undefined;
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

/**
 * The human using the app: on a hosted site with sign-in, whoever this request
 * belongs to (a guest if no one is signed in); otherwise the one local user.
 */
export async function humanContext(): Promise<ActorContext> {
  const resolver = (globalThis as Record<symbol, unknown>)[RESOLVER] as HumanResolver | undefined;
  if (resolver) return resolver();
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
  if (isGuest(ctx)) throw new SignInRequired(what);
}

/** Approving, rejecting and connecting an AI belong to the site's editor (the local user, or the hosted owner). */
export function requireEditor(ctx: ActorContext, what: string): void {
  requireHuman(ctx, what);
  if (!canEditContent(ctx)) throw new PermissionError(`${what} is for the site's editor.`);
}
