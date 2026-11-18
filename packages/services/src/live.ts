import { getDb, notes } from "@pramana/db";
import { sql } from "drizzle-orm";
import { ownerOf, type ActorContext } from "./context";
import { listNotes, noteOwnedBy, type NoteFilter, type NoteView } from "./notes";
import { getPresence, PRESENCE_WINDOW_MS, type Presence } from "./presence";

/**
 * What the live event stream (/api/events) sends besides database
 * notifications, so open pages need no polling and no fetch of their own.
 */

/**
 * A version of the viewer's notes: it changes whenever one of them is posted,
 * changed (its status) or removed. A page compares it with the version its
 * notes were loaded at, to know whether it missed anything while the stream
 * was down. Another learner's notes never move it.
 */
export async function notesVersion(viewer: ActorContext): Promise<string> {
  // xmin is the transaction that last wrote a row, so an update moves the maximum too.
  const [row] = await getDb()
    .select({ v: sql<string>`count(*)::text || '-' || coalesce(max(xmin::text::bigint), 0)::text` })
    .from(notes)
    .where(noteOwnedBy(ownerOf(viewer)));
  return row!.v;
}

/** The viewer's notes with the version they were read at (read first, so the notes are never older than it). */
export async function notesWithVersion(
  viewer: ActorContext,
  filter: NoteFilter,
): Promise<{ notes: NoteView[]; version: string }> {
  const version = await notesVersion(viewer);
  return { notes: await listNotes(viewer, filter), version };
}

/**
 * Whether a database notification goes to this reader's stream: it names no owner (content, such as
 * changesets), or it is the reader's own (their notes, AI sessions, canvases and views).
 */
export function forReader(payload: string, reader: string | null): boolean {
  let owner: unknown;
  try {
    owner = (JSON.parse(payload) as { owner?: unknown }).owner;
  } catch {
    return false;
  }
  return owner === undefined || (reader !== null && owner === reader);
}

type PresenceListener = (presence: Presence) => void;

interface Feed {
  listeners: Set<PresenceListener>;
  current: Presence | null;
  pending: Promise<Presence> | null;
  debounce: ReturnType<typeof setTimeout> | null;
  expiry: ReturnType<typeof setTimeout> | null;
}

// One feed per human, shared by every open stream in this process (a module reload starts afresh).
const feeds = new Map<string, Feed>();

function feedFor(actorId: string): Feed {
  let feed = feeds.get(actorId);
  if (!feed) {
    feed = { listeners: new Set(), current: null, pending: null, debounce: null, expiry: null };
    feeds.set(actorId, feed);
  }
  return feed;
}

/** A quiet session drops out without any write: look again the moment the first one would. */
function scheduleExpiry(actorId: string, feed: Feed): void {
  if (feed.expiry) clearTimeout(feed.expiry);
  feed.expiry = null;
  const lastSeen = (feed.current?.sessions ?? []).map((s) => new Date(s.lastSeenAt).getTime());
  if (!lastSeen.length || !feed.listeners.size) return;
  const at = Math.min(...lastSeen) + PRESENCE_WINDOW_MS + 1000;
  feed.expiry = setTimeout(() => void refresh(actorId, feed), Math.max(1000, at - Date.now()));
}

async function refresh(actorId: string, feed: Feed): Promise<Presence> {
  feed.pending ??= getPresence(actorId).finally(() => {
    feed.pending = null;
  });
  const presence = await feed.pending;
  const changed = feed.current !== null && JSON.stringify(presence) !== JSON.stringify(feed.current);
  feed.current = presence;
  scheduleExpiry(actorId, feed);
  if (changed) for (const l of feed.listeners) l(presence);
  return presence;
}

/**
 * Follows the presence of a human's AI sessions: `onChange` is called with
 * the new state whenever it changes (an agent session starts, is seen, ends,
 * or goes quiet). Returns the current state and an unsubscribe function.
 */
export async function followPresence(
  actorId: string,
  onChange: PresenceListener,
): Promise<{ presence: Presence; stop: () => void }> {
  const feed = feedFor(actorId);
  const presence = feed.listeners.size && feed.current ? feed.current : await refresh(actorId, feed);
  feed.listeners.add(onChange);
  scheduleExpiry(actorId, feed);
  return {
    presence,
    stop: () => {
      feed.listeners.delete(onChange);
      if (!feed.listeners.size) {
        if (feed.expiry) clearTimeout(feed.expiry);
        if (feed.debounce) clearTimeout(feed.debounce);
        feeds.delete(actorId);
      }
    },
  };
}

/** A session was written (an agent call touched it): look again once the burst settles. */
export function sessionsChanged(): void {
  for (const [actorId, feed] of feeds) {
    if (feed.debounce) clearTimeout(feed.debounce);
    feed.debounce = setTimeout(() => {
      feed.debounce = null;
      void refresh(actorId, feed);
    }, 300);
  }
}
