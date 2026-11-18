/**
 * Shared helpers for scripts that propose changesets through MCP: a readable
 * summary of the dry-run report, and applying a proposal in a PREVIEW database
 * (never in the main one).
 */
import type { connectMcp } from "./mcp-client";

type Mcp = Awaited<ReturnType<typeof connectMcp>>;

export interface Proposal {
  id: string;
  report: {
    outcomes: unknown[];
    excerptChecks: { excerptId: string; status: string; score?: number; matchedText?: string }[];
    claims: {
      claimId: string;
      level: number;
      issues: { severity: string; code: string; message: string }[];
    }[];
  };
  refs: Record<string, string>;
  review: string;
}

export interface Flags {
  /** Apply in a preview database after proposing (system actor). */
  approvePreview: boolean;
  /** Withdraw after reporting: a pure dry run, for iterating on content. */
  withdraw: boolean;
  /** Propose even if a pending changeset with the same title exists. */
  force: boolean;
}

export function parseFlags(argv = process.argv): Flags {
  const flags = {
    approvePreview: argv.includes("--approve-preview"),
    withdraw: argv.includes("--withdraw"),
    force: argv.includes("--force"),
  };
  if (flags.approvePreview && !databaseName().includes("preview")) {
    console.error(
      "--approve-preview is only allowed against a database whose name contains 'preview'.",
    );
    process.exit(1);
  }
  return flags;
}

export function databaseName(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}

/** Prints quote-check counts, every not-found and fuzzy match, and per-claim warnings. */
export function summarize(name: string, p: Proposal): Record<string, number> {
  const checks = p.report.excerptChecks;
  const counts = checks.reduce<Record<string, number>>(
    (acc, c) => ((acc[c.status] = (acc[c.status] ?? 0) + 1), acc),
    {},
  );
  console.log(
    `  ${name}: changeset ${p.id}, ${p.report.outcomes.length} ops, quotes ${JSON.stringify(counts)}`,
  );
  const refName = Object.fromEntries(Object.entries(p.refs).map(([k, v]) => [v, k]));
  for (const c of checks) {
    if (c.status === "not_found")
      console.log(`    NOT FOUND ${refName[c.excerptId] ?? c.excerptId} (score ${c.score})`);
    if (c.status === "fuzzy")
      console.log(
        `    fuzzy ${Math.round((c.score ?? 0) * 100)}% ${refName[c.excerptId] ?? ""}: “${c.matchedText?.replace(/\s+/g, " ").slice(0, 120)}”`,
      );
  }
  for (const cl of p.report.claims) {
    const warnings = cl.issues.filter((i) => i.severity !== "info");
    if (warnings.length)
      console.log(
        `    ${refName[cl.claimId] ?? cl.claimId} L${cl.level}: ${warnings.map((w) => w.code).join(", ")}`,
      );
  }
  return counts;
}

/** After proposing: apply (preview only), withdraw (dry run), or leave pending for review. */
export async function finish(mcp: Mcp, flags: Flags, proposals: Proposal[]): Promise<void> {
  if (flags.withdraw) {
    for (const p of [...proposals].reverse())
      await mcp.call("withdraw_changeset", { id: p.id, note: "Dry run only." });
    console.log("Withdrawn (dry run).");
    return;
  }
  if (flags.approvePreview) {
    const svc = await import("@pramana/services");
    const ctx = await svc.systemContext("seed-preview", "system");
    for (const p of proposals) {
      const result = await svc.approveChangeset(ctx, p.id, {
        withDependencies: true,
        allowSystem: true,
        note: "Applied automatically in a preview database.",
      });
      console.log("preview approval:", JSON.stringify(result).slice(0, 300));
    }
    return;
  }
  for (const p of proposals) console.log(`Review and approve: ${p.review}`);
}

export async function closeDbIfOpen(flags: Flags): Promise<void> {
  if (flags.approvePreview) (await import("@pramana/db")).closeDb();
}

/** Titles of pending changesets, to avoid proposing the same thing twice. */
export async function pendingTitles(mcp: Mcp): Promise<string[]> {
  const overview = await mcp.call<{ pendingChangesets: { title: string }[] }>("overview");
  return overview.pendingChangesets.map((c) => c.title);
}
