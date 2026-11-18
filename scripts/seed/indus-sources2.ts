/**
 * A secondary source for the two Lothal claims, which rested only on
 * Wikipedia: Green (2021, CC BY), already a source on the page, calls the
 * basin "a possible dock or reservoir". Claims and citations only.
 *
 *   pnpm tsx scripts/seed/indus-sources2.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";

const PAGE = "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities";

await runFixes({
  title: "The Indus civilisation: a secondary source for the Lothal claims",
  parents: [PAGE],
  page: "indus-civilisation",
  excerpts: [
    { ref: "x4_green_lothal", like: "x_green_priestking", quote: "Lothal’s Urban phase occupation included a possible dock or reservoir and “warehouse” (Rao 1973).", locator: { section: "Settlement Growth and Nucleation" } },
  ],
  reword: {},
  add: [
    ["c_lothal_dock", "x4_green_lothal", "qualifies", "Green cites the excavator, S. R. Rao, but calls the basin only a possible dock, or a reservoir."],
    ["c_lothal_tank", "x4_green_lothal", "supports", "That the basin may have been a reservoir; the size of the town rests on Wikipedia."],
  ],
  remove: [],
  rationale: [
    "The two Lothal claims (the dock reading and the tank reading) rested only on Wikipedia. Green (2021), already cited on the page, says Lothal had “a possible dock or reservoir”, citing the excavator, Rao (1973): the reading is open.",
    "Still resting on Wikipedia: that Lothal was a fairly small town, and the later debate on the “Pashupati” seal (Srinivasan's reading), for want of an open source found.",
  ],
});
