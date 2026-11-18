import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CanvasItemContent,
  CanvasLayout,
  CanvasLinkInput,
  describeUserView,
  PageRef,
  UserViewPatch,
} from "@pramana/core";
import * as svc from "@pramana/services";
import { z } from "zod";
import { type Ctx, READ, run, webUrl, WRITE } from "./tool-kit";

/**
 * Canvases (a learner's boards of anything on the site) and "your view"
 * (one learner's arrangement of a page). Both are the user's personal
 * workspace: changes apply at once, without review, and appear live in the
 * open page. Every change is audited and attributed to this session.
 */

const LAYOUT_HELP =
  "Layout: a 12-column grid; {x: column 0-11, y: row, w: columns 1-12, h: rows} (a row is about 40px). Omit layout to place items after the last one, filling the row first. Overlaps push the later item down.";

const ITEM_HELP =
  'Item content by kind: {kind: "claim", claimId, citations?} · {kind: "entity", entity: slug|id} · {kind: "chapter", page: slug, chapterId, show?: "brief"|"full"} (chapter ids are in get_page) · {kind: "excerpt", excerptId} · {kind: "media", mediaId} · {kind: "map", year? (astronomical, -260 = 261 BCE), range?: [from, to] (adds a scrubber), places: [slug], focus: [polity slug] (borders drawn strong), borders?: false (no borders)} · {kind: "timeline", range: [from, to] (astronomical years), entities: [slug] (empty: the ages), year? (a cursor)} · {kind: "note", noteId} · {kind: "viz", viz: <same VizSpec as post_note>} · {kind: "text", markdown} · {kind: "section", title} (a heading across the board; the items under it are its group). Every kind takes an optional title and caption (Markdown; link claims [x](claim:<id>) and entities [x](entity:<slug>)). Only reference things that exist; never invent quotes or coordinates: put your own words in text items and captions. What you add arrives marked as yours, pending: the user keeps it or takes the whole batch back.';

const canvasUrl = (id: string) => `${webUrl()}/canvas/${id}`;

/** A canvas item in a line or two: what it shows now, so the agent can talk about it. */
function brief(item: svc.CanvasItemView): Record<string, unknown> {
  const d = item.data;
  const base = {
    id: item.id,
    kind: item.kind,
    layout: item.layout,
    title: item.content.title,
    caption: item.content.caption,
    addedBy: item.addedBy.kind,
    ...(item.status === "pending" ? { pending: true } : {}),
  };
  switch (d.kind) {
    case "missing":
      return { ...base, missing: `the ${d.what} it showed is no longer on the site` };
    case "claim":
      return { ...base, claim: { id: d.claim.id, text: d.claim.text, level: d.claim.level, assessment: d.claim.assessment } };
    case "entity":
      return { ...base, entity: { id: d.entity.id, slug: d.entity.slug, label: d.entity.label, when: d.entity.whenLabel } };
    case "chapter":
      return { ...base, chapter: { page: d.page.slug, id: d.chapter.id, title: d.chapter.title, part: `${d.chapter.index + 1} of ${d.chapter.total}` } };
    case "excerpt":
      return { ...base, excerpt: { id: d.excerpt.id, quote: d.excerpt.quote, source: d.excerpt.source.short, locator: d.excerpt.locatorLabel } };
    case "media":
      return { ...base, media: { id: d.media.id, title: d.media.title } };
    case "map":
    case "timeline":
      return { ...base, [d.kind]: item.content };
    case "note":
      return { ...base, note: { id: d.note.id, title: d.note.title } };
    case "viz":
      return { ...base, viz: item.content.kind === "viz" ? item.content.viz.kind : null };
    case "text":
      return { ...base, markdown: item.content.kind === "text" ? item.content.markdown : undefined };
    case "section":
      return base;
  }
}

const Subject = z
  .enum(["page", "entity", "site"])
  .describe('"page" for era pages (/p/<slug>), "entity" for entity pages (/e/<slug>), "site" for the user\'s one site-wide view (how the site looks for them)');
/** For the site-wide view the ref is not needed. */
const ViewRef = PageRef.optional().describe('page or entity slug (or id); omit for subject "site"');
type SubjectType = "page" | "entity" | "site";
const subjectUrl = (type: SubjectType, ref: string) => (type === "site" ? webUrl() : `${webUrl()}/${type === "page" ? "p" : "e"}/${ref}`);

function viewResult(state: svc.UserViewState, ref: string) {
  return {
    subject: state.subject,
    url: subjectUrl(state.subject.type, ref),
    view: state.view,
    summary: describeUserView(state.view),
    recentChanges: state.changes.slice(0, 5).map((c) => ({ at: c.at, by: c.by.kind, note: c.note, did: c.lines })),
  };
}

export function registerCanvasTools(server: McpServer, ctx: Ctx): void {
  // ------------------------------------------------------------------ canvases
  server.registerTool(
    "canvas_list",
    {
      title: "The user's canvases",
      description: "The user's canvases (boards that hold anything on the site), most recently changed first.",
      annotations: READ,
    },
    run(ctx, async (_a: unknown, actor) =>
      (await svc.listCanvases(actor)).map((c) => ({
        id: c.id,
        title: c.title,
        items: c.itemCount,
        kinds: c.kinds,
        updatedAt: c.updatedAt,
        url: canvasUrl(c.id),
      })),
    ),
  );

  server.registerTool(
    "canvas_get",
    {
      title: "Read a canvas",
      description:
        "A canvas with every item: its id, kind, layout and what it shows now (claims with their current verification level; items whose content was deleted are marked missing). Also the recent activity.",
      inputSchema: { canvas: z.uuid() },
      annotations: READ,
    },
    run(ctx, async (a: { canvas: string }, actor) => {
      const c = await svc.getCanvas(actor, a.canvas);
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        version: c.version,
        url: canvasUrl(c.id),
        items: c.items.map(brief),
        notes: c.notes.map((n) => ({ id: n.id, title: n.title, createdAt: n.createdAt })),
        links: c.links.map((l) => ({ id: l.id, from: l.from, to: l.to, relation: l.relation, label: l.label, ...(l.status === "pending" ? { pending: true } : {}) })),
        activity: c.activity.slice(0, 10).map((e) => ({ at: e.at, action: e.action, by: e.actor.kind, data: e.data })),
      };
    }),
  );

  server.registerTool(
    "canvas_create",
    {
      title: "Start a canvas",
      description: `Create a canvas for the user, optionally with items. It appears in their list at /canvas. ${ITEM_HELP} ${LAYOUT_HELP}`,
      inputSchema: {
        title: z.string().min(1).max(120),
        description: z.string().max(2000).optional(),
        items: z.array(z.object({ content: CanvasItemContent, layout: CanvasLayout.optional() })).max(50).optional(),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: { title: string; description?: string; items?: { content: unknown; layout?: unknown }[] }, actor) => {
      const c = await svc.createCanvas(actor, a as never);
      return { id: c.id, title: c.title, items: c.itemCount, url: canvasUrl(c.id) };
    }),
  );

  server.registerTool(
    "canvas_add_items",
    {
      title: "Add to a canvas",
      description: `Add items to a canvas; they appear live if the user has it open. ${ITEM_HELP} ${LAYOUT_HELP}`,
      inputSchema: {
        canvas: z.uuid(),
        items: z.array(z.object({ content: CanvasItemContent, layout: CanvasLayout.optional() })).min(1).max(50),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: { canvas: string; items: { content: unknown; layout?: unknown }[] }, actor) => {
      const r = await svc.addCanvasItems(actor, a.canvas, { items: a.items as never });
      return { added: r.ids, batch: r.batch, pending: actor.kind !== "human", version: r.version, url: canvasUrl(a.canvas) };
    }),
  );

  server.registerTool(
    "canvas_update_item",
    {
      title: "Change a canvas item",
      description: `Replace an item's content (any kind) and/or move or resize it. ${LAYOUT_HELP}`,
      inputSchema: {
        canvas: z.uuid(),
        item: z.uuid(),
        content: CanvasItemContent.optional(),
        layout: CanvasLayout.optional(),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: { canvas: string; item: string; content?: unknown; layout?: unknown }, actor) =>
      svc.updateCanvasItem(actor, a.canvas, a.item, { content: a.content as never, layout: a.layout as never }),
    ),
  );

  server.registerTool(
    "canvas_remove_items",
    {
      title: "Remove from a canvas",
      description: "Take items off a canvas (the content they show stays on the site).",
      inputSchema: { canvas: z.uuid(), items: z.array(z.uuid()).min(1).max(200) },
      annotations: { ...WRITE, destructiveHint: true },
    },
    run(ctx, async (a: { canvas: string; items: string[] }, actor) => svc.removeCanvasItems(actor, a.canvas, a.items)),
  );

  server.registerTool(
    "canvas_arrange",
    {
      title: "Arrange a canvas",
      description: `Arrange items: \`order\` lays every item out in that order, row by row, each keeping its size (sections start a row); \`layouts\` places named items exactly; \`tidy\` closes the gaps. ${LAYOUT_HELP}`,
      inputSchema: {
        canvas: z.uuid(),
        order: z.array(z.uuid()).max(200).optional(),
        layouts: z.array(z.object({ id: z.uuid(), layout: CanvasLayout })).max(200).optional(),
        tidy: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: { canvas: string; order?: string[]; layouts?: { id: string; layout: unknown }[]; tidy?: boolean }, actor) =>
      svc.arrangeCanvas(actor, a.canvas, { order: a.order, layouts: a.layouts as never, tidy: a.tidy }),
    ),
  );

  server.registerTool(
    "canvas_link",
    {
      title: "Link items on a canvas",
      description:
        "Draw lines between items on a canvas, each saying how they relate: supports, contradicts, causes, precedes, same_as, questions or related, with an optional short label. Say only what the claims themselves support.",
      inputSchema: {
        canvas: z.uuid(),
        links: z.array(CanvasLinkInput).min(1).max(100),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: { canvas: string; links: unknown[] }, actor) => svc.addCanvasLinks(actor, a.canvas, a.links as never)),
  );

  server.registerTool(
    "canvas_unlink",
    {
      title: "Remove links from a canvas",
      description: "Remove lines between items (the items stay).",
      inputSchema: { canvas: z.uuid(), links: z.array(z.uuid()).min(1).max(100) },
      annotations: { ...WRITE, destructiveHint: true },
    },
    run(ctx, async (a: { canvas: string; links: string[] }, actor) => svc.removeCanvasLinks(actor, a.canvas, a.links)),
  );

  server.registerTool(
    "canvas_update",
    {
      title: "Rename a canvas",
      description: "Change a canvas's title or description (Markdown; null clears it).",
      inputSchema: { canvas: z.uuid(), title: z.string().min(1).max(120).optional(), description: z.string().max(2000).nullable().optional() },
      annotations: WRITE,
    },
    run(ctx, async (a: { canvas: string; title?: string; description?: string | null }, actor) => {
      const c = await svc.updateCanvas(actor, a.canvas, { title: a.title, description: a.description });
      return { id: c.id, title: c.title, url: canvasUrl(c.id) };
    }),
  );

  server.registerTool(
    "canvas_delete",
    {
      title: "Delete a canvas",
      description: "Delete a whole canvas and its items. Only when the user asks for it.",
      inputSchema: { canvas: z.uuid() },
      annotations: { ...WRITE, destructiveHint: true },
    },
    run(ctx, async (a: { canvas: string }, actor) => {
      await svc.deleteCanvas(actor, a.canvas);
      return { deleted: a.canvas };
    }),
  );

  // ------------------------------------------------------------------ your view of a page
  server.registerTool(
    "view_get",
    {
      title: "The user's view of a page",
      description:
        "How the user has customised an era page or entity page for themselves (what is hidden, the rail's order, the map's turning points, reading mode, emphasised names, marked claims, their notes), or, for subject \"site\", how the site looks for them (appearance: text size, line width, evidence density, theme), with recent changes and who made them.",
      inputSchema: { subject: Subject, ref: ViewRef },
      annotations: READ,
    },
    run(ctx, async (a: { subject: SubjectType; ref?: string }, actor) => viewResult(await svc.getUserView(actor, a.subject, a.ref ?? "site"), a.ref ?? "site")),
  );

  server.registerTool(
    "view_list",
    {
      title: "Pages the user has customised",
      description: "Every page and entity the user has a view of their own for.",
      annotations: READ,
    },
    run(ctx, async (_a: unknown, actor) =>
      (await svc.listUserViews(actor)).map((s) => ({ subject: s.subject, summary: describeUserView(s.view) })),
    ),
  );

  server.registerTool(
    "view_set",
    {
      title: "Tailor a page for the user",
      description:
        'Change the user\'s own view of a page, to help them understand it (after a quiz shows confusion, say). Only the keys given change; null clears a setting. The page itself is not changed. Keys: hide / show (panels: era pages "already_know", "media", "meanwhile", "atlas", "timeline", "in_this_part", "notes", "outline"; entity pages "atlas", "when", "held", "claims", "links", "nearby", "pages", "history"), railOrder (["notes", "atlas", ...]), atlas {hideStops: [years], stops: [{year, label, claimId?}] (years worth returning to; label from the page\'s claims), initialYear, modernLabels}, reading ("skim" | "full"), foldKnown (keep parts already read folded), explainWords, emphasis ([entity slugs] drawn stronger), highlights ([{claimId, tone: "remember" | "question"}]), annotations ([{id, claimId? | blockId?, markdown}]), pinnedNotes ([{noteId, blockId}]: a study note you posted, shown at the top of a part). For subject \"site\" (omit ref): appearance {text: \"small\"|\"standard\"|\"large\", width: \"standard\"|\"wide\", density: \"quiet\"|\"standard\"|\"full\", theme: \"system\"|\"light\"|\"dark\"} changes how the whole site looks for the user. Always give `why`: the user sees "Your AI changed this view", your reason, and Undo. You may not hide "claims": disagreement stays in view unless the user hides it. Use learner_signals to decide what to bring forward.',
      inputSchema: {
        subject: Subject,
        ref: ViewRef,
        changes: UserViewPatch,
        why: z.string().min(3).max(500).describe("one plain sentence the user will read"),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: { subject: SubjectType; ref?: string; changes: unknown; why: string }, actor) =>
      viewResult(await svc.setUserView(actor, a.subject, a.ref ?? "site", a.changes as never, a.why), a.ref ?? "site"),
    ),
  );

  server.registerTool(
    "view_reset",
    {
      title: "Put a page back as published",
      description: "Clear the user's view of a page (recorded, so the user can undo it).",
      inputSchema: { subject: Subject, ref: ViewRef, why: z.string().min(3).max(500) },
      annotations: WRITE,
    },
    run(ctx, async (a: { subject: SubjectType; ref?: string; why: string }, actor) =>
      viewResult(await svc.resetUserView(actor, a.subject, a.ref ?? "site", a.why), a.ref ?? "site"),
    ),
  );

  server.registerTool(
    "view_undo",
    {
      title: "Undo the last change to a view",
      description: "Undo the latest change to the user's view of a page (whoever made it).",
      inputSchema: { subject: Subject, ref: ViewRef },
      annotations: WRITE,
    },
    run(ctx, async (a: { subject: SubjectType; ref?: string }, actor) =>
      viewResult(await svc.undoUserView(actor, a.subject, a.ref ?? "site"), a.ref ?? "site"),
    ),
  );
}
