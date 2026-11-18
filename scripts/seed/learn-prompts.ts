/**
 * Proposes recall prompts (claim.learning) for claims on the era pages that
 * have none, THROUGH MCP, so review cards ask for the claim itself ("Which
 * city was the Maurya capital?") instead of "How well supported is this?".
 * Prompts are written per page in ./learn-prompts/<page>.ts, keyed by a
 * unique prefix of the claim's text. No answer is stored: the card's answer is
 * the claim's own text, so nothing is asserted beyond it, and a prompt may use
 * only names and numbers that appear in its claim (ungroundedTerms). Claims
 * that already have a prompt, and misconceptions (asked as true or false),
 * are skipped, unless the page's REWORD set names the claim: its claim was
 * reworded, so the stored prompt (and any stored answer) is replaced. One changeset per page; running it again proposes nothing new.
 *
 *   pnpm tsx scripts/seed/learn-prompts.ts                    # propose (all pages)
 *   … --page gupta-empire   # one page
 *   … --withdraw            # dry run
 *   … --approve-preview     # also apply (only when DATABASE_URL names a preview db)
 */
import { ungroundedTerms, type ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";
import { matchClaim } from "./learn-match";
import { LEARNING as CONTENT_LEARNING } from "./learning-fixes-data";
import { PROMPTS as EARLY_MEDIEVAL, REWORD as EARLY_MEDIEVAL_REWORD } from "./learn-prompts/early-medieval-kingdoms";
import { PROMPTS as GUPTA, REWORD as GUPTA_REWORD } from "./learn-prompts/gupta-empire";
import { PROMPTS as INDEPENDENCE, REWORD as INDEPENDENCE_REWORD } from "./learn-prompts/independence-movement";
import { PROMPTS as INDUS, REWORD as INDUS_REWORD } from "./learn-prompts/indus-civilisation";
import { PROMPTS as MAHAJANAPADAS, REWORD as MAHAJANAPADAS_REWORD } from "./learn-prompts/mahajanapadas";
import { PROMPTS as MAURYA, REWORD as MAURYA_REWORD } from "./learn-prompts/maurya-empire";
import { PROMPTS as VEDIC, REWORD as VEDIC_REWORD } from "./learn-prompts/vedic-period";

const BY_PAGE: Record<string, Record<string, string>> = {
  "maurya-empire": MAURYA,
  "independence-movement": INDEPENDENCE,
  "gupta-empire": GUPTA,
  "indus-civilisation": INDUS,
  mahajanapadas: MAHAJANAPADAS,
  "vedic-period": VEDIC,
  "early-medieval-kingdoms": EARLY_MEDIEVAL,
};
// Claims whose learning learning-fixes.ts writes (content-indus's source of truth): never replaced here.
const OWNED_ELSEWHERE = new Set(Object.values(CONTENT_LEARNING).map((l) => l.prompt));
const REWORD: Record<string, Set<string>> = {
  "early-medieval-kingdoms": EARLY_MEDIEVAL_REWORD,
  "gupta-empire": GUPTA_REWORD,
  "independence-movement": INDEPENDENCE_REWORD,
  "indus-civilisation": INDUS_REWORD,
  "maurya-empire": MAURYA_REWORD,
  mahajanapadas: MAHAJANAPADAS_REWORD,
  "vedic-period": VEDIC_REWORD,
};

interface PageViewJson {
  page: { slug: string; title: string; version: number };
  claims: Record<string, { id: string; text: string; kind: string; learning: { prompt: string; answer?: string } | null }>;
}

const flags = parseFlags();
const only = process.argv.includes("--page") ? process.argv[process.argv.indexOf("--page") + 1] : null;
const mcp = await connectMcp("pramana-seed");
let problems = 0;
try {
  const pending = flags.force ? [] : await pendingTitles(mcp);
  const proposals: Proposal[] = [];
  for (const [slug, prompts] of Object.entries(BY_PAGE).filter(([s]) => !only || s === only)) {
    const view = await mcp.call<PageViewJson>("get_page", { page: slug, format: "json" });
    const title = `${view.page.title} page: recall prompts for review cards`;
    if (pending.includes(title)) {
      console.log(`  "${title}" is already waiting for review`);
      continue;
    }
    const all = Object.values(view.claims);
    const ops: ChangeOpInput[] = [];
    const used = new Set<string>();
    for (const [prefix, prompt] of Object.entries(prompts)) {
      let claim: (typeof all)[number];
      try {
        claim = matchClaim(all, prefix, slug);
      } catch (error) {
        console.log(`  ${error instanceof Error ? error.message : String(error)}; skipped`);
        problems++;
        continue;
      }
      used.add(claim.id);
      if (claim.kind === "misconception") continue;
      const stale =
        REWORD[slug]?.has(prefix) &&
        claim.learning &&
        !OWNED_ELSEWHERE.has(claim.learning.prompt) &&
        (claim.learning.prompt !== prompt || claim.learning.answer !== undefined);
      if (claim.learning && !stale) continue;
      const bad = ungroundedTerms(prompt, claim.text);
      if (bad.length) {
        console.log(`  ${slug}: “${prompt}” uses ${bad.join(", ")}, not in the claim; skipped`);
        problems++;
        continue;
      }
      ops.push({ op: "update_claim", claim: claim.id, set: { learning: { prompt } } });
    }
    const left = all.filter((c) => !c.learning && c.kind !== "misconception" && !used.has(c.id));
    if (left.length) console.log(`  ${slug}: ${left.length} claims still without a prompt:\n${left.map((c) => `    - ${c.text.slice(0, 90)}`).join("\n")}`);
    if (!ops.length) {
      console.log(`  /${slug}: nothing to add`);
      continue;
    }
    const proposal = await mcp.call<Proposal>("propose_changes", {
      title,
      rationale: [
        `Adds recall prompts to ${ops.length} claims on /${slug} that had none, or whose claim has been reworded since its prompt was written, so their review cards ask for the claim itself instead of “How well supported is this?”.`,
        "Each prompt is a question whose answer is the claim's own text; no answer is stored, so the card shows the claim and nothing beyond it. Every name and number in a prompt appears in its claim (checked by the script). Misconceptions keep their true-or-false cards.",
      ].join("\n\n"),
      ops,
    });
    summarize(title, proposal);
    proposals.push(proposal);
  }
  await finish(mcp, flags, proposals);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
if (problems) console.log(`${problems} prompts were skipped; see above.`);
