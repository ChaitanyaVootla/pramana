import { z } from "zod";
import { Belief, CheckResponse, GuessResponse, Sureness } from "./learn";
import { PageRef } from "./ops";

/** Inputs for non-content actions (they are audited, but not reviewed as changesets). */

/** FSRS ratings. */
export const ReviewRating = z.enum(["again", "hard", "good", "easy"]);
export type ReviewRating = z.infer<typeof ReviewRating>;

export const ReviewInput = z
  .object({
    claimId: z.uuid(),
    /** The FSRS rating. Omit it to derive it from `correct` and `sureness` (see ratingFor). */
    rating: ReviewRating.optional(),
    /** Self-reported confidence before seeing the answer, 0–100 (calibration). */
    confidence: z.number().int().min(0).max(100).optional(),
    /** The same as three levels ("How sure are you?"); sets `confidence` when that is omitted. */
    sureness: Sureness.optional(),
    /** Whether the learner's answer was right (for true/false and prompt cards). */
    correct: z.boolean().optional(),
    /** Right, sure, and it felt easy: rated "easy" instead of "good". */
    easy: z.boolean().optional(),
  })
  .refine((r) => r.rating !== undefined || (r.correct !== undefined && r.sureness !== undefined), {
    message: "give a rating, or whether the answer was right and how sure the learner was",
  });
export type ReviewInput = z.infer<typeof ReviewInput>;

/** Where a learner answered: a page and a block on it. */
const OnPage = {
  page: PageRef,
  blockId: z.string().min(1).max(64),
};

/** A "Guess first" answer. Only the first guess counts; later ones are refused. */
export const GuessInput = z.object({
  ...OnPage,
  response: GuessResponse,
  sureness: Sureness,
});
export type GuessInput = z.infer<typeof GuessInput>;

/** An answer to one question of an end-of-chapter check. Every attempt is kept. */
export const CheckAnswerInput = z.object({
  ...OnPage,
  itemId: z.string().min(1).max(64),
  response: CheckResponse,
  sureness: Sureness,
});
export type CheckAnswerInput = z.infer<typeof CheckAnswerInput>;

/** "Did you believe this?" on a misconception block. The latest answer counts. */
export const BeliefInput = z.object({
  ...OnPage,
  belief: Belief,
});
export type BeliefInput = z.infer<typeof BeliefInput>;

export const SupportVerdict = z.enum(["supports", "partial", "unsupported"]);
export type SupportVerdict = z.infer<typeof SupportVerdict>;

/** A new learner's first questions, which belong to no page: order the ages, then place a city. */
export const FirstStepInput = z.object({
  step: z.enum(["ages", "place"]),
  /** "ages": entity ids, earliest first; "place": [lon, lat]. */
  response: CheckResponse,
  sureness: Sureness,
});
export type FirstStepInput = z.infer<typeof FirstStepInput>;

/** A chapter the learner has read to its end, or skimmed in its one-minute version (each recorded once). */
export const ChapterReadInput = z.object({
  page: PageRef,
  chapterId: z.string().min(1).max(64),
  how: z.enum(["read", "skimmed"]).default("read"),
});
export type ChapterReadInput = z.input<typeof ChapterReadInput>;

/** "Skip" on a "Guess first" question: the learner chose not to guess. */
export const GuessSkipInput = z.object({ page: PageRef, blockId: z.string().min(1).max(64) });
export type GuessSkipInput = z.infer<typeof GuessSkipInput>;

/**
 * A review answered on the device and sent later (offline study). `key` makes
 * it idempotent: the same answer synced twice is recorded once. `answeredAt`
 * is when the learner answered; the server schedules from that time.
 */
export const QueuedReviewInput = z.object({
  key: z.uuid(),
  answeredAt: z.iso.datetime(),
  claimId: z.uuid(),
  correct: z.boolean(),
  sureness: Sureness,
  easy: z.boolean().optional(),
});
export type QueuedReviewInput = z.infer<typeof QueuedReviewInput>;

export const QueuedReviewsInput = z.object({ reviews: z.array(QueuedReviewInput).min(1).max(200) });
