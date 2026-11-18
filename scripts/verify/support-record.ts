/**
 * Records support judgments THROUGH MCP (`check_support`), as the agent acting
 * for the local user. Each judgment names the claim text and quote it was made
 * against; if either has changed since, or a person has already judged the
 * citation, it is skipped and reported rather than recorded.
 *
 *   pnpm tsx scripts/verify/support-record.ts <judgments.json>…
 *   … --dry-run   # check for stale judgments, record nothing
 *
 * A judgments file is a JSON array of
 *   { citationId, claimId, claimText, quote, stance?, verdict: supports|partial|unsupported, note }
 * When several files judge the same citation, the last one wins. A citation
 * whose current judgment already has this verdict and still applies is left alone.
 */
import { readFileSync } from "node:fs";
import { connectMcp } from "../lib/mcp-client";

interface Judgment {
  citationId: string;
  claimId: string;
  claimText: string;
  quote: string;
  stance?: string;
  verdict: "supports" | "partial" | "unsupported";
  note: string;
}
interface ClaimDetail {
  claim: {
    text: string;
    citations: {
      id: string;
      stance: string;
      supportCheck: { status: string; state?: string; basis?: unknown };
      excerpt: { quote: string | null };
    }[];
  };
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => !a.startsWith("--"));
const latest = new Map<string, Judgment>();
for (const f of files) for (const j of JSON.parse(readFileSync(f, "utf8")) as Judgment[]) latest.set(j.citationId, j);
const judgments = [...latest.values()];
const STATUS = { supports: "ai_supports", partial: "ai_partial", unsupported: "ai_unsupported" } as const;

const mcp = await connectMcp("pramana-verify");
const tally: Record<string, number> = {};
const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
try {
  const claims = new Map<string, ClaimDetail>();
  for (const j of judgments) {
    let detail = claims.get(j.claimId);
    if (!detail) {
      detail = await mcp.call<ClaimDetail>("get_claim", { id: j.claimId });
      claims.set(j.claimId, detail);
    }
    const cit = detail.claim.citations.find((c) => c.id === j.citationId);
    if (!cit) {
      console.log(`skip ${j.citationId}: citation no longer on claim ${j.claimId}`);
      bump("missing");
      continue;
    }
    if (detail.claim.text !== j.claimText || cit.excerpt.quote !== j.quote || (j.stance && cit.stance !== j.stance)) {
      console.log(`skip ${j.citationId}: claim or quote changed since it was judged`);
      bump("stale");
      continue;
    }
    const sc = cit.supportCheck;
    if (sc.basis && sc.state === "current" && sc.status === STATUS[j.verdict]) {
      bump("already current");
      continue;
    }
    if (sc.status.startsWith("human_") && sc.state !== "stale") {
      console.log(`skip ${j.citationId}: already judged by a person (${sc.status})`);
      bump("human");
      continue;
    }
    if (!dryRun) await mcp.call("check_support", { citationId: j.citationId, verdict: j.verdict, note: j.note });
    bump(dryRun ? `would record ${j.verdict}` : j.verdict);
  }
  console.table(tally);
} finally {
  await mcp.close();
}
