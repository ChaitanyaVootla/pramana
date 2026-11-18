/**
 * A follow-up to the Gupta Empire page: public-domain sources for the five
 * claims that rested on Wikipedia alone (c_varaha, c_huns_500, c_kidarites,
 * c_gupta_style, c_label_persists). Proposed THROUGH MCP; it depends on the
 * page's changeset, whose refs (@c_…, @s_…, @x_…) it reuses, so it works
 * whether that changeset is still pending or already applied.
 *
 *   pnpm tsx scripts/seed/gupta-sources-index.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import type { ChangeOpInput } from "@pramana/core";
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen, finish, parseFlags, pendingTitles, summarize, type Proposal } from "../lib/proposal";

const TITLE = "The Gupta Empire: older sources for five claims that rested on Wikipedia";
const PAGE_TITLE = "The Gupta Empire (c. 320–550 CE): page, sources and entities";

const CAPTURES = {
  cunningham1880: { kind: "internet_archive", identifier: "reporttoursinbu00cunngoog" },
  cunninghamCoins: { kind: "internet_archive", identifier: "india.history.resource.110894" },
  smith1914: { kind: "internet_archive", identifier: "earlyhistoryofin00smit" },
  havell: { kind: "internet_archive", identifier: "historyofaryanru00haveuoft" },
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
  if (!page) throw new Error(`no changeset “${PAGE_TITLE}”; run scripts/seed/gupta-index.ts first`);

  const snap = {} as Record<Key, string>;
  for (const [k, origin] of Object.entries(CAPTURES) as [Key, (typeof CAPTURES)[Key]][]) {
    snap[k] = (await mcp.call<{ id: string }>("capture_snapshot", { origin })).id;
  }

  const ops: ChangeOpInput[] = [
    {
      op: "create_source",
      ref: "s_cunningham1880",
      kind: "report",
      tier: "secondary",
      csl: {
        type: "report",
        title: "Report of Tours in Bundelkhand and Malwa in 1874–75 and 1876–77",
        author: [{ family: "Cunningham", given: "Alexander" }],
        issued: { "date-parts": [[1880]] },
        publisher: "Office of the Superintendent of Government Printing",
        "publisher-place": "Calcutta",
        "collection-title": "Archaeological Survey of India Reports",
        volume: "X",
      },
      identifiers: { ia: "reporttoursinbu00cunngoog", url: "https://archive.org/details/reporttoursinbu00cunngoog" },
      license: { status: "public_domain", note: "Government of India report of 1880; Cunningham died 1893. Public domain in India and the US." },
      lenses: ["archaeological"],
      note: "A survey report describing the Udayagiri caves at first hand. Cunningham numbers the caves differently from later surveys.",
    },
    {
      op: "create_source",
      ref: "s_cunningham_coins",
      kind: "article",
      tier: "secondary",
      csl: {
        type: "article-journal",
        title: "Later Indo-Scythians",
        author: [{ family: "Cunningham", given: "Alexander" }],
        "container-title": "Numismatic Chronicle, third series",
        volume: "XIII",
        issued: { "date-parts": [[1893]] },
        note: "Reprinted from the Numismatic Chronicle; this copy collects the series of articles on the coins.",
      },
      identifiers: { ia: "india.history.resource.110894", url: "https://archive.org/details/india.history.resource.110894" },
      license: { status: "public_domain", note: "Published 1893; Cunningham died 1893. Public domain in India and the US." },
      lenses: ["archaeological"],
      note: "Cunningham's study of the coins of the Kidarites (his “Little Kushans”). His dates are of 1893.",
    },
    {
      op: "create_source",
      ref: "s_spink2005",
      kind: "book",
      tier: "secondary",
      csl: {
        type: "book",
        title: "Ajanta: History and Development, Volume 1: The End of the Golden Age",
        author: [{ family: "Spink", given: "Walter M." }],
        issued: { "date-parts": [[2005]] },
        publisher: "Brill",
        "publisher-place": "Leiden",
      },
      identifiers: { isbn: ["978-90-04-14832-1"] },
      license: { status: "copyrighted", note: "Cited by location only, as given by Wikipedia; not read or quoted here." },
      lenses: ["mainstream_academic"],
    },
    {
      op: "create_excerpt",
      ref: "x_cunningham_varaha",
      source: "@s_cunningham1880",
      snapshotId: snap.cunningham1880,
      quote: "This niche contains a colossal figure of Vishnu as the Varaha Avatara, or Boar incarnation, represented as a man with a boar's head.",
      locator: { page: "48", label: "Udayagiri, niche no. 4 (Cunningham's numbering; cave 5 in later surveys)" },
    },
    {
      op: "create_excerpt",
      ref: "x_cunningham_kidara",
      source: "@s_cunningham_coins",
      snapshotId: snap.cunninghamCoins,
      quote: "they begin with KIDARA or KI-TO-LO, the Shahi of the Ta-Yueti, or Great Kushans, who founded the kingdom of the Little Yueti in Gandhara about A.D. 425 to 430.",
      locator: { page: "55", label: "“Little Kushans” (page inferred: the next page is headed 56)" },
    },
    {
      op: "create_excerpt",
      ref: "x_cunningham_kitolo",
      source: "@s_cunningham_coins",
      snapshotId: snap.cunninghamCoins,
      quote: "I have given my reasons for identifying Kidara of the coins with the Kitolo of the Chinese writers, who conquered Gandhara",
      locator: { page: "55", label: "“Little Kushans” (page inferred)" },
    },
    {
      op: "create_excerpt",
      ref: "x_smith14_toramana",
      source: "@s_smith1914",
      snapshotId: snap.smith1914,
      quote: "The leader in this invasion of India, which, no doubt, continued for years, was a chieftain named Toramana, who is known to have been established as ruler of Malwa in Central India prior to A.D. 500.",
      locator: { page: "316", label: "Chapter XII, “The White Huns”" },
    },
    {
      op: "create_excerpt",
      ref: "x_havell_ajanta",
      source: "@s_havell",
      snapshotId: snap.havell,
      quote: "In the noble fresco of the marriage of Prince Siddhartha which decorates the front of the shrine in the first monastic hall — one of a series which are within or very near to the Gupta period",
      locator: { page: "183", pageEnd: "184", label: "Chapter on Gupta art and architecture (pages inferred)" },
      note: "Of the Ajanta paintings.",
    },
    {
      op: "create_excerpt",
      ref: "x_havell_elephanta",
      source: "@s_havell",
      snapshotId: snap.havell,
      quote: "The Saiva sculptures of Elephanta, which belong to the same artistic school, though perhaps of a somewhat later period",
      locator: { page: "184", label: "Chapter on Gupta art and architecture (page inferred)" },
    },
    {
      op: "create_excerpt",
      ref: "x_havell_ellora",
      source: "@s_havell",
      snapshotId: snap.havell,
      quote: "Among the most interesting architectural monuments of the Gupta period is the so-called Vishvakarma Chaitya House at Ellora, which may be assigned to the sixth century.",
      locator: { page: "185", label: "Chapter on Gupta art and architecture (page inferred)" },
    },
    {
      op: "create_excerpt",
      ref: "x_spink2005",
      source: "@s_spink2005",
      locator: { page: "7" },
      note: "Location as given by Wikipedia (Ajanta Caves) for the “golden age” sentence; the book's own title makes the same point. Not checked against the book.",
    },
    { op: "cite", claim: "@c_varaha", excerpt: "@x_cunningham_varaha", stance: "supports" },
    { op: "cite", claim: "@c_huns_500", excerpt: "@x_smith14_toramana", stance: "supports", note: "Smith (1914) has Toramāṇa established in Malwa before 500." },
    { op: "cite", claim: "@c_huns_500", excerpt: "@x_f_huna_toramana", stance: "supports", note: "Fleet: after Skandagupta's death the Hūṇas attacked again under Toramāṇa." },
    { op: "cite", claim: "@c_kidarites", excerpt: "@x_cunningham_kidara", stance: "qualifies", note: "Cunningham (1893) dates Kidara's kingdom in Gandhāra later, about 425–430." },
    { op: "cite", claim: "@c_kidarites", excerpt: "@x_cunningham_kitolo", stance: "supports", note: "Kidara of the coins conquered Gandhāra, the old Kushan land." },
    { op: "cite", claim: "@c_gupta_style", excerpt: "@x_burgess_minister", stance: "supports", note: "Ajanta's Cave XVI was a Vākāṭaka minister's gift." },
    { op: "cite", claim: "@c_gupta_style", excerpt: "@x_havell_ajanta", stance: "qualifies", note: "Havell (1918) counted the Ajanta paintings as “within or very near to the Gupta period”." },
    { op: "cite", claim: "@c_gupta_style", excerpt: "@x_havell_elephanta", stance: "qualifies", note: "Havell put Elephanta in the same school, perhaps later." },
    { op: "cite", claim: "@c_gupta_style", excerpt: "@x_havell_ellora", stance: "qualifies", note: "Havell called an Ellora cave a Gupta-period monument of the sixth century." },
    { op: "cite", claim: "@c_label_persists", excerpt: "@x_spink2005", stance: "supports" },
    { op: "cite", claim: "@c_label_persists", excerpt: "@x_havell_ajanta", stance: "supports", note: "An earlier instance: the art of Ajanta drawn into the Gupta age." },
  ];

  const proposal = await mcp.call<Proposal>("propose_changes", {
    title: TITLE,
    rationale: [
      "Five claims on the Gupta Empire page rested on Wikipedia alone. This adds older or primary-adjacent sources, all public domain except Spink (by page only):",
      "c_varaha: Cunningham's survey report of 1880 describes the Udayagiri Varāha relief at first hand (his niche no. 4 is the later surveys' cave 5).",
      "c_huns_500: Vincent Smith (1914, p. 316) has Toramāṇa established in Malwa before 500, and Fleet (1888, already on the page) says the Hūṇas attacked again under him after Skandagupta's death.",
      "c_kidarites: Cunningham's study of the Kidarite coins (1893) identifies Kidara with the Chinese Kitolo who conquered Gandhāra; he dates it later (c. 425–430) than Wikipedia, so that excerpt qualifies the claim.",
      "c_gupta_style: the Ajanta Cave XVI inscription (Burgess and Indraji 1881, already on the page) supports the Vākāṭaka origin; Havell (1918) is added as qualifying, since he counted Ajanta, Elephanta and Ellora as Gupta-period art. That is the older view the claim corrects.",
      "c_label_persists: Spink's Ajanta: The End of the Golden Age (2005, p. 7), the book Wikipedia cites, by page only; and Havell (1918) as an earlier instance.",
      "Depends on the page's changeset and reuses its refs; nothing on the page itself changes.",
    ].join("\n\n"),
    dependsOn: [page.id],
    ops,
  });
  summarize("gupta sources", proposal);
  await finish(mcp, flags, [proposal]);
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
