/**
 * Proposes "The Gupta Empire" era page THROUGH MCP, as the agent acting for
 * the local user: captures the source texts, creates the sources, entities
 * (from Wikidata, with curated descriptions and dates), glossary terms,
 * excerpts, claims, citations and relations, and the page with its spec.
 *
 * The overview needs no change: the Gupta Empire is already one of its ages,
 * and an age links to its page as soon as the page exists.
 *
 *   pnpm tsx scripts/seed/gupta-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { captureAll, entityOps, guptaOps, guptaPage } from "./gupta";

const TITLE = "The Gupta Empire (c. 320–550 CE): page, sources and entities";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  if (overview.pages.some((p) => p.slug === "gupta-empire")) {
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

  const ops = [...ents.ops, ...guptaOps(snaps, ents.ref), guptaPage(ents.ref)];
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "A novice-first era page on the Gupta Empire, c. 320–550 CE: nine chapters, “You may already know”, “Meanwhile, around the Gupta lands”, three debates, five misconceptions and fourteen glossary terms, with an atlas spec (the Gupta Empire's Cliopatria borders with the Vākāṭakas, Western Satraps, Kidarites and Pallavas, 250–600 CE, stops tied to claims). Every quote was machine-checked against the same texts captured here before proposing.",
      "Primary sources, all public domain: Fleet's Corpus Inscriptionum Indicarum III (1888) for some twenty Gupta, Hūṇa, Aulikara and Vākāṭaka inscriptions (Allahabad, Udayagiri, Sanchi, Mehrauli, Mandsaur, Bhitari, Junāgaḍh, Kahaum, Indor, Eran, Gwalior, Siwani); Legge's Faxian (1886); Pargiter's Purāṇa text (1913); Clark's Āryabhaṭīya (1930, public domain in the US since 1 January 2026); Ryder's Kālidāsa (1912); Burgess and Indraji's Ajanta inscriptions (1881); Cosmas (McCrindle 1897), Procopius (Dewing 1914) and Xuanzang (Beal 1884) for the neighbours.",
      "The “golden age” is treated as a historiographical claim: Vincent Smith (1904, 1914, 1919) and E. B. Havell (1918) are quoted as the makers of the label, with the modern dispute (Jha 2002, Pletcher 2011, via Wikipedia) and the page's own primary evidence (Faxian on the Chandalas, the Hūṇa wars, the Eran satī memorial, royal eulogies) set against it in a debate. Smith is tagged colonial_orientalist.",
      "Wikipedia (pinned revisions, tertiary) supplies modern positions only: the identification of the iron pillar's Chandra with Chandragupta II, Nālandā's founding and its doubts, Ajanta's chronology, the Alchon Huns, reign dates, and the end c. 550. The modern books it cites (Agrawal, T. R. Sharma, Jha, Pletcher, Spink, Dutt, Rezakhani, Upinder Singh, Kulke & Rothermund) are added by page only and were not read.",
      "Where Fleet's 1888 conclusions have been overturned, the page says so rather than relying on them: his dating of the Vākāṭakas to c. 680–700 is recorded as refuted, and his view of the iron pillar's Chandra is one position in the debate. Al-Bīrūnī's tradition about the era is recorded with a note. Fleet's OCR is quoted with light corrections; one quote keeps the OCR's spelling because the corrected form matched below 95%.",
      "Entities: rulers get reign spans with their basis (inscriptional years and conventional dates); Wikidata life dates for the Gupta kings are century-precision and are not used; Wikidata's aliases are not imported (they are mostly noise); coordinates come from Wikidata only. Wikidata's description of Āryabhaṭa (“formulated zero”) is not used; it is a misconception on the page. The Gupta Empire entity already exists and is linked to the new entities; ten existing entities (Pāṭaliputra, Ujjain, Sanchi, Sarnath, Girnar, the Vākāṭakas, Western Satraps, Kidarites, Pallavas, Kushans) are linked to it too.",
    ].join("\n\n"),
    dependsOn: ents.dependsOn,
    ops,
  });
  const counts = summarize("gupta", proposal);
  console.log(`quote checks: ${JSON.stringify(counts)}`);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
