import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  findWikidataByWikipediaTitle,
  getCommonsFiles,
  toCandidate,
  getWikidataSummary,
  getWikipediaArticle,
  resolveDoi,
  resolveIsbn,
  searchInternetArchive,
  searchWikidata,
} from "@pramana/connectors";
import {
  Bbox,
  Block,
  BlockId,
  blockFingerprint,
  ChangeOp,
  fingerprint,
  Fingerprint,
  PatchAnchor,
  SpecPath,
  DateInput,
  EntityRef,
  MediaFocus,
  normalizeFileTitle,
  RefName,
  Representation,
  ChangesetStatus,
  BeliefInput,
  CheckAnswerInput,
  GuessInput,
  ReviewRating,
  SpanRole,
  Sureness,
  SupportVerdict,
  toAstronomicalYear,
} from "@pramana/core";
import * as svc from "@pramana/services";
import { z } from "zod";
import { registerCanvasTools } from "./canvas-tools";
import { registerLearnTools } from "./learn-tools";
import { registerNoteTools } from "./notes-tools";
import { type Ctx, EXTERNAL, READ, run, webUrl, WRITE } from "./tool-kit";

export function registerTools(server: McpServer, ctx: Ctx): void {
  // ------------------------------------------------------------------ reading
  server.registerTool(
    "overview",
    {
      title: "Platform overview",
      description:
        "Counts, all pages (slug, title, kind, dates) and pending changesets. Start here.",
      annotations: READ,
    },
    run(ctx, async () => {
      const [stats, pages, pending] = await Promise.all([
        svc.getStats(),
        // Agents see drafts too: they write them.
        svc.listPages({ includeDrafts: true }),
        svc.listChangesets({ status: ["proposed"] }),
      ]);
      return {
        stats,
        pages: pages.map((p) => ({
          slug: p.slug,
          title: p.title,
          kind: p.kind,
          status: p.status,
          when: p.entity?.whenLabel ?? null,
        })),
        pendingChangesets: pending.map((c) => ({
          id: c.id,
          title: c.title,
          ops: c.ops.length,
          author: c.author.handle,
        })),
        web: webUrl(),
      };
    }),
  );

  server.registerTool(
    "search",
    {
      title: "Search",
      description:
        "Full-text search (accent-insensitive, prefix) across pages, entities, claims and sources.",
      inputSchema: {
        query: z.string().min(1).max(200),
        types: z.array(z.enum(["pages", "entities", "claims", "sources"])).optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: READ,
    },
    run(
      ctx,
      async (a: {
        query: string;
        types?: ("pages" | "entities" | "claims" | "sources")[];
        limit?: number;
      }) => svc.search(a.query, { types: a.types, limit: a.limit }),
    ),
  );

  server.registerTool(
    "get_page",
    {
      title: "Read a page",
      description:
        "A page with its blocks, claims (with verification level and citations) and ids. Markdown by default; json for full structured data.",
      inputSchema: {
        page: z.string().describe("slug or id"),
        format: z.enum(["markdown", "json"]).default("markdown"),
      },
      annotations: READ,
    },
    run(ctx, async (a: { page: string; format: "markdown" | "json" }) => {
      const view = await svc.getPageView(a.page);
      return a.format === "json"
        ? view
        : `${svc.pageToMarkdown(view)}\n\nWeb: ${webUrl()}/p/${view.page.slug}`;
    }),
  );

  server.registerTool(
    "get_claim",
    {
      title: "Claim with evidence lineage",
      description:
        "A claim, its citations (excerpt, locator, quote check, support check), the source → edition → work chain, snapshots, how it was found, related claims, pages using it, and its audit history.",
      inputSchema: { id: z.uuid() },
      annotations: READ,
    },
    run(ctx, async (a: { id: string }) => svc.getClaimDetail(a.id)),
  );

  server.registerTool(
    "get_entity",
    {
      title: "Entity",
      description:
        "A person, place, period, polity, event… with dates, names, links to other entities, and claims about it.",
      inputSchema: { entity: z.string().describe("slug or id") },
      annotations: READ,
    },
    run(ctx, async (a: { entity: string }) => svc.getEntityDetail(a.entity)),
  );

  server.registerTool(
    "get_source",
    {
      title: "Source",
      description:
        "A source with its bibliographic record (CSL-JSON), licence, edition chain, excerpts (and the claims citing them) and snapshots.",
      inputSchema: { id: z.uuid() },
      annotations: READ,
    },
    run(ctx, async (a: { id: string }) => svc.getSourceDetail(a.id)),
  );

  server.registerTool(
    "timeline",
    {
      title: "Timeline data",
      description:
        'Dated entities in order (all, or those linked to an entity, or a given list), with date bounds in astronomical years. Each item says which span it draws (role: reign, life, existence…) and lists all of the entity\'s spans. `roles` picks the span per kind, e.g. {"person": ["life"]} (default: persons by reign where recorded). `layers: true` returns one lane per role instead.',
      inputSchema: {
        linkedTo: z.string().optional().describe("entity slug or id"),
        entityIds: z.array(z.string()).optional(),
        kinds: z.array(z.string()).optional(),
        roles: z
          .record(z.string(), z.array(SpanRole))
          .optional()
          .describe("per entity kind, the span roles to draw, most preferred first"),
        layers: z.boolean().optional().describe("group spans into lanes by role"),
      },
      annotations: READ,
    },
    run(
      ctx,
      async (a: {
        linkedTo?: string;
        entityIds?: string[];
        kinds?: string[];
        roles?: Record<string, z.infer<typeof SpanRole>[]>;
        layers?: boolean;
      }) => {
        const { getDb } = await import("@pramana/db");
        if (a.layers)
          return svc.timelineLayers(getDb(), {
            linkedTo: a.linkedTo,
            entityIds: a.entityIds,
            kinds: a.kinds,
          });
        if (!a.linkedTo && !a.entityIds?.length)
          return svc.allDatedEntities(a.kinds, { roles: a.roles });
        return svc.timelineItems(getDb(), {
          linkedTo: a.linkedTo,
          entityIds: a.entityIds,
          kinds: a.kinds,
          roles: a.roles,
        });
      },
    ),
  );

  server.registerTool(
    "extents_at",
    {
      title: "Historical borders in a year",
      description:
        "Polity extents (reconstructed borders, e.g. from Cliopatria) in force in a year, optionally within a bbox [minLon, minLat, maxLon, maxLat]. Year is astronomical (-317 = 318 BCE) unless you give era (then year is historical: 318 + BCE). Geometry is omitted unless geometry: true; every extent carries its licence and attribution.",
      inputSchema: {
        year: z.number().int(),
        era: z.enum(["BCE", "CE"]).optional(),
        bbox: Bbox.optional(),
        geometry: z.boolean().optional(),
        dataset: z.string().optional(),
      },
      annotations: READ,
    },
    run(
      ctx,
      async (a: {
        year: number;
        era?: "BCE" | "CE";
        bbox?: [number, number, number, number];
        geometry?: boolean;
        dataset?: string;
      }) => {
        if (a.era && a.year <= 0) throw new svc.ValidationError("with era, year must be positive");
        const year = a.era ? toAstronomicalYear(a.year, a.era) : a.year;
        const extents = await svc.extentsAt(year, a.bbox, {
          geometry: a.geometry ?? false,
          dataset: a.dataset,
        });
        return { year, count: extents.length, extents };
      },
    ),
  );

  server.registerTool(
    "entity_extents",
    {
      title: "An entity's borders over time",
      description:
        "Every recorded extent of a polity (slug or id), oldest first, with years (astronomical, inclusive), area, dataset, licence and attribution. Geometry only with geometry: true.",
      inputSchema: { entity: z.string().describe("slug or id"), geometry: z.boolean().optional() },
      annotations: READ,
    },
    run(ctx, async (a: { entity: string; geometry?: boolean }) =>
      svc.extentsForEntity(a.entity, { geometry: a.geometry ?? false }),
    ),
  );

  server.registerTool(
    "entities_by_wikidata",
    {
      title: "Match Wikidata items to entities",
      description:
        "For a list of QIDs, the entity that already has each one (existing), or the pending changeset that would create it (pending, with its id and changesetId to use in dependsOn). Use before creating entities to avoid duplicates.",
      inputSchema: {
        qids: z
          .array(z.string().regex(/^Q\d+$/))
          .min(1)
          .max(500),
      },
      annotations: READ,
    },
    run(ctx, async (a: { qids: string[] }) => svc.entitiesByWikidata(a.qids)),
  );

  // ------------------------------------------------------------------ changing content
  server.registerTool(
    "propose_changes",
    {
      title: "Propose a changeset",
      description:
        "Propose content changes as typed ops (create/update entities, sources, excerpts, claims, citations, relations, pages; delete_excerpt removes an excerpt nothing uses). To edit some blocks of an existing page, prefer patch_page (or propose_page_patch) over update_page: it conflicts only with edits to the same blocks. Validated and dry-run immediately; the report shows quote checks and sourcing warnings. A human must approve it in the web UI before it is applied. See the server instructions for refs, dates and evidence rules.",
      inputSchema: {
        title: z.string().min(3).max(300),
        rationale: z
          .string()
          .max(10000)
          .describe("What you read and why this change; shown to the reviewer."),
        dependsOn: z
          .array(z.uuid())
          .optional()
          .describe("pending changesets whose refs/objects this builds on"),
        ops: z.array(ChangeOp).min(1).max(1000),
      },
      annotations: WRITE,
    },
    run(
      ctx,
      async (
        a: { title: string; rationale: string; dependsOn?: string[]; ops: unknown[] },
        actor,
      ) => {
        const result = await svc.proposeChangeset(actor, {
          title: a.title,
          rationale: a.rationale,
          dependsOn: a.dependsOn ?? [],
          ops: a.ops as never,
        });
        return { ...result, review: `${webUrl()}/review/${result.id}` };
      },
    ),
  );

  server.registerTool(
    "propose_page_patch",
    {
      title: "Propose a block-level page edit",
      description:
        'Edit some blocks of a page without replacing the rest: replace blocks in place, insert new ones (after a block id, null for the start, or "end"), remove or move blocks, and set spec keys ("atlas", "hero.media"…; null removes). Each removed or replaced block, and each spec key, is guarded by a fingerprint of how it is now (taken from the page when you call this, unless you give `was`), so the edit fails at approval only if someone changed that same block meanwhile; edits of other blocks never make it stale. Inserting a block that is already there with the same content does nothing. `ops` (e.g. create_claim with refs the new blocks link to) come first. Proposes one changeset with a patch_page op; a human approves it in the web UI.',
      inputSchema: {
        title: z.string().min(3).max(300),
        rationale: z
          .string()
          .max(10000)
          .describe("What you read and why this change; shown to the reviewer."),
        dependsOn: z.array(z.uuid()).optional(),
        page: z.string().describe("slug or id"),
        spec: z
          .array(z.object({ path: SpecPath, value: z.unknown(), was: Fingerprint.optional() }))
          .max(20)
          .optional(),
        remove: z
          .array(z.object({ id: BlockId, was: Fingerprint.optional() }))
          .max(400)
          .optional(),
        replace: z
          .array(z.object({ block: Block, was: Fingerprint.optional() }))
          .max(400)
          .optional(),
        insert: z
          .array(z.object({ after: PatchAnchor, block: Block }))
          .max(400)
          .optional(),
        move: z
          .array(z.object({ id: BlockId, after: PatchAnchor }))
          .max(400)
          .optional(),
        ops: z.array(ChangeOp).max(200).optional(),
      },
      annotations: WRITE,
    },
    run(
      ctx,
      async (
        a: {
          title: string;
          rationale: string;
          dependsOn?: string[];
          page: string;
          spec?: { path: string; value: unknown; was?: string }[];
          remove?: { id: string; was?: string }[];
          replace?: { block: { id: string }; was?: string }[];
          insert?: { after: string | null; block: unknown }[];
          move?: { id: string; after: string | null }[];
          ops?: unknown[];
        },
        actor,
      ) => {
        const view = await svc.getPageView(a.page);
        const now = new Map(view.page.blocks.map((b) => [b.id, blockFingerprint(b)]));
        const was = (id: string, given?: string) => {
          const fp = given ?? now.get(id);
          if (!fp) throw new Error(`block ${id} is not on /${view.page.slug}`);
          return fp;
        };
        const at = (path: string) =>
          path
            .split(".")
            .reduce<unknown>(
              (v, k) =>
                v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined,
              view.page.spec,
            );
        const patch = {
          op: "patch_page",
          page: view.page.slug,
          ...(a.spec?.length
            ? {
                spec: a.spec.map((e) => ({
                  path: e.path,
                  value: e.value ?? null,
                  was: e.was ?? fingerprint(at(e.path)),
                })),
              }
            : {}),
          ...(a.remove?.length
            ? { remove: a.remove.map((r) => ({ id: r.id, was: was(r.id, r.was) })) }
            : {}),
          ...(a.replace?.length
            ? {
                replace: a.replace.map((r) => ({
                  id: r.block.id,
                  was: was(r.block.id, r.was),
                  block: r.block,
                })),
              }
            : {}),
          ...(a.insert?.length ? { insert: a.insert } : {}),
          ...(a.move?.length ? { move: a.move } : {}),
        };
        const result = await svc.proposeChangeset(actor, {
          title: a.title,
          rationale: a.rationale,
          dependsOn: a.dependsOn ?? [],
          ops: [...(a.ops ?? []), patch] as never,
        });
        return { ...result, review: `${webUrl()}/review/${result.id}` };
      },
    ),
  );

  // ------------------------------------------------------------------ media (images)
  server.registerTool(
    "search_commons",
    {
      title: "Search Wikimedia Commons images",
      description:
        "Search freely licensed files on Wikimedia Commons. Each candidate has a thumbnail, author, licence verdict (only public domain, CC0, CC BY and CC BY-SA are accepted; NC/ND/fair use/unknown are refused with a reason), Commons licence tags, and whether it is already on the platform. Look at the file page before choosing: is it what the description says, and where is the object now?",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(300)
          .describe('e.g. "Lion Capital Sarnath museum", "incategory:Dhauli"'),
        limit: z.number().int().min(1).max(50).optional(),
      },
      annotations: EXTERNAL,
    },
    run(ctx, async (a: { query: string; limit?: number }) =>
      svc.searchCommonsMedia(a.query, a.limit),
    ),
  );

  server.registerTool(
    "commons_files",
    {
      title: "Commons files' metadata",
      description:
        'Full metadata of up to 50 Commons files ("File:…"): licence verdict, author, source line, description, date, categories and licence tags, and whether each is already on the platform (onPlatform: existing or pending, with its media id). Missing files are listed. Read-only; nothing is stored.',
      inputSchema: { fileTitles: z.array(z.string().min(1).max(500)).min(1).max(50) },
      annotations: EXTERNAL,
    },
    run(ctx, async (a: { fileTitles: string[] }) => {
      const found = await getCommonsFiles(a.fileTitles);
      const known = await svc.mediaByFileTitle(a.fileTitles);
      const files = a.fileTitles.flatMap((t) => {
        const f = found.get(normalizeFileTitle(t))?.file;
        if (!f) return [];
        return [
          {
            ...toCandidate(f),
            description: f.description,
            categories: f.categories,
            restrictions: f.restrictions,
            onPlatform: known[f.fileTitle] ?? null,
          },
        ];
      });
      const missing = a.fileTitles.filter((t) => !found.has(normalizeFileTitle(t)));
      return { files, missing };
    }),
  );

  server.registerTool(
    "wikidata_images",
    {
      title: "Wikidata images (P18) for entities",
      description:
        "The image files Wikidata gives (P18) for entities with a QID, by slug. P18 is often a later painting or a statue: decide the representation honestly before proposing one.",
      inputSchema: { entities: z.array(z.string()).min(1).max(100).describe("slugs or ids") },
      annotations: EXTERNAL,
    },
    run(ctx, async (a: { entities: string[] }) => svc.wikidataImagesForEntities(a.entities)),
  );

  const MediaItem = z.object({
    fileTitle: z.string().min(1).max(500).describe('"File:…" on Wikimedia Commons'),
    ref: RefName.optional().describe("name for @ref in later ops (figure blocks, hero.media)"),
    title: z.string().min(1).max(200).describe('short, plain: "Lion Capital of Aśoka"'),
    alt: z.string().min(1).max(500).describe("what is in the picture, for screen readers"),
    representation: Representation,
    representationNote: z
      .string()
      .max(500)
      .optional()
      .describe("required in spirit for imaginings: say it is not a likeness"),
    objectDate: DateInput.optional().describe("date of the thing shown (not the photo)"),
    imageDate: DateInput.optional().describe(
      "date of the picture; defaults to the Commons date when plain",
    ),
    depicts: z.array(EntityRef).max(20).optional(),
    focus: MediaFocus.optional().describe("point to keep in frame when cropped, 0..1"),
  });

  server.registerTool(
    "propose_media",
    {
      title: "Propose images (media records)",
      description:
        "Fetches each Commons file's metadata fresh, stores it as a snapshot, refuses non-free licences, and proposes a changeset of create_media ops (licence, author, URLs and credit line taken from the API; you give the title, alt text, what the picture is and what it depicts). Files already on the platform or pending are skipped and reported with their ids. `ops` are appended (e.g. patch_page inserting figure/gallery blocks that use @refs). A human approves in the web UI.",
      inputSchema: {
        title: z.string().min(3).max(300),
        rationale: z.string().max(10000).describe("why these images, and how each was checked"),
        dependsOn: z.array(z.uuid()).optional(),
        items: z.array(MediaItem).min(1).max(40),
        ops: z.array(ChangeOp).max(50).optional(),
      },
      annotations: WRITE,
    },
    run(
      ctx,
      async (
        a: {
          title: string;
          rationale: string;
          dependsOn?: string[];
          items: z.infer<typeof MediaItem>[];
          ops?: unknown[];
        },
        actor,
      ) => {
        const known = await svc.mediaByFileTitle(a.items.map((i) => i.fileTitle));
        const skipped: Record<string, svc.MediaMatch> = {};
        for (const item of a.items) {
          const existing = known[normalizeFileTitle(item.fileTitle)];
          if (existing) skipped[normalizeFileTitle(item.fileTitle)] = existing;
        }
        const fresh = a.items.filter((i) => !skipped[normalizeFileTitle(i.fileTitle)]);
        const captured = await svc.captureCommonsMediaMany(
          actor,
          fresh.map((i) => i.fileTitle),
        );
        const mediaOps = fresh.map(({ fileTitle, ...editorial }) =>
          svc.createMediaOp(captured.get(normalizeFileTitle(fileTitle))!, editorial),
        );
        // Refs of skipped files point at the record that already exists (or is pending, which becomes a dependency).
        const skippedRefs = new Map<string, string>();
        const dependsOn = new Set(a.dependsOn ?? []);
        for (const item of a.items) {
          const match = skipped[normalizeFileTitle(item.fileTitle)];
          if (!match) continue;
          if (item.ref) skippedRefs.set(`@${item.ref}`, match.id);
          if (match.status === "pending") dependsOn.add(match.changesetId);
        }
        const swap = (v: unknown): unknown =>
          typeof v === "string"
            ? (skippedRefs.get(v) ?? v)
            : Array.isArray(v)
              ? v.map(swap)
              : v && typeof v === "object"
                ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]))
                : v;
        const ops = [...mediaOps, ...((a.ops ?? []).map(swap) as never[])];
        if (!mediaOps.length && !(a.ops ?? []).length)
          return { status: "nothing to propose", skipped };
        const result = await svc.proposeChangeset(actor, {
          title: a.title,
          rationale: a.rationale,
          dependsOn: [...dependsOn],
          ops: ops as never,
        });
        return { ...result, skipped, review: `${webUrl()}/review/${result.id}` };
      },
    ),
  );

  server.registerTool(
    "list_media",
    {
      title: "Media on the platform",
      description:
        "Images on the platform (optionally those depicting an entity), with licence, credit line and what each picture is.",
      inputSchema: {
        depicts: z.string().optional().describe("entity slug or id"),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: READ,
    },
    run(ctx, async (a: { depicts?: string; limit?: number }) => svc.listMedia(a)),
  );

  server.registerTool(
    "refresh_media",
    {
      title: "Re-read media metadata from Commons",
      description:
        "Fetches the current Commons metadata of existing media records (by id or file title), stores it as a new snapshot, and proposes update_media ops for records whose licence, author, source line, size or URLs changed (with a re-derived credit line). Records that still match are reported as current. A human approves in the web UI.",
      inputSchema: {
        media: z
          .array(z.string().min(1))
          .min(1)
          .max(50)
          .describe("media ids or Commons file titles"),
        rationale: z.string().max(4000).optional(),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: { media: string[]; rationale?: string }, actor) => {
      const records = await Promise.all(a.media.map((m) => svc.getMedia(m)));
      const captured = await svc.captureCommonsMediaMany(
        actor,
        records.map((r) => r.fileTitle),
      );
      const ops = [];
      const current: string[] = [];
      for (const r of records) {
        const set = svc.mediaRefreshSet(r, captured.get(r.fileTitle)!);
        if (set) ops.push({ op: "update_media" as const, media: r.id, set });
        else current.push(r.title);
      }
      if (!ops.length) return { status: "all current", current };
      const result = await svc.proposeChangeset(actor, {
        title: `Media: refresh Commons metadata (${ops.length})`,
        rationale:
          a.rationale ??
          "Re-read from the Commons API; the new snapshot is attached to each record.",
        ops: ops as never,
      });
      return { ...result, current, review: `${webUrl()}/review/${result.id}` };
    }),
  );

  server.registerTool(
    "media_by_file",
    {
      title: "Match Commons files to media records",
      description:
        "For a list of Commons file titles, the media record that already has each one (existing), or the pending changeset that would create it (pending, with changesetId for dependsOn). Database only.",
      inputSchema: { fileTitles: z.array(z.string().min(1).max(500)).min(1).max(200) },
      annotations: READ,
    },
    run(ctx, async (a: { fileTitles: string[] }) => svc.mediaByFileTitle(a.fileTitles)),
  );

  server.registerTool(
    "get_media",
    {
      title: "One media record",
      description:
        "A media record by id or Commons file title, with the entities it depicts and its metadata snapshot id.",
      inputSchema: { media: z.string().min(1) },
      annotations: READ,
    },
    run(ctx, async (a: { media: string }) => svc.getMedia(a.media)),
  );

  server.registerTool(
    "list_changesets",
    {
      title: "List changesets",
      description: "Recent changesets, optionally filtered by status.",
      inputSchema: {
        status: z.array(ChangesetStatus).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: READ,
    },
    run(ctx, async (a: { status?: z.infer<typeof ChangesetStatus>[]; limit?: number }) =>
      (await svc.listChangesets(a)).map((c) => ({
        id: c.id,
        status: c.status,
        title: c.title,
        ops: c.ops.length,
        author: c.author.handle,
        createdAt: c.createdAt,
        decidedBy: c.decidedBy?.handle ?? null,
        error: c.error,
      })),
    ),
  );

  server.registerTool(
    "get_changeset",
    {
      title: "Get a changeset",
      description:
        "Full changeset: ops (refs resolved), assigned ids, dry-run report, status and decision.",
      inputSchema: { id: z.uuid() },
      annotations: READ,
    },
    run(ctx, async (a: { id: string }) => svc.getChangeset(a.id)),
  );

  server.registerTool(
    "withdraw_changeset",
    {
      title: "Withdraw a changeset",
      description:
        "Withdraw one of your pending proposals (e.g. to replace it with a corrected one).",
      inputSchema: { id: z.uuid(), note: z.string().max(2000).optional() },
      annotations: WRITE,
    },
    run(ctx, async (a: { id: string; note?: string }, actor) =>
      svc.withdrawChangeset(actor, a.id, a.note),
    ),
  );

  // ------------------------------------------------------------------ evidence
  server.registerTool(
    "capture_snapshot",
    {
      title: "Capture a source text",
      description:
        "Fetch and store an immutable text snapshot to quote from and verify against: an Internet Archive item's OCR text, a Wikipedia article (pinned revision), a web page, or text you were given. Returns the snapshot id.",
      inputSchema: { origin: svc.SnapshotOrigin },
      annotations: { ...WRITE, openWorldHint: true },
    },
    run(ctx, async (a: { origin: z.infer<typeof svc.SnapshotOrigin> }, actor) =>
      svc.captureSnapshot(actor, a.origin),
    ),
  );

  server.registerTool(
    "find_in_snapshot",
    {
      title: "Find a passage in a snapshot",
      description:
        "Accent- and punctuation-insensitive phrase search in a snapshot; returns passages with character offsets so you can quote exact words.",
      inputSchema: {
        snapshotId: z.uuid(),
        phrase: z.string().min(2).max(500),
        limit: z.number().int().min(1).max(30).optional(),
        radius: z.number().int().min(50).max(3000).optional(),
      },
      annotations: READ,
    },
    run(ctx, async (a: { snapshotId: string; phrase: string; limit?: number; radius?: number }) =>
      svc.findInSnapshot(a.snapshotId, a.phrase, { limit: a.limit, radius: a.radius }),
    ),
  );

  server.registerTool(
    "read_snapshot",
    {
      title: "Read part of a snapshot",
      description: "Read a character range of a snapshot (max 20,000 chars per call).",
      inputSchema: {
        snapshotId: z.uuid(),
        start: z.number().int().min(0),
        length: z.number().int().min(1).max(20000),
      },
      annotations: READ,
    },
    run(ctx, async (a: { snapshotId: string; start: number; length: number }) =>
      svc.readSnapshotRange(a.snapshotId, a.start, a.length),
    ),
  );

  server.registerTool(
    "uncited_excerpts",
    {
      title: "Excerpts no claim cites",
      description:
        "Every excerpt with no citation, oldest first: its source, snapshot, quote and locator, the pages that show it (those cannot be removed), and `duplicates`: other excerpts holding exactly the same evidence (same source, snapshot, quote, locator, original text and note) with how often each is cited. Remove an unused copy with the op delete_excerpt (via propose_changes); keep the cited copy, or one copy if none is cited.",
      inputSchema: {},
      annotations: READ,
    },
    run(ctx, async () => svc.uncitedExcerpts()),
  );

  server.registerTool(
    "reverify_excerpt",
    {
      title: "Re-run the quote check",
      description:
        "Re-check an excerpt's quote against its snapshot (after attaching a snapshot or improving the matcher).",
      inputSchema: { excerptId: z.uuid() },
      annotations: WRITE,
    },
    run(ctx, async (a: { excerptId: string }, actor) => svc.reverifyExcerpt(actor, a.excerptId)),
  );

  server.registerTool(
    "check_support",
    {
      title: "Judge whether an excerpt supports its claim",
      description:
        "Record your judgment on a citation: does the excerpt actually support the claim (not just mention the topic)? Be adversarial. Recorded as AI-checked (L3 if the quote is verified); only a human can confirm. The judgment is pinned to the claim text, quote and stance; if any changes it no longer counts until judged again.",
      inputSchema: {
        citationId: z.uuid(),
        verdict: SupportVerdict,
        note: z.string().min(1).max(2000).describe("your reasoning"),
      },
      annotations: WRITE,
    },
    run(
      ctx,
      async (
        a: { citationId: string; verdict: z.infer<typeof SupportVerdict>; note: string },
        actor,
      ) => svc.recordSupportCheck(actor, a.citationId, a.verdict, a.note),
    ),
  );

  server.registerTool(
    "check_claim_support",
    {
      title: "Judge whether a claim's excerpts support it together",
      description:
        "For a compound claim whose parts rest on different excerpts (each citation only partial): do the given citations, read together, support the WHOLE claim? Judge each citation first with check_support; use this only when no single excerpt carries the claim. Name every citation you relied on. Recorded as AI-checked; it lifts the claim to L3 only if the verdict is supports and every named citation's quote is verified. It stops counting if the claim text or its citations change.",
      inputSchema: {
        claimId: z.uuid(),
        verdict: SupportVerdict,
        note: z
          .string()
          .min(1)
          .max(2000)
          .describe("your reasoning: which citation carries which part"),
        citationIds: z.array(z.uuid()).min(1).describe("the citations considered together"),
      },
      annotations: WRITE,
    },
    run(
      ctx,
      async (
        a: {
          claimId: string;
          verdict: z.infer<typeof SupportVerdict>;
          note: string;
          citationIds: string[];
        },
        actor,
      ) => svc.recordClaimSupport(actor, a.claimId, a.verdict, a.note, a.citationIds),
    ),
  );

  // ------------------------------------------------------------------ co-learning
  server.registerTool(
    "due_reviews",
    {
      title: "Cards due for review",
      description:
        "Spaced-repetition cards due now for the user (optionally for one page). Quiz the user, then call record_review.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).optional(),
        page: z.string().optional(),
      },
      annotations: READ,
    },
    run(ctx, async (a: { limit?: number; page?: string }, actor) =>
      svc.dueCards(actor, { limit: a.limit, pageId: a.page }),
    ),
  );

  server.registerTool(
    "record_review",
    {
      title: "Record a review",
      description:
        "Record how the user did on a card. Preferred: `correct` and `sureness` (how sure they said they were before the answer: low = just a guess, medium = fairly sure, high = sure), and `easy` if they were sure, right and found it easy; the FSRS rating is derived from these. Or give `rating` again|hard|good|easy (and optionally `confidence` 0–100) directly. Sure-and-wrong answers are flagged and rescheduled sooner.",
      inputSchema: {
        claimId: z.uuid(),
        rating: ReviewRating.optional(),
        sureness: Sureness.optional(),
        confidence: z.number().int().min(0).max(100).optional(),
        correct: z.boolean().optional(),
        easy: z.boolean().optional(),
      },
      annotations: WRITE,
    },
    run(ctx, async (a: unknown, actor) => svc.recordReview(actor, a)),
  );

  server.registerTool(
    "add_to_deck",
    {
      title: "Add claims to the review deck",
      description:
        "Add specific claims, or every claim on a page, to the user's spaced-repetition deck.",
      inputSchema: { claimIds: z.array(z.uuid()).optional(), page: z.string().optional() },
      annotations: WRITE,
    },
    run(ctx, async (a: { claimIds?: string[]; page?: string }, actor) => {
      if (a.page) return svc.addPageToDeck(actor, a.page);
      if (a.claimIds?.length) return svc.addCards(actor, a.claimIds);
      throw new svc.ValidationError("give claimIds or page");
    }),
  );

  server.registerTool(
    "chapter_questions",
    {
      title: "Guess-first questions and chapter checks on a page",
      description:
        'The "Guess first" questions (block type guess, asked before a chapter is read), the end-of-chapter checks (type check: recall, order and place questions) and the misconceptions on a page, with what the user has already answered. Ask a question before revealing its answer; record the user\'s own answer with record_guess, record_check_answer or record_belief.',
      inputSchema: { page: z.string() },
      annotations: READ,
    },
    run(ctx, async (a: { page: string }, actor) => {
      const view = await svc.getPageView(a.page);
      const state = await svc.pageLearning(actor, view.page.id);
      const blocks = view.page.blocks.filter(
        (b) => b.type === "guess" || b.type === "check" || b.type === "misconception",
      );
      return { page: view.page.slug, pageId: view.page.id, blocks, answered: state };
    }),
  );

  server.registerTool(
    "record_guess",
    {
      title: "Record the user's guess",
      description:
        'Record the user\'s own answer to a "Guess first" question (block id from chapter_questions) and how sure they were. Only the first guess counts; a second call returns the stored one. Returns the grading (right, or close for numbers and years). Never guess for the user.',
      inputSchema: GuessInput.shape,
      annotations: WRITE,
    },
    run(ctx, async (a: unknown, actor) => svc.recordGuess(actor, a)),
  );

  server.registerTool(
    "record_check_answer",
    {
      title: "Record an answer to a chapter check",
      description:
        "Record the user's own answer to one question of an end-of-chapter check: recall {kind: recall, recalled} (the user judges themselves against the answer), order {kind: order, order: claim ids earliest first} or place {kind: place, at: [lon, lat]}, with sureness before the answer. Graded against the stored claim dates and entity coordinates; a recall answer also reviews the claim's card if it is in the deck.",
      inputSchema: CheckAnswerInput.shape,
      annotations: WRITE,
    },
    run(ctx, async (a: unknown, actor) => svc.recordCheckAnswer(actor, a)),
  );

  server.registerTool(
    "record_belief",
    {
      title: "Record whether the user believed a misconception",
      description:
        "On a misconception block: did the user believe it before reading (yes | no | unsure)? A belief they held is added to their deck so the correction is reviewed.",
      inputSchema: BeliefInput.shape,
      annotations: WRITE,
    },
    run(ctx, async (a: unknown, actor) => svc.recordBelief(actor, a)),
  );

  server.registerTool(
    "get_insights",
    {
      title: "Public insights",
      description:
        "Platform-wide statistics, as shown on /insights: evidence health (claims by verification level and source tier per page, quote checks, tertiary-only claims, chapters where the evidence is thin, sources by tier, kind and licence), who changes what (changesets by actor kind and outcome, ops by month), and learning patterns aggregated over learners (prior beliefs in misconceptions, first-guess accuracy, sure-and-wrong answers, hardest claims). Learning values from fewer than minGroup learners are null; response counts are always given. No per-person data.",
      annotations: READ,
    },
    run(ctx, async () => svc.getInsights()),
  );

  server.registerTool(
    "my_progress",
    {
      title: "Learning progress",
      description:
        "The user's deck, review accuracy and confidence calibration (last 7 days), guesses, chapter checks, confident errors and prior beliefs, and per-page progress.",
      annotations: READ,
    },
    run(ctx, async (_a: unknown, actor) => svc.getProgress(actor)),
  );

  server.registerTool(
    "audit_log",
    {
      title: "Audit log",
      description:
        "Append-only history: who did what, for whom, in which session. Filter by subject (any id), changeset or session ('current' = this session).",
      inputSchema: {
        subjectId: z.uuid().optional(),
        changesetId: z.uuid().optional(),
        sessionId: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      },
      annotations: READ,
    },
    run(
      ctx,
      async (
        a: { subjectId?: string; changesetId?: string; sessionId?: string; limit?: number },
        actor,
      ) =>
        svc.listEvents({
          ...a,
          viewer: svc.ownerOf(actor),
          sessionId: a.sessionId === "current" ? (actor.sessionId ?? undefined) : a.sessionId,
        }),
    ),
  );

  // ------------------------------------------------------------------ open sources
  server.registerTool(
    "wikidata",
    {
      title: "Wikidata lookup",
      description:
        "Look up a Wikidata item by QID or English Wikipedia title (labels, multilingual aliases, dates converted to EDTF, coordinates), or search by text.",
      inputSchema: {
        qid: z
          .string()
          .regex(/^Q\d+$/)
          .optional(),
        wikipediaTitle: z.string().optional(),
        search: z.string().optional(),
      },
      annotations: EXTERNAL,
    },
    run(ctx, async (a: { qid?: string; wikipediaTitle?: string; search?: string }) => {
      if (a.qid) return getWikidataSummary(a.qid);
      if (a.wikipediaTitle) return findWikidataByWikipediaTitle(a.wikipediaTitle);
      if (a.search) return searchWikidata(a.search);
      throw new svc.ValidationError("give qid, wikipediaTitle or search");
    }),
  );

  server.registerTool(
    "wikipedia_article",
    {
      title: "Wikipedia article (discovery)",
      description:
        "A pinned revision of a Wikipedia article: the outline with citation counts, or one section's text with the full citations it uses (CSL-JSON, ISBN/DOI, page locators). Use it to find sources, not as evidence.",
      inputSchema: {
        title: z.string().min(1),
        lang: z.string().default("en"),
        section: z.string().optional().describe("section title; omit for the outline"),
      },
      annotations: EXTERNAL,
    },
    run(ctx, async (a: { title: string; lang: string; section?: string }) => {
      const article = await getWikipediaArticle(a.title, a.lang);
      const base = {
        title: article.title,
        revisionId: article.revisionId,
        url: article.url,
        license: article.license,
      };
      if (!a.section) {
        return {
          ...base,
          sections: article.sections.map((s) => ({
            title: s.title,
            level: s.level,
            chars: s.text.length,
            citations: s.citations.length,
          })),
          citationsTotal: article.citations.length,
        };
      }
      const section = article.sections.find(
        (s) => s.title.toLowerCase() === a.section!.toLowerCase(),
      );
      if (!section)
        throw new svc.NotFoundError(
          `no section "${a.section}"; sections: ${article.sections.map((s) => s.title).join(" | ")}`,
        );
      return {
        ...base,
        section: section.title,
        text: section.text,
        citations: section.citations.map((c) => ({
          ...article.citations[c.citation],
          pages: c.pages,
        })),
      };
    }),
  );

  server.registerTool(
    "internet_archive_search",
    {
      title: "Search Internet Archive texts",
      description:
        "Search digitised books (including the Digital Library of India). Query syntax: title:(...) AND creator:(...). Capture one with capture_snapshot {kind: internet_archive}.",
      inputSchema: { query: z.string().min(1), rows: z.number().int().min(1).max(50).optional() },
      annotations: EXTERNAL,
    },
    run(ctx, async (a: { query: string; rows?: number }) => searchInternetArchive(a.query, a.rows)),
  );

  server.registerTool(
    "resolve_identifier",
    {
      title: "Resolve a DOI or ISBN",
      description:
        "Bibliographic metadata as CSL-JSON (Crossref for DOIs, Open Library for ISBNs), ready for create_source.",
      inputSchema: { doi: z.string().optional(), isbn: z.string().optional() },
      annotations: EXTERNAL,
    },
    run(ctx, async (a: { doi?: string; isbn?: string }) => {
      if (a.doi) return resolveDoi(a.doi);
      if (a.isbn) return resolveIsbn(a.isbn);
      throw new svc.ValidationError("give doi or isbn");
    }),
  );

  // ------------------------------------------------------------------ area tools (one file each)
  registerLearnTools(server, ctx);
  registerNoteTools(server, ctx);
  registerCanvasTools(server, ctx);
}
