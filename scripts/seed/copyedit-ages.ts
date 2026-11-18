/**
 * Copy edits for a first-time reader on /p/ages-of-indian-history, the
 * overview, proposed THROUGH MCP (machinery in ./copyedit-lib.ts): an intro
 * without site jargon (“the spine of the site”) or a claim that will date
 * (“the first page with its evidence fully attached”), a concrete example of
 * how a period's name can carry an argument, the independence movement put
 * in its place in the list, and plainer one-line descriptions of the ages
 * (shown on their entity pages and wherever an age is previewed).
 *
 *   pnpm tsx scripts/seed/copyedit-ages.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit, type PageContext } from "./copyedit-lib";

/** The ages in order of their start, with the independence movement between Company rule and the Raj. */
const inOrder = (ids: string[], page: PageContext) => {
  const movement = ids.find((id) => page.slug(id) === "indian-independence-movement");
  const raj = ids.find((id) => page.slug(id) === "british-raj");
  if (!movement || !raj) return ids;
  const rest = ids.filter((id) => id !== movement);
  rest.splice(rest.indexOf(raj), 0, movement);
  return rest;
};

await runCopyEdit({
  page: "ages-of-indian-history",
  title: "Ages of Indian history: plainer words for a first-time reader",
  rationale: [
    "A copy edit of the overview for readers new to Indian history. The intro drops “the spine of the site” and “the first page with its evidence fully attached”, which is no longer the only such page. The note on periods gives a concrete example of a name that carries an argument (whole ages called “Hindu” or “Muslim”; a civilisation named after one river).",
    "The independence movement (1857–1947) was listed after Independent India; it now sits between Company rule and the British Raj, in order of its start.",
    "The Harappan civilisation is relabelled “Indus civilisation”, the title of its page, so a novice meets one name; “Harappan civilisation” stays as an alias.",
    "The ages' one-line descriptions lose jargon (Neolithic, attested, Bronze Age urban, river systems, Vedic texts) and say who the Peshwas and the East India Company were. The Mahājanapadas entry is left for the copy pass on its own page.",
  ],
  blocks: [
    {
      block: "intro",
      was: "c1a7b7d804",
      set: {
        markdown:
          "These are the ages historians commonly use to divide Indian history, from the first farming villages to the present. Each age gets its own page as it is written. A good place to start is the [Maurya Empire](page:maurya-empire).",
      },
    },
    {
      block: "periodisation",
      was: "de2e20f90f",
      why: "a concrete example of a name that carries an argument",
      set: {
        markdown:
          "Ages are a convenience, not a fact. Their names and boundaries are choices that historians make. Some of those choices carry an argument with them: calling whole ages “Hindu” or “Muslim”, for example, or naming a civilisation after a single river. Each age's dates record how they were set.",
      },
    },
    { block: "ages", was: "12443e9ed4", why: "the independence movement in its place", set: { entityIds: inOrder } },
  ],
  entities: [
    {
      entity: "early-farming-communities",
      was: "6ca986a3a3",
      set: { description: "The first farming villages of South Asia, such as Mehrgarh, in today's Pakistan, where people grew crops and herded animals." },
    },
    {
      entity: "harappan-civilisation",
      was: ["236cf05736", "4b25a86177"],
      set: {
        description: "The first cities of South Asia, along the Indus and Ghaggar-Hakra rivers in today's Pakistan and north-west India. Also called the Harappan civilisation.",
      },
    },
    {
      entity: "harappan-civilisation",
      was: "dc06b96957",
      why: "one name everywhere: the label matches its page; “Harappan civilisation” kept as an alias",
      set: {
        label: "Indus civilisation",
        aliases: (aliases: { label: string }[]) =>
          aliases.some((a) => a.label === "Harappan civilisation")
            ? aliases
            : [...aliases, { lang: "en", label: "Harappan civilisation", note: "After Harappa, the first of its cities to be excavated." }],
      },
    },
    {
      entity: "vedic-period",
      was: "828a79c59b",
      set: {
        description: "The age in which the Vedas, the oldest Sanskrit religious texts, were composed: first in the north-west, then in the Ganga plain.",
      },
    },
    {
      entity: "middle-kingdoms",
      was: "dada7ce8e5",
      set: {
        description:
          "The kingdoms that ruled parts of India between the Mauryas and the Guptas, among them the Śuṅgas, the Sātavāhanas, the Indo-Greeks, the Śakas and the Kushans.",
      },
    },
    {
      entity: "vijayanagara-empire",
      was: "361896134a",
      set: { description: "The south Indian empire whose capital, Vijayanagara, survives as the ruins at Hampi, in today's Karnataka." },
    },
    {
      entity: "maratha-confederacy",
      was: "20c8e19b39",
      set: { description: "The Maratha state founded by Shivaji, later a confederacy of Maratha chiefs led by its chief ministers, the Peshwas." },
    },
    {
      entity: "company-rule",
      was: "ddf88c5096",
      set: { description: "Rule over much of India by the East India Company, a British trading company." },
    },
    {
      entity: "british-raj",
      was: "b787eef4b2",
      set: { description: "Rule of India by the British Crown, which took over from the East India Company in 1858." },
    },
  ],
});
