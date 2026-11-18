import { getUserView, humanContext, NotFoundError } from "@pramana/services";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Query = z.object({ type: z.enum(["page", "entity", "site"]), id: z.uuid() });

/** The learner's own view of a page or entity (?type=page&id=<uuid>), or their site-wide view (?type=site&id=<SITE_VIEW_ID>), for live refresh. */
export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  try {
    return NextResponse.json(await getUserView(await humanContext(), parsed.data.type, parsed.data.id));
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}
