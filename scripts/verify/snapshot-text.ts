/**
 * Prints a character range of a stored snapshot, for reading more context
 * around an excerpt than support-dump.ts includes. Read-only.
 *
 *   pnpm tsx scripts/verify/snapshot-text.ts <snapshotId> <start> <length>
 */
import { closeDb } from "@pramana/db";
import { readSnapshotRange } from "@pramana/services";

const [id, start, length] = process.argv.slice(2);
if (!id || !start || !length) {
  console.error("usage: snapshot-text.ts <snapshotId> <start> <length>");
  process.exit(1);
}
try {
  const r = await readSnapshotRange(id, Number(start), Number(length));
  console.log(`[${r.start}–${r.end} of ${r.total}] ${r.snapshot.title ?? ""}\n`);
  console.log(r.text);
} finally {
  await closeDb();
}
