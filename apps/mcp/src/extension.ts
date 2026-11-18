import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { repoRoot } from "@pramana/db";

/**
 * Claude Desktop's one-click install: an MCP Bundle (.mcpb, a zip with a manifest.json), made on
 * demand for this computer's address and key. Inside is the bridge (../bridge/index.cjs), which
 * needs only the Node.js that Claude Desktop ships with, so the reader installs nothing else.
 * Spec: https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md
 */

export interface ExtensionOptions {
  /** The MCP endpoint, e.g. http://127.0.0.1:3000/api/mcp (always this computer). */
  url: string;
  token: string;
}

/**
 * Claude Desktop shows the plain name "Pramāṇa". Another copy on this computer (a port other than the
 * main :3000) gets its own id, so installing it does not replace the main one, and says which in its
 * description.
 */
function naming(url: string): { name: string; where: string } {
  const port = new URL(url).port;
  return port === "3000" || port === ""
    ? { name: "pramana", where: "" }
    : { name: `pramana-${port}`, where: ` This one is the copy on port ${port}, not the main one.` };
}

export function extensionManifest({ url, token }: ExtensionOptions) {
  const { name, where } = naming(url);
  return {
    manifest_version: "0.3",
    name,
    display_name: "Pramāṇa",
    // A new version each download, so installing again (after a new key) replaces the old one.
    version: `1.0.${Math.floor(Date.now() / 1000)}`,
    description: "Lets Claude read the evidence in Pramāṇa, quiz you, and leave notes beside what you read.",
    long_description:
      `Connects Claude to Pramāṇa running on this computer. Claude can read pages, claims and their sources, run your study sessions, and post notes and canvases you see at once. Changes to content wait for you to approve them. It connects only to this computer, with your key.${where}`,
    author: { name: "Pramāṇa on this computer" },
    icon: "icon.png",
    server: {
      type: "node",
      entry_point: "server/index.js",
      mcp_config: {
        command: "node",
        args: ["${__dirname}/server/index.js"],
        env: { PRAMANA_MCP_URL: url, PRAMANA_MCP_TOKEN: token },
      },
    },
    tools_generated: true,
    prompts_generated: true,
    compatibility: { platforms: ["darwin", "win32"], runtimes: { node: ">=18.0.0" } },
  };
}

/** The bridge's source, as shipped in the bundle. */
export function bridgeSource(): string {
  // From the project folder, not this module's: the web app bundles this file elsewhere.
  return readFileSync(join(/* turbopackIgnore: true */ repoRoot(), "apps", "mcp", "bridge", "index.cjs"), "utf8");
}

/** The seal, 512 px (the size the spec recommends), as Claude Desktop shows the extension. */
function icon(): Buffer {
  return readFileSync(join(/* turbopackIgnore: true */ repoRoot(), "apps", "web", "public", "icon-512.png"));
}

/** The .mcpb file's bytes. */
export function desktopExtension(options: ExtensionOptions): { filename: string; bytes: Buffer } {
  const manifest = extensionManifest(options);
  const bytes = zip([
    { path: "manifest.json", data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) },
    { path: "server/index.js", data: Buffer.from(bridgeSource()) },
    { path: "icon.png", data: icon() },
  ]);
  return { filename: `${manifest.name}.mcpb`, bytes };
}

// ---------------------------------------------------------------------------
// A minimal zip writer (deflate, no directory entries, no zip64): enough for a few small files.
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, as zip headers store them. */
function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function zip(files: { path: string; data: Buffer }[], at = new Date()): Buffer {
  const { time, date } = dosTime(at);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.path, "utf8");
    const packed = deflateRawSync(f.data);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // made by: Unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38); // a regular file, rw-r--r--
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
