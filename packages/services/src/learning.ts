import {
  Belief,
  BeliefInput,
  CheckAnswerInput,
  ChapterReadInput,
  GuessSkipInput,
  formatGuessAnswer,
  formatGuessResponse,
  guessMiss,
  CheckResponse,
  QueuedReviewsInput,
  chronologicalOrder,
  FirstStepInput,
  gradeOrder,
  gradePlace,
  claimIdsInBlock,
  claimIdsInCheckItem,
  dateBounds,
  GradingError,
  gradeCheck,
  gradeGuess,
  groundedAnswer,
  GuessInput,
  GuessResponse,
  hypercorrect,
  isConfidentError,
  isUuid,
  LearnResult,
  ratingFor,
  ReviewInput,
  SURENESS_PERCENT,
  toFuzzyDate,
  uuidv7,
  type Block,
  type DateBounds,
  type FuzzyDate,
  type ReviewRating,
} from "@pramana/core";
import {
  cards,
  claimRelations,
  claims,
  entities,
  entityLinks,
  getDb,
  learnerResponses,
  pages,
  pageVisits,
  reviewLogs,
  type DbOrTx,
} from "@pramana/db";
import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { createEmptyCard, fsrs, Rating, type Card, type Grade } from "ts-fsrs";
import { recordEvent } from "./audit";
import type { ActorContext } from "./context";
import {
  getPageView,
  listPages,
  loadClaimCards,
  loadEntityCards,
  type ClaimCard,
  type EntityCard,
} from "./queries";
import { NotFoundError, ValidationError } from "./util";
import { versionedCache } from "./cache";

/**
 * Spaced repetition over claims (FSRS via ts-fsrs). Each claim can become a
 * card. Card fronts depend on the claim: misconceptions become true/false
 * questions, claims with a `learning.prompt` become Q&A, and other claims
 * ask the learner to recall the evidence ("how well supported is this?").
 */

const scheduler = fsrs({ enable_fuzz: true });

// Content only (never the learner's state), so these are kept until anything is written.
/** The published pages of a kind. */
const pagesOfKind = versionedCache((kind: string) => kind, (kind: string) => listPages({ kind }));
/** Every page's blocks, by page id and by slug. */
const blocksByPage = versionedCache(
  () => "all",
  async () =>
    new Map(
      (await getDb().select({ id: pages.id, slug: pages.slug, blocks: pages.blocks }).from(pages)).flatMap((r) => [
        [r.id, r.blocks],
        [r.slug, r.blocks],
      ]),
    ),
);
const RATING: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export interface StudyCard {
  cardId: string;
  claimId: string;
  due: Date;
  state: string;
  reps: number;
  lapses: number;
  /** Last time the learner was sure and wrong; this review checks the correction held. */
  confidentError: boolean;
  front: { mode: "true_false" | "prompt" | "evidence"; question: string };
  back: {
    answer: string;
    claim: string;
    assessment: string;
    corrections: string[];
    sources: string[];
  };
}

const STATE_NAMES = ["new", "learning", "review", "relearning"];

/** Source tiers in plain words, for card backs. */
const TIER_WORDS: Record<string, string> = { primary: "a primary source", secondary: "scholarship", tertiary: "an encyclopedia" };

function reviveCard(raw: Record<string, unknown>): Card {
  const c = raw as unknown as Card & { due: string; last_review?: string };
  return {
    ...c,
    due: new Date(c.due),
    ...(c.last_review ? { last_review: new Date(c.last_review) } : {}),
  } as Card;
}

export async function addCards(ctx: ActorContext, claimIds: string[]): Promise<{ added: number }> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const existing = await db
    .select({ claimId: cards.claimId })
    .from(cards)
    .where(and(eq(cards.actorId, learner), inArray(cards.claimId, claimIds)));
  const have = new Set(existing.map((e) => e.claimId));
  const fresh = [...new Set(claimIds)].filter((id) => !have.has(id));
  if (!fresh.length) return { added: 0 };
  const now = new Date();
  await db.insert(cards).values(
    fresh.map((claimId) => {
      const card = createEmptyCard(now);
      return {
        id: uuidv7(),
        actorId: learner,
        claimId,
        fsrs: card as unknown as Record<string, unknown>,
        due: card.due,
      };
    }),
  );
  await recordEvent(db, ctx, {
    action: "cards.added",
    subjectType: "learner",
    subjectId: learner,
    data: { claimIds: fresh },
  });
  return { added: fresh.length };
}

/** Adds every claim on a page to the learner's deck. */
export async function addPageToDeck(
  ctx: ActorContext,
  pageRef: string,
): Promise<{ added: number }> {
  const view = await getPageView(pageRef);
  return addCards(ctx, Object.keys(view.claims));
}

/**
 * New cards a learner meets per day (`PRAMANA_NEW_CARDS_PER_DAY`, default 20).
 * Reviews of cards already met are never capped; new ones wait their turn, so
 * adding a whole page to the reviews does not bury the learner on day one.
 */
export function newCardsPerDay(): number {
  const n = Number(process.env.PRAMANA_NEW_CARDS_PER_DAY ?? 20);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 20;
}

export interface TodaysCards {
  /** Cards already met that are due: all of them. */
  reviews: Set<string>;
  /** New cards to meet today, oldest in the deck first, within what is left of today's allowance. */
  fresh: Set<string>;
  /** New cards due that wait for another day. */
  waiting: number;
  /** Every new card due, and how many more may be met today. */
  newDue: Set<string>;
  allowance: number;
  /** New cards met so far today, and the daily allowance. */
  metToday: number;
  perDay: number;
}

/**
 * What the learner studies today (by claim id): every due review, and new
 * cards up to the day's allowance (less those already met today). With
 * `claimIds`, new cards are chosen among those claims (one era's cards) from
 * the same allowance.
 */
export async function todaysCards(
  db: DbOrTx,
  learner: string,
  options: { now?: Date; until?: Date; claimIds?: string[] } = {},
): Promise<TodaysCards> {
  const now = options.now ?? new Date();
  const until = options.until ?? now;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      id: cards.id,
      claimId: cards.claimId,
      fsrs: cards.fsrs,
      due: cards.due,
      createdAt: cards.createdAt,
    })
    .from(cards)
    .where(and(eq(cards.actorId, learner), lte(cards.due, until)));
  const firstSeen = await db
    .select({ cardId: reviewLogs.cardId, first: sql<Date>`min(${reviewLogs.at})` })
    .from(reviewLogs)
    .where(eq(reviewLogs.actorId, learner))
    .groupBy(reviewLogs.cardId);
  const metToday = firstSeen.filter((f) => new Date(f.first) >= startOfDay).length;
  const perDay = newCardsPerDay();
  const allowance = Math.max(0, perDay - metToday);
  const inScope = options.claimIds ? new Set(options.claimIds) : null;
  const reviews = new Set<string>();
  const newOnes: typeof rows = [];
  for (const r of rows) {
    if (inScope && !inScope.has(r.claimId)) continue;
    if (reviveCard(r.fsrs).state === 0) newOnes.push(r);
    else reviews.add(r.claimId);
  }
  newOnes.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const fresh = new Set(newOnes.slice(0, allowance).map((r) => r.claimId));
  return {
    reviews,
    fresh,
    waiting: Math.max(0, newOnes.length - fresh.size),
    newDue: new Set(newOnes.map((r) => r.claimId)),
    allowance,
    metToday,
    perDay,
  };
}

export async function dueCards(
  ctx: ActorContext,
  /** `until`: include cards due up to then (default now), for studying offline over the next days. */
  options: { limit?: number; pageId?: string; until?: Date } = {},
): Promise<StudyCard[]> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  let claimFilter: string[] | null = null;
  if (options.pageId) claimFilter = Object.keys((await getPageView(options.pageId)).claims);
  const today = await todaysCards(db, learner, {
    until: options.until,
    ...(claimFilter ? { claimIds: claimFilter } : {}),
  });
  const allowed = [...today.reviews, ...today.fresh];
  const rows = await db
    .select({ card: cards, claim: claims })
    .from(cards)
    .innerJoin(claims, eq(claims.id, cards.claimId))
    .where(
      and(
        eq(cards.actorId, learner),
        lte(cards.due, options.until ?? new Date()),
        inArray(cards.claimId, allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]),
        claimFilter
          ? inArray(
              cards.claimId,
              claimFilter.length ? claimFilter : ["00000000-0000-0000-0000-000000000000"],
            )
          : undefined,
      ),
    )
    .orderBy(asc(cards.due))
    .limit(200);
  const limit = Math.min(options.limit ?? 20, 100);
  const ids = rows.map((r) => r.claim.id);
  const corrections = ids.length
    ? await db
        .select({ toId: claimRelations.toId, text: claims.text })
        .from(claimRelations)
        .innerJoin(claims, eq(claims.id, claimRelations.fromId))
        .where(and(inArray(claimRelations.toId, ids), eq(claimRelations.type, "corrects")))
    : [];
  const cardsById = await loadClaimCards(db, ids);
  const out = rows.map(({ card, claim }) => {
    const state = reviveCard(card.fsrs);
    const fix = corrections.filter((c) => c.toId === claim.id).map((c) => c.text);
    let front: StudyCard["front"];
    let answer: string;
    if (claim.kind === "misconception") {
      front = { mode: "true_false", question: `True or false? “${claim.text}”` };
      answer =
        claim.assessment === "refuted"
          ? "False — this is a misconception."
          : `Assessment: ${claim.assessment.replace(/_/g, " ")}.`;
    } else if (claim.learning?.prompt) {
      front = { mode: "prompt", question: claim.learning.prompt };
      answer = groundedAnswer(claim.learning, claim.text) ?? claim.text;
    } else {
      front = {
        mode: "evidence",
        question: `How well supported is this, and by what evidence? “${claim.text}”`,
      };
      answer = `Assessment: ${claim.assessment.replace(/_/g, " ")}.${claim.assessmentNote ? ` ${claim.assessmentNote}` : ""}`;
    }
    return {
      cardId: card.id,
      claimId: claim.id,
      due: card.due,
      state: STATE_NAMES[state.state] ?? String(state.state),
      reps: state.reps,
      lapses: state.lapses,
      confidentError: card.confidentErrorAt !== null,
      front,
      back: {
        answer,
        claim: claim.text,
        assessment: claim.assessment,
        corrections: fix,
        sources: (cardsById.get(claim.id)?.citations ?? [])
          .filter((c) => c.stance !== "mentions")
          .map(
            (c) =>
              `${c.excerpt.source.short}${c.excerpt.locatorLabel ? `, ${c.excerpt.locatorLabel}` : ""} (${TIER_WORDS[c.excerpt.source.tier] ?? c.excerpt.source.tier})`,
          ),
      },
    };
  });
  // Recall first: a question about the evidence ("how well supported is this?")
  // assumes the learner already knows the claim, so it waits behind questions
  // that ask for the claim itself. Otherwise the most overdue first.
  const rank = (c: StudyCard) => (c.front.mode === "evidence" ? 1 : 0);
  return out.sort((a, b) => rank(a) - rank(b) || a.due.getTime() - b.due.getTime()).slice(0, limit);
}

export interface ReviewOutcome {
  nextDue: Date;
  state: string;
  rating: ReviewRating;
  /** Sure and wrong: the card is flagged and comes back soon (see hypercorrect). */
  confidentError: boolean;
}

/**
 * Applies one review to a card: FSRS schedules it, then the hypercorrection
 * rule may bring it forward. Logged in review_logs and the audit trail.
 */
async function scheduleCard(
  db: DbOrTx,
  ctx: ActorContext,
  row: typeof cards.$inferSelect,
  review: {
    rating: ReviewRating;
    confidence: number | null;
    correct: boolean | null;
    via: "review" | "check" | "queued";
    blockId?: string;
    /** For queued answers: when the learner answered, and the client's idempotency key. */
    answeredAt?: Date;
    clientKey?: string;
  },
): Promise<ReviewOutcome> {
  const prior = reviveCard(row.fsrs);
  // Schedule from the moment of answering, but never before the card's last review.
  const received = new Date();
  const now =
    review.answeredAt && review.answeredAt < received
      ? new Date(Math.max(review.answeredAt.getTime(), prior.last_review?.getTime() ?? 0))
      : received;
  const result = scheduler.next(prior, now, RATING[review.rating]);
  const { due, flagged } = hypercorrect({
    due: result.card.due,
    now,
    flagged: row.confidentErrorAt !== null,
    correct: review.correct,
    confidence: review.confidence,
  });
  const confidentError = isConfidentError(review.correct, review.confidence);
  const card = { ...result.card, due };
  await db
    .update(cards)
    .set({
      fsrs: card as unknown as Record<string, unknown>,
      due,
      confidentErrorAt: flagged ? (confidentError ? now : row.confidentErrorAt) : null,
    })
    .where(eq(cards.id, row.id));
  await db.insert(reviewLogs).values({
    id: uuidv7(),
    cardId: row.id,
    actorId: row.actorId,
    rating: review.rating,
    confidence: review.confidence,
    correct: review.correct === null ? null : review.correct ? 1 : 0,
    log: result.log as unknown as Record<string, unknown>,
    at: now,
    clientKey: review.clientKey ?? null,
  });
  // Answers that reached the server more than a minute after they were given were made offline.
  const syncedLater = review.answeredAt
    ? received.getTime() - review.answeredAt.getTime() > 60_000
    : false;
  // Reviews are personal progress rather than content; one event per review keeps the trail complete.
  await recordEvent(db, ctx, {
    action: "card.reviewed",
    subjectType: "claim",
    subjectId: row.claimId,
    data: {
      rating: review.rating,
      confidence: review.confidence,
      correct: review.correct,
      confidentError,
      via: review.via,
      ...(review.blockId ? { blockId: review.blockId } : {}),
      ...(review.answeredAt
        ? { answeredAt: review.answeredAt.toISOString(), syncedLater, clientKey: review.clientKey }
        : {}),
    },
  });
  return {
    nextDue: due,
    state: STATE_NAMES[card.state] ?? String(card.state),
    rating: review.rating,
    confidentError,
  };
}

/**
 * Records a review. Without an explicit rating, it is derived from whether the
 * answer was right and how sure the learner was (ratingFor).
 */
export async function recordReview(ctx: ActorContext, raw: unknown): Promise<ReviewOutcome> {
  const input = ReviewInput.parse(raw);
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const confidence = input.confidence ?? (input.sureness ? SURENESS_PERCENT[input.sureness] : null);
  const rating =
    input.rating ??
    ratingFor({ correct: input.correct!, sureness: input.sureness!, easy: input.easy });
  let row = await db.query.cards.findFirst({
    where: and(eq(cards.actorId, learner), eq(cards.claimId, input.claimId)),
  });
  if (!row) {
    await addCards(ctx, [input.claimId]);
    row = await db.query.cards.findFirst({
      where: and(eq(cards.actorId, learner), eq(cards.claimId, input.claimId)),
    });
  }
  if (!row) throw new NotFoundError(`claim ${input.claimId} not found`);
  return scheduleCard(db, ctx, row, {
    rating,
    confidence,
    correct: input.correct ?? null,
    via: "review",
  });
}

/**
 * Reviews answered on the device and sent later (offline study), oldest
 * first. Each carries an idempotency key: one already recorded is reported as
 * a duplicate and not applied again. Answers older than 30 days, or dated in
 * the future, are refused.
 */
export async function recordQueuedReviews(
  ctx: ActorContext,
  raw: unknown,
): Promise<
  { key: string; status: "recorded" | "duplicate" | "refused"; nextDue?: Date; error?: string }[]
> {
  const input = QueuedReviewsInput.parse(raw);
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const now = Date.now();
  const out: {
    key: string;
    status: "recorded" | "duplicate" | "refused";
    nextDue?: Date;
    error?: string;
  }[] = [];
  for (const r of [...input.reviews].sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))) {
    const answeredAt = new Date(r.answeredAt);
    if (answeredAt.getTime() > now + 5 * 60_000 || answeredAt.getTime() < now - 30 * 86_400_000) {
      out.push({ key: r.key, status: "refused", error: "answered too long ago, or in the future" });
      continue;
    }
    const seen = await db.query.reviewLogs.findFirst({
      where: and(eq(reviewLogs.actorId, learner), eq(reviewLogs.clientKey, r.key)),
    });
    if (seen) {
      out.push({ key: r.key, status: "duplicate" });
      continue;
    }
    let row = await db.query.cards.findFirst({
      where: and(eq(cards.actorId, learner), eq(cards.claimId, r.claimId)),
    });
    if (!row) {
      await addCards(ctx, [r.claimId]);
      row = await db.query.cards.findFirst({
        where: and(eq(cards.actorId, learner), eq(cards.claimId, r.claimId)),
      });
    }
    if (!row) {
      out.push({ key: r.key, status: "refused", error: `claim ${r.claimId} not found` });
      continue;
    }
    try {
      const outcome = await scheduleCard(db, ctx, row, {
        rating: ratingFor({ correct: r.correct, sureness: r.sureness, easy: r.easy }),
        confidence: SURENESS_PERCENT[r.sureness],
        correct: r.correct,
        via: "queued",
        answeredAt,
        clientKey: r.key,
      });
      out.push({ key: r.key, status: "recorded", nextDue: outcome.nextDue });
    } catch (error) {
      // A concurrent sync of the same key loses the race on the unique index.
      const dup = await db.query.reviewLogs.findFirst({
        where: and(eq(reviewLogs.actorId, learner), eq(reviewLogs.clientKey, r.key)),
      });
      out.push(
        dup
          ? { key: r.key, status: "duplicate" }
          : {
              key: r.key,
              status: "refused",
              error: error instanceof Error ? error.message : String(error),
            },
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Answers on pages: "Guess first", end-of-chapter checks, prior beliefs
// ---------------------------------------------------------------------------

async function pageRow(db: DbOrTx, ref: string) {
  const row = isUuid(ref)
    ? await db.query.pages.findFirst({ where: eq(pages.id, ref) })
    : await db.query.pages.findFirst({ where: eq(pages.slug, ref) });
  if (!row) throw new NotFoundError(`page "${ref}" not found`);
  return row;
}

function blockOf<T extends Block["type"]>(
  blocks: Block[],
  id: string,
  type: T,
  slug: string,
): Extract<Block, { type: T }> {
  const b = blocks.find((x) => x.id === id);
  if (!b) throw new NotFoundError(`no block "${id}" on /${slug}`);
  if (b.type !== type)
    throw new ValidationError(`block "${id}" on /${slug} is a ${b.type}, not a ${type}`);
  return b as Extract<Block, { type: T }>;
}

function asResult(raw: unknown): LearnResult | null {
  const parsed = LearnResult.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export interface GuessState {
  response: GuessResponse;
  result: LearnResult;
  confidence: number | null;
  at: Date;
}

export interface CheckItemState {
  response: CheckResponse;
  result: LearnResult;
  confidence: number | null;
  attempts: number;
  at: Date;
}

/**
 * A "Guess first" answer. Only the first guess counts (that is the one the
 * pretesting effect is about): a second call returns the stored guess.
 */
export async function recordGuess(
  ctx: ActorContext,
  raw: unknown,
): Promise<GuessState & { already: boolean }> {
  const input = GuessInput.parse(raw);
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const page = await pageRow(db, input.page);
  const block = blockOf(page.blocks, input.blockId, "guess", page.slug);
  const prior = await db.query.learnerResponses.findFirst({
    where: and(
      eq(learnerResponses.actorId, learner),
      eq(learnerResponses.pageId, page.id),
      eq(learnerResponses.blockId, block.id),
      inArray(learnerResponses.kind, ["guess", "skip"]),
    ),
    orderBy: asc(learnerResponses.at),
  });
  if (prior?.kind === "skip")
    throw new ValidationError("this question was skipped; its answer is in the part's summary");
  if (prior) {
    const response = GuessResponse.safeParse(prior.response);
    const result = asResult(prior.result);
    if (response.success && result)
      return {
        response: response.data,
        result,
        confidence: prior.confidence,
        at: prior.at,
        already: true,
      };
  }
  let result: LearnResult;
  try {
    result = gradeGuess(block.answer, input.response);
  } catch (error) {
    if (error instanceof GradingError) throw new ValidationError(error.message);
    throw error;
  }
  const confidence = SURENESS_PERCENT[input.sureness];
  const at = new Date();
  await db.insert(learnerResponses).values({
    id: uuidv7(),
    actorId: learner,
    pageId: page.id,
    blockId: block.id,
    kind: "guess",
    claimId: isUuid(block.claimId) ? block.claimId : null,
    response: input.response as Record<string, unknown>,
    result: result as Record<string, unknown>,
    correct: result.correct ? 1 : 0,
    confidence,
    at,
  });
  await recordEvent(db, ctx, {
    action: "guess.recorded",
    subjectType: "page",
    subjectId: page.id,
    data: { blockId: block.id, response: input.response, result, confidence },
  });
  // The claim that answers the guess goes into the learner's reviews, to be met as a new card.
  if (isUuid(block.claimId)) await addCards(ctx, [block.claimId]);
  return { response: input.response, result, confidence, at, already: false };
}

/** Facts from the database a check item is graded against. */
async function checkFacts(db: DbOrTx, item: Extract<Block, { type: "check" }>["items"][number]) {
  if (item.kind === "order") {
    const ids = item.items.map((x) => x.claimId).filter(isUuid);
    const rows = ids.length
      ? await db
          .select({ id: claims.id, when: claims.when })
          .from(claims)
          .where(inArray(claims.id, ids))
      : [];
    const dates = new Map<string, DateBounds | null>();
    for (const r of rows) dates.set(r.id, r.when ? dateBounds(r.when as FuzzyDate) : null);
    return { dates };
  }
  if (item.kind === "place") {
    const row = isUuid(item.entity)
      ? await db.query.entities.findFirst({ where: eq(entities.id, item.entity) })
      : await db.query.entities.findFirst({ where: eq(entities.slug, item.entity) });
    return { geometry: row?.geo?.geometry ?? null };
  }
  return {};
}

/**
 * One answer to a question of an end-of-chapter check, graded against the
 * claims and entities in the database. Every attempt is kept. A recall answer
 * also counts as a review of the claim's card, if it is in the deck.
 */
export async function recordCheckAnswer(
  ctx: ActorContext,
  raw: unknown,
): Promise<{ result: LearnResult; confidence: number; review: ReviewOutcome | null }> {
  const input = CheckAnswerInput.parse(raw);
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const page = await pageRow(db, input.page);
  const block = blockOf(page.blocks, input.blockId, "check", page.slug);
  const item = block.items.find((i) => i.id === input.itemId);
  if (!item) throw new NotFoundError(`no question "${input.itemId}" in check "${block.id}"`);
  let result: LearnResult;
  try {
    result = gradeCheck(item, input.response, await checkFacts(db, item));
  } catch (error) {
    if (error instanceof GradingError) throw new ValidationError(error.message);
    throw error;
  }
  const confidence = SURENESS_PERCENT[input.sureness];
  const claimId = item.kind === "recall" && isUuid(item.claimId) ? item.claimId : null;
  await db.insert(learnerResponses).values({
    id: uuidv7(),
    actorId: learner,
    pageId: page.id,
    blockId: block.id,
    itemId: item.id,
    kind: "check",
    claimId,
    response: input.response as Record<string, unknown>,
    result: result as Record<string, unknown>,
    correct: result.correct ? 1 : 0,
    confidence,
  });
  await recordEvent(db, ctx, {
    action: "check.answered",
    subjectType: "page",
    subjectId: page.id,
    data: {
      blockId: block.id,
      itemId: item.id,
      kind: item.kind,
      response: input.response,
      result,
      confidence,
    },
  });
  let review: ReviewOutcome | null = null;
  // Whatever a learner answers about goes into their reviews (new cards still
  // wait their turn, see todaysCards); a recall answer counts as the card's review.
  const behind = claimIdsInCheckItem(item).filter(isUuid);
  if (behind.length) await addCards(ctx, behind);
  if (claimId) {
    const card = await db.query.cards.findFirst({
      where: and(eq(cards.actorId, learner), eq(cards.claimId, claimId)),
    });
    if (card)
      review = await scheduleCard(db, ctx, card, {
        rating: ratingFor({ correct: result.correct, sureness: input.sureness }),
        confidence,
        correct: result.correct,
        via: "check",
        blockId: block.id,
      });
  }
  return { result, confidence, review };
}

/** Adds the claims a check asks about to the learner's deck ("Add to my reviews"). */
export async function addCheckToDeck(
  ctx: ActorContext,
  pageRef: string,
  blockId: string,
): Promise<{ added: number }> {
  const page = await pageRow(getDb(), pageRef);
  const block = blockOf(page.blocks, blockId, "check", page.slug);
  return addCards(ctx, block.items.flatMap(claimIdsInCheckItem).filter(isUuid));
}

/** Adds every claim in a chapter (a part) to the learner's deck ("Add this part to my reviews"). */
export async function addChapterToDeck(ctx: ActorContext, pageRef: string, chapterId: string): Promise<{ added: number }> {
  const page = await pageRow(getDb(), pageRef);
  const run = chapterRuns(page.blocks).find((r) => r.id === chapterId);
  if (!run) throw new NotFoundError(`no chapter "${chapterId}" on /${page.slug}`);
  return addCards(ctx, [...new Set(run.blocks.flatMap(claimIdsInBlock).filter(isUuid))]);
}

/**
 * "Did you believe this?" on a misconception block. The latest answer counts.
 * A belief the learner held goes into their deck, so the correction is reviewed.
 */
export async function recordBelief(
  ctx: ActorContext,
  raw: unknown,
): Promise<{ belief: Belief; addedToDeck: boolean }> {
  const input = BeliefInput.parse(raw);
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const page = await pageRow(db, input.page);
  const block = blockOf(page.blocks, input.blockId, "misconception", page.slug);
  await db.insert(learnerResponses).values({
    id: uuidv7(),
    actorId: learner,
    pageId: page.id,
    blockId: block.id,
    kind: "belief",
    claimId: isUuid(block.claimId) ? block.claimId : null,
    response: { belief: input.belief },
  });
  await recordEvent(db, ctx, {
    action: "belief.recorded",
    subjectType: "claim",
    subjectId: isUuid(block.claimId) ? block.claimId : undefined,
    data: { pageId: page.id, blockId: block.id, belief: input.belief },
  });
  const added = input.belief === "yes" ? (await addCards(ctx, [block.claimId])).added : 0;
  return { belief: input.belief, addedToDeck: added > 0 };
}

export interface PageLearning {
  pageId: string;
  /** By guess block id: the first guess. */
  guesses: Record<string, GuessState>;
  /** By check block id, then item id: the latest attempt. */
  checks: Record<string, Record<string, CheckItemState>>;
  /** By misconception block id: the latest answer. */
  beliefs: Record<string, Belief>;
  /** Claims on the page that are in the learner's deck. */
  inDeck: string[];
  /** By chapter id: the four steps of the learner's own progress (see ChapterSteps). */
  chapters: Record<string, ChapterSteps>;
  /** Guess blocks the learner chose to skip. */
  skipped: string[];
}

/**
 * A learner's progress through one chapter, in four steps, drawn like the
 * evidence seal's four cells: read to its end (or only skimmed), guessed first, checked at the
 * end, and remembered later (at least half of its claims in the learner's
 * reviews were answered right after FSRS had moved them past the first days
 * of learning).
 */
export interface ChapterSteps {
  read: boolean;
  /** Read the part's one-minute version (its summary), not necessarily the whole part. */
  skimmed: boolean;
  guessed: boolean;
  checked: boolean;
  remembered: boolean;
}

/** A page's chapters as runs of blocks: the chapter block, then everything up to the next one. */
function chapterRuns(
  blocks: Block[],
): {
  id: string;
  title: string;
  when: Extract<Block, { type: "chapter" }>["when"];
  blocks: Block[];
}[] {
  const out: {
    id: string;
    title: string;
    when: Extract<Block, { type: "chapter" }>["when"];
    blocks: Block[];
  }[] = [];
  for (const b of blocks) {
    if (b.type === "chapter") out.push({ id: b.id, title: b.title, when: b.when, blocks: [] });
    else if (b.type !== "already_know" && b.type !== "meanwhile") out.at(-1)?.blocks.push(b);
  }
  return out;
}

/** Claims the learner remembers for the long run: latest review right, and the card past FSRS's learning steps. */
async function rememberedClaims(
  db: DbOrTx,
  learner: string,
  claimIds?: string[],
): Promise<Set<string>> {
  const rows = await db
    .select({ id: cards.id, claimId: cards.claimId, fsrs: cards.fsrs })
    .from(cards)
    .where(
      and(
        eq(cards.actorId, learner),
        claimIds ? inArray(cards.claimId, claimIds.length ? claimIds : [NIL]) : undefined,
      ),
    );
  const graduated = rows.filter((r) => reviveCard(r.fsrs).state === 2);
  if (!graduated.length) return new Set();
  const latest = await db
    .selectDistinctOn([reviewLogs.cardId], {
      cardId: reviewLogs.cardId,
      rating: reviewLogs.rating,
      correct: reviewLogs.correct,
    })
    .from(reviewLogs)
    .where(
      inArray(
        reviewLogs.cardId,
        graduated.map((r) => r.id),
      ),
    )
    .orderBy(reviewLogs.cardId, desc(reviewLogs.at));
  const right = new Set(
    latest
      .filter((l) => (l.correct === null ? l.rating !== "again" : l.correct === 1))
      .map((l) => l.cardId),
  );
  return new Set(graduated.filter((r) => right.has(r.id)).map((r) => r.claimId));
}

const NIL = "00000000-0000-0000-0000-000000000000";

function stepsFor(
  run: { id: string; blocks: Block[] },
  done: { read: Set<string>; skimmed: Set<string>; guessed: Set<string>; checked: Set<string> },
  deck: Set<string>,
  remembered: Set<string>,
): ChapterSteps {
  const ids = [...new Set(run.blocks.flatMap(claimIdsInBlock).filter(isUuid))].filter((id) =>
    deck.has(id),
  );
  return {
    read: done.read.has(run.id),
    skimmed: done.skimmed.has(run.id),
    guessed: run.blocks.some((b) => b.type === "guess" && done.guessed.has(b.id)),
    checked: run.blocks.some((b) => b.type === "check" && done.checked.has(b.id)),
    remembered: ids.length > 0 && ids.filter((id) => remembered.has(id)).length * 2 >= ids.length,
  };
}

/** Everything the learner has answered on a page, for drawing its questions. */
export async function pageLearning(ctx: ActorContext, pageRef: string): Promise<PageLearning> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const page = await pageRow(db, pageRef);
  const rows = await db
    .select()
    .from(learnerResponses)
    .where(and(eq(learnerResponses.actorId, learner), eq(learnerResponses.pageId, page.id)))
    .orderBy(asc(learnerResponses.at));
  const out: PageLearning = {
    pageId: page.id,
    guesses: {},
    checks: {},
    beliefs: {},
    inDeck: [],
    chapters: {},
    skipped: [],
  };
  const read = new Set<string>();
  const skimmed = new Set<string>();
  for (const r of rows) {
    if (r.kind === "guess") {
      if (out.guesses[r.blockId]) continue;
      const response = GuessResponse.safeParse(r.response);
      const result = asResult(r.result);
      if (response.success && result)
        out.guesses[r.blockId] = {
          response: response.data,
          result,
          confidence: r.confidence,
          at: r.at,
        };
    } else if (r.kind === "check") {
      const response = CheckResponse.safeParse(r.response);
      const result = asResult(r.result);
      if (!response.success || !result) continue;
      const items = (out.checks[r.blockId] ??= {});
      const attempts = (items[r.itemId]?.attempts ?? 0) + 1;
      items[r.itemId] = {
        response: response.data,
        result,
        confidence: r.confidence,
        attempts,
        at: r.at,
      };
    } else if (r.kind === "belief") {
      const belief = Belief.safeParse((r.response as { belief?: unknown }).belief);
      if (belief.success) out.beliefs[r.blockId] = belief.data;
    } else if (r.kind === "read") read.add(r.blockId);
    else if (r.kind === "skim") skimmed.add(r.blockId);
    else if (r.kind === "skip") out.skipped.push(r.blockId);
  }
  const claimIds = [...new Set(page.blocks.flatMap(claimIdsInBlock).filter(isUuid))];
  if (claimIds.length) {
    const deck = await db
      .select({ claimId: cards.claimId })
      .from(cards)
      .where(and(eq(cards.actorId, learner), inArray(cards.claimId, claimIds)));
    out.inDeck = deck.map((d) => d.claimId);
  }
  const remembered = await rememberedClaims(db, learner, claimIds);
  const done = {
    read,
    skimmed,
    guessed: new Set(Object.keys(out.guesses)),
    checked: new Set(Object.keys(out.checks)),
  };
  for (const run of chapterRuns(page.blocks))
    out.chapters[run.id] = stepsFor(run, done, new Set(out.inDeck), remembered);
  return out;
}

/**
 * Records that the learner read a chapter to its end, or skimmed its
 * one-minute version (`how`). Each is recorded once per chapter.
 */
export async function markChapterRead(
  ctx: ActorContext,
  raw: unknown,
): Promise<{ recorded: boolean }> {
  const input = ChapterReadInput.parse(raw);
  const kind = input.how === "skimmed" ? "skim" : "read";
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const page = await pageRow(db, input.page);
  blockOf(page.blocks, input.chapterId, "chapter", page.slug);
  const prior = await db.query.learnerResponses.findFirst({
    where: and(
      eq(learnerResponses.actorId, learner),
      eq(learnerResponses.pageId, page.id),
      eq(learnerResponses.blockId, input.chapterId),
      eq(learnerResponses.kind, kind),
    ),
  });
  if (prior) return { recorded: false };
  await db
    .insert(learnerResponses)
    .values({
      id: uuidv7(),
      actorId: learner,
      pageId: page.id,
      blockId: input.chapterId,
      kind,
      response: {},
    });
  await recordEvent(db, ctx, {
    action: kind === "skim" ? "chapter.skimmed" : "chapter.read",
    subjectType: "page",
    subjectId: page.id,
    data: { chapterId: input.chapterId },
  });
  return { recorded: true };
}

/**
 * "Skip" on a "Guess first" question. Recorded once; a skipped question can no
 * longer be guessed (its answer is in the part's summary).
 */
export async function skipGuess(ctx: ActorContext, raw: unknown): Promise<{ recorded: boolean }> {
  const input = GuessSkipInput.parse(raw);
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const page = await pageRow(db, input.page);
  const block = blockOf(page.blocks, input.blockId, "guess", page.slug);
  const prior = await db.query.learnerResponses.findFirst({
    where: and(
      eq(learnerResponses.actorId, learner),
      eq(learnerResponses.pageId, page.id),
      eq(learnerResponses.blockId, block.id),
      inArray(learnerResponses.kind, ["skip", "guess"]),
    ),
  });
  if (prior) return { recorded: false };
  await db
    .insert(learnerResponses)
    .values({
      id: uuidv7(),
      actorId: learner,
      pageId: page.id,
      blockId: block.id,
      kind: "skip",
      response: {},
    });
  await recordEvent(db, ctx, {
    action: "guess.skipped",
    subjectType: "page",
    subjectId: page.id,
    data: { blockId: block.id },
  });
  return { recorded: true };
}

// ---------------------------------------------------------------------------
// First steps: a new learner's two questions about the whole of Indian history
// ---------------------------------------------------------------------------

/** The place the first-steps map question asks for. */
export const FIRST_STEPS_PLACE = "pataliputra";
const FIRST_STEPS_TOLERANCE_KM = 150;

export interface FirstStepsAge {
  entityId: string;
  label: string;
  whenLabel: string | null;
  /** Astronomical start year (for drawing the answer). */
  start: number;
  pageSlug: string;
  pageTitle: string;
  /** The page's first part, to link to (`/p/<slug>#<chapterId>-title`). */
  firstChapterId: string | null;
  /** One short line on what the age is (the page summary, else the entity's description, to its first stop). */
  description: string | null;
}

export interface FirstSteps {
  /** Three to four ages with pages, whose start dates do not overlap, in time order (the client shuffles them). */
  ages: FirstStepsAge[];
  /** The city for "Tap where Pāṭaliputra was", with its Wikidata point; null if the platform lacks it. */
  place: { entity: EntityCard; toleranceKm: number; pageSlug: string | null; firstChapterId: string | null } | null;
  answered: Partial<
    Record<
      "ages" | "place",
      { response: CheckResponse; result: LearnResult; confidence: number | null }
    >
  >;
}

/** Era pages whose ages can be ordered by their stored start dates. */
async function firstStepsAges(): Promise<FirstStepsAge[]> {
  const eras = (await pagesOfKind("era")).filter(
    (p) => p.entity?.bounds?.startMin !== null && p.entity?.bounds?.startMin !== undefined,
  );
  eras.sort((a, b) => a.entity!.bounds!.startMin! - b.entity!.bounds!.startMin!);
  const picked: typeof eras = [];
  for (const p of eras) {
    const last = picked.at(-1)?.entity?.bounds;
    if (!last || (last.startMax ?? last.startMin!) < p.entity!.bounds!.startMin!) picked.push(p);
  }
  // At most four, spread across time.
  const four =
    picked.length <= 4
      ? picked
      : [0, 1, 2, 3].map((i) => picked[Math.round((i * (picked.length - 1)) / 3)]!);
  return Promise.all(four.map(ageOf));
}

async function ageOf(p: Awaited<ReturnType<typeof listPages>>[number]): Promise<FirstStepsAge> {
  return {
    entityId: p.entity!.id,
    label: p.entity!.label,
    whenLabel: p.entity!.whenLabel,
    start: p.entity!.bounds!.startMin!,
    pageSlug: p.slug,
    pageTitle: p.title,
    firstChapterId: await firstChapterOf(p.slug),
    description: firstClause(p.summary ?? p.entity!.description ?? null),
  };
}

/** "The first cities of South Asia: …" → "The first cities of South Asia". */
function firstClause(text: string | null): string | null {
  if (!text) return null;
  // Up to a dated tail (", c. 3300–1300 BCE"), a colon, or the end of the first sentence.
  const cut = text.split(/,\s*(?:c\.|from|in the words)\s|[:;]\s|\.\s+(?=\p{Lu})|\.$/u)[0]!.trim();
  return cut.length > 110 ? `${cut.slice(0, 108).trimEnd()}…` : cut;
}

async function firstChapterOf(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  return (await blocksByPage()).get(slug)?.find((b) => b.type === "chapter")?.id ?? null;
}

/**
 * The first-steps questions, for a learner with no activity yet (no cards,
 * reviews or answers other than these two). Null once they have done anything
 * else, or answered both. `always` returns fresh questions regardless (for
 * looking at the component in development).
 */
export async function firstSteps(
  ctx: ActorContext,
  /** `result`: the learner's finished first steps, whatever else they have done since (for "Your first guesses"). */
  options: { always?: boolean; result?: boolean } = {},
): Promise<FirstSteps | null> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const [card] = await db
    .select({ id: cards.id })
    .from(cards)
    .where(eq(cards.actorId, learner))
    .limit(1);
  const rows = await db
    .select()
    .from(learnerResponses)
    .where(
      and(
        eq(learnerResponses.actorId, learner),
        options.always || options.result ? eq(learnerResponses.kind, "first") : undefined,
      ),
    )
    .orderBy(asc(learnerResponses.at));
  const answered: FirstSteps["answered"] = {};
  for (const r of rows) {
    if (r.kind !== "first") continue;
    const step = r.itemId === "ages" || r.itemId === "place" ? r.itemId : null;
    const response = CheckResponse.safeParse(r.response);
    const result = asResult(r.result);
    if (step && response.success && result)
      answered[step] = { response: response.data, result, confidence: r.confidence };
  }
  // Begun and not finished, it comes back at the question left, whatever else the learner has done since.
  const halfway = Boolean(answered.ages) !== Boolean(answered.place);
  if (!halfway && !options.always && !options.result && (card || rows.some((r) => r.kind !== "first")))
    return null;
  if (options.result && !(answered.ages && answered.place)) return null;
  if (answered.ages && answered.place && !options.always && !options.result) return null;
  if (options.always) for (const k of Object.keys(answered)) delete answered[k as "ages" | "place"];
  // A finished result shows the ages that were asked, even if the selection has changed since.
  let ages: FirstStepsAge[];
  if (options.result && answered.ages?.response.kind === "order") {
    const eras = await pagesOfKind("era");
    const asked = answered.ages.response.order;
    ages = await Promise.all(
      eras.filter((p) => p.entity && asked.includes(p.entity.id)).sort((a, b) => a.entity!.bounds!.startMin! - b.entity!.bounds!.startMin!).map(ageOf),
    );
  } else ages = await firstStepsAges();
  if (ages.length < 3) return null;
  return { ages, place: await firstStepsPlace(), answered };
}

/** The place the first steps ask about, with the page and part it leads to (content only, so cached). */
const firstStepsPlace = versionedCache(
  () => FIRST_STEPS_PLACE,
  async () => {
    const entity = (await loadEntityCards(getDb(), [FIRST_STEPS_PLACE])).get(FIRST_STEPS_PLACE);
    if (!entity?.geo) return null;
    // The question is about the empire ruled from the city: its page, not the page where the city first appears.
    const pageSlug = entity.pageSlug ?? (await pageOfStateHolding(entity.id)) ?? (await pageAbout(entity.id));
    return { entity, toleranceKm: FIRST_STEPS_TOLERANCE_KM, pageSlug, firstChapterId: await firstChapterOf(pageSlug) };
  },
);

/**
 * Where a learner who has done the first steps should start reading: the page
 * of the city they placed (Pāṭaliputra: the Maurya page), else the earliest
 * age they put in the wrong place, else the earliest age. Null before both
 * steps are answered.
 */
export async function firstStepsRecommendation(
  ctx: ActorContext,
): Promise<{ pageSlug: string; pageTitle: string; chapterId: string | null; reason: string } | null> {
  const done = await firstSteps(ctx, { result: true });
  if (!done) return null;
  const place = done.place;
  if (place?.pageSlug) {
    const page = (await pagesOfKind("era")).find((p) => p.slug === place.pageSlug);
    const km = done.answered.place?.result.distanceKm;
    return {
      pageSlug: place.pageSlug,
      pageTitle: page?.title ?? place.pageSlug,
      chapterId: place.firstChapterId,
      reason:
        km === undefined || km === 0
          ? `Start with the empire ruled from ${place.entity.label}.`
          : `Your pin was about ${km.toLocaleString("en-GB")} km from ${place.entity.label}: start with the empire ruled from it.`,
    };
  }
  const order = done.answered.ages?.response.kind === "order" ? done.answered.ages.response.order : [];
  const right = done.answered.ages?.result.order ?? [];
  const missed = done.ages.find((a) => order.indexOf(a.entityId) !== right.indexOf(a.entityId)) ?? done.ages[0]!;
  return {
    pageSlug: missed.pageSlug,
    pageTitle: missed.pageTitle,
    chapterId: missed.firstChapterId,
    reason: `You placed ${missed.label} out of order: start there.`,
  };
}

/** The first era page with a chapter set in the place, for a link (the Maurya page for Pāṭaliputra). */
/** The era page of the state a place was part of (its `part_of` link: Pāṭaliputra, the Maurya Empire). */
async function pageOfStateHolding(placeId: string): Promise<string | null> {
  const links = await getDb()
    .select({ toId: entityLinks.toId })
    .from(entityLinks)
    .where(and(eq(entityLinks.fromId, placeId), eq(entityLinks.type, "part_of")));
  const states = new Set(links.map((l) => l.toId));
  return (await pagesOfKind("era")).find((p) => p.entity && states.has(p.entity.id))?.slug ?? null;
}

async function pageAbout(entityId: string): Promise<string | null> {
  for (const p of await pagesOfKind("era")) {
    const view = await getPageView(p.id);
    if (
      view.page.blocks.some(
        (b) => b.type === "chapter" && b.places.some((ref) => view.entities[ref]?.id === entityId),
      )
    )
      return p.slug;
  }
  return null;
}

/** One first-steps answer, graded against the ages' stored dates or the city's stored point. */
export async function recordFirstStep(
  ctx: ActorContext,
  raw: unknown,
): Promise<{ result: LearnResult; confidence: number }> {
  const input = FirstStepInput.parse(raw);
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  let result: LearnResult;
  try {
    if (input.step === "ages") {
      if (input.response.kind !== "order") throw new GradingError("expected an order");
      const eras = await pagesOfKind("era");
      const bounds = new Map(
        eras.filter((p) => p.entity).map((p) => [p.entity!.id, p.entity!.bounds]),
      );
      const unknown = input.response.order.filter((id) => !bounds.has(id));
      if (unknown.length) throw new GradingError(`not an age with a page: ${unknown.join(", ")}`);
      const right = chronologicalOrder(
        input.response.order.map((id) => ({ claimId: id, bounds: bounds.get(id) ?? null })),
      );
      if ("problem" in right)
        throw new GradingError(`these ages cannot be ordered (${right.problem})`);
      result = gradeOrder(right.order, input.response.order);
    } else {
      if (input.response.kind !== "place") throw new GradingError("expected a place");
      const entity = (await loadEntityCards(db, [FIRST_STEPS_PLACE])).get(FIRST_STEPS_PLACE);
      if (!entity?.geo) throw new GradingError("the place has no stored coordinates");
      result = gradePlace(entity.geo.geometry, input.response.at, FIRST_STEPS_TOLERANCE_KM);
    }
  } catch (error) {
    if (error instanceof GradingError) throw new ValidationError(error.message);
    throw error;
  }
  const confidence = SURENESS_PERCENT[input.sureness];
  await db.insert(learnerResponses).values({
    id: uuidv7(),
    actorId: learner,
    pageId: null,
    blockId: "first-steps",
    itemId: input.step,
    kind: "first",
    response: input.response as Record<string, unknown>,
    result: result as Record<string, unknown>,
    correct: result.correct ? 1 : 0,
    confidence,
  });
  await recordEvent(db, ctx, {
    action: "first_steps.answered",
    subjectType: "learner",
    subjectId: learner,
    data: { step: input.step, response: input.response, result, confidence },
  });
  return { result, confidence };
}

export interface ChapterProgress {
  id: string;
  title: string;
  /** From the chapter's `when`; null for chapters about the whole period. */
  bounds: DateBounds | null;
  claims: number;
  inDeck: number;
  due: number;
  guessed: boolean;
  /** Check questions answered (latest attempt), and how many of those were right. */
  checked: number;
  checkedRight: number;
  checkItems: number;
  /** Block ids of the chapter's guess and check, for links. */
  guessId: string | null;
  checkId: string | null;
  /** The four steps drawn by the chapter progress seal. */
  steps: ChapterSteps;
  /** The learner's first guess on the part's "Guess first" question, in words, and how far off it was (0–1, see guessMiss). */
  guess: { guessed: string; answer: string; miss: number } | null;
}

export interface PageProgress {
  slug: string;
  title: string;
  entityId: string | null;
  bounds: DateBounds | null;
  whenLabel: string | null;
  visited: boolean;
  /** Cards due now for claims anywhere on the page (each claim once). */
  due: number;
  chapters: ChapterProgress[];
}

/** Era pages chapter by chapter: what the learner has guessed, checked, put in the deck, and what is due. */
/**
 * One page often asks for the study map several times at once (the page,
 * nextPart, agesStrip): calls for the same context share the computation
 * while it runs. Nothing is kept afterwards, so a write is always seen.
 */
const mapsRunning = new WeakMap<ActorContext, Promise<PageProgress[]>>();
export function studyMap(ctx: ActorContext): Promise<PageProgress[]> {
  const running = mapsRunning.get(ctx);
  if (running) return running.then((map) => structuredClone(map));
  const map = loadStudyMap(ctx).finally(() => mapsRunning.delete(ctx));
  mapsRunning.set(ctx, map);
  return map.then((m) => structuredClone(m));
}

async function loadStudyMap(ctx: ActorContext): Promise<PageProgress[]> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const now = new Date();
  const [eraPages, cardRows, responses, visits] = await Promise.all([
    pagesOfKind("era"),
    db
      .select({ claimId: cards.claimId, due: cards.due })
      .from(cards)
      .where(eq(cards.actorId, learner)),
    db
      .select({
        pageId: learnerResponses.pageId,
        blockId: learnerResponses.blockId,
        itemId: learnerResponses.itemId,
        kind: learnerResponses.kind,
        correct: learnerResponses.correct,
        response: learnerResponses.response,
      })
      .from(learnerResponses)
      .where(eq(learnerResponses.actorId, learner))
      .orderBy(asc(learnerResponses.at)),
    db
      .select({ pageId: pageVisits.pageId })
      .from(pageVisits)
      .where(eq(pageVisits.actorId, learner)),
  ]);
  const deck = new Map(cardRows.map((c) => [c.claimId, c.due]));
  // Due means "to study today": reviews, and new cards within today's allowance.
  const today = await todaysCards(db, learner, { now });
  const isDue = (id: string) => today.reviews.has(id) || today.fresh.has(id);
  const visited = new Set(visits.map((v) => v.pageId));
  const guessed = new Map<string, GuessResponse>(); // page|block -> first guess
  const checked = new Map<string, number | null>(); // page|block|item -> latest correct
  const read = new Set<string>();
  const skimmed = new Set<string>();
  const remembered = await rememberedClaims(db, learner);
  for (const r of responses) {
    if (r.kind === "read") read.add(`${r.pageId}|${r.blockId}`);
    if (r.kind === "skim") skimmed.add(`${r.pageId}|${r.blockId}`);
    if (r.kind === "guess" && !guessed.has(`${r.pageId}|${r.blockId}`)) {
      const g = GuessResponse.safeParse(r.response);
      if (g.success) guessed.set(`${r.pageId}|${r.blockId}`, g.data);
    }
    if (r.kind === "check") checked.set(`${r.pageId}|${r.blockId}|${r.itemId}`, r.correct);
  }
  const out: PageProgress[] = [];
  const blocksOf = await blocksByPage();
  for (const p of eraPages) {
    const blocks = blocksOf.get(p.id);
    if (!blocks) continue;
    const chapters: ChapterProgress[] = [];
    const pageIds = new Set(blocks.flatMap(claimIdsInBlock).filter(isUuid));
    let current: (ChapterProgress & { ids: Set<string> }) | null = null;
    const close = () => {
      if (!current) return;
      const ids = [...current.ids];
      current.claims = ids.length;
      current.inDeck = ids.filter((id) => deck.has(id)).length;
      current.due = ids.filter(isDue).length;
      const inDeck = ids.filter((id) => deck.has(id));
      current.steps = {
        read: read.has(`${p.id}|${current.id}`),
        skimmed: skimmed.has(`${p.id}|${current.id}`),
        guessed: current.guessed,
        checked: current.checked > 0,
        remembered:
          inDeck.length > 0 &&
          inDeck.filter((id) => remembered.has(id)).length * 2 >= inDeck.length,
      };
      const { ids: _ids, ...rest } = current;
      chapters.push(rest);
    };
    for (const b of blocks) {
      if (b.type === "chapter") {
        close();
        let bounds: DateBounds | null = null;
        try {
          bounds = b.when ? dateBounds(toFuzzyDate(b.when)) : null;
        } catch {
          bounds = null;
        }
        current = {
          id: b.id,
          title: b.title,
          bounds,
          claims: 0,
          inDeck: 0,
          due: 0,
          guessed: false,
          checked: 0,
          checkedRight: 0,
          checkItems: 0,
          guessId: null,
          checkId: null,
          steps: { read: false, skimmed: false, guessed: false, checked: false, remembered: false },
          guess: null,
          ids: new Set(),
        };
        continue;
      }
      if (!current) continue;
      claimIdsInBlock(b)
        .filter(isUuid)
        .forEach((id) => current!.ids.add(id));
      if (b.type === "guess") {
        current.guessId ??= b.id;
        const g = guessed.get(`${p.id}|${b.id}`);
        if (g) {
          current.guessed = true;
          current.guess ??= {
            guessed: formatGuessResponse(b.answer, g),
            answer: formatGuessAnswer(b.answer),
            miss: guessMiss(b.answer, g),
          };
        }
      }
      if (b.type === "check") {
        current.checkId ??= b.id;
        current.checkItems += b.items.length;
        for (const item of b.items) {
          const key = `${p.id}|${b.id}|${item.id}`;
          if (!checked.has(key)) continue;
          current.checked++;
          if (checked.get(key) === 1) current.checkedRight++;
        }
      }
    }
    close();
    out.push({
      slug: p.slug,
      title: p.title,
      entityId: p.entity?.id ?? null,
      bounds: p.entity?.bounds ?? null,
      whenLabel: p.entity?.whenLabel ?? null,
      visited: visited.has(p.id),
      due:
        [...pageIds].filter((id) => today.reviews.has(id)).length +
        Math.min(today.allowance, [...pageIds].filter((id) => today.newDue.has(id)).length),
      chapters,
    });
  }
  return out;
}

/** Loads of the same page this close together are one visit (remounts, reloads, coming back from a link). */
export const VISIT_GAP_MINUTES = 30;

/**
 * A page opened by the learner. `visits` counts sittings, not loads: a load
 * within VISIT_GAP_MINUTES of the last one only moves `lastSeenAt` on.
 */
export async function recordPageVisit(ctx: ActorContext, pageId: string): Promise<void> {
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  await getDb()
    .insert(pageVisits)
    .values({ actorId: learner, pageId })
    .onConflictDoUpdate({
      target: [pageVisits.actorId, pageVisits.pageId],
      set: {
        lastSeenAt: new Date(),
        visits: sql`case when ${pageVisits.lastSeenAt} > now() - make_interval(mins => ${VISIT_GAP_MINUTES}) then ${pageVisits.visits} else ${pageVisits.visits} + 1 end`,
      },
    });
}

export interface Progress {
  /**
   * `due`: what there is to study today, reviews plus today's new cards (see
   * todaysCards). `known`: cards whose latest review was right.
   */
  deck: {
    total: number;
    due: number;
    known: number;
    new: number;
    learning: number;
    review: number;
    /** When the next card that is not yet due comes back (for "your next reviews come back on …"); null if none is waiting. */
    nextDue: string | null;
  };
  /** Today's study: reviews due, new cards to meet (within the daily allowance), and new cards waiting for later days. */
  today: { reviews: number; fresh: number; waiting: number; perDay: number };
  /**
   * What the learner has done, all time: parts read in full and skimmed,
   * guesses, check questions answered (each once), and reviews. `seen`: cards
   * reviewed at least once (only those can be remembered or not).
   */
  effort: { partsRead: number; partsSkimmed: number; guesses: number; checks: number; reviews: number; seen: number };
  reviews: {
    last7Days: number;
    accuracy: number | null;
    meanConfidence: number | null;
    calibrationGap: number | null;
  };
  /** Guesses, checks and prior beliefs (see recordGuess, recordCheckAnswer, recordBelief). */
  practice: {
    guesses: number;
    /** Check answers in the last 7 days, and how many were right. */
    checks: { answered: number; right: number };
    /** Answers in the last 7 days given as "sure" that were wrong (reviews and checks). */
    confidentErrors: number;
    /** Cards waiting for a re-check after a confident error. */
    toRecheck: number;
    /** Misconceptions the learner said whether they believed, and how many they did. */
    beliefs: { answered: number; held: number };
  };
  /**
   * Per page read. `inDeck`: the page's claims with a card. `due`: those due
   * now. `known`: those whose latest review was right (the learner remembers
   * them), the measure of progress. `mature`: known with an FSRS stability of
   * three weeks or more (long-term). known ≤ inDeck ≤ claims; mature ≤ known.
   */
  pages: {
    slug: string;
    title: string;
    visits: number;
    lastSeenAt: Date;
    claims: number;
    inDeck: number;
    due: number;
    known: number;
    mature: number;
  }[];
}

/**
 * Progress for the learner. Calibration gap = mean confidence minus accuracy
 * on answers that recorded both (reviews, and check questions graded by the
 * app rather than by the learner): positive means overconfident.
 */
export async function getProgress(ctx: ActorContext): Promise<Progress> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const cardRows = await db.select().from(cards).where(eq(cards.actorId, learner));
  const now = new Date();
  const deck = {
    total: cardRows.length,
    due: 0,
    known: 0,
    new: 0,
    learning: 0,
    review: 0,
    nextDue: null as string | null,
  };
  const later = cardRows.map((c) => new Date(c.due).getTime()).filter((t) => t > Date.now());
  if (later.length) deck.nextDue = new Date(Math.min(...later)).toISOString();
  const matureClaims = new Set<string>();
  const deckClaims = new Set<string>();
  const today = await todaysCards(db, learner, { now });
  deck.due = today.reviews.size + today.fresh.size;
  for (const c of cardRows) {
    const s = reviveCard(c.fsrs);
    deckClaims.add(c.claimId);
    if (s.state === 0) deck.new++;
    else if (s.state === 2) deck.review++;
    else deck.learning++;
    if (s.state === 2 && s.stability >= 21) matureClaims.add(c.claimId);
  }
  // Known: the latest review of the card was right (marked right, or rated above "again").
  const latest = await db
    .selectDistinctOn([reviewLogs.cardId], {
      cardId: reviewLogs.cardId,
      rating: reviewLogs.rating,
      correct: reviewLogs.correct,
    })
    .from(reviewLogs)
    .where(eq(reviewLogs.actorId, learner))
    .orderBy(reviewLogs.cardId, desc(reviewLogs.at));
  const knownCards = new Set(
    latest
      .filter((l) => (l.correct === null ? l.rating !== "again" : l.correct === 1))
      .map((l) => l.cardId),
  );
  const knownClaims = new Set(cardRows.filter((c) => knownCards.has(c.id)).map((c) => c.claimId));
  for (const id of [...matureClaims]) if (!knownClaims.has(id)) matureClaims.delete(id);
  deck.known = knownCards.size;
  const [{ n: allReviews } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviewLogs)
    .where(eq(reviewLogs.actorId, learner));
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const logs = await db
    .select()
    .from(reviewLogs)
    .where(and(eq(reviewLogs.actorId, learner), gte(reviewLogs.at, weekAgo)));
  const responses = await db
    .select()
    .from(learnerResponses)
    .where(eq(learnerResponses.actorId, learner))
    .orderBy(asc(learnerResponses.at));
  const recentChecks = responses.filter((r) => r.kind === "check" && r.at >= weekAgo);
  // Recall checks on cards in the deck are already in review_logs.
  const appGraded = recentChecks.filter((r) => r.claimId === null);
  const graded = [...logs, ...appGraded].filter((l) => l.correct !== null);
  const withConf = graded.filter((l) => l.confidence !== null);
  const beliefs = new Map<string, string>();
  for (const r of responses)
    if (r.kind === "belief")
      beliefs.set(`${r.pageId}|${r.blockId}`, String((r.response as { belief?: unknown }).belief));
  const accuracy = graded.length
    ? graded.reduce((a, l) => a + (l.correct ?? 0), 0) / graded.length
    : null;
  const meanConfidence = withConf.length
    ? withConf.reduce((a, l) => a + (l.confidence ?? 0), 0) / withConf.length / 100
    : null;
  const calAccuracy = withConf.length
    ? withConf.reduce((a, l) => a + (l.correct ?? 0), 0) / withConf.length
    : null;

  const visits = await db
    .select({ visit: pageVisits, page: pages })
    .from(pageVisits)
    .innerJoin(pages, eq(pages.id, pageVisits.pageId))
    .where(eq(pageVisits.actorId, learner));
  const pageStats = [];
  for (const { visit, page } of visits) {
    const view = await getPageView(page.id);
    const ids = Object.keys(view.claims);
    pageStats.push({
      slug: page.slug,
      title: page.title,
      visits: visit.visits,
      lastSeenAt: visit.lastSeenAt,
      claims: ids.length,
      inDeck: ids.filter((id) => deckClaims.has(id)).length,
      due:
        ids.filter((id) => today.reviews.has(id)).length +
        Math.min(today.allowance, ids.filter((id) => today.newDue.has(id)).length),
      known: ids.filter((id) => knownClaims.has(id)).length,
      mature: ids.filter((id) => matureClaims.has(id)).length,
    });
  }
  return {
    deck,
    today: {
      reviews: today.reviews.size,
      fresh: today.fresh.size,
      waiting: today.waiting,
      perDay: today.perDay,
    },
    effort: {
      partsRead: new Set(responses.filter((r) => r.kind === "read").map((r) => `${r.pageId}|${r.blockId}`)).size,
      partsSkimmed: new Set(responses.filter((r) => r.kind === "skim").map((r) => `${r.pageId}|${r.blockId}`)).size,
      guesses: new Set(responses.filter((r) => r.kind === "guess").map((r) => `${r.pageId}|${r.blockId}`)).size,
      checks: new Set(responses.filter((r) => r.kind === "check").map((r) => `${r.pageId}|${r.blockId}|${r.itemId}`)).size,
      reviews: allReviews,
      seen: latest.length,
    },
    reviews: {
      last7Days: logs.length,
      accuracy,
      meanConfidence,
      calibrationGap:
        meanConfidence !== null && calAccuracy !== null ? meanConfidence - calAccuracy : null,
    },
    practice: {
      guesses: new Set(
        responses.filter((r) => r.kind === "guess").map((r) => `${r.pageId}|${r.blockId}`),
      ).size,
      checks: {
        answered: recentChecks.length,
        right: recentChecks.filter((r) => r.correct === 1).length,
      },
      confidentErrors:
        logs.filter((l) =>
          isConfidentError(l.correct === null ? null : l.correct === 1, l.confidence),
        ).length +
        recentChecks.filter(
          (r) =>
            r.claimId === null &&
            isConfidentError(r.correct === null ? null : r.correct === 1, r.confidence),
        ).length,
      toRecheck: cardRows.filter((c) => c.confidentErrorAt !== null).length,
      beliefs: {
        answered: beliefs.size,
        held: [...beliefs.values()].filter((b) => b === "yes").length,
      },
    },
    pages: pageStats.sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime()),
  };
}

// ---------------------------------------------------------------------------
// Today: the next part to study, what was learned today, and the ages begun
// ---------------------------------------------------------------------------

export interface NextPart {
  pageSlug: string;
  pageTitle: string;
  chapterId: string;
  title: string;
  /** 1-based position among the page's parts. */
  number: number;
  parts: number;
  /** Why the first steps pointed here; null when it is simply the next part. */
  reason: string | null;
}

/**
 * The part to study next: the first part not yet skimmed, read or checked on
 * the page studied most recently, else on the page the first steps
 * recommended, else the earliest era; pages with no guesses or checks come
 * after all the others. Null when every part has been studied.
 */
export async function nextPart(
  ctx: ActorContext,
  /** `except`: part (chapter) ids to pass over, such as the one a session has just studied. */
  options: { except?: string[] } = {},
): Promise<NextPart | null> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const map = await studyMap(ctx);
  const recent = await db
    .select({ pageId: learnerResponses.pageId, at: sql<Date>`max(${learnerResponses.at})` })
    .from(learnerResponses)
    .where(eq(learnerResponses.actorId, learner))
    .groupBy(learnerResponses.pageId);
  const eras = await pagesOfKind("era");
  const slugOf = new Map(eras.map((p) => [p.id, p.slug]));
  const order = recent
    .filter((r) => r.pageId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .map((r) => slugOf.get(r.pageId!))
    .filter((s): s is string => Boolean(s));
  const rec = await firstStepsRecommendation(ctx);
  const candidates = [...new Set([...order, ...(rec ? [rec.pageSlug] : []), ...map.map((p) => p.slug)])];
  // A page with no guesses or checks yet leaves the session nothing to do but read: it comes last.
  const hasQuestions = (p: PageProgress) => p.chapters.some((c) => c.guessId || c.checkId);
  const pagesInOrder = candidates
    .map((slug) => map.find((p) => p.slug === slug))
    .filter((p): p is PageProgress => Boolean(p))
    .sort((a, b) => Number(hasQuestions(b)) - Number(hasQuestions(a)));
  for (const page of pagesInOrder) {
    const slug = page.slug;
    const i = page.chapters.findIndex((c) => !partStudied(c) && !options.except?.includes(c.id));
    if (i < 0) continue;
    const c = page.chapters[i]!;
    return {
      pageSlug: page.slug,
      pageTitle: page.title,
      chapterId: c.id,
      title: c.title,
      number: i + 1,
      parts: page.chapters.length,
      reason: !order.includes(slug) && rec?.pageSlug === slug ? rec.reason : null,
    };
  }
  return null;
}

/**
 * A part counts as studied once it is read, skimmed (its summary seen) or its
 * check answered. A guess alone only begins it, and cards alone say nothing:
 * a claim met in one part's check is often cited in another part too.
 */
export function partStudied(c: ChapterProgress): boolean {
  return c.steps.read || c.steps.skimmed || c.checked > 0;
}

/**
 * New cards the learner may still meet today (`newCardsPerDay` less those met
 * since midnight). At none, a further part waits for tomorrow: its answers
 * would only add cards that cannot come up until then.
 */
export async function newCardsLeftToday(ctx: ActorContext): Promise<{ left: number; perDay: number }> {
  const today = await todaysCards(getDb(), ctx.onBehalfOfId ?? ctx.actorId);
  return { left: today.allowance, perDay: today.perDay };
}

/** A given part as a NextPart (for a session pinned to one part); null if the page or part does not exist. */
export async function partAt(ctx: ActorContext, pageSlug: string, chapterId: string): Promise<NextPart | null> {
  const page = (await studyMap(ctx)).find((p) => p.slug === pageSlug);
  const i = page?.chapters.findIndex((c) => c.id === chapterId) ?? -1;
  if (!page || i < 0) return null;
  return { pageSlug: page.slug, pageTitle: page.title, chapterId, title: page.chapters[i]!.title, number: i + 1, parts: page.chapters.length, reason: null };
}

export interface LearnedToday {
  /**
   * The facts behind what the learner answered today, newest first, each
   * once. Never a misconception or a refuted claim: those are in `beliefs`.
   */
  claims: { claimId: string; via: "guess" | "check" | "review"; correct: boolean | null }[];
  /**
   * Common beliefs the learner met today (misconceptions and refuted claims),
   * each with the claims that correct it, so a belief never reads as a fact.
   */
  beliefs: { claimId: string; corrections: string[] }[];
  /** `first`: first-steps questions answered today (they name ages and a place, not claims, so they add no rows above). */
  counts: { guesses: number; checks: number; reviews: number; right: number; first: number };
  /** The claims themselves (text, seal, evidence), facts, beliefs and corrections, by id. */
  cards: Record<string, ClaimCard>;
}

/** What the learner met today, from their own answers: guesses, checks and reviews since midnight. */
export async function learnedToday(ctx: ActorContext, now = new Date()): Promise<LearnedToday> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const responses = await db
    .select()
    .from(learnerResponses)
    .where(and(eq(learnerResponses.actorId, learner), gte(learnerResponses.at, start)))
    .orderBy(desc(learnerResponses.at));
  const logs = await db
    .select({ claimId: cards.claimId, correct: reviewLogs.correct, rating: reviewLogs.rating, at: reviewLogs.at })
    .from(reviewLogs)
    .innerJoin(cards, eq(cards.id, reviewLogs.cardId))
    .where(and(eq(reviewLogs.actorId, learner), gte(reviewLogs.at, start)))
    .orderBy(desc(reviewLogs.at));
  // Check answers name their claims through the page's blocks.
  const blocksOf = await blocksByPage();
  const pageRows = new Map<string, Block[]>();
  for (const id of new Set(responses.map((r) => r.pageId).filter((p): p is string => Boolean(p)))) {
    const blocks = blocksOf.get(id);
    if (blocks) pageRows.set(id, blocks);
  }
  const items: (LearnedToday["claims"][number] & { at: Date })[] = [];
  for (const r of responses) {
    if (r.kind === "guess" && r.claimId) items.push({ claimId: r.claimId, via: "guess", correct: r.correct === null ? null : r.correct === 1, at: r.at });
    if (r.kind === "check" && r.pageId) {
      const block = pageRows.get(r.pageId)?.find((b) => b.id === r.blockId);
      const item = block?.type === "check" ? block.items.find((i) => i.id === r.itemId) : undefined;
      for (const id of item ? claimIdsInCheckItem(item).filter(isUuid) : [])
        items.push({ claimId: id, via: "check", correct: r.correct === null ? null : r.correct === 1, at: r.at });
    }
  }
  for (const l of logs) items.push({ claimId: l.claimId, via: "review", correct: l.correct === null ? l.rating !== "again" : l.correct === 1, at: l.at });
  items.sort((a, b) => b.at.getTime() - a.at.getTime());
  const seen = new Set<string>();
  const claimsOut: LearnedToday["claims"] = [];
  for (const { at: _at, ...i } of items) {
    if (seen.has(i.claimId)) continue;
    seen.add(i.claimId);
    claimsOut.push(i);
  }
  // A recall question in a check also counts as its card's review (one answer, two records): counted once, as the check.
  const ownReviews = logs.filter(
    (l) =>
      !responses.some(
        (r) => r.kind === "check" && r.claimId === l.claimId && Math.abs(r.at.getTime() - l.at.getTime()) < 10_000,
      ),
  );
  const loaded = await loadClaimCards(db, claimsOut.map((c) => c.claimId));
  const isBelief = (c: ClaimCard) => c.kind === "misconception" || c.assessment === "refuted";
  const beliefIds = claimsOut.filter((c) => loaded.get(c.claimId) && isBelief(loaded.get(c.claimId)!)).map((c) => c.claimId);
  // What corrects each belief: claims related as "corrects", and the corrections its misconception blocks list.
  const corrections = new Map<string, Set<string>>(beliefIds.map((id) => [id, new Set<string>()]));
  if (beliefIds.length) {
    const rel = await db
      .select({ fromId: claimRelations.fromId, toId: claimRelations.toId })
      .from(claimRelations)
      .where(and(inArray(claimRelations.toId, beliefIds), eq(claimRelations.type, "corrects")));
    for (const r of rel) corrections.get(r.toId)?.add(r.fromId);
    // A belief met in a review may come from a page not answered on today: look at every era page then.
    const scan = new Map(pageRows);
    if ([...corrections.values()].some((set) => !set.size))
      for (const p of await pagesOfKind("era"))
        if (!scan.has(p.id) && blocksOf.has(p.id)) scan.set(p.id, blocksOf.get(p.id)!);
    for (const blocks of scan.values())
      for (const b of blocks) if (b.type === "misconception" && corrections.has(b.claimId)) b.correctionIds.filter(isUuid).forEach((id) => corrections.get(b.claimId)!.add(id));
  }
  const correctionIds = [...new Set([...corrections.values()].flatMap((set) => [...set]))].filter((id) => !loaded.has(id));
  const more = correctionIds.length ? await loadClaimCards(db, correctionIds) : new Map<string, ClaimCard>();
  return {
    claims: claimsOut.filter((c) => loaded.has(c.claimId) && !beliefIds.includes(c.claimId)),
    beliefs: beliefIds.map((claimId) => ({ claimId, corrections: [...(corrections.get(claimId) ?? [])].slice(0, 3) })),
    cards: Object.fromEntries([...loaded, ...more].map(([id, c]) => [id, c])),
    counts: {
      guesses: responses.filter((r) => r.kind === "guess").length,
      checks: responses.filter((r) => r.kind === "check").length,
      reviews: ownReviews.length,
      first: responses.filter((r) => r.kind === "first").length,
      right: responses.filter((r) => (r.kind === "check" || r.kind === "guess") && r.correct === 1).length + ownReviews.filter((l) => (l.correct === null ? l.rating !== "again" : l.correct === 1)).length,
    },
  };
}

export interface AgeStripItem {
  slug: string;
  title: string;
  whenLabel: string | null;
  start: number | null;
  /** untouched → begun (anything done) → read (a part read in full) → remembered (a part remembered later). */
  state: "untouched" | "begun" | "read" | "remembered";
  partsStudied: number;
  parts: number;
}

/**
 * The era pages (the written ages) in time order, each with how far the
 * learner has got: "where you've been". `spine` is how many ages there are in
 * all, written or not.
 */
export async function agesStrip(ctx: ActorContext): Promise<{ ages: AgeStripItem[]; begun: number; spine: number }> {
  const map = await studyMap(ctx);
  // Every age on the overview's spine, written or not: the same count as an era page's "age 5 of 16".
  const overview = (await pagesOfKind("overview"))[0];
  const block = overview ? (await getPageView(overview.slug)).page.blocks.find((b) => b.type === "entities") : undefined;
  const spine = block?.type === "entities" ? block.entityIds.length : 0;
  const ages = map
    .map((p): AgeStripItem => {
      const studied = p.chapters.filter(partStudied);
      const begun = p.chapters.some((c) => c.steps.guessed || c.inDeck > 0);
      const state = p.chapters.some((c) => c.steps.remembered)
        ? "remembered"
        : p.chapters.some((c) => c.steps.read)
          ? "read"
          : studied.length || begun || p.visited
            ? "begun"
            : "untouched";
      return { slug: p.slug, title: p.title, whenLabel: p.whenLabel, start: p.bounds?.startMin ?? null, state, partsStudied: studied.length, parts: p.chapters.length };
    })
    .sort((a, b) => (a.start ?? 1e9) - (b.start ?? 1e9));
  return { ages, begun: ages.filter((a) => a.state !== "untouched").length, spine: Math.max(spine, ages.length) };
}

// ---------------------------------------------------------------------------
// What the learner knows, has forgotten or confused (for the AI and per-user views)
// ---------------------------------------------------------------------------

/**
 * confused: sure and wrong and not yet put right, or a misconception believed
 * before reading and not yet answered right; forgotten: wrong at the last
 * review after once being remembered; known: remembered at the last review of
 * a graduated card; shaky: reviewed, or missed in a check, and none of the
 * above; met: answered or added to the deck, not yet reviewed.
 */
export type ClaimSignalState = "confused" | "forgotten" | "shaky" | "met" | "known";

export interface ClaimSignal {
  claimId: string;
  text: string;
  /** A misconception that is "known" is one the learner now knows to be false. */
  kind: string;
  /** For a misconception: the claims that correct it ("corrects" relations and the misconception block's list). */
  corrections: string[];
  pageSlug: string | null;
  chapterId: string | null;
  state: ClaimSignalState;
  /** Why, in plain words, newest first: "sure and wrong on 18 Oct", "believed this before reading". */
  reasons: string[];
  lastSeen: string | null;
}

export interface ChapterSignal {
  pageSlug: string;
  chapterId: string;
  title: string;
  read: boolean;
  skimmed: boolean;
  /** How far off the first guess was, 0 (right) to 1; null without a guess. */
  guessMiss: number | null;
  checkRight: number;
  checkWrong: number;
  /** untouched → begun → shaky (a check missed, or a claim confused or forgotten) or solid (checked, nothing missed). */
  state: "untouched" | "begun" | "shaky" | "solid";
}

export interface LearnerSignals {
  page: { slug: string; title: string } | null;
  claims: ClaimSignal[];
  chapters: ChapterSignal[];
  summary: Record<ClaimSignalState, number>;
}

const STATE_ORDER: ClaimSignalState[] = ["confused", "forgotten", "shaky", "met", "known"];
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/**
 * The learner's own signals, claim by claim and part by part, for the AI
 * (learner_signals) and for per-user page views: what to explain again, what
 * to bring back, what can be folded away. Only ever the context's learner;
 * never cached, since every answer changes it. `page` narrows it to one page.
 */
export async function learnerSignals(ctx: ActorContext, options: { page?: string } = {}): Promise<LearnerSignals> {
  const db = getDb();
  const learner = ctx.onBehalfOfId ?? ctx.actorId;
  const [map, eras, blocksOf] = await Promise.all([studyMap(ctx), pagesOfKind("era"), blocksByPage()]);
  const page = options.page ? (eras.find((p) => p.slug === options.page || p.id === options.page) ?? null) : null;
  if (options.page && !page) throw new NotFoundError(`no era page ${options.page}`);

  // Where each claim sits: the first era page and part that cite it.
  const where = new Map<string, { pageSlug: string; chapterId: string | null }>();
  for (const p of eras) {
    let chapter: string | null = null;
    for (const b of blocksOf.get(p.id) ?? []) {
      if (b.type === "chapter") chapter = b.id;
      for (const id of claimIdsInBlock(b).filter(isUuid)) if (!where.has(id)) where.set(id, { pageSlug: p.slug, chapterId: chapter });
    }
  }
  const inScope = (claimId: string) => !page || where.get(claimId)?.pageSlug === page.slug;

  const [cardRows, responses] = await Promise.all([
    db.select({ id: cards.id, claimId: cards.claimId, fsrs: cards.fsrs, confidentErrorAt: cards.confidentErrorAt }).from(cards).where(eq(cards.actorId, learner)),
    db
      .select({ pageId: learnerResponses.pageId, blockId: learnerResponses.blockId, itemId: learnerResponses.itemId, kind: learnerResponses.kind, claimId: learnerResponses.claimId, response: learnerResponses.response, correct: learnerResponses.correct, confidence: learnerResponses.confidence, at: learnerResponses.at })
      .from(learnerResponses)
      .where(and(eq(learnerResponses.actorId, learner), inArray(learnerResponses.kind, ["guess", "check", "belief"])))
      .orderBy(desc(learnerResponses.at)),
  ]);
  const logs = cardRows.length
    ? await db
        .select({ cardId: reviewLogs.cardId, rating: reviewLogs.rating, correct: reviewLogs.correct, confidence: reviewLogs.confidence, at: reviewLogs.at })
        .from(reviewLogs)
        .where(inArray(reviewLogs.cardId, cardRows.map((c) => c.id)))
        .orderBy(desc(reviewLogs.at))
    : [];

  type Acc = { reasons: { at: Date; text: string }[]; state: ClaimSignalState | null; lastSeen: Date | null };
  const acc = new Map<string, Acc>();
  const get = (id: string): Acc => acc.get(id) ?? (acc.set(id, { reasons: [], state: null, lastSeen: null }), acc.get(id)!);
  const seen = (a: Acc, at: Date) => (a.lastSeen = !a.lastSeen || at > a.lastSeen ? at : a.lastSeen);

  // The deck: graduated and right last time is known; wrong last time after a lapse is forgotten.
  const logsByCard = new Map<string, typeof logs>();
  for (const l of logs) (logsByCard.get(l.cardId) ?? logsByCard.set(l.cardId, []).get(l.cardId)!).push(l);
  const right = (l: { correct: number | null; rating: string }) => (l.correct === null ? l.rating !== "again" : l.correct === 1);
  for (const c of cardRows) {
    if (!inScope(c.claimId)) continue;
    const a = get(c.claimId);
    const state = reviveCard(c.fsrs);
    const mine = logsByCard.get(c.id) ?? [];
    const last = mine[0];
    if (last) seen(a, last.at);
    if (c.confidentErrorAt) {
      a.state = "confused";
      a.reasons.push({ at: c.confidentErrorAt, text: `sure and wrong on ${day(c.confidentErrorAt)}` });
    } else if (last && !right(last) && (state.lapses > 0 || mine.some(right))) {
      a.state = "forgotten";
      a.reasons.push({ at: last.at, text: `got it wrong at the last review, on ${day(last.at)}` });
    } else if (last && right(last) && state.state === 2) {
      a.state = "known";
      a.reasons.push({ at: last.at, text: `remembered at the last review, on ${day(last.at)}` });
    } else if (last) {
      a.state = "shaky";
      a.reasons.push({ at: last.at, text: "still being learned" });
    } else a.state = "met";
    if (state.lapses > 1) a.reasons.push({ at: last?.at ?? new Date(0), text: `forgotten ${state.lapses} times` });
  }

  // Answers outside the deck: beliefs held, checks missed, guesses.
  const latestCheck = new Map<string, (typeof responses)[number]>();
  for (const r of responses) {
    if (r.kind === "belief" && r.claimId && inScope(r.claimId)) {
      const a = get(r.claimId);
      seen(a, r.at);
      if ((r.response as { belief?: string }).belief === "yes") {
        a.reasons.push({ at: r.at, text: "believed this before reading" });
        if (a.state !== "known") a.state = "confused";
      }
    }
    if (r.kind === "check" && r.pageId) {
      const key = `${r.pageId}|${r.blockId}|${r.itemId}`;
      if (!latestCheck.has(key)) latestCheck.set(key, r);
    }
    if (r.kind === "guess" && r.claimId && inScope(r.claimId)) {
      const a = get(r.claimId);
      seen(a, r.at);
      if (r.correct === 0) a.reasons.push({ at: r.at, text: "guessed wrong before reading" });
      a.state ??= "met";
    }
  }
  for (const r of latestCheck.values()) {
    const block = blocksOf.get(r.pageId!)?.find((b) => b.id === r.blockId);
    const item = block?.type === "check" ? block.items.find((i) => i.id === r.itemId) : undefined;
    for (const id of item ? claimIdsInCheckItem(item).filter(isUuid) : []) {
      if (!inScope(id)) continue;
      const a = get(id);
      seen(a, r.at);
      if (r.correct === 0) {
        a.reasons.push({ at: r.at, text: `missed it in the check on ${day(r.at)}` });
        if (a.state === null || a.state === "met" || a.state === "known") a.state = "shaky";
      } else a.state ??= "met";
    }
  }

  const texts = acc.size
    ? new Map((await db.select({ id: claims.id, text: claims.text, kind: claims.kind }).from(claims).where(inArray(claims.id, [...acc.keys()]))).map((r) => [r.id, r]))
    : new Map<string, { text: string; kind: string }>();
  // What corrects each misconception met: "corrects" relations, and the misconception blocks' own lists.
  const myths = [...texts.entries()].filter(([, t]) => t.kind === "misconception").map(([id]) => id);
  const fixes = new Map<string, Set<string>>(myths.map((id) => [id, new Set<string>()]));
  if (myths.length) {
    for (const r of await db
      .select({ fromId: claimRelations.fromId, toId: claimRelations.toId })
      .from(claimRelations)
      .where(and(inArray(claimRelations.toId, myths), eq(claimRelations.type, "corrects"))))
      fixes.get(r.toId)?.add(r.fromId);
    for (const p of eras)
      for (const b of blocksOf.get(p.id) ?? [])
        if (b.type === "misconception" && fixes.has(b.claimId)) b.correctionIds.filter(isUuid).forEach((id) => fixes.get(b.claimId)!.add(id));
  }
  const claimSignals: ClaimSignal[] = [...acc.entries()]
    .filter(([id]) => texts.has(id))
    .map(([id, a]) => ({
      claimId: id,
      text: texts.get(id)!.text,
      kind: texts.get(id)!.kind,
      corrections: [...(fixes.get(id) ?? [])],
      pageSlug: where.get(id)?.pageSlug ?? null,
      chapterId: where.get(id)?.chapterId ?? null,
      state: a.state ?? "met",
      reasons: [...new Set(a.reasons.sort((x, y) => y.at.getTime() - x.at.getTime()).map((r) => r.text))],
      lastSeen: a.lastSeen?.toISOString() ?? null,
    }))
    .sort((x, y) => STATE_ORDER.indexOf(x.state) - STATE_ORDER.indexOf(y.state) || (y.lastSeen ?? "").localeCompare(x.lastSeen ?? ""));

  const troubled = new Set(claimSignals.filter((c) => c.state === "confused" || c.state === "forgotten").map((c) => `${c.pageSlug}|${c.chapterId}`));
  const chapters: ChapterSignal[] = map
    .filter((p) => !page || p.slug === page.slug)
    .flatMap((p) =>
      p.chapters.map((c) => {
        const checkWrong = c.checked - c.checkedRight;
        const begun = c.steps.read || c.steps.skimmed || c.steps.guessed || c.checked > 0 || c.inDeck > 0;
        return {
          pageSlug: p.slug,
          chapterId: c.id,
          title: c.title,
          read: c.steps.read,
          skimmed: c.steps.skimmed,
          guessMiss: c.guess?.miss ?? null,
          checkRight: c.checkedRight,
          checkWrong,
          state: !begun ? "untouched" : checkWrong > 0 || troubled.has(`${p.slug}|${c.id}`) ? "shaky" : c.checked > 0 ? "solid" : "begun",
        } satisfies ChapterSignal;
      }),
    );
  const summary = Object.fromEntries(STATE_ORDER.map((s) => [s, claimSignals.filter((c) => c.state === s).length])) as Record<ClaimSignalState, number>;
  return { page: page ? { slug: page.slug, title: page.title } : null, claims: claimSignals, chapters, summary };
}

export interface TodaysSession {
  /** The part to study, as /learn/today opens it; null when every part has been studied. */
  part: NextPart | null;
  /** Its guess-first question (no answer here: record_guess grades it), if it has one and it is not answered yet. */
  guess: { blockId: string; question: string } | null;
  /** Its end-of-part check, with how many questions are still to answer. */
  check: { blockId: string; questions: number; unanswered: number } | null;
  /** Cards for today: reviews due, plus new ones within the daily allowance. */
  cards: { due: number; reviews: number; fresh: number };
}

/** What /learn/today would show the learner now: the next part, its questions, and today's cards. */
export async function todaysSession(ctx: ActorContext): Promise<TodaysSession> {
  const [part, progress] = await Promise.all([nextPart(ctx), getProgress(ctx)]);
  const cards = { due: progress.deck.due, reviews: progress.today.reviews, fresh: progress.today.fresh };
  if (!part) return { part, guess: null, check: null, cards };
  const [view, state] = await Promise.all([getPageView(part.pageSlug), pageLearning(ctx, part.pageSlug)]);
  const blocks = view.page.blocks;
  const at = blocks.findIndex((b) => b.id === part.chapterId);
  const end = blocks.findIndex((b, i) => i > at && b.type === "chapter");
  const inPart = blocks.slice(at + 1, end < 0 ? undefined : end);
  const g = inPart.find((b) => b.type === "guess");
  const c = inPart.find((b) => b.type === "check");
  return {
    part,
    guess: g?.type === "guess" && !state.guesses[g.id] ? { blockId: g.id, question: g.question } : null,
    check:
      c?.type === "check"
        ? { blockId: c.id, questions: c.items.length, unanswered: c.items.filter((i) => !state.checks[c.id]?.[i.id]).length }
        : null,
    cards,
  };
}
