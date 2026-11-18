import { z } from "zod";
import { DateInput, FuzzyDate } from "./dates";
import { LicenseStatus } from "./vocab";

// ---------------------------------------------------------------------------
// Names and languages
// ---------------------------------------------------------------------------

/**
 * An alternative name. `lang` is a BCP 47 tag ("sa", "hi", "sa-Latn" for
 * IAST-romanised Sanskrit, "fa" for Persian); `script` an ISO 15924 code
 * ("Deva", "Arab", "Brah" for Brahmi). `note` records who uses the name. Names
 * can carry a stance (Indus vs Sindhu-Saraswati), so that is stated, not hidden.
 */
export const Alias = z.object({
  label: z.string().min(1).max(300),
  lang: z.string().max(35).optional(),
  script: z
    .string()
    .regex(/^[A-Z][a-z]{3}$/, "ISO 15924 script code, e.g. Deva")
    .optional(),
  note: z.string().max(1000).optional(),
  /**
   * When the name was in use, if a source dates it (Wikidata P1448 with start
   * and end qualifiers: Bombay, then Mumbai from 1995). Maps name a place by
   * the year shown when this is set.
   */
  when: FuzzyDate.optional(),
});
export type Alias = z.infer<typeof Alias>;

// ---------------------------------------------------------------------------
// Geography (GeoJSON, RFC 7946: [longitude, latitude])
// ---------------------------------------------------------------------------

const Position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const LinearRing = z.array(Position).min(4);

export const Geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: Position }),
  z.object({ type: z.literal("MultiPoint"), coordinates: z.array(Position).min(1) }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(Position).min(2) }),
  z.object({ type: z.literal("MultiLineString"), coordinates: z.array(z.array(Position).min(2)) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(LinearRing).min(1) }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(LinearRing).min(1)).min(1),
  }),
]);
export type Geometry = z.infer<typeof Geometry>;

export const GeoInfo = z.object({
  geometry: Geometry,
  /** exact: surveyed; approximate: roughly right; conjectural: a scholarly reconstruction. */
  certainty: z.enum(["exact", "approximate", "conjectural"]),
  note: z.string().max(1000).optional(),
});
export type GeoInfo = z.infer<typeof GeoInfo>;

// ---------------------------------------------------------------------------
// Bibliographic records: CSL-JSON (Citation Style Language), a subset with
// pass-through for other CSL variables.
// ---------------------------------------------------------------------------

export const CslName = z.looseObject({
  family: z.string().optional(),
  given: z.string().optional(),
  literal: z.string().optional(),
  suffix: z.string().optional(),
  "non-dropping-particle": z.string().optional(),
  "dropping-particle": z.string().optional(),
});
export type CslName = z.infer<typeof CslName>;

export const CslDate = z.looseObject({
  "date-parts": z
    .array(
      z
        .array(z.union([z.number().int(), z.string()]))
        .min(1)
        .max(3),
    )
    .min(1)
    .max(2)
    .optional(),
  literal: z.string().optional(),
  raw: z.string().optional(),
  circa: z.union([z.boolean(), z.string(), z.number()]).optional(),
});
export type CslDate = z.infer<typeof CslDate>;

export const CslType = z.enum([
  "book",
  "chapter",
  "article",
  "article-journal",
  "article-magazine",
  "article-newspaper",
  "classic",
  "dataset",
  "document",
  "entry-encyclopedia",
  "entry-dictionary",
  "graphic",
  "manuscript",
  "map",
  "report",
  "thesis",
  "webpage",
  "post",
  "speech",
  "collection",
]);

export const CslItem = z.looseObject({
  type: CslType,
  title: z.string().min(1).max(1000),
  "title-short": z.string().optional(),
  "container-title": z.string().optional(),
  "collection-title": z.string().optional(),
  "collection-number": z.union([z.string(), z.number()]).optional(),
  author: z.array(CslName).optional(),
  editor: z.array(CslName).optional(),
  translator: z.array(CslName).optional(),
  issued: CslDate.optional(),
  "original-date": CslDate.optional(),
  "original-title": z.string().optional(),
  accessed: CslDate.optional(),
  publisher: z.string().optional(),
  "publisher-place": z.string().optional(),
  edition: z.union([z.string(), z.number()]).optional(),
  volume: z.union([z.string(), z.number()]).optional(),
  issue: z.union([z.string(), z.number()]).optional(),
  page: z.string().optional(),
  "number-of-pages": z.union([z.string(), z.number()]).optional(),
  DOI: z.string().optional(),
  ISBN: z.string().optional(),
  ISSN: z.string().optional(),
  URL: z.string().optional(),
  language: z.string().optional(),
  note: z.string().optional(),
});
export type CslItem = z.infer<typeof CslItem>;

/** Persistent identifiers, so the same source can be matched across systems. */
export const SourceIdentifiers = z.object({
  doi: z
    .string()
    .regex(/^10\.\d{4,9}\/\S+$/, "DOI without the https://doi.org/ prefix")
    .optional(),
  isbn: z.array(z.string().regex(/^[0-9Xx-]{10,17}$/)).optional(),
  oclc: z.string().optional(),
  issn: z.string().optional(),
  /** Internet Archive item identifier (archive.org/details/<id>). */
  ia: z.string().optional(),
  /** Open Library edition or work id (OL123M / OL123W). */
  olid: z.string().optional(),
  /** Wikidata QID of the work or edition. */
  wikidata: z
    .string()
    .regex(/^Q\d+$/)
    .optional(),
  hathitrust: z.string().optional(),
  url: z.url().optional(),
  /** For wiki_article sources: the exact revision used. */
  wikipedia: z
    .object({ lang: z.string(), title: z.string(), revisionId: z.number().int() })
    .optional(),
});
export type SourceIdentifiers = z.infer<typeof SourceIdentifiers>;

export const License = z.object({
  status: LicenseStatus,
  /** SPDX licence identifier when known: "CC-BY-SA-4.0", "CC0-1.0", "CC-BY-4.0". */
  spdx: z.string().max(64).optional(),
  /**
   * Basis for the status, e.g. "published 1925, translator d. 1927: public
   * domain in India (life+60) and the US (published before 1931)".
   */
  note: z.string().max(1000).optional(),
});
export type License = z.infer<typeof License>;

/**
 * Where in a source an excerpt is. Use the scheme the source uses: pages for
 * books, verse numbers for texts (RV 10.90.12), edict and line for inscriptions.
 */
export const Locator = z
  .object({
    volume: z.string().max(50).optional(),
    page: z.string().max(50).optional(),
    pageEnd: z.string().max(50).optional(),
    chapter: z.string().max(100).optional(),
    section: z.string().max(200).optional(),
    verse: z.string().max(100).optional(),
    line: z.string().max(50).optional(),
    folio: z.string().max(50).optional(),
    timestamp: z.string().max(50).optional(),
    /** Free-form fallback, e.g. "Rock Edict XIII (Shahbazgarhi version)". */
    label: z.string().max(300).optional(),
  })
  .refine((l) => Object.values(l).some((v) => v !== undefined && v !== ""), {
    message: "a locator needs at least one field",
  });
export type Locator = z.infer<typeof Locator>;

/** How something reached the platform: discovery provenance, distinct from evidence. */
export const Discovery = z.object({
  via: z.enum(["wikipedia", "wikidata", "internet_archive", "search", "book", "manual", "other"]),
  title: z.string().max(500).optional(),
  url: z.url().optional(),
  revisionId: z.number().int().optional(),
  retrievedAt: z.iso.datetime().optional(),
  note: z.string().max(1000).optional(),
});
export type Discovery = z.infer<typeof Discovery>;

export const ExcerptVerificationStatus = z.enum([
  "unchecked",
  "exact", // the quote occurs verbatim (after normalisation) in the stored snapshot
  "fuzzy", // a near match (OCR noise); see score
  "not_found",
  "no_snapshot", // nothing stored to check against
  "no_quote", // locator-only citation (e.g. a copyrighted book via Wikipedia)
  "human_attested", // a person checked the quote against the physical/source copy
]);
export type ExcerptVerificationStatus = z.infer<typeof ExcerptVerificationStatus>;

export const ExcerptVerification = z.object({
  status: ExcerptVerificationStatus,
  score: z.number().min(0).max(1).optional(),
  method: z.string().optional(),
  checkedAt: z.iso.datetime().optional(),
  checkedBy: z.uuid().optional(),
  note: z.string().max(1000).optional(),
});
export type ExcerptVerification = z.infer<typeof ExcerptVerification>;

export const SupportCheckStatus = z.enum([
  "unchecked",
  "ai_supports",
  "ai_partial",
  "ai_unsupported",
  "human_confirmed",
  "human_partial",
  "human_rejected",
]);
export type SupportCheckStatus = z.infer<typeof SupportCheckStatus>;

/**
 * What a citation's support check was made against: the claim text and the
 * quote (both hashed), the excerpt and the stance. If any of them changes,
 * the judgment is stale and no longer counts (see supportCheckState).
 */
export const SupportCheckBasis = z.object({
  /** sha256 (hex) of the claim text when judged. */
  claimTextSha256: z.string().regex(/^[0-9a-f]{64}$/),
  excerptId: z.uuid(),
  /** sha256 (hex) of the excerpt's quote when judged; null for a citation by location only. */
  quoteSha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  stance: z.string(),
});
export type SupportCheckBasis = z.infer<typeof SupportCheckBasis>;

export const SupportCheck = z.object({
  status: SupportCheckStatus,
  by: z.uuid().optional(),
  at: z.iso.datetime().optional(),
  note: z.string().max(2000).optional(),
  /** Absent on judgments recorded before bases were kept; those count as current. */
  basis: SupportCheckBasis.optional(),
});
export type SupportCheck = z.infer<typeof SupportCheck>;

/**
 * A judgment on a claim as a whole: do the cited excerpts, read together,
 * support it? For compound claims whose parts are cited to different
 * excerpts, where no single citation can carry the claim alone. `basis` is
 * what was judged; if the claim's text or its set of citations has changed
 * since, the judgment is stale and no longer counts (see jointSupportState).
 */
export const ClaimSupportCheck = z.object({
  status: SupportCheckStatus.exclude(["unchecked"]),
  by: z.uuid(),
  at: z.iso.datetime(),
  note: z.string().min(1).max(2000),
  /** The citations judged together (a subset of the claim's citations). */
  citationIds: z.array(z.uuid()).min(1),
  basis: z.object({
    /** sha256 (hex) of the claim text when judged. */
    textSha256: z.string().regex(/^[0-9a-f]{64}$/),
    /** All of the claim's citation ids when judged, sorted. */
    citationIds: z.array(z.uuid()),
  }),
});
export type ClaimSupportCheck = z.infer<typeof ClaimSupportCheck>;

/** Original-language text alongside a translation. */
export const OriginalText = z.object({
  text: z.string().min(1).max(5000),
  lang: z.string().max(35),
  note: z.string().max(1000).optional(),
});
export type OriginalText = z.infer<typeof OriginalText>;

export const LearningPrompt = z.object({
  /** A question whose answer is the claim, e.g. "In which regnal year was Kalinga conquered?" */
  prompt: z.string().min(1).max(500),
  answer: z.string().max(1000).optional(),
});
export type LearningPrompt = z.infer<typeof LearningPrompt>;

export { DateInput, FuzzyDate };
