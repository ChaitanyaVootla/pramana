/**
 * Public learning statistics are aggregates only. A value computed from fewer
 * than MIN_GROUP distinct learners is withheld (k-anonymity with k = 5): with
 * one or two learners a "share who believed this" is simply their answer. The
 * number of responses and of learners is still shown, so readers can see that
 * data exists and how much. Per-person answers are never published.
 */
export const MIN_GROUP = 5;

export interface Aggregate<T> {
  /** Answers counted (all learners). */
  responses: number;
  /** Distinct learners behind them. */
  learners: number;
  /** The value, or null when fewer than `MIN_GROUP` learners contributed. */
  value: T | null;
}

export function aggregate<T>(responses: number, learners: number, value: () => T, k: number = MIN_GROUP): Aggregate<T> {
  return { responses, learners, value: learners >= k ? value() : null };
}
