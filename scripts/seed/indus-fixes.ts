/**
 * Accuracy fixes on the Indus page, from the AI support checks
 * (docs/research/2026-10-support-checks.md, table "indus-civilisation"),
 * THROUGH MCP:
 *
 *  - quotes that stopped short of the words a claim needs are extended (a new,
 *    longer excerpt is cited and the short one's citation removed);
 *  - claims that said more than their sources are reworded;
 *  - citations whose stance was wrong are re-cited with the right stance
 *    (an excerpt that is only context becomes "mentions");
 *  - Marshall's "1925" claims now say they come from the Survey's report for
 *    1924–25, printed in 1927.
 *
 * Objects are found by their refs in the Indus changesets (the page and the
 * sources follow-up), whose ops carry the ids they were given: in a preview
 * database they are applied; in the main one this changeset depends on them.
 *
 *   pnpm tsx scripts/seed/indus-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { PAGE_SLUG } from "./indus";

const TITLE = "The Indus civilisation: accuracy fixes from the support checks";
const PARENTS = [
  "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities",
  "The Indus civilisation: secondary and primary sources for claims that rested on tertiary ones",
];

import { NEW_EXCERPTS } from "./indus-fixes-data";

const REPORT_1925 = "In his note in the Archaeological Survey's report for 1924–25 (printed in 1927)";
const WHEN_1925 = { start: { year: 1925, era: "CE" }, basis: "Marshall's note for the 1924–25 season, in the Annual Report for 1924–25 (published 1927)" };

/** Claim rewordings (and dates). */
const REWORD: Record<string, { text?: string; when?: Record<string, unknown>; assessmentNote?: string }> = {
  c_bath_religion: { text: "Marshall wrote that the Great Bath's purpose “can only be surmised”; he thought it most likely connected with religion, like the sacred tanks long familiar in Indian religious life." },
  c_masson_sangala: { text: "Masson took the mounds of Harappa for Sangala, a town besieged by Alexander the Great." },
  c_tablet_deity: { text: `${REPORT_1925}, Marshall described a faience tablet showing a cross-legged seated figure with kneeling worshippers and a snake, and judged it more likely a god than a king.`, when: WHEN_1925 },
  c_fsw: { text: "Farmer, Sproat and Witzel (2004) argued that the Indus signs were not writing, but non-linguistic symbols, like Near Eastern systems that served religious, political and social purposes without recording speech." },
  c_lothal_dock: { text: "The Archaeological Survey of India interpreted a large basin at Lothal as a dock, linked to an old course of the Sabarmati river, and one of the earliest known." },
  c_dna: { text: "An ancient genome from Rakhigarhi, an Indus city (published in 2019), had ancestry with little or no contribution from steppe herders, of a kind that, the authors argue, was a main ancestor of later South Asians." },
  c_dales_skeletons: { text: "Re-examining the “massacre” in 1964, George Dales found that nine years of digging at Mohenjo-daro had produced only about 37 skeletons of the Indus period, not shown to be from a single time, and none in the citadel." },
  c_sumer_link: { text: "Readers of Marshall's article pointed out resemblances to Sumerian finds from Mesopotamia, which showed the Indus cities were roughly contemporary with Sumer." },
  c_standard: { text: "Cities far apart, such as Harappa, Mohenjo-daro and Dholavira, used the same brick sizes, and a standard system of weights was kept across the civilisation for centuries." },
  c_marshall_same: { text: "In the summer of 1924 John Marshall compared the finds from the two sites, some 400 miles apart, and saw at once that they belonged to the same culture and age, and to nothing previously known in India." },
  c_rao: { text: "Rao and colleagues (2009) found statistical structure in sign sequences that they took as suggestive of a writing system for a language rather than of non-linguistic symbols." },
  c_dholavira: { text: "Dholavira, on the arid island of Khadir in Kachchh, Gujarat, was occupied c. 3000–1500 BCE; it was built largely of stone, with fortifications and a system of reservoirs to store scarce water." },
  c_priestking_name: { text: "“Priest-King” is the common name for a 17.5 cm statuette from Mohenjo-daro; no inscription names the man, and some now read the statue as evidence of contact with neighbouring peoples rather than of a ruling elite." },
  c_no_horse: { text: `${REPORT_1925}, Marshall noted that the horse did not appear on the seals, and supposed it was brought to India later by the Aryans.`, when: WHEN_1925 },
  c_marshall_aryans: { text: `${REPORT_1925}, Marshall suggested that the Indus people were the pre-Aryan “Dasyus” of the Vedas, whose culture invading Aryans had largely destroyed.`, when: WHEN_1925 },
  c_marshall_script: { text: "From the start the script was a puzzle: in 1924 Marshall saw no likeness to any ancient Indian alphabet and no way to tell whether its signs stood for words or sounds; in the Survey's report for 1924–25 he wrote that it had yet to be deciphered." },
  c_wheeler_indra: { text: "In 1947 Mortimer Wheeler argued that the civilisation was finally destroyed deliberately, by Aryan invaders; pointing to skeletons at Mohenjo-daro, he wrote that “on circumstantial evidence, Indra stands accused”." },
  c_protoshiva_doubt: { text: "Later scholars have disputed Marshall's reading: Doris Srinivasan, for example, saw the “extra faces” as ears and the face as bovine, and others urge caution, saying the figure's meaning cannot be known." },
  c_ghaggar_sites: { text: "Many Harappan settlements lie along the Ghaggar-Hakra, a river that has been seasonal for most of its history and is largely dry today." },
  c_houses: { when: WHEN_1925 },
  c_crafts: { when: WHEN_1925 },
  m_priestking: { assessmentNote: "The name is a modern label, given by analogy with Mesopotamian priest-kings. Nothing identifies the man or his role." },
};

/** Citations to add: [claim, excerpt, stance, note?]. */
const ADD: [string, string, "supports" | "contradicts" | "qualifies" | "mentions", string?][] = [
  ["c_bath_religion", "x2_asi26_tanks", "supports"],
  ["c_mjd_abandoned", "x2_asi25_stupa", "supports"],
  ["c_masson", "x_masson_village", "supports", "The ruinous brick castle."],
  ["c_tablet_deity", "x2_asi25_tablet", "supports"],
  ["c_fsw", "x2_fsw_nonling", "supports"],
  ["c_dholavira_trade", "x_green_gulf", "mentions", "Indus goods in Oman and Bahrain, in general; not Dholavira."],
  ["c_dales_floods", "x2_dales_coast", "supports"],
  ["c_dales_floods", "x2_dales_migrate", "supports"],
  ["c_wheeler_akkad", "x2_wheeler_apogee", "supports"],
  ["c_dales_skeletons", "x2_dales_period", "supports"],
  ["c_great_bath", "x2_asi26_watertight", "supports"],
  ["c_no_texts", "x_barton_sargon", "supports", "One of the few Mesopotamian mentions of Meluhha."],
  ["c_mjd_grid", "x_shinde_planning", "mentions", "Town planning in the civilisation in general; not Mohenjo-daro specifically."],
  ["c_meluhha_id", "x_possehl06_village", "mentions", "Meluhhans living in Akkad: background to the identification."],
  ["c_marshall_same", "x2_iln_400", "supports"],
  ["c_marshall_same", "x2_asi24_summer", "supports"],
  ["c_beads", "x_green_dho_crafts", "mentions", "Dholavira as a centre of many crafts."],
  ["c_crafts", "x2_asi25_metals", "supports"],
  ["c_east_south", "x2_dales_mingled", "supports"],
  ["c_no_destruction", "x2_dales_citadel", "supports"],
  ["c_dholavira", "x2_unesco_khadir", "supports"],
  ["c_green_egalitarian", "x2_green_absence", "supports"],
  ["c_green_egalitarian", "x2_green_collective", "supports"],
  ["c_houses", "x2_asi25_dwelling", "supports"],
  ["c_gudea_meluhha", "x2_barton_wood", "supports"],
  ["c_protoshiva_doubt", "x2_wp_doniger", "supports"],
  ["m_one_empire", "x2_green_views_full", "contradicts", "No argument, for an empire or otherwise, fits the whole civilisation."],
  ["m_one_empire", "x_green_nopalaces", "qualifies"],
  ["m_one_empire", "x2_green_absence", "contradicts"],
  ["m_sudden", "x_chatterjee_decline", "contradicts", "Abandonment over a few centuries."],
  ["m_sudden", "x_giosan_decline", "contradicts"],
  ["c_marshall_aryans", "x2_asi25_dasyus", "supports"],
  ["c_wheeler_indra", "x2_wheeler_massacre", "supports"],
  ["m_aryan", "x2_dales_period", "contradicts"],
  ["m_aryan", "x_dales_37", "mentions", "The number of skeletons."],
  ["c_ghaggar_sites", "x2_giosan_ghaggar", "supports"],
  ["c_ghaggar_sites", "x_singh_sutlej", "mentions", "Settlements along an abandoned valley; it does not name the Ghaggar-Hakra here."],
  ["c_harappa_living", "x_masson_village", "mentions", "A village beside the mounds in 1826."],
  ["c_harappa_living", "x_asi24_strata", "mentions", "Many layers of building."],
];

/** Citations to remove (replaced above by a longer quote or a different stance): [claim, excerpt]. */
const REMOVE: [string, string][] = [
  ["c_mjd_abandoned", "x_asi25_abandoned"],
  ["c_tablet_deity", "x_asi25_tablet"],
  ["c_dholavira_trade", "x_green_gulf"],
  ["c_dales_floods", "x_dales_floods"],
  ["c_wheeler_akkad", "x_wheeler_akkad"],
  ["c_great_bath", "x_asi26_bitumen"],
  ["c_no_texts", "x_barton_sargon"],
  ["c_mjd_grid", "x_shinde_planning"],
  ["c_meluhha_id", "x_possehl06_village"],
  ["c_beads", "x_green_dho_crafts"],
  ["c_crafts", "x_asi25_crafts"],
  ["m_one_empire", "x_green_views"],
  ["m_one_empire", "x_green_nopalaces"],
  ["c_marshall_aryans", "x_asi25_aryans"],
  ["m_aryan", "x_dales_37"],
  ["c_ghaggar_sites", "x_singh_sutlej"],
  ["c_harappa_living", "x_masson_village"],
  ["c_harappa_living", "x_asi24_strata"],
  ["c_houses", "x_asi25_houses"],
];

interface Op {
  op: string;
  id?: string;
  ref?: string;
  claim?: string;
  excerpt?: string;
  source?: string;
  snapshotId?: string;
}

/** Page prose that repeated a reworded claim, if the page is applied and still says it. */
async function proseFixes(): Promise<ChangeOpInput[]> {
  const view = await mcp.call<{ page: { version: number; blocks: BlockInput[] } }>("get_page", { page: PAGE_SLUG, format: "json" }).catch(() => null);
  if (!view?.page) return [];
  let changed = false;
  const blocks = view.page.blocks.map((b) => {
    if (b.type !== "prose") return b;
    const md = b.markdown
      .replace("The first ancient genome from an Indus city, from Rakhigarhi,", "An ancient genome from Rakhigarhi, an Indus city,")
      .replace("only about 37 skeletons, from different periods", "only about 37 skeletons, not shown to be from a single time");
    if (md !== b.markdown) changed = true;
    return { ...b, markdown: md };
  });
  const op = changed ? pagePatchOp(PAGE_SLUG, view.page.blocks as { id: string }[], blocks as { id: string }[]) : null;
  return op ? [op] : [];
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }

  // Once this changeset is applied, a re-run proposes only the page-prose edits that had to wait for the page.
  const appliedRows = await mcp.call<{ title: string }[]>("list_changesets", { status: ["applied"], limit: 200 });
  if (appliedRows.some((c) => c.title === TITLE)) {
    const ops = await proseFixes();
    if (!ops.length) {
      console.log("The fixes and their prose edits are already applied. Nothing to do.");
      process.exit(0);
    }
    const p = await mcp.call<Proposal>("propose_changes", {
      title: `${TITLE}: page prose`,
      rationale: "Two sentences of page prose brought in line with the reworded claims (the Rakhigarhi genome is not called the first; the Mohenjo-daro skeletons are not shown to be from a single time). They had to wait for the Indus page to be approved.",
      ops,
    });
    summarize("indus fixes (prose)", p);
    await finish(mcp, flags, [p]);
    process.exit(0);
  }

  // Ids from the parent changesets' ops (applied here, or pending).
  const rows = await mcp.call<{ id: string; title: string; status: string }[]>("list_changesets", { status: ["applied", "proposed"], limit: 200 });
  const ref: Record<string, string> = {};
  const excerptInfo: Record<string, { source: string; snapshotId?: string }> = {};
  const citation = new Map<string, string>();
  const dependsOn: string[] = [];
  for (const title of PARENTS) {
    const cs = rows.find((r) => r.title === title);
    if (!cs) throw new Error(`no changeset “${title}”`);
    if (cs.status === "proposed") dependsOn.push(cs.id);
    const full = await mcp.call<{ ops: Op[] }>("get_changeset", { id: cs.id });
    for (const op of full.ops) {
      if (op.ref && op.id) ref[op.ref] = op.id;
      if (op.op === "create_excerpt" && op.ref) excerptInfo[op.ref] = { source: op.source!, snapshotId: op.snapshotId };
      if (op.op === "cite" && op.id) citation.set(`${op.claim}|${op.excerpt}`, op.id);
    }
  }
  const id = (r: string) => {
    if (r.startsWith("x2_")) return `@${r}`;
    const v = ref[r];
    if (!v) throw new Error(`no id for ${r}`);
    return v;
  };

  const ops: ChangeOpInput[] = [];
  for (const x of NEW_EXCERPTS) {
    const like = excerptInfo[x.like];
    if (!like) throw new Error(`no excerpt ${x.like}`);
    ops.push({
      op: "create_excerpt",
      ref: x.ref,
      source: like.source,
      ...(like.snapshotId ? { snapshotId: like.snapshotId } : {}),
      quote: x.quote,
      locator: x.locator,
      ...(x.note ? { note: x.note } : {}),
    } as ChangeOpInput);
  }
  for (const [claim, excerpt] of REMOVE) {
    const cit = citation.get(`${id(claim)}|${id(excerpt)}`);
    if (!cit) throw new Error(`no citation ${claim} ← ${excerpt}`);
    ops.push({ op: "uncite", citation: cit });
  }
  for (const [claim, excerpt, stance, note] of ADD)
    ops.push({ op: "cite", claim: id(claim), excerpt: id(excerpt), stance, ...(note ? { note } : {}) });
  for (const [claim, set] of Object.entries(REWORD)) ops.push({ op: "update_claim", claim: id(claim), set } as ChangeOpInput);

  // Page prose that repeated a reworded claim (only where the page is applied).
  ops.push(...(await proseFixes()));

  const p = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Fixes from the AI support checks of the Indus page (docs/research/2026-10-support-checks.md, 45 items).",
      `Quotes extended where a claim needed words just outside them: ${NEW_EXCERPTS.length} new excerpts from the same snapshots (the Great Bath's gypsum and watertightness, Wheeler's “reached its apogee”, Marshall's Dasyus, metals and houses, Dales on the coastline, the migration to Kathiawar, the citadel and the dating of the skeletons, Green's absence of evidence, Doniger via Wikipedia, and others); the short excerpts' citations are removed where the long one replaces them.`,
      "Claims reworded where they said more than the sources: Rao et al. “took as suggestive of”; the Rakhigarhi genome is not called the first; Dales's skeletons “not shown to be from a single time”; the Pashupati doubt drops “without texts”; Masson's Sangala claim drops the hindsight; Dholavira is on the arid island of Khadir (no “salt flats”); the “Priest-King” is its common name, not shown to be the excavators'; the 400 miles is “some 400 miles apart” (Marshall in the ILN); the third-millennium date of the Sumer link is left to the dating claim.",
      "Stances corrected: Green on Oman and Bahrain, and on Dholavira's many crafts, Shinde on town planning, Possehl on the Meluhhan village, Masson's village and Marshall's strata are context (mentions); Barton's Sargon inscription supports the “few Mesopotamian mentions”; on the misconceptions, excerpts that only report the debate become qualifies or mentions and the words that contradict are cited instead.",
      "Dates: the claims that said Marshall wrote “in 1925” now say “in his note in the Survey's report for 1924–25 (printed in 1927)”, dated 1925 with that basis.",
      dependsOn.length ? "Depends on the pending Indus page and sources changesets; the two prose edits follow once the page is approved (re-run this script)." : "Also brings two sentences of page prose in line with the reworded claims, where the page still has them.",
    ].join("\n\n"),
    dependsOn,
    ops,
  });
  summarize("indus fixes", p);
  await finish(mcp, flags, [p]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
