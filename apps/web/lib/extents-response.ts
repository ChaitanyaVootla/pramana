import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { extentsForAtlas, extentsVersion, type AtlasExtents } from "@pramana/services";

/**
 * Atlas border responses, built once and compressed once. A range of borders
 * is mostly repeated coordinates (the whole record is 3.9 MB raw, 240 KB in
 * Brotli), and building it (query, simplification, label points) takes a few
 * seconds, so each response is kept with its JSON and its compressed bodies,
 * keyed by the query and by a fingerprint of the borders table: approving a
 * changeset that changes borders makes the next request rebuild it.
 *
 * The cache lives on globalThis, so the route handler and the start-up warm-up
 * (instrumentation.ts) share it although Next bundles them separately.
 */

export interface RangeQuery {
  from: number;
  to: number;
  bbox?: [number, number, number, number];
  tolerance?: number;
}

interface Entry {
  json: string;
  br?: Buffer;
  gzip?: Buffer;
  at: number;
}

const store = ((
  globalThis as { __pramanaAtlasResponses?: Map<string, Entry> }
).__pramanaAtlasResponses ??= new Map());
/** How long a fingerprint is trusted before it is checked again. */
const VERSION_MS = 15_000;
let version: { value: string; at: number } | null = null;

async function currentVersion(): Promise<string> {
  if (!version || Date.now() - version.at > VERSION_MS)
    version = { value: await extentsVersion(), at: Date.now() };
  return version.value;
}

const keyOf = (q: RangeQuery, v: string) =>
  `${q.from}|${q.to}|${q.bbox?.join(",") ?? ""}|${q.tolerance ?? ""}|${v}`;

/** Builds in progress, so a request arriving while the warm-up builds the same range waits for it. */
const building = ((
  globalThis as { __pramanaAtlasBuilding?: Map<string, Promise<Entry>> }
).__pramanaAtlasBuilding ??= new Map());

async function entry(q: RangeQuery): Promise<Entry> {
  const v = await currentVersion();
  const key = keyOf(q, v);
  const done = store.get(key);
  if (done) return done;
  let job = building.get(key);
  if (!job) {
    job = (async () => {
      const data: AtlasExtents = await extentsForAtlas(q.from, q.to, {
        bbox: q.bbox,
        tolerance: q.tolerance,
      });
      const e: Entry = { json: JSON.stringify(data), at: Date.now() };
      // Entries of an older fingerprint are stale; beyond two dozen ranges, the oldest go.
      for (const k of [...store.keys()]) if (!k.endsWith(`|${v}`)) store.delete(k);
      while (store.size >= 24) store.delete(store.keys().next().value!);
      store.set(key, e);
      return e;
    })().finally(() => building.delete(key));
    building.set(key, job);
  }
  return job;
}

function body(e: Entry, encoding: "br" | "gzip"): Buffer {
  if (encoding === "br")
    return (e.br ??= brotliCompressSync(e.json, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 5 },
    }));
  return (e.gzip ??= gzipSync(e.json, { level: 6 }));
}

/** The response for a range of borders, compressed as the client accepts. */
export async function atlasExtentsResponse(
  request: Request,
  q: RangeQuery,
  headers: Record<string, string>,
): Promise<Response> {
  const e = await entry(q);
  return compressedJson(request, e.json, headers, (enc) => body(e, enc));
}

/** Any JSON, compressed as the client accepts (bodies under 1 KB go as they are). */
export function compressedJson(
  request: Request,
  json: string,
  headers: Record<string, string>,
  compress?: (encoding: "br" | "gzip") => Buffer,
): Response {
  const accept = request.headers.get("accept-encoding") ?? "";
  const encoding = /\bbr\b/.test(accept) ? "br" : /\bgzip\b/.test(accept) ? "gzip" : null;
  const base = { ...headers, "Content-Type": "application/json", Vary: "Accept-Encoding" };
  if (!encoding || json.length < 1024) return new Response(json, { headers: base });
  const out =
    compress?.(encoding) ??
    (encoding === "br"
      ? brotliCompressSync(json, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
      : gzipSync(json, { level: 6 }));
  return new Response(new Uint8Array(out), { headers: { ...base, "Content-Encoding": encoding } });
}

/**
 * Build and compress the ranges /places asks for (the whole record, and the
 * century it opens on) before anyone asks, so the first visitor after a start
 * does not wait for them. Era pages' ranges are small and quick to build.
 */
export async function warmAtlasExtents(): Promise<void> {
  const ranges: RangeQuery[] = [
    { from: -2999, to: 1950, tolerance: 0.06 },
    { from: -300, to: -201, tolerance: 0.06 },
  ];
  for (const q of ranges) {
    const e = await entry(q);
    body(e, "br");
    body(e, "gzip");
  }
}
