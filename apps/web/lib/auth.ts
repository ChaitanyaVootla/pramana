import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { ensureActor, guestContext, type ActorContext } from "@pramana/services";

/**
 * Sign-in with Google, for a hosted site (PRAMANA_AUTH=google). Locally there
 * is no sign-in: the one user in the environment is the owner, as before.
 *
 * - The owner is the Google account whose verified email is PRAMANA_OWNER_EMAIL;
 *   they act as the local user (PRAMANA_USER_HANDLE), so their own data follows
 *   them, and only they change content.
 * - Anyone else who signs in is a learner with their own notes, cards and
 *   canvases, keyed by their Google account id. No email is stored for them.
 * - Everyone else is a guest: they read, and keep nothing.
 *
 * The session is a signed cookie (HMAC-SHA256 with PRAMANA_SESSION_SECRET); no
 * table is needed.
 */

export const SESSION_COOKIE = "pramana_session";
export const STATE_COOKIE = "pramana_oauth";
const SESSION_DAYS = 60;

export function authEnabled(): boolean {
  return process.env.PRAMANA_AUTH === "google";
}

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  secret: string;
  ownerEmail: string | null;
  ownerHandle: string;
  ownerName: string;
  /** The site's public origin, e.g. https://pramana.vootlachaitanya.com */
  origin: string;
}

export function authConfig(): AuthConfig {
  const need = (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing ${name}: sign-in is on (PRAMANA_AUTH=google)`);
    return v;
  };
  const handle = process.env.PRAMANA_USER_HANDLE ?? "me";
  return {
    clientId: need("GOOGLE_CLIENT_ID"),
    clientSecret: need("GOOGLE_CLIENT_SECRET"),
    secret: need("PRAMANA_SESSION_SECRET"),
    ownerEmail: process.env.PRAMANA_OWNER_EMAIL?.trim().toLowerCase() || null,
    ownerHandle: handle,
    ownerName: process.env.PRAMANA_USER_NAME ?? handle,
    origin: need("PRAMANA_WEB_URL").replace(/\/+$/, ""),
  };
}

export interface Session {
  /** The actor handle this person acts as. */
  h: string;
  /** Display name. */
  n: string;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function encodeSession(
  session: Omit<Session, "exp">,
  secret: string,
): { value: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 86_400;
  const body = Buffer.from(
    JSON.stringify({ ...session, exp: Math.floor(Date.now() / 1000) + maxAge }),
  ).toString("base64url");
  return { value: `${body}.${sign(body, secret)}`, maxAge };
}

export function decodeSession(value: string | undefined, secret: string): Session | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const mac = Buffer.from(value.slice(dot + 1));
  const expected = Buffer.from(sign(body, secret));
  if (mac.length !== expected.length || !timingSafeEqual(mac, expected)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    if (typeof s.h !== "string" || typeof s.n !== "string" || typeof s.exp !== "number")
      return null;
    return s.exp * 1000 > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function randomToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Who a verified Google account acts as. */
export function identityFor(
  claims: {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
  },
  config: AuthConfig,
): { handle: string; name: string } {
  const email = claims.email?.toLowerCase();
  if (config.ownerEmail && claims.email_verified && email === config.ownerEmail) {
    return { handle: config.ownerHandle, name: config.ownerName };
  }
  const name = (claims.given_name || claims.name || "Learner").slice(0, 80);
  return { handle: `google-${claims.sub}`, name };
}

/** The session in this request, if any (null outside a request or with sign-in off). */
export async function currentSession(): Promise<Session | null> {
  if (!authEnabled()) return null;
  let jar;
  try {
    jar = await cookies();
  } catch {
    return null;
  }
  return decodeSession(jar.get(SESSION_COOKIE)?.value, authConfig().secret);
}

/** The request's human for the services: the owner, a learner, or a guest. */
export async function resolveHuman(): Promise<ActorContext> {
  const session = await currentSession();
  if (!session) return guestContext();
  const actor = await ensureActor(session.h, "human", session.n);
  const role = session.h === authConfig().ownerHandle ? "owner" : "learner";
  return {
    actorId: actor.id,
    kind: "human",
    handle: actor.handle,
    onBehalfOfId: null,
    sessionId: null,
    role,
  };
}

export type Account =
  { mode: "local" } | { mode: "guest" } | { mode: "signed-in"; name: string; owner: boolean };

/** What the shell shows about the person: nothing locally, a sign-in link, or their name. */
export async function currentAccount(): Promise<Account> {
  if (!authEnabled()) return { mode: "local" };
  const session = await currentSession();
  if (!session) return { mode: "guest" };
  return { mode: "signed-in", name: session.n, owner: session.h === authConfig().ownerHandle };
}

/** A same-site path to return to after signing in; anything else goes home. */
export function safeNext(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\") ||
    next.startsWith("/api/")
  )
    return "/";
  return next.slice(0, 500);
}

/**
 * The human for an action that keeps something: a guest is asked to sign in
 * before anything is tried (the services would refuse anyway, less kindly).
 */
export async function writerContext(what?: string): Promise<ActorContext> {
  const { humanContext, isGuest, SignInRequired } = await import("@pramana/services");
  const ctx = await humanContext();
  if (isGuest(ctx)) throw new SignInRequired(what);
  return ctx;
}
