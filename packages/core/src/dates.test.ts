import { describe, expect, it } from "vitest";
import { dateBounds, formatFuzzyDate, toFuzzyDate, wikidataTimeToEdtf } from "./dates";

describe("toFuzzyDate", () => {
  it("converts BCE years to astronomical EDTF (322 BCE = -0321)", () => {
    const d = toFuzzyDate({
      start: { year: 322, era: "BCE", approximate: true },
      end: { year: 185, era: "BCE" },
    });
    expect(d.edtf).toBe("-0321~/-0184");
    expect(formatFuzzyDate(d)).toBe("c. 322–185 BCE");
  });

  it("rejects ranges that end before they start", () => {
    expect(() =>
      toFuzzyDate({ start: { year: 185, era: "BCE" }, end: { year: 322, era: "BCE" } }),
    ).toThrow();
  });

  it("formats exact days and cross-era spans", () => {
    expect(formatFuzzyDate({ edtf: "1947-08-15" })).toBe("15 August 1947");
    expect(formatFuzzyDate({ edtf: "-0099/0050" })).toBe("100 BCE – 50 CE");
  });

  it("computes bounds in decimal astronomical years", () => {
    const b = dateBounds("-2599~/-1899~");
    expect(b.startMin).toBeCloseTo(-2599, 5);
    expect(b.endMax).toBeCloseTo(-1898, 3);
    expect(b.approximate).toBe(true);
  });
});

describe("unknown vs open ends", () => {
  it("never stretches an unknown end to the present", () => {
    const unknown = dateBounds("-0249/");
    expect(unknown.endMax).toBeCloseTo(-248, 3);
    expect(unknown.uncertain).toBe(true);
  });
  it("keeps an open (ongoing) end open", () => {
    expect(dateBounds("1947-08-15/..").endMax).toBeNull();
  });
  it("labels a start with no recorded end as a start, not as uncertain", () => {
    expect(formatFuzzyDate({ edtf: "-0489~/" })).toBe("from c. 490 BCE");
    expect(formatFuzzyDate({ edtf: "1947-08-15/" })).toBe("from 15 August 1947");
    expect(formatFuzzyDate({ edtf: "/0477" })).toBe("until 477 CE");
    expect(formatFuzzyDate({ edtf: "1947-08-15/.." })).toBe("from 15 August 1947");
    expect(formatFuzzyDate({ edtf: "-0300?/" })).toBe("from 301 BCE (uncertain)");
    expect(formatFuzzyDate({ edtf: "-0303?" })).toBe("304 BCE (uncertain)");
  });
});

describe("deep prehistory", () => {
  it("gives bounds for long years beyond the JS Date range", () => {
    expect(dateBounds("Y-499999").startMin).toBe(-499999);
  });
  it("refuses long-year ranges with a clear message instead of an EDTF parse error", () => {
    expect(() => toFuzzyDate({ start: { year: 500000, era: "BCE" }, end: { year: 300000, era: "BCE" } })).toThrow(/9999 BCE/);
  });
  it("turns coarse Wikidata precisions for deep time into a parseable single year", () => {
    const v = wikidataTimeToEdtf({ time: "-12000-00-00T00:00:00Z", precision: 6 })!;
    expect(() => dateBounds(v)).not.toThrow();
  });
});

describe("wikidataTimeToEdtf", () => {
  it("shifts Wikidata's historical BCE numbering to astronomical", () => {
    // Wikidata -0044 = 44 BCE; EDTF/ISO 44 BCE = -0043
    expect(wikidataTimeToEdtf({ time: "-0044-00-00T00:00:00Z", precision: 9 })).toBe("-0043");
  });

  it("expands centuries into intervals", () => {
    // 3rd century BCE = 300–201 BCE = -0299/-0200
    expect(wikidataTimeToEdtf({ time: "-0300-00-00T00:00:00Z", precision: 7 })).toBe("-0299/-0200");
    // 20th century CE = 1901–2000
    expect(wikidataTimeToEdtf({ time: "+2000-00-00T00:00:00Z", precision: 7 })).toBe("1901/2000");
  });

  it("keeps day precision and converts Julian calendar dates", () => {
    expect(wikidataTimeToEdtf({ time: "+1947-08-15T00:00:00Z", precision: 11 })).toBe("1947-08-15");
    // Battle of Panipat, 21 April 1526 (Julian) = 1 May 1526 (Gregorian)
    expect(
      wikidataTimeToEdtf({
        time: "+1526-04-21T00:00:00Z",
        precision: 11,
        calendarmodel: "http://www.wikidata.org/entity/Q1985786",
      }),
    ).toBe("1526-05-01");
  });
});

describe("Wikidata import rules", () => {
  it("skips values coarser than a century", async () => {
    const { assessWikidataTime } = await import("./dates");
    // The Buddha's "1st millennium BCE" would become -0999/0000.
    expect(assessWikidataTime({ time: "-1000-00-00T00:00:00Z", precision: 6 })).toMatchObject({
      skip: expect.stringMatching(/millennium/),
    });
    expect(assessWikidataTime({ time: "-0268-00-00T00:00:00Z", precision: 9 })).toEqual({ edtf: "-0267" });
    expect(assessWikidataTime({ time: "-0300-00-00T00:00:00Z", precision: 7 })).toEqual({ edtf: "-0299/-0200" });
    expect(assessWikidataTime({ time: "-0268-00-00T00:00:00Z", precision: 9 }, { approximate: true })).toEqual({
      edtf: "-0267~",
    });
  });
  it("joins starts and ends, refusing reversed spans", async () => {
    const { joinEdtfSpan } = await import("./dates");
    expect(joinEdtfSpan("-0267", "-0231")).toEqual({ edtf: "-0267/-0231" });
    expect(joinEdtfSpan("-0303", null)).toEqual({ edtf: "-0303/" });
    expect(joinEdtfSpan(null, "-0231")).toEqual({ edtf: "/-0231" });
    expect(joinEdtfSpan("-0299/-0200", "-0199/-0100")).toEqual({ edtf: "-0299/-0100" });
    expect(joinEdtfSpan("-0200", "-0209")).toMatchObject({ skip: expect.stringMatching(/before/) });
  });
});

describe("wikidataSpanEndpoint", () => {
  it("keeps years, approximates decades, refuses centuries", async () => {
    const { wikidataSpanEndpoint } = await import("./dates");
    expect(wikidataSpanEndpoint({ time: "-0304-01-01T00:00:00Z", precision: 9 })).toEqual({ edtf: "-0303" });
    expect(wikidataSpanEndpoint({ time: "-0350-01-01T00:00:00Z", precision: 8 })).toEqual({ edtf: "-0349~" });
    expect(wikidataSpanEndpoint({ time: "-0300-00-00T00:00:00Z", precision: 7 })).toMatchObject({
      skip: expect.stringMatching(/century/),
    });
  });
});
