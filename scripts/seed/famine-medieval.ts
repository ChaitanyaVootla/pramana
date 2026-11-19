import type { BlockInput, ChangeOpInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "Famine and war in medieval India" (c. 1000–1757): a theme page on what
 * drought, raids, sieges and wars did to ordinary people's food and
 * livelihoods, from Maḥmūd of Ghazna's raids to the Deccan famine of 1702–04.
 *
 * Primary voices, all in public-domain translations: Elliot and Dowson
 * (vols I, III–VII, 1867–77) for Baranī, ʿAfīf, Amīr Khusrau, the
 * Malfūẓāt-i Tīmūrī, Yaḥyā Sirhindī, Badāyūnī, Abu'l Faẓl, Nūr al-Ḥaqq and
 * Lāhorī, with Elliot's own preface as evidence of the selection's purpose;
 * al-Bīrūnī (Sachau); Ibn Baṭṭūṭa (Lee 1829); Bābur (A. S. Beveridge 1922);
 * Paes and Nunes (in Sewell 1900); Peter Mundy (Temple 1914); the English
 * factory letters (Foster 1910); Bernier (Constable and Smith 1916); Manucci
 * (Irvine 1907–08); Sabhāsad (Sen 1920). Secondary: Moreland (1920, 1923),
 * whose translation of the Dutch merchant van Twist is the source for him
 * here; Grant Duff (1826, ed. Edwardes 1921); Sewell (1900).
 *
 * Sources and entities are looked up at run time (sources by exact title and
 * volume, entities by Wikidata QID) and created only where the database lacks
 * them, so the same script runs on the preview and the main database. Claims
 * and excerpts are always this page's own.
 */

export const PAGE_SLUG = "famine-and-war-in-medieval-india";
export const TITLE = "Famine and war in medieval India";

const ce = (year: number, month?: number, day?: number) => ({ year, era: "CE" as const, ...(month ? { month } : {}), ...(day ? { day } : {}) });
const about = (year: number) => ({ year, era: "CE" as const, approximate: true });

// ---------------------------------------------------------------- snapshots

export const CAPTURES = {
  ed1: "cu31924024066593",
  ed3: "historyofindiaas03elli",
  ed4: "cu31924073036745",
  ed5: "cu31924073036752",
  ed6: "india.history.resource.372",
  ed7: "cu31924073036778",
  lee: "bub_gb_22IbAQAAMAAJ",
  sewell: "dli.ministry.02147",
  sachau: "alberunisindiaac01biru",
  babur: "baburnamainengli02babuuoft",
  mundy: "travelsofpetermu02mund",
  foster: "in.ernet.dli.2015.227148",
  mor23: "fromakbartoauran0000unse",
  mor20: "cu31924022895001",
  bernier: "travelsinmogulem00bernuoft",
  manucci: "storiadomogororm04manu",
  duff: "historyofmahratt01duff",
  sen: "sivachhatrapatib00sensuoft",
} as const;
export type Key = keyof typeof CAPTURES;
export type Snaps = Record<Key, { id: string }>;

export async function captureAll(mcp: Mcp): Promise<Snaps> {
  const out = {} as Snaps;
  for (const [key, identifier] of Object.entries(CAPTURES) as [Key, string][]) {
    const s = await mcp.call<{ id: string; title: string | null }>("capture_snapshot", { origin: { kind: "internet_archive", identifier } });
    out[key] = { id: s.id };
    console.log(`  ${key}: ${s.id} ${s.title ?? ""}`);
  }
  return out;
}

// ---------------------------------------------------------------- sources

const ia = (id: string) => ({ ia: id, url: `https://archive.org/details/${id}` });
const ED_TITLE = "The History of India, as Told by Its Own Historians: The Muhammadan Period";
const ED_NOTE =
  "Extracts, not whole works, translated for Sir Henry Elliot and edited by John Dowson; some by unnamed munshis. Elliot's preface states that he meant the selection to show the misrule of “Muhammadan” kings, so the selection is itself a source to examine.";
const ed = (vol: number, year: number, id: string, extra: string): Record<string, unknown> => ({
  kind: "book",
  tier: "primary",
  csl: {
    type: "book",
    title: ED_TITLE,
    editor: [{ family: "Elliot", given: "H. M." }, { family: "Dowson", given: "John" }],
    volume: String(vol),
    issued: { "date-parts": [[year]] },
    publisher: "Trübner and Co.",
    "publisher-place": "London",
  },
  identifiers: ia(id),
  license: { status: "public_domain", note: `Published ${year}; Elliot died 1853, Dowson 1881.` },
  lenses: ["primary_source", "colonial_orientalist"],
  note: `${extra} ${ED_NOTE}`,
});

interface SourceSpec {
  /** Exact title (and volume) used to find it on the platform. */
  title: string;
  volume?: string;
  create: Record<string, unknown>;
}

export const SOURCES: Record<Key, SourceSpec> = {
  ed1: { title: ED_TITLE, volume: "1", create: ed(1, 1867, CAPTURES.ed1, "Vol. I, with Elliot's original preface.") },
  ed3: { title: ED_TITLE, volume: "3", create: ed(3, 1871, "historyofindiaas03elli", "Vol. III: Baranī, Amīr Khusrau's Khazāʾin al-Futūḥ, ʿAfīf, Fīrūz Shāh's Futūḥāt and the Malfūẓāt-i Tīmūrī. The Malfūẓāt is presented as Tīmūr's own memoir; its authenticity is doubted.") },
  ed4: { title: ED_TITLE, volume: "4", create: ed(4, 1872, CAPTURES.ed4, "Vol. IV: includes Yaḥyā bin Aḥmad Sirhindī's Tārīkh-i Mubārak Shāhī (c. 1434) and Bābur's memoirs.") },
  ed5: { title: ED_TITLE, volume: "5", create: ed(5, 1873, CAPTURES.ed5, "Vol. V: includes Badāyūnī's Muntakhab al-Tawārīkh on the Sūr and early Mughal years.") },
  ed6: { title: ED_TITLE, volume: "6", create: ed(6, 1875, CAPTURES.ed6, "Vol. VI: includes Abu'l Faẓl's Akbarnāma and Nūr al-Ḥaqq's Zubdat al-Tawārīkh.") },
  ed7: { title: ED_TITLE, volume: "7", create: ed(7, 1877, CAPTURES.ed7, "Vol. VII: includes ʿAbd al-Ḥamīd Lāhorī's Bādshāhnāma, Shah Jahan's official history.") },
  lee: {
    title: "The Travels of Ibn Batūta",
    create: {
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Travels of Ibn Batūta", translator: [{ family: "Lee", given: "Samuel" }], issued: { "date-parts": [[1829]] }, publisher: "Oriental Translation Committee", "publisher-place": "London" },
      identifiers: ia(CAPTURES.lee),
      license: { status: "public_domain", note: "Published 1829; Lee died 1852." },
      lenses: ["primary_source"],
      note: "Translated from an Arabic abridgement, so the India chapters are short. The Google scan's OCR is poor in places. H. A. R. Gibb's fuller translation (1929) is not used: it is in copyright in India and the UK.",
    },
  },
  sewell: {
    title: "A Forgotten Empire (Vijayanagar): A Contribution to the History of India",
    create: {
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "A Forgotten Empire (Vijayanagar): A Contribution to the History of India", author: [{ family: "Sewell", given: "Robert" }], issued: { "date-parts": [[1900]] }, publisher: "Swan Sonnenschein", "publisher-place": "London" },
      identifiers: ia(CAPTURES.sewell),
      license: { status: "public_domain", note: "Published 1900; Sewell died 1925." },
      lenses: ["colonial_orientalist"],
      note: "Includes Sewell's translations of the Portuguese accounts of Domingo Paes (c. 1520) and Fernão Nunes (c. 1535), primary sources cited here through Sewell.",
    },
  },
  sachau: {
    title: "Alberuni's India",
    create: {
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "Alberuni's India", translator: [{ family: "Sachau", given: "Edward C." }], volume: "1", issued: { "date-parts": [[1910]] }, publisher: "Kegan Paul, Trench, Trübner and Co.", "publisher-place": "London", "original-date": { "date-parts": [[1888]] } },
      identifiers: ia(CAPTURES.sachau),
      license: { status: "public_domain", note: "Translation first published 1888, this reprint 1910; Sachau died 1930." },
      lenses: ["primary_source"],
      note: "Al-Bīrūnī's account of India, written about 1030 by a scholar who came to India with Maḥmūd of Ghazna's court.",
    },
  },
  babur: {
    title: "The Bābur-nāma in English (Memoirs of Bābur)",
    create: {
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Bābur-nāma in English (Memoirs of Bābur)", translator: [{ family: "Beveridge", given: "Annette Susannah" }], volume: "2", issued: { "date-parts": [[1922]] }, publisher: "Luzac and Co.", "publisher-place": "London" },
      identifiers: ia(CAPTURES.babur),
      license: { status: "public_domain", note: "Published 1922; Beveridge died 1929. Public domain in the US (published before 1931) and in India (life + 60)." },
      lenses: ["primary_source"],
      note: "Translated from Bābur's Turki. Vol. II covers his years in Hindustan (1525–1529), including his description of the country.",
    },
  },
  mundy: {
    title: "The Travels of Peter Mundy in Europe and Asia, 1608–1667",
    volume: "2",
    create: {
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Travels of Peter Mundy in Europe and Asia, 1608–1667", editor: [{ family: "Temple", given: "Richard Carnac" }], volume: "2", "collection-title": "Hakluyt Society, Second Series", "collection-number": 35, issued: { "date-parts": [[1914]] }, publisher: "Hakluyt Society", "publisher-place": "London" },
      identifiers: ia(CAPTURES.mundy),
      license: { status: "public_domain", note: "Published 1914; Temple died 1931. Mundy's journal (c. 1630s) is centuries old." },
      lenses: ["primary_source"],
      note: "Vol. II: Travels in Asia, 1628–1634. Mundy, an East India Company factor, crossed Gujarat and Khandesh in November 1630 at the height of the famine and returned in 1633. Appendix A gathers the English letters on the famine.",
    },
  },
  foster: {
    title: "The English Factories in India, 1630–1633",
    create: {
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The English Factories in India, 1630–1633: A Calendar of Documents in the India Office, Bombay Record Office, etc.", author: [{ family: "Foster", given: "William" }], issued: { "date-parts": [[1910]] }, publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: ia(CAPTURES.foster),
      license: { status: "public_domain", note: "Published 1910; Foster died 1951 (public domain in India, life + 60, and in the US)." },
      lenses: ["primary_source"],
      note: "A calendar of the East India Company's letters, quoting them in their own spelling: merchants' reports, interested in trade, written as the famine happened.",
    },
  },
  mor23: {
    title: "From Akbar to Aurangzeb: A Study in Indian Economic History",
    create: {
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "From Akbar to Aurangzeb: A Study in Indian Economic History", author: [{ family: "Moreland", given: "W. H." }], issued: { "date-parts": [[1923]] }, publisher: "Macmillan", "publisher-place": "London" },
      identifiers: ia(CAPTURES.mor23),
      license: { status: "public_domain", note: "Published 1923; Moreland died 1938." },
      lenses: ["colonial_orientalist"],
      note: "Chapter VII examines the famine of 1630–31 from Indian, Dutch and English records, including Moreland's own translation of the Dutch merchant van Twist's account (1638). Moreland was a retired British revenue official; his judgements of Mughal government are his own.",
    },
  },
  mor20: {
    title: "India at the Death of Akbar: An Economic Study",
    create: {
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "India at the Death of Akbar: An Economic Study", author: [{ family: "Moreland", given: "W. H." }], issued: { "date-parts": [[1920]] }, publisher: "Macmillan", "publisher-place": "London" },
      identifiers: ia(CAPTURES.mor20),
      license: { status: "public_domain", note: "Published 1920; Moreland died 1938." },
      lenses: ["colonial_orientalist"],
    },
  },
  bernier: {
    title: "Travels in the Mogul Empire, A.D. 1656–1668",
    create: {
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "Travels in the Mogul Empire, A.D. 1656–1668", author: [{ family: "Bernier", given: "François" }], translator: [{ family: "Constable", given: "Archibald" }], editor: [{ family: "Smith", given: "Vincent A." }], edition: "2", issued: { "date-parts": [[1916]] }, publisher: "Oxford University Press", "publisher-place": "London" },
      identifiers: ia(CAPTURES.bernier),
      license: { status: "public_domain", note: "Published 1916; Constable's translation 1891, revised by V. A. Smith (died 1920)." },
      lenses: ["primary_source"],
      note: "Bernier, a French physician, lived in India 1656–1668. His letter to Colbert argues that the Mogul's ownership of all land ruins a country, so his picture of the peasants serves an argument addressed to France.",
    },
  },
  manucci: {
    title: "Storia do Mogor, or Mogul India, 1653–1708",
    volume: "4",
    create: {
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "Storia do Mogor, or Mogul India, 1653–1708", author: [{ family: "Manucci", given: "Niccolao" }], translator: [{ family: "Irvine", given: "William" }], volume: "4", "collection-title": "Indian Texts Series", issued: { "date-parts": [[1908]] }, publisher: "John Murray", "publisher-place": "London" },
      identifiers: ia(CAPTURES.manucci),
      license: { status: "public_domain", note: "Published 1908; Irvine died 1911." },
      lenses: ["primary_source"],
      note: "Manucci, a Venetian who lived in India for over fifty years, wrote vol. IV's part in the Madras region around 1705; he reports much at second hand.",
    },
  },
  duff: {
    title: "A History of the Mahrattas",
    volume: "1",
    create: {
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "A History of the Mahrattas", author: [{ family: "Grant Duff", given: "James" }], editor: [{ family: "Edwardes", given: "S. M." }], volume: "1", issued: { "date-parts": [[1921]] }, publisher: "Oxford University Press", "publisher-place": "London", "original-date": { "date-parts": [[1826]] } },
      identifiers: ia(CAPTURES.duff),
      license: { status: "public_domain", note: "First published 1826; this edition 1921; Grant Duff died 1858, Edwardes 1927." },
      lenses: ["colonial_orientalist"],
      note: "Grant Duff, a British resident at Satara, drew on Maratha manuscripts and Persian histories.",
    },
  },
  sen: {
    title: "Siva Chhatrapati: Being a Translation of Sabhasad Bakhar with Extracts from Chitnis and Sivadigvijaya",
    create: {
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "Siva Chhatrapati: Being a Translation of Sabhasad Bakhar with Extracts from Chitnis and Sivadigvijaya", translator: [{ family: "Sen", given: "Surendra Nath" }], issued: { "date-parts": [[1920]] }, publisher: "University of Calcutta", "publisher-place": "Calcutta" },
      identifiers: ia(CAPTURES.sen),
      license: { status: "public_domain", note: "Published 1920; Sen died 1962 (public domain in India from 2023, life + 60; in the US, published before 1931)." },
      lenses: ["primary_source"],
      note: "Krishnaji Anant Sabhāsad's chronicle of Shivaji, written in 1694 for his son Rajaram: an admiring court account.",
    },
  },
};

interface SourceCardJson { source: { title: string; csl: { volume?: string } } }

/** Each source: an existing one with the same title (and volume), or a create_source op. */
export async function sourceOps(mcp: Mcp): Promise<{ ref: Record<Key, string>; ops: ChangeOpInput[]; reused: string[] }> {
  const ref = {} as Record<Key, string>;
  const ops: ChangeOpInput[] = [];
  const reused: string[] = [];
  for (const [key, spec] of Object.entries(SOURCES) as [Key, SourceSpec][]) {
    const found = await mcp.call<{ sources: { id: string; title: string }[] }>("search", { query: spec.title.slice(0, 120), types: ["sources"], limit: 30 });
    let hit: string | undefined;
    for (const s of found.sources.filter((x) => x.title === spec.title)) {
      if (!spec.volume) { hit = s.id; break; }
      const d = await mcp.call<SourceCardJson>("get_source", { id: s.id });
      if (String(d.source.csl.volume ?? "") === spec.volume) { hit = s.id; break; }
    }
    if (hit) {
      ref[key] = hit;
      reused.push(`${key} → existing source ${hit}`);
      continue;
    }
    ops.push({ op: "create_source", ref: `fm_${key}`, ...spec.create } as ChangeOpInput);
    ref[key] = `@fm_${key}`;
  }
  return { ref, ops, reused };
}

// ---------------------------------------------------------------- entities

type Kind = "person" | "place" | "site" | "polity" | "event" | "period" | "text";
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  when?: Record<string, unknown>;
  life?: boolean;
  geo?: boolean;
  aliases?: { label: string; lang?: string; note?: string }[];
  link?: { to: string; type: "part_of" | "located_in" | "related_to" | "ruled" | "participant_in"; note?: string };
}

/** The ages (columns) and polities: these exist on every database (spine and borders import). */
export const AGES = {
  emi: "early-medieval-india",
  sultanate: "delhi-sultanate",
  vijayanagara: "vijayanagara-empire",
  mughal: "mughal-empire",
  maratha: "maratha-confederacy",
} as const;

export const ENTITIES: EntitySpec[] = [
  { ref: "famine1630", slug: "deccan-famine-1630-1632", kind: "event", label: "Deccan famine of 1630–1632", qid: "Q3530500", when: { start: ce(1630), end: ce(1632), basis: "Lāhorī, Mundy and the English factory letters: the rains failed in 1630; distress lasted into 1632" }, link: { to: AGES.mughal, type: "part_of" }, description: "The famine that followed the failure of the rains of 1630 in Gujarat and the Deccan, one of the worst recorded in Mughal India.", aliases: [{ label: "Gujarat famine of 1630–1632", lang: "en" }] },
  { ref: "talikota", slug: "battle-of-talikota", kind: "event", label: "Battle of Talikota", qid: "Q1362188", when: { start: ce(1565, 1, 26), basis: "Wikidata Q1362188" }, link: { to: AGES.vijayanagara, type: "related_to", note: "Vijayanagara's defeat, followed by the sack of its capital." }, description: "The battle of January 1565 in which the Deccan sultanates defeated Vijayanagara; its capital was then sacked." },
  // Rulers
  { ref: "mahmud", slug: "mahmud-of-ghazni", kind: "person", label: "Maḥmūd of Ghazna", qid: "Q189271", life: true, link: { to: AGES.emi, type: "related_to", note: "Raided north India repeatedly, c. 1000–1027." }, description: "Sultan of Ghazna (998–1030), who raided north-western and northern India about seventeen times.", aliases: [{ label: "Mahmud of Ghazni", lang: "en" }] },
  { ref: "jalaluddin", slug: "jalal-ud-din-khalji", kind: "person", label: "Jalāl al-Dīn Khaljī", qid: "Q2691885", life: true, link: { to: AGES.sultanate, type: "ruled" }, description: "The first Khaljī sultan of Delhi (1290–1296).", aliases: [{ label: "Jalal-ud-din Firuz Khalji", lang: "en" }] },
  { ref: "alauddin", slug: "alauddin-khalji", kind: "person", label: "ʿAlāʾ al-Dīn Khaljī", qid: "Q335362", life: true, link: { to: AGES.sultanate, type: "ruled" }, description: "Sultan 1296–1316, who held off the Mongols, fixed market prices and kept royal granaries at Delhi.", aliases: [{ label: "Alauddin Khalji", lang: "en" }] },
  { ref: "mbt", slug: "muhammad-bin-tughluq", kind: "person", label: "Muḥammad bin Tughluq", qid: "Q381830", life: true, link: { to: AGES.sultanate, type: "ruled" }, description: "Sultan 1325–1351, in whose reign heavy taxes on the Doab and failed rains brought years of famine around Delhi.", aliases: [{ label: "Muhammad bin Tughlaq", lang: "en" }] },
  { ref: "firuz", slug: "firuz-shah-tughlaq", kind: "person", label: "Fīrūz Shāh Tughluq", qid: "Q455442", life: true, link: { to: AGES.sultanate, type: "ruled" }, description: "Sultan 1351–1388, builder of canals and of new towns such as Ḥiṣār Fīrūza.", aliases: [{ label: "Firuz Shah Tughlaq", lang: "en" }] },
  { ref: "timur", slug: "timur", kind: "person", label: "Tīmūr", qid: "Q8462", life: true, link: { to: AGES.sultanate, type: "related_to", note: "Invaded the Sultanate and sacked Delhi in 1398." }, description: "Central Asian conqueror who invaded north India and sacked Delhi in 1398.", aliases: [{ label: "Tamerlane", lang: "en" }] },
  { ref: "krishnadeva", slug: "krishnadevaraya", kind: "person", label: "Kṛṣṇadevarāya", qid: "Q121235", life: true, link: { to: AGES.vijayanagara, type: "ruled" }, description: "King of Vijayanagara (1509–1529), who built the great tank near the capital described by Paes and Nunes.", aliases: [{ label: "Krishnadevaraya", lang: "en" }, { label: "Crisnarao", lang: "en", note: "Nunes's spelling" }] },
  { ref: "babur", slug: "babur", kind: "person", label: "Bābur", qid: "Q797848", life: true, link: { to: AGES.mughal, type: "ruled" }, description: "Founder of the Mughal Empire (ruled in India 1526–1530), whose memoirs describe Hindustan's land, water and people.", aliases: [{ label: "Babur", lang: "en" }] },
  { ref: "akbar", slug: "akbar", kind: "person", label: "Akbar", qid: "Q8597", life: true, link: { to: AGES.mughal, type: "ruled" }, description: "Mughal emperor 1556–1605, in whose reign famines struck in 1555–56 and 1595–98." },
  { ref: "shahjahan", slug: "shah-jahan", kind: "person", label: "Shah Jahan", qid: "Q83672", life: true, link: { to: AGES.mughal, type: "ruled" }, description: "Mughal emperor 1628–1658, at war in the Deccan when the famine of 1630–32 struck." },
  { ref: "aurangzeb", slug: "aurangzeb", kind: "person", label: "Aurangzeb", qid: "Q485547", life: true, link: { to: AGES.mughal, type: "ruled" }, description: "Mughal emperor 1658–1707, who spent his last quarter-century at war in the Deccan." },
  { ref: "shivaji", slug: "shivaji", kind: "person", label: "Shivaji", qid: "Q239505", life: true, link: { to: AGES.maratha, type: "ruled" }, description: "Founder of the Maratha kingdom (crowned 1674, died 1680)." },
  // Witnesses and writers
  { ref: "biruni", slug: "al-biruni", kind: "person", label: "al-Bīrūnī", qid: "Q11826", life: true, link: { to: AGES.emi, type: "related_to", note: "Wrote his book on India about 1030." }, description: "Scholar from Khwarazm who came to India with Maḥmūd of Ghazna's court and wrote a great account of Indian learning (c. 1030).", aliases: [{ label: "Alberuni", lang: "en", note: "Sachau's spelling" }] },
  { ref: "barani", slug: "ziauddin-barani", kind: "person", label: "Ẓiyāʾ al-Dīn Baranī", qid: "Q207000", life: true, link: { to: AGES.sultanate, type: "related_to", note: "Author of the Tārīkh-i Fīrūz Shāhī (1357)." }, description: "Courtier and historian, author of the Tārīkh-i Fīrūz Shāhī (1357); a hostile witness to Muḥammad bin Tughluq.", aliases: [{ label: "Ziauddin Barani", lang: "en" }, { label: "Barni", lang: "en", note: "Elliot and Dowson's spelling" }] },
  { ref: "ibnbattuta", slug: "ibn-battuta", kind: "person", label: "Ibn Baṭṭūṭa", qid: "Q7331", life: true, link: { to: AGES.sultanate, type: "related_to", note: "A judge at Delhi under Muḥammad bin Tughluq, 1334–1342." }, description: "Moroccan traveller and judge who served at the court of Muḥammad bin Tughluq.", aliases: [{ label: "Ibn Battuta", lang: "en" }] },
  { ref: "paes", slug: "domingo-paes", kind: "person", label: "Domingo Paes", qid: "Q3287974", link: { to: AGES.vijayanagara, type: "related_to", note: "Described Vijayanagara about 1520." }, description: "Portuguese visitor who described the city of Vijayanagara about 1520." },
  { ref: "nunes", slug: "fernao-nunes", kind: "person", label: "Fernão Nunes", qid: "Q531061", link: { to: AGES.vijayanagara, type: "related_to", note: "Wrote a chronicle of Vijayanagara about 1535." }, description: "Portuguese horse-trader who wrote a chronicle of Vijayanagara about 1535.", aliases: [{ label: "Fernão Nuniz", lang: "en", note: "Sewell's spelling" }] },
  { ref: "badauni", slug: "abd-al-qadir-badauni", kind: "person", label: "ʿAbd al-Qādir Badāyūnī", qid: "Q3629943", life: true, link: { to: AGES.mughal, type: "related_to", note: "Author of the Muntakhab al-Tawārīkh." }, description: "Historian at Akbar's court (1540–1615), often critical of the emperor; he saw the famine of 1555–56 as a boy.", aliases: [{ label: "Badauni", lang: "en" }] },
  { ref: "abulfazl", slug: "abul-fazl", kind: "person", label: "Abu'l Faẓl", qid: "Q334752", life: true, link: { to: AGES.mughal, type: "related_to", note: "Author of the Akbarnāma." }, description: "Akbar's minister and official historian, author of the Akbarnāma and the Āʾīn-i Akbarī.", aliases: [{ label: "Abul Fazl", lang: "en" }] },
  { ref: "lahori", slug: "abdul-hamid-lahori", kind: "person", label: "ʿAbd al-Ḥamīd Lāhorī", qid: "Q3595687", link: { to: AGES.mughal, type: "related_to", note: "Official historian of Shah Jahan." }, description: "Official historian of Shah Jahan, author of the Bādshāhnāma.", aliases: [{ label: "Abdul Hamid Lahori", lang: "en" }] },
  { ref: "mundy", slug: "peter-mundy", kind: "person", label: "Peter Mundy", qid: "Q3376775", life: true, link: { to: "@famine1630", type: "related_to", note: "Crossed the famine country in November 1630 and kept a journal." }, description: "English merchant of the East India Company who crossed Gujarat and Khandesh during the famine of 1630 and recorded what he saw." },
  { ref: "bernier", slug: "francois-bernier", kind: "person", label: "François Bernier", qid: "Q375438", life: true, link: { to: AGES.mughal, type: "related_to", note: "In India 1656–1668." }, description: "French physician in India 1656–1668, whose letters describe the Mughal court and the condition of the peasants." },
  { ref: "manucci", slug: "niccolao-manucci", kind: "person", label: "Niccolao Manucci", qid: "Q1344635", life: true, link: { to: AGES.mughal, type: "related_to", note: "Author of the Storia do Mogor." }, description: "Venetian who lived in India from 1656 until his death, author of the Storia do Mogor." },
  { ref: "moreland", slug: "w-h-moreland", kind: "person", label: "W. H. Moreland", qid: "Q92950161", life: true, link: { to: AGES.mughal, type: "related_to", note: "Economic historian of Mughal India." }, description: "British revenue official and economic historian of Mughal India (1868–1938)." },
  // Places (coordinates from Wikidata)
  { ref: "ahmadabad", slug: "ahmedabad", kind: "place", label: "Ahmadabad", qid: "Q1070", geo: true, link: { to: "@famine1630", type: "related_to", note: "The city worst hit by the famine of 1630–32, according to Lāhorī." }, description: "The chief city of Gujarat, founded in 1411.", aliases: [{ label: "Ahmedabad", lang: "en" }, { label: "Amadavaz", lang: "en", note: "Spelling in the English factory letters" }] },
  { ref: "burhanpur", slug: "burhanpur", kind: "place", label: "Burhanpur", qid: "Q593193", geo: true, link: { to: "@famine1630", type: "related_to", note: "Shah Jahan's camp during the famine; a soup kitchen was opened there." }, description: "City on the Tapti in Khandesh, the Mughal base for the Deccan wars." },
  { ref: "hisar", slug: "hisar", kind: "place", label: "Ḥiṣār Fīrūza", qid: "Q1772825", geo: true, link: { to: AGES.sultanate, type: "related_to", note: "Founded by Fīrūz Shāh, who brought canals to it." }, description: "Town founded by Fīrūz Shāh Tughluq in a dry tract north-west of Delhi, watered by his canals; now Hisar in Haryana.", aliases: [{ label: "Hisar", lang: "en" }] },
  { ref: "hampi", slug: "hampi", kind: "site", label: "Hampi (Vijayanagara)", qid: "Q26732", geo: true, link: { to: AGES.vijayanagara, type: "related_to", note: "The ruins of the capital." }, description: "The ruins of the city of Vijayanagara, sacked in 1565.", aliases: [{ label: "Bisnaga", lang: "en", note: "The Portuguese name for Vijayanagara" }] },
];

interface WdSummary {
  aliases: { label: string; lang?: string; script?: string; note?: string }[];
  when: { edtf: string } | null;
  coordinates: { lat: number; lon: number } | null;
}
interface WdMatch { status: "existing" | "pending"; id: string; slug: string | null; changesetId?: string }

export async function entityOps(mcp: Mcp): Promise<{ ref: Record<string, string>; ops: ChangeOpInput[]; dependsOn: string[]; reused: string[] }> {
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids: ENTITIES.flatMap((s) => (s.qid ? [s.qid] : [])) });
  const ref: Record<string, string> = { ...AGES };
  const ops: ChangeOpInput[] = [];
  const dependsOn: string[] = [];
  const reused: string[] = [];
  for (const age of Object.values(AGES)) {
    const e = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: age }).catch(() => null);
    if (!e?.entity) throw new Error(`age entity ${age} is missing on this database`);
  }
  for (const s of ENTITIES) {
    const m = s.qid ? matches[s.qid] : undefined;
    if (m) {
      ref[s.ref] = m.slug ?? m.id;
      if (m.status === "pending" && m.changesetId) dependsOn.push(m.changesetId);
      reused.push(`${s.slug} → ${m.status} ${m.slug ?? m.id}`);
      continue;
    }
    const bySlug = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: s.slug }).catch(() => null);
    if (bySlug?.entity?.id) {
      ref[s.ref] = s.slug;
      reused.push(`${s.slug} → existing (by slug)`);
      continue;
    }
    const wd = s.qid ? await mcp.call<WdSummary | null>("wikidata", { qid: s.qid }) : null;
    const aliases = [
      ...(s.aliases ?? []),
      ...(wd?.aliases ?? []).filter(
        (a) =>
          !(a.script && a.script !== "Latn" && /^[\x00-\x7f]+$/.test(a.label)) &&
          a.label.toLowerCase() !== s.label.toLowerCase() &&
          !(s.aliases ?? []).some((x) => x.label.toLowerCase() === a.label.toLowerCase()),
      ),
    ].slice(0, 10);
    const op: Record<string, unknown> = {
      op: "create_entity",
      ref: s.ref,
      slug: s.slug,
      kind: s.kind,
      label: s.label,
      description: s.description,
      ...(aliases.length ? { aliases } : {}),
      ...(s.qid ? { wikidataId: s.qid } : {}),
    };
    if (s.life && wd?.when)
      op.spans = [{ role: "life", when: { edtf: wd.when.edtf }, basis: `Wikidata ${s.qid}: date of birth and death`, source: { wikidata: { qid: s.qid!, property: "P569/P570" } } }];
    else if (s.when) op.when = s.when;
    if (s.geo && wd?.coordinates)
      op.geo = { geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] }, certainty: "approximate", note: `Coordinates from Wikidata ${s.qid}.` };
    ops.push(op as ChangeOpInput);
    ref[s.ref] = `@${s.ref}`;
  }
  for (const s of ENTITIES) {
    if (!s.link || !ref[s.ref]!.startsWith("@")) continue;
    const to = s.link.to.startsWith("@") ? ref[s.link.to.slice(1)]! : s.link.to;
    ops.push({ op: "link_entities", from: ref[s.ref]!, to, type: s.link.type, ...(s.link.note ? { note: s.link.note } : {}) } as ChangeOpInput);
  }
  return { ref, ops, dependsOn: [...new Set(dependsOn)], reused };
}

// ---------------------------------------------------------------- excerpts

type Loc = { page?: string; pageEnd?: string; volume?: string; label?: string };
export interface ExcerptSpec { ref: string; src: Key; quote: string; locator: Loc; note?: string }
export const EXCERPTS: ExcerptSpec[] = [];
const x = (ref: string, src: Key, quote: string, locator: Loc, note?: string) => EXCERPTS.push({ ref, src, quote, locator, ...(note ? { note } : {}) });

const BARANI = "Baranī, Tārīkh-i Fīrūz Shāhī";
const AFIF = "Shams-i Sirāj ʿAfīf, Tārīkh-i Fīrūz Shāhī";
const LAHORI = "ʿAbd al-Ḥamīd Lāhorī, Bādshāhnāma";
const v = (n: number, page: string, label: string, pageEnd?: string): Loc => ({ volume: String(n), page, ...(pageEnd ? { pageEnd } : {}), label });

// Raids
x("fx_biruni_ruin", "sachau", "utterly ruined the prosperity of the country, and performed there wonderful exploits", { page: "22", label: "Chapter I" });
x("fx_biruni_aversion", "sachau", "Their scattered remains cherish, of course, the most inveterate aversion towards all Muslims.", { page: "22", label: "Chapter I" });
// Sultanate
x("fx_jal_drown", "ed3", "In the same year there was a scarcity of rain, there was dearth in Dehli, and grain rose to a jital per sir. In the Siwalik also the dearth was greatly felt. The Hindus of that country came into Dehli with their families, twenty or thirty of them together, and in the extremity of hunger drowned themselves in the Jumna.", v(3, "146", `${BARANI}: reign of Jalāl al-Dīn`));
x("fx_jal_help", "ed3", "The Sultan and nobles did all they could to help them. In the following year such rain fell as but few people could remember.", v(3, "146", `${BARANI}: reign of Jalāl al-Dīn`));
x("fx_ala_half", "ed3", "Half (of the produce) was to be paid without any diminution, and this rule was to apply to khutas and balahars, without the slightest distinction.", v(3, "182", `${BARANI}: ʿAlāʾ al-Dīn's revenue regulations`));
x("fx_ala_milk", "ed3", "The second related to buffaloes, goats, and other animals from which milk is obtained. A tax for pasturage, at a fixed rate, was to be levied, and was to be demanded for every inhabited house, so that no animal, however wretched, could escape the tax.", v(3, "182", `${BARANI}: ʿAlāʾ al-Dīn's revenue regulations`));
x("fx_ala_grind", "ed3", "rules and regulations for grinding down the Hindus, and for depriving them of that wealth and property which fosters disaffection and rebellion", v(3, "182", `${BARANI}: ʿAlāʾ al-Dīn's revenue regulations`));
x("fx_ala_nosilver", "ed3", "No Hindu could hold up his head, and in their houses no sign of gold or silver, tankas or jitals, or of any superfluity was to be seen.", v(3, "183", BARANI));
x("fx_ala_wives", "ed3", "Driven by destitution, the wives of the khuts and mukaddims went and served for hire in the houses of the Musulmans.", v(3, "183", BARANI));
x("fx_ala_granaries", "ed3", "all the Khalsa villages of the Doab should pay the tribute in kind. The corn was brought into the granaries of the city (of Dehli).", v(3, "193", `${BARANI}: market regulation III`));
x("fx_ala_stores", "ed3", "When there was a deficiency of rain, or when for any reason the caravans did not arrive, and grain became scarce in the markets, then the royal stores were opened and the corn was sold at the tariff price, according to the wants of the people.", v(3, "193", `${BARANI}: market regulation III`));
x("fx_ala_fields", "ed3", "they should so vigorously collect the tribute that the cultivators should be unable to carry away any corn from the fields into their houses and to regrate. They were to be compelled to sell their corn in the fields to the corn-carriers at a low price", v(3, "194", `${BARANI}: market regulation VI`));
x("fx_ala_rains", "ed3", "there were years in which the rains were deficient, but instead of the usual scarcity ensuing, there was no want of corn in Dehli, and there was no rise in the price either in the grain brought out of the royal granaries, or in that imported by the dealers.", v(3, "195", BARANI));
x("fx_mbt_cesses", "ed3", "The cesses were collected so rigorously that the raiyats were impoverished and reduced to beggary.", v(3, "238", `${BARANI}: Muḥammad bin Tughluq's first project`));
x("fx_mbt_jungles", "ed3", "through fear of the same evil befalling them, they threw off their allegiance and betook themselves to the jungles.", v(3, "238", BARANI));
x("fx_mbt_famine", "ed3", "The decline of cultivation, and the distress of the raiyats in the Doab, and the failure of convoys of corn from Hindustan, produced a fatal famine in Dehli and its environs, and throughout the Doab. Grain became dear. There was a deficiency of rain, so the famine became general. It continued for some years, and thousands upon thousands of people perished of want.", v(3, "238", BARANI));
x("fx_mbt_families", "ed3", "Communities were reduced to distress, and families were broken up.", v(3, "238", BARANI));
x("fx_mbt_loans", "ed3", "He stayed for some time in Dehli, making loans and encouraging cultivation; but the rain did not fall, and the raiyats did not apply themselves to work, so prices rose yet higher, and men and beasts died of starvation.", v(3, "246", BARANI));
x("fx_mbt_leave", "ed3", "so he allowed the people to pass the gates of the city and to remove with their families towards Hindustan", v(3, "246", BARANI));
x("fx_mbt_sargdwari", "ed3", "Grain was brought thither from Karra and Oudh, and, compared with the price at Dehli, it was cheap.", v(3, "246", `${BARANI}: the camp at Sargdwārī on the Ganges`));
x("fx_lee_poor", "lee", "until the famine should cease. My portion, as affixed by the Vizier, amounted to five hundred.", { label: "Chapter on Hindustan: a famine while Ibn Baṭṭūṭa was judge of Delhi" }, "The scan's OCR is poor here (it reads “sxistain^”, “tbis”); the quoted words are clean. The page number is not legible in the scan.");
x("fx_firuz_scarce", "ed3", "The Sultan, perceiving that there was a great scarcity of water, resolved in his munificence to bring a supply thither.", v(3, "300", `${AFIF}: the founding of Ḥiṣār Fīrūza`));
x("fx_firuz_rivers", "ed3", "one from the river Jumna, the other from the Sutlej.", v(3, "300", AFIF));
x("fx_firuz_harvest", "ed3", "Previous to this time there had been an autumn harvest, but the spring harvest failed, because wheat would not grow without water. After the canals had been dug, both harvests came to maturity.", v(3, "300", AFIF));
x("fx_firuz_plenty", "ed3", "During the whole forty years of his reign there was no appearance of scarcity", v(3, "344", `${AFIF}: the plenty and cheapness in the reign of Fīrūz Shāh`));
x("fx_firuz_waste", "ed3", "not one village remained waste, even in name, nor one span of land uncultivated.", v(3, "345", AFIF));
// War
x("fx_khusrau_rice", "ed3", "famine prevailed to such an extent, that a grain of rice was purchased for two grains of gold.", v(3, "75", "Amīr Khusrau, Khazāʾin al-Futūḥ, as abstracted by Elliot and Dowson: the siege of Ranthambhor"));
x("fx_timur_granaries", "ed3", "The hungry Tatars, making a general assault upon them like ants and locusts, plundered an enormous number of granaries", v(3, "414", "Malfūẓāt-i Tīmūrī: Tulamba"));
x("fx_after1398", "ed4", "After the departure of Timur, the neighbourhood of Dehli, and all those territories over which his armies had passed, were visited with pestilence", v(4, "36", "Yaḥyā bin Aḥmad Sirhindī, Tārīkh-i Mubārak Shāhī"));
x("fx_after1398_desolate", "ed4", "Many died of the sickness, and many perished with hunger, and for two months Dehli was desolate.", v(4, "36", "Yaḥyā bin Aḥmad Sirhindī, Tārīkh-i Mubārak Shāhī"));
x("fx_bad_siege", "ed5", "invested the fort for three months, and devastated the whole of the country in the neighbourhood", v(5, "490", "Badāyūnī, Muntakhab al-Tawārīkh: Hemu's siege of Bayana"));
x("fx_bad_famine", "ed5", "At this time a dreadful famine raged in the eastern provinces, especially in Agra, Bayana and Dehli", v(5, "490", "Badāyūnī, Muntakhab al-Tawārīkh"));
x("fx_bad_foods", "ed5", "The common people fed upon the seeds of the thorny acacia, upon dry herbage of the forest, and on the hides of the cattle which the wealthy slaughtered and sold.", v(5, "490", "Badāyūnī, Muntakhab al-Tawārīkh"));
x("fx_bad_doors", "ed5", "Many of the faithful closed their doors, and died by tens and twenties, and even in greater numbers, and found neither coffin nor grave. Hindus perished in the same numbers.", v(5, "490", "Badāyūnī, Muntakhab al-Tawārīkh"));
x("fx_bad_war", "ed5", "What with the scarcity of rain, the famine and the desolation, and what with uninterrupted warfare for two years,", v(5, "490", "Badāyūnī, Muntakhab al-Tawārīkh"));
x("fx_bad_desert", "ed5", "the whole country was a desert, and no husbandmen remained to till the ground.", v(5, "491", "Badāyūnī, Muntakhab al-Tawārīkh"));
x("fx_af_1556", "ed6", "If men could find money, they could not get sight of corn. Men were driven to the extremity of eating each other", v(6, "21", "Abu'l Faẓl, Akbarnāma: famine in the first year of Akbar's reign"));
// Vijayanagara
x("fx_paes_provided", "sewell", "This is the best provided city in the world, and is stocked with provisions such as rice, wheat, grains, Indian-corn, and a certain amount of barley and beans", { page: "257", label: "Narrative of Domingo Paes (c. 1520), tr. Sewell" });
x("fx_paes_cheap", "sewell", "which are the food of the people, and there is large store of these and very cheap", { page: "257", label: "Narrative of Domingo Paes" });
x("fx_paes_fail", "sewell", "that of other cities, which often fail of supplies and provisions, for in this one everything abounds", { page: "259", label: "Narrative of Domingo Paes" });
x("fx_paes_irrigate", "sewell", "these connect above with certain pipes by which they get water when they have to irrigate their gardens and rice-fields.", { page: "244", label: "Narrative of Domingo Paes: the tank at Nagalapur" });
x("fx_paes_tank", "sewell", "In the tank I saw so many people at work that there must have been fifteen or twenty thousand men, looking like ants", { page: "245", label: "Narrative of Domingo Paes" });
x("fx_nunes_free", "sewell", "he gave the people the lands which are irrigated by this water free for nine years, until they had made their improvements, so that the revenue already amounts to 20,000 pardaos.", { page: "365", label: "Chronicle of Fernão Nunes (c. 1535), tr. Sewell" });
x("fx_nunes_millet", "sewell", "Outside these two cities are fields and places richly cultivated with wheat and gram and rice and millet, for this last is the grain which is most consumed in the land", { page: "366", label: "Chronicle of Fernão Nunes" });
x("fx_nunes_tenths", "sewell", "They make it over to the husbandmen who pay nine-tenths to their lord; and they have no land of their own", { page: "379", label: "Chronicle of Fernão Nunes" });
x("fx_sew_famine", "sewell", "there was a grievous famine in the Dakhan", { page: "70", label: "Sewell, quoting Firishta" });
x("fx_sew_blockade", "sewell", "which resulted in his reducing the inhabitants to a state of starvation so that the Raya was compelled to capitulate", { page: "70" });
x("fx_sew_1475", "sewell", "About the year 1475 there was a terrible famine in the Dakhan and the country of the Telugus", { page: "100" });
x("fx_sew_federici", "sewell", "The Citie of Bezeneger is not altogether destroyed, yet the houses stand still, but emptie, and there is dwelling in them nothing, as is reported, but Tygres and other wild beasts.", { page: "208", label: "Cesare Federici (1567), quoted by Sewell" });
x("fx_sew_havoc", "sewell", "Never perhaps in the history of the world has such havoc been wrought, and wrought so suddenly, on so splendid a city", { page: "208" });
x("fx_sew_never", "sewell", "It never recovered, but remained for ever a scene of desolation and ruin.", { page: "208" });
x("fx_mor_methwold", "mor23", "parents have brought thousands of their young children to the seaside, selling there a child for 5 fanams of rice.", { page: "207", label: "Moreland, quoting William Methwold (on the East Coast until 1622)" });
// Mughal: ordinary years
x("fx_bab_rain", "babur", "Autumn crops grow by the downpour of the rains themselves; and strange it is that spring crops grow even when no rain falls.", { page: "486", label: "Description of Hindustan: irrigation" });
x("fx_bab_wheel", "babur", "To young trees water is made to flow by means of buckets or a wheel.", { page: "486", label: "Description of Hindustan: irrigation" });
x("fx_bab_wells", "babur", "towns and countries subsist on the water of wells or on such as collects in tanks during the rains.", { page: "487", label: "Description of Hindustan" });
x("fx_bab_flee", "babur", "hamlets and villages, towns indeed, are depopulated and set up in a moment! If the people of a large town, one inhabited for years even, flee from it, they do it in such a way that not a sign or trace of them remains in a day or a day and a half.", { page: "487", label: "Description of Hindustan" });
x("fx_bab_settle", "babur", "they need not dig water-courses or construct dams because their crops are all rain-grown", { page: "488", label: "Description of Hindustan" });
x("fx_bab_naked", "babur", "Peasants and people of low standing go about naked.", { page: "519", label: "Description of Hindustan: its defects" });
x("fx_bab_rains", "babur", "Sometimes it rains 10, 15 or 20 times a day; torrents pour down all at once and rivers flow where no water had been.", { page: "519", label: "Description of Hindustan: its advantages" });
x("fx_bab_workmen", "babur", "it has unnumbered and endless workmen of every kind.", { page: "520", label: "Description of Hindustan: its advantages" });
x("fx_m20_diet", "mor20", "the diet of the common people throughout India consisted essentially of the same articles as now — rice, millets, and pulses, with fish in Bengal and on the coasts, and meat in the south of the peninsula.", { page: "270", label: "Chapter VII, the standard of life" });
// Akbar
x("fx_zub_famine", "ed6", "a fearful famine raged continuously for three or four years.", v(6, "193", "Nūr al-Ḥaqq, Zubdat al-Tawārīkh: famine of AH 1004 (1595–96)"));
x("fx_zub_alms", "ed6", "The King ordered that alms should be distributed in all the cities", v(6, "193", "Nūr al-Ḥaqq, Zubdat al-Tawārīkh"));
x("fx_zub_tables", "ed6", "Public tables were spread, and the army was increased, in order to afford maintenance to the poor people.", v(6, "193", "Nūr al-Ḥaqq, Zubdat al-Tawārīkh"));
x("fx_zub_dead", "ed6", "A kind of plague also added to the horrors of this period, and depopulated whole houses and cities, to say nothing of hamlets and villages. In consequence of the dearth of grain and the necessities of ravenous hunger, men ate their own kind. The streets and roads were blocked up with dead bodies, and no assistance could be rendered for their removal.", v(6, "193", "Nūr al-Ḥaqq, Zubdat al-Tawārīkh"));
x("fx_m20_towns", "mor20", "Akbar endeavoured to relieve distress in this latter case, but the organisation in existence at the time was probably unable to do more than provide food for the starving in the towns and cities", { page: "128", label: "Chapter IV, agricultural production" });
x("fx_m20_sale", "mor20", "its commonest occurrence was in the sale of children by their famine-stricken parents, a course which may fairly be described as normal in Akbar's time and for two centuries after.", { page: "92", label: "Chapter III" });
x("fx_m20_roads", "mor20", "there is no trace of any systematic attempt to keep villages going through a period of calamity, or to restore them when the calamity had passed away", { page: "137", label: "Chapter IV" });
// 1630–32
x("fx_lah_norain", "ed7", "no rain had fallen in the territories of the Balaghat", v(7, "24", `${LAHORI}: famine in the Dakhin and Gujarat`));
x("fx_lah_extremity", "ed7", "The inhabitants of these two countries were reduced to the direst extremity.", v(7, "24", LAHORI));
x("fx_lah_loaf", "ed7", "was offered for a loaf, but none would buy; rank was to be sold for a cake, but none cared for it", v(7, "24", LAHORI));
x("fx_lah_dogs", "ed7", "For a long time dog's flesh was sold for goat's flesh, and the pounded bones of the dead were mixed with flour and sold. When this was discovered, the sellers were brought to justice.", v(7, "24", LAHORI));
x("fx_lah_wander", "ed7", "The numbers of the dying caused obstructions in the roads, and every man whose dire sufferings did not terminate in death and who retained the power to move wandered off to the towns and villages of other countries.", v(7, "24", LAHORI), "The scan reads “nu-mbers” and “suflerings”.");
x("fx_lah_langar", "ed7", "to establish soup kitchens, or alms-houses, such as are called langar in the language of Hindustan, for the benefit of the poor and destitute.", v(7, "25", LAHORI));
x("fx_lah_mondays", "ed7", "Thus, on twenty Mondays one lac of rupees was given away in charity.", v(7, "25", LAHORI));
x("fx_lah_remit", "ed7", "taxes amounting to nearly seventy lacs of rupees were remitted by the revenue officers", v(7, "25", LAHORI));
x("fx_lah_eleventh", "ed7", "amounting to one-eleventh part of the whole revenue.", v(7, "25", LAHORI));
x("fx_lah_siege", "ed7", "Provender had throughout been difficult to procure, and now no grass was to be found within twenty kos.", v(7, "24", `${LAHORI}: the siege of Parenda`));
x("fx_duff_1630", "duff", "During the season of 1629-30 no rain fell in the Deccan, and a famine, accompanied by pestilence, ensued", { volume: "1", page: "83" });
x("fx_twist_cattle", "mor23", "So little rain fell, says van Twist, that the seed sown was lost, and no grass grew. Cattle died.", { page: "212", label: "Moreland's translation of van Twist's account (1638)" });
x("fx_twist_sold", "mor23", "Men deserted their wives and children. Women sold themselves as slaves. Mothers sold their children. Children deserted by their parents sold themselves.", { page: "212", label: "Van Twist, tr. Moreland" });
x("fx_twist_river", "mor23", "Mothers and their children went to the river-bank, and drowned themselves hand in hand, so that the rivers flowed full of corpses.", { page: "212", label: "Van Twist, tr. Moreland" });
x("fx_twist_poor", "mor23", "This terrible divine punishment fell chiefly on the poor, who had nothing in store.", { page: "212", label: "Van Twist, tr. Moreland" });
x("fx_twist_hundred", "mor23", "Many hundred thousands of men died of hunger", { page: "212", label: "Van Twist, tr. Moreland" });
x("fx_mor_literal", "mor23", "This number is not to be taken literally, but rather as an idiomatic expression signifying that the mortality was incalculable.", { page: "212", label: "Moreland's footnote" });
x("fx_mun_children", "mundy", "yea, and to give them away to any that would take them, with manye thancks, that soe they might preserve them alive, although they were sure never to see them againe.", { page: "42", label: "Relation VI, near Surat, November 1630" });
x("fx_mun_dung", "mundy", "Noe lesse lamentable was it to see the poore people scrapeinge on the dunghills for food, yea in the very excrements of beasts, as horses, oxen, etts. belonginge to Travellers, for graine that perchaunce might come undisgested from them", { page: "44", label: "Relation VI, Nandurbar, 19 November 1630" });
x("fx_mun_bazaar", "mundy", "Heere in the midle of the Bazaree lay people new dead and others breathing their last with the food almost att their mouthes, yett dyed for want of it, they not haveinge wherewith to buy, nor the others so much pittie to spare them any without money", { page: "49", label: "Relation VI, Navi, 28 November 1630" });
x("fx_mun_rich", "mundy", "there being no course taken in this Country to remedie this great evill, the rich and stronge engrossinge and takeinge perforce all to themselves", { page: "49", label: "Relation VI" });
x("fx_mor_lashker", "mor23", "poor Gujarat was never the near[er], where there was most need, it being all sent to Burhanpur to supply the King’s lashker", { page: "214", label: "Moreland, quoting Peter Mundy" });
x("fx_mor_relief", "mor23", "Public kitchens were opened, taxes were remitted, and money was allocated for gratuitous relief, but the facts on record show that the effect of these measures was trifling", { page: "213" });
x("fx_mor_unjust", "mor23", "It would be unjust, therefore, to blame the Mogul administration for failure to avert a calamity which, in the circumstances of the time, must be regarded as inevitable; but it may be pointed out that the measures actually taken were not only inadequate but tardy", { page: "214" });
x("fx_mor_transport", "mor23", "The cost of transporting grain long distances by land was, as we have seen, prohibitive, and consequently a local shortage of food could not be met by importation", { page: "210" });
x("fx_mor_departed", "mor23", "departed into the parts of more hoped plenty, as are many thousands besides, as well weavers, washers, dyers, etc.", { page: "215", label: "Moreland, quoting an English letter from Surat, 1630" });
x("fx_mor_ser", "mor23", "with the help of a ser of corn delivered out to the weavers on every piece brought", { page: "215", label: "Moreland, quoting an English letter of 1631" });
x("fx_fos_garden", "foster", "the towne itselfe and all the countrey adjoyneing in a manner unpeopled. Soe that the tymes here are soe miserable that never in the memory of man any the like famine and mortallity hapened. This that was in a manner the garden of the world is nowe turned into a wildernes, haveinge fewe or noe men left to manure theire grownd nor to labour in any profession", { page: "178", label: "Letter from the fleet at Swally, 1631" });
x("fx_mun_ahmadabad", "mundy", "The Bazares and streets very large, faire and conformable, now halfe ruynated and dispeopled by the last famine.", { page: "266", label: "Relation XVI, Ahmadabad, April 1633" });
// Later Mughals
x("fx_ber_children", "bernier", "These poor people, when incapable of discharging the demands of their rapacious lords, are not only often deprived of the means of subsistence, but are bereft of their children, who are carried away as slaves.", { page: "205", label: "Letter to Colbert" });
x("fx_ber_flee", "bernier", "many of the peasantry, driven to despair by so execrable a tyranny, abandon the country, and seek a more tolerable mode of existence, either in the towns, or camps; as bearers of burdens, carriers of water, or servants to horsemen.", { page: "205", label: "Letter to Colbert" });
x("fx_ber_canals", "bernier", "no person is found willing and able to repair the ditches and canals for the conveyance of water", { page: "226", label: "Letter to Colbert" });
x("fx_ber_toil", "bernier", "Why should I toil for a tyrant who may come to-morrow and lay his rapacious hands upon all I possess and value", { page: "227", label: "Letter to Colbert" });
x("fx_ber_france", "bernier", "In France the laws are so reasonable, that the King is the first to obey them", { page: "235", label: "Letter to Colbert" });
// Deccan and the Marathas
x("fx_duff_durga", "duff", "In 1396, the dreadful famine, distinguished from all others by the name of the Doorga Dewee, commenced in Maharashtra. It lasted, according to Hindoo legends, for twelve years.", { volume: "1", page: "50" });
x("fx_duff_after", "duff", "whole districts were entirely depopulated, and a very scanty revenue was obtained from the territory between the Godavery and Kistna for upwards of thirty years afterwards.", { volume: "1", page: "50" });
x("fx_sab_shares", "sen", "after dividing the grains into five shares, three of the shares should be given to the Rayat; two shares should be taken for the government.", { page: "36", label: "Sabhāsad Bakhar: Shivaji's revenue settlement" }, "The scan reads “Ray at”.");
x("fx_sab_seed", "sen", "New Rayats, (who) will come (to settle), should be given cattle. Grain and money should be given (to them) for (providing themselves with) seeds.", { page: "36", label: "Sabhāsad Bakhar" });
x("fx_man_1702", "manucci", "In the Dakhin provinces there was no rain from 1702 to 1704, but instead plague prevailed. In these two years there expired over two millions of souls; fathers, compelled by hunger, offering to sell their children for a quarter to half a rupee, and yet forced to go without food, finding no one to buy them.", { volume: "4", page: "97" });
x("fx_man_war", "manucci", "It is now twenty-five years since Aurangzeb came in person to the Dakhin to begin this war", { volume: "4", page: "97" });
// How we know
x("fx_ed1_wretched", "ed1", "the common people must have been plunged into the lowest depths of wretchedness and despondency.", v(1, "xxi", "Sir H. M. Elliot's original preface"));
x("fx_ed1_advantages", "ed1", "They will make our native subjects more sensible of the immense advantages", v(1, "xxii", "Sir H. M. Elliot's original preface"));
x("fx_mor_food", "mor23", "The famines which we read of in the chronicles of the seventeenth century were not work-famines but food-famines in the strictest sense, times when it was not a question of obtaining the means to pay for food, but of getting food at all", { page: "205", label: "Chapter VII, the economic results of famine" });
x("fx_mor_incomplete", "mor23", "the record of food-famines in the published chronicles is incomplete, because we find several mentioned in the Dutch and English commercial correspondence of which no other account is known.", { page: "206" });

// ---------------------------------------------------------------- claims

type Role = "subject" | "place" | "participant" | "mention";
type Stance = "supports" | "contradicts" | "qualifies" | "mentions";
export interface ClaimSpec {
  ref: string;
  text: string;
  kind: "fact" | "interpretation" | "misconception" | "debate";
  assessment: "well_supported" | "supported" | "contested" | "weak" | "refuted";
  note?: string;
  when?: Record<string, unknown>;
  themes: string[];
  lenses?: string[];
  entities: [string, Role?][];
  cites: [string, Stance?, string?][];
}
export const CLAIMS: ClaimSpec[] = [];
const c = (spec: ClaimSpec) => CLAIMS.push(spec);
const PS = ["primary_source"];

// The raids
c({ ref: "fc_biruni", text: "Al-Bīrūnī, who came to India with Maḥmūd of Ghazna's court, wrote that Maḥmūd's raids utterly ruined the prosperity of the country, and that the scattered Hindus came to hate all Muslims.", kind: "fact", assessment: "supported", note: "A contemporary's judgement in a single sentence; it gives no detail of what the raids did to villages and fields.", when: { start: about(1030), basis: "Al-Bīrūnī's book on India, written about 1030" }, themes: ["war", "society"], lenses: PS, entities: [["biruni"], ["mahmud"], ["emi", "mention"]], cites: [["fx_biruni_ruin"], ["fx_biruni_aversion"]] });

// Ordinary years
c({ ref: "fc_rainfed", text: "Bābur noted that in Hindustan the autumn crops grew on the monsoon rains alone and the spring crops even without rain, while young trees and vegetables were watered by bucket or wheel.", kind: "fact", assessment: "supported", when: { start: ce(1526), end: ce(1530), basis: "Bābur's years in Hindustan" }, themes: ["economy", "infrastructure"], lenses: PS, entities: [["babur"], ["mughal", "mention"]], cites: [["fx_bab_rain"], ["fx_bab_wheel"], ["fx_bab_settle"]] });
c({ ref: "fc_wells", text: "Away from the great rivers, Bābur wrote, towns and countryside lived on the water of wells or on what collected in tanks during the rains.", kind: "fact", assessment: "supported", when: { start: ce(1526), end: ce(1530) }, themes: ["infrastructure", "society"], lenses: PS, entities: [["babur"]], cites: [["fx_bab_wells"], ["fx_bab_rains", "mentions", "When the rains came, they came all at once."]] });
c({ ref: "fc_workmen", text: "Bābur counted among Hindustan's advantages its endless workmen of every kind; he also saw peasants and the poor going about almost naked.", kind: "fact", assessment: "supported", note: "A conqueror's eye, often scornful of what he saw; his remarks are a first impression, not a survey.", when: { start: ce(1526), end: ce(1530) }, themes: ["society", "economy"], lenses: PS, entities: [["babur"]], cites: [["fx_bab_workmen"], ["fx_bab_naked"]] });
c({ ref: "fc_diet", text: "The common people ate rice, millets and pulses, with fish in Bengal and on the coasts and meat in the far south.", kind: "interpretation", assessment: "supported", note: "W. H. Moreland's summary (1920) of travellers' accounts and Akbar's revenue lists, for the years around 1600.", when: { start: about(1600) }, themes: ["society", "economy"], lenses: ["colonial_orientalist"], entities: [["moreland", "mention"], ["mughal", "mention"]], cites: [["fx_m20_diet"]] });
c({ ref: "fc_vij_food", text: "Domingo Paes, in Vijayanagara about 1520, called it the best provided city in the world, its markets full of rice, wheat, pulses and other grains, plentiful and very cheap.", kind: "fact", assessment: "supported", note: "A foreign visitor dazzled by the capital; the markets of a royal city tell us little about villages in a bad year.", when: { start: about(1520) }, themes: ["economy", "society"], lenses: PS, entities: [["paes"], ["vijayanagara", "mention"], ["hampi", "place"]], cites: [["fx_paes_provided"], ["fx_paes_cheap"], ["fx_paes_fail"]] });
c({ ref: "fc_millet", text: "Fernão Nunes wrote that the fields around Vijayanagara grew wheat, gram, rice and millet, and that millet was the grain most eaten.", kind: "fact", assessment: "supported", when: { start: about(1535) }, themes: ["economy", "society"], lenses: PS, entities: [["nunes"], ["vijayanagara", "mention"]], cites: [["fx_nunes_millet"]] });
c({ ref: "fc_ninetenths", text: "Nunes wrote that Vijayanagara's cultivators held no land of their own and paid nine-tenths of their produce to the lords who held it from the king.", kind: "interpretation", assessment: "supported", note: "Nunes's words, from a foreign visitor; no other source here confirms the share, and it may not describe the whole kingdom.", when: { start: about(1535) }, themes: ["economy", "governance"], lenses: PS, entities: [["nunes"], ["vijayanagara", "mention"]], cites: [["fx_nunes_tenths"]] });

// The Delhi sultans
c({ ref: "fc_1291", text: "In a year of failed rains under Jalāl al-Dīn Khaljī, grain at Delhi rose to a jital a sir, and Baranī says starving Hindu families from the Siwalik hills drowned themselves together in the Jumna.", kind: "fact", assessment: "supported", note: "Baranī, writing about seventy years later.", when: { start: ce(1290), end: ce(1296), basis: "Jalāl al-Dīn's reign; Baranī puts the drought in the year of Sīdī Maulā's execution" }, themes: ["society", "economy"], lenses: PS, entities: [["jalaluddin"], ["barani", "mention"]], cites: [["fx_jal_drown"]] });
c({ ref: "fc_1291_help", text: "Baranī says the sultan and nobles did all they could to help, and that the next year brought rains heavier than anyone could remember.", kind: "fact", assessment: "supported", when: { start: ce(1290), end: ce(1296) }, themes: ["governance"], lenses: PS, entities: [["jalaluddin"], ["barani", "mention"]], cites: [["fx_jal_help"]] });
c({ ref: "fc_ala_tax", text: "ʿAlāʾ al-Dīn Khaljī's revenue took half the produce of every field, from village headmen and the poorest alike, and taxed every milk animal; Baranī says the aim was to leave Hindus no wealth for rebellion.", kind: "fact", assessment: "supported", note: "Baranī approved of these rules and describes their purpose in his own words.", when: { start: ce(1296), end: ce(1316) }, themes: ["governance", "economy"], lenses: PS, entities: [["alauddin"], ["barani", "mention"], ["sultanate", "mention"]], cites: [["fx_ala_half"], ["fx_ala_milk"], ["fx_ala_grind"]] });
c({ ref: "fc_ala_wives", text: "Baranī boasts that under these rules no gold or silver was left in Hindu houses, and that the wives of village headmen went to work for hire in Muslim households.", kind: "interpretation", assessment: "supported", note: "A boast about a policy he admired, written decades later: evidence of what the court wanted, and perhaps of what happened.", when: { start: ce(1296), end: ce(1316) }, themes: ["society", "historiography"], lenses: PS, entities: [["barani"], ["alauddin", "mention"]], cites: [["fx_ala_nosilver"], ["fx_ala_wives"]] });
c({ ref: "fc_ala_stores", text: "ʿAlāʾ al-Dīn had the crown villages of the Doab pay their revenue in grain and kept royal granaries full at Delhi; when the rains failed, grain from them was sold at the fixed price.", kind: "fact", assessment: "supported", note: "From Baranī's account of the market regulations.", when: { start: ce(1296), end: ce(1316) }, themes: ["governance", "economy"], lenses: PS, entities: [["alauddin"], ["barani", "mention"]], cites: [["fx_ala_granaries"], ["fx_ala_stores"]] });
c({ ref: "fc_ala_rains", text: "Baranī says that in years when the rains failed under ʿAlāʾ al-Dīn there was no scarcity in Delhi and prices did not rise.", kind: "interpretation", assessment: "supported", note: "Baranī's claim, about the capital only; the countryside that fed it is not described.", when: { start: ce(1296), end: ce(1316) }, themes: ["economy", "historiography"], lenses: PS, entities: [["barani"], ["alauddin", "mention"]], cites: [["fx_ala_rains"]] });
c({ ref: "fc_ala_fields", text: "The cost fell on the cultivators of the Doab: revenue was collected so promptly that they had to sell their grain in the field, at a low price, to the grain carriers.", kind: "fact", assessment: "supported", when: { start: ce(1296), end: ce(1316) }, themes: ["economy", "society"], lenses: PS, entities: [["alauddin", "mention"]], cites: [["fx_ala_fields"]] });
c({ ref: "fc_mbt_tax", text: "Under Muḥammad bin Tughluq, Baranī writes, heavier taxes on the Doab ruined its cultivators, and people elsewhere, fearing the same, fled to the jungles.", kind: "fact", assessment: "supported", note: "Baranī was hostile to this sultan; Bernier, three centuries later, describes the same flight from heavy demands.", when: { start: ce(1325), end: ce(1351), basis: "Muḥammad bin Tughluq's reign; Baranī calls it his first project" }, themes: ["governance", "society"], lenses: PS, entities: [["mbt"], ["barani", "mention"]], cites: [["fx_mbt_cesses"], ["fx_mbt_jungles"]] });
c({ ref: "fc_mbt_famine", text: "Baranī says the ruin of cultivation, the failure of grain convoys and a lack of rain together brought a famine around Delhi and the Doab that lasted some years, in which thousands upon thousands died and families were broken up.", kind: "fact", assessment: "supported", note: "Baranī gives no year and no count; “thousands upon thousands” is his phrase. He blames the sultan's taxes first and the rain second.", when: { start: about(1334), end: about(1342), basis: "Not dated by Baranī; Ibn Baṭṭūṭa, at Delhi 1334–1342, also saw a famine there" }, themes: ["society", "economy"], lenses: PS, entities: [["mbt"], ["barani", "mention"], ["sultanate", "mention"]], cites: [["fx_mbt_famine"], ["fx_mbt_families"]] });
c({ ref: "fc_mbt_relief", text: "The sultan made loans to restart cultivation, but the rain did not come; he let Delhi's people leave for the east and camped on the Ganges, where grain from Kara and Awadh was cheaper.", kind: "fact", assessment: "supported", when: { start: about(1334), end: about(1342) }, themes: ["governance", "society"], lenses: PS, entities: [["mbt"], ["barani", "mention"]], cites: [["fx_mbt_loans"], ["fx_mbt_leave"], ["fx_mbt_sargdwari"]] });
c({ ref: "fc_ibn_poor", text: "Ibn Baṭṭūṭa, a judge at Delhi, writes that during a famine the poor were shared out among the nobles to be fed until it ended; his own share was five hundred people.", kind: "fact", assessment: "supported", note: "Lee's abridged translation (1829), from a poor scan; the quoted words are clean.", when: { start: ce(1334), end: ce(1342), basis: "Ibn Baṭṭūṭa's years at Delhi" }, themes: ["governance", "society"], lenses: PS, entities: [["ibnbattuta"], ["mbt", "mention"]], cites: [["fx_lee_poor"]] });
c({ ref: "fc_firuz_canals", text: "Fīrūz Shāh brought canals from the Jumna and the Sutlej to his new town of Ḥiṣār Fīrūza, where water was scarce; ʿAfīf says the spring wheat harvest had failed there before, and both harvests ripened after.", kind: "fact", assessment: "supported", note: "ʿAfīf wrote after the reign, in praise of Fīrūz; the canals themselves are not in doubt.", when: { start: ce(1351), end: ce(1388), basis: "Fīrūz Shāh's reign" }, themes: ["infrastructure", "economy"], lenses: PS, entities: [["firuz"], ["hisar", "place"]], cites: [["fx_firuz_scarce"], ["fx_firuz_rivers"], ["fx_firuz_harvest"]] });
c({ ref: "fc_firuz_plenty", text: "Fīrūz's historian ʿAfīf claims there was no scarcity in all forty years of his reign and that no village in the Doab lay waste.", kind: "interpretation", assessment: "supported", note: "Court praise written after the reign, not a record; it shows how a good reign was remembered.", when: { start: ce(1351), end: ce(1388) }, themes: ["historiography", "economy"], lenses: PS, entities: [["firuz"]], cites: [["fx_firuz_plenty"], ["fx_firuz_waste"]] });
c({ ref: "fc_durga", text: "Maratha tradition remembers a famine called Durgā Devī that began in 1396 and, by legend, lasted twelve years; Grant Duff says whole districts were left empty and the land between the Godavari and the Krishna yielded little revenue for thirty years after.", kind: "fact", assessment: "weak", note: "Known from later Maratha records as retold by Grant Duff (1826); the twelve years are legend, and no contemporary account is quoted here.", when: { start: ce(1396), basis: "Grant Duff's date" }, themes: ["society", "historiography"], lenses: ["colonial_orientalist"], entities: [["maratha", "mention"]], cites: [["fx_duff_durga"], ["fx_duff_after"]] });

// War and hunger
c({ ref: "fc_ranthambhor", text: "At the siege of Ranthambhor in 1301, Amīr Khusrau writes, food in the fort ran out until a grain of rice cost two grains of gold.", kind: "fact", assessment: "supported", note: "A court poet's image, in Elliot and Dowson's abstract; it records the hunger of a siege, not a price.", when: { start: ce(1301) }, themes: ["war"], lenses: PS, entities: [["alauddin", "mention"]], cites: [["fx_khusrau_rice"]] });
c({ ref: "fc_tulamba", text: "Tīmūr's memoir says that in 1398 his hungry soldiers plundered the granaries of Tulamba, in the Panjab, after the townspeople refused to give up their grain.", kind: "fact", assessment: "supported", note: "From the Malfūẓāt, presented as Tīmūr's own memoir; its authenticity is doubted.", when: { start: ce(1398) }, themes: ["war"], lenses: PS, entities: [["timur"]], cites: [["fx_timur_granaries"]] });
c({ ref: "fc_after1398", text: "After Tīmūr left, a chronicler of the next generation records pestilence and famine around Delhi and wherever his armies had passed; for two months Delhi was desolate.", kind: "fact", assessment: "supported", note: "Yaḥyā Sirhindī, writing about 1434.", when: { start: ce(1399), basis: "After Tīmūr's departure early in 1399" }, themes: ["war", "society"], lenses: PS, entities: [["timur", "mention"], ["sultanate", "mention"]], cites: [["fx_after1398"], ["fx_after1398_desolate"]] });
c({ ref: "fc_1555", text: "In 1555–56, while Afghan and Mughal armies fought over Agra and Delhi, famine struck; Badāyūnī saw the poor living on acacia seeds, wild herbs and the hides of slaughtered cattle, and many dying behind closed doors.", kind: "fact", assessment: "well_supported", note: "Badāyūnī was a boy and an eyewitness; Abu'l Faẓl also records the famine.", when: { start: ce(1555), end: ce(1556) }, themes: ["society", "war"], lenses: PS, entities: [["badauni"], ["akbar", "mention"], ["mughal", "mention"]], cites: [["fx_bad_famine"], ["fx_bad_foods"], ["fx_bad_doors"], ["fx_af_1556"]] });
c({ ref: "fc_1555_war", text: "Badāyūnī blamed drought and two years of unbroken war together: armies laid the country waste, and no cultivators were left to till it.", kind: "interpretation", assessment: "supported", when: { start: ce(1555), end: ce(1556) }, themes: ["war", "economy"], lenses: PS, entities: [["badauni"]], cites: [["fx_bad_war"], ["fx_bad_desert"], ["fx_bad_siege"]] });

// Vijayanagara
c({ ref: "fc_vij_tank", text: "Kṛṣṇadevarāya built a great tank near his capital about 1520 to water gardens and rice fields; Paes saw fifteen or twenty thousand people at work on it.", kind: "fact", assessment: "supported", when: { start: about(1520) }, themes: ["infrastructure", "economy"], lenses: PS, entities: [["krishnadeva"], ["paes", "mention"], ["nunes", "mention"]], cites: [["fx_paes_irrigate"], ["fx_paes_tank"], ["fx_nunes_free", "supports", "Nunes describes the same tank."]] });
c({ ref: "fc_vij_free", text: "Nunes says the king let people hold the land watered by the tank free of revenue for nine years, so that they would improve it.", kind: "fact", assessment: "supported", when: { start: about(1520) }, themes: ["governance", "economy"], lenses: PS, entities: [["krishnadeva"], ["nunes", "mention"]], cites: [["fx_nunes_free"]] });
c({ ref: "fc_1423", text: "Sewell, following the Deccan historian Firishta, records a grievous famine in the Deccan about 1422–24, while a Bahmani blockade starved Vijayanagara's people until their king gave in.", kind: "fact", assessment: "supported", note: "Sewell's dating of a story told by a Bahmani chronicler writing about 1600.", when: { start: ce(1422), end: ce(1424), basis: "Sewell's reckoning of AH 826–827" }, themes: ["war", "society"], lenses: ["colonial_orientalist"], entities: [["vijayanagara"]], cites: [["fx_sew_famine"], ["fx_sew_blockade"]] });
c({ ref: "fc_1475", text: "About 1475 a terrible famine struck the Deccan and the Telugu country.", kind: "fact", assessment: "supported", note: "Sewell, after Firishta.", when: { start: about(1475) }, themes: ["society"], lenses: ["colonial_orientalist"], entities: [["vijayanagara", "mention"]], cites: [["fx_sew_1475"]] });
c({ ref: "fc_sack", text: "After Vijayanagara's defeat at Talikota in 1565 its capital was sacked; the Italian Cesare Federici, there in 1567, found its houses standing empty, home to nothing but tigers and wild beasts.", kind: "fact", assessment: "supported", when: { start: ce(1565), end: ce(1567) }, themes: ["war", "society"], lenses: PS, entities: [["talikota"], ["hampi", "place"], ["vijayanagara", "mention"]], cites: [["fx_sew_federici"], ["fx_sew_havoc", "mentions"]] });
c({ ref: "fc_sack_sewell", text: "Robert Sewell (1900) wrote that never had such havoc been wrought so suddenly on so splendid a city, and that it never recovered.", kind: "interpretation", assessment: "supported", note: "A Victorian historian's lament for the city; the countryside around it went on being farmed.", when: { start: ce(1900) }, themes: ["historiography", "war"], lenses: ["colonial_orientalist"], entities: [["hampi"]], cites: [["fx_sew_havoc"], ["fx_sew_never"]] });
c({ ref: "fc_1618", text: "About 1618–19 famine struck the east coast of Vijayanagara's lands; the English merchant Methwold wrote that parents brought thousands of children to the seaside and sold them for a little rice.", kind: "fact", assessment: "supported", note: "Quoted by Moreland, who dates it by Dutch letters.", when: { start: ce(1618), end: ce(1619) }, themes: ["society"], lenses: PS, entities: [["vijayanagara", "mention"], ["moreland", "mention"]], cites: [["fx_mor_methwold"]] });

// Akbar
c({ ref: "fc_1595", text: "From 1595 the rains failed across Hindustan and famine lasted three or four years; plague followed, and the chronicler Nūr al-Ḥaqq writes that men ate one another and the dead lay unburied in the streets.", kind: "fact", assessment: "supported", when: { start: ce(1595), end: ce(1598), basis: "AH 1004 (1595–96) and the years after" }, themes: ["society"], lenses: PS, entities: [["akbar", "mention"], ["mughal", "mention"]], cites: [["fx_zub_famine"], ["fx_zub_dead"]] });
c({ ref: "fc_1595_relief", text: "Akbar ordered alms in every city and public kitchens, and took more men into the army so that the poor had a living.", kind: "fact", assessment: "supported", when: { start: ce(1595), end: ce(1598) }, themes: ["governance"], lenses: PS, entities: [["akbar"]], cites: [["fx_zub_alms"], ["fx_zub_tables"]] });
c({ ref: "fc_1595_towns", text: "Moreland judged that the relief of 1595–98 could do little more than feed the starving in towns and cities.", kind: "interpretation", assessment: "supported", when: { start: ce(1920) }, themes: ["governance", "historiography"], lenses: ["colonial_orientalist"], entities: [["moreland"], ["akbar", "mention"]], cites: [["fx_m20_towns"]] });
c({ ref: "fc_sale_normal", text: "Moreland found the sale of children by starving parents so common that he called it normal in Akbar's time and for two centuries after.", kind: "interpretation", assessment: "supported", when: { start: ce(1920) }, themes: ["society", "historiography"], lenses: ["colonial_orientalist"], entities: [["moreland"]], cites: [["fx_m20_sale"]] });
c({ ref: "fc_no_restore", text: "Moreland found no sign of any systematic effort to keep villages going through a famine, or to restore them afterwards.", kind: "interpretation", assessment: "supported", when: { start: ce(1920) }, themes: ["governance", "historiography"], lenses: ["colonial_orientalist"], entities: [["moreland"]], cites: [["fx_m20_roads"]] });

// 1630–32
c({ ref: "fc_1630_drought", text: "In 1630 the rains failed completely in Gujarat and the Deccan, after a poor year before; Shah Jahan's historian Lāhorī says the people were reduced to the direst extremity.", kind: "fact", assessment: "well_supported", when: { start: ce(1630), end: ce(1632) }, themes: ["society", "economy"], lenses: PS, entities: [["famine1630"], ["lahori", "mention"]], cites: [["fx_lah_norain"], ["fx_lah_extremity"], ["fx_twist_cattle"], ["fx_duff_1630"]] });
c({ ref: "fc_1630_loaf", text: "Lāhorī writes that a life was offered for a loaf and no one would buy, that dog's flesh was sold as goat's, and that ground bones of the dead were mixed into flour.", kind: "fact", assessment: "supported", note: "An official history in an ornate style; the Dutch and English accounts describe the same horrors in plain words.", when: { start: ce(1630), end: ce(1631) }, themes: ["society"], lenses: PS, entities: [["famine1630"], ["lahori"]], cites: [["fx_lah_loaf"], ["fx_lah_dogs"]] });
c({ ref: "fc_1630_wander", text: "Those who could still walk left for other lands, and the dying blocked the roads.", kind: "fact", assessment: "well_supported", when: { start: ce(1630), end: ce(1631) }, themes: ["society"], lenses: PS, entities: [["famine1630"]], cites: [["fx_lah_wander"], ["fx_mor_departed"]] });
c({ ref: "fc_1630_children", text: "Peter Mundy, travelling inland from Surat in November 1630, saw parents sell their children for a few pence, or give them away to anyone who would keep them alive.", kind: "fact", assessment: "well_supported", when: { start: ce(1630, 11) }, themes: ["society"], lenses: PS, entities: [["mundy"], ["famine1630"]], cites: [["fx_mun_children"], ["fx_twist_sold"]] });
c({ ref: "fc_1630_dung", text: "Mundy saw the poor search dunghills, even the dung of travellers' animals, for undigested grain.", kind: "fact", assessment: "supported", when: { start: ce(1630, 11) }, themes: ["society"], lenses: PS, entities: [["mundy"], ["famine1630"]], cites: [["fx_mun_dung"]] });
c({ ref: "fc_1630_drowned", text: "The Dutch merchant van Twist wrote that mothers and children drowned themselves together, and that the famine fell chiefly on the poor, who had nothing in store.", kind: "fact", assessment: "supported", note: "Van Twist's account (1638), in Moreland's translation.", when: { start: ce(1630), end: ce(1631) }, themes: ["society"], lenses: PS, entities: [["famine1630"], ["moreland", "mention"]], cites: [["fx_twist_river"], ["fx_twist_poor"]] });
c({ ref: "fc_1630_langar", text: "Shah Jahan had soup kitchens (langar) opened at Burhanpur, Ahmadabad and Surat, gave away 5,000 rupees every Monday while he stayed at Burhanpur, and sent 50,000 to Ahmadabad.", kind: "fact", assessment: "supported", note: "From his official history, which counts every gift.", when: { start: ce(1630), end: ce(1631) }, themes: ["governance"], lenses: PS, entities: [["shahjahan"], ["famine1630"], ["burhanpur", "place"], ["ahmadabad", "place"]], cites: [["fx_lah_langar"], ["fx_lah_mondays"]] });
c({ ref: "fc_1630_remit", text: "Revenue of about seventy lakhs of rupees, one-eleventh of the whole, was remitted.", kind: "fact", assessment: "supported", when: { start: ce(1630), end: ce(1631) }, themes: ["governance", "economy"], lenses: PS, entities: [["shahjahan"], ["famine1630"]], cites: [["fx_lah_remit"], ["fx_lah_eleventh"], ["fx_mor_relief", "supports", "“taxes were remitted”."]] });
c({ ref: "fc_1630_bazaar", text: "Mundy saw people dying in a market beside food they had no money to buy, and blamed the rich and strong, who took everything for themselves while nothing was done.", kind: "interpretation", assessment: "supported", when: { start: ce(1630, 11) }, themes: ["society", "economy"], lenses: PS, entities: [["mundy"], ["famine1630"]], cites: [["fx_mun_bazaar"], ["fx_mun_rich"]] });
c({ ref: "fc_1630_army", text: "Shah Jahan's armies were then at war in the Deccan, based at Burhanpur; Mundy noted that grain from the north went to feed the army rather than starving Gujarat, and even the besiegers of Parenda ran out of fodder.", kind: "fact", assessment: "supported", when: { start: ce(1630), end: ce(1631) }, themes: ["war", "economy"], lenses: PS, entities: [["shahjahan", "mention"], ["burhanpur", "place"], ["mundy", "mention"]], cites: [["fx_mor_lashker"], ["fx_lah_siege"]] });
c({ ref: "fc_1630_moreland", text: "Moreland (1923) judged the relief trifling and late, but the famine itself unavoidable, because grain could not be carried far enough by land.", kind: "interpretation", assessment: "contested", note: "One historian's verdict. Mundy, who was there, blamed hoarding by the rich and the army's demands.", when: { start: ce(1923) }, themes: ["governance", "historiography"], lenses: ["colonial_orientalist"], entities: [["moreland"], ["famine1630"]], cites: [["fx_mor_relief"], ["fx_mor_unjust"], ["fx_mor_transport"]] });
c({ ref: "fc_1630_toll", text: "No one counted the dead of 1630–32; van Twist's “many hundred thousands” meant, as Moreland notes, a toll beyond counting.", kind: "interpretation", assessment: "supported", when: { start: ce(1630), end: ce(1632) }, themes: ["society", "sources"], lenses: PS, entities: [["famine1630"], ["moreland", "mention"]], cites: [["fx_twist_hundred"], ["fx_mor_literal"]] });
c({ ref: "fc_1630_after", text: "Gujarat took years to recover: English merchants wrote in 1631 that “the garden of the world” had become a wilderness with few people left to farm or work, and in 1633 Mundy found Ahmadabad half ruined and emptied.", kind: "fact", assessment: "well_supported", when: { start: ce(1631), end: ce(1633) }, themes: ["society", "economy"], lenses: PS, entities: [["famine1630"], ["ahmadabad", "place"], ["mundy", "mention"]], cites: [["fx_fos_garden"], ["fx_mun_ahmadabad"]] });
c({ ref: "fc_1630_weavers", text: "Weavers, washers and dyers died or left for places with more food; once the rains returned, English merchants paid weavers partly in grain to bring cloth in.", kind: "fact", assessment: "supported", note: "From the English letters, as quoted by Moreland.", when: { start: ce(1630), end: ce(1631) }, themes: ["economy", "society"], lenses: PS, entities: [["famine1630"]], cites: [["fx_mor_departed"], ["fx_mor_ser"]] });

// Peasants under the later Mughals
c({ ref: "fc_bernier_flee", text: "François Bernier, in India 1656–68, wrote that peasants who could not pay lost their children to slavery, and that many fled to towns, army camps or the lands of Hindu rajas.", kind: "fact", assessment: "supported", when: { start: ce(1656), end: ce(1668) }, themes: ["society", "governance"], lenses: PS, entities: [["bernier"], ["mughal", "mention"]], cites: [["fx_ber_children"], ["fx_ber_flee"]] });
c({ ref: "fc_bernier_canals", text: "Bernier blamed governors who held land for short terms: no one would repair the canals and ditches, so the land went unwatered, and the peasant asked why he should toil for a tyrant.", kind: "interpretation", assessment: "supported", when: { start: ce(1656), end: ce(1668) }, themes: ["governance", "infrastructure"], lenses: PS, entities: [["bernier"]], cites: [["fx_ber_canals"], ["fx_ber_toil"]] });
c({ ref: "fc_bernier_bias", text: "Bernier wrote to Louis XIV's minister Colbert, arguing from India that a king who owns all the land ruins his country; his picture of the peasants serves that argument.", kind: "interpretation", assessment: "supported", when: { start: ce(1670), basis: "Bernier's letter to Colbert, written after his return" }, themes: ["historiography", "sources"], lenses: PS, entities: [["bernier"]], cites: [["fx_ber_france"], ["fx_ber_toil", "mentions"]] });
c({ ref: "fc_babur_flee", text: "Bābur noticed how quickly villages and even towns in Hindustan could be abandoned and set up again: people left without a trace, and a new village rose wherever there was water.", kind: "fact", assessment: "supported", when: { start: ce(1526), end: ce(1530) }, themes: ["society"], lenses: PS, entities: [["babur"]], cites: [["fx_bab_flee"], ["fx_bab_settle"]] });

// The Deccan and the Marathas
c({ ref: "fc_shivaji_rev", text: "Shivaji's chronicler Sabhāsad says his settlement took two of every five shares of the grain crop, and gave new settlers cattle, and grain and money for seed and food, to be repaid over two to four years.", kind: "fact", assessment: "supported", note: "Sabhāsad wrote in 1694 for Shivaji's son: it shows the ideal his court claimed, not how every village fared.", when: { start: ce(1674), end: ce(1680), basis: "Shivaji's reign as king" }, themes: ["governance", "economy"], lenses: PS, entities: [["shivaji"], ["maratha", "mention"]], cites: [["fx_sab_shares"], ["fx_sab_seed"]] });
c({ ref: "fc_1702", text: "Manucci writes that no rain fell in the Deccan from 1702 to 1704, plague followed, over two million died, and fathers offered their children for a quarter of a rupee and found no buyers.", kind: "fact", assessment: "supported", note: "Manucci was at Madras and reports at second hand; his “two millions” is a guess, not a count.", when: { start: ce(1702), end: ce(1704) }, themes: ["society"], lenses: PS, entities: [["manucci"], ["maratha", "mention"], ["mughal", "mention"]], cites: [["fx_man_1702"]] });
c({ ref: "fc_1702_war", text: "The famine fell in the third decade of Aurangzeb's war in the Deccan, which Manucci says had cost countless lives.", kind: "fact", assessment: "supported", when: { start: ce(1702), end: ce(1704) }, themes: ["war"], lenses: PS, entities: [["aurangzeb"], ["manucci", "mention"]], cites: [["fx_man_war"]] });

// How we know
c({ ref: "fc_elliot", text: "Henry Elliot, introducing the translations through which most English readers meet these chronicles, asserted that the common people under Muslim rule must have lived in the lowest depths of wretchedness, and hoped the extracts would make Indians grateful for British rule.", kind: "fact", assessment: "supported", note: "Elliot's own words. The extracts are real, but they were chosen to make this case.", when: { start: ce(1867), basis: "Printed as Elliot's original preface in vol. I (1867)" }, themes: ["historiography", "sources"], lenses: ["colonial_orientalist", "primary_source"], entities: [["sultanate", "mention"]], cites: [["fx_ed1_wretched"], ["fx_ed1_advantages"]] });
c({ ref: "fc_chroniclers", text: "Court chronicles judge famines by the ruler: Baranī blames Muḥammad bin Tughluq's taxes, ʿAfīf credits Fīrūz with forty years of plenty, and Lāhorī lists Shah Jahan's charity.", kind: "interpretation", assessment: "supported", themes: ["historiography", "sources"], lenses: PS, entities: [["barani", "mention"], ["lahori", "mention"]], cites: [["fx_mbt_famine", "supports", "Baranī puts the taxes first."], ["fx_firuz_plenty"], ["fx_lah_mondays"]] });
c({ ref: "fc_food_famine", text: "Moreland pointed out that the famines of the chronicles were famines of food, when grain could not be had at any price, unlike later famines in which people lacked the money to buy it.", kind: "interpretation", assessment: "supported", when: { start: ce(1923) }, themes: ["historiography", "economy"], lenses: ["colonial_orientalist"], entities: [["moreland"]], cites: [["fx_mor_food"], ["fx_mor_transport"]] });
c({ ref: "fc_records_gap", text: "The record is incomplete: Dutch and English merchants' letters mention famines that no Indian chronicle records.", kind: "interpretation", assessment: "supported", when: { start: ce(1923) }, themes: ["sources", "historiography"], lenses: ["colonial_orientalist"], entities: [["moreland"]], cites: [["fx_mor_incomplete"]] });

// Often said
c({ ref: "fm_no_famine", text: "Before British rule, India did not suffer great famines.", kind: "misconception", assessment: "refuted", note: "Chronicles, travellers and merchants record great famines around 1335–42, 1555–56, 1595–98, 1630–32 and 1702–04, among others.", themes: ["society", "historiography"], lenses: ["popular"], entities: [["mughal", "mention"], ["sultanate", "mention"]], cites: [["fx_lah_loaf", "contradicts"], ["fx_bad_foods", "contradicts"], ["fx_man_1702", "contradicts"]] });
c({ ref: "fm_no_relief", text: "Medieval and Mughal rulers did nothing for the starving.", kind: "misconception", assessment: "refuted", note: "Rulers kept grain stores, made loans, opened kitchens and remitted revenue; the sources also show that relief was small, late and mostly in towns.", themes: ["governance"], lenses: ["popular"], entities: [["mughal", "mention"], ["sultanate", "mention"]], cites: [["fx_lah_langar", "contradicts"], ["fx_ala_stores", "contradicts"], ["fx_mor_relief", "qualifies"]] });
c({ ref: "fm_counts", text: "The death tolls in the chronicles and travellers' accounts are counts.", kind: "misconception", assessment: "refuted", note: "No one counted. Figures like “two millions” or “many hundred thousands” are guesses, or ways of saying “beyond counting”.", themes: ["sources"], lenses: ["popular"], entities: [["famine1630", "mention"]], cites: [["fx_mor_literal", "contradicts"], ["fx_man_1702", "mentions"]] });

export interface RelationSpec { from: string; to: string; type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for"; note?: string }
export const RELATIONS: RelationSpec[] = [
  { from: "fc_1630_drought", to: "fm_no_famine", type: "corrects" },
  { from: "fc_1555", to: "fm_no_famine", type: "corrects" },
  { from: "fc_1702", to: "fm_no_famine", type: "corrects" },
  { from: "fc_1630_langar", to: "fm_no_relief", type: "corrects" },
  { from: "fc_ala_stores", to: "fm_no_relief", type: "corrects" },
  { from: "fc_1595_towns", to: "fm_no_relief", type: "qualifies", note: "Relief there was, but mostly in the towns." },
  { from: "fc_1630_toll", to: "fm_counts", type: "corrects" },
  { from: "fc_1630_bazaar", to: "fc_1630_moreland", type: "contradicts", note: "The witness blames hoarding; the historian, distance." },
  { from: "fc_1630_army", to: "fc_1630_moreland", type: "qualifies" },
  { from: "fc_mbt_tax", to: "fc_mbt_famine", type: "context_for" },
  { from: "fc_ala_fields", to: "fc_ala_rains", type: "qualifies", note: "Cheap grain in Delhi was paid for by the Doab's cultivators." },
  { from: "fc_bernier_bias", to: "fc_bernier_flee", type: "qualifies" },
  { from: "fc_elliot", to: "fc_chroniclers", type: "context_for" },
  { from: "fc_1555_war", to: "fc_1555", type: "context_for" },
];

/** The ops for sources (resolved), excerpts, claims, citations and relations. */
export function contentOps(snaps: Snaps, S: Record<Key, string>, E: Record<string, string>): ChangeOpInput[] {
  const ent = (r: string) => {
    const id = E[r];
    if (!id) throw new Error(`unknown entity ref ${r}`);
    return id;
  };
  const known = new Set(EXCERPTS.map((e) => e.ref));
  const ops: ChangeOpInput[] = [];
  for (const ex of EXCERPTS)
    ops.push({ op: "create_excerpt", ref: ex.ref, source: S[ex.src], snapshotId: snaps[ex.src].id, quote: ex.quote, locator: ex.locator, ...(ex.note ? { note: ex.note } : {}) } as ChangeOpInput);
  for (const cl of CLAIMS)
    ops.push({
      op: "create_claim",
      ref: cl.ref,
      text: cl.text,
      kind: cl.kind,
      assessment: cl.assessment,
      ...(cl.note ? { assessmentNote: cl.note } : {}),
      ...(cl.when ? { when: cl.when } : {}),
      themes: cl.themes,
      ...(cl.lenses ? { lenses: cl.lenses } : {}),
      entities: cl.entities.map(([r, role]) => ({ entity: ent(r), role: role ?? "subject" })),
    } as ChangeOpInput);
  for (const cl of CLAIMS)
    for (const [xr, stance, note] of cl.cites) {
      if (!known.has(xr)) throw new Error(`claim ${cl.ref} cites unknown excerpt ${xr}`);
      ops.push({ op: "cite", claim: `@${cl.ref}`, excerpt: `@${xr}`, stance: stance ?? "supports", ...(note ? { note } : {}) } as ChangeOpInput);
    }
  for (const r of RELATIONS) ops.push({ op: "relate_claims", from: `@${r.from}`, to: `@${r.to}`, type: r.type, ...(r.note ? { note: r.note } : {}) } as ChangeOpInput);
  return ops;
}

// ---------------------------------------------------------------- cells (shared with the cross-age page)

export const FACETS = [
  { key: "food", label: "Food", description: "What people ate in ordinary years" },
  { key: "water", label: "Water", description: "Rain, rivers, wells, tanks, canals" },
  { key: "work", label: "Work", description: "How people earned a living" },
  { key: "failure", label: "When the rains failed", description: "What went first, prices, what famine looked like" },
  { key: "coping", label: "Getting through", description: "What people did to survive" },
  { key: "rulers", label: "Rulers", description: "What rulers and the state did, or did not do" },
  { key: "toll", label: "The toll", description: "Deaths, disease, flight, what was destroyed" },
  { key: "after", label: "Afterwards", description: "How life changed; memory" },
] as const;
export type FacetKey = (typeof FACETS)[number]["key"];

export interface CellSpec {
  facet: FacetKey;
  age: keyof typeof AGES;
  /** Markdown; claim links are written [words](claim:@ref) with this file's claim refs. */
  text: string;
  excerpt?: string;
}
const L = (ref: string, words: string) => `[${words}](claim:@${ref})`;

export const CELLS: CellSpec[] = [
  // Early medieval: only the raids
  { facet: "toll", age: "emi", text: `Maḥmūd of Ghazna's raids, al-Bīrūnī wrote, ${L("fc_biruni", "utterly ruined the prosperity of the country")}.`, excerpt: "fx_biruni_ruin" },
  // Delhi Sultanate
  { facet: "water", age: "sultanate", text: `${L("fc_firuz_canals", "Fīrūz Shāh's canals from the Jumna and the Sutlej")} let a dry tract grow a spring wheat crop that had failed before.`, excerpt: "fx_firuz_harvest" },
  { facet: "work", age: "sultanate", text: `Cultivators paid ${L("fc_ala_tax", "half their crop")} under ʿAlāʾ al-Dīn and ${L("fc_ala_fields", "had to sell their grain in the field, cheap")}; Baranī boasts that ${L("fc_ala_wives", "headmen's wives went out to work for hire")}.`, excerpt: "fx_ala_wives" },
  { facet: "failure", age: "sultanate", text: `When the rains failed early in the Khaljī years, ${L("fc_1291", "grain at Delhi rose to a jital a sir and starving families drowned themselves in the Jumna")}; under Muḥammad bin Tughluq ${L("fc_mbt_famine", "taxes, failed convoys and drought brought years of famine")}.`, excerpt: "fx_jal_drown" },
  { facet: "coping", age: "sultanate", text: `Cultivators ${L("fc_mbt_tax", "fled to the jungles")} from tax collectors; in famine the sultan ${L("fc_mbt_relief", "let Delhi's people leave for the east, where grain was cheaper")}.`, excerpt: "fx_mbt_jungles" },
  { facet: "rulers", age: "sultanate", text: `ʿAlāʾ al-Dīn ${L("fc_ala_stores", "kept royal granaries at Delhi and sold from them when the rains failed")}; Muḥammad bin Tughluq ${L("fc_mbt_relief", "lent money to restart farming")}, and ${L("fc_ibn_poor", "nobles were each given hungry people to feed")}.`, excerpt: "fx_ala_stores" },
  { facet: "toll", age: "sultanate", text: `In the Tughluq famine ${L("fc_mbt_famine", "thousands upon thousands died and families were broken up")}; after Tīmūr's sack, ${L("fc_after1398", "pestilence and famine left Delhi desolate for two months")}.`, excerpt: "fx_after1398_desolate" },
  { facet: "after", age: "sultanate", text: `Fīrūz's reign was remembered at court as ${L("fc_firuz_plenty", "forty years without scarcity")}; in the Deccan, ${L("fc_durga", "Maratha tradition remembers the Durgā Devī famine of 1396")}, after which districts lay empty for decades.`, excerpt: "fx_duff_after" },
  // Vijayanagara
  { facet: "food", age: "vijayanagara", text: `${L("fc_millet", "Millet was the grain most eaten")}, with rice and pulses; Paes thought the capital ${L("fc_vij_food", "the best provided city in the world")}.`, excerpt: "fx_nunes_millet" },
  { facet: "water", age: "vijayanagara", text: `Tanks held the monsoon: ${L("fc_vij_tank", "Kṛṣṇadevarāya's great tank, built by thousands of workers")}, watered rice fields and gardens.`, excerpt: "fx_paes_tank" },
  { facet: "work", age: "vijayanagara", text: `Nunes says cultivators ${L("fc_ninetenths", "held no land of their own and paid nine-tenths of the crop")}, a foreigner's figure no other source here confirms.`, excerpt: "fx_nunes_tenths" },
  { facet: "failure", age: "vijayanagara", text: `${L("fc_1423", "A Deccan famine about 1422–24")} came with war and blockade; ${L("fc_1475", "another, about 1475, lasted two years")}.` },
  { facet: "coping", age: "vijayanagara", text: `In the famine of about 1618, ${L("fc_1618", "parents brought their children to the coast and sold them for rice")}.`, excerpt: "fx_mor_methwold" },
  { facet: "rulers", age: "vijayanagara", text: `The king ${L("fc_vij_free", "let people hold newly watered land free of revenue for nine years")}.`, excerpt: "fx_nunes_free" },
  { facet: "toll", age: "vijayanagara", text: `After Talikota in 1565 the capital was sacked; ${L("fc_sack", "two years later its houses stood empty, home to tigers")}.`, excerpt: "fx_sew_federici" },
  { facet: "after", age: "vijayanagara", text: `The city ${L("fc_sack_sewell", "never recovered")}, Robert Sewell wrote in 1900.`, excerpt: "fx_sew_never" },
  // Mughal Empire
  { facet: "food", age: "mughal", text: `${L("fc_diet", "Rice, millets and pulses")}, with fish on the coasts and meat in the far south.`, excerpt: "fx_m20_diet" },
  { facet: "water", age: "mughal", text: `${L("fc_rainfed", "Crops grew on the monsoon")}; away from rivers ${L("fc_wells", "people lived on wells and tanks")}.`, excerpt: "fx_bab_wells" },
  { facet: "work", age: "mughal", text: `Bābur saw ${L("fc_workmen", "endless workmen of every kind, and peasants almost naked")}; Bernier saw ${L("fc_bernier_flee", "peasants fleeing their governors' demands")}.`, excerpt: "fx_bab_workmen" },
  { facet: "failure", age: "mughal", text: `In 1630 ${L("fc_1630_drought", "no rain fell in Gujarat and the Deccan")}: ${L("fc_1630_loaf", "a life was offered for a loaf, and none would buy")}.`, excerpt: "fx_lah_loaf" },
  { facet: "coping", age: "mughal", text: `People ${L("fc_1555", "ate acacia seeds, wild herbs and hides")}, ${L("fc_1630_dung", "searched dung for grain")}, ${L("fc_1630_children", "sold or gave away their children")} and ${L("fc_1630_wander", "walked away to other lands")}.`, excerpt: "fx_mun_children" },
  { facet: "rulers", age: "mughal", text: `Akbar and Shah Jahan ${L("fc_1630_langar", "opened soup kitchens")}, ${L("fc_1630_remit", "remitted revenue")} and ${L("fc_1595_relief", "gave alms")}; a witness ${L("fc_1630_bazaar", "saw nothing done")}, and ${L("fc_1630_army", "grain went to the army")}.`, excerpt: "fx_lah_langar" },
  { facet: "toll", age: "mughal", text: `No one counted: ${L("fc_1630_toll", "“many hundred thousands” meant beyond counting")}; in 1595–98 ${L("fc_1595", "plague followed famine and the dead lay in the streets")}.`, excerpt: "fx_zub_dead" },
  { facet: "after", age: "mughal", text: `${L("fc_1630_after", "“The garden of the world” became a wilderness")}; ${L("fc_no_restore", "Moreland found no effort to restore the villages")}.`, excerpt: "fx_fos_garden" },
  // Marathas
  { facet: "failure", age: "maratha", text: `${L("fc_1702", "No rain fell in the Deccan from 1702 to 1704")}, in the ${L("fc_1702_war", "third decade of Aurangzeb's war against the Marathas")}.`, excerpt: "fx_man_war" },
  { facet: "coping", age: "maratha", text: `${L("fc_1702", "Fathers offered their children for a quarter of a rupee, and found no buyers")}.`, excerpt: "fx_man_1702" },
  { facet: "rulers", age: "maratha", text: `Shivaji's chronicler says ${L("fc_shivaji_rev", "the state took two shares in five and lent new settlers cattle, seed and food")}.`, excerpt: "fx_sab_seed" },
  { facet: "toll", age: "maratha", text: `Manucci heard of ${L("fc_1702", "over two million dead")} with plague: a guess, not a count.` },
];

// ---------------------------------------------------------------- page

/** The page's tracks block over this period's five ages, from resolved cells. */
export function spineBlock(cells: { facet: string; age: string; text: string; claimIds: string[]; excerptId?: string }[]): BlockInput {
  return {
    id: "spine",
    type: "tracks",
    title: "Drought and war, age by age",
    intro: "Read across a row to see one part of life change; read down a column to see one age whole. Each line links the claims it rests on; empty cells mean the sources here say nothing.",
    facets: FACETS.map((f) => ({ key: f.key, label: f.label, description: f.description })),
    ages: [
      { entity: AGES.emi, label: "Early medieval", target: "ch-raids" },
      { entity: AGES.sultanate, label: "Delhi Sultanate", target: "ch-sultanate" },
      { entity: AGES.vijayanagara, label: "Vijayanagara", target: "ch-vijayanagara" },
      { entity: AGES.mughal, label: "Mughal Empire", target: "ch-1630" },
      { entity: AGES.maratha, label: "Marathas", target: "ch-deccan" },
    ],
    cells,
  } as BlockInput;
}

export function famineMedievalPage(E: Record<string, string>): ChangeOpInput {
  const e = (r: string) => {
    const v = E[r];
    if (!v) throw new Error(`unknown entity ref ${r}`);
    return v;
  };
  const C = L;
  const N = (r: string, words: string) => `[${words}](entity:${e(r)})`;
  const ids = (...refs: string[]) => refs.map((r) => `@${r}`);

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown: [
        `Most people in medieval India grew their own food, and almost all of it depended on the monsoon. In a good year ${C("fc_rainfed", "the rains alone raised the autumn crop")}, and ${C("fc_diet", "people ate rice, millets and pulses")}. When the rains failed for a year or two, there was no way to bring enough grain from far away, and hunger came quickly.`,
        `This page follows ordinary people through those years, from Maḥmūd of Ghazna's raids to the Deccan famine of 1702–04: what they ate, how they earned, what they did when the rains failed or an army came, and what their rulers did. Wars and sieges mattered as much as weather: ${C("fc_1555_war", "a chronicler of 1556 blamed drought and two years of war together")}.`,
        `The voices are court historians, a Moroccan judge, a Mughal emperor, Portuguese visitors, English and Dutch merchants and a French doctor. Each saw from somewhere; the page says where.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("alauddin"), text: `${C("fc_ala_stores", "Kept royal granaries at Delhi")}, ${C("fc_ala_fields", "filled by the Doab's cultivators")}.`, target: "ch-sultanate", targetLabel: "Grain and the Delhi sultans" },
        { entity: e("mbt"), text: `${C("fc_mbt_famine", "Taxes and drought brought years of famine")} around Delhi.`, target: "ch-sultanate", targetLabel: "Grain and the Delhi sultans" },
        { entity: e("akbar"), text: `${C("fc_1595", "A famine of three or four years")}, 1595–98.`, target: "ch-akbar", targetLabel: "Akbar's famines" },
        { entity: e("shahjahan"), text: `${C("fc_1630_langar", "Soup kitchens")} in the famine of 1630–32.`, target: "ch-1630", targetLabel: "Gujarat and the Deccan, 1630–32" },
        { entity: e("famine1630"), text: `${C("fc_1630_loaf", "“Life was offered for a loaf, but none would buy”")}.`, target: "ch-1630", targetLabel: "Gujarat and the Deccan, 1630–32" },
      ],
    },
    spineBlock(
      CELLS.map((cell) => ({
        facet: cell.facet,
        age: AGES[cell.age],
        text: cell.text,
        claimIds: [...new Set([...cell.text.matchAll(/\(claim:@([a-z0-9_]+)\)/g)].map((m) => `@${m[1]}`))],
        ...(cell.excerpt ? { excerptId: `@${cell.excerpt}` } : {}),
      })),
    ),

    // ------------------------------------------------------------ 1
    {
      id: "ch-ordinary",
      type: "chapter",
      title: "In an ordinary year",
      promise: "Rain, wells and tanks; millet, rice and pulses; and the people who grew them.",
      people: [e("babur"), e("paes"), e("nunes")],
      brief: {
        happened: `${C("fc_rainfed", "Crops grew on the monsoon")}, ${C("fc_wells", "towns lived on wells and tanks")}, and ${C("fc_diet", "most people ate millets, rice and pulses")}.`,
        howWeKnow: "Bābur's memoirs (1526–30), two Portuguese visitors to Vijayanagara (c. 1520–35), and an economic historian's summary of travellers (1920). None was a peasant; all saw from outside.",
      },
    },
    {
      id: "ordinary-prose",
      type: "prose",
      markdown: [
        `When Bābur conquered north India in 1526 he described the country as a stranger would. ${C("fc_rainfed", "The autumn crops, he noticed, grew on the rains alone; only young trees and vegetables were watered, by bucket or by wheel")}. ${C("fc_wells", "Away from the rivers, towns and villages lived on wells and on tanks filled in the rains")}. He admired ${C("fc_workmen", "its endless workmen of every kind, and scorned peasants who went about almost naked")}.`,
        `In the south, the Portuguese visitor Domingo Paes called Vijayanagara ${C("fc_vij_food", "the best provided city in the world, its grain plentiful and cheap")}. His countryman Fernão Nunes noted that ${C("fc_millet", "millet was the grain most eaten")}, and that ${C("fc_ninetenths", "the cultivators held no land of their own and paid nine-tenths of the crop to their lords")}: a foreigner's figure, but a reminder of how little most growers kept.`,
        `Across India, ${C("fc_diet", "ordinary people ate rice, millets and pulses")}. That was the margin a failed monsoon cut into.`,
      ].join("\n\n"),
    },
    { id: "ordinary-claims", type: "claims", claimIds: ids("fc_rainfed", "fc_wells", "fc_workmen", "fc_diet", "fc_vij_food", "fc_millet", "fc_ninetenths") },
    { id: "ordinary-quote", type: "quote", excerptId: "@fx_bab_wells", caption: "Bābur, Bāburnāma, tr. A. S. Beveridge (1922), vol. II, p. 487." },

    // ------------------------------------------------------------ 2
    {
      id: "ch-raids",
      type: "chapter",
      title: "Raids from the north-west, about 1000–1030",
      promise: "What a scholar at the raider's own court said the raids did.",
      when: { start: about(1000), end: ce(1030), basis: "Maḥmūd of Ghazna's raids into India" },
      people: [e("mahmud"), e("biruni")],
      brief: {
        happened: `Maḥmūd of Ghazna raided north India again and again; ${C("fc_biruni", "al-Bīrūnī wrote that he utterly ruined its prosperity")}.`,
        howWeKnow: "Al-Bīrūnī's book on India (c. 1030), in Sachau's translation. He gives a verdict, not a description of villages; the chronicles of the raids celebrate plunder.",
      },
    },
    {
      id: "raids-prose",
      type: "prose",
      markdown: `The scholar al-Bīrūnī came to India with the court of the raider himself, and wrote about it with rare sympathy. In one sentence he judged the raids: ${C("fc_biruni", "Maḥmūd utterly ruined the prosperity of the country, and the scattered Hindus came to hate all Muslims")}. No source of the time tells us what the raids did to harvests and granaries; the earlier history of famine is told on the pages before this one.`,
    },
    { id: "raids-claims", type: "claims", claimIds: ids("fc_biruni") },
    { id: "raids-quote", type: "quote", excerptId: "@fx_biruni_ruin", caption: "Al-Bīrūnī, India (c. 1030), tr. E. C. Sachau (1888; reprint 1910), vol. I, p. 22." },

    // ------------------------------------------------------------ 3
    {
      id: "ch-sultanate",
      type: "chapter",
      title: "Grain and the Delhi sultans, 1290–1388",
      promise: "Granaries for the capital, taxes for the countryside, and two famines that the chronicler blamed on different things.",
      when: { start: ce(1290), end: ce(1388), basis: "From Jalāl al-Dīn Khaljī to the death of Fīrūz Shāh" },
      places: [e("hisar")],
      people: [e("jalaluddin"), e("alauddin"), e("mbt"), e("firuz"), e("barani"), e("ibnbattuta")],
      brief: {
        happened: `${C("fc_ala_stores", "ʿAlāʾ al-Dīn kept Delhi fed from royal granaries")}, ${C("fc_ala_fields", "at the cultivators' cost")}; under Muḥammad bin Tughluq ${C("fc_mbt_famine", "taxes and drought brought years of famine")}.`,
        howWeKnow: "Mostly Baranī (1357), who admired ʿAlāʾ al-Dīn and hated Muḥammad bin Tughluq, and ʿAfīf, who praised Fīrūz; Ibn Baṭṭūṭa, who served at Delhi, adds a little. All in old translations.",
      },
    },
    {
      id: "sultanate-prose",
      type: "prose",
      markdown: [
        `Early in the Khaljī years the rains failed. ${C("fc_1291", "Grain at Delhi rose to a jital a sir, and Baranī says starving families from the Siwalik hills drowned themselves together in the Jumna")}. ${C("fc_1291_help", "The sultan and nobles helped as they could, and the next year's rains were the heaviest anyone remembered")}.`,
        `ʿAlāʾ al-Dīn Khaljī (1296–1316) made sure the capital, and his army, would not go hungry. ${C("fc_ala_stores", "The crown villages of the Doab paid their revenue in grain, and royal granaries at Delhi sold it at the fixed price when the rains failed")}; ${C("fc_ala_rains", "Baranī says Delhi saw no scarcity even in years of drought")}. The cost fell on the countryside. ${C("fc_ala_tax", "Revenue took half the crop and taxed every milk animal")}, and ${C("fc_ala_fields", "cultivators had to sell their grain in the field, cheaply, to the carriers")}. Baranī, who approved, ${C("fc_ala_wives", "boasts that the wives of village headmen went out to work for hire")}.`,
        `Under Muḥammad bin Tughluq (1325–1351) things went the other way. ${C("fc_mbt_tax", "Heavier taxes ruined the Doab, and cultivators fled to the jungles")}. Then ${C("fc_mbt_famine", "the convoys of grain stopped, the rain failed, and a famine lasted some years: thousands upon thousands died, and families were broken up")}. ${C("fc_mbt_relief", "The sultan lent money to restart farming, but no rain came; he let Delhi's people leave for the east and moved his own camp to the Ganges, where grain was cheaper")}. ${C("fc_ibn_poor", "Ibn Baṭṭūṭa, then a judge, was given five hundred hungry people to feed")}.`,
        `Fīrūz Shāh (1351–1388) dug canals. ${C("fc_firuz_canals", "Water from the Jumna and the Sutlej reached his new town of Ḥiṣār Fīrūza, where the spring wheat crop had failed before")}. ${C("fc_firuz_plenty", "His historian claims forty years without scarcity")}, which is praise, not a record.`,
      ].join("\n\n"),
    },
    { id: "sultanate-claims", type: "claims", claimIds: ids("fc_1291", "fc_1291_help", "fc_ala_stores", "fc_ala_rains", "fc_ala_tax", "fc_ala_fields", "fc_ala_wives", "fc_mbt_tax", "fc_mbt_famine", "fc_mbt_relief", "fc_ibn_poor", "fc_firuz_canals", "fc_firuz_plenty") },
    { id: "sultanate-quote", type: "quote", excerptId: "@fx_mbt_famine", caption: "Ẓiyāʾ al-Dīn Baranī, Tārīkh-i Fīrūz Shāhī (1357), in Elliot and Dowson, vol. III (1871), p. 238." },
    {
      id: "sultanate-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Baranī tells the Khaljī and Tughluq famines to praise one sultan and blame another. When he says the rains failed and Delhi still ate, he is describing the capital; the cultivators who paid for it appear only as people to be kept poor.",
    },

    // ------------------------------------------------------------ 4
    {
      id: "ch-war",
      type: "chapter",
      title: "Sieges, armies and hunger",
      promise: "What war did to food: a starving fortress, plundered granaries, and a famine with no cultivators left.",
      when: { start: ce(1301), end: ce(1556), basis: "From the siege of Ranthambhor to the famine of 1555–56" },
      people: [e("timur"), e("badauni")],
      brief: {
        happened: `${C("fc_tulamba", "Armies took grain where they marched")}; ${C("fc_after1398", "after Tīmūr, pestilence and famine")}, and in 1555–56 ${C("fc_1555_war", "drought and two years of war left no cultivators")}.`,
        howWeKnow: "A court poet (Khusrau), the memoir ascribed to Tīmūr, a chronicler of the next generation, and Badāyūnī, who saw the famine of 1555–56 as a boy.",
      },
    },
    {
      id: "war-prose",
      type: "prose",
      markdown: [
        `Armies ate what the country grew. ${C("fc_ranthambhor", "In the siege of Ranthambhor in 1301, food in the fort ran out until a grain of rice cost two grains of gold")}. ${C("fc_tulamba", "Tīmūr's hungry soldiers plundered the granaries of Tulamba in 1398")}, and ${C("fc_after1398", "after he left, pestilence and famine followed wherever his armies had passed; for two months Delhi was desolate")}.`,
        `The worst was in 1555–56, as Afghan and Mughal armies fought over Agra and Delhi. ${C("fc_1555", "Badāyūnī saw the poor living on acacia seeds, wild herbs and the hides of slaughtered cattle, and many dying behind closed doors")}. ${C("fc_1555_war", "He blamed the drought and two years of war together: the country became a desert, with no cultivators left to till it")}.`,
      ].join("\n\n"),
    },
    { id: "war-claims", type: "claims", claimIds: ids("fc_ranthambhor", "fc_tulamba", "fc_after1398", "fc_1555", "fc_1555_war") },
    { id: "war-quote", type: "quote", excerptId: "@fx_bad_foods", caption: "ʿAbd al-Qādir Badāyūnī, Muntakhab al-Tawārīkh, on the famine of 1555–56, in Elliot and Dowson, vol. V (1873), p. 490." },

    // ------------------------------------------------------------ 5
    {
      id: "ch-vijayanagara",
      type: "chapter",
      title: "Vijayanagara: tanks, markets and a sack",
      promise: "A southern kingdom that stored the monsoon in tanks, and a capital emptied by war.",
      when: { start: ce(1336), end: ce(1619), basis: "From the founding of Vijayanagara to the famine of about 1618–19" },
      places: [e("hampi")],
      people: [e("krishnadeva"), e("paes"), e("nunes")],
      brief: {
        happened: `${C("fc_vij_tank", "Kings built great tanks for irrigation")}; ${C("fc_1423", "famine and war came together in the 1420s")}, and ${C("fc_sack", "the capital was sacked in 1565")}.`,
        howWeKnow: "Portuguese visitors, translated by Robert Sewell (1900), and Sewell's retelling of the Deccan historian Firishta.",
      },
    },
    {
      id: "vijayanagara-prose",
      type: "prose",
      markdown: [
        `In the dry south the monsoon was stored in tanks. ${C("fc_vij_tank", "Kṛṣṇadevarāya built a great one near his capital about 1520, and Paes saw fifteen or twenty thousand people at work on it")}. ${C("fc_vij_free", "To get the new land farmed, Nunes says, the king let people hold it free of revenue for nine years")}.`,
        `The kingdom also knew famine, often with war. ${C("fc_1423", "In the 1420s a famine in the Deccan coincided with a Bahmani blockade that starved Vijayanagara's people")}, and ${C("fc_1475", "about 1475 another famine struck the Deccan and the Telugu country")}. ${C("fc_sack", "After the defeat at Talikota in 1565 the capital was sacked; two years later its houses stood empty")}. ${C("fc_1618", "In a famine of about 1618, parents on the coast sold their children for a little rice")}.`,
      ].join("\n\n"),
    },
    { id: "vijayanagara-claims", type: "claims", claimIds: ids("fc_vij_tank", "fc_vij_free", "fc_1423", "fc_1475", "fc_sack", "fc_sack_sewell", "fc_1618") },
    { id: "vijayanagara-quote", type: "quote", excerptId: "@fx_sew_federici", caption: "Cesare Federici, who visited in 1567, in the English of Purchas, quoted by Robert Sewell, A Forgotten Empire (1900), p. 208." },

    // ------------------------------------------------------------ 6
    {
      id: "ch-akbar",
      type: "chapter",
      title: "Akbar's famines, 1555–56 and 1595–98",
      promise: "Alms and public kitchens in the cities, and what they could not reach.",
      when: { start: ce(1595), end: ce(1598), basis: "AH 1004 (1595–96) and the years after" },
      people: [e("akbar"), e("abulfazl"), e("badauni"), e("moreland")],
      brief: {
        happened: `${C("fc_1595", "From 1595 a famine lasted three or four years, followed by plague")}; ${C("fc_1595_relief", "Akbar ordered alms and public kitchens")}.`,
        howWeKnow: "Court chronicles in Elliot and Dowson, and W. H. Moreland's economic history (1920), which judges what the relief could reach.",
      },
    },
    {
      id: "akbar-prose",
      type: "prose",
      markdown: [
        `Akbar's reign began in famine (see the chapter on war) and was struck again in the 1590s. ${C("fc_1595", "From 1595 the rains failed across Hindustan for three or four years; plague followed, and the chronicler Nūr al-Ḥaqq writes that people ate one another and the dead lay in the streets")}.`,
        `${C("fc_1595_relief", "Akbar ordered alms in every city and public kitchens, and took more men into the army to give the poor a living")}. W. H. Moreland, a British revenue official turned historian, thought ${C("fc_1595_towns", "relief like this could do little more than feed the starving in towns")}; ${C("fc_no_restore", "he found no sign of any effort to keep villages going or to restore them afterwards")}, and ${C("fc_sale_normal", "he called the sale of children by starving parents normal for two centuries")}.`,
      ].join("\n\n"),
    },
    { id: "akbar-claims", type: "claims", claimIds: ids("fc_1595", "fc_1595_relief", "fc_1595_towns", "fc_no_restore", "fc_sale_normal") },
    { id: "akbar-quote", type: "quote", excerptId: "@fx_zub_dead", caption: "Nūr al-Ḥaqq, Zubdat al-Tawārīkh, on the famine of 1595–98, in Elliot and Dowson, vol. VI (1875), p. 193." },

    // ------------------------------------------------------------ 7
    {
      id: "ch-1630",
      type: "chapter",
      title: "Gujarat and the Deccan, 1630–32",
      promise: "The best-recorded famine of Mughal India, seen by the emperor's historian, an English traveller and a Dutch merchant.",
      when: { start: ce(1630), end: ce(1632), basis: "The rains failed in 1630; distress lasted into 1632" },
      places: [e("ahmadabad"), e("burhanpur")],
      people: [e("shahjahan"), e("lahori"), e("mundy"), e("moreland")],
      brief: {
        happened: `${C("fc_1630_drought", "No rain fell in Gujarat and the Deccan in 1630")}; ${C("fc_1630_children", "parents sold their children")}, ${C("fc_1630_langar", "the emperor opened soup kitchens")}, and ${C("fc_1630_after", "Gujarat was left a wilderness")}.`,
        howWeKnow: "Three kinds of witness who agree on the horror: Shah Jahan's official historian, the English traveller Peter Mundy and the company's letters, and the Dutch merchant van Twist (in Moreland's translation).",
      },
    },
    {
      id: "1630-prose",
      type: "prose",
      markdown: [
        `In 1630 ${C("fc_1630_drought", "the rains failed completely in Gujarat and the Deccan, after a poor year before")}. Shah Jahan's historian wrote, in the ornate style of the court, that ${C("fc_1630_loaf", "a life was offered for a loaf and no one would buy, that dog's flesh was sold as goat's, and ground bones were mixed into flour")}. ${C("fc_1630_wander", "Those who could still walk left; the dying blocked the roads")}.`,
        `Peter Mundy, an English merchant, walked into it in November 1630. ${C("fc_1630_children", "He saw parents sell their children, or give them away to anyone who would keep them alive")}, and ${C("fc_1630_dung", "the poor searching the dung of travellers' animals for grain")}. ${C("fc_1630_bazaar", "In one market he saw people dying beside food they could not pay for, and blamed the rich and strong, who took everything")}. The Dutch merchant van Twist wrote that ${C("fc_1630_drowned", "mothers and children drowned themselves together, and that the famine fell chiefly on the poor, who had nothing in store")}.`,
        `The emperor was at Burhanpur, at war in the Deccan. ${C("fc_1630_langar", "He had soup kitchens opened at Burhanpur, Ahmadabad and Surat, and gave money every Monday")}, and ${C("fc_1630_remit", "about one-eleventh of the revenue was remitted")}. But ${C("fc_1630_army", "grain coming from the north went to feed his army")}.`,
        `${C("fc_1630_toll", "No one counted the dead")}. ${C("fc_1630_weavers", "Weavers, washers and dyers died or left")}, and ${C("fc_1630_after", "English merchants wrote that “the garden of the world” had become a wilderness; in 1633 Ahmadabad was still half empty")}.`,
      ].join("\n\n"),
    },
    { id: "1630-claims", type: "claims", claimIds: ids("fc_1630_drought", "fc_1630_loaf", "fc_1630_wander", "fc_1630_children", "fc_1630_dung", "fc_1630_bazaar", "fc_1630_drowned", "fc_1630_langar", "fc_1630_remit", "fc_1630_army", "fc_1630_moreland", "fc_1630_toll", "fc_1630_weavers", "fc_1630_after") },
    { id: "1630-quote-lahori", type: "quote", excerptId: "@fx_lah_loaf", caption: "ʿAbd al-Ḥamīd Lāhorī, Bādshāhnāma, in Elliot and Dowson, vol. VII (1877), p. 24." },
    { id: "1630-quote-mundy", type: "quote", excerptId: "@fx_mun_bazaar", caption: "Peter Mundy, at Navi in Khandesh, 28 November 1630, in his Travels, ed. R. C. Temple, vol. II (1914), p. 49. His spelling." },
    {
      id: "1630-debate",
      type: "debate",
      question: "Weather or rulers: what turned the failed rains of 1630 into mass death?",
      positions: [
        { label: "The drought, and no way to carry grain far enough (Lāhorī; Moreland, 1923)", claimIds: ids("fc_1630_drought", "fc_1630_moreland") },
        { label: "Hoarding by the rich and the army's demands (Mundy, who was there)", claimIds: ids("fc_1630_bazaar", "fc_1630_army") },
      ],
      note: "Both can be true. The rains failed over a huge area, and grain moved by bullock; but who could buy, and who took what there was, decided who died. The same argument is made about the Tughluq famine, which Baranī blamed on taxes before rain.",
    },
    { id: "1630-quote-foster", type: "quote", excerptId: "@fx_fos_garden", caption: "Letter from the English fleet at Swally, near Surat, 1631, in W. Foster, The English Factories in India, 1630–1633 (1910), p. 178. Their spelling." },

    // ------------------------------------------------------------ 8
    {
      id: "ch-peasants",
      type: "chapter",
      title: "Flight: the peasant's way out",
      promise: "When rents or famine became too much, people left, and Mughal India was full of empty villages and new ones.",
      when: { start: ce(1526), end: ce(1668) },
      people: [e("babur"), e("bernier")],
      brief: {
        happened: `${C("fc_babur_flee", "Villages were abandoned and set up again quickly")}, and ${C("fc_bernier_flee", "peasants fled heavy demands to towns, camps or other kingdoms")}.`,
        howWeKnow: "Bābur's memoirs and Bernier's letter to Colbert, which argues a case about France.",
      },
    },
    {
      id: "peasants-prose",
      type: "prose",
      markdown: [
        `Leaving was the commonest way through a bad year. ${C("fc_babur_flee", "Bābur was struck by how quickly whole villages, even towns, could empty and be set up again wherever there was water")}. ${C("fc_mbt_tax", "In the 1330s cultivators fled the tax collectors to the jungles")}, and three centuries later ${C("fc_bernier_flee", "Bernier saw peasants lose their children to slavery for debt, and flee to towns, army camps or the lands of Hindu rajas")}.`,
        `${C("fc_bernier_canals", "Bernier blamed governors who held the land for a few years and squeezed it, so that no one repaired the canals")}. But ${C("fc_bernier_bias", "he was writing to Louis XIV's minister to argue that a king who owns all the land ruins his country")}, and his India was drawn to make that point.`,
      ].join("\n\n"),
    },
    { id: "peasants-claims", type: "claims", claimIds: ids("fc_babur_flee", "fc_bernier_flee", "fc_bernier_canals", "fc_bernier_bias") },

    // ------------------------------------------------------------ 9
    {
      id: "ch-deccan",
      type: "chapter",
      title: "The Deccan: Durgā Devī, Shivaji and Aurangzeb's war",
      promise: "A famine remembered in legend, a king's revenue rules, and a drought in the middle of a long war.",
      when: { start: ce(1396), end: ce(1707), basis: "From the Durgā Devī famine to Aurangzeb's death" },
      people: [e("shivaji"), e("aurangzeb"), e("manucci")],
      brief: {
        happened: `${C("fc_durga", "Maratha tradition remembers the Durgā Devī famine of 1396")}; ${C("fc_shivaji_rev", "Shivaji's chronicler describes help for new settlers")}; ${C("fc_1702", "no rain fell from 1702 to 1704")}, in ${C("fc_1702_war", "the middle of Aurangzeb's war")}.`,
        howWeKnow: "Grant Duff's history (1826) from Maratha records, Sabhāsad's chronicle of Shivaji (1694), and Manucci, writing at Madras about 1705.",
      },
    },
    {
      id: "deccan-prose",
      type: "prose",
      markdown: [
        `The Deccan plateau, dry and far from the great rivers, remembers its famines. ${C("fc_durga", "Maratha tradition tells of the Durgā Devī famine that began in 1396 and, by legend, lasted twelve years, leaving districts empty for decades")}. The legend is old, but no contemporary account of it is quoted here.`,
        `${C("fc_shivaji_rev", "Shivaji's chronicler says the king took two shares in five of the grain crop, and gave new settlers cattle, seed and food, to be repaid over a few years")}: a picture of the ideal his court wanted remembered.`,
        `Aurangzeb led the war in the Deccan in person for the last quarter-century of his life. ${C("fc_1702", "No rain fell in the Deccan from 1702 to 1704; plague followed, and fathers offered their children for a quarter of a rupee and found no buyers")}. ${C("fc_1702_war", "This was the third decade of a war that had already cost countless lives")}.`,
      ].join("\n\n"),
    },
    { id: "deccan-claims", type: "claims", claimIds: ids("fc_durga", "fc_shivaji_rev", "fc_1702", "fc_1702_war") },
    { id: "deccan-quote", type: "quote", excerptId: "@fx_man_1702", caption: "Niccolao Manucci, Storia do Mogor, tr. W. Irvine, vol. IV (1908), p. 97." },

    // ------------------------------------------------------------ 10
    {
      id: "ch-sources",
      type: "chapter",
      title: "How we know, and who is speaking",
      promise: "Court historians, a colonial translator, foreign merchants: each saw famine from somewhere.",
      phase: "later",
      people: [e("barani"), e("lahori"), e("moreland")],
      brief: {
        happened: `${C("fc_chroniclers", "Chroniclers judged famines by the ruler")}; ${C("fc_elliot", "the standard translations were chosen to show Muslim misrule")}; ${C("fc_records_gap", "merchants' letters record famines the chronicles do not")}.`,
        howWeKnow: "Elliot's own preface (1867), and Moreland's study of the Dutch and English records (1923).",
      },
    },
    {
      id: "sources-prose",
      type: "prose",
      markdown: [
        `Almost every voice on this page belongs to someone who did not go hungry. ${C("fc_chroniclers", "Court historians judged a famine by its ruler: Baranī blames Muḥammad bin Tughluq's taxes, ʿAfīf credits Fīrūz with forty years of plenty, Lāhorī lists Shah Jahan's gifts")}.`,
        `Most English readers meet these chronicles in Elliot and Dowson's translations. ${C("fc_elliot", "Elliot asserted that the common people under Muslim rule must have lived in the lowest depths of wretchedness, and hoped the extracts would make Indians grateful for British rule")}. The famines in them are real; the selection had a purpose. The pages on British India show how British rule handled famine in its turn.`,
        `The foreign merchants were interested in cloth and prices, which makes their letters plain and close to events. ${C("fc_records_gap", "They record famines that no chronicle mentions")}. And as Moreland noted, ${C("fc_food_famine", "these were famines of food: grain could not be had at any price")}, because it could not be carried far enough by land.`,
      ].join("\n\n"),
    },
    { id: "sources-claims", type: "claims", claimIds: ids("fc_chroniclers", "fc_elliot", "fc_records_gap", "fc_food_famine") },
    { id: "sources-quote", type: "quote", excerptId: "@fx_ed1_wretched", caption: "Sir Henry Elliot, original preface, in Elliot and Dowson, vol. I (1867), p. xxi." },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Three common beliefs about famine before British rule.",
      phase: "later",
      brief: {
        happened: `Three beliefs, each checked: ${C("fm_no_famine", "no great famines before the British")}, ${C("fm_no_relief", "rulers did nothing")}, and ${C("fm_counts", "the death tolls are counts")}.`,
        howWeKnow: "The sources on this page.",
      },
    },
    { id: "often-prose", type: "prose", markdown: "Famine before 1757 is often remembered in slogans, from both sides. Here are three, with what the sources on this page say." },
    { id: "myth-no-famine", type: "misconception", theme: "society", claimId: "@fm_no_famine", correctionIds: ids("fc_1630_drought", "fc_1555", "fc_1702") },
    { id: "myth-no-relief", type: "misconception", theme: "governance", claimId: "@fm_no_relief", correctionIds: ids("fc_1630_langar", "fc_ala_stores", "fc_1595_towns") },
    { id: "myth-counts", type: "misconception", theme: "sources", claimId: "@fm_counts", correctionIds: ids("fc_1630_toll") },
  ];

  return {
    op: "create_page",
    slug: PAGE_SLUG,
    title: TITLE,
    kind: "theme",
    summary: "Drought, war and hunger from Maḥmūd of Ghazna's raids to the Deccan famine of 1702–04: what ordinary people ate and earned, what they did when the rains failed or an army came, what their rulers did, and who told us.",
    blocks,
    status: "published",
  } as ChangeOpInput;
}
