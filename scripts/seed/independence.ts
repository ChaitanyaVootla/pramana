import type { BlockInput, ChangeOpInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * "The independence movement" era page (c. 1857–1947), built from the source
 * pack prepared on 2026-10-17 (93 quotes machine-checked against the same
 * texts). Primary sources are public-domain or openly licensed scans and
 * transcriptions: Internet Archive OCR, historic Hansard, validated Wikisource
 * transcriptions. Modern scholarship is copyrighted and is cited by location
 * only, as found through Wikipedia. Wikipedia itself is tertiary and is used
 * for a few dates and for the scale of the famine and of Partition, flagged
 * as such on the page.
 *
 * Copyright caveats are recorded on each source: Savarkar 1909 is not yet
 * public domain in India (until 1 Jan 2027); Indian works of 1931–47
 * (Ambedkar 1936/45, the 1940 and 1942 Indian Annual Registers) are probably
 * not public domain in the US. Quotes from those are kept to a sentence.
 */

// ---------------------------------------------------------------- snapshots

const WS = "https://en.wikisource.org/w/index.php?title=";
const HANSARD = "https://api.parliament.uk/historic-hansard/";

export const CAPTURES = {
  naoroji: { kind: "internet_archive", identifier: "povertyunbritish00naoruoft" },
  hindswaraj: { kind: "internet_archive", identifier: "hindswarajorindi00ganduoft" },
  savarkar: { kind: "internet_archive", identifier: "ldpd_6260651_000" },
  malleson: { kind: "internet_archive", identifier: "indianmutinyof00malliala" },
  marx: { kind: "internet_archive", identifier: "firstindianwarindependencemarxengels" },
  inc1909: { kind: "internet_archive", identifier: "indiannationalco00madrrich" },
  montchelm: { kind: "internet_archive", identifier: "reportonindianco00grea" },
  hunter: { kind: "internet_archive", identifier: "disordersinquiry00unse" },
  incpunjab: { kind: "internet_archive", identifier: "reportofcommissi01indi" },
  youngindia: { kind: "internet_archive", identifier: "in.ernet.dli.2015.211536" },
  iar1930: { kind: "internet_archive", identifier: "HindSwaraj.iar.10973.17740" },
  iar1940: { kind: "internet_archive", identifier: "in.ernet.dli.2015.93700" },
  iar1942: { kind: "internet_archive", identifier: "HindSwaraj.iar.10973.17995" },
  ambedkar: { kind: "internet_archive", identifier: "in.ernet.dli.2015.71655" },
  hc1857: { kind: "url", url: `${HANSARD}commons/1857/jul/27/motion-for-papers` },
  hc19460219: { kind: "url", url: `${HANSARD}commons/1946/feb/19/india-cabinet-ministers-mission` },
  hc19460222: { kind: "url", url: `${HANSARD}commons/1946/feb/22/royal-indian-navy-mutiny` },
  hc19460226: {
    kind: "url",
    url: `${HANSARD}commons/1946/feb/26/india-naval-mutiny-and-civil-disturbances`,
  },
  hl19470220: { kind: "url", url: `${HANSARD}lords/1947/feb/20/indian-policy` },
  bhagat: {
    kind: "url",
    url: `${WS}Joint_Statement_of_Bhagat_Singh_and_B._K._Dutt_in_the_Assembly_Bomb_Case&oldid=13278614`,
  },
  iia_p3: { kind: "url", url: `${WS}Page:Indian_Independence_Act_1947.djvu/3&oldid=15002852` },
  iia_p6: { kind: "url", url: `${WS}Page:Indian_Independence_Act_1947.djvu/6&oldid=15002858` },
  wp1857: { kind: "wikipedia", title: "Indian Rebellion of 1857" },
  wpChauri: { kind: "wikipedia", title: "Chauri Chaura incident" },
  wpBhagat: { kind: "wikipedia", title: "Bhagat Singh" },
  wpSalt: { kind: "wikipedia", title: "Salt March" },
  wpLahore: { kind: "wikipedia", title: "Lahore Resolution" },
  wpFamine: { kind: "wikipedia", title: "Bengal famine of 1943" },
  wpINA: { kind: "wikipedia", title: "Indian National Army" },
  wpPartition: { kind: "wikipedia", title: "Partition of India" },
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

type Kind = "person" | "event" | "group" | "place" | "site" | "period" | "term";
interface EntitySpec {
  ref: string;
  slug: string;
  kind: Kind;
  label: string;
  qid?: string;
  description: string;
  /** Overrides Wikidata's date (with the reason in basis). */
  when?: Record<string, unknown>;
  /** Use Wikidata P569/P570 as a life span (people). */
  life?: boolean;
  /** Use Wikidata coordinates, with this certainty. */
  geo?: "exact" | "approximate";
  geoNote?: string;
  aliases?: { label: string; lang?: string; script?: string; note?: string }[];
  /** Drop Wikidata aliases matching this (non-neutral or wrong). */
  dropAliases?: RegExp;
  /** How this entity relates to the movement (for the page's timeline and map). */
  link?: "part_of" | "participant_in" | "related_to" | "located_in";
}

const d = (year: number, month?: number, day?: number) => ({
  year,
  era: "CE" as const,
  ...(month ? { month } : {}),
  ...(day ? { day } : {}),
});

export const ENTITIES: EntitySpec[] = [
  // The page's own entity.
  {
    ref: "movement",
    slug: "indian-independence-movement",
    kind: "period",
    label: "Indian independence movement",
    qid: "Q12444025",
    description:
      "The campaigns, from the revolt of 1857 and the first Congress of 1885 to August 1947, that ended British rule in India.",
    when: {
      start: { year: 1857, era: "CE", approximate: true },
      end: d(1947, 8, 15),
      label: "c. 1857–1947",
      basis:
        "Editorial frame for this page: from the revolt of 1857 (the organised movement is usually dated from the first Congress, 1885) to independence on 15 August 1947. Wikidata dates the movement from 1757; that is not used.",
    },
  },
  // People
  { ref: "gandhi", slug: "mahatma-gandhi", kind: "person", label: "M. K. Gandhi", qid: "Q1001", life: true, link: "participant_in", description: "Leader of the mass non-violent campaigns of 1919–1942; author of Hind Swaraj (1909).", aliases: [{ label: "Mahatma Gandhi", lang: "en" }, { label: "Mohandas Karamchand Gandhi", lang: "en" }, { label: "मोहनदास करमचंद गांधी", lang: "hi", script: "Deva" }] },
  { ref: "jinnah", slug: "muhammad-ali-jinnah", kind: "person", label: "Muhammad Ali Jinnah", qid: "Q160554", life: true, link: "participant_in", description: "Leader of the All-India Muslim League and of the demand for Pakistan; its first Governor-General." },
  { ref: "ambedkar", slug: "b-r-ambedkar", kind: "person", label: "B. R. Ambedkar", qid: "Q231690", life: true, link: "participant_in", description: "Lawyer and anti-caste leader; author of Annihilation of Caste (1936).", aliases: [{ label: "Bhimrao Ramji Ambedkar", lang: "en" }, { label: "Babasaheb Ambedkar", lang: "en" }, { label: "भीमराव रामजी आंबेडकर", lang: "mr", script: "Deva" }] },
  { ref: "bhagat", slug: "bhagat-singh", kind: "person", label: "Bhagat Singh", qid: "Q377808", life: true, link: "participant_in", description: "Revolutionary socialist; with B. K. Dutt he bombed the Central Legislative Assembly in 1929. Executed in 1931." },
  { ref: "dutt", slug: "batukeshwar-dutt", kind: "person", label: "Batukeshwar Dutt", qid: "Q3630733", life: true, link: "participant_in", description: "Revolutionary; Bhagat Singh's companion in the Assembly bombing of 1929.", aliases: [{ label: "B. K. Dutt", lang: "en" }] },
  { ref: "naoroji", slug: "dadabhai-naoroji", kind: "person", label: "Dadabhai Naoroji", qid: "Q10240", life: true, link: "participant_in", description: "Economist and Congress president (1886, 1893, 1906); argued that British rule drained India's wealth." },
  { ref: "savarkar", slug: "v-d-savarkar", kind: "person", label: "V. D. Savarkar", qid: "Q471040", life: true, link: "participant_in", description: "Revolutionary and later Hindu-nationalist ideologue; author of The Indian War of Independence of 1857 (1909).", aliases: [{ label: "Vinayak Damodar Savarkar", lang: "en" }] },
  { ref: "azad", slug: "abul-kalam-azad", kind: "person", label: "Abul Kalam Azad", qid: "Q196617", life: true, link: "participant_in", description: "Scholar and Congress president (1923, 1940–46); a leading Muslim voice for a united India.", aliases: [{ label: "Maulana Azad", lang: "en" }] },
  { ref: "bose", slug: "subhas-chandra-bose", kind: "person", label: "Subhas Chandra Bose", qid: "Q2153", life: true, link: "participant_in", description: "Congress president (1938–39) who later led the Indian National Army against the British in the Second World War." },
  { ref: "bonnerjee", slug: "w-c-bonnerjee", kind: "person", label: "W. C. Bonnerjee", qid: "Q8031640", life: true, link: "participant_in", description: "Lawyer; president of the first Indian National Congress, Bombay, 1885.", aliases: [{ label: "Womesh Chunder Bonnerjee", lang: "en" }] },
  { ref: "dyer", slug: "reginald-dyer", kind: "person", label: "Reginald Dyer", qid: "Q560470", life: true, link: "related_to", description: "British Indian Army officer who ordered the firing at Jallianwala Bagh, Amritsar, in April 1919." },
  { ref: "disraeli", slug: "benjamin-disraeli", kind: "person", label: "Benjamin Disraeli", qid: "Q82006", life: true, link: "related_to", description: "British Conservative politician; in opposition in 1857, later Prime Minister." },
  { ref: "marx", slug: "karl-marx", kind: "person", label: "Karl Marx", qid: "Q9061", life: true, link: "related_to", description: "German philosopher and journalist; wrote on the revolt of 1857 for the New-York Daily Tribune." },
  { ref: "montagu", slug: "edwin-montagu", kind: "person", label: "Edwin Montagu", qid: "Q332572", life: true, link: "related_to", description: "Secretary of State for India, 1917–22; announced the aim of responsible government in 1917." },
  { ref: "attlee", slug: "clement-attlee", kind: "person", label: "Clement Attlee", qid: "Q129006", life: true, link: "related_to", description: "British Prime Minister, 1945–51, whose government transferred power in 1947." },
  // Events
  { ref: "revolt1857", slug: "revolt-of-1857", kind: "event", label: "Revolt of 1857", qid: "Q129864", link: "part_of", description: "The uprising of 1857–58 against the rule of the East India Company, which began with a mutiny of its Indian soldiers.", dropAliases: /./, aliases: [
    { label: "Indian Rebellion of 1857", lang: "en", note: "The title of the English Wikipedia article." },
    { label: "Sepoy Mutiny", lang: "en", note: "The usual British name in the 19th century; it presents the revolt as a soldiers' mutiny only." },
    { label: "Indian Mutiny", lang: "en", note: "British usage, as in Wikidata's label." },
    { label: "First War of Independence", lang: "en", note: "The Indian nationalist name, after Savarkar (1909); common in India." },
  ] },
  { ref: "bengal1905", slug: "partition-of-bengal-1905", kind: "event", label: "Partition of Bengal (1905)", qid: "Q2047143", link: "part_of", description: "The division of the province of Bengal by Lord Curzon's government, reversed in 1911.", when: { start: d(1905, 10, 16), basis: "Wikipedia, Partition of Bengal (1905): announced on 16 October 1905" } },
  { ref: "jallianwala", slug: "jallianwala-bagh-massacre", kind: "event", label: "Jallianwala Bagh massacre", qid: "Q208855", link: "part_of", geo: "exact", description: "The firing on a crowd in the Jallianwala Bagh, Amritsar, by troops under General Dyer on 13 April 1919." },
  { ref: "ncm", slug: "non-cooperation-movement", kind: "event", label: "Non-cooperation movement", qid: "Q1479381", link: "part_of", description: "Gandhi's first all-India campaign, 1920–22: boycott of British courts, schools, titles and goods.", when: { start: d(1920, 9, 4), end: d(1922, 2, 12), basis: "Wikipedia, Non-cooperation movement (1919–1922) and Chauri Chaura incident: launched 4 September 1920, halted 12 February 1922" } },
  { ref: "chauri", slug: "chauri-chaura-incident", kind: "event", label: "Chauri Chaura incident", qid: "Q12427290", link: "part_of", geo: "approximate", description: "The killing of policemen by a crowd at Chauri Chaura, in the Gorakhpur district, which led Gandhi to call off non-cooperation.", when: { start: d(1922, 2, 4), basis: "Wikipedia, Chauri Chaura incident: 4 February 1922. Wikidata gives 5 February, and describes it as a train accident; both are wrong and not used." } },
  { ref: "bombing", slug: "central-legislative-assembly-bombing", kind: "event", label: "Central Legislative Assembly bombing", link: "part_of", description: "Bhagat Singh and B. K. Dutt's throwing of two bombs into the Assembly chamber in Delhi, 1929.", when: { start: d(1929, 4, 8), basis: "Wikipedia, Bhagat Singh: 8 April 1929" } },
  { ref: "purna", slug: "purna-swaraj", kind: "event", label: "Purna Swaraj declaration", qid: "Q2723918", link: "part_of", description: "Congress's adoption of complete independence as its goal, celebrated on 26 January 1930.", when: { start: d(1930, 1, 26), basis: "Indian Annual Register 1930: “Purna Swarajya Day, Sunday January 26th, 1930”" } },
  { ref: "salt", slug: "salt-march", kind: "event", label: "Salt March", qid: "Q239344", link: "part_of", description: "Gandhi's march from Sabarmati to Dandi to break the salt law, 1930.", when: { start: d(1930, 3, 12), end: d(1930, 4, 6), basis: "Wikipedia, Salt March: 12 March to 6 April 1930 (Wikidata lacks the start date)" } },
  { ref: "lahore1940", slug: "lahore-resolution", kind: "event", label: "Lahore Resolution", qid: "Q1800631", link: "part_of", description: "The Muslim League's resolution of March 1940 for “independent states” in the Muslim-majority areas; later called the Pakistan Resolution.", when: { start: d(1940, 3, 23), basis: "Wikipedia, Lahore Resolution: adopted 23 March 1940" } },
  { ref: "quitindia", slug: "quit-india-movement", kind: "event", label: "Quit India Movement", qid: "Q1992677", link: "part_of", description: "The mass movement launched by the Congress in August 1942 demanding an immediate end to British rule.", when: { start: d(1942, 8, 8), basis: "The All-India Congress Committee's resolution of 8 August 1942 (Indian Annual Register 1942); arrests and protests began on 9 August" } },
  { ref: "famine", slug: "bengal-famine-of-1943", kind: "event", label: "Bengal famine of 1943", qid: "Q522837", link: "part_of", description: "The wartime famine in Bengal, in which millions died of starvation and disease." },
  { ref: "inatrials", slug: "indian-national-army-trials", kind: "event", label: "Indian National Army trials", qid: "Q5972197", link: "part_of", description: "The courts-martial of INA officers at the Red Fort, Delhi.", when: { start: d(1945, 11), end: d(1946, 5), basis: "Wikidata Q5972197 (description): between November 1945 and May 1946" } },
  { ref: "rin", slug: "royal-indian-navy-mutiny", kind: "event", label: "Royal Indian Navy mutiny", qid: "Q3519518", link: "part_of", description: "The strike and mutiny of Indian naval ratings in Bombay and other ports, February 1946." },
  { ref: "cabinetmission", slug: "cabinet-mission-1946", kind: "event", label: "Cabinet Mission (1946)", qid: "Q2352021", link: "part_of", description: "The mission of three British Cabinet ministers sent to India in 1946 to agree a constitution and a transfer of power.", when: { start: d(1946, 2, 19), basis: "Announced in the House of Commons on 19 February 1946 (Hansard)" } },
  { ref: "partition", slug: "partition-of-india", kind: "event", label: "Partition of India", qid: "Q129053", link: "part_of", description: "The division of British India into the dominions of India and Pakistan in August 1947, with mass migration and violence." },
  // Organisations
  { ref: "inc", slug: "indian-national-congress", kind: "group", label: "Indian National Congress", qid: "Q10225", link: "participant_in", description: "The political organisation founded in 1885 that led the main national movement.", aliases: [{ label: "Congress", lang: "en" }] },
  { ref: "league", slug: "all-india-muslim-league", kind: "group", label: "All-India Muslim League", qid: "Q223898", link: "participant_in", description: "Political party founded in 1906; from 1940 it demanded Pakistan.", aliases: [{ label: "Muslim League", lang: "en" }] },
  { ref: "ina", slug: "indian-national-army", kind: "group", label: "Indian National Army", qid: "Q156062", link: "participant_in", description: "An army formed in South-East Asia during the Second World War with Japanese support, led from 1943 by Subhas Chandra Bose.", aliases: [{ label: "Azad Hind Fauj", lang: "hi-Latn" }] },
  // Places
  { ref: "delhi", slug: "delhi", kind: "place", label: "Delhi", qid: "Q1353", geo: "approximate", link: "related_to", description: "The Mughal capital, held by the rebels in 1857; capital of British India from 1911." },
  { ref: "bombay", slug: "bombay", kind: "place", label: "Bombay", qid: "Q1156", geo: "approximate", link: "related_to", description: "Port city where the first Congress met (1885), the Quit India resolution was passed (1942) and the naval mutiny began (1946); now Mumbai.", aliases: [{ label: "Mumbai", lang: "en", note: "The official name since 1995." }] },
  { ref: "calcutta", slug: "calcutta", kind: "place", label: "Calcutta", qid: "Q1348", geo: "approximate", link: "related_to", description: "Capital of British India until 1911, where Congress met in 1906; now Kolkata.", aliases: [{ label: "Kolkata", lang: "en", note: "The official name since 2001." }] },
  { ref: "lahore", slug: "lahore", kind: "place", label: "Lahore", qid: "Q11739", geo: "approximate", link: "related_to", description: "Capital of the Punjab, where the Muslim League passed its resolution of 1940; now in Pakistan." },
  { ref: "jbagh", slug: "jallianwala-bagh", kind: "site", label: "Jallianwala Bagh", qid: "Q10904104", geo: "exact", link: "related_to", description: "An enclosed public garden in Amritsar, now a memorial." },
  { ref: "sabarmati", slug: "sabarmati-ashram", kind: "site", label: "Sabarmati Ashram", qid: "Q1410702", geo: "exact", link: "related_to", description: "Gandhi's ashram at Ahmedabad, where the Salt March began." },
  { ref: "dandi", slug: "dandi", kind: "place", label: "Dandi", qid: "Q1026197", geo: "approximate", link: "related_to", description: "Coastal village in Gujarat where the Salt March ended and Gandhi broke the salt law." },
  { ref: "chaurichaura", slug: "chauri-chaura", kind: "place", label: "Chauri Chaura", qid: "Q2600301", geo: "approximate", link: "related_to", description: "Town in the Gorakhpur district of present-day Uttar Pradesh." },
];

/** Glossary terms (kind "term"). */
const TERMS: EntitySpec[] = [
  { ref: "t_sepoy", slug: "sepoy", kind: "term", label: "sepoy", description: "An Indian soldier in the army of the East India Company, and later of British India." },
  { ref: "t_swaraj", slug: "swaraj", kind: "term", label: "Swaraj", description: "Self-rule. The meaning grew over time: in 1906 Naoroji used it for self-government like Britain's colonies; in 1930 Congress pledged itself to Purna Swaraj, “complete independence”.", aliases: [{ label: "Purna Swaraj", lang: "hi-Latn", note: "“complete self-rule”" }, { label: "स्वराज", lang: "hi", script: "Deva" }] },
  { ref: "t_swadeshi", slug: "swadeshi", kind: "term", label: "Swadeshi", description: "“Of one's own country”: buying Indian-made goods instead of imported ones, even at some cost. Congress backed it in 1906 with a boycott of British goods.", aliases: [{ label: "स्वदेशी", lang: "hi", script: "Deva" }] },
  { ref: "t_passive", slug: "passive-resistance", kind: "term", label: "passive resistance", description: "Gandhi's term in Hind Swaraj (1909) for “securing rights by personal suffering”, the reverse of resistance by arms. He also called it satyagraha.", aliases: [{ label: "satyagraha", lang: "hi-Latn" }] },
  { ref: "t_drain", slug: "drain-of-wealth", kind: "term", label: "drain of wealth", description: "Dadabhai Naoroji's name for the wealth he argued British rule took out of India every year without return.", aliases: [{ label: "drain theory", lang: "en" }] },
  { ref: "t_dominion", slug: "dominion", kind: "term", label: "dominion", description: "A self-governing country of the British Commonwealth with the British monarch as head of state. The 1947 Act made India and Pakistan dominions." },
  { ref: "t_princely", slug: "princely-state", kind: "term", label: "princely state", description: "A state ruled by an Indian prince under treaties with the British Crown, rather than directly as part of British India.", aliases: [{ label: "Indian States", lang: "en", note: "The term in the 1947 Act" }] },
  { ref: "t_paramountcy", slug: "paramountcy", kind: "term", label: "paramountcy", description: "The British Crown's overriding authority over the princely states. The 1947 Act calls it suzerainty and ends it.", aliases: [{ label: "suzerainty", lang: "en" }] },
  { ref: "t_hartal", slug: "hartal", kind: "term", label: "hartal", description: "A general strike in which shops and businesses close, as a protest; the Hunter Report explains it as “a shutting of shops”." },
  { ref: "t_rating", slug: "naval-rating", kind: "term", label: "rating", description: "A sailor in the navy below the rank of officer." },
  { ref: "t_twonation", slug: "two-nation-theory", kind: "term", label: "two-nation theory", description: "The argument that India's Hindus and Muslims were two separate nations. Jinnah put it to the Muslim League in 1940." },
];

export interface ResolvedEntities {
  /** ref → the value to use in ops ("@ref" if created here, else an id or slug). */
  ref: Record<string, string>;
  ops: ChangeOpInput[];
  dependsOn: string[];
  reused: string[];
}

/** Builds create_entity ops from Wikidata (looked up now), skipping anything that already exists or is pending. */
export async function entityOps(mcp: Mcp, existingRefs: Record<string, string>): Promise<ResolvedEntities> {
  const specs = [...ENTITIES, ...TERMS];
  const qids = specs.flatMap((s) => (s.qid ? [s.qid] : []));
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids });
  const out: ResolvedEntities = { ref: { ...existingRefs }, ops: [], dependsOn: [], reused: [] };
  for (const s of specs) {
    const m = s.qid ? matches[s.qid] : undefined;
    if (m) {
      out.ref[s.ref] = m.slug ?? m.id;
      if (m.status === "pending" && m.changesetId) out.dependsOn.push(m.changesetId);
      out.reused.push(`${s.slug} → ${m.status} ${m.slug ?? m.id}`);
      continue;
    }
    const bySlug = await mcp.call<{ id: string; slug: string | null } | null>("get_entity", { entity: s.slug }).catch(() => null);
    if (bySlug && (bySlug as { id?: string }).id) {
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
    else if (wd?.when && s.kind !== "place" && s.kind !== "site")
      op.when = { edtf: wd.when.edtf, basis: wd.when.basis ?? `Wikidata ${s.qid}` };
    if (s.geo && wd?.coordinates)
      op.geo = {
        geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
        certainty: s.geo,
        note: s.geoNote ?? `Coordinates from Wikidata ${s.qid}.`,
      };
    out.ops.push(op);
    out.ref[s.ref] = `@${s.ref}`;
  }
  // Links into the movement, so the page's timeline and map pick them up.
  for (const s of ENTITIES) {
    if (!s.link || s.ref === "movement") continue;
    if (!out.ref[s.ref]!.startsWith("@") && !out.ref.movement!.startsWith("@")) continue;
    out.ops.push({ op: "link_entities", from: out.ref[s.ref]!, to: out.ref.movement!, type: s.link });
  }
  if (out.ref.movement!.startsWith("@")) {
    out.ops.push(
      { op: "link_entities", from: out.ref.movement!, to: "british-raj", type: "related_to", note: "The movement opposed Crown rule (1858–1947)." },
      { op: "link_entities", from: out.ref.movement!, to: "company-rule", type: "related_to", note: "The revolt of 1857 was against Company rule." },
    );
  }
  out.dependsOn = [...new Set(out.dependsOn)];
  return out;
}

// ---------------------------------------------------------------- content

export function independenceOps(s: Snaps, E: Record<string, string>): ChangeOpInput[] {
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
  const OPL = {
    status: "open" as const,
    note: "UK Parliamentary copyright, reproduced under the Open Parliament Licence v3.0.",
  };

  const ops: ChangeOpInput[] = [
    // ------------------------------------------------------------ sources
    {
      op: "create_source",
      ref: "s_naoroji",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Poverty and Un-British Rule in India",
        author: [{ family: "Naoroji", given: "Dadabhai" }],
        issued: { "date-parts": [[1901]] },
        publisher: "Swan Sonnenschein & Co.",
        "publisher-place": "London",
      },
      identifiers: ia("povertyunbritish00naoruoft"),
      license: { status: "public_domain", note: "Published 1901; Naoroji died 1917. Public domain in India and the US." },
      lenses: ["nationalist"],
      note: "Naoroji's collected papers and speeches on Indian poverty and the “drain”. OCR reads £ badly, so money figures are not quoted except where the OCR is clean.",
    },
    {
      op: "create_source",
      ref: "s_hindswaraj",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Hind Swaraj or Indian Home Rule",
        author: [{ family: "Gandhi", given: "M. K." }],
        issued: { "date-parts": [[1921]] },
        "original-date": { "date-parts": [[1909]] },
        publisher: "G. A. Natesan & Co.",
        "publisher-place": "Madras",
        note: "Gandhi's own English translation (1910) of his Gujarati text of 1909, with “the latest foreword” reprinted from Young India, 26 January 1921.",
      },
      identifiers: ia("hindswarajorindi00ganduoft"),
      license: { status: "public_domain", note: "Published 1921 (first 1909); Gandhi died 1948. Public domain in India (since 2009) and the US." },
      lenses: ["nationalist"],
    },
    {
      op: "create_source",
      ref: "s_savarkar",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Indian War of Independence of 1857",
        author: [{ literal: "An Indian Nationalist [V. D. Savarkar]" }],
        issued: { "date-parts": [[1909]] },
        "publisher-place": "London",
        note: "Published anonymously; an anonymous English translation from Savarkar's Marathi. Columbia University Libraries copy.",
      },
      identifiers: ia("ldpd_6260651_000"),
      license: {
        status: "copyrighted",
        note: "Public domain in the US (published 1909). Not yet public domain in India: Savarkar died 26 February 1966 (Wikidata), so the book enters the Indian public domain on 1 January 2027 (life + 60). Quoted briefly.",
      },
      lenses: ["nationalist"],
      note: "A primary source for nationalist historiography of 1857, not for the events themselves.",
    },
    {
      op: "create_source",
      ref: "s_malleson",
      kind: "book",
      tier: "secondary",
      csl: {
        type: "book",
        title: "The Indian Mutiny of 1857",
        author: [{ family: "Malleson", given: "G. B." }],
        issued: { "date-parts": [[1891]] },
        publisher: "Seeley and Co.",
        "publisher-place": "London",
      },
      identifiers: ia("indianmutinyof00malliala"),
      license: { status: "public_domain", note: "Published 1891; Malleson died 1898." },
      lenses: ["colonial_orientalist"],
      note: "A British officer's history of the revolt.",
    },
    {
      op: "create_source",
      ref: "s_marx",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The First Indian War of Independence 1857–1859",
        author: [{ family: "Marx", given: "Karl" }, { family: "Engels", given: "Frederick" }],
        issued: { "date-parts": [[1978]] },
        publisher: "Progress Publishers",
        "publisher-place": "Moscow",
        note: "Articles written for the New-York Daily Tribune, 1853–59, compiled by the Institute of Marxism-Leninism (Russian edition 1959). The book's title is the editors', not Marx's; his articles speak of “the revolt”.",
      },
      identifiers: ia("firstindianwarindependencemarxengels"),
      license: {
        status: "public_domain",
        note: "Marx's and Engels's articles were published 1853–59 and are public domain. The 1959/1978 editorial notes are not, and are not quoted.",
      },
      lenses: ["marxist"],
    },
    {
      op: "create_source",
      ref: "s_hc1857",
      kind: "other",
      tier: "primary",
      csl: {
        type: "speech",
        title: "India — state of affairs. Motion for papers",
        "container-title": "Hansard, House of Commons Debates",
        volume: "147",
        page: "440–546",
        issued: { "date-parts": [[1857, 7, 27]] },
        URL: CAPTURES.hc1857.url,
      },
      identifiers: { url: CAPTURES.hc1857.url },
      license: { status: "public_domain", note: "Parliamentary debate of 1857." },
      note: "HC Deb 27 July 1857 vol 147 cc440–546. Column numbers are inline in the transcription.",
    },
    {
      op: "create_source",
      ref: "s_inc1909",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Indian National Congress: an account of its origin and growth, full text of all the presidential addresses, reprint of all the Congress resolutions",
        editor: [{ family: "Natesan", given: "G. A." }],
        issued: { "date-parts": [[1909]] },
        publisher: "G. A. Natesan & Co.",
        "publisher-place": "Madras",
      },
      identifiers: ia("indiannationalco00madrrich"),
      license: { status: "public_domain", note: "Published 1909; Natesan died 1949 and the speakers earlier. Public domain in India and the US." },
      note: "Three separately paginated parts (introduction; presidential addresses; Part III, resolutions); locators name the part.",
    },
    {
      op: "create_source",
      ref: "s_montchelm",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Report on Indian Constitutional Reforms",
        author: [{ family: "Montagu", given: "E. S." }, { literal: "Lord Chelmsford" }],
        issued: { "date-parts": [[1918]] },
        publisher: "His Majesty's Stationery Office",
        "publisher-place": "London",
        "collection-title": "Cd. 9109",
        note: "The Montagu–Chelmsford Report. This copy is the 1925 reprint.",
      },
      identifiers: ia("reportonindianco00grea"),
      license: { status: "public_domain", note: "UK government publication of 1918; Crown copyright has expired." },
      lenses: ["colonial_orientalist"],
    },
    {
      op: "create_source",
      ref: "s_hunter",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Disorders Inquiry Committee 1919–1920: Report",
        author: [{ literal: "Disorders Inquiry Committee (Lord Hunter, president)" }],
        issued: { "date-parts": [[1920]] },
        publisher: "Superintendent Government Printing, India",
        "publisher-place": "Calcutta",
      },
      identifiers: ia("disordersinquiry00unse"),
      license: { status: "public_domain", note: "Government of India, 1920: public domain in India (60 years from publication) and the US (before 1931)." },
      lenses: ["colonial_orientalist"],
      note: "The Hunter Report: the majority report (pp. 1–142) and the minority report of its three Indian members (after p. 143). Page numbers are footers in the OCR.",
    },
    {
      op: "create_source",
      ref: "s_incpunjab",
      kind: "report",
      tier: "primary",
      csl: {
        type: "report",
        title: "Report of the Commissioners appointed by the Punjab Sub-Committee of the Indian National Congress, vol. I",
        author: [
          { family: "Gandhi", given: "M. K." },
          { family: "Das", given: "C. R." },
          { family: "Tyabji", given: "Abbas S." },
          { family: "Jayakar", given: "M. R." },
        ],
        issued: { "date-parts": [[1920]] },
        "publisher-place": "Lahore",
      },
      identifiers: ia("reportofcommissi01indi"),
      license: { status: "public_domain", note: "Published 1920 (US public domain). In India public domain either as joint authorship (the last commissioner, Jayakar, died 1959) or as a Congress corporate work." },
      lenses: ["nationalist"],
    },
    {
      op: "create_source",
      ref: "s_youngindia",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Young India 1919–1922",
        author: [{ family: "Gandhi", given: "M. K." }],
        issued: { "date-parts": [[1924]] },
        edition: "2nd",
        publisher: "S. Ganesan",
        "publisher-place": "Madras",
        note: "Gandhi's articles from Young India, with a sketch of the Non-Co-operation Movement by Rajendra Prasad.",
      },
      identifiers: ia("in.ernet.dli.2015.211536"),
      license: { status: "public_domain", note: "Published 1924; Gandhi died 1948, Prasad 1963. Public domain in India and the US." },
      lenses: ["nationalist"],
    },
    {
      op: "create_source",
      ref: "s_bhagat",
      kind: "webpage",
      tier: "primary",
      csl: {
        type: "document",
        title: "Joint Statement of Bhagat Singh and B. K. Dutt in the Assembly Bomb Case",
        author: [{ literal: "Bhagat Singh" }, { family: "Dutt", given: "B. K." }],
        issued: { "date-parts": [[1929, 6, 6]] },
        "container-title": "Wikisource",
        URL: CAPTURES.bhagat.url,
      },
      identifiers: { url: CAPTURES.bhagat.url },
      license: { status: "public_domain", note: "Published 1929; Bhagat Singh died 1931. Public domain in India and the US (Wikisource: PD-India)." },
      lenses: ["primary_source"],
      note: "A typed Wikisource transcription (revision 13278614) with no scan behind it and no stated provenance; it has typos. Usable, but it should be checked against a 1929 printing.",
    },
    {
      op: "create_source",
      ref: "s_iar1930",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Indian Annual Register, January–June 1930, vol. I",
        editor: [{ family: "Mitra", given: "N. N." }],
        issued: { "date-parts": [[1930]] },
        publisher: "N. N. Mitra",
        "publisher-place": "Calcutta",
      },
      identifiers: ia("HindSwaraj.iar.10973.17740"),
      license: {
        status: "public_domain",
        note: "Public domain in the US (published 1930). The documents quoted (Congress resolutions, Gandhi's letter) are public domain in India; the status of the editor's own matter is unverified (Mitra's death date not found).",
      },
      note: "The “Chronicle of events” and the Congress section have their own page numbers; some headers are garbled in the OCR.",
    },
    {
      op: "create_source",
      ref: "s_iar1940",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Indian Annual Register, January–June 1940, vol. I",
        editor: [{ family: "Mitra", given: "N. N." }],
        issued: { "date-parts": [[1940]] },
        publisher: "N. N. Mitra",
        "publisher-place": "Calcutta",
      },
      identifiers: ia("in.ernet.dli.2015.93700"),
      license: {
        status: "copyrighted",
        note: "The quoted texts are public domain in India (Jinnah d. 1948, Azad d. 1958; the Muslim League resolution is a corporate work of 1940). Probably not public domain in the US (URAA restoration), so quoted briefly.",
      },
    },
    {
      op: "create_source",
      ref: "s_iar1942",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "The Indian Annual Register, July–December 1942, vol. II",
        editor: [{ family: "Mitra", given: "N. N." }],
        issued: { "date-parts": [[1943]] },
        publisher: "N. N. Mitra",
        "publisher-place": "Calcutta",
        note: "Reprints the Government of India's review Congress Responsibility for the Disturbances 1942–43 (Home Department, R. Tottenham), whose appendix III(2) is the AICC Quit India resolution of 8 August 1942.",
      },
      identifiers: ia("HindSwaraj.iar.10973.17995"),
      license: {
        status: "copyrighted",
        note: "The AICC resolution (1942) and the Government of India review (1943) are public domain in India. Probably not public domain in the US (URAA restoration), so quoted briefly.",
      },
      note: "The OCR of the resolution appendix is poor; quotes match only approximately and need a better witness.",
    },
    {
      op: "create_source",
      ref: "s_ambedkar",
      kind: "book",
      tier: "primary",
      csl: {
        type: "book",
        title: "Annihilation of Caste, with a Reply to Mahatma Gandhi",
        author: [{ family: "Ambedkar", given: "B. R." }],
        issued: { "date-parts": [[1945]] },
        "original-date": { "date-parts": [[1936]] },
        edition: "3rd",
        "publisher-place": "Bombay",
      },
      identifiers: ia("in.ernet.dli.2015.71655"),
      license: {
        status: "copyrighted",
        note: "Public domain in India since 1 January 2017 (Ambedkar died 6 December 1956). Probably not public domain in the US: the 1936 first edition was likely restored by the URAA. Quoted briefly.",
      },
      lenses: ["primary_source"],
      note: "Do not use the Internet Archive item AnnihilationOfCasteDr.B.r.ambedkar: it is the copyrighted 2014 annotated edition.",
    },
    {
      op: "create_source",
      ref: "s_hc19460219",
      kind: "other",
      tier: "primary",
      csl: { type: "speech", title: "India (Cabinet Ministers' Mission)", "container-title": "Hansard, House of Commons Debates", volume: "419", page: "964–966", author: [{ family: "Attlee", given: "C. R." }], issued: { "date-parts": [[1946, 2, 19]] }, URL: CAPTURES.hc19460219.url },
      identifiers: { url: CAPTURES.hc19460219.url },
      license: OPL,
      lenses: ["colonial_orientalist"],
    },
    {
      op: "create_source",
      ref: "s_hc19460222",
      kind: "other",
      tier: "primary",
      csl: { type: "speech", title: "Royal Indian Navy (Mutiny)", "container-title": "Hansard, House of Commons Debates", volume: "419", page: "1441–1443", author: [{ family: "Attlee", given: "C. R." }], issued: { "date-parts": [[1946, 2, 22]] }, URL: CAPTURES.hc19460222.url },
      identifiers: { url: CAPTURES.hc19460222.url },
      license: OPL,
      lenses: ["colonial_orientalist"],
    },
    {
      op: "create_source",
      ref: "s_hc19460226",
      kind: "other",
      tier: "primary",
      csl: { type: "speech", title: "India (Naval Mutiny and Civil Disturbances)", "container-title": "Hansard, House of Commons Debates", volume: "419", page: "1750–1753", author: [{ family: "Attlee", given: "C. R." }], issued: { "date-parts": [[1946, 2, 26]] }, URL: CAPTURES.hc19460226.url },
      identifiers: { url: CAPTURES.hc19460226.url },
      license: OPL,
      lenses: ["colonial_orientalist"],
    },
    {
      op: "create_source",
      ref: "s_hl19470220",
      kind: "other",
      tier: "primary",
      csl: { type: "speech", title: "Indian Policy", "container-title": "Hansard, House of Lords Debates", volume: "145", page: "835–841", author: [{ literal: "Lord Pethick-Lawrence" }], issued: { "date-parts": [[1947, 2, 20]] }, URL: CAPTURES.hl19470220.url },
      identifiers: { url: CAPTURES.hl19470220.url },
      license: OPL,
      lenses: ["colonial_orientalist"],
      note: "The government's statement of 20 February 1947, read in the Lords by the Secretary of State for India and in the Commons by the Prime Minister.",
    },
    {
      op: "create_source",
      ref: "s_iia1947",
      kind: "other",
      tier: "primary",
      csl: {
        type: "document",
        title: "Indian Independence Act, 1947 (10 & 11 Geo. 6 c. 30)",
        author: [{ literal: "Parliament of the United Kingdom" }],
        issued: { "date-parts": [[1947, 7, 18]] },
        URL: "https://www.legislation.gov.uk/ukpga/Geo6/10-11/30/enacted",
      },
      identifiers: { url: "https://www.legislation.gov.uk/ukpga/Geo6/10-11/30/enacted" },
      license: { status: "public_domain", note: "UK Act of 1947: Crown copyright has expired; Wikisource tags it PD-UKGov." },
      note: "Quoted from the validated Wikisource transcription of the King's Printer copy (Page:Indian Independence Act 1947.djvu/3, revision 15002852, and /6, revision 15002858), because legislation.gov.uk refused automated capture.",
    },
    wpSource("s_wp_1857", "wp1857"),
    wpSource("s_wp_chauri", "wpChauri"),
    wpSource("s_wp_bhagat", "wpBhagat"),
    wpSource("s_wp_salt", "wpSalt"),
    wpSource("s_wp_lahore", "wpLahore"),
    wpSource("s_wp_famine", "wpFamine"),
    wpSource("s_wp_ina", "wpINA"),
    wpSource("s_wp_partition", "wpPartition"),
    // Modern scholarship (copyrighted), by location only, as cited by Wikipedia.
    {
      op: "create_source",
      ref: "s_talbot_singh",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Partition of India", author: [{ family: "Talbot", given: "Ian" }, { family: "Singh", given: "Gurharpal" }], issued: { "date-parts": [[2009]] }, publisher: "Cambridge University Press" },
      identifiers: { isbn: ["978-0-521-85661-4"] },
      license: { status: "copyrighted", note: "Cited by location only; not quoted." },
      lenses: ["mainstream_academic"],
    },
    {
      op: "create_source",
      ref: "s_maharatna",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "The Demography of Famines: An Indian Historical Perspective", author: [{ family: "Maharatna", given: "Arup" }], issued: { "date-parts": [[1996]] }, publisher: "Oxford University Press" },
      identifiers: { isbn: ["978-0-19-563711-3"] },
      license: { status: "copyrighted", note: "Cited by location only; not quoted." },
      lenses: ["mainstream_academic"],
    },
    {
      op: "create_source",
      ref: "s_bose_jalal",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Modern South Asia: History, Culture, Political Economy", author: [{ family: "Bose", given: "Sugata" }, { family: "Jalal", given: "Ayesha" }], issued: { "date-parts": [[2004]] }, publisher: "Routledge" },
      identifiers: { isbn: ["978-0-415-30787-1"] },
      license: { status: "copyrighted", note: "Cited by location only; not quoted." },
      lenses: ["mainstream_academic"],
    },
    {
      op: "create_source",
      ref: "s_sarkar",
      kind: "book",
      tier: "secondary",
      csl: { type: "book", title: "Modern India, 1885–1947", author: [{ family: "Sarkar", given: "Sumit" }], issued: { "date-parts": [[1983]] }, publisher: "Macmillan" },
      identifiers: { isbn: ["978-0-333-90425-1"] },
      license: { status: "copyrighted", note: "Cited by location only; not quoted." },
      lenses: ["mainstream_academic", "marxist"],
    },
  ];

  // ------------------------------------------------------------ excerpts
  type Loc = { page?: string; pageEnd?: string; chapter?: string; section?: string; label?: string };
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

  // 1857
  x("x_marx_cartridges", "s_marx", "marx", "The serving out of cartridges, the paper of which was said to have been greased with the fat of bullocks and pigs, and the compulsory biting of which was, therefore, considered by the natives as an infringement of their religious prescriptions, gave the signal for local disturbances.", { page: "36", label: "“The Revolt in the Indian Army”, written 30 June 1857, New-York Daily Tribune, 15 July 1857" });
  x("x_marx_combined", "s_marx", "marx", "It is the first time that sepoy regiments have murdered their European officers; that Mussulmans and Hindus, renouncing their mutual antipathies, have combined against their common masters", { page: "36", label: "“The Revolt in the Indian Army”, written 30 June 1857" });
  x("x_proclamation", "s_naoroji", "naoroji", "We hold ourselves bound to the Natives of our Indian territories by the same obligations of duty which bind us to all our other subjects", { label: "Epigraph “Britain's solemn pledges”, unnumbered page before the Introduction" }, "Naoroji quoting the Queen's Proclamation of 1858. The words recur twice later in the book; this is the first occurrence.");
  x("x_wp_proclamation", "s_wp_1857", "wp1857", "On 1 November 1858, Queen Victoria issued a proclamation to Indians, which, while lacking the authority of a constitutional provision, promised rights similar to those of other British subjects.", { section: "Aftermath" });
  x("x_disraeli_q", "s_hc1857", "hc1857", "Is it a military mutiny, or is it a national revolt?", { page: "442", label: "Disraeli, col. 442" });
  x("x_disraeli_cartridges", "s_hc1857", "hc1857", "The decline and fall of empires are not affairs of greased cartridges.", { page: "475", label: "Disraeli, col. 475" });
  x("x_vernonsmith", "s_hc1857", "hc1857", "there are not the slightest symptoms of the mutiny being a national revolt.", { page: "482", label: "R. Vernon Smith, President of the Board of Control, col. 482" });
  x("x_mangles", "s_hc1857", "hc1857", "so far from this being a national revolt, the simple truth was that where there were no Sepoys there had been no revolt.", { page: "526", label: "R. D. Mangles, col. 526" });
  x("x_malleson_cartridge", "s_malleson", "malleson", "But the greased cartridge was never issued to the great body of the troops, if indeed to any.", { page: "v", label: "Preface" });
  x("x_malleson_national", "s_malleson", "malleson", "extraneous causes were at work to promote an ill-feeling, a hatred not personal but national, in the minds of men who for a century had been our truest and most loyal servants.", { page: "viii", label: "Preface" });
  x("x_savarkar_intro", "s_savarkar", "savarkar", "I found to my great surprise the brilliance of a War of Independence shining in \"the mutiny of 1857.\"", { page: "vii", label: "Author's Introduction" });
  // Early Congress
  x("x_bonnerjee_first", "s_inc1909", "inc1909", "he might well be proud of being thus called on to preside over the first National Assembly ever yet convened in India.", { page: "1", label: "Part II, Congress Presidential Addresses: “First Congress — Bombay — 1885”, W. C. Bonnerjee" }, "The address is reported in the third person.");
  x("x_bonnerjee_loyal", "s_inc1909", "inc1909", "All that they desired was that the basis of the government should be widened and that the people should have their proper and legitimate share in it.", { page: "4", label: "Part II, Bonnerjee's address, 1885" });
  x("x_bonnerjee_loyal2", "s_inc1909", "inc1909", "there were no more thoroughly loyal and consistent well-wishers of the British government than were himself and the friends around him.", { page: "4", label: "Part II, Bonnerjee's address, 1885" });
  x("x_1885_res3", "s_inc1909", "inc1909", "That this Congress considers the reform and expansion of the Supreme and existing Local Legislative Councils, by the admission of a considerable proportion of elected members", { page: "1", label: "Part III, Congress Resolutions: First Congress, 1885, resolution 3" });
  x("x_1885_res4", "s_inc1909", "inc1909", "the competitive examinations now held in England for first appointments in various civil departments of the public service should henceforth in accordance with the views of the India Office Committee of 1860, \"be held simultaneously, one in England and one in India,", { page: "1", label: "Part III, Congress Resolutions: First Congress, 1885, resolution 4" });
  x("x_drain", "s_naoroji", "naoroji", "making now the evil of the \"bleeding\" and impoverishing drain by the foreign dominion nearly or above £30,000,000 a year in a variety of subtle ways and shapes", { page: "viii", label: "Introduction" });
  // Swadeshi and Swaraj
  x("x_1906_boycott", "s_inc1909", "inc1909", "this Congress is of opinion that the Boycott Movement inaugurated in Bengal by way of protest against the partition of that province was and is legitimate.", { page: "164", label: "Part III, Congress Resolutions: Twenty-second Congress, Calcutta, 1906" });
  x("x_1906_swadeshi", "s_inc1909", "inc1909", "to promote the growth of indigenous industries and to stimulate the production of indigenous articles by giving them preference over imported commodities even at some sacrifice.", { page: "164", label: "Part III, Congress Resolutions: Twenty-second Congress, Calcutta, 1906" });
  x("x_naoroji1906", "s_inc1909", "inc1909", "the whole matter can be comprised in one word — \"Self-government\" or Swaraj like that of the United Kingdom or the Colonies.", { page: "863", label: "Part II, presidential address of Dadabhai Naoroji, Calcutta, 1906" });
  x("x_hs_tiger", "s_hindswaraj", "hindswaraj", "In effect it means this : that we want English rule without the Englishman. You want the tiger's nature, but not the tiger", { page: "15", chapter: "IV", label: "Chapter IV, “What is Swaraj?”" });
  x("x_mc_1917", "s_montchelm", "montchelm", "the increasing association of Indians in every branch of the administration and the gradual development of self-governing institutions with a view to the progressive realisation of responsible government in India as an integral part of the British Empire.", { page: "4", label: "Part I, chapter I, para. 6 (page inferred from the running header)" }, "The report quotes the announcement made by the Secretary of State in the House of Commons on 20 August 1917.");
  x("x_mc_1917_date", "s_montchelm", "montchelm", "On August 20, 1917, the Secretary of State for India made the following- announcement in the House of Commons", { page: "4", label: "Part I, chapter I, para. 6" }, "“following-” is the OCR's reading.");
  // Amritsar
  x("x_hunter_first", "s_hunter", "hunter", "The first outbreak occurred in Delhi", { page: "1", label: "Majority report, chapter I (Delhi), para. 1" });
  x("x_hunter_rowlatt", "s_hunter", "hunter", "(i.e.,- a shutting of shops) was held in the city, as part of Mr. Gandhi's passive resistance movement against what is known as the Rowlatt legislation.", { page: "1", label: "Majority report, chapter I (Delhi), para. 1" }, "The quote begins inside the sentence “On 30th March a hartal (i.e., a shutting of shops) was held…”, whose opening the OCR garbles.");
  x("x_hunter_nowarning", "s_hunter", "hunter", "Without giving the crowd any warning to disperse, which he considered unnecessary as they were in breach of his proclamation, he ordered his troops to fire and the firing was continued for about 10 minutes.", { page: "44", label: "Majority report, chapter III (Amritsar), para. 38" });
  x("x_hunter_grave", "s_hunter", "hunter", "In continuing to fire for so long as he did it appears to us that General Dyer committed a grave error.", { page: "46", label: "Majority report, para. 40" });
  x("x_hunter_mistaken", "s_hunter", "hunter", "In our view this was unfortunately a mistaken conception of his duty.", { page: "47", label: "Majority report, para. 40" });
  x("x_hunter_minority", "s_hunter", "hunter", "We have no doubt that he did succeed in creating a very wide impression and a great moral effect, but of a character quite opposite to the one he intended.", { page: "193", label: "Minority report (Setalvad, Jagat Narayan, Sultan Ahmed Khan), chapter IV (page inferred from footers)" });
  x("x_inc_calculated", "s_incpunjab", "incpunjab", "The Jalleanwalla Bagh massacre was a calculated piece of inhumanity towards utterly innocent and unarmed men, including children, and unparalleled for its ferocity in the history of modern British administration.", { page: "158", label: "Chapter VI, “Conclusion”, finding 14" });
  x("x_hunter_379", "s_hunter", "hunter", "As a result of this investigation it was discovered that approximately 379 people were killed.", { page: "45", label: "Majority report, chapter III" });
  x("x_hunter_1200", "s_hunter", "hunter", "In all 1,650 rounds were fired, and the casualties have now been ascertained to be at least 379 killed and about 1,200 wounded.", { page: "187", label: "Minority report" });
  x("x_inc_1000", "s_incpunjab", "incpunjab", "The exact figure will never be known, but after careful investigation, we consider that Lala Girdhari Lal's computation of 1000 is by no means an exaggerated calculation.", { page: "57", label: "Chapter V, “The Martial Law (Amritsar)”" });
  x("x_chauri_gandhi", "s_youngindia", "youngindia", "God has been abundantly kind to me. He has warned me the third time that there is not as yet in India that truthful and non-violent atmosphere which, and which alone, can justify mass disobedience", { page: "993", label: "“The Crime of Chauri Chaura” (Young India, 16 February 1922)" });
  x("x_wp_chauri_halt", "s_wp_chauri", "wpChauri", "Mohandas Gandhi halted the non-cooperation movement on the national level on 12 February 1922 as a direct result of the incident.", { section: "Lead" });
  x("x_wp_chauri_fire", "s_wp_chauri", "wpChauri", "In retaliation, the demonstrators attacked and set fire to a police station, killing all of its occupants.", { section: "Lead" });
  // 1929–36
  x("x_purna_sever", "s_iar1930", "iar1930", "We believe therefore that India must sever the British connection and attain Purna Swaraj or complete independence.", { page: "334", label: "All India Congress Committee: “Purna Swarajya Independence Day”, the pledge" });
  x("x_purna_day", "s_iar1930", "iar1930", "The following resolution was issued on behalf of the Working Committee for adoption by public meetings all over the country on Purna Swarajya Day, Sunday January 26th, 1930", { page: "334", label: "All India Congress Committee: “Purna Swarajya Independence Day”" });
  x("x_purna_income", "s_iar1930", "iar1930", "Our average income is seven pice (less than two pence) per day", { page: "334", label: "The Purna Swaraj pledge" });
  x("x_purna_culture", "s_iar1930", "iar1930", "Culturally, the system of education has torn us from our moorings and our training has made us hug the very chains that bind us", { page: "334", label: "The Purna Swaraj pledge" });
  x("x_salt_tax", "s_iar1930", "iar1930", "I regard this tax to be the most iniquitous of all from the poor man's stand-point. As the Independence movement is essentially for the poorest in the land, a beginning will be made with this evil.", { label: "Gandhi's letter to the Viceroy of 2 March 1930, printed as “Mahatma's second letter to Viceroy” (page number illegible in the OCR)" });
  x("x_wp_salt", "s_wp_salt", "wpSalt", "The 24-day march (padayatra) lasted from 12 March 1930 to 6 April 1930 as a direct action campaign of tax resistance and nonviolent protest against the British salt monopoly.", { section: "Lead" });
  x("x_women_salt", "s_iar1930", "iar1930", "Women in villages have already begun manufacturing contraband salt, but we women should find out an additional and special field of our activity.", { page: "41", label: "Chronicle of events, 28 April 1930: “Gujrat Women's letter to the Viceroy”" });
  x("x_women_picket", "s_iar1930", "iar1930", "We easily accepted Mr. Gandhi's suggestion that we are better fitted to carry out the boycott of foreign cloth and the prohibition of liquor through picketing.", { page: "41", label: "Chronicle of events, 28 April 1930: “Gujrat Women's letter to the Viceroy”" });
  x("x_bhagat_deaf", "s_bhagat", "bhagat", "Our sole purpose was \"to make the deaf hear\" and to give the heedless a timely warning.", { section: "Bomb Needed" });
  x("x_wp_bhagat_date", "s_wp_bhagat", "wpBhagat", "On 8 April 1929, Singh, accompanied by Batukeshwar Dutt, threw two bombs into the Assembly chamber from its public gallery while it was in session.", { section: "Assembly bombing" });
  x("x_bhagat_utopian", "s_bhagat", "bhagat", "We have only marked the end of an era of Utopian non-violence, of whose futility the rising generation has been convinced beyond the shadow of doubt.", { section: "Bomb Needed" });
  x("x_bhagat_revolution", "s_bhagat", "bhagat", "\"Revolution\" does not necessarily involve sanguinary strife nor is there any place in it for individual vendetta. It is not the cult of the bomb and the pistol.", { section: "No Miracle (following paragraphs)" });
  x("x_ambedkar_tyranny", "s_ambedkar", "ambedkar", "Political tyranny is nothing compared to social tyranny and a reformer, who defies society, is a much more courageous man than a politician, who defies Government.", { page: "57" });
  x("x_ambedkar_swaraj", "s_ambedkar", "ambedkar", "Without such internal strength, Swaraj for Hindus may turn out to be only a step towards slavery.", { page: "81", label: "End of the address" });
  x("x_ambedkar_cancelled", "s_ambedkar", "ambedkar", "The Reception Committee of the Mandal has now cancelled the Conference. The notice of cancellation came long after my Presidential address had been printed.", { page: "ii", label: "Prologue (page inferred)" });
  // One nation or two
  x("x_hs_onenation", "s_hindswaraj", "hindswaraj", "India cannot cease to be one nation because people belonging to different religions live in it.", { page: "38", chapter: "X", label: "Chapter X, “The Condition of India: the Hindus and the Mahomedans”" });
  x("x_jinnah_dream", "s_iar1940", "iar1940", "it is only a dream that Hindus and Moslems can ever evolve a common nationality.", { page: "309", label: "All India Muslim League, Lahore session, presidential address (page inferred)" });
  x("x_jinnah_civ", "s_iar1940", "iar1940", "they belong to two different civilizations which are based mainly on conflicting ideas and conceptions.", { page: "309", label: "All India Muslim League, Lahore session, presidential address (page inferred)" });
  x("x_lahore_res", "s_iar1940", "iar1940", "the areas in which the Muslims are numerically in a majority, as in the north-western and eastern zones of India, should be grouped to constitute 'independent states' in which the constituent units shall be autonomous and sovereign.", { page: "312", label: "All India Muslim League, proceedings and resolutions, resolution 3" });
  x("x_wp_lahore", "s_wp_lahore", "wpLahore", "The Lahore Resolution, later called the Pakistan Resolution, was a formal political declaration, adopted by the All-India Muslim League on 23 March 1940, that served as the foundational basis for the Pakistan Movement.", { section: "Lead" });
  x("x_azad_1940", "s_iar1940", "iar1940", "I am proud of being an Indian. I am a part of the indivisible unity that is Indian nationality.", { page: "299", label: "Indian National Congress, Ramgarh session, presidential address, “Islam's Contribution to India”" });
  x("x_quit_ending", "s_iar1942", "iar1942", "the immediate ending of British rule in India is an urgent necessity, both for the sake of India and for the success of the cause of the United Nations.", { page: "209", pageEnd: "211", label: "Appendix III(2), “Text of the resolution adopted by the All-India Congress Committee on 8th August 1942” (pages inferred)" });
  x("x_quit_struggle", "s_iar1942", "iar1942", "The Committee resolves, therefore to sanction, for the vindication of India's inalienable right to freedom and independence, the starting of a mass struggle on non-violent lines on the widest possible scale", { page: "211", label: "Appendix III(2), AICC resolution of 8 August 1942 (page inferred)" }, "Poor OCR in this appendix; the match is approximate. A better witness is needed.");
  x("x_tottenham", "s_iar1942", "iar1942", "bearing on the responsibility of Mr. Gandhi and the Congress High Command for the disturbances which followed the sanctioning of a mass movement by the A. I. C. C.", { page: "176", label: "Preface by R. Tottenham to Congress Responsibility for the Disturbances 1942–43 (page inferred)" });
  // War, famine, mutiny
  x("x_wp_famine", "s_wp_famine", "wpFamine", "An estimated 800,000–3.8 million people died, in the Bengal region (present-day Bangladesh and West Bengal), from starvation, malaria and other diseases aggravated by malnutrition", { section: "Lead" });
  x("x_maharatna", "s_maharatna", null, null, { page: "214", pageEnd: "231", label: "Review of the mortality estimates (table 5.1, p. 215)" }, "Location as given by Wikipedia's note on the estimates; not checked against the book.");
  x("x_rin_start", "s_hc19460222", "hc19460222", "On Monday, 18th February, all ratings except chief petty officers and petty officers in h. M.I.S. Talwar, R.I.N. Signal School, Bombay, refused duty.", { page: "1441", label: "Prime Minister's statement, col. 1441" });
  x("x_rin_7000", "s_hc19460222", "hc19460222", "On Wednesday, 20th February, the situation in Bombay became more serious, 7,000 ratings having joined the mutiny.", { page: "1442", label: "Prime Minister's statement, col. 1442" });
  x("x_rin_congress", "s_hc19460222", "hc19460222", "The Congress Party officially disclaim participation in the mutiny, but Left Wing elements and Communists are trying to work up sympathy", { page: "1442", label: "Prime Minister's statement, col. 1442" });
  x("x_rin_leaders", "s_hc19460226", "hc19460226", "Both Congress and Muslim League leaders co-operated in condemning and attempting to stop the disturbances", { page: "1752", label: "Prime Minister's statement, col. 1752" });
  x("x_cabinet_mission", "s_hc19460219", "hc19460219", "His Majesty's Government have decided to send out to India a special mission composed of Cabinet Ministers to seek in assocation with the Viceroy an agreement with these leaders on the principles and procedure relating to the constitutional issue.", { page: "964", label: "Prime Minister's statement, cols. 964–965" }, "“assocation” is the transcription's spelling.");
  x("x_wp_ina", "s_wp_ina", "wpINA", "Historians such as Sumit Sarkar, Sugata Bose, and Ayesha Jalal conclude that the INA trials and its after-effects brought a decisive shift in British policy towards independence Indian.", { section: "Impact on the independence movement" }, "Sic: the article's wording.");
  x("x_bose_jalal", "s_bose_jalal", null, null, { page: "134" }, "Location as given by Wikipedia's citation; not checked against the book.");
  x("x_sarkar", "s_sarkar", null, null, { page: "412" }, "Location as given by Wikipedia's citation; not checked against the book.");
  // 1947
  x("x_feb1947", "s_hl19470220", "hl19470220", "His Majesty's Government wish to make it clear that it is their definite intention to take the necessary steps to effect the transference of power into responsible Indian hands by a date not later than June, 1948.", { page: "836", label: "Statement, para. 7, col. 836" });
  x("x_iia_s1", "s_iia1947", "iia_p3", "As from the fifteenth day of August, nineteen hundred and forty-seven, two independent Dominions shall be set up in India, to be known respectively as India and Pakistan.", { section: "1(1)" });
  x("x_iia_s7", "s_iia1947", "iia_p6", "the suzerainty of His Majesty over the Indian States lapses, and with it, all treaties and agreements in force at the date of the passing of this Act between His Majesty and the rulers of Indian States", { section: "7(1)(b)" });
  x("x_wp_partition_displaced", "s_wp_partition", "wpPartition", "The partition displaced between 12 and 20 million people along religious lines", { section: "Lead" });
  x("x_wp_partition_deaths", "s_wp_partition", "wpPartition", "As of 2009, the estimates still varied between two hundred thousand and two million.", { section: "Lead" });
  x("x_talbot_singh", "s_talbot_singh", null, null, { page: "2" }, "Location as given by Wikipedia's citation for the range of death estimates; not checked against the book.");
  // Non-violence (the source of a popular belief)
  x("x_hs_passive", "s_hindswaraj", "hindswaraj", "Passive resistance is a method of securing rights by personal suffering ; it is the reverse of resistance by arms.", { page: "77", label: "Chapter XVII, “Passive Resistance”" });
  x("x_purna_nonviolence", "s_iar1930", "iar1930", "We recognise, however, that the most effective way of gaining our freedom is not through violence.", { page: "334", label: "The Purna Swaraj pledge" });

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

  // 1857
  c("c_1857_cartridges", {
    text: "Marx, reporting in 1857, said the first disturbances were set off by cartridges said to be greased with the fat of cattle and pigs, which the sepoys had to bite against their religious rules.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "A contemporary report from London, not an eyewitness account. Historians agree the cartridge rumour was the trigger; how far the cartridges were actually issued is disputed (see Malleson below).",
    when: { start: d(1857) },
    themes: ["war", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("revolt1857") }, { entity: e("marx"), role: "mention" }],
    learning: { prompt: "What rumour set off the revolt of 1857?", answer: "That the new rifle cartridges, which soldiers had to bite, were greased with cow and pig fat." },
  });
  c("c_1857_hindu_muslim", {
    text: "Writing as the revolt unfolded, Marx noted that for the first time Muslim and Hindu sepoys had set aside their differences and combined against their British masters.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1857, 6, 30), basis: "Article written 30 June 1857" },
    themes: ["war", "religion"],
    lenses: ["marxist", "primary_source"],
    entities: [{ entity: e("revolt1857") }, { entity: e("marx"), role: "mention" }],
  });
  c("c_proclamation_1858", {
    text: "After the revolt, Queen Victoria's proclamation of November 1858 promised Indians the same obligations of duty as her other subjects; Naoroji later quoted it back at British rule.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The date comes from Wikipedia; the words are checked in Naoroji's quotation, not in the Proclamation itself.",
    when: { start: d(1858, 11, 1) },
    themes: ["polity", "governance"],
    entities: [{ entity: e("revolt1857"), role: "mention" }, { entity: e("naoroji"), role: "mention" }],
  });
  c("c_disraeli_1857", {
    text: "In the House of Commons in July 1857, Disraeli asked whether the outbreak was a military mutiny or a national revolt, and said empires do not fall over greased cartridges.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1857, 7, 27) },
    themes: ["historiography", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("disraeli") }, { entity: e("revolt1857"), role: "mention" }],
  });
  c("c_govt_mutiny_1857", {
    text: "Replying in the same debate, the minister for India, R. Vernon Smith, saw no sign of a national revolt, and R. D. Mangles said that where there were no sepoys there had been no revolt.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1857, 7, 27) },
    themes: ["historiography", "war"],
    lenses: ["colonial_orientalist", "primary_source"],
    entities: [{ entity: e("revolt1857"), role: "mention" }],
  });
  c("c_malleson_causes", {
    text: "The British officer and historian G. B. Malleson argued in 1891 that the greased cartridge was never issued to most of the troops, and that other causes had bred a hatred that was national, not personal.",
    kind: "interpretation",
    assessment: "supported",
    themes: ["historiography", "war"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("revolt1857"), role: "mention" }],
  });
  c("c_savarkar_war", {
    text: "In 1909 V. D. Savarkar recast “the mutiny of 1857” as India's War of Independence.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1909) },
    themes: ["historiography"],
    lenses: ["nationalist"],
    entities: [{ entity: e("savarkar") }, { entity: e("revolt1857"), role: "mention" }],
    learning: { prompt: "Who recast 1857 as India's War of Independence, and when?", answer: "V. D. Savarkar, in 1909." },
  });
  // Early Congress
  c("c_inc_1885", {
    text: "The first Indian National Congress met in Bombay in December 1885. Its president, W. C. Bonnerjee, called it the first national assembly ever held in India, and said its members were loyal to British rule and wanted only a proper share in government.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1885, 12, 28), basis: "Wikidata Q10225 (inception)" },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("inc") }, { entity: e("bonnerjee"), role: "participant" }, { entity: e("bombay"), role: "place" }],
    learning: { prompt: "Did the first Congress (1885) ask for independence?", answer: "No. Its president professed loyalty and asked for a proper share in government." },
  });
  c("c_1885_demands", {
    text: "The first Congress asked for elected members in the legislative councils, and for the civil-service examinations to be held in India as well as in England.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1885, 12) },
    themes: ["governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("inc") }],
  });
  c("c_drain", {
    text: "Dadabhai Naoroji argued that British rule drained India's wealth to Britain, by his estimate nearly or above £30 million a year.",
    kind: "interpretation",
    assessment: "supported",
    assessmentNote: "This is Naoroji's argument and his figure. Economic historians still debate how to measure the drain.",
    when: { start: d(1901), basis: "Collected in 1901" },
    themes: ["economy"],
    lenses: ["nationalist"],
    entities: [{ entity: e("naoroji") }],
    learning: { prompt: "What was Naoroji's “drain” argument?", answer: "That British rule took India's wealth to Britain every year, nearly or above £30 million by his estimate." },
  });
  // Swadeshi and Swaraj
  c("c_swadeshi_1906", {
    text: "At Calcutta in 1906 the Congress declared the boycott of British goods, begun in Bengal against its partition, legitimate, and urged swadeshi: preferring Indian-made goods even at some sacrifice.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1906, 12) },
    themes: ["economy", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("inc") }, { entity: e("bengal1905"), role: "mention" }, { entity: e("calcutta"), role: "place" }],
  });
  c("c_naoroji_swaraj_1906", {
    text: "Presiding over the Congress in 1906, Naoroji summed up its demand in one word, Swaraj, meaning self-government like that of the United Kingdom or the colonies.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1906, 12) },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("naoroji") }, { entity: e("inc") }, { entity: e("calcutta"), role: "place" }],
    learning: { prompt: "What did Swaraj mean when Naoroji used it in 1906?", answer: "Self-government like that of the United Kingdom or the colonies, not full separation." },
  });
  c("c_hindswaraj_tiger", {
    text: "In Hind Swaraj (1909) Gandhi criticised those who wanted “English rule without the Englishman”: the tiger's nature, but not the tiger.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1909) },
    themes: ["polity", "culture"],
    lenses: ["primary_source"],
    entities: [{ entity: e("gandhi") }],
  });
  c("c_aug1917", {
    text: "On 20 August 1917 the British government announced its aim in India as the gradual development of self-governing institutions, towards responsible government within the British Empire.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1917, 8, 20) },
    themes: ["governance", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("montagu") }],
  });
  // Amritsar
  c("c_rowlatt", {
    text: "The disorders of 1919 began with a hartal, a shutting of shops, in Delhi on 30 March, part of Gandhi's passive-resistance movement against the Rowlatt legislation, according to the Hunter Committee.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1919, 3, 30) },
    themes: ["polity"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("gandhi"), role: "participant" }, { entity: e("delhi"), role: "place" }],
  });
  c("c_jallianwala_firing", {
    text: "On 13 April 1919, at Jallianwala Bagh in Amritsar, troops under General Dyer fired on a crowd without warning, for about ten minutes.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1919, 4, 13), basis: "Wikidata Q208855 (point in time)" },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("jallianwala") }, { entity: e("dyer"), role: "participant" }, { entity: e("jbagh"), role: "place" }],
    learning: { prompt: "What happened at Jallianwala Bagh on 13 April 1919?", answer: "Troops under General Dyer fired on a crowd without warning, for about ten minutes." },
  });
  c("c_jallianwala_hunter_verdict", {
    text: "The official Hunter Committee judged that Dyer committed a grave error in firing for so long, from a mistaken conception of his duty.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1920) },
    themes: ["war", "governance"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("jallianwala") }, { entity: e("dyer"), role: "mention" }],
  });
  c("c_jallianwala_minority", {
    text: "The committee's three Indian members wrote separately that the firing did make a great moral effect, but the opposite of the one Dyer intended.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1920) },
    themes: ["war"],
    lenses: ["nationalist"],
    entities: [{ entity: e("jallianwala") }],
  });
  c("c_jallianwala_inc_verdict", {
    text: "The Congress's own inquiry called the massacre a calculated piece of inhumanity towards utterly innocent and unarmed people, including children.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1920) },
    themes: ["war"],
    lenses: ["nationalist"],
    entities: [{ entity: e("jallianwala") }, { entity: e("inc"), role: "mention" }],
  });
  c("c_toll_hunter", {
    text: "The Hunter Committee put the dead at Jallianwala Bagh at about 379; its minority report gave at least 379 killed and about 1,200 wounded, from 1,650 rounds fired.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The official count. Both inquiries drew on lists compiled by a local relief society, the Seva Samiti.",
    themes: ["war"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("jallianwala") }],
  });
  c("c_toll_inc", {
    text: "The Congress inquiry judged a local estimate of about 1,000 dead at Jallianwala Bagh to be “by no means an exaggerated calculation”.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "The Congress commissioners' judgement; they say the exact figure will never be known.",
    themes: ["war"],
    lenses: ["nationalist"],
    entities: [{ entity: e("jallianwala") }],
  });
  c("c_chauri_chaura", {
    text: "In February 1922, after a crowd at Chauri Chaura set fire to a police station and killed the policemen inside, Gandhi called off the non-cooperation movement, saying India was not yet non-violent enough for mass disobedience.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1922, 2, 4), end: d(1922, 2, 12) },
    themes: ["war", "polity"],
    entities: [{ entity: e("chauri") }, { entity: e("ncm") }, { entity: e("gandhi"), role: "participant" }, { entity: e("chaurichaura"), role: "place" }],
    foundVia: ["wpChauri"],
    learning: { prompt: "Why did Gandhi call off the non-cooperation movement in 1922?", answer: "After a crowd killed policemen at Chauri Chaura; he said India was not yet non-violent enough for mass disobedience." },
  });
  // 1929–36
  c("c_purna_swaraj", {
    text: "On 26 January 1930 the Congress asked meetings across India to adopt a pledge that India must sever the British connection and attain Purna Swaraj, complete independence.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1930, 1, 26) },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("purna") }, { entity: e("inc") }],
    learning: { prompt: "When did the Congress first make complete independence (Purna Swaraj) its pledge?", answer: "On 26 January 1930." },
  });
  c("c_purna_grievances", {
    text: "The 1930 pledge blamed British rule for India's poverty, putting average income at seven pice (less than two pence) a day, and said its education had torn Indians from their moorings.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1930, 1, 26) },
    themes: ["economy", "culture"],
    lenses: ["nationalist"],
    entities: [{ entity: e("purna") }],
  });
  c("c_salt_tax", {
    text: "Before the Salt March, Gandhi wrote to the Viceroy that the salt tax was the most iniquitous of all from the poor man's point of view; the march to the sea at Dandi lasted from 12 March to 6 April 1930.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1930, 3, 2), end: d(1930, 4, 6), basis: "Letter of 2 March 1930; march 12 March–6 April 1930" },
    themes: ["economy", "polity"],
    entities: [{ entity: e("salt") }, { entity: e("gandhi"), role: "participant" }, { entity: e("dandi"), role: "place" }, { entity: e("sabarmati"), role: "place" }],
    foundVia: ["wpSalt"],
    learning: { prompt: "Why did Gandhi choose the salt tax for civil disobedience in 1930?", answer: "He called it the most iniquitous tax from the poor man's point of view." },
  });
  c("c_women_1930", {
    text: "Women took part in the salt campaign: in April 1930 women of Gujarat told the Viceroy that village women were already making illegal salt, and that they would picket shops selling foreign cloth and liquor.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1930, 4, 28) },
    themes: ["society", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("salt") }],
  });
  c("c_assembly_bomb", {
    text: "On 8 April 1929 Bhagat Singh and B. K. Dutt threw two bombs into the Central Legislative Assembly chamber; they told the court their sole purpose was “to make the deaf hear”.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The statement survives here in a Wikisource transcription without a scan; the date comes from Wikipedia.",
    when: { start: d(1929, 4, 8) },
    themes: ["war", "polity"],
    entities: [{ entity: e("bombing") }, { entity: e("bhagat"), role: "participant" }, { entity: e("dutt"), role: "participant" }],
    foundVia: ["wpBhagat"],
  });
  c("c_bhagat_revolution", {
    text: "In their statement Bhagat Singh and Dutt rejected what they called Utopian non-violence, and said that revolution was not the cult of the bomb and the pistol.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1929, 6, 6) },
    themes: ["polity", "war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("bhagat") }, { entity: e("dutt") }],
  });
  c("c_ambedkar", {
    text: "In Annihilation of Caste (1936), a speech its Lahore hosts cancelled and Ambedkar then published, he argued that social tyranny was worse than political tyranny, and that without inner reform Swaraj for Hindus might be only a step towards slavery.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1936) },
    themes: ["society", "religion"],
    lenses: ["primary_source"],
    entities: [{ entity: e("ambedkar") }],
    learning: { prompt: "Why did Ambedkar think Swaraj alone was not enough?", answer: "He held social tyranny (caste) worse than political tyranny; without inner reform Swaraj for Hindus might be only a step towards slavery." },
  });
  // One nation or two
  c("c_gandhi_one_nation", {
    text: "Gandhi wrote in 1909 that India could not cease to be one nation because people of different religions lived in it.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1909) },
    themes: ["religion", "polity"],
    lenses: ["nationalist"],
    entities: [{ entity: e("gandhi") }],
  });
  c("c_jinnah_two_nations", {
    text: "At Lahore in March 1940 Jinnah told the Muslim League that Hindus and Muslims belonged to two different civilisations and could never evolve a common nationality.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1940, 3) },
    themes: ["religion", "polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("jinnah") }, { entity: e("league") }, { entity: e("lahore"), role: "place" }],
    learning: { prompt: "What was the “two-nation theory” as Jinnah put it in 1940?", answer: "That Hindus and Muslims belonged to two different civilisations and could never form a common nationality." },
  });
  c("c_lahore_resolution", {
    text: "On 23 March 1940 the Muslim League resolved that the Muslim-majority areas of the north-west and east should be grouped into “independent states”; the resolution became the basis of the demand for Pakistan.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1940, 3, 23) },
    themes: ["polity"],
    entities: [{ entity: e("lahore1940") }, { entity: e("league") }, { entity: e("lahore"), role: "place" }],
    foundVia: ["wpLahore"],
  });
  c("c_azad_one_nation", {
    text: "In the same month the Congress president, Maulana Azad, a Muslim, declared that he was proud to be an Indian and part of the indivisible unity of Indian nationality.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1940, 3) },
    themes: ["religion", "polity"],
    lenses: ["nationalist"],
    entities: [{ entity: e("azad") }, { entity: e("inc") }],
  });
  c("c_quit_india", {
    text: "On 8 August 1942, during the Second World War, the All-India Congress Committee demanded the immediate end of British rule and sanctioned a mass struggle on non-violent lines.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The text comes from a poor OCR of the resolution; the words match approximately.",
    when: { start: d(1942, 8, 8) },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("quitindia") }, { entity: e("inc") }, { entity: e("bombay"), role: "place" }],
    learning: { prompt: "What did the Congress resolve on 8 August 1942?", answer: "That British rule must end immediately, with a mass struggle on non-violent lines." },
  });
  c("c_quit_india_govt_blame", {
    text: "The Government of India blamed Gandhi and the Congress leadership for the disturbances that followed the Quit India resolution.",
    kind: "interpretation",
    assessment: "supported",
    when: { start: d(1943) },
    themes: ["polity", "war"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("quitindia") }, { entity: e("gandhi"), role: "mention" }],
  });
  // War, famine, mutiny
  c("c_bengal_famine", {
    text: "In 1943, during the war, a famine in Bengal killed an estimated 800,000 to 3.8 million people through starvation and disease.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The range is wide because estimates differ; a review of them is in Maharatna (1996), cited here by page only. How far wartime policy caused the famine is debated, and is not covered on this page yet.",
    when: { start: d(1943), end: d(1944) },
    themes: ["economy", "society"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("famine") }],
    foundVia: ["wpFamine"],
  });
  c("c_rin_mutiny", {
    text: "On 18 February 1946 Indian ratings at the naval signal school HMIS Talwar in Bombay refused duty; by 20 February, 7,000 had joined the mutiny, the British Prime Minister told Parliament.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1946, 2, 18), end: d(1946, 2, 20) },
    themes: ["war"],
    lenses: ["primary_source"],
    entities: [{ entity: e("rin") }, { entity: e("attlee"), role: "mention" }, { entity: e("bombay"), role: "place" }],
  });
  c("c_rin_leaders", {
    text: "The British government reported that the Congress officially disclaimed the naval mutiny, and that Congress and Muslim League leaders helped to condemn and stop the disturbances that followed.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The British government's account, given in Parliament.",
    when: { start: d(1946, 2, 22), end: d(1946, 2, 26) },
    themes: ["war", "polity"],
    lenses: ["colonial_orientalist"],
    entities: [{ entity: e("rin") }, { entity: e("inc"), role: "mention" }, { entity: e("league"), role: "mention" }],
  });
  c("c_cabinet_mission", {
    text: "On 19 February 1946 the British government announced that it would send Cabinet ministers to India to seek agreement with Indian leaders on the constitution.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1946, 2, 19) },
    themes: ["polity", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("cabinetmission") }, { entity: e("attlee"), role: "participant" }],
  });
  c("c_ina_decisive", {
    text: "Historians including Sumit Sarkar, Sugata Bose and Ayesha Jalal conclude that the INA trials and their after-effects brought a decisive shift in British policy towards Indian independence.",
    kind: "interpretation",
    assessment: "contested",
    assessmentNote: "Reported by Wikipedia, which cites Bose and Jalal (2004, p. 134) and Sarkar (1983, p. 412); those books are cited here by page only.",
    themes: ["polity", "historiography"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("inatrials") }, { entity: e("ina"), role: "mention" }],
    foundVia: ["wpINA"],
  });
  // 1947
  c("c_feb1947_deadline", {
    text: "On 20 February 1947 the British government announced that it would hand over power to Indian hands by June 1948 at the latest.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1947, 2, 20) },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("movement"), role: "mention" }],
    learning: { prompt: "What deadline did the British government set itself in February 1947?", answer: "To hand over power to Indian hands by June 1948 at the latest." },
  });
  c("c_iia_two_dominions", {
    text: "The Indian Independence Act 1947 set up two independent dominions, India and Pakistan, from 15 August 1947.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1947, 8, 15), basis: "In force from 15 August 1947; the Act passed on 18 July 1947" },
    themes: ["polity"],
    lenses: ["primary_source"],
    entities: [{ entity: e("partition") }, { entity: "independent-india", role: "mention" }],
    learning: { prompt: "What did the Indian Independence Act 1947 create, and from when?", answer: "Two independent dominions, India and Pakistan, from 15 August 1947." },
  });
  c("c_paramountcy_lapse", {
    text: "Under the 1947 Act, the Crown's suzerainty over the princely states lapsed, and with it all their treaties with Britain.",
    kind: "fact",
    assessment: "supported",
    when: { start: d(1947, 8, 15) },
    themes: ["polity", "governance"],
    lenses: ["primary_source"],
    entities: [{ entity: e("partition"), role: "mention" }],
  });
  c("c_partition_scale", {
    text: "Partition displaced between 12 and 20 million people; estimates of the dead range from about 200,000 to 2 million.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "The figures are wide because no reliable count was made. The death range is from Talbot and Singh (2009, p. 2), cited here by page only.",
    when: { start: d(1947) },
    themes: ["society", "war"],
    lenses: ["mainstream_academic"],
    entities: [{ entity: e("partition") }],
    foundVia: ["wpPartition"],
    learning: { prompt: "Roughly how many people did Partition displace, and how many died?", answer: "Between 12 and 20 million displaced; estimates of the dead range from about 200,000 to 2 million." },
  });
  // Misconceptions
  c("m_congress_always", {
    text: "The Indian National Congress demanded independence from its foundation in 1885.",
    kind: "misconception",
    assessment: "refuted",
    assessmentNote: "In 1885 its leaders professed loyalty and asked for a share in government; in 1906 Swaraj meant self-government like the colonies'; complete independence became the pledge only in 1930.",
    themes: ["polity"],
    lenses: ["popular"],
    entities: [{ entity: e("inc") }],
  });
  c("m_nonviolence_only", {
    text: "The independence movement was non-violent from start to finish, and non-violence alone won independence.",
    kind: "misconception",
    assessment: "weak",
    assessmentNote: "Mass non-violent campaigns were central, and their leaders chose non-violence deliberately. But the record also includes revolutionary violence, violence within campaigns meant to be non-violent, unrest in the armed forces and British decisions made for their own reasons. How much each mattered is argued over by historians; this page shows the evidence, not a ranking.",
    themes: ["polity", "historiography"],
    lenses: ["popular"],
    entities: [{ entity: e("gandhi"), role: "mention" }],
  });

  // ------------------------------------------------------------ citations
  const cite = (claim: string, excerpt: string, stance: "supports" | "contradicts" | "qualifies" | "mentions" = "supports", note?: string) =>
    ops.push({ op: "cite", claim: `@${claim}`, excerpt: `@${excerpt}`, stance, ...(note ? { note } : {}) });
  cite("c_1857_cartridges", "x_marx_cartridges");
  cite("c_1857_cartridges", "x_malleson_cartridge", "qualifies", "Malleson doubted the cartridge was ever issued to most troops.");
  cite("c_1857_hindu_muslim", "x_marx_combined");
  cite("c_proclamation_1858", "x_proclamation");
  cite("c_proclamation_1858", "x_wp_proclamation");
  cite("c_disraeli_1857", "x_disraeli_q");
  cite("c_disraeli_1857", "x_disraeli_cartridges");
  cite("c_govt_mutiny_1857", "x_vernonsmith");
  cite("c_govt_mutiny_1857", "x_mangles");
  cite("c_malleson_causes", "x_malleson_cartridge");
  cite("c_malleson_causes", "x_malleson_national");
  cite("c_savarkar_war", "x_savarkar_intro");
  cite("c_inc_1885", "x_bonnerjee_first");
  cite("c_inc_1885", "x_bonnerjee_loyal");
  cite("c_inc_1885", "x_bonnerjee_loyal2");
  cite("c_1885_demands", "x_1885_res3");
  cite("c_1885_demands", "x_1885_res4");
  cite("c_drain", "x_drain");
  cite("c_swadeshi_1906", "x_1906_boycott");
  cite("c_swadeshi_1906", "x_1906_swadeshi");
  cite("c_naoroji_swaraj_1906", "x_naoroji1906");
  cite("c_hindswaraj_tiger", "x_hs_tiger");
  cite("c_aug1917", "x_mc_1917");
  cite("c_aug1917", "x_mc_1917_date");
  cite("c_rowlatt", "x_hunter_first");
  cite("c_rowlatt", "x_hunter_rowlatt");
  cite("c_jallianwala_firing", "x_hunter_nowarning");
  cite("c_jallianwala_hunter_verdict", "x_hunter_grave");
  cite("c_jallianwala_hunter_verdict", "x_hunter_mistaken");
  cite("c_jallianwala_minority", "x_hunter_minority");
  cite("c_jallianwala_inc_verdict", "x_inc_calculated");
  cite("c_toll_hunter", "x_hunter_379");
  cite("c_toll_hunter", "x_hunter_1200");
  cite("c_toll_inc", "x_inc_1000");
  cite("c_chauri_chaura", "x_wp_chauri_fire");
  cite("c_chauri_chaura", "x_wp_chauri_halt");
  cite("c_chauri_chaura", "x_chauri_gandhi");
  cite("c_purna_swaraj", "x_purna_sever");
  cite("c_purna_swaraj", "x_purna_day");
  cite("c_purna_grievances", "x_purna_income");
  cite("c_purna_grievances", "x_purna_culture");
  cite("c_salt_tax", "x_salt_tax");
  cite("c_salt_tax", "x_wp_salt");
  cite("c_women_1930", "x_women_salt");
  cite("c_women_1930", "x_women_picket");
  cite("c_assembly_bomb", "x_bhagat_deaf");
  cite("c_assembly_bomb", "x_wp_bhagat_date");
  cite("c_bhagat_revolution", "x_bhagat_utopian");
  cite("c_bhagat_revolution", "x_bhagat_revolution");
  cite("c_ambedkar", "x_ambedkar_cancelled");
  cite("c_ambedkar", "x_ambedkar_tyranny");
  cite("c_ambedkar", "x_ambedkar_swaraj");
  cite("c_gandhi_one_nation", "x_hs_onenation");
  cite("c_jinnah_two_nations", "x_jinnah_dream");
  cite("c_jinnah_two_nations", "x_jinnah_civ");
  cite("c_lahore_resolution", "x_lahore_res");
  cite("c_lahore_resolution", "x_wp_lahore");
  cite("c_azad_one_nation", "x_azad_1940");
  cite("c_quit_india", "x_quit_ending");
  cite("c_quit_india", "x_quit_struggle");
  cite("c_quit_india_govt_blame", "x_tottenham");
  cite("c_bengal_famine", "x_wp_famine");
  cite("c_bengal_famine", "x_maharatna");
  cite("c_rin_mutiny", "x_rin_start");
  cite("c_rin_mutiny", "x_rin_7000");
  cite("c_rin_leaders", "x_rin_congress");
  cite("c_rin_leaders", "x_rin_leaders");
  cite("c_cabinet_mission", "x_cabinet_mission");
  cite("c_ina_decisive", "x_wp_ina");
  cite("c_ina_decisive", "x_bose_jalal");
  cite("c_ina_decisive", "x_sarkar");
  cite("c_feb1947_deadline", "x_feb1947");
  cite("c_iia_two_dominions", "x_iia_s1");
  cite("c_paramountcy_lapse", "x_iia_s7");
  cite("c_partition_scale", "x_wp_partition_displaced");
  cite("c_partition_scale", "x_wp_partition_deaths");
  cite("c_partition_scale", "x_talbot_singh");
  cite("m_congress_always", "x_bonnerjee_loyal2", "contradicts");
  cite("m_congress_always", "x_naoroji1906", "contradicts");
  cite("m_congress_always", "x_purna_sever", "qualifies", "Complete independence became the pledge in 1930.");
  cite("m_nonviolence_only", "x_hs_passive", "mentions", "Gandhi's method, a source of the belief.");
  cite("m_nonviolence_only", "x_purna_nonviolence", "mentions", "The 1930 pledge's commitment to non-violence.");
  cite("m_nonviolence_only", "x_chauri_gandhi", "contradicts", "Gandhi himself found the movement not yet non-violent.");
  cite("m_nonviolence_only", "x_bhagat_utopian", "contradicts");

  // ------------------------------------------------------------ relations
  const rel = (from: string, to: string, type: "corrects" | "contradicts" | "qualifies" | "supports" | "context_for", note?: string) =>
    ops.push({ op: "relate_claims", from: `@${from}`, to: `@${to}`, type, ...(note ? { note } : {}) });
  rel("c_inc_1885", "m_congress_always", "corrects");
  rel("c_naoroji_swaraj_1906", "m_congress_always", "corrects");
  rel("c_purna_swaraj", "m_congress_always", "qualifies", "Complete independence became the Congress pledge only in 1930.");
  rel("c_chauri_chaura", "m_nonviolence_only", "corrects", "Violence within a campaign meant to be non-violent; Gandhi halted it for that reason.");
  rel("c_bhagat_revolution", "m_nonviolence_only", "qualifies", "Revolutionaries rejected non-violence.");
  rel("c_rin_mutiny", "m_nonviolence_only", "qualifies", "Unrest in the armed forces in 1946.");
  rel("c_quit_india_govt_blame", "m_nonviolence_only", "qualifies", "The disturbances after the Quit India resolution.");
  rel("c_ina_decisive", "m_nonviolence_only", "qualifies");
  rel("c_govt_mutiny_1857", "c_disraeli_1857", "contradicts");
  rel("c_savarkar_war", "c_govt_mutiny_1857", "contradicts");
  rel("c_malleson_causes", "c_1857_cartridges", "qualifies");
  rel("c_toll_inc", "c_toll_hunter", "contradicts");
  rel("c_jallianwala_inc_verdict", "c_jallianwala_hunter_verdict", "qualifies", "The Congress inquiry went further than the official one.");
  rel("c_jinnah_two_nations", "c_gandhi_one_nation", "contradicts");
  rel("c_azad_one_nation", "c_jinnah_two_nations", "contradicts");
  rel("c_jinnah_two_nations", "c_lahore_resolution", "context_for");
  rel("c_rin_leaders", "c_ina_decisive", "qualifies", "Political leaders opposed the mutiny.");
  rel("c_cabinet_mission", "c_ina_decisive", "context_for", "The mission was announced the day after the mutiny began.");
  rel("c_feb1947_deadline", "c_iia_two_dominions", "context_for");
  rel("c_iia_two_dominions", "c_partition_scale", "context_for");

  return ops;
}

// ---------------------------------------------------------------- page

export function independencePage(E: Record<string, string>): ChangeOpInput {
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
        `For about ninety years, from the revolt of 1857 to August 1947, Indians argued, petitioned, marched, boycotted and sometimes fought to end British rule. At first they did not ask for it to end. ${C("c_inc_1885", "The first Congress, in 1885, professed loyalty")} and asked for a share in government. ${C("c_naoroji_swaraj_1906", "By 1906 it wanted Swaraj, self-government like Britain's colonies")}, and ${C("c_purna_swaraj", "in 1930 it pledged itself to complete independence")}.`,
        `What makes this story hard is that it has many authors. Gandhi led ${N("gandhi", "mass non-violent campaigns")}; revolutionaries such as ${N("bhagat", "Bhagat Singh")} rejected non-violence; ${N("ambedkar", "Ambedkar")} asked what freedom meant while caste remained; ${N("jinnah", "Jinnah")} argued that Muslims were a separate nation. The sources on this page are their own words, the British government's, and the inquiries each side held, so you can hear them disagree. The movement ended with ${C("c_iia_two_dominions", "two independent countries, India and Pakistan")}, and with ${C("c_partition_scale", "millions of people driven from their homes")}.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        { entity: e("gandhi"), text: `Non-violence and the Salt March. He also ${C("c_chauri_chaura", "called off his first great campaign")} when a crowd turned violent.`, target: "ch-1930", targetLabel: "Salt, women and revolutionaries" },
        { entity: e("jallianwala"), text: `Amritsar, 13 April 1919: ${C("c_jallianwala_firing", "troops fired on a crowd without warning")}. Two inquiries judged it very differently.`, target: "ch-amritsar", targetLabel: "Amritsar, 1919" },
        { entity: e("revolt1857"), text: `The “Sepoy Mutiny” or the “First War of Independence”? ${C("c_disraeli_1857", "The argument over its name began in 1857 itself")}.`, target: "ch-1857", targetLabel: "1857" },
        { entity: e("bhagat"), text: `Remembered as a martyr. ${C("c_assembly_bomb", "He said his bombs were meant “to make the deaf hear”")}.`, target: "ch-1930", targetLabel: "Salt, women and revolutionaries" },
        { entity: e("bose"), text: `Led the Indian National Army in the Second World War. ${C("c_ina_decisive", "Some historians think its trials forced Britain's hand")}.`, target: "ch-war", targetLabel: "War, famine and mutiny" },
        { entity: e("partition"), text: `15 August 1947: freedom, and ${C("c_partition_scale", "12 to 20 million people driven from their homes")}.`, target: "ch-1947", targetLabel: "1947" },
      ],
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-1857",
      type: "chapter",
      title: "1857: a revolt, and an argument about its name",
      promise: "How a soldiers' rising became the first chapter of the story, and why people still argue about what to call it.",
      when: { start: d(1857, 5, 10), end: d(1858, 6, 20), basis: "Wikidata Q129864 (start and end time)" },
      people: [e("disraeli"), e("savarkar"), e("marx")],
      terms: ["@t_sepoy"],
    },
    {
      id: "c1857-prose",
      type: "prose",
      markdown: [
        `In 1857 much of India was under ${N("company-rule", "Company rule")}: governed by a British trading company, the East India Company, whose army was largely made up of Indian soldiers, ${N("t_sepoy", "sepoys")}. In May of that year many of them rose against their officers. ${C("c_1857_cartridges", "The spark was a rumour about new rifle cartridges")}, said to be greased with cow and pig fat, which soldiers had to bite. ${C("c_1857_hindu_muslim", "Hindu and Muslim soldiers joined together against their officers")}.`,
        `After the revolt, ${N("british-raj", "the British Crown")} took over from the Company, and ${C("c_proclamation_1858", "Queen Victoria promised Indians the same duties as her other subjects")}, a promise later nationalists would quote back at Britain. What the revolt *was* became an argument at once: ${C("c_disraeli_1857", "was it a mutiny or a national revolt?")} In 1909 ${C("c_savarkar_war", "Savarkar called it India's War of Independence")}. This page calls it simply the revolt of 1857.`,
      ].join("\n\n"),
    },
    { id: "c1857-claims", type: "claims", claimIds: ["@c_1857_cartridges", "@c_1857_hindu_muslim", "@c_proclamation_1858"] },
    {
      id: "c1857-debate",
      type: "debate",
      question: "A mutiny, or a war of independence?",
      positions: [
        { label: "Only a soldiers' mutiny (the British government, 1857)", claimIds: ["@c_govt_mutiny_1857"] },
        { label: "More than a mutiny (British critics)", claimIds: ["@c_disraeli_1857", "@c_malleson_causes"] },
        { label: "Hindus and Muslims against common masters (Marx, 1857)", claimIds: ["@c_1857_hindu_muslim"] },
        { label: "India's War of Independence (Savarkar, 1909)", claimIds: ["@c_savarkar_war"] },
      ],
      note: "Each name carries a judgement: “mutiny” limits the revolt to soldiers, while “War of Independence” reads a later nation back into 1857. Who joined the revolt, and who did not, is part of the argument; this page does not source that yet.",
    },
    {
      id: "c1857-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Savarkar's book is a primary source for how nationalists remembered 1857, not for what happened in it. Marx wrote from London, from newspaper reports.",
    },

    // ------------------------------------------------------------ 2
    {
      id: "ch-congress",
      type: "chapter",
      title: "Asking politely: the early Congress",
      promise: "The first Congress was loyal to Britain. What did it want, and why did its critics call British rule a drain?",
      when: { start: d(1885, 12), end: d(1905), basis: "From the first Congress (December 1885) to the partition of Bengal (1905)" },
      places: [e("bombay")],
      people: [e("bonnerjee"), e("naoroji")],
      terms: ["@t_drain"],
    },
    {
      id: "congress-prose",
      type: "prose",
      markdown: [
        `In December 1885 a group of Indians met in Bombay as the ${N("inc", "Indian National Congress")}. ${C("c_inc_1885", "Their president, W. C. Bonnerjee, called it the first national assembly India had ever held, and assured Britain of their loyalty")}. They asked for reforms, not freedom: ${C("c_1885_demands", "elected members in the councils, and civil-service examinations held in India too")}.`,
        `Their sharpest weapon was economics. ${N("naoroji", "Dadabhai Naoroji")} argued that ${C("c_drain", "British rule drained India's wealth to Britain")}, a ${N("t_drain", "drain")} he put at tens of millions of pounds a year.`,
      ].join("\n\n"),
    },
    { id: "congress-claims", type: "claims", claimIds: ["@c_inc_1885", "@c_1885_demands", "@c_drain"] },
    {
      id: "congress-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The drain is Naoroji's argument and his own figure, made as a critic of British rule. It is a reading of the evidence, not a measurement.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-swaraj",
      type: "chapter",
      title: "Bengal divided, and the word “Swaraj”",
      promise: "The partition of Bengal, a boycott of British goods, and what self-rule was taken to mean.",
      when: { start: d(1905), end: d(1917), basis: "From the partition of Bengal (1905) to the British announcement of August 1917" },
      places: [e("calcutta")],
      people: [e("naoroji"), e("gandhi"), e("montagu")],
      terms: ["@t_swadeshi", "@t_swaraj"],
    },
    {
      id: "swaraj-prose",
      type: "prose",
      markdown: [
        `In 1905 the British divided the province of ${N("bengal1905", "Bengal")}. Bengalis answered with a boycott of British goods, and ${C("c_swadeshi_1906", "the Congress backed the boycott and swadeshi")}: ${N("t_swadeshi", "buying Indian-made goods")} even when they cost more. The same year ${C("c_naoroji_swaraj_1906", "Naoroji gave the demand a name, Swaraj")}, ${N("t_swaraj", "self-rule")}, on the model of the United Kingdom or the colonies.`,
        `In 1909 Gandhi asked what Swaraj should mean. ${C("c_hindswaraj_tiger", "Indians who wanted “English rule without the Englishman”")}, he wrote, wanted the tiger's nature without the tiger. Britain's own answer came in 1917: ${C("c_aug1917", "self-government, gradually, inside the Empire")}.`,
      ].join("\n\n"),
    },
    { id: "swaraj-claims", type: "claims", claimIds: ["@c_swadeshi_1906", "@c_naoroji_swaraj_1906", "@c_hindswaraj_tiger", "@c_aug1917"] },

    // ------------------------------------------------------------ 4
    {
      id: "ch-amritsar",
      type: "chapter",
      title: "Amritsar, 1919, and the turn to mass protest",
      promise: "The shooting at Jallianwala Bagh, the two inquiries that judged it, and the non-cooperation movement.",
      when: { start: d(1919, 4, 13), end: d(1922, 2, 12), basis: "From the Jallianwala Bagh firing to the end of non-cooperation" },
      places: [e("jbagh"), e("chaurichaura")],
      people: [e("dyer"), e("gandhi")],
      terms: ["@t_hartal"],
    },
    {
      id: "amritsar-prose",
      type: "prose",
      markdown: [
        `In the spring of 1919 ${C("c_rowlatt", "Gandhi called for a hartal, a shutting of shops, against new security laws, the Rowlatt legislation")}, and protests and disorder followed. ${C("c_jallianwala_firing", "On 13 April, in the Jallianwala Bagh, a public garden in Amritsar, General Dyer's troops fired on a crowd without warning for about ten minutes")}. Even ${C("c_jallianwala_hunter_verdict", "the official inquiry found that he had committed “a grave error”")}; ${C("c_jallianwala_inc_verdict", "the Congress inquiry called it calculated inhumanity")}. Its three Indian members said ${C("c_jallianwala_minority", "the shooting had the opposite effect to the one Dyer wanted")}.`,
        `In 1920 Gandhi launched the ${N("ncm", "non-cooperation movement")}. It ended abruptly. ${C("c_chauri_chaura", "When a crowd at Chauri Chaura burned a police station with the policemen inside, Gandhi called the movement off")}.`,
      ].join("\n\n"),
    },
    { id: "amritsar-claims", type: "claims", claimIds: ["@c_rowlatt", "@c_jallianwala_firing", "@c_jallianwala_hunter_verdict", "@c_jallianwala_minority", "@c_jallianwala_inc_verdict", "@c_chauri_chaura"] },
    {
      id: "amritsar-debate",
      type: "debate",
      question: "How many died at Jallianwala Bagh?",
      positions: [
        { label: "About 379 (the official inquiry)", claimIds: ["@c_toll_hunter"] },
        { label: "About 1,000 (the Congress inquiry)", claimIds: ["@c_toll_inc"] },
      ],
      note: "Both inquiries drew on the same local relief society's lists and reached different totals. No one counted the dead at the time.",
    },
    {
      id: "amritsar-quote",
      type: "quote",
      excerptId: "@x_hunter_nowarning",
      caption: "Disorders Inquiry Committee (the Hunter Report), Calcutta, 1920, majority report, p. 44.",
    },
    {
      id: "amritsar-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Each inquiry had a point of view: the Hunter Committee was appointed by the Government of India, and the Congress commissioners, Gandhi among them, were its opponents. The page shows both.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-1930",
      type: "chapter",
      title: "“Complete independence”: salt, women and revolutionaries",
      promise: "The pledge of 1930, the Salt March, the women who joined it, the revolutionaries who rejected non-violence, and Ambedkar's question.",
      when: { start: d(1929, 4, 8), end: d(1936), basis: "From the Assembly bombing (1929) to Annihilation of Caste (1936)" },
      places: [e("sabarmati"), e("dandi")],
      people: [e("gandhi"), e("bhagat"), e("dutt"), e("ambedkar")],
      terms: ["@t_swaraj", "@t_passive"],
    },
    {
      id: "c1930-prose",
      type: "prose",
      markdown: [
        `${C("c_purna_swaraj", "On 26 January 1930 the Congress asked Indians to pledge themselves to Purna Swaraj, complete independence")}. ${C("c_purna_grievances", "The pledge blamed British rule for India's poverty and for an education that had cut Indians off from their own culture")}. Gandhi chose a simple target: ${C("c_salt_tax", "the tax on salt, “the most iniquitous of all from the poor man's stand-point”")}. In March 1930 he led a 24-day march from his ashram to the sea at Dandi in protest against the government's salt monopoly. ${C("c_women_1930", "Women took part")}, making salt in villages and planning to picket shops.`,
        `Not everyone accepted Gandhi's method. ${C("c_assembly_bomb", "In 1929 Bhagat Singh and B. K. Dutt threw bombs into the Central Legislative Assembly, “to make the deaf hear”")}, and ${C("c_bhagat_revolution", "rejected what they called Utopian non-violence")}. Others asked what freedom was for. ${C("c_ambedkar", "Ambedkar argued that caste was a worse tyranny than foreign rule")}, and that Swaraj without social reform might be another kind of slavery.`,
      ].join("\n\n"),
    },
    { id: "c1930-claims", type: "claims", claimIds: ["@c_purna_swaraj", "@c_purna_grievances", "@c_salt_tax", "@c_women_1930", "@c_assembly_bomb", "@c_bhagat_revolution", "@c_ambedkar"] },
    {
      id: "c1930-quote",
      type: "quote",
      excerptId: "@x_salt_tax",
      caption: "Gandhi to the Viceroy, 2 March 1930, as printed in the Indian Annual Register, 1930.",
    },
    {
      id: "c1930-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. Bhagat Singh's statement is quoted from a typed transcription with no scan behind it; it should be checked against a 1929 printing. Ambedkar's book is quoted briefly because it may still be in copyright outside India.",
    },

    // ------------------------------------------------------------ 6
    {
      id: "ch-nations",
      type: "chapter",
      title: "One nation or two?",
      promise: "In 1940 the Muslim League asked for separate states; the Congress answered with one nation. Then, in 1942, “Quit India”.",
      when: { start: d(1940, 3), end: d(1943), basis: "From the Lahore session (March 1940) to the government's review of the 1942 disturbances" },
      places: [e("lahore"), e("bombay")],
      people: [e("jinnah"), e("azad"), e("gandhi")],
      terms: ["@t_twonation"],
    },
    {
      id: "nations-prose",
      type: "prose",
      markdown: [
        `As independence came closer, Indians disagreed about who the nation was. ${C("c_gandhi_one_nation", "Gandhi had written in 1909 that many religions did not stop India being one nation")}. In March 1940, at Lahore, ${C("c_jinnah_two_nations", "Jinnah told the Muslim League that Hindus and Muslims were two civilisations")}, the ${N("t_twonation", "two-nation theory")}, and ${C("c_lahore_resolution", "the League asked for “independent states” in the Muslim-majority north-west and east")}. ${C("c_azad_one_nation", "The Congress president that year, Maulana Azad, himself a Muslim, answered that he was proudly Indian")}.`,
        `In August 1942, in the middle of the Second World War, ${C("c_quit_india", "the Congress demanded that British rule end at once")}. Disturbances followed, and ${C("c_quit_india_govt_blame", "the government blamed Gandhi and the Congress for them")}.`,
      ].join("\n\n"),
    },
    { id: "nations-claims", type: "claims", claimIds: ["@c_gandhi_one_nation", "@c_jinnah_two_nations", "@c_lahore_resolution", "@c_azad_one_nation", "@c_quit_india", "@c_quit_india_govt_blame"] },
    {
      id: "nations-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The Quit India resolution is quoted from a poor scan, so its words match only approximately. The verdict on the disturbances that followed is the government's own.",
    },

    // ------------------------------------------------------------ 7
    {
      id: "ch-war",
      type: "chapter",
      title: "War, famine and mutiny",
      promise: "A famine in Bengal, an Indian army that fought against Britain, and a navy that refused orders.",
      when: { start: d(1943), end: d(1946, 2), basis: "From the Bengal famine (1943) to the naval mutiny (February 1946)" },
      places: [e("bombay")],
      people: [e("bose"), e("attlee")],
      terms: ["@t_rating"],
    },
    {
      id: "war-prose",
      type: "prose",
      markdown: [
        `${C("c_bengal_famine", "In 1943, in the middle of the war, a famine in Bengal killed somewhere between 800,000 and 3.8 million people")}. In South-East Asia ${N("bose", "Subhas Chandra Bose")} led the ${N("ina", "Indian National Army")} against the British. When its officers were put on trial after the war, ${C("c_ina_decisive", "some historians argue, British policy decisively shifted")}.`,
        `${C("c_rin_mutiny", "In February 1946 Indian sailors in Bombay refused duty, and within two days 7,000 had joined the mutiny")}. Yet ${C("c_rin_leaders", "the Congress disowned it, and Congress and Muslim League leaders helped to stop the riots that followed")}, and ${C("c_cabinet_mission", "Britain had announced talks on a constitution the day after the mutiny began")}.`,
      ].join("\n\n"),
    },
    { id: "war-claims", type: "claims", claimIds: ["@c_bengal_famine", "@c_rin_mutiny", "@c_rin_leaders", "@c_cabinet_mission"] },
    {
      id: "war-debate",
      type: "debate",
      question: "Did the INA trials and the naval mutiny force the British out?",
      positions: [
        { label: "Yes: they brought a decisive shift (Sarkar; Bose and Jalal)", claimIds: ["@c_ina_decisive"] },
        { label: "The record of February 1946 complicates it", claimIds: ["@c_cabinet_mission", "@c_rin_leaders"] },
      ],
      note: "The mission was announced on 19 February 1946, the day after the mutiny began on 18 February, so it is unlikely to have been a response to the mutiny. The INA trials had begun in November 1945. Weigh both.",
    },
    {
      id: "war-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The famine's toll and the historians' view of the INA trials come from Wikipedia, with the books it cites given by page only. The naval figures are the British government's.",
    },

    // ------------------------------------------------------------ 8
    {
      id: "ch-1947",
      type: "chapter",
      title: "The British leave, and the country is divided",
      promise: "A deadline, an Act of Parliament, two new countries, the princely states set loose, and the human cost.",
      when: { start: d(1947, 2, 20), end: d(1947, 8, 15), basis: "From the British deadline announcement to independence" },
      people: [e("attlee")],
      terms: ["@t_dominion", "@t_princely", "@t_paramountcy"],
    },
    {
      id: "c1947-prose",
      type: "prose",
      markdown: [
        `In February 1947 ${C("c_feb1947_deadline", "Britain gave itself a deadline: power would pass to Indian hands by June 1948 at the latest")}. It went faster. ${C("c_iia_two_dominions", "An Act of Parliament created two independent dominions, India and Pakistan, from 15 August 1947")}. ${N("t_dominion", "Dominions")} were self-governing countries of the Commonwealth. The ${N("t_princely", "princely states")}, ruled by Indian princes under treaties with the Crown, were not part of British India, and ${C("c_paramountcy_lapse", "the Act simply ended those treaties")}.`,
        `The division of the country came at a terrible cost. ${C("c_partition_scale", "Between 12 and 20 million people were displaced, and estimates of the dead run from about 200,000 to 2 million")}.`,
      ].join("\n\n"),
    },
    { id: "c1947-claims", type: "claims", claimIds: ["@c_feb1947_deadline", "@c_iia_two_dominions", "@c_paramountcy_lapse", "@c_partition_scale"] },
    {
      id: "c1947-quote",
      type: "quote",
      excerptId: "@x_iia_s1",
      caption: "Indian Independence Act 1947, section 1(1).",
    },
    {
      id: "c1947-care",
      type: "callout",
      tone: "caution",
      markdown: "Read with care. The Partition figures are wide because no reliable count was made. They come from Wikipedia and the study it cites, given here by page only.",
    },

    // ------------------------------------------------------------ Often said
    {
      id: "ch-often-said",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Two popular beliefs about the independence movement, and an argument of the time over whether India was one nation.",
      phase: "later",
    },
    {
      id: "often-prose",
      type: "prose",
      markdown: "Some short versions of this story are repeated more often than the sources allow. Here are two, each with what the sources on this page say, followed by the argument over whether India was one nation or two.",
    },
    {
      id: "myth-congress",
      type: "misconception",
      theme: "polity",
      claimId: "@m_congress_always",
      correctionIds: ["@c_inc_1885", "@c_naoroji_swaraj_1906", "@c_purna_swaraj"],
    },
    {
      id: "myth-nonviolence",
      type: "misconception",
      theme: "polity",
      claimId: "@m_nonviolence_only",
      correctionIds: ["@c_chauri_chaura", "@c_bhagat_revolution", "@c_rin_mutiny", "@c_quit_india_govt_blame"],
    },
    {
      id: "partition-debate",
      type: "debate",
      theme: "religion",
      question: "Was India one nation or two?",
      positions: [
        { label: "Two nations (the Muslim League, 1940)", claimIds: ["@c_jinnah_two_nations", "@c_lahore_resolution"] },
        { label: "One nation of many religions (Gandhi, 1909; Azad, 1940)", claimIds: ["@c_gandhi_one_nation", "@c_azad_one_nation"] },
      ],
      note: "This was the argument of the time, in the words of those who made it. Whether Partition was inevitable is a separate question, not yet covered on this page.",
    },
  ];

  return {
    op: "create_page",
    slug: "independence-movement",
    title: "The independence movement",
    kind: "era",
    entity: e("movement"),
    summary: "How Indians ended British rule, from the revolt of 1857 to independence and Partition in 1947, in the words of those who took part and those who opposed them.",
    blocks,
    status: "published",
    position: 14.5,
  };
}
