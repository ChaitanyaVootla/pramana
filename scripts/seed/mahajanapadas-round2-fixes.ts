/**
 * The one Mahājanapadas item left after the verifier re-judged the support
 * fixes: the Udayin claim says he came after Ajātasattu and Darśaka, so the
 * Purāṇa quote now starts at Ajātasattu.
 *
 * Claim and citation edits only. Depends on the page, its sources follow-up
 * and the support-fix changeset.
 *
 *   pnpm tsx scripts/seed/mahajanapadas-round2-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { alreadyProposedOrApplied, claimFixes, changesetsByTitle } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const TITLE = "The Mahājanapadas page: last fix after the support checks";
const DEPENDS = [
  "The Mahājanapadas and the age of the Buddha (c. 600–320 BCE): page, sources and entities",
  "The Mahājanapadas page: older sources for claims that rested on Wikipedia",
  "The Mahājanapadas page: fixes after the AI support checks",
];

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  // One correction: once proposed or applied, running again must do nothing (later fixes own these claims).
  const done = flags.force ? null : await alreadyProposedOrApplied(mcp, TITLE);
  if (done) {
    console.log(done === "proposed" ? "A changeset with this title is already waiting for review. Nothing to do." : "This fix is already applied. Nothing to do.");
    process.exit(0);
  }
  const depends = await changesetsByTitle(mcp, DEPENDS);
  const fx = await claimFixes(mcp, {
    slug: "mahajanapadas",
    depends,
    captures: { pargiter: { kind: "internet_archive", identifier: "dli.csl.5891" } },
  });
  const key = "made Kusumapura";
  fx.add(key, "x_parg_ajatasatru", "@s_pargiter", "pargiter", "Ajfita&tru will be king 25 years 2 . Darsaka will be king 25 years 3 . After him Udayin 4 will be king 33 years.", { page: "69", label: "Śiśunāgas (translation)" }, "supports",
    "Quoted in the OCR's spelling: “Ajātaśatru will be king 25 years. Darśaka will be king 25 years. After him Udayin will be king 33 years.” The figures after “years” and “Udayin” are footnote marks.");
  fx.uncite(key, "Darsaka will be king 25 years 3 . After him Udayin 4 will be king 33 years.");

  if (!fx.ops.length) {
    console.log("Everything is already fixed. Nothing to do.");
    process.exit(0);
  }
  console.log(fx.log.map((l) => `  ${l}`).join("\n"));
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "The one Mahājanapadas item left after the verifier re-judged the support fixes.",
      "- Udayin “came after Ajātasattu and Darśaka”: the Purāṇa quote now starts at Ajātasattu (it replaces the quote that started at Darśaka).",
      "Claim and citation edits only. Depends on the page, its sources follow-up and the support-fix changeset.",
    ].join("\n"),
    dependsOn: depends.map((d) => d.id),
    ops: fx.ops,
  });
  summarize("mahajanapadas round 2", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
