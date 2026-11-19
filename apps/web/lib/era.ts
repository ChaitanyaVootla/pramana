import {
  dateBounds,
  formatFuzzyDate,
  toFuzzyDate,
  type AtlasSpec,
  type Block,
  type DateBounds,
  type PageSpec,
} from "@pramana/core";
import type { ClaimCard, EntityCard, ExtentFeature, PageView } from "@pramana/services";
import { spanLabel } from "./time";

/** A chapter: its heading block and the blocks under it, up to the next chapter. */
export interface Chapter {
  id: string;
  head: Extract<Block, { type: "chapter" }> | Extract<Block, { type: "heading" }>;
  blocks: Block[];
  claimIds: string[];
}

export interface EraLayout {
  /** Prose before the first chapter: the lede. */
  intro: Block[];
  alreadyKnow: Extract<Block, { type: "already_know" }> | null;
  /** A "meanwhile" block placed before the first chapter (one inside a chapter stays in its blocks). */
  meanwhile: Extract<Block, { type: "meanwhile" }> | null;
  chapters: Chapter[];
}

const HOISTED = new Set(["already_know", "meanwhile"]);

/**
 * Splits a page into an intro, hoisted orientation blocks and chapters.
 * Pages written before chapter blocks existed fall back to level-2 headings.
 */
export function layoutEra(blocks: Block[], claimIdsOf: (b: Block) => string[]): EraLayout {
  const usesChapters = blocks.some((b) => b.type === "chapter");
  const isHead = (b: Block) =>
    usesChapters ? b.type === "chapter" : b.type === "heading" && b.level === 2;
  const out: EraLayout = { intro: [], alreadyKnow: null, meanwhile: null, chapters: [] };
  let current: Chapter | null = null;
  for (const b of blocks) {
    if (b.type === "already_know") out.alreadyKnow ??= b;
    // "Meanwhile" stays where the author put it: before the first chapter it joins the orientation; inside a chapter it is read there.
    if (b.type === "meanwhile" && current) {
      current.blocks.push(b);
      current.claimIds.push(...claimIdsOf(b));
      continue;
    }
    if (b.type === "meanwhile") out.meanwhile ??= b;
    if (HOISTED.has(b.type)) continue;
    if (isHead(b)) {
      // A chapter's brief links claims too: they count as the chapter's.
      current = { id: b.id, head: b as Chapter["head"], blocks: [], claimIds: claimIdsOf(b) };
      out.chapters.push(current);
      continue;
    }
    if (!current) out.intro.push(b);
    else {
      current.blocks.push(b);
      current.claimIds.push(...claimIdsOf(b));
    }
  }
  for (const c of out.chapters) c.claimIds = [...new Set(c.claimIds)];
  return out;
}

export function chapterTitle(c: Chapter): string {
  return c.head.type === "chapter" ? c.head.title : c.head.text;
}

/** "about 2,300 years ago", from the start of a span (astronomical years). */
export function yearsAgo(
  bounds: DateBounds | null | undefined,
  now = new Date().getFullYear(),
): string | null {
  const start = bounds?.startMin;
  if (start === null || start === undefined) return null;
  const n = now - start;
  if (n < 1) return null;
  const rounded =
    n >= 1000 ? Math.round(n / 100) * 100 : n >= 100 ? Math.round(n / 10) * 10 : Math.round(n);
  return `about ${rounded.toLocaleString("en-GB")} years ago`;
}

export function spanYears(bounds: DateBounds | null | undefined): number | null {
  if (!bounds || bounds.startMin === null || bounds.endMax === null) return null;
  return Math.round(bounds.endMax - bounds.startMin);
}

/** Midpoint (astronomical) of a span, for placing a tick. */
export function midYear(bounds: DateBounds | null | undefined): number | null {
  if (!bounds || bounds.startMin === null) return null;
  const end = bounds.endMax ?? bounds.startMin + 1;
  return (bounds.startMin + end) / 2;
}

export type SourceTierGlyph = "inscription" | "text" | "scholarship" | "reference" | "none";

/** What kind of source a claim mainly rests on, for the seal's glyph. */
export function claimTier(claim: ClaimCard): SourceTierGlyph {
  const evidential = claim.citations.filter((c) => c.stance !== "mentions");
  if (evidential.length === 0) return "none";
  const tiers = evidential.map((c) => c.excerpt.source);
  const primary = tiers.find((s) => s.tier === "primary");
  if (primary) {
    const looksInscribed = /inscription|edict/i.test(`${primary.title} ${primary.kind}`);
    return looksInscribed ? "inscription" : "text";
  }
  if (tiers.some((s) => s.tier === "secondary")) return "scholarship";
  return "reference";
}

/** Entities of a kind referenced by a page, deduplicated (cards are keyed by id and slug). */
export function uniqueEntities(view: PageView, refs: string[]): EntityCard[] {
  const seen = new Set<string>();
  const out: EntityCard[] = [];
  for (const r of refs) {
    const e = view.entities[r];
    if (!e || seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

/** People, places and terms in a chapter: declared on the chapter, else gathered from its claims. */
export function chapterContext(view: PageView, chapter: Chapter) {
  const declared = chapter.head.type === "chapter" ? chapter.head : null;
  const fromClaims = chapter.claimIds.flatMap((id) => view.claims[id]?.entities ?? []);
  const people = declared?.people.length
    ? uniqueEntities(view, declared.people)
    : uniqueEntities(
        view,
        fromClaims.filter((e) => view.entities[e.id]?.kind === "person").map((e) => e.id),
      );
  const places = declared?.places.length
    ? uniqueEntities(view, declared.places)
    : uniqueEntities(
        view,
        fromClaims
          .filter((e) => ["place", "site", "inscription"].includes(view.entities[e.id]?.kind ?? ""))
          .map((e) => e.id),
      );
  const terms = declared ? uniqueEntities(view, declared.terms) : [];
  const witnesses = new Set(people.filter((p) => isWitness(view, chapter, p)).map((p) => p.id));
  return {
    /** Who took part in what the part tells. */
    people: people.filter((p) => !witnesses.has(p.id)),
    /** Who wrote or spoke about it: their words are the evidence, not their deeds. */
    witnesses: people.filter((p) => witnesses.has(p.id)),
    places,
    terms,
  };
}

/** Lowercase, no diacritics or punctuation: "Aśoka" and "Asoka" compare equal. */
function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whether a source's CSL authors include this person (by name or alias). */
function authoredBy(
  source: ClaimCard["citations"][number]["excerpt"]["source"],
  person: EntityCard,
): boolean {
  const names = [person.label, ...person.aliases.map((a) => a.label)]
    .map(normName)
    .filter((n) => n.length > 3);
  const authors = (source.csl.author ?? []).map((a) =>
    normName(
      a.literal ?? [a.given, a["non-dropping-particle"], a.family].filter(Boolean).join(" "),
    ),
  );
  return authors.some((a) => names.some((n) => a === n || ` ${a} `.includes(` ${n} `)));
}

/**
 * A person is in a part as a witness, not an actor, when the claims say so
 * (role "author"), or when every claim of the part that names them rests on
 * their own writing and none has them taking part: Marx reporting on 1857.
 */
function isWitness(view: PageView, chapter: Chapter, person: EntityCard): boolean {
  const naming = chapter.claimIds
    .map((id) => view.claims[id])
    .filter((c): c is ClaimCard => Boolean(c?.entities.some((e) => e.id === person.id)));
  if (!naming.length) return false;
  const roles = naming.flatMap((c) =>
    c.entities.filter((e) => e.id === person.id).map((e) => e.role),
  );
  if (roles.includes("author")) return !roles.includes("participant");
  if (roles.includes("participant")) return false;
  return naming.every((c) =>
    c.citations.some((ci) => ci.stance !== "mentions" && authoredBy(ci.excerpt.source, person)),
  );
}

/** A chapter's own date, when it has one. */
export function chapterBounds(c: Chapter): DateBounds | null {
  if (c.head.type !== "chapter" || !c.head.when) return null;
  try {
    return dateBounds(toFuzzyDate(c.head.when));
  } catch {
    return null;
  }
}

export function chapterWhenLabel(c: Chapter): string | null {
  if (c.head.type !== "chapter" || !c.head.when) return null;
  try {
    return formatFuzzyDate(toFuzzyDate(c.head.when));
  } catch {
    return null;
  }
}

/** "afterwards" for chapters about how we know; "throughout" for undated chapters about the whole period. */
export function chapterPhaseLabel(c: Chapter): string {
  return c.head.type === "chapter" && c.head.phase === "later" ? "afterwards" : "throughout";
}

/** A date or span as a strip mark: a year, or a span. */
export function stripMark(b: DateBounds): number | [number, number] | null {
  if (b.startMin === null) return null;
  const end = b.endMax ?? b.startMin;
  return end - b.startMin > 2 ? [b.startMin, end] : b.startMin;
}

/**
 * The single year that stands for a date, for setting the atlas: the year
 * itself, or the middle of a span. Bounds are fractional (a year runs from y
 * to y + 1), so this floors the midpoint.
 */
export function yearOf(b: DateBounds | null | undefined): number | null {
  const mid = midYear(b);
  return mid === null ? null : Math.floor(mid);
}

/** Middle year of the extent where a polity was largest. */
export function peakYear(
  extents: Pick<ExtentFeature, "fromYear" | "toYear" | "areaKm2">[],
): number | null {
  const peak = extents.reduce<(typeof extents)[number] | null>(
    (a, b) => ((b.areaKm2 ?? 0) > (a?.areaKm2 ?? 0) ? b : a),
    null,
  );
  return peak ? Math.floor((peak.fromYear + peak.toYear) / 2) : null;
}

export type HeroPanelName = NonNullable<PageSpec["hero"]["panels"]>[number];
export type RailPanelName = NonNullable<PageSpec["rail"]["panels"]>[number];

/** A page spec with its defaults applied and its refs resolved to entity ids. */
export interface EraSpec {
  hero: HeroPanelName[];
  rail: RailPanelName[];
  /** The atlas, if the page has one, with `focus` as entity ids (the page's own entity included). */
  atlas: AtlasSpec | null;
  /** Where the atlas goes: the reading rail on wide screens, or the hero. */
  atlasIn: "rail" | "hero" | null;
  /** Show the standalone period timeline (pages with no atlas). */
  timelineIn: "rail" | "hero" | null;
  timelineRange: [number, number] | null;
  outline: boolean;
  media: string | null;
}

/**
 * Resolves what an era page shows and where. Defaults: the atlas in the rail
 * above "in this part" and the notes; the hero carries the lead image and
 * "You may already know"; the outline sits beside the chapters.
 */
export function resolveEraSpec(view: PageView, chapters: number): EraSpec {
  const spec = view.page.spec;
  const entityId = view.page.entity?.id ?? null;
  const focus = new Set<string>();
  if (entityId) focus.add(entityId);
  for (const ref of spec.atlas?.focus ?? []) {
    const id = view.entities[ref]?.id;
    if (id) focus.add(id);
  }
  const atlas = spec.atlas ? { ...spec.atlas, focus: [...focus] } : null;

  const hero = (spec.hero.panels ?? ["media", "already_know"]).filter((p) =>
    p === "atlas" ? atlas !== null : true,
  );
  const atlasInHero = hero.includes("atlas");
  const rail = (
    spec.rail.panels ??
    (atlas ? ["atlas", "in_this_part", "notes"] : ["timeline", "in_this_part", "notes"])
  ).filter((p) => (p === "atlas" ? atlas !== null && !atlasInHero : true));
  const atlasIn = atlasInHero ? "hero" : rail.includes("atlas") ? "rail" : null;
  // The atlas carries the period timeline; a separate one appears only without it.
  const timelineIn = atlasIn
    ? null
    : hero.includes("timeline")
      ? "hero"
      : rail.includes("timeline")
        ? "rail"
        : null;
  return {
    hero,
    rail,
    atlas,
    atlasIn,
    timelineIn,
    timelineRange: spec.timeline?.range ?? null,
    outline: spec.outline === "sidebar" && chapters > 1,
    media: spec.hero.media ?? null,
  };
}

/** Claims on the page that name an entity, in page order. */
export function claimsNaming(view: PageView, entityId: string, order: string[]): ClaimCard[] {
  return order
    .map((id) => view.claims[id])
    .filter((c): c is ClaimCard => Boolean(c?.entities.some((e) => e.id === entityId)));
}

/** "600–501 BCE", "1202–1209 CE": always with the era, so a list of dates reads one way. */
export function eraSpan(from: number, to: number): string {
  const label = spanLabel(from, to);
  return /BCE|CE/.test(label) ? label : `${label} CE`;
}

/**
 * How long a span lasted, in words, without false precision: exact spans of
 * under a century as they are; otherwise rounded (to 5, 10, 50 or 100 years,
 * coarser when the ends are approximate) and said with "about".
 */
export function durationWords(bounds: DateBounds | null | undefined): string | null {
  const n = spanYears(bounds);
  if (n === null || n < 2) return null;
  const approx = Boolean(bounds?.approximate);
  if (!approx && n < 100) return `${n} years`;
  const step = n >= 1000 ? 100 : n >= 300 ? (approx ? 50 : 10) : approx ? 10 : 5;
  const r = Math.max(step, Math.round(n / step) * step);
  return `${r === n ? "" : "about "}${r.toLocaleString("en-GB")} years`;
}

const START_WORD: Record<string, Record<string, string>> = {
  life: { default: "born" },
  reign: { default: "reigned from" },
  floruit: { default: "active from" },
  existence: { place: "founded", site: "founded", default: "began" },
  construction: { default: "begun" },
  activity: { default: "began" },
};
const END_WORD: Record<string, string> = {
  life: "died",
  reign: "reigned until",
  existence: "ended",
  construction: "finished",
};

function ordinal(n: number): string {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${n}${s}`;
}

/** "-0199/-0100" is the 2nd century BCE; "0301/0400" the 4th century CE. */
function centuryOf(edtf: string): string | null {
  const m = /^(-?\d{4})\/(-?\d{4})$/.exec(edtf);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b - a !== 99) return null;
  // Astronomical -199..-100 is 200–101 BCE: the 2nd century BCE.
  if (b <= 0 && (1 - a) % 100 === 0) return `${ordinal((1 - a) / 100)} century BCE`;
  if (a > 0 && a % 100 === 1) return `${ordinal(Math.ceil(b / 100))} century CE`;
  return null;
}

/**
 * An entity's date as a reader should meet it: what the date is of, not just
 * the numbers. A start with no known end is a birth or a founding ("born
 * 476 CE", "founded c. 500 BCE"); a century-precision date reads as a century.
 * Uncertain dates (EDTF "?") say "probably".
 */
export function datedLabel(
  entity: Pick<EntityCard, "kind" | "when" | "whenLabel" | "spans">,
): string | null {
  const edtf = entity.when?.edtf;
  if (!edtf || !entity.whenLabel) return entity.whenLabel ?? null;
  const span = entity.spans?.find((s) => s.when.edtf === edtf) ?? entity.spans?.[0];
  const role =
    span?.when.edtf === edtf
      ? span.role
      : entity.kind === "person"
        ? "life"
        : ["place", "site", "polity"].includes(entity.kind)
          ? "existence"
          : null;
  const uncertain = /\?/.test(edtf);
  const clean = edtf.replace(/\?/g, "");
  const start = /^([^/]+)\/(\.\.)?$/.exec(clean);
  const end = /^\/(.+)$/.exec(clean);
  const word = (w: string) => (uncertain ? `probably ${w}` : w);
  // A date the sources give by tradition says so ("founded c. 490 BCE (traditional)").
  const basis = `${entity.when?.basis ?? ""} ${span?.basis ?? ""}`;
  const traditional =
    /tradition/i.test(basis) && !/\(traditional\)/.test(entity.whenLabel) ? " (traditional)" : "";
  const fmt = (part: string) => {
    try {
      return formatFuzzyDate({ edtf: part });
    } catch {
      return null;
    }
  };
  if (role && start && !start[2]) {
    const words = START_WORD[role];
    const when = fmt(start[1]!);
    if (words && when) return `${word(words[entity.kind] ?? words.default!)} ${when}${traditional}`;
  }
  if (role && end && END_WORD[role]) {
    const when = fmt(end[1]!);
    if (when) return `${word(END_WORD[role]!)} ${when}${traditional}`;
  }
  const century = centuryOf(clean);
  if (century) return role === "construction" ? `begun in the ${century}` : century;
  return entity.whenLabel;
}

/** A chapter's one-minute version, when the author has written one. */
export function chapterBrief(c: Chapter): { happened: string; howWeKnow: string } | null {
  return c.head.type === "chapter" ? (c.head.brief ?? null) : null;
}

/** Words in Markdown, without link targets: for reading-time estimates. */
export function wordCount(markdown: string): number {
  return markdown
    .replace(/\]\([^)]*\)/g, "]")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Reading time, from seconds, as a reader would say it: to the minute below
 * ten, then to the nearest five (an estimate should not look precise).
 */
export function readingMinutes(seconds: number): number {
  const m = seconds / 60;
  return m < 10 ? Math.max(1, Math.round(m)) : Math.round(m / 5) * 5;
}

/**
 * Seconds a block takes: 200 words a minute for anything read, 20 seconds
 * more for a quotation (read twice, slowly), 30 seconds for each question
 * answered, 10 for a picture, and 10 for each quotation in a "tracks" grid
 * (short ones, read once among many). Deterministic: the same page always
 * gives the same estimate.
 */
export function blockSeconds(b: Block, words: (b: Block) => number): number {
  const read = words(b) * 0.3;
  if (b.type === "quote") return read + 20;
  if (b.type === "tracks") return read + 10 * b.cells.filter((c) => c.excerptId).length;
  if (b.type === "guess") return read + 30;
  if (b.type === "check") return read + 30 * b.items.length;
  if (b.type === "figure" || b.type === "gallery") return read + 10;
  return read;
}

type GuessBlockOf = Extract<Block, { type: "guess" }>;
type GuessResp =
  | { kind: "choice"; option: number }
  | { kind: "number"; value: number }
  | { kind: "year"; year: number; era: "BCE" | "CE" };

/** A guess's answer in words: "150,000 people", "1924 CE", "Patna". */
export function answerWords(a: GuessBlockOf["answer"]): string {
  if (a.kind === "choice") return a.options[a.correct] ?? "";
  if (a.kind === "number") return `${a.value.toLocaleString("en-GB")}${a.unit ? ` ${a.unit}` : ""}`;
  return `${a.year} ${a.era}`;
}

/** The learner's guess in the same words. */
export function guessWords(a: GuessBlockOf["answer"], g: GuessResp): string {
  if (a.kind === "choice" && g.kind === "choice") return a.options[g.option] ?? "";
  if (a.kind === "number" && g.kind === "number")
    return `${g.value.toLocaleString("en-GB")}${a.unit ? ` ${a.unit}` : ""}`;
  if (g.kind === "year") return `${g.year} ${g.era}`;
  return "";
}

/**
 * How far off a guess was, comparable across kinds: a wrong choice is 1, a
 * number the relative error, a year the error in centuries (capped at 1 each).
 */
export function guessDistance(a: GuessBlockOf["answer"], g: GuessResp): number {
  if (a.kind === "choice" && g.kind === "choice") return g.option === a.correct ? 0 : 1;
  if (a.kind === "number" && g.kind === "number")
    return Math.min(1, Math.abs(g.value - a.value) / Math.max(1, Math.abs(a.value)));
  if (a.kind === "year" && g.kind === "year") {
    const astro = (y: number, e: "BCE" | "CE") => (e === "BCE" ? 1 - y : y);
    return Math.min(1, Math.abs(astro(g.year, g.era) - astro(a.year, a.era)) / 100);
  }
  return 0;
}

/** Without accents or case, for telling whether a name is in a quotation. */
function plain(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * A person the claim is about whom the quotation does not name as we do, with a
 * recorded alias that says what the source calls them ("Devānaṃpiya Piyadasi").
 * Only aliases with a note are offered: the note is what explains the name.
 */
export function otherNames(quote: string, entities: EntityCard[]) {
  const q = plain(quote);
  return entities.flatMap((e) => {
    if (e.kind !== "person" || q.includes(plain(e.label))) return [];
    if (e.aliases.some((a) => q.includes(plain(a.label)))) return [];
    const a = e.aliases.find((a) => a.note && a.script !== "Deva");
    return a ? [{ label: e.label, alias: a.label, note: a.note!, lang: a.lang }] : [];
  });
}
