/**
 * Pictures for "The famines of British India", proposed THROUGH MCP: media
 * records for hand-checked Wikimedia Commons files (licence, author and credit
 * read from the API by the MCP server, never typed here), then a gallery in
 * the chapter on 1876–78. Run after famine-british-index.ts has been applied.
 *
 *   pnpm tsx scripts/seed/famine-british-media.ts                    # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Left out: the Statesman's photographs of August 1943. Commons tags them
 * PD-India and PD-1996, but a photograph published in India in 1943 was still
 * in copyright there on 1 January 1996 (60 years from publication), so the US
 * status claimed by the tag does not hold up. Sunil Janah's photographs are in
 * copyright. No lead image: the page opens with people's words, not a picture
 * of the dying.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { PAGE_SLUG } from "./famine-british";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const PICKS: Pick[] = [
  {
    file: "File:Inmates of a relief camp by WW Hooper.jpg",
    ref: "i_relief_camp_1877",
    title: "Inmates of a famine relief camp, Madras Presidency, 1876–78",
    alt: "A photograph of people at a famine relief camp in the Madras Presidency, 1876–78.",
    representation: "historical_photograph",
    representationNote: "Photographed during the famine by Willoughby Wallace Hooper, a British army officer and photographer in the Madras Presidency.",
    objectDate: { start: { year: 1876, era: "CE" }, end: { year: 1878, era: "CE" } },
    depicts: ["great-famine-of-1876-1878"],
    needsUsBasis: true,
  },
  {
    file: "File:Madras famine 1877.jpg",
    ref: "i_relief_iln_1877",
    title: "Distribution of famine relief in the Madras Presidency (Illustrated London News, 1877)",
    alt: "An engraving of famine relief being given out to a crowd in the Madras Presidency, 1877.",
    representation: "made_at_the_time",
    representationNote: "An engraving made for a London weekly, 26 May 1877, for British readers; not a photograph.",
    objectDate: { start: { year: 1877, month: 5, day: 26, era: "CE" } },
    depicts: ["great-famine-of-1876-1878"],
    needsUsBasis: true,
    usBasis: "Published in London in 1877, so public domain in the United States (published before 1931); the artist is not named.",
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "1876-prose",
    block: {
      id: "gal-1876",
      type: "gallery",
      title: "The famine of 1876–78, seen at the time",
      items: [
        {
          media: "i_relief_camp_1877",
          caption:
            "People in a relief camp in the Madras Presidency, photographed during the famine by W. W. Hooper. [Relief workers were paid about a pound of grain a day in early 1877]({claim:In January 1877 Sir Richard Temple}).",
        },
        {
          media: "i_relief_iln_1877",
          caption:
            "Relief being handed out in the Madras Presidency, as an engraver for the Illustrated London News showed it to British readers in May 1877. [The famine covered 58.5 million people]({claim:The famine of 1876–78 struck Madras}).",
        },
      ],
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  await seedPageMedia(mcp, {
    page: PAGE_SLUG,
    mediaTitle: "Pictures for The famines of British India",
    mediaRationale: [
      "Two public-domain files from Wikimedia Commons for the chapter on the famine of 1876–78: W. W. Hooper's photograph of a relief camp in the Madras Presidency (a photograph taken at the time) and an engraving from the Illustrated London News of 26 May 1877 (made at the time, for British readers).",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot. The Statesman's photographs of 1943 are left out: their US status as tagged does not hold up (still in copyright in India on 1 January 1996).",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "The famines of British India: pictures of 1876–78",
    pageRationale: "Adds a gallery of two pictures after the prose of the chapter on 1876–78. Captions link claims already on the page. No block is removed or changed; no lead image.",
    picks: PICKS,
    placements: PLACEMENTS,
    hero: null,
  });
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
