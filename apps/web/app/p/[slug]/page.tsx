import { getDb } from "@pramana/db";
import {
  agesStrip,
  getUserView,
  humanContext,
  allDatedEntities,
  extentsForEntity,
  getPageView,
  notesWithVersion,
  listPages,
  NotFoundError,
  timelineItems,
  type ExtentFeature,
  type TimelineItem,
} from "@pramana/services";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EraPage } from "@/components/era/EraPage";
import { AgeLine } from "@/components/time/AgeLine";
import { YourViewProvider } from "@/components/yourview/YourView";
import { loadAges } from "@/lib/ages";
import { peakYear } from "@/lib/era";

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  let view;
  try {
    view = await getPageView(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  // Drafts are for editors and reviewers (who read them in MCP and /review), not readers.
  if (view.page.status !== "published") notFound();
  return view;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const view = await load(slug);
  return { title: view.page.title, description: view.page.summary ?? undefined };
}

export default async function PageRoute({ params }: Params) {
  const { slug } = await params;
  const view = await load(slug);
  const entity = view.page.entity;
  const db = getDb();
  const human = await humanContext();
  const [{ notes, version: notesVersion }, pages, ages, lens, extents] = await Promise.all([
    notesWithVersion(human, { pageId: view.page.id, limit: 30 }),
    listPages(),
    allDatedEntities(["period", "polity", "culture"]),
    entity ? timelineItems(db, { linkedTo: entity.id }) : Promise.resolve([] as TimelineItem[]),
    // Metadata only: the atlas fetches borders by year; this finds the year to open on.
    entity && view.page.spec.atlas
      ? extentsForEntity(entity.id, { geometry: false }).catch(() => [] as ExtentFeature[])
      : Promise.resolve([] as ExtentFeature[]),
  ]);

  // Entities with a page of their own link to it (and are lit on timelines).
  const pageByEntity: Record<string, string> = {};
  for (const p of pages) if (p.entity && p.kind !== "overview") pageByEntity[p.entity.id] = p.slug;

  // Everything dated for the period timeline: all ages, plus what is linked to this era.
  const seen = new Set<string>();
  const timeline: TimelineItem[] = [];
  for (const item of [...ages, ...lens]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    timeline.push(item);
  }

  // Position among the ages, for the breadcrumb.
  const overview = pages.find((p) => p.kind === "overview");
  let agesPosition: { index: number; total: number } | null = null;
  if (overview && entity) {
    const spine = await getPageView(overview.slug);
    const block = spine.page.blocks.find((b) => b.type === "entities");
    if (block && block.type === "entities") {
      const ids = block.entityIds.map((r) => spine.entities[r]?.id);
      const index = ids.indexOf(entity.id);
      if (index >= 0) agesPosition = { index, total: ids.length };
    }
  }

  // The atlas opens on the spec's year, else when the page's polity was largest, else mid-period.
  const b = entity?.bounds;
  const initialYear =
    view.page.spec.atlas?.initialYear ??
    peakYear(extents) ??
    (b?.startMin != null && b.endMax != null ? Math.floor((b.startMin + b.endMax) / 2) : null);

  // The learner's own view of this page ("Customise this page"), laid over it in the browser.
  const [yourView, spine, strip] = await Promise.all([
    getUserView(human, "page", view.page.id),
    // The line is time (docs/visual.md §1): every age on one rule above the hero, this era lit.
    loadAges(pages).catch(() => []),
    agesStrip(human).catch(() => null),
  ]);
  const mark: number | [number, number] | null =
    b?.startMin == null ? null : b.endMax != null && b.endMax > b.startMin ? [b.startMin, b.endMax] : b.startMin;
  const progress = Object.fromEntries(
    (strip?.ages ?? []).map((a) => [a.slug, { state: a.state, partsStudied: a.partsStudied, parts: a.parts }]),
  );
  const line = {
    ages: spine,
    focus: entity?.id ?? null,
    mark,
    markLabel: entity?.whenLabel ?? undefined,
    progress,
    ...(agesPosition ? { position: agesPosition } : {}),
    indexHref: overview ? `/p/${overview.slug}` : undefined,
  };
  const ageLine =
    spine.length > 0 && entity ? (
      <>
        <AgeLine {...line} className="hidden sm:block" />
        <AgeLine {...line} size="compact" className="sm:hidden" />
      </>
    ) : null;
  return (
    <YourViewProvider initial={yourView}>
      <EraPage
        ageLine={ageLine}
        view={view}
        notes={notes}
        notesVersion={notesVersion}
        ages={agesPosition}
        timeline={timeline}
        pageByEntity={pageByEntity}
        initialYear={initialYear}
      />
    </YourViewProvider>
  );
}
