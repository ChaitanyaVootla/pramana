import { CslItem, type SourceIdentifiers } from "@pramana/core";
import { fetchJson, fetchText } from "./http";

/** Resolve persistent identifiers to CSL-JSON metadata. */

export async function resolveDoi(
  doi: string,
): Promise<{ csl: CslItem; identifiers: SourceIdentifiers }> {
  const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();
  // Crossref returns CSL-JSON directly for registered DOIs.
  const raw = await fetchJson<Record<string, unknown>>(
    `https://api.crossref.org/works/${encodeURIComponent(clean)}/transform/application/vnd.citationstyles.csl+json`,
  );
  const csl = CslItem.parse({ ...raw, type: normalizeType(raw.type) });
  return {
    csl,
    identifiers: { doi: clean, ...(typeof raw.URL === "string" ? { url: raw.URL } : {}) },
  };
}

function normalizeType(type: unknown): CslItem["type"] {
  const t = String(type ?? "");
  const allowed = CslItem.shape.type.options as readonly string[];
  if (allowed.includes(t)) return t as CslItem["type"];
  if (t.startsWith("journal-article")) return "article-journal";
  if (t === "book-chapter") return "chapter";
  return "document";
}

interface OlEdition {
  title: string;
  subtitle?: string;
  publishers?: string[];
  publish_date?: string;
  publish_places?: string[];
  authors?: { key: string }[];
  key: string;
  isbn_10?: string[];
  isbn_13?: string[];
  ocaid?: string;
  number_of_pages?: number;
}

export async function resolveIsbn(
  isbn: string,
): Promise<{ csl: CslItem; identifiers: SourceIdentifiers }> {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  const edition = await fetchJson<OlEdition>(`https://openlibrary.org/isbn/${clean}.json`);
  const authors = await Promise.all(
    (edition.authors ?? []).slice(0, 6).map(async (a) => {
      const author = await fetchJson<{ name?: string }>(`https://openlibrary.org${a.key}.json`);
      return { literal: author.name ?? a.key };
    }),
  );
  const year = /(\d{4})/.exec(edition.publish_date ?? "")?.[1];
  const csl: CslItem = {
    type: "book",
    title: edition.subtitle ? `${edition.title}: ${edition.subtitle}` : edition.title,
    ...(authors.length ? { author: authors } : {}),
    ...(year ? { issued: { "date-parts": [[Number(year)]] } } : {}),
    ...(edition.publishers?.[0] ? { publisher: edition.publishers[0] } : {}),
    ...(edition.publish_places?.[0] ? { "publisher-place": edition.publish_places[0] } : {}),
    ...(edition.number_of_pages ? { "number-of-pages": edition.number_of_pages } : {}),
    ISBN: clean,
  };
  const olid = edition.key.split("/").pop();
  return {
    csl,
    identifiers: {
      isbn: [...(edition.isbn_13 ?? []), ...(edition.isbn_10 ?? [])].slice(0, 4),
      ...(olid ? { olid } : {}),
      ...(edition.ocaid ? { ia: edition.ocaid } : {}),
    },
  };
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|pre|table|ul|ol|dd|dt)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === "#") {
        const n =
          code[1]?.toLowerCase() === "x"
            ? parseInt(code.slice(2), 16)
            : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchWebPage(
  url: string,
): Promise<{ title: string | null; text: string; html: string }> {
  const html = await fetchText(url, {
    accept: "text/html,application/xhtml+xml",
    maxBytes: 20_000_000,
  });
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  return { title: title ? htmlToText(title) : null, text: htmlToText(html), html };
}
