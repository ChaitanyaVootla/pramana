/**
 * Brings the stored learning prompts and answers of claims on the Indus and
 * Vedic pages in line with the claims' current text (learning-fixes-data.ts):
 * each name and number in them is in the claim. Claims only.
 *
 *   pnpm tsx scripts/seed/learning-fixes.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";
import { LEARNING } from "./learning-fixes-data";

await runFixes({
  title: "The Indus and Vedic pages: learning answers that match the claims",
  parents: [
    "The Indus civilisation (c. 3300–1300 BCE): page, sources and entities",
    "The Vedic period (c. 1500–500 BCE): page, sources and entities",
  ],
  page: "vedic-period",
  excerpts: [],
  reword: Object.fromEntries(Object.entries(LEARNING).map(([ref, learning]) => [ref, { learning }])),
  add: [],
  remove: [],
  rationale: [
    "Stored answers (and a few prompts) on claims of the Indus and Vedic pages were written for earlier wordings, or added names and facts the claim does not state (for example “Dozens” of decipherments, “Lord of animals”, “the Indo-European family”, the Battle of the Ten Kings). Each is rewritten (the Priest-King entry only records the prompt already set) so that every name and number in it is in the claim's current text, the rule review cards use to show a stored answer.",
  ],
});
