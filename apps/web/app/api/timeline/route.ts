import { getDb } from "@pramana/db";
import { getPageView, listPages, timelineItems } from "@pramana/services";
import { z } from "zod";
import { compressedJson } from "@/lib/extents-response";

export const dynamic = "force-dynamic";

const Query = z.object({
  /** Entity ids or slugs, comma separated; default: the ages on the overview's spine. */
  ids: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1).max(200)).max(300))
    .optional(),
});

/**
 * Dated items for an embedded timeline (a board's timeline item): the given
 * entities, or by default the ages of Indian history in the overview's order.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!q.success)
    return Response.json({ error: q.error.issues[0]?.message ?? "bad query" }, { status: 400 });
  let ids = q.data.ids;
  if (!ids?.length) {
    const overview = (await listPages()).find((p) => p.kind === "overview");
    const view = overview ? await getPageView(overview.slug) : null;
    const block = view?.page.blocks.find((b) => b.type === "entities");
    ids =
      block && block.type === "entities"
        ? block.entityIds.map((r) => view!.entities[r]?.id ?? r)
        : [];
  }
  const items = ids.length ? await timelineItems(getDb(), { entityIds: ids }) : [];
  return compressedJson(request, JSON.stringify(items), {
    "Cache-Control": "public, max-age=120, stale-while-revalidate=3600",
  });
}
