/**
 * Proposes "The famines of British India" THROUGH MCP: captures the source
 * texts, finds or creates the entities, and proposes the sources, excerpts,
 * claims, citations, relations and the theme page in one changeset.
 * Idempotent: once the page exists (or a changeset with this title is
 * pending), it proposes nothing.
 *
 * Reused, not created (they exist in both the main and preview databases):
 * the age entities company-rule, british-raj, independent-india and
 * maratha-confederacy; bengal-famine-of-1943, dadabhai-naoroji and
 * drain-of-wealth; and two claims from the independence-movement page
 * (Naoroji's drain, and the 0.8–3.8 million range for 1943), found by text.
 *
 *   pnpm tsx scripts/seed/famine-british-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --cells             # print the cross-age cells resolved on this database
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { captureAll, CLAIMS, contentOps, entityOps, EXCERPTS, faminePage, PAGE_SLUG, type ExistingClaims } from "./famine-british";
import { famineCells } from "./famine-british-cells";
import type { Mcp } from "./mcp";

const CHANGESET_TITLE = "The famines of British India (1757–1947, and after): theme page, sources and entities";

/** Claims reused from the independence-movement page, by exact text. */
const OLD_CLAIMS: Record<keyof ExistingClaims, string> = {
  drain: "Dadabhai Naoroji argued that British rule drained India's wealth to Britain, by his estimate nearly or above £30 million a year.",
  range1943: "In 1943, during the war, a famine in Bengal killed an estimated 800,000 to 3.8 million people through starvation and disease.",
};

async function existingClaims(mcp: Mcp): Promise<ExistingClaims> {
  const out = {} as ExistingClaims;
  for (const [key, text] of Object.entries(OLD_CLAIMS) as [keyof ExistingClaims, string][]) {
    const query = text.split(/\s+/).slice(0, 10).join(" ").replace(/[^\p{L}\p{N} ]/gu, " ");
    const res = await mcp.call<{ claims: { id: string; text: string }[] }>("search", { query, types: ["claims"], limit: 20 });
    const hit = res.claims.find((c) => c.text === text);
    if (!hit) throw new Error(`existing claim not found on this database: “${text.slice(0, 80)}…”`);
    out[key] = hit.id;
  }
  return out;
}

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
    console.log("The page already exists. Nothing to do.");
    process.exit(0);
  }
  if (!flags.force && (await pendingTitles(mcp)).includes(CHANGESET_TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }

  console.log("Capturing source texts…");
  const snaps = await captureAll(mcp);
  console.log("Checking Wikidata matches and building entities…");
  const ents = await entityOps(mcp);
  for (const r of ents.reused) console.log(`  reusing ${r}`);
  const old = await existingClaims(mcp);
  console.log(`  reusing claims ${old.drain} (drain), ${old.range1943} (1943 range)`);

  const ops = [...ents.ops, ...contentOps(snaps, ents.ref, {}), faminePage(ents.ref, old)];
  const p = await mcp.call<Proposal>("propose_changes", {
    title: CHANGESET_TITLE,
    rationale: [
      `A novice-first theme page on famine in Company and Crown India, 1769–1943, and the turn after 1947, led by ordinary people: food, water, work, what failed first, how people got through (famine foods, selling cattle, jewels, doors, land and children, debt, migration, refusing the camps), what the state did, the toll and the aftermath. Eleven chapters plus “Often said”, a tracks block over four ages, two debates on 1943 and one on drought against rule. ${CLAIMS.length} claims and ${EXCERPTS.length} quoted excerpts, each checked against a snapshot captured here.`,
      "Primary and contemporary sources, all public domain: Hunter, Annals of Rural Bengal (1868), quoting the Company's records and printing the Council's letter of 1772 and John Shore's verses; Digby, The Famine Campaign in Southern India (1878); Nash, The Great Famine and its Causes (1900); the Famine Commission reports of 1880 and 1901 and the Famine Inquiry Commission's Report on Bengal (1945), Government of India; Curzon's budget speech of 1900 (Raleigh, 1906). Secondary, public domain: the Imperial Gazetteer, vol. III (1907), the official history; the Dharwar gazetteer (1884); Dutt (1900, 1904) and Digby (1901), the critics.",
      "Wikipedia (pinned revisions, tertiary) only for modern estimates (1770, 1782–84, 1876–78, 1943), the scholarly debate (Sen and his critics, Davis, Roy, the War Cabinet) and independent India; these claims are marked “supported” at most, and Sen's book (in copyright) is cited only through Wikipedia's quotation. Biases named: Hunter's and the Gazetteer's official view, the critics' case-making, Digby's mixed totals, Curzon's defence, the Commission's lower count for 1943.",
      "Entities from Wikidata by QID (seven famines; Hastings, Hunter, Digby, Dutt, Temple, Lytton, Curzon, Sen) and six glossary terms, created only where missing. Reused by slug: company-rule, british-raj, independent-india, maratha-confederacy, bengal-famine-of-1943, dadabhai-naoroji, drain-of-wealth; and two claims of the independence page (Naoroji's drain; the 1943 range).",
    ].join("\n\n"),
    dependsOn: ents.dependsOn,
    ops,
  });
  summarize("famine-british", p);
  await finish(mcp, flags, [p]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
