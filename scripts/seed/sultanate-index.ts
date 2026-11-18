/**
 * Proposes "The Delhi Sultanate" era page THROUGH MCP, as the agent acting for
 * the local user: captures the source texts, creates the sources, entities
 * (from Wikidata; the five dynasties are reused from the borders import),
 * glossary terms, excerpts, claims, citations and relations, and the page with
 * its atlas spec. The page's subject is the existing polity entity
 * "delhi-sultanate" (Q229411).
 *
 *   pnpm tsx scripts/seed/sultanate-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { captureAll, entityOps, EXCERPTS, PAGE_SLUG, sultanateOps, sultanatePage } from "./sultanate";

const TITLE = "The Delhi Sultanate (1206–1526): page, sources and entities";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  if (overview.pages.some((p) => p.slug === PAGE_SLUG)) {
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
  const ents = await entityOps(mcp);
  for (const r of ents.reused) console.log(`  reusing ${r}`);

  const ops = [...ents.ops, ...sultanateOps(snaps, ents.ref), sultanatePage(ents.ref)];
  const main = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      `A novice-first era page on the Delhi Sultanate, 1206–1526, in nine chapters plus “Often said”, each with a brief, with ${EXCERPTS.length} quoted excerpts checked against snapshots captured here. Its subject is the existing polity entity delhi-sultanate (Q229411).`,
      "Primary sources (public domain): Elliot and Dowson vols I–III (1867–71) for Minhāj, Baranī, Amīr Khusrau, ʿAfīf, Fīrūz Shāh's Futūḥāt and the Malfūẓāt-i Tīmūrī, with Elliot's own preface as evidence of the selection's purpose; Ibn Baṭṭūṭa in Lee's translation (1829; Gibb 1929 is not used, being in copyright in India and the UK); Grierson's Padumāwatī (1911); Tagore and Underhill's Kabir (1915); the Qutb inscriptions as translated in Page's ASI memoir (1926). Secondary (public domain): Thomas's coin catalogue (1871), Lane-Poole (1903), Sewell (1900).",
      "Modern work is quoted briefly: Eaton on temple desecration (Frontline, 2000), pasted from the PDF with its provenance in the snapshot note; UNESCO on the Qutb (CC BY-SA IGO); Wikipedia (pinned revisions, tertiary) for the dynasties' dates, the Mamluk families, Panipat, the Padmini question and Goel's lists.",
      "Debates: Muḥammad bin Tughluq (Baranī's ruin vs Lane-Poole's man of ideas, checked against the coins); temple desecration (Eaton's ~80 attested cases vs Goel's ~2,000 sites), with the primary evidence (the Qutb inscription, Fīrūz Shāh's own account). Misconceptions: one Slave dynasty; Elliot and Dowson as neutral; the mad sultan; Padmini as documented history.",
      "Entities from Wikidata with QIDs; the five dynasties, Vijayanagara, the Bahmani Sultanate, the Timurid Empire and Delhi are reused. Coordinates from Wikidata for buildings and places only. The atlas focuses the five dynasties (Cliopatria has no aggregate Sultanate), 1200–1530, with six stops dated by claims.",
    ].join("\n\n"),
    dependsOn: ents.dependsOn,
    ops,
  });
  summarize("sultanate", main);
  await finish(mcp, flags, [main]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
