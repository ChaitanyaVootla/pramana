/**
 * "Drought, famine and everyday life across the ages": one theme page whose
 * spine is a `tracks` block (facets of life × ages), assembled from the cells
 * the three period scripts export. Each cell rests on claims those scripts
 * applied, looked up on the database this runs against. The page links the
 * three period pages for the full story.
 *
 *   pnpm tsx scripts/seed/famine-across-ages.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Idempotent: once the page exists, it proposes only a patch for blocks that
 * changed (new or reworded cells), and nothing when all is current.
 */
import { pagePatchFrom, type BlockInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { famineCells as earlyCells } from "./famine-early-cells";
import { famineCells as medievalCells } from "./famine-medieval-cells";
import { famineCells as britishCells } from "./famine-british-cells";

export const PAGE_SLUG = "drought-and-famine-across-the-ages";
const TITLE = "Drought, famine and everyday life across the ages";

/** The spine's ages, in time order (overview page). */
const AGES = [
  "early-farming-communities",
  "harappan-civilisation",
  "vedic-period",
  "mahajanapadas",
  "maurya-empire",
  "middle-kingdoms",
  "gupta-empire",
  "early-medieval-india",
  "delhi-sultanate",
  "vijayanagara-empire",
  "mughal-empire",
  "maratha-confederacy",
  "company-rule",
  "british-raj",
  "independent-india",
];

const FACETS = [
  { key: "food", label: "What people ate", description: "Ordinary meals in ordinary years." },
  { key: "water", label: "Water", description: "Rain, rivers, wells, tanks and canals." },
  { key: "work", label: "Making a living", description: "Fields, wages, crafts and herds." },
  { key: "failure", label: "When the rains failed", description: "What went first, and what famine looked like." },
  { key: "coping", label: "How people coped", description: "What people did to survive." },
  { key: "rulers", label: "What rulers did", description: "Relief, remission, grain stores, or the lack of them." },
  { key: "toll", label: "The toll", description: "Deaths, disease, flight, and what was destroyed." },
  { key: "after", label: "Afterwards", description: "How life changed, and how it was remembered." },
] as const;

const PERIOD_PAGES = [
  { slug: "drought-and-famine-in-early-india", label: "before 1206" },
  { slug: "famine-and-war-in-medieval-india", label: "from 1206 to 1757" },
  { slug: "the-famines-of-british-india", label: "under the Company and the Raj" },
];

type Cell = { facet: string; age: string; text: string; claimIds: string[]; excerptId?: string };

function blocks(cells: Cell[], periodSlugs: Set<string>): BlockInput[] {
  const used = new Set(cells.map((c) => c.age));
  const ages = AGES.filter((a) => used.has(a)).map((entity) => ({ entity }));
  const unknown = [...used].filter((a) => !AGES.includes(a));
  if (unknown.length) throw new Error(`cells name ages not on the spine: ${unknown.join(", ")}`);
  const links = PERIOD_PAGES.filter((p) => periodSlugs.has(p.slug))
    .map((p) => `[${p.label}](page:${p.slug})`)
    .join(", ");
  return [
    {
      id: "intro",
      type: "prose",
      markdown: [
        "This page follows ordinary life through food, water and work, and what drought and famine did to it, from the first farming villages to independent India.",
        "Read a row across to see one part of life change over time, or a column down to see one age whole. Every line rests on the evidence it links to; where the sources say nothing, the cell is left empty.",
        links ? `The full story, with the first-hand accounts, is on three pages: ${links}.` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    {
      id: "tracks",
      type: "tracks",
      title: "Across the ages",
      facets: FACETS.map((f) => ({ ...f })),
      ages,
      cells: cells
        .slice()
        .sort((a, b) => AGES.indexOf(a.age) - AGES.indexOf(b.age))
        .map((c) => ({ ...c })),
    } as BlockInput,
  ];
}

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (!flags.force && (await pendingTitles(mcp)).some((t) => t.startsWith(TITLE))) {
    console.log("A changeset for this page is already waiting for review. Nothing to do.");
    process.exit(0);
  }
  // Periods overlap at their edges (the early medieval age, the Marathas): one
  // cell per facet and age, from the period whose page is about that age.
  const OWNER: Record<string, "early" | "medieval" | "british"> = {
    "early-medieval-india": "early",
    "maratha-confederacy": "medieval",
  };
  const byPeriod = {
    early: (await earlyCells(mcp)) as Cell[],
    medieval: (await medievalCells(mcp)) as Cell[],
    british: (await britishCells(mcp)) as Cell[],
  };
  const cells: Cell[] = [];
  const seen = new Map<string, string>();
  for (const [period, list] of Object.entries(byPeriod)) {
    for (const c of list) {
      const key = `${c.facet}|${c.age}`;
      const owner = OWNER[c.age];
      const other = seen.get(key);
      if (other && (!owner || owner !== period)) {
        console.log(`  ${key}: keeping ${other}'s cell, not ${period}'s`);
        continue;
      }
      if (other) cells.splice(cells.findIndex((x) => `${x.facet}|${x.age}` === key), 1);
      seen.set(key, period);
      cells.push({ facet: c.facet, age: c.age, text: c.text, claimIds: c.claimIds, ...(c.excerptId ? { excerptId: c.excerptId } : {}) });
    }
  }
  console.log(`${cells.length} cells`);
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  const slugs = new Set(overview.pages.map((p) => p.slug));
  const want = blocks(cells, slugs);

  let proposal: Proposal;
  if (!slugs.has(PAGE_SLUG)) {
    proposal = await mcp.call<Proposal>("propose_changes", {
      title: TITLE,
      rationale:
        "A theme page that follows food, water, work, drought and famine across the ages, as a grid of facets by ages. Each cell is a line written over claims already applied by the three period pages (before 1206, 1206–1757, 1757–1947 and after), with a first-hand quotation where one exists. No new claims.",
      ops: [
        {
          op: "create_page",
          ref: "page",
          slug: PAGE_SLUG,
          title: TITLE,
          kind: "theme",
          status: "published",
          summary:
            "How people ate, found water and made a living, and what drought and famine did to them, from the first farming villages to independent India.",
          blocks: want,
        },
      ],
    });
  } else {
    const page = await mcp.call<{ page: { blocks: BlockInput[] } }>("get_page", { page: PAGE_SLUG, format: "json" });
    const patch = pagePatchFrom(page.page.blocks as never[], want as never[]);
    const empty = !patch.remove?.length && !patch.replace?.length && !patch.insert?.length && !patch.move?.length;
    if (empty) {
      console.log("The page is current. Nothing to do.");
      process.exit(0);
    }
    proposal = await mcp.call<Proposal>("propose_page_patch", {
      title: `${TITLE}: updated cells`,
      rationale: "The period pages changed: the grid follows them.",
      page: PAGE_SLUG,
      ...patch,
    });
  }
  summarize("famine-across-ages", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
