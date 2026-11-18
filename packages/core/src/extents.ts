import { z } from "zod";
import { edtfYear, formatFuzzyDate } from "./dates";
import type { BboxTuple } from "./geo";

/**
 * Historical extents: the territory a polity held over a range of years, as a
 * GeoJSON MultiPolygon. These are reconstructions (Cliopatria and the like),
 * drawn at map scale; they say "roughly here", never "the border ran exactly
 * along this line".
 *
 * Years are ASTRONOMICAL integers (0 = 1 BCE, -317 = 318 BCE), inclusive at
 * both ends, so an extent applies to year y when fromYear <= y <= toYear.
 */

const Lon = z.number().min(-180).max(180);
const Lat = z.number().min(-90).max(90);
const Position = z.tuple([Lon, Lat]);

const ClosedRing = z
  .array(Position)
  .min(4, "a linear ring needs at least four positions")
  .refine((r) => r[0]![0] === r[r.length - 1]![0] && r[0]![1] === r[r.length - 1]![1], {
    message: "a linear ring must be closed (first position = last)",
  });

/** Maximum positions in one extent; keeps payloads map-sized. */
export const MAX_EXTENT_POSITIONS = 20000;

export const MultiPolygonGeometry = z
  .object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(z.array(ClosedRing).min(1)).min(1).max(500),
  })
  .superRefine((g, ctx) => {
    const n = g.coordinates.reduce((a, p) => a + p.reduce((b, r) => b + r.length, 0), 0);
    if (n > MAX_EXTENT_POSITIONS)
      ctx.addIssue({
        code: "custom",
        message: `geometry has ${n} positions; simplify it to at most ${MAX_EXTENT_POSITIONS}`,
      });
  });
export type MultiPolygonGeometry = z.infer<typeof MultiPolygonGeometry>;

/** reconstruction: a dataset's mapped reconstruction; approximate; conjectural. */
export const ExtentCertainty = z.enum(["reconstruction", "approximate", "conjectural"]);
export type ExtentCertainty = z.infer<typeof ExtentCertainty>;

/** [minLon, minLat, maxLon, maxLat] */
export const Bbox = z
  .tuple([Lon, Lat, Lon, Lat])
  .refine((b) => b[0] <= b[2] && b[1] <= b[3], { message: "bbox is [minLon, minLat, maxLon, maxLat]" });
export type Bbox = BboxTuple;

/**
 * Cliopatria years -> astronomical years. Cliopatria's README says years are
 * "integers, negative for BCE, positive for CE", which we read as historical
 * numbering: -318 is 318 BCE, astronomical -317. Year 0 does not exist in that
 * numbering, yet Cliopatria uses it to close BCE ranges ("-50..0" followed by
 * "1..13"); we map it to astronomical 0 (1 BCE). If the dataset is in fact
 * astronomical, BCE boundaries shift by one year, far below the precision of
 * the reconstructions. See docs/standards.md.
 */
export function cliopatriaYearToAstronomical(year: number): number {
  if (!Number.isInteger(year)) throw new Error(`not an integer year: ${year}`);
  return year < 0 ? year + 1 : year;
}

/** "318–316 BCE", "c. 320 CE" style label for an extent's inclusive year range. */
export function extentYearsLabel(fromYear: number, toYear: number): string {
  const edtf = fromYear === toYear ? edtfYear(fromYear) : `${edtfYear(fromYear)}/${edtfYear(toYear)}`;
  return formatFuzzyDate({ edtf });
}
