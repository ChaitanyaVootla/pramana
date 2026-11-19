/**
 * Proposes "Famine and war in medieval India" THROUGH MCP: captures the
 * source texts, finds or creates the sources and entities, and proposes the
 * excerpts, claims, citations, relations and the theme page in one changeset.
 * Idempotent: once the page exists it only keeps the blocks without entity
 * references (prose, quotes, claim lists, the tracks "spine"…) in line with
 * famine-medieval.ts, proposing a block-level patch if they differ; a pending
 * changeset with the same title also stops it.
 *
 *   pnpm tsx scripts/seed/famine-medieval-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --cells             # print the cross-age cells resolved on this database
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { pagePatchOp } from "../lib/page-patch";
import { captureAll, CLAIMS, contentOps, entityOps, EXCERPTS, famineMedievalPage, PAGE_SLUG, sourceOps, spineBlock } from "./famine-medieval";
import { famineCells, pageIds } from "./famine-medieval-cells";

const CHANGESET_TITLE = "Famine and war in medieval India (c. 1000–1757): theme page, sources and entities";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (process.argv.includes("--cells")) {
    const cells = await famineCells(mcp);
    console.log(JSON.stringify(cells, null, 1));
    console.log(`${cells.length} cells resolved.`);
    process.exit(0);
  }
  const overview = await mcp.call<{ pages: { slug: string }[] }>("overview");
  if (overview.pages.some((p) => p.slug === PAGE_SLUG)) {
    // Keep the blocks without entity references (prose, quotes, claims lists, the spine…) in line with this script.
    const view = await mcp.call<{ page: { blocks: { id: string; type: string }[] } }>("get_page", { page: PAGE_SLUG, format: "json" });
    const { claimId, excerptId } = await pageIds(mcp);
    const resolve = (v: unknown): unknown => {
      if (typeof v === "string")
        return v
          .replace(/\(claim:@([a-z0-9_]+)\)/g, (_, r: string) => `(claim:${claimId(r)})`)
          .replace(/^@(f[cm]_[a-z0-9_]+)$/, (_, r: string) => claimId(r))
          .replace(/^@(fx_[a-z0-9_]+)$/, (_, r: string) => excerptId(r));
      if (Array.isArray(v)) return v.map(resolve);
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolve(x)]));
      return v;
    };
    const SYNCED = new Set(["prose", "claims", "quote", "callout", "debate", "misconception"]);
    const anyRef = new Proxy({} as Record<string, string>, { get: (_, k) => String(k) });
    const wanted = ((famineMedievalPage(anyRef) as { blocks: { id: string; type: string }[] }).blocks)
      .filter((b) => SYNCED.has(b.type))
      .map((b) => resolve(b) as { id: string; type: string });
    wanted.push(spineBlock(await famineCells(mcp)) as { id: string; type: string });
    const ids = new Set(wanted.map((b) => b.id));
    const before = view.page.blocks.filter((b) => ids.has(b.id));
    const after = before.map((b) => wanted.find((w) => w.id === b.id)!);
    const op = pagePatchOp(PAGE_SLUG, before, after);
    if (!op) {
      console.log("The page already exists and is up to date. Nothing to do.");
      process.exit(0);
    }
    const title = "Famine and war in medieval India: wording updates";
    if (!flags.force && (await pendingTitles(mcp)).includes(title)) {
      console.log("A spine update is already waiting for review. Nothing to do.");
      process.exit(0);
    }
    const p = await mcp.call<Proposal>("propose_changes", {
      title,
      rationale: "Brings the page's prose, quotes, claim lists and age-by-age table in line with scripts/seed/famine-medieval.ts (wording that said more than its claims).",
      ops: [op],
    });
    summarize("famine-medieval update", p);
    await finish(mcp, flags, [p]);
    process.exit(0);
  }
  if (!flags.force && (await pendingTitles(mcp)).includes(CHANGESET_TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }

  console.log("Capturing source texts…");
  const snaps = await captureAll(mcp);
  console.log("Finding or creating sources…");
  const src = await sourceOps(mcp);
  for (const r of src.reused) console.log(`  ${r}`);
  console.log("Checking Wikidata matches and building entities…");
  const ents = await entityOps(mcp);
  for (const r of ents.reused) console.log(`  reusing ${r}`);

  const ops = [...src.ops, ...ents.ops, ...contentOps(snaps, src.ref, ents.ref), famineMedievalPage(ents.ref)];
  const p = await mcp.call<Proposal>("propose_changes", {
    title: CHANGESET_TITLE,
    rationale: [
      `A novice-first theme page on drought, famine and war in India from Maḥmūd of Ghazna's raids to the Deccan famine of 1702–04, in ten chapters plus “Often said”, led by ordinary people: food, water, work, what failed, how people got through, what rulers did, the toll and the aftermath. Its spine is a tracks block over five ages, whose cells are also exported for the cross-age page. ${CLAIMS.length} claims and ${EXCERPTS.length} quoted excerpts, each checked against a snapshot captured here.`,
      "Primary sources, all public domain: Elliot and Dowson vols I, III–VII (1867–77) for Baranī, ʿAfīf, Amīr Khusrau, the Malfūẓāt-i Tīmūrī, Yaḥyā Sirhindī, Badāyūnī, Abu'l Faẓl, Nūr al-Ḥaqq and Lāhorī, with Elliot's own preface as evidence of the selection's purpose; al-Bīrūnī (Sachau); Ibn Baṭṭūṭa (Lee 1829); Bābur (Beveridge 1922); Paes and Nunes (in Sewell 1900); Peter Mundy (Temple 1914); the English factory letters (Foster 1910); Bernier (1916); Manucci (Irvine 1908); Sabhāsad (Sen 1920). Secondary, public domain: Moreland (1920, 1923), including his translation of van Twist; Grant Duff (ed. 1921); Sewell (1900).",
      "Biases named on the page: Baranī's praise and blame of sultans, ʿAfīf's flattery, the official Bādshāhnāma, the Malfūẓāt's doubtful authorship, Elliot's stated aim, Bernier's argument to Colbert, Sabhāsad's court ideal, Manucci's second-hand guesses, Moreland's verdicts. Disagreement kept as data: a debate on weather against rulers in 1630–32, and three misconceptions (no famines before the British; rulers did nothing; tolls are counts).",
      "Sources are matched on the platform by exact title (and volume) and entities by Wikidata QID, and created only where missing; the four age polities and early-medieval-india are reused by slug. Coordinates from Wikidata only.",
    ].join("\n\n"),
    dependsOn: ents.dependsOn,
    ops,
  });
  summarize("famine-medieval", p);
  await finish(mcp, flags, [p]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
