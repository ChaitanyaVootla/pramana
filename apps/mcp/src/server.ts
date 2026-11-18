import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ActorContext } from "@pramana/services";
import { INSTRUCTIONS } from "./guide";
import { registerPrompts } from "./prompts";
import { registerTools } from "./tools";

/** One MCP server: the same tools, prompts and manual over stdio and HTTP. */
export function createPramanaServer(
  context: (server: McpServer) => Promise<ActorContext>,
): McpServer {
  const server = new McpServer(
    { name: "pramana", version: "0.1.0" },
    { instructions: INSTRUCTIONS, capabilities: { tools: {}, prompts: {} } },
  );
  registerTools(server, () => context(server));
  registerPrompts(server, () => context(server));
  return server;
}
