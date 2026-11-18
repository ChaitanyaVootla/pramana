import type { BlockInput, ChangeOpInput, PageSpecInput } from "@pramana/core";
import type { Mcp } from "./mcp";
import { EATON_TEXT, EATON_URL } from "./sultanate-texts";

/**
 * "The Delhi Sultanate" era page (1206–1526). The court chronicles are read
 * in the translations that are public domain: Elliot and Dowson, vols II–III
 * (1869–71: Minhāj, Baranī, Amīr Khusrau, ʿAfīf, Fīrūz Shāh's own
 * Futūḥāt, the Malfūẓāt ascribed to Tīmūr), with Elliot's own preface (vol. I,
 * 1867) as a source on the selection; Ibn Baṭṭūṭa in Lee's translation
 * (1829); Thomas (1871) for the coins; Page (1926) for the Qutb inscriptions;
 * Lane-Poole (1903) and Sewell (1900) as older surveys; Grierson's
 * Padumāwatī (1911) and Tagore and Underhill's Kabir (1915). Modern work is
 * quoted briefly: Eaton on temple desecration (Frontline, 2000, pasted from
 * the PDF with its provenance), UNESCO (CC BY-SA IGO) and Wikipedia (pinned,
 * tertiary). Gibb's Ibn Baṭṭūṭa (1929) is not used: it is in copyright in
 * India and the UK.
 */

const ce = (year: number, month?: number, day?: number) => ({ year, era: "CE" as const, ...(month ? { month } : {}), ...(day ? { day } : {}) });

// ---------------------------------------------------------------- snapshots

export const CAPTURES = {
  ed1: { kind: "internet_archive", identifier: "historyofindiaas01elli" },
  ed2: { kind: "internet_archive", identifier: "historyofindiaas02elli" },
  ed3: { kind: "internet_archive", identifier: "historyofindiaas03elli" },
  lee: { kind: "internet_archive", identifier: "bub_gb_22IbAQAAMAAJ" },
  thomas: { kind: "internet_archive", identifier: "in.ernet.dli.2015.282082" },
  lanepoole: { kind: "internet_archive", identifier: "cu31924024066668" },
  sewell: { kind: "internet_archive", identifier: "dli.ministry.02147" },
  page: { kind: "internet_archive", identifier: "in.gov.ignca.41873" },
  jayasi: { kind: "internet_archive", identifier: "padumawatiofmali00maliuoft" },
  kabir: { kind: "internet_archive", identifier: "cu31924023165248" },
  eaton: {
    kind: "text",
    title: "Eaton, “Temple desecration in pre-modern India”, Frontline, 22 December 2000 (passages)",
    note: `Passages pasted, unedited, as extracted by pdftotext (-raw) from ${EATON_URL} (sha256 da259292e7dc7e4a06d636aa43a614f707e6880a9ab7e5b27e2ce1129270ed2f), fetched 2026-10-18. “[p. N]” marks are ours, from the magazine's running heads.`,
    text: EATON_TEXT,
  },
  unescoQutb: { kind: "url", url: "https://whc.unesco.org/en/list/233/" },
  wpSultanate: { kind: "wikipedia", title: "Delhi Sultanate" },
  wpMamluk: { kind: "wikipedia", title: "Mamluk dynasty (Delhi)" },
  wpMbt: { kind: "wikipedia", title: "Muhammad bin Tughluq" },
  wpPadmini: { kind: "wikipedia", title: "Rani Padmini" },
  wpGoel: { kind: "wikipedia", title: "Hindu Temples: What Happened to Them" },
  wpPanipat: { kind: "wikipedia", title: "First Battle of Panipat" },
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

type Kind = "person" | "place" | "site" | "polity" | "event" | "text" | "artifact" | "term";
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  when?: Record<string, unknown>;
  life?: boolean;
  wdWhen?: boolean;
  geo?: boolean;
  aliases?: { label: string; lang?: string; script?: string; note?: string }[];
  dropAliases?: RegExp;
  link?: { to: string; type: "part_of" | "located_in" | "related_to" | "contemporary_of" | "ruled"; note?: string };
}

/** The page's subject: the polity entity created by the spine (Q229411). */
const SULTANATE = "delhi-sultanate";

export const ENTITIES: EntitySpec[] = [
  // The five dynasties (created with the Cliopatria borders; reused by QID)
  { ref: "mamluk", slug: "mamluk-dynasty-delhi", kind: "polity", label: "Mamluk dynasty (Delhi)", qid: "Q847420", link: { to: SULTANATE, type: "part_of" }, description: "The first rulers of the Sultanate, 1206–1290: three families of Turkish slave origin." },
  { ref: "khalji", slug: "khalji-dynasty", kind: "polity", label: "Khalji dynasty", qid: "Q919071", link: { to: SULTANATE, type: "part_of" }, description: "Rulers of the Sultanate, 1290–1320." },
  { ref: "tughlaq", slug: "tughlaq-dynasty", kind: "polity", label: "Tughlaq dynasty", qid: "Q1124402", link: { to: SULTANATE, type: "part_of" }, description: "Rulers of the Sultanate, 1320–1414." },
  { ref: "sayyid", slug: "sayyid-dynasty", kind: "polity", label: "Sayyid dynasty", qid: "Q1331421", link: { to: SULTANATE, type: "part_of" }, description: "Rulers of the Sultanate, 1414–1451." },
  { ref: "lodi", slug: "lodi-dynasty", kind: "polity", label: "Lodi dynasty", qid: "Q11709", link: { to: SULTANATE, type: "part_of" }, description: "The last rulers of the Sultanate, 1451–1526." },
  // Neighbours and contemporaries
  { ref: "vijayanagara", slug: "vijayanagara-empire", kind: "polity", label: "Vijayanagara Empire", qid: "Q167639", link: { to: SULTANATE, type: "contemporary_of" }, description: "The kingdom founded at Vijayanagara in the south in 1336." },
  { ref: "bahmani", slug: "bahmani-sultanate", kind: "polity", label: "Bahmani Sultanate", qid: "Q374521", link: { to: SULTANATE, type: "contemporary_of", note: "Founded in 1347 by a revolt against Muhammad bin Tughlaq." }, description: "The sultanate of the Deccan founded in 1347 by a revolt against Delhi." },
  { ref: "timurid", slug: "timurid-empire", kind: "polity", label: "Timurid Empire", qid: "Q484195", link: { to: SULTANATE, type: "contemporary_of" }, description: "The empire of Tīmūr and his descendants in Central Asia and Iran, 1370–1507." },
  { ref: "chagatai", slug: "chagatai-khanate", kind: "polity", label: "Chagatai Khanate", qid: "Q487829", link: { to: SULTANATE, type: "contemporary_of", note: "The Mongol state whose armies raided the Sultanate's north-west." }, description: "The Mongol khanate of Central Asia whose armies repeatedly raided the Sultanate." },
  // Rulers
  { ref: "aibak", slug: "qutb-ud-din-aibak", kind: "person", label: "Quṭb al-Dīn Aibak", qid: "Q311151", life: true, link: { to: "@mamluk", type: "ruled" }, description: "A Turkish slave-commander of Muḥammad of Ghor who became the first sultan at Delhi (1206–1210).", aliases: [{ label: "Qutb-ud-din Aibak", lang: "en" }] },
  { ref: "iltutmish", slug: "iltutmish", kind: "person", label: "Iltutmish", qid: "Q336312", life: true, link: { to: "@mamluk", type: "ruled" }, description: "Aibak's slave and son-in-law, sultan 1211–1236; he completed the Qutb Minar.", aliases: [{ label: "Shams al-Dīn Iltutmish", lang: "en" }, { label: "Altamsh", lang: "en", note: "Elliot and Dowson's spelling" }] },
  { ref: "raziya", slug: "raziya", kind: "person", label: "Raziya", qid: "Q465076", life: true, link: { to: "@mamluk", type: "ruled" }, description: "Iltutmish's daughter and chosen heir, sultan 1236–1240: the only woman to rule at Delhi.", aliases: [{ label: "Razia Sultana", lang: "en", note: "A common later name; the chronicles call her “Sultan”" }] },
  { ref: "alauddin", slug: "alauddin-khalji", kind: "person", label: "ʿAlāʾ al-Dīn Khaljī", qid: "Q335362", life: true, link: { to: "@khalji", type: "ruled" }, description: "Sultan 1296–1316, who held off the Mongols, fixed market prices and sent armies far into the south.", aliases: [{ label: "Alauddin Khalji", lang: "en" }] },
  { ref: "mbt", slug: "muhammad-bin-tughluq", kind: "person", label: "Muḥammad bin Tughluq", qid: "Q381830", life: true, link: { to: "@tughlaq", type: "ruled" }, description: "Sultan 1325–1351, who moved the capital to Daulatabad and issued a token coinage.", aliases: [{ label: "Muhammad bin Tughlaq", lang: "en" }, { label: "Mohammad Taghlak", lang: "en", note: "Lane-Poole's spelling" }] },
  { ref: "firuz", slug: "firuz-shah-tughlaq", kind: "person", label: "Fīrūz Shāh Tughluq", qid: "Q455442", life: true, link: { to: "@tughlaq", type: "ruled" }, description: "Sultan 1351–1388, builder of canals and of Fīrūzābād, who brought two Aśokan pillars to Delhi.", aliases: [{ label: "Firuz Shah Tughlaq", lang: "en" }, { label: "Feroz Shah", lang: "en" }] },
  { ref: "ibrahimlodi", slug: "ibrahim-lodi", kind: "person", label: "Ibrāhīm Lodī", qid: "Q381754", life: true, link: { to: "@lodi", type: "ruled" }, description: "The last sultan of Delhi, killed at Panipat in 1526.", aliases: [{ label: "Ibrahim Lodi", lang: "en" }] },
  { ref: "timur", slug: "timur", kind: "person", label: "Tīmūr", qid: "Q8462", life: true, link: { to: "@timurid", type: "ruled" }, description: "Central Asian conqueror who sacked Delhi in 1398.", aliases: [{ label: "Tamerlane", lang: "en" }] },
  { ref: "babur", slug: "babur", kind: "person", label: "Bābur", qid: "Q797848", life: true, link: { to: SULTANATE, type: "related_to", note: "Defeated the last sultan at Panipat, 1526." }, description: "Tīmūr's descendant, who defeated Ibrāhīm Lodī at Panipat in 1526 and founded the Mughal Empire.", aliases: [{ label: "Babur", lang: "en" }] },
  // Writers
  { ref: "minhaj", slug: "minhaj-i-siraj", kind: "person", label: "Minhāj al-Sirāj Jūzjānī", qid: "Q657968", life: true, link: { to: SULTANATE, type: "related_to", note: "Author of the Ṭabaqāt-i Nāṣirī (c. 1260)." }, description: "Court historian at Delhi, author of the Ṭabaqāt-i Nāṣirī (c. 1260).", aliases: [{ label: "Minhaj-i-Siraj", lang: "en" }] },
  { ref: "barani", slug: "ziauddin-barani", kind: "person", label: "Ẓiyāʾ al-Dīn Baranī", qid: "Q207000", life: true, link: { to: SULTANATE, type: "related_to", note: "Author of the Tārīkh-i Fīrūz Shāhī (1357)." }, description: "Courtier and historian, author of the Tārīkh-i Fīrūz Shāhī (1357); a hostile witness to Muḥammad bin Tughluq.", aliases: [{ label: "Ziauddin Barani", lang: "en" }, { label: "Barni", lang: "en", note: "Elliot and Dowson's spelling" }] },
  { ref: "khusrau", slug: "amir-khusrau", kind: "person", label: "Amīr Khusrau", qid: "Q207817", life: true, link: { to: SULTANATE, type: "related_to", note: "Court poet; wrote the Khazāʾin al-Futūḥ on ʿAlāʾ al-Dīn's conquests." }, description: "Poet at the Delhi court, in Persian and Hindavi; his Khazāʾin al-Futūḥ celebrates ʿAlāʾ al-Dīn's conquests.", aliases: [{ label: "Amir Khusrau", lang: "en" }, { label: "Amir Khusro", lang: "en" }] },
  { ref: "ibnbattuta", slug: "ibn-battuta", kind: "person", label: "Ibn Baṭṭūṭa", qid: "Q7331", life: true, link: { to: SULTANATE, type: "related_to", note: "Lived at the court of Muḥammad bin Tughluq, 1334–1342." }, description: "Moroccan traveller and judge who served at the court of Muḥammad bin Tughluq.", aliases: [{ label: "Ibn Battuta", lang: "en" }] },
  { ref: "kabir", slug: "kabir", kind: "person", label: "Kabīr", qid: "Q312551", life: true, link: { to: SULTANATE, type: "related_to", note: "Poet of Benares in the last century of the Sultanate." }, description: "Poet-saint of Benares, a weaver by trade, honoured by Hindus and Muslims alike.", aliases: [{ label: "Kabir", lang: "en" }] },
  { ref: "jayasi", slug: "malik-muhammad-jayasi", kind: "person", label: "Malik Muḥammad Jāyasī", qid: "Q1070772", life: true, link: { to: SULTANATE, type: "related_to", note: "His Padmāvat (1540) tells the story of Padmāvatī and ʿAlāʾ al-Dīn." }, description: "Sufi poet of Awadh, author of the Padmāvat (1540).", aliases: [{ label: "Malik Muhammad Jayasi", lang: "en" }] },
  { ref: "elliot", slug: "henry-miers-elliot", kind: "person", label: "Henry M. Elliot", qid: "Q347064", life: true, link: { to: SULTANATE, type: "related_to", note: "Planned The History of India, as Told by Its Own Historians." }, description: "East India Company official who planned the translations later edited by John Dowson as The History of India, as Told by Its Own Historians (1867–77)." },
  { ref: "eaton", slug: "richard-eaton", kind: "person", label: "Richard M. Eaton", qid: "Q102076348", link: { to: SULTANATE, type: "related_to", note: "Historian of temple desecration and conversion." }, description: "American historian of Islam in South Asia." },
  // Texts
  { ref: "padmavat", slug: "padmavat", kind: "text", label: "Padmāvat", qid: "Q2080955", link: { to: "@jayasi", type: "related_to", note: "Written by Jāyasī, begun in 947 AH (1540)." }, description: "Malik Muḥammad Jāyasī's Awadhi poem of 1540 about Queen Padmāvatī of Chittor and ʿAlāʾ al-Dīn Khaljī.", aliases: [{ label: "Padumawati", lang: "en", note: "Grierson's spelling (1911)" }] },
  // Places and buildings (coordinates: Wikidata)
  { ref: "qutbminar", slug: "qutb-minar", kind: "site", label: "Qutb Minar", qid: "Q187635", geo: true, link: { to: SULTANATE, type: "related_to" }, description: "The 72.5 m tower at Mehrauli, Delhi, begun by Aibak and completed by Iltutmish." },
  { ref: "qutbcomplex", slug: "qutb-complex", kind: "site", label: "Qutb complex and Quwwat al-Islām mosque", qid: "Q1074330", geo: true, link: { to: SULTANATE, type: "related_to" }, description: "The first mosque at Delhi and the buildings around it at Mehrauli; its inscription says it was built with the materials of 27 temples.", aliases: [{ label: "Quwwat-ul-Islam Mosque", lang: "en" }] },
  { ref: "alaidarwaza", slug: "alai-darwaza", kind: "site", label: "ʿAlāʾī Darwāza", qid: "Q61638119", geo: true, link: { to: "@qutbcomplex", type: "located_in" }, description: "The gateway built by ʿAlāʾ al-Dīn Khaljī in 1311 for his extension of the Quwwat al-Islām mosque.", aliases: [{ label: "Alai Darwaza", lang: "en" }] },
  { ref: "siri", slug: "siri-fort", kind: "site", label: "Siri", qid: "Q12069185", geo: true, link: { to: SULTANATE, type: "related_to" }, description: "ʿAlāʾ al-Dīn's fortified capital at Delhi, built during the Mongol wars.", aliases: [{ label: "Siri Fort", lang: "en" }] },
  { ref: "tughlaqabad", slug: "tughlaqabad", kind: "site", label: "Tughlaqabad", qid: "Q2511605", geo: true, link: { to: SULTANATE, type: "related_to" }, description: "The fortified city built by Ghiyāth al-Dīn Tughluq at Delhi in the 1320s." },
  { ref: "daulatabad", slug: "daulatabad-fort", kind: "site", label: "Daulatabad", qid: "Q88667786", geo: true, link: { to: SULTANATE, type: "related_to", note: "Muḥammad bin Tughluq's second capital." }, description: "The fortress of Deogiri in the Deccan, renamed Daulatabad by Muḥammad bin Tughluq, who moved his capital there.", aliases: [{ label: "Deogiri", lang: "en" }, { label: "Deogir", lang: "en", note: "Elliot and Dowson's spelling" }] },
  { ref: "firozkotla", slug: "feroz-shah-kotla", kind: "site", label: "Fīrūz Shāh Kotla", qid: "Q1187568", geo: true, link: { to: SULTANATE, type: "related_to" }, description: "The citadel of Fīrūz Shāh's city of Fīrūzābād at Delhi, where he set up the Aśokan pillar from Topra.", aliases: [{ label: "Feroz Shah Kotla", lang: "en" }] },
  { ref: "toprapillar", slug: "delhi-topra-pillar", kind: "artifact", label: "Delhi–Topra pillar", qid: "Q22806981", link: { to: "@firozkotla", type: "located_in" }, description: "An Aśokan pillar brought from Topra by Fīrūz Shāh and set up at Fīrūzābād." },
  { ref: "chittor", slug: "chittorgarh", kind: "site", label: "Chittor", qid: "Q3695769", geo: true, link: { to: SULTANATE, type: "related_to", note: "Taken by ʿAlāʾ al-Dīn in 1303." }, description: "The hill fortress of the rulers of Mewar, taken by ʿAlāʾ al-Dīn Khaljī in 1303.", aliases: [{ label: "Chittorgarh", lang: "en" }, { label: "Chitor", lang: "en", note: "Elliot and Dowson's spelling" }] },
  { ref: "panipat", slug: "panipat", kind: "place", label: "Panipat", qid: "Q139706", geo: true, link: { to: SULTANATE, type: "related_to" }, description: "Town north of Delhi, where Bābur defeated Ibrāhīm Lodī in 1526." },
  // Events
  { ref: "sack1398", slug: "sack-of-delhi-1398", kind: "event", label: "Sack of Delhi (1398)", qid: "Q123179707", when: { start: ce(1398, 12), basis: "December 1398 (the Malfūẓāt; Wikidata gives 25 December)" }, link: { to: SULTANATE, type: "part_of" }, description: "Tīmūr's capture and sack of Delhi in December 1398." },
  { ref: "panipat1526", slug: "first-battle-of-panipat", kind: "event", label: "First Battle of Panipat", qid: "Q605321", when: { start: ce(1526, 4, 21), basis: "Wikipedia, First Battle of Panipat: 21 April 1526 (Wikidata's 11 May is not used)" }, link: { to: SULTANATE, type: "part_of" }, description: "Bābur's defeat of Ibrāhīm Lodī, which ended the Sultanate." },
];

const TERMS: EntitySpec[] = [
  { ref: "t_sultan", slug: "sultan", kind: "term", label: "sultan", description: "“Power, authority”: the title of a Muslim ruler. At Delhi it was used for the one woman who ruled, Raziya, too." },
  { ref: "t_mamluk", slug: "mamluk", kind: "term", label: "mamlūk", description: "“Owned”: a soldier of slave origin, bought young and trained for war and command. Many rose to high office; some became kings." },
  { ref: "t_jizya", slug: "jizya", kind: "term", label: "jizya", description: "A poll tax on non-Muslim subjects under Islamic law, in return for protection. How, and from whom, it was collected varied from reign to reign." },
  { ref: "t_tanka", slug: "tanka", kind: "term", label: "tanka", description: "The silver (and gold) coin of the Sultanate; Muḥammad bin Tughluq issued brass and copper “tankas” as tokens.", aliases: [{ label: "tankah", lang: "en" }] },
  { ref: "t_token", slug: "token-currency", kind: "term", label: "token currency", description: "Coins whose value is set by decree rather than by the metal in them, like a modern coin or banknote." },
  { ref: "t_iqta", slug: "iqta", kind: "term", label: "iqṭāʿ", description: "An assignment of the revenue of a district to an officer, in return for keeping troops; the main way the Sultanate paid its army and governed its provinces." },
  { ref: "t_sufi", slug: "sufi", kind: "term", label: "Sufi", description: "A Muslim mystic, seeking direct experience of God, often in an order around a master (shaikh); the Chishtī order was strong in the Sultanate." },
  { ref: "t_bhakti", slug: "bhakti", kind: "term", label: "bhakti", description: "Loving devotion to God, expressed in song in the everyday languages rather than through priests and ritual." },
  { ref: "t_desecration", slug: "temple-desecration", kind: "term", label: "temple desecration", description: "Looting, damaging, converting or destroying a temple or its image. Historians count and explain such acts differently." },
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
  const out: ResolvedEntities = { ref: { sultanate: SULTANATE }, ops: [], dependsOn: [], reused: [] };
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
    else if (s.wdWhen && wd?.when) op.when = { edtf: wd.when.edtf, basis: wd.when.basis ?? `Wikidata ${s.qid}` };
    if (s.geo && wd?.coordinates)
      op.geo = {
        geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
        certainty: "approximate",
        note: `Coordinates from Wikidata ${s.qid}.`,
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

const BARANI = "Baranī, Tārīkh-i Fīrūz Shāhī";
const MINHAJ = "Minhāj, Ṭabaqāt-i Nāṣirī";

// A sultanate at Delhi
x("sx_lp_five", "ss_lanepoole", "lanepoole", "Mohammad Ghori's viceroy Aybek was the first of the thirty-four Muslim kings who ruled at Delhi from the beginning of the thirteenth century to the invasion of Babar in 1526. These thirty-four kings fall into five successive dynasties.", { page: "59", label: "Chapter IV, “The Slave Kings”" });
x("sx_wp_periods", "ss_wp_sultanate", "wpSultanate", "Its history is generally divided into five periods: Mamluk (1206–1290), Khalji (1290–1320), Tughlaq (1320–1414), Sayyid (1414–1451), and Lodi (1451–1526).", { section: "Lead" });
x("sx_lp_slavekings", "ss_lanepoole", "lanepoole", "First came the Slave Kings, descended from Aybek the slave of Ghori, or from Aybek's slaves", { page: "59" });
x("sx_wp_mamluk", "ss_wp_mamluk", "wpMamluk", "is the historiographical name or umbrella term used to refer to the three dynasties of Mamluk origin who ruled the Ghurid territories in India and subsequently, the Sultanate of Delhi, from 1206 to 1290", { section: "Lead" });
x("sx_page_aibak", "ss_page", "page", "by Qutbu-d-din Aibak, slave, army commander, and Viceroy of Muizzu-d-din Muhammad Ghori ibn Sam, King of Ghazni", { page: "6" });
x("sx_ed2_purchased", "ss_ed2", "ed2", "Nizamu-d din brought them to Dehli, and Kutbu-d din purchased him and the other slave for one lac of chitals.", { volume: "2", page: "322", label: `${MINHAJ}: Shamsu-d din Altamsh` });
x("sx_ed2_son", "ss_ed2", "ed2", "Kutbu-d din called him his son and kept him near his person.", { volume: "2", page: "322", label: `${MINHAJ}: Shamsu-d din Altamsh` });
x("sx_page_temples", "ss_page", "page", "The materials of 27 temples, on each of which 2,000,000 Deliwals had been spent, were used in (the construction of) this mosque.", { page: "29", label: "Appendix: inscription over the eastern gateway of the Quwwat al-Islām mosque (translation)" });
x("sx_unesco_temples", "ss_unesco_qutb", "unescoQutb", "two mosques, including the Quwwatu'l-Islam, the oldest in northern India, built of materials reused from some 20 Brahman temples", { section: "Brief synthesis" });
x("sx_lee_temple", "ss_lee", "lee", "Before the taking of Dehli it had been a Hindoo temple", { page: "111", label: "Chapter XIV, the great mosque of Delhi" });
x("sx_page_minar", "ss_page", "page", "who carried it (probably) up to the first storey; when the advent of Altamish upon the scene resulted in three further storeys being superimposed upon it, and the minar carried to completion", { page: "19" }, "The OCR reads “A1 tarnish”.");
x("sx_unesco_minar", "ss_unesco_qutb", "unescoQutb", "Built in the early 13th century a few kilometres south of Delhi, the red sandstone tower of Qutb Minar is 72.5 m high", { section: "Brief synthesis" });
// Raziya
x("sx_ed2_heir", "ss_ed2", "ed2", "after my death you will find that there is no one more competent to guide the State than my daughter.", { volume: "2", page: "333", label: `${MINHAJ}: Sultan Raziya` });
x("sx_ed2_raziya_praise", "ss_ed2", "ed2", "Sultan Raziya was a great monarch. She was wise, just, and generous, a benefactor to her kingdom, a dispenser of justice, the protector of her subjects, and the leader of her armies.", { volume: "2", page: "332", label: `${MINHAJ}: Sultan Raziya` });
x("sx_ed2_raziya_sex", "ss_ed2", "ed2", "She was endowed with all the qualities befitting a king, but she was not born of the right sex, and so in the estimation of men all these virtues were worthless.", { volume: "2", page: "332", label: `${MINHAJ}: Sultan Raziya` });
x("sx_ed2_sultan", "ss_ed2", "ed2", "The queen is always called “Sultan” and “Badshah,” not Sultana", { volume: "2", page: "332", label: "Editor's note" });
// ʿAlāʾ al-Dīn
x("sx_ed3_forts", "ss_ed3", "ed3", "He ordered the fort of Dehli to be repaired, and he also ordered the restoration of the old forts which lay in the track of the Mughals.", { volume: "3", page: "191", label: BARANI });
x("sx_ed3_army", "ss_ed3", "ed3", "If the necessaries of life could be bought at a low rate, then the idea which your Majesty has entertained of maintaining a large army at a small expense might be carried out", { volume: "3", page: "192", label: BARANI });
x("sx_ed3_regulations", "ss_ed3", "ed3", "So some regulations were issued, which kept down the price for some years.", { volume: "3", page: "192", label: BARANI });
x("sx_ed3_wonder", "ss_ed3", "ed3", "This unvarying price of grain in the markets was looked upon as one of the wonders of the time.", { volume: "3", page: "193", label: BARANI });
x("sx_ed3_chitor", "ss_ed3", "ed3", "The fort was taken on Monday, the 11th of Muharram, a.h. 703 (August, 1303 a.d.).", { volume: "3", page: "77", label: "Amīr Khusrau, Khazāʾin al-Futūḥ (Taʾrīkh-i ʿAlāʾī), as abstracted by Elliot and Dowson" });
x("sx_ed3_chitor_massacre", "ss_ed3", "ed3", "After ordering a massacre of thirty thousand Hindus, he bestowed the Government of Chitor upon his son, Khizr Khan", { volume: "3", page: "77", label: "Amīr Khusrau, Khazāʾin al-Futūḥ (Taʾrīkh-i ʿAlāʾī)" });
x("sx_page_alai", "ss_page", "page", "his erection (actually extension) of the mosque in the year 1311 A. D.", { page: "15", label: "The ʿAlāʾī Darwāza" });
x("sx_unesco_alai", "ss_unesco_qutb", "unescoQutb", "the magnificent Alai-Darwaza Gate, the masterpiece of Indo-Muslim art (built in 1311)", { section: "Brief synthesis" });
x("sx_ed3_unfair", "ss_ed3", "ed3", "is an unfair narrator. Several of the most important events of the reigns he celebrated have been altogether omitted, or slurred over as of no consequence.", { volume: "3", page: "95", label: "Elliot and Dowson's introduction to Baranī" });
// Muḥammad bin Tughluq
x("sx_ed3_ruin", "ss_ed3", "ed3", "So complete was the ruin, that not a cat or a dog was left among the buildings of the city, in its palaces or in its suburbs.", { volume: "3", page: "239", label: BARANI });
x("sx_ed3_forced", "ss_ed3", "ed3", "Troops of the natives, with their families and dependents, wives and children, men-servants and maid-servants, were forced to remove.", { volume: "3", page: "239", label: BARANI });
x("sx_lee_desert", "ss_lee", "lee", "When I entered Dehli it was almost a desert. Its buildings were very few", { page: "145" }, "Poor OCR (“Uehh”); the match is approximate.");
x("sx_ed3_hindus", "ss_ed3", "ed3", "augmented the pride and prosperity of all the Hindus. This was the issue of copper money.", { volume: "3", page: "240", label: BARANI });
x("sx_ed3_mint", "ss_ed3", "ed3", "The promulgation of this edict turned the house of every Hindu into a mint, and the Hindus of the various provinces coined krors and lacs of copper coins.", { volume: "3", page: "240", label: BARANI });
x("sx_ed3_repealed", "ss_ed3", "ed3", "the Sultan repealed his edict, and in great wrath he proclaimed that whoever possessed copper coins should bring them to the treasury, and receive the old gold coins in exchange.", { volume: "3", page: "240", label: BARANI });
x("sx_thomas_forced", "ss_thomas", "thomas", "his attempt to introduce a forced currency of copper tokens", { page: "4" });
x("sx_thomas_legend", "ss_thomas", "thomas", "He who obeys the Sultan, truly, he obeys God.", { page: "249", label: "Coin no. 196: brass, Daulatabad, AH 731–732" }, "The OCR reads “Me who obeys”.");
x("sx_lp_ideas", "ss_lanepoole", "lanepoole", "Mohammad Taghlak was the most striking figure in mediaeval India. He was a man with ideas far beyond his age.", { page: "124", label: "Chapter VI, “A Man of Ideas”" });
x("sx_lp_failure", "ss_lanepoole", "lanepoole", "Hence with the best intentions, excellent ideas, but no balance or patience, no sense of proportion, Mohammad Taghlak was a transcendent failure.", { page: "125" });
x("sx_lp_ascendancy", "ss_lanepoole", "lanepoole", "Thenceforward, until the days of the Moghul empire, Delhi never regained her old ascendancy.", { page: "160" });
x("sx_lp_chiefs", "ss_lanepoole", "lanepoole", "the Hindu chiefs, who were now independent at Etawa, Gwaliar, and many other strongholds", { page: "160" });
x("sx_lp_panipat", "ss_lanepoole", "lanepoole", "The decisive battle was fought on April 21, 1526, on the plain of Panipat", { page: "200" });
x("sx_lp_prayer", "ss_lanepoole", "lanepoole", "the public prayer was said in the mosque of the capital in the name of the new Emperor", { page: "203" });
x("sx_wp_mad", "ss_wp_mbt", "wpMbt", "also known by his epithets, The Eccentric Prince, and The Mad Sultan", { section: "Lead" });
// Fīrūz Shāh
x("sx_ed3_pillars", "ss_ed3", "ed3", "These columns had stood in those places from the days of the Pandavas, but had never attracted the attention of any of the kings who sat upon the throne of Dehli, till Sultan Firoz noticed them, and, with great exertion, brought them away.", { volume: "3", page: "350", label: "ʿAfīf, Tārīkh-i Fīrūz Shāhī: transport of the stone obelisks" });
x("sx_ed3_unread", "ss_ed3", "ed3", "On the base of the obelisk there were engraved several lines of writing in Hindi characters. Many Brahmans and Hindu devotees were invited to read them, but no one was able.", { volume: "3", page: "352", label: "ʿAfīf, Tārīkh-i Fīrūz Shāhī" });
x("sx_ed3_jizya", "ss_ed3", "ed3", "The Jizya, or poll tax, had never been levied from Brahmans; they had been held excused, in former reigns.", { volume: "3", page: "365", label: "ʿAfīf, Tārīkh-i Fīrūz Shāhī: levy of the jizya from the Brahmans" });
x("sx_ed3_firuz_destroyed", "ss_ed3", "ed3", "I forbad the infliction of any severe punishments on the Hindus in general, but I destroyed their idol temples, and instead thereof raised mosques.", { volume: "3", page: "381", label: "Fīrūz Shāh, Futūḥāt-i Fīrūz Shāhī" });
x("sx_ed3_firuz_new", "ss_ed3", "ed3", "These people now erected new idol temples in the city and the environs in opposition to the Law of the Prophet which declares that such temples are not to be tolerated. Under Divine guidance I destroyed these edifices", { volume: "3", page: "380", label: "Fīrūz Shāh, Futūḥāt-i Fīrūz Shāhī" });
// Tīmūr
x("sx_ed3_timur_army", "ss_ed3", "ed3", "When morning broke on the Friday, all my army, no longer under control, went off to the city and thought of nothing but killing, plundering, and making prisoners.", { volume: "3", page: "446", label: "Malfūẓāt-i Tīmūrī" });
x("sx_ed3_timur_quarters", "ss_ed3", "ed3", "Excepting the quarter of the saiyids, the 'ulama, and the other Musulmans, the whole city was sacked.", { volume: "3", page: "446", label: "Malfūẓāt-i Tīmūrī" });
x("sx_ed3_timur_will", "ss_ed3", "ed3", "Although I was desirous of sparing them I could not succeed, for it was the will of God that this calamity should fall upon the city.", { volume: "3", page: "446", label: "Malfūẓāt-i Tīmūrī" });
x("sx_ed3_artisans", "ss_ed3", "ed3", "I ordered that all the artisans and clever mechanics, who were masters of their respective crafts, should be picked out from among the prisoners and set aside", { volume: "3", page: "447", label: "Malfūẓāt-i Tīmūrī" });
x("sx_wp_1398", "ss_wp_sultanate", "wpSultanate", "triggered by the Central Asian king Timur's devastating raid on Delhi in 1398, coinciding with the re-emergence of rival Hindu powers such as Vijayanagara Empire and Kingdom of Mewar, and new Muslim sultanates such as the Bengal and Bahmani sultanates asserting independence", { section: "Lead" });
x("sx_wp_panipat", "ss_wp_panipat", "wpPanipat", "The First Battle of Panipat, on 21 April 1526 was fought between the invading forces of Babur against Ibrahim Khan Lodi, the Sultan of Delhi", { section: "Lead" });
x("sx_wp_mughal", "ss_wp_panipat", "wpPanipat", "The victory marked the beginning of Mughal rule in India.", { section: "Lead" });
// The south
x("sx_sewell_1336", "ss_sewell", "sewell", "In the year 1336 A.D., during the reign of Edward III. of England, there occurred in India an event which almost instantaneously changed the political condition of the entire south.", { page: "1" });
x("sx_sewell_found", "ss_sewell", "sewell", "This event was the foundation of the city and kingdom of Vijayanagar.", { page: "1" });
x("sx_sewell_1347", "ss_sewell", "sewell", "Sick of the tyranny and excesses of Muhammad Taghlaq, the Dakhan revolted in 1347, and the independent kingdom of the Bahmanis was for a time firmly established.", { page: "8" });
// Kabīr
x("sx_kabir_benares", "ss_kabir", "kabir", "In fifteenth-century Benares the syncretistic tendencies of Bhakti religion had reached full development. Sufis and Brahmans appear to have met in disputation", { page: "10", label: "Introduction (Evelyn Underhill)" });
x("sx_kabir_weaver", "ss_kabir", "kabir", "the most probable tale is that which represents him as the actual or adopted child of a Mohammedan weaver of Benares", { page: "10", label: "Introduction (Evelyn Underhill)" });
x("sx_kabir_song", "ss_kabir", "kabir", "Hari is in the East: Allah is in the West. Look within your heart, for there you will find both Karim and Ram", { page: "112", label: "Song LXIX" });
// Padmāvatī
x("sx_jayasi_947", "ss_jayasi", "jayasi", "It was the year 947 (of the Hijra), when the poet began to tell this tale in words. Of Ceylon and Queen Padmavati", { page: "43", label: "Canto 24" });
x("sx_wp_padmini", "ss_wp_padmini", "wpPadmini", "Several medieval texts mention her, although these versions are disparate and many modern historians question their overall authenticity.", { section: "Lead" });
// How the chronicles were read
x("sx_ed1_preface", "ss_ed1", "ed1", "They will make our native subjects more sensible of the immense advantages accruing to them under the mildness and equity of our rule.", { volume: "1", page: "xxii", label: "Sir H. M. Elliot's original preface" });
x("sx_eaton_elliot", "ss_eaton", "eaton", "But Elliot, keen to contrast what he understood as the justice and efficiency of British rule with the cruelty and despotism of the Muslim rulers who had preceded that rule, was anything but sympathetic to the “Muhammadan” period of Indian history.", { page: "62" });
x("sx_eaton_eighty", "ss_eaton", "eaton", "one may identify eighty instances of temple desecration whose historicity appears reasonably certain. Although this figure falls well short of the 60,000 claimed by some Hindu nationalists", { page: "66" });
x("sx_eaton_state", "ss_eaton", "eaton", "acts of temple desecration were nearly invariably carried out by military officers or ruling authorities", { page: "66" });
x("sx_eaton_royal", "ss_eaton", "eaton", "Temples that were not so identified, or temples formerly so identified but abandoned by their royal patrons and thereby rendered politically irrelevant, were normally left unharmed.", { page: "63" });
x("sx_eaton_later", "ss_eaton", "eaton", "later Indo-Muslim chroniclers, seeking to glorify the religious zeal of earlier Muslim rulers, sometimes attributed acts of temple desecration to such rulers even when no contemporary evidence supports the claims", { page: "66" });
x("sx_wp_goel", "ss_wp_goel", "wpGoel", "The first volume includes a list of 2,000 mosques that the authors claim had been built on top of the location of Hindu temples, based primarily on the books of Muslim historians of the period or inscriptions found on mosques.", { section: "Contents" });
x("sx_wp_goel_critique", "ss_wp_goel", "wpGoel", "she cautioned that his estimates were \"largely inflated\" as a result of his uncritical reliance upon Perso-Arabic chronicles and inscriptions", { section: "Reception" });

// ---------------------------------------------------------------- content

export function sultanateOps(s: Snaps, E: Record<string, string>): ChangeOpInput[] {
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
    csl: { type: "entry-encyclopedia", title: s[k].title, "container-title": "Wikipedia", issued: { "date-parts": [[2026]] }, ...(s[k].url ? { URL: s[k].url! } : {}) },
    identifiers: { ...(s[k].url ? { url: s[k].url! } : {}), wikipedia: { lang: "en", title: s[k].title, revisionId: s[k].revisionId! } },
    license: { status: "open", spdx: "CC-BY-SA-4.0" },
  });
  const ia = (id: string) => ({ ia: id, url: `https://archive.org/details/${id}` });
  const ED_NOTE =
    "Extracts, not whole works, translated for Sir Henry Elliot and edited by John Dowson; some by unnamed munshis. Elliot's preface states that he meant the selection to show the misrule of “Muhammadan” kings, so the selection is itself a source to examine.";
  const ed = (ref: string, vol: number, year: number, id: string, extra: string): ChangeOpInput => ({
    op: "create_source",
    ref,
    kind: "book",
    tier: "primary",
    csl: {
      type: "book",
      title: "The History of India, as Told by Its Own Historians: The Muhammadan Period",
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

  const ops: ChangeOpInput[] = [
    ed("ss_ed1", 1, 1867, "historyofindiaas01elli", "Vol. I, with Elliot's original preface."),
    ed("ss_ed2", 2, 1869, "historyofindiaas02elli", "Vol. II: includes Minhāj's Ṭabaqāt-i Nāṣirī."),
    ed("ss_ed3", 3, 1871, "historyofindiaas03elli", "Vol. III: Baranī, Amīr Khusrau's Khazāʾin al-Futūḥ, ʿAfīf, Fīrūz Shāh's Futūḥāt and the Malfūẓāt-i Tīmūrī. The Malfūẓāt is presented as Tīmūr's own memoir; its authenticity is doubted."),
    {
      op: "create_source",
      ref: "ss_lee",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Travels of Ibn Batūta", translator: [{ family: "Lee", given: "Samuel" }], issued: { "date-parts": [[1829]] }, publisher: "Oriental Translation Committee", "publisher-place": "London" },
      identifiers: ia("bub_gb_22IbAQAAMAAJ"),
      license: { status: "public_domain", note: "Published 1829; Lee died 1852." },
      lenses: ["primary_source"],
      note: "Translated from an Arabic abridgement, so the India chapters are short. The Google scan's OCR is poor in places. H. A. R. Gibb's fuller translation (1929) is not used: it is in copyright in India and the UK.",
    },
    {
      op: "create_source",
      ref: "ss_thomas",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Chronicles of the Pathan Kings of Dehli, Illustrated by Coins, Inscriptions, and Other Antiquarian Remains", author: [{ family: "Thomas", given: "Edward" }], issued: { "date-parts": [[1871]] }, publisher: "Trübner and Co.", "publisher-place": "London" },
      identifiers: ia("in.ernet.dli.2015.282082"),
      license: { status: "public_domain", note: "Published 1871; Thomas died 1886." },
      lenses: ["archaeological"],
      note: "A catalogue of the Sultanate's coins with their legends: physical evidence independent of the chronicles.",
    },
    {
      op: "create_source",
      ref: "ss_lanepoole",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Mediaeval India under Mohammedan Rule (A.D. 712–1764)", author: [{ family: "Lane-Poole", given: "Stanley" }], issued: { "date-parts": [[1903]] }, publisher: "G. P. Putnam's Sons", "publisher-place": "New York" },
      identifiers: ia("cu31924024066668"),
      license: { status: "public_domain", note: "Published 1903 in the US; Lane-Poole died 1931." },
      lenses: ["colonial_orientalist"],
      note: "A popular history of its time.",
    },
    {
      op: "create_source",
      ref: "ss_sewell",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "A Forgotten Empire (Vijayanagar): A Contribution to the History of India", author: [{ family: "Sewell", given: "Robert" }], issued: { "date-parts": [[1900]] }, publisher: "Swan Sonnenschein", "publisher-place": "London" },
      identifiers: ia("dli.ministry.02147"),
      license: { status: "public_domain", note: "Published 1900; Sewell died 1925." },
      lenses: ["colonial_orientalist"],
    },
    {
      op: "create_source",
      ref: "ss_page",
      kind: "report",
      tier: "secondary",
      csl: { type: "report", title: "An Historical Memoir on the Qutb, Delhi", author: [{ family: "Page", given: "J. A." }], "collection-title": "Memoirs of the Archaeological Survey of India", "collection-number": 22, issued: { "date-parts": [[1926]] }, publisher: "Government of India, Central Publication Branch", "publisher-place": "Calcutta" },
      identifiers: ia("in.gov.ignca.41873"),
      license: { status: "public_domain", note: "Government of India publication of 1926: public domain in India and in the US (published before 1931)." },
      lenses: ["archaeological"],
      note: "Includes translations of the Qutb inscriptions, a primary source cited here through Page.",
    },
    {
      op: "create_source",
      ref: "ss_jayasi",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "The Padumāwati of Malik Muḥammad Jaisī", editor: [{ family: "Grierson", given: "G. A." }, { family: "Dvivedi", given: "Sudhākara" }], issued: { "date-parts": [[1911]] }, publisher: "Asiatic Society of Bengal", "publisher-place": "Calcutta", "collection-title": "Bibliotheca Indica" },
      identifiers: ia("padumawatiofmali00maliuoft"),
      license: { status: "public_domain", note: "Published 1911; Grierson died 1941, Dvivedi 1910. Public domain in the US; Grierson's translation is public domain in India (life + 60)." },
      lenses: ["primary_source"],
      note: "Text and translation of Jāyasī's Padmāvat (1540), cantos 1–287.",
    },
    {
      op: "create_source",
      ref: "ss_kabir",
      kind: "edition",
      tier: "primary",
      csl: { type: "book", title: "Songs of Kabir", translator: [{ family: "Tagore", given: "Rabindranath" }], editor: [{ family: "Underhill", given: "Evelyn" }], issued: { "date-parts": [[1915]] }, publisher: "Macmillan", "publisher-place": "New York" },
      identifiers: ia("cu31924023165248"),
      license: { status: "public_domain", note: "Published 1915 in the US; Tagore died 1941, Underhill 1941." },
      lenses: ["primary_source"],
      note: "A free English rendering of songs attributed to Kabīr, with Underhill's introduction. Which songs are Kabīr's own is debated.",
    },
    {
      op: "create_source",
      ref: "ss_eaton",
      kind: "article",
      tier: "secondary",
      csl: { type: "article-magazine", title: "Temple desecration in pre-modern India", author: [{ family: "Eaton", given: "Richard M." }], "container-title": "Frontline", volume: "17", issue: "25", page: "62-70", issued: { "date-parts": [[2000, 12, 22]] } },
      identifiers: { url: EATON_URL },
      license: { status: "copyrighted", note: "Quoted briefly. The snapshot holds only the passages quoted here, pasted from the PDF (see the snapshot's note)." },
      lenses: ["mainstream_academic"],
      note: "Part 1 of a two-part essay. Its count and its explanation are disputed by Hindu-nationalist writers and others.",
    },
    {
      op: "create_source",
      ref: "ss_unesco_qutb",
      kind: "webpage",
      tier: "tertiary",
      csl: { type: "webpage", title: "Qutb Minar and its Monuments, Delhi", "container-title": "UNESCO World Heritage Centre", issued: { "date-parts": [[1993]] }, URL: CAPTURES.unescoQutb.url },
      identifiers: { url: CAPTURES.unescoQutb.url },
      license: { status: "open", spdx: "CC-BY-SA-3.0-IGO" },
    },
    wpSource("ss_wp_sultanate", "wpSultanate"),
    wpSource("ss_wp_mamluk", "wpMamluk"),
    wpSource("ss_wp_mbt", "wpMbt"),
    wpSource("ss_wp_padmini", "wpPadmini"),
    wpSource("ss_wp_goel", "wpGoel"),
    wpSource("ss_wp_panipat", "wpPanipat"),
  ];

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
  const sultanate = e("sultanate");

  // 1. Founding
  c("d_dynasties", {
    text: "From 1206 to 1526 Delhi was ruled by sultans of five successive dynasties: the Mamluks, Khaljis, Tughluqs, Sayyids and Lodis.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1206), end: ce(1526) },
    themes: ["polity", "overview"],
    entities: [{ entity: sultanate }, { entity: e("mamluk"), role: "mention" }, { entity: e("khalji"), role: "mention" }, { entity: e("tughlaq"), role: "mention" }, { entity: e("sayyid"), role: "mention" }, { entity: e("lodi"), role: "mention" }],
    foundVia: ["wpSultanate"],
    learning: { prompt: "Name the five dynasties that ruled Delhi from 1206 to 1526, in order.", answer: "Mamluk, Khalji, Tughluq, Sayyid, Lodi (1206–1526)." },
  });
  c("d_aibak", {
    text: "The first sultan at Delhi, Quṭb al-Dīn Aibak, was a Turkish slave who had risen to command the armies of Muḥammad of Ghor.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1206) },
    themes: ["polity"],
    entities: [{ entity: e("aibak") }],
  });
  c("d_iltutmish", {
    text: "Iltutmish, who succeeded him, had also been bought as a slave: Aibak purchased him in Delhi and treated him as a son.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("iltutmish") }, { entity: e("aibak"), role: "mention" }],
  });
  c("d_slave_kings", {
    text: "The “Slave dynasty” is a modern umbrella name for three ruling families of slave origin, 1206–1290; not every ruler was a slave.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1206), end: ce(1290) },
    themes: ["polity", "historiography"],
    entities: [{ entity: e("mamluk") }],
    foundVia: ["wpMamluk"],
    learning: { prompt: "Was the “Slave dynasty” one family of slaves?", answer: "No: three families of slave origin, 1206–1290, under a modern umbrella name." },
  });
  c("d_mosque_temples", {
    text: "The inscription on Delhi's first mosque, the Quwwat al-Islām, says it was built with the materials of 27 temples.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1192), basis: "The inscription's date, 1191–92 as Page reads it" },
    themes: ["religion", "infrastructure"],
    lenses: ["primary_source"],
    entities: [{ entity: e("qutbcomplex") }],
    learning: { prompt: "What does the inscription of Delhi's first mosque say it was built with?", answer: "The materials of 27 temples." },
  });
  c("d_minar", {
    text: "The Qutb Minar, 72.5 m tall, was begun by Aibak, who took it up to its first storey; Iltutmish added three more and completed it.",
    kind: "fact",
    assessment: "supported",
    themes: ["infrastructure", "culture"],
    lenses: ["archaeological"],
    entities: [{ entity: e("qutbminar") }, { entity: e("aibak"), role: "mention" }, { entity: e("iltutmish"), role: "mention" }],
  });

  // 2. Raziya
  c("d_raziya_heir", {
    text: "Iltutmish named his daughter Raziya as his heir, saying none of his sons was fit to rule and no one was more competent than she.",
    kind: "fact",
    assessment: "supported",
    themes: ["polity", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("raziya") }, { entity: e("iltutmish"), role: "mention" }],
  });
  c("d_raziya_minhaj", {
    text: "The chronicler Minhāj praised Raziya as wise, just and generous, a leader of armies, but wrote that because she was a woman, in men's eyes all these virtues were worthless.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["polity", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("raziya") }, { entity: e("minhaj"), role: "mention" }],
    learning: { prompt: "What did Minhāj say about Raziya?", answer: "That she had every royal virtue, but as a woman these were worthless in men's eyes." },
  });
  c("d_raziya_sultan", {
    text: "Raziya ruled with the title “Sultan”, not “Sultana”.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1236), end: ce(1240) },
    themes: ["polity"],
    lenses: ["philological"],
    entities: [{ entity: e("raziya") }],
  });

  // 3. ʿAlāʾ al-Dīn
  c("d_mongol_forts", {
    text: "After a dangerous Mongol attack, ʿAlāʾ al-Dīn Khaljī built a new capital at Siri, repaired the forts on the Mongols' route and garrisoned the frontier.",
    kind: "fact",
    assessment: "supported",
    themes: ["war", "infrastructure"],
    lenses: ["primary_source"],
    entities: [{ entity: e("alauddin") }, { entity: e("siri"), role: "place" }, { entity: e("chagatai"), role: "mention" }],
  });
  c("d_prices", {
    text: "To pay a large army against the Mongols at low cost, ʿAlāʾ al-Dīn fixed the prices of grain and other goods in the Delhi markets; Baranī says they did not change for the rest of his reign.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Baranī's account, written decades later; his claim that prices never rose is his own.",
    themes: ["economy", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("alauddin") }, { entity: e("barani"), role: "mention" }],
    learning: { prompt: "Why did ʿAlāʾ al-Dīn fix market prices, according to Baranī?", answer: "So that he could keep a large army against the Mongols on low pay." },
  });
  c("d_chittor", {
    text: "ʿAlāʾ al-Dīn took Chittor in August 1303; his court poet Amīr Khusrau, who was there, records the capture and a massacre, but no queen named Padmāvatī.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From Elliot and Dowson's abstract of Khusrau's work, not a full translation; the absence of a queen is in that abstract.",
    when: { start: ce(1303, 8) },
    themes: ["war", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("chittor"), role: "place" }, { entity: e("alauddin") }, { entity: e("khusrau"), role: "mention" }],
  });
  c("d_alai", {
    text: "In 1311 ʿAlāʾ al-Dīn extended the Quwwat al-Islām mosque and built its great gateway, the ʿAlāʾī Darwāza.",
    kind: "fact",
    assessment: "well_supported",
    when: { start: ce(1311) },
    themes: ["infrastructure", "culture"],
    entities: [{ entity: e("alaidarwaza") }, { entity: e("alauddin"), role: "mention" }],
  });
  c("d_barani_bias", {
    text: "Elliot and Dowson themselves called Baranī an unfair narrator, who left out or slurred over important events of the reigns he wrote about.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "sources"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("barani") }],
  });

  // 4. Muḥammad bin Tughluq
  c("d_daulatabad", {
    text: "Muḥammad bin Tughluq made Daulatabad, in the Deccan, his capital and forced the people of Delhi to move there; Baranī says Delhi was left so empty that not a cat or a dog remained.",
    kind: "fact",
    assessment: "well_supported",
    assessmentNote: "The move is certain; Baranī's “not a cat or a dog” is a hostile writer's rhetoric. Ibn Baṭṭūṭa, who arrived soon after, found the city almost deserted.",
    themes: ["polity", "society"],
    lenses: ["primary_source"],
    entities: [{ entity: e("mbt") }, { entity: e("daulatabad"), role: "place" }, { entity: e("barani"), role: "mention" }, { entity: e("ibnbattuta"), role: "mention" }],
    learning: { prompt: "What happened to Delhi when Muḥammad bin Tughluq moved his capital?", answer: "Its people were forced to move to Daulatabad, and the city was left almost empty." },
  });
  c("d_tokens", {
    text: "Muḥammad bin Tughluq issued copper and brass coins to pass at the value of silver; they were forged on a large scale, and he withdrew them, exchanging them for good coin.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["economy", "governance"],
    lenses: ["primary_source", "archaeological"],
    entities: [{ entity: e("mbt") }],
    learning: { prompt: "What was Muḥammad bin Tughluq's token currency, and what happened to it?", answer: "Copper and brass coins decreed to pass as silver; forged on a large scale, then withdrawn and exchanged." },
  });
  c("d_token_legend", {
    text: "His brass tokens survive: one struck at Daulatabad in AH 731–732 bears the words “He who obeys the Sultan, truly, he obeys God.”",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1330), end: ce(1332), basis: "AH 731–732 (1330–1332)" },
    themes: ["economy", "sources"],
    lenses: ["archaeological"],
    entities: [{ entity: e("mbt") }, { entity: e("daulatabad"), role: "place" }],
  });
  c("d_barani_hindus", {
    text: "Baranī blamed the token coinage for making the Hindus rich and bold, saying it turned every Hindu house into a mint.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Baranī's view, which tells us about him as much as about the coinage.",
    themes: ["historiography", "economy"],
    lenses: ["primary_source"],
    entities: [{ entity: e("barani") }, { entity: e("mbt"), role: "mention" }],
  });
  c("d_lanepoole", {
    text: "Stanley Lane-Poole (1903) judged Muḥammad bin Tughluq a man with ideas far beyond his age, whose impatience and cruelty made him a “transcendent failure”.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1903) },
    themes: ["historiography"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("mbt") }],
  });

  // 5. Fīrūz Shāh
  c("d_pillars", {
    text: "Fīrūz Shāh had two ancient stone pillars brought to Delhi from Topra and Meerut; no one at his court could read their inscriptions.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The pillars carry the edicts of the Maurya emperor Aśoka; how they were read again in the nineteenth century is told on the Maurya Empire page.",
    themes: ["culture", "sources"],
    lenses: ["primary_source"],
    entities: [{ entity: e("firuz") }, { entity: e("toprapillar") }, { entity: e("firozkotla"), role: "place" }],
    learning: { prompt: "What did Fīrūz Shāh bring to Delhi that no one could read?", answer: "Two ancient stone pillars, from Topra and Meerut." },
  });
  c("d_jizya", {
    text: "Fīrūz Shāh made the Brahmans pay the jizya, from which earlier rulers had excused them.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("firuz") }],
  });
  c("d_firuz_temples", {
    text: "In his own account of his reign, Fīrūz Shāh boasts of destroying newly built temples and putting their leaders to death, while forbidding severe punishment of Hindus in general.",
    kind: "fact",
    assessment: "supported",
    themes: ["religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("firuz") }],
  });

  // 6. Tīmūr
  c("d_timur_sack", {
    text: "Tīmūr's army sacked Delhi in December 1398: his memoir says his soldiers ran out of control, that each took dozens of prisoners, and that only the Muslim quarters were spared.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From the Malfūẓāt, presented as Tīmūr's own memoir, whose authenticity is doubted; it is at least the account his court accepted.",
    when: { start: ce(1398, 12) },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("sack1398") }, { entity: e("timur") }],
    learning: { prompt: "What happened in Delhi in December 1398?", answer: "Tīmūr's army sacked the city; only the Muslim quarters were spared." },
  });
  c("d_timur_god", {
    text: "The memoir has Tīmūr say he wished to spare the city but could not, for its fate was the will of God; he then had its craftsmen picked out and taken away.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["war", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("timur") }, { entity: e("sack1398"), role: "mention" }],
  });
  c("d_after_1398", {
    text: "Tīmūr's raid broke the Sultanate's power: rival kingdoms and sultanates, among them Vijayanagara, Mewar, Bengal and the Bahmanis, rose or asserted their independence.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: ce(1398) },
    themes: ["polity"],
    entities: [{ entity: sultanate }, { entity: e("vijayanagara"), role: "mention" }, { entity: e("bahmani"), role: "mention" }],
    foundVia: ["wpSultanate"],
  });
  c("d_panipat", {
    text: "On 21 April 1526 Bābur defeated the last sultan, Ibrāhīm Lodī, at Panipat; the victory began Mughal rule in India.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1526, 4, 21) },
    themes: ["war", "polity"],
    entities: [{ entity: e("panipat1526") }, { entity: e("babur") }, { entity: e("ibrahimlodi") }, { entity: e("panipat"), role: "place" }],
    foundVia: ["wpPanipat"],
  });

  // 7. The south
  c("d_vijayanagara", {
    text: "In 1336 the city and kingdom of Vijayanagara were founded in the south, which Robert Sewell called the event that changed the whole political condition of south India.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "1336 is the traditional date, which Sewell follows.",
    when: { start: ce(1336) },
    themes: ["polity"],
    entities: [{ entity: e("vijayanagara") }],
  });
  c("d_bahmani", {
    text: "In 1347 the Deccan revolted against Muḥammad bin Tughluq, and the independent Bahmani kingdom was founded.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1347) },
    themes: ["polity"],
    entities: [{ entity: e("bahmani") }, { entity: e("mbt"), role: "mention" }],
  });

  // 8. Kabīr
  c("d_kabir", {
    text: "Kabīr, a poet of fifteenth-century Benares raised in a Muslim weaver's family, sang of one God beyond temple and mosque, in a city where Sufis and Brahmans met in debate.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "Underhill's introduction (1915) repeats the traditions about Kabīr's life, which are uncertain.",
    themes: ["religion", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("kabir") }],
    learning: { prompt: "Who was Kabīr?", answer: "A poet of fifteenth-century Benares, raised in a Muslim weaver's family, who sang of one God beyond temple and mosque." },
  });

  // 9. Padmāvatī
  c("d_padmavat", {
    text: "The story of Queen Padmāvatī and ʿAlāʾ al-Dīn comes from the Padmāvat, a poem Malik Muḥammad Jāyasī began in AH 947 (1540), more than two centuries after the siege.",
    kind: "fact",
    assessment: "supported",
    when: { start: ce(1540) },
    themes: ["culture", "historiography"],
    lenses: ["primary_source"],
    entities: [{ entity: e("padmavat") }, { entity: e("jayasi") }],
    foundVia: ["wpPadmini"],
    learning: { prompt: "When was the story of Padmāvatī first written down?", answer: "In Jāyasī's Padmāvat, begun in AH 947 (1540), more than two centuries after the siege." },
  });

  // 10. Reading the chronicles: temples
  c("d_elliot_aim", {
    text: "Henry Elliot, whose translations remain the main English route to these chronicles, wrote that they would make Indians appreciate “the mildness and equity” of British rule.",
    kind: "fact",
    assessment: "well_supported",
    themes: ["historiography", "sources"],
    lenses: ["colonial_orientalist", "primary_source"],
    entities: [{ entity: e("elliot") }],
    learning: { prompt: "Why did Henry Elliot publish his translations of the chronicles, by his own account?", answer: "To make Indians appreciate “the mildness and equity” of British rule." },
  });
  c("d_eaton_count", {
    text: "Richard Eaton (2000), using only contemporary or near-contemporary inscriptions and texts, counted about 80 temple desecrations whose historicity is reasonably certain, 1192–1729, against claims of 60,000.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "A minimum from firm evidence, as Eaton says himself: it cannot count what was not recorded. Critics say it omits cases, for example outside present-day India.",
    when: { start: ce(2000) },
    themes: ["religion", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("eaton") }],
  });
  c("d_eaton_political", {
    text: "Eaton argues that desecration was carried out by the state, and targeted temples tied to the authority of defeated kings; temples without such ties were usually left alone.",
    kind: "interpretation",
    assessment: "contested",
    themes: ["religion", "polity"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("eaton") }],
  });
  c("d_eaton_later", {
    text: "Eaton also notes that later chroniclers, to glorify earlier rulers' zeal, sometimes credited them with desecrations no contemporary source records.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "sources"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("eaton") }],
  });
  c("d_goel", {
    text: "Sita Ram Goel and his co-authors (1990) listed about 2,000 mosques they claimed were built on temple sites, drawing mainly on Muslim chronicles and inscriptions.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "Historians such as Cynthia Talbot and Romila Thapar have called the figures inflated, because the chronicles' boasts are taken at face value.",
    when: { start: ce(1990) },
    themes: ["religion", "historiography"],
    lenses: ["nationalist"],
    entities: [{ entity: sultanate, role: "mention" }],
    foundVia: ["wpGoel"],
  });

  // Misconceptions
  c("m_slave_one", {
    text: "The “Slave dynasty” was one dynasty of slaves.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "Three families of slave origin, 1206–1290; the founders of the first two had been slaves, but their sons and daughters, such as Raziya, were born free.",
    themes: ["polity"],
    lenses: ["popular"],
    entities: [{ entity: e("mamluk") }],
  });
  c("m_elliot_neutral", {
    text: "Elliot and Dowson's History of India, as Told by Its Own Historians shows neutrally what medieval Muslim historians wrote.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "It is a selection of extracts, made by an editor who said he meant it to show the misrule of “Muhammadan” kings. The extracts are real, but what was chosen, and how it was framed, are part of the evidence.",
    themes: ["historiography", "sources"],
    lenses: ["popular"],
    entities: [{ entity: e("elliot") }],
  });
  c("m_mbt_mad", {
    text: "Muḥammad bin Tughluq was simply mad.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "His schemes, a central capital and a token coinage, had reasons; they failed in the carrying out. The picture of a madman rests largely on Baranī, a hostile witness.",
    themes: ["historiography", "polity"],
    lenses: ["popular"],
    entities: [{ entity: e("mbt") }],
  });
  c("m_padmini", {
    text: "The story of Queen Padmini and ʿAlāʾ al-Dīn at Chittor in 1303 is documented history.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "The siege of 1303 is documented; the queen first appears in Jāyasī's poem of 1540. Many historians doubt that she existed.",
    themes: ["historiography", "culture"],
    lenses: ["popular"],
    entities: [{ entity: e("chittor"), role: "place" }, { entity: e("padmavat"), role: "mention" }],
  });

  // ------------------------------------------------------------ citations
  const cite = (claim: string, excerpt: string, stance: "supports" | "contradicts" | "qualifies" | "mentions" = "supports", note?: string) =>
    ops.push({ op: "cite", claim: `@${claim}`, excerpt: `@${excerpt}`, stance, ...(note ? { note } : {}) });
  cite("d_dynasties", "sx_lp_five");
  cite("d_dynasties", "sx_wp_periods");
  cite("d_aibak", "sx_lp_slavekings", "supports", "“Aybek the slave of Ghori”.");
  cite("d_aibak", "sx_page_aibak");
  cite("d_iltutmish", "sx_ed2_purchased");
  cite("d_iltutmish", "sx_ed2_son");
  cite("d_slave_kings", "sx_wp_mamluk");
  cite("d_slave_kings", "sx_lp_slavekings", "supports", "“descended from Aybek … or from Aybek's slaves”.");
  cite("d_mosque_temples", "sx_page_temples");
  cite("d_mosque_temples", "sx_unesco_temples", "qualifies", "UNESCO says “some 20” temples.");
  cite("d_mosque_temples", "sx_lee_temple", "mentions", "Ibn Baṭṭūṭa: the site had been a temple.");
  cite("d_minar", "sx_page_minar");
  cite("d_minar", "sx_unesco_minar");
  cite("d_raziya_heir", "sx_ed2_heir");
  cite("d_raziya_minhaj", "sx_ed2_raziya_praise");
  cite("d_raziya_minhaj", "sx_ed2_raziya_sex");
  cite("d_raziya_sultan", "sx_ed2_sultan");
  cite("d_mongol_forts", "sx_ed3_forts");
  cite("d_prices", "sx_ed3_army");
  cite("d_prices", "sx_ed3_regulations");
  cite("d_prices", "sx_ed3_wonder");
  cite("d_chittor", "sx_ed3_chitor");
  cite("d_chittor", "sx_ed3_chitor_massacre");
  cite("d_alai", "sx_page_alai");
  cite("d_alai", "sx_unesco_alai");
  cite("d_barani_bias", "sx_ed3_unfair");
  cite("d_daulatabad", "sx_ed3_forced");
  cite("d_daulatabad", "sx_ed3_ruin");
  cite("d_daulatabad", "sx_lee_desert");
  cite("d_tokens", "sx_ed3_mint");
  cite("d_tokens", "sx_ed3_repealed");
  cite("d_tokens", "sx_thomas_forced");
  cite("d_token_legend", "sx_thomas_legend");
  cite("d_barani_hindus", "sx_ed3_hindus");
  cite("d_barani_hindus", "sx_ed3_mint");
  cite("d_lanepoole", "sx_lp_ideas");
  cite("d_lanepoole", "sx_lp_failure");
  cite("d_pillars", "sx_ed3_pillars");
  cite("d_pillars", "sx_ed3_unread");
  cite("d_jizya", "sx_ed3_jizya");
  cite("d_firuz_temples", "sx_ed3_firuz_new");
  cite("d_firuz_temples", "sx_ed3_firuz_destroyed");
  cite("d_timur_sack", "sx_ed3_timur_army");
  cite("d_timur_sack", "sx_ed3_timur_quarters");
  cite("d_timur_god", "sx_ed3_timur_will");
  cite("d_timur_god", "sx_ed3_artisans");
  cite("d_after_1398", "sx_wp_1398");
  cite("d_after_1398", "sx_lp_ascendancy");
  cite("d_after_1398", "sx_lp_chiefs");
  cite("d_after_1398", "sx_sewell_1347", "mentions", "The Bahmani kingdom had already broken away in 1347.");
  cite("d_panipat", "sx_wp_panipat");
  cite("d_panipat", "sx_wp_mughal");
  cite("d_panipat", "sx_lp_panipat");
  cite("d_panipat", "sx_lp_prayer");
  cite("d_vijayanagara", "sx_sewell_1336");
  cite("d_vijayanagara", "sx_sewell_found");
  cite("d_bahmani", "sx_sewell_1347");
  cite("d_kabir", "sx_kabir_benares");
  cite("d_kabir", "sx_kabir_weaver");
  cite("d_kabir", "sx_kabir_song");
  cite("d_padmavat", "sx_jayasi_947");
  cite("d_padmavat", "sx_wp_padmini", "qualifies", "Other, later versions of the story exist.");
  cite("d_elliot_aim", "sx_ed1_preface");
  cite("d_elliot_aim", "sx_eaton_elliot");
  cite("d_eaton_count", "sx_eaton_eighty");
  cite("d_eaton_political", "sx_eaton_state");
  cite("d_eaton_political", "sx_eaton_royal");
  cite("d_eaton_later", "sx_eaton_later");
  cite("d_goel", "sx_wp_goel");
  cite("d_goel", "sx_wp_goel_critique", "qualifies");
  cite("m_slave_one", "sx_wp_mamluk", "contradicts");
  cite("m_slave_one", "sx_lp_slavekings", "contradicts", "“descended from Aybek … or from Aybek's slaves”: not all were slaves.");
  cite("m_elliot_neutral", "sx_ed1_preface", "contradicts");
  cite("m_elliot_neutral", "sx_eaton_elliot", "contradicts");
  cite("m_mbt_mad", "sx_wp_mad", "mentions", "The epithet “The Mad Sultan”.");
  cite("m_mbt_mad", "sx_lp_ideas", "contradicts");
  cite("m_mbt_mad", "sx_ed3_unfair", "qualifies", "The main narrator is a hostile witness.");
  cite("m_padmini", "sx_jayasi_947", "contradicts");
  cite("m_padmini", "sx_wp_padmini", "contradicts");
  cite("m_padmini", "sx_ed3_chitor", "mentions", "The contemporary record of the siege.");

  // ------------------------------------------------------------ relations
  const rel = (from: string, to: string, type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", note?: string) =>
    ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) });
  rel("d_slave_kings", "m_slave_one", "corrects");
  rel("d_iltutmish", "m_slave_one", "qualifies", "Iltutmish was bought as a slave; his children were born free.");
  rel("d_elliot_aim", "m_elliot_neutral", "corrects");
  rel("d_lanepoole", "m_mbt_mad", "corrects");
  rel("d_token_legend", "m_mbt_mad", "qualifies", "The token coinage was a real policy, on coins that survive.");
  rel("d_barani_bias", "m_mbt_mad", "qualifies");
  rel("d_padmavat", "m_padmini", "corrects");
  rel("d_chittor", "m_padmini", "qualifies", "The siege is documented; the queen is not.");
  rel("d_barani_bias", "d_daulatabad", "qualifies");
  rel("d_barani_hindus", "d_tokens", "context_for");
  rel("d_eaton_count", "d_goel", "contradicts");
  rel("d_eaton_later", "d_goel", "qualifies", "Later chronicles inflate the record that lists like Goel's rely on.");
  rel("d_mosque_temples", "d_eaton_political", "context_for", "The first mosque at Delhi, built after the conquest of 1192.");
  rel("d_firuz_temples", "d_eaton_political", "qualifies", "Fīrūz destroyed newly built temples at Delhi, not those of a defeated king.");
  rel("d_mongol_forts", "d_prices", "context_for");
  rel("d_bahmani", "d_after_1398", "context_for");

  return ops;
}

// ---------------------------------------------------------------- page

export const PAGE_SLUG = "delhi-sultanate";

export function sultanatePage(E: Record<string, string>): ChangeOpInput {
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
        `For three centuries, from 1206 to 1526, much of north India was ruled from Delhi by sultans: ${C("d_dynasties", "five dynasties, one after another")}. ${C("d_aibak", "The first sultan had been a slave")}, ${C("d_raziya_heir", "one was a woman")}, and ${C("d_daulatabad", "one moved the whole capital to the Deccan")}. They held off the Mongols, built the ${N("qutbminar", "Qutb Minar")}, and ${C("d_timur_sack", "lost Delhi to Tīmūr in 1398")}.`,
        `We know them mostly through court histories written in Persian, and through the English translations of a British official who ${C("d_elliot_aim", "meant them to show how much better British rule was")}. So this page asks two questions: what happened, and how far we can trust those who told us.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("qutbminar"), text: `${C("d_minar", "Begun by Aibak, finished by Iltutmish")}, beside a mosque ${C("d_mosque_temples", "built from 27 temples")}.`, target: "ch-founding", targetLabel: "A slave becomes a sultan" },
        { entity: e("raziya"), text: `${C("d_raziya_sultan", "Called “Sultan”")}, ${C("d_raziya_minhaj", "praised and dismissed in the same sentence")}.`, target: "ch-raziya", targetLabel: "Raziya" },
        { entity: e("alauddin"), text: `${C("d_prices", "Fixed prices to pay an army against the Mongols")}.`, target: "ch-alauddin", targetLabel: "Markets and the Mongols" },
        { entity: e("mbt"), text: `“The mad sultan”? ${C("d_lanepoole", "Or a man of ideas who failed")}.`, target: "ch-tughluq", targetLabel: "A capital moved, a coinage of brass" },
        { entity: e("timur"), text: `${C("d_timur_sack", "Sacked Delhi in 1398")}.`, target: "ch-timur", targetLabel: "1398 and after" },
        { entity: e("padmavat"), text: `Padmini of Chittor: ${C("d_padmavat", "a poem of 1540, not a chronicle of 1303")}.`, target: "ch-often", targetLabel: "Often said" },
      ],
    },
    {
      id: "meanwhile",
      type: "meanwhile",
      title: "Meanwhile, in the south and in Central Asia",
      items: [
        { region: "The south", label: "Vijayanagara, founded 1336", entity: e("vijayanagara"), claimIds: ["@d_vijayanagara"] },
        { region: "The Deccan", label: "The Bahmani sultanate, 1347", entity: e("bahmani"), claimIds: ["@d_bahmani"] },
        { region: "Central Asia", label: "Tīmūr's empire, which sacked Delhi in 1398", entity: e("timurid"), claimIds: ["@d_timur_sack", "@d_after_1398"] },
      ],
      note: "These were not only contemporaries: the Bahmanis broke away from Delhi itself, and Tīmūr's raid ended Delhi's claim to rule the north.",
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-founding",
      type: "chapter",
      title: "A slave becomes a sultan",
      promise: "How a Turkish slave-general became the first king at Delhi, and what he built there.",
      when: { start: ce(1192), end: ce(1236), basis: "From the conquest of Delhi (1192) to the death of Iltutmish (1236)" },
      places: [e("qutbminar"), e("qutbcomplex")],
      people: people("aibak", "iltutmish"),
      terms: [e("t_mamluk"), e("t_sultan")],
      brief: {
        happened: `${C("d_aibak", "A Turkish slave-commander, Aibak, became the first sultan at Delhi")}; ${C("d_iltutmish", "his own former slave Iltutmish followed him")}, and ${C("d_minar", "the two built the Qutb Minar")}.`,
        howWeKnow: "Minhāj's chronicle in Elliot and Dowson's translation, and the inscriptions on the buildings, as read by the Archaeological Survey in 1926.",
      },
    },
    {
      id: "founding-prose",
      type: "prose",
      markdown: [
        `${C("d_aibak", "Quṭb al-Dīn Aibak had been bought as a slave")} and trained as a soldier, a ${N("t_mamluk", "mamlūk")}. He rose to command the armies of Muḥammad of Ghor, and after his master's death in 1206 he ruled at Delhi as ${N("t_sultan", "sultan")}. ${C("d_iltutmish", "His successor Iltutmish had also been bought as a slave, by Aibak himself, who treated him as a son")}. ${C("d_slave_kings", "Historians later called these rulers the “Slave dynasty”")}, though it was three families, not one.`,
        `Aibak built Delhi's first mosque. ${C("d_mosque_temples", "Its own inscription says it was made from the materials of 27 temples")}. Beside it rose ${C("d_minar", "the Qutb Minar, begun by Aibak and completed by Iltutmish")}.`,
      ].join("\n\n"),
    },
    { id: "founding-claims", type: "claims", claimIds: ["@d_dynasties", "@d_aibak", "@d_iltutmish", "@d_slave_kings", "@d_mosque_temples", "@d_minar"] },
    {
      id: "founding-quote",
      type: "quote",
      excerptId: "@sx_page_temples",
      caption: "Inscription over the eastern gateway of the Quwwat al-Islām mosque, Delhi, as translated in J. A. Page, An Historical Memoir on the Qutb (1926), p. 29.",
    },

    // ------------------------------------------------------------ 2
    {
      id: "ch-raziya",
      type: "chapter",
      title: "Raziya, the only woman to rule at Delhi",
      promise: "Her father chose her over his sons. The chronicler who praised her explains why it was not enough.",
      when: { start: ce(1236), end: ce(1240), basis: "Raziya's reign" },
      people: people("raziya", "iltutmish", "minhaj"),
      terms: [e("t_sultan")],
      brief: {
        happened: `${C("d_raziya_heir", "Iltutmish named his daughter Raziya his heir")}; ${C("d_raziya_sultan", "she ruled as “Sultan”")}, but ${C("d_raziya_minhaj", "the nobles would not accept a woman")}.`,
        howWeKnow: "Minhāj, a courtier who knew her, writing about twenty years later, in Elliot and Dowson's translation.",
      },
    },
    {
      id: "raziya-prose",
      type: "prose",
      markdown: `${C("d_raziya_heir", "Iltutmish told his officials that none of his sons was fit to rule, and named his daughter Raziya")}. ${C("d_raziya_sultan", "She took the title “Sultan”")}, and ruled from 1236 to 1240. The historian Minhāj, who served her, gives her a famous epitaph: ${C("d_raziya_minhaj", "she had every quality a king should have, but she was not born a man, so to men those virtues were worthless")}.`,
    },
    { id: "raziya-claims", type: "claims", claimIds: ["@d_raziya_heir", "@d_raziya_sultan", "@d_raziya_minhaj"] },
    {
      id: "raziya-quote",
      type: "quote",
      excerptId: "@sx_ed2_raziya_sex",
      caption: "Minhāj al-Sirāj, Ṭabaqāt-i Nāṣirī (c. 1260), in Elliot and Dowson, vol. II (1869), p. 332.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-alauddin",
      type: "chapter",
      title: "Markets and the Mongols: ʿAlāʾ al-Dīn Khaljī",
      promise: "To stop the Mongols he needed a huge army; to pay for it, he fixed the price of bread.",
      when: { start: ce(1296), end: ce(1316), basis: "ʿAlāʾ al-Dīn's reign" },
      places: [e("siri"), e("chittor"), e("alaidarwaza")],
      people: people("alauddin", "barani", "khusrau"),
      brief: {
        happened: `${C("d_mongol_forts", "Under Mongol attack, ʿAlāʾ al-Dīn fortified Delhi and the frontier")}, ${C("d_prices", "fixed market prices to pay a large army")}, and ${C("d_chittor", "took Chittor in 1303")}.`,
        howWeKnow: "Baranī's history, written decades later, and Amīr Khusrau's praise of his patron, both in Elliot and Dowson's extracts; neither is neutral.",
      },
    },
    {
      id: "alauddin-prose",
      type: "prose",
      markdown: [
        `The great danger of these years came from the north-west: Mongol armies from Central Asia. After one dangerous attack, ${C("d_mongol_forts", "ʿAlāʾ al-Dīn built a new fortified capital at Siri and rebuilt the forts on the Mongols' road")}. He needed a large army, and ${C("d_prices", "to pay it cheaply he fixed the prices of grain and other goods")}; the historian Baranī calls the steady prices one of the wonders of the age.`,
        `His armies also went south and west. ${C("d_chittor", "He took the fortress of Chittor in 1303")}, and in 1311 ${C("d_alai", "he enlarged Delhi's mosque and built its great gateway, the ʿAlāʾī Darwāza")}. Our main narrator for the century, Baranī, must be read with care: ${C("d_barani_bias", "even his Victorian translators called him unfair")}.`,
      ].join("\n\n"),
    },
    { id: "alauddin-claims", type: "claims", claimIds: ["@d_mongol_forts", "@d_prices", "@d_chittor", "@d_alai", "@d_barani_bias"] },

    // ------------------------------------------------------------ 4
    {
      id: "ch-tughluq",
      type: "chapter",
      title: "A capital moved, a coinage of brass: Muḥammad bin Tughluq",
      promise: "Two famous schemes, a hostile historian, and the coins that let us check him.",
      when: { start: ce(1325), end: ce(1351), basis: "Muḥammad bin Tughluq's reign" },
      places: [e("daulatabad"), e("tughlaqabad")],
      people: people("mbt", "barani", "ibnbattuta"),
      terms: [e("t_tanka"), e("t_token")],
      brief: {
        happened: `${C("d_daulatabad", "Muḥammad bin Tughluq moved Delhi's people to Daulatabad")} and ${C("d_tokens", "issued brass and copper coins to pass as silver")}; both schemes failed.`,
        howWeKnow: "Baranī (hostile), Ibn Baṭṭūṭa (who served the sultan), and the surviving coins themselves.",
      },
    },
    {
      id: "tughluq-prose",
      type: "prose",
      markdown: [
        `Muḥammad bin Tughluq wanted a capital at the centre of his empire. ${C("d_daulatabad", "He made Daulatabad, in the Deccan, his capital and forced the people of Delhi to move there")}; when Ibn Baṭṭūṭa arrived, he found Delhi almost a desert.`,
        `His second scheme was a ${N("t_token", "token currency")}: ${C("d_tokens", "copper and brass coins decreed to be worth silver ones")}. They were forged everywhere, and he had to buy them back. Baranī, who hated the sultan, ${C("d_barani_hindus", "blamed the scheme for making every Hindu house a mint")}. But ${C("d_token_legend", "the coins survive, inscribed “He who obeys the Sultan, truly, he obeys God”")}, and they show a deliberate policy, not a whim. ${C("d_lanepoole", "A historian of 1903 called him a man of ideas far beyond his age, and a “transcendent failure”")}.`,
      ].join("\n\n"),
    },
    { id: "tughluq-claims", type: "claims", claimIds: ["@d_daulatabad", "@d_tokens", "@d_token_legend", "@d_barani_hindus", "@d_lanepoole"] },
    {
      id: "tughluq-debate",
      type: "debate",
      question: "Was Muḥammad bin Tughluq mad?",
      positions: [
        { label: "His schemes ruined the country (Baranī)", claimIds: ["@d_daulatabad", "@d_barani_hindus"] },
        { label: "Good ideas, badly carried out (Lane-Poole, 1903)", claimIds: ["@d_lanepoole", "@d_token_legend"] },
      ],
      note: "Baranī lived through the reign and suffered under it; that makes him a witness, and also a hostile one. The coins and Ibn Baṭṭūṭa give independent checks.",
    },
    {
      id: "tughluq-quote",
      type: "quote",
      excerptId: "@sx_ed3_mint",
      caption: "Ẓiyāʾ al-Dīn Baranī, Tārīkh-i Fīrūz Shāhī (1357), in Elliot and Dowson, vol. III (1871), p. 240.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-firuz",
      type: "chapter",
      title: "Fīrūz Shāh: pillars, taxes and temples",
      promise: "A builder who moved Aśoka's pillars to Delhi, and a pious ruler who taxed the Brahmans.",
      when: { start: ce(1351), end: ce(1388), basis: "Fīrūz Shāh's reign" },
      places: [e("firozkotla"), e("toprapillar")],
      people: people("firuz"),
      terms: [e("t_jizya")],
      brief: {
        happened: `${C("d_pillars", "Fīrūz Shāh brought two Aśokan pillars to Delhi")}, ${C("d_jizya", "made the Brahmans pay the jizya")}, and ${C("d_firuz_temples", "boasted of destroying new temples")}.`,
        howWeKnow: "ʿAfīf's history and Fīrūz's own account of his reign, both in Elliot and Dowson's extracts.",
      },
    },
    {
      id: "firuz-prose",
      type: "prose",
      markdown: [
        `Fīrūz Shāh built a new city at Delhi, Fīrūzābād. ${C("d_pillars", "He had two great stone pillars dragged from Topra and Meerut and set up in Delhi, though no one could read their inscriptions")}. They were the edicts of the Maurya emperor Aśoka, which no one could read again until the nineteenth century (see [the Maurya Empire](page:maurya-empire)).`,
        `He was also a strict ruler in religion. ${C("d_jizya", "He made the Brahmans pay the jizya")}, a tax on non-Muslims from which they had been excused, and ${C("d_firuz_temples", "in his own words he destroyed temples newly built near Delhi")}.`,
      ].join("\n\n"),
    },
    { id: "firuz-claims", type: "claims", claimIds: ["@d_pillars", "@d_jizya", "@d_firuz_temples"] },

    // ------------------------------------------------------------ 6
    {
      id: "ch-timur",
      type: "chapter",
      title: "1398 and after",
      promise: "Tīmūr's sack of Delhi, the kingdoms that rose as Delhi fell, and the battle that ended the Sultanate.",
      when: { start: ce(1398), end: ce(1526), basis: "From Tīmūr's sack of Delhi to Panipat" },
      places: [e("panipat")],
      people: people("timur", "ibrahimlodi", "babur"),
      brief: {
        happened: `${C("d_timur_sack", "Tīmūr sacked Delhi in 1398")}; ${C("d_after_1398", "rival kingdoms rose")}, and ${C("d_panipat", "in 1526 Bābur defeated the last sultan at Panipat")}.`,
        howWeKnow: "The memoir presented as Tīmūr's own (its authenticity is doubted), and Wikipedia for the later dates.",
      },
    },
    {
      id: "timur-prose",
      type: "prose",
      markdown: [
        `In December 1398 the Central Asian conqueror Tīmūr took Delhi. ${C("d_timur_sack", "His soldiers ran out of control; each took dozens of prisoners, and only the Muslim quarters were spared")}. ${C("d_timur_god", "His memoir says he wished to spare the city, but that it was God's will")}, and that he had its craftsmen picked out from among the prisoners.`,
        `Delhi never fully recovered its power. ${C("d_after_1398", "Rival kingdoms and sultanates rose in Bengal, the Deccan, Mewar and the south")}. Two smaller dynasties, the Sayyids and the Lodis, ruled at Delhi, until ${C("d_panipat", "Bābur defeated Ibrāhīm Lodī at Panipat in 1526 and founded Mughal rule")}.`,
      ].join("\n\n"),
    },
    { id: "timur-claims", type: "claims", claimIds: ["@d_timur_sack", "@d_timur_god", "@d_after_1398", "@d_panipat"] },
    {
      id: "timur-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The Malfūẓāt is presented as Tīmūr's own memoir; many scholars doubt it is. It tells us at least how his court wished the sack to be remembered: as God's will, not his.",
    },

    // ------------------------------------------------------------ 7
    {
      id: "ch-south",
      type: "chapter",
      title: "The south breaks away",
      promise: "Two new kingdoms of the 1330s and 1340s, one Hindu and one Muslim, both born from the Sultanate's overreach.",
      when: { start: ce(1336), end: ce(1347) },
      people: people("mbt"),
      brief: {
        happened: `${C("d_vijayanagara", "Vijayanagara was founded in 1336")}, and ${C("d_bahmani", "in 1347 the Deccan broke away to form the Bahmani kingdom")}.`,
        howWeKnow: "Robert Sewell's history of Vijayanagara (1900); there is more on the Vijayanagara page when it is written.",
      },
    },
    {
      id: "south-prose",
      type: "prose",
      markdown: `Delhi's armies had reached deep into the south, but Delhi could not hold it. ${C("d_vijayanagara", "In 1336 a new kingdom was founded at Vijayanagara")}, and ${C("d_bahmani", "in 1347 the Deccan rose against Muḥammad bin Tughluq and founded the Bahmani sultanate")}.`,
    },
    { id: "south-claims", type: "claims", claimIds: ["@d_vijayanagara", "@d_bahmani"] },

    // ------------------------------------------------------------ 8
    {
      id: "ch-kabir",
      type: "chapter",
      title: "Between temple and mosque: Kabīr",
      promise: "A weaver-poet of Benares who found God in neither temple nor mosque.",
      when: { start: ce(1440), end: ce(1518), basis: "Kabīr's traditional dates (Wikidata)" },
      people: people("kabir"),
      terms: [e("t_bhakti"), e("t_sufi")],
      brief: {
        happened: `${C("d_kabir", "In fifteenth-century Benares, Kabīr sang of one God beyond temple and mosque")}.`,
        howWeKnow: "Songs attributed to him, in Tagore's English (1915), and traditions about his life, which are uncertain.",
      },
    },
    {
      id: "kabir-prose",
      type: "prose",
      markdown: `The Sultanate was not only courts and armies. ${C("d_kabir", "In fifteenth-century Benares, Kabīr, raised in a family of Muslim weavers, sang that God is to be found within, not in temple or mosque")}. His songs belong to the ${N("t_bhakti", "bhakti")} movement of devotion, and his Benares was a place where ${N("t_sufi", "Sufis")} and Brahmans argued and listened.`,
    },
    { id: "kabir-claims", type: "claims", claimIds: ["@d_kabir"] },
    {
      id: "kabir-quote",
      type: "quote",
      excerptId: "@sx_kabir_song",
      caption: "Kabīr, song LXIX, in Rabindranath Tagore's translation, Songs of Kabir (1915), p. 112.",
    },

    // ------------------------------------------------------------ 9
    {
      id: "ch-reading",
      type: "chapter",
      title: "Temples, chronicles and how we read them",
      promise: "Who chose the extracts we read, how many temples were destroyed, and why historians disagree.",
      phase: "later",
      people: people("elliot", "eaton"),
      terms: [e("t_desecration")],
      brief: {
        happened: `${C("d_elliot_aim", "The standard English translations were chosen to show Muslim misrule")}; ${C("d_eaton_count", "historians now count and explain temple desecration in very different ways")}.`,
        howWeKnow: "Elliot's own preface (1867), Eaton (2000) and a summary of Goel (1990): quoted in their own words.",
      },
    },
    {
      id: "reading-prose",
      type: "prose",
      markdown: [
        `Most of what English readers know of the Sultanate comes from one collection: Elliot and Dowson's History of India, as Told by Its Own Historians. Its planner, Henry Elliot, ${C("d_elliot_aim", "said in his preface that the extracts would make Indians appreciate “the mildness and equity” of British rule")}. The extracts are real, but they were chosen.`,
        `The hardest question is the destruction of temples. Some acts are recorded by those who did them: ${C("d_mosque_temples", "the first mosque at Delhi")} and ${C("d_firuz_temples", "Fīrūz Shāh's own account")}. How common, and why? ${C("d_eaton_count", "Richard Eaton counted about 80 well-attested cases over five centuries")}, and ${C("d_eaton_political", "argued that rulers targeted the temples of defeated kings")}. ${C("d_goel", "Sita Ram Goel and others listed some 2,000 mosques they said stood on temple sites")}. ${C("d_eaton_later", "Part of the gap is that later chroniclers inflated the record")}.`,
      ].join("\n\n"),
    },
    { id: "reading-claims", type: "claims", claimIds: ["@d_elliot_aim", "@d_eaton_count", "@d_eaton_political", "@d_eaton_later", "@d_goel"] },
    {
      id: "reading-debate",
      type: "debate",
      question: "How many temples were destroyed, and why?",
      positions: [
        { label: "About 80 well-attested cases, mostly political (Eaton, 2000)", claimIds: ["@d_eaton_count", "@d_eaton_political"] },
        { label: "Thousands of sites, as the chronicles and inscriptions boast (Goel and others, 1990)", claimIds: ["@d_goel"] },
      ],
      note: "Both sides use the same kinds of evidence, inscriptions and chronicles; they differ on which to trust and how to count. Eaton's figure is a minimum from firm evidence; Goel's lists take later boasts at face value. The page shows the primary evidence where it exists.",
    },
    {
      id: "reading-care",
      type: "callout",
      tone: "method",
      markdown: "How to read a chronicle. Court historians wrote for patrons: a conquest is a triumph of faith, a rival is an infidel or a rebel. Their boasts are evidence of what was valued at court, not always of what happened. Read them beside the buildings, the coins and the inscriptions.",
    },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Four popular beliefs about the Delhi Sultanate.",
      phase: "later",
      brief: {
        happened: `Four common beliefs, each checked: ${C("m_slave_one", "one slave dynasty")}, ${C("m_elliot_neutral", "neutral translations")}, ${C("m_mbt_mad", "a mad sultan")} and ${C("m_padmini", "Padmini as history")}.`,
        howWeKnow: "The sources on this page.",
      },
    },
    {
      id: "often-prose",
      type: "prose",
      markdown: "Some short versions of this story are repeated more often than the sources allow. Here are four, each with what the sources on this page say.",
    },
    { id: "myth-slave", type: "misconception", theme: "polity", claimId: "@m_slave_one", correctionIds: ["@d_slave_kings", "@d_iltutmish"] },
    { id: "myth-elliot", type: "misconception", theme: "historiography", claimId: "@m_elliot_neutral", correctionIds: ["@d_elliot_aim"] },
    { id: "myth-mad", type: "misconception", theme: "historiography", claimId: "@m_mbt_mad", correctionIds: ["@d_lanepoole", "@d_token_legend", "@d_barani_bias"] },
    { id: "myth-padmini", type: "misconception", theme: "historiography", claimId: "@m_padmini", correctionIds: ["@d_padmavat", "@d_chittor"] },
  ];

  return {
    op: "create_page",
    slug: PAGE_SLUG,
    title: "The Delhi Sultanate",
    kind: "era",
    entity: E.sultanate!,
    summary: "Three centuries of sultans at Delhi, 1206–1526: slave-kings and a woman sultan, the Mongol wars, a capital moved and a coinage of brass, Tīmūr's sack, and how to read the chronicles that tell us.",
    blocks,
    status: "published",
    position: 10,
    spec: sultanateSpec(E),
  };
}

/** The five dynasties' borders (Cliopatria has no aggregate Sultanate), with stops dated by claims. */
export function sultanateSpec(E: Record<string, string>): PageSpecInput {
  return {
    atlas: {
      focus: ["mamluk", "khalji", "tughlaq", "sayyid", "lodi"].map((r) => E[r]!),
      range: [1200, 1530],
      initialYear: 1335,
      stops: [
        { year: 1206, label: "Aibak rules at Delhi", claimId: "@d_dynasties" },
        { year: 1303, label: "ʿAlāʾ al-Dīn takes Chittor", claimId: "@d_chittor" },
        { year: 1336, label: "Vijayanagara founded", claimId: "@d_vijayanagara" },
        { year: 1347, label: "The Bahmanis break away", claimId: "@d_bahmani" },
        { year: 1398, label: "Tīmūr sacks Delhi", claimId: "@d_timur_sack" },
        { year: 1526, label: "Panipat: the Sultanate ends", claimId: "@d_panipat" },
      ],
      neighbours: true,
    },
    timeline: { range: [1190, 1530] },
  };
}
