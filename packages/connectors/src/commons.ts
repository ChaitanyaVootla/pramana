import {
  commonsThumbUrl,
  htmlToPlainText,
  licenseTags,
  normalizeFileTitle,
  parseCommonsImageInfo,
  type CommonsFile,
} from "@pramana/core";
import { fetchJson, withParams } from "./http";

/**
 * Wikimedia Commons: freely licensed images with machine-readable licence and
 * author metadata (imageinfo + extmetadata). Read-only. The raw page object is
 * returned with the parsed file so callers can store it as a snapshot: a media
 * record's licence and credit must be traceable to what the API said.
 */

const API = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

/** The extmetadata fields we read; asking for fewer keeps responses small. */
const EXT_FIELDS = [
  "ObjectName",
  "ImageDescription",
  "DateTimeOriginal",
  "Artist",
  "Credit",
  "LicenseShortName",
  "License",
  "LicenseUrl",
  "UsageTerms",
  "AttributionRequired",
  "Copyrighted",
  "Restrictions",
  "NonFree",
  "Categories",
].join("|");

const IMAGEINFO = {
  prop: "imageinfo",
  iiprop: "url|size|mime|sha1|extmetadata|timestamp|user",
  iiextmetadatafilter: EXT_FIELDS,
  iiextmetadatalanguage: "en",
  format: "json",
  formatversion: 2,
} as const;

export interface CommonsFetched {
  /** The API's page object, exactly as returned (store this as the snapshot). */
  raw: Record<string, unknown>;
  file: CommonsFile;
  /** The URL the metadata was read from. */
  apiUrl: string;
}

interface QueryResponse {
  query?: {
    pages?: Record<string, unknown>[];
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
  };
  continue?: Record<string, string>;
}

/**
 * Metadata for up to 50 files by title ("File:…", with or without the
 * namespace). Missing files are left out of the result. `fresh` bypasses the
 * HTTP cache (use it when the response becomes a snapshot).
 */
export async function getCommonsFiles(
  titles: string[],
  options: { fresh?: boolean } = {},
): Promise<Map<string, CommonsFetched>> {
  const wanted = [...new Set(titles.map(normalizeFileTitle))];
  const out = new Map<string, CommonsFetched>();
  for (let i = 0; i < wanted.length; i += 50) {
    const batch = wanted.slice(i, i + 50);
    const apiUrl = withParams(API, { action: "query", titles: batch.join("|"), redirects: 1, ...IMAGEINFO });
    const data = await fetchJson<QueryResponse>(apiUrl, options.fresh ? { cacheTtlMs: 0 } : {});
    const renamed = new Map<string, string>();
    for (const r of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])])
      renamed.set(normalizeFileTitle(r.to), normalizeFileTitle(r.from));
    for (const page of data.query?.pages ?? []) {
      if ((page as { missing?: boolean }).missing || !(page as { imageinfo?: unknown }).imageinfo) continue;
      if (isOwnWork(page)) page.uploaders = await uploadersOf(page.title as string, options);
      const file = parseCommonsImageInfo(page);
      out.set(file.fileTitle, { raw: page, file, apiUrl });
      // Also findable under the title the caller asked for, when Commons normalised or redirected it.
      const asked = renamed.get(file.fileTitle);
      if (asked && asked !== file.fileTitle) out.set(asked, { raw: page, file, apiUrl });
    }
  }
  return out;
}

function isOwnWork(page: Record<string, unknown>): boolean {
  const info = (page.imageinfo as { extmetadata?: Record<string, { value?: unknown }> }[] | undefined)?.[0];
  return /^own work\.?$/i.test(htmlToPlainText(String(info?.extmetadata?.Artist?.value ?? "")));
}

/** Uploaders of every version of a file, oldest first (the author of an "Own work" file is the first). */
async function uploadersOf(title: string, options: { fresh?: boolean }): Promise<string[]> {
  const data = await fetchJson<{ query?: { pages?: { imageinfo?: { user?: string }[] }[] } }>(
    withParams(API, { action: "query", titles: title, prop: "imageinfo", iiprop: "user", iilimit: 50, format: "json", formatversion: 2 }),
    options.fresh ? { cacheTtlMs: 0 } : {},
  );
  return (data.query?.pages?.[0]?.imageinfo ?? []).flatMap((i) => (i.user ? [i.user] : [])).reverse();
}

export async function getCommonsFile(
  title: string,
  options: { fresh?: boolean } = {},
): Promise<CommonsFetched> {
  const found = (await getCommonsFiles([title], options)).get(normalizeFileTitle(title));
  if (!found) throw new Error(`Commons file "${normalizeFileTitle(title)}" not found`);
  return found;
}

export interface CommonsCandidate {
  fileTitle: string;
  pageUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  mime: string;
  /** Accepted licence, or why it is refused. */
  license: { ok: true; shortName: string; family: string } | { ok: false; reason: string };
  artist: string | null;
  credit: string | null;
  description: string | null;
  dateText: string | null;
  licenseTags: string[];
}

/** Searches Commons files (namespace 6) and returns candidates with their licence verdicts. */
export async function searchCommons(query: string, limit = 12): Promise<CommonsCandidate[]> {
  const data = await fetchJson<QueryResponse>(
    withParams(API, {
      action: "query",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: 6,
      gsrlimit: Math.min(Math.max(limit, 1), 50),
      ...IMAGEINFO,
    }),
    { cacheTtlMs: 24 * 3600 * 1000 },
  );
  const pages = (data.query?.pages ?? []) as ({ index?: number } & Record<string, unknown>)[];
  return pages
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((page) => {
      try {
        return [toCandidate(parseCommonsImageInfo(page))];
      } catch {
        return [];
      }
    })
    .filter((c) => c.mime.startsWith("image/"));
}

export function toCandidate(file: CommonsFile): CommonsCandidate {
  return {
    fileTitle: file.fileTitle,
    pageUrl: file.pageUrl,
    thumbUrl: commonsThumbUrl(file, 330),
    width: file.width,
    height: file.height,
    mime: file.mime,
    license: file.license.ok
      ? { ok: true, shortName: file.license.license.shortName, family: file.license.license.family }
      : { ok: false, reason: file.license.reason },
    artist: file.artist,
    credit: file.credit,
    description: file.description && file.description.length > 400 ? `${file.description.slice(0, 397)}…` : file.description,
    dateText: file.dateText,
    licenseTags: licenseTags(file.categories.join("|")),
  };
}

/** Image files (P18) Wikidata items name, by QID. Items without one are left out. */
export async function wikidataImageTitles(qids: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const wanted = [...new Set(qids.filter((q) => /^Q\d+$/.test(q)))];
  for (let i = 0; i < wanted.length; i += 50) {
    const data = await fetchJson<{
      entities: Record<
        string,
        { claims?: Record<string, { rank: string; mainsnak: { snaktype: string; datavalue?: { value: unknown } } }[]> }
      >;
    }>(
      withParams(WIKIDATA_API, {
        action: "wbgetentities",
        ids: wanted.slice(i, i + 50).join("|"),
        props: "claims",
        format: "json",
      }),
    );
    for (const [qid, entity] of Object.entries(data.entities)) {
      const statements = (entity.claims?.P18 ?? []).filter(
        (s) => s.rank !== "deprecated" && s.mainsnak.snaktype === "value" && typeof s.mainsnak.datavalue?.value === "string",
      );
      statements.sort((a, b) => (a.rank === "preferred" ? -1 : 0) - (b.rank === "preferred" ? -1 : 0));
      if (statements.length)
        out.set(
          qid,
          statements.map((s) => normalizeFileTitle(s.mainsnak.datavalue!.value as string)),
        );
    }
  }
  return out;
}
