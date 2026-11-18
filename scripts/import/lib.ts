import { join } from "node:path";
import { configureHttp } from "@pramana/connectors";
import { loadRootEnv } from "@pramana/db";
import { connectMcp } from "../lib/mcp-client";

/** Shared plumbing for importers: polite HTTP, MCP connection, preview-only approval. */

export const root = join(import.meta.dirname, "..", "..");

loadRootEnv();
configureHttp({
  cacheDir: join(process.env.PRAMANA_DATA_DIR ?? join(root, "data"), "cache"),
  contact: process.env.PRAMANA_HTTP_CONTACT || null,
});

export const args = process.argv.slice(2);
export const flag = (name: string) => args.includes(`--${name}`);
export const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** --approve-preview: also apply, as a system actor, and only in a database named *preview*. */
export const approvePreview = flag("approve-preview");
export function databaseName(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").pathname.replace(/^\//, "");
  } catch {
    return "";
  }
}
if (approvePreview && !databaseName().includes("preview")) {
  console.error("--approve-preview is only allowed against a database whose name contains 'preview'.");
  process.exit(1);
}

export interface Proposal {
  id: string;
  refs: Record<string, string>;
  report: { outcomes: { summary: string }[] };
  review: string;
}

export type Mcp = Awaited<ReturnType<typeof connectMcp>>;

export async function withMcp<T>(name: string, fn: (mcp: Mcp) => Promise<T>): Promise<T> {
  const mcp = await connectMcp(name);
  try {
    return await fn(mcp);
  } finally {
    await mcp.close();
    // Close the pool whenever one was opened (preview approvals, or a direct read such as listEntities), or the process never exits.
    await (await import("@pramana/db")).closeDb();
  }
}

/** Applies proposals in a preview database (never in the main one). */
export async function approveInPreview(ids: string[]): Promise<void> {
  if (!approvePreview) return;
  const svc = await import("@pramana/services");
  const ctx = await svc.systemContext("import-preview", "system");
  for (const id of ids) {
    const result = await svc.approveChangeset(ctx, id, {
      withDependencies: true,
      allowSystem: true,
      note: "Applied automatically in a preview database.",
    });
    console.log(`  preview approval ${id}: ${result.status}${result.error ? ` (${result.error})` : ""}`);
    if (result.status !== "applied") process.exitCode = 1;
  }
}

export type WikidataMatch =
  | { status: "existing"; id: string; slug: string; label: string; kind: string }
  | { status: "pending"; id: string; slug: string | null; label: string; kind: string; changesetId: string; changesetTitle: string };

export async function matchQids(mcp: Mcp, qids: string[]): Promise<Record<string, WikidataMatch>> {
  if (!qids.length) return {};
  const out: Record<string, WikidataMatch> = {};
  for (let i = 0; i < qids.length; i += 400) {
    Object.assign(out, await mcp.call<Record<string, WikidataMatch>>("entities_by_wikidata", { qids: qids.slice(i, i + 400) }));
  }
  return out;
}
