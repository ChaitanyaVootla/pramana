/**
 * Proposes "The Indus civilisation" era page THROUGH MCP, as the agent acting
 * for the local user: captures the source texts, creates the sources, entities
 * (from Wikidata), glossary terms, excerpts, claims, citations and relations,
 * and the page with its atlas spec. The page's subject is the existing
 * culture entity "harappan-civilisation" (Q42534); the overview already lists
 * it, so the overview is not changed.
 *
 *   pnpm tsx scripts/seed/indus-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { captureAll, entityOps, EXCERPTS, indusOps, indusPage, PAGE_SLUG } from "./indus";

const TITLE = "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities";

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

  const ops = [...ents.ops, ...indusOps(snaps, ents.ref), indusPage(ents.ref)];
  const main = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      `A novice-first era page on the Indus (Harappan) civilisation, in nine chapters plus “Often said”, with ${EXCERPTS.length} quoted excerpts, each checked against a snapshot captured here. The page's subject is the existing culture entity harappan-civilisation (Q42534), not a polity.`,
      "Primary sources (public domain): Masson 1842; Cunningham, ASI Report vol. V (1875); ASI Annual Reports 1923–24, 1924–25 (two scans), 1925–26 (dli.ministry.09389, whose OCR is far better than in.ernet.dli.2015.35492) and 1928–29; Marshall in the Illustrated London News, 20 September 1924; Barton's Royal Inscriptions of Sumer and Akkad (1929) for Sargon and Gudea on Meluhha; Griffith's Rigveda (1897) and Oldham (JRAS 1893) for the Sarasvatī question.",
      "Copyright: Marshall (ed.) 1931, Mackay 1938 and Vats 1940 are not used. Wheeler 1947 (Ancient India 3) is probably in US copyright until 2043 and is quoted in single sentences. Modern work is quoted briefly: Dales 1964, Giosan et al. 2012, Rao et al. 2009, Farmer, Sproat and Witzel 2004 (abstract pasted from the authors' PDF, provenance in the snapshot note), Shinde et al. 2019; Singh et al. 2017, Chatterjee et al. 2019 and Green 2021 are CC BY 4.0; UNESCO descriptions are CC BY-SA 3.0 IGO.",
      "Wikipedia (pinned revisions, tertiary) is used for the conventional dates, the site counts and population estimates, Meluhha's identification and Magan/Dilmun, Sargon's and Gudea's dates, the Great Pyramid's date, the Lothal “dock” debate and the later debate on the Pashupati seal; each such claim says so.",
      "Entities from Wikidata with QIDs: eight sites, the Great Bath (coordinates from Wikidata, approximate, one point per site), the “Priest-King” statue and the “Pashupati” seal (no coordinates: Wikidata's are the museums'), the Indus script, the Indus and Ghaggar-Hakra rivers, Meluhha, Magan, Dilmun, the Akkadian Empire, the Old Kingdom of Egypt, Sargon, Gudea, and seven people. Ten glossary terms. Wikidata's aliases for the Ghaggar-Hakra and Dilmun are replaced by annotated ones.",
      "Misconceptions: the Aryan invasion, a deciphered script, a single empire, the “Priest-King”, a sudden collapse. Debates: the decline, the script, the Ghaggar-Hakra/Sarasvatī, who ruled, the Pashupati seal, the Lothal basin. The atlas spec focuses the culture area (Cliopatria's outline, drawn as a culture area), range 3300–1300 BCE, with five stops each dated by a claim on the page.",
    ].join("\n\n"),
    dependsOn: ents.dependsOn,
    ops,
  });
  summarize("indus", main);
  await finish(mcp, flags, [main]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
