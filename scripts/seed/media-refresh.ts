/**
 * Re-reads Commons metadata for media records and proposes updates for those
 * whose licence, author or file changed (see the MCP tool refresh_media).
 *
 *   pnpm tsx scripts/seed/media-refresh.ts "File:…" [<media id> …] [--withdraw | --approve-preview]
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const flags = parseFlags();
const targets = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!targets.length) {
  console.error("give media ids or Commons file titles");
  process.exit(1);
}
const mcp = await connectMcp("pramana-seed");
try {
  const result = await mcp.call<Proposal & { status?: string; current: string[] }>("refresh_media", { media: targets });
  if (result.current?.length) console.log(`  current: ${result.current.join("; ")}`);
  if (result.id) {
    summarize("refresh", result);
    await finish(mcp, flags, [result]);
  } else console.log("  nothing to update");
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
