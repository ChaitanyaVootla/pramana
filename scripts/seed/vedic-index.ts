/**
 * Proposes "The Vedic period" era page THROUGH MCP, as the agent acting for
 * the local user: captures the source texts, creates the sources, entities
 * (from Wikidata), glossary terms, excerpts, claims, citations and relations,
 * and the page with its atlas spec (places only). The page's subject is the
 * existing period entity "vedic-period" (Q215262).
 *
 * The page links claims on the Indus page (the Sarasvatī, the Rakhigarhi
 * genome, the absence of a destruction layer). They are found on the applied
 * Indus page by their opening words, or, if the Indus changeset is still
 * pending, by their refs in it (and this changeset depends on it).
 *
 *   pnpm tsx scripts/seed/vedic-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { PAGE_SLUG as INDUS_SLUG } from "./indus";
import { captureAll, entityOps, EXCERPTS, INDUS_CLAIMS, PAGE_SLUG, vedicOps, vedicPage, type IndusClaim } from "./vedic";

const TITLE = "The Vedic period (c. 1500–500 BCE): page, sources and entities";
const INDUS_TITLE = "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities";

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

  // Claims on the Indus page this page links to.
  const X = {} as Record<IndusClaim, string>;
  let giosanSource = "@s_giosan";
  const dependsOn: string[] = [];
  if (overview.pages.some((p) => p.slug === INDUS_SLUG)) {
    const indus = await mcp.call<{
      claims: Record<string, { id: string; text: string; citations: { excerpt: { source: { id: string; title: string } } }[] }>;
    }>("get_page", { page: INDUS_SLUG, format: "json" });
    const giosan = Object.values(indus.claims)
      .flatMap((c) => c.citations.map((cit) => cit.excerpt.source))
      .find((src) => src.title.startsWith("Fluvial landscapes of the Harappan civilization"));
    if (!giosan) throw new Error("Giosan et al. 2012 is not cited on the Indus page");
    giosanSource = giosan.id;
    for (const [ref, prefix] of Object.entries(INDUS_CLAIMS) as [IndusClaim, string][]) {
      const found = Object.values(indus.claims).filter((c) => c.text.startsWith(prefix));
      if (found.length !== 1) throw new Error(`${found.length} claims on the Indus page start “${prefix}”`);
      X[ref] = found[0]!.id;
    }
  } else {
    const rows = await mcp.call<{ id: string; title: string }[]>("list_changesets", { status: ["proposed"], limit: 200 });
    const indusCs = rows.find((c) => c.title === INDUS_TITLE);
    if (!indusCs) throw new Error("The Indus page is neither applied nor pending; propose it first (indus-index.ts).");
    dependsOn.push(indusCs.id);
    for (const ref of Object.keys(INDUS_CLAIMS) as IndusClaim[]) X[ref] = `@${ref}`;
  }

  console.log("Capturing source texts…");
  const snaps = await captureAll(mcp);

  console.log("Checking Wikidata matches and building entities…");
  const ents = await entityOps(mcp);
  for (const r of ents.reused) console.log(`  reusing ${r}`);

  const ops = [...ents.ops, ...vedicOps(snaps, ents.ref, giosanSource), vedicPage(ents.ref, X)];
  const main = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      `A novice-first era page on the Vedic period, c. 1500–500 BCE, in nine chapters plus “Often said”, with ${EXCERPTS.length} quoted excerpts checked against snapshots captured here. Its subject is the existing period entity vedic-period (Q215262).`,
      "Texts (public domain): Griffith's Ṛgveda (2nd ed., 1896–97), Eggeling's Śatapatha Brāhmaṇa (SBE 12, 26), Max Müller's Upaniṣads (SBE 1, 15). Scholarship, quoted as evidence of what was argued and when: William Jones (1786, in his Works, 1799), Max Müller (1888, 1891), Macdonell (1900), Tilak (1903), Jacobi (1909) on the Mitanni gods, Ambedkar (1946; probably in US copyright, quoted in single sentences).",
      "The question of where the Indo-Aryan languages came from is presented with evidence on both sides: Narasimhan et al. 2019 (ancient DNA; quoted briefly) and Koenraad Elst's statement of the Out of India case (Swarajya, 2023; quoted briefly), with Wikipedia (pinned revisions, tertiary) for the state of scholarship. Assessments are editorial and explained in each note: Out of India is marked weak because the genetic and linguistic evidence is against it; the absence of any conquest is common ground.",
      "Giosan et al. 2012 is the source already created for the Indus page, not a duplicate. Wikipedia is also used for modern dates, Painted Grey Ware and the Kuru realm, each flagged. The Sarasvatī identification is not argued again: the page links the Indus page's claims (Ṛgveda 7.95, Oldham 1893), and its genome and destruction-layer claims.",
      "Entities from Wikidata with QIDs: Vedic texts, the Battle of the Ten Kings, Kuru, Pañcāla, Videha, Mitanni, Painted Grey Ware, rivers (no coordinates), Kurukṣetra, Hastinapur and Ahichchhatra (coordinates from Wikidata), and people from Sudās and Yājñavalkya to Max Müller, Tilak and Ambedkar (reused if already present). Twelve glossary terms.",
      "Atlas: no borders exist for 1700–601 BCE in Cliopatria, so the spec has no focus polity and shows places only; three stops, each dated by a claim.",
    ].join("\n\n"),
    dependsOn: [...new Set([...dependsOn, ...ents.dependsOn])],
    ops,
  });
  summarize("vedic", main);
  await finish(mcp, flags, [main]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
