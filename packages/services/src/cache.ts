import { events, getDb } from "@pramana/db";
import { sql } from "drizzle-orm";

/**
 * Reads that depend only on stored content (a page view, the dated entities),
 * kept between requests until anything is written.
 *
 * The version is the number of audit events that can change content. The log
 * is append-only and every write through the services records an event, so the
 * count moves on every commit. (The newest event id would not: a long approval
 * creates its events early and commits late, after events with later ids are
 * already visible.) A learner's own events (reading a part, answering, review
 * cards, notes, their canvases and personal page views) are not counted: they
 * change no content, and reading a page records them as you scroll.
 * The version is read before the value is computed, so a cached value is
 * never older than its version. Entries also expire after a few minutes, for
 * writes made outside the services (a migration, SQL run by hand).
 *
 * Values are copied on the way out, so callers may change what they get.
 * Concurrent calls for the same key and version share one computation.
 * `PRAMANA_CACHE=off` turns caching off.
 */

const MAX_AGE_MS = 5 * 60_000;
const MAX_ENTRIES = 500;

/** Event kinds (the action's first word) that record a learner's own activity, not content. */
const LEARNER_EVENTS = ["card", "cards", "guess", "check", "belief", "chapter", "first_steps", "note", "canvas", "view"];

let last: { total: number; content: number } | null = null;

export async function contentVersion(): Promise<number> {
  const db = getDb();
  // Cheap first: no new events at all means no new content events.
  const [now] = await db.select({ total: sql<number>`count(*)::int` }).from(events);
  if (last && last.total === now!.total) return last.content;
  // Both counts from one snapshot, so the pair stays true for as long as the total does.
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      content: sql<number>`(count(*) filter (where split_part(${events.action}, '.', 1) <> all (${`{${LEARNER_EVENTS.join(",")}}`}::text[])))::int`,
    })
    .from(events);
  last = row!;
  return row!.content;
}

interface Entry<T> {
  version: number;
  at: number;
  value: Promise<T>;
}

export function versionedCache<A extends unknown[], T>(
  keyOf: (...args: A) => string,
  load: (...args: A) => Promise<T>,
  options: { version?: () => Promise<number>; maxAgeMs?: number } = {},
): (...args: A) => Promise<T> {
  const versionOf = options.version ?? contentVersion;
  const maxAge = options.maxAgeMs ?? MAX_AGE_MS;
  // Per module instance: reloading the module in development starts afresh.
  const entries = new Map<string, Entry<T>>();
  return async (...args: A): Promise<T> => {
    if (process.env.PRAMANA_CACHE === "off") return load(...args);
    const version = await versionOf();
    const key = keyOf(...args);
    const now = Date.now();
    let entry = entries.get(key);
    if (!entry || entry.version !== version || now - entry.at > maxAge) {
      const value = load(...args);
      entry = { version, at: now, value };
      entries.delete(key);
      entries.set(key, entry);
      if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
      // A failure is not kept: the next call tries again.
      value.catch(() => {
        if (entries.get(key)?.value === value) entries.delete(key);
      });
    }
    return structuredClone(await entry.value);
  };
}
