/**
 * Evidence fixes on /p/maurya-empire after the AI support checks of October
 * 2026 (docs/research/2026-10-support-checks.md, table "maurya-empire"):
 * quotes that stopped short of the words that carry the claim are extended
 * (as new excerpts, the short ones withdrawn where the new one contains
 * them), and excerpts the quote check anchored on another page or version
 * than their locator said are re-quoted with the right locator. Every new
 * quote is copied from the same snapshot as the excerpt it extends. Claim
 * rewordings that go with them are in copyedit-maurya.ts.
 */
import type { PageViewJson } from "./copyedit-lib";
import { evidenceFixOps, type EvidenceFix } from "./sources-lib";

const HULTZSCH = "When king Devanampriya Priyadarsin had been anointed twenty";

export const MAURYA_FIXES: EvidenceFix[] = [
  {
    claim: "James Prinsep completed the decipherment",
    why: "the quote gave the 1838 publication but not the decipherment",
    add: [{ like: "In a series of results that he published", quote: "The task was then completed by James Prinsep, an archaeologist, philologist, and official of the East India Company, who was able to identify the rest of the Brahmi characters, with the help of Major Cunningham.", locator: { section: "Decipherment" } }],
  },
  {
    claim: "Scholars identify these kings with",
    why: "the quote listed both Antiochus I and II; Hultzsch's note identifies the edicts' Antiyoka with Antiochus II",
    add: [{ like: HULTZSCH, quote: "Kalsi and Mansehra read Antiyoga, the remaining versions Antiyoka. Antiochus II Theos.", locator: { page: "3", label: "Rock Edict II (Girnar version), note 11" } }],
  },
  {
    claim: "In the twentieth year after his consecration, Aśoka visited",
    why: "the pillar is set up in section B, which the quote stopped before",
    add: [{ like: HULTZSCH, quote: "(He) both caused to be made a stone bearing a horse (?) and caused a stone pillar to be set up, (in order to show) that the Blessed one was born here.", locator: { page: "164", label: "Rummindei pillar inscription, translation, section B" } }],
  },
  {
    claim: "Aśoka publicly declared his repentance",
    why: "the suffering is named in section E, which the quote stopped before",
    // The words are the same in the Kālsī and Shāhbāzgaṛhī translations; the quote check anchors them on the Shāhbāzgaṛhī page (p. 68).
    add: [{ like: HULTZSCH, quote: "(E) For, this is considered very painful and deplorable by Devanampriya, that, while one is conquering an unconquered (country), slaughter, death, and deportation of people (are taking place) there", locator: { page: "68", label: "Rock Edict XIII (Shāhbāzgaṛhī version), translation, section E" } }],
    drop: ["For, this is considered very painful"],
  },
  {
    claim: "Aśoka claims to have provided medical",
    why: "the quote was found on the Girnar page, not on the Kālsī page its locator named; re-quoted from the Kālsī translation, from the start of section A (“in the dominions of king Devanampriya”, his own lands) through the neighbouring kings",
    // Section A runs from p. 28 onto p. 29 with footnotes printed between, so it is quoted in two parts, one per page: as a
    // single quote the check anchored it on the Girnar translation (p. 52). The single quote, applied once in preview, is withdrawn.
    add: [
      { like: HULTZSCH, quote: "(A) Everywhere in the dominions of king Devanampriya Priyadarsin and (of those) who (are his) borderers, such as the Chodas, the Pandyas, the Satiyaputa", locator: { page: "28", label: "Rock Edict II (Kālsī version), translation, section A, beginning" } },
      { like: HULTZSCH, quote: "Kelalaputa, Tamraparni, the Yona king named Antiyoga, and the other kings who are the neighbours of this Antiyoga, — everywhere two (kinds of) medical men were established by king Devanampriya Priyadarsin, (viz.) medical treatment for men and medical treatment for cattle.", locator: { page: "29", label: "Rock Edict II (Kālsī version), translation, section A" } },
    ],
    drop: ["were established by king Devanampriya Priyadarsin, (viz.) medical treatment for men", "(A) Everywhere in the dominions of king Devanampriya Priyadarsin and (of those) who (are his) borderers, such as the Chodas, the Pandyas, the Satiyaputa, the Kelalaputa"],
  },
  {
    claim: "Where medicinal herbs, roots and fruits",
    why: "roots and fruits are in section C, which the quote stopped before",
    add: [{ like: HULTZSCH, quote: "Wherever there were no herbs beneficial to men and beneficial to cattle, everywhere they were caused to be imported and to be planted. (C) Likewise, wherever there were no roots and fruits, everywhere they were caused to be imported and to be planted.", locator: { page: "29", label: "Rock Edict II (Kālsī version), translation, sections B–C" } }],
    drop: ["Wherever there were no herbs"],
  },
  {
    claim: "The Arthaśāstra justifies kingship as a bargain",
    why: "the quote began after the anarchy and ended before the king's side of the bargain",
    add: [{ like: "first elected Manu, the Vaivasvata", quote: "People suffering from anarchy as illustrated by the proverbial tendency of a large fish swallowing a small one (matsyanyayabhibhutah prajah), first elected Manu, the Vaivasvata, to be their king; and allotted one-sixth of the grains grown and one-tenth of merchandise as sovereign dues. Fed by this payment, kings took upon themselves the responsibility of maintaining the safety and security of their subjects (yogakshemavahah)", locator: { label: "Book I, Chapter XIII, “Protection of parties for or against one's own cause in one's own state”" } }],
    drop: ["first elected Manu, the Vaivasvata"],
  },
  {
    claim: "Because these Hellenistic kings' reigns",
    why: "the dating itself was not quoted",
    add: [{ like: HULTZSCH, quote: "If the Alikasudara of edict XIII is Alexander of Epirus, its date would fall between 272 and 255, and if Alexander of Corinth is meant, between 252 and 250.", locator: { page: "xxxi", label: "Introduction" } }],
  },
  {
    claim: "Megasthenes said no Indian was a slave",
    why: "a passage of the chapter that shows slavery in force, not only a limit on it",
    add: [{ like: "It is no crime for Mlechchhas", quote: "Any person who has once voluntarily enslaved himself shall, if guilty of an offence (nishpatitah), be a slave for life.", locator: { label: "Book III, Chapter XIII, “Rules regarding slaves and labourers”" }, stance: "contradicts", note: "The Arthaśāstra's date is debated; it may describe a later state than the Mauryas'." }],
  },
  {
    claim: "The Maurya capital, Pāṭaliputra",
    why: "the quote named Patna but not Pāṭaliputra",
    add: [{ like: "The Mauryan capital (what is today Patna)", quote: "which connected eastern Afghanistan to their capital Pataliputra", locator: { section: "Lead" } }],
  },
  {
    claim: "The Arthaśāstra presents itself as the work",
    why: "the quote was found in Shamasastry's preface, where he quotes the colophon, not in Book XV as its locator said; re-quoted from Book XV",
    add: [{ like: "This Sastra has been made by him who", quote: "but also put down unrighteous, uneconomical and displeasing acts. This Sastra has been made by him who from intolerance (of misrule) quickly rescued the scriptures and the science of weapons and the earth which had passed to the Nanda king.", locator: { label: "Book XV, Chapter I (closing verse)" } }],
    drop: ["This Sastra has been made by him who"],
  },
  {
    claim: "The Arthaśāstra as we have it",
    why: "the colophon re-quoted from Book XV (as above), with Shamasastry's account of the traditional dating and of the case for a later one",
    add: [
      { like: "This Sastra has been made by him who", quote: "but also put down unrighteous, uneconomical and displeasing acts. This Sastra has been made by him who from intolerance (of misrule) quickly rescued the scriptures and the science of weapons and the earth which had passed to the Nanda king.", locator: { label: "Book XV, Chapter I (closing verse)" } },
      { like: "This Sastra has been made by him who", quote: "the work has been assigned by some scholars to the fourth century b.c., and regarded as a genuine work of Kautilya himself", locator: { label: "Shamasastry, preface to the third edition (1929)" } },
      { like: "This Sastra has been made by him who", quote: "Recently, however, Dr. J. Jolly, Dr. R. Schmidt, and Prof. Winternitz came forward with what, in the absence of reliable evidence to the contrary, appear to be weighty reasons for assigning a later date to the Arthasastra.", locator: { label: "Shamasastry, preface to the third edition (1929)" }, stance: "contradicts" },
    ],
    drop: ["This Sastra has been made by him who"],
  },
  {
    claim: "Aśoka conquered Kalinga in the eighth year",
    why: "the quote was found in the Shāhbāzgaṛhī translation (p. 68), not the Kālsī one its locator named; re-quoted with the right locator",
    add: [{ like: HULTZSCH, quote: "When king Devanampriya Priyadarsin had been anointed eight years, (the country of) the Kalingas was conquered by (him).", locator: { page: "68", label: "Rock Edict XIII (Shāhbāzgaṛhī version), translation, section A" } }],
    drop: ["When king Devanampriya Priyadarsin had been anointed eight years, (the country of) the Kalingyas"],
  },
  {
    claim: "Aśoka claimed to have won a “conquest by morality”",
    why: "the quote was found on p. 70 (Shāhbāzgaṛhī), not on p. 48 (Kālsī) as its locator said; re-quoted with the right locator",
    add: [{ like: HULTZSCH, quote: "And this (conquest) has been won repeatedly by Devanampriya both here and among all (his) borderers, even as far as at (the distance of) six hundred yojanas", locator: { page: "70", label: "Rock Edict XIII (Shāhbāzgaṛhī version), translation, section Q" } }],
    drop: ["And this (conquest) has been won repeatedly by Devanampriya both ["],
  },
];

export const mauryaFixes = (view: PageViewJson) => evidenceFixOps(MAURYA_FIXES, view);
