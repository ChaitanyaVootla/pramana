/**
 * Shared runner for follow-up "fixes" changesets on a page built by a seed
 * script: new excerpts (from snapshots already used), citations added or
 * removed, claims reworded, and small prose edits. Objects are found by their
 * refs in the parent changesets, whose ops carry the ids they were given (in a
 * preview database the parents are applied; in the main one the fixes depend
 * on them), or by their opening words on the page itself (`onPage`). A re-run after the fixes are applied proposes only prose edits that
 * had to wait for the page to exist.
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";

type Stance = "supports" | "contradicts" | "qualifies" | "mentions";
export interface FixSpec {
  title: string;
  /** Titles of the changesets whose refs the fixes use (the page, earlier fixes, other pages). */
  parents: string[];
  page: string;
  /** New excerpts: `like` names an existing excerpt whose source and snapshot are reused; or `source` (a ref) and `snap` (a key of `captures`) name new ones. Refs must be new. */
  excerpts: ({ ref: string; quote: string; locator: Record<string, string>; note?: string } & ({ like: string } | { source: string; snap: string }))[];
  /** Snapshots to capture for new sources, by key. */
  captures?: Record<string, Record<string, unknown>>;
  /** create_source ops for new sources (their refs can be used in `excerpts`). */
  sources?: ChangeOpInput[];
  reword: Record<string, Record<string, unknown>>;
  add: [string, string, Stance, string?][];
  remove: [string, string][];
  /**
   * Objects found on the page as it is now, for pages whose seed changesets
   * carry no usable refs: claims by the opening words of their text, excerpts
   * by the opening words of their quote (among the page's citations).
   */
  onPage?: { claims?: Record<string, string>; excerpts?: Record<string, string> };
  /** Plain-text replacements in the page's blocks (prose, briefs), applied only where the old text is present. */
  prose?: [string, string][];
  rationale: string[];
}

interface Op {
  op: string;
  id?: string;
  ref?: string;
  claim?: string;
  excerpt?: string;
  source?: string;
  snapshotId?: string;
}

export async function runFixes(spec: FixSpec): Promise<void> {
  const flags = parseFlags();
  const mcp = await connectMcp("pramana-seed");
  const newRefs = new Set([...spec.excerpts.map((x) => x.ref), ...(spec.sources ?? []).map((s) => (s as { ref: string }).ref)]);

  async function proseOps(): Promise<ChangeOpInput[]> {
    if (!spec.prose?.length) return [];
    const view = await mcp.call<{ page: { version: number; blocks: (BlockInput & { id: string })[] } }>("get_page", { page: spec.page, format: "json" }).catch(() => null);
    if (!view?.page) return [];
    // Any text in a block (prose, chapter briefs, captions), not only prose markdown.
    const blocks = view.page.blocks.map((b) => {
      let json = JSON.stringify(b);
      for (const [from, to] of spec.prose!) json = json.split(JSON.stringify(from).slice(1, -1)).join(JSON.stringify(to).slice(1, -1));
      return json === JSON.stringify(b) ? b : (JSON.parse(json) as typeof b);
    });
    // Only the changed blocks, each guarded by its fingerprint: other edits of the page do not conflict.
    const op = pagePatchOp(spec.page, view.page.blocks, blocks);
    return op ? [op] : [];
  }

  try {
    if (!flags.force && (await pendingTitles(mcp)).includes(spec.title)) {
      console.log("A changeset with this title is already waiting for review. Nothing to do.");
      return;
    }
    const applied = await mcp.call<{ title: string }[]>("list_changesets", { status: ["applied"], limit: 200 });
    if (applied.some((c) => c.title === spec.title)) {
      const ops = await proseOps();
      if (!ops.length) {
        console.log("The fixes and their prose edits are already applied. Nothing to do.");
        return;
      }
      const p = await mcp.call<Proposal>("propose_changes", {
        title: `${spec.title}: page prose`,
        rationale: "Page prose brought in line with the reworded claims; it had to wait for the page to be approved.",
        ops,
      });
      summarize("fixes (prose)", p);
      await finish(mcp, flags, [p]);
      return;
    }

    const rows = await mcp.call<{ id: string; title: string; status: string }[]>("list_changesets", { status: ["applied", "proposed"], limit: 200 });
    const ref: Record<string, string> = {};
    const excerptInfo: Record<string, { source: string; snapshotId?: string }> = {};
    const citation = new Map<string, string>();
    const dependsOn: string[] = [];
    for (const title of spec.parents) {
      const cs = rows.find((r) => r.title === title);
      if (!cs) throw new Error(`no changeset “${title}”`);
      if (cs.status === "proposed") dependsOn.push(cs.id);
      const full = await mcp.call<{ ops: Op[] }>("get_changeset", { id: cs.id });
      for (const op of full.ops) {
        if (op.ref && op.id) ref[op.ref] = op.id;
        if (op.op === "create_excerpt" && op.ref) excerptInfo[op.ref] = { source: op.source!, snapshotId: op.snapshotId };
        if (op.op === "cite" && op.id) citation.set(`${op.claim}|${op.excerpt}`, op.id);
      }
    }
    if (spec.onPage) {
      type Cit = { id: string; excerpt: { id: string; quote: string | null; snapshotId: string | null; source: { id: string } } };
      const view = await mcp.call<{ claims: Record<string, { id: string; text: string; citations: Cit[] }> }>("get_page", { page: spec.page, format: "json" });
      const claims = Object.values(view.claims);
      for (const [r, prefix] of Object.entries(spec.onPage.claims ?? {})) {
        const found = claims.filter((c) => c.text.startsWith(prefix));
        if (found.length !== 1) throw new Error(`${found.length} claims on ${spec.page} start “${prefix}”`);
        ref[r] = found[0]!.id;
      }
      const cits = claims.flatMap((c) => c.citations.map((cit) => ({ claim: c.id, cit })));
      for (const [r, prefix] of Object.entries(spec.onPage.excerpts ?? {})) {
        const ex = [...new Map(cits.filter(({ cit }) => cit.excerpt.quote?.startsWith(prefix)).map(({ cit }) => [cit.excerpt.id, cit.excerpt])).values()];
        if (ex.length !== 1) throw new Error(`${ex.length} excerpts on ${spec.page} start “${prefix}”`);
        ref[r] = ex[0]!.id;
        excerptInfo[r] = { source: ex[0]!.source.id, ...(ex[0]!.snapshotId ? { snapshotId: ex[0]!.snapshotId } : {}) };
      }
      for (const { claim, cit } of cits) citation.set(`${claim}|${cit.excerpt.id}`, cit.id);
    }
    const id = (r: string) => {
      if (newRefs.has(r)) return `@${r}`;
      const v = ref[r];
      if (!v) throw new Error(`no id for ${r}`);
      return v;
    };

    const snaps: Record<string, string> = {};
    for (const [key, origin] of Object.entries(spec.captures ?? {})) {
      const s = await mcp.call<{ id: string; title: string | null }>("capture_snapshot", { origin });
      snaps[key] = s.id;
      console.log(`  ${key}: ${s.id} ${s.title ?? ""}`);
    }

    const ops: ChangeOpInput[] = [...(spec.sources ?? [])];
    for (const x of spec.excerpts) {
      const like =
        "like" in x ? excerptInfo[x.like] : { source: id(x.source), snapshotId: snaps[x.snap] ?? (() => { throw new Error(`no capture ${x.snap}`); })() };
      if (!like) throw new Error(`no excerpt ${"like" in x ? x.like : x.ref}`);
      ops.push({
        op: "create_excerpt",
        ref: x.ref,
        source: like.source,
        ...(like.snapshotId ? { snapshotId: like.snapshotId } : {}),
        quote: x.quote,
        locator: x.locator,
        ...(x.note ? { note: x.note } : {}),
      } as ChangeOpInput);
    }
    for (const [claim, excerpt] of spec.remove) {
      const cit = citation.get(`${id(claim)}|${id(excerpt)}`);
      if (!cit) throw new Error(`no citation ${claim} ← ${excerpt}`);
      ops.push({ op: "uncite", citation: cit });
    }
    for (const [claim, excerpt, stance, note] of spec.add)
      ops.push({ op: "cite", claim: id(claim), excerpt: id(excerpt), stance, ...(note ? { note } : {}) });
    for (const [claim, set] of Object.entries(spec.reword)) ops.push({ op: "update_claim", claim: id(claim), set } as ChangeOpInput);
    ops.push(...(await proseOps()));

    const p = await mcp.call<Proposal>("propose_changes", {
      title: spec.title,
      rationale: [
        ...spec.rationale,
        dependsOn.length
          ? "Depends on the pending changesets it fixes; prose edits, if any, follow once the page is approved (re-run the script)."
          : "Also brings page prose in line with the reworded claims, where it repeated them.",
      ].join("\n\n"),
      dependsOn,
      ops,
    });
    summarize("fixes", p);
    await finish(mcp, flags, [p]);
  } finally {
    await mcp.close();
    await closeDbIfOpen(flags);
  }
}
