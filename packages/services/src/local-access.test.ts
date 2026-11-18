import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkBearer,
  checkLocalRequest,
  getMcpToken,
  isLocalHost,
  isLocalOrigin,
  mcpTokenPath,
  newMcpToken,
} from "./local-access";

const headers = (h: Record<string, string>) => new Headers(h);

describe("isLocalHost", () => {
  it("accepts loopback names with or without a port", () => {
    for (const h of [
      "127.0.0.1",
      "127.0.0.1:3000",
      "localhost:3200",
      "LOCALHOST",
      "[::1]:3000",
      "[::1]",
    ]) {
      expect(isLocalHost(h), h).toBe(true);
    }
  });
  it("rejects other hosts, look-alikes and missing values", () => {
    for (const h of [
      "evil.example",
      "evil.example:3000",
      "127.0.0.1.evil.example",
      "localhost.evil.example:3000",
      "192.168.1.10:3000",
      "0.0.0.0:3000",
      "127.0.0.1:3000@evil.example",
      "",
    ]) {
      expect(isLocalHost(h), h).toBe(false);
    }
    expect(isLocalHost(null)).toBe(false);
    expect(isLocalHost(undefined)).toBe(false);
  });
});

describe("isLocalOrigin", () => {
  it("accepts no origin (non-browser clients) and local origins", () => {
    expect(isLocalOrigin(null)).toBe(true);
    expect(isLocalOrigin(undefined)).toBe(true);
    expect(isLocalOrigin("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalOrigin("http://localhost:6274")).toBe(true);
    expect(isLocalOrigin("https://localhost")).toBe(true);
    expect(isLocalOrigin("http://[::1]:3000")).toBe(true);
  });
  it("rejects foreign, opaque and malformed origins", () => {
    for (const o of [
      "https://evil.example",
      "http://localhost.evil.example",
      "http://127.0.0.1.nip.io:3000",
      "null",
      "file://",
      "chrome-extension://abc",
      "not a url",
    ]) {
      expect(isLocalOrigin(o), o).toBe(false);
    }
  });
});

describe("checkLocalRequest", () => {
  it("passes a local request from a CLI client", () => {
    expect(checkLocalRequest(headers({ host: "127.0.0.1:3000" }))).toEqual({ ok: true });
  });
  it("blocks DNS rebinding: a foreign Host header", () => {
    const r = checkLocalRequest(
      headers({ host: "attacker.example:3000", origin: "http://attacker.example:3000" }),
    );
    expect(r.ok).toBe(false);
  });
  it("blocks a local Host with a foreign Origin (a page on another site)", () => {
    const r = checkLocalRequest(
      headers({ host: "127.0.0.1:3000", origin: "https://attacker.example" }),
    );
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it("blocks a missing Host", () => {
    expect(checkLocalRequest(headers({})).ok).toBe(false);
  });
});

describe("checkBearer", () => {
  const token = newMcpToken();
  it("accepts the exact token", () => {
    expect(checkBearer(`Bearer ${token}`, token)).toBe(true);
    expect(checkBearer(`bearer ${token}`, token)).toBe(true);
  });
  it("rejects wrong, partial, missing or differently framed tokens", () => {
    expect(checkBearer(`Bearer ${newMcpToken()}`, token)).toBe(false);
    expect(checkBearer(`Bearer ${token.slice(0, -1)}`, token)).toBe(false);
    expect(checkBearer(`Bearer ${token}x`, token)).toBe(false);
    expect(checkBearer(token, token)).toBe(false);
    expect(checkBearer(`Basic ${token}`, token)).toBe(false);
    expect(checkBearer(null, token)).toBe(false);
    expect(checkBearer("Bearer ", "")).toBe(false);
  });
  it("makes long random tokens", () => {
    expect(token).toMatch(/^pmn_[A-Za-z0-9_-]{43}$/);
    expect(newMcpToken()).not.toBe(token);
  });
});

describe("token file", () => {
  let dir: string;
  const before = process.env.PRAMANA_MCP_TOKEN_FILE;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "pramana-token-"));
    process.env.PRAMANA_MCP_TOKEN_FILE = join(dir, "nested", "mcp-token");
  });
  afterAll(() => {
    if (before === undefined) delete process.env.PRAMANA_MCP_TOKEN_FILE;
    else process.env.PRAMANA_MCP_TOKEN_FILE = before;
    rmSync(dir, { recursive: true, force: true });
  });
  it("is created once, readable only by the user, and stable", () => {
    const first = getMcpToken();
    expect(first).toMatch(/^pmn_/);
    expect(getMcpToken()).toBe(first);
    expect(readFileSync(mcpTokenPath(), "utf8").trim()).toBe(first);
    expect(statSync(mcpTokenPath()).mode & 0o777).toBe(0o600);
  });
});
