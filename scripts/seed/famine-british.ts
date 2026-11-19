import type { BlockInput, ChangeOpInput, PageSpecInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "The famines of British India" (theme page, 1757–1947, and the turn after
 * independence): ordinary life in good years, what failed first when the
 * rains failed, how people survived, what the Company and the Raj did or did
 * not do, the toll, and how life changed afterwards.
 *
 * Sources, all captured as snapshots and quoted exactly:
 *  - Hunter, The Annals of Rural Bengal, vol. I (1868), which quotes the
 *    Company's own letters on 1769–70, with the Council's letter of
 *    3 November 1772 (Warren Hastings) in its Appendix A, and John Shore's
 *    verses on what he saw.
 *  - Digby, The Famine Campaign in Southern India, vol. I (1878): newspaper
 *    correspondents, official minutes and a village inquiry in Mysore.
 *  - Report of the Indian Famine Commission, Part I (1880) and the
 *    Commission of 1901 (reprint 1908): Government of India, public domain.
 *  - The Imperial Gazetteer of India, vol. III (1907), ch. X "Famine" (by
 *    S. H. Butler): the official history and the official view.
 *  - Gazetteer of the Bombay Presidency, vol. XXII, Dharwar (1884), for the
 *    "skull famine" of 1791–92.
 *  - Nash, The Great Famine and its Causes (1900): an eyewitness in 1900.
 *  - The critics: Dutt, Open Letters to Lord Curzon (1900) and India in the
 *    Victorian Age (1904); Digby, "Prosperous" British India (1901); and
 *    Naoroji's drain, reused from the independence page. The reply:
 *    Curzon's budget speech of 1900 (Raleigh's selection, 1906).
 *  - Famine Inquiry Commission, Report on Bengal (1945): Government of India,
 *    public domain in India (published more than 60 years ago).
 *  - Wikipedia (pinned revisions, tertiary) for modern estimates, the
 *    scholarly debate (Sen and his critics, Davis, Roy) and independent India.
 *
 * Sen's Poverty and Famines (1981) is in copyright and is not quoted
 * directly; his argument is cited through Wikipedia, which quotes it.
 */

const ce = (year: number, month?: number, day?: number) => ({ year, era: "CE" as const, ...(month ? { month } : {}), ...(day ? { day } : {}) });

export const PAGE_SLUG = "the-famines-of-british-india";
export const PAGE_TITLE = "The famines of British India";

// ---------------------------------------------------------------- snapshots

export const CAPTURES = {
  hunter: { kind: "internet_archive", identifier: "annalsofruralben00huntuoft" },
  digby: { kind: "internet_archive", identifier: "faminecampaignin01digbuoft" },
  nash: { kind: "internet_archive", identifier: "greatfamineitscanash" },
  fc1880: { kind: "internet_archive", identifier: "dli.ernet.17292" },
  fc1901: { kind: "internet_archive", identifier: "dli.csl.1202" },
  igi3: { kind: "internet_archive", identifier: "in.ernet.dli.2015.207356" },
  dharwar: { kind: "internet_archive", identifier: "dli.csl.3218" },
  duttLetters: { kind: "internet_archive", identifier: "openletterstolor00duttrich" },
  duttVictorian: { kind: "internet_archive", identifier: "indiainvictorian00duttuoft" },
  digbyProsperous: { kind: "internet_archive", identifier: "in.ernet.dli.2015.96399" },
  curzon: { kind: "internet_archive", identifier: "lordcurzoninind00curzgoog" },
  fic1945: { kind: "internet_archive", identifier: "in.ernet.dli.2015.206311" },
  wp1770: { kind: "wikipedia", title: "Bengal famine of 1770" },
  wpChalisa: { kind: "wikipedia", title: "Chalisa famine" },
  wpDoji: { kind: "wikipedia", title: "Doji bara famine" },
  wp1876: { kind: "wikipedia", title: "Great Famine of 1876–1878" },
  wp1943: { kind: "wikipedia", title: "Bengal famine of 1943" },
  wpFamineIndia: { kind: "wikipedia", title: "Famine in India" },
  wpGreen: { kind: "wikipedia", title: "Green Revolution in India" },
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

type Kind = "person" | "place" | "event" | "term" | "period" | "polity";
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  when?: Record<string, unknown>;
  life?: boolean;
  aliases?: { label: string; lang?: string; script?: string; note?: string }[];
  link?: { to: string; type: "part_of" | "located_in" | "related_to" | "contemporary_of" | "ruled"; note?: string };
}

/** Existing entities this page links to: reused by slug, never created here. */
export const EXISTING: Record<string, string> = {
  companyRule: "company-rule",
  britishRaj: "british-raj",
  independentIndia: "independent-india",
  maratha: "maratha-confederacy",
  bengal1943: "bengal-famine-of-1943",
  naoroji: "dadabhai-naoroji",
  drain: "drain-of-wealth",
};

export const ENTITIES: EntitySpec[] = [
  // Famines
  { ref: "f1770", slug: "bengal-famine-of-1770", kind: "event", label: "Bengal famine of 1770", qid: "Q2477522", when: { start: ce(1769), end: ce(1770), basis: "The failed harvest of late 1769 and the famine of 1770 (Hunter, Annals of Rural Bengal)" }, link: { to: EXISTING.companyRule!, type: "part_of" }, description: "The famine of 1769–70 in Bengal and Bihar, a few years after the East India Company took the right to collect the revenue.", aliases: [{ label: "Great Bengal famine of 1770", lang: "en" }, { label: "Chhiattorer manvantar", lang: "en", note: "Bengali name, “the famine of [the year 11]76” in the Bengali calendar" }] },
  { ref: "chalisa", slug: "chalisa-famine", kind: "event", label: "Chalisa famine", qid: "Q3530493", when: { start: ce(1783), end: ce(1784) }, link: { to: EXISTING.companyRule!, type: "contemporary_of", note: "Mostly in territory not under the Company." }, description: "The famine of 1783–84 in north India, named after the Vikram Samvat year 1840." },
  { ref: "doji", slug: "doji-bara-famine", kind: "event", label: "Doji bara famine", qid: "Q3530522", when: { start: ce(1791), end: ce(1792) }, link: { to: EXISTING.maratha!, type: "contemporary_of", note: "Severest in Maratha and Hyderabad territory." }, description: "The “skull famine” of 1791–92 in the Deccan, Gujarat and Marwar, remembered for its unburied dead.", aliases: [{ label: "Skull famine", lang: "en" }, { label: "Dogi Bara", lang: "en", note: "Spelling in the Dharwar gazetteer (1884)" }] },
  { ref: "orissa1866", slug: "orissa-famine-of-1866", kind: "event", label: "Orissa famine of 1866", qid: "Q3523487", when: { start: ce(1866), basis: "1865–66; Wikidata Q3523487" }, link: { to: EXISTING.britishRaj!, type: "part_of" }, description: "The famine of 1866 in Orissa, then cut off from the rest of India, in which about a third of the people died.", aliases: [{ label: "Odisha famine of 1866", lang: "en" }] },
  { ref: "great1876", slug: "great-famine-of-1876-1878", kind: "event", label: "Great Famine of 1876–1878", qid: "Q3534685", when: { start: ce(1876), end: ce(1878) }, link: { to: EXISTING.britishRaj!, type: "part_of" }, description: "Two years of famine in Madras, Bombay, Mysore and Hyderabad, and later further north.", aliases: [{ label: "Madras famine of 1877", lang: "en" }, { label: "Southern India famine of 1876–1878", lang: "en" }] },
  { ref: "f1896", slug: "indian-famine-of-1896-1897", kind: "event", label: "Indian famine of 1896–1897", qid: "Q6022238", when: { start: ce(1896), end: ce(1897) }, link: { to: EXISTING.britishRaj!, type: "part_of" }, description: "The famine of 1896–97 across the United Provinces, the Central Provinces, Bihar and beyond." },
  { ref: "f1899", slug: "indian-famine-of-1899-1900", kind: "event", label: "Indian famine of 1899–1900", qid: "Q6022234", when: { start: ce(1899), end: ce(1900) }, link: { to: EXISTING.britishRaj!, type: "part_of" }, description: "The famine that followed the failure of the monsoon of 1899 in western and central India." },
  // People
  { ref: "hastings", slug: "warren-hastings", kind: "person", label: "Warren Hastings", qid: "Q333994", life: true, link: { to: EXISTING.companyRule!, type: "related_to", note: "Governor of Bengal from 1772, Governor-General 1773–1785." }, description: "The East India Company's Governor of Bengal from 1772 and first Governor-General." },
  { ref: "hunter", slug: "william-wilson-hunter", kind: "person", label: "W. W. Hunter", qid: "Q724677", life: true, link: { to: EXISTING.britishRaj!, type: "related_to", note: "Author of The Annals of Rural Bengal (1868)." }, description: "British official and historian of India, author of The Annals of Rural Bengal (1868) and of the Imperial Gazetteer.", aliases: [{ label: "William Wilson Hunter", lang: "en" }] },
  { ref: "digby", slug: "william-digby", kind: "person", label: "William Digby", qid: "Q8007835", life: true, link: { to: EXISTING.britishRaj!, type: "related_to", note: "Wrote on the famine of 1876–78 and against British rule's economic effects." }, description: "British journalist who ran the Madras famine relief fund in 1877 and later wrote “Prosperous” British India (1901)." },
  { ref: "dutt", slug: "romesh-chunder-dutt", kind: "person", label: "Romesh Chunder Dutt", qid: "Q3348870", life: true, link: { to: EXISTING.britishRaj!, type: "related_to", note: "Critic of land revenue policy; economic historian." }, description: "Indian civil servant, economic historian and critic of British land revenue policy, author of Open Letters to Lord Curzon (1900).", aliases: [{ label: "R. C. Dutt", lang: "en" }, { label: "Romesh Dutt", lang: "en" }] },
  { ref: "temple", slug: "richard-temple", kind: "person", label: "Sir Richard Temple", qid: "Q3431266", life: true, link: { to: EXISTING.britishRaj!, type: "related_to", note: "Famine Commissioner in 1877." }, description: "British administrator, Famine Commissioner for the Government of India in 1877, after whom the reduced relief wage was named.", aliases: [{ label: "Richard Temple", lang: "en" }] },
  { ref: "lytton", slug: "lord-lytton", kind: "person", label: "Lord Lytton", qid: "Q335493", life: true, link: { to: EXISTING.britishRaj!, type: "related_to", note: "Viceroy 1876–1880." }, description: "Viceroy of India, 1876–1880, during the Great Famine.", aliases: [{ label: "Robert Bulwer-Lytton, 1st Earl of Lytton", lang: "en" }] },
  { ref: "curzon", slug: "lord-curzon", kind: "person", label: "Lord Curzon", qid: "Q271878", life: true, link: { to: EXISTING.britishRaj!, type: "related_to", note: "Viceroy 1899–1905." }, description: "Viceroy of India, 1899–1905, during the famine of 1899–1900.", aliases: [{ label: "George Nathaniel Curzon", lang: "en" }] },
  { ref: "sen", slug: "amartya-sen", kind: "person", label: "Amartya Sen", qid: "Q132489", life: true, link: { to: EXISTING.bengal1943!, type: "related_to", note: "Wrote Poverty and Famines (1981) on the 1943 famine, which he saw as a child." }, description: "Indian economist, author of Poverty and Famines (1981), who argued that famines come from a collapse in people's ability to buy food, not only from a lack of food." },
];

const TERMS: EntitySpec[] = [
  { ref: "t_relief_works", slug: "relief-works", kind: "term", label: "relief works", description: "Public works (roads, tanks, canals, stone-breaking) opened in a famine so that people could earn food or wages by labour; the main form of relief for the able-bodied in British India." },
  { ref: "t_gratuitous", slug: "gratuitous-relief", kind: "term", label: "gratuitous relief", description: "Food or money given without work in a famine, to those who could not work: the old, the sick, small children." },
  { ref: "t_famine_code", slug: "famine-code", kind: "term", label: "famine code", description: "A province's written rules for spotting famine early and running relief, drawn up after the Famine Commission of 1880; renamed scarcity manuals after independence." },
  { ref: "t_famine_foods", slug: "famine-foods", kind: "term", label: "famine foods", description: "What people ate when grain ran out: grass seed, roots, leaves, bark, tamarind and mango kernels, bamboo seed, and other things not eaten in ordinary years." },
  { ref: "t_land_revenue", slug: "land-revenue", kind: "term", label: "land revenue", description: "The tax on land, the main income of Indian states from the Mughals to the Raj; whether it was set too high, and collected in famine years, was argued over in every famine." },
  { ref: "t_entitlement", slug: "entitlement-famine", kind: "term", label: "entitlement famine", description: "Amartya Sen's term for a famine caused less by a fall in food supply than by people losing the means to get food: wages, crops or goods to sell." },
];

export interface ResolvedEntities {
  ref: Record<string, string>;
  ops: ChangeOpInput[];
  dependsOn: string[];
  reused: string[];
}

export async function entityOps(mcp: Mcp): Promise<ResolvedEntities> {
  const out: ResolvedEntities = { ref: {}, ops: [], dependsOn: [], reused: [] };
  for (const [ref, slug] of Object.entries(EXISTING)) {
    const found = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: slug }).catch(() => null);
    if (!found?.entity?.id) throw new Error(`expected existing entity "${slug}" not found`);
    out.ref[ref] = slug;
    out.reused.push(`${slug} → existing`);
  }
  const specs = [...ENTITIES, ...TERMS];
  const qids = specs.flatMap((s) => (s.qid ? [s.qid] : []));
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids });
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
    const bySlug = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: s.slug }).catch(() => null);
    if (bySlug?.entity?.id) {
      out.ref[s.ref] = s.slug;
      out.reused.push(`${s.slug} → existing (by slug)`);
      continue;
    }
    const pend = pendingBySlug.get(s.slug);
    if (pend) {
      out.ref[s.ref] = `@${pend.ref}`;
      out.dependsOn.push(pend.changesetId);
      out.reused.push(`${s.slug} → pending (by slug, ref @${pend.ref})`);
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
    out.ops.push(op);
    out.ref[s.ref] = `@${s.ref}`;
  }
  for (const s of ENTITIES) {
    if (!s.link || !out.ref[s.ref]!.startsWith("@")) continue;
    out.ops.push({ op: "link_entities", from: out.ref[s.ref]!, to: s.link.to, type: s.link.type, ...(s.link.note ? { note: s.link.note } : {}) });
  }
  out.dependsOn = [...new Set(out.dependsOn)];
  return out;
}

// ---------------------------------------------------------------- excerpts

type Loc = { page?: string; pageEnd?: string; volume?: string; chapter?: string; section?: string; label?: string };
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

const HUNTER_CH2 = "Chapter I, the famine of 1769–70";
const HASTINGS = "Appendix A, “Bengal portrayed, A.D. 1772”: letter of the President and Council (Warren Hastings) to the Court of Directors, 3 November 1772";
const IGI = "Chapter X, “Famine” (S. H. Butler)";
const KALASTRI = "Special correspondent of the Friend of India, writing from Kalastri, North Arcot, 16 March 1877, quoted by Digby";
const HAY = "Colonel Hay's inquiry in a Mysore village, 3 March 1877, quoted by Digby";

// Ordinary years
x("bx_igi_credit", "fs_igi", "igi3", "The farmers have no capital and depend on unorganized local credit, which shrinks when harvests fail.", { page: "475", label: IGI });
x("bx_igi_labourers", "fs_igi", "igi3", "Off the land, but dependent on it, are millions of agricultural labourers, the vast majority of whom have only casual employment and are thrown out of work when harvests fail.", { page: "476", label: IGI });
x("bx_igi_monsoon", "fs_igi", "igi3", "The monsoon bursts in June, and dies away at the end of September or beginning of October.", { page: "476", label: IGI });
x("bx_igi_kharif", "fs_igi", "igi3", "the autumn harvest (kharif), which provides the year’s food for the poorer classes, viz. millets and rice, is sown.", { page: "476", label: IGI });
x("bx_fic_rice", "fs_fic", "fic1945", "Bengal may be described as a land of rice growers and rice eaters.", { page: "5", label: "Part I, ch. II, “General description of Bengal”" });
x("bx_fic_two_acres", "fs_fic", "fic1945", "about half the families in the rural areas, depending wholly or mainly on the cultivation of land, hold less than 2 acres or are landless.", { page: "67", label: "Part I, ch. IX, “Relief”, para. 8" });
x("bx_fic_charity", "fs_fic", "fic1945", "Village charity, customarily in the form of gifts of rice, dried up not only because rice was in short supply but also because it had become such an expensive commodity.", { page: "67", label: "Part I, ch. IX, para. 8" });
x("bx_digby_ration", "fs_digby", "digby", "The usual quantity of food was ten seers, at the rate of three-quarters of a seer per head. It is now reduced to eight seers, or half a seer per head. Instead of ragi ball, ambli or gruel is issued. Horse-gram or hallar, which was invariably used formerly, is now dispensed with.", { volume: "1", page: "440", label: HAY }, "The household of “No. 1”, head of a family of thirteen. A seer is about 2 lb.");
x("bx_nash_bullocks", "fs_nash", "nash", "The big bullocks that plough and draw the water from the wells and haul the heavy waggons were getting thinned off", { page: "68", label: "Ch. VIII, “In the garden of India” (Broach, Gujarat)" });
x("bx_nash_tenpercent", "fs_nash", "nash", "It is estimated, indeed, that not more than 10 per cent, of the brood cattle will survive the famine.", { page: "69", label: "Ch. VIII" });
x("bx_fc_landless", "fs_fc1880", "fc1880", "the actually landless class who live on the wages of labour, and the smallest proprietors or occupiers", { section: "Part I, para. 109", label: "The classes that suffer from famine" });
x("bx_fc_charity", "fs_fc1880", "fc1880", "and, lastly, all classes become less able to give charitable help to public beggars, and to support their dependants.", { section: "Part I, para. 109" });
x("bx_igi_storage", "fs_igi", "igi3", "It is contended that, by equalizing prices all over India, railways extend the area of distress beyond the limits of crop failure, and that they have destroyed the habit of storing grain, which formerly served as an insurance against famine.", { page: "496", label: IGI });
x("bx_igi_money", "fs_igi", "igi3", "They have substituted famines which are of money only, for famines in which both food and money were lacking", { page: "496", label: IGI });

// Bengal 1769–70
x("hx_oneyear", "fs_hunter", "hunter", "The famine of 1770 was therefore a one year's famine, caused by the general failure of the December harvest in 1769, and intensified by a partial failure of the crops of the previous year and the following spring.", { volume: "1", page: "31", label: HUNTER_CH2 });
x("hx_sold", "fs_hunter", "hunter", "All through the stifling summer of 1770 the people went on dying. The husbandmen sold their cattle; they sold their implements of agriculture; they devoured their seed-grain; they sold their sons and daughters, till at length no buyer of children could be found; they eat the leaves of trees and the grass of the field", { volume: "1", page: "26", label: HUNTER_CH2 }, "Hunter's summary of petitions from district officers in the Company's records (India Office); “eat” is his spelling.");
x("hx_onethird", "fs_hunter", "hunter", "Before the end of May 1770, one-third of the population was officially calculated to have disappeared", { volume: "1", page: "32", label: HUNTER_CH2 });
x("hx_tenmillion", "fs_hunter", "hunter", "we cannot help arriving at the conclusion, that the failure of a single crop, following a year of scarcity, had within nine months swept away ten millions of human beings.", { volume: "1", page: "34", label: HUNTER_CH2 });
x("hx_warehouse", "fs_hunter", "hunter", "Until 1772 Bengal was regarded by the British public in the light of a vast warehouse", { volume: "1", page: "34", label: HUNTER_CH2 });
x("hx_allot", "fs_hunter", "hunter", "Districts in which men were dying at the rate of twenty thousand a month received allotments of a hundred and fifty rupees.", { volume: "1", page: "36", label: HUNTER_CH2 });
x("hx_remit", "fs_hunter", "hunter", "In a year when thirty-five per cent. of the whole population and fifty per cent. of the cultivators perished, not five per cent. of the land-tax was remitted, and ten per cent. was added to it for the ensuing year (1770-71).", { volume: "1", page: "39", label: HUNTER_CH2 });
x("hx_tenpercent", "fs_hunter", "hunter", "the Council, acting upon the advice of its Mussulman Minister of Finance, added ten per cent. to the land-tax for the ensuing year.", { volume: "1", page: "23", label: HUNTER_CH2 });
x("hx_shore", "fs_hunter", "hunter", "Still fresh in memory's eye the scene I view, The shrivelled limbs, sunk eyes, and lifeless hue; Still hear the mother's shrieks and infant's moans.", { volume: "1", page: "28", label: "John Shore (later Lord Teignmouth), verses on the famine of 1770, quoted by Hunter" }, "Shore was a young Company officer in Bengal in 1770; Hunter calls this the only non-official eyewitness description, and takes it from the Memoir of Lord Teignmouth (1843).");
x("hx_waste", "fs_hunter", "hunter", "half-peopled and with one-third of its surface lying waste", { volume: "1", page: "27", label: "Footnote: John Shore's view of Bengal in 1789" });
x("hx_hastings_loss", "fs_hunter", "hunter", "the loss of at least one-third of the Inhabitants of the Province, and the consequent decrease of the Cultivation", { volume: "1", page: "381", label: HASTINGS });
x("hx_hastings_violent", "fs_hunter", "hunter", "That it did not, was owing to its being violently kept up to its former Standard.", { volume: "1", page: "381", label: HASTINGS }, "That is, the revenue did not fall with the people.");
x("hx_1866", "fs_hunter", "hunter", "During the famine of 1866 it was found impossible to render public charity available to the female members of the respectable classes, and many a rural household starved slowly to death without uttering a complaint or making a sign.", { volume: "1", page: "26", label: HUNTER_CH2 });
x("wx_1770_causes", "fs_wp1770", "wp1770", "Crop failure in autumn 1768 and summer 1769 and an accompanying smallpox epidemic were thought to be the manifest reasons for the famine.", { section: "Lead" });
x("wx_1770_taxes", "fs_wp1770", "wp1770", "The East India Company provided little mitigation through direct relief efforts; nor did it reduce taxes, though its options to do so may have been limited.", { section: "Lead" });
x("wx_1770_estimate", "fs_wp1770", "wp1770", "Some scholars consider these numbers to be exaggerated in large part because reliable demographic information had been lacking in 1770.", { section: "Lead" });
x("fx_1770", "fs_fc1880", "fc1880", "was extremely severe, and it was officially estimated at the time that a third of the", { section: "Part I, para. 42", label: "The famine of 1770 in Lower Bengal and Behar" }, "The sentence ends “…of the population (10 millions) had died”; the OCR garbles it.");
x("ix_1770", "fs_igi", "igi3", "A third of the population, or 10,000,000, are said to have perished in the Bengal famine of 1770", { page: "485", label: IGI });
x("ix_disputed", "fs_igi", "igi3", "Both estimates have been disputed, the former as excessive, the latter as inadequate.", { page: "485", label: IGI }, "The other estimate is Baird-Smith's 800,000 deaths in the Agra famine of 1838.");

// 1783–1792
x("wx_chalisa", "fs_wpChalisa", "wpChalisa", "The famine affected many parts of North India, especially the Delhi territories, present-day Uttar Pradesh, Eastern and Western Punjab, Rajputana, and Kashmir, then all ruled by different Indian rulers.", { section: "Lead" });
x("wx_chalisa_toll", "fs_wpChalisa", "wpChalisa", "It is thought that up to 11 million people may have died in the two famines.", { section: "Lead" });
x("fx_1784", "fs_fc1880", "fc1880", "but the country was not at that time under British", { section: "Part I, para. 42", label: "On the famine of 1784 in Upper India" }, "The OCR of this paragraph is poor (“Uiiper India”, “jm’isdiction”); only clean words are quoted.");
x("dx_skull", "fs_dharwar", "dharwar", "feeding on leaves and berries, and women and children were sold. In Dambal the rains failed for twelve years and for three years there was no tillage. From the number of unburied dead the famine is remembered as Dogi Bara or the Skull Famine.", { page: "307", label: "Ch. IV, Agriculture: famines, 1791–92" });
x("dx_peshwa", "fs_dharwar", "dharwar", "The distressed were said to have been relieved by the rich. Beyond seizing some stores of grain at Hubli the Peshwa’s government seem to have done nothing.", { page: "307", label: "Ch. IV, Agriculture: famines, 1791–92" });
x("wx_doji", "fs_wpDoji", "wpDoji", "In regions like the Madras Presidency (governed by the East India Company), where the famine was less severe, and where records were kept, half the population perished in some districts, such as in the Northern Circars.", { section: "Lead" });
x("fx_1792", "fs_fc1880", "fc1880", "relief-works were first opened by the", { section: "Part I, para. 42", label: "The famine of 1792 in the northern districts of Madras" }, "The sentence continues “Madras Government for the support of the famine-stricken”; the OCR reads “Madias”.");
x("ix_1792", "fs_igi", "igi3", "Relief works were first opened in Madras in 1792.", { page: "484", label: IGI });

// Orissa 1866
x("ix_orissa_isolated", "fs_igi", "igi3", "distress was greatest in Orissa, which was at that time practically isolated from the rest of India.", { page: "486", label: IGI });
x("ix_orissa_late", "fs_igi", "igi3", "The position was not grasped till the end of May, and then the monsoon had set in.", { page: "486", label: IGI });
x("ix_orissa_rice", "fs_igi", "igi3", "At great cost some 10.000 tons of rice were imported, but this did not reach the people till September.", { page: "486", label: IGI });
x("ix_orissa_million", "fs_igi", "igi3", "It was estimated that at least a million people, or one-third of the population, died in Orissa alone.", { page: "486", label: IGI });
x("ix_orissa_stirred", "fs_igi", "igi3", "The mortality in Orissa in 1866 deeply stirred the public", { page: "485", label: IGI });
x("fx_orissa_million", "fs_fc1880", "fc1880", "population, or nearly a million persons, had died.", { section: "Part I, para. 51", label: "Famine of 1866–67, Orissa" }, "The sentence begins “it was estimated that about a third of the …”; a marginal heading interrupts it in the OCR.");
x("fx_orissa_may", "fs_fc1880", "fc1880", "It was only in May 1866 that it was discovered that the markets were so empty that the jail prisoners and the Government establishments could not be supplied.", { section: "Part I, para. 51", label: "Famine of 1866–67, Orissa" });
x("ix_orissa_conscience", "fs_igi", "igi3", "effectually called attention to the responsibilities of Government in times of famine. This was the beginning of a more humane policy", { page: "485", label: IGI });
x("ix_santals", "fs_igi", "igi3", "In the Orissa famine, for instance, the Santals starved in large numbers, because it was not known that they were peculiar in refusing to touch food cooked by Brahmans; and a new caste, the Chattar-khai or ‘kitchen-eaters,’ dates from that famine.", { page: "483", label: `${IGI}, footnote` }, "The OCR reads “famine*”.");
x("ix_refuse", "fs_igi", "igi3", "Thousands would die sooner than resort to relief camps or touch food which they thought was unclean, either in itself or by reason of the agency employed in its preparation.", { page: "479", label: IGI });

// 1876–78
x("ix_1876_area", "fs_igi", "igi3", "The total area affected was 257,000 square miles, with a population of 58,500,000.", { page: "488", label: IGI });
x("ix_1876_deaths", "fs_igi", "igi3", "The excess mortality in this famine is said to have been 5,250,000 in British territory alone.", { page: "489", label: IGI });
x("fx_mysore", "fs_fc1880", "fc1880", "But it will be some time before the province recovers its losses, which have been estimated at about a million of lives, a quarter of a million of cattle", { section: "Part I, para. 63", label: "Famine of 1876–78, Mysore" });
x("fx_madras", "fs_fc1880", "fc1880", "The abnormal mortality of the two famine years has been estimated at two millions", { section: "Part I, para. 64", label: "Famine of 1876–78, Madras" }, "The OCR reads “famhie”.");
x("wx_1876_estimates", "fs_wp1876", "wp1876", "The excess mortality in the famine has been estimated in the range of 5.6 million - 9.6 million human deaths, and a careful recent demographic estimate yielded 8.2 million deaths.", { section: "Lead" });
x("gx_temple_wage", "fs_digby", "digby", "It was pointed out that the usual daily wages in the agricultural districts was two measures, or about five lbs. of grain. Sir Richard Temple's proposal was one lb. of grain plus half an anna", { volume: "1", page: "85", label: "Madras, January–March 1877" });
x("gx_condemned", "fs_digby", "digby", "This ration was universally condemned, and loud protests were made against such an experiment being made on a million human lives. One objector said, ' It would be better to shoot down the poor wretches at once than to prolong their misery in the way proposed.'", { volume: "1", page: "85", label: "Madras, January–March 1877" });
x("ix_temple_wage", "fs_igi", "igi3", "1 lb. of grain plus 1 anna for a man, with small reductions for a woman or child.", { page: "489", label: `${IGI}, footnote on the “Temple wage”` });
x("wx_temple", "fs_wp1876", "wp1876", "In January 1877, Temple reduced the wage for a day's hard work in the relief camps in Madras and Bombay", { section: "Relief" });
x("wx_lytton_export", "fs_wp1876", "wp1876", "The regular export of grain by the colonial government continued; during the famine, the viceroy, Lord Lytton, oversaw the export to England of a record 6.4 million hundredweight (320,000 tons) of wheat, which made the region more vulnerable.", { section: "Preceding events" });
x("ux_export", "fs_dutt_victorian", "duttVictorian", "In 1876-77, when India was on the brink of one of the severest famines of the century, she exported a larger quantity of food grains, as will appear from the foregoing table, than she had ever done in any preceding year.", { page: "349", label: "Book II, ch. “Trade and manufacture”" });
x("ux_export_why", "fs_dutt_victorian", "duttVictorian", "It thus happens that, even on the eve of great famines, the export of food goes on as briskly as ever, because the grain has to be sold to meet a rigid Land Revenue demand.", { page: "349" });
x("ix_1877_policy", "fs_igi", "igi3", "But it is essential that in pursuing this end your officers should sedulously guard against the danger of inducing the population to rely upon Government aid rather than upon their own industry and thrift.", { page: "478", label: `${IGI}: the Secretary of State's declaration of 1877` });
x("gx_kalastri", "fs_digby", "digby", "A number were grubbing in the dust for grains of corn, or nibbling young mangoes not larger than nutmegs, or eating tamarinds and other unwholesome things they had picked up.", { volume: "1", page: "99", label: KALASTRI });
x("gx_corpses", "fs_digby", "digby", "We went on and came to another chuttrum where there were two dead bodies lying, one of a man and one of a child. Both were wasted to the bone, and the child's feet were swollen with dropsy.", { volume: "1", page: "99", label: KALASTRI });
x("gx_bullocks", "fs_digby", "digby", "Two bullocks were sold two months ago to the Waddars who were employed on the tank work for 15 rs. From this amount the food supplies have been obtained up to date.", { volume: "1", page: "441", label: `${HAY}: “No. 6”` });
x("gx_tamarind", "fs_digby", "digby", "he and his wife subsisted entirely on a quarter or half a seer of fried and boiled tamarind seeds.", { volume: "1", page: "441", label: `${HAY}: “No. 7”, a village labourer` });
x("gx_sheep", "fs_digby", "digby", "He borrowed 50 rs. from his relative", { volume: "1", page: "441", label: `${HAY}: “No. 10”` });
x("gx_roots", "fs_digby", "digby", "the women and children turned out en masse calling for food, and there were not wanting signs to show that many of them were really suffering from hunger. Roots and leaves of different shrubs, among others the tangadi shrub, are commonly used as food", { volume: "1", page: "410", label: "The deputy commissioner of Tumkur, Mysore, August 1877, quoted by Digby" });
x("gx_bamboo", "fs_digby", "digby", "The seed of the bamboo, called by the natives bidar akki (bamboo rice), when procurable, is collected by the poorer classes and used as a substitute for rice or ragi.", { volume: "1", page: "440", label: "Mr. Stokes (1838), quoted in a Mysore report, quoted by Digby" });
x("wx_1876_emigration", "fs_wp1876", "wp1876", "After the famine, a large number of agricultural labourers and handloom weavers in South India emigrated to British tropical colonies to work as indentured labourers in plantations.", { section: "Aftermath" });
x("wx_1876_songs", "fs_wp1876", "wp1876", "The famine lives on in the Tamil and other literary traditions. A large number of Kummi folk songs describing this famine have been documented.", { section: "Aftermath" });
x("wx_1876_congress", "fs_wp1876", "wp1876", "Less than a decade later, they would found the Indian National Congress and, in turn, influence a generation of Indian nationalists.", { section: "Aftermath" });

// The Famine Commission and the codes
x("fx_paramount", "fs_fc1880", "fc1880", "It accordingly becomes a paramount duty of the State to give all practicable assistance to the people in time of famine", { section: "Part I, para. 105", label: "Obligation of the State" });
x("fx_code", "fs_fc1880", "fc1880", "which the Local Governments will carry out, subject only to financial control on the part of the Government of India.", { section: "Part I, para. 112", label: "The main principles of famine relief: a famine code" });
x("ix_code", "fs_igi", "igi3", "These recommendations were embodied in a Provisional Famine Code.", { page: "490", label: IGI });
x("ix_famine_wage", "fs_igi", "igi3", "the lowest amount sufficient to maintain health under given circumstances. While the duty of Government is to save life, it is not bound to maintain the labouring population at its normal level of comfort.", { page: "490", label: `${IGI}: the Government of India's circular of 1883` });
x("ix_achievement", "fs_igi", "igi3", "It may fairly be said that, in spite of inevitable defects, a modern Indian famine campaign is one of the most remarkable achievements in history of scientific administration.", { page: "479", label: IGI });
x("ix_kitchens", "fs_igi", "igi3", "Children are protected from the rapacity of their parents by being fed in kitchens, a precaution proved by sad experience to be necessary", { page: "483", label: IGI });
x("cx_small_famines", "fs_fic", "fic1945", "In the relatively small famines of the last 40 years, the relief procedure embodied in the Code has on the whole proved satisfactory. It has served to mitigate distress and prevent deaths from starvation.", { page: "97", label: "Part I, ch. X, “Looking back”, para. 64" });

// 1896–1900
x("ix_1896", "fs_igi", "igi3", "Altogether 307,000 square miles were affected, with a population of 69,500,000, and the numbers relieved exceeded 4,000,000 at the time of greatest distress.", { page: "490", label: IGI });
x("ix_1896_deaths", "fs_igi", "igi3", "The actual famine mortality in British Districts may be roughly estimated at about 750,000.", { page: "491", label: IGI });
x("ix_1900_relief", "fs_igi", "igi3", "At the end of July, 1900, no fewer than 6,500,000 persons were receiving daily relief.", { page: "492", label: IGI });
x("ix_1900_deaths", "fs_igi", "igi3", "The Famine Commission of 1901 thought that about one million deaths might be attributed to famine in British Districts, and that of this total at least one-fifth were caused by cholera.", { page: "492", label: IGI });
x("ix_cattle", "fs_igi", "igi3", "Cattle died in millions, and the Government helped agriculturists by very large remissions of revenue and by loans which have since been mostly written off.", { page: "492", label: IGI });
x("cz_curzon_relief", "fs_curzon", "curzon", "we are now engaged in relieving, in one form or another, nearly 5,000,000 persons: more than the entire population of many not inconsiderable States.", { page: "375", label: "Budget speech, 28 March 1900" });
x("ox_gujarat", "fs_fc1901", "fc1901", "In their efforts to save their cattle the Gujarat agriculturists expended all their savings, themselves enduring great privations; they sold their jewels and even the doors and rafters of their houses we were told, in order to purchase fodder. Their efforts failed,, their cattle died, and with their cattle all their accumulated wealth disappeared, so that Gujarat became a stricken field.", { section: "Part III, para. 205", label: "Cattle and fodder" });
x("ox_inevitable", "fs_fc1901", "fc1901", "But making all allowances, it is not possible to dissociate the mortality from the famine or to regard it as inevitable.", { section: "Part III, para. 195", label: "Mortality in Gujarat" });
x("ox_nearer", "fs_fc1901", "fc1901", "We have no doubt that the mortality in the period up to May would have been less had more works been opened near the people’s homes in the Kaira and the Panch", { section: "Part III, para. 195", label: "Mortality in Gujarat" }, "The Kaira and Panch Mahals districts.");
x("nx_devala", "fs_nash", "nash", "out of 4000 people on the works 3000 had fled to the jungle.", { page: "58", label: "Ch. VI, “Cholera in Khandesh”: Devala camp, near Taloda" });
x("nx_terror", "fs_nash", "nash", "They are unused to regular work and routine, and the notion of going to a famine camp, especially if the camp be off their beat, is a terror to them.", { page: "55", label: "Ch. VI: the hill Bhils" });
x("nx_children", "fs_nash", "nash", "that little children should moan themselves to their last sleep, as I have seen them do, curled up on the earth alone, except for the company of a group of men and women collapsed with cholera, with no one by even to wipe the flies from their mouths", { page: "61", label: "Ch. VI, Talwada camp, April 1900" });
x("nx_mathan", "fs_nash", "nash", "Mathan, a man of thirty, owned five bullocks last year. Three died from want of water, one was killed by the Bhils, and one was left.", { page: "62", label: "Ch. VII, “Some village budgets”: Nagbode, near Nandurbar" });
x("nx_mortgaged", "fs_nash", "nash", "The land is mortgaged, and he is living now as a labourer. With no water and no bullocks, he can do nothing on his own land.", { page: "62", label: "Ch. VII" });
x("nx_revenue", "fs_nash", "nash", "He has been called upon to pay his revenue this year, but has not done so.", { page: "63", label: "Ch. VII" });
x("nx_pots", "fs_nash", "nash", "They have no grain at home, and some of the cooking-pots have been sold.", { page: "64", label: "Ch. VII" });
x("nx_circular", "fs_nash", "nash", "if lands are forfeited for non-payment of Government dues, they will not be restored back ; but they will pass with right of possession to persons who make the highest bids at the auction sales", { page: "67", label: "Ch. VII, footnote: circular of the collector of Broach, 14 April 1900, as proclaimed by a native revenue official" });

// The argument
x("ux_letters", "fs_dutt_letters", "duttLetters", "And it is significant that the provinces which have suffered most severely from", { page: "xi", label: "Preface" }, "The sentence continues overleaf: “famines within the last twenty-five years, i.e., in 1877, 1897 and 1900, …”.");
x("ux_letters_high", "fs_dutt_letters", "duttLetters", "are the provinces where the demand payable by cultivators is fixed by the Government, and the land revenue is unduly high.", { page: "xii", label: "Preface" });
x("px_digby_million", "fs_digby_prosperous", "digbyProsperous", "In the last twenty-five years of the past century more than one million of people died from famine and its effects on an average every year in a British-ruled country", { page: "134", label: "Ch. IV, “Famines: their present frequency and the cause of that frequency”" });
x("px_digby_drain", "fs_digby_prosperous", "digbyProsperous", "the wealth drained from India without a direct equivalent, and brought to England, has had not a little to do with the famine conditions on the one hand and with the marvellous prosperity on the other.", { page: "134", label: "Ch. IV" });
x("cz_critics", "fs_curzon", "curzon", "the critics of British rule in India are very fond of this argument, that the real causes of recurring famine are not the failure of rain, the exhaustion of the soil, or the loss of crops, but the pressure of land taxation and the drain upon the resources of the people.", { page: "376", label: "Budget speech, 28 March 1900" });
x("cz_impossible", "fs_curzon", "curzon", "how impossible it would be for any Government to anticipate the consequences of a visitation of nature on so gigantic and ruinous a scale.", { page: "377", label: "Budget speech, 28 March 1900" });
x("ix_peace", "fs_igi", "igi3", "Peace has multiplied the people.", { page: "477", label: IGI });
x("ix_holdings", "fs_igi", "igi3", "Holdings already small are subdivided, or sublet at competition rents, while the supply of agricultural labour outruns the demand for it", { page: "477", label: IGI });
x("wx_davis", "fs_wpFamineIndia", "wpFamineIndia", "Mike Davis regards the famines of the 1870s and 1890s as 'Late Victorian Holocausts' in which the effects of widespread weather-induced crop failures were greatly aggravated by the negligent response of the British administration.", { section: "Scholarly opinions" });
x("wx_roy", "fs_wpFamineIndia", "wpFamineIndia", "Tirthankar Roy suggests that the famines were due to environmental factors and inherent in India's ecology.", { section: "Scholarly opinions" });
x("fx_disease", "fs_fc1880", "fc1880", "due mainly, not to direct starvation but to diseases obscurely connected with drought and famine", { section: "Part I, para. 55", label: "Famine of 1868–69, North-Western Provinces and Punjab" });
x("ix_pestilence", "fs_igi", "igi3", "Pestilence is the twin-sister of famine, for the abnormal conditions of drought have from the earliest times lent themselves to disease", { page: "494", label: IGI });

// Bengal 1943
x("bx43_one_section", "fs_fic", "fic1945", "Only one section of the community suffered from starvation— the poorer classes in the rural areas. Well-to-do people and industrial workers in Greater Calcutta and elsewhere did not go short of food in 1943.", { page: "2", label: "Part I, ch. I, “The famine”" });
x("bx43_sold", "fs_fic", "fic1945", "Village labourers and artisans, at a somewhat higher economic level, sold their domestic utensils, ornaments, parts of their dwellings such as doors, windows and corrugated iron sheets, trade implements, clothes and domestic animals if they had any", { page: "67", label: "Part I, ch. IX, para. 8" }, "The OCR reads “corrugated irou”.");
x("bx43_land", "fs_fic", "fic1945", "Faced with starvation, many sold their land and other possessions to obtain money to buy rice, but with continually rising prices the proceeds of the sale could ward off hunger for only a brief period.", { page: "67", label: "Part I, ch. IX, para. 8" });
x("bx43_train", "fs_fic", "fic1945", "Many travelled by train without tickets and stations on railway lines south of Calcutta were thronged by starving crowds waiting for transport.", { page: "68", label: "Part I, ch. IX, para. 11" });
x("bx43_bins", "fs_fic", "fic1945", "Destitutes in Calcutta begged for food and sought for scraps even in refuse bins. They flocked round military and hotel kitchens to get such food as they could.", { page: "71", label: "Part I, ch. IX, para. 21, “Relief in Calcutta”" });
x("bx43_corpses", "fs_fic", "fic1945", "and corpses became a familiar sight.", { page: "71", label: "Part I, ch. IX, para. 21" });
x("bx43_statesman", "fs_fic", "fic1945", "In publishing such photographs for the first time the “Statesman”, we consider, rendered a valuable public service.", { page: "71", label: "Part I, ch. IX, para. 21" }, "The OCR reads “we consider^ rendered”.");
x("bx43_fishermen", "fs_fic", "fic1945", "the fishermen who had been deprived of their boats suffered severely during the famine.", { page: "27", label: "Part I, ch. IV, the “denial” policy" });
x("bx43_propaganda", "fs_fic", "fic1945", "Up to June 1943 such a declaration would have been inconsistent with the existing propaganda policy", { page: "99", label: "Part I, ch. X, para. 67" });
x("bx43_not_declared", "fs_fic", "fic1945", "Famine was not declared.", { page: "104", label: "Part I, ch. XI, “General conclusions and observations”" });
x("bx43_erred", "fs_fic", "fic1945", "The Government of India erred in deciding to introduce", { page: "106", label: "Part I, ch. XI" }, "Free trade in grain in the Eastern Region in 1943.");
x("bx43_failing", "fs_fic", "fic1945", "By August 1943, it was clear that the Provincial Administration in Bengal was failing to control the famine.", { page: "106", label: "Part I, ch. XI" });
x("bx43_wavell", "fs_fic", "fic1945", "After his visit, the whole situation took an immediate turn for the better.", { page: "106", label: "Part I, ch. XI: Lord Wavell's visit, October 1943" });
x("bx43_profits", "fs_fic", "fic1945", "Enormous profits were made out of the calamity, and in the circumstances, profits for some meant death for others. A large part of the community lived in plenty while others starved, and there was much indifference in face of suffering.", { page: "107", label: "Part I, ch. XI, “The people and the famine”" });
x("bx43_million", "fs_fic", "fic1945", "A million and a half of the poor of Bengal fell victim to circumstances for which they themselves were not responsible. Society, together with its organs, failed to protect its weaker members. Indeed there was a moral and social breakdown, as well as an administrative breakdown.", { page: "107", label: "Part I, ch. XI" });
x("bx43_chatto", "fs_fic", "fic1945", "made an estimate of the total mortality in 1943 — 3.5 million deaths — which has received wide publicity.", { page: "108", label: "Part II, ch. I, “Mortality”, para. 3" }, "Professor K. P. Chattopadhyaya of Calcutta University. The OCR reads “3*5”.");
x("bx43_unsound", "fs_fic", "fic1945", "The method of investigation followed cannot be accepted as statistically sound", { page: "108", label: "Part II, ch. I, para. 3" });
x("bx43_under", "fs_fic", "fic1945", "it is nevertheless of the opinion that the official figures under-estimate the total", { page: "108", label: "Part II, ch. I, para. 4" });
x("wx43_consensus", "fs_wp1943", "wp1943", "According to Irish historian Cormac Ó Gráda \"the scholarly consensus is about 2.1 million\".", { section: "Famine, disease, and the death toll" });
x("wx43_disease", "fs_wp1943", "wp1943", "over half the famine-related deaths occurred in 1944 after the food security crisis had abated, as a result of disease.", { section: "Lead" });
x("wx43_denial", "fs_wp1943", "wp1943", "The second prong, a \"boat denial\" policy, was designed to deny Bengali transport to any invading Japanese army.", { section: "March 1942: Denial policies" });
x("wx43_sen", "fs_wp1943", "wp1943", "Academic consensus generally follows the FEE account, as formulated by Nobel Prize-winning economist Amartya Sen, in describing the Bengal famine of 1943 as an \"entitlements famine\".", { section: "Historiography" });
x("wx43_sen_causes", "fs_wp1943", "wp1943", "Sen noted that Bengal should have had enough resources to feed its population, but mass deaths occurred due to a combination of wartime inflation, speculative buying, and panic hoarding.", { section: "Historiography" });
x("wx43_sen_supply", "fs_wp1943", "wp1943", "According to Amartya Sen: \"The ... [rice paddy] supply for 1943 was only about 5% lower than the average of the preceding five years.", { section: "1942–1943: Shortfall and carryover" }, "Wikipedia quoting Sen, Poverty and Famines (1981).");
x("wx43_bowbrick", "fs_wp1943", "wp1943", "FAD-oriented scholars such as Peter Bowbrick hold that a sharp drop in the food supply was the pivotal determining factor.", { section: "Historiography" });
x("wx43_tauger", "fs_wp1943", "wp1943", "S.Y. Padmanabhan and later Mark Tauger, in particular, argue that the impact of brown-spot disease was vastly underestimated", { section: "Historiography" });
x("wx43_cabinet", "fs_wp1943", "wp1943", "for months these requests were either rejected or reduced to a fraction of the original amount by Churchill's War Cabinet.", { section: "1942–1944: Refusal of imports" });
x("wx43_shipping", "fs_wp1943", "wp1943", "In contrast, Mark Tauger strikes a more supportive stance: \"In the Indian Ocean alone from January 1942 to May 1943, the Axis powers sank 230 British and Allied merchant ships totalling 873,000 tons", { section: "1942–1944: Refusal of imports" });
x("wx43_stephens", "fs_wp1943", "wp1943", "A turning point in news coverage came on 22 August 1943, when the editor of The Statesman, Ian Stephens, solicited and published a series of graphic photos of the victims.", { section: "Media coverage and other depictions" });
x("wx43_press", "fs_wp1943", "wp1943", "also inspired Amartya Sen's influential contention that the presence of a free press prevents famines in democratic countries.", { section: "Media coverage and other depictions" });

// After 1947
x("wx_none", "fs_wpFamineIndia", "wpFamineIndia", "Later famine threats of 1984, 1988, and 1998 were successfully contained by the Indian government and there has been no major famine in India since 1943.", { section: "Republic of India" });
x("wx_threats", "fs_wpFamineIndia", "wpFamineIndia", "India faced a number of threats of severe famines in 1967, 1973, 1979, and 1987 in Bihar, Maharashtra, West Bengal, and Gujarat respectively. However, these did not materialize into famines due to government intervention.", { section: "Republic of India" });
x("wx_bihar", "fs_wpFamineIndia", "wpFamineIndia", "A drought occurred in the state of Bihar in December 1966 on a much smaller scale and in which \"Happily, aid was at hand and there were relatively fewer deaths\".", { section: "Republic of India" });
x("wx_code_bihar", "fs_wpFamineIndia", "wpFamineIndia", "The Indian Famine Code was used in India until more lessons were learned from the Bihar famine of 1966–1967. The Famine Code has been updated in independent India and it has been renamed \"Scarcity Manuals\".", { section: "Famine Codes" });
x("wx_sen_democracy", "fs_wpFamineIndia", "wpFamineIndia", "Sen attributes this trend of decline or disappearance of famines after independence to a democratic system of governance and a free press—not to increased food production.", { section: "Republic of India" });
x("wx_hunger", "fs_wpFamineIndia", "wpFamineIndia", "In 2016–18, 194 million of 810 million undernourished people globally lived in India, making the country a key focus for tackling hunger on a global scale.", { section: "Republic of India" });
x("wx_green", "fs_wpGreen", "wpGreen", "Under the premiership of Indira Gandhi, the Green Revolution within India commenced in 1968, leading to an increase in food grain production, especially in Punjab, Haryana, and Western Uttar Pradesh.", { section: "Lead" });
x("wx_green_droughts", "fs_wpGreen", "wpGreen", "In 1964–65 and 1965–66, India experienced two severe droughts which led to food shortages and famines among the country's growing population.", { section: "Rationale for the Green Revolution" });

// ---------------------------------------------------------------- claims

type Theme = "economy" | "society" | "governance" | "polity" | "sources" | "historiography" | "infrastructure" | "culture" | "technology" | "war" | "religion";
type Lens = "primary_source" | "colonial_orientalist" | "nationalist" | "mainstream_academic" | "popular" | "marxist" | "revisionist";
export interface ClaimSpec {
  ref: string;
  text: string;
  kind: "fact" | "interpretation" | "misconception" | "debate";
  assessment: "well_supported" | "supported" | "contested" | "weak" | "refuted";
  assessmentNote?: string;
  when?: Record<string, unknown>;
  themes?: Theme[];
  lenses?: Lens[];
  /** Entity refs (from ENTITIES, TERMS or EXISTING). */
  entities?: { ref: string; role?: "subject" | "place" | "participant" | "mention" }[];
  foundVia?: CaptureKey[];
  learning?: { prompt: string; answer: string };
}
export const CLAIMS: ClaimSpec[] = [];
const c = (spec: ClaimSpec) => CLAIMS.push(spec);

// Ordinary years
c({ ref: "c_monsoon", text: "In ordinary years the poor lived on the autumn harvest of millets and rice, sown when the south-west monsoon broke in June and dependent on its rain until it ended in early October.", kind: "fact", assessment: "supported", themes: ["economy", "society"], entities: [{ ref: "britishRaj", role: "mention" }], learning: { prompt: "Which harvest fed the poor in ordinary years, and what did it depend on?", answer: "The autumn harvest of millets and rice, which depended on the south-west monsoon, June to early October." } });
c({ ref: "c_labourers", text: "Millions of farm labourers owned no land and had only casual work, and small farmers had no capital and lived on local credit, so a failed harvest took away both their food and their earnings.", kind: "fact", assessment: "well_supported", themes: ["economy", "society"], entities: [{ ref: "britishRaj", role: "mention" }] });
c({ ref: "c_bengal_rice", text: "Bengal was a land of rice growers and rice eaters, where about half the rural families who lived by the land held less than two acres or none.", kind: "fact", assessment: "supported", when: { start: ce(1943) }, themes: ["economy", "society"], entities: [{ ref: "bengal1943", role: "mention" }] });
c({ ref: "c_mysore_diet", text: "In a Mysore village in March 1877, a farming family ate about three-quarters of a seer (1.5 lb) of grain a head a day in ordinary times, as ragi balls with horse-gram; in the famine this fell to half a seer, taken as thin gruel.", kind: "fact", assessment: "supported", assessmentNote: "From one village inquiry by a British commissioner, quoted by Digby; it shows one household's diet, not all of India's.", when: { start: ce(1877, 3) }, themes: ["society", "economy"], lenses: ["primary_source"], entities: [{ ref: "great1876", role: "mention" }], learning: { prompt: "What did a Mysore farming family eat in an ordinary year, by the 1877 village inquiry?", answer: "About three-quarters of a seer of grain a head a day, as ragi balls with horse-gram." } });
c({ ref: "c_bullocks", text: "Farming and water both depended on bullocks, which ploughed and drew water from the wells; in the drought of 1899–1900 they died of thirst and hunger, and in Gujarat perhaps nine in ten breeding cattle were expected to die.", kind: "fact", assessment: "supported", assessmentNote: "“Not more than 10 per cent” is an estimate Nash was given in Broach in 1900.", when: { start: ce(1899), end: ce(1900) }, themes: ["economy", "infrastructure"], lenses: ["primary_source"], entities: [{ ref: "f1899" }] });
c({ ref: "c_first_hit", text: "The Famine Commission of 1880 found that drought first stopped field work, throwing landless labourers and the smallest farmers out of a living, then ruined artisans and small traders, and at last left everyone less able to give to beggars and dependants.", kind: "fact", assessment: "supported", when: { start: ce(1880) }, themes: ["economy", "society"], lenses: ["primary_source"], entities: [{ ref: "britishRaj", role: "mention" }], learning: { prompt: "Who suffered first when the rains failed, by the Famine Commission of 1880?", answer: "Landless labourers and the smallest farmers, then artisans and small traders, then those who lived on charity." } });
c({ ref: "c_charity43", text: "In Bengal in 1943 village charity, usually given as rice, dried up as rice grew scarce and dear, so those who lived on it were the first to starve.", kind: "fact", assessment: "supported", when: { start: ce(1943) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "bengal1943" }] });
c({ ref: "c_storage", text: "By 1900 railways could bring grain to any famine district, turning famines into famines of money rather than of food; critics said they had also spread high prices and ended the old habit of storing grain against bad years.", kind: "interpretation", assessment: "supported", assessmentNote: "The official view in the Imperial Gazetteer (1907), which reports the criticism and answers it.", when: { start: ce(1907) }, themes: ["infrastructure", "economy"], lenses: ["colonial_orientalist"], entities: [{ ref: "britishRaj", role: "mention" }] });

// Bengal 1769–70
c({ ref: "c1770_cause", text: "The Bengal famine followed the failure of the December rice harvest of 1769, after a partly failed crop the year before; good rains came in 1770, but too late for those already starving.", kind: "fact", assessment: "supported", when: { start: ce(1769), end: ce(1770) }, themes: ["economy"], entities: [{ ref: "f1770" }], foundVia: ["wp1770"] });
c({ ref: "c1770_coping", text: "Through the summer of 1770 Bengal's peasants sold their cattle and ploughs, ate their seed grain, sold their sons and daughters until no one would buy children, and ate leaves and grass; in June an official reported that the living were eating the dead.", kind: "fact", assessment: "supported", assessmentNote: "Hunter's summary (1868) of petitions and letters in the Company's records; the report of the living eating the dead is the Resident's, in June 1770.", when: { start: ce(1770) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "f1770" }, { ref: "hunter", role: "mention" }, { ref: "t_famine_foods", role: "mention" }], learning: { prompt: "What did Bengal's peasants do to survive in 1770, by the Company's records?", answer: "Sold cattle, ploughs and children, ate their seed grain, leaves and grass." } });
c({ ref: "c1770_toll", text: "The Company's officials reckoned that a third of Bengal's people died in 1770; Hunter (1868) put the dead at about ten million, a figure later writers have called too high.", kind: "fact", assessment: "supported", assessmentNote: "A contemporary official reckoning and a Victorian estimate, not a count: there was no census. The Imperial Gazetteer (1907) says the estimate has been disputed as excessive.", when: { start: ce(1770) }, themes: ["society", "historiography"], entities: [{ ref: "f1770" }, { ref: "hastings", role: "mention" }, { ref: "hunter", role: "mention" }], foundVia: ["wp1770"], learning: { prompt: "What share of Bengal's people did the Company's officials reckon had died in 1770?", answer: "A third; Hunter put it at about ten million, which later writers think too high." } });
c({ ref: "c1770_revenue", text: "The Company kept collecting the land revenue through the famine: its Council wrote in 1772 that despite the loss of a third of the people, the revenue had not fallen, because it had been “violently kept up”.", kind: "fact", assessment: "supported", when: { start: ce(1772, 11, 3) }, themes: ["governance", "economy"], lenses: ["primary_source"], entities: [{ ref: "f1770" }, { ref: "hastings" }, { ref: "t_land_revenue", role: "mention" }], learning: { prompt: "What happened to the Company's land revenue in Bengal during and after the famine of 1770?", answer: "It did not fall: the Council wrote in 1772 that it had been “violently kept up”." } });
c({ ref: "c1770_relief", text: "Relief in 1770 was small: districts where twenty thousand were dying a month got 150 rupees, less than five per cent of the land tax was remitted, and the Council added ten per cent to it for the next year.", kind: "fact", assessment: "supported", assessmentNote: "Hunter's reading of the Company's accounts, which he calls very confused.", when: { start: ce(1770) }, themes: ["governance"], lenses: ["colonial_orientalist"], entities: [{ ref: "f1770" }, { ref: "hunter", role: "mention" }] });
c({ ref: "c1770_warehouse", text: "Writing a century later, the British official W. W. Hunter said that before 1772 the British public saw Bengal as a vast warehouse for profitable trade, and that the question of who was responsible for the dead would hardly have occurred to them.", kind: "interpretation", assessment: "supported", when: { start: ce(1868) }, themes: ["historiography", "governance"], lenses: ["colonial_orientalist"], entities: [{ ref: "hunter" }, { ref: "f1770", role: "mention" }] });
c({ ref: "c1770_after", text: "Twenty years on, Bengal was still half-peopled, with a third of its land lying waste, in the view of John Shore, who had seen the famine as a young Company officer.", kind: "fact", assessment: "supported", assessmentNote: "Shore's view in 1789, reported by Hunter.", when: { start: ce(1789) }, themes: ["economy", "society"], entities: [{ ref: "f1770" }] });

// 1783–1792
c({ ref: "c_chalisa", text: "The Chalisa famine of 1783–84 struck north India, from Delhi and the Doab to the Punjab and Rajputana, then ruled by Indian rulers rather than the Company.", kind: "fact", assessment: "supported", when: { start: ce(1783), end: ce(1784) }, themes: ["polity", "economy"], entities: [{ ref: "chalisa" }], foundVia: ["wpChalisa"] });
c({ ref: "c_chalisa_toll", text: "One modern estimate is that up to 11 million people may have died in the famines of 1782–84 in south and north India together.", kind: "fact", assessment: "contested", assessmentNote: "A single estimate, reported by Wikipedia; there are no records from which to count.", when: { start: ce(1782), end: ce(1784) }, themes: ["society"], entities: [{ ref: "chalisa" }], foundVia: ["wpChalisa"] });
c({ ref: "c_doji", text: "In the Doji bara or “skull famine” of 1791–92 people in Dharwar lived on leaves and berries, women and children were sold, and the unburied dead gave the famine its name.", kind: "fact", assessment: "supported", assessmentNote: "From the Dharwar gazetteer (1884), written from local memory and records nearly a century later.", when: { start: ce(1791), end: ce(1792) }, themes: ["society"], entities: [{ ref: "doji" }, { ref: "t_famine_foods", role: "mention" }], foundVia: ["wpDoji"], learning: { prompt: "Why was the famine of 1791–92 in the Deccan called the “skull famine”?", answer: "For its unburied dead; people lived on leaves and berries, and women and children were sold." } });
c({ ref: "c_doji_rulers", text: "In Dharwar in 1791–92 the rich were said to have relieved the distressed, while the Peshwa's government did little beyond seizing grain at Hubli.", kind: "fact", assessment: "supported", when: { start: ce(1791), end: ce(1792) }, themes: ["governance"], entities: [{ ref: "doji" }, { ref: "maratha", role: "mention" }] });
c({ ref: "c_madras1792", text: "In 1792 the Madras government opened relief works for the famine-stricken, the first time this was done.", kind: "fact", assessment: "well_supported", when: { start: ce(1792) }, themes: ["governance"], entities: [{ ref: "doji", role: "mention" }, { ref: "t_relief_works" }] });

// Orissa 1866
c({ ref: "c_orissa", text: "In 1866 Orissa, cut off from the rest of India, lost about a million people, a third of its population, to famine.", kind: "fact", assessment: "well_supported", assessmentNote: "The figure is the estimate of the time; the census of 1871–72 later found more people than had been thought to live there before the famine.", when: { start: ce(1866) }, themes: ["society"], entities: [{ ref: "orissa1866" }], learning: { prompt: "About how many people died in the Orissa famine of 1866?", answer: "About a million, a third of the population." } });
c({ ref: "c_orissa_late", text: "Officials in Orissa did not see the shortage until May 1866, when the markets were empty and the monsoon had made imports almost impossible; rice bought at great cost reached the people only in September.", kind: "fact", assessment: "well_supported", when: { start: ce(1866, 5), end: ce(1866, 9) }, themes: ["governance", "infrastructure"], entities: [{ ref: "orissa1866" }] });
c({ ref: "c_orissa_after", text: "The deaths in Orissa stirred public conscience in Britain, and the commission of inquiry under Sir George Campbell drew attention to the government's duty in famine.", kind: "fact", assessment: "supported", assessmentNote: "Cited through the Imperial Gazetteer; the commission's own report (1867) is not yet captured here.", when: { start: ce(1867) }, themes: ["governance", "historiography"], entities: [{ ref: "orissa1866" }] });
c({ ref: "c_caste_relief", text: "Caste and honour kept many from relief: in 1866 respectable families would not let their women take public charity and starved in silence, and Santals starved rather than eat food cooked by Brahmans; those who ate in the kitchens became a new caste, the “kitchen-eaters”.", kind: "fact", assessment: "supported", when: { start: ce(1866) }, themes: ["society", "religion"], entities: [{ ref: "orissa1866" }, { ref: "hunter", role: "mention" }] });
c({ ref: "c_refuse_camps", text: "Officials wrote that thousands would die rather than go to the relief camps or eat food they thought unclean, and in 1900 the hill Bhils of Khandesh were terrified of the camps.", kind: "fact", assessment: "supported", when: { start: ce(1900) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "f1899", role: "mention" }, { ref: "t_relief_works", role: "mention" }] });

// 1876–78
c({ ref: "c76_extent", text: "The famine of 1876–78 struck Madras, Bombay, Mysore and Hyderabad for two years, then spread north: 257,000 square miles with 58.5 million people.", kind: "fact", assessment: "supported", when: { start: ce(1876), end: ce(1878) }, themes: ["society"], entities: [{ ref: "great1876" }], foundVia: ["wp1876"] });
c({ ref: "c76_deaths", text: "The official reckoning of excess deaths in 1876–78 was about 5.25 million in British territory alone, with two million in Madras and about a million in Mysore; modern estimates run from 5.6 to 9.6 million.", kind: "fact", assessment: "supported", assessmentNote: "Excess deaths over normal years, estimated from imperfect registration; the modern range is from Wikipedia.", when: { start: ce(1876), end: ce(1878) }, themes: ["society"], entities: [{ ref: "great1876" }], foundVia: ["wp1876"], learning: { prompt: "How many excess deaths were officially reckoned in the famine of 1876–78 in British territory?", answer: "About 5.25 million; modern estimates run from 5.6 to 9.6 million." } });
c({ ref: "c76_temple", text: "In January 1877 Sir Richard Temple cut the relief wage to one pound of grain and a small coin a day for a man, when an ordinary farm wage was about five pounds of grain; this “Temple wage” was given up after a few months as too little to live on.", kind: "fact", assessment: "well_supported", assessmentNote: "Digby gives the coin as half an anna, the Imperial Gazetteer as one anna.", when: { start: ce(1877, 1), end: ce(1877, 5) }, themes: ["governance"], entities: [{ ref: "temple" }, { ref: "great1876", role: "mention" }, { ref: "t_relief_works", role: "mention" }], foundVia: ["wp1876"], learning: { prompt: "What was the “Temple wage” of 1877?", answer: "One pound of grain and a small coin a day for a man on relief works, against an ordinary wage of about five pounds of grain." } });
c({ ref: "c76_condemned", text: "Critics in 1877 condemned the Temple ration as an experiment on a million lives; one said it would be kinder to shoot the starving at once.", kind: "fact", assessment: "supported", when: { start: ce(1877) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "temple", role: "mention" }, { ref: "digby", role: "mention" }] });
c({ ref: "c76_policy", text: "In 1877 the Secretary of State told the Government of India that saving life came first, but that officers must not let people come to rely on government aid rather than their own industry and thrift.", kind: "fact", assessment: "supported", when: { start: ce(1877) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "great1876", role: "mention" }] });
c({ ref: "c76_exports", text: "Grain left India as the famine began: R. C. Dutt noted that in 1876–77 India exported more food grain than ever before, and under Lord Lytton a record 320,000 tons of wheat went to England.", kind: "fact", assessment: "supported", assessmentNote: "Dutt's figure is from the trade returns; the Lytton figure is from Wikipedia (after Mike Davis). Most of the export was from the north, while the famine was in the south.", when: { start: ce(1876), end: ce(1877) }, themes: ["economy", "governance"], lenses: ["nationalist"], entities: [{ ref: "lytton" }, { ref: "dutt", role: "mention" }, { ref: "great1876", role: "mention" }], foundVia: ["wp1876"] });
c({ ref: "c76_kalastri", text: "At Kalastri in March 1877 a newspaper correspondent found paupers waiting for the daily dole, people grubbing in the dust for grains of corn and eating unripe mangoes and tamarinds, and two wasted bodies, a man's and a child's, in the rest-house.", kind: "fact", assessment: "supported", assessmentNote: "An eyewitness report in the Friend of India, quoted by Digby, who checked such accounts with officials.", when: { start: ce(1877, 3, 16) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "great1876" }, { ref: "t_famine_foods", role: "mention" }] });
c({ ref: "c76_mysore_sales", text: "In a Mysore village in March 1877, families got through the famine by cutting their rations, selling bullocks, buffaloes and sheep, and borrowing from relatives; a labourer and his wife lived at times on nothing but fried and boiled tamarind seed.", kind: "fact", assessment: "supported", when: { start: ce(1877, 3) }, themes: ["society", "economy"], lenses: ["primary_source"], entities: [{ ref: "great1876" }, { ref: "t_famine_foods", role: "mention" }], learning: { prompt: "How did families in a Mysore village get through the famine of 1877?", answer: "By eating less, selling bullocks, buffaloes and sheep, borrowing, and eating tamarind seed." } });
c({ ref: "c76_roots", text: "In Mysore in 1877 people ate the roots and leaves of shrubs such as the tangadi, and bamboo seed when the bamboo flowered.", kind: "fact", assessment: "supported", when: { start: ce(1877) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "great1876" }, { ref: "t_famine_foods" }] });
c({ ref: "c76_after", text: "After the famine many labourers and weavers of south India left as indentured labourers for plantations in British colonies, and the famine lived on in Tamil folk songs (kummi).", kind: "fact", assessment: "supported", assessmentNote: "From Wikipedia, which cites the studies.", when: { start: ce(1878) }, themes: ["society", "culture"], entities: [{ ref: "great1876" }], foundVia: ["wp1876"] });
c({ ref: "c76_congress", text: "Officials unsettled by the response to the famine of 1876–78, among them William Wedderburn and A. O. Hume, helped found the Indian National Congress less than a decade later.", kind: "interpretation", assessment: "supported", when: { start: ce(1885) }, themes: ["polity", "historiography"], entities: [{ ref: "great1876", role: "mention" }], foundVia: ["wp1876"] });

// Codes
c({ ref: "c_fc_duty", text: "The Famine Commission of 1880 declared it a paramount duty of the state to give all practicable help to the people in famine, and asked for a famine code in every province; a Provisional Famine Code followed.", kind: "fact", assessment: "well_supported", when: { start: ce(1880) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "t_famine_code" }, { ref: "britishRaj", role: "mention" }], learning: { prompt: "What did the Famine Commission of 1880 call the state's duty in famine?", answer: "A paramount duty to give all practicable help; it asked for a famine code in every province." } });
c({ ref: "c_fc_wage", text: "From 1883 the famine wage was set as the lowest amount enough to keep a worker healthy: the government held that its duty was to save life, not to keep labourers at their usual comfort.", kind: "fact", assessment: "supported", when: { start: ce(1883) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "t_famine_code" }, { ref: "t_relief_works", role: "mention" }] });
c({ ref: "c_fc_achievement", text: "The official Imperial Gazetteer (1907) called the modern Indian famine campaign one of the most remarkable achievements of scientific administration in history.", kind: "interpretation", assessment: "supported", assessmentNote: "The official view, published under the Secretary of State's authority.", when: { start: ce(1907) }, themes: ["governance", "historiography"], lenses: ["colonial_orientalist"], entities: [{ ref: "britishRaj", role: "mention" }] });
c({ ref: "c_kitchens", text: "By 1907 relief fed children in kitchens rather than through their parents, a precaution which, officials wrote, sad experience had shown to be necessary.", kind: "fact", assessment: "supported", when: { start: ce(1907) }, themes: ["society", "governance"], entities: [{ ref: "t_gratuitous", role: "mention" }] });
c({ ref: "c_small_famines", text: "The Famine Inquiry Commission of 1945 judged that in the smaller famines of 1905–1943 the codes had on the whole worked, preventing deaths from starvation.", kind: "fact", assessment: "supported", when: { start: ce(1945) }, themes: ["governance"], entities: [{ ref: "t_famine_code" }] });

// 1896–1900
c({ ref: "c96", text: "In 1896–97 famine covered 307,000 square miles with 69.5 million people; more than four million were on relief at the worst, and famine deaths in British districts were roughly estimated at 750,000.", kind: "fact", assessment: "supported", when: { start: ce(1896), end: ce(1897) }, themes: ["society", "governance"], entities: [{ ref: "f1896" }] });
c({ ref: "c99_relief", text: "After the monsoon of 1899 failed, relief reached a scale never seen before: nearly five million people in March 1900, as Lord Curzon told his council, and 6.5 million at the end of July.", kind: "fact", assessment: "well_supported", when: { start: ce(1900, 3), end: ce(1900, 7) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "f1899" }, { ref: "curzon", role: "mention" }] });
c({ ref: "c99_deaths", text: "The Famine Commission of 1901 thought about a million deaths in British districts were due to the famine of 1899–1900, at least a fifth of them from cholera.", kind: "fact", assessment: "supported", assessmentNote: "British districts only; deaths in the princely states, where many died, are not in this figure.", when: { start: ce(1899), end: ce(1900) }, themes: ["society"], entities: [{ ref: "f1899" }], learning: { prompt: "How many deaths did the Famine Commission of 1901 put down to the famine of 1899–1900 in British districts, and what killed many of them?", answer: "About a million; at least a fifth died of cholera." } });
c({ ref: "c99_cholera", text: "Cholera swept the crowded relief camps in 1900: at Devala in Khandesh, after forty deaths, 3,000 of the 4,000 workers fled to the jungle, carrying the disease with them.", kind: "fact", assessment: "supported", assessmentNote: "Nash's report from the famine medical officer, April 1900.", when: { start: ce(1900, 4) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "f1899" }] });
c({ ref: "c99_cattle", text: "In 1899–1900 cattle died in millions; in Gujarat farmers spent their savings and sold their jewels and even the doors and rafters of their houses to buy fodder, and lost their herds and their wealth with them.", kind: "fact", assessment: "well_supported", when: { start: ce(1899), end: ce(1900) }, themes: ["economy", "society"], lenses: ["primary_source"], entities: [{ ref: "f1899" }], learning: { prompt: "What did Gujarat's farmers sell in 1899–1900 to try to save their cattle?", answer: "Their jewels and even the doors and rafters of their houses, to buy fodder." } });
c({ ref: "c99_village", text: "At Nagbode in Khandesh in April 1900 Nash met farmers who had lost their crops and most of their bullocks, whose land was mortgaged, who were working as labourers and selling their cooking pots, and who had been told to pay their land revenue.", kind: "fact", assessment: "supported", when: { start: ce(1900, 4) }, themes: ["society", "economy"], lenses: ["primary_source"], entities: [{ ref: "f1899" }, { ref: "t_land_revenue", role: "mention" }] });
c({ ref: "c99_revenue", text: "Revenue was still demanded in some famine districts in 1900: a Broach circular warned that land forfeited for unpaid revenue would be auctioned and never restored, though the government also remitted revenue on a very large scale.", kind: "fact", assessment: "supported", assessmentNote: "Both are true of the same famine: collection where officials thought people could pay, remission elsewhere.", when: { start: ce(1900, 4) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "f1899" }, { ref: "t_land_revenue" }] });
c({ ref: "c99_avoidable", text: "The Famine Commission of 1901 judged that many deaths in Gujarat were not inevitable: more works near people's homes and readier relief in the villages would have saved lives.", kind: "interpretation", assessment: "supported", when: { start: ce(1901) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "f1899" }] });

// The argument
c({ ref: "c_dutt_land", text: "R. C. Dutt argued in 1900 that the provinces hit hardest by famine in 1877, 1897 and 1900 were those where the government fixed the land revenue directly and set it too high, leaving cultivators unable to save for bad years.", kind: "interpretation", assessment: "contested", assessmentNote: "Dutt's argument as a critic and former official; Curzon's government replied that revenue was moderate and that drought alone explained the losses.", when: { start: ce(1900) }, themes: ["economy", "governance", "historiography"], lenses: ["nationalist"], entities: [{ ref: "dutt" }, { ref: "curzon", role: "mention" }, { ref: "t_land_revenue", role: "mention" }] });
c({ ref: "c_dutt_export", text: "Dutt also argued that grain was exported even on the eve of great famines because cultivators had to sell it to meet a rigid land revenue demand.", kind: "interpretation", assessment: "contested", when: { start: ce(1904) }, themes: ["economy"], lenses: ["nationalist"], entities: [{ ref: "dutt" }, { ref: "t_land_revenue", role: "mention" }] });
c({ ref: "c_digby_count", text: "William Digby (1901) reckoned that in the last quarter of the nineteenth century more than a million people a year died of famine and its effects, and blamed the drain of wealth from India to England.", kind: "interpretation", assessment: "contested", assessmentNote: "Digby's totals add official returns to unofficial estimates (the Lancet's, the Friend of India's), and were made to argue a case.", when: { start: ce(1901) }, themes: ["historiography", "economy"], lenses: ["nationalist"], entities: [{ ref: "digby" }, { ref: "drain", role: "mention" }] });
c({ ref: "c_curzon", text: "Lord Curzon answered in March 1900 that critics blamed land taxation and the drain, but that the crops lost in such a drought were beyond what any government could have foreseen or any revenue reform offset.", kind: "interpretation", assessment: "contested", when: { start: ce(1900, 3, 28) }, themes: ["governance", "historiography"], lenses: ["primary_source", "colonial_orientalist"], entities: [{ ref: "curzon" }] });
c({ ref: "c_igi_population", text: "The Imperial Gazetteer (1907) saw the root of the famine problem in peace and a growing population on ever smaller holdings, with more labourers than work.", kind: "interpretation", assessment: "contested", when: { start: ce(1907) }, themes: ["economy", "historiography"], lenses: ["colonial_orientalist"], entities: [{ ref: "britishRaj", role: "mention" }] });
c({ ref: "c_davis", text: "Mike Davis (2001) calls the famines of the 1870s and 1890s “Late Victorian Holocausts”, in which drought caused by El Niño was made far worse by the negligence of the British administration.", kind: "interpretation", assessment: "contested", when: { start: ce(2001) }, themes: ["historiography"], lenses: ["marxist"], entities: [{ ref: "great1876", role: "mention" }, { ref: "f1899", role: "mention" }], foundVia: ["wpFamineIndia"] });
c({ ref: "c_roy", text: "The economic historian Tirthankar Roy argues instead that the famines came mainly from environmental causes inherent in India's ecology.", kind: "interpretation", assessment: "contested", themes: ["historiography"], lenses: ["revisionist"], entities: [{ ref: "britishRaj", role: "mention" }], foundVia: ["wpFamineIndia"] });
c({ ref: "c_disease", text: "Most famine deaths came from disease rather than starvation itself: cholera in the hot weather, fever and malaria in the autumn, among people weakened by hunger.", kind: "fact", assessment: "well_supported", themes: ["society"], entities: [{ ref: "britishRaj", role: "mention" }], learning: { prompt: "What killed most people in the famines of British India?", answer: "Disease among the hungry: cholera, fever and malaria, more than starvation itself." } });

// Bengal 1943
c({ ref: "c43_who", text: "In 1943 the famine fell on the rural poor of Bengal; well-off people and the industrial workers of Calcutta did not go short of food.", kind: "fact", assessment: "supported", when: { start: ce(1943) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "bengal1943" }] });
c({ ref: "c43_sales", text: "In 1943 Bengal's labourers and artisans sold their pots, ornaments, doors, windows, roofing, tools and animals, and many small farmers sold their land to buy rice, which kept them only briefly as prices kept rising.", kind: "fact", assessment: "supported", when: { start: ce(1943) }, themes: ["society", "economy"], lenses: ["primary_source"], entities: [{ ref: "bengal1943" }], learning: { prompt: "What did Bengal's poor sell in 1943 to buy rice?", answer: "Pots, ornaments, doors and windows, tools, animals, and in many cases their land." } });
c({ ref: "c43_migration", text: "In 1943 starving people crowded the railway stations and rode trains without tickets to Calcutta, where destitutes begged and searched refuse bins for scraps and corpses became a familiar sight.", kind: "fact", assessment: "supported", when: { start: ce(1943, 7), end: ce(1943, 11) }, themes: ["society"], lenses: ["primary_source"], entities: [{ ref: "bengal1943" }] });
c({ ref: "c43_fishermen", text: "The “boat denial” policy of 1942, meant to keep boats from an invading Japanese army, left fishermen without their boats, and they suffered severely in the famine.", kind: "fact", assessment: "supported", when: { start: ce(1942), end: ce(1943) }, themes: ["war", "economy"], entities: [{ ref: "bengal1943" }] });
c({ ref: "c43_not_declared", text: "Famine was never declared in Bengal in 1943, so the famine code was not applied; until June a declaration would have contradicted the government's propaganda of “no shortage”.", kind: "fact", assessment: "supported", when: { start: ce(1943) }, themes: ["governance"], lenses: ["primary_source"], entities: [{ ref: "bengal1943" }, { ref: "t_famine_code", role: "mention" }], learning: { prompt: "Why was the famine code not applied in Bengal in 1943?", answer: "Famine was never declared: until June a declaration would have contradicted the propaganda of “no shortage”." } });
c({ ref: "c43_blame", text: "The Famine Inquiry Commission blamed the Government of Bengal for failing to control the famine and the Government of India for its grain-trade policy, and also blamed profiteering and indifference among the public: “profits for some meant death for others”.", kind: "interpretation", assessment: "supported", when: { start: ce(1945) }, themes: ["governance", "historiography"], lenses: ["primary_source"], entities: [{ ref: "bengal1943" }] });
c({ ref: "c43_wavell", text: "The turning point came after the new Viceroy, Lord Wavell, visited Bengal at the end of October 1943.", kind: "fact", assessment: "supported", when: { start: ce(1943, 10) }, themes: ["governance"], entities: [{ ref: "bengal1943" }] });
c({ ref: "c43_toll", text: "The Famine Inquiry Commission (1945) estimated that about 1.5 million people died in the Bengal famine; it rejected a survey's figure of 3.5 million as statistically unsound, while holding that the official returns undercounted.", kind: "fact", assessment: "supported", assessmentNote: "The Commission's own estimate; later scholars put the toll higher (see the next claim).", when: { start: ce(1943), end: ce(1944) }, themes: ["society", "historiography"], lenses: ["primary_source"], entities: [{ ref: "bengal1943" }], learning: { prompt: "How many deaths did the Famine Inquiry Commission of 1945 estimate for the Bengal famine?", answer: "About 1.5 million." } });
c({ ref: "c43_later", text: "Later scholars put the Bengal famine's toll higher than the Commission did; Cormac Ó Gráda gives the scholarly consensus as about 2.1 million deaths, more than half of them in 1944, from disease.", kind: "fact", assessment: "supported", assessmentNote: "Through Wikipedia (tertiary); the studies themselves are not quoted here.", when: { start: ce(1943), end: ce(1944) }, themes: ["society", "historiography"], lenses: ["mainstream_academic"], entities: [{ ref: "bengal1943" }], foundVia: ["wp1943"] });
c({ ref: "c43_sen", text: "Amartya Sen (1981) argued that Bengal's rice supply in 1943 was only about 5 per cent below the average of the five years before, and that people starved because war inflation and speculation put rice beyond their means: an “entitlements famine”.", kind: "interpretation", assessment: "contested", assessmentNote: "The most widely accepted reading; challenged on the size of the harvest shortfall.", when: { start: ce(1981) }, themes: ["economy", "historiography"], lenses: ["mainstream_academic"], entities: [{ ref: "sen" }, { ref: "bengal1943", role: "mention" }, { ref: "t_entitlement" }], foundVia: ["wp1943"], learning: { prompt: "What did Amartya Sen argue caused the Bengal famine of 1943?", answer: "Not mainly a fall in rice supply (about 5 per cent) but the poor losing the means to buy rice: an entitlements famine." } });
c({ ref: "c43_critics", text: "Critics of Sen, such as Peter Bowbrick and Mark Tauger, argue that the fall in food supply was larger and decisive, and that crop disease (brown spot) was badly underestimated.", kind: "interpretation", assessment: "contested", themes: ["economy", "historiography"], entities: [{ ref: "sen", role: "mention" }, { ref: "bengal1943", role: "mention" }], foundVia: ["wp1943"] });
c({ ref: "c43_cabinet", text: "For months Churchill's War Cabinet refused or cut requests to ship food to India; historians disagree whether this reflected a real wartime shortage of shipping or indifference to Indian lives.", kind: "debate", assessment: "contested", when: { start: ce(1943) }, themes: ["war", "governance", "historiography"], entities: [{ ref: "bengal1943" }], foundVia: ["wp1943"] });
c({ ref: "c43_statesman", text: "On 22 August 1943 The Statesman of Calcutta, under its editor Ian Stephens, published photographs of the famine's victims; the Famine Inquiry Commission said the paper had done a public service.", kind: "fact", assessment: "well_supported", when: { start: ce(1943, 8, 22) }, themes: ["society", "historiography"], entities: [{ ref: "bengal1943" }], foundVia: ["wp1943"] });

// After 1947
c({ ref: "c_after_none", text: "There has been no famine on the scale of 1943 in India since independence: threatened famines in Bihar (1967), Maharashtra (1973), West Bengal (1979) and Gujarat (1987) were contained by government relief.", kind: "fact", assessment: "supported", assessmentNote: "Through Wikipedia (tertiary). Hunger did not end (see below).", when: { start: ce(1947), end: ce(1998) }, themes: ["governance"], entities: [{ ref: "independentIndia" }], foundVia: ["wpFamineIndia"], learning: { prompt: "Has India had a famine on the scale of 1943 since independence?", answer: "No: the threatened famines of 1967, 1973, 1979 and 1987 were contained." } });
c({ ref: "c_after_bihar", text: "In the Bihar drought of 1966–67 relief reached the people and deaths were relatively few; India's famine codes were revised after it and renamed scarcity manuals.", kind: "fact", assessment: "supported", when: { start: ce(1966, 12), end: ce(1967) }, themes: ["governance"], entities: [{ ref: "independentIndia" }, { ref: "t_famine_code", role: "mention" }], foundVia: ["wpFamineIndia"] });
c({ ref: "c_after_green", text: "After two severe droughts in 1964–66, India adopted high-yielding wheat and rice with fertiliser: the Green Revolution, from about 1968, raised grain output, above all in Punjab, Haryana and western Uttar Pradesh.", kind: "fact", assessment: "supported", when: { start: ce(1966), end: ce(1978) }, themes: ["economy", "technology"], entities: [{ ref: "independentIndia" }], foundVia: ["wpGreen"] });
c({ ref: "c_after_sen", text: "Amartya Sen attributes the end of great famines in independent India to democracy and a free press rather than to more food; the Statesman's photographs of 1943 helped inspire the argument.", kind: "interpretation", assessment: "contested", themes: ["polity", "historiography"], lenses: ["mainstream_academic"], entities: [{ ref: "sen" }, { ref: "independentIndia", role: "mention" }], foundVia: ["wpFamineIndia"] });
c({ ref: "c_after_hunger", text: "The end of famine was not the end of hunger: in 2016–18 about 194 million undernourished people lived in India.", kind: "fact", assessment: "supported", when: { start: ce(2016), end: ce(2018) }, themes: ["society"], entities: [{ ref: "independentIndia" }], foundVia: ["wpFamineIndia"] });

// Often said
c({ ref: "m_starvation", text: "In the great famines most people died of hunger itself.", kind: "misconception", assessment: "weak", assessmentNote: "Hunger killed directly, but most deaths came from cholera, fever, malaria and other diseases among the weakened; the Commissions of 1880, 1901 and 1945 all say so.", themes: ["society"], lenses: ["popular"], entities: [{ ref: "britishRaj", role: "mention" }] });
c({ ref: "m_drought_only", text: "The famines of British India were caused simply by the failure of the rains.", kind: "misconception", assessment: "weak", assessmentNote: "Drought began most of them, but who starved depended on wages, prices, revenue, relief and, in 1943, war policy. How much weight to give each is debated.", themes: ["economy", "historiography"], lenses: ["popular"], entities: [{ ref: "britishRaj", role: "mention" }] });
c({ ref: "m_no_relief", text: "The British government did nothing to relieve famine in India.", kind: "misconception", assessment: "refuted", assessmentNote: "From 1880 it ran large relief systems under famine codes, feeding millions at a time; the charge the evidence supports is different: relief that was often late, too strict or too small, revenue collected in famine years, and in 1943 a famine not declared.", themes: ["governance"], lenses: ["popular"], entities: [{ ref: "t_famine_code", role: "mention" }] });

// ---------------------------------------------------------------- citations and relations

type Stance = "supports" | "contradicts" | "qualifies" | "mentions";
export const CITES: { claim: string; excerpt: string; stance: Stance; note?: string }[] = [];
const cite = (claim: string, excerpt: string, stance: Stance = "supports", note?: string) => CITES.push({ claim, excerpt, stance, ...(note ? { note } : {}) });

cite("c_monsoon", "bx_igi_monsoon");
cite("c_monsoon", "bx_igi_kharif");
cite("c_labourers", "bx_igi_labourers");
cite("c_labourers", "bx_igi_credit");
cite("c_labourers", "bx_fc_landless");
cite("c_bengal_rice", "bx_fic_rice");
cite("c_bengal_rice", "bx_fic_two_acres");
cite("c_mysore_diet", "bx_digby_ration");
cite("c_bullocks", "bx_nash_bullocks");
cite("c_bullocks", "bx_nash_tenpercent");
cite("c_bullocks", "nx_mathan");
cite("c_first_hit", "bx_fc_landless");
cite("c_first_hit", "bx_fc_charity");
cite("c_charity43", "bx_fic_charity");
cite("c_storage", "bx_igi_storage");
cite("c_storage", "bx_igi_money");

cite("c1770_cause", "hx_oneyear");
cite("c1770_cause", "wx_1770_causes", "qualifies", "Wikipedia adds the failure of 1768 and a smallpox epidemic.");
cite("c1770_coping", "hx_sold");
cite("c1770_toll", "hx_onethird");
cite("c1770_toll", "hx_hastings_loss");
cite("c1770_toll", "hx_tenmillion");
cite("c1770_toll", "fx_1770");
cite("c1770_toll", "ix_1770");
cite("c1770_toll", "ix_disputed", "qualifies");
cite("c1770_toll", "wx_1770_estimate", "qualifies");
cite("c1770_revenue", "hx_hastings_loss");
cite("c1770_revenue", "hx_hastings_violent");
cite("c1770_revenue", "wx_1770_taxes");
cite("c1770_revenue", "hx_remit", "supports", "Hunter: ten per cent added for 1770–71.");
cite("c1770_relief", "hx_allot");
cite("c1770_relief", "hx_remit");
cite("c1770_relief", "hx_tenpercent");
cite("c1770_warehouse", "hx_warehouse");
cite("c1770_after", "hx_waste");
cite("c1770_after", "hx_shore", "mentions", "Shore's own verses on the famine.");

cite("c_chalisa", "wx_chalisa");
cite("c_chalisa", "fx_1784", "supports", "The Famine Commission of 1880 on the famine of 1784 in Upper India.");
cite("c_chalisa_toll", "wx_chalisa_toll");
cite("c_doji", "dx_skull");
cite("c_doji", "wx_doji", "mentions", "The famine elsewhere, in the Madras Presidency.");
cite("c_doji_rulers", "dx_peshwa");
cite("c_madras1792", "ix_1792");
cite("c_madras1792", "fx_1792");

cite("c_orissa", "ix_orissa_isolated");
cite("c_orissa", "ix_orissa_million");
cite("c_orissa", "fx_orissa_million");
cite("c_orissa_late", "fx_orissa_may");
cite("c_orissa_late", "ix_orissa_late");
cite("c_orissa_late", "ix_orissa_rice");
cite("c_orissa_after", "ix_orissa_stirred");
cite("c_orissa_after", "ix_orissa_conscience");
cite("c_caste_relief", "hx_1866");
cite("c_caste_relief", "ix_santals");
cite("c_refuse_camps", "ix_refuse");
cite("c_refuse_camps", "nx_terror");

cite("c76_extent", "ix_1876_area");
cite("c76_deaths", "ix_1876_deaths");
cite("c76_deaths", "fx_madras");
cite("c76_deaths", "fx_mysore");
cite("c76_deaths", "wx_1876_estimates", "qualifies", "Modern estimates are higher.");
cite("c76_temple", "gx_temple_wage");
cite("c76_temple", "ix_temple_wage");
cite("c76_temple", "wx_temple");
cite("c76_condemned", "gx_condemned");
cite("c76_policy", "ix_1877_policy");
cite("c76_exports", "ux_export");
cite("c76_exports", "wx_lytton_export");
cite("c76_kalastri", "gx_kalastri");
cite("c76_kalastri", "gx_corpses");
cite("c76_mysore_sales", "bx_digby_ration");
cite("c76_mysore_sales", "gx_bullocks");
cite("c76_mysore_sales", "gx_sheep");
cite("c76_mysore_sales", "gx_tamarind");
cite("c76_roots", "gx_roots");
cite("c76_roots", "gx_bamboo");
cite("c76_after", "wx_1876_emigration");
cite("c76_after", "wx_1876_songs");
cite("c76_congress", "wx_1876_congress");

cite("c_fc_duty", "fx_paramount");
cite("c_fc_duty", "fx_code");
cite("c_fc_duty", "ix_code");
cite("c_fc_wage", "ix_famine_wage");
cite("c_fc_achievement", "ix_achievement");
cite("c_kitchens", "ix_kitchens");
cite("c_small_famines", "cx_small_famines");

cite("c96", "ix_1896");
cite("c96", "ix_1896_deaths");
cite("c99_relief", "cz_curzon_relief");
cite("c99_relief", "ix_1900_relief");
cite("c99_deaths", "ix_1900_deaths");
cite("c99_cholera", "nx_devala");
cite("c99_cholera", "nx_children", "mentions", "Nash at Talwada camp.");
cite("c99_cattle", "ox_gujarat");
cite("c99_cattle", "ix_cattle");
cite("c99_cattle", "nx_mathan");
cite("c99_village", "nx_mathan");
cite("c99_village", "nx_mortgaged");
cite("c99_village", "nx_revenue");
cite("c99_village", "nx_pots");
cite("c99_revenue", "nx_circular");
cite("c99_revenue", "ix_cattle", "qualifies", "Very large remissions of revenue in the same famine.");
cite("c99_avoidable", "ox_inevitable");
cite("c99_avoidable", "ox_nearer");

cite("c_dutt_land", "ux_letters");
cite("c_dutt_land", "ux_letters_high");
cite("c_dutt_export", "ux_export_why");
cite("c_digby_count", "px_digby_million");
cite("c_digby_count", "px_digby_drain");
cite("c_curzon", "cz_critics");
cite("c_curzon", "cz_impossible");
cite("c_igi_population", "ix_peace");
cite("c_igi_population", "ix_holdings");
cite("c_davis", "wx_davis");
cite("c_roy", "wx_roy");
cite("c_disease", "fx_disease");
cite("c_disease", "ix_pestilence");
cite("c_disease", "ix_1900_deaths");
cite("c_disease", "wx43_disease");

cite("c43_who", "bx43_one_section");
cite("c43_who", "bx_fic_charity");
cite("c43_sales", "bx43_sold");
cite("c43_sales", "bx43_land");
cite("c43_migration", "bx43_train");
cite("c43_migration", "bx43_bins");
cite("c43_migration", "bx43_corpses");
cite("c43_fishermen", "bx43_fishermen");
cite("c43_fishermen", "wx43_denial");
cite("c43_not_declared", "bx43_not_declared");
cite("c43_not_declared", "bx43_propaganda");
cite("c43_blame", "bx43_failing");
cite("c43_blame", "bx43_erred");
cite("c43_blame", "bx43_profits");
cite("c43_blame", "bx43_million", "supports", "“a moral and social breakdown, as well as an administrative breakdown”.");
cite("c43_wavell", "bx43_wavell");
cite("c43_toll", "bx43_million");
cite("c43_toll", "bx43_chatto");
cite("c43_toll", "bx43_unsound");
cite("c43_toll", "bx43_under");
cite("c43_later", "wx43_consensus");
cite("c43_later", "wx43_disease");
cite("c43_sen", "wx43_sen_supply");
cite("c43_sen", "wx43_sen");
cite("c43_sen", "wx43_sen_causes");
cite("c43_critics", "wx43_bowbrick");
cite("c43_critics", "wx43_tauger");
cite("c43_cabinet", "wx43_cabinet");
cite("c43_cabinet", "wx43_shipping", "qualifies", "Tauger on the shipping losses.");
cite("c43_statesman", "wx43_stephens");
cite("c43_statesman", "bx43_statesman");

cite("c_after_none", "wx_none");
cite("c_after_none", "wx_threats");
cite("c_after_bihar", "wx_bihar");
cite("c_after_bihar", "wx_code_bihar");
cite("c_after_green", "wx_green");
cite("c_after_green", "wx_green_droughts");
cite("c_after_sen", "wx_sen_democracy");
cite("c_after_sen", "wx43_press");
cite("c_after_hunger", "wx_hunger");

cite("m_starvation", "fx_disease", "contradicts");
cite("m_starvation", "ix_1900_deaths", "contradicts");
cite("m_starvation", "wx43_disease", "contradicts");
cite("m_drought_only", "hx_hastings_violent", "qualifies", "Revenue collected through the famine of 1770.");
cite("m_drought_only", "ox_inevitable", "contradicts");
cite("m_drought_only", "bx43_one_section", "qualifies", "In 1943 the well-off and Calcutta's workers ate; the rural poor starved.");
cite("m_no_relief", "fx_paramount", "contradicts");
cite("m_no_relief", "ix_1900_relief", "contradicts");
cite("m_no_relief", "hx_allot", "qualifies", "In 1770, relief was tiny.");

export const RELATIONS: { from: string; to: string; type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for"; note?: string }[] = [
  { from: "c_disease", to: "m_starvation", type: "corrects" },
  { from: "c99_deaths", to: "m_starvation", type: "corrects" },
  { from: "c1770_revenue", to: "m_drought_only", type: "qualifies" },
  { from: "c99_avoidable", to: "m_drought_only", type: "corrects" },
  { from: "c43_sen", to: "m_drought_only", type: "corrects" },
  { from: "c_fc_duty", to: "m_no_relief", type: "corrects" },
  { from: "c99_relief", to: "m_no_relief", type: "corrects" },
  { from: "c1770_relief", to: "m_no_relief", type: "qualifies", note: "In 1770 relief was very small." },
  { from: "c_curzon", to: "c_dutt_land", type: "contradicts" },
  { from: "c_igi_population", to: "c_digby_count", type: "contradicts" },
  { from: "c_roy", to: "c_davis", type: "contradicts" },
  { from: "c43_critics", to: "c43_sen", type: "contradicts" },
  { from: "c43_later", to: "c43_toll", type: "qualifies", note: "Later estimates are higher than the Commission's." },
  { from: "c76_temple", to: "c76_condemned", type: "context_for" },
  { from: "c76_policy", to: "c76_temple", type: "context_for" },
  { from: "c_orissa_after", to: "c_fc_duty", type: "context_for" },
  { from: "c76_deaths", to: "c_fc_duty", type: "context_for" },
  { from: "c99_revenue", to: "c_dutt_land", type: "supports" },
  { from: "c76_exports", to: "c_dutt_export", type: "supports" },
  { from: "c_small_famines", to: "c43_not_declared", type: "context_for" },
  { from: "c43_statesman", to: "c_after_sen", type: "context_for" },
];

// ---------------------------------------------------------------- source ops

export function sourceOps(s: Snaps, reuse: Record<string, string>): ChangeOpInput[] {
  const ia = (id: string) => ({ ia: id, url: `https://archive.org/details/${id}` });
  const wp = (ref: string, k: CaptureKey): ChangeOpInput => ({
    op: "create_source",
    ref,
    kind: "wiki_article",
    tier: "tertiary",
    csl: { type: "entry-encyclopedia", title: s[k].title, "container-title": "Wikipedia", issued: { "date-parts": [[2026]] }, ...(s[k].url ? { URL: s[k].url! } : {}) },
    identifiers: { ...(s[k].url ? { url: s[k].url! } : {}), wikipedia: { lang: "en", title: s[k].title, revisionId: s[k].revisionId! } },
    license: { status: "open", spdx: "CC-BY-SA-4.0" },
  });
  const all: ChangeOpInput[] = [
    {
      op: "create_source",
      ref: "fs_hunter",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Annals of Rural Bengal", volume: "1", author: [{ family: "Hunter", given: "W. W." }], issued: { "date-parts": [[1868]] }, publisher: "Smith, Elder and Co.", "publisher-place": "London" },
      identifiers: ia(CAPTURES.hunter.identifier),
      license: { status: "public_domain", note: "Published 1868; Hunter died 1900." },
      lenses: ["colonial_orientalist"],
      note: "A British official's history, written from the East India Company's own letters and consultations (India Office Records), which it quotes; Appendix A prints the Council's letter of 3 November 1772 (Warren Hastings). Hunter is critical of the Company's conduct in 1770 but writes as an admirer of later British rule.",
    },
    {
      op: "create_source",
      ref: "fs_digby",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Famine Campaign in Southern India (Madras and Bombay Presidencies and Province of Mysore), 1876–1878", volume: "1", author: [{ family: "Digby", given: "William" }], issued: { "date-parts": [[1878]] }, publisher: "Longmans, Green, and Co.", "publisher-place": "London" },
      identifiers: ia(CAPTURES.digby.identifier),
      license: { status: "public_domain", note: "Published 1878; Digby died 1904." },
      lenses: ["primary_source"],
      note: "By the honorary secretary of the Indian Famine Relief Fund, written during and just after the famine. Quotes official minutes, district reports, village inquiries and newspaper correspondents at length. Digby was a critic of the government's relief policy.",
    },
    {
      op: "create_source",
      ref: "fs_nash",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "The Great Famine and its Causes", author: [{ family: "Nash", given: "Vaughan" }], issued: { "date-parts": [[1900]] }, publisher: "Longmans, Green, and Co.", "publisher-place": "London" },
      identifiers: ia(CAPTURES.nash.identifier),
      license: { status: "public_domain", note: "Published 1900; Nash died 1932: public domain in the US (published before 1931) and in India (life + 60)." },
      lenses: ["primary_source"],
      note: "Letters to the Manchester Guardian from eleven weeks in the famine districts in 1900, with notes of conversations with villagers. Nash was a Liberal journalist critical of land revenue policy.",
    },
    {
      op: "create_source",
      ref: "fs_fc1880",
      kind: "report",
      tier: "primary",
      csl: { type: "report", title: "Report of the Indian Famine Commission, Part I: Famine Relief", author: [{ literal: "Indian Famine Commission" }], issued: { "date-parts": [[1880]] }, publisher: "Home, Revenue and Agricultural Department Press", "publisher-place": "Calcutta" },
      identifiers: ia(CAPTURES.fc1880.identifier),
      license: { status: "public_domain", note: "Government of India report of 1880." },
      lenses: ["primary_source"],
      note: "The Strachey Commission's report, the basis of the famine codes. The scan's OCR is poor in places: only clean passages are quoted, and locators give paragraph numbers.",
    },
    {
      op: "create_source",
      ref: "fs_fc1901",
      kind: "report",
      tier: "primary",
      csl: { type: "report", title: "Report of the Indian Famine Commission, 1901", author: [{ literal: "Indian Famine Commission" }], issued: { "date-parts": [[1901]] }, publisher: "Superintendent of Government Printing", "publisher-place": "Calcutta" },
      identifiers: ia(CAPTURES.fc1901.identifier),
      license: { status: "public_domain", note: "Government of India report of 1901 (this scan is the reprint of 1908)." },
      lenses: ["primary_source"],
      note: "The MacDonnell Commission on the famine of 1899–1900.",
    },
    {
      op: "create_source",
      ref: "fs_igi",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Imperial Gazetteer of India, vol. III: The Indian Empire, Economic", "title-short": "Imperial Gazetteer of India", volume: "3", issued: { "date-parts": [[1907]] }, publisher: "Clarendon Press", "publisher-place": "Oxford" },
      identifiers: ia(CAPTURES.igi3.identifier),
      license: { status: "public_domain", note: "Published 1907 under the authority of the Secretary of State for India." },
      lenses: ["colonial_orientalist"],
      note: "Chapter X, “Famine”, was written by S. H. Butler. The official history of famine and relief, and the official view of it.",
    },
    {
      op: "create_source",
      ref: "fs_dharwar",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Gazetteer of the Bombay Presidency, vol. XXII: Dharwar", volume: "22", editor: [{ family: "Campbell", given: "James M." }], issued: { "date-parts": [[1884]] }, publisher: "Government Central Press", "publisher-place": "Bombay" },
      identifiers: ia(CAPTURES.dharwar.identifier),
      license: { status: "public_domain", note: "Government of Bombay publication of 1884." },
      lenses: ["colonial_orientalist"],
      note: "District gazetteer; its account of the famines of 1791–92 and 1803 draws on local memory and Maratha records.",
    },
    {
      op: "create_source",
      ref: "fs_dutt_letters",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "Open Letters to Lord Curzon on Famines and Land Assessments in India", author: [{ family: "Dutt", given: "Romesh C." }], issued: { "date-parts": [[1900]] }, publisher: "Kegan Paul, Trench, Trübner and Co.", "publisher-place": "London" },
      identifiers: ia(CAPTURES.duttLetters.identifier),
      license: { status: "public_domain", note: "Published 1900; Dutt died 1909." },
      lenses: ["nationalist", "primary_source"],
      note: "A former Indian Civil Service officer's case against the land revenue system, written during the famine of 1899–1900.",
    },
    {
      op: "create_source",
      ref: "fs_dutt_victorian",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "India in the Victorian Age: An Economic History of the People", author: [{ family: "Dutt", given: "Romesh" }], issued: { "date-parts": [[1904]] }, publisher: "Kegan Paul, Trench, Trübner and Co.", "publisher-place": "London" },
      identifiers: ia(CAPTURES.duttVictorian.identifier),
      license: { status: "public_domain", note: "Published 1904; Dutt died 1909." },
      lenses: ["nationalist"],
      note: "The second volume of Dutt's Economic History of India.",
    },
    {
      op: "create_source",
      ref: "fs_digby_prosperous",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "“Prosperous” British India: A Revelation from Official Records", author: [{ family: "Digby", given: "William" }], issued: { "date-parts": [[1901]] }, publisher: "T. Fisher Unwin", "publisher-place": "London" },
      identifiers: ia(CAPTURES.digbyProsperous.identifier),
      license: { status: "public_domain", note: "Published 1901; Digby died 1904." },
      lenses: ["nationalist"],
      note: "A polemic against official claims of Indian prosperity; its famine totals combine official returns with unofficial estimates.",
    },
    {
      op: "create_source",
      ref: "fs_curzon",
      kind: "book",
      tier: "primary",
      csl: { type: "book", title: "Lord Curzon in India: Being a Selection from His Speeches as Viceroy and Governor-General of India, 1898–1905", author: [{ family: "Curzon", given: "George Nathaniel" }], editor: [{ family: "Raleigh", given: "Thomas" }], issued: { "date-parts": [[1906]] }, publisher: "Macmillan and Co.", "publisher-place": "London" },
      identifiers: ia(CAPTURES.curzon.identifier),
      license: { status: "public_domain", note: "Published 1906; Curzon died 1925, Raleigh 1920." },
      lenses: ["primary_source", "colonial_orientalist"],
    },
    {
      op: "create_source",
      ref: "fs_fic",
      kind: "report",
      tier: "primary",
      csl: { type: "report", title: "Famine Inquiry Commission: Report on Bengal", author: [{ literal: "Famine Inquiry Commission" }], issued: { "date-parts": [[1945]] }, publisher: "Government of India Press", "publisher-place": "New Delhi" },
      identifiers: ia(CAPTURES.fic1945.identifier),
      license: { status: "public_domain", note: "Government of India publication of 1945: public domain in India (60 years after publication). Its US status is not established." },
      lenses: ["primary_source"],
      note: "The Woodhead Commission. It heard witnesses in camera; its estimate of deaths (about 1.5 million) is lower than most later ones.",
    },
    wp("fs_wp1770", "wp1770"),
    wp("fs_wpChalisa", "wpChalisa"),
    wp("fs_wpDoji", "wpDoji"),
    wp("fs_wp1876", "wp1876"),
    wp("fs_wp1943", "wp1943"),
    wp("fs_wpFamineIndia", "wpFamineIndia"),
    wp("fs_wpGreen", "wpGreen"),
  ];
  return all.filter((op) => !("ref" in op && op.ref && reuse[op.ref]));
}

/** Every create op: sources (unless reused), excerpts, claims, citations, relations. */
export function contentOps(s: Snaps, E: Record<string, string>, reuse: Record<string, string>): ChangeOpInput[] {
  const e = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const src = (ref: string) => reuse[ref] ?? `@${ref}`;
  const ops: ChangeOpInput[] = [...sourceOps(s, reuse)];
  for (const ex of EXCERPTS)
    ops.push({ op: "create_excerpt", ref: ex.ref, source: src(ex.source), snapshotId: s[ex.snap].id, quote: ex.quote, locator: ex.locator, ...(ex.note ? { note: ex.note } : {}) } as ChangeOpInput);
  const viaWp = (k: CaptureKey) => ({ via: "wikipedia" as const, title: `Wikipedia: ${s[k].title}`, ...(s[k].url ? { url: s[k].url! } : {}), ...(s[k].revisionId ? { revisionId: s[k].revisionId! } : {}) });
  for (const cl of CLAIMS)
    ops.push({
      op: "create_claim",
      ref: cl.ref,
      text: cl.text,
      kind: cl.kind,
      assessment: cl.assessment,
      ...(cl.assessmentNote ? { assessmentNote: cl.assessmentNote } : {}),
      ...(cl.when ? { when: cl.when } : {}),
      ...(cl.themes ? { themes: cl.themes } : {}),
      ...(cl.lenses ? { lenses: cl.lenses } : {}),
      ...(cl.entities ? { entities: cl.entities.map((x) => ({ entity: e(x.ref), role: x.role ?? "subject" })) } : {}),
      ...(cl.foundVia ? { foundVia: cl.foundVia.map(viaWp) } : {}),
      ...(cl.learning ? { learning: cl.learning } : {}),
    } as ChangeOpInput);
  for (const ct of CITES) ops.push({ op: "cite", claim: `@${ct.claim}`, excerpt: `@${ct.excerpt}`, stance: ct.stance, ...(ct.note ? { note: ct.note } : {}) });
  for (const r of RELATIONS) ops.push({ op: "relate_claims", from: `@${r.from}`, to: `@${r.to}`, type: r.type, ...(r.note ? { note: r.note } : {}) });
  return ops;
}

// ---------------------------------------------------------------- cells (tracks)

export type FacetKey = "food" | "water" | "work" | "failure" | "coping" | "rulers" | "toll" | "after";
export const FACETS: { key: FacetKey; label: string; description: string }[] = [
  { key: "food", label: "Food", description: "What people ate in ordinary years." },
  { key: "water", label: "Water", description: "Rain, rivers, wells, tanks and canals." },
  { key: "work", label: "Work", description: "How people earned a living." },
  { key: "failure", label: "When the rains failed", description: "What went first, prices, what famine looked like." },
  { key: "coping", label: "Getting through", description: "What people did to survive." },
  { key: "rulers", label: "Rulers and the state", description: "What rulers and the state did, or did not do." },
  { key: "toll", label: "The toll", description: "Deaths, disease, flight, what was destroyed." },
  { key: "after", label: "Afterwards", description: "How life changed afterwards; memory." },
];

/**
 * One cell per facet per age where there is evidence. `age` is a key of
 * EXISTING (an age entity); text links claims as [words](claim:@ref).
 */
export interface CellSpec {
  facet: FacetKey;
  age: "companyRule" | "maratha" | "britishRaj" | "independentIndia";
  text: string;
  excerpt?: string;
}
const L = (ref: string, words: string) => `[${words}](claim:@${ref})`;
export const CELLS: CellSpec[] = [
  // Company rule, 1757–1858
  { facet: "failure", age: "companyRule", text: `In 1769 Bengal's December rice harvest failed after a poor year, and ${L("c1770_cause", "famine followed in 1770")}; the good rains came too late.` },
  { facet: "coping", age: "companyRule", text: `In 1770 ${L("c1770_coping", "peasants sold cattle, ploughs and children, and ate their seed grain, leaves and grass")}.`, excerpt: "hx_sold" },
  { facet: "rulers", age: "companyRule", text: `${L("c1770_revenue", "The Company kept its revenue up through the famine")} and ${L("c1770_relief", "gave almost nothing in relief")}; ${L("c_madras1792", "Madras opened the first relief works in 1792")}.`, excerpt: "hx_hastings_violent" },
  { facet: "toll", age: "companyRule", text: `${L("c1770_toll", "Officials reckoned a third of Bengal died in 1770")}, perhaps ten million, a figure later called too high; ${L("c_chalisa_toll", "the famines of 1782–84 may have killed up to 11 million")}.`, excerpt: "hx_shore" },
  { facet: "after", age: "companyRule", text: `${L("c1770_after", "Twenty years on, Bengal was half-peopled and a third of its land lay waste")}.` },
  // Maratha territory, 1791–92
  { facet: "coping", age: "maratha", text: `${L("c_doji", "In the skull famine of 1791–92 people in Dharwar lived on leaves and berries, and women and children were sold")}.`, excerpt: "dx_skull" },
  { facet: "rulers", age: "maratha", text: `${L("c_doji_rulers", "In 1791–92 the rich fed the distressed, it was said; the Peshwa's government did little but seize grain")}.`, excerpt: "dx_peshwa" },
  // British Raj, 1858–1947
  { facet: "food", age: "britishRaj", text: `${L("c_monsoon", "The poor lived on millets and rice from the monsoon harvest")}; ${L("c_bengal_rice", "Bengal on rice")}; ${L("c_mysore_diet", "a Mysore family on ragi and horse-gram, about 1.5 lb of grain a head a day")}.`, excerpt: "bx_digby_ration" },
  { facet: "water", age: "britishRaj", text: `${L("c_monsoon", "The monsoon, June to October, made the year")}; ${L("c_bullocks", "bullocks drew water from the wells, and in 1899–1900 they died of thirst")}.`, excerpt: "nx_mathan" },
  { facet: "work", age: "britishRaj", text: `${L("c_labourers", "Millions of landless labourers had only casual work; small farmers lived on credit")}. ${L("c_bengal_rice", "Half of Bengal's rural families had under two acres or none")}.` },
  { facet: "failure", age: "britishRaj", text: `${L("c_first_hit", "Drought stopped field work first, then ruined artisans and traders")}; ${L("c_orissa_late", "Orissa's markets were empty before officials noticed")}; ${L("c_charity43", "in 1943 village charity dried up")}.` },
  { facet: "coping", age: "britishRaj", text: `People ${L("c76_mysore_sales", "ate less, sold animals and borrowed")}, ${L("c99_cattle", "sold jewels and doors")} and ${L("c43_sales", "land")}, ${L("c76_roots", "ate roots and tamarind seed")}, ${L("c43_migration", "walked to the towns")}, or ${L("c_refuse_camps", "shunned the camps")}.`, excerpt: "gx_tamarind" },
  { facet: "rulers", age: "britishRaj", text: `${L("c_fc_duty", "From 1880 relief was called a paramount duty")}, ${L("c_fc_wage", "at the lowest wage that kept workers alive")}; ${L("c99_revenue", "revenue was still demanded")}, and ${L("c43_not_declared", "in 1943 famine was never declared")}.`, excerpt: "fx_paramount" },
  { facet: "toll", age: "britishRaj", text: `${L("c76_deaths", "About 5.25 million died in 1876–78")}, ${L("c99_deaths", "a million in 1899–1900")}, ${L("c43_toll", "1.5 million or more in 1943")}; ${L("c_disease", "most died of disease")}, and ${L("c99_cattle", "cattle died in millions")}.`, excerpt: "nx_children" },
  { facet: "after", age: "britishRaj", text: `${L("c76_after", "Labourers left for plantations overseas")}; ${L("c_storage", "railways ended dearth of food but not of money")}; ${L("c_dutt_land", "famine became the core of the case against British rule")}.` },
  // Independent India, from 1947
  { facet: "failure", age: "independentIndia", text: `${L("c_after_green", "Two severe droughts in 1964–66")} were followed by ${L("c_after_bihar", "drought in Bihar in 1966–67")}.` },
  { facet: "rulers", age: "independentIndia", text: `${L("c_after_bihar", "Relief reached Bihar in 1966–67")} and ${L("c_after_none", "later threatened famines were contained")}; ${L("c_after_sen", "Sen credits democracy and a free press")}.` },
  { facet: "toll", age: "independentIndia", text: `${L("c_after_none", "No famine on the scale of 1943 since independence")}, but ${L("c_after_hunger", "about 194 million were undernourished in 2016–18")}.` },
  { facet: "after", age: "independentIndia", text: `${L("c_after_green", "The Green Revolution, from about 1968, raised wheat and rice output, above all in Punjab and Haryana")}.` },
];

/** Claim refs a cell's text links, in order. */
export const cellRefs = (cell: CellSpec) => [...new Set([...cell.text.matchAll(/\(claim:@([\w-]+)\)/g)].map((m) => m[1]!))];

// ---------------------------------------------------------------- page

export interface ExistingClaims {
  /** "Dadabhai Naoroji argued that British rule drained India's wealth…" (independence page) */
  drain: string;
  /** "In 1943, during the war, a famine in Bengal killed an estimated 800,000 to 3.8 million…" (independence page) */
  range1943: string;
}

export function faminePage(E: Record<string, string>, old: ExistingClaims): ChangeOpInput {
  const e = (ref: string) => {
    const v = E[ref];
    if (!v) throw new Error(`unknown entity ref ${ref}`);
    return v;
  };
  const C = (ref: string, text: string) => `[${text}](claim:@${ref})`;
  const O = (id: string, text: string) => `[${text}](claim:${id})`;
  const N = (ref: string, text: string) => `[${text}](entity:${e(ref)})`;
  const ids = (...refs: string[]) => refs.map((r) => `@${r}`);
  const quote = (id: string, excerpt: string, caption: string): BlockInput => ({ id, type: "quote", excerptId: `@${excerpt}`, caption });

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown: [
        `For most people in British India, life hung on one season of rain. ${C("c_monsoon", "When the monsoon came, the autumn harvest of millets and rice fed the poor")}; when it failed, ${C("c_first_hit", "field work stopped first, and the landless lost their living before they lost their food")}. This page follows what happened next, famine by famine, from ${N("f1770", "Bengal in 1770")} to ${N("bengal1943", "Bengal in 1943")}: what people ate, what they sold, where they went, what the ${N("companyRule", "Company")} and the ${N("britishRaj", "Raj")} did, and how many died.`,
        `Much of it is told by people who were there: Company officials, a young officer's verses, newspaper correspondents, a village inquiry, a journalist among the cholera huts, and the commissions that came afterwards. They disagreed then about why so many died, and historians still do. The page sets out the evidence on each side.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("f1770"), text: `${C("c1770_toll", "A third of Bengal, officials reckoned")}, while ${C("c1770_revenue", "the revenue was “violently kept up”")}.`, target: "ch-1770", targetLabel: "Bengal, 1769–70" },
        { entity: e("temple"), text: `${C("c76_temple", "A pound of grain a day")} for a day's labour, in 1877.`, target: "ch-1876", targetLabel: "The Great Famine" },
        { entity: e("t_famine_code"), text: `${C("c_fc_duty", "A paramount duty of the state")}, written down after 1880.`, target: "ch-codes", targetLabel: "Famine codes" },
        { entity: e("drain"), text: `${O(old.drain, "Naoroji's drain")} and ${C("c_dutt_land", "Dutt's land revenue")}: was it rule or rain?`, target: "ch-argument", targetLabel: "Weather or rule?" },
        { entity: e("bengal1943"), text: `${C("c43_toll", "About 1.5 million dead, said the inquiry")}; ${C("c43_later", "later estimates are higher")}.`, target: "ch-1943", targetLabel: "Bengal, 1943" },
        { entity: e("sen"), text: `${C("c43_sen", "A famine of buying power, not of rice")}?`, target: "ch-1943", targetLabel: "Bengal, 1943" },
      ],
    },
    {
      id: "tracks",
      type: "tracks",
      title: "Famine and everyday life, 1757 to today",
      intro: "Read across to see one part of life change; read down to see a time whole. Each line links the claims it rests on; cells are left empty where the evidence on this page is silent.",
      facets: FACETS,
      ages: [
        { entity: e("companyRule"), label: "Company rule", target: "ch-1770" },
        { entity: e("maratha"), label: "Maratha lands, 1790s", target: "ch-1790s" },
        { entity: e("britishRaj"), label: "British Raj", target: "ch-1876" },
        { entity: e("independentIndia"), label: "After 1947", target: "ch-after" },
      ],
      cells: CELLS.map((cell) => ({
        facet: cell.facet,
        age: e(cell.age),
        text: cell.text,
        claimIds: ids(...cellRefs(cell)),
        ...(cell.excerpt ? { excerptId: `@${cell.excerpt}` } : {}),
      })),
    },

    // ------------------------------------------------------------ ordinary years
    {
      id: "ch-ordinary",
      type: "chapter",
      title: "In ordinary years: rain, grain and wages",
      promise: "What people ate, where the water came from, and why a failed harvest took away both food and work.",
      when: { start: ce(1757), end: ce(1947), basis: "Company rule and the Raj" },
      terms: [e("t_land_revenue")],
      brief: {
        happened: `${C("c_monsoon", "The poor lived on the monsoon harvest of millets and rice")}; ${C("c_labourers", "millions were landless labourers with only casual work")}, so ${C("c_first_hit", "drought took their wages before it took their food")}.`,
        howWeKnow: "The Imperial Gazetteer (1907) and the Famine Commissions of 1880 and 1945, official sources; a village inquiry of 1877 and a journalist's notes of 1900 for single households.",
      },
    },
    {
      id: "ordinary-prose",
      type: "prose",
      markdown: [
        `${C("c_monsoon", "The year began with the south-west monsoon, which broke in June and ended in early October; the autumn harvest it watered, millets and rice, was the year's food for the poor")}. In Bengal it was rice above all: ${C("c_bengal_rice", "a land of rice growers and rice eaters")}. In a Mysore village in 1877 ${C("c_mysore_diet", "a farming family ate ragi balls with horse-gram, about three-quarters of a seer of grain a head a day")}.`,
        `Water for fields and cattle came from rain, rivers, tanks and wells, and ${C("c_bullocks", "bullocks did the heavy work: they ploughed and drew water from the wells")}. Most people did not grow enough to live on. ${C("c_labourers", "Millions of labourers owned no land and had only casual work, and small farmers had no capital and lived on credit")}; ${C("c_bengal_rice", "half of Bengal's rural families had less than two acres, or none")}.`,
        `So ${C("c_first_hit", "drought struck the landless first: field work stopped, then artisans and traders lost their customers, and at last charity dried up")}. ${C("c_charity43", "In Bengal in 1943 village charity, given as rice, stopped as rice grew dear")}. Those who starved were rarely those who grew the most grain; they were those who had to buy it.`,
      ].join("\n\n"),
    },
    { id: "ordinary-claims", type: "claims", claimIds: ids("c_monsoon", "c_bengal_rice", "c_mysore_diet", "c_bullocks", "c_labourers", "c_first_hit", "c_charity43") },
    quote("ordinary-quote", "bx_digby_ration", "A farmer of Mysore, head of a family of thirteen, questioned in March 1877; in W. Digby, The Famine Campaign in Southern India (1878), vol. I, p. 440."),

    // ------------------------------------------------------------ 1770
    {
      id: "ch-1770",
      type: "chapter",
      title: "Bengal, 1769–70: the Company's first famine",
      promise: "A failed rice crop, peasants who sold everything, and a revenue that did not fall.",
      when: { start: ce(1769), end: ce(1772), basis: "From the failed harvest of 1769 to the Council's report of 1772" },
      people: [e("hastings"), e("hunter")],
      terms: [e("t_land_revenue"), e("t_famine_foods")],
      brief: {
        happened: `${C("c1770_cause", "After the rice crop failed in 1769")}, ${C("c1770_toll", "officials reckoned a third of Bengal died")}, while ${C("c1770_revenue", "the Company's revenue was kept up")}.`,
        howWeKnow: "The Company's own letters, as W. W. Hunter read and quoted them in 1868, the Council's letter of 1772, and John Shore's verses; all from the rulers' side.",
      },
    },
    {
      id: "g-1770",
      type: "guess",
      question: "In 1770, what share of Bengal's people did the Company's officials reckon had died?",
      answer: { kind: "choice", options: ["A tenth", "A third", "Half"], correct: 1 },
      claimId: "@c1770_toll",
      revealAfter: "1770-prose",
    },
    {
      id: "1770-prose",
      type: "prose",
      markdown: [
        `In 1765 the East India Company took the right to collect the revenue of Bengal. Four years later ${C("c1770_cause", "the December rice harvest failed, after a poor crop the year before")}. Through the summer of 1770 ${C("c1770_coping", "peasants sold their cattle and ploughs, ate their seed grain, sold their sons and daughters until no one would buy them, and ate leaves and grass; in June an official reported that the living were eating the dead")}.`,
        `Good rains came in the autumn, too late. ${C("c1770_toll", "Officials reckoned that a third of the people had died")}; the historian W. W. Hunter later put it at ten million, a figure others call too high. ${C("c1770_relief", "Relief was tiny: districts losing twenty thousand people a month were given 150 rupees")}. And ${C("c1770_revenue", "the revenue did not fall: the Council wrote in 1772 that it had been “violently kept up”")}.`,
        `${C("c1770_warehouse", "Hunter, writing a century later, said the British of 1770 saw Bengal as a warehouse for trade")}, and hardly asked who was to blame. ${C("c1770_after", "Twenty years on, a third of its land still lay waste")}.`,
      ].join("\n\n"),
    },
    { id: "1770-claims", type: "claims", claimIds: ids("c1770_cause", "c1770_coping", "c1770_toll", "c1770_relief", "c1770_revenue", "c1770_warehouse", "c1770_after") },
    quote("1770-quote-sold", "hx_sold", "W. W. Hunter, The Annals of Rural Bengal (1868), vol. I, p. 26, summarising petitions from the Company's district officers."),
    quote("1770-quote-shore", "hx_shore", "John Shore, later Governor-General as Lord Teignmouth, who served in Bengal in 1770; his verses quoted by Hunter, Annals, vol. I, p. 28."),
    quote("1770-quote-revenue", "hx_hastings_violent", "The President and Council of Bengal (Warren Hastings) to the Court of Directors, 3 November 1772, on why the revenue had not fallen; printed in Hunter, Annals, vol. I, p. 381."),
    {
      id: "1770-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. No one counted the dead of 1770. “A third” is the officials' reckoning at the time, and ten million is Hunter's arithmetic from it; the Imperial Gazetteer (1907) says the figure has been disputed as too high.",
    },

    // ------------------------------------------------------------ 1780s–90s
    {
      id: "ch-1790s",
      type: "chapter",
      title: "The 1780s and 1790s: the Chalisa and the skull famine",
      promise: "Two famines mostly outside the Company's lands, remembered by their names.",
      when: { start: ce(1783), end: ce(1792) },
      terms: [e("t_relief_works"), e("t_famine_foods")],
      brief: {
        happened: `${C("c_chalisa", "The Chalisa famine of 1783–84 struck north India")}, and ${C("c_doji", "the skull famine of 1791–92 the Deccan")}; ${C("c_madras1792", "in 1792 Madras opened the first relief works")}.`,
        howWeKnow: "Little was written down at the time. The Dharwar gazetteer of 1884 records local memory of 1791–92; modern estimates come through Wikipedia.",
      },
    },
    {
      id: "1790s-prose",
      type: "prose",
      markdown: [
        `${C("c_chalisa", "The Chalisa famine of 1783–84, named after the year 1840 of the Vikram era, struck the Delhi country, the Doab, the Punjab and Rajputana")}, then ruled by Indian rulers. ${C("c_chalisa_toll", "One modern estimate is that the famines of 1782–84 together may have killed up to 11 million people")}, but there are no records to count from.`,
        `A few years later drought brought ${N("doji", "the Doji bara, the “skull famine”")} to the Deccan. ${C("c_doji", "In Dharwar people lived on leaves and berries, women and children were sold, and the unburied dead gave the famine its name")}. ${C("c_doji_rulers", "The rich were said to have fed the distressed; the Peshwa's government did little")}. In Company territory, ${C("c_madras1792", "Madras opened relief works for the famine-stricken, the first time this was done")}.`,
      ].join("\n\n"),
    },
    { id: "1790s-claims", type: "claims", claimIds: ids("c_chalisa", "c_chalisa_toll", "c_doji", "c_doji_rulers", "c_madras1792") },
    quote("1790s-quote", "dx_skull", "Gazetteer of the Bombay Presidency, vol. XXII, Dharwar (1884), p. 307, on the famine of 1791–92."),

    // ------------------------------------------------------------ Orissa
    {
      id: "ch-orissa",
      type: "chapter",
      title: "Orissa, 1866: a province cut off",
      promise: "Empty markets that no one noticed, rice that came too late, and people who would not take charity.",
      when: { start: ce(1866), end: ce(1867) },
      brief: {
        happened: `${C("c_orissa_late", "Officials saw the shortage only when the monsoon had closed the sea")}, and ${C("c_orissa", "about a million people, a third of Orissa, died")}.`,
        howWeKnow: "The Famine Commission of 1880 and the Imperial Gazetteer, both drawing on the inquiry of 1867; Hunter on the women who starved unseen.",
      },
    },
    {
      id: "orissa-prose",
      type: "prose",
      markdown: [
        `${C("c_orissa", "Orissa in 1866 was almost cut off from the rest of India")}, by unbridged rivers on land and the monsoon at sea. ${C("c_orissa_late", "Officials found out only in May that the markets were empty; by then imports were almost impossible, and the rice bought at great cost reached the people in September")}. ${C("c_orissa", "About a million people, a third of the population, died")}.`,
        `Not everyone could, or would, take what relief there was. ${C("c_caste_relief", "Respectable families would not let their women take public charity and starved in silence; Santals starved rather than eat food cooked by Brahmans, and those who ate in the kitchens became a new caste, the “kitchen-eaters”")}. ${C("c_orissa_after", "The deaths stirred public conscience, and the inquiry that followed began a more humane policy")}.`,
      ].join("\n\n"),
    },
    { id: "orissa-claims", type: "claims", claimIds: ids("c_orissa", "c_orissa_late", "c_caste_relief", "c_orissa_after") },
    quote("orissa-quote", "hx_1866", "W. W. Hunter, The Annals of Rural Bengal (1868), vol. I, p. 26."),

    // ------------------------------------------------------------ 1876–78
    {
      id: "ch-1876",
      type: "chapter",
      title: "The Great Famine of 1876–78",
      promise: "Two years of drought in the south, a pound of grain for a day's work, and grain leaving the country.",
      when: { start: ce(1876), end: ce(1878) },
      people: [e("temple"), e("lytton"), e("digby")],
      terms: [e("t_relief_works"), e("t_gratuitous"), e("t_famine_foods")],
      brief: {
        happened: `${C("c76_extent", "Drought struck the south for two years")}; ${C("c76_temple", "relief workers were paid a pound of grain a day")}, and ${C("c76_deaths", "over five million died by official reckoning")}.`,
        howWeKnow: "William Digby's account of 1878, which quotes officials, newspapers and a village inquiry; the Famine Commission of 1880; Wikipedia for modern estimates.",
      },
    },
    {
      id: "1876-prose",
      type: "prose",
      markdown: [
        `${C("c76_extent", "From 1876 drought gripped Madras, Bombay, Mysore and Hyderabad for two years: 58.5 million people")}. ${C("c76_policy", "London's instruction was to save life, but not to let people come to rely on government aid")}. In January 1877 ${C("c76_temple", "Sir Richard Temple cut the relief wage to a pound of grain and a small coin a day, where a farm wage was about five pounds of grain")}. ${C("c76_condemned", "Critics called it an experiment on a million lives")}, and it was given up after a few months.`,
        `${C("c76_exports", "Grain went on leaving India: more was exported in 1876–77 than ever before")}. At Kalastri in March 1877 ${C("c76_kalastri", "a correspondent found people grubbing in the dust for grains of corn, eating green mangoes and tamarinds, and two wasted bodies in the rest-house")}. In a Mysore village ${C("c76_mysore_sales", "families ate less, sold bullocks, buffaloes and sheep, borrowed from relatives, and lived at times on tamarind seed")}; ${C("c76_roots", "elsewhere people ate roots, leaves and bamboo seed")}.`,
        `${C("c76_deaths", "The official reckoning was about 5.25 million excess deaths in British territory; modern estimates run from 5.6 to 9.6 million")}. ${C("c76_after", "Afterwards labourers and weavers left the south as indentured workers on plantations abroad, and the famine lived on in Tamil folk songs")}. ${C("c76_congress", "Officials it unsettled helped found the Indian National Congress")}.`,
      ].join("\n\n"),
    },
    { id: "1876-claims", type: "claims", claimIds: ids("c76_extent", "c76_policy", "c76_temple", "c76_condemned", "c76_exports", "c76_kalastri", "c76_mysore_sales", "c76_roots", "c76_deaths", "c76_after", "c76_congress") },
    quote("1876-quote-condemned", "gx_condemned", "W. Digby, The Famine Campaign in Southern India (1878), vol. I, p. 85, on the “Temple wage” in Madras, early 1877."),
    quote("1876-quote-kalastri", "gx_kalastri", "The special correspondent of the Friend of India at Kalastri, North Arcot, 16 March 1877; quoted by Digby, vol. I, p. 99."),
    quote("1876-quote-tamarind", "gx_tamarind", "A village labourer of Mysore, as recorded by Colonel Hay's inquiry, March 1877; quoted by Digby, vol. I, p. 441."),

    // ------------------------------------------------------------ codes
    {
      id: "ch-codes",
      type: "chapter",
      title: "Famine codes: a duty to save life, at the lowest cost",
      promise: "What the Famine Commission of 1880 changed, and what it did not.",
      when: { start: ce(1880), end: ce(1907) },
      terms: [e("t_famine_code"), e("t_relief_works"), e("t_gratuitous")],
      brief: {
        happened: `${C("c_fc_duty", "The Commission of 1880 made famine relief a duty of the state, written into famine codes")}, but ${C("c_fc_wage", "at the lowest wage that kept a worker healthy")}.`,
        howWeKnow: "The Commission's report (1880) and the Imperial Gazetteer (1907): the government's own words, and its own judgement of itself.",
      },
    },
    {
      id: "codes-prose",
      type: "prose",
      markdown: [
        `After 1876–78 a commission was asked how famine should be met. ${C("c_fc_duty", "It declared it a paramount duty of the state to give all practicable help in famine, and asked for a famine code in every province")}: rules for spotting famine early, opening ${N("t_relief_works", "relief works")} for those who could work and giving ${N("t_gratuitous", "relief without work")} to those who could not. ${C("c_fc_wage", "The wage was to be the lowest that would keep a worker healthy, not what he usually earned")}. ${C("c_kitchens", "Children were fed in kitchens, not through their parents")}.`,
        `${C("c_fc_achievement", "By 1907 the government called its famine campaign one of the great achievements of scientific administration")}, and ${C("c_small_famines", "in the smaller famines that followed, the codes on the whole prevented deaths from starvation")}. The great famines of 1896–1900 and 1943 tested them harder.`,
      ].join("\n\n"),
    },
    { id: "codes-claims", type: "claims", claimIds: ids("c_fc_duty", "c_fc_wage", "c_kitchens", "c_fc_achievement", "c_small_famines") },
    quote("codes-quote", "fx_paramount", "Report of the Indian Famine Commission, Part I (1880), para. 105."),

    // ------------------------------------------------------------ 1896–1900
    {
      id: "ch-1899",
      type: "chapter",
      title: "1896–1900: cattle, cholera and the camps",
      promise: "Two famines in four years, the largest relief India had seen, and the herds that died.",
      when: { start: ce(1896), end: ce(1900) },
      people: [e("curzon")],
      terms: [e("t_relief_works"), e("t_land_revenue")],
      brief: {
        happened: `${C("c99_relief", "Up to 6.5 million people a day were on relief in 1900")}; ${C("c99_cattle", "cattle died in millions")} and ${C("c99_deaths", "about a million people died, many of cholera")}.`,
        howWeKnow: "The Imperial Gazetteer, the Famine Commission of 1901, Curzon's own speech, and Vaughan Nash, a journalist who went to the camps and villages in 1900.",
      },
    },
    {
      id: "1899-prose",
      type: "prose",
      markdown: [
        `${C("c96", "The famine of 1896–97 covered 69.5 million people; over four million were on relief at its worst")}. Two years later the monsoon of 1899 failed almost everywhere in the west and centre. ${C("c99_relief", "Relief reached a scale never seen: nearly five million in March 1900, 6.5 million by July")}.`,
        `${C("c99_cattle", "Cattle died in millions. In Gujarat farmers sold their jewels and even the doors and rafters of their houses to buy fodder, and lost their herds anyway")}. In April the journalist Vaughan Nash talked with farmers at a well near Nandurbar: ${C("c99_village", "they had lost their crops and most of their bullocks, their land was mortgaged, they were working as labourers and selling their cooking pots, and they had been told to pay their revenue")}. ${C("c99_revenue", "A circular in Broach warned that land forfeited for unpaid revenue would be auctioned, though elsewhere revenue was remitted on a large scale")}.`,
        `Then came cholera. ${C("c99_cholera", "At Devala camp in Khandesh, after forty deaths, three thousand of four thousand workers fled into the jungle, carrying the disease")}. ${C("c_refuse_camps", "Some, like the hill Bhils, feared the camps more than hunger")}. ${C("c99_deaths", "The Commission of 1901 put the famine's deaths in British districts at about a million, at least a fifth of them from cholera")}, and ${C("c99_avoidable", "judged that many in Gujarat need not have died")}.`,
      ].join("\n\n"),
    },
    { id: "1899-claims", type: "claims", claimIds: ids("c96", "c99_relief", "c99_cattle", "c99_village", "c99_revenue", "c99_cholera", "c99_deaths", "c99_avoidable") },
    quote("1899-quote-mathan", "nx_mathan", "Vaughan Nash, The Great Famine and its Causes (1900), p. 62: a farmer at Nagbode, near Nandurbar, April 1900."),
    quote("1899-quote-gujarat", "ox_gujarat", "Report of the Indian Famine Commission, 1901, para. 205."),
    quote("1899-quote-children", "nx_children", "Vaughan Nash at Talwada relief camp, Khandesh, April 1900; The Great Famine and its Causes, p. 61."),

    // ------------------------------------------------------------ coping
    {
      id: "ch-coping",
      type: "chapter",
      title: "How people lived through famine",
      promise: "Famine foods, selling up, borrowing, walking to the towns, and refusing the camps: across all these famines.",
      terms: [e("t_famine_foods"), e("t_relief_works")],
      brief: {
        happened: `People ${C("c76_mysore_sales", "ate less, sold their animals and borrowed")}, ${C("c76_roots", "ate roots, leaves and seeds")}, ${C("c43_sales", "sold their tools, doors and land")}, and ${C("c43_migration", "walked to the towns")}.`,
        howWeKnow: "Village inquiries, eyewitnesses and commissions from 1770 to 1945, quoted on this page; the voices are mostly recorded by officials and journalists, rarely the starving themselves.",
      },
    },
    {
      id: "coping-prose",
      type: "prose",
      markdown: [
        `The same steps recur from 1770 to 1943. First, people ate less: ${C("c_mysore_diet", "from three-quarters of a seer of grain a day to half, and ragi balls became thin gruel")}. Then they ate what they would not touch in good years, ${N("t_famine_foods", "famine foods")}: ${C("c1770_coping", "leaves and grass")}, ${C("c_doji", "berries")}, ${C("c76_roots", "roots, shrubs and bamboo seed")}, ${C("c76_mysore_sales", "fried and boiled tamarind seed")}, ${C("c76_kalastri", "unripe mangoes and grains of corn picked from the dust")}.`,
        `They sold what they had, in order: ${C("c76_mysore_sales", "sheep, buffaloes and bullocks")}, ${C("c99_cattle", "jewels and the doors and rafters of the house")}, ${C("c43_sales", "pots, tools and in the end land")}; ${C("c1770_coping", "in 1770")} and ${C("c_doji", "1791–92")}, children. They borrowed from relatives and moneylenders, and ${C("c99_village", "mortgaged their land")}. Men left to look for work, and ${C("c43_migration", "whole families walked or rode the trains to the towns")}.`,
        `Relief camps saved many and frightened many. ${C("c_refuse_camps", "Officials wrote that thousands would die rather than go to a camp or eat food they thought unclean")}; ${C("c_caste_relief", "in 1866 respectable families let their women starve rather than take charity")}. And ${C("c99_cholera", "the crowded camps spread cholera")}. ${C("c_kitchens", "Even children's food had to be given in kitchens")}, officials wrote, because hunger set parents against children.`,
      ].join("\n\n"),
    },
    { id: "coping-claims", type: "claims", claimIds: ids("c1770_coping", "c_doji", "c76_mysore_sales", "c76_roots", "c99_cattle", "c43_sales", "c43_migration", "c_refuse_camps", "c_caste_relief", "c_kitchens") },
    quote("coping-quote", "gx_roots", "The deputy commissioner of Tumkur, Mysore, August 1877; quoted by Digby, vol. I, p. 410."),

    // ------------------------------------------------------------ the argument
    {
      id: "ch-argument",
      type: "chapter",
      title: "Weather or rule? The argument over famine",
      promise: "Indian and British critics blamed poverty made by British rule; the government blamed nature and numbers. The argument continues.",
      phase: "later",
      when: { start: ce(1900), end: ce(1907) },
      people: [e("naoroji"), e("dutt"), e("digby"), e("curzon")],
      terms: [e("drain"), e("t_land_revenue")],
      brief: {
        happened: `${O(old.drain, "Naoroji")}, ${C("c_dutt_land", "Dutt")} and ${C("c_digby_count", "Digby")} blamed the drain of wealth and the land revenue; ${C("c_curzon", "Curzon")} and ${C("c_igi_population", "the official Gazetteer")} blamed drought and a growing population.`,
        howWeKnow: "The critics' own books (1900–04) and Curzon's speech of 1900, each making a case; modern views through Wikipedia.",
      },
    },
    {
      id: "argument-prose",
      type: "prose",
      markdown: [
        `By 1900 famine was at the centre of the case against British rule. ${O(old.drain, "Dadabhai Naoroji argued that British rule drained India's wealth to Britain")}. ${C("c_dutt_land", "R. C. Dutt argued that the provinces hit hardest were those where the government set the land revenue directly and too high, so that farmers could save nothing for bad years")}, and ${C("c_dutt_export", "that grain was sold abroad even before famines to pay that revenue")}. ${C("c_digby_count", "William Digby reckoned more than a million famine deaths a year in the last quarter of the century")}.`,
        `${C("c_curzon", "Lord Curzon answered in 1900 that no revenue reform could offset the crops lost in such a drought")}. ${C("c_igi_population", "The official Imperial Gazetteer saw the root of the problem in peace and a growing population on ever smaller farms")}.`,
        `Historians still divide. ${C("c_davis", "Mike Davis calls the famines of the 1870s and 1890s “Late Victorian Holocausts”, droughts made far worse by British negligence")}; ${C("c_roy", "Tirthankar Roy puts more weight on India's environment")}. One point the sources make again and again: ${C("c_disease", "most of the dead died of disease among the hungry")}.`,
      ].join("\n\n"),
    },
    { id: "argument-claims", type: "claims", claimIds: [old.drain, ...ids("c_dutt_land", "c_dutt_export", "c_digby_count", "c_curzon", "c_igi_population", "c_davis", "c_roy", "c_disease")] },
    {
      id: "argument-debate",
      type: "debate",
      question: "Were the famines of British India caused more by drought or by British rule?",
      positions: [
        { label: "Poverty made by British rule turned drought into famine (Naoroji, Dutt, Digby; Davis)", claimIds: [old.drain, ...ids("c_dutt_land", "c_dutt_export", "c_digby_count", "c1770_revenue", "c76_exports", "c99_revenue", "c_davis")] },
        { label: "Drought and a growing population; the state could only relieve (Curzon, the Imperial Gazetteer; Roy)", claimIds: ids("c_curzon", "c_igi_population", "c_fc_achievement", "c99_relief", "c_roy") },
      ],
      note: "Each side wrote to make a case. The critics' death totals mix official returns and estimates; the government's judgements are its own. The evidence on this page shows both drought and policy at work: revenue collected through famine (1770, 1900), grain exported (1876–77), and also relief on a vast scale (1900). Weigh the figures with their sources.",
    },
    quote("argument-quote-dutt", "ux_letters_high", "R. C. Dutt, Open Letters to Lord Curzon on Famines and Land Assessments in India (1900), preface, p. xii."),
    quote("argument-quote-curzon", "cz_critics", "Lord Curzon, budget speech, 28 March 1900; in Lord Curzon in India (1906), p. 376."),

    // ------------------------------------------------------------ 1943
    {
      id: "ch-1943",
      type: "chapter",
      title: "Bengal, 1943",
      promise: "A famine in wartime, without a declaration of famine: who starved, who blamed whom, and how many died.",
      when: { start: ce(1942), end: ce(1944) },
      people: [e("sen")],
      terms: [e("t_entitlement"), e("t_famine_code")],
      brief: {
        happened: `${C("c43_who", "The rural poor of Bengal starved while others ate")}; ${C("c43_not_declared", "famine was never declared")}, and ${C("c43_toll", "about 1.5 million died by the official inquiry's count")}, ${C("c43_later", "more by later estimates")}.`,
        howWeKnow: "The Famine Inquiry Commission's report (1945), a government inquiry; Wikipedia for later estimates and the scholarly debate, including Sen.",
      },
    },
    {
      id: "g-1943",
      type: "guess",
      question: "How many deaths did the official inquiry of 1945 estimate for the Bengal famine?",
      answer: { kind: "number", value: 1500000, unit: "people", tolerance: 0.25 },
      claimId: "@c43_toll",
      revealAfter: "1943-prose",
    },
    {
      id: "1943-prose",
      type: "prose",
      markdown: [
        `In 1942 Japan took Burma, which had sold Bengal rice. Fearing invasion, ${C("c43_fishermen", "the government removed boats from coastal Bengal, and fishermen without boats suffered severely in the famine")}. Prices rose all through 1943. ${C("c43_who", "The famine fell on the rural poor; the well-off and Calcutta's industrial workers did not go short")}.`,
        `${C("c43_sales", "Labourers and artisans sold their pots, ornaments, doors, windows, tools and animals; small farmers sold their land, and the money soon ran out")}. ${C("c43_migration", "Starving people rode the trains without tickets to Calcutta, begged and searched refuse bins, and corpses became a familiar sight")}. ${C("c43_statesman", "On 22 August The Statesman published photographs of the dead and dying")}. ${C("c43_not_declared", "Famine was never declared, so the famine code was not used")}. ${C("c43_wavell", "The turn came only after the new Viceroy, Lord Wavell, visited in late October")}.`,
        `${C("c43_toll", "The inquiry estimated about 1.5 million deaths")}; ${C("c43_later", "later scholars' consensus is about 2.1 million, more than half in 1944, from disease")}. ${C("c43_blame", "It blamed the Government of Bengal, the Government of India, and profiteers: “profits for some meant death for others”")}. ${C("c43_sen", "Amartya Sen later argued that there was little less rice than usual, and that the poor starved because they could no longer buy it")}; ${C("c43_critics", "his critics say the harvest shortfall was larger than he allowed")}. ${C("c43_cabinet", "Whether Churchill's War Cabinet could have sent food sooner is still argued")}.`,
      ].join("\n\n"),
    },
    { id: "1943-claims", type: "claims", claimIds: [...ids("c43_who", "c43_fishermen", "c43_sales", "c43_migration", "c43_statesman", "c43_not_declared", "c43_wavell", "c43_toll", "c43_later"), old.range1943, ...ids("c43_blame", "c43_sen", "c43_critics", "c43_cabinet")] },
    quote("1943-quote-bins", "bx43_bins", "Famine Inquiry Commission, Report on Bengal (1945), p. 71, on Calcutta in August–October 1943."),
    quote("1943-quote-million", "bx43_million", "Famine Inquiry Commission, Report on Bengal (1945), p. 107."),
    {
      id: "1943-debate-toll",
      type: "debate",
      question: "How many died in the Bengal famine?",
      positions: [
        { label: "About 1.5 million (the Famine Inquiry Commission, 1945)", claimIds: ids("c43_toll") },
        { label: "About 2.1 million, the later scholarly consensus, within a range of 0.8 to 3.8 million", claimIds: [...ids("c43_later"), old.range1943] },
      ],
      note: "The Commission had the registration figures, which it thought too low, and rejected a survey's 3.5 million as unsound. Later demographers re-estimated from the same and later data. The difference is in method.",
    },
    {
      id: "1943-debate-cause",
      type: "debate",
      question: "Was 1943 a famine of too little rice, or of too little money to buy it?",
      positions: [
        { label: "Too little money: an “entitlements famine” (Sen, 1981)", claimIds: ids("c43_sen", "c43_who", "c43_sales") },
        { label: "Too little rice: the harvest fell further than Sen allowed (Bowbrick, Tauger)", claimIds: ids("c43_critics") },
      ],
      note: "Both readings accept war inflation, the loss of Burma rice and the government's failures; they differ on how much rice there was.",
    },

    // ------------------------------------------------------------ after 1947
    {
      id: "ch-after",
      type: "chapter",
      title: "After 1947: no famine on that scale",
      promise: "Droughts did not stop; famines of the old kind did. Why is argued over.",
      when: { start: ce(1947), end: ce(2018) },
      people: [e("sen")],
      terms: [e("t_famine_code")],
      brief: {
        happened: `${C("c_after_none", "No famine on the scale of 1943 has struck India since")}: ${C("c_after_bihar", "relief reached Bihar in 1966–67")}, and ${C("c_after_green", "the Green Revolution raised grain output")}.`,
        howWeKnow: "Wikipedia only, for now (tertiary): the government reports and studies it cites are not yet captured here.",
      },
    },
    {
      id: "after-prose",
      type: "prose",
      markdown: [
        `${C("c_after_none", "Since independence, threatened famines in Bihar, Maharashtra, West Bengal and Gujarat have been contained")}. ${C("c_after_bihar", "In the Bihar drought of 1966–67 relief reached the people, and the old famine codes were revised as scarcity manuals")}. ${C("c_after_green", "After two bad droughts, India adopted high-yielding wheat and rice from about 1968")}.`,
        `${C("c_after_sen", "Amartya Sen argues that democracy and a free press, not more food, ended famine")}; others give more weight to roads, grain stocks and the new seeds. ${C("c_after_hunger", "Hunger itself did not end: in 2016–18 about 194 million people in India were undernourished")}.`,
      ].join("\n\n"),
    },
    { id: "after-claims", type: "claims", claimIds: ids("c_after_none", "c_after_bihar", "c_after_green", "c_after_sen", "c_after_hunger") },

    // ------------------------------------------------------------ often said
    {
      id: "ch-often",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Three short versions of this story, checked against the sources on this page.",
      phase: "later",
      brief: {
        happened: `Three common beliefs: ${C("m_starvation", "that most died of hunger itself")}, ${C("m_drought_only", "that drought alone caused famine")}, and ${C("m_no_relief", "that the British did nothing")}.`,
        howWeKnow: "The sources on this page.",
      },
    },
    { id: "often-prose", type: "prose", markdown: "Each of these has some truth in it, and each leaves out what the sources show." },
    { id: "myth-starvation", type: "misconception", theme: "society", claimId: "@m_starvation", correctionIds: ids("c_disease", "c99_deaths", "c43_later") },
    { id: "myth-drought", type: "misconception", theme: "economy", claimId: "@m_drought_only", correctionIds: ids("c1770_revenue", "c99_avoidable", "c43_sen", "c43_who") },
    { id: "myth-relief", type: "misconception", theme: "governance", claimId: "@m_no_relief", correctionIds: ids("c_fc_duty", "c99_relief", "c1770_relief", "c43_not_declared") },
  ];

  return {
    op: "create_page",
    slug: PAGE_SLUG,
    title: PAGE_TITLE,
    kind: "theme",
    summary: "Famine in British India, 1770–1943, through the people who lived it: what they ate and earned, what they sold and where they went when the rains failed, what the Company and the Raj did, how many died, and the argument over why. With what changed after 1947.",
    blocks,
    status: "published",
    spec: famineSpec(),
  };
}

export function famineSpec(): PageSpecInput {
  return { timeline: { range: [1760, 1975] } };
}
