import type { CslDate, CslItem, CslName, Locator } from "./records";

/**
 * Lightweight citation formatting for the UI. Full CSL styles (Chicago, APA)
 * can be rendered later with citeproc from the same CSL-JSON.
 */

function nameShort(n: CslName): string {
  if (n.literal) return n.literal;
  return [n["non-dropping-particle"], n.family].filter(Boolean).join(" ") || n.given || "";
}

function nameFull(n: CslName): string {
  if (n.literal) return n.literal;
  return [n.given, n["non-dropping-particle"], n.family].filter(Boolean).join(" ");
}

export function cslYear(date: CslDate | undefined): string | null {
  const first = date?.["date-parts"]?.[0]?.[0];
  if (first !== undefined) return String(first);
  return date?.literal ?? date?.raw ?? null;
}

function people(item: CslItem): CslName[] {
  return item.author ?? item.editor ?? item.translator ?? [];
}

/** "Hultzsch 1925", "Thapar & Singh 2003", "Wikipedia 2026". */
export function shortCitation(item: CslItem): string {
  const names = people(item);
  const year = cslYear(item.issued);
  let who: string;
  if (names.length === 0) who = item["container-title"] ?? item["title-short"] ?? item.title;
  else if (names.length === 1) who = nameShort(names[0]!);
  else if (names.length === 2) who = `${nameShort(names[0]!)} & ${nameShort(names[1]!)}`;
  else who = `${nameShort(names[0]!)} et al.`;
  return year ? `${who} ${year}` : who;
}

/**
 * A readable full reference, loosely Chicago author-date. Titles are wrapped in
 * *asterisks* (Markdown italics) for the renderer.
 *   "E. Hultzsch (1925). *Inscriptions of Asoka*. Oxford: Clarendon Press."
 *   "*Arthashastra*. Wikipedia, 2026."   (no author: the title leads)
 */
export function fullCitation(item: CslItem): string {
  const parts: string[] = [];
  const authors = (item.author ?? []).map(nameFull).filter(Boolean);
  const editors = (item.editor ?? []).map(nameFull).filter(Boolean);
  const translators = (item.translator ?? []).map(nameFull).filter(Boolean);
  const year = cslYear(item.issued);
  const quoted = item.type === "chapter" || item.type?.startsWith("article");
  const title = quoted ? `“${item.title}”` : `*${item.title}*`;
  const lead = authors.length ? authors : !translators.length && editors.length ? editors.map((e) => `${e} (ed.)`) : [];
  if (lead.length) {
    parts.push(`${lead.join(", ")}${year ? ` (${year})` : ""}`);
    parts.push(title);
  } else {
    parts.push(title);
  }
  if (item["container-title"]) parts.push(quoted || item.type === "entry-encyclopedia" ? `In *${item["container-title"]}*` : item["container-title"]);
  if (translators.length) parts.push(`Translated by ${translators.join(", ")}`);
  if (editors.length && lead !== editors) parts.push(`Edited by ${editors.join(", ")}`);
  if (item.volume) parts.push(`Vol. ${item.volume}`);
  const pub = [item["publisher-place"], item.publisher].filter(Boolean).join(": ");
  if (pub) parts.push(pub);
  // Without an author, the year goes at the end.
  if (!lead.length && year) parts.push(year);
  return `${parts.join(". ").replace(/\.\./g, ".")}.`;
}

export function formatLocator(locator: Locator | null | undefined): string {
  if (!locator) return "";
  const out: string[] = [];
  if (locator.label) out.push(locator.label);
  if (locator.volume) out.push(`vol. ${locator.volume}`);
  if (locator.chapter) out.push(`ch. ${locator.chapter}`);
  if (locator.section) out.push(`§ ${locator.section}`);
  if (locator.verse) out.push(locator.verse);
  if (locator.page)
    out.push(locator.pageEnd ? `pp. ${locator.page}–${locator.pageEnd}` : `p. ${locator.page}`);
  if (locator.line) out.push(`l. ${locator.line}`);
  if (locator.folio) out.push(`f. ${locator.folio}`);
  if (locator.timestamp) out.push(`@ ${locator.timestamp}`);
  return out.join(", ");
}
