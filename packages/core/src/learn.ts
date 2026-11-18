import { z } from "zod";
import type { CheckItem, GuessAnswer } from "./blocks";
import { toAstronomicalYear, type DateBounds } from "./dates";
import { pointInMultiPolygon, type Position } from "./geo";
import type { Geometry } from "./records";

/**
 * Grading and scheduling rules for the learning features: "Guess first"
 * questions, end-of-chapter checks, confidence before the answer, and the
 * mapping onto FSRS ratings. Pure functions, so they can be tested and shared
 * by the services, the web app and the MCP server.
 */

/** "How sure are you?", asked before the answer is shown. */
export const Sureness = z.enum(["low", "medium", "high"]);
export type Sureness = z.infer<typeof Sureness>;

/**
 * The confidence each level stands for, in percent, for calibration (mean
 * confidence minus accuracy). "Just a guess" sits a little above chance on a
 * two-way question, "sure" short of certain.
 */
export const SURENESS_PERCENT: Record<Sureness, number> = { low: 30, medium: 65, high: 90 };

/** The level a stored percentage belongs to (older reviews used a 0–100 slider). */
export function surenessOf(percent: number): Sureness {
  if (percent < 50) return "low";
  if (percent < 80) return "medium";
  return "high";
}

export type Grade = "again" | "hard" | "good" | "easy";

/**
 * The FSRS rating for an answer, from whether it was right and how sure the
 * learner was beforehand:
 *
 * | right? | sure?            | rating |
 * | ------ | ---------------- | ------ |
 * | no     | any              | again  |
 * | yes    | just a guess     | hard   |
 * | yes    | fairly sure      | good   |
 * | yes    | sure             | good, or easy if they say it was easy |
 *
 * A right answer that was a guess is weak retrieval, so it comes back sooner
 * than a confident one; "easy" is only offered when the learner was sure.
 */
export function ratingFor(answer: { correct: boolean; sureness: Sureness; easy?: boolean }): Grade {
  if (!answer.correct) return "again";
  if (answer.sureness === "low") return "hard";
  if (answer.sureness === "high" && answer.easy) return "easy";
  return "good";
}

/** A wrong answer given with high confidence (the hypercorrection case). */
export function isConfidentError(correct: boolean | null | undefined, confidence: number | null | undefined): boolean {
  return correct === false && confidence !== null && confidence !== undefined && surenessOf(confidence) === "high";
}

/**
 * Days within which a corrected confident error is asked again. High-confidence
 * errors are corrected more often after feedback (Butterfield & Metcalfe 2001),
 * but the old belief tends to come back over the following week (Butler, Fazio
 * & Marsh 2011), so the first right answer after one is checked again soon,
 * however long FSRS would otherwise wait.
 */
export const CONFIDENT_ERROR_RECHECK_DAYS = 2;

/**
 * Where a card's next review goes once FSRS has scheduled it. A flagged card
 * (a confident error not yet re-checked) answered correctly is capped at
 * CONFIDENT_ERROR_RECHECK_DAYS and the flag cleared; a new confident error
 * sets the flag (FSRS's "again" already brings it back within minutes).
 */
export function hypercorrect(input: {
  due: Date;
  now: Date;
  flagged: boolean;
  correct: boolean | null | undefined;
  confidence: number | null | undefined;
}): { due: Date; flagged: boolean } {
  if (isConfidentError(input.correct, input.confidence)) return { due: input.due, flagged: true };
  if (input.flagged && input.correct === true) {
    const cap = new Date(input.now.getTime() + CONFIDENT_ERROR_RECHECK_DAYS * 86_400_000);
    return { due: input.due < cap ? input.due : cap, flagged: false };
  }
  return { due: input.due, flagged: input.flagged };
}

// ---------------------------------------------------------------------------
// Learner answers
// ---------------------------------------------------------------------------

export const GuessResponse = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), option: z.number().int().min(0).max(4) }),
  z.object({ kind: z.literal("number"), value: z.number().finite() }),
  z.object({
    kind: z.literal("year"),
    year: z.number().int().min(1).max(10000),
    era: z.enum(["BCE", "CE"]),
  }),
]);
export type GuessResponse = z.infer<typeof GuessResponse>;

export const CheckResponse = z.discriminatedUnion("kind", [
  /** Free recall is graded by the learner against the answer shown. */
  z.object({ kind: z.literal("recall"), recalled: z.boolean() }),
  /** Claim ids, earliest first. */
  z.object({ kind: z.literal("order"), order: z.array(z.uuid()).min(3).max(5) }),
  /** [longitude, latitude]. */
  z.object({
    kind: z.literal("place"),
    at: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  }),
]);
export type CheckResponse = z.infer<typeof CheckResponse>;

/** Grading outcome, stored with the answer. */
export const LearnResult = z.object({
  correct: z.boolean(),
  /** Number and year guesses: within the block's tolerance. */
  close: z.boolean().optional(),
  /** Place answers: distance from the tap to the place (0 inside its outline). */
  distanceKm: z.number().nonnegative().optional(),
  /** Order answers: how many items were in the right position, and the right order. */
  placed: z.number().int().nonnegative().optional(),
  order: z.array(z.uuid()).optional(),
});
export type LearnResult = z.infer<typeof LearnResult>;

export class GradingError extends Error {
  override name = "GradingError";
}

/** A guess against the block's answer. A choice is right or wrong; numbers and years can be close. */
export function gradeGuess(answer: GuessAnswer, guess: GuessResponse): LearnResult {
  if (answer.kind !== guess.kind) throw new GradingError(`expected a ${answer.kind} answer, got ${guess.kind}`);
  if (answer.kind === "choice" && guess.kind === "choice") {
    if (guess.option >= answer.options.length) throw new GradingError("no such option");
    return { correct: guess.option === answer.correct };
  }
  if (answer.kind === "number" && guess.kind === "number") {
    const off = Math.abs(guess.value - answer.value);
    const close = answer.value === 0 ? off === 0 : off / Math.abs(answer.value) <= answer.tolerance;
    return { correct: guess.value === answer.value, close };
  }
  if (answer.kind === "year" && guess.kind === "year") {
    const want = toAstronomicalYear(answer.year, answer.era);
    const got = toAstronomicalYear(guess.year, guess.era);
    return { correct: want === got, close: Math.abs(want - got) <= answer.tolerance };
  }
  throw new GradingError("unsupported guess");
}

export interface DatedItem {
  claimId: string;
  bounds: DateBounds | null;
}

/**
 * The right order of dated claims, earliest first, or the reason it cannot be
 * graded: a claim without a date, or two whose start dates overlap (then
 * either order is defensible, so the question is not asked).
 */
export function chronologicalOrder(items: DatedItem[]): { order: string[] } | { problem: string } {
  const missing = items.filter((i) => i.bounds?.startMin === null || i.bounds?.startMin === undefined);
  if (missing.length) return { problem: `undated: ${missing.map((i) => i.claimId).join(", ")}` };
  const sorted = [...items].sort((a, b) => a.bounds!.startMin! - b.bounds!.startMin!);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!.bounds!;
    const next = sorted[i]!.bounds!;
    if ((prev.startMax ?? prev.startMin!) > next.startMin!)
      return { problem: `dates overlap: ${sorted[i - 1]!.claimId} and ${sorted[i]!.claimId}` };
  }
  return { order: sorted.map((i) => i.claimId) };
}

export function gradeOrder(right: string[], given: string[]): LearnResult {
  if (given.length !== right.length || new Set(given).size !== given.length || !given.every((id) => right.includes(id)))
    throw new GradingError("the answer must list each item once");
  const placed = given.filter((id, i) => right[i] === id).length;
  return { correct: placed === right.length, placed, order: right };
}

const EARTH_KM = 6371.0088;

/** Great-circle distance in km between two [lon, lat] points. */
export function haversineKm(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance from a point to a geometry: 0 inside a polygon, else to the nearest vertex. */
export function distanceToGeometryKm(point: Position, geometry: Geometry): number {
  switch (geometry.type) {
    case "Point":
      return haversineKm(point, geometry.coordinates as Position);
    case "MultiPoint":
    case "LineString":
      return Math.min(...geometry.coordinates.map((c) => haversineKm(point, c as Position)));
    case "MultiLineString":
      return Math.min(...geometry.coordinates.flat().map((c) => haversineKm(point, c as Position)));
    case "Polygon":
    case "MultiPolygon": {
      const mp = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as Position[][][];
      if (pointInMultiPolygon(point, mp)) return 0;
      return Math.min(...mp.flat(2).map((c) => haversineKm(point, c)));
    }
  }
}

export function gradePlace(geometry: Geometry, at: Position, toleranceKm: number): LearnResult {
  const distanceKm = Math.round(distanceToGeometryKm(at, geometry));
  return { correct: distanceKm <= toleranceKm, distanceKm };
}

/** What a check item needs from the database to be graded. */
export interface CheckFacts {
  /** Order items: each claim's date bounds. */
  dates?: Map<string, DateBounds | null>;
  /** Place items: the entity's stored geometry, if any. */
  geometry?: Geometry | null;
}

export function gradeCheck(item: CheckItem, response: CheckResponse, facts: CheckFacts = {}): LearnResult {
  if (item.kind !== response.kind) throw new GradingError(`expected a ${item.kind} answer, got ${response.kind}`);
  if (item.kind === "recall" && response.kind === "recall") return { correct: response.recalled };
  if (item.kind === "order" && response.kind === "order") {
    const ids = item.items.map((x) => x.claimId);
    const right = chronologicalOrder(ids.map((claimId) => ({ claimId, bounds: facts.dates?.get(claimId) ?? null })));
    if ("problem" in right) throw new GradingError(`this question cannot be graded (${right.problem})`);
    return gradeOrder(right.order, response.order);
  }
  if (item.kind === "place" && response.kind === "place") {
    if (!facts.geometry) throw new GradingError("this place has no stored coordinates");
    return gradePlace(facts.geometry, response.at, item.toleranceKm);
  }
  throw new GradingError("unsupported check");
}

/** "Did you believe this?", asked on a misconception. */
export const Belief = z.enum(["yes", "no", "unsure"]);
export type Belief = z.infer<typeof Belief>;

// ---------------------------------------------------------------------------
// Learning prompts written for claims
// ---------------------------------------------------------------------------

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

/** Capitalised words that start a question and so are not names. */
const QUESTION_WORDS = new Set(
  "what which who whom whose when where why how did does do was were is are according name in on at by for from of to with after before during under as".split(" "),
);

/**
 * Whether a recall prompt stays inside its claim: every number and every name
 * (a capitalised word that is not the first word or a question word) in the
 * prompt must also appear in the claim's text. A prompt can rephrase, but it
 * cannot bring in a date, a figure or a person the claim does not state.
 * Returns the words that fail, empty when the prompt is grounded.
 */
export function ungroundedTerms(prompt: string, claimText: string): string[] {
  const claim = fold(claimText);
  const bad: string[] = [];
  for (const n of prompt.match(/\d[\d,.]*/g) ?? []) if (!claim.includes(fold(n.replace(/[.,]$/, "")))) bad.push(n);
  const words = prompt.match(/[\p{Lu}][\p{L}\p{M}'’-]*/gu) ?? [];
  const first = prompt.match(/[\p{L}]+/u)?.[0];
  for (const w of words) {
    if (w === first || QUESTION_WORDS.has(fold(w))) continue;
    const stem = fold(w).replace(/['’]s$/, "");
    if (!claim.includes(stem)) bad.push(w);
  }
  return bad;
}

/**
 * A claim's stored short answer, when it stays inside the claim; null
 * otherwise, and the claim's own text answers instead. An answer written for
 * an earlier wording can carry a name or date the claim no longer states.
 */
export function groundedAnswer(learning: { answer?: string } | null | undefined, claimText: string): string | null {
  const answer = learning?.answer;
  return answer && !ungroundedTerms(answer, claimText).length ? answer : null;
}

// ---------------------------------------------------------------------------
// Words for guesses (shared by the web app and progress summaries)
// ---------------------------------------------------------------------------

const NUM = new Intl.NumberFormat("en-GB");

/** "150,000 people", "1838 CE", or the right option. */
export function formatGuessAnswer(a: GuessAnswer): string {
  if (a.kind === "choice") return a.options[a.correct] ?? "";
  if (a.kind === "number") return `${NUM.format(a.value)}${a.unit ? ` ${a.unit}` : ""}`;
  return `${a.year} ${a.era}`;
}

export function formatGuessResponse(a: GuessAnswer, r: GuessResponse): string {
  if (r.kind === "choice") return a.kind === "choice" ? (a.options[r.option] ?? "") : "";
  if (r.kind === "number") return `${NUM.format(r.value)}${a.kind === "number" && a.unit ? ` ${a.unit}` : ""}`;
  return `${r.year} ${r.era}`;
}

/**
 * How far off a guess was, from 0 (right) to 1 (far off or the wrong option),
 * to pick the part most worth reading in full.
 */
export function guessMiss(a: GuessAnswer, r: GuessResponse): number {
  if (a.kind === "choice" && r.kind === "choice") return r.option === a.correct ? 0 : 1;
  if (a.kind === "number" && r.kind === "number") return a.value === 0 ? (r.value === 0 ? 0 : 1) : Math.min(1, Math.abs(r.value - a.value) / Math.abs(a.value));
  if (a.kind === "year" && r.kind === "year") {
    const off = Math.abs(toAstronomicalYear(r.year, r.era) - toAstronomicalYear(a.year, a.era));
    return Math.min(1, off / Math.max(50, a.tolerance * 10));
  }
  return 1;
}
