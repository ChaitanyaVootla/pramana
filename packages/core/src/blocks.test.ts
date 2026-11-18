import { describe, expect, it } from "vitest";
import { Block, claimIdsInBlock, markdownInBlock } from "./blocks";

const id = "01a149c7-a645-7c97-b96e-634292b7b7c9";
const chapter = (brief?: unknown) => ({
  id: "ch-kalinga",
  type: "chapter",
  title: "The war in Kalinga",
  brief,
});

describe("chapter briefs", () => {
  it("are optional", () => {
    expect(Block.safeParse(chapter()).success).toBe(true);
  });

  it("must link the claims that what happened rests on", () => {
    const unlinked = Block.safeParse(
      chapter({ happened: "Aśoka conquered Kalinga.", howWeKnow: "His own Rock Edict XIII." }),
    );
    expect(unlinked.success).toBe(false);
    const linked = Block.parse(
      chapter({
        happened: `[Aśoka conquered Kalinga](claim:${id}), then regretted it.`,
        howWeKnow: "His own Rock Edict XIII.",
      }),
    );
    expect(claimIdsInBlock(linked)).toEqual([id]);
    expect(markdownInBlock(linked)).toHaveLength(2);
  });
});

import { diffBlocks, diffWords } from "./blocks";

describe("review diffs", () => {
  const p = (id: string, markdown: string) => Block.parse({ id, type: "prose", markdown });
  it("finds added, removed, changed and moved blocks", () => {
    const before = [p("a", "One."), p("b", "Two."), p("c", "Three.")];
    const after = [p("b", "Two."), p("a", "One, changed."), p("d", "Four.")];
    const kinds = diffBlocks(before, after).map(
      (c) => `${c.kind}:${"block" in c ? c.block.id : c.after.id}`,
    );
    expect(kinds).toContain("changed:a");
    expect(kinds).toContain("added:d");
    expect(kinds).toContain("removed:c");
    expect(diffBlocks(before, before)).toEqual([]);
  });
  it("diffs prose word by word", () => {
    const d = diffWords(
      "Aśoka conquered Kalinga in 261 BCE.",
      "Aśoka conquered Kalinga around 261 BCE.",
    );
    expect(d.filter((x) => x.kind === "removed").map((x) => x.text.trim())).toEqual(["in"]);
    expect(d.filter((x) => x.kind === "added").map((x) => x.text.trim())).toEqual(["around"]);
  });
});

describe("diffBlocks moves", () => {
  const p = (id: string) => Block.parse({ id, type: "prose", markdown: id });
  it("counts only the block that moved, not the ones it shifted", () => {
    const before = ["a", "b", "c", "d"].map(p);
    const after = ["a", "c", "d", "b"].map(p);
    expect(diffBlocks(before, after).map((c) => `${c.kind}:${"block" in c ? c.block.id : ""}`)).toEqual(["moved:b"]);
  });
});
