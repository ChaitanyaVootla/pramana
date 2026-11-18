import { entities, entityLinks, getDb } from "@pramana/db";
import { and, asc, inArray } from "drizzle-orm";
import { loadEntityCards, type EntityCard } from "./queries";
import { versionedCache } from "./cache";

/**
 * Browsing lists: every person, place, period… of given kinds, ordered by date
 * (undated last, then by name). Used by the People and Places pages.
 */
/** Entities of the given kinds as cards; cached until content changes (see cache.ts). */
export const listEntities: (kinds: string[], limit?: number) => Promise<EntityCard[]> = versionedCache(
  (kinds: string[], limit = 2000) => JSON.stringify([kinds, limit]),
  loadEntities,
);

async function loadEntities(kinds: string[], limit = 2000): Promise<EntityCard[]> {
  const db = getDb();
  const rows = await db
    .select({ id: entities.id })
    .from(entities)
    .where(inArray(entities.kind, kinds))
    .orderBy(asc(entities.sortStart), asc(entities.label))
    .limit(Math.min(limit, 5000));
  const cards = await loadEntityCards(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => cards.get(r.id)).filter((c): c is EntityCard => Boolean(c));
}

/**
 * The states, ages and cultures each entity is linked to (it ruled them, was
 * part of them, or is related to them), for grouping people by where they
 * belong rather than by date alone. Only outgoing links are read.
 */
export async function entityAffiliations(
  ids: string[],
  types: string[] = ["ruled", "member_of", "part_of", "related_to"],
): Promise<Record<string, { id: string; kind: string; label: string }[]>> {
  if (!ids.length) return {};
  const db = getDb();
  const rows = await db
    .select({ from: entityLinks.fromId, to: entityLinks.toId })
    .from(entityLinks)
    .where(and(inArray(entityLinks.fromId, ids), inArray(entityLinks.type, types)));
  const targets = rows.length
    ? await db
        .select({ id: entities.id, kind: entities.kind, label: entities.label })
        .from(entities)
        .where(inArray(entities.id, [...new Set(rows.map((r) => r.to))]))
    : [];
  const byId = new Map(targets.map((t) => [t.id, t]));
  const out: Record<string, { id: string; kind: string; label: string }[]> = {};
  for (const r of rows) {
    const t = byId.get(r.to);
    if (!t || !["polity", "period", "culture", "group"].includes(t.kind)) continue;
    (out[r.from] ??= []).push(t);
  }
  return out;
}
