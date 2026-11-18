import { isUuid, NoteStatus, NoteSubjectType } from "@pramana/core";
import { getDb } from "@pramana/db";
import {
  humanContext,
  noteSubjectId,
  NotFoundError,
  notesWithVersion,
  ownerOf,
  type NoteFilter,
} from "@pramana/services";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Query = z.object({
  /** A page id or slug, or "none" for the general feed (the old form, kept for era pages). */
  page: z.string().optional(),
  /** "all": notes about anything, newest first. */
  scope: z.literal("all").optional(),
  about: NoteSubjectType.optional(),
  /** The subject's id; pages and entities may also be named by slug. */
  id: z.string().min(1).max(200).optional(),
  status: z.union([NoteStatus, z.enum(["shown", "all"])]).optional(),
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * The reader's own notes (theirs and their AI's; never another learner's) for one subject (?about=entity&id=<uuid>), for a page (?page=<id>: about it or posted
 * while reading it), or general ones (?page=none or ?about=general).
 */
export async function GET(request: Request) {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success)
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const q = parsed.data;
  const human = await humanContext();
  const filter: NoteFilter = { status: q.status, before: q.before, limit: q.limit ?? 30 };
  try {
    if (q.scope === "all") {
      // no subject filter
    } else if (q.about) {
      let id = q.about === "general" ? null : (q.id ?? null);
      // A slug names a page or entity; anything else must be an id.
      if (id && !isUuid(id)) {
        if (q.about !== "page" && q.about !== "entity")
          return NextResponse.json({ error: `${q.about} needs an id` }, { status: 400 });
        id = await noteSubjectId(
          getDb(),
          q.about === "page" ? { type: "page", page: id } : { type: "entity", entity: id },
          ownerOf(human),
        );
      }
      filter.subject = { type: q.about, id };
    } else if (q.page && q.page !== "none")
      filter.pageId = isUuid(q.page)
        ? q.page
        : await noteSubjectId(getDb(), { type: "page", page: q.page }, ownerOf(human));
    else filter.pageId = null;
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
  const { notes, version } = await notesWithVersion(human, filter);
  // Compared with the stream's "hello" (notesVersion), to skip a reload when nothing was missed.
  return NextResponse.json(notes, { headers: { "X-Notes-Version": version } });
}
