/**
 * Proposes removing exact duplicate copies of uncited excerpts THROUGH MCP,
 * as one changeset of delete_excerpt ops. A copy is a duplicate when another
 * excerpt holds exactly the same evidence: the same source, snapshot, quote,
 * locator, original text and note (MCP `uncited_excerpts`). Of each set of
 * copies one is kept: every cited copy, or else the oldest. Only uncited
 * copies that no page shows are removed; uncited excerpts without a copy are
 * left alone.
 *
 *   pnpm tsx scripts/seed/retire-duplicate-excerpts.ts            # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Idempotent: once the copies are gone there is nothing to propose, and a
 * pending changeset with the same title is not proposed again.
 */
import type { ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";

const TITLE = "Remove duplicate copies of uncited excerpts";

interface UncitedExcerpt {
  id: string;
  source: { id: string; title: string };
  quote: string | null;
  onPages: string[];
  duplicates: { id: string; citations: number }[];
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  const uncited = await mcp.call<UncitedExcerpt[]>("uncited_excerpts");
  const remove: { e: UncitedExcerpt; keep: string[] }[] = [];
  const shown: UncitedExcerpt[] = [];
  for (const e of uncited) {
    if (!e.duplicates.length) continue;
    const cited = e.duplicates.filter((d) => d.citations > 0).map((d) => d.id);
    // Every cited copy stays; with none cited, the oldest copy (lowest UUIDv7) stays.
    const keep = cited.length ? cited : [[e.id, ...e.duplicates.map((d) => d.id)].sort()[0]!];
    if (keep.includes(e.id)) continue;
    if (e.onPages.length) {
      shown.push(e);
      continue;
    }
    remove.push({ e, keep });
  }
  console.log(`${uncited.length} uncited excerpts; ${remove.length} exact copies to remove.`);
  for (const e of shown) console.log(`  kept, shown on ${e.onPages.join(", ")}: ${e.id}`);
  if (!remove.length) {
    console.log("Nothing to do.");
  } else if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log(`"${TITLE}" is already waiting for review.`);
  } else {
    const ops: ChangeOpInput[] = remove.map(({ e, keep }) => ({
      op: "delete_excerpt",
      excerpt: e.id,
      reason: `an exact copy of excerpt ${keep[0]}${keep.length > 1 ? ` (and ${keep.length - 1} more)` : ""}`,
    }));
    const lines = remove.map(
      ({ e, keep }) =>
        `- ${e.id}: “${(e.quote ?? "(no quote)").replace(/\s+/g, " ").slice(0, 80)}…” (${e.source.title}); kept: ${keep.join(", ")}`,
    );
    const proposal = await mcp.call<Proposal>("propose_changes", {
      title: TITLE,
      rationale: [
        "These excerpts are exact copies of another excerpt: the same source, snapshot, quote, locator, original text and note. No claim cites them and no page shows them; they were left by scripts that ran more than once.",
        "Of each set of copies, every cited copy is kept, or else the oldest. Nothing a claim rests on changes. Each removed row is kept in the audit log.",
        lines.join("\n"),
      ].join("\n\n"),
      ops,
    });
    summarize(TITLE, proposal);
    await finish(mcp, flags, [proposal]);
  }
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
