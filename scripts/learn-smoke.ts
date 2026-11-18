/**
 * Smoke test for the learning features against a PREVIEW database, as a
 * separate test learner ("test-learner", shown as "Test learner (preview)"),
 * never as the real user: every learner action belongs to the person who took
 * it. Answers a guess, each kind of check question, a belief and a review on
 * the Maurya page, reads a chapter, answers the first steps, and checks how
 * they were graded and scheduled.
 *
 *   DATABASE_URL=…/pramana_preview pnpm tsx scripts/learn-smoke.ts
 *
 * Needs the learning blocks from scripts/seed/learn-index.ts on the page.
 * The answers stay in the preview database (the audit log is append-only),
 * under the test learner.
 */
import type { Block } from "@pramana/core";
import { databaseName } from "./lib/proposal";

if (!databaseName().includes("preview")) {
  console.error("learn-smoke only runs against a database whose name contains 'preview'.");
  process.exit(1);
}

const svc = await import("@pramana/services");
const { closeDb } = await import("@pramana/db");

const actor = await svc.ensureActor("test-learner", "human", "Test learner (preview)");
const ctx: import("@pramana/services").ActorContext = { actorId: actor.id, kind: "human", handle: actor.handle, onBehalfOfId: null, sessionId: null };

let failures = 0;
function expect(what: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${ok || detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}

try {
  const view = await svc.getPageView("maurya-empire");
  const block = <T extends Block["type"]>(id: string, type: T) => {
    const b = view.page.blocks.find((x) => x.id === id);
    if (!b || b.type !== type) throw new Error(`no ${type} block "${id}" on /maurya-empire; run scripts/seed/learn-index.ts first`);
    return b as Extract<Block, { type: T }>;
  };

  // A guess: first one counts, a second is ignored.
  const guess = block("guess-kalinga", "guess");
  const first = await svc.recordGuess(ctx, { page: "maurya-empire", blockId: guess.id, response: { kind: "number", value: 120000 }, sureness: "medium" });
  const second = await svc.recordGuess(ctx, { page: "maurya-empire", blockId: guess.id, response: { kind: "number", value: 1 }, sureness: "high" });
  expect("a guess within 25% is close", first.already || (first.result.close === true && !first.result.correct), first.result);
  expect("only the first guess counts", second.already && second.response.kind === "number" && first.response.kind === "number" && second.response.value === first.response.value);

  // Check questions, graded on the server.
  const dhamma = block("check-dhamma", "check");
  const order = dhamma.items.find((i) => i.kind === "order")!;
  if (order.kind !== "order") throw new Error("unexpected item");
  const ids = order.items.map((x) => x.claimId);
  const right = (await svc.recordCheckAnswer(ctx, { page: "maurya-empire", blockId: dhamma.id, itemId: order.id, response: { kind: "order", order: [...ids].reverse() }, sureness: "low" })).result;
  expect("order answers are graded against stored dates", right.order?.length === ids.length && typeof right.placed === "number", right);

  const kalinga = block("check-kalinga", "check");
  const place = kalinga.items.find((i) => i.kind === "place")!;
  const dhauli = view.entities[place.kind === "place" ? place.entity : ""];
  const at = dhauli?.geo?.geometry.type === "Point" ? (dhauli.geo.geometry.coordinates as [number, number]) : null;
  if (!at) throw new Error("Dhauli has no point");
  const near = await svc.recordCheckAnswer(ctx, { page: "maurya-empire", blockId: kalinga.id, itemId: place.id, response: { kind: "place", at: [at[0] + 0.3, at[1]] }, sureness: "medium" });
  const far = await svc.recordCheckAnswer(ctx, { page: "maurya-empire", blockId: kalinga.id, itemId: place.id, response: { kind: "place", at: [77.2, 28.6] }, sureness: "high" });
  expect("a tap about 30 km away is right", near.result.correct && (near.result.distanceKm ?? 99) < 50, near.result);
  expect("a tap in Delhi is wrong", !far.result.correct && (far.result.distanceKm ?? 0) > 1000, far.result);

  // Belief: a held belief goes into the deck.
  const myth = block("myth-conversion", "misconception");
  const belief = await svc.recordBelief(ctx, { page: "maurya-empire", blockId: myth.id, belief: "yes" });
  const state = await svc.pageLearning(ctx, "maurya-empire");
  expect("a held belief is recorded and in the deck", state.beliefs[myth.id] === "yes" && state.inDeck.includes(myth.claimId), belief);

  // Review: sure and wrong is flagged, then capped once right.
  const wrong = await svc.recordReview(ctx, { claimId: myth.claimId, correct: false, sureness: "high" });
  expect("sure and wrong is rated again and flagged", wrong.rating === "again" && wrong.confidentError, wrong);
  const signals = await svc.learnerSignals(ctx, { page: "maurya-empire" });
  const mythSignal = signals.claims.find((c) => c.claimId === myth.claimId);
  expect("signals show the sure-and-wrong belief as confused, with reasons", mythSignal?.state === "confused" && mythSignal.reasons.some((r) => r.startsWith("sure and wrong")) && mythSignal.reasons.includes("believed this before reading") && mythSignal.corrections.length > 0, mythSignal);
  expect("signals stay on the page asked for", signals.claims.every((c) => c.pageSlug === "maurya-empire") && signals.chapters.every((c) => c.pageSlug === "maurya-empire"), signals.summary);
  const rightAfter = await svc.recordReview(ctx, { claimId: myth.claimId, correct: true, sureness: "high", easy: true });
  const days = (rightAfter.nextDue.getTime() - Date.now()) / 86_400_000;
  expect("the next right answer comes back within two days", rightAfter.rating === "easy" && days <= 2.01, { ...rightAfter, days });

  // Chapter read: recorded once, and drawn in the chapter's progress seal.
  const firstRead = await svc.markChapterRead(ctx, { page: "maurya-empire", chapterId: "ch-kalinga" });
  const againRead = await svc.markChapterRead(ctx, { page: "maurya-empire", chapterId: "ch-kalinga" });
  const seal = (await svc.pageLearning(ctx, "maurya-empire")).chapters["ch-kalinga"];
  expect("a chapter read is recorded once and fills its seal", !againRead.recorded && seal?.read === true && seal.guessed && seal.checked, { firstRead, seal });

  // First steps: graded against the ages' dates and Pāṭaliputra's point; hidden once the learner has done anything.
  expect("first steps are hidden for a learner with activity", (await svc.firstSteps(ctx)) === null);
  const fresh = await svc.firstSteps(ctx, { always: true });
  if (fresh) {
    const right = [...fresh.ages].sort((a, b) => a.start - b.start).map((a) => a.entityId);
    const ages = await svc.recordFirstStep(ctx, { step: "ages", response: { kind: "order", order: right }, sureness: "medium" });
    expect("first steps: ages in date order are right", ages.result.correct, ages.result);
    const at = fresh.place?.entity.geo?.geometry.type === "Point" ? (fresh.place.entity.geo.geometry.coordinates as [number, number]) : null;
    if (at) {
      const placed = await svc.recordFirstStep(ctx, { step: "place", response: { kind: "place", at }, sureness: "high" });
      expect("first steps: a pin on the city is right", placed.result.correct && placed.result.distanceKm === 0, placed.result);
    }
  }

  // Skimming is recorded apart from reading.
  const unread = Object.entries((await svc.pageLearning(ctx, "gupta-empire")).chapters).find(([, st]) => !st.read)?.[0];
  if (unread) {
    await svc.markChapterRead(ctx, { page: "gupta-empire", chapterId: unread, how: "skimmed" });
    const st = (await svc.pageLearning(ctx, "gupta-empire")).chapters[unread];
    expect("a skimmed part is skimmed, not read", st?.skimmed === true && st.read === false, st);
  }

  // New cards are met a few a day; reviews are never held back.
  const today = await svc.getProgress(ctx);
  const due = await svc.dueCards(ctx, { limit: 100 });
  const newInSession = due.filter((c) => c.reps === 0).length;
  expect("new cards stay within the daily allowance", today.today.fresh <= today.today.perDay && newInSession <= today.today.fresh, today.today);
  expect("today's count is reviews plus new", today.deck.due === today.today.reviews + today.today.fresh, { deck: today.deck.due, today: today.today });
  const session = await svc.todaysSession(ctx);
  expect("today's session counts the same cards as /learn", session.cards.due === today.deck.due && (!session.part || session.part.pageSlug.length > 0), session.cards);

  const progress = await svc.getProgress(ctx);
  expect("progress counts guesses, checks and beliefs", progress.practice.guesses >= 1 && progress.practice.checks.answered >= 3 && progress.practice.beliefs.answered >= 1, progress.practice);
} finally {
  closeDb();
}
if (failures) {
  console.error(`${failures} failed`);
  process.exit(1);
}
