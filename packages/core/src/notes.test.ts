import { describe, expect, it } from "vitest";
import { askPrompt, askQuestion } from "./ask";
import { NoteInput, noteTarget } from "./notes";

const base = { title: "Why Kalinga?", body: "Because…" };
const CLAIM = "0192f7a0-0000-7000-8000-000000000001";

describe("note subjects", () => {
  it("keeps old notes valid: page + anchor means a note about that page", () => {
    const n = NoteInput.parse({ ...base, page: "maurya-empire", anchorBlockId: "ch-kalinga" });
    expect(noteTarget(n)).toEqual({
      subject: { type: "page", page: "maurya-empire" },
      page: "maurya-empire",
      block: "ch-kalinga",
    });
  });
  it("is general when nothing is named", () => {
    expect(noteTarget(NoteInput.parse(base))).toEqual({
      subject: { type: "general" },
      page: null,
      block: null,
    });
  });
  it("takes a chapter in `about`", () => {
    const n = NoteInput.parse({
      ...base,
      about: { type: "page", page: "maurya-empire", chapter: "ch-1" },
    });
    expect(noteTarget(n)).toMatchObject({ page: "maurya-empire", block: "ch-1" });
  });
  it("can be about one thing and also show on the page being read", () => {
    const n = NoteInput.parse({
      ...base,
      about: { type: "claim", id: CLAIM },
      page: "maurya-empire",
    });
    expect(noteTarget(n)).toEqual({
      subject: { type: "claim", id: CLAIM },
      page: "maurya-empire",
      block: null,
    });
  });
  it("accepts entities by slug or id, and sources and canvases by id", () => {
    for (const about of [
      { type: "entity", entity: "ashoka" },
      { type: "entity", entity: CLAIM },
      { type: "source", id: CLAIM },
      { type: "canvas", id: CLAIM },
      { type: "general" },
    ]) {
      expect(NoteInput.safeParse({ ...base, about }).success, JSON.stringify(about)).toBe(true);
    }
  });
  it("rejects unknown types, bad ids and bad slugs", () => {
    for (const about of [
      { type: "person", id: CLAIM },
      { type: "claim", id: "kalinga" },
      { type: "source" },
      { type: "entity", entity: "Not A Slug" },
      { type: "page", page: "@ref" },
      { type: "page", page: "maurya-empire", chapter: "has spaces" },
    ]) {
      expect(NoteInput.safeParse({ ...base, about }).success, JSON.stringify(about)).toBe(false);
    }
  });
  it("rejects an anchor with no page, and contradictory pages or chapters", () => {
    expect(NoteInput.safeParse({ ...base, anchorBlockId: "ch-1" }).success).toBe(false);
    expect(
      NoteInput.safeParse({ ...base, about: { type: "page", page: "a" }, page: "b" }).success,
    ).toBe(false);
    expect(
      NoteInput.safeParse({
        ...base,
        about: { type: "page", page: "a", chapter: "ch-1" },
        anchorBlockId: "ch-2",
      }).success,
    ).toBe(false);
    expect(
      NoteInput.safeParse({ ...base, about: { type: "page", page: "a" }, page: "a" }).success,
    ).toBe(true);
  });
  it("anchors a note about a page to a block given as anchorBlockId", () => {
    const n = NoteInput.parse({
      ...base,
      about: { type: "page", page: "a" },
      anchorBlockId: "ch-3",
    });
    expect(noteTarget(n).block).toBe("ch-3");
  });
});

describe("askPrompt", () => {
  it("names the exact thing with its id and the note subject to post back to", () => {
    const p = askPrompt({ type: "claim", id: CLAIM, label: "Aśoka  fought\nKalinga" });
    expect(p).toContain(`claim ${CLAIM}`);
    expect(p).toContain("“Aśoka fought Kalinga”");
    expect(p).toContain(`{"type": "claim", "id": "${CLAIM}"}`);
    expect(p).toContain("ask me one short question");
    const c = askPrompt({ type: "chapter", page: "maurya-empire", chapter: "ch-1", label: "Rise" });
    expect(c).toContain(`"chapter": "ch-1"`);
  });
  it("shortens long labels", () => {
    const p = askPrompt({ type: "source", id: CLAIM, label: "x".repeat(400) });
    expect(p).toContain("…”");
    expect(p).not.toContain("x".repeat(158));
  });
});

describe("askQuestion", () => {
  it("asks in a reader's words, with no ids or tool names", () => {
    const subjects = [
      { type: "claim", id: CLAIM, label: "Aśoka fought Kalinga" },
      { type: "chapter", page: "maurya-empire", chapter: "ch-kalinga", label: "The war in Kalinga", pageTitle: "Maurya Empire" },
      { type: "page", page: "maurya-empire", label: "Maurya Empire" },
      { type: "entity", entity: "ashoka", label: "Aśoka" },
      { type: "source", id: CLAIM, label: "Rock Edict XIII" },
      { type: "canvas", id: CLAIM, label: "Aśoka in context" },
    ] as const;
    for (const s of subjects) {
      const q = askQuestion(s);
      expect(q).toContain(s.label);
      expect(q).not.toMatch(/post_note|get_|claim id|maurya-empire|ashoka\b|ch-kalinga/);
      expect(q).not.toContain(CLAIM);
    }
  });
});
