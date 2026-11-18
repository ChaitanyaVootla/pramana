/**
 * Stronger sources for claims on the Indus page that rested only on tertiary
 * sources (UNESCO, Harappa.com, Wikipedia), THROUGH MCP. Adds new sources and
 * excerpts and cites them; nothing is deleted.
 *
 * Claims are found by their ref in the pending page changeset (main database,
 * before approval: the changeset depends on it) or by the opening words of
 * their text on the applied page (preview). Once the page is applied, two
 * notes that said "only tertiary sources" are brought up to date as well.
 *
 *   pnpm tsx scripts/seed/indus-sources.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Still tertiary-only after this, for want of an open or public-domain source
 * found so far: the date Dholavira was found (1968), the population estimates,
 * and the later scholarly debate on the "Pashupati" seal.
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { PAGE_SLUG } from "./indus";

const TITLE = "The Indus civilisation: secondary and primary sources for claims that rested on tertiary ones";
const PAGE_TITLE = "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities";

const CAPTURES = {
  possehl2006: { kind: "url", url: "https://www.penn.museum/sites/expedition/shu-ilishus-cylinder-seal/" },
  possehl2007: { kind: "url", url: "https://www.penn.museum/sites/expedition/the-middle-asian-interaction-sphere/" },
  uclKhufu: { kind: "url", url: "https://www.ucl.ac.uk/museums-static/digitalegypt/chronology/kingkheops.html" },
  gizaKhufu: { kind: "url", url: "https://giza.fas.harvard.edu/ancientpeople/202/full/" },
  // Already captured for the page; captured again here (content-addressed, so the same snapshot text).
  green: { kind: "url", url: "https://link.springer.com/article/10.1007/s10814-020-09147-9" },
  shinde: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6800651/" },
  masson: { kind: "internet_archive", identifier: "10430709bsb" },
  asi2324: { kind: "internet_archive", identifier: "in.ernet.dli.2015.35513" },
} as const;
type CaptureKey = keyof typeof CAPTURES;

/** Claim refs in the page changeset → the opening words of the claim's text. */
const CLAIMS = {
  c_mjd_grid: "At Mohenjo-daro the buildings of the lower city",
  c_dholavira: "Dholavira, on an island in the salt flats of Kachchh",
  c_sites: "More than a thousand Mature Harappan sites are known",
  c_meluhha_id: "Most scholars identify Meluhha",
  c_magan_dilmun: "Magan, named with Meluhha",
  c_dholavira_trade: "Finds at Dholavira show trade",
  c_beads: "Dholavira had bead workshops",
  c_harappa_living: "Harappa was settled before the Indus cities flourished",
  c_pyramid: "In Egypt, the Great Pyramid of Giza",
  c_sargon_meluhha: "Sargon of Akkad (reigned c. 2334–2279 BCE)",
  c_script_undeciphered: "The Indus script has not been deciphered.",
  m_deciphered: "The Indus script has been deciphered.",
} as const;
type ClaimRef = keyof typeof CLAIMS;

/** Existing sources reused by the new excerpts (refs in the page changeset → title prefix). */
const SOURCES = {
  s_green: "Killing the Priest-King",
  s_shinde: "An Ancient Harappan Genome",
  s_masson: "Narrative of Various Journeys",
  s_asi2324: "Annual Report of the Archaeological Survey of India 1923-24",
} as const;
type SourceRef = keyof typeof SOURCES;

interface Excerpt {
  ref: string;
  source: SourceRef | NewSourceRef;
  snap: CaptureKey;
  quote: string;
  locator: Record<string, string>;
  note?: string;
}
type NewSourceRef = "s_possehl2006" | "s_possehl2007" | "s_ucl_khufu" | "s_giza_khufu";

const EXCERPTS: Excerpt[] = [
  { ref: "x_green_grid", source: "s_green", snap: "green", quote: "These initial large corporate compounds were replaced over time by houses organized along the streets’ grid", locator: { section: "Settlement growth and nucleation (Mohenjo-daro, DK-G area)" } },
  { ref: "x_shinde_planning", source: "s_shinde", snap: "shinde", quote: "one of the first large-scale urban societies of the ancient world, characterized by systematic town planning, elaborate drainage systems", locator: { section: "Introduction" } },
  { ref: "x_green_dho_res", source: "s_green", snap: "green", quote: "The most elevated section of Dholavira lies behind a thick stone wall with a carefully constructed gateway, providing access to a series of deep reservoirs that were cut into the bedrock beneath the site", locator: { section: "Nonresidential architecture" } },
  { ref: "x_green_five", source: "s_green", snap: "green", quote: "Only five sites—Harappa, Rakhigarhi, Mohenjo-daro, Ganweriwala, and Dholavira, one in each region—are typically identified as cities. Many of the hundreds of other reported Indus sites are, in fact, smaller than 30 ha", locator: { section: "Settlement hierarchy" } },
  { ref: "x_possehl06_meluhha", source: "s_possehl2006", snap: "possehl2006", quote: "Meluhha is widely believed to have been the Indus Civilization of the Greater Indus Valley in India and Pakistan (ca. 2500–1900 BC)", locator: { label: "Opening paragraphs" } },
  { ref: "x_possehl06_village", source: "s_possehl2006", snap: "possehl2006", quote: "Based on cuneiform documents from Mesopotamia we know that there was at least one Meluhhan village in Akkad at that time", locator: { label: "Opening paragraphs" } },
  { ref: "x_possehl06_script", source: "s_possehl2006", snap: "possehl2006", quote: "The writing of Meluhha (the Indus script) remains undeciphered, in spite of many claims to the contrary.", locator: { label: "Closing paragraph" } },
  { ref: "x_possehl07_meluhha", source: "s_possehl2007", snap: "possehl2007", quote: "Even farther east, was the Indus civilization of the subcontinent—Meluhha—now in Pakistan and northwest India.", locator: { label: "Section on Dilmun, Magan and Meluhha" } },
  { ref: "x_possehl07_dilmun", source: "s_possehl2007", snap: "possehl2007", quote: "Dilmun was both a Persian Gulf trading center—today’s island nation of Bahrain and the nearby shore of Saudi Arabia", locator: { label: "Section on Dilmun, Magan and Meluhha" } },
  { ref: "x_possehl07_magan", source: "s_possehl2007", snap: "possehl2007", quote: "Magan, to the east of Dilmun, was a land of copper, today home to the Sultanate of Oman and probably some or all of the United Arab Emirates.", locator: { label: "Section on Dilmun, Magan and Meluhha" } },
  { ref: "x_possehl07_sargon", source: "s_possehl2007", snap: "possehl2007", quote: "as in a boast by Sargon the Great (2334–2279 BC) informing us that ships from Meluhha, Magan, and Dilmun docked in the harbor of his capital of Akkad", locator: { label: "Section on Dilmun, Magan and Meluhha" } },
  { ref: "x_green_gulf", source: "s_green", snap: "green", quote: "A great deal of Indus material culture, particularly ceramics, has been identified at coastal sites in Oman and on Bahrain", locator: { section: "Craft specialization and exchange" } },
  { ref: "x_green_dho_crafts", source: "s_green", snap: "green", quote: "Such specialized sites contrast with large settlement centers where many crafts were produced, such as Dholavira", locator: { section: "Craft specialization and exchange" } },
  { ref: "x_masson_village", source: "s_masson", snap: "masson", quote: "When I joined the camp I found it in front of the village and ruinous brick castle.", locator: { volume: "1", page: "452" } },
  { ref: "x_asi24_strata", source: "s_asi2324", snap: "asi2324", quote: "The site of Harappa though manifestly that of a great city covering a vast area and containing many strata of successive buildings", locator: { page: "47", label: "Section II, Exploration: introductory (Marshall)" } },
  { ref: "x_ucl_khufu", source: "s_ucl_khufu", snap: "uclKhufu", quote: "Second king of the Fourth Dynasty (about 2600-2450). Famous for his burial place, the Great Pyramid at Gizeh.", locator: { label: "King Kheops" } },
  { ref: "x_giza_khufu", source: "s_giza_khufu", snap: "gizaKhufu", quote: "Second king of Dynasty 4, son of Snefru. Builder of the Great Pyramid at Giza", locator: { label: "Khufu: remarks" } },
];

const CITES: { claim: ClaimRef; excerpt: string; stance?: "supports" | "qualifies" | "contradicts"; note?: string }[] = [
  { claim: "c_mjd_grid", excerpt: "x_green_grid" },
  { claim: "c_mjd_grid", excerpt: "x_shinde_planning" },
  { claim: "c_dholavira", excerpt: "x_green_dho_res", note: "The stone walls and rock-cut reservoirs; the dates rest on UNESCO." },
  { claim: "c_sites", excerpt: "x_green_five" },
  { claim: "c_meluhha_id", excerpt: "x_possehl06_meluhha" },
  { claim: "c_meluhha_id", excerpt: "x_possehl07_meluhha" },
  { claim: "c_meluhha_id", excerpt: "x_possehl06_village", stance: "supports", note: "Mesopotamian records of a Meluhhan village in Akkad." },
  { claim: "c_magan_dilmun", excerpt: "x_possehl07_magan" },
  { claim: "c_magan_dilmun", excerpt: "x_possehl07_dilmun" },
  { claim: "c_sargon_meluhha", excerpt: "x_possehl07_sargon" },
  { claim: "c_dholavira_trade", excerpt: "x_green_gulf", note: "Indus goods on the coasts of Oman and Bahrain, in general; not Dholavira specifically." },
  { claim: "c_beads", excerpt: "x_green_dho_crafts", note: "Dholavira as a centre of many crafts; the bead workshops rest on UNESCO." },
  { claim: "c_harappa_living", excerpt: "x_asi24_strata", note: "Many layers of building: a long occupation." },
  { claim: "c_harappa_living", excerpt: "x_masson_village", note: "A village beside the mounds in 1826." },
  { claim: "c_pyramid", excerpt: "x_ucl_khufu" },
  { claim: "c_pyramid", excerpt: "x_giza_khufu" },
  { claim: "c_script_undeciphered", excerpt: "x_possehl06_script" },
  { claim: "m_deciphered", excerpt: "x_possehl06_script", stance: "contradicts" },
];

function newSources(): ChangeOpInput[] {
  const web = (url: string) => ({ url });
  return [
    {
      op: "create_source",
      ref: "s_possehl2006",
      kind: "article",
      tier: "secondary",
      csl: { type: "article-magazine", title: "Shu-ilishu's Cylinder Seal", author: [{ family: "Possehl", given: "Gregory L." }], "container-title": "Expedition", volume: "48", issue: "1", issued: { "date-parts": [[2006]] }, URL: CAPTURES.possehl2006.url },
      identifiers: web(CAPTURES.possehl2006.url),
      license: { status: "copyrighted", note: "Penn Museum, Expedition magazine. Quoted briefly." },
      lenses: ["archaeological"],
      note: "By a leading specialist on the Indus civilisation, on the seal of an interpreter of the Meluhhan language.",
    },
    {
      op: "create_source",
      ref: "s_possehl2007",
      kind: "article",
      tier: "secondary",
      csl: { type: "article-magazine", title: "The Middle Asian Interaction Sphere", author: [{ family: "Possehl", given: "Gregory L." }], "container-title": "Expedition", volume: "49", issue: "1", issued: { "date-parts": [[2007]] }, URL: CAPTURES.possehl2007.url },
      identifiers: web(CAPTURES.possehl2007.url),
      license: { status: "copyrighted", note: "Penn Museum, Expedition magazine. Quoted briefly." },
      lenses: ["archaeological"],
    },
    {
      op: "create_source",
      ref: "s_ucl_khufu",
      kind: "webpage",
      tier: "secondary",
      csl: { type: "webpage", title: "King Kheops", "container-title": "Digital Egypt for Universities, University College London", issued: { "date-parts": [[2000]] }, URL: CAPTURES.uclKhufu.url },
      identifiers: web(CAPTURES.uclKhufu.url),
      license: { status: "copyrighted", note: "© 2000 University College London. Quoted briefly." },
      note: "The Petrie Museum's teaching resource on Egyptian chronology.",
    },
    {
      op: "create_source",
      ref: "s_giza_khufu",
      kind: "webpage",
      tier: "secondary",
      csl: { type: "webpage", title: "Khufu", "container-title": "Digital Giza (Giza Project, Harvard University)", issued: { "date-parts": [[2026]] }, URL: CAPTURES.gizaKhufu.url },
      identifiers: web(CAPTURES.gizaKhufu.url),
      license: { status: "copyrighted", note: "Quoted briefly." },
    },
  ];
}

interface PageViewLite {
  page: { version: number; blocks: BlockInput[] };
  claims: Record<string, { id: string; text: string; assessmentNote?: string | null; citations: { excerpt: { source: { id: string; title: string } } }[] }>;
}

const MELUHHA_NOTE =
  "The identification rests on Indus objects found in Mesopotamia and the Gulf, on the goods the texts list, and on the order in which the texts name Dilmun, Magan and Meluhha. It is widely held (Possehl 2006, 2007) but not proven.";
const TRADE_CARE =
  "Read with care. That Meluhha was the Indus is the usual view among specialists, not a proven fact. Barton's translations date from the 1920s.";

/** The Meluhha note and the trade caution, unless they already say what they should (or no longer say “tertiary”). */
function textFixes(view: PageViewLite, meluhhaClaim: string): ChangeOpInput[] {
  const ops: ChangeOpInput[] = [];
  const claim = Object.values(view.claims).find((c) => c.id === meluhhaClaim);
  if (claim?.assessmentNote && /tertiary/i.test(claim.assessmentNote))
    ops.push({ op: "update_claim", claim: meluhhaClaim, set: { assessmentNote: MELUHHA_NOTE } });
  const care = view.page.blocks.find((b) => b.id === "trade-care");
  if (care?.type === "callout" && /tertiary/i.test(care.markdown)) {
    const blocks = view.page.blocks.map((b) => (b.id === "trade-care" && b.type === "callout" ? { ...b, markdown: TRADE_CARE } : b));
    const op = pagePatchOp(PAGE_SLUG, view.page.blocks as { id: string }[], blocks as { id: string }[]);
    if (op) ops.push(op);
  }
  return ops;
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }

  // Once this changeset is applied, a re-run proposes only the text fixes that had to wait for the page.
  const applied = (await mcp.call<{ title: string }[]>("list_changesets", { status: ["applied"], limit: 200 })).some((c) => c.title === TITLE);

  // Where the claims are: on the applied page, or in the pending page changeset.
  const view = await mcp.call<PageViewLite>("get_page", { page: PAGE_SLUG, format: "json" }).catch(() => null);
  const claimRef: Record<string, string> = {};
  const sourceRef: Record<string, string> = {};
  const dependsOn: string[] = [];
  if (view?.page) {
    for (const [ref, prefix] of Object.entries(CLAIMS)) {
      const found = Object.values(view.claims).filter((c) => c.text.startsWith(prefix));
      if (found.length !== 1) {
        // Later fixes reworded some claims; a re-run after approval needs only the Meluhha claim.
        if (applied && ref !== "c_meluhha_id") continue;
        throw new Error(`${found.length} claims on the page start “${prefix}”`);
      }
      claimRef[ref] = found[0]!.id;
    }
    const sources = new Map<string, string>();
    for (const c of Object.values(view.claims)) for (const cit of c.citations) sources.set(cit.excerpt.source.id, cit.excerpt.source.title);
    for (const [ref, prefix] of Object.entries(SOURCES)) {
      const id = [...sources].find(([, title]) => title.startsWith(prefix))?.[0];
      if (!id && applied) continue;
      if (!id) throw new Error(`no source on the page titled “${prefix}”`);
      sourceRef[ref] = id;
    }
  } else {
    const rows = await mcp.call<{ id: string; title: string }[]>("list_changesets", { status: ["proposed"], limit: 200 });
    const pageCs = rows.find((c) => c.title === PAGE_TITLE);
    if (!pageCs) throw new Error("The Indus page is neither applied nor pending; propose it first (indus-index.ts).");
    dependsOn.push(pageCs.id);
    for (const ref of Object.keys(CLAIMS)) claimRef[ref] = `@${ref}`;
    for (const ref of Object.keys(SOURCES)) sourceRef[ref] = `@${ref}`;
  }

  if (applied) {
    if (!view?.page) throw new Error("The sources changeset is applied but the page is not.");
    const ops = textFixes(view, claimRef.c_meluhha_id!);
    if (!ops.length) {
      console.log("The sources changeset and its text fixes are already applied. Nothing to do.");
      process.exit(0);
    }
    const p = await mcp.call<Proposal>("propose_changes", {
      title: `${TITLE}: text fixes`,
      rationale: "The two text fixes that had to wait for the Indus page to be approved: the Meluhha claim's assessment note and the trade chapter's caution, which said these rested only on tertiary sources.",
      ops,
    });
    summarize("indus sources (text fixes)", p);
    await finish(mcp, flags, [p]);
    process.exit(0);
  }

  console.log("Capturing source texts…");
  const snaps = {} as Record<CaptureKey, string>;
  for (const [key, origin] of Object.entries(CAPTURES) as [CaptureKey, (typeof CAPTURES)[CaptureKey]][]) {
    const s = await mcp.call<{ id: string; title: string | null }>("capture_snapshot", { origin });
    snaps[key] = s.id;
    console.log(`  ${key}: ${s.id} ${s.title ?? ""}`);
  }

  const ops: ChangeOpInput[] = [...newSources()];
  for (const x of EXCERPTS)
    ops.push({
      op: "create_excerpt",
      ref: x.ref,
      source: x.source in SOURCES ? sourceRef[x.source]! : `@${x.source}`,
      snapshotId: snaps[x.snap],
      quote: x.quote,
      locator: x.locator,
      ...(x.note ? { note: x.note } : {}),
    } as ChangeOpInput);
  for (const c of CITES)
    ops.push({ op: "cite", claim: claimRef[c.claim]!, excerpt: `@${c.excerpt}`, stance: c.stance ?? "supports", ...(c.note ? { note: c.note } : {}) });

  // Notes that said "only tertiary" (only possible once the page is applied).
  if (view?.page) ops.push(...textFixes(view, claimRef.c_meluhha_id!));

  const p = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Adds secondary (and two primary) sources to nine claims on the Indus page that were supported only by tertiary sources (UNESCO descriptions, Harappa.com, Wikipedia), and a further source for the Sargon claim and for the script being undeciphered.",
      "New sources: G. L. Possehl in Expedition (Penn Museum) 2006 and 2007, on Meluhha = the Indus, Magan = Oman/UAE and Dilmun = Bahrain; UCL's Digital Egypt and Harvard's Digital Giza on Khufu and the Great Pyramid. Reused: Green 2021 (CC BY) for the street grid, Dholavira's stone walls and reservoirs, the five cities, crafts at Dholavira and Indus goods in Oman and Bahrain; Shinde et al. 2019 on town planning; Masson 1842 and the ASI Annual Report 1923–24 on Harappa's long occupation.",
      "Where a new excerpt supports only part of a claim, the citation note says which part.",
      "Still tertiary-only, for want of an open or public-domain source found: the date Dholavira was found (1968), the population estimates, and the later debate on the “Pashupati” seal.",
      view?.page
        ? "Also updates the Meluhha claim's assessment note and the trade chapter's caution, which said these rested only on tertiary sources."
        : "Depends on the pending Indus page changeset. Once that is approved, re-running scripts/seed/indus-sources.ts proposes the two small text fixes (the Meluhha claim's assessment note and the trade chapter's caution, which say “only tertiary”).",
    ].join("\n\n"),
    dependsOn,
    ops,
  });
  summarize("indus sources", p);
  await finish(mcp, flags, [p]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
