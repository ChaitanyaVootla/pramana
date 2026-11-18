/**
 * Shared machinery for the media seed scripts (media-maurya.ts,
 * media-independence.ts). Each script lists hand-checked Commons files with
 * the editorial fields only we can give (title, alt text, what the picture is,
 * what it depicts); the licence, author, URLs and credit line always come from
 * the Commons API, fetched by the MCP server when it proposes the media.
 *
 * Two changesets per page:
 *   1. "media": create_media for every file not yet on the platform.
 *   2. "page": patch_page adding figure and gallery blocks after given
 *      blocks, and the lead image (spec.hero.media). It depends on (1).
 * Both are idempotent: files already on the platform (or pending) are reused,
 * and blocks whose ids already exist on the page are left alone.
 *
 * Flags (with those of ../lib/proposal.ts):
 *   --media-only   propose only the media changeset (no page edit)
 *   --depends-on=<id>  a pending changeset creating entities the pictures depict
 */
import type { BlockInput, ChangeOpInput, DateInput, MediaFocus, Representation } from "@pramana/core";
import type { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { finish, parseFlags, pendingTitles, summarize, type Flags, type Proposal } from "../lib/proposal";

type Mcp = Awaited<ReturnType<typeof connectMcp>>;

export interface Pick {
  file: string;
  ref: string;
  title: string;
  alt: string;
  representation: Representation;
  representationNote?: string;
  objectDate?: DateInput;
  /** Entity slugs. */
  depicts?: string[];
  focus?: MediaFocus;
  /**
   * For public-domain files: the Commons licence tags must show the file is
   * free in the United States too (Commons should only host files free in both
   * the source country and the US, but tags are sometimes wrong or missing).
   */
  needsUsBasis?: boolean;
  /** When the tags do not state a US status but the facts do: the reasoning, shown to the reviewer. */
  usBasis?: string;
}

/** A figure or gallery to insert after an existing block. Captions use {claim:prefix} placeholders. */
export interface Placement {
  after: string;
  block:
    | { id: string; type: "figure"; media: string; caption: string; size?: "inline" | "wide" }
    | { id: string; type: "gallery"; title?: string; items: { media: string; caption?: string }[] };
}

export interface PageViewLite {
  page: {
    id: string;
    slug: string;
    version: number;
    blocks: ({ id: string; type: string } & Record<string, unknown>)[];
    spec: Record<string, unknown> & { hero?: { media?: string; panels?: string[] } };
    hasSpec: boolean;
  };
  claims: Record<string, { id: string; text: string }>;
}

interface CommonsFileView {
  fileTitle: string;
  license: { ok: true; shortName: string; family: string } | { ok: false; reason: string };
  artist: string | null;
  licenseTags: string[];
  categories: string[];
}

type MediaMatch = { status: "existing" | "pending"; id: string; changesetId?: string };

export const flags: Flags & { mediaOnly: boolean; dependsOn: string[] } = {
  ...parseFlags(),
  mediaOnly: process.argv.includes("--media-only"),
  // --depends-on=<changeset id>: a pending changeset that creates entities the pictures depict.
  dependsOn: process.argv.flatMap((a) => (a.startsWith("--depends-on=") ? [a.slice("--depends-on=".length)] : [])),
};

/**
 * Commons licence categories that state a US status: PD-US-*, PD-1996 (public
 * domain at home on 1 January 1996, so not restored in the US), and
 * PD-old-100 (made so long ago that it is free everywhere). Maintenance
 * categories ("… missing SDC copyright status") say nothing and are ignored.
 */
const US_FREE = /^(PD[- ]US(?![- ]missing)|PD[- ]1996|PD[- ]old[- ]100|PD-Art \(PD-old-100)/i;

export function usBasisTags(categories: string[]): string[] {
  return categories.filter((c) => !/missing SDC/i.test(c) && US_FREE.test(c));
}

/**
 * Checks each pick against Commons before anything is proposed: the file
 * exists, its licence is accepted, and public-domain files that need it have
 * a US basis in their licence tags. Throws listing every problem.
 */
export async function checkPicks(mcp: Mcp, picks: Pick[]): Promise<void> {
  const problems: string[] = [];
  for (let i = 0; i < picks.length; i += 50) {
    const batch = picks.slice(i, i + 50);
    const res = await mcp.call<{ files: CommonsFileView[]; missing: string[] }>("commons_files", {
      fileTitles: batch.map((p) => p.file),
    });
    for (const m of res.missing) problems.push(`missing on Commons: ${m}`);
    const byTitle = new Map(res.files.map((f) => [f.fileTitle, f]));
    for (const pick of batch) {
      const f = byTitle.get(normalize(pick.file));
      if (!f) continue;
      if (!f.license.ok) problems.push(`${pick.file}: licence refused (${f.license.reason})`);
      else if (pick.needsUsBasis && f.license.family === "public_domain" && !usBasisTags(f.categories).length && !pick.usBasis)
        problems.push(`${pick.file}: public domain, but no US status among its tags (${f.licenseTags.join("; ") || "none"})`);
      else console.log(`  ok  ${pick.ref}: ${f.license.shortName}${f.licenseTags.length ? ` [${f.licenseTags.join("; ")}]` : ""}`);
    }
  }
  if (problems.length) throw new Error(`picks failed checks:\n  ${problems.join("\n  ")}`);
}

function normalize(title: string): string {
  const bare = title.replace(/_/g, " ").replace(/^(File|Image):/i, "").trim();
  return `File:${bare.charAt(0).toUpperCase()}${bare.slice(1)}`;
}

/** Proposes the media changeset; returns the media id for each pick's ref and the changesets to depend on. */
/** Lines for the rationale: each public-domain pick and the basis for its US status. */
export function usBasisNotes(picks: Pick[]): string {
  const notes = picks.filter((p) => p.usBasis).map((p) => `- ${p.file}: ${p.usBasis}`);
  return notes.length ? `US status not stated by Commons tags, reasoned instead:\n${notes.join("\n")}` : "";
}

/** propose_media takes at most this many files; larger sets are split into numbered changesets. */
const MEDIA_BATCH = 40;

export async function proposeMedia(
  mcp: Mcp,
  title: string,
  rationale: string,
  picks: Pick[],
): Promise<{ ids: Map<string, string>; dependsOn: string[]; proposals: Proposal[] }> {
  const known = await mcp.call<Record<string, MediaMatch>>("media_by_file", { fileTitles: picks.map((p) => p.file) });
  const fresh = picks.filter((p) => !known[normalize(p.file)]);
  const proposals: Proposal[] = [];
  const refs: Record<string, string> = {};
  if (fresh.length) {
    // Files added after a first proposal go in a follow-up changeset with its own title.
    const base = fresh.length < picks.length ? `${title}: ${fresh.length} more` : title;
    const batches = Math.ceil(fresh.length / MEDIA_BATCH);
    const pending = flags.force ? [] : await pendingTitles(mcp);
    for (let b = 0; b < batches; b++) {
      const batchTitle = batches > 1 ? `${base} (part ${b + 1} of ${batches})` : base;
      if (pending.includes(batchTitle))
        throw new Error(`a changeset titled "${batchTitle}" is pending but does not cover every file; withdraw it or use --force`);
      const batch = fresh.slice(b * MEDIA_BATCH, (b + 1) * MEDIA_BATCH);
      const proposal = await mcp.call<Proposal>("propose_media", {
        title: batchTitle,
        rationale,
        ...(flags.dependsOn.length ? { dependsOn: flags.dependsOn } : {}),
        items: batch.map((p) => ({
          fileTitle: p.file,
          ref: p.ref,
          title: p.title,
          alt: p.alt,
          representation: p.representation,
          ...(p.representationNote ? { representationNote: p.representationNote } : {}),
          ...(p.objectDate ? { objectDate: p.objectDate } : {}),
          ...(p.depicts?.length ? { depicts: p.depicts } : {}),
          ...(p.focus ? { focus: p.focus } : {}),
        })),
      });
      summarize(batchTitle, proposal);
      proposals.push(proposal);
      Object.assign(refs, proposal.refs);
    }
  } else {
    console.log(`  all ${picks.length} files are already on the platform or pending`);
  }
  const ids = new Map<string, string>();
  const dependsOn = new Set<string>();
  for (const p of picks) {
    const match = known[normalize(p.file)];
    if (match) {
      ids.set(p.ref, match.id);
      if (match.status === "pending" && match.changesetId) dependsOn.add(match.changesetId);
    } else {
      const id = refs[p.ref];
      if (!id) throw new Error(`no id for ${p.ref}`);
      ids.set(p.ref, id);
    }
  }
  for (const p of proposals) dependsOn.add(p.id);
  return { ids, dependsOn: [...dependsOn], proposals };
}

/** Replaces {claim:Text prefix} with the claim's id on the live page. Throws if a prefix matches no claim, or several. */
export function claimLinks(text: string, view: PageViewLite): string {
  return text.replace(/\{claim:([^}]+)\}/g, (_, prefix: string) => {
    const hits = Object.values(view.claims).filter((c) => c.text.startsWith(prefix));
    if (hits.length !== 1) throw new Error(`claim prefix "${prefix}" matches ${hits.length} claims on /${view.page.slug}`);
    return `claim:${hits[0]!.id}`;
  });
}

/** The patch_page op inserting the placements (skipping blocks already there) and setting the lead image. */
/** Same content, ignoring key order and fields left at their defaults. */
function sameBlock(a: BlockInput, b: BlockInput): boolean {
  const norm = (x: unknown): unknown =>
    Array.isArray(x)
      ? x.map(norm)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.entries(x)
              .filter(([, v]) => v !== undefined)
              .sort(([k1], [k2]) => k1.localeCompare(k2))
              .map(([k, v]) => [k, norm(v)]),
          )
        : x;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

export function pageOp(
  view: PageViewLite,
  ids: Map<string, string>,
  placements: Placement[],
  hero: string | null,
  retired: string[] = [],
): ChangeOpInput | null {
  const id = (ref: string) => {
    const v = ids.get(ref);
    if (!v) throw new Error(`unknown media ref ${ref}`);
    return v;
  };
  const present = new Set(view.page.blocks.map((b) => b.id));
  const resolve = (block: Placement["block"]): BlockInput =>
    block.type === "figure"
      ? { ...block, size: block.size ?? "inline", media: id(block.media), caption: claimLinks(block.caption, view) }
      : {
          ...block,
          items: block.items.map((i) => ({
            media: id(i.media),
            ...(i.caption ? { caption: claimLinks(i.caption, view) } : {}),
          })),
        };
  // Removing retired blocks and rewriting changed ones only touches blocks this script owns.
  let blocks = (view.page.blocks as BlockInput[]).filter((b) => !retired.includes(b.id));
  let changed = blocks.length !== view.page.blocks.length;
  for (const { after, block } of placements) {
    const next = resolve(block);
    const at = blocks.findIndex((b) => b.id === block.id);
    if (at >= 0) {
      if (!sameBlock(blocks[at]!, next)) {
        blocks = blocks.map((b, i) => (i === at ? next : b));
        changed = true;
      }
      continue;
    }
    const anchor = blocks.findIndex((b) => b.id === after);
    if (anchor < 0) throw new Error(`block "${after}" not found on /${view.page.slug}`);
    blocks.splice(anchor + 1, 0, next);
    changed = true;
  }
  const added = changed;
  const heroId = hero ? id(hero) : null;
  const spec = view.page.spec;
  const heroChanged = heroId !== null && spec.hero?.media !== heroId;
  if (!added && !heroChanged) return null;
  // Only the blocks and the spec key this script changes, so other pending edits of the page do not conflict.
  return pagePatchOp(
    view.page.slug,
    view.page.blocks,
    blocks,
    heroChanged ? { before: spec, after: { ...spec, hero: { ...(spec.hero ?? {}), media: heroId! } }, paths: ["hero.media"] } : undefined,
  );
}

/** Runs the whole flow for one page. */
export async function seedPageMedia(
  mcp: Mcp,
  options: {
    page: string;
    mediaTitle: string;
    mediaRationale: string;
    pageTitle: string;
    pageRationale: string;
    picks: Pick[];
    placements: Placement[];
    hero: string | null;
    /** Block ids this script added earlier and has since dropped. */
    retired?: string[];
  },
): Promise<void> {
  const refs = new Set(options.picks.map((p) => p.ref));
  for (const p of options.placements) {
    const used = p.block.type === "figure" ? [p.block.media] : p.block.items.map((i) => i.media);
    for (const r of used) if (!refs.has(r)) throw new Error(`placement ${p.block.id} uses unknown media ${r}`);
  }
  console.log(`Checking ${options.picks.length} files on Commons…`);
  await checkPicks(mcp, options.picks);
  const { ids, dependsOn, proposals } = await proposeMedia(mcp, options.mediaTitle, options.mediaRationale, options.picks);
  if (!flags.mediaOnly) {
    const view = await mcp.call<PageViewLite>("get_page", { page: options.page, format: "json" });
    const op = pageOp(view, ids, options.placements, options.hero, options.retired);
    if (!op) console.log(`  /${options.page} already has these pictures`);
    else if (!flags.force && (await pendingTitles(mcp)).includes(options.pageTitle))
      console.log(`  "${options.pageTitle}" is already waiting for review`);
    else {
      const p = await mcp.call<Proposal>("propose_changes", {
        title: options.pageTitle,
        rationale: options.pageRationale,
        dependsOn,
        ops: [op],
      });
      summarize(options.pageTitle, p);
      proposals.push(p);
    }
  }
  await finish(mcp, flags, proposals);
}
