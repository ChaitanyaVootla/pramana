import { listEntities, placeTimes, type MapFeature } from "@pramana/services";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Every place we know the location of: the faint context layer under any map.
 * Each carries when it belongs on a map of a given year (`time`), which the
 * atlas also uses for the page's own places.
 */
export async function GET() {
  const entities = (await listEntities(["place", "site", "inscription", "event"])).filter((e) => e.geo);
  const times = await placeTimes(entities.map((e) => e.id));
  const features: MapFeature[] = entities.map((e) => ({
    id: e.id,
    slug: e.slug,
    label: e.label,
    kind: e.kind,
    whenLabel: e.whenLabel,
    geo: e.geo!,
    ...(times.has(e.id) ? { time: times.get(e.id) } : {}),
  }));
  return NextResponse.json(features, { headers: { "Cache-Control": "private, max-age=60" } });
}
