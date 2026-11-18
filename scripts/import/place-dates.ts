/**
 * Wikidata -> when our places existed and what they were called, as one
 * changeset of update_entity ops, through MCP:
 *
 *   founding and end   P571 inception is a START: a city's or site's existence
 *                      span from it, with P576 (dissolved) as its end or else an
 *                      unknown end ("-0489/", which counts as the start alone,
 *                      so nothing is drawn as lasting to today). A century-
 *                      precise inception is too coarse to start a span; it
 *                      becomes the entity's date only if it has none, labelled
 *                      "begun …" for a site, "from …" for a place. Inscriptions and objects keep P571 as their
 *                      date of making (construction).
 *   dated names        P1448 official name, English, with a P580 start or P582
 *                      end qualifier: an alias with `when` (Bombay, then Mumbai
 *                      from 1995), so the atlas can name a place by the year
 *   short names        P1813, only if dated (undated ones are codes such as
 *                      "LHR", which are not names for a map)
 *
 * Only what Wikidata states, through the same date rules as the other
 * importers (century precision or coarser is refused, circa kept); nothing is
 * inferred. Entities that already have curated spans keep them. Every refusal
 * is listed in the changeset's rationale.
 *
 *   pnpm tsx scripts/import/place-dates.ts [--dry] [--approve-preview]
 */
import { getWikidataItems, type WikidataItem, type WikidataValue } from "@pramana/connectors";
import {
  assessWikidataTime,
  formatFuzzyDate,
  joinEdtfSpan,
  WIKIDATA_CIRCA,
  wikidataSpanEndpoint,
  type Alias,
  type ChangeOpInput,
  type EntitySpanInput,
} from "@pramana/core";
import { approveInPreview, flag, withMcp, type Mcp, type Proposal } from "./lib";
import { skipped, spansFor } from "./wikidata-lib";

const TITLE = "Places from Wikidata: founding dates and dated names";
const KINDS = ["place", "site", "inscription"] as const;

type Time = Extract<WikidataValue, { type: "time" }>;
const timeOf = (v: WikidataValue | undefined): Time | null => (v?.type === "time" ? v : null);

/** An EDTF endpoint for a name's start or end qualifier, or null (and why). */
function qualifierEdtf(t: Time | null): { edtf: string | null; why?: string } {
  if (!t) return { edtf: null };
  const r = wikidataSpanEndpoint(t);
  return "skip" in r
    ? { edtf: null, why: `${t.time} @${t.precision}: ${r.skip}` }
    : { edtf: r.edtf };
}

/** Dated English names (P1448, and P1813 when dated), as aliases with `when`. */
function datedNames(item: WikidataItem, label: string, refused: string[]): Alias[] {
  const out: Alias[] = [];
  for (const prop of ["P1448", "P1813"] as const) {
    for (const st of item.claims[prop] ?? []) {
      if (st.value.type !== "text" || st.value.language !== "en") continue;
      const start = qualifierEdtf(timeOf(st.qualifiers.P580?.[0]));
      const end = qualifierEdtf(timeOf(st.qualifiers.P582?.[0]));
      for (const w of [start.why, end.why])
        if (w) refused.push(`${item.qid} ${label}: ${prop} “${st.value.text}” date ${w}`);
      if (!start.edtf && !end.edtf) continue; // undated: not a name for a given year
      const joined = joinEdtfSpan(start.edtf, end.edtf);
      if ("skip" in joined) {
        refused.push(`${item.qid} ${label}: ${prop} “${st.value.text}”: ${joined.skip}`);
        continue;
      }
      const name = prop === "P1448" ? "official name" : "short name";
      out.push({
        label: st.value.text,
        lang: "en",
        when: { edtf: joined.edtf },
        note: `Wikidata ${item.qid}: ${name} (${prop}) ${start.edtf ? `from ${start.edtf}` : ""}${start.edtf && end.edtf ? " " : ""}${end.edtf ? `until ${end.edtf}` : ""}.`,
      });
    }
  }
  return out;
}

const circa = (st: { qualifiers: Record<string, WikidataValue[]> } | undefined) =>
  (st?.qualifiers.P1480 ?? []).some((v) => v.type === "item" && v.id === WIKIDATA_CIRCA);

/**
 * A place's or site's inception as the start of its existence. Returns the
 * span (and the date for an entity that has none), or only a date ("begun …")
 * when the inception is too coarse to start a span, or null.
 */
function inception(
  item: WikidataItem,
  refused: string[],
  kind: string,
): { span: EntitySpanInput | null; when: { edtf: string; label: string } } | null {
  const st = item.claims.P571?.[0];
  const t = timeOf(st?.value);
  if (!st || !t) return null;
  const endSt = item.claims.P576?.[0];
  const endT = timeOf(endSt?.value);
  const end = endT ? wikidataSpanEndpoint(endT, { approximate: circa(endSt) }) : null;
  if (end && "skip" in end)
    refused.push(`${item.qid} ${item.label}: dissolved (P576) ${endT!.time}: ${end.skip}`);
  const endEdtf = end && !("skip" in end) ? end.edtf : null;
  const start = wikidataSpanEndpoint(t, { approximate: circa(st) });
  if (!("skip" in start)) {
    const joined = joinEdtfSpan(start.edtf, endEdtf);
    if ("skip" in joined) {
      refused.push(`${item.qid} ${item.label}: existence span: ${joined.skip}`);
      return null;
    }
    const label = `from ${formatFuzzyDate({ edtf: start.edtf })}${endEdtf ? ` to ${formatFuzzyDate({ edtf: endEdtf })}` : ""}`;
    return {
      span: {
        role: "existence",
        when: { edtf: joined.edtf, label },
        basis: `Wikidata ${item.qid}: inception (P571) as the start${endEdtf ? ", dissolved (P576) as the end" : "; end not recorded"}`,
        source: { wikidata: { qid: item.qid, property: endEdtf ? "P571/P576" : "P571" } },
      },
      when: { edtf: joined.edtf, label },
    };
  }
  // Too coarse for a span's start (a century): only a date, saying what it is.
  const coarse = assessWikidataTime(t, { approximate: circa(st) });
  if ("skip" in coarse) {
    refused.push(
      `${item.qid} ${item.label}: inception (P571) ${t.time} @${t.precision}: ${coarse.skip}`,
    );
    return null;
  }
  refused.push(
    `${item.qid} ${item.label}: inception (P571) ${t.time} is century-precise: kept as the date only ("begun …" or "from …"), not as the start of a span`,
  );
  // A monument is begun; a city or region simply dates from then.
  const verb = kind === "site" ? "begun" : "from";
  return {
    span: null,
    when: { edtf: coarse.edtf, label: `${verb} ${formatFuzzyDate({ edtf: coarse.edtf })}` },
  };
}

/** Spans and dates this importer made earlier (from P571 as a whole date), which it may correct. */
// A span this importer made: sourced from P571 and with its own basis. A span that keeps the Wikidata
// source but has a curated basis (e.g. "Traditional: …", the date made approximate) is not ours to replace.
const fromWikidataInception = (s: {
  source?: { wikidata?: { property?: string } };
  basis?: string;
}) =>
  ["P571", "P571/P576"].includes(s.source?.wikidata?.property ?? "") &&
  (s.basis ?? "Wikidata").startsWith("Wikidata");

interface EntityDetail {
  entity: {
    id: string;
    slug: string;
    kind: string;
    label: string;
    wikidataId: string | null;
    aliases: Alias[];
    when?: { edtf: string; label?: string } | null;
    spans?: {
      implicit?: boolean;
      role?: string;
      when?: { edtf: string };
      source?: { wikidata?: { property?: string } };
    }[];
    version: number;
  };
}

await withMcp("pramana-import-place-dates", async (mcp: Mcp) => {
  const pending = await mcp.call<{ title: string; status: string }[]>("list_changesets", {
    limit: 200,
  });
  if (pending.some((c) => c.title === TITLE && c.status === "proposed")) {
    console.log(`“${TITLE}” is already waiting for review. Nothing to do.`);
    return;
  }
  // Which of our places have a QID (read-only listing; every write goes through MCP).
  const { listEntities } = await import("@pramana/services");
  const listed = (await listEntities([...KINDS])).filter((e) => e.wikidataId);
  const items = await getWikidataItems(listed.map((e) => e.wikidataId!));

  const ops: ChangeOpInput[] = [];
  const report: string[] = [];
  const refused: string[] = [];
  for (const card of listed) {
    const item = items.get(card.wikidataId!);
    if (!item) {
      refused.push(`${card.wikidataId} ${card.label}: not found on Wikidata`);
      continue;
    }
    const { entity: e } = await mcp.call<EntityDetail>("get_entity", { entity: card.slug });
    const set: Record<string, unknown> = {};

    // Founding: cities and sites from their inception on; inscriptions and objects made then.
    const stored = (e.spans ?? []).filter((x) => !x.implicit);
    // Spans this importer made before (P571 read as the whole date) may be replaced; curated ones never.
    const ours = stored.length > 0 && stored.every(fromWikidataInception);
    // The date is ours to correct if there is none, if a span we made gave it, or if it is the
    // very inception date we set before (only its label may differ).
    const derivedWhen =
      !e.when ||
      stored.some((x) => fromWikidataInception(x) && x.when?.edtf === e.when!.edtf) ||
      (e.kind === "place" || e.kind === "site"
        ? (() => {
            const st = item.claims.P571?.[0];
            const t = timeOf(st?.value);
            const r = t ? assessWikidataTime(t, { approximate: circa(st) }) : null;
            // Only a date with no label or one of ours ("from …", "begun …"): a curated label stays.
            const ourLabel = !e.when!.label || /^(from|begun) /.test(e.when!.label);
            return Boolean(r && !("skip" in r) && r.edtf === e.when!.edtf && ourLabel);
          })()
        : false);
    if (e.kind === "place" || e.kind === "site") {
      const inc = inception(item, refused, e.kind);
      if (inc && (!stored.length || ours)) {
        const spans = inc.span ? [inc.span] : [];
        // Compare what matters (stored spans carry extra fields), so a re-run proposes nothing new.
        const sig = (
          xs: {
            role?: string;
            when?: { edtf: string };
            source?: { wikidata?: { property?: string } };
          }[],
        ) =>
          xs
            .map((x) => `${x.role}|${x.when?.edtf}|${x.source?.wikidata?.property ?? ""}`)
            .join(";");
        if (sig(spans as never) !== sig(stored)) set.spans = spans;
        if (derivedWhen && JSON.stringify(e.when ?? null) !== JSON.stringify(inc.when))
          set.when = inc.when;
      } else if (inc) report.push(`${e.slug}: has curated spans; Wikidata's inception not added`);
    } else {
      const spans = spansFor({ qid: item.qid, kind: e.kind as "inscription" }, item, new Map());
      if (spans.length && !stored.length) set.spans = spans;
      else if (spans.length && !ours)
        report.push(`${e.slug}: has curated spans; Wikidata's not added`);
    }

    // Dated names: replace an undated alias of the same name, or add one; never the entity's own label.
    const names = datedNames(item, e.label, refused).filter((n) => n.label !== e.label);
    if (names.length) {
      const byLabel = new Map(e.aliases.map((a) => [a.label, a]));
      let changed = false;
      for (const n of names) {
        const had = byLabel.get(n.label);
        if (had?.when?.edtf === n.when!.edtf) continue;
        byLabel.set(n.label, {
          ...(had ?? {}),
          ...n,
          note: had?.note ? `${had.note} ${n.note}` : n.note,
        });
        changed = true;
      }
      if (changed) set.aliases = [...byLabel.values()];
    }

    if (Object.keys(set).length) {
      ops.push({
        op: "update_entity",
        entity: e.slug,
        baseVersion: e.version,
        set,
      } as ChangeOpInput);
      report.push(
        `${e.slug} (${item.qid}): ${[
          set.spans
            ? `${(set.spans as EntitySpanInput[]).map((x) => `${x.role} ${(x.when as { edtf: string }).edtf}`).join(", ") || "no span"}`
            : "",
          set.when
            ? `date ${(set.when as { edtf: string; label: string }).edtf} “${(set.when as { label: string }).label}”`
            : "",
          names.length
            ? `names ${names.map((n) => `“${n.label}” ${n.when!.edtf}`).join(", ")}`
            : "",
        ]
          .filter(Boolean)
          .join("; ")}`,
      );
    }
  }
  refused.push(...skipped);
  console.log(report.join("\n") || "Nothing to add.");
  if (refused.length)
    console.log(`Refused or skipped:\n${refused.map((r) => `  ${r}`).join("\n")}`);
  if (!ops.length || flag("dry")) return;

  const p = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      `Adds, from Wikidata (CC0), when ${ops.length} of our places existed and what they were called, so the atlas shows a city from its founding and names it by the year.`,
      "Founding and end come from P571 (inception) and P576 (dissolved). Inception is read as a START: cities and sites get an existence span from it, ending at P576 or else at an unknown end (which counts as the start alone, so nothing is drawn as lasting to today); their date is labelled “from …”. A century-precise inception is too coarse to start a span and is kept only as the date, labelled “begun …”. Inscriptions and objects keep P571 as their date of making. Spans this importer made earlier from P571 are replaced; curated spans are kept. Dated names come from P1448 (official name) in English with P580/P582 qualifiers; undated official names and undated P1813 short names (codes such as “LHR”) are not imported. The same date rules as the other importers apply: century precision or coarser is refused, circa is kept. Places that already had curated spans keep them.",
      `Changes:\n${report.map((r) => `- ${r}`).join("\n")}`,
      refused.length ? `Refused or skipped:\n${refused.map((r) => `- ${r}`).join("\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 10000),
    ops,
  });
  console.log(`Proposed ${p.id}: ${ops.length} ops. Review: ${p.review}`);
  await approveInPreview([p.id]);
});
