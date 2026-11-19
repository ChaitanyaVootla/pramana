/**
 * Proposes "Drought and famine in early India" (a theme page, before 1206)
 * THROUGH MCP, as the agent acting for the local user: captures the source
 * texts, finds or creates the sources, entities (from Wikidata) and glossary
 * terms, and creates the excerpts, claims, citations, relations and the page,
 * whose spine is a tracks block of the same cells famineCells() exports.
 * Idempotent: once the page exists (or the changeset is pending) it proposes
 * nothing.
 *
 *   pnpm tsx scripts/seed/famine-early-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --cells             # once applied: print the cross-age cells resolved on this database
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { CLAIMS, contentOps, entityOps, EXCERPTS, famineEarlyPage, PAGE_SLUG, resolveSources } from "./famine-early";
import { famineCells } from "./famine-early-cells";

const TITLE = "Drought and famine in early India (before 1206): theme page, sources and entities";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  if (overview.pages.some((p) => p.slug === PAGE_SLUG)) {
    if (process.argv.includes("--cells")) console.log(JSON.stringify(await famineCells(mcp), null, 1));
    else console.log("The page already exists. Nothing to do.");
    process.exit(0);
  }
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }

  console.log("Capturing source texts and finding sources…");
  const sources = await resolveSources(mcp);
  for (const r of sources.reused) console.log(`  reusing source ${r}`);

  console.log("Checking Wikidata matches and building entities…");
  const ents = await entityOps(mcp);
  for (const r of ents.reused) console.log(`  reusing ${r}`);
  for (const r of ents.created) console.log(`  creating ${r}`);

  const ops = [...ents.ops, ...sources.ops, ...contentOps(sources, ents.ref), famineEarlyPage(ents.ref)];
  const main = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      `A novice-first theme page on food, water, work, drought and famine in early India, from the first farmers to Kalhaṇa's Kashmir, in ten chapters plus “Often said”, each with a brief. Its spine is a tracks block (eight facets by eight ages) whose cells are also exported for the cross-age page (scripts/seed/famine-early-cells.ts). ${CLAIMS.length} claims rest on ${EXCERPTS.length} excerpts, each quote checked against a snapshot captured here.`,
      "Primary sources, public domain: Griffith's Rig Veda (1896–97), Whitney's Atharva Veda (1905), Max Müller's Upaniṣads (SBE 1, 1879), the Vinaya (SBE 17, 1882), Cowell's Jātaka vols I–II (1895), McCrindle's Megasthenes (1877), Shamasastry's Arthaśāstra (1915), Bühler's Manu (SBE 25, 1886), Rice's Inscriptions at Sravana Belgola (1889), Kielhorn's Junāgaḍh inscription of Rudradāman (EI VIII, 1906), Fleet's Gupta inscriptions (CII III, 1888) and his Sohgaura article (JRAS 1907, with Bühler's earlier reading), Legge's Faxian (1886), Beal's Xuanzang (1884), Sachau's al-Bīrūnī (vol. II), the ASI report for 1904–05 (Uttaramerūr), Stein's Rājataraṅgiṇī (1900). Secondary: Smith (1914). Quoted briefly because not yet public domain in the US: Marshall's Mohenjo-daro (1931) and Bhandarkar's Mahāsthān inscription (EI XXI, 1931–32).",
      "Tertiary (pinned Wikipedia revisions, UNESCO): Mehrgarh, Indus agriculture and decline, Mohenjo-daro's wells and “granary”, Dholavira, the 4.2-kiloyear event, the date of Manu. Sources already on the platform are reused when the Internet Archive identifier or Wikipedia revision matches.",
      "Debates kept as data: the Indus decline (drought vs gradual change), Mehrgarh's dating, the Mohenjo-daro “granary”, the Jain twelve-year famine under Chandragupta (Rice, Smith, Fleet), the Sohgaura plate (Bühler vs Fleet). Misconceptions: ancient India never knew famine; a sudden drought ended the Indus cities; Indus state granaries. Legends (Tuñjīna's famine) and late narratives (the Rājāvali-kathe) are labelled as such. Entities from Wikidata with QIDs; coordinates only from Wikidata.",
    ].join("\n\n"),
    dependsOn: ents.dependsOn,
    ops,
  });
  summarize("famine-early", main);
  await finish(mcp, flags, [main]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
