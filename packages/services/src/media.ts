import {
  getCommonsFile,
  getCommonsFiles,
  searchCommons,
  wikidataImageTitles,
  type CommonsCandidate,
  type CommonsFetched,
} from "@pramana/connectors";
import {
  commonsThumbUrl,
  formatFuzzyDate,
  isUuid,
  mediaAttribution,
  normalizeFileTitle,
  parseCommonsImageInfo,
  REPRESENTATION_LABELS,
  REPRESENTATION_RANK,
  Representation,
  type CommonsFile,
  type FuzzyDate,
  type MediaFocus,
  type MediaLicense,
  type ChangeOpInput,
} from "@pramana/core";
import { changesets, entities, getDb, media, type DbOrTx } from "@pramana/db";
import { arrayOverlaps, eq, inArray, sql } from "drizzle-orm";
import type { ActorContext } from "./context";
import { loadSnapshotText, recordSnapshot, type SnapshotSummary } from "./snapshots";
import { NotFoundError, toPrefixQuery, ValidationError } from "./util";

/**
 * Media: images from Wikimedia Commons. Capturing a file stores the API's
 * metadata as a snapshot (origin "commons") and returns the file fields a
 * create_media op needs; the op is then proposed like any other change, and
 * apply checks those fields against the snapshot. Reads give the web app and
 * agents a `MediaCard` with everything needed to show and credit the image.
 */

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface MediaCard {
  id: string;
  kind: string;
  repository: string;
  fileTitle: string;
  pageUrl: string;
  originalUrl: string;
  width: number;
  height: number;
  mime: string;
  title: string;
  alt: string;
  description: string | null;
  representation: Representation;
  /** Plain words for the representation: "Photograph of the object". */
  representationLabel: string;
  representationNote: string | null;
  license: MediaLicense;
  artist: string | null;
  credit: string | null;
  attribution: string;
  objectDate: FuzzyDate | null;
  objectDateLabel: string | null;
  imageDate: FuzzyDate | null;
  imageDateLabel: string | null;
  /** Entity ids. */
  depicts: string[];
  focus: MediaFocus | null;
  snapshotId: string;
  retrievedAt: Date;
  version: number;
}

/** A small picture for an entity (hover cards, people lists). */
export interface EntityImage {
  mediaId: string;
  /** A thumbnail about 250 px wide; build other sizes with commonsThumbUrl. */
  src: string;
  originalUrl: string;
  width: number;
  height: number;
  mime: string;
  alt: string;
  attribution: string;
  /** Author and licence as stored, for display credit lines. */
  artist: string | null;
  license: MediaLicense;
  repository: string;
  pageUrl: string;
  representation: Representation;
  representationLabel: string;
  focus: MediaFocus | null;
  /** Enough to open the full picture viewer from a thumbnail. */
  title: string;
  description: string | null;
  credit: string | null;
  representationNote: string | null;
  objectDateLabel: string | null;
  imageDateLabel: string | null;
}

type Row = typeof media.$inferSelect;

function label(date: FuzzyDate | null): string | null {
  if (!date) return null;
  try {
    return formatFuzzyDate(date);
  } catch {
    return date.edtf;
  }
}

export function toMediaCard(row: Row): MediaCard {
  const representation = Representation.catch("photograph_of_object").parse(row.representation);
  return {
    id: row.id,
    kind: row.kind,
    repository: row.repository,
    fileTitle: row.fileTitle,
    pageUrl: row.pageUrl,
    originalUrl: row.originalUrl,
    width: row.width,
    height: row.height,
    mime: row.mime,
    title: row.title,
    alt: row.alt,
    description: row.description,
    representation,
    representationLabel: REPRESENTATION_LABELS[representation],
    representationNote: row.representationNote,
    license: row.license,
    artist: row.artist,
    credit: row.credit,
    attribution: row.attribution,
    objectDate: row.objectDate,
    objectDateLabel: label(row.objectDate),
    imageDate: row.imageDate,
    imageDateLabel: label(row.imageDate),
    depicts: row.depicts,
    focus: row.focus,
    snapshotId: row.snapshotId,
    retrievedAt: row.retrievedAt,
    version: row.version,
  };
}

export function toEntityImage(card: MediaCard): EntityImage {
  return {
    mediaId: card.id,
    src: commonsThumbUrl(card, 250),
    originalUrl: card.originalUrl,
    width: card.width,
    height: card.height,
    mime: card.mime,
    alt: card.alt,
    attribution: card.attribution,
    artist: card.artist,
    license: card.license,
    repository: card.repository,
    pageUrl: card.pageUrl,
    representation: card.representation,
    representationLabel: card.representationLabel,
    focus: card.focus,
    title: card.title,
    description: card.description,
    credit: card.credit,
    representationNote: card.representationNote,
    objectDateLabel: card.objectDateLabel,
    imageDateLabel: card.imageDateLabel,
  };
}

export async function loadMediaCards(db: DbOrTx, ids: string[]): Promise<Map<string, MediaCard>> {
  const wanted = [...new Set(ids.filter(isUuid))];
  if (!wanted.length) return new Map();
  const rows = await db.select().from(media).where(inArray(media.id, wanted));
  return new Map(rows.map((r) => [r.id, toMediaCard(r)]));
}

/**
 * How well a kind of picture shows a kind of entity (lower is better). By
 * default evidence comes first (photographs of the object or site, or taken at
 * the time) and imaginings last. For inscriptions the text itself matters
 * most, so a photograph or impression of the writing beats a photograph of
 * the site or its shelter.
 */
export function pictureRank(entityKind: string, representation: Representation): number {
  if (entityKind === "inscription") {
    const order: Partial<Record<Representation, number>> = {
      photograph_of_object: 0,
      copy_of_object: 1,
      historical_photograph: 2,
      photograph_of_site: 3,
    };
    return order[representation] ?? 4 + REPRESENTATION_RANK[representation];
  }
  return REPRESENTATION_RANK[representation];
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

/**
 * The best picture of each entity, by pictureRank for its kind. Among equals,
 * the image that depicts fewest other things wins (it is more about this
 * entity), then the earliest-made record, so the choice is stable.
 */
export async function entityImages(db: DbOrTx, entityIds: string[]): Promise<Map<string, EntityImage>> {
  const ids = [...new Set(entityIds.filter(isUuid))];
  if (!ids.length) return new Map();
  const [rows, kinds] = await Promise.all([
    db.select().from(media).where(arrayOverlaps(media.depicts, ids)),
    db.select({ id: entities.id, kind: entities.kind }).from(entities).where(inArray(entities.id, ids)),
  ]);
  const kindOf = new Map(kinds.map((k) => [k.id, k.kind]));
  const best = new Map<string, { card: MediaCard; key: [number, number, number] }>();
  for (const row of rows) {
    const card = toMediaCard(row);
    for (const id of card.depicts) {
      if (!kindOf.has(id)) continue;
      const key: [number, number, number] = [
        pictureRank(kindOf.get(id)!, card.representation),
        Math.min(card.depicts.length, 99),
        row.createdAt.getTime(),
      ];
      const current = best.get(id);
      if (!current || compareKeys(key, current.key) < 0) best.set(id, { card, key });
    }
  }
  return new Map([...best].map(([id, { card }]) => [id, toEntityImage(card)]));
}

export async function getMedia(ref: string): Promise<MediaCard & { depictsEntities: { id: string; slug: string; label: string }[] }> {
  const db = getDb();
  const row = isUuid(ref)
    ? await db.query.media.findFirst({ where: eq(media.id, ref) })
    : await db.query.media.findFirst({ where: eq(media.fileTitle, normalizeFileTitle(ref)) });
  if (!row) throw new NotFoundError(`media "${ref}" not found`);
  const card = toMediaCard(row);
  const depicted = card.depicts.length
    ? await db
        .select({ id: entities.id, slug: entities.slug, label: entities.label })
        .from(entities)
        .where(inArray(entities.id, card.depicts))
    : [];
  return { ...card, depictsEntities: depicted };
}

export async function listMedia(filter: { depicts?: string; limit?: number } = {}): Promise<MediaCard[]> {
  const db = getDb();
  let entityId: string | undefined;
  if (filter.depicts) {
    const e = isUuid(filter.depicts)
      ? await db.query.entities.findFirst({ where: eq(entities.id, filter.depicts), columns: { id: true } })
      : await db.query.entities.findFirst({ where: eq(entities.slug, filter.depicts), columns: { id: true } });
    if (!e) throw new NotFoundError(`entity "${filter.depicts}" not found`);
    entityId = e.id;
  }
  const rows = await db
    .select()
    .from(media)
    .where(entityId ? arrayOverlaps(media.depicts, [entityId]) : undefined)
    .orderBy(media.id)
    .limit(Math.min(filter.limit ?? 100, 500));
  return rows.map(toMediaCard);
}

export type MediaMatch =
  | { status: "existing"; id: string; title: string }
  | { status: "pending"; id: string; title: string; changesetId: string; changesetTitle: string };

/**
 * Which Commons files already have a media record, applied or proposed in a
 * pending changeset, so scripts and agents do not propose the same file twice.
 */
export async function mediaByFileTitle(titles: string[]): Promise<Record<string, MediaMatch>> {
  const wanted = [...new Set(titles.map(normalizeFileTitle))];
  const out: Record<string, MediaMatch> = {};
  if (!wanted.length) return out;
  const db = getDb();
  const rows = await db
    .select({ id: media.id, title: media.title, fileTitle: media.fileTitle })
    .from(media)
    .where(inArray(media.fileTitle, wanted));
  for (const r of rows) out[r.fileTitle] = { status: "existing", id: r.id, title: r.title };
  const pending = await db
    .select()
    .from(changesets)
    .where(sql`${changesets.status} = 'proposed' and ${changesets.ops}::text like '%"create_media"%'`);
  const set = new Set(wanted);
  for (const cs of pending) {
    for (const op of cs.ops as ({ op: string; id?: string } & Record<string, unknown>)[]) {
      if (op.op !== "create_media" || !op.id) continue;
      const fileTitle = normalizeFileTitle(op.fileTitle as string);
      if (!set.has(fileTitle) || out[fileTitle]) continue;
      out[fileTitle] = {
        status: "pending",
        id: op.id,
        title: op.title as string,
        changesetId: cs.id,
        changesetTitle: cs.title,
      };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Capturing a file's metadata
// ---------------------------------------------------------------------------

export interface CapturedMedia {
  snapshot: SnapshotSummary;
  file: CommonsFile;
  /** The file fields of a create_media op, read from the API; add the editorial fields. */
  fields: Omit<
    Extract<ChangeOpInput, { op: "create_media" }>,
    "op" | "ref" | "title" | "alt" | "representation" | "representationNote" | "objectDate" | "depicts" | "focus" | "attribution"
  >;
}

/**
 * Fetches a Commons file's metadata fresh from the API, stores the response as
 * a snapshot, and returns the fields a create_media op needs. Refuses files
 * whose licence is not free (NC, ND, fair use, unknown).
 */
export async function captureCommonsMedia(ctx: ActorContext, fileTitle: string): Promise<CapturedMedia> {
  return captureFetched(ctx, await getCommonsFile(fileTitle, { fresh: true }));
}

/** Like captureCommonsMedia for many files, in as few API requests as possible (50 titles each). */
export async function captureCommonsMediaMany(ctx: ActorContext, fileTitles: string[]): Promise<Map<string, CapturedMedia>> {
  const fetched = await getCommonsFiles(fileTitles, { fresh: true });
  const out = new Map<string, CapturedMedia>();
  for (const title of fileTitles) {
    const found = fetched.get(normalizeFileTitle(title));
    if (!found) throw new NotFoundError(`Commons file "${normalizeFileTitle(title)}" not found`);
    out.set(normalizeFileTitle(title), await captureFetched(ctx, found));
  }
  return out;
}

async function captureFetched(ctx: ActorContext, fetched: CommonsFetched): Promise<CapturedMedia> {
  const { file } = fetched;
  if (!file.license.ok) throw new ValidationError(`${file.fileTitle}: licence refused: ${file.license.reason}`);
  if (!file.mime.startsWith("image/")) throw new ValidationError(`${file.fileTitle} is ${file.mime}, not an image`);
  const snapshot = await recordSnapshot(ctx, {
    origin: "commons",
    text: JSON.stringify(fetched.raw, null, 1),
    url: file.pageUrl,
    title: `${file.fileTitle} (Wikimedia Commons metadata)`,
    mediaType: "application/json",
    meta: { repository: "wikimedia-commons", fileTitle: file.fileTitle, api: fetched.apiUrl, sha1: file.sha1 },
  });
  return {
    snapshot,
    file,
    fields: {
      kind: "image",
      repository: "wikimedia-commons",
      fileTitle: file.fileTitle,
      pageUrl: file.pageUrl,
      originalUrl: file.originalUrl,
      width: file.width,
      height: file.height,
      mime: file.mime,
      ...(file.sha1 ? { sha1: file.sha1 } : {}),
      license: file.license.license,
      ...(file.artist ? { artist: file.artist.slice(0, 500) } : {}),
      ...(file.credit ? { credit: file.credit.slice(0, 1000) } : {}),
      ...(file.description ? { description: file.description.slice(0, 4000) } : {}),
      ...(file.date ? { imageDate: file.date } : {}),
      snapshotId: snapshot.id,
      retrievedAt: snapshot.capturedAt.toISOString(),
    },
  };
}

export type MediaEditorial = Pick<
  Extract<ChangeOpInput, { op: "create_media" }>,
  "title" | "alt" | "representation" | "representationNote" | "objectDate" | "imageDate" | "depicts" | "focus" | "ref"
>;

/** A complete create_media op from a capture plus the editorial fields; the attribution line is derived. */
export function createMediaOp(captured: CapturedMedia, editorial: MediaEditorial): Extract<ChangeOpInput, { op: "create_media" }> {
  return {
    op: "create_media",
    ...captured.fields,
    ...editorial,
    attribution: mediaAttribution({
      artist: captured.fields.artist,
      license: captured.fields.license,
      representation: editorial.representation,
      repository: "wikimedia-commons",
    }),
  };
}

/** Commons search with licence verdicts, marking files that already have (or await) a media record. */
export async function searchCommonsMedia(
  query: string,
  limit?: number,
): Promise<(CommonsCandidate & { onPlatform: MediaMatch | null })[]> {
  const candidates = await searchCommons(query, limit);
  const known = await mediaByFileTitle(candidates.map((c) => c.fileTitle));
  return candidates.map((c) => ({ ...c, onPlatform: known[c.fileTitle] ?? null }));
}

/** Images Wikidata gives for entities (P18), by entity slug, for entities with a QID. */
export async function wikidataImagesForEntities(refs: string[]): Promise<Record<string, { qid: string; files: string[] }>> {
  const db = getDb();
  const rows = await db
    .select({ id: entities.id, slug: entities.slug, qid: entities.wikidataId })
    .from(entities)
    .where(inArray(entities.slug, refs.filter((r) => !isUuid(r))));
  const byId = refs.filter(isUuid).length
    ? await db
        .select({ id: entities.id, slug: entities.slug, qid: entities.wikidataId })
        .from(entities)
        .where(inArray(entities.id, refs.filter(isUuid)))
    : [];
  const all = [...rows, ...byId].filter((r) => r.qid);
  const titles = await wikidataImageTitles(all.map((r) => r.qid!));
  return Object.fromEntries(
    all.flatMap((r) => (titles.has(r.qid!) ? [[r.slug, { qid: r.qid!, files: titles.get(r.qid!)! }]] : [])),
  );
}

// ---------------------------------------------------------------------------
// Checking a record against its snapshot (used by apply)
// ---------------------------------------------------------------------------

/** The file as the stored API snapshot describes it. */
export async function fileFromSnapshot(snapshotId: string): Promise<CommonsFile> {
  const { text, row } = await loadSnapshotText(snapshotId);
  if (row.origin !== "commons") throw new ValidationError(`snapshot ${snapshotId} is not Commons metadata (${row.origin})`);
  return parseCommonsImageInfo(JSON.parse(text));
}

/**
 * Differences between a record's file fields and what the API said. Editorial
 * fields are not compared. An empty list means the record is faithful.
 */
export function compareWithFile(
  fields: {
    fileTitle?: string;
    originalUrl?: string;
    pageUrl?: string;
    width?: number;
    height?: number;
    mime?: string;
    sha1?: string;
    license?: MediaLicense;
    artist?: string;
    credit?: string;
  },
  file: CommonsFile,
): string[] {
  const problems: string[] = [];
  if (!file.license.ok) return [`the snapshot's licence is refused: ${file.license.reason}`];
  const lic = file.license.license;
  const check = (name: string, given: unknown, actual: unknown) => {
    if (given !== undefined && given !== actual) problems.push(`${name} is ${JSON.stringify(given)}, the API says ${JSON.stringify(actual)}`);
  };
  check("fileTitle", fields.fileTitle && normalizeFileTitle(fields.fileTitle), file.fileTitle);
  check("originalUrl", fields.originalUrl, file.originalUrl);
  check("pageUrl", fields.pageUrl, file.pageUrl);
  check("width", fields.width, file.width);
  check("height", fields.height, file.height);
  check("mime", fields.mime, file.mime);
  check("sha1", fields.sha1, file.sha1 ?? undefined);
  if (fields.license) {
    check("license.family", fields.license.family, lic.family);
    check("license.spdx", fields.license.spdx, lic.spdx);
    check("license.attributionRequired", fields.license.attributionRequired, lic.attributionRequired);
  }
  check("artist", fields.artist, file.artist?.slice(0, 500) ?? undefined);
  check("credit", fields.credit, file.credit?.slice(0, 1000) ?? undefined);
  return problems;
}

/**
 * The update_media `set` that brings a record in line with a fresh capture,
 * or null when nothing the API reports has changed. The credit line is
 * re-derived for the record's own representation.
 */
export function mediaRefreshSet(record: MediaCard, captured: CapturedMedia): Record<string, unknown> | null {
  const f = captured.fields;
  const attribution = mediaAttribution({
    artist: f.artist,
    license: f.license,
    representation: record.representation,
    repository: "wikimedia-commons",
  });
  const next: Record<string, unknown> = {
    pageUrl: f.pageUrl,
    originalUrl: f.originalUrl,
    width: f.width,
    height: f.height,
    mime: f.mime,
    sha1: f.sha1,
    license: f.license,
    artist: f.artist,
    credit: f.credit,
    attribution,
  };
  const prev: Record<string, unknown> = {
    pageUrl: record.pageUrl,
    originalUrl: record.originalUrl,
    width: record.width,
    height: record.height,
    mime: record.mime,
    sha1: undefined,
    license: record.license,
    artist: record.artist ?? undefined,
    credit: record.credit ?? undefined,
    attribution: record.attribution,
  };
  const changed = Object.keys(next).filter(
    (k) => k !== "sha1" && next[k] !== undefined && JSON.stringify(next[k]) !== JSON.stringify(prev[k]),
  );
  if (!changed.length) return null;
  const set: Record<string, unknown> = { snapshotId: f.snapshotId, retrievedAt: f.retrievedAt };
  for (const k of Object.keys(next)) if (next[k] !== undefined) set[k] = next[k];
  return set;
}

/**
 * Text search over media (title, alt text, description, author, file name),
 * accent-insensitive and by word prefix, newest records last. For pickers
 * (a canvas, an agent) that need "a picture of X" already on the platform.
 */
export async function searchMedia(query: string, options: { limit?: number } = {}): Promise<MediaCard[]> {
  const q = toPrefixQuery(query);
  if (!q) return [];
  const rows = await getDb()
    .select()
    .from(media)
    .where(sql`${media.search} @@ to_tsquery('simple', ${q})`)
    .orderBy(media.id)
    .limit(Math.min(options.limit ?? 24, 100));
  return rows.map(toMediaCard);
}
