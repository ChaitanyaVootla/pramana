/**
 * Cliopatria (Seshat Global History Databank) -> proposed historical extents.
 *
 * Reads the polities-only GeoJSON release (CC BY 4.0), keeps POLITY rows that
 * touch South Asia and its neighbours (55–100°E, 0–42°N), clips them to that
 * window, simplifies them (Douglas–Peucker, tolerance chosen per era so a
 * year's map stays within tens of KB), and proposes, through MCP:
 *
 *   1. one changeset with the dataset as a source and new polity entities for
 *      unmatched major neighbours (identity and dates from Wikidata);
 *   2. one changeset of extents per era window (Maurya c. 330–180 BCE, …).
 *
 * Rows are linked to entities by their Wikidata QID when the QID is a polity
 * whose name and dates agree with the row; other rows stay unlinked (named
 * only). Years: Cliopatria's negative years are read as BCE (historical
 * numbering) and converted to astronomical; see cliopatriaYearToAstronomical.
 *
 * New polity entities go in the first changeset; when that one has already
 * been proposed or applied, a later run (another era) proposes its new
 * entities in a changeset of their own ("Polities on the borders maps: …").
 *
 *   pnpm tsx scripts/import/cliopatria.ts [--era maurya,…,colonial] [--dry] [--approve-preview]
 *   pnpm tsx scripts/import/cliopatria.ts --relink [--dry] [--approve-preview]   # apply ROW_QIDS to imported extents
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getWikidataItems, type WikidataItem } from "@pramana/connectors";
import {
  bboxOf,
  clipMultiPolygon,
  cliopatriaYearToAstronomical,
  countPositions,
  extentYearsLabel,
  multiPolygonAreaKm2,
  rewindMultiPolygon,
  roundMultiPolygon,
  simplifyMultiPolygon,
  slugify,
  toAstronomicalYear,
  type BboxTuple,
  type ChangeOpInput,
  type MultiPolygonCoords,
} from "@pramana/core";
import { approveInPreview, flag, matchQids, option, root, withMcp, type Mcp, type Proposal, type WikidataMatch } from "./lib";
import { skipped, spansFor } from "./wikidata-lib";

const FILE = join(root, "data", "cache", "cliopatria", "cliopatria_polities_only_v021.geojson");
const DATASET = "cliopatria-v0.2.1";
const LICENSE = "CC-BY-4.0";
const ATTRIBUTION = "after Cliopatria (Seshat Global History Databank), CC BY 4.0, simplified and clipped";
const WINDOW: BboxTuple = [55, 0, 100, 42];
/** The subcontinent and its rim: a new entity is proposed only for polities mostly inside it. */
const CORE: BboxTuple = [60, 5, 97, 37];
/** Largest geometry payload for any single year of an era (all polities drawn at once). */
const YEAR_BUDGET_BYTES = 60_000;
const TOLERANCES = [0.02, 0.03, 0.05, 0.08, 0.12, 0.18];
/** Clipped area below which a row is a sliver of a polity outside the window. */
const MIN_CLIPPED_KM2 = 2_000;
/** Polities this large (clipped, at their largest in the era) get an entity if they have none. */
const MAJOR_KM2 = 20_000;

/**
 * Cliopatria QIDs that point at a related item rather than the state itself,
 * each checked against the English Wikipedia sitelink of the polity's article.
 */
const QID_FIXES: Record<string, { qid: string; why: string }> = {
  Q705904: {
    qid: "Q93180",
    why: "Cliopatria links 'Seleucid Empire' to Q705904 (Seleucid dynasty); the state is Q93180 (enwiki 'Seleucid Empire')",
  },
};

/**
 * Rows whose QID points at another polity, by the row's name, each checked
 * against the row's own Wikipedia or Seshat field. Applied on import; existing
 * extents are relinked with `--relink` (update_extent).
 */
const ROW_QIDS: Record<string, { qid: string; wrong: string; why: string }> = {
  "Sasanian Empire": {
    qid: "Q83891",
    wrong: "Q1661685",
    why: "Cliopatria gives Q1661685 (Indo-Sassanids, enwiki “Kushano-Sasanian Kingdom”); the row's own Wikipedia field is “Sasanian Empire”, which is Q83891",
  },
  "White Huns": {
    qid: "Q26576",
    wrong: "Q41761342",
    why: "Cliopatria gives Q41761342, a disambiguation page; the row's SeshatID is af_hephthalite_emp (the Hephthalite Empire), which is Q26576 (Hephthalites)",
  },
};

/**
 * English labels that would mislead on a map, replaced by the item's English
 * Wikipedia title (checked on Wikidata).
 */
const LABEL_FIXES: Record<string, { label: string; why: string }> = {
  Q847420: {
    label: "Mamluk dynasty (Delhi)",
    why: "Wikidata labels Q847420 “Mamluk Sultanate”, the usual name of the Egyptian state (Q282428); its enwiki article is “Mamluk dynasty (Delhi)”",
  },
};

/** Wikidata classes accepted as a polity (historical country, empire, kingdom, dynasty, state…). */
const POLITY_CLASSES = new Set([
  "Q3024240", // historical country
  "Q48349", // empire
  "Q417175", // kingdom
  "Q3932025", // Hellenistic kingdom
  "Q164950", // dynasty
  "Q7275", // state
  "Q3624078", // sovereign state
  "Q6256", // country
  "Q1250464", // realm
  "Q50068795", // historical Chinese state
  "Q1336152", // princely state (of British India: Hyderabad, Jammu and Kashmir, …)
]);

interface Era {
  key: string;
  title: string;
  from: number; // astronomical
  to: number;
}
const bce = (y: number) => toAstronomicalYear(y, "BCE");
const ERAS: Era[] = [
  { key: "maurya", title: "Maurya era, c. 330–180 BCE", from: bce(330), to: bce(180) },
  { key: "mahajanapadas", title: "Mahajanapadas and the Achaemenid frontier, c. 600–331 BCE", from: bce(600), to: bce(331) },
  { key: "middle", title: "Middle kingdoms, c. 179 BCE–319 CE", from: bce(179), to: 319 },
  { key: "gupta", title: "Gupta era, c. 320–550 CE", from: 320, to: 550 },
  // The Mughal decline, the Company and the Raj, princely states, independence and partition.
  { key: "colonial", title: "Mughal decline to independence, c. 1700–1950 CE", from: 1700, to: 1950 },
  // After the Guptas: Pallavas, Chalukyas, Rashtrakutas, Palas, Cholas… (rows overlapping the Gupta window stay there).
  { key: "early-medieval", title: "Regional kingdoms, c. 551–1205 CE", from: 551, to: 1205 },
  // The Delhi Sultanate to the Mughals: Vijayanagara, the Bahmani and Deccan sultanates, the Rajput states.
  { key: "sultanates", title: "Sultanates, Vijayanagara and the Mughals, c. 1206–1699 CE", from: 1206, to: 1699 },
  // Cliopatria draws the Indus civilisation as one POLITY; it is linked to our culture entity
  // and drawn as a culture area (whether it was one state is itself debated).
  { key: "indus", title: "Indus civilisation, c. 3000–1701 BCE (as a culture area)", from: bce(3000), to: bce(1701) },
];

interface Row {
  name: string;
  cFrom: number;
  cTo: number;
  from: number;
  to: number;
  area: number;
  qid: string | null;
  seshat: string | null;
  wikipedia: string | null;
  coords: MultiPolygonCoords;
}

function loadRows(): Row[] {
  console.log("Reading Cliopatria…");
  const fc = JSON.parse(readFileSync(FILE, "utf8")) as {
    features: {
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: unknown } | null;
    }[];
  };
  const rows: Row[] = [];
  for (const f of fc.features) {
    const p = f.properties;
    const name = String(p.Name ?? "");
    // RELATION rows describe allegiances; "(…)" rows are unions of their member polities.
    if (p.Type !== "POLITY" || !name || name.startsWith("(") || !f.geometry) continue;
    const coords =
      f.geometry.type === "Polygon"
        ? [f.geometry.coordinates as MultiPolygonCoords[number]]
        : f.geometry.type === "MultiPolygon"
          ? (f.geometry.coordinates as MultiPolygonCoords)
          : null;
    if (!coords) continue;
    const box = bboxOf(coords);
    if (!box || box[2] < WINDOW[0] || box[0] > WINDOW[2] || box[3] < WINDOW[1] || box[1] > WINDOW[3]) continue;
    const cFrom = Number(p.FromYear);
    const cTo = Number(p.ToYear);
    rows.push({
      name,
      cFrom,
      cTo,
      from: cliopatriaYearToAstronomical(cFrom),
      to: cliopatriaYearToAstronomical(cTo),
      area: Number(p.Area) || 0,
      qid:
        ROW_QIDS[name]?.qid ??
        (typeof p.Wikidata === "string" && /^Q\d+$/.test(p.Wikidata) ? p.Wikidata : null),
      seshat: typeof p.SeshatID === "string" && p.SeshatID ? p.SeshatID : null,
      wikipedia: typeof p.Wikipedia === "string" && p.Wikipedia ? p.Wikipedia : null,
      coords,
    });
  }
  return rows;
}

interface Prepared extends Row {
  geometry: MultiPolygonCoords;
  clippedKm2: number;
  clipped: boolean;
  bytes: number;
}

function prepare(row: Row, tolerance: number): Prepared | null {
  const clippedCoords = clipMultiPolygon(row.coords, WINDOW);
  const clipped = JSON.stringify(clippedCoords).length !== JSON.stringify(row.coords).length;
  const simplified = roundMultiPolygon(simplifyMultiPolygon(clippedCoords, tolerance), 3);
  if (!simplified.length) return null;
  const geometry = rewindMultiPolygon(simplified);
  const clippedKm2 = multiPolygonAreaKm2(geometry);
  if (clippedKm2 < MIN_CLIPPED_KM2) return null;
  return { ...row, geometry, clippedKm2, clipped, bytes: JSON.stringify(geometry).length };
}

/** The largest single-year payload of an era (sampled at every row boundary). */
function worstYear(rows: Prepared[], era: Era): { year: number; bytes: number } {
  let worst = { year: era.from, bytes: 0 };
  const years = new Set(rows.flatMap((r) => [Math.max(r.from, era.from), Math.min(r.to, era.to)]));
  for (const y of years) {
    const bytes = rows.filter((r) => r.from <= y && r.to >= y).reduce((n, r) => n + r.bytes, 0);
    if (bytes > worst.bytes) worst = { year: y, bytes };
  }
  return worst;
}

// ---------------------------------------------------------------------------
// Entity matching
// ---------------------------------------------------------------------------

const significant = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 3 && !["empire", "kingdom", "kingdoms", "dynasty", "early", "state", "states", "the", "janapada"].includes(w));

/** Loose name agreement: a shared significant word (first four letters), ignoring accents and case. */
function namesAgree(a: string, b: string): boolean {
  const x = significant(a);
  const y = significant(b);
  return x.some((p) => y.some((q) => p.slice(0, 4) === q.slice(0, 4)));
}

function wikidataYears(item: WikidataItem): [number, number] | null {
  const year = (pid: string) => {
    const v = item.claims[pid]?.[0]?.value;
    if (v?.type !== "time") return null;
    const m = /^([+-])(\d+)/.exec(v.time);
    return m ? Number(m[2]) * (m[1] === "-" ? -1 : 1) : null;
  };
  const s = year("P571") ?? year("P580");
  const e = year("P576") ?? year("P582");
  return s !== null && e !== null ? [s, e] : null;
}

/** Why a Cliopatria QID cannot stand for the row's polity, or null if it can. */
function rejectQid(item: WikidataItem | undefined, rows: Row[]): string | null {
  if (!item) return "not found on Wikidata";
  const classes = (item.claims.P31 ?? []).map((s) => (s.value.type === "item" ? s.value.id : ""));
  if (classes.includes("Q4167410")) return "is a disambiguation page";
  if (!classes.some((c) => POLITY_CLASSES.has(c))) return `is not a polity (instance of ${classes.join(", ") || "nothing"})`;
  const name = rows[0]!.name;
  const sameArticle = rows.some((r) => r.wikipedia && item.enwiki && r.wikipedia === item.enwiki);
  if (!sameArticle && !namesAgree(name, item.label ?? "")) return `is “${item.label}”, not “${name}”`;
  const years = wikidataYears(item);
  const lo = Math.min(...rows.map((r) => r.cFrom));
  const hi = Math.max(...rows.map((r) => r.cTo));
  if (years && (years[1] < lo - 100 || years[0] > hi + 100))
    return `Wikidata dates (${years[0]}..${years[1]}) do not overlap Cliopatria's (${lo}..${hi})`;
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// --relink: correct the entity of extents already imported (ROW_QIDS)
// ---------------------------------------------------------------------------

if (flag("relink")) {
  await withMcp("pramana-import-cliopatria-relink", async (mcp: Mcp) => {
    const title = `Borders: corrected links (${Object.keys(ROW_QIDS).join(", ")})`;
    const open = (await mcp.call<{ title: string; status: string }[]>("list_changesets", { limit: 200 })).some(
      (c) => c.title === title && c.status === "proposed",
    );
    if (open) {
      console.log(`“${title}” is already waiting for review. Nothing to do.`);
      return;
    }
    const fixes = Object.values(ROW_QIDS);
    const matches = await matchQids(mcp, [...fixes.map((f) => f.qid), ...fixes.map((f) => f.wrong)]);
    // Read-only listing of the extents to correct; the edits go through MCP.
    const { extentsBetween } = await import("@pramana/services");
    const all = await extentsBetween(-10000, 3000, { dataset: DATASET, geometry: false, limit: 5000 });
    const ops: ChangeOpInput[] = [];
    const lines: string[] = [];
    for (const [name, fix] of Object.entries(ROW_QIDS)) {
      const m = matches[fix.qid];
      if (m?.status !== "existing") {
        console.log(`${name}: no entity for ${fix.qid} yet${m?.status === "pending" ? ` (pending in “${m.changesetTitle}”)` : ""}; re-run once it exists.`);
        continue;
      }
      // Only rows still unlinked or linked to the known-wrong QID: a link made
      // since (a reviewed update_extent, e.g. a content page's) is authoritative.
      const wrongId = matches[fix.wrong]?.status === "existing" ? matches[fix.wrong]!.id : null;
      const wrong = all.filter((e) => e.name === name && (e.entity === null || e.entity.id === wrongId));
      const kept = all.filter((e) => e.name === name && e.entity && e.entity.id !== wrongId && e.entity.id !== m.id);
      if (kept.length) console.log(`${name}: ${kept.length} extents linked elsewhere since (e.g. ${kept[0]!.entity!.slug}); left as they are.`);
      for (const e of wrong)
        ops.push({ op: "update_extent", extent: e.id, baseVersion: e.version, set: { entity: m.id } } as ChangeOpInput);
      if (wrong.length)
        lines.push(`- ${name}: ${wrong.length} extents (${extentYearsLabel(Math.min(...wrong.map((e) => e.fromYear)), Math.max(...wrong.map((e) => e.toYear)))}) relinked from ${[...new Set(wrong.map((e) => e.entity?.slug ?? "nothing"))].join(", ")} to ${m.slug}. ${fix.why}.`);
    }
    console.log(lines.join("\n") || "Nothing to relink.");
    if (!ops.length || flag("dry")) return;
    const p = await mcp.call<Proposal>("propose_changes", {
      title,
      rationale: `Corrects which entity some Cliopatria extents belong to. Each correction was checked against the row's own Wikipedia or Seshat field:\n\n${lines.join("\n")}\n\nOnly the link changes; geometry, years and attribution stay as imported.`,
      ops,
    });
    console.log(`Proposed ${p.id}: ${ops.length} relinks. Review: ${p.review}`);
    await approveInPreview([p.id]);
  });
  process.exit(process.exitCode ?? 0);
}

const wanted = (option("era") ?? ERAS.map((e) => e.key).join(",")).split(",");
const eras = ERAS.filter((e) => wanted.includes(e.key));

const allRows = loadRows();
console.log(`${allRows.length} POLITY rows touch the window.`);

// Each row goes to the first era (in ERAS order, whichever are run) it overlaps,
// so no row is proposed twice and a row's era never depends on the --era list.
const assigned = new Map<Era, Row[]>();
const taken = new Set<Row>();
for (const era of ERAS) {
  const rows = allRows.filter((r) => !taken.has(r) && r.from <= era.to && r.to >= era.from);
  rows.forEach((r) => taken.add(r));
  assigned.set(era, rows);
}

// Choose a tolerance per era.
const prepared = new Map<Era, { tolerance: number; rows: Prepared[]; dropped: string[] }>();
for (const era of eras) {
  const rows = assigned.get(era)!;
  let choice: { tolerance: number; rows: Prepared[]; dropped: string[] } | null = null;
  for (const tolerance of TOLERANCES) {
    const dropped: string[] = [];
    const out: Prepared[] = [];
    for (const r of rows) {
      const p = prepare(r, tolerance);
      if (p) out.push(p);
      else dropped.push(`${r.name} ${r.cFrom}..${r.cTo}`);
    }
    choice = { tolerance, rows: out, dropped };
    if (worstYear(out, era).bytes <= YEAR_BUDGET_BYTES) break;
  }
  prepared.set(era, choice!);
  const worst = worstYear(choice!.rows, era);
  const total = choice!.rows.reduce((n, r) => n + r.bytes, 0);
  console.log(
    `${era.title}: ${choice!.rows.length} extents, tolerance ${choice!.tolerance}°, ${Math.round(total / 1024)} KB in all, busiest year ${extentYearsLabel(worst.year, worst.year)} ${Math.round(worst.bytes / 1024)} KB; ${choice!.dropped.length} slivers dropped`,
  );
}

await withMcp("pramana-import-cliopatria", async (mcp: Mcp) => {
  const existingTitles = (
    await mcp.call<{ title: string; status: string }[]>("list_changesets", { limit: 200 })
  )
    .filter((c) => c.status === "proposed" || c.status === "applied")
    .map((c) => c.title);

  // QIDs to link, after fixes and checks.
  const rowsByQid = new Map<string, Prepared[]>();
  for (const { rows } of prepared.values())
    for (const r of rows) {
      if (!r.qid) continue;
      const qid = QID_FIXES[r.qid]?.qid ?? r.qid;
      rowsByQid.set(qid, [...(rowsByQid.get(qid) ?? []), r]);
    }
  const items = await getWikidataItems([...rowsByQid.keys()]);
  const matches = await matchQids(mcp, [...rowsByQid.keys()]);
  const rejected: string[] = [];
  // A row dated well outside the polity's Wikidata dates is not linked (e.g. "Ptolemaic Kingdom" in 326 BCE).
  const unlinkedRows = new Set<Row>();
  for (const [qid, rows] of rowsByQid) {
    const years = items.get(qid) ? wikidataYears(items.get(qid)!) : null;
    if (!years) continue;
    const ok = rows.filter((r) => !(r.cTo < years[0] - 50 || r.cFrom > years[1] + 50));
    for (const r of rows.filter((x) => !ok.includes(x))) {
      unlinkedRows.add(r);
      rejected.push(`${r.name} ${r.cFrom}..${r.cTo}: outside the polity's Wikidata dates (${years[0]}..${years[1]}); this row left unlinked`);
    }
    if (ok.length) rowsByQid.set(qid, ok);
    else rowsByQid.delete(qid);
  }
  const linkable = new Set<string>();
  for (const [qid, rows] of rowsByQid) {
    // An entity we already have under this QID is trusted if it is a polity; otherwise check the QID.
    const m = matches[qid];
    // Cultures are linked too (the Indus civilisation): the atlas draws them as culture areas, not states.
    const why = m
      ? m.kind === "polity" || m.kind === "group" || m.kind === "culture"
        ? null
        : `belongs to ${m.slug ?? m.label}, a ${m.kind}, not a polity`
      : rejectQid(items.get(qid), rows);
    if (why) rejected.push(`${rows[0]!.name} (${rows[0]!.qid}): QID ${why}; extents left unlinked`);
    else linkable.add(qid);
  }

  // ---- changeset 1: the dataset source and new polity entities
  const baseTitle = "Cliopatria dataset and neighbouring polities";
  const baseExists = existingTitles.includes(baseTitle);
  // Entities for these eras, when the dataset's own changeset is already decided or pending.
  const entitiesTitle = `Polities on the borders maps: ${eras.map((e) => e.title).join("; ")}`;
  const entitiesExist = existingTitles.includes(entitiesTitle);
  const dependsOn = new Set<string>();
  const refOf = new Map<string, string>();
  const use = (qid: string, m: WikidataMatch) => {
    refOf.set(qid, m.status === "existing" ? m.slug : m.id);
    if (m.status === "pending") dependsOn.add(m.changesetId);
  };
  for (const [qid, m] of Object.entries(matches)) if (linkable.has(qid)) use(qid, m);

  const baseOps: ChangeOpInput[] = [];
  let sourceRef: string | null = null;
  let baseId: string | null = null;
  if (baseExists) {
    console.log(`“${baseTitle}” already proposed or applied; reusing it.`);
    const list = await mcp.call<{ id: string; title: string; status: string }[]>("list_changesets", { limit: 200 });
    const base = list.find((c) => c.title === baseTitle && (c.status === "proposed" || c.status === "applied"))!;
    const detail = await mcp.call<{ id: string; status: string; ops: { op: string; id?: string; wikidataId?: string }[] }>(
      "get_changeset",
      { id: base.id },
    );
    sourceRef = detail.ops.find((o) => o.op === "create_source")?.id ?? null;
    if (detail.status === "proposed") baseId = detail.id;
  } else {
    baseOps.push({
      op: "create_source",
      ref: "cliopatria",
      kind: "dataset",
      tier: "secondary",
      csl: {
        type: "dataset",
        title: "Cliopatria: polities only",
        author: [{ literal: "Seshat Global History Databank" }],
        version: "0.2.1",
        issued: { "date-parts": [[2026, 10, 3]] },
        publisher: "Seshat Global History Databank",
        URL: "https://github.com/Seshat-Global-History-Databank/cliopatria",
      },
      identifiers: { url: "https://github.com/Seshat-Global-History-Databank/cliopatria" },
      license: {
        status: "open",
        spdx: LICENSE,
        note: "CC BY 4.0 per the repository's LICENSE.md: credit the authors and the source, link the licence, and indicate changes. Our extents are clipped and simplified.",
      },
      note: "Geospatial dataset of polities from 3400 BCE to 2024 CE (release v0.2.1, 3 Oct 2026). Described in Bennett et al., “Cliopatria - A geospatial database of world-wide political entities from 3400BCE to 2024CE”, Scientific Data 12, 247 (2025), doi:10.1038/s41597-025-04516-9. Borders are reconstructions at map scale; the maintainers note that they reflect one version of contested territories.",
    } as ChangeOpInput);
    sourceRef = "@cliopatria";
  }

  // New polity entities for major unmatched neighbours.
  const proposedEntities: string[] = [];
  for (const qid of linkable) {
    if (refOf.has(qid)) continue;
    const rows = rowsByQid.get(qid)!;
    const largest = rows.reduce((a, r) => (r.clippedKm2 > a.clippedKm2 ? r : a));
    if (largest.clippedKm2 < MAJOR_KM2) {
      rejected.push(`${rows[0]!.name} (${qid}): smaller than ${MAJOR_KM2.toLocaleString()} km² in the window; no entity proposed, extents left unlinked`);
      continue;
    }
    const inCore = multiPolygonAreaKm2(clipMultiPolygon(largest.geometry, CORE)) / largest.clippedKm2;
    if (inCore < 0.3) {
      rejected.push(`${rows[0]!.name} (${qid}): mostly outside South Asia (${Math.round(inCore * 100)}% inside ${CORE.join(",")}); no entity proposed, extents left unlinked`);
      continue;
    }
    if (baseExists && entitiesExist) {
      rejected.push(`${rows[0]!.name} (${qid}): no entity yet; re-run after “${entitiesTitle}” is decided to link it`);
      continue;
    }
    const item = items.get(qid)!;
    const label = LABEL_FIXES[qid]?.label ?? item.label ?? rows[0]!.name;
    const ref = `cp_${qid.toLowerCase()}`;
    let slug = slugify(label);
    try {
      await mcp.call("get_entity", { entity: slug });
      slug = `${slug}-${qid.toLowerCase()}`;
    } catch {
      // free
    }
    const spans = spansFor({ qid, kind: "polity" }, item, new Map());
    const seshat = rows.find((r) => r.seshat)?.seshat;
    baseOps.push({
      op: "create_entity",
      ref,
      slug,
      kind: "polity",
      label,
      ...(item.description ? { description: item.description } : {}),
      ...(item.aliases.length ? { aliases: item.aliases } : {}),
      ...(spans.length ? { spans } : {}),
      wikidataId: qid,
      ...(seshat ? { externalIds: { seshat } } : {}),
    } as ChangeOpInput);
    refOf.set(qid, `@${ref}`);
    proposedEntities.push(`${label} (${qid})${LABEL_FIXES[qid] ? `, labelled so because ${LABEL_FIXES[qid]!.why}` : ""}`);
  }

  const proposals: string[] = [];
  const summary: string[] = [];
  if (baseOps.length && !flag("dry")) {
    const p = await mcp.call<Proposal>("propose_changes", {
      title: baseExists ? entitiesTitle : baseTitle,
      rationale: `${baseExists ? "Adds" : "Adds the Cliopatria dataset (Seshat Global History Databank, CC BY 4.0) as a source, so historical extents can cite it, and"} polity entities for states that appear on the South Asia maps but had no entity: ${proposedEntities.join(", ") || "none"}. Their identity, names and dates come from Wikidata (QIDs as Cliopatria gives them, checked to be polities whose name and dates agree with the dataset).${skipped.length ? `\n\nSkipped Wikidata dates:\n${skipped.map((s) => `- ${s}`).join("\n")}` : ""}`,
      dependsOn: [...dependsOn],
      ops: baseOps,
    });
    baseId = p.id;
    sourceRef = p.refs.cliopatria ?? sourceRef;
    for (const [qid, ref] of refOf) if (ref.startsWith("@")) refOf.set(qid, p.refs[ref.slice(1)]!);
    proposals.push(p.id);
    summary.push(`${p.id} “${baseExists ? entitiesTitle : baseTitle}”: ${baseOps.length} ops`);
  } else if (flag("dry")) {
    console.log(`[dry] ${baseExists ? entitiesTitle : baseTitle}: ${baseOps.length} ops; new entities: ${proposedEntities.join(", ")}`);
  }
  if (baseId) dependsOn.add(baseId);

  // ---- one changeset per era
  for (const era of eras) {
    const title = `Borders: ${era.title} (Cliopatria)`;
    if (existingTitles.includes(title)) {
      console.log(`“${title}” already proposed or applied; skipped.`);
      continue;
    }
    const { tolerance, rows, dropped } = prepared.get(era)!;
    const ops: ChangeOpInput[] = rows.map((r) => {
      const qid = r.qid ? (QID_FIXES[r.qid]?.qid ?? r.qid) : null;
      const entity = qid && linkable.has(qid) && !unlinkedRows.has(r) ? refOf.get(qid) : undefined;
      const notes = [
        `Cliopatria row ${r.name} ${r.cFrom}..${r.cTo} (read as ${extentYearsLabel(r.from, r.to)}).`,
        r.clipped ? `Clipped to ${WINDOW[0]}–${WINDOW[2]}°E, ${WINDOW[1]}–${WINDOW[3]}°N.` : null,
        `Simplified with Douglas–Peucker at ${tolerance}°, coordinates rounded to 0.001°.`,
        r.qid && QID_FIXES[r.qid] ? QID_FIXES[r.qid]!.why + "." : null,
        ROW_QIDS[r.name] ? ROW_QIDS[r.name]!.why + "." : null,
        "Area is Cliopatria's, for the whole unclipped polygon.",
        qid && matches[qid]?.kind === "culture"
          ? "Linked to a culture, not a state: Cliopatria records it as a polity; the atlas draws it as a culture area."
          : null,
      ].filter(Boolean);
      return {
        op: "create_extent",
        ...(entity ? { entity } : {}),
        name: r.name,
        fromYear: r.from,
        toYear: r.to,
        geometry: { type: "MultiPolygon", coordinates: r.geometry },
        areaKm2: Math.round(r.area),
        dataset: DATASET,
        datasetRef: [r.seshat ? `SeshatID ${r.seshat}` : null, r.qid ? `Wikidata ${r.qid}` : null, r.wikipedia ? `Wikipedia "${r.wikipedia}"` : null]
          .filter(Boolean)
          .join("; ") || undefined,
        certainty: "reconstruction",
        license: LICENSE,
        attribution: ATTRIBUTION,
        ...(sourceRef ? { source: sourceRef } : {}),
        note: notes.join(" "),
      } as ChangeOpInput;
    });
    const linked = ops.filter((o) => (o as { entity?: string }).entity).length;
    const bytes = JSON.stringify(ops).length;
    const worst = worstYear(rows, era);
    if (flag("dry")) {
      console.log(`[dry] ${title}: ${ops.length} extents (${linked} linked), ${Math.round(bytes / 1024)} KB`);
      continue;
    }
    const names = [...new Set(rows.map((r) => r.name))];
    const p = await mcp.call<Proposal>("propose_changes", {
      title,
      rationale: `Historical extents for ${extentYearsLabel(era.from, era.to)} from Cliopatria v0.2.1 (Seshat Global History Databank, CC BY 4.0; attribution: “${ATTRIBUTION}”). ${ops.length} time slices of ${names.length} polities that touch ${WINDOW[0]}–${WINDOW[2]}°E, ${WINDOW[1]}–${WINDOW[3]}°N: ${names.join(", ")}.\n\nChanges made: clipped to that window; simplified with Douglas–Peucker at ${tolerance}° (the busiest year, ${extentYearsLabel(worst.year, worst.year)}, is ${Math.round(worst.bytes / 1024)} KB of geometry); coordinates rounded to 0.001°; ${dropped.length} slivers under ${MIN_CLIPPED_KM2.toLocaleString()} km² after clipping dropped. Aggregate "(…)" rows and RELATION rows are not imported.\n\nYears: Cliopatria's negative years are read as BCE in historical numbering (its README: "negative for BCE"), so -318 is 318 BCE, stored as astronomical -317; ranges are inclusive. Cliopatria also uses year 0 to close BCE ranges, which we store as 1 BCE. If the dataset is actually astronomical, BCE boundaries are one year early.\n\nLinks: ${linked} of ${ops.length} extents are linked to an entity by Wikidata QID.${rejected.length ? `\n\nNot linked:\n${rejected.map((r) => `- ${r}`).join("\n")}` : ""}`.slice(0, 10000),
      dependsOn: [...dependsOn],
      ops,
    });
    proposals.push(p.id);
    summary.push(`${p.id} “${title}”: ${ops.length} extents (${linked} linked), ${Math.round(bytes / 1024)} KB`);
  }

  if (rejected.length) console.log(`Not linked:\n${rejected.map((r) => `  ${r}`).join("\n")}`);
  if (summary.length) console.log(`Proposed:\n${summary.map((s) => `  ${s}`).join("\n")}`);
  await approveInPreview(proposals);
});
