/**
 * Turning Wikidata items into entity fields: spans with provenance, coordinates
 * and the relations Wikidata states. Shared by the importers. Every date that
 * is refused is recorded in `skipped` so the run can report it.
 */
import type { WikidataItem, WikidataStatement, WikidataValue } from "@pramana/connectors";
import {
  assessWikidataTime,
  dateBounds,
  formatYear,
  joinEdtfSpan,
  WIKIDATA_CIRCA,
  wikidataSpanEndpoint,
  type EntityKind,
  type EntityLinkType,
  type EntitySpanInput,
  type SpanRole,
} from "@pramana/core";

export interface Spec {
  qid: string;
  kind: EntityKind;
  /** An existing entity (by slug) that has no QID yet: enrich it instead of creating one. */
  existing?: string;
  /** Why it is in the list, for the rationale. */
  note?: string;
}

// ---------------------------------------------------------------------------
// Wikidata statement helpers
// ---------------------------------------------------------------------------

export const skipped: string[] = [];
/** "fromId type toId" of links that already exist, so they are not proposed twice. */
export const existingLinkKeys = new Set<string>();
const skip = (qid: string, label: string, what: string, why: string) =>
  skipped.push(`${qid} ${label}: ${what} skipped (${why})`);

type Time = Extract<WikidataValue, { type: "time" }>;
export const timeOf = (v: WikidataValue | undefined): Time | null => (v?.type === "time" ? v : null);
export const itemOf = (v: WikidataValue | undefined): string | null => (v?.type === "item" ? v.id : null);
export const isCirca = (s: WikidataStatement) =>
  (s.qualifiers.P1480 ?? []).some((v) => itemOf(v) === WIKIDATA_CIRCA);

function endpoint(item: WikidataItem, what: string, value: Time | null, circa: boolean): string | null {
  if (!value) return null;
  const r = wikidataSpanEndpoint(value, { approximate: circa });
  if ("skip" in r) {
    skip(item.qid, item.label ?? "", what, `${value.time} @${value.precision}: ${r.skip}`);
    return null;
  }
  return r.edtf;
}

/** A span from two single-valued properties (P569/P570, P571/P576, P580/P582). */
export function spanFromProperties(
  item: WikidataItem,
  role: SpanRole,
  startProp: string,
  endProp: string,
  label: string,
): EntitySpanInput | null {
  const s = item.claims[startProp]?.[0];
  const e = item.claims[endProp]?.[0];
  if (!s && !e) return null;
  for (const [st, p] of [
    [s, startProp],
    [e, endProp],
  ] as const) {
    if (st && st.value.type !== "time")
      skip(item.qid, item.label ?? "", `${p}`, `value is ${st.value.type}, not a date`);
  }
  const start = s ? endpoint(item, `${role} start (${startProp})`, timeOf(s.value), isCirca(s)) : null;
  const end = e ? endpoint(item, `${role} end (${endProp})`, timeOf(e.value), isCirca(e)) : null;
  if (!start && !end) return null;
  const joined = joinEdtfSpan(start, end);
  if ("skip" in joined) {
    skip(item.qid, item.label ?? "", `${role} span`, joined.skip);
    return null;
  }
  // A life known from one end only reads better as "born …" / "died …".
  const halfLabel =
    role === "life" && (!start || !end)
      ? `${start ? "born" : "died"} ${formatYear(dateBounds(start ?? end!).startMin!)}${(start ?? end!).includes("~") ? " (approximately)" : ""}`
      : undefined;
  return {
    role,
    when: { edtf: joined.edtf, ...(halfLabel ? { label: halfLabel } : {}) },
    basis: `Wikidata ${item.qid}: ${label} (${startProp}/${endProp})`,
    source: { wikidata: { qid: item.qid, property: `${startProp}/${endProp}` } },
  };
}

export function pointSpan(item: WikidataItem, role: SpanRole, prop: string, label: string): EntitySpanInput | null {
  const st = item.claims[prop]?.[0];
  const t = timeOf(st?.value);
  if (!st || !t) return null;
  const r = assessWikidataTime(t, { approximate: isCirca(st) });
  if ("skip" in r) {
    skip(item.qid, item.label ?? "", `${role} (${prop})`, `${t.time} @${t.precision}: ${r.skip}`);
    return null;
  }
  return {
    role,
    when: { edtf: r.edtf },
    basis: `Wikidata ${item.qid}: ${label} (${prop})`,
    source: { wikidata: { qid: item.qid, property: prop } },
  };
}

export function reignSpans(item: WikidataItem, positions: Map<string, WikidataItem>): EntitySpanInput[] {
  const out: EntitySpanInput[] = [];
  for (const st of item.claims.P39 ?? []) {
    const pos = itemOf(st.value);
    const s = timeOf(st.qualifiers.P580?.[0]);
    const e = timeOf(st.qualifiers.P582?.[0]);
    if (!pos || (!s && !e)) continue;
    const posLabel = positions.get(pos)?.label ?? pos;
    const start = endpoint(item, `reign start (P39 ${posLabel})`, s, isCirca(st));
    const end = endpoint(item, `reign end (P39 ${posLabel})`, e, isCirca(st));
    if (!start && !end) continue;
    const joined = joinEdtfSpan(start, end);
    if ("skip" in joined) {
      skip(item.qid, item.label ?? "", `reign as ${posLabel}`, joined.skip);
      continue;
    }
    out.push({
      role: "reign",
      when: { edtf: joined.edtf },
      basis: `Wikidata ${item.qid}: position held, ${posLabel} (P39 with P580/P582)`,
      source: { wikidata: { qid: item.qid, property: "P39", value: pos } },
    });
  }
  return out;
}

/** Spans built here always use canonical EDTF dates. */
export const edtfOf = (span: EntitySpanInput): string => (span.when as { edtf: string }).edtf;

export const yearOf = (edtf: string, end: "start" | "end"): number | null => {
  const part = end === "start" ? edtf.split("/")[0] : edtf.split("/").at(-1);
  const m = part ? /^(-?\d{4})/.exec(part) : null;
  return m ? Number(m[1]) : null;
};

export function spansFor(spec: Spec, item: WikidataItem, positions: Map<string, WikidataItem>): EntitySpanInput[] {
  const label = item.label ?? spec.qid;
  switch (spec.kind) {
    case "person": {
      const reigns = reignSpans(item, positions);
      const life = spanFromProperties(item, "life", "P569", "P570", "born/died");
      const floruit = pointSpan(item, "floruit", "P1317", "floruit");
      const spans = [...reigns];
      if (life) {
        // A life that does not contain the reigns is contradictory: keep the reigns, drop the life.
        const born = yearOf(edtfOf(life), "start");
        const firstReign = Math.min(
          ...reigns.map((r) => yearOf(edtfOf(r), "start") ?? Infinity),
        );
        if (born !== null && Number.isFinite(firstReign) && born > firstReign)
          skip(item.qid, label, "life span", `birth (${born}) is after the start of a reign (${firstReign})`);
        else spans.push(life);
      }
      if (floruit) spans.push(floruit);
      return spans;
    }
    case "polity":
    case "period":
    case "group":
    case "institution":
    case "culture": {
      const s =
        spanFromProperties(item, "existence", "P571", "P576", "inception/dissolved") ??
        spanFromProperties(item, "existence", "P580", "P582", "start/end time");
      return s ? [s] : [];
    }
    case "event": {
      const s =
        spanFromProperties(item, "activity", "P580", "P582", "start/end time") ??
        pointSpan(item, "activity", "P585", "point in time");
      return s ? [s] : [];
    }
    case "site":
    case "inscription":
    case "artifact": {
      const s = pointSpan(item, "construction", "P571", "inception");
      return s ? [s] : [];
    }
    default:
      return [];
  }
}

export function coordinates(item: WikidataItem) {
  const sts = (item.claims.P625 ?? []).filter((s) => s.value.type === "coordinates");
  const first = sts[0]?.value;
  if (!first || first.type !== "coordinates") return null;
  return {
    geometry: { type: "Point" as const, coordinates: [first.lon, first.lat] as [number, number] },
    certainty: "approximate" as const,
    note: `Coordinates from Wikidata ${item.qid} (P625)${sts.length > 1 ? `; the first of ${sts.length} values` : ""}.`,
  };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export interface Link {
  from: string;
  to: string;
  type: EntityLinkType;
  note: string;
  when?: { edtf: string };
}

/** The P580/P582 qualifiers of a statement as a span, if usable (no logging: spans report skips). */
export function qualifierSpan(st: WikidataStatement): { edtf: string } | undefined {
  const end = (v: WikidataValue | undefined) => {
    const t = timeOf(v);
    const r = t ? wikidataSpanEndpoint(t, { approximate: isCirca(st) }) : null;
    return r && "edtf" in r ? r.edtf : null;
  };
  const joined = joinEdtfSpan(end(st.qualifiers.P580?.[0]), end(st.qualifiers.P582?.[0]));
  return "edtf" in joined ? { edtf: joined.edtf } : undefined;
}

export function linksFor(item: WikidataItem, positions: Map<string, WikidataItem>): Link[] {
  const out: Link[] = [];
  const q = item.qid;
  for (const st of item.claims.P39 ?? []) {
    const pos = itemOf(st.value);
    if (!pos) continue;
    const p = positions.get(pos);
    for (const polity of [...(p?.claims.P17 ?? []), ...(p?.claims.P1001 ?? [])].map((s) => itemOf(s.value))) {
      if (polity) {
        const when = qualifierSpan(st);
        out.push({
          from: q,
          to: polity,
          type: "ruled",
          note: `Wikidata: ${q} P39 ${p?.label ?? pos} (${pos}), whose country/jurisdiction is ${polity}`,
          ...(when ? { when } : {}),
        });
      }
    }
    for (const prev of (st.qualifiers.P1365 ?? []).map(itemOf))
      if (prev) out.push({ from: q, to: prev, type: "successor_of", note: `Wikidata: ${q} P39 ${p?.label ?? pos}, replaces (P1365) ${prev}` });
    for (const next of (st.qualifiers.P1366 ?? []).map(itemOf))
      if (next) out.push({ from: next, to: q, type: "successor_of", note: `Wikidata: ${q} P39 ${p?.label ?? pos}, replaced by (P1366) ${next}` });
  }
  for (const prev of (item.claims.P1365 ?? []).map((s) => itemOf(s.value)))
    if (prev) out.push({ from: q, to: prev, type: "successor_of", note: `Wikidata: ${q} replaces (P1365) ${prev}` });
  for (const next of (item.claims.P1366 ?? []).map((s) => itemOf(s.value)))
    if (next) out.push({ from: next, to: q, type: "successor_of", note: `Wikidata: ${q} replaced by (P1366) ${next}` });
  for (const st of item.claims.P710 ?? []) {
    const who = itemOf(st.value);
    if (who) out.push({ from: who, to: q, type: "participant_in", note: `Wikidata: ${q} participant (P710) ${who}` });
    for (const commander of (st.qualifiers.P4791 ?? []).map(itemOf))
      if (commander)
        out.push({ from: commander, to: q, type: "participant_in", note: `Wikidata: ${q} participant ${who}, commanded by (P4791) ${commander}` });
  }
  for (const st of [...(item.claims.P607 ?? []), ...(item.claims.P1344 ?? [])]) {
    const war = itemOf(st.value);
    if (war) out.push({ from: q, to: war, type: "participant_in", note: `Wikidata: ${q} conflict/participant in (P607/P1344) ${war}` });
  }
  for (const whole of (item.claims.P361 ?? []).map((s) => itemOf(s.value)))
    if (whole) out.push({ from: q, to: whole, type: "part_of", note: `Wikidata: ${q} part of (P361) ${whole}` });
  // Location: current statements only (a P582 end date means a former administrative unit).
  const current = [...(item.claims.P276 ?? []), ...(item.claims.P131 ?? [])].filter((s) => !s.qualifiers.P582);
  for (const place of current.map((s) => itemOf(s.value)))
    if (place) out.push({ from: q, to: place, type: "located_in", note: `Wikidata: ${q} location (P276/P131) ${place}` });
  return out;
}

