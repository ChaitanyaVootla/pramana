import { describe, expect, it } from "vitest";
import {
  CanvasArrangeInput,
  CanvasItemContent,
  CanvasLayout,
  CanvasLinkInput,
  canvasItemRefs,
  flowLayout,
  listOrder,
  moveItem,
  overlaps,
  placeNew,
  readingOrder,
  sectionGroup,
  settle,
  stepItem,
  tidy,
  wrapToWidth,
  type Placed,
} from "./canvas";

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, "0")}`;
const at = (n: number, x: number, y: number, w: number, h: number, section = false): Placed => ({
  id: id(n),
  layout: { x, y, w, h },
  ...(section ? { section } : {}),
});
const noOverlaps = (items: Placed[]) =>
  items.every((a, i) => items.every((b, j) => i === j || !overlaps(a.layout, b.layout)));

describe("canvas item validation", () => {
  it("accepts every kind with its references", () => {
    const ok: unknown[] = [
      { kind: "claim", claimId: id(1) },
      { kind: "entity", entity: "kalinga" },
      { kind: "chapter", page: "maurya-empire", chapterId: "kalinga-war" },
      { kind: "excerpt", excerptId: id(2) },
      { kind: "media", mediaId: id(3) },
      { kind: "map", year: -260, places: ["kalinga"], focus: ["maurya-empire"] },
      { kind: "timeline", range: [-330, -180], entities: ["ashoka"] },
      { kind: "note", noteId: id(4) },
      { kind: "viz", viz: { kind: "table", columns: ["a"], rows: [["1"]] } },
      { kind: "text", markdown: "Why the war **mattered**" },
      { kind: "section", title: "The edicts" },
    ];
    for (const c of ok) expect(CanvasItemContent.safeParse(c).success, JSON.stringify(c)).toBe(true);
  });

  it("fills defaults", () => {
    expect(CanvasItemContent.parse({ kind: "claim", claimId: id(1) })).toMatchObject({ citations: true });
    expect(CanvasItemContent.parse({ kind: "map" })).toMatchObject({ places: [], focus: [], borders: true });
  });

  it("refuses bad references and shapes", () => {
    const bad: unknown[] = [
      { kind: "claim", claimId: "not-a-uuid" },
      { kind: "entity", entity: "Not A Slug" },
      { kind: "chapter", page: "maurya-empire", chapterId: "has spaces" },
      { kind: "timeline", range: [100, 50] },
      { kind: "timeline" },
      { kind: "map", range: [10, 5] },
      { kind: "text", markdown: "" },
      { kind: "section" },
      { kind: "poster", url: "https://example.com" },
      { kind: "viz", viz: { kind: "script", code: "alert(1)" } },
    ];
    for (const c of bad) expect(CanvasItemContent.safeParse(c).success, JSON.stringify(c)).toBe(false);
  });

  it("keeps layouts on the board", () => {
    expect(CanvasLayout.safeParse({ x: 8, y: 0, w: 4, h: 2 }).success).toBe(true);
    expect(CanvasLayout.safeParse({ x: 40, y: 0, w: 4, h: 2 }).success).toBe(true);
    expect(CanvasLayout.safeParse({ x: 198, y: 0, w: 4, h: 2 }).success).toBe(false);
    expect(CanvasLayout.safeParse({ x: 0, y: 0, w: 30, h: 2 }).success).toBe(false);
    expect(CanvasLayout.safeParse({ x: 0, y: -1, w: 4, h: 2 }).success).toBe(false);
    expect(CanvasLayout.safeParse({ x: 0, y: 0, w: 0, h: 2 }).success).toBe(false);
    expect(CanvasLayout.safeParse({ x: 0.5, y: 0, w: 4, h: 2 }).success).toBe(false);
  });

  it("requires something to arrange", () => {
    expect(CanvasArrangeInput.safeParse({}).success).toBe(false);
    expect(CanvasArrangeInput.safeParse({ tidy: true }).success).toBe(true);
    expect(CanvasArrangeInput.safeParse({ order: [id(1)] }).success).toBe(true);
  });

  it("lists what an item refers to", () => {
    const map = CanvasItemContent.parse({ kind: "map", places: ["kalinga"], focus: ["maurya-empire"] });
    expect(canvasItemRefs(map).entities).toEqual(["kalinga", "maurya-empire"]);
    const lineage = CanvasItemContent.parse({ kind: "viz", viz: { kind: "lineage", claimId: id(9) } });
    expect(canvasItemRefs(lineage).claims).toEqual([id(9)]);
  });
});

describe("canvas links", () => {
  it("joins two different items with a relation", () => {
    expect(CanvasLinkInput.parse({ from: id(1), to: id(2) })).toMatchObject({ relation: "related" });
    expect(CanvasLinkInput.safeParse({ from: id(1), to: id(2), relation: "contradicts", label: "on the toll" }).success).toBe(true);
    expect(CanvasLinkInput.safeParse({ from: id(1), to: id(1) }).success).toBe(false);
    expect(CanvasLinkInput.safeParse({ from: id(1), to: id(2), relation: "loves" }).success).toBe(false);
  });
});

describe("canvas layout", () => {
  it("reads rows top to bottom, then left to right", () => {
    const items = [at(1, 6, 0, 6, 2), at(2, 0, 3, 4, 2), at(3, 0, 0, 6, 2)];
    expect(readingOrder(items).map((i) => i.id)).toEqual([id(3), id(1), id(2)]);
  });

  it("pushes what a moved item lands on down, and leaves the rest alone", () => {
    const items = [at(1, 0, 0, 4, 3), at(2, 0, 3, 4, 3), at(3, 8, 0, 4, 3)];
    const out = moveItem(items, id(2), { x: 0, y: 1, w: 4, h: 3 });
    expect(out.find((i) => i.id === id(2))!.layout).toEqual({ x: 0, y: 1, w: 4, h: 3 });
    expect(out.find((i) => i.id === id(1))!.layout.y).toBe(4);
    expect(out.find((i) => i.id === id(3))!.layout).toEqual({ x: 8, y: 0, w: 4, h: 3 });
    expect(noOverlaps(out)).toBe(true);
  });

  it("cascades pushes", () => {
    const items = [at(1, 0, 0, 12, 2), at(2, 0, 2, 12, 2), at(3, 0, 4, 12, 2)];
    const out = settle([{ ...items[0]!, layout: { x: 0, y: 0, w: 12, h: 5 } }, items[1]!, items[2]!], [id(1)]);
    expect(out.map((i) => i.layout.y)).toEqual([0, 5, 7]);
    expect(noOverlaps(out)).toBe(true);
  });

  it("keeps gaps until tidied", () => {
    const items = [at(1, 0, 0, 4, 2), at(2, 0, 10, 4, 2)];
    expect(settle(items).map((i) => i.layout.y)).toEqual([0, 10]);
    expect(tidy(items).map((i) => i.layout.y)).toEqual([0, 2]);
  });

  it("places a new item beside the last one, or on a new row", () => {
    const items = [at(1, 0, 0, 4, 3)];
    expect(placeNew(items, { w: 4, h: 3 })).toEqual({ x: 4, y: 0, w: 4, h: 3 });
    expect(placeNew([...items, at(2, 4, 0, 8, 3)], { w: 4, h: 3 })).toEqual({ x: 0, y: 3, w: 4, h: 3 });
    expect(placeNew(items, { w: 4, h: 1 }, { section: true })).toEqual({ x: 0, y: 3, w: 12, h: 1 });
    expect(placeNew([], { w: 6, h: 2 })).toEqual({ x: 0, y: 0, w: 6, h: 2 });
  });

  it("flows items in a given order, sections on their own row", () => {
    const items = [at(1, 0, 0, 6, 2), at(2, 6, 0, 6, 3), at(3, 0, 9, 12, 1, true), at(4, 0, 12, 4, 2)];
    const out = flowLayout(items, [id(3), id(2), id(1)]);
    const l = (n: number) => out.find((i) => i.id === id(n))!.layout;
    expect(l(3)).toEqual({ x: 0, y: 0, w: 12, h: 1 });
    expect(l(2)).toEqual({ x: 0, y: 1, w: 6, h: 3 });
    expect(l(1)).toEqual({ x: 6, y: 1, w: 6, h: 2 });
    expect(l(4)).toEqual({ x: 0, y: 4, w: 4, h: 2 });
    expect(noOverlaps(out)).toBe(true);
  });

  it("moves a section with its group", () => {
    const items = [
      at(1, 0, 0, 12, 1, true),
      at(2, 0, 1, 4, 2),
      at(3, 0, 3, 12, 1, true),
      at(4, 0, 4, 4, 2),
    ];
    expect(sectionGroup(items, id(1))).toEqual([id(2)]);
    const out = moveItem(items, id(3), { x: 3, y: 0, w: 5, h: 1 });
    const l = (n: number) => out.find((i) => i.id === id(n))!.layout;
    expect(l(3)).toEqual({ x: 3, y: 0, w: 5, h: 1 });
    expect(l(4).y).toBe(1);
    expect(l(1).y).toBeGreaterThanOrEqual(3);
    expect(noOverlaps(out)).toBe(true);
    expect(readingOrder(out).map((i) => i.id)).toEqual([id(3), id(4), id(1), id(2)]);
  });

  it("groups by column when sections sit side by side", () => {
    const items = [
      at(1, 0, 0, 6, 1, true),
      at(2, 6, 0, 6, 1, true),
      at(3, 0, 1, 6, 3),
      at(4, 6, 1, 6, 3),
      at(5, 0, 4, 6, 3),
      at(6, 0, 9, 12, 1, true),
      at(7, 0, 10, 4, 2),
    ];
    expect(sectionGroup(items, id(1))).toEqual([id(3), id(5)]);
    expect(sectionGroup(items, id(2))).toEqual([id(4)]);
    expect(listOrder(items).map((i) => i.id)).toEqual([id(1), id(3), id(5), id(2), id(4), id(6), id(7)]);
  });

  it("lists items under no section first", () => {
    const items = [at(1, 0, 3, 12, 1, true), at(2, 0, 4, 4, 2), at(3, 0, 0, 4, 2)];
    expect(listOrder(items).map((i) => i.id)).toEqual([id(3), id(1), id(2)]);
  });

  it("steps an item up or down in reading order", () => {
    const items = [at(1, 0, 0, 12, 2), at(2, 0, 2, 12, 4), at(3, 0, 6, 12, 2)];
    const up = stepItem(items, id(3), -1);
    expect(readingOrder(up).map((i) => i.id)).toEqual([id(1), id(3), id(2)]);
    expect(noOverlaps(up)).toBe(true);
    const down = stepItem(items, id(1), 1);
    expect(readingOrder(down).map((i) => i.id)).toEqual([id(2), id(1), id(3)]);
    expect(noOverlaps(down)).toBe(true);
    expect(stepItem(items, id(1), -1)).toBe(items);
  });

  it("steps within a row of unequal widths", () => {
    const items = [at(1, 0, 0, 8, 3), at(2, 8, 0, 4, 3)];
    const out = stepItem(items, id(2), -1);
    expect(readingOrder(out).map((i) => i.id)).toEqual([id(2), id(1)]);
    expect(noOverlaps(out)).toBe(true);
  });
});

describe("wrapToWidth", () => {
  const at = (id: string, x: number, y: number, w: number, h: number, section = false) => ({
    id,
    layout: { x, y, w, h },
    ...(section ? { section } : {}),
  });
  it("flows columns set side by side into rows that fit the width, keeping each whole", () => {
    const board = [
      at("s1", 0, 0, 10, 1, true),
      at("a", 0, 1, 10, 10),
      at("s2", 11, 0, 10, 1, true),
      at("b", 11, 1, 5, 8),
      at("c", 16, 1, 5, 8),
      at("s3", 22, 0, 8, 1, true),
      at("d", 22, 1, 8, 4),
    ];
    const out = Object.fromEntries(wrapToWidth(board, 17).map((i) => [i.id, i.layout]));
    expect(out.s1).toEqual({ x: 0, y: 0, w: 10, h: 1 });
    // The second column starts a row of its own, under the first (11 rows tall), with its insides kept.
    expect(out.s2).toEqual({ x: 0, y: 12, w: 10, h: 1 });
    expect(out.c).toEqual({ x: 5, y: 13, w: 5, h: 8 });
    expect(out.s3).toEqual({ x: 0, y: 22, w: 8, h: 1 });
    // Wide enough for two: the third sits beside the second.
    const two = Object.fromEntries(wrapToWidth(board, 25).map((i) => [i.id, i.layout]));
    expect(two.s2).toEqual({ x: 11, y: 0, w: 10, h: 1 });
    expect(two.s3).toEqual({ x: 0, y: 12, w: 8, h: 1 });
  });
  it("leaves a board that already fits, or a single column, as it is", () => {
    const narrow = [at("a", 0, 0, 6, 2), at("b", 6, 0, 6, 2)];
    expect(wrapToWidth(narrow, 12)).toBe(narrow);
    const one = [at("a", 0, 0, 20, 2), at("b", 5, 2, 20, 2)];
    expect(wrapToWidth(one, 12)).toBe(one);
  });
});
