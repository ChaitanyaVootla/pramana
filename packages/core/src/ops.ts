import { z } from "zod";
import { PageSpec } from "./pagespec";
import { Blocks } from "./blocks";
import { DateInput } from "./dates";
import { ExtentCertainty, MultiPolygonGeometry } from "./extents";
import { EntityRef, Ref, RefName, Slug } from "./ids";
import { MediaEditorialFields, MediaFileFields, MediaKind, MediaRepository } from "./media";
import { PagePatchFields } from "./pagepatch";
import {
  Alias,
  CslItem,
  Discovery,
  GeoInfo,
  LearningPrompt,
  License,
  Locator,
  OriginalText,
  SourceIdentifiers,
} from "./records";
import { EntitySpanInputs } from "./spans";
import {
  Assessment,
  ClaimKind,
  ClaimRelationType,
  EntityKind,
  EntityLinkType,
  Lens,
  PageKind,
  PageStatus,
  SourceKind,
  SourceTier,
  Stance,
  Theme,
} from "./vocab";

/**
 * Every content change is a changeset: a list of typed operations proposed by
 * an actor, reviewed by a human, then applied atomically. Operations can create
 * objects with a `ref` name and refer to them later as "@name", in id fields and
 * in Markdown links (`claim:@kalinga-date`).
 */

/** Pages may also be referenced by slug (entities too: see EntityRef). */
export const PageRef = z.union([Ref, Slug]);

const ref = RefName.optional();

const EntityFields = {
  slug: Slug.optional(),
  kind: EntityKind,
  label: z.string().min(1).max(300),
  aliases: z.array(Alias).max(50).optional(),
  description: z.string().max(2000).optional(),
  /** The primary span. If omitted and `spans` are given, it is taken from them (see primarySpan). */
  when: DateInput.optional(),
  /** Labelled spans: life, reign, floruit, existence, construction, activity. */
  spans: EntitySpanInputs.optional(),
  geo: GeoInfo.optional(),
  wikidataId: z
    .string()
    .regex(/^Q\d+$/)
    .optional(),
  externalIds: z.record(z.string(), z.string()).optional(),
};

const SourceFields = {
  kind: SourceKind,
  tier: SourceTier,
  csl: CslItem,
  identifiers: SourceIdentifiers.optional(),
  license: License.optional(),
  /** This source is an edition/translation/version of another (FRBR-style). */
  derivedFrom: Ref.optional(),
  /** When the work itself was composed (e.g. the Arthashastra), as opposed to `csl.issued`. */
  composed: DateInput.optional(),
  lenses: z.array(Lens).max(10).optional(),
  note: z.string().max(4000).optional(),
};

const ClaimEntity = z.object({
  entity: EntityRef,
  /**
   * subject: what the claim is about; place: where; participant: took part in it;
   * author: wrote or spoke about it (a witness or commentator, not an actor);
   * mention: named in passing.
   */
  role: z.enum(["subject", "place", "participant", "author", "mention"]).default("subject"),
});

const ClaimFields = {
  /** One proposition, stated plainly and neutrally. */
  text: z.string().min(3).max(2000),
  kind: ClaimKind,
  assessment: Assessment.optional(),
  assessmentNote: z.string().max(4000).optional(),
  when: DateInput.optional(),
  themes: z.array(Theme).max(6).optional(),
  lenses: z.array(Lens).max(6).optional(),
  entities: z.array(ClaimEntity).max(30).optional(),
  foundVia: z.array(Discovery).max(10).optional(),
  learning: LearningPrompt.optional(),
};

export const CreateEntityOp = z.object({ op: z.literal("create_entity"), ref, ...EntityFields });
export const UpdateEntityOp = z.object({
  op: z.literal("update_entity"),
  entity: EntityRef,
  /** Version of the object this edit was made against; set at proposal time. Stale edits fail. */
  baseVersion: z.number().int().positive().optional(),
  set: z.object(EntityFields).partial(),
});
export const LinkEntitiesOp = z.object({
  op: z.literal("link_entities"),
  ref,
  from: EntityRef,
  to: EntityRef,
  type: EntityLinkType,
  when: DateInput.optional(),
  note: z.string().max(2000).optional(),
});

export const CreateSourceOp = z.object({ op: z.literal("create_source"), ref, ...SourceFields });
export const UpdateSourceOp = z.object({
  op: z.literal("update_source"),
  source: Ref,
  /** Version of the object this edit was made against; set at proposal time. Stale edits fail. */
  baseVersion: z.number().int().positive().optional(),
  set: z.object(SourceFields).partial(),
});

export const CreateExcerptOp = z
  .object({
    op: z.literal("create_excerpt"),
    ref,
    source: Ref,
    /** Snapshot (captured text) to verify the quote against. */
    snapshotId: z.uuid().optional(),
    /** Exact words from the source. Keep it short for copyrighted works. */
    quote: z.string().min(1).max(3000).optional(),
    locator: Locator.optional(),
    original: OriginalText.optional(),
    note: z.string().max(2000).optional(),
  })
  .refine((e) => e.quote !== undefined || e.locator !== undefined, {
    message: "an excerpt needs a quote, a locator, or both",
  });

export const CreateClaimOp = z.object({ op: z.literal("create_claim"), ref, ...ClaimFields });
export const UpdateClaimOp = z.object({
  op: z.literal("update_claim"),
  claim: Ref,
  /** Version of the object this edit was made against; set at proposal time. Stale edits fail. */
  baseVersion: z.number().int().positive().optional(),
  /** `assessmentNote: null` removes the note. */
  set: z
    .object(ClaimFields)
    .partial()
    .extend({ assessmentNote: z.string().max(4000).nullable().optional() }),
});

export const CiteOp = z.object({
  op: z.literal("cite"),
  ref,
  claim: Ref,
  excerpt: Ref,
  stance: Stance,
  note: z.string().max(2000).optional(),
});
export const UnciteOp = z.object({ op: z.literal("uncite"), citation: Ref });
/**
 * Removes an excerpt nothing uses: no citation, no page block or excerpt:
 * link, and no pending changeset. The audit event keeps the whole row.
 */
export const DeleteExcerptOp = z.object({
  op: z.literal("delete_excerpt"),
  excerpt: Ref,
  /** Why it goes, shown to the reviewer: "an exact copy of excerpt …". */
  reason: z.string().max(500).optional(),
});

export const RelateClaimsOp = z.object({
  op: z.literal("relate_claims"),
  ref,
  from: Ref,
  to: Ref,
  type: ClaimRelationType,
  note: z.string().max(2000).optional(),
});

const PageFields = {
  slug: Slug,
  title: z.string().min(1).max(300),
  kind: PageKind,
  entity: EntityRef.optional(),
  summary: z.string().max(2000).optional(),
  blocks: Blocks,
  status: PageStatus.optional(),
  /** Ordering among sibling pages (eras on the overview). */
  position: z.number().optional(),
  /** What the page shows and where (see pagespec.ts). */
  spec: PageSpec.optional(),
};

export const CreatePageOp = z.object({ op: z.literal("create_page"), ref, ...PageFields });
export const UpdatePageOp = z.object({
  op: z.literal("update_page"),
  page: PageRef,
  /** Version of the object this edit was made against; set at proposal time. Stale edits fail. */
  baseVersion: z.number().int().positive().optional(),
  set: z.object(PageFields).partial(),
});
/**
 * A block-level page edit: each block it removes or replaces is guarded by a
 * fingerprint of that block (blockFingerprint), and each spec key by its own,
 * so it conflicts only with edits to the same blocks or keys, not with any
 * other change to the page. Applied in order: spec, remove, replace, insert, move.
 */
export const PatchPageOp = z.object({
  op: z.literal("patch_page"),
  page: PageRef,
  ...PagePatchFields,
});

const ExtentFields = {
  /** The polity (or other entity) this territory belongs to; omit for unlinked extents. */
  entity: EntityRef.optional(),
  /** Name as the dataset gives it, e.g. "Maurya Empire". */
  name: z.string().min(1).max(300),
  /** First year the extent applies, astronomical (-317 = 318 BCE), inclusive. */
  fromYear: z.number().int().min(-10000).max(3000),
  /** Last year the extent applies, astronomical, inclusive. */
  toYear: z.number().int().min(-10000).max(3000),
  geometry: MultiPolygonGeometry,
  /** Area in km², as the dataset states it. */
  areaKm2: z.number().nonnegative().optional(),
  /** Dataset and release, e.g. "cliopatria-v0.2.1". */
  dataset: z.string().min(1).max(100),
  /** The dataset's own identifiers for the row (SeshatID, Wikidata QID). */
  datasetRef: z.string().max(300).optional(),
  certainty: ExtentCertainty.optional(),
  /** SPDX licence identifier of the geometry, e.g. "CC-BY-4.0". */
  license: z.string().min(1).max(64),
  /** Attribution text required by the licence, including any changes made. */
  attribution: z.string().min(1).max(1000),
  /** The dataset as a source record. */
  source: Ref.optional(),
  note: z.string().max(2000).optional(),
};

export const CreateExtentOp = z
  .object({ op: z.literal("create_extent"), ref, ...ExtentFields })
  .refine((e) => e.fromYear <= e.toYear, { message: "fromYear must not be after toYear" });
export const UpdateExtentOp = z.object({
  op: z.literal("update_extent"),
  extent: Ref,
  /** Version of the object this edit was made against; set at proposal time. Stale edits fail. */
  baseVersion: z.number().int().positive().optional(),
  set: z.object({ ...ExtentFields, entity: EntityRef.nullable() }).partial(),
});

/**
 * A media record: a real file in an open repository. The file fields must
 * match the repository's API response stored in `snapshotId`; apply checks
 * them against it, so a licence or author cannot be typed in by hand.
 */
export const CreateMediaOp = z.object({
  op: z.literal("create_media"),
  ref,
  kind: MediaKind.default("image"),
  repository: MediaRepository,
  /** "File:Lion capital of Ashoka, Sarnath.jpg". */
  fileTitle: z
    .string()
    .regex(/^File:.+/, 'a Commons file title, "File:…"')
    .max(500),
  ...MediaFileFields,
  ...MediaEditorialFields,
});
export const UpdateMediaOp = z.object({
  op: z.literal("update_media"),
  media: Ref,
  /** Version of the object this edit was made against; set at proposal time. Stale edits fail. */
  baseVersion: z.number().int().positive().optional(),
  set: z.object({ ...MediaFileFields, ...MediaEditorialFields }).partial(),
});

export const ChangeOp = z.discriminatedUnion("op", [
  CreateEntityOp,
  UpdateEntityOp,
  LinkEntitiesOp,
  CreateSourceOp,
  UpdateSourceOp,
  CreateExcerptOp,
  CreateClaimOp,
  UpdateClaimOp,
  CiteOp,
  UnciteOp,
  DeleteExcerptOp,
  RelateClaimsOp,
  CreatePageOp,
  UpdatePageOp,
  PatchPageOp,
  CreateExtentOp,
  UpdateExtentOp,
  CreateMediaOp,
  UpdateMediaOp,
]);
export type ChangeOp = z.infer<typeof ChangeOp>;
export type ChangeOpInput = z.input<typeof ChangeOp>;

export const ChangesetInput = z.object({
  title: z.string().min(3).max(300),
  /** Why this change: what was read, what is being corrected. Shown to the reviewer. */
  rationale: z.string().max(10000).default(""),
  /** Pending changesets this one builds on (their refs become usable here). */
  dependsOn: z.array(z.uuid()).max(20).default([]),
  ops: z.array(ChangeOp).min(1).max(1000),
});
export type ChangesetInput = z.infer<typeof ChangesetInput>;
export type ChangesetInputRaw = z.input<typeof ChangesetInput>;

/** Ops that create objects, and the kind of object their ref names. */
export function createdKind(
  op: ChangeOp,
):
  | "entity"
  | "entity_link"
  | "source"
  | "excerpt"
  | "claim"
  | "citation"
  | "claim_relation"
  | "page"
  | "extent"
  | "media"
  | null {
  switch (op.op) {
    case "create_entity":
      return "entity";
    case "link_entities":
      return "entity_link";
    case "create_source":
      return "source";
    case "create_excerpt":
      return "excerpt";
    case "create_claim":
      return "claim";
    case "cite":
      return "citation";
    case "relate_claims":
      return "claim_relation";
    case "create_page":
      return "page";
    case "create_extent":
      return "extent";
    case "create_media":
      return "media";
    default:
      return null;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Replaces "@name" references with ids from `refs`, in every string of the op
 * tree: whole-string references in id fields, and `scheme:@name` inside
 * Markdown. Throws on unknown names, listing them.
 */
export function resolveRefs<T>(value: T, refs: ReadonlyMap<string, string>): T {
  const missing = new Set<string>();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      if (/^@[a-z][a-z0-9_-]*$/i.test(v)) {
        const id = refs.get(v.slice(1));
        if (!id) missing.add(v);
        return id ?? v;
      }
      return v.replace(
        /\b(claim|entity|source|excerpt|page):@([a-z][a-z0-9_-]*)/gi,
        (whole, scheme: string, name: string) => {
          const id = refs.get(name);
          if (!id) {
            missing.add(`@${name}`);
            return whole;
          }
          return `${scheme}:${id}`;
        },
      );
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    }
    return v;
  };
  const out = walk(value) as T;
  if (missing.size > 0) {
    throw new Error(
      `unknown ref(s): ${[...missing].join(", ")} — declare them with \`ref\` on a create op`,
    );
  }
  return out;
}
