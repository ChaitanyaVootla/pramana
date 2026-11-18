import type { PlaceTime } from "@pramana/services";

/**
 * How much a place belongs on the map of `year`, 0..1, and whether to name it,
 * from what the database records of its dates (PlaceTime):
 *
 * - events: fully there in their years, fading out over `win` years either side;
 * - things made or founded (inscriptions, monuments, cities with a date): from
 *   that date on, fading in over `win` years before it;
 * - things dated only by what mentions them (claims, linked periods): there
 *   around those years; otherwise a quiet, unnamed dot (sites and inscriptions
 *   are hidden before they are first attested; cities stay, faintly);
 * - undated, unmentioned things: always there, a little quieter.
 */
export function timeWeight(kind: string, time: PlaceTime | undefined, year: number, win: number) {
  const near = (spans: [number, number][]) =>
    spans.reduce((best, [a, b]) => {
      const d = year < a ? a - year : year > b ? year - b : 0;
      return Math.max(best, d === 0 ? 1 : Math.max(0, 1 - d / win));
    }, 0);
  const named = (w: number) => ({ w, label: w >= 0.5 });
  if (!time || (!time.own && !time.attested.length)) return { w: 0.7, label: true };
  if (time.own) {
    const [a, b] = time.own;
    if (a === null) return named(near(time.attested.length ? time.attested : [[-1e5, 1e5]]));
    // Events last their span; a city lasts until it is dissolved (an open end
    // when its founding is all we know); a monument or inscription, once made, stays.
    const end = kind === "event" ? Math.max(a, b ?? a) : kind === "place" ? (b ?? 1e5) : 1e5;
    return named(near([[a, end]]));
  }
  // Named near the years claims mention it; a linked period's span (Dandi
  // with the whole independence movement) only keeps a quiet dot.
  const n = near(time.mentions?.length ? time.mentions : time.attested);
  const p = near(time.attested);
  const first = time.attested[0]![0];
  if (kind === "event") return named(n);
  if (kind === "place") return { w: Math.max(n, p * 0.6, 0.25), label: n >= 0.5 };
  // Sites and inscriptions: not before they are first attested; quiet afterwards.
  return { w: year < first ? p : Math.max(n, p * 0.6, 0.4), label: n >= 0.5 };
}
