import { z } from "zod";
import { BlockId, VizSpec } from "./blocks";
import { Slug } from "./ids";

/**
 * Notes are an agent's answers and annotations during a study session. Each
 * is about one thing (or nothing in particular) and shows where that thing is
 * shown. The subject is referenced by id, or by slug where it has one.
 */

export const NOTE_SUBJECT_TYPES = [
  "general",
  "page",
  "entity",
  "claim",
  "source",
  "canvas",
] as const;
export const NoteSubjectType = z.enum(NOTE_SUBJECT_TYPES);
export type NoteSubjectType = z.infer<typeof NoteSubjectType>;

const IdOrSlug = z.union([z.uuid(), Slug]);

export const NoteSubject = z.discriminatedUnion("type", [
  z.object({ type: z.literal("general") }),
  z.object({
    type: z.literal("page"),
    page: IdOrSlug.describe("page slug or id"),
    /** A chapter (or any block) on the page. */
    chapter: BlockId.optional().describe("block id of a chapter on the page"),
  }),
  z.object({ type: z.literal("entity"), entity: IdOrSlug.describe("entity slug or id") }),
  z.object({ type: z.literal("claim"), id: z.uuid() }),
  z.object({ type: z.literal("source"), id: z.uuid() }),
  z.object({ type: z.literal("canvas"), id: z.uuid() }),
]);
export type NoteSubject = z.infer<typeof NoteSubject>;

/** The fields of a note, as the MCP tool lists them (the checks below run in services). */
export const NoteFields = {
  title: z.string().min(1).max(300),
  /** Markdown; may link `claim:<uuid>`, `entity:<slug>` etc. */
  body: z.string().min(1).max(30000),
  about: NoteSubject.optional().describe(
    "what the note is about; omit for the page in `page`, or a general note when neither is given",
  ),
  page: IdOrSlug.optional().describe(
    "the page the reader is on; the note also shows there (with `about`, or alone for a note about that page)",
  ),
  /** Block on the page this note answers or annotates. */
  anchorBlockId: BlockId.optional().describe("block on `page` (e.g. a chapter) the note answers"),
  claimIds: z.array(z.uuid()).max(100).default([]),
  viz: VizSpec.optional(),
};

export const NoteInput = z.object(NoteFields).superRefine((n, ctx) => {
  if (n.anchorBlockId && !n.page && n.about?.type !== "page") {
    ctx.addIssue({
      code: "custom",
      path: ["anchorBlockId"],
      message: 'anchorBlockId needs a page: give `page`, or `about: {type: "page", chapter}`',
    });
  }
  if (n.about?.type === "page" && n.page && n.page !== n.about.page) {
    ctx.addIssue({
      code: "custom",
      path: ["page"],
      message: "a note about a page shows on that page; leave out `page` or give the same one",
    });
  }
  if (
    n.about?.type === "page" &&
    n.about.chapter &&
    n.anchorBlockId &&
    n.about.chapter !== n.anchorBlockId
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["anchorBlockId"],
      message: "give the chapter once, in `about.chapter`",
    });
  }
});
export type NoteInput = z.infer<typeof NoteInput>;

/** Where a parsed note goes: its subject, and the page (and block) it also shows on. */
export interface NoteTarget {
  subject: Exclude<NoteSubject, { type: "page" }> | { type: "page"; page: string };
  page: string | null;
  block: string | null;
}

/** Normalises the legacy `page` + `anchorBlockId` form and the `about` form to one target. */
export function noteTarget(n: NoteInput): NoteTarget {
  const about = n.about;
  if (!about) {
    return n.page
      ? { subject: { type: "page", page: n.page }, page: n.page, block: n.anchorBlockId ?? null }
      : { subject: { type: "general" }, page: null, block: null };
  }
  if (about.type === "page") {
    return {
      subject: { type: "page", page: about.page },
      page: about.page,
      block: about.chapter ?? n.anchorBlockId ?? null,
    };
  }
  return { subject: about, page: n.page ?? null, block: n.page ? (n.anchorBlockId ?? null) : null };
}

/** Note statuses: live (shown), pinned (shown first, kept), archived (only in the history). */
export const NoteStatus = z.enum(["live", "pinned", "archived"]);
export type NoteStatus = z.infer<typeof NoteStatus>;
