import type { CslItem, CslName, SourceIdentifiers } from "@pramana/core";

/**
 * Just enough wikitext parsing to recover citations: top-level templates with
 * their parameters, so `{{cite book |last=Thapar |year=2003 |isbn=...}}` and
 * short-form `{{sfn|Thapar|2003|p=178}}` become structured references.
 */

export interface Template {
  name: string;
  /** Positional parameters, in order. */
  positional: string[];
  named: Record<string, string>;
  start: number;
  end: number;
}

/** Splits on `sep` at nesting depth 0 ({{ }}, [[ ]]). */
function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < input.length; i++) {
    const two = input.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth++;
      current += two;
      i++;
      continue;
    }
    if ((two === "}}" || two === "]]") && depth > 0) {
      depth--;
      current += two;
      i++;
      continue;
    }
    if (depth === 0 && input[i] === sep) {
      out.push(current);
      current = "";
      continue;
    }
    current += input[i];
  }
  out.push(current);
  return out;
}

/** All templates (including nested ones), in document order. */
export function parseTemplates(wikitext: string): Template[] {
  const out: Template[] = [];
  const stack: number[] = [];
  for (let i = 0; i < wikitext.length - 1; i++) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      stack.push(i);
      i++;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}" && stack.length > 0) {
      const start = stack.pop()!;
      const inner = wikitext.slice(start + 2, i);
      const parts = splitTopLevel(inner, "|");
      const name = (parts.shift() ?? "").trim().toLowerCase().replace(/_/g, " ");
      const positional: string[] = [];
      const named: Record<string, string> = {};
      for (const part of parts) {
        const eq = part.indexOf("=");
        const key = eq > 0 ? part.slice(0, eq).trim() : "";
        if (eq > 0 && /^[\w -]+$/.test(key))
          named[key.toLowerCase()] = cleanValue(part.slice(eq + 1));
        else positional.push(cleanValue(part));
      }
      out.push({ name, positional, named, start, end: i + 2 });
      i++;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Strips wiki markup from a parameter value. */
export function cleanValue(value: string): string {
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CITE_TYPES: Record<string, CslItem["type"]> = {
  "cite book": "book",
  "cite journal": "article-journal",
  "cite news": "article-newspaper",
  "cite magazine": "article-magazine",
  "cite web": "webpage",
  "cite encyclopedia": "entry-encyclopedia",
  "cite thesis": "thesis",
  "cite report": "report",
  "cite conference": "article",
  citation: "book",
};

export function isCiteTemplate(t: Template): boolean {
  return t.name in CITE_TYPES || t.name.startsWith("cite ");
}

export const SHORT_REF_TEMPLATES = new Set([
  "sfn",
  "sfnp",
  "harvnb",
  "harv",
  "harvtxt",
  "harvp",
  "sfnm",
  "harvcoltxt",
]);

function names(
  named: Record<string, string>,
  base: "last" | "editor-last" | "translator-last",
): CslName[] {
  const out: CslName[] = [];
  const firstKey = base === "last" ? "first" : base.replace("last", "first");
  for (let i = 0; i <= 12; i++) {
    const suffix = i === 0 ? "" : String(i);
    const family =
      named[`${base}${suffix}`] ?? (base === "last" ? named[`author${suffix}`] : undefined);
    if (!family) continue;
    const given = named[`${firstKey}${suffix}`];
    if (base === "last" && !named[`last${suffix}`] && named[`author${suffix}`])
      out.push({ literal: family });
    else out.push(given ? { family, given } : { family });
  }
  return out;
}

function yearOf(named: Record<string, string>): number | null {
  const m = /(\d{3,4})/.exec(named.year ?? named.date ?? "");
  return m ? Number(m[1]) : null;
}

export interface WikiCitation {
  /** Harvard-style key "thapar-2003" used to join short refs to full citations. */
  key: string | null;
  template: string;
  csl: CslItem;
  identifiers: SourceIdentifiers;
}

export function citeTemplateToCsl(t: Template): WikiCitation {
  const n = t.named;
  const author = names(n, "last");
  const editor = names(n, "editor-last");
  const translator = names(n, "translator-last");
  const year = yearOf(n);
  const title = n.title || n.chapter || n["script-title"] || n.work || "(untitled)";
  const csl: CslItem = { type: CITE_TYPES[t.name] ?? "document", title };
  if (n.chapter && n.title) {
    csl.type = "chapter";
    csl.title = n.chapter;
    csl["container-title"] = n.title;
  }
  if (n.journal || n.work || n.newspaper || n.encyclopedia || n.website) {
    csl["container-title"] = n.journal || n.work || n.newspaper || n.encyclopedia || n.website;
  }
  if (author.length) csl.author = author;
  if (editor.length) csl.editor = editor;
  if (translator.length) csl.translator = translator;
  if (year !== null) csl.issued = { "date-parts": [[year]] };
  if (n.publisher) csl.publisher = n.publisher;
  if (n.location || n.place) csl["publisher-place"] = n.location || n.place;
  if (n.edition) csl.edition = n.edition;
  if (n.volume) csl.volume = n.volume;
  if (n.issue) csl.issue = n.issue;
  if (n.pages) csl.page = n.pages;
  if (n.url) csl.URL = n.url;
  if (n.language) csl.language = n.language;

  const identifiers: SourceIdentifiers = {};
  if (n.doi && /^10\.\d{4,9}\/\S+$/.test(n.doi)) identifiers.doi = n.doi;
  if (n.isbn) identifiers.isbn = [n.isbn.replace(/[^0-9Xx-]/g, "")].filter((x) => x.length >= 10);
  if (n.oclc) identifiers.oclc = n.oclc;
  if (n.issn) identifiers.issn = n.issn;
  if (n.url) {
    try {
      identifiers.url = new URL(n.url).toString();
      const ia = /archive\.org\/details\/([^/?#]+)/.exec(n.url);
      if (ia) identifiers.ia = ia[1];
    } catch {
      // not a URL
    }
  }
  if (identifiers.isbn?.length === 0) delete identifiers.isbn;

  const family = author[0]?.family ?? author[0]?.literal ?? editor[0]?.family;
  const key =
    family && year !== null
      ? harvKey([family, ...author.slice(1, 4).map((a) => a.family ?? a.literal ?? "")], year)
      : null;
  return { key, template: t.name, csl, identifiers };
}

export function harvKey(families: string[], year: number | string): string {
  return `${families
    .filter(Boolean)
    .map((f) => f.toLowerCase().replace(/\s+/g, "-"))
    .join("-")}-${year}`;
}

export interface ShortRef {
  key: string;
  pages: string | null;
}

/** {{sfn|Thapar|2003|p=178}} -> { key: "thapar-2003", pages: "178" } */
export function shortRef(t: Template): ShortRef | null {
  if (!SHORT_REF_TEMPLATES.has(t.name)) return null;
  const parts = t.positional.filter(Boolean);
  const yearIdx = parts.findIndex((p) => /^\d{3,4}[a-z]?$/.test(p) || /^n\.d\.$/.test(p));
  if (yearIdx <= 0) return null;
  const year = parts[yearIdx]!.replace(/[a-z]$/, "");
  return {
    key: harvKey(parts.slice(0, yearIdx), year),
    pages: t.named.p ?? t.named.pp ?? t.named.loc ?? null,
  };
}
