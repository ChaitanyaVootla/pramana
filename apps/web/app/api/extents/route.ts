import { Bbox } from "@pramana/core";
import { extentsAt } from "@pramana/services";
import { atlasExtentsResponse, compressedJson } from "@/lib/extents-response";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Year = z.coerce.number().int().min(-10000).max(3000);
const RangeQuery = z
  .object({
    from: Year,
    to: Year,
    bbox: z
      .string()
      .transform((s) => s.split(",").map(Number))
      .pipe(Bbox)
      .optional(),
    tolerance: z.coerce.number().min(0).max(0.5).optional(),
  })
  .refine((q) => q.from <= q.to, { message: "from must not be after to" });

/**
 * Borders for the maps (astronomical years).
 *
 *   ?year=-250                       extents in force that year (full records)
 *   ?from=-350&to=-150[&bbox=w,s,e,n][&tolerance=0.03]
 *                                    every extent overlapping the range, simplified,
 *                                    for the atlas to filter by year on the client
 *
 * Borders change only when a changeset is approved, so responses may be cached
 * for a few minutes and served stale while they refresh.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const headers = { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400" };
  if (url.searchParams.has("from") || url.searchParams.has("to")) {
    const q = RangeQuery.safeParse(Object.fromEntries(url.searchParams));
    if (!q.success)
      return NextResponse.json(
        { error: q.error.issues[0]?.message ?? "bad query" },
        { status: 400 },
      );
    // Built once and compressed once per range (see lib/extents-response.ts).
    return atlasExtentsResponse(request, q.data, headers);
  }
  const year = Number(url.searchParams.get("year"));
  if (!Number.isFinite(year))
    return NextResponse.json({ error: "year must be a number" }, { status: 400 });
  return compressedJson(
    request,
    JSON.stringify(await extentsAt(Math.round(year), undefined, { geometry: true, limit: 80 })),
    headers,
  );
}
