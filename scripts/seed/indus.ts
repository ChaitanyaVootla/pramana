import type { BlockInput, ChangeOpInput, PageSpecInput } from "@pramana/core";
import { toAstronomicalYear } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "The Indus civilisation" era page (c. 3300–1300 BCE; mature phase c.
 * 2600–1900 BCE). There are no deciphered texts, so the evidence is
 * archaeology and what was said about it: the first excavation reports
 * (ASI Annual Reports 1923–26 and 1928–29), Masson (1842), Cunningham (1875),
 * Marshall's Illustrated London News announcement (1924), Mesopotamian
 * inscriptions naming Meluhha (Barton 1929), Griffith's Rigveda (1897) and
 * Oldham (1893) for the Sarasvatī question, Wheeler (1947) for the invasion
 * thesis, and modern work that can be read openly (Dales 1964, Giosan et al.
 * 2012, Singh et al. 2017, Chatterjee et al. 2019, Rao et al. 2009, Farmer,
 * Sproat and Witzel 2004, Shinde et al. 2019, Green 2021), quoted briefly when
 * copyrighted. Wikipedia (pinned revisions) is tertiary and is used for a few
 * dates, Meluhha's identification, the Lothal "dock" and the Pashupati seal.
 *
 * Not used, for copyright: Marshall (ed.) 1931 (US copyright until
 * 2027-01-01), Mackay 1938, Vats 1940.
 *
 * Coordinates come from Wikidata only, and only for sites.
 */

const bce = (year: number, approximate = true) => ({ year, era: "BCE" as const, ...(approximate ? { approximate } : {}) });
const ce = (year: number) => ({ year, era: "CE" as const });

// ---------------------------------------------------------------- snapshots

/**
 * Farmer, Sproat and Witzel (2004) is a PDF behind a bot wall at the journal;
 * the authors' own copy is a PDF too, which the capture tool cannot read. The
 * abstract and first paragraph are pasted here as extracted (pdftotext 25.x,
 * no edits) from http://www.safarmer.com/fsw2.pdf, sha256
 * 75934ffcc544583270ba990b38017a008c85dac677945cc00c12991a8193f4fc, fetched 2026-10-17.
 */
const FSW_TEXT = `The Collapse of the Indus-Script Thesis:
The Myth of a Literate Harappan Civilization
Steve Farmer, Richard Sproat, and Michael Witzel1

Abstract
Archaeologists have long claimed the Indus Valley as one of the four literate centers of the early
ancient world, complete with long texts written on perishable materials. We demonstrate the
impossibility of the lost-manuscript thesis and show that Indus symbols were not even evolving in
linguistic directions after at least 600 years of use. Suggestions as to how Indus symbols were used are
noted in nonlinguistic symbol systems in the Near East that served key religious, political, and social
functions without encoding speech or serving as formal memory aids. Evidence is reviewed that the
Harappans’ lack of a true script may have been tied to the role played by their symbols in controlling
large multilinguistic populations; parallels are drawn to the later resistance of Brahmin elites to the
literate encoding of Vedic sources and to similar phenomena in esoteric traditions outside South Asia.
Discussion is provided on some of the political and academic forces that helped sustain the Indusscript myth for over 130 years and on ways in which our findings transform current views of the Indus
Valley and of literacy in the ancient world in general.

Background of the Indus-script thesis
Ever since the first Harappan seal was discovered in 1872-3, it has been nearly universally
assumed that Indus inscriptions were tightly bound to language, the grounds of every major
decipherment effort (Possehl 1996) and a requirement of writing according to most linguists who
specialize in scripts (DeFrancis 1989; Daniels and Bright 1996; Sproat 2000).2 Extensive efforts
have been spent over the past 130 years in attempts to identify the supposed language (or
languages) underlying the inscriptions, which are often said to hold the key to understanding
India’s earliest civilization (fl. c. 2600 - 1900 BCE). A partial list of the scripts or languages that
have been tied to the inscriptions include Brahmi (ancestor of most modern South Asian scripts),
the Chinese Lolo (or Yi) script, Sumerian, Egyptian, proto-Elamite, Altaic, Hittite, protoDravidian, early Indo-Aryan (or even Vedic Sanskrit), proto-Munda, Old Slavic, Easter Island
rongorongo, or some lost language or putative Indus lingua franca. Starting in 1877, over a
hundred claimed decipherments have made it to print; thorough debunkings of past efforts have
`;
const FSW_URL = "http://www.safarmer.com/fsw2.pdf";

export const CAPTURES = {
  masson: { kind: "internet_archive", identifier: "10430709bsb" },
  cunningham: { kind: "internet_archive", identifier: "india.history.resource.86136" },
  asi2324: { kind: "internet_archive", identifier: "in.ernet.dli.2015.35513" },
  asi2425: { kind: "internet_archive", identifier: "annualreportofth030750mbp" },
  /** A second scan of the 1924–25 report, used where its OCR is cleaner. */
  asi2425b: { kind: "internet_archive", identifier: "in.ernet.dli.2015.35514" },
  asi2526: { kind: "internet_archive", identifier: "dli.ministry.09389" },
  asi2829: { kind: "internet_archive", identifier: "in.ernet.dli.2015.35504" },
  iln: { kind: "internet_archive", identifier: "sim_illustrated-london-news_1924-09-20_165_4456" },
  barton: { kind: "internet_archive", identifier: "royalinscription00bart" },
  griffith: { kind: "internet_archive", identifier: "in.ernet.dli.2015.104119" },
  oldham: { kind: "internet_archive", identifier: "in.ernet.dli.2015.70546" },
  wheeler: { kind: "internet_archive", identifier: "dli.ministry.09208" },
  dales: { kind: "url", url: "https://www.penn.museum/sites/expedition/the-mythical-massacre-at-mohenjo-daro/" },
  giosan: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3387054/" },
  singh: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5705636/" },
  chatterjee: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6868222/" },
  rao: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC2721819/" },
  shinde: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6800651/" },
  green: { kind: "url", url: "https://link.springer.com/article/10.1007/s10814-020-09147-9" },
  unescoDho: { kind: "url", url: "https://whc.unesco.org/en/list/1645/" },
  unescoMjd: { kind: "url", url: "https://whc.unesco.org/en/list/138/" },
  harappacom: { kind: "url", url: "https://www.harappa.com/har/indus-saraswati.html" },
  fsw: {
    kind: "text",
    title: "Farmer, Sproat and Witzel 2004, pp. 19–20 (abstract and first paragraph)",
    note: `Pasted text extracted with pdftotext, unedited, from the authors' PDF ${FSW_URL} (sha256 75934ffcc544583270ba990b38017a008c85dac677945cc00c12991a8193f4fc), fetched 2026-10-17. The journal's own copy (Electronic Journal of Vedic Studies 11-2, 2004, pp. 19–57) is behind a bot check.`,
    text: FSW_TEXT,
  },
  wpIvc: { kind: "wikipedia", title: "Indus Valley Civilisation" },
  wpMeluhha: { kind: "wikipedia", title: "Meluhha" },
  wpPyramid: { kind: "wikipedia", title: "Great Pyramid of Giza" },
  wpLothal: { kind: "wikipedia", title: "Lothal" },
  wpPashupati: { kind: "wikipedia", title: "Pashupati seal" },
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
  label: string | null;
  aliases: { label: string; lang?: string; script?: string; note?: string }[];
  when: { edtf: string; basis?: string } | null;
  coordinates: { lat: number; lon: number } | null;
}
interface WdMatch {
  status: "existing" | "pending";
  id: string;
  slug: string | null;
  changesetId?: string;
}

type Kind = "person" | "place" | "site" | "polity" | "period" | "artifact" | "concept" | "term";
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  /** Overrides Wikidata's date (with the reason in basis). */
  when?: Record<string, unknown>;
  /** Use Wikidata's date as given (non-people). */
  wdWhen?: boolean;
  /** Use Wikidata P569/P570 as a life span (people). */
  life?: boolean;
  /** Use Wikidata coordinates (sites only). */
  geo?: boolean;
  aliases?: { label: string; lang?: string; script?: string; note?: string }[];
  /** Drop Wikidata aliases matching this (non-neutral or wrong). */
  dropAliases?: RegExp;
  /** A link from this entity, so the page's timeline and map pick it up. */
  link?: { to: string; type: "part_of" | "located_in" | "related_to" | "contemporary_of"; note?: string };
}

/** The page's subject: the culture entity created by the spine (Q42534). */
const CULTURE = "harappan-civilisation";

export const ENTITIES: EntitySpec[] = [
  // Sites (coordinates: Wikidata, a single point for the whole site)
  { ref: "harappa", slug: "harappa", kind: "site", label: "Harappa", qid: "Q185562", geo: true, link: { to: CULTURE, type: "part_of" }, description: "The ruin mounds in Punjab, Pakistan, that gave the civilisation its other name; excavated from 1920–21." },
  { ref: "mohenjodaro", slug: "mohenjo-daro", kind: "site", label: "Mohenjo-daro", qid: "Q5725", geo: true, link: { to: CULTURE, type: "part_of" }, description: "The largest excavated city of the civilisation, in Sindh, Pakistan; excavated from 1921–22. A World Heritage Site.", aliases: [{ label: "Moenjodaro", lang: "en", note: "UNESCO's spelling" }, { label: "Mound of the Dead", lang: "en", note: "A common translation of the Sindhi name" }] },
  { ref: "dholavira", slug: "dholavira", kind: "site", label: "Dholavira", qid: "Q9468", geo: true, link: { to: CULTURE, type: "part_of" }, description: "A walled city on the island of Khadir in Kachchh, Gujarat, built largely of stone; a World Heritage Site since 2021." },
  { ref: "lothal", slug: "lothal", kind: "site", label: "Lothal", qid: "Q9443", geo: true, link: { to: CULTURE, type: "part_of" }, description: "A small town in Gujarat with a large brick basin that its excavators called a dock; others read it as a tank." },
  { ref: "kalibangan", slug: "kalibangan", kind: "site", label: "Kalibangan", qid: "Q1722226", geo: true, link: { to: CULTURE, type: "part_of" }, description: "A town on the dry Ghaggar river in Rajasthan, India." },
  { ref: "rakhigarhi", slug: "rakhigarhi", kind: "site", label: "Rakhigarhi", qid: "Q3418050", geo: true, link: { to: CULTURE, type: "part_of" }, description: "One of the largest sites of the civilisation, in Haryana, India; the source of the first ancient genome from an Indus city." },
  { ref: "chanhudaro", slug: "chanhudaro", kind: "site", label: "Chanhudaro", qid: "Q1062208", geo: true, link: { to: CULTURE, type: "part_of" }, description: "A smaller craft town in Sindh, Pakistan, south of Mohenjo-daro.", aliases: [{ label: "Chanhu-daro", lang: "en" }] },
  { ref: "ganweriwala", slug: "ganweriwala", kind: "site", label: "Ganweriwala", qid: "Q3095220", geo: true, link: { to: CULTURE, type: "part_of" }, description: "A large, little-excavated site in the Cholistan desert, Punjab, Pakistan.", aliases: [{ label: "Ganeriwala", lang: "en" }] },
  { ref: "greatbath", slug: "great-bath-mohenjo-daro", kind: "site", label: "Great Bath, Mohenjo-daro", qid: "Q3346415", geo: true, link: { to: "@mohenjodaro", type: "located_in" }, description: "A brick-lined tank in a large building at Mohenjo-daro, excavated in 1925–26. What it was for is not known." },
  // Objects (Wikidata's coordinates for these are the museum's, so none are used)
  { ref: "priestking", slug: "priest-king-statue", kind: "artifact", label: "“Priest-King” statue", qid: "Q60847016", link: { to: "@mohenjodaro", type: "related_to", note: "Found at Mohenjo-daro; now in the National Museum of Pakistan, Karachi." }, description: "A small stone bust of a bearded man from Mohenjo-daro. “Priest-King” is the excavators' nickname, not a known title.", aliases: [{ label: "Priest-King", lang: "en", note: "The excavators' nickname" }] },
  { ref: "pashupati", slug: "pashupati-seal", kind: "artifact", label: "“Pashupati” seal", qid: "Q1942840", link: { to: "@mohenjodaro", type: "related_to", note: "Found at Mohenjo-daro in 1928 or 1929; now in the National Museum, New Delhi." }, description: "A steatite seal from Mohenjo-daro showing a horned figure seated among animals. The name reflects one reading of it, John Marshall's.", aliases: [{ label: "Proto-Shiva seal", lang: "en", note: "After Marshall's reading" }, { label: "Mohenjo-daro seal 420", lang: "en" }] },
  { ref: "script", slug: "indus-script", kind: "concept", label: "Indus script", qid: "Q601388", link: { to: CULTURE, type: "related_to" }, description: "The short strings of signs on Indus seals, tablets and pots. Not deciphered; whether they write a language is debated.", aliases: [{ label: "Harappan script", lang: "en" }] },
  // Rivers and regions
  { ref: "indus", slug: "indus-river", kind: "place", label: "Indus River", qid: "Q7348", link: { to: CULTURE, type: "related_to" }, description: "The river of Pakistan and north-west India after which the civilisation is named.", aliases: [{ label: "Sindhu", lang: "sa-Latn" }] },
  { ref: "ghaggar", slug: "ghaggar-hakra-river", kind: "place", label: "Ghaggar-Hakra river", qid: "Q798422", link: { to: CULTURE, type: "related_to" }, description: "A seasonal river of north-west India and its dry continuation in Pakistan, along which many Harappan sites lie. Whether it is the Rigveda's Sarasvatī is debated.", dropAliases: /./, aliases: [{ label: "Ghaggar", lang: "en", note: "The name in India" }, { label: "Hakra", lang: "en", note: "The name in Pakistan" }, { label: "Sarasvati", lang: "en", note: "An identification with the Rigvedic river, made since the 19th century and still debated" }] },
  { ref: "meluhha", slug: "meluhha", kind: "place", label: "Meluhha", qid: "Q483421", link: { to: CULTURE, type: "related_to", note: "Most scholars identify Meluhha of the Mesopotamian texts with the Indus civilisation." }, description: "A land named in Mesopotamian inscriptions as a source of ships and goods. Its identification is not certain." },
  { ref: "magan", slug: "magan", kind: "place", label: "Magan", qid: "Q1429914", link: { to: CULTURE, type: "related_to", note: "Named with Meluhha in Mesopotamian texts." }, description: "A land named in Mesopotamian texts, now placed in Oman and the United Arab Emirates.", aliases: [{ label: "Makkan", lang: "en" }] },
  { ref: "dilmun", slug: "dilmun", kind: "place", label: "Dilmun", qid: "Q748846", link: { to: CULTURE, type: "related_to", note: "Named with Meluhha in Mesopotamian texts." }, description: "A trading land of the Persian Gulf named in Mesopotamian texts, usually placed in Bahrain and the nearby coast.", dropAliases: /./ },
  // Contemporaries
  { ref: "akkad", slug: "akkadian-empire", kind: "polity", label: "Akkadian Empire", qid: "Q4461035", wdWhen: true, link: { to: CULTURE, type: "contemporary_of", note: "Falls within the Mature Harappan phase (c. 2600–1900 BCE)." }, description: "The Mesopotamian state founded by Sargon of Akkad, whose inscriptions name the ships of Meluhha." },
  { ref: "oldkingdom", slug: "old-kingdom-of-egypt", kind: "period", label: "Old Kingdom of Egypt", qid: "Q177819", wdWhen: true, link: { to: CULTURE, type: "contemporary_of", note: "Overlaps the Early and Mature Harappan phases." }, description: "The age of the great pyramids in Egypt, in the third millennium BCE." },
  { ref: "sargon", slug: "sargon-of-akkad", kind: "person", label: "Sargon of Akkad", qid: "Q199461", when: { start: bce(2334), end: bce(2279), basis: "Reign as given by Wikipedia, Meluhha (2334–2279 BCE, a conventional chronology); Wikidata gives only centuries" }, link: { to: "@akkad", type: "related_to", note: "Founder of the Akkadian Empire." }, description: "King of Akkad in Mesopotamia; his inscription boasts that ships of Meluhha moored at his capital." },
  { ref: "gudea", slug: "gudea", kind: "person", label: "Gudea of Lagash", qid: "Q310336", wdWhen: true, link: { to: CULTURE, type: "related_to", note: "His inscriptions name goods from Meluhha." }, description: "Ruler of the Sumerian city of Lagash; his inscriptions list wood, gold dust and stone brought from Meluhha." },
  // People
  { ref: "masson", slug: "charles-masson", kind: "person", label: "Charles Masson", qid: "Q1065478", life: true, link: { to: "@harappa", type: "related_to", note: "Described the ruins in 1842, after a visit in 1826." }, description: "A deserter from the East India Company's army turned traveller, who described the mounds at Harappa in 1842." },
  { ref: "cunningham", slug: "alexander-cunningham", kind: "person", label: "Alexander Cunningham", qid: "Q455430", life: true, link: { to: "@harappa", type: "related_to", note: "Surveyed Harappa and published its first seal (1875)." }, description: "Founder of the Archaeological Survey of India; published the first Harappan seal in 1875." },
  { ref: "sahni", slug: "daya-ram-sahni", kind: "person", label: "Daya Ram Sahni", qid: "Q18750216", life: true, link: { to: "@harappa", type: "related_to", note: "Excavated Harappa from 1920–21." }, description: "Indian archaeologist who began the excavation of Harappa in 1920–21." },
  { ref: "banerji", slug: "r-d-banerji", kind: "person", label: "R. D. Banerji", qid: "Q7286651", life: true, link: { to: "@mohenjodaro", type: "related_to", note: "Began excavating Mohenjo-daro in 1921–22." }, description: "Indian archaeologist who began the excavation of Mohenjo-daro in 1921–22.", aliases: [{ label: "Rakhaldas Bandyopadhyay", lang: "en" }, { label: "Rakhal Das Banerji", lang: "en" }] },
  { ref: "marshall", slug: "john-marshall", kind: "person", label: "John Marshall", qid: "Q1376456", life: true, link: { to: CULTURE, type: "related_to", note: "Director-General of the Archaeological Survey of India; announced the discovery in 1924." }, description: "Director-General of the Archaeological Survey of India, 1902–28, who announced the Indus civilisation to the world in 1924." },
  { ref: "wheeler", slug: "mortimer-wheeler", kind: "person", label: "Mortimer Wheeler", qid: "Q733878", life: true, link: { to: CULTURE, type: "related_to", note: "Excavated at Harappa in 1946; argued for destruction by invaders." }, description: "British archaeologist, Director-General of the Archaeological Survey of India 1944–48; excavated at Harappa in 1946." },
  { ref: "dales", slug: "george-dales", kind: "person", label: "George F. Dales", qid: "Q5539086", life: true, link: { to: CULTURE, type: "related_to", note: "Re-examined the Mohenjo-daro “massacre” in 1964." }, description: "American archaeologist who re-examined the evidence for a “massacre” at Mohenjo-daro in 1964." },
];

/** Glossary terms (kind "term"). */
const TERMS: EntitySpec[] = [
  { ref: "t_harappan", slug: "harappan", kind: "term", label: "Harappan", description: "Of the Indus civilisation, named after Harappa, the first of its cities to be excavated. Archaeologists name cultures after a typical site." },
  { ref: "t_mature", slug: "mature-harappan", kind: "term", label: "Mature Harappan", description: "The phase when the big cities flourished, about 2600–1900 BCE. “Early” and “Late” Harappan are the phases before and after." },
  { ref: "t_seal", slug: "stamp-seal", kind: "term", label: "stamp seal", description: "A small carved stone, usually square, pressed into wet clay to leave a raised picture and signs. Many Indus seals have a knob on the back with a hole." },
  { ref: "t_steatite", slug: "steatite", kind: "term", label: "steatite", description: "Soapstone: a soft stone, easy to carve, that becomes hard and white when fired. Most Indus seals are made of it." },
  { ref: "t_faience", slug: "faience", kind: "term", label: "faience", description: "A glazed material made from crushed quartz, fired to a shiny, often blue-green, surface; used for beads, bangles and small tablets." },
  { ref: "t_citadel", slug: "citadel", kind: "term", label: "citadel", description: "The raised, walled mound of a city, usually on its west side at Indus sites. The word suggests a fortress; what the buildings on it were used for is often unclear." },
  { ref: "t_chalcolithic", slug: "chalcolithic", kind: "term", label: "Chalcolithic", description: "“Copper-stone” age: when people used copper alongside stone tools. Marshall used it for the Indus period; today it is usually called the Bronze Age." },
  { ref: "t_bilingual", slug: "bilingual-inscription", kind: "term", label: "bilingual inscription", description: "The same text written in two languages or scripts, one already known. Such texts, like the Rosetta Stone, made other decipherments possible; none is known for the Indus script." },
  { ref: "t_palaeochannel", slug: "palaeochannel", kind: "term", label: "palaeochannel", description: "The old course of a river that no longer flows there, traced from satellite images and from the sand and silt it left behind." },
  { ref: "t_deurban", slug: "deurbanisation", kind: "term", label: "deurbanisation", description: "The emptying of cities: people moving to smaller towns and villages. Archaeologists use it for the end of the Indus cities, rather than “collapse”." },
];

export interface ResolvedEntities {
  /** ref → the value to use in ops ("@ref" if created here, else a slug or id). */
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
  const out: ResolvedEntities = { ref: { culture: CULTURE }, ops: [], dependsOn: [], reused: [] };
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
    const aliases = [
      ...(s.aliases ?? []),
      ...(wd?.aliases ?? []).filter(
        (a) =>
          !(s.dropAliases?.test(a.label) ?? false) &&
          // Wikidata sometimes tags a romanised alias with a native script; skip those.
          !(a.script && a.script !== "Latn" && /^[\x00-\x7f]+$/.test(a.label)) &&
          a.label.toLowerCase() !== s.label.toLowerCase() &&
          !(s.aliases ?? []).some((x) => x.label.toLowerCase() === a.label.toLowerCase()),
      ),
    ].slice(0, 10);
    const op: ChangeOpInput = {
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
      op.spans = [
        {
          role: "life",
          when: { edtf: wd.when.edtf },
          basis: `Wikidata ${s.qid}: date of birth and death`,
          source: { wikidata: { qid: s.qid!, property: "P569/P570" } },
        },
      ];
    else if (s.when) op.when = s.when as never;
    else if (s.wdWhen && wd?.when) op.when = { edtf: wd.when.edtf, basis: wd.when.basis ?? `Wikidata ${s.qid}` };
    if (s.geo && wd?.coordinates)
      op.geo = {
        geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
        certainty: "approximate",
        note: `Coordinates from Wikidata ${s.qid}: one point for the whole site.`,
      };
    out.ops.push(op);
    out.ref[s.ref] = `@${s.ref}`;
  }
  // Links, so the page's timeline and map pick the entities up. Only for entities created here.
  for (const s of ENTITIES) {
    if (!s.link || !out.ref[s.ref]!.startsWith("@")) continue;
    const to = s.link.to.startsWith("@") ? out.ref[s.link.to.slice(1)]! : s.link.to;
    out.ops.push({ op: "link_entities", from: out.ref[s.ref]!, to, type: s.link.type, ...(s.link.note ? { note: s.link.note } : {}) });
  }
  out.dependsOn = [...new Set(out.dependsOn)];
  return out;
}

// ---------------------------------------------------------------- content

type Loc = { page?: string; pageEnd?: string; volume?: string; chapter?: string; section?: string; verse?: string; label?: string };
export interface ExcerptSpec {
  ref: string;
  source: string;
  snap: CaptureKey;
  quote: string;
  locator: Loc;
  note?: string;
}

/** Every quoted excerpt, with the snapshot it is checked against. Exported for checking quotes offline. */
export const EXCERPTS: ExcerptSpec[] = [];
const x = (ref: string, source: string, snap: CaptureKey, quote: string, locator: Loc, note?: string) =>
  EXCERPTS.push({ ref, source, snap, quote, locator, ...(note ? { note } : {}) });

// Discovery
x("x_masson_mound", "s_masson", "masson", "Behind us was a large circular mound, or eminence, and to the west was an irregular rocky height, crowned with remains of buildings, in fragments of walls, with niches, after the eastern manner.", { volume: "1", page: "452", label: "Chapter XXV, arrival at “Haripah”" });
x("x_masson_city", "s_masson", "masson", "Tradition affirms the existence here of a city, so considerable that it extended to Chicha Watni, thirteen cosses distant, and that it was destroyed by a particular visitation of Providence, brought down by the lust and crimes of the sovereign.", { volume: "1", page: "453" });
x("x_masson_sangala", "s_masson", "masson", "without perceiving that every condition of Arrian's Sangala was here fulfilled", { volume: "1", page: "453" });
x("x_cun_1826", "s_cunningham", "cunningham", "Masson's visit was made in 1826", { page: "106", label: "“Harapa”" });
x("x_cun_ballast", "s_cunningham", "cunningham", "they have more than sufficed to furnish brick ballast for about 100 miles of the Lahor and Multan Railway", { page: "107", label: "“Harapa”" });
x("x_asi25_railway", "s_asi2425", "asi2425", "have been sadly damaged by the depredations of villagers and railway contractors in search of bricks", { page: "62", label: "Marshall's note: Harappa" });
x("x_cun_seal", "s_cunningham", "cunningham", "Above the bull there is an inscription in six characters, which are quite unknown to me. They are certainly not Indian letters; and as the bull which accompanies them is without a hump, I conclude that the seal is foreign to India.", { page: "108", label: "“Harapa”; the seal is drawn on Plate XXXIII" });
x("x_asi24_bound", "s_asi2324", "asi2324", "Now, at a single bound, we have taken back our knowledge of Indian civilization some 3000 years earlier and have established the fact that in the 3rd millennium before Christ and even before that the peoples of the Punjab and Sind were living in well-built cities", { page: "47", label: "Section II, Exploration: introductory (Marshall)" });
x("x_asi24_sahni", "s_asi2324", "asi2324", "At Harappa itself excavations had been started at my request by Rai Bahadur Daya Ram Sahni in 1920-21", { page: "47", label: "Section II, Exploration: introductory (Marshall)" });
x("x_asi24_banerji", "s_asi2324", "asi2324", "The excavation of this site was begun by Mr. Rakhal Das Banerji in 1921-22, and it is to him that we mainly owe the subsequent discoveries that have been made there.", { page: "48", label: "Section II, Exploration: introductory (Marshall)" });
x("x_asi24_same", "s_asi2324", "asi2324", "That the finds from the two sites belonged to the same stage of culture and approximately to the same age, and that they were totally distinct from anything previously known to us in India was at once evident.", { page: "48", label: "Section II, Exploration: introductory (Marshall)" });
x("x_asi24_sayce", "s_asi2324", "asi2324", "In the following issue of the Illustrated London News appeared a letter from Professor Sayce pointing out the close resemblance between these objects from the Indus Valley and certain Sumerian antiquities from Southern Mesopotamia", { page: "48" });
x("x_asi24_contemporary", "s_asi2324", "asi2324", "there can now no longer be any doubt that the Punjab and Sind antiquities are closely connected and roughly contemporary with the Sumerian antiquities of Mesopotamia", { page: "48" });
x("x_iln_threshold", "s_iln", "iln", "It looks, however, at this moment, as if we were on the threshold of such a discovery in the plains of the Indus.", { page: "528", label: "“First light on a long-forgotten civilisation” (page read from the running heads either side)" });
x("x_asi26_name", "s_asi2526", "asi2526", "I shall use the term “Indus” henceforth to designate the particular culture of the chalcolithic period which I have hitherto designated Indo-Sumerian, since the latter term is likely to imply a closer connection with Sumer than now seems justified.", { page: "75", label: "Exploration, Western Circle: Mohenjo-daro, area Sd. (Marshall)" });
x("x_wp_dates", "s_wp_ivc", "wpIvc", "lasting from 3300 BCE to 1300 BCE, and in its mature form from 2600 BCE to 1900 BCE", { section: "Lead" });
x("x_rao_dates", "s_rao", "rao", "The Indus (or Harappan) civilization flourished from ca. 2600 to 1900 B.C. in a vast region spanning what is now Pakistan and northwestern India.", { section: "Introduction" });
x("x_singh_dates", "s_singh", "singh", "Urbanism in the Bronze-age Indus Civilisation (~4.6–3.9 thousand years before the present, ka)", { section: "Abstract" });
x("x_dales_area", "s_dales", "dales", "Remains of this vast civilization of South Asia are scattered over an area considerably larger than those covered by either ancient Egypt or Mesopotamia.", { label: "Opening section" });
x("x_wp_area", "s_wp_ivc", "wpIvc", "it was geographically larger than ancient Egypt and Mesopotamia combined", { section: "Lead" });
// Cities
x("x_unesco_grid", "s_unesco_mjd", "unescoMjd", "Here buildings are laid out along streets intersecting each other at right angles, in a highly orderly form of city planning that also incorporated systems of sanitation and drainage.", { section: "Brief synthesis" });
x("x_asi25_houses", "s_asi2425", "asi2425", "are remarkable for the excellence of their construction and for the relatively high degree of comfort evidenced by the presence of wells, bath-rooms, brick flooring and an elaborate system of drainage", { page: "61", label: "Marshall's note on the prehistoric civilisation of the Indus" });
x("x_asi26_tank", "s_asi2526", "asi2526", "The tank itself measures 39 feet by 23 feet and is sunk about 8 feet below the surrounding floor level.", { page: "77", label: "Mohenjo-daro, area Sd.: the “Bath” (Marshall)" });
x("x_asi26_bitumen", "s_asi2526", "asi2526", "the back was coated with an inch thick layer of bitumen", { page: "77", label: "Mohenjo-daro, area Sd.: the “Bath” (Marshall)" });
x("x_unesco_dho", "s_unesco_dho", "unescoDho", "Occupied between ca. 3000-1500 BCE, the archaeological site, one of the best preserved urban settlements from the period in Southeast Asia, comprises a fortified city and a cemetery.", { section: "Description" });
x("x_unesco_dho_water", "s_unesco_dho", "unescoDho", "A sophisticated water management system demonstrates the ingenuity of the Dholavira people in their struggle to survive and thrive in a harsh environment.", { section: "Description" });
x("x_unesco_dho_found", "s_unesco_dho", "unescoDho", "The ancient Harappan city of Dholavira was discovered in 1968 and excavated for 13 field seasons between 1989 and 2005.", { section: "Integrity" });
x("x_unesco_dho_stone", "s_unesco_dho", "unescoDho", "multi-layered fortifications, sophisticated water reservoirs and drainage system, and the extensive use of stone as a building material", { section: "Criterion (iv)" });
x("x_wp_sites", "s_wp_ivc", "wpIvc", "Although over a thousand Mature Harappan sites have been reported and nearly a hundred excavated, there are only five major urban centres", { section: "Lead" });
x("x_unesco_dho_count", "s_unesco_dho", "unescoDho", "Being the 6th largest of more than 1,000 Harappan sites discovered so far", { section: "Brief synthesis" });
x("x_hc_population", "s_harappacom", "harappacom", "These excavations have the shown Harappa to have been far larger than once thought, perhaps supporting a population of 50,000 at certain periods.", { section: "HARP and Indian excavations" }, "Sic: “have the shown”.");
x("x_wp_population", "s_wp_ivc", "wpIvc", "Mohenjo-daro and Harappa very likely grew to contain between 30,000 and 60,000 individuals", { section: "Lead" });
x("x_wp_lothal_dock", "s_wp_lothal", "wpLothal", "According to the ASI, Lothal may have had one of the world's earliest known dock, which connected the city to an ancient course of the Sabarmati River on the trade route.", { section: "Discovery" }, "Sic: “earliest known dock”.");
x("x_wp_lothal_tank", "s_wp_lothal", "wpLothal", "this interpretation has been challenged by other archaeologists, who argue Khufu's Red Sea harbour at Wadi al-Jarf (Egypt) is older, dating its construction to between 2580 and 2550 BCE and that Lothal was a comparatively small town, and that the \"dock\" was primarily an irrigation tank.", { section: "Discovery" });
// Script
x("x_rao_undeciphered", "s_rao", "rao", "The script remains undeciphered, despite a large number of attempts and claimed decipherments over the past 80 years.", { section: "Abstract" });
x("x_rao_obstacles", "s_rao", "rao", "Several obstacles to decipherment have been identified ( 4 ), including the lack of any bilinguals, the brevity of the inscriptions (the average inscription is ≈5 signs long), and our almost complete lack of knowledge of the language(s) used in the civilization.", { section: "Introduction" });
x("x_rao_corpus", "s_rao", "rao", "More than 3,800 inscriptions in the Indus script have been unearthed on stamp seals, sealings, amulets, small tablets, and ceramics", { section: "Introduction" });
x("x_rao_60", "s_rao", "rao", "Although there have been >60 claimed decipherments ( 4 ), none of these has been widely accepted by the community.", { section: "Introduction" });
x("x_rao_linguistic", "s_rao", "rao", "our results indicate that the Indus script exhibits rich synactic structure and the ability to represent diverse content. both of which are suggestive of a linguistic writing system rather than a nonlinguistic symbol system.", { section: "Abstract" }, "Sic: “synactic”.");
x("x_hc_script", "s_harappacom", "harappacom", "The ancient Indus Civilization script has not been deciphered.", { section: "Introduction" });
x("x_fsw_claim", "s_fsw", "fsw", "We demonstrate the impossibility of the lost-manuscript thesis and show that Indus symbols were not even evolving in linguistic directions after at least 600 years of use.", { page: "19", label: "Abstract" });
x("x_fsw_hundred", "s_fsw", "fsw", "Starting in 1877, over a hundred claimed decipherments have made it to print", { page: "19" });
x("x_asi24_script", "s_asi2324", "asi2324", "we have at present no means of determining whether the script was used in India in its pictographic or its phonetic value or in a combination of the two", { page: "50", label: "Section II, Exploration: introductory (Marshall)" }, "Poor OCR here (“bnye”, “m India m”, “vaino”); the match is approximate.");
x("x_iln_alphabet", "s_iln", "iln", "that they bear no resemblance whatever to any ancient Indian alphabet known to us", { page: "528" });
x("x_asi25_script", "s_asi2425", "asi2425b", "The inscriptions engraved on the seals are all in the pictographic script of the period, which has yet to be deciphered.", { page: "62", label: "Marshall's note on the prehistoric civilisation of the Indus" }, "Checked against the second scan (in.ernet.dli.2015.35514), whose OCR is cleaner here.");
// Trade
x("x_barton_sargon", "s_barton", "barton", "the ships of Melukha, the ships of Magan, the ships of Dilmun, at the wharf before Agade he moored.", { page: "109", label: "Dynasty of Agade and Kish: Sargon, inscription 2, lines 8–13 (translation)" }, "Line numbers are printed inside the translation and appear in the OCR.");
x("x_barton_gudea_b", "s_barton", "barton", "Gold dust from the mountain of Melukha he brought down", { page: "185", label: "Gudea, Statue B, col. VI (translation)" });
x("x_barton_gudea_d", "s_barton", "barton", "Magan, Melukha, Gubi, and Dilmun brought great tribute.", { page: "191", label: "Gudea, Statue D (translation)" });
x("x_barton_gudea_cyl", "s_barton", "barton", "Porphyry from Melukha he brought from afar.", { page: "221", label: "Gudea, Cylinder A (translation)" });
x("x_wp_meluhha_id", "s_wp_meluhha", "wpMeluhha", "Its identification remains an open question, but most scholars associate it with the Indus Valley Civilisation.", { section: "Lead" });
x("x_wp_sargon", "s_wp_meluhha", "wpMeluhha", "In an inscription, Sargon of Akkad (2334–2279 BCE) referred to ships coming from Meluhha, Magan and Dilmun.", { section: "Inscriptions" });
x("x_wp_gudea", "s_wp_meluhha", "wpMeluhha", "In an inscription, Gudea of Lagash (c. 21st century BCE) referred to the Meluhhans who came to Sumer to sell gold dust, carnelian, etc.", { section: "Inscriptions" });
x("x_wp_magan", "s_wp_meluhha", "wpMeluhha", "The Sumerian location of Magan is now accepted to be the area currently encompassing the United Arab Emirates and Oman.", { section: "Trade with Sumer" });
x("x_wp_dilmun", "s_wp_meluhha", "wpMeluhha", "The current scholarly consensus is that Dilmun encompassed Bahrain, Failaka Island and the adjacent coast of Eastern Arabia in the Persian Gulf.", { section: "Trade with Sumer" });
x("x_hc_meluhha", "s_harappacom", "harappacom", "Ancient Mesopotamian texts speak of trading with at least two seafaring civilizations - Magan and Meluhha - in the neighborhood of South Asia in the third millennium B.C.E.", { section: "Meluhha" });
x("x_hc_objects", "s_harappacom", "harappacom", "A wide variety of objects produced in the Indus region have been found at sites in Mesopotamia.", { section: "Meluhha" });
x("x_rao_seals_wa", "s_rao", "rao", "Application of this test to Indus seals found in Mesopotamia and other sites in West Asia reveals that the script may have been used to express different content in these regions.", { section: "Abstract" });
x("x_asi26_sea", "s_asi2526", "asi2526", "That close intercourse was maintained at this period between Sind and Sumer, and that this intercourse was carried on by sea rather than by land, is all but certain.", { page: "78", label: "Mohenjo-daro, area Sd.: the “Bath” (Marshall)" });
x("x_asi26_bitumen_local", "s_asi2526", "asi2526", "it is obviously more reasonable to suppose that it came from one or other of these sources rather than all the way from Mesopotamia", { page: "78", label: "Mohenjo-daro, area Sd.: the “Bath” (Marshall)" });
x("x_wheeler_akkad", "s_wheeler", "wheeler", "The relative abundance of Harappan objects on Akkadian sites may be taken to imply that, in and about the time of Sargon, Harappan enterprise", { page: "82" });
x("x_wheeler_fixed", "s_wheeler", "wheeler", "let it be squarely stated once more that the Akkadian contacts are the only well-fixed points", { page: "82" });
x("x_unesco_dho_trade", "s_unesco_dho", "unescoDho", "Evidence for inter-regional trade with other Harappan cities, as well as with cities in the Mesopotamia region and the Oman peninsula have also been discovered.", { section: "Description" });
// Daily life and crafts
x("x_asi25_crafts", "s_asi2425", "asi2425", "they were manufacturing jewellery and other articles in highly polished gold, fine paste and glazed blue and white faience", { page: "62", label: "Marshall's note on the prehistoric civilisation of the Indus" });
x("x_asi25_stone", "s_asi2425", "asi2425", "For every day purposes they were using stone knives or scrapers of the crudest types, hundreds of which have been found in their houses.", { page: "62" });
x("x_iln_unicorns", "s_iln", "iln", "The animals engraved on them are in some instances bulls; in others, unicorns; but it is to be observed that neither the Indian humped bull nor the water-buffalo occurs among them.", { page: "528" });
x("x_asi25_brahmani", "s_asi2425", "asi2425b", "the most striking perhaps is one depicting a “Brahmani” bull, the drawing of which shows great breadth and a fine sense of the decorative", { page: "62" });
x("x_asi25_horse", "s_asi2425", "asi2425", "on others are tigers, elephants, rhinoceroses and a variety of other animals, but not, be it noted, the horse, which was probably imported into India at a later date by the Aryans", { page: "62" });
x("x_hc_standard", "s_harappacom", "harappacom", "The Harappans used the same size bricks and standardized weights as were used in other Indus cities such as Mohenjo Daro and Dholavira.", { section: "Cities and Context" });
x("x_green_weights", "s_green", "green", "They maintained a standardized system of weights and measures across the broad extent of the Indus civilization over centuries", { section: "Discussion" });
x("x_unesco_dho_beads", "s_unesco_dho", "unescoDho", "Bead processing workshops and artifacts of various kinds such as copper, shell, stone, jewellery of semi-precious stones, terracotta, gold, ivory and other materials have been found during archaeological excavations of the site", { section: "Description" });
x("x_green_nopalaces", "s_green", "green", "The Indus civilization lacks evidence of palaces, elaborate tombs, aggrandizing monuments, and significant discrepancies in grave goods.", { section: "Conclusion" });
// Religion
x("x_asi25_tablet", "s_asi2425", "asi2425b", "certainly suggests that the central figure was intended to represent a deity rather than a king", { page: "61", label: "Marshall's note: a faience tablet from Mohenjo-daro" });
x("x_asi26_purpose", "s_asi2526", "asi2526", "For what purpose the tank in the centre of this building was intended can only be surmised.", { page: "78", label: "Mohenjo-daro, area Sd.: the “Bath” (Marshall)" });
x("x_asi26_religion", "s_asi2526", "asi2526", "the most plausible hypothesis seems to be that it was connected in some way with the City's religion", { page: "78" });
x("x_asi29_siva", "s_asi2829", "asi2829", "This figure is identified by Sir John Marshall with the Indian God Siva.", { page: "74", label: "Exploration, Mohenjo-daro: seal Dk. 5175, Plate XXVIII" }, "The OCR reads “identifed”.");
x("x_asi29_oldest", "s_asi2829", "asi2829", "it is clear from this seal as well as from other evidence that his cult goes back to the Indus period, and hence that it is the oldest living cult in the world", { page: "75", label: "Marshall, quoted in the Mohenjo-daro report" });
x("x_wp_pashupati_claim", "s_wp_pashupati", "wpPashupati", "It had been claimed to be one of the earliest depictions of the Hindu god Shiva", { section: "Lead" });
x("x_wp_pashupati_doubt", "s_wp_pashupati", "wpPashupati", "Some 21st-century scholars have urged caution in interpretation.", { section: "Not determinable" });
x("x_wp_pashupati_srinivasan", "s_wp_pashupati", "wpPashupati", "According to her, the two extra faces could be reinterpreted as possible ears, and the central face has predominant bovine features.", { section: "Doris Srinivasan's reinterpretation" });
// The end of the cities
x("x_giosan_decline", "s_giosan", "giosan", "since approximately 3,900 y ago, the total settled area and settlement sizes declined, many sites were abandoned, and a significant shift in site numbers and density towards the east is recorded", { section: "Abstract" });
x("x_giosan_cause", "s_giosan", "giosan", "Hydroclimatic stress increased the vulnerability of agricultural production supporting Harappan urbanism, leading to settlement downsizing, diversification of crops, and a drastic increase in settlements in the moister monsoon regions of the upper Punjab, Haryana, and Uttar Pradesh.", { section: "Abstract" });
x("x_giosan_gradual", "s_giosan", "giosan", "As the monsoon weakened, monsoonal rivers gradually dried or became seasonal, affecting habitability along their courses.", { section: "Abstract" });
x("x_chatterjee_decline", "s_chatterjee", "chatterjee", "The urban Harappans abandoned their settlements in the Ghaggar valley within next few centuries and the civilisation declined by 3.9 ka.", { section: "Dynamics of the Harappan settlements" });
x("x_asi25_abandoned", "s_asi2425", "asi2425", "No attempt to rehabilitate the place seems to have been made in the succeeding millennia until about the beginning of the Christian era", { page: "63", label: "Western Circle: Mohenjo-daro, third season" });
x("x_asi25_aryans", "s_asi2425", "asi2425", "whose culture was largely destroyed in the second or third millennium B. C. by the invading Aryans from the north", { page: "63", label: "Marshall's note on the prehistoric civilisation of the Indus" });
x("x_wheeler_destruction", "s_wheeler", "wheeler", "Climatic, economic, political deterioration may have weakened it, but its ultimate extinction is more likely to have been completed by deliberate and large-scale destruction.", { page: "82", label: "“Harappa 1946: the defences and cemetery R 37”" });
x("x_wheeler_indra", "s_wheeler", "wheeler", "On circumstantial evidence, Indra stands accused.", { page: "82" });
x("x_wheeler_hedge", "s_wheeler", "wheeler", "even Indra's hostile citadels may be represented, not by the Harappan sites, but by others yet unknown to us", { page: "82" });
x("x_dales_37", "s_dales", "dales", "Nine years of extensive excavations at Mohenjo-daro (1922-31)– a city about three miles in circuit–yielded the total of some 37 skeletons, or parts thereof, that can be attributed with some certainty to the period of the Indus civilization.", { label: "Section on the skeletal remains" });
x("x_dales_citadel", "s_dales", "dales", "Not a single body was found within the area of the fortified citadel where one could reasonably expect the final defense of this thriving capital city to have been made.", { label: "Section on the skeletal remains" });
x("x_dales_nodestruction", "s_dales", "dales", "There is no destruction level covering the latest period of the city, no sign of extensive burning, no bodies of warriors clad in armor and surrounded by the weapons of war.", { label: "Conclusion of the case" });
x("x_dales_where", "s_dales", "dales", "Where are the burned fortresses, the arrowheads, weapons, pieces of armor, the smashed chariots and bodies of the invaders and defenders?", { label: "Opening section" });
x("x_dales_wheeler", "s_dales", "dales", "as Sir Mortimer Wheeler put it, “Indra stands accused” of destroying the cities of the Harappan civilization", { label: "Opening section" });
x("x_dales_floods", "s_dales", "dales", "This resulted in a disastrous increase in the already serious floods in the major river valleys with the subsequent rise of the underground water table, contributing to an increase in the soil salinity", { label: "Closing section" });
// The river
x("x_rv_sarasvati", "s_griffith", "griffith", "Pure in her course from mountains to the ocean, alone of streams Sarasvati hath listened.", { volume: "2", page: "90", verse: "RV 7.95.2" });
x("x_rv_might", "s_griffith", "griffith", "As on a car, the flood flows on, surpassing in majesty and might all other waters.", { volume: "2", page: "90", verse: "RV 7.95.1" });
x("x_oldham_course", "s_oldham", "oldham", "Its ancient course, however, is continuous with the dry bed of a great river, which, as local legends assert, once flowed through the desert to the sea.", { page: "54" });
x("x_oldham_sutlej", "s_oldham", "oldham", "There can be little doubt that this river, instead of turning nearly due west on leaving the hills, as at present, anciently took a more southerly direction, and that the Hakra is its former bed.", { page: "56" }, "“This river” is the Sutlej.");
x("x_chatterjee_settlements", "s_chatterjee", "chatterjee", "The occurrence of a large number of Harappan settlements along the banks of the Ghaggar-Hakra stream, which had remained a seasonal river for most part of its historical existence, has baffled archeologists since the 1950s.", { section: "Introduction" });
x("x_giosan_sarasvati", "s_giosan", "giosan", "Contrary to earlier assumptions that a large glacier-fed Himalayan river, identified by some with the mythical Sarasvati, watered the Harappan heartland on the interfluve between the Indus and Ganges basins, we show that only monsoonal-fed rivers were active there during the Holocene.", { section: "Abstract" });
x("x_singh_sutlej", "s_singh", "singh", "we demonstrate that flow of the Sutlej in this course terminated considerably earlier than Indus occupation, with diversion to its present course complete shortly after ~8 ka. Indus urban settlements thus developed along an abandoned river valley rather than an active Himalayan river.", { section: "Abstract" });
x("x_chatterjee_perennial", "s_chatterjee", "chatterjee", "We establish that during 80-20 ka and 9-4.5 ka the river was perennial and was receiving sediments from the Higher and Lesser Himalayas.", { section: "Abstract" });
x("x_chatterjee_lost", "s_chatterjee", "chatterjee", "However, by the time the civilization matured, the river had already lost its glacial connection.", { section: "Dynamics of the Harappan settlements" });
x("x_chatterjee_saraswati", "s_chatterjee", "chatterjee", "This revived perennial condition of the Ghaggar, which can be correlated with the Saraswati, likely facilitated development of the early Harappan settlements along its banks.", { section: "Abstract" });
// What continued
x("x_green_deurban", "s_green", "green", "With deurbanization, writing, seals, weights, long-distance exchange, and large nonresidential architecture all disappeared (Petrie 2017, 2019). However, small settlements continued and even increased in many parts of northwest India", { section: "Deurbanization" });
x("x_dales_shift", "s_dales", "dales", "the major population shift was to the southeast into the area of the Kathiawar peninsula, north of Bombay.", { label: "Closing section" });
x("x_hc_living", "s_harappacom", "harappacom", "Harappa was settled before what we call the ancient Indus civilization flourished, and it remains a living town today.", { section: "Cities and Context" });
x("x_shinde_impact", "s_shinde", "shinde", "had little if any genetic contribution from Steppe pastoralists or western Iranian farmers or herders, and that had a primary impact on the ancestry of later South Asians", { section: "Discussion" });
x("x_shinde_caution", "s_shinde", "shinde", "a single sample--or even the gradient of 12 likely IVC samples we have identified--cannot fully characterize a cosmopolitan ancient civilization", { section: "Discussion" });
x("x_unesco_stupa", "s_unesco_mjd", "unescoMjd", "a citadel area in the west where the Buddhist stupa was constructed with unbaked brick over the ruins of Moenjodaro in the 2nd century AD", { section: "Brief synthesis" });
// How we know
x("x_rao_nohistory", "s_rao", "rao", "Although no historical information exists about the Indus civilization (flourished ca. 2600–1900 B.C.), archaeologists have uncovered about 3,800 short samples of a script", { section: "Abstract" });
x("x_asi25_aerial", "s_asi2425", "asi2425", "several previously unknown sites were revealed by an experimental aeroplane survey carried out along some fifty miles of the old bed of the Ravi, on which Harappa stands", { page: "60", label: "Marshall's note on the prehistoric civilisation of the Indus" });
x("x_dales_methods", "s_dales", "dales", "Part of this uncertainty results from the unsatisfactory methods used by the excavators to record and publish their finds.", { label: "Section on the skeletal remains" });
x("x_green_unpublished", "s_green", "green", "Entire blocks from the initial excavations at Mohenjo-daro remained completely unpublished until a revisitation project in the 1980s", { section: "Houses" });
// Misconceptions: one state, the Priest-King
x("x_green_views", "s_green", "green", "Some have argued that the Indus was an empire, some that it was stateless, and others that it was a state-level society led by competitive merchant elites.", { section: "Conclusion" });
x("x_green_wheeler", "s_green", "green", "Wheeler (1968) famously installed a ruling class in Indus cities by suggesting that its robust urban environment was evidence not of a prosperous, albeit relatively egalitarian, citizenry but instead the product of a homogenous and conservative military state—led by “priest-kings.”", { section: "Introduction" });
x("x_green_priestking", "s_green", "green", "the 17.5-cm statuette commonly called the “priest-king”—one of the few pieces of evidence of their supposed existence—is now believed to be evidence of interaction with neighboring societies, not the talisman of a military elite", { section: "Introduction" });
x("x_asi24_nile", "s_asi2324", "asi2324", "was developed in the Indus Valley itself and was probably as distinctive of that region, as the civilization of the Pharaohs was distinctive of the Nile", { page: "49", label: "Section II, Exploration: introductory (Marshall)" }, "The OCR reads “Pharoahs”.");
x("x_wp_pyramid", "s_wp_pyramid", "wpPyramid", "It was built c. 2600 BC over a period of about 26 years.", { section: "Lead" });
x("x_wp_khufu", "s_wp_pyramid", "wpPyramid", "The Great Pyramid served as the tomb of Egyptian Pharaoh Khufu (\"Cheops\"), who ruled during the Fourth Dynasty of the Old Kingdom.", { section: "Lead" });

export function indusOps(s: Snaps, E: Record<string, string>): ChangeOpInput[] {
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
  const ASI_PD =
    "Government of India publication: public domain in India (60 years from publication) and in the US (published before 1931).";

  const ops: ChangeOpInput[] = [
    // ------------------------------------------------------------ sources
    {
      op: "create_source",
      ref: "s_masson",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Narrative of Various Journeys in Balochistan, Afghanistan, and the Panjab",
        author: [{ family: "Masson", given: "Charles" }],
        volume: "1",
        issued: { "date-parts": [[1842]] },
        publisher: "Richard Bentley",
        "publisher-place": "London",
      },
      identifiers: ia("10430709bsb"),
      license: { status: "public_domain", note: "Published 1842; Masson died 1853." },
      note: "An eyewitness description of the mounds at Harappa (“Haripah”), from a visit in 1826. Bavarian State Library copy.",
    },
    {
      op: "create_source",
      ref: "s_cunningham",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Report for the Year 1872-73",
        author: [{ family: "Cunningham", given: "Alexander" }],
        "collection-title": "Archaeological Survey of India",
        volume: "5",
        issued: { "date-parts": [[1875]] },
        publisher: "Office of the Superintendent of Government Printing",
        "publisher-place": "Calcutta",
      },
      identifiers: ia("india.history.resource.86136"),
      license: { status: "public_domain", note: "Published 1875; Cunningham died 1893." },
      note: "“Harapa”, pp. 105–108, with the first published Harappan seal (Plate XXXIII).",
    },
    {
      op: "create_source",
      ref: "s_asi2324",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Annual Report of the Archaeological Survey of India 1923-24",
        editor: [{ family: "Marshall", given: "John" }],
        issued: { "date-parts": [[1926]] },
        publisher: "Government of India, Central Publication Branch",
        "publisher-place": "Calcutta",
      },
      identifiers: ia("in.ernet.dli.2015.35513"),
      license: { status: "public_domain", note: ASI_PD },
      lenses: ["archaeological"],
      note: "Marshall's first official account of Harappa and Mohenjo-daro, Section II (Exploration), pp. 47–51.",
    },
    {
      op: "create_source",
      ref: "s_asi2425",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Annual Report of the Archaeological Survey of India 1924-25",
        editor: [{ family: "Blakiston", given: "J. F." }],
        issued: { "date-parts": [[1927]] },
        publisher: "Government of India, Central Publication Branch",
        "publisher-place": "Calcutta",
      },
      identifiers: ia("annualreportofth030750mbp"),
      license: { status: "public_domain", note: ASI_PD },
      lenses: ["archaeological"],
      note: "Includes Marshall's note on “the pre-historic civilization of the Indus” (pp. 60–63). Two scans are used: annualreportofth030750mbp, and in.ernet.dli.2015.35514 where its OCR is cleaner; each excerpt names the one it was checked against.",
    },
    {
      op: "create_source",
      ref: "s_asi2526",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Annual Report of the Archaeological Survey of India 1925-26",
        editor: [{ family: "Blakiston", given: "J. F." }],
        issued: { "date-parts": [[1928]] },
        publisher: "Government of India, Central Publication Branch",
        "publisher-place": "Calcutta",
      },
      identifiers: ia("dli.ministry.09389"),
      license: { status: "public_domain", note: ASI_PD },
      lenses: ["archaeological"],
      note: "Marshall's report on Mohenjo-daro, including the Great Bath (pp. 75–78). This scan's OCR is much better than in.ernet.dli.2015.35492's.",
    },
    {
      op: "create_source",
      ref: "s_asi2829",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Annual Report of the Archaeological Survey of India 1928-29",
        issued: { "date-parts": [[1933]] },
        publisher: "Government of India, Central Publication Branch",
        "publisher-place": "Delhi",
      },
      identifiers: ia("in.ernet.dli.2015.35504"),
      license: {
        status: "public_domain",
        note: "Government of India publication of 1933: public domain in India since 1994 (60 years from publication), so not restored in the US in 1996; probably public domain in the US.",
      },
      lenses: ["archaeological"],
      note: "The Mohenjo-daro excavation report, which quotes Marshall's identification of the “Pashupati” seal (pp. 74–75).",
    },
    {
      op: "create_source",
      ref: "s_iln",
      kind: "article",
      tier: "primary",
      csl: {
        type: "article-magazine",
        title: "First light on a long-forgotten civilisation: new discoveries of an unknown prehistoric past in India",
        author: [{ family: "Marshall", given: "John" }],
        "container-title": "The Illustrated London News",
        volume: "165",
        issue: "4456",
        page: "528-529",
        issued: { "date-parts": [[1924, 9, 20]] },
      },
      identifiers: ia("sim_illustrated-london-news_1924-09-20_165_4456"),
      license: {
        status: "public_domain",
        note: "Published 1924: public domain in the US. Marshall died 1958, so public domain in India (life + 60) but not in the UK until 2029. Quoted briefly.",
      },
      lenses: ["archaeological"],
      note: "The article that announced the discovery to the world.",
    },
    {
      op: "create_source",
      ref: "s_barton",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Royal Inscriptions of Sumer and Akkad",
        author: [{ family: "Barton", given: "George A." }],
        issued: { "date-parts": [[1929]] },
        publisher: "Yale University Press, for the American Oriental Society",
        "publisher-place": "New Haven",
      },
      identifiers: ia("royalinscription00bart"),
      license: { status: "public_domain", note: "Published 1929 in the US: public domain in the US. Barton died 1942." },
      lenses: ["primary_source", "philological"],
      note: "Transliterations and English translations. “Melukha” is Barton's spelling of Meluhha. Translations of the 1920s; later readings differ in detail.",
    },
    {
      op: "create_source",
      ref: "s_griffith",
      kind: "edition",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Hymns of the Rigveda",
        translator: [{ family: "Griffith", given: "Ralph T. H." }],
        edition: "2",
        volume: "2",
        issued: { "date-parts": [[1897]] },
        publisher: "E. J. Lazarus",
        "publisher-place": "Benares",
      },
      identifiers: ia("in.ernet.dli.2015.104119"),
      license: { status: "public_domain", note: "Published 1897; Griffith died 1906." },
      lenses: ["primary_source"],
      note: "A Victorian verse translation. The Rigveda is usually dated to the late second millennium BCE, after the Indus cities.",
    },
    {
      op: "create_source",
      ref: "s_oldham",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "The Saraswati and the Lost River of the Indian Desert",
        author: [{ family: "Oldham", given: "C. F." }],
        "container-title": "Journal of the Royal Asiatic Society of Great Britain and Ireland",
        page: "49-76",
        issued: { "date-parts": [[1893]] },
      },
      identifiers: ia("in.ernet.dli.2015.70546"),
      license: { status: "public_domain", note: "Published 1893." },
      lenses: ["colonial_orientalist"],
      note: "Written before the Indus civilisation was known. An early statement of the identification of the Ghaggar-Hakra with the Sarasvatī.",
    },
    {
      op: "create_source",
      ref: "s_wheeler",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "Harappa 1946: the defences and cemetery R 37",
        author: [{ family: "Wheeler", given: "R. E. M." }],
        "container-title": "Ancient India: Bulletin of the Archaeological Survey of India",
        issue: "3",
        page: "58-130",
        issued: { "date-parts": [[1947]] },
      },
      identifiers: ia("dli.ministry.09208"),
      license: {
        status: "copyrighted",
        note: "Government of India publication of 1947: public domain in India since 2008, but probably in US copyright (restored in 1996) until 2043. Quoted briefly.",
      },
      lenses: ["archaeological", "colonial_orientalist"],
      note: "The source of “Indra stands accused”: Wheeler's case for destruction by invaders.",
    },
    {
      op: "create_source",
      ref: "s_dales",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-magazine",
        title: "The Mythical Massacre at Mohenjo-Daro",
        author: [{ family: "Dales", given: "George F." }],
        "container-title": "Expedition",
        volume: "6",
        issue: "3",
        issued: { "date-parts": [[1964]] },
        URL: CAPTURES.dales.url,
      },
      identifiers: { url: CAPTURES.dales.url },
      license: { status: "copyrighted", note: "Penn Museum, Expedition magazine. Quoted briefly." },
      lenses: ["archaeological"],
    },
    {
      op: "create_source",
      ref: "s_giosan",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "Fluvial landscapes of the Harappan civilization",
        author: [{ family: "Giosan", given: "Liviu" }, { literal: "et al." }],
        "container-title": "Proceedings of the National Academy of Sciences",
        volume: "109",
        issue: "26",
        page: "E1688-E1694",
        issued: { "date-parts": [[2012]] },
        DOI: "10.1073/pnas.1112743109",
      },
      identifiers: { doi: "10.1073/pnas.1112743109", url: CAPTURES.giosan.url },
      license: { status: "copyrighted", note: "Free to read on PubMed Central; no open licence stated. Quoted briefly." },
      lenses: ["archaeological", "mainstream_academic"],
    },
    {
      op: "create_source",
      ref: "s_singh",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "Counter-intuitive influence of Himalayan river morphodynamics on Indus Civilisation urban settlements",
        author: [{ family: "Singh", given: "Ajit" }, { literal: "et al." }],
        "container-title": "Nature Communications",
        volume: "8",
        page: "1617",
        issued: { "date-parts": [[2017]] },
        DOI: "10.1038/s41467-017-01643-9",
      },
      identifiers: { doi: "10.1038/s41467-017-01643-9", url: CAPTURES.singh.url },
      license: { status: "open", spdx: "CC-BY-4.0" },
      lenses: ["archaeological", "mainstream_academic"],
    },
    {
      op: "create_source",
      ref: "s_chatterjee",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "On the existence of a perennial river in the Harappan heartland",
        author: [{ family: "Chatterjee", given: "Anirban" }, { literal: "et al." }],
        "container-title": "Scientific Reports",
        volume: "9",
        page: "17221",
        issued: { "date-parts": [[2019]] },
        DOI: "10.1038/s41598-019-53489-4",
      },
      identifiers: { doi: "10.1038/s41598-019-53489-4", url: CAPTURES.chatterjee.url },
      license: { status: "open", spdx: "CC-BY-4.0" },
      lenses: ["archaeological"],
    },
    {
      op: "create_source",
      ref: "s_rao",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "A Markov model of the Indus script",
        author: [{ family: "Rao", given: "Rajesh P. N." }, { literal: "et al." }],
        "container-title": "Proceedings of the National Academy of Sciences",
        volume: "106",
        issue: "33",
        page: "13685-13690",
        issued: { "date-parts": [[2009]] },
        DOI: "10.1073/pnas.0906237106",
      },
      identifiers: { doi: "10.1073/pnas.0906237106", url: CAPTURES.rao.url },
      license: { status: "copyrighted", note: "PNAS open access option (free to read); no open licence stated. Quoted briefly." },
      lenses: ["philological"],
    },
    {
      op: "create_source",
      ref: "s_fsw",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "The Collapse of the Indus-Script Thesis: The Myth of a Literate Harappan Civilization",
        author: [{ family: "Farmer", given: "Steve" }, { family: "Sproat", given: "Richard" }, { family: "Witzel", given: "Michael" }],
        "container-title": "Electronic Journal of Vedic Studies",
        volume: "11",
        issue: "2",
        page: "19-57",
        issued: { "date-parts": [[2004]] },
      },
      identifiers: { url: FSW_URL },
      license: { status: "copyrighted", note: "Freely available from the authors. Quoted briefly." },
      lenses: ["philological"],
      note: "The snapshot holds only the abstract and first paragraph, pasted from the authors' PDF (see the snapshot's note).",
    },
    {
      op: "create_source",
      ref: "s_shinde",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "An Ancient Harappan Genome Lacks Ancestry from Steppe Pastoralists or Iranian Farmers",
        author: [{ family: "Shinde", given: "Vasant" }, { literal: "et al." }],
        "container-title": "Cell",
        volume: "179",
        issue: "3",
        page: "729-735",
        issued: { "date-parts": [[2019]] },
        DOI: "10.1016/j.cell.2019.08.048",
      },
      identifiers: { doi: "10.1016/j.cell.2019.08.048", url: CAPTURES.shinde.url },
      license: { status: "copyrighted", note: "Free to read on PubMed Central; licence not stated on the page captured. Quoted briefly." },
      lenses: ["genetic"],
    },
    {
      op: "create_source",
      ref: "s_green",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "Killing the Priest-King: Addressing Egalitarianism in the Indus Civilization",
        author: [{ family: "Green", given: "Adam S." }],
        "container-title": "Journal of Archaeological Research",
        volume: "29",
        page: "153-202",
        issued: { "date-parts": [[2021]] },
        DOI: "10.1007/s10814-020-09147-9",
      },
      identifiers: { doi: "10.1007/s10814-020-09147-9", url: CAPTURES.green.url },
      license: { status: "open", spdx: "CC-BY-4.0" },
      lenses: ["archaeological"],
      note: "A review arguing that the evidence shows no ruling class. Its conclusion is one position in a debate.",
    },
    {
      op: "create_source",
      ref: "s_unesco_dho",
      kind: "webpage",
      tier: "tertiary",
      csl: { type: "webpage", title: "Dholavira: a Harappan City", "container-title": "UNESCO World Heritage Centre", issued: { "date-parts": [[2021]] }, URL: CAPTURES.unescoDho.url },
      identifiers: { url: CAPTURES.unescoDho.url },
      license: { status: "open", spdx: "CC-BY-SA-3.0-IGO" },
      note: "The World Heritage listing (2021): description and statement of Outstanding Universal Value.",
    },
    {
      op: "create_source",
      ref: "s_unesco_mjd",
      kind: "webpage",
      tier: "tertiary",
      csl: { type: "webpage", title: "Archaeological Ruins at Moenjodaro", "container-title": "UNESCO World Heritage Centre", issued: { "date-parts": [[1980]] }, URL: CAPTURES.unescoMjd.url },
      identifiers: { url: CAPTURES.unescoMjd.url },
      license: { status: "open", spdx: "CC-BY-SA-3.0-IGO" },
      note: "The World Heritage listing (1980). Its summary repeats some dated readings (“a college of priests”, “a large granary”), which are not used here.",
    },
    {
      op: "create_source",
      ref: "s_harappacom",
      kind: "webpage",
      tier: "tertiary",
      csl: { type: "webpage", title: "A Brief Introduction to the Ancient Indus Civilization", "container-title": "Harappa.com", URL: CAPTURES.harappacom.url, issued: { "date-parts": [[2026]] } },
      identifiers: { url: CAPTURES.harappacom.url },
      license: { status: "copyrighted", note: "© Harappa.com. Quoted briefly." },
      note: "An introduction on the site run with the Harappa Archaeological Research Project (J. M. Kenoyer, R. H. Meadow).",
    },
    wpSource("s_wp_ivc", "wpIvc"),
    wpSource("s_wp_meluhha", "wpMeluhha"),
    wpSource("s_wp_pyramid", "wpPyramid"),
    wpSource("s_wp_lothal", "wpLothal"),
    wpSource("s_wp_pashupati", "wpPashupati"),
  ];

  // ------------------------------------------------------------ excerpts
  for (const ex of EXCERPTS)
    ops.push({
      op: "create_excerpt",
      ref: ex.ref,
      source: `@${ex.source}`,
      snapshotId: s[ex.snap].id,
      quote: ex.quote,
      locator: ex.locator,
      ...(ex.note ? { note: ex.note } : {}),
    } as ChangeOpInput);

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
  const culture = e("culture");

  // 1. Discovery
  c("c_masson", {
    text: "The traveller Charles Masson visited Harappa in 1826 and described a large mound and ruined brick buildings; local tradition told of a great city destroyed by Providence for its king's crimes.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1826) },
    themes: ["sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harappa"), role: "place" }, { entity: e("masson"), role: "mention" }],
  });
  c("c_masson_sangala", {
    text: "Masson took the mounds of Harappa for Sangala, a town besieged by Alexander the Great; no one then knew that a far older civilisation lay beneath.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Masson's identification is his own; the Harappan city is about two thousand years older than Alexander.",
    themes: ["historiography"],
    entities: [{ entity: e("harappa"), role: "place" }, { entity: e("masson"), role: "mention" }],
  });
  c("c_bricks_railway", {
    text: "In the 19th century so many bricks were dug out of Harappa's mounds that, Alexander Cunningham wrote in 1875, they ballasted about 100 miles of the Lahore–Multan railway; Marshall later found the upper levels badly damaged.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1875) },
    themes: ["sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harappa"), role: "place" }, { entity: e("cunningham"), role: "mention" }],
    learning: { prompt: "Why are Harappa's upper levels so badly damaged?", answer: "In the 19th century its bricks were dug out in huge numbers, many as ballast for the Lahore–Multan railway." },
  });
  c("c_cunningham_seal", {
    text: "In 1875 Cunningham published a seal from Harappa with a humpless bull and six unknown signs; because the signs were not Indian letters and the bull had no hump, he concluded the seal was foreign to India.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1875) },
    themes: ["sources", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harappa"), role: "place" }, { entity: e("cunningham") }, { entity: e("script"), role: "mention" }],
  });
  c("c_excavations_begin", {
    text: "Excavation began at Harappa under Daya Ram Sahni in 1920–21 and at Mohenjo-daro under R. D. Banerji in 1921–22.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1920), end: ce(1922), basis: "Excavation seasons 1920–21 (Harappa) and 1921–22 (Mohenjo-daro)" },
    themes: ["sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("sahni") }, { entity: e("banerji") }, { entity: e("harappa"), role: "place" }, { entity: e("mohenjodaro"), role: "place" }],
    learning: { prompt: "Who began excavating Harappa and Mohenjo-daro, and when?", answer: "Daya Ram Sahni at Harappa (1920–21) and R. D. Banerji at Mohenjo-daro (1921–22)." },
  });
  c("c_marshall_same", {
    text: "In 1924 John Marshall compared the finds from the two sites, 400 miles apart, and saw at once that they belonged to the same culture and age, and to nothing previously known in India.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1924) },
    themes: ["sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall") }, { entity: e("harappa"), role: "place" }, { entity: e("mohenjodaro"), role: "place" }],
  });
  c("c_iln_1924", {
    text: "Marshall announced the discovery in the Illustrated London News on 20 September 1924, saying archaeologists seemed to be on the threshold of finding a long-forgotten civilisation in the plains of the Indus.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1924), basis: "Illustrated London News, 20 September 1924" },
    themes: ["sources", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall") }],
  });
  c("c_sumer_link", {
    text: "Readers of Marshall's article pointed out resemblances to Sumerian finds from Mesopotamia, which showed the Indus cities were roughly contemporary with Sumer, in the third millennium BCE.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1924) },
    themes: ["sources", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall"), role: "mention" }],
  });
  c("c_single_bound", {
    text: "Marshall wrote that the discovery took the story of civilisation in India back some 3,000 years, to people living in well-built cities in the third millennium BCE.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1926), basis: "Annual Report 1923–24, published 1926" },
    themes: ["historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall") }],
  });
  c("c_name_indus", {
    text: "Marshall first called the culture “Indo-Sumerian”; in his 1925–26 report he switched to “Indus”, because the old name implied a closer link with Sumer than the evidence justified.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1926) },
    themes: ["historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall") }, { entity: culture }],
  });
  c("c_dates", {
    text: "The Indus civilisation is usually dated c. 3300–1300 BCE, with its cities at their height in the Mature Harappan phase, c. 2600–1900 BCE.",
    kind: "fact",
    assessment: "well_supported",
    assessmentNote: "The outer dates (3300 and 1300 BCE) come from Wikipedia; the mature phase is given the same way by Rao et al. (2009) and, in years before present, by Singh et al. (2017). All phase boundaries are approximate.",
    when: { start: bce(3300), end: bce(1300), basis: "Conventional periodisation, from radiocarbon-dated phases" },
    themes: ["overview"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: culture }],
    foundVia: ["wpIvc"],
    learning: { prompt: "When did the Indus cities flourish?", answer: "In the Mature Harappan phase, about 2600–1900 BCE (the civilisation as a whole c. 3300–1300 BCE)." },
  });
  c("c_area", {
    text: "The remains of the Indus civilisation cover a larger area than ancient Egypt or Mesopotamia.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["overview"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }],
    foundVia: ["wpIvc"],
  });

  // 2. Cities
  c("c_mjd_grid", {
    text: "At Mohenjo-daro the buildings of the lower city are laid out along streets that cross at right angles, with drains and sanitation built into the plan.",
    kind: "fact",
    assessment: "supported",
    themes: ["infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: e("mohenjodaro"), role: "place" }],
    learning: { prompt: "What was unusual about the layout of Mohenjo-daro?", answer: "It was planned: streets crossing at right angles, with drains and sanitation built in." },
  });
  c("c_houses", {
    text: "Marshall found Mohenjo-daro's houses plain but well built, many with wells, bathrooms, brick floors and an elaborate system of drains.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1925) },
    themes: ["infrastructure", "society"],
    lenses: ["primary_source", "archaeological"],
    entities: [{ entity: e("mohenjodaro"), role: "place" }, { entity: e("marshall"), role: "mention" }],
  });
  c("c_great_bath", {
    text: "The Great Bath at Mohenjo-daro, excavated in 1925–26, is a brick tank about 39 by 23 feet and 8 feet deep, made watertight with fine brick, gypsum mortar and a backing of bitumen.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1926) },
    themes: ["infrastructure", "technology"],
    lenses: ["primary_source", "archaeological"],
    entities: [{ entity: e("greatbath") }, { entity: e("mohenjodaro"), role: "place" }],
    learning: { prompt: "How did the builders of the Great Bath make it watertight?", answer: "With fine brick, gypsum mortar and a backing of bitumen." },
  });
  c("c_dholavira", {
    text: "Dholavira, on an island in the salt flats of Kachchh, was occupied c. 3000–1500 BCE; it was built largely of stone, with fortifications and a system of reservoirs to store scarce water.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(3000), end: bce(1500) },
    themes: ["infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: e("dholavira"), role: "place" }],
  });
  c("c_dholavira_found", {
    text: "Dholavira was discovered in 1968 and excavated between 1989 and 2005.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1968) },
    themes: ["sources"],
    entities: [{ entity: e("dholavira"), role: "place" }],
  });
  c("c_sites", {
    text: "More than a thousand Mature Harappan sites are known, of which about a hundred have been excavated; only a handful were large cities.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Counts grow as surveys continue. Wikipedia names five major urban centres: Mohenjo-daro, Harappa, Ganweriwala, Dholavira and Rakhigarhi.",
    themes: ["overview", "infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }, { entity: e("ganweriwala"), role: "mention" }, { entity: e("rakhigarhi"), role: "mention" }],
    foundVia: ["wpIvc"],
  });
  c("c_population", {
    text: "Harappa and Mohenjo-daro may each have held some tens of thousands of people at their height; estimates run from about 30,000 to 60,000.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Estimates, not counts. Harappa.com gives about 50,000 for Harappa at certain periods; Wikipedia gives 30,000–60,000 for each city.",
    themes: ["society"],
    lenses: ["archaeological"],
    entities: [{ entity: e("harappa"), role: "place" }, { entity: e("mohenjodaro"), role: "place" }],
    foundVia: ["wpIvc"],
  });
  c("c_lothal_dock", {
    text: "The Archaeological Survey of India interpreted a large brick basin at Lothal as a dock, linked to an old course of the Sabarmati river, and one of the earliest known.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["economy", "infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: e("lothal"), role: "place" }],
    foundVia: ["wpLothal"],
  });
  c("c_lothal_tank", {
    text: "Other archaeologists argue that the Lothal basin was mainly an irrigation tank, and that Lothal was a fairly small town.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["economy", "infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: e("lothal"), role: "place" }],
    foundVia: ["wpLothal"],
  });

  // 3. Script
  c("c_script_undeciphered", {
    text: "The Indus script has not been deciphered. There have been many claimed decipherments, more than a hundred by one count, but none is widely accepted.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["culture", "sources"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("script") }],
    learning: { prompt: "Has the Indus script been deciphered?", answer: "No. There have been many claimed decipherments, more than a hundred by one count, but none is widely accepted." },
  });
  c("c_script_obstacles", {
    text: "Three things make decipherment so hard: no bilingual inscription has been found, the inscriptions are very short (about five signs on average), and the language they might write is unknown.",
    kind: "fact",
    assessment: "supported",
    themes: ["culture", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("script") }],
    learning: { prompt: "Name two reasons the script is so hard to decipher.", answer: "No bilingual inscription has been found; the inscriptions are very short (about five signs); the language is unknown." },
  });
  c("c_script_corpus", {
    text: "More than 3,800 Indus inscriptions are known, on seals, sealings, amulets, small tablets and pottery.",
    kind: "fact",
    assessment: "supported",
    themes: ["culture", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("script") }],
  });
  c("c_marshall_script", {
    text: "From the start the script was a puzzle: in 1924 Marshall saw no likeness to any ancient Indian alphabet and no way to tell whether its signs stood for words or sounds; in 1925 he wrote that it had yet to be deciphered.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1924), end: ce(1925) },
    themes: ["historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall"), role: "mention" }, { entity: e("script") }],
  });
  c("c_fsw", {
    text: "Farmer, Sproat and Witzel (2004) argued that the Indus signs were not writing at all, but a system of religious and political symbols that did not record speech.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: ce(2004) },
    themes: ["culture", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("script") }],
  });
  c("c_rao", {
    text: "Rao and colleagues (2009) found statistical structure in sign sequences that they judged typical of a writing system for a language rather than of non-linguistic symbols.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: ce(2009) },
    themes: ["culture", "historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("script") }],
  });

  // 4. Trade
  c("c_sargon_meluhha", {
    text: "Sargon of Akkad (reigned c. 2334–2279 BCE) boasted in an inscription that ships of Meluhha, Magan and Dilmun moored at the quay of his capital, Agade.",
    kind: "fact",
    assessment: "well_supported",
    assessmentNote: "The words are from Barton's translation (1929); the reign dates are a conventional chronology, from Wikipedia.",
    when: { start: bce(2334), end: bce(2279), basis: "Sargon's reign, conventional chronology" },
    themes: ["economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("sargon") }, { entity: e("meluhha"), role: "place" }, { entity: e("magan"), role: "place" }, { entity: e("dilmun"), role: "place" }, { entity: e("akkad"), role: "mention" }],
    foundVia: ["wpMeluhha"],
    learning: { prompt: "What did Sargon of Akkad say about Meluhha?", answer: "That ships of Meluhha (with those of Magan and Dilmun) moored at the quay of Agade." },
  });
  c("c_gudea_meluhha", {
    text: "Gudea, ruler of Lagash in Sumer (c. 21st century BCE), recorded gold dust, wood and porphyry brought from Meluhha for his temple, and tribute from Magan, Meluhha and Dilmun.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: bce(2100), basis: "Gudea's rule, c. 21st century BCE (Wikipedia, Meluhha)" },
    themes: ["economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("gudea") }, { entity: e("meluhha"), role: "place" }],
    foundVia: ["wpMeluhha"],
  });
  c("c_meluhha_id", {
    text: "Most scholars identify Meluhha, a seafaring land of the Mesopotamian texts, with the Indus civilisation, though the identification is not proven.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Supported here only by tertiary sources (Wikipedia, Harappa.com). The identification rests on Indus objects found in Mesopotamia and on the goods the texts list.",
    themes: ["economy"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("meluhha") }, { entity: culture }],
    foundVia: ["wpMeluhha"],
    learning: { prompt: "What was Meluhha?", answer: "A seafaring land of the Mesopotamian texts, which most scholars identify with the Indus civilisation, though this is not proven." },
  });
  c("c_magan_dilmun", {
    text: "Magan, named with Meluhha, is placed in today's Oman and United Arab Emirates, and Dilmun in Bahrain and the nearby Gulf coast.",
    kind: "fact",
    assessment: "supported",
    themes: ["economy"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("magan") }, { entity: e("dilmun") }],
    foundVia: ["wpMeluhha"],
  });
  c("c_objects_mesopotamia", {
    text: "Indus objects, including seals with Indus signs, have been found at sites in Mesopotamia and elsewhere in West Asia.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["economy"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }, { entity: e("script"), role: "mention" }],
  });
  c("c_sea_trade_1926", {
    text: "By 1926 Marshall held it all but certain that Sind and Sumer were in close contact, by sea rather than by land, though he thought the Great Bath's bitumen more likely came from nearer sources.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1926) },
    themes: ["economy", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall") }, { entity: e("greatbath"), role: "mention" }],
  });
  c("c_wheeler_akkad", {
    text: "Wheeler stressed in 1947 that Indus objects on Akkadian sites gave the only firm dates for the civilisation, and suggested its trade peaked around the time of Sargon.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Radiocarbon dating, unavailable in 1947, has since given independent dates.",
    when: { start: ce(1947) },
    themes: ["economy", "historiography"],
    lenses: ["archaeological"],
    entities: [{ entity: e("wheeler") }, { entity: e("akkad"), role: "mention" }],
  });
  c("c_dholavira_trade", {
    text: "Finds at Dholavira show trade with other Harappan cities and with Mesopotamia and the Oman peninsula.",
    kind: "fact",
    assessment: "supported",
    themes: ["economy"],
    lenses: ["archaeological"],
    entities: [{ entity: e("dholavira"), role: "place" }, { entity: e("magan"), role: "mention" }],
  });

  // 5. Daily life and crafts
  c("c_crafts", {
    text: "Marshall found that the people of Mohenjo-daro worked copper, gold, silver and lead and made polished gold jewellery and glazed faience, while still using simple stone blades every day.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1925) },
    themes: ["technology", "society"],
    lenses: ["primary_source", "archaeological"],
    entities: [{ entity: e("mohenjodaro"), role: "place" }],
  });
  c("c_seal_animals", {
    text: "The seals found by 1924 showed bulls and “unicorns” but no humped bull; a season later a seal with a humped (“Brahmani”) bull was found, along with tigers, elephants and rhinoceroses on others.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1924), end: ce(1925) },
    themes: ["culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mohenjodaro"), role: "place" }],
  });
  c("c_no_horse", {
    text: "In 1925 Marshall noted that the horse did not appear on the seals, and supposed it was brought to India later by the Aryans.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Marshall's view in 1925. Whether horses were known to the Harappans is argued over; this page does not source that debate yet.",
    when: { start: ce(1925) },
    themes: ["culture", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall"), role: "mention" }],
  });
  c("c_standard", {
    text: "Cities hundreds of miles apart used the same brick sizes and a standard system of weights, kept over centuries.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["economy", "technology"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }, { entity: e("harappa"), role: "place" }, { entity: e("mohenjodaro"), role: "place" }, { entity: e("dholavira"), role: "place" }],
    learning: { prompt: "What was the same in cities far apart, such as Harappa and Mohenjo-daro?", answer: "Brick sizes, and a standard system of weights kept for centuries." },
  });
  c("c_beads", {
    text: "Dholavira had bead workshops, and its finds include objects of copper, shell, semi-precious stones, gold and ivory.",
    kind: "fact",
    assessment: "supported",
    themes: ["technology", "economy"],
    lenses: ["archaeological"],
    entities: [{ entity: e("dholavira"), role: "place" }],
  });
  c("c_no_palaces", {
    text: "No palaces, rich royal tombs or monuments to rulers have been found in the Indus cities, and grave goods vary little.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "An absence of evidence after a century of digging. What it means for how the cities were governed is debated (see “Often said”).",
    themes: ["polity", "society"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }],
  });

  // 6. Religion
  c("c_tablet_deity", {
    text: "In 1925 Marshall described a faience tablet showing a cross-legged seated figure with kneeling worshippers and snakes, and judged it more likely a god than a king.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Marshall's reading. Without texts, who such a figure was cannot be checked.",
    when: { start: ce(1925) },
    themes: ["religion"],
    lenses: ["primary_source", "colonial_orientalist"],
    entities: [{ entity: e("marshall"), role: "mention" }, { entity: e("mohenjodaro"), role: "place" }],
  });
  c("c_bath_religion", {
    text: "Marshall wrote that the Great Bath's purpose “can only be surmised”; he thought it most likely connected with religion, like the sacred tanks of later Indian temples.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "A guess by analogy with much later practice, which Marshall presented as such.",
    when: { start: ce(1926) },
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("greatbath") }, { entity: e("marshall"), role: "mention" }],
  });
  c("c_protoshiva", {
    text: "Marshall identified the horned figure on the so-called Pashupati seal with the god Shiva, and concluded that Shiva's cult went back to the Indus period, “the oldest living cult in the world”.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: ce(1929), basis: "Annual Report 1928–29 (published 1933)" },
    themes: ["religion", "historiography"],
    lenses: ["primary_source", "colonial_orientalist"],
    entities: [{ entity: e("pashupati") }, { entity: e("marshall") }],
    foundVia: ["wpPashupati"],
    learning: { prompt: "Whom did Marshall see in the horned figure on the so-called Pashupati seal?", answer: "The god Shiva: he concluded that Shiva's cult went back to the Indus period." },
  });
  c("c_protoshiva_doubt", {
    text: "Later scholars have disputed Marshall's reading: Doris Srinivasan, for example, saw the “extra faces” as ears and the face as bovine, and others urge that the figure's meaning cannot be known without texts.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Sourced here only through Wikipedia, which summarises the published debate.",
    themes: ["religion", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("pashupati") }],
    foundVia: ["wpPashupati"],
  });

  // 7. The end of the cities
  c("c_decline", {
    text: "From about 1900 BCE the Indus cities shrank and many sites were abandoned, while the number of settlements grew further east.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: bce(1900), basis: "About 3,900 years before present (Giosan et al. 2012); 3.9 ka (Chatterjee et al. 2019)" },
    themes: ["society"],
    lenses: ["archaeological", "mainstream_academic"],
    entities: [{ entity: culture }],
    learning: { prompt: "Roughly when did the Indus cities decline?", answer: "From about 1900 BCE: the cities shrank and many sites were abandoned, while settlements grew in number further east." },
  });
  c("c_mjd_abandoned", {
    text: "Mohenjo-daro was not rebuilt after its abandonment; the next building on its highest mound was a Buddhist stupa, nearly two thousand years later.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["society"],
    lenses: ["archaeological"],
    entities: [{ entity: e("mohenjodaro"), role: "place" }],
  });
  c("c_climate", {
    text: "Giosan and colleagues (2012) argue that a weakening monsoon slowly dried the rivers, made farming harder, and pushed people towards smaller settlements in moister regions to the east.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(2012) },
    themes: ["society", "economy"],
    lenses: ["archaeological", "mainstream_academic"],
    entities: [{ entity: culture }],
  });
  c("c_marshall_aryans", {
    text: "As early as 1925 Marshall suggested that the Indus people were the pre-Aryan “Dasyus” of the Vedas, whose culture invading Aryans had largely destroyed.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "A suggestion made within a year of the discovery, from the Vedic hymns rather than from the excavations.",
    when: { start: ce(1925) },
    themes: ["historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("marshall") }],
  });
  c("c_wheeler_indra", {
    text: "In 1947 Mortimer Wheeler argued that the civilisation was finally destroyed deliberately, by Aryan invaders; pointing to skeletons at Mohenjo-daro, he wrote “Indra stands accused”.",
    kind: "interpretation",
    assessment: "refuted",
    assessmentNote: "Wheeler himself allowed that Indra's citadels might be other sites. Dales (1964) showed the skeletons do not make a massacre, and no destruction layer has been found.",
    when: { start: ce(1947) },
    themes: ["historiography", "war"],
    lenses: ["archaeological", "colonial_orientalist"],
    entities: [{ entity: e("wheeler") }, { entity: e("mohenjodaro"), role: "place" }],
    learning: { prompt: "Who wrote that “Indra stands accused”, and of what?", answer: "Mortimer Wheeler, in 1947: he argued that Aryan invaders deliberately destroyed the civilisation, pointing to skeletons at Mohenjo-daro." },
  });
  c("c_wheeler_hedge", {
    text: "Wheeler admitted in the same article that the forts Indra destroys in the Rigveda might be other, unknown sites rather than the Harappan cities.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1947) },
    themes: ["historiography"],
    lenses: ["archaeological"],
    entities: [{ entity: e("wheeler") }],
  });
  c("c_dales_skeletons", {
    text: "Re-examining the “massacre” in 1964, George Dales found that nine years of digging at Mohenjo-daro had produced only about 37 skeletons of the Indus period, from different times, and none in the citadel.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1964) },
    themes: ["historiography", "war"],
    lenses: ["archaeological"],
    entities: [{ entity: e("dales") }, { entity: e("mohenjodaro"), role: "place" }],
  });
  c("c_no_destruction", {
    text: "There is no destruction layer over the latest city at Mohenjo-daro: no widespread burning, no weapons or armour of battle, no sign of a last defence.",
    kind: "fact",
    assessment: "supported",
    themes: ["war"],
    lenses: ["archaeological"],
    entities: [{ entity: e("mohenjodaro"), role: "place" }],
    learning: { prompt: "What evidence would an invasion have left at Mohenjo-daro, and is it there?", answer: "A destruction layer, burning, weapons, signs of a last defence. There are none." },
  });
  c("c_dales_floods", {
    text: "Dales himself proposed in 1964 that a rise of the coastline caused floods and salty soils that drove people away.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "One of several natural explanations of its time; this page does not source its later reception.",
    when: { start: ce(1964) },
    themes: ["society"],
    lenses: ["archaeological"],
    entities: [{ entity: e("dales") }],
  });

  // The river
  c("c_rv_sarasvati", {
    text: "The Rigveda praises the river Sarasvatī as a great stream, flowing “from mountains to the ocean” and surpassing all other waters.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "A statement about the text, in Griffith's 1897 translation. The hymn is usually dated after the Indus cities.",
    themes: ["religion", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("ghaggar"), role: "mention" }],
  });
  c("c_oldham", {
    text: "In 1893, before the Indus civilisation was known, C. F. Oldham argued that the dry Hakra channel continued the Sarasvatī and was once the bed of the Sutlej.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1893) },
    themes: ["historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("ghaggar") }],
  });
  c("c_ghaggar_sites", {
    text: "Many Harappan settlements lie along the Ghaggar-Hakra, a river that is seasonal or dry for most of its length today.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: e("ghaggar"), role: "place" }, { entity: e("kalibangan"), role: "mention" }],
  });
  c("c_giosan_monsoon", {
    text: "Giosan and colleagues (2012) found that only monsoon-fed rivers flowed in the Ghaggar-Hakra region in the last 10,000 years, not a large glacier-fed Himalayan river.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: ce(2012) },
    themes: ["infrastructure"],
    lenses: ["archaeological", "mainstream_academic"],
    entities: [{ entity: e("ghaggar") }],
  });
  c("c_singh_sutlej", {
    text: "Singh and colleagues (2017) found that the palaeochannel is an old course of the Sutlej, abandoned around 8,000 years ago, so the Indus towns grew up along a valley the river had already left.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(2017) },
    themes: ["infrastructure"],
    lenses: ["archaeological", "mainstream_academic"],
    entities: [{ entity: e("ghaggar") }, { entity: e("kalibangan"), role: "mention" }],
  });
  c("c_chatterjee", {
    text: "Chatterjee and colleagues (2019) argue that the Ghaggar was a perennial, Himalaya-fed river from about 9,000 to 4,500 years ago, which they correlate with the Sarasvatī; but by the time the civilisation matured it had lost its glacial source.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: ce(2019) },
    themes: ["infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: e("ghaggar") }],
  });

  // 8. What continued
  c("c_deurban", {
    text: "As the cities emptied, writing, seals, standard weights, long-distance trade and large public buildings disappeared, but small settlements carried on and even multiplied in north-west India.",
    kind: "fact",
    assessment: "supported",
    themes: ["society", "economy"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }],
    learning: { prompt: "What disappeared as the cities emptied, and what carried on?", answer: "Writing, seals, standard weights, long-distance trade and large public buildings went; small settlements carried on and even multiplied." },
  });
  c("c_east_south", {
    text: "People moved east, into the upper Punjab, Haryana and Uttar Pradesh, and, Dales argued, south-east into Gujarat's Kathiawar peninsula, where Harappan ways merged with local cultures.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["society"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }],
  });
  c("c_harappa_living", {
    text: "Harappa was settled before the Indus cities flourished and is still a living town.",
    kind: "fact",
    assessment: "supported",
    themes: ["society"],
    entities: [{ entity: e("harappa"), role: "place" }],
  });
  c("c_dna", {
    text: "The first ancient genome from an Indus city, from Rakhigarhi (2019), had ancestry with little or no contribution from steppe herders, of a kind that, the authors argue, was a main ancestor of later South Asians.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "One genome. The authors themselves say a single sample cannot characterise a whole civilisation.",
    when: { start: ce(2019) },
    themes: ["society"],
    lenses: ["genetic"],
    entities: [{ entity: e("rakhigarhi"), role: "place" }],
  });

  // 9. How we know
  c("c_no_texts", {
    text: "No historical texts about the Indus civilisation exist, from inside or outside it, beyond a few Mesopotamian mentions of Meluhha; almost everything known comes from archaeology.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: culture }],
  });
  c("c_aerial", {
    text: "In 1924–25 an experimental aeroplane survey along an old bed of the Ravi near Harappa revealed previously unknown sites.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1925) },
    themes: ["sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("harappa"), role: "place" }],
  });
  c("c_records", {
    text: "The early excavations were poorly recorded and partly unpublished: whole blocks of Mohenjo-daro dug in the 1920s were not published until the 1980s.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["sources"],
    lenses: ["archaeological"],
    entities: [{ entity: e("mohenjodaro"), role: "place" }],
  });
  c("c_dna_caution", {
    text: "The authors of the Rakhigarhi genome study caution that one sample, or even twelve related ones, cannot fully characterise a cosmopolitan civilisation.",
    kind: "fact",
    assessment: "supported",
    themes: ["sources"],
    lenses: ["genetic"],
    entities: [{ entity: e("rakhigarhi"), role: "place" }],
  });

  // Rulers, the Priest-King
  c("c_state_views", {
    text: "Archaeologists disagree on how the Indus civilisation was governed: some have called it an empire, some stateless, some a state led by merchant elites.",
    kind: "debate",
    assessment: "contested",
    themes: ["polity"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }],
  });
  c("c_green_egalitarian", {
    text: "Adam Green (2021) argues that, with no palaces, royal tombs or monuments to rulers after a century of digging, the Indus cities may have been governed without a ruling class.",
    kind: "interpretation",
    assessment: "contested",
    when: { start: ce(2021) },
    themes: ["polity", "society"],
    lenses: ["archaeological"],
    entities: [{ entity: culture }],
  });
  c("c_wheeler_priestkings", {
    text: "Mortimer Wheeler pictured the Indus civilisation as a uniform, conservative military state ruled by “priest-kings”.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "Green (2021) treats this as an assumption carried over from Mesopotamia, not a finding.",
    themes: ["polity", "historiography"],
    lenses: ["archaeological", "colonial_orientalist"],
    entities: [{ entity: e("wheeler") }],
  });
  c("c_priestking_name", {
    text: "“Priest-King” is the excavators' nickname for a 17.5 cm stone bust from Mohenjo-daro; no inscription names him, and some now read the statue as evidence of contact with neighbouring peoples rather than of a ruling elite.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "culture"],
    lenses: ["archaeological"],
    entities: [{ entity: e("priestking") }, { entity: e("mohenjodaro"), role: "place" }],
    learning: { prompt: "What is the “Priest-King”, and how do some now read it?", answer: "The common name for a 17.5 cm statuette from Mohenjo-daro; some now read it as evidence of contact with neighbouring peoples rather than of a ruling elite." },
  });

  // Meanwhile
  c("c_marshall_nile", {
    text: "Marshall argued in 1924 that the civilisation grew up in the Indus valley itself, as distinctive of it as the Pharaohs' civilisation was of the Nile.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1926), basis: "Annual Report 1923–24, published 1926" },
    themes: ["historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("marshall") }, { entity: e("oldkingdom"), role: "mention" }],
  });
  c("c_pyramid", {
    text: "In Egypt, the Great Pyramid of Giza was built c. 2600 BCE for the pharaoh Khufu of the Old Kingdom, about when the Indus cities reached their mature phase.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Dates from Wikipedia; the comparison of dates is ours.",
    when: { start: bce(2600) },
    themes: ["overview"],
    entities: [{ entity: e("oldkingdom") }],
    foundVia: ["wpPyramid"],
  });

  // Misconceptions
  c("m_aryan", {
    text: "The Indus cities were destroyed by an Aryan invasion, and the skeletons at Mohenjo-daro are its victims.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "No destruction layer, no weapons of battle, and the skeletons come from different periods (Dales 1964). The cities declined gradually over centuries.",
    themes: ["war", "historiography"],
    lenses: ["popular", "colonial_orientalist"],
    entities: [{ entity: culture }, { entity: e("mohenjodaro"), role: "place" }],
  });
  c("m_deciphered", {
    text: "The Indus script has been deciphered.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "Claims of decipherment appear regularly; none has been accepted. Without a bilingual inscription and with such short texts, no reading can be tested.",
    themes: ["culture"],
    lenses: ["popular"],
    entities: [{ entity: e("script") }],
  });
  c("m_one_empire", {
    text: "The Indus civilisation was a single empire, ruled by a king from a capital city.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "There is no evidence of a king, a palace or a capital. Whether it was one state, several, or none is debated; borders drawn on maps, including the one on this page, are a reconstruction of a culture area, not of a state.",
    themes: ["polity"],
    lenses: ["popular"],
    entities: [{ entity: culture }],
  });
  c("m_priestking", {
    text: "The “Priest-King” statue is a portrait of a priest-king who ruled Mohenjo-daro.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "The name is the excavators' guess, made by analogy with Mesopotamia. Nothing identifies the man or his role.",
    themes: ["polity", "culture"],
    lenses: ["popular"],
    entities: [{ entity: e("priestking") }],
  });
  c("m_sudden", {
    text: "The Indus civilisation collapsed suddenly.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "The cities emptied over centuries as rivers dried and people moved to smaller settlements; village life carried on.",
    themes: ["society"],
    lenses: ["popular"],
    entities: [{ entity: culture }],
  });

  // ------------------------------------------------------------ citations
  const cite = (claim: string, excerpt: string, stance: "supports" | "contradicts" | "qualifies" | "mentions" = "supports", note?: string) =>
    ops.push({ op: "cite", claim: `@${claim}`, excerpt: `@${excerpt}`, stance, ...(note ? { note } : {}) });
  cite("c_masson", "x_masson_mound");
  cite("c_masson", "x_masson_city");
  cite("c_masson", "x_cun_1826", "supports", "The year of the visit, from Cunningham.");
  cite("c_masson_sangala", "x_masson_sangala");
  cite("c_bricks_railway", "x_cun_ballast");
  cite("c_bricks_railway", "x_asi25_railway");
  cite("c_cunningham_seal", "x_cun_seal");
  cite("c_excavations_begin", "x_asi24_sahni");
  cite("c_excavations_begin", "x_asi24_banerji");
  cite("c_marshall_same", "x_asi24_same");
  cite("c_iln_1924", "x_iln_threshold");
  cite("c_sumer_link", "x_asi24_sayce");
  cite("c_sumer_link", "x_asi24_contemporary");
  cite("c_single_bound", "x_asi24_bound");
  cite("c_name_indus", "x_asi26_name");
  cite("c_dates", "x_wp_dates");
  cite("c_dates", "x_rao_dates", "supports", "The mature phase.");
  cite("c_dates", "x_singh_dates", "supports", "The urban phase, in thousands of years before present.");
  cite("c_area", "x_dales_area");
  cite("c_area", "x_wp_area");
  cite("c_mjd_grid", "x_unesco_grid");
  cite("c_houses", "x_asi25_houses");
  cite("c_great_bath", "x_asi26_tank");
  cite("c_great_bath", "x_asi26_bitumen");
  cite("c_dholavira", "x_unesco_dho");
  cite("c_dholavira", "x_unesco_dho_water");
  cite("c_dholavira", "x_unesco_dho_stone");
  cite("c_dholavira_found", "x_unesco_dho_found");
  cite("c_sites", "x_wp_sites");
  cite("c_sites", "x_unesco_dho_count");
  cite("c_population", "x_hc_population");
  cite("c_population", "x_wp_population");
  cite("c_lothal_dock", "x_wp_lothal_dock");
  cite("c_lothal_tank", "x_wp_lothal_tank");
  cite("c_script_undeciphered", "x_rao_undeciphered");
  cite("c_script_undeciphered", "x_rao_60");
  cite("c_script_undeciphered", "x_fsw_hundred");
  cite("c_script_undeciphered", "x_hc_script");
  cite("c_script_obstacles", "x_rao_obstacles");
  cite("c_script_corpus", "x_rao_corpus");
  cite("c_marshall_script", "x_iln_alphabet");
  cite("c_marshall_script", "x_asi24_script");
  cite("c_marshall_script", "x_asi25_script");
  cite("c_fsw", "x_fsw_claim");
  cite("c_rao", "x_rao_linguistic");
  cite("c_sargon_meluhha", "x_barton_sargon");
  cite("c_sargon_meluhha", "x_wp_sargon");
  cite("c_gudea_meluhha", "x_barton_gudea_b");
  cite("c_gudea_meluhha", "x_barton_gudea_cyl");
  cite("c_gudea_meluhha", "x_barton_gudea_d");
  cite("c_gudea_meluhha", "x_wp_gudea");
  cite("c_meluhha_id", "x_wp_meluhha_id");
  cite("c_meluhha_id", "x_hc_meluhha");
  cite("c_magan_dilmun", "x_wp_magan");
  cite("c_magan_dilmun", "x_wp_dilmun");
  cite("c_objects_mesopotamia", "x_hc_objects");
  cite("c_objects_mesopotamia", "x_rao_seals_wa");
  cite("c_objects_mesopotamia", "x_wheeler_akkad");
  cite("c_sea_trade_1926", "x_asi26_sea");
  cite("c_sea_trade_1926", "x_asi26_bitumen_local");
  cite("c_wheeler_akkad", "x_wheeler_akkad");
  cite("c_wheeler_akkad", "x_wheeler_fixed");
  cite("c_dholavira_trade", "x_unesco_dho_trade");
  cite("c_crafts", "x_asi25_crafts");
  cite("c_crafts", "x_asi25_stone");
  cite("c_seal_animals", "x_iln_unicorns");
  cite("c_seal_animals", "x_asi25_brahmani");
  cite("c_seal_animals", "x_asi25_horse");
  cite("c_no_horse", "x_asi25_horse");
  cite("c_standard", "x_hc_standard");
  cite("c_standard", "x_green_weights");
  cite("c_beads", "x_unesco_dho_beads");
  cite("c_no_palaces", "x_green_nopalaces");
  cite("c_tablet_deity", "x_asi25_tablet");
  cite("c_bath_religion", "x_asi26_purpose");
  cite("c_bath_religion", "x_asi26_religion");
  cite("c_protoshiva", "x_asi29_siva");
  cite("c_protoshiva", "x_asi29_oldest");
  cite("c_protoshiva", "x_wp_pashupati_claim");
  cite("c_protoshiva_doubt", "x_wp_pashupati_srinivasan");
  cite("c_protoshiva_doubt", "x_wp_pashupati_doubt");
  cite("c_decline", "x_giosan_decline");
  cite("c_decline", "x_chatterjee_decline");
  cite("c_mjd_abandoned", "x_asi25_abandoned");
  cite("c_mjd_abandoned", "x_unesco_stupa");
  cite("c_climate", "x_giosan_gradual");
  cite("c_climate", "x_giosan_cause");
  cite("c_marshall_aryans", "x_asi25_aryans");
  cite("c_wheeler_indra", "x_wheeler_destruction");
  cite("c_wheeler_indra", "x_wheeler_indra");
  cite("c_wheeler_indra", "x_dales_wheeler");
  cite("c_wheeler_hedge", "x_wheeler_hedge");
  cite("c_dales_skeletons", "x_dales_37");
  cite("c_dales_skeletons", "x_dales_citadel");
  cite("c_no_destruction", "x_dales_nodestruction");
  cite("c_no_destruction", "x_dales_where");
  cite("c_dales_floods", "x_dales_floods");
  cite("c_rv_sarasvati", "x_rv_sarasvati");
  cite("c_rv_sarasvati", "x_rv_might");
  cite("c_oldham", "x_oldham_course");
  cite("c_oldham", "x_oldham_sutlej");
  cite("c_ghaggar_sites", "x_chatterjee_settlements");
  cite("c_ghaggar_sites", "x_singh_sutlej");
  cite("c_giosan_monsoon", "x_giosan_sarasvati");
  cite("c_singh_sutlej", "x_singh_sutlej");
  cite("c_chatterjee", "x_chatterjee_perennial");
  cite("c_chatterjee", "x_chatterjee_saraswati");
  cite("c_chatterjee", "x_chatterjee_lost");
  cite("c_deurban", "x_green_deurban");
  cite("c_east_south", "x_giosan_cause");
  cite("c_east_south", "x_dales_shift");
  cite("c_harappa_living", "x_hc_living");
  cite("c_dna", "x_shinde_impact");
  cite("c_dna", "x_shinde_caution", "qualifies");
  cite("c_no_texts", "x_rao_nohistory");
  cite("c_no_texts", "x_barton_sargon", "qualifies", "The Mesopotamian mentions of Meluhha are the exception.");
  cite("c_aerial", "x_asi25_aerial");
  cite("c_records", "x_dales_methods");
  cite("c_records", "x_green_unpublished");
  cite("c_dna_caution", "x_shinde_caution");
  cite("c_state_views", "x_green_views");
  cite("c_green_egalitarian", "x_green_nopalaces");
  cite("c_wheeler_priestkings", "x_green_wheeler");
  cite("c_priestking_name", "x_green_priestking");
  cite("c_marshall_nile", "x_asi24_nile");
  cite("c_pyramid", "x_wp_pyramid");
  cite("c_pyramid", "x_wp_khufu");
  cite("m_aryan", "x_asi25_aryans", "mentions", "Marshall's suggestion of 1925, an early source of the belief.");
  cite("m_aryan", "x_wheeler_indra", "mentions", "Wheeler's “Indra stands accused” (1947), its best-known statement.");
  cite("m_aryan", "x_dales_nodestruction", "contradicts");
  cite("m_aryan", "x_dales_37", "contradicts");
  cite("m_deciphered", "x_rao_undeciphered", "contradicts");
  cite("m_deciphered", "x_rao_60", "contradicts");
  cite("m_one_empire", "x_green_views", "contradicts", "Scholars disagree; none has shown a single empire.");
  cite("m_one_empire", "x_green_nopalaces", "contradicts");
  cite("m_priestking", "x_green_priestking", "contradicts");
  cite("m_sudden", "x_giosan_gradual", "contradicts");
  cite("m_sudden", "x_green_deurban", "contradicts");

  // ------------------------------------------------------------ relations
  const rel = (from: string, to: string, type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", note?: string) =>
    ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) });
  rel("c_no_destruction", "m_aryan", "corrects");
  rel("c_dales_skeletons", "m_aryan", "corrects");
  rel("c_decline", "m_aryan", "corrects", "The cities declined gradually.");
  rel("c_marshall_aryans", "m_aryan", "context_for", "An early source of the belief.");
  rel("c_wheeler_indra", "m_aryan", "context_for", "Its best-known statement.");
  rel("c_script_undeciphered", "m_deciphered", "corrects");
  rel("c_script_obstacles", "m_deciphered", "corrects");
  rel("c_no_palaces", "m_one_empire", "corrects");
  rel("c_state_views", "m_one_empire", "qualifies");
  rel("c_priestking_name", "m_priestking", "corrects");
  rel("c_wheeler_priestkings", "m_priestking", "context_for");
  rel("c_decline", "m_sudden", "corrects");
  rel("c_climate", "m_sudden", "corrects");
  rel("c_deurban", "m_sudden", "corrects");
  rel("c_dales_skeletons", "c_wheeler_indra", "contradicts");
  rel("c_no_destruction", "c_wheeler_indra", "contradicts");
  rel("c_wheeler_hedge", "c_wheeler_indra", "qualifies");
  rel("c_fsw", "c_rao", "contradicts");
  rel("c_giosan_monsoon", "c_chatterjee", "contradicts");
  rel("c_singh_sutlej", "c_chatterjee", "qualifies", "Both find a Sutlej source; they differ on when it was lost.");
  rel("c_oldham", "c_rv_sarasvati", "context_for");
  rel("c_protoshiva_doubt", "c_protoshiva", "contradicts");
  rel("c_lothal_tank", "c_lothal_dock", "contradicts");
  rel("c_green_egalitarian", "c_wheeler_priestkings", "contradicts");
  rel("c_seal_animals", "c_cunningham_seal", "context_for", "The humped bull turned up after all.");
  rel("c_dna_caution", "c_dna", "qualifies");

  return ops;
}

// ---------------------------------------------------------------- page

export const PAGE_SLUG = "indus-civilisation";

export function indusPage(E: Record<string, string>): ChangeOpInput {
  const e = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const C = (ref: string, text: string) => `[${text}](claim:@${ref})`;
  const N = (ref: string, text: string) => `[${text}](entity:${E[ref] ?? ref})`;
  const people = (...refs: string[]) => refs.map(e);

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown: [
        `Nearly five thousand years ago, people in the valley of the ${N("indus", "Indus")} and its neighbouring rivers built some of the world's first cities. ${C("c_area", "Their remains cover a larger area than ancient Egypt or Mesopotamia")}. ${C("c_mjd_grid", "Their streets were laid out on a plan")}, their houses had drains, and ${C("c_standard", "cities hundreds of miles apart used the same bricks and weights")}. ${C("c_dates", "The cities flourished from about 2600 to 1900 BCE")}.`,
        `Yet we do not know what these people called themselves, what language they spoke, or who ruled them, if anyone did. ${C("c_script_undeciphered", "Their writing has never been deciphered")}, and ${C("c_no_texts", "almost everything we know comes from archaeology")}. So this page is also a story about evidence: what was dug up, what the excavators thought it meant, and which of their ideas still stand.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("mohenjodaro"), text: `The “Mound of the Dead”. ${C("c_mjd_grid", "A planned city of straight streets and covered drains")}.`, target: "ch-cities", targetLabel: "Cities on a plan" },
        { entity: e("greatbath"), text: `${C("c_great_bath", "A watertight brick tank")} at the heart of Mohenjo-daro. ${C("c_bath_religion", "What it was for can only be guessed")}.`, target: "ch-cities", targetLabel: "Cities on a plan" },
        { entity: e("script"), text: `Short rows of signs on seals. ${C("c_script_undeciphered", "No one can read them")}.`, target: "ch-script", targetLabel: "Writing no one can read" },
        { entity: e("priestking"), text: `A famous bearded bust. ${C("c_priestking_name", "The name is a nickname")}; we do not know who he was.`, target: "ch-often", targetLabel: "Often said" },
        { entity: e("pashupati"), text: `A horned figure among animals. ${C("c_protoshiva", "Marshall saw an early Shiva")}; ${C("c_protoshiva_doubt", "others disagree")}.`, target: "ch-religion", targetLabel: "Gods and rituals" },
        { entity: e("ghaggar"), text: `A dry river that some identify with the Rigveda's Sarasvatī. ${C("c_giosan_monsoon", "Geologists disagree about what it was")}.`, target: "ch-end", targetLabel: "Why the cities emptied" },
      ],
    },
    {
      id: "meanwhile",
      type: "meanwhile",
      title: "Meanwhile, in Mesopotamia, the Gulf and Egypt",
      items: [
        { region: "Mesopotamia (Akkad)", label: "Sargon of Akkad, c. 2334–2279 BCE: ships of Meluhha moor at his capital", entity: e("sargon"), claimIds: ["@c_sargon_meluhha", "@c_meluhha_id"] },
        { region: "Mesopotamia (Lagash)", label: "Gudea of Lagash, c. 21st century BCE: gold dust and wood from Meluhha", entity: e("gudea"), claimIds: ["@c_gudea_meluhha"] },
        { region: "Oman and the Gulf", label: "Magan and Dilmun, trading lands named with Meluhha", entity: e("magan"), claimIds: ["@c_magan_dilmun", "@c_dholavira_trade"] },
        { region: "Egypt", label: "The Great Pyramid of Giza, c. 2600 BCE", entity: e("oldkingdom"), claimIds: ["@c_pyramid", "@c_marshall_nile"] },
      ],
      note: "The Mesopotamian items are not a guess about who lived at the same time: Mesopotamian kings name Meluhha in their own inscriptions, and most scholars take Meluhha to be the Indus civilisation. The Egyptian date is a comparison of chronologies, from Wikipedia.",
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-found",
      type: "chapter",
      title: "Found by accident: Harappa and Mohenjo-daro",
      promise: "How a traveller's mounds, a railway's bricks and a strange seal turned, in 1924, into a lost civilisation.",
      when: { start: ce(1826), end: ce(1926), basis: "From Masson's visit (1826) to Marshall's naming of the “Indus” culture (1925–26)" },
      phase: "later",
      places: [e("harappa"), e("mohenjodaro")],
      people: people("masson", "cunningham", "sahni", "banerji", "marshall"),
      terms: ["@t_harappan", "@t_seal"],
    },
    {
      id: "found-prose",
      type: "prose",
      markdown: [
        `${C("c_masson", "In 1826 a traveller, Charles Masson, camped beside a great mound at Harappa")}, in the Punjab. Local people told him a city had stood there and been destroyed for its king's sins. ${C("c_masson_sangala", "Masson thought it was a town from Alexander the Great's wars")}. No one guessed it was two thousand years older. Fifty years later ${C("c_bricks_railway", "railway builders were carting its bricks away by the million")}, and ${N("cunningham", "Alexander Cunningham")} picked up ${C("c_cunningham_seal", "a small stone seal with a bull and six unknown signs")}. He decided it must be foreign.`,
        `${C("c_excavations_begin", "Real digging began in 1920–21 at Harappa, and in 1921–22 at Mohenjo-daro, 400 miles away in Sind")}. In 1924 ${N("marshall", "John Marshall")}, head of the Archaeological Survey of India, put the finds side by side and ${C("c_marshall_same", "saw at once that they came from the same unknown culture")}. ${C("c_iln_1924", "He announced it in the Illustrated London News")}, and ${C("c_sumer_link", "readers spotted the likeness to finds from Sumer")}, which dated the cities to the third millennium BCE. ${C("c_single_bound", "At a single bound, Marshall wrote, Indian history had grown 3,000 years older")}.`,
        `${C("c_name_indus", "Marshall soon settled on calling it the “Indus” civilisation")}. It is also called ${N("t_harappan", "Harappan")}, after the first site dug.`,
      ].join("\n\n"),
    },
    { id: "found-claims", type: "claims", claimIds: ["@c_masson", "@c_bricks_railway", "@c_cunningham_seal", "@c_excavations_begin", "@c_marshall_same", "@c_iln_1924", "@c_name_indus", "@c_dates"] },
    {
      id: "found-quote",
      type: "quote",
      excerptId: "@x_iln_threshold",
      caption: "John Marshall, “First light on a long-forgotten civilisation”, Illustrated London News, 20 September 1924, p. 528.",
    },

    // ------------------------------------------------------------ 2
    {
      id: "ch-cities",
      type: "chapter",
      title: "Cities on a plan",
      promise: "Straight streets, covered drains, a great brick tank, and a city of stone in the salt flats of Kachchh.",
      when: { start: bce(2600), end: bce(1900), basis: "Mature Harappan phase" },
      places: [e("mohenjodaro"), e("harappa"), e("dholavira"), e("lothal"), e("ganweriwala"), e("rakhigarhi")],
      terms: ["@t_mature", "@t_citadel"],
    },
    {
      id: "cities-prose",
      type: "prose",
      markdown: [
        `${C("c_sites", "More than a thousand settlements of the Mature Harappan phase are known")}, most of them villages and small towns; only a handful were real cities. The best known is Mohenjo-daro. ${C("c_mjd_grid", "Its lower town was laid out along streets that cross at right angles")}, with drains built in from the start. ${C("c_houses", "The excavators found plain but solid houses, many with their own wells and bathrooms")}. ${C("c_population", "Harappa and Mohenjo-daro may each have held tens of thousands of people")}.`,
        `On the raised mound, the ${N("t_citadel", "citadel")}, stands ${N("greatbath", "the Great Bath")}: ${C("c_great_bath", "a sunken brick tank, made watertight with gypsum mortar and a backing of bitumen")}. Far to the south, in Kachchh, ${C("c_dholavira", "Dholavira was built largely of stone, with reservoirs to catch scarce rain")}. ${C("c_dholavira_found", "It was only found in 1968")}. At ${N("lothal", "Lothal")}, in Gujarat, ${C("c_lothal_dock", "a large brick basin was read by its excavators as a dock")}, but ${C("c_lothal_tank", "others think it was a water tank")}.`,
      ].join("\n\n"),
    },
    { id: "cities-claims", type: "claims", claimIds: ["@c_sites", "@c_mjd_grid", "@c_houses", "@c_population", "@c_great_bath", "@c_dholavira", "@c_dholavira_found"] },
    {
      id: "cities-debate",
      type: "debate",
      question: "Was the basin at Lothal a dock?",
      positions: [
        { label: "A dock for ships (the excavators)", claimIds: ["@c_lothal_dock"] },
        { label: "Mainly a water tank (other archaeologists)", claimIds: ["@c_lothal_tank"] },
      ],
      note: "Both positions are given here as Wikipedia summarises them; the excavation reports themselves are not yet on this page.",
    },
    {
      id: "cities-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Population figures are estimates from the size of the sites, not counts. The UNESCO summaries quoted here are official descriptions, written for a heritage listing.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-script",
      type: "chapter",
      title: "Writing that no one can read",
      promise: "Thousands of short inscriptions, a hundred claimed decipherments, and an argument about whether the signs are writing at all.",
      when: { start: bce(2600), end: bce(1900), basis: "Mature Harappan phase" },
      people: people("marshall"),
      terms: ["@t_seal", "@t_bilingual"],
    },
    {
      id: "script-prose",
      type: "prose",
      markdown: [
        `${C("c_script_corpus", "More than 3,800 Indus inscriptions are known")}, mostly on small ${N("t_seal", "stamp seals")}. ${C("c_marshall_script", "From the first finds, no one could read them")}, and ${C("c_script_undeciphered", "no one can yet")}. Many decipherments have been announced; none has convinced other specialists.`,
        `Why is it so hard? ${C("c_script_obstacles", "There is no bilingual inscription, the texts average only about five signs, and the language is unknown")}. A ${N("t_bilingual", "bilingual")}, like the Rosetta Stone for Egyptian, would let a reading be tested. Some scholars go further: ${C("c_fsw", "Farmer, Sproat and Witzel argued that the signs were symbols, not writing")}. ${C("c_rao", "Rao and colleagues answered that the sign sequences have the structure of a language")}.`,
      ].join("\n\n"),
    },
    { id: "script-claims", type: "claims", claimIds: ["@c_script_corpus", "@c_script_undeciphered", "@c_script_obstacles", "@c_marshall_script"] },
    {
      id: "script-debate",
      type: "debate",
      question: "Is the Indus script writing?",
      positions: [
        { label: "No: non-linguistic symbols (Farmer, Sproat and Witzel, 2004)", claimIds: ["@c_fsw"] },
        { label: "Yes: it has the structure of a language (Rao et al., 2009)", claimIds: ["@c_rao"] },
      ],
      note: "Most specialists treat the signs as writing, and many have published replies to Farmer, Sproat and Witzel. Neither side can prove its case without a decipherment.",
    },

    // ------------------------------------------------------------ 4
    {
      id: "ch-trade",
      type: "chapter",
      title: "Meluhha: ships to Mesopotamia",
      promise: "Mesopotamian kings boasted of ships and goods from a land called Meluhha. Was it the Indus?",
      when: { start: bce(2334), end: bce(2100), basis: "From Sargon of Akkad to Gudea of Lagash" },
      places: [e("meluhha"), e("magan"), e("dilmun"), e("dholavira")],
      people: people("sargon", "gudea", "wheeler"),
    },
    {
      id: "trade-prose",
      type: "prose",
      markdown: [
        `The Indus people left no readable records, but their trading partners did. ${C("c_sargon_meluhha", "Sargon of Akkad boasted that the ships of Meluhha, Magan and Dilmun moored at his capital")}, and ${C("c_gudea_meluhha", "Gudea of Lagash brought gold dust, wood and stone from Meluhha")}. ${C("c_meluhha_id", "Most scholars think Meluhha was the Indus civilisation")}. ${C("c_magan_dilmun", "Magan was in today's Oman, and Dilmun in Bahrain")}.`,
        `The goods travelled both ways. ${C("c_objects_mesopotamia", "Indus seals and other objects have been found in Mesopotamia")}, and ${C("c_dholavira_trade", "Dholavira has evidence of trade with Mesopotamia and Oman")}. ${C("c_sea_trade_1926", "By 1926 Marshall was sure the contact was by sea")}. For a long time ${C("c_wheeler_akkad", "these contacts were the only firm way to date the cities")}.`,
      ].join("\n\n"),
    },
    { id: "trade-claims", type: "claims", claimIds: ["@c_sargon_meluhha", "@c_gudea_meluhha", "@c_meluhha_id", "@c_magan_dilmun", "@c_objects_mesopotamia", "@c_dholavira_trade", "@c_wheeler_akkad"] },
    {
      id: "trade-quote",
      type: "quote",
      excerptId: "@x_barton_sargon",
      caption: "An inscription of Sargon of Akkad, in G. A. Barton's translation, The Royal Inscriptions of Sumer and Akkad (1929), p. 109. “Melukha” is Meluhha.",
    },
    {
      id: "trade-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. That Meluhha was the Indus is the usual view, not a proven fact; it is supported here only by tertiary sources. Barton's translations date from the 1920s.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-life",
      type: "chapter",
      title: "Daily life, crafts and seals",
      promise: "Gold and faience, stone blades, unicorns on seals, and the same weights from one city to the next.",
      when: { start: bce(2600), end: bce(1900), basis: "Mature Harappan phase" },
      places: [e("mohenjodaro"), e("dholavira"), e("chanhudaro")],
      terms: ["@t_steatite", "@t_faience", "@t_chalcolithic"],
    },
    {
      id: "life-prose",
      type: "prose",
      markdown: [
        `${C("c_crafts", "The people of Mohenjo-daro made polished gold jewellery and glazed faience, but still used simple stone blades every day")}; Marshall called theirs a ${N("t_chalcolithic", "copper-stone age")}. ${C("c_beads", "Dholavira had workshops for beads")} of shell and semi-precious stone. ${C("c_standard", "Brick sizes and weights were the same from city to city")}, over centuries.`,
        `Their seals, mostly of ${N("t_steatite", "steatite")}, are tiny works of art. ${C("c_seal_animals", "The first ones found showed bulls and “unicorns”; later came a humped bull, tigers, elephants and rhinoceroses")}, the humped bull that Cunningham had thought un-Indian. ${C("c_no_horse", "Marshall noted that horses did not appear")}. And ${C("c_no_palaces", "no palace or royal tomb has been found")}: fine goods turn up in ordinary houses.`,
      ].join("\n\n"),
    },
    { id: "life-claims", type: "claims", claimIds: ["@c_crafts", "@c_beads", "@c_standard", "@c_seal_animals", "@c_no_horse", "@c_no_palaces"] },

    // ------------------------------------------------------------ 6
    {
      id: "ch-religion",
      type: "chapter",
      title: "Gods and rituals: what we can and cannot say",
      promise: "A great tank, a seated figure, a horned god. Without texts, every reading is an interpretation.",
      when: { start: bce(2600), end: bce(1900), basis: "Mature Harappan phase" },
      places: [e("mohenjodaro")],
      people: people("marshall"),
    },
    {
      id: "religion-prose",
      type: "prose",
      markdown: [
        `We cannot read a single prayer of the Indus people, so all we have are objects and guesses about them. ${C("c_bath_religion", "Marshall wrote that the Great Bath's purpose “can only be surmised”")}, then guessed at ritual bathing, like the tanks of later Indian temples. ${C("c_tablet_deity", "A figure seated cross-legged with worshippers, on a small tablet, looked to him more like a god than a king")}.`,
        `His boldest reading was of a seal showing a horned figure among animals: ${C("c_protoshiva", "he called it an early Shiva, Pashupati, “lord of animals”")}, and Shiva's cult the oldest in the world. The name stuck, but ${C("c_protoshiva_doubt", "later scholars have read the same figure very differently")}.`,
      ].join("\n\n"),
    },
    { id: "religion-claims", type: "claims", claimIds: ["@c_bath_religion", "@c_tablet_deity"] },
    {
      id: "religion-debate",
      type: "debate",
      question: "Does the “Pashupati” seal show an early Shiva?",
      positions: [
        { label: "Yes, a proto-Shiva (Marshall, 1928–29)", claimIds: ["@c_protoshiva"] },
        { label: "Other readings, or no way to know (later scholars)", claimIds: ["@c_protoshiva_doubt"] },
      ],
      note: "A resemblance to later images is not proof of the same god or the same meaning. The later debate is summarised here through Wikipedia.",
    },
    {
      id: "religion-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Marshall read Indus objects through later Indian religion; his readings are part of the history of the subject. Names like “Great Bath”, “Priest-King” and “Pashupati” are modern labels.",
    },

    // ------------------------------------------------------------ 7
    {
      id: "ch-end",
      type: "chapter",
      title: "Why the cities emptied",
      promise: "An invasion that never was, a changing climate, and a dry river that may or may not be the Sarasvatī.",
      when: { start: bce(1900), end: bce(1300), basis: "From the decline of the cities to the conventional end of the Late Harappan phase" },
      places: [e("mohenjodaro"), e("ghaggar"), e("kalibangan")],
      people: people("marshall", "wheeler", "dales"),
      terms: ["@t_deurban", "@t_palaeochannel"],
    },
    {
      id: "end-prose",
      type: "prose",
      markdown: [
        `${C("c_decline", "From about 1900 BCE the cities shrank and many sites were abandoned")}. ${C("c_mjd_abandoned", "Mohenjo-daro was never rebuilt")}. What happened? The first answer was war. ${C("c_marshall_aryans", "In 1925 Marshall suggested invading Aryans had destroyed the culture")}, and in 1947 ${C("c_wheeler_indra", "Mortimer Wheeler put it in a phrase: “Indra stands accused”")}, pointing to skeletons at Mohenjo-daro. ${C("c_wheeler_hedge", "Even he admitted the evidence might point elsewhere")}.`,
        `In 1964 George Dales looked again. ${C("c_dales_skeletons", "Nine years of digging had produced only about 37 skeletons, from different periods")}, and ${C("c_no_destruction", "there was no burnt layer, no weapons of war, no last stand")}. Today most researchers look at climate and rivers: ${C("c_climate", "a weakening monsoon that slowly dried the rivers and made farming harder")}.`,
        `One river is at the centre of a long argument. ${C("c_ghaggar_sites", "Many Harappan sites line the Ghaggar-Hakra, a river now mostly dry")}. ${C("c_rv_sarasvati", "The Rigveda praises a mighty Sarasvatī flowing from the mountains to the sea")}, and ${C("c_oldham", "in 1893 C. F. Oldham identified the two")}. Was it a great Himalayan river when the cities stood? Geologists who study its ${N("t_palaeochannel", "old channels")} disagree.`,
      ].join("\n\n"),
    },
    { id: "end-claims", type: "claims", claimIds: ["@c_decline", "@c_mjd_abandoned", "@c_dales_skeletons", "@c_no_destruction", "@c_climate", "@c_ghaggar_sites"] },
    {
      id: "end-debate",
      type: "debate",
      question: "Why did the Indus cities decline?",
      positions: [
        { label: "Destroyed by invaders (Wheeler, 1947; now rejected)", claimIds: ["@c_wheeler_indra"] },
        { label: "Floods and salty soils (Dales, 1964)", claimIds: ["@c_dales_floods"] },
        { label: "A weakening monsoon and drying rivers (Giosan et al., 2012)", claimIds: ["@c_climate"] },
        { label: "A river that lost its Himalayan source (Chatterjee et al., 2019)", claimIds: ["@c_chatterjee"] },
      ],
      note: "The invasion thesis is included for its history; the evidence is against it. The other explanations are not exclusive: several causes may have worked together, and over centuries.",
    },
    {
      id: "river-debate",
      type: "debate",
      question: "Was the Ghaggar-Hakra the Rigveda's Sarasvatī, and a great river in Harappan times?",
      positions: [
        { label: "The Sarasvatī, once fed by the Sutlej (Oldham, 1893)", claimIds: ["@c_oldham", "@c_rv_sarasvati"] },
        { label: "Perennial and Himalaya-fed until c. 4500 years ago (Chatterjee et al., 2019)", claimIds: ["@c_chatterjee"] },
        { label: "Only monsoon-fed in Harappan times (Giosan et al., 2012)", claimIds: ["@c_giosan_monsoon"] },
        { label: "The Sutlej left it c. 8000 years ago, before the towns (Singh et al., 2017)", claimIds: ["@c_singh_sutlej"] },
      ],
      note: "The geologists agree more than it seems: none finds a large glacier-fed river at the height of the cities (c. 2600–1900 BCE). They disagree about the centuries before. Whether the river of the hymn is this river is a separate question, which geology alone cannot settle.",
    },
    {
      id: "end-care",
      type: "callout",
      tone: "method",
      markdown: "Names carry stances. “Sindhu-Sarasvatī civilisation”, used by some Indian scholars and textbooks, assumes the identification this debate is about. This page uses “Indus”, the usual name in international scholarship, and records both as names of the same culture.",
    },

    // ------------------------------------------------------------ 8
    {
      id: "ch-after",
      type: "chapter",
      title: "What continued",
      promise: "The cities went; the villages, and the people, did not.",
      when: { start: bce(1900), end: bce(1300), basis: "Late Harappan phase" },
      places: [e("harappa"), e("rakhigarhi")],
      terms: ["@t_deurban"],
    },
    {
      id: "after-prose",
      type: "prose",
      markdown: [
        `Archaeologists now speak of ${N("t_deurban", "deurbanisation")} rather than collapse. ${C("c_deurban", "Writing, seals, weights, long-distance trade and big buildings disappeared, but villages carried on and even multiplied")}. ${C("c_east_south", "People moved east towards the Ganga plain and south-east into Gujarat")}. ${C("c_harappa_living", "Harappa itself is still a living town")}.`,
        `The people did not vanish either. ${C("c_dna", "The first ancient genome from an Indus city, from Rakhigarhi, suggests that its kind of ancestry was a main ancestor of later South Asians")}, although ${C("c_dna_caution", "one genome cannot describe a whole civilisation")}.`,
      ].join("\n\n"),
    },
    { id: "after-claims", type: "claims", claimIds: ["@c_deurban", "@c_east_south", "@c_harappa_living", "@c_dna", "@c_dna_caution"] },
    {
      id: "after-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Ancient DNA tells us about ancestry, not language or culture. Debates about the Vedic period and the arrival of Indo-Aryan languages belong to the next page, not this one.",
    },

    // ------------------------------------------------------------ 9
    {
      id: "ch-how",
      type: "chapter",
      title: "How we know",
      promise: "No texts, a century of digging, aeroplanes, river sand and ancient DNA.",
      phase: "later",
      people: people("marshall", "wheeler", "dales"),
    },
    {
      id: "how-prose",
      type: "prose",
      markdown: [
        `${C("c_no_texts", "For the Indus there are no histories, no king lists, no letters")}, only a few Mesopotamian mentions of Meluhha. Everything else is archaeology. The methods have changed: ${C("c_aerial", "in 1925 an aeroplane survey found new sites along an old bed of the Ravi")}; today geologists date river sand, and geneticists read ancient DNA.`,
        `The old evidence has weaknesses too. ${C("c_records", "The early excavations were poorly recorded, and parts of Mohenjo-daro were not published for sixty years")}. That is one reason ideas such as the “massacre” lasted so long, and why this page shows who said what, and when.`,
      ].join("\n\n"),
    },
    { id: "how-claims", type: "claims", claimIds: ["@c_no_texts", "@c_aerial", "@c_records", "@c_area"] },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Five popular beliefs about the Indus civilisation, and an open question about who ruled it.",
      phase: "later",
    },
    {
      id: "often-prose",
      type: "prose",
      markdown: "Some short versions of this story are repeated more often than the evidence allows. Here are five, each with what the sources on this page say.",
    },
    { id: "myth-aryan", type: "misconception", theme: "war", claimId: "@m_aryan", correctionIds: ["@c_no_destruction", "@c_dales_skeletons", "@c_decline"] },
    { id: "myth-script", type: "misconception", theme: "culture", claimId: "@m_deciphered", correctionIds: ["@c_script_undeciphered", "@c_script_obstacles"] },
    { id: "myth-empire", type: "misconception", theme: "polity", claimId: "@m_one_empire", correctionIds: ["@c_no_palaces", "@c_state_views"] },
    { id: "myth-priestking", type: "misconception", theme: "polity", claimId: "@m_priestking", correctionIds: ["@c_priestking_name", "@c_wheeler_priestkings"] },
    { id: "myth-sudden", type: "misconception", theme: "society", claimId: "@m_sudden", correctionIds: ["@c_decline", "@c_climate", "@c_deurban"] },
    {
      id: "state-debate",
      type: "debate",
      theme: "polity",
      question: "Who ruled the Indus cities?",
      positions: [
        { label: "Priest-kings of a military state (Wheeler)", claimIds: ["@c_wheeler_priestkings"] },
        { label: "An empire, a state, or many: scholars disagree", claimIds: ["@c_state_views"] },
        { label: "Perhaps no ruling class at all (Green, 2021)", claimIds: ["@c_green_egalitarian"] },
      ],
      note: "The facts all sides must explain: standard weights and bricks over a huge area, and no palaces, royal tombs or monuments to rulers.",
    },
    {
      id: "often-map",
      type: "callout",
      tone: "method",
      markdown: "About the map. The outline on this page's map comes from Cliopatria, a dataset of historical borders, which records the Indus civilisation as one polity. It is drawn here as a culture area, not a state: the sites shared a material culture, and whether they shared a government is the open question above.",
    },
  ];

  return {
    op: "create_page",
    slug: PAGE_SLUG,
    title: "The Indus civilisation",
    kind: "era",
    entity: E.culture!,
    summary: "The first cities of South Asia, c. 2600–1900 BCE: planned streets, a script no one can read, trade with Mesopotamia, and a slow end that was not an invasion.",
    blocks,
    status: "published",
    position: 1,
    spec: indusSpec(),
  };
}

/** The atlas: the culture area, its sites, and turning points dated by claims on the page. */
export function indusSpec(): PageSpecInput {
  const astro = (y: number) => toAstronomicalYear(y, "BCE");
  return {
    atlas: {
      focus: [CULTURE],
      range: [astro(3300), astro(1300)],
      initialYear: astro(2300),
      stops: [
        { year: astro(3000), label: "Dholavira settled", claimId: "@c_dholavira" },
        { year: astro(2600), label: "The cities flourish", claimId: "@c_dates" },
        { year: astro(2300), label: "Sargon names Meluhha's ships", claimId: "@c_sargon_meluhha" },
        { year: astro(1900), label: "The cities decline", claimId: "@c_decline" },
        { year: astro(1300), label: "The Late Harappan phase ends", claimId: "@c_dates" },
      ],
      neighbours: true,
    },
    timeline: { range: [astro(3300), astro(1300)] },
  };
}
