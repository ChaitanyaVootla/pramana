/**
 * Records joint support judgments (a claim's citations read together) THROUGH
 * MCP (`check_claim_support`), as the agent acting for the local user. Each
 * judgment names the claim text and the claim's full set of citations it was
 * made against; if either has changed since, or a person's joint judgment
 * still applies, it is skipped and reported rather than recorded.
 *
 *   pnpm tsx scripts/verify/joint-record.ts <joint.json>…
 *   … --dry-run   # check for stale judgments, record nothing
 *
 * A joint file is a JSON array of
 *   { claimId, claimText, allCitationIds, citationIds, verdict: supports|partial|unsupported, note }
 */
import { readFileSync } from "node:fs";
import { connectMcp } from "../lib/mcp-client";

interface JointJudgment {
  claimId: string;
  claimText: string;
  /** Every citation on the claim when it was judged. */
  allCitationIds: string[];
  /** The citations considered together. */
  citationIds: string[];
  verdict: "supports" | "partial" | "unsupported";
  note: string;
}
interface ClaimDetail {
  claim: {
    text: string;
    citations: { id: string }[];
    jointSupport: { status: string; state: string } | null;
  };
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const files = args.filter((a) => !a.startsWith("--"));
const judgments = files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")) as JointJudgment[]);
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

const mcp = await connectMcp("pramana-verify");
const tally: Record<string, number> = {};
const bump = (k: string) => (tally[k] = (tally[k] ?? 0) + 1);
try {
  for (const j of judgments) {
    const { claim } = await mcp.call<ClaimDetail>("get_claim", { id: j.claimId });
    if (claim.text !== j.claimText || !sameSet(claim.citations.map((c) => c.id), j.allCitationIds)) {
      console.log(`skip ${j.claimId}: claim text or citations changed since it was judged`);
      bump("stale");
      continue;
    }
    const js = claim.jointSupport;
    if (js && js.status.startsWith("human_") && js.state === "current") {
      console.log(`skip ${j.claimId}: already judged together by a person (${js.status})`);
      bump("human");
      continue;
    }
    if (!dryRun) {
      await mcp.call("check_claim_support", {
        claimId: j.claimId,
        verdict: j.verdict,
        note: j.note,
        citationIds: j.citationIds,
      });
    }
    bump(dryRun ? `would record ${j.verdict}` : j.verdict);
  }
  console.table(tally);
} finally {
  await mcp.close();
}
