/** Accent-folded, lowercased text: "Aśoka" -> "asoka". */
function fold(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}

function wordsOf(folded: string): string[] {
  return folded.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
}

/**
 * The loose form of a folded word, so that the ASCII spellings people type
 * meet the IAST the content uses: "ashoka" and "aśoka" both become "asoka",
 * "krishna" and "kṛṣṇa" both "krsna", "chandragupta" and "candragupta" both
 * "candragupta", "pataaliputra" "pataliputra". Doubled vowels collapse (aa for
 * ā), "sh" is s (for ś and ṣ), "ch" and "chh" are c, "ri" is r (for ṛ).
 * Applied to both the stored text and the query, so it only has to be
 * consistent, not right; it is repeated until nothing changes.
 */
export function looseSpelling(word: string): string {
  let w = word;
  for (let i = 0; i < 4; i++) {
    const next = w
      .replace(/ee/g, "i")
      .replace(/oo/g, "u")
      .replace(/([aiu])\1+/g, "$1")
      .replace(/chh?/g, "c")
      .replace(/sh/g, "s")
      .replace(/ri/g, "r");
    if (next === w) break;
    w = next;
  }
  return w;
}

/**
 * Text for full-text search: accent-folded and lowercased, followed by the
 * loose form of every word that has one ("Aśoka, Ashoka" -> "asoka, ashoka"
 * plus "asoka"), so that either spelling finds it.
 */
export function foldForSearch(...parts: (string | null | undefined)[]): string {
  return withLooseWords(fold(parts.filter((p): p is string => Boolean(p)).join(" ")));
}

/** Folded search text with the loose words it lacks appended (idempotent). */
export function withLooseWords(folded: string): string {
  const words = new Set(wordsOf(folded));
  const extra = [...new Set([...words].map(looseSpelling))].filter((w) => !words.has(w));
  return extra.length ? `${folded} ${extra.join(" ")}` : folded;
}

/** The loose form of a phrase, for comparing names: "Aśoka Maurya" and "ashoka maurya" both give "asoka maurya". */
export function looseKey(text: string): string {
  return wordsOf(fold(text)).map(looseSpelling).join(" ");
}

/** A prefix tsquery from free text: "ashok kalin" -> "(ashok:* | asok:*) & kalin:*". */
export function toPrefixQuery(text: string): string | null {
  const words = wordsOf(fold(text)).slice(0, 12);
  if (words.length === 0) return null;
  return words
    .map((w) => {
      const loose = looseSpelling(w);
      return loose === w ? `${w}:*` : `(${w}:* | ${loose}:*)`;
    })
    .join(" & ");
}

/** Shallow diff of the keys in `next` against `prev`. */
export function changedFields(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    if (JSON.stringify(prev[key]) !== JSON.stringify(value)) {
      before[key] = prev[key] ?? null;
      after[key] = value;
    }
  }
  return { before, after };
}

export class NotFoundError extends Error {
  override name = "NotFoundError";
}

export class ValidationError extends Error {
  override name = "ValidationError";
}
