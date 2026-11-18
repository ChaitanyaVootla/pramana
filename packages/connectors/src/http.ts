import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Polite HTTP for open-data APIs: identifies itself (Wikimedia asks clients to;
 * set PRAMANA_HTTP_CONTACT to a contact URL or address, or Wikimedia may refuse
 * requests under its robot policy), sends requests to a host one at a time and
 * spaced out (1 s for Wikimedia), retries 429/5xx honouring Retry-After, and
 * caches responses on disk so re-running imports is cheap and reproducible.
 */

interface HttpConfig {
  cacheDir: string | null;
  contact: string | null;
  minIntervalMs: number;
}

const config: HttpConfig = { cacheDir: null, contact: null, minIntervalMs: 250 };

export function configureHttp(options: Partial<HttpConfig>): void {
  Object.assign(config, options);
}

function userAgent(): string {
  const contact = config.contact ? `; ${config.contact}` : "";
  return `Pramana/0.1 (open-source history learning platform; local instance${contact})`;
}

/** Wikimedia asks API clients to go slowly and serially; other hosts get the default spacing. */
const SLOW_HOSTS = /(^|\.)(wikimedia|wikipedia|wikidata)\.org$/;
function intervalFor(host: string): number {
  return SLOW_HOSTS.test(host) ? Math.max(config.minIntervalMs, 1000) : config.minIntervalMs;
}

// One queue per host: requests to a host start one at a time, spaced by its interval,
// even when callers fire them in parallel.
const queues = new Map<string, Promise<void>>();

function throttle(host: string): Promise<void> {
  const previous = queues.get(host) ?? Promise.resolve();
  const turn = previous.then(() => new Promise<void>((r) => setTimeout(r, intervalFor(host))));
  queues.set(host, turn.catch(() => undefined));
  return previous;
}

/** Milliseconds to wait before retrying: the server's Retry-After (seconds or a date), else exponential backoff. */
function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  const seconds = header ? (/^\d+$/.test(header.trim()) ? Number(header) : (Date.parse(header) - Date.now()) / 1000) : NaN;
  const backoff = 2 ** attempt * 2 + Math.random();
  return Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds : backoff, 120) * 1000;
}

export class HttpError extends Error {
  override name = "HttpError";
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
  }
}

export interface FetchOptions {
  /** Cache lifetime; 0 disables the cache for this request. Default 7 days. */
  cacheTtlMs?: number;
  accept?: string;
  maxBytes?: number;
}

const DEFAULT_TTL = 7 * 24 * 3600 * 1000;

async function cached(url: string, accept: string, ttl: number): Promise<string | null> {
  if (!config.cacheDir || ttl <= 0) return null;
  const path = cachePath(url, accept);
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as { at: number; body: string };
    if (Date.now() - raw.at < ttl) return raw.body;
  } catch {
    // miss
  }
  return null;
}

function cachePath(url: string, accept: string): string {
  const key = createHash("sha256").update(`${accept} ${url}`).digest("hex");
  return join(config.cacheDir!, key.slice(0, 2), `${key}.json`);
}

async function store(url: string, accept: string, body: string): Promise<void> {
  if (!config.cacheDir) return;
  const path = cachePath(url, accept);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify({ at: Date.now(), url, body }));
}

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const accept = options.accept ?? "*/*";
  const ttl = options.cacheTtlMs ?? DEFAULT_TTL;
  const hit = await cached(url, accept, ttl);
  if (hit !== null) return hit;

  const host = new URL(url).host;
  let attempt = 0;
  for (;;) {
    await throttle(host);
    const response = await fetch(url, {
      headers: { "User-Agent": userAgent(), Accept: accept, "Api-User-Agent": userAgent() },
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      attempt++;
      await response.body?.cancel();
      await new Promise((r) => setTimeout(r, retryDelayMs(response, attempt)));
      continue;
    }
    if (!response.ok) {
      throw new HttpError(
        `GET ${url} failed: ${response.status} ${response.statusText}`,
        response.status,
        url,
      );
    }
    const body = await response.text();
    if (options.maxBytes && body.length > options.maxBytes) {
      throw new HttpError(`GET ${url}: response larger than ${options.maxBytes} bytes`, 413, url);
    }
    await store(url, accept, body);
    return body;
  }
}

export async function fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, { accept: "application/json", ...options });
  return JSON.parse(text) as T;
}

export function withParams(
  base: string,
  params: Record<string, string | number | undefined>,
): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params))
    if (v !== undefined) url.searchParams.set(k, String(v));
  return url.toString();
}
