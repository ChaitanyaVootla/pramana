import { wikidataTimeToEdtf, type Alias, type FuzzyDate } from "@pramana/core";
import { fetchJson, HttpError, withParams } from "./http";

/**
 * Wikidata: identity (QIDs), dates, coordinates and multilingual names. Used
 * to seed entities; values are imported with their Wikidata provenance and
 * remain editable.
 */

const API = "https://www.wikidata.org/w/api.php";

interface WdSnak {
  snaktype: string;
  property?: string;
  datavalue?: { type: string; value: unknown };
}
interface WdStatement {
  id?: string;
  rank: "preferred" | "normal" | "deprecated";
  mainsnak: WdSnak;
  qualifiers?: Record<string, WdSnak[]>;
}
interface WdEntity {
  id: string;
  missing?: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, { value: string }[]>;
  claims?: Record<string, WdStatement[]>;
  sitelinks?: Record<string, { title: string }>;
}

const ALIAS_LANGS: Record<string, string | undefined> = {
  en: "Latn",
  hi: "Deva",
  sa: "Deva",
  mr: "Deva",
  ur: "Arab",
  fa: "Arab",
  ta: "Taml",
  bn: "Beng",
  pa: "Guru",
  te: "Telu",
  kn: "Knda",
};

const DATE_PROPERTIES = [
  ["P580", "P582"], // start / end time
  ["P571", "P576"], // inception / dissolved
  ["P569", "P570"], // birth / death
  ["P585", null], // point in time
] as const;

export interface WikidataSummary {
  qid: string;
  url: string;
  label: string | null;
  description: string | null;
  aliases: Alias[];
  instanceOf: { qid: string; label: string | null }[];
  when: FuzzyDate | null;
  coordinates: { lat: number; lon: number } | null;
  enwiki: string | null;
}

function best(statements: WdStatement[] | undefined): WdSnak | null {
  if (!statements) return null;
  const usable = statements.filter(
    (s) => s.rank !== "deprecated" && s.mainsnak.snaktype === "value",
  );
  const preferred = usable.find((s) => s.rank === "preferred");
  return (preferred ?? usable[0])?.mainsnak ?? null;
}

function timeOf(snak: WdSnak | null): string | null {
  if (!snak?.datavalue || snak.datavalue.type !== "time") return null;
  return wikidataTimeToEdtf(
    snak.datavalue.value as { time: string; precision: number; calendarmodel?: string },
  );
}

function deriveWhen(entity: WdEntity): FuzzyDate | null {
  for (const [startProp, endProp] of DATE_PROPERTIES) {
    const start = timeOf(best(entity.claims?.[startProp]));
    const end = endProp ? timeOf(best(entity.claims?.[endProp])) : null;
    if (!start && !end) continue;
    // Collapse coarse intervals ("-0299/-0200") to their outer bounds.
    const lo = start ? start.split("/")[0]! : "..";
    const hi = end ? end.split("/").at(-1)! : endProp ? ".." : null;
    const edtf = hi === null ? start! : `${lo}/${hi}`;
    return { edtf, basis: `Wikidata ${entity.id} (${startProp}${endProp ? `/${endProp}` : ""})` };
  }
  return null;
}

async function getEntities(ids: string[], props: string): Promise<Record<string, WdEntity>> {
  if (ids.length === 0) return {};
  const data = await fetchJson<{ entities: Record<string, WdEntity> }>(
    withParams(API, {
      action: "wbgetentities",
      ids: ids.slice(0, 50).join("|"),
      props,
      format: "json",
    }),
  );
  return data.entities;
}

export async function getWikidataSummary(qid: string): Promise<WikidataSummary> {
  const entities = await getEntities([qid], "labels|descriptions|aliases|claims|sitelinks");
  const entity = entities[qid];
  if (!entity || entity.missing !== undefined) throw new Error(`Wikidata item ${qid} not found`);
  return summarize(entity);
}

export async function findWikidataByWikipediaTitle(
  title: string,
  lang = "en",
): Promise<WikidataSummary | null> {
  const data = await fetchJson<{ entities: Record<string, WdEntity> }>(
    withParams(API, {
      action: "wbgetentities",
      sites: `${lang}wiki`,
      titles: title,
      normalize: 1,
      props: "labels|descriptions|aliases|claims|sitelinks",
      format: "json",
    }),
  );
  const entity = Object.values(data.entities)[0];
  if (!entity || entity.missing !== undefined || !entity.id.startsWith("Q")) return null;
  return summarize(entity);
}

async function summarize(entity: WdEntity): Promise<WikidataSummary> {
  const instanceIds = (entity.claims?.P31 ?? [])
    .map((s) => (s.mainsnak.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((id): id is string => Boolean(id));
  const instanceLabels = await getEntities(instanceIds, "labels");

  const aliases: Alias[] = [];
  const seen = new Set<string>();
  const english = entity.labels?.en?.value ?? null;
  if (english) seen.add(english.toLowerCase());
  for (const [lang, script] of Object.entries(ALIAS_LANGS)) {
    const candidates = [
      entity.labels?.[lang]?.value,
      ...(entity.aliases?.[lang] ?? []).map((a) => a.value),
    ];
    for (const label of candidates) {
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      aliases.push({
        label,
        lang,
        ...(script && lang !== "en" ? { script } : {}),
        note: "Wikidata",
      });
    }
  }

  const coord = best(entity.claims?.P625);
  const coordValue = coord?.datavalue?.value as { latitude: number; longitude: number } | undefined;

  return {
    qid: entity.id,
    url: `https://www.wikidata.org/wiki/${entity.id}`,
    label: english,
    description: entity.descriptions?.en?.value ?? null,
    aliases: aliases.slice(0, 30),
    instanceOf: instanceIds.map((id) => ({
      qid: id,
      label: instanceLabels[id]?.labels?.en?.value ?? null,
    })),
    when: deriveWhen(entity),
    coordinates: coordValue ? { lat: coordValue.latitude, lon: coordValue.longitude } : null,
    enwiki: entity.sitelinks?.enwiki?.title ?? null,
  };
}

export async function searchWikidata(
  query: string,
  limit = 10,
): Promise<{ qid: string; label: string; description: string | null }[]> {
  const data = await fetchJson<{ search: { id: string; label: string; description?: string }[] }>(
    withParams(API, {
      action: "wbsearchentities",
      search: query,
      language: "en",
      uselang: "en",
      type: "item",
      limit,
      format: "json",
    }),
  );
  return data.search.map((s) => ({
    qid: s.id,
    label: s.label,
    description: s.description ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Full items, for importers: statements with qualifiers, values simplified.
// ---------------------------------------------------------------------------

export type WikidataValue =
  | { type: "time"; time: string; precision: number; calendarmodel?: string }
  | { type: "item"; id: string }
  | { type: "coordinates"; lat: number; lon: number }
  | { type: "string"; value: string }
  /** Monolingual text: names (P1448 official name, P1813 short name). */
  | { type: "text"; text: string; language: string }
  | { type: "somevalue" }
  | { type: "novalue" }
  | { type: "other" };

export interface WikidataStatement {
  rank: "preferred" | "normal" | "deprecated";
  value: WikidataValue;
  qualifiers: Record<string, WikidataValue[]>;
}

export interface WikidataItem {
  qid: string;
  label: string | null;
  description: string | null;
  aliases: Alias[];
  enwiki: string | null;
  /** Non-deprecated statements by property, preferred first. */
  claims: Record<string, WikidataStatement[]>;
}

function simplify(snak: WdSnak): WikidataValue {
  if (snak.snaktype === "somevalue") return { type: "somevalue" };
  if (snak.snaktype === "novalue") return { type: "novalue" };
  const dv = snak.datavalue;
  if (!dv) return { type: "other" };
  const v = dv.value as Record<string, unknown>;
  switch (dv.type) {
    case "time":
      return {
        type: "time",
        time: v.time as string,
        precision: v.precision as number,
        calendarmodel: v.calendarmodel as string | undefined,
      };
    case "wikibase-entityid":
      return typeof v.id === "string" ? { type: "item", id: v.id } : { type: "other" };
    case "globecoordinate":
      return { type: "coordinates", lat: v.latitude as number, lon: v.longitude as number };
    case "string":
      return { type: "string", value: dv.value as string };
    case "monolingualtext":
      return typeof v.text === "string" && typeof v.language === "string"
        ? { type: "text", text: v.text, language: v.language }
        : { type: "other" };
    default:
      return { type: "other" };
  }
}

function aliasesOf(entity: WdEntity): Alias[] {
  const aliases: Alias[] = [];
  const seen = new Set<string>();
  const english = entity.labels?.en?.value ?? null;
  if (english) seen.add(english.toLowerCase());
  for (const [lang, script] of Object.entries(ALIAS_LANGS)) {
    const candidates = [entity.labels?.[lang]?.value, ...(entity.aliases?.[lang] ?? []).map((a) => a.value)];
    for (const label of candidates) {
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      aliases.push({ label, lang, ...(script && lang !== "en" ? { script } : {}), note: "Wikidata" });
    }
  }
  return aliases.slice(0, 30);
}

function toItem(entity: WdEntity): WikidataItem {
  const claims: Record<string, WikidataStatement[]> = {};
  for (const [pid, statements] of Object.entries(entity.claims ?? {})) {
    const usable = statements
      .filter((s) => s.rank !== "deprecated")
      .sort((a, b) => (a.rank === "preferred" ? -1 : 0) - (b.rank === "preferred" ? -1 : 0));
    claims[pid] = usable.map((s) => ({
      rank: s.rank,
      value: simplify(s.mainsnak),
      qualifiers: Object.fromEntries(
        Object.entries(s.qualifiers ?? {}).map(([q, snaks]) => [q, snaks.map(simplify)]),
      ),
    }));
  }
  return {
    qid: entity.id,
    label: entity.labels?.en?.value ?? null,
    description: entity.descriptions?.en?.value ?? null,
    aliases: aliasesOf(entity),
    enwiki: entity.sitelinks?.enwiki?.title ?? null,
    claims,
  };
}

/**
 * Full items with statements and qualifiers, 50 per request (wbgetentities).
 * If the API refuses (rate limits), falls back to Special:EntityData one item
 * at a time. Cached on disk.
 */
export async function getWikidataItems(qids: string[]): Promise<Map<string, WikidataItem>> {
  const out = new Map<string, WikidataItem>();
  const unique = [...new Set(qids)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    let entities: Record<string, WdEntity>;
    try {
      entities = await getEntities(batch, "labels|descriptions|aliases|claims|sitelinks");
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      entities = {};
      for (const qid of batch) {
        const data = await fetchJson<{ entities: Record<string, WdEntity> }>(
          `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
        );
        // EntityData follows redirects; key by the requested id too.
        const entity = data.entities[qid] ?? Object.values(data.entities)[0];
        if (entity) entities[qid] = entity;
      }
    }
    for (const qid of batch) {
      const entity = entities[qid];
      if (entity && entity.missing === undefined) out.set(qid, toItem(entity));
    }
  }
  return out;
}

/** Item values of a property (preferred rank first). */
export function itemValues(item: WikidataItem, pid: string): string[] {
  return (item.claims[pid] ?? [])
    .map((s) => (s.value.type === "item" ? s.value.id : null))
    .filter((id): id is string => id !== null);
}
