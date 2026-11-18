/**
 * A small kit for follow-up changesets that fix claims and citations on one
 * page after the support checks: reword part of a claim, change a citation's
 * stance, uncite, add a new excerpt from a fresh snapshot, or cite an
 * existing excerpt by ref.
 *
 * Claims are found by their current text (a prefix first, then a substring),
 * so edits by others are kept. The page is read as it is now, with the ops of
 * any still-proposed changesets it depends on replayed on top, so a fix can
 * follow an earlier fix that is not yet approved. Every helper skips work that
 * is already done, so scripts built on it can be re-run.
 */
import type { ChangeOpInput } from "@pramana/core";
import type { connectMcp } from "./mcp-client";

type Mcp = Awaited<ReturnType<typeof connectMcp>>;
export type Stance = "supports" | "qualifies" | "contradicts" | "mentions";
export type Loc = { volume?: string; page?: string; chapter?: string; section?: string; verse?: string; line?: string; label?: string };

interface Citation {
  id: string;
  stance: string;
  note: string | null;
  excerpt: { id: string; quote: string | null };
}
export interface ClaimView {
  id: string;
  text: string;
  assessmentNote?: string | null;
  citations: Citation[];
}

/** Finds changesets by title (every one with that title, e.g. a re-run's delta); throws if a title has none. */
export async function changesetsByTitle(mcp: Mcp, titles: string[]): Promise<{ id: string; status: string }[]> {
  // The tool returns at most 200 of the most recent, so ask for each status separately.
  type Row = { id: string; title: string; status: string };
  const list = [
    ...(await mcp.call<Row[]>("list_changesets", { status: ["proposed"], limit: 200 })),
    ...(await mcp.call<Row[]>("list_changesets", { status: ["applied"], limit: 200 })),
  ];
  return titles.flatMap((t) => {
    const found = list.filter((x) => x.title === t);
    if (!found.length) throw new Error(`no changeset “${t}”`);
    return found;
  });
}

/**
 * Whether a changeset with this title is already waiting for review or
 * applied. A fix script is one correction: once applied, later scripts own
 * the claims it touched, so running it again must do nothing (otherwise it
 * would re-add what a later fix deliberately removed).
 */
export async function alreadyProposedOrApplied(mcp: Mcp, title: string): Promise<"proposed" | "applied" | null> {
  type Row = { title: string };
  if ((await mcp.call<Row[]>("list_changesets", { status: ["proposed"], limit: 200 })).some((x) => x.title === title)) return "proposed";
  if ((await mcp.call<Row[]>("list_changesets", { status: ["applied"], limit: 200 })).some((x) => x.title === title)) return "applied";
  return null;
}

/** The page's claims now, with the ops of still-proposed changesets replayed on top. */
async function claimsView(mcp: Mcp, slug: string, depends: { id: string; status: string }[]): Promise<ClaimView[]> {
  type Op = Record<string, unknown> & { op: string; id?: string };
  const page = await mcp.call<{ claims: Record<string, ClaimView> }>("get_page", { page: slug, format: "json" }).catch(() => ({ claims: {} }));
  const byId: Record<string, ClaimView> = {};
  for (const c of Object.values(page.claims)) byId[c.id] = { ...c, citations: [...c.citations] };
  const quotes: Record<string, string | null> = {};
  // Ids are time-ordered, so this replays the changesets in the order they were proposed.
  for (const d of depends.filter((x) => x.status === "proposed").sort((a, b) => a.id.localeCompare(b.id))) {
    const cs = await mcp.call<{ ops: Op[] }>("get_changeset", { id: d.id });
    for (const o of cs.ops) {
      if (o.op === "create_claim") byId[o.id!] = { id: o.id!, text: o.text as string, assessmentNote: (o.assessmentNote as string | undefined) ?? null, citations: [] };
      else if (o.op === "create_excerpt") quotes[o.id!] = (o.quote as string | undefined) ?? null;
      else if (o.op === "cite" && byId[o.claim as string])
        byId[o.claim as string]!.citations.push({ id: o.id!, stance: o.stance as string, note: (o.note as string | undefined) ?? null, excerpt: { id: o.excerpt as string, quote: quotes[o.excerpt as string] ?? null } });
      else if (o.op === "uncite") for (const c of Object.values(byId)) c.citations = c.citations.filter((x) => x.id !== o.citation);
      else if (o.op === "update_claim" && byId[o.claim as string]) {
        const set = o.set as { text?: string; assessmentNote?: string | null };
        if (set.text) byId[o.claim as string]!.text = set.text;
        if (set.assessmentNote !== undefined) byId[o.claim as string]!.assessmentNote = set.assessmentNote;
      }
    }
  }
  return Object.values(byId);
}

export async function claimFixes<K extends string>(mcp: Mcp, opts: { slug: string; depends: { id: string; status: string }[]; captures: Record<K, unknown> }) {
  const snap = {} as Record<K, string>;
  for (const [k, origin] of Object.entries(opts.captures) as [K, unknown][]) snap[k] = (await mcp.call<{ id: string }>("capture_snapshot", { origin })).id;
  const claims = await claimsView(mcp, opts.slug, opts.depends);
  const ops: ChangeOpInput[] = [];
  const log: string[] = [];

  const matches = (key: string) => {
    const starts = claims.filter((c) => c.text.startsWith(key));
    return starts.length ? starts : claims.filter((c) => c.text.includes(key));
  };
  const claim = (key: string) => {
    const hits = matches(key);
    if (hits.length !== 1) throw new Error(`claim “${key}”: ${hits.length} matches`);
    return hits[0]!;
  };
  type UpdateClaim = Extract<ChangeOpInput, { op: "update_claim" }>;
  const pendingUpdate = (id: string) => ops.find((o): o is UpdateClaim => o.op === "update_claim" && o.claim === id);
  /**
   * Rewords part of a claim's text; skips if already done. Several rewords of
   * one claim share one op, and later lookups see the new text.
   */
  const reword = (key: string, from: string, to: string) => {
    // On a re-run the key may be the very words that were reworded away.
    const c = matches(key).length ? claim(key) : claim(to);
    if (c.text.includes(to) && !c.text.includes(from)) return;
    if (!c.text.includes(from)) throw new Error(`claim “${key}” no longer contains “${from}”`);
    c.text = c.text.replace(from, to);
    const prior = pendingUpdate(c.id);
    if (prior) prior.set.text = c.text;
    else ops.push({ op: "update_claim", claim: c.id, set: { text: c.text } });
    log.push(`reword: ${key}`);
  };
  /** Replaces the assessment note (null removes it), unless it already reads so. */
  const setNote = (key: string, note: string | null) => {
    const c = claim(key);
    if ((c.assessmentNote ?? null) === note) return;
    const prior = pendingUpdate(c.id);
    if (prior) prior.set.assessmentNote = note;
    else ops.push({ op: "update_claim", claim: c.id, set: { assessmentNote: note } });
    log.push(`note: ${key}`);
  };
  /** Changes a citation's stance (uncite, then cite again with the new stance and note). */
  const restance = (key: string, quotePrefix: string, stance: Stance, note?: string) => {
    const c = claim(key);
    const cit = c.citations.find((x) => x.excerpt.quote?.startsWith(quotePrefix));
    if (!cit) throw new Error(`claim “${key}”: no citation of “${quotePrefix}”`);
    if (cit.stance === stance && (note === undefined || cit.note === note)) return;
    ops.push({ op: "uncite", citation: cit.id });
    ops.push({ op: "cite", claim: c.id, excerpt: cit.excerpt.id, stance, ...((note ?? cit.note) ? { note: note ?? cit.note! } : {}) });
    log.push(`stance ${cit.stance} → ${stance}: ${key} / ${quotePrefix.slice(0, 40)}`);
  };
  /** Removes the claim's citation of exactly this quote, if it has one. */
  const uncite = (key: string, quote: string) => {
    const c = claim(key);
    const cit = c.citations.find((x) => x.excerpt.quote === quote);
    if (!cit) return;
    ops.push({ op: "uncite", citation: cit.id });
    log.push(`uncite: ${key} / ${quote.slice(0, 40)}`);
  };
  /** Adds an excerpt (new, from a snapshot) and cites it, unless the claim already cites that quote or a longer one containing it. */
  const add = (key: string, ref: string, source: string, k: K, quote: string, locator: Loc, stance: Stance = "supports", note?: string, citeNote?: string) => {
    const c = claim(key);
    if (c.citations.some((x) => x.excerpt.quote?.includes(quote))) return;
    if (!ops.some((o) => o.op === "create_excerpt" && (o as { ref?: string }).ref === ref))
      ops.push({ op: "create_excerpt", ref, source, snapshotId: snap[k], quote, locator, ...(note ? { note } : {}) } as ChangeOpInput);
    ops.push({ op: "cite", claim: c.id, excerpt: `@${ref}`, stance, ...(citeNote ? { note: citeNote } : {}) });
    log.push(`add ${ref} → ${key}`);
  };
  /** Cites an excerpt that already exists (by ref from an earlier changeset), unless the claim already cites its quote. */
  const citeRef = (key: string, ref: string, stance: Stance, quote: string, note?: string) => {
    const c = claim(key);
    if (c.citations.some((x) => x.excerpt.quote === quote)) return;
    ops.push({ op: "cite", claim: c.id, excerpt: `@${ref}`, stance, ...(note ? { note } : {}) });
    log.push(`cite ${ref} → ${key}`);
  };
  return { claims, claim, ops, log, reword, setNote, restance, uncite, add, citeRef };
}
