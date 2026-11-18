"use client";

import { formatYear } from "@pramana/core";
import type { ExtentFeature, MapFeature } from "@pramana/services";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { MapExtent } from "./MapCanvas";

const MapCanvas = dynamic(() => import("./MapCanvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => <div className="h-[460px] rounded-md bg-rule-soft" />,
});

/**
 * A map with borders through time. Places are drawn as points; borders come
 * from an open dataset (Cliopatria) and change as you move the year slider.
 * The page's own polity is emphasised; neighbours are drawn faintly.
 *
 * Either pass `extents` (all snapshots for the period, e.g. from a page view),
 * or set `fetchByYear` to load whatever existed in the chosen year.
 */
export function HistoryMap({
  features,
  extents: given,
  focusEntityId,
  range,
  initialYear,
  fetchByYear = false,
  height = 460,
}: {
  features: MapFeature[];
  extents?: ExtentFeature[];
  focusEntityId?: string | null;
  /** Slider range in astronomical years; defaults to the extents' span. */
  range?: [number, number];
  initialYear?: number;
  fetchByYear?: boolean;
  height?: number;
}) {
  const span = useMemo<[number, number] | null>(() => {
    if (range) return range;
    if (!given?.length) return null;
    return [Math.min(...given.map((e) => e.fromYear)), Math.max(...given.map((e) => e.toYear))];
  }, [given, range]);

  // Default year: when the focus polity was largest, else the middle of the span.
  const defaultYear = useMemo(() => {
    if (initialYear !== undefined) return initialYear;
    const focus = given?.filter((e) => e.entity?.id === focusEntityId) ?? [];
    const peak = focus.reduce<ExtentFeature | null>((a, b) => ((b.areaKm2 ?? 0) > (a?.areaKm2 ?? 0) ? b : a), null);
    if (peak) return Math.round((peak.fromYear + peak.toYear) / 2);
    return span ? Math.round((span[0] + span[1]) / 2) : 0;
  }, [given, focusEntityId, initialYear, span]);

  const [year, setYear] = useState(defaultYear);
  const [modern, setModern] = useState(false);
  const [fetched, setFetched] = useState<ExtentFeature[]>([]);

  useEffect(() => setYear(defaultYear), [defaultYear]);

  useEffect(() => {
    if (!fetchByYear) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      const res = await fetch(`/api/extents?year=${year}`, { signal: ctrl.signal }).catch(() => null);
      if (res?.ok) setFetched((await res.json()) as ExtentFeature[]);
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [fetchByYear, year]);

  const active = useMemo(() => {
    const pool = fetchByYear ? fetched : (given ?? []);
    return pool.filter((e) => e.geometry && e.fromYear <= year && e.toYear >= year);
  }, [fetchByYear, fetched, given, year]);

  const mapExtents: MapExtent[] = useMemo(
    () =>
      active.map((e) => ({
        id: e.id,
        name: e.entity?.label ?? e.name,
        geometry: e.geometry!,
        emphasis: !focusEntityId || e.entity?.id === focusEntityId ? "focus" : "neighbour",
      })),
    [active, focusEntityId],
  );

  const attribution = [...new Set(active.map((e) => e.attribution))].join("; ");
  const sliderRange: [number, number] = span ?? [-3000, 2000];

  return (
    <div className="font-sans">
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        {(span || fetchByYear) && (
          <div className="flex min-w-64 flex-1 items-center gap-3">
            <span className="w-24 shrink-0 text-ui font-medium text-ink tnum">{formatYear(year)}</span>
            <Slider
              min={sliderRange[0]}
              max={sliderRange[1]}
              step={1}
              value={[year]}
              onValueChange={(v) => setYear(Array.isArray(v) ? (v[0] ?? year) : (v as number))}
              aria-label="Year shown on the map"
              className="flex-1"
            />
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
          <Switch checked={modern} onCheckedChange={setModern} />
          Show today&apos;s place names
        </label>
      </div>
      <MapCanvas features={features} extents={mapExtents} height={height} modernLabels={modern} />
      <p className="mt-2 text-sm text-ink-3">
        {active.length > 0 ? (
          <>
            Borders in {formatYear(year)}: {active.slice(0, 6).map((e) => e.entity?.label ?? e.name).join(", ")}
            {active.length > 6 ? ` and ${active.length - 6} more` : ""}. Borders of ancient states are reconstructions, drawn dashed.{" "}
            {attribution && <span className="text-ink-3">Borders {attribution}.</span>}
          </>
        ) : (
          "No borders recorded for this year yet. Points are places named on the page; faded ones are uncertain."
        )}
      </p>
    </div>
  );
}
