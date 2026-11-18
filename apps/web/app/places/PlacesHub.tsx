"use client";

import type { AtlasSpec } from "@pramana/core";
import type { MapFeature, TimelineItem } from "@pramana/services";
import Link from "next/link";
import { useState } from "react";
import { Atlas } from "@/components/atlas/Atlas";
import { AtlasProvider, useAtlasBus, usePointAt } from "@/components/atlas/bus";
import type { Age } from "@/components/home/AgesExplorer";
import { AgeLinePicker } from "@/components/time/AgeLinePicker";
import type { AtlasStart } from "@/components/atlas/start-years";
import { timeWeight } from "@/components/map/time";
import { Button } from "@/components/ui/button";
import { shortYear } from "@/lib/time";
import { EmptyState } from "@/components/ui/empty-state";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

/**
 * The places index as a learning hub: the atlas, and under it the places of
 * the year it shows. A place is listed when it belongs to that year by the
 * same rule the map uses (its own date, or the years our claims mention it);
 * the rest wait behind "Show all". Hovering a row lights the place on the map,
 * and hovering a place on the map lights its row.
 */

export interface HubPlace extends MapFeature {
  /** Pages that discuss it. */
  pages: { slug: string; title: string }[];
}

const GROUPS = [
  { title: "Cities and regions", kinds: ["place"] },
  { title: "Sites and monuments", kinds: ["site"] },
  { title: "Inscriptions", kinds: ["inscription"] },
  { title: "Where events happened", kinds: ["event"] },
];

const CERTAINTY: Record<string, string> = {
  exact: "",
  approximate: "approximate location",
  conjectural: "traditional or uncertain location",
};

/** The window a place fades over on this atlas (as the map uses for its range). */
const WINDOW = 80;

export function PlacesHub(props: {
  spec: AtlasSpec;
  places: HubPlace[];
  timeline: TimelineItem[];
  pageByEntity: Record<string, string>;
  /** Years to jump to, one per age. */
  starts: AtlasStart[];
  /** The ages, for the AgeLine at the head: the map's time control. */
  ages: Age[];
}) {
  return (
    <AtlasProvider initialYear={props.spec.initialYear ?? null}>
      <Hub {...props} />
    </AtlasProvider>
  );
}

function Hub({ spec, places, timeline, pageByEntity, starts, ages }: Parameters<typeof PlacesHub>[0]) {
  const bus = useAtlasBus();
  const year = bus.year ?? spec.initialYear ?? 0;
  const [all, setAll] = useState(false);
  const inYear = (p: HubPlace) => timeWeight(p.kind, p.time, year, WINDOW).label;
  const shown = places.filter((p) => all || inYear(p));
  const hidden = places.length - places.filter(inYear).length;
  const hovered = new Set(bus.hover);

  // A phone leads with the list and the map follows; wider screens the other way round. Decided by CSS
  // order, so the server paints the final arrangement at every width (a JS media query reordered the two
  // after hydration, a 0.36 layout shift on phones).
  const map = (
    <div key="map" id="places-map" className="order-2 mt-6 scroll-mt-16 md:order-1 md:mt-3">
      <Atlas
        spec={spec}
        span={null}
        places={places}
        timeline={timeline}
        pageByEntity={pageByEntity}
        variant="full"
        legend="open"
        listPlaces={false}
      />
    </div>
  );
  const count = places.filter(inYear).length;
  const list = (
    <div key="list" className="order-1 mt-6 md:order-2 md:mt-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="places-list" className="scroll-mt-16 text-2xl text-ink" aria-live="polite">
          {all ? "All places" : <>Places in {shortYear(year)}</>}
          <span className="ml-2 font-sans text-base text-ink-3 tabular">{shown.length}</span>
        </h2>
        <p className="font-sans text-sm text-ink-3">
          {all
            ? "Every place, whatever the year."
            : hidden > 0 && count > 0
              ? `${hidden} from other times are left out: not yet founded or built, or not mentioned in these years.`
              : count > 0
                ? "Every place belongs to this year."
                : null}{" "}
          {hidden > 0 && (all || count > 0) && (
            <Button
              variant="link"
              size="xs"
              className="h-auto px-0 align-baseline"
              onClick={() => setAll((a) => !a)}
            >
              {all ? "Show this year’s only" : "Show all"}
            </Button>
          )}
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          className="mt-6"
          size="sm"
          title="No places are mentioned for this year"
          action={
            <Button variant="outline" size="sm" onClick={() => setAll(true)}>
              Show all
            </Button>
          }
        >
          A place is listed in the years it was founded, built or written about in our pages.
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-x-10 gap-y-12 md:grid-cols-2 2xl:grid-cols-4">
          {GROUPS.map((g) => {
            const items = shown.filter((p) => g.kinds.includes(p.kind));
            if (!items.length) return null;
            return (
              <section key={g.title}>
                <h3 className="flex items-baseline justify-between gap-3 text-xl text-ink">
                  {g.title}
                  <span className="font-sans text-sm text-ink-3 tabular">{items.length}</span>
                </h3>
                <ul className="mt-3 divide-y divide-rule border-y border-rule font-sans">
                  {items.map((p) => (
                    <PlaceRow
                      key={p.id}
                      place={p}
                      lit={hovered.has(p.id)}
                      faded={all && !inYear(p)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <AgeLinePicker
        ages={ages}
        starts={starts}
        range={(spec.range as [number, number] | undefined) ?? [-2999, 1950]}
        className="mt-8"
      />
      {/* A phone leads with the list (the year's places on the first screen); the map follows it. */}
      <a
        href="#places-map"
        className="mt-3 inline-block font-sans text-ui text-indigo underline decoration-indigo-tint underline-offset-3 md:hidden"
      >
        The map of {shortYear(year)}, under the list
      </a>
      <div className="flex flex-col">
        {map}
        {list}
      </div>
    </>
  );
}

function PlaceRow({ place: p, lit, faded }: { place: HubPlace; lit: boolean; faded: boolean }) {
  const point = usePointAt([p.id]);
  const meta = [p.whenLabel, CERTAINTY[p.geo.certainty]].filter(Boolean).join(", ");
  return (
    <li
      {...point}
      className={cn(
        "min-h-10 px-1 py-2 transition-colors",
        lit ? "bg-indigo-wash/70" : "hover:bg-rule-soft/60",
        faded && "opacity-60",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <Link
          href={`/e/${p.slug}`}
          className="text-ui font-medium text-sandstone-ink no-underline hover:underline"
        >
          {p.label}
        </Link>
        {meta && <span className="text-right text-sm text-ink-3 tnum">{meta}</span>}
      </div>
      {p.pages.length > 0 && (
        <p className="mt-0.5 text-xs text-ink-3">
          In{" "}
          {p.pages.map((pg, i) => (
            <span key={pg.slug}>
              {i > 0 && ", "}
              <Link href={`/p/${pg.slug}`} className="text-indigo no-underline hover:underline">
                {pg.title}
              </Link>
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
