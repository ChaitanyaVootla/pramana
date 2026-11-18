import { handleMcpRequest } from "@pramana/mcp/http";

/**
 * The Pramāṇa MCP server over Streamable HTTP: the same tools, prompts and
 * manual as the stdio server. Local only, with the token from /connect.
 */
export const dynamic = "force-dynamic";

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
