import { z } from "zod";
import { Block, BlockId, longestIncreasing } from "./blocks";

/**
 * Block-level page edits (the `patch_page` op). Instead of replacing a page's
 * whole block list against the page's version, a patch names the blocks it
 * touches, each guarded by a fingerprint of that block as the proposer saw it.
 * Two pending patches of the same page conflict only if they touch the same
 * block (or spec key), so they can be approved in any order.
 */

/* ------------------------------------------------------------------ fingerprints */

/** JSON with object keys sorted and undefined values left out, so equal content gives equal text. */
export function canonicalJson(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map((x) => (x === undefined ? null : norm(x)));
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v)
          .filter(([, x]) => x !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, x]) => [k, norm(x)]),
      );
    return v;
  };
  return JSON.stringify(norm(value) ?? null);
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** SHA-256 of a string's UTF-8 bytes, as hex. Synchronous and dependency-free, so it runs in the browser too. */
export function sha256Hex(text: string): string {
  const data = new TextEncoder().encode(text);
  const bits = data.length * 8;
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bits / 2 ** 32));
  view.setUint32(padded.length - 4, bits >>> 0);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = w[i - 16]! + s0 + w[i - 7]! + s1;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[];
    for (let i = 0; i < 64; i++) {
      const t1 = (hh! + (rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25)) + ((e! & f!) ^ (~e! & g!)) + K[i]! + w[i]!) >>> 0;
      const t2 = ((rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22)) + ((a! & b!) ^ (a! & c!) ^ (b! & c!))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d! + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    [a, b, c, d, e, f, g, hh].forEach((x, i) => (h[i] = h[i]! + x!));
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}

/** A stable fingerprint of any JSON value: the first 16 hex digits of the SHA-256 of its canonical JSON. */
export function fingerprint(value: unknown): string {
  return sha256Hex(canonicalJson(value)).slice(0, 16);
}

/** Fingerprint of a block's stored JSON: what a patch's `was` names. */
export function blockFingerprint(block: unknown): string {
  return fingerprint(block);
}

/* ------------------------------------------------------------------ schema */

export const Fingerprint = z.string().regex(/^[0-9a-f]{16}$/, "a fingerprint: 16 hex digits (blockFingerprint)");

/** Where an inserted or moved block goes: after a block, at the start (null), or at the end. */
export const PatchAnchor = z.union([z.literal("end"), BlockId, z.null()]);
export type PatchAnchor = z.infer<typeof PatchAnchor>;

/** A spec key, or one key inside it: "atlas", "hero.media", "rail.panels". */
export const SpecPath = z
  .string()
  .regex(/^(hero|rail|atlas|timeline|outline)(\.[a-z][a-zA-Z]{0,39})?$/, 'a spec key or "key.subkey", e.g. "hero.media"');

export const SpecPatchEntry = z
  .object({
    path: SpecPath,
    /** Fingerprint of the value at `path` (with defaults filled in) when the edit was made; omit to set it regardless. */
    was: Fingerprint.optional(),
    /** The new value; null removes the key. The whole spec is validated afterwards. */
    value: z.unknown(),
  })
  .refine((e) => e.value !== undefined, { message: "give a value (null removes the key)" });

export const PagePatchFields = {
  /** Spec keys to set, each guarded by its own fingerprint. Other keys are kept. */
  spec: z.array(SpecPatchEntry).max(20).optional(),
  /** Blocks to remove; a block already gone is left alone. */
  remove: z.array(z.object({ id: BlockId, was: Fingerprint })).max(400).optional(),
  /** Blocks to rewrite in place. Conflicts only if that block changed since `was`. */
  replace: z
    .array(z.object({ id: BlockId, was: Fingerprint, block: Block }))
    .max(400)
    .superRefine((items, ctx) =>
      items.forEach((r, i) => {
        if (r.block.id !== r.id)
          ctx.addIssue({ code: "custom", path: [i, "block", "id"], message: `the new block keeps its id ("${r.id}")` });
      }),
    )
    .optional(),
  /** New blocks, in order. A block whose id is already on the page with the same content is left alone. */
  insert: z.array(z.object({ after: PatchAnchor, block: Block })).max(400).optional(),
  /** Blocks to move, unchanged, in order (after the inserts). */
  move: z.array(z.object({ id: BlockId, after: PatchAnchor })).max(400).optional(),
};

export const PagePatch = z.object(PagePatchFields);
export type PagePatch = z.infer<typeof PagePatch>;
export type PagePatchInput = z.input<typeof PagePatch>;

/* ------------------------------------------------------------------ applying */

type WithId = { id: string };

export interface PagePatchResult<B extends WithId, S> {
  blocks: B[];
  spec: S;
  blocksChanged: boolean;
  specChanged: boolean;
  /** What the patch did, one line each ("replace ch-kalinga", "insert fig-lion after ch-kalinga"). */
  changed: string[];
  /** Parts of the patch already in effect (idempotent re-runs). */
  unchanged: string[];
  /** Parts that cannot apply: the block or key changed since the patch was made, or an anchor is missing. */
  conflicts: string[];
}

function getPath(spec: Record<string, unknown>, path: string): unknown {
  const [key, sub] = path.split(".");
  const top = spec[key!];
  if (sub === undefined) return top;
  return top && typeof top === "object" ? (top as Record<string, unknown>)[sub] : undefined;
}

function setPath(spec: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const [key, sub] = path.split(".");
  const out = { ...spec };
  if (sub === undefined) {
    if (value === null) delete out[key!];
    else out[key!] = value;
    return out;
  }
  const inner = { ...((out[key!] as Record<string, unknown> | undefined) ?? {}) };
  if (value === null) delete inner[sub];
  else inner[sub] = value;
  out[key!] = inner;
  return out;
}

function anchorLabel(after: PatchAnchor): string {
  return after === null ? "at the start" : after === "end" ? "at the end" : `after ${after}`;
}

/**
 * Applies a patch to a page's blocks and spec, in a fixed order: spec keys,
 * then removals, replacements, insertions and moves, each list in its own
 * order. Never throws on a conflict: conflicts are returned, and the caller
 * decides (apply refuses the whole op; the review page shows them).
 * The result is not validated here; validate it with Blocks and PageSpec.
 */
export function applyPagePatch<B extends WithId, S extends Record<string, unknown>>(
  current: { blocks: readonly B[]; spec: S },
  patch: PagePatchInput | PagePatch,
): PagePatchResult<B, S> {
  const changed: string[] = [];
  const unchanged: string[] = [];
  const conflicts: string[] = [];
  const stale = (what: string, now: string, was: string) =>
    conflicts.push(`${what} changed after this edit was made (now ${now}, edit made against ${was})`);

  let spec: Record<string, unknown> = current.spec;
  for (const entry of patch.spec ?? []) {
    const now = getPath(spec, entry.path);
    const target = entry.value === null ? undefined : entry.value;
    if (canonicalJson(now) === canonicalJson(target)) {
      unchanged.push(`spec ${entry.path}`);
      continue;
    }
    const nowFp = fingerprint(now);
    if (entry.was !== undefined && entry.was !== nowFp) {
      stale(`spec ${entry.path}`, nowFp, entry.was);
      continue;
    }
    spec = setPath(spec, entry.path, entry.value);
    changed.push(`spec ${entry.path}`);
  }

  let blocks = [...current.blocks];
  const at = (id: string) => blocks.findIndex((b) => b.id === id);
  let blocksChanged = false;

  for (const r of patch.remove ?? []) {
    const i = at(r.id);
    if (i < 0) {
      unchanged.push(`remove ${r.id}`);
      continue;
    }
    const nowFp = blockFingerprint(blocks[i]);
    if (nowFp !== r.was) {
      stale(`block ${r.id}`, nowFp, r.was);
      continue;
    }
    blocks.splice(i, 1);
    blocksChanged = true;
    changed.push(`remove ${r.id}`);
  }

  for (const r of patch.replace ?? []) {
    const i = at(r.id);
    if (i < 0) {
      conflicts.push(`block ${r.id} is no longer on the page`);
      continue;
    }
    const nowFp = blockFingerprint(blocks[i]);
    if (nowFp === blockFingerprint(r.block)) {
      unchanged.push(`replace ${r.id}`);
      continue;
    }
    if (nowFp !== r.was) {
      stale(`block ${r.id}`, nowFp, r.was);
      continue;
    }
    blocks[i] = r.block as unknown as B;
    blocksChanged = true;
    changed.push(`replace ${r.id}`);
  }

  const place = (block: B, after: PatchAnchor, what: string): boolean => {
    if (after === null) blocks.unshift(block);
    else if (after === "end") blocks.push(block);
    else {
      const a = at(after);
      if (a < 0) {
        conflicts.push(`${what}: no block ${after} to put it after`);
        return false;
      }
      blocks.splice(a + 1, 0, block);
    }
    return true;
  };

  for (const ins of patch.insert ?? []) {
    const id = ins.block.id;
    const i = at(id);
    if (i >= 0) {
      if (blockFingerprint(blocks[i]) === blockFingerprint(ins.block)) unchanged.push(`insert ${id}`);
      else conflicts.push(`block ${id} is already on the page with other content`);
      continue;
    }
    if (place(ins.block as unknown as B, ins.after, `insert ${id}`)) {
      blocksChanged = true;
      changed.push(`insert ${id} ${anchorLabel(ins.after)}`);
    }
  }

  for (const mv of patch.move ?? []) {
    const i = at(mv.id);
    if (i < 0) {
      conflicts.push(`move ${mv.id}: the block is no longer on the page`);
      continue;
    }
    if (mv.after === mv.id) {
      conflicts.push(`move ${mv.id}: a block cannot go after itself`);
      continue;
    }
    const inPlace =
      mv.after === null ? i === 0 : mv.after === "end" ? i === blocks.length - 1 : i > 0 && blocks[i - 1]!.id === mv.after;
    if (inPlace) {
      unchanged.push(`move ${mv.id}`);
      continue;
    }
    if (mv.after !== null && mv.after !== "end" && at(mv.after) < 0) {
      conflicts.push(`move ${mv.id}: no block ${mv.after} to put it after`);
      continue;
    }
    const [moving] = blocks.splice(i, 1);
    place(moving!, mv.after, `move ${mv.id}`);
    blocksChanged = true;
    changed.push(`move ${mv.id} ${anchorLabel(mv.after)}`);
  }

  if (!blocksChanged) blocks = [...current.blocks];
  return {
    blocks,
    spec: spec as S,
    blocksChanged,
    specChanged: spec !== current.spec,
    changed,
    unchanged,
    conflicts,
  };
}

/* ------------------------------------------------------------------ diffing */

/** A block in the form it is stored (defaults filled in), so fields left at their defaults do not count as changes. */
function normalized(block: unknown): unknown {
  const parsed = Block.safeParse(block);
  return parsed.success ? parsed.data : block;
}

/**
 * The smallest patch turning `before` into `after` (matched by block id):
 * removals and replacements guarded by fingerprints of the `before` blocks,
 * insertions, and moves for blocks that changed position. Blocks that keep
 * their content and relative order are not mentioned, so the patch conflicts
 * with nothing that touches only them. Throws if the patch would not
 * reproduce `after` (a bug, never expected).
 */
export function pagePatchFrom<B extends WithId>(before: readonly B[], after: readonly B[]): PagePatchInput {
  const old = new Map(before.map((b, i) => [b.id, { b, i }]));
  const ids = new Set(after.map((b) => b.id));
  const remove = before.filter((b) => !ids.has(b.id)).map((b) => ({ id: b.id, was: blockFingerprint(b) }));
  const replace = after.flatMap((b) => {
    const o = old.get(b.id);
    return o && canonicalJson(normalized(o.b)) !== canonicalJson(normalized(b))
      ? [{ id: b.id, was: blockFingerprint(o.b), block: b as unknown as Block }]
      : [];
  });

  // Shared blocks that keep their relative order stay; every other block is placed after its predecessor in `after`.
  const shared = after.map((b, i) => ({ id: b.id, i })).filter((s) => old.has(s.id));
  const stay = new Set([...longestIncreasing(shared.map((s) => old.get(s.id)!.i))].map((k) => shared[k]!.id));
  const moved = new Set(shared.filter((s) => !stay.has(s.id)).map((s) => s.id));
  const insert: { after: string | null; block: Block }[] = [];
  const move: { id: string; after: string | null }[] = [];
  after.forEach((b, i) => {
    if (stay.has(b.id)) return;
    if (moved.has(b.id)) {
      // Moves run after the inserts, in this order, so the predecessor is already where it belongs.
      move.push({ id: b.id, after: i > 0 ? after[i - 1]!.id : null });
      return;
    }
    // Inserts run before the moves: anchor on the nearest predecessor that is not moved later.
    let j = i - 1;
    while (j >= 0 && moved.has(after[j]!.id)) j--;
    insert.push({ after: j >= 0 ? after[j]!.id : null, block: b as unknown as Block });
  });

  const patch: PagePatchInput = {
    ...(remove.length ? { remove } : {}),
    ...(replace.length ? { replace } : {}),
    ...(insert.length ? { insert } : {}),
    ...(move.length ? { move } : {}),
  };
  const check = applyPagePatch({ blocks: before, spec: {} }, patch);
  if (check.conflicts.length || canonicalJson(check.blocks.map(normalized)) !== canonicalJson(after.map(normalized)))
    throw new Error(`pagePatchFrom: the patch does not reproduce the blocks (${check.conflicts.join("; ") || "order differs"})`);
  return patch;
}

/**
 * Spec patch entries for the given paths whose values differ between two
 * specs, each guarded by a fingerprint of the value in `before`.
 */
export function specPatchFrom(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  paths: string[],
): NonNullable<PagePatchInput["spec"]> {
  return paths.flatMap((path) => {
    const a = getPath(before, path);
    const b = getPath(after, path);
    return canonicalJson(a) === canonicalJson(b) ? [] : [{ path, was: fingerprint(a), value: b ?? null }];
  });
}

/** True when a patch has nothing in it. */
export function isEmptyPatch(patch: PagePatchInput): boolean {
  return !patch.spec?.length && !patch.remove?.length && !patch.replace?.length && !patch.insert?.length && !patch.move?.length;
}
