/**
 * Follow-up to vedic-sources.ts from the AI support check of the Witzel
 * citations: his summary that the Kuru region was "the center of Vedic text
 * collection" (p. 295) for the Painted Grey Ware claim, and the "center of
 * Brahmanical culture" excerpt, which does not say "state", made a mention on
 * the Kuru-state claim. Claims and citations only.
 *
 *   pnpm tsx scripts/seed/vedic-sources2.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";
import { WITZEL_CANON_TEXT_295, WITZEL_CANON_URL } from "./vedic-sources-texts";

const VEDIC = "The Vedic period (c. 1500–500 BCE): page, sources and entities";
const SOURCES = "The Vedic period: a specialist source for claims that rested on Wikipedia";

await runFixes({
  title: "The Vedic period: Witzel on the Kuru collection of the texts",
  parents: [VEDIC, SOURCES],
  page: "vedic-period",
  captures: {
    witzel295: {
      kind: "text",
      title: "Witzel 1997, “The Development of the Vedic Canon and its Schools”, p. 295",
      note: `Page pasted, unedited, as extracted by pdftotext (-raw) from the author's PDF ${WITZEL_CANON_URL} (sha256 40c26122cc34adc94ecd84543de5436e04a570970465eb25a7111da8541d1532), fetched 2026-10-18. “[p. N]” is ours. The PDF's font maps some diacritics oddly (å for ā, a missing ṛ).`,
      text: WITZEL_CANON_TEXT_295,
    },
  },
  excerpts: [
    { ref: "vx5_witzel_collection", source: "vs_witzel_canon", snap: "witzel295", quote: "the Kuru region has emerged as the center of Vedic text collection and text formation", locator: { page: "295" } },
  ],
  reword: {},
  add: [
    ["v_pgw_kuru", "vx5_witzel_collection", "supports", "Where the Vedic texts were collected; PGW as the Kuru culture is on p. 310."],
    ["v_kuru_state", "vx4_witzel_center", "mentions", "Background: the Kuru realm's place in Brahmanical culture."],
  ],
  remove: [["v_kuru_state", "vx4_witzel_center"]],
  rationale: [
    "From the AI support check of the Witzel citations added in “a specialist source for claims that rested on Wikipedia”.",
    "Painted Grey Ware claim: adds Witzel's summary (p. 295) that “the Kuru region has emerged as the center of Vedic text collection and text formation”, for “where the Vedic hymns were collected”. Kuru-state claim: “The Kuru realm became the center of Brahmanical culture” does not say “state”, so it becomes a mention; the claim rests on Witzel's “the First State in India”.",
  ],
});
