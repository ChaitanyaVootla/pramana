import { citations, excerpts, getDb, pages, sources } from "@pramana/db";
import { eq, sql } from "drizzle-orm";

/** An excerpt no claim cites, with the excerpts that hold exactly the same evidence. */
export interface UncitedExcerpt {
  id: string;
  source: { id: string; title: string };
  snapshotId: string | null;
  quote: string | null;
  locator: unknown;
  note: string | null;
  createdAt: Date;
  /** Pages that show it (a quotation block or an excerpt: link); such an excerpt cannot be removed. */
  onPages: string[];
  /** Other excerpts with the same source, snapshot, quote, locator, original text and note, and how often each is cited. */
  duplicates: { id: string; citations: number }[];
}

/** What makes two excerpts the same evidence: everything but the id, the verification and the time. */
function contentKey(e: typeof excerpts.$inferSelect): string {
  return JSON.stringify([e.sourceId, e.snapshotId, e.quote, e.locator, e.original, e.note]);
}

/**
 * Excerpts that no claim cites, oldest first. Duplicates are found by
 * comparing every field that carries evidence, so a copy with another
 * locator or note is not a duplicate.
 */
export async function uncitedExcerpts(): Promise<UncitedExcerpt[]> {
  const db = getDb();
  const [rows, counts, pageRows] = await Promise.all([
    db
      .select({ excerpt: excerpts, sourceTitle: sources.title })
      .from(excerpts)
      .innerJoin(sources, eq(sources.id, excerpts.sourceId)),
    db
      .select({ excerptId: citations.excerptId, n: sql<number>`count(*)::int` })
      .from(citations)
      .groupBy(citations.excerptId),
    db.select({ slug: pages.slug, blocks: sql<string>`${pages.blocks}::text` }).from(pages),
  ]);
  const cited = new Map(counts.map((c) => [c.excerptId, c.n]));
  const byKey = new Map<string, string[]>();
  for (const { excerpt } of rows) {
    const key = contentKey(excerpt);
    byKey.set(key, [...(byKey.get(key) ?? []), excerpt.id]);
  }
  return rows
    .filter(({ excerpt }) => !cited.has(excerpt.id))
    .sort((a, b) => (a.excerpt.id < b.excerpt.id ? -1 : 1))
    .map(({ excerpt: e, sourceTitle }) => ({
      id: e.id,
      source: { id: e.sourceId, title: sourceTitle },
      snapshotId: e.snapshotId,
      quote: e.quote,
      locator: e.locator,
      note: e.note,
      createdAt: e.createdAt,
      onPages: pageRows.filter((p) => p.blocks.includes(e.id)).map((p) => p.slug),
      duplicates: (byKey.get(contentKey(e)) ?? [])
        .filter((id) => id !== e.id)
        .map((id) => ({ id, citations: cited.get(id) ?? 0 })),
    }));
}
