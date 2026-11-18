import type { CslItem, CslName, SourceIdentifiers } from "@pramana/core";
import { fetchJson, fetchText, withParams } from "./http";

/**
 * Internet Archive: digitised books (including the Digital Library of India
 * collection) with OCR full text. Out-of-copyright translations of primary
 * sources live here, and their text can be stored and quote-checked.
 */

export interface IaSearchHit {
  identifier: string;
  title: string;
  creator: string[];
  date: string | null;
  year: number | null;
  language: string[];
  licenseurl: string | null;
  downloads: number;
  url: string;
}

const asArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];

export async function searchInternetArchive(query: string, rows = 15): Promise<IaSearchHit[]> {
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", `(${query}) AND mediatype:texts`);
  for (const f of [
    "identifier",
    "title",
    "creator",
    "date",
    "year",
    "language",
    "licenseurl",
    "downloads",
  ]) {
    url.searchParams.append("fl[]", f);
  }
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("output", "json");
  url.searchParams.append("sort[]", "downloads desc");
  const data = await fetchJson<{ response: { docs: Record<string, unknown>[] } }>(url.toString(), {
    cacheTtlMs: 24 * 3600 * 1000,
  });
  return data.response.docs.map((d) => ({
    identifier: String(d.identifier),
    title: asArray(d.title)[0] ?? String(d.identifier),
    creator: asArray(d.creator),
    date: d.date ? String(d.date) : null,
    year: d.year ? Number(d.year) : null,
    language: asArray(d.language),
    licenseurl: d.licenseurl ? String(d.licenseurl) : null,
    downloads: Number(d.downloads ?? 0),
    url: `https://archive.org/details/${String(d.identifier)}`,
  }));
}

interface IaMetadata {
  metadata?: Record<string, unknown>;
  files?: { name: string; format?: string; size?: string }[];
  is_dark?: boolean;
}

export interface IaItem {
  identifier: string;
  url: string;
  title: string;
  creators: string[];
  date: string | null;
  publisher: string | null;
  language: string | null;
  licenseurl: string | null;
  rights: string | null;
  textFile: string | null;
  csl: CslItem;
  identifiers: SourceIdentifiers;
}

function personName(raw: string): CslName {
  // "Hultzsch, E. (Eugen), 1857-1927" -> family Hultzsch, given E.
  const cleaned = raw
    .replace(/,?\s*\d{4}-(\d{4})?\.?$/, "")
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  const [family, given] = cleaned.split(/,\s*/);
  return given ? { family: family!, given } : { literal: cleaned };
}

export async function getInternetArchiveItem(identifier: string): Promise<IaItem> {
  const data = await fetchJson<IaMetadata>(
    `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
  );
  if (!data.metadata) throw new Error(`Internet Archive item "${identifier}" not found`);
  if (data.is_dark) throw new Error(`Internet Archive item "${identifier}" is not public`);
  const m = data.metadata;
  const textFile =
    data.files?.find((f) => f.name.endsWith("_djvu.txt"))?.name ??
    data.files?.find((f) => f.format === "DjVuTXT" || f.format === "Text")?.name ??
    null;
  const title = asArray(m.title)[0] ?? identifier;
  const creators = asArray(m.creator);
  const date = m.date ? String(m.date) : null;
  const year = date ? /(\d{4})/.exec(date)?.[1] : undefined;
  const csl: CslItem = { type: "book", title, URL: `https://archive.org/details/${identifier}` };
  if (creators.length) csl.author = creators.map(personName);
  if (year) csl.issued = { "date-parts": [[Number(year)]] };
  if (m.publisher) csl.publisher = asArray(m.publisher)[0];
  if (m.language) csl.language = asArray(m.language)[0];
  return {
    identifier,
    url: `https://archive.org/details/${identifier}`,
    title,
    creators,
    date,
    publisher: m.publisher ? asArray(m.publisher)[0]! : null,
    language: m.language ? asArray(m.language)[0]! : null,
    licenseurl: m.licenseurl ? String(m.licenseurl) : null,
    rights: m.rights ? asArray(m.rights)[0]! : null,
    textFile,
    csl,
    identifiers: { ia: identifier, url: `https://archive.org/details/${identifier}` },
  };
}

/** Full OCR text of an item. OCR is imperfect; quote matching tolerates small errors. */
export async function getInternetArchiveText(
  identifier: string,
): Promise<{ item: IaItem; text: string; textUrl: string }> {
  const item = await getInternetArchiveItem(identifier);
  if (!item.textFile) throw new Error(`Internet Archive item "${identifier}" has no OCR text file`);
  const textUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(item.textFile)}`;
  const text = await fetchText(textUrl, {
    cacheTtlMs: 30 * 24 * 3600 * 1000,
    maxBytes: 40_000_000,
  });
  return { item, text, textUrl };
}

/** Wayback Machine: closest archived copy of a URL (Memento-style lookup). */
export async function waybackLookup(
  url: string,
): Promise<{ url: string; timestamp: string } | null> {
  const data = await fetchJson<{
    archived_snapshots?: { closest?: { available: boolean; url: string; timestamp: string } };
  }>(withParams("https://archive.org/wayback/available", { url }), { cacheTtlMs: 3600 * 1000 });
  const closest = data.archived_snapshots?.closest;
  return closest?.available
    ? { url: closest.url.replace(/^http:/, "https:"), timestamp: closest.timestamp }
    : null;
}
