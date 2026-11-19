import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * Connects to the Pramana MCP server over stdio, exactly as Claude Code does.
 * Scripts that drive the platform (seeding, smoke tests) go through MCP so
 * they exercise the same tools, validation and audit trail as an agent.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function connectMcp(clientName = "pramana-script") {
  const transport = new StdioClientTransport({
    command: join(root, "node_modules", ".bin", "tsx"),
    args: [join(root, "apps", "mcp", "src", "main.ts")],
    cwd: root,
    env: { ...process.env } as Record<string, string>,
    stderr: "inherit",
  });
  const client = new Client({ name: clientName, version: "0.1.0" });
  await client.connect(transport);

  async function call<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    // A large changeset's dry run against a remote database (deploy/content.sh) outlasts the SDK's 60 s default.
    const timeout = Number(process.env.PRAMANA_MCP_TIMEOUT_MS) || undefined;
    const result = await client.callTool({ name, arguments: args }, undefined, timeout ? { timeout } : undefined);
    const content = result.content as { type: string; text: string }[];
    const body = content.map((c) => c.text).join("\n");
    if (result.isError) throw new Error(`${name}: ${body}`);
    try {
      return JSON.parse(body) as T;
    } catch {
      return body as T;
    }
  }
  return { client, call, close: () => client.close() };
}
