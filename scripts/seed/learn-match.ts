/**
 * Finds the claim a learn script means by a prefix of its text. Claims get
 * reworded while questions are being written (support checks, copy passes),
 * so an exact prefix falls back to the claim sharing most of the prefix's
 * words, when one clearly wins. Matches by words are reported, so the
 * prefixes can be updated.
 */
const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();

const words = (s: string) => new Set(fold(s).match(/[\p{L}\p{N}]{4,}/gu) ?? []);

export function matchClaim<T extends { id: string; text: string }>(
  claims: T[],
  prefix: string,
  where: string,
): T {
  const exact = claims.filter((c) => c.text.startsWith(prefix));
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) throw new Error(`${where}: “${prefix}” starts ${exact.length} claims; make it longer`);
  const want = words(prefix);
  const scored = claims
    .map((c) => {
      const have = words(c.text);
      return { c, score: want.size ? [...want].filter((w) => have.has(w)).length / want.size : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (best && best.score >= 0.6 && best.score - (second?.score ?? 0) >= 0.15) {
    console.log(`  ${where}: “${prefix}” matched by words to “${best.c.text.slice(0, 70)}…”`);
    return best.c;
  }
  throw new Error(`${where}: no claim starts with “${prefix}”`);
}
