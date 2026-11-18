/**
 * Proposes the novice-first rewrite of the Maurya Empire page (chapters,
 * "You may already know", "Meanwhile", glossary terms) THROUGH MCP, as the
 * agent acting for the local user. The page must already exist.
 *
 *   pnpm tsx scripts/seed/maurya-chapters-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { mauryaChaptersOps, type PageViewLite } from "./maurya-chapters";

const TITLE = "Maurya Empire page: a novice-first story in chapters";
const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }
  const view = await mcp.call<PageViewLite>("get_page", { page: "maurya-empire", format: "json" });
  const ops = mauryaChaptersOps(view);
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Rewrites the page for a first-time reader, following the design direction (novice-first: orient before you assert; chapters are stories).",
      "Nothing new is asserted. All 35 claims already on the page are kept and moved into nine chapters; the prose restates them and links each one. Assessment notes become “Read with care” callouts. “How we know” becomes the chapter “Reading the stone”, and “Common misconceptions” becomes “Often said, and what the evidence shows”.",
      "Adds “You may already know” (Aśoka, Kauṭilya, Pāṭaliputra, the Kalinga war) and “Meanwhile, in the Greek world”, which is built only from the Rock Edict XIII claims and Hultzsch's dates already cited.",
      "Adds twelve glossary terms (kind “term”) with plain definitions; where a definition rests on a translator's rendering (Hultzsch's “anointed”, “morality”), the description says so. Distances in stadia are converted at about 185 m per stadion, marked as our conversion.",
      "Only entities already on the platform are referenced, so this does not depend on the pending Wikidata changesets. The key-facts block is folded into the first chapter's claims.",
    ].join("\n\n"),
    ops,
  });
  summarize("maurya chapters", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
