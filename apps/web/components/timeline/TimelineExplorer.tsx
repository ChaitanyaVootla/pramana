"use client";

import { formatYear, type AtlasSpec } from "@pramana/core";
import type { MapFeature, TimelineItem } from "@pramana/services";
import Link from "next/link";
import { useMemo } from "react";
import { Atlas } from "@/components/atlas/Atlas";
import { AtlasProvider, useAtlasBus } from "@/components/atlas/bus";
import type { Age } from "@/components/home/AgesExplorer";
import { AgeLinePicker } from "@/components/time/AgeLinePicker";
import type { AtlasStart } from "@/components/atlas/start-years";
import { MasterTimeline, type LayerId } from "@/components/time/MasterTimeline";
import type { CursorStop } from "@/components/time/YearCursor";
import type { LearnedItem } from "@/lib/time";
import { useMediaQuery } from "@/lib/useMediaQuery";

export interface SpineAge {
  id: string;
  slug: string;
  label: string;
  whenLabel: string | null;
  from: number;
  to: number;
  pageSlug: string | null;
}

interface Props {
  items: TimelineItem[];
  learned: LearnedItem[];
  pageByEntity: Record<string, string>;
  ages: SpineAge[];
  places: MapFeature[];
  spec: AtlasSpec;
  /** Era pages the map can jump to. */
  starts?: AtlasStart[];
  /** The ages, for the AgeLine at the head: the map's time control. */
  spine?: Age[];
}

/**
 * The whole record in one place: every age, ruler and event on the master
 * timeline, whose cursor is the atlas's year. Drag the cursor (or press Play
 * on the map) and the borders follow; beside the map, a block says what that
 * year was: the age, who was alive or in power, and what happened near it.
 */
export function TimelineExplorer(props: Props) {
  return (
    <AtlasProvider initialYear={props.spec.initialYear ?? null}>
      <Explorer {...props} />
    </AtlasProvider>
  );
}

const LAYERS: LayerId[] = ["ages", "people", "events"];

function Explorer({ items, learned, pageByEntity, ages, places, spec, starts = [], spine = [] }: Props) {
  const bus = useAtlasBus();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const year = bus.year ?? spec.initialYear ?? null;
  // The ages on the spine are the cursor's stops: a click lands on where each begins.
  // The "Ages" lane is the spine of Indian history only; other states are on the map, not in this lane.
  const spineIds = useMemo(() => new Set(ages.map((a) => a.id)), [ages]);
  const lanesItems = useMemo(
    () =>
      items.filter((i) => !["period", "polity", "culture"].includes(i.kind) || spineIds.has(i.id)),
    [items, spineIds],
  );
  const stops: CursorStop[] = useMemo(
    () => ages.map((a) => ({ year: a.from, label: a.label })),
    [ages],
  );

  const timeline = (
    <MasterTimeline
      items={lanesItems}
      learned={learned}
      pageByEntity={pageByEntity}
      defaultLayers={LAYERS}
      maxRows={8}
      label="Timeline of everything with a date"
      cursor={year}
      onCursorChange={(y) => bus.setYear(y)}
      cursorStops={stops}
      cursorLabel="Year shown on the map"
    />
  );
  // The map first, then the timeline that drives it: dragging the year near the top of the
  // timeline keeps the bottom of the map in view.
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="min-w-0">
          <AgeLinePicker
            ages={spine}
            starts={starts}
            range={(spec.range as [number, number] | undefined) ?? [-600, 1950]}
            className="mb-4"
          />
          <Atlas
            spec={spec}
            span={null}
            places={places}
            timeline={items}
            pageByEntity={pageByEntity}
            title="The map through time"
            variant={desktop ? "full" : "inline"}
            showTimeline={false}
            mapHeightClass="h-[280px] lg:h-[400px]"
          />
        </div>
        <YearCard year={year} items={items} ages={ages} pageByEntity={pageByEntity} />
      </div>
      {timeline}
    </div>
  );
}

function within(item: TimelineItem, y: number) {
  const a = item.bounds.startMin;
  if (a === null) return false;
  const b = item.bounds.endMax ?? a + 1;
  return a <= y && y <= b;
}

function YearCard({
  year,
  items,
  ages,
  pageByEntity,
}: {
  year: number | null;
  items: TimelineItem[];
  ages: SpineAge[];
  pageByEntity: Record<string, string>;
}) {
  const at = useMemo(() => {
    if (year === null) return null;
    const inAges = ages.filter((a) => a.from <= year && a.to >= year);
    const people = items
      .filter((i) => i.kind === "person")
      .filter((i) =>
        i.spans?.length
          ? i.spans.some(
              (s) =>
                s.bounds.startMin !== null &&
                s.bounds.startMin <= year &&
                (s.bounds.endMax ?? s.bounds.startMin + 1) >= year,
            )
          : within(i, year),
      )
      .slice(0, 8);
    const events = items
      .filter((i) => i.kind === "event" && i.bounds.startMin !== null)
      .map((i) => ({
        i,
        d: Math.abs((i.bounds.startMin! + (i.bounds.endMax ?? i.bounds.startMin! + 1)) / 2 - year),
      }))
      .filter((x) => x.d <= 30)
      .sort((a, b) => a.d - b.d)
      .slice(0, 5)
      .map((x) => x.i);
    return { inAges, people, events };
  }, [year, items, ages]);

  return (
    <aside
      aria-live="polite"
      className="min-w-0 border-t border-rule pt-4 font-sans lg:border-t-0 lg:pt-0"
    >
      {year === null || !at ? (
        <p className="text-note text-ink-2">
          Drag the year on the timeline to see the borders of that time.
        </p>
      ) : (
        <div key={Math.round(year / 5)} className="animate-in fade-in duration-200">
          <p className="text-sm text-ink-3">The map shows</p>
          <p className="font-serif text-3xl leading-tight text-ink tnum">
            {formatYear(year, { era: "auto" })}
          </p>

          <Group title={at.inAges.length === 1 ? "The age" : "Ages"}>
            {at.inAges.length ? (
              <ul className="space-y-1.5">
                {at.inAges.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={a.pageSlug ? `/p/${a.pageSlug}` : `/e/${a.slug}`}
                      className="group flex items-baseline justify-between gap-3 no-underline"
                    >
                      <span className="font-serif text-lg leading-snug text-ink group-hover:underline">
                        {a.label}
                      </span>
                      {a.pageSlug && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-indigo">
                          Read the page
                        </span>
                      )}
                    </Link>
                    {a.whenLabel && <p className="text-xs text-ink-3 tnum">{a.whenLabel}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">No age on our spine covers this year yet.</p>
            )}
          </Group>

          {at.people.length > 0 && (
            <Group title="Alive or in power">
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-ui">
                {at.people.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={pageByEntity[p.id] ? `/p/${pageByEntity[p.id]}` : `/e/${p.slug}`}
                      className="text-ink no-underline hover:underline"
                    >
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Group>
          )}

          {at.events.length > 0 && (
            <Group title="Around then">
              <ul className="space-y-1 text-ui">
                {at.events.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/e/${e.slug}`}
                      className="min-w-0 text-ink no-underline hover:underline"
                    >
                      {e.label}
                    </Link>
                    <span className="shrink-0 text-xs text-ink-3 tnum">{e.whenLabel}</span>
                  </li>
                ))}
              </ul>
            </Group>
          )}
        </div>
      )}
    </aside>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 border-t border-rule-soft pt-3">
      <h2 className="mb-2 font-sans text-xs font-medium text-ink-3">{title}</h2>
      {children}
    </section>
  );
}
