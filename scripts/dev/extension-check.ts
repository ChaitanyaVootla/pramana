/**
 * Checks Claude Desktop's one-click extension end to end, against a test server only:
 *   pnpm tsx scripts/dev/extension-check.ts
 *
 * Downloads /connect/extension as Claude Desktop would get it, reads the bundle (manifest.json and
 * server/index.js), then runs the bundled bridge with the manifest's command and environment, as
 * Claude Desktop does, and talks MCP to it over stdio: initialize, list tools and prompts, and call
 * session_info. Also checks that a foreign site gets no extension, and that the bridge refuses an
 * address that is not this computer.
 *
 * Runs against MCP_LOOP_URL (default http://127.0.0.1:3200) and refuses the user's server on :3000.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const base = (process.env.MCP_LOOP_URL ?? "http://127.0.0.1:3200").replace(/\/$/, "");
if (new URL(base).port === "3000") {
  console.error(`refusing ${base}: run this against a test server (e.g. :3200), never :3000`);
  process.exit(2);
}

let failures = 0;
function check(ok: unknown, what: string): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures++;
}

/** The files in a zip, read from its central directory. */
function unzip(buf: Buffer): Map<string, Buffer> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const extra = buf.readUInt16LE(at + 30);
    const comment = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    at += 46 + nameLen + extra + comment;
  }
  return out;
}

/** Runs a command, writes the messages to its stdin, and collects what it answers on stdout. */
function talk(command: string, args: string[], env: Record<string, string>, messages: object[]) {
  return new Promise<{ out: Record<string, unknown>[]; code: number | null; err: string }>((resolve) => {
    const child = spawn(command, args, { env: { PATH: process.env.PATH ?? "", ...env } });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("exit", (code) =>
      resolve({
        out: out
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l) as Record<string, unknown>),
        code,
        err,
      }),
    );
    for (const m of messages) child.stdin.write(`${JSON.stringify(m)}\n`);
    child.stdin.end();
  });
}

// fetch cannot forge Host; a foreign Origin goes through the same check (local-access.test.ts covers Host).
const foreign = await fetch(`${base}/connect/extension`, { headers: { Origin: "https://attacker.example" } });
check(foreign.status === 403, `a foreign site gets no extension (${foreign.status})`);

const res = await fetch(`${base}/connect/extension`);
check(res.ok, `the extension downloads (${res.status})`);
check(
  /attachment; filename="pramana(-\d+)?\.mcpb"/.test(res.headers.get("content-disposition") ?? ""),
  `it downloads as a .mcpb file (${res.headers.get("content-disposition")})`,
);
const files = unzip(Buffer.from(await res.arrayBuffer()));
check(files.has("manifest.json") && files.has("server/index.js"), "it holds manifest.json and server/index.js");
check(files.get("icon.png")?.subarray(1, 4).toString() === "PNG", "it holds its icon");
const manifest = JSON.parse(files.get("manifest.json")!.toString("utf8"));
const { command, args, env } = manifest.server.mcp_config as {
  command: string;
  args: string[];
  env: Record<string, string>;
};
check(manifest.manifest_version === "0.3" && manifest.server.type === "node", "a node extension, manifest 0.3");
check(manifest.display_name === "Pramāṇa", `Claude Desktop shows it as "${manifest.display_name}"`);
check(new URL(env.PRAMANA_MCP_URL!).hostname === "127.0.0.1", `it connects to ${env.PRAMANA_MCP_URL}`);
check(env.PRAMANA_MCP_TOKEN?.startsWith("pmn_"), "it holds the key");

// Unpack it where Claude Desktop would, and start it the way the manifest says.
const dir = mkdtempSync(join(tmpdir(), "pramana-extension-"));
for (const [name, data] of files) {
  mkdirSync(dirname(join(dir, name)), { recursive: true });
  writeFileSync(join(dir, name), data);
}
const run = await talk(
  command,
  args.map((a) => a.replace("${__dirname}", dir)),
  env,
  [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "extension-check", version: "1" },
      },
    },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", id: 3, method: "prompts/list" },
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "session_info", arguments: {} } },
  ],
);
const byId = new Map(run.out.map((m) => [m.id, m.result as Record<string, unknown> | undefined]));
check(byId.get(1)?.serverInfo, "the bundled bridge initializes");
check(((byId.get(2)?.tools as unknown[]) ?? []).length > 10, `it lists ${((byId.get(2)?.tools as unknown[]) ?? []).length} tools`);
check(((byId.get(3)?.prompts as unknown[]) ?? []).length > 0, "it lists the prompts");
const info = JSON.stringify(byId.get(4) ?? {});
check(info.includes("extension-check") && info.includes("http"), "session_info answers through it");
check(run.code === 0, `it exits cleanly when the client closes (${run.code})`);

const refused = await talk(command, args.map((a) => a.replace("${__dirname}", dir)), { ...env, PRAMANA_MCP_URL: "http://example.com/api/mcp" }, []);
check(refused.code === 1 && /only to this computer/.test(refused.err), "it refuses an address that is not this computer");

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
