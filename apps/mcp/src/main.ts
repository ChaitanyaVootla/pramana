#!/usr/bin/env -S npx tsx
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { closeDb } from "@pramana/db";
import { endSession, startAgentSession, type ActorContext } from "@pramana/services";
import { createPramanaServer } from "./server";

/**
 * Pramana MCP server (stdio). One process = one agent session: every tool call
 * is attributed to the agent (PRAMANA_AGENT_HANDLE) acting on behalf of the
 * local user (PRAMANA_USER_HANDLE), with this session's id. The web app also
 * serves the same tools over HTTP (apps/mcp/src/http.ts, at /api/mcp).
 */

let session: Promise<ActorContext> | null = null;
const server = createPramanaServer((s) => {
  session ??= startAgentSession({
    client: s.server.getClientVersion() ?? {},
    meta: { transport: "stdio", pid: process.pid, cwd: process.cwd() },
  });
  return session;
});

const transport = new StdioServerTransport();
await server.connect(transport);

let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  if (session) await endSession(await session).catch(() => {});
  await server.close().catch(() => {});
  await closeDb().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("close", shutdown);
