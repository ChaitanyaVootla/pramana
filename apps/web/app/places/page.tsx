import { AtlasSpec, toAstronomicalYear } from "@pramana/core";
import {
  allDatedEntities,
  listEntities,
  listPages,
  placePages,
  placeTimes,
} from "@pramana/services";
import Link from "next/link";
import { eraStarts } from "@/components/atlas/start-years";
import { loadAges } from "@/lib/ages";
import { Frame } from "@/components/shell/Frame";
import { PlacesHub, type HubPlace } from "./PlacesHub";

export const metadata = { title: "Places" };

/** The places index shows every border we have, from the Indus civilisation to independence. */
const ATLAS = AtlasSpec.parse({
  range: [toAstronomicalYear(3000, "BCE"), 1950],
  initialYear: toAstronomicalYear(250, "BCE"),
});

export default async function PlacesPage() {
  const [places, timeline, pages] = await Promise.all([
    listEntities(["place", "site", "inscription", "event"]),
    allDatedEntities(["period", "polity", "culture", "person", "event"]),
    listPages(),
  ]);
  const pageByEntity = Object.fromEntries(
    pages.flatMap((p) => (p.entity ? [[p.entity.id, p.slug]] : [])),
  );
  const located = places.filter((p) => p.geo);
  // When each belongs on the map (and the list), and which pages discuss it.
  const [times, discussed] = await Promise.all([
    placeTimes(located.map((p) => p.id)),
    placePages(located.map((p) => p.id)),
  ]);
  const mapped: HubPlace[] = located.map((p) => ({
    id: p.id,
    slug: p.slug,
    label: p.label,
    kind: p.kind,
    whenLabel: p.whenLabel,
    geo: p.geo!,
    ...(times.has(p.id) ? { time: times.get(p.id) } : {}),
    pages: discussed.get(p.id) ?? [],
  }));
  const unmapped = places.filter((p) => !p.geo);
  const [starts, ages] = await Promise.all([eraStarts(pages), loadAges(pages)]);
  return (
    <Frame className="pt-8 sm:pt-12">
      <header className="max-w-[72ch]">
        <h1 className="text-4xl text-ink">Places</h1>
        <p className="mt-3 font-sans text-note text-ink-2">
          Every place our pages mention, on a map of its own time.{" "}
          <span className="text-ink-3 tnum">
            {mapped.length} on the map, {unmapped.length} without coordinates yet.
          </span>
        </p>
      </header>
      <PlacesHub
        spec={ATLAS}
        places={mapped}
        timeline={timeline}
        pageByEntity={pageByEntity}
        starts={starts}
        ages={ages}
      />
      {unmapped.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl text-ink">Not yet on the map</h2>
          <p className="mt-1 font-sans text-sm text-ink-3">
            We have no reliable coordinates for these yet, so they are not drawn.
          </p>
          <ul className="mt-3 columns-2 gap-x-10 font-sans text-ui sm:columns-3 lg:columns-4 2xl:columns-6">
            {unmapped.map((p) => (
              <li key={p.id} className="break-inside-avoid py-1">
                <Link
                  href={`/e/${p.slug}`}
                  className="text-sandstone-ink no-underline hover:underline"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Frame>
  );
}
