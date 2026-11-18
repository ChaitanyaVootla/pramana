import { describe, expect, it } from "vitest";
import {
  effectiveSpans,
  pickSpan,
  primarySpan,
  timelineSpan,
  toEntitySpans,
  type EntitySpan,
} from "./spans";

const reign: EntitySpan = { role: "reign", when: { edtf: "-0267/-0231" } };
const life: EntitySpan = { role: "life", when: { edtf: "-0303/-0231" } };
const secondThrone: EntitySpan = { role: "reign", when: { edtf: "-0328/-0322" } };

describe("toEntitySpans", () => {
  it("converts hand-written dates and rejects duplicates", () => {
    const spans = toEntitySpans([
      { role: "reign", when: { start: { year: 268, era: "BCE" }, end: { year: 232, era: "BCE" } } },
    ]);
    expect(spans[0]!.when.edtf).toBe("-0267/-0231");
    expect(() => toEntitySpans([reign, reign])).toThrow(/duplicate/);
  });
  it("rejects a span that ends before it starts", () => {
    expect(() =>
      toEntitySpans([
        { role: "life", when: { start: { year: 200, era: "BCE" }, end: { year: 210, era: "BCE" } } },
      ]),
    ).toThrow();
  });
});

describe("span selection", () => {
  it("prefers reign for persons and picks the earliest of several", () => {
    expect(primarySpan("person", [life, reign])).toEqual(reign);
    expect(pickSpan([reign, secondThrone, life], ["reign"])).toEqual(secondThrone);
    expect(primarySpan("person", [life])).toEqual(life);
  });
  it("prefers existence for polities and falls back to the first span", () => {
    const existence: EntitySpan = { role: "existence", when: { edtf: "-0321/-0184" } };
    expect(primarySpan("polity", [reign, existence])).toEqual(existence);
    expect(primarySpan("polity", [reign])).toEqual(reign);
    expect(primarySpan("polity", [])).toBeNull();
  });
});

describe("timelineSpan", () => {
  const ashoka = { kind: "person", when: { edtf: "-0267~/-0231~" }, spans: [life, reign] };
  it("draws a person's reign by default", () => {
    expect(timelineSpan(ashoka)).toMatchObject({ role: "reign", when: ashoka.when });
  });
  it("honours a per-kind role choice", () => {
    expect(timelineSpan(ashoka, { person: ["life"] })).toMatchObject({ role: "life" });
  });
  it("keeps a curated `when` that is the same reign as the span", () => {
    const curated = { kind: "person", when: { edtf: "-0321~/-0297~", label: "reigned c. 322–298 BCE" }, spans: [{ role: "reign" as const, when: { edtf: "-0320/-0296" } }, life] };
    expect(timelineSpan(curated)).toMatchObject({ role: "reign", when: curated.when });
    expect(timelineSpan(curated, { person: ["life"] })).toMatchObject({ role: "life", when: life.when });
  });
  it("falls back to `when` when no span matches", () => {
    const noSpans = { kind: "person", when: { edtf: "-0349~/-0289~" }, spans: [] };
    expect(timelineSpan(noSpans)).toEqual({ when: noSpans.when, role: null, span: null });
    expect(timelineSpan(noSpans, { person: ["reign"] }, { fallbackToWhen: false })).toBeNull();
    const polity = { kind: "polity", when: { edtf: "-0321~/-0184~" }, spans: [] };
    expect(timelineSpan(polity)?.role).toBe("existence");
  });
});

describe("effectiveSpans", () => {
  it("infers an existence span for polities but not for persons", () => {
    expect(effectiveSpans({ kind: "polity", when: { edtf: "0320/0550" }, spans: [] })).toEqual([
      { role: "existence", when: { edtf: "0320/0550" }, implicit: true },
    ]);
    expect(effectiveSpans({ kind: "person", when: { edtf: "0320/0350" }, spans: [] })).toEqual([]);
    expect(effectiveSpans({ kind: "person", when: null, spans: [life] })).toEqual([life]);
  });
});
