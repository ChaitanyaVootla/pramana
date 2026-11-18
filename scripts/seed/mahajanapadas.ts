import type { BlockInput, ChangeOpInput, PageSpecInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "The Mahājanapadas and the age of the Buddha" era page (c. 600–320 BCE),
 * built from a source pack prepared on 2026-10-18. Every quote was
 * machine-checked against the same texts captured here.
 *
 * Primary sources are public-domain translations: the Pāli suttas (Rhys
 * Davids, SBE 11, 1881; Dialogues of the Buddha I, 1899), the Mahāvaṃsa
 * (Geiger and Bode, 1912), the Jaina Sūtras (Jacobi, SBE 22, 1884), the
 * Purāṇic dynastic lists (Pargiter, 1913), Darius's Behistun inscription (King
 * and Thompson, 1907), Herodotus (Macaulay, 1890), Arrian (Chinnock, 1884) and
 * McCrindle's Curtius, Diodorus and Plutarch (1896). Rhys Davids' Buddhist
 * India (1903) and Vincent Smith (1914) are older scholarship, quoted as such.
 * Wikipedia (tertiary) supplies modern positions, with the books it cites added
 * by page only.
 *
 * Every date before the Mauryas is uncertain; the page says so, and treats the
 * date of the Buddha as a debate. The janapada borders on the atlas are
 * Cliopatria's reconstructions from text lists, and the page links them to
 * their polities here.
 */

// ---------------------------------------------------------------- snapshots

export const CAPTURES = {
  bi: { kind: "internet_archive", identifier: "buddhistindia00davirich" },
  sbe11: { kind: "internet_archive", identifier: "buddhistsuttas00daviuoft" },
  dial1: { kind: "internet_archive", identifier: "dialoguesofbuddh01davi" },
  mhv: { kind: "internet_archive", identifier: "mahavamsagreatch00geigrich" },
  jacobi: { kind: "internet_archive", identifier: "gainasutras01jacouoft" },
  pargiter: { kind: "internet_archive", identifier: "dli.csl.5891" },
  herod1: { kind: "internet_archive", identifier: "historyofherodo01hero" },
  herod2: { kind: "internet_archive", identifier: "historyofherodo02hero" },
  behistun: { kind: "internet_archive", identifier: "sculpturesinscri00brituoft" },
  smith1914: { kind: "internet_archive", identifier: "earlyhistoryofin00smit" },
  arrian: { kind: "internet_archive", identifier: "theanabasisofale46976gut" },
  mccrindle: { kind: "internet_archive", identifier: "invasionofindiab00mccr" },
  wpMj: { kind: "wikipedia", title: "Mahajanapadas" },
  wpUrban: { kind: "wikipedia", title: "Second urbanisation" },
  wpNbpw: { kind: "wikipedia", title: "Northern Black Polished Ware" },
  wpHaryanka: { kind: "wikipedia", title: "Haryanka dynasty" },
  wpShishunaga: { kind: "wikipedia", title: "Shishunaga dynasty" },
  wpNanda: { kind: "wikipedia", title: "Nanda Empire" },
  wpBimbisara: { kind: "wikipedia", title: "Bimbisara" },
  wpAjatashatru: { kind: "wikipedia", title: "Ajatashatru" },
  wpPasenadi: { kind: "wikipedia", title: "Pasenadi" },
  wpMahavira: { kind: "wikipedia", title: "Mahavira" },
  wpParshva: { kind: "wikipedia", title: "Parshvanatha" },
  wpBuddha: { kind: "wikipedia", title: "The Buddha" },
  wpGana: { kind: "wikipedia", title: "Gaṇa sangha" },
  wpAchaemenid: { kind: "wikipedia", title: "Achaemenid conquest of the Indus Valley" },
  wpAlexander: { kind: "wikipedia", title: "Indian campaign of Alexander the Great" },
  wpPorus: { kind: "wikipedia", title: "Porus" },
  wpTaxila: { kind: "wikipedia", title: "Taxila" },
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
  /** Use Wikidata P569/P570 as a life span (only where Wikidata has day or year precision). */
  life?: boolean;
  /** Use Wikidata coordinates, with this certainty. */
  geo?: "exact" | "approximate";
  geoNote?: string;
  aliases?: Alias[];
  /** How this entity relates to the period (for the page's timeline and map). */
  link?: "part_of" | "participant_in" | "related_to" | "contemporary_of";
  linkNote?: string;
  /** The Cliopatria rows ("Janapada of …") whose borders belong to this polity. */
  extentName?: string;
}

const PERIOD = "mahajanapadas";
const bce = (year: number, approximate = true, uncertain = false) => ({
  year,
  era: "BCE" as const,
  ...(approximate ? { approximate } : {}),
  ...(uncertain ? { uncertain } : {}),
});
const RD = "Rhys Davids, Buddhist India (1903)";

/** The sixteen of the Aṅguttara list, with the Wikidata items Cliopatria uses for them. */
const JANAPADAS: EntitySpec[] = [
  { ref: "magadha", slug: "magadha", kind: "polity", label: "Magadha", qid: "Q234009", extentName: "Janapada of Magadha", description: "Kingdom of south Bihar, ruled from Rājagaha and later Pāṭaliputra; under Bimbisāra, Ajātasattu and their successors it absorbed its neighbours." },
  { ref: "kosala", slug: "kosala", kind: "polity", label: "Kosala", qid: "Q756854", extentName: "Janapada of Kosala", description: "Kingdom north of the Ganges with its capital at Sāvatthi, ruled in the Buddha's time by Pasenadi.", aliases: [{ label: "Northern Kosala", lang: "en", note: RD }] },
  { ref: "vatsa", slug: "vatsa", kind: "polity", label: "Vatsa", qid: "Q1331184", extentName: "Janapada of Vatsa", description: "Kingdom on the Yamunā with its capital at Kosambī, ruled in the Buddha's time by Udena.", aliases: [{ label: "Vaṃsa", lang: "pi-Latn", note: "The Pāli form" }] },
  { ref: "avanti", slug: "avanti", kind: "polity", label: "Avanti", qid: "Q4827705", extentName: "Janapada of Avanti", description: "Kingdom of western Malwa with its capital at Ujjenī (Ujjain), ruled in the Buddha's time by Pajjota; later absorbed by Magadha." },
  { ref: "vajji", slug: "vajji", kind: "polity", label: "Vajji", qid: "Q605199", extentName: "Janapada of Vajji", description: "A league of clans, the Licchavis among them, governed by assemblies from Vesālī; conquered by Ajātasattu of Magadha.", aliases: [{ label: "Vajjian confederacy", lang: "en" }, { label: "Vṛji", lang: "sa-Latn" }] },
  { ref: "malla", slug: "malla", kind: "polity", label: "Malla", qid: "Q1376303", extentName: "Janapada of Malla", description: "A clan state governed from a mote hall; the Buddha died at Kusinārā in its territory." },
  { ref: "anga", slug: "anga", kind: "polity", label: "Aṅga", qid: "Q1155818", extentName: "Janapada of Anga", description: "Kingdom east of Magadha, annexed by Bimbisāra.", aliases: [{ label: "Anga", lang: "en" }] },
  { ref: "kashi", slug: "kashi", kind: "polity", label: "Kāsī", qid: "Q12660335", extentName: "Janapada of Kāśī", description: "Kingdom around Benares (Vārāṇasī), absorbed by Kosala and then Magadha.", aliases: [{ label: "Kāśī", lang: "sa-Latn" }, { label: "Kashi", lang: "en" }] },
  { ref: "cedi", slug: "cedi", kind: "polity", label: "Cetī", qid: "Q124207979", extentName: "Janapada of Cedī", description: "One of the sixteen in the Buddhist list, in central India south of the Yamunā.", aliases: [{ label: "Cedi", lang: "sa-Latn" }, { label: "Ceti", lang: "pi-Latn" }] },
  { ref: "kuru", slug: "kuru-kingdom", kind: "polity", label: "Kuru", qid: "Q1068408", extentName: "Janapada of Kuru", description: "Old kingdom of the upper Ganges–Yamunā plain, around present-day Delhi and Haryana; one of the sixteen." },
  { ref: "panchala", slug: "panchala", kind: "polity", label: "Pañcāla", qid: "Q558603", extentName: "Janapada of Pañcāla", description: "Kingdom of the middle Ganges–Yamunā plain east of the Kurus; one of the sixteen.", aliases: [{ label: "Panchala", lang: "en" }] },
  { ref: "matsya", slug: "matsya", kind: "polity", label: "Maccha", qid: "Q2665398", extentName: "Janapada of Matsya", description: "One of the sixteen, south-west of the Kurus in present-day Rajasthan.", aliases: [{ label: "Matsya", lang: "sa-Latn" }] },
  { ref: "surasena", slug: "surasena", kind: "polity", label: "Sūrasena", qid: "Q1330149", extentName: "Janapada of Surasena", description: "One of the sixteen, around Mathurā on the Yamunā.", aliases: [{ label: "Surasena", lang: "en" }] },
  { ref: "assaka", slug: "assaka", kind: "polity", label: "Assaka", qid: "Q1194906", extentName: "Janapada of Aśmaka", description: "The only one of the sixteen south of the Vindhyas, on the Godāvarī.", aliases: [{ label: "Aśmaka", lang: "sa-Latn" }] },
  { ref: "gandhara", slug: "gandhara", kind: "polity", label: "Gandhāra", qid: "Q112980583", extentName: "Janapada of Gandhāra", description: "Land of the north-west around Taxila and Peshawar; a province of the Persian empire from the late sixth century BCE.", aliases: [{ label: "Gandara", lang: "peo-Latn", note: "In Darius's Behistun inscription" }, { label: "Gandhara", lang: "en" }] },
  { ref: "kamboja", slug: "kamboja", kind: "polity", label: "Kamboja", qid: "Q2586782", extentName: "Janapada of Kamboja", description: "The north-westernmost of the sixteen, beyond Gandhāra." },
];

export const ENTITIES: EntitySpec[] = [
  ...JANAPADAS.map((j) => ({ ...j, link: "part_of" as const, linkNote: "One of the sixteen great states (mahājanapadas)." })),
  // Clans
  { ref: "shakya", slug: "shakya", kind: "group", label: "Sakya", qid: "Q1062748", link: "part_of", description: "The clan of the Buddha, governed by an assembly in its mote hall at Kapilavatthu; not one of the sixteen.", aliases: [{ label: "Śākya", lang: "sa-Latn" }, { label: "Shakya", lang: "en" }] },
  { ref: "licchavi", slug: "licchavi-clan", kind: "group", label: "Licchavis", qid: "Q1376731", link: "part_of", description: "The leading clan of the Vajjian league, at Vesālī; Mahāvīra's mother came from it." },
  // Kings
  { ref: "bimbisara", slug: "bimbisara", kind: "person", label: "Bimbisāra", qid: "Q317765", link: "participant_in", description: "King of Magadha in the Buddha's time, who annexed Aṅga; by Buddhist tradition killed by his son Ajātasattu.", aliases: [{ label: "Bimbisara", lang: "en" }, { label: "Seniya", lang: "pi-Latn" }],
    spans: [{ role: "reign", when: { start: bce(544, true, true), end: bce(492, true, true), label: "52 years, dates uncertain", basis: "Mahāvaṃsa II.30: reigned 52 years. Absolute dates depend on the date of the Buddha: c. 544–492 on the long chronology; K. T. S. Sarao (short chronology) gives c. 457–405 (Wikipedia, Haryanka dynasty)" } }] },
  { ref: "ajatasattu", slug: "ajatasattu", kind: "person", label: "Ajātasattu", qid: "Q379242", link: "participant_in", description: "King of Magadha, son of Bimbisāra, who conquered the Vajjian league and fortified Pāṭaligāma.", aliases: [{ label: "Ajātaśatru", lang: "sa-Latn" }, { label: "Ajatashatru", lang: "en" }, { label: "Kūṇika", lang: "pra-Latn", note: "His name in Jain texts" }],
    spans: [{ role: "reign", when: { start: bce(492, true, true), end: bce(460, true, true), label: "32 years, dates uncertain", basis: "Mahāvaṃsa II.31–32: reigned 32 years. Absolute dates depend on the date of the Buddha: c. 492–460 on the long chronology; Sarao gives c. 405–373 (Wikipedia, Haryanka dynasty)" } }] },
  { ref: "pasenadi", slug: "pasenadi", kind: "person", label: "Pasenadi", qid: "Q3055324", link: "participant_in", description: "King of Kosala at Sāvatthi in the Buddha's time, and by Buddhist tradition his lay follower.", aliases: [{ label: "Prasenajit", lang: "sa-Latn" }] },
  { ref: "udena", slug: "udena", kind: "person", label: "Udena", qid: "Q27958579", link: "participant_in", description: "King of the Vatsas at Kosambī in the Buddha's time, hero of later stories.", aliases: [{ label: "Udayana", lang: "sa-Latn" }] },
  { ref: "pajjota", slug: "pajjota", kind: "person", label: "Pajjota", qid: "Q10352362", link: "participant_in", description: "King of Avanti at Ujjenī in the Buddha's time.", aliases: [{ label: "Pradyota", lang: "sa-Latn" }, { label: "Caṇḍa Pradyota", lang: "sa-Latn" }] },
  { ref: "mahapadma", slug: "mahapadma-nanda", kind: "person", label: "Mahāpadma Nanda", qid: "Q3267658", link: "participant_in", description: "Founder of the Nanda dynasty of Magadha; the Purāṇas call him the son of a śūdra woman and the destroyer of the kṣatriyas.", aliases: [{ label: "Mahapadma Nanda", lang: "en" }] },
  { ref: "dhananda", slug: "dhana-nanda", kind: "person", label: "Dhana Nanda", qid: "Q10265876", link: "participant_in", description: "The last Nanda king, usually identified with the Agrammes or Xandrames of the Greek writers; overthrown by Chandragupta Maurya.", aliases: [{ label: "Dhanananda", lang: "pi-Latn", note: "Mahāvaṃsa" }, { label: "Agrammes", lang: "la", note: "Curtius" }, { label: "Xandrames", lang: "grc-Latn", note: "Diodorus" }] },
  // Teachers
  { ref: "buddha", slug: "gautama-buddha", kind: "person", label: "The Buddha", qid: "Q9441", link: "participant_in", description: "Siddhattha Gotama of the Sakya clan, the teacher whose followers became the Buddhists. He died at Kusinārā aged eighty; when is debated.", aliases: [{ label: "Gautama Buddha", lang: "en" }, { label: "Gotama", lang: "pi-Latn" }, { label: "Siddhārtha Gautama", lang: "sa-Latn" }, { label: "Śākyamuni", lang: "sa-Latn" }, { label: "the Tathāgata", lang: "en", note: "His title in the suttas" }],
    spans: [{ role: "life", when: { start: bce(563, true, true), end: bce(483, true, true), label: "eighty years, dates debated", basis: "He lived eighty years (Mahāparinibbāna Sutta). 563–483 BCE is the early-20th-century convention (Geiger 1912); many historians now put his death near 400 BCE. See the debate on the page." } }] },
  { ref: "mahavira", slug: "mahavira", kind: "person", label: "Mahāvīra", qid: "Q9422", link: "participant_in", description: "Vardhamāna Mahāvīra, the twenty-fourth Tīrthaṅkara of the Jains and the reformer of their order; the Nigaṇṭha Nātaputta of the Buddhist texts.", aliases: [{ label: "Mahavira", lang: "en" }, { label: "Vardhamāna", lang: "sa-Latn" }, { label: "Nigaṇṭha Nātaputta", lang: "pi-Latn", note: "His name in the Buddhist texts" }],
    spans: [{ role: "life", when: { start: bce(599, true, true), end: bce(527, true, true), label: "72 years, dates debated", basis: "He lived 72 years (Kalpa Sūtra §147). 599–527 BCE is the Śvetāmbara tradition; some scholars put it up to a century later (Wikipedia, Mahavira)" } }] },
  { ref: "parshva", slug: "parshvanatha", kind: "person", label: "Pārśva", qid: "Q1400271", link: "related_to", linkNote: "The earlier Jain teacher whose order Mahāvīra reformed.", description: "The twenty-third Tīrthaṅkara of the Jains, the earliest accepted by historians as a historical figure.", aliases: [{ label: "Pārśvanātha", lang: "sa-Latn" }, { label: "Parshvanatha", lang: "en" }] },
  { ref: "gosala", slug: "makkhali-gosala", kind: "person", label: "Makkhali Gosāla", qid: "Q2701335", link: "participant_in", description: "Teacher of the Ājīvikas in the Buddha's time, known from his rivals' texts for a doctrine of fate.", aliases: [{ label: "Makkhali Gosala", lang: "en" }, { label: "Gośāla Maṅkhaliputra", lang: "sa-Latn" }] },
  // Persians, Greeks and Macedonians
  { ref: "cyrus", slug: "cyrus-the-great", kind: "person", label: "Cyrus the Great", qid: "Q8423", link: "contemporary_of", description: "Founder of the Persian (Achaemenid) empire, who began its push into the north-west of South Asia." },
  { ref: "darius", slug: "darius-i", kind: "person", label: "Darius I", qid: "Q44387", link: "contemporary_of", description: "Persian king (522–486 BCE) who names Gandāra among his provinces at Behistun and, Herodotus says, subdued the Indians.", aliases: [{ label: "Dareios", lang: "en", note: "Macaulay's Herodotus" }] },
  { ref: "herodotus", slug: "herodotus", kind: "person", label: "Herodotus", qid: "Q26825", link: "contemporary_of", description: "Greek historian of the fifth century BCE, whose Histories describe India as the richest province of the Persian empire." },
  { ref: "skylax", slug: "scylax-of-caryanda", kind: "person", label: "Skylax of Caryanda", qid: "Q453311", link: "contemporary_of", description: "Greek sea-captain whom, Herodotus says, Darius sent down the Indus to the sea.", aliases: [{ label: "Scylax", lang: "en" }] },
  { ref: "porus", slug: "porus", kind: "person", label: "Porus", qid: "Q28935", link: "participant_in", description: "King between the Hydaspes and the Acesines whom Alexander defeated in 326 BCE and left on his throne; known only from Greek sources.", aliases: [{ label: "Poros", lang: "grc-Latn" }] },
  { ref: "taxiles", slug: "taxiles", kind: "person", label: "Taxiles", qid: "Q724136", link: "participant_in", description: "Ruler of Taxila who received Alexander in 326 BCE.", aliases: [{ label: "Āmbhi", lang: "sa-Latn" }, { label: "Omphis", lang: "grc-Latn" }] },
  // Scholars
  { ref: "rhysdavids", slug: "t-w-rhys-davids", kind: "person", label: "T. W. Rhys Davids", qid: "Q966962", life: true, description: "British scholar of Pāli who translated the suttas and wrote Buddhist India (1903).", aliases: [{ label: "Thomas William Rhys Davids", lang: "en" }] },
  { ref: "geiger", slug: "wilhelm-geiger", kind: "person", label: "Wilhelm Geiger", qid: "Q76695", life: true, description: "German scholar who edited and translated the Mahāvaṃsa (1908, 1912) and computed the Buddha's death as 483 BCE." },
  { ref: "jacobi", slug: "hermann-jacobi", kind: "person", label: "Hermann Jacobi", qid: "Q73862", life: true, description: "German Indologist who translated the Jaina Sūtras (1884, 1895) and argued that Pārśva was historical." },
  // Places and sites
  { ref: "rajagaha", slug: "rajagaha", kind: "place", label: "Rājagaha", qid: "Q863683", geo: "approximate", link: "related_to", description: "The first capital of Magadha, ringed by hills (present-day Rajgir in Bihar).", aliases: [{ label: "Rājagṛha", lang: "sa-Latn" }, { label: "Rajgir", lang: "en", note: "The modern town" }, { label: "Girivraja", lang: "sa-Latn", note: "The old name in the Purāṇas" }] },
  { ref: "vesali", slug: "vesali", kind: "site", label: "Vesālī", qid: "Q1509463", geo: "exact", link: "related_to", description: "The city of the Licchavis and seat of the Vajjian league, conquered by Ajātasattu.", aliases: [{ label: "Vaiśālī", lang: "sa-Latn" }, { label: "Vaishali", lang: "en" }] },
  { ref: "savatthi", slug: "savatthi", kind: "site", label: "Sāvatthi", qid: "Q2594448", geo: "exact", link: "related_to", description: "Capital of Kosala, one of the six great cities of the Buddha's time.", aliases: [{ label: "Śrāvastī", lang: "sa-Latn" }, { label: "Shravasti", lang: "en" }] },
  { ref: "kosambi", slug: "kosambi", kind: "place", label: "Kosambī", qid: "Q1194868", geo: "approximate", link: "related_to", description: "Capital of the Vatsas on the Yamunā, one of the great cities of the Buddha's time.", aliases: [{ label: "Kauśāmbī", lang: "sa-Latn" }, { label: "Kausambi", lang: "en" }] },
  { ref: "kusinara", slug: "kusinara", kind: "place", label: "Kusinārā", qid: "Q825673", geo: "approximate", link: "related_to", description: "Town of the Mallas where the Buddha died (present-day Kushinagar).", aliases: [{ label: "Kuśinagara", lang: "sa-Latn" }, { label: "Kushinagar", lang: "en", note: "The modern town" }] },
  { ref: "bodhgaya", slug: "bodh-gaya", kind: "place", label: "Bodh Gayā", qid: "Q176767", geo: "approximate", link: "related_to", description: "The place in Magadha where, by tradition, the Buddha attained insight.", aliases: [{ label: "Uruvelā", lang: "pi-Latn", note: "The name in the suttas" }] },
  { ref: "kapilavatthu", slug: "kapilavatthu", kind: "site", label: "Kapilavatthu", qid: "Q30610827", geo: "approximate", geoNote: "Coordinates from Wikidata; which excavated site is the ancient town is debated.", link: "related_to", description: "Town of the Sakya clan, where its assembly met in a mote hall; the Buddha's home.", aliases: [{ label: "Kapilavastu", lang: "sa-Latn" }] },
  { ref: "benares", slug: "varanasi", kind: "place", label: "Benares (Vārāṇasī)", qid: "Q79980", geo: "approximate", link: "related_to", description: "City of Kāsī on the Ganges; the Buddha gave his first sermon in the Deer Park nearby.", aliases: [{ label: "Vārāṇasī", lang: "sa-Latn" }, { label: "Benares", lang: "en" }, { label: "Varanasi", lang: "en" }] },
  { ref: "behistun", slug: "behistun-inscription", kind: "inscription", label: "Behistun inscription", qid: "Q180012", geo: "exact", link: "contemporary_of", description: "Darius I's rock inscription in western Iran, in three languages, listing the provinces of his empire; Gandāra is among them.", aliases: [{ label: "Bisotun inscription", lang: "en" }] },
  // Events
  { ref: "hydaspes", slug: "battle-of-the-hydaspes", kind: "event", label: "Battle of the Hydaspes", qid: "Q213074", geo: "approximate", link: "part_of", description: "Alexander's victory over Porus on the Hydaspes (Jhelum) in 326 BCE.", when: { start: bce(326, false), basis: "Arrian V.19: archonship of Hegemon, month Munychion; April–May 326 BCE (Chinnock)" } },
  { ref: "alexcampaign", slug: "alexanders-indian-campaign", kind: "event", label: "Alexander's Indian campaign", qid: "Q4200795", link: "part_of", description: "Alexander of Macedon's campaign in the north-west of South Asia, 327–325 BCE, which turned back at the Hyphasis (Beas).", when: { start: bce(327, false), end: bce(325, false), basis: "Wikipedia, Indian campaign of Alexander the Great" } },
];

/** Glossary terms (kind "term"). */
const TERMS: EntitySpec[] = [
  { ref: "t_mahajanapada", slug: "mahajanapada", kind: "term", label: "mahājanapada", description: "“Great country”, or “great people”: one of the sixteen states named in an old Buddhist list. Janapada first meant the land where a people (jana) had settled.", aliases: [{ label: "mahajanapada", lang: "en" }, { label: "janapada", lang: "sa-Latn" }] },
  { ref: "t_gana", slug: "gana-sangha", kind: "term", label: "gaṇa-saṅgha", description: "A state ruled by a clan or group of clans through an assembly, not by a hereditary king; often translated “republic”, though power usually lay with a warrior aristocracy.", aliases: [{ label: "gana-sangha", lang: "en" }, { label: "republic", lang: "en", note: "Rhys Davids's word; contested" }] },
  { ref: "t_santhagara", slug: "santhagara", kind: "term", label: "santhāgāra", description: "The assembly hall of a clan state, where its members met to decide business; Rhys Davids translates it “Mote Hall”.", aliases: [{ label: "Mote Hall", lang: "en", note: RD }] },
  { ref: "t_sramana", slug: "sramana", kind: "term", label: "śramaṇa", description: "A wandering ascetic who had left home, outside the brahmin priesthood. The Buddha, Mahāvīra and the other teachers of the age were śramaṇas.", aliases: [{ label: "samaṇa", lang: "pi-Latn" }, { label: "shramana", lang: "en" }] },
  { ref: "t_nibbana", slug: "nirvana", kind: "term", label: "nirvāṇa", description: "The “blowing out” of craving and rebirth that the Buddha taught as the goal; his death is called his final nirvāṇa (parinibbāna).", aliases: [{ label: "nibbāna", lang: "pi-Latn" }, { label: "nirvana", lang: "en" }] },
  { ref: "t_kevalin", slug: "kevalin", kind: "term", label: "kevalin", description: "In Jainism, one who has attained perfect knowledge (kevala). Mahāvīra became a kevalin after twelve years of austerities." },
  { ref: "t_nigantha", slug: "nigantha", kind: "term", label: "Nigaṇṭha", description: "“Without bonds”: the Buddhist name for the Jain monks and their order. Mahāvīra is the Nigaṇṭha Nātaputta of the suttas.", aliases: [{ label: "Nirgrantha", lang: "sa-Latn" }] },
  { ref: "t_ajivika", slug: "ajivika", kind: "term", label: "Ājīvika", qid: "Q412873", description: "A school of ascetics led in the Buddha's time by Makkhali Gosāla, known mainly from its rivals' accounts of its belief in fate.", aliases: [{ label: "Ajivika", lang: "en" }] },
  { ref: "t_satrapy", slug: "satrapy", kind: "term", label: "satrapy", description: "A province of the Persian empire. The Indian provinces are called satrapies by convention, though no governor (satrap) is known for them." },
  { ref: "t_varna", slug: "varna", kind: "term", label: "varṇa", description: "One of the four orders of society in brahmin texts: brāhmaṇa (priests), kṣatriya (warriors and rulers), vaiśya and śūdra. The Purāṇas stress that the Nandas were born of a śūdra mother.", aliases: [{ label: "varna", lang: "en" }, { label: "kṣatriya", lang: "sa-Latn" }, { label: "śūdra", lang: "sa-Latn" }] },
  { ref: "t_nbpw", slug: "northern-black-polished-ware", kind: "term", label: "Northern Black Polished Ware", qid: "Q2495995", description: "A glossy black pottery of the Ganges plain, c. 700–200 BCE, which archaeologists use to recognise the towns of this age.", aliases: [{ label: "NBPW", lang: "en" }] },
];

/** Entities on the platform before this page that it links to the period. */
const EXISTING_LINKS: { slug: string; type: "part_of" | "participant_in" | "related_to" | "contemporary_of"; note: string }[] = [
  { slug: "haryanka-dynasty", type: "part_of", note: "Magadha's dynasty of Bimbisāra and Ajātasattu." },
  { slug: "shishunaga-dynasty", type: "part_of", note: "Magadha's dynasty after the Haryankas." },
  { slug: "achaemenid-empire", type: "contemporary_of", note: "Persia held Gandhāra and the Indus from the late sixth century BCE." },
  { slug: "alexander-the-great", type: "participant_in", note: "Campaigned in the north-west, 327–325 BCE." },
  { slug: "pataliputra", type: "related_to", note: "Founded as the fort of Pāṭaligāma under Ajātasattu; later Magadha's capital." },
  { slug: "ujjain", type: "related_to", note: "Ujjenī, capital of Avanti." },
  { slug: "taxila", type: "related_to", note: "City of Gandhāra, under Persia and then visited by Alexander." },
  { slug: "sarnath", type: "related_to", note: "The Deer Park near Benares, where the Buddha gave his first sermon." },
  { slug: "lumbini", type: "related_to", note: "The Buddha's birthplace by tradition." },
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
  for (const s of ENTITIES) {
    if (!s.link || !out.ref[s.ref]!.startsWith("@")) continue;
    out.ops.push({ op: "link_entities", from: out.ref[s.ref]!, to: PERIOD, type: s.link, ...(s.linkNote ? { note: s.linkNote } : {}) });
  }
  for (const l of EXISTING_LINKS) out.ops.push({ op: "link_entities", from: l.slug, to: PERIOD, type: l.type, note: l.note });
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

/**
 * Links Cliopatria's "Janapada of …" rows to the polities created here. The
 * importer left them unlinked because no polity entities existed for them.
 */
export async function extentOps(mcp: Mcp, E: Record<string, string>): Promise<ChangeOpInput[]> {
  const byName = new Map(JANAPADAS.map((j) => [j.extentName!, j.ref]));
  const rows = new Map<string, ExtentRow>();
  for (let year = -599; year <= -320; year += 5) {
    const r = await mcp.call<{ extents: ExtentRow[] }>("extents_at", { year, bbox: [55, 0, 100, 42] });
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

export function mahajanapadaOps(s: Snaps, E: Record<string, string>): ChangeOpInput[] {
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
  const pd = (pub: number, who: string, died: number | null, extra = "") =>
    died
      ? `Published ${pub}; ${who} died ${died} (Wikidata). Public domain in India (life + 60) and the US (published before 1931).${extra}`
      : `Published ${pub}; public domain in the US (published before 1931). ${who}'s death date was not checked.${extra}`;
  const modern = (ref: string, csl: { title: string } & Record<string, unknown>, ids: Record<string, unknown>, lenses: string[] = ["mainstream_academic"]): ChangeOpInput => ({
    op: "create_source",
    ref,
    kind: csl.type === "article-journal" ? "article" : "book",
    tier: "secondary",
    csl: { type: "book", ...csl },
    identifiers: ids,
    license: { status: "copyrighted", note: "Cited by location only, as given by Wikipedia; not read or quoted here." },
    lenses: lenses as never,
  });

  const ops: ChangeOpInput[] = [
    // ------------------------------------------------------------ sources
    {
      op: "create_source",
      ref: "s_bi",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Buddhist India", author: [{ family: "Rhys Davids", given: "T. W." }], issued: { "date-parts": [[1903]] }, publisher: "T. Fisher Unwin", "publisher-place": "London", "collection-title": "The Story of the Nations" },
      identifiers: ia("buddhistindia00davirich"),
      license: { status: "public_domain", note: pd(1903, "Rhys Davids", 1922) },
      lenses: ["philological"],
      note: "An early history of the period drawn from the Pāli texts. Some of its conclusions (for instance on coinage) are outdated; it is quoted for what the texts say and for its own arguments, marked as such.",
    },
    {
      op: "create_source",
      ref: "s_sbe11",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "Buddhist Suttas", translator: [{ family: "Rhys Davids", given: "T. W." }], issued: { "date-parts": [[1881]] }, publisher: "Clarendon Press", "publisher-place": "Oxford", "collection-title": "Sacred Books of the East", volume: "XI" },
      identifiers: ia("buddhistsuttas00daviuoft"),
      license: { status: "public_domain", note: pd(1881, "Rhys Davids", 1922) },
      lenses: ["primary_source"],
      note: "Translations from the Pāli canon, including the Mahāparinibbāna Sutta and the Dhammacakkappavattana Sutta. The canon was handed down orally and written down centuries after the Buddha; the translator's introductions are his own scholarship of 1881.",
    },
    {
      op: "create_source",
      ref: "s_dial1",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "Dialogues of the Buddha, part I", translator: [{ family: "Rhys Davids", given: "T. W." }], issued: { "date-parts": [[1899]] }, publisher: "Henry Frowde", "publisher-place": "London", "collection-title": "Sacred Books of the Buddhists", volume: "II" },
      identifiers: ia("dialoguesofbuddh01davi"),
      license: { status: "public_domain", note: pd(1899, "Rhys Davids", 1922) },
      lenses: ["primary_source"],
      note: "The first third of the Dīgha Nikāya, including the Sāmaññaphala Sutta. Its account of the other teachers is their Buddhist rivals' summary.",
    },
    {
      op: "create_source",
      ref: "s_mhv",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Mahāvaṃsa, or the Great Chronicle of Ceylon", author: [{ literal: "Mahānāma (attributed)" }], translator: [{ family: "Geiger", given: "Wilhelm" }, { family: "Bode", given: "Mabel Haynes" }], issued: { "date-parts": [[1912]] }, publisher: "Oxford University Press for the Pali Text Society", "publisher-place": "London" },
      identifiers: ia("mahavamsagreatch00geigrich"),
      license: { status: "public_domain", note: "Published 1912; Geiger died 1943 and Bode 1922 (Wikidata). Public domain in the US (published before 1931) and in India (life + 60)." },
      composed: { start: { year: 500, era: "CE", approximate: true }, basis: "A Sri Lankan Buddhist chronicle of the fifth or sixth century CE" },
      lenses: ["primary_source"],
      note: "A devotional chronicle written a thousand years after the events it opens with. It is the source of the long chronology of the Buddha; Geiger's introduction is his scholarship of 1912.",
    },
    {
      op: "create_source",
      ref: "s_jacobi",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "Gaina Sūtras, part I: The Âkârâṅga Sûtra; The Kalpa Sûtra", translator: [{ family: "Jacobi", given: "Hermann" }], issued: { "date-parts": [[1884]] }, publisher: "Clarendon Press", "publisher-place": "Oxford", "collection-title": "Sacred Books of the East", volume: "XXII" },
      identifiers: ia("gainasutras01jacouoft"),
      license: { status: "public_domain", note: pd(1884, "Jacobi", 1937) },
      lenses: ["primary_source", "philological"],
      note: "Two texts of the Śvetāmbara Jain canon, written down long after Mahāvīra; Jacobi's introduction is his scholarship of 1884.",
    },
    {
      op: "create_source",
      ref: "s_pargiter",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Purana Text of the Dynasties of the Kali Age", author: [{ family: "Pargiter", given: "F. E." }], issued: { "date-parts": [[1913]] }, publisher: "Oxford University Press", "publisher-place": "London" },
      identifiers: ia("dli.csl.5891"),
      license: { status: "public_domain", note: pd(1913, "Pargiter", 1927) },
      lenses: ["philological"],
      note: "The dynastic lists of several Purāṇas, edited and translated. The Purāṇas cast them as prophecy and were compiled centuries later.",
    },
    {
      op: "create_source",
      ref: "s_herod1",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The History of Herodotus, vol. I", author: [{ literal: "Herodotus" }], translator: [{ family: "Macaulay", given: "G. C." }], issued: { "date-parts": [[1890]] }, publisher: "Macmillan", "publisher-place": "London" },
      identifiers: ia("historyofherodo01hero"),
      license: { status: "public_domain", note: pd(1890, "Macaulay", 1915) },
      lenses: ["primary_source"],
      note: "Herodotus wrote in the fifth century BCE from Greek and Persian report; he never visited India.",
    },
    {
      op: "create_source",
      ref: "s_herod2",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The History of Herodotus, vol. II", author: [{ literal: "Herodotus" }], translator: [{ family: "Macaulay", given: "G. C." }], issued: { "date-parts": [[1890]] }, publisher: "Macmillan", "publisher-place": "London" },
      identifiers: ia("historyofherodo02hero"),
      license: { status: "public_domain", note: pd(1890, "Macaulay", 1915) },
      lenses: ["primary_source"],
    },
    {
      op: "create_source",
      ref: "s_behistun",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Sculptures and Inscription of Darius the Great on the Rock of Behistûn in Persia", author: [{ family: "King", given: "L. W." }, { family: "Thompson", given: "R. C." }], issued: { "date-parts": [[1907]] }, publisher: "British Museum", "publisher-place": "London" },
      identifiers: ia("sculpturesinscri00brituoft"),
      license: { status: "public_domain", note: "Published 1907; King died 1919 and Thompson 1941 (Wikidata). Public domain in the US (published before 1931) and in India." },
      lenses: ["primary_source"],
      note: "Text and translation of Darius I's inscription, carved c. 520–518 BCE.",
    },
    {
      op: "create_source",
      ref: "s_smith1914",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Early History of India, from 600 B.C. to the Muhammadan Conquest", author: [{ family: "Smith", given: "Vincent A." }], issued: { "date-parts": [[1914]] }, edition: "3rd", publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: ia("earlyhistoryofin00smit"),
      license: { status: "public_domain", note: pd(1914, "Smith", 1920) },
      lenses: ["colonial_orientalist"],
      note: "Quoted for the views of 1914, not as a current authority.",
    },
    {
      op: "create_source",
      ref: "s_arrian",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Anabasis of Alexander", author: [{ literal: "Arrian" }], translator: [{ family: "Chinnock", given: "E. J." }], issued: { "date-parts": [[1884]] }, publisher: "Hodder and Stoughton", "publisher-place": "London" },
      identifiers: ia("theanabasisofale46976gut"),
      license: { status: "public_domain", note: "Published 1884; public domain in the US (published before 1931). Chinnock's death date was not checked. Quoted from the Project Gutenberg transcription held at Internet Archive, so locators are book and chapter." },
      lenses: ["primary_source"],
      note: "Arrian wrote in the second century CE, from the memoirs of Ptolemy and Aristobulus, who served with Alexander.",
    },
    {
      op: "create_source",
      ref: "s_mccrindle",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Invasion of India by Alexander the Great, as described by Arrian, Q. Curtius, Diodoros, Plutarch and Justin", translator: [{ family: "McCrindle", given: "J. W." }], issued: { "date-parts": [[1896]] }, edition: "new ed.", publisher: "Archibald Constable", "publisher-place": "Westminster" },
      identifiers: ia("invasionofindiab00mccr"),
      license: { status: "public_domain", note: pd(1896, "McCrindle", 1913) },
      lenses: ["primary_source"],
      note: "Translations of the Greek and Roman accounts, all written centuries after Alexander.",
    },
    ...(
      [
        ["s_wpMj", "wpMj"], ["s_wpUrban", "wpUrban"], ["s_wpNbpw", "wpNbpw"], ["s_wpHaryanka", "wpHaryanka"], ["s_wpShishunaga", "wpShishunaga"],
        ["s_wpNanda", "wpNanda"], ["s_wpBimbisara", "wpBimbisara"], ["s_wpAjatashatru", "wpAjatashatru"], ["s_wpPasenadi", "wpPasenadi"],
        ["s_wpMahavira", "wpMahavira"], ["s_wpParshva", "wpParshva"], ["s_wpBuddha", "wpBuddha"], ["s_wpGana", "wpGana"],
        ["s_wpAchaemenid", "wpAchaemenid"], ["s_wpAlexander", "wpAlexander"], ["s_wpPorus", "wpPorus"], ["s_wpTaxila", "wpTaxila"],
      ] as [string, CaptureKey][]
    ).map(([ref, k]) => wpSource(ref, k)),
    // Modern scholarship (copyrighted), by location only, as cited by Wikipedia.
    modern("s_usingh", { title: "A History of Ancient and Early Medieval India: From the Stone Age to the 12th Century", author: [{ family: "Singh", given: "Upinder" }], issued: { "date-parts": [[2008]] }, publisher: "Pearson Education India", "publisher-place": "New Delhi" }, { isbn: ["978-81-317-1677-9"] }),
    modern("s_cousins", { type: "article-journal", title: "The Dating of the Historical Buddha: A Review Article", author: [{ family: "Cousins", given: "L. S." }], "container-title": "Journal of the Royal Asiatic Society, third series", volume: "6", issue: "1", page: "57–63", issued: { "date-parts": [[1996]] } }, { doi: "10.1017/s1356186300014760" }),
    modern("s_narain", { title: "The Date of the Historical Śākyamuni Buddha", editor: [{ family: "Narain", given: "A. K." }], issued: { "date-parts": [[2003]] }, publisher: "B. R. Publishing", "publisher-place": "New Delhi" }, { isbn: ["81-7646-353-1"] }),
    modern("s_fogelin", { title: "An Archaeological History of Indian Buddhism", author: [{ family: "Fogelin", given: "Lars" }], issued: { "date-parts": [[2015]] }, publisher: "Oxford University Press" }, { isbn: ["978-0-19-026692-9"] }, ["archaeological"]),
    modern("s_sarao", { type: "article-journal", title: "The Ācariyaparamparā and Date of the Buddha", author: [{ family: "Sarao", given: "K. T. S." }], "container-title": "Indian Historical Review", volume: "30", issued: { "date-parts": [[2003]] }, page: "1–12" }, { doi: "10.1177/037698360303000201" }),
    modern("s_sharma_republics", { title: "Republics in Ancient India, c. 1500 B.C.–500 B.C.", author: [{ family: "Sharma", given: "J. P." }], issued: { "date-parts": [[1968]] }, publisher: "Brill", "publisher-place": "Leiden" }, {}),
    modern("s_thapar", { title: "Early India: From the Origins to AD 1300", author: [{ family: "Thapar", given: "Romila" }], issued: { "date-parts": [[2002]] }, publisher: "University of California Press" }, { isbn: ["0-520-24225-4"] }),
    modern("s_dundas", { title: "The Jains", author: [{ family: "Dundas", given: "Paul" }], issued: { "date-parts": [[2002]] }, edition: "2nd", publisher: "Routledge" }, { isbn: ["978-0-415-26605-5"] }),
    modern("s_habib_jha", { title: "Mauryan India", author: [{ family: "Habib", given: "Irfan" }, { family: "Jha", given: "Vivekanand" }], issued: { "date-parts": [[2004]] }, publisher: "Tulika Books", "collection-title": "A People's History of India" }, { isbn: ["978-81-85229-92-8"] }),
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

  x("x_bi_sixteen", "s_bi", "bi", "The political divisions of India at or shortly before the time when Buddhism arose are well exemplified by the stock list of the Sixteen Great Countries, the Sixteen Powers, which is found in several places in the books.", {"page": "23", "chapter": "II", "label": "Chapter II, The Clans and Nations"}, "Footnote gives the sources: Anguttara i. 213; iv. 252, 256, 260; Vinaya Texts ii. 146. The list itself (Anga, Magadha, Kasi, Kosala, Vajji, Malla, Ceti, Vamsa, Kuru, Pancala, Maccha, Surasena, Assaka, Avanti, Gandhara, Kamboja) is printed as a two-column table on pp. 23 that OCR scatters; it cannot be quoted as running text.");
  x("x_bi_peoples", "s_bi", "bi", "It is interesting to notice that the names are names, not of countries, but of peoples, as we might say Italians or Turks.", {"page": "23", "chapter": "II"});
  x("x_bi_tribal", "s_bi", "bi", "This shows that the main idea in the minds of those who drew up, or used, this old list was still tribal and not geographical.", {"page": "23", "chapter": "II"});
  x("x_bi_no_paramount", "s_bi", "bi", "When Buddhism arose there was no paramount sovereign in India.", {"page": "1", "chapter": "I", "label": "Chapter I, The Kings"});
  x("x_bi_four_kingdoms", "s_bi", "bi", "we find, besides a still surviving number of small aristocratic republics, four kingdoms of considerable extent and power.", {"page": "1", "chapter": "I"});
  x("x_bi_absorption", "s_bi", "bi", "And the tendency towards the gradual absorption of these domains, and also of the republics, into the neighbouring kingdoms", {"page": "1", "chapter": "I"}, "Continues on p. 2: 'was already in full force'.");
  x("x_bi_brahmin_books", "s_bi", "bi", "They have relied for their information about the Indian peoples too exclusively on the brahmin books.", {"page": "2", "chapter": "I"}, "OCR has a footnote mark after 'brahmin'.");
  x("x_bi_magadha", "s_bi", "bi", "The kingdom of Magadha, with its capital at Rajagaha (afterwards at Pataliputta), reigned over at first by King Bimbisara and afterwards by his son Ajatasattu.", {"page": "3", "chapter": "I"});
  x("x_bi_kosala", "s_bi", "bi", "To the north-west there was the kingdom of Kosala — the Northern Kosala — with its capital at Savatthi, ruled over at first by King Pasenadi and afterwards by his son Vidudabha.", {"page": "3", "chapter": "I"});
  x("x_bi_vamsa", "s_bi", "bi", "Southwards from Kosala was the kingdom of the Vamsas or Vatsas, with their capital at Kosambi on the Jumna, reigned over by King Udena, the son of Parantapa.", {"page": "3", "chapter": "I"}, "OCR 'Varnsas'.");
  x("x_bi_avanti", "s_bi", "bi", "And still farther south lay the kingdom of Avanti, with its capital Ujjeni, reigned over by King Pajjota.", {"page": "3", "chapter": "I"});
  x("x_bi_alliances", "s_bi", "bi", "The royal families of these kingdoms were united by matrimonial alliances ; and were also, not seldom in consequence of those very alliances, from time to time at war.", {"page": "3", "chapter": "I"});
  x("x_bi_parricide", "s_bi", "bi", "When Ajatasattu, Bimbisara's son by another wife (the Videha lady from Mithila), put his father Bimbisara to death, the Kosala Devi died of grief.", {"page": "3", "chapter": "I"});
  x("x_bi_vesali_destroyed", "s_bi", "bi", "having succeeded, by the treachery of the brahmin Vassakara, in sowing dissension among the leading families of Vesali, he swooped down upon the place with an overwhelming force, and completely destroyed it.", {"page": "13", "chapter": "I"}, "Of Ajatasattu. Note: on p. 41 Rhys Davids says the Vajjian confederacy was 'defeated, but not broken up' by Ajatasattu — the two statements differ.");
  x("x_bi_vajji_not_broken", "s_bi", "bi", "federacy, afterwards defeated, but not broken up, by Ajatasattu.", {"page": "41", "chapter": "III", "label": "Chapter III, The Villages (on Vesali)"}, "The sentence begins on p. 40: 'It was the headquarters of the powerful Vajjian con-'.");
  x("x_bi_ujjeni_magadha", "s_bi", "bi", "We know that afterwards, in the fourth century B.C., Ujjeni had become subject to Magadha, and that Asoka, when a young man, was appointed governor of Ujjeni.", {"page": "13", "chapter": "I"});
  x("x_bi_mote_hall", "s_bi", "bi", "The administrative and judicial business of the clan was carried out in public assembly, at which young and old were alike present, in their common Mote Hall (santhagara) at Kapilavastu.", {"page": "19", "chapter": "II"}, "Of the Sakiyas (Sakyas). OCR '{santhdgdrd)'.");
  x("x_bi_raja_consul", "s_bi", "bi", "He bore the title of raja, which must have meant something like the Roman consul, or the Greek archon.", {"page": "19", "chapter": "II"}, "Of the single elected chief of the Sakiya clan.");
  x("x_bi_chief_unknown", "s_bi", "bi", "A single chief — how, and for what period chosen, we do not know — was elected as office-holder, presiding over the sessions, and, if no sessions were sitting, over the State.", {"page": "19", "chapter": "II"});
  x("x_bi_mallas_hall", "s_bi", "bi", "And it is to the Mote Hall of the Mallas that Ananda goes to announce the death of the Buddha, they being then in session there to consider that very matter.", {"page": "19", "chapter": "II"});
  x("x_bi_monarchy", "s_bi", "bi", "And whenever the supreme power in a clan became hereditary, the result seems always to have been an absolute monarchy, without legal limitations of any kind.", {"page": "23", "chapter": "II"});
  x("x_bi_savatthi", "s_bi", "bi", "Savatthi, or Sravasti, was the capital of Northern Kosala, the residence of King Pasenadi, and one of the six great cities in India during the lifetime of the Buddha.", {"page": "40", "chapter": "III"}, "OCR 'Sdvatthi', 'ftie', 'Hfetime'.");
  x("x_bi_saketa", "s_bi", "bi", "But it is Saketa, and not Ayojjha, that is called one of the six great cities of India.", {"page": "39", "chapter": "III"});
  x("x_bi_vesali_only", "s_bi", "bi", "It was the only great city in all the territories of the free clans who formed so important a factor in the social and political life of the sixth century B.C.", {"page": "41", "chapter": "III"});
  x("x_bi_writing", "s_bi", "bi", "It is evident, therefore, that writing was in vogue at the time these passages were composed", {"page": "109", "chapter": "VII", "label": "Chapter VII, Writing — the Beginnings"});
  x("x_bi_writing_books", "s_bi", "bi", "for such purposes, writing, however well known, had not yet come into use.", {"page": "109", "chapter": "VII"}, "That is, not yet used for writing down books.");
  x("x_sbe_attack", "s_sbe11", "sbe11", "in his eagerness to attack the Vajjians, has resolved, \"I will root out these Vajjians, mighty, and powerful though they be, I will destroy these Vajjians, I will bring these Vajjians to utter ruin!\"", {"page": "2", "chapter": "I", "section": "2", "label": "Maha-parinibbana Sutta, ch. I, § 2"}, "OCR renders 'Vajjians' as 'Va^^ians' etc.");
  x("x_sbe_vassakara", "s_sbe11", "sbe11", "So he spake to the Brahman Vassakara, the prime-minister of Magadha, and said:", {"page": "2", "chapter": "I", "section": "2"});
  x("x_sbe_assemblies", "s_sbe11", "sbe11", "So long, Ananda,' rejoined the Blessed One, ' as the Vajjians hold these full and frequent public assemblies ; so long may they be expected not to decline, but to prosper.", {"page": "3", "chapter": "I", "section": "4"}, "The first of seven conditions of welfare for the Vajjian confederacy.");
  x("x_sbe_concord", "s_sbe11", "sbe11", "So long, Ananda, as the Vajjians meet together in concord, and rise in concord, and carry out their undertakings in concord", {"page": "3", "chapter": "I", "section": "4"});
  x("x_sbe_fortress", "s_sbe11", "sbe11", "At that time Sunidha and Vassakara, the chief ministers of Magadha, were building a fortress at Pataligama to repel the Vajjians", {"page": "18", "chapter": "I", "section": "26"});
  x("x_sbe_pataliputta", "s_sbe11", "sbe11", "And among famous places of residence and haunts of busy men, this will become the chief, the city of Pataliputta, a centre for the interchange of all kinds of wares.", {"page": "18", "chapter": "I", "section": "28"}, "Presented as the Buddha's prophecy; the translator's note says it matters to the orthodox as proof of the Buddha's power of prophecy.");
  x("x_sbe_three_dangers", "s_sbe11", "sbe11", "But three dangers will hang over Pataliputta, that of fire, that of water, and that of dissension", {"page": "18", "chapter": "I", "section": "28"});
  x("x_sbe_eighty", "s_sbe11", "sbe11", "I too, O Ananda, am now grown old, and full of years, my journey is drawing to its close, I have reached my sum of days, I am turning eighty years of age", {"page": "37", "chapter": "II", "section": "32"});
  x("x_sbe_cart", "s_sbe11", "sbe11", "and just as a worn-out cart, Ananda, can only with much additional care be made to move along, so, methinks, the body of the Tathagata can only be kept going with much additional care", {"page": "37", "chapter": "II", "section": "32"});
  x("x_sbe_four_places", "s_sbe11", "sbe11", "There are these four places, Ananda, which the believing man should visit with feelings of reverence and awe.", {"page": "90", "chapter": "V", "section": "16"}, "§§ 17–20: where the Tathagata was born, attained insight, set the kingdom of righteousness on foot (first sermon), and passed away.");
  x("x_sbe_born", "s_sbe11", "sbe11", "The place, Ananda, at which the believing man can say, \"Here the Tathagata was born!\" is a spot to be visited with feelings of reverence and awe.", {"page": "90", "chapter": "V", "section": "17"});
  x("x_sbe_great_cities", "s_sbe11", "sbe11", "For, Lord, there are other great cities, such as Champa, Rajagaha, Savatthi, Saketa, Kosambi, and Benares, Let the Blessed One die in one of them.", {"page": "99", "chapter": "V", "section": "41"}, "Ananda's plea that the Buddha not die in 'this little wattel and daub town' (Kusinara). OCR 'A'ampa', 'Ra^agaha'.");
  x("x_sbe_little_town", "s_sbe11", "sbe11", "Let not the Blessed One die in this little wattel and daub town, in this town in the midst of the jungle, in this branch township", {"page": "99", "chapter": "V", "section": "41"});
  x("x_sbe_rd_date", "s_sbe11", "sbe11", "This would make the date of the Great Decease about 420-400 B.C. (very possibly a year or two later), and the date of Gotama's birth therefore eighty years earlier, or in round numbers about 500 B.C.", {"page": "xlviii", "label": "Introduction to the Maha-parinibbana Sutta"}, "Rhys Davids' short chronology (1881).");
  x("x_sbe_rd_150", "s_sbe11", "sbe11", "The shorter period of 150 years between Asoka and the Great Decease agrees much better with what we know of the literary history of Buddhism during that interval.", {"page": "xlvii", "label": "Introduction (page inferred)"});
  x("x_sbe_rd_543", "s_sbe11", "sbe11", "The date 543 B. c, still unfortunately accepted outside the circle of students of Buddhism, is now acknowledged to be too early by all scholars who have seriously considered the subject.", {"page": "xlviii", "label": "Introduction"}, "543 BCE is the traditional Sri Lankan/Theravada date.");
  x("x_sbe_rd_485", "s_sbe11", "sbe11", "only differs by a little more than half a century from the earliest date which can in any case be suggested as approximately correct (that is about 485 b. c).", {"page": "xlviii", "label": "Introduction"});
  x("x_sbe_first_sermon", "s_sbe11", "sbe11", "Thus have I heard. The Blessed One was once staying at Benares, at the hermitage called Migadaya. And there the Blessed One addressed the company of the five Bhikkhus", {"page": "146", "section": "1", "label": "Dhamma-kakka-ppavattana Sutta (The Foundation of the Kingdom of Righteousness), § 1 (page inferred)"}, "Migadaya = the Deer Park (Isipatana, Sarnath); the name Isipatana does not occur in this passage.");
  x("x_sbe_two_extremes", "s_sbe11", "sbe11", "There are two extremes, O Bhikkhus, which the man who has given up the world ought not to follow", {"page": "146", "section": "2", "label": "Dhamma-kakka-ppavattana Sutta, § 2 (page inferred)"});
  x("x_sbe_middle_path", "s_sbe11", "sbe11", "There is a middle path, O Bhikkhus, avoiding these two extremes, discovered by the Tathagata", {"page": "147", "section": "3", "label": "Dhamma-kakka-ppavattana Sutta, § 3"});
  x("x_sbe_eightfold", "s_sbe11", "sbe11", "Verily ! it is this noble eightfold path", {"page": "147", "section": "4", "label": "Dhamma-kakka-ppavattana Sutta, § 4"});
  x("x_dial_visit", "s_dial1", "dial1", "Now at that time the king of Magadha, Ajatasattu, the son of the Videha princess, on the Uposatha day", {"page": "65", "label": "Samanna-phala Sutta, § 1 (page inferred)"});
  x("x_dial_six", "s_dial1", "dial1", "Then other five ministers spake in the same terms of Makkhali of the cow-pen", {"page": "66", "section": "3-7", "label": "Samanna-phala Sutta, §§ 3–7"}, "§§ 3–7 continue: Ajita of the garment of hair, Pakudha Kaccayana, Sanjaya of the Belattha clan and the Nigantha of the Nata clan (OCR too garbled to quote); with Purana Kassapa (§ 2) these are the six teachers. See dial_six2.");
  x("x_dial_six2", "s_dial1", "dial1", "and of the Nigantha of the Nata clan. And still, to each, Ajatasattu the king kept silence.", {"page": "66", "section": "7", "label": "Samanna-phala Sutta, § 7"}, "The Nigantha Nataputta is Mahavira.");
  x("x_dial_purana", "s_dial1", "dial1", "There is, Sire, Purana Kassapa, the head of an order, of a following, the teacher of a school, well known and of repute as a sophist", {"page": "66", "section": "2"});
  x("x_dial_gosala", "s_dial1", "dial1", "There are eighty-four hundred thousand periods during which both fools and wise alike, wandering in transmigration, shall at last make an end of pain.", {"page": "72", "section": "20", "label": "Samanna-phala Sutta, Makkhali Gosala's doctrine (page inferred)"});
  x("x_dial_gosala_summary", "s_dial1", "dial1", "Thus, Lord, did Makkhali of the cow-pen, when asked what was the immediate advantage in the life of a recluse, expound his theory of purification through transmigration.", {"page": "73", "label": "Samanna-phala Sutta (page inferred)"});
  x("x_dial_ajita", "s_dial1", "dial1", "There is no such thing, O king, as alms or sacrifice or offering. There is neither fruit nor result of good or evil deeds.", {"page": "73", "section": "23", "label": "Samanna-phala Sutta, § 23, Ajita Kesakambali (page inferred)"});
  x("x_dial_confession", "s_dial1", "dial1", "Sin has overcome me, Lord, weak and foolish and wrong that I am, in that, for the sake of sovranty, I put to death my father, that righteous man, that righteous king !", {"page": "94", "section": "99", "label": "Samanna-phala Sutta, § 99"});
  x("x_mhv_bimbisara", "s_mhv", "mhv", "Two and fifty years he reigned; fifteen years of his reign passed before the meeting with the Conqueror, and yet thirty-seven years (of his reign) followed in the lifetime of the Tathagata.", {"page": "12", "chapter": "II", "verse": "30"}, "Of Bimbisara.");
  x("x_mhv_ajatasattu", "s_mhv", "mhv", "Bimbisara's son, the foolish Ajatasattu, reigned thirty-two years after he, the traitor, had slain (his father).", {"page": "12", "chapter": "II", "verse": "31-32"}, "OCR has verse numbers inside the text.");
  x("x_mhv_nirvana8", "s_mhv", "mhv", "In the eighth year of Ajatasattu the Sage entered into nibbana and thereafter did he, Ajatasattu, reign yet twenty-four years.", {"page": "12", "chapter": "II", "verse": "32"});
  x("x_mhv_parricides", "s_mhv", "mhv", "Then were the citizens wroth, saying : ' This is a dynasty of parricides,' and when they had banished the king Nagadasaka they met together and (since) the minister known by the name Susunaga was proved to be worthy, they anointed him king", {"page": "18", "chapter": "IV", "verse": "5-6", "label": "Chapter IV, The Second Council (page inferred)"});
  x("x_mhv_kalasoka", "s_mhv", "mhv", "He reigned as king eighteen years. His son Kalasoka reigned twenty-eight years.", {"page": "18", "chapter": "IV", "verse": "7-8", "label": "page inferred"});
  x("x_mhv_nandas", "s_mhv", "mhv", "did they reign. Afterwards, the nine Nandas were kings in succession ; they too reigned twenty-two years.", {"page": "27", "chapter": "V", "verse": "14-15"}, "Follows 'The sons of Kalasoka were ten brothers, twenty-two years' (exact, same page). Score is borderline (0.95) because of a footnote numeral after 'Nandas'.");
  x("x_mhv_canakka", "s_mhv", "mhv", "Then did the brahman Canakka anoint a glorious youth, known by the name Candagutta, as king over all Jambudipa, born of a noble clan, the Moriyas, when, filled with bitter hate, he had slain the ninth (Nanda) Dhanananda.", {"page": "27", "chapter": "V", "verse": "16-17"});
  x("x_mhv_vijaya", "s_mhv", "mhv", "The prince named VIJAYA, the valiant, landed in Lanka, in the region called Tambapanni on the day that the Tathagata lay down between the two twinlike sala-trees to pass into nibbana.", {"page": "54", "chapter": "VI", "verse": "47"});
  x("x_mhv_218", "s_mhv", "mhv", "After the Nirvana of the Conqueror and before his (Asoka's) consecration there were 218 years; this should be known", {"page": "xxiii", "label": "Geiger's Introduction, translating Mah. 5. 21 (page inferred)"});
  x("x_mhv_483", "s_mhv", "mhv", "Thus there results as the probable year of the Buddha's death (321 + 162) = 483 B.C. As he died at the age of eighty years the year of his birth should be put at 563 B.C.", {"page": "xxiv", "label": "Geiger's Introduction (page inferred)"}, "OCR prints this in capitals ('YEAS').");
  x("x_mhv_hypothetical", "s_mhv", "mhv", "But we must emphatically state that this calculation too is hypothetical, that we are only able to give an approximate and not a perfectly exact result.", {"page": "xxiv", "label": "Geiger's Introduction (page inferred)"});
  x("x_mhv_321", "s_mhv", "mhv", "It falls in the year 321 B.C. or within two years of this date, allowing for error.", {"page": "xxiv", "label": "Geiger's Introduction (page inferred)"}, "Chandragupta's accession, Geiger's anchor.");
  x("x_mhv_biassed", "s_mhv", "mhv", "chronology from the very fact that Vijaya's arrival in Ceylon is dated on the day of the Buddha's death. This seems to be a biassed account.", {"page": "xxi", "label": "Geiger's Introduction"});
  x("x_mhv_contemporaries", "s_mhv", "mhv", "the last reigns were lengthened in order to make Vijaya and the Buddha contemporaries.", {"page": "xxi", "label": "Geiger's Introduction"});
  x("x_jacobi_kundagrama", "s_jacobi", "jacobi", "both Svetambaras and Digambaras, state that Mahavira was the son of king Siddhartha of Kundapura", {"page": "x", "label": "Introduction (page inferred: the next page is headed xi)"}, "Jacobi then argues the Jains overstated Siddhārtha's rank.");
  x("x_jacobi_suburb", "s_jacobi", "jacobi", "therefore, was probably one of the suburbs of Vaisali, the capital of Videha.", {"page": "xi", "label": "Introduction"});
  x("x_jacobi_noking", "s_jacobi", "jacobi", "From all this it appears that Siddhartha was no king, nor even the head of his clan", {"page": "xii", "label": "Introduction"});
  x("x_jacobi_vaidehi", "s_jacobi", "jacobi", "She is called Vaidehi or Videhadatta, because she belonged to the reigning line of Videha.", {"page": "xii", "label": "Introduction"});
  x("x_jacobi_vesali_senate", "s_jacobi", "jacobi", "they tell us that the government of Vesali was vested in a senate composed of the nobility and presided over by a king, who shared the power with a viceroy and a general-in-chief", {"page": "xii", "label": "Introduction"}, "Jacobi summarising Buddhist works (citing Turnour).");
  x("x_jacobi_bimbisara", "s_jacobi", "jacobi", "Through his mother Mahavira was related to the ruling dynasty in Magadha", {"page": "xiii", "label": "Introduction (page inferred)"});
  x("x_jacobi_ajatasatru", "s_jacobi", "jacobi", "he therefore built the fort at Pataligrama, in order not to repel but subdue the Vajjians or Vrijis, a tribe of Videha, and at last fixed a quarrel on the king of Vaisali, his grandfather.", {"page": "xiv", "label": "Introduction"}, "Of Ajātaśatru; OCR spellings corrected.");
  x("x_jacobi_conquered", "s_jacobi", "jacobi", "We know that Ajatasatru succeeded in conquering Vaisali, and that he laid the foundation of the empire of the Nandas and Mauryas", {"page": "xiv", "label": "Introduction"});
  x("x_jacobi_twelve_years", "s_jacobi", "jacobi", "For twelve years he led a life of austerities, visiting even the wild tribes of the country called Ladha.", {"page": "xv", "label": "Introduction"});
  x("x_jacobi_kevali", "s_jacobi", "jacobi", "From the end of these twelve years of preparatory self-mortification dates Vardhamana's Kevaliship.", {"page": "xv", "label": "Introduction"});
  x("x_jacobi_twentyeight", "s_jacobi", "jacobi", "Then, at the age of twenty-eight, he, with the consent of those in power, entered the spiritual career", {"page": "xv", "label": "Introduction"}, "Jacobi's intro gives 28; the Kalpa Sūtra §147 says he lived thirty years as a householder.");
  x("x_jacobi_nataputta", "s_jacobi", "jacobi", "in whose writings Mahavira is mentioned under his well-known name Nataputta, as the head of the Niganthas or Gaina monks and a rival of Buddha.", {"page": "xvi", "label": "Introduction"});
  x("x_jacobi_parsva", "s_jacobi", "jacobi", "Accordingly the Nirgranthas were probably an old sect at the time of Buddha, and Nataputta only the reformer of the Gaina church, which may have been founded by the twenty-third Tirthakara, Parsva.", {"page": "xxxiv", "label": "Introduction (page inferred: the next page is headed xxxv)"});
  x("x_jacobi_not_new", "s_jacobi", "jacobi", "For the Nirgranthas are never spoken of in the Buddhist writings as a newly risen sect, nor Nataputta as their founder.", {"page": "xxxiv", "label": "Introduction (page inferred)"});
  x("x_kalpa_72", "s_jacobi", "jacobi", "Mahavira lived thirty years as a householder, more than full twelve years in a state inferior to perfection, something less than thirty years as a Kevalin, forty-two years as a monk, and seventy-two years on the whole.", {"page": "269", "chapter": "Kalpa Sūtra, Lives of the Jinas", "verse": "147", "label": "Kalpa Sūtra, Lives of the Jinas, § 147"});
  x("x_kalpa_papa", "s_jacobi", "jacobi", "in the town of Papa, and in king Hastipala's office of the writers", {"page": "269", "verse": "147", "label": "Kalpa Sūtra, Lives of the Jinas, § 147"}, "Where he died.");
  x("x_acaranga_ahimsa", "s_jacobi", "jacobi", "all breathing, existing, living, sentient creatures should not be slain, nor treated with violence, nor abused, nor tormented, nor driven away", {"page": "36", "chapter": "Ācārāṅga Sūtra I.4.1", "verse": "1", "label": "Ācārāṅga Sūtra, Book I, Lecture 4, Lesson 1, § 1"});
  x("x_parg_pradyota", "s_pargiter", "pargiter", "He (Pradyota) will indeed have the neighbouring kings subject to him", {"page": "68", "label": "Pradyotas (translation)"}, "Of Pradyota of Avanti, after Pulika killed his master and anointed his son (OCR of the preceding line is clean only in part).");
  x("x_parg_sisunaga", "s_pargiter", "pargiter", "Sisunaga will destroy all their prestige and will be king. Placing his son in Benares he will make Girivraja his own abode", {"page": "68", "label": "Śiśunāgas (translation)"});
  x("x_parg_udayin", "s_pargiter", "pargiter", "That king will make as his capital on the earth Kusumapura on the south bank of the Ganges in his fourth year", {"page": "69", "label": "Śiśunāgas (translation)"}, "Of Udayin.");
  x("x_parg_nanda", "s_pargiter", "pargiter", "As son of Mahanandin by a sudra woman will be born a king, Mahapadma (Nanda), who will exterminate all ksatriyas. Thereafter kings will be of sudra origin.", {"page": "69", "label": "Nandas (translation)"});
  x("x_parg_sole", "s_pargiter", "pargiter", "Mahapadma will be sole monarch, bringing all under his sole sway.", {"page": "69", "label": "Nandas (translation)"}, "OCR reads “solo monarch”.");
  x("x_parg_kautilya", "s_pargiter", "pargiter", "A brahman Kautilya will uproot them all; and, after they have enjoyed the earth 100 years, it will pass to the Mauryas.", {"page": "69", "label": "Nandas (translation)"});
  x("x_parg_contemporary", "s_pargiter", "pargiter", "Contemporaneous with these aforesaid kings there will be other kings", {"page": "69", "label": "Early contemporary dynasties"}, "Followed by Aikṣvākus, Pañcālas, Kāśī, Haihayas, Kaliṅgas, Aśmakas, Kurus, Maithilas, Śūrasenas, Vītihotras.");
  x("x_herod_tribute", "s_herod1", "herod1", "Of the Indians the number is far greater than that of any other race of men of whom we know ; and they brought in a tribute larger than all the rest, that is to say three hundred and sixty talents of gold-dust : this is the twentieth division.", {"page": "257", "chapter": "III.94", "label": "Book III, ch. 94"});
  x("x_herod_gandarians_tribute", "s_herod1", "herod1", "The Sattagydai and Gandarians and Dadicans and Aparytai, being joined together, brought in one hundred and seventy talents : this is the seventh division.", {"page": "257", "chapter": "III.91", "label": "Book III, ch. 91"});
  x("x_herod_ants", "s_herod1", "herod1", "in this desert and sandy tract are produced ants, which are in size smaller than dogs but larger than foxes", {"page": "259", "chapter": "III.102", "label": "Book III, ch. 102 (page inferred)"});
  x("x_herod_not_subjects", "s_herod1", "herod1", "These tribes of Indians dwell further off than the Persian power extends, and towards the South Wind, and they never became subjects of Dareios.", {"page": "259", "chapter": "III.101", "label": "Book III, ch. 101 (page inferred)"});
  x("x_herod_skylax", "s_herod1", "herod1", "Skylax also, a man of Caryanda. These starting from the city of Caspatyros and the land of Pactyike, sailed down", {"page": "308", "chapter": "IV.44", "label": "Book IV, ch. 44 (page inferred)"});
  x("x_herod_subdued", "s_herod1", "herod1", "Dareios both subdued the Indians and made use of this sea.", {"page": "309", "chapter": "IV.44", "label": "Book IV, ch. 44"});
  x("x_herod_xerxes", "s_herod2", "herod2", "The Indians wore garments made of tree-wool, and they had bows of reed and arrows of reed with iron points.", {"volume": "II", "page": "156", "chapter": "VII.65", "label": "Book VII, ch. 65"}, "“Tree-wool” is cotton.");
  x("x_herod_gandarians_army", "s_herod2", "herod2", "The Parthians and Chorasmians and Sogdians and Gandarians and Dadicans served with the same equipment as the Bactrians.", {"volume": "II", "page": "156", "chapter": "VII.66", "label": "Book VII, ch. 66"});
  x("x_behistun_provinces", "s_behistun", "behistun", "These are the provinces which are subject unto me, and by the grace of Auramazda became I king of them", {"page": "3", "label": "Persian text, translation, col. I, § 6"});
  x("x_behistun_gandara", "s_behistun", "behistun", "Aria, Chorasmia, Bactria, Sogdiana, Gandara, Scythia, Sattagydia, Arachosia and Maka ; twenty-three lands in all.", {"page": "4", "label": "Persian text, translation, col. I, § 6"}, "The list names Gandāra but not India (Hindush), which Darius added later.");
  x("x_smith_darius", "s_smith1914", "smith1914", "Bimbisara and Ajatasatru must be regarded as the contemporaries of Darius, the son of Hystaspes, autocrat of the Persian Empire from 521 to 485 B.C.", {"page": "37", "label": "Chapter II"});
  x("x_smith_skylax", "s_smith1914", "smith1914", "to prove the feasibility of a passage by sea from the mouth of the Indus to Persia.", {"page": "37", "label": "Chapter II"});
  x("x_smith_annex", "s_smith1914", "smith1914", "by utilizing it, Darius was enabled to annex the Indus valley, and to send his fleets into the Indian Ocean.", {"page": "37", "label": "Chapter II"});
  x("x_smith_mahapadma", "s_smith1914", "smith1914", "Mahanandin, the last of the dynasty, is said to have had by a Sudra, or low-caste, woman a son named Mahapadma Nanda, who usurped the throne", {"page": "39", "label": "Chapter II, on Mahāpadma Nanda's usurpation"}, "Smith dates the usurpation “in or about 372 B.C.” in the next line, where the OCR interleaves a marginal date; that line is not quoted.");
  x("x_smith_founder", "s_smith1914", "smith1914", "both Vardhamana Mahavira, the founder of the system known as Jainism, and Gautama, the last Buddha, the founder of Buddhism as known to later ages, were preaching in Magadha during the reign of Bimbisara", {"page": "33", "label": "Chapter II"}, "Smith calls Mahāvīra the founder of Jainism.");
  x("x_smith_487", "s_smith1914", "smith1914", "There is reason to believe that the latter event took place in or about the year 487 B.C.", {"page": "33", "label": "Chapter II"}, "The death of the Buddha.");
  x("x_smith_487b", "s_smith1914", "smith1914", "Assuming the death of Buddha to have occurred about 487 B.C.", {"page": "47", "label": "Chapter II, note on the death of Buddha"});
  x("x_smith_puranic", "s_smith1914", "smith1914", "It is impossible to fix precise dates for the pre-Maurya kings.", {"page": "47", "label": "Chapter II"});
  x("x_arr_gaugamela_indians", "s_arrian", "arrian", "For the Indians who were conterminous with the Bactrians, as also the Bactrians themselves and the Sogdianians had come to the aid of Darius, all being under the command of Bessus, the viceroy of the land of Bactria.", {"chapter": "III.8"});
  x("x_arr_gaugamela_elephants", "s_arrian", "arrian", "There were only a few elephants, about fifteen in number, belonging to the Indians who live this side of the Indus.", {"chapter": "III.8"});
  x("x_arr_taxila", "s_arrian", "arrian", "he arrived at Taxila, a large and prosperous city, in fact the largest of those situated between the rivers Indus and Hydaspes. He was received in a friendly manner by Taxiles, the governor of the city", {"chapter": "V.8"});
  x("x_arr_porus_kingly", "s_arrian", "arrian", "Treat me, O Alexander, in a kingly way!", {"chapter": "V.19"});
  x("x_arr_porus_rule", "s_arrian", "arrian", "not only granted him the rule over his own Indians, but also added another country to that which he had before, of larger extent than the former.", {"chapter": "V.19"});
  x("x_arr_hydaspes_date", "s_arrian", "arrian", "which was fought in the archonship of Hegemon at Athens, in the month Munychion", {"chapter": "V.19"}, "Chinnock adds the date in brackets: 18 April to 18 May, 326 B.C.");
  x("x_arr_hydaspes_date_note", "s_arrian", "arrian", "(18 April to 18 May, 326 B.C.)", {"chapter": "V.19"}, "Chinnock's own bracketed conversion of the Athenian date.");
  x("x_arr_beyond_hyphasis", "s_arrian", "arrian", "that they conducted their own political affairs in a regular and constitutional manner. For the multitude was ruled by the aristocracy, who governed in no respect contrary to the rules of moderation.", {"chapter": "V.25"}, "Report of the country beyond the Hyphasis (Beas).");
  x("x_arr_coenus", "s_arrian", "arrian", "Do not lead us now against our will; for thou wilt no longer find us the same men in regard to dangers, since free-will will be wanting to us in the contests.", {"chapter": "V.27"}, "Coenus's speech at the Hyphasis.");
  x("x_arr_return", "s_arrian", "arrian", "he made known to the army that he had resolved to march back again.", {"chapter": "V.28"});
  x("x_mcc_curtius_barber", "s_mccrindle", "mccrindle", "the present king was not merely a man originally of no distinction, but even of the very meanest condition. His father was in fact a barber, scarcely staving off hunger by his daily earnings", {"page": "222", "chapter": "Curtius IX.2"});
  x("x_mcc_curtius_army", "s_mccrindle", "mccrindle", "guarding the approaches to his country 20,000 cavalry and 200,000 infantry, besides 2000 four-horsed chariots, and, what was the most formidable force of all, a troop of elephants which he said ran up to the number of 3000.", {"page": "222", "chapter": "Curtius IX.2"}, "Of Agrammes, king of the Prasii (Curtius).");
  x("x_mcc_diodoros_army", "s_mccrindle", "mccrindle", "an army of 20,000 horse, 200,000 infantry, 2000 chariots, and 4000 elephants trained and equipped for war.", {"page": "282", "chapter": "Diodoros XVII.93"}, "Of Xandrames, king of the Praisioi and Gandaridai.");
  x("x_mcc_diodoros_barber", "s_mccrindle", "mccrindle", "the king of the Gandaridai was a man of quite worthless character, and held in no respect, as he was thought to be the son of a barber.", {"page": "282", "chapter": "Diodoros XVII.93"});
  x("x_mcc_plutarch_androkottos", "s_mccrindle", "mccrindle", "afterwards used to declare that Alexander could easily have taken possession of the whole country since the king was hated and despised by his subjects for the wickedness of his disposition and the meanness of his origin.", {"page": "311", "chapter": "Plutarch, Life of Alexander 62"}, "Androkottos is Chandragupta Maurya.");
  x("x_mcc_plutarch_youth", "s_mccrindle", "mccrindle", "Androkottos himself, who was then but a youth, saw Alexander himself", {"page": "311", "chapter": "Plutarch, Life of Alexander 62"});
  x("x_wp_mj_lead", "s_wpMj", "wpMj", "The Mahājanapadas were sixteen kingdoms and aristocratic republics that existed in ancient India from the sixth to fourth centuries BCE, during the second urbanisation period.", {"section": "Lead"});
  x("x_wp_mj_gana", "s_wpMj", "wpMj", "Two of the Mahājanapadas were most probably gaṇasaṅghas (aristocratic republics), and others had forms of monarchy.", {"section": "Lead"});
  x("x_wp_mj_anguttara", "s_wpMj", "wpMj", "Ancient Buddhist texts like the Anguttara Nikaya make frequent reference to sixteen great kingdoms and republics that had developed and flourished in a belt stretching from Gandhara in the northwest to Anga in the east to Asmaka in the southern part of the Indian subcontinent.", {"section": "History"});
  x("x_wp_mj_digha", "s_wpMj", "wpMj", "Another Buddhist text, the Digha Nikaya, mentions twelve Mahajanapadas from the above list and omits four of them (Assaka, Avanti, Gandhara, and Kamboja).", {"section": "Mahajanapadas"});
  x("x_wp_mj_bhagavati", "s_wpMj", "wpMj", "The Vyākhyāprajñapti (or the Bhagavati Sutra), a sutra of Jainism, gives a different list of sixteen Mahajanapadas", {"section": "Mahajanapadas"});
  x("x_wp_hi_urban", "s_wpUrban", "wpUrban", "Around 600 BCE, a second urbanisation occurred resulting in a new interregional culture. The Janapada realms gradually consolidated into the Mahājanapadas, sixteen major kingdoms that included monarchies and oligarchic republics.", {"section": "Lead"});
  x("x_wp_hi_sramana", "s_wpUrban", "wpUrban", "The increasing urbanisation of India in the 7th and 6th centuries BCE led to the rise of new ascetic or \"Śramaṇa movements\" which challenged the orthodoxy of rituals.", {"section": "Second urbanisation"});
  x("x_wp_hi_nbpw", "s_wpUrban", "wpUrban", "This period corresponds in an archaeological context to the Northern Black Polished Ware culture.", {"section": "Second urbanisation"});
  x("x_wp_nbpw_dates", "s_wpNbpw", "wpNbpw", "is an urban Iron Age Indian culture of the Indian subcontinent, lasting c. 700–200 BCE (proto NBPW between 1200 and 700 BCE), succeeding the Painted Grey Ware culture and Black and red ware culture.", {"section": "Lead"});
  x("x_wp_nbpw_peak", "s_wpNbpw", "wpNbpw", "500–300 BCE, coinciding with the emergence of 16 great states or Mahajanapadas in Northern India, and the subsequent rise of the Mauryan Empire.", {"section": "Lead"});
  x("x_wp_har_dates", "s_wpHaryanka", "wpHaryanka", "was the ruling dynasty of Magadha, according to the Buddhist text Mahavamsa between 544 BC and 413 BC though some scholars favour a later chronology (5th century BCE to first half of 4th century BCE).", {"section": "Lead"});
  x("x_wp_har_capital", "s_wpHaryanka", "wpHaryanka", "Initially, the capital was Rajagriha. Later, it was shifted to Pataliputra, near present-day Patna in India during the reign of Udayin.", {"section": "Lead"});
  x("x_wp_har_sarao", "s_wpHaryanka", "wpHaryanka", "Historian K. T. S. Sarao — who favors the Buddhist \"short chronology\" — has dated Bimbisara's reign to c. 457-c.405 BCE, Ajatashatru's reign to c. 405-373 BCE, and Udayin's reign to c. 373-357 BCE", {"section": "Chronology"});
  x("x_wp_shi_avanti", "s_wpShishunaga", "wpShishunaga", "Shishunaga ended the Pradyota dynasty of Avanti, ending the centuries-old rivalry between their kingdoms and annexing Avanti into Magadha.", {"section": "Shishunaga"});
  x("x_wp_shi_council", "s_wpShishunaga", "wpShishunaga", "The two most significant events of his reign are the Second Buddhist council at Vaishali in 383 BC and the final transfer of the capital to Pataliputra.", {"section": "Kakavarna/Kalashoka"});
  x("x_wp_nanda_diodorus", "s_wpNanda", "wpNanda", "According to Greek historian Diodorus (1st century BCE), Porus told Alexander that the contemporary Nanda king was thought to be the son of a barber.", {"section": "Origins"});
  x("x_wp_nanda_jain", "s_wpNanda", "wpNanda", "The Jain tradition, as recorded in the Avashyaka Sutra and the 12th century text Parishishtaparvan, corroborates the Greco-Roman accounts, stating that the first Nanda king was the son of a barber.", {"section": "Origins"});
  x("x_wp_nanda_purana", "s_wpNanda", "wpNanda", "The Puranas name the dynasty's founder as Mahapadma, and claim that he was the son of the Shaishunaga king Mahanandin.", {"section": "Origins"});
  x("x_wp_nanda_shudra", "s_wpNanda", "wpNanda", "However, even these texts hint at the low birth of the Nandas, when they state that Mahapadma's mother belonged to the Shudra class, the lowest of the varnas.", {"section": "Origins"});
  x("x_wp_nanda_dates", "s_wpNanda", "wpNanda", "Historians Irfan Habib and Vivekanand Jha date the Nanda rule from c. 344–322 BCE, relying on the Sri Lankan Buddhist tradition which states that the Nandas ruled for 22 years. Historian Upinder Singh dates the Nanda rule from 364/345 BCE to 324 BCE, based on the assumption that Gautama Buddha died in c. 486 BCE.", {"section": "Period"});
  x("x_wp_nanda_dhana", "s_wpNanda", "wpNanda", "Alexander the Great invaded northwestern India at the time of Agrammes or Xandrames, whom modern historians generally identify as the last Nanda king – Dhana Nanda.", {"section": "Military strength"});
  x("x_wp_nanda_overthrow", "s_wpNanda", "wpNanda", "The last Nanda king Dhana Nanda was overthrown by Chandragupta Maurya, founder of the Maurya Empire.", {"section": "Lead"});
  x("x_wp_bim_anga", "s_wpBimbisara", "wpBimbisara", "His expansion of the kingdom, especially his annexation of the kingdom of Anga to the east, is considered to have laid the foundations for the later expansion of the Mauryan Empire.", {"section": "Lead"});
  x("x_wp_bim_kosala", "s_wpBimbisara", "wpBimbisara", "His first wife was Kosala Devi, the daughter of Mahā Kosala, the king of Kosala, and a sister of Prasenajit.", {"section": "Marriage alliances"});
  x("x_wp_bim_jain_death", "s_wpBimbisara", "wpBimbisara", "Per Jain Scripture, Bimbisara killed himself in a fit of passion, after his son had imprisoned him.", {"section": "Death"});
  x("x_wp_aja_father", "s_wpAjatashatru", "wpAjatashatru", "He forcefully took over the kingdom of Magadha from his father and imprisoned him.", {"section": "Lead"});
  x("x_wp_aja_vajji", "s_wpAjatashatru", "wpAjatashatru", "He fought a war against the Vajjika League, led by the Licchavis, and conquered the republic of Vaishali.", {"section": "Lead"});
  x("x_wp_aja_pataliputra", "s_wpAjatashatru", "wpAjatashatru", "Ajatashatru converted the village of Pataliputra into a fortified city.", {"section": "Lead"});
  x("x_wp_pas_kosala", "s_wpPasenadi", "wpPasenadi", "was a 6th or 5th century BCE Aikṣvāka ruler of Kosala, where Shravasti was his capital.", {"section": "Lead"});
  x("x_wp_pas_lay", "s_wpPasenadi", "wpPasenadi", "As a king, he was a prominent Upāsaka or lay follower of Gautama Buddha, and built many Buddhist monasteries for the Buddha.", {"section": "Lead"});
  x("x_wp_mv_24th", "s_wpMahavira", "wpMahavira", "considered by Jains to be the 24th and final Tirthankara (Supreme Preacher) in the current time cycle of Jain cosmology.", {"section": "Lead"});
  x("x_wp_mv_historicity", "s_wpMahavira", "wpMahavira", "Although the dates of Mahavira's life are uncertain and historically reliable information is scarce, and traditional accounts vary by sectarian traditions, the historicity of Mahavira is well-established and not in dispute among scholars.", {"section": "Lead"});
  x("x_wp_mv_599", "s_wpMahavira", "wpMahavira", "They agree that Mahavira was born in 599 BCE, but according to the Śvetāmbaras he died in 527 BCE, while the Digambaras believe that he died in 510 BCE.", {"section": "Historical Mahavira"});
  x("x_wp_mv_100years", "s_wpMahavira", "wpMahavira", "While traditional accounts adhere to the timeline that places his birth in 599 BCE and his nirvana in 527 BCE or 510 BCE, \"[s]ome scholars believe this date to be as much as 100 years early.\"", {"section": "Historical Mahavira"});
  x("x_wp_mv_birth", "s_wpMahavira", "wpMahavira", "Mahavira was born in Kundagrāma into the royal Jain family of King Siddhartha of the Nāya tribe and Queen Trishala of the Licchavi republic.", {"section": "Birth"});
  x("x_wp_par_hist", "s_wpParshva", "wpParshva", "Pārśvanātha is the earliest Jain tīrthaṅkara who is acknowledged as a historical figure", {"section": "Lead"});
  x("x_wp_par_dates", "s_wpParshva", "wpParshva", "According to Jain tradition, he lived between the 9th to 8th century BCE, whereas historians consider him to have lived between c. the 8th to 7th century BCE, founding a proto-Jain ascetic community that subsequently got revived and reformed by Mahāvīra (6th to 5th century BCE).", {"section": "Lead"});
  x("x_wp_par_jacobi", "s_wpParshva", "wpParshva", "Historians such as Hermann Jacobi have accepted him as a historical figure because his Caturyāma Dharma (Four Vows) are mentioned in Buddhist texts.", {"section": "Historicity"});
  x("x_wp_bu_uncertain", "s_wpBuddha", "wpBuddha", "The dates of Gautama's birth and death are uncertain.", {"section": "Dating"});
  x("x_wp_bu_long", "s_wpBuddha", "wpBuddha", "According to these chronicles, Asoka was crowned in 326 BCE, which gives Buddha's lifespan as 624–544 BCE, and are the accepted dates in Sri Lanka and South-East Asia.", {"section": "Dating"});
  x("x_wp_bu_short", "s_wpBuddha", "wpBuddha", "Following the Greek sources of Asoka's coronation as 268 BCE, this dates the Buddha's lifespan even later as 448–368 BCE.", {"section": "Dating"});
  x("x_wp_bu_563", "s_wpBuddha", "wpBuddha", "Most historians in the early 20th century use the earlier dates of 563–483 BCE, differing from the long chronology based on Greek evidence by just three years.", {"section": "Dating"});
  x("x_wp_bu_410", "s_wpBuddha", "wpBuddha", "More recently, there are attempts to put his death midway between the long chronology's 480s BCE and the short chronology's 360s BCE, so circa 410 BCE.", {"section": "Dating"});
  x("x_wp_bu_1988", "s_wpBuddha", "wpBuddha", "At a symposium on this question held in 1988, the majority of those who presented gave dates within 20 years either side of 400 BCE for the Buddha's death.", {"section": "Dating"});
  x("x_wp_bu_notall", "s_wpBuddha", "wpBuddha", "These alternative chronologies, however, have not been accepted by all historians.", {"section": "Dating"});
  x("x_wp_bu_lumbini", "s_wpBuddha", "wpBuddha", "The second site is a small wooden structure that was excavated in Lumbini around 2015 which also contained traces of tree roots. Carbon dating has been used to date the structure and the roots to possibly the sixth century BCE.", {"section": "Archaeological evidence"});
  x("x_wp_bu_shakya", "s_wpBuddha", "wpBuddha", "The community, though describable as a small republic, was probably an oligarchy, with his father as the elected chieftain or oligarch.", {"section": "Shakyas"});
  x("x_wp_gs_aristocratic", "s_wpGana", "wpGana", "Most of the gana sanghas are aristocratic in nature: For instance, the Licchavis, the ruling clan of Vajji, had a primary governing body of 7,077 rajas, the heads of the most important families.", {"section": "Institution"});
  x("x_wp_gs_shakya", "s_wpGana", "wpGana", "On the other hand, the smaller state of Shakyas and Koliyas, during the period around Gautama Buddha, had the assembly open to all men, rich and poor.", {"section": "Institution"});
  x("x_wp_gs_debate", "s_wpGana", "wpGana", "Some emphasize the central role of the assemblies and thus tout them as democracies; other scholars focus on the upper-class domination of the leadership and possible control of the assembly and see an oligarchy or an aristocracy.", {"section": "Institution"});
  x("x_wp_gs_kshatriya", "s_wpGana", "wpGana", "The aristocrats were always from kshatriya (warrior) class.", {"section": "Institution"});
  x("x_wp_ac_cyrus", "s_wpAchaemenid", "wpAchaemenid", "Around 535 BCE, the Persian king Cyrus the Great initiated a protracted campaign to absorb parts of northwestern South Asia into his nascent Achaemenid Empire.", {"section": "Lead"});
  x("x_wp_ac_518", "s_wpAchaemenid", "wpAchaemenid", "The first secure epigraphic evidence through the Behistun Inscription gives a date before or around 518 BCE.", {"section": "Lead"});
  x("x_wp_ac_provinces", "s_wpAchaemenid", "wpAchaemenid", "As mentioned in several Achaemenid-era inscriptions, the Indus Valley was formally incorporated into the Persian realm through provincial divisions: Gandāra, Hindush, and Sattagydia.", {"section": "Lead"});
  x("x_wp_ac_nosatraps", "s_wpAchaemenid", "wpAchaemenid", "Even though the Indian provinces are called \"satrapies\" by convention, there is no evidence of there being any satraps in these provinces.", {"section": "Naqsh-e Rustam inscription"});
  x("x_wp_ac_338", "s_wpAchaemenid", "wpAchaemenid", "The presence of the three ethnicities on all the tombs of the Achaemenid rulers after Darius, except for the last ruler Darius III suggests that the Indians were under Achaemenid dominion at least until 338 BCE, the date of the end of the reign of Artaxerxes III.", {"section": "Achaemenid lists of provinces"});
  x("x_wp_ac_gold_doubt", "s_wpAchaemenid", "wpAchaemenid", "However the amount of gold in question is quite enormous, so there is a possibility that Herodotus was mistaken and that his own sources actually only meant something like the gold equivalent of 360 Babylonian talents of silver.", {"section": "Tribute"});
  x("x_wp_ic_dates", "s_wpAlexander", "wpAlexander", "The Indian campaign of Alexander the Great began in 327 BC and lasted until 325 BC.", {"section": "Lead"});
  x("x_wp_ic_hydaspes", "s_wpAlexander", "wpAlexander", "In 326 BC, Alexander defeated the Pauravas under Porus in the Battle of the Hydaspes, although the engagement was possibly the Macedonians' most costly battle.", {"section": "Lead"});
  x("x_wp_ic_mutiny", "s_wpAlexander", "wpAlexander", "mutinied at the Hyphasis River, refusing to advance his push to the east.", {"section": "Lead"});
  x("x_wp_po_sources", "s_wpPorus", "wpPorus", "The only contemporary information available on Porus and his kingdom is from Greek sources, whereas Indian sources do not mention him.", {"section": "Sources"});
  x("x_wp_tx_hindush", "s_wpTaxila", "wpTaxila", "The city has been suggested to be the capital of the Achaemenid province of Hinduš during c. 500 – c. 330 BCE.", {"section": "Lead"});
  x("x_wp_tx_panini", "s_wpTaxila", "wpTaxila", "It is named in the writings of Pāṇini and its king, called Taxiles by the ancient Greeks, readily recognised the suzerainty of Alexander the Great in 326 BCE once he appeared on the scene after overthrowing the Achaemenids.", {"section": "Lead"});

  // Modern works, by location only
  x("x_usingh_nanda", "s_usingh", null, null, { page: "273" }, "Location as given by Wikipedia (Nanda Empire) for the Nanda dates of 364/345–324 BCE; not checked against the book.");
  x("x_usingh_mj", "s_usingh", null, null, { page: "260", pageEnd: "264" }, "Location as given by Wikipedia (Mahajanapadas) for the sixteen and their forms of government; not checked against the book.");
  x("x_cousins", "s_cousins", null, null, { page: "57", pageEnd: "63" }, "Location as given by Wikipedia (The Buddha) for the dating debate; not checked against the article.");
  x("x_narain", "s_narain", null, null, { label: "The 1988 symposium volume" }, "Cited by Wikipedia (The Buddha) for the symposium's results; not checked against the book.");
  x("x_fogelin", "s_fogelin", null, null, { page: "82", pageEnd: "85" }, "Location as given by Wikipedia (The Buddha) for the Lumbini wooden structure; not checked against the book.");
  x("x_sarao", "s_sarao", null, null, { page: "1", pageEnd: "12" }, "Cited by Wikipedia (Haryanka dynasty) for short-chronology reign dates; not checked against the article.");
  x("x_sharma_republics", "s_sharma_republics", null, null, { page: "109", pageEnd: "122" }, "Location as given by Wikipedia (Gaṇa sangha) for the oligarchy reading; not checked against the book.");
  x("x_thapar", "s_thapar", null, null, { page: "148", pageEnd: "149" }, "Location as given by Wikipedia (Gaṇa sangha) for the kshatriya aristocrats; not checked against the book.");
  x("x_dundas", "s_dundas", null, null, { page: "30", pageEnd: "31" }, "Location as given by Wikipedia (Parshvanatha; Mahavira) for Pārśva's historicity; not checked against the book.");
  x("x_habib_jha", "s_habib_jha", null, null, { page: "13" }, "Location as given by Wikipedia (Nanda Empire) for the barber story in Jain tradition and the dates c. 344–322 BCE; not checked against the book.");

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
  const UNCERTAIN = "Dates before the Mauryas rest on later chronicles and on the date of the Buddha, which is itself debated.";

  // 1. Sixteen great states
  c("c_sixteen", {
    text: "Early Buddhist texts keep a stock list of sixteen “great countries” (mahājanapadas): Aṅga, Magadha, Kāsī, Kosala, Vajji, Malla, Cetī, Vaṃsa, Kuru, Pañcāla, Maccha, Sūrasena, Assaka, Avanti, Gandhāra and Kamboja.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["polity", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: PERIOD }, { entity: e("t_mahajanapada"), role: "mention" }],
    foundVia: ["wpMj"],
    learning: { prompt: "Where does the list of sixteen mahājanapadas come from?", answer: "A stock list kept in early Buddhist texts." },
  });
  c("c_peoples", {
    text: "Rhys Davids noticed that the sixteen are names of peoples, not of countries, and concluded that the list's idea was “still tribal and not geographical”.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "historiography"],
    lenses: ["philological"],
    entities: [P, { entity: e("rhysdavids"), role: "mention" }],
  });
  c("c_lists_differ", {
    text: "The lists do not agree: the Dīgha Nikāya names only twelve, leaving out Assaka, Avanti, Gandhāra and Kamboja, and the Jain Bhagavatī Sūtra gives a different sixteen.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources", "polity"],
    entities: [P],
    foundVia: ["wpMj"],
  });
  c("c_mj_dates", {
    text: "Historians place the sixteen states between the sixth and fourth centuries BCE, in a period of new cities called the second urbanisation.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: UNCERTAIN,
    when: { start: bce(600), end: bce(345) },
    themes: ["polity", "infrastructure"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: PERIOD }],
    foundVia: ["wpMj"],
  });
  c("c_no_paramount", {
    text: "When Buddhism arose, Rhys Davids wrote, there was no paramount ruler in India: four large kingdoms stood beside small aristocratic republics, which were being absorbed by their neighbours.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity"],
    lenses: ["philological"],
    entities: [P, { entity: e("t_gana"), role: "mention" }],
  });
  c("c_four_kingdoms", {
    text: "The four kingdoms were Magadha (capital Rājagaha), Kosala (Sāvatthi), the Vatsas (Kosambī) and Avanti (Ujjenī), ruled in the Buddha's time by Bimbisāra and then Ajātasattu, Pasenadi, Udena and Pajjota.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("magadha") }, { entity: e("kosala") }, { entity: e("vatsa") }, { entity: e("avanti") }, { entity: e("bimbisara"), role: "participant" }, { entity: e("pasenadi"), role: "participant" }, { entity: e("udena"), role: "participant" }, { entity: e("pajjota"), role: "participant" }],
    learning: { prompt: "Name the four great kingdoms of the Buddha's time.", answer: "Magadha, Kosala, the Vatsas and Avanti." },
  });
  c("c_alliances", {
    text: "Their royal families married into one another and, often because of those marriages, went to war: Bimbisāra's first queen was a sister of Pasenadi of Kosala.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "society"],
    entities: [{ entity: e("bimbisara") }, { entity: e("pasenadi") }],
    foundVia: ["wpBimbisara"],
  });
  c("c_brahmin_books", {
    text: "Rhys Davids argued that earlier scholars had relied too much on the brahmin books, which say little about the clan republics; the Buddhist texts show a different picture.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("rhysdavids") }, { entity: e("t_gana"), role: "mention" }],
  });

  // 2. Kings and clans
  c("c_mote_hall", {
    text: "The Sakya clan, the Buddha's own, did its business in a public assembly of young and old in its mote hall (santhāgāra) at Kapilavatthu; the Mallas had a hall of their own.",
    kind: "fact",
    assessment: "supported",
    themes: ["governance", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("shakya") }, { entity: e("malla"), role: "mention" }, { entity: e("kapilavatthu"), role: "place" }, { entity: e("t_santhagara"), role: "mention" }],
  });
  c("c_raja_elected", {
    text: "Rhys Davids thought a single chief, chosen in a way we do not know, presided over the Sakya assembly with the title rājā, “something like the Roman consul, or the Greek archon”.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["governance"],
    lenses: ["philological"],
    entities: [{ entity: e("shakya") }],
  });
  c("c_vajji_assemblies", {
    text: "In the Mahāparinibbāna Sutta the Buddha says the Vajjians would prosper so long as they held “full and frequent public assemblies” and acted in concord.",
    kind: "fact",
    assessment: "supported",
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("vajji") }, { entity: e("buddha"), role: "participant" }],
    learning: { prompt: "What did the Buddha say would keep the Vajjians strong?", answer: "Holding full and frequent public assemblies and acting in concord." },
  });
  c("c_vesali_senate", {
    text: "Summarising the Buddhist texts, Hermann Jacobi described Vesālī as governed by a senate of nobles presided over by a king, who shared power with a viceroy and a general.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["governance"],
    lenses: ["philological"],
    entities: [{ entity: e("vesali"), role: "place" }, { entity: e("vajji") }],
  });
  c("c_licchavi_rajas", {
    text: "Most of these clan states were aristocratic: the ruling body of the Licchavis is said to have had 7,077 rājas, the heads of the leading families, who always came from the warrior (kṣatriya) class.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["governance", "society"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("licchavi") }, { entity: e("t_varna"), role: "mention" }],
    foundVia: ["wpGana"],
  });
  c("c_shakya_open", {
    text: "The smaller Sakya and Koliya states, by contrast, are said to have had assemblies open to all men, rich and poor; even so, the Sakyas were probably an oligarchy with an elected chief.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["governance"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("shakya") }],
    foundVia: ["wpGana"],
  });
  c("c_greek_aristocracy", {
    text: "Alexander's men heard of a country beyond the Hyphasis (Beas) whose people “conducted their own political affairs in a regular and constitutional manner”, the multitude ruled by an aristocracy.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(326, false) },
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("alexcampaign"), role: "mention" }, { entity: e("t_gana"), role: "mention" }],
  });
  c("c_gs_debate", {
    text: "Historians disagree about what to call these states: some stress the assemblies and call them democracies, others the rule of upper-class families and call them oligarchies or aristocracies.",
    kind: "debate",
    assessment: "contested",
    themes: ["governance", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("t_gana") }],
    foundVia: ["wpGana"],
  });
  c("c_monarchy", {
    text: "Wherever power in a clan became hereditary, Rhys Davids judged, “the result seems always to have been an absolute monarchy”.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["governance"],
    lenses: ["philological"],
    entities: [P, { entity: e("rhysdavids"), role: "mention" }],
  });

  // 3. Cities
  c("c_urban", {
    text: "From about 600 BCE towns grew up again in the Ganges plain, the “second urbanisation” after the Indus cities; archaeologically the period is marked by Northern Black Polished Ware, a glossy pottery of c. 700–200 BCE.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "When the second urbanisation began is debated; the archaeological evidence is not quoted on this page.",
    when: { start: bce(600), end: bce(300) },
    themes: ["infrastructure", "economy"],
    lenses: ["archaeological", "mainstream_academic"],
    entities: [P, { entity: e("t_nbpw"), role: "mention" }],
    foundVia: ["wpUrban", "wpNbpw"],
    learning: { prompt: "What is the “second urbanisation”?", answer: "The growth of towns in the Ganges plain from about 600 BCE, the first cities since the Indus civilisation." },
  });
  c("c_great_cities", {
    text: "When the Buddha lay dying, Ānanda begged him not to die in “this little wattel and daub town” of Kusinārā but in one of the great cities: Campā, Rājagaha, Sāvatthi, Sāketa, Kosambī or Benares.",
    kind: "fact",
    assessment: "supported",
    themes: ["infrastructure"],
    lenses: ["primary_source"],
    entities: [{ entity: e("kusinara"), role: "place" }, { entity: e("rajagaha"), role: "mention" }, { entity: e("savatthi"), role: "mention" }, { entity: e("kosambi"), role: "mention" }, { entity: e("benares"), role: "mention" }],
    learning: { prompt: "Name three of the great cities Ānanda listed when the Buddha was dying.", answer: "Any of Campā, Rājagaha, Sāvatthi, Sāketa, Kosambī and Benares." },
  });
  c("c_vesali_city", {
    text: "Vesālī, Rhys Davids noted, was the only great city in all the territories of the free clans.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["infrastructure", "polity"],
    lenses: ["philological"],
    entities: [{ entity: e("vesali"), role: "place" }],
  });
  c("c_sramana", {
    text: "The growing towns of the seventh and sixth centuries BCE saw new movements of wandering ascetics (śramaṇas) who challenged the brahmins' rituals.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["religion", "society"],
    lenses: ["mainstream_academic"],
    entities: [P, { entity: e("t_sramana"), role: "mention" }],
    foundVia: ["wpUrban"],
  });
  c("c_writing", {
    text: "Rhys Davids read the early texts as showing that writing was known in the Buddha's time but not yet used for writing down books.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["culture", "sources"],
    lenses: ["philological"],
    entities: [P],
  });

  // 4. Magadha
  c("c_bimbisara", {
    text: "Bimbisāra of Magadha reigned for 52 years, according to the Mahāvaṃsa, and annexed the kingdom of Aṅga to the east, a first step towards Magadha's later empire.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: UNCERTAIN,
    themes: ["polity", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("bimbisara") }, { entity: e("magadha") }, { entity: e("anga"), role: "participant" }],
    foundVia: ["wpBimbisara"],
  });
  c("c_parricide", {
    text: "Buddhist tradition says Ajātasattu killed his father Bimbisāra to take the throne; in the Sāmaññaphala Sutta he confesses to the Buddha, “I put to death my father, that righteous man, that righteous king!”",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "This is the Buddhist account; Jain tradition tells it differently.",
    themes: ["polity", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("ajatasattu") }, { entity: e("bimbisara"), role: "participant" }, { entity: e("buddha"), role: "mention" }],
    learning: { prompt: "What does Buddhist tradition say Ajātasattu did to his father Bimbisāra?", answer: "Killed him to take the throne, and later confessed it to the Buddha." },
  });
  c("c_jain_death", {
    text: "Jain scripture tells it differently: Ajātasattu imprisoned his father, and Bimbisāra killed himself.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "religion"],
    entities: [{ entity: e("bimbisara") }, { entity: e("ajatasattu"), role: "participant" }],
    foundVia: ["wpBimbisara"],
  });
  c("c_vajji_war", {
    text: "Ajātasattu resolved to “root out” the Vajjians and sent his minister Vassakāra to consult the Buddha; by later accounts Vassakāra sowed discord among the Licchavi families and Ajātasattu conquered Vesālī.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "How complete the conquest was is unclear: Rhys Davids says in one place that Vesālī was “completely destroyed” and in another that the Vajjians were “defeated, but not broken up”.",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("ajatasattu") }, { entity: e("vajji"), role: "participant" }, { entity: e("vesali"), role: "place" }],
  });
  c("c_pataligama", {
    text: "Ajātasattu's ministers built a fortress at the village of Pāṭaligāma on the Ganges against the Vajjians; the sutta has the Buddha foretell that it would become Pāṭaliputta, a great centre of trade threatened by fire, water and dissension.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The prophecy was probably written after Pāṭaliputta had become great.",
    themes: ["infrastructure", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: "pataliputra", role: "place" }, { entity: e("ajatasattu"), role: "mention" }],
    learning: { prompt: "How did Pāṭaliputta begin?", answer: "As a fortress that Ajātasattu's ministers built at the village of Pāṭaligāma against the Vajjians." },
  });
  c("c_jacobi_foundation", {
    text: "Jacobi held that Ajātasattu, by conquering Vesālī, “laid the foundation of the empire of the Nandas and Mauryas”.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("ajatasattu") }, { entity: "nanda-empire", role: "mention" }, { entity: "maurya-empire", role: "mention" }],
  });
  c("c_udayin", {
    text: "The Purāṇas say Ajātasattu's successor Udayin made Kusumapura, on the south bank of the Ganges, his capital: the city later called Pāṭaliputra.",
    kind: "fact",
    assessment: "supported",
    themes: ["infrastructure", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: "pataliputra", role: "place" }, { entity: "haryanka-dynasty", role: "mention" }],
    foundVia: ["wpHaryanka"],
  });
  c("c_susunaga", {
    text: "The Mahāvaṃsa says the people, calling the royal line “a dynasty of parricides”, banished its last king and made the minister Susunāga king; the Purāṇas have Śiśunāga rule from Girivraja and set his son in Benares.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The two traditions order the kings differently.",
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: "shishunaga-dynasty" }, { entity: e("magadha"), role: "mention" }, { entity: e("rajagaha"), role: "mention" }],
  });
  c("c_avanti_annexed", {
    text: "Pradyota of Avanti, the Purāṇas say, made the neighbouring kings subject to him; later the Śiśunāgas annexed Avanti to Magadha, and by the fourth century BCE Ujjenī was Magadha's.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("avanti") }, { entity: e("pajjota"), role: "mention" }, { entity: "ujjain", role: "place" }, { entity: "shishunaga-dynasty", role: "participant" }],
    foundVia: ["wpShishunaga"],
  });
  c("c_council", {
    text: "Under Susunāga's son Kālāsoka the second Buddhist council met at Vesālī, by one dating in 383 BCE.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: UNCERTAIN,
    when: { start: bce(383, true, true) },
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: "shishunaga-dynasty" }, { entity: e("vesali"), role: "place" }],
    foundVia: ["wpShishunaga"],
  });
  c("c_no_dates", {
    text: "Even Vincent Smith (1914) admitted that “it is impossible to fix precise dates for the pre-Maurya kings”; modern reign dates differ by half a century or more depending on the chronology used.",
    kind: "interpretation",
    assessment: "well_supported",
    themes: ["historiography", "sources"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: "haryanka-dynasty" }, { entity: e("bimbisara"), role: "mention" }],
    foundVia: ["wpHaryanka"],
  });

  // 5. The Buddha
  c("c_buddha_magadha", {
    text: "The Buddha and Mahāvīra both taught in Magadha in Bimbisāra's reign; the Mahāvaṃsa says 37 years of that reign fell in the Buddha's lifetime.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("buddha") }, { entity: e("mahavira") }, { entity: e("bimbisara"), role: "mention" }, { entity: e("magadha"), role: "place" }],
  });
  c("c_first_sermon", {
    text: "The Buddha's first sermon, given to five monks in the Deer Park at Benares, taught a middle path between two extremes, the noble eightfold path.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("buddha") }, { entity: "sarnath", role: "place" }, { entity: e("benares"), role: "mention" }],
    learning: { prompt: "What did the Buddha teach in his first sermon at the Deer Park?", answer: "A middle path between two extremes: the noble eightfold path." },
  });
  c("c_four_places", {
    text: "The Mahāparinibbāna Sutta names four places a believer should visit: where the Buddha was born, where he attained insight, where he gave his first sermon, and where he died.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("buddha") }, { entity: "lumbini", role: "place" }, { entity: e("bodhgaya"), role: "place" }, { entity: "sarnath", role: "place" }, { entity: e("kusinara"), role: "place" }],
  });
  c("c_eighty", {
    text: "Near the end the Buddha says he is “turning eighty years of age”, his body kept going “like a worn-out cart”; he died at Kusinārā, and Ānanda went to the Mallas' assembly hall to announce it.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("buddha") }, { entity: e("kusinara"), role: "place" }, { entity: e("malla"), role: "mention" }, { entity: e("t_nibbana"), role: "mention" }],
    learning: { prompt: "How old was the Buddha when he died, according to the suttas, and where?", answer: "Eighty, at Kusinārā in the land of the Mallas." },
  });
  c("c_nibbana_8", {
    text: "The Mahāvaṃsa dates the Buddha's death to the eighth year of Ajātasattu's reign.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("buddha") }, { entity: e("ajatasattu"), role: "mention" }],
  });
  c("c_pasenadi_lay", {
    text: "Pasenadi of Kosala, at Sāvatthi, is remembered as a lay follower of the Buddha who built monasteries for him.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "polity"],
    entities: [{ entity: e("pasenadi") }, { entity: e("savatthi"), role: "place" }, { entity: e("buddha"), role: "mention" }],
    foundVia: ["wpPasenadi"],
  });

  // 6. Mahāvīra and the other teachers
  c("c_six_teachers", {
    text: "In the Sāmaññaphala Sutta, Ajātasattu's ministers recommend six famous teachers before he visits the Buddha: Pūraṇa Kassapa, Makkhali Gosāla, Ajita, Pakudha Kaccāyana, Sañjaya and the Nigaṇṭha of the Nāta clan.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Ajita, Pakudha and Sañjaya are named in the same passage, but the OCR is too poor there to quote.",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("ajatasattu"), role: "participant" }, { entity: e("gosala"), role: "mention" }, { entity: e("mahavira"), role: "mention" }, { entity: e("t_sramana"), role: "mention" }],
  });
  c("c_gosala", {
    text: "As the Buddhists report him, Makkhali Gosāla taught that fools and wise alike would end their suffering only after “eighty-four hundred thousand periods” of rebirth: a doctrine of fate.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Known only from his rivals' summary.",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("gosala") }, { entity: e("t_ajivika"), role: "mention" }],
  });
  c("c_ajita", {
    text: "Ajita of the hair-garment, by the same account, denied that alms or sacrifice had any fruit, or that good and evil deeds had results.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Known only from his rivals' summary.",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [P],
  });
  c("c_nataputta", {
    text: "Jacobi identified Mahāvīra with the “Nātaputta, head of the Niganthas” whom the Buddhist texts treat as the Buddha's rival.",
    kind: "interpretation",
    assessment: "well_supported",
    themes: ["religion", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("mahavira") }, { entity: e("t_nigantha"), role: "mention" }, { entity: e("jacobi"), role: "mention" }],
  });
  c("c_mahavira_life", {
    text: "The Kalpa Sūtra says Mahāvīra lived thirty years as a householder, twelve years in austerities, about thirty as a kevalin (one with perfect knowledge), and died at Pāpā aged seventy-two.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The Jain tradition's account, written down long after; Jacobi's own introduction says he renounced at twenty-eight.",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mahavira") }, { entity: e("t_kevalin"), role: "mention" }],
    learning: { prompt: "How long did Mahāvīra spend in austerities before attaining perfect knowledge?", answer: "Twelve years, according to the Kalpa Sūtra." },
  });
  c("c_mahavira_birth", {
    text: "Jains say Mahāvīra was the son of king Siddhārtha of Kuṇḍapura; Jacobi argued it was a suburb of Vesālī, that Siddhārtha was no king, and that through his mother, of the Videha ruling line, Mahāvīra was related to the kings of Magadha.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["religion", "society"],
    lenses: ["philological"],
    entities: [{ entity: e("mahavira") }, { entity: e("vesali"), role: "place" }, { entity: e("licchavi"), role: "mention" }],
    foundVia: ["wpMahavira"],
  });
  c("c_ahimsa", {
    text: "The Ācārāṅga Sūtra teaches that “all breathing, existing, living, sentient creatures should not be slain, nor treated with violence”: the Jain principle of non-harm.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mahavira"), role: "mention" }],
  });
  c("c_parshva", {
    text: "Jacobi argued that the Jain order was older than Mahāvīra: the Buddhist texts never call it a new sect, so Mahāvīra was its reformer, and it may have been founded by Pārśva, the twenty-third Tīrthaṅkara, whom historians date to the eighth or seventh century BCE.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["religion", "historiography"],
    lenses: ["philological", "mainstream_academic"],
    entities: [{ entity: e("parshva") }, { entity: e("mahavira"), role: "mention" }, { entity: "tirthankara", role: "mention" }, { entity: e("jacobi"), role: "mention" }],
    foundVia: ["wpParshva"],
    learning: { prompt: "Who, according to Jain tradition and many historians, came before Mahāvīra as a Jain teacher?", answer: "Pārśva, the twenty-third Tīrthaṅkara, who is accepted as historical." },
  });
  c("c_mahavira_24", {
    text: "For Jains, Mahāvīra is the twenty-fourth and last Tīrthaṅkara of the present age, not the founder of their religion.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    entities: [{ entity: e("mahavira") }, { entity: "tirthankara", role: "mention" }],
    foundVia: ["wpMahavira"],
  });
  c("c_mahavira_dates", {
    text: "Jain tradition puts Mahāvīra's birth in 599 BCE and his death in 527 (Śvetāmbara) or 510 BCE (Digambara); some scholars think these dates as much as a century too early.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["religion", "historiography"],
    entities: [{ entity: e("mahavira") }],
    foundVia: ["wpMahavira"],
  });

  // 7. Persia on the Indus
  c("c_cyrus", {
    text: "Around 535 BCE the Persian king Cyrus began a long campaign to bring the north-west of South Asia into his new empire.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The date is approximate; the first firm evidence is Darius's inscription of c. 518.",
    when: { start: bce(535) },
    themes: ["war", "polity"],
    entities: [{ entity: e("cyrus") }, { entity: "achaemenid-empire" }, { entity: e("gandhara"), role: "mention" }],
    foundVia: ["wpAchaemenid"],
  });
  c("c_behistun", {
    text: "Darius I's inscription at Behistun, carved by about 518 BCE, lists Gandāra (Gandhāra) among the twenty-three lands “subject unto me”.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: bce(518), basis: "Before or around 518 BCE" },
    themes: ["polity", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("behistun") }, { entity: e("darius"), role: "participant" }, { entity: e("gandhara") }],
    foundVia: ["wpAchaemenid"],
    learning: { prompt: "Which inscription of Darius I lists Gandāra among his lands?", answer: "His inscription at Behistun, carved by about 518 BCE." },
  });
  c("c_provinces", {
    text: "Persian inscriptions name three provinces in the Indus region, Gandāra, Hindush and Sattagydia; Herodotus counts the Gandarians in one tax district and the Indians in another.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: "achaemenid-empire" }, { entity: e("gandhara"), role: "mention" }, { entity: e("t_satrapy"), role: "mention" }],
    foundVia: ["wpAchaemenid"],
  });
  c("c_skylax", {
    text: "Herodotus says Darius sent Skylax of Caryanda down the Indus to the sea, and afterwards “subdued the Indians and made use of this sea”.",
    kind: "fact",
    assessment: "supported",
    themes: ["war", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("skylax") }, { entity: e("darius"), role: "participant" }, { entity: e("herodotus"), role: "mention" }],
  });
  c("c_tribute", {
    text: "According to Herodotus the Indians paid Persia the largest tribute of all its peoples: 360 talents of gold dust a year.",
    kind: "fact",
    assessment: "contested",
    assessmentNote: "The amount of gold is enormous; Herodotus or his informants may have meant its value in silver.",
    themes: ["economy", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("herodotus") }, { entity: "achaemenid-empire" }],
    foundVia: ["wpAchaemenid"],
    learning: { prompt: "What did Herodotus say the Indians paid Persia?", answer: "The largest tribute of any people: 360 talents of gold dust a year." },
  });
  c("c_beyond_persia", {
    text: "Herodotus knew the Persians' hold had a limit: some Indian peoples lived beyond it and “never became subjects of Dareios”. He also passed on a tale of gold-digging ants larger than foxes.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Herodotus wrote from report, not from a visit; the ants are a traveller's tale.",
    themes: ["polity", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("herodotus") }],
  });
  c("c_xerxes", {
    text: "Indian soldiers marched with Xerxes against Greece in 480 BCE, Herodotus says, in clothes of “tree-wool” (cotton) with reed bows and iron-tipped arrows.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(480, false) },
    themes: ["war", "technology"],
    lenses: ["primary_source"],
    entities: [{ entity: e("herodotus") }, { entity: "achaemenid-empire", role: "mention" }],
  });
  c("c_gaugamela", {
    text: "Indians still fought for Persia in 331 BCE: at Gaugamela Darius III had Indian troops and about fifteen elephants belonging to Indians from this side of the Indus.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(331, false) },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: "achaemenid-empire" }, { entity: "alexander-the-great", role: "mention" }],
  });
  c("c_persia_until", {
    text: "The peoples of the Indus appear on Persian royal tombs until at least 338 BCE, though no Persian governor (satrap) is known for any of these provinces.",
    kind: "interpretation",
    assessment: "supported",
    when: { end: bce(338, false), start: bce(518) },
    themes: ["polity", "governance"],
    lenses: ["archaeological", "mainstream_academic"],
    entities: [{ entity: "achaemenid-empire" }, { entity: e("t_satrapy"), role: "mention" }],
    foundVia: ["wpAchaemenid"],
  });
  c("c_darius_contemporary", {
    text: "Vincent Smith reckoned Bimbisāra and Ajātasattu contemporaries of Darius I (522–486 BCE), and thought the Indus survey let Darius annex the Indus valley.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "The synchronism depends on the long chronology of the Buddha.",
    themes: ["polity", "historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("darius") }, { entity: e("bimbisara"), role: "mention" }, { entity: e("ajatasattu"), role: "mention" }],
  });
  c("c_taxila_hindush", {
    text: "Taxila has been suggested as the seat of the Persian province of Hinduš, c. 500–330 BCE.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["polity", "infrastructure"],
    entities: [{ entity: "taxila", role: "place" }, { entity: "achaemenid-empire", role: "mention" }],
    foundVia: ["wpTaxila"],
  });

  // 8. The Nandas and Alexander
  c("c_nanda_purana", {
    text: "The Purāṇas say Mahāpadma Nanda, son of the last Śiśunāga king by a śūdra woman, would “exterminate all kṣatriyas” and rule as sole monarch, and that kings after him would be of śūdra origin.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Written as prophecy in texts compiled centuries later, from a brahmin point of view hostile to low-born kings.",
    themes: ["polity", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mahapadma") }, { entity: "nanda-empire" }, { entity: e("t_varna"), role: "mention" }],
    foundVia: ["wpNanda"],
    learning: { prompt: "What do the Purāṇas say about Mahāpadma Nanda's birth and rule?", answer: "Son of a śūdra woman, he would destroy the kṣatriyas and rule as sole monarch." },
  });
  c("c_nanda_barber", {
    text: "The Greek and Roman writers heard that the king of the Ganges plain was the son of a barber; Jain tradition says the same of the first Nanda.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: "nanda-empire" }, { entity: e("dhananda"), role: "mention" }],
    foundVia: ["wpNanda"],
  });
  c("c_nanda_army", {
    text: "Alexander's men were told that this king had 20,000 cavalry, 200,000 infantry, 2,000 chariots and 3,000 or 4,000 elephants.",
    kind: "fact",
    assessment: "contested",
    assessmentNote: "Reported second-hand by writers centuries later; Curtius and Diodorus differ on the elephants.",
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: "nanda-empire" }, { entity: e("dhananda"), role: "mention" }],
  });
  c("c_nanda_dates", {
    text: "The Nandas' dates are uncertain: the Mahāvaṃsa gives the nine Nandas 22 years and the Purāṇas 100; modern historians date them c. 344–322 BCE or 364/345–324 BCE, depending on the date of the Buddha.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: bce(364, true, true), end: bce(322) },
    themes: ["polity", "historiography"],
    lenses: ["primary_source", "mainstream_academic"],
    entities: [{ entity: "nanda-empire" }],
    foundVia: ["wpNanda"],
  });
  c("c_nanda_end", {
    text: "Both the Purāṇas and the Mahāvaṃsa say a brahmin, Kauṭilya or Cāṇakka, overthrew the Nandas and put Chandragupta Maurya on the throne.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(322) },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: "nanda-empire" }, { entity: "kautilya", role: "participant" }, { entity: "chandragupta-maurya", role: "participant" }],
    foundVia: ["wpNanda"],
  });
  c("c_taxila", {
    text: "In 326 BCE Alexander reached Taxila, “the largest of those situated between the rivers Indus and Hydaspes”, and its ruler Taxiles received him as a friend.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(326, false) },
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: "taxila", role: "place" }, { entity: e("taxiles"), role: "participant" }, { entity: "alexander-the-great", role: "participant" }],
    foundVia: ["wpTaxila"],
  });
  c("c_hydaspes", {
    text: "Alexander defeated Porus on the Hydaspes (Jhelum) in the spring of 326 BCE, in a battle Arrian dates by the Athenian calendar to the month Munychion of Hegemon's year.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: bce(326, false), basis: "Arrian V.19; April–May 326 BCE (Chinnock)" },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("hydaspes") }, { entity: e("porus"), role: "participant" }, { entity: "alexander-the-great", role: "participant" }],
    foundVia: ["wpAlexander"],
    learning: { prompt: "Whom did Alexander defeat at the Hydaspes, and when?", answer: "Porus, in the spring of 326 BCE." },
  });
  c("c_porus", {
    text: "Captured, Porus asked Alexander to treat him “in a kingly way”; Alexander left him his kingdom and added more land to it. Porus is known only from Greek sources.",
    kind: "fact",
    assessment: "supported",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("porus") }, { entity: "alexander-the-great", role: "participant" }],
    foundVia: ["wpPorus"],
  });
  c("c_hyphasis", {
    text: "At the Hyphasis (Beas) Alexander's army refused to go further east, and he turned back; his Indian campaign lasted from 327 to 325 BCE.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: bce(326, false) },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("alexcampaign") }, { entity: "alexander-the-great", role: "participant" }],
    foundVia: ["wpAlexander"],
    learning: { prompt: "Why did Alexander turn back from India?", answer: "His army refused to go further east at the Hyphasis (Beas)." },
  });
  c("c_androkottos", {
    text: "Plutarch says the young Androkottos (Chandragupta Maurya) saw Alexander, and later said Alexander could easily have taken the whole country, because its king was hated for his wickedness and low birth.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Plutarch wrote four centuries later.",
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: "chandragupta-maurya" }, { entity: "alexander-the-great", role: "mention" }, { entity: e("dhananda"), role: "mention" }],
  });
  c("c_agrammes", {
    text: "Modern historians generally identify the Greek writers' Agrammes or Xandrames with the last Nanda king, Dhana Nanda.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("dhananda") }, { entity: "nanda-empire", role: "mention" }],
    foundVia: ["wpNanda"],
  });

  // 9. When did the Buddha live?
  c("c_mhv_218", {
    text: "The Sri Lankan chronicles count 218 years from the Buddha's death to Aśoka's consecration.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("buddha") }, { entity: "ashoka", role: "mention" }],
  });
  c("c_long_544", {
    text: "Taking Aśoka's consecration as 326 BCE, those chronicles give the Buddha the dates 624–544 BCE, which are accepted in Sri Lanka and South-East Asia; Rhys Davids called 543 “too early” as long ago as 1881.",
    kind: "interpretation",
    assessment: "weak",
    themes: ["historiography", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("buddha") }],
    foundVia: ["wpBuddha"],
  });
  c("c_geiger_483", {
    text: "Wilhelm Geiger (1912) combined the 218 years with Greek evidence for Chandragupta Maurya's accession (c. 321 BCE) to reach 483 BCE for the Buddha's death and 563 for his birth, but called the calculation “hypothetical”.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: bce(483, true, true) },
    themes: ["historiography", "religion"],
    lenses: ["philological"],
    entities: [{ entity: e("geiger") }, { entity: e("buddha"), role: "mention" }],
    learning: { prompt: "Where do the familiar dates 563–483 BCE for the Buddha come from?", answer: "From Wilhelm Geiger (1912), who combined the chronicles' reign-lengths with the date of Chandragupta Maurya's accession; he called the calculation “hypothetical”." },
  });
  c("c_convention_563", {
    text: "Most historians of the early twentieth century used 563–483 BCE; Vincent Smith put the death “in or about the year 487 B.C.”",
    kind: "interpretation",
    assessment: "contested",
    themes: ["historiography"],
    lenses: ["colonial_orientalist", "mainstream_academic"],
    entities: [{ entity: e("buddha") }],
    foundVia: ["wpBuddha"],
  });
  c("c_rd_short", {
    text: "Rhys Davids argued in 1881 for a shorter interval of about 150 years to Aśoka, which fitted the history of the Buddhist texts better, putting the Buddha's death about 420–400 BCE.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: bce(420, true), end: bce(400, true) },
    themes: ["historiography", "religion"],
    lenses: ["philological"],
    entities: [{ entity: e("rhysdavids") }, { entity: e("buddha"), role: "mention" }],
  });
  c("c_short_now", {
    text: "Many historians now put the Buddha's death nearer 400 BCE: at a symposium in 1988 most speakers gave dates within twenty years of 400, and a compromise of about 410 has been proposed; but these later dates are not accepted by all historians.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: bce(420, true), end: bce(380, true) },
    themes: ["historiography", "religion"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("buddha") }],
    foundVia: ["wpBuddha"],
    learning: { prompt: "Are the Buddha's dates settled?", answer: "No. Many historians now put his death nearer 400 BCE, but these later dates are not accepted by all historians." },
  });
  c("c_lumbini_shrine", {
    text: "Excavations at Lumbini found a small wooden structure that carbon dating places possibly in the sixth century BCE; it dates a building, not the Buddha.",
    kind: "fact",
    assessment: "contested",
    themes: ["religion", "historiography"],
    lenses: ["archaeological"],
    entities: [{ entity: "lumbini", role: "place" }, { entity: e("buddha"), role: "mention" }],
    foundVia: ["wpBuddha"],
  });
  c("c_vijaya", {
    text: "The Mahāvaṃsa says Prince Vijaya landed in Sri Lanka on the very day of the Buddha's death; Geiger judged this “a biassed account”, with reigns lengthened to make the two contemporaries.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "sources"],
    lenses: ["primary_source", "philological"],
    entities: [{ entity: e("buddha"), role: "mention" }, { entity: e("geiger"), role: "mention" }],
  });

  // Misconceptions
  c("m_mahavira_founder", {
    text: "Mahāvīra founded Jainism.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "Jains count him the twenty-fourth Tīrthaṅkara, and historians accept that the twenty-third, Pārśva, was a real teacher before him. Mahāvīra reformed an existing order.",
    themes: ["religion"],
    lenses: ["popular"],
    entities: [{ entity: e("mahavira") }],
  });
  c("m_buddha_dates", {
    text: "The Buddha's dates are settled: he lived from 563 to 483 BCE.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "563–483 is an early-twentieth-century calculation from a Sri Lankan chronicle, which its own author called hypothetical; many historians now date the Buddha's death to about 400 BCE.",
    themes: ["historiography", "religion"],
    lenses: ["popular"],
    entities: [{ entity: e("buddha") }],
  });
  c("m_one_map", {
    text: "The sixteen mahājanapadas were sixteen kingdoms that existed side by side on one map at one moment.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "The sixteen come from a stock list of peoples, not a survey; other lists differ; some were kingdoms and some clan republics; and by the Buddha's time the large kingdoms were already swallowing the small. Map outlines for them are modern reconstructions from such lists.",
    themes: ["polity", "sources"],
    lenses: ["popular"],
    entities: [{ entity: PERIOD }],
  });
  c("m_democracy", {
    text: "The clan republics (gaṇa-saṅghas) of ancient India were democracies, like modern ones.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "They were governed by assemblies, but power lay mostly with warrior families; historians disagree whether to call them democracies, oligarchies or aristocracies.",
    themes: ["governance", "historiography"],
    lenses: ["popular"],
    entities: [{ entity: e("t_gana") }],
  });
  c("m_alexander_india", {
    text: "Alexander the Great conquered India.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "Alexander campaigned for about two years in the north-west, in what is now Pakistan, and turned back at the Beas when his army refused to go on; he never reached the Ganges plain.",
    themes: ["war"],
    lenses: ["popular"],
    entities: [{ entity: "alexander-the-great" }],
  });

  // ------------------------------------------------------------ citations
  const cite = (claim: string, excerpt: string, stance: "supports" | "contradicts" | "qualifies" | "mentions" = "supports", note?: string) =>
    ops.push({ op: "cite", claim: `@${claim}`, excerpt: `@${excerpt}`, stance, ...(note ? { note } : {}) });
  const cites = (claim: string, ...excerpts: string[]) => excerpts.forEach((x) => cite(claim, x));

  cites("c_sixteen", "x_bi_sixteen", "x_wp_mj_anguttara", "x_wp_mj_lead");
  cites("c_peoples", "x_bi_peoples", "x_bi_tribal");
  cites("c_lists_differ", "x_wp_mj_digha", "x_wp_mj_bhagavati");
  cite("c_lists_differ", "x_parg_contemporary", "mentions", "The Purāṇas list other dynasties of the time.");
  cites("c_mj_dates", "x_wp_mj_lead", "x_wp_hi_urban", "x_usingh_mj");
  cite("c_mj_dates", "x_bi_vesali_only", "supports", "Rhys Davids writes of “the sixth century B.C.”");
  cites("c_no_paramount", "x_bi_no_paramount", "x_bi_four_kingdoms", "x_bi_absorption");
  cites("c_four_kingdoms", "x_bi_magadha", "x_bi_kosala", "x_bi_vamsa", "x_bi_avanti");
  cites("c_alliances", "x_bi_alliances", "x_wp_bim_kosala");
  cites("c_brahmin_books", "x_bi_brahmin_books");
  cites("c_mote_hall", "x_bi_mote_hall", "x_bi_mallas_hall", "x_wp_bu_shakya");
  cites("c_raja_elected", "x_bi_chief_unknown", "x_bi_raja_consul");
  cites("c_vajji_assemblies", "x_sbe_assemblies", "x_sbe_concord");
  cites("c_vesali_senate", "x_jacobi_vesali_senate");
  cites("c_licchavi_rajas", "x_wp_gs_aristocratic", "x_wp_gs_kshatriya", "x_thapar");
  cites("c_shakya_open", "x_wp_gs_shakya", "x_wp_bu_shakya");
  cites("c_greek_aristocracy", "x_arr_beyond_hyphasis");
  cites("c_gs_debate", "x_wp_gs_debate", "x_sharma_republics", "x_wp_mj_gana");
  cites("c_monarchy", "x_bi_monarchy");
  cites("c_urban", "x_wp_hi_urban", "x_wp_hi_nbpw", "x_wp_nbpw_dates", "x_wp_nbpw_peak");
  cites("c_great_cities", "x_sbe_great_cities", "x_sbe_little_town", "x_bi_saketa", "x_bi_savatthi");
  cites("c_vesali_city", "x_bi_vesali_only");
  cites("c_sramana", "x_wp_hi_sramana");
  cite("c_sramana", "x_dial_purana", "supports", "One of the wandering teachers, “the head of an order”.");
  cites("c_writing", "x_bi_writing", "x_bi_writing_books");
  cites("c_bimbisara", "x_mhv_bimbisara", "x_wp_bim_anga");
  cites("c_parricide", "x_dial_confession", "x_mhv_ajatasattu", "x_bi_parricide", "x_wp_aja_father");
  cites("c_jain_death", "x_wp_bim_jain_death");
  cites("c_vajji_war", "x_sbe_attack", "x_sbe_vassakara", "x_bi_vesali_destroyed", "x_jacobi_conquered", "x_wp_aja_vajji");
  cite("c_vajji_war", "x_bi_vajji_not_broken", "qualifies");
  cites("c_pataligama", "x_sbe_fortress", "x_sbe_pataliputta", "x_sbe_three_dangers", "x_jacobi_ajatasatru", "x_wp_aja_pataliputra");
  cites("c_jacobi_foundation", "x_jacobi_conquered");
  cites("c_udayin", "x_parg_udayin", "x_wp_har_capital");
  cites("c_susunaga", "x_mhv_parricides", "x_parg_sisunaga", "x_mhv_kalasoka");
  cites("c_avanti_annexed", "x_parg_pradyota", "x_wp_shi_avanti", "x_bi_ujjeni_magadha");
  cites("c_council", "x_wp_shi_council", "x_mhv_kalasoka");
  cites("c_no_dates", "x_smith_puranic", "x_wp_har_dates", "x_wp_har_sarao", "x_sarao");
  cites("c_buddha_magadha", "x_smith_founder", "x_mhv_bimbisara");
  cites("c_first_sermon", "x_sbe_first_sermon", "x_sbe_two_extremes", "x_sbe_middle_path", "x_sbe_eightfold");
  cites("c_four_places", "x_sbe_four_places", "x_sbe_born");
  cites("c_eighty", "x_sbe_eighty", "x_sbe_cart", "x_bi_mallas_hall");
  cites("c_nibbana_8", "x_mhv_nirvana8");
  cites("c_pasenadi_lay", "x_wp_pas_lay", "x_wp_pas_kosala", "x_bi_savatthi");
  cites("c_six_teachers", "x_dial_visit", "x_dial_purana", "x_dial_six", "x_dial_six2");
  cites("c_gosala", "x_dial_gosala", "x_dial_gosala_summary");
  cites("c_ajita", "x_dial_ajita");
  cites("c_nataputta", "x_jacobi_nataputta", "x_dial_six2");
  cites("c_mahavira_life", "x_kalpa_72", "x_kalpa_papa", "x_jacobi_twelve_years", "x_jacobi_kevali");
  cite("c_mahavira_life", "x_jacobi_twentyeight", "qualifies", "Jacobi gives twenty-eight for the renunciation.");
  cites("c_mahavira_birth", "x_jacobi_kundagrama", "x_jacobi_suburb", "x_jacobi_noking", "x_jacobi_vaidehi", "x_jacobi_bimbisara", "x_wp_mv_birth");
  cites("c_ahimsa", "x_acaranga_ahimsa");
  cites("c_parshva", "x_jacobi_parsva", "x_jacobi_not_new", "x_wp_par_hist", "x_wp_par_dates", "x_wp_par_jacobi", "x_dundas");
  cites("c_mahavira_24", "x_wp_mv_24th", "x_wp_mv_historicity", "x_jacobi_parsva");
  cites("c_mahavira_dates", "x_wp_mv_599", "x_wp_mv_100years");
  cites("c_cyrus", "x_wp_ac_cyrus");
  cites("c_behistun", "x_behistun_provinces", "x_behistun_gandara", "x_wp_ac_518");
  cites("c_provinces", "x_wp_ac_provinces", "x_herod_gandarians_tribute", "x_herod_tribute");
  cites("c_skylax", "x_herod_skylax", "x_herod_subdued", "x_smith_skylax");
  cites("c_tribute", "x_herod_tribute");
  cite("c_tribute", "x_wp_ac_gold_doubt", "qualifies");
  cites("c_beyond_persia", "x_herod_not_subjects", "x_herod_ants");
  cites("c_xerxes", "x_herod_xerxes", "x_herod_gandarians_army");
  cites("c_gaugamela", "x_arr_gaugamela_indians", "x_arr_gaugamela_elephants");
  cites("c_persia_until", "x_wp_ac_338", "x_wp_ac_nosatraps");
  cites("c_darius_contemporary", "x_smith_darius", "x_smith_annex");
  cites("c_taxila_hindush", "x_wp_tx_hindush");
  cites("c_nanda_purana", "x_parg_nanda", "x_parg_sole", "x_smith_mahapadma", "x_wp_nanda_purana", "x_wp_nanda_shudra");
  cites("c_nanda_barber", "x_mcc_curtius_barber", "x_mcc_diodoros_barber", "x_wp_nanda_diodorus", "x_wp_nanda_jain", "x_habib_jha");
  cites("c_nanda_army", "x_mcc_curtius_army", "x_mcc_diodoros_army");
  cites("c_nanda_dates", "x_wp_nanda_dates", "x_mhv_nandas", "x_parg_kautilya", "x_usingh_nanda", "x_habib_jha");
  cites("c_nanda_end", "x_parg_kautilya", "x_mhv_canakka", "x_wp_nanda_overthrow");
  cites("c_taxila", "x_arr_taxila", "x_wp_tx_panini");
  cites("c_hydaspes", "x_arr_hydaspes_date", "x_arr_hydaspes_date_note", "x_wp_ic_hydaspes");
  cites("c_porus", "x_arr_porus_kingly", "x_arr_porus_rule", "x_wp_po_sources");
  cites("c_hyphasis", "x_arr_coenus", "x_arr_return", "x_wp_ic_mutiny", "x_wp_ic_dates");
  cites("c_androkottos", "x_mcc_plutarch_youth", "x_mcc_plutarch_androkottos");
  cites("c_agrammes", "x_wp_nanda_dhana");
  cites("c_mhv_218", "x_mhv_218");
  cites("c_long_544", "x_wp_bu_long", "x_sbe_rd_543");
  cites("c_geiger_483", "x_mhv_483", "x_mhv_321", "x_mhv_hypothetical");
  cites("c_convention_563", "x_wp_bu_563", "x_smith_487", "x_smith_487b");
  cites("c_rd_short", "x_sbe_rd_date", "x_sbe_rd_150", "x_sbe_rd_485");
  cites("c_short_now", "x_wp_bu_1988", "x_wp_bu_410", "x_wp_bu_short", "x_cousins", "x_narain");
  cite("c_short_now", "x_wp_bu_notall", "qualifies");
  cite("c_short_now", "x_wp_bu_uncertain", "supports");
  cites("c_lumbini_shrine", "x_wp_bu_lumbini", "x_fogelin");
  cites("c_vijaya", "x_mhv_vijaya", "x_mhv_biassed", "x_mhv_contemporaries");
  cite("m_mahavira_founder", "x_smith_founder", "mentions", "Smith (1914) calls Mahāvīra “the founder of the system known as Jainism”.");
  cite("m_mahavira_founder", "x_jacobi_parsva", "contradicts");
  cite("m_mahavira_founder", "x_wp_mv_24th", "contradicts");
  cite("m_buddha_dates", "x_mhv_483", "mentions", "The source of the familiar dates.");
  cite("m_buddha_dates", "x_mhv_hypothetical", "contradicts");
  cite("m_buddha_dates", "x_wp_bu_1988", "contradicts");
  cite("m_one_map", "x_bi_tribal", "contradicts");
  cite("m_one_map", "x_wp_mj_bhagavati", "contradicts");
  cite("m_one_map", "x_bi_absorption", "contradicts");
  cite("m_democracy", "x_wp_gs_kshatriya", "contradicts");
  cite("m_democracy", "x_wp_gs_debate", "qualifies");
  cite("m_alexander_india", "x_arr_return", "contradicts");
  cite("m_alexander_india", "x_wp_ic_dates", "contradicts");

  // ------------------------------------------------------------ relations
  const rel = (from: string, to: string, type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", note?: string) =>
    ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) });
  rel("c_peoples", "c_sixteen", "qualifies");
  rel("c_lists_differ", "c_sixteen", "qualifies");
  rel("c_no_paramount", "c_four_kingdoms", "context_for");
  rel("c_jain_death", "c_parricide", "contradicts");
  rel("c_licchavi_rajas", "c_vajji_assemblies", "qualifies", "Assemblies of a warrior aristocracy.");
  rel("c_shakya_open", "c_licchavi_rajas", "qualifies");
  rel("c_vesali_senate", "c_vajji_assemblies", "qualifies");
  rel("c_vajji_war", "c_pataligama", "context_for");
  rel("c_jacobi_foundation", "c_vajji_war", "context_for");
  rel("c_udayin", "c_pataligama", "context_for");
  rel("c_nataputta", "c_six_teachers", "context_for");
  rel("c_parshva", "c_mahavira_life", "context_for");
  rel("c_skylax", "c_behistun", "context_for");
  rel("c_beyond_persia", "c_tribute", "qualifies");
  rel("c_nanda_barber", "c_nanda_purana", "supports", "Greek, Jain and Purāṇic traditions agree on low birth.");
  rel("c_agrammes", "c_nanda_barber", "context_for");
  rel("c_androkottos", "c_nanda_end", "context_for");
  rel("c_geiger_483", "c_mhv_218", "context_for");
  rel("c_rd_short", "c_geiger_483", "contradicts");
  rel("c_short_now", "c_convention_563", "contradicts");
  rel("c_long_544", "c_geiger_483", "contradicts");
  rel("c_vijaya", "c_mhv_218", "qualifies", "The chronicle's chronology is shaped by devotion.");
  rel("c_parshva", "m_mahavira_founder", "corrects");
  rel("c_mahavira_24", "m_mahavira_founder", "corrects");
  rel("c_short_now", "m_buddha_dates", "corrects");
  rel("c_geiger_483", "m_buddha_dates", "qualifies", "The dates are a hypothetical calculation.");
  rel("c_peoples", "m_one_map", "corrects");
  rel("c_lists_differ", "m_one_map", "corrects");
  rel("c_no_paramount", "m_one_map", "qualifies");
  rel("c_licchavi_rajas", "m_democracy", "corrects");
  rel("c_gs_debate", "m_democracy", "qualifies");
  rel("c_hyphasis", "m_alexander_india", "corrects");

  return ops;
}

// ---------------------------------------------------------------- page

export function mahajanapadaPage(E: Record<string, string>): ChangeOpInput {
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
        `In the centuries before the Mauryas, northern India was a patchwork of kingdoms and clan republics. Buddhist texts remember ${C("c_sixteen", "sixteen “great countries”")}, from Gandhāra in the north-west to Aṅga in the east. ${C("c_urban", "Towns grew up again")} for the first time since the Indus cities, and in them ${C("c_sramana", "wandering teachers questioned the old rituals")}: among them ${N("buddha", "the Buddha")} and ${N("mahavira", "Mahāvīra")}.`,
        `One kingdom, ${N("magadha", "Magadha")}, swallowed its neighbours, and ${C("c_nanda_end", "a brahmin's protégé, Chandragupta Maurya, took it over")} around 322 BCE. Meanwhile Persia ${C("c_behistun", "ruled Gandhāra")}, and ${C("c_hydaspes", "Alexander of Macedon fought his way to the Jhelum")}. Almost every date here is uncertain: ${C("c_no_dates", "no one can fix the reigns of the pre-Maurya kings")}, and ${C("c_short_now", "even the Buddha's dates are argued over")}.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("buddha"), text: `Often dated 563–483 BCE. ${C("c_short_now", "Many historians now put his death about 400 BCE")}.`, target: "ch-dating", targetLabel: "When did the Buddha live?" },
        { entity: e("mahavira"), text: `Often called the founder of Jainism. ${C("c_parshva", "Jains and historians say the order is older")}.`, target: "ch-teachers", targetLabel: "Mahāvīra and the teachers" },
        { entity: PERIOD, text: `“Sixteen great kingdoms.” ${C("c_peoples", "The list names peoples, not mapped states")}.`, target: "ch-sixteen", targetLabel: "Sixteen great countries" },
        { entity: "alexander-the-great", text: `“Alexander conquered India.” ${C("c_hyphasis", "His army turned back at the Beas")}.`, target: "ch-nandas", targetLabel: "The Nandas and Alexander" },
        { entity: "pataliputra", text: `Later the Maurya capital. ${C("c_pataligama", "It began as a fort against the Vajjians")}.`, target: "ch-magadha", targetLabel: "Magadha's rise" },
        { entity: e("vajji"), text: `“India's first republic.” ${C("c_gs_debate", "Historians argue whether that is the right word")}.`, target: "ch-republics", targetLabel: "Kings and clans" },
      ],
    },
    {
      id: "meanwhile",
      type: "meanwhile",
      title: "Meanwhile, beyond the sixteen",
      items: [
        { region: "Persia", label: "Darius I lists Gandāra among his lands, c. 518 BCE", entity: e("darius"), claimIds: ["@c_behistun", "@c_provinces"] },
        { region: "The Indus and the sea", label: "Skylax sails down the Indus for Darius", entity: e("skylax"), claimIds: ["@c_skylax"] },
        { region: "Greece", label: "Indian soldiers march with Xerxes, 480 BCE", entity: e("herodotus"), claimIds: ["@c_xerxes", "@c_tribute"] },
        { region: "Mesopotamia", label: "Indian troops and elephants at Gaugamela, 331 BCE", entity: "achaemenid-empire", claimIds: ["@c_gaugamela"] },
        { region: "Macedon", label: "Alexander crosses into India, 327–325 BCE", entity: "alexander-the-great", claimIds: ["@c_hydaspes", "@c_hyphasis"] },
        { region: "Sri Lanka", label: "The chronicle's Prince Vijaya lands on the day of the Buddha's death", claimIds: ["@c_vijaya"] },
      ],
      note: "Each line rests on the claims linked to it. Persian and Greek sources give this period its first firm dates; the Indian texts that describe it were written down later.",
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-sixteen",
      type: "chapter",
      title: "Sixteen great countries",
      promise: "What the famous list of sixteen states is, what it is not, and the four kingdoms that mattered most.",
      when: { start: bce(600), end: bce(450), basis: "The world of the early Buddhist texts, broadly" },
      places: [e("rajagaha"), e("savatthi"), e("kosambi"), "ujjain"],
      people: [e("bimbisara"), e("pasenadi"), e("udena"), e("pajjota"), e("rhysdavids")],
      terms: ["@t_mahajanapada"],
    },
    {
      id: "sixteen-prose",
      type: "prose",
      markdown: [
        `Early Buddhist texts keep ${C("c_sixteen", "a stock list of sixteen great countries")}, or ${N("t_mahajanapada", "mahājanapadas")}. Historians place them ${C("c_mj_dates", "between the sixth and fourth centuries BCE")}. But the list is not a map. ${C("c_peoples", "Its names are peoples, not countries")}, and ${C("c_lists_differ", "other texts list twelve, or a different sixteen")}.`,
        `By the Buddha's time ${C("c_no_paramount", "no one ruled them all")}. Four kingdoms stood out: ${C("c_four_kingdoms", "Magadha, Kosala, the Vatsas and Avanti")}, whose royal families ${C("c_alliances", "married one another and fought one another")}. Most of what we know comes from Buddhist and Jain texts; ${C("c_brahmin_books", "the brahmin books say little about the clan states")}.`,
      ].join("\n\n"),
    },
    { id: "sixteen-claims", type: "claims", claimIds: ["@c_sixteen", "@c_peoples", "@c_lists_differ", "@c_mj_dates", "@c_no_paramount", "@c_four_kingdoms", "@c_alliances", "@c_brahmin_books"] },
    {
      id: "sixteen-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The borders on the map are a modern reconstruction (Cliopatria) drawn from lists like this one, not from surveyed frontiers. Treat them as “roughly here”.",
    },

    // ------------------------------------------------------------ 2
    {
      id: "ch-republics",
      type: "chapter",
      title: "Kings and clans",
      promise: "Some states had no king: clans met in assembly halls. Were they republics, democracies, or something else?",
      when: { start: bce(550), end: bce(450), basis: "The Buddha's lifetime, broadly" },
      places: [e("vesali"), e("kapilavatthu")],
      people: [e("rhysdavids"), e("jacobi")],
      terms: ["@t_gana", "@t_santhagara", "@t_varna"],
    },
    {
      id: "republics-prose",
      type: "prose",
      markdown: [
        `Beside the kingdoms lived ${N("t_gana", "clan states")}. The Buddha's own clan, ${C("c_mote_hall", "the Sakyas, met in an assembly hall at Kapilavatthu")}, with ${C("c_raja_elected", "a chosen chief who held the title rājā")}. The largest was the Vajjian league at Vesālī: ${C("c_vajji_assemblies", "the Buddha said it would prosper so long as it held full and frequent assemblies")}.`,
        `Who sat in those assemblies? ${C("c_licchavi_rajas", "Among the Licchavis, thousands of heads of warrior families")}; ${C("c_vesali_senate", "a nineteenth-century scholar read the texts as describing a senate of nobles")}. Greek soldiers heard of ${C("c_greek_aristocracy", "a country ruled by its aristocracy")}. ${C("c_gs_debate", "Historians still disagree")} about the right word for them.`,
      ].join("\n\n"),
    },
    { id: "republics-claims", type: "claims", claimIds: ["@c_mote_hall", "@c_raja_elected", "@c_vajji_assemblies", "@c_licchavi_rajas", "@c_vesali_senate", "@c_shakya_open", "@c_greek_aristocracy", "@c_monarchy"] },
    {
      id: "republics-debate",
      type: "debate",
      theme: "governance",
      question: "Were the clan states democracies?",
      positions: [
        { label: "Rule by assembly (the suttas; Rhys Davids, 1903)", claimIds: ["@c_vajji_assemblies", "@c_mote_hall", "@c_shakya_open"] },
        { label: "Rule by a warrior aristocracy", claimIds: ["@c_licchavi_rajas", "@c_vesali_senate", "@c_greek_aristocracy"] },
      ],
      note: "Both can be true at once: decisions were made in assemblies, but the assemblies were of the leading kṣatriya families. Words like “republic” and “democracy” bring modern ideas with them.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-cities",
      type: "chapter",
      title: "Towns again",
      promise: "The first cities since the Indus civilisation, and the wandering teachers who walked between them.",
      when: { start: bce(600), end: bce(400), basis: "The second urbanisation, broadly" },
      places: [e("rajagaha"), e("savatthi"), e("kosambi"), e("benares"), e("vesali")],
      terms: ["@t_nbpw", "@t_sramana"],
    },
    {
      id: "cities-prose",
      type: "prose",
      markdown: [
        `From about 600 BCE ${C("c_urban", "towns grew up again in the Ganges plain")}; archaeologists recognise them by a glossy black pottery, ${N("t_nbpw", "Northern Black Polished Ware")}. The texts know six great cities: when the Buddha lay dying, ${C("c_great_cities", "Ānanda listed Campā, Rājagaha, Sāvatthi, Sāketa, Kosambī and Benares")}. Among the clan states, ${C("c_vesali_city", "only Vesālī was a great city")}.`,
        `In the towns and on the roads between them moved ${N("t_sramana", "śramaṇas")}, ${C("c_sramana", "ascetics who had left home and challenged the brahmins' rituals")}. Their teachings were remembered by word of mouth: ${C("c_writing", "writing was known, but books were not yet written down")}.`,
      ].join("\n\n"),
    },
    { id: "cities-claims", type: "claims", claimIds: ["@c_urban", "@c_great_cities", "@c_vesali_city", "@c_sramana", "@c_writing"] },

    // ------------------------------------------------------------ 4
    {
      id: "ch-magadha",
      type: "chapter",
      title: "Magadha's rise",
      promise: "How one kingdom in south Bihar swallowed its neighbours, by marriage, murder and war.",
      when: { start: bce(544, true, true), end: bce(345, true, true), label: "c. 6th–4th century BCE", basis: "From Bimbisāra to the end of the Śiśunāgas; absolute dates are uncertain" },
      places: [e("rajagaha"), "pataliputra", e("vesali")],
      people: [e("bimbisara"), e("ajatasattu")],
    },
    {
      id: "magadha-prose",
      type: "prose",
      markdown: [
        `${N("bimbisara", "Bimbisāra")} of Magadha ${C("c_bimbisara", "reigned for half a century and took Aṅga to the east")}. His son ${N("ajatasattu", "Ajātasattu")} came to the throne, Buddhist tradition says, ${C("c_parricide", "by killing him")}; ${C("c_jain_death", "the Jains tell it differently")}.`,
        `Ajātasattu ${C("c_vajji_war", "set out to “root out” the Vajjian league")}, and ${C("c_pataligama", "built a fort against it at the village of Pāṭaligāma")}, which grew into Pāṭaliputra; ${C("c_udayin", "his successor moved the capital there")}. Later kings ${C("c_avanti_annexed", "took Avanti")}, and ${C("c_susunaga", "the throne passed to a minister, Susunāga")}. Exact dates are out of reach: ${C("c_no_dates", "they differ by half a century depending on whom you follow")}.`,
      ].join("\n\n"),
    },
    { id: "magadha-claims", type: "claims", claimIds: ["@c_bimbisara", "@c_parricide", "@c_jain_death", "@c_vajji_war", "@c_pataligama", "@c_jacobi_foundation", "@c_udayin", "@c_susunaga", "@c_avanti_annexed", "@c_council", "@c_no_dates"] },
    {
      id: "magadha-quote",
      type: "quote",
      excerptId: "@x_sbe_attack",
      caption: "Ajātasattu on the Vajjians, Mahāparinibbāna Sutta I.2, in T. W. Rhys Davids's translation (1881), p. 2.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-buddha",
      type: "chapter",
      title: "The Buddha",
      promise: "What the oldest texts say about the Buddha's teaching, his last journey and his death.",
      places: ["lumbini", e("bodhgaya"), "sarnath", e("kusinara")],
      people: [e("buddha"), e("pasenadi")],
      terms: ["@t_nibbana", "sangha"],
    },
    {
      id: "buddha-prose",
      type: "prose",
      markdown: [
        `${N("buddha", "The Buddha")} was a Sakya who taught in the kingdoms of the Ganges plain; ${C("c_buddha_magadha", "he and Mahāvīra both taught in Magadha under Bimbisāra")}, and ${C("c_pasenadi_lay", "Pasenadi of Kosala became his follower")}. ${C("c_first_sermon", "His first sermon, in the Deer Park near Benares, taught a middle path")}.`,
        `The Mahāparinibbāna Sutta tells his last journey. ${C("c_eighty", "At eighty, his body “like a worn-out cart”, he died at Kusinārā")}, and ${C("c_four_places", "four places of his life became places of pilgrimage")}. ${C("c_nibbana_8", "The Sri Lankan chronicle dates his death to Ajātasattu's eighth year")}; when that was is the subject of a later chapter.`,
      ].join("\n\n"),
    },
    { id: "buddha-claims", type: "claims", claimIds: ["@c_buddha_magadha", "@c_first_sermon", "@c_four_places", "@c_eighty", "@c_nibbana_8", "@c_pasenadi_lay"] },
    {
      id: "buddha-quote",
      type: "quote",
      excerptId: "@x_sbe_eighty",
      caption: "Mahāparinibbāna Sutta II.32, in T. W. Rhys Davids's translation (1881), p. 37.",
    },
    {
      id: "buddha-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The suttas were handed down by memory and written down centuries after the Buddha. They tell us what his followers remembered and believed, which is not always the same as what happened.",
    },

    // ------------------------------------------------------------ 6
    {
      id: "ch-teachers",
      type: "chapter",
      title: "Mahāvīra and the other teachers",
      promise: "The Buddha was one teacher among many. Who were the others, and what did Mahāvīra teach?",
      places: [e("vesali")],
      people: [e("mahavira"), e("parshva"), e("gosala"), e("jacobi")],
      terms: ["tirthankara", "@t_kevalin", "@t_nigantha", "@t_ajivika"],
    },
    {
      id: "teachers-prose",
      type: "prose",
      markdown: [
        `When Ajātasattu went looking for wisdom, ${C("c_six_teachers", "his ministers named six famous teachers before the Buddha")}. ${C("c_gosala", "Makkhali Gosāla taught that fate ruled everything")}; ${C("c_ajita", "Ajita denied that deeds had any fruit")}. We know them only from their rivals, the Buddhists.`,
        `One of the six was the Nigaṇṭha Nātaputta, ${C("c_nataputta", "whom scholars identify with Mahāvīra")}. ${C("c_mahavira_birth", "Born near Vesālī, related to the kings of Magadha")}, ${C("c_mahavira_life", "he spent twelve years in austerities before attaining perfect knowledge, and died at seventy-two")}. He taught ${C("c_ahimsa", "that no living creature should be harmed")}. But ${C("c_mahavira_24", "Jains count him the twenty-fourth teacher, not the first")}, and ${C("c_parshva", "the twenty-third, Pārśva, was probably a real teacher before him")}. ${C("c_mahavira_dates", "His own dates are as uncertain as the Buddha's")}.`,
      ].join("\n\n"),
    },
    { id: "teachers-claims", type: "claims", claimIds: ["@c_six_teachers", "@c_gosala", "@c_ajita", "@c_nataputta", "@c_mahavira_birth", "@c_mahavira_life", "@c_ahimsa", "@c_mahavira_24", "@c_parshva", "@c_mahavira_dates"] },
    {
      id: "teachers-quote",
      type: "quote",
      excerptId: "@x_acaranga_ahimsa",
      caption: "Ācārāṅga Sūtra I.4.1, in Hermann Jacobi's translation (1884), p. 36.",
    },

    // ------------------------------------------------------------ 7
    {
      id: "ch-persia",
      type: "chapter",
      title: "Persia on the Indus",
      promise: "For two centuries the north-west was part of the Persian empire. What do Persian and Greek sources say?",
      when: { start: bce(535), end: bce(330), basis: "From Cyrus's campaigns (c. 535) to the fall of Persia (330)" },
      places: [e("behistun"), "taxila"],
      people: [e("cyrus"), e("darius"), e("skylax"), e("herodotus")],
      terms: ["@t_satrapy"],
    },
    {
      id: "persia-prose",
      type: "prose",
      markdown: [
        `The first firm dates of Indian history come from Persia. ${C("c_cyrus", "Cyrus began pushing into the north-west around 535 BCE")}, and ${C("c_behistun", "Darius I's great inscription at Behistun lists Gandāra among his lands")}. ${C("c_provinces", "Persian records name three Indus provinces")}, and Herodotus tells how ${C("c_skylax", "Darius sent Skylax down the Indus to the sea")}.`,
        `The Indians, Herodotus says, ${C("c_tribute", "paid the largest tribute in the empire, in gold dust")}, though ${C("c_beyond_persia", "some Indians lay beyond Persia's reach")}. ${C("c_xerxes", "Indian soldiers in cotton marched with Xerxes against Greece")}, and ${C("c_gaugamela", "Indians still fought for Persia in its last great battle")}. ${C("c_persia_until", "Persian rule seems to have lasted into the 330s")}.`,
      ].join("\n\n"),
    },
    { id: "persia-claims", type: "claims", claimIds: ["@c_cyrus", "@c_behistun", "@c_provinces", "@c_skylax", "@c_tribute", "@c_beyond_persia", "@c_xerxes", "@c_gaugamela", "@c_persia_until", "@c_darius_contemporary", "@c_taxila_hindush"] },
    {
      id: "persia-quote",
      type: "quote",
      excerptId: "@x_herod_tribute",
      caption: "Herodotus III.94, in G. C. Macaulay's translation (1890), vol. I, p. 257.",
    },

    // ------------------------------------------------------------ 8
    {
      id: "ch-nandas",
      type: "chapter",
      title: "The Nandas and Alexander",
      promise: "A low-born dynasty ruled the Ganges plain while Alexander fought in the Punjab; then both were gone.",
      when: { start: bce(345, true, true), end: bce(322), basis: "From the Nandas' rise to Chandragupta Maurya" },
      places: ["taxila", e("hydaspes")],
      people: [e("mahapadma"), e("dhananda"), "alexander-the-great", e("porus"), e("taxiles"), "chandragupta-maurya"],
      terms: ["@t_varna"],
    },
    {
      id: "nandas-prose",
      type: "prose",
      markdown: [
        `The last kings of Magadha before the Mauryas were the Nandas. ${C("c_nanda_purana", "The Purāṇas call the founder, Mahāpadma, the son of a śūdra woman who destroyed the warrior kings")}, and ${C("c_nanda_barber", "Greek and Jain stories make him a barber's son")}. ${C("c_nanda_dates", "Their dates are uncertain")}.`,
        `In 327 BCE Alexander of Macedon crossed into the north-west. ${C("c_taxila", "The ruler of Taxila welcomed him")}; ${C("c_porus", "Porus fought him")} and lost ${C("c_hydaspes", "on the Hydaspes in 326")}. ${C("c_nanda_army", "Told of the Nanda king's vast army")}, ${C("c_hyphasis", "Alexander's soldiers refused to go further")}. A young man who saw Alexander, ${C("c_androkottos", "Chandragupta Maurya")}, soon ${C("c_nanda_end", "overthrew the Nandas")} with a brahmin's help.`,
      ].join("\n\n"),
    },
    { id: "nandas-claims", type: "claims", claimIds: ["@c_nanda_purana", "@c_nanda_barber", "@c_agrammes", "@c_nanda_dates", "@c_taxila", "@c_hydaspes", "@c_porus", "@c_nanda_army", "@c_hyphasis", "@c_androkottos", "@c_nanda_end"] },
    {
      id: "nandas-quote",
      type: "quote",
      excerptId: "@x_arr_coenus",
      caption: "Coenus to Alexander at the Hyphasis, Arrian, Anabasis V.27, in E. J. Chinnock's translation (1884).",
    },
    {
      id: "nandas-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Every Greek and Roman account of Alexander was written centuries after him, from memoirs now lost; Porus appears in no Indian source. The Purāṇas and the Greek writers share a hostility to the Nandas' low birth.",
    },

    // ------------------------------------------------------------ 9
    {
      id: "ch-dating",
      type: "chapter",
      title: "When did the Buddha live?",
      promise: "Why the Buddha's dates have moved by a century and a half, and why that matters for everyone else in this story.",
      phase: "later",
      people: [e("geiger"), e("rhysdavids")],
    },
    {
      id: "dating-prose",
      type: "prose",
      markdown: [
        `Almost every date on this page hangs on one question. ${C("c_mhv_218", "The Sri Lankan chronicles count 218 years from the Buddha's death to Aśoka")}; Aśoka can be dated from the Greek kings he names (see the [Maurya Empire](page:maurya-empire)). ${C("c_long_544", "Read one way, that puts the death in 544 BCE")}, the date still used in Sri Lanka. ${C("c_geiger_483", "Read with Greek dates for Chandragupta Maurya, it gives 483")}, the basis of the ${C("c_convention_563", "familiar 563–483")}.`,
        `Other scholars argue for a shorter interval. ${C("c_rd_short", "As early as 1881 Rhys Davids preferred a death around 420–400 BCE")}, and ${C("c_short_now", "many historians now put it near 400")}. ${C("c_vijaya", "The chronicles' own dates were shaped by devotion")}, and ${C("c_lumbini_shrine", "archaeology at Lumbini dates a building, not a birth")}.`,
      ].join("\n\n"),
    },
    { id: "dating-claims", type: "claims", claimIds: ["@c_mhv_218", "@c_long_544", "@c_geiger_483", "@c_convention_563", "@c_rd_short", "@c_short_now", "@c_vijaya", "@c_lumbini_shrine"] },
    {
      id: "dating-debate",
      type: "debate",
      theme: "historiography",
      question: "When did the Buddha die?",
      positions: [
        { label: "544/543 BCE (the Sri Lankan tradition)", claimIds: ["@c_long_544"] },
        { label: "About 486–483 BCE (Geiger, 1912; Smith, 1914)", claimIds: ["@c_geiger_483", "@c_convention_563"] },
        { label: "About 400 BCE or later (Rhys Davids, 1881; many historians today)", claimIds: ["@c_rd_short", "@c_short_now"] },
      ],
      note: "The positions differ by over a century. Every Magadhan reign before the Mauryas moves with them, so this page gives those reigns as lengths, not dates, wherever it can.",
    },

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
    { id: "myth-founder", type: "misconception", theme: "religion", claimId: "@m_mahavira_founder", correctionIds: ["@c_mahavira_24", "@c_parshva"] },
    { id: "myth-dates", type: "misconception", theme: "historiography", claimId: "@m_buddha_dates", correctionIds: ["@c_short_now", "@c_geiger_483", "@c_rd_short"] },
    { id: "myth-map", type: "misconception", theme: "polity", claimId: "@m_one_map", correctionIds: ["@c_peoples", "@c_lists_differ", "@c_no_paramount"] },
    { id: "myth-democracy", type: "misconception", theme: "governance", claimId: "@m_democracy", correctionIds: ["@c_licchavi_rajas", "@c_gs_debate"] },
    { id: "myth-alexander", type: "misconception", theme: "war", claimId: "@m_alexander_india", correctionIds: ["@c_hyphasis", "@c_porus"] },
  ];

  const spec: PageSpecInput = {
    atlas: {
      focus: [e("magadha"), e("kosala"), e("vatsa"), e("avanti"), e("vajji"), e("gandhara"), "haryanka-dynasty", "shishunaga-dynasty", "nanda-empire", "achaemenid-empire"],
      range: [-650, -300],
      initialYear: -500,
      stops: [
        { year: -534, label: "Cyrus pushes east", claimId: "@c_cyrus" },
        { year: -517, label: "Gandāra in Darius's list", claimId: "@c_behistun" },
        { year: -479, label: "Indians march with Xerxes", claimId: "@c_xerxes" },
        { year: -382, label: "Second Buddhist council", claimId: "@c_council" },
        { year: -343, label: "The Nandas, by one dating", claimId: "@c_nanda_dates" },
        { year: -330, label: "Indians at Gaugamela", claimId: "@c_gaugamela" },
        { year: -325, label: "Alexander on the Hydaspes", claimId: "@c_hydaspes" },
        { year: -321, label: "Chandragupta Maurya", claimId: "@c_nanda_end" },
      ],
      neighbours: true,
    },
    timeline: { range: [-650, -300] },
  };

  return {
    op: "create_page",
    slug: "mahajanapadas",
    title: "The Mahājanapadas and the age of the Buddha",
    kind: "era",
    entity: PERIOD,
    summary: "Kingdoms, clan republics and new cities in northern India, c. 600–320 BCE: the Buddha and Mahāvīra, Magadha's rise, Persian rule on the Indus and Alexander's campaign, in the words of the oldest texts and the debates over their dates.",
    blocks,
    status: "published",
    position: 4,
    spec,
  };
}
