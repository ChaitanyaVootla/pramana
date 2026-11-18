import {
  DEFAULT_TIMELINE_ROLES,
  effectiveSpans,
  timelineSpan,
  type EntitySpan,
  type SpanRole,
  type TimelineRoles,
  claimIdsInBlock,
  claimIdsInSpec,
  defaultPageSpec,
  entityRefsInSpec,
  PageSpec,
  entityRefsInBlock,
  markdownInBlock,
  mediaRefsInBlock,
  mediaRefsInSpec,
  dateBounds,
  extractLinks,
  formatFuzzyDate,
  formatLocator,
  fullCitation,
  isUuid,
  shortCitation,
  VERIFICATION_LABELS,
  type Alias,
  type Block,
  type CslItem,
  type DateBounds,
  type Discovery,
  type ExcerptVerification,
  type FuzzyDate,
  type GeoInfo,
  type LearningPrompt,
  type License,
  type LintIssue,
  type Locator,
  type OriginalText,
  type SourceIdentifiers,
  supportCheckState,
  type VerificationLevel,
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
  getDb,
  pages,
  snapshots,
  sources,
  type DbOrTx,
} from "@pramana/db";
import { and, asc, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import { versionedCache } from "./cache";
import { listEvents, type AuditEntry } from "./audit";
import {
  citationBasis,
  evidenceFor,
  type JointSupportView,
  type SupportCheckView,
} from "./evidence";
import { extentsForEntities, type ExtentFeature, type PlaceTime } from "./extents";
import { entityImages, loadMediaCards, type EntityImage, type MediaCard } from "./media";
import { namedMatch, prominenceOf, rankByName } from "./search-rank";
import { looseKey, NotFoundError, toPrefixQuery } from "./util";

// ---------------------------------------------------------------------------
// View types (serialisable; shared by the web UI and MCP tools)
// ---------------------------------------------------------------------------

/** A labelled span ready to draw. `implicit`: not stored, inferred from `when` and the kind. */
export interface EntitySpanView extends EntitySpan {
  label: string;
  bounds: DateBounds;
  implicit?: true;
}

export function toSpanViews(entity: {
  kind: string;
  when: FuzzyDate | null;
  spans?: EntitySpan[] | null;
}): EntitySpanView[] {
  return effectiveSpans({ kind: entity.kind, when: entity.when, spans: entity.spans ?? [] }).map(
    (s) => ({ ...s, label: formatFuzzyDate(s.when), bounds: dateBounds(s.when) }),
  );
}

export interface EntityCard {
  id: string;
  slug: string;
  kind: string;
  label: string;
  aliases: Alias[];
  description: string | null;
  when: FuzzyDate | null;
  whenLabel: string | null;
  bounds: DateBounds | null;
  geo: GeoInfo | null;
  wikidataId: string | null;
  pageSlug: string | null;
  /** Labelled spans (reign, life, existence...); `when` is the primary one. */
  spans?: EntitySpanView[];
  /** The best picture depicting this entity (evidence before imaginings), when there is one. */
  image?: EntityImage;
}

export interface SourceCard {
  id: string;
  kind: string;
  tier: string;
  title: string;
  short: string;
  full: string;
  csl: CslItem;
  license: License;
  identifiers: SourceIdentifiers;
  url: string | null;
  derivedFromId: string | null;
  composedLabel: string | null;
  /** When the work was composed (bounds of `composed`), for placing it against the events it tells of. */
  composedBounds: DateBounds | null;
}

export interface ExcerptCard {
  id: string;
  quote: string | null;
  locator: Locator | null;
  locatorLabel: string;
  original: OriginalText | null;
  note: string | null;
  verification: ExcerptVerification;
  snapshotId: string | null;
  position: { start: number; end: number } | null;
  source: SourceCard;
}

export interface CitationCard {
  id: string;
  stance: string;
  note: string | null;
  /** With whether the judgment still applies to the claim, quote and stance as they are now. */
  supportCheck: SupportCheckView;
  excerpt: ExcerptCard;
}

export interface ClaimCard {
  id: string;
  text: string;
  kind: string;
  assessment: string;
  assessmentNote: string | null;
  when: FuzzyDate | null;
  whenLabel: string | null;
  themes: string[];
  lenses: string[];
  learning: LearningPrompt | null;
  foundVia: Discovery[];
  level: VerificationLevel;
  levelLabel: string;
  issues: LintIssue[];
  citations: CitationCard[];
  /** A judgment on the citations read together, with whether it still applies. */
  jointSupport: JointSupportView | null;
  entities: { id: string; slug: string; label: string; role: string }[];
  version: number;
  updatedAt: Date;
}

export interface TimelineItem {
  id: string;
  type: "entity" | "claim";
  slug: string | null;
  label: string;
  kind: string;
  whenLabel: string;
  bounds: DateBounds;
  /** Which span is drawn: "reign", "life"…; null when it is the primary date of unknown role. */
  role?: SpanRole | null;
  /** All of the entity's spans, for tooltips or extra lanes. */
  spans?: EntitySpanView[];
}

/** One lane of a layered timeline: every entity's span of one role. */
export interface TimelineLayer {
  role: SpanRole;
  items: TimelineItem[];
}

export interface MapFeature {
  id: string;
  slug: string;
  label: string;
  kind: string;
  whenLabel: string | null;
  /** Its date, for saying what the date is of ("founded c. 490 BCE (traditional)"). */
  when?: FuzzyDate | null;
  geo: GeoInfo;
  /** When it belongs on a map of a given year (see placeTimes); maps without a year ignore it. */
  time?: PlaceTime;
}

export type VizData =
  | { kind: "timeline"; items: TimelineItem[] }
  | {
      kind: "map";
      features: MapFeature[];
      /** Historical extents of the entities on the map (borders), oldest first. */
      extents?: ExtentFeature[];
    };

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

function sourceUrl(identifiers: SourceIdentifiers, csl: CslItem): string | null {
  if (identifiers.doi) return `https://doi.org/${identifiers.doi}`;
  if (identifiers.ia) return `https://archive.org/details/${identifiers.ia}`;
  return identifiers.url ?? csl.URL ?? null;
}

export function toSourceCard(row: typeof sources.$inferSelect): SourceCard {
  return {
    id: row.id,
    kind: row.kind,
    tier: row.tier,
    title: row.title,
    short: shortCitation(row.csl),
    full: fullCitation(row.csl),
    csl: row.csl,
    license: row.license,
    identifiers: row.identifiers,
    url: sourceUrl(row.identifiers, row.csl),
    derivedFromId: row.derivedFromId,
    composedLabel: row.composed ? formatFuzzyDate(row.composed) : null,
    composedBounds: row.composed ? dateBounds(row.composed) : null,
  };
}

function toEntityCard(row: typeof entities.$inferSelect, pageSlug: string | null): EntityCard {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    label: row.label,
    aliases: row.aliases,
    description: row.description,
    when: row.when,
    whenLabel: row.when ? formatFuzzyDate(row.when) : null,
    bounds: row.bounds,
    geo: row.geo,
    wikidataId: row.wikidataId,
    pageSlug,
    spans: toSpanViews(row),
  };
}

async function pageSlugsForEntities(db: DbOrTx, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ entityId: pages.entityId, slug: pages.slug })
    .from(pages)
    // Only published pages: an entity links to a draft nowhere a reader can see.
    .where(and(inArray(pages.entityId, ids), eq(pages.status, "published")));
  return new Map(rows.filter((r) => r.entityId).map((r) => [r.entityId!, r.slug]));
}

export async function loadEntityCards(
  db: DbOrTx,
  refs: string[],
): Promise<Map<string, EntityCard>> {
  const ids = refs.filter(isUuid);
  const slugs = refs.filter((r) => !isUuid(r));
  if (!ids.length && !slugs.length) return new Map();
  const conditions = [];
  if (ids.length) conditions.push(inArray(entities.id, ids));
  if (slugs.length) conditions.push(inArray(entities.slug, slugs));
  const rows = await db
    .select()
    .from(entities)
    .where(or(...conditions));
  const [pageSlugs, images] = await Promise.all([
    pageSlugsForEntities(
      db,
      rows.map((r) => r.id),
    ),
    entityImages(
      db,
      rows.map((r) => r.id),
    ),
  ]);
  const out = new Map<string, EntityCard>();
  for (const row of rows) {
    const card = toEntityCard(row, pageSlugs.get(row.id) ?? null);
    const image = images.get(row.id);
    if (image) card.image = image;
    out.set(row.id, card);
    out.set(row.slug, card);
  }
  return out;
}

export async function loadExcerptCards(
  db: DbOrTx,
  ids: string[],
): Promise<Map<string, ExcerptCard>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({ excerpt: excerpts, source: sources })
    .from(excerpts)
    .innerJoin(sources, eq(sources.id, excerpts.sourceId))
    .where(inArray(excerpts.id, [...new Set(ids)]));
  return new Map(
    rows.map(({ excerpt: e, source }) => [
      e.id,
      {
        id: e.id,
        quote: e.quote,
        locator: e.locator,
        locatorLabel: formatLocator(e.locator),
        original: e.original,
        note: e.note,
        verification: e.verification,
        snapshotId: e.snapshotId,
        position: e.selector
          ? { start: e.selector.position.start, end: e.selector.position.end }
          : null,
        source: toSourceCard(source),
      },
    ]),
  );
}

export async function loadClaimCards(
  db: DbOrTx,
  claimIds: string[],
): Promise<Map<string, ClaimCard>> {
  const ids = [...new Set(claimIds.filter(isUuid))];
  if (!ids.length) return new Map();
  const [claimRows, citationRows, entityRows, evidence] = await Promise.all([
    db.select().from(claims).where(inArray(claims.id, ids)),
    db.select().from(citations).where(inArray(citations.claimId, ids)).orderBy(asc(citations.id)),
    db
      .select({
        claimId: claimEntities.claimId,
        role: claimEntities.role,
        id: entities.id,
        slug: entities.slug,
        label: entities.label,
      })
      .from(claimEntities)
      .innerJoin(entities, eq(entities.id, claimEntities.entityId))
      .where(inArray(claimEntities.claimId, ids)),
    evidenceFor(db, ids),
  ]);
  const excerptCards = await loadExcerptCards(
    db,
    citationRows.map((c) => c.excerptId),
  );
  const out = new Map<string, ClaimCard>();
  for (const c of claimRows) {
    const ev = evidence.get(c.id);
    const level = ev?.level ?? 0;
    out.set(c.id, {
      id: c.id,
      text: c.text,
      kind: c.kind,
      assessment: c.assessment,
      assessmentNote: c.assessmentNote,
      when: c.when,
      whenLabel: c.when ? formatFuzzyDate(c.when) : null,
      themes: c.themes,
      lenses: c.lenses,
      learning: c.learning,
      foundVia: c.foundVia,
      level,
      levelLabel: VERIFICATION_LABELS[level],
      issues: ev?.issues ?? [],
      jointSupport: ev?.jointSupport ?? null,
      citations: citationRows
        .filter((r) => r.claimId === c.id && excerptCards.has(r.excerptId))
        .map((r) => ({
          id: r.id,
          stance: r.stance,
          note: r.note,
          supportCheck: {
            ...r.supportCheck,
            state: supportCheckState(
              r.supportCheck,
              citationBasis(c.text, r.excerptId, excerptCards.get(r.excerptId)!.quote, r.stance),
            ),
          },
          excerpt: excerptCards.get(r.excerptId)!,
        })),
      entities: entityRows
        .filter((e) => e.claimId === c.id)
        .map(({ id, slug, label, role }) => ({ id, slug, label, role })),
      version: c.version,
      updatedAt: c.updatedAt,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Timelines and maps
// ---------------------------------------------------------------------------

export interface TimelineQuery {
  entityIds?: string[];
  claimIds?: string[];
  linkedTo?: string;
  kinds?: string[];
  /**
   * Which span to draw per kind, most preferred first, e.g. { person: ["life"] }.
   * Default: persons by reign where recorded; everything else by `when`.
   * Entities with no matching span fall back to `when`.
   */
  roles?: TimelineRoles;
}

/** A timeline item for an entity, drawing the span chosen by `roles`. */
function entityTimelineItem(
  card: Pick<
    EntityCard,
    "id" | "slug" | "label" | "kind" | "when" | "bounds" | "whenLabel" | "spans"
  >,
  roles: TimelineRoles,
): TimelineItem | null {
  const stored = (card.spans ?? []).filter((s) => !s.implicit);
  const pick = timelineSpan({ kind: card.kind, when: card.when, spans: stored }, roles);
  if (!pick) return null;
  const isWhen = card.when && pick.when.edtf === card.when.edtf;
  const bounds = isWhen && card.bounds ? card.bounds : dateBounds(pick.when);
  return {
    id: card.id,
    type: "entity",
    slug: card.slug,
    label: card.label,
    kind: card.kind,
    whenLabel: isWhen && card.whenLabel ? card.whenLabel : formatFuzzyDate(pick.when),
    bounds,
    role: pick.role,
    spans: card.spans ?? [],
  };
}

async function timelineEntityIds(db: DbOrTx, query: TimelineQuery): Promise<Set<string>> {
  const entityIds = new Set(query.entityIds ?? []);
  if (query.linkedTo) {
    const anchor = (await loadEntityCards(db, [query.linkedTo])).get(query.linkedTo);
    if (anchor) {
      entityIds.add(anchor.id);
      const links = await db
        .select({ fromId: entityLinks.fromId })
        .from(entityLinks)
        .where(eq(entityLinks.toId, anchor.id));
      links.forEach((l) => entityIds.add(l.fromId));
      const viaClaims = await db
        .select({ entityId: claimEntities.entityId })
        .from(claimEntities)
        .where(
          inArray(
            claimEntities.claimId,
            db
              .select({ id: claimEntities.claimId })
              .from(claimEntities)
              .where(eq(claimEntities.entityId, anchor.id)),
          ),
        );
      viaClaims.forEach((c) => entityIds.add(c.entityId));
    }
  }
  return entityIds;
}

/**
 * A layered timeline: one lane per role (reign, life, existence…), each with
 * every entity's span of that role. Entities can appear in several lanes.
 * Without a query, uses all entities (optionally filtered by kind).
 */
export async function timelineLayers(
  db: DbOrTx,
  query: Omit<TimelineQuery, "roles" | "claimIds"> & { roles?: SpanRole[] } = {},
): Promise<TimelineLayer[]> {
  const scoped = Boolean(query.linkedTo || query.entityIds?.length);
  const rows = scoped
    ? [
        ...(
          await loadEntityCards(db, [
            ...(await timelineEntityIds(db, { ...query, roles: undefined })),
          ])
        ).values(),
      ]
    : (await db.select().from(entities)).map((r) => toEntityCard(r, null));
  const byRole = new Map<SpanRole, Map<string, TimelineItem>>();
  for (const card of rows) {
    if (query.kinds?.length && !query.kinds.includes(card.kind)) continue;
    for (const span of card.spans ?? []) {
      if (query.roles?.length && !query.roles.includes(span.role)) continue;
      const lane = byRole.get(span.role) ?? new Map<string, TimelineItem>();
      byRole.set(span.role, lane);
      const prev = lane.get(card.id);
      // One item per entity per lane: the earliest span of that role.
      if (prev && (prev.bounds.startMin ?? 1e9) <= (span.bounds.startMin ?? 1e9)) continue;
      lane.set(card.id, {
        id: card.id,
        type: "entity",
        slug: card.slug,
        label: card.label,
        kind: card.kind,
        whenLabel: span.label,
        bounds: span.bounds,
        role: span.role,
        spans: card.spans ?? [],
      });
    }
  }
  const order = query.roles?.length
    ? query.roles
    : (["existence", "reign", "life", "floruit", "activity", "construction"] as SpanRole[]);
  return order
    .filter((role) => byRole.has(role))
    .map((role) => ({
      role,
      items: [...byRole.get(role)!.values()].sort(
        (a, b) => (a.bounds.startMin ?? -1e9) - (b.bounds.startMin ?? -1e9),
      ),
    }));
}

export async function timelineItems(db: DbOrTx, query: TimelineQuery): Promise<TimelineItem[]> {
  const entityIds = await timelineEntityIds(db, query);
  const roles = query.roles ?? DEFAULT_TIMELINE_ROLES;
  const items: TimelineItem[] = [];
  const cards = await loadEntityCards(db, [...entityIds]);
  const seen = new Set<string>();
  for (const card of cards.values()) {
    if (seen.has(card.id)) continue;
    if (query.kinds?.length && !query.kinds.includes(card.kind)) continue;
    const item = entityTimelineItem(card, roles);
    if (!item) continue;
    seen.add(card.id);
    items.push(item);
  }
  if (query.claimIds?.length) {
    const claimCards = await loadClaimCards(db, query.claimIds);
    for (const c of claimCards.values()) {
      if (!c.when || !c.whenLabel) continue;
      items.push({
        id: c.id,
        type: "claim",
        slug: null,
        label: c.text,
        kind: c.kind,
        whenLabel: c.whenLabel,
        bounds: dateBounds(c.when),
      });
    }
  }
  return items.sort((a, b) => (a.bounds.startMin ?? -1e9) - (b.bounds.startMin ?? -1e9));
}

export async function mapFeatures(
  db: DbOrTx,
  query: { entityIds?: string[]; linkedTo?: string },
): Promise<MapFeature[]> {
  const ids = new Set(query.entityIds ?? []);
  if (query.linkedTo) {
    for (const item of await timelineItems(db, { linkedTo: query.linkedTo })) ids.add(item.id);
    const anchor = (await loadEntityCards(db, [query.linkedTo])).get(query.linkedTo);
    if (anchor) {
      ids.add(anchor.id);
      const links = await db
        .select({ fromId: entityLinks.fromId })
        .from(entityLinks)
        .where(eq(entityLinks.toId, anchor.id));
      links.forEach((l) => ids.add(l.fromId));
    }
  }
  const cards = await loadEntityCards(db, [...ids]);
  const seen = new Set<string>();
  const out: MapFeature[] = [];
  for (const c of cards.values()) {
    if (seen.has(c.id) || !c.geo) continue;
    seen.add(c.id);
    out.push({
      id: c.id,
      slug: c.slug,
      label: c.label,
      kind: c.kind,
      whenLabel: c.whenLabel,
      when: c.when,
      geo: c.geo,
    });
  }
  return out;
}

export interface MapLayers {
  features: MapFeature[];
  /** Historical extents of the map's polities (the anchor, listed entities and polities linked to the anchor), oldest first. */
  extents: ExtentFeature[];
}

/**
 * Map data with borders: the point/area features of `mapFeatures`, plus the
 * extents (all time slices) of the anchor entity, the listed entities, and
 * polities linked to the anchor. Pick a slice by year in the UI.
 */
export async function mapLayers(
  db: DbOrTx,
  query: { entityIds?: string[]; linkedTo?: string; extents?: boolean },
): Promise<MapLayers> {
  const features = await mapFeatures(db, query);
  if (query.extents === false) return { features, extents: [] };
  const refs = [...(query.entityIds ?? []), ...(query.linkedTo ? [query.linkedTo] : [])];
  const cards = await loadEntityCards(db, refs);
  const ids = new Set([...cards.values()].map((c) => c.id));
  const anchor = query.linkedTo ? cards.get(query.linkedTo) : undefined;
  if (anchor) {
    const linked = await db
      .select({ id: entities.id })
      .from(entityLinks)
      .innerJoin(
        entities,
        or(eq(entities.id, entityLinks.fromId), eq(entities.id, entityLinks.toId)),
      )
      .where(
        and(
          or(eq(entityLinks.toId, anchor.id), eq(entityLinks.fromId, anchor.id)),
          eq(entities.kind, "polity"),
        ),
      );
    linked.forEach((l) => ids.add(l.id));
  }
  return { features, extents: await extentsForEntities(db, [...ids]) };
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface PageSummary {
  id: string;
  slug: string;
  title: string;
  kind: string;
  summary: string | null;
  status: string;
  position: number | null;
  entity: EntityCard | null;
  version: number;
  updatedAt: Date;
}

export interface PageView {
  /** `spec` is the stored spec with defaults filled in, or the default for the page's kind. */
  page: PageSummary & { blocks: Block[]; spec: PageSpec; hasSpec: boolean };
  claims: Record<string, ClaimCard>;
  entities: Record<string, EntityCard>;
  excerpts: Record<string, ExcerptCard>;
  /** Media shown by figure and gallery blocks and the hero, by id. */
  media: Record<string, MediaCard>;
  viz: Record<string, VizData>;
  stats: { claims: number; byLevel: Record<VerificationLevel, number>; pendingChangesets: number };
}

async function findPage(db: DbOrTx, ref: string) {
  const row = isUuid(ref)
    ? await db.query.pages.findFirst({ where: eq(pages.id, ref) })
    : await db.query.pages.findFirst({ where: eq(pages.slug, ref) });
  if (!row) throw new NotFoundError(`page "${ref}" not found`);
  return row;
}

/** A page with everything it shows; cached until content changes (see cache.ts). */
export const getPageView: (ref: string) => Promise<PageView> = versionedCache((ref: string) => ref, loadPageView);

async function loadPageView(ref: string): Promise<PageView> {
  const db = getDb();
  const row = await findPage(db, ref);
  const blocks = row.blocks;
  const claimIds = new Set<string>();
  const entityRefs = new Set<string>();
  const excerptIds = new Set<string>();
  if (row.entityId) entityRefs.add(row.entityId);
  const stored = row.spec ? PageSpec.safeParse(row.spec) : null;
  const spec = stored?.success ? stored.data : defaultPageSpec(row.kind);
  entityRefsInSpec(spec).forEach((ref) => entityRefs.add(ref));
  claimIdsInSpec(spec).forEach((id) => claimIds.add(id));
  const mediaIds = new Set<string>(mediaRefsInSpec(spec));
  for (const b of blocks) {
    claimIdsInBlock(b).forEach((id) => claimIds.add(id));
    entityRefsInBlock(b).forEach((ref) => entityRefs.add(ref));
    mediaRefsInBlock(b).forEach((id) => mediaIds.add(id));
    if (b.type === "quote") excerptIds.add(b.excerptId);
    for (const md of markdownInBlock(b)) {
      for (const l of extractLinks(md)) {
        if (l.scheme === "entity") entityRefs.add(l.target);
        if (l.scheme === "excerpt") excerptIds.add(l.target);
      }
    }
  }
  const [claimCards, entityCards, excerptCards, mediaCards] = await Promise.all([
    loadClaimCards(db, [...claimIds]),
    loadEntityCards(db, [...entityRefs]),
    loadExcerptCards(db, [...excerptIds]),
    loadMediaCards(db, [...mediaIds]),
  ]);
  for (const c of claimCards.values()) for (const e of c.entities) entityRefs.add(e.id);

  const viz: Record<string, VizData> = {};
  for (const b of blocks) {
    if (b.type !== "viz") continue;
    if (b.viz.kind === "timeline") {
      viz[b.id] = {
        kind: "timeline",
        items: await timelineItems(db, {
          entityIds: b.viz.entityIds,
          claimIds: b.viz.claimIds,
          linkedTo: b.viz.linkedTo,
        }),
      };
    } else if (b.viz.kind === "map") {
      const layers = await mapLayers(db, { entityIds: b.viz.entityIds, linkedTo: b.viz.linkedTo });
      viz[b.id] = { kind: "map", features: layers.features, extents: layers.extents };
    }
  }

  const byLevel = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } as Record<VerificationLevel, number>;
  for (const c of claimCards.values()) byLevel[c.level]++;
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(changesets)
    .where(
      and(eq(changesets.status, "proposed"), sql`${changesets.ops}::text like ${`%${row.id}%`}`),
    );

  const pageEntity = row.entityId ? (entityCards.get(row.entityId) ?? null) : null;
  return {
    page: { ...pageSummary(row, pageEntity), blocks, spec, hasSpec: Boolean(stored?.success) },
    claims: Object.fromEntries(claimCards),
    entities: Object.fromEntries(entityCards),
    excerpts: Object.fromEntries(excerptCards),
    media: Object.fromEntries(mediaCards),
    viz,
    stats: { claims: claimCards.size, byLevel, pendingChangesets: pending?.n ?? 0 },
  };
}

function pageSummary(row: typeof pages.$inferSelect, entity: EntityCard | null): PageSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    kind: row.kind,
    summary: row.summary,
    status: row.status,
    position: row.position,
    entity,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

/**
 * Pages in reading order. Drafts are left out unless asked for: they are
 * work in progress for the editors and reviewers (MCP, /review), not for readers.
 */
export async function listPages(
  filter: { kind?: string; includeDrafts?: boolean } = {},
): Promise<PageSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(pages)
    .where(
      and(
        filter.kind ? eq(pages.kind, filter.kind) : undefined,
        filter.includeDrafts ? undefined : eq(pages.status, "published"),
      ),
    )
    .orderBy(asc(pages.position), asc(pages.title));
  const entityCards = await loadEntityCards(
    db,
    rows.map((r) => r.entityId).filter((id): id is string => Boolean(id)),
  );
  const out = rows.map((r) =>
    pageSummary(r, r.entityId ? (entityCards.get(r.entityId) ?? null) : null),
  );
  return out.sort((a, b) => {
    if (a.position !== null || b.position !== null)
      return (a.position ?? 1e9) - (b.position ?? 1e9);
    return (a.entity?.bounds?.startMin ?? 1e9) - (b.entity?.bounds?.startMin ?? 1e9);
  });
}

export async function getStats() {
  const db = getDb();
  const count = async (
    table: typeof claims | typeof entities | typeof sources | typeof pages | typeof excerpts,
  ) => (await db.select({ n: sql<number>`count(*)::int` }).from(table))[0]?.n ?? 0;
  const [claimN, entityN, sourceN, pageN, excerptN] = await Promise.all([
    count(claims),
    count(entities),
    count(sources),
    count(pages),
    count(excerpts),
  ]);
  const [pending] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(changesets)
    .where(eq(changesets.status, "proposed"));
  return {
    claims: claimN,
    entities: entityN,
    sources: sourceN,
    pages: pageN,
    excerpts: excerptN,
    pendingChangesets: pending?.n ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Detail views
// ---------------------------------------------------------------------------

export interface LineageNode {
  source: SourceCard;
  /** The work/edition chain: this source, then what it derives from. */
  chain: SourceCard[];
  snapshot: {
    id: string;
    origin: string;
    url: string | null;
    archiveUrl: string | null;
    sha256: string;
    capturedAt: Date;
    title: string | null;
  } | null;
}

export interface ClaimDetail {
  claim: ClaimCard;
  lineage: Record<string, LineageNode>;
  relations: {
    id: string;
    type: string;
    direction: "out" | "in";
    note: string | null;
    other: { id: string; text: string; kind: string; assessment: string };
  }[];
  pages: { slug: string; title: string }[];
  history: AuditEntry[];
}

async function sourceChain(db: DbOrTx, start: string): Promise<SourceCard[]> {
  const chain: SourceCard[] = [];
  let current: string | null = start;
  const seen = new Set<string>();
  while (current && !seen.has(current) && chain.length < 8) {
    seen.add(current);
    const row: typeof sources.$inferSelect | undefined = await db.query.sources.findFirst({
      where: eq(sources.id, current),
    });
    if (!row) break;
    chain.push(toSourceCard(row));
    current = row.derivedFromId;
  }
  return chain;
}

export async function getClaimDetail(id: string): Promise<ClaimDetail> {
  const db = getDb();
  const claim = (await loadClaimCards(db, [id])).get(id);
  if (!claim) throw new NotFoundError(`claim ${id} not found`);

  const lineage: Record<string, LineageNode> = {};
  for (const c of claim.citations) {
    const snapshot = c.excerpt.snapshotId
      ? await db.query.snapshots.findFirst({ where: eq(snapshots.id, c.excerpt.snapshotId) })
      : undefined;
    lineage[c.id] = {
      source: c.excerpt.source,
      chain: await sourceChain(db, c.excerpt.source.id),
      snapshot: snapshot
        ? {
            id: snapshot.id,
            origin: snapshot.origin,
            url: snapshot.url,
            archiveUrl: snapshot.archiveUrl,
            sha256: snapshot.sha256,
            capturedAt: snapshot.capturedAt,
            title: snapshot.title,
          }
        : null,
    };
  }

  const relRows = await db
    .select()
    .from(claimRelations)
    .where(or(eq(claimRelations.fromId, id), eq(claimRelations.toId, id)));
  const otherIds = relRows.map((r) => (r.fromId === id ? r.toId : r.fromId));
  const others = otherIds.length
    ? await db.select().from(claims).where(inArray(claims.id, otherIds))
    : [];
  const otherById = new Map(others.map((o) => [o.id, o]));
  const relations = relRows.map((r) => {
    const otherId = r.fromId === id ? r.toId : r.fromId;
    const o = otherById.get(otherId)!;
    return {
      id: r.id,
      type: r.type,
      direction: (r.fromId === id ? "out" : "in") as "out" | "in",
      note: r.note,
      other: { id: o.id, text: o.text, kind: o.kind, assessment: o.assessment },
    };
  });

  const pageRows = await db
    .select({ slug: pages.slug, title: pages.title })
    .from(pages)
    .where(and(sql`${pages.blocks}::text like ${`%${id}%`}`, eq(pages.status, "published")));
  const history = await listEvents({ subjectId: id, limit: 50 });
  return { claim, lineage, relations, pages: pageRows, history };
}

export interface EntityDetail {
  entity: EntityCard;
  links: {
    id: string;
    type: string;
    direction: "out" | "in";
    other: EntityCard;
    note: string | null;
  }[];
  claims: ClaimCard[];
  pages: { slug: string; title: string }[];
  history: AuditEntry[];
}

/** An entity with its links, claims, pages and history; cached until content changes (see cache.ts). */
export const getEntityDetail: (ref: string) => Promise<EntityDetail> = versionedCache((ref: string) => ref, loadEntityDetail);

async function loadEntityDetail(ref: string): Promise<EntityDetail> {
  const db = getDb();
  const entity = (await loadEntityCards(db, [ref])).get(ref);
  if (!entity) throw new NotFoundError(`entity "${ref}" not found`);
  const linkRows = await db
    .select()
    .from(entityLinks)
    .where(or(eq(entityLinks.fromId, entity.id), eq(entityLinks.toId, entity.id)));
  const otherCards = await loadEntityCards(
    db,
    linkRows.map((l) => (l.fromId === entity.id ? l.toId : l.fromId)),
  );
  const claimIds = (
    await db
      .select({ id: claimEntities.claimId })
      .from(claimEntities)
      .where(eq(claimEntities.entityId, entity.id))
  ).map((r) => r.id);
  const claimCards = await loadClaimCards(db, claimIds);
  const pageRows = await db
    .select({ slug: pages.slug, title: pages.title })
    .from(pages)
    .where(
      and(
        or(eq(pages.entityId, entity.id), sql`${pages.blocks}::text like ${`%${entity.id}%`}`),
        eq(pages.status, "published"),
      ),
    );
  return {
    entity,
    links: linkRows.map((l) => {
      const otherId = l.fromId === entity.id ? l.toId : l.fromId;
      return {
        id: l.id,
        type: l.type,
        direction: l.fromId === entity.id ? ("out" as const) : ("in" as const),
        other: otherCards.get(otherId)!,
        note: l.note,
      };
    }),
    claims: [...claimCards.values()].sort((a, b) => (a.when && b.when ? 0 : a.when ? -1 : 1)),
    pages: pageRows,
    history: await listEvents({ subjectId: entity.id, limit: 30 }),
  };
}

export interface SourceDetail {
  source: SourceCard;
  chain: SourceCard[];
  derived: SourceCard[];
  excerpts: (ExcerptCard & { claims: { id: string; text: string; stance: string }[] })[];
  snapshots: {
    id: string;
    origin: string;
    url: string | null;
    title: string | null;
    charCount: number;
    capturedAt: Date;
  }[];
  history: AuditEntry[];
}

export async function getSourceDetail(id: string): Promise<SourceDetail> {
  const db = getDb();
  const row = await db.query.sources.findFirst({ where: eq(sources.id, id) });
  if (!row) throw new NotFoundError(`source ${id} not found`);
  const derivedRows = await db.select().from(sources).where(eq(sources.derivedFromId, id));
  const excerptRows = await db
    .select({ id: excerpts.id, snapshotId: excerpts.snapshotId })
    .from(excerpts)
    .where(eq(excerpts.sourceId, id));
  const cards = await loadExcerptCards(
    db,
    excerptRows.map((e) => e.id),
  );
  const citeRows = excerptRows.length
    ? await db
        .select({
          excerptId: citations.excerptId,
          stance: citations.stance,
          claimId: claims.id,
          text: claims.text,
        })
        .from(citations)
        .innerJoin(claims, eq(claims.id, citations.claimId))
        .where(
          inArray(
            citations.excerptId,
            excerptRows.map((e) => e.id),
          ),
        )
    : [];
  const snapshotIds = [
    ...new Set(excerptRows.map((e) => e.snapshotId).filter((s): s is string => Boolean(s))),
  ];
  const snapRows = snapshotIds.length
    ? await db.select().from(snapshots).where(inArray(snapshots.id, snapshotIds))
    : [];
  return {
    source: toSourceCard(row),
    chain: await sourceChain(db, id),
    derived: derivedRows.map(toSourceCard),
    excerpts: [...cards.values()].map((c) => ({
      ...c,
      claims: citeRows
        .filter((r) => r.excerptId === c.id)
        .map((r) => ({ id: r.claimId, text: r.text, stance: r.stance })),
    })),
    snapshots: snapRows.map((s) => ({
      id: s.id,
      origin: s.origin,
      url: s.url,
      title: s.title,
      charCount: s.charCount,
      capturedAt: s.capturedAt,
    })),
    history: await listEvents({ subjectId: id, limit: 30 }),
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResults {
  /**
   * The entity the query names, when its whole name or alias is the query or
   * its name starts with it ("ashoka", "pataliputra"): the result to open on
   * Enter, ahead of the pages about it. Also first in `entities`.
   */
  match: SearchResults["entities"][number] | null;
  pages: { id: string; slug: string; title: string; kind: string }[];
  entities: { id: string; slug: string; label: string; kind: string; whenLabel: string | null }[];
  claims: { id: string; text: string; kind: string; assessment: string }[];
  sources: { id: string; title: string; short: string; tier: string }[];
}

interface PageMentions {
  id: string;
  slug: string;
  title: string;
  kind: string;
  /** The entity the page is about, and its name. */
  entityId: string | null;
  entityLabel: string | null;
  /** Entities its blocks name: chapter casts, entity lists and links, places on maps. */
  named: string[];
  /** Entities linked to the claims it shows. */
  viaClaims: string[];
}

/** For every published page, the entities it is about or mentions; cached until content changes. */
const pageMentions = versionedCache(() => "all", async (): Promise<PageMentions[]> => {
  const db = getDb();
  const [rows, slugRows] = await Promise.all([
    db
      .select({ id: pages.id, slug: pages.slug, title: pages.title, kind: pages.kind, entityId: pages.entityId, blocks: pages.blocks })
      .from(pages)
      .where(eq(pages.status, "published")),
    db.select({ id: entities.id, slug: entities.slug, label: entities.label }).from(entities),
  ]);
  const idOf = new Map(slugRows.map((e) => [e.slug, e.id]));
  const labelOf = new Map(slugRows.map((e) => [e.id, e.label]));
  const toId = (ref: string) => (isUuid(ref) ? ref : idOf.get(ref));
  const claimsOf = new Map<string, string[]>();
  const named = new Map<string, string[]>();
  for (const p of rows) {
    const refs = new Set<string>();
    const claimIds = new Set<string>();
    for (const b of p.blocks) {
      entityRefsInBlock(b).forEach((r) => refs.add(r));
      for (const md of markdownInBlock(b)) for (const l of extractLinks(md)) if (l.scheme === "entity") refs.add(l.target);
      claimIdsInBlock(b).filter(isUuid).forEach((id) => claimIds.add(id));
    }
    named.set(p.id, [...refs].map(toId).filter((id): id is string => Boolean(id)));
    claimsOf.set(p.id, [...claimIds]);
  }
  const allClaims = [...new Set([...claimsOf.values()].flat())];
  const links = allClaims.length
    ? await db
        .select({ claimId: claimEntities.claimId, entityId: claimEntities.entityId })
        .from(claimEntities)
        .where(and(inArray(claimEntities.claimId, allClaims), ne(claimEntities.role, "mention")))
    : [];
  const entitiesOfClaim = new Map<string, string[]>();
  for (const l of links) entitiesOfClaim.set(l.claimId, [...(entitiesOfClaim.get(l.claimId) ?? []), l.entityId]);
  return rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    kind: p.kind,
    entityId: p.entityId,
    entityLabel: p.entityId ? (labelOf.get(p.entityId) ?? null) : null,
    named: named.get(p.id) ?? [],
    viaClaims: (claimsOf.get(p.id) ?? []).flatMap((c) => entitiesOfClaim.get(c) ?? []),
  }));
});

/**
 * Search as a newcomer types: diacritics and the common ASCII spellings of
 * IAST are optional ("ashoka" finds Aśoka, see looseSpelling). Entities rank
 * by how well their name answers the query. Pages match by their own title
 * and summary, and through the entities found: the page about one first,
 * then pages whose chapters or claims name it. Claims match by their text
 * and by the entities they are linked to. An entity the query names is
 * returned as `match`, so callers can put it before the pages.
 */
export async function search(
  text: string,
  options: { limit?: number; types?: (keyof SearchResults)[] } = {},
): Promise<SearchResults> {
  const db = getDb();
  const query = toPrefixQuery(text);
  const empty: SearchResults = { match: null, pages: [], entities: [], claims: [], sources: [] };
  if (!query) return empty;
  const limit = Math.min(options.limit ?? 10, 50);
  const want = (t: keyof SearchResults) => !options.types || options.types.includes(t);
  const key = looseKey(text);
  const tsq = sql`to_tsquery('simple', ${query})`;
  const rank = (col: unknown) => sql<number>`ts_rank(${col}, ${tsq})`;
  // Entities are needed for pages and claims too; candidates are re-ranked by name below.
  const needEntities = want("entities") || want("pages") || want("claims");
  const [pageRows, entityRows, claimRows, sourceRows] = await Promise.all([
    want("pages")
      ? db
          .select({ id: pages.id, rank: rank(pages.search) })
          .from(pages)
          .where(and(sql`${pages.search} @@ ${tsq}`, eq(pages.status, "published")))
      : [],
    needEntities
      ? db
          .select({ entity: entities, rank: rank(entities.search) })
          .from(entities)
          .where(sql`${entities.search} @@ ${tsq}`)
          .orderBy(desc(rank(entities.search)))
          .limit(Math.max(limit * 3, 30))
      : [],
    want("claims")
      ? db
          .select({ claim: claims, rank: rank(claims.search) })
          .from(claims)
          .where(sql`${claims.search} @@ ${tsq}`)
          .orderBy(desc(rank(claims.search)))
          .limit(limit * 2)
      : [],
    want("sources")
      ? db
          .select()
          .from(sources)
          .where(sql`${sources.search} @@ ${tsq}`)
          .orderBy(desc(rank(sources.search)))
          .limit(limit)
      : [],
  ]);

  const all = needEntities ? await pageMentions() : [];
  const rankedEntities = rankByName(
    key,
    entityRows.map((r) => ({
      ...r,
      label: r.entity.label,
      aliases: r.entity.aliases,
      prominence: prominenceOf({
        subject: all.some((p) => p.entityId === r.entity.id),
        pages: all.filter((p) => p.named.includes(r.entity.id)).length,
        claims: all.reduce((n, p) => n + p.viaClaims.filter((e) => e === r.entity.id).length, 0),
      }),
    })),
  );
  // The entities the query most likely means: those whose name answers it, else the best few.
  const named = rankedEntities.filter((r) => r.name >= 1);
  const top = (named.length ? named : rankedEntities).slice(0, 5).map((r) => r.entity.id);
  const entityResult = ({ entity: e }: (typeof rankedEntities)[number]): SearchResults["entities"][number] => ({
    id: e.id,
    slug: e.slug,
    label: e.label,
    kind: e.kind,
    whenLabel: e.when ? formatFuzzyDate(e.when) : null,
  });
  const match = namedMatch(key, rankedEntities);

  let pageResults: SearchResults["pages"] = [];
  if (want("pages")) {
    const scores = new Map<string, number>(pageRows.map((p) => [p.id, 10 + p.rank]));
    const description = new Map(entityRows.map((r) => [r.entity.id, r.entity.description ?? ""]));
    top.forEach((id, i) => {
      const weight = 1 / (i + 1);
      for (const p of all) {
        let s = 0;
        if (p.entityId === id) s += 8;
        // Its own one-line description names the page's subject ("Capital of the Maurya Empire").
        if (p.entityLabel && description.get(id)?.includes(p.entityLabel)) s += 3;
        if (p.named.includes(id)) s += 4;
        const n = p.viaClaims.filter((e) => e === id).length;
        if (n) s += 1 + Math.min(n, 10) / 5;
        if (s) scores.set(p.id, (scores.get(p.id) ?? 0) + s * weight);
      }
    });
    pageResults = all
      .filter((p) => scores.has(p.id))
      .sort((a, b) => scores.get(b.id)! - scores.get(a.id)!)
      .slice(0, limit)
      .map((p) => ({ id: p.id, slug: p.slug, title: p.title, kind: p.kind }));
  }

  let claimResults: SearchResults["claims"] = [];
  if (want("claims")) {
    const linked = top.length
      ? await db
          .select({ claim: claims, entityId: claimEntities.entityId, role: claimEntities.role })
          .from(claimEntities)
          .innerJoin(claims, eq(claims.id, claimEntities.claimId))
          .where(and(inArray(claimEntities.entityId, top.slice(0, 3)), ne(claimEntities.role, "mention")))
          .limit(limit * 6)
      : [];
    const byId = new Map<string, { claim: typeof claims.$inferSelect; score: number }>();
    for (const r of claimRows) byId.set(r.claim.id, { claim: r.claim, score: 2 + r.rank });
    for (const r of linked) {
      // About the entity meant (as its subject) counts most; linked to a lesser match, least.
      const s = (r.role === "subject" ? 1.5 : 1) / (top.indexOf(r.entityId) + 1);
      const cur = byId.get(r.claim.id);
      byId.set(r.claim.id, { claim: r.claim, score: (cur?.score ?? 0) + s });
    }
    claimResults = [...byId.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ claim: c }) => ({ id: c.id, text: c.text, kind: c.kind, assessment: c.assessment }));
  }

  return {
    match: want("entities") && match ? entityResult(match) : null,
    pages: pageResults,
    entities: want("entities") ? rankedEntities.slice(0, limit).map(entityResult) : [],
    claims: claimResults,
    sources: sourceRows.map((s) => ({
      id: s.id,
      title: s.title,
      short: shortCitation(s.csl),
      tier: s.tier,
    })),
  };
}

/**
 * Entities with dates, for the global timeline. `options.roles` chooses the
 * span drawn per kind (default: persons by reign where recorded).
 */
/** Every dated entity (of the given kinds) as a timeline item; cached until content changes. */
export const allDatedEntities: (kinds?: string[], options?: { roles?: TimelineRoles }) => Promise<TimelineItem[]> =
  versionedCache(
    (kinds?: string[], options?: { roles?: TimelineRoles }) => JSON.stringify([kinds ?? null, options?.roles ?? null]),
    loadDatedEntities,
  );

async function loadDatedEntities(
  kinds?: string[],
  options: { roles?: TimelineRoles } = {},
): Promise<TimelineItem[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(entities)
    .where(
      and(isNotNull(entities.sortStart), kinds?.length ? inArray(entities.kind, kinds) : undefined),
    )
    .orderBy(asc(entities.sortStart));
  const roles = options.roles ?? DEFAULT_TIMELINE_ROLES;
  return rows
    .filter((r) => r.when && r.bounds)
    .map((r) => entityTimelineItem(toEntityCard(r, null), roles))
    .filter((i): i is TimelineItem => i !== null)
    .sort((a, b) => (a.bounds.startMin ?? -1e9) - (b.bounds.startMin ?? -1e9));
}
