import { claimIdsInBlock, extractLinks, type Block } from "@pramana/core";
import { layoutEra } from "@/lib/era";

export type GuessBlock = Extract<Block, { type: "guess" }>;
export type CheckBlock = Extract<Block, { type: "check" }>;

export interface GuessPlacements {
  /** Block id → the guesses whose answer is shown right after that block. */
  after: Map<string, GuessBlock[]>;
  /** Check block id → the guesses answered at the top of that check. */
  inCheck: Map<string, GuessBlock[]>;
  /** Block id → the chapter it is in. */
  chapterOf: Map<string, string>;
  /** The last block of each chapter → that chapter (where its end marker goes). */
  chapterEnds: Map<string, string>;
}

const cache = new WeakMap<Block[], GuessPlacements>();

/**
 * Where each "Guess first" answer is revealed, using the same chapters the
 * reader draws: after its `revealAfter` block if that comes later in the same
 * chapter, else at the top of the chapter's check, else after the chapter's
 * last block.
 */
export function guessPlacements(blocks: Block[]): GuessPlacements {
  const hit = cache.get(blocks);
  if (hit) return hit;
  const out: GuessPlacements = { after: new Map(), inCheck: new Map(), chapterOf: new Map(), chapterEnds: new Map() };
  const layout = layoutEra(blocks, claimIdsInBlock);
  for (const c of layout.chapters) {
    c.blocks.forEach((b) => out.chapterOf.set(b.id, c.id));
    const last = c.blocks.at(-1);
    if (last) out.chapterEnds.set(last.id, c.id);
  }
  const runs = [layout.intro, ...layout.chapters.map((c) => c.blocks)];
  const push = (map: Map<string, GuessBlock[]>, key: string, g: GuessBlock) => map.set(key, [...(map.get(key) ?? []), g]);
  for (const run of runs) {
    run.forEach((b, i) => {
      if (b.type !== "guess") return;
      const target = b.revealAfter ? run.findIndex((x) => x.id === b.revealAfter) : -1;
      if (target > i) return push(out.after, run[target]!.id, b);
      const check = run.find((x, j) => j > i && x.type === "check");
      if (check) return push(out.inCheck, check.id, b);
      push(out.after, run[run.length - 1]!.id, b);
    });
  }
  cache.set(blocks, out);
  return out;
}

/**
 * Whether a guess's answer is in its part's one-minute summary: the summary
 * links the guess's claim. A summary that leaves the claim out cannot be
 * pointed to for the answer.
 */
export function briefAnswers(blocks: Block[], guess: GuessBlock): boolean {
  const chapter = blocks.find((b) => b.id === guessPlacements(blocks).chapterOf.get(guess.id));
  if (chapter?.type !== "chapter" || !chapter.brief) return false;
  const md = `${chapter.brief.happened}\n${chapter.brief.howWeKnow}`;
  return extractLinks(md).some((l) => l.scheme === "claim" && l.target === guess.claimId);
}
