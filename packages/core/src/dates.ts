/// <reference path="../types/edtf.d.ts" />
import edtf, { parse as parseEdtfGrammar } from "edtf";
import { z } from "zod";

/**
 * Dates follow EDTF, the Extended Date/Time Format (Library of Congress), now
 * ISO 8601-2:2019. See docs/standards.md.
 *
 * - Years are ASTRONOMICAL: 0000 = 1 BCE, -0001 = 2 BCE, -0321 = 322 BCE.
 *   Use `DatePoint` ({ year, era: "BCE" }) when writing by hand, which avoids
 *   off-by-one mistakes.
 * - Calendar is proleptic Gregorian. Dates as stated in a source, in another
 *   calendar or era (Vikram Samvat, Shaka, Hijri, regnal years), go in `asStated`.
 * - "~" = approximate, "?" = uncertain, "%" = both; "X" = unspecified digit
 *   (194X = 1940s); "a/b" = interval; ".." = open end.
 */

export const Calendar = z.enum([
  "gregorian",
  "julian",
  "vikram_samvat",
  "shaka",
  "hijri",
  "buddhist",
  "regnal",
  "other",
]);
export type Calendar = z.infer<typeof Calendar>;

const ALLOWED_EDTF_TYPES = new Set(["Date", "Year", "Interval", "Decade", "Century", "Season"]);

/**
 * Parses an EDTF string. The type comes from the grammar's result, not from
 * edtf.js's `value.type`, which is the JavaScript class name and so breaks once
 * a production build minifies class names ("aJ values are not supported").
 */
export function parseEdtf(value: string): ReturnType<typeof edtf> {
  const res = parseEdtfGrammar(value);
  if (!ALLOWED_EDTF_TYPES.has(res.type)) {
    throw new Error(
      `EDTF ${res.type} values are not supported yet; use a single date or an interval`,
    );
  }
  const parsed = edtf(res);
  // Pin the grammar's type name on the value, shadowing the class-name getter.
  Object.defineProperty(parsed, "type", { value: res.type, enumerable: false });
  return parsed;
}

export const EdtfString = z
  .string()
  .min(1)
  .max(64)
  .superRefine((value, ctx) => {
    try {
      parseEdtf(value);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: `invalid EDTF date "${value}": ${(error as Error).message}`,
      });
    }
  });

export const FuzzyDate = z.object({
  /** Canonical machine value (EDTF / ISO 8601-2). */
  edtf: EdtfString,
  /** Optional human label overriding the generated one, e.g. "Mature Harappan phase". */
  label: z.string().max(200).optional(),
  /** The date exactly as the source states it, if it differs from the EDTF value. */
  asStated: z
    .object({
      text: z.string().max(500),
      calendar: Calendar.optional(),
      note: z.string().max(1000).optional(),
    })
    .optional(),
  /** How the date was established: "radiocarbon", "regnal-year count", "conventional periodisation"... */
  basis: z.string().max(500).optional(),
});
export type FuzzyDate = z.infer<typeof FuzzyDate>;

/** Hand-writable date point using historical (BCE/CE) numbering. */
export const DatePoint = z.object({
  year: z.number().int().positive(),
  era: z.enum(["BCE", "CE"]),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  approximate: z.boolean().optional(),
  uncertain: z.boolean().optional(),
});
export type DatePoint = z.infer<typeof DatePoint>;

export const HumanDate = z.object({
  start: DatePoint,
  end: DatePoint.optional(),
  label: FuzzyDate.shape.label,
  asStated: FuzzyDate.shape.asStated,
  basis: FuzzyDate.shape.basis,
});
export type HumanDate = z.infer<typeof HumanDate>;

/** Accepted wherever a date is written: canonical EDTF, or the hand-writable form. */
export const DateInput = z.union([FuzzyDate, HumanDate]);
export type DateInput = z.infer<typeof DateInput>;

export function toAstronomicalYear(year: number, era: "BCE" | "CE"): number {
  return era === "CE" ? year : 1 - year;
}

export function fromAstronomicalYear(astro: number): { year: number; era: "BCE" | "CE" } {
  return astro > 0 ? { year: astro, era: "CE" } : { year: 1 - astro, era: "BCE" };
}

/** Formats an astronomical year as an EDTF year ("-0321", "1947", "Y-10000"). */
export function edtfYear(astro: number): string {
  if (Math.abs(astro) > 9999) return `Y${astro}`;
  const digits = String(Math.abs(astro)).padStart(4, "0");
  return astro < 0 ? `-${digits}` : digits;
}

function pointToEdtf(point: DatePoint): string {
  let out = edtfYear(toAstronomicalYear(point.year, point.era));
  if (point.month !== undefined) {
    out += `-${String(point.month).padStart(2, "0")}`;
    if (point.day !== undefined) out += `-${String(point.day).padStart(2, "0")}`;
  }
  // Long-year ("Y") form cannot carry qualifiers in EDTF level 1; drop them there.
  if (out.startsWith("Y")) return out;
  if (point.approximate && point.uncertain) return `${out}%`;
  if (point.approximate) return `${out}~`;
  if (point.uncertain) return `${out}?`;
  return out;
}

export function toFuzzyDate(input: DateInput): FuzzyDate {
  if ("edtf" in input) return FuzzyDate.parse(input);
  const start = pointToEdtf(input.start);
  const end = input.end ? pointToEdtf(input.end) : null;
  if (end && (start.startsWith("Y") || end.startsWith("Y"))) {
    throw new Error(
      "ranges before 9999 BCE are not supported yet (EDTF long years cannot be interval bounds); use a single year with a label",
    );
  }
  const value = end ? `${start}/${end}` : start;
  const result: FuzzyDate = { edtf: value };
  if (input.label) result.label = input.label;
  if (input.asStated) result.asStated = input.asStated;
  if (input.basis) result.basis = input.basis;
  const bounds = dateBounds(result);
  if (bounds.startMin !== null && bounds.endMax !== null && bounds.startMin > bounds.endMax) {
    throw new Error(`date range ends before it starts: ${value}`);
  }
  return FuzzyDate.parse(result);
}

/**
 * Numeric bounds as decimal astronomical years (e.g. -321.0 is the start of
 * 322 BCE). Used for sorting, filtering and drawing timelines; the EDTF string
 * stays the source of truth. `null` means an open or unknown end.
 */
export interface DateBounds {
  startMin: number | null;
  startMax: number | null;
  endMin: number | null;
  endMax: number | null;
  approximate: boolean;
  uncertain: boolean;
}

function startOfYearMs(year: number): number {
  const d = new Date(0);
  d.setUTCFullYear(year, 0, 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function msToDecimalYear(ms: number): number {
  const year = new Date(ms).getUTCFullYear();
  const start = startOfYearMs(year);
  const next = startOfYearMs(year + 1);
  return year + (ms - start) / (next - start);
}

function finite(ms: number | undefined): number | null {
  return ms === undefined || Number.isNaN(ms) ? null : msToDecimalYear(ms);
}

const LONG_YEAR = /^Y(-?\d+)$/;

export function dateBounds(date: FuzzyDate | string): DateBounds {
  const value = typeof date === "string" ? date : date.edtf;
  // Years beyond JavaScript Date's range (about 271,000 BCE) are computed directly.
  const long = LONG_YEAR.exec(value);
  if (long) {
    const y = Number(long[1]);
    return {
      startMin: y,
      startMax: y + 1,
      endMin: y,
      endMax: y + 1,
      approximate: false,
      uncertain: false,
    };
  }
  const parsed = parseEdtf(value);
  const approximate = /[~%]/.test(value);
  const uncertain = /[?%]/.test(value);
  if (parsed.type === "Interval") {
    const lower = parsed.lower as { min: number; max: number } | undefined;
    const upper = parsed.upper as { min: number; max: number } | undefined;
    const bounds: DateBounds = {
      startMin: lower ? finite(lower.min) : null,
      startMax: lower ? finite(lower.max) : null,
      endMin: upper ? finite(upper.min) : null,
      endMax: upper ? finite(upper.max) : null,
      approximate,
      uncertain,
    };
    // EDTF distinguishes an UNKNOWN end ("-0249/") from an OPEN, ongoing one
    // ("1947-08-15/.."). Only "open" may run to the present; an unknown end is
    // treated as the known start alone, flagged uncertain, so nothing is drawn
    // as lasting until today just because its end was not recorded.
    const [, startPart = "", endPart = ""] = /^(.*?)\/(.*)$/.exec(value) ?? [];
    if (endPart === "" && bounds.startMin !== null) {
      bounds.endMin = bounds.startMin;
      bounds.endMax = bounds.startMax;
      bounds.uncertain = true;
    }
    if (startPart === "" && bounds.endMax !== null) {
      bounds.startMin = bounds.endMin;
      bounds.startMax = bounds.endMax;
      bounds.uncertain = true;
    }
    return bounds;
  }
  const min = finite(parsed.min);
  const max = finite(parsed.max);
  return { startMin: min, startMax: max, endMin: min, endMax: max, approximate, uncertain };
}

/** "322 BCE", "1947 CE". */
export function formatYear(astro: number, opts: { era?: "always" | "auto" } = {}): string {
  const { year, era } = fromAstronomicalYear(Math.floor(astro));
  if (opts.era === "auto" && era === "CE" && year >= 1000) return String(year);
  return `${year} ${era}`;
}

function formatSpan(fromAstro: number, toAstro: number): string {
  const a = fromAstronomicalYear(fromAstro);
  const b = fromAstronomicalYear(toAstro);
  if (a.year === b.year && a.era === b.era) return `${a.year} ${a.era}`;
  if (a.era === b.era) return `${a.year}–${b.year} ${a.era}`;
  return `${a.year} ${a.era} – ${b.year} ${b.era}`;
}

/** Human-readable summary of a fuzzy date, e.g. "c. 322–185 BCE". */
export function formatFuzzyDate(date: FuzzyDate): string {
  if (date.label) return date.label;
  const b = dateBounds(date);
  const prefix = b.approximate ? "c. " : "";
  // Only a date marked uncertain ("?", "%") says so. An end that was not
  // recorded ("-0489~/", flagged uncertain in its bounds) casts no doubt on
  // the date that was: it reads "from c. 490 BCE".
  const suffix = /[?%]/.test(date.edtf) ? " (uncertain)" : "";
  const isInterval = date.edtf.includes("/");
  if (!isInterval) {
    if (b.startMin === null || b.endMax === null) return date.edtf;
    const from = Math.floor(b.startMin);
    const to = Math.floor(b.endMax - 1e-9);
    const exact = /^-?\d{4}-\d{2}-\d{2}/.test(date.edtf);
    if (exact) return `${prefix}${formatIsoDay(date.edtf)}${suffix}`;
    return `${prefix}${formatSpan(from, to)}${suffix}`;
  }
  const [, startPart = "", endPart = ""] = /^(.*?)\/(.*)$/.exec(date.edtf) ?? [];
  const known = (part: string) => part !== "" && part !== "..";
  const from = b.startMin === null || !known(startPart) ? null : Math.floor(b.startMin);
  const to = b.endMax === null || !known(endPart) ? null : Math.floor(b.endMax - 1e-9);
  const end = (part: string, year: number) =>
    /^-?\d{4}-\d{2}-\d{2}/.test(part) ? formatIsoDay(part) : formatYear(year);
  if (from === null && to === null) return "date unknown";
  if (from === null) return `until ${prefix}${end(endPart, to!)}${suffix}`;
  if (to === null) return `from ${prefix}${end(startPart, from)}${suffix}`;
  return `${prefix}${formatSpan(from, to)}${suffix}`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatIsoDay(value: string): string {
  const match = /^(-?\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const astro = Number(match[1]);
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${formatYear(astro, { era: "auto" })}`;
}

// ---------------------------------------------------------------------------
// Wikidata time values
// ---------------------------------------------------------------------------

export const WIKIDATA_GREGORIAN = "http://www.wikidata.org/entity/Q1985727";
export const WIKIDATA_JULIAN = "http://www.wikidata.org/entity/Q1985786";

export interface WikidataTime {
  time: string;
  precision: number;
  calendarmodel?: string;
}

/** Julian calendar date -> Julian Day Number. */
function julianToJdn(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
}

/** Julian Day Number -> proleptic Gregorian date (astronomical year). */
function jdnToGregorian(jdn: number): { y: number; m: number; d: number } {
  const a = jdn + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return {
    d: e - Math.floor((153 * m + 2) / 5) + 1,
    m: m + 3 - 12 * Math.floor(m / 10),
    y: 100 * b + d - 4800 + Math.floor(m / 10),
  };
}

/**
 * Converts a Wikidata time value to EDTF. Wikidata's JSON uses HISTORICAL year
 * numbering (no year 0: -0044 is 44 BCE), unlike ISO 8601 / EDTF, which are
 * astronomical (-0043 is 44 BCE). Coarse precisions (decade and above) become
 * intervals. Julian-calendar days are converted to proleptic Gregorian.
 */
export function wikidataTimeToEdtf(value: WikidataTime): string | null {
  const match = /^([+-])(\d+)-(\d{2})-(\d{2})T/.exec(value.time);
  if (!match) return null;
  const historical = Number(match[2]) * (match[1] === "-" ? -1 : 1);
  if (historical === 0) return null;
  const astro = historical < 0 ? historical + 1 : historical;
  const month = Number(match[3]);
  const day = Number(match[4]);
  const p = value.precision;

  if (p >= 11 && month > 0 && day > 0) {
    let y = astro;
    let m = month;
    let d = day;
    if (value.calendarmodel === WIKIDATA_JULIAN) {
      ({ y, m, d } = jdnToGregorian(julianToJdn(astro, month, day)));
    }
    return `${edtfYear(y)}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (p === 10 && month > 0) return `${edtfYear(astro)}-${String(month).padStart(2, "0")}`;
  if (p >= 9 || (p >= 10 && month === 0)) return edtfYear(astro);
  if (p === 8) {
    const start = Math.floor(astro / 10) * 10;
    return `${edtfYear(start)}/${edtfYear(start + 9)}`;
  }
  // Century (7), millennium (6), and coarser: count in historical units, which
  // is how Wikidata intends them ("3rd century BCE" = 300–201 BCE).
  const unit = 10 ** (9 - p);
  const n = Math.ceil(Math.abs(historical) / unit);
  const [lo, hi] =
    historical > 0 ? [(n - 1) * unit + 1, n * unit] : [1 - n * unit, 1 - ((n - 1) * unit + 1)];
  // EDTF long years ("Y") cannot be interval bounds: fall back to the start year alone.
  if (Math.abs(lo) > 9999 || Math.abs(hi) > 9999) return edtfYear(lo);
  return `${edtfYear(lo)}/${edtfYear(hi)}`;
}

/** Wikidata precision codes, for messages. */
const WIKIDATA_PRECISION_NAMES: Record<number, string> = {
  0: "billion years",
  1: "hundred million years",
  3: "million years",
  4: "hundred thousand years",
  5: "ten thousand years",
  6: "millennium",
  7: "century",
  8: "decade",
  9: "year",
  10: "month",
  11: "day",
};

/** "circa" (Q5727902) as a sourcing-circumstances (P1480) qualifier. */
export const WIKIDATA_CIRCA = "Q5727902";

export type WikidataTimeAssessment = { edtf: string } | { skip: string };

/**
 * Converts a Wikidata time value for import, refusing values too coarse to
 * place on a timeline: anything less precise than a century (a millennium
 * turns "the Buddha" into -0999/0000). `approximate` (a "circa" qualifier)
 * marks the result with "~".
 */
export function assessWikidataTime(
  value: WikidataTime,
  options: { minPrecision?: number; approximate?: boolean } = {},
): WikidataTimeAssessment {
  const min = options.minPrecision ?? 7;
  if (value.precision < min) {
    const name = WIKIDATA_PRECISION_NAMES[value.precision] ?? `precision ${value.precision}`;
    return { skip: `precision is ${name}, coarser than ${WIKIDATA_PRECISION_NAMES[min] ?? min}` };
  }
  const edtf = wikidataTimeToEdtf(value);
  if (!edtf) return { skip: `unusable time value ${value.time}` };
  if (!options.approximate) return { edtf };
  return {
    edtf: edtf
      .split("/")
      .map((p) => (p.startsWith("Y") ? p : `${p}~`))
      .join("/"),
  };
}

/**
 * Joins a start and an end (each a converted Wikidata value, possibly an
 * interval itself) into one EDTF span, using the outer bounds. A missing end
 * becomes an unknown end ("-0303/"). Refuses spans that end before they start.
 */
export function joinEdtfSpan(start: string | null, end: string | null): WikidataTimeAssessment {
  if (!start && !end) return { skip: "no start or end" };
  const lo = start ? start.split("/")[0]! : "";
  const hi = end ? end.split("/").at(-1)! : "";
  if (lo && hi) {
    const a = dateBounds(lo);
    const b = dateBounds(hi);
    if (a.startMin !== null && b.endMax !== null && a.startMin >= b.endMax) {
      return { skip: `ends (${hi}) before it starts (${lo})` };
    }
    if (lo === hi) return { edtf: lo };
  }
  const edtf = `${lo}/${hi}`;
  try {
    parseEdtf(edtf);
  } catch (error) {
    return { skip: `invalid span ${edtf}: ${(error as Error).message}` };
  }
  return { edtf };
}

/**
 * One end of a span (a birth, a reign's start) from a Wikidata time value.
 * Year precision or finer is used as is; a decade becomes its stated year,
 * approximate; a century or coarser is too vague to bound a span and is
 * refused (the span keeps an unknown end instead).
 */
export function wikidataSpanEndpoint(
  value: WikidataTime,
  options: { approximate?: boolean } = {},
): WikidataTimeAssessment {
  if (value.precision === 8) {
    return assessWikidataTime({ ...value, precision: 9 }, { approximate: true });
  }
  if (value.precision < 9) {
    const name = WIKIDATA_PRECISION_NAMES[value.precision] ?? `precision ${value.precision}`;
    return { skip: `precision is ${name}, too coarse for the end of a span` };
  }
  return assessWikidataTime(value, options);
}
