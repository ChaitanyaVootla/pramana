import { shortCitation } from "@pramana/core";
import {
  allDatedEntities,
  getPageView,
  listPages,
  type PageSummary,
  type PageView,
  type TimelineItem,
} from "@pramana/services";
import { MasterTimeline, type LayerId } from "@/components/time/MasterTimeline";
import type { LearnedItem } from "@/lib/time";

/**
 * Data for the master timeline (home and /timeline), loaded on the server:
 * every dated entity, which entities have a page, and "when we learned it",
 * taken from the publication years of the sources cited on written pages.
 * Nothing is invented: a source without a year is left out.
 */
export interface TimelineData {
  items: TimelineItem[];
  pages: PageSummary[];
  views: Map<string, PageView>;
  pageByEntity: Record<string, string>;
  learned: LearnedItem[];
}

/** Sources older than this are the evidence itself (an edict), not a moment we learned it. */
const LEARNED_FROM = 1500;

export async function loadTimelineData(): Promise<TimelineData> {
  const [items, pages] = await Promise.all([allDatedEntities(), listPages()]);
  const written = pages.filter((p) => p.kind !== "overview");
  const views = new Map<string, PageView>();
  await Promise.all(
    written.map(async (p) => {
      try {
        views.set(p.slug, await getPageView(p.slug));
      } catch {
        // A page that fails to load still shows on the timeline; it just adds no sources.
      }
    }),
  );
  const pageByEntity: Record<string, string> = {};
  for (const p of pages) if (p.entity && p.kind !== "overview") pageByEntity[p.entity.id] = p.slug;

  // One mark per author and year: four pinned Wikipedia articles are one moment, not four.
  const seen = new Set<string>();
  const groups = new Map<string, { who: string; year: number; ids: string[]; titles: string[] }>();
  for (const view of views.values()) {
    const cards = [
      ...Object.values(view.claims).flatMap((c) => c.citations.map((ci) => ci.excerpt.source)),
      ...Object.values(view.excerpts).map((e) => e.source),
    ];
    for (const s of cards) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      const year = s.csl.issued?.["date-parts"]?.[0]?.[0];
      const n = typeof year === "number" ? year : Number(year);
      if (!Number.isFinite(n) || n < LEARNED_FROM) continue;
      const who = shortCitation(s.csl).replace(/\s+\d{3,4}$/, "");
      const key = `${who}|${n}`;
      const g = groups.get(key) ?? { who, year: n, ids: [], titles: [] };
      g.ids.push(s.id);
      g.titles.push(s.csl["title-short"] ?? s.csl.title ?? s.title);
      groups.set(key, g);
    }
  }
  const learned: LearnedItem[] = [...groups.values()]
    .map((g) => {
      const title = g.titles[0]!;
      const one = title.length > 34 ? `${title.slice(0, 32).trimEnd()}…` : title;
      const label =
        g.ids.length === 1
          ? `${g.who}, ${one}`
          : `${g.who}, ${g.ids.length} ${g.who === "Wikipedia" ? "articles pinned" : "works"}`;
      return {
        id: g.ids[0]!,
        label,
        year: g.year,
        whenLabel: g.ids.length === 1 ? `published ${g.year}` : `${g.year}: ${g.titles.join("; ")}`,
        href: `/s/${g.ids[0]}`,
      };
    })
    .sort((a, b) => a.year - b.year);
  return { items, pages, views, pageByEntity, learned };
}

/** The master timeline with the data from `loadTimelineData`. */
export function HomeTimeline({
  data,
  defaultLayers,
  maxRows,
  label,
}: {
  data: Pick<TimelineData, "items" | "pageByEntity" | "learned">;
  defaultLayers?: LayerId[];
  maxRows?: number;
  label?: string;
}) {
  return (
    <MasterTimeline
      items={data.items}
      learned={data.learned}
      pageByEntity={data.pageByEntity}
      defaultLayers={defaultLayers}
      maxRows={maxRows}
      label={label}
    />
  );
}
