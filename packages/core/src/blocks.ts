import { z } from "zod";
import { DateInput } from "./dates";
import { EntityRef, Ref } from "./ids";
import { Theme } from "./vocab";

/**
 * Visualisations are DATA, not code: an agent emits a spec, the app validates,
 * stores and renders it. That keeps AI-produced visuals safe, re-renderable and
 * editable. Vega-Lite covers general charts; the rest are platform-native.
 */
export const VizSpec = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("vega-lite"),
    /** A Vega-Lite v6 JSON spec with inline data (`data.values`); remote data URLs are not loaded. */
    spec: z.record(z.string(), z.unknown()),
  }),
  z.object({
    kind: z.literal("timeline"),
    entityIds: z.array(EntityRef).max(200).optional(),
    claimIds: z.array(Ref).max(200).optional(),
    /** Show everything linked to this entity (e.g. all events part_of an era). */
    linkedTo: EntityRef.optional(),
    /** Astronomical years bounding the initial view. */
    from: z.number().optional(),
    to: z.number().optional(),
  }),
  z.object({
    kind: z.literal("map"),
    entityIds: z.array(EntityRef).max(500).optional(),
    linkedTo: EntityRef.optional(),
    center: z.tuple([z.number(), z.number()]).optional(),
    zoom: z.number().min(0).max(18).optional(),
  }),
  z.object({
    kind: z.literal("table"),
    columns: z.array(z.string().max(200)).min(1).max(12),
    rows: z.array(z.array(z.string().max(2000))).max(200),
  }),
  z.object({
    kind: z.literal("lineage"),
    claimId: Ref,
  }),
]);
export type VizSpec = z.infer<typeof VizSpec>;

export const BlockId = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{0,63}$/i, "block ids: letters, digits, '_' or '-'");

const base = {
  id: BlockId,
  /** Which theme tab the block belongs to. Omitted = always shown. */
  theme: Theme.optional(),
};

/**
 * The answer to a "Guess first" question. The value must be the one the
 * block's claim states; the guess is graded against it, never against
 * anything the reader cannot open.
 */
export const GuessAnswer = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("choice"),
    options: z.array(z.string().min(1).max(200)).min(2).max(5),
    /** Index of the right option. */
    correct: z.number().int().min(0).max(4),
  }),
  z.object({
    kind: z.literal("number"),
    value: z.number(),
    /** Shown after the number, e.g. "people". */
    unit: z.string().max(40).optional(),
    /** A guess within this fraction of the value counts as close. Default 0.25 (25%). */
    tolerance: z.number().min(0).max(1).default(0.25),
  }),
  z.object({
    kind: z.literal("year"),
    year: z.number().int().min(1).max(10000),
    era: z.enum(["BCE", "CE"]),
    /** Years either side that count as close. Default 10. */
    tolerance: z.number().int().min(0).max(1000).default(10),
  }),
]);
export type GuessAnswer = z.infer<typeof GuessAnswer>;

/** One question in an end-of-chapter retrieval check. */
export const CheckItem = z.discriminatedUnion("kind", [
  /** Free recall, self-graded against the claim (its learning answer, else its text). */
  z.object({
    kind: z.literal("recall"),
    id: BlockId,
    claimId: Ref,
    /** Default: the claim's learning prompt. */
    prompt: z.string().min(1).max(300).optional(),
  }),
  /**
   * Put three to five dated claims in order. Graded against the claims' stored
   * dates. Labels name each event without its date (the claim text often gives it away).
   */
  z.object({
    kind: z.literal("order"),
    id: BlockId,
    prompt: z.string().min(1).max(300).optional(),
    items: z
      .array(z.object({ claimId: Ref, label: z.string().min(1).max(80) }))
      .min(3)
      .max(5),
  }),
  /** "Tap where X was": graded by distance to the entity's stored coordinates. */
  z.object({
    kind: z.literal("place"),
    id: BlockId,
    entity: EntityRef,
    prompt: z.string().min(1).max(300).optional(),
    /** A tap this close (or inside the entity's outline) is right. Default 150 km. */
    toleranceKm: z.number().min(10).max(1500).default(150),
  }),
]);
export type CheckItem = z.infer<typeof CheckItem>;

/**
 * Prose is Markdown. Inline references use link syntax with platform schemes:
 * `[Kalinga](entity:kalinga-war)`, `[conquered in 261 BCE](claim:<uuid>)`.
 */
export const Block = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("heading"),
    text: z.string().min(1).max(300),
    level: z.number().int().min(2).max(4).default(2),
  }),
  z.object({ ...base, type: z.literal("prose"), markdown: z.string().min(1).max(20000) }),
  z.object({
    ...base,
    type: z.literal("key_facts"),
    title: z.string().max(300).optional(),
    claimIds: z.array(Ref).min(1).max(50),
  }),
  z.object({
    ...base,
    type: z.literal("claims"),
    title: z.string().max(300).optional(),
    claimIds: z.array(Ref).min(1).max(100),
  }),
  z.object({
    ...base,
    type: z.literal("misconception"),
    /** The popular belief (a claim of kind "misconception"). */
    claimId: Ref,
    /** Claims that correct or nuance it. */
    correctionIds: z.array(Ref).max(20).default([]),
  }),
  z.object({
    ...base,
    type: z.literal("debate"),
    question: z.string().min(1).max(500),
    positions: z
      .array(z.object({ label: z.string().min(1).max(200), claimIds: z.array(Ref).min(1).max(30) }))
      .min(2)
      .max(8),
    note: z.string().max(4000).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("quote"),
    excerptId: Ref,
    caption: z.string().max(1000).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("viz"),
    viz: VizSpec,
    caption: z.string().max(1000).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("entities"),
    title: z.string().max(300).optional(),
    entityIds: z.array(EntityRef).min(1).max(60),
  }),
  /**
   * A chapter of a page: a heading plus what the reader needs to orient
   * themselves (when, where, who, words to know). Chapters drive the page
   * outline, the table of contents and the context rail.
   */
  z.object({
    ...base,
    type: z.literal("chapter"),
    title: z.string().min(1).max(200),
    /** One or two plain sentences: what this chapter will tell you. */
    promise: z.string().max(400).optional(),
    /** When it happens. Omit for chapters about the whole period. */
    when: DateInput.optional(),
    /** "later" marks chapters about how we know (decipherment, scholarship). */
    phase: z.enum(["during", "later"]).default("during"),
    places: z.array(EntityRef).max(20).default([]),
    people: z.array(EntityRef).max(20).default([]),
    /** Glossary entities (kind "term") explained in this chapter. */
    terms: z.array(EntityRef).max(20).default([]),
    /**
     * The one-minute version of the part, read before (or instead of) the full
     * text: what happened, in one or two sentences that link the claims they
     * rest on, and how we know it (which sources, and how far to trust them).
     * The chapter's `when` is shown with it.
     */
    brief: z
      .object({
        happened: z
          .string()
          .min(10)
          .max(600)
          .refine((md) => extractLinks(md).some((l) => l.scheme === "claim"), {
            message: "link the claims it rests on: [words](claim:<id>)",
          }),
        howWeKnow: z.string().min(10).max(600),
      })
      .optional(),
  }),
  /** Anchors for a first-time reader: names they may have heard, each with one line and a jump into the page. */
  z.object({
    ...base,
    type: z.literal("already_know"),
    title: z.string().max(200).optional(),
    items: z
      .array(
        z.object({
          entity: EntityRef,
          /** One line, Markdown allowed (claim links welcome). */
          text: z.string().min(1).max(400),
          /** Block id to jump to. */
          target: BlockId.optional(),
          targetLabel: z.string().max(60).optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
  /** Contemporaries elsewhere, grounded in claims (e.g. the kings named in Rock Edict XIII). */
  z.object({
    ...base,
    type: z.literal("meanwhile"),
    title: z.string().max(200).optional(),
    items: z
      .array(
        z.object({
          region: z.string().min(1).max(80),
          label: z.string().min(1).max(200),
          entity: EntityRef.optional(),
          claimIds: z.array(Ref).max(10).default([]),
        }),
      )
      .min(1)
      .max(12),
    note: z.string().max(1000).optional(),
  }),
  /** One image with a caption. `media` is a media record id (or @ref). */
  z.object({
    ...base,
    type: z.literal("figure"),
    media: Ref,
    /** Markdown: what it is, where it is now, why it matters. Claim and entity links welcome. */
    caption: z.string().min(1).max(1500),
    /** "wide" breaks out of the reading measure on large screens. */
    size: z.enum(["inline", "wide"]).default("inline"),
  }),
  /** A strip of related images (two to eight), each with an optional caption. */
  z.object({
    ...base,
    type: z.literal("gallery"),
    title: z.string().max(200).optional(),
    items: z
      .array(z.object({ media: Ref, caption: z.string().max(800).optional() }))
      .min(2)
      .max(8),
  }),
  z.object({
    ...base,
    type: z.literal("callout"),
    tone: z.enum(["note", "caution", "method"]).default("note"),
    markdown: z.string().min(1).max(5000),
  }),
  /**
   * "Guess first": one question at the start of a chapter, answered before
   * reading (pretesting). The answer, with the claim that settles it, is shown
   * after `revealAfter`, else in the chapter's retrieval check, else at the
   * chapter's end. No score is shown.
   */
  z
    .object({
      ...base,
      type: z.literal("guess"),
      question: z.string().min(1).max(300),
      answer: GuessAnswer,
      /** The claim that answers the question. */
      claimId: Ref,
      /** A later block in the same chapter after which the answer is shown. */
      revealAfter: BlockId.optional(),
      /** One line shown with the answer (Markdown, claim links welcome). */
      note: z.string().min(1).max(600).optional(),
    })
    .superRefine((b, ctx) => {
      if (b.answer.kind === "choice" && b.answer.correct >= b.answer.options.length)
        ctx.addIssue({
          code: "custom",
          path: ["answer", "correct"],
          message: "no option at that index",
        });
    }),
  /** An end-of-chapter retrieval check: two or three short questions from the chapter's claims. */
  z
    .object({
      ...base,
      type: z.literal("check"),
      title: z.string().max(200).optional(),
      items: z.array(CheckItem).min(1).max(4),
    })
    .superRefine((b, ctx) => {
      const seen = new Set<string>();
      b.items.forEach((item, i) => {
        if (seen.has(item.id))
          ctx.addIssue({
            code: "custom",
            path: ["items", i, "id"],
            message: `duplicate item id "${item.id}"`,
          });
        seen.add(item.id);
        if (
          item.kind === "order" &&
          new Set(item.items.map((x) => x.claimId)).size !== item.items.length
        )
          ctx.addIssue({ code: "custom", path: ["items", i, "items"], message: "each claim once" });
      });
    }),
]);
export type Block = z.infer<typeof Block>;
export type BlockInput = z.input<typeof Block>;

export const Blocks = z
  .array(Block)
  .max(400)
  .superRefine((blocks, ctx) => {
    const seen = new Set<string>();
    blocks.forEach((b, i) => {
      if (seen.has(b.id))
        ctx.addIssue({ code: "custom", path: [i, "id"], message: `duplicate block id "${b.id}"` });
      seen.add(b.id);
    });
  });

/** Platform link schemes usable in Markdown. */
export const LINK_SCHEMES = ["claim", "entity", "source", "excerpt", "page"] as const;
export type LinkScheme = (typeof LINK_SCHEMES)[number];

const LINK_RE = /\]\((claim|entity|source|excerpt|page):([^)\s]+)\)/g;

export function extractLinks(markdown: string): { scheme: LinkScheme; target: string }[] {
  return [...markdown.matchAll(LINK_RE)].map((m) => ({
    scheme: m[1] as LinkScheme,
    target: m[2]!,
  }));
}

const BARE_REF_RE =
  /\]\((@?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|@[a-z][\w-]*)\)/gi;

/**
 * Links whose target is a bare id or @ref, i.e. a platform link that lost its
 * scheme (`[x](uuid)` instead of `[x](claim:uuid)`). They render as broken
 * relative URLs, so writes refuse them.
 */
export function bareRefLinks(markdown: string): string[] {
  return [...markdown.matchAll(BARE_REF_RE)].map((m) => m[1]!);
}

/** The Markdown strings in a block (prose, callouts, one-liners, captions). */
export function markdownInBlock(block: Block): string[] {
  switch (block.type) {
    case "prose":
    case "callout":
      return [block.markdown];
    case "already_know":
      return block.items.map((i) => i.text);
    case "figure":
      return [block.caption];
    case "gallery":
      return block.items.flatMap((i) => (i.caption ? [i.caption] : []));
    case "guess":
      return block.note ? [block.note] : [];
    case "chapter":
      return block.brief ? [block.brief.happened, block.brief.howWeKnow] : [];
    default:
      return [];
  }
}

/** Claims a check item is graded against. */
export function claimIdsInCheckItem(item: CheckItem): string[] {
  if (item.kind === "recall") return [item.claimId];
  if (item.kind === "order") return item.items.map((x) => x.claimId);
  return [];
}

/** Media record ids a block shows. */
export function mediaRefsInBlock(block: Block): string[] {
  switch (block.type) {
    case "figure":
      return [block.media];
    case "gallery":
      return block.items.map((i) => i.media);
    default:
      return [];
  }
}

/** Every claim id a block refers to (for loading and for integrity checks). */
export function claimIdsInBlock(block: Block): string[] {
  switch (block.type) {
    case "key_facts":
    case "claims":
      return block.claimIds;
    case "misconception":
      return [block.claimId, ...block.correctionIds];
    case "debate":
      return block.positions.flatMap((p) => p.claimIds);
    case "prose":
    case "callout":
      return extractLinks(block.markdown)
        .filter((l) => l.scheme === "claim")
        .map((l) => l.target);
    case "already_know":
    case "figure":
    case "gallery":
    case "chapter":
      return markdownInBlock(block).flatMap((md) =>
        extractLinks(md)
          .filter((l) => l.scheme === "claim")
          .map((l) => l.target),
      );
    case "meanwhile":
      return block.items.flatMap((i) => i.claimIds);
    case "guess":
      return [
        block.claimId,
        ...markdownInBlock(block).flatMap((md) =>
          extractLinks(md)
            .filter((l) => l.scheme === "claim")
            .map((l) => l.target),
        ),
      ];
    case "check":
      return block.items.flatMap(claimIdsInCheckItem);
    case "viz":
      if (block.viz.kind === "timeline") return block.viz.claimIds ?? [];
      if (block.viz.kind === "lineage") return [block.viz.claimId];
      return [];
    default:
      return [];
  }
}

/** Entity references a block makes outside Markdown links (for loading and integrity checks). */
export function entityRefsInBlock(block: Block): string[] {
  switch (block.type) {
    case "entities":
      return block.entityIds;
    case "chapter":
      return [...block.places, ...block.people, ...block.terms];
    case "already_know":
      return block.items.map((i) => i.entity);
    case "meanwhile":
      return block.items.flatMap((i) => (i.entity ? [i.entity] : []));
    case "check":
      return block.items.flatMap((i) => (i.kind === "place" ? [i.entity] : []));
    case "viz":
      if (block.viz.kind === "timeline" || block.viz.kind === "map") {
        return [
          ...(block.viz.entityIds ?? []),
          ...(block.viz.linkedTo ? [block.viz.linkedTo] : []),
        ];
      }
      return [];
    default:
      return [];
  }
}

/* ------------------------------------------------------------------ review diffs */

/** Longest increasing subsequence of `xs` (indices into xs): the most blocks that can stay in place when a list is reordered. */
export function longestIncreasing(xs: number[]): Set<number> {
  const tails: number[] = [];
  const prev: number[] = new Array(xs.length).fill(-1);
  for (let i = 0; i < xs.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[tails[mid]!]! < xs[i]!) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[i] = tails[lo - 1]!;
    tails[lo] = i;
  }
  const keep = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1]! : -1; i >= 0; i = prev[i]!) keep.add(i);
  return keep;
}

export type BlockChange =
  | { kind: "added"; block: Block; index: number }
  | { kind: "removed"; block: Block; index: number }
  | { kind: "changed"; before: Block; after: Block; index: number }
  | { kind: "moved"; block: Block; from: number; to: number };

/**
 * What an edit does to a page's blocks, matched by block id: blocks added,
 * removed, changed (any field), and moved (same content, new position among
 * the blocks both versions share). Unchanged blocks are left out.
 */
export function diffBlocks(before: Block[], after: Block[]): BlockChange[] {
  const oldById = new Map(before.map((b, i) => [b.id, { b, i }]));
  const newIds = new Set(after.map((b) => b.id));
  const out: BlockChange[] = [];
  // Blocks keeping their relative order stay; only the others count as moved (one block moved to the end moves one block).
  const shared = after.filter((b) => oldById.has(b.id));
  const stay = new Set([...longestIncreasing(shared.map((b) => oldById.get(b.id)!.i))].map((k) => shared[k]!.id));
  after.forEach((b, i) => {
    const old = oldById.get(b.id);
    if (!old) return out.push({ kind: "added", block: b, index: i });
    if (JSON.stringify(old.b) !== JSON.stringify(b))
      return out.push({ kind: "changed", before: old.b, after: b, index: i });
    if (!stay.has(b.id))
      out.push({ kind: "moved", block: b, from: old.i, to: i });
  });
  before.forEach((b, i) => {
    if (!newIds.has(b.id)) out.push({ kind: "removed", block: b, index: i });
  });
  return out.sort((a, b) => ("index" in a ? a.index : a.to) - ("index" in b ? b.index : b.to));
}

export type WordDiff = { kind: "same" | "added" | "removed"; text: string }[];

/** A word-level diff (longest common subsequence over words and spaces), for showing prose before and after. */
export function diffWords(before: string, after: string): WordDiff {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  // Above this size the table is too large to be worth it: show the two versions whole.
  if (a.length * b.length > 4_000_000)
    return [
      { kind: "removed", text: before },
      { kind: "added", text: after },
    ];
  const dp: Uint32Array[] = Array.from(
    { length: a.length + 1 },
    () => new Uint32Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: WordDiff = [];
  const push = (kind: WordDiff[number]["kind"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push("removed", a[i++]!);
    else push("added", b[j++]!);
  }
  while (i < a.length) push("removed", a[i++]!);
  while (j < b.length) push("added", b[j++]!);
  return out;
}
