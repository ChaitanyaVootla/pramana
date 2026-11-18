/**
 * Shared machinery for the copy-edit scripts (copyedit-gupta.ts,
 * copyedit-independence.ts, copyedit-maurya.ts): plain-language rewrites of
 * a page's prose, chapter promises, callouts and notes for a first-time
 * reader, proposed THROUGH MCP as one changeset per page.
 *
 * Each edit names a block, claim or entity, the fields it rewrites, and a
 * fingerprint of the text those fields held when the edit was written. The
 * page is re-read right before proposing, and a field is replaced only if it
 * still holds that text, so edits made by others in the meantime are kept
 * (and reported). Fields that already hold the new text are left alone, so
 * running again changes nothing.
 *
 * Claim ids differ between databases. In new text, `{c:Opening words}` stands
 * for the claim on the page whose text starts with those words; entities are
 * linked by slug. Fingerprints are taken with link targets replaced the same
 * way, so they match on any database seeded from the same content.
 *
 * Flags (with those of ../lib/proposal.ts):
 *   --fingerprints   print the current fingerprint of every edit and exit
 */
import { createHash } from "node:crypto";
import { Block, type BlockInput, type ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";

export type Mcp = Awaited<ReturnType<typeof connectMcp>>;

export interface PageViewJson {
  page: { id: string; slug: string; version: number; blocks: (BlockInput & Record<string, unknown>)[] };
  claims: Record<string, { id: string; version: number; text: string; assessmentNote: string | null }>;
  entities: Record<string, { id: string; slug: string }>;
  /** Claims the changeset being built will create: their full text → "@ref". */
  newRefs?: Map<string, string>;
  /** Claims the changeset being built rewords: their new text → id. */
  renamed?: Map<string, string>;
}

interface EntityDetailJson {
  entity: Record<string, unknown> & { id: string; slug: string };
}

type Was = string | string[];

/** A new value, or a function of the current one (for item arrays, where only some items change). */
type FieldValue = unknown | ((current: any, page: PageContext) => unknown);

/** What a field function may ask about the page: the slug of an entity id it mentions, a claim's id by its opening words. */
export interface PageContext {
  slug: (id: string) => string | undefined;
  claim: (opening: string) => string;
}

export interface BlockEdit {
  block: string;
  /**
   * Fingerprint of the touched fields as they were when the edit was written,
   * or several: the original text and earlier versions of this edit, so a
   * revised edit still applies where an earlier one has, or has not, been.
   */
  was: Was;
  set: Record<string, FieldValue>;
  why?: string;
}

/** A block that does not exist yet, inserted after another one. */
export interface BlockInsert {
  after: string;
  block: Record<string, unknown> & { id: string; type: string };
  /** Claims (by opening words) to take out of the blocks they are listed in, because the new block lists them. */
  moves?: { from: string; claims: string[] };
  why?: string;
}

export interface ClaimEdit {
  /** Opening words of the claim's text. */
  claim: string;
  /** Other openings it may have on another database (reworded there by someone else). */
  also?: string[];
  was: Was;
  set: { text?: string; assessmentNote?: string; when?: FieldValue; entities?: FieldValue };
  why?: string;
}

export interface EntityEdit {
  entity: string;
  was: Was;
  set: Record<string, FieldValue>;
  why?: string;
}

export interface CopyEdit {
  page: string;
  title: string;
  rationale: string[];
  blocks: BlockEdit[];
  inserts?: BlockInsert[];
  claims?: ClaimEdit[];
  entities?: EntityEdit[];
  /**
   * People named on a claim only as the writer or speaker of its source (a
   * witness or commentator, not an actor): their role on that claim becomes
   * "author". Other entities and roles on the claim are kept.
   */
  authors?: { claim: string; authors: string[] }[];
  /** Blocks to move, unchanged, so that each comes right after another block. */
  moves?: { block: string; after: string; why?: string }[];
  /**
   * New evidence: builds the ops creating sources, excerpts, claims and
   * citations that are not on the page yet, and returns each new claim's text
   * with its @ref, so that `{c:Opening words}` can link a claim this same
   * changeset creates. Claims already on the page are left out.
   */
  newClaims?: (mcp: Mcp, view: PageViewJson) => Promise<{ ops: ChangeOpInput[]; refs: Map<string, string> }>;
}

type ClaimEntityView = { id: string; slug: string; role: string };

/** A claim edit setting the named entities' role to "author", or nothing if it already is. */
function authorEdit(a: { claim: string; authors: string[] }): ClaimEdit {
  return {
    claim: a.claim,
    // Only roles change and every other entity is kept, so concurrent edits are safe.
    was: "*",
    why: `${a.authors.join(", ")} as author`,
    set: {
      entities: (ents: ClaimEntityView[]) => {
        const missing = a.authors.filter((slug) => !ents.some((e) => e.slug === slug));
        if (missing.length) throw new Error(`claim "${a.claim}" does not name ${missing.join(", ")}`);
        if (ents.every((e) => !a.authors.includes(e.slug) || e.role === "author")) return ents;
        return ents.map((e) => ({ entity: e.slug, role: a.authors.includes(e.slug) ? "author" : e.role }));
      },
    },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LINK = /\]\((claim|entity):([^)\s]+)\)/g;

/** Database-independent form of a value: claim and entity ids replaced by claim openings and entity slugs. */
function portable(value: unknown, view: PageViewJson, slugs: Map<string, string>): unknown {
  const id = (s: string) => {
    if (view.claims[s]) return `claim:${view.claims[s]!.text.slice(0, 40)}`;
    return slugs.get(s) ?? s;
  };
  if (typeof value === "string") {
    if (UUID.test(value)) return id(value);
    return value.replace(LINK, (_m, kind: string, target: string) =>
      kind === "claim" ? `](claim:${view.claims[target]?.text.slice(0, 40) ?? target})` : `](entity:${slugs.get(target) ?? target})`,
    );
  }
  if (Array.isArray(value)) return value.map((v) => portable(v, view, slugs));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined && v !== null)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, portable(v, view, slugs)]),
    );
  return value;
}

function fingerprint(fields: Record<string, unknown>, view: PageViewJson, slugs: Map<string, string>): string {
  return createHash("sha256").update(JSON.stringify(portable(fields, view, slugs))).digest("hex").slice(0, 10);
}

function claimId(view: PageViewJson, opening: string): string {
  // "A || B": either opening, for a claim worded differently on another database.
  if (opening.includes(" || ")) {
    const alts = opening.split(" || ");
    for (const alt of alts) {
      const n = Object.values(view.claims).filter((c) => c.text.startsWith(alt)).length;
      if (n === 1) return claimId(view, alt);
    }
    return claimId(view, alts[0]!);
  }
  const hits = Object.values(view.claims).filter((c) => c.text.startsWith(opening));
  if (!hits.length) {
    // A claim this changeset rewords (see ClaimEdit.set.text): found by its new words too.
    const renamed = [...(view.renamed ?? new Map<string, string>())].filter(([text]) => text.startsWith(opening));
    if (renamed.length === 1) return renamed[0]![1];
    // A claim this changeset creates (see CopyEdit.newClaims): referred to by its @ref.
    const created = [...(view.newRefs ?? new Map<string, string>())].filter(([text]) => text.startsWith(opening));
    if (created.length === 1) return created[0]![1];
  }
  if (hits.length !== 1) throw new Error(`claim opening "${opening}" matches ${hits.length} claims on /${view.page.slug}`);
  return hits[0]!.id;
}

/**
 * Replaces {c:Opening words} placeholders, in strings and nested values, with
 * claim ids: as a Markdown link target, `]({c:…})` becomes `](claim:<id>)`.
 */
function resolve(value: unknown, view: PageViewJson): unknown {
  if (typeof value === "string")
    return value
      .replace(/\]\(\{c:([^}]+)\}\)/g, (_m, opening: string) => `](claim:${claimId(view, opening)})`)
      .replace(/\{c:([^}]+)\}/g, (_m, opening: string) => claimId(view, opening));
  if (Array.isArray(value)) return value.map((v) => resolve(v, view));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v, view)]));
  return value;
}

/** Applies `set` to a record: returns the touched fields before and after. */
function plan(current: Record<string, unknown>, set: Record<string, FieldValue>, view: PageViewJson) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(set)) {
    before[k] = current[k];
    const page: PageContext = {
      slug: (id) => Object.values(view.entities ?? {}).find((e) => e.id === id)?.slug,
      claim: (opening) => claimId(view, opening),
    };
    after[k] = resolve(typeof v === "function" ? (v as (c: unknown, p: PageContext) => unknown)(structuredClone(current[k]), page) : v, view);
  }
  return { before, after };
}

type Verdict = "change" | "done" | "conflict";

function judge(
  label: string,
  was: Was,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  view: PageViewJson,
  slugs: Map<string, string>,
  log: string[],
): Verdict {
  const now = fingerprint(before, view, slugs);
  if (now === fingerprint(after, view, slugs)) return "done";
  if (was === "*" || (Array.isArray(was) ? was : [was]).includes(now)) return "change";
  log.push(`${label}: changed since this edit was written (fingerprint ${now}, expected ${was}); left as it is`);
  return "conflict";
}

/** Entity slugs for every entity id the page mentions, so fingerprints do not depend on ids. */
function slugMap(view: PageViewJson): Map<string, string> {
  return new Map(Object.values(view.entities ?? {}).map((e) => [e.id, e.slug]));
}

async function propose(mcp: Mcp, spec: CopyEdit, printOnly: boolean): Promise<Proposal | null> {
  const view = await mcp.call<PageViewJson>("get_page", { page: spec.page, format: "json" }).catch((err: Error) => {
    console.log(`  /${spec.page}: ${err.message.split("\n")[0]}; skipped`);
    return null;
  });
  if (!view) return null;
  const created = spec.newClaims ? await spec.newClaims(mcp, view) : { ops: [], refs: new Map<string, string>() };
  view.newRefs = created.refs;
  view.renamed = new Map();
  for (const edit of spec.claims ?? []) {
    if (typeof edit.set.text !== "string") continue;
    const openings = [edit.claim, ...(edit.also ?? [])];
    const now = Object.values(view.claims).filter((c) => openings.some((o) => c.text.startsWith(o)) || c.text === edit.set.text);
    if (now.length === 1) view.renamed.set(edit.set.text, now[0]!.id);
  }
  const slugs = slugMap(view);
  const conflicts: string[] = [];
  const done: string[] = [];
  const changed: string[] = [];
  const blocks = view.page.blocks.map((b) => ({ ...b }));
  const byId = new Map(blocks.map((b, i) => [b.id, i]));

  for (const edit of spec.blocks) {
    const i = byId.get(edit.block);
    if (i === undefined) {
      conflicts.push(`block ${edit.block}: not on this page; skipped`);
      continue;
    }
    const { before, after } = plan(blocks[i]!, edit.set, view);
    if (printOnly) {
      console.log(`  block ${edit.block}: ${fingerprint(before, view, slugs)}`);
      continue;
    }
    const verdict = judge(`block ${edit.block}`, edit.was, before, after, view, slugs, conflicts);
    if (verdict === "done") done.push(edit.block);
    if (verdict !== "change") continue;
    blocks[i] = { ...blocks[i]!, ...after } as (typeof blocks)[number];
    Block.parse(blocks[i]);
    changed.push(`${edit.block}${edit.why ? ` (${edit.why})` : ""}`);
  }

  for (const ins of spec.inserts ?? []) {
    if (printOnly) continue;
    const block = resolve(ins.block, view) as BlockInput & { id: string };
    Block.parse(block);
    const existing = blocks.findIndex((b) => b.id === block.id);
    if (existing >= 0) {
      const same = fingerprint({ b: blocks[existing] }, view, slugs) === fingerprint({ b: block }, view, slugs);
      (same ? done : conflicts).push(same ? block.id : `block ${block.id}: already on the page with other content; left as it is`);
      continue;
    }
    const at = blocks.findIndex((b) => b.id === ins.after);
    if (at < 0) {
      conflicts.push(`block ${block.id}: no block ${ins.after} to insert after; skipped`);
      continue;
    }
    if (ins.moves) {
      const from = blocks.findIndex((b) => b.id === ins.moves!.from);
      const moving = new Set(ins.moves.claims.map((c) => claimId(view, c)));
      const src = blocks[from] as { claimIds?: string[] } | undefined;
      if (!src?.claimIds || ![...moving].every((id) => src.claimIds!.includes(id))) {
        conflicts.push(`block ${block.id}: ${ins.moves.from} no longer lists all the claims to move; skipped`);
        continue;
      }
      blocks[from] = { ...blocks[from]!, claimIds: src.claimIds.filter((id) => !moving.has(id)) } as (typeof blocks)[number];
    }
    blocks.splice(at + 1, 0, block as (typeof blocks)[number]);
    changed.push(`${block.id} (new${ins.why ? `: ${ins.why}` : ""})`);
  }

  for (const mv of printOnly ? [] : (spec.moves ?? [])) {
    const from = blocks.findIndex((b) => b.id === mv.block);
    const at = blocks.findIndex((b) => b.id === mv.after);
    if (from < 0 || at < 0) {
      conflicts.push(`move ${mv.block}: ${from < 0 ? mv.block : mv.after} is not on this page; skipped`);
      continue;
    }
    if (from === at + 1) {
      done.push(`move ${mv.block}`);
      continue;
    }
    const [moved] = blocks.splice(from, 1);
    blocks.splice(blocks.findIndex((b) => b.id === mv.after) + 1, 0, moved!);
    changed.push(`${mv.block} moved after ${mv.after}${mv.why ? ` (${mv.why})` : ""}`);
  }

  const ops: ChangeOpInput[] = [...created.ops];
  if (created.refs.size) changed.push(`${created.refs.size} new claims with their sources and excerpts`);
  // Only the blocks edited, inserted or moved, each guarded by a fingerprint of the block as read: edits of other blocks do not conflict.
  const pageOp = changed.length ? pagePatchOp(spec.page, view.page.blocks, blocks) : null;
  if (pageOp) ops.push(pageOp);

  for (const edit of [...(spec.claims ?? []), ...(spec.authors ?? []).map(authorEdit)]) {
    // Found by its opening words, or (once reworded) by its new text.
    const id =
      (edit.set.text && view.renamed?.get(edit.set.text)) ||
      [edit.claim, ...(edit.also ?? [])].map((o) => Object.values(view.claims).filter((c) => c.text.startsWith(o))).find((h) => h.length === 1)?.[0]!.id ||
      claimId(view, edit.claim);
    const claim = view.claims[id]!;
    const { before, after } = plan(claim as unknown as Record<string, unknown>, edit.set, view);
    if (printOnly) {
      console.log(`  claim "${edit.claim}": ${fingerprint(before, view, slugs)}`);
      continue;
    }
    const verdict = judge(`claim "${edit.claim}"`, edit.was, before, after, view, slugs, conflicts);
    if (verdict === "done") done.push(`claim "${edit.claim}"`);
    if (verdict !== "change") continue;
    // Role-only edits carry no baseVersion: they may follow another edit of the same claim in this changeset.
    const base = edit.was === "*" ? {} : { baseVersion: claim.version };
    ops.push({ op: "update_claim", claim: id, ...base, set: after } as ChangeOpInput);
    changed.push(`claim "${edit.claim}"${edit.why ? ` (${edit.why})` : ""}`);
  }

  for (const edit of spec.entities ?? []) {
    const detail = await mcp.call<EntityDetailJson>("get_entity", { entity: edit.entity });
    const { before, after } = plan(detail.entity, edit.set, view);
    if (printOnly) {
      console.log(`  entity ${edit.entity}: ${fingerprint(before, view, slugs)}`);
      continue;
    }
    const verdict = judge(`entity ${edit.entity}`, edit.was, before, after, view, slugs, conflicts);
    if (verdict === "done") done.push(`entity ${edit.entity}`);
    if (verdict !== "change") continue;
    ops.push({ op: "update_entity", entity: edit.entity, set: after } as ChangeOpInput);
    changed.push(`entity ${edit.entity}${edit.why ? ` (${edit.why})` : ""}`);
  }

  if (printOnly) return null;
  for (const c of conflicts) console.log(`  ${c}`);
  if (done.length) console.log(`  already done: ${done.length}`);
  if (!ops.length) {
    console.log(`  /${spec.page}: nothing to change (version ${view.page.version})`);
    return null;
  }
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: spec.title,
    rationale: [
      ...spec.rationale,
      spec.authors?.length
        ? "People named on a claim only as the writer or speaker of its source (a witness or commentator, not an actor) now have the role “author” on it, so a chapter's “Who wrote about it” lists them."
        : "",
      `Against page version ${view.page.version}. Changed: ${changed.join("; ")}.`,
      conflicts.length ? `Left alone because they changed since: ${conflicts.join("; ")}.` : "",
      "Claims keep what they assert, their citations and their quotations: claim texts are only reworded to gloss a term. Every other block is kept as it is.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    ops,
  });
  summarize(spec.title, proposal);
  return proposal;
}

/** Proposes one changeset per spec (pages in order), each against the page as it is right then. */
export async function runCopyEdit(...specs: CopyEdit[]): Promise<void> {
  const flags = parseFlags();
  const printOnly = process.argv.includes("--fingerprints");
  const mcp = await connectMcp("pramana-seed");
  try {
    const pending = printOnly || flags.force ? [] : await pendingTitles(mcp);
    const proposals: Proposal[] = [];
    for (const spec of specs) {
      if (pending.includes(spec.title)) {
        console.log(`  "${spec.title}" is already waiting for review`);
        continue;
      }
      // Re-read right before proposing (inside propose): other changesets edit this page too.
      const proposal = await propose(mcp, spec, printOnly);
      if (proposal) proposals.push(proposal);
    }
    if (proposals.length) await finish(mcp, flags, proposals);
  } finally {
    await mcp.close();
    await closeDbIfOpen(flags);
  }
}
