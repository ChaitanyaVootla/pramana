/**
 * Audit: does each part's one-minute summary give the answer to its "Guess
 * first" question? A summary answers a guess when it links the guess's claim.
 * Where it does not, the guess card shows the answer itself in summary
 * reading (Today's session, a folded part), so nothing breaks; but the
 * summary is the better place, so these are worth a brief edit.
 *
 *   pnpm tsx scripts/learn-guess-briefs.ts          # every era page
 */
import { extractLinks } from "@pramana/core";
import { closeDb } from "@pramana/db";
import { getPageView, listPages } from "@pramana/services";

let missing = 0;
let total = 0;
for (const page of await listPages({ kind: "era" })) {
  const view = await getPageView(page.slug);
  let chapter: Extract<(typeof view.page.blocks)[number], { type: "chapter" }> | null = null;
  for (const b of view.page.blocks) {
    if (b.type === "chapter") chapter = b;
    if (b.type !== "guess" || !chapter) continue;
    total++;
    const brief = chapter.brief;
    const linked = brief ? extractLinks(`${brief.happened}\n${brief.howWeKnow}`).some((l) => l.scheme === "claim" && l.target === b.claimId) : false;
    if (brief && !linked) {
      missing++;
      const claim = view.claims[b.claimId];
      console.log(`/${page.slug} ${chapter.id} (${b.id}): “${b.question}”\n   answer's claim: ${claim?.text.slice(0, 110) ?? b.claimId}`);
    }
  }
}
console.log(`\n${missing} of ${total} guesses have a summary that does not give their answer.`);
closeDb();
