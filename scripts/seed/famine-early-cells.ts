/**
 * The cells "Drought and famine in early India" contributes to the cross-age
 * page ("Drought, famine and everyday life across the ages"): one per facet
 * per age where there is evidence, for the ages before 1206.
 *
 * Claim and excerpt ids differ between databases, so they are looked up on
 * the database the MCP server runs against: claims by their exact text among
 * the claims on this period's theme page, excerpts by their exact quote among
 * those claims' citations. Anything missing is an error.
 */
import type { Mcp } from "./mcp";
import { AGES, CELLS, CLAIMS, EXCERPTS, PAGE_SLUG, type FacetKey } from "./famine-early";

export type { FacetKey };
export interface TrackCell {
  facet: FacetKey;
  /** The age's entity slug. */
  age: string;
  /** Markdown with [words](claim:<uuid>). */
  text: string;
  claimIds: string[];
  excerptId?: string;
}

interface PageViewJson {
  claims: Record<string, { id: string; text: string; citations: { excerpt: { id: string; quote: string | null } }[] }>;
}

const CLAIM_LINK = /\]\(claim:(f[cm]_[a-z0-9_]+)\)/g;

export async function famineCells(mcp: Mcp): Promise<TrackCell[]> {
  const view = await mcp.call<PageViewJson>("get_page", { page: PAGE_SLUG, format: "json" });
  const claimByText = new Map(Object.values(view.claims).map((c) => [c.text, c]));
  const claimId = (ref: string): string => {
    const spec = CLAIMS.find((c) => c.ref === ref);
    if (!spec) throw new Error(`famine-early cells: unknown claim ref ${ref}`);
    const found = claimByText.get(spec.text);
    if (!found) throw new Error(`famine-early cells: claim not on ${PAGE_SLUG}: “${spec.text}”`);
    return found.id;
  };
  const excerptByQuote = new Map<string, string>();
  for (const c of Object.values(view.claims))
    for (const ci of c.citations) if (ci.excerpt.quote) excerptByQuote.set(ci.excerpt.quote, ci.excerpt.id);
  const excerptId = (ref: string): string => {
    const spec = EXCERPTS.find((x) => x.ref === ref);
    if (!spec) throw new Error(`famine-early cells: unknown excerpt ref ${ref}`);
    const id = excerptByQuote.get(spec.quote);
    if (!id) throw new Error(`famine-early cells: excerpt not cited on ${PAGE_SLUG}: “${spec.quote.slice(0, 80)}”`);
    return id;
  };
  const ageSlug = new Map(AGES.map((a) => [a.ref, a.slug]));
  return CELLS.map((cell) => {
    const refs = [...new Set([...cell.text.matchAll(CLAIM_LINK)].map((m) => m[1]!))];
    const ids = Object.fromEntries(refs.map((r) => [r, claimId(r)]));
    const age = ageSlug.get(cell.age);
    if (!age) throw new Error(`famine-early cells: unknown age ${cell.age}`);
    return {
      facet: cell.facet,
      age,
      text: cell.text.replace(CLAIM_LINK, (_m, r: string) => `](claim:${ids[r]})`),
      claimIds: refs.map((r) => ids[r]!),
      ...(cell.quote ? { excerptId: excerptId(cell.quote) } : {}),
    };
  });
}
