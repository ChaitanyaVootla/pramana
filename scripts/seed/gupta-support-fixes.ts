/**
 * Accuracy fixes to the Gupta Empire page after the AI support checks
 * (docs/research/2026-10-support-checks.md, table "gupta-empire"):
 *
 * - quotes that stopped a clause short are extended, as new excerpts from the
 *   same snapshots;
 * - claims that overstated are reworded (named scholars instead of "many",
 *   Chandragupta II's records to "94 or 95", Yaśodharman's date taken from
 *   the separate well inscription);
 * - translators' brackets no longer carry a claim (Fleet's "(giving)
 *   Garuda-tokens", Legge's "(held to be)", "(other)", "(a portion of)");
 * - stances are corrected (contradicts → qualifies, background → mentions),
 *   with the Gwalior citation note fixed: Mātṛceṭa, not Mihirakula, built the
 *   Sun temple;
 * - the vassal suggestion about Gupta and Ghaṭotkaca becomes its own claim.
 *
 * Proposed THROUGH MCP, depending on the page's changeset and its sources
 * follow-up, whose refs (@s_…, @x_…) it reuses. Claims and citations are found
 * on the live page by their text, so edits by the editor are kept; anything
 * already fixed is skipped, so the script can be re-run.
 *
 *   pnpm tsx scripts/seed/gupta-support-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { alreadyProposedOrApplied } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const TITLE = "The Gupta Empire page: fixes after the AI support checks";
const DEPENDS = [
  "The Gupta Empire (c. 320–550 CE): page, sources and entities",
  "The Gupta Empire: older sources for five claims that rested on Wikipedia",
];

const CAPTURES = {
  fleet: { kind: "internet_archive", identifier: "dli.csl.8714" },
  legge: { kind: "internet_archive", identifier: "recordofbuddhist00fahsuoft" },
  clark: { kind: "internet_archive", identifier: "TheAryabhatiyaOfAryabhata" },
  wpGupta: { kind: "wikipedia", title: "Gupta Empire" },
  wpGuptaNotes: { kind: "url", url: "https://en.wikipedia.org/w/index.php?title=Gupta_Empire&oldid=1373465688" },
} as const;
type Key = keyof typeof CAPTURES;

interface Citation {
  id: string;
  stance: string;
  note: string | null;
  excerpt: { id: string; quote: string | null };
}
interface ClaimView {
  id: string;
  text: string;
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
      if (o.op === "create_claim") claimsById[o.id!] = { id: o.id!, text: o.text as string, citations: [] };
      else if (o.op === "create_excerpt") quotes[o.id!] = (o.quote as string | undefined) ?? null;
      else if (o.op === "cite" && claimsById[o.claim as string])
        claimsById[o.claim as string]!.citations.push({ id: o.id!, stance: o.stance as string, note: (o.note as string | undefined) ?? null, excerpt: { id: o.excerpt as string, quote: quotes[o.excerpt as string] ?? null } });
      else if (o.op === "uncite") for (const c of Object.values(claimsById)) c.citations = c.citations.filter((x) => x.id !== o.citation);
      else if (o.op === "update_claim" && claimsById[o.claim as string] && (o.set as { text?: string }).text) claimsById[o.claim as string]!.text = (o.set as { text: string }).text;
      else if (o.op === "create_page" && o.slug === "gupta-empire") blocks = o.blocks as BlockInput[];
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
    .call<PageView>("get_page", { page: "gupta-empire", format: "json" })
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
  const restance = (key: string, quotePrefix: string, stance: "supports" | "qualifies" | "contradicts" | "mentions", note?: string) => {
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
  type Loc = { page?: string; chapter?: string; section?: string; line?: string; label?: string };
  /** Adds an excerpt (new, from a snapshot) and cites it, unless the claim already cites that quote or a longer one containing it. */
  const add = (key: string, ref: string, source: string, k: Key, quote: string, locator: Loc, stance: "supports" | "qualifies" | "contradicts" | "mentions" = "supports", note?: string, citeNote?: string) => {
    const c = claim(key);
    if (c.citations.some((x) => x.excerpt.quote?.includes(quote))) return;
    if (!ops.some((o) => o.op === "create_excerpt" && (o as { ref?: string }).ref === ref))
      ops.push({ op: "create_excerpt", ref, source, snapshotId: snap[k], quote, locator, ...(note ? { note } : {}) } as ChangeOpInput);
    ops.push({ op: "cite", claim: c.id, excerpt: `@${ref}`, stance, ...(citeNote ? { note: citeNote } : {}) });
    log.push(`add ${ref} → ${key}`);
  };
  /** Cites an excerpt that already exists (by ref from an earlier changeset). */
  const citeRef = (key: string, ref: string, stance: "supports" | "qualifies" | "contradicts" | "mentions", quote: string, note?: string) => {
    const c = claim(key);
    if (c.citations.some((x) => x.excerpt.quote === quote)) return;
    ops.push({ op: "cite", claim: c.id, excerpt: `@${ref}`, stance, ...(note ? { note } : {}) });
    log.push(`cite ${ref} → ${key}`);
  };
  const F = (no: number | null, page: string, label: string, line?: string): Loc => ({ page, ...(line ? { line } : {}), label: no ? `No. ${no}, ${label}` : label });

  // The south: one excerpt with the whole list.
  add("In the south (Dakṣiṇāpatha)", "x_f_south_list", "@s_fleet", "fleet",
    "Kosala, Vyaghraraja of Mahakantara, Mantaraja of Kerala, Mahendra of Pisbtapura, Svamidatta of Kottilra on the hill, Damana of Erandapalla, Vishnugopa of Kafichi, Nilaraja of Avaraiikta, Hastivarman of Vengi, Ugrasena of Palakka, Kubera of Devarashtra, Dhanamjaya of Kusthaiapura, and all the other kings of the region of the south",
    F(1, "13", "Allahabad pillar inscription, translation", "19–20"), "supports",
    "The twelve kings of the south, continuing “capturing and then liberating Mahendra of” from p. 12. Quoted in the OCR's spelling (Piṣṭapura, Koṭṭūra, Kāñcī, Avamukta, Kusthalapura); the corrected spellings match below 95%.");
  add("In the south (Dakṣiṇāpatha)", "x_wp_twelve", "@s_wp_gupta", "wpGupta", "It also credits him with defeating 12 rulers of Dakshinapatha, the southern region", { section: "Samudragupta" });
  // Nine gems: Ryder doubts the details but keeps the core.
  restance("Kālidāsa was one of the “nine gems”", "It is quite true that the details", "qualifies", "Ryder doubts the details of the tradition but accepts that a king Vikramāditya existed.");
  // Faxian's return.
  reword("Faxian then sailed to Ceylon", "and returned to China by sea by way of Java.", "and returned to China by sea, by way of “Java-dvipa”, landing on the Shandong coast.");
  add("Faxian then sailed to Ceylon", "x_l_lao", "@s_legge", "legge", "they reached the shore on the south of mount Lao, on the borders of the prefecture of Ch'ang-kwang", { page: "114", chapter: "XL", label: "Chapter XL" }, "supports", "Legge's note places mount Lao on the south of the Shan-tung promontory.");
  // Hariṣeṇa.
  reword("The poem was composed by Hariṣeṇa", "sāṃdhivigrahika, “minister of peace and war”", "sāṃdhivigrahika, literally “an officer for peace and war”");
  add("The poem was composed by Hariṣeṇa", "x_f_poetical", "@s_fleet", "fleet", "And this poetical composition, — (the work) of the", F(1, "16", "Allahabad pillar inscription, translation, closing lines", "31"), "supports", "The sentence continues with Hariṣeṇa's titles and name; the OCR garbles the titles, so they are not quoted.");
  // Faxian's departure.
  add("The Chinese monk Faxian set out", "x_l_changan2", "@s_legge", "legge", "Fa-hien had been living in Ch'ang-gan. Deploring the mutilated and imperfect state of the collection of the Books of Discipline", { page: "9", chapter: "I", label: "Chapter I" });
  // Nālandā: two scholars named, not "many".
  reword("Xuanzang, who visited in the seventh century", "many scholars identify him with Kumāragupta I", "scholars such as Hartmut Scharfe and Andrea Pinkney identify him with Kumāragupta I");
  // Garuḍa: Fleet has "giving", not "asking for".
  reword("Distant rulers,", "and to have asked for his Garuḍa seal.", "and with what Fleet translates as “Garuda-tokens”; another reading has them asking to use his Garuḍa seal.");
  add("Distant rulers,", "x_wp_garuda", "@s_wp_gupta", "wpGupta", "offered him their daughters in marriage (or according to another interpretation, gifted him maidens), and sought the use of the Garuda-depicting Gupta seal for administering their own territories", { section: "Samudragupta" }, "supports", undefined, "The other reading of the Garuḍa phrase.");
  // Stances.
  restance("Faxian never names the king", "Faxian, a Chinese Buddhist monk, was one of the pilgrims", "mentions", "That his journey fell in Chandragupta II's reign is an inference from the dates.");
  add("How large the empire was", "x_f_pratyanta_full", "@s_fleet", "fleet", "This may denote either the kings within the frontiers of Samatata and the following countries, i.e. the ‘neighbouring kings’ of those countries, or the kings or chieftains just outside the frontiers of them. Upon the interpretation that is accepted, will depend the question whether Samudragupta's empire included those countries, or whether it only extended up to, and was bounded by, their frontiers.", F(1, "14", "Allahabad pillar inscription, Fleet's note on pratyanta-nripati, line 22"));
  uncite("How large the empire was", "Upon the interpretation that is accepted, will depend the question whether Samudragupta's empire included those countries, or whether it only extended up to, and was bounded by, their frontiers.");
  restance("Buddhist tradition recorded by Xuanzang", "a stone- temple", "mentions", "A temple of the Sun built by Mātṛceṭa in the fifteenth year of Mihirakula's reign; it shows Sun worship under his rule, not his own patronage.");
  restance("Fleet (1888) dated the Vākāṭaka", "Prabhavatigupta was the daughter of Chandragupta II", "qualifies", "Later scholarship takes her father to be Chandragupta II, not a later Devagupta.");
  restance("At Udayagiri near Vidiśā", "They are the only site", "mentions");
  restance("Faxian visited Chandragupta II's court", "did not trouble even to mention", "qualifies", "Smith notes Faxian never names the king, though he treats the account as one of Chandragupta II's government.");
  citeRef("Faxian visited Chandragupta II's court", "x_l_king_unnamed", "contradicts", "The king of the country honoured and reverenced him, and served him as his teacher.", "Faxian speaks only of “the king of the country”.");
  // Legge's brackets.
  reword("Faxian also described the Chandalas", "people held to be impure, who lived apart", "whom he calls “wicked men”, who lived apart");
  reword("Faxian wrote that the king governed", "without beheadings or flogging", "without beheadings or other corporal punishments");
  reword("Faxian described the “Middle Kingdom”", "only those who farmed the king's land paid him a share of the harvest", "those who farmed the king's land paid him from what it yielded");
  // Vīrasena.
  reword("Another Udayagiri inscription", "minister of peace and war, Vīrasena,", "hereditary minister for peace and war, Vīrasena Śāba,");
  add("Another Udayagiri inscription", "x_f_vira_office", "@s_fleet", "fleet", "He who holds the position, acquired by hereditary descent, of being a minister of that same saintly sovereign", F(6, "35", "Udayagiri cave inscription of Chandragupta II, translation", "3"), "supports", "The sentence continues “(and) [has been appointed to] (the office of arranging) peace and war”; the square brackets are Fleet's restoration.");
  add("Another Udayagiri inscription", "x_f_vira_name", "@s_fleet", "fleet", "He who, belonging to the Kautsa (gotra) is well-known under the name of Saba, (but is called) Virasena by (his) family-appellation", F(6, "36", "Udayagiri cave inscription of Chandragupta II, translation", "4"));
  // Chandragupta I and the era.
  citeRef("Chandragupta I is usually taken", "x_parg_era", "supports", "The Gupta era was established in A. d. 320, and it may be concluded that this account was closed soon after the commencement of that era");
  // Kahaum.
  add("In 460–461 CE", "x_f_kahaum_reign", "@s_fleet", "fleet", "The inscription refers itself to the reign of the Early Gupta king Skandagupta, It is dated, in words, in the year one hundred and forty-one (A.D. 460-61)", F(15, "66", "Kahaum pillar inscription of Skandagupta, introduction"));
  // Āryabhaṭa's place value.
  add("Āryabhaṭa used a place-value", "x_clark_place", "@s_clark", "clark", "it seems certain to me that Aryabhata could write a number in signs which had no absolutely fixed values in themselves but which had value depending on the places occupied by them (mounting by powers of 10)", { page: "7", label: "Clark's note to the Daśagītikā" });
  // Ajanta.
  citeRef("Cave XVI at Ajanta", "x_wp_spink", "supports", "Walter M. Spink, have argued that most of the work took place over the very brief period from 460 to 480 CE, during the reign of Hindu Emperor Harishena of the Vākāṭaka dynasty.", "Names Hariṣeṇa as a Vākāṭaka king.");
  restance("The most famous monuments in a broadly", "The Saiva sculptures of Elephanta", "supports", "Havell put Elephanta in the same school as Ajanta, perhaps later.");
  citeRef("The label lives on", "x_wp_spink", "supports", "Walter M. Spink, have argued that most of the work took place over the very brief period from 460 to 480 CE, during the reign of Hindu Emperor Harishena of the Vākāṭaka dynasty.", "The later caves were made under the Vākāṭaka king Hariṣeṇa.");
  restance("The label lives on", "In the noble fresco", "mentions", "An earlier instance (1918) of Ajanta drawn into the Gupta age.");
  // Frontier kingdoms.
  add("Frontier kingdoms", "x_f_frontier_list", "@s_fleet", "fleet", "of Samatata, Davaka, Kamarupa, Nepala, Kartripura, and other (countries), and by the Malavas, Arjunayanas, Yaudheyas, Madrakas, Abhiras, Prarjunas", F(1, "14", "Allahabad pillar inscription, translation", "22"));
  // Parṇadatta.
  add("appointed Parṇadatta to govern", "x_f_parnadatta_tr", "@s_fleet", "fleet", "so the king was easy at heart, when he had appointed Parnadatta over the region of the west.", F(14, "63", "Junagadh rock inscription, translation"));
  // The iron pillar.
  reword("Where the iron pillar first stood", "while Fleet thought it had never moved.", "while Fleet (1888) thought the evidence favoured its standing where it was first set up.");
  restance("Where the iron pillar first stood", "is in favour of its being now in its original position", "supports");
  add("The iron pillar at Mehrauli in Delhi", "x_f_posthumous", "@s_fleet", "fleet", "The inscription is a posthumous eulogy of the conquests of a powerful king named Chandra, as to whose lineage no information is given. It is not dated.", F(32, "140", "Meharauli iron pillar inscription, introduction"));
  // Yaśodharman: the dated inscription is a separate one, recording a well.
  {
    const c = claim("Yaśodharman of Daśapura");
    const from = c.text.match(/^Around 53\d CE, /)?.[0];
    if (from) {
      ops.push({
        op: "update_claim",
        claim: c.id,
        set: {
          text: `${c.text.replace(from, "")} A separate inscription of his reign at Mandsaur, recording the building of a well, is dated 533–534 CE.`.replace(/^y/, "Y"),
          when: { start: { year: 533, era: "CE" }, end: { year: 534, era: "CE" }, basis: "The Mandsaur well inscription, Mālava year 589 expired (Fleet 1888, No. 35)" },
        },
      });
      log.push("reword: Yaśodharman");
    }
    add("Yaśodharman of Daśapura", "x_f_well", "@s_fleet", "fleet", "the object of it being only to record the construction of a large well", F(35, "152", "Mandsaur stone inscription of Yasodharman and Vishnuvardhana, introduction"), "supports", undefined, "The dated inscription is this one, not the victory pillars.");
  }
  // Titles: the vassal suggestion becomes its own claim.
  {
    const c = claim("Samudragupta's inscription calls his great-grandfather");
    const vassal = claims.find((x) => x.text.startsWith("Because later feudatories used the title mahārāja"));
    if (!vassal) {
      ops.push({
        op: "create_claim",
        ref: "c_vassals",
        text: "Because later feudatories used the title mahārāja, some have suggested that Gupta and Ghaṭotkaca were vassals, perhaps of the Kushans; this cannot be said with certainty.",
        kind: "interpretation",
        assessment: "contested",
        themes: ["polity"],
        entities: [{ entity: "chandragupta-i", role: "mention" }, { entity: "maharajadhiraja", role: "mention" }],
        foundVia: [{ via: "wikipedia", title: "Wikipedia: Gupta Empire" }],
      } as ChangeOpInput);
      for (const [prefix, stance] of [
        ["In the later period, the title Maharaja", "supports"],
        ["Mahdrdja was habitually used", "supports"],
        ["However, there are several instances", "qualifies"],
      ] as const) {
        const cit = c.citations.find((x) => x.excerpt.quote?.startsWith(prefix));
        if (!cit) continue;
        ops.push({ op: "uncite", citation: cit.id });
        ops.push({ op: "cite", claim: "@c_vassals", excerpt: cit.excerpt.id, stance });
      }
      log.push("new claim c_vassals; vassal citations moved from c_titles");
    }
  }
  add("Samudragupta's inscription calls his great-grandfather", "x_f_titles", "@s_fleet", "fleet", "Mahdrdja , the illustrious Ghatotkacha ; — who was the son of the Mahdrdjddhtrdja, the glorious Chandragupta (L)", F(1, "16", "Allahabad pillar inscription, translation", "28–29"), "supports", "Quoted in the OCR's spelling: “Mahārāja, the illustrious Ghaṭotkaca; who was the son of the Mahārājādhirāja, the glorious Chandragupta (I.)”. The line before calls Gupta “the Mahārāja”.");
  // Āryāvarta.
  add("In the north (Āryāvarta)", "x_f_forest_full", "@s_fleet", "fleet", "who made all the kings of the forest countries to become (his) servants", F(1, "13", "Allahabad pillar inscription, translation", "21"), "supports", "“(his)” is Fleet's addition.");
  uncite("In the north (Āryāvarta)", "who made all the kings of the forest countries");
  // Chandragupta II's years.
  reword("Chandragupta II's dated inscriptions", "from Gupta year 82 to 93 or 95", "from Gupta year 82 to 94 or 95");
  // Kusumapura.
  restance("Āryabhaṭa says his work sets out", "Kusumapura may or may not have been", "mentions");
  // Golden age.
  {
    const c = claim("D. N. Jha argued");
    const m = c.text.match(/^Many historians now dispute the golden-age label\./);
    if (m) {
      ops.push({ op: "update_claim", claim: c.id, set: { text: c.text.replace(m[0], "The golden-age label is disputed.") } });
      log.push("reword: golden-age dispute");
    }
  }
  add("D. N. Jha argued", "x_wp_kushan", "@s_wp_gupta", "wpGuptaNotes", "Archaeological evidence from the earlier Kushan levels suggests greater material prosperity, to such a degree that some historians argue for an urban decline in the Gupta period.", { section: "References" }, "supports", "Wikipedia's footnote quoting Pletcher (2011), p. 90.");
  uncite("D. N. Jha argued", "suggests greater material prosperity, to such a degree that some historians argue for an urban decline in the Gupta period.");

  // The new claim goes on the page, after the titles claim.
  const created = ops.some((o) => o.op === "create_claim");
  if (created) {
    const titles = claim("Samudragupta's inscription calls his great-grandfather");
    const blocks = view.page.blocks.map((b) => {
      if (b.type !== "claims" || !b.claimIds.includes(titles.id)) return b;
      const ids = [...b.claimIds];
      ids.splice(ids.indexOf(titles.id) + 1, 0, "@c_vassals");
      return { ...b, claimIds: ids };
    });
    ops.push({ op: "update_page", page: "gupta-empire", baseVersion: view.page.version, set: { blocks } });
  }

  if (!ops.length) {
    console.log("Everything is already fixed. Nothing to do.");
    process.exit(0);
  }
  console.log(log.map((l) => `  ${l}`).join("\n"));
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Fixes from the AI support checks of the Gupta Empire page (docs/research/2026-10-support-checks.md, 45 items).",
      "**Extended quotes**, as new excerpts from the same snapshots:",
      "- the twelve southern kings (the Allahabad pillar, p. 13, in the OCR's spelling);",
      "- Fleet's full note on “frontier kings”;",
      "- Vīrasena's hereditary office and his name Śāba;",
      "- Kahaum's reign line;",
      "- the posthumous eulogy of Chandra;",
      "- Parṇadatta “easy at heart” in the translation;",
      "- the forest kings “to become (his) servants”;",
      "- Faxian's departure and his landing in Shandong;",
      "- Clark on Āryabhaṭa's place value;",
      "- the Kushan-levels footnote;",
      "- Wikipedia's “12 rulers of Dakshinapatha”.",
      "**Reworded claims:**",
      "- Hariṣeṇa's title (“literally an officer for peace and war”).",
      "- Nālandā: “scholars such as Hartmut Scharfe and Andrea Pinkney”, not “many scholars”.",
      "- The Garuḍa phrase: Fleet's “giving Garuda-tokens”, with the other reading as such.",
      "- The Chandalas: “whom he calls wicked men”, since “held to be” is Legge's bracket.",
      "- Punishments: “other corporal punishments”.",
      "- The royal land: “paid him from what it yielded”.",
      "- Vīrasena Śāba.",
      "- Chandragupta II's records to “94 or 95”.",
      "- The iron pillar's site in Fleet's words.",
      "- Yaśodharman: the 533–534 date belongs to a separate well inscription, not the victory pillars.",
      "- “The golden-age label is disputed”.",
      "**Stances:**",
      "- Ryder on the nine gems: qualifies.",
      "- Smith on Faxian: qualifies, with Legge's unnamed king added as contradicting.",
      "- Prabhāvatīguptā against Fleet's dating: qualifies.",
      "- Mentions: Udayagiri (WP), Faxian's reign (WP), Clark's Kusumapura note, Havell on Ajanta.",
      "- Havell on Elephanta: supports.",
      "- Fleet on the pillar's site: supports.",
      "- The Gwalior Sun temple: mentions, with its note corrected. It was built by Mātṛceṭa in Mihirakula's fifteenth year, not by the king.",
      "**New claim:** the suggestion that Gupta and Ghaṭotkaca were vassals now has its own claim, carrying the three excerpts that the titles claim used to cite. It is placed on the page after the titles claim.",
      "Depends on the page changeset and its sources follow-up.",
    ].join("\n"),
    dependsOn,
    ops,
  });
  summarize("gupta support fixes", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
