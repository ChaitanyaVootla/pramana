/**
 * Second round of fixes on the Indus page from the AI support checks: the
 * claims still short of L3 after the first round (quotes extended to the words
 * the claims use, or claims narrowed to what is quoted). Claims and citations
 * only; page prose is left to a separate edit.
 *
 *   pnpm tsx scripts/seed/indus-fixes2.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";

const PAGE = "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities";
const SOURCES = "The Indus civilisation: secondary and primary sources for claims that rested on tertiary ones";
const FIXES = "The Indus civilisation: accuracy fixes from the support checks";
const NOTE_1925 = "Marshall's note on the prehistoric civilisation of the Indus";

await runFixes({
  title: "The Indus civilisation: support fixes, round 2",
  parents: [PAGE, SOURCES, FIXES],
  page: "indus-civilisation",
  excerpts: [
    { ref: "x3_asi25_comfort", like: "x_asi25_houses", quote: "are bare of all ornament but are remarkable for the excellence of their construction and for the relatively high degree of comfort evidenced by the presence of wells, bath-rooms, brick flooring and an elaborate system of drainage", locator: { page: "61", label: NOTE_1925 } },
    { ref: "x3_asi25_jewellery", like: "x_asi25_crafts", quote: "they were familiar, nevertheless, with the working of copper, gold, silver and lead and probably of mercury also; they were manufacturing jewellery and other articles in highly polished gold, fine paste and glazed blue and white faience", locator: { page: "62", label: NOTE_1925 } },
    { ref: "x3_dales_salinity", like: "x_dales_floods", quote: "This resulted in a disastrous increase in the already serious floods in the major river valleys with the subsequent rise of the underground water table, contributing to an increase in the soil salinity to the point where it was impossible to sustain the population of the vast urban settlements.", locator: { label: "Closing section" } },
    { ref: "x3_asi25_deity", like: "x_asi25_tablet", quote: "certainly suggests that the central figure was intended to represent a deity rather than a king", locator: { page: "61", label: "Marshall's note: a faience tablet from Mohenjo-daro" } },
    { ref: "x3_possehl06_priestking", like: "x_possehl06_village", quote: "The “Priest-King” from Mohenjo-daro had been lent by the Pakistan Government", locator: { label: "Opening paragraphs" } },
  ],
  reword: {
    c_dholavira: { text: "Dholavira, on the arid island of Khadir in Gujarat, was occupied c. 3000–1500 BCE; it was built largely of stone, with fortifications and a system of reservoirs to store scarce water." },
    c_priestking_name: { text: "“Priest-King” is the common name for a 17.5 cm statuette from Mohenjo-daro; some now read the statue as evidence of contact with neighbouring peoples rather than of a ruling elite." },
    c_pyramid: { text: "In Egypt, the Great Pyramid of Giza was built c. 2600 BCE for the pharaoh Khufu of the Old Kingdom.", assessmentNote: "The date is from Wikipedia; Khufu as builder also from UCL and the Giza Project." },
    c_sea_trade_1926: { text: "In the Survey's report for 1925–26, Marshall held it all but certain that Sind and Sumer were in close contact, by sea rather than by land, though he thought the Great Bath's bitumen more likely came from nearer sources." },
  },
  add: [
    ["c_houses", "x3_asi25_comfort", "supports"],
    ["c_crafts", "x3_asi25_jewellery", "supports"],
    ["c_dales_floods", "x3_dales_salinity", "supports"],
    ["c_tablet_deity", "x3_asi25_deity", "supports"],
    ["c_priestking_name", "x3_possehl06_priestking", "supports", "The statue is from Mohenjo-daro."],
    ["c_oldham", "x_iln_threshold", "supports", "Marshall announced the discovery only in 1924: in 1893 the civilisation was not yet known."],
  ],
  remove: [],
  rationale: [
    "Round 2 of fixes from the AI support checks of the Indus page: the claims still at L2 after the first round.",
    "Quotes extended from the same snapshots to the words the claims use: Marshall's houses (“wells, bath-rooms, brick flooring and an elaborate system of drainage”) and crafts (“jewellery … in highly polished gold … glazed blue and white faience”); Dales's floods and salinity; Marshall's “a deity rather than a king”; Possehl's “The “Priest-King” from Mohenjo-daro”. Marshall's 1924 announcement now supports “before the Indus civilisation was known” on Oldham's claim.",
    "Narrowed to what is quoted: Dholavira (“Kachchh” is in no source); the Priest-King (“no inscription names the man” dropped); the Great Pyramid (the comparison with the Indus mature phase was ours, and is left to the page's “Meanwhile” framing); “By 1926” becomes “in the Survey's report for 1925–26”.",
  ],
});
