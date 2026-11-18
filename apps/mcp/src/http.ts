import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  checkBearer,
  checkLocalRequest,
  endSession,
  getMcpToken,
  startAgentSession,
  touchSession,
  type ActorContext,
} from "@pramana/services";
import { createPramanaServer } from "./server";

/**
 * The MCP server over Streamable HTTP, for the web app to serve at /api/mcp.
 * Each MCP session (one `initialize`, then requests carrying its
 * Mcp-Session-Id) is one agent session, attributed like stdio's: the agent
 * acting for the local user, with the client's self-reported name.
 *
 * Only this computer may connect: the Host and Origin headers must be local
 * (DNS-rebinding protection) and the request must carry the local token
 * (`Authorization: Bearer <token>`, shown on /connect).
 */

interface Live {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
  /** The agent session, once the client has initialized. */
  actor: () => Promise<ActorContext> | null;
  lastUsed: number;
}

/** Sessions idle this long are closed (the client re-initializes when it comes back). */
const IDLE_MS = 2 * 60 * 60_000;
const MAX_SESSIONS = 64;

// One map per server process, kept across dev hot reloads.
const g = globalThis as unknown as {
  __pramanaMcpSessions?: Map<string, Live>;
  __pramanaMcpSweep?: NodeJS.Timeout;
};
const live = (g.__pramanaMcpSessions ??= new Map());

function rpcError(
  status: number,
  code: number,
  message: string,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function close(id: string, entry: Live): Promise<void> {
  live.delete(id);
  await entry
    .actor()
    ?.then(endSession)
    .catch(() => {});
  await entry.server.close().catch(() => {});
}

function sweep(): void {
  const now = Date.now();
  for (const [id, entry] of live) if (now - entry.lastUsed > IDLE_MS) void close(id, entry);
}
g.__pramanaMcpSweep ??= setInterval(sweep, 10 * 60_000);
g.__pramanaMcpSweep.unref?.();

/** How many HTTP sessions this process holds open (for the /connect status). */
export function openHttpSessions(): number {
  return live.size;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const local = checkLocalRequest(request.headers);
  if (!local.ok) return rpcError(local.status, -32000, `Forbidden: ${local.reason}`);
  if (!checkBearer(request.headers.get("authorization"), getMcpToken())) {
    return rpcError(
      401,
      -32001,
      "Unauthorized: send the token from /connect as Authorization: Bearer <token>",
      {
        "WWW-Authenticate": 'Bearer realm="pramana"',
      },
    );
  }
  // Links in tool results point at this server (not the .env default, which names the main one).
  process.env.PRAMANA_WEB_URL = new URL(request.url).origin;
  return serve(request);
}

/** Serves a request that has passed the local and token checks. */
async function serve(request: Request): Promise<Response> {
  const sessionId = request.headers.get("mcp-session-id");
  if (sessionId) {
    const entry = live.get(sessionId);
    if (!entry) return rpcError(404, -32001, "Session not found: initialize a new session");
    entry.lastUsed = Date.now();
    // A DELETE ends the session; touching it too could race the end and revive it.
    if (request.method !== "DELETE") {
      void entry
        .actor()
        ?.then(touchSession)
        .catch(() => {});
    }
    return entry.transport.handleRequest(request);
  }
  if (request.method !== "POST") {
    return rpcError(400, -32000, "Bad request: initialize a session first (POST)");
  }

  // A new session: the SDK accepts it only if this is an initialize request.
  let actor: Promise<ActorContext> | null = null;
  let server: McpServer;
  const start = () =>
    (actor ??= startAgentSession({
      client: server.server.getClientVersion() ?? {},
      meta: { transport: "http", userAgent: request.headers.get("user-agent") ?? undefined },
    }));
  server = createPramanaServer(start);
  // HTTP clients are set up on purpose, so the session starts (and shows as connected) once the client is ready.
  server.server.oninitialized = () => void start().catch(() => {});
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      if (live.size >= MAX_SESSIONS) {
        const [oldest] = [...live.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
        if (oldest) void close(oldest[0], oldest[1]);
      }
      live.set(id, { server, transport, actor: () => actor, lastUsed: Date.now() });
    },
    onsessionclosed: (id) => {
      const entry = live.get(id);
      if (entry) void close(id, entry);
    },
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  if (!transport.sessionId) await server.close().catch(() => {});
  return response;
}

/** The JSON-RPC messages in a response (plain JSON, or an SSE stream's `data:` lines). */
async function messages(
  response: Response,
): Promise<{ result?: Record<string, unknown>; error?: { message: string } }[]> {
  const body = await response.text();
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    return body
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5)));
  }
  return body ? [JSON.parse(body)] : [];
}

export interface SelfTest {
  ok: boolean;
  tools: number;
  prompts: number;
  error?: string;
}

/**
 * Checks the endpoint from inside the server: initialize, list tools and
 * prompts, close. It never sends `initialized`, so no agent session is
 * recorded and the reader is not shown as connected.
 */
export async function selfTest(origin: string): Promise<SelfTest> {
  const url = `${origin}/api/mcp`;
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  const post = (body: unknown, sessionId?: string) =>
    serve(
      new Request(url, {
        method: "POST",
        headers: sessionId
          ? { ...headers, "mcp-session-id": sessionId, "mcp-protocol-version": "2025-06-18" }
          : headers,
        body: JSON.stringify(body),
      }),
    );
  try {
    const init = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "pramana-connect-check", version: "0.1.0" },
      },
    });
    const sessionId = init.headers.get("mcp-session-id");
    const [hello] = await messages(init);
    if (!init.ok || !sessionId || !hello?.result) {
      return {
        ok: false,
        tools: 0,
        prompts: 0,
        error: hello?.error?.message ?? `initialize failed (${init.status})`,
      };
    }
    const [tools] = await messages(
      await post({ jsonrpc: "2.0", id: 2, method: "tools/list" }, sessionId),
    );
    const [prompts] = await messages(
      await post({ jsonrpc: "2.0", id: 3, method: "prompts/list" }, sessionId),
    );
    await serve(
      new Request(url, {
        method: "DELETE",
        headers: { "mcp-session-id": sessionId, "mcp-protocol-version": "2025-06-18" },
      }),
    );
    const toolCount = (tools?.result?.tools as unknown[] | undefined)?.length ?? 0;
    const promptCount = (prompts?.result?.prompts as unknown[] | undefined)?.length ?? 0;
    return { ok: toolCount > 0, tools: toolCount, prompts: promptCount };
  } catch (error) {
    return {
      ok: false,
      tools: 0,
      prompts: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
