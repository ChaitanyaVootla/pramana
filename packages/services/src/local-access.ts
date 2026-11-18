import { randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { getDb, repoRoot } from "@pramana/db";
import { recordEvent } from "./audit";
import { requireHuman, type ActorContext } from "./context";
import { dataDir } from "./snapshots";

/**
 * Guards for the local MCP endpoint (and anything else that must only answer
 * the person at this computer). There is no login: the web app binds to
 * 127.0.0.1, rejects requests whose Host or Origin is not local (a malicious
 * site can point its own domain at 127.0.0.1, "DNS rebinding"), and the MCP
 * endpoint also wants a bearer token that only this machine can read.
 */

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** "127.0.0.1:3000" → "127.0.0.1"; "[::1]:3000" → "[::1]". Null when it does not parse. */
function hostnameOf(host: string): string | null {
  const m = /^(\[[0-9a-f:]+\]|[^:[\]]+)(?::(\d{1,5}))?$/i.exec(host.trim());
  return m ? m[1]!.toLowerCase() : null;
}

export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const name = hostnameOf(host);
  return name !== null && LOCAL_HOSTNAMES.has(name);
}

/** An Origin header is fine when absent (non-browser clients) or a local http(s) origin. */
export function isLocalOrigin(origin: string | null | undefined): boolean {
  if (origin === null || origin === undefined || origin === "") return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return LOCAL_HOSTNAMES.has(url.hostname.toLowerCase());
}

export type LocalCheck = { ok: true } | { ok: false; status: 403; reason: string };

/** Rejects requests whose Host or Origin is not this computer. */
export function checkLocalRequest(headers: { get(name: string): string | null }): LocalCheck {
  const host = headers.get("host");
  if (!isLocalHost(host)) {
    return { ok: false, status: 403, reason: `host "${host ?? ""}" is not local` };
  }
  const origin = headers.get("origin");
  if (!isLocalOrigin(origin)) {
    return { ok: false, status: 403, reason: `origin "${origin}" is not local` };
  }
  return { ok: true };
}

/** Constant-time check of an `Authorization: Bearer <token>` header. */
export function checkBearer(authorization: string | null | undefined, token: string): boolean {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? "");
  if (!m || !token) return false;
  const given = Buffer.from(m[1]!);
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Where the token lives: PRAMANA_MCP_TOKEN_FILE, else `mcp-token` in the (gitignored) data folder. */
export function mcpTokenPath(): string {
  const configured = process.env.PRAMANA_MCP_TOKEN_FILE;
  if (!configured) return join(dataDir(), "mcp-token");
  return isAbsolute(configured)
    ? configured
    : join(/* turbopackIgnore: true */ repoRoot(), configured);
}

export function newMcpToken(): string {
  return `pmn_${randomBytes(32).toString("base64url")}`;
}

function writeToken(path: string, token: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${token}\n`, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, path);
}

/** The local MCP token, created on first use. Read from disk each time, so a new token applies at once. */
export function getMcpToken(): string {
  const path = mcpTokenPath();
  if (existsSync(path)) {
    const token = readFileSync(path, "utf8").trim();
    if (token) return token;
  }
  mkdirSync(dirname(path), { recursive: true });
  const token = newMcpToken();
  try {
    writeFileSync(path, `${token}\n`, { mode: 0o600, flag: "wx" });
    return token;
  } catch (error) {
    // Another process created it first: use theirs.
    if ((error as NodeJS.ErrnoException).code === "EEXIST")
      return readFileSync(path, "utf8").trim();
    throw error;
  }
}

/** Replaces the token: every client must be given the new one. */
export async function rotateMcpToken(ctx: ActorContext): Promise<string> {
  requireHuman(ctx, "making a new connection token");
  const token = newMcpToken();
  writeToken(mcpTokenPath(), token);
  await recordEvent(getDb(), ctx, { action: "mcp.token_rotated" });
  return token;
}
