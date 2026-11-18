import { z } from "zod";
import { dateBounds, DateInput, FuzzyDate, toFuzzyDate } from "./dates";
import type { EntityKind } from "./vocab";

/**
 * Labelled time spans. An entity's `when` is its PRIMARY span (the one used for
 * sorting and the default timeline); `spans` records the others with what they
 * mean: a ruler's reign and life, a polity's existence, a site's construction.
 * Each span can say where it came from (a Wikidata statement, a source).
 */

export const SpanRole = z.enum([
  "life", // birth to death
  "reign", // holding a position: king, emperor
  "floruit", // active period of a person known only from their activity
  "existence", // a polity, period, culture or institution existing
  "construction", // building or inscribing a site, monument or inscription
  "activity", // an event's course; use of a site
]);
export type SpanRole = z.infer<typeof SpanRole>;

const Qid = z.string().regex(/^Q\d+$/, "a Wikidata QID, e.g. Q8589");

export const SpanSource = z
  .object({
    /** The Wikidata statement the dates come from. */
    wikidata: z
      .object({
        qid: Qid,
        /** The property, e.g. "P39" (position held, with P580/P582 qualifiers) or "P569/P570". */
        property: z.string().regex(/^P\d+(\/P\d+)?$/, 'a property id, e.g. "P39" or "P569/P570"'),
        /** The statement's value, when the dates are qualifiers on it (the position held). */
        value: Qid.optional(),
      })
      .optional(),
    /** A source record on the platform. */
    sourceId: z.uuid().optional(),
  })
  .refine((s) => s.wikidata !== undefined || s.sourceId !== undefined, {
    message: "a span source needs wikidata or sourceId",
  });
export type SpanSource = z.infer<typeof SpanSource>;

/** A stored span: the date is canonical EDTF. */
export const EntitySpan = z.object({
  role: SpanRole,
  when: FuzzyDate,
  /** How the span was established, e.g. "Wikidata: position held, Mauryan Emperor". */
  basis: z.string().max(500).optional(),
  source: SpanSource.optional(),
});
export type EntitySpan = z.infer<typeof EntitySpan>;

/** A span as written in a changeset: the date may use the hand-writable form. */
export const EntitySpanInput = z.object({
  role: SpanRole,
  when: DateInput,
  basis: EntitySpan.shape.basis,
  source: SpanSource.optional(),
});
export type EntitySpanInput = z.infer<typeof EntitySpanInput>;

export const EntitySpanInputs = z.array(EntitySpanInput).max(20);

/** Converts and validates spans for storage (dates to EDTF, ranges checked). */
export function toEntitySpans(inputs: readonly EntitySpanInput[]): EntitySpan[] {
  const out = inputs.map((s) => {
    const span: EntitySpan = { role: s.role, when: toFuzzyDate(s.when) };
    if (s.basis) span.basis = s.basis;
    if (s.source) span.source = s.source;
    return EntitySpan.parse(span);
  });
  const seen = new Set<string>();
  for (const s of out) {
    const key = `${s.role} ${s.when.edtf}`;
    if (seen.has(key)) throw new Error(`duplicate ${s.role} span ${s.when.edtf}`);
    seen.add(key);
  }
  return out;
}

/**
 * Which span best represents an entity of each kind, most preferred first.
 * Persons prefer their reign (rulers are placed by when they ruled), then
 * their life, then when they were active.
 */
export const SPAN_PREFERENCE: Partial<Record<EntityKind | (string & {}), SpanRole[]>> = {
  person: ["reign", "life", "floruit", "activity"],
  polity: ["existence", "activity"],
  period: ["existence"],
  culture: ["existence", "activity"],
  group: ["existence", "activity"],
  institution: ["existence", "activity"],
  event: ["activity", "existence"],
  place: ["existence", "activity"],
  site: ["construction", "activity", "existence"],
  inscription: ["construction", "existence"],
  artifact: ["construction", "existence"],
  text: ["construction", "activity"],
  concept: ["existence", "activity"],
};

/**
 * The role an entity's primary `when` can be assumed to have when no span says
 * so. Only where it is unambiguous: a polity's or period's date is when it
 * existed. A person's `when` could be a life or a reign, so it gets none.
 */
export function defaultSpanRole(kind: string): SpanRole | null {
  switch (kind) {
    case "polity":
    case "period":
    case "culture":
    case "group":
    case "institution":
      return "existence";
    default:
      return null;
  }
}

function startOf(span: EntitySpan): number {
  const b = dateBounds(span.when);
  return b.startMin ?? b.endMin ?? Number.POSITIVE_INFINITY;
}

/**
 * The first span matching the roles, in role order. Several spans with the same
 * role (two thrones) resolve to the earliest-starting one.
 */
export function pickSpan(
  spans: readonly EntitySpan[],
  roles: readonly SpanRole[],
): EntitySpan | null {
  for (const role of roles) {
    const matching = spans.filter((s) => s.role === role);
    if (matching.length) return [...matching].sort((a, b) => startOf(a) - startOf(b))[0]!;
  }
  return null;
}

/** The span to use as an entity's primary `when` when only spans were given. */
export function primarySpan(kind: string, spans: readonly EntitySpan[]): EntitySpan | null {
  if (!spans.length) return null;
  const roles = SPAN_PREFERENCE[kind] ?? [];
  return pickSpan(spans, roles) ?? spans[0]!;
}

/** Per-kind role preferences for a timeline, e.g. { person: ["reign", "life"] }. */
export type TimelineRoles = Partial<Record<string, SpanRole[]>>;

/** Default timeline display: rulers by their reign where one is recorded; otherwise `when`. */
export const DEFAULT_TIMELINE_ROLES: TimelineRoles = { person: ["reign"] };

/**
 * Whether two dates describe the same span: both ends within `toleranceYears`
 * (open ends must match). Used to recognise that an entity's curated `when`
 * already is its reign (c. 322–298 BCE vs Wikidata's 321–297 BCE).
 */
export function sameSpan(a: FuzzyDate, b: FuzzyDate, toleranceYears = 5): boolean {
  const x = dateBounds(a);
  const y = dateBounds(b);
  const near = (p: number | null, q: number | null) =>
    p === null || q === null ? p === q : Math.abs(p - q) <= toleranceYears;
  return near(x.startMin, y.startMin) && near(x.endMax, y.endMax);
}

/**
 * Chooses what to draw for an entity on a timeline. With a role preference for
 * its kind, the first matching span wins, except that when the primary `when`
 * is the same span (see sameSpan) the curated `when` is drawn under that role.
 * Otherwise (or if no span matches) the primary `when`, labelled with the role
 * of a span that has the same date, or the kind's default role.
 */
export function timelineSpan(
  entity: { kind: string; when: FuzzyDate | null; spans: readonly EntitySpan[] },
  roles: TimelineRoles = DEFAULT_TIMELINE_ROLES,
  options: { fallbackToWhen?: boolean } = {},
): { when: FuzzyDate; role: SpanRole | null; span: EntitySpan | null } | null {
  const preference = roles[entity.kind];
  if (preference?.length) {
    const span = pickSpan(entity.spans, preference);
    if (span) {
      if (entity.when && sameSpan(entity.when, span.when))
        return { when: entity.when, role: span.role, span };
      return { when: span.when, role: span.role, span };
    }
    if (options.fallbackToWhen === false) return null;
  }
  if (!entity.when) return null;
  const same = entity.spans.find((s) => sameSpan(s.when, entity.when!, 0)) ?? null;
  return { when: entity.when, role: same?.role ?? defaultSpanRole(entity.kind), span: same };
}

/**
 * The spans to show for an entity: those stored, or, when none are stored, the
 * primary `when` under the kind's default role (marked `implicit`).
 */
export function effectiveSpans(entity: {
  kind: string;
  when: FuzzyDate | null;
  spans: readonly EntitySpan[] | null | undefined;
}): (EntitySpan & { implicit?: true })[] {
  const stored = entity.spans ?? [];
  if (stored.length || !entity.when) return [...stored];
  const role = defaultSpanRole(entity.kind);
  return role ? [{ role, when: entity.when, implicit: true }] : [];
}
