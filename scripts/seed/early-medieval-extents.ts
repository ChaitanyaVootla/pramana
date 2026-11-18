/**
 * Links Cliopatria's "Harsha's Empire" and "Srivijaya" border rows to the
 * polities created by the early medieval page (pushyabhuti-dynasty,
 * srivijaya). Run it once the borders for 551–1205 CE have been approved; the
 * page's own changeset links them only if the borders already exist.
 * Idempotent: rows that are already linked are skipped.
 *
 *   pnpm tsx scripts/seed/early-medieval-extents.ts                    # propose
 *   … --withdraw          # dry run
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { extentOps } from "./early-medieval";

const TITLE = "Borders: link Harṣa's kingdom and Śrīvijaya to their Cliopatria extents";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }
  for (const slug of ["pushyabhuti-dynasty", "srivijaya"]) {
    const found = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: slug }).catch(() => null);
    if (!found?.entity) throw new Error(`entity “${slug}” is not on the platform yet; approve the early medieval page first`);
  }
  const ops = await extentOps(mcp, { harsha_empire: "pushyabhuti-dynasty", srivijaya: "srivijaya" });
  if (!ops.length) {
    console.log("No unlinked Harsha's Empire or Srivijaya extents. Nothing to do.");
    process.exit(0);
  }
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: `Cliopatria's “Harsha's Empire” and “Srivijaya” rows were imported without entities. This links ${ops.length} of them to the polities created by the early medieval page (Wikidata Q28109312, Q234197), so the page's atlas can draw them in focus.`,
    ops,
  });
  summarize("extent links", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
