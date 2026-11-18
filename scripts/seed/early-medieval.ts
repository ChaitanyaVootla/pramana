import type { BlockInput, ChangeOpInput, PageSpecInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "Kingdoms of the early medieval age and the Cholas" era page (c. 550–1200
 * CE), built from a source pack prepared on 2026-10-18. Every quote was
 * machine-checked against the same texts captured here.
 *
 * Primary sources are public-domain editions and translations: Hultzsch's
 * South Indian Inscriptions I–II (1890–1913) and his Tirumalai inscription of
 * Rājendra I (Epigraphia Indica IX); Kielhorn's Aihole inscription of
 * Pulakeśin II (EI VI) and Khalimpur plate of Dharmapāla (EI IV); Venkayya's
 * Uttaramerūr inscriptions (ASI Annual Report 1904–05); Bāṇa's Harṣacarita
 * (Cowell and Thomas, 1897); Xuanzang (Beal, 1884); Sulaimān and the
 * chroniclers of Mahmud in Elliot and Dowson (1867–69); Alberuni (Sachau,
 * 1888); Kalhaṇa (Stein, 1900). S. K. Aiyangar (1911) is older scholarship,
 * quoted as such. Wikipedia (tertiary) supplies modern positions and the
 * debates (feudalism, the Chola state, Mahmud's motives), with the books it
 * cites added by page only.
 *
 * Elliot and Dowson are quoted with their own stated colonial purpose on the
 * page; the Persian chroniclers of Mahmud are court writers with their own
 * reasons to boast. Both are flagged where they are used.
 */

// ---------------------------------------------------------------- snapshots

const WP = (title: string) => ({ kind: "wikipedia", title }) as const;
export const CAPTURES = {
  sii2: { kind: "internet_archive", identifier: "india.history.resource.93073" },
  sii1: { kind: "internet_archive", identifier: "in.ernet.dli.2015.34586" },
  ei9: { kind: "internet_archive", identifier: "epigraphiaindica014770mbp" },
  ei6: { kind: "internet_archive", identifier: "in.ernet.dli.2015.56653" },
  ei4: { kind: "internet_archive", identifier: "in.ernet.dli.2015.70026" },
  asi1904: { kind: "internet_archive", identifier: "in.ernet.dli.2015.207530" },
  aiyangar: { kind: "internet_archive", identifier: "cu31924022968840" },
  harsa: { kind: "internet_archive", identifier: "harsacaritaofban00banaiala" },
  beal1: { kind: "internet_archive", identifier: "siyukibuddhistre01hsua" },
  beal2: { kind: "internet_archive", identifier: "siyukibuddhistre02hsuoft" },
  ed1: { kind: "internet_archive", identifier: "historyofindiaas01elli" },
  ed2: { kind: "internet_archive", identifier: "historyofindiaas02elli" },
  alb1: { kind: "internet_archive", identifier: "alberunisindiaac01brnm" },
  alb2: { kind: "internet_archive", identifier: "alberunisindiaac02biruuoft" },
  stein: { kind: "internet_archive", identifier: "RajataranginiVol1" },
  wpAlBiruni: WP("Al-Biruni"),
  wpAmogha: WP("Amoghavarsha"),
  wpBStein: WP("Burton Stein"),
  wpBrihad: WP("Brihadisvara Temple"),
  wpChalukya: WP("Chalukya dynasty"),
  wpChola: WP("Chola dynasty"),
  wpCholaEmpire: WP("Chola Empire"),
  wpCholaGov: WP("Chola government"),
  wpFeud: WP("Indian feudalism"),
  wpGLCT: WP("Great Living Chola Temples"),
  wpGangaikonda: WP("Gangaikonda Cholapuram"),
  wpHarsha: WP("Harsha"),
  wpKailasa: WP("Kailasa Temple, Ellora"),
  wpKalhana: WP("Kalhana"),
  wpMahmud: WP("Mahmud of Ghazni"),
  wpMiddle: WP("Middle kingdoms of India"),
  wpNarasimha: WP("Narasimhavarman I"),
  wpPala: WP("Pala Empire"),
  wpPallava: WP("Pallava dynasty"),
  wpPratihara: WP("Pratihara dynasty"),
  wpPulakeshin: WP("Pulakeshin II"),
  wpRSSharma: WP("Ram Sharan Sharma"),
  wpRajaraja: WP("Rajaraja I"),
  wpRajatarangini: WP("Rajatarangini"),
  wpRajendra: WP("Rajendra I"),
  wpRashtrakuta: WP("Rashtrakuta Empire"),
  wpSamanta: WP("Samanta"),
  wpSomnath: WP("Somnath Temple"),
  wpSrivijaya: WP("Chola invasion of Srivijaya"),
  wpTripartite: WP("Tripartite Struggle"),
  wpUttar: WP("Uthiramerur"),
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

type Kind = "person" | "polity" | "group" | "place" | "site" | "inscription" | "event" | "term";
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
  life?: boolean;
  geo?: "exact" | "approximate";
  geoNote?: string;
  aliases?: Alias[];
  link?: "part_of" | "participant_in" | "related_to" | "contemporary_of";
  linkNote?: string;
  /** Cliopatria rows whose borders belong to this polity (when the importer left them unlinked). */
  extentName?: string;
}

const PERIOD = "early-medieval-india";
const ce = (year: number, approximate = false, uncertain = false) => ({
  year,
  era: "CE" as const,
  ...(approximate ? { approximate } : {}),
  ...(uncertain ? { uncertain } : {}),
});

export const ENTITIES: EntitySpec[] = [
  // Polities already imported with the borders (reused by QID; created only if missing)
  { ref: "chola", slug: "chola-empire", kind: "polity", label: "Chola Empire", qid: "Q6806806", link: "part_of", description: "The Tamil kingdom of the Kaveri delta that, from the ninth to the thirteenth century, became the leading power of the south and raided across the Bay of Bengal." },
  { ref: "rashtrakuta", slug: "rashtrakuta-dynasty", kind: "polity", label: "Rashtrakuta dynasty", qid: "Q856691", link: "part_of", description: "Deccan dynasty of the eighth to tenth centuries, ruling from Mānyakheṭa; the “Balharā” of the Arab writers." },
  { ref: "pala", slug: "pala-empire", kind: "polity", label: "Pala Empire", qid: "Q668412", link: "part_of", description: "Dynasty of Bengal and Bihar, eighth to twelfth centuries, patrons of Buddhist monasteries such as Nālandā and Vikramaśilā." },
  { ref: "pratihara", slug: "gurjara-pratihara", kind: "polity", label: "Gurjara-Pratihara", qid: "Q5324", link: "part_of", description: "Dynasty of western and northern India, eighth to eleventh centuries, which held Kannauj from 816 and checked the Arabs in the west." },
  { ref: "chalukya", slug: "chalukya-dynasty", kind: "polity", label: "Chalukya dynasty", qid: "Q1395011", link: "part_of", description: "Deccan dynasty ruling from Vātāpi (Badami) from the sixth to the eighth century; its king Pulakeśin II stopped Harṣa." },
  { ref: "pallava", slug: "pallava-dynasty", kind: "polity", label: "Pallava dynasty", qid: "Q466803", link: "part_of", description: "Dynasty of the Tamil north, ruling from Kāñcī; rivals of the Chalukyas, builders at Mamallapuram." },
  { ref: "wchalukya", slug: "western-chalukya-empire", kind: "polity", label: "Western Chalukya Empire", qid: "Q14624218", link: "part_of", description: "The later Chalukyas of Kalyāṇī, who revived Chalukya power in the Deccan in the late tenth century and fought the Cholas." },
  { ref: "ghaznavids", slug: "ghaznavids", kind: "polity", label: "Ghaznavids", qid: "Q12844800", link: "contemporary_of", description: "Turkic dynasty ruling from Ghazni in Afghanistan, whose sultan Mahmud raided northern India between about 1000 and 1027." },
  // New polities, linked to Cliopatria rows the importer left unlinked
  { ref: "harsha_empire", slug: "pushyabhuti-dynasty", kind: "polity", label: "Harṣa's kingdom (Puṣyabhūti dynasty)", qid: "Q28109312", link: "part_of", extentName: "Harsha's Empire", description: "The kingdom of the Puṣyabhūti family of Thanesar, which under Harṣa (606–647) ruled much of the Ganges plain from Kannauj.", aliases: [{ label: "Pushyabhuti dynasty", lang: "en" }, { label: "Vardhana dynasty", lang: "en" }, { label: "Harsha's Empire", lang: "en", note: "Cliopatria's name" }] },
  { ref: "srivijaya", slug: "srivijaya", kind: "polity", label: "Śrīvijaya", qid: "Q234197", link: "contemporary_of", extentName: "Srivijaya", description: "Maritime kingdom of Sumatra and the Malay peninsula that controlled the straits trade; its king of Kaḍāram was captured by Rājendra I's fleet about 1025.", aliases: [{ label: "Srivijaya", lang: "en" }, { label: "Śrīviśaya", lang: "ta-Latn", note: "In Rājendra I's inscriptions" }] },
  // Kings
  { ref: "harsha", slug: "harsha", kind: "person", label: "Harṣa", qid: "Q216895", link: "participant_in", description: "King of Thanesar and Kannauj (606–647), patron of the poet Bāṇa and host of the Chinese pilgrim Xuanzang; checked in the south by Pulakeśin II.", aliases: [{ label: "Harshavardhana", lang: "en" }, { label: "Harṣavardhana", lang: "sa-Latn" }, { label: "Śīlāditya", lang: "sa-Latn", note: "His title, in Xuanzang" }],
    spans: [{ role: "reign", when: { start: ce(606), end: ce(647), basis: "Wikipedia, Harsha: emperor of Kannauj from April 606 until his death in 647" } }] },
  { ref: "pulakeshin", slug: "pulakeshin-ii", kind: "person", label: "Pulakeśin II", qid: "Q708370", link: "participant_in", description: "Chalukya king of Vātāpi (c. 609–642) who defeated Harṣa and was killed when the Pallavas took his capital.", aliases: [{ label: "Pulakeshin II", lang: "en" }, { label: "Pulikeśin II", lang: "sa-Latn", note: "Kielhorn's spelling" }],
    spans: [{ role: "reign", when: { start: ce(609, true), end: ce(642, true), basis: "Wikipedia, Pulakeshin II: r. 609–642" } }] },
  { ref: "narasimhavarman", slug: "narasimhavarman-i", kind: "person", label: "Narasiṃhavarman I", qid: "Q3537058", link: "participant_in", description: "Pallava king of Kāñcī who took the Chalukya capital Vātāpi about 642; Mamallapuram is named after his title Mamalla.", aliases: [{ label: "Narasimhavarman I", lang: "en" }, { label: "Māmalla", lang: "sa-Latn" }] },
  { ref: "dharmapala", slug: "dharmapala-pala", kind: "person", label: "Dharmapāla", qid: "Q3183804", link: "participant_in", description: "Pāla king of Bengal who, in the late eighth or early ninth century, installed a king of his choice at Kannauj.", aliases: [{ label: "Dharmapala", lang: "en" }] },
  { ref: "nagabhata", slug: "nagabhata-ii", kind: "person", label: "Nāgabhaṭa II", qid: "Q6958310", link: "participant_in", description: "Gurjara-Pratihāra king who won Kannauj in 816.", aliases: [{ label: "Nagabhata II", lang: "en" }] },
  { ref: "amoghavarsha", slug: "amoghavarsha-i", kind: "person", label: "Amoghavarṣa I", qid: "Q3630862", link: "participant_in", description: "Rāṣṭrakūṭa king (814–878) ruling from Mānyakheṭa, author or co-author of the Kannada Kavirājamārga.", aliases: [{ label: "Amoghavarsha I", lang: "en" }, { label: "Nṛpatuṅga", lang: "sa-Latn" }],
    spans: [{ role: "reign", when: { start: ce(814), end: ce(878), basis: "Wikipedia, Amoghavarsha: emperor from 814 until his death in 878" } }] },
  { ref: "rajaraja", slug: "rajaraja-i", kind: "person", label: "Rājarāja I", qid: "Q2128757", link: "participant_in", description: "Chola king (985–1014) who conquered much of the south and Sri Lanka and built the Rājarājeśvara temple at Thanjavur.", aliases: [{ label: "Rajaraja I", lang: "en" }, { label: "Rājarāja Cōḻaṉ", lang: "ta-Latn" }],
    spans: [{ role: "reign", when: { start: ce(985), end: ce(1014), basis: "Wikipedia, Rajaraja I: reigned 985–1014. His inscriptions are dated by years of his reign" } }] },
  { ref: "rajendra", slug: "rajendra-i", kind: "person", label: "Rājendra I", qid: "Q211483", link: "participant_in", description: "Chola king (1014–1044) who led armies to the Ganges and sent a fleet against the king of Kaḍāram, and built Gangaikonda Cholapuram.", aliases: [{ label: "Rajendra I", lang: "en" }, { label: "Rājendra Cōḻa", lang: "ta-Latn" }],
    spans: [{ role: "reign", when: { start: ce(1014), end: ce(1044), basis: "Wikipedia, Rajendra I: reigned 1014–1044 (Hultzsch, EI IX, gives his accession as 1012, when he was made co-regent)" } }] },
  { ref: "kundavai", slug: "kundavai", kind: "person", label: "Kundavai", qid: "Q6444307", link: "participant_in", description: "Elder sister of Rājarāja I, a donor to the Thanjavur temple and founder of a Jain shrine at Tirumalai.", aliases: [{ label: "Kundavai Pirāṭṭiyār", lang: "ta-Latn" }] },
  { ref: "mahmud", slug: "mahmud-of-ghazni", kind: "person", label: "Mahmud of Ghazni", qid: "Q189271", link: "participant_in", description: "Sultan of Ghazni (r. 998–1030) who raided northern India repeatedly, sacking Thanesar, Kannauj and Somnāth.", aliases: [{ label: "Maḥmūd of Ghazna", lang: "en" }] },
  // Writers
  { ref: "bana", slug: "banabhatta", kind: "person", label: "Bāṇa", qid: "Q171202", link: "related_to", description: "Sanskrit poet at Harṣa's court, author of the Harṣacarita, a praise biography of the king.", aliases: [{ label: "Bāṇabhaṭṭa", lang: "sa-Latn" }, { label: "Banabhatta", lang: "en" }] },
  { ref: "xuanzang", slug: "xuanzang", kind: "person", label: "Xuanzang", qid: "Q42063", life: true, link: "related_to", description: "Chinese Buddhist monk who travelled in India in the seventh century; his account records traditions about Nālandā and Mihirakula.", aliases: [{ label: "Hiuen Tsiang", lang: "en", note: "Beal's spelling (1884)" }] },
  { ref: "sulaiman", slug: "sulaiman-al-tajir", kind: "person", label: "Sulaimān the merchant", qid: "Q9347981", link: "related_to", description: "Arab merchant whose account of voyages to India and China, dated 851, describes the kings of India.", aliases: [{ label: "Sulayman al-Tajir", lang: "en" }] },
  { ref: "albiruni", slug: "al-biruni", kind: "person", label: "Alberuni", qid: "Q11826", life: true, link: "related_to", description: "Scholar from Khwarazm who lived at Ghazni under Mahmud from 1017, learned Sanskrit, and wrote a great survey of Indian learning (c. 1030).", aliases: [{ label: "Al-Biruni", lang: "en" }, { label: "Abū Rayḥān al-Bīrūnī", lang: "ar-Latn" }] },
  { ref: "kalhana", slug: "kalhana", kind: "person", label: "Kalhaṇa", qid: "Q1397476", link: "related_to", description: "Kashmiri poet who wrote the Rājataraṅgiṇī, a verse chronicle of the kings of Kashmir, in 1148–49.", aliases: [{ label: "Kalhana", lang: "en" }] },
  { ref: "rssharma", slug: "r-s-sharma", kind: "person", label: "R. S. Sharma", qid: "Q3595294", life: true, description: "Indian historian whose Indian Feudalism (1965) argued that early medieval India became a feudal society.", aliases: [{ label: "Ram Sharan Sharma", lang: "en" }] },
  { ref: "bstein", slug: "burton-stein", kind: "person", label: "Burton Stein", qid: "Q5000917", life: true, description: "American historian of South India who doubted that the Chola state had a central bureaucracy and called it a “segmentary state”." },
  { ref: "elliot", slug: "henry-miers-elliot", kind: "person", label: "H. M. Elliot", qid: "Q347064", life: true, description: "British official whose translations of Persian chronicles, published by John Dowson (1867–77), were meant to show Indians the benefits of British rule.", aliases: [{ label: "Henry Miers Elliot", lang: "en" }] },
  { ref: "hultzsch", slug: "eugen-hultzsch", kind: "person", label: "E. Hultzsch", qid: "Q101954", life: true, description: "German epigraphist who edited South Indian Inscriptions (1890–1913), including the Chola records of Thanjavur.", aliases: [{ label: "Eugen Hultzsch", lang: "en" }] },
  // Places and sites
  { ref: "kannauj", slug: "kannauj", kind: "place", label: "Kannauj", qid: "Q614890", geo: "approximate", link: "related_to", description: "City on the Ganges, ancient Kanyākubja: Harṣa's capital and later the prize of the wars between Pratihāras, Pālas and Rāṣṭrakūṭas.", aliases: [{ label: "Kanyākubja", lang: "sa-Latn" }, { label: "Mahodaya", lang: "sa-Latn", note: "Another old name, in the Pāla grants" }] },
  { ref: "thanjavur_temple", slug: "brihadisvara-temple", kind: "site", label: "Rājarājeśvara temple, Thanjavur", qid: "Q916943", geo: "exact", link: "related_to", description: "The great Śiva temple built by Rājarāja I at Thanjavur and finished about 1010, now called the Bṛhadīśvara; its walls carry his inscriptions.", aliases: [{ label: "Brihadisvara Temple", lang: "en" }, { label: "Rajarajeshvaram", lang: "ta-Latn", note: "Rājarāja's own name for it" }] },
  { ref: "gangaikonda", slug: "gangaikonda-cholapuram", kind: "place", label: "Gangaikonda Cholapuram", qid: "Q1493439", geo: "approximate", link: "related_to", description: "Rājendra I's new Chola capital, named for his expedition to the Ganges, c. 1025." },
  { ref: "aihole", slug: "aihole", kind: "site", label: "Aihole", qid: "Q404851", geo: "approximate", link: "related_to", description: "Temple town in Karnataka where a Jain temple carries Ravikīrti's inscription of 634–35 in praise of Pulakeśin II." },
  { ref: "vatapi", slug: "badami", kind: "place", label: "Vātāpi (Badami)", qid: "Q590751", geo: "approximate", link: "related_to", description: "The Chalukya capital in Karnataka, taken by the Pallavas about 642.", aliases: [{ label: "Badami", lang: "en", note: "The modern town" }, { label: "Vatapi", lang: "en" }] },
  { ref: "kanchi", slug: "kanchipuram", kind: "place", label: "Kāñcī", qid: "Q212332", geo: "approximate", link: "related_to", description: "The Pallava capital in the Tamil north (present-day Kanchipuram).", aliases: [{ label: "Kanchipuram", lang: "en" }, { label: "Kāñcīpuram", lang: "ta-Latn" }] },
  { ref: "mamallapuram", slug: "mamallapuram", kind: "place", label: "Mamallapuram", qid: "Q208000", geo: "approximate", link: "related_to", description: "Pallava port and temple site on the Coromandel coast, named after Narasiṃhavarman I (Mamalla).", aliases: [{ label: "Mahabalipuram", lang: "en" }] },
  { ref: "uttaramerur", slug: "uttaramerur", kind: "place", label: "Uttaramerūr", qid: "Q264443", geo: "approximate", link: "related_to", description: "Village near Kanchipuram whose temple walls record, in Parāntaka I's reign, how its assembly chose its committees by lot.", aliases: [{ label: "Uthiramerur", lang: "en" }, { label: "Uttaramallur", lang: "en", note: "Venkayya's spelling" }] },
  { ref: "kailasa", slug: "kailasa-temple-ellora", kind: "site", label: "Kailāsa temple, Ellora", qid: "Q1268562", geo: "exact", link: "related_to", description: "A whole temple cut from the rock at Ellora, generally attributed to the Rāṣṭrakūṭa king Kṛṣṇa I (c. 756–773).", aliases: [{ label: "Kailasa Temple", lang: "en" }] },
  { ref: "somnath", slug: "somnath-temple", kind: "site", label: "Somnāth temple", qid: "Q1143887", geo: "exact", link: "related_to", description: "Śiva temple on the coast of Gujarat, raided by Mahmud of Ghazni in 1026 and rebuilt many times since.", aliases: [{ label: "Somanātha", lang: "sa-Latn" }, { label: "Somnath", lang: "en" }] },
  { ref: "ghazni", slug: "ghazni", kind: "place", label: "Ghazni", qid: "Q173731", geo: "approximate", link: "related_to", description: "City in Afghanistan, capital of the Ghaznavid sultans.", aliases: [{ label: "Ghazna", lang: "en" }, { label: "Ghaznin", lang: "en", note: "Sachau's spelling" }] },
  { ref: "kadaram", slug: "kedah", kind: "place", label: "Kaḍāram (Kedah)", qid: "Q188947", geo: "approximate", geoNote: "Coordinates from Wikidata for the modern Malaysian state of Kedah, usually identified with Kaḍāram.", link: "related_to", description: "The kingdom of the Malay peninsula, usually identified with Kedah, whose king Rājendra I's fleet captured about 1025.", aliases: [{ label: "Kaḍāram", lang: "ta-Latn" }, { label: "Kaṭāha", lang: "sa-Latn" }] },
];

const TERMS: EntitySpec[] = [
  { ref: "t_regnal", slug: "regnal-year", kind: "term", label: "regnal year", description: "A year counted from a king's accession. Chola inscriptions are dated this way (“the twenty-sixth year of Rājarāja”), so modern dates depend on fixing each accession." },
  { ref: "t_meykirtti", slug: "meykkirtti", kind: "term", label: "meykkīrtti", description: "The historical introduction that opens a Chola king's inscriptions, listing his conquests in a fixed form; Hultzsch calls it the “historical introduction”.", aliases: [{ label: "meykirti", lang: "ta-Latn" }] },
  { ref: "t_samanta", slug: "samanta", kind: "term", label: "sāmanta", description: "Originally “neighbour”; by the end of the Gupta period, a subordinate lord or vassal who held land and owed loyalty to a king.", aliases: [{ label: "samanta", lang: "en" }] },
  { ref: "t_feudalism", slug: "indian-feudalism", kind: "term", label: "feudalism", description: "A European term for a society of lords holding land from kings in return for service, with peasants tied to the land. Whether it fits India is debated.", aliases: [{ label: "Indian feudalism", lang: "en" }] },
  { ref: "t_sabha", slug: "sabha", kind: "term", label: "sabhā", description: "The assembly of a Brahmin village (brahmadeya) in the Chola country; the ūr was the assembly of an ordinary village.", aliases: [{ label: "ūr", lang: "ta-Latn", note: "The assembly of a non-Brahmin village" }] },
  { ref: "t_kudavolai", slug: "kudavolai", kind: "term", label: "kuḍavōlai", description: "“Pot-ticket”: the palm-leaf slips, one per candidate, from which a boy drew names to choose an assembly's committees at Uttaramerūr.", aliases: [{ label: "kudavolai", lang: "en" }, { label: "pot-ticket", lang: "en" }] },
  { ref: "t_digvijaya", slug: "digvijaya", kind: "term", label: "digvijaya", description: "“Conquest of the quarters”: a king's campaign to the four directions to show his supremacy, often ending in tribute rather than rule." },
  { ref: "t_vimana", slug: "vimana", kind: "term", label: "vimāna", description: "The tower over the shrine of a south Indian temple. Thanjavur's, about 200 feet high, is one of the tallest." },
  { ref: "t_balhara", slug: "balhara", kind: "term", label: "Balharā", description: "The Arab writers' title for the Rāṣṭrakūṭa kings, probably from vallabha-rāja, “beloved king”; Sulaimān calls him the greatest prince of India." },
];

export interface ResolvedEntities {
  ref: Record<string, string>;
  ops: ChangeOpInput[];
  dependsOn: string[];
  reused: string[];
}

/** Builds create_entity ops from Wikidata (looked up now), reusing anything that already exists or is pending; links every entity to the period. */
export async function entityOps(mcp: Mcp): Promise<ResolvedEntities> {
  const specs = [...ENTITIES, ...TERMS];
  const qids = specs.flatMap((s) => (s.qid ? [s.qid] : []));
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids });
  const out: ResolvedEntities = { ref: { period: PERIOD }, ops: [], dependsOn: [], reused: [] };
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
    if (s.geo && wd?.coordinates)
      op.geo = {
        geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
        certainty: s.geo,
        note: s.geoNote ?? `Coordinates from Wikidata ${s.qid}.`,
      };
    out.ops.push(op);
    out.ref[s.ref] = `@${s.ref}`;
  }
  // Links into the period (the page's timeline and map), for new and reused entities alike.
  const period = await mcp.call<{ links?: { type: string; other: { slug: string | null; id: string } }[] }>("get_entity", { entity: PERIOD });
  const linked = new Set((period.links ?? []).map((l) => l.other.slug ?? l.other.id));
  for (const s of ENTITIES) {
    const r = out.ref[s.ref]!;
    if (!s.link || linked.has(r)) continue;
    out.ops.push({ op: "link_entities", from: r, to: PERIOD, type: s.link, ...(s.linkNote ? { note: s.linkNote } : {}) });
  }
  out.dependsOn = [...new Set(out.dependsOn)];
  return out;
}

interface ExtentRow {
  id: string;
  name: string;
  entity: { id: string } | null;
  fromYear: number;
  toYear: number;
  version: number;
}

/** Links Cliopatria rows the importer left unlinked (Harsha's Empire, Srivijaya) to the polities here. */
export async function extentOps(mcp: Mcp, E: Record<string, string>): Promise<ChangeOpInput[]> {
  const byName = new Map(ENTITIES.filter((s) => s.extentName).map((s) => [s.extentName!, s.ref]));
  const rows = new Map<string, ExtentRow>();
  for (let year = 600; year <= 1290; year += 5) {
    const r = await mcp.call<{ extents: ExtentRow[] }>("extents_at", { year, bbox: [55, -12, 130, 42] });
    for (const x of r.extents) if (byName.has(x.name)) rows.set(x.id, x);
  }
  const ops: ChangeOpInput[] = [];
  for (const x of [...rows.values()].sort((a, b) => a.name.localeCompare(b.name) || a.fromYear - b.fromYear)) {
    if (x.entity) continue;
    ops.push({ op: "update_extent", extent: x.id, baseVersion: x.version, set: { entity: E[byName.get(x.name)!]! } });
  }
  return ops;
}

// ---------------------------------------------------------------- content

export function earlyMedievalOps(s: Snaps, E: Record<string, string>): ChangeOpInput[] {
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
  const pd = (pub: number, who: string, died: number | null) =>
    died
      ? `Published ${pub}; ${who} died ${died} (Wikidata). Public domain in India (life + 60) and the US (published before 1931).`
      : `Published ${pub}; public domain in the US (published before 1931). ${who}'s death date was not checked.`;
  const book = (ref: string, iaId: string, csl: { title: string } & Record<string, unknown>, tier: "primary" | "secondary", license: string, lenses: string[], note?: string, kind: "book" | "report" | "article" = "book"): ChangeOpInput => ({
    op: "create_source",
    ref,
    kind,
    tier,
    csl: { type: kind === "report" ? "report" : "book", ...csl },
    identifiers: ia(iaId),
    license: { status: "public_domain", note: license },
    lenses: lenses as never,
    ...(note ? { note } : {}),
  });

  const ops: ChangeOpInput[] = [
    book("s_sii2", "india.history.resource.93073", { title: "South Indian Inscriptions, vol. II: Tamil Inscriptions of Rajaraja, Rajendra-Chola, and others in the Rajarajesvara Temple at Tanjavur", editor: [{ family: "Hultzsch", given: "E." }], issued: { "date-parts": [[1891, 1913]] }, publisher: "Government Press", "publisher-place": "Madras", "collection-title": "Archaeological Survey of India, New Imperial Series" }, "primary", pd(1891, "Hultzsch", 1927), ["primary_source", "philological"], "The Thanjavur temple inscriptions in text and translation, issued in parts 1891–1913; Hultzsch's introductions are his scholarship of their time (he later revised his view of where Kaḍāram was)."),
    book("s_sii1", "in.ernet.dli.2015.34586", { title: "South Indian Inscriptions, vol. I: Tamil and Sanskrit Inscriptions", editor: [{ family: "Hultzsch", given: "E." }], issued: { "date-parts": [[1890]] }, publisher: "Government Press", "publisher-place": "Madras" }, "primary", pd(1890, "Hultzsch", 1927), ["primary_source", "philological"], "Includes Pallava inscriptions of Kāñcī and Mamallapuram."),
    book("s_ei9", "epigraphiaindica014770mbp", { title: "Epigraphia Indica, vol. IX (1907–08)", editor: [{ family: "Konow", given: "Sten" }], issued: { "date-parts": [[1908]] }, publisher: "Government Printing", "publisher-place": "Calcutta" }, "primary", "Published 1907–08 by the Government of India: public domain in India and the US. The article quoted, on the Tirumalai rock inscription of Rājendra-Chola I, is by E. Hultzsch (died 1927).", ["primary_source", "philological"]),
    book("s_ei6", "in.ernet.dli.2015.56653", { title: "Epigraphia Indica, vol. VI (1900–01)", editor: [{ family: "Hultzsch", given: "E." }], issued: { "date-parts": [[1901]] }, publisher: "Government Printing", "publisher-place": "Calcutta" }, "primary", "Published 1900–01 by the Government of India: public domain in India and the US. The article quoted, on the Aihole inscription of Pulikeśin II, is by F. Kielhorn (died 1908).", ["primary_source", "philological"]),
    book("s_ei4", "in.ernet.dli.2015.70026", { title: "Epigraphia Indica, vol. IV (1896–97)", editor: [{ family: "Hultzsch", given: "E." }], issued: { "date-parts": [[1897]] }, publisher: "Government Printing", "publisher-place": "Calcutta" }, "primary", "Published 1896–97 by the Government of India: public domain in India and the US. The article quoted, on the Khalimpur plate of Dharmapāla, is by F. Kielhorn (died 1908).", ["primary_source", "philological"]),
    book("s_asi1904", "in.ernet.dli.2015.207530", { title: "Archaeological Survey of India, Annual Report 1904–5", author: [{ literal: "Archaeological Survey of India" }], issued: { "date-parts": [[1908]] }, publisher: "Superintendent Government Printing", "publisher-place": "Calcutta" }, "primary", "Government of India report of 1908: public domain in India and the US. The article quoted, on two inscriptions at Uttaramallūr, is probably by V. Venkayya (died 1912), the Survey's epigraphist; the OCR does not name its author.", ["primary_source", "philological"], undefined, "report"),
    book("s_aiyangar", "cu31924022968840", { title: "Ancient India: Collected Essays on the Literary and Political History of Southern India", author: [{ family: "Aiyangar", given: "S. Krishnaswami" }], issued: { "date-parts": [[1911]] }, publisher: "Luzac", "publisher-place": "London" }, "secondary", "Published 1911; Aiyangar died 1946 (Wikidata). Public domain in India since 2007 and in the US (published before 1931).", ["nationalist"], "Older scholarship, quoted for its views and for traditions it reports."),
    book("s_harsa", "harsacaritaofban00banaiala", { title: "The Harṣa-carita of Bāṇa", author: [{ literal: "Bāṇa" }], translator: [{ family: "Cowell", given: "E. B." }, { family: "Thomas", given: "F. W." }], issued: { "date-parts": [[1897]] }, publisher: "Royal Asiatic Society", "publisher-place": "London" }, "primary", "Published 1897; public domain in the US (published before 1931). In India, Cowell died 1903 and Thomas 1956 (Wikidata), so it has been public domain there since 2017.", ["primary_source"], "A court poet's praise biography of Harṣa; the translators' preface summarises its narrative."),
    book("s_beal1", "siyukibuddhistre01hsua", { title: "Si-yu-ki: Buddhist Records of the Western World, vol. I", author: [{ literal: "Xuanzang (Hiuen Tsiang)" }], translator: [{ family: "Beal", given: "Samuel" }], issued: { "date-parts": [[1884]] }, publisher: "Trübner & Co.", "publisher-place": "London" }, "primary", pd(1884, "Beal", 1889), ["primary_source"], "Xuanzang wrote from his own travels in the 630s and 640s, as Harṣa's guest."),
    book("s_beal2", "siyukibuddhistre02hsuoft", { title: "Si-yu-ki: Buddhist Records of the Western World, vol. II", author: [{ literal: "Xuanzang (Hiuen Tsiang)" }], translator: [{ family: "Beal", given: "Samuel" }], issued: { "date-parts": [[1884]] }, publisher: "Trübner & Co.", "publisher-place": "London" }, "primary", pd(1884, "Beal", 1889), ["primary_source"]),
    book("s_ed1", "historyofindiaas01elli", { title: "The History of India, as Told by Its Own Historians, vol. I", author: [{ family: "Elliot", given: "H. M." }], editor: [{ family: "Dowson", given: "John" }], issued: { "date-parts": [[1867]] }, publisher: "Trübner & Co.", "publisher-place": "London" }, "primary", "Published 1867; Elliot died 1853 and Dowson 1881 (Wikidata). Public domain in India and the US.", ["colonial_orientalist", "primary_source"], "English versions of Arab and Persian writers, often loose or second-hand (Sulaimān is translated from Reinaud's French). Elliot's preface states a colonial purpose."),
    book("s_ed2", "historyofindiaas02elli", { title: "The History of India, as Told by Its Own Historians, vol. II", author: [{ family: "Elliot", given: "H. M." }], editor: [{ family: "Dowson", given: "John" }], issued: { "date-parts": [[1869]] }, publisher: "Trübner & Co.", "publisher-place": "London" }, "primary", "Published 1869; Elliot died 1853 and Dowson 1881 (Wikidata). Public domain in India and the US.", ["colonial_orientalist", "primary_source"], "Extracts from the chroniclers of Mahmud of Ghazni, court writers with their own reasons to magnify his victories."),
    book("s_alb1", "alberunisindiaac01brnm", { title: "Alberuni's India, vol. I", author: [{ literal: "Alberuni (al-Bīrūnī)" }], translator: [{ family: "Sachau", given: "Edward C." }], issued: { "date-parts": [[1888]] }, publisher: "Trübner & Co.", "publisher-place": "London" }, "primary", pd(1888, "Sachau", 1930), ["primary_source"], "Written c. 1030 by a scholar at Mahmud's court."),
    book("s_alb2", "alberunisindiaac02biruuoft", { title: "Alberuni's India, vol. II", author: [{ literal: "Alberuni (al-Bīrūnī)" }], translator: [{ family: "Sachau", given: "Edward C." }], issued: { "date-parts": [[1888]] }, publisher: "Trübner & Co.", "publisher-place": "London" }, "primary", pd(1888, "Sachau", 1930), ["primary_source"]),
    book("s_stein", "RajataranginiVol1", { title: "Kalhaṇa's Rājataraṅgiṇī: A Chronicle of the Kings of Kaśmīr, vol. I", author: [{ literal: "Kalhaṇa" }], translator: [{ family: "Stein", given: "M. A." }], issued: { "date-parts": [[1900]] }, publisher: "Archibald Constable", "publisher-place": "Westminster" }, "primary", "Published 1900; Stein died 1943 (Wikidata). Public domain in the US (published before 1931) and in India since 2004.", ["primary_source", "philological"], "Stein's introduction is his assessment of Kalhaṇa's sources and reliability."),
    ...(Object.keys(CAPTURES).filter((k) => k.startsWith("wp")) as CaptureKey[]).map((k) => wpSource(`s_${k}`, k)),
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

  x("x_sii_rr_edict", "s_sii2", "sii2", "Let the gifts made by us, those made by (our) elder sister, those made by our wives, and those made by other donors to the lord (udaiyar) of the sacred stone-temple (tirukkarrali), (called) Sri-Rajarajesvara,—which we caused to be built (at) Tanjavur", {"volume": "II", "page": "8", "label": "No. 1, Inscription of Rajaraja on the central shrine (Tanjavur), translation, para. 2"}, "Rajaraja's own order; the 'elder sister' is Kundavai (Hultzsch's note). OCR reads '(ous)' for '(our)'.");
  x("x_sii_rr_date", "s_sii2", "sii2", "On the twentieth day of the twenty-sixth year (of the reign) of Ko-Rajakesarivarman, alias Sri-Rajarajadeva", {"volume": "II", "page": "8", "label": "No. 1, translation, para. 2"}, "A regnal-year date: the inscription is dated by the year of the king's reign, not by an era.");
  x("x_sii_rr_conquests", "s_sii2", "sii2", "having been pleased to cut the vessel (alam) (in) the hall (at) Kandalur, he conquered by his army, which was victorious in great battles, Vengai-nadu, Ganga-padi, Tadigai-padi, Nulamba-padi, Kudamalai-nadu, Kollam, Kalingam", {"volume": "II", "page": "8", "label": "No. 1, translation, para. 2 (Rajaraja's historical introduction)"}, "Same introduction recurs in later inscriptions (e.g. No. 4, pp. 47–48).");
  x("x_sii_rr_islands", "s_sii2", "sii2", "twelve thousand ancient islands of the sea,—deprived the Seriyas of their splendour", {"volume": "II", "page": "48", "label": "No. 4, translation, para. 1 (Rajaraja's introduction in the 29th-year version)"}, "Seriyas = Pandyas (Hultzsch's gloss in No. 1).");
  x("x_sii_rj_kadaram", "s_sii2", "sii2", "having despatched many ships in the midst of the rolling sea and having caught Samgramavijayottungavarman, the king of Kadaram, along with (his) vehicles, (viz.) rutting elephants", {"volume": "II", "page": "109", "label": "No. 20, Inscription of Rajendra-Chola (19th year), translation"}, "Rajendra I's historical introduction.");
  x("x_sii_rj_treasure", "s_sii2", "sii2", "took) the large heap of treasures, which (that king) had rightfully accumulated", {"volume": "II", "page": "109", "label": "No. 20, translation"}, "Plunder of the king of Kadaram.");
  x("x_sii_rj_malaiyur", "s_sii2", "sii2", "the ancient Malaiyur (with) a fort situated on a high hill", {"volume": "II", "page": "109", "label": "No. 20, translation"}, "One of the places of the expedition; OCR 'Malai- yar'.");
  x("x_sii_rj_kadaram_sea", "s_sii2", "sii2", "and Kadaram, of fierce strength, which was protected by the neighbouring sea", {"volume": "II", "page": "109", "label": "No. 20, translation (last item of the list)"});
  x("x_sii_rj_ganga", "s_sii2", "sii2", "the Ganga, whose waters sprinkled tirthas, which were full of flowers", {"volume": "II", "page": "109", "label": "No. 20, translation"}, "The northern expedition to the Ganges, in the same list.");
  x("x_sii_rj_mahipala", "s_sii2", "sii2", "Mahipala, who was deprived (even) of his slippers, bracelets and ear-rings", {"volume": "II", "page": "109", "label": "No. 20, translation"}, "Mahipala of Bengal (the Pala king), defeated in the Ganges campaign.");
  x("x_sii_rj_19th", "s_sii2", "sii2", "This inscription records that, on the 242nd day of the 19th year of his reign, Rajendra-Choladeva granted a yearly allowance of paddy to a Saiva priest of the Rajarajesvara temple.", {"volume": "II", "page": "105", "label": "No. 20, Hultzsch's introduction"});
  x("x_sii_hultzsch_kidaram", "s_sii2", "sii2", "Kidaram is now the head-quarters of a taluga of the Ramnad Zamindari in the Madura district.", {"volume": "II", "page": "106", "label": "No. 20, Hultzsch's introduction"}, "Hultzsch's 1892 identification of Kadaram with Kidaram in south India — later abandoned in favour of Kedah/Srivijaya (see his EI IX discussion if present). Historiography, not fact.");
  x("x_sii_dancing_girls", "s_sii2", "sii2", "to four hundred women, evidently dancing-girls, who had been transferred to the establishment of the Rajarajesvara temple from that of other temples in the Chola country.", {"volume": "II", "page": "259", "label": "No. 66, Hultzsch's introduction"});
  x("x_ei9_date", "s_ei9", "ei9", "The inscription is dated in the 13th year of the reign of the Chola king Parakesarivarman alias Rajendra-Choladeva I. (l. 12), who ascended the throne in A.D. 10 12", {"volume": "IX", "page": "230", "label": "No. 31, Tirumalai rock inscription of Rajendra-Chola I, introduction"}, "OCR splits '1012' as '10 12'; keep as is. Hultzsch's accession year 1012 CE.");
  x("x_ei9_ceylon", "s_ei9", "ei9", "boasts of having deprived its king of his own crown, the crowns of his queens", {"volume": "IX", "page": "230", "label": "No. 31, introduction, on Ilam (Ceylon)"}, "Of Rajendra-Chola I and the king of Ceylon.");
  x("x_ei9_mahipala", "s_ei9", "ei9", "Mahipala, whom the Chola king deprived of his elephants and women, is identified by Prof. Kielhorn with the Pala king Mahipala I.", {"volume": "IX", "page": "231", "label": "No. 31, introduction"});
  x("x_ei9_ganga", "s_ei9", "ei9", "and the Ganga, i.e. the river Ganges.", {"volume": "IX", "page": "231", "label": "No. 31, introduction"}, "End of the sentence 'The list of conquests closes with Uttiraladam (l. 11), i.e. Uttara-Virata or Northern Berar,' (OCR noisy in the first half).");
  x("x_ei9_kadaram_wrong", "s_ei9", "ei9", "Mr. Venkayya has shown that my former identification of Kadaram with a place in the Madura district must be wrong, because the Chola king despatched an expedition to it on ships by sea", {"volume": "IX", "page": "231", "label": "No. 31, introduction, on Rajendra's later conquests"}, "Hultzsch retracting his 1892 identification (SII II p. 106).");
  x("x_ei9_nicobar", "s_ei9", "ei9", "Nakkavaram and Pappalana, are, respectively, the Nicobar Islands and a port in Burma.", {"volume": "IX", "page": "231", "label": "No. 31, introduction"}, "Venkayya's identifications, as reported by Hultzsch.");
  x("x_ei9_srivishaya", "s_ei9", "ei9", "Srivishaya was the name of the country ruled over by the king of Kataha or Kadaram.", {"volume": "IX", "page": "231", "label": "No. 31, introduction"}, "Preceded by 'for according to the larger Leiden grant (l. 80)'.");
  x("x_ei9_jaina", "s_ei9", "ei9", "a gift of money for a lamp and for offerings to the Jaina temple on the hill by the wife of a merchant", {"volume": "IX", "page": "231", "label": "No. 31, introduction, on the inscription's purpose"});
  x("x_ei9_kundavai", "s_ei9", "ei9", "This name suggests that the shrine owed its foundation to Kundavai, the daughter of Parantaka II., elder sister of Rajaraja I.", {"volume": "IX", "page": "231", "label": "No. 31, introduction"}, "The Jaina temple called Sri-Kundavai-Jinalaya.");
  x("x_ei6_date", "s_ei6", "ei6", "the year 3735 since the Bharata war, and which is the same — for Saka-Samvat 556 expired, to A.D. 634-35.", {"volume": "VI", "page": "3", "label": "No. 1, Aihole inscription of Pulikesin II, Kielhorn's introduction (page inferred)"});
  x("x_ei6_harsha", "s_ei6", "ei6", "Harsha, whose lotus-feet were arrayed with the rays of the jewels of the diadems of hosts of feudatories prosperous with unmeasured might, through Him had his mirth (harsha) melted away by fear, having become loathsome with his rows of lordly elephants fallen in battle.", {"volume": "VI", "page": "10", "verse": "23", "label": "No. 1, translation, verse 23"}, "'Him' is Pulakesin II; the verse puns on Harsha's name (harsha = joy).");
  x("x_ei6_pallava", "s_ei6", "ei6", "He caused the splendour of the lord of the Pallavas, who had opposed the rise of his power, to be obscured by the dust of his army, and to vanish behind the walls of Kanchipura.", {"volume": "VI", "page": "11", "verse": "29", "label": "No. 1, translation, verse 29"});
  x("x_ei6_three_mahar", "s_ei6", "ei6", "acquired the sovereignty over the three Maharashtrakas with their nine and ninety thousand villages.", {"volume": "VI", "page": "10", "verse": "25", "label": "No. 1, translation, verse 25"});
  x("x_ei6_vatapi", "s_ei6", "ei6", "having entered the city of Vatapi — is ruling like one city, this earth which has the dark-blue waters of the surging sea for its moat", {"volume": "VI", "page": "11", "verse": "32", "label": "No. 1, translation, verse 32"}, "Vatapi (Badami), the Chalukya capital.");
  x("x_ei6_ravikirti_jina", "s_ei6", "ei6", "This stone mansion of Jinendra, a mansion of every kind of greatness, has been caused to be built by the wise Ravikirti", {"volume": "VI", "page": "12", "verse": "35", "label": "No. 1, translation, verse 35"}, "The temple is a Jain temple; Ravikirti was the poet and the founder.");
  x("x_ei6_kalidasa", "s_ei6", "ei6", "who thus by his poetic skill has attained to the fame of Kalidasa and of Bharavi", {"volume": "VI", "page": "12", "verse": "37", "label": "No. 1, translation, verse 37"}, "Ravikirti on himself.");
  x("x_ei6_ships", "s_ei6", "ei6", "He besieged Puri, the Fortune of the western sea, with hundreds of ships", {"volume": "VI", "page": "10", "verse": "21", "label": "No. 1, translation, verse 21"});
  x("x_ei6_kielhorn_exagg", "s_ei6", "ei6", "The statement in verse 37 that it raises its author to the level of Kalidasa and Bharavi, is surely an exaggeration, but in my opinion this poem indubitably places him in the very front rank of court-poets and writers of prasastis", {"volume": "VI", "page": "3", "label": "No. 1, Kielhorn's introduction (page inferred)"});
  x("x_ei6_kielhorn_raghu", "s_ei6", "ei6", "That this kavya of Kalidasa's about A.D. 600 was well-known in widely distant parts of India, and even beyond the confines of India proper, there can be no doubt now.", {"volume": "VI", "page": "3", "label": "No. 1, Kielhorn's introduction (page inferred)"}, "Of the Raghuvamsa.");
  x("x_sii_vatapi", "s_sii2", "sii2", "Narasimhavarman, who destroyed (the city of) Vatapi, just as Agastya destroyed (the demon) Vatapi, (and) who frequently conquered Vallabharaja at Pariyala, Manimangala, Suramara and other (places).", {"volume": "II", "page": "370", "label": "No. 74, Udayendiram plates of Nandivarman (Pallava), translation"}, "Vallabharaja = the Chalukya king (Pulakesin II, per Hultzsch in SII I).");
  x("x_sii_kanchi", "s_sii2", "sii2", "the Tamil name of the Pallava country, the ancient capital of which was Kanchipuram.", {"volume": "II", "page": "113", "label": "No. 22, introduction (on Tondaimandalam)"}, "Of Tondai or Tondaimandalam.");
  x("x_sii1_pulakesin", "s_sii1", "sii1", "I now consider it more probable, that Pulakesin, the enemy of Narasimhavarman I., has to be identified with the Chalukya Pulikesin II.", {"volume": "I", "page": "11", "label": "Kanchipuram Pallava inscriptions, Hultzsch's introduction"}, "Hultzsch on the Kuram grant, which says Narasimhavarman I conquered Pulakesin and destroyed Vatapi.");
  x("x_asi_light", "s_asi1904", "asi1904", "they throw some light on village administration in Southern India in the tenth century A.D.", {"page": "131", "label": "V. Venkayya, “Two inscriptions at Uttaramallur”, introduction"}, "Of the two inscriptions of Parantaka I.");
  x("x_asi_a_date", "s_asi1904", "asi1904", "In the twelfth year (of the reign) of king Parakesarivarman, who conquered Madirai (i.e. Madura)", {"page": "138", "label": "Inscription A, translation, lines 1–3 (page inferred)"}, "Parakesarivarman 'who conquered Madura' is Parantaka I.");
  x("x_asi_a_royal", "s_asi1904", "asi1904", "committees should from this year forward be invariably chosen in this way (by drawing) pot-tickets", {"page": "139", "label": "Inscription A, translation, lines 11–12"}, "The rule was laid down in a royal letter of Parantaka I to the village assembly.");
  x("x_asi_b_wards", "s_asi1904", "asi1904", "In (these) thirty wards, those that live in each ward shall assemble and shall choose for ‘ pot-tickets ’ (kudav-olai)", {"page": "142", "label": "Inscription B (14th year), translation, lines 2–3"});
  x("x_asi_b_land", "s_asi1904", "asi1904", "He must own more than a quarter (veli) of tax- paying land.", {"page": "142", "label": "Inscription B, translation, qualification (a)"});
  x("x_asi_b_house", "s_asi1904", "asi1904", "He must live in a house built on his own site.", {"page": "142", "label": "Inscription B, translation, qualification (b)"});
  x("x_asi_b_age", "s_asi1904", "asi1904", "His age must be below 70 and above 35.", {"page": "142", "label": "Inscription B, translation, qualification (c)"});
  x("x_asi_b_veda", "s_asi1904", "asi1904", "He must know the Mantrabrahmana (i.e.) he must know (it) by teaching (others).", {"page": "142", "label": "Inscription B, translation, qualification (d)"});
  x("x_asi_b_accounts", "s_asi1904", "asi1904", "One who has been on any of the committees but has not submitted his accounts, and all his relations specified below shall not have (their names) written on the pot-tickets", {"page": "143", "label": "Inscription B, translation, lines 4–6"});
  x("x_asi_b_boy", "s_asi1904", "asi1904", "One ward (i.e., the packet representing it) shall be taken out by any young boy standing close, who does not know what is inside, and shall be transferred to another (empty) pot and shaken.", {"page": "144", "label": "Inscription B, translation, lines 9–11"});
  x("x_asi_b_assembly", "s_asi1904", "asi1904", "a full meeting of the great assembly, including the young and old (members), shall be convened.", {"page": "144", "label": "Inscription B, translation, lines 9–11"});
  x("x_aiy_26th", "s_aiyangar", "aiyangar", "This twenty-sixth year is the year in which Rajaraja got the bulk of his inscriptions incised in the Tanjore Temple, a record of gifts and offerings made by himself, his queens, his sister the Pallava lady Kundavvaiyar, and others.", {"page": "105", "label": "S. K. Aiyangar, Ancient India (1911), chapter on Rajaraja"}, "OCR 'Eajaraja'.");
  x("x_aiy_regnal", "s_aiyangar", "aiyangar", "the terminal dates are based upon the last regnal years as yet available from epigraphical sources.", {"page": "158", "label": "Note to the table of Chola rulers (page inferred)"}, "Preceded by: 'The dates of commencement of each ruler are those of the astronomically verified ones of Prof. Kielhorn'.");
  x("x_aiy_tower", "s_aiyangar", "aiyangar", "The main tower of the Tanjore temple is about 200 feet high", {"page": "187", "label": "Chapter on Chola public works (page inferred)"}, "OCR reads '-200'.");
  x("x_aiy_incline", "s_aiyangar", "aiyangar", "It was raised to its present position by an incline, which rested on the ground four miles away from the temple.", {"page": "187", "label": "(page inferred)"}, "Of the capstone; a tradition reported by Aiyangar, not a documented fact.");
  x("x_harsa_assassinated", "s_harsa", "harsa", "After a time news is brought that he had easily conquered the Malwa army but had been treacherously assassinated by the King of Gauda.", {"page": "xii", "label": "Translators' preface (summary of Bāṇa's narrative)"}, "Of Rājyavardhana, Harṣa's elder brother. The translators' summary, not Bāṇa's words.");
  x("x_harsa_vindhya", "s_harsa", "harsa", "he announces that Rajyacri has escaped from prison and fled into the Vindhya forest.", {"page": "xii", "label": "Translators' preface"}, "OCR 'Rajyacri' for Rājyaśrī.");
  x("x_harsa_rescue", "s_harsa", "harsa", "Harsa rescues her from the pile and takes her with him to the camp", {"page": "xii", "label": "Translators' preface"});
  x("x_harsa_throne", "s_harsa", "harsa", "he determines to become an ascetic and to leave the throne to Harsa.", {"page": "xii", "label": "Translators' preface"}, "Of Rājyavardhana, grieving for his father.");
  x("x_harsa_stainless", "s_harsa", "harsa", "Thus no reign has been stainless except that of this Harsa, king of kings, sovereign of all continents.", {"page": "75", "chapter": "III", "label": "Chapter III (page inferred from the running head)"}, "Bāṇa's cousin speaking; the translators note that Bāṇa lists the stains on all ancient heroes, and 'only Harsa is spotless'.");
  x("x_harsa_spotless_note", "s_harsa", "harsa", "In this speech Bana mentions the various stains on the honour of all ancient heroes, — only Harsa is spotless.", {"page": "74", "label": "Translators' note 3 (page inferred)"});
  x("x_harsa_favourite", "s_harsa", "harsa", "The King at first receives him coldly, but Bana soon makes his way and becomes a favourite.", {"page": "xi", "label": "Translators' preface"});
  x("x_harsa_unfinished", "s_harsa", "harsa", "This narrative fills the remainder of the book (pp. 79 — 260), and is left unfinished at the end of the eighth chapter.", {"page": "xi", "label": "Translators' preface"});
  x("x_beal_rajya_murdered", "s_beal1", "beal1", "Rajyavardhana came to the throne as the elder brother, and ruled with virtue.", {"volume": "I", "page": "210", "chapter": "V", "label": "Book V, Kanyākubja"}, "OCR reads 'Kajyavardhana'.");
  x("x_beal_conference", "s_beal1", "beal1", "On this they asked the king to a conference and murdered him.", {"volume": "I", "page": "210", "chapter": "V", "label": "Book V, Kanyākubja"}, "Rājyavardhana, murdered by the ministers of Śaśāṅka, king of Karṇasuvarṇa.");
  x("x_beal_siladitya_title", "s_beal1", "beal1", "He called himself the King's Son (Kumara); his title was Siladitya.", {"volume": "I", "page": "213", "chapter": "V", "label": "Book V, Kanyākubja"});
  x("x_beal_army", "s_beal1", "beal1", "They had a body of 5000 elephants, a body of 2000 cavalry, and 50,000 foot-soldiers.", {"volume": "I", "page": "213", "chapter": "V"});
  x("x_beal_unharnessed", "s_beal1", "beal1", "He went from east to west subduing all who were not obedient ; the elephants were not unharnessed nor the soldiers unbelted (unhelmeted). After six years he had subdued the Five Indies.", {"volume": "I", "page": "213", "chapter": "V"});
  x("x_beal_thirty", "s_beal1", "beal1", "After thirty years his arms reposed, and he governed everywhere in peace.", {"volume": "I", "page": "213", "chapter": "V"});
  x("x_beal_hospices", "s_beal1", "beal1", "in all the highways of the towns and villages throughout India he erected hospices, provided with food and drink, and stationed there physicians", {"volume": "I", "page": "214", "chapter": "V"});
  x("x_beal_moksha", "s_beal1", "beal1", "Once in five years he held the great assembly called Moksha.", {"volume": "I", "page": "214", "chapter": "V"});
  x("x_beal_note_pulikesi", "s_beal1", "beal1", "Siladitya did, in fact, conquer the whole of North India, and was only checked in the south by Pulikesi", {"volume": "I", "page": "213", "label": "Beal's note 21"}, "Beal's own note.");
  x("x_beal_pulakesi_name", "s_beal2", "beal2", "He is of the Kshattriya caste, and his name is Pulakesi (Pu-lo-ki-she).", {"volume": "II", "page": "256", "chapter": "XI", "label": "Book XI, Mahārāṣṭra"});
  x("x_beal_not_submitted", "s_beal2", "beal2", "At the present time Siladitya Maharaja has conquered the nations from east to west, and carried his arms to remote districts, but the people of this country alone have not", {"volume": "II", "page": "256", "chapter": "XI", "label": "Book XI, Mahārāṣṭra"}, "Continues on p. 257: 'submitted to him.'");
  x("x_beal_not_conquered", "s_beal2", "beal2", "He has gathered troops from the five Indies, and summoned the best leaders from all countries, and himself gone at the head of his army to punish and subdue these people, but he has not yet conquered their troops.", {"volume": "II", "page": "257", "chapter": "XI", "label": "Book XI, Mahārāṣṭra"});
  x("x_ed_elliot_mildness", "s_ed1", "ed1", "They will make our native subjects more sensible of the immense advantages accruing to them under the mildness and and equity of our rule.", {"volume": "I", "page": "xxii", "label": "Elliot's original preface"}, "Sic 'and and' in the printed text. Elliot's stated purpose for translating the Muslim chroniclers.");
  x("x_ed_sulaiman_851", "s_ed1", "ed1", "the account written by a merchant named Sulaiman, who embarked on the Persian Gulf, and made several voyages to India and China. This bears the date 237 a.h. (851 a.d.).", {"volume": "I", "page": "2", "label": "Introduction to the Silsilatu-t Tawarikh (page inferred)"});
  x("x_ed_balhara_eminent", "s_ed1", "ed1", "The Balhara is the most eminent of the princes of India, and the Indians acknowledge his superiority.", {"volume": "I", "page": "3", "label": "Sulaiman (page inferred)"}, "OCR has a footnote numeral after Balhara.");
  x("x_ed_balhara_arabs", "s_ed1", "ed1", "In fact, among all the kings there is no one to be found who is so partial to the Arabs as the Balhara; and his subjects follow his example.", {"volume": "I", "page": "4", "label": "Sulaiman"});
  x("x_ed_balhara_title", "s_ed1", "ed1", "Balhara is the title borne by all the kings of this dynasty.", {"volume": "I", "page": "4", "label": "Sulaiman"});
  x("x_ed_jurz_cavalry", "s_ed1", "ed1", "This king maintains numerous forces, and no other Indian prince has so fine a cavalry.", {"volume": "I", "page": "4", "label": "Sulaiman, on the king of Jurz"}, "Mas'udi reads Juzr; Elliot's note discusses the identification (Gurjara).");
  x("x_ed_jurz_foe", "s_ed1", "ed1", "Among the princes of India there is no greater foe of the Muhammadan faith than he.", {"volume": "I", "page": "4", "label": "Sulaiman, on the king of Jurz"});
  x("x_ed_ruhmi", "s_ed1", "ed1", "These three states border on a kingdom called Ruhmi, which is at war with that of Jurz.", {"volume": "I", "page": "5", "label": "Sulaiman"}, "OCR has a footnote numeral after Ruhmi.");
  x("x_ed_ruhmi_elephants", "s_ed1", "ed1", "It is said that when he goes out to battle he is followed by about 50,000 elephants.", {"volume": "I", "page": "5", "label": "Sulaiman, on the king of Ruhmi"});
  x("x_ed_kauris", "s_ed1", "ed1", "Trade is carried on by means of kauris, which are the current money of the country.", {"volume": "I", "page": "5", "label": "Sulaiman, on Ruhmi"});
  x("x_alb_ruined", "s_alb1", "alb1", "utterly ruined the prosperity of the country, and performed there wonderful exploits, by which the Hindus became like atoms of dust scattered in all directions, and like a tale of old in the mouth of the people.", {"volume": "I", "page": "22", "chapter": "I", "label": "Chapter I"}, "Of Mahmud.");
  x("x_alb_aversion", "s_alb1", "alb1", "Their scattered remains cherish, of course, the most inveterate aversion towards all Muslims.", {"volume": "I", "page": "22", "chapter": "I"});
  x("x_alb_sciences_fled", "s_alb1", "alb1", "This is the reason, too, why Hindu sciences have retired far away from those parts of the country conquered by us, and have fled to places which our hand cannot yet reach, to Kashmir, Benares, and other places.", {"volume": "I", "page": "22", "chapter": "I"});
  x("x_alb_thirty_years", "s_alb1", "alb1", "marched into India during a period of thirty years and more.", {"volume": "I", "page": "22", "chapter": "I"}, "Of Mahmud, on the roads built by his father Sabuktagin.");
  x("x_alb_sachau_cold", "s_alb1", "alb1", "the manner in which the author mentions the dead king is cold, cold in the extreme", {"volume": "I", "page": "xi", "label": "Sachau's preface (page inferred)"}, "Sachau on Alberuni's attitude to Mahmud.");
  x("x_alb_somnath", "s_alb2", "alb2", "The image was destroyed by the Prince Mahmud —may God be merciful to him!—A.H. 416.", {"volume": "II", "page": "103", "chapter": "LVIII", "label": "Chapter LVIII"}, "OCR prints a marginal note inside the sentence.");
  x("x_alb_somnath_ghazni", "s_alb2", "alb2", "He ordered the upper part to be broken and the remainder to be transported to his residence, Ghaznin, with all its coverings and trappings of gold, jewels, and embroidered garments.", {"volume": "II", "page": "103", "chapter": "LVIII"});
  x("x_alb_somnath_mosque", "s_alb2", "alb2", "Another part of the idol from Somanath lies before the door of the mosque of Ghaznin, on which people rub their feet to clean them from dirt and wet.", {"volume": "II", "page": "103", "chapter": "LVIII"});
  x("x_ed_ibnasir_somnat", "s_ed2", "ed2", "Mahmud captured several forts and cities in Hind, and he also took the idol called Somnat. This idol was the greatest of all the idols of Hind.", {"volume": "II", "page": "468", "label": "Appendix, Sixteenth Expedition, from the Kamilu-t Tawarikh of Ibn Asir"}, "Ibn al-Athīr wrote c. 1230, two centuries later; Elliot's extract dates it 414 h.");
  x("x_ed_slaughter_gate", "s_ed2", "ed2", "A dreadful slaughter followed at the gate of the temple.", {"volume": "II", "page": "470", "label": "Appendix, from Ibn Asir"});
  x("x_ed_416_415", "s_ed2", "ed2", "Those who follow [Ibn Asir and] Mirkhond make it commence with 416 h. Those who follow Firishta with 415 h.", {"volume": "II", "page": "468", "label": "Appendix, Sixteenth Expedition, Somnat"}, "Elliot (and Dowson's brackets) on the date of the raid.");
  x("x_ed_yamini_omits", "s_ed2", "ed2", "So little does he attempt to improve upon the Yamini, that he even leaves out the important expedition to Somnat, which was undertaken after the close of that work.", {"volume": "II", "page": "430", "label": "Appendix, on the sources for Mahmud"}, "Of Rashidu-d din. Utbi's contemporary Tarikh-i Yamini ends before the Somnat raid.");
  x("x_ed_utbi_vow", "s_ed2", "ed2", "and vowed that every year he would undertake a holy war against Hind.", {"volume": "II", "page": "24", "label": "Tarikh Yamini of 'Utbi (page inferred)"}, "Of Mahmud, after his investiture.");
  x("x_ed_ibnasir_dates", "s_ed2", "ed2", "He was born in the year 555 h. (1160) in the Jazirat ibn 'Umar, an island of the Tigris above Mosul", {"volume": "II", "page": "244", "label": "Introduction to the Kamilu-t Tawarikh of Ibn Asir"});
  x("x_stein_legendary", "s_stein", "stein", "As we go back from the Fifth Book where with the middle of the ninth century we seem to reach contemporary records, the narrative becomes more and more legendary and anecdotal.", {"volume": "I", "page": "28", "label": "Introduction, ch. II, sec. iii (page inferred)"});
  x("x_stein_no_critical", "s_stein", "stein", "we cannot expect critical judgment in matters of chronology from an author who bases his reckoning on a legendary date like that of Yudhisthira's coronation, and is prepared to accept a reign of three hundred years for a single king (Ranaditya).", {"volume": "I", "page": "31", "label": "Introduction, ch. II, sec. iii, “Kalhana's critical horizon” (page inferred)"});
  x("x_stein_eleven", "s_stein", "stein", "Kalhana distinctly tells us that he had inspected \"eleven works of former scholars containing the chronicles of the kings,\" besides the Nilamata-purana.", {"volume": "I", "page": "24", "label": "Introduction, ch. II, sec. ii, “Kalhana's sources” (page inferred)"});
  x("x_stein_inscriptions", "s_stein", "stein", "the trouble arising from many errors, by looking at the inscriptions recording the consecration of temples and grants by former kings, at the laudatory inscriptions and at written texts", {"volume": "I", "page": "26", "label": "Introduction, ch. II, quoting Rājataraṅgiṇī i. 15"}, "Kalhaṇa's own words in Stein's translation.");
  x("x_stein_judge", "s_stein", "stein", "worthy of praise whose word, like that of a judge, keeps free from love or hatred in relating the facts of the past.", {"volume": "I", "page": "24", "label": "Introduction, quoting Kalhaṇa (page inferred)"}, "Kalhaṇa on the poet-historian.");
  x("x_stein_karkota", "s_stein", "stein", "succeeded in fixing with fair accuracy the dates for almost all the kings from the advent of the Karkota dynasty onwards", {"volume": "I", "label": "Preface (page not legible in the OCR)"}, "Of Cunningham's work on Kalhaṇa's chronology (1846).");
  x("x_ki_dharmapala_kanauj", "s_ei4", "ei4", "the only fact recorded is, that he installed a certain king of Kanyakubja (or Kanauj), to the joy of the people of Panchala, and with the ready approval of the Bhojas, Matsyas, Madras, Kurus, Yadus, Yavanas, Avantis, Gandharas and Kiras", {"volume": "IV", "page": "245", "label": "Kielhorn, “Khalimpur plate of Dharmapaladeva”, introduction (page inferred)"}, "Of Dharmapāla.");
  x("x_ki_ninth", "s_ei4", "ei4", "it must have taken place about the middle or in the earlier part of the 9th century", {"volume": "IV", "page": "246", "label": "Kielhorn, introduction"});
  x("x_ki_pataliputra", "s_ei4", "ei4", "Dharmapala, when he made this grant, resided at Pataliputra, the modern Patna, on the Ganges", {"volume": "IV", "page": "246", "label": "Kielhorn, introduction"});
  x("x_ki_chakrayudha", "s_ei4", "ei4", "according to which Dharmapala gave back again the sovereignly of Mahodaya (or Kananj), which he had acquired fay defeating laidraraja and other enemies, to the begging Ohakrdjrudha", {"volume": "IV", "page": "245", "label": "Kielhorn, on the Bhagalpur plate of Nārāyaṇapāla (page inferred)"}, "Quoted in the OCR's spelling (sovereignty, Kanauj, by, Indrarāja, Chakrāyudha); corrected spellings match below 95%.");
  x("x_ki_gopala", "s_ei4", "ei4", "relates that, to put an end to lawlessness and disorder, G6p51a was induced hy the people to assmne the sovereignty", {"volume": "IV", "page": "245", "label": "Kielhorn, introduction (page inferred)"}, "Quoted in the OCR's spelling (Gopāla, by, assume). Of the founder of the Pāla dynasty.");
  x("x_ed_reinaud", "s_ed1", "ed1", "The following observations upon the work are condensed from M. Reinaud's ; the translation is also taken from his.", {"volume": "I", "page": "2", "label": "Introduction to Sulaiman (page inferred)"}, "Elliot's Sulaimān is an English version of Reinaud's French translation (published 1844, per Elliot).");
  x("x_harsha_reign", "s_wpHarsha", "wpHarsha", "Harshavardhana (Sanskrit: हर्षवर्धन;  4 June 590 – 647) was the emperor of Kannauj from April 606 until his death in 647.", {"section": "Lead"});
  x("x_harsha_capital", "s_wpHarsha", "wpHarsha", "He eventually made Kanyakubja (present-day Kannauj, Uttar Pradesh state) his imperial capital, and reigned until 647 CE.", {"section": "Lead"});
  x("x_harsha_narmada", "s_wpHarsha", "wpHarsha", "Harsha was defeated by the Emperor Pulakeshin II of the Chalukya dynasty in the Battle of Narmada, when he tried to expand his empire into the southern peninsula of India.", {"section": "Lead"});
  x("x_harsha_618", "s_wpHarsha", "wpHarsha", "Pulakeshin II repelled an invasion led by Harsha on the banks of Narmada in the winter of 618–619.", {"section": "Reign"});
  x("x_harsha_treaty", "s_wpHarsha", "wpHarsha", "Pulakeshin then entered into a treaty with Harsha, with the Narmada River designated as the border between the Chalukya Empire and that of Harshavardhana.", {"section": "Reign"});
  x("x_harsha_bana", "s_wpHarsha", "wpHarsha", "His biography Harshacharita (\"The Life of Harsha\") written by the Sanskrit poet Banabhatta, describes his association with Sthanesvara, besides mentioning a defensive wall, a moat and the palace with a two-storied Dhavalagriha (white mansion).", {"section": "Lead"});
  x("x_harsha_festival", "s_wpHarsha", "wpHarsha", "Xuanzang also describes a 21-day religious festival organized by Harsha in Kanyakubja; during this festival, Harsha and his subordinate kings performed daily rituals before a life-sized golden statue of the Buddha.", {"section": "Religion and religious policy"});
  x("x_pul_reign", "s_wpPulakeshin", "wpPulakeshin", "Pulakeshin II (IAST: Pulakeśin; r. 609–642), popularly known as Immaḍi Pulakeśi, was the Chālukyan emperor from c. 609 to 642.", {"section": "Lead"});
  x("x_pul_deccan", "s_wpPulakeshin", "wpPulakeshin", "During his reign, the Chalukya empire of Vatapi expanded to cover most of the Deccan region in peninsular India.", {"section": "Lead"});
  x("x_pul_harsha", "s_wpPulakeshin", "wpPulakeshin", "The most notable military achievement of Pulakeshin was his victory over the powerful northern emperor Harshavardhana, whose failure to conquer the Chalukyan territories to the south is attested by the Chinese pilgrim Xuanzang.", {"section": "Lead"});
  x("x_pul_pallava", "s_wpPulakeshin", "wpPulakeshin", "Pulakeshin also achieved some successes against the Pallavas in the south, but was ultimately defeated and possibly killed during an invasion by the Pallava monarch Narasimhavarman I in c. 642–643 CE.", {"section": "Lead"});
  x("x_pul_ravikirti", "s_wpPulakeshin", "wpPulakeshin", "He patronized several Jaina scholars, including Ravikirtti, who composed his Aihole inscription.", {"section": "Lead"});
  x("x_chal_badami", "s_wpChalukya", "wpChalukya", "The earliest dynasty, known as the \"Badami Chalukyas\", ruled from Vatapi (modern Badami) from the middle of the 6th century.", {"section": "Lead"});
  x("x_chal_rashtrakuta", "s_wpChalukya", "wpChalukya", "In the western Deccan, the rise of the Rashtrakutas in the middle of the 8th century eclipsed the Chalukyas of Badami before being revived by their descendants, the Western Chalukyas, in the late 10th century.", {"section": "Lead"});
  x("x_chal_empires", "s_wpChalukya", "wpChalukya", "The political atmosphere in South India shifted from smaller kingdoms to large empires with the ascendancy of Badami Chalukyas.", {"section": "Lead"});
  x("x_nar_vatapi", "s_wpNarasimha", "wpNarasimha", "Encouraged by this victory, Narasimhavarman led his army along with his general Paranjothi and attacked Vatapi, successfully defeating and killing the Chalukyan Emperor Pulakeshin II in 642 CE.", {"section": "Military conquests"});
  x("x_nar_mamalla", "s_wpNarasimha", "wpNarasimha", "Narasimhavarman I was also known as Mamallan (great wrestler), and Mamallapuram (Mahabalipuram) was named in his honour.", {"section": "Lead"});
  x("x_pal_conflict", "s_wpPallava", "wpPallava", "Throughout their rule, they remained in constant conflict with both the Chalukyas of Vatapi to the north, and the Tamil kingdoms of Chola and Pandyas to their south.", {"section": "Lead"});
  x("x_pal_shore", "s_wpPallava", "wpPallava", "The Pallavas are most noted for their patronage of Vaishnava Hindu temple architecture, the finest example being the Shore Temple, a UNESCO World Heritage Site in Mamallapuram.", {"section": "Lead"});
  x("x_pal_kanchi", "s_wpPallava", "wpPallava", "Kanchipuram served as the capital of the Pallava kingdom.", {"section": "Lead"});
  x("x_tri_def", "s_wpTripartite", "wpTripartite", "The Tripartite Struggle (785–816) also known as the Kannauj Wars, were a series of wars in northern India fought over the control of the throne of Kannauj.", {"section": "Lead"});
  x("x_tri_three", "s_wpTripartite", "wpTripartite", "It involved the three powerful dynasties of the era– the Gurjara-Pratiharas, the Palas of Gauda (Bengal) and the Rashtrakutas of Manyakheta.", {"section": "Lead"});
  x("x_tri_816", "s_wpTripartite", "wpTripartite", "The war ultimately resulted in Nagabhata II, winning the crown of Kannauj in 816, and proclaiming himself as King of Kannauj.", {"section": "Lead"});
  x("x_tri_harsha", "s_wpTripartite", "wpTripartite", "On the other hand, the conflict between the Palas of Gauda/Bengal and the Ayudhas of Kannauj was the continuation of an old power struggle that had started between Harshavardhana of Kannauj and Sasanka of Gauda in the 7th century and would continue till the 12th century.", {"section": "Background"});
  x("x_pra_arab", "s_wpPratihara", "wpPratihara", "The Pratiharas were instrumental in containing Arab armies to the west of Indus River.", {"section": "Lead"});
  x("x_pra_nagabhata1", "s_wpPratihara", "wpPratihara", "Nagabhata I defeated an Arab army during the Caliphate campaigns in India.", {"section": "Lead"});
  x("x_pra_bhoja", "s_wpPratihara", "wpPratihara", "Under Bhoja and his successor Mahendrapala I, the Pratihara dynasty reached its peak of prosperity and power.", {"section": "Lead"});
  x("x_pra_916", "s_wpPratihara", "wpPratihara", "The power of the Pratihara dynasty was weakened by dynastic strife, and further diminished as a result of a great raid led by the Rashtrakuta ruler Indra III who, in about 916, sacked Kannauj.", {"section": "Lead"});
  x("x_pra_1018", "s_wpPratihara", "wpPratihara", "Their last important king, Rajyapala, was killed by Vidyadhara for fleeing from Kannauj and subsequently returning to surrender to Mahmud of Ghazni in 1018.", {"section": "Lead"});
  x("x_pala_gopala", "s_wpPala", "wpPala", "The empire was founded with the election of Gopāla by the chiefs of Gauda in the late 8th century CE.", {"section": "Lead"});
  x("x_pala_zenith", "s_wpPala", "wpPala", "At its zenith under emperors Dharmapala and Devapala in the early ninth century, the Pala Empire was the dominant power in northern India, with its territory stretching across the Gangetic Plain down to the Vindhya Range and may have extended to Goalpara in Assam.", {"section": "Lead"});
  x("x_pala_vihara", "s_wpPala", "wpPala", "Palas built grand Buddhist temples and monasteries (Viharas), including the Somapura Mahavihara and Odantapuri, and patronised the great universities of Nalanda and Vikramashila.", {"section": "Lead"});
  x("x_pala_brahmans", "s_wpPala", "wpPala", "Modern scholars believe Palas were Buddhists as their court became a stronghold and their copper plates emphasised Buddhist affiliation but large majority of images and inscriptions testify that the Palas patronized the brahmans and the worship of Shiva and Vishnu.", {"section": "Origins"});
  x("x_pala_end", "s_wpPala", "wpPala", "The empire became considerably weakened with their heavy dependence on Samantas being exposed after 11th-century Varendra rebellion, which led to the rise of resurgent Hindu Senas as sovereign power in the 12th century and expulsion of the Palas from Bengal, marking the end of the last major Buddhist imperial power in the subcontinent.", {"section": "Lead"});
  x("x_ras_753", "s_wpRashtrakuta", "wpRashtrakuta", "The Samangadh copper plate grant (753) confirms that the feudatory King Dantidurga, who probably ruled from Achalapura in Berar (modern Elichpur in Maharashtra), defeated the great Karnatic army (referring to the army of the Badami Chalukyas) of Kirtivarman II of Badami in 753 and took control of the northern regions of the Chalukya empire.", {"section": "Early history"});
  x("x_ras_extent", "s_wpRashtrakuta", "wpRashtrakuta", "At their peak the Rashtrakutas of Manyakheta ruled a vast empire stretching from the Ganges River and Yamuna River doab in the north to Kanyakumari in the south, a fruitful time of political expansion, architectural achievements and famous literary contributions.", {"section": "Lead"});
  x("x_ras_manyakheta", "s_wpRashtrakuta", "wpRashtrakuta", "The successor of Govinda III, Amoghavarsha I made Manyakheta his capital and ruled a large empire.", {"section": "Expansion"});
  x("x_amo_reign", "s_wpAmogha", "wpAmogha", "Amoghavarsha Nrupatunga (c. 800–878), also known as Amoghavarsha I, was the Rashtrakuta emperor from 814 until his death in 878.", {"section": "Lead"});
  x("x_amo_sulaiman", "s_wpAmogha", "wpAmogha", "According to the Arab traveller Sulaiman al-Tajir, Amoghavarsha I's empire was one among the four great contemporary empires of the world.", {"section": "Lead"});
  x("x_amo_kavi", "s_wpAmogha", "wpAmogha", "He wrote (or co-authored) the Kavirajamarga, the earliest extant literary work in Kannada,  and Prashnottara Ratnamalika, a religious work in Sanskrit.", {"section": "Lead"});
  x("x_kai_rock", "s_wpKailasa", "wpKailasa", "Although the rock face slopes downwards from the rear of the temple to the front, archaeologists believe it was sculpted from a single rock.", {"section": "Lead"});
  x("x_kai_krishna", "s_wpKailasa", "wpKailasa", "Most of the excavation of the temple is generally attributed to the eighth century Rashtrakuta king Krishna I (r. c. 756 – 773), with some elements completed later.", {"section": "Lead"});
  x("x_kai_uncertain", "s_wpKailasa", "wpKailasa", "However, the attribution of the temple to Krishna I is not completely certain because these epigraphs are not physically connected to the caves, and do not date Krishnaraja's reign.", {"section": "History"});
  x("x_cho_848", "s_wpChola", "wpChola", "The Chola Empire was founded in 848 CE by Vijayalaya, a descendant of Early Cholas.", {"section": "Imperial Cholas"});
  x("x_cho_ganges", "s_wpChola", "wpChola", "Rajendra I conquered Odisha and Pala dynasty of Bengal and reached the Ganges river in north India.", {"section": "Imperial Cholas"});
  x("x_cho_1025", "s_wpChola", "wpChola", "In 1025, Rajendra Chola launched naval raids on the ports of Srivijaya and against the Burmese kingdom of Pegu.", {"section": "Overseas conquests"});
  x("x_cho_failed", "s_wpChola", "wpChola", "Chola invasion ultimately failed to install direct administration over Srivijaya, since the invasion was short and only meant to plunder the wealth of Srivijaya.", {"section": "Overseas conquests"});
  x("x_cho_1279", "s_wpChola", "wpChola", "But the Cholas remained stable until 1215, and were then absorbed by the Pandyan empire and ceased to exist by 1279.", {"section": "Imperial Cholas"});
  x("x_cho_naval_rr", "s_wpChola", "wpChola", "Rajaraja Chola I launched several naval campaigns that resulted in the capture of Sri Lanka, Maldives and the Malabar Coast.", {"section": "Overseas conquests"});
  x("x_choe_survey", "s_wpCholaEmpire", "wpCholaEmpire", "In 1000, Rajaraja conducted a land survey to effectively marshall his empire's resources.", {"section": "Imperial era"});
  x("x_choe_china", "s_wpCholaEmpire", "wpCholaEmpire", "The power and the prestige the Cholas had among political powers in South, Southeast, and East Asia at its peak is evident in their expeditions to the Ganges, naval raids on cities of the Srivijaya Empire on the island of Sumatra, and their repeated embassies to China.", {"section": "Lead"});
  x("x_choe_1070", "s_wpCholaEmpire", "wpCholaEmpire", "Around 1070, the Cholas began to lose almost all of their overseas territories but the later Cholas (1070–1279) continued to rule portions of southern India.", {"section": "Lead"});
  x("x_choe_mahinda", "s_wpCholaEmpire", "wpCholaEmpire", "Rajendra also completed the conquest of the Rajarata kingdom of Sri Lanka and took the Sinhala king Mahinda V a prisoner; he also conquered Rattapadi—territories of the Rashtrakutas, Chalukya country, Talakkad, and Kolar, where Kolaramma temple still has his portrait statue—in Kannada country.", {"section": "Imperial era"});
  x("x_rr_reign", "s_wpRajaraja", "wpRajaraja", "Rājarāja I (Middle Tamil: Rājarāja Colan; Rājarāja Śōḷa; 3 November 947 – January/February 1014), also known as Rajaraja the Great, was a Chola emperor who reigned from 985 to 1014.", {"section": "Lead"});
  x("x_rr_inherited", "s_wpRajaraja", "wpRajaraja", "When Rajaraja came to power, he inherited a small kingdom centered around the Thanjavur–Tiruchirappalli region, the heart of traditional Chola territory.", {"section": "Military conquests"});
  x("x_rr_lanka", "s_wpRajaraja", "wpRajaraja", "He was known for his conquests of southern India and the Anuradhapura kingdom of Sri Lanka, as well as increasing Chola influence across the Indian Ocean.", {"section": "Lead"});
  x("x_ren_reign", "s_wpRajendra", "wpRajendra", "Rajendra I (26 July 971 – 1044), often referred to as Rajendra the Great, was a Chola Emperor who reigned from 1014 to 1044.", {"section": "Lead"});
  x("x_ren_annexed", "s_wpRajendra", "wpRajendra", "During his South-East Asia campaign, he annexed Srivijaya, Kedah, Tambralinga and Pegu, achieving imperial dominance in the region and strengthening Indian influence in Southeast Asia.", {"section": "Lead"});
  x("x_ren_pala", "s_wpRajendra", "wpRajendra", "Rajendra conducted a war against the Pala dynasty and captured a great deal of wealth, which he used to build the city of Gangaikondacholapuram, the capital of the Chola Empire, and one of the centers of trade and commerce in the empire for several centuries.", {"section": "Lead"});
  x("x_gc_capital", "s_wpGangaikonda", "wpGangaikonda", "The Chola emperor Rajendra I established it as the capital of the Chola dynasty in c. 1025, and it remained the capital for approximately 250 years.", {"section": "Lead"});
  x("x_gc_name", "s_wpGangaikonda", "wpGangaikonda", "The name commemorates Rajendra I's victory, and his expedition to bring water from the Ganges river to establish his new capital.", {"section": "Etymology"});
  x("x_sri_1025", "s_wpSrivijaya", "wpSrivijaya", "In 1025 AD, the Chola Emperor Rajendra I launched naval invasions on Srivijaya in maritime Southeast Asia, leading to the fall of the Sailendra Dynasty of Srivijaya.", {"section": "Lead"});
  x("x_sri_monopoly", "s_wpSrivijaya", "wpSrivijaya", "Srivijaya enforced a naval trade monopoly, compelling ships passing through their waters to stop at their ports or risk being plundered.", {"section": "Background"});
  x("x_sri_sastri", "s_wpSrivijaya", "wpSrivijaya", "Historian Nilakanta Sastri suggested that the conflict may have arisen from Srivijayan attempts to obstruct Chola trade with the East, especially China, or perhaps from Rajendra's desire to extend his digvijaya (world conquest) across the sea, adding prestige to his reign.", {"section": "Background"});
  x("x_sri_geo", "s_wpSrivijaya", "wpSrivijaya", "Another theory posits that geopolitical and diplomatic factors motivated the invasion.", {"section": "Background"});
  x("x_sri_tambralinga", "s_wpSrivijaya", "wpSrivijaya", "In response, the Tambralinga kingdom sought aid from Srivijayan king Sangrama Vijayatunggavarman.", {"section": "Background"});
  x("x_stein_bureau", "s_wpBStein", "wpBStein", "He was skeptical of the existence of a system of bureaucracy in the Chola Dynasty.", {"section": "Research"});
  x("x_stein_book", "s_wpBStein", "wpBStein", "He published his first book, Peasant, State and Society in Medieval South India (1980) with the theme of segmentary lineage.", {"section": "Research"});
  x("x_utt_two", "s_wpUttar", "wpUttar", "They indicate that Uthiramerur had two village assemblies: Sabha and Ur.", {"section": "Village administration"});
  x("x_utt_brahmin", "s_wpUttar", "wpUttar", "The Sabha an exclusively Brahmin (priestly class) assembly, while the Ur was made up of people belonging to all the classes.", {"section": "Village administration"});
  x("x_utt_919", "s_wpUttar", "wpUttar", "The first inscription, dated to 919 CE, describes the rules for electing the committee members.", {"section": "Village administration"});
  x("x_utt_land", "s_wpUttar", "wpUttar", "Ownership of tax-paying land sized at least one-fourth of a veli (about an acre and a half).", {"section": "Village administration"});
  x("x_utt_age", "s_wpUttar", "wpUttar", "Age between 35 and 70 years", {"section": "Village administration"});
  x("x_utt_kudavolai", "s_wpUttar", "wpUttar", "The candidates were selected via Kudavoloi (literally, pot [of] palm leaf [tickets]) system:", {"section": "Village administration"});
  x("x_bri_built", "s_wpBrihad", "wpBrihad", "Built by Chola emperor Rajaraja I between 1003 and 1010 CE, the temple is a part of the UNESCO World Heritage Site known as the \"Great Living Chola Temples\", along with the Chola-era Gangaikonda Cholapuram temple and Airavatesvara temple, which are about 70 kilometres (43 mi) and 40 kilometres (25 mi) to its northeast respectively.", {"section": "Lead"});
  x("x_bri_name", "s_wpBrihad", "wpBrihad", "Rajaraja Chola, who commissioned the temple, called it Rajarajeshvaram (Rajarājeśvaram), literally \"the temple of the god of Rajaraja\".", {"section": "Nomenclature"});
  x("x_bri_vimana", "s_wpBrihad", "wpBrihad", "Built using granite, the vimana tower above the shrine is one of the tallest in South India.", {"section": "Lead"});
  x("x_glct_1987", "s_wpGLCT", "wpGLCT", "The temple at Thanjavur was added in the list in 1987, while the other two temples were added in 2004.", {"section": "Lead"});
  x("x_rss_1965", "s_wpRSSharma", "wpRSSharma", "The publication of his monograph Indian Feudalism in 1965 caused almost a furore in the academia, generating intense debate and sharp responses both in favour of and against the applicability of the model of \"feudalism\" to the Indian situation at any point of time.", {"section": "Theory of Feudalism"});
  x("x_rss_kosambi", "s_wpRSSharma", "wpRSSharma", "The concept of \"feudalism\" was initially used by D. D. Kosambi to analyse the developments in the socio-economic sphere in the late ancient and medieval periods of Indian history.", {"section": "Theory of Feudalism"});
  x("x_rss_urban", "s_wpRSSharma", "wpRSSharma", "Criticism goaded Sharma into reinforcing his thesis by producing another work of fundamental importance, Urban Decay in India (c.300-1000), in which he marshalled an impressive mass of archaeological data to demonstrate the decline of urban centres, a crucial element of his thesis on feudalism.", {"section": "Theory of Feudalism"});
  x("x_feud_term", "s_wpFeud", "wpFeud", "Use of the term feudalism to describe India applies a concept of medieval European origin, according to which the landed nobility held lands from the Crown in exchange for military service, and vassals were in turn tenants of the nobles, while the peasants (villeins or serfs) were obliged to live on their lord's land and give him homage, labor, and a share of the produce, notionally in exchange for military protection.", {"section": "Terminology"});
  x("x_sam_def", "s_wpSamanta", "wpSamanta", "Samanta (Sanskrit: सामंत, IAST: Sāmanta) was a title or position used in the Indian subcontinent primarily from the 4th to the 12th century CE to denote a feudal lord, vassal, or tributary chief.", {"section": "Lead"});
  x("x_sam_feudal", "s_wpSamanta", "wpSamanta", "The institution is considered to be closely associated with the origin and growth of feudalism in ancient and medieval India.", {"section": "Lead"});
  x("x_sam_vassal", "s_wpSamanta", "wpSamanta", "However, the term underwent a change, and came to mean a 'vassal' by the end of the Gupta period and in the post-Gupta period.", {"section": "Early development"});
  x("x_mah_thanesar", "s_wpMahmud", "wpMahmud", "Mahmud reached Thanesar, the local raja fled, the town was plundered without resistance, the famous Chakrasvamin idol was destroyed and carried to Ghazni, where it was thrown into the public square.", {"section": "War against the Hindu Shahis (1000–1027)"});
  x("x_mah_seventeen", "s_wpMahmud", "wpMahmud", "In total, he invaded India seventeen times and plundered the richest cities and temple towns, using the booty to build his capital in Ghazni.", {"section": "Sack of Somnath (1025–26)"});
  x("x_mah_objectives", "s_wpMahmud", "wpMahmud", "His objectives were monetary and religious.", {"section": "War policy"});
  x("x_mah_hindu_troops", "s_wpMahmud", "wpMahmud", "Indian soldiers, who historian Romila Thapar presumed to be Hindus, were one of the components of the army with their commander called sipahsalar-i-Hinduwan and lived in their own quarter of Ghazna practicing their own religion and ceremonies.", {"section": "War policy"});
  x("x_mah_thapar_political", "s_wpMahmud", "wpMahmud", "Thapar asserted that the sack of Somnath was a political act and was perceived by the contemporaries in same manner.", {"section": "War policy"});
  x("x_mah_villain", "s_wpMahmud", "wpMahmud", "For centuries, Mahmud of Ghazni has been seen as a villain by Hindus and as a hero by Muslims.", {"section": "Legacy"});
  x("x_som_1026", "s_wpSomnath", "wpSomnath", "In 1026 CE, during the reign of Bhima I, the Turkic Muslim ruler Mahmud of Ghazni raided the Somnath temple after crossing the Thar desert, desecrated its jyotirlinga, and plundered 20 million dinars, including the temple's and city's gold in caravans to a Friday mosque in Ghazni.", {"section": "Mahmud of Ghazni’s Raid (1026 CE)"});
  x("x_som_1038", "s_wpSomnath", "wpSomnath", "This inscription, states Thapar, could suggest that instead of destruction it may have been a desecration because the temple seems to have been repaired quickly within twelve years and was an active pilgrimage site by 1038.", {"section": "Mahmud of Ghazni’s Raid (1026 CE)"});
  x("x_som_biruni", "s_wpSomnath", "wpSomnath", "The raid of 1026 by  Mahmud is confirmed by the 11th-century Persian historian Al-Biruni, who occasionally accompanied Mahmud's troops between 1017 and 1030 CE and lived intermittently in the northwest Indian subcontinent region.", {"section": "Mahmud of Ghazni’s Raid (1026 CE)"});
  x("x_som_50000", "s_wpSomnath", "wpSomnath", "According to Thapar, the \"50,000 killed\" is a boastful claim that is \"constantly reiterated\" in Muslim texts, and becomes a \"formulaic\" figure of deaths to help highlight \"Mahmud’s legitimacy in the eyes of established Islam\".", {"section": "Mahmud of Ghazni’s Raid (1026 CE)"});
  x("x_som_malik", "s_wpSomnath", "wpSomnath", "It inspired the Persian side with a cultural memory of Somnath's destruction through \"epics of conquest\", while to the Hindu side, Somnath inspired tales of recovery, rebuilding and \"epics of resistance\".", {"section": "Mahmud of Ghazni’s Raid (1026 CE)"});
  x("x_som_1842", "s_wpSomnath", "wpSomnath", "In 1842, Governor-General Lord Ellenborough issued the Proclamation of the Gates, instructing the British army returning from Afghanistan to bring back the sandalwood gates of Somnath temple from the tomb of Mahmud of Ghazni in Ghazni, Afghanistan.", {"section": "British Raj"});
  x("x_mk_regionalism", "s_wpMiddle", "wpMiddle", "From the mid-seventh to the mid-13th centuries, regionalism was the dominant theme of political and dynastic history of the Indian subcontinent.", {"section": "Deccan plateau and the South"});
  x("x_mk_survive", "s_wpMiddle", "wpMiddle", "Third, because of the seesawing of numerous dynasties that had a remarkable ability to survive perennial military attacks, regional kingdoms faced frequent defeats but seldom total annihilation.", {"section": "Deccan plateau and the South"});
  x("x_mk_brahman", "s_wpMiddle", "wpMiddle", "Second was the ascendancy of the Brahman priestly and landowning groups that later dominated regional institutions and political developments.", {"section": "Deccan plateau and the South"});
  x("x_mk_rashtrakuta", "s_wpMiddle", "wpMiddle", "It was the Rashtrakutas who first forged north to the Gangetic plains and successfully contested their might against the Palas of Bengal and the Rajput Prathiharas of Gujarat.", {"section": "Deccan plateau and the South"});
  x("x_kal_date", "s_wpKalhana", "wpKalhana", "He wrote the work in Sanskrit between 1148 and 1149.", {"section": "Lead"});
  x("x_raj_little", "s_wpRajatarangini", "wpRajatarangini", "Despite the value that historians have placed on Kalhana's work, there is little evidence of authenticity in the earlier books of Rajatarangini.", {"section": "Historical reliability"});
  x("x_raj_mihirakula", "s_wpRajatarangini", "wpRajatarangini", "Toramana is clearly the Huna king of that name, but his son Mihirakula is given a date 700 years earlier.", {"section": "Historical reliability"});
  x("x_raj_book4", "s_wpRajatarangini", "wpRajatarangini", "Kalhana's account starts to align with other historical evidence only by Book 4, which gives an account of the Karkota dynasty.", {"section": "Historical reliability"});
  x("x_raj_lalitaditya", "s_wpRajatarangini", "wpRajatarangini", "For example, Kalhana has highly exaggerated the military conquests of Lalitaditya Muktapida.", {"section": "Historical reliability"});
  x("x_alb_1017", "s_wpAlBiruni", "wpAlBiruni", "From 1017 he lived at Ghazni under Mahmud of Ghazni, serving as court astrologer and accompanying Mahmud's campaigns in the Indian subcontinent; the resulting Tārīkh al-Hind, finished around 1030, is the work on which his reputation as an Indologist chiefly rests.", {"section": "Lead"});
  x("x_alb_lang", "s_wpAlBiruni", "wpAlBiruni", "A gifted linguist, in addition to his native Khwarezmian he was conversant in Persian, Arabic and Sanskrit, and also knew Greek, Hebrew and Syriac.", {"section": "Lead"});
  x("x_alb_prisoners", "s_wpAlBiruni", "wpAlBiruni", "Al-Biruni, Abu Nasr Mansur and most other scholars left with the victorious Mahmud, possibly as prisoners, and were brought to Ghazni, the Ghaznavid capital in what is now central-eastern Afghanistan, where al-Biruni spent much of the rest of his life.", {"section": "Ghazni and India"});

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
  const P = { entity: PERIOD, role: "mention" as const };

  // 1. Harṣa
  c("c_harsha_reign", {
    text: "Harṣa ruled from 606 to 647, making Kanyākubja (Kannauj) on the Ganges his capital.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(606), end: ce(647) },
    themes: ["polity"],
    entities: [{ entity: e("harsha") }, { entity: e("kannauj"), role: "place" }, { entity: e("harsha_empire") }],
    foundVia: ["wpHarsha"],
    learning: { prompt: "Who ruled Kannauj from 606 to 647?", answer: "Harṣa." },
  });
  c("c_rajya_murder", {
    text: "Harṣa came to the throne after his elder brother Rājyavardhana was murdered by an enemy king, the king of Gauḍa (Bengal) according to Bāṇa; Xuanzang says Harṣa took the title Śīlāditya.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harsha") }, { entity: e("bana"), role: "mention" }, { entity: e("xuanzang"), role: "mention" }],
  });
  c("c_rajyasri", {
    text: "Bāṇa's story has Harṣa rescue his widowed sister Rājyaśrī, who had escaped from prison into the Vindhya forest, from the pyre she was about to climb.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The story as the translators summarise it; Bāṇa told it to honour his patron.",
    themes: ["society", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harsha") }, { entity: e("bana"), role: "mention" }],
  });
  c("c_bana_praise", {
    text: "Bāṇa's Harṣacarita is a court poet's praise of his patron: one character declares that “no reign has been stainless except that of this Harsa”, and the story breaks off unfinished.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["sources", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("bana") }, { entity: e("harsha"), role: "mention" }],
    foundVia: ["wpHarsha"],
  });
  c("c_six_years", {
    text: "Xuanzang, Harṣa's guest in the 640s, wrote that he campaigned for six years with 5,000 elephants, 2,000 cavalry and 50,000 foot, “the elephants were not unharnessed”, and then governed in peace for thirty years.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "A grateful guest's account, written for a Buddhist audience.",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harsha") }, { entity: e("xuanzang"), role: "participant" }],
  });
  c("c_harsha_charity", {
    text: "Xuanzang says Harṣa built hospices with food, drink and physicians on the roads, and held a great assembly of gifts every five years; he also describes a 21-day religious festival at Kannauj.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harsha") }, { entity: e("xuanzang"), role: "mention" }, { entity: e("kannauj"), role: "place" }],
    foundVia: ["wpHarsha"],
  });
  c("c_pulakesi_checks", {
    text: "Xuanzang reports that the people of Mahārāṣṭra, under their king Pulakeśin, alone had not submitted to Harṣa, who had led the troops of the five Indies against them and “has not yet conquered their troops”.",
    kind: "fact",
    assessment: "supported",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("pulakeshin") }, { entity: e("harsha"), role: "participant" }, { entity: e("chalukya") }, { entity: e("xuanzang"), role: "mention" }],
    learning: { prompt: "Which king did Harṣa fail to conquer, according to Xuanzang?", answer: "Pulakeśin, king of Mahārāṣṭra." },
  });
  c("c_aihole_harsha", {
    text: "Pulakeśin II's Aihole inscription, dated Śaka 556 (634–635 CE), boasts that through him Harṣa “had his mirth (harsha) melted away by fear”, with his war elephants fallen in battle.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(634), end: ce(635), basis: "Śaka 556 expired (Kielhorn)" },
    themes: ["war", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("aihole"), role: "place" }, { entity: e("pulakeshin") }, { entity: e("harsha"), role: "participant" }],
    foundVia: ["wpPulakeshin"],
  });
  c("c_narmada_date", {
    text: "The battle was fought on the Narmadā, which then became the border between the two kingdoms; one recent dating puts it in the winter of 618–619, earlier than the Aihole inscription that records it.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "Neither Xuanzang nor the inscription dates the battle; the 618–619 date and the treaty come from modern studies reported by Wikipedia.",
    when: { start: ce(618, true, true), end: ce(619, true, true) },
    themes: ["war", "historiography"],
    entities: [{ entity: e("harsha") }, { entity: e("pulakeshin") }],
    foundVia: ["wpHarsha"],
  });
  c("c_ravikirti", {
    text: "The Aihole poem's author, the Jain Ravikīrti, built the temple it is carved on and claimed to have reached “the fame of Kalidasa and of Bharavi”; its editor Kielhorn called that “surely an exaggeration”, though he thought Ravikīrti a first-rank court poet.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["culture", "religion"],
    lenses: ["primary_source", "philological"],
    entities: [{ entity: e("aihole"), role: "place" }, { entity: "prashasti", role: "mention" }],
    foundVia: ["wpPulakeshin"],
  });
  c("c_raghu_600", {
    text: "Because Ravikīrti echoes Kālidāsa's Raghuvaṃśa, Kielhorn concluded that the poem was well known across India by about 600 CE, a firm latest date for Kālidāsa.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["culture", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: "kalidasa", role: "mention" }, { entity: e("aihole"), role: "mention" }],
  });

  // 2. Chalukyas and Pallavas
  c("c_badami", {
    text: "The Chalukyas ruled the Deccan from Vātāpi (Badami) from the middle of the sixth century; under Pulakeśin II (c. 609–642) their kingdom covered most of the Deccan.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(550, true), end: ce(757, true) },
    themes: ["polity"],
    entities: [{ entity: e("chalukya") }, { entity: e("vatapi"), role: "place" }, { entity: e("pulakeshin"), role: "participant" }],
    foundVia: ["wpChalukya", "wpPulakeshin"],
  });
  c("c_pul_wars", {
    text: "The Aihole poem says Pulakeśin besieged Purī on the western sea “with hundreds of ships”, won lordship over “the three Maharashtrakas”, and drove the Pallava king behind the walls of Kāñcī.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "A praise poem's claims.",
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("pulakeshin") }, { entity: e("pallava"), role: "participant" }, { entity: e("kanchi"), role: "place" }],
  });
  c("c_kanchi", {
    text: "The Pallavas ruled the Tamil north from Kāñcī (Kanchipuram), their ancient capital, and were constantly at war with the Chalukyas to the north and the Cholas and Pandyas to the south.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("pallava") }, { entity: e("kanchi"), role: "place" }, { entity: e("chalukya"), role: "mention" }],
    foundVia: ["wpPallava"],
  });
  c("c_vatapi_642", {
    text: "The Pallava king Narasiṃhavarman I took the Chalukya capital: Pallava grants praise him as the king “who destroyed (the city of) Vatapi”, and Pulakeśin II was killed, around 642.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(642, true) },
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("narasimhavarman") }, { entity: e("vatapi"), role: "place" }, { entity: e("pulakeshin"), role: "participant" }],
    foundVia: ["wpNarasimha"],
    learning: { prompt: "Who destroyed the Chalukya capital Vātāpi, and when?", answer: "The Pallava king Narasiṃhavarman I, around 642." },
  });
  c("c_mamallapuram", {
    text: "Narasiṃhavarman I's title Mamalla, “great wrestler”, gave its name to Mamallapuram, where the Pallavas' Shore Temple stands.",
    kind: "fact",
    assessment: "supported",
    themes: ["culture", "religion"],
    entities: [{ entity: e("mamallapuram"), role: "place" }, { entity: e("narasimhavarman") }],
    foundVia: ["wpNarasimha", "wpPallava"],
  });
  c("c_rashtra_753", {
    text: "In 753 the Rāṣṭrakūṭa Dantidurga, a subordinate of the Chalukyas, defeated their army and took their northern lands; the Rāṣṭrakūṭas then ruled the Deccan until Chalukya descendants revived in the late tenth century.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(753) },
    themes: ["war", "polity"],
    entities: [{ entity: e("rashtrakuta") }, { entity: e("chalukya"), role: "participant" }, { entity: e("wchalukya"), role: "mention" }],
    foundVia: ["wpRashtrakuta", "wpChalukya"],
  });

  // 3. Kannauj
  c("c_gopala", {
    text: "The Pāla dynasty of Bengal began when, as a Pāla grant puts it, Gopāla was made king by the people “to put an end to lawlessness and disorder”, in the late eighth century.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(750, true, true) },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("pala") }],
    foundVia: ["wpPala"],
  });
  c("c_dharmapala_kanauj", {
    text: "Pāla grants say Gopāla's son Dharmapāla installed a king of Kanyākubja “with the ready approval” of the kings of the north and west; Kielhorn dated this to the early or middle ninth century.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The Pālas' own claim. Kielhorn's dating has since been revised: modern accounts place the Kannauj wars c. 785–816.",
    themes: ["polity", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("dharmapala") }, { entity: e("pala") }, { entity: e("kannauj"), role: "place" }],
  });
  c("c_tripartite", {
    text: "Kannauj became the prize of a long three-sided struggle between the Gurjara-Pratihāras, the Pālas and the Rāṣṭrakūṭas; in 816 the Pratihāra Nāgabhaṭa II won it.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(785, true), end: ce(816) },
    themes: ["war", "polity"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("kannauj"), role: "place" }, { entity: e("pratihara") }, { entity: e("pala") }, { entity: e("rashtrakuta") }, { entity: e("nagabhata"), role: "participant" }],
    foundVia: ["wpTripartite"],
    learning: { prompt: "Which three dynasties fought over Kannauj in the eighth and ninth centuries?", answer: "The Gurjara-Pratihāras, the Pālas and the Rāṣṭrakūṭas." },
  });
  c("c_pratihara_arabs", {
    text: "The Pratihāras held the Arab armies west of the Indus. The merchant Sulaimān (851) wrote of their king that “no other Indian prince has so fine a cavalry” and there was “no greater foe of the Muhammadan faith”.",
    kind: "fact",
    assessment: "supported",
    themes: ["war"],
    lenses: ["primary_source"],
    assessmentNote: "Identifying Sulaimān's “Jurz” with the Gurjara-Pratihāras is a modern inference.",
    entities: [{ entity: e("pratihara") }, { entity: e("sulaiman"), role: "mention" }],
    foundVia: ["wpPratihara"],
  });
  c("c_balhara", {
    text: "Sulaimān called the Balharā, the Rāṣṭrakūṭa king, “the most eminent of the princes of India”, and the king most friendly to the Arabs.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Quoted in Elliot's English version of Reinaud's French translation.",
    when: { start: ce(851), basis: "Sulaimān's account is dated 237 AH, 851 CE" },
    themes: ["polity", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rashtrakuta") }, { entity: e("sulaiman"), role: "participant" }, { entity: e("t_balhara"), role: "mention" }],
    foundVia: ["wpAmogha"],
    learning: { prompt: "Whom did the Arab merchant Sulaimān call “the most eminent of the princes of India”?", answer: "The Balharā: the Rāṣṭrakūṭa king." },
  });
  c("c_ruhmi", {
    text: "Sulaimān also describes a kingdom he calls Ruhmī, at war with the Pratihāras, whose king went to battle with 50,000 elephants and whose trade used cowrie shells as money.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Which kingdom Ruhmī was is not certain; the elephant figure is hearsay.",
    themes: ["economy", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("pala"), role: "mention" }, { entity: e("sulaiman"), role: "mention" }],
  });
  c("c_amogha", {
    text: "The Rāṣṭrakūṭa Amoghavarṣa I (814–878) ruled from Mānyakheṭa and wrote, or helped to write, the Kavirājamārga, the earliest surviving work in Kannada.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(814), end: ce(878) },
    themes: ["culture", "polity"],
    entities: [{ entity: e("amoghavarsha") }, { entity: e("rashtrakuta") }],
    foundVia: ["wpAmogha", "wpRashtrakuta"],
  });
  c("c_kailasa", {
    text: "The Kailāsa temple at Ellora was carved out of a single rock; most of the work is generally attributed to the Rāṣṭrakūṭa king Kṛṣṇa I (c. 756–773), though the attribution is not certain.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(756, true), end: ce(773, true) },
    themes: ["culture", "religion", "technology"],
    lenses: ["archaeological"],
    entities: [{ entity: e("kailasa"), role: "place" }, { entity: e("rashtrakuta") }],
    foundVia: ["wpKailasa"],
  });
  c("c_pala_buddhism", {
    text: "The Pālas built Buddhist monasteries and supported the great centres of learning at Nālandā and Vikramaśilā; yet most of their images and inscriptions also show patronage of brahmans and of Śiva and Viṣṇu.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["religion", "culture"],
    entities: [{ entity: e("pala") }, { entity: "nalanda", role: "mention" }],
    foundVia: ["wpPala"],
  });
  c("c_kannauj_916", {
    text: "The Rāṣṭrakūṭas carried their wars to the Ganges: about 916 Indra III sacked Kannauj, weakening the Pratihāras.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(916, true) },
    themes: ["war"],
    entities: [{ entity: e("rashtrakuta") }, { entity: e("pratihara"), role: "participant" }, { entity: e("kannauj"), role: "place" }],
    foundVia: ["wpPratihara", "wpMiddle"],
  });
  c("c_regionalism", {
    text: "Historians describe the period from the mid-seventh to the mid-thirteenth century as one of regional kingdoms: dynasties rose and fell, often defeated but seldom wiped out.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: PERIOD }],
    foundVia: ["wpMiddle"],
  });

  // 4. Rājarāja and Thanjavur
  c("c_chola_rise", {
    text: "The imperial Chola line began with Vijayālaya in 848; when Rājarāja I came to power in 985 he inherited a small kingdom around Thanjavur and Tiruchirappalli, and ruled until 1014.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(848), end: ce(1014) },
    themes: ["polity"],
    entities: [{ entity: e("chola") }, { entity: e("rajaraja"), role: "participant" }],
    foundVia: ["wpChola", "wpRajaraja"],
  });
  c("c_rr_conquests", {
    text: "Rājarāja's inscriptions open with a list of his conquests: the ships at Kandalūr, Vengi, Gangapādi, Kollam, Kalinga, Ceylon and “twelve thousand ancient islands of the sea”.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The king's own claims, in the fixed historical introduction of his records; modern accounts accept his conquest of Sri Lanka and the Maldives.",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rajaraja") }, { entity: e("t_meykirtti"), role: "mention" }],
    foundVia: ["wpRajaraja"],
  });
  c("c_rr_temple", {
    text: "Rājarāja built the great temple at Thanjavur, which he called Rājarājeśvara, between 1003 and 1010; an order of his twenty-sixth year protects the gifts made to it by himself, his elder sister, his queens and others.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1003), end: ce(1010) },
    themes: ["religion", "culture", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("thanjavur_temple"), role: "place" }, { entity: e("rajaraja") }, { entity: e("kundavai"), role: "mention" }],
    foundVia: ["wpBrihad"],
    learning: { prompt: "Who built the great temple at Thanjavur, and what did he call it?", answer: "Rājarāja I, who called it Rājarājeśvara; it was built between 1003 and 1010." },
  });
  c("c_regnal_years", {
    text: "Chola inscriptions are dated by the year of the king's reign, not by an era: “the twentieth day of the twenty-sixth year” of Rājarāja. Modern dates for the Chola kings are worked out from astronomical details and their last known regnal years.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources"],
    lenses: ["primary_source", "philological"],
    entities: [{ entity: e("chola") }, { entity: e("t_regnal"), role: "mention" }],
  });
  c("c_temple_women", {
    text: "The temple's records show 400 women, evidently dancers, transferred to it from other temples of the Chola country.",
    kind: "fact",
    assessment: "supported",
    themes: ["society", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("thanjavur_temple"), role: "place" }],
  });
  c("c_kundavai", {
    text: "Rājarāja's elder sister Kundavai was a donor in her own right: she gave to the Thanjavur temple, and a Jain shrine at Tirumalai seems to have been founded by her.",
    kind: "fact",
    assessment: "supported",
    themes: ["society", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("kundavai") }, { entity: e("thanjavur_temple"), role: "mention" }],
  });
  c("c_tower", {
    text: "The granite tower (vimāna) over the shrine, about 200 feet high, is one of the tallest in south India; the temple has been a UNESCO World Heritage Site since 1987.",
    kind: "fact",
    assessment: "supported",
    themes: ["technology", "culture"],
    entities: [{ entity: e("thanjavur_temple"), role: "place" }, { entity: e("t_vimana"), role: "mention" }],
    foundVia: ["wpBrihad", "wpGLCT"],
  });
  c("c_ramp", {
    text: "A tradition, reported by S. K. Aiyangar in 1911, says the capstone was hauled to the top of the tower up an incline that began four miles away.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "A tradition, not documented by any inscription quoted here.",
    themes: ["technology"],
    entities: [{ entity: e("thanjavur_temple"), role: "place" }],
  });
  c("c_survey", {
    text: "Around 1000 Rājarāja had a survey of land made, to assess the kingdom's resources.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1000, true) },
    themes: ["governance", "economy"],
    entities: [{ entity: e("rajaraja") }, { entity: e("chola") }],
    foundVia: ["wpCholaEmpire"],
  });

  // 5. Rājendra
  c("c_rajendra", {
    text: "Rājaraja's son Rājendra I reigned from 1014 to 1044; Hultzsch, from an inscription of his thirteenth year, dated his accession to 1012, when he seems to have shared power with his father.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1014), end: ce(1044) },
    themes: ["polity", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rajendra") }, { entity: e("chola") }],
    foundVia: ["wpRajendra"],
  });
  c("c_ganges", {
    text: "Rājendra's armies went north to the Ganges and defeated the Pāla king Mahīpāla I; he built a new capital, Gangaikonda Cholapuram, named after that victory, about 1025.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1022, true), end: ce(1025, true) },
    themes: ["war", "infrastructure"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rajendra") }, { entity: e("pala"), role: "participant" }, { entity: e("gangaikonda"), role: "place" }],
    foundVia: ["wpGangaikonda", "wpChola"],
    learning: { prompt: "What does the name Gangaikonda Cholapuram commemorate?", answer: "Rājendra I's expedition to the Ganges." },
  });
  c("c_kadaram", {
    text: "Rājendra's inscriptions say he “despatched many ships in the midst of the rolling sea”, caught Saṅgrāmavijayottuṅgavarman, king of Kaḍāram, and took his heaped-up treasure, listing places that included Śrīviśaya, Malaiyūr and Kaḍāram “protected by the neighbouring sea”.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1025, true) },
    themes: ["war", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rajendra") }, { entity: e("srivijaya"), role: "participant" }, { entity: e("kadaram"), role: "place" }],
    foundVia: ["wpSrivijaya", "wpChola"],
    learning: { prompt: "What do Rājendra I's inscriptions say his fleet did?", answer: "He “despatched many ships in the midst of the rolling sea” and caught the king of Kaḍāram." },
  });
  c("c_kadaram_where", {
    text: "Where Kaḍāram was took scholars time: in 1892 Hultzsch placed it in the Madura district of south India, but later accepted that an expedition by sea must have gone overseas; Śrīviśaya was the country ruled by the king of Kaṭāha or Kaḍāram.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("hultzsch") }, { entity: e("kadaram"), role: "mention" }, { entity: e("srivijaya"), role: "mention" }],
  });
  c("c_motives", {
    text: "Why Rājendra attacked Śrīvijaya is debated: Śrīvijaya forced passing ships into its ports, and Nilakanta Sastri suggested a quarrel over Chola trade with China, or a wish to carry his digvijaya across the sea; others stress diplomacy and the politics of mainland South-East Asia.",
    kind: "debate",
    assessment: "contested",
    themes: ["economy", "war", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("rajendra") }, { entity: e("srivijaya") }, { entity: e("t_digvijaya"), role: "mention" }],
    foundVia: ["wpSrivijaya"],
  });
  c("c_raid", {
    text: "The expedition did not bring lasting Chola rule over Śrīvijaya: it was short and aimed at plunder, and by about 1070 the Cholas had lost almost all their overseas territories.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["war", "polity"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("chola") }, { entity: e("srivijaya"), role: "mention" }],
    foundVia: ["wpChola", "wpCholaEmpire"],
  });
  c("c_ceylon", {
    text: "Rājendra also completed the conquest of Sri Lanka's northern kingdom: his inscription boasts of taking the crowns of its king and queens, and the king, Mahinda V, was made a prisoner.",
    kind: "fact",
    assessment: "supported",
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rajendra") }],
    foundVia: ["wpCholaEmpire"],
  });
  c("c_china", {
    text: "The Cholas sent repeated embassies to China.",
    kind: "fact",
    assessment: "supported",
    themes: ["economy", "polity"],
    entities: [{ entity: e("chola") }],
    foundVia: ["wpCholaEmpire"],
  });
  c("c_chola_end", {
    text: "The Chola kingdom held together until about 1215, then was absorbed by the Pandyas and ceased to exist by 1279.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1215, true), end: ce(1279) },
    themes: ["polity"],
    entities: [{ entity: e("chola") }],
    foundVia: ["wpChola"],
  });

  // 6. Villages
  c("c_uttar_lots", {
    text: "Two inscriptions of Parāntaka I's twelfth and fourteenth years at Uttaramerūr, the first dated 919 CE, record a royal order that the village assembly's committees be chosen “invariably… (by drawing) pot-tickets”, one ticket per qualified man in each of thirty wards.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(919), basis: "Parāntaka I's 12th year; 919 CE per Wikipedia" },
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("uttaramerur"), role: "place" }, { entity: e("chola") }, { entity: e("t_kudavolai"), role: "mention" }],
    foundVia: ["wpUttar"],
    learning: { prompt: "How did the assembly at Uttaramerūr choose its committees?", answer: "By lot: a boy drew palm-leaf tickets (kuḍavōlai) from a pot, one per qualified man in each ward." },
  });
  c("c_uttar_quals", {
    text: "To be named on a ticket, a man had to own more than a quarter veli of tax-paying land, live in a house on his own site, be between 35 and 70, and know a Vedic text, the Mantrabrāhmaṇa, well enough to teach it.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["governance", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("uttaramerur"), role: "place" }, { entity: e("t_sabha"), role: "mention" }],
    foundVia: ["wpUttar"],
  });
  c("c_uttar_accounts", {
    text: "Anyone who had sat on a committee without submitting his accounts was barred from the tickets, together with his relations.",
    kind: "fact",
    assessment: "supported",
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("uttaramerur"), role: "place" }],
  });
  c("c_uttar_boy", {
    text: "The draw took place before a full meeting of the great assembly, young and old, and a young boy who could not read the tickets drew them from the pot.",
    kind: "fact",
    assessment: "supported",
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("uttaramerur"), role: "place" }, { entity: e("t_kudavolai"), role: "mention" }],
  });
  c("c_sabha_brahmin", {
    text: "Uttaramerūr had two assemblies: the sabhā, an exclusively Brahmin body, which these rules concern, and the ūr, open to all classes.",
    kind: "fact",
    assessment: "supported",
    themes: ["governance", "society"],
    entities: [{ entity: e("uttaramerur"), role: "place" }, { entity: e("t_sabha"), role: "mention" }],
    foundVia: ["wpUttar"],
  });
  c("c_stein_segmentary", {
    text: "The historian Burton Stein doubted that the Chola state had a central bureaucracy, and described medieval south India as a “segmentary” state in Peasant, State and Society in Medieval South India (1980).",
    kind: "interpretation",
    assessment: "contested",
    themes: ["governance", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("bstein") }, { entity: e("chola"), role: "mention" }],
    foundVia: ["wpBStein"],
  });

  // 7. Feudalism
  c("c_samanta", {
    text: "The word sāmanta, once “neighbour”, came by the end of the Gupta period to mean a vassal or subordinate lord, and the institution is closely tied to the idea of an Indian feudalism.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "society"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("t_samanta") }],
    foundVia: ["wpSamanta"],
  });
  c("c_sharma", {
    text: "R. S. Sharma's Indian Feudalism (1965), building on D. D. Kosambi, argued that early medieval India became feudal; it “caused almost a furore”, and against his critics he wrote Urban Decay in India (c. 300–1000) to show that towns declined.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["historiography", "economy", "society"],
    lenses: ["marxist"],
    entities: [{ entity: e("rssharma") }, { entity: e("t_feudalism"), role: "mention" }],
    foundVia: ["wpRSSharma"],
  });
  c("c_feud_term", {
    text: "Calling India feudal applies a European idea of lords holding land from a king for military service and peasants bound to their lord's land; whether it fits is the heart of the debate.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("t_feudalism") }],
    foundVia: ["wpFeud"],
  });
  c("c_pala_samantas", {
    text: "The Pāla kingdom was weakened by its heavy dependence on its sāmantas, exposed by a rebellion in the eleventh century, and the Senas replaced it in the twelfth.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity"],
    entities: [{ entity: e("pala") }, { entity: e("t_samanta"), role: "mention" }],
    foundVia: ["wpPala"],
  });

  // 8. Mahmud
  c("c_mahmud_raids", {
    text: "Mahmud of Ghazni raided India again and again, by tradition seventeen times, over “a period of thirty years and more”, plundering rich cities and temple towns; his court historian ʿUtbī says he vowed a holy war against Hind every year.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1000, true), end: ce(1027) },
    themes: ["war", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mahmud") }, { entity: e("ghaznavids") }],
    foundVia: ["wpMahmud"],
    learning: { prompt: "Over how long did Mahmud of Ghazni raid India?", answer: "Over “a period of thirty years and more”; by tradition seventeen times." },
  });
  c("c_thanesar_kannauj", {
    text: "Mahmud plundered Thanesar and carried its Cakrasvāmin image to Ghazni; in 1018 the Pratihāra king of Kannauj, Rājyapāla, surrendered to him.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1014, true), end: ce(1018) },
    themes: ["war", "religion"],
    entities: [{ entity: e("mahmud") }, { entity: e("pratihara"), role: "participant" }, { entity: e("kannauj"), role: "place" }],
    foundVia: ["wpMahmud", "wpPratihara"],
  });
  c("c_somnath", {
    text: "Alberuni, who lived at Mahmud's court, records that the image at Somnāth was destroyed by Mahmud in A.H. 416 (1025–26): its upper part broken, the rest carried to Ghazni, and a piece laid before the mosque door for people to clean their feet on.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1026), basis: "A.H. 416 (Alberuni); 1026 CE in modern accounts" },
    themes: ["war", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("somnath"), role: "place" }, { entity: e("mahmud") }, { entity: e("albiruni"), role: "mention" }, { entity: e("ghazni"), role: "mention" }],
    foundVia: ["wpSomnath"],
    learning: { prompt: "Which writer of Mahmud's own time recorded the destruction of the Somnāth image?", answer: "Alberuni (al-Bīrūnī), who at times travelled with Mahmud's troops." },
  });
  c("c_ibnasir", {
    text: "The fuller story of a “dreadful slaughter” at the temple gate comes from Ibn al-Athīr, born in 1160, writing about two centuries later; ʿUtbī's contemporary history ends before Somnāth, and the chroniclers do not even agree on the year.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["sources", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("somnath"), role: "mention" }, { entity: e("mahmud"), role: "mention" }],
  });
  c("c_alberuni_ruin", {
    text: "Alberuni wrote that Mahmud “utterly ruined the prosperity of the country”, leaving the Hindus “like atoms of dust scattered in all directions” and full of aversion to Muslims, and that Hindu learning had fled to Kashmir and Benares.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Alberuni wrote under Mahmud's successor; his translator noted that he mentions the dead king “cold, cold in the extreme”.",
    themes: ["war", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("albiruni") }, { entity: e("mahmud"), role: "mention" }],
    foundVia: ["wpAlBiruni"],
  });
  c("c_albiruni_life", {
    text: "Alberuni had come to Ghazni with Mahmud's victorious army, possibly as a prisoner, lived there from 1017, learned Sanskrit and finished his book on India about 1030.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources", "culture"],
    entities: [{ entity: e("albiruni") }, { entity: e("ghazni"), role: "place" }],
    foundVia: ["wpAlBiruni"],
  });
  c("c_mahmud_motives", {
    text: "Historians read Mahmud's aims as both monetary and religious: Indian, probably Hindu, soldiers served in his army under their own commander, and Romila Thapar has argued that the sack of Somnāth was a political act and was seen as one at the time.",
    kind: "debate",
    assessment: "contested",
    themes: ["war", "religion", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("mahmud") }, { entity: e("somnath"), role: "mention" }],
    foundVia: ["wpMahmud"],
  });
  c("c_somnath_repaired", {
    text: "Thapar points out that the temple seems to have been repaired quickly and was an active place of pilgrimage by 1038, and that the “50,000 killed” of the Persian texts is a formulaic boast meant to show Mahmud's legitimacy.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: ce(1038), basis: "An inscription of 1038 (Thapar 2005, via Wikipedia)" },
    themes: ["historiography", "religion"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("somnath"), role: "place" }],
    foundVia: ["wpSomnath"],
  });
  c("c_somnath_memory", {
    text: "Somnāth became a memory used by many: Persian “epics of conquest” and Hindu “epics of resistance”, Mahmud a hero to some and a villain to others, and in 1842 a British governor-general ordered the “gates of Somnath” brought back from Ghazni.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1842), basis: "The Proclamation of the Gates" },
    themes: ["historiography", "religion"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("somnath"), role: "mention" }, { entity: e("mahmud"), role: "mention" }],
    foundVia: ["wpSomnath", "wpMahmud"],
  });
  c("c_elliot_agenda", {
    text: "The standard English translations of these chronicles were made with a purpose: Elliot hoped they would make Indians “more sensible of the immense advantages accruing to them under the mildness and… equity of our rule”.",
    kind: "fact",
    assessment: "supported",
    themes: ["historiography", "sources"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("elliot") }],
    learning: { prompt: "What did H. M. Elliot hope his translations of the chronicles would do?", answer: "Make Indians “more sensible of the immense advantages accruing to them under the mildness and… equity of our rule”." },
  });
  c("c_elliot_reinaud", {
    text: "Elliot's version of Sulaimān is itself a translation of a translation, made from M. Reinaud's French.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources"],
    lenses: ["philological"],
    entities: [{ entity: e("elliot") }, { entity: e("sulaiman"), role: "mention" }],
  });

  // 9. How we know: Kalhaṇa and others
  c("c_kalhana_method", {
    text: "Kalhaṇa, writing his Rājataraṅgiṇī in 1148–49, says he read “eleven works of former scholars” and checked them against temple and grant inscriptions, and that a historian should be free of love or hatred, “like that of a judge”.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1148), end: ce(1149) },
    themes: ["sources", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("kalhana") }],
    foundVia: ["wpKalhana"],
  });
  c("c_kalhana_legend", {
    text: "Yet the early books of the Rājataraṅgiṇī are legend: Stein judged the narrative “more and more legendary” before the ninth century, Kalhaṇa dates Mihirakula some 700 years too early, and his account matches other evidence only from the Kārkoṭa dynasty on.",
    kind: "interpretation",
    assessment: "well_supported",
    themes: ["sources", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("kalhana") }, { entity: "mihirakula", role: "mention" }],
    foundVia: ["wpRajatarangini"],
    learning: { prompt: "From when does Kalhaṇa's account match other evidence?", answer: "Only from the Kārkoṭa dynasty on; the early books are legend." },
  });

  // Misconceptions
  c("m_chola_sea_empire", {
    text: "The Cholas ruled an empire in South-East Asia.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "Rājendra I's fleet raided Śrīvijaya's ports about 1025 and captured its king, but it did not install Chola rule; by about 1070 the Cholas had lost their overseas holdings.",
    themes: ["war", "polity"],
    lenses: ["popular"],
    entities: [{ entity: e("chola") }],
  });
  c("m_village_democracy", {
    text: "Chola villages were democracies in which every villager voted.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "The Uttaramerūr rules are remarkable, but they concern a Brahmin assembly; candidates had to own land and know the Veda; and committees were chosen by lot, not by vote.",
    themes: ["governance"],
    lenses: ["popular"],
    entities: [{ entity: e("uttaramerur"), role: "mention" }],
  });
  c("m_dark_age", {
    text: "After the Guptas India fell into a dark age of decline.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "The period produced the Kailāsa temple, the Thanjavur temple, Nālandā and Vikramaśilā, the first Kannada literature and long-lived regional kingdoms. Whether towns and trade declined in parts of the north is a real debate (R. S. Sharma), but “dark age” is not a historians' description.",
    themes: ["historiography"],
    lenses: ["popular"],
    entities: [{ entity: PERIOD }],
  });
  c("m_rajatarangini", {
    text: "Kalhaṇa's Rājataraṅgiṇī is a reliable history of Kashmir from its first book.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "Kalhaṇa's method was careful for his time, but his early books are legendary and their dates impossible.",
    themes: ["sources"],
    lenses: ["popular"],
    entities: [{ entity: e("kalhana") }],
  });
  c("m_mahmud_one_motive", {
    text: "Mahmud of Ghazni's raids had a single motive, either purely religious or purely for plunder.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "His own court historians present holy war; his army included Indian soldiers; he carried off enormous wealth. Historians weigh religion, money and politics together.",
    themes: ["war", "religion", "historiography"],
    lenses: ["popular"],
    entities: [{ entity: e("mahmud") }],
  });

  // ------------------------------------------------------------ citations
  const cite = (claim: string, excerpt: string, stance: "supports" | "contradicts" | "qualifies" | "mentions" = "supports", note?: string) =>
    ops.push({ op: "cite", claim: `@${claim}`, excerpt: `@${excerpt}`, stance, ...(note ? { note } : {}) });
  const cites = (claim: string, ...excerpts: string[]) => excerpts.forEach((x) => cite(claim, x));

  cites("c_harsha_reign", "x_harsha_reign", "x_harsha_capital", "x_beal_thirty");
  cites("c_rajya_murder", "x_harsa_assassinated", "x_harsa_throne", "x_beal_rajya_murdered", "x_beal_conference", "x_beal_siladitya_title");
  cites("c_rajyasri", "x_harsa_vindhya", "x_harsa_rescue");
  cites("c_bana_praise", "x_harsa_stainless", "x_harsa_spotless_note", "x_harsa_favourite", "x_harsa_unfinished", "x_harsha_bana");
  cites("c_six_years", "x_beal_unharnessed", "x_beal_army", "x_beal_thirty");
  cites("c_harsha_charity", "x_beal_hospices", "x_beal_moksha", "x_harsha_festival");
  cites("c_pulakesi_checks", "x_beal_pulakesi_name", "x_beal_not_submitted", "x_beal_not_conquered", "x_beal_note_pulikesi", "x_pul_harsha");
  cites("c_aihole_harsha", "x_ei6_harsha", "x_ei6_date", "x_harsha_narmada");
  cites("c_narmada_date", "x_harsha_618", "x_harsha_treaty");
  cite("c_narmada_date", "x_ei6_date", "qualifies", "The inscription that records the victory is dated 634–35.");
  cites("c_ravikirti", "x_ei6_ravikirti_jina", "x_ei6_kalidasa", "x_ei6_kielhorn_exagg", "x_pul_ravikirti");
  cites("c_raghu_600", "x_ei6_kielhorn_raghu");
  cites("c_badami", "x_chal_badami", "x_ei6_vatapi", "x_pul_reign", "x_pul_deccan", "x_chal_empires");
  cites("c_pul_wars", "x_ei6_ships", "x_ei6_three_mahar", "x_ei6_pallava");
  cites("c_kanchi", "x_sii_kanchi", "x_pal_kanchi", "x_pal_conflict", "x_ei6_pallava");
  cites("c_vatapi_642", "x_sii_vatapi", "x_sii1_pulakesin", "x_nar_vatapi", "x_pul_pallava");
  cites("c_mamallapuram", "x_nar_mamalla", "x_pal_shore");
  cites("c_rashtra_753", "x_ras_753", "x_chal_rashtrakuta");
  cites("c_gopala", "x_ki_gopala", "x_pala_gopala");
  cites("c_dharmapala_kanauj", "x_ki_dharmapala_kanauj", "x_ki_chakrayudha", "x_ki_ninth");
  cite("c_dharmapala_kanauj", "x_tri_def", "qualifies", "Modern dating of the Kannauj wars, 785–816.");
  cites("c_tripartite", "x_tri_def", "x_tri_three", "x_tri_816", "x_tri_harsha", "x_ki_dharmapala_kanauj");
  cites("c_pratihara_arabs", "x_pra_arab", "x_pra_nagabhata1", "x_ed_jurz_cavalry", "x_ed_jurz_foe");
  cites("c_balhara", "x_ed_balhara_eminent", "x_ed_balhara_arabs", "x_ed_balhara_title", "x_ed_sulaiman_851", "x_amo_sulaiman");
  cites("c_ruhmi", "x_ed_ruhmi", "x_ed_ruhmi_elephants", "x_ed_kauris");
  cites("c_amogha", "x_amo_reign", "x_ras_manyakheta", "x_amo_kavi", "x_ras_extent");
  cites("c_kailasa", "x_kai_rock", "x_kai_krishna");
  cite("c_kailasa", "x_kai_uncertain", "qualifies");
  cites("c_pala_buddhism", "x_pala_vihara", "x_pala_brahmans", "x_pala_zenith", "x_ki_pataliputra");
  cites("c_kannauj_916", "x_pra_916", "x_mk_rashtrakuta", "x_pra_bhoja");
  cites("c_regionalism", "x_mk_regionalism", "x_mk_survive", "x_mk_brahman");
  cites("c_chola_rise", "x_cho_848", "x_rr_reign", "x_rr_inherited");
  cites("c_rr_conquests", "x_sii_rr_conquests", "x_sii_rr_islands", "x_rr_lanka", "x_cho_naval_rr");
  cites("c_rr_temple", "x_sii_rr_edict", "x_sii_rr_date", "x_aiy_26th", "x_bri_built", "x_bri_name");
  cites("c_regnal_years", "x_sii_rr_date", "x_sii_rj_19th", "x_aiy_regnal");
  cites("c_temple_women", "x_sii_dancing_girls");
  cites("c_kundavai", "x_sii_rr_edict", "x_ei9_kundavai", "x_ei9_jaina", "x_aiy_26th");
  cites("c_tower", "x_aiy_tower", "x_bri_vimana", "x_glct_1987");
  cites("c_ramp", "x_aiy_incline");
  cites("c_survey", "x_choe_survey");
  cites("c_rajendra", "x_ren_reign", "x_ei9_date");
  cites("c_ganges", "x_sii_rj_ganga", "x_sii_rj_mahipala", "x_ei9_mahipala", "x_ei9_ganga", "x_cho_ganges", "x_gc_capital", "x_gc_name", "x_ren_pala");
  cites("c_kadaram", "x_sii_rj_kadaram", "x_sii_rj_treasure", "x_sii_rj_malaiyur", "x_sii_rj_kadaram_sea", "x_cho_1025", "x_sri_1025", "x_sri_tambralinga");
  cites("c_kadaram_where", "x_sii_hultzsch_kidaram", "x_ei9_kadaram_wrong", "x_ei9_srivishaya", "x_ei9_nicobar");
  cites("c_motives", "x_sri_monopoly", "x_sri_sastri", "x_sri_geo");
  cites("c_raid", "x_cho_failed", "x_choe_1070");
  cite("c_raid", "x_sii_rj_treasure", "supports", "The inscriptions record plunder, not government.");
  cites("c_ceylon", "x_ei9_ceylon", "x_choe_mahinda");
  cites("c_china", "x_choe_china");
  cites("c_chola_end", "x_cho_1279");
  cites("c_uttar_lots", "x_asi_light", "x_asi_a_date", "x_asi_a_royal", "x_asi_b_wards", "x_utt_919", "x_utt_kudavolai");
  cites("c_uttar_quals", "x_asi_b_land", "x_asi_b_house", "x_asi_b_age", "x_asi_b_veda", "x_utt_land", "x_utt_age");
  cites("c_uttar_accounts", "x_asi_b_accounts");
  cites("c_uttar_boy", "x_asi_b_boy", "x_asi_b_assembly");
  cites("c_sabha_brahmin", "x_utt_two", "x_utt_brahmin");
  cites("c_stein_segmentary", "x_stein_bureau", "x_stein_book");
  cites("c_samanta", "x_sam_def", "x_sam_vassal", "x_sam_feudal");
  cites("c_sharma", "x_rss_1965", "x_rss_kosambi", "x_rss_urban");
  cites("c_feud_term", "x_feud_term");
  cites("c_pala_samantas", "x_pala_end");
  cites("c_mahmud_raids", "x_mah_seventeen", "x_alb_thirty_years", "x_ed_utbi_vow");
  cites("c_thanesar_kannauj", "x_mah_thanesar", "x_pra_1018");
  cites("c_somnath", "x_alb_somnath", "x_alb_somnath_ghazni", "x_alb_somnath_mosque", "x_som_1026", "x_som_biruni");
  cites("c_ibnasir", "x_ed_ibnasir_somnat", "x_ed_slaughter_gate", "x_ed_ibnasir_dates", "x_ed_yamini_omits", "x_ed_416_415");
  cites("c_alberuni_ruin", "x_alb_ruined", "x_alb_aversion", "x_alb_sciences_fled");
  cite("c_alberuni_ruin", "x_alb_sachau_cold", "qualifies");
  cites("c_albiruni_life", "x_alb_1017", "x_alb_prisoners", "x_alb_lang");
  cites("c_mahmud_motives", "x_mah_objectives", "x_mah_hindu_troops", "x_mah_thapar_political");
  cites("c_somnath_repaired", "x_som_1038", "x_som_50000");
  cites("c_somnath_memory", "x_som_malik", "x_mah_villain", "x_som_1842");
  cites("c_elliot_agenda", "x_ed_elliot_mildness");
  cites("c_elliot_reinaud", "x_ed_reinaud");
  cites("c_kalhana_method", "x_stein_eleven", "x_stein_inscriptions", "x_stein_judge", "x_kal_date");
  cites("c_kalhana_legend", "x_stein_legendary", "x_stein_no_critical", "x_raj_little", "x_raj_mihirakula", "x_raj_book4", "x_raj_lalitaditya", "x_stein_karkota");
  cite("m_chola_sea_empire", "x_ren_annexed", "mentions", "Wikipedia's own lead states the annexation as fact, uncited.");
  cite("m_chola_sea_empire", "x_cho_failed", "contradicts");
  cite("m_chola_sea_empire", "x_choe_1070", "contradicts");
  cite("m_village_democracy", "x_utt_brahmin", "contradicts");
  cite("m_village_democracy", "x_asi_b_land", "contradicts");
  cite("m_village_democracy", "x_asi_a_royal", "contradicts", "Committees were chosen by lot.");
  cite("m_dark_age", "x_mk_regionalism", "contradicts");
  cite("m_dark_age", "x_rss_urban", "qualifies", "Sharma's thesis of urban decline.");
  cite("m_rajatarangini", "x_stein_legendary", "contradicts");
  cite("m_rajatarangini", "x_raj_little", "contradicts");
  cite("m_mahmud_one_motive", "x_ed_utbi_vow", "mentions", "The court historian's holy-war framing.");
  cite("m_mahmud_one_motive", "x_mah_objectives", "contradicts");
  cite("m_mahmud_one_motive", "x_mah_hindu_troops", "contradicts");

  // ------------------------------------------------------------ relations
  const rel = (from: string, to: string, type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", note?: string) =>
    ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) });
  rel("c_bana_praise", "c_rajyasri", "qualifies", "A praise biography.");
  rel("c_aihole_harsha", "c_pulakesi_checks", "supports", "Two independent sources for Harṣa's defeat.");
  rel("c_narmada_date", "c_aihole_harsha", "context_for");
  rel("c_vatapi_642", "c_badami", "context_for");
  rel("c_dharmapala_kanauj", "c_tripartite", "context_for");
  rel("c_pratihara_arabs", "c_tripartite", "context_for");
  rel("c_elliot_reinaud", "c_balhara", "qualifies", "A translation of a translation.");
  rel("c_kadaram_where", "c_kadaram", "context_for");
  rel("c_motives", "c_kadaram", "context_for");
  rel("c_raid", "c_kadaram", "qualifies", "A raid, not a conquest.");
  rel("c_regnal_years", "c_rr_temple", "context_for");
  rel("c_sabha_brahmin", "c_uttar_lots", "qualifies", "The rules concern a Brahmin assembly.");
  rel("c_uttar_lots", "c_stein_segmentary", "qualifies", "A royal order reaching into a village assembly.");
  rel("c_survey", "c_stein_segmentary", "qualifies", "A land survey ordered from the centre.");
  rel("c_feud_term", "c_sharma", "qualifies");
  rel("c_regionalism", "c_sharma", "qualifies", "Regional states, rather than decline.");
  rel("c_ibnasir", "c_somnath", "qualifies", "The later chroniclers add the killing.");
  rel("c_somnath_repaired", "c_ibnasir", "qualifies");
  rel("c_elliot_agenda", "c_ibnasir", "context_for", "Why the British translated these chroniclers.");
  rel("c_alberuni_ruin", "c_mahmud_raids", "supports");
  rel("c_kalhana_legend", "c_kalhana_method", "qualifies");
  rel("c_raid", "m_chola_sea_empire", "corrects");
  rel("c_motives", "m_chola_sea_empire", "qualifies");
  rel("c_sabha_brahmin", "m_village_democracy", "corrects");
  rel("c_uttar_quals", "m_village_democracy", "corrects");
  rel("c_regionalism", "m_dark_age", "corrects");
  rel("c_kailasa", "m_dark_age", "qualifies");
  rel("c_rr_temple", "m_dark_age", "qualifies");
  rel("c_kalhana_legend", "m_rajatarangini", "corrects");
  rel("c_mahmud_motives", "m_mahmud_one_motive", "corrects");

  return ops;
}

// ---------------------------------------------------------------- page

export function earlyMedievalPage(E: Record<string, string>): ChangeOpInput {
  const e = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const C = (ref: string, text: string) => `[${text}](claim:@${ref})`;
  const N = (ref: string, text: string) => `[${text}](entity:${E[ref] ?? ref})`;

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown: [
        `After the Guptas, no single power ruled northern India for long. Instead ${C("c_regionalism", "regional kingdoms rose and fell, often defeated but seldom destroyed")}: Harṣa at Kannauj, the Chalukyas and Pallavas in the south, and then ${C("c_tripartite", "three dynasties fighting over Kannauj")}. In the far south ${N("chola", "the Cholas")} built ${C("c_rr_temple", "the great temple at Thanjavur")} and ${C("c_kadaram", "sent a fleet across the Bay of Bengal")}.`,
        `Most of what we know comes from the kings' own inscriptions, from poets who praised them, and from foreign visitors: ${C("c_six_years", "a Chinese pilgrim")}, ${C("c_balhara", "an Arab merchant")}, and ${C("c_alberuni_ruin", "a scholar from Central Asia who lived at the court of Mahmud of Ghazni")}. Each had a point of view, and this page shows it.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("rajaraja"), text: `Built ${C("c_rr_temple", "the great temple at Thanjavur")}, finished about 1010.`, target: "ch-thanjavur", targetLabel: "Rājarāja and Thanjavur" },
        { entity: e("rajendra"), text: `“Conquered South-East Asia.” ${C("c_raid", "It was a raid, not a conquest")}.`, target: "ch-sea", targetLabel: "To the Ganges and across the sea" },
        { entity: e("harsha"), text: `Patron of the poet Bāṇa and host of Xuanzang. ${C("c_pulakesi_checks", "He could not conquer the south")}.`, target: "ch-harsha", targetLabel: "Harṣa and the king of the south" },
        { entity: e("somnath"), text: `Raided by Mahmud of Ghazni in 1026. ${C("c_ibnasir", "Much of the familiar story was written two centuries later")}.`, target: "ch-mahmud", targetLabel: "Mahmud and Somnāth" },
        { entity: e("uttaramerur"), text: `“India's first elections.” ${C("c_uttar_lots", "Committees were chosen by lot")}, from a Brahmin assembly.`, target: "ch-villages", targetLabel: "Who governed?" },
        { entity: e("kailasa"), text: `${C("c_kailasa", "A whole temple cut from one rock")}, under the Rāṣṭrakūṭas.`, target: "ch-kannauj", targetLabel: "Kannauj and the three dynasties" },
      ],
    },
    {
      id: "meanwhile",
      type: "meanwhile",
      title: "Meanwhile, beyond India",
      items: [
        { region: "China", label: "The pilgrim Xuanzang is Harṣa's guest in the 640s", entity: e("xuanzang"), claimIds: ["@c_six_years", "@c_harsha_charity"] },
        { region: "The Arab world", label: "An Arab merchant describes India's kings, 851", entity: e("sulaiman"), claimIds: ["@c_balhara", "@c_pratihara_arabs"] },
        { region: "Sumatra and Malaya", label: "Śrīvijaya's king captured by a Chola fleet, c. 1025", entity: e("srivijaya"), claimIds: ["@c_kadaram", "@c_motives"] },
        { region: "Sri Lanka", label: "Chola conquest of the northern kingdom", claimIds: ["@c_ceylon", "@c_rr_conquests"] },
        { region: "China, later", label: "Chola embassies to China", entity: e("chola"), claimIds: ["@c_china"] },
        { region: "Afghanistan", label: "Mahmud's Ghazni, enriched by Indian plunder", entity: e("ghazni"), claimIds: ["@c_mahmud_raids", "@c_somnath"] },
      ],
      note: "Each line rests on the claims linked to it.",
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-harsha",
      type: "chapter",
      title: "Harṣa and the king of the south",
      promise: "A king of Kannauj, his court poet, a Chinese guest, and the Deccan king who stopped him.",
      when: { start: ce(606), end: ce(647), basis: "Harṣa's reign" },
      places: [e("kannauj"), e("aihole")],
      people: [e("harsha"), e("bana"), e("xuanzang"), e("pulakeshin")],
    },
    {
      id: "harsha-prose",
      type: "prose",
      markdown: [
        `${N("harsha", "Harṣa")} ${C("c_harsha_reign", "ruled from Kannauj on the Ganges from 606 to 647")}. ${C("c_rajya_murder", "He came to the throne after his elder brother was murdered")}, and ${C("c_rajyasri", "his poet Bāṇa tells how he rescued his sister from the forest")}. But ${C("c_bana_praise", "Bāṇa was writing praise")}.`,
        `The Chinese pilgrim ${N("xuanzang", "Xuanzang")}, Harṣa's guest, ${C("c_six_years", "describes years of war and then decades of peace")}, and ${C("c_harsha_charity", "hospices and great festivals of giving")}. He also notes that ${C("c_pulakesi_checks", "one people would not submit: the Mahārāṣṭra of King Pulakeśin")}. Pulakeśin's own inscription at Aihole ${C("c_aihole_harsha", "boasts that Harṣa's joy “melted away by fear”")}. ${C("c_narmada_date", "When the battle was fought is still argued over")}.`,
      ].join("\n\n"),
    },
    { id: "harsha-claims", type: "claims", claimIds: ["@c_harsha_reign", "@c_rajya_murder", "@c_rajyasri", "@c_bana_praise", "@c_six_years", "@c_harsha_charity", "@c_pulakesi_checks", "@c_aihole_harsha", "@c_narmada_date", "@c_ravikirti", "@c_raghu_600"] },
    {
      id: "harsha-quote",
      type: "quote",
      excerptId: "@x_beal_not_conquered",
      caption: "Xuanzang on Pulakeśin's kingdom, Si-yu-ki, Book XI, in Samuel Beal's translation (1884), vol. II, p. 257.",
    },

    // ------------------------------------------------------------ 2
    {
      id: "ch-deccan",
      type: "chapter",
      title: "Chalukyas and Pallavas",
      promise: "Two southern dynasties, their capitals at Vātāpi and Kāñcī, and a war that ended with one capital in flames.",
      when: { start: ce(550, true), end: ce(753), basis: "From the Chalukyas' rise to their fall to the Rāṣṭrakūṭas" },
      places: [e("vatapi"), e("kanchi"), e("mamallapuram")],
      people: [e("pulakeshin"), e("narasimhavarman")],
    },
    {
      id: "deccan-prose",
      type: "prose",
      markdown: [
        `In the Deccan, ${C("c_badami", "the Chalukyas ruled from Vātāpi, modern Badami")}. Pulakeśin II's poet credits him with ${C("c_pul_wars", "fleets on the western sea and the Pallava king driven behind the walls of Kāñcī")}. ${C("c_kanchi", "The Pallavas, from Kāñcī, were the Chalukyas' constant rivals")}.`,
        `Around 642 the tables turned: ${C("c_vatapi_642", "the Pallava Narasiṃhavarman I destroyed Vātāpi, and Pulakeśin died")}. ${C("c_mamallapuram", "The Pallava port of Mamallapuram is named after him")}. A century later ${C("c_rashtra_753", "the Chalukyas fell to one of their own subordinates, the Rāṣṭrakūṭa Dantidurga")}.`,
      ].join("\n\n"),
    },
    { id: "deccan-claims", type: "claims", claimIds: ["@c_badami", "@c_pul_wars", "@c_kanchi", "@c_vatapi_642", "@c_mamallapuram", "@c_rashtra_753"] },
    {
      id: "deccan-quote",
      type: "quote",
      excerptId: "@x_sii_vatapi",
      caption: "Udayendiram plates of the Pallava Nandivarman, in E. Hultzsch's translation, South Indian Inscriptions II, p. 370.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-kannauj",
      type: "chapter",
      title: "Kannauj and the three dynasties",
      promise: "Why three dynasties fought for one city for over a century, and what an Arab merchant made of them.",
      when: { start: ce(750, true), end: ce(1018), basis: "From the rise of the Pālas to Mahmud's capture of Kannauj" },
      places: [e("kannauj"), e("kailasa")],
      people: [e("dharmapala"), e("nagabhata"), e("amoghavarsha"), e("sulaiman")],
      terms: ["@t_balhara"],
    },
    {
      id: "kannauj-prose",
      type: "prose",
      markdown: [
        `In Bengal, ${C("c_gopala", "the Pāla dynasty began with a king chosen to end disorder")}, and ${C("c_dharmapala_kanauj", "his son Dharmapāla installed his own king at Kannauj")}. ${C("c_tripartite", "For decades the Pratihāras, the Pālas and the Rāṣṭrakūṭas fought over the city")}, until the Pratihāras took it in 816. ${C("c_kannauj_916", "A century later the Rāṣṭrakūṭas sacked it")}.`,
        `An Arab merchant, Sulaimān, wrote in 851 that ${C("c_balhara", "the Rāṣṭrakūṭa king was the greatest prince of India")}, while ${C("c_pratihara_arabs", "the Pratihāra king had the finest cavalry and was the Arabs' worst enemy")}. ${C("c_ruhmi", "A third kingdom fought with elephants and traded with cowrie shells")}. These kingdoms also built: ${C("c_kailasa", "the Rāṣṭrakūṭas cut the Kailāsa temple from solid rock")}, ${C("c_amogha", "a Rāṣṭrakūṭa king wrote the first surviving book in Kannada")}, and ${C("c_pala_buddhism", "the Pālas supported the great monasteries of Nālandā and Vikramaśilā")}.`,
      ].join("\n\n"),
    },
    { id: "kannauj-claims", type: "claims", claimIds: ["@c_gopala", "@c_dharmapala_kanauj", "@c_tripartite", "@c_kannauj_916", "@c_balhara", "@c_pratihara_arabs", "@c_ruhmi", "@c_kailasa", "@c_amogha", "@c_pala_buddhism", "@c_regionalism"] },
    {
      id: "kannauj-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Sulaimān is quoted from H. M. Elliot's English version of a French translation of the Arabic, made in the 1840s–60s by a British official with a political purpose (see “Mahmud and Somnāth”). Which kingdom his “Ruhmī” is remains a guess.",
    },

    // ------------------------------------------------------------ 4
    {
      id: "ch-thanjavur",
      type: "chapter",
      title: "The Cholas: Rājarāja and the great temple",
      promise: "How a small Tamil kingdom became the power of the south, and what its temple walls record.",
      when: { start: ce(985), end: ce(1014), basis: "Rājarāja I's reign" },
      places: [e("thanjavur_temple")],
      people: [e("rajaraja"), e("kundavai"), e("hultzsch")],
      terms: ["@t_regnal", "@t_meykirtti", "@t_vimana"],
    },
    {
      id: "thanjavur-prose",
      type: "prose",
      markdown: [
        `${C("c_chola_rise", "When Rājarāja I came to power in 985, the Chola kingdom was small")}. ${C("c_rr_conquests", "His inscriptions open with a list of conquests")}, from the Kerala coast to Sri Lanka and “twelve thousand ancient islands”. ${C("c_survey", "He had the land surveyed")}.`,
        `His monument is ${C("c_rr_temple", "the great temple at Thanjavur, finished about 1010")}, with ${C("c_tower", "a granite tower some 200 feet high")}. Its walls record gifts by the king, ${C("c_kundavai", "his sister Kundavai")} and others, and ${C("c_temple_women", "400 women brought from other temples to serve it")}. The records are dated ${C("c_regnal_years", "by the years of the king's reign")}, so every modern date for them is a calculation. ${C("c_ramp", "A story says the capstone was hauled up a ramp four miles long")}; it is only a story.`,
      ].join("\n\n"),
    },
    { id: "thanjavur-claims", type: "claims", claimIds: ["@c_chola_rise", "@c_rr_conquests", "@c_survey", "@c_rr_temple", "@c_tower", "@c_kundavai", "@c_temple_women", "@c_regnal_years", "@c_ramp"] },
    {
      id: "thanjavur-quote",
      type: "quote",
      excerptId: "@x_sii_rr_edict",
      caption: "Rājarāja I's order on the central shrine at Thanjavur, in E. Hultzsch's translation, South Indian Inscriptions II, no. 1, p. 8.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-sea",
      type: "chapter",
      title: "Rājendra: to the Ganges and across the sea",
      promise: "A northern campaign, a new capital, and a fleet sent against a king in Malaya. Conquest or raid?",
      when: { start: ce(1014), end: ce(1044), basis: "Rājendra I's reign" },
      places: [e("gangaikonda"), e("kadaram")],
      people: [e("rajendra"), e("hultzsch")],
      terms: ["@t_digvijaya"],
    },
    {
      id: "sea-prose",
      type: "prose",
      markdown: [
        `${C("c_rajendra", "Rājendra I succeeded his father in 1014")}. ${C("c_ganges", "His armies reached the Ganges and defeated the Pāla king")}, and he built a new capital named after the river. ${C("c_ceylon", "He finished the conquest of northern Sri Lanka")}.`,
        `About 1025 he went further. ${C("c_kadaram", "His inscriptions say he sent “many ships in the midst of the rolling sea” and captured the king of Kaḍāram")} with his treasure. ${C("c_kadaram_where", "It took scholars time to work out that Kaḍāram was overseas")}, in the realm of Śrīvijaya. ${C("c_motives", "Why he did it is debated")}; ${C("c_raid", "what is clear is that it was a raid, not the start of Chola rule")}. ${C("c_china", "The Cholas also sent embassies to China")}, and ${C("c_chola_end", "the dynasty lasted until 1279")}.`,
      ].join("\n\n"),
    },
    { id: "sea-claims", type: "claims", claimIds: ["@c_rajendra", "@c_ganges", "@c_ceylon", "@c_kadaram", "@c_kadaram_where", "@c_motives", "@c_raid", "@c_china", "@c_chola_end"] },
    {
      id: "sea-debate",
      type: "debate",
      theme: "economy",
      question: "Why did the Cholas attack Śrīvijaya?",
      positions: [
        { label: "Plunder: the inscriptions boast of treasure", claimIds: ["@c_kadaram", "@c_raid"] },
        { label: "Trade, prestige or diplomacy (Nilakanta Sastri and others)", claimIds: ["@c_motives"] },
      ],
      note: "The Chola inscriptions record a victory and treasure, not reasons. Every motive is an inference from the trade of the time.",
    },
    {
      id: "sea-quote",
      type: "quote",
      excerptId: "@x_sii_rj_kadaram",
      caption: "Rājendra I's historical introduction, in E. Hultzsch's translation, South Indian Inscriptions II, no. 20, p. 109.",
    },

    // ------------------------------------------------------------ 6
    {
      id: "ch-villages",
      type: "chapter",
      title: "Who governed? Villages, assemblies and the state",
      promise: "How one Chola village chose its committees, who could take part, and how much the king ran the country.",
      when: { start: ce(919), basis: "The first Uttaramerūr inscription of Parāntaka I" },
      places: [e("uttaramerur")],
      people: [e("bstein")],
      terms: ["@t_sabha", "@t_kudavolai"],
    },
    {
      id: "villages-prose",
      type: "prose",
      markdown: [
        `At Uttaramerūr, near Kāñcī, two inscriptions from about 919 record ${C("c_uttar_lots", "a royal order: the village assembly must choose its committees by lot")}. ${C("c_uttar_boy", "A young boy drew palm-leaf tickets from a pot")} ${N("t_kudavolai", "(kuḍavōlai)")}, before the whole assembly.`,
        `Not everyone could be drawn. ${C("c_uttar_quals", "A man had to own land, live in his own house, be aged 35 to 70 and know the Veda")}, and ${C("c_uttar_accounts", "anyone who had failed to submit his accounts was barred, with his relatives")}. ${C("c_sabha_brahmin", "This was the assembly of the village's Brahmins")}; ordinary villages had another.`,
        `How much did the king control? ${C("c_survey", "Rājarāja surveyed the land")}, and ${C("c_uttar_lots", "a royal order set the rules at Uttaramerūr")}. But ${C("c_stein_segmentary", "the historian Burton Stein doubted there was any central bureaucracy at all")}.`,
      ].join("\n\n"),
    },
    { id: "villages-claims", type: "claims", claimIds: ["@c_uttar_lots", "@c_uttar_quals", "@c_uttar_accounts", "@c_uttar_boy", "@c_sabha_brahmin", "@c_stein_segmentary"] },
    {
      id: "villages-debate",
      type: "debate",
      theme: "governance",
      question: "How centralised was the Chola state?",
      positions: [
        { label: "The king reached into the villages", claimIds: ["@c_uttar_lots", "@c_survey"] },
        { label: "A “segmentary” state of local powers (Burton Stein)", claimIds: ["@c_stein_segmentary"] },
      ],
      note: "The opposing view, of a strong central Chola state, is not yet quoted on this page; the evidence on both sides is the same inscriptions, read differently.",
    },
    {
      id: "villages-quote",
      type: "quote",
      excerptId: "@x_asi_b_age",
      caption: "Uttaramerūr, inscription of Parāntaka I's 14th year, in the Archaeological Survey of India's Annual Report 1904–5, p. 142.",
    },

    // ------------------------------------------------------------ 7
    {
      id: "ch-feudal",
      type: "chapter",
      title: "Lords and land: was India feudal?",
      promise: "A famous argument about whether this age was one of decline under landlords, or of thriving regional states.",
      phase: "later",
      people: [e("rssharma")],
      terms: ["@t_samanta", "@t_feudalism"],
    },
    {
      id: "feudal-prose",
      type: "prose",
      markdown: [
        `Inscriptions of this age are full of ${N("t_samanta", "sāmantas")}, ${C("c_samanta", "subordinate lords who owed loyalty to a king")}, and ${C("c_pala_samantas", "kings who depended on them could be undone by them")}. ${C("c_sharma", "In 1965 R. S. Sharma argued that India had become feudal, with towns in decline")}.`,
        `${C("c_feud_term", "The word itself comes from medieval Europe")}, and many historians question whether it fits. Others describe the age not as decline but as one of ${C("c_regionalism", "regional kingdoms that proved hard to destroy")}.`,
      ].join("\n\n"),
    },
    { id: "feudal-claims", type: "claims", claimIds: ["@c_samanta", "@c_pala_samantas", "@c_sharma", "@c_feud_term"] },
    {
      id: "feudal-debate",
      type: "debate",
      theme: "historiography",
      question: "Was early medieval India feudal?",
      positions: [
        { label: "Yes: lords, land grants and declining towns (R. S. Sharma)", claimIds: ["@c_sharma", "@c_samanta"] },
        { label: "A European idea that does not fit", claimIds: ["@c_feud_term"] },
        { label: "Regional states, not decline", claimIds: ["@c_regionalism"] },
      ],
      note: "Sharma's critics are not yet quoted on this page; this debate will grow when their work can be cited.",
    },

    // ------------------------------------------------------------ 8
    {
      id: "ch-mahmud",
      type: "chapter",
      title: "Mahmud of Ghazni and Somnāth",
      promise: "Thirty years of raids, one temple, and how the story of it was told and retold.",
      when: { start: ce(1000, true), end: ce(1027), basis: "Mahmud's raids" },
      places: [e("somnath"), e("ghazni"), e("kannauj")],
      people: [e("mahmud"), e("albiruni"), e("elliot")],
    },
    {
      id: "mahmud-prose",
      type: "prose",
      markdown: [
        `From about 1000, ${N("mahmud", "Mahmud")}, the sultan of Ghazni in Afghanistan, ${C("c_mahmud_raids", "raided India again and again for thirty years")}, ${C("c_thanesar_kannauj", "plundering Thanesar and forcing Kannauj to surrender")}. In 1026 he reached Somnāth in Gujarat. ${C("c_somnath", "Alberuni, who lived at his court, records that the temple's image was broken and carried to Ghazni")}.`,
        `Alberuni ${C("c_alberuni_ruin", "judged that Mahmud had ruined the country's prosperity")}; ${C("c_albiruni_life", "he may himself have come to Ghazni as a prisoner")}. ${C("c_ibnasir", "The story of a great slaughter comes from a chronicler writing two centuries later")}. Historians weigh ${C("c_mahmud_motives", "religion, money and politics")} in Mahmud's raids, and ${C("c_somnath_repaired", "note that the temple was soon repaired")}. ${C("c_somnath_memory", "Somnāth went on to become a symbol, used very differently by different people")}.`,
      ].join("\n\n"),
    },
    { id: "mahmud-claims", type: "claims", claimIds: ["@c_mahmud_raids", "@c_thanesar_kannauj", "@c_somnath", "@c_alberuni_ruin", "@c_albiruni_life", "@c_ibnasir", "@c_mahmud_motives", "@c_somnath_repaired", "@c_somnath_memory", "@c_elliot_agenda", "@c_elliot_reinaud"] },
    {
      id: "mahmud-quote",
      type: "quote",
      excerptId: "@x_alb_ruined",
      caption: "Alberuni on Mahmud, India, chapter I, in E. C. Sachau's translation (1888), vol. I, p. 22.",
    },
    {
      id: "mahmud-care",
      type: "callout",
      tone: "caution",
      markdown: `Read with care. Mahmud's court historians wrote to glorify him, and later chroniclers enlarged their stories. The English translations most often quoted were made, as ${C("c_elliot_agenda", "their editor said")}, to show Indians the benefits of British rule. Modern views here are reported from Wikipedia and need checking against the historians it cites.`,
    },

    // ------------------------------------------------------------ 9
    {
      id: "ch-sources",
      type: "chapter",
      title: "How we know: inscriptions, chroniclers and a Kashmiri poet",
      promise: "Why dates in this period come from kings' regnal years, and how far a twelfth-century chronicle can be trusted.",
      phase: "later",
      people: [e("kalhana"), e("hultzsch")],
    },
    {
      id: "sources-prose",
      type: "prose",
      markdown: [
        `Much of this period is known from stone and copper. Kings dated their records ${C("c_regnal_years", "by the years of their reigns")}, and scholars have had to work out ${C("c_kadaram_where", "even where the places they name were")}. Poets wrote praise: ${C("c_ravikirti", "the Aihole poet compared himself to Kālidāsa")}, ${C("c_bana_praise", "and Bāṇa to no one")}.`,
        `In Kashmir, Kalhaṇa wrote a verse history, the Rājataraṅgiṇī, in 1148–49. ${C("c_kalhana_method", "He describes a careful method, checking older books against inscriptions")}. But ${C("c_kalhana_legend", "his early books are legend")}.`,
      ].join("\n\n"),
    },
    { id: "sources-claims", type: "claims", claimIds: ["@c_kalhana_method", "@c_kalhana_legend"] },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often-said",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Five popular beliefs about this age, each with what the sources on this page say.",
      phase: "later",
    },
    {
      id: "often-prose",
      type: "prose",
      markdown: "Some short versions of this story are repeated more often than the sources allow. Here are five, each with the claims that correct or qualify it.",
    },
    { id: "myth-sea-empire", type: "misconception", theme: "war", claimId: "@m_chola_sea_empire", correctionIds: ["@c_raid", "@c_kadaram", "@c_motives"] },
    { id: "myth-democracy", type: "misconception", theme: "governance", claimId: "@m_village_democracy", correctionIds: ["@c_sabha_brahmin", "@c_uttar_quals", "@c_uttar_lots"] },
    { id: "myth-dark-age", type: "misconception", theme: "historiography", claimId: "@m_dark_age", correctionIds: ["@c_regionalism", "@c_kailasa", "@c_rr_temple", "@c_amogha", "@c_pala_buddhism"] },
    { id: "myth-rajatarangini", type: "misconception", theme: "sources", claimId: "@m_rajatarangini", correctionIds: ["@c_kalhana_legend"] },
    { id: "myth-mahmud", type: "misconception", theme: "religion", claimId: "@m_mahmud_one_motive", correctionIds: ["@c_mahmud_motives", "@c_mahmud_raids", "@c_somnath_repaired"] },
  ];

  const spec: PageSpecInput = {
    atlas: {
      focus: [e("chola"), e("rashtrakuta"), e("pala"), e("pratihara"), e("chalukya"), e("pallava"), e("harsha_empire"), e("wchalukya"), e("srivijaya"), e("ghaznavids")],
      range: [550, 1250],
      initialYear: 1025,
      stops: [
        { year: 606, label: "Harṣa becomes king", claimId: "@c_harsha_reign" },
        { year: 634, label: "Aihole inscription", claimId: "@c_aihole_harsha" },
        { year: 642, label: "Vātāpi taken", claimId: "@c_vatapi_642" },
        { year: 753, label: "The Rāṣṭrakūṭas rise", claimId: "@c_rashtra_753" },
        { year: 816, label: "The Pratihāras take Kannauj", claimId: "@c_tripartite" },
        { year: 851, label: "Sulaimān's account", claimId: "@c_balhara" },
        { year: 916, label: "Kannauj sacked", claimId: "@c_kannauj_916" },
        { year: 985, label: "Rājarāja I", claimId: "@c_chola_rise" },
        { year: 1010, label: "Thanjavur temple finished", claimId: "@c_rr_temple" },
        { year: 1025, label: "The fleet to Kaḍāram", claimId: "@c_kadaram" },
        { year: 1026, label: "Somnāth raided", claimId: "@c_somnath" },
        { year: 1070, label: "Overseas holdings lost", claimId: "@c_raid" },
      ],
      neighbours: true,
    },
    timeline: { range: [550, 1250] },
  };

  return {
    op: "create_page",
    slug: "early-medieval-kingdoms",
    title: "Kingdoms of the early medieval age and the Cholas",
    kind: "era",
    entity: PERIOD,
    summary: "Regional kingdoms from Harṣa to the Cholas, c. 550–1200 CE: the wars for Kannauj, the temple at Thanjavur, a Chola fleet in Malaya, village assemblies, Mahmud of Ghazni, and the arguments over feudalism, in the words of inscriptions, poets and foreign visitors.",
    blocks,
    status: "published",
    position: 8,
    spec,
  };
}
