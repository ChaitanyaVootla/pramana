"use client";

import { AtlasSpec } from "@pramana/core";
import type { MapFeature, TimelineItem } from "@pramana/services";
import { useEffect, useMemo, useState } from "react";
import { PeriodTimeline } from "@/components/time/PeriodTimeline";
import { cn } from "@/lib/utils";
import { Atlas } from "./Atlas";
import { useAtlasBus } from "./bus";

/**
 * The map and the timeline as self-contained items, for boards (canvas) and
 * anywhere else that wants one without a page around it. Each takes a plain
 * JSON config (so a board stores it as is), fetches its own data from ids,
 * and keeps its own year, unless an AtlasProvider is around it, in which case
 * items on the same board share the year and what is hovered.
 *
 * Sizes are fixed heights, so a board's grid never jumps; widths fill the cell.
 */

export interface MapEmbedConfig {
  /** Astronomical year shown (-260 = 261 BCE). Default: the range's start, else 250 BCE. */
  year?: number;
  /** Years the scrubber covers. Without it the map is a still picture of `year`. */
  range?: [number, number];
  /** Entity ids or slugs to draw and name; other known places appear faintly by year. */
  places?: string[];
  /** Polity ids or slugs drawn strong; [] or omitted: every state alike. */
  focus?: string[];
  /** Default true; false: places and basemap only. */
  borders?: boolean;
  /** [west, south, east, north]. Default: the focus borders, else the places, else South Asia. */
  bounds?: [number, number, number, number];
  /** s: a 160 px strip with a year chip; m: 280 px with Play and stops; l: 420 px with a timeline. */
  size?: "s" | "m" | "l";
  /** The lines under the map (what is drawn, its source). Default true for m and l. */
  caption?: boolean;
  /** What it is of: the accessible name and the timeline's caption. */
  title?: string;
}

export interface TimelineEmbedConfig {
  /** The window it opens on, astronomical years. */
  range: [number, number];
  /** Entity ids or slugs for the lanes. Default: the ages of Indian history. */
  items?: string[];
  /** A year cursor (drag it); omit for none. */
  year?: number;
  lanes?: ("ages" | "people" | "events")[];
  /** s: about 120 px; m: about 200 px. */
  size?: "s" | "m";
  title?: string;
}

// ---- data, fetched once per page and shared by every item

let allPlaces: Promise<MapFeature[]> | null = null;
function loadPlaces(): Promise<MapFeature[]> {
  allPlaces ??= fetch("/api/places")
    .then((r) =>
      r.ok ? (r.json() as Promise<MapFeature[]>) : Promise.reject(new Error(String(r.status))),
    )
    .catch((e: unknown) => {
      allPlaces = null;
      throw e;
    });
  return allPlaces;
}

const timelines = new Map<string, Promise<TimelineItem[]>>();
function loadTimeline(ids: string[] | undefined): Promise<TimelineItem[]> {
  const key = ids?.length ? ids.join(",") : "";
  let p = timelines.get(key);
  if (!p) {
    p = fetch(`/api/timeline${key ? `?ids=${encodeURIComponent(key)}` : ""}`)
      .then((r) =>
        r.ok ? (r.json() as Promise<TimelineItem[]>) : Promise.reject(new Error(String(r.status))),
      )
      .catch((e: unknown) => {
        timelines.delete(key);
        throw e;
      });
    timelines.set(key, p);
  }
  return p;
}

function useData<T>(load: () => Promise<T>, key: string, empty: T): { data: T; failed: boolean } {
  const [data, setData] = useState<T>(empty);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && (setData(d), setFailed(false)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, failed };
}

const NO_PLACES: MapFeature[] = [];
const NO_ITEMS: TimelineItem[] = [];
const SOUTH_ASIA_YEAR = -249;

/** A map item: places and borders at a year, with or without a scrubber. */
export function MapEmbed({
  className,
  onChange,
  ...config
}: MapEmbedConfig & { className?: string; onChange?: (config: MapEmbedConfig) => void }) {
  const { year, range, places, focus, borders = true, bounds, size = "m", caption, title } = config;
  const opening = year ?? range?.[0] ?? SOUTH_ASIA_YEAR;
  const placesKey = places?.join(",") ?? "";
  const { data: known } = useData(loadPlaces, "places", NO_PLACES);
  const features = useMemo(() => {
    const wanted = new Set(places ?? []);
    return wanted.size ? known.filter((p) => wanted.has(p.id) || wanted.has(p.slug)) : NO_PLACES;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known, placesKey]);
  // With a timeline (size l): the ages, and the item's own polities and places.
  const timelineKey = size === "l" ? [...(focus ?? []), ...(places ?? [])].join(",") : null;
  const { data: ages } = useData(
    () => (timelineKey === null ? Promise.resolve(NO_ITEMS) : loadTimeline(undefined)),
    `ages:${timelineKey !== null}`,
    NO_ITEMS,
  );
  const { data: own } = useData(
    () => (timelineKey ? loadTimeline(timelineKey.split(",")) : Promise.resolve(NO_ITEMS)),
    `own:${timelineKey}`,
    NO_ITEMS,
  );
  const timeline = useMemo(
    () => [...new Map([...ages, ...own].map((i) => [i.id, i])).values()],
    [ages, own],
  );
  const spec = useMemo(
    () =>
      AtlasSpec.parse({
        focus: focus ?? [],
        // A still map still needs a window of borders around its year.
        range: range ?? [opening - 50, opening + 50],
        initialYear: opening,
        ...(bounds ? { bounds } : {}),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [focus?.join(","), range?.[0], range?.[1], opening, bounds?.join(",")],
  );
  return (
    <Atlas
      className={className}
      spec={spec}
      span={null}
      places={features}
      timeline={timeline}
      title={title}
      variant={size === "l" ? "inline" : "rail"}
      mapHeight={size === "l" ? 420 : 280}
      collapsed={size === "s"}
      still={!range}
      showTimeline={size === "l"}
      borders={borders}
      caption={caption ?? size !== "s"}
      urlState={false}
      addToCanvas={false}
      onYearChange={onChange ? (y) => onChange({ ...config, year: y }) : undefined}
    />
  );
}

/** A timeline item: lanes over a range, with an optional year cursor. */
export function TimelineEmbed({
  className,
  onChange,
  ...config
}: TimelineEmbedConfig & { className?: string; onChange?: (config: TimelineEmbedConfig) => void }) {
  const { range, items, year, lanes, size = "m", title } = config;
  const bus = useAtlasBus();
  const key = items?.join(",") ?? "";
  const { data, failed } = useData(() => loadTimeline(items), `timeline:${key}`, NO_ITEMS);
  const [own, setOwn] = useState<number | null>(year ?? null);
  // On a board with a map (one AtlasProvider), the cursor is the shared year.
  const cursor = bus.live && bus.year !== null ? bus.year : own;
  const move = (y: number, { final }: { final: boolean }) => {
    if (bus.live) bus.setYear(y);
    else setOwn(y);
    if (final) onChange?.({ ...config, year: y });
  };
  return (
    // Boards put items on paper tiles: label halos match the tile.
    <div className={cn("font-sans [--timeline-bg:var(--paper)]", className)}>
      {failed && <p className="mb-1 text-xs text-ink-3">Couldn’t load the timeline.</p>}
      <PeriodTimeline
        items={data}
        focus={{ from: range[0], to: range[1] + 1, label: title ?? "these years" }}
        height={size === "s" ? 120 : 200}
        compact={size === "s"}
        layers={lanes ?? ["ages", "people", "events"]}
        cursor={year === undefined && !bus.live ? null : cursor}
        onCursorChange={move}
        cursorRange={range}
        cursorLabel={title ? `Year, ${title}` : "Year"}
      />
    </div>
  );
}
