/**
 * Copy edits for a first-time reader on /p/maurya-empire, proposed THROUGH
 * MCP (machinery in ./copyedit-lib.ts): shorter sentences, Kalinga placed on
 * the modern map, terms glossed before they are used (consecration, lay
 * Buddhist, Prakrit), scholars introduced, and the two notes
 * that read as editors' to-dos rewritten for the learner. No claim's
 * assertion, citation or quotation changes.
 *
 *   pnpm tsx scripts/seed/copyedit-maurya.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit } from "./copyedit-lib";
import { MAURYA_FIXES, mauryaFixes } from "./sources-maurya";

await runCopyEdit({
  page: "maurya-empire",
  newClaims: async (_mcp, view) => ({ ops: mauryaFixes(view), refs: new Map() }),
  title: "Maurya Empire: plainer words for a first-time reader",
  rationale: [
    "Evidence fixes after the AI support checks of October 2026 (docs/research/2026-10-support-checks.md): quotes that stopped short of the words carrying their claim are extended (Prinsep's decipherment; the Lumbinī pillar, section B; the Kalinga suffering, section E; roots and fruits, section C; the Arthaśāstra's bargain from the anarchy to the king's side; the dating of Rock Edict XIII), excerpts anchored on another page or version than their locator said are re-quoted with the right one (Rock Edict II on the Kālsī page; Rock Edict XIII sections A and Q on the Shāhbāzgaṛhī pages 68 and 70; the colophon in Book XV, not Shamasastry's preface), and five claims are worded as their sources word them (“briefly”; Hultzsch's brackets; “confirms in a general way”; “most likely completed”; the spies' speech). Superseded excerpts are withdrawn from these claims.",
    "A copy edit for readers new to the period, after a review of the era pages for novice clarity. Long sentences are split to one idea each (Parts 1, 2, 3, 4 and 8); Kalinga is placed in modern Odisha and Lumbinī in Nepal; consecration is explained where it is first used; a misplaced gloss (the dhamma-mahāmātras followed “pillars”) is fixed; Prinsep and Kangle are introduced.",
    "Two notes read as editors' to-dos: “taken here from an encyclopedia (Wikipedia), not yet from the scholarship it cites … Greek synchronisms” in Part 1, and “cited by its page numbers only, because those books are still in copyright” in Part 8. They now say what that means for the learner.",
  ],
  moves: [{ block: "meanwhile", after: "greek-prose", why: "next to the part it belongs to: Aśoka names these kings in Rock Edict XIII" }],
  blocks: [
    {
      block: "intro",
      was: ["5f774d9a2f", "62a8c207bc"],
      why: "the source says “briefly”; Patna left to Part 1, whose guess asks for it",
      set: {
        markdown: (md: string) =>
          md
            .replace("[held the main cities and routes", "[briefly held the main cities and routes")
            .replace(/, \[the city that lies beneath modern Patna\]\(claim:[^)]+\)/, ""),
      },
    },
    {
      block: "already-know",
      was: ["bce10b5155", "0f7f0f3c4a"],
      why: "no longer gives away three guesses (Patna; the 570 towers; the 150,000 deported)",
      set: {
        items: (items: { text: string }[]) =>
          items.map((it) =>
            it.text.startsWith("Modern Patna, and the Maurya capital.")
              ? { ...it, text: "The Maurya capital. [A Greek visitor described its walls and gates]({c:Megasthenes described Pāṭaliputra})." }
              : it.text.startsWith("The one war we know from the winner's own account: [150,000")
                ? { ...it, text: "The one war we know from the winner's own account: [an edict that counts the cost and records his regret]({c:Rock Edict XIII puts the toll})." }
                : it,
          ),
      },
    },
    {
      block: "empire-prose",
      was: ["93ce5fcf56", "2f3b5fa8c2", "c9fcfa234a"],
      why: "the sources sentence split; the Arthaśāstra glossed in plain words; opening continues from the brief",
      set: {
        markdown: [
          "The empire began in Magadha, in what is now the Indian state of Bihar, and lasted in loose-knit form [until 185 BCE]({c:The Maurya Empire was founded}). At its widest, under Chandragupta's grandson [Aśoka](entity:ashoka), [only the far south lay outside it]({c:Under Aśoka the empire}).",
          "Almost everything we know comes from [two kinds of writing]({c:The main written sources}). One is Aśoka's own inscriptions. The other is a lost book by [Megasthenes](entity:megasthenes), a Greek envoy at Chandragupta's court. It survives only in pieces, quoted by Greek and Roman writers centuries later. A third text is often added: the [Arthaśāstra](entity:arthashastra), a manual on how to run a state. “Running the empire” explains why using it is a choice.",
        ].join("\n\n"),
      },
    },
    {
      block: "empire-care",
      was: "aab0955f2e",
      why: "an editor's to-do and “Greek synchronisms” rewritten for the learner",
      set: {
        markdown:
          "Read with care. Treat the dates as approximate. No Maurya record uses a calendar we can convert directly. Historians work the dates out from the edicts, from Greek kings whose dates are known, and from later chronicles. The founding date, the capital and the empire's reach come from an encyclopedia, not yet from the studies behind it.",
      },
    },
    {
      block: "kalinga-prose",
      was: ["1dc667418c", "b9ed7625d1"],
      why: "Kalinga placed; consecration explained where it is first used; opening continues from the brief",
      set: {
        markdown:
          "Kings usually boast about their wars. Aśoka did something stranger: he carved his regret into stone. [Kalinga](entity:kalinga-war) lay on India's east coast, in what is now Odisha. Aśoka dates its conquest [by the years since his consecration]({c:Aśoka conquered Kalinga}), the [ceremony that made him king](entity:consecration). He [gives the toll]({c:Rock Edict XIII puts the toll}) in a long inscription that modern editors call [Rock Edict](entity:rock-edict) XIII, and [his repentance]({c:Aśoka publicly declared}) follows the numbers.",
      },
    },
    {
      block: "dhamma-prose",
      was: ["1298cfae1f", "f8e368f69a", "dc76666a6a", "0378b31081"],
      why: "dhamma and lay Buddhist glossed; the dhamma-mahāmātras gloss put next to the officers; Lumbinī placed; opening continues from the brief",
      set: {
        markdown: [
          "The edicts tie Aśoka's change of heart to the aftermath of Kalinga, not to the battle itself: [afterwards, he says, he devoted himself to the study, love and teaching of dhamma]({c:After taking Kalinga, Aśoka says}). [Dhamma](entity:dhamma) is the edicts' word for right conduct. He was already [a lay Buddhist, not a monk, but for over two and a half years “not very zealous”]({c:By his own account, Aśoka}). [That changed after he visited the Saṅgha]({c:By his own account, Aśoka}), the [community of Buddhist monks and nuns](entity:sangha).",
          "He then made dhamma a matter of government. [He appointed officers of dhamma]({c:Aśoka appointed special officers}), the [dhamma-mahāmātras](entity:dhamma-mahamatra), [and raised inscribed pillars]({c:Aśoka appointed special officers}). [In the twentieth year after his consecration he visited Lumbinī, in today's Nepal, where the Buddha was born]({c:In the twentieth year after}). He set up a pillar there, and [freed the village from taxes, leaving it an eighth share to pay]({c:Aśoka exempted the village}).",
        ].join("\n\n"),
      },
    },
    {
      block: "greek-prose",
      was: ["e727878581", "0ce3185c19", "7dd62d4b00"],
      why: "shorter sentences; opening continues from the brief",
      set: {
        markdown: [
          "Aśoka's world was wider than India. He says his [conquest by morality reached as far as the Greek kingdoms]({c:Aśoka claimed to have won}), “six hundred [yojanas](entity:yojana)” away. The edict calls the first king [Antiyoga, a Yona, and names four beyond him]({c:Rock Edict XIII names a Greek}); [Yona](entity:yona) is its word for Greek. [Scholars read them as Antiochus II of Syria, Ptolemy II of Egypt, Antigonus Gonatas of Macedonia, Magas of Cyrene and an Alexander]({c:Scholars identify these kings}).",
          "[We know when these kings reigned]({c:Because these Hellenistic kings'}). [So this one passage confirms that the author of the edicts is Aśoka, and helps fix his reign in time]({c:Because these Hellenistic kings'}). “Reading the stone” tells that part of the story.",
        ].join("\n\n"),
      },
    },
    {
      block: "greek-care",
      was: "bd38203c6d",
      why: "Prakrit glossed; shorter sentences",
      set: {
        markdown:
          "Read with care. The stone gives the names in Prakrit, the everyday language of the edicts: Antiyoga, Tulamaya, Antekina, Maka, Alikyashudala. Matching them to Greek kings is the scholars' work, generally accepted since the 19th century. Which Alexander is meant is still debated. The “conquest by morality” is the king's own claim, in his own inscription.",
      },
    },
    {
      block: "running-prose",
      was: ["8a1b9a9f99", "0f3347b266"],
      why: "“text critics” and “sluices” in plain words",
      set: {
        markdown: [
          "Two kinds of evidence describe how the Mauryas governed, and they do not describe the same thing. The edicts tell us what Aśoka wanted known: [officers of dhamma and inscribed pillars]({c:Aśoka appointed special officers}). The [Arthaśāstra](entity:arthashastra) tells us what a king *should* do, [down to the disguises his spies should wear]({c:The Arthaśāstra prescribes a network}).",
          "It is a manual, not a report. [The surviving version was probably finished centuries after the Mauryas]({c:The surviving Arthaśāstra was probably}). Using it to describe their state is a choice, and this page says so where it does. A third witness, Megasthenes, describes [officials who measured land and inspected the gates that shared out canal water]({c:Megasthenes describes officials}).",
        ].join("\n\n"),
      },
    },
    {
      block: "society-prose",
      was: ["d1a9f49a31", "674a23d705"],
      why: "Kangle introduced; opening continues from the brief",
      set: {
        markdown: [
          "Aśoka's care, he says, [reached his neighbours' lands as well as his own]({c:Aśoka claims to have provided}), and [where healing herbs were lacking he had them imported and planted]({c:Where medicinal herbs}). Megasthenes, looking from outside, [sorted Indian society into seven classes with the philosophers first]({c:Megasthenes divided Indian society}).",
          "On slavery the witnesses seem to disagree. [Arrian, citing Megasthenes, says no Indian was a slave]({c:Arrian, citing Megasthenes}), but [the Arthaśāstra has a whole chapter of rules for dāsas]({c:The Arthaśāstra has a chapter of rules}). [The scholar R. P. Kangle argued that a dāsa was not a slave in the Greek sense]({c:Kangle argued}). What the word [dāsa](entity:dasa) covered is itself debated.",
        ].join("\n\n"),
      },
    },
    {
      block: "stone-prose",
      was: ["082df4dcbf", "42686f4ebb", "90d17ce1ac", "880733a5e6"],
      why: "Prinsep and Kangle introduced; shorter sentences; opening continues from the brief",
      set: {
        markdown: [
          "For a long time the edicts could not be read, and most of them name their author only as “Devānaṃpiya Piyadasi”, beloved of the gods. [Prinsep's key was the script itself]({c:James Prinsep completed}), [Brāhmī](entity:brahmi), which he finished deciphering. [The Greek kings named in Rock Edict XIII]({c:Rock Edict XIII names a Greek}) have known dates, which [tie the edicts to Aśoka and help fix when he reigned]({c:Because these Hellenistic kings'}). E. Hultzsch's 1925 edition is the translation quoted on this page.",
          "The Arthaśāstra has a puzzle of its own. [The text presents itself as the work of the man who rescued the land from the Nanda king]({c:The Arthaśāstra presents itself}). By tradition that man was Kauṭilya, Chandragupta's minister. [The scholar R. P. Kangle found no substantial part that could be shown to be later]({c:R. P. Kangle held}). But [it was probably revised over time, and most likely reached its present form between the 1st and 3rd centuries CE]({c:The surviving Arthaśāstra was probably}).",
        ].join("\n\n"),
      },
    },
    {
      block: "stone-method",
      was: "c86662df4d",
      why: "an editor's to-do rewritten for the learner",
      set: {
        markdown:
          "How we know. Prinsep's date comes from an encyclopedia for now. The modern studies of the Arthaśāstra's date, by Trautmann (1971) and Olivelle (2013), are cited by page, but their words are not quoted here.",
      },
    },
    {
      block: "roads-prose",
      was: ["32e7f89075"],
      why: "opening continues from the brief",
      set: {
        markdown: (md: string) =>
          [
            "Both witnesses agree on one thing: the Mauryas built. Megasthenes' road pillars [marked side roads and distances]({c:Megasthenes reports that officials}), and his capital had [a moat and 64 gates as well as its 570 towers]({c:Megasthenes described Pāṭaliputra}). Aśoka's trees and wells, he says in a [Pillar Edict](entity:pillar-edict) and a Rock Edict, [were for people and animals alike]({c:Aśoka records having trees}). [Patna stands on the site of the capital today]({c:The Maurya capital, Pāṭaliputra}).",
            ...md.split("\n\n").slice(1),
          ].join("\n\n"),
      },
    },
    {
      block: "often-prose",
      was: ["4f97038240"],
      why: "opening continues from the brief",
      set: {
        markdown:
          "Each belief below is shown with the sources on this page that correct or qualify it: one is weakly supported, one is refuted, and one is a real argument among scholars.",
      },
    },
  ],
  // Rewordings after the AI support checks (docs/research/2026-10-support-checks.md); the evidence fixes are in sources-maurya.ts.
  claims: [
    {
      claim: "Under Aśoka the empire",
      was: "2eb496c1cf",
      why: "the source says “briefly”",
      set: { text: "Under Aśoka the empire briefly controlled the major cities and routes of the subcontinent, except the far south." },
    },
    {
      claim: "Aśoka exempted the village of Lumbinī",
      was: "f0e37a86a1",
      why: "“only” and “of the produce” are the translator's brackets",
      set: {
        text: "Aśoka exempted the village of Lumbinī from taxes and made it liable to pay an eighth share; “only” and “of the produce” are the translator's additions in brackets.",
      },
    },
    {
      claim: "Because these Hellenistic kings' reigns",
      was: ["1e410b276a", "2c0d83bd2c"],
      why: "Hultzsch: “confirms in a general way”; no quote says the reigns are known from Greek sources (verifier)",
      set: { text: "Because these Hellenistic kings' reigns are known, the edict broadly confirms that its author is Aśoka and helps date his reign." },
    },
    {
      claim: "Most text-critical scholarship holds",
      was: "a5a2526c16",
      why: "worded as the source words it, not as a count of scholars",
      set: {
        text: "The surviving Arthaśāstra was probably edited over time, and most likely completed in its present form between the 1st and 3rd centuries CE; its author and date are unknown.",
      },
    },
    {
      claim: "The Arthaśāstra justifies kingship as a bargain",
      was: "aabef34868",
      why: "the bargain is a speech the king's spies are to make, and has two sides",
      set: {
        text: "The Arthaśāstra justifies kingship as a bargain, in a speech the king's spies are to make: people suffering from anarchy chose a king and allotted him one-sixth of their grain and one-tenth of merchandise, and kings in return kept them safe.",
      },
    },
  ],
  entities: [
    {
      entity: "pataliputra",
      was: ["7083bc0da8"],
      why: "the founding year is traditional, and approximate",
      set: (() => {
        const basis =
          "Traditional: Buddhist and Purāṇic tradition credit the fort at Pāṭaligāma to Ajātasattu and the move of the capital there to his successor Udayin (see the Mahājanapadas page). The year is Wikidata's inception date (Q389755), taken as approximate.";
        const edtf = "-0489~/";
        // Left as they are once done: the page view adds derived fields (bounds, label) that an input cannot carry.
        return {
          when: (w: { edtf: string }) => (w.edtf === edtf ? w : { edtf, basis }),
          spans: (spans: { when: { edtf: string } }[]) =>
            spans.length === 1 && spans[0]!.when.edtf === edtf
              ? spans
              : [{ role: "existence", when: { edtf }, basis, source: { wikidata: { qid: "Q389755", property: "P571" } } }],
        };
      })(),
    },
  ],
  // People named only as the writer or speaker of a claim's source: “Who wrote about it”.
  authors: [
    { claim: "Arrian, citing Megasthenes", authors: ["megasthenes"] },
    { claim: "Megasthenes described Pāṭaliputra", authors: ["megasthenes"] },
    { claim: "Megasthenes describes officials", authors: ["megasthenes"] },
    { claim: "Megasthenes divided Indian society", authors: ["megasthenes"] },
    { claim: "Megasthenes reports that officials", authors: ["megasthenes"] },
  ],
});
