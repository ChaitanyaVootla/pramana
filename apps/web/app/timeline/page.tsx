import { AtlasSpec, toAstronomicalYear } from "@pramana/core";
import { listEntities, type MapFeature } from "@pramana/services";
import { eraStarts } from "@/components/atlas/start-years";
import { loadTimelineData } from "@/components/HomeTimeline";
import { Frame } from "@/components/shell/Frame";
import { TimelineExplorer, type SpineAge } from "@/components/timeline/TimelineExplorer";
import { loadAges } from "@/lib/ages";

export const metadata = { title: "Timeline" };

/** The map covers every border we have, from the Mahajanapadas to independence. */
const ATLAS = AtlasSpec.parse({
  range: [-600, 1950],
  initialYear: toAstronomicalYear(250, "BCE"),
  bounds: [61, 5, 99, 37],
});

export default async function TimelinePage() {
  const [data, placeCards] = await Promise.all([
    loadTimelineData(),
    listEntities(["place", "site", "inscription", "event"]),
  ]);
  // Ages the map can show: the borders start at 600 BCE.
  const [from, to] = ATLAS.range ?? [-Infinity, Infinity];
  const starts = (await eraStarts(data.pages)).filter((s) => s.year >= from && s.year <= to);
  const spine = await loadAges(data.pages);
  const ages: SpineAge[] = spine.map((a) => ({
    id: a.id,
    slug: a.slug,
    label: a.label,
    whenLabel: a.whenLabel,
    from: a.from,
    to: a.to,
    pageSlug: data.pageByEntity[a.id] ?? null,
  }));
  const places: MapFeature[] = placeCards
    .filter((p) => p.geo)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      label: p.label,
      kind: p.kind,
      whenLabel: p.whenLabel,
      geo: p.geo!,
    }));

  return (
    <Frame className="pt-8 pb-8 sm:pt-12">
      <header className="max-w-[64ch]">
        <h1 className="text-4xl tracking-[-0.02em] text-ink">Timeline</h1>
        <p className="mt-2 font-sans text-note text-ink-2">
          Everything with a date, from the first farming villages to now, with the map of the year
          you choose.
        </p>
      </header>
      <div className="mt-8">
        <TimelineExplorer
          items={data.items}
          learned={data.learned}
          pageByEntity={data.pageByEntity}
          ages={ages}
          places={places}
          spec={ATLAS}
          starts={starts}
          spine={spine}
        />
      </div>
    </Frame>
  );
}
