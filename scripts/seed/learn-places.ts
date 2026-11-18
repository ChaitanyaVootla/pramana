/**
 * Proposes the places that "Tap where X was" questions need and the platform
 * does not have yet, THROUGH MCP: label, description, a few aliases and the
 * coordinates, all read from Wikidata (P625), never typed here. Places that
 * already exist, or are waiting in a pending changeset, are skipped.
 * Run it before scripts/seed/learn-index.ts.
 *
 *   pnpm tsx scripts/seed/learn-places.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import "@pramana/services"; // configures HTTP for Wikidata (contact, cache)
import { getWikidataSummary } from "@pramana/connectors";
import type { ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { PLACES } from "./learn-content";

const TITLE = "Places for map questions, from Wikidata";
const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const known = await mcp.call<Record<string, unknown>>("entities_by_wikidata", { qids: PLACES.map((p) => p.qid) });
  const missing = PLACES.filter((p) => !known[p.qid]);
  if (!missing.length) console.log("  every place is on the platform or pending");
  else if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) console.log(`  "${TITLE}" is already waiting for review`);
  else {
    const ops: ChangeOpInput[] = [];
    for (const p of missing) {
      const item = await getWikidataSummary(p.qid);
      if (!item.coordinates || !item.label) throw new Error(`${p.qid} has no label or coordinates on Wikidata`);
      ops.push({
        op: "create_entity",
        slug: p.slug,
        kind: "place",
        label: item.label,
        ...(item.description ? { description: item.description[0]!.toUpperCase() + item.description.slice(1) + "." } : {}),
        aliases: item.aliases.filter((a) => a.lang === "en" || a.script).slice(0, 6),
        wikidataId: p.qid,
        geo: {
          geometry: { type: "Point", coordinates: [item.coordinates.lon, item.coordinates.lat] },
          certainty: "approximate",
          note: `Coordinates from Wikidata ${p.qid} (P625).`,
        },
      });
    }
    const proposal = await mcp.call<Proposal>("propose_changes", {
      title: TITLE,
      rationale: [
        `Adds ${missing.map((p) => p.slug).join(", ")} for “Tap where X was” questions in the chapter checks (${missing.map((p) => p.why).join("; ")}).`,
        "Label, description, aliases and coordinates are read from Wikidata (CC0) at proposal time; the coordinates are marked approximate, as a city's single point.",
      ].join("\n\n"),
      ops,
    });
    summarize(TITLE, proposal);
    await finish(mcp, flags, [proposal]);
  }
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
