/**
 * Re-derives each media record's credit line (mediaAttribution) from its
 * stored author, licence and representation, and proposes update_media ops for
 * the records whose line has changed (after a change to the wording rules).
 *
 *   pnpm tsx scripts/seed/media-attribution.ts [--withdraw | --approve-preview]
 */
import { mediaAttribution, type MediaLicense, type Representation } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

interface MediaLite {
  id: string;
  title: string;
  artist: string | null;
  license: MediaLicense;
  representation: Representation;
  attribution: string;
  version: number;
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const all = await mcp.call<MediaLite[]>("list_media", { limit: 500 });
  const ops = all.flatMap((m) => {
    const line = mediaAttribution({ artist: m.artist, license: m.license, representation: m.representation, repository: "wikimedia-commons" });
    if (line === m.attribution) return [];
    console.log(`  ${m.title}: “${m.attribution}” → “${line}”`);
    return [{ op: "update_media", media: m.id, set: { attribution: line } }];
  });
  if (!ops.length) console.log("Every credit line is current.");
  else {
    const p = await mcp.call<Proposal>("propose_changes", {
      title: "Media: refresh credit lines",
      rationale: "Credit lines re-derived from each record's stored author, licence and kind of picture (only photographs are labelled “Photo:”). Authors and licences are unchanged.",
      ops,
    });
    summarize("credit lines", p);
    await finish(mcp, flags, [p]);
  }
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
