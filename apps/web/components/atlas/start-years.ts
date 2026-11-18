import { getPageView, type PageSummary } from "@pramana/services";

/** A year to open the atlas on, with the age it shows. */
export interface AtlasStart {
  year: number;
  label: string;
  pageSlug: string;
}

/**
 * One year for each era page: the year its own map opens on (an editor's
 * choice in the page spec), else the start of its subject. In time order, for
 * "jump to" choices on maps that cover every age.
 */
export async function eraStarts(pages: PageSummary[]): Promise<AtlasStart[]> {
  const eras = pages.filter((p) => p.kind === "era" && p.entity);
  const out = await Promise.all(
    eras.map(async (p): Promise<AtlasStart | null> => {
      const chosen = await getPageView(p.slug)
        .then((v) => v.page.spec.atlas?.initialYear)
        .catch(() => undefined);
      const year = chosen ?? p.entity!.bounds?.startMin ?? null;
      return year === null ? null : { year, label: p.entity!.label, pageSlug: p.slug };
    }),
  );
  return out.filter((s): s is AtlasStart => s !== null).sort((a, b) => a.year - b.year);
}
