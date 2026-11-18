import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import {
  articlePlainText,
  fetchWebPage,
  getInternetArchiveText,
  getWikipediaArticle,
  waybackLookup,
} from "@pramana/connectors";
import {
  canonicalText,
  normalizeForMatch,
  searchText,
  uuidv7,
  type NormalizedText,
} from "@pramana/core";
import { getDb, repoRoot, snapshots } from "@pramana/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordEvent } from "./audit";
import type { ActorContext } from "./context";
import { NotFoundError } from "./util";

/**
 * Snapshots are immutable captured texts, stored content-addressed on disk
 * (data/snapshots/ab/abcd….txt) with metadata in Postgres. Quote verification
 * runs against them, so "the quote exists in the source" is checkable forever,
 * even if the original URL changes or disappears.
 */

export function dataDir(): string {
  const configured = process.env.PRAMANA_DATA_DIR ?? "./data";
  return isAbsolute(configured)
    ? configured
    : join(/* turbopackIgnore: true */ repoRoot(), configured);
}

export const SnapshotOrigin = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("url"), url: z.url() }),
  z.object({ kind: z.literal("internet_archive"), identifier: z.string().min(1).max(200) }),
  z.object({
    kind: z.literal("wikipedia"),
    title: z.string().min(1).max(300),
    lang: z.string().default("en"),
  }),
  z.object({
    kind: z.literal("text"),
    text: z.string().min(1).max(5_000_000),
    title: z.string().max(300).optional(),
    /** Where the text came from (a transcription you typed, a PDF you own...). */
    note: z.string().max(2000),
  }),
]);
export type SnapshotOrigin = z.infer<typeof SnapshotOrigin>;

export interface SnapshotSummary {
  id: string;
  origin: string;
  url: string | null;
  archiveUrl: string | null;
  title: string | null;
  sha256: string;
  charCount: number;
  capturedAt: Date;
  meta: Record<string, unknown>;
}

async function store(
  text: string,
): Promise<{ sha256: string; storagePath: string; byteSize: number }> {
  const sha256 = createHash("sha256").update(text, "utf8").digest("hex");
  const storagePath = join("snapshots", sha256.slice(0, 2), `${sha256}.txt`);
  const full = join(dataDir(), storagePath);
  await mkdir(join(full, ".."), { recursive: true });
  // Content-addressed: if the file exists it already holds these bytes. Otherwise
  // write to a temporary file and rename, so a crash never leaves a partial snapshot.
  const exists = await access(full).then(
    () => true,
    () => false,
  );
  if (!exists) {
    const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, text, { encoding: "utf8", flag: "wx" });
    await rename(tmp, full);
  }
  return { sha256, storagePath, byteSize: Buffer.byteLength(text, "utf8") };
}

export async function captureSnapshot(
  ctx: ActorContext,
  origin: SnapshotOrigin,
): Promise<SnapshotSummary> {
  let text: string;
  let url: string | null = null;
  let archiveUrl: string | null = null;
  let title: string | null = null;
  let mediaType = "text/plain";
  const meta: Record<string, unknown> = {};

  switch (origin.kind) {
    case "internet_archive": {
      const { item, text: ocr, textUrl } = await getInternetArchiveText(origin.identifier);
      text = ocr;
      url = item.url;
      archiveUrl = textUrl;
      title = item.title;
      Object.assign(meta, {
        ia: item.identifier,
        ocr: true,
        csl: item.csl,
        rights: item.rights,
        licenseurl: item.licenseurl,
      });
      break;
    }
    case "wikipedia": {
      const article = await getWikipediaArticle(origin.title, origin.lang);
      text = articlePlainText(article);
      url = article.url;
      title = `${article.title} (Wikipedia, rev. ${article.revisionId})`;
      Object.assign(meta, {
        wikipedia: { lang: article.lang, title: article.title, revisionId: article.revisionId },
        license: article.license,
      });
      break;
    }
    case "url": {
      const page = await fetchWebPage(origin.url);
      text = page.text;
      url = origin.url;
      title = page.title;
      mediaType = "text/plain; derived-from=text/html";
      const wayback = await waybackLookup(origin.url).catch(() => null);
      if (wayback) archiveUrl = wayback.url;
      break;
    }
    case "text": {
      text = origin.text;
      title = origin.title ?? null;
      meta.note = origin.note;
      break;
    }
  }

  return recordSnapshot(ctx, { origin: origin.kind, text, url, archiveUrl, title, mediaType, meta });
}

/**
 * Stores captured text content-addressed and records it (reusing an identical
 * earlier capture of the same URL). Used for texts and for API responses kept
 * as evidence of metadata, such as a Commons file's licence (origin "commons").
 */
export async function recordSnapshot(
  ctx: ActorContext,
  input: {
    origin: string;
    text: string;
    url: string | null;
    archiveUrl?: string | null;
    title: string | null;
    mediaType?: string;
    meta?: Record<string, unknown>;
  },
): Promise<SnapshotSummary> {
  const { origin, url, title } = input;
  const archiveUrl = input.archiveUrl ?? null;
  const mediaType = input.mediaType ?? "text/plain";
  const meta = input.meta ?? {};
  const text = canonicalText(input.text);
  const stored = await store(text);
  const existing = await getDb().query.snapshots.findFirst({
    where: eq(snapshots.sha256, stored.sha256),
  });
  if (existing && existing.url === url) return summarize(existing);

  const id = uuidv7();
  const [row] = await getDb()
    .insert(snapshots)
    .values({
      id,
      origin,
      url,
      archiveUrl,
      title,
      mediaType,
      sha256: stored.sha256,
      byteSize: stored.byteSize,
      charCount: text.length,
      storagePath: stored.storagePath,
      meta,
      capturedById: ctx.actorId,
    })
    .returning();
  await recordEvent(getDb(), ctx, {
    action: "snapshot.captured",
    subjectType: "snapshot",
    subjectId: id,
    data: { origin, url, sha256: stored.sha256, chars: text.length },
  });
  return summarize(row!);
}

function summarize(row: typeof snapshots.$inferSelect): SnapshotSummary {
  return {
    id: row.id,
    origin: row.origin,
    url: row.url,
    archiveUrl: row.archiveUrl,
    title: row.title,
    sha256: row.sha256,
    charCount: row.charCount,
    capturedAt: row.capturedAt,
    meta: row.meta,
  };
}

// Small in-process cache: snapshot texts can be megabytes and normalising them is not free.
// The SHA-256 is verified whenever a snapshot is read from disk into the cache.
const textCache = new Map<string, { text: string; normalized: NormalizedText }>();

export async function loadSnapshotText(
  id: string,
): Promise<{ text: string; normalized: NormalizedText; row: SnapshotSummary }> {
  const row = await getDb().query.snapshots.findFirst({ where: eq(snapshots.id, id) });
  if (!row) throw new NotFoundError(`snapshot ${id} not found`);
  let entry = textCache.get(id);
  if (!entry) {
    const text = await readFile(join(dataDir(), row.storagePath), "utf8");
    const actual = createHash("sha256").update(text, "utf8").digest("hex");
    if (actual !== row.sha256)
      throw new Error(`snapshot ${id} is corrupted on disk (hash mismatch)`);
    entry = { text, normalized: normalizeForMatch(text) };
    textCache.set(id, entry);
    if (textCache.size > 8) textCache.delete(textCache.keys().next().value!);
  }
  return { ...entry, row: summarize(row) };
}

export async function getSnapshot(id: string): Promise<SnapshotSummary> {
  const row = await getDb().query.snapshots.findFirst({ where: eq(snapshots.id, id) });
  if (!row) throw new NotFoundError(`snapshot ${id} not found`);
  return summarize(row);
}

export async function findInSnapshot(
  id: string,
  phrase: string,
  options: { limit?: number; radius?: number } = {},
) {
  const { text, normalized } = await loadSnapshotText(id);
  return searchText(text, phrase, { ...options, normalized });
}

export async function readSnapshotRange(id: string, start: number, length: number) {
  const { text, row } = await loadSnapshotText(id);
  const s = Math.max(0, Math.min(start, text.length));
  const e = Math.min(text.length, s + Math.min(length, 20_000));
  return { snapshot: row, start: s, end: e, total: text.length, text: text.slice(s, e) };
}
