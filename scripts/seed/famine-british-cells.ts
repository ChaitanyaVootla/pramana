/**
 * Cells for the cross-age page "Drought, famine and everyday life across the
 * ages" (a tracks block): Company rule (1757–1858), the British Raj
 * (1858–1947) and independent India. The same cells, with the Maratha lands
 * of the 1790s besides, are the tracks block of this period's own theme page
 * (famine-british.ts, block "tracks").
 *
 * The Maratha cells (the skull famine of 1791–92) are left out here:
 * famine-medieval-cells.ts already gives maratha-confederacy its coping and
 * rulers cells, and the cross-age page allows one cell per facet and age.
 *
 * famineCells looks every claim and excerpt up on the database it runs
 * against (ids differ between the preview and main databases): claims by
 * their exact text, excerpts by their exact quote, both read from the applied
 * theme page. It throws if anything is missing, so run it only after
 * famine-british-index.ts has been applied there.
 */
import { CELLS, CLAIMS, EXCERPTS, EXISTING, PAGE_SLUG, cellRefs, type FacetKey } from "./famine-british";
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

/** Ages this script exports cells for. */
const EXPORTED_AGES = ["companyRule", "britishRaj", "independentIndia"] as const;

export async function famineCells(mcp: Mcp): Promise<TrackCell[]> {
  const view = await mcp.call<PageJson>("get_page", { page: PAGE_SLUG, format: "json" }).catch((e: unknown) => {
    throw new Error(`famine-british cells: the page ${PAGE_SLUG} is not on this database (${String(e).slice(0, 200)})`);
  });
  const claims = Object.values(view.claims);
  const claimByText = new Map(claims.map((c) => [c.text, c.id]));
  const excerptByQuote = new Map<string, string>();
  for (const c of claims) for (const ci of c.citations) if (ci.excerpt.quote) excerptByQuote.set(ci.excerpt.quote, ci.excerpt.id);

  const claimId = (ref: string) => {
    const spec = CLAIMS.find((c) => c.ref === ref);
    if (!spec) throw new Error(`famine-british cells: no claim ${ref} in famine-british.ts`);
    const id = claimByText.get(spec.text);
    if (!id) throw new Error(`famine-british cells: claim not on ${PAGE_SLUG}: “${spec.text.slice(0, 80)}…”`);
    return id;
  };
  const excerptId = (ref: string) => {
    const spec = EXCERPTS.find((x) => x.ref === ref);
    if (!spec) throw new Error(`famine-british cells: no excerpt ${ref} in famine-british.ts`);
    const id = excerptByQuote.get(spec.quote);
    if (!id) throw new Error(`famine-british cells: excerpt not on ${PAGE_SLUG}: “${spec.quote.slice(0, 80)}…”`);
    return id;
  };

  return CELLS.filter((cell) => (EXPORTED_AGES as readonly string[]).includes(cell.age)).map((cell) => {
    const refs = cellRefs(cell);
    const text = cell.text.replace(/\(claim:@([\w-]+)\)/g, (_, r: string) => `(claim:${claimId(r)})`);
    return {
      facet: cell.facet,
      age: EXISTING[cell.age]!,
      text,
      claimIds: refs.map(claimId),
      ...(cell.excerpt ? { excerptId: excerptId(cell.excerpt) } : {}),
    };
  });
}
