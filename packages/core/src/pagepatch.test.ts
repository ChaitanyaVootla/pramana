import { describe, expect, it } from "vitest";
import type { Block } from "./blocks";
import { ChangeOp } from "./ops";
import {
  applyPagePatch,
  blockFingerprint,
  canonicalJson,
  isEmptyPatch,
  pagePatchFrom,
  sha256Hex,
  specPatchFrom,
  type PagePatchInput,
} from "./pagepatch";

const prose = (id: string, markdown = `Text of ${id}.`) => ({ id, type: "prose", markdown }) as Block;
const ids = (blocks: { id: string }[]) => blocks.map((b) => b.id);
const page = (...names: string[]) => ({ blocks: names.map((n) => prose(n)), spec: {} as Record<string, unknown> });

describe("fingerprints", () => {
  it("are SHA-256 of the canonical JSON", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    // Multi-block input and non-ASCII text.
    expect(sha256Hex("a".repeat(1000))).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
    expect(sha256Hex("Aśoka")).toBe(sha256Hex("Aśoka"));
  });

  it("ignore key order and undefined fields", () => {
    expect(blockFingerprint({ id: "a", type: "prose", markdown: "x" })).toBe(
      blockFingerprint({ markdown: "x", type: "prose", id: "a", theme: undefined }),
    );
    expect(blockFingerprint(prose("a", "x"))).not.toBe(blockFingerprint(prose("a", "y")));
    expect(canonicalJson({ b: [1, { d: 1, c: 2 }], a: null })).toBe('{"a":null,"b":[1,{"c":2,"d":1}]}');
  });
});

describe("applyPagePatch", () => {
  it("applies disjoint patches from two changesets in either order, with the same result", () => {
    const base = page("intro", "ch-1", "p-1", "ch-2", "p-2");
    const a: PagePatchInput = {
      replace: [{ id: "p-1", was: blockFingerprint(base.blocks[2]), block: prose("p-1", "Rewritten.") }],
      insert: [{ after: "p-1", block: prose("fig-1") }],
    };
    const b: PagePatchInput = {
      replace: [{ id: "p-2", was: blockFingerprint(base.blocks[4]), block: prose("p-2", "Also rewritten.") }],
      insert: [{ after: "intro", block: prose("guess-1") }],
    };
    const ab = applyPagePatch(applyPagePatch(base, a), b);
    const ba = applyPagePatch(applyPagePatch(base, b), a);
    expect(ab.conflicts).toEqual([]);
    expect(ba.conflicts).toEqual([]);
    expect(ids(ab.blocks)).toEqual(["intro", "guess-1", "ch-1", "p-1", "fig-1", "ch-2", "p-2"]);
    expect(canonicalJson(ab.blocks)).toBe(canonicalJson(ba.blocks));
  });

  it("refuses a replace whose block changed since, naming the block and both fingerprints", () => {
    const base = page("intro", "p-1");
    const was = blockFingerprint(base.blocks[1]);
    const first = applyPagePatch(base, { replace: [{ id: "p-1", was, block: prose("p-1", "One editor.") }] });
    const second = applyPagePatch(first, { replace: [{ id: "p-1", was, block: prose("p-1", "Another editor.") }] });
    expect(second.conflicts).toEqual([
      `block p-1 changed after this edit was made (now ${blockFingerprint(prose("p-1", "One editor."))}, edit made against ${was})`,
    ]);
    expect(second.blocksChanged).toBe(false);
    expect(second.blocks).toEqual(first.blocks);
  });

  it("treats a replace that is already in effect as done, whatever it was made against", () => {
    const base = page("p-1");
    const block = prose("p-1", "New.");
    const once = applyPagePatch(base, { replace: [{ id: "p-1", was: blockFingerprint(base.blocks[0]), block }] });
    const twice = applyPagePatch(once, { replace: [{ id: "p-1", was: blockFingerprint(base.blocks[0]), block }] });
    expect(twice.conflicts).toEqual([]);
    expect(twice.unchanged).toEqual(["replace p-1"]);
    expect(twice.blocksChanged).toBe(false);
  });

  it("leaves an insert alone when the same block is already there, and refuses one with other content", () => {
    const base = page("intro", "fig-1");
    const same = applyPagePatch(base, { insert: [{ after: "intro", block: prose("fig-1") }] });
    expect(same.conflicts).toEqual([]);
    expect(same.unchanged).toEqual(["insert fig-1"]);
    expect(same.blocksChanged).toBe(false);
    const other = applyPagePatch(base, { insert: [{ after: "intro", block: prose("fig-1", "Different.") }] });
    expect(other.conflicts).toEqual(["block fig-1 is already on the page with other content"]);
  });

  it("refuses an insert or move whose anchor is missing", () => {
    const base = page("intro", "p-1");
    const r = applyPagePatch(base, {
      insert: [{ after: "gone", block: prose("fig-1") }],
      move: [{ id: "p-1", after: "also-gone" }],
    });
    expect(r.conflicts).toEqual([
      "insert fig-1: no block gone to put it after",
      "move p-1: no block also-gone to put it after",
    ]);
  });

  it("inserts at the start and the end, and moves in order", () => {
    const r = applyPagePatch(page("a", "b", "c"), {
      insert: [
        { after: null, block: prose("first") },
        { after: "end", block: prose("last") },
      ],
      move: [
        { id: "c", after: "first" },
        { id: "a", after: "end" },
      ],
    });
    expect(r.conflicts).toEqual([]);
    expect(ids(r.blocks)).toEqual(["first", "c", "b", "last", "a"]);
  });

  it("removes only an unchanged block, and treats a block already gone as removed", () => {
    const base = page("a", "b");
    const r = applyPagePatch(base, {
      remove: [
        { id: "a", was: blockFingerprint(base.blocks[0]) },
        { id: "b", was: blockFingerprint(prose("b", "older")) },
        { id: "zzz", was: "0000000000000000" },
      ],
    });
    expect(ids(r.blocks)).toEqual(["b"]);
    expect(r.unchanged).toEqual(["remove zzz"]);
    expect(r.conflicts).toHaveLength(1);
  });

  it("sets spec keys guarded by their own fingerprints, keeping the others", () => {
    const spec = { hero: { media: "m-1", panels: ["atlas"] }, outline: "sidebar", atlas: { focus: ["x"] } };
    const heroPatch = specPatchFrom(spec, { ...spec, hero: { ...spec.hero, media: "m-2" } }, ["hero.media"]);
    const atlasPatch = specPatchFrom(spec, { ...spec, atlas: { focus: ["y"] } }, ["atlas"]);
    const both = applyPagePatch(applyPagePatch({ blocks: [], spec }, { spec: atlasPatch }), { spec: heroPatch });
    expect(both.conflicts).toEqual([]);
    expect(both.spec).toEqual({ hero: { media: "m-2", panels: ["atlas"] }, outline: "sidebar", atlas: { focus: ["y"] } });
    // The same key again, against the old value: a conflict.
    const again = applyPagePatch(both, { spec: specPatchFrom(spec, { ...spec, atlas: { focus: ["z"] } }, ["atlas"]) });
    expect(again.conflicts).toHaveLength(1);
    expect(again.conflicts[0]).toMatch(/^spec atlas changed after this edit was made/);
    // null removes a key.
    const removed = applyPagePatch({ blocks: [], spec }, { spec: [{ path: "atlas", value: null }] });
    expect("atlas" in removed.spec).toBe(false);
  });
});

describe("pagePatchFrom", () => {
  it("names only the blocks that change", () => {
    const before = page("intro", "ch-1", "p-1", "ch-2").blocks;
    const after = [before[0]!, prose("guess"), before[1]!, prose("p-1", "Edited."), before[3]!];
    const patch = pagePatchFrom(before, after);
    expect(patch).toEqual({
      replace: [{ id: "p-1", was: blockFingerprint(before[2]), block: after[3] }],
      insert: [{ after: "intro", block: after[1] }],
    });
    expect(isEmptyPatch(pagePatchFrom(before, before))).toBe(true);
  });

  it("does not count fields left at their defaults as a change", () => {
    const stored = { id: "g", type: "guess", claimId: "@c", question: "How many?", answer: { kind: "number", value: 5, tolerance: 0.25 } };
    const desired = { id: "g", type: "guess", claimId: "@c", question: "How many?", answer: { kind: "number", value: 5 } };
    expect(isEmptyPatch(pagePatchFrom([stored as never], [desired as never]))).toBe(true);
  });

  it("reproduces any reordering, insertion and removal", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 300; trial++) {
      const n = Math.floor(rand() * 9);
      const before = Array.from({ length: n }, (_, i) => prose(`b${i}`));
      const kept = before.filter(() => rand() > 0.25).map((b) => (rand() > 0.8 ? prose(b.id, "changed") : b));
      const added = Array.from({ length: Math.floor(rand() * 4) }, (_, i) => prose(`n${i}`));
      const after = [...kept, ...added].sort(() => rand() - 0.5);
      const patch = pagePatchFrom(before, after);
      const result = applyPagePatch({ blocks: before, spec: {} }, patch);
      expect(result.conflicts).toEqual([]);
      expect(canonicalJson(result.blocks)).toBe(canonicalJson(after));
      // Applying it again changes nothing.
      const again = applyPagePatch(result, patch);
      expect(again.conflicts).toEqual([]);
      expect(again.blocksChanged).toBe(false);
    }
  });
});

describe("patch_page op", () => {
  it("parses, and requires a replaced block to keep its id", () => {
    const op = { op: "patch_page", page: "maurya-empire", insert: [{ after: null, block: { id: "x", type: "prose", markdown: "Hi." } }] };
    expect(ChangeOp.parse(op).op).toBe("patch_page");
    const bad = ChangeOp.safeParse({
      op: "patch_page",
      page: "maurya-empire",
      replace: [{ id: "x", was: "0123456789abcdef", block: { id: "y", type: "prose", markdown: "Hi." } }],
    });
    expect(bad.success).toBe(false);
  });
});
