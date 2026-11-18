/**
 * Older, public-domain sources for claims on the early medieval page that
 * rested only on Wikipedia: V. A. Smith's Early History of India (1914) on
 * the Rāṣṭrakūṭas, the Chola succession, the Pālas and Kanauj; Alberuni and
 * Sachau on Thanesar and Alberuni's years at Ghazni; Aiyangar (1911) on the
 * Kavirājamārga; South Indian Inscriptions II on Rājarāja's survey and
 * Rājendra's raid. Where the old source disagrees (Smith gives the title
 * Mahāmalla to Mahendravarman; he dates Kanauj's fall to January 1019), it is
 * cited as qualifying. Claims about modern historians (Stein, Sharma, Thapar)
 * keep Wikipedia, since their own books are not public domain.
 *
 * Proposed THROUGH MCP, depending on the page's changeset, whose refs
 * (@s_sii2, @s_alb1, @s_aiyangar) it reuses. Claims are found on the live page
 * by their text; anything already cited is skipped, so the script can be
 * re-run.
 *
 *   pnpm tsx scripts/seed/early-medieval-sources.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { alreadyProposedOrApplied } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const TITLE = "Kingdoms of the early medieval age: older sources for claims that rested on Wikipedia";
const SLUG = "early-medieval-kingdoms";
const DEPENDS = ["Kingdoms of the early medieval age and the Cholas (c. 550–1200 CE): page, sources and entities"];

const CAPTURES = {
  smith1914: { kind: "internet_archive", identifier: "earlyhistoryofin00smit" },
  sii2: { kind: "internet_archive", identifier: "india.history.resource.93073" },
  aiyangar: { kind: "internet_archive", identifier: "cu31924022968840" },
  alb1: { kind: "internet_archive", identifier: "alberunisindiaac01brnm" },
  chau: { kind: "internet_archive", identifier: "chaujukuahiswork00chauuoft" },
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
      else if (o.op === "create_page" && o.slug === SLUG) blocks = o.blocks as BlockInput[];
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
  type Loc = { volume?: string; page?: string; chapter?: string; section?: string; line?: string; label?: string };
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

  const SM = (page: string, label: string): Loc => ({ page, label });
  if (!claims.some((c) => c.citations.some((x) => x.excerpt.quote?.startsWith("The accession in 985 a.d."))))
    ops.push({
      op: "create_source",
      ref: "s_em_smith1914",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Early History of India, from 600 B.C. to the Muhammadan Conquest", author: [{ family: "Smith", given: "Vincent A." }], issued: { "date-parts": [[1914]] }, edition: "3rd", publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: { ia: "earlyhistoryofin00smit", url: "https://archive.org/details/earlyhistoryofin00smit" },
      license: { status: "public_domain", note: "Published 1914; Smith died 1920 (Wikidata). Public domain in India (life + 60) and the US (published before 1931)." },
      lenses: ["colonial_orientalist"],
      note: "Quoted for the views of 1914, not as a current authority.",
    } as ChangeOpInput);
  const SMITH = "@s_em_smith1914";

  if (!claims.some((c) => c.citations.some((x) => x.excerpt.quote?.startsWith("In 1033 the Chu-lien envoy"))))
    ops.push({
      op: "create_source",
      ref: "s_chau",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "Chau Ju-kua: His Work on the Chinese and Arab Trade in the Twelfth and Thirteenth Centuries, entitled Chu-fan-chï", author: [{ literal: "Zhao Rukuo (Chau Ju-kua)" }], translator: [{ family: "Hirth", given: "Friedrich" }, { family: "Rockhill", given: "W. W." }], issued: { "date-parts": [[1911]] }, publisher: "Imperial Academy of Sciences", "publisher-place": "St Petersburg" },
      identifiers: { ia: "chaujukuahiswork00chauuoft", url: "https://archive.org/details/chaujukuahiswork00chauuoft" },
      license: { status: "public_domain", note: "Published 1911; Hirth died 1927 and Rockhill 1914 (Wikidata). Public domain in the US (published before 1931)." },
      lenses: ["primary_source"],
      note: "A thirteenth-century Chinese account of foreign countries, with the translators' notes drawing on the Song history (Sung-shi) and Ma Duanlin.",
    } as ChangeOpInput);

  // Misconception: an empire in South-East Asia. Rājendra's own record claims a raid and treasure, not rule.
  citeRef("The Cholas ruled an empire in South-East Asia.", "x_sii_rj_kadaram", "qualifies", "having despatched many ships in the midst of the rolling sea and having caught Samgramavijayottungavarman, the king of Kadaram, along with (his) vehicles, (viz.) rutting elephants", "Rājendra's own inscription: a fleet sent and a king caught, with his treasure; it claims no rule over the region.");
  // Mamallapuram: Smith gives the title to another king.
  add("Narasiṃhavarman I's title Mamalla", "x_sm_mamalla", SMITH, "smith1914", "The earliest of the remarkable monolithic temples known as the Seven Pagodas at Mamallapuram, namely that now called the Dharmaraja Ratha, was the work of Mahendravarman, who bore the title of Mahamalla, or 'great champion,' from which the name of the place is derived.", SM("474", "Chapter XVI, The Pallavas"), "qualifies", "OCR hyphenates “Mahendra- varman” and has “M'hich”.", "Smith (1914) derives the name from the title Mahāmalla, as here, but gives the title to Mahendravarman I.");
  // The Rāṣṭrakūṭas replace the Chalukyas, 753–973.
  add("In 753 the Rāṣṭrakūṭa Dantidurga", "x_sm_extinct", SMITH, "smith1914", "The main branch of the Chalukyas now became extinct, and the sovereignty of the Deccan passed to the Rashtrakutas, in whose hands it remained for nearly two centuries and a quarter.", SM("427", "Chapter XV, The Rashtrakutas"), "supports", "After Dantidurga “overthrew Kirtivarman II Chalukya” (the OCR of that sentence is too broken to quote). OCR “Ciialukyas”.");
  add("In 753 the Rāṣṭrakūṭa Dantidurga", "x_sm_rk_table", SMITH, "smith1914", "The Rashlrahda Kings of Munyakheta (^Malkhed), a. d. 753-973. Name. Dantidurga (KhaHgavaloka, &c)", SM("437", "Dynastic tables"), "supports", "Quoted in the OCR's spelling: “The Rashtrakuta Kings of Manyakheta (Malkhed), A.D. 753–973. Name. Dantidurga (Khadgavaloka, &c.)”.");
  add("In 753 the Rāṣṭrakūṭa Dantidurga", "x_sm_kalyani", SMITH, "smith1914", "who restored the family of his ancestors to its former glory, and founded the dynasty known as that of the Chalukyas of Kalyani", SM("430", "Chapter XV"), "supports", "Of Taila II, who overthrew the Rāṣṭrakūṭas in 973.");
  // Amoghavarṣa and the Kavirājamārga.
  add("The Rāṣṭrakūṭa Amoghavarṣa I", "x_aiy_kavirajamarga", "@s_aiyangar", "aiyangar", "A work of the ninth century undoubtedly is the Kavirajamarga of Nripatunga.", { page: "315", label: "South Indian literature" }, "supports", "Nṛpatuṅga is a title of Amoghavarṣa I.");
  add("The Rāṣṭrakūṭa Amoghavarṣa I", "x_sm_nripatunga", SMITH, "smith1914", "Amoghavarsha I (Nripatunga, &c.)", SM("437", "Dynastic tables, Rashtrakuta kings of Manyakheta"), "supports", "His titles, in Smith's table of the Rāṣṭrakūṭa kings of Mānyakheṭa.");
  // Kailāsa.
  add("The Kailāsa temple at Ellora", "x_sm_kailasa", SMITH, "smith1914", "The reign of Krishna I is memorable for the execution of the most marvellous architectural freak in India, the Kailasa monolithic temple at Elura (Ellora)", SM("428", "Chapter XV, The Rashtrakutas"), "supports", "OCR “Eliira”.");
  // Indra III and Kanauj.
  add("The Rāṣṭrakūṭas carried their wars to the Ganges", "x_sm_indra_916", SMITH, "smith1914", "In a. d. 916 the armies of the Rashtrakuta king, Indra III, once more captured Kanauj, and gave a severe blow to the power of the Pratihara dynasty.", SM("380", "Chapter XIV, Mahipala"), "supports", "OCR “nu)re”, “Kaiuiuj”.");
  // The Chola succession.
  add("The imperial Chola line began", "x_sm_vijayalaya", SMITH, "smith1914", "We hear of a Chola raja named Vijayalaya, who came to the throne about the middle of the ninth century, and reigned for thirty-four years.", SM("463", "Chapter XVI, The Chola kingdom (page inferred)"));
  add("The imperial Chola line began", "x_sm_rr_985", SMITH, "smith1914", "The accession in 985 a.d. of a strong ruler, Rajaraja-deva the Great, put an end to dynastic intrigue", SM("464", "Chapter XVI, The Chola kingdom"));
  add("The imperial Chola line began", "x_sm_rr_28", SMITH, "smith1914", "In the course of a busy reign of about twenty-eight years, Rajaraja passed from victory to victory", SM("465", "Chapter XVI, Wars of Rajaraja"));
  // Rājarāja's survey.
  add("Around 1000 Rājarāja had a survey", "x_sii_survey", "@s_sii2", "sii2", "We have reason to suppose that the king also carried out a revenue survey and settlement during the period.", { volume: "II", label: "Introduction, on Rājarāja's reign (page not legible in the scan)" }, "supports", "“The period” is his 23rd to 29th years; a later introduction in the volume (it cites reports of 1913), not Hultzsch's.");
  add("Around 1000 Rājarāja had a survey", "x_sii_survey_17", "@s_sii2", "sii2", "This survey appears to have been conducted in the 17th year of Rajaraja", { volume: "II", label: "Introduction, footnote (page not legible in the scan)" }, "supports", "His 17th year is about 1001–02.");
  // The Pālas and the Kaivarta rebellion.
  add("The Pāla kingdom was weakened", "x_sm_kaivarta", SMITH, "smith1914", "His evil deeds provoked a rebellion, headed by Divya or Divyoka, chief of the Chasi-Kaivarta tribe (Kewat caste), which at that time was powerful in Northern Bengal.", SM("400", "Chapter XIV, The Kaivarta rebellion"), "supports", "Of Mahīpāla II, who came to the throne about 1080.", "The eleventh-century rebellion; the dependence on sāmantas is from Wikipedia.");
  // Thanesar and Kanauj.
  add("Mahmud plundered Thanesar", "x_alb_taneshar", "@s_alb1", "alb1", "The city of Taneshar is highly venerated by the Hindus. The idol of that place is called Cakrasvamin, i.e. the owner of the cakra, a weapon which we have already described (page 114). It is of bronze, and is nearly the size of a man. It is now lying in the hippodrome in Ghazna, together with the Lord of Somanath", { volume: "I", page: "117", chapter: "XI", label: "Chapter XI" }, "supports", "OCR “Cakrasvémin, 1.6.”, “aman”, “nowlying”.");
  add("Mahmud plundered Thanesar", "x_sm_kanauj_1019", SMITH, "smith1914", "Early in January, a.d. 1019, he appeared before Kanauj. Rajyapala made no serious attempt to defend his capital, and the seven forts which guarded it all fell into Mahmud's hands in a single day.", SM("383", "Chapter XIV, Sultan Mahmud"), "qualifies", undefined, "Smith dates the fall of Kanauj to January 1019, not 1018.");
  // Embassies to China, from the Song history as the translators summarise it.
  {
    const key = "The Cholas sent repeated embassies to China.";
    const loc = { page: "100", chapter: "I.19", label: "Chola Dominion, translators' note" };
    add(key, "x_chau_1015", "@s_chau", "chau", "The first mission from Chu-lien to China in 1015 stated that the king of their country was called Lo-ts'a-lo-tsa, which probably stands for Raja-raja.", loc, "supports", "Chu-lien is the Chinese name of the Chola country (the chapter is headed “Chola Dominion (Coromandel Coast)”). Hirth and Rockhill summarise Ma Duanlin and the Song history. OCR “Chrna.”.");
    add(key, "x_chau_1033", "@s_chau", "chau", "In 1033 the Chu-lien envoy said his king was called", loc, "supports", "The name given is read as Śrī Rāja Indra Chola (Rājendra).");
    add(key, "x_chau_1077", "@s_chau", "chau", "and in 1077 the king of Chu-lien, his envoy stated at that time, was", loc);
  }
  // Alberuni at Ghazni.
  add("Alberuni had come to Ghazni", "x_alb_hostage", "@s_alb1", "alb1", "the leading men of the country as prisoners of war or as hostages. Among the last was Abu-Raihan Muhammad Ibn Ahmad Alberuni. This happened in the spring and summer of A.D. 1017.", { volume: "I", page: "ix", label: "Sachau's preface" }, "supports", "Of Mahmud's conquest of Khwarizm. OCR “or’ as”, “Abti-Raihin Muham- mad”, “4.1. 1017”.");
  add("Alberuni had come to Ghazni", "x_alb_thirteen", "@s_alb1", "alb1", "during the thirteen years of his life from 1017 to 1030, after he had been carried from his native country to the centre of Mahmud's realm", { volume: "I", page: "xiv", label: "Sachau's preface (page inferred)" });

  if (!ops.length) {
    console.log("Everything is already fixed. Nothing to do.");
    process.exit(0);
  }
  console.log(log.map((l) => `  ${l}`).join("\n"));
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Older, public-domain sources for claims on the early medieval page that rested only on Wikipedia.",
      "**New sources:** V. A. Smith, The Early History of India (3rd ed., 1914), quoted for the views of 1914; Hirth and Rockhill, Chau Ju-kua (1911).",
      "**New excerpts:**",
      "- Smith on the Rāṣṭrakūṭas replacing the Chalukyas (753–973), with Taila's restoration of the Chalukyas;",
      "- Krishna I and the Kailāsa temple;",
      "- Indra III's capture of Kanauj in 916;",
      "- Vijayālaya and Rājarāja's accession in 985 and reign of about 28 years;",
      "- the Kaivarta rebellion against the Pālas;",
      "- Aiyangar (1911) on the ninth-century Kavirājamārga of Nṛpatuṅga, with Smith's table naming Amoghavarṣa I Nṛpatuṅga;",
      "- South Indian Inscriptions II on Rājarāja's revenue survey (his 17th year);",
      "- Alberuni on the Cakrasvāmin of Thanesar lying in Ghazni;",
      "- Sachau on Alberuni taken to Ghazni as a hostage in 1017 and his years there to 1030;",
      "- Hirth and Rockhill's Chau Ju-kua (1911) on the Chola (Chu-lien) missions to China of 1015, 1033 and 1077, from the Song history.",
      "**Qualifying:**",
      "- Smith gives the title Mahāmalla to Mahendravarman, not Narasiṃhavarman.",
      "- Smith dates Kanauj's fall to January 1019.",
      "- Rājendra's own Kaḍāram record, on the misconception about a Chola empire in South-East Asia.",
      "Claims about modern historians (Stein, Sharma, Thapar, the “regional kingdoms” framing) keep Wikipedia: their books are not public domain. Not found in the public-domain texts at hand: Uttaramerūr's ūr, the end of the Cholas in 1279, and the Śrīvijaya motives.",
      "Depends on the page changeset.",
    ].join("\n"),
    dependsOn,
    ops,
  });
  summarize("early medieval older sources", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
