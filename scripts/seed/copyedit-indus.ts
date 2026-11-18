/**
 * Copy edits for a first-time reader on /p/indus-civilisation, proposed
 * THROUGH MCP (machinery in ./copyedit-lib.ts): modern places for the sites,
 * terms glossed where they are used (Mature Harappan, citadel, bitumen,
 * faience, steatite, bilingual inscription, Aryans, Indra, deurbanisation,
 * ancient genome), scholars introduced, shorter sentences, a corrected
 * sentence about Cunningham's bull, and claim and debate notes that say
 * what an editor's caveat means for the learner. No claim's text changes,
 * so captions that link claims by their opening words still find them.
 *
 *   pnpm tsx scripts/seed/copyedit-indus.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit } from "./copyedit-lib";

await runCopyEdit({
  page: "indus-civilisation",
  title: "Indus civilisation: plainer words for a first-time reader",
  rationale: [
    "A copy edit for readers new to the period, after a review of the era pages for novice clarity. Sites are placed on the modern map (Harappa in Pakistan's Punjab, Mohenjo-daro in Sindh, Dholavira in Kachchh, Gujarat, Rakhigarhi in Haryana, Sumer and Mesopotamia in today's Iraq), as their entity descriptions and claims give them. Terms are glossed where the prose uses them, and long sentences are split.",
    "One correction: Part 5 said the humped bull was the one “Cunningham had thought un-Indian”. His seal showed a bull with no hump, and that is why he thought it foreign (see the claim on his 1875 seal).",
    "Notes that read as editors' to-dos (“from Wikipedia”, “as Wikipedia summarises them”, author lists in brackets) now say what that means for the learner. The citations still show where each point comes from. Claim texts are not touched.",
  ],
  moves: [{ block: "meanwhile", after: "trade-prose", why: "next to the part on trade with Mesopotamia, which it belongs to" }],
  blocks: [
    {
      block: "ch-found",
      was: ["2c67aaba8b"],
      why: "the year is left to the part's guess",
      set: { promise: "How a traveller's mounds, a railway's bricks and a strange seal turned into a lost civilisation." },
    },
    {
      block: "often-prose",
      was: ["1aca800aae"],
      why: "opening continues from the brief",
      set: { markdown: "Each belief below is set against what the sources on this page say." },
    },
    {
      block: "how-prose",
      was: ["9f04ef83b9"],
      why: "opening continues from the brief",
      set: { markdown: (md: string) => ["Apart from a few Mesopotamian mentions of Meluhha, [everything we know comes from archaeology]({c:No historical texts about the Indus}). The methods have changed: [in 1925 an aeroplane survey found new sites along an old bed of the Ravi]({c:In 1924–25 an experimental aeroplane}). Today geologists date river sand, and geneticists read ancient DNA.", ...md.split("\n\n").slice(1)].join("\n\n") },
    },
    {
      block: "intro",
      was: ["03b68b258a", "8be68c2ac4"],
      why: "the Indus placed on the modern map",
      set: {
        markdown: [
          "Nearly five thousand years ago, people in the valley of the [Indus](entity:indus-river) and its neighbouring rivers built some of the world's first cities. The Indus flows through today's Pakistan and north-west India. [Their remains cover a larger area than ancient Egypt or Mesopotamia]({c:The remains of the Indus civilisation}). [Their streets were laid out on a plan]({c:At Mohenjo-daro the buildings}), their houses had drains, and [cities hundreds of miles apart used the same bricks and weights]({c:Cities far apart, such as Harappa}). [The cities flourished from about 2600 to 1900 BCE]({c:The Indus civilisation is usually dated}).",
          "Yet we do not know what these people called themselves, what language they spoke, or who ruled them, if anyone did. [Their writing has never been deciphered]({c:The Indus script has not been deciphered}), and [almost everything we know comes from archaeology]({c:No historical texts about the Indus}). So this page is also a story about evidence: what was dug up, what the excavators thought it meant, and which of their ideas still stand.",
        ].join("\n\n"),
      },
    },
    {
      block: "meanwhile",
      was: "4cc4addec8",
      why: "an editor's note rewritten for the learner",
      set: {
        note: "The Mesopotamian items are not a guess about who lived at the same time: Mesopotamian kings name Meluhha in their own inscriptions, and most scholars take Meluhha to be the Indus civilisation. The Egyptian line only compares two chronologies, and its date comes from an encyclopedia.",
      },
    },
    {
      block: "found-prose",
      was: ["7d6d829338", "9dd51c4b2f"],
      why: "sites placed; Cunningham, Marshall's post and Sumer explained; shorter sentences",
      set: {
        markdown: [
          "[In 1826 a traveller, Charles Masson, camped beside a great mound at Harappa]({c:The traveller Charles Masson}), in the Punjab, now in Pakistan. Local people told him a city had stood there and been destroyed for its king's sins. [Masson thought it was a town from Alexander the Great's wars]({c:Masson took the mounds of Harappa}). No one guessed it was two thousand years older. Fifty years later [railway builders were carting its bricks away by the million]({c:In the 19th century so many bricks}). The archaeologist [Alexander Cunningham](entity:alexander-cunningham) picked up [a small stone seal with a bull and six unknown signs]({c:In 1875 Cunningham published a seal}). He decided it must be foreign.",
          "[Real digging began in 1920–21 at Harappa, and in 1921–22 at Mohenjo-daro, 400 miles away in Sindh]({c:Excavation began at Harappa}). In 1924 [John Marshall](entity:john-marshall), head of the Archaeological Survey of India, put the finds side by side. [He saw at once that they came from the same unknown culture]({c:In the summer of 1924 John Marshall compared}). [He announced it in the Illustrated London News]({c:Marshall announced the discovery}), a weekly magazine. [Readers spotted the likeness to finds from Sumer, in today's Iraq]({c:Readers of Marshall's article}). That dated the cities to the third millennium BCE, between 3000 and 2000 BCE. [At a single bound, Marshall wrote, Indian history had grown 3,000 years older]({c:Marshall wrote that the discovery}).",
          "[Marshall soon settled on calling it the “Indus” civilisation]({c:Marshall first called the culture}). It is also called [Harappan](entity:harappan), after the first site dug.",
        ].join("\n\n"),
      },
    },
    {
      block: "ch-cities",
      was: "804919ca43",
      set: { promise: "Straight streets, covered drains, a great brick tank, and a city of stone in the salt flats of Kachchh, in Gujarat." },
    },
    {
      block: "cities-prose",
      was: ["9b54ce3a01", "38a2e3757e"],
      why: "Mature Harappan, citadel and bitumen glossed; Kachchh placed; one appositive per sentence",
      set: {
        markdown: [
          "Archaeologists call the time when the cities flourished, about 2600–1900 BCE, the [Mature Harappan](entity:mature-harappan) phase. [More than a thousand settlements of that phase are known]({c:More than a thousand Mature Harappan sites}). Most were villages and small towns; only a handful were real cities. The best known is Mohenjo-daro. [Its lower town was laid out along streets that cross at right angles]({c:At Mohenjo-daro the buildings}), with drains built in from the start. [The excavators found plain but solid houses, many with their own wells and bathrooms]({c:Marshall found Mohenjo-daro's houses}). [Harappa and Mohenjo-daro may each have held tens of thousands of people]({c:Harappa and Mohenjo-daro may each}).",
          "The city's raised, walled mound is known as the [citadel](entity:citadel). On it stands [the Great Bath](entity:great-bath-mohenjo-daro): [a sunken brick tank, made watertight with gypsum mortar and a backing of bitumen]({c:The Great Bath at Mohenjo-daro}), a natural tar. Far to the south, in Kachchh in Gujarat, [Dholavira was built largely of stone, with reservoirs to catch scarce rain]({c:Dholavira, on the arid island}). [It was only found in 1968]({c:Dholavira was discovered in 1968}). At [Lothal](entity:lothal), also in Gujarat, [a large brick basin was read by its excavators as a dock]({c:The Archaeological Survey of India interpreted}), but [others think it was a water tank]({c:Other archaeologists argue}).",
        ].join("\n\n"),
      },
    },
    {
      block: "cities-debate",
      was: "4e8d1b76eb",
      why: "an editor's note rewritten for the learner",
      set: { note: "Both positions are reported from an encyclopedia. The excavators' own reports are not yet quoted on this page." },
    },
    {
      block: "cities-care",
      was: "453b66a3bf",
      set: {
        markdown:
          "Read with care. Population figures are estimates from the size of the sites, not counts. The UNESCO summaries quoted here are official descriptions, written to list the sites as World Heritage.",
      },
    },
    {
      block: "script-prose",
      was: ["c4c080a3bc", "3aceca753e"],
      why: "stamp seals and bilingual inscriptions explained before they are needed; opening continues from the brief",
      set: {
        markdown: [
          "Most of the inscriptions are on small [stamp seals](entity:stamp-seal), carved stones pressed into clay; [others are on sealings, amulets, tablets and pottery]({c:More than 3,800 Indus inscriptions}). [The script was a puzzle from the first finds]({c:From the start the script was a puzzle}). Many decipherments have been announced. None has convinced other specialists.",
          "Why is it so hard? [There is no bilingual inscription, the texts average only about five signs, and the language is unknown]({c:Three things make decipherment}). A [bilingual inscription](entity:bilingual-inscription) gives the same text in a script we can already read. The Rosetta Stone did that for Egyptian, and let readings be tested. Some scholars go further: [Farmer, Sproat and Witzel argued that the signs were symbols, not writing]({c:Farmer, Sproat and Witzel}). [Rao and colleagues answered that the sign sequences have the structure of a language]({c:Rao and colleagues (2009)}).",
        ].join("\n\n"),
      },
    },
    {
      block: "trade-prose",
      was: ["57c58c7a5b", "c96eaec337", "d626a4a696"],
      why: "Mesopotamia placed; Sargon and Gudea introduced; radiocarbon dating mentioned, as the claim note says",
      set: {
        markdown: [
          "The Indus people left no readable records, but their trading partners in Mesopotamia, today's Iraq, did. [Sargon of Akkad, a Mesopotamian king, boasted that the ships of Meluhha, Magan and Dilmun moored at his capital]({c:Sargon of Akkad (reigned}). [Gudea, ruler of the city of Lagash, brought gold dust, wood and stone from Meluhha]({c:Gudea, ruler of Lagash}). [Most scholars think Meluhha was the Indus civilisation]({c:Most scholars identify Meluhha}). [Magan was in today's Oman, and Dilmun in Bahrain]({c:Magan, named with Meluhha}).",
          "The goods travelled both ways. [Indus seals and other objects have been found in Mesopotamia]({c:Indus objects, including seals}), and [Dholavira has evidence of trade with Mesopotamia and Oman]({c:Finds at Dholavira show trade}). [In his report for 1925–26, Marshall was sure the contact was by sea]({c:In the Survey's report for 1925–26, Marshall held || By 1926 Marshall held}). For a long time [these contacts were the only firm way to date the cities]({c:Wheeler stressed in 1947}), until radiocarbon dating gave independent dates.",
        ].join("\n\n"),
      },
    },
    {
      block: "life-prose",
      was: ["2c364e4c87", "09d0dd4428", "ac2e5c12c0"],
      why: "faience, the copper-stone age and steatite glossed; the sentence on Cunningham's bull corrected; opening continues from the brief",
      set: {
        markdown: [
          "[Marshall found that they worked copper, gold, silver and lead]({c:Marshall found that the people of Mohenjo-daro}), and made [faience](entity:faience), a glazed material made from crushed quartz. Marshall called theirs a [copper-stone age](entity:chalcolithic), when people used copper alongside stone tools. [Dholavira had workshops for beads]({c:Dholavira had bead workshops}) of shell and semi-precious stone. [Brick sizes and weights were the same from city to city]({c:Cities far apart, such as Harappa}), over centuries.",
          "Their seals, mostly of [steatite](entity:steatite), a soft soapstone, are tiny works of art. [The first seals found showed bulls without a hump, and “unicorns”. A season later came a humped bull, with tigers, elephants and rhinoceroses on others]({c:The seals found by 1924}). The humped bull is the Indian kind; Cunningham had thought his seal foreign because its bull had no hump. [Marshall noted that horses did not appear]({c:In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall noted}). And [no palace or royal tomb has been found]({c:No palaces, rich royal tombs}): fine goods turn up in ordinary houses.",
        ].join("\n\n"),
      },
    },
    {
      block: "religion-prose",
      was: ["b4835f07c7", "e298c1e323"],
      why: "Shiva introduced; shorter sentences",
      set: {
        markdown: [
          "We cannot read a single prayer of the Indus people, so all we have are objects and guesses about them. [Marshall wrote that the Great Bath's purpose “can only be surmised”]({c:Marshall wrote that the Great Bath's purpose}). Then he guessed at ritual bathing, like the tanks of later Indian temples. [A figure seated cross-legged with worshippers, on a small tablet, looked to him more like a god than a king]({c:In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall described}).",
          "His boldest reading was of a seal showing a horned figure among animals. [He called it an early form of the Hindu god Shiva, as Pashupati, “lord of animals”]({c:Marshall identified the horned figure}). He concluded that Shiva's cult went back to the Indus cities. The name stuck, but [later scholars have read the same figure very differently]({c:Later scholars have disputed Marshall's reading}).",
        ].join("\n\n"),
      },
    },
    {
      block: "religion-debate",
      was: "aafbddfcec",
      why: "an editor's note rewritten for the learner",
      set: {
        note: "A resemblance to later images is not proof of the same god or the same meaning. The later debate is reported from an encyclopedia; the scholars' own words are not yet quoted here.",
      },
    },
    {
      block: "end-prose",
      was: ["f3a7e0d186", "9a4aea4eaf", "3603c594e2", "328ebaa6fd", "854bc6e41a", "7c2c0acac4"],
      why: "Aryans, the Rigveda and Indra explained; scholars introduced; opening continues from the brief",
      set: {
        markdown: [
          "[Mohenjo-daro was never rebuilt]({c:Mohenjo-daro was not rebuilt}). What happened? The first answer was war. [In a report for 1924–25, Marshall suggested that invading Aryans had largely destroyed the culture]({c:In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall suggested}). He meant the people of the Rigveda, the oldest collection of Sanskrit hymns. In 1947 the archaeologist [Mortimer Wheeler put it in a phrase: “Indra stands accused”]({c:In 1947 Mortimer Wheeler argued}). In the Rigveda the god Indra destroys forts, and Wheeler pointed to skeletons at Mohenjo-daro as his victims. [Even he admitted that those forts might be other, unknown places]({c:Wheeler admitted in the same article}).",
          "In 1964 the archaeologist George Dales looked again. [Nine years of digging had produced only about 37 skeletons, not shown to be from a single time]({c:Re-examining the “massacre”}). [There was no burnt layer, no weapons of war, no last stand]({c:There is no destruction layer}). Today most researchers look at climate and rivers: [a weakening monsoon that slowly dried the rivers and made farming harder]({c:Giosan and colleagues (2012) argue}).",
          "One river is at the centre of a long argument. [Many Harappan sites line the Ghaggar-Hakra, a river now mostly dry]({c:Many Harappan settlements lie along}). [The Rigveda praises a mighty Sarasvatī flowing from the mountains to the sea]({c:The Rigveda praises the river Sarasvatī}), and [in 1893 C. F. Oldham identified the two]({c:In 1893, before the Indus civilisation}). Was it a great Himalayan river when the cities stood? Geologists who study its [old channels](entity:palaeochannel) disagree.",
        ].join("\n\n"),
      },
    },
    {
      block: "after-prose",
      was: ["74dc09098f", "f7fc068d18", "5531aca9a2", "7da3460c61"],
      why: "deurbanisation and ancient genome glossed; Rakhigarhi placed",
      set: {
        markdown: [
          "Archaeologists now speak of [deurbanisation](entity:deurbanisation), the slow emptying of cities, rather than collapse. [Writing, seals, weights, long-distance trade and big buildings disappeared, but villages carried on and even multiplied]({c:As the cities emptied}). [People moved east towards the Ganga plain and south-east into Gujarat]({c:People moved east}). [Harappa itself is still a living town]({c:Harappa was settled before}).",
          "The people did not vanish either. [An ancient genome from Rakhigarhi, an Indus city, was published in 2019]({c:An ancient genome from Rakhigarhi}): the DNA of one person. Rakhigarhi is in today's Haryana. [Its kind of ancestry, the authors argue, was a main ancestor of later South Asians]({c:An ancient genome from Rakhigarhi}), although [one genome cannot describe a whole civilisation]({c:The authors of the Rakhigarhi genome study}).",
        ].join("\n\n"),
      },
    },
  ],
  claims: [
    {
      claim: "The Indus civilisation is usually dated",
      was: "cdf5bddf6c",
      set: {
        assessmentNote:
          "The outer dates (3300 and 1300 BCE) come from an encyclopedia. Two research papers give the same dates for the cities' height. All these dates are approximate.",
      },
    },
    {
      claim: "More than a thousand Mature Harappan sites",
      was: "444eb00c17",
      set: {
        assessmentNote:
          "Counts grow as surveys continue. Five sites are usually named as the major cities: Mohenjo-daro, Harappa, Ganweriwala, Dholavira and Rakhigarhi.",
      },
    },
    {
      claim: "Harappa and Mohenjo-daro may each",
      was: "478071e14a",
      set: { assessmentNote: "Estimates, not counts, worked out from the size of the sites. For each city they run from about 30,000 to 60,000." },
    },
    {
      claim: "Sargon of Akkad (reigned",
      was: "3d841c270b",
      set: {
        assessmentNote: "The words are from Barton's translation (1929). The reign dates follow the usual modern chronology, taken from an encyclopedia.",
      },
    },
    {
      claim: "Most scholars identify Meluhha",
      was: ["9b26f82183", "7b7e6f6c82"],
      set: {
        assessmentNote:
          "The identification rests on Indus objects found in Mesopotamia and the Gulf, on the goods the texts list, and on the order in which the texts name Dilmun, Magan and Meluhha. Specialists widely accept it, but it is not proven.",
      },
    },
  ],
  // People named only as the writer or speaker of a claim's source: “Who wrote about it”.
  authors: [
    { claim: "In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall suggested", authors: ["john-marshall"] },
    { claim: "In the Survey's report for 1925–26, Marshall held || By 1926 Marshall held", authors: ["john-marshall"] },
    { claim: "From the start the script was a puzzle", authors: ["john-marshall"] },
    { claim: "In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall described", authors: ["john-marshall"] },
    { claim: "In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall noted", authors: ["john-marshall"] },
    { claim: "Marshall argued in 1924", authors: ["john-marshall"] },
    { claim: "Marshall found Mohenjo-daro's houses", authors: ["john-marshall"] },
    { claim: "Marshall identified the horned figure", authors: ["john-marshall"] },
    { claim: "Marshall wrote that the discovery", authors: ["john-marshall"] },
    { claim: "Marshall wrote that the Great Bath's", authors: ["john-marshall"] },
    { claim: "In 1947 Mortimer Wheeler argued", authors: ["mortimer-wheeler"] },
    { claim: "Mortimer Wheeler pictured", authors: ["mortimer-wheeler"] },
    { claim: "Wheeler admitted", authors: ["mortimer-wheeler"] },
    { claim: "Wheeler stressed in 1947", authors: ["mortimer-wheeler"] },
    { claim: "Dales himself proposed", authors: ["george-dales"] },
    { claim: "Re-examining the “massacre”", authors: ["george-dales"] },
    { claim: "In 1875 Cunningham published", authors: ["alexander-cunningham"] },
    { claim: "In the 19th century so many bricks", authors: ["alexander-cunningham"] },
    { claim: "Masson took the mounds", authors: ["charles-masson"] },
    { claim: "The traveller Charles Masson", authors: ["charles-masson"] },
  ],
});
