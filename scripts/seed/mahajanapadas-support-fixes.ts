/**
 * Accuracy fixes to the Mahājanapadas page after the AI support checks
 * (scratchpad verifier judgments, page "mahajanapadas": 34 single citations
 * and 2 joint partials):
 *
 * - quotes that stopped a clause short are extended, as new excerpts from the
 *   same snapshots (the five other teachers, Skylax's voyage, the NBPW cities,
 *   Gosāla's fate, the full gaṇa-saṅgha and Alexander sentences);
 * - missing steps get their own excerpts (Jīvaka's advice to visit the
 *   Buddha, Vassakāra's errand, the other three places of pilgrimage, the
 *   “first discourse”, Kusinārā, the Ganges crossing, Gaugamela's date, the
 *   sixteen names as Rhys Davids prints them, the ants' gold);
 * - claims that overstated are reworded (Smith's own dates for Darius,
 *   Geiger's reign-lengths, “when the early texts were composed”, Udayin
 *   after Darśaka, “after his defeat” for Porus, no year for Xerxes);
 * - background citations that do not carry their claim become “mentions”.
 *
 * Proposed THROUGH MCP, depending on the page's changeset and its sources
 * follow-up, whose refs (@s_…) it reuses. Claims and citations are found on
 * the live page by their text, so edits by the editor are kept; anything
 * already fixed is skipped, so the script can be re-run.
 *
 *   pnpm tsx scripts/seed/mahajanapadas-support-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { alreadyProposedOrApplied } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const TITLE = "The Mahājanapadas page: fixes after the AI support checks";
const SLUG = "mahajanapadas";
const DEPENDS = [
  "The Mahājanapadas and the age of the Buddha (c. 600–320 BCE): page, sources and entities",
  "The Mahājanapadas page: older sources for claims that rested on Wikipedia",
];

const CAPTURES = {
  bi: { kind: "internet_archive", identifier: "buddhistindia00davirich" },
  sbe11: { kind: "internet_archive", identifier: "buddhistsuttas00daviuoft" },
  dial1: { kind: "internet_archive", identifier: "dialoguesofbuddh01davi" },
  mhv: { kind: "internet_archive", identifier: "mahavamsagreatch00geigrich" },
  pargiter: { kind: "internet_archive", identifier: "dli.csl.5891" },
  herod1: { kind: "internet_archive", identifier: "historyofherodo01hero" },
  arrian: { kind: "internet_archive", identifier: "theanabasisofale46976gut" },
  smith1914: { kind: "internet_archive", identifier: "earlyhistoryofin00smit" },
  wpUrban: { kind: "wikipedia", title: "Second urbanisation" },
  wpGana: { kind: "wikipedia", title: "Gaṇa sangha" },
  wpAlexander: { kind: "wikipedia", title: "Indian campaign of Alexander the Great" },
} as const;
type Key = keyof typeof CAPTURES;
type Stance = "supports" | "qualifies" | "contradicts" | "mentions";

interface Citation {
  id: string;
  stance: string;
  note: string | null;
  excerpt: { id: string; quote: string | null };
}
interface ClaimView {
  id: string;
  text: string;
  assessmentNote?: string | null;
  citations: Citation[];
}
interface PageView {
  page: { version: number; blocks: BlockInput[] };
  claims: Record<string, ClaimView>;
}

/**
 * The page as it will be once its pending changesets are applied (main DB,
 * before approval): claims, citations and excerpts rebuilt from their ops,
 * whose ids are assigned at proposal time.
 */
async function pendingView(ids: string[]): Promise<PageView> {
  type Op = Record<string, unknown> & { op: string; id?: string };
  const claimsById: Record<string, ClaimView> = {};
  const quotes: Record<string, string | null> = {};
  let blocks: BlockInput[] = [];
  for (const id of ids) {
    const cs = await mcp.call<{ ops: Op[] }>("get_changeset", { id });
    for (const o of cs.ops) {
      if (o.op === "create_claim") claimsById[o.id!] = { id: o.id!, text: o.text as string, assessmentNote: (o.assessmentNote as string | undefined) ?? null, citations: [] };
      else if (o.op === "create_excerpt") quotes[o.id!] = (o.quote as string | undefined) ?? null;
      else if (o.op === "cite" && claimsById[o.claim as string])
        claimsById[o.claim as string]!.citations.push({ id: o.id!, stance: o.stance as string, note: (o.note as string | undefined) ?? null, excerpt: { id: o.excerpt as string, quote: quotes[o.excerpt as string] ?? null } });
      else if (o.op === "uncite") for (const c of Object.values(claimsById)) c.citations = c.citations.filter((x) => x.id !== o.citation);
      else if (o.op === "update_claim" && claimsById[o.claim as string]) {
        const set = o.set as { text?: string; assessmentNote?: string | null };
        if (set.text) claimsById[o.claim as string]!.text = set.text;
        if (set.assessmentNote !== undefined) claimsById[o.claim as string]!.assessmentNote = set.assessmentNote;
      } else if (o.op === "create_page" && o.slug === SLUG) blocks = o.blocks as BlockInput[];
    }
  }
  return { page: { version: 1, blocks }, claims: claimsById };
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  // One correction: once proposed or applied, running again must do nothing (later fixes own these claims).
  const done = flags.force ? null : await alreadyProposedOrApplied(mcp, TITLE);
  if (done) {
    console.log(done === "proposed" ? "A changeset with this title is already waiting for review. Nothing to do." : "This fix is already applied. Nothing to do.");
    process.exit(0);
  }
  const list = await mcp.call<{ id: string; title: string }[]>("list_changesets", { status: ["proposed", "applied"], limit: 200 });
  const dependsOn = DEPENDS.map((t) => {
    const c = list.find((x) => x.title === t);
    if (!c) throw new Error(`no changeset “${t}”`);
    return c.id;
  });

  const snap = {} as Record<Key, string>;
  for (const [k, origin] of Object.entries(CAPTURES) as [Key, (typeof CAPTURES)[Key]][])
    snap[k] = (await mcp.call<{ id: string }>("capture_snapshot", { origin })).id;

  const view = await mcp
    .call<PageView>("get_page", { page: SLUG, format: "json" })
    .catch(async () => pendingView(dependsOn));
  const claims = Object.values(view.claims).filter((c, i, a) => a.findIndex((d) => d.id === c.id) === i);
  const claim = (key: string) => {
    const starts = claims.filter((c) => c.text.startsWith(key));
    const hits = starts.length ? starts : claims.filter((c) => c.text.includes(key));
    if (hits.length !== 1) throw new Error(`claim “${key}”: ${hits.length} matches`);
    return hits[0]!;
  };

  const ops: ChangeOpInput[] = [];
  const log: string[] = [];
  /** Rewords part of a claim's current text; skips if already done. */
  const reword = (key: string, from: string, to: string) => {
    const c = claim(key);
    if (c.text.includes(to) && !c.text.includes(from)) return;
    if (!c.text.includes(from)) throw new Error(`claim “${key}” no longer contains “${from}”`);
    ops.push({ op: "update_claim", claim: c.id, set: { text: c.text.replace(from, to) } });
    log.push(`reword: ${key}`);
  };
  /** Changes a citation's stance (uncite, then cite again with the new stance and note). */
  const restance = (key: string, quotePrefix: string, stance: Stance, note?: string) => {
    const c = claim(key);
    const cit = c.citations.find((x) => x.excerpt.quote?.startsWith(quotePrefix));
    if (!cit) throw new Error(`claim “${key}”: no citation of “${quotePrefix}”`);
    if (cit.stance === stance && (note === undefined || cit.note === note)) return;
    ops.push({ op: "uncite", citation: cit.id });
    ops.push({ op: "cite", claim: c.id, excerpt: cit.excerpt.id, stance, ...((note ?? cit.note) ? { note: note ?? cit.note! } : {}) });
    log.push(`stance ${cit.stance} → ${stance}: ${key} / ${quotePrefix.slice(0, 40)}`);
  };
  const uncite = (key: string, quote: string) => {
    const c = claim(key);
    const cit = c.citations.find((x) => x.excerpt.quote === quote);
    if (!cit) return;
    ops.push({ op: "uncite", citation: cit.id });
    log.push(`uncite: ${key} / ${quote.slice(0, 40)}`);
  };
  type Loc = { page?: string; chapter?: string; section?: string; verse?: string; label?: string };
  /** Adds an excerpt (new, from a snapshot) and cites it, unless the claim already cites that quote or a longer one containing it. */
  const add = (key: string, ref: string, source: string, k: Key, quote: string, locator: Loc, stance: Stance = "supports", note?: string, citeNote?: string) => {
    const c = claim(key);
    if (c.citations.some((x) => x.excerpt.quote?.includes(quote))) return;
    if (!ops.some((o) => o.op === "create_excerpt" && (o as { ref?: string }).ref === ref))
      ops.push({ op: "create_excerpt", ref, source, snapshotId: snap[k], quote, locator, ...(note ? { note } : {}) } as ChangeOpInput);
    ops.push({ op: "cite", claim: c.id, excerpt: `@${ref}`, stance, ...(citeNote ? { note: citeNote } : {}) });
    log.push(`add ${ref} → ${key}`);
  };
  const MPS = (chapter: string, section: string, page: string): Loc => ({ page, chapter, section, label: `Maha-parinibbana Sutta, ch. ${chapter}, § ${section}` });
  const SPS = (section: string, page: string): Loc => ({ page, section, label: `Samanna-phala Sutta, § ${section}` });

  // The second urbanisation: the NBPW sentence with the cities it brings.
  add("From about 600 BCE", "x_wp_hi_nbpw_full", "@s_wpUrban", "wpUrban", "This period corresponds in an archaeological context to the Northern Black Polished Ware culture. Especially focused in the Central Ganges plain but also spreading across vast areas of the northern and central Indian subcontinent, this culture is characterised by the emergence of large cities with massive fortifications", { section: "Second urbanisation" });
  uncite("From about 600 BCE", "This period corresponds in an archaeological context to the Northern Black Polished Ware culture.");
  reword("From about 600 BCE", "Northern Black Polished Ware, a glossy pottery of c. 700–200 BCE.", "Northern Black Polished Ware, a pottery of c. 700–200 BCE.");

  // The six teachers: one excerpt with all five other names, and the visit.
  {
    const key = "In the Sāmaññaphala Sutta";
    add(key, "x_dial_six_full", "@s_dial1", "dial1", "Then other five ministers spake in the same terms of Makkhali of the cow-pen, [48] of Af ita of the garment of hair, of Pakudha Ka^ayana, of Sa^aya of the Bela/Ma clan, and of the Niga^a of the Nata clan.", { ...SPS("3-7", "66"), label: "Samanna-phala Sutta, §§ 3–7" }, "supports",
      "Quoted in the OCR's spelling: “of Ajita of the garment of hair, of Pakudha Kaccāyana, of Sañjaya of the Belaṭṭha clan, and of the Nigaṇṭha of the Nāta clan”. [48] marks the page of the Pali text.");
    uncite(key, "Then other five ministers spake in the same terms of Makkhali of the cow-pen");
    add(key, "x_dial_jivaka", "@s_dial1", "dial1", "Let your Majesty pay a visit to him. It may well be that, on calling upon him, your heart, Sire, shall find peace.", SPS("8", "67"), "supports", "Jīvaka the physician, of the Buddha, after the ministers have named the six teachers.");
    add(key, "x_dial_bowed", "@s_dial1", "dial1", "Then the king bowed to the Blessed One", SPS("13", "68"));
    const c = claim(key);
    if (c.assessmentNote === undefined || c.assessmentNote?.startsWith("Ajita, Pakudha and Sañjaya are named")) {
      ops.push({ op: "update_claim", claim: c.id, set: { assessmentNote: null } });
      log.push("assessment note removed: six teachers");
    }
  }

  // Smith's dates for Darius are his own.
  reword("Vincent Smith reckoned", "contemporaries of Darius I (522–486 BCE)", "contemporaries of Darius I (on his dates, 521–485 BCE)");

  // Geiger: the 162 years come from reign-lengths.
  add("Wilhelm Geiger (1912)", "x_mhv_162", "@s_mhv", "mhv", "Thus Candagutta would have ascended the throne 214 — (28 + 24 years), i. e. 162 years after the Nirvana.", { page: "xxiv", label: "Geiger's Introduction (page inferred)" }, "supports", "214 years to Aśoka's consecration, less the reigns of Bindusāra (28) and Chandragupta (24).");
  reword("Wilhelm Geiger (1912)", "combined the 218 years with Greek evidence for Chandragupta Maurya's accession", "combined the chronicles' reign-lengths with the date of Chandragupta Maurya's accession");

  // Skylax: the whole voyage.
  add("Herodotus says Darius sent Skylax", "x_herod_skylax_full", "@s_herod1", "herod1", "Of Asia the greater part was explored by Dareios, who desiring to know of the river Indus, which is a second river producing crocodiles of all the rivers in the world, — to know, I say, of this river where it runs out into the sea, sent with ships, besides others whom he trusted to speak the truth, Skylax also, a man of Caryanda. These starting from the city of Caspatyros and the land of Pactyike, sailed down the river towards the East and the sunrising to the sea", { page: "308–309", chapter: "IV.44", label: "Book IV, ch. 44" }, "supports", "The running head “BOOK IV 309” falls inside the sentence.");
  uncite("Herodotus says Darius sent Skylax", "Skylax also, a man of Caryanda. These starting from the city of Caspatyros and the land of Pactyike, sailed down");

  // Rhys Davids on the brahmin books: what they missed, and why.
  add("Rhys Davids argued that earlier scholars", "x_bi_survival", "@s_bi", "bi", "the earliest Buddhist records reveal the survival, side by side with more or less powerful monarchies, of republics with either complete or modified independence.", { page: "2", chapter: "I" });
  add("Rhys Davids argued that earlier scholars", "x_bi_ignore", "@s_bi", "bi", "And these, partly because of the natural antipathy felt by the priests towards the free republics, partly because of the later date of most of the extant priestly literature, and especially of the law books, ignore the real facts.", { page: "2", chapter: "I" }, "supports", "“These” are the brahmin books.");

  // Writing: Rhys Davids ties it to when the passages were composed.
  reword("Rhys Davids read the early texts", "writing was known in the Buddha's time", "writing was known when the early texts were composed");

  // Vassakāra's errand.
  add("Ajātasattu resolved", "x_sbe_go", "@s_sbe11", "sbe11", "Come now, O Brahman, do you go to the Blessed One, and bow down in adoration at his feet on my behalf", MPS("I", "2", "2"));

  // Jacobi.
  reword("Jacobi held that Ajātasattu", "Ajātasattu, by conquering Vesālī, “laid", "Ajātasattu conquered Vesālī and “laid");

  // Udayin came after Darśaka in the Purāṇas.
  add("made Kusumapura", "x_parg_darsaka", "@s_pargiter", "pargiter", "Darsaka will be king 25 years 3 . After him Udayin 4 will be king 33 years.", { page: "69", label: "Śiśunāgas (translation)" }, "supports", "The figures after “years” and “Udayin” are footnote marks.");
  reword("made Kusumapura", "The Purāṇas say Ajātasattu's successor Udayin made", "The Purāṇas say Udayin, who came after Ajātasattu and Darśaka, made");

  // The four places.
  add("The Mahāparinibbāna Sutta names four places", "x_sbe_insight", "@s_sbe11", "sbe11", "The place, Ananda, at which the believing man can say, \"Here the Tathagata attained to the supreme and perfect insight!\" is a spot to be visited with feelings of reverence and awe.", MPS("V", "18", "90"));
  add("The Mahāparinibbāna Sutta names four places", "x_sbe_kingdom", "@s_sbe11", "sbe11", "The place, Ananda, at which the believing man can say, \"Here was the kingdom of righteousness set on foot by the Tathagata!\" is a spot to be visited with feelings of reverence and awe.", MPS("V", "19", "90"), "supports", "“The Foundation of the Kingdom of Righteousness” is the first sermon.");
  add("The Mahāparinibbāna Sutta names four places", "x_sbe_passed", "@s_sbe11", "sbe11", "The place, Ananda, at which the believing man can say, \"Here the Tathagata passed finally away in that utter passing away which leaves nothing whatever to remain behind!\" is a spot to be visited with feelings of reverence and awe.", MPS("V", "20", "90"));
  add("The Mahāparinibbāna Sutta names four places", "x_sbe_first_discourse", "@s_sbe11", "sbe11", "forming the subject of Gotama's first discourse, 'The Foundation of the Kingdom of Righteousness'", { page: "243", label: "Introduction to the Maha-sudassana Sutta" }, "supports", undefined, "Ties “the kingdom of righteousness set on foot” to the first sermon.");

  // Porus: the quotes show his defeat and his request, not a capture.
  reword("Porus asked Alexander", "Captured, Porus asked", "After his defeat, Porus asked");

  // Xerxes: Herodotus gives no year.
  {
    const c = claim("Indian soldiers marched with Xerxes");
    if (c.text.includes(" in 480 BCE,")) {
      ops.push({ op: "update_claim", claim: c.id, set: { text: c.text.replace(" in 480 BCE,", ","), when: { start: { year: 480, era: "BCE" }, basis: "The conventional date of Xerxes' invasion of Greece; Herodotus gives no year." } } });
      log.push("reword: Xerxes (no year)");
    }
  }
  restance("Indian soldiers marched with Xerxes", "The Parthians and Chorasmians", "mentions", "Other peoples of the east in the same army.");

  // The sixteen names, as Rhys Davids prints them.
  add("Early Buddhist texts keep a stock list", "x_bi_list", "@s_bi", "bi", "The list is as follows : I. Anga 9- Kuru 2. Magadha 10. Paficala 3- KasI II. Maccha 4. Kosala 12. Surasena 5. VajJT 13. Assaka 6. Malla 14. AvantT 7. Cetl 15. Gandhara 8. Vamsa 16. Kamboja", { page: "23", chapter: "II", label: "Chapter II, The Clans and Nations" }, "supports",
    "A two-column table, read across, in the OCR's spelling: 1 Aṅga, 2 Magadha, 3 Kāsī, 4 Kosala, 5 Vajjī, 6 Malla, 7 Cetī, 8 Vaṃsa, 9 Kuru, 10 Pañcāla, 11 Maccha, 12 Sūrasena, 13 Assaka, 14 Avantī, 15 Gandhāra, 16 Kamboja.");

  // Background citations that do not carry their claims.
  restance("The Sakya clan", "The community, though describable as a small republic", "mentions", "Wikipedia calls the Sakya community probably an oligarchy.");
  restance("Historians disagree about what to call", "Two of the Mahājanapadas were most probably", "mentions");
  restance("For Jains, Mahāvīra", "Although the dates of Mahavira's life are uncertain", "mentions", "On Mahāvīra's historicity, not his place among the Tīrthaṅkaras.");
  restance("The peoples of the Indus appear", "For the Indians who were conterminous with the Bactrians", "mentions");
  add("The peoples of the Indus appear", "x_smith_tomb", "@s_smith1914", "smith1914", "India is not included in the list of provinces in the Behistun inscription of 516 B.C., but is included in the lists in the Persepolis and Naksh-i-Rustam inscriptions. The last-named record, inscribed on the sepulchre of Darius, is the fullest", { page: "38", label: "Chapter II, footnote" }, "supports", undefined, "India on Darius's own tomb; the later tombs rest on Wikipedia.");
  restance("Many historians now put the Buddha's death", "The dates of Gautama's birth and death are uncertain.", "mentions");
  restance("Many historians now put the Buddha's death", "Following the Greek sources of Asoka's coronation", "mentions", "An even later dating, from the short chronology.");

  // Pāṭaligāma: the Buddha crosses the Ganges on leaving it.
  add("Ajātasattu's ministers built a fortress", "x_sbe_ganges", "@s_sbe11", "sbe11", "But the Blessed One went on to the river. And at that time the river Ganges was brimful and overflowing", MPS("I", "33", "21"), "supports", "On leaving Pāṭaligāma by “Gotama's gate” (§ 32). OCR “Ganp-es was brimful and o overflowing”.");

  // The first sermon is called the first.
  add("The Buddha's first sermon", "x_sbe_first_discourse", "@s_sbe11", "sbe11", "forming the subject of Gotama's first discourse, 'The Foundation of the Kingdom of Righteousness'", { page: "243", label: "Introduction to the Maha-sudassana Sutta" }, "supports", undefined, "The sutta of the Deer Park sermon is translated in the same volume under this title.");

  // Kusinārā.
  add("Near the end the Buddha", "x_sbe_died_kusinara", "@s_sbe11", "sbe11", "heard the news that the Blessed One had died at Kusinara.", { ...MPS("VI", "51", "131"), label: "Maha-parinibbana Sutta, ch. VI, § 51 (page inferred)" }, "supports", "Of Ajātasattu; the other claimants to the relics hear the same news.");
  add("Near the end the Buddha", "x_sbe_council_hall", "@s_sbe11", "sbe11", "Now at that time the Mallas of Kusinara were assembled in the council hall concerning that very matter. And the venerable Ananda went to the council hall of the Mallas of Kusinara", MPS("VI", "23", "121"));

  // Gosāla's fate, through the measure.
  add("As the Buddhists report him", "x_dial_gosala_full", "@s_dial1", "dial1", "There are eighty-four hundred thousand periods during which both fools and wise alike, wandering in transmigration, shall at last make an end of pain. Though the wise should hope : 'By this virtue or this performance of duty, or this penance, or this righteousness will I make the Karma (I have inherited), that is not yet mature, mature' — though the fool should hope, by the same means, to get gradually rid of Karma that has matured — neither of them can do it. The ease and pain, measured out, as it were, with a measure, cannot be altered in the course of transmigration", { ...SPS("20", "72"), label: "Samanna-phala Sutta, Makkhali Gosala's doctrine (page inferred)" });
  uncite("As the Buddhists report him", "There are eighty-four hundred thousand periods during which both fools and wise alike, wandering in transmigration, shall at last make an end of pain.");

  // Gaugamela's date.
  add("Indians still fought for Persia", "x_arr_gaugamela_date", "@s_arrian", "arrian", "Such was the result of this battle, which was fought in the archonship of Aristophanes at Athens, in the month Pyanepsion", { chapter: "III.15" });
  add("Indians still fought for Persia", "x_arr_gaugamela_date_note", "@s_arrian", "arrian", "September 331 B.C. Cf. Plutarch", { chapter: "III.15", label: "Chinnock's note 426" }, "supports", "Chinnock's conversion of the Athenian month.");

  // Misconceptions: the whole sentences.
  add("The clan republics (gaṇa-saṅghas)", "x_wp_gana_full", "@s_wpGana", "wpGana", "The aristocrats were always from kshatriya (warrior) class. This leads many scholars to claim that the true nature of gana sanghas is not comparable to truly democratic institutions.", { section: "Institution" }, "contradicts");
  uncite("The clan republics (gaṇa-saṅghas)", "The aristocrats were always from kshatriya (warrior) class.");
  add("Alexander the Great conquered India.", "x_wp_alex_full", "@s_wpAlexander", "wpAlexander", "The Indian campaign of Alexander the Great began in 327 BC and lasted until 325 BC. After conquering the Achaemenid Persian Empire, the Macedonian army undertook an expedition into the Indus Valley in northwestern South Asia which is modern day Pakistan.", { section: "Lead" }, "contradicts");
  uncite("Alexander the Great conquered India.", "The Indian campaign of Alexander the Great began in 327 BC and lasted until 325 BC.");

  // Joint partials: the ants' gold, and what each Nanda date rests on.
  add("Herodotus knew the Persians' hold", "x_herod_ants_gold", "@s_herod1", "herod1", "These ants then make their dwelling under ground and carry up the sand just in the same manner as the ants found in the land of the Hellenes, which they themselves also very much resemble in form; and the sand which is brought up contains gold.", { page: "259", chapter: "III.102", label: "Book III, ch. 102 (page inferred)" }, "supports", "OCR has a footnote numeral after “themselves” and “j” for the semicolon.");
  reword("The Nandas' dates are uncertain", "depending on the date of the Buddha.", "the first following the Sri Lankan 22 years, the second an assumed date for the Buddha's death.");

  if (!ops.length) {
    console.log("Everything is already fixed. Nothing to do.");
    process.exit(0);
  }
  console.log(log.map((l) => `  ${l}`).join("\n"));
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Fixes from the AI support checks of the Mahājanapadas page (34 single citations and 2 joint judgments).",
      "**Extended quotes**, as new excerpts from the same snapshots:",
      "- the five other teachers in one excerpt, so the assessment note about a blurred scan goes;",
      "- Skylax's whole voyage (Herodotus IV.44);",
      "- Wikipedia's NBPW sentence with its large cities;",
      "- Gosāla's fate “measured out, as it were, with a measure”;",
      "- the full gaṇa-saṅgha and Alexander sentences on the two misconceptions.",
      "**New excerpts for steps the quotes skipped:**",
      "- Jīvaka's advice to visit the Buddha;",
      "- Vassakāra's errand;",
      "- the other three places of pilgrimage (§§ 18–20);",
      "- “Gotama's first discourse”;",
      "- Kusinārā and the Mallas' council hall;",
      "- the Ganges crossing after Pāṭaligāma;",
      "- Gaugamela's date with Chinnock's note;",
      "- the sixteen names as Rhys Davids prints them (OCR of his table);",
      "- the brahmin books ignoring the republics;",
      "- Geiger's 162 years;",
      "- the Purāṇas' Darśaka before Udayin;",
      "- the ants' gold;",
      "- Smith on India in Darius's tomb inscription (the tombs claim had only Wikipedia left once Arrian became a mention).",
      "**Reworded claims:**",
      "- Darius I “on his dates, 521–485 BCE” (Smith's own).",
      "- Geiger used the chronicles' reign-lengths.",
      "- Writing was known “when the early texts were composed”.",
      "- Jacobi: Ajātasattu “conquered Vesālī and laid the foundation…”.",
      "- Udayin “came after Ajātasattu and Darśaka”.",
      "- “After his defeat, Porus” (not “Captured”).",
      "- Xerxes' march without a year; the claim's date keeps 480 BCE as the conventional date.",
      "- “a pottery” (not “glossy”).",
      "- The two Nanda ranges rest on different things.",
      "**Stances to mentions:** Wikipedia on the Sakya oligarchy, the two gaṇasaṅghas, Mahāvīra's historicity, the uncertain and short Buddha dates; Herodotus's Gandarians; Arrian's Indians at Gaugamela on the tombs claim.",
      "Depends on the page changeset and its sources follow-up.",
    ].join("\n"),
    dependsOn,
    ops,
  });
  summarize("mahajanapadas support fixes", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
