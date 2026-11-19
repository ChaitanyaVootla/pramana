import type { BlockInput, ChangeOpInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "Drought and famine in early India": a theme page on food, water, work and
 * what drought and famine did to them, from the first farmers to about 1200
 * CE, with the cells this period contributes to the cross-age page (see
 * ./famine-early-cells.ts).
 *
 * Sources are read in public-domain editions captured here: Griffith's Rig
 * Veda (1896–97), Whitney's Atharva Veda (1905), Max Müller's Upaniṣads (SBE
 * 1, 1879), the Vinaya (SBE 17, 1882), Cowell's Jātaka (vols I–II, 1895),
 * McCrindle's Megasthenes (1877), Shamasastry's Arthaśāstra (1915), Bühler's
 * Manu (SBE 25, 1886), Rice's Inscriptions at Sravana Belgola (1889), Fleet's
 * Gupta inscriptions (CII III, 1888) and his Sohgaura article (JRAS 1907),
 * Kielhorn's Junāgaḍh inscription of Rudradāman (EI VIII, 1906), Legge's
 * Faxian (1886), Beal's Xuanzang (1884), Sachau's al-Bīrūnī (1910 ed.),
 * Stein's Rājataraṅgiṇī (1900), the ASI report for 1904–05 (Uttaramerūr) and
 * Smith's Early History (1914). Marshall's Mohenjo-daro (1931) and
 * Bhandarkar's Mahāsthān inscription (EI XXI, 1931–32) are public domain in
 * India but not yet in the US, so they are quoted briefly. Modern findings
 * (Mehrgarh, the Indus decline) come from pinned Wikipedia revisions and
 * UNESCO, as tertiary sources.
 *
 * A source already on the platform is reused when one with the same Internet
 * Archive identifier (or Wikipedia revision) exists; otherwise it is created.
 * Entities are matched by Wikidata QID, then by slug, else created from
 * Wikidata.
 */

export const PAGE_SLUG = "drought-and-famine-in-early-india";
export const PAGE_TITLE = "Drought and famine in early India";

const bce = (year: number, approximate = false) => ({ year, era: "BCE" as const, ...(approximate ? { approximate } : {}) });
const ce = (year: number, approximate = false) => ({ year, era: "CE" as const, ...(approximate ? { approximate } : {}) });

// ---------------------------------------------------------------- sources

type Origin =
  | { kind: "internet_archive"; identifier: string }
  | { kind: "wikipedia"; title: string }
  | { kind: "url"; url: string };

interface SourceSpec {
  origin: Origin;
  /** Search words that find the source on the platform, if it is there. */
  find?: string;
  /** create_source fields, used when it is not on the platform. */
  create: Record<string, unknown>;
}

const ia = (id: string) => ({ ia: id, url: `https://archive.org/details/${id}` });
const iaOrigin = (identifier: string): Origin => ({ kind: "internet_archive", identifier });
const book = (title: string, year: number, extra: Record<string, unknown>) => ({ type: "book", title, issued: { "date-parts": [[year]] }, ...extra });
const pd = (note: string) => ({ status: "public_domain", note });

export const SOURCES = {
  marshall: {
    origin: iaOrigin("in.ernet.dli.2015.69817"),
    find: "Mohenjo-daro Indus Civilization",
    create: {
      kind: "report",
      tier: "secondary",
      csl: book("Mohenjo-daro and the Indus Civilization, vol. I", 1931, { author: [{ family: "Marshall", given: "John" }], volume: "1", publisher: "Arthur Probsthain", "publisher-place": "London" }),
      identifiers: ia("in.ernet.dli.2015.69817"),
      license: { status: "copyrighted", note: "Public domain in India (Marshall died 1958; life + 60). Published 1931, so still in copyright in the US until the end of 2026: quoted briefly." },
      lenses: ["archaeological"],
      note: "The official account of the excavations at Mohenjo-daro, 1922–27, edited by the Director-General of the Archaeological Survey.",
    },
  },
  griffith1: {
    origin: iaOrigin("in.ernet.dli.2015.104118"),
    find: "Hymns of the Rigveda",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("The Hymns of the Rigveda, vol. I", 1896, { translator: [{ family: "Griffith", given: "Ralph T. H." }], volume: "1", edition: "2", publisher: "E. J. Lazarus", "publisher-place": "Benares" }),
      identifiers: ia("in.ernet.dli.2015.104118"),
      license: pd("Published 1896; Griffith died 1906."),
      lenses: ["primary_source"],
    },
  },
  griffith2: {
    origin: iaOrigin("in.ernet.dli.2015.104119"),
    find: "Hymns of the Rigveda",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("The Hymns of the Rigveda, vol. II", 1897, { translator: [{ family: "Griffith", given: "Ralph T. H." }], volume: "2", edition: "2", publisher: "E. J. Lazarus", "publisher-place": "Benares" }),
      identifiers: ia("in.ernet.dli.2015.104119"),
      license: pd("Published 1897; Griffith died 1906."),
      lenses: ["primary_source"],
    },
  },
  whitney: {
    origin: iaOrigin("atharvavedasamhi01whituoft"),
    find: "Atharva-Veda",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("Atharva-Veda Saṃhitā, vol. I", 1905, { translator: [{ family: "Whitney", given: "William Dwight" }], editor: [{ family: "Lanman", given: "Charles Rockwell" }], volume: "1", publisher: "Harvard University", "publisher-place": "Cambridge, Mass.", "collection-title": "Harvard Oriental Series", "collection-number": 7 }),
      identifiers: ia("atharvavedasamhi01whituoft"),
      license: pd("Published 1905; Whitney died 1894, Lanman 1941."),
      lenses: ["primary_source", "philological"],
      note: "A literal translation with notes, including how each hymn was used in ritual (from the Kauśika Sūtra).",
    },
  },
  sbe1: {
    origin: iaOrigin("upanishads01mluoft"),
    find: "Upanishads",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("The Upanishads, Part I", 1879, { translator: [{ family: "Müller", given: "F. Max" }], publisher: "Clarendon Press", "publisher-place": "Oxford", "collection-title": "Sacred Books of the East", "collection-number": 1 }),
      identifiers: ia("upanishads01mluoft"),
      license: pd("Published 1879; Max Müller died 1900."),
      lenses: ["primary_source"],
    },
  },
  vinaya2: {
    origin: iaOrigin("vinayatexts02davi"),
    find: "Vinaya Texts",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("Vinaya Texts, Part II: The Mahāvagga, V–X; The Kullavagga, I–III", 1882, { translator: [{ family: "Rhys Davids", given: "T. W." }, { family: "Oldenberg", given: "Hermann" }], publisher: "Clarendon Press", "publisher-place": "Oxford", "collection-title": "Sacred Books of the East", "collection-number": 17 }),
      identifiers: ia("vinayatexts02davi"),
      license: pd("Published 1882; Rhys Davids died 1922, Oldenberg 1920."),
      lenses: ["primary_source"],
      note: "The monastic rules of the Theravāda canon, each with the story of how it came to be made. The stories are set in the Buddha's lifetime but were compiled over the following centuries.",
    },
  },
  jataka1: {
    origin: iaOrigin("jatakaorstoriesofb01cowe"),
    find: "Jataka",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("The Jātaka, or Stories of the Buddha's Former Births, vol. I", 1895, { translator: [{ family: "Chalmers", given: "Robert" }], editor: [{ family: "Cowell", given: "E. B." }], volume: "1", publisher: "Cambridge University Press", "publisher-place": "Cambridge" }),
      identifiers: ia("jatakaorstoriesofb01cowe"),
      license: pd("Published 1895; Cowell died 1903, Chalmers 1938."),
      lenses: ["primary_source"],
      note: "Folk and moral tales told as the Buddha's former lives. The verses are old; the prose stories were put in their present form in the commentary, centuries after the Buddha.",
    },
  },
  jataka2: {
    origin: iaOrigin("jatakaorstoriesofb02cowe"),
    find: "Jataka",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("The Jātaka, or Stories of the Buddha's Former Births, vol. II", 1895, { translator: [{ family: "Rouse", given: "W. H. D." }], editor: [{ family: "Cowell", given: "E. B." }], volume: "2", publisher: "Cambridge University Press", "publisher-place": "Cambridge" }),
      identifiers: ia("jatakaorstoriesofb02cowe"),
      license: pd("Published 1895; Cowell died 1903, Rouse 1950 (life + 60 in India)."),
      lenses: ["primary_source"],
      note: "Folk and moral tales told as the Buddha's former lives. The verses are old; the prose stories were put in their present form in the commentary, centuries after the Buddha.",
    },
  },
  mccrindle: {
    origin: iaOrigin("AncientIndiaAsDescribedByMegasthenesAndArrian"),
    find: "Megasthenes",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("Ancient India as Described by Megasthenês and Arrian", 1877, { translator: [{ family: "McCrindle", given: "J. W." }], publisher: "Trübner & Co.", "publisher-place": "London" }),
      identifiers: ia("AncientIndiaAsDescribedByMegasthenesAndArrian"),
      license: pd("Published 1877; McCrindle died 1913."),
      lenses: ["colonial_orientalist"],
      note: "English translation of the Megasthenes fragments, preserved by later Greek and Roman writers, and of Arrian's Indika.",
    },
  },
  shamasastry: {
    origin: iaOrigin("kautilyas-arthashastra"),
    find: "Arthashastra",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("Kautilya's Arthashastra", 1915, { translator: [{ family: "Shamasastry", given: "R." }], publisher: "Government Press", "publisher-place": "Bangalore" }),
      identifiers: ia("kautilyas-arthashastra"),
      license: pd("Published 1915; Shamasastry died 1944."),
      lenses: ["philological"],
      note: "The first English translation. The Arthaśāstra's date is debated (between the 4th century BCE and the 3rd century CE).",
    },
  },
  rice: {
    origin: iaOrigin("inscriptionsatsr00rice"),
    find: "Sravana Belgola",
    create: {
      kind: "inscription_corpus",
      tier: "primary",
      csl: book("Inscriptions at Sravana Belgola: A Chief Seat of the Jains", 1889, { author: [{ family: "Rice", given: "B. Lewis" }], publisher: "Mysore Government Central Press", "publisher-place": "Bangalore" }),
      identifiers: ia("inscriptionsatsr00rice"),
      license: pd("Published 1889 by the Government of Mysore; Rice died 1927."),
      lenses: ["primary_source", "colonial_orientalist"],
      note: "Texts and translations of the inscriptions at Śravaṇa Beḷgoḷa, with Rice's introduction, which also summarises later Jain narratives.",
    },
  },
  smith1914: {
    origin: iaOrigin("earlyhistoryofin00smit"),
    find: "Early History of India",
    create: {
      kind: "book",
      tier: "secondary",
      csl: book("The Early History of India, from 600 B.C. to the Muhammadan Conquest", 1914, { author: [{ family: "Smith", given: "Vincent A." }], edition: "3", publisher: "Clarendon Press", "publisher-place": "Oxford" }),
      identifiers: ia("earlyhistoryofin00smit"),
      license: pd("Published 1914; Smith died 1920."),
      lenses: ["colonial_orientalist"],
    },
  },
  jras1907: {
    origin: iaOrigin("in.ernet.dli.2015.462586"),
    find: "Royal Asiatic Society 1907",
    create: {
      kind: "article",
      tier: "secondary",
      csl: { type: "article-journal", title: "The Inscription on the Sohgaura Plate", author: [{ family: "Fleet", given: "J. F." }], "container-title": "Journal of the Royal Asiatic Society of Great Britain and Ireland", page: "509-532", issued: { "date-parts": [[1907]] } },
      identifiers: ia("in.ernet.dli.2015.462586"),
      license: pd("Published 1907; Fleet died 1917."),
      lenses: ["philological"],
      note: "Fleet's reading of the Sohgaura copper plate, which also quotes Bühler's earlier translation (1896).",
    },
  },
  ei21: {
    origin: iaOrigin("in.ernet.dli.2015.56981"),
    find: "Epigraphia Indica",
    create: {
      kind: "article",
      tier: "secondary",
      csl: { type: "chapter", title: "Mauryan Brahmi Inscription of Mahasthan", author: [{ family: "Bhandarkar", given: "D. R." }], "container-title": "Epigraphia Indica, vol. XXI (1931–32)", page: "83-91", publisher: "Government of India", issued: { "date-parts": [[1932]] } },
      identifiers: ia("in.ernet.dli.2015.56981"),
      license: { status: "copyrighted", note: "A Government of India publication of 1931–32: public domain in India (over 60 years). Not yet public domain in the US: quoted briefly." },
      lenses: ["philological", "archaeological"],
    },
  },
  ei8: {
    origin: iaOrigin("in.ernet.dli.2015.56654"),
    find: "Epigraphia Indica",
    create: {
      kind: "article",
      tier: "primary",
      csl: { type: "chapter", title: "Junagadh Rock Inscription of Rudradaman; the Year 72", author: [{ family: "Kielhorn", given: "F." }], "container-title": "Epigraphia Indica, vol. VIII (1905–06)", page: "36-49", publisher: "Government of India", issued: { "date-parts": [[1906]] } },
      identifiers: ia("in.ernet.dli.2015.56654"),
      license: pd("Published 1906 by the Government of India; Kielhorn died 1908."),
      lenses: ["primary_source", "philological"],
      note: "Text and translation of the inscription on the Junāgaḍh rock, cut about 150 CE, recording the repair of the Sudarśana lake.",
    },
  },
  fleet: {
    origin: iaOrigin("dli.csl.8714"),
    find: "Gupta Inscriptions",
    create: {
      kind: "inscription_corpus",
      tier: "primary",
      csl: book("Inscriptions of the Early Gupta Kings and Their Successors", 1888, { author: [{ family: "Fleet", given: "J. F." }], "collection-title": "Corpus Inscriptionum Indicarum", volume: "3", publisher: "Superintendent of Government Printing", "publisher-place": "Calcutta" }),
      identifiers: ia("dli.csl.8714"),
      license: pd("Published 1888 by the Government of India; Fleet died 1917."),
      lenses: ["primary_source", "philological"],
    },
  },
  manu: {
    origin: iaOrigin("lawsofmanu00manuuoft"),
    find: "Laws of Manu",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("The Laws of Manu", 1886, { translator: [{ family: "Bühler", given: "G." }], publisher: "Clarendon Press", "publisher-place": "Oxford", "collection-title": "Sacred Books of the East", "collection-number": 25 }),
      identifiers: ia("lawsofmanu00manuuoft"),
      license: pd("Published 1886; Bühler died 1898."),
      lenses: ["primary_source"],
      note: "A Sanskrit law book (the Mānava-Dharmaśāstra). It prescribes how people ought to live; it does not record how they did.",
    },
  },
  legge: {
    origin: iaOrigin("recordofbuddhist00fahsuoft"),
    find: "Fa-Hien",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("A Record of Buddhistic Kingdoms: being an account by the Chinese monk Fâ-Hien of his travels in India and Ceylon (A.D. 399–414)", 1886, { translator: [{ family: "Legge", given: "James" }], publisher: "Clarendon Press", "publisher-place": "Oxford" }),
      identifiers: ia("recordofbuddhist00fahsuoft"),
      license: pd("Published 1886; Legge died 1897."),
      lenses: ["primary_source"],
    },
  },
  beal1: {
    origin: iaOrigin("siyukibuddhistre01hsuoft"),
    find: "Si-yu-ki",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("Si-yu-ki: Buddhist Records of the Western World, vol. I", 1884, { translator: [{ family: "Beal", given: "Samuel" }], volume: "1", publisher: "Trübner & Co.", "publisher-place": "London" }),
      identifiers: ia("siyukibuddhistre01hsuoft"),
      license: pd("Published 1884; Beal died 1889."),
      lenses: ["primary_source"],
    },
  },
  alb2: {
    origin: iaOrigin("alberunisindiaac02biruuoft"),
    find: "Alberuni",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("Alberuni's India, vol. II", 1910, { translator: [{ family: "Sachau", given: "Edward C." }], volume: "2", publisher: "Kegan Paul, Trench, Trübner & Co.", "publisher-place": "London" }),
      identifiers: ia("alberunisindiaac02biruuoft"),
      license: pd("Published 1910 (first edition 1888); Sachau died 1930."),
      lenses: ["primary_source"],
    },
  },
  asi1904: {
    origin: iaOrigin("in.ernet.dli.2015.207530"),
    find: "Archaeological Survey 1904",
    create: {
      kind: "report",
      tier: "primary",
      csl: { type: "report", title: "Archaeological Survey of India, Annual Report 1904–5", publisher: "Superintendent of Government Printing", "publisher-place": "Calcutta", issued: { "date-parts": [[1908]] } },
      identifiers: ia("in.ernet.dli.2015.207530"),
      license: pd("A Government of India publication of 1908."),
      lenses: ["primary_source", "archaeological"],
      note: "Includes H. Krishna Sastri's edition and translation of two Chola inscriptions from Uttaramerūr.",
    },
  },
  stein: {
    origin: iaOrigin("RajataranginiVol1"),
    find: "Rajatarangini",
    create: {
      kind: "edition",
      tier: "primary",
      csl: book("Kalhaṇa's Rājataraṅgiṇī: A Chronicle of the Kings of Kaśmīr, vol. I", 1900, { translator: [{ family: "Stein", given: "M. A." }], volume: "1", publisher: "Archibald Constable", "publisher-place": "Westminster" }),
      identifiers: ia("RajataranginiVol1"),
      license: pd("Published 1900; Stein died 1943."),
      lenses: ["primary_source"],
      note: "Kalhaṇa wrote in 1148–49. Stein's introduction judges his record historical from the reign of Avantivarman (855/6–883) onwards.",
    },
  },
  wpMehrgarh: { origin: { kind: "wikipedia", title: "Mehrgarh" }, create: {} },
  wpIVC: { origin: { kind: "wikipedia", title: "Indus Valley Civilisation" }, create: {} },
  wpMohenjo: { origin: { kind: "wikipedia", title: "Mohenjo-daro" }, create: {} },
  wpDholavira: { origin: { kind: "wikipedia", title: "Dholavira" }, create: {} },
  wp42ka: { origin: { kind: "wikipedia", title: "4.2-kiloyear event" }, create: {} },
  wpManu: { origin: { kind: "wikipedia", title: "Manusmriti" }, create: {} },
  unescoDholavira: {
    origin: { kind: "url", url: "https://whc.unesco.org/en/list/1645/" },
    create: {
      kind: "webpage",
      tier: "tertiary",
      csl: { type: "webpage", title: "Dholavira: a Harappan City", "container-title": "UNESCO World Heritage Centre", issued: { "date-parts": [[2021]] }, URL: "https://whc.unesco.org/en/list/1645/" },
      identifiers: { url: "https://whc.unesco.org/en/list/1645/" },
      license: { status: "open", spdx: "CC-BY-SA-3.0-IGO" },
    },
  },
} satisfies Record<string, SourceSpec>;
export type SourceKey = keyof typeof SOURCES;

interface SnapshotSummary {
  id: string;
  url: string | null;
  title: string | null;
  meta: { wikipedia?: { revisionId: number; title: string } };
}
interface SourceDetailLite {
  source: { id: string; title: string; identifiers?: { ia?: string; url?: string; wikipedia?: { revisionId?: number } } | null };
}

export interface ResolvedSources {
  snap: Record<SourceKey, string>;
  ref: Record<SourceKey, string>;
  ops: ChangeOpInput[];
  reused: string[];
}

/** Captures every source text, and finds each source on the platform or prepares its create_source op. */
export async function resolveSources(mcp: Mcp): Promise<ResolvedSources> {
  const out = { snap: {}, ref: {}, ops: [], reused: [] } as unknown as ResolvedSources;
  for (const [key, spec] of Object.entries(SOURCES) as [SourceKey, SourceSpec][]) {
    const s = await mcp.call<SnapshotSummary>("capture_snapshot", { origin: spec.origin });
    out.snap[key] = s.id;
    const isWp = spec.origin.kind === "wikipedia";
    const iaId = spec.origin.kind === "internet_archive" ? spec.origin.identifier : null;
    const wpTitle = isWp ? (spec.origin as { title: string }).title : null;
    const revisionId = s.meta.wikipedia?.revisionId;
    const query = spec.find ?? wpTitle ?? null;
    let found: string | null = null;
    if (query) {
      const hits = await mcp.call<{ sources: { id: string; title: string }[] }>("search", { query, types: ["sources"], limit: 25 });
      for (const h of hits.sources) {
        const d = await mcp.call<SourceDetailLite>("get_source", { id: h.id });
        const ids = d.source.identifiers ?? {};
        if ((iaId && ids.ia === iaId) || (isWp && revisionId && ids.wikipedia?.revisionId === revisionId)) {
          found = d.source.id;
          break;
        }
      }
    }
    if (found) {
      out.ref[key] = found;
      out.reused.push(`${key} → ${found}`);
      continue;
    }
    const ref = `fs_${key}`;
    if (isWp) {
      const title = s.meta.wikipedia?.title ?? wpTitle!;
      const url = s.url ?? undefined;
      out.ops.push({
        op: "create_source",
        ref,
        kind: "wiki_article",
        tier: "tertiary",
        csl: { type: "entry-encyclopedia", title, "container-title": "Wikipedia", issued: { "date-parts": [[2026]] }, ...(url ? { URL: url } : {}) },
        identifiers: { ...(url ? { url } : {}), wikipedia: { lang: "en", title, revisionId: revisionId! } },
        license: { status: "open", spdx: "CC-BY-SA-4.0" },
      } as ChangeOpInput);
    } else out.ops.push({ op: "create_source", ref, ...spec.create } as ChangeOpInput);
    out.ref[key] = `@${ref}`;
  }
  return out;
}

// ---------------------------------------------------------------- entities

type Kind = "person" | "place" | "site" | "text" | "inscription" | "artifact" | "event" | "term" | "concept" | "period" | "polity" | "culture";
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  geo?: boolean;
  when?: Record<string, unknown>;
  aliases?: { label: string; lang?: string; script?: string; note?: string }[];
  link?: { to: string; type: "part_of" | "located_in" | "related_to" | "contemporary_of" | "author_of"; note?: string };
}

/** Ages (the columns of the cross-age page) and the entities already on the era pages. */
const EXISTING: EntitySpec[] = [
  { ref: "a_farming", slug: "early-farming-communities", kind: "culture", label: "Early farming communities", qid: "Q242148", description: "" },
  { ref: "a_harappan", slug: "harappan-civilisation", kind: "culture", label: "Indus civilisation", qid: "Q42534", description: "" },
  { ref: "a_vedic", slug: "vedic-period", kind: "period", label: "Vedic period", qid: "Q215262", description: "" },
  { ref: "a_maha", slug: "mahajanapadas", kind: "period", label: "Mahājanapadas", qid: "Q846025", description: "" },
  { ref: "a_maurya", slug: "maurya-empire", kind: "polity", label: "Maurya Empire", qid: "Q62943", description: "" },
  { ref: "a_middle", slug: "middle-kingdoms", kind: "period", label: "Middle kingdoms", qid: "Q1189518", description: "" },
  { ref: "a_gupta", slug: "gupta-empire", kind: "polity", label: "Gupta Empire", qid: "Q11774", description: "" },
  { ref: "a_earlymed", slug: "early-medieval-india", kind: "period", label: "Early medieval India", description: "" },
  { ref: "mohenjodaro", slug: "mohenjo-daro", kind: "site", label: "Mohenjo-daro", qid: "Q5725", description: "" },
  { ref: "dholavira", slug: "dholavira", kind: "site", label: "Dholavira", qid: "Q9468", description: "" },
  { ref: "chandragupta", slug: "chandragupta-maurya", kind: "person", label: "Chandragupta Maurya", qid: "Q188541", description: "" },
  { ref: "ashoka", slug: "ashoka", kind: "person", label: "Aśoka", qid: "Q8589", description: "" },
  { ref: "kautilya", slug: "kautilya", kind: "person", label: "Kauṭilya", description: "" },
  { ref: "t_arthashastra", slug: "arthashastra", kind: "term", label: "Arthaśāstra", description: "" },
  { ref: "megasthenes", slug: "megasthenes", kind: "person", label: "Megasthenes", qid: "Q312548", description: "" },
  { ref: "faxian", slug: "faxian", kind: "person", label: "Faxian", qid: "Q312978", description: "" },
  { ref: "xuanzang", slug: "xuanzang", kind: "person", label: "Xuanzang", qid: "Q42063", description: "" },
  { ref: "albiruni", slug: "al-biruni", kind: "person", label: "Alberuni", qid: "Q11826", description: "" },
  { ref: "kalhana", slug: "kalhana", kind: "person", label: "Kalhaṇa", qid: "Q1397476", description: "" },
  { ref: "skandagupta", slug: "skandagupta", kind: "person", label: "Skandagupta", qid: "Q1275876", description: "" },
  { ref: "girnar", slug: "girnar", kind: "place", label: "Girnar", qid: "Q1747217", description: "" },
  { ref: "uttaramerur", slug: "uttaramerur", kind: "place", label: "Uttaramerūr", qid: "Q264443", description: "" },
  { ref: "rajagaha", slug: "rajagaha", kind: "place", label: "Rājagaha", qid: "Q863683", description: "" },
  { ref: "kalinga", slug: "kalinga", kind: "place", label: "Kalinga", qid: "Q1150706", description: "" },
  { ref: "rigveda", slug: "rigveda", kind: "text", label: "Ṛgveda", qid: "Q727413", description: "" },
  { ref: "atharvaveda", slug: "atharvaveda", kind: "text", label: "Atharvaveda", qid: "Q236092", description: "" },
  { ref: "chandogya", slug: "chandogya-upanishad", kind: "text", label: "Chāndogya Upaniṣad", qid: "Q773328", description: "" },
  { ref: "utpala", slug: "utpala-dynasty", kind: "polity", label: "Utpala dynasty", qid: "Q1617123", description: "" },
];

/** Entities this page adds, from Wikidata (coordinates only from Wikidata). */
const NEW: EntitySpec[] = [
  { ref: "bhadrabahu", slug: "bhadrabahu", kind: "person", label: "Bhadrabāhu", qid: "Q3524867", description: "Jain teacher who, in Jain tradition, foresaw a twelve-year famine and led the community south, with Chandragupta Maurya as his disciple.", aliases: [{ label: "Bhadrabahu", lang: "en" }], link: { to: "chandragupta-maurya", type: "contemporary_of", note: "In Jain tradition, his teacher." } },
  { ref: "shravanabelagola", slug: "shravanabelagola", kind: "place", label: "Śravaṇa Beḷgoḷa", qid: "Q1026193", geo: true, description: "Jain pilgrimage town in Karnataka, where an inscription records Bhadrabāhu's migration from the north in a famine.", aliases: [{ label: "Shravanabelagola", lang: "en" }, { label: "Sravana Belgola", lang: "en", note: "Rice's spelling (1889)" }] },
  { ref: "rudradaman", slug: "rudradaman", kind: "person", label: "Rudradāman", qid: "Q1260392", description: "Western Kṣatrapa (Śaka) ruler of western India in the mid-2nd century CE, whose inscription at Junāgaḍh records his repair of the Sudarśana lake.", aliases: [{ label: "Rudradaman I", lang: "en" }] },
  { ref: "sudarshana", slug: "sudarshana-lake", kind: "site", label: "Sudarśana lake", qid: "Q65286549", geo: true, description: "A reservoir below Girnar, near Junāgaḍh, first built under Chandragupta Maurya and repaired after floods in about 150 and 455 CE.", aliases: [{ label: "Sudarshana Lake", lang: "en" }], link: { to: "girnar", type: "located_in" } },
  { ref: "junagadh_rud", slug: "junagadh-inscription-of-rudradaman", kind: "inscription", label: "Junāgaḍh inscription of Rudradāman", qid: "Q41381828", description: "Sanskrit inscription of about 150 CE on the Junāgaḍh rock, recording how Rudradāman rebuilt the Sudarśana dam after a storm.", aliases: [{ label: "Junagadh rock inscription of Rudradaman", lang: "en" }], link: { to: "sudarshana-lake", type: "related_to" } },
  { ref: "mahasthangarh", slug: "mahasthangarh", kind: "site", label: "Mahāsthāngaṛh", qid: "Q3085127", geo: true, description: "Ruined city in Bogra district, Bangladesh, identified with ancient Puṇḍranagara.", aliases: [{ label: "Mahasthangarh", lang: "en" }, { label: "Mahasthan", lang: "en" }] },
  { ref: "mahasthan_insc", slug: "mahasthan-brahmi-inscription", kind: "inscription", label: "Mahāsthān Brāhmī inscription", qid: "Q140197774", description: "Fragment of a Prakrit order of the Maurya period, found at Mahāsthāngaṛh in 1931, about distributing paddy from a granary to a people in distress.", aliases: [{ label: "Mahasthan Brahmi Inscription", lang: "en" }], link: { to: "mahasthangarh", type: "located_in" } },
  { ref: "sohgaura", slug: "sohgaura-copper-plate", kind: "artifact", label: "Sohgaura copper plate", qid: "Q55633437", description: "Small cast copper plate of the Maurya period from Sohgaura, near Gorakhpur, announcing two storehouses.", aliases: [{ label: "Sohgaura copper plate inscription", lang: "en" }] },
  { ref: "jataka", slug: "jataka", kind: "text", label: "Jātaka", qid: "Q668439", description: "The collection of some 550 stories of the Buddha's former lives in the Pali canon and its commentary.", aliases: [{ label: "Jataka tales", lang: "en" }] },
  { ref: "vinaya", slug: "vinaya", kind: "text", label: "Vinaya", qid: "Q848764", description: "The Buddhist monastic rules, with the stories of how each rule came to be made." },
  { ref: "manusmriti", slug: "manusmriti", kind: "text", label: "Manusmṛti", qid: "Q321526", description: "The law book of Manu, a Sanskrit treatise on dharma usually dated between about 200 BCE and 200 CE.", aliases: [{ label: "Laws of Manu", lang: "en" }, { label: "Manusmriti", lang: "en" }] },
  { ref: "parjanya", slug: "parjanya", kind: "concept", label: "Parjanya", qid: "Q1398044", description: "The Vedic god of the rain cloud, praised in hymns as the giver of rain, plants and food." },
  { ref: "jhelum", slug: "jhelum-river", kind: "place", label: "Vitastā (Jhelum)", qid: "Q214874", description: "The river of the Kashmir valley, called the Vitastā in Sanskrit and the Hydaspes by the Greeks.", aliases: [{ label: "Jhelum River", lang: "en" }, { label: "Vitasta", lang: "en" }] },
  { ref: "kashmir_valley", slug: "kashmir-valley", kind: "place", label: "Kashmir valley", qid: "Q2361576", geo: true, description: "The valley of the upper Vitastā (Jhelum), whose rice depended on controlling its floods." },
  {
    ref: "famine917",
    slug: "kashmir-famine-of-917-918",
    kind: "event",
    label: "Kashmir famine of 917–918",
    description: "A famine in Kashmir after a flood destroyed the autumn rice crop, dated by Kalhaṇa to the Laukika year 3993 (917/8 CE).",
    when: { start: ce(917), end: ce(918), basis: "Kalhaṇa, Rājataraṅgiṇī V.271: Laukika 3993, as converted by Stein" },
    link: { to: "early-medieval-india", type: "part_of" },
  },
  { ref: "t_khari", slug: "khari", kind: "term", label: "khārī", description: "A measure of grain in Kashmir (later the kharwār, “ass's load”), by which Kalhaṇa gives the price of rice." },
  { ref: "t_dinnara", slug: "dinnara", kind: "term", label: "dīnnāra", description: "The money of account in Kalhaṇa's Kashmir, in which he gives prices." },
  { ref: "t_koshthagara", slug: "koshthagara", kind: "term", label: "koṣṭhāgāra", description: "A storehouse, especially a royal granary; koṭṭhāgāla in the Prakrit of the Maurya-period inscriptions.", aliases: [{ label: "kothagala", lang: "pra-Latn" }] },
  { ref: "t_apaddharma", slug: "apaddharma", kind: "term", label: "āpaddharma", description: "“Law in times of distress”: what the law books allow a person who cannot otherwise survive, such as taking food from those they would normally avoid." },
];

interface WdSummary {
  qid: string;
  aliases: { label: string; lang?: string; script?: string; note?: string }[];
  coordinates: { lat: number; lon: number } | null;
}
interface WdMatch {
  status: "existing" | "pending";
  id: string;
  slug: string | null;
  changesetId?: string;
}
export interface ResolvedEntities {
  ref: Record<string, string>;
  ops: ChangeOpInput[];
  dependsOn: string[];
  reused: string[];
  created: string[];
}

export async function entityOps(mcp: Mcp): Promise<ResolvedEntities> {
  const specs = [...EXISTING, ...NEW];
  const qids = specs.flatMap((s) => (s.qid ? [s.qid] : []));
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids });
  const out: ResolvedEntities = { ref: {}, ops: [], dependsOn: [], reused: [], created: [] };
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
    if (EXISTING.includes(s)) throw new Error(`entity ${s.slug} is expected on the platform but is missing`);
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
    const op: ChangeOpInput = {
      op: "create_entity",
      ref: s.ref,
      slug: s.slug,
      kind: s.kind,
      label: s.label,
      description: s.description,
      ...(aliases.length ? { aliases } : {}),
      ...(s.qid ? { wikidataId: s.qid } : {}),
      ...(s.when ? { when: s.when } : {}),
    } as ChangeOpInput;
    if (s.geo && wd?.coordinates)
      (op as Record<string, unknown>).geo = {
        geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
        certainty: "approximate",
        note: `Coordinates from Wikidata ${s.qid}.`,
      };
    out.ops.push(op);
    out.ref[s.ref] = `@${s.ref}`;
    out.created.push(s.slug);
  }
  // Links from new entities, by slug or @ref.
  const bySlug = new Map(specs.map((s) => [s.slug, s.ref]));
  for (const s of NEW) {
    if (!s.link || !out.ref[s.ref]!.startsWith("@")) continue;
    const toRef = bySlug.get(s.link.to);
    const to = toRef ? out.ref[toRef]! : s.link.to;
    out.ops.push({ op: "link_entities", from: out.ref[s.ref]!, to, type: s.link.type, ...(s.link.note ? { note: s.link.note } : {}) } as ChangeOpInput);
  }
  out.dependsOn = [...new Set(out.dependsOn)];
  return out;
}

// ---------------------------------------------------------------- excerpts

type Loc = { page?: string; volume?: string; chapter?: string; section?: string; verse?: string; label?: string };
export interface ExcerptSpec {
  ref: string;
  source: SourceKey;
  quote: string;
  locator: Loc;
  note?: string;
}
export const EXCERPTS: ExcerptSpec[] = [];
const x = (ref: string, source: SourceKey, quote: string, locator: Loc, note?: string) =>
  EXCERPTS.push({ ref, source, quote, locator, ...(note ? { note } : {}) });

// The first farmers
x("fx_mehr_crops", "wpMehrgarh", "They cultivated six-row barley, einkorn and emmer wheat, jujubes and dates, and herded sheep, goats and cattle.", { section: "Lifestyle and technology" });
x("fx_mehr_granary", "wpMehrgarh", "Early Mehrgarh residents lived in mud brick houses, stored their grain in granaries, fashioned tools with local copper ore", { section: "Lifestyle and technology" });
x("fx_mehr_date", "wpMehrgarh", "Recent radiocarbon dating on teeth done by Mutin and Zazzo has placed the dating of Mehrgarh Period I between 5250 and 4650 BCE, differently from Jarrige's earlier dating pre-7000–5500 BCE.", { section: "Mehrgarh Period I" });
x("fx_ivc_barley", "wpIVC", "Neolithic domesticated crops in Mehrgarh include more than 90% barley", { section: "Agriculture" });
// The Indus cities
x("fx_mar_wheat", "marshall", "specimens of wheat and barley unearthed among the ruins of Mohenjo-daro disclose the fact that both these grains were cultivated", { volume: "1", page: "27", label: "Chapter IV" });
x("fx_mar_food", "marshall", "the food of the Indus people comprised beef, mutton, pork, and poultry", { volume: "1", page: "27", label: "Chapter IV" });
x("fx_mar_pref", "marshall", "They cultivate wheat and barley as well as the date palm.", { volume: "1", label: "Preface" });
x("fx_ivc_seasons", "wpIVC", "growing foods during summer (rice, millets and beans) and winter (wheat, barley and pulses), which required different watering regimes", { section: "Agriculture" });
x("fx_mar_wells", "marshall", "their ubiquitous wells and bathrooms and elaborate systems of drainage", { volume: "1", label: "Preface" });
x("fx_moh_wells", "wpMohenjo", "With the excavations done so far, over 700 wells are present at Mohenjo-daro, alongside drainage and bathing systems.", { section: "Water supply and wells" });
x("fx_moh_third", "wpMohenjo", "the quantity of wells transcribes as one well for every three houses", { section: "Water supply and wells" });
x("fx_dhol_unesco", "unescoDholavira", "Dholavira is an outstanding example of Harappan urban planning, with its preconceived city planning, multi-layered fortifications, sophisticated water reservoirs and drainage system", { section: "Criterion (iv)" });
x("fx_dhol_wp1", "wpDholavira", "One of the unique features of Dholavira is the sophisticated water conservation system of channels and reservoirs, the earliest found anywhere in the world, built completely of stone.", { section: "Reservoirs" });
x("fx_dhol_wp2", "wpDholavira", "This clearly came in response to the desert climate and conditions of Kutch, where several years may pass without rainfall.", { section: "Reservoirs" });
x("fx_moh_granary", "wpMohenjo", "In 1950, Sir Mortimer Wheeler identified one large building in Mohenjo-daro as a \"Great Granary\".", { section: "Major buildings" });
x("fx_moh_kenoyer", "wpMohenjo", "Jonathan Mark Kenoyer noted the complete lack of evidence for grain at the \"granary\", which, he argued, might therefore be better termed a \"Great Hall\" of uncertain function.", { section: "Major buildings" });
x("fx_mar_climate1", "marshall", "there are reasons for believing that both the climate and physical aspects of the country have undergone material changes since then", { volume: "1", label: "Chapter I, “The country, climate, and rivers”" });
x("fx_mar_climate2", "marshall", "Had the climate been as dry and the rainfall as scanty as it is to-day, it can hardly be doubted that they would have used sun-dried bricks (which are far cheaper than burnt ones) in exposed parts of the buildings as well", { volume: "1", label: "Chapter I, “The country, climate, and rivers”" });
x("fx_mar_climate3", "marshall", "Unfortunately, none of this evidence is decisive.", { volume: "1", label: "Chapter I, “The country, climate, and rivers”" });
x("fx_ivc_drought", "wpIVC", "As of 2016 many scholars believe that drought, and a decline in trade with Egypt and Mesopotamia, caused the collapse of the Indus civilisation.", { section: "Climate change and drought" });
x("fx_42_ivc", "wp42ka", "The drought may also have initiated the collapse of the Indus Valley Civilisation, with some of its population moving southeast to follow the movement of their desired habitat", { section: "Lead" });
x("fx_42_doubt", "wp42ka", "Some scientists disagree with that conclusion, citing evidence that the event was not a global drought and did not happen in a clear timeline.", { section: "Lead" });
x("fx_ivc_gradual", "wpIVC", "Around 1900 BCE signs of a gradual decline began to emerge, and by around 1700 BCE most of the cities had been abandoned.", { section: "Late Harappan" });
x("fx_ivc_east", "wpIVC", "the period also saw a diversification of the agricultural base, with a diversity of crops and the advent of double-cropping, as well as a shift of rural settlement towards the east and the south", { section: "Late Harappan" });
// The Vedic hymns
x("fx_rv_parj1", "griffith1", "The Bull, loud roaring, swift to send his bounty, lays in the plants the seed for germination.", { volume: "1", page: "549", verse: "5.83.1", label: "Book V, Hymn LXXXIII, Parjanya" });
x("fx_rv_parj4", "griffith1", "Food springs abundant for all living creatures, what time Parjanya quickens earth with moisture.", { volume: "1", page: "550", verse: "5.83.4", label: "Book V, Hymn LXXXIII, Parjanya" });
x("fx_rv_parj8", "griffith1", "Saturate both the earth and heaven with fatness, and for the cows let there be drink abundant.", { volume: "1", page: "550", verse: "5.83.8", label: "Book V, Hymn LXXXIII, Parjanya" });
x("fx_rv_vritra1", "griffith1", "He slew the Dragon, then disclosed the waters, and cleft the channels of the mountain torrents.", { volume: "1", page: "43", verse: "1.32.1", label: "Book I, Hymn XXXII, Indra" });
x("fx_rv_vritra2", "griffith1", "Like lowing kine in rapid flow descending the waters glided downward to the ocean.", { volume: "1", page: "43", verse: "1.32.2", label: "Book I, Hymn XXXII, Indra" });
x("fx_rv_food9", "griffith1", "What, Soma, we enjoy from thee in milky food or barley-brew", { volume: "1", page: "251", verse: "1.187.9", label: "Book I, Hymn CLXXXVII, Praise of Food" });
x("fx_rv_food10", "griffith1", "O Vegetable, Cake of meal, be wholesome, firm, and strengthening", { volume: "1", page: "251", verse: "1.187.10", label: "Book I, Hymn CLXXXVII, Praise of Food" });
x("fx_rv_plough", "griffith1", "Happily let the shares turn up the ploughland, happily go the ploughers with the oxen.", { volume: "1", verse: "4.57.8", label: "Book IV, Hymn LVII, Kṣetrapati" });
x("fx_rv_ploughnote", "griffith1", "each verse is to be silently repeated, with an oblation to fire, at the commencement of ploughing", { volume: "1", label: "Book IV, Hymn LVII, Griffith's note (quoting Wilson)" });
x("fx_rv_117a", "griffith2", "The Gods have not ordained hunger to be our death: even to the well-fed man comes death in varied shape.", { volume: "2", page: "601", verse: "10.117.1", label: "Book X, Hymn CXVII, Liberality" });
x("fx_rv_117b", "griffith2", "The man with food in store who, when the needy comes in miserable case begging for bread to eat, Hardens his heart against him", { volume: "2", page: "601", verse: "10.117.2", label: "Book X, Hymn CXVII, Liberality" });
x("fx_rv_117c", "griffith2", "The ploughshare ploughing makes the food that feeds us", { volume: "2", page: "602", verse: "10.117.7", label: "Book X, Hymn CXVII, Liberality" });
x("fx_av_rainuse", "whitney", "they are specified as used together in a rite for procuring rain", { volume: "1", page: "172", label: "Book IV, hymn 15, “For abundant rain”, introduction" });
x("fx_av_rain6", "whitney", "let him of lean kine, seeking refuge, go home", { volume: "1", page: "173", verse: "4.15.6" });
x("fx_av_rain6note", "whitney", "let the herdsman whose animals have been thinned by the drought, now be even driven to shelter by the abundance of rain", { volume: "1", page: "173", label: "Note on 4.15.6" });
x("fx_av_barley", "whitney", "become abundant (bahu) with thine own greatness, O barley", { volume: "1", page: "387", verse: "6.142.1", label: "Book VI, hymn 142, “For increase of barley”" });
x("fx_av_barleyuse", "whitney", "in a rite of preparation for sowing seed", { volume: "1", page: "387", label: "Book VI, hymn 142, introduction" });
x("fx_av_pests", "whitney", "the rat; split their head; crush in their ribs; lest they eat the barley, shut up their mouth; then make fearlessness for the grain", { volume: "1", page: "317", verse: "6.50.1", label: "Book VI, hymn 50, “Against petty destroyers of grain”" });
x("fx_chand_kurus", "sbe1", "When the Kurus had been destroyed by (hail) stones, Ushasti", { page: "18", section: "Chāndogya Upaniṣad I.10.1" });
x("fx_chand_beans", "sbe1", "Seeing a chief eating beans, he begged of him.", { page: "18", section: "Chāndogya Upaniṣad I.10.2" });
x("fx_chand_live", "sbe1", "for I should not have lived, if I had not eaten them, but the drinking of water would be mere pleasure", { page: "18", section: "Chāndogya Upaniṣad I.10.4" });
x("fx_chand_note", "sbe1", "a shower of stones, which produced a famine in the land", { page: "18", label: "Note on I.10.1 (from the commentary)" });
// The Buddha's time
x("fx_vin_raja", "vinaya2", "Now at that time there was a scarcity of food in Rājagaha. People brought salt, and oil, and rice, and hard food to the Ārāma.", { page: "70", section: "Mahāvagga VI.17.7" });
x("fx_vin_indoors", "vinaya2", "I allow you, O Bhikkhus, to keep food indoors.", { page: "71", section: "Mahāvagga VI.17.8" });
x("fx_vin_vesali", "vinaya2", "Now at that time Vesālī was well provided with food, the harvest was good, alms were easy to obtain, one could very well get a living by gleaning.", { page: "117", section: "Mahāvagga VI.32.1" });
x("fx_vin_scarcity", "vinaya2", "in a time of scarcity, when the harvest is bad, and alms are difficult to obtain", { page: "118", section: "Mahāvagga VI.32.1" });
x("fx_vin_revoke", "vinaya2", "those I do not allow from this day forth", { page: "118", section: "Mahāvagga VI.32.2" });
x("fx_vin_eleph", "vinaya2", "During a famine the people ate that elephants' flesh, and when the Bhikkhus came and asked for alms, they gave them elephants' flesh.", { page: "85", section: "Mahāvagga VI.23.10" });
x("fx_vin_dogs", "vinaya2", "At that time the people, during a famine, ate dogs' flesh", { page: "85", section: "Mahāvagga VI.23.12" });
x("fx_jat_kalinga1", "jataka2", "In his realms the rain fell not, and because of the drought there was a famine in the land.", { volume: "2", page: "252", label: "No. 276, Kurudhamma-Jātaka" });
x("fx_jat_kalinga2", "jataka2", "The people wandered about destitute hither and thither, leading their children by the hand. All the people in the kingdom gathered together, and came to Dantapura; and there at the king's door they made outcry.", { volume: "2", page: "252", label: "No. 276, Kurudhamma-Jātaka" });
x("fx_jat_kalinga3", "jataka2", "there falls no rain, the crops fail, there is a famine. The people, starving, diseased, and destitute, are wandering about with their little ones by the hand. Make rain for us, O king!", { volume: "2", page: "252", label: "No. 276, Kurudhamma-Jātaka" });
x("fx_jat_kalinga4", "jataka2", "Former monarchs, O king, if it would not rain, used to give alms, to keep the holy day, to make vows of virtue, and to lie down seven days in their chamber on a grass pallet", { volume: "2", page: "252", label: "No. 276, Kurudhamma-Jātaka" });
x("fx_jat_unright", "jataka2", "If a king be unrighteous, God sends rain out of season, and in season he sends no rain: and fear of famine, fear of pestilence, fear of the sword—these three fears come upon men for him.", { volume: "2", page: "87", label: "No. 194, Maṇicora-Jātaka" });
x("fx_jat_ox", "jataka2", "all the villagers came together, and besought help of their headman, saying, \"Two months from now, when we have harvested the grain, we will pay you in kind\"; so they got an old ox from him, and ate it.", { volume: "2", page: "94", label: "No. 199, Gahapati-Jātaka" });
x("fx_jat_famine199", "jataka2", "At that time all the grain had been carried away during the rainy season, and there was a famine.", { volume: "2", page: "94", label: "No. 199, Gahapati-Jātaka" });
x("fx_jat_kosala", "jataka1", "there fell no rain in Kosala; the crops withered; and everywhere the ponds, tanks, and lakes dried up.", { volume: "1", page: "183", label: "No. 75, Maccha-Jātaka" });
x("fx_jat_crows", "jataka1", "the crows and other birds, flocking to the spot, picked them out with their beaks and devoured them", { volume: "1", page: "184", label: "No. 75, Maccha-Jātaka" });
// The Mauryas
x("fx_meg_never", "mccrindle", "It is accordingly affirmed that famine has never visited India, and that there has never been a general scarcity in the supply of nourishing food.", { label: "Megasthenes, Fragm. I (from Diodorus II.36)" });
x("fx_meg_two", "mccrindle", "the inhabitants of India almost always gather in two harvests annually: and even should one of the sowings prove more or less abortive they are always sure of the other crop.", { label: "Megasthenes, Fragm. I (from Diodorus II.36)" });
x("fx_meg_rains", "mccrindle", "one in the winter season, when the sowing of wheat takes place as in other countries, and the second at the time of the summer solstice, which is the proper season for sowing rice and bosporum, as well as sesamum and millet", { label: "Megasthenes, Fragm. I (from Diodorus II.36)" });
x("fx_meg_crops", "mccrindle", "India much millet, which is kept well watered by the profusion of river-streams, and much pulse of different sorts, and rice also", { label: "Megasthenes, Fragm. I (from Diodorus II.36)" });
x("fx_meg_irrig", "mccrindle", "The greater part of the soil, moreover, is under irrigation, and consequently bears two crops in the course of the year.", { label: "Megasthenes, Fragm. I (from Diodorus II.35)" });
x("fx_meg_farmers", "mccrindle", "the tillers of the soil, even when battle is raging in their neighbourhood, are undisturbed by any sense of danger", { label: "Megasthenes, Fragm. I (from Diodorus II.36)" });
x("fx_rice_insc", "rice", "foretold in Ujjayini a period of twelve years of dire calamity (or famine), — the whole of the sangha, leaving the northern regions, took their way to the south.", { label: "Translations: Chandragiri inscription No. 1" });
x("fx_rice_admit", "rice", "The occurrence of the twelve years of famine we may perhaps admit as real.", { label: "Introduction" });
x("fx_rice_rajavali", "rice", "a compendium of Jaina history, legends and chronology, drawn up early in the present century for Deviramma, a lady of the Mysore royal family, by Devachandra", { label: "Introduction, on the Rājāvali-kathe" });
x("fx_rice_abdicate", "rice", "And the king's ministers offered many sacrifices to avert the calamity, but Chandra-Gupta, to atone for their sin in taking life, abdicated in favour of his son Simha Sena", { label: "Introduction, summarising the Rājāvali-kathe" });
x("fx_rice_suffer", "rice", "All the grain was consumed; no leaves, flowers, fruit, berries, roots, bulbs, or seeds were left; and the people, wandering here and there in search of food, perished.", { label: "Introduction, summarising the Rājāvali-kathe" });
x("fx_smith_jain", "smith1914", "I am now disposed to believe that the tradition probably is true in its main outline, and that Chandragupta really abdicated and became a Jain ascetic.", { page: "146" });
x("fx_smith_epi", "smith1914", "the epigraphical support is far from conclusive", { page: "146" });
x("fx_smith_fleet", "smith1914", "Fleet is equally persistent on the", { page: "146", label: "Note" }, "The sentence ends “… on the other side”; the scan's two-column notes split it across lines, so only its opening is quoted.");
x("fx_arth_famine1", "shamasastry", "During famine, the king shall show favour to his people by providing them with seeds and provision (bijabhaktopagraham).", { label: "Book IV, Chapter III, “Remedies against national calamities”" });
x("fx_arth_famine2", "shamasastry", "he may show favour by distributing either his own collection of provisions or the hoarded income of the rich among the people; or seek for help from his friends among kings.", { label: "Book IV, Chapter III, “Remedies against national calamities”" });
x("fx_arth_famine3", "shamasastry", "Or the king with his subjects may emigrate to another kingdom with abundant harvest.", { label: "Book IV, Chapter III, “Remedies against national calamities”" });
x("fx_arth_famine4", "shamasastry", "He may cause his subjects to grow grains, vegetables, roots, and fruits wherever water is available.", { label: "Book IV, Chapter III, “Remedies against national calamities”" });
x("fx_arth_drought", "shamasastry", "During drought shall Indra (sachinatha), the Ganges, mountains, and Mahakachchha be worshipped.", { label: "Book IV, Chapter III, “Remedies against national calamities”" });
x("fx_arth_reserve", "shamasastry", "Of the store, thus, collected, half shall be kept in reserve to ward off the calamities of the people and only the other half shall be used. Old collection shall be replaced by new supply.", { label: "Book II, Chapter XV, “The Superintendent of Storehouse”" });
x("fx_arth_worst", "shamasastry", "famine causes troubles to the whole (of the country) and occasions dearth of livelihood to all creatures", { label: "Book VIII, Chapter IV" });
x("fx_arth_gauge", "shamasastry", "In (front of) the store-house a bowl (kunda) with its mouth as wide as an aratni (24 angulas) shall be set up as rain-gauge (varshamana).", { label: "Book II, Chapter V, “The Duties of the Chamberlain”" });
x("fx_arth_sow", "shamasastry", "according as the rainfall is more or less, the superintendent shall sow the seeds which require either more or less water", { label: "Book II, Chapter XXIV, “The Superintendent of Agriculture”" });
x("fx_arth_tanks", "shamasastry", "In the case of construction of new works, such as tanks, lakes, etc., taxes (on the lands below such tanks) shall be remitted for five years (panchavarshikah pariharah). For repairing neglected or ruined works of similar nature, taxes shall be remitted for four years.", { label: "Book III, Chapter IX" });
x("fx_sohg_buhler", "jras1907", "require the storage of loads (bharaka) of Black Panicum, parched grain, cummin-seed and Amba for (times of) urgent (need)", { page: "511", label: "Bühler's translation (1896), as quoted by Fleet" });
x("fx_sohg_fleet", "jras1907", "The inscription is a public notification about two storehouses connected with three high-roads of vehicular traffic.", { label: "Fleet's interpretation" });
x("fx_sohg_emerg", "jras1907", "These storehouses were notified as being available for only temporary use, in cases of emergency.", { page: "525" });
x("fx_mah_summary", "ei21", "issued an order to the Mahamatra stationed at Pundranagara with a view to relieve the distress caused, apparently, by famine to the people called Saṃvaṅgīyas, who were settled in and about the town", { volume: "21", page: "87" });
x("fx_mah_trans", "ei21", "When there is an excess of plenty, this granary and the treasury (may be replenished) with paddy and the gandaka coins.", { volume: "21", page: "87", label: "Translation" });
x("fx_mah_paddy", "ei21", "(And likewise) paddy has been granted to the Saṃvaṅgīyas. The outbreak (of distress) in the town during (this) outburst of superhuman agency shall be tided over.", { volume: "21", page: "87", label: "Translation" });
x("fx_rud_maurya", "ei8", "ordered to be made by the Vaisya Pushyagupta, the provincial governor of the Maurya king Chandragupta", { volume: "8", page: "46", label: "Translation, line 8" });
x("fx_rud_asoka", "ei8", "conduits for Asoka the Maurya by the Yavana king Tushaspha while governing", { volume: "8", page: "47", label: "Translation, line 8" });
// The lake at Girnar
x("fx_rud_date", "ei8", "I find that the date would correspond to either the 18th October, or more probably the 16th November, A.D. 150.", { volume: "8", page: "42" });
x("fx_rud_storm", "ei8", "when by the clouds pouring with rain the earth had been converted as it were into one ocean", { volume: "8", page: "46", label: "Translation, lines 4–5" });
x("fx_rud_breach", "ei8", "By a breach four hundred and twenty cubits long, just as many broad, (and) seventy-five cubits deep, all the water escaped", { volume: "8", page: "46", label: "Translation, line 7" });
x("fx_rud_repair", "ei8", "without oppressing the inhabitants of the towns and country by taxes, forced labour and acts of affection", { volume: "8", page: "49", label: "Translation, line 15" });
x("fx_rud_treasury", "ei8", "a vast amount of money from his own treasury and in not too long a time made the dam three times as strong in breadth and length", { volume: "8", page: "49", label: "Translation, line 15" });
x("fx_rud_opposed", "ei8", "were averse to a task (regarded as) futile on account of the enormous extent of the breach", { volume: "8", page: "49", label: "Translation, line 16" });
x("fx_rud_suvisakha", "ei8", "was carried out by the minister Suvisakha, the son of Kulaipa, a Pahlava", { volume: "8", page: "49", label: "Translation, lines 18–19" });
x("fx_rud_despair", "ei8", "when the people in their despair of having the dam rebuilt were loudly lamenting", { volume: "8", page: "49", label: "Translation, line 17" });
x("fx_manu104", "manu", "He who, when in danger of losing his life, accepts food from any person whatsoever, is no more tainted by sin than the sky by mud.", { page: "424", verse: "X.104" });
x("fx_manu106", "manu", "Vamadeva, who well knew right and wrong, did not sully himself when, tormented (by hunger), he desired to eat the flesh of a dog in order to save his life.", { page: "424", verse: "X.106" });
x("fx_manu108", "manu", "Visvamitra, who well knew what is right or wrong, approached, when he was tormented by hunger, (to eat) the haunch of a dog, receiving it from the hands of a Kandala.", { page: "425", verse: "X.108" });
x("fx_manu_xi16", "manu", "he who has not eaten at (the time of) six meals, may take at (the time of) the seventh meal (food)", { page: "433", verse: "XI.16" });
x("fx_manu_xi17", "manu", "Either from the threshing-floor, or from a field, or out of the house, or wherever he finds it; but if (the owner) asks him, he must confess to him that (deed and its cause).", { page: "434", verse: "XI.17" });
x("fx_manu_date", "manu", "it must have existed at least in the second century of our era is not unwarranted", { label: "Introduction" });
x("fx_wpmanu_date", "wpManu", "the majority of scholars agree that it was composed sometime between 200 BCE and 200 CE.", { section: "Chronology" });
// The Guptas
x("fx_sk_date", "fleet", "in the year one hundred and thirty-six (A.D. 455-56)", { volume: "3", page: "57", label: "No. 14, Junāgaḍh rock inscription of Skandagupta: introduction" });
x("fx_sk_son", "fleet", "Parnadatta appointed his son, Chakrapalita, to govern the city at which the inscription is.", { volume: "3", page: "57", label: "No. 14: introduction" });
x("fx_sk_rebuilt", "fleet", "effected under the orders of Chakrapalita, after two months' work, in the year one hundred and thirty-seven (A.D. 456-57)", { volume: "3", page: "58", label: "No. 14: introduction" });
x("fx_sk_burst", "fleet", "when much water rained down unceasingly for a long time; by reason of which (the lake) Sudarsana suddenly burst", { volume: "3", page: "63", label: "No. 14: translation, line 15" });
x("fx_sk_despair", "fleet", "the people fell into despair, discussing how they should act; and, spending the whole night awake in vain, in great anxiety they reflected", { volume: "3", page: "64", label: "No. 14: translation, line 17" });
x("fx_sk_prayer", "fleet", "And may the city become prosperous; full of inhabitants; cleansed from sin by prayers sung by many hundreds of Brahmans; [and free from] drought and famine for a hundred years", { volume: "3", page: "64", label: "No. 14: translation, line 23" });
x("fx_fax_charity", "legge", "The Heads of the Vaisya families in them establish in the cities houses for dispensing charity and medicines. All the poor and destitute in the country, orphans, widowers, and childless men, maimed people and cripples, and all who are diseased, go to those houses", { page: "79", label: "Chapter XXVII" });
x("fx_fax_food", "legge", "They get the food and medicines which their cases require, and are made to feel at ease", { page: "79", label: "Chapter XXVII" });
x("fx_fax_land", "legge", "cultivate the royal land have to pay (a portion of) the gain from it. If they want to go, they go; if they want to stay on, they stay.", { page: "43", label: "Chapter XVI" });
x("fx_fax_diet", "legge", "Throughout the whole country the people do not kill any living creature, nor drink intoxicating liquor, nor eat onions or garlic. The only exception is that of the Chandalas.", { page: "43", label: "Chapter XVI" });
x("fx_fax_chandala", "legge", "Only the Chandalas are fishermen and hunters, and sell flesh meat.", { page: "43", label: "Chapter XVI" });
// Early medieval
x("fx_xz_food", "beal1", "The most usual food is milk, butter, cream, soft sugar, sugar-candy, the oil of the mustard-seed, and all sorts of cakes made of corn are used as food.", { volume: "1", page: "88", label: "Book II, §17" });
x("fx_xz_crops", "beal1", "Among the products of the ground, rice and corn are most plentiful.", { volume: "1", page: "88", label: "Book II, §17" });
x("fx_xz_sixth", "beal1", "These who cultivate the royal estates pay a sixth part of the produce as tribute.", { volume: "1", page: "87", label: "Book II, §16" });
x("fx_xz_labour", "beal1", "When the public works require it, labour is exacted but paid for.", { volume: "1", page: "87", label: "Book II, §16" });
x("fx_xz_till", "beal1", "Each one keeps his own worldly goods in peace, and all till the ground for their subsistence.", { volume: "1", page: "87", label: "Book II, §16" });
x("fx_alb_cow", "alb2", "the cow is the animal which serves man in travelling by carrying his loads, in agriculture in the works of ploughing and sowing, in the household by the milk and the product made thereof", { volume: "2", page: "152", label: "Chapter LXVIII" });
x("fx_alb_ponds", "alb2", "In every place to which some particular holiness is ascribed, the Hindus construct ponds intended for the ablutions. In this they have attained to a very high degree of art, so that our people (the Muslims), when they see them, wonder at them, and are unable to describe them, much less to construct anything like them.", { volume: "2", page: "144", label: "Chapter LXVI" });
x("fx_utt_tenth", "asi1904", "as they throw some light on village administration in Southern India in the tenth century A.D.", { page: "131", label: "H. Krishna Sastri, “Two inscriptions at Uttaramallur”" });
x("fx_utt_tank", "asi1904", "The remaining six pot-tickets shall represent the ‘tank committee.’", { page: "138", label: "First inscription, lines 6–9, translation" });
x("fx_utt_year", "asi1904", "The three committees doing duty (after their appointment) by drawing thirty pot-tickets (shall continue) for full three hundred and sixty days.", { page: "138", label: "First inscription, line 9, translation" });
x("fx_utt_duties", "asi1904", "the tank committee was probably entrusted with the annual removal of silt, occasional repairs, investment of endowments made to tanks, and similar questions", { page: "136", label: "Krishna Sastri's comment" });
x("fx_st_tun_snow", "stein", "In the month of Bhadrapada, when the fields in the land were covered with the autumnal rice-crop which was just ripening, unexpectedly there fell heavy snow", { volume: "1", page: "58", verse: "II.18" });
x("fx_st_tun_famine", "stein", "Then came a terrible famine, which resembled a kind of hell, with the masses of starving people [moving about] like ghosts.", { volume: "1", page: "58", verse: "II.20" });
x("fx_st_tun_family", "stein", "Tormented by hunger, every one thought only of his belly, and forgot in his misery love for his wife, affection for his children, and tender regard for his parents.", { volume: "1", page: "58", verse: "II.21" });
x("fx_st_tun_king", "stein", "He bought food with his own treasure and with the accumulated wealth of the ministers, and together with his wife put by day and night fresh life into the people.", { volume: "1", page: "58", verse: "II.28" });
x("fx_st_tun_note", "stein", "consists mainly of an elaborate description of a great famine in which the people were saved by the charity of the king and the miraculous intercession of his saintly wife", { volume: "1", page: "81", label: "Introduction" });
x("fx_st_historical", "stein", "period of Kasmir history for which Kalhana's work presents us with a truly historical record", { volume: "1", page: "97", label: "Introduction, §92" }, "The scan's text of the opening words, “With the accession of Avantivarman (A.D. 855/6–883), we reach that”, is too damaged to match, so the quotation starts after them.");
x("fx_st_floods", "stein", "The result of the latter was a great increase of land available for cultivation, and increased protection against disastrous floods which in Kasmir have ever been the main causes of famine", { volume: "1", page: "98", label: "Introduction, §93" });
x("fx_st_v71", "stein", "In the famine-stricken land one Khari of rice (dhanya) was bought for ten hundred and fifty Dinnaras.", { volume: "1", page: "195", verse: "V.71" });
x("fx_st_v87", "stein", "he threw with both hands money (dinnara) into the water", { volume: "1", page: "197", verse: "V.87" });
x("fx_st_v89", "stein", "the famine-stricken villagers then searched for the money (dinnara), dragged out the rocks from the river, and (thus) cleared the (bed of the) Vitasta", { volume: "1", page: "198", verse: "V.89" });
x("fx_st_v91", "stein", "The whole river, which Nila produced, was blocked up by Suyya for seven days by the construction of a stone dam, a wonderful work.", { volume: "1", page: "198", verse: "V.91" });
x("fx_st_v95", "stein", "Wherever he knew inundation-breaches [to occur] during disastrous floods, there he constructed new beds for the Vitasta.", { volume: "1", page: "198", verse: "V.95" });
x("fx_st_v116", "stein", "the purchase price of a Khari of rice was two hundred Dinnaras in times of great abundance, in that very land of Kasmir henceforth— O wonder!— the Khari of rice came to be bought for thirty-six Dinnaras.", { volume: "1", page: "201", verse: "V.116–117" });
x("fx_st_alleged", "stein", "the cost of a Khari being alleged to have fallen from 200 Dinnaras to 36 Dinnaras in consequence", { volume: "1", page: "98", label: "Introduction, §93" });
x("fx_st_v270", "stein", "the whole autumn rice crop was destroyed by a flood", { volume: "1", page: "221", verse: "V.270" });
x("fx_st_v271", "stein", "the people were destroyed by a famine, as it was difficult to obtain food while the Khari sold for a thousand [Dinnaras].", { volume: "1", page: "221", verse: "V.271" });
x("fx_st_v272", "stein", "One could scarcely see the water in the Vitasta, entirely covered [as the river] was with corpses soaked and swollen by the water in which they had long been lying.", { volume: "1", page: "221", verse: "V.272" });
x("fx_st_v273", "stein", "The land became densely covered with bones in all directions, until it was like one [great] burial ground", { volume: "1", page: "221", verse: "V.273" });
x("fx_st_v274", "stein", "The king's ministers and the Tantrins became wealthy, as they amassed riches by selling stores of rice at high prices.", { volume: "1", page: "221", verse: "V.274" });
x("fx_st_v276", "stein", "the wretched Pangu, keeping in his palace, praised his own comfort while he saw the people in misery", { volume: "1", page: "222", verse: "V.276–277" });
x("fx_smith_917", "smith1914", "an awful famine occurred in the year A.D. 917-18", { page: "374" });
x("fx_smith_relief", "smith1914", "This gruesome picture may give cause for reflection to some critics of modern methods of famine relief.", { page: "374" });

// ---------------------------------------------------------------- claims

type Stance = "supports" | "contradicts" | "qualifies" | "mentions";
export interface ClaimSpec {
  ref: string;
  text: string;
  kind: "fact" | "interpretation" | "misconception" | "debate";
  assessment: "well_supported" | "supported" | "contested" | "weak" | "refuted";
  assessmentNote?: string;
  when?: Record<string, unknown>;
  themes: string[];
  lenses?: string[];
  entities?: { entity: string; role?: "subject" | "place" | "participant" | "author" | "mention" }[];
  cites: [string, Stance?, string?][];
  learning?: { prompt: string };
}
export const CLAIMS: ClaimSpec[] = [];
const c = (spec: ClaimSpec) => CLAIMS.push(spec);

// 1. The first farmers
c({ ref: "fc_mehr_crops", text: "The first farmers at Mehrgarh, in Balochistan, grew barley and wheat, with dates and jujubes, and herded sheep, goats and cattle; barley was most of their crop.", kind: "fact", assessment: "supported", assessmentNote: "From an encyclopedia summarising the excavators; well established in the archaeology, but cited here only at third hand.", themes: ["economy", "society"], lenses: ["archaeological"], entities: [{ entity: "a_farming" }], cites: [["fx_mehr_crops"], ["fx_ivc_barley"]], learning: { prompt: "What did the first farmers at Mehrgarh grow and herd?" } });
c({ ref: "fc_mehr_granary", text: "Mehrgarh's early villagers lived in mud-brick houses and stored their grain in granaries.", kind: "fact", assessment: "supported", themes: ["economy", "infrastructure"], lenses: ["archaeological"], entities: [{ entity: "a_farming" }], cites: [["fx_mehr_granary"]] });
c({ ref: "fc_mehr_date", text: "Mehrgarh's first village was dated by its excavators to before 7000 BCE; newer radiocarbon dates on teeth put it at about 5250–4650 BCE.", kind: "debate", assessment: "contested", themes: ["sources"], lenses: ["archaeological"], entities: [{ entity: "a_farming" }], cites: [["fx_mehr_date"]] });

// 2. The Indus cities
c({ ref: "fc_ind_grains", text: "Wheat and barley were found in the ruins of Mohenjo-daro, with bones of cattle, sheep, pigs, poultry and fish that the excavators took to be food.", kind: "fact", assessment: "well_supported", themes: ["economy", "society"], lenses: ["archaeological"], entities: [{ entity: "a_harappan" }, { entity: "mohenjodaro", role: "place" }], cites: [["fx_mar_wheat"], ["fx_mar_food"], ["fx_mar_pref"], ["fx_ivc_seasons", "supports", "Wheat and barley as the winter crops."]], learning: { prompt: "Which two grains were found in the ruins of Mohenjo-daro?" } });
c({ ref: "fc_ind_seasons", text: "Indus farmers grew crops in both seasons: rice, millets and beans in summer, and wheat, barley and pulses in winter.", kind: "interpretation", assessment: "supported", assessmentNote: "A finding of plant-remains studies (2016), reported in an encyclopedia.", themes: ["economy"], lenses: ["archaeological"], entities: [{ entity: "a_harappan" }], cites: [["fx_ivc_seasons"]] });
c({ ref: "fc_ind_wells", text: "Most houses at Mohenjo-daro drew water from their own or a shared well: more than 700 wells have been found, about one for every three houses.", kind: "fact", assessment: "well_supported", themes: ["infrastructure", "society"], lenses: ["archaeological"], entities: [{ entity: "mohenjodaro" }, { entity: "a_harappan", role: "mention" }], cites: [["fx_moh_wells"], ["fx_moh_third"], ["fx_mar_wells"]], learning: { prompt: "How many wells have been found at Mohenjo-daro?" } });
c({ ref: "fc_ind_dholavira", text: "Dholavira, in the dry Rann of Kachchh, where years may pass without rain, stored water in a system of stone reservoirs and channels.", kind: "fact", assessment: "supported", themes: ["infrastructure"], lenses: ["archaeological"], entities: [{ entity: "dholavira" }, { entity: "a_harappan", role: "mention" }], cites: [["fx_dhol_unesco"], ["fx_dhol_wp1"], ["fx_dhol_wp2"]] });
c({ ref: "fc_ind_granary", text: "A large building at Mohenjo-daro was named the “Great Granary” by Mortimer Wheeler in 1950, but no grain has been found in it, and Jonathan Mark Kenoyer suggested calling it a “Great Hall” of uncertain use.", kind: "debate", assessment: "contested", themes: ["infrastructure", "historiography"], lenses: ["archaeological"], entities: [{ entity: "mohenjodaro" }], cites: [["fx_moh_granary"], ["fx_moh_kenoyer"]], learning: { prompt: "Why do some archaeologists doubt that Mohenjo-daro's “Great Granary” was a granary?" } });
c({ ref: "fc_ind_marshall", text: "John Marshall argued in 1931 that Sind had been wetter when Mohenjo-daro flourished, because its builders used costly burnt brick where sun-dried brick would have served; he admitted that none of the evidence was decisive.", kind: "interpretation", assessment: "supported", themes: ["historiography"], lenses: ["archaeological"], entities: [{ entity: "mohenjodaro" }], cites: [["fx_mar_climate1"], ["fx_mar_climate2"], ["fx_mar_climate3"]] });
c({ ref: "fc_ind_drought", text: "Many researchers link the decline of the Indus cities to a long drought around 2200 BCE, the 4.2-kiloyear event; others doubt it was a single drought with a clear date.", kind: "debate", assessment: "contested", themes: ["economy", "historiography"], lenses: ["mainstream_academic"], entities: [{ entity: "a_harappan" }], cites: [["fx_ivc_drought"], ["fx_42_ivc"], ["fx_42_doubt", "qualifies"]] });
c({ ref: "fc_ind_gradual", text: "The Indus cities declined slowly: the first signs appear around 1900 BCE, and by around 1700 BCE most of them had been abandoned.", kind: "fact", assessment: "supported", when: { start: bce(1900, true), end: bce(1700, true) }, themes: ["society"], lenses: ["archaeological"], entities: [{ entity: "a_harappan" }], cites: [["fx_ivc_gradual"]], learning: { prompt: "Over how long did the Indus cities decline?" } });
c({ ref: "fc_ind_east", text: "As the cities emptied, farming became more varied, with more crops and two harvests a year, and villages moved east and south.", kind: "fact", assessment: "supported", themes: ["economy", "society"], lenses: ["archaeological"], entities: [{ entity: "a_harappan" }], cites: [["fx_ivc_east"], ["fx_42_ivc", "supports", "“moving southeast”"]] });
c({ ref: "fm_ind_sudden", text: "A sudden drought wiped out the Indus civilisation.", kind: "misconception", assessment: "weak", assessmentNote: "Drought is a leading explanation, but the decline took centuries, the cities' people moved and farmed differently rather than vanishing, and the drought's dating is itself debated.", themes: ["historiography"], lenses: ["popular"], entities: [{ entity: "a_harappan" }], cites: [["fx_ivc_gradual", "contradicts"], ["fx_ivc_east", "contradicts"], ["fx_42_doubt", "contradicts"]] });
c({ ref: "fm_ind_granary", text: "The Indus cities stored their harvests in great state granaries.", kind: "misconception", assessment: "weak", assessmentNote: "The buildings called granaries were named so by their excavators; no grain has been found in the one at Mohenjo-daro.", themes: ["historiography", "infrastructure"], lenses: ["popular"], entities: [{ entity: "a_harappan" }], cites: [["fx_moh_kenoyer", "contradicts"], ["fx_moh_granary", "mentions", "Where the name came from."]] });

// 3. The Vedic hymns
c({ ref: "fc_ved_parjanya", text: "A Rig Veda hymn praises Parjanya, the rain cloud, who sets seed in the plants: when he waters the earth, food springs up for every creature, and the cows have water to drink.", kind: "fact", assessment: "supported", themes: ["religion", "economy"], lenses: ["primary_source"], entities: [{ entity: "parjanya" }, { entity: "rigveda", role: "mention" }, { entity: "a_vedic", role: "mention" }], cites: [["fx_rv_parj1"], ["fx_rv_parj4"], ["fx_rv_parj8"]], learning: { prompt: "What does the Rig Veda hymn to Parjanya say happens when he waters the earth?" } });
c({ ref: "fc_ved_vritra", text: "In the Rig Veda's best-known myth, Indra slays the serpent Vṛtra and releases the waters it held, which flow down to the sea.", kind: "fact", assessment: "supported", themes: ["religion"], lenses: ["primary_source"], entities: [{ entity: "rigveda" }, { entity: "a_vedic", role: "mention" }], cites: [["fx_rv_vritra1"], ["fx_rv_vritra2"]] });
c({ ref: "fc_ved_food", text: "A Rig Veda hymn in praise of Food names milk, barley-brew and cakes of meal.", kind: "fact", assessment: "supported", themes: ["society"], lenses: ["primary_source"], entities: [{ entity: "rigveda" }, { entity: "a_vedic", role: "mention" }], cites: [["fx_rv_food9"], ["fx_rv_food10"]] });
c({ ref: "fc_ved_plough", text: "Verses of the Rig Veda and the Atharva Veda were spoken at ploughing and sowing, asking for a good furrow and a full crop of barley.", kind: "fact", assessment: "supported", themes: ["economy", "religion"], lenses: ["primary_source"], entities: [{ entity: "rigveda" }, { entity: "atharvaveda" }, { entity: "a_vedic", role: "mention" }], cites: [["fx_rv_plough"], ["fx_rv_ploughnote"], ["fx_av_barley"], ["fx_av_barleyuse"], ["fx_rv_117c", "mentions"]] });
c({ ref: "fc_ved_rainrite", text: "An Atharva Veda hymn was used in a rite to bring rain; it asks that the herdsman whose cattle had grown lean in the drought might go home in the rain.", kind: "fact", assessment: "supported", assessmentNote: "That the lean cattle were thinned by drought is Whitney's reading of the verse.", themes: ["religion", "economy"], lenses: ["primary_source", "philological"], entities: [{ entity: "atharvaveda" }, { entity: "a_vedic", role: "mention" }], cites: [["fx_av_rainuse"], ["fx_av_rain6"], ["fx_av_rain6note"]], learning: { prompt: "What was the Atharva Veda hymn “For abundant rain” used for?" } });
c({ ref: "fc_ved_pests", text: "Another Atharva Veda hymn asks the gods to smite the rat and the borer “lest they eat the barley”.", kind: "fact", assessment: "supported", themes: ["economy", "religion"], lenses: ["primary_source"], entities: [{ entity: "atharvaveda" }], cites: [["fx_av_pests"]] });
c({ ref: "fc_ved_charity", text: "A late Rig Veda hymn tells the man with food in store not to harden his heart against the hungry: “the Gods have not ordained hunger to be our death”.", kind: "fact", assessment: "supported", themes: ["society", "religion"], lenses: ["primary_source"], entities: [{ entity: "rigveda" }, { entity: "a_vedic", role: "mention" }], cites: [["fx_rv_117a"], ["fx_rv_117b"]], learning: { prompt: "What does the Rig Veda hymn on Liberality say to the man with food in store?" } });
c({ ref: "fc_ved_ushasti", text: "The Chāndogya Upaniṣad tells of Uṣasti, who lived as a beggar after hail ruined the land of the Kurus, and ate a man's leftover beans because otherwise he would not have lived.", kind: "fact", assessment: "supported", assessmentNote: "A story in a religious text, not a dated record; the commentary says the hail brought famine.", themes: ["society", "religion"], lenses: ["primary_source"], entities: [{ entity: "chandogya" }, { entity: "a_vedic", role: "mention" }], cites: [["fx_chand_kurus"], ["fx_chand_beans"], ["fx_chand_live"], ["fx_chand_note"]], learning: { prompt: "In the Chāndogya Upaniṣad, why did Uṣasti eat another man's leftover beans?" } });

// 4. The Buddha's time
c({ ref: "fc_vin_rajagaha", text: "When food was scarce at Rājagaha, the Buddha allowed his monks to store food indoors and to cook it themselves, against their usual rules.", kind: "fact", assessment: "supported", assessmentNote: "The Vinaya's account of how the rule was made; compiled in the centuries after the Buddha.", themes: ["religion", "society"], lenses: ["primary_source"], entities: [{ entity: "vinaya" }, { entity: "rajagaha", role: "place" }, { entity: "a_maha", role: "mention" }], cites: [["fx_vin_raja"], ["fx_vin_indoors"], ["fx_vin_scarcity", "supports", "The allowances listed, as given “in a time of scarcity”."]], learning: { prompt: "What did the Buddha allow his monks to do when food was scarce at Rājagaha?" } });
c({ ref: "fc_vin_vesali", text: "When the harvest was good again at Vesālī, and one could live by gleaning, the Buddha withdrew the allowances he had made in the time of scarcity.", kind: "fact", assessment: "supported", themes: ["religion", "society"], lenses: ["primary_source"], entities: [{ entity: "vinaya" }, { entity: "a_maha", role: "mention" }], cites: [["fx_vin_vesali"], ["fx_vin_scarcity"], ["fx_vin_revoke"]] });
c({ ref: "fc_vin_flesh", text: "The Vinaya says that in famines people ate the flesh of the king's dead elephants and horses, and of dogs and snakes, and gave it to monks as alms.", kind: "fact", assessment: "supported", themes: ["society", "religion"], lenses: ["primary_source"], entities: [{ entity: "vinaya" }, { entity: "a_maha", role: "mention" }], cites: [["fx_vin_eleph"], ["fx_vin_dogs"]], learning: { prompt: "According to the Vinaya, what did people eat in famines?" } });
c({ ref: "fc_jat_kalinga", text: "A Jātaka story tells of a drought in Kalinga: the crops failed, and starving people wandered with their children before gathering at the king's door to demand that he make it rain.", kind: "fact", assessment: "supported", assessmentNote: "A moral tale, not a record of a dated famine; it shows what storytellers knew of hard years.", themes: ["society", "governance"], lenses: ["primary_source"], entities: [{ entity: "jataka" }, { entity: "kalinga", role: "place" }, { entity: "a_maha", role: "mention" }], cites: [["fx_jat_kalinga1"], ["fx_jat_kalinga2"], ["fx_jat_kalinga3"]], learning: { prompt: "In the Jātaka story of the Kalinga drought, what did the starving people ask their king to do?" } });
c({ ref: "fc_jat_kingrain", text: "In the Jātakas, rain depended on the king's righteousness: an unrighteous king brought drought and famine, and a king in a drought was expected to give alms, keep fasts and take vows.", kind: "interpretation", assessment: "supported", themes: ["governance", "religion"], lenses: ["primary_source"], entities: [{ entity: "jataka" }, { entity: "a_maha", role: "mention" }], cites: [["fx_jat_unright"], ["fx_jat_kalinga4"], ["fx_jat_kalinga3", "supports", "“Make rain for us, O king!”"]] });
c({ ref: "fc_jat_ox", text: "In another Jātaka, villagers in a famine borrowed an old ox from their headman to eat, promising to repay him in grain after the harvest.", kind: "fact", assessment: "supported", assessmentNote: "A story, but a plain picture of borrowing against the next harvest.", themes: ["economy", "society"], lenses: ["primary_source"], entities: [{ entity: "jataka" }, { entity: "a_maha", role: "mention" }], cites: [["fx_jat_famine199"], ["fx_jat_ox"]] });
c({ ref: "fc_jat_tanks", text: "Jātaka stories describe droughts in Kosala in which the crops withered and ponds, tanks and lakes dried up, and crows picked the fish out of the mud.", kind: "fact", assessment: "supported", themes: ["society", "infrastructure"], lenses: ["primary_source"], entities: [{ entity: "jataka" }, { entity: "a_maha", role: "mention" }], cites: [["fx_jat_kosala"], ["fx_jat_crows"]] });

// 5. The Mauryas
c({ ref: "fc_meg_never", text: "Megasthenes wrote that famine had never visited India, because two rainy seasons gave two harvests, and if one sowing failed the other did not.", kind: "fact", assessment: "supported", assessmentNote: "This is what Megasthenes reported, preserved by Diodorus three centuries later; it is not evidence that there were no famines.", themes: ["economy", "sources"], lenses: ["primary_source"], entities: [{ entity: "megasthenes", role: "author" }, { entity: "a_maurya", role: "mention" }], cites: [["fx_meg_never"], ["fx_meg_two"]], learning: { prompt: "Why did Megasthenes say that famine had never visited India?" } });
c({ ref: "fc_meg_crops", text: "Megasthenes described most of the land as irrigated, growing millet, pulses and rice in the summer rains and wheat in winter.", kind: "fact", assessment: "supported", themes: ["economy"], lenses: ["primary_source"], entities: [{ entity: "megasthenes", role: "author" }, { entity: "a_maurya", role: "mention" }], cites: [["fx_meg_irrig"], ["fx_meg_crops"], ["fx_meg_rains"]] });
c({ ref: "fc_meg_farmers", text: "Megasthenes also wrote that Indian armies left farmers at work unharmed, even with battle raging nearby.", kind: "fact", assessment: "supported", assessmentNote: "An ideal as much as a report; compare the Kalinga war, which Aśoka himself describes as killing and deporting many thousands.", themes: ["war", "economy"], lenses: ["primary_source"], entities: [{ entity: "megasthenes", role: "author" }], cites: [["fx_meg_farmers"]] });
c({ ref: "fc_jain_famine", text: "A Jain inscription at Śravaṇa Beḷgoḷa says that Bhadrabāhu foretold a twelve-year famine at Ujjayinī, and that the whole Jain community left the north for the south.", kind: "fact", assessment: "supported", assessmentNote: "What the inscription says; its date, and whether the famine happened, are debated.", themes: ["religion", "society"], lenses: ["primary_source"], entities: [{ entity: "bhadrabahu" }, { entity: "shravanabelagola", role: "place" }, { entity: "a_maurya", role: "mention" }], cites: [["fx_rice_insc"]], learning: { prompt: "What does the Śravaṇa Beḷgoḷa inscription say Bhadrabāhu foretold?" } });
c({ ref: "fc_jain_chandragupta", text: "Later Jain narratives say that when the famine began Chandragupta Maurya gave up his throne to his son and followed Bhadrabāhu south as a monk.", kind: "fact", assessment: "supported", assessmentNote: "Reported from a Kannada compendium drawn up in the early 19th century, more than two thousand years after the events.", themes: ["religion", "polity"], lenses: ["primary_source"], entities: [{ entity: "chandragupta" }, { entity: "bhadrabahu", role: "participant" }], cites: [["fx_rice_abdicate"], ["fx_rice_rajavali", "qualifies", "The source is a 19th-century compendium."]] });
c({ ref: "fc_jain_suffer", text: "The same narratives say that in the north, where some stayed, all the grain was eaten, nothing growing was left, and people wandered in search of food and died.", kind: "fact", assessment: "supported", assessmentNote: "A late narrative, summarised by Rice (1889).", themes: ["society"], lenses: ["primary_source"], entities: [{ entity: "a_maurya", role: "mention" }], cites: [["fx_rice_suffer"], ["fx_rice_rajavali", "qualifies"]] });
c({ ref: "fc_jain_debate", text: "Historians have disagreed about the Jain famine tradition: Rice (1889) thought the twelve-year famine might be accepted as real, Smith (1914) came to think the tradition true in outline though its inscriptional support was weak, and Fleet rejected it.", kind: "debate", assessment: "contested", themes: ["historiography"], lenses: ["colonial_orientalist"], entities: [{ entity: "chandragupta", role: "mention" }, { entity: "bhadrabahu", role: "mention" }], cites: [["fx_rice_admit"], ["fx_smith_jain"], ["fx_smith_epi"], ["fx_smith_fleet"]] });
c({ ref: "fc_arth_famine", text: "The Arthaśāstra tells a king in famine to give his people seed and food, open his own stores or the hoards of the rich, seek help from allied kings, or lead his people to better-watered land.", kind: "fact", assessment: "supported", assessmentNote: "A treatise's advice, of debated date (between the 4th century BCE and the 3rd century CE), not a record of what was done.", themes: ["governance", "economy"], lenses: ["primary_source"], entities: [{ entity: "t_arthashastra" }, { entity: "kautilya", role: "author" }, { entity: "a_maurya", role: "mention" }], cites: [["fx_arth_famine1"], ["fx_arth_famine2"], ["fx_arth_famine3"], ["fx_arth_famine4"]], learning: { prompt: "What does the Arthaśāstra tell a king to do in a famine?" } });
c({ ref: "fc_arth_reserve", text: "The Arthaśāstra orders that half of what is gathered in the royal storehouse be kept in reserve against calamities, and the old stock replaced with new.", kind: "fact", assessment: "supported", themes: ["governance", "economy"], lenses: ["primary_source"], entities: [{ entity: "t_arthashastra" }, { entity: "t_koshthagara", role: "mention" }], cites: [["fx_arth_reserve"]], learning: { prompt: "How much of the royal storehouse does the Arthaśāstra say to keep in reserve?" } });
c({ ref: "fc_arth_worst", text: "Kauṭilya argues that famine is worse than pestilence, because it brings distress to the whole country and every creature.", kind: "fact", assessment: "supported", themes: ["governance"], lenses: ["primary_source"], entities: [{ entity: "t_arthashastra" }, { entity: "kautilya", role: "author" }], cites: [["fx_arth_worst"]] });
c({ ref: "fc_arth_rain", text: "The Arthaśāstra has a rain-gauge set up in front of the storehouse, and tells the superintendent of agriculture to sow crops that need more or less water according to the rainfall.", kind: "fact", assessment: "supported", themes: ["governance", "technology"], lenses: ["primary_source"], entities: [{ entity: "t_arthashastra" }], cites: [["fx_arth_gauge"], ["fx_arth_sow"]] });
c({ ref: "fc_arth_tanks", text: "To encourage irrigation, the Arthaśāstra remits taxes for five years on land watered by a newly built tank, and for four years where a ruined one is repaired.", kind: "fact", assessment: "supported", themes: ["governance", "infrastructure"], lenses: ["primary_source"], entities: [{ entity: "t_arthashastra" }], cites: [["fx_arth_tanks"]] });
c({ ref: "fc_arth_worship", text: "In drought, the Arthaśāstra says, Indra, the Ganges, the mountains and Mahākacchha are to be worshipped.", kind: "fact", assessment: "supported", themes: ["religion", "governance"], lenses: ["primary_source"], entities: [{ entity: "t_arthashastra" }], cites: [["fx_arth_drought"]] });
c({ ref: "fc_sohgaura", text: "The Sohgaura copper plate, of the Maurya period, announces two storehouses: Bühler (1896) read it as grain stored for times of need, Fleet (1907) as storehouses for goods travelling on three high roads, for use in emergencies.", kind: "debate", assessment: "contested", themes: ["governance", "sources"], lenses: ["philological"], entities: [{ entity: "sohgaura" }, { entity: "t_koshthagara", role: "mention" }, { entity: "a_maurya", role: "mention" }], cites: [["fx_sohg_buhler"], ["fx_sohg_fleet"], ["fx_sohg_emerg"]] });
c({ ref: "fc_mahasthan", text: "A Maurya-period inscription from Mahāsthān, in Bengal, records paddy granted from a granary to a people in distress, the Saṃvaṅgīyas, to be returned with coin to the granary and treasury when plenty came back.", kind: "fact", assessment: "supported", assessmentNote: "The inscription is fragmentary; that the distress was a famine is its editor's reading (“apparently”).", themes: ["governance", "economy"], lenses: ["primary_source", "philological"], entities: [{ entity: "mahasthan_insc" }, { entity: "mahasthangarh", role: "place" }, { entity: "a_maurya", role: "mention" }], cites: [["fx_mah_paddy"], ["fx_mah_trans"], ["fx_mah_summary"]], learning: { prompt: "What did the Mahāsthān inscription order to be given to the Saṃvaṅgīyas, and on what terms?" } });
c({ ref: "fc_sudarsana_maurya", text: "The Sudarśana lake below Girnar was first made under Chandragupta Maurya by his governor Puṣyagupta, and fitted with conduits under Aśoka.", kind: "fact", assessment: "supported", assessmentNote: "Known from Rudradāman's inscription, cut about four and a half centuries later.", themes: ["infrastructure", "governance"], lenses: ["primary_source"], entities: [{ entity: "sudarshana" }, { entity: "chandragupta", role: "participant" }, { entity: "ashoka", role: "participant" }, { entity: "girnar", role: "place" }], cites: [["fx_rud_maurya"], ["fx_rud_asoka"]], learning: { prompt: "Under which Maurya king was the Sudarśana lake first made?" } });
c({ ref: "fm_never_famine", text: "Ancient India never knew famine.", kind: "misconception", assessment: "refuted", assessmentNote: "The idea goes back to Megasthenes' remark. Buddhist rules, Jain traditions, a Maurya-period relief order, the Arthaśāstra's famine measures and Kalhaṇa's chronicle all speak of famines.", themes: ["historiography"], lenses: ["popular"], cites: [["fx_meg_never", "mentions", "Where the idea comes from."], ["fx_vin_raja", "contradicts"], ["fx_arth_famine1", "contradicts"], ["fx_st_v271", "contradicts"]] });

// 6. A lake rebuilt: the middle kingdoms and the Guptas
c({ ref: "fc_rud_storm", text: "In 150 CE a storm and floods burst the dam of the Sudarśana lake, leaving a breach 420 cubits long, and all its water ran out.", kind: "fact", assessment: "supported", when: { start: ce(150), basis: "Year 72, read by Kielhorn as the Śaka era: 16 November (or 18 October) 150 CE" }, themes: ["infrastructure"], lenses: ["primary_source"], entities: [{ entity: "sudarshana" }, { entity: "junagadh_rud", role: "mention" }, { entity: "a_middle", role: "mention" }], cites: [["fx_rud_storm"], ["fx_rud_breach"], ["fx_rud_date"]] });
c({ ref: "fc_rud_repair", text: "Rudradāman's inscription says he rebuilt the dam three times as strong, at great cost from his own treasury, without burdening townspeople and villagers with taxes, forced labour or levies.", kind: "fact", assessment: "supported", assessmentNote: "The king's own inscription: a claim made for him, not an independent report.", themes: ["governance", "infrastructure"], lenses: ["primary_source"], entities: [{ entity: "rudradaman" }, { entity: "sudarshana", role: "place" }, { entity: "junagadh_rud", role: "mention" }, { entity: "a_middle", role: "mention" }], cites: [["fx_rud_repair"], ["fx_rud_treasury"]], learning: { prompt: "How does Rudradāman's inscription say the dam was paid for?" } });
c({ ref: "fc_rud_despair", text: "The inscription says his counsellors opposed the repair as hopeless, while the people despaired of the dam ever being rebuilt; his minister Suviśākha, a Pahlava, carried out the work.", kind: "fact", assessment: "supported", themes: ["governance", "society"], lenses: ["primary_source"], entities: [{ entity: "rudradaman" }, { entity: "junagadh_rud", role: "mention" }], cites: [["fx_rud_opposed"], ["fx_rud_despair"], ["fx_rud_suvisakha"]] });
c({ ref: "fc_sk_burst", text: "In 455–456 CE, after long, unceasing rain, the Sudarśana lake burst again; under Skandagupta, the governor's son Cakrapālita rebuilt the embankment in two months.", kind: "fact", assessment: "supported", when: { start: ce(455), end: ce(457), basis: "Gupta years 136–137, as Fleet converts them" }, themes: ["infrastructure", "governance"], lenses: ["primary_source"], entities: [{ entity: "sudarshana" }, { entity: "skandagupta", role: "mention" }, { entity: "a_gupta", role: "mention" }], cites: [["fx_sk_burst"], ["fx_sk_date"], ["fx_sk_son"], ["fx_sk_rebuilt"]], learning: { prompt: "What happened to the Sudarśana lake in 455–456 CE?" } });
c({ ref: "fc_sk_despair", text: "Skandagupta's inscription says the people fell into despair, lying awake all night wondering what to do.", kind: "fact", assessment: "supported", themes: ["society"], lenses: ["primary_source"], entities: [{ entity: "sudarshana", role: "place" }, { entity: "a_gupta", role: "mention" }], cites: [["fx_sk_despair"]] });
c({ ref: "fc_sk_prayer", text: "It ends with a prayer that the city be free from drought and famine for a hundred years.", kind: "fact", assessment: "supported", themes: ["religion", "society"], lenses: ["primary_source"], entities: [{ entity: "skandagupta", role: "mention" }, { entity: "a_gupta", role: "mention" }], cites: [["fx_sk_prayer"]] });

// 7. What the law allowed the starving
c({ ref: "fc_manu_starving", text: "The law book of Manu says that a man in danger of losing his life may take food from anyone, and cites sages who, starving, sought to eat dog's flesh without sin.", kind: "fact", assessment: "supported", assessmentNote: "A rule for Brahmins in distress (āpaddharma), using old stories as precedents; it shows what the law allowed, not how often it happened.", themes: ["religion", "society"], lenses: ["primary_source"], entities: [{ entity: "manusmriti" }, { entity: "t_apaddharma", role: "mention" }, { entity: "a_middle", role: "mention" }], cites: [["fx_manu104"], ["fx_manu106"], ["fx_manu108"]], learning: { prompt: "What does Manu allow a man in danger of losing his life to do?" } });
c({ ref: "fc_manu_seventh", text: "Manu allows a man who has gone without six meals to take food at the seventh from a threshing-floor, a field or a house, but he must confess it if the owner asks.", kind: "fact", assessment: "supported", themes: ["society", "religion"], lenses: ["primary_source"], entities: [{ entity: "manusmriti" }, { entity: "t_apaddharma", role: "mention" }], cites: [["fx_manu_xi16"], ["fx_manu_xi17"]] });
c({ ref: "fc_manu_date", text: "Most scholars date the law book of Manu between about 200 BCE and 200 CE; Bühler (1886) argued it existed by the second century CE at the latest.", kind: "fact", assessment: "well_supported", when: { start: bce(200, true), end: ce(200, true) }, themes: ["sources"], lenses: ["mainstream_academic", "philological"], entities: [{ entity: "manusmriti" }], cites: [["fx_wpmanu_date"], ["fx_manu_date"]] });

// 8. Charity and daily bread
c({ ref: "fc_fax_charity", text: "Faxian, a Chinese monk in India about 399–414 CE, saw houses in the cities of Magadha where the heads of Vaiśya families gave the poor, orphans, the disabled and the sick food, medicine and a doctor's care.", kind: "fact", assessment: "supported", when: { start: ce(399), end: ce(414) }, themes: ["society", "religion"], lenses: ["primary_source"], entities: [{ entity: "faxian", role: "author" }, { entity: "a_gupta", role: "mention" }], cites: [["fx_fax_charity"], ["fx_fax_food"]], learning: { prompt: "What did Faxian see in the cities of Magadha that cared for the poor and sick?" } });
c({ ref: "fc_fax_land", text: "Faxian wrote that in the Middle Kingdom only those who farmed the king's land paid a share of what it yielded, and that people could go or stay as they wished.", kind: "fact", assessment: "supported", themes: ["economy", "governance"], lenses: ["primary_source"], entities: [{ entity: "faxian", role: "author" }, { entity: "a_gupta", role: "mention" }], cites: [["fx_fax_land"]] });
c({ ref: "fc_fax_diet", text: "Faxian also wrote that people in the Middle Kingdom killed no living creature and ate no onions or garlic, except the Caṇḍālas, who lived apart and alone fished, hunted and sold meat.", kind: "fact", assessment: "supported", assessmentNote: "A Buddhist pilgrim's picture of the people he moved among; it is not a survey of what everyone ate.", themes: ["society"], lenses: ["primary_source"], entities: [{ entity: "faxian", role: "author" }, { entity: "a_gupta", role: "mention" }], cites: [["fx_fax_diet"], ["fx_fax_chandala"]] });
c({ ref: "fc_xz_food", text: "The Chinese pilgrim Xuanzang wrote that rice and wheat were the most plentiful crops, and that the most usual food was milk, butter, cream, sugar, mustard oil and cakes of grain.", kind: "fact", assessment: "supported", themes: ["society", "economy"], lenses: ["primary_source"], entities: [{ entity: "xuanzang", role: "author" }, { entity: "a_earlymed", role: "mention" }], cites: [["fx_xz_crops"], ["fx_xz_food"]], learning: { prompt: "What did Xuanzang say was the most usual food in India?" } });
c({ ref: "fc_xz_tax", text: "He wrote that everyone tilled the ground for a living, that those who farmed the royal estates paid a sixth of the produce, and that labour for public works was paid for.", kind: "fact", assessment: "supported", themes: ["economy", "governance"], lenses: ["primary_source"], entities: [{ entity: "xuanzang", role: "author" }, { entity: "a_earlymed", role: "mention" }], cites: [["fx_xz_till"], ["fx_xz_sixth"], ["fx_xz_labour"]] });

// 9. Tanks in the south, and a visitor's eye
c({ ref: "fc_utt_tank", text: "At Uttaramerūr in the Tamil country, inscriptions of the tenth century set out how the village assembly chose its committees by lot each year, among them a tank committee of six.", kind: "fact", assessment: "supported", themes: ["governance", "infrastructure"], lenses: ["primary_source"], entities: [{ entity: "uttaramerur", role: "place" }, { entity: "a_earlymed", role: "mention" }], cites: [["fx_utt_tank"], ["fx_utt_year"], ["fx_utt_tenth"]], learning: { prompt: "How many men served on Uttaramerūr's tank committee?" } });
c({ ref: "fc_utt_duties", text: "The tank committee probably cleared the silt each year, made repairs and managed gifts made for the tanks, in the reading of the inscriptions' editor.", kind: "interpretation", assessment: "supported", themes: ["infrastructure", "governance"], lenses: ["philological"], entities: [{ entity: "uttaramerur", role: "place" }], cites: [["fx_utt_duties"]] });
c({ ref: "fc_alb_tanks", text: "Al-Bīrūnī, writing about 1030, admired the stepped stone tanks built at holy places, which he said Muslims could neither describe nor copy.", kind: "fact", assessment: "supported", when: { start: ce(1030, true) }, themes: ["infrastructure", "culture"], lenses: ["primary_source"], entities: [{ entity: "albiruni", role: "author" }, { entity: "a_earlymed", role: "mention" }], cites: [["fx_alb_ponds"]] });
c({ ref: "fc_alb_cow", text: "Al-Bīrūnī gave an economic reason for the ban on eating beef: the cow carries loads, draws the plough and gives milk.", kind: "interpretation", assessment: "supported", assessmentNote: "One of several explanations he reports; he says he is uncertain which is right.", themes: ["society", "economy"], lenses: ["primary_source"], entities: [{ entity: "albiruni", role: "author" }], cites: [["fx_alb_cow"]] });

// 10. Kashmir
c({ ref: "fc_kash_tunjina", text: "Kalhaṇa tells of a famine under an early king, Tuñjīna, after snow fell on the ripening rice in autumn; hunger made people abandon their families, and the king and queen fed them from the treasury.", kind: "fact", assessment: "supported", assessmentNote: "A legend: Stein places Tuñjīna before the start of authentic history in Kalhaṇa's record, and the famine ends with a miracle.", themes: ["society", "governance"], lenses: ["primary_source"], entities: [{ entity: "kalhana", role: "author" }, { entity: "kashmir_valley", role: "place" }], cites: [["fx_st_tun_snow"], ["fx_st_tun_famine"], ["fx_st_tun_family"], ["fx_st_tun_king"], ["fx_st_tun_note", "qualifies"]] });
c({ ref: "fc_kash_historical", text: "Stein judged Kalhaṇa's chronicle a truly historical record from the reign of Avantivarman (855/6–883) onwards.", kind: "interpretation", assessment: "supported", themes: ["sources", "historiography"], lenses: ["philological"], entities: [{ entity: "kalhana" }, { entity: "utpala", role: "mention" }], cites: [["fx_st_historical"]] });
c({ ref: "fc_kash_floods", text: "In Kashmir, Stein wrote, floods were always the main cause of famine; Kalhaṇa says that in one flood famine before Avantivarman's reign a khārī of rice cost 1,050 dīnnāras.", kind: "interpretation", assessment: "supported", themes: ["economy", "infrastructure"], lenses: ["philological", "primary_source"], entities: [{ entity: "kashmir_valley", role: "place" }, { entity: "t_khari", role: "mention" }], cites: [["fx_st_floods"], ["fx_st_v71"]] });
c({ ref: "fc_kash_suyya", text: "Under King Avantivarman, the engineer Suyya dammed and cleared the Vitastā (Jhelum), cut it new channels where floods broke through, and drained flooded land for rice.", kind: "fact", assessment: "supported", when: { start: ce(855, true), end: ce(883) }, themes: ["infrastructure", "governance"], lenses: ["primary_source"], entities: [{ entity: "jhelum", role: "place" }, { entity: "kashmir_valley", role: "place" }, { entity: "utpala", role: "mention" }], cites: [["fx_st_v91"], ["fx_st_v95"], ["fx_st_floods"], ["fx_st_v89", "mentions"]], learning: { prompt: "What did Suyya do to the Vitastā?" } });
c({ ref: "fc_kash_coins", text: "Kalhaṇa says Suyya threw coins into the river so that famine-stricken villagers, searching for them, would drag the rocks out of its bed.", kind: "fact", assessment: "supported", assessmentNote: "Kalhaṇa's story; Stein notes that it caught the popular imagination, then and later.", themes: ["society", "infrastructure"], lenses: ["primary_source"], entities: [{ entity: "jhelum", role: "place" }, { entity: "t_dinnara", role: "mention" }], cites: [["fx_st_v87"], ["fx_st_v89"]] });
c({ ref: "fc_kash_price", text: "Kalhaṇa says that after Suyya's works the price of a khārī of rice fell from 200 dīnnāras, even in good years, to 36.", kind: "fact", assessment: "supported", assessmentNote: "Stein calls the fall “alleged”: Kalhaṇa wrote two and a half centuries later.", themes: ["economy"], lenses: ["primary_source"], entities: [{ entity: "kashmir_valley", role: "place" }, { entity: "t_khari", role: "mention" }, { entity: "t_dinnara", role: "mention" }], cites: [["fx_st_v116"], ["fx_st_alleged", "qualifies"]], learning: { prompt: "According to Kalhaṇa, how far did the price of rice fall after Suyya's works?" } });
c({ ref: "fc_kash_917", text: "In 917–918 CE a flood destroyed Kashmir's autumn rice crop; in the famine that followed a khārī of rice sold for a thousand dīnnāras.", kind: "fact", assessment: "well_supported", when: { start: ce(917), end: ce(918), basis: "Laukika 3993 (Kalhaṇa V.271), as Stein converts it" }, themes: ["economy", "society"], lenses: ["primary_source"], entities: [{ entity: "famine917" }, { entity: "kashmir_valley", role: "place" }, { entity: "t_khari", role: "mention" }], cites: [["fx_st_v270"], ["fx_st_v271"], ["fx_smith_917"]], learning: { prompt: "What caused the Kashmir famine of 917–918, and what did rice cost?" } });
c({ ref: "fc_kash_corpses", text: "Kalhaṇa writes that the Vitastā was so covered with swollen corpses that its water could scarcely be seen, and the land was strewn with bones like a burial ground.", kind: "fact", assessment: "supported", assessmentNote: "Written about 230 years after the event; Kalhaṇa gives no number of dead.", themes: ["society"], lenses: ["primary_source"], entities: [{ entity: "famine917" }, { entity: "jhelum", role: "place" }], cites: [["fx_st_v272"], ["fx_st_v273"]] });
c({ ref: "fc_kash_profit", text: "Kalhaṇa says the king's ministers and the Tantrin guards grew rich selling stored rice at high prices, while the regent Paṅgu stayed comfortable in his palace and watched the people suffer.", kind: "fact", assessment: "supported", themes: ["governance", "economy"], lenses: ["primary_source"], entities: [{ entity: "famine917" }, { entity: "kalhana", role: "author" }], cites: [["fx_st_v274"], ["fx_st_v276"]], learning: { prompt: "Who grew rich in the Kashmir famine of 917–918, according to Kalhaṇa?" } });
c({ ref: "fc_smith_relief", text: "The historian Vincent Smith, writing in 1914, used this famine to suggest that critics of British famine relief should reflect on it.", kind: "interpretation", assessment: "supported", themes: ["historiography"], lenses: ["colonial_orientalist"], entities: [{ entity: "famine917", role: "mention" }], cites: [["fx_smith_relief"], ["fx_smith_917", "mentions"]] });

export const RELATIONS: [string, string, "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", string?][] = [
  ["fc_ind_gradual", "fm_ind_sudden", "corrects"],
  ["fc_ind_east", "fm_ind_sudden", "corrects"],
  ["fc_ind_drought", "fm_ind_sudden", "qualifies", "Drought is a leading explanation of the decline, not of a sudden end."],
  ["fc_ind_granary", "fm_ind_granary", "corrects"],
  ["fc_ind_marshall", "fc_ind_drought", "context_for", "An early argument that the climate had changed."],
  ["fc_jain_famine", "fm_never_famine", "corrects"],
  ["fc_vin_rajagaha", "fm_never_famine", "corrects"],
  ["fc_arth_famine", "fm_never_famine", "corrects"],
  ["fc_kash_917", "fm_never_famine", "corrects"],
  ["fc_meg_never", "fm_never_famine", "context_for", "Where the idea comes from."],
  ["fc_jain_famine", "fc_meg_never", "contradicts", "A twelve-year famine in the reign Megasthenes describes, if the tradition is true."],
  ["fc_jain_debate", "fc_jain_famine", "qualifies"],
  ["fc_jain_debate", "fc_jain_chandragupta", "qualifies"],
  ["fc_sudarsana_maurya", "fc_rud_storm", "context_for"],
  ["fc_rud_storm", "fc_sk_burst", "context_for", "The same dam failed again three centuries later."],
  ["fc_kash_floods", "fc_kash_suyya", "context_for"],
  ["fc_kash_suyya", "fc_kash_price", "context_for"],
  ["fc_kash_historical", "fc_kash_917", "context_for", "Within the part of the chronicle Stein judged historical."],
  ["fc_kash_historical", "fc_kash_tunjina", "qualifies", "Before the part Stein judged historical."],
  ["fc_smith_relief", "fc_kash_profit", "context_for"],
  ["fc_manu_date", "fc_manu_starving", "context_for"],
  ["fc_jat_kingrain", "fc_jat_kalinga", "context_for"],
];

// ---------------------------------------------------------------- ops

export function contentOps(S: ResolvedSources, E: Record<string, string>): ChangeOpInput[] {
  const ent = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const ops: ChangeOpInput[] = [];
  for (const ex of EXCERPTS)
    ops.push({
      op: "create_excerpt",
      ref: ex.ref,
      source: S.ref[ex.source],
      snapshotId: S.snap[ex.source],
      quote: ex.quote,
      locator: ex.locator,
      ...(ex.note ? { note: ex.note } : {}),
    } as ChangeOpInput);
  const excerptRefs = new Set(EXCERPTS.map((e) => e.ref));
  for (const cl of CLAIMS) {
    ops.push({
      op: "create_claim",
      ref: cl.ref,
      text: cl.text,
      kind: cl.kind,
      assessment: cl.assessment,
      ...(cl.assessmentNote ? { assessmentNote: cl.assessmentNote } : {}),
      ...(cl.when ? { when: cl.when } : {}),
      themes: cl.themes,
      ...(cl.lenses ? { lenses: cl.lenses } : {}),
      ...(cl.entities ? { entities: cl.entities.map((e) => ({ role: "subject", ...e, entity: ent(e.entity) })) } : {}),
      ...(cl.learning ? { learning: cl.learning } : {}),
    } as ChangeOpInput);
    for (const [exRef, stance = "supports", note] of cl.cites) {
      if (!excerptRefs.has(exRef)) throw new Error(`claim ${cl.ref} cites unknown excerpt ${exRef}`);
      ops.push({ op: "cite", claim: `@${cl.ref}`, excerpt: `@${exRef}`, stance, ...(note ? { note } : {}) } as ChangeOpInput);
    }
  }
  for (const [from, to, type, note] of RELATIONS) ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) } as ChangeOpInput);
  return ops;
}

// ---------------------------------------------------------------- cells

export type FacetKey = "food" | "water" | "work" | "failure" | "coping" | "rulers" | "toll" | "after";
export const FACETS: { key: FacetKey; label: string; description: string }[] = [
  { key: "food", label: "Food", description: "What people ate in ordinary years" },
  { key: "water", label: "Water", description: "Rain, rivers, wells, tanks, canals" },
  { key: "work", label: "Work", description: "How people earned a living" },
  { key: "failure", label: "When the rains failed", description: "What went first, prices, what famine looked like" },
  { key: "coping", label: "Getting by", description: "What people did to survive" },
  { key: "rulers", label: "Rulers", description: "What rulers and the state did, or did not do" },
  { key: "toll", label: "The toll", description: "Deaths, disease, flight, what was destroyed" },
  { key: "after", label: "Afterwards", description: "How life changed afterwards; memory" },
];

/** Ages this page covers: entity ref, slug, column label and the chapter it links to. */
export const AGES: { ref: string; slug: string; label: string; target: string }[] = [
  { ref: "a_farming", slug: "early-farming-communities", label: "First farmers", target: "ch-farmers" },
  { ref: "a_harappan", slug: "harappan-civilisation", label: "Indus cities", target: "ch-indus" },
  { ref: "a_vedic", slug: "vedic-period", label: "Vedic age", target: "ch-vedic" },
  { ref: "a_maha", slug: "mahajanapadas", label: "Age of the Buddha", target: "ch-buddha" },
  { ref: "a_maurya", slug: "maurya-empire", label: "Mauryas", target: "ch-maurya" },
  { ref: "a_middle", slug: "middle-kingdoms", label: "Middle kingdoms", target: "ch-lake" },
  { ref: "a_gupta", slug: "gupta-empire", label: "Guptas", target: "ch-charity" },
  { ref: "a_earlymed", slug: "early-medieval-india", label: "Early medieval", target: "ch-kashmir" },
];

/**
 * One cell per facet per age where there is evidence. `text` links claims as
 * [words](claim:<ref>) with the claim's spec ref; `quote` is an excerpt ref.
 * The page resolves refs as @refs; famineCells() resolves them to ids.
 */
export interface CellSpec {
  facet: FacetKey;
  age: string;
  text: string;
  quote?: string;
}
const L = (ref: string, words: string) => `[${words}](claim:${ref})`;
export const CELLS: CellSpec[] = [
  // First farmers
  { facet: "food", age: "a_farming", text: `At Mehrgarh, ${L("fc_mehr_crops", "barley above all, with wheat, dates and the milk and meat of sheep, goats and cattle")}.` },
  { facet: "work", age: "a_farming", text: `${L("fc_mehr_crops", "Farming and herding")}; ${L("fc_mehr_granary", "grain kept in granaries beside mud-brick houses")}.` },
  // Indus cities
  { facet: "food", age: "a_harappan", text: `${L("fc_ind_grains", "Wheat and barley, beef, mutton, fish and poultry")}; ${L("fc_ind_seasons", "summer crops of rice, millets and beans as well")}.`, quote: "fx_mar_wheat" },
  { facet: "water", age: "a_harappan", text: `${L("fc_ind_wells", "Over 700 wells at Mohenjo-daro")}; ${L("fc_ind_dholavira", "stone reservoirs at Dholavira, where years could pass without rain")}.`, quote: "fx_dhol_wp2" },
  { facet: "work", age: "a_harappan", text: `${L("fc_ind_seasons", "Farming in two seasons, each needing its own watering")}.` },
  { facet: "failure", age: "a_harappan", text: `${L("fc_ind_drought", "A long drought around 2200 BCE is a leading, and debated, explanation")} of the cities' decline; ${L("fc_ind_marshall", "Marshall already thought the climate had changed")}.` },
  { facet: "rulers", age: "a_harappan", text: `${L("fc_ind_granary", "The “Great Granary” is now doubted")}: no grain has been found in it, so a state grain store is not proven.` },
  { facet: "after", age: "a_harappan", text: `${L("fc_ind_gradual", "A slow decline, 1900–1700 BCE")}: ${L("fc_ind_east", "more varied crops, and villages moving east and south")}.`, quote: "fx_ivc_east" },
  // Vedic age
  { facet: "food", age: "a_vedic", text: `${L("fc_ved_food", "Milk, barley-brew and cakes of meal")}; ${L("fc_ved_plough", "barley prayed over at sowing")}.`, quote: "fx_rv_food9" },
  { facet: "water", age: "a_vedic", text: `${L("fc_ved_parjanya", "Rain from Parjanya, the rain cloud")}, and ${L("fc_ved_vritra", "the waters Indra freed by slaying Vṛtra")}.`, quote: "fx_rv_parj4" },
  { facet: "work", age: "a_vedic", text: `${L("fc_ved_plough", "Ploughing with oxen, begun with verses for a good furrow")}; ${L("fc_ved_pests", "charms against rats and borers in the barley")}.`, quote: "fx_rv_plough" },
  { facet: "failure", age: "a_vedic", text: `${L("fc_ved_rainrite", "Herds grown lean in drought")}, and ${L("fc_ved_ushasti", "a land of the Kurus ruined by hail")}.`, quote: "fx_av_rain6" },
  { facet: "coping", age: "a_vedic", text: `${L("fc_ved_rainrite", "Rites to bring rain")}; ${L("fc_ved_ushasti", "begging, and eating another's leftovers to live")}; ${L("fc_ved_charity", "a hymn urging the well-fed to feed the hungry")}.`, quote: "fx_rv_117a" },
  // Age of the Buddha
  { facet: "food", age: "a_maha", text: `${L("fc_vin_rajagaha", "Rice, salt and oil")} brought as gifts; in good years ${L("fc_vin_vesali", "one could live by gleaning")}.`, quote: "fx_vin_vesali" },
  { facet: "water", age: "a_maha", text: `${L("fc_jat_tanks", "Ponds, tanks and lakes that dried up in drought")}.`, quote: "fx_jat_kosala" },
  { facet: "work", age: "a_maha", text: `${L("fc_vin_vesali", "Harvest and gleaning")}; ${L("fc_jat_ox", "villagers under a headman, paying in kind after harvest")}.` },
  { facet: "failure", age: "a_maha", text: `${L("fc_jat_kalinga", "No rain, failed crops, people wandering with their children")}; ${L("fc_vin_rajagaha", "alms hard to get even for monks")}.`, quote: "fx_jat_kalinga3" },
  { facet: "coping", age: "a_maha", text: `${L("fc_vin_flesh", "Eating dead elephants, horses, dogs and snakes")}; ${L("fc_jat_ox", "borrowing an ox to eat against the next harvest")}; ${L("fc_vin_rajagaha", "relaxing rules on storing and cooking food")}.`, quote: "fx_vin_eleph" },
  { facet: "rulers", age: "a_maha", text: `${L("fc_jat_kingrain", "Rain was the king's duty")}: ${L("fc_jat_kalinga", "the hungry gathered at his door")} and he was to give alms and keep vows.`, quote: "fx_jat_unright" },
  { facet: "after", age: "a_maha", text: `${L("fc_vin_vesali", "When harvests returned, the famine allowances were withdrawn")}.`, quote: "fx_vin_revoke" },
  // Mauryas
  { facet: "food", age: "a_maurya", text: `${L("fc_meg_crops", "Millet, pulses and rice in the summer rains, wheat in winter")}.`, quote: "fx_meg_crops" },
  { facet: "water", age: "a_maurya", text: `${L("fc_meg_crops", "Much land irrigated")}; ${L("fc_sudarsana_maurya", "the Sudarśana reservoir built under Chandragupta")}; ${L("fc_arth_tanks", "tax relief for new tanks")}.` },
  { facet: "work", age: "a_maurya", text: `${L("fc_meg_farmers", "Farmers left at work even near battles")}, by Megasthenes' account; ${L("fc_arth_rain", "sowing matched to measured rainfall")}.` },
  { facet: "failure", age: "a_maurya", text: `${L("fc_meg_never", "Megasthenes said famine never came")}, but ${L("fc_jain_famine", "Jain tradition remembers a twelve-year famine")}.`, quote: "fx_meg_never" },
  { facet: "coping", age: "a_maurya", text: `${L("fc_jain_famine", "Migration: the Jain community moved south")}; ${L("fc_jain_suffer", "those who stayed wandered in search of food")}.`, quote: "fx_rice_insc" },
  { facet: "rulers", age: "a_maurya", text: `${L("fc_arth_famine", "Seed and food from the king's stores")}, ${L("fc_arth_reserve", "half the store kept for calamities")}, and ${L("fc_mahasthan", "paddy lent from a granary at Mahāsthān")}.`, quote: "fx_arth_famine1" },
  { facet: "toll", age: "a_maurya", text: `${L("fc_jain_suffer", "In the Jain narratives, people perished searching for food")}; ${L("fc_arth_worst", "Kauṭilya ranked famine above pestilence")}.`, quote: "fx_arth_worst" },
  { facet: "after", age: "a_maurya", text: `${L("fc_jain_chandragupta", "Jains remember Chandragupta becoming a monk")}; ${L("fc_jain_debate", "historians still argue over whether it happened")}.` },
  // Middle kingdoms
  { facet: "water", age: "a_middle", text: `${L("fc_rud_storm", "In 150 CE floods burst the Sudarśana dam and the lake ran dry")}.`, quote: "fx_rud_breach" },
  { facet: "coping", age: "a_middle", text: `${L("fc_manu_starving", "Manu lets a man near death take food from anyone")}, and ${L("fc_manu_seventh", "after six missed meals take grain from a field or threshing-floor")}.`, quote: "fx_manu104" },
  { facet: "rulers", age: "a_middle", text: `${L("fc_rud_repair", "Rudradāman rebuilt the dam from his own treasury, without forced labour")}, ${L("fc_rud_despair", "over his counsellors' objections")}.`, quote: "fx_rud_repair" },
  // Guptas
  { facet: "food", age: "a_gupta", text: `${L("fc_fax_diet", "Faxian saw no meat, onions or garlic eaten, except by the Caṇḍālas")}.`, quote: "fx_fax_diet" },
  { facet: "water", age: "a_gupta", text: `${L("fc_sk_burst", "The Sudarśana lake burst again in 455–456 and was rebuilt in two months")}.`, quote: "fx_sk_burst" },
  { facet: "work", age: "a_gupta", text: `${L("fc_fax_land", "Those who farmed the king's land paid a share; others could come and go")}.`, quote: "fx_fax_land" },
  { facet: "coping", age: "a_gupta", text: `${L("fc_fax_charity", "Houses in Magadha's cities gave the poor and sick food and medicine")}.`, quote: "fx_fax_charity" },
  { facet: "rulers", age: "a_gupta", text: `${L("fc_sk_burst", "Skandagupta's governor rebuilt the dam")}, ${L("fc_sk_despair", "while the people lay awake in despair")}.`, quote: "fx_sk_despair" },
  { facet: "after", age: "a_gupta", text: `${L("fc_sk_prayer", "A prayer cut in stone: free from drought and famine for a hundred years")}.`, quote: "fx_sk_prayer" },
  // Early medieval
  { facet: "food", age: "a_earlymed", text: `${L("fc_xz_food", "Rice and wheat; milk, butter, sugar, mustard oil and cakes of grain")}; ${L("fc_alb_cow", "beef forbidden, the cow being needed for ploughing and milk")}.`, quote: "fx_xz_food" },
  { facet: "water", age: "a_earlymed", text: `${L("fc_utt_tank", "Village tank committees in the Tamil country")}; ${L("fc_alb_tanks", "stepped stone tanks al-Bīrūnī admired")}; ${L("fc_kash_suyya", "Suyya's drainage of the Kashmir valley")}.`, quote: "fx_alb_ponds" },
  { facet: "work", age: "a_earlymed", text: `${L("fc_xz_tax", "All tilled the ground; a sixth of the crop went to the king; public labour was paid")}.`, quote: "fx_xz_till" },
  { facet: "failure", age: "a_earlymed", text: `In Kashmir, ${L("fc_kash_floods", "floods, not droughts, brought famine")}: ${L("fc_kash_917", "in 917–918 a flood took the rice crop and rice cost a thousand dīnnāras")}.`, quote: "fx_st_v271" },
  { facet: "coping", age: "a_earlymed", text: `${L("fc_kash_tunjina", "In Kalhaṇa's legend, hunger broke families apart")}; ${L("fc_kash_coins", "famine-stricken villagers dived for coins and cleared the river")}.`, quote: "fx_st_tun_family" },
  { facet: "rulers", age: "a_earlymed", text: `${L("fc_kash_profit", "In 917–918 ministers profited from stored rice while the regent stayed in his palace")}; ${L("fc_kash_tunjina", "a legendary king fed his people instead")}.`, quote: "fx_st_v276" },
  { facet: "toll", age: "a_earlymed", text: `${L("fc_kash_corpses", "The Vitastā covered with corpses, the land with bones")}; no count of the dead survives.`, quote: "fx_st_v272" },
  { facet: "after", age: "a_earlymed", text: `${L("fc_kash_price", "After Suyya's works, Kalhaṇa says, rice fell to 36 dīnnāras")}; ${L("fc_smith_relief", "in 1914 Smith used the famine to defend British relief")}.`, quote: "fx_smith_relief" },
];

// ---------------------------------------------------------------- page

export function famineEarlyPage(E: Record<string, string>): ChangeOpInput {
  const ent = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const C = (ref: string, words: string) => {
    if (!CLAIMS.some((cl) => cl.ref === ref)) throw new Error(`page links unknown claim ${ref}`);
    return `[${words}](claim:@${ref})`;
  };
  const N = (ref: string, words: string) => `[${words}](entity:${ent(ref)})`;
  const ids = (...refs: string[]) => refs.map((r) => `@${r}`);
  const atRefs = (md: string) => md.replace(/\]\(claim:(f[cm]_[a-z0-9_]+)\)/g, "](claim:@$1)");

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown: [
        `For most people in early India, life depended on one thing they could not control: the rain. This page follows ordinary people through two and a half thousand years of good and bad years, from the first farmers to the twelfth century: what they ate, where their water came from, how they earned a living, and what happened when the rains failed or the rivers flooded.`,
        `The evidence is uneven. For the earliest farmers and the Indus cities there are only grains, bones, wells and reservoirs, and arguments about climate. Then come hymns that pray for rain, monks' rules relaxed in hunger, folk tales of kings blamed for drought, a statecraft manual's famine measures, inscriptions about broken dams and grain stores, and finally a chronicler who saw the dead in the river. Megasthenes, the Greek envoy, wrote that ${C("fc_meg_never", "India had never known famine")}. The sources on this page show otherwise.`,
      ].join("\n\n"),
    },
    {
      id: "tracks",
      type: "tracks",
      title: "Food, water and famine, age by age",
      intro: "Read across to see one part of life change over time; read down to see an age whole. Empty cells mean the evidence is silent, not that nothing happened.",
      facets: FACETS,
      ages: AGES.map((a) => ({ entity: ent(a.ref), label: a.label, target: a.target })),
      cells: CELLS.map((cell) => ({
        facet: cell.facet,
        age: ent(cell.age),
        text: atRefs(cell.text),
        claimIds: [...new Set([...cell.text.matchAll(/\]\(claim:(f[cm]_[a-z0-9_]+)\)/g)].map((m) => `@${m[1]}`))],
        ...(cell.quote ? { excerptId: `@${cell.quote}` } : {}),
      })),
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-farmers",
      type: "chapter",
      title: "The first farmers",
      promise: "Barley, goats and a granary: how farming began in South Asia.",
      when: { start: bce(7000, true), end: bce(2600, true), basis: "The early farming age on this platform" },
      places: [],
      brief: {
        happened: `${C("fc_mehr_crops", "At Mehrgarh, farmers grew barley and wheat and herded sheep, goats and cattle")}, and ${C("fc_mehr_granary", "kept grain in granaries")}.`,
        howWeKnow: "Excavated grain and bones, reported here through an encyclopedia; the dates are debated.",
      },
    },
    {
      id: "farmers-prose",
      type: "prose",
      markdown: `At ${N("a_farming", "Mehrgarh")}, below the Bolan Pass in Balochistan, people settled in mud-brick villages and began to farm. ${C("fc_mehr_crops", "They grew barley, most of all, with wheat, dates and jujubes, and herded sheep, goats and cattle")}, and ${C("fc_mehr_granary", "they stored their grain in granaries")}. How early this began is argued: ${C("fc_mehr_date", "before 7000 BCE by the excavators' dates, about 5250 BCE by newer ones")}. Nothing survives to tell us what a bad year meant to them, but a store of grain is the first defence against one.`,
    },
    { id: "farmers-claims", type: "claims", claimIds: ids("fc_mehr_crops", "fc_mehr_granary", "fc_mehr_date") },

    // ------------------------------------------------------------ 2
    {
      id: "ch-indus",
      type: "chapter",
      title: "Wells, reservoirs and a drying climate: the Indus cities",
      promise: "What the Indus cities ate and drank, and whether drought ended them.",
      when: { start: bce(2600, true), end: bce(1700, true), basis: "The mature Indus cities and their decline" },
      places: [ent("mohenjodaro"), ent("dholavira")],
      brief: {
        happened: `${C("fc_ind_grains", "Indus people ate wheat, barley, meat and fish")}, ${C("fc_ind_wells", "drew water from hundreds of wells")}, and ${C("fc_ind_dholavira", "stored rain in stone reservoirs")}; ${C("fc_ind_drought", "a long drought may have hastened their decline")}.`,
        howWeKnow: "Excavation reports (Marshall, 1931) and recent research summarised in encyclopedias. Without readable writing, there are no first-hand accounts.",
      },
    },
    {
      id: "indus-prose",
      type: "prose",
      markdown: [
        `In the ruins of ${N("mohenjodaro", "Mohenjo-daro")} the excavators found ${C("fc_ind_grains", "wheat and barley, and the bones of cattle, sheep, pigs, poultry and fish")}. Later work showed that ${C("fc_ind_seasons", "farmers grew crops in both seasons: rice, millets and beans in summer, wheat, barley and pulses in winter")}, which spread the risk of a failed rain.`,
        `Water was close at hand. ${C("fc_ind_wells", "More than 700 wells have been found at Mohenjo-daro, about one for every three houses")}. Far to the south, at ${N("dholavira", "Dholavira")}, on an island in the salt flats of Kachchh, ${C("fc_ind_dholavira", "where years may pass without rain, people cut great reservoirs in the stone")}.`,
        `Did the cities keep grain for bad years? ${C("fc_ind_granary", "A large building was named the “Great Granary” in 1950, but no grain has been found in it")}. And did drought end them? ${C("fc_ind_marshall", "Marshall already suspected in 1931 that the climate had been wetter")}, and ${C("fc_ind_drought", "many researchers now link the decline to a long drought around 2200 BCE, though others doubt it")}. What is clear is that ${C("fc_ind_gradual", "the decline took two centuries or more")}, and that ${C("fc_ind_east", "people adapted: they grew more kinds of crops, harvested twice a year, and moved their villages east and south")}.`,
      ].join("\n\n"),
    },
    { id: "indus-claims", type: "claims", claimIds: ids("fc_ind_grains", "fc_ind_seasons", "fc_ind_wells", "fc_ind_dholavira", "fc_ind_granary", "fc_ind_marshall", "fc_ind_drought", "fc_ind_gradual", "fc_ind_east") },
    {
      id: "indus-debate",
      type: "debate",
      question: "Did drought end the Indus cities?",
      positions: [
        { label: "A long drought around 2200 BCE was a main cause", claimIds: ids("fc_ind_drought") },
        { label: "A slow change, with many causes, to which people adapted", claimIds: ids("fc_ind_gradual", "fc_ind_east") },
      ],
      note: "The two readings are not exclusive: a drier climate may have made city life harder while farmers adapted by moving and changing crops. The dating of the drought, and whether it was one event, are disputed.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-vedic",
      type: "chapter",
      title: "Praying for rain: the Vedic hymns",
      promise: "Rain gods, ploughing songs, a rite for rain, and a hymn telling the well-fed to feed the hungry.",
      when: { start: bce(1500, true), end: bce(500, true), basis: "The Vedic period on this platform" },
      people: [],
      terms: [],
      brief: {
        happened: `The hymns ${C("fc_ved_parjanya", "praise the rain cloud for the food it brings")}, ${C("fc_ved_rainrite", "were used in rites for rain")}, and ${C("fc_ved_charity", "tell the rich to feed the hungry")}; ${C("fc_ved_ushasti", "a teaching story remembers a famine after hail")}.`,
        howWeKnow: "The Rig Veda and Atharva Veda in Griffith's and Whitney's translations, and the Chāndogya Upaniṣad: religious texts, not records.",
      },
    },
    {
      id: "vedic-prose",
      type: "prose",
      markdown: [
        `The ${N("rigveda", "Rig Veda")} is a book of hymns, but its hopes are a farmer's. ${C("fc_ved_parjanya", "Parjanya, the rain cloud, sets seed in the plants, and when he waters the earth food springs up for every creature")}. In its most famous myth ${C("fc_ved_vritra", "Indra slays the serpent Vṛtra and sets free the waters")}. ${C("fc_ved_food", "A hymn to Food names milk, barley-brew and cakes of meal")}, and ${C("fc_ved_plough", "verses were spoken as the plough first cut the field and the barley was sown")}; ${C("fc_ved_pests", "another asks the gods to keep rats and borers from the barley")}.`,
        `When the rain did not come, people turned to ritual. ${C("fc_ved_rainrite", "An Atharva Veda hymn was used in a rite to bring rain, asking that the herdsman whose cattle had grown lean might go home in the downpour")}. And a late Rig Veda hymn speaks to those with food when others had none: ${C("fc_ved_charity", "“The Gods have not ordained hunger to be our death”")}.`,
        `One of the earliest stories of famine is in the ${N("chandogya", "Chāndogya Upaniṣad")}. ${C("fc_ved_ushasti", "When hail ruined the land of the Kurus, the scholar Uṣasti lived as a beggar, and ate another man's leftover beans, because otherwise he would not have lived")}.`,
      ].join("\n\n"),
    },
    { id: "vedic-claims", type: "claims", claimIds: ids("fc_ved_parjanya", "fc_ved_vritra", "fc_ved_food", "fc_ved_plough", "fc_ved_pests", "fc_ved_rainrite", "fc_ved_charity", "fc_ved_ushasti") },
    { id: "vedic-quote", type: "quote", excerptId: "@fx_rv_117b", caption: "Rig Veda X.117.2, “Liberality”, in Ralph Griffith's translation, The Hymns of the Rigveda, vol. II (1897), p. 601." },
    { id: "vedic-quote-2", type: "quote", excerptId: "@fx_chand_live", caption: "Uṣasti explains why he ate the leftover beans but would not drink. Chāndogya Upaniṣad I.10.4, in Max Müller's translation, The Upanishads, Part I (1879), p. 18." },

    // ------------------------------------------------------------ 4
    {
      id: "ch-buddha",
      type: "chapter",
      title: "When alms were hard to get: the age of the Buddha",
      promise: "Monks' rules bent in hunger, and folk tales of drought, debt and kings blamed for the weather.",
      when: { start: bce(600, true), end: bce(322), basis: "The age of the Mahājanapadas on this platform" },
      places: [ent("rajagaha"), ent("kalinga")],
      brief: {
        happened: `${C("fc_vin_rajagaha", "In scarcity the Buddha relaxed his monks' food rules")}, ${C("fc_vin_flesh", "people ate dead elephants, horses and dogs")}, and the Jātakas tell of ${C("fc_jat_kalinga", "starving families at the king's door, demanding rain")}.`,
        howWeKnow: "The Vinaya (the monastic rules) and the Jātaka stories, compiled in the centuries after the Buddha. They show what was remembered and imagined about hard years, not dated events.",
      },
    },
    {
      id: "buddha-prose",
      type: "prose",
      markdown: [
        `Buddhist monks lived on what people gave them, so the ${N("vinaya", "Vinaya")}, the book of their rules, notices when food ran short. ${C("fc_vin_rajagaha", "When food was scarce at Rājagaha, people brought salt, oil and rice to the monastery, and the Buddha let the monks store and cook food indoors")}. ${C("fc_vin_flesh", "In famines, the Vinaya says, people ate the flesh of the king's dead elephants and horses, and of dogs and snakes")}. ${C("fc_vin_vesali", "When the harvest was good again and one could live by gleaning, the allowances were withdrawn")}.`,
        `The ${N("jataka", "Jātaka")} tales are stories, not records, but they were told to people who knew hard years. ${C("fc_jat_tanks", "Droughts dry up the ponds and tanks, and crows pick the fish out of the mud")}. ${C("fc_jat_ox", "Villagers in a famine borrow an old ox from their headman to eat, promising to repay him in grain after the harvest")}. And in ${N("kalinga", "Kalinga")}, ${C("fc_jat_kalinga", "when no rain fell, the starving wandered with their children and gathered at the king's door")}, because ${C("fc_jat_kingrain", "rain was thought to depend on the king's own righteousness")}.`,
      ].join("\n\n"),
    },
    { id: "buddha-claims", type: "claims", claimIds: ids("fc_vin_rajagaha", "fc_vin_vesali", "fc_vin_flesh", "fc_jat_tanks", "fc_jat_ox", "fc_jat_kalinga", "fc_jat_kingrain") },
    { id: "buddha-quote", type: "quote", excerptId: "@fx_jat_kalinga3", caption: "The king's ministers tell him why the people are crying at his door. Kurudhamma-Jātaka (No. 276), in W. H. D. Rouse's translation, The Jātaka, vol. II (1895), p. 252." },

    // ------------------------------------------------------------ 5
    {
      id: "ch-maurya",
      type: "chapter",
      title: "Never a famine? The Mauryas and their storehouses",
      promise: "A Greek envoy's claim, a Jain memory of a twelve-year famine, and what the state was told to keep in store.",
      when: { start: bce(322, true), end: bce(185, true), basis: "The Maurya Empire" },
      places: [ent("shravanabelagola"), ent("mahasthangarh")],
      people: [ent("chandragupta"), ent("megasthenes"), ent("bhadrabahu"), ent("kautilya")],
      terms: [ent("t_koshthagara")],
      brief: {
        happened: `${C("fc_meg_never", "Megasthenes wrote that India never knew famine")}, but ${C("fc_jain_famine", "Jain tradition remembers a twelve-year famine")}; ${C("fc_arth_famine", "the Arthaśāstra lists famine measures")}, and ${C("fc_mahasthan", "an inscription records grain lent to people in distress")}.`,
        howWeKnow: "Megasthenes through later Greek writers; a Jain inscription and much later Jain narratives; the Arthaśāstra (of debated date); two short Prakrit inscriptions whose readings are argued over.",
      },
    },
    {
      id: "maurya-prose",
      type: "prose",
      markdown: [
        `${N("megasthenes", "Megasthenes")}, the Seleucid envoy at ${N("chandragupta", "Chandragupta's")} court, was impressed. ${C("fc_meg_crops", "Much of the land was irrigated, growing millet, pulses and rice in the summer rains and wheat in winter")}; ${C("fc_meg_never", "with two harvests a year, he wrote, famine had never visited India")}; and ${C("fc_meg_farmers", "farmers worked on undisturbed even when armies fought nearby")}.`,
        `Jain memory says otherwise. ${C("fc_jain_famine", "An inscription at Śravaṇa Beḷgoḷa records that the teacher Bhadrabāhu foretold a twelve-year famine, and that the whole community left the north for the south")}. ${C("fc_jain_chandragupta", "Much later Jain narratives add that Chandragupta himself gave up his throne and followed Bhadrabāhu as a monk")}, and that ${C("fc_jain_suffer", "those who stayed behind ate every grain, and wandered in search of food until they died")}. ${C("fc_jain_debate", "Historians have long disagreed about how much of this to believe")}.`,
        `What a state could do is set out in the ${N("t_arthashastra", "Arthaśāstra")}, a manual of statecraft. ${C("fc_arth_famine", "In famine the king should give seed and food, open his stores and the hoards of the rich, ask allied kings for help, or move his people to better-watered land")}. ${C("fc_arth_reserve", "Half of every royal store was to be kept back for calamities")}. ${C("fc_arth_rain", "A rain-gauge stood before the storehouse, and sowing was matched to the rainfall")}, and ${C("fc_arth_tanks", "anyone who built a new tank paid no tax on the land below it for five years")}. Its author ${C("fc_arth_worst", "ranked famine worse than pestilence, because it struck the whole country")}. ${C("fc_arth_worship", "In drought, the gods of rain and rivers were to be worshipped")}.`,
        `Two small inscriptions may show the stores in use. ${C("fc_mahasthan", "At Mahāsthān in Bengal, paddy from a granary was granted to a people in distress, to be repaid when plenty returned")}. ${C("fc_sohgaura", "The Sohgaura copper plate announces two storehouses, but scholars disagree whether they held grain for hard times or goods for travellers")}. And in the west, ${C("fc_sudarsana_maurya", "Chandragupta's governor dammed a valley below Girnar to make the Sudarśana lake")}.`,
      ].join("\n\n"),
    },
    { id: "maurya-claims", type: "claims", claimIds: ids("fc_meg_never", "fc_meg_crops", "fc_meg_farmers", "fc_jain_famine", "fc_jain_chandragupta", "fc_jain_suffer", "fc_jain_debate", "fc_arth_famine", "fc_arth_reserve", "fc_arth_rain", "fc_arth_tanks", "fc_arth_worst", "fc_arth_worship", "fc_mahasthan", "fc_sohgaura", "fc_sudarsana_maurya") },
    {
      id: "maurya-debate",
      type: "debate",
      question: "Was there a great famine under Chandragupta Maurya?",
      positions: [
        { label: "Yes: Jain inscriptions and tradition remember a twelve-year famine", claimIds: ids("fc_jain_famine", "fc_jain_chandragupta") },
        { label: "Megasthenes, who lived at the court, says famine never came", claimIds: ids("fc_meg_never") },
        { label: "Uncertain: the Jain sources are late, and historians disagree", claimIds: ids("fc_jain_debate") },
      ],
      note: "Megasthenes may have described a run of good years, or repeated what he was told; the Jain inscription is centuries later than the events, and the narratives that name Chandragupta are later still.",
    },
    {
      id: "sohgaura-debate",
      type: "debate",
      question: "What were the Sohgaura storehouses for?",
      positions: [
        { label: "Grain kept for times of need (Bühler, 1896)", claimIds: ids("fc_sohgaura") },
        { label: "Storehouses for goods on three high roads (Fleet, 1907)", claimIds: ids("fc_sohgaura") },
      ],
      note: "The plate is tiny and its Prakrit hard to read; both readings rest on the same four lines. Popular accounts often present it as a famine-relief order, which is one reading among several.",
    },
    { id: "maurya-quote", type: "quote", excerptId: "@fx_arth_famine1", caption: "Arthaśāstra IV.3, “Remedies against national calamities”, in R. Shamasastry's translation (1915)." },
    { id: "maurya-quote-2", type: "quote", excerptId: "@fx_rice_insc", caption: "Inscription No. 1 at Chandragiri, Śravaṇa Beḷgoḷa, in B. Lewis Rice's translation, Inscriptions at Sravana Belgola (1889)." },

    // ------------------------------------------------------------ 6
    {
      id: "ch-lake",
      type: "chapter",
      title: "A dam that kept breaking: the Sudarśana lake",
      promise: "Four kings, one reservoir, and two storms that emptied it.",
      when: { start: ce(150), end: ce(457), basis: "From Rudradāman's repair to Skandagupta's" },
      places: [ent("sudarshana"), ent("girnar")],
      people: [ent("rudradaman"), ent("skandagupta")],
      brief: {
        happened: `${C("fc_rud_storm", "In 150 CE floods burst the Sudarśana dam")}; ${C("fc_rud_repair", "Rudradāman rebuilt it from his own treasury")}. ${C("fc_sk_burst", "In 455–456 it burst again and was rebuilt under Skandagupta")}.`,
        howWeKnow: "Two inscriptions on the same rock at Junāgaḍh that also carries Aśoka's edicts, translated by Kielhorn (1906) and Fleet (1888). Both are royal records, written to praise.",
      },
    },
    {
      id: "lake-prose",
      type: "prose",
      markdown: [
        `The Sudarśana lake was a reservoir in the valley below ${N("girnar", "Girnar")}, in Saurashtra. ${C("fc_sudarsana_maurya", "It was made under Chandragupta Maurya and given conduits under Aśoka")}. Four centuries later, ${C("fc_rud_storm", "in 150 CE, a storm and floods tore a breach 420 cubits long in its dam, and all the water ran out")}. ${C("fc_rud_despair", "The king's counsellors called the repair hopeless, and the people despaired")}, but ${C("fc_rud_repair", "Rudradāman, his inscription says, rebuilt the dam three times as strong from his own treasury, without taxes or forced labour")}.`,
        `Three hundred years later it happened again. ${C("fc_sk_burst", "After long, unceasing rain in 455–456, the lake burst, and under Skandagupta the governor's son rebuilt the embankment in two months")}. ${C("fc_sk_despair", "The inscription says the people lay awake all night in despair")}, and ${C("fc_sk_prayer", "it ends with a prayer that the city be free of drought and famine for a hundred years")}.`,
      ].join("\n\n"),
    },
    { id: "lake-claims", type: "claims", claimIds: ids("fc_rud_storm", "fc_rud_repair", "fc_rud_despair", "fc_sk_burst", "fc_sk_despair", "fc_sk_prayer") },
    { id: "lake-quote", type: "quote", excerptId: "@fx_rud_despair", caption: "Junāgaḍh inscription of Rudradāman, about 150 CE, line 17, in F. Kielhorn's translation, Epigraphia Indica, vol. VIII (1906), p. 49." },
    { id: "lake-quote-2", type: "quote", excerptId: "@fx_sk_prayer", caption: "Junāgaḍh inscription of Skandagupta, 457–458 CE, line 23, in J. F. Fleet's translation, Corpus Inscriptionum Indicarum, vol. III (1888), p. 64." },

    // ------------------------------------------------------------ 7
    {
      id: "ch-law",
      type: "chapter",
      title: "What the law allowed the starving",
      promise: "When a Brahmin may eat what is forbidden, and a hungry man may take grain from a field.",
      when: { start: bce(200, true), end: ce(200, true), basis: "The usual dating of the law book of Manu" },
      terms: [ent("t_apaddharma")],
      brief: {
        happened: `${C("fc_manu_starving", "The law book of Manu allows a man near death to take food from anyone")}, and ${C("fc_manu_seventh", "one who has missed six meals to take grain from a field or threshing-floor")}.`,
        howWeKnow: "The Manusmṛti in Bühler's translation (1886). It says what the law allowed, not what people did.",
      },
    },
    {
      id: "law-prose",
      type: "prose",
      markdown: `Law books of the period set strict rules about whose food one might accept. They also made room for disaster, under the heading of ${N("t_apaddharma", "āpaddharma")}, law in times of distress. ${C("fc_manu_starving", "A man in danger of losing his life may take food from anyone, Manu says, and he cites sages who, starving, sought to eat the flesh of a dog")}. ${C("fc_manu_seventh", "A man who has gone without six meals may take food at the seventh from a threshing-floor, a field or a house, but must confess it if asked")}. ${C("fc_manu_date", "The book is usually dated between about 200 BCE and 200 CE")}.`,
    },
    { id: "law-claims", type: "claims", claimIds: ids("fc_manu_starving", "fc_manu_seventh", "fc_manu_date") },
    { id: "law-quote", type: "quote", excerptId: "@fx_manu104", caption: "The Laws of Manu X.104, in Georg Bühler's translation (1886), p. 424." },

    // ------------------------------------------------------------ 8
    {
      id: "ch-charity",
      type: "chapter",
      title: "Daily bread and charity: what travellers saw",
      promise: "Two Chinese pilgrims and a Persian scholar on what Indians ate, what they paid, and who cared for the poor.",
      when: { start: ce(399), end: ce(1030, true), basis: "From Faxian's travels to al-Bīrūnī's book" },
      people: [ent("faxian"), ent("xuanzang"), ent("albiruni")],
      brief: {
        happened: `${C("fc_fax_charity", "Faxian saw houses that gave the poor and sick food and medicine")}; ${C("fc_xz_food", "Xuanzang listed milk, butter, sugar and grain cakes as common food")}, and ${C("fc_xz_tax", "a sixth of the crop as the royal share")}.`,
        howWeKnow: "Faxian (Legge, 1886), Xuanzang (Beal, 1884) and al-Bīrūnī (Sachau). Outsiders, often admiring, who saw most of the cities and monasteries.",
      },
    },
    {
      id: "charity-prose",
      type: "prose",
      markdown: [
        `${N("faxian", "Faxian")}, a Chinese monk who travelled in India about 399–414 CE, found that ${C("fc_fax_land", "only those who farmed the king's land paid a share of the crop, and people came and went as they wished")}. ${C("fc_fax_diet", "He saw no meat, onions or garlic eaten, except by the Caṇḍālas, who lived apart")}. In the cities of Magadha ${C("fc_fax_charity", "the heads of Vaiśya families kept houses where the poor, orphans, the disabled and the sick were given food, medicine and a doctor's care")}.`,
        `Two centuries later ${N("xuanzang", "Xuanzang")} wrote that ${C("fc_xz_food", "rice and wheat were the main crops, and the usual food was milk, butter, cream, sugar, mustard oil and cakes of grain")}. ${C("fc_xz_tax", "Everyone tilled the ground; tenants of royal land paid a sixth of the produce, and labour on public works was paid")}. About 1030, ${N("albiruni", "al-Bīrūnī")} offered one reason for the ban on eating beef: ${C("fc_alb_cow", "the cow carries loads, draws the plough and gives milk")}.`,
      ].join("\n\n"),
    },
    { id: "charity-claims", type: "claims", claimIds: ids("fc_fax_charity", "fc_fax_land", "fc_fax_diet", "fc_xz_food", "fc_xz_tax", "fc_alb_cow") },
    { id: "charity-quote", type: "quote", excerptId: "@fx_fax_charity", caption: "Faxian, Record of Buddhistic Kingdoms, chapter XXVII, in James Legge's translation (1886), p. 79." },

    // ------------------------------------------------------------ 9
    {
      id: "ch-tanks",
      type: "chapter",
      title: "Tanks and the villages that kept them",
      promise: "Village committees for water in the Tamil country, and stepped tanks that astonished a visitor.",
      when: { start: ce(900, true), end: ce(1030, true), basis: "The Uttaramerūr inscriptions and al-Bīrūnī" },
      places: [ent("uttaramerur")],
      brief: {
        happened: `${C("fc_utt_tank", "At Uttaramerūr the village assembly chose a tank committee each year")}, and ${C("fc_alb_tanks", "al-Bīrūnī admired the stone tanks at holy places")}.`,
        howWeKnow: "Tenth-century Chola inscriptions, edited in the Archaeological Survey's report for 1904–05, and al-Bīrūnī's India.",
      },
    },
    {
      id: "tanks-prose",
      type: "prose",
      markdown: `In the south, where rivers run dry for much of the year, villages lived by their tanks: reservoirs that caught the monsoon rain. ${C("fc_utt_tank", "Inscriptions of the tenth century at Uttaramerūr set out how the village assembly chose its committees by lot each year, among them a tank committee of six")}. ${C("fc_utt_duties", "It probably cleared the silt, made repairs and looked after gifts made for the tanks")}. A northern visitor, ${C("fc_alb_tanks", "al-Bīrūnī, wrote that the stepped stone tanks at holy places were beyond anything his own people could build")}.`,
    },
    { id: "tanks-claims", type: "claims", claimIds: ids("fc_utt_tank", "fc_utt_duties", "fc_alb_tanks") },
    { id: "tanks-quote", type: "quote", excerptId: "@fx_alb_ponds", caption: "Al-Bīrūnī, India, chapter LXVI (about 1030), in Edward Sachau's translation, vol. II, p. 144." },

    // ------------------------------------------------------------ 10
    {
      id: "ch-kashmir",
      type: "chapter",
      title: "Flood and famine in Kashmir",
      promise: "A chronicler's account of a valley where floods, not droughts, brought hunger, and of the men who grew rich from it.",
      when: { start: ce(855, true), end: ce(918), basis: "From Suyya's works to the famine of 917–918" },
      places: [ent("kashmir_valley"), ent("jhelum")],
      people: [ent("kalhana")],
      terms: [ent("t_khari"), ent("t_dinnara")],
      brief: {
        happened: `${C("fc_kash_suyya", "Suyya drained the valley")} and ${C("fc_kash_price", "the price of rice fell")}; ${C("fc_kash_917", "in 917–918 a flood brought famine")}, ${C("fc_kash_corpses", "the river filled with the dead")}, and ${C("fc_kash_profit", "ministers profited")}.`,
        howWeKnow: "Kalhaṇa's Rājataraṅgiṇī, written in 1148–49 from older chronicles, in Stein's translation (1900). Stein trusts it from the 850s; the earlier famine story is legend.",
      },
    },
    {
      id: "kashmir-prose",
      type: "prose",
      markdown: [
        `The ${N("kashmir_valley", "Kashmir valley")} grew rice, and its danger was water. ${C("fc_kash_floods", "Floods were always the main cause of famine there, Stein wrote")}. The chronicler ${N("kalhana", "Kalhaṇa")} tells an old legend: ${C("fc_kash_tunjina", "when snow fell on the ripening rice, hunger made people abandon their own families, and the king and queen fed them from the treasury")}.`,
        `In the reign of Avantivarman (855/6–883), ${C("fc_kash_historical", "where Stein judged the chronicle to become truly historical")}, ${C("fc_kash_suyya", "the engineer Suyya dammed and cleared the Vitastā, the river now called the Jhelum, and cut new channels where floods broke through")}. ${C("fc_kash_coins", "To clear the rocks from the riverbed, Kalhaṇa says, he threw coins into the water for famine-stricken villagers to dive for")}. ${C("fc_kash_price", "Afterwards, he says, rice fell from 200 dīnnāras a khārī to 36")}.`,
        `A generation later, under weak and quarrelling rulers, ${C("fc_kash_917", "a flood destroyed the autumn rice in 917–918, and a khārī of rice cost a thousand dīnnāras")}. ${C("fc_kash_corpses", "The river was so covered with corpses that its water could scarcely be seen, and the land was strewn with bones")}. ${C("fc_kash_profit", "Meanwhile the ministers and guards grew rich selling stored rice, and the regent watched from his palace")}. The famine was used again eight centuries later: ${C("fc_smith_relief", "in 1914 a British historian held it up to critics of British famine relief")}.`,
      ].join("\n\n"),
    },
    { id: "kashmir-claims", type: "claims", claimIds: ids("fc_kash_floods", "fc_kash_tunjina", "fc_kash_historical", "fc_kash_suyya", "fc_kash_coins", "fc_kash_price", "fc_kash_917", "fc_kash_corpses", "fc_kash_profit", "fc_smith_relief") },
    { id: "kashmir-quote", type: "quote", excerptId: "@fx_st_v272", caption: "Kalhaṇa, Rājataraṅgiṇī V.272, on the famine of 917–918, in M. A. Stein's translation (1900), vol. I, p. 221." },
    { id: "kashmir-quote-2", type: "quote", excerptId: "@fx_st_v276", caption: "Kalhaṇa, Rājataraṅgiṇī V.276–277, on the regent Paṅgu, in Stein's translation, vol. I, p. 222." },
    { id: "kashmir-quote-3", type: "quote", excerptId: "@fx_st_tun_family", caption: "Kalhaṇa, Rājataraṅgiṇī II.21, from the legend of the famine under Tuñjīna, in Stein's translation, vol. I, p. 58." },
    {
      id: "kashmir-care",
      type: "callout",
      tone: "caution",
      markdown: "Kalhaṇa wrote more than two centuries after the famine of 917–918, and gives no count of the dead. His purpose was moral as well as historical: bad rulers bring ruin, good ones abundance. His prices, the 1,000 dīnnāras of the famine and the 36 after Suyya, are the earliest famine prices on this page, but they come from a chronicle, not from accounts.",
    },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Three popular beliefs about famine and food in early India.",
      phase: "later",
      brief: {
        happened: `Three beliefs checked: ${C("fm_never_famine", "that ancient India never knew famine")}, ${C("fm_ind_sudden", "that a sudden drought ended the Indus cities")} and ${C("fm_ind_granary", "that those cities kept great state granaries")}.`,
        howWeKnow: "The sources on this page.",
      },
    },
    {
      id: "often-prose",
      type: "prose",
      markdown: "Each of these has a grain of truth in it, which is why it lasts. Here is what the evidence on this page says.",
    },
    { id: "myth-never", type: "misconception", theme: "historiography", claimId: "@fm_never_famine", correctionIds: ids("fc_jain_famine", "fc_vin_rajagaha", "fc_arth_famine", "fc_kash_917", "fc_meg_never") },
    { id: "myth-sudden", type: "misconception", theme: "historiography", claimId: "@fm_ind_sudden", correctionIds: ids("fc_ind_gradual", "fc_ind_east", "fc_ind_drought") },
    { id: "myth-granary", type: "misconception", theme: "historiography", claimId: "@fm_ind_granary", correctionIds: ids("fc_ind_granary") },
  ];

  return {
    op: "create_page",
    ref: "famine_early_page",
    slug: PAGE_SLUG,
    title: PAGE_TITLE,
    kind: "theme",
    summary: "How people in early India ate, found water and made a living, and what drought and flood did to them, from the first farmers to Kalhaṇa's Kashmir: grain stores, rain rites, famine rules, broken dams and first-hand voices.",
    blocks,
    status: "published",
    spec: { timeline: { range: [-7000, 1200] } },
  } as ChangeOpInput;
}
