import { describe, expect, it } from "vitest";
import { Block, CheckItem, GuessAnswer } from "./blocks";
import { dateBounds } from "./dates";
import { ReviewInput } from "./inputs";
import {
  CONFIDENT_ERROR_RECHECK_DAYS,
  chronologicalOrder,
  distanceToGeometryKm,
  gradeCheck,
  gradeGuess,
  gradeOrder,
  haversineKm,
  hypercorrect,
  isConfidentError,
  ratingFor,
  surenessOf,
  SURENESS_PERCENT,
  ungroundedTerms,
  groundedAnswer,
  formatGuessAnswer,
  formatGuessResponse,
  guessMiss,
} from "./learn";

const A = "01a149c7-a645-7fbb-974b-099d43e4dffc";
const B = "01a149c7-a645-7a36-aef5-ad8921956061";
const C = "01a149c7-a645-7191-8ed9-152cd47d9039";

describe("ratingFor (confidence → FSRS)", () => {
  it("rates every wrong answer again", () => {
    for (const sureness of ["low", "medium", "high"] as const) expect(ratingFor({ correct: false, sureness })).toBe("again");
  });
  it("rates a right guess hard, a right answer good, and easy only when sure", () => {
    expect(ratingFor({ correct: true, sureness: "low", easy: true })).toBe("hard");
    expect(ratingFor({ correct: true, sureness: "medium", easy: true })).toBe("good");
    expect(ratingFor({ correct: true, sureness: "high" })).toBe("good");
    expect(ratingFor({ correct: true, sureness: "high", easy: true })).toBe("easy");
  });
  it("maps levels to percentages and back", () => {
    for (const s of ["low", "medium", "high"] as const) expect(surenessOf(SURENESS_PERCENT[s])).toBe(s);
    expect(surenessOf(100)).toBe("high");
    expect(surenessOf(0)).toBe("low");
  });
});

describe("hypercorrection", () => {
  const now = new Date("2026-10-17T10:00:00Z");
  const later = new Date("2026-11-20T10:00:00Z");
  it("flags a confident error only", () => {
    expect(isConfidentError(false, 90)).toBe(true);
    expect(isConfidentError(false, 65)).toBe(false);
    expect(isConfidentError(true, 90)).toBe(false);
    expect(isConfidentError(null, 90)).toBe(false);
    expect(hypercorrect({ due: now, now, flagged: false, correct: false, confidence: 90 }).flagged).toBe(true);
  });
  it("brings the first right answer after a confident error back within days, then clears the flag", () => {
    const r = hypercorrect({ due: later, now, flagged: true, correct: true, confidence: 65 });
    expect(r.flagged).toBe(false);
    expect(r.due.getTime()).toBe(now.getTime() + CONFIDENT_ERROR_RECHECK_DAYS * 86_400_000);
  });
  it("keeps an earlier FSRS date and leaves unflagged cards alone", () => {
    const soon = new Date("2026-10-17T10:10:00Z");
    expect(hypercorrect({ due: soon, now, flagged: true, correct: true, confidence: 90 }).due).toBe(soon);
    expect(hypercorrect({ due: later, now, flagged: false, correct: true, confidence: 90 })).toEqual({ due: later, flagged: false });
    expect(hypercorrect({ due: now, now, flagged: true, correct: false, confidence: 30 })).toEqual({ due: now, flagged: true });
  });
});

describe("gradeGuess", () => {
  it("grades choices by index", () => {
    const a = GuessAnswer.parse({ kind: "choice", options: ["x", "y", "z"], correct: 1 });
    expect(gradeGuess(a, { kind: "choice", option: 1 }).correct).toBe(true);
    expect(gradeGuess(a, { kind: "choice", option: 0 }).correct).toBe(false);
    expect(() => gradeGuess(a, { kind: "choice", option: 4 })).toThrow();
  });
  it("grades numbers as right, close (within tolerance) or off", () => {
    const a = GuessAnswer.parse({ kind: "number", value: 150000, unit: "people" });
    expect(gradeGuess(a, { kind: "number", value: 150000 })).toEqual({ correct: true, close: true });
    expect(gradeGuess(a, { kind: "number", value: 120000 })).toEqual({ correct: false, close: true });
    expect(gradeGuess(a, { kind: "number", value: 20000 })).toEqual({ correct: false, close: false });
  });
  it("grades years across the era boundary astronomically", () => {
    const a = GuessAnswer.parse({ kind: "year", year: 5, era: "BCE", tolerance: 10 });
    // 5 BCE to 5 CE is nine years (there is no year 0).
    expect(gradeGuess(a, { kind: "year", year: 5, era: "CE" })).toEqual({ correct: false, close: true });
    expect(gradeGuess(a, { kind: "year", year: 5, era: "BCE" }).correct).toBe(true);
    expect(() => gradeGuess(a, { kind: "number", value: 5 })).toThrow();
  });
});

describe("order questions", () => {
  const dates = new Map([
    [A, dateBounds("-0319~/-0184")],
    [B, dateBounds("-0260~")],
    [C, dateBounds("-0248~")],
  ]);
  const item = CheckItem.parse({
    kind: "order",
    id: "o",
    items: [
      { claimId: C, label: "Lumbinī" },
      { claimId: A, label: "Founding" },
      { claimId: B, label: "Kalinga" },
    ],
  });
  it("orders claims by their stored start dates", () => {
    expect(chronologicalOrder([...dates].map(([claimId, bounds]) => ({ claimId, bounds })))).toEqual({ order: [A, B, C] });
  });
  it("refuses undated or overlapping claims", () => {
    expect(chronologicalOrder([{ claimId: A, bounds: null }, { claimId: B, bounds: dates.get(B)! }])).toHaveProperty("problem");
    expect(chronologicalOrder([{ claimId: A, bounds: dateBounds("1919") }, { claimId: B, bounds: dateBounds("1919-04-13") }])).toHaveProperty("problem");
  });
  it("counts the items in the right place", () => {
    expect(gradeCheck(item, { kind: "order", order: [A, B, C] }, { dates })).toEqual({ correct: true, placed: 3, order: [A, B, C] });
    expect(gradeCheck(item, { kind: "order", order: [B, A, C] }, { dates })).toMatchObject({ correct: false, placed: 1 });
    expect(() => gradeOrder([A, B, C], [A, A, C])).toThrow();
    expect(() => gradeCheck(item, { kind: "order", order: [A, B, C] }, { dates: new Map() })).toThrow(/cannot be graded/);
  });
});

describe("place questions", () => {
  const patna: [number, number] = [85.144, 25.611];
  it("measures great-circle distance", () => {
    // Patna to Delhi is about 850 km as the crow flies.
    expect(haversineKm(patna, [77.2167, 28.6667])).toBeGreaterThan(800);
    expect(haversineKm(patna, [77.2167, 28.6667])).toBeLessThan(900);
    expect(haversineKm(patna, patna)).toBe(0);
  });
  it("is right within the tolerance, or inside an outline", () => {
    const item = CheckItem.parse({ kind: "place", id: "p", entity: "pataliputra" });
    const point = { type: "Point" as const, coordinates: patna };
    expect(gradeCheck(item, { kind: "place", at: [85.5, 25.4] }, { geometry: point }).correct).toBe(true);
    expect(gradeCheck(item, { kind: "place", at: [77.2, 28.6] }, { geometry: point }).correct).toBe(false);
    expect(() => gradeCheck(item, { kind: "place", at: patna }, { geometry: null })).toThrow();
    const square = { type: "Polygon" as const, coordinates: [[[80, 20], [90, 20], [90, 30], [80, 30], [80, 20]] as [number, number][]] };
    expect(distanceToGeometryKm(patna, square)).toBe(0);
  });
});

describe("schemas", () => {
  it("validates guess and check blocks", () => {
    expect(
      Block.safeParse({ id: "g", type: "guess", question: "?", claimId: A, answer: { kind: "choice", options: ["a", "b"], correct: 2 } }).success,
    ).toBe(false);
    const g = Block.parse({ id: "g", type: "guess", question: "How many?", claimId: A, answer: { kind: "number", value: 3 } });
    expect(g.type === "guess" && g.answer.kind === "number" && g.answer.tolerance).toBe(0.25);
    expect(
      Block.safeParse({
        id: "c",
        type: "check",
        items: [
          { kind: "recall", id: "x", claimId: A },
          { kind: "recall", id: "x", claimId: B },
        ],
      }).success,
    ).toBe(false);
  });
  it("needs a rating, or rightness and sureness, on a review", () => {
    expect(ReviewInput.safeParse({ claimId: A }).success).toBe(false);
    expect(ReviewInput.safeParse({ claimId: A, rating: "good" }).success).toBe(true);
    expect(ReviewInput.safeParse({ claimId: A, correct: true, sureness: "high" }).success).toBe(true);
  });
});

describe("ungroundedTerms (prompts written for claims)", () => {
  const claim = "Aśoka conquered Kalinga in the eighth year after his consecration, about 261 BCE.";
  it("accepts a rephrasing that uses only the claim's names and numbers", () => {
    expect(ungroundedTerms("In which year of his reign did Asoka conquer Kalinga?", claim)).toEqual([]);
    expect(ungroundedTerms("Roughly when, BCE, did Aśoka's conquest of Kalinga happen? (261?)", claim)).toEqual([]);
  });
  it("flags names and figures the claim does not state", () => {
    expect(ungroundedTerms("Did Aśoka conquer Kalinga before Chandragupta died?", claim)).toEqual(["Chandragupta"]);
    expect(ungroundedTerms("Did Aśoka conquer Kalinga in 262 BCE?", claim)).toEqual(["262"]);
  });
  it("keeps a stored answer only while it stays inside the claim", () => {
    expect(groundedAnswer({ answer: "In the eighth year, about 261 BCE." }, claim)).toBe("In the eighth year, about 261 BCE.");
    expect(groundedAnswer({ answer: "In 262 BCE, at Dhauli." }, claim)).toBeNull();
    expect(groundedAnswer({}, claim)).toBeNull();
    expect(groundedAnswer(null, claim)).toBeNull();
  });
});

describe("guess words and misses", () => {
  const n = GuessAnswer.parse({ kind: "number", value: 150000, unit: "people" });
  it("formats answers and guesses", () => {
    expect(formatGuessAnswer(n)).toBe("150,000 people");
    expect(formatGuessResponse(n, { kind: "number", value: 120000 })).toBe("120,000 people");
  });
  it("measures how far off a guess was", () => {
    expect(guessMiss(n, { kind: "number", value: 120000 })).toBeCloseTo(0.2);
    expect(guessMiss(n, { kind: "number", value: 1_000_000 })).toBe(1);
    const y = GuessAnswer.parse({ kind: "year", year: 1838, era: "CE", tolerance: 10 });
    expect(guessMiss(y, { kind: "year", year: 1888, era: "CE" })).toBe(0.5);
    const c = GuessAnswer.parse({ kind: "choice", options: ["a", "b"], correct: 1 });
    expect(guessMiss(c, { kind: "choice", option: 1 })).toBe(0);
  });
});
