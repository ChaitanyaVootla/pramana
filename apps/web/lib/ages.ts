import { getPageView, type EntityCard, type PageSummary, type PageView } from "@pramana/services";
import type { Age } from "@/components/home/AgesExplorer";

/** A Devanagari name for the entity, if it has one. */
export function devanagari(
  entity: { aliases: EntityCard["aliases"] } | null | undefined,
): string | null {
  return entity?.aliases.find((a) => a.script === "Deva" || /[ऀ-ॿ]/.test(a.label))?.label ?? null;
}

/** The ages of the overview page's spine, in order, with their pages. */
export function agesOf(
  overview: PageView | undefined,
  pages: PageSummary[],
  views: Map<string, PageView>,
): Age[] {
  if (!overview) return [];
  const block = overview.page.blocks.find((b) => b.type === "entities");
  if (!block || block.type !== "entities") return [];
  const out: Age[] = [];
  for (const ref of block.entityIds) {
    const e = overview.entities[ref];
    if (!e?.bounds || e.bounds.startMin === null) continue;
    const page = pages.find((p) => p.kind === "era" && p.entity?.id === e.id);
    out.push({
      id: e.id,
      slug: e.slug,
      label: e.label,
      deva: devanagari(e),
      whenLabel: e.whenLabel,
      from: e.bounds.startMin,
      to: e.bounds.endMax ?? e.bounds.startMin + 1,
      approximate: e.bounds.approximate,
      description: page?.summary ?? e.description,
      page: page ? { slug: page.slug, claims: views.get(page.slug)?.stats.claims ?? 0 } : null,
    });
  }
  return out;
}

/** The spine of ages, loading only the overview page (for pages that need no other views). */
export async function loadAges(pages: PageSummary[]): Promise<Age[]> {
  const overview = pages.find((p) => p.kind === "overview");
  if (!overview) return [];
  try {
    return agesOf(await getPageView(overview.slug), pages, new Map());
  } catch {
    return [];
  }
}
