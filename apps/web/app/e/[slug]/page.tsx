import type { Metadata } from "next";
import { agesStrip, getUserView, humanContext, listPages } from "@pramana/services";
import { EntityPage } from "@/components/entity/EntityPage";
import { AgeLine } from "@/components/time/AgeLine";
import { YourViewProvider } from "@/components/yourview/YourView";
import { History } from "@/components/History";
import { loadAges } from "@/lib/ages";
import { loadEntity, loadEntityPage } from "./load";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const { entity } = await loadEntity(slug);
  return { title: entity.label, description: entity.description ?? undefined };
}

export default async function EntityRoute({ params }: Params) {
  const { slug } = await params;
  const human = await humanContext();
  const data = await loadEntityPage(await loadEntity(slug));
  const entity = data.detail.entity;
  const [yourView, pages, strip] = await Promise.all([
    // The learner's own view of this entity page ("Customise this page").
    getUserView(human, "entity", entity.id),
    listPages().catch(() => []),
    agesStrip(human).catch(() => null),
  ]);
  // The line is time (docs/visual.md §1): every age, this one lit, the subject's dates as the cursor.
  const spine = await loadAges(pages).catch(() => []);
  const overview = pages.find((p) => p.kind === "overview");
  const b = entity.bounds;
  const mark: number | [number, number] | null =
    b?.startMin == null ? null : b.endMax != null && b.endMax > b.startMin ? [b.startMin, b.endMax] : b.startMin;
  // The age this subject belongs to: itself when it is one of the ages, else the age its dates begin in.
  const focus =
    spine.find((a) => a.id === entity.id)?.id ??
    (b?.startMin != null ? spine.find((a) => a.from <= b.startMin! && a.to >= b.startMin!)?.id : undefined) ??
    null;
  const progress = Object.fromEntries(
    (strip?.ages ?? []).map((a) => [a.slug, { state: a.state, partsStudied: a.partsStudied, parts: a.parts }]),
  );
  const at = spine.findIndex((a) => a.id === entity.id);
  const line = { ages: spine, focus, mark, markLabel: entity.whenLabel ?? undefined, progress, ...(at >= 0 ? { position: { index: at, total: spine.length } } : {}), indexHref: overview ? `/p/${overview.slug}` : undefined };
  const ageLine =
    spine.length > 0 ? (
      <>
        <AgeLine {...line} className="hidden sm:block" />
        <AgeLine {...line} size="compact" className="sm:hidden" />
      </>
    ) : null;
  return (
    <YourViewProvider initial={yourView}>
      <EntityPage data={data} history={<History entries={data.detail.history} />} ageLine={ageLine} />
    </YourViewProvider>
  );
}
