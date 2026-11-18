/**
 * Accuracy fixes to the early medieval page after the verifier's support
 * checks (scratchpad verifier/fixlist-round5.json: 16 unsupported citations,
 * 14 partials and 23 joint partials, plus four stance notes from the per-citation
 * judgments):
 *
 * - background sentences cited as support become “mentions”;
 * - claims that said more than their quotes are reworded (Pulakeśin “possibly
 *   killed”, the Kailāsa temple “believed” monolithic, the Cholas “began to
 *   lose” their overseas lands, Alberuni “at times travelled with Mahmud's
 *   troops”, Sulaimān's “Jurz” only “usually identified” with the
 *   Pratihāras, Mahmud's aims as a disagreement between historians);
 * - translators' additions no longer carry a claim (Rājendra's supplied
 *   “(took)”, Rājarāja's “cut the vessel (alam)”, the Uttaramerūr boy who
 *   “does not know what is inside”);
 * - quotes that stopped short are extended, or the missing step quoted
 *   (Ceylon in Rājarāja's list, “Vijayam”, Rājendra's co-regency, the
 *   Khmer appeal, “the northern parts of the Tamil region”, the astronomical
 *   dating, sāmanta as “neighbour”, Grahavarman's death, Smith on “Balhara”).
 *
 * Claim and citation edits only. Depends on the page changeset and its
 * older-sources follow-up, whose refs it reuses.
 *
 *   pnpm tsx scripts/seed/early-medieval-support-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { alreadyProposedOrApplied, claimFixes, changesetsByTitle } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const TITLE = "Kingdoms of the early medieval age: fixes after the support checks";
const DEPENDS = [
  "Kingdoms of the early medieval age and the Cholas (c. 550–1200 CE): page, sources and entities",
  "Kingdoms of the early medieval age: older sources for claims that rested on Wikipedia",
];
const WP = (title: string) => ({ kind: "wikipedia", title }) as const;
const CAPTURES = {
  sii2: { kind: "internet_archive", identifier: "india.history.resource.93073" },
  ei4: { kind: "internet_archive", identifier: "in.ernet.dli.2015.70026" },
  ei6: { kind: "internet_archive", identifier: "in.ernet.dli.2015.56653" },
  asi1904: { kind: "internet_archive", identifier: "in.ernet.dli.2015.207530" },
  aiyangar: { kind: "internet_archive", identifier: "cu31924022968840" },
  harsa: { kind: "internet_archive", identifier: "harsacaritaofban00banaiala" },
  smith1914: { kind: "internet_archive", identifier: "earlyhistoryofin00smit" },
  wpRajendra: WP("Rajendra I"),
  wpSrivijaya: WP("Chola invasion of Srivijaya"),
  wpPallava: WP("Pallava dynasty"),
  wpSamanta: WP("Samanta"),
  wpMahmud: WP("Mahmud of Ghazni"),
} as const;

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  // One correction: once proposed or applied, running again must do nothing (later fixes own these claims).
  const done = flags.force ? null : await alreadyProposedOrApplied(mcp, TITLE);
  if (done) {
    console.log(done === "proposed" ? "A changeset with this title is already waiting for review. Nothing to do." : "This fix is already applied. Nothing to do.");
    process.exit(0);
  }
  const depends = await changesetsByTitle(mcp, DEPENDS);
  const fx = await claimFixes(mcp, { slug: "early-medieval-kingdoms", depends, captures: CAPTURES });
  const { ops, log, reword, restance, uncite, add, citeRef } = fx;
  const SII = (page: string, label: string) => ({ volume: "II", page, label });

  // Kielhorn on the Raghuvaṃśa: the debt, and our inference about Kālidāsa's date.
  add("Because Ravikīrti echoes Kālidāsa's Raghuvaṃśa", "x_ei6_profited", "@s_ei6", "ei6", "He is familiar with the works of India's greatest poets, and seems to have especially profited hy the study of tlmt most ])ci*fcct poem of K&lidasa’s, the EaghuvamSa.", { volume: "VI", page: "3", label: "No. 1, Kielhorn's introduction (page inferred)" }, "supports",
    "Of Ravikīrti. Quoted in the OCR's spelling: “… and seems to have especially profited by the study of that most perfect poem of Kālidāsa's, the Raghuvaṃśa.”");
  reword("Because Ravikīrti echoes Kālidāsa's Raghuvaṃśa", ", a firm latest date for Kālidāsa.", ", which gives a latest date for Kālidāsa.");

  // Background sentences cited as support.
  restance("The Chalukyas ruled the Deccan from Vātāpi", "The political atmosphere in South India", "mentions");
  restance("Harṣa ruled from 606 to 647", "After thirty years his arms reposed", "mentions");
  reword("Harṣa ruled from 606 to 647", "making Kanyākubja (Kannauj) on the Ganges his capital.", "making Kanyākubja (Kannauj) his capital.");
  restance("Xuanzang reports that the people of Mahārāṣṭra", "Siladitya did, in fact, conquer the whole of North India", "mentions", "Beal's own note.");
  restance("Sulaimān called the Balharā", "the account written by a merchant named Sulaiman", "mentions", "Who Sulaimān was, and the date of his account.");
  add("Sulaimān called the Balharā", "x_sm_balhara", "@s_em_smith1914", "smith1914", "They called the Rashtrakuta kings ' Balhara ' because those princes were in the habit of assuming the title Vallabha (' Beloved,' Bien aime), which, in combination with the word Rai (prince), was easily corrupted into the form of Balhara.", { page: "430", label: "Chapter XV, The Rashtrakutas" }, "supports", "Of the Arab writers from Sulaimān on.");
  add("Sulaimān called the Balharā", "x_sm_arab_friends", "@s_em_smith1914", "smith1914", "kept up friendly intercourse with the Arabs, while continually engaged in war with the Gurjaras", { page: "430", label: "Chapter XV, The Rashtrakutas" }, "supports", "Of the Rāṣṭrakūṭa princes. OCR “inter- course”, “Avhile”.");
  restance("Rājarāja's inscriptions open with a list of his conquests", "He was known for his conquests", "mentions");
  restance("Rājarāja's inscriptions open with a list of his conquests", "Rajaraja Chola I launched several naval campaigns", "mentions");
  restance("Rājendra's inscriptions say he", "In 1025, Rajendra Chola launched naval raids", "mentions");
  restance("Rājendra's inscriptions say he", "In response, the Tambralinga kingdom", "mentions");
  restance("Rājendra's inscriptions say he", "In 1025 AD, the Chola Emperor Rajendra I", "mentions");
  restance("Yet the early books of the Rājataraṅgiṇī", "For example, Kalhana has highly exaggerated", "mentions");
  restance("The Pālas built Buddhist monasteries", "Dharmapala, when he made this grant, resided", "mentions");
  restance("The Pālas built Buddhist monasteries", "At its zenith under emperors Dharmapala", "mentions");
  add("The Pālas built Buddhist monasteries", "x_ki_nunna", "@s_ei4", "ei4", "The grant, as already stated, was made to a temple of the god HMnna-ITdrayana", { volume: "IV", page: "246", label: "Kielhorn, introduction (page inferred)" }, "supports",
    "Dharmapāla's grant to a Viṣṇu (Nārāyaṇa) temple. OCR for “Nunna-Nārāyaṇa”.");
  restance("The Rāṣṭrakūṭas carried their wars to the Ganges", "Under Bhoja and his successor Mahendrapala I", "mentions");
  restance("Historians describe the period from the mid-seventh", "Second was the ascendancy of the Brahman", "mentions");
  restance("Rājarāja's elder sister Kundavai", "a gift of money for a lamp", "mentions");
  restance("Pulakeśin II's Aihole inscription", "Harsha was defeated by the Emperor Pulakeshin II", "mentions", "The battle itself; the claim is about the inscription.");
  restance("The Rāṣṭrakūṭa Amoghavarṣa I", "At their peak the Rashtrakutas of Manyakheta", "mentions");
  restance("Alberuni wrote that Mahmud “utterly ruined", "the manner in which the author mentions the dead king", "mentions", "Sachau on Alberuni's tone; it informs the assessment note.");
  restance("The battle was fought on the Narmadā", "the year 3735 since the Bharata war", "supports");

  // Misconceptions.
  restance("After the Guptas India fell into a dark age", "From the mid-seventh to the mid-13th centuries", "mentions");
  citeRef("After the Guptas India fell into a dark age", "x_sm_kailasa", "contradicts", "The reign of Krishna I is memorable for the execution of the most marvellous architectural freak in India, the Kailasa monolithic temple at Elura (Ellora)", "One of the period's achievements.");
  restance("The Cholas ruled an empire in South-East Asia.", "Around 1070, the Cholas began to lose", "qualifies", "They held overseas territories for a time, and began to lose them around 1070.");
  restance("Chola villages were democracies", "The Sabha an exclusively Brahmin", "qualifies", "The Brahmin sabhā was not the only assembly: the ūr included all classes.");

  // Claims that said more than their quotes.
  reword("The Pallava king Narasiṃhavarman I took the Chalukya capital", "and Pulakeśin II was killed, around 642.", "and Pulakeśin II was possibly killed, around 642.");
  reword("Xuanzang, Harṣa's guest in the 640s, wrote", "Xuanzang, Harṣa's guest in the 640s, wrote", "Xuanzang, Harṣa's guest, wrote");
  reword("Xuanzang, Harṣa's guest, wrote", ", and then governed in peace for thirty years.", ", and that after thirty years “his arms reposed, and he governed everywhere in peace”.");
  reword("The Kailāsa temple at Ellora", "was carved out of a single rock", "is believed to have been carved out of a single rock");
  restance("The Kailāsa temple at Ellora", "However, the attribution of the temple to Krishna I", "supports");
  reword("The expedition did not bring lasting Chola rule", "and by about 1070 the Cholas had lost almost all their overseas territories.", "and from about 1070 the Cholas began to lose almost all their overseas territories.");
  reword("Alberuni, who lived at Mahmud's court, records", "Alberuni, who lived at Mahmud's court, records", "Alberuni, who at times travelled with Mahmud's troops, records");
  reword("Historians read Mahmud's aims", "Historians read Mahmud's aims as both monetary and religious:", "Historians disagree on Mahmud's aims: Spencer Tucker saw them as both monetary and religious, Mohammad Habib as plunder alone;");
  add("Historians disagree on Mahmud's aims", "x_mah_tucker", "@s_wpMahmud", "wpMahmud", "Spencer C. Tucker characterize Mahmud's objectives of the Indian campaigns as a combination of financial gain and religious motivations", { section: "War policy" });
  add("Historians disagree on Mahmud's aims", "x_mah_habib", "@s_wpMahmud", "wpMahmud", "[H]is (Mahmud's) expeditions against India were not motivated by religion but by love of plunder.", { section: "War policy" }, "supports", "Wikipedia quoting Mohammad Habib.");
  reword("Elliot's version of Sulaimān", "made from M. Reinaud's French.", "taken from M. Reinaud's.");
  reword("The fuller story of a “dreadful slaughter”", "comes from Ibn al-Athīr, born in 1160, writing about two centuries later; ʿUtbī's contemporary history ends before Somnāth", "comes from Ibn al-Athīr, who was born in 1160; ʿUtbī's history ends before Somnāth");

  // Sulaimān's “Jurz” is only identified with the Pratihāras.
  reword("The Pratihāras held the Arab armies west of the Indus.", "The merchant Sulaimān (851) wrote of their king that", "The merchant Sulaimān wrote in 851 of the king of “Jurz”, usually identified with the Pratihāras, that");
  citeRef("The Pratihāras held the Arab armies west of the Indus.", "x_ed_sulaiman_851", "supports", "the account written by a merchant named Sulaiman, who embarked on the Persian Gulf, and made several voyages to India and China. This bears the date 237 a.h. (851 a.d.).", "The date of Sulaimān's account.");
  reword("Sulaimān also describes a kingdom he calls Ruhmī", "at war with the Pratihāras, whose king went to battle with 50,000 elephants", "at war with the kingdom of “Jurz” (usually taken to be the Pratihāras), whose king was said to go to battle with about 50,000 elephants");

  // Translators' additions.
  {
    const key = "Rājarāja's inscriptions open with a list of his conquests";
    reword(key, "the ships at Kandalūr, Vengi", "Kandalūr, where he “cut the vessel (alam)”, Vengi");
    add(key, "x_sii_rr_ceylon", "@s_sii2", "sii2", "Kollam, Kalingam, Ira-mandalam, (which was the country) of the Singalas who possessed rough strength, the seven and a half lakshas of Iratta-padi, and twelve thousand ancient islands of the sea,—deprived the Seriyas of their splendour", SII("48", "No. 4, translation, para. 1 (Rajaraja's introduction in the 29th-year version)"), "supports",
      "Ira-maṇḍalam, “the country of the Siṃhalas”, is Sri Lanka. OCR “fra-manda- lam”, “dakshas”. What “cut the vessel (alam)” at Kandalūr meant is debated.");
    uncite(key, "twelve thousand ancient islands of the sea,—deprived the Seriyas of their splendour");
  }
  {
    const key = "Rājendra's inscriptions say he";
    reword(key, ", caught Saṅgrāmavijayottuṅgavarman, king of Kaḍāram, and took his heaped-up treasure, listing places that included Śrīviśaya, Malaiyūr and Kaḍāram", " and caught Saṅgrāmavijayottuṅgavarman, king of Kaḍāram; they list, with that king's “large heap of treasures”, places that included “Vijayam” (taken to be Śrīvijaya), Malaiyūr and Kaḍāram");
    add(key, "x_sii_rj_vijayam", "@s_sii2", "sii2", "the “gate of large jewels;” Vijayam, of great fame; Pannai, watered by the river; the ancient Malaiyur (with) a fort situated on a high hill", SII("109", "No. 20, translation"), "supports", "Hultzsch's “Vijayam” is usually read as Śrīvijaya. The verb “(took)” before the list is supplied by the translator.");
  }
  reword("The draw took place before a full meeting", "and a young boy who could not read the tickets drew them from the pot.", "and a young boy standing close, who did not know what was inside, took out each ward's packet.");
  reword("The historian Burton Stein doubted", "and described medieval south India as a “segmentary” state in Peasant, State and Society in Medieval South India (1980).", "and wrote Peasant, State and Society in Medieval South India (1980), whose theme was segmentary lineage.");
  reword("Rājarāja built the great temple at Thanjavur", "an order of his twenty-sixth year protects the gifts made to it by himself, his elder sister, his queens and others.", "an order of his twenty-sixth year has the gifts made to it by himself, his elder sister, his queens and others engraved on the shrine.");
  add("Rājarāja built the great temple at Thanjavur", "x_sii_rr_engraved", "@s_sii2", "sii2", "be engraved on stone on the sacred shrine", SII("8", "No. 1, translation, para. 2"), "supports", "The end of Rājarāja's order: “Let the gifts made by us, … — be engraved on stone on the sacred shrine (śrī-vimāna)!”");

  // Quotes that stopped short.
  add("Bāṇa's story has Harṣa rescue his widowed sister", "x_harsa_grahavarman", "@s_harsa", "harsa", "tidings arrive that Grahavarman has been killed by the king of Malwa", { page: "xii", label: "Translators' preface" }, "supports", "Grahavarman was Rājyaśrī's husband.");
  {
    const key = "Chola inscriptions are dated by the year of the king's reign";
    reword(key, "dated by the year of the king's reign, not by an era:", "dated by the year of the king's reign:");
    add(key, "x_aiy_dating", "@s_aiyangar", "aiyangar", "The dates of commencement of each ruler are those of the astronomically verified ones of Prof. Kielhorn ; while the terminal dates are based upon the last regnal years as yet available from epigraphical sources.", { page: "158", label: "Note to the table of Chola rulers (page inferred)" });
    uncite(key, "the terminal dates are based upon the last regnal years as yet available from epigraphical sources.");
  }
  {
    const key = "Rājaraja's son Rājendra I reigned from 1014 to 1044";
    add(key, "x_ren_coregent", "@s_wpRajendra", "wpRajendra", "Rajendra I (26 July 971 – 1044), often referred to as Rajendra the Great, was a Chola Emperor who reigned from 1014 to 1044. He was born in Thanjavur to Rajaraja I. His queen was Vanavan Mahadevi and he assumed royal power as co-regent with his father in 1012 until his father died in 1014, when Rajendra ascended to the Chola throne.", { section: "Lead" });
    uncite(key, "Rajendra I (26 July 971 – 1044), often referred to as Rajendra the Great, was a Chola Emperor who reigned from 1014 to 1044.");
  }
  {
    const key = "Why Rājendra attacked Śrīvijaya is debated";
    add(key, "x_sri_khmer", "@s_wpSrivijaya", "wpSrivijaya", "Another theory posits that geopolitical and diplomatic factors motivated the invasion. King Suryavarman I of the Khmer Empire sought assistance from Rajendra Chola I against the Tambralinga kingdom.", { section: "Background" });
    uncite(key, "Another theory posits that geopolitical and diplomatic factors motivated the invasion.");
  }
  {
    const key = "The Pallavas ruled the Tamil north";
    add(key, "x_pal_tamil_north", "@s_wpPallava", "wpPallava", "for about six centuries dominated the southern Telugu region and the northern parts of the Tamil region, until the end of the 9th century. Throughout their rule, they remained in constant conflict with both the Chalukyas of Vatapi to the north, and the Tamil kingdoms of Chola and Pandyas to their south.", { section: "Lead" });
    uncite(key, "Throughout their rule, they remained in constant conflict with both the Chalukyas of Vatapi to the north, and the Tamil kingdoms of Chola and Pandyas to their south.");
  }
  add("The word sāmanta, once “neighbour”", "x_sam_neighbour", "@s_wpSamanta", "wpSamanta", "The term 'Samanta' originally meant a 'neighbour' and in the Mauryan period, the term referred to the independent ruler of an adjoining territory", { section: "Early development" });
  citeRef("Calling India feudal applies a European idea", "x_rss_1965", "supports", "The publication of his monograph Indian Feudalism in 1965 caused almost a furore in the academia, generating intense debate and sharp responses both in favour of and against the applicability of the model of \"feudalism\" to the Indian situation at any point of time.", "The debate over whether the model fits.");
  add("Uttaramerūr had two assemblies", "x_asi_b_sabha", "@s_asi1904", "asi1904", "We, the (members of the) assembly of Uttarameru-caturvedimangalam, made (this) settlement for the prosperity of our village in order that wicked men may perish and the rest may prosper.", { label: "Inscription B, translation, lines 17–18 (page not checked)" }, "supports",
    "The rules are the assembly's own; a caturvedimaṅgalam was a village of Brahmins, and the Tamil text calls the body mahāsabhai. OCR “caturvSdiman- galam”.");
  // Older sources where a background citation was the second leg.
  add("Harṣa ruled from 606 to 647", "x_sm_harsha_title", "@s_em_smith1914", "smith1914", "THE REIGN OF HARSHA FROM A.D. 606 TO 647", { page: "335", label: "Chapter XIII, title" });
  add("Harṣa ruled from 606 to 647", "x_sm_harsha_kanauj", "@s_em_smith1914", "smith1914", "resolved to hold a special assembly at Kanauj, then his capital, for the purpose of giving the utmost publicity to the Master's teaching.", { page: "348", label: "Chapter XIII" }, "supports", "Of Harṣa and Xuanzang. OCR “then his ' capital”.");
  add("Rājendra's inscriptions say he", "x_sm_rajendra_fleet", "@s_em_smith1914", "smith1914", "His fleet, crossing the Bay of Bengal, attacked and captured Kadaram (Kidaram), the ancient capital of the kingdom of Prome or Pegu", { page: "466", label: "Chapter XVI, The Chola kingdom" }, "supports", undefined, "Smith (1914) placed Kaḍāram in Burma, an identification later given up.");

  if (!ops.length) {
    console.log("Everything is already fixed. Nothing to do.");
    process.exit(0);
  }
  console.log(log.map((l) => `  ${l}`).join("\n"));
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Fixes from the verifier's support checks of the early medieval page: 16 unsupported citations, 14 partials, 23 joint partials, and four stance notes.",
      "**Background sentences now cited as mentions:** the Chalukya “political atmosphere”, Xuanzang's “after thirty years” on Harṣa's dates, Beal's note, the date of Sulaimān's account on the Balharā claim, Wikipedia summaries on what Rājarāja's and Rājendra's inscriptions say, the Srivijaya background lines, Kalhaṇa's exaggeration, Dharmapāla's residence and the Pāla extent, the Pratihāra peak, the Brahman ascendancy, the Tirumalai merchant's wife, the Narmada defeat on the Aihole claim, the Rāṣṭrakūṭa extent on Amoghavarṣa, Sachau's “cold”, and “regionalism” on the dark-age misconception (which now cites Smith on the Kailāsa temple instead).",
      "**Reworded claims:**",
      "- Pulakeśin II “possibly killed”.",
      "- The Kailāsa temple “is believed to have been carved out of a single rock”.",
      "- From about 1070 the Cholas “began to lose” their overseas lands.",
      "- Alberuni “at times travelled with Mahmud's troops” (not “lived at Mahmud's court”).",
      "- Sulaimān's “Jurz” is “usually identified with the Pratihāras”; the 851 date is now quoted; his 50,000 elephants are “said” and “about”.",
      "- Mahmud's aims: historians disagree (Tucker: monetary and religious; Habib: plunder).",
      "- Xuanzang: “after thirty years his arms reposed”; “in the 640s” dropped.",
      "- Harṣa's capital without “on the Ganges”; Elliot's Sulaimān “taken from M. Reinaud's”; Ibn al-Athīr “born in 1160”, without our estimate of when he wrote; Chola dating without “not by an era”; Ravikīrti's echo “gives a latest date” for Kālidāsa (our inference).",
      "**Translators' additions no longer carry claims:**",
      "- Rājendra's list: “Vijayam” (taken to be Śrīvijaya) is now quoted, and the claim no longer rests on the supplied “(took)”.",
      "- Rājarāja's “cut the vessel (alam)” at Kandalūr is quoted as such; Ceylon (Ira-maṇḍalam, “the country of the Singalas”) is now in the quote.",
      "- The Uttaramerūr boy “did not know what was inside” (not “could not read”).",
      "- Stein's book had the theme of “segmentary lineage”.",
      "- The Thanjavur order has the gifts engraved on the shrine.",
      "**Extended quotes or missing steps:** Grahavarman's death (Rājyaśrī widowed), Aiyangar's astronomical dating, Rājendra's co-regency from 1012, the Khmer appeal, “the northern parts of the Tamil region”, sāmanta as “neighbour”, Kielhorn on Ravikīrti's debt to the Raghuvaṃśa, Dharmapāla's grant to a Viṣṇu temple, Smith on “Balhara” as the Rāṣṭrakūṭa title Vallabha, the Uttaramerūr assembly's own words (Inscription B), the feudalism debate, and Smith (1914) on Harṣa's reign and capital and on Rājendra's fleet, where a background citation had been the second leg.",
      "**Stances:** the Kailāsa attribution caveat and the Aihole date now support; on the misconceptions, “began to lose” and the all-class ūr qualify.",
      "Claim and citation edits only. Depends on the page changeset and its older-sources follow-up.",
    ].join("\n"),
    dependsOn: depends.map((d) => d.id),
    ops,
  });
  summarize("early medieval support fixes", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
