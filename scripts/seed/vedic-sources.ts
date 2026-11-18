/**
 * A specialist source for Vedic claims that rested only on Wikipedia: Witzel's
 * study of the Vedic canon (1997) on the Kuru realm as the first state, on
 * Painted Grey Ware as the Kuru culture, and on the span of the Ṛgvedic
 * period. Claims and citations only.
 *
 *   pnpm tsx scripts/seed/vedic-sources.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";
import { WITZEL_CANON_TEXT, WITZEL_CANON_URL } from "./vedic-sources-texts";

const VEDIC = "The Vedic period (c. 1500–500 BCE): page, sources and entities";

await runFixes({
  title: "The Vedic period: a specialist source for claims that rested on Wikipedia",
  parents: [VEDIC],
  page: "vedic-period",
  captures: {
    witzel: {
      kind: "text",
      title: "Witzel 1997, “The Development of the Vedic Canon and its Schools”, pp. 261, 263, 267, 310",
      note: `Passages pasted, unedited, as extracted by pdftotext (-raw) from the author's PDF ${WITZEL_CANON_URL} (sha256 40c26122cc34adc94ecd84543de5436e04a570970465eb25a7111da8541d1532), fetched 2026-10-18. “[p. N]” marks are ours. The PDF's font maps some diacritics oddly (å for ā, a missing ṛ).`,
      text: WITZEL_CANON_TEXT,
    },
  },
  sources: [
    {
      op: "create_source",
      ref: "vs_witzel_canon",
      kind: "chapter",
      tier: "secondary",
      csl: {
        type: "chapter",
        title: "The Development of the Vedic Canon and its Schools: The Social and Political Milieu",
        author: [{ family: "Witzel", given: "Michael" }],
        "container-title": "Inside the Texts, Beyond the Texts: New Approaches to the Study of the Vedas",
        "collection-title": "Harvard Oriental Series, Opera Minora 2",
        editor: [{ family: "Witzel", given: "Michael" }],
        publisher: "Harvard University",
        "publisher-place": "Cambridge, Mass.",
        page: "257-345",
        issued: { "date-parts": [[1997]] },
        URL: WITZEL_CANON_URL,
      },
      identifiers: { url: WITZEL_CANON_URL },
      license: { status: "copyrighted", note: "Author's copy. Quoted briefly." },
      lenses: ["philological"],
      note: "By a leading Vedic philologist: how the Vedic texts were collected, and the Kuru realm in which that happened.",
    },
  ],
  excerpts: [
    { ref: "vx4_witzel_firststate", source: "vs_witzel_canon", snap: "witzel", quote: "The Realm of the Kurus: Origins and Development of the First State in India", locator: { page: "261", label: "Note 20, the title of Witzel's own paper (1989)" } },
    { ref: "vx4_witzel_center", source: "vs_witzel_canon", snap: "witzel", quote: "The Kuru realm became the center of Brahmanical culture", locator: { page: "267" } },
    { ref: "vx4_witzel_pgw", source: "vs_witzel_canon", snap: "witzel", quote: "the eastern peoples did not take part in the Kuru cultural developments, characterized by the Painted Gray Ware culture (PGW)", locator: { page: "310" } },
    { ref: "vx4_witzel_span", source: "vs_witzel_canon", snap: "witzel", quote: "from the infiltration of the Indo-Aryans into the subcontinent, c. 1900 B.C. (at the utmost, the time of collapse of the Indus civilization), up to c. 1200 B.C., the time of the introduction of iron", locator: { page: "263" } },
  ],
  reword: {},
  add: [
    ["v_kuru_state", "vx4_witzel_firststate", "supports", "Witzel's own name for the Kuru realm: the first state in India."],
    ["v_kuru_state", "vx4_witzel_center", "supports"],
    ["v_pgw_kuru", "vx4_witzel_pgw", "supports", "PGW as the Kuru culture; the Vedic texts' collection in the Kuru realm is in the next pages."],
    ["v_pgw_kuru", "vx4_witzel_center", "supports"],
    ["v_modern_date", "vx4_witzel_span", "supports", "The wider range, c. 1900–1200 BCE, for the whole Ṛgvedic period."],
  ],
  remove: [],
  rationale: [
    "Adds a specialist secondary source to three Vedic claims that rested only on Wikipedia (Kuru kingdom, Painted Grey Ware culture) or on Wikipedia and Max Müller (the wider date range): Michael Witzel, “The Development of the Vedic Canon and its Schools” (1997), from the author's PDF, pasted as passages with the PDF's checksum in the snapshot note.",
    "Witzel calls the Kuru realm “the First State in India” (the title of his 1989 paper, cited in note 20), says it “became the center of Brahmanical culture”, ties Painted Grey Ware to the Kuru, and gives c. 1900–1200 BCE for the whole Ṛgvedic period.",
    "Still resting on Wikipedia: the two claims that report the standing of the indigenist view in scholarship, for which a summary source is apt.",
  ],
});
