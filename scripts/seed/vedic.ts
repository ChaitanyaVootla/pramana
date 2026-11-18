import type { BlockInput, ChangeOpInput, PageSpecInput } from "@pramana/core";
import { toAstronomicalYear } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "The Vedic period" era page (c. 1500–500 BCE). Its evidence is first of all
 * a body of texts handed down by mouth long before they were written: the
 * Ṛgveda (Griffith's translation, 1896–97), the Śatapatha Brāhmaṇa (Eggeling,
 * SBE 12 and 26) and the Upaniṣads (Max Müller, SBE 1 and 15); then what
 * scholars have made of them since William Jones (1786): Max Müller (1888,
 * 1891), Jacobi (1909) on the Mitanni gods, Macdonell (1900), Tilak (1903),
 * Ambedkar (1946); and, for the question of where the Indo-Aryan languages
 * came from, the ancient-DNA study of Narasimhan et al. (2019) and a statement
 * of the "Out of India" case by Koenraad Elst (2023), both quoted briefly.
 * Wikipedia (pinned revisions) is tertiary: modern dates, the state of the
 * debate, Painted Grey Ware and the Kuru state, each flagged.
 *
 * Cliopatria has no polities for 1700–601 BCE, so the atlas shows places only.
 * The Sarasvatī question is argued on the Indus page; its claims are linked,
 * not repeated.
 */

const bce = (year: number, approximate = true) => ({ year, era: "BCE" as const, ...(approximate ? { approximate } : {}) });
const ce = (year: number) => ({ year, era: "CE" as const });

// ---------------------------------------------------------------- snapshots

export const CAPTURES = {
  griffith1: { kind: "internet_archive", identifier: "in.ernet.dli.2015.104118" },
  griffith2: { kind: "internet_archive", identifier: "in.ernet.dli.2015.104119" },
  macdonell: { kind: "internet_archive", identifier: "historyofsanskri00macduoft" },
  mm1891: { kind: "internet_archive", identifier: "physicalreligion00ml" },
  mm1888: { kind: "internet_archive", identifier: "biographiesword01mlgoog" },
  jones: { kind: "internet_archive", identifier: "b28776392_0001" },
  jacobi: { kind: "internet_archive", identifier: "in.ernet.dli.2015.24463" },
  tilak: { kind: "internet_archive", identifier: "in.ernet.dli.2015.43116" },
  ambedkar: { kind: "internet_archive", identifier: "in.ernet.dli.2015.527572" },
  sbe12: { kind: "internet_archive", identifier: "in.ernet.dli.2015.238711" },
  sbe26: { kind: "internet_archive", identifier: "satapathabrhma02eggeuoft" },
  sbe1: { kind: "internet_archive", identifier: "upanishads01mluoft" },
  sbe15: { kind: "internet_archive", identifier: "upanishads02ml" },
  narasimhan: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6822619/" },
  elst: { kind: "url", url: "https://swarajyamag.com/politics/let-the-aryan-invasion-theory-become-a-debate-again-out-of-india-is-in-play" },
  giosan: { kind: "url", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3387054/" },
  wpRigveda: { kind: "wikipedia", title: "Rigveda" },
  wpIndigenous: { kind: "wikipedia", title: "Indigenous Aryans" },
  wpMigrations: { kind: "wikipedia", title: "Indo-Aryan migrations" },
  wpPgw: { kind: "wikipedia", title: "Painted Grey Ware culture" },
  wpKuru: { kind: "wikipedia", title: "Kuru Kingdom" },
  wpTenKings: { kind: "wikipedia", title: "Battle of the Ten Kings" },
} as const;
export type CaptureKey = keyof typeof CAPTURES;

export interface Snap {
  id: string;
  url: string | null;
  revisionId?: number;
  title: string;
}
export type Snaps = Record<CaptureKey, Snap>;

export async function captureAll(mcp: Mcp): Promise<Snaps> {
  const out = {} as Snaps;
  for (const [key, origin] of Object.entries(CAPTURES) as [CaptureKey, (typeof CAPTURES)[CaptureKey]][]) {
    const s = await mcp.call<{ id: string; url: string | null; title: string | null; meta: { wikipedia?: { revisionId: number; title: string } } }>(
      "capture_snapshot",
      { origin },
    );
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

type Kind = "person" | "place" | "site" | "polity" | "event" | "text" | "culture" | "concept" | "term";
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  when?: Record<string, unknown>;
  life?: boolean;
  /** Use Wikidata coordinates (towns and sites only; not rivers or regions). */
  geo?: boolean;
  aliases?: { label: string; lang?: string; script?: string; note?: string }[];
  dropAliases?: RegExp;
  link?: { to: string; type: "part_of" | "located_in" | "related_to" | "contemporary_of"; note?: string };
}

/** The page's subject: the period entity created by the spine (Q215262). */
const PERIOD = "vedic-period";

export const ENTITIES: EntitySpec[] = [
  // Texts
  { ref: "rigveda", slug: "rigveda", kind: "text", label: "Ṛgveda", qid: "Q727413", link: { to: PERIOD, type: "part_of" }, description: "The oldest Vedic text: 1,028 hymns in ten books, composed in an early form of Sanskrit and handed down by mouth.", dropAliases: /vedic$/i, aliases: [{ label: "Rigveda", lang: "en" }, { label: "Rig Veda", lang: "en" }, { label: "ऋग्वेद", lang: "sa", script: "Deva" }] },
  { ref: "atharvaveda", slug: "atharvaveda", kind: "text", label: "Atharvaveda", qid: "Q236092", link: { to: PERIOD, type: "part_of" }, description: "A later Vedic collection of hymns and spells for daily life, healing and protection." },
  { ref: "satapatha", slug: "shatapatha-brahmana", kind: "text", label: "Śatapatha Brāhmaṇa", qid: "Q676774", link: { to: PERIOD, type: "part_of" }, description: "The largest Brāhmaṇa: a prose explanation of the rituals of the White Yajurveda.", aliases: [{ label: "Shatapatha Brahmana", lang: "en" }] },
  { ref: "chandogya", slug: "chandogya-upanishad", kind: "text", label: "Chāndogya Upaniṣad", qid: "Q773328", link: { to: PERIOD, type: "part_of" }, description: "One of the oldest Upaniṣads, attached to the Sāmaveda.", aliases: [{ label: "Chandogya Upanishad", lang: "en" }] },
  { ref: "brihadaranyaka", slug: "brihadaranyaka-upanishad", kind: "text", label: "Bṛhadāraṇyaka Upaniṣad", qid: "Q545112", link: { to: PERIOD, type: "part_of" }, description: "One of the oldest Upaniṣads, attached to the Śatapatha Brāhmaṇa; many of its dialogues feature Yājñavalkya.", aliases: [{ label: "Brihadaranyaka Upanishad", lang: "en" }] },
  { ref: "purusha", slug: "purusha-sukta", kind: "text", label: "Puruṣa Sūkta", qid: "Q2600184", link: { to: "@rigveda", type: "part_of", note: "Ṛgveda 10.90." }, description: "Ṛgveda 10.90, the “Hymn of Man”: the world made from the body of a primeval giant. The only Ṛgveda hymn that names the four varṇas.", aliases: [{ label: "Purusha Sukta", lang: "en" }, { label: "Hymn of Man", lang: "en" }] },
  // Events, peoples, states
  { ref: "tenkings", slug: "battle-of-the-ten-kings", kind: "event", label: "Battle of the Ten Kings", qid: "Q513097", link: { to: PERIOD, type: "part_of" }, when: undefined, description: "A battle described in Ṛgveda book 7, in which King Sudās of the Bharatas defeated a confederation of tribes by the river Paruṣṇī (the Ravi). No date can be given." },
  { ref: "kuru", slug: "kuru", kind: "polity", label: "Kuru", qid: "Q1068408", link: { to: PERIOD, type: "part_of" }, description: "A union of tribes in the upper Ganga–Yamuna region in the later Vedic period, often described as the first state in South Asia after the Indus cities. No borders can be drawn.", aliases: [{ label: "Kuru Kingdom", lang: "en" }] },
  { ref: "panchala", slug: "panchala", kind: "polity", label: "Pañcāla", qid: "Q558603", link: { to: PERIOD, type: "part_of" }, description: "A people and land of the later Vedic period, east of the Kurus, in the Ganga–Yamuna doab.", aliases: [{ label: "Panchala", lang: "en" }] },
  { ref: "videha", slug: "videha", kind: "polity", label: "Videha", qid: "Q3359147", link: { to: PERIOD, type: "part_of" }, description: "A land of the later Vedic period east of the river Sadānīrā (probably the Gandak), in today's north Bihar and Nepal's Tarai." },
  { ref: "mitanni", slug: "mitanni", kind: "polity", label: "Mitanni", qid: "Q178665", link: { to: PERIOD, type: "contemporary_of", note: "Its treaty of about 1400 BCE invokes Mitra, Varuṇa, Indra and the Nāsatyas." }, description: "A kingdom of northern Syria and Mesopotamia, c. 1500–1300 BCE, whose treaties invoke gods also found in the Ṛgveda.", aliases: [{ label: "Mittani", lang: "en" }] },
  { ref: "pgw", slug: "painted-grey-ware", kind: "culture", label: "Painted Grey Ware culture", qid: "Q2525293", link: { to: PERIOD, type: "contemporary_of", note: "Usually dated c. 1200–600 BCE; often linked with the later Vedic Kuru-Pañcāla." }, description: "An Iron Age culture of the western Ganga plain and the Ghaggar-Hakra valley, named after its fine grey pottery painted in black.", aliases: [{ label: "PGW", lang: "en" }] },
  // Places (towns: Wikidata coordinates; rivers and regions: none)
  { ref: "kurukshetra", slug: "kurukshetra", kind: "place", label: "Kurukṣetra", qid: "Q593256", geo: true, link: { to: "@kuru", type: "located_in", note: "The “field of the Kurus”." }, description: "The land of the Kurus, between the Sarasvatī and the Yamunā; today a town in Haryana.", aliases: [{ label: "Kurukshetra", lang: "en" }] },
  { ref: "hastinapur", slug: "hastinapur", kind: "site", label: "Hastinapur", qid: "Q459714", geo: true, link: { to: "@pgw", type: "part_of", note: "A Painted Grey Ware site." }, description: "A town on the upper Ganga in Uttar Pradesh, with Painted Grey Ware levels; the Kuru capital in later tradition." },
  { ref: "ahichchhatra", slug: "ahichchhatra", kind: "site", label: "Ahichchhatra", qid: "Q2827417", geo: true, link: { to: "@pgw", type: "part_of", note: "A Painted Grey Ware site." }, description: "A large ancient town in Uttar Pradesh with Painted Grey Ware levels; the capital of northern Pañcāla in later tradition.", aliases: [{ label: "Ahichatra", lang: "en" }] },
  { ref: "ravi", slug: "ravi-river", kind: "place", label: "Ravi river", qid: "Q317899", link: { to: PERIOD, type: "related_to" }, description: "A river of the Punjab, the Paruṣṇī of the Ṛgveda, where the Battle of the Ten Kings was fought.", dropAliases: /hydra|hyaro/i, aliases: [{ label: "Paruṣṇī", lang: "sa-Latn", note: "The Ṛgveda's name" }] },
  { ref: "sutlej", slug: "sutlej-river", kind: "place", label: "Sutlej river", qid: "Q171675", link: { to: PERIOD, type: "related_to" }, description: "The easternmost river of the Punjab, the Śutudrī of the Ṛgveda.", aliases: [{ label: "Śutudrī", lang: "sa-Latn", note: "The Ṛgveda's name" }] },
  { ref: "yamuna", slug: "yamuna-river", kind: "place", label: "Yamunā", qid: "Q132726", link: { to: PERIOD, type: "related_to" }, description: "The great western tributary of the Ganga; named three times in the Ṛgveda.", aliases: [{ label: "Yamuna", lang: "en" }, { label: "Jumna", lang: "en", note: "Colonial spelling" }] },
  { ref: "ganga", slug: "ganga-river", kind: "place", label: "Gaṅgā", qid: "Q5089", link: { to: PERIOD, type: "related_to" }, description: "The great river of north India; named directly only once in the Ṛgveda.", aliases: [{ label: "Ganges", lang: "en" }, { label: "Ganga", lang: "en" }] },
  { ref: "gandak", slug: "gandaki-river", kind: "place", label: "Gandak", qid: "Q849494", link: { to: PERIOD, type: "related_to" }, description: "A northern tributary of the Ganga, probably the Sadānīrā of the Śatapatha Brāhmaṇa, which Agni in its legend did not cross.", aliases: [{ label: "Sadānīrā", lang: "sa-Latn", note: "The probable Vedic name (Eggeling, after Weber)" }, { label: "Gandaki", lang: "en" }] },
  // People
  { ref: "sudas", slug: "sudas", kind: "person", label: "Sudās", qid: "Q2562325", link: { to: "@tenkings", type: "related_to", note: "The victor, in Ṛgveda 7.18." }, description: "A king of the Bharata tribe, praised in Ṛgveda book 7 as the victor in the Battle of the Ten Kings. Known only from the hymns.", aliases: [{ label: "Sudas", lang: "en" }] },
  { ref: "vasishtha", slug: "vasishtha", kind: "person", label: "Vasiṣṭha", qid: "Q241900", link: { to: "@rigveda", type: "related_to", note: "Book 7 is ascribed to his family." }, description: "A seer to whose family Ṛgveda book 7 is ascribed; Sudās's priest in the hymns.", dropAliases: /./, aliases: [{ label: "Vasishtha", lang: "en" }, { label: "वसिष्ठ", lang: "sa", script: "Deva" }] },
  { ref: "yajnavalkya", slug: "yajnavalkya", kind: "person", label: "Yājñavalkya", qid: "Q1423663", link: { to: "@satapatha", type: "related_to", note: "An authority in the Śatapatha Brāhmaṇa and the Bṛhadāraṇyaka Upaniṣad." }, description: "A teacher of the later Vedic period, quoted as an authority in the Śatapatha Brāhmaṇa and the Bṛhadāraṇyaka Upaniṣad. His dates are unknown.", aliases: [{ label: "Yajnavalkya", lang: "en" }] },
  { ref: "jones", slug: "william-jones", kind: "person", label: "William Jones", qid: "Q273969", life: true, link: { to: PERIOD, type: "related_to", note: "Noted in 1786 the kinship of Sanskrit with Greek and Latin." }, description: "Judge in Calcutta and founder of the Asiatick Society, who in 1786 pointed out the kinship of Sanskrit with Greek and Latin." },
  { ref: "mmuller", slug: "max-muller", kind: "person", label: "Max Müller", qid: "Q60074", life: true, link: { to: PERIOD, type: "related_to", note: "Edited the Ṛgveda and the Sacred Books of the East." }, description: "German-born Oxford scholar who edited the Ṛgveda and the Sacred Books of the East, and translated the Upaniṣads.", aliases: [{ label: "Friedrich Max Müller", lang: "en" }, { label: "F. Max Müller", lang: "en" }] },
  { ref: "griffith", slug: "ralph-griffith", kind: "person", label: "Ralph T. H. Griffith", qid: "Q3397301", life: true, link: { to: "@rigveda", type: "related_to", note: "Translator (1889–92; 2nd ed. 1896–97)." }, description: "Principal of the Benares College, whose verse translation of the Ṛgveda (1889–92) is quoted on this page." },
  { ref: "eggeling", slug: "julius-eggeling", kind: "person", label: "Julius Eggeling", qid: "Q5627765", life: true, link: { to: "@satapatha", type: "related_to", note: "Translator (SBE, 1882–1900)." }, description: "German-born Edinburgh scholar who translated the Śatapatha Brāhmaṇa for the Sacred Books of the East (1882–1900)." },
  { ref: "macdonell", slug: "arthur-macdonell", kind: "person", label: "Arthur A. Macdonell", qid: "Q708429", life: true, link: { to: PERIOD, type: "related_to", note: "Author of A History of Sanskrit Literature (1900)." }, description: "Oxford Sanskritist, author of A History of Sanskrit Literature (1900) and, with A. B. Keith, the Vedic Index (1912)." },
  { ref: "jacobi", slug: "hermann-jacobi", kind: "person", label: "Hermann Jacobi", qid: "Q73862", life: true, link: { to: PERIOD, type: "related_to", note: "Argued for a very early date for the Veda." }, description: "German Indologist who argued from astronomy that Vedic culture was far older than usually thought." },
  { ref: "tilak", slug: "bal-gangadhar-tilak", kind: "person", label: "Bal Gangadhar Tilak", qid: "Q312555", life: true, link: { to: PERIOD, type: "related_to", note: "Author of The Arctic Home in the Vedas (1903)." }, description: "Indian nationalist leader and scholar; argued for very early Vedic dates and an Arctic homeland of the Vedic Aryans.", aliases: [{ label: "Lokmanya Tilak", lang: "en" }] },
  { ref: "ambedkar", slug: "b-r-ambedkar", kind: "person", label: "B. R. Ambedkar", qid: "Q231690", life: true, link: { to: PERIOD, type: "related_to", note: "Rejected the theory of an Aryan invasion in Who Were the Shudras? (1946)." }, description: "Lawyer and anti-caste leader; in Who Were the Shudras? (1946) he rejected the racial theory of Aryan invasion." },
];

/** Glossary terms (kind "term"). */
const TERMS: EntitySpec[] = [
  { ref: "t_veda", slug: "veda", kind: "term", label: "Veda", description: "“Knowledge”: the oldest sacred texts in Sanskrit. There are four: the Ṛgveda, Sāmaveda, Yajurveda and Atharvaveda, each with later prose texts attached." },
  { ref: "t_sukta", slug: "sukta", kind: "term", label: "sūkta", description: "A hymn of the Ṛgveda. Hymns are grouped into ten books, called maṇḍalas (“circles”), and numbered: 10.90 is book 10, hymn 90.", aliases: [{ label: "maṇḍala", lang: "sa-Latn" }] },
  { ref: "t_shruti", slug: "shruti", kind: "term", label: "śruti", description: "“What is heard”: the Vedic texts, held to be revealed and learnt by ear from a teacher, as opposed to later traditional texts (smṛti, “what is remembered”)." },
  { ref: "t_brahmana", slug: "brahmana-text", kind: "term", label: "Brāhmaṇa", description: "A Vedic prose text explaining rituals and their meaning, later than the hymns. (Not to be confused with brāhmaṇa, a priest.)" },
  { ref: "t_upanishad", slug: "upanishad", kind: "term", label: "Upaniṣad", description: "A later Vedic text of teaching and dialogue about the self (ātman) and ultimate reality (brahman)." },
  { ref: "t_yajna", slug: "yajna", kind: "term", label: "yajña", description: "The Vedic sacrifice: offerings poured into a fire with hymns, for the gods." },
  { ref: "t_varna", slug: "varna", kind: "term", label: "varṇa", description: "One of four broad orders of society named in Vedic texts: brāhmaṇa (priest), kṣatriya or rājanya (ruler, warrior), vaiśya (commoner) and śūdra (servant). Distinct from jāti, the many birth-groups of later caste." },
  { ref: "t_jati", slug: "jati", kind: "term", label: "jāti", description: "“Birth”: one of the many hereditary groups, often tied to an occupation and marriage rules, that make up caste as it developed after the Vedic period." },
  { ref: "t_arya", slug: "arya", kind: "term", label: "ārya", description: "The name the Vedic poets used for themselves and their people. In the 19th century it was turned into a racial label; today scholars use “Indo-Aryan” for a group of languages." },
  { ref: "t_dasa", slug: "dasa-dasyu", kind: "term", label: "dāsa, dasyu", description: "Words for enemies of the Vedic people in the hymns, sometimes demons. How far they refer to real peoples, and which, is debated." },
  { ref: "t_ie", slug: "indo-european", kind: "term", label: "Indo-European", description: "The language family that includes Sanskrit, Persian, Greek, Latin and most languages of Europe and north India, descended from a common ancestor." },
  { ref: "t_ayas", slug: "ayas", kind: "term", label: "ayas", description: "“Metal” in the Ṛgveda, probably copper or bronze; later texts distinguish “dark” ayas, iron." },
];

export interface ResolvedEntities {
  ref: Record<string, string>;
  ops: ChangeOpInput[];
  dependsOn: string[];
  reused: string[];
}

export async function entityOps(mcp: Mcp): Promise<ResolvedEntities> {
  const specs = [...ENTITIES, ...TERMS];
  const qids = specs.flatMap((s) => (s.qid ? [s.qid] : []));
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids });
  const out: ResolvedEntities = { ref: { period: PERIOD }, ops: [], dependsOn: [], reused: [] };
  // Entities without a QID (glossary terms) that a pending changeset already creates, by slug.
  const pendingBySlug = new Map<string, { changesetId: string; ref: string }>();
  const pending = await mcp.call<{ id: string }[]>("list_changesets", { status: ["proposed"], limit: 200 });
  for (const cs of pending) {
    const full = await mcp.call<{ ops: { op: string; slug?: string; ref?: string }[] }>("get_changeset", { id: cs.id });
    for (const op of full.ops)
      if (op.op === "create_entity" && op.slug && op.ref) pendingBySlug.set(op.slug, { changesetId: cs.id, ref: op.ref });
  }
  for (const s of specs) {
    const m = s.qid ? matches[s.qid] : undefined;
    if (m) {
      out.ref[s.ref] = m.slug ?? m.id;
      if (m.status === "pending" && m.changesetId) out.dependsOn.push(m.changesetId);
      out.reused.push(`${s.slug} → ${m.status} ${m.slug ?? m.id}`);
      continue;
    }
    const pend = !s.qid ? pendingBySlug.get(s.slug) : undefined;
    if (pend) {
      out.ref[s.ref] = `@${pend.ref}`;
      out.dependsOn.push(pend.changesetId);
      out.reused.push(`${s.slug} → pending (by slug, ref @${pend.ref})`);
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
    if (s.geo && wd?.coordinates)
      op.geo = {
        geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
        certainty: "approximate",
        note: `Coordinates from Wikidata ${s.qid}: the modern town.`,
      };
    out.ops.push(op);
    out.ref[s.ref] = `@${s.ref}`;
  }
  for (const s of ENTITIES) {
    if (!s.link || !out.ref[s.ref]!.startsWith("@")) continue;
    const to = s.link.to.startsWith("@") ? out.ref[s.link.to.slice(1)]! : s.link.to;
    out.ops.push({ op: "link_entities", from: out.ref[s.ref]!, to, type: s.link.type, ...(s.link.note ? { note: s.link.note } : {}) });
  }
  out.dependsOn = [...new Set(out.dependsOn)];
  return out;
}

// ---------------------------------------------------------------- excerpts

type Loc = { page?: string; pageEnd?: string; volume?: string; chapter?: string; section?: string; verse?: string; label?: string };
export interface ExcerptSpec {
  ref: string;
  source: string;
  snap: CaptureKey;
  quote: string;
  locator: Loc;
  note?: string;
}
export const EXCERPTS: ExcerptSpec[] = [];
const x = (ref: string, source: string, snap: CaptureKey, quote: string, locator: Loc, note?: string) =>
  EXCERPTS.push({ ref, source, snap, quote, locator, ...(note ? { note } : {}) });

// The Ṛgveda as a text
x("vx_mac_hymns", "vs_macdonell", "macdonell", "is 1017, or, if the eleven supplementary hymns (called Valakhilya) which are inserted in the middle of the eighth book are added, 1028. These hymns are grouped in ten books, called mandalas", { page: "40" });
x("vx_wp_hymns", "vs_wp_rigveda", "wpRigveda", "The Rigveda Samhita is the core text and is a collection of 10 books (maṇḍalas) with 1,028 hymns (sūktas) in about 10,600 verses", { section: "Lead" });
x("vx_mac_oral", "vs_macdonell", "macdonell", "the beginnings of Indian poetry and science go back to a time when writing was unknown, and a system of oral tradition, such as is referred to in the Rigveda, was developed before writing was introduced", { page: "16" });
x("vx_wp_oral", "vs_wp_rigveda", "wpRigveda", "Most scholars believe that the sounds and texts of the Rigveda have been orally transmitted with precision since the 2nd millennium BCE, through methods of memorisation of exceptional complexity, rigour and fidelity", { section: "Lead" });
x("vx_mac_book10", "vs_macdonell", "macdonell", "With regard to the tenth book, there can be no doubt that its hymns came into being at a time when the first nine already existed.", { page: "43" });
x("vx_wp_books", "vs_wp_rigveda", "wpRigveda", "The more recent books (Books 1 and 10) in part also deal with philosophical or speculative questions", { section: "Lead" });
// Dating
x("vx_mm_agreement", "vs_mm1891", "mm1891", "There seems to be a general agreement among Sanskrit scholars that the Vedic hymns, as we now possess them, collected in the Rig-veda-samhita, were composed between 1500 and 1000 B.C.", { label: "Lecture II, opening paragraph" });
x("vx_mm_nopower", "vs_mm1891", "mm1891", "Whether the Vedic hymns were composed 1000, or 1500, or 2000, or 3000 years B.C., no power on earth will ever determine.", { page: "91", label: "Lecture IV (“Age of the Veda”)" }, "The OCR reads “ICOO” for 1000.");
x("vx_mm_strata", "vs_mm1891", "mm1891", "the Sutras presupposed the existence of the Brahmana literature, and that the Brahmana literature presupposed the existence of the hymns as collected in the Rig-veda-samhita", { page: "91" });
x("vx_mac_conjectural", "vs_macdonell", "macdonell", "The chronology of the Vedic period is altogether conjectural, being based entirely on internal evidence.", { page: "11" });
x("vx_mac_buddhism", "vs_macdonell", "macdonell", "The lower limit of the second Vedic stratum cannot, however, be fixed later than 500 B.C., because its latest doctrines are presupposed by Buddhism", { page: "11" }, "The OCR reads “later that”.");
x("vx_mac_date", "vs_macdonell", "macdonell", "Professor Max Müller's earlier estimate of 1200 B.C., formed forty years ago, appears to be much nearer the mark.", { page: "12" });
x("vx_mac_nw", "vs_macdonell", "macdonell", "the Indian branch must have separated from the Iranian only a very short time before the beginnings of Vedic literature, and can therefore have hardly entered the North-West of India even as early as 1500 B.C.", { page: "12" });
x("vx_mac_jacobi", "vs_macdonell", "macdonell", "All previous estimates of the antiquity of the Vedic period have been outdone by the recent theory of Professor Jacobi of Bonn, who supposes that period goes back to at least 4000 B.C.", { page: "12" });
x("vx_jacobi_treaty", "vs_jacobi", "jacobi", "Among the documents found by Hugo Winckler there are treaties between Subbiluliuma, king of the Hittites, and Mattiuaza, king of Mitani (Northern Mesopotamia), of the time about 1400 B.C.", { page: "723" });
x("vx_jacobi_gods", "vs_jacobi", "jacobi", "These five gods not only occur in the Rgveda, but they are grouped together here precisely as we find them grouped in the Veda.", { page: "723" });
x("vx_jacobi_theory", "vs_jacobi", "jacobi", "This fact makes the late date of the Veda usually adopted impossible, and is distinctly in favour of my theory.", { page: "723" });
x("vx_wp_dates", "vs_wp_rigveda", "wpRigveda", "most likely between c. 1500 and 1000 BCE, although a wider approximation of c. 1900–1200 BCE has also been given", { section: "Lead" });
x("vx_wp_puranic", "vs_wp_indigenous", "wpIndigenous", "indigenists propose an older date than is generally accepted for the Vedic period, and argue that the Indus Valley civilisation was a Vedic civilisation", { section: "Lead" });
// The world of the hymns
x("vx_rv_nadistuti", "vs_griffith2", "griffith2", "Favour ye this my laud, O Gangā, Yamunā, O Sutudri, Parushni, and Sarasvati", { volume: "2", page: "490", verse: "RV 10.75.5" }, "Griffith does not keep the Sanskrit order of the rivers. The OCR is poor here (“0 Ganga, Yamunil”); the match is approximate.");
x("vx_mac_ganges", "vs_macdonell", "macdonell", "The Ganges itself is already known, for its name is mentioned directly in one passage of the Rigveda and indirectly in another.", { page: "142" });
x("vx_rv_cattle", "vs_griffith2", "griffith2", "With thee are milch-kine good to milk, and horses: best winner thou of riches for the pious.", { volume: "2", page: "17", verse: "RV 7.18.1" });
x("vx_rv_tenkings", "vs_griffith2", "griffith2", "As to their goal they sped to their destruction: they sought Parushni; e'en the swift returned not.", { volume: "2", page: "18", verse: "RV 7.18.9" });
x("vx_wp_tenkings", "vs_wp_tenkings", "wpTenKings", "took place on the bank of river Parushni between a king of the Bharata tribe named Sudas, and a confederation of", { section: "Lead" });
x("vx_wp_ravi", "vs_wp_tenkings", "wpTenKings", "The first phase of the battle took place on the banks of the Ravi River (then Parusni)", { section: "First phase" });
x("vx_mac_indra", "vs_macdonell", "macdonell", "Indra slew Vritra, broke the castles, made a channel for the rivers, pierced the mountain, and delivered over the cows to his friends.", { page: "85", label: "Quoting Ṛgveda 10.89.7" });
// Languages and origins
x("vx_jones_sanskrit", "vs_jones", "jones", "The Sanscrit language, whatever be its antiquity, is of a wonderful structure; more perfect than the Greek, more copious than the Latin, and more exquisitely refined than either, yet bearing to both of them a stronger affinity, both in the roots of verbs and in the forms of grammar, than could possibly have been produced by accident", { volume: "1", page: "26", label: "“The Third Anniversary Discourse”, delivered 2 February 1786" }, "The 1799 printing uses the long s, which the OCR reads as f; the match is approximate.");
x("vx_jones_source", "vs_jones", "jones", "no philologer could examine them all three, without believing them to have sprung from some common source, which, perhaps, no longer exists", { volume: "1", page: "26" });
x("vx_nar_steppe", "vs_narasimhan", "narasimhan", "Steppe ancestry then integrated further south in the first half of the second millennium BCE, contributing up to 30% of the ancestry of modern groups in South Asia", { section: "One page summary" });
x("vx_nar_conduits", "vs_narasimhan", "narasimhan", "documenting movements of people that were likely conduits for the spread of Indo-European languages", { section: "One page summary: conclusion" });
x("vx_nar_males", "vs_narasimhan", "narasimhan", "Most of the Steppe ancestry in South Asia derives from males, pointing to asymmetric social interaction between descendants of Steppe pastoralists and peoples of the Indus Periphery Cline.", { section: "Steppe ancestry in South Asia is primarily from males" });
x("vx_nar_priestly", "vs_narasimhan", "narasimhan", "Groups that view themselves as being of traditionally priestly status, including traditional custodians of liturgical texts in the early Indo-European language Sanskrit, tend (with exceptions) to have more Steppe ancestry than expected", { section: "Steppe ancestry in South Asia is primarily from males" });
x("vx_wp_migration", "vs_wp_migrations", "wpMigrations", "Indo-Aryan migration into the region, from Central Asia, is considered to have started after 2000 BCE as a slow diffusion during the Late Harappan period and led to a language shift in the northern Indian subcontinent.", { section: "Lead" });
x("vx_elst_noconquest", "vs_elst", "elst", "India presents no evidence at all of such foreign conquest in the period considered", { label: "Opening section" });
x("vx_elst_immigration", "vs_elst", "elst", "Squeamish AIT scholars are making everyone toe their line that instead of an “invasion” there was an “immigration”.", { label: "Opening section" });
x("vx_elst_origin", "vs_elst", "elst", "The Out-of-India Theory (OIT) is not a recent “concoction” by Hindu nationalists, as widely alleged, but was thought up by eighteenth-century Europeans.", { label: "Section on the history of the theory" });
x("vx_wp_oit_status", "vs_wp_indigenous", "wpIndigenous", "Support for the IAT mostly exists among a subset of Indian scholars of Hindu religion and the history and archaeology of India, and plays a significant role in Hindutva politics. It has no relevance or support in mainstream scholarship.", { section: "Lead" });
// The politics of a word
x("vx_mm_race", "vs_mm1888", "mm1888", "To me an ethnologist who speaks of Aryan race, Aryan blood, Aryan eyes and hair, is as great a sinner as a linguist who speaks of a dolichocephalic dictionary or a brachycephalic grammar.", { page: "120" });
x("vx_griffith_immigrants", "vs_griffith1", "griffith1", "the great army of Aryan immigrants in their onward march from the Land of the Seven Rivers to the Indian Ocean and the Bay of Bengal", { volume: "1", page: "vi", label: "Preface to the first edition (page read from the running heads)" });
x("vx_mac_dasa", "vs_macdonell", "macdonell", "properly the designation of the dark aborigines of India contrasted with their fair Aryan conquerors, is frequently used in the sense of demons or fiends", { page: "113", label: "On the words dāsa and dasyu" });
x("vx_tilak_arctic", "vs_tilak", "tilak", "the conclusion, that the ancestors of the Vedic Rishis lived in an Arctic home in inter-glacial times, was forced on me by the slowly accumulating mass of Vedic and Avestic evidence", { label: "Preface" }, "Poor OCR in this preface; the match is approximate.");
x("vx_ambedkar_invention", "vs_ambedkar", "ambedkar", "The theory of invasion is an invention.", { page: "73" });
x("vx_ambedkar_inference", "vs_ambedkar", "ambedkar", "The existence of a separate and a distinct Aryan race is thus an inference only.", { page: "73" });
// Later Vedic texts
x("vx_sb_beef_ban", "vs_sbe26", "sbe26", "Let him not eat (the flesh) of either the cow or the ox; for the cow and the ox doubtless support everything here on earth.", { volume: "2", page: "11", verse: "ŚB 3.1.2.21" });
x("vx_sb_beef_yajn", "vs_sbe26", "sbe26", "Nevertheless Yajnavalkya said, 'I, for one, eat it, provided that it is tender.'", { volume: "2", page: "11", verse: "ŚB 3.1.2.21" });
x("vx_sb_east", "vs_sbe12", "sbe12", "He (Agni) thence went burning along this earth towards the east", { volume: "1", page: "104", verse: "ŚB 1.4.1.14" });
x("vx_sb_marshy", "vs_sbe12", "sbe12", "Now-a-days, however, there are many Brahmans to the east of it. At that time it (the land east of the Sadanira) was very uncultivated, very marshy, because it had not been tasted by Agni Vaisvanara.", { volume: "1", page: "105", verse: "ŚB 1.4.1.15" });
x("vx_eggeling_weber", "vs_sbe12", "sbe12", "this legend distinguishes three successive stages of the eastward migration of the Brahmanical Hindus", { volume: "1", page: "104", label: "Eggeling's note, after Weber" });
x("vx_mac_upanishads", "vs_macdonell", "macdonell", "the oldest Upanishads occupying a position linguistically midway between the Brahmanas and the Sutras", { page: "205" });
x("vx_cu_tattvam", "vs_sbe1", "sbe1", "It is the True. It is the Self, and thou, O Svetaketu, art it.", { page: "101", verse: "Chāndogya Upaniṣad 6.8.7" });
x("vx_mac_tattvam", "vs_macdonell", "macdonell", "In that famous formula, \"That art thou\" (tat tvam asi), all the teachings of the Upanishads are summed up.", { page: "221" });
x("vx_bu_karma", "vs_sbe15", "sbe15", "a man of good acts will become good, a man of bad acts, bad. He becomes pure by pure deeds, bad by bad deeds.", { page: "176", verse: "Bṛhadāraṇyaka Upaniṣad 4.4.5" });
x("vx_cu_birth", "vs_sbe1", "sbe1", "Those whose conduct has been good, will quickly attain some good birth, the birth of a Brahmana, or a Kshatriya, or a Vaisya. But those whose conduct has been evil, will quickly attain an evil birth, the birth of a dog, or a hog, or a Kandala.", { page: "82", verse: "Chāndogya Upaniṣad 5.10.7" });
// Varṇa
x("vx_rv_purusha", "vs_griffith2", "griffith2", "The Brahman was his mouth, of both his arms was the Rajanya made. His thighs became the Vaisya, from his feet the Sudra was produced.", { volume: "2", page: "519", verse: "RV 10.90.12" });
x("vx_mac_x90", "vs_macdonell", "macdonell", "besides the one (x. 90) which distinctly refers to the four castes by name, only a few of the latest hymns of the first, eighth, and tenth books", { page: "161" });
x("vx_mac_hereditary", "vs_macdonell", "macdonell", "But during the period represented by Sudas and Vasishtha, in which the older portion of the Rigveda was composed, the priesthood was not yet hereditary", { page: "160" });
x("vx_mac_castes", "vs_macdonell", "macdonell", "The period of the Brahmanas is a very important one in the history of Indian society. For in it the system of the four castes assumed definite shape", { page: "33" });
x("vx_mac_frame", "vs_macdonell", "macdonell", "the frame within which the highly complex network of the castes of to-day has been developed", { page: "34" }, "The OCR reads “fiitwork”.");
// Iron and Painted Grey Ware
x("vx_mac_ayas_red", "vs_macdonell", "macdonell", "the inference which may be drawn as to its colour is decidedly in favour of its having been reddish, which points to bronze and not iron", { page: "151" });
x("vx_mac_ayas_dark", "vs_macdonell", "macdonell", "The fact that the Atharva-veda distinguishes between \"dark\" ayas and \"red,\" seems to indicate that the distinction between iron and copper or bronze had only recently been drawn.", { page: "151" });
x("vx_wp_pgw", "vs_wp_pgw", "wpPgw", "The Painted Grey Ware culture (PGW) is an Iron Age Indo-Aryan culture of the western Gangetic plain and the Ghaggar-Hakra valley in the Indian subcontinent, conventionally dated c.1200 to 600–500 BCE", { section: "Lead" });
x("vx_wp_pgw_iron", "vs_wp_pgw", "wpPgw", "the PGW culture is associated with village and town settlements, domesticated horses, ivory-working, and the advent of iron metallurgy", { section: "Lead" });
x("vx_wp_pgw_kuru", "vs_wp_pgw", "wpPgw", "The PGW Culture probably corresponds to the middle and late Vedic period, i.e., the Kuru-Panchala kingdom", { section: "Lead" });
x("vx_giosan_pgw", "vs_giosan", "giosan", "Later, Painted Gray Ware sites were reestablished along the middle Ghaggar-Hakra course (Fig. 3B), suggesting a possible reinvigoration of seasonal river flows during the Iron Age", { section: "Discussion" });
x("vx_wp_kuru_state", "vs_wp_kuru", "wpKuru", "The Kuru Kingdom was the first recorded state-level society in the Indian subcontinent.", { section: "Lead" });
x("vx_wp_kuru_vedas", "vs_wp_kuru", "wpKuru", "The Kuru kingdom collected and standardized the Vedas", { section: "Lead" });

// ---------------------------------------------------------------- content

/** Claims on the Indus page that this page links to, by their ref in the Indus changeset → opening words. */
export const INDUS_CLAIMS = {
  c_rv_sarasvati: "The Rigveda praises the river Sarasvatī",
  c_oldham: "In 1893, before the Indus civilisation was known",
  c_giosan_monsoon: "Giosan and colleagues (2012) found that only monsoon-fed rivers",
  c_chatterjee: "Chatterjee and colleagues (2019) argue",
  c_dna: "An ancient genome from Rakhigarhi, an Indus city",
  c_no_destruction: "There is no destruction layer",
  c_marshall_aryans: "In his note in the Archaeological Survey's report for 1924–25",
} as const;
export type IndusClaim = keyof typeof INDUS_CLAIMS;

/**
 * `giosanSource` is the Giosan et al. 2012 source created for the Indus page:
 * its id once that page is applied, else its ref in the pending Indus changeset.
 */
export function vedicOps(s: Snaps, E: Record<string, string>, giosanSource: string): ChangeOpInput[] {
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
  const SBE = "Sacred Books of the East";

  const ops: ChangeOpInput[] = [
    // ------------------------------------------------------------ sources
    {
      op: "create_source",
      ref: "vs_griffith1",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Hymns of the Rigveda", translator: [{ family: "Griffith", given: "Ralph T. H." }], edition: "2", volume: "1", issued: { "date-parts": [[1896]] }, publisher: "E. J. Lazarus", "publisher-place": "Benares" },
      identifiers: ia("in.ernet.dli.2015.104118"),
      license: { status: "public_domain", note: "Published 1896; Griffith died 1906." },
      lenses: ["primary_source", "colonial_orientalist"],
      note: "Volume 1 (books 1–5), with the preface to the first edition (1889). A Victorian verse translation; the preface's framing is of its time.",
    },
    {
      op: "create_source",
      ref: "vs_griffith2",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Hymns of the Rigveda", translator: [{ family: "Griffith", given: "Ralph T. H." }], edition: "2", volume: "2", issued: { "date-parts": [[1897]] }, publisher: "E. J. Lazarus", "publisher-place": "Benares" },
      identifiers: ia("in.ernet.dli.2015.104119"),
      license: { status: "public_domain", note: "Published 1897; Griffith died 1906." },
      lenses: ["primary_source"],
      note: "Volume 2 (books 6–10). Quotations are Griffith's English, not the Sanskrit; his notes are his own readings.",
    },
    {
      op: "create_source",
      ref: "vs_macdonell",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "A History of Sanskrit Literature", author: [{ family: "Macdonell", given: "Arthur A." }], issued: { "date-parts": [[1900]] }, publisher: "D. Appleton", "publisher-place": "New York" },
      identifiers: ia("historyofsanskri00macduoft"),
      license: { status: "public_domain", note: "Published 1900; Macdonell died 1930." },
      lenses: ["colonial_orientalist", "philological"],
      note: "A standard survey of its day. Its dates and its picture of “Aryan invaders” and “dark aborigines” are those of 1900, and are quoted as such.",
    },
    {
      op: "create_source",
      ref: "vs_mm1891",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Physical Religion: The Gifford Lectures Delivered before the University of Glasgow in 1890", author: [{ family: "Müller", given: "F. Max" }], issued: { "date-parts": [[1891]] }, publisher: "Longmans, Green, and Co.", "publisher-place": "London" },
      identifiers: ia("physicalreligion00ml"),
      license: { status: "public_domain", note: "Published 1891; Max Müller died 1900." },
      lenses: ["philological"],
    },
    {
      op: "create_source",
      ref: "vs_mm1888",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Biographies of Words and the Home of the Aryas", author: [{ family: "Müller", given: "F. Max" }], issued: { "date-parts": [[1888]] }, publisher: "Longmans, Green, and Co.", "publisher-place": "London" },
      identifiers: ia("biographiesword01mlgoog"),
      license: { status: "public_domain", note: "Published 1888; Max Müller died 1900." },
      lenses: ["philological"],
    },
    {
      op: "create_source",
      ref: "vs_jones",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Works of Sir William Jones", author: [{ family: "Jones", given: "William" }], volume: "1", issued: { "date-parts": [[1799]] }, publisher: "G. G. and J. Robinson", "publisher-place": "London", note: "Includes “The Third Anniversary Discourse”, delivered to the Asiatick Society in Calcutta on 2 February 1786." },
      identifiers: ia("b28776392_0001"),
      license: { status: "public_domain", note: "Published 1799; Jones died 1794." },
      lenses: ["primary_source", "philological"],
      note: "A primary source for the history of the idea of a language family.",
    },
    {
      op: "create_source",
      ref: "vs_jacobi",
      kind: "article",
      tier: "secondary",
      csl: { type: "article-journal", title: "On the Antiquity of Vedic Culture", author: [{ family: "Jacobi", given: "Hermann G." }], "container-title": "Journal of the Royal Asiatic Society of Great Britain and Ireland", page: "721-726", issued: { "date-parts": [[1909]] } },
      identifiers: ia("in.ernet.dli.2015.24463"),
      license: { status: "public_domain", note: "Published 1909; Jacobi died 1937." },
      lenses: ["philological"],
      note: "Reports the Vedic gods in the Mitanni treaties found at Boğazköy in 1907, and argues from them for his early date of the Veda.",
    },
    {
      op: "create_source",
      ref: "vs_tilak",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Arctic Home in the Vedas", author: [{ family: "Tilak", given: "Bal Gangadhar" }], issued: { "date-parts": [[1903]] }, publisher: "Kesari", "publisher-place": "Poona" },
      identifiers: ia("in.ernet.dli.2015.43116"),
      license: { status: "public_domain", note: "Published 1903; Tilak died 1920. Public domain in India and the US." },
      lenses: ["nationalist"],
    },
    {
      op: "create_source",
      ref: "vs_ambedkar",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Who Were the Shudras? How They Came to Be the Fourth Varna in the Indo-Aryan Society", author: [{ family: "Ambedkar", given: "B. R." }], issued: { "date-parts": [[1946]] }, publisher: "Thackers", "publisher-place": "Bombay" },
      identifiers: ia("in.ernet.dli.2015.527572"),
      license: { status: "copyrighted", note: "Ambedkar died 1956: public domain in India since 2017, but probably in US copyright (restored in 1996) until 2042. Quoted in single sentences." },
      lenses: ["subaltern"],
    },
    {
      op: "create_source",
      ref: "vs_sbe12",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Satapatha-Brâhmana, Part I", translator: [{ family: "Eggeling", given: "Julius" }], "collection-title": SBE, "collection-number": 12, issued: { "date-parts": [[1882]] }, publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: ia("in.ernet.dli.2015.238711"),
      license: { status: "public_domain", note: "Published 1882; Eggeling died 1918." },
      lenses: ["primary_source"],
      note: "Books I–II. The scan may be of a reprint; the text and page numbers are the 1882 edition's.",
    },
    {
      op: "create_source",
      ref: "vs_sbe26",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Satapatha-Brâhmana, Part II", translator: [{ family: "Eggeling", given: "Julius" }], "collection-title": SBE, "collection-number": 26, issued: { "date-parts": [[1885]] }, publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: ia("satapathabrhma02eggeuoft"),
      license: { status: "public_domain", note: "Published 1885; Eggeling died 1918." },
      lenses: ["primary_source"],
      note: "Books III–IV.",
    },
    {
      op: "create_source",
      ref: "vs_sbe1",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Upanishads, Part I", translator: [{ family: "Müller", given: "F. Max" }], "collection-title": SBE, "collection-number": 1, issued: { "date-parts": [[1879]] }, publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: ia("upanishads01mluoft"),
      license: { status: "public_domain", note: "Published 1879; Max Müller died 1900." },
      lenses: ["primary_source"],
      note: "Includes the Chāndogya Upaniṣad.",
    },
    {
      op: "create_source",
      ref: "vs_sbe15",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Upanishads, Part II", translator: [{ family: "Müller", given: "F. Max" }], "collection-title": SBE, "collection-number": 15, issued: { "date-parts": [[1884]] }, publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: ia("upanishads02ml"),
      license: { status: "public_domain", note: "Published 1884; Max Müller died 1900." },
      lenses: ["primary_source"],
      note: "Includes the Bṛhadāraṇyaka Upaniṣad.",
    },
    {
      op: "create_source",
      ref: "vs_narasimhan",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "The formation of human populations in South and Central Asia",
        author: [{ family: "Narasimhan", given: "Vagheesh M." }, { literal: "et al." }],
        "container-title": "Science",
        volume: "365",
        issue: "6457",
        page: "eaat7487",
        issued: { "date-parts": [[2019]] },
        DOI: "10.1126/science.aat7487",
      },
      identifiers: { doi: "10.1126/science.aat7487", url: CAPTURES.narasimhan.url },
      license: { status: "copyrighted", note: "Author manuscript on PubMed Central. Quoted briefly." },
      lenses: ["genetic", "mainstream_academic"],
      note: "Ancient DNA from 523 individuals; the main genetic study of the question.",
    },
    {
      op: "create_source",
      ref: "vs_elst",
      kind: "article",
      tier: "secondary",
      csl: { type: "article-magazine", title: "Let the Aryan ‘Invasion’ Theory Become a Debate Again; Out of India Is in Play", author: [{ family: "Elst", given: "Koenraad" }], "container-title": "Swarajya", issued: { "date-parts": [[2023, 2, 21]] }, URL: CAPTURES.elst.url },
      identifiers: { url: CAPTURES.elst.url },
      license: { status: "copyrighted", note: "Quoted briefly." },
      lenses: ["indigenist"],
      note: "A statement of the Out of India case by one of its best-known advocates, in a magazine, not a peer-reviewed journal.",
    },
    wpSource("vs_wp_rigveda", "wpRigveda"),
    wpSource("vs_wp_indigenous", "wpIndigenous"),
    wpSource("vs_wp_migrations", "wpMigrations"),
    wpSource("vs_wp_pgw", "wpPgw"),
    wpSource("vs_wp_kuru", "wpKuru"),
    wpSource("vs_wp_tenkings", "wpTenKings"),
  ];

  for (const ex of EXCERPTS)
    ops.push({
      op: "create_excerpt",
      ref: ex.ref,
      source: ex.source === "vs_giosan" ? giosanSource : `@${ex.source}`,
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
  const period = e("period");

  // 1. A text before writing
  c("v_rv_size", {
    text: "The Ṛgveda is a collection of 1,028 hymns in ten books.",
    kind: "fact",
    assessment: "well_supported",
    assessmentNote: "1,017 hymns, or 1,028 counting eleven supplementary hymns in book 8.",
    themes: ["sources", "religion"],
    entities: [{ entity: e("rigveda") }],
    foundVia: ["wpRigveda"],
    learning: { prompt: "How is the Ṛgveda organised?", answer: "As 1,028 hymns in ten books." },
  });
  c("v_oral", {
    text: "The Vedic hymns were composed and handed down by mouth, memorised with great precision, long before they were written down.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["sources", "culture"],
    lenses: ["philological"],
    entities: [{ entity: e("rigveda") }],
    foundVia: ["wpRigveda"],
    learning: { prompt: "How were the Vedic hymns preserved for most of their history?", answer: "By mouth: memorised with great precision, long before they were written down." },
  });
  c("v_book10_late", {
    text: "The tenth book of the Ṛgveda is later than the first nine: its poets knew the older books.",
    kind: "interpretation",
    assessment: "well_supported",
    themes: ["sources"],
    lenses: ["philological"],
    entities: [{ entity: e("rigveda") }],
    foundVia: ["wpRigveda"],
  });

  // 2. Dating
  c("v_mm_agreement", {
    text: "In 1890 Max Müller reported general agreement among Sanskrit scholars that the hymns were composed between 1500 and 1000 BCE.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1890) },
    themes: ["historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("mmuller") }, { entity: e("rigveda"), role: "mention" }],
  });
  c("v_mm_nopower", {
    text: "Max Müller also admitted that no starting date could be proved: whether the hymns were composed 1000, 1500, 2000 or 3000 years BCE, “no power on earth will ever determine”.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "His 1200 BCE was worked back from the Buddha's time by allowing centuries for each layer of texts; he said himself it was a minimum, not a measurement.",
    when: { start: ce(1890) },
    themes: ["historiography", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("mmuller") }],
    learning: { prompt: "What did Max Müller say about proving when the hymns were composed?", answer: "That whether it was 1000, 1500, 2000 or 3000 years BCE, “no power on earth will ever determine”." },
  });
  c("v_layers", {
    text: "The Vedic texts form a sequence: the Brāhmaṇas presuppose the hymns, and the Sūtras presuppose the Brāhmaṇas; the oldest Upaniṣads come between the Brāhmaṇas and the Sūtras.",
    kind: "interpretation",
    assessment: "well_supported",
    themes: ["sources"],
    lenses: ["philological"],
    entities: [{ entity: period }],
  });
  c("v_mitanni", {
    text: "Treaties of about 1400 BCE between the Hittite king and the king of Mitanni, in northern Mesopotamia, invoke Mitra, Varuṇa, Indra and the Nāsatyas, grouped as in the Ṛgveda.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(1400), basis: "Treaty of Šuppiluliuma and Šattiwaza, as dated by Jacobi (1909)" },
    themes: ["religion", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("mitanni") }, { entity: e("rigveda"), role: "mention" }],
    learning: { prompt: "What do treaties of about 1400 BCE from Mitanni show?", answer: "They invoke Mitra, Varuṇa, Indra and the Nāsatyas, grouped as in the Ṛgveda." },
  });
  c("v_conjectural", {
    text: "Vedic chronology is conjectural: it rests on the texts' internal evidence of language, style and ideas, not on dated records.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["sources"],
    lenses: ["philological"],
    entities: [{ entity: period }],
  });
  c("v_end_date", {
    text: "The end of the Vedic period is fixed from outside: the later Vedic teachings are presupposed by Buddhism, so they cannot be later than about 500 BCE.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Macdonell's argument of 1900; he dated the Buddha's death to 480 BCE. Later scholarship has moved the Buddha somewhat later, which loosens the limit but does not reverse it.",
    themes: ["sources"],
    lenses: ["philological"],
    entities: [{ entity: period }, { entity: e("chandogya"), role: "mention" }],
  });
  c("v_macdonell_date", {
    text: "Macdonell (1900) placed the hymns at about 1300–1000 BCE: Vedic was so close to the oldest Iranian that its speakers could hardly have entered north-west India before about 1500 BCE.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1900) },
    themes: ["historiography"],
    lenses: ["philological", "colonial_orientalist"],
    entities: [{ entity: e("macdonell") }],
  });
  c("v_jacobi_early", {
    text: "Hermann Jacobi argued from astronomical references that Vedic culture went back to at least 4000 BCE, and read the Mitanni gods as support for an early date.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "Few scholars accepted the astronomical dating; Macdonell (1900) treats it as an outlier. The Mitanni evidence shows Vedic gods by about 1400 BCE, not how much earlier.",
    when: { start: ce(1909) },
    themes: ["historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("jacobi") }],
  });
  c("v_modern_date", {
    text: "Most scholars today date the bulk of the Ṛgveda to about 1500–1000 BCE; a wider range of about 1900–1200 BCE is also given.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The dates are inferred from language, the sequence of texts and links with Iranian and Mitanni evidence; no hymn is dated directly.",
    when: { start: bce(1500), end: bce(1000) },
    themes: ["sources", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("rigveda") }],
    foundVia: ["wpRigveda"],
    learning: { prompt: "When is the Ṛgveda usually dated?", answer: "The bulk of it to about 1500–1000 BCE; a wider range of about 1900–1200 BCE is also given." },
  });
  c("v_indigenist_date", {
    text: "Advocates of indigenous Aryan origins propose a much older Vedic period and identify the Indus civilisation as Vedic.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "This view draws on traditional (Purāṇic) chronology. It is not accepted in mainstream scholarship.",
    themes: ["historiography"],
    lenses: ["indigenist"],
    entities: [{ entity: period }],
    foundVia: ["wpIndigenous"],
  });

  // 3. The world of the hymns
  c("v_rivers", {
    text: "The hymns' world is the land of the Indus and the rivers of the Punjab: one hymn (10.75) praises the rivers, from the Gaṅgā and Yamunā to the Sarasvatī, Śutudrī and Paruṣṇī, and the Ganga is named directly only once.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["infrastructure", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rigveda") }, { entity: e("ganga"), role: "place" }, { entity: e("yamuna"), role: "place" }, { entity: e("sutlej"), role: "place" }, { entity: e("ravi"), role: "place" }],
  });
  c("v_cattle", {
    text: "The hymns measure wealth in cattle and horses, and ask the gods for them.",
    kind: "fact",
    assessment: "supported",
    themes: ["economy", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rigveda") }],
  });
  c("v_indra", {
    text: "Indra is the great warrior god of the hymns: he slays the serpent Vṛtra, breaks forts, frees the rivers and wins back the cows.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rigveda") }],
  });
  c("v_tenkings", {
    text: "Book 7 of the Ṛgveda tells how Sudās, king of the Bharatas, with Indra's help defeated a confederation of ten kings by the river Paruṣṇī, the Ravi.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "A statement about what the hymns say; no other evidence for the battle exists, and it cannot be dated.",
    themes: ["war", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("tenkings") }, { entity: e("sudas"), role: "participant" }, { entity: e("ravi"), role: "place" }],
    foundVia: ["wpTenKings"],
    learning: { prompt: "What does Book 7 of the Ṛgveda tell of Sudās?", answer: "That Sudās, king of the Bharatas, with Indra's help defeated a confederation of ten kings by the river Paruṣṇī, the Ravi." },
  });

  // 4. Languages and origins
  c("v_jones", {
    text: "In 1786 William Jones told the Asiatick Society in Calcutta that Sanskrit was so like Greek and Latin, in roots and grammar, that all three must have sprung from a common source.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1786, ), basis: "The Third Anniversary Discourse, 2 February 1786" },
    themes: ["historiography", "culture"],
    lenses: ["philological", "primary_source"],
    entities: [{ entity: e("jones") }],
    learning: { prompt: "What did William Jones point out in 1786?", answer: "That Sanskrit was so like Greek and Latin, in roots and grammar, that all three must have sprung from a common source." },
  });
  c("v_steppe_dna", {
    text: "Ancient DNA shows that ancestry from steppe herders of Central Asia reached South Asia in the first half of the second millennium BCE; the authors argue these movements likely carried the Indo-European languages.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "The genetic arrival is directly measured; its link to language is an inference, though a strong one in the authors' view.",
    when: { start: bce(2000), end: bce(1500), basis: "First half of the second millennium BCE (Narasimhan et al. 2019)" },
    themes: ["society", "culture"],
    lenses: ["genetic", "mainstream_academic"],
    entities: [{ entity: period }],
    learning: { prompt: "What does ancient DNA say about when steppe ancestry reached South Asia?", answer: "In the first half of the second millennium BCE." },
  });
  c("v_steppe_males", {
    text: "Most steppe ancestry in South Asia came through men, and groups of traditionally priestly status, custodians of Sanskrit texts, tend to have more of it than expected.",
    kind: "fact",
    assessment: "supported",
    themes: ["society"],
    lenses: ["genetic"],
    entities: [{ entity: period }],
  });
  c("v_migration", {
    text: "The usual view is that Indo-Aryan speakers came from Central Asia after about 2000 BCE, not as a conquest but as a slow movement that led to a shift of language in north India.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["society", "culture"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: period }],
    foundVia: ["wpMigrations"],
  });
  c("v_oit", {
    text: "Advocates of “Out of India”, such as Koenraad Elst, argue that India shows no evidence of a foreign conquest in this period and that the Indo-European languages may have spread out from India.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "Most linguists, archaeologists and geneticists reject an Indian homeland; the ancient DNA (steppe ancestry arriving in the second millennium BCE) is the strongest evidence against it. The point that there was no conquest is shared by mainstream scholars, who speak of migration rather than invasion.",
    themes: ["historiography", "society"],
    lenses: ["indigenist"],
    entities: [{ entity: period }],
  });
  c("v_oit_status", {
    text: "The indigenous-Aryan or Out of India view is held mainly by some Indian scholars and plays a large part in Hindutva politics; it has little support in mainstream scholarship.",
    kind: "fact",
    assessment: "supported",
    themes: ["historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: period }],
    foundVia: ["wpIndigenous"],
  });
  c("v_not_invasion", {
    text: "Scholars on both sides now agree there is no evidence of a violent Aryan conquest of India; the argument is about migration.",
    kind: "fact",
    assessment: "supported",
    themes: ["historiography", "war"],
    lenses: ["mainstream_academic", "indigenist"],
    entities: [{ entity: period }],
  });

  // 5. The politics of a word
  c("v_mm_race", {
    text: "Max Müller, who had helped popularise the word “Aryan”, insisted in 1888 that it named a family of languages, not a race: to speak of Aryan blood or Aryan eyes was as absurd as a long-headed dictionary.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1888) },
    themes: ["historiography"],
    lenses: ["philological"],
    entities: [{ entity: e("mmuller") }],
    learning: { prompt: "What did Max Müller say “Aryan” meant?", answer: "Those who speak an Aryan language, not a race: “Aryan blood” was as absurd as a long-headed dictionary." },
  });
  c("v_colonial_frame", {
    text: "Victorian translators read the hymns as the story of an “army of Aryan immigrants” and of “fair Aryan conquerors” against “dark aborigines”.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "A reading of its time, which built race into the texts. Whether dāsa and dasyu ever refer to skin colour is disputed.",
    when: { start: ce(1889), end: ce(1900) },
    themes: ["historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("griffith") }, { entity: e("macdonell") }],
  });
  c("v_tilak", {
    text: "The nationalist leader B. G. Tilak argued in 1903 that the ancestors of the Vedic seers had lived in an Arctic homeland in interglacial times.",
    kind: "interpretation",
    assessment: "weak",
    assessmentNote: "Not accepted by later scholars. It shows that Indian nationalists did not all reject an outside homeland.",
    when: { start: ce(1903) },
    themes: ["historiography"],
    lenses: ["nationalist"],
    entities: [{ entity: e("tilak") }],
  });
  c("v_ambedkar", {
    text: "In 1946 B. R. Ambedkar rejected the “theory of invasion” as an invention resting on the assumption of a superior Aryan race.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1946) },
    themes: ["historiography", "society"],
    lenses: ["subaltern"],
    entities: [{ entity: e("ambedkar") }],
  });
  c("v_elst_history", {
    text: "Elst argues that the idea of India as the homeland of the language family began with 18th-century Europeans, and is not a modern Hindu-nationalist invention.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["historiography"],
    lenses: ["indigenist"],
    entities: [{ entity: period }],
  });

  // 6. Brāhmaṇas
  c("v_beef", {
    text: "The Śatapatha Brāhmaṇa (3.1.2.21) forbids eating the flesh of cow or ox, then records that Yājñavalkya said, “I, for one, eat it, provided that it is tender.”",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("satapatha") }, { entity: e("yajnavalkya"), role: "mention" }],
    learning: { prompt: "What does Śatapatha Brāhmaṇa 3.1.2.21 say about beef?", answer: "It forbids it, then records Yājñavalkya saying he eats it “provided that it is tender”." },
  });
  c("v_videgha", {
    text: "A legend in the Śatapatha Brāhmaṇa tells how the sacred fire went burning east from the Sarasvatī to the river Sadānīrā; the land beyond, once marshy and untilled, was by the author's time full of Brāhmaṇs.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "infrastructure"],
    lenses: ["primary_source"],
    entities: [{ entity: e("satapatha") }, { entity: e("videha"), role: "place" }, { entity: e("gandak"), role: "place" }],
  });
  c("v_videgha_reading", {
    text: "Scholars since Albrecht Weber have read the legend as a memory of Vedic culture spreading eastward across the Ganga plain.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "infrastructure"],
    lenses: ["philological"],
    entities: [{ entity: e("satapatha") }, { entity: e("eggeling"), role: "mention" }],
  });

  // 7. Upaniṣads
  c("v_tattvam", {
    text: "The Chāndogya Upaniṣad teaches that the self is the ultimate reality, in the refrain “That art thou” (tat tvam asi), said to the student Śvetaketu.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("chandogya") }],
    learning: { prompt: "What is the famous refrain of the Chāndogya Upaniṣad?", answer: "“That art thou” (tat tvam asi): the self is the ultimate reality." },
  });
  c("v_karma", {
    text: "The Bṛhadāraṇyaka Upaniṣad states the idea of karma: “a man of good acts will become good, a man of bad acts, bad.”",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("brihadaranyaka") }],
  });

  // 8. Varṇa
  c("v_purusha", {
    text: "One hymn of the Ṛgveda, the Puruṣa Sūkta (10.90), names four orders of society made from the body of the primeval Man: the brāhmaṇa from his mouth, the rājanya from his arms, the vaiśya from his thighs and the śūdra from his feet.",
    kind: "fact",
    assessment: "supported",
    themes: ["society", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("purusha") }, { entity: e("rigveda"), role: "mention" }],
    learning: { prompt: "How does the Puruṣa Sūkta describe the four orders of society?", answer: "As made from the body of the primeval Man: the brāhmaṇa was his mouth, the rājanya his arms, the vaiśya his thighs, and the śūdra came from his feet." },
  });
  c("v_purusha_late", {
    text: "The Puruṣa Sūkta is the only hymn of the Ṛgveda that names the four varṇas, and it belongs to the late tenth book.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["society", "sources"],
    lenses: ["philological"],
    entities: [{ entity: e("purusha") }],
  });
  c("v_not_hereditary", {
    text: "Macdonell held that in the older hymns the priesthood was not yet hereditary, and that the four castes took definite shape only in the period of the Brāhmaṇas, framing the much more complex castes of later times.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["society"],
    lenses: ["philological", "colonial_orientalist"],
    entities: [{ entity: e("macdonell") }],
  });
  c("v_birth", {
    text: "By the time of the Chāndogya Upaniṣad, birth into a varṇa was taught as the reward of conduct in a past life: good conduct leads to birth as a brāhmaṇa, kṣatriya or vaiśya, evil conduct to birth as a dog, a pig or a Caṇḍāla.",
    kind: "fact",
    assessment: "supported",
    themes: ["society", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("chandogya") }],
  });

  // 9. Iron and Painted Grey Ware
  c("v_ayas", {
    text: "The Ṛgveda's metal, ayas, was probably copper or bronze; the Atharvaveda distinguishes “dark” ayas from “red”, which suggests iron had only recently come into use.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["technology"],
    lenses: ["philological"],
    entities: [{ entity: e("rigveda"), role: "mention" }, { entity: e("atharvaveda") }],
    learning: { prompt: "What does the Atharvaveda's “dark” ayas suggest, according to Macdonell?", answer: "That the distinction between iron and copper or bronze had only recently been drawn." },
  });
  c("v_pgw", {
    text: "Painted Grey Ware, an Iron Age culture of the western Ganga plain and the Ghaggar-Hakra valley, is usually dated about 1200–600 BCE and is associated with villages, towns, horses and the beginning of iron working.",
    kind: "fact",
    assessment: "supported",
    when: { start: bce(1200), end: bce(600) },
    themes: ["technology", "society"],
    lenses: ["archaeological"],
    entities: [{ entity: e("pgw") }, { entity: e("hastinapur"), role: "place" }, { entity: e("ahichchhatra"), role: "place" }],
    foundVia: ["wpPgw"],
  });
  c("v_pgw_kuru", {
    text: "Painted Grey Ware probably corresponds to the later Vedic period and the Kuru-Pañcāla lands, where the Vedic hymns were collected and standardised.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "A match between archaeology and the texts' geography and date, not a proof: no PGW site has a Vedic inscription. Sourced here through Wikipedia.",
    themes: ["polity", "sources"],
    lenses: ["archaeological"],
    entities: [{ entity: e("pgw") }, { entity: e("kuru") }, { entity: e("panchala"), role: "mention" }],
    foundVia: ["wpPgw", "wpKuru"],
  });
  c("v_kuru_state", {
    text: "The Kuru realm of the later Vedic period is often described as the first state-level society in South Asia after the Indus cities.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "From the texts; no borders can be drawn, and Cliopatria has no polities for these centuries.",
    when: { start: bce(1200), end: bce(900) },
    themes: ["polity"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("kuru") }, { entity: e("kurukshetra"), role: "place" }],
    foundVia: ["wpKuru"],
  });
  c("v_pgw_ghaggar", {
    text: "Painted Grey Ware sites reappear along the middle Ghaggar-Hakra in the Iron Age, perhaps when seasonal river flow revived.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["infrastructure"],
    lenses: ["archaeological"],
    entities: [{ entity: e("pgw") }],
  });

  // Misconceptions
  c("m_written", {
    text: "The Vedas were written down from the start.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "They were composed and transmitted orally, by careful memorisation, for many centuries before writing.",
    themes: ["sources"],
    lenses: ["popular"],
    entities: [{ entity: e("rigveda") }],
  });
  c("m_rv_caste", {
    text: "The Ṛgveda lays down the caste system.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "Only one late hymn names the four varṇas. Hereditary caste, and the many jātis of later India, took shape after the hymns.",
    themes: ["society"],
    lenses: ["popular"],
    entities: [{ entity: e("rigveda") }],
  });
  c("m_beef", {
    text: "Vedic people never ate beef.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "The Śatapatha Brāhmaṇa forbids it and in the same passage records a leading teacher who ate it. Practice varied, and changed over time.",
    themes: ["society", "religion"],
    lenses: ["popular"],
    entities: [{ entity: e("satapatha") }],
  });
  c("m_aryan_race", {
    text: "“Aryan” names a race.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "In the texts ārya is what the Vedic people called themselves; scholars use “Indo-Aryan” for languages. The racial use came in the 19th century.",
    themes: ["historiography"],
    lenses: ["popular"],
    entities: [{ entity: e("t_arya") }],
  });
  c("m_upanishads_old", {
    text: "The Upaniṣads are as old as the Ṛgveda.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "The oldest Upaniṣads are later than the hymns and the Brāhmaṇas, in language and in what they presuppose.",
    themes: ["sources"],
    lenses: ["popular"],
    entities: [{ entity: e("chandogya") }, { entity: e("brihadaranyaka") }],
  });
  c("m_aryan_invasion", {
    text: "Aryan invaders conquered India and destroyed the Indus cities.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "No destruction layer or war is found at the Indus cities, which declined over centuries; the genetic and linguistic evidence points to migration, not conquest.",
    themes: ["war", "historiography"],
    lenses: ["popular", "colonial_orientalist"],
    entities: [{ entity: period }],
  });

  // ------------------------------------------------------------ citations
  const cite = (claim: string, excerpt: string, stance: "supports" | "contradicts" | "qualifies" | "mentions" = "supports", note?: string) =>
    ops.push({ op: "cite", claim: `@${claim}`, excerpt: `@${excerpt}`, stance, ...(note ? { note } : {}) });
  cite("v_rv_size", "vx_mac_hymns");
  cite("v_rv_size", "vx_wp_hymns");
  cite("v_oral", "vx_mac_oral");
  cite("v_oral", "vx_wp_oral");
  cite("v_book10_late", "vx_mac_book10");
  cite("v_book10_late", "vx_wp_books");
  cite("v_mm_agreement", "vx_mm_agreement");
  cite("v_mm_nopower", "vx_mm_nopower");
  cite("v_layers", "vx_mm_strata");
  cite("v_layers", "vx_mac_upanishads");
  cite("v_mitanni", "vx_jacobi_treaty");
  cite("v_mitanni", "vx_jacobi_gods");
  cite("v_conjectural", "vx_mac_conjectural");
  cite("v_conjectural", "vx_mm_nopower");
  cite("v_end_date", "vx_mac_buddhism");
  cite("v_macdonell_date", "vx_mac_date");
  cite("v_macdonell_date", "vx_mac_nw");
  cite("v_jacobi_early", "vx_mac_jacobi");
  cite("v_jacobi_early", "vx_jacobi_theory");
  cite("v_modern_date", "vx_wp_dates");
  cite("v_modern_date", "vx_mm_agreement", "qualifies", "The same range was already the consensus in 1890, though not proved.");
  cite("v_indigenist_date", "vx_wp_puranic");
  cite("v_rivers", "vx_rv_nadistuti");
  cite("v_rivers", "vx_mac_ganges");
  cite("v_cattle", "vx_rv_cattle");
  cite("v_indra", "vx_mac_indra");
  cite("v_tenkings", "vx_rv_tenkings");
  cite("v_tenkings", "vx_wp_tenkings");
  cite("v_tenkings", "vx_wp_ravi");
  cite("v_jones", "vx_jones_sanskrit");
  cite("v_jones", "vx_jones_source");
  cite("v_steppe_dna", "vx_nar_steppe");
  cite("v_steppe_dna", "vx_nar_conduits");
  cite("v_steppe_males", "vx_nar_males");
  cite("v_steppe_males", "vx_nar_priestly");
  cite("v_migration", "vx_wp_migration");
  cite("v_migration", "vx_nar_steppe");
  cite("v_oit", "vx_elst_noconquest");
  cite("v_oit", "vx_nar_steppe", "contradicts", "The genetic evidence for movement into South Asia in the second millennium BCE.");
  cite("v_oit_status", "vx_wp_oit_status");
  cite("v_not_invasion", "vx_elst_noconquest");
  cite("v_not_invasion", "vx_elst_immigration", "supports", "Elst's own description of the mainstream view: “immigration”, not “invasion”.");
  cite("v_not_invasion", "vx_wp_migration");
  cite("v_mm_race", "vx_mm_race");
  cite("v_colonial_frame", "vx_griffith_immigrants");
  cite("v_colonial_frame", "vx_mac_dasa");
  cite("v_tilak", "vx_tilak_arctic");
  cite("v_ambedkar", "vx_ambedkar_invention");
  cite("v_ambedkar", "vx_ambedkar_inference");
  cite("v_elst_history", "vx_elst_origin");
  cite("v_elst_history", "vx_jones_source", "qualifies", "Jones (1786) proposed a common source, not an Indian one.");
  cite("v_beef", "vx_sb_beef_ban");
  cite("v_beef", "vx_sb_beef_yajn");
  cite("v_videgha", "vx_sb_east");
  cite("v_videgha", "vx_sb_marshy");
  cite("v_videgha_reading", "vx_eggeling_weber");
  cite("v_tattvam", "vx_cu_tattvam");
  cite("v_tattvam", "vx_mac_tattvam");
  cite("v_karma", "vx_bu_karma");
  cite("v_purusha", "vx_rv_purusha");
  cite("v_purusha_late", "vx_mac_x90");
  cite("v_purusha_late", "vx_mac_book10");
  cite("v_not_hereditary", "vx_mac_hereditary");
  cite("v_not_hereditary", "vx_mac_castes");
  cite("v_not_hereditary", "vx_mac_frame");
  cite("v_birth", "vx_cu_birth");
  cite("v_ayas", "vx_mac_ayas_red");
  cite("v_ayas", "vx_mac_ayas_dark");
  cite("v_pgw", "vx_wp_pgw");
  cite("v_pgw", "vx_wp_pgw_iron");
  cite("v_pgw", "vx_giosan_pgw", "supports", "PGW sites as Iron Age settlements in the Ghaggar-Hakra region.");
  cite("v_pgw_kuru", "vx_wp_pgw_kuru");
  cite("v_pgw_kuru", "vx_wp_kuru_vedas");
  cite("v_kuru_state", "vx_wp_kuru_state");
  cite("v_pgw_ghaggar", "vx_giosan_pgw");
  cite("m_written", "vx_mac_oral", "contradicts");
  cite("m_written", "vx_wp_oral", "contradicts");
  cite("m_rv_caste", "vx_rv_purusha", "mentions", "The one hymn that names the four varṇas, a source of the belief.");
  cite("m_rv_caste", "vx_mac_x90", "contradicts");
  cite("m_beef", "vx_sb_beef_yajn", "contradicts");
  cite("m_beef", "vx_sb_beef_ban", "mentions", "The prohibition, in the same passage.");
  cite("m_aryan_race", "vx_mm_race", "contradicts");
  cite("m_aryan_race", "vx_ambedkar_inference", "contradicts");
  cite("m_upanishads_old", "vx_mac_upanishads", "contradicts");
  cite("m_upanishads_old", "vx_mm_strata", "contradicts");
  cite("m_aryan_invasion", "vx_mac_dasa", "mentions", "The Victorian picture of “fair Aryan conquerors”.");
  cite("m_aryan_invasion", "vx_elst_noconquest", "contradicts");
  cite("m_aryan_invasion", "vx_wp_migration", "contradicts");

  // ------------------------------------------------------------ relations
  const rel = (from: string, to: string, type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", note?: string) =>
    ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) });
  rel("v_oral", "m_written", "corrects");
  rel("v_purusha_late", "m_rv_caste", "corrects");
  rel("v_not_hereditary", "m_rv_caste", "corrects");
  rel("v_purusha", "m_rv_caste", "context_for");
  rel("v_beef", "m_beef", "corrects");
  rel("v_mm_race", "m_aryan_race", "corrects");
  rel("v_ambedkar", "m_aryan_race", "corrects");
  rel("v_layers", "m_upanishads_old", "corrects");
  rel("v_not_invasion", "m_aryan_invasion", "corrects");
  rel("v_migration", "m_aryan_invasion", "qualifies", "Migration, not conquest.");
  rel("v_colonial_frame", "m_aryan_invasion", "context_for");
  rel("v_mm_nopower", "v_mm_agreement", "qualifies");
  rel("v_jacobi_early", "v_modern_date", "contradicts");
  rel("v_indigenist_date", "v_modern_date", "contradicts");
  rel("v_mitanni", "v_modern_date", "supports", "Vedic gods are attested by about 1400 BCE.");
  rel("v_oit", "v_migration", "contradicts");
  rel("v_steppe_dna", "v_oit", "contradicts");
  rel("v_steppe_dna", "v_migration", "supports");
  rel("v_oit_status", "v_oit", "context_for");
  rel("v_tilak", "v_elst_history", "context_for", "An Indian nationalist who placed the homeland outside India.");
  rel("v_videgha_reading", "v_videgha", "qualifies");
  rel("v_pgw_kuru", "v_pgw", "qualifies");
  rel("v_birth", "v_not_hereditary", "context_for");

  return ops;
}

// ---------------------------------------------------------------- page

export const PAGE_SLUG = "vedic-period";

export function vedicPage(E: Record<string, string>, X: Record<IndusClaim, string>): ChangeOpInput {
  const e = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const C = (ref: string, text: string) => `[${text}](claim:@${ref})`;
  /** A claim on the Indus page (an id, or a ref in the pending Indus changeset). */
  const CI = (ref: IndusClaim, text: string) => `[${text}](claim:${X[ref]})`;
  const N = (ref: string, text: string) => `[${text}](entity:${E[ref] ?? ref})`;
  const people = (...refs: string[]) => refs.map(e);

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown: [
        `After the Indus cities emptied, the next great source for Indian history is not a city but a book that was not written down: the ${N("rigveda", "Ṛgveda")}, ${C("v_rv_size", "1,028 hymns")} ${C("v_oral", "handed down by memory")} for many centuries. Its poets called themselves ${N("t_arya", "ārya")} and lived among ${C("v_rivers", "the rivers of the Punjab")}, with ${C("v_cattle", "their cattle and horses")} and ${C("v_indra", "their warrior god Indra")}. Later texts follow them ${C("v_videgha", "east into the Ganga plain")}, where ${C("v_pgw", "iron and new towns")} appear.`,
        `Almost everything about this period is argued over: ${C("v_modern_date", "when the hymns were composed")}, ${C("v_steppe_dna", "where their language came from")}, and what the texts say about ${C("v_purusha", "caste")} and ${C("v_beef", "food")}. This page sets out the texts first, then each argument with its evidence.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("rigveda"), text: `The oldest Veda. ${C("v_oral", "It was memorised, not written, for centuries")}.`, target: "ch-text", targetLabel: "A text before writing" },
        { entity: e("t_arya"), text: `“Aryan”. ${C("v_mm_race", "Even the scholar who spread the word said it names languages, not a race")}.`, target: "ch-politics", targetLabel: "Aryan: a word, not a race" },
        { entity: e("purusha"), text: `The hymn of the four varṇas. ${C("v_purusha_late", "It is the only one, and late")}.`, target: "ch-varna", targetLabel: "Varṇa and caste" },
        { entity: e("chandogya"), text: `${C("v_tattvam", "“That art thou”")}: the Upaniṣads' teaching about the self.`, target: "ch-upanishads", targetLabel: "The Upaniṣads" },
        { entity: e("tenkings"), text: `${C("v_tenkings", "A battle by the Ravi")}, told in the hymns.`, target: "ch-hymns", targetLabel: "The world of the hymns" },
        { entity: e("satapatha"), text: `${C("v_beef", "A ban on beef, and a famous dissent")}.`, target: "ch-brahmanas", targetLabel: "Ritual and the move east" },
      ],
    },
    {
      id: "meanwhile",
      type: "meanwhile",
      title: "Meanwhile, to the west",
      items: [
        { region: "Northern Mesopotamia (Mitanni)", label: "c. 1400 BCE: treaties sworn by Mitra, Varuṇa, Indra and the Nāsatyas", entity: e("mitanni"), claimIds: ["@v_mitanni"] },
        { region: "Iran", label: "The oldest Iranian texts, in a language very close to Vedic", claimIds: ["@v_macdonell_date"] },
      ],
      note: "These are not just contemporaries: the Mitanni treaties name Vedic gods, and the oldest Iranian is so close to Vedic Sanskrit that, on Macdonell's argument, the two separated not long before the hymns.",
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-text",
      type: "chapter",
      title: "A text before writing",
      promise: "What the Ṛgveda is, how it is organised, and how it survived for centuries without being written down.",
      when: { start: bce(1500), end: bce(1000), basis: "The usual date of the bulk of the hymns" },
      people: people("griffith", "mmuller"),
      terms: [e("t_veda"), e("t_sukta"), e("t_shruti")],
      brief: {
        happened: `The Ṛgveda is ${C("v_rv_size", "1,028 hymns in ten books")}, ${C("v_oral", "memorised and recited for centuries before anyone wrote it down")}.`,
        howWeKnow: "The hymns themselves, in Griffith's Victorian translation, and Macdonell's survey of 1900. No object or inscription survives from the time.",
      },
    },
    {
      id: "text-prose",
      type: "prose",
      markdown: [
        `The ${N("t_veda", "Vedas")} are the oldest texts in Sanskrit. The oldest of them, the Ṛgveda, ${C("v_rv_size", "is a collection of 1,028 hymns in ten books")}, addressed to the gods. ${C("v_book10_late", "The tenth book is later than the rest")}, and its poets knew the older hymns.`,
        `For most of their history the hymns were never read. ${C("v_oral", "They were memorised and recited, passed from teacher to student with astonishing precision")}, as ${N("t_shruti", "śruti")}, “what is heard”. Writing came much later, so we have the words of the hymns but nothing written from the time they were composed.`,
      ].join("\n\n"),
    },
    { id: "text-claims", type: "claims", claimIds: ["@v_rv_size", "@v_oral", "@v_book10_late"] },

    // ------------------------------------------------------------ 2
    {
      id: "ch-dating",
      type: "chapter",
      title: "When were the hymns composed?",
      promise: "Why no hymn can be dated directly, how scholars have estimated it anyway, and why the estimates matter so much.",
      phase: "later",
      places: [e("mitanni")],
      people: people("mmuller", "macdonell", "jacobi"),
      brief: {
        happened: `${C("v_modern_date", "Most scholars place the hymns about 1500–1000 BCE")}, but ${C("v_conjectural", "every date is an inference")}; ${C("v_mitanni", "Vedic gods appear in a treaty of about 1400 BCE")}.`,
        howWeKnow: "The order of the texts, a Mitanni treaty found in 1907, and scholars from Max Müller to today, who disagree.",
      },
    },
    {
      id: "dating-prose",
      type: "prose",
      markdown: [
        `No hymn carries a date: ${C("v_conjectural", "Vedic chronology rests on the texts' own evidence")}. Scholars work from the order of the texts, ${C("v_layers", "each layer presupposing the one before")}, and from a few outside links. ${C("v_end_date", "The end is fixed by Buddhism, which presupposes the latest Vedic teachings")}. In 1890 ${C("v_mm_agreement", "Max Müller reported a general agreement on 1500–1000 BCE")}, yet ${C("v_mm_nopower", "he admitted that “no power on earth” could prove whether it was 1000 or 3000 BCE")}.`,
        `The best outside evidence came from Syria: ${C("v_mitanni", "treaties of about 1400 BCE from the kingdom of Mitanni invoke Mitra, Varuṇa, Indra and the Nāsatyas")}, Vedic gods, grouped as in the hymns. ${C("v_macdonell_date", "Macdonell argued that Vedic was too close to the oldest Iranian for the hymns to be much earlier than 1500 BCE")}; ${C("v_jacobi_early", "Jacobi, from astronomy, pushed the date back to 4000 BCE")}. ${C("v_modern_date", "Most scholars today place the bulk of the hymns about 1500–1000 BCE")}, while ${C("v_indigenist_date", "advocates of indigenous Aryan origins argue for far earlier dates")}.`,
      ].join("\n\n"),
    },
    { id: "dating-claims", type: "claims", claimIds: ["@v_conjectural", "@v_layers", "@v_mm_agreement", "@v_mitanni", "@v_end_date"] },
    {
      id: "dating-debate",
      type: "debate",
      question: "When was the Ṛgveda composed?",
      positions: [
        { label: "About 1500–1000 BCE (most scholars, then and now)", claimIds: ["@v_modern_date", "@v_macdonell_date"] },
        { label: "4000 BCE or earlier, from astronomy (Jacobi)", claimIds: ["@v_jacobi_early"] },
        { label: "Before or during the Indus cities (indigenist view)", claimIds: ["@v_indigenist_date"] },
      ],
      note: "Every date is an inference from the texts. The firm outside points are few: the Mitanni treaties of about 1400 BCE, and Buddhism, which presupposes the latest Vedic teachings.",
    },
    {
      id: "dating-quote",
      type: "quote",
      excerptId: "@vx_mm_nopower",
      caption: "F. Max Müller, Physical Religion (Gifford Lectures, 1890; published 1891), p. 91.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-hymns",
      type: "chapter",
      title: "The world of the hymns",
      promise: "Rivers, cattle, a warrior god and a battle by the Ravi: what the poets tell us about their own world.",
      when: { start: bce(1500), end: bce(1000), basis: "The usual date of the bulk of the hymns" },
      places: [e("ravi"), e("sutlej"), e("yamuna"), e("ganga")],
      people: people("sudas", "vasishtha"),
      terms: [e("t_yajna"), e("t_dasa")],
      brief: {
        happened: `${C("v_rivers", "The poets lived among the rivers of the Punjab")}, ${C("v_cattle", "counted wealth in cattle and horses")}, and ${C("v_tenkings", "remembered a battle by the Ravi")}.`,
        howWeKnow: "Only the hymns: poems for ritual, not chronicles, read in translation.",
      },
    },
    {
      id: "hymns-prose",
      type: "prose",
      markdown: [
        `${C("v_rivers", "The hymns' world is the Punjab and the Indus")}: one hymn calls on the rivers by name, and ${CI("c_rv_sarasvati", "another praises the Sarasvatī as the mightiest of them")}. Whether that river is the dry Ghaggar-Hakra is ${CI("c_oldham", "an old question")}, argued on the [Indus page](page:indus-civilisation). The Ganga, later India's sacred river, is barely mentioned.`,
        `${C("v_cattle", "Wealth was cattle and horses")}, and the poets ask the gods for both at the ${N("t_yajna", "sacrifice")}. ${C("v_indra", "Indra, their warrior god, kills the serpent Vṛtra and frees the rivers and the cows")}. Book 7 remembers a war: ${C("v_tenkings", "King Sudās and his Bharatas defeating ten kings by the Paruṣṇī, the Ravi")}. The hymns call enemies ${N("t_dasa", "dāsa or dasyu")}; who they were is one of the arguments of the next chapters.`,
      ].join("\n\n"),
    },
    { id: "hymns-claims", type: "claims", claimIds: ["@v_rivers", X.c_rv_sarasvati, "@v_cattle", "@v_indra", "@v_tenkings"] },
    {
      id: "hymns-quote",
      type: "quote",
      excerptId: "@vx_rv_tenkings",
      caption: "Ṛgveda 7.18.9, in R. T. H. Griffith's translation (2nd ed., 1897), vol. 2, p. 18.",
    },
    {
      id: "hymns-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. These are poems for ritual, not chronicles. Griffith's translation is Victorian verse; where a word's meaning is disputed, the English hides the dispute.",
    },

    // ------------------------------------------------------------ 4
    {
      id: "ch-languages",
      type: "chapter",
      title: "Where did the language come from?",
      promise: "Sanskrit's cousins in Europe and Iran, what ancient DNA shows, and the “Out of India” alternative.",
      phase: "later",
      people: people("jones"),
      terms: [e("t_ie"), e("t_arya")],
      brief: {
        happened: `${C("v_jones", "Sanskrit belongs to one family with Greek and Latin")}; ${C("v_steppe_dna", "ancient DNA shows steppe ancestry arriving in the second millennium BCE")}, though ${C("v_oit", "some argue the languages spread out of India")}.`,
        howWeKnow: "Comparative linguistics since 1786, a 2019 ancient-DNA study, and an advocate of Out of India, each quoted in their own words.",
      },
    },
    {
      id: "languages-prose",
      type: "prose",
      markdown: [
        `In 1786 ${C("v_jones", "William Jones noticed that Sanskrit, Greek and Latin were too alike to be chance, and must share a common source")}. That source, the ancestor of the ${N("t_ie", "Indo-European")} languages, was spoken somewhere long before the Ṛgveda. Where?`,
        `${C("v_migration", "The usual answer is that Indo-Aryan speakers came from Central Asia after about 2000 BCE")}, in a slow movement, not a conquest. Since 2019 ancient DNA has added a new kind of evidence: ${C("v_steppe_dna", "ancestry from the Central Asian steppe arrived in South Asia in the first half of the second millennium BCE")}, ${CI("c_dna", "after the Indus cities, whose one sampled genome has none")}. ${C("v_steppe_males", "It came mostly through men, and is strongest among groups of traditionally priestly status")}.`,
        `${C("v_oit", "Advocates of “Out of India” argue the reverse: that the languages spread outward from India")}. ${C("v_oit_status", "Their view has little support among specialists, but a large place in Indian politics")}. Both sides now agree on one thing: ${C("v_not_invasion", "there is no evidence of a violent Aryan conquest")}.`,
      ].join("\n\n"),
    },
    { id: "languages-claims", type: "claims", claimIds: ["@v_jones", "@v_steppe_dna", "@v_steppe_males", "@v_not_invasion"] },
    {
      id: "languages-debate",
      type: "debate",
      question: "Where did the Indo-Aryan languages come from?",
      positions: [
        { label: "From the steppe, by migration in the second millennium BCE (most linguists and geneticists)", claimIds: ["@v_migration", "@v_steppe_dna"] },
        { label: "From India itself: “Out of India” (Elst and others)", claimIds: ["@v_oit"] },
      ],
      note: "The question is about languages and ancestry, not about anyone's worth or claim to India. Genes and languages need not travel together; the case for migration rests on linguistics and genetics agreeing. Advocates of Out of India dispute both.",
    },
    {
      id: "languages-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The genetic study is quoted from its authors; the Out of India case from a magazine article by one of its advocates. Neither is a neutral summary, which is why both are shown.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-politics",
      type: "chapter",
      title: "Aryan: a word, not a race",
      promise: "How a word from the hymns became a racial theory, and how scholars, nationalists and Ambedkar argued about it.",
      phase: "later",
      people: people("mmuller", "griffith", "tilak", "ambedkar"),
      terms: [e("t_arya"), e("t_dasa")],
      brief: {
        happened: `${C("v_colonial_frame", "Victorian scholars turned ārya into a race")}; ${C("v_mm_race", "Max Müller")} and ${C("v_ambedkar", "Ambedkar")} rejected that.`,
        howWeKnow: "The writers' own books, 1888–1946, which are evidence of what they argued, not of the Vedic age.",
      },
    },
    {
      id: "politics-prose",
      type: "prose",
      markdown: [
        `In the 19th century ārya, the poets' name for themselves, became a racial label. ${C("v_colonial_frame", "Victorian translators read the hymns as the story of fair Aryan immigrants and dark aborigines")}, and ${CI("c_marshall_aryans", "the first excavators of the Indus cities fitted them into that story")}. Yet ${C("v_mm_race", "Max Müller himself insisted that Aryan named a language family, not a race")}.`,
        `Indian readers took the question in different directions. ${C("v_tilak", "The nationalist B. G. Tilak placed the Aryan homeland in the Arctic")}. ${C("v_ambedkar", "Ambedkar rejected the theory of invasion as an invention built on the idea of a superior race")}. ${C("v_elst_history", "Today's advocates of Out of India say their idea began with 18th-century Europeans, not Hindu nationalism")}.`,
      ].join("\n\n"),
    },
    { id: "politics-claims", type: "claims", claimIds: ["@v_colonial_frame", "@v_mm_race", "@v_tilak", "@v_ambedkar", "@v_elst_history"] },
    {
      id: "politics-quote",
      type: "quote",
      excerptId: "@vx_mm_race",
      caption: "F. Max Müller, Biographies of Words and the Home of the Aryas (1888), p. 120.",
    },

    // ------------------------------------------------------------ 6
    {
      id: "ch-brahmanas",
      type: "chapter",
      title: "Ritual and the move east",
      promise: "The Brāhmaṇas explain the sacrifice in prose; along the way they tell of a fire moving east, and of a teacher who liked his beef tender.",
      places: [e("videha"), e("gandak")],
      people: people("yajnavalkya", "eggeling"),
      terms: [e("t_brahmana"), e("t_yajna")],
      brief: {
        happened: `${C("v_videgha", "A legend tells of the sacred fire moving east")}, and ${C("v_beef", "a ban on beef is followed by a famous dissent")}.`,
        howWeKnow: "The Śatapatha Brāhmaṇa in Eggeling's translation (1882–85).",
      },
    },
    {
      id: "brahmanas-prose",
      type: "prose",
      markdown: [
        `After the hymns came the ${N("t_brahmana", "Brāhmaṇas")}: long prose texts explaining how to perform the sacrifice and what it means. The largest, the ${N("satapatha", "Śatapatha Brāhmaṇa")}, contains a legend: ${C("v_videgha", "the sacred fire went burning east from the Sarasvatī to the river Sadānīrā, and the marshy land beyond later filled with Brāhmaṇs")}. ${C("v_videgha_reading", "Scholars have long read it as a memory of Vedic culture spreading east")}.`,
        `The same text shows that rules about food were argued over. ${C("v_beef", "It forbids eating cow or ox, then records that the great teacher Yājñavalkya ate it anyway, “provided that it is tender”")}.`,
      ].join("\n\n"),
    },
    { id: "brahmanas-claims", type: "claims", claimIds: ["@v_videgha", "@v_videgha_reading", "@v_beef"] },
    {
      id: "brahmanas-quote",
      type: "quote",
      excerptId: "@vx_sb_beef_yajn",
      caption: "Śatapatha Brāhmaṇa 3.1.2.21, in J. Eggeling's translation, Sacred Books of the East 26 (1885), p. 11.",
    },

    // ------------------------------------------------------------ 7
    {
      id: "ch-upanishads",
      type: "chapter",
      title: "The Upaniṣads",
      promise: "Dialogues about the self, rebirth and action, at the end of the Vedic age.",
      when: { start: bce(500), basis: "Not later than about 500 BCE: presupposed by Buddhism (Macdonell 1900)" },
      people: people("yajnavalkya"),
      terms: [e("t_upanishad")],
      brief: {
        happened: `The Upaniṣads teach that ${C("v_tattvam", "the self is the ultimate reality")} and that ${C("v_karma", "acts shape what a person becomes")}.`,
        howWeKnow: "Max Müller's translations (1879–84); the dates are relative, before Buddhism.",
      },
    },
    {
      id: "upanishads-prose",
      type: "prose",
      markdown: `The ${N("t_upanishad", "Upaniṣads")} are the latest Vedic texts: ${C("v_layers", "in language they come after the Brāhmaṇas")}. They turn from ritual to the self. ${C("v_tattvam", "The Chāndogya teaches a student that the self is the ultimate reality: “That art thou”")}. ${C("v_karma", "The Bṛhadāraṇyaka states the law of karma: good acts make a man good, bad acts bad")}, and ${C("v_birth", "the Chāndogya ties a person's next birth to their conduct")}.`,
    },
    { id: "upanishads-claims", type: "claims", claimIds: ["@v_tattvam", "@v_karma"] },

    // ------------------------------------------------------------ 8
    {
      id: "ch-varna",
      type: "chapter",
      title: "Varṇa in the texts, and caste later",
      promise: "One late hymn names four orders of society. How did that become caste?",
      places: [],
      people: people("macdonell"),
      terms: [e("t_varna"), e("t_jati")],
      brief: {
        happened: `${C("v_purusha_late", "Only one late hymn names the four varṇas")}; ${C("v_not_hereditary", "hereditary caste took shape later")}.`,
        howWeKnow: "The Ṛgveda and the Chāndogya Upaniṣad, read with Macdonell (1900), whose view is of its time.",
      },
    },
    {
      id: "varna-prose",
      type: "prose",
      markdown: [
        `${C("v_purusha", "One hymn, the Puruṣa Sūkta, makes the four varṇas from the body of the primeval Man")}: the priest from his mouth, the ruler from his arms, the commoner from his thighs, the servant from his feet. But ${C("v_purusha_late", "it is the only hymn to name them, and it is late")}.`,
        `${C("v_not_hereditary", "In the older hymns, Macdonell argued, the priesthood was not yet hereditary; the four orders took firm shape in the period of the Brāhmaṇas")}. ${C("v_birth", "By the Upaniṣads birth into a varṇa was explained as the reward of past conduct")}. The many ${N("t_jati", "jātis")} of later caste grew within that frame, later still.`,
      ].join("\n\n"),
    },
    { id: "varna-claims", type: "claims", claimIds: ["@v_purusha", "@v_purusha_late", "@v_not_hereditary", "@v_birth"] },
    {
      id: "varna-quote",
      type: "quote",
      excerptId: "@vx_rv_purusha",
      caption: "Ṛgveda 10.90.12, the Puruṣa Sūkta, in R. T. H. Griffith's translation (2nd ed., 1897), vol. 2, p. 519.",
    },

    // ------------------------------------------------------------ 9
    {
      id: "ch-iron",
      type: "chapter",
      title: "Iron, grey pottery and the first states",
      promise: "A new metal, a new pottery, and the Kuru realm where the Vedas were put in order.",
      when: { start: bce(1200), end: bce(600), basis: "Conventional dating of Painted Grey Ware" },
      places: [e("kurukshetra"), e("hastinapur"), e("ahichchhatra")],
      terms: [e("t_ayas")],
      brief: {
        happened: `${C("v_ayas", "Iron appears in the later texts")} and ${C("v_pgw", "in Painted Grey Ware sites of about 1200–600 BCE")}, ${C("v_pgw_kuru", "probably the Kuru-Pañcāla lands")}.`,
        howWeKnow: "Macdonell on the texts' metals, and archaeology summarised through Wikipedia; no borders survive.",
      },
    },
    {
      id: "iron-prose",
      type: "prose",
      markdown: [
        `${C("v_ayas", "The Ṛgveda's metal, ayas, was probably copper or bronze; the Atharvaveda's “dark ayas” is iron, newly come")}. Archaeology finds iron in the same lands: ${C("v_pgw", "Painted Grey Ware, about 1200–600 BCE, a culture of villages, towns, horses and iron in the upper Ganga plain")}, whose sites ${C("v_pgw_ghaggar", "return to the Ghaggar-Hakra valley")}.`,
        `${C("v_pgw_kuru", "Most scholars link Painted Grey Ware with the Kurus and Pañcālas of the later texts")}, and ${C("v_kuru_state", "the Kuru realm is often called the first state after the Indus cities")}. No borders can be drawn for it: this page's map shows places only.`,
      ].join("\n\n"),
    },
    { id: "iron-claims", type: "claims", claimIds: ["@v_ayas", "@v_pgw", "@v_pgw_kuru", "@v_kuru_state"] },
    {
      id: "iron-care",
      type: "callout",
      tone: "method",
      markdown: "About the map. The borders dataset used on other pages, Cliopatria, has no states at all between 1700 and 600 BCE. Rather than invent borders, this page shows the places the texts and the excavations name.",
    },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Six popular beliefs about the Vedic age.",
      phase: "later",
    },
    {
      id: "often-prose",
      type: "prose",
      markdown: "Some short versions of this story are repeated more often than the texts allow. Here are six, each with what the sources on this page say.",
    },
    { id: "myth-written", type: "misconception", theme: "sources", claimId: "@m_written", correctionIds: ["@v_oral"] },
    { id: "myth-caste", type: "misconception", theme: "society", claimId: "@m_rv_caste", correctionIds: ["@v_purusha_late", "@v_not_hereditary"] },
    { id: "myth-beef", type: "misconception", theme: "society", claimId: "@m_beef", correctionIds: ["@v_beef"] },
    { id: "myth-race", type: "misconception", theme: "historiography", claimId: "@m_aryan_race", correctionIds: ["@v_mm_race", "@v_ambedkar"] },
    { id: "myth-upanishads", type: "misconception", theme: "sources", claimId: "@m_upanishads_old", correctionIds: ["@v_layers"] },
    { id: "myth-invasion", type: "misconception", theme: "war", claimId: "@m_aryan_invasion", correctionIds: ["@v_not_invasion", "@v_migration", X.c_no_destruction] },
  ];

  return {
    op: "create_page",
    slug: PAGE_SLUG,
    title: "The Vedic period",
    kind: "era",
    entity: E.period!,
    summary: "The age of the Vedas, c. 1500–500 BCE: hymns memorised for centuries, the arguments over their date and their language, ritual, the Upaniṣads, varṇa, and iron in the Ganga plain.",
    blocks,
    status: "published",
    position: 2,
    spec: vedicSpec(),
  };
}

/** Places only: Cliopatria has no polities for these centuries. */
export function vedicSpec(): PageSpecInput {
  const astro = (y: number) => toAstronomicalYear(y, "BCE");
  return {
    atlas: {
      focus: [],
      range: [astro(1500), astro(500)],
      initialYear: astro(1000),
      stops: [
        { year: astro(1400), label: "Vedic gods in a Mitanni treaty", claimId: "@v_mitanni" },
        { year: astro(1200), label: "Painted Grey Ware and iron", claimId: "@v_pgw" },
        { year: astro(1000), label: "The bulk of the hymns composed by now", claimId: "@v_modern_date" },
      ],
      neighbours: true,
      bounds: [66, 22, 90, 35],
    },
    timeline: { range: [astro(1500), astro(500)] },
  };
}
