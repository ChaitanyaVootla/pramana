/**
 * Copy edits on /p/vedic-period, proposed THROUGH MCP (machinery in
 * ./copyedit-lib.ts), to the standard of the other era pages' briefs: every
 * "How we know" names concrete evidence, the "Often said" part gets a brief,
 * and the intro no longer gives away two guess-first answers (the hymns'
 * wealth in cattle and horses; the fire moving east). The page and its other
 * briefs are content-indus's; only these fields change.
 *
 *   pnpm tsx scripts/seed/copyedit-vedic.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit } from "./copyedit-lib";

type Brief = { happened: string; howWeKnow: string };
const howWeKnow = (text: string) => (b: Brief) => ({ ...b, howWeKnow: text });
/** Adds a claim-linked phrase to "happened" (so the brief gives its guess's answer), unless it is there already. */
const addToHappened = (marker: string, edit: (happened: string) => string) => (b: Brief) =>
  b.happened.includes(marker) ? b : { ...b, happened: edit(b.happened) };
/** Replaces each `from` with its `to`; text already changed, or worded otherwise, is left as it is. */
const swap = (...pairs: [string, string][]) => (md: string) => pairs.reduce((acc, [from, to]) => acc.replace(from, to), md);

await runCopyEdit({
  page: "vedic-period",
  title: "Vedic period: clearer summaries and wording",
  rationale: [
    "The briefs written with the page already met the 30-word limit. Two “How we know” lines are made concrete (the river hymn for the world of the hymns; “an encyclopedia” rather than “summarised through Wikipedia”), and the “Often said” part gets a brief, like the other era pages.",
    "After content-indus's rewordings, the iron prose said more than its claim (the “dark ayas” is iron, where Macdonell only thought so) and less than clearly where Painted Grey Ware sites lie; the dating prose now says that Macdonell rejected Jacobi's 4000 BCE, as the Jacobi claim's note quotes him; and the iron brief names Witzel (1997), now cited for Painted Grey Ware and the Kurus.",
    "“Meanwhile, to the west” moves from the top of the page into Part 2, after the prose on dating the hymns, which discusses both its items (the Mitanni treaties and the oldest Iranian), as on the Indus, Mahājanapadas and Maurya pages, where a single-subject “Meanwhile” sits in its part.",
    "The intro gave away two guess-first answers before their parts: the hymns measure wealth “in cattle and horses” (Part 3's guess) and the sacred fire moved “east” (Part 6's guess). Both are left to their parts; the claims stay linked from there.",
  ],
  moves: [{ block: "meanwhile", after: "dating-prose", why: "next to the part on dating the hymns, which discusses the Mitanni treaties and Macdonell's Iranian argument it lists" }],
  blocks: [
    {
      block: "intro",
      was: ["21c0d626fe", "def1d9dc45"],
      why: "two guess-first answers left to their parts",
      set: {
        markdown: (md: string) =>
          md
            .replace(/, with \[their cattle and horses\]\(claim:[^)]+\) and \[their warrior god Indra\]/, " and praised [their warrior god Indra]")
            .replace("), with [their warrior god Indra]", ") and praised [their warrior god Indra]")
            .replace("Later texts follow them [east into the Ganga plain]", "Later texts follow them [into new lands]"),
      },
    },
    {
      block: "ch-hymns",
      was: ["349b338f52", "7d98cfa529"],
      why: "the river hymn named; the brief gives the guess's answer, Indra",
      set: {
        brief: (b: Brief) =>
          addToHappened("praised Indra", (h) => h.replace(/\), and \[remembered a battle/, "), [praised Indra, who slew the serpent Vṛtra]({c:Indra is the great warrior god}), and [remembered a battle"))(
            howWeKnow("Only from the hymns themselves, such as [the river hymn, 10.75]({c:The hymns' world is the land}): poems for ritual, not chronicles.")(b),
          ),
      },
    },
    {
      block: "iron-prose",
      was: "bf6d57dea2",
      why: "the dark ayas is iron only in Macdonell's view; where the sites are, said plainly",
      set: {
        markdown: swap(
          ["the Atharvaveda's “dark ayas” is iron, newly come]", "the Atharvaveda's “dark ayas” was, Macdonell thought, iron, newly come]"],
          ["whose sites [return to the Ghaggar-Hakra valley]", "with sites [also in the Ghaggar-Hakra valley]"],
        ),
      },
    },
    {
      block: "dating-prose",
      was: "081750ebf5",
      why: "Macdonell's rejection of Jacobi, as the Jacobi claim's note quotes it",
      set: {
        markdown: (md: string) =>
          md.replace(/(\[Jacobi, from astronomy, pushed the date back to 4000 BCE\]\(claim:[^)]+\))(?!, which)/, "$1, which Macdonell rejected"),
      },
    },
    {
      block: "ch-iron",
      was: ["47767a0967", "96c73c155b", "4dc50440f5", "bad4c11170"],
      why: "Witzel (1997), now cited for Painted Grey Ware and the Kurus, named; the iron is Macdonell's reading; the brief gives the guess's answer, the river's revived flow",
      set: {
        // "happened" is set whole: the iron is Macdonell's reading of the texts (content-indus's wording of the ayas claim), and the
        // Ghaggar-Hakra sites give Part 9's guess its answer. 30 words.
        brief: (b: Brief) =>
          ((h: Brief) => ({
            ...h,
            happened:
              "[Iron reached the texts late, Macdonell thought]({c:The Ṛgveda's metal, ayas}). [Iron Age Painted Grey Ware sites of about 1200–600 BCE]({c:Painted Grey Ware, an Iron Age}) lie [probably in Kuru-Pañcāla lands]({c:Painted Grey Ware probably corresponds}), [some where the Ghaggar-Hakra's seasonal flow perhaps revived]({c:Painted Grey Ware sites reappear}).",
          }))(
            howWeKnow(
              "From [Macdonell on the texts' metals]({c:The Ṛgveda's metal, ayas}), and from archaeology as [Witzel]({c:Painted Grey Ware probably corresponds}) and an encyclopedia report it; no borders survive.",
            )(b),
          ),
      },
    },
    {
      block: "ch-varna",
      was: "793539a295",
      why: "the brief gives the guess's answer: the brāhmaṇa was the primeval Man's mouth",
      set: {
        brief: addToHappened("his mouth", (h) =>
          h.replace(/(\[Only one late hymn names the four varṇas\]\(claim:[^)]+\));/, "$1, [the brāhmaṇa “his mouth”, the śūdra his feet]({c:One hymn of the Ṛgveda});"),
        ),
      },
    },
    {
      block: "ch-often",
      was: "44136fa355",
      set: {
        brief: {
          happened:
            "Six beliefs, among them [that the Vedas were written down from the start]({c:The Vedas were written down}), [that the Ṛgveda lays down caste]({c:The Ṛgveda lays down}) and [that Aryan invaders destroyed the Indus cities]({c:Aryan invaders conquered}).",
          howWeKnow:
            "Against them stand [the hymns' long life by memory]({c:The Vedic hymns were composed}), [the single late hymn on varṇa]({c:The Puruṣa Sūkta is the only hymn}) and [the missing destruction layer]({c:There is no destruction layer}).",
        },
      },
    },
  ],
});
