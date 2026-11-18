import type { CslItem, CslName } from "@pramana/core";

/**
 * "Cite this": a claim page or a source, as plain text and as BibTeX. The site
 * is the author of its own claims; a source is cited as itself, from its CSL
 * record, never re-typed.
 */
export interface Citation {
  plain: string;
  bibtex: string;
}

const DAY = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** BibTeX's special characters, escaped; Unicode is left as it is (biblatex reads it). */
function tex(text: string): string {
  return text.replace(/([\\{}&%$#_])/g, "\\$1").replace(/~/g, "\\textasciitilde{}");
}

function texName(n: CslName): string {
  if (n.literal) return `{${tex(n.literal)}}`;
  const family = [n["non-dropping-particle"], n.family].filter(Boolean).join(" ");
  const given = [n.given, n["dropping-particle"]].filter(Boolean).join(" ");
  return tex([family, given].filter(Boolean).join(", "));
}

function fields(entries: [string, string | number | undefined | null][]): string {
  return entries
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `  ${k.padEnd(12)} = {${v}}`)
    .join(",\n");
}

/** A stable key: first author's family name (letters only) and year, or a fallback. */
function key(
  base: string | undefined,
  year: string | number | undefined,
  fallback: string,
): string {
  const name = (base ?? "")
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();
  return name ? `${name}${year ?? ""}` : fallback;
}

const BIBTEX_TYPE: Record<string, string> = {
  book: "book",
  classic: "book",
  chapter: "incollection",
  "article-journal": "article",
  "article-magazine": "article",
  "article-newspaper": "article",
  "paper-conference": "inproceedings",
  thesis: "phdthesis",
  report: "techreport",
};

export function sourceCitation(
  csl: CslItem,
  full: string,
  /** `url`: where the source itself is read online (its catalogue URL, else ours of it), not this site. */
  opts: { id: string; url: string | null; accessed: Date },
): Citation {
  const year = csl.issued?.["date-parts"]?.[0]?.[0];
  const first = csl.author?.[0] ?? csl.editor?.[0];
  const type = BIBTEX_TYPE[csl.type] ?? "misc";
  const container = csl["container-title"];
  const url = csl.URL ?? opts.url ?? undefined;
  const bibtex = `@${type}{${key(first?.family ?? first?.literal, year, `source-${opts.id.slice(-8)}`)},\n${fields(
    [
      ["author", csl.author?.map(texName).join(" and ")],
      ["editor", csl.editor?.map(texName).join(" and ")],
      ["translator", csl.translator?.map(texName).join(" and ")],
      ["title", tex(csl.title)],
      [
        type === "article" ? "journal" : "booktitle",
        container && type !== "misc" ? tex(container) : undefined,
      ],
      ["series", csl["collection-title"] ? tex(csl["collection-title"]) : undefined],
      ["edition", csl.edition],
      ["volume", csl.volume],
      ["number", csl.issue],
      ["pages", csl.page ? csl.page.replace(/-/g, "--") : undefined],
      ["publisher", csl.publisher ? tex(csl.publisher) : undefined],
      ["address", csl["publisher-place"] ? tex(csl["publisher-place"]) : undefined],
      ["year", year],
      ["doi", csl.DOI],
      ["isbn", csl.ISBN],
      ["url", url],
      ["urldate", url ? iso(opts.accessed) : undefined],
    ],
  )}\n}`;
  // The stored citation marks titles *like this* for italics; plain text drops the marks.
  const plain = `${full.replace(/\*([^*]+)\*/g, "$1")}${url ? ` ${url} (accessed ${DAY.format(opts.accessed)}).` : ""}`;
  return { plain, bibtex };
}

/** A claim as the site states it: the site is its author, the claim page its address. */
export function claimCitation(opts: {
  id: string;
  text: string;
  url: string;
  updated: Date;
  accessed: Date;
}): Citation {
  const year = opts.updated.getUTCFullYear();
  const plain = `Pramāṇa. “${opts.text}” Claim, last changed ${DAY.format(opts.updated)}. ${opts.url} (accessed ${DAY.format(opts.accessed)}).`;
  const bibtex = `@misc{pramana-claim-${opts.id.slice(-8)},\n${fields([
    ["author", "{Pramāṇa}"],
    ["title", tex(opts.text)],
    ["howpublished", "Claim, with its chain of evidence"],
    ["year", year],
    ["url", opts.url],
    ["urldate", iso(opts.accessed)],
    ["note", `Last changed ${iso(opts.updated)}`],
  ])}\n}`;
  return { plain, bibtex };
}
