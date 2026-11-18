/**
 * Quote matching between an excerpt and a captured source text (snapshot).
 *
 * Both sides are normalised: Unicode compatibility decomposition, diacritics
 * removed (OCR often drops or garbles IAST marks), lowercased, punctuation
 * dropped, whitespace collapsed, and end-of-line hyphenation joined. Matching
 * works on the normalised strings; an index map translates results back to
 * offsets in the original text, so selectors point at the real characters.
 *
 * Selectors follow the W3C Web Annotation Data Model (TextQuoteSelector and
 * TextPositionSelector); see docs/standards.md.
 */

export interface NormalizedText {
  norm: string;
  /** map[k] = index in the original string where normalised UTF-16 unit k starts. */
  map: number[];
  /** mapEnd[k] = index just after the original code point that produced unit k. */
  mapEnd: number[];
}

/**
 * Combining diacritics that are folded away (IAST and other Latin
 * transliteration marks). Indic vowel signs, viramas and nuktas are also
 * combining marks (\p{M}) but are letters of their script, so they are kept.
 */
const LATIN_DIACRITICS = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/gu;
const KEEP = /[\p{L}\p{N}\p{M}]/u;
const WHITESPACE = /\s/u;

export function normalizeForMatch(original: string): NormalizedText {
  const out: string[] = [];
  const map: number[] = [];
  const mapEnd: number[] = [];
  let pendingSpace = false;
  let i = 0;
  while (i < original.length) {
    const ch = original[i]!;

    // Join hyphenation across line breaks: "Pata-\n liputra" -> "pataliputra".
    // Hyphen, soft hyphen, U+2010, and "¬" (U+00AC), which some OCR engines emit for line-break hyphens.
    if ((ch === "-" || ch === "\u00ad" || ch === "\u2010" || ch === "\u00ac") && out.length > 0) {
      let j = i + 1;
      while (j < original.length && (original[j] === " " || original[j] === "\t")) j++;
      if (original[j] === "\r") j++;
      if (original[j] === "\n") {
        j++;
        while (j < original.length && (original[j] === " " || original[j] === "\t")) j++;
        i = j;
        continue;
      }
    }
    if (ch === "\u00ad") {
      i++;
      continue;
    }

    if (WHITESPACE.test(ch)) {
      pendingSpace = out.length > 0;
      i++;
      continue;
    }

    // One code point at a time (astral characters such as Brahmi are two UTF-16 units).
    const cp = original.codePointAt(i)!;
    const width = cp > 0xffff ? 2 : 1;
    const folded = String.fromCodePoint(cp).normalize("NFKD").replace(LATIN_DIACRITICS, "").toLowerCase();
    if (folded === "") {
      // A diacritic on its own (decomposed text, ISO 15919 r̥): part of the previous letter.
      i += width;
      continue;
    }
    let emitted = false;
    for (const f of folded) {
      if (!KEEP.test(f)) continue;
      if (pendingSpace) {
        out.push(" ");
        map.push(i);
        mapEnd.push(i);
        pendingSpace = false;
      }
      out.push(f);
      for (let k = 0; k < f.length; k++) {
        map.push(i);
        mapEnd.push(i + width);
      }
      emitted = true;
    }
    // Punctuation separates words: "Asoka,the" must not become "asokathe".
    if (!emitted && out.length > 0 && out[out.length - 1] !== " ") pendingSpace = true;
    i += width;
  }
  return { norm: out.join(""), map, mapEnd };
}

export interface TextQuoteSelector {
  type: "TextQuoteSelector";
  exact: string;
  prefix: string;
  suffix: string;
}

export interface TextPositionSelector {
  type: "TextPositionSelector";
  start: number;
  end: number;
}

export type QuoteMatchStatus = "exact" | "fuzzy" | "not_found";

export interface QuoteMatch {
  status: QuoteMatchStatus;
  /** 1 = identical after normalisation; fuzzy matches are >= threshold. */
  score: number;
  /** Number of exact (normalised) occurrences; >1 means the quote is ambiguous. */
  occurrences: number;
  position?: TextPositionSelector;
  quote?: TextQuoteSelector;
  /** The matched text as it appears in the source (may differ from the quote by OCR noise). */
  matchedText?: string;
}

const CONTEXT_CHARS = 32;
const MAX_QUOTE_CHARS = 3000;

function selectorsFor(
  original: string,
  start: number,
  end: number,
): Pick<QuoteMatch, "position" | "quote" | "matchedText"> {
  const exact = original.slice(start, end);
  return {
    position: { type: "TextPositionSelector", start, end },
    quote: {
      type: "TextQuoteSelector",
      exact,
      prefix: original.slice(Math.max(0, start - CONTEXT_CHARS), start),
      suffix: original.slice(end, end + CONTEXT_CHARS),
    },
    matchedText: exact,
  };
}

function originalRange(n: NormalizedText, s: number, e: number): [number, number] {
  return [n.map[s]!, n.mapEnd[e - 1]!];
}

/**
 * Approximate substring match (Sellers' algorithm): the minimum edit distance
 * between `pattern` and any substring of `text`, with the substring bounds.
 */
function approximateSubstring(
  pattern: string,
  text: string,
): { distance: number; start: number; end: number } {
  const m = pattern.length;
  const n = text.length;
  let prevCost = new Int32Array(n + 1);
  let prevStart = new Int32Array(n + 1);
  for (let j = 0; j <= n; j++) {
    prevCost[j] = 0;
    prevStart[j] = j;
  }
  let curCost = new Int32Array(n + 1);
  let curStart = new Int32Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curCost[0] = i;
    curStart[0] = 0;
    const pc = pattern.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const sub = prevCost[j - 1]! + (pc === text.charCodeAt(j - 1) ? 0 : 1);
      const del = prevCost[j]! + 1; // skip pattern char
      const ins = curCost[j - 1]! + 1; // skip text char
      if (sub <= del && sub <= ins) {
        curCost[j] = sub;
        curStart[j] = prevStart[j - 1]!;
      } else if (del <= ins) {
        curCost[j] = del;
        curStart[j] = prevStart[j]!;
      } else {
        curCost[j] = ins;
        curStart[j] = curStart[j - 1]!;
      }
    }
    [prevCost, curCost] = [curCost, prevCost];
    [prevStart, curStart] = [curStart, prevStart];
  }
  let best = 0;
  for (let j = 1; j <= n; j++) if (prevCost[j]! < prevCost[best]!) best = j;
  return { distance: prevCost[best]!, start: prevStart[best]!, end: best };
}

function indexOfAll(haystack: string, needle: string, limit: number): number[] {
  const out: number[] = [];
  let from = 0;
  while (out.length < limit) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    out.push(idx);
    from = idx + 1;
  }
  return out;
}

/**
 * Locates `quote` inside `original`. Exact (normalised) match first; otherwise
 * a fuzzy match seeded by distinctive words, accepted at `threshold`.
 */
export function findQuote(
  original: string,
  quote: string,
  options: { threshold?: number; normalized?: NormalizedText } = {},
): QuoteMatch {
  const threshold = options.threshold ?? 0.88;
  const hay = options.normalized ?? normalizeForMatch(original);
  const q = normalizeForMatch(canonicalText(quote.slice(0, MAX_QUOTE_CHARS))).norm;
  if (q.length === 0) return { status: "not_found", score: 0, occurrences: 0 };

  const exact = indexOfAll(hay.norm, q, 50);
  if (exact.length > 0) {
    const [s, e] = originalRange(hay, exact[0]!, exact[0]! + q.length);
    return {
      status: "exact",
      score: 1,
      occurrences: exact.length,
      ...selectorsFor(original, s, e),
    };
  }

  // Seed candidate windows from distinctive words of the quote.
  const words = q.split(" ");
  const offsets: number[] = [];
  let acc = 0;
  for (const w of words) {
    offsets.push(acc);
    acc += w.length + 1;
  }
  // Rare words make the best anchors: a word that occurs hundreds of times in
  // the source (a king's title, say) would flood the candidate windows.
  const seeds = words
    .map((w, idx) => ({ w, off: offsets[idx]! }))
    .filter((x) => x.w.length >= 4)
    .map((x) => ({ ...x, hits: indexOfAll(hay.norm, ` ${x.w} `, 400) }))
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => a.hits.length - b.hits.length || b.w.length - a.w.length)
    .slice(0, 6);
  const margin = Math.ceil(q.length * 0.15) + 8;
  const windows = new Map<number, number>();
  for (const seed of seeds) {
    for (const pos of seed.hits.slice(0, 40)) {
      const start = Math.max(0, pos + 1 - seed.off - margin);
      const key = Math.round(start / 16);
      if (!windows.has(key)) windows.set(key, start);
    }
    if (windows.size >= 120) break;
  }

  // Bound the work: fuzzy matching runs inside proposal and approval
  // transactions on a single event loop. ~40M cells is well under a second.
  const CELL_BUDGET = 40_000_000;
  let cells = 0;
  let best: { distance: number; start: number; end: number } | null = null;
  for (const start of windows.values()) {
    const end = Math.min(hay.norm.length, start + q.length + 2 * margin);
    cells += q.length * (end - start);
    if (cells > CELL_BUDGET && best) break;
    const candidate = approximateSubstring(q, hay.norm.slice(start, end));
    if (!best || candidate.distance < best.distance) {
      best = {
        distance: candidate.distance,
        start: start + candidate.start,
        end: start + candidate.end,
      };
    }
    if (best.distance === 0) break;
  }

  if (best && best.end > best.start) {
    const score = 1 - best.distance / q.length;
    if (score >= threshold) {
      const [s, e] = originalRange(hay, best.start, best.end);
      return { status: "fuzzy", score, occurrences: 0, ...selectorsFor(original, s, e) };
    }
    return { status: "not_found", score: Math.max(0, score), occurrences: 0 };
  }
  return { status: "not_found", score: 0, occurrences: 0 };
}

export interface TextHit {
  start: number;
  end: number;
  /** Passage around the hit, from the original text. */
  context: string;
  contextStart: number;
}

/** Finds a phrase in a text (normalised matching) and returns passages around each hit. */
export function searchText(
  original: string,
  phrase: string,
  options: { limit?: number; radius?: number; normalized?: NormalizedText } = {},
): { total: number; hits: TextHit[] } {
  const hay = options.normalized ?? normalizeForMatch(original);
  const q = normalizeForMatch(canonicalText(phrase)).norm;
  if (!q) return { total: 0, hits: [] };
  const radius = options.radius ?? 400;
  const all = indexOfAll(hay.norm, q, 1000);
  const hits = all.slice(0, options.limit ?? 10).map((idx) => {
    const [start, end] = originalRange(hay, idx, idx + q.length);
    const contextStart = Math.max(0, start - radius);
    return { start, end, context: original.slice(contextStart, end + radius), contextStart };
  });
  return { total: all.length, hits };
}

/** Canonical form for stored text: NFC, normalised newlines. */
export function canonicalText(text: string): string {
  return text.normalize("NFC").replace(/\r\n?/g, "\n");
}
