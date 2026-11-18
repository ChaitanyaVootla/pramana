/**
 * Glosses for words a first-time reader won't know, proposed THROUGH MCP
 * (machinery in ./copyedit-lib.ts): “consecration” (Aśoka's dates count from
 * it), “regnal years” and “dhamma”. Each is explained where a reader first
 * meets it on the page: in words where the text is plain (claims, chapter
 * promises), as a link to its glossary entry in prose, and in the part's
 * “In this part” terms. Guess and check questions are learn's
 * (learn-content.ts) and are glossed there; dhamma's prose gloss is in
 * copyedit-maurya.ts, which owns that block.
 *
 *   pnpm tsx scripts/seed/copyedit-terms.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit, type PageContext } from "./copyedit-lib";

/** Adds a glossary entity (by slug) to a chapter's terms, unless it is there already. */
const withTerm =
  (slug: string) =>
  (terms: string[] | undefined, page: PageContext): string[] => {
    const list = terms ?? [];
    return list.some((t) => t === slug || page.slug(t) === slug) ? list : [...list, slug];
  };

const CONSECRATION = "the ceremony that made him king";

await runCopyEdit(
  {
    page: "maurya-empire",
    title: "Maurya Empire: words a first-time reader won't know, explained",
    rationale: [
      "“Consecration” dates Aśoka's reign (“the eighth year after his consecration”), but only the Kalinga prose explained it. The Kalinga claim now glosses it in its own words, since claim cards are also read alone (in review), and Part 3, whose guess counts years from it, lists it with its terms.",
    ],
    blocks: [{ block: "ch-dhamma", was: "09d19af5a1", why: "consecration, counted from in this part's guess", set: { terms: withTerm("consecration") } }],
    claims: [
      {
        claim: "Aśoka conquered Kalinga in the eighth year",
        was: "e48b9b1dc3",
        why: "consecration glossed",
        set: { text: `Aśoka conquered Kalinga in the eighth year after his consecration, ${CONSECRATION}.` },
      },
    ],
  },
  {
    page: "mahajanapadas",
    title: "Mahājanapadas: words a first-time reader won't know, explained",
    rationale: [
      "The dating part counts from “Aśoka's consecration” without saying what it was. The prose now says it and links the glossary entry, the claim glosses it in its own words, and the part lists it with its terms.",
    ],
    blocks: [
      { block: "ch-dating", was: "a2f2a2a871", why: "consecration, used in this part's guess and claims", set: { terms: withTerm("consecration") } },
      {
        block: "dating-prose",
        was: "6d4d48a4dc",
        why: "consecration named and explained",
        set: {
          markdown: (md: string) =>
            md.replace(
              /\[The Sri Lankan chronicles count 218 years from the Buddha's death to Aśoka\]\((claim:[^)]+)\); Aśoka can be dated/,
              `[The Sri Lankan chronicles count 218 years from the Buddha's death to Aśoka's consecration]($1), the [ceremony that made him king](entity:consecration). Aśoka can be dated`,
            ),
        },
      },
    ],
    claims: [
      {
        claim: "The Sri Lankan chronicles count 218 years",
        was: "36ce329293",
        why: "consecration glossed",
        set: { text: `The Sri Lankan chronicles count 218 years from the Buddha's death to Aśoka's consecration, ${CONSECRATION}.` },
      },
    ],
  },
  {
    page: "early-medieval-kingdoms",
    title: "Kingdoms of the early medieval age: words a first-time reader won't know, explained",
    rationale: [
      "The promise of the part on sources said “regnal years” with no explanation. It now says it plainly (“the years of each king's reign”), and the part lists the regnal-year entry with its terms, as the Thanjavur part does.",
    ],
    blocks: [
      {
        block: "ch-sources",
        was: "4daefcb4d7",
        why: "regnal years said plainly",
        set: {
          promise: (p: string) =>
            p.replace("Why dates in this period come from kings' regnal years,", "Why dates in this period are counted in the years of each king's reign,"),
          terms: withTerm("regnal-year"),
        },
      },
    ],
  },
  {
    page: "indus-civilisation",
    title: "Indus civilisation: words a first-time reader won't know, explained",
    rationale: ["The part on religion opens with a guess about a “faience tablet”; the part now lists the faience entry with its terms, as the part on daily life does."],
    blocks: [{ block: "ch-religion", was: "a2f2a2a871", why: "faience, in this part's guess", set: { terms: withTerm("faience") } }],
  },
);
