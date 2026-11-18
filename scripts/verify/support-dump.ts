/**
 * Collects every evidential citation (stance supports / qualifies / contradicts)
 * on the given pages THROUGH MCP, with the claim, the excerpt's quote and the
 * snapshot text around it, so a reviewer can judge support in context.
 * Read-only: it records nothing.
 *
 *   pnpm tsx scripts/verify/support-dump.ts <out.json> <page-slug>…
 *   … --context 1500   # characters of snapshot text either side of the quote
 */
import { writeFileSync } from "node:fs";
import { connectMcp } from "../lib/mcp-client";

interface Excerpt {
  id: string;
  quote: string | null;
  locatorLabel: string;
  note: string | null;
  verification: { status: string };
  snapshotId: string | null;
  position: { start: number; end: number } | null;
  original: unknown;
  source: { id: string; title: string; kind?: string; license?: string };
}
interface Citation {
  id: string;
  stance: string;
  note: string | null;
  supportCheck: { status: string; note?: string; state?: string; basis?: unknown };
  excerpt: Excerpt;
}
interface Claim {
  id: string;
  text: string;
  kind: string;
  assessment: string;
  assessmentNote: string | null;
  whenLabel: string | null;
  level: number;
  citations: Citation[];
  jointSupport: { status: string; state: string; citationIds: string[] } | null;
}
interface PageView {
  page: { slug: string };
  claims: Record<string, Claim>;
}
interface SnapshotRange {
  start: number;
  end: number;
  text: string;
}

const args = process.argv.slice(2);
const ctxIdx = args.indexOf("--context");
const radius = ctxIdx >= 0 ? Number(args.splice(ctxIdx, 2)[1]) : 1500;
const [out, ...slugs] = args;
if (!out || slugs.length === 0) {
  console.error("usage: support-dump.ts <out.json> <page-slug>…");
  process.exit(1);
}

const EVIDENTIAL = new Set(["supports", "qualifies", "contradicts"]);
const mcp = await connectMcp("pramana-verify");
try {
  const seen = new Set<string>();
  const rows: unknown[] = [];
  const counts: Record<string, Record<string, number>> = {};
  for (const slug of slugs) {
    const view = await mcp.call<PageView>("get_page", { page: slug, format: "json" });
    const c = (counts[slug] = { claims: 0, evidential: 0, mentions: 0, locatorOnly: 0, duplicate: 0 });
    for (const claim of Object.values(view.claims)) {
      c.claims++;
      for (const cit of claim.citations) {
        if (!EVIDENTIAL.has(cit.stance)) {
          c.mentions++;
          continue;
        }
        if (seen.has(cit.id)) {
          c.duplicate++;
          continue;
        }
        seen.add(cit.id);
        const ex = cit.excerpt;
        if (!ex.quote) c.locatorOnly++;
        else c.evidential++;
        let context: string | null = null;
        if (ex.quote && ex.snapshotId && ex.position) {
          const start = Math.max(0, ex.position.start - radius);
          const r = await mcp.call<SnapshotRange>("read_snapshot", {
            snapshotId: ex.snapshotId,
            start,
            length: Math.min(20_000, ex.position.end - start + radius),
          });
          const qs = ex.position.start - r.start;
          const qe = ex.position.end - r.start;
          context = `${r.text.slice(0, qs)}⟦${r.text.slice(qs, qe)}⟧${r.text.slice(qe)}`;
        }
        rows.push({
          page: slug,
          citationId: cit.id,
          stance: cit.stance,
          citationNote: cit.note,
          currentCheck: cit.supportCheck,
          claim: {
            id: claim.id,
            text: claim.text,
            kind: claim.kind,
            assessment: claim.assessment,
            assessmentNote: claim.assessmentNote,
            when: claim.whenLabel,
            level: claim.level,
            otherCitations: claim.citations.filter((o) => o.id !== cit.id).length,
            allCitationIds: claim.citations.map((o) => o.id),
            jointSupport: claim.jointSupport,
          },
          source: ex.source.title,
          sourceId: ex.source.id,
          locator: ex.locatorLabel,
          excerptId: ex.id,
          snapshotId: ex.snapshotId,
          position: ex.position,
          excerptNote: ex.note,
          original: ex.original,
          quote: ex.quote,
          quoteCheck: ex.verification.status,
          context,
        });
      }
    }
  }
  writeFileSync(out, JSON.stringify(rows, null, 2));
  console.table(counts);
  console.log(`${rows.length} evidential citations written to ${out}`);
} finally {
  await mcp.close();
}
