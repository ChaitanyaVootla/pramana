import { describe, expect, it } from "vitest";
import { bareRefLinks } from "./blocks";
import { findQuote, normalizeForMatch } from "./text";

const SOURCE = `When king Devānāṃpriya Priyadarśin had been anointed eight years, (the country of)
the Kaliṅgas was conquered by (him). One hundred and fifty thousand in number were the men who
were deported thence, one hundred thousand in number were those who were slain there, and many
times as many those who died. After that, now that (the country of) the Kaliṅgas has been taken,
Devānāṃpriya (is devoted) to a zealous study of morality, to the love of morality, and to the instruc-
tion (of people) in morality.`;

describe("normalizeForMatch", () => {
  it("folds diacritics, punctuation and line-break hyphenation", () => {
    expect(normalizeForMatch("Kaliṅgas,  instruc-\n tion").norm).toBe("kalingas instruction");
    expect(normalizeForMatch("mea¬\nsure the land").norm).toBe("measure the land");
  });
});

describe("findQuote", () => {
  it("finds a quote that differs only in diacritics and line breaks", () => {
    const m = findQuote(
      SOURCE,
      "the Kalingas was conquered by (him). One hundred and fifty thousand",
    );
    expect(m.status).toBe("exact");
    expect(m.quote?.exact.startsWith("the Kaliṅgas")).toBe(true);
    expect(SOURCE.slice(m.position!.start, m.position!.end)).toBe(m.quote!.exact);
  });

  it("matches across hyphenated line breaks", () => {
    expect(findQuote(SOURCE, "and to the instruction (of people) in morality").status).toBe(
      "exact",
    );
  });

  it("tolerates small OCR errors with a fuzzy match", () => {
    const m = findQuote(SOURCE, "one hundred thousand in nurnber were those who were slaiu there");
    expect(m.status).toBe("fuzzy");
    expect(m.score).toBeGreaterThan(0.9);
  });

  it("anchors on rare words even when common words repeat many times", () => {
    const filler = "Devanampriya speaks thus. ".repeat(500);
    const source = `${filler}When king Bevanampriya Priyadar£in had been anointed twenty years, he came himself^and worshipped (this spot). ${filler}`;
    const m = findQuote(
      source,
      "When king Devanampriya Priyadarsin had been anointed twenty years, he came himself and worshipped (this spot).",
    );
    expect(m.status).toBe("fuzzy");
  });

  it("keeps offsets right after astral characters (Brahmi)", () => {
    const source = "Ashoka (Brahmi: 𑀅𑀲𑁄𑀓, Asoka) was the third emperor of the Maurya dynasty and more.";
    const m = findQuote(source, "third emperor of the Maurya dynasty");
    expect(m.status).toBe("exact");
    expect(m.quote?.exact).toBe("third emperor of the Maurya dynasty");
    expect(source.slice(m.position!.start, m.position!.end)).toBe("third emperor of the Maurya dynasty");
  });

  it("matches decomposed (NFD) and ISO 15919 text", () => {
    const source = "When king Devānāṃpriya Priyadarśin had been anointed, Kr̥ṣṇa came.";
    expect(findQuote(source, "Devānāṃpriya Priyadarśin".normalize("NFD")).status).toBe("exact");
    expect(findQuote(source, "Kṛṣṇa came").status).toBe("exact");
  });

  it("keeps Devanagari vowel signs", () => {
    expect(normalizeForMatch("अशोक मौर्य").norm).toBe("अशोक मौर्य");
  });

  it("does not match a fabricated quote", () => {
    expect(
      findQuote(SOURCE, "Ashoka immediately converted to Buddhism after the battle").status,
    ).toBe("not_found");
  });
});


describe("bareRefLinks", () => {
  it("finds platform links that lost their scheme", () => {
    expect(bareRefLinks("[a](01a14b77-937b-7000-8000-000000000000) and [b](@c_kalinga)")).toEqual([
      "01a14b77-937b-7000-8000-000000000000",
      "@c_kalinga",
    ]);
  });
  it("leaves proper links alone", () => {
    expect(bareRefLinks("[a](claim:01a14b77-937b-7000-8000-000000000000) [b](https://example.org) [c](#part-2)")).toEqual([]);
  });
});
