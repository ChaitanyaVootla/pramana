"use server";

import { BeliefInput, ChapterReadInput, CheckAnswerInput, FirstStepInput, GuessInput, GuessSkipInput } from "@pramana/core";
import * as svc from "@pramana/services";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/**
 * Server actions for answers on pages ("Guess first", end-of-chapter checks,
 * "Did you believe this?"). They run as the local human user through the
 * services layer, which grades the answer against the stored claims and
 * entities and writes an audit event. Arguments are validated at runtime.
 */

const Id = z.uuid();
const BlockRef = z.string().min(1).max(64);

export type LearnActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>): Promise<LearnActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function pageLearningAction(pageId: string) {
  return attempt(async () => svc.pageLearning(await svc.humanContext(), Id.parse(pageId)));
}

export async function recordGuessAction(input: GuessInput) {
  return attempt(async () => svc.recordGuess(await svc.humanContext(), GuessInput.parse(input)));
}

export async function recordCheckAnswerAction(input: CheckAnswerInput) {
  return attempt(async () => {
    const r = await svc.recordCheckAnswer(await svc.humanContext(), CheckAnswerInput.parse(input));
    if (r.review) revalidatePath("/learn");
    return r;
  });
}

export async function addCheckToDeckAction(pageId: string, blockId: string) {
  return attempt(async () => {
    const r = await svc.addCheckToDeck(await svc.humanContext(), Id.parse(pageId), BlockRef.parse(blockId));
    revalidatePath("/learn");
    return r;
  });
}

export async function recordBeliefAction(input: BeliefInput) {
  return attempt(async () => {
    const r = await svc.recordBelief(await svc.humanContext(), BeliefInput.parse(input));
    if (r.addedToDeck) revalidatePath("/learn");
    return r;
  });
}

export async function recordFirstStepAction(input: FirstStepInput) {
  return attempt(async () => svc.recordFirstStep(await svc.humanContext(), FirstStepInput.parse(input)));
}

export async function markChapterReadAction(input: ChapterReadInput) {
  return attempt(async () => svc.markChapterRead(await svc.humanContext(), ChapterReadInput.parse(input)));
}

export async function skipGuessAction(input: GuessSkipInput) {
  return attempt(async () => svc.skipGuess(await svc.humanContext(), GuessSkipInput.parse(input)));
}

export async function addChapterToDeckAction(pageId: string, chapterId: string) {
  return attempt(async () => {
    const r = await svc.addChapterToDeck(await svc.humanContext(), Id.parse(pageId), BlockRef.parse(chapterId));
    revalidatePath("/learn");
    return r;
  });
}

export async function learnedTodayAction() {
  return attempt(async () => svc.learnedToday(await svc.humanContext()));
}

/** After today's session: the part after the one just studied, and how many new cards today still allows. */
export async function keepGoingAction(chapterId: string | null) {
  return attempt(async () => {
    const ctx = await svc.humanContext();
    const except = chapterId ? [BlockRef.parse(chapterId)] : [];
    const [part, cards] = await Promise.all([svc.nextPart(ctx, { except }), svc.newCardsLeftToday(ctx)]);
    return { part, ...cards };
  });
}
