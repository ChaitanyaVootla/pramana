import { changesets, entities, getDb } from "@pramana/db";
import { eq, inArray } from "drizzle-orm";

export type WikidataMatch =
  | { status: "existing"; id: string; slug: string; label: string; kind: string }
  | {
      status: "pending";
      id: string;
      slug: string | null;
      label: string;
      kind: string;
      changesetId: string;
      changesetTitle: string;
    };

/**
 * Which Wikidata items already have an entity, applied or proposed in a pending
 * changeset. Importers use it to avoid duplicates: link to an existing entity,
 * or depend on the pending changeset that creates it.
 */
export async function entitiesByWikidata(qids: string[]): Promise<Record<string, WikidataMatch>> {
  const wanted = [...new Set(qids.filter((q) => /^Q\d+$/.test(q)))];
  const out: Record<string, WikidataMatch> = {};
  if (!wanted.length) return out;
  const db = getDb();
  const rows = await db
    .select({ id: entities.id, slug: entities.slug, label: entities.label, kind: entities.kind, qid: entities.wikidataId })
    .from(entities)
    .where(inArray(entities.wikidataId, wanted));
  for (const r of rows) out[r.qid!] = { status: "existing", id: r.id, slug: r.slug, label: r.label, kind: r.kind };
  const pending = await db.select().from(changesets).where(eq(changesets.status, "proposed"));
  const set = new Set(wanted);
  for (const cs of pending) {
    for (const op of cs.ops as ({ op: string; id?: string } & Record<string, unknown>)[]) {
      const qid =
        op.op === "create_entity"
          ? (op.wikidataId as string | undefined)
          : op.op === "update_entity"
            ? ((op.set as { wikidataId?: string } | undefined)?.wikidataId)
            : undefined;
      if (!qid || !set.has(qid) || out[qid]) continue;
      if (op.op === "create_entity" && op.id) {
        out[qid] = {
          status: "pending",
          id: op.id,
          slug: (op.slug as string | undefined) ?? null,
          label: op.label as string,
          kind: op.kind as string,
          changesetId: cs.id,
          changesetTitle: cs.title,
        };
      } else if (op.op === "update_entity") {
        // A pending edit gives an existing entity this QID; `id` is the entity reference (id or slug).
        const set = op.set as { label?: string; kind?: string };
        out[qid] = {
          status: "pending",
          id: op.entity as string,
          slug: null,
          label: set.label ?? (op.entity as string),
          kind: set.kind ?? "",
          changesetId: cs.id,
          changesetTitle: cs.title,
        };
      }
    }
  }
  return out;
}
