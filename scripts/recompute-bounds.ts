/**
 * Maintenance: recompute the derived date bounds (and sort keys) of every
 * entity and claim from their EDTF values, after a change to the date logic in
 * @pramana/core. The EDTF strings are the source of truth and are not changed,
 * so this is recorded as one system event rather than as content changes.
 *
 *   pnpm tsx scripts/recompute-bounds.ts
 */
import { dateBounds } from "@pramana/core";
import { claims, closeDb, entities, getDb } from "@pramana/db";
import { recordEvent, systemContext } from "@pramana/services";
import { eq } from "drizzle-orm";

const db = getDb();
let changed = 0;
for (const row of await db.select().from(entities)) {
  if (!row.when) continue;
  const bounds = dateBounds(row.when);
  if (JSON.stringify(bounds) === JSON.stringify(row.bounds)) continue;
  await db.update(entities).set({ bounds, sortStart: bounds.startMin, sortEnd: bounds.endMax }).where(eq(entities.id, row.id));
  changed++;
}
for (const row of await db.select().from(claims)) {
  if (!row.when) continue;
  const start = dateBounds(row.when).startMin;
  if (start === row.sortStart) continue;
  await db.update(claims).set({ sortStart: start }).where(eq(claims.id, row.id));
  changed++;
}
const ctx = await systemContext("maintenance", "system");
await recordEvent(db, ctx, { action: "maintenance.bounds_recomputed", data: { rows: changed, reason: "date logic: unknown EDTF ends are no longer open-ended" } });
console.log(`recomputed ${changed} rows`);
await closeDb();
