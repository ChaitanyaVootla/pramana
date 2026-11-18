/**
 * The six claims on the Gupta, Mahājanapadas and early medieval pages still at
 * L2 after the verifier re-judged every earlier fix. One changeset per page,
 * each a single correction (skipped once proposed or applied):
 *
 * - early medieval: Hultzsch's own (hedged) correction of “Vijayam” to “Śrī-Viṣaya”;
 *   Elliot's note that Reinaud identified Sulaimān's “Jurz” with Kanauj (on
 *   the cavalry claim and the Ruhmī claim, which said “usually identified
 *   with the Pratihāras”); the Aihole verse on the Narmadā claim;
 * - Mahājanapadas: Wikipedia on historians' view of Mahāvīra as a reformer of
 *   a community Jains trace to Pārśva;
 * - Gupta: Smith's footnote preferring Chandravarman cannot be quoted (a
 *   two-column scan), so the claim drops it and the location-only citation
 *   becomes a mention.
 *
 *   pnpm tsx scripts/seed/last-support-fixes.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { ChangeOpInput } from "@pramana/core";
import { alreadyProposedOrApplied, claimFixes, changesetsByTitle } from "../lib/claim-fixes";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, summarize, type Proposal } from "../lib/proposal";

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");

interface Job {
  title: string;
  slug: string;
  depends: string[];
  captures: Record<string, unknown>;
  rationale: string[];
  fix: (fx: Awaited<ReturnType<typeof claimFixes<string>>>) => void;
}

const JOBS: Job[] = [
  {
    title: "Kingdoms of the early medieval age: last fixes after the support checks",
    slug: "early-medieval-kingdoms",
    depends: [
      "Kingdoms of the early medieval age and the Cholas (c. 550–1200 CE): page, sources and entities",
      "Kingdoms of the early medieval age: older sources for claims that rested on Wikipedia",
      "Kingdoms of the early medieval age: fixes after the support checks",
    ],
    captures: {
      sii2: { kind: "internet_archive", identifier: "india.history.resource.93073" },
      ed1: { kind: "internet_archive", identifier: "historyofindiaas01elli" },
    },
    rationale: [
      "The four early medieval claims still at L2 after the verifier's re-judging.",
      "- Rājendra's list: “Vijayam” is now glossed by Hultzsch's own correction, quoted from his addenda (“has probably to be corrected into Sri-Vishaya”).",
      "- Sulaimān's “Jurz” (cavalry claim and Ruhmī claim): Elliot's note that Reinaud identified Jurz with Kanauj, which Mas'udi doubted, replaces “usually identified with the Pratihāras”.",
      "- Narmadā battle: the Aihole verse on Harṣa's defeat is cited here too.",
    ],
    fix: (fx) => {
      fx.reword("Rājendra's inscriptions say he", "“Vijayam” (taken to be Śrīvijaya)", "“Vijayam” (which Hultzsch later corrected to “Śrī-Viṣaya”)");
      fx.add("Rājendra's inscriptions say he", "x_sii_vishaya", "@s_sii2", "sii2", "Page 109, line 11,—“Vijayam of great fame” has probably to be corrected into “Sri-Vishaya”; see Ep. Ind., Vol. IX, p. 231.", { volume: "II", page: "xii", label: "Addenda and corrigenda" });
      const JURZ = "Abu Zaid says incidentally that Kanauj is “ a large country forming the empire of Jurz ;” 1 and relying upon this statement M. Reinaud identifies Jurz with Kanauj.2 But Mas’udi locates the Bauiira at Kanauj, and speaks of Juzr as quite a distinct kingdom.";
      const jurzLoc = { volume: "I", page: "358", label: "Appendix, note “Juzr or Jurz”" };
      const jurzNote = "Elliot's note. The figures after “Jurz ;” and “Kanauj.” are footnote marks; “Bauiira” is the OCR for Baūra.";
      fx.reword("The Pratihāras held the Arab armies west of the Indus.", "of the king of “Jurz”, usually identified with the Pratihāras, that", "of the king of “Jurz”, which M. Reinaud identified with Kanauj, the Pratihāras' capital, that");
      fx.add("The Pratihāras held the Arab armies west of the Indus.", "x_ed_jurz", "@s_ed1", "ed1", JURZ, jurzLoc, "supports", jurzNote);
      fx.reword("Sulaimān also describes a kingdom he calls Ruhmī", "(usually taken to be the Pratihāras)", "(which Reinaud identified with Kanauj)");
      fx.add("Sulaimān also describes a kingdom he calls Ruhmī", "x_ed_jurz", "@s_ed1", "ed1", JURZ, jurzLoc, "supports", jurzNote);
      fx.citeRef("The battle was fought on the Narmadā", "x_ei6_harsha", "supports", "Harsha, whose lotus-feet were arrayed with the rays of the jewels of the diadems of hosts of feudatories prosperous with unmeasured might, through Him had his mirth (harsha) melted away by fear, having become loathsome with his rows of lordly elephants fallen in battle.", "The Aihole inscription's verse on Harṣa's defeat.");
    },
  },
  {
    title: "Kingdoms of the early medieval age: two wording fixes after the support checks",
    slug: "early-medieval-kingdoms",
    depends: [
      "Kingdoms of the early medieval age and the Cholas (c. 550–1200 CE): page, sources and entities",
      "Kingdoms of the early medieval age: last fixes after the support checks",
    ],
    captures: {},
    rationale: [
      "The last two early medieval claims at L2 after the verifier's re-judging, both wording.",
      "- Rājendra's list: Hultzsch's correction keeps his “probably”.",
      "- Sulaimān's “Jurz”: “the Pratihāras' capital” dropped; no quote says it.",
    ],
    fix: (fx) => {
      fx.reword("Rājendra's inscriptions say he", "(which Hultzsch later corrected to “Śrī-Viṣaya”)", "(which Hultzsch later thought should probably read “Śrī-Viṣaya”)");
      fx.reword("The Pratihāras held the Arab armies west of the Indus.", "which M. Reinaud identified with Kanauj, the Pratihāras' capital, that", "which M. Reinaud identified with Kanauj, that");
    },
  },
  {
    title: "The Mahājanapadas page: Mahāvīra as reformer",
    slug: "mahajanapadas",
    depends: [
      "The Mahājanapadas and the age of the Buddha (c. 600–320 BCE): page, sources and entities",
      "The Mahājanapadas page: fixes after the AI support checks",
    ],
    captures: { wpMahavira: { kind: "wikipedia", title: "Mahavira" } },
    rationale: [
      "The one Mahājanapadas claim still at L2: “For Jains, Mahāvīra is … not the founder of their religion” rested on Jacobi's hedged inference.",
      "- Adds Wikipedia: historians see him as reviving and reforming an earlier community, likely led by Pārśvanātha, “whom Jains consider to be Mahavira's predecessor”.",
    ],
    fix: (fx) => {
      fx.add("For Jains, Mahāvīra", "x_wp_mv_reformer", "@s_wpMahavira", "wpMahavira", "Mahavira is believed by historians to have revived and reformed an earlier Jain or proto-Jain community which had likely been led by Pārśvanātha, whom Jains consider to be Mahavira's predecessor.", { section: "Scholarly accounts: reformer" });
    },
  },
  {
    title: "The Gupta Empire page: Smith on the iron pillar's king",
    slug: "gupta-empire",
    depends: [
      "The Gupta Empire (c. 320–550 CE): page, sources and entities",
      "The Gupta Empire page: last fixes after the support checks",
    ],
    captures: {},
    rationale: [
      "The one Gupta claim still at L2: Smith (1914) “preferring another king, Chandravarman” rested on a citation by location only.",
      "- Smith's footnote (p. 290) is printed in two columns that the scan interleaves with another note, so it cannot be quoted. The claim now keeps only what is quoted (the move from Mathura in 1052), and the location-only citation becomes a mention, with a note on what the footnote says.",
    ],
    fix: (fx) => {
      fx.reword("Vincent Smith (1914) gave up identifying Chandra", "Vincent Smith (1914) gave up identifying Chandra with Chandragupta II, preferring another king, Chandravarman, and thought the pillar", "Vincent Smith (1914) thought the iron pillar");
      const c = fx.claim("Vincent Smith (1914) thought the iron pillar");
      const loc = c.citations.find((x) => x.excerpt.quote === null);
      if (loc && loc.stance !== "mentions") {
        fx.ops.push({ op: "uncite", citation: loc.id } as ChangeOpInput);
        fx.ops.push({ op: "cite", claim: c.id, excerpt: loc.excerpt.id, stance: "mentions", note: "Smith's footnote also gives up the identification with Chandragupta II and prefers Chandravarman of Pushkarana; the two-column scan cannot be quoted." } as ChangeOpInput);
        fx.log.push("stance → mentions: Smith's footnote on Chandravarman (location only)");
      }
    },
  },
];

try {
  const proposals: Proposal[] = [];
  for (const job of JOBS) {
    const done = flags.force ? null : await alreadyProposedOrApplied(mcp, job.title);
    if (done) {
      console.log(`${job.slug}: ${done === "proposed" ? "already waiting for review" : "already applied"}. Nothing to do.`);
      continue;
    }
    const depends = await changesetsByTitle(mcp, job.depends);
    const fx = await claimFixes(mcp, { slug: job.slug, depends, captures: job.captures });
    job.fix(fx);
    if (!fx.ops.length) {
      console.log(`${job.slug}: everything is already fixed. Nothing to do.`);
      continue;
    }
    console.log(fx.log.map((l) => `  ${l}`).join("\n"));
    const proposal = await mcp.call<Proposal>("propose_changes", {
      title: job.title,
      rationale: [...job.rationale, "Claim and citation edits only."].join("\n"),
      dependsOn: depends.map((d) => d.id),
      ops: fx.ops,
    });
    summarize(job.slug, proposal);
    proposals.push(proposal);
  }
  if (proposals.length) await finish(mcp, flags, proposals);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
