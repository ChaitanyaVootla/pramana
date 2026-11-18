import type { connectMcp } from "../lib/mcp-client";

export type Mcp = Awaited<ReturnType<typeof connectMcp>>;
