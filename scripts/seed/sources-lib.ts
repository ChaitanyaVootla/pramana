/**
 * Shared machinery for new evidence proposed with a page's copy edit (see
 * CopyEdit.newClaims in ./copyedit-lib.ts): sources found on the platform by
 * exact title or created, snapshots captured at run time, and excerpts,
 * claims and citations for every claim not yet on the page. Each page's data
 * is in sources-<page>.ts.
 */
import type { ChangeOpInput } from "@pramana/core";
import type { BlockEdit, Mcp, PageContext, PageViewJson } from "./copyedit-lib";

type Origin =
  | { kind: "internet_archive"; identifier: string }
  | { kind: "wikipedia"; title: string }
  | { kind: "url"; url: string };

export interface SnapshotSummary {
  id: string;
  url: string | null;
  title: string | null;
  meta: { wikipedia?: { revisionId: number; title: string } };
}

/** A source: found on the platform by its exact title, or created. */
export interface SourceSpec {
  title: string;
  origin: Origin;
  /** create_source fields (without op/ref) for when it is not on the platform yet. */
  create?: (snap: SnapshotSummary) => Record<string, unknown>;
}

export interface ExcerptSpec {
  source: string;
  quote: string;
  locator: Record<string, string>;
  stance?: "supports" | "qualifies" | "mentions";
  note?: string;
}

export interface ClaimSpec {
  ref: string;
  /** The claims block on the page that lists it. */
  block: string;
  text: string;
  kind: "fact" | "interpretation";
  assessment: "supported" | "well_supported";
  assessmentNote?: string;
  when?: Record<string, unknown>;
  themes?: string[];
  entities: { entity: string; role: "subject" | "place" | "participant" | "author" | "mention" }[];
  excerpts: ExcerptSpec[];
}

/** A Wikipedia article as a tertiary source, pinned to the captured revision. */
export const wikipedia = (title: string): SourceSpec => ({
  title,
  origin: { kind: "wikipedia", title },
  create: (snap) => {
    const url = snap.url ?? undefined;
    return {
      kind: "wiki_article",
      tier: "tertiary",
      csl: { type: "entry-encyclopedia", title, "container-title": "Wikipedia", issued: { "date-parts": [[2026]] }, ...(url ? { URL: url } : {}) },
      identifiers: {
        ...(url ? { url } : {}),
        wikipedia: { lang: "en", title, revisionId: snap.meta.wikipedia!.revisionId },
      },
      license: { status: "open", spdx: "CC-BY-SA-4.0" },
    };
  },
});

interface SearchResults {
  sources: { id: string; title: string }[];
}

/** The ops for every claim here not yet on the page, and each new claim's text with its @ref. */
export async function newClaimOps(SOURCES: Record<string, SourceSpec>, CLAIMS: ClaimSpec[], mcp: Mcp, view: PageViewJson): Promise<{ ops: ChangeOpInput[]; refs: Map<string, string> }> {
  const onPage = new Set(Object.values(view.claims).map((c) => c.text));
  const todo = CLAIMS.filter((c) => !onPage.has(c.text));
  const ops: ChangeOpInput[] = [];
  const refs = new Map<string, string>();
  if (!todo.length) return { ops, refs };

  const needed = new Set(todo.flatMap((c) => c.excerpts.map((x) => x.source)));
  const snaps: Record<string, SnapshotSummary> = {};
  const sourceRef: Record<string, string> = {};
  for (const key of needed) {
    const spec = SOURCES[key];
    if (!spec) throw new Error(`no source ${key}`);
    const snap = await mcp.call<SnapshotSummary>("capture_snapshot", { origin: spec.origin });
    snaps[key] = snap;
    const found = await mcp.call<SearchResults>("search", { query: spec.title, types: ["sources"], limit: 10 });
    const existing = found.sources.find((s) => s.title === spec.title);
    if (existing) {
      sourceRef[key] = existing.id;
      continue;
    }
    if (!spec.create) throw new Error(`source “${spec.title}” is not on the platform, and there is nothing to create it from`);
    ops.push({ op: "create_source", ref: `s_${key}`, ...spec.create(snap) } as ChangeOpInput);
    sourceRef[key] = `@s_${key}`;
  }

  for (const c of todo) {
    c.excerpts.forEach((x, i) =>
      ops.push({
        op: "create_excerpt",
        ref: `${c.ref}_x${i}`,
        source: sourceRef[x.source]!,
        snapshotId: snaps[x.source]!.id,
        quote: x.quote,
        locator: x.locator,
        ...(x.note ? { note: x.note } : {}),
      } as ChangeOpInput),
    );
    ops.push({
      op: "create_claim",
      ref: c.ref,
      text: c.text,
      kind: c.kind,
      assessment: c.assessment,
      ...(c.assessmentNote ? { assessmentNote: c.assessmentNote } : {}),
      ...(c.when ? { when: c.when } : {}),
      ...(c.themes ? { themes: c.themes } : {}),
      ...(c.entities.length ? { entities: c.entities } : {}),
    } as ChangeOpInput);
    c.excerpts.forEach((x, i) =>
      ops.push({ op: "cite", claim: `@${c.ref}`, excerpt: `@${c.ref}_x${i}`, stance: x.stance ?? "supports", ...(x.note ? { note: x.note } : {}) } as ChangeOpInput),
    );
    refs.set(c.text, `@${c.ref}`);
  }
  return { ops, refs };
}

/** Block edits listing each new claim, once, in its chapter's claims block. */
export function listNewClaims(CLAIMS: ClaimSpec[]): BlockEdit[] {
  return [...new Set(CLAIMS.map((c) => c.block))].map((block) => ({
    block,
    // Only appends, so concurrent edits to the list are kept.
    was: "*",
    why: "new claims listed",
    set: {
      claimIds: (ids: string[], page: PageContext) => {
        const add = CLAIMS.filter((c) => c.block === block).map((c) => page.claim(c.text.slice(0, 50)));
        return add.every((id) => ids.includes(id)) ? ids : [...ids, ...add.filter((id) => !ids.includes(id))];
      },
    },
  }));
}

/**
 * A fix to an existing claim's evidence, after a support check: excerpts to
 * add (from a source and snapshot already used on the page, named by the
 * opening words of an excerpt there) and citations to withdraw (named by the
 * opening words of their quote). Applied once: an excerpt already cited on
 * the claim, or a citation already gone, is skipped.
 */
export interface EvidenceFix {
  /** Opening words of the claim. */
  claim: string;
  add?: {
    /** Opening words of an excerpt on the page from the same source and snapshot. */
    like: string;
    quote: string;
    locator: Record<string, string>;
    stance?: "supports" | "contradicts" | "qualifies" | "mentions";
    note?: string;
  }[];
  /** Opening words of quotes whose citations on this claim are withdrawn (superseded or mislocated). */
  drop?: string[];
  why: string;
}

type ClaimWithCitations = {
  id: string;
  text: string;
  citations: { id: string; stance: string; excerpt: { id: string; quote: string | null; snapshotId: string | null; source: { id: string } } }[];
};

/** The ops for the evidence fixes not yet applied. */
export function evidenceFixOps(FIXES: EvidenceFix[], view: PageViewJson): ChangeOpInput[] {
  const claims = Object.values(view.claims) as unknown as ClaimWithCitations[];
  const excerpts = claims.flatMap((c) => c.citations.map((ci) => ci.excerpt));
  const ops: ChangeOpInput[] = [];
  FIXES.forEach((fix, f) => {
    const hits = claims.filter((c) => c.text.startsWith(fix.claim));
    if (hits.length !== 1) throw new Error(`fix: claim opening "${fix.claim}" matches ${hits.length} claims`);
    const claim = hits[0]!;
    fix.add?.forEach((a, i) => {
      if (claim.citations.some((ci) => ci.excerpt.quote === a.quote)) return;
      const like = excerpts.find((x) => x.quote?.startsWith(a.like));
      if (!like?.snapshotId) throw new Error(`fix: no excerpt on the page starts “${a.like}”`);
      const ref = `fix${f}_x${i}`;
      ops.push({
        op: "create_excerpt",
        ref,
        source: like.source.id,
        snapshotId: like.snapshotId,
        quote: a.quote,
        locator: a.locator,
        ...(a.note ? { note: a.note } : {}),
      } as ChangeOpInput);
      ops.push({ op: "cite", claim: claim.id, excerpt: `@${ref}`, stance: a.stance ?? "supports", ...(a.note ? { note: a.note } : {}) } as ChangeOpInput);
    });
    for (const d of fix.drop ?? [])
      for (const ci of claim.citations.filter((c) => c.excerpt.quote?.startsWith(d) && !fix.add?.some((x) => x.quote === c.excerpt.quote)))
        ops.push({ op: "uncite", citation: ci.id } as ChangeOpInput);
  });
  return ops;
}
