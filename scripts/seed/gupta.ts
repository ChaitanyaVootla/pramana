import type { BlockInput, ChangeOpInput, PageSpecInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "The Gupta Empire" era page (c. 320–550 CE), built from a source pack
 * prepared on 2026-10-17. Every quote was machine-checked against the same
 * texts captured here.
 *
 * Primary sources are public-domain translations: J. F. Fleet's Corpus
 * Inscriptionum Indicarum vol. III (1888) for the inscriptions; Legge's Faxian
 * (1886); Clark's Āryabhaṭīya (1930); Ryder's Kālidāsa (1912); Burgess and
 * Indraji's cave inscriptions (1881); Pargiter's Purāṇa text (1913); Cosmas
 * (McCrindle 1897), Procopius (Dewing 1914) and Xuanzang (Beal 1884) for the
 * neighbours. Vincent Smith (1904, 1914, 1919) and E. B. Havell (1918) are
 * quoted as the historians who made the "golden age" label, not as authorities
 * on the period. Wikipedia (tertiary) is used for modern scholarly positions,
 * with the books it cites added by page only; they are copyrighted and were not
 * read here.
 *
 * Translators' spellings are kept in quotes ("Fa-hien", "Lichchhavi"); the
 * OCR's misreadings are corrected only where the matcher still finds the
 * passage at 95% or better.
 */

// ---------------------------------------------------------------- snapshots

const WP_GUPTA_REV = 1373465688;

export const CAPTURES = {
  fleet: { kind: "internet_archive", identifier: "dli.csl.8714" },
  legge: { kind: "internet_archive", identifier: "recordofbuddhist00fahsuoft" },
  pargiter: { kind: "internet_archive", identifier: "dli.csl.5891" },
  clark: { kind: "internet_archive", identifier: "TheAryabhatiyaOfAryabhata" },
  ryder: { kind: "internet_archive", identifier: "kalidasatranslat00kali" },
  burgess: { kind: "internet_archive", identifier: "inscriptionsfro00indrgoog" },
  cosmas: { kind: "internet_archive", identifier: "christiantopogra00cosm" },
  procopius: { kind: "internet_archive", identifier: "b24750281_0001" },
  beal1: { kind: "internet_archive", identifier: "siyukibuddhistre01hsuoft" },
  beal2: { kind: "internet_archive", identifier: "siyukibuddhistre02hsuoft" },
  smith1904: { kind: "internet_archive", identifier: "cu31924024065645" },
  smith1914: { kind: "internet_archive", identifier: "earlyhistoryofin00smit" },
  oxford: { kind: "internet_archive", identifier: "oxfordhistoryofi00smituoft" },
  havell: { kind: "internet_archive", identifier: "historyofaryanru00haveuoft" },
  wpGupta: { kind: "wikipedia", title: "Gupta Empire" },
  // The same revision as rendered HTML: the article's explanatory notes and quoted footnotes are only here.
  wpGuptaNotes: { kind: "url", url: `https://en.wikipedia.org/w/index.php?title=Gupta_Empire&oldid=${WP_GUPTA_REV}` },
  wpPillar: { kind: "wikipedia", title: "Iron pillar of Delhi" },
  wpAjanta: { kind: "wikipedia", title: "Ajanta Caves" },
  wpNalanda: { kind: "wikipedia", title: "Nalanda mahavihara" },
  wpUdayagiri: { kind: "wikipedia", title: "Udayagiri Caves" },
  wpAlchon: { kind: "wikipedia", title: "Alchon Huns" },
  wpHephthalites: { kind: "wikipedia", title: "Hephthalites" },
  wpKidarites: { kind: "wikipedia", title: "Kidarites" },
  wpPrabhavati: { kind: "wikipedia", title: "Prabhavatigupta" },
  wpKalidasa: { kind: "wikipedia", title: "Kalidasa" },
  wpAryabhata: { kind: "wikipedia", title: "Aryabhata" },
  wpSamudragupta: { kind: "wikipedia", title: "Samudragupta" },
  wpKumaragupta: { kind: "wikipedia", title: "Kumaragupta I" },
  wpSkandagupta: { kind: "wikipedia", title: "Skandagupta" },
  wpChandragupta2: { kind: "wikipedia", title: "Chandragupta II" },
} as const;
export type CaptureKey = keyof typeof CAPTURES;

export interface Snap {
  id: string;
  url: string | null;
  revisionId?: number;
  title: string;
}
export type Snaps = Record<CaptureKey, Snap>;

interface SnapshotSummary {
  id: string;
  url: string | null;
  title: string | null;
  meta: { wikipedia?: { revisionId: number; title: string } };
}

export async function captureAll(mcp: Mcp): Promise<Snaps> {
  const out = {} as Snaps;
  for (const [key, origin] of Object.entries(CAPTURES) as [CaptureKey, (typeof CAPTURES)[CaptureKey]][]) {
    const s = await mcp.call<SnapshotSummary>("capture_snapshot", { origin });
    out[key] = {
      id: s.id,
      url: s.url,
      title: s.meta.wikipedia?.title ?? s.title ?? key,
      ...(s.meta.wikipedia ? { revisionId: s.meta.wikipedia.revisionId } : {}),
    };
    console.log(`  ${key}: ${s.id} ${s.title ?? ""}`);
  }
  return out;
}

// ---------------------------------------------------------------- entities

interface WdSummary {
  qid: string;
  when: { edtf: string; basis?: string } | null;
  coordinates: { lat: number; lon: number } | null;
}
interface WdMatch {
  status: "existing" | "pending";
  id: string;
  slug: string | null;
  changesetId?: string;
}

type Kind = "person" | "polity" | "group" | "place" | "site" | "inscription" | "term";
type Alias = { label: string; lang?: string; script?: string; note?: string };
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  when?: Record<string, unknown>;
  spans?: Record<string, unknown>[];
  /** Use Wikidata P569/P570 as a life span (only where Wikidata has day or year precision). */
  life?: boolean;
  /** Use Wikidata's existence dates (polities). */
  wdWhen?: boolean;
  /** Use Wikidata coordinates, with this certainty. */
  geo?: "exact" | "approximate";
  geoNote?: string;
  /** Curated aliases. Wikidata's aliases for these items are mostly noise, so none are imported. */
  aliases?: Alias[];
  /** How this entity relates to the Gupta Empire (for the page's timeline and map). */
  link?: "ruled" | "related_to" | "contemporary_of";
  linkNote?: string;
}

const d = (year: number, month?: number, day?: number) => ({
  year,
  era: "CE" as const,
  ...(month ? { month } : {}),
  ...(day ? { day } : {}),
});
const c_ = (year: number, uncertain = false) => ({ year, era: "CE" as const, approximate: true, ...(uncertain ? { uncertain } : {}) });

const WP_RULERS = `Wikipedia, Gupta Empire (rev. ${WP_GUPTA_REV})`;

export const ENTITIES: EntitySpec[] = [
  // Rulers
  {
    ref: "cg1", slug: "chandragupta-i", kind: "person", label: "Chandragupta I", qid: "Q849802", link: "ruled",
    description: "The first Gupta king to take the title “great king of kings”; husband of the Licchavi princess Kumāradevī. His reign is usually taken to begin the Gupta era (319–320 CE).",
    aliases: [{ label: "Candragupta I", lang: "sa-Latn" }],
    spans: [{ role: "reign", when: { start: c_(319), end: c_(335, true), label: "c. 319–c. 335/350", basis: `Conventional: from the Gupta era's epoch (319–320; Fleet 1888) to Samudragupta's accession, put at about 335 or 350 (${WP_RULERS})` } }],
  },
  {
    ref: "samudragupta", slug: "samudragupta", kind: "person", label: "Samudragupta", qid: "Q1133363", link: "ruled",
    description: "Gupta emperor, son of Chandragupta I and Kumāradevī. His conquests are known mainly from the praise poem on the Allahabad pillar.",
    spans: [{ role: "reign", when: { start: c_(335, true), end: c_(375), label: "c. 335/350–c. 375", basis: `${WP_RULERS}: “succeeded his father around 335 or 350 CE, and ruled until c. 375”` } }],
  },
  {
    ref: "cg2", slug: "chandragupta-ii", kind: "person", label: "Chandragupta II", qid: "Q844536", link: "ruled",
    description: "Gupta emperor, also called Vikramāditya, who conquered the Western Satraps of Gujarat and Saurashtra. Faxian travelled in India during his reign.",
    aliases: [{ label: "Vikramāditya", lang: "sa-Latn", note: "His title on coins and in later tradition" }, { label: "Devagupta", lang: "sa-Latn", note: "The name given to Prabhāvatīguptā's father in Vākāṭaka grants" }],
    spans: [{ role: "reign", when: { start: c_(375), end: c_(415), basis: `${WP_RULERS}: “ruled from 375 until 415”. His own dated records run from Gupta year 82 to 93 or 95, c. 401–414 (Fleet 1888)` } }],
  },
  {
    ref: "kg1", slug: "kumaragupta-i", kind: "person", label: "Kumāragupta I", qid: "Q470715", link: "ruled",
    description: "Gupta emperor, son of Chandragupta II, also called Mahendrāditya. Often identified with the Śakrāditya who, Xuanzang says, founded the monastery at Nālandā.",
    aliases: [{ label: "Kumaragupta I", lang: "en" }, { label: "Mahendrāditya", lang: "sa-Latn" }],
    spans: [{ role: "reign", when: { start: c_(415), end: c_(455), basis: "Wikipedia, Kumaragupta I: c. 415 until c. 455 (some put the end at c. 450). His dated records run from Gupta year 96 to 130-odd, c. 415–450 (Fleet 1888)" } }],
  },
  {
    ref: "skandagupta", slug: "skandagupta", kind: "person", label: "Skandagupta", qid: "Q1275876", link: "ruled",
    description: "Gupta emperor who fought the Hūṇas; his records run from 455 to about 467 CE. Usually counted the last of the great Gupta kings.",
    spans: [{ role: "reign", when: { start: c_(455), end: c_(467), basis: "Wikipedia, Skandagupta: r. c. 455–467; his records run from Gupta year 136 to 148 (Fleet 1888 and later finds)" } }],
  },
  {
    ref: "budhagupta", slug: "budhagupta", kind: "person", label: "Budhagupta", qid: "Q4689872", link: "ruled",
    description: "Gupta king of the later fifth century, named as reigning in an inscription at Eran of 484–485 CE.",
    spans: [{ role: "reign", when: { start: c_(476), end: c_(495), basis: `${WP_RULERS}, list of later rulers: Budhagupta (476–495). The Eran pillar of Gupta year 165 (484–485) falls in his reign` } }],
  },
  {
    ref: "kumaradevi", slug: "kumaradevi", kind: "person", label: "Kumāradevī", qid: "Q27623166", link: "related_to", linkNote: "Queen of Chandragupta I, mother of Samudragupta.",
    description: "A princess of the Licchavi family, queen of Chandragupta I and mother of Samudragupta.",
    aliases: [{ label: "Kumaradevi", lang: "en" }],
  },
  {
    ref: "prabhavati", slug: "prabhavatigupta", kind: "person", label: "Prabhāvatīguptā", qid: "Q7237244", link: "related_to", linkNote: "Daughter of Chandragupta II, queen and regent of the Vākāṭakas.",
    description: "Daughter of Chandragupta II, married to the Vākāṭaka king Rudrasena II; after his death she ruled the Vākāṭaka kingdom as regent.",
    aliases: [{ label: "Prabhavatigupta", lang: "en" }],
  },
  {
    ref: "harishena_poet", slug: "harishena-poet", kind: "person", label: "Hariṣeṇa (poet)", link: "related_to", linkNote: "Samudragupta's officer and poet.",
    description: "Samudragupta's officer, with the title “minister of peace and war”, who composed the praise poem on the Allahabad pillar. Not to be confused with the Vākāṭaka king Hariṣeṇa.",
    aliases: [{ label: "Harishena", lang: "en", note: "Fleet's spelling" }],
  },
  // Others of the period
  {
    ref: "faxian", slug: "faxian", kind: "person", label: "Faxian", qid: "Q312978", link: "related_to", linkNote: "Travelled through the Gupta lands, c. 400–411.",
    description: "Chinese Buddhist monk who travelled to India and Sri Lanka in 399–414 to find books of monastic rules, and wrote an account of his journey.",
    aliases: [{ label: "Fa-hien", lang: "en", note: "Legge's spelling (1886)" }, { label: "Fa-hsien", lang: "en" }, { label: "法顯", lang: "zh", script: "Hant" }],
    spans: [{ role: "activity", when: { start: d(399), end: d(414), basis: "His journey, as dated by Legge (1886): set out in 399, back after about fifteen years" } }],
  },
  {
    ref: "kalidasa", slug: "kalidasa", kind: "person", label: "Kālidāsa", qid: "Q7011", link: "related_to", linkNote: "Usually placed in the Gupta period; his dates are uncertain.",
    description: "Sanskrit poet and playwright, author of Śakuntalā and the Cloud Messenger. His dates are not known; most scholars place him in the Gupta period.",
    aliases: [{ label: "Kalidasa", lang: "en" }, { label: "कालिदास", lang: "sa", script: "Deva" }],
    spans: [{ role: "floruit", when: { start: c_(400, true), end: c_(500, true), label: "probably 5th century", basis: "Ryder (1912): “probably lived in the fifth century … by no means certain”" } }],
  },
  {
    ref: "aryabhata", slug: "aryabhata", kind: "person", label: "Āryabhaṭa", qid: "Q11359", link: "related_to", linkNote: "Wrote at Kusumapura (Pāṭaliputra) in 499.",
    description: "Astronomer and mathematician, author of the Āryabhaṭīya (499 CE), which he says sets out the science honoured at Kusumapura.",
    aliases: [{ label: "Aryabhata", lang: "en" }, { label: "आर्यभट", lang: "sa", script: "Deva" }],
    spans: [{ role: "life", when: { edtf: "0476/", basis: "Born 476: Āryabhaṭīya III.10, as worked out by Clark (1930). Death unknown" } }],
  },
  // The Hūṇas and others at the end of the period
  {
    ref: "toramana", slug: "toramana", kind: "person", label: "Toramāṇa", qid: "Q2588669", link: "related_to", linkNote: "Hūṇa king who took eastern Malwa from the Guptas.",
    description: "Hūṇa (Alchon Hun) king who ruled eastern Malwa, including Eran, around 500 CE.",
    aliases: [{ label: "Toramana", lang: "en" }],
  },
  {
    ref: "mihirakula", slug: "mihirakula", kind: "person", label: "Mihirakula", qid: "Q2573564", link: "related_to", linkNote: "Hūṇa king, son of Toramāṇa.",
    description: "Hūṇa (Alchon Hun) king, son of Toramāṇa, who ruled in northern and central India in the early sixth century.",
    aliases: [{ label: "Mahirakula", lang: "en", note: "Beal's spelling (1884)" }],
  },
  {
    ref: "yashodharman", slug: "yashodharman", kind: "person", label: "Yaśodharman", qid: "Q1262907", link: "contemporary_of",
    description: "King of Daśapura (Mandsaur) in Malwa who claimed, about 532 CE, to rule lands the Guptas never held and to have humbled Mihirakula.",
    aliases: [{ label: "Yasodharman", lang: "en" }, { label: "Yashodharman", lang: "en" }],
    spans: [{ role: "floruit", when: { start: c_(532), basis: "Mandsaur inscription of Mālava year 589 (532–534 CE; Fleet 1888)" } }],
  },
  {
    ref: "harishena_vakataka", slug: "harishena-vakataka", kind: "person", label: "Hariṣeṇa (Vākāṭaka king)", qid: "Q27957422", link: "contemporary_of",
    description: "Vākāṭaka king of the later fifth century in whose reign several of the later Ajanta caves were made.",
    aliases: [{ label: "Harishena", lang: "en" }],
  },
  {
    ref: "xuanzang", slug: "xuanzang", kind: "person", label: "Xuanzang", qid: "Q42063", life: true,
    description: "Chinese Buddhist monk who travelled in India in the seventh century; his account records traditions about Nālandā and Mihirakula.",
    aliases: [{ label: "Hiuen Tsiang", lang: "en", note: "Beal's spelling (1884)" }],
  },
  {
    ref: "cosmas", slug: "cosmas-indicopleustes", kind: "person", label: "Cosmas Indicopleustes", qid: "Q355633",
    description: "Greek-speaking merchant and writer of the sixth century whose Christian Topography describes India's White Huns and Sri Lanka's trade.",
  },
  {
    ref: "peroz", slug: "peroz-i", kind: "person", label: "Peroz I", qid: "Q310233",
    description: "Sasanian king of Persia who was killed fighting the Hephthalites in 484.",
    aliases: [{ label: "Perozes", lang: "en", note: "Procopius, in Dewing's translation" }],
    spans: [{ role: "reign", when: { start: d(459), end: d(484), basis: "Wikidata Q310233 (description: Sasanian emperor 459–484); Wikipedia, Hephthalites: killed at the battle of Herat, 484" } }],
  },
  // Historians of the period
  { ref: "fleet", slug: "j-f-fleet", kind: "person", label: "J. F. Fleet", qid: "Q2579695", life: true, description: "British epigraphist who edited and translated the Gupta inscriptions (1888) and fixed the Gupta era at 319–320 CE.", aliases: [{ label: "John Faithfull Fleet", lang: "en" }] },
  { ref: "vasmith", slug: "vincent-a-smith", kind: "person", label: "Vincent A. Smith", qid: "Q2526510", life: true, description: "British historian of India, a civil servant in India, whose Early History of India (1904) called the Gupta period a golden age and Samudragupta “the Indian Napoleon”.", aliases: [{ label: "Vincent Arthur Smith", lang: "en" }] },
  { ref: "havell", slug: "e-b-havell", kind: "person", label: "E. B. Havell", qid: "Q5392799", life: true, description: "British art historian and champion of Indian art; author of The History of Aryan Rule in India (1918).", aliases: [{ label: "Ernest Binfield Havell", lang: "en" }] },
  // Polities
  { ref: "alchon", slug: "alchon-huns", kind: "polity", label: "Alchon Huns", qid: "Q21050766", wdWhen: true, link: "contemporary_of", description: "Hun people from Central Asia who invaded north-western and central India around 500 CE under Toramāṇa and Mihirakula; the Hūṇas of Indian inscriptions.", aliases: [{ label: "Alkhon", lang: "en" }, { label: "Hūṇa", lang: "sa-Latn", note: "The Indian name, which also covered other Hun groups" }] },
  { ref: "hephthalites", slug: "hephthalites", kind: "polity", label: "Hephthalites", qid: "Q26576", wdWhen: true, link: "contemporary_of", description: "Hun confederation based in Bactria (northern Afghanistan) in the fifth and sixth centuries; the “White Huns” of Byzantine writers, who defeated Persia in 484.", aliases: [{ label: "White Huns", lang: "en", note: "Procopius and Cosmas; also used loosely for other Hun groups" }, { label: "Ephthalitae", lang: "en", note: "Procopius, in Dewing's translation" }] },
  { ref: "sasanian", slug: "sasanian-empire", kind: "polity", label: "Sasanian Empire", qid: "Q83891", wdWhen: true, link: "contemporary_of", description: "The Persian empire of the Sasanian kings (224–651 CE), the Guptas' great western contemporary.", aliases: [{ label: "Sassanid Empire", lang: "en" }] },
  // Places, sites and inscriptions
  { ref: "allahabad_pillar", slug: "allahabad-pillar", kind: "inscription", label: "Allahabad pillar", qid: "Q4730345", geo: "exact", link: "related_to", description: "A stone column in the fort at Allahabad (Prayāga) carrying Aśoka's edicts and Samudragupta's praise poem; it may first have stood at Kauśāmbī.", aliases: [{ label: "Prayāga pillar", lang: "en" }, { label: "Allahabad Pillar", lang: "en" }] },
  { ref: "iron_pillar", slug: "iron-pillar-of-delhi", kind: "inscription", label: "Iron pillar, Mehrauli", qid: "Q543419", geo: "exact", link: "related_to", description: "An iron pillar in the Qutb complex at Mehrauli, Delhi, inscribed with a posthumous praise of a king named Chandra. Who he was, and where the pillar first stood, are debated.", aliases: [{ label: "Iron pillar of Delhi", lang: "en" }, { label: "Meharauli iron pillar", lang: "en", note: "Fleet's spelling" }] },
  { ref: "bhitari", slug: "bhitari-pillar", kind: "inscription", label: "Bhitari pillar", qid: "Q48724528", geo: "exact", link: "related_to", description: "A stone pillar at Bhitari, near Ghazipur, whose inscription tells of Skandagupta's wars against the Pushyamitras and the Hūṇas.", aliases: [{ label: "Bhitari pillar inscription of Skandagupta", lang: "en" }] },
  { ref: "eran", slug: "eran", kind: "site", label: "Eran", qid: "Q1347967", geo: "exact", link: "related_to", description: "An ancient town (Airikina) on the Bina river in Madhya Pradesh, with Gupta and Hūṇa inscriptions, a pillar for Viṣṇu and a colossal stone boar.", aliases: [{ label: "Airikina", lang: "sa-Latn", note: "The ancient name (Fleet)" }, { label: "Erakina", lang: "sa-Latn" }] },
  { ref: "udayagiri", slug: "udayagiri-caves", kind: "site", label: "Udayagiri caves", qid: "Q4250472", geo: "exact", link: "related_to", description: "Rock-cut shrines near Vidiśā in Madhya Pradesh, with inscriptions of Chandragupta II's reign (401 CE) and a colossal relief of Varāha.", aliases: [{ label: "Udayagiri Caves, Vidisha", lang: "en" }], when: { start: d(401), basis: "Cave inscription of Gupta year 82 (401–402 CE), Fleet 1888 no. 3" } },
  { ref: "mandsaur", slug: "mandsaur", kind: "place", label: "Mandsaur (Daśapura)", qid: "Q1922275", geo: "approximate", link: "related_to", description: "Town in western Malwa, ancient Daśapura, where silk weavers built a temple of the Sun in Kumāragupta's reign and Yaśodharman set up his victory pillars.", aliases: [{ label: "Daśapura", lang: "sa-Latn" }, { label: "Dasapura", lang: "en" }, { label: "Mandasor", lang: "en", note: "Fleet's spelling" }] },
  { ref: "ajanta", slug: "ajanta-caves", kind: "site", label: "Ajanta caves", qid: "Q184427", geo: "exact", link: "contemporary_of", linkNote: "Its later caves were made under the Vākāṭakas, the Guptas' southern neighbours.", description: "Buddhist rock-cut monasteries and shrines in Maharashtra. The later caves, with the famous paintings, were made under the Vākāṭaka kings in the later fifth century.", aliases: [{ label: "Ajanta Caves", lang: "en" }] },
  { ref: "nalanda", slug: "nalanda", kind: "site", label: "Nālandā", qid: "Q216243", geo: "exact", link: "related_to", description: "Buddhist monastery and centre of learning in Bihar. Its founding is credited to a king Śakrāditya, often identified with Kumāragupta I; the date is uncertain.", aliases: [{ label: "Nalanda", lang: "en" }, { label: "Nalanda mahavihara", lang: "en" }] },
];

/** Glossary terms (kind "term"). */
const TERMS: EntitySpec[] = [
  { ref: "t_era", slug: "gupta-era", kind: "term", label: "Gupta era", description: "The calendar used in the Gupta inscriptions. Its year 0 fell in 319–320 CE, so a Gupta year plus about 320 gives the year CE: Gupta year 82 is 401–402.", aliases: [{ label: "Gupta-Samvat", lang: "sa-Latn", note: "Fleet's term" }] },
  { ref: "t_maharajadhiraja", slug: "maharajadhiraja", kind: "term", label: "mahārājādhirāja", description: "“Great king of kings”: the title of the Gupta emperors from Chandragupta I on. Their ancestors, and later the rulers under them, were called mahārāja, “great king”.", aliases: [{ label: "maharajadhiraja", lang: "en" }, { label: "mahārāja", lang: "sa-Latn", note: "“great king”, the lesser title" }] },
  { ref: "t_prashasti", slug: "prashasti", kind: "term", label: "praśasti", description: "A poem in praise of a king or patron, carved on stone. It tells the patron's side of the story, so its claims need checking against other evidence.", aliases: [{ label: "prashasti", lang: "en" }] },
  { ref: "t_feudatory", slug: "feudatory", kind: "term", label: "feudatory", description: "A local ruler who governed under an overlord and acknowledged him in his own records, as a mahārāja at Udayagiri acknowledged Chandragupta II." },
  { ref: "t_aryavarta", slug: "aryavarta", kind: "term", label: "Āryāvarta", description: "An old name for northern India, between the Himalaya and the Vindhya hills. Fleet translates it “the abode of the Aryas, or excellent or noble people”.", aliases: [{ label: "Aryavarta", lang: "en" }] },
  { ref: "t_dakshinapatha", slug: "dakshinapatha", kind: "term", label: "Dakṣiṇāpatha", description: "“The road of the south”: the old name for southern India, the land beyond the Narmadā river.", aliases: [{ label: "Dakshinapatha", lang: "en" }, { label: "Deccan", lang: "en", note: "The English name comes from the same word" }] },
  { ref: "t_ashvamedha", slug: "ashvamedha", kind: "term", label: "aśvamedha", description: "The horse sacrifice: an ancient royal ritual by which a king claimed to be supreme over other kings. Gupta records say Samudragupta revived it.", aliases: [{ label: "ashvamedha", lang: "en" }, { label: "horse sacrifice", lang: "en" }] },
  { ref: "t_chandala", slug: "chandala", kind: "term", label: "Caṇḍāla", description: "A community treated as impure and made to live apart, at the bottom of the social order. Faxian describes how they had to announce themselves in towns.", aliases: [{ label: "Chandala", lang: "en", note: "Legge's spelling" }] },
  { ref: "t_vihara", slug: "vihara", kind: "term", label: "vihāra", description: "A Buddhist monastery: a house for monks, often with a shrine. Faxian and Xuanzang also use the word saṅghārāma.", aliases: [{ label: "vihara", lang: "en" }, { label: "saṅghārāma", lang: "sa-Latn" }] },
  { ref: "t_guild", slug: "guild", kind: "term", label: "guild", description: "An association of people in one trade, such as the silk weavers of Daśapura or the oil-men of Indrapura. Guilds held money in trust and paid for temples.", aliases: [{ label: "śreṇī", lang: "sa-Latn" }] },
  { ref: "t_huna", slug: "huna", kind: "term", label: "Hūṇa", description: "The Indian name for the Huns who came from Central Asia in the fifth and sixth centuries. Which Hun groups it covers (Kidarites, Alchons) is still debated.", aliases: [{ label: "Huna", lang: "en" }, { label: "Hun", lang: "en" }] },
  { ref: "t_varaha", slug: "varaha", kind: "term", label: "Varāha", description: "The god Viṣṇu in the form of a boar. Colossal Gupta-period images of him survive at Udayagiri and Eran.", aliases: [{ label: "Varaha", lang: "en" }] },
  { ref: "t_sati", slug: "sati", kind: "term", label: "satī", description: "The burning of a widow on her husband's funeral pyre. A memorial at Eran dated 510–511 CE records one, an early instance.", aliases: [{ label: "sati", lang: "en" }, { label: "suttee", lang: "en", note: "Older British spelling" }] },
  { ref: "t_tirthankara", slug: "tirthankara", kind: "term", label: "Tīrthaṅkara", description: "One of the twenty-four great teachers of the Jains, whose images were set up for worship.", aliases: [{ label: "Tirthankara", lang: "en" }] },
];

/** Entities already on the platform that the page links to its polity (none are linked yet). */
const EXISTING_LINKS: { slug: string; type: "related_to" | "contemporary_of"; note: string }[] = [
  { slug: "pataliputra", type: "related_to", note: "The old Mauryan capital, a royal city under the Guptas; Faxian and Āryabhaṭa (as Kusumapura) describe it." },
  { slug: "ujjain", type: "related_to", note: "City in western Malwa known to Kālidāsa." },
  { slug: "sanchi", type: "related_to", note: "Buddhist site with a gift recorded in Chandragupta II's reign (412–413 CE)." },
  { slug: "sarnath", type: "related_to", note: "The Deer Park near Varanasi, visited by Faxian." },
  { slug: "girnar", type: "related_to", note: "The Junāgaḍh rock bears Skandagupta's record of the Sudarśana lake (455–458 CE)." },
  { slug: "vakataka-empire", type: "contemporary_of", note: "Southern neighbours, allied by the marriage of Prabhāvatīguptā." },
  { slug: "western-satraps", type: "contemporary_of", note: "Conquered by Chandragupta II." },
  { slug: "kidarites", type: "contemporary_of", note: "Hun rulers of the north-west in the fifth century." },
  { slug: "pallava-dynasty", type: "contemporary_of", note: "Rulers of Kāñchī in the south." },
  { slug: "kushan-empire", type: "contemporary_of", note: "The Kushans' heirs in the north-west are named in Samudragupta's inscription." },
];

export interface ResolvedEntities {
  /** ref → the value to use in ops ("@ref" if created here, else an id or slug). */
  ref: Record<string, string>;
  ops: ChangeOpInput[];
  dependsOn: string[];
  reused: string[];
}

/** Builds create_entity ops from Wikidata (looked up now), skipping anything that already exists or is pending. */
export async function entityOps(mcp: Mcp): Promise<ResolvedEntities> {
  const specs = [...ENTITIES, ...TERMS];
  const qids = specs.flatMap((s) => (s.qid ? [s.qid] : []));
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids });
  const out: ResolvedEntities = { ref: { gupta: "gupta-empire" }, ops: [], dependsOn: [], reused: [] };
  for (const s of specs) {
    const m = s.qid ? matches[s.qid] : undefined;
    if (m) {
      out.ref[s.ref] = m.slug ?? m.id;
      if (m.status === "pending" && m.changesetId) out.dependsOn.push(m.changesetId);
      out.reused.push(`${s.slug} → ${m.status} ${m.slug ?? m.id}`);
      continue;
    }
    const bySlug = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: s.slug }).catch(() => null);
    if (bySlug?.entity?.id) {
      out.ref[s.ref] = s.slug;
      out.reused.push(`${s.slug} → existing (by slug)`);
      continue;
    }
    const wd = s.qid ? await mcp.call<WdSummary | null>("wikidata", { qid: s.qid }) : null;
    const op: ChangeOpInput = {
      op: "create_entity",
      ref: s.ref,
      slug: s.slug,
      kind: s.kind,
      label: s.label,
      description: s.description,
      ...(s.aliases?.length ? { aliases: s.aliases } : {}),
      ...(s.qid ? { wikidataId: s.qid } : {}),
    };
    const spans = [...(s.spans ?? [])];
    if (s.life && wd?.when)
      spans.push({
        role: "life",
        when: { edtf: wd.when.edtf },
        basis: `Wikidata ${s.qid}: date of birth and death`,
        source: { wikidata: { qid: s.qid!, property: "P569/P570" } },
      });
    if (spans.length) op.spans = spans as never;
    if (s.when) op.when = s.when as never;
    else if (s.wdWhen && wd?.when) op.when = { edtf: wd.when.edtf, basis: wd.when.basis ?? `Wikidata ${s.qid}` };
    if (s.geo && wd?.coordinates)
      op.geo = {
        geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
        certainty: s.geo,
        note: s.geoNote ?? `Coordinates from Wikidata ${s.qid}.`,
      };
    out.ops.push(op);
    out.ref[s.ref] = `@${s.ref}`;
  }
  // Links into the Gupta Empire, so the page's timeline and map pick them up.
  for (const s of ENTITIES) {
    if (!s.link || !out.ref[s.ref]!.startsWith("@")) continue;
    out.ops.push({ op: "link_entities", from: out.ref[s.ref]!, to: "gupta-empire", type: s.link, ...(s.linkNote ? { note: s.linkNote } : {}) });
  }
  for (const l of EXISTING_LINKS) out.ops.push({ op: "link_entities", from: l.slug, to: "gupta-empire", type: l.type, note: l.note });
  out.dependsOn = [...new Set(out.dependsOn)];
  return out;
}

// ---------------------------------------------------------------- content

export function guptaOps(s: Snaps, E: Record<string, string>): ChangeOpInput[] {
  const e = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const viaWp = (k: CaptureKey) => ({
    via: "wikipedia" as const,
    title: `Wikipedia: ${s[k].title}`,
    ...(s[k].url ? { url: s[k].url! } : {}),
    ...(s[k].revisionId ? { revisionId: s[k].revisionId! } : {}),
  });
  const wpSource = (ref: string, k: CaptureKey): ChangeOpInput => ({
    op: "create_source",
    ref,
    kind: "wiki_article",
    tier: "tertiary",
    csl: {
      type: "entry-encyclopedia",
      title: s[k].title,
      "container-title": "Wikipedia",
      issued: { "date-parts": [[2026]] },
      ...(s[k].url ? { URL: s[k].url! } : {}),
    },
    identifiers: {
      ...(s[k].url ? { url: s[k].url! } : {}),
      wikipedia: { lang: "en", title: s[k].title, revisionId: s[k].revisionId! },
    },
    license: { status: "open", spdx: "CC-BY-SA-4.0" },
  });
  const ia = (id: string) => ({ ia: id, url: `https://archive.org/details/${id}` });
  const pdUS = (pub: number, who: string, died: number | null) =>
    died
      ? `Published ${pub}; ${who} died ${died} (Wikidata). Public domain in India (life + 60) and the US (published before 1931).`
      : `Published ${pub}; public domain in the US (published before 1931). ${who}'s death date was not checked.`;
  /** A modern copyrighted work, cited by location only, as Wikipedia cites it. */
  const modern = (ref: string, csl: { title: string } & Record<string, unknown>, isbn: string, lenses: string[] = ["mainstream_academic"]): ChangeOpInput => ({
    op: "create_source",
    ref,
    kind: "book",
    tier: "secondary",
    csl: { type: "book", ...csl },
    identifiers: { isbn: [isbn] },
    license: { status: "copyrighted", note: "Cited by location only, as given by Wikipedia; not read or quoted here." },
    lenses: lenses as never,
  });

  const ops: ChangeOpInput[] = [
    // ------------------------------------------------------------ sources
    {
      op: "create_source",
      ref: "s_fleet",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Inscriptions of the Early Gupta Kings and Their Successors",
        author: [{ family: "Fleet", given: "John Faithfull" }],
        issued: { "date-parts": [[1888]] },
        publisher: "Superintendent of Government Printing, India",
        "publisher-place": "Calcutta",
        "collection-title": "Corpus Inscriptionum Indicarum",
        volume: "III",
      },
      identifiers: ia("dli.csl.8714"),
      license: { status: "public_domain", note: pdUS(1888, "Fleet", 1917) },
      lenses: ["philological"],
      note: "Texts and translations of the Gupta inscriptions. Fleet's translations are quoted as primary evidence for what the inscriptions say; his introductions and notes are his own scholarship of 1888, and some of his conclusions (the date of the Vākāṭakas, the identity of Chandra) have since been revised. Page numbers are read from the running heads of this OCR.",
    },
    {
      op: "create_source",
      ref: "s_legge",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "A Record of Buddhistic Kingdoms: being an account by the Chinese monk Fâ-Hien of his travels in India and Ceylon (A.D. 399–414) in search of the Buddhist books of discipline",
        author: [{ literal: "Faxian" }],
        translator: [{ family: "Legge", given: "James" }],
        issued: { "date-parts": [[1886]] },
        publisher: "Clarendon Press",
        "publisher-place": "Oxford",
      },
      identifiers: ia("recordofbuddhist00fahsuoft"),
      license: { status: "public_domain", note: pdUS(1886, "Legge", 1897) },
      lenses: ["primary_source"],
      note: "Faxian's account, written after his return to China; Legge's notes are his own. Faxian was a Buddhist pilgrim and saw the country through that interest.",
    },
    {
      op: "create_source",
      ref: "s_pargiter",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Purana Text of the Dynasties of the Kali Age",
        author: [{ family: "Pargiter", given: "F. E." }],
        issued: { "date-parts": [[1913]] },
        publisher: "Oxford University Press",
        "publisher-place": "London",
      },
      identifiers: ia("dli.csl.5891"),
      license: { status: "public_domain", note: pdUS(1913, "Pargiter", 1927) },
      lenses: ["philological"],
      note: "An edition and translation of the dynastic lists in several Purāṇas. The Purāṇas were compiled over centuries; the dating of a passage is the editor's inference.",
    },
    {
      op: "create_source",
      ref: "s_clark",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Āryabhaṭīya of Āryabhaṭa: an ancient Indian work on mathematics and astronomy",
        author: [{ literal: "Āryabhaṭa" }],
        translator: [{ family: "Clark", given: "Walter Eugene" }],
        issued: { "date-parts": [[1930]] },
        publisher: "University of Chicago Press",
        "publisher-place": "Chicago",
      },
      identifiers: ia("TheAryabhatiyaOfAryabhata"),
      license: { status: "public_domain", note: "Published 1930 in the US; public domain there from 1 January 2026 (95 years). Clark died 1960 (Wikidata), so it has also been public domain in India since 2021." },
      lenses: ["primary_source"],
      note: "Translation with notes. Clark's notes are his interpretation; he often reports the commentator Parameśvara's readings.",
    },
    {
      op: "create_source",
      ref: "s_ryder",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Kalidasa: Translations of Shakuntala and Other Works",
        author: [{ literal: "Kālidāsa" }],
        translator: [{ family: "Ryder", given: "Arthur W." }],
        issued: { "date-parts": [[1920]] },
        "original-date": { "date-parts": [[1912]] },
        publisher: "J. M. Dent & Sons; E. P. Dutton",
        "publisher-place": "London; New York",
        "collection-title": "Everyman's Library",
      },
      identifiers: ia("kalidasatranslat00kali"),
      license: { status: "public_domain", note: pdUS(1912, "Ryder", 1938) },
      lenses: ["primary_source"],
      note: "This copy is a reprint of the 1912 edition. Ryder's introduction is his own judgement about Kālidāsa's date and the traditions about him.",
    },
    {
      op: "create_source",
      ref: "s_burgess",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Inscriptions from the Cave-Temples of Western India, with descriptive notes",
        author: [{ family: "Burgess", given: "James" }, { family: "Indraji", given: "Bhagwanlal" }],
        issued: { "date-parts": [[1881]] },
        publisher: "Government Central Press",
        "publisher-place": "Bombay",
        "collection-title": "Archaeological Survey of Western India",
      },
      identifiers: ia("inscriptionsfro00indrgoog"),
      license: { status: "public_domain", note: "Published 1881; Burgess died 1916 and Bhagwanlal Indraji 1888 (Wikidata). Public domain in India and the US." },
      lenses: ["philological"],
      note: "Includes the Ajanta inscriptions. The authors' dates for the Vākāṭaka kings are those of 1881.",
    },
    {
      op: "create_source",
      ref: "s_cosmas",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Christian Topography of Cosmas, an Egyptian Monk",
        author: [{ literal: "Cosmas Indicopleustes" }],
        translator: [{ family: "McCrindle", given: "J. W." }],
        issued: { "date-parts": [[1897]] },
        publisher: "Hakluyt Society",
        "publisher-place": "London",
      },
      identifiers: ia("christiantopogra00cosm"),
      license: { status: "public_domain", note: pdUS(1897, "McCrindle", 1913) },
      lenses: ["primary_source"],
      note: "Written in the sixth century by a merchant who had sailed in the Indian Ocean; Book XI describes India and Sri Lanka.",
    },
    {
      op: "create_source",
      ref: "s_procopius",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "History of the Wars, Books I and II (The Persian War)",
        author: [{ literal: "Procopius" }],
        translator: [{ family: "Dewing", given: "H. B." }],
        issued: { "date-parts": [[1914]] },
        publisher: "William Heinemann; Macmillan",
        "publisher-place": "London; New York",
        "collection-title": "Loeb Classical Library",
        volume: "I",
      },
      identifiers: ia("b24750281_0001"),
      license: { status: "public_domain", note: pdUS(1914, "Dewing", null) },
      lenses: ["primary_source"],
      note: "Procopius wrote in the sixth century, about events of the 480s he knew from Persian and Byzantine report.",
    },
    {
      op: "create_source",
      ref: "s_beal1",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Si-yu-ki: Buddhist Records of the Western World, vol. I",
        author: [{ literal: "Xuanzang (Hiuen Tsiang)" }],
        translator: [{ family: "Beal", given: "Samuel" }],
        issued: { "date-parts": [[1884]] },
        publisher: "Trübner & Co.",
        "publisher-place": "London",
      },
      identifiers: ia("siyukibuddhistre01hsuoft"),
      license: { status: "public_domain", note: pdUS(1884, "Beal", 1889) },
      lenses: ["primary_source"],
      note: "Xuanzang travelled in India in the 630s–640s. What he reports of the fifth and sixth centuries is Buddhist tradition two centuries later.",
    },
    {
      op: "create_source",
      ref: "s_beal2",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Si-yu-ki: Buddhist Records of the Western World, vol. II",
        author: [{ literal: "Xuanzang (Hiuen Tsiang)" }],
        translator: [{ family: "Beal", given: "Samuel" }],
        issued: { "date-parts": [[1884]] },
        publisher: "Trübner & Co.",
        "publisher-place": "London",
      },
      identifiers: ia("siyukibuddhistre02hsuoft"),
      license: { status: "public_domain", note: pdUS(1884, "Beal", 1889) },
      lenses: ["primary_source"],
      note: "Book IX describes Nālandā as Xuanzang saw it, with the tradition of its royal founders.",
    },
    {
      op: "create_source",
      ref: "s_smith1904",
      kind: "book",
      tier: "secondary",
      csl: {
        type: "book",
        title: "The Early History of India, from 600 B.C. to the Muhammadan Conquest",
        author: [{ family: "Smith", given: "Vincent A." }],
        issued: { "date-parts": [[1904]] },
        publisher: "Clarendon Press",
        "publisher-place": "Oxford",
      },
      identifiers: ia("cu31924024065645"),
      license: { status: "public_domain", note: pdUS(1904, "Smith", 1920) },
      lenses: ["colonial_orientalist"],
      note: "First edition. Quoted here as the source of the “golden age” and “Indian Napoleon” labels, not as an authority on the period.",
    },
    {
      op: "create_source",
      ref: "s_smith1914",
      kind: "book",
      tier: "secondary",
      csl: {
        type: "book",
        title: "The Early History of India, from 600 B.C. to the Muhammadan Conquest",
        author: [{ family: "Smith", given: "Vincent A." }],
        issued: { "date-parts": [[1914]] },
        edition: "3rd",
        publisher: "Clarendon Press",
        "publisher-place": "Oxford",
      },
      identifiers: ia("earlyhistoryofin00smit"),
      derivedFrom: "@s_smith1904",
      license: { status: "public_domain", note: pdUS(1914, "Smith", 1920) },
      lenses: ["colonial_orientalist"],
      note: "Third edition, revised.",
    },
    {
      op: "create_source",
      ref: "s_oxford",
      kind: "book",
      tier: "secondary",
      csl: {
        type: "book",
        title: "The Oxford History of India, from the Earliest Times to the End of 1911",
        author: [{ family: "Smith", given: "Vincent A." }],
        issued: { "date-parts": [[1919]] },
        publisher: "Clarendon Press",
        "publisher-place": "Oxford",
      },
      identifiers: ia("oxfordhistoryofi00smituoft"),
      license: { status: "public_domain", note: pdUS(1919, "Smith", 1920) },
      lenses: ["colonial_orientalist"],
    },
    {
      op: "create_source",
      ref: "s_havell",
      kind: "book",
      tier: "secondary",
      csl: {
        type: "book",
        title: "The History of Aryan Rule in India, from the Earliest Times to the Death of Akbar",
        author: [{ family: "Havell", given: "E. B." }],
        issued: { "date-parts": [[1918]] },
        publisher: "George G. Harrap & Co.",
        "publisher-place": "London",
      },
      identifiers: ia("historyofaryanru00haveuoft"),
      license: { status: "public_domain", note: pdUS(1918, "Havell", 1934) },
      note: "A British art historian's history, sympathetic to Indian nationalist readings of the past.",
    },
    wpSource("s_wp_gupta", "wpGupta"),
    wpSource("s_wp_pillar", "wpPillar"),
    wpSource("s_wp_ajanta", "wpAjanta"),
    wpSource("s_wp_nalanda", "wpNalanda"),
    wpSource("s_wp_udayagiri", "wpUdayagiri"),
    wpSource("s_wp_alchon", "wpAlchon"),
    wpSource("s_wp_hephthalites", "wpHephthalites"),
    wpSource("s_wp_kidarites", "wpKidarites"),
    wpSource("s_wp_prabhavati", "wpPrabhavati"),
    wpSource("s_wp_kalidasa", "wpKalidasa"),
    wpSource("s_wp_aryabhata", "wpAryabhata"),
    wpSource("s_wp_samudragupta", "wpSamudragupta"),
    wpSource("s_wp_kumaragupta", "wpKumaragupta"),
    wpSource("s_wp_skandagupta", "wpSkandagupta"),
    wpSource("s_wp_cg2", "wpChandragupta2"),
    // Modern scholarship (copyrighted), by location only, as cited by Wikipedia.
    modern("s_agrawal", { title: "Rise and Fall of the Imperial Guptas", author: [{ family: "Agrawal", given: "Ashvini" }], issued: { "date-parts": [[1989]] }, publisher: "Motilal Banarsidass", "publisher-place": "Delhi" }, "978-81-208-0592-7"),
    modern("s_sharma", { title: "A Political History of the Imperial Guptas: From Gupta to Skandagupta", author: [{ family: "Sharma", given: "Tej Ram" }], issued: { "date-parts": [[1989]] }, publisher: "Concept" }, "978-81-7022-251-4"),
    modern("s_jha", { title: "Ancient India in Historical Outline", author: [{ family: "Jha", given: "D. N." }], issued: { "date-parts": [[2002]] }, publisher: "Manohar Publishers and Distributors", "publisher-place": "Delhi" }, "978-81-7304-285-0", ["mainstream_academic", "marxist"]),
    modern("s_pletcher", { title: "The History of India", editor: [{ family: "Pletcher", given: "Kenneth" }], issued: { "date-parts": [[2011]] }, publisher: "Britannica Educational Publishing" }, "978-1-61530-201-7"),
    modern("s_spink", { title: "Ajanta: History and Development, Volume 4: Painting, Sculpture, Architecture, Year by Year", author: [{ family: "Spink", given: "Walter M." }], issued: { "date-parts": [[2009]] }, publisher: "Brill", "publisher-place": "Leiden" }, "978-90-04-14983-0"),
    modern("s_dutt", { title: "Buddhist Monks and Monasteries of India", author: [{ family: "Dutt", given: "Sukumar" }], issued: { "date-parts": [[1988]] }, "original-date": { "date-parts": [[1962]] }, publisher: "Motilal Banarsidass" }, "978-81-208-0498-2"),
    modern("s_rezakhani", { title: "ReOrienting the Sasanians: East Iran in Late Antiquity", author: [{ family: "Rezakhani", given: "Khodadad" }], issued: { "date-parts": [[2017]] }, publisher: "Edinburgh University Press" }, "978-1-4744-0030-5"),
    modern("s_usingh", { title: "A History of Ancient and Early Medieval India: From the Stone Age to the 12th Century", author: [{ family: "Singh", given: "Upinder" }], issued: { "date-parts": [[2008]] }, publisher: "Pearson Education India", "publisher-place": "New Delhi" }, "978-81-317-1677-9"),
    modern("s_kulke", { title: "A History of India", author: [{ family: "Kulke", given: "Hermann" }, { family: "Rothermund", given: "Dietmar" }], issued: { "date-parts": [[2004]] }, edition: "4th", publisher: "Routledge" }, "978-0-415-32920-0"),
  ];

  // ------------------------------------------------------------ excerpts
  type Loc = { volume?: string; page?: string; pageEnd?: string; chapter?: string; section?: string; verse?: string; line?: string; label?: string };
  const x = (ref: string, source: string, snap: CaptureKey | null, quote: string | null, locator: Loc, note?: string) =>
    ops.push({
      op: "create_excerpt",
      ref,
      source: `@${source}`,
      ...(snap ? { snapshotId: s[snap].id } : {}),
      ...(quote ? { quote } : {}),
      locator,
      ...(note ? { note } : {}),
    } as ChangeOpInput);
  /** Fleet 1888: the inscription number and a label for the locator. */
  const F = (no: number | null, page: string, label: string, line?: string): Loc => ({
    page,
    ...(line ? { line } : {}),
    label: no ? `No. ${no}, ${label}` : label,
  });
  const fx = (ref: string, quote: string, loc: Loc, note?: string) => x(ref, "s_fleet", "fleet", quote, loc, note);

  // The Gupta era
  fx("x_f_epoch", "giving A.D. 319-20 current for the epoch or year 0 of the era, and A.D. 320-21 current for its commencement or first current year", F(null, "25", "Introduction, the Gupta era"));
  fx("x_f_epoch2", "But I shall shew hereafter that the real epoch of the Gupta era was A.D. 319-20", F(null, "31", "Introduction (page inferred)"));
  fx("x_f_alberuni", "As regards the Guptakala, people say that the Guptas were wicked powerful people, and that, when they ceased to exist, this date was used as the epoch of an era.", F(null, "24", "Introduction, quoting Alberuni's India in Sachau's translation"), "Al-Bīrūnī wrote c. 1030; Fleet quotes him in E. C. Sachau's translation.");
  // Chandragupta I and Samudragupta
  fx("x_f_kumaradevi", "Married to Kumaradevi, of the Lichchhavi family.", F(null, "17", "Introduction, Table I: Genealogy of the Early Gupta Kings, under Chandragupta I"));
  fx("x_f_lichchhavi", "the uniform application of the epithet, “daughter's son of Lichchhavi or of a Lichchhavi,” to Samudragupta in the genealogical inscriptions", F(null, "135", "Introduction (the Nepal appendix), on the Licchavi alliance"));
  fx("x_f_maharaja_note", "Mahdrdja was habitually used simply as a technical official title, indicative no doubt of considerable rank and power, but applied only to, feudatories, not to paramount sovereigns.", F(1, "15", "Allahabad pillar inscription, Fleet's note on the titles of Gupta and Ghatotkacha (line 28)"), "Of the Early Gupta and later periods; quoted in the OCR's spelling (Mahārāja).");
  fx("x_f_worthy", "was bidden by (his) father,— who, exclaiming “ Verily (he is) worthy,” embraced (him) with the hairs of (his) body standing erect", F(1, "11", "Allahabad pillar inscription, translation", "7"));
  fx("x_f_worthy_note", "This verse seems to indicate that Chandragupta I. specially selected Samudragupta, from among several brothers, to conquer the land and to succeed him on the throne.", F(1, "12", "Allahabad pillar inscription, Fleet's note to line 7"));
  fx("x_f_column", "The round monolith sandstone column, thirty-five feet in height, on which this inscription is, dates from the third century B.C., as is shewn by the famous edicts of Asoka on it.", F(1, "2", "Allahabad pillar inscription, introduction"));
  fx("x_f_column_fort", "It now stands in a conspicuous position inside the Fort at Allahabad", F(1, "2", "Allahabad pillar inscription, introduction"));
  fx("x_f_kausambi", "It is doubtful, however, whether the column was originally erected at this place, or whether, as has been suggested by General Cunningham, it was first set up at the ancient Kausambi", F(1, "2", "Allahabad pillar inscription, introduction"));
  fx("x_f_harishena", "the Mahadandanayaka Harishena, who is the slave of these same feet of", F(1, "16", "Allahabad pillar inscription, translation, closing lines", "31"), "The closing lines name the poem's author, “this poetical composition” being his work; his titles include Sāṃdhivigrahika.");
  fx("x_f_sandhivigrahika", "Samdhivigrahika, lit. an officer for peace and war, is a technical official or military title.", F(1, "16", "Allahabad pillar inscription, Fleet's note"));
  fx("x_f_south", "Whose great good fortune was mixed with, so as to be increased by (his) glory produced by the favour shewn in capturing and then liberating", F(1, "12", "Allahabad pillar inscription, translation", "19"));
  fx("x_f_south3", "and all the other kings of the region of the south", F(1, "13", "Allahabad pillar inscription, translation", "20"));
  fx("x_f_aryavarta", "Who abounded in majesty that had been increased by violently exterminating Rudradeva, Matila, Nagadatta, Chandravarman, Ganapatinaga, Nagasena, Achyuta, Nandin, Balavarman, and many other kings of (the land of) Aryavarta", F(1, "13", "Allahabad pillar inscription, translation", "21"));
  fx("x_f_forest", "who made all the kings of the forest countries", F(1, "13", "Allahabad pillar inscription, translation", "21"));
  fx("x_f_frontier", "Whose imperious commands were fully gratified, by giving all (kinds of) taxes and obeying (his) orders and coming to perform obeisance, by the frontier- kings", F(1, "14", "Allahabad pillar inscription, translation", "22"));
  fx("x_f_frontier2", "by the Malavas, Arjunayanas, Yaudheyas, Madrakas, Abhiras, Prarjunas", F(1, "14", "Allahabad pillar inscription, translation", "22"));
  fx("x_f_distant", "by the Daivaputras, Shahis, Shahanushahis, Sakas, and Murundas, and by the people of Simhala and all (other) dwellers in islands", F(1, "14", "Allahabad pillar inscription, translation", "23"));
  fx("x_f_maidens", "bringing presents of maidens, (giving) Garuda-tokens", F(1, "14", "Allahabad pillar inscription, translation", "23"));
  fx("x_f_pratyanta", "Upon the interpretation that is accepted, will depend the question whether Samudragupta's empire included those countries, or whether it only extended up to, and was bounded by, their frontiers.", F(1, "14", "Allahabad pillar inscription, Fleet's note on pratyanta-nripati, “frontier-kings”, line 22"));
  fx("x_f_cunningham", "the Daivaputra, Shahi, Shahanushahi, which we now know to be the titles of the Yue-chi Indo-Scythians, Kanishka, Huvishka, and Vasudeva, and their successors", F(null, "53", "Introduction, quoting Cunningham (Archaeological Survey of India Reports, vol. X, 1880)"), "Fleet quotes Cunningham in order to reject his dating, not this identification.");
  fx("x_f_poets", "who established (his) title of ‘king of poets ' by various poetical compositions that were fit to be the means of subsistence of learned people", F(1, "15", "Allahabad pillar inscription, translation", "27"));
  fx("x_f_lyrist", "with this reference to him and to the musical accomplishments of Samudragupta, we have to compare the coins of the ‘lyrist type'", F(1, "15", "Allahabad pillar inscription, Fleet's note to line 27"));
  fx("x_f_lute", "which represent Samudragupta playing the lute", F(1, "15", "Allahabad pillar inscription, Fleet's note to line 27"));
  fx("x_f_ashvamedha", "who was the restorer of the asvamedha- sacrifice, that had been long in abeyance", F(10, "44", "Bilsad inscription of Kumaragupta I, translation"), "Said of Samudragupta in his descendants' genealogies; the same words are in the Bhitari inscription (p. 54).");
  // Chandragupta II
  fx("x_f_cg2_years", "[Gupta-Samvat 82, 88, 93, and 94 or 95.]", F(null, "17", "Introduction, Table I, under Chandragupta II"), "The years of his dated records.");
  fx("x_f_kg1_years", "[G. S. 96, 98, 129, and 130 odd.]", F(null, "17", "Introduction, Table I, under Kumaragupta I"), "The years of his dated records.");
  fx("x_f_udaya_date", "eighty two (A.D. 401-2), and on the eleventh lunar day of the bright fortnight of the month Ashadha (June -July).", F(3, "23", "Udayagiri cave inscription of Chandragupta II, year 82, introduction"));
  fx("x_f_udaya_feet", "(and) the son of the Mahdrdja Vishnudasa, — who meditates on the feet of the Paramabhattdraka and M ahdrdjddhirdja, the glorious Chandragupta (II.)", F(3, "25", "Udayagiri cave inscription of the year 82, translation"), "Said of the Sanakanika mahārāja who made the gift. Quoted in the OCR's spelling (Mahārāja, Paramabhaṭṭāraka, Mahārājādhirāja).");
  fx("x_f_udaya_vaishnava", "The cave appears to be a Vaishnava cave", F(3, "23", "Udayagiri cave inscription of the year 82, introduction"));
  fx("x_f_virasena", "He came here, accompanied by the king in person, who was seeking to conquer the whole world; and, through devotion towards the divine (god) Sambhu, he caused this cave to be made.", F(6, "36", "Udayagiri cave inscription of Chandragupta II, translation", "5"));
  fx("x_f_virasena_poet", "who knows the meanings of words, and logic, and ( the ways of) mankind; — who is a poet;", F(6, "36", "Udayagiri cave inscription of Chandragupta II, translation"));
  fx("x_f_virasena_home", "belongs to (the city of) Pataliputra", F(6, "36", "Udayagiri cave inscription of Chandragupta II, translation"));
  fx("x_f_virasena_office", "(the office of arranging) peace and war", F(6, "35", "Udayagiri cave inscription of Chandragupta II, translation", "3"));
  fx("x_f_sanchi_date", "ninety-three (A.D. 412-13), on the fourth day", F(5, "30", "Sanchi inscription of Chandragupta II, year 93, introduction"));
  fx("x_f_sanchi_vihara", "in the holy great vihara of Kakanadabota", F(5, "32", "Sanchi inscription of the year 93, translation"));
  fx("x_f_sanchi_favour", "whose means of subsistence have been made comfortable by the favour of the feet of the Maharajadhiraja, the glorious Chandragupta (II.)", F(5, "32", "Sanchi inscription of the year 93, translation"), "Said of the donor, Āmrakārdava.");
  fx("x_f_sanchi_lamp", "let five Bhikshus be fed, and let a lamp burn in the jewel- house", F(5, "33", "Sanchi inscription of the year 93, translation"));
  // The iron pillar
  fx("x_f_pillar_vanga", "when, in battle in the Vanga countries, he kneaded ( and turned ) back with (his) breast the enemies who, uniting to gether, came against (him)", F(32, "141", "Meharauli iron pillar inscription of Chandra, translation"));
  fx("x_f_pillar_sindhu", "having crossed in warfare the seven mouths of the (river) Sindhu, the Vahlikas", F(32, "141", "Meharauli iron pillar inscription of Chandra, translation"));
  fx("x_f_pillar_vishnupada", "this lofty standard of the divine Vishnu was set up on the hill (called) Vishnupada.", F(32, "142", "Meharauli iron pillar inscription of Chandra, translation"));
  fx("x_f_pillar_name", "who, having the name of Chandra, carried a beauty of countenance like (the beauty of) the full-moon", F(32, "142", "Meharauli iron pillar inscription of Chandra, translation"));
  fx("x_f_pillar_undated", "of the conquests of a powerful king named Chandra, as to whose lineage no information is given. It is not dated.", F(32, "140", "Meharauli iron pillar inscription, introduction"));
  fx("x_f_pillar_mystery", "yet it makes no mention of his lineage, and gives no clue by which we can determine exactly his period and surroundings.", F(null, "12", "Introduction, on “the mysterious emperor Chandra”"));
  fx("x_f_pillar_cg1", "My own impression at first, on independent' grounds, was to allot it to Chandragupta I.", F(32, "140", "Meharauli iron pillar inscription, Fleet's note 1"));
  fx("x_f_pillar_cg1b", "and I should not be surprised to find at any time that it is proved to belong to him.", F(32, "140", "Meharauli iron pillar inscription, Fleet's note 1"));
  fx("x_f_pillar_hun", "it is also possible that the inscription is one of the younger brother of Mihirakula", F(32, "140", "Meharauli iron pillar inscription, Fleet's note 1"));
  fx("x_f_pillar_place", "is in favour of its being now in its original position", F(32, "141", "Meharauli iron pillar inscription, introduction"));
  // Kumaragupta I and the silk weavers
  fx("x_f_bilsad", "It is dated, in words, in the year ninety-six (A.D. 415-16)", F(10, "43", "Bilsad inscription of Kumaragupta I, introduction"));
  fx("x_f_silk_migrate", "It narrates, in the first place, how a number of silk-weavers immigrated from the Lata vishaya, or central and southern Gujarat, into the city of Dasapura", F(18, "80", "Mandasor inscription of Kumaragupta and Bandhuvarman, introduction"));
  fx("x_f_silk_reign", "While Kumaragupta was reigning over the (whole) earth, whose pendulous marriage-string is the verge of the four oceans", F(18, "86", "Mandasor inscription, translation", "13"));
  fx("x_f_silk_temple", "a noble (and) unequalled temple of the bright-rayed (Sun), was caused to be built by the silk-cloth weavers, as a guild, with the stores of wealth acquired by (the exercise of their) craft", F(18, "86", "Mandasor inscription, translation", "16"));
  fx("x_f_silk_493", "when, by (the reckoning from) the tribal constitution of the Malavas, four centuries of years, increased by ninety-three, had elapsed", F(18, "87", "Mandasor inscription, translation"));
  fx("x_f_silk_437", "four hundred and ninety-fourth year (A.D. 437-38) was current", F(18, "80", "Mandasor inscription, introduction"));
  fx("x_f_silk_disrepair", "And, in the course of a long time, under other kings, part of this temple fell into disrepair", F(18, "87", "Mandasor inscription, translation", "19"));
  fx("x_f_silk_473", "the five hundred and thirtieth year (A.D. 473-74) was current", F(18, "80", "Mandasor inscription, introduction"));
  fx("x_f_silk_astrology", "Some excelled in their own business (of silk-weaving) ; and by others, possessed of high aims, the science of astrology was mastered", F(18, "85", "Mandasor inscription, translation"));
  fx("x_f_prashasti", "This was the customary technical term applied to inscriptions on stone.", F(18, "87", "Mandasor inscription, Fleet's note on prasasti"));
  // Skandagupta
  fx("x_f_bhitari_night", "By whom, when he prepared himself to restore the fallen fortunes of (his) family, a (whole) night was spent on a couch that was the bare earth", F(13, "55", "Bhitari pillar inscription of Skandagupta, translation", "10"));
  fx("x_f_bhitari_pushya", "having conquered the Pushyamitras", F(13, "55", "Bhitari pillar inscription, translation"));
  fx("x_f_bhitari_restore", "Who, when (his) father had attained the skies, conquered (his) enemies by the strength of (his) arm, and established again the ruined fortunes of (his) lineage", F(13, "55", "Bhitari pillar inscription, translation", "12"));
  fx("x_f_bhitari_huna", "By whose two arms the earth was shaken, when he, the creator (of a disturbance like that) of a terrible whirlpool, joined in close conflict with the Hunas", F(13, "56", "Bhitari pillar inscription, translation", "15"));
  fx("x_f_junagadh_rock", "The inscription is on the north-west face of a large granite boulder, containing also fourteen Asoka edicts and a long inscription of the Mahakshatrapa Rudradaman", F(14, "57", "Junagadh rock inscription of Skandagupta, introduction"));
  fx("x_f_junagadh_parnadatta", "it narrates how he appointed a certain Parnadatta to govern his territories in the Surashtras or the Kathiawad country", F(14, "57", "Junagadh rock inscription, introduction"));
  fx("x_f_junagadh_136", "in the year one hundred and thirty-six (A.D. 455-56)", F(14, "57", "Junagadh rock inscription, introduction"));
  fx("x_f_junagadh_burst", "burst in consequence of excessive rain", F(14, "58", "Junagadh rock inscription, introduction"));
  fx("x_f_junagadh_repair", "The restoration of the breach, by renewing the embankment, was effected under the orders of Chakrapalita, after two months’ work, in the year one hundred and thirty-seven (A.D. 456-57).", F(14, "58", "Junagadh rock inscription, introduction"));
  fx("x_f_junagadh_sudarsana", "by reason of which (the lake) Sudarsana suddenly burst", F(14, "63", "Junagadh rock inscription, translation", "15"));
  fx("x_f_junagadh_eulogy", "While he, the king, is reigning, verily no man among his subjects falls away from religion; (and) there is no one who is distressed, (or) in poverty, (or) in misery, (or) avaricious, or who, worthy of punishment, is over-much put to torture.", F(14, "62", "Junagadh rock inscription, translation", "5"));
  fx("x_f_kahaum", "this is distinctly a Jain inscription. And the object of it is, to record that a certain Madra set up five stone images of Adikartris or Tirthamkaras", F(15, "66", "Kahaum pillar inscription of Skandagupta, introduction"));
  fx("x_f_kahaum_141", "It is dated, in words, in the year one hundred and forty-one (A.D. 460-61)", F(15, "66", "Kahaum pillar inscription, introduction"));
  fx("x_f_indor", "It is an inscription of solar worship; and the object of it is to record a perpetual endowment, by a Brahman named Devavishnu, for the purpose of maintaining a lamp in a temple of the Sun at Indrapura", F(16, "70", "Indor copper-plate inscription of Skandagupta, introduction"));
  fx("x_f_indor_guild", "the perpetual property of the guild of oil-men, of which Jivanta is the head, residing at the town of Indrapura", F(16, "71", "Indor copper-plate inscription, translation"));
  fx("x_f_indor_146", "forty-six (A.D. 465-66')", F(16, "70", "Indor copper-plate inscription, introduction"), "The year one hundred and forty-six.");
  // Eran, the Hunas and the end
  fx("x_f_budhagupta", "The inscription refers itself to the reign of Budhagupta, whose feudatory, the Maharaja Surasmichandra, was governing the country lying between the river Kalindi, or the Jamna, and the Narmada.", F(19, "89", "Eran pillar inscription of Budhagupta, introduction"));
  fx("x_f_budhagupta_165", "It is dated, completely in words, and partly in numerical symbols, in the year one hundred and sixty-five (A.D. 484-85)", F(19, "89", "Eran pillar inscription of Budhagupta, introduction"));
  fx("x_f_budhagupta_flag", "(By him) and by his younger brother Dhanyavishnu, who is obedient to him, (and) has been accepted with favour by him, — this flag-staff of the divine (god) Janardana", F(19, "90", "Eran pillar inscription of Budhagupta, translation"));
  fx("x_f_toramana", "The inscription refers itself to the reign of Toramana. It is dated, in words, in the first year of his reign, without any reference to an era", F(36, "159", "Eran boar inscription of Toramana, introduction"));
  fx("x_f_toramana_temple", "the object of it is to record the building of the temple, in which the Boar stands, by Dhanyavishnu, the younger brother of the deceased Maharaja Matrivishnu.", F(36, "159", "Eran boar inscription of Toramana, introduction"));
  fx("x_f_toramana_boar", "It is on the chest of a colossal red-sandstone statue of a Boar, about eleven feet high, representing the god Vishnu in his incarnation as such", F(36, "158", "Eran boar inscription of Toramana, introduction"));
  fx("x_f_toramana_after", "The mention of Matrivishnu in this inscription as deceased, is of importance, as shewing that Toramana comes, so far as his possession of Eastern Malwa is concerned, shortly after Budhagupta", F(36, "159", "Eran boar inscription of Toramana, introduction"));
  fx("x_f_huna_toramana", "And it was doubtless the death of Skandagupta, that enabled the Hunas, who had been repulsed by him, to assume the aggressive again, under the leadership of Toramana", F(null, "12", "Introduction"));
  fx("x_f_goparaja", "the object of it being only to record that, in the company of a powerful king named Bhanugupta, a chieftain or noble named Goparaja came to the place where the pillar was set up, and fought a battle ; that Goparaja was killed ; and that his wife accompanied him, by cremating herself on his funeral pyre.", F(20, "92", "Eran posthumous pillar inscription of Goparaja, introduction"));
  fx("x_f_goparaja_191", "The inscription, which does not refer itself to the reign of any particular king, is dated, in both words and numerical symbols, in the year one hundred and ninety-one", F(20, "92", "Eran pillar inscription of Goparaja, introduction"), "Gupta year 191 is 510–511 CE; the CE date that follows in the OCR is garbled and is not quoted.");
  fx("x_f_goparaja_pyre", "(his) devoted, attached, beloved, and beauteous wife, in close companionship, accompanied (him) onto the funeral pyre.", F(20, "93", "Eran pillar inscription of Goparaja, translation"));
  fx("x_f_goparaja_early", "With this early instance of the cremation of widows", F(20, "92", "Eran pillar inscription of Goparaja, Fleet's note"));
  fx("x_f_mihirakula", "the son (is) he, of unequalled prowess, the lord of the earth, who is renowned under the name of Mihirakula", F(37, "163", "Gwalior inscription of Mihirakula, translation", "3"));
  fx("x_f_mihirakula_15", "The inscription refers itself to the reign of Mihirakula. It is dated, in words, in the fifteenth year of his reign, without any reference to an era", F(37, "162", "Gwalior inscription of Mihirakula, introduction"));
  fx("x_f_mihirakula_sun", "a stone- temple, the chief among the best of temples, of the Sun", F(37, "163", "Gwalior inscription of Mihirakula, translation"));
  fx("x_f_yasho_lands", "which were not enjoyed ( even ) by the lords of the Guptas, whose prowess was displayed by invading the whole ( remainder of the) earth, (and) which the command of the chiefs of the Hunas, that established itself on the tiaras of (many) kings, failed to penetrate", F(33, "146", "Mandasor pillar inscription of Yasodharman, translation", "4"));
  fx("x_f_yasho_mihirakula", "he to whose two feet respect was paid, with complimentary presents of the flowers from the lock of hair on the top of (his) head, by even that (famous) king Mihirakula", F(33, "146", "Mandasor pillar inscription of Yasodharman, translation", "6"));
  fx("x_f_yasho_589", "eighty-nine had expired from the tribal constitution of the Malavas, and, therefore, when the year five hundred and ninety (A.D. 533-34) was current", F(35, "152", "Mandasor stone inscription of Yasodharman and Vishnuvardhana, introduction"));
  fx("x_f_extinction", "the person who accomplished their final extinction seems undoubtedly to have been the great king Mihirakula", F(null, "10", "Introduction, on the downfall of the Early Guptas"));
  fx("x_f_downfall", "his downfall was accomplished by Yasodharman within a very few years on either side of A.D. 533-34.", F(null, "11", "Introduction"), "Mihirakula's downfall.");
  // The Vakatakas
  fx("x_f_siwani", "who was begotten on Prabhavatigupta, the daughter of the Maharajadhiraja, the glorious Devagupta", F(56, "247", "Siwani copper-plate grant of the Vakataka Maharaja Pravarasena II, translation"), "The Chammak plates (No. 55) have the same words.");
  fx("x_f_vakataka_date", "Their date is determined by the marriage of Rudrasena II. with Prabhavatigupta, the daughter of the paramount sovereign Devagupta, who, it can hardly be doubted, was Devagupta of Magadha", F(null, "15", "Introduction, on the Vakataka grants"));
  fx("x_f_vakataka_700", "belonging to the period of about A.D. 680 to 700", F(null, "15", "Introduction, on the Vakataka grants"));

  // Faxian (Legge 1886)
  const lx = (ref: string, quote: string, page: string, chapter: string, note?: string) =>
    x(ref, "s_legge", "legge", quote, { page, chapter, label: `Chapter ${chapter}` }, note);
  lx("x_l_399", "It seems most reasonable to suppose that he set out on his pilgrimage in a.d. 399", "9", "I", "Legge's note.");
  lx("x_l_changan", "Fa-hien had been living in Ch'ang-gan.", "9", "I");
  lx("x_l_fifteen", "Fa-hien's travels had occupied him fifteen", "116", "XL", "Legge's note; the next word is broken in the OCR.");
  lx("x_l_climate", "In it the cold and heat are finely tempered, and there is neither hoarfrost nor snow.", "42", "XVI", "Of the Middle Kingdom (Madhyadeśa), the Ganges plain.");
  lx("x_l_happy", "The people are numerous and happy; they have not to register their households, or attend to any magistrates and their rules", "42", "XVI");
  lx("x_l_royal_land", "cultivate the royal land have to pay (a portion of) the gain from it.", "43", "XVI", "The sentence begins “only those who” on p. 42; footnotes separate the two parts in the OCR.");
  lx("x_l_fines", "The king governs without decapitation or (other) corporal punishments. Criminals are simply fined, lightly or heavily, according to the circumstances (of each case).", "43", "XVI");
  lx("x_l_right_hand", "Even in cases of repeated attempts at wicked rebellion, they only have their right hands cut off", "43", "XVI");
  lx("x_l_salaries", "The king's body-guards and attendants all have salaries.", "43", "XVI");
  lx("x_l_no_killing", "Throughout the whole country the people do not kill any living creature, nor drink intoxicating liquor, nor eat onions or garlic. The only exception is that of the Chandalas", "43", "XVI");
  lx("x_l_chandalas", "That is the name for those who are (held to be) wicked men, and live apart from others. When they enter the gate of a city or a market-place, they strike a piece of wood to make themselves known, so that men know and avoid them, and do not come into contact with them.", "43", "XVI");
  lx("x_l_markets", "in the markets there are no butchers' shops and no dealers in intoxicating drink. In buying and selling commodities they use cowries", "43", "XVI");
  lx("x_l_grants", "built viharas for the priests, and endowed them with fields, houses, gardens, and orchards, along with the resident populations and their cattle, the grants being engraved on plates of metal", "43", "XVI", "Of kings since the Buddha's time.");
  lx("x_l_palace", "The royal palace and halls in the midst of the city, which exist now as of old, were all made by spirits which he employed, and which piled up the stones, reared the walls and gates", "77", "XXVII", "Of Pāṭaliputra and Aśoka.");
  lx("x_l_king_unnamed", "The king of the country honoured and reverenced him, and served him as his teacher.", "78", "XXVII", "Of the Brahman Rādhasāmi at Pāṭaliputra; the king is not named.");
  lx("x_l_monasteries", "By the side of the tope of Asoka, there has been made a mahayana monastery, very grand and beautiful ; there is also a hinayana one ; the two together containing six hundred or seven hundred monks.", "78", "XXVII");
  lx("x_l_rich", "The cities and towns of this country are the greatest of all in the Middle Kingdom. The inhabitants are rich and prosperous, and vie with one another in the practice of benevolence and righteousness.", "79", "XXVII", "Of Magadha.");
  lx("x_l_procession", "Every year on the eighth day of the second month they celebrate a procession of images.", "79", "XXVII");
  lx("x_l_charity", "The Heads of the Vaisya families in them establish in the cities houses for dispensing charity and medicines. All the poor and destitute in the country, orphans, widowers, and childless men, maimed people and cripples, and all who are diseased, go to those houses, and are provided with every kind of help, and doctors examine their diseases.", "79", "XXVII");
  lx("x_l_deer_park", "Rather more than ten le to the north-east of the city, he found the vihara in the park of 'The rishi's Deer-wild", "94", "XXXIV", "Near Vārāṇasī: the Deer Park at Sarnath.");
  lx("x_l_sanskrit", "Fa-hien stayed here for three years, learning Sanskrit books and the Sanskrit speech, and writing out the Vinaya rules.", "99", "XXXVI", "At Pāṭaliputra (the running head reads “Tao-ching remains at Patna”).");
  lx("x_l_ceylon", "Fa-hien abode in this country two years", "111", "XL", "Ceylon (Sri Lanka).");
  lx("x_l_java", "they arrived at a country called Java-dvipa, where various forms of error and Brahmanism are flourishing, while Buddhism in it is not worth speaking of.", "113", "XL");

  // Other primary sources
  x("x_parg_gupta", "s_pargiter", "pargiter", "Kings born of the Gupta race will enjoy all these territories, namely, along the Ganges, Prayaga, Saketa, and the Magadhas.", { page: "73", label: "“Contemporary dynasties of the early fourth century”, translation" });
  x("x_parg_intro", "s_pargiter", "pargiter", "The Guptas are mentioned as reigning over the country comprised within Prayaga, Saketa (Ayodhya), and Magadha, that is, exactly the territory which was possessed at his death by Candragupta I who founded the Gupta dynasty in a.d. 319-20", { page: "xii", label: "Introduction, § 20 (page inferred)" });
  x("x_parg_noconquest", "s_pargiter", "pargiter", "The account takes no notice of his conquests nor of the Gupta empire.", { page: "xii", label: "Introduction, § 20 (page inferred)" }, "Of Samudragupta.");
  x("x_parg_era", "s_pargiter", "pargiter", "The Gupta era was established in A. d. 320, and it may be concluded that this account was closed soon after the commencement of that era", { page: "xii", label: "Introduction, § 20 (page inferred)" });
  x("x_clark_kusuma", "s_clark", "clark", "Aryabhata sets forth here [in this work] the science which is honored at Kusumapura.", { page: "21", chapter: "II", verse: "Gaṇitapāda 1", label: "Gaṇitapāda, verse 1 (page inferred)" });
  x("x_clark_kusuma_note", "s_clark", "clark", "Kusumapura may or may not have been the place of his birth.", { page: "21", label: "Clark's note to Gaṇitapāda 1" });
  x("x_clark_age", "s_clark", "clark", "When three yugapadas and sixty times sixty years had elapsed (from the beginning of the yuga) then twenty-three years of my life had passed.", { page: "54", chapter: "III", verse: "Kālakriyāpāda 10" });
  x("x_clark_499", "s_clark", "clark", "we arrive at the date 499 a.d. It is natural to take this as the date of composition of the treatise.", { page: "55", label: "Clark's note to Kālakriyāpāda 10" });
  x("x_clark_476", "s_clark", "clark", "which gives (III, 10) the date of the birth of the author as 476 a.d.", { page: "ix", label: "Preface (page inferred)" });
  x("x_clark_boat", "s_clark", "clark", "As a man in a boat going forward sees a stationary object moving backward just so at Lanka a man sees the stationary asterisms moving backward (westward) in a straight line.", { page: "64", chapter: "IV", verse: "Golapāda 9" });
  x("x_clark_rotation", "s_clark", "clark", "an observer at the Equator of the Earth, which .rotates toward the East, sees the stationary celestial objects as though moving westward.", { page: "65", label: "Clark's note to Golapāda 9" });
  x("x_clark_zero", "s_clark", "clark", "it is still disputed whether a symbol for zero 'was actually in use in Aryabhata's time.", { page: "7", label: "Clark's note to the Daśagītikā" });
  x("x_ryder_date", "s_ryder", "ryder", "Kalidasa probably lived in the fifth century of the Christian era. This date, approximate as it is, must yet be given with considerable hesitation, and is by no means certain.", { page: "vii", label: "Introduction" });
  x("x_ryder_nobio", "s_ryder", "ryder", "No truly biographical data are preserved about the author", { page: "vii", label: "Introduction" });
  x("x_ryder_vikram", "s_ryder", "ryder", "Though it has not proved possible to identify this monarch with any of the known rulers, there can be no doubt that he existed and had the character attributed to him.", { page: "ix", label: "Introduction, on king Vikramāditya" });
  x("x_ryder_ninegems", "s_ryder", "ryder", "It is quite true that the details of this late tradition concerning the nine gems are open to suspicion", { page: "ix", label: "Introduction" });
  x("x_ryder_ujjain", "s_ryder", "ryder", "We know from Kalidasa's writings that he spent at least a part of his life in the city of Ujjain.", { page: "x", label: "Introduction" });
  x("x_ryder_cloud", "s_ryder", "ryder", "Oh, fine Ujjain! Gem to Avanti given", { page: "191", verse: "30", label: "The Cloud-Messenger, stanza XXX" });
  x("x_burgess_minister", "s_burgess", "burgess", "The donor was minister to king Harishena, and his father Hastibhoja was minister to Devasena, the father of Harishena.", { page: "69", label: "Ajanta inscriptions, Cave XVI (page inferred)" });
  x("x_burgess_gift", "s_burgess", "burgess", "It records the gift of a dwelling for monks by the son of a minister named Hastibhoja", { page: "69", label: "Ajanta inscriptions, Cave XVI (page inferred)" }, "The donor's name is damaged in the stone; it is read as Varāhadeva.");
  x("x_cosmas_huns", "s_cosmas", "cosmas", "Higher up in India, that is, farther to the north, are the White Huns.", { page: "370", chapter: "XI", label: "Book XI" });
  x("x_cosmas_gollas", "s_cosmas", "cosmas", "The one called Gollas when going to war takes with him, it is said, no fewer than two", { page: "370", chapter: "XI", label: "Book XI" });
  x("x_cosmas_gollas2", "s_cosmas", "cosmas", "thousand elephants, and a great force of cavalry. He is the lord of India, and oppressing the people forces them to pay tribute.", { page: "371", chapter: "XI", label: "Book XI" });
  x("x_cosmas_lanka", "s_cosmas", "cosmas", "receives imports from all the seats of commerce and in turn exports to them, and is thus itself a great seat of commerce.", { page: "368", chapter: "XI", label: "Book XI, on Sielediba (Sri Lanka)" });
  x("x_procop_white", "s_procopius", "procopius", "the Persian King Perozes became involved in a war concerning boundaries with the nation of the Ephthalitae Huns, who are called White Huns", { chapter: "I.iii", section: "1–2", label: "Book I, chapter iii" });
  x("x_procop_death", "s_procopius", "procopius", "Among them were Perozes and all his sons.", { chapter: "I.iv", label: "Book I, chapter iv (of those who fell into the Ephthalites' trench)" });
  x("x_beal_sakra", "s_beal2", "beal2", "a former king of this country named Sakraditya (Shi-kia-lo-'o-t'ie-to) respected and esteemed the (system of the) one Vehicle, and honoured very highly the three treasures. Having selected by augury a lucky spot, he built this sangharama.", { volume: "II", page: "168", chapter: "IX", label: "Book IX, Nālandā" });
  x("x_beal_nirvana", "s_beal2", "beal2", "Not long after the Nirvana of Buddha, a former king of this country named Sakraditya", { volume: "II", page: "168", chapter: "IX", label: "Book IX, Nālandā" });
  x("x_beal_budha", "s_beal2", "beal2", "His son, Buddhagupta-raja (Fo-t'o-kio-to), who succeeded him, continued to labour at the excellent undertaking of his father.", { volume: "II", page: "168", chapter: "IX", label: "Book IX, Nālandā" });
  x("x_beal_mihira", "s_beal1", "beal1", "Some centuries ago there was a king called Mo-hi-lo-kiu-lo (Mahirakula), who established his authority in this town and ruled over India.", { volume: "I", page: "167", chapter: "IV", label: "Book IV, Śākala" });
  x("x_beal_edict", "s_beal1", "beal1", "He then issued an edict to destroy all the priests through the five Indies, to overthrow the law of Buddha, and leave nothing remaining.", { volume: "I", page: "168", chapter: "IV", label: "Book IV, Śākala" });

  // The historians of the "golden age"
  x("x_smith04_golden", "s_smith1904", "smith1904", "The golden age of the Guptas, glorious in literary, as in political, history, comprised a period of a century and a quarter (330-455 a. d.), and was covered by three reigns of exceptional length.", { page: "268" });
  x("x_smith04_napoleon", "s_smith1904", "smith1904", "it is clear that he was endowed with no ordinary powers ; and that he was in fact a man of genius, who may fairly claim the title of the Indian Napoleon.", { page: "253" });
  x("x_smith14_golden", "s_smith1914", "smith1914", "The golden age of the Guptas comprised a period of a century and a quarter (a. d. 330-455), covered by three reigns of exceptional length.", { page: "308" });
  x("x_smith14_napoleon", "s_smith1914", "smith1914", "it is clear that he was endowed with no ordinary powers ; and that he was in fact a man of genius, who may fairly claim the title of the Indian Napoleon.", { page: "289" });
  x("x_smith14_faxian", "s_smith1914", "smith1914", "did not trouble even to mention the name of the mighty monarch in whose territories he spent six studious years.", { page: "294" }, "Of Fa-hien.");
  x("x_smith14_governed", "s_smith1914", "smith1914", "Probably India has never been governed better, after the Oriental manner, than it was during the reign of Vikramaditya.", { page: "298" });
  x("x_smith14_spectacles", "s_smith1914", "smith1914", "Fa-hien, as a pious devotee, necessarily saw everything through Buddhist spectacles", { page: "298" });
  x("x_smith14_satraps", "s_smith1914", "smith1914", "his subjugation of the peninsula of Surashtra or Kathiawar, which had been ruled for centuries by the Saka dynasty, of foreign origin, known to European scholars as the Western Satraps.", { page: "290" }, "Of Chandragupta II.");
  x("x_smith14_388", "s_smith1914", "smith1914", "added those remote provinces to the empire must have occupied several years, and are known to have taken place between A.D. 388 and 401.", { page: "291" });
  x("x_smith14_pillar", "s_smith1914", "smith1914", "The celebrated iron pillar, on which the eulogy of a powerful king named Chandra is incised, was removed by the Tomara chief from its original position, probably at Mathura, and set up in A.D. 1052", { page: "386" });
  x("x_smith14_chandra_note", "s_smith1914", null, null, { page: "290", label: "Note 1" }, "Smith gives up his earlier identification of Chandra with Chandragupta II and follows Haraprasad Shastri (a king Chandravarman). The note is printed in interleaved columns that the OCR cannot follow, so it is cited by location only.");
  x("x_oxford_golden", "s_oxford", "oxford", "we shall offer a summary review of the golden age of the Guptas, which may be reckoned as extending from a.d. 320 to 480", { page: "156" });
  x("x_oxford_periclean", "s_oxford", "oxford", "A learned European scholar declares that 'the Gupta period is in the annals of classical India almost what the Periclean age is in the history of Greece'. An Indian author regards the time as that of 'the Hindu Renaissance'. Both phrases are justified.", { page: "156" }, "Smith names neither writer.");
  x("x_havell_golden", "s_havell", "havell", "The Gupta era is well known as the Golden Age of Sanskrit literature, and Orientalists are agreed in attributing to the Sanskrit revival the extant recensions of the epics, the works of Kalidasa, and other Indo-Aryan classics.", { page: "176", label: "page inferred" });

  // Wikipedia (tertiary)
  const wx = (ref: string, src: string, snap: CaptureKey, quote: string, section: string, note?: string) => x(ref, src, snap, quote, { section }, note);
  wx("x_wp_golden", "s_wp_gupta", "wpGupta", "This period has been considered as the Golden Age of India by some historians, although this characterisation has been disputed by others.", "Lead");
  x("x_wp_jha_note", "s_wp_gupta", "wpGuptaNotes", "According to D. N. Jha, caste distinctions became more entrenched and rigid during this time, as prosperity and the favour of the law accrued the top of the social scale, while the lower orders were degraded further.", { section: "Notes" }, "An explanatory note to the lead; it cites Jha (2002), pp. 149–73.");
  x("x_wp_pletcher_note", "s_wp_gupta", "wpGuptaNotes", "Some of these assumptions have been questioned by more-extensive studies of the post-Mauryan, pre-Gupta period.", { section: "References" }, "Wikipedia's footnote quoting Pletcher (2011), p. 90.");
  x("x_wp_pletcher_note2", "s_wp_gupta", "wpGuptaNotes", "suggests greater material prosperity, to such a degree that some historians argue for an urban decline in the Gupta period.", { section: "References" }, "Wikipedia's footnote quoting Pletcher (2011), p. 90, on the archaeology of the earlier Kushan levels.");
  wx("x_wp_titles", "s_wp_gupta", "wpGupta", "In the Allahabad Pillar inscription, Gupta and his successor Ghatotkacha are described as Maharaja (\"Great King\"), while the next king Chandragupta I is called a Maharajadhiraja (\"King of Great Kings\").", "Origin");
  wx("x_wp_vassals", "s_wp_gupta", "wpGupta", "In the later period, the title Maharaja was used by feudatory rulers, which has led to suggestions that Gupta and Ghatotkacha were vassals (possibly of the Kushan Empire).", "Origin");
  wx("x_wp_vassals2", "s_wp_gupta", "wpGupta", "However, there are several instances of paramount sovereigns using the title Maharaja, in both pre-Gupta and post-Gupta periods, so this cannot be said with certainty.", "Origin");
  wx("x_wp_cg1_dates", "s_wp_gupta", "wpGupta", "followed by Ghatotkacha's son, Chandragupta I, c. 319-335 CE.", "Origin");
  wx("x_wp_licchavi", "s_wp_gupta", "wpGupta", "Chandragupta I married the Licchavi princess Kumaradevi, which may have helped him extend his political power and dominions, enabling him to adopt the prestigious title Maharajadhiraja.", "Early rulers", "Cites Majumdar (1981), p. 10.");
  wx("x_wp_samudra_accession", "s_wp_gupta", "wpGupta", "Samudragupta succeeded his father around 335 or 350 CE, and ruled until c. 375.", "Samudragupta", "Cites Sharma (1989), pp. 51–52.");
  wx("x_wp_harisena", "s_wp_gupta", "wpGupta", "The Allahabad Pillar inscription, composed by his courtier Harisena, credits him with extensive conquests.", "Samudragupta", "Cites Agrawal (1989), pp. 106–07.");
  wx("x_wp_vishnugopa", "s_wp_gupta", "wpGupta", "The inscription suggests that Samudragupta advanced as far as the Pallava kingdom in the south, and defeated Vishnugopa, the Pallava regent of Kanchi.", "Samudragupta", "Cites Agrawal (1989), p. 110.");
  wx("x_wp_exaggeration", "s_wp_gupta", "wpGupta", "However, this is likely an exaggeration, and Samudragupta's panegyrist appears to have described acts of diplomacy as ones of subservience.", "Samudragupta", "Cites Sharma (1989), p. 90.");
  wx("x_wp_meghavarna", "s_wp_gupta", "wpGupta", "For example, the King of Simhala is listed among these foreign rulers, but it is known that from Chinese sources that the Simhala king Meghavarna merely sent presents to the Gupta emperor requesting his permission to build a Buddhist monastery; he did not express subservience.", "Samudragupta", "Cites Sharma (1989), p. 90.");
  wx("x_wp_veena", "s_wp_gupta", "wpGupta", "Such claims are corroborated by Samudragupta's gold coins, which depict him playing a veena.", "Samudragupta", "Cites Majumdar (1981), p. 31, and Sharma (1989), p. 94.");
  wx("x_wp_ashvamedha", "s_wp_gupta", "wpGupta", "He performed the Ashvamedha ritual (horse sacrifice), which was used by the ancient Indian kings and emperors to prove their imperial sovereignty", "Samudragupta");
  wx("x_wp_cg2_reign", "s_wp_gupta", "wpGupta", "Chandragupta II, Vikramaditya (Brave as the Sun), ruled from 375 until 415.", "Chandragupta II");
  wx("x_wp_style", "s_wp_gupta", "wpGupta", "The most famous remaining monuments in a broadly Gupta style, the caves at Ajanta, Elephanta, and Ellora (respectively Buddhist, Hindu, and mixed including Jain) were in fact produced under later dynasties, but primarily reflect the monumentality and balance of Gupta style.", "Art and architecture", "Cites Harle (1994), pp. 118–35.");
  wx("x_wp_ninegems", "s_wp_gupta", "wpGupta", "The court of Chandragupta II was made even more illustrious by the fact that it was graced by the Navaratna (Nine Jewels), a group of nine who excelled in the literary arts.", "Chandragupta II", "Uncited in this revision.");
  wx("x_wp_faxian_reign", "s_wp_gupta", "wpGupta", "Faxian, a Chinese Buddhist monk, was one of the pilgrims who visited India during the reign of the Gupta emperor Chandragupta II.", "Faxian", "Cites Legge (1886), without a page.");
  wx("x_wp_huna_455", "s_wp_gupta", "wpGupta", "He repelled a Huna attack around 455 CE, but the expense of the wars drained the empire's resources and contributed to its decline.", "Skandagupta", "Cites Kim, The Huns (2015), p. 50.");
  wx("x_wp_decline", "s_wp_gupta", "wpGupta", "The empire eventually died out because of factors such as substantial loss of territory and imperial authority caused by their own erstwhile feudatories, as well as the invasion by the Huna peoples (Kidarites and Alchon Huns) from Central Asia.", "Lead");
  wx("x_wp_later_kings", "s_wp_gupta", "wpGupta", "Skandagupta was followed by Purugupta (467–473), Kumaragupta II (473–476), Budhagupta (476–495), Narasimhagupta (495–530), Kumaragupta III (530–540), Vishnugupta (540–550), two lesser known kings namely, Vainyagupta and Bhanugupta.", "Decline");
  wx("x_wp_vishnugupta", "s_wp_gupta", "wpGupta", "The succession of the 6th-century Guptas is not entirely clear, but the tail end recognised ruler of the dynasty's main line was King Vishnugupta, reigning from 540 to 550.", "Decline", "Cites Upinder Singh (2008), p. 480.");
  wx("x_wp_last_grant", "s_wp_gupta", "wpGupta", "The last known inscription by a Gupta emperor is from the reign of Vishnugupta (the Damudarpur copper-plate inscription), in which he makes a land grant in the area of Kotivarsha (Bangarh in West Bengal) in 542/543 CE.", "Decline");
  wx("x_wp_huns_500", "s_wp_gupta", "wpGupta", "In the late 490's the Alchon Huns under Toramana and Mihirakula broke through the Gupta defences in the northwest, and much of the empire in the northwest was overrun by the Huns by 500.", "Decline", "Cites Neelis (2010), p. 162.");
  wx("x_wp_pillar_cg2", "s_wp_pillar", "wpPillar", "The oldest inscription on the pillar is that of a king named Chandra (IAST: Candra), generally identified as the Gupta emperor Chandragupta II.", "Inscription of King Chandra or Chandragupta II", "Cites Agrawal (1989), p. 177.");
  wx("x_wp_pillar_debate", "s_wp_pillar", "wpPillar", "The inscription is undated, and contains a eulogy of a king named Candra, whose dynasty it does not mention. The identity of this king, and thus the date of the pillar, has been the subject of much debate.", "Issuance", "Cites M. C. Joshi (ed.), King Chandra and the Mehrauli Pillar (1989).");
  wx("x_wp_pillar_trophy", "s_wp_pillar", "wpPillar", "The pillar was installed as a trophy in building the Quwwat-ul-Islam mosque and the Qutb complex by Sultan Iltutmish in the 13th century. Its original location, whether on the site itself or from elsewhere, is debated.", "History of the Iron Pillar");
  wx("x_wp_pillar_moved", "s_wp_pillar", "wpPillar", "It is not certain when the pillar was moved to Delhi from its original location.", "History of the Iron Pillar", "Cites Cynthia Talbot (2015), p. 79.");
  wx("x_wp_pillar_udayagiri", "s_wp_pillar", "wpPillar", "Meera Dass and R. Balasubramaniam (2004) theorized that the iron pillar was originally erected at Udayagiri.", "History of the Iron Pillar");
  wx("x_wp_spink", "s_wp_ajanta", "wpAjanta", "Walter M. Spink, have argued that most of the work took place over the very brief period from 460 to 480 CE, during the reign of Hindu Emperor Harishena of the Vākāṭaka dynasty.", "Caves of the later, or Vākāṭaka, period", "Cites Spink (2009), p. 2.");
  wx("x_wp_spink_challenged", "s_wp_ajanta", "wpAjanta", "However, this view has been challenged by several scholars, including Karl Khandalavala, Ajay Mitra Shastri, M.N. Deshpande, and Hans Bakker, who argue for a longer chronology extending into the mid-6th century.", "Caves of the later, or Vākāṭaka, period", "Cites Parimoo (1991), pp. 105–129.");
  wx("x_wp_ajanta_golden", "s_wp_ajanta", "wpAjanta", "The second phase of constructions and decorations at Ajanta corresponds to the very apogee of Classical India, or India's golden age.", "History", "Cites Spink, Ajanta: The End of the Golden Age (2005), p. 7.");
  wx("x_wp_nalanda_seal", "s_wp_nalanda", "wpNalanda", "A seal discovered at the site identifies a monarch named Shakraditya (Śakrāditya - r. c. 415–455 CE) as its founder and attributes the foundation of a sangharama (monastery) at the site to him.", "Foundation (5th century)", "Cites Monroe (2000), p. 166, and Dutt (1988), p. 329.");
  wx("x_wp_nalanda_kg1", "s_wp_nalanda", "wpNalanda", "Scholars such as Andrea Pinkney and Hartmut Scharfe conclude that Shakraditya is same as Kumaragupta I.", "Foundation (5th century)");
  wx("x_wp_nalanda_faxian", "s_wp_kumaragupta", "wpKumaragupta", "The earlier Chinese traveler Faxian, who toured India during 400-411 CE does not mention the existence of any monastery at Nalanda", "Religion", "Cites Dutt (1988), p. 329.");
  wx("x_wp_nalanda_doubt", "s_wp_kumaragupta", "wpKumaragupta", "This casts some doubt on the identification of Shakraditya with Kumaragupta I.", "Religion", "Cites Tej Ram Sharma (1978), p. 26.");
  wx("x_wp_mandasor_kg2", "s_wp_kumaragupta", "wpKumaragupta", "Majumdar argues that the \"Kumaragupta\" referred to in the inscription is the later king Kumaragupta II.", "Political history");
  wx("x_wp_udayagiri_401", "s_wp_udayagiri", "wpUdayagiri", "The Udayagiri Caves were created in final decades of the 4th century, and consecrated in 401 CE.", "History", "Cites Willis (2009) and Fleet (1888), pp. 25–34.");
  wx("x_wp_udayagiri_only", "s_wp_udayagiri", "wpUdayagiri", "They are the only site that can be verifiably associated with a Gupta period monarch from its inscriptions.", "Lead", "Cites Harle (1974), pp. 7–9.");
  wx("x_wp_varaha", "s_wp_udayagiri", "wpUdayagiri", "Cave 5 is a shallow niche more than a cave and contains the much-celebrated colossal Varaha panel of Udayagiri Caves.", "Cave 5: Vaishnavism");
  wx("x_wp_alchon_separate", "s_wp_alchon", "wpAlchon", "The Alchons have long been considered a part or a sub-division of the Hephthalites, or as their eastern branch, but are now regarded as a separate entity.", "Lead", "Cites Rezakhani (2017), pp. 105–124.");
  wx("x_wp_alchon_fall", "s_wp_alchon", "wpAlchon", "The Alchon invasion of the Indian subcontinent eradicated the Kidarite Huns who had preceded them by about a century, and contributed to the fall of the Gupta Empire, in a sense bringing an end to Classical India.", "Lead");
  wx("x_wp_eran_510", "s_wp_alchon", "wpAlchon", "In the Bhanugupta Eran inscription, this local ruler reports that his army participated in a great battle in 510 CE at Eran, where it suffered severe casualties.", "First Battle of Eran (510 CE)");
  wx("x_wp_peroz", "s_wp_hephthalites", "wpHephthalites", "When Kavad was ransomed Peroz I again attacked the Hephthalites resulting In the third battle, the Battle of Herat (484), where he was defeated and killed by the Hepthalite king Kun-khi.", "Victories over the Sasanian Empire (474–484 CE)", "Cites the UNESCO History of Civilizations of Central Asia (2006), p. 44.");
  wx("x_wp_kidarites", "s_wp_kidarites", "wpKidarites", "Next, circa 390-410 CE, the Kidarites invaded northwestern India, where they replaced the remnants of the Kushan Empire in the area of Punjab.", "Lead", "Uncited in this revision.");
  wx("x_wp_kidarites_alchon", "s_wp_kidarites", "wpKidarites", "Even after these encounters, the Kidarites seem to have retained the western part of the Gupta Empire, particularly central and western Punjab, until they were displaced by the invasion of the Alchon Huns at the end of the 5th century.", "Conflicts with the Gupta Empire");
  wx("x_wp_prabhavati", "s_wp_prabhavati", "wpPrabhavati", "Prabhavatigupta was the daughter of Chandragupta II, the ruler of the Gupta Empire, and queen Kuberanaga. She married Rudrasena II of the Vakataka dynasty during the reign of Rudrasena's father, Prithivishena I.", "Early life", "Cites Upinder Singh (2009), p. 482.");
  wx("x_wp_prabhavati_regent", "s_wp_prabhavati", "wpPrabhavati", "Following the death of her husband, she effectively ruled the Vakataka Empire as regent from about 390 to 410.", "Lead", "Uncited in this revision.");
  wx("x_wp_kalidasa_cg2", "s_wp_kalidasa", "wpKalidasa", "The most popular theory is that Kālidāsa flourished during the reign of Chandragupta II, and therefore lived around the 4th-5th century CE.", "Period", "Cites Rajan (2005), Wolpert (2005) and Mirashi & Navlekar (1969).");
  wx("x_wp_kalidasa_vikram", "s_wp_kalidasa", "wpKalidasa", "Several ancient and medieval books state that Kālidāsa was a court poet of a king named Vikramāditya.", "Period");
  wx("x_wp_aryabhata_476", "s_wp_aryabhata", "wpAryabhata", "This mentioned year corresponds to 499 CE, and implies that he was born in 476 CE. Aryabhata called himself a native of Kusumapura or Pataliputra (near present-day Patna, Bihar).", "Time and place of birth");
  wx("x_wp_zero", "s_wp_aryabhata", "wpAryabhata", "While he did not use a symbol for zero, the French mathematician Georges Ifrah argues that knowledge of zero was implicit in Aryabhata's place-value system as a place holder for the powers of ten with null coefficients.", "Place value system and zero", "Cites Ifrah (1998).");
  wx("x_wp_napoleon", "s_wp_samudragupta", "wpSamudragupta", "Vincent Smith referred to Samudragupta as the \"Indian Napoleon\" due to his remarkable military campaigns and strategic prowess.", "Legacy", "Cites Goyal (1967).");
  wx("x_wp_satraps_date", "s_wp_cg2", "wpChandragupta2", "The exact date of Chandragupta's victory is not known, but it can be tentatively dated to sometime between 397 and 409.", "Western Kshatrapas", "Cites Kulke & Rothermund (2004), p. 91.");
  wx("x_wp_pushyamitras", "s_wp_skandagupta", "wpSkandagupta", "However, an alternative interpretation of the inscription reads \"Yudhyamitras\" (a generic term for enemies) instead of \"Pushyamitras\".", "Ascension to the throne", "Cites Majumdar (1981), p. 70.");
  wx("x_wp_kidarite_hunas", "s_wp_skandagupta", "wpSkandagupta", "He repulsed an invasion by the Indo-Hephthalites (known as Hunas in India), probably the Kidarites.", "Lead");
  wx("x_wp_last_great", "s_wp_skandagupta", "wpSkandagupta", "is generally considered the last of the great Gupta Emperors", "Lead");

  // Modern works, by location only
  x("x_agrawal_110", "s_agrawal", null, null, { page: "110" }, "Location as given by Wikipedia (Gupta Empire) for Viṣṇugopa as Pallava; not checked against the book.");
  x("x_agrawal_177", "s_agrawal", null, null, { page: "177" }, "Location as given by Wikipedia (Iron pillar of Delhi) for Chandra as Chandragupta II; not checked against the book.");
  x("x_sharma_90", "s_sharma", null, null, { page: "90" }, "Location as given by Wikipedia (Gupta Empire) for the panegyrist's exaggeration and Meghavarṇa's embassy; not checked against the book.");
  x("x_jha", "s_jha", null, null, { page: "149", pageEnd: "173" }, "Location as given by Wikipedia (Gupta Empire, note to the lead); not checked against the book.");
  x("x_pletcher", "s_pletcher", null, null, { page: "90" }, "Location as given by Wikipedia (Gupta Empire), which quotes this page; not checked against the book.");
  x("x_spink", "s_spink", null, null, { page: "2" }, "Location as given by Wikipedia (Ajanta Caves) for the short chronology, 460–480 CE; not checked against the book.");
  x("x_dutt", "s_dutt", null, null, { page: "329" }, "Location as given by Wikipedia (Nalanda; Kumaragupta I) for the seal and Faxian's silence; not checked against the book.");
  x("x_rezakhani", "s_rezakhani", null, null, { page: "105", pageEnd: "124" }, "Location as given by Wikipedia (Alchon Huns); not checked against the book.");
  x("x_usingh", "s_usingh", null, null, { page: "480" }, "Location as given by Wikipedia (Gupta Empire) for Vishnugupta, 540–550; not checked against the book.");
  x("x_kulke", "s_kulke", null, null, { page: "91" }, "Location as given by Wikipedia (Chandragupta II) for the date of the Western Satrap conquest; not checked against the book.");

  // ------------------------------------------------------------ claims
  type ClaimSpec = {
    text: string;
    kind: "fact" | "interpretation" | "misconception" | "debate";
    assessment: "well_supported" | "supported" | "contested" | "weak" | "refuted";
    assessmentNote?: string;
    when?: Record<string, unknown>;
    themes?: string[];
    lenses?: string[];
    entities?: { entity: string; role?: "subject" | "place" | "participant" | "mention" }[];
    foundVia?: CaptureKey[];
    learning?: { prompt: string; answer: string };
  };
  const c = (ref: string, spec: ClaimSpec) =>
    ops.push({
      op: "create_claim",
      ref,
      text: spec.text,
      kind: spec.kind,
      assessment: spec.assessment,
      ...(spec.assessmentNote ? { assessmentNote: spec.assessmentNote } : {}),
      ...(spec.when ? { when: spec.when } : {}),
      ...(spec.themes ? { themes: spec.themes } : {}),
      ...(spec.lenses ? { lenses: spec.lenses } : {}),
      ...(spec.entities ? { entities: spec.entities.map((x) => ({ role: "subject", ...x })) } : {}),
      ...(spec.foundVia ? { foundVia: spec.foundVia.map(viaWp) } : {}),
      ...(spec.learning ? { learning: spec.learning } : {}),
    } as ChangeOpInput);
  const G = { entity: "gupta-empire", role: "mention" as const };

  // 1. Beginnings
  c("c_era", {
    text: "The Gupta kings dated their inscriptions in their own era. J. F. Fleet showed in 1888 that its year 0 fell in 319–320 CE, so that, for example, Gupta year 82 is 401–402 CE.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: d(319), end: d(320), basis: "Epoch of the Gupta era (Fleet 1888)" },
    themes: ["sources", "polity"],
    lenses: ["philological"],
    entities: [{ entity: "gupta-empire" }, { entity: e("fleet"), role: "mention" }, { entity: e("t_era"), role: "mention" }],
    learning: { prompt: "From what year does the Gupta era count?", answer: "Its year 0 fell in 319–320 CE: add about 320 to a Gupta year to get the year CE." },
  });
  c("c_alberuni", {
    text: "Writing about 1030, al-Bīrūnī reported that people said the Guptas were “wicked powerful people” and that their era was counted from the time they ceased to exist.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "This tradition about the era's starting point is not accepted: dated Gupta inscriptions use the era during Gupta rule, from year 82 under Chandragupta II (Fleet 1888).",
    when: { start: c_(1030), basis: "Al-Bīrūnī's India, written c. 1030" },
    themes: ["historiography", "sources"],
    lenses: ["primary_source"],
    entities: [G, { entity: e("t_era"), role: "mention" }],
  });
  c("c_cg1_reign", {
    text: "Chandragupta I is usually taken to have founded the Gupta dynasty's power, and his reign to have begun the Gupta era, in 319–320 CE; it is dated to about 319–335.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "The link between the era and his accession is an inference; no inscription says who began the era. Samudragupta's accession, which ends the reign, is put at about 335 or 350.",
    when: { start: c_(319), end: c_(335, true), label: "c. 319–c. 335/350" },
    themes: ["polity"],
    entities: [{ entity: e("cg1") }, { entity: e("t_era"), role: "mention" }],
    foundVia: ["wpGupta"],
  });
  c("c_titles", {
    text: "Samudragupta's inscription calls his great-grandfather Gupta and grandfather Ghaṭotkaca mahārāja, “great king”, but his father Chandragupta I mahārājādhirāja, “great king of kings”.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The lesser title has led to suggestions that the first two kings were vassals of a greater power, possibly the Kushans; that cannot be said with certainty.",
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("cg1") }, { entity: e("allahabad_pillar"), role: "mention" }, { entity: e("t_maharajadhiraja"), role: "mention" }],
    foundVia: ["wpGupta"],
    learning: { prompt: "Which Gupta king first took the title “great king of kings” (mahārājādhirāja)?", answer: "Chandragupta I. His father and grandfather were only “great kings” (mahārāja)." },
  });
  c("c_licchavi", {
    text: "Chandragupta I married Kumāradevī of the Licchavi family. Their son Samudragupta is always called “the daughter's son of Lichchhavi” in the family's inscriptions, and historians think the marriage may have helped Chandragupta I extend his power.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The marriage is in the inscriptions; that it brought power is a modern inference (Wikipedia, citing Majumdar 1981).",
    themes: ["polity", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("cg1") }, { entity: e("kumaradevi"), role: "participant" }, { entity: e("samudragupta"), role: "mention" }],
    foundVia: ["wpGupta"],
  });
  c("c_purana", {
    text: "A Purāṇic list of dynasties says kings of the Gupta line would rule along the Ganges, at Prayāga and Sāketa, and in Magadha. F. E. Pargiter (1913) read this as the small early kingdom, before Samudragupta's conquests.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "The Purāṇas were compiled over centuries; Pargiter's dating of this passage to soon after 320 is his inference from what it leaves out.",
    when: { start: c_(320), end: c_(335), basis: "Pargiter's dating of the passage" },
    themes: ["polity", "sources"],
    lenses: ["philological"],
    entities: [G, { entity: "pataliputra", role: "mention" }],
  });
  c("c_chosen", {
    text: "Samudragupta's inscription says his father chose him, embracing him and exclaiming that he was “worthy”. Fleet read this as Chandragupta I picking him from among several brothers to succeed him.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("samudragupta") }, { entity: e("cg1"), role: "participant" }],
  });

  // 2. Samudragupta
  c("c_pillar", {
    text: "Samudragupta's praise poem was carved on a stone column at Allahabad (Prayāga) that already bore Aśoka's edicts of the third century BCE. The column may first have stood at Kauśāmbī.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources"],
    lenses: ["archaeological"],
    entities: [{ entity: e("allahabad_pillar") }, { entity: "ashoka", role: "mention" }, { entity: e("samudragupta"), role: "mention" }],
    learning: { prompt: "What older text shares the Allahabad pillar with Samudragupta's inscription?", answer: "Aśoka's edicts of the third century BCE." },
  });
  c("c_harishena", {
    text: "The poem was composed by Hariṣeṇa, one of Samudragupta's officers, whose titles included sāṃdhivigrahika, “minister of peace and war”.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources", "culture", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harishena_poet") }, { entity: e("allahabad_pillar"), role: "mention" }, { entity: e("t_prashasti"), role: "mention" }],
  });
  c("c_north", {
    text: "In the north (Āryāvarta), the inscription says, Samudragupta “violently exterminated” nine named kings and many others, and made the kings of the forest lands his servants.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "This is what the praise poem claims; it is the main evidence for the wars, and little else confirms them.",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("samudragupta") }, { entity: e("t_aryavarta"), role: "mention" }],
    learning: { prompt: "How, according to his inscription, did Samudragupta treat the kings of the north (Āryāvarta) and of the south?", answer: "He “violently exterminated” the northern kings, but captured and then released the southern ones." },
  });
  c("c_south", {
    text: "In the south (Dakṣiṇāpatha), it says, he captured and then released a dozen kings, among them Viṣṇugopa of Kāñchī.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The praise poem's account. On its face, capture and release means submission, not lasting rule.",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("samudragupta") }, { entity: e("t_dakshinapatha"), role: "mention" }, { entity: "pallava-dynasty", role: "mention" }],
  });
  c("c_vishnugopa", {
    text: "Historians identify Viṣṇugopa of Kāñchī, one of the southern kings in Samudragupta's inscription, as a ruler of the Pallava kingdom.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Fleet (1888) translates the name without identifying the dynasty; the identification is from later scholarship (Agrawal 1989, by page only).",
    themes: ["polity"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: "pallava-dynasty" }, { entity: e("samudragupta"), role: "mention" }],
    foundVia: ["wpGupta"],
  });
  c("c_frontier", {
    text: "Frontier kingdoms to the east and north, such as Samataṭa, Kāmarūpa and Nepāla, and peoples of the west such as the Mālavas and Yaudheyas, are said to have paid him taxes, obeyed his orders and come to bow before him.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("samudragupta") }, { entity: "kamarupa", role: "mention" }, { entity: "yaudheya", role: "mention" }],
  });
  c("c_distant", {
    text: "Distant rulers, the Daivaputra-Shāhi-Shāhānushāhi, the Śakas and Muruṇḍas, and the people of Siṃhala (Sri Lanka) and other islands, are said to have served him with gifts, even of maidens, and to have asked for his Garuḍa seal.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("samudragupta") }, { entity: "kushan-empire", role: "mention" }],
  });
  c("c_daivaputra", {
    text: "Alexander Cunningham, quoted by Fleet, identified “Daivaputra, Shāhi, Shāhānushāhi” as the titles of the Kushan kings and their successors in the north-west.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Fleet rejected Cunningham's early dating of Samudragupta, not this reading of the titles.",
    themes: ["polity"],
    lenses: ["philological"],
    entities: [{ entity: "kushan-empire" }, { entity: e("samudragupta"), role: "mention" }],
  });
  c("c_simhala", {
    text: "Historians think the poem presents diplomacy as submission: Chinese sources say the Sri Lankan king Meghavarṇa merely sent gifts to ask leave to build a Buddhist monastery.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Reported by Wikipedia, citing Tej Ram Sharma (1989, p. 90), cited here by page only. The Chinese sources are not quoted on this page.",
    themes: ["polity", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("samudragupta") }, { entity: e("t_prashasti"), role: "mention" }],
    foundVia: ["wpGupta"],
  });
  c("c_pratyanta", {
    text: "How large the empire was depends partly on one word: Fleet noted that the “frontier kings” could be kings inside those border countries or just beyond them.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("samudragupta") }, { entity: e("fleet"), role: "mention" }],
  });
  c("c_poet_king", {
    text: "The inscription praises Samudragupta as a “king of poets” and a musician; gold coins of the “lyrist type” show him playing a stringed instrument.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["culture"],
    lenses: ["primary_source", "archaeological"],
    entities: [{ entity: e("samudragupta") }],
    learning: { prompt: "What evidence besides his inscription shows Samudragupta as a musician?", answer: "His gold coins of the “lyrist type”, which show him playing a stringed instrument." },
  });
  c("c_ashvamedha", {
    text: "Later Gupta inscriptions call Samudragupta the restorer of the horse sacrifice (aśvamedha), a ritual of supreme kingship “long in abeyance”.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("samudragupta") }, { entity: e("t_ashvamedha"), role: "mention" }],
  });

  // 3. Chandragupta II
  c("c_cg2_records", {
    text: "Chandragupta II's dated inscriptions run from Gupta year 82 to 93 or 95, about 401 to 414 CE. He is usually said to have reigned from about 375 to 415.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The inscriptional years are firm; the start of the reign is an estimate.",
    when: { start: c_(375), end: c_(415) },
    themes: ["polity", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("cg2") }],
    foundVia: ["wpGupta"],
  });
  c("c_satraps", {
    text: "Chandragupta II conquered the Western Satraps, the Śaka kings who had ruled Gujarat and Saurashtra for centuries. Vincent Smith (1914) dated the conquest between 388 and 401; a recent survey puts it between 397 and 409.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The conquest is generally accepted; its date is uncertain. The later dates are from Kulke and Rothermund (2004, p. 91), cited here by page only.",
    when: { start: c_(388), end: c_(409), basis: "Range of the estimates quoted" },
    themes: ["war", "polity"],
    entities: [{ entity: e("cg2") }, { entity: "western-satraps", role: "participant" }],
    foundVia: ["wpChandragupta2"],
    learning: { prompt: "Which western kingdom did Chandragupta II conquer?", answer: "The Western Satraps, the Śaka kings who had ruled Saurashtra (Kathiawar); Smith dated the conquest between 388 and 401." },
  });
  c("c_udayagiri", {
    text: "At Udayagiri near Vidiśā, a cave inscription of Gupta year 82 (401–402 CE) records the gift of a local mahārāja who “meditates on the feet” of Chandragupta II. The site has shrines of both Viṣṇu and Śiva.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: d(401), end: d(402), basis: "Gupta year 82 (Fleet 1888)" },
    themes: ["religion", "polity"],
    lenses: ["primary_source", "archaeological"],
    entities: [{ entity: e("udayagiri"), role: "place" }, { entity: e("cg2") }, { entity: e("t_feudatory"), role: "mention" }],
    learning: { prompt: "What is dated Gupta year 82 (401–402 CE)?", answer: "A cave inscription at Udayagiri, near Vidiśā, of a feudatory of Chandragupta II." },
  });
  c("c_virasena", {
    text: "Another Udayagiri inscription says Chandragupta II's minister of peace and war, Vīrasena, a poet from Pāṭaliputra, came there “accompanied by the king in person, who was seeking to conquer the whole world”, and had a cave made for Śiva.",
    kind: "fact",
    assessment: "supported",
    themes: ["war", "religion", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("cg2") }, { entity: e("udayagiri"), role: "place" }, { entity: "pataliputra", role: "mention" }],
  });
  c("c_varaha", {
    text: "One of the Udayagiri shrines holds a colossal relief of Varāha, Viṣṇu in the form of a boar.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "culture"],
    lenses: ["archaeological"],
    entities: [{ entity: e("udayagiri"), role: "place" }, { entity: e("t_varaha"), role: "mention" }],
    foundVia: ["wpUdayagiri"],
  });
  c("c_sanchi", {
    text: "At the Buddhist monastery of Sanchi, an officer who said he lived by Chandragupta II's favour made a gift in Gupta year 93 (412–413 CE) so that five monks would be fed and a lamp kept burning.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(412), end: d(413), basis: "Gupta year 93 (Fleet 1888)" },
    themes: ["religion", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: "sanchi", role: "place" }, { entity: e("cg2"), role: "mention" }, { entity: e("t_vihara"), role: "mention" }],
  });
  c("c_prabhavati", {
    text: "Chandragupta II's daughter Prabhāvatīguptā married Rudrasena II, king of the Vākāṭakas of the Deccan, and after his death ruled the Vākāṭaka kingdom as regent, by one estimate from about 390 to 410.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Vākāṭaka grants call her the daughter of the mahārājādhirāja Devagupta; identifying Devagupta with Chandragupta II is modern scholarship not quoted here (Wikipedia, citing Upinder Singh). The regency dates are uncited in Wikipedia.",
    themes: ["polity", "society"],
    lenses: ["primary_source", "mainstream_academic"],
    entities: [{ entity: e("prabhavati") }, { entity: e("cg2"), role: "mention" }, { entity: "vakataka-empire", role: "mention" }],
    foundVia: ["wpPrabhavati"],
    learning: { prompt: "Who was Prabhāvatīguptā?", answer: "Chandragupta II's daughter, queen of the Vākāṭaka king Rudrasena II and regent of the Vākāṭaka kingdom after his death." },
  });
  c("c_fleet_vakataka", {
    text: "Fleet (1888) dated the Vākāṭaka kings to about 680–700 CE, because he took Prabhāvatīguptā's father Devagupta for a later king of Magadha.",
    kind: "interpretation",
    assessment: "refuted",
    assessmentNote: "Later scholarship identifies her father with Chandragupta II and places the Vākāṭakas in the fourth and fifth centuries (see the claim on Prabhāvatīguptā).",
    themes: ["historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("fleet") }, { entity: "vakataka-empire", role: "mention" }, { entity: e("prabhavati"), role: "mention" }],
  });
  c("c_pillar_text", {
    text: "The iron pillar at Mehrauli in Delhi carries a posthumous praise of a king named Chandra, who fought enemies in the Vaṅga lands (Bengal), crossed the seven mouths of the Indus to defeat the Vāhlīkas, and set up the pillar as a standard of Viṣṇu on a hill called Viṣṇupada.",
    kind: "fact",
    assessment: "supported",
    themes: ["war", "religion", "technology"],
    lenses: ["primary_source"],
    entities: [{ entity: e("iron_pillar") }],
  });
  c("c_pillar_undated", {
    text: "The iron pillar's inscription is not dated and does not name Chandra's family, so who he was, and when the pillar was made, are debated.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["sources", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("iron_pillar") }],
    foundVia: ["wpPillar"],
    learning: { prompt: "Why is the date of the iron pillar debated?", answer: "Its inscription is not dated and does not name Chandra's family." },
  });
  c("c_chandra_cg2", {
    text: "Chandra of the iron pillar is now generally identified with the Gupta emperor Chandragupta II.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "The majority view, reported by Wikipedia citing Agrawal (1989, p. 177); the arguments are not quoted on this page.",
    themes: ["historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("iron_pillar") }, { entity: e("cg2"), role: "mention" }],
    foundVia: ["wpPillar"],
  });
  c("c_chandra_fleet", {
    text: "Fleet (1888) leaned towards Chandragupta I as the pillar's Chandra, and thought a younger brother of the Hūṇa king Mihirakula also possible.",
    kind: "interpretation",
    assessment: "weak",
    themes: ["historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("iron_pillar") }, { entity: e("fleet"), role: "mention" }, { entity: e("cg1"), role: "mention" }],
  });
  c("c_chandra_smith", {
    text: "Vincent Smith (1914) gave up identifying Chandra with Chandragupta II, preferring another king, Chandravarman, and thought the pillar had been brought to Delhi from its first site, probably Mathura, in 1052.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "The identification with Chandravarman is in a footnote cited here by location only.",
    themes: ["historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("iron_pillar") }, { entity: e("vasmith"), role: "mention" }],
  });
  c("c_pillar_moved", {
    text: "Where the iron pillar first stood is debated. It was set up in its present place in the Qutb complex in the 13th century; Mathura and Udayagiri have been suggested as its original site, while Fleet thought it had never moved.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["historiography"],
    lenses: ["archaeological"],
    entities: [{ entity: e("iron_pillar") }, { entity: e("udayagiri"), role: "mention" }],
    foundVia: ["wpPillar"],
  });

  // 4. Faxian
  c("c_faxian_journey", {
    text: "The Chinese monk Faxian set out from Chang'an in 399 to find the Buddhist books of monastic rules in India, and was away for about fifteen years.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(399), end: c_(414), basis: "Legge (1886)" },
    themes: ["religion", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }],
    learning: { prompt: "When did Faxian travel, and why?", answer: "From 399, for about fifteen years, to find Buddhist books of monastic rules in India." },
  });
  c("c_middle_kingdom", {
    text: "Faxian described the “Middle Kingdom”, the Ganges plain, as mild in climate, with people “numerous and happy” who did not have to register their households; only those who farmed the king's land paid him a share of the harvest.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "An outsider's impression, written for Buddhist readers in China.",
    themes: ["society", "economy", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }, G],
  });
  c("c_punishments", {
    text: "Faxian wrote that the king governed without beheadings or flogging: criminals were fined, and even repeated rebels only had their right hand cut off. The king's guards and attendants were paid salaries.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Faxian's report; he does not say which king.",
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }, G],
    learning: { prompt: "How, according to Faxian, were criminals punished?", answer: "They were fined; even repeated rebels only had their right hand cut off. There were no beheadings." },
  });
  c("c_chandalas", {
    text: "Faxian also described the Chandalas, people held to be impure, who lived apart from others and had to strike a piece of wood when entering a town or market, so that others could avoid touching them.",
    kind: "fact",
    assessment: "supported",
    themes: ["society", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }, { entity: e("t_chandala"), role: "mention" }],
    learning: { prompt: "What did Faxian say the Chandalas had to do when they entered a town?", answer: "Strike a piece of wood to announce themselves, so that others could avoid them." },
  });
  c("c_customs", {
    text: "According to Faxian, nobody in the country killed animals, drank alcohol or ate onions or garlic, except the Chandalas; the markets had no butchers or sellers of drink, and people traded with cowrie shells.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "A sweeping statement by a Buddhist monk, who stressed what fitted Buddhist ideals.",
    themes: ["society", "economy", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }],
  });
  c("c_grants", {
    text: "Faxian says kings had long endowed monasteries with fields, houses, gardens and the people and cattle living on them, “the grants being engraved on plates of metal”.",
    kind: "fact",
    assessment: "supported",
    themes: ["economy", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }, { entity: e("t_vihara"), role: "mention" }],
  });
  c("c_pataliputra", {
    text: "At Pāṭaliputra, Faxian saw Aśoka's old palace still standing and thought it built by spirits; he found Magadha's towns the greatest in the Middle Kingdom and their people rich.",
    kind: "fact",
    assessment: "supported",
    themes: ["infrastructure", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: "pataliputra", role: "place" }, { entity: e("faxian") }, { entity: "ashoka", role: "mention" }],
  });
  c("c_charity", {
    text: "In the cities of Magadha, Faxian wrote, leading families ran houses that gave free help and medicine to the poor, orphans, widowers, the disabled and the sick, where doctors examined them.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Faxian's report; no other source of the time is quoted here to confirm it.",
    themes: ["society", "technology"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }, { entity: "pataliputra", role: "place" }],
    learning: { prompt: "What did Faxian say the leading families of Magadha's cities provided for the poor and sick?", answer: "Houses that gave free help and medicine, where doctors examined them." },
  });
  c("c_monasteries", {
    text: "Beside Aśoka's stūpa at Pāṭaliputra there were a Mahāyāna and a Hīnayāna monastery with 600 or 700 monks between them, and every year the city held a procession of images.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: "pataliputra", role: "place" }, { entity: e("faxian") }, { entity: e("t_vihara"), role: "mention" }],
  });
  c("c_sanskrit", {
    text: "Faxian stayed three years at Pāṭaliputra learning Sanskrit and copying the monastic rules he had come for; on his way he also visited the Deer Park near Vārāṇasī, at Sarnath.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }, { entity: "pataliputra", role: "place" }, { entity: "sarnath", role: "place" }],
  });
  c("c_ceylon", {
    text: "Faxian then sailed to Ceylon (Sri Lanka), where he stayed two years, and returned to China by sea by way of Java.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }],
  });
  c("c_noking", {
    text: "Faxian never names the king whose lands he travelled through; Vincent Smith complained that he “did not trouble even to mention the name of the mighty monarch”.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Faxian speaks only of “the king of the country”. That he travelled in Chandragupta II's reign is a modern inference from the dates.",
    themes: ["sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("faxian") }, { entity: e("cg2"), role: "mention" }],
    learning: { prompt: "Does Faxian name the king whose lands he travelled through?", answer: "No. Vincent Smith complained that he “did not trouble even to mention the name of the mighty monarch”." },
  });
  c("c_spectacles", {
    text: "Even Vincent Smith, who admired Faxian's picture, warned that the pilgrim “saw everything through Buddhist spectacles”.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["sources", "historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("faxian") }, { entity: e("vasmith"), role: "mention" }],
  });

  // 5. Poets, astronomers, temples and guilds
  c("c_kalidasa_date", {
    text: "Kālidāsa's dates are not known. Arthur Ryder (1912) put him “probably” in the fifth century, “by no means certain”; the most popular modern view places him in Chandragupta II's reign.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "No biographical records of the poet survive; his date is inferred from his works and later traditions.",
    when: { start: c_(400, true), end: c_(500, true), label: "probably 5th century" },
    themes: ["culture", "historiography"],
    entities: [{ entity: e("kalidasa") }],
    foundVia: ["wpKalidasa"],
    learning: { prompt: "When did Kālidāsa live?", answer: "Probably in the fifth century CE, but no one knows for certain; most link him with Chandragupta II." },
  });
  c("c_kalidasa_ujjain", {
    text: "Kālidāsa's poems show he knew Ujjain well; in the Cloud Messenger he praises it as a “gem” of the Avanti country.",
    kind: "fact",
    assessment: "supported",
    themes: ["culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("kalidasa") }, { entity: "ujjain", role: "place" }],
  });
  c("c_ninegems_late", {
    text: "The story that Kālidāsa was one of the “nine gems” at the court of a king Vikramāditya is a late tradition. Even Ryder, who believed in such a king, called its details “open to suspicion”, and the king has not been identified with any known ruler.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "culture"],
    entities: [{ entity: e("kalidasa") }, { entity: e("cg2"), role: "mention" }],
  });
  c("c_aryabhata_date", {
    text: "Āryabhaṭa wrote that he was 23 years old when three quarters of the great age and 3,600 years had passed. His translator W. E. Clark worked this out as 499 CE, so he was born in 476.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: d(499), basis: "Āryabhaṭīya III.10 (Clark 1930)" },
    themes: ["technology", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("aryabhata") }],
    learning: { prompt: "How do we know Āryabhaṭa was born in 476?", answer: "He says he was 23 when 3,600 years of the current age had passed, which is 499 CE." },
  });
  c("c_kusumapura", {
    text: "Āryabhaṭa says his work sets out “the science which is honored at Kusumapura”, usually taken to be Pāṭaliputra.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Clark notes that Kusumapura may or may not have been his birthplace.",
    themes: ["technology"],
    lenses: ["primary_source"],
    entities: [{ entity: e("aryabhata") }, { entity: "pataliputra", role: "place" }],
    foundVia: ["wpAryabhata"],
  });
  c("c_rotation", {
    text: "Āryabhaṭa compared the stars' apparent westward motion to the way the shore seems to move backward to a man in a moving boat; Clark read the verse as teaching that the Earth rotates.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "The verse itself speaks only of how the stars appear; the rotation is Clark's reading of it.",
    themes: ["technology"],
    lenses: ["primary_source"],
    entities: [{ entity: e("aryabhata") }],
  });
  c("c_zero", {
    text: "Āryabhaṭa used a place-value system, but did not use a symbol for zero; whether such a symbol was in use in his time is disputed.",
    kind: "fact",
    assessment: "supported",
    themes: ["technology"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("aryabhata") }],
    foundVia: ["wpAryabhata"],
    learning: { prompt: "Did Āryabhaṭa use a sign for zero?", answer: "No. He used place value, but no zero symbol is known from his work." },
  });
  c("c_silk", {
    text: "At Daśapura (Mandsaur), a guild of silk weavers who had moved there from Lāṭa in Gujarat built a temple of the Sun in about 437 CE, while “Kumaragupta was reigning over the earth”, with money earned by their craft.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Fleet's reading of the date and of the king, Kumāragupta I. R. C. Majumdar argued that the Kumāragupta meant is the later Kumāragupta II.",
    when: { start: d(437), end: d(438), basis: "Mālava year 493 elapsed, 494 current: 437–438 CE (Fleet 1888)" },
    themes: ["economy", "religion", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mandsaur"), role: "place" }, { entity: e("kg1"), role: "mention" }, { entity: e("t_guild"), role: "mention" }],
    learning: { prompt: "Who built the temple of the Sun at Daśapura (Mandsaur) in about 437 CE?", answer: "A guild of silk weavers who had migrated from Lāṭa (Gujarat), with money from their craft." },
  });
  c("c_silk_work", {
    text: "The same inscription says that some of the weavers kept to silk-weaving while others took up other pursuits, such as astrology; when part of the temple fell into disrepair “under other kings”, it was repaired in about 473.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(473), end: d(474), basis: "Mālava year 529 elapsed (Fleet 1888)" },
    themes: ["society", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mandsaur"), role: "place" }, { entity: e("t_guild"), role: "mention" }],
  });
  c("c_indor", {
    text: "A copper plate of 465–466 CE records a Brahmin's gift to keep a lamp burning in a temple of the Sun at Indrapura, with the money held by the town's guild of oil-men.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(465), end: d(466), basis: "Gupta year 146 (Fleet 1888)" },
    themes: ["economy", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("skandagupta"), role: "mention" }, { entity: e("t_guild"), role: "mention" }],
  });
  c("c_kahaum", {
    text: "In 460–461 CE, in Skandagupta's reign, a man named Madra set up a stone pillar at Kahaum with five images of Jain Tīrthaṅkaras.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(460), end: d(461), basis: "Gupta year 141 (Fleet 1888)" },
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("skandagupta"), role: "mention" }, { entity: e("t_tirthankara"), role: "mention" }],
  });
  c("c_nalanda", {
    text: "Xuanzang, who visited in the seventh century, was told that a king Śakrāditya built the first monastery at Nālandā; a seal found there also names him as founder, and many scholars identify him with Kumāragupta I.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["religion", "culture"],
    lenses: ["primary_source", "mainstream_academic"],
    entities: [{ entity: e("nalanda"), role: "place" }, { entity: e("kg1"), role: "mention" }, { entity: e("xuanzang"), role: "mention" }],
    foundVia: ["wpNalanda"],
  });
  c("c_nalanda_doubt", {
    text: "The date is uncertain: Faxian, who passed through Magadha in the early fifth century, mentions no monastery at Nālandā, and Xuanzang's tradition places Śakrāditya “not long after the Nirvāṇa of Buddha”, centuries too early.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["religion", "sources"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("nalanda"), role: "place" }, { entity: e("faxian"), role: "mention" }],
    foundVia: ["wpKumaragupta"],
  });

  // 6. Skandagupta and the Hunas
  c("c_bhitari_restore", {
    text: "Skandagupta's pillar at Bhitari says that, to restore his family's fallen fortunes, he once spent a whole night sleeping on the bare ground, and that he defeated the Pushyamitras.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Some read the enemies' name as “Yudhyamitras”, simply “enemies”, instead of Pushyamitras.",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("skandagupta") }, { entity: e("bhitari"), role: "place" }],
    foundVia: ["wpSkandagupta"],
  });
  c("c_bhitari_huna", {
    text: "The Bhitari pillar also says the earth shook when Skandagupta “joined in close conflict with the Hūṇas”. Historians date his victory to about 455 and think these Hūṇas were probably the Kidarites.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The war is in the inscription; its date and the identity of the Hūṇas are modern inferences (Wikipedia, citing Kim 2015).",
    when: { start: c_(455) },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("skandagupta") }, { entity: e("bhitari"), role: "place" }, { entity: "kidarites", role: "participant" }, { entity: e("t_huna"), role: "mention" }],
    foundVia: ["wpSkandagupta"],
    learning: { prompt: "Which invaders did Skandagupta fight, according to the Bhitari pillar?", answer: "The Hūṇas, probably the Kidarites; historians date his victory to about 455." },
  });
  c("c_junagadh", {
    text: "On the same boulder at Junāgaḍh as Aśoka's edicts, Skandagupta's governor recorded that the embankment of the Sudarśana lake burst in heavy rain in 455–456 CE and was rebuilt in two months, in 456–457.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(455), end: d(457), basis: "Gupta years 136–137 (Fleet 1888)" },
    themes: ["infrastructure", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: "girnar", role: "place" }, { entity: e("skandagupta"), role: "mention" }, { entity: "ashoka", role: "mention" }],
    learning: { prompt: "What disaster does Skandagupta's inscription at Junāgaḍh record?", answer: "The bursting of the Sudarśana lake's embankment in 455–456 CE, and its rebuilding." },
  });
  c("c_parnadatta", {
    text: "The Junāgaḍh inscription says Skandagupta appointed Parṇadatta to govern Surāṣṭra (Saurashtra), and was “easy at heart” once he had.",
    kind: "fact",
    assessment: "supported",
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("skandagupta") }, { entity: "girnar", role: "place" }],
  });
  c("c_eulogy", {
    text: "The same inscription claims that while Skandagupta reigned no subject was poor or in misery, or punished with too much torture; it is a praise poem, not a survey.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["governance", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("skandagupta") }, { entity: e("t_prashasti"), role: "mention" }],
  });

  // 7. The end
  c("c_budhagupta", {
    text: "A pillar at Eran dated 484–485 CE names Budhagupta as king, his governor Surashmichandra ruling between the Yamunā and the Narmadā, and the brothers Mātṛviṣṇu and Dhanyaviṣṇu, who set it up as a flagstaff of Viṣṇu.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(484), end: d(485), basis: "Gupta year 165 (Fleet 1888)" },
    themes: ["polity", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("eran"), role: "place" }, { entity: e("budhagupta") }, { entity: e("t_feudatory"), role: "mention" }],
  });
  c("c_toramana", {
    text: "A few years later, “in the first year” of the Hūṇa king Toramāṇa, the same Dhanyaviṣṇu built a temple at Eran for a colossal stone boar, Viṣṇu as Varāha; his brother Mātṛviṣṇu was by then dead.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "religion", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("eran"), role: "place" }, { entity: e("toramana") }, { entity: e("t_varaha"), role: "mention" }],
    learning: { prompt: "What did Dhanyaviṣṇu build at Eran under Toramāṇa?", answer: "A temple for a colossal stone boar, Viṣṇu as Varāha, “in the first year” of the Hūṇa king Toramāṇa." },
  });
  c("c_eran_sequence", {
    text: "From the two Eran inscriptions Fleet argued that Toramāṇa took eastern Malwa shortly after Budhagupta, and that the Hūṇas, repulsed by Skandagupta, attacked again under his leadership.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "war", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("toramana") }, { entity: e("budhagupta"), role: "mention" }, { entity: e("alchon"), role: "mention" }],
  });
  c("c_huns_500", {
    text: "Historians date the Hūṇa breakthrough to the late 490s: under Toramāṇa and Mihirakula, the Alchon Huns overran much of the north-west by 500.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: c_(495), end: c_(500) },
    themes: ["war"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("alchon") }, { entity: e("toramana"), role: "participant" }, { entity: e("mihirakula"), role: "participant" }],
    foundVia: ["wpGupta"],
  });
  c("c_goparaja", {
    text: "A memorial at Eran of Gupta year 191 (510–511 CE) records that Goparāja was killed in a battle he fought alongside a king named Bhānugupta, and that his wife “accompanied (him) onto the funeral pyre”.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(510), end: d(511), basis: "Gupta year 191" },
    themes: ["war", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("eran"), role: "place" }, { entity: e("t_sati"), role: "mention" }],
    foundVia: ["wpAlchon"],
    learning: { prompt: "What does the Eran memorial of 510 CE record about Goparāja's wife?", answer: "That she accompanied him onto his funeral pyre: an early record of a widow's burning (satī)." },
  });
  c("c_sati_early", {
    text: "Fleet called the Goparāja memorial an “early instance” of the burning of widows, the practice later called satī.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["society", "religion"],
    lenses: ["philological"],
    entities: [{ entity: e("t_sati"), role: "mention" }, { entity: e("eran"), role: "place" }],
  });
  c("c_mihirakula", {
    text: "At Gwalior, an inscription dated in the fifteenth year of Mihirakula, Toramāṇa's son, records the building of a stone temple of the Sun.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mihirakula") }, { entity: e("toramana"), role: "mention" }],
  });
  c("c_mihirakula_beal", {
    text: "Buddhist tradition recorded by Xuanzang remembers Mihirakula as a king who ruled over India and ordered monks killed and the Buddha's teaching destroyed.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "A hostile tradition written down a century or more later; his own reign saw a temple of the Sun built at Gwalior.",
    themes: ["religion", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mihirakula") }, { entity: e("xuanzang"), role: "mention" }],
  });
  c("c_yashodharman", {
    text: "Around 532 CE, Yaśodharman of Daśapura boasted on pillars at Mandsaur that he ruled lands that even the Gupta kings had never held and the Hūṇas had never reached, and that even king Mihirakula had bowed at his feet.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Yaśodharman's own praise poem; Fleet dated his defeat of Mihirakula to within a few years of 533–534.",
    when: { start: c_(532), basis: "Mandsaur inscription of Mālava year 589 (Fleet 1888)" },
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("yashodharman") }, { entity: e("mihirakula"), role: "participant" }, { entity: e("mandsaur"), role: "place" }],
    learning: { prompt: "Who boasted that even king Mihirakula had bowed at his feet?", answer: "Yaśodharman of Daśapura, on pillars at Mandsaur." },
  });
  c("c_cosmas", {
    text: "In the sixth century the Greek merchant Cosmas wrote that the White Huns lived in the north of India, and that their king, called Gollas, went to war with two thousand elephants and made the people pay tribute.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Cosmas says he reports this from hearsay (“it is said”).",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("cosmas") }, { entity: e("alchon"), role: "mention" }],
  });
  c("c_alchon", {
    text: "The Hūṇas who invaded India around 500 are now usually identified as the Alchon Huns. They were long thought a branch of the Hephthalites, the “White Huns” of Bactria, but are now regarded as a separate people.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Wikipedia cites Rezakhani (2017), cited here by page only; the evidence is not quoted on this page.",
    themes: ["historiography", "war"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("alchon") }, { entity: e("hephthalites"), role: "mention" }, { entity: e("t_huna"), role: "mention" }],
    foundVia: ["wpAlchon"],
  });
  c("c_decline", {
    text: "Historians explain the empire's end by the loss of land and authority to its own former subordinates, together with the Hūṇa invasions. Fleet thought Mihirakula “accomplished their final extinction”.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "war", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [G, { entity: e("mihirakula"), role: "mention" }],
    foundVia: ["wpGupta"],
  });
  c("c_end", {
    text: "The last recognised king of the main Gupta line, Viṣṇugupta, reigned until about 550; his land grant of 542–543 CE is the last known Gupta inscription.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The succession of the sixth-century Guptas is not entirely clear (Wikipedia, citing Upinder Singh 2008, p. 480, by page only).",
    when: { start: c_(540), end: c_(550) },
    themes: ["polity"],
    lenses: ["mainstream_academic"],
    entities: [G],
    foundVia: ["wpGupta"],
    learning: { prompt: "Roughly when did the Gupta dynasty's main line end?", answer: "About 550 CE; the last known Gupta inscription is of 542–543." },
  });

  // Meanwhile: neighbours
  c("c_kidarites", {
    text: "Around 390–410 the Kidarites, Huns from Central Asia, took over the old Kushan lands of the Punjab, and held them until the Alchon Huns displaced them at the end of the fifth century.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Wikipedia only; the dates are approximate and partly uncited.",
    when: { start: c_(390), end: c_(500) },
    themes: ["polity", "war"],
    entities: [{ entity: "kidarites" }, { entity: "kushan-empire", role: "mention" }, { entity: e("alchon"), role: "mention" }],
    foundVia: ["wpKidarites"],
  });
  c("c_peroz", {
    text: "The Byzantine historian Procopius tells how the Persian king Peroz went to war with the Ephthalite Huns, “who are called White Huns”, and was killed with all his sons; modern historians date his death to 484.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(484) },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("peroz") }, { entity: e("hephthalites"), role: "participant" }, { entity: e("sasanian"), role: "mention" }],
    foundVia: ["wpHephthalites"],
  });
  c("c_cosmas_lanka", {
    text: "Cosmas also described Sri Lanka as a great seat of commerce that received goods from all the trading centres and sent goods back to them.",
    kind: "fact",
    assessment: "supported",
    themes: ["economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("cosmas") }],
  });
  c("c_ajanta_vakataka", {
    text: "Cave XVI at Ajanta, one of its great later caves, was given to the monks by a minister of the Vākāṭaka king Hariṣeṇa, whose father had been minister to Hariṣeṇa's father.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "culture", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("ajanta"), role: "place" }, { entity: e("harishena_vakataka") }, { entity: "vakataka-empire", role: "mention" }],
    learning: { prompt: "Who gave Cave XVI at Ajanta to the monks?", answer: "A minister of the Vākāṭaka king Hariṣeṇa." },
  });
  c("c_ajanta_dates", {
    text: "Walter Spink argued that most of Ajanta's later caves were made in a short burst, about 460–480 CE, in Hariṣeṇa's reign; other scholars argue for a longer period, into the mid-sixth century.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: c_(460), end: c_(480) },
    themes: ["culture", "historiography"],
    lenses: ["archaeological", "mainstream_academic"],
    entities: [{ entity: e("ajanta"), role: "place" }, { entity: e("harishena_vakataka"), role: "mention" }],
    foundVia: ["wpAjanta"],
  });
  c("c_gupta_style", {
    text: "The most famous monuments in a broadly “Gupta style”, the caves of Ajanta, Elephanta and Ellora, were in fact made under other dynasties.",
    kind: "fact",
    assessment: "supported",
    themes: ["culture"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("ajanta"), role: "mention" }, G],
    foundVia: ["wpGupta"],
  });

  // 8. The "golden age"
  c("c_smith_golden", {
    text: "In 1904 the British historian Vincent Smith wrote of “the golden age of the Guptas”, glorious in literature and politics, covering the three long reigns from 330 to 455 CE.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1904) },
    themes: ["historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("vasmith") }, G],
    learning: { prompt: "Who popularised calling the Gupta period a “golden age”, and when?", answer: "The British historian Vincent Smith, in 1904." },
  });
  c("c_smith_oxford", {
    text: "In 1919 Smith stretched the golden age to 320–480 CE, quoting a European scholar who compared it to Periclean Athens and an Indian author who called it “the Hindu Renaissance”, and judged both phrases justified.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1919) },
    themes: ["historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("vasmith") }, G],
  });
  c("c_smith_governed", {
    text: "Drawing on Faxian, Smith judged that “probably India has never been governed better, after the Oriental manner,” than under Chandragupta II.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["historiography", "governance"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("vasmith") }, { entity: e("cg2"), role: "mention" }, { entity: e("faxian"), role: "mention" }],
  });
  c("c_napoleon", {
    text: "Smith also called Samudragupta “the Indian Napoleon”, a man of genius, in 1904; the phrase is still repeated.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1904) },
    themes: ["historiography", "war"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("vasmith") }, { entity: e("samudragupta"), role: "mention" }],
    foundVia: ["wpSamudragupta"],
  });
  c("c_havell", {
    text: "The art historian E. B. Havell (1918) called the Gupta era “well known as the Golden Age of Sanskrit literature”, crediting it with the epics as we have them and the works of Kālidāsa.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1918) },
    themes: ["historiography", "culture"],
    entities: [{ entity: e("havell") }, G],
  });
  c("c_label_persists", {
    text: "The label lives on in art history: the Ajanta caves' later phase is still described as “the very apogee of Classical India, or India's golden age”, although those caves were made under the Vākāṭakas.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "culture"],
    entities: [{ entity: e("ajanta"), role: "mention" }, G],
    foundVia: ["wpAjanta"],
  });
  c("c_golden_disputed", {
    text: "Many historians now dispute the golden-age label. D. N. Jha argued that caste distinctions grew more rigid in this period, and archaeology suggests that towns had been more prosperous before it, in Kushan times, so that some historians argue for an urban decline under the Guptas.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "Reported by Wikipedia, citing Jha (2002, pp. 149–73) and Pletcher (2011, p. 90), cited here by page only; the archaeological evidence is not quoted on this page.",
    themes: ["historiography", "society", "economy"],
    lenses: ["mainstream_academic", "marxist"],
    entities: [G],
    foundVia: ["wpGupta"],
    learning: { prompt: "Name two reasons historians give for doubting that the Gupta period was a “golden age”.", answer: "Caste distinctions became more rigid, and towns may have declined compared with Kushan times." },
  });

  // Misconceptions
  c("m_golden", {
    text: "The Gupta period was a golden age of peace and plenty for everyone in India.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "Literature, science and art flourished, and some contemporaries described prosperity. But the label was made by historians around 1900; the same sources show untouchability, wars with the Hūṇas, and a widow's burning; and much of the praise comes from the kings' own eulogies.",
    themes: ["historiography", "society"],
    lenses: ["popular"],
    entities: [G],
  });
  c("m_faxian_court", {
    text: "Faxian visited Chandragupta II's court and described his government first-hand.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "Faxian travelled during Chandragupta II's reign, but he never names the king or describes a court; his account is of Buddhist sites and customs.",
    themes: ["sources"],
    lenses: ["popular"],
    entities: [{ entity: e("faxian") }, { entity: e("cg2"), role: "mention" }],
  });
  c("m_nine_gems", {
    text: "Kālidāsa was one of the “nine gems”, the poets and scholars at the court of Chandragupta II Vikramāditya.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "The nine gems come from a late tradition about a king Vikramāditya who has not been identified with any known ruler; Kālidāsa's own date is not known.",
    themes: ["culture", "historiography"],
    lenses: ["popular"],
    entities: [{ entity: e("kalidasa") }, { entity: e("cg2"), role: "mention" }],
  });
  c("m_zero", {
    text: "Āryabhaṭa invented zero.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "Āryabhaṭa used a place-value system; no zero symbol is known from his work, and when one came into use is disputed.",
    themes: ["technology"],
    lenses: ["popular"],
    entities: [{ entity: e("aryabhata") }],
  });
  c("m_ajanta_gupta", {
    text: "The Ajanta paintings are Gupta art, made under the Gupta emperors.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "The great later caves were made under the Vākāṭaka king Hariṣeṇa and his ministers. They share a style with Gupta art, which is why the label sticks.",
    themes: ["culture"],
    lenses: ["popular"],
    entities: [{ entity: e("ajanta"), role: "mention" }],
  });

  // ------------------------------------------------------------ citations
  const cite = (claim: string, excerpt: string, stance: "supports" | "contradicts" | "qualifies" | "mentions" = "supports", note?: string) =>
    ops.push({ op: "cite", claim: `@${claim}`, excerpt: `@${excerpt}`, stance, ...(note ? { note } : {}) });
  const cites = (claim: string, ...excerpts: string[]) => excerpts.forEach((x) => cite(claim, x));

  cites("c_era", "x_f_epoch", "x_f_epoch2", "x_parg_era", "x_f_udaya_date");
  cites("c_alberuni", "x_f_alberuni");
  cite("c_alberuni", "x_f_cg2_years", "qualifies", "The era was in use during Gupta rule, so it did not begin at the Guptas' end.");
  cites("c_cg1_reign", "x_parg_intro", "x_wp_cg1_dates");
  cite("c_cg1_reign", "x_wp_samudra_accession", "qualifies", "The end of the reign is uncertain.");
  cites("c_titles", "x_wp_titles");
  cite("c_titles", "x_f_maharaja_note", "qualifies", "Fleet: later, mahārāja was a feudatory's title.");
  cite("c_titles", "x_wp_vassals", "qualifies");
  cite("c_titles", "x_wp_vassals2", "qualifies");
  cites("c_licchavi", "x_f_kumaradevi", "x_f_lichchhavi", "x_wp_licchavi");
  cites("c_purana", "x_parg_gupta", "x_parg_intro", "x_parg_noconquest");
  cites("c_chosen", "x_f_worthy", "x_f_worthy_note");
  cites("c_pillar", "x_f_column", "x_f_column_fort");
  cite("c_pillar", "x_f_kausambi", "qualifies");
  cites("c_harishena", "x_f_harishena", "x_f_sandhivigrahika", "x_wp_harisena");
  cites("c_north", "x_f_aryavarta", "x_f_forest");
  cites("c_south", "x_f_south", "x_f_south3", "x_wp_vishnugopa");
  cites("c_vishnugopa", "x_wp_vishnugopa", "x_agrawal_110");
  cites("c_frontier", "x_f_frontier", "x_f_frontier2");
  cites("c_distant", "x_f_distant", "x_f_maidens");
  cites("c_daivaputra", "x_f_cunningham");
  cites("c_simhala", "x_wp_exaggeration", "x_wp_meghavarna", "x_sharma_90");
  cite("c_simhala", "x_f_distant", "mentions", "The inscription's own claim about Siṃhala.");
  cites("c_pratyanta", "x_f_pratyanta");
  cites("c_poet_king", "x_f_poets", "x_f_lyrist", "x_f_lute", "x_wp_veena");
  cites("c_ashvamedha", "x_f_ashvamedha", "x_wp_ashvamedha");
  cites("c_cg2_records", "x_f_cg2_years", "x_f_udaya_date", "x_f_sanchi_date", "x_wp_cg2_reign");
  cites("c_satraps", "x_smith14_satraps", "x_smith14_388", "x_wp_satraps_date", "x_kulke");
  cites("c_udayagiri", "x_f_udaya_date", "x_f_udaya_feet", "x_f_udaya_vaishnava", "x_wp_udayagiri_401", "x_wp_udayagiri_only");
  cite("c_udayagiri", "x_f_virasena", "supports", "A Śiva cave at the same site.");
  cites("c_virasena", "x_f_virasena", "x_f_virasena_poet", "x_f_virasena_home", "x_f_virasena_office");
  cites("c_varaha", "x_wp_varaha");
  cites("c_sanchi", "x_f_sanchi_date", "x_f_sanchi_vihara", "x_f_sanchi_favour", "x_f_sanchi_lamp");
  cites("c_prabhavati", "x_wp_prabhavati", "x_wp_prabhavati_regent", "x_f_siwani");
  cites("c_fleet_vakataka", "x_f_vakataka_date", "x_f_vakataka_700");
  cite("c_fleet_vakataka", "x_wp_prabhavati", "contradicts");
  cites("c_pillar_text", "x_f_pillar_vanga", "x_f_pillar_sindhu", "x_f_pillar_vishnupada", "x_f_pillar_name");
  cites("c_pillar_undated", "x_f_pillar_undated", "x_f_pillar_mystery", "x_wp_pillar_debate");
  cites("c_chandra_cg2", "x_wp_pillar_cg2", "x_agrawal_177");
  cites("c_chandra_fleet", "x_f_pillar_cg1", "x_f_pillar_cg1b", "x_f_pillar_hun");
  cites("c_chandra_smith", "x_smith14_chandra_note", "x_smith14_pillar");
  cites("c_pillar_moved", "x_wp_pillar_trophy", "x_wp_pillar_moved", "x_wp_pillar_udayagiri", "x_smith14_pillar");
  cite("c_pillar_moved", "x_f_pillar_place", "qualifies", "Fleet thought the pillar stood where it was set up.");
  cites("c_faxian_journey", "x_l_399", "x_l_changan", "x_l_fifteen");
  cites("c_middle_kingdom", "x_l_climate", "x_l_happy", "x_l_royal_land");
  cites("c_punishments", "x_l_fines", "x_l_right_hand", "x_l_salaries");
  cites("c_chandalas", "x_l_no_killing", "x_l_chandalas");
  cites("c_customs", "x_l_no_killing", "x_l_markets");
  cites("c_grants", "x_l_grants");
  cites("c_pataliputra", "x_l_palace", "x_l_rich");
  cites("c_charity", "x_l_charity");
  cites("c_monasteries", "x_l_monasteries", "x_l_procession");
  cites("c_sanskrit", "x_l_sanskrit", "x_l_deer_park");
  cites("c_ceylon", "x_l_ceylon", "x_l_java");
  cites("c_noking", "x_smith14_faxian", "x_l_king_unnamed");
  cite("c_noking", "x_wp_faxian_reign", "qualifies", "He travelled during Chandragupta II's reign.");
  cites("c_spectacles", "x_smith14_spectacles");
  cites("c_kalidasa_date", "x_ryder_date", "x_ryder_nobio", "x_wp_kalidasa_cg2");
  cites("c_kalidasa_ujjain", "x_ryder_ujjain", "x_ryder_cloud");
  cites("c_ninegems_late", "x_ryder_ninegems", "x_ryder_vikram");
  cite("c_ninegems_late", "x_wp_kalidasa_vikram", "mentions", "The medieval sources of the tradition.");
  cites("c_aryabhata_date", "x_clark_age", "x_clark_499", "x_clark_476", "x_wp_aryabhata_476");
  cites("c_kusumapura", "x_clark_kusuma", "x_wp_aryabhata_476");
  cite("c_kusumapura", "x_clark_kusuma_note", "qualifies");
  cites("c_rotation", "x_clark_boat", "x_clark_rotation");
  cites("c_zero", "x_wp_zero", "x_clark_zero");
  cites("c_silk", "x_f_silk_migrate", "x_f_silk_reign", "x_f_silk_temple", "x_f_silk_493", "x_f_silk_437");
  cite("c_silk", "x_wp_mandasor_kg2", "qualifies", "Which Kumāragupta is meant is disputed.");
  cites("c_silk_work", "x_f_silk_astrology", "x_f_silk_disrepair", "x_f_silk_473");
  cites("c_indor", "x_f_indor", "x_f_indor_guild", "x_f_indor_146");
  cites("c_kahaum", "x_f_kahaum", "x_f_kahaum_141");
  cites("c_nalanda", "x_beal_sakra", "x_wp_nalanda_seal", "x_wp_nalanda_kg1", "x_dutt");
  cites("c_nalanda_doubt", "x_wp_nalanda_faxian", "x_wp_nalanda_doubt", "x_beal_nirvana");
  cite("c_nalanda_doubt", "x_beal_budha", "mentions", "Xuanzang's next founder is a Buddhagupta, a later king.");
  cites("c_bhitari_restore", "x_f_bhitari_night", "x_f_bhitari_pushya", "x_f_bhitari_restore");
  cite("c_bhitari_restore", "x_wp_pushyamitras", "qualifies");
  cites("c_bhitari_huna", "x_f_bhitari_huna", "x_wp_huna_455", "x_wp_kidarite_hunas");
  cites("c_junagadh", "x_f_junagadh_rock", "x_f_junagadh_136", "x_f_junagadh_burst", "x_f_junagadh_repair", "x_f_junagadh_sudarsana");
  cites("c_parnadatta", "x_f_junagadh_parnadatta");
  cites("c_eulogy", "x_f_junagadh_eulogy");
  cites("c_budhagupta", "x_f_budhagupta", "x_f_budhagupta_165", "x_f_budhagupta_flag");
  cites("c_toramana", "x_f_toramana", "x_f_toramana_temple", "x_f_toramana_boar");
  cites("c_eran_sequence", "x_f_toramana_after", "x_f_huna_toramana");
  cites("c_huns_500", "x_wp_huns_500");
  cites("c_goparaja", "x_f_goparaja", "x_f_goparaja_191", "x_f_goparaja_pyre", "x_wp_eran_510");
  cites("c_sati_early", "x_f_goparaja_early");
  cites("c_mihirakula", "x_f_mihirakula", "x_f_mihirakula_15", "x_f_mihirakula_sun");
  cites("c_mihirakula_beal", "x_beal_mihira", "x_beal_edict");
  cite("c_mihirakula_beal", "x_f_mihirakula_sun", "qualifies", "His own record of a temple of the Sun.");
  cites("c_yashodharman", "x_f_yasho_lands", "x_f_yasho_mihirakula", "x_f_yasho_589", "x_f_downfall");
  cites("c_cosmas", "x_cosmas_huns", "x_cosmas_gollas", "x_cosmas_gollas2");
  cites("c_alchon", "x_wp_alchon_separate", "x_wp_alchon_fall", "x_rezakhani");
  cites("c_decline", "x_wp_decline", "x_f_extinction");
  cites("c_end", "x_wp_vishnugupta", "x_wp_last_grant", "x_usingh", "x_wp_later_kings");
  cites("c_kidarites", "x_wp_kidarites", "x_wp_kidarites_alchon");
  cites("c_peroz", "x_procop_white", "x_procop_death", "x_wp_peroz");
  cites("c_cosmas_lanka", "x_cosmas_lanka");
  cites("c_ajanta_vakataka", "x_burgess_minister", "x_burgess_gift");
  cites("c_ajanta_dates", "x_wp_spink", "x_wp_spink_challenged", "x_spink");
  cites("c_gupta_style", "x_wp_style");
  cites("c_smith_golden", "x_smith04_golden", "x_smith14_golden");
  cites("c_smith_oxford", "x_oxford_golden", "x_oxford_periclean");
  cites("c_smith_governed", "x_smith14_governed");
  cites("c_napoleon", "x_smith04_napoleon", "x_smith14_napoleon", "x_wp_napoleon");
  cites("c_havell", "x_havell_golden");
  cites("c_label_persists", "x_wp_ajanta_golden");
  cites("c_golden_disputed", "x_wp_golden", "x_wp_jha_note", "x_wp_pletcher_note", "x_wp_pletcher_note2", "x_jha", "x_pletcher");
  cite("m_golden", "x_smith04_golden", "mentions", "The source of the label.");
  cite("m_golden", "x_l_chandalas", "contradicts", "Untouchability, as Faxian saw it.");
  cite("m_golden", "x_f_bhitari_huna", "contradicts", "War with the Hūṇas.");
  cite("m_golden", "x_f_goparaja_pyre", "contradicts", "A widow's burning, 510 CE.");
  cite("m_golden", "x_wp_jha_note", "contradicts");
  cite("m_faxian_court", "x_wp_faxian_reign", "mentions", "True as to date, and often stretched further.");
  cite("m_faxian_court", "x_smith14_faxian", "contradicts");
  cite("m_nine_gems", "x_wp_ninegems", "mentions", "The legend repeated as fact.");
  cite("m_nine_gems", "x_ryder_ninegems", "contradicts");
  cite("m_zero", "x_wp_zero", "contradicts");
  cite("m_zero", "x_clark_zero", "qualifies");
  cite("m_ajanta_gupta", "x_burgess_minister", "contradicts");
  cite("m_ajanta_gupta", "x_wp_style", "contradicts");

  // ------------------------------------------------------------ relations
  const rel = (from: string, to: string, type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", note?: string) =>
    ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) });
  rel("c_era", "c_alberuni", "contradicts", "The era was in use while the Guptas ruled.");
  rel("c_purana", "c_north", "context_for", "The small early kingdom before the conquests.");
  rel("c_simhala", "c_distant", "qualifies", "Diplomacy described as submission.");
  rel("c_pratyanta", "c_frontier", "qualifies");
  rel("c_daivaputra", "c_distant", "context_for");
  rel("c_vishnugopa", "c_south", "context_for");
  rel("c_prabhavati", "c_fleet_vakataka", "contradicts");
  rel("c_chandra_fleet", "c_chandra_cg2", "contradicts");
  rel("c_chandra_smith", "c_chandra_cg2", "contradicts");
  rel("c_pillar_undated", "c_chandra_cg2", "context_for");
  rel("c_spectacles", "c_middle_kingdom", "qualifies");
  rel("c_spectacles", "c_smith_governed", "qualifies");
  rel("c_chandalas", "c_middle_kingdom", "qualifies", "Not everyone shared in the happiness Faxian saw.");
  rel("c_nalanda_doubt", "c_nalanda", "qualifies");
  rel("c_eulogy", "c_smith_governed", "context_for", "Royal praise is one source of the rosy picture.");
  rel("c_toramana", "c_budhagupta", "context_for", "The same family served both kings.");
  rel("c_eran_sequence", "c_toramana", "context_for");
  rel("c_mihirakula", "c_mihirakula_beal", "qualifies");
  rel("c_alchon", "c_cosmas", "context_for");
  rel("c_golden_disputed", "c_smith_golden", "contradicts");
  rel("c_golden_disputed", "m_golden", "corrects");
  rel("c_chandalas", "m_golden", "corrects", "Untouchability, as Faxian saw it.");
  rel("c_bhitari_huna", "m_golden", "qualifies", "War on the frontier.");
  rel("c_goparaja", "m_golden", "qualifies", "A widow's burning, 510 CE.");
  rel("c_eulogy", "m_golden", "qualifies", "Much of the praise is the kings' own.");
  rel("c_noking", "m_faxian_court", "corrects");
  rel("c_spectacles", "m_faxian_court", "qualifies");
  rel("c_ninegems_late", "m_nine_gems", "corrects");
  rel("c_kalidasa_date", "m_nine_gems", "qualifies");
  rel("c_zero", "m_zero", "corrects");
  rel("c_ajanta_vakataka", "m_ajanta_gupta", "corrects");
  rel("c_gupta_style", "m_ajanta_gupta", "corrects");
  rel("c_ajanta_dates", "m_ajanta_gupta", "context_for");

  return ops;
}

// ---------------------------------------------------------------- page

export function guptaPage(E: Record<string, string>): ChangeOpInput {
  const e = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const C = (ref: string, text: string) => `[${text}](claim:@${ref})`;
  /** An entity link by ref, or by the slug of an entity already on the platform. */
  const N = (ref: string, text: string) => `[${text}](entity:${E[ref] ?? ref})`;

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown: [
        `For about two centuries, from around 320 to 550 CE, a family called the Guptas ruled much of northern India from the Ganges plain. Their kings left inscriptions on stone pillars, rocks and copper plates, and dated them in ${C("c_era", "an era of their own, which began in 319–320")}. In their time lived ${N("aryabhata", "Āryabhaṭa")}, the astronomer, and probably ${N("kalidasa", "Kālidāsa")}, the poet; a Chinese monk, ${N("faxian", "Faxian")}, ${C("c_middle_kingdom", "walked their roads and described a mild and prosperous country")}.`,
        `That picture made historians around 1900 call the period ${C("c_smith_golden", "a “golden age”")}. This page tells the story from the kings' own inscriptions and from the travellers who saw it, and then asks what the label leaves out: ${C("c_chandalas", "people treated as untouchable")}, ${C("c_bhitari_huna", "wars with the Hūṇas")}, and the fact that ${C("c_eulogy", "much of the praise comes from the kings themselves")}.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: "gupta-empire", text: `“The golden age of India.” ${C("c_smith_golden", "The phrase goes back to a British historian in 1904")}, and historians now dispute it.`, target: "ch-golden-age", targetLabel: "A golden age?" },
        { entity: e("samudragupta"), text: `“The Indian Napoleon.” ${C("c_north", "His own inscription")} is almost all we know of his wars.`, target: "ch-samudragupta", targetLabel: "Samudragupta's pillar" },
        { entity: e("iron_pillar"), text: `The iron pillar in Delhi. ${C("c_pillar_undated", "Its inscription names only a king Chandra")}.`, target: "ch-chandragupta", targetLabel: "Chandragupta II" },
        { entity: e("kalidasa"), text: `Author of Śakuntalā. ${C("c_kalidasa_date", "No one knows exactly when he lived")}.`, target: "ch-culture", targetLabel: "Poets, stars and guilds" },
        { entity: e("aryabhata"), text: `Often credited with zero. ${C("c_zero", "He used place value, but no zero sign is known from his work")}.`, target: "ch-culture", targetLabel: "Poets, stars and guilds" },
        { entity: e("ajanta"), text: `The famous paintings. ${C("c_ajanta_vakataka", "They were made under a neighbouring dynasty")}, not the Guptas.`, target: "ch-often-said", targetLabel: "Often said" },
      ],
    },
    {
      id: "meanwhile",
      type: "meanwhile",
      title: "Meanwhile, around the Gupta lands",
      items: [
        { region: "Sri Lanka", label: "Siṃhala's king sends gifts; Faxian stays two years", claimIds: ["@c_distant", "@c_simhala", "@c_ceylon"] },
        { region: "Deccan", label: "The Vākāṭakas: a Gupta princess rules as regent; Ajanta's later caves", entity: "vakataka-empire", claimIds: ["@c_prabhavati", "@c_ajanta_vakataka"] },
        { region: "South India", label: "Kāñchī under Viṣṇugopa, a Pallava ruler", entity: "pallava-dynasty", claimIds: ["@c_south", "@c_vishnugopa"] },
        { region: "Gujarat", label: "The Western Satraps, conquered around 400", entity: "western-satraps", claimIds: ["@c_satraps"] },
        { region: "North-west", label: "The Kushans' heirs, then the Kidarite Huns", entity: "kidarites", claimIds: ["@c_daivaputra", "@c_kidarites"] },
        { region: "Bactria", label: "The Hephthalites, the “White Huns”", entity: e("hephthalites"), claimIds: ["@c_peroz", "@c_alchon"] },
        { region: "Persia", label: "The Sasanian king Peroz dies fighting the Hephthalites, 484", entity: e("sasanian"), claimIds: ["@c_peroz"] },
        { region: "China", label: "Faxian sets out from Chang'an, 399", entity: e("faxian"), claimIds: ["@c_faxian_journey"] },
        { region: "Red Sea and Alexandria", label: "Cosmas, a Greek merchant, on India's White Huns and Sri Lanka's trade", entity: e("cosmas"), claimIds: ["@c_cosmas", "@c_cosmas_lanka"] },
      ],
      note: "Each line rests on the claims linked to it: a source of the time, or a modern historian where the claim says so. Most dates are approximate.",
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-rise",
      type: "chapter",
      title: "A family from the Ganges plain",
      promise: "Who the first Guptas were, how a marriage and a new title marked their rise, and how we date them.",
      when: { start: c_(319), end: c_(335, true), label: "c. 319–c. 335/350", basis: "Chandragupta I's reign, as conventionally dated" },
      places: ["pataliputra"],
      people: [e("cg1"), e("kumaradevi"), e("fleet")],
      terms: ["@t_era", "@t_maharajadhiraja"],
    },
    {
      id: "rise-prose",
      type: "prose",
      markdown: [
        `The Guptas began as a minor family in the Ganges plain, in what is now Bihar and eastern Uttar Pradesh. ${C("c_titles", "Their first two kings called themselves only “great king”")}; the third, ${N("cg1", "Chandragupta I")}, took a grander title, ${N("t_maharajadhiraja", "“great king of kings”")}. ${C("c_licchavi", "He married Kumāradevī of the Licchavis")}, and their son proudly named his mother's family in his titles.`,
        `How do we know when this was? The Gupta kings dated their records in ${N("t_era", "their own era")}, and in 1888 the scholar J. F. Fleet ${C("c_era", "worked out that its year 0 fell in 319–320 CE")}. ${C("c_cg1_reign", "Chandragupta I's reign is usually taken to have started it")}. A list of dynasties in the Purāṇas, ancient Sanskrit compilations, may remember this early kingdom: ${C("c_purana", "Gupta kings ruling along the Ganges, at Prayāga, Sāketa and in Magadha")}. Then ${C("c_chosen", "Chandragupta chose his son Samudragupta to succeed him")}.`,
      ].join("\n\n"),
    },
    { id: "rise-claims", type: "claims", claimIds: ["@c_titles", "@c_licchavi", "@c_era", "@c_cg1_reign", "@c_purana", "@c_chosen", "@c_alberuni"] },
    {
      id: "rise-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Almost nothing about the first Guptas comes from their own time: we know them from their descendants' inscriptions. The dates of Chandragupta I's reign are estimates.",
    },

    // ------------------------------------------------------------ 2
    {
      id: "ch-samudragupta",
      type: "chapter",
      title: "Samudragupta's pillar: conquest in a poet's words",
      promise: "A praise poem carved on Aśoka's old pillar lists the kings Samudragupta beat. How far can we trust it?",
      when: { start: c_(335, true), end: c_(375), label: "c. 335/350–c. 375", basis: "Samudragupta's reign, as conventionally dated" },
      places: [e("allahabad_pillar")],
      people: [e("samudragupta"), e("harishena_poet")],
      terms: ["@t_prashasti", "@t_aryavarta", "@t_dakshinapatha", "@t_ashvamedha"],
    },
    {
      id: "samudragupta-prose",
      type: "prose",
      markdown: [
        `Nearly everything we know about ${N("samudragupta", "Samudragupta")} comes from one long poem. ${C("c_pillar", "It was carved on a stone column at Allahabad that already carried Aśoka's edicts")}, six centuries older. ${C("c_harishena", "Its author, Hariṣeṇa, was one of the king's own officers")}, so it is a ${N("t_prashasti", "praśasti")}: a poem of praise.`,
        `The poem divides the world into kinds of defeat. In the north, ${N("t_aryavarta", "Āryāvarta")}, ${C("c_north", "Samudragupta “violently exterminated” the kings")}. In the south, ${N("t_dakshinapatha", "Dakṣiṇāpatha")}, ${C("c_south", "he captured kings and let them go")}, among them ${C("c_vishnugopa", "Viṣṇugopa of Kāñchī, a Pallava")}. ${C("c_frontier", "Border kingdoms paid him taxes")}, and ${C("c_distant", "far-off rulers, as far as Sri Lanka, sent gifts")}. He was also, the poem says, ${C("c_poet_king", "a poet and a musician")}, and his coins show him playing; ${C("c_ashvamedha", "his descendants remembered him for reviving the horse sacrifice")}.`,
      ].join("\n\n"),
    },
    { id: "samudragupta-claims", type: "claims", claimIds: ["@c_pillar", "@c_harishena", "@c_north", "@c_south", "@c_vishnugopa", "@c_frontier", "@c_distant", "@c_daivaputra", "@c_poet_king", "@c_ashvamedha"] },
    {
      id: "samudragupta-debate",
      type: "debate",
      question: "How much of India did Samudragupta really rule?",
      positions: [
        { label: "As the poem says: conquest from north to south", claimIds: ["@c_north", "@c_south", "@c_frontier"] },
        { label: "A praise poem: diplomacy dressed up as submission", claimIds: ["@c_simhala"] },
        { label: "It depends on how one word is read (Fleet)", claimIds: ["@c_pratyanta"] },
      ],
      note: "The poem is almost the only evidence, and it was written to praise. Capture and release in the south reads as submission, not government; and Fleet noted that even the frontier depends on how one word is read.",
    },
    {
      id: "samudragupta-quote",
      type: "quote",
      excerptId: "@x_f_aryavarta",
      caption: "The Allahabad pillar inscription, line 21, in J. F. Fleet's translation (1888), p. 13.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-chandragupta",
      type: "chapter",
      title: "Chandragupta II: west to the sea",
      promise: "The conquest of Gujarat, a daughter who ruled the Deccan, the first firmly dated Gupta records, and the riddle of the iron pillar.",
      when: { start: c_(375), end: c_(415), basis: "Chandragupta II's reign, as conventionally dated" },
      places: [e("udayagiri"), "sanchi", e("iron_pillar")],
      people: [e("cg2"), e("prabhavati")],
      terms: ["@t_feudatory", "@t_varaha"],
    },
    {
      id: "chandragupta-prose",
      type: "prose",
      markdown: [
        `${N("cg2", "Chandragupta II")} is the first Gupta king we can date from his own records: ${C("c_cg2_records", "they run from 401 to about 414 CE")}. He pushed west, and ${C("c_satraps", "conquered the Western Satraps")}, Śaka kings who had ruled Gujarat and Saurashtra for centuries. To the south he made an alliance by marriage: ${C("c_prabhavati", "his daughter Prabhāvatīguptā married the king of the Vākāṭakas and later ruled their kingdom as regent")}.`,
        `His reign left its mark in stone near Vidiśā. At Udayagiri, ${C("c_udayagiri", "a cave inscription of 401 records the gift of a ruler who served him")}, a ${N("t_feudatory", "feudatory")}; another says ${C("c_virasena", "his minister came there “accompanied by the king in person, who was seeking to conquer the whole world”")}. ${C("c_varaha", "A colossal relief of Varāha")}, Viṣṇu as a boar, is carved nearby. At the Buddhist site of Sanchi ${C("c_sanchi", "one of his officers paid for monks' food and a lamp")}.`,
        `Then there is the famous ${N("iron_pillar", "iron pillar")} in Delhi. ${C("c_pillar_text", "It praises a dead king named Chandra who fought from Bengal to the Indus")}, but ${C("c_pillar_undated", "it gives no date and no family")}.`,
      ].join("\n\n"),
    },
    { id: "chandragupta-claims", type: "claims", claimIds: ["@c_cg2_records", "@c_satraps", "@c_prabhavati", "@c_udayagiri", "@c_virasena", "@c_varaha", "@c_sanchi", "@c_pillar_text", "@c_pillar_undated", "@c_pillar_moved"] },
    {
      id: "pillar-debate",
      type: "debate",
      question: "Who was king Chandra of the iron pillar?",
      positions: [
        { label: "Chandragupta II (most historians today)", claimIds: ["@c_chandra_cg2"] },
        { label: "Perhaps Chandragupta I, or even a Hūṇa prince (Fleet, 1888)", claimIds: ["@c_chandra_fleet"] },
        { label: "Another king, Chandravarman (Smith, 1914)", claimIds: ["@c_chandra_smith"] },
      ],
      note: "The inscription names no family and no date, so each answer rests on its style of writing, its content and where the pillar first stood, which is itself debated.",
    },
    {
      id: "chandragupta-quote",
      type: "quote",
      excerptId: "@x_f_virasena",
      caption: "Udayagiri cave inscription of Vīrasena, in J. F. Fleet's translation (1888), p. 36.",
    },

    // ------------------------------------------------------------ 4
    {
      id: "ch-faxian",
      type: "chapter",
      title: "A pilgrim from China, 399–414",
      promise: "What a Buddhist monk saw on the roads and in the cities of the Ganges plain, and what he did not say.",
      when: { start: d(399), end: c_(414), basis: "Faxian's journey (Legge 1886)" },
      places: ["pataliputra", "sarnath"],
      people: [e("faxian")],
      terms: ["@t_chandala", "@t_vihara"],
    },
    {
      id: "faxian-prose",
      type: "prose",
      markdown: [
        `In 399 ${C("c_faxian_journey", "the monk Faxian left China for India")}, looking for the Buddhist books of rules for monks. He found the Ganges plain, which he called the Middle Kingdom, ${C("c_middle_kingdom", "mild, crowded and content")}. ${C("c_punishments", "The king punished criminals with fines, not executions")}, and ${C("c_customs", "people, he said, ate no meat and drank no alcohol")}. Kings had ${C("c_grants", "given monasteries land, recorded on metal plates")}.`,
        `At ${N("pataliputra", "Pāṭaliputra")} ${C("c_pataliputra", "he saw Aśoka's palace still standing")} and ${C("c_monasteries", "large monasteries")}, and he admired ${C("c_charity", "houses where the sick and poor were given free care and medicine")}. ${C("c_sanskrit", "He stayed three years to learn Sanskrit")}, then ${C("c_ceylon", "sailed home by way of Sri Lanka and Java")}.`,
        `Two things temper his picture. He also describes ${C("c_chandalas", "the Chandalas, who lived apart and had to warn others of their approach")}, people treated as untouchable. And ${C("c_noking", "he never names the king")}: he came for Buddhism, and ${C("c_spectacles", "he saw the country through Buddhist eyes")}.`,
      ].join("\n\n"),
    },
    { id: "faxian-claims", type: "claims", claimIds: ["@c_faxian_journey", "@c_middle_kingdom", "@c_punishments", "@c_customs", "@c_grants", "@c_pataliputra", "@c_monasteries", "@c_charity", "@c_sanskrit", "@c_ceylon", "@c_chandalas", "@c_noking", "@c_spectacles"] },
    {
      id: "faxian-quote",
      type: "quote",
      excerptId: "@x_l_charity",
      caption: "Faxian on the cities of Magadha, in James Legge's translation (1886), chapter XXVII, p. 79.",
    },
    {
      id: "faxian-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Faxian wrote for Buddhist readers in China, after his return. He reports what fitted his interests, and his sweeping statements (nobody eats meat) describe ideals as much as habits.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-culture",
      type: "chapter",
      title: "Poets, stars, temples and guilds",
      promise: "Kālidāsa and Āryabhaṭa, the silk weavers who built a temple, and the many faiths in the inscriptions.",
      when: { start: c_(400), end: c_(500), basis: "The fifth century, broadly" },
      places: ["ujjain", e("mandsaur"), e("nalanda")],
      people: [e("kalidasa"), e("aryabhata"), e("kg1")],
      terms: ["@t_guild", "@t_tirthankara"],
    },
    {
      id: "culture-prose",
      type: "prose",
      markdown: [
        `The Sanskrit poet ${N("kalidasa", "Kālidāsa")} wrote plays such as Śakuntalā and poems such as the Cloud Messenger. ${C("c_kalidasa_date", "No one knows exactly when he lived")}, though most scholars place him in this period, and ${C("c_kalidasa_ujjain", "he clearly loved the city of Ujjain")}. ${N("aryabhata", "Āryabhaṭa")} tells us more about himself: ${C("c_aryabhata_date", "he finished his book on astronomy in 499, at the age of 23")}, at ${C("c_kusumapura", "Kusumapura, probably Pāṭaliputra")}. ${C("c_rotation", "He compared the stars' movement to the shore seen from a boat")}, a passage read as saying the Earth turns.`,
        `The inscriptions show ordinary people paying for worship. ${C("c_silk", "A guild of silk weavers at Daśapura built a temple of the Sun")} in about 437, and ${C("c_silk_work", "some of them took up other trades, such as astrology")}. ${C("c_indor", "A guild of oil-men looked after a lamp fund for another Sun temple")}, and ${C("c_kahaum", "a Jain set up a pillar with five images")}. And ${C("c_nalanda", "the great monastery of Nālandā is said to have been founded by a Gupta king")}, though ${C("c_nalanda_doubt", "its date is uncertain")}.`,
      ].join("\n\n"),
    },
    { id: "culture-claims", type: "claims", claimIds: ["@c_kalidasa_date", "@c_kalidasa_ujjain", "@c_aryabhata_date", "@c_kusumapura", "@c_rotation", "@c_zero", "@c_silk", "@c_silk_work", "@c_indor", "@c_kahaum", "@c_nalanda", "@c_nalanda_doubt"] },
    {
      id: "culture-debate",
      type: "debate",
      question: "When was Nālandā founded?",
      positions: [
        { label: "Under Kumāragupta I, in the fifth century", claimIds: ["@c_nalanda"] },
        { label: "Uncertain: the evidence does not fix a date", claimIds: ["@c_nalanda_doubt"] },
      ],
      note: "Xuanzang wrote two centuries later, and the seal names only Śakrāditya; matching that name to a known king is the scholars' work.",
    },
    {
      id: "culture-quote",
      type: "quote",
      excerptId: "@x_f_silk_temple",
      caption: "Mandasor inscription of the silk weavers, in J. F. Fleet's translation (1888), p. 86.",
    },

    // ------------------------------------------------------------ 6
    {
      id: "ch-skandagupta",
      type: "chapter",
      title: "Skandagupta and the Hūṇas",
      promise: "A king who slept on the bare ground, the first war with the Huns, and a burst dam in Gujarat.",
      when: { start: c_(455), end: c_(467), basis: "Skandagupta's reign" },
      places: [e("bhitari"), "girnar"],
      people: [e("skandagupta")],
      terms: ["@t_huna"],
    },
    {
      id: "skandagupta-prose",
      type: "prose",
      markdown: [
        `By the 450s the empire was under pressure. ${N("skandagupta", "Skandagupta")}'s pillar at Bhitari says that ${C("c_bhitari_restore", "to restore his family's fortunes he spent a night sleeping on the bare ground")}, and that ${C("c_bhitari_huna", "the earth shook when he fought the Hūṇas")}, the ${N("t_huna", "Huns")} from Central Asia.`,
        `Far to the west, on the rock at Junāgaḍh where Aśoka's edicts are carved, ${C("c_junagadh", "his governor recorded how a great reservoir's dam burst in a storm and was rebuilt in two months")}. ${C("c_parnadatta", "The king had chosen that governor carefully")}. The same inscription says ${C("c_eulogy", "no one in his kingdom was poor or miserable")}, which tells us how kings wished to be seen.`,
      ].join("\n\n"),
    },
    { id: "skandagupta-claims", type: "claims", claimIds: ["@c_bhitari_restore", "@c_bhitari_huna", "@c_junagadh", "@c_parnadatta", "@c_eulogy"] },

    // ------------------------------------------------------------ 7
    {
      id: "ch-end",
      type: "chapter",
      title: "The Hūṇa kings and the end of the empire",
      promise: "How the inscriptions of one town, Eran, show power passing from Gupta to Hūṇa hands, and how the dynasty faded.",
      when: { start: c_(484), end: c_(550), basis: "From Budhagupta's Eran pillar (484–485) to the last Gupta king (c. 550)" },
      places: [e("eran"), e("mandsaur")],
      people: [e("budhagupta"), e("toramana"), e("mihirakula"), e("yashodharman")],
      terms: ["@t_sati"],
    },
    {
      id: "end-prose",
      type: "prose",
      markdown: [
        `The town of ${N("eran", "Eran")} in central India tells the story in three stones. In 484 ${C("c_budhagupta", "two brothers set up a pillar for Viṣṇu there, naming Budhagupta as their king")}. A few years later ${C("c_toramana", "the surviving brother dated a new temple by the reign of the Hūṇa king Toramāṇa")}. In 510 ${C("c_goparaja", "a memorial recorded a battle, a dead nobleman, and his wife who died on his funeral pyre")}, ${C("c_sati_early", "an early instance of satī")}.`,
        `${C("c_huns_500", "By 500 the Hūṇas had overrun much of the north-west")}; ${C("c_mihirakula", "Toramāṇa's son Mihirakula ruled as far as Gwalior")}. Then ${C("c_yashodharman", "a king of Malwa, Yaśodharman, boasted that Mihirakula had bowed at his feet")}. ${C("c_decline", "Rebellious subordinates and the Hūṇa wars wore the empire down")}, and ${C("c_end", "the main line ended around 550")}.`,
      ].join("\n\n"),
    },
    { id: "end-claims", type: "claims", claimIds: ["@c_budhagupta", "@c_toramana", "@c_eran_sequence", "@c_goparaja", "@c_sati_early", "@c_huns_500", "@c_mihirakula", "@c_mihirakula_beal", "@c_yashodharman", "@c_cosmas", "@c_alchon", "@c_decline", "@c_end"] },
    {
      id: "end-quote",
      type: "quote",
      excerptId: "@x_f_yasho_lands",
      caption: "Yaśodharman's pillar at Mandsaur, in J. F. Fleet's translation (1888), p. 146.",
    },
    {
      id: "end-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Who the Hūṇas were is still debated, and Xuanzang's picture of Mihirakula as a persecutor of Buddhism is a hostile tradition written down a century later. Yaśodharman's boast is, like the Gupta inscriptions, a praise poem.",
    },

    // ------------------------------------------------------------ 8
    {
      id: "ch-golden-age",
      type: "chapter",
      title: "A golden age? How a label was made",
      promise: "Who first called the Gupta period a golden age, what they were looking at, and why many historians now doubt it.",
      phase: "later",
      people: [e("vasmith"), e("havell"), e("fleet")],
    },
    {
      id: "golden-prose",
      type: "prose",
      markdown: [
        `The phrase is not ancient. ${C("c_smith_golden", "The British historian Vincent Smith wrote of “the golden age of the Guptas” in 1904")}, and in the same book ${C("c_napoleon", "called Samudragupta “the Indian Napoleon”")}. Reading Faxian, ${C("c_smith_governed", "he judged that India had probably never been better governed")}. ${C("c_smith_oxford", "By 1919 he compared the period to Periclean Athens and to a “Hindu Renaissance”")}, and ${C("c_havell", "others called it the golden age of Sanskrit literature")}. ${C("c_label_persists", "It still colours how the art of the period is described")}.`,
        `The evidence for the label is real: the poetry, the astronomy, the temples, Faxian's account. But ${C("c_golden_disputed", "many historians now question it")}, pointing to caste growing more rigid and towns declining. And the label leans on sources that wanted to praise: ${C("c_eulogy", "royal eulogies")} and ${C("c_spectacles", "a pilgrim with his own ideals")}.`,
      ].join("\n\n"),
    },
    { id: "golden-claims", type: "claims", claimIds: ["@c_smith_golden", "@c_napoleon", "@c_smith_governed", "@c_smith_oxford", "@c_havell", "@c_label_persists", "@c_golden_disputed"] },
    {
      id: "golden-debate",
      type: "debate",
      theme: "historiography",
      question: "Was the Gupta period a golden age?",
      positions: [
        { label: "Yes: the classical age (Smith, 1904; Havell, 1918)", claimIds: ["@c_smith_golden", "@c_smith_oxford", "@c_havell", "@c_smith_governed"] },
        { label: "Golden for some: what the label leaves out", claimIds: ["@c_chandalas", "@c_goparaja", "@c_bhitari_huna", "@c_eulogy"] },
        { label: "No: caste hardened and towns declined (historians today)", claimIds: ["@c_golden_disputed"] },
      ],
      note: "“Golden age” is a judgement, not a finding. It depends on whose life you look at, and on which sources you trust. The page shows the evidence; it does not choose.",
    },
    {
      id: "golden-method",
      type: "callout",
      tone: "method",
      markdown: `How we know the dates. Fleet's work of 1888 still underlies Gupta chronology, but he also got things wrong: ${C("c_fleet_vakataka", "he put the Vākāṭakas three centuries too late")}, and the identity of the iron pillar's king has changed hands several times. The scholars who built the picture of the period are part of its story.`,
    },
    { id: "golden-method-claims", type: "claims", claimIds: ["@c_fleet_vakataka", "@c_pratyanta", "@c_simhala"] },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often-said",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Five popular beliefs about the Gupta period, each with what the sources on this page say.",
      phase: "later",
      places: [e("ajanta")],
      people: [e("harishena_vakataka")],
    },
    {
      id: "often-prose",
      type: "prose",
      markdown: "Some short versions of this story are repeated more often than the sources allow. Here are five, each with the claims that correct or qualify it.",
    },
    { id: "myth-golden", type: "misconception", theme: "historiography", claimId: "@m_golden", correctionIds: ["@c_golden_disputed", "@c_chandalas", "@c_bhitari_huna", "@c_goparaja", "@c_eulogy"] },
    { id: "myth-faxian", type: "misconception", theme: "sources", claimId: "@m_faxian_court", correctionIds: ["@c_noking", "@c_spectacles"] },
    { id: "myth-nine-gems", type: "misconception", theme: "culture", claimId: "@m_nine_gems", correctionIds: ["@c_ninegems_late", "@c_kalidasa_date"] },
    { id: "myth-zero", type: "misconception", theme: "technology", claimId: "@m_zero", correctionIds: ["@c_zero"] },
    { id: "myth-ajanta", type: "misconception", theme: "culture", claimId: "@m_ajanta_gupta", correctionIds: ["@c_ajanta_vakataka", "@c_gupta_style", "@c_ajanta_dates"] },
    { id: "often-neighbours", type: "claims", title: "The neighbours in “Meanwhile”", claimIds: ["@c_kidarites", "@c_peroz", "@c_cosmas_lanka"] },
  ];

  const spec: PageSpecInput = {
    atlas: {
      focus: ["gupta-empire", "vakataka-empire", "western-satraps", "kidarites", "pallava-dynasty"],
      range: [250, 600],
      stops: [
        { year: 320, label: "The Gupta era begins", claimId: "@c_era" },
        { year: 401, label: "Udayagiri cave dedicated", claimId: "@c_udayagiri" },
        { year: 412, label: "A gift at Sanchi", claimId: "@c_sanchi" },
        { year: 437, label: "Silk weavers' temple of the Sun", claimId: "@c_silk" },
        { year: 455, label: "The Sudarśana dam bursts", claimId: "@c_junagadh" },
        { year: 484, label: "Budhagupta's pillar at Eran", claimId: "@c_budhagupta" },
        { year: 510, label: "Battle at Eran", claimId: "@c_goparaja" },
        { year: 532, label: "Yaśodharman's victory pillars", claimId: "@c_yashodharman" },
        { year: 550, label: "The last Gupta king", claimId: "@c_end" },
      ],
      neighbours: true,
    },
    timeline: { range: [250, 600] },
  };

  return {
    op: "create_page",
    slug: "gupta-empire",
    title: "The Gupta Empire",
    kind: "era",
    entity: "gupta-empire",
    summary: "How a family from the Ganges plain built an empire across northern India (c. 320–550 CE), in the words of its inscriptions and of the travellers who saw it, and how it came to be called a golden age.",
    blocks,
    status: "published",
    position: 7,
    spec,
  };
}
