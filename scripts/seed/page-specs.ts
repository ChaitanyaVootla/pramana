/**
 * Proposes page specs THROUGH MCP: what each page's atlas shows (focus
 * polities, the scrubber's range and its stops). Stops are grounded in the
 * page's own claims: each names a turning point that a claim on the page
 * dates, and carries that claim's id. Claims are found by the opening words
 * of their text (ids differ between databases); a stop whose claim is not on
 * the page is left out.
 *
 *   pnpm tsx scripts/seed/page-specs.ts [--page maurya-empire,…]   # propose
 *   … --withdraw          # dry run: propose, print the reports, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Idempotent: a page whose stored atlas already equals the one here, or with
 * a pending changeset of the same title, is skipped. Other parts of a stored
 * spec (hero, rail, outline…) are kept as they are.
 */
import { AtlasSpec, toAstronomicalYear, type AtlasStop, type PageSpecInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { pagePatchOp } from "../lib/page-patch";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";

const bce = (y: number) => toAstronomicalYear(y, "BCE");

interface StopDraft extends Omit<AtlasStop, "claimId"> {
  /** The opening words of the claim on the page that dates the stop (no stop without one). */
  claim: string;
}

interface Draft {
  page: string;
  why: string;
  /** Focus polities: entity slugs, or Wikidata QIDs for polities imported with the borders. Missing ones are left out. */
  focus: string[];
  range: [number, number];
  initialYear?: number;
  stops: StopDraft[];
  neighbours?: boolean;
}

const DRAFTS: Draft[] = [
  {
    page: "maurya-empire",
    why: "The Maurya Empire's borders from just before its founding to just after its end, with the turning points the page's claims date.",
    focus: ["maurya-empire"],
    range: [bce(350), bce(150)],
    stops: [
      // "The Maurya Empire was founded by Chandragupta Maurya around 320 BCE and lasted, in loose-knit form, until 185 BCE."
      { year: bce(320), label: "Chandragupta founds the empire", claim: "The Maurya Empire was founded by Chandragupta Maurya around 320 BCE" },
      // "Aśoka conquered Kalinga in the eighth year after his consecration." (c. 261 BCE)
      { year: bce(261), label: "Aśoka conquers Kalinga", claim: "Aśoka conquered Kalinga in the eighth year after his consecration" },
      // "In the twentieth year after his consecration, Aśoka visited Lumbinī…" (c. 249 BCE)
      { year: bce(249), label: "Aśoka visits Lumbinī", claim: "In the twentieth year after his consecration, Aśoka visited Lumbinī" },
      { year: bce(185), label: "The empire ends", claim: "The Maurya Empire was founded by Chandragupta Maurya around 320 BCE" },
    ],
  },
  {
    page: "independence-movement",
    why: "British India and its neighbours from the revolt of 1857 to independence and partition, focused on the Raj and the two dominions of 1947, with the turning points the page's claims date.",
    // British Raj, then India and Pakistan (as the borders import names them).
    focus: ["Q129286", "Q668", "Q843"],
    range: [1850, 1950],
    // Open on the first turning point, not on the Raj at its largest (1902): it teaches better.
    initialYear: 1857,
    stops: [
      { year: 1857, label: "The revolt of 1857", claim: "Marx, reporting in 1857, said the first disturbances" },
      { year: 1858, label: "The Queen's proclamation", claim: "After the revolt, Queen Victoria's proclamation of November 1858" },
      { year: 1885, label: "The first Indian National Congress", claim: "The first Indian National Congress met in Bombay in December 1885" },
      { year: 1906, label: "Congress asks for swaraj", claim: "Presiding over the Congress in 1906, Naoroji summed up its demand" },
      { year: 1919, label: "Jallianwala Bagh", claim: "On 13 April 1919, at Jallianwala Bagh" },
      { year: 1930, label: "The independence pledge", claim: "On 26 January 1930 the Congress asked meetings across India to adopt a pledge" },
      { year: 1942, label: "Quit India", claim: "On 8 August 1942, during the Second World War" },
      { year: 1947, label: "Independence and partition", claim: "The Indian Independence Act 1947 set up two independent dominions" },
    ],
  },
  {
    page: "ages-of-indian-history",
    why: "The overview's atlas covers every border we hold, from the Mahajanapadas to independence; no polity is singled out.",
    focus: [],
    range: [-600, 1950],
    initialYear: bce(250),
    stops: [],
  },
];

const flags = parseFlags();
const only = (() => {
  const i = process.argv.indexOf("--page");
  return i > 0 ? process.argv[i + 1]!.split(",") : null;
})();
const mcp = await connectMcp("pramana-page-specs");
try {
  const pending = await pendingTitles(mcp);
  const proposals: Proposal[] = [];
  for (const d of DRAFTS) {
    if (only && !only.includes(d.page)) continue;
    const title = `Page spec: the atlas on “${d.page}”`;
    if (!flags.force && pending.includes(title)) {
      console.log(`${d.page}: a changeset “${title}” is already waiting for review; skipped.`);
      continue;
    }
    const view = await mcp.call<{
      page: { version: number; spec: PageSpecInput; hasSpec: boolean };
      claims: Record<string, { id: string; text: string }>;
    }>("get_page", { page: d.page, format: "json" });

    // Stops only for claims that are on the page.
    const stops: AtlasStop[] = [];
    for (const s of d.stops) {
      const found = Object.values(view.claims).filter((c) => c.text.startsWith(s.claim));
      if (found.length === 1) stops.push({ year: s.year, label: s.label, claimId: found[0]!.id });
      else console.log(`${d.page}: ${found.length ? "more than one claim" : "no claim"} on the page starts “${s.claim}”; stop “${s.label}” left out.`);
    }

    // Focus: slugs through get_entity, QIDs through the Wikidata index; only entities that exist.
    const focus: string[] = [];
    const qids = d.focus.filter((f) => /^Q\d+$/.test(f));
    const byQid = qids.length
      ? await mcp.call<Record<string, { status: string; id: string }>>("entities_by_wikidata", { qids })
      : {};
    for (const f of d.focus) {
      if (/^Q\d+$/.test(f)) {
        const m = byQid[f];
        if (m?.status === "existing") focus.push(m.id);
        else console.log(`${d.page}: no entity yet for ${f}; left out of the focus (re-run once the borders import is decided).`);
        continue;
      }
      try {
        const e = await mcp.call<{ entity: { id: string } }>("get_entity", { entity: f });
        focus.push(e.entity.id);
      } catch {
        console.log(`${d.page}: no entity “${f}”; left out of the focus.`);
      }
    }

    const atlas = AtlasSpec.parse({
      focus,
      range: d.range,
      ...(d.initialYear !== undefined ? { initialYear: d.initialYear } : {}),
      stops,
      neighbours: d.neighbours ?? true,
    });
    const current = view.page.hasSpec ? view.page.spec : {};
    if (JSON.stringify(current.atlas ?? null) === JSON.stringify(atlas)) {
      console.log(`${d.page}: the atlas spec is already as proposed; nothing to do.`);
      continue;
    }
    // Only the atlas key, guarded by its own fingerprint: a pending lead-image or block edit of the page does not conflict.
    const op = pagePatchOp(d.page, [], [], { before: view.page.spec, after: { ...view.page.spec, atlas }, paths: ["atlas"] });
    if (!op) {
      console.log(`${d.page}: the atlas spec is already as proposed; nothing to do.`);
      continue;
    }
    const p = await mcp.call<Proposal>("propose_changes", {
      title,
      rationale: [
        d.why,
        stops.length
          ? `Stops, each dated by a claim on the page:\n${stops.map((s) => `- ${s.year < 1 ? `${1 - s.year} BCE` : s.year}: ${s.label} (claim ${s.claimId})`).join("\n")}`
          : "No stops.",
        "Borders come from the Cliopatria extents already in the database; this changes only what the page's atlas shows, not any content.",
      ].join("\n\n"),
      ops: [op],
    });
    summarize(d.page, p);
    proposals.push(p);
  }
  await finish(mcp, flags, proposals);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
