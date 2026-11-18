/**
 * Maintenance: add the loose spellings (see looseSpelling in
 * packages/services/src/util.ts) to the stored search text of every entity,
 * claim, page, source and media record, after a change to search folding.
 * Search text is derived from the content and the content is not changed, so
 * this is recorded as one system event rather than as content changes.
 * Idempotent: a second run changes nothing and records nothing.
 *
 *   pnpm tsx scripts/recompute-search.ts
 */
import { claims, closeDb, entities, getDb, media, pages, sources } from "@pramana/db";
import { recordEvent, systemContext, withLooseWords } from "@pramana/services";
import { eq } from "drizzle-orm";

const db = getDb();
const counts: Record<string, number> = {};
for (const [name, table] of [
  ["entities", entities],
  ["claims", claims],
  ["pages", pages],
  ["sources", sources],
  ["media", media],
] as const) {
  counts[name] = 0;
  for (const row of await db.select({ id: table.id, searchText: table.searchText }).from(table)) {
    const next = withLooseWords(row.searchText ?? "");
    if (next === (row.searchText ?? "")) continue;
    await db.update(table).set({ searchText: next }).where(eq(table.id, row.id));
    counts[name]++;
  }
}
const changed = Object.values(counts).reduce((a, b) => a + b, 0);
if (changed) {
  const ctx = await systemContext("maintenance", "system");
  await recordEvent(db, ctx, {
    action: "maintenance.search_recomputed",
    data: { rows: counts, reason: "search folding: loose ASCII spellings of IAST (sh, ch, ri, doubled vowels)" },
  });
}
console.log(`search text updated: ${JSON.stringify(counts)}`);
await closeDb();
