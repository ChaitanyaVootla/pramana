/**
 * Proposes entities from Wikidata as a changeset, through MCP (like the seed):
 * identity, labels, descriptions and aliases; reign spans (P39 position held
 * with P580/P582 qualifiers), life spans (P569/P570), polity existence
 * (P571/P576), event spans (P580/P582, P585), construction (P571) and
 * coordinates (P625). Links are made only where Wikidata states the relation:
 *
 *   ruled           P39 position whose P17/P1001 is the polity
 *   successor_of    P1365/P1366 (replaces / replaced by), on P39 or the item
 *   participant_in  P710 participant (and its P4791 commander), P607 conflict
 *   part_of         P361;  located_in  P276/P131
 *   contemporary_of never: Wikidata has no such property
 *
 * Coarse or contradictory dates are skipped and reported, never guessed.
 * Existing entities are matched by QID (or by a declared slug for entities that
 * have none yet) and enriched with update_entity instead of duplicated.
 *
 *   pnpm tsx scripts/import/wikidata-entities.ts [--list maurya] [--dry] [--approve-preview]
 */
import { getWikidataItems, sparqlQids } from "@pramana/connectors";
import { slugify, type ChangeOpInput, type EntityKind } from "@pramana/core";
import { approveInPreview, flag, matchQids, option, withMcp, type Mcp, type Proposal, type WikidataMatch } from "./lib";
import { coordinates, edtfOf, existingLinkKeys, itemOf, linksFor, skipped, spansFor, type Spec } from "./wikidata-lib";

// ---------------------------------------------------------------------------
// Declarative lists
// ---------------------------------------------------------------------------

interface ImportList {
  title: string;
  rationale: string;
  items: Spec[];
  /** SPARQL queries whose ?item results are added with the given kind. */
  queries?: { sparql: string; kind: EntityKind }[];
}

const LISTS: Record<string, ImportList> = {
  maurya: {
    title: "Maurya era from Wikidata: rulers, neighbours, places and inscriptions",
    rationale:
      "Enriches the Maurya era with entities imported from Wikidata (CC0), each with its QID. Reign spans come from P39 (position held) start/end qualifiers, life spans from P569/P570, polity existence from P571/P576, event spans from P580/P582; coordinates from P625. Links are only those Wikidata states (P39 position's country/jurisdiction for 'ruled', P1365/P1366 for succession, P710/P607 for participation). Dates coarser than a century, or contradictory (death before birth, life not containing the reign), were skipped; the list is in the run log. Existing entities that lacked a QID are enriched by update_entity; their curated dates are kept as the primary date, and Wikidata's spans are added alongside with their provenance.",
    items: [
      // Rulers (Mauryan Emperor, Q27582039)
      { qid: "Q188541", kind: "person", existing: "chandragupta-maurya" },
      { qid: "Q315526", kind: "person" }, // Bindusara
      { qid: "Q8589", kind: "person", existing: "ashoka" },
      { qid: "Q538082", kind: "person" }, // Dasaratha
      { qid: "Q12455672", kind: "person" }, // Samprati
      { qid: "Q24405", kind: "person" }, // Brihadratha
      { qid: "Q119973", kind: "person" }, // Pushyamitra Shunga
      { qid: "Q184176", kind: "person" }, // Seleucus I Nicator
      { qid: "Q8409", kind: "person", note: "reference anchor for the period's chronology" },
      { qid: "Q312548", kind: "person", existing: "megasthenes" },
      // Polities
      { qid: "Q949268", kind: "polity" }, // Nanda Empire
      { qid: "Q651377", kind: "polity" }, // Shunga Empire
      { qid: "Q93180", kind: "polity" }, // Seleucid Empire
      { qid: "Q83958", kind: "polity" }, // Macedonia (ancient kingdom)
      // Events
      { qid: "Q7447941", kind: "event" }, // Seleucid–Mauryan War
      { qid: "Q714557", kind: "event", existing: "kalinga-war" },
      // Places and sites
      { qid: "Q156093", kind: "site" }, // Taxila
      { qid: "Q200119", kind: "place" }, // Ujjain
      { qid: "Q181123", kind: "site" }, // Sanchi
      { qid: "Q324394", kind: "place" }, // Sarnath
      { qid: "Q1747217", kind: "place" }, // Girnar
      { qid: "Q3498218", kind: "site" }, // Dhauli
      // Inscriptions
      { qid: "Q27958798", kind: "inscription" }, // Kandahar Bilingual Rock Inscription
      { qid: "Q56064770", kind: "inscription", existing: "kalsi-rock-edicts" },
    ],
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface EntityDetail {
  entity: { id: string; slug: string; wikidataId: string | null; geo: unknown; spans?: { implicit?: boolean }[] };
  links: { type: string; direction: "out" | "in"; other: { id: string } }[];
}

async function getEntity(mcp: Mcp, ref: string): Promise<EntityDetail | null> {
  try {
    return await mcp.call<EntityDetail>("get_entity", { entity: ref });
  } catch {
    return null;
  }
}

const listName = option("list") ?? "maurya";
const list = LISTS[listName];
if (!list) {
  console.error(`unknown list "${listName}"; lists: ${Object.keys(LISTS).join(", ")}`);
  process.exit(1);
}

await withMcp("pramana-import-wikidata", async (mcp) => {
  const specs = [...list.items];
  for (const q of list.queries ?? []) {
    for (const qid of await sparqlQids(q.sparql)) if (!specs.some((s) => s.qid === qid)) specs.push({ qid, kind: q.kind });
  }
  console.log(`Fetching ${specs.length} items from Wikidata…`);
  const items = await getWikidataItems(specs.map((s) => s.qid));
  const positionIds = [...items.values()].flatMap((it) => (it.claims.P39 ?? []).map((s) => itemOf(s.value)).filter((x): x is string => !!x));
  const positions = await getWikidataItems(positionIds);

  // Who already exists (applied or pending)?
  const allLinks = [...items.values()].flatMap((it) => linksFor(it, positions));
  const referenced = [...new Set([...specs.map((s) => s.qid), ...allLinks.flatMap((l) => [l.from, l.to])])];
  const matches = await matchQids(mcp, referenced);

  const ops: ChangeOpInput[] = [];
  const dependsOn = new Set<string>();
  /** QID -> how ops in this changeset refer to the entity. */
  const refOf = new Map<string, string>();
  const existingIds = new Map<string, string>(); // QID -> entity id (for link de-duplication)
  const report: string[] = [];

  const use = (qid: string, m: WikidataMatch) => {
    if (m.status === "existing") {
      refOf.set(qid, m.slug);
      existingIds.set(qid, m.id);
    } else {
      refOf.set(qid, m.id);
      dependsOn.add(m.changesetId);
    }
  };
  for (const [qid, m] of Object.entries(matches)) use(qid, m);

  const taken = new Set<string>();
  for (const spec of specs) {
    const item = items.get(spec.qid);
    if (!item) {
      report.push(`${spec.qid}: not found on Wikidata; skipped`);
      continue;
    }
    const label = item.label ?? spec.qid;
    const spans = spansFor(spec, item, positions);
    const geo = ["place", "site", "inscription", "artifact"].includes(spec.kind) ? coordinates(item) : null;
    const match = matches[spec.qid];

    if (match?.status === "pending") {
      report.push(`${spec.qid} ${label}: already proposed in “${match.changesetTitle}”; this changeset depends on it`);
      continue;
    }
    const existingRef = match?.status === "existing" ? match.slug : spec.existing;
    if (existingRef) {
      const detail = await getEntity(mcp, existingRef);
      if (!detail) {
        report.push(`${spec.qid} ${label}: declared existing entity ${existingRef} not found; skipped`);
        continue;
      }
      const e = detail.entity;
      if (e.wikidataId && e.wikidataId !== spec.qid) {
        report.push(`${spec.qid} ${label}: ${e.slug} already has QID ${e.wikidataId}; not changed`);
        continue;
      }
      refOf.set(spec.qid, e.slug);
      existingIds.set(spec.qid, e.id);
      const set: Record<string, unknown> = {};
      if (!e.wikidataId) set.wikidataId = spec.qid;
      const storedSpans = (e.spans ?? []).filter((s) => !s.implicit);
      if (spans.length && !storedSpans.length) set.spans = spans;
      if (geo && !e.geo) set.geo = geo;
      if (Object.keys(set).length) {
        ops.push({ op: "update_entity", entity: e.slug, set } as ChangeOpInput);
        report.push(`${spec.qid} ${label}: enrich ${e.slug} with ${Object.keys(set).join(", ")}`);
      } else report.push(`${spec.qid} ${label}: ${e.slug} already complete`);
      for (const l of detail.links) {
        // Remember links that already exist, keyed by entity ids.
        existingLinkKeys.add(
          l.direction === "out" ? `${e.id} ${l.type} ${l.other.id}` : `${l.other.id} ${l.type} ${e.id}`,
        );
      }
      continue;
    }

    let slug = slugify(label) || `${spec.kind}-${spec.qid.toLowerCase()}`;
    if (taken.has(slug) || (await getEntity(mcp, slug))) slug = `${slug}-${spec.qid.toLowerCase()}`;
    taken.add(slug);
    const ref = `wd_${spec.qid.toLowerCase()}`;
    refOf.set(spec.qid, `@${ref}`);
    ops.push({
      op: "create_entity",
      ref,
      slug,
      kind: spec.kind,
      label,
      ...(item.description ? { description: item.description } : {}),
      ...(item.aliases.length ? { aliases: item.aliases } : {}),
      ...(spans.length ? { spans } : {}),
      ...(geo ? { geo } : {}),
      wikidataId: spec.qid,
    } as ChangeOpInput);
    report.push(
      `${spec.qid} ${label}: create ${spec.kind} ${slug}${spans.length ? ` (${spans.map((s) => `${s.role} ${edtfOf(s)}`).join(", ")})` : ""}${geo ? " with coordinates" : ""}`,
    );
  }

  // Links, only between entities in this changeset or already known.
  const seen = new Set<string>();
  let linkCount = 0;
  for (const l of allLinks) {
    const from = refOf.get(l.from);
    const to = refOf.get(l.to);
    if (!from || !to || l.from === l.to) continue;
    const key = `${l.from} ${l.type} ${l.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fromId = existingIds.get(l.from);
    const toId = existingIds.get(l.to);
    if (fromId && toId && existingLinkKeys.has(`${fromId} ${l.type} ${toId}`)) continue;
    ops.push({ op: "link_entities", from, to, type: l.type, note: l.note, ...(l.when ? { when: l.when } : {}) });
    linkCount++;
  }
  report.push(`${linkCount} links from Wikidata statements; contemporary_of: none (Wikidata has no such relation)`);

  console.log(report.map((r) => `  ${r}`).join("\n"));
  if (skipped.length) console.log(`Skipped dates (${skipped.length}):\n${skipped.map((s) => `  ${s}`).join("\n")}`);
  if (!ops.length) {
    console.log("Nothing to propose.");
    return;
  }
  if (flag("dry")) {
    console.log(JSON.stringify(ops, null, 1));
    return;
  }
  const rationale = `${list.rationale}\n\nSkipped dates:\n${skipped.length ? skipped.map((s) => `- ${s}`).join("\n") : "- none"}`;
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: list.title,
    rationale: rationale.slice(0, 10000),
    dependsOn: [...dependsOn],
    ops,
  });
  console.log(`Proposed ${proposal.id}: ${proposal.report.outcomes.length} ops. Review: ${proposal.review}`);
  await approveInPreview([proposal.id]);
});
