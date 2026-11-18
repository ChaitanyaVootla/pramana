import {
  applyPagePatch,
  bareRefLinks,
  Blocks,
  defaultPageSpec,
  PageSpec as PageSpecSchema,
  claimIdsInBlock,
  claimIdsInSpec,
  entityRefsInBlock,
  entityRefsInSpec,
  isUnknownArtist,
  markdownInBlock,
  mediaRefsInBlock,
  mediaRefsInSpec,
  type PageSpec,
  dateBounds,
  extractLinks,
  findQuote,
  bboxOf,
  isUuid,
  MultiPolygonGeometry,
  primarySpan,
  slugify,
  toEntitySpans,
  toFuzzyDate,
  uuidv7,
  type Block,
  type ChangeOp,
  type ExcerptVerification,
} from "@pramana/core";
import {
  changesets,
  citations,
  claimEntities,
  claimRelations,
  claims,
  entities,
  entityLinks,
  excerpts,
  extents,
  media,
  pageRevisions,
  pages,
  sources,
  type Tx,
} from "@pramana/db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { recordEvent } from "./audit";
import type { ActorContext } from "./context";
import { compareWithFile, fileFromSnapshot } from "./media";
import { loadSnapshotText } from "./snapshots";
import { changedFields, foldForSearch, ValidationError } from "./util";

/** A stored op: refs resolved, and create ops carry the id assigned at proposal time. */
export type StoredOp = ChangeOp & { id?: string };

export interface OpOutcome {
  index: number;
  op: ChangeOp["op"];
  subjectType: string;
  subjectId: string;
  summary: string;
}

export interface ExcerptCheck {
  excerptId: string;
  status: ExcerptVerification["status"];
  score?: number;
  occurrences?: number;
  matchedText?: string;
}

export interface ApplyState {
  tx: Tx;
  /** The changeset's author (agent or human), recorded on per-object events. */
  author: ActorContext;
  changesetId: string;
  outcomes: OpOutcome[];
  excerptChecks: ExcerptCheck[];
  touchedClaims: Set<string>;
  /** op index -> version of the object an update op saw (recorded at proposal). */
  baseVersions: Map<number, number>;
}

export class OpError extends Error {
  override name = "OpError";
  constructor(
    readonly index: number,
    readonly op: string,
    message: string,
  ) {
    super(`op #${index} (${op}): ${message}`);
  }
}

function friendlyDbError(error: unknown): string {
  const e = error as {
    code?: string;
    constraint_name?: string;
    detail?: string;
    message?: string;
    cause?: unknown;
  };
  const inner = (e.cause ?? e) as typeof e;
  if (inner.code === "23505")
    return `already exists (${inner.constraint_name ?? "unique"}): ${inner.detail ?? ""}`.trim();
  if (inner.code === "23503")
    return `refers to something that does not exist: ${inner.detail ?? inner.constraint_name ?? ""}`;
  return inner.message ?? e.message ?? String(error);
}

async function resolveEntity(tx: Tx, ref: string): Promise<string> {
  const row = isUuid(ref)
    ? await tx.query.entities.findFirst({ where: eq(entities.id, ref), columns: { id: true } })
    : await tx.query.entities.findFirst({ where: eq(entities.slug, ref), columns: { id: true } });
  if (!row) throw new ValidationError(`entity "${ref}" not found`);
  return row.id;
}

async function resolvePage(tx: Tx, ref: string) {
  const row = isUuid(ref)
    ? await tx.query.pages.findFirst({ where: eq(pages.id, ref) })
    : await tx.query.pages.findFirst({ where: eq(pages.slug, ref) });
  if (!row) throw new ValidationError(`page "${ref}" not found`);
  return row;
}

async function requireRow(
  tx: Tx,
  table: typeof claims | typeof sources | typeof excerpts | typeof citations,
  id: string,
  label: string,
) {
  const [row] = await tx.select({ id: table.id }).from(table).where(eq(table.id, id)).limit(1);
  if (!row) throw new ValidationError(`${label} ${id} not found`);
}

function entitySearchText(
  label: string,
  aliases: { label: string }[] | undefined,
  description: string | null | undefined,
) {
  return foldForSearch(label, ...(aliases ?? []).map((a) => a.label), description);
}

async function verifyQuote(snapshotId: string | undefined, quote: string | undefined) {
  if (!quote)
    return {
      verification: { status: "no_quote" } as ExcerptVerification,
      selector: null,
      check: {},
    };
  if (!snapshotId)
    return {
      verification: { status: "no_snapshot" } as ExcerptVerification,
      selector: null,
      check: {},
    };
  const { text, normalized } = await loadSnapshotText(snapshotId);
  const match = findQuote(text, quote, { normalized });
  const verification: ExcerptVerification = {
    status: match.status === "exact" ? "exact" : match.status === "fuzzy" ? "fuzzy" : "not_found",
    score: Number(match.score.toFixed(4)),
    method: "quote-match-v1",
    checkedAt: new Date().toISOString(),
  };
  const selector =
    match.quote && match.position ? { quote: match.quote, position: match.position } : null;
  return {
    verification,
    selector,
    check: {
      score: verification.score,
      occurrences: match.occurrences,
      ...(match.status === "fuzzy" ? { matchedText: match.matchedText } : {}),
    },
  };
}

/** Every id a page's blocks point to must exist. */
async function checkBlockRefs(tx: Tx, blocks: Block[], spec?: PageSpec | null): Promise<void> {
  const claimIds = new Set<string>(claimIdsInSpec(spec));
  const entityRefs = new Set<string>(entityRefsInSpec(spec));
  const excerptIds = new Set<string>();
  const mediaIds = new Set<string>(mediaRefsInSpec(spec));
  const bareLinks: string[] = [];
  for (const block of blocks) {
    for (const id of claimIdsInBlock(block)) claimIds.add(id);
    entityRefsInBlock(block).forEach((ref) => entityRefs.add(ref));
    mediaRefsInBlock(block).forEach((id) => mediaIds.add(id));
    if (block.type === "quote") excerptIds.add(block.excerptId);
    for (const md of markdownInBlock(block)) {
      for (const link of extractLinks(md)) {
        if (link.scheme === "entity") entityRefs.add(link.target);
        if (link.scheme === "excerpt") excerptIds.add(link.target);
      }
      bareLinks.push(...bareRefLinks(md));
    }
  }
  const problems: string[] = [];
  if (bareLinks.length)
    problems.push(`links need a scheme (claim:, entity:, source:, excerpt: or page:): ${bareLinks.join(", ")}`);
  const badClaims = [...claimIds].filter((id) => !isUuid(id));
  if (badClaims.length)
    problems.push(`claim references must be ids or @refs: ${badClaims.join(", ")}`);
  const claimUuids = [...claimIds].filter(isUuid);
  if (claimUuids.length) {
    const found = new Set(
      (await tx.select({ id: claims.id }).from(claims).where(inArray(claims.id, claimUuids))).map(
        (r) => r.id,
      ),
    );
    const missing = claimUuids.filter((id) => !found.has(id));
    if (missing.length) problems.push(`unknown claims: ${missing.join(", ")}`);
  }
  for (const ref of entityRefs) {
    try {
      await resolveEntity(tx, ref);
    } catch {
      problems.push(`unknown entity: ${ref}`);
    }
  }
  const excerptUuids = [...excerptIds].filter(isUuid);
  if (excerptUuids.length) {
    const found = new Set(
      (
        await tx
          .select({ id: excerpts.id })
          .from(excerpts)
          .where(inArray(excerpts.id, excerptUuids))
      ).map((r) => r.id),
    );
    const missing = excerptUuids.filter((id) => !found.has(id));
    if (missing.length) problems.push(`unknown excerpts: ${missing.join(", ")}`);
  }
  const badMedia = [...mediaIds].filter((id) => !isUuid(id));
  if (badMedia.length) problems.push(`media references must be ids or @refs: ${badMedia.join(", ")}`);
  const mediaUuids = [...mediaIds].filter(isUuid);
  if (mediaUuids.length) {
    const found = new Set(
      (await tx.select({ id: media.id }).from(media).where(inArray(media.id, mediaUuids))).map((r) => r.id),
    );
    const missing = mediaUuids.filter((id) => !found.has(id));
    if (missing.length) problems.push(`unknown media: ${missing.join(", ")}`);
  }
  if (problems.length) throw new ValidationError(`page blocks: ${problems.join("; ")}`);
}

/** Fails a stale edit: the object changed after this update was proposed. */
function checkBase(state: ApplyState, index: number, op: { baseVersion?: number }, current: number, label: string) {
  if (op.baseVersion !== undefined && op.baseVersion !== current) {
    throw new ValidationError(
      `${label} changed after this edit was proposed (now version ${current}, edit made against version ${op.baseVersion}); propose the edit again`,
    );
  }
  state.baseVersions.set(index, current);
}

async function event(
  state: ApplyState,
  action: string,
  subjectType: string,
  subjectId: string,
  data: Record<string, unknown>,
) {
  await recordEvent(state.tx, state.author, {
    action,
    subjectType,
    subjectId,
    changesetId: state.changesetId,
    data,
  });
}

async function applyOne(state: ApplyState, op: StoredOp, index: number): Promise<OpOutcome> {
  const { tx } = state;
  const done = (subjectType: string, subjectId: string, summary: string): OpOutcome => ({
    index,
    op: op.op,
    subjectType,
    subjectId,
    summary,
  });

  switch (op.op) {
    case "create_entity": {
      const spans = op.spans ? toEntitySpans(op.spans) : [];
      // `when` is the primary span; without one, take it from the spans.
      const when = op.when ? toFuzzyDate(op.when) : (primarySpan(op.kind, spans)?.when ?? null);
      const bounds = when ? dateBounds(when) : null;
      const values = {
        id: op.id!,
        // Non-Latin labels slugify to nothing; fall back to a short id-based slug.
        slug: op.slug ?? (slugify(op.label) || `${op.kind}-${op.id!.slice(-8)}`),
        kind: op.kind,
        label: op.label,
        aliases: op.aliases ?? [],
        description: op.description ?? null,
        when,
        bounds,
        sortStart: bounds?.startMin ?? null,
        sortEnd: bounds?.endMax ?? null,
        spans,
        geo: op.geo ?? null,
        wikidataId: op.wikidataId ?? null,
        externalIds: op.externalIds ?? {},
        searchText: entitySearchText(op.label, op.aliases, op.description),
      };
      await tx.insert(entities).values(values);
      const { searchText: _s, ...data } = values;
      await event(state, "entity.created", "entity", op.id!, data);
      return done("entity", op.id!, `entity ${values.slug}`);
    }

    case "update_entity": {
      const id = await resolveEntity(tx, op.entity);
      const prev = (await tx.query.entities.findFirst({ where: eq(entities.id, id) }))!;
      checkBase(state, index, op, prev.version, `entity ${prev.slug}`);
      const set = op.set;
      const next: Partial<typeof entities.$inferInsert> = {};
      if (set.slug !== undefined) next.slug = set.slug;
      if (set.kind !== undefined) next.kind = set.kind;
      if (set.label !== undefined) next.label = set.label;
      if (set.aliases !== undefined) next.aliases = set.aliases;
      if (set.description !== undefined) next.description = set.description;
      if (set.geo !== undefined) next.geo = set.geo;
      if (set.wikidataId !== undefined) next.wikidataId = set.wikidataId;
      if (set.externalIds !== undefined) next.externalIds = set.externalIds;
      if (set.spans !== undefined) next.spans = toEntitySpans(set.spans);
      const derived =
        set.when === undefined && !prev.when && next.spans?.length
          ? primarySpan(set.kind ?? prev.kind, next.spans)?.when
          : undefined;
      if (set.when !== undefined || derived) {
        const when = set.when !== undefined ? toFuzzyDate(set.when) : derived!;
        const bounds = dateBounds(when);
        Object.assign(next, { when, bounds, sortStart: bounds.startMin, sortEnd: bounds.endMax });
      }
      const diff = changedFields(prev as Record<string, unknown>, next as Record<string, unknown>);
      next.searchText = entitySearchText(
        next.label ?? prev.label,
        next.aliases ?? prev.aliases,
        next.description ?? prev.description,
      );
      await tx
        .update(entities)
        .set({ ...next, version: sql`${entities.version} + 1`, updatedAt: new Date() })
        .where(eq(entities.id, id));
      await event(state, "entity.updated", "entity", id, diff);
      return done(
        "entity",
        id,
        `update entity ${prev.slug}: ${Object.keys(diff.after).join(", ") || "no changes"}`,
      );
    }

    case "link_entities": {
      const fromId = await resolveEntity(tx, op.from);
      const toId = await resolveEntity(tx, op.to);
      if (fromId === toId) throw new ValidationError("an entity cannot link to itself");
      const values = {
        id: op.id!,
        fromId,
        toId,
        type: op.type,
        when: op.when ? toFuzzyDate(op.when) : null,
        note: op.note ?? null,
      };
      await tx.insert(entityLinks).values(values);
      await event(state, "entity_link.created", "entity_link", op.id!, values);
      return done("entity_link", op.id!, `${op.from} ${op.type} ${op.to}`);
    }

    case "create_source": {
      if (op.derivedFrom) await requireRow(tx, sources, op.derivedFrom, "source (derivedFrom)");
      const names = [
        ...(op.csl.author ?? []),
        ...(op.csl.editor ?? []),
        ...(op.csl.translator ?? []),
      ].map((n) => n.literal ?? `${n.given ?? ""} ${n.family ?? ""}`);
      const values = {
        id: op.id!,
        kind: op.kind,
        tier: op.tier,
        title: op.csl.title,
        csl: op.csl,
        identifiers: op.identifiers ?? {},
        license: op.license ?? { status: "unknown" as const },
        derivedFromId: op.derivedFrom ?? null,
        composed: op.composed ? toFuzzyDate(op.composed) : null,
        lenses: op.lenses ?? [],
        note: op.note ?? null,
        searchText: foldForSearch(op.csl.title, op.csl["container-title"], ...names),
      };
      await tx.insert(sources).values(values);
      const { searchText: _s, ...data } = values;
      await event(state, "source.created", "source", op.id!, data);
      return done("source", op.id!, `source “${op.csl.title}”`);
    }

    case "update_source": {
      await requireRow(tx, sources, op.source, "source");
      const prev = (await tx.query.sources.findFirst({ where: eq(sources.id, op.source) }))!;
      checkBase(state, index, op, prev.version, `source “${prev.title}”`);
      const set = op.set;
      if (set.derivedFrom === op.source)
        throw new ValidationError("a source cannot derive from itself");
      if (set.derivedFrom) {
        await requireRow(tx, sources, set.derivedFrom, "source (derivedFrom)");
        // Refuse cycles: walking up from the new parent must not reach this source.
        let cur: string | null = set.derivedFrom;
        for (let depth = 0; cur && depth < 32; depth++) {
          if (cur === op.source) throw new ValidationError("that would make the source derive from itself");
          const [up] = await tx.select({ p: sources.derivedFromId }).from(sources).where(eq(sources.id, cur));
          cur = up?.p ?? null;
        }
      }
      const next: Partial<typeof sources.$inferInsert> = {};
      if (set.kind !== undefined) next.kind = set.kind;
      if (set.tier !== undefined) next.tier = set.tier;
      if (set.csl !== undefined) {
        next.csl = set.csl;
        next.title = set.csl.title;
      }
      if (set.identifiers !== undefined) next.identifiers = set.identifiers;
      if (set.license !== undefined) next.license = set.license;
      if (set.derivedFrom !== undefined) next.derivedFromId = set.derivedFrom;
      if (set.composed !== undefined) next.composed = toFuzzyDate(set.composed);
      if (set.lenses !== undefined) next.lenses = set.lenses;
      if (set.note !== undefined) next.note = set.note;
      const diff = changedFields(prev as Record<string, unknown>, next as Record<string, unknown>);
      if (next.csl) {
        const people = [...(next.csl.author ?? []), ...(next.csl.editor ?? []), ...(next.csl.translator ?? [])].map(
          (n) => n.literal ?? `${n.given ?? ""} ${n.family ?? ""}`,
        );
        next.searchText = foldForSearch(next.csl.title, next.csl["container-title"], ...people);
      }
      await tx
        .update(sources)
        .set({ ...next, version: sql`${sources.version} + 1`, updatedAt: new Date() })
        .where(eq(sources.id, op.source));
      await event(state, "source.updated", "source", op.source, diff);
      return done(
        "source",
        op.source,
        `update source: ${Object.keys(diff.after).join(", ") || "no changes"}`,
      );
    }

    case "create_excerpt": {
      await requireRow(tx, sources, op.source, "source");
      const { verification, selector, check } = await verifyQuote(op.snapshotId, op.quote);
      const values = {
        id: op.id!,
        sourceId: op.source,
        snapshotId: op.snapshotId ?? null,
        quote: op.quote ?? null,
        locator: op.locator ?? null,
        selector,
        original: op.original ?? null,
        note: op.note ?? null,
        verification,
      };
      await tx.insert(excerpts).values(values);
      state.excerptChecks.push({ excerptId: op.id!, status: verification.status, ...check });
      await event(state, "excerpt.created", "excerpt", op.id!, {
        ...values,
        selector: selector?.position ?? null,
      });
      return done("excerpt", op.id!, `excerpt (${verification.status})`);
    }

    case "create_claim": {
      const when = op.when ? toFuzzyDate(op.when) : null;
      const values = {
        id: op.id!,
        text: op.text,
        kind: op.kind,
        assessment: op.assessment ?? "unassessed",
        assessmentNote: op.assessmentNote ?? null,
        when,
        sortStart: when ? dateBounds(when).startMin : null,
        themes: op.themes ?? [],
        lenses: op.lenses ?? [],
        foundVia: op.foundVia ?? [],
        learning: op.learning ?? null,
        searchText: foldForSearch(op.text),
      };
      await tx.insert(claims).values(values);
      const links = new Map<string, string>();
      for (const e of op.entities ?? []) links.set(await resolveEntity(tx, e.entity), e.role);
      if (links.size) {
        await tx
          .insert(claimEntities)
          .values([...links].map(([entityId, role]) => ({ claimId: op.id!, entityId, role })));
      }
      state.touchedClaims.add(op.id!);
      const { searchText: _s, ...data } = values;
      await event(state, "claim.created", "claim", op.id!, {
        ...data,
        entities: Object.fromEntries(links),
      });
      return done("claim", op.id!, `claim: ${op.text.slice(0, 80)}`);
    }

    case "update_claim": {
      await requireRow(tx, claims, op.claim, "claim");
      const prev = (await tx.query.claims.findFirst({ where: eq(claims.id, op.claim) }))!;
      checkBase(state, index, op, prev.version, "claim");
      const set = op.set;
      const next: Partial<typeof claims.$inferInsert> = {};
      if (set.text !== undefined) {
        next.text = set.text;
        next.searchText = foldForSearch(set.text);
      }
      if (set.kind !== undefined) next.kind = set.kind;
      if (set.assessment !== undefined) next.assessment = set.assessment;
      if (set.assessmentNote !== undefined) next.assessmentNote = set.assessmentNote;
      if (set.when !== undefined) {
        next.when = toFuzzyDate(set.when);
        next.sortStart = dateBounds(next.when).startMin;
      }
      if (set.themes !== undefined) next.themes = set.themes;
      if (set.lenses !== undefined) next.lenses = set.lenses;
      if (set.foundVia !== undefined) next.foundVia = set.foundVia;
      if (set.learning !== undefined) next.learning = set.learning;
      const { searchText: _s, ...comparable } = next;
      const diff = changedFields(
        prev as Record<string, unknown>,
        comparable as Record<string, unknown>,
      );
      await tx
        .update(claims)
        .set({ ...next, version: sql`${claims.version} + 1`, updatedAt: new Date() })
        .where(eq(claims.id, op.claim));
      if (set.entities !== undefined) {
        const links = new Map<string, string>();
        for (const e of set.entities) links.set(await resolveEntity(tx, e.entity), e.role);
        await tx.delete(claimEntities).where(eq(claimEntities.claimId, op.claim));
        if (links.size) {
          await tx
            .insert(claimEntities)
            .values([...links].map(([entityId, role]) => ({ claimId: op.claim, entityId, role })));
        }
        diff.after.entities = Object.fromEntries(links);
      }
      state.touchedClaims.add(op.claim);
      await event(state, "claim.updated", "claim", op.claim, diff);
      return done(
        "claim",
        op.claim,
        `update claim: ${Object.keys(diff.after).join(", ") || "no changes"}`,
      );
    }

    case "cite": {
      await requireRow(tx, claims, op.claim, "claim");
      await requireRow(tx, excerpts, op.excerpt, "excerpt");
      const values = {
        id: op.id!,
        claimId: op.claim,
        excerptId: op.excerpt,
        stance: op.stance,
        note: op.note ?? null,
      };
      await tx.insert(citations).values(values);
      state.touchedClaims.add(op.claim);
      await event(state, "citation.created", "citation", op.id!, values);
      return done("citation", op.id!, `cite (${op.stance})`);
    }

    case "uncite": {
      const row = await tx.query.citations.findFirst({ where: eq(citations.id, op.citation) });
      if (!row) throw new ValidationError(`citation ${op.citation} not found`);
      await tx.delete(citations).where(eq(citations.id, op.citation));
      state.touchedClaims.add(row.claimId);
      await event(state, "citation.deleted", "citation", op.citation, { before: row });
      return done("citation", op.citation, "remove citation");
    }

    case "delete_excerpt": {
      const row = await tx.query.excerpts.findFirst({ where: eq(excerpts.id, op.excerpt) });
      if (!row) throw new ValidationError(`excerpt ${op.excerpt} not found`);
      const [cite] = await tx
        .select({ id: citations.id })
        .from(citations)
        .where(eq(citations.excerptId, op.excerpt))
        .limit(1);
      if (cite) throw new ValidationError(`excerpt ${op.excerpt} is cited (citation ${cite.id}); only an uncited excerpt can be removed`);
      const shown = await tx
        .select({ slug: pages.slug })
        .from(pages)
        .where(sql`${pages.blocks}::text like ${`%${op.excerpt}%`}`);
      if (shown.length)
        throw new ValidationError(`excerpt ${op.excerpt} is shown on ${shown.map((p) => `/${p.slug}`).join(", ")}`);
      // Another proposal waiting for review may cite it or show it.
      const pending = await tx
        .select({ id: changesets.id })
        .from(changesets)
        .where(
          and(
            eq(changesets.status, "proposed"),
            ne(changesets.id, state.changesetId),
            sql`${changesets.ops}::text like ${`%${op.excerpt}%`}`,
          ),
        );
      if (pending.length)
        throw new ValidationError(`excerpt ${op.excerpt} is used by pending changeset ${pending.map((p) => p.id).join(", ")}`);
      await tx.delete(excerpts).where(eq(excerpts.id, op.excerpt));
      await event(state, "excerpt.deleted", "excerpt", op.excerpt, { before: row, reason: op.reason ?? null });
      return done("excerpt", op.excerpt, `remove uncited excerpt${op.reason ? ` (${op.reason})` : ""}`);
    }

    case "relate_claims": {
      if (op.from === op.to) throw new ValidationError("a claim cannot relate to itself");
      await requireRow(tx, claims, op.from, "claim (from)");
      await requireRow(tx, claims, op.to, "claim (to)");
      const values = {
        id: op.id!,
        fromId: op.from,
        toId: op.to,
        type: op.type,
        note: op.note ?? null,
      };
      await tx.insert(claimRelations).values(values);
      state.touchedClaims.add(op.from);
      state.touchedClaims.add(op.to);
      await event(state, "claim_relation.created", "claim_relation", op.id!, values);
      return done("claim_relation", op.id!, `claim ${op.type} claim`);
    }

    case "create_page": {
      await checkBlockRefs(tx, op.blocks, op.spec);
      const entityId = op.entity ? await resolveEntity(tx, op.entity) : null;
      const values = {
        id: op.id!,
        slug: op.slug,
        title: op.title,
        kind: op.kind,
        entityId,
        summary: op.summary ?? null,
        blocks: op.blocks,
        spec: op.spec ?? null,
        status: op.status ?? "draft",
        position: op.position ?? null,
        searchText: foldForSearch(op.title, op.summary),
      };
      await tx.insert(pages).values(values);
      await tx.insert(pageRevisions).values({
        id: uuidv7(),
        pageId: op.id!,
        version: 1,
        title: op.title,
        summary: op.summary ?? null,
        blocks: op.blocks,
        changesetId: state.changesetId,
      });
      await event(state, "page.created", "page", op.id!, {
        slug: op.slug,
        title: op.title,
        kind: op.kind,
        blocks: op.blocks.length,
      });
      return done("page", op.id!, `page /${op.slug} (${op.blocks.length} blocks)`);
    }

    case "update_page": {
      const prev = await resolvePage(tx, op.page);
      checkBase(state, index, op, prev.version, `page /${prev.slug}`);
      const set = op.set;
      if (set.blocks || set.spec) await checkBlockRefs(tx, set.blocks ?? [], set.spec);
      const next: Partial<typeof pages.$inferInsert> = {};
      if (set.slug !== undefined) next.slug = set.slug;
      if (set.title !== undefined) next.title = set.title;
      if (set.kind !== undefined) next.kind = set.kind;
      if (set.entity !== undefined) next.entityId = await resolveEntity(tx, set.entity);
      if (set.summary !== undefined) next.summary = set.summary;
      if (set.blocks !== undefined) next.blocks = set.blocks;
      if (set.spec !== undefined) next.spec = set.spec;
      if (set.status !== undefined) next.status = set.status;
      if (set.position !== undefined) next.position = set.position;
      const diff = changedFields(prev as Record<string, unknown>, next as Record<string, unknown>);
      if (diff.after.blocks) {
        diff.before.blocks = `${(prev.blocks ?? []).length} blocks (see page_revisions v${prev.version})`;
        diff.after.blocks = `${set.blocks!.length} blocks (v${prev.version + 1})`;
      }
      next.searchText = foldForSearch(next.title ?? prev.title, next.summary ?? prev.summary);
      await tx
        .update(pages)
        .set({ ...next, version: prev.version + 1, updatedAt: new Date() })
        .where(eq(pages.id, prev.id));
      await tx.insert(pageRevisions).values({
        id: uuidv7(),
        pageId: prev.id,
        version: prev.version + 1,
        title: next.title ?? prev.title,
        summary: next.summary ?? prev.summary,
        blocks: next.blocks ?? prev.blocks,
        changesetId: state.changesetId,
      });
      await event(state, "page.updated", "page", prev.id, diff);
      return done(
        "page",
        prev.id,
        `update page /${prev.slug}: ${Object.keys(diff.after).join(", ") || "no changes"}`,
      );
    }

    case "patch_page": {
      const prev = await resolvePage(tx, op.page);
      // Guarded per block and per spec key, not by the page version: other edits of the page do not make it stale.
      const stored = prev.spec ? PageSpecSchema.safeParse(prev.spec) : null;
      const spec = stored?.success ? stored.data : defaultPageSpec(prev.kind);
      const result = applyPagePatch({ blocks: prev.blocks, spec }, op);
      if (result.conflicts.length)
        throw new ValidationError(
          `page /${prev.slug}: ${result.conflicts.join("; ")}; propose the edit again against the page as it is now`,
        );
      if (!result.changed.length)
        return done("page", prev.id, `patch page /${prev.slug}: no changes (${result.unchanged.length} already done)`);
      // The whole resulting list is validated (unique ids, at most 400) and every reference checked, as for update_page.
      const blocks = result.blocksChanged ? Blocks.parse(result.blocks) : prev.blocks;
      const nextSpec = result.specChanged ? PageSpecSchema.parse(result.spec) : undefined;
      await checkBlockRefs(tx, blocks, nextSpec ?? spec);
      await tx
        .update(pages)
        .set({
          ...(result.blocksChanged ? { blocks } : {}),
          ...(nextSpec ? { spec: nextSpec } : {}),
          version: prev.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, prev.id));
      await tx.insert(pageRevisions).values({
        id: uuidv7(),
        pageId: prev.id,
        version: prev.version + 1,
        title: prev.title,
        summary: prev.summary,
        blocks,
        changesetId: state.changesetId,
      });
      await event(state, "page.updated", "page", prev.id, {
        patch: result.changed,
        alreadyDone: result.unchanged,
        before: {
          version: prev.version,
          blocks: `${prev.blocks.length} blocks (see page_revisions v${prev.version})`,
          ...(nextSpec ? { spec: prev.spec } : {}),
        },
        after: {
          version: prev.version + 1,
          blocks: `${blocks.length} blocks (v${prev.version + 1})`,
          ...(nextSpec ? { spec: nextSpec } : {}),
        },
      });
      return done("page", prev.id, `patch page /${prev.slug}: ${result.changed.join(", ")}`);
    }

    case "create_extent":
    case "update_extent":
      return applyExtentOp(state, op, index, done);

    case "create_media":
    case "update_media":
      return applyMediaOp(state, op, index, done);
  }
}

type MediaOp = Extract<StoredOp, { op: "create_media" | "update_media" }>;

/**
 * The file fields must match the stored API response: a licence, author or URL
 * cannot be typed in by hand. A credit line must name the author when the
 * licence requires attribution.
 */
async function checkMediaFile(
  fields: Partial<Extract<MediaOp, { op: "create_media" }>>,
  snapshotId: string,
  fileTitle: string,
) {
  const file = await fileFromSnapshot(snapshotId);
  const problems = compareWithFile({ ...fields, fileTitle }, file);
  if (problems.length) throw new ValidationError(`media does not match its Commons snapshot: ${problems.join("; ")}`);
  if (file.license.ok && file.license.license.attributionRequired) {
    if (file.artist && fields.artist === undefined)
      throw new ValidationError(`the licence requires attribution: give artist (${JSON.stringify(file.artist)})`);
    const credit = fields.attribution ?? "";
    if (!credit.includes(file.license.license.shortName))
      throw new ValidationError(`attribution must name the licence (${file.license.license.shortName})`);
    if (!isUnknownArtist(file.artist) && !credit.includes(file.artist!.slice(0, 40)))
      throw new ValidationError(`attribution must name the author (${file.artist})`);
  }
}

async function resolveDepicts(tx: Tx, refs: string[] | undefined): Promise<string[]> {
  const ids: string[] = [];
  for (const ref of refs ?? []) {
    const id = await resolveEntity(tx, ref);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function applyMediaOp(
  state: ApplyState,
  op: MediaOp,
  index: number,
  done: (subjectType: string, subjectId: string, summary: string) => OpOutcome,
): Promise<OpOutcome> {
  const { tx } = state;
  if (op.op === "create_media") {
    await checkMediaFile(op, op.snapshotId, op.fileTitle);
    const values = {
      id: op.id!,
      kind: op.kind,
      repository: op.repository,
      fileTitle: op.fileTitle,
      pageUrl: op.pageUrl,
      originalUrl: op.originalUrl,
      width: op.width,
      height: op.height,
      mime: op.mime,
      sha1: op.sha1 ?? null,
      license: op.license,
      artist: op.artist ?? null,
      credit: op.credit ?? null,
      attribution: op.attribution,
      title: op.title,
      alt: op.alt,
      description: op.description ?? null,
      representation: op.representation,
      representationNote: op.representationNote ?? null,
      objectDate: op.objectDate ? toFuzzyDate(op.objectDate) : null,
      imageDate: op.imageDate ? toFuzzyDate(op.imageDate) : null,
      depicts: await resolveDepicts(tx, op.depicts),
      focus: op.focus ?? null,
      snapshotId: op.snapshotId,
      retrievedAt: new Date(op.retrievedAt),
      searchText: foldForSearch(op.title, op.alt, op.description, op.artist, op.fileTitle),
    };
    await tx.insert(media).values(values);
    const { searchText: _s, ...data } = values;
    await event(state, "media.created", "media", op.id!, data);
    return done("media", op.id!, `media “${op.title}” (${op.license.shortName})`);
  }
  const prev = await tx.query.media.findFirst({ where: eq(media.id, op.media) });
  if (!prev) throw new ValidationError(`media ${op.media} not found`);
  checkBase(state, index, op, prev.version, `media “${prev.title}”`);
  const set = op.set;
  const fileFields = ["pageUrl", "originalUrl", "width", "height", "mime", "sha1", "license", "artist", "credit", "attribution", "snapshotId"] as const;
  if (fileFields.some((k) => set[k] !== undefined)) {
    // Check the edited record as a whole against the (new or current) snapshot.
    await checkMediaFile(
      {
        pageUrl: set.pageUrl ?? prev.pageUrl,
        originalUrl: set.originalUrl ?? prev.originalUrl,
        width: set.width ?? prev.width,
        height: set.height ?? prev.height,
        mime: set.mime ?? prev.mime,
        sha1: set.sha1 ?? prev.sha1 ?? undefined,
        license: set.license ?? prev.license,
        artist: set.artist ?? prev.artist ?? undefined,
        credit: set.credit ?? prev.credit ?? undefined,
        attribution: set.attribution ?? prev.attribution,
      },
      set.snapshotId ?? prev.snapshotId,
      prev.fileTitle,
    );
  }
  const next: Partial<typeof media.$inferInsert> = {};
  for (const k of ["pageUrl", "originalUrl", "width", "height", "mime", "license", "attribution", "title", "alt", "representation", "snapshotId"] as const) {
    if (set[k] !== undefined) (next as Record<string, unknown>)[k] = set[k];
  }
  for (const k of ["sha1", "artist", "credit", "description", "representationNote"] as const) {
    if (set[k] !== undefined) next[k] = set[k];
  }
  if (set.focus !== undefined) next.focus = set.focus;
  if (set.objectDate !== undefined) next.objectDate = toFuzzyDate(set.objectDate);
  if (set.imageDate !== undefined) next.imageDate = toFuzzyDate(set.imageDate);
  if (set.depicts !== undefined) next.depicts = await resolveDepicts(tx, set.depicts);
  if (set.retrievedAt !== undefined) next.retrievedAt = new Date(set.retrievedAt);
  const diff = changedFields(prev as Record<string, unknown>, next as Record<string, unknown>);
  next.searchText = foldForSearch(
    next.title ?? prev.title,
    next.alt ?? prev.alt,
    next.description ?? prev.description,
    next.artist ?? prev.artist,
    prev.fileTitle,
  );
  await tx
    .update(media)
    .set({ ...next, version: sql`${media.version} + 1`, updatedAt: new Date() })
    .where(eq(media.id, prev.id));
  await event(state, "media.updated", "media", prev.id, diff);
  return done("media", prev.id, `update media “${prev.title}”: ${Object.keys(diff.after).join(", ") || "no changes"}`);
}

function extentGeometry(geometry: unknown) {
  const parsed = MultiPolygonGeometry.parse(geometry);
  const box = bboxOf(parsed.coordinates);
  if (!box) throw new ValidationError("extent geometry is empty");
  return { geometry: parsed, minLon: box[0], minLat: box[1], maxLon: box[2], maxLat: box[3] };
}

async function applyExtentOp(
  state: ApplyState,
  op: Extract<StoredOp, { op: "create_extent" | "update_extent" }>,
  index: number,
  done: (subjectType: string, subjectId: string, summary: string) => OpOutcome,
): Promise<OpOutcome> {
  const { tx } = state;
  if (op.op === "create_extent") {
    const entityId = op.entity ? await resolveEntity(tx, op.entity) : null;
    if (op.source) await requireRow(tx, sources, op.source, "source");
    const values = {
      id: op.id!,
      entityId,
      name: op.name,
      fromYear: op.fromYear,
      toYear: op.toYear,
      ...extentGeometry(op.geometry),
      areaKm2: op.areaKm2 ?? null,
      dataset: op.dataset,
      datasetRef: op.datasetRef ?? null,
      certainty: op.certainty ?? "reconstruction",
      license: op.license,
      attribution: op.attribution,
      sourceId: op.source ?? null,
      note: op.note ?? null,
    };
    await tx.insert(extents).values(values);
    const { geometry, ...data } = values;
    await event(state, "extent.created", "extent", op.id!, {
      ...data,
      polygons: geometry.coordinates.length,
    });
    return done("extent", op.id!, `extent ${op.name} ${op.fromYear}..${op.toYear}`);
  }
  const prev = await tx.query.extents.findFirst({ where: eq(extents.id, op.extent) });
  if (!prev) throw new ValidationError(`extent ${op.extent} not found`);
  checkBase(state, index, op, prev.version, `extent ${prev.name}`);
  const set = op.set;
  const next: Partial<typeof extents.$inferInsert> = {};
  if (set.entity !== undefined)
    next.entityId = set.entity === null ? null : await resolveEntity(tx, set.entity);
  if (set.name !== undefined) next.name = set.name;
  if (set.fromYear !== undefined) next.fromYear = set.fromYear;
  if (set.toYear !== undefined) next.toYear = set.toYear;
  if (set.geometry !== undefined) Object.assign(next, extentGeometry(set.geometry));
  if (set.areaKm2 !== undefined) next.areaKm2 = set.areaKm2;
  if (set.dataset !== undefined) next.dataset = set.dataset;
  if (set.datasetRef !== undefined) next.datasetRef = set.datasetRef;
  if (set.certainty !== undefined) next.certainty = set.certainty;
  if (set.license !== undefined) next.license = set.license;
  if (set.attribution !== undefined) next.attribution = set.attribution;
  if (set.source !== undefined) {
    await requireRow(tx, sources, set.source, "source");
    next.sourceId = set.source;
  }
  if (set.note !== undefined) next.note = set.note;
  if ((next.fromYear ?? prev.fromYear) > (next.toYear ?? prev.toYear))
    throw new ValidationError("fromYear must not be after toYear");
  const diff = changedFields(prev as Record<string, unknown>, next as Record<string, unknown>);
  if (diff.after.geometry) {
    diff.before.geometry = `${prev.geometry.coordinates.length} polygons`;
    diff.after.geometry = `${next.geometry!.coordinates.length} polygons`;
  }
  await tx
    .update(extents)
    .set({ ...next, version: sql`${extents.version} + 1`, updatedAt: new Date() })
    .where(eq(extents.id, prev.id));
  await event(state, "extent.updated", "extent", prev.id, diff);
  return done(
    "extent",
    prev.id,
    `update extent ${prev.name}: ${Object.keys(diff.after).join(", ") || "no changes"}`,
  );
}

export async function applyOps(state: ApplyState, ops: StoredOp[]): Promise<void> {
  for (const [index, op] of ops.entries()) {
    try {
      // Savepoint per op, so a database error reports the op that caused it.
      state.outcomes.push(
        await state.tx.transaction(async (sp) => applyOne({ ...state, tx: sp as Tx }, op, index)),
      );
    } catch (error) {
      if (error instanceof OpError) throw error;
      throw new OpError(
        index,
        op.op,
        error instanceof ValidationError ? error.message : friendlyDbError(error),
      );
    }
  }
}
