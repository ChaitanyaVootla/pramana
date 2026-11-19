/**
 * Cells for the cross-age page "Drought, famine and everyday life across the
 * ages" (a tracks block): the invasions, the Delhi Sultanate, Vijayanagara,
 * the Mughals and the Marathas, to 1757. The same cells are the spine of
 * this period's own theme page (famine-medieval.ts, block "spine").
 *
 * famineCells looks every claim and excerpt up on the database it runs
 * against (ids differ between the preview and main databases): claims by
 * their exact text, excerpts by their exact quote, both read from the applied
 * theme page. It throws if anything is missing, so run it only after
 * famine-medieval-index.ts has been applied there.
 */
import { AGES, CELLS, CLAIMS, EXCERPTS, PAGE_SLUG, type FacetKey } from "./famine-medieval";
import type { Mcp } from "./mcp";

export interface TrackCell {
  facet: FacetKey;
  /** The age's entity slug. */
  age: string;
  /** Markdown with [words](claim:<uuid>). */
  text: string;
  claimIds: string[];
  excerptId?: string;
}

interface PageJson {
  claims: Record<string, { id: string; text: string; citations: { excerpt: { id: string; quote: string | null } }[] }>;
}

/** Looks this page's claims and excerpts up on the current database, by exact claim text and exact quote. */
export async function pageIds(mcp: Mcp): Promise<{ claimId: (ref: string) => string; excerptId: (ref: string) => string }> {
  const view = await mcp.call<PageJson>("get_page", { page: PAGE_SLUG, format: "json" }).catch((e: unknown) => {
    throw new Error(`famine-medieval cells: the page ${PAGE_SLUG} is not on this database (${String(e).slice(0, 200)})`);
  });
  const claims = Object.values(view.claims);
  const claimByText = new Map(claims.map((c) => [c.text, c.id]));
  const excerptByQuote = new Map<string, string>();
  for (const c of claims) for (const ci of c.citations) if (ci.excerpt.quote) excerptByQuote.set(ci.excerpt.quote, ci.excerpt.id);
  return {
    claimId: (ref: string) => {
      const spec = CLAIMS.find((c) => c.ref === ref);
      if (!spec) throw new Error(`famine-medieval cells: no claim ${ref} in famine-medieval.ts`);
      const id = claimByText.get(spec.text);
      if (!id) throw new Error(`famine-medieval cells: claim not on ${PAGE_SLUG}: “${spec.text.slice(0, 80)}…”`);
      return id;
    },
    excerptId: (ref: string) => {
      const spec = EXCERPTS.find((x) => x.ref === ref);
      if (!spec) throw new Error(`famine-medieval cells: no excerpt ${ref} in famine-medieval.ts`);
      const id = excerptByQuote.get(spec.quote);
      if (!id) throw new Error(`famine-medieval cells: excerpt not on ${PAGE_SLUG}: “${spec.quote.slice(0, 80)}…”`);
      return id;
    },
  };
}

export async function famineCells(mcp: Mcp): Promise<TrackCell[]> {
  const { claimId, excerptId } = await pageIds(mcp);
  return CELLS.map((cell) => {
    const refs = [...new Set([...cell.text.matchAll(/\(claim:@([a-z0-9_]+)\)/g)].map((m) => m[1]!))];
    const text = cell.text.replace(/\(claim:@([a-z0-9_]+)\)/g, (_, r: string) => `(claim:${claimId(r)})`);
    return {
      facet: cell.facet,
      age: AGES[cell.age],
      text,
      claimIds: refs.map(claimId),
      ...(cell.excerpt ? { excerptId: excerptId(cell.excerpt) } : {}),
    };
  });
}
