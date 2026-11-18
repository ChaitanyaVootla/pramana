/**
 * Proposes "The independence movement" era page THROUGH MCP, as the agent
 * acting for the local user: captures the source texts, creates the sources,
 * entities (from Wikidata, with its known errors corrected), glossary terms,
 * excerpts, claims, citations and relations, and the page; then a small
 * second changeset adds the movement to the overview's timeline.
 *
 *   pnpm tsx scripts/seed/independence-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the reports, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { BlockInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { captureAll, entityOps, independenceOps, independencePage } from "./independence";

const TITLE = "The independence movement (1857–1947): page, sources and entities";
const OVERVIEW_TITLE = "Overview: add the independence movement to the timeline";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  if (overview.pages.some((p) => p.slug === "independence-movement")) {
    console.log("The page already exists. Nothing to do.");
    process.exit(0);
  }
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }

  console.log("Capturing source texts…");
  const snaps = await captureAll(mcp);

  console.log("Checking Wikidata matches and building entities…");
  const ents = await entityOps(mcp, {});
  for (const r of ents.reused) console.log(`  reusing ${r}`);

  const ops = [...ents.ops, ...independenceOps(snaps, ents.ref), independencePage(ents.ref)];
  const main = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "A novice-first era page on the independence movement, c. 1857–1947, built from a source pack whose 93 candidate quotes were machine-checked against the same texts captured here.",
      "Primary sources: Naoroji (1901), Hind Swaraj (1909/1921), Savarkar (1909), Malleson (1891), Marx's Tribune articles (1857), Hansard (1857, 1946, 1947), the Congress compilation of 1909, the Montagu–Chelmsford Report (1918), the Hunter Report and the Congress Punjab inquiry (1920), Young India (1924), Bhagat Singh's statement (1929, Wikisource), the Indian Annual Registers (1930, 1940, 1942), Ambedkar (1936/45) and the Indian Independence Act 1947 (validated Wikisource transcription).",
      "Copyright is recorded per source: Savarkar 1909 is not yet public domain in India (until 1 Jan 2027); Ambedkar and the 1940/1942 Registers are probably not public domain in the US. Quotes from them are one sentence each.",
      "Wikipedia (pinned revisions) is used only for a few dates, the scale of the Bengal famine and of Partition, and the historians' view of the INA trials; the books it cites are added by page only (Talbot & Singh 2009, Maharatna 1996, Bose & Jalal 2004, Sarkar 1983).",
      "Wikidata errors corrected rather than imported: the movement is framed c. 1857–1947 (Wikidata: from 1757); Chauri Chaura is dated 4 Feb 1922 (Wikidata: 5 Feb, described as a train accident); Wikidata's Mangal Pandey description and the British Raj point are not used; Ambedkar gets an English label.",
      "Dropped from the pack to stay near the 30–45 claim target: the tertiary-only framing claims (movement span, “many fought for the British”, Dalrymple, British scholars on the naval mutiny, the inevitability of Partition), Marx's book title, Naoroji on English education and on trade, the Dharasana raid, Gandhi on the mutiny (only via Wikipedia), and Savarkar's swadharma passage.",
    ].join("\n\n"),
    dependsOn: ents.dependsOn,
    ops,
  });
  const counts = summarize("independence", main);

  // The overview: add the movement to the timeline and the list of ages.
  const ov = await mcp.call<{ page: { version: number; blocks: BlockInput[] } }>("get_page", {
    page: "ages-of-indian-history",
    format: "json",
  });
  const movement = ents.ref.movement!;
  const blocks = ov.page.blocks.map((b) => {
    if (b.type === "viz" && b.viz.kind === "timeline" && b.viz.entityIds && !b.viz.entityIds.includes(movement))
      return { ...b, viz: { ...b.viz, entityIds: [...b.viz.entityIds, movement] } };
    if (b.type === "entities" && !b.entityIds.includes(movement))
      return { ...b, entityIds: [...b.entityIds, movement] };
    return b;
  });
  const side = await mcp.call<Proposal>("propose_changes", {
    title: OVERVIEW_TITLE,
    rationale: "Adds the Indian independence movement (c. 1857–1947) to the overview's timeline and list, so its new page can be reached from the spine. Depends on the independence changeset, which creates the entity.",
    dependsOn: [main.id],
    ops: [{ op: "update_page", page: "ages-of-indian-history", baseVersion: ov.page.version, set: { blocks } }],
  });
  summarize("overview", side);
  console.log(`quote checks: ${JSON.stringify(counts)}`);
  await finish(mcp, flags, [main, side]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
