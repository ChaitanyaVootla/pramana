/**
 * Fixes on the Vedic page from the AI support checks (verifier, round 2, and
 * the lead's Out-of-India review): quotes extended, overstatements reworded,
 * stances corrected. See fixes-lib.ts for how objects are found.
 *
 *   pnpm tsx scripts/seed/vedic-fixes.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";

const VEDIC = "The Vedic period (c. 1500–500 BCE): page, sources and entities";
const INDUS = "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities";

await runFixes({
  title: "The Vedic period: accuracy fixes from the support checks",
  parents: [VEDIC, INDUS],
  page: "vedic-period",
  excerpts: [
    { ref: "vx2_mac_book10", like: "vx_mac_book10", quote: "With regard to the tenth book, there can be no doubt that its hymns came into being at a time when the first nine already existed. Its composers grew up in the knowledge of the older books, with which they betray their familiarity at every turn.", locator: { page: "43" } },
    { ref: "vx2_jacobi_invoked", like: "vx_jacobi_treaty", quote: "In these treaties deities of both these nations are invoked.", locator: { page: "723" } },
    { ref: "vx2_mac_strata", like: "vx_mac_conjectural", quote: "Three main literary strata can be clearly distinguished in it by differences in language and style, as well as in religious and social views.", locator: { page: "11" } },
    { ref: "vx2_mac_1300", like: "vx_mac_date", quote: "A lapse of three centuries, say from 1300-1000 B.C., would amply account for the difference between what is oldest and newest in Vedic hymn poetry.", locator: { page: "12" } },
    { ref: "vx2_mac_astro", like: "vx_mac_jacobi", quote: "This theory is based on astronomical calculations connected with a change in the beginning of the seasons", locator: { page: "12" } },
    { ref: "vx2_mac_panjab", like: "vx_mac_ganges", quote: "had already occupied the north-western corner of India which is now called by the Persian name of Panjab", locator: { page: "139" } },
    { ref: "vx2_rv_wealth", like: "vx_rv_cattle", quote: "Make us, thy servants, strong for wealth, and honour our songs with kine and steeds and decoration.", locator: { volume: "2", page: "17", verse: "RV 7.18.2" } },
    { ref: "vx2_rv_tenkings", like: "vx_rv_tenkings", quote: "As to their goal they sped to their destruction: they sought Parushni; e'en the swift returned not. Indra abandoned, to Sudas the manly, the swiftly flying foes, unmanly babblers.", locator: { volume: "2", page: "18", verse: "RV 7.18.9" } },
    { ref: "vx2_elst_homeland", like: "vx_elst_noconquest", quote: "This doesn’t really refute the idea of an Indian Homeland, for these species also occur in India, which has islands of cold climate.", locator: { label: "Section on the history of the theory" } },
    { ref: "vx2_nar_plausible", like: "vx_nar_steppe", quote: "our analysis shows that the only plausible source for the Steppe ancestry is Steppe Middle to Late Bronze Age groups, who not only fit as a source for South Asia", locator: { section: "Bidirectional Mobility Along the Inner Asian Mountain Corridor" } },
    { ref: "vx2_mm_aryas", like: "vx_mm_race", quote: "I have declared again and again that if I say Aryas, I mean neither blood nor bones, nor hair nor skull; I mean simply those who speak an Aryan language.", locator: { page: "120" } },
    { ref: "vx2_amb_gratuitous", like: "vx_ambedkar_invention", quote: "This invention is necessary because of a gratuitous assumption which underlies the Western theory.", locator: { page: "73" } },
    { ref: "vx2_amb_purest", like: "vx_ambedkar_invention", quote: "The assumption is the Indo-Germanic people are the purest", locator: { page: "73" } },
    { ref: "vx2_amb_original", like: "vx_ambedkar_invention", quote: "modern representatives of the original Aryan race. Its first home is assumed to have been somewhere in Europe.", locator: { page: "74" } },
    { ref: "vx2_wp_puranic", like: "vx_wp_puranic", quote: "Reflecting traditional Indian views based on the Puranic chronology, indigenists propose an older date than is generally accepted for the Vedic period", locator: { section: "Lead" } },
  ],
  reword: {
    v_layers: { text: "The Vedic texts form a sequence: the Brāhmaṇas presuppose the hymns, and the Sūtras presuppose the Brāhmaṇas; the language of the oldest Upaniṣads sits between that of the Brāhmaṇas and the Sūtras." },
    v_modern_date: { text: "The bulk of the Ṛgveda is usually dated to about 1500–1000 BCE; a wider range of about 1900–1200 BCE is also given." },
    v_oit: {
      assessmentNote:
        "Wikipedia sums up the idea as having “no relevance or support in mainstream scholarship”. Ancient DNA is a major line of evidence against it: a 2019 study found that “the only plausible source” for the steppe ancestry in South Asia was Steppe groups of the Middle to Late Bronze Age, arriving in the first half of the second millennium BCE. That there was no conquest is common ground: mainstream scholars speak of migration, not invasion.",
    },
    v_mm_race: { text: "Max Müller insisted in 1888 that “Aryan” named those who speak an Aryan language, not a race: to speak of Aryan blood or Aryan eyes was as absurd as a long-headed dictionary." },
    v_ambedkar: { text: "In 1946 B. R. Ambedkar rejected the “theory of invasion” as an invention, made necessary by the “gratuitous assumption” of Western scholars that the Indo-Germanic peoples were “the purest modern representatives of the original Aryan race”." },
    v_videgha_reading: { text: "Albrecht Weber, followed by the translator Eggeling, read the legend as a memory of the eastward spread of Brahmanical culture." },
    v_purusha: { text: "One hymn of the Ṛgveda, the Puruṣa Sūkta (10.90), names four orders of society from the body of the primeval Man: in Griffith's words, the brāhmaṇa “was his mouth”, the rājanya was made of his arms, his thighs became the vaiśya, and from his feet the śūdra was produced." },
    v_ayas: { text: "The Ṛgveda's metal, ayas, was probably copper or bronze; the Atharvaveda distinguishes “dark” ayas from “red”, which, Macdonell thought, suggests the distinction between iron and copper or bronze had only recently been drawn." },
    v_pgw_kuru: { text: "Painted Grey Ware probably corresponds to the middle and later Vedic period and the Kuru-Pañcāla lands, where the Vedic hymns were collected and standardised." },
  },
  add: [
    ["v_book10_late", "vx2_mac_book10", "supports"],
    ["v_book10_late", "vx_wp_books", "qualifies", "Wikipedia counts Book 1 among the later books too."],
    ["v_mitanni", "vx2_jacobi_invoked", "supports"],
    ["v_conjectural", "vx2_mac_strata", "supports"],
    ["v_macdonell_date", "vx2_mac_1300", "supports"],
    ["v_jacobi_early", "vx2_mac_astro", "supports"],
    ["v_rivers", "vx2_mac_panjab", "supports", "The hymns' setting in the Panjab (Macdonell's “Aryan invaders” framing is of 1900)."],
    ["v_cattle", "vx2_rv_wealth", "supports"],
    ["v_tenkings", "vx2_rv_tenkings", "supports"],
    ["v_oit", "vx2_elst_homeland", "supports"],
    ["v_oit", "vx_nar_steppe", "mentions", "Evidence weighed in the assessment, not part of what the advocates argue."],
    ["v_oit", "vx2_nar_plausible", "mentions", "Evidence weighed in the assessment."],
    ["v_oit", "vx_wp_oit_status", "mentions", "The state of scholarship, cited in the assessment."],
    ["v_mm_race", "vx2_mm_aryas", "supports"],
    ["v_ambedkar", "vx2_amb_gratuitous", "supports"],
    ["v_ambedkar", "vx2_amb_purest", "supports"],
    ["v_ambedkar", "vx2_amb_original", "supports"],
    ["v_indigenist_date", "vx2_wp_puranic", "supports"],
    ["v_indigenist_date", "vx_wp_oit_status", "mentions", "The standing of the view, cited in the assessment."],
    ["m_aryan_invasion", "x_dales_nodestruction", "contradicts", "No destruction layer or last defence at Mohenjo-daro (from the Indus page)."],
    ["m_aryan_invasion", "x_giosan_decline", "contradicts", "The cities declined over centuries (from the Indus page)."],
  ],
  remove: [
    ["v_book10_late", "vx_mac_book10"],
    ["v_book10_late", "vx_wp_books"],
    ["v_tenkings", "vx_rv_tenkings"],
    ["v_oit", "vx_nar_steppe"],
  ],
  prose: [
    ["Ambedkar rejected the theory of invasion as an invention built on the idea of a superior race", "Ambedkar rejected the theory of invasion as an invention resting on the assumption that the Indo-Germanic peoples were the purest Aryans"],
  ],
  rationale: [
    "Fixes from the AI support checks of the Vedic page (verifier round 2, 25 items) and the lead's review of the Out-of-India claims.",
    "Quotes extended from the same snapshots: Macdonell on book 10, the three strata, his 1300–1000 BCE estimate, Jacobi's astronomical basis and the Panjab setting; Jacobi on the treaties' gods; Ṛgveda 7.18.2 and 7.18.9; Max Müller's “I mean simply those who speak an Aryan language”; Ambedkar's “gratuitous assumption”; Wikipedia on the Purāṇic chronology.",
    "Out of India: Elst's own statement of the Indian-homeland case is now cited; the genetic and Wikipedia excerpts become “mentions” on the claim that reports the advocates' argument, and the assessment note is softened (“a major line of evidence”) and names its source.",
    "Reworded: the Upaniṣads' place in the sequence (by language), the usual dating, Max Müller's statement, Ambedkar (his words, not “superior race”), Weber and Eggeling on the Videgha legend, the Puruṣa Sūkta in Griffith's wording, “Macdonell thought” on ayas, “middle and later Vedic”. The Aryan-invasion misconception now cites the Indus page's evidence on the cities' decline.",
  ],
});
