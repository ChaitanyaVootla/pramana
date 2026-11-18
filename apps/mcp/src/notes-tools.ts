import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NoteFields, NoteInput, NoteStatus, NoteSubjectType } from "@pramana/core";
import { getDb } from "@pramana/db";
import * as svc from "@pramana/services";
import { z } from "zod";
import { MANUAL } from "./guide";
import { type Ctx, READ, run, webUrl, WRITE } from "./tool-kit";

/** The manual's sections: each starts with a line like "EVIDENCE (…)" or "DATES: …". */
function manualSections(): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  for (const line of MANUAL.split("\n")) {
    const m = /^([A-Z][A-Z ]{2,})(?=[:(]|$)/.exec(line);
    if (m || !out.length) out.push({ label: m ? m[1]!.trim() : "INTRO", text: line });
    else out[out.length - 1]!.text += `\n${line}`;
  }
  return out;
}

const TOPICS: Record<string, string[]> = {
  teaching: ["INTRO", "READING AND TEACHING"],
  notes: ["READING AND TEACHING"],
  canvases: ["CANVASES AND YOUR VIEW"],
  changes: ["CHANGING CONTENT"],
  evidence: ["EVIDENCE"],
  dates: ["DATES", "SPANS", "PLACES", "BORDERS"],
  images: ["IMAGES", "NAMES"],
};

/** Notes beside anything on the site, the session's own presence, and the manual. */
export function registerNoteTools(server: McpServer, ctx: Ctx): void {
  server.registerTool(
    "manual",
    {
      title: "The manual",
      description:
        "How to work on Pramana: teaching, notes, canvases, proposing changes, evidence and quoting, dates and places, images and names. Read the topic before you do it for the first time in a session (always `evidence` and `changes` before proposing).",
      inputSchema: {
        topic: z
          .enum(["all", ...Object.keys(TOPICS)] as [string, ...string[]])
          .default("all")
          .describe("one topic, or all"),
      },
      annotations: READ,
    },
    run(ctx, async (a: { topic?: string }) => {
      const topic = a.topic ?? "all";
      if (topic === "all") return MANUAL;
      const want = new Set(TOPICS[topic] ?? []);
      return manualSections()
        .filter((sec) => want.has(sec.label))
        .map((sec) => sec.text.trim())
        .join("\n\n");
    }),
  );

  server.registerTool(
    "post_note",
    {
      title: "Post a note to the reader",
      description:
        'Show an answer, explanation or visual beside what it is about, live in the web UI. `about` says what: {type: "page", page, chapter?} (a page, or one chapter of it: chapter ids are in get_page), {type: "entity", entity: slug|id}, {type: "claim", id}, {type: "source", id}, {type: "canvas", id}, or {type: "general"} (shows on the home page and in /notes). Add `page` to also show it on the page the reader is on. Markdown body; link claims as [text](claim:<id>) and entities as [text](entity:<slug>). Optional viz: vega-lite (inline data.values only), timeline, map, table, or lineage. Notes are not reviewed content.',
      inputSchema: NoteFields,
      annotations: WRITE,
    },
    run(ctx, async (a: z.input<typeof NoteInput>, actor) => {
      const note = await svc.postNote(actor, a);
      return {
        id: note.id,
        about: { type: note.subject.type, id: note.subject.id, label: note.subject.label },
        shows: [
          note.subject.href,
          note.pageId && note.subject.type !== "page" ? "the page being read" : null,
        ]
          .filter(Boolean)
          .map((x) => (x!.startsWith("/") ? `${webUrl()}${x}` : x)),
        history: `${webUrl()}/notes`,
        posted: true,
      };
    }),
  );

  server.registerTool(
    "list_notes",
    {
      title: "Notes posted so far",
      description:
        "The reader's notes (theirs and their AI's) beside a subject, from this session, or all (newest first; pinned ones first). Pinned notes are the ones the reader chose to keep: build on them rather than repeating them.",
      inputSchema: {
        about: NoteSubjectType.optional(),
        id: z.string().optional().describe("subject id or slug (pages and entities)"),
        thisSession: z.boolean().optional(),
        status: z.enum(["shown", "live", "pinned", "archived", "all"]).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: READ,
    },
    run(
      ctx,
      async (
        a: {
          about?: z.infer<typeof NoteSubjectType>;
          id?: string;
          thisSession?: boolean;
          status?: "shown" | z.infer<typeof NoteStatus> | "all";
          limit?: number;
        },
        actor,
      ) => {
        let subject: svc.NoteFilter["subject"];
        if (a.about) {
          let id = a.id ?? null;
          if (id && a.about === "page")
            id = await svc.noteSubjectId(getDb(), { type: "page", page: id }, svc.ownerOf(actor));
          if (id && a.about === "entity") {
            id = await svc.noteSubjectId(getDb(), { type: "entity", entity: id }, svc.ownerOf(actor));
          }
          subject = { type: a.about, id };
        }
        const notes = await svc.listNotes(actor, {
          subject,
          sessionId: a.thisSession ? (actor.sessionId ?? undefined) : undefined,
          status: a.status,
          limit: a.limit ?? 20,
        });
        return notes.map((n) => ({
          id: n.id,
          title: n.title,
          status: n.status,
          about: { type: n.subject.type, id: n.subject.id, label: n.subject.label },
          chapter: n.anchorLabel,
          by: n.author,
          mine: n.sessionId === actor.sessionId,
          viz: n.viz?.kind ?? null,
          createdAt: n.createdAt,
        }));
      },
    ),
  );

  server.registerTool(
    "archive_note",
    {
      title: "Archive a note you posted",
      description:
        "Take one of your notes off the page (it stays in the reader's history at /notes), for example when it is superseded. Use restore: true to bring it back.",
      inputSchema: { id: z.uuid(), restore: z.boolean().optional() },
      annotations: WRITE,
    },
    run(ctx, async (a: { id: string; restore?: boolean }, actor) => {
      await svc.setNoteStatus(actor, a.id, a.restore ? "live" : "archived");
      return { id: a.id, status: a.restore ? "live" : "archived" };
    }),
  );

  server.registerTool(
    "session_info",
    {
      title: "This session",
      description:
        "Who you are acting as, for whom, your session id and how you are connected, the web app's address, and what this session has done so far (notes posted, changes proposed). The reader sees the session as connected while you are active.",
      annotations: READ,
    },
    run(ctx, async (_a: unknown, actor) => {
      const [mine] = actor.sessionId
        ? await svc.listAgentSessions({ forActorId: svc.ownerOf(actor), id: actor.sessionId, limit: 1 })
        : [];
      return {
        agent: actor.handle,
        onBehalfOf: actor.onBehalfOfId,
        sessionId: actor.sessionId,
        transport: mine?.transport ?? null,
        client: mine?.client ?? null,
        notesPosted: mine?.notes ?? 0,
        changesProposed: mine?.changesets ?? 0,
        web: webUrl(),
        connectPage: `${webUrl()}/connect`,
      };
    }),
  );
}
