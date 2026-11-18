/**
 * Copy follow-ups on /p/early-medieval-kingdoms, proposed THROUGH MCP
 * (machinery in ./copyedit-lib.ts): the prose is brought into line with the
 * content agent's support-check rewordings of its claims (Harṣa's capital no
 * longer “on the Ganges”; Pulakeśin “possibly killed”; Alberuni “at times
 * travelled with Mahmud's troops” rather than living at his court; the
 * Kailāsa temple “believed to have been” cut from one rock), and the
 * “Names you'll meet” line on Uttaramerūr no longer gives away Part 6's
 * guess (committees chosen by lot). Only the words named here change.
 *
 *   pnpm tsx scripts/seed/copyedit-early-medieval.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit } from "./copyedit-lib";

/** Replaces each `from` with its `to`; text already changed, or worded otherwise, is left as it is. */
const swap = (...pairs: [string, string][]) => (md: string) => pairs.reduce((acc, [from, to]) => acc.replace(from, to), md);

await runCopyEdit({
  page: "early-medieval-kingdoms",
  title: "Kingdoms of the early medieval age: wording that matches the evidence",
  rationale: [
    "After the support checks the content agent reworded several claims; the prose that paraphrased them still said what they no longer say. This brings five sentences into line: Harṣa ruled from Kannauj (not “on the Ganges”), Pulakeśin II was “possibly” killed, Alberuni “at times travelled with Mahmud's troops” (not “lived at his court”), and the Kailāsa temple is “believed to have been” cut from a single rock (twice).",
    "Further, after content's reading of the prose against the claims: Xuanzang's six years of war and peace only after thirty; the king of “Jurz”, whom Sulaimān describes, as Reinaud's identification with Kannauj; a chronicler born more than a century after the raid, not “two centuries later”; historians disagree about Mahmud's aims (the claim names Tucker against Habib); Rājendra “caught” the king of Kaḍāram and lists his treasure; the boy who drew the tickets did not know what was inside; and Uttaramerūr's own second assembly, the ūr.",
    "The Uttaramerūr line in “Names you'll meet” said the committees were chosen by lot, which is the answer to Part 6's guess-first question; it now names the Brahmin assembly instead.",
  ],
  blocks: [
    {
      block: "intro",
      was: "40340e1497",
      set: { markdown: swap(["lived at the court of Mahmud of Ghazni]", "travelled with the troops of Mahmud of Ghazni]"]) },
    },
    {
      block: "harsha-prose",
      was: ["db224c68cc", "5d75265dc9"],
      set: {
        markdown: swap(
          ["ruled from Kannauj on the Ganges from 606 to 647]", "ruled from Kannauj from 606 to 647]"],
          ["[describes years of war and then decades of peace]", "[describes six years of war, and peace only after thirty years]"],
        ),
      },
    },
    {
      block: "deccan-prose",
      was: "87e56838b4",
      set: { markdown: swap(["and Pulakeśin died]", "and Pulakeśin was possibly killed]"]) },
    },
    {
      block: "kannauj-prose",
      was: ["7e90d76a42", "bdc03c2c2f"],
      set: {
        markdown: (md: string) =>
          swap(["[the Rāṣṭrakūṭas cut the Kailāsa temple from solid rock]", "[the Rāṣṭrakūṭas are believed to have cut the Kailāsa temple from a single rock]"])(md).replace(
            /, while \[the Pratihāra king had the finest cavalry and was the Arabs' worst enemy\]\((claim:[^)]+)\)/,
            ". [The king of “Jurz”, he added, had the finest cavalry and was the greatest foe of Islam; the scholar Reinaud identified Jurz with Kannauj]($1)",
          ),
      },
    },
    {
      block: "mahmud-prose",
      was: ["01be75a364", "8670460361"],
      set: {
        markdown: (md: string) =>
          swap([
          "[Alberuni, who lived at his court, records that the temple's image was broken and carried to Ghazni]",
          "[Alberuni, who at times travelled with his troops, records that the temple's image was broken and carried to Ghazni]",
        ], [
          "[The story of a great slaughter comes from a chronicler writing two centuries later]",
          "[The story of a great slaughter comes from a chronicler born more than a century after the raid]",
        ])(md).replace(
            /Historians weigh \[religion, money and politics\]\((claim:[^)]+)\) in Mahmud's raids, and \[note/,
            "[Historians disagree about Mahmud's aims]($1), and [note",
          ),
      },
    },
    {
      block: "sea-prose",
      was: "5c35ea88dc",
      why: "“took” is the translator's supplied verb; the treasure is listed, as the inscription lists it",
      set: {
        markdown: (md: string) =>
          md.replace(
            /and captured the king of Kaḍāram\]\((claim:[^)]+)\) with his treasure\./,
            "and caught the king of Kaḍāram]($1). [They list his “large heap of treasures” among the spoils]($1).",
          ),
      },
    },
    {
      block: "villages-prose",
      was: "6eb275c41a",
      why: "the boy did not know what was inside; Uttaramerūr's own second assembly, the ūr",
      set: {
        markdown: (md: string) =>
          swap(["[A young boy drew palm-leaf tickets from a pot]", "[A young boy who did not know what was inside drew the palm-leaf tickets from a pot]"])(md).replace(
            /\[This was the assembly of the village's Brahmins\]\((claim:[^)]+)\); ordinary villages had another\./,
            "[These rules were for the village's Brahmin assembly. Uttaramerūr also had a second assembly, the ūr, open to all classes]($1).",
          ),
      },
    },
    {
      block: "already-know",
      was: ["4bab33eef5", "a8abe71b42"],
      set: {
        items: (items: { text: string }[]) =>
          items.map((it) =>
            it.text.startsWith("“India's first elections.” [Committees were chosen by lot]")
              ? { ...it, text: "“India's first elections.” [The rules concern only the village's Brahmin assembly]({c:Uttaramerūr had two assemblies})." }
              : it.text.startsWith("Raided by Mahmud of Ghazni in 1026. [Much of the familiar story was written two centuries later]")
                ? { ...it, text: it.text.replace("[Much of the familiar story was written two centuries later]", "[Much of the familiar story comes from a much later chronicler]") }
                : it.text.startsWith("[A whole temple cut from one rock]")
                ? { ...it, text: it.text.replace("[A whole temple cut from one rock]", "[A whole temple believed to be cut from one rock]") }
                : it,
          ),
      },
    },
  ],
  claims: [
    {
      claim: "Mahmud of Ghazni's raids had a single motive",
      was: "7e2f4b0869",
      why: "the historians named as the claim on their disagreement names them (Habib held it was plunder alone)",
      set: {
        assessmentNote:
          "His own court historians present holy war; his army included Indian soldiers; he carried off enormous wealth. Historians still disagree: Spencer Tucker saw money and religion together, Mohammad Habib plunder alone, and Romila Thapar a political act.",
      },
    },
  ],
});
