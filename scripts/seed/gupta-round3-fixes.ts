/**
 * The six Gupta items left after the verifier re-judged the first two rounds
 * of support fixes:
 *
 * - Hariṣeṇa: one excerpt for the whole of line 31, so the title
 *   sāṃdhivigrahika sits inside the quote that names him;
 * - the iron pillar's move to the Qutb complex is “usually said” to be of the
 *   13th century (Smith thought 1052);
 * - the Faxian misconception now says what Faxian did not do (name the king,
 *   describe his court), which Smith contradicts; Legge's “king of the
 *   country” only qualifies it;
 * - the Kushan dates leave the golden-age claim (no quote gives them);
 * - the vassal claim's “cannot be said with certainty” excerpt supports it;
 * - Faxian's diet line is only a mention on the Chandala claim.
 *
 * Claim and citation edits only. Depends on the page, its sources follow-up
 * and the two earlier fix changesets.
 *
 *   pnpm tsx scripts/seed/gupta-round3-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { alreadyProposedOrApplied, claimFixes, changesetsByTitle } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const TITLE = "The Gupta Empire page: last fixes after the support checks";
const DEPENDS = [
  "The Gupta Empire (c. 320–550 CE): page, sources and entities",
  "The Gupta Empire: older sources for five claims that rested on Wikipedia",
  "The Gupta Empire page: fixes after the AI support checks",
  "The Gupta Empire page: fixes after the joint support checks",
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
    slug: "gupta-empire",
    depends,
    captures: { fleet: { kind: "internet_archive", identifier: "dli.csl.8714" } },
  });
  const { ops, log } = fx;

  // Hariṣeṇa: the whole closing line, titles and name together.
  {
    const key = "The poem was composed by Hariṣeṇa";
    fx.add(key, "x_f_poet_line", "@s_fleet", "fleet", "And this poetical composition, — (the work) of the Kh£dyatap4kika,4 * the son of the Mahddandandyaka 6 Dhruvabh&ti, the Sdmdhivigrahika 6 and Kumdrdmdtya ,7 the Mahddandandyaka Harishena, who is the slave of these same feet of", { page: "16", line: "31", label: "No. 1, Allahabad pillar inscription, translation, closing lines" }, "supports",
      "Quoted in the OCR's spelling, with its footnote marks: “And this poetical composition, — (the work) of the Khādyaṭapākika, the son of the Mahādaṇḍanāyaka Dhruvabhūti, the Sāṃdhivigrahika and Kumārāmātya, the Mahādaṇḍanāyaka Hariṣeṇa, who is the slave of these same feet of”.");
    fx.uncite(key, "And this poetical composition, — (the work) of the");
    fx.uncite(key, "the Mahadandanayaka Harishena, who is the slave of these same feet of");
  }
  // The iron pillar.
  fx.reword("Where the iron pillar first stood", "It was set up in its present place in the Qutb complex in the 13th century;", "It is usually said to have been set up in its present place in the Qutb complex in the 13th century (Smith thought 1052);");
  // The Faxian misconception.
  fx.reword("Faxian visited Chandragupta II's court", "Faxian visited Chandragupta II's court and described his government first-hand.", "Faxian named Chandragupta II and described his court first-hand.");
  fx.restance("Faxian named Chandragupta II", "did not trouble even to mention", "contradicts", "Smith: Faxian never names the king.");
  fx.restance("Faxian named Chandragupta II", "The king of the country honoured", "qualifies", "Faxian speaks only of “the king of the country”, and of the honour he paid a monk.");
  // Golden age: no quote gives the Kushan dates.
  if (fx.claim("The golden-age label is disputed.").text.includes("(1st–3rd centuries CE)"))
    fx.reword("The golden-age label is disputed.", "under the Kushans (1st–3rd centuries CE),", "under the Kushans,");
  // The vassal claim.
  fx.restance("Because later feudatories used the title mahārāja", "However, there are several instances", "supports");
  // The Chandala claim.
  fx.restance("Faxian also described the Chandalas", "Throughout the whole country the people do not kill", "mentions", "Faxian's diet line, which names the Chandalas as the exception.");

  if (!ops.length) {
    console.log("Everything is already fixed. Nothing to do.");
    process.exit(0);
  }
  console.log(log.map((l) => `  ${l}`).join("\n"));
  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "The six Gupta items left after the verifier re-judged the earlier support fixes.",
      "- Hariṣeṇa: one excerpt for the whole of line 31 replaces its two halves, so his title sāṃdhivigrahika is inside the quote that names him (OCR spelling, with the reading in the note).",
      "- Iron pillar: “usually said to have been set up … in the 13th century (Smith thought 1052)”, since Smith's own quote says 1052 and Wikipedia says the date of the move is uncertain.",
      "- Faxian misconception: now “Faxian named Chandragupta II and described his court first-hand”. Smith's “did not trouble even to mention the name” contradicts it; Legge's “the king of the country” qualifies it.",
      "- Golden age: “(1st–3rd centuries CE)” dropped; no quote gives it.",
      "- Vassal claim: the “cannot be said with certainty” excerpt now supports (it is part of the claim).",
      "- Chandala claim: Faxian's diet line is a mention.",
      "Claim and citation edits only. Depends on the page, its sources follow-up and the two earlier fix changesets.",
    ].join("\n"),
    dependsOn: depends.map((d) => d.id),
    ops,
  });
  summarize("gupta round 3", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
