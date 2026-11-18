/**
 * A follow-up to the Mahājanapadas page: older sources for claims that rested
 * on Wikipedia alone (c_cyrus, c_agrammes, c_jain_death, c_urban,
 * c_persia_until). Proposed THROUGH MCP; it depends on the page's changeset,
 * whose refs (@c_…, @s_…, @x_…) it reuses, so it works whether that changeset
 * is still pending or already applied. It changes no page blocks.
 *
 *   pnpm tsx scripts/seed/mahajanapadas-sources-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";

const TITLE = "The Mahājanapadas page: older sources for claims that rested on Wikipedia";
const PAGE_TITLE = "The Mahājanapadas and the age of the Buddha (c. 600–320 BCE): page, sources and entities";

const CAPTURES = {
  arrian: { kind: "internet_archive", identifier: "theanabasisofale46976gut" },
  smith1914: { kind: "internet_archive", identifier: "earlyhistoryofin00smit" },
  bi: { kind: "internet_archive", identifier: "buddhistindia00davirich" },
} as const;
type Key = keyof typeof CAPTURES;

const flags = parseFlags();
const mcp = await connectMcp("pramana-seed");
try {
  if (!flags.force && (await pendingTitles(mcp)).includes(TITLE)) {
    console.log("A changeset with this title is already waiting for review. Nothing to do.");
    process.exit(0);
  }
  const list = await mcp.call<{ id: string; status: string; title: string }[]>("list_changesets", {
    status: ["proposed", "applied"],
    limit: 200,
  });
  const page = list.find((c) => c.title === PAGE_TITLE);
  if (!page) throw new Error(`no changeset “${PAGE_TITLE}”; run scripts/seed/mahajanapadas-index.ts first`);

  const snap = {} as Record<Key, string>;
  for (const [k, origin] of Object.entries(CAPTURES) as [Key, (typeof CAPTURES)[Key]][]) {
    snap[k] = (await mcp.call<{ id: string }>("capture_snapshot", { origin })).id;
  }

  const ops: ChangeOpInput[] = [
    {
      op: "create_excerpt",
      ref: "x_arr_cyrus",
      source: "@s_arrian",
      snapshotId: snap.arrian,
      quote: "For they say that Cyrus also marched into this region for the purpose of invading India; but that he did not effect his retreat before losing the greater part of his army, from the desert and the other difficulties of this route.",
      locator: { chapter: "VI.24", label: "Book VI, chapter 24 (Gedrosia), after Nearchus" },
    },
    {
      op: "create_excerpt",
      ref: "x_smith_agrammes",
      source: "@s_smith1914",
      snapshotId: snap.smith1914,
      quote: "Inasmuch as the capital of the Prasii nation undoubtedly was Pataliputra, the reports made to Alexander can have referred only to the king of Magadha, who must have been one of the Nandas mentioned in native tradition.",
      locator: { page: "40", label: "Chapter II, on Xandrames or Agrammes" },
    },
    {
      op: "create_excerpt",
      ref: "x_bi_starve1",
      source: "@s_bi",
      snapshotId: snap.bi,
      quote: "to slay the King. And Ajatasattu carried out this idea in the eighth year before",
      locator: { page: "14", chapter: "I", label: "Chapter I, The Kings" },
      note: "Devadatta has incited Ajātasattu; the sentence continues on p. 15.",
    },
    {
      op: "create_excerpt",
      ref: "x_bi_starve2",
      source: "@s_bi",
      snapshotId: snap.bi,
      quote: "the Buddha's death, by starving his father slowly to death.",
      locator: { page: "15", chapter: "I", label: "Chapter I, The Kings" },
    },
    { op: "cite", claim: "@c_cyrus", excerpt: "@x_arr_cyrus", stance: "qualifies", note: "Arrian's story, from Nearchus: Cyrus marched through the Gedrosian desert to invade India and lost most of his army." },
    { op: "cite", claim: "@c_agrammes", excerpt: "@x_smith_agrammes", stance: "supports", note: "Smith (1914) takes the king reported to Alexander to be one of the Nandas." },
    { op: "cite", claim: "@c_jain_death", excerpt: "@x_bi_starve2", stance: "qualifies", note: "In the Buddhist version, too, the father dies a prisoner, starved by his son; the two traditions differ on who caused the death." },
    { op: "cite", claim: "@c_parricide", excerpt: "@x_bi_starve1", stance: "supports" },
    { op: "cite", claim: "@c_parricide", excerpt: "@x_bi_starve2", stance: "supports" },
    { op: "cite", claim: "@c_urban", excerpt: "@x_bi_savatthi", stance: "supports", note: "Rhys Davids: six great cities in India during the Buddha's lifetime." },
    { op: "cite", claim: "@c_urban", excerpt: "@x_sbe_great_cities", stance: "supports", note: "The great cities Ānanda names." },
    { op: "cite", claim: "@c_persia_until", excerpt: "@x_arr_gaugamela_indians", stance: "supports", note: "Indians still fought for Darius III at Gaugamela, 331 BCE." },
  ];

  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Six claims on the Mahājanapadas page rested on Wikipedia alone. This adds public-domain sources for five of them:",
      "- **c_cyrus:** Arrian VI.24, after Nearchus: Cyrus marched through Gedrosia to invade India and lost most of his army. It qualifies the claim, since it is a story of a failed invasion.",
      "- **c_agrammes:** Vincent Smith (1914, p. 40) identifies the king reported to Alexander as a Nanda.",
      "- **c_jain_death:** Rhys Davids (1903, pp. 14–15) gives the Buddhist version, in which the son starves his father to death. It qualifies the Jain account and also supports c_parricide.",
      "- **c_urban:** the great cities of the Buddha's time, in Rhys Davids and the Mahāparinibbāna Sutta (excerpts already on the page).",
      "- **c_persia_until:** Indians fighting for Darius III at Gaugamela in 331 BCE (Arrian; excerpt already on the page).",
      "The sixth, c_lists_differ (the Dīgha Nikāya's twelve and the Jain Bhagavatī Sūtra's sixteen), still rests on Wikipedia. No public-domain English translation of those lists was found in the captured texts.",
      "Depends on the page's changeset and reuses its refs. It changes no page blocks.",
    ].join("\n"),
    dependsOn: [page.id],
    ops,
  });
  summarize("mahajanapadas sources", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
