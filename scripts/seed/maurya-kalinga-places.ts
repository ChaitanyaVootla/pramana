/**
 * Fixes the places of two Maurya page chapters that named only the Kālsī rock
 * edicts, about 1,500 km from Kalinga. Kālsī is merely where the quoted copy
 * of Rock Edict XIII was carved, and the quotes' captions already say so.
 *
 * - "The war in Kalinga" (ch-kalinga) now names Kalinga itself and the two
 *   sites of Aśoka's separate Kalinga edicts, Dhauli and Jaugada.
 * - "The empire and the Greek world" (ch-greek) now names the Kandahar
 *   bilingual inscription, Aśoka's edict in Greek and Aramaic, since the
 *   Greek-world tie is the chapter's point.
 *
 * Proposed THROUGH MCP. Idempotent: entities are matched by QID (applied or
 * pending) or slug before any is created; the page is re-read just before
 * proposing, so edits by other agents are kept and the base version is fresh;
 * chapters that already have the right places are left alone.
 *
 *   pnpm tsx scripts/seed/maurya-kalinga-places.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { BlockInput, ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";

const TITLE = "Maurya Empire page: the right places for the Kalinga and Greek-world chapters";
const PAGE = "maurya-empire";

interface Spec {
  ref: string;
  slug: string;
  kind: "place" | "site" | "inscription";
  label: string;
  qid: string;
  description: string;
  certainty: "exact" | "approximate";
  geoNote?: string;
  aliases?: { label: string; lang?: string; note?: string }[];
}

const SPECS: Spec[] = [
  {
    ref: "kalinga",
    slug: "kalinga",
    kind: "place",
    label: "Kalinga",
    qid: "Q1150706",
    description: "The historical region on the east coast, in present-day Odisha and northern Andhra Pradesh, which Aśoka conquered in the eighth year after his consecration.",
    certainty: "approximate",
    geoNote: "A single point from Wikidata Q1150706 standing for a whole region; it marks roughly where Kalinga was, not a place in it.",
    aliases: [{ label: "Kaliṅga", lang: "sa-Latn" }],
  },
  {
    ref: "dhauli",
    slug: "dhauli",
    kind: "site",
    label: "Dhauli",
    qid: "Q3498218",
    description: "Hill near Bhubaneswar in Odisha carrying a version of Aśoka's rock edicts with the separate Kalinga edicts.",
    certainty: "exact",
  },
  {
    ref: "jaugada",
    slug: "jaugada",
    kind: "site",
    label: "Jaugada",
    qid: "Q11927218",
    description: "Ruined fort in Ganjam district, Odisha, where a version of Aśoka's rock edicts includes the separate Kalinga edicts.",
    certainty: "exact",
  },
  {
    ref: "kandahar",
    slug: "kandahar-bilingual-rock-inscription",
    kind: "inscription",
    label: "Kandahar Bilingual Rock Inscription",
    qid: "Q27958798",
    description: "Aśoka's edict at Kandahar in Afghanistan, written in Greek and Aramaic.",
    certainty: "exact",
  },
];

/** Chapter id → the entity refs (from SPECS) that should be its places, in order. */
const CHAPTERS: Record<string, string[]> = {
  "ch-kalinga": ["kalinga", "dhauli", "jaugada"],
  "ch-greek": ["kandahar"],
};

interface WdMatch {
  status: "existing" | "pending";
  id: string;
  slug: string | null;
  changesetId?: string;
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }

  const ops: ChangeOpInput[] = [];
  const dependsOn = new Set<string>();
  const refOf: Record<string, string> = {};
  const matches = await mcp.call<Record<string, WdMatch>>("entities_by_wikidata", { qids: SPECS.map((s) => s.qid) });
  for (const s of SPECS) {
    const m = matches[s.qid];
    if (m) {
      refOf[s.ref] = m.slug ?? m.id;
      if (m.status === "pending" && m.changesetId) dependsOn.add(m.changesetId);
      console.log(`  reusing ${s.slug} → ${m.status} ${m.slug ?? m.id}`);
      continue;
    }
    const bySlug = await mcp.call<{ entity?: { id: string } } | null>("get_entity", { entity: s.slug }).catch(() => null);
    if (bySlug?.entity?.id) {
      refOf[s.ref] = s.slug;
      console.log(`  reusing ${s.slug} (by slug)`);
      continue;
    }
    const wd = await mcp.call<{ coordinates: { lat: number; lon: number } | null } | null>("wikidata", { qid: s.qid });
    ops.push({
      op: "create_entity",
      ref: s.ref,
      slug: s.slug,
      kind: s.kind,
      label: s.label,
      description: s.description,
      ...(s.aliases ? { aliases: s.aliases } : {}),
      wikidataId: s.qid,
      ...(wd?.coordinates
        ? {
            geo: {
              geometry: { type: "Point", coordinates: [wd.coordinates.lon, wd.coordinates.lat] },
              certainty: s.certainty,
              note: s.geoNote ?? `Coordinates from Wikidata ${s.qid}.`,
            },
          }
        : {}),
    } as ChangeOpInput);
    refOf[s.ref] = `@${s.ref}`;
    console.log(`  creating ${s.slug}${wd?.coordinates ? " with coordinates" : " (no coordinates on Wikidata)"}`);
  }
  const slugOfSpec = Object.fromEntries(SPECS.map((s) => [s.ref, s.slug]));

  // Re-read the page now: other agents edit its blocks too.
  const view = await mcp.call<{ page: { version: number; blocks: BlockInput[] }; entities: Record<string, { slug: string | null }> }>("get_page", {
    page: PAGE,
    format: "json",
  });
  const slugOf = (r: string) => view.entities[r]?.slug ?? r;
  const changed: string[] = [];
  const blocks = view.page.blocks.map((b) => {
    const wanted = b.type === "chapter" ? CHAPTERS[b.id] : undefined;
    if (!wanted || b.type !== "chapter") return b;
    const current = (b.places ?? []).map(slugOf);
    const wantedSlugs = wanted.map((r) => slugOfSpec[r]!);
    if (current.length === wantedSlugs.length && wantedSlugs.every((w, i) => current[i] === w)) return b;
    changed.push(b.id);
    return { ...b, places: wanted.map((r) => refOf[r]!) };
  });
  for (const id of Object.keys(CHAPTERS))
    if (!view.page.blocks.some((b) => b.id === id && b.type === "chapter")) throw new Error(`no chapter block “${id}” on ${PAGE}`);
  if (!changed.length) {
    console.log("Both chapters already have the right places. Nothing to do.");
    process.exit(0);
  }
  // Only the two chapter blocks, each guarded by its own fingerprint.
  const pageOp = pagePatchOp(PAGE, view.page.blocks, blocks);
  if (pageOp) ops.push(pageOp);

  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Two chapters named only the Kālsī rock edicts as their place. Kālsī is in present-day Uttarakhand, about 1,500 km from Kalinga, and is just where the quoted copy of Rock Edict XIII was carved; the quotes' captions already say so.",
      "- The war in Kalinga: Kalinga (the region, Wikidata Q1150706) and the two sites of the separate Kalinga edicts, Dhauli (Q3498218) and Jaugada (Q11927218).",
      "- The empire and the Greek world: the Kandahar bilingual inscription (Q27958798), Aśoka's edict in Greek and Aramaic.",
      `Changed chapters: ${changed.join(", ")}. Entities that already exist or are pending are reused, matched by QID or slug. Coordinates come from Wikidata only; Kalinga's point stands for a region and is marked approximate.`,
      `Only those chapters' places change; the rest of the page is kept as it was at version ${view.page.version}.`,
    ].join("\n"),
    dependsOn: [...dependsOn],
    ops,
  });
  summarize("maurya places", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
