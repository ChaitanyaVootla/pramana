/**
 * Proposes "Guess first" questions and end-of-chapter checks for the Maurya
 * Empire, Independence movement, Gupta Empire, Indus civilisation,
 * Mahājanapadas, Vedic period and early medieval pages THROUGH MCP, as the agent acting for
 * the local user (content in ./learn-content.ts). Each page is re-read right
 * before proposing, and only its learning blocks are added or replaced, so
 * edits made by others in the meantime are kept. Running it again changes
 * nothing unless the content here has changed.
 *
 *   pnpm tsx scripts/seed/learn-places.ts                   # first: places from Wikidata
 *   pnpm tsx scripts/seed/learn-index.ts                    # propose (all pages)
 *   … --page maurya-empire  # one page
 *   … --withdraw            # dry run: propose, print the report, withdraw
 *   … --approve-preview     # also apply (only when DATABASE_URL names a preview db)
 */
import {
  Block,
  chronologicalOrder,
  dateBounds,
  type BlockInput,
  type FuzzyDate,
} from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { PAGES, type CheckSpecItem, type PageLearnSpec } from "./learn-content";
import { matchClaim } from "./learn-match";

interface PageViewJson {
  page: { id: string; slug: string; version: number; blocks: BlockInput[] };
  claims: Record<string, { id: string; text: string; when: FuzzyDate | null; learning: { prompt: string } | null }>;
}

interface EntityDetailJson {
  entity: { id: string; slug: string; label: string; wikidataId: string | null; geo: { geometry: { type: string } } | null };
}

type Mcp = Awaited<ReturnType<typeof connectMcp>>;

/** Pending changesets the proposal depends on (places from learn-places.ts not yet approved). */
const dependsOn = new Set<string>();

const fold = (s: string) => s.normalize("NFC").toLowerCase();

/** JSON with sorted keys (JSONB does not keep key order). */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );
}

function claimId(view: PageViewJson, prefix: string): string {
  return matchClaim(Object.values(view.claims), prefix, `/${view.page.slug}`).id;
}

const shortId = (chapter: string) => chapter.replace(/^ch-/, "");

/** Every question that no longer fits its page, across all pages, so one run lists them all. */
const problems: string[] = [];

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The learning blocks for a page, resolved against the live page and checked against its claims. */
async function plannedBlocks(mcp: Mcp, spec: PageLearnSpec, view: PageViewJson) {
  const chapters = new Set(view.page.blocks.filter((b) => b.type === "chapter").map((b) => b.id));
  const out: { chapter: string; at: "start" | "end"; block: BlockInput }[] = [];
  for (const g of spec.guesses) {
    if (!chapters.has(g.chapter)) {
      problems.push(`/${spec.page}: no chapter ${g.chapter}`);
      continue;
    }
    let id: string;
    try {
      id = claimId(view, g.claim);
    } catch (error) {
      problems.push(`/${spec.page} guess in ${g.chapter}: ${message(error)}`);
      continue;
    }
    const text = view.claims[id]!.text;
    if (!fold(text).includes(fold(g.grounding))) {
      problems.push(`/${spec.page} guess in ${g.chapter}: the claim does not contain “${g.grounding}”; it now reads “${text}”`);
      continue;
    }
    out.push({
      chapter: g.chapter,
      at: "start",
      block: { id: `guess-${shortId(g.chapter)}`, type: "guess", question: g.question, claimId: id, answer: g.answer, ...(g.note ? { note: g.note } : {}) },
    });
  }
  for (const c of spec.checks) {
    if (!chapters.has(c.chapter)) {
      problems.push(`/${spec.page}: no chapter ${c.chapter}`);
      continue;
    }
    const items = [];
    for (const item of c.items) {
      try {
        items.push(await resolveItem(mcp, view, c.chapter, item));
      } catch (error) {
        problems.push(`/${spec.page} check ${c.chapter}/${item.id}: ${message(error)}`);
      }
    }
    out.push({ chapter: c.chapter, at: "end", block: { id: `check-${shortId(c.chapter)}`, type: "check", ...(c.title ? { title: c.title } : {}), items } });
  }
  for (const p of out) Block.parse(p.block);
  return out;
}

async function resolveItem(mcp: Mcp, view: PageViewJson, chapter: string, item: CheckSpecItem) {
  const where = `${chapter}/${item.id}`;
  if (item.kind === "recall") {
    const id = claimId(view, item.claim);
    if (!item.prompt && !view.claims[id]!.learning?.prompt) throw new Error(`${where}: the claim has no learning prompt; give one`);
    return { kind: "recall" as const, id: item.id, claimId: id, ...(item.prompt ? { prompt: item.prompt } : {}) };
  }
  if (item.kind === "order") {
    const items = item.items.map((x) => ({ claimId: claimId(view, x.claim), label: x.label }));
    const order = chronologicalOrder(
      items.map((x) => {
        const when = view.claims[x.claimId]!.when;
        return { claimId: x.claimId, bounds: when ? dateBounds(when) : null };
      }),
    );
    if ("problem" in order) throw new Error(`${where}: cannot be graded (${order.problem})`);
    return { kind: "order" as const, id: item.id, ...(item.prompt ? { prompt: item.prompt } : {}), items };
  }
  const detail = await mcp.call<EntityDetailJson>("get_entity", { entity: item.entity }).catch(async (error: unknown) => {
    // A place proposed by learn-places.ts may still be waiting for review: depend on it.
    if (!item.qid) throw error;
    const match = (await mcp.call<Record<string, { status: string; id: string; changesetId?: string }>>("entities_by_wikidata", { qids: [item.qid] }))[item.qid];
    if (match?.status !== "pending" || !match.changesetId) throw new Error(`${where}: ${item.entity} is not on the platform; run scripts/seed/learn-places.ts first`);
    dependsOn.add(match.changesetId);
    return null;
  });
  if (!detail) return { kind: "place" as const, id: item.id, entity: item.entity, ...(item.prompt ? { prompt: item.prompt } : {}), ...(item.toleranceKm ? { toleranceKm: item.toleranceKm } : {}) };
  if (!detail.entity.wikidataId || detail.entity.geo?.geometry.type !== "Point")
    throw new Error(`${where}: ${item.entity} needs a point from Wikidata to be asked about`);
  return {
    kind: "place" as const,
    id: item.id,
    entity: detail.entity.slug,
    ...(item.prompt ? { prompt: item.prompt } : {}),
    ...(item.toleranceKm ? { toleranceKm: item.toleranceKm } : {}),
  };
}

/** Inserts each planned block (a guess right after its chapter's heading, a check at the chapter's end) or replaces it in place. */
function merge(blocks: BlockInput[], planned: Awaited<ReturnType<typeof plannedBlocks>>): { blocks: BlockInput[]; added: number; changed: number } {
  const out = [...blocks];
  let added = 0;
  let changed = 0;
  for (const { chapter, at, block } of planned) {
    const existing = out.findIndex((b) => b.id === block.id);
    if (existing >= 0) {
      if (canonical(Block.parse(out[existing])) !== canonical(Block.parse(block))) {
        out[existing] = block;
        changed++;
      }
      continue;
    }
    const head = out.findIndex((b) => b.id === chapter);
    if (at === "start") out.splice(head + 1, 0, block);
    else {
      const next = out.findIndex((b, i) => i > head && b.type === "chapter");
      out.splice(next < 0 ? out.length : next, 0, block);
    }
    added++;
  }
  return { blocks: out, added, changed };
}

const flags = parseFlags();
const only = process.argv.includes("--page") ? process.argv[process.argv.indexOf("--page") + 1] : null;
const mcp = await connectMcp("pramana-seed");
try {
  const pending = flags.force ? [] : await pendingTitles(mcp);
  // Plan every page first, so a problem on one page (a claim edited since the
  // questions were written) stops the run before anything is proposed.
  const plans: { spec: (typeof PAGES)[number]; version: number; before: BlockInput[]; blocks: BlockInput[]; added: number; changed: number; dependsOn: string[] }[] = [];
  for (const spec of PAGES.filter((p) => !only || p.page === only)) {
    if (pending.includes(spec.title)) {
      console.log(`  "${spec.title}" is already waiting for review`);
      continue;
    }
    dependsOn.clear();
    const view = await mcp.call<PageViewJson>("get_page", { page: spec.page, format: "json" });
    const planned = await plannedBlocks(mcp, spec, view);
    const merged = merge(view.page.blocks, planned);
    if (!merged.added && !merged.changed) {
      console.log(`  /${spec.page} already has these questions (version ${view.page.version})`);
      continue;
    }
    plans.push({ spec, version: view.page.version, before: view.page.blocks, ...merged, dependsOn: [...dependsOn] });
  }
  if (problems.length) {
    console.log(`${problems.length} questions no longer fit their claims; nothing was proposed:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exitCode = 1;
    plans.length = 0;
  }
  const proposals: Proposal[] = [];
  for (const { spec, version, before, blocks, added, changed, dependsOn: deps } of plans) {
    // Only the learning blocks added or replaced, each guarded by its own fingerprint.
    const op = pagePatchOp(spec.page, before, blocks);
    if (!op) {
      console.log(`  /${spec.page} already has these questions (version ${version})`);
      continue;
    }
    const proposal = await mcp.call<Proposal>("propose_changes", {
      title: spec.title,
      ...(deps.length ? { dependsOn: deps } : {}),
      rationale: [...spec.rationale, `Against page version ${version}: ${added} blocks added, ${changed} changed; no other block is touched.`].join("\n\n"),
      ops: [op],
    });
    summarize(spec.title, proposal);
    proposals.push(proposal);
  }
  await finish(mcp, flags, proposals);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
