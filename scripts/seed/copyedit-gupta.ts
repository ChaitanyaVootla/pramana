/**
 * Copy edits for a first-time reader on /p/gupta-empire, proposed THROUGH
 * MCP (machinery in ./copyedit-lib.ts). Plainer prose, modern names for
 * ancient places, terms glossed where they first appear, one name for the
 * Huns in the prose, shorter sentences, consistent reign dates, learner-facing
 * claim notes, and Part 2's long claim list split in two. No claim's
 * assertion, citation or quotation changes.
 *
 *   pnpm tsx scripts/seed/copyedit-gupta.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit } from "./copyedit-lib";
import { guptaNewClaims, listGuptaClaims } from "./sources-gupta";

type Item = { text?: string; label?: string } & Record<string, unknown>;
const patchItems = (match: string, field: "text" | "label", next: string) => (items: Item[]) =>
  items.map((it) => (String(it[field]).includes(match) ? { ...it, [field]: next } : it));
const relabel = (label: string) => (when: Record<string, unknown>) => ({ ...when, label });

/** An entity's reign label, in its primary date and its reign span alike. */
const reignLabel = (label: string) => ({
  when: (w: Record<string, unknown>) => ({ ...w, label }),
  // The page view adds derived fields (bounds, label) to each span; send back only the input fields.
  spans: (spans: { role: string; when: Record<string, unknown>; source?: unknown }[]) =>
    spans.every((s) => s.when.label === label)
      ? spans
      : spans.map((s) => ({ role: s.role, when: { ...s.when, label }, ...(s.source ? { source: s.source } : {}) })),
});

await runCopyEdit({
  page: "gupta-empire",
  newClaims: guptaNewClaims,
  title: "Gupta Empire: plainer words for a first-time reader",
  rationale: [
    "After the support checks the prose says no more than its claims: Samudragupta's inscription has his father embrace him as “worthy” (choosing him is Fleet's reading); 499 is the translator's working-out of Āryabhaṭa's age, not a date he gives; the Alchon Huns are “identified”, not “now usually”; and the dam burst in “heavy rain”, not a storm",
    "A copy edit for readers new to the period, after a review of the page for novice clarity. It glosses terms where they first appear (the Gupta era, Licchavis, Śakas, regent, Tīrthaṅkaras), gives modern names for ancient places (Prayāga, Sāketa, Magadha, Kāñchī, Vidiśā, Pāṭaliputra, Surāṣṭra), and keeps one name for the Huns in the prose (Hūṇas), with one sentence explaining the Kidarites and Alchon Huns.",
    "Sentences are split to one idea each. Place names in the prose now match the chips (Junāgaḍh and the Girnar rock; Daśapura and Mandsaur). The 1919 sentence now says Smith quoted others' comparisons, as the claim does.",
    "Part 2 shows the four claims that carry its argument; the rest move, unchanged, to a second list after it. Reign dates read “c. 319–335” and “c. 335–375” (the alternative of 350 stays in the claim note and the date's basis).",
    "Two new claims, quoted from Wikipedia (tertiary) and listed in Part 3, support glosses the copy had softened for want of a claim: that Prabhāvatīguptā ruled for her young sons, and that the Western Satraps were Śakas, Indo-Scythians. The prose now links them.",
    "Claim notes that read as editors' to-dos (“Wikipedia, citing …, by page only”) now say what the learner needs: whose inference it is and what is not yet quoted. The citations themselves still show where each point comes from.",
  ],
  blocks: [
    {
      block: "often-prose",
      was: ["b5170714b2"],
      why: "opening continues from the brief",
      set: { markdown: "Each belief below is set against the claims on this page that correct or qualify it." },
    },
    ...listGuptaClaims,
    {
      block: "intro",
      was: ["166ff4d3a4", "a2813f9590"],
      why: "the era explained at first use; Hūṇas glossed; shorter sentences",
      set: {
        markdown: [
          "For about two centuries, from around 320 to 550 CE, a family called the Guptas ruled much of northern India from the Ganges plain. Their kings left inscriptions on stone pillars, rocks and copper plates. They dated them in a calendar of their own, which [counted the years from 319–320 CE]({c:The Gupta kings dated their inscriptions}). So “Gupta year 82” means 401–402 CE.",
          "The astronomer [Āryabhaṭa](entity:aryabhata) lived in their time, and probably the poet [Kālidāsa](entity:kalidasa). The Chinese monk [Faxian](entity:faxian) [walked their roads and described a mild and prosperous country]({c:Faxian described the “Middle Kingdom”}).",
          "That picture made historians around 1900 call the period [a “golden age”]({c:In 1904 the British historian Vincent Smith}). This page tells the story from the kings' own inscriptions and from the travellers who saw it. It also asks what the label leaves out: [people treated as untouchable]({c:Faxian also described the Chandalas}), [wars with the Hūṇas (Huns)]({c:The Bhitari pillar also says}), and [praise that comes mostly from the kings themselves]({c:The same inscription claims that while Skandagupta}).",
        ].join("\n\n"),
      },
    },
    {
      block: "already-know",
      was: ["4311c6991f", "d93eff60bc"],
      why: "Ajanta: the date of the famous later caves",
      set: {
        items: (items: Item[]) =>
          [
            patchItems(
              "The famous paintings",
              "text",
              "The famous paintings are in the later caves, [made about 460–480 CE by one estimate]({c:Walter Spink argued}). [They were made under a neighbouring dynasty]({c:Cave XVI at Ajanta}), not the Guptas.",
            ),
            // The year is left to Part 8's guess.
            patchItems(
              "“The golden age of India.”",
              "text",
              "“The golden age of India.” [The phrase goes back to a British historian]({c:In 1904 the British historian Vincent Smith}), and historians now dispute it.",
            ),
          ].reduce((acc, f) => f(acc), items),
      },
    },
    {
      block: "meanwhile",
      was: ["83f990d96b", "dde131e74d", "16b38f3a26", "85fc902507"],
      why: "regent glossed; Kāñchī's modern name",
      set: {
        items: (items: Item[]) =>
          [
            patchItems("Siṃhala's king", "label", "Its king sends gifts; Faxian stays two years"),
            patchItems("a Gupta princess rules", "label", "The Vākāṭakas: a Gupta princess rules for her young sons; Ajanta's later caves"),
            patchItems("Kāñchī under Viṣṇugopa", "label", "Kāñchī (Kanchipuram) under Viṣṇugopa, a Pallava ruler"),
          ].reduce((acc, f) => f(acc), items),
      },
    },
    { block: "ch-rise", was: "bee8092f6f", why: "reign date without the slash", set: { when: relabel("c. 319–335") } },
    {
      block: "rise-prose",
      was: ["da00fefe49", "fae870fd6c"],
      why: "Licchavis glossed; Prayāga, Sāketa and Magadha given modern names; the succession moved before the Purāṇas",
      set: {
        markdown: [
          "The Guptas began as a minor family in the Ganges plain, in what is now Bihar and eastern Uttar Pradesh. [Their first two kings called themselves only “great king”]({c:Samudragupta's inscription calls his great-grandfather}). The third, [Chandragupta I](entity:chandragupta-i), took a grander title: [“great king of kings”](entity:maharajadhiraja). [He married Kumāradevī of the Licchavis]({c:Chandragupta I married Kumāradevī}), an ancient ruling clan. Their son proudly named his mother's family in his titles. [Samudragupta's inscription says his father embraced him as “worthy”. The scholar J. F. Fleet read this as choosing him to be the next king]({c:Samudragupta's inscription says his father}).",
          "How do we know when this was? The Gupta kings dated their records by [their own era](entity:gupta-era): a count of years from a fixed starting point. In 1888 Fleet [worked out that its year 0 fell in 319–320 CE]({c:The Gupta kings dated their inscriptions}). [Chandragupta I's reign is usually taken to have started it]({c:Chandragupta I is usually taken}).",
          "The Purāṇas, ancient Sanskrit compilations, may remember this early, small kingdom. [They list Gupta kings ruling along the Ganges, at Prayāga, Sāketa and in Magadha]({c:A Purāṇic list of dynasties}). These are today's Prayagraj (once called Allahabad), the area around Ayodhya, and south Bihar.",
        ].join("\n\n"),
      },
    },
    { block: "ch-samudragupta", was: "5748ebb15a", why: "reign date without the slash", set: { when: relabel("c. 335–375") } },
    {
      block: "samudragupta-prose",
      was: "8df5ecc5d0",
      why: "Allahabad tied to Prayāga; Kāñchī and the border kingdoms given modern names; the musician and the horse sacrifice left to the coin captions",
      set: {
        markdown: [
          "Nearly everything we know about [Samudragupta](entity:samudragupta) comes from one long poem. [It was carved on a stone column at Allahabad]({c:Samudragupta's praise poem was carved}), the ancient Prayāga, now called Prayagraj. The column already carried Aśoka's edicts, six centuries older. [Its author, Hariṣeṇa, was one of the king's own officers]({c:The poem was composed by Hariṣeṇa}). So the poem is a [praśasti](entity:prashasti): a poem of praise.",
          "The poem sorts the kings into four kinds of defeat. In the north, [Āryāvarta](entity:aryavarta), [it says Samudragupta “violently exterminated” the kings]({c:In the north (Āryāvarta)}). In the south, [Dakṣiṇāpatha](entity:dakshinapatha), [he captured kings and let them go]({c:In the south (Dakṣiṇāpatha)}). One was [Viṣṇugopa of Kāñchī (Kanchipuram), a Pallava king]({c:Historians identify Viṣṇugopa}). [Border kingdoms, from Bengal and Assam to Nepal, paid him taxes]({c:Frontier kingdoms to the east and north}). [Far-off rulers, as far as Sri Lanka, sent gifts]({c:Distant rulers, the Daivaputra}).",
        ].join("\n\n"),
      },
    },
    {
      block: "chandragupta-prose",
      was: ["a2f964fc6f", "69c10cc103", "570b2cbbd0", "acaac299a7", "a6fe4a821a", "d8127bedb0", "4a77a88b07"],
      why: "Śakas, regent and Vidiśā glossed; shorter sentences; opening continues from the brief",
      set: {
        markdown: [
          "[Chandragupta II](entity:chandragupta-ii) is the first Gupta king we can date from his own records. [The Western Satraps he conquered were Śaka, or Indo-Scythian, kings]({c:The Western Satraps were Indo-Scythian}), who had ruled Saurashtra (Kathiawar), in today's Gujarat, for centuries. To the south he made an alliance by marriage: [his daughter Prabhāvatīguptā married the king of the Vākāṭakas, in the Deccan]({c:Chandragupta II's daughter}), and after his death [ruled for her young sons]({c:Prabhāvatīguptā's three sons}).",
          "His reign left its mark in stone near Vidiśā (Vidisha, in Madhya Pradesh). At Udayagiri, [a cave inscription of 401 records the gift of a local ruler who served him]({c:At Udayagiri near Vidiśā}), a [feudatory](entity:feudatory). [Another says his minister came there “accompanied by the king in person, who was seeking to conquer the whole world”]({c:Another Udayagiri inscription}). [A colossal relief of Varāha]({c:One of the Udayagiri shrines}), Viṣṇu as a boar, is carved nearby. At the Buddhist site of Sanchi [a donor who lived by his favour paid for monks' food and a lamp]({c:At the Buddhist monastery of Sanchi}).",
          "Then there is the famous [iron pillar](entity:iron-pillar-of-delhi) in Delhi. [It praises a dead king named Chandra who fought from Bengal to the Indus]({c:The iron pillar at Mehrauli}), but [it gives no date and no family]({c:The iron pillar's inscription is not dated}).",
        ].join("\n\n"),
      },
    },
    {
      block: "faxian-prose",
      was: ["8531ede8cc", "23c443d578", "8586107f1f"],
      why: "Pāṭaliputra's modern name; the chip's spelling Caṇḍāla; shorter sentences; opening continues from the brief",
      set: {
        markdown: [
          "Faxian was [looking for the Buddhist books of rules for monks]({c:The Chinese monk Faxian set out}). He called the Ganges plain the Middle Kingdom, and its people, he wrote, were [“numerous and happy”]({c:Faxian described the “Middle Kingdom”}). [The king punished criminals with fines, not executions]({c:Faxian wrote that the king governed}). [People, he said, ate no meat and drank no alcohol]({c:According to Faxian, nobody}). Kings had [given monasteries land, recorded on metal plates]({c:Faxian says kings had long endowed}).",
          "At [Pāṭaliputra](entity:pataliputra), today's Patna, [he saw Aśoka's palace still standing]({c:At Pāṭaliputra, Faxian saw}) and [two large monasteries]({c:Beside Aśoka's stūpa}). He admired [houses where the sick and poor were given free care and medicine]({c:In the cities of Magadha}). [He stayed three years to learn Sanskrit]({c:Faxian stayed three years}), then [sailed home by way of Sri Lanka and Java]({c:Faxian then sailed}).",
          "Two things temper his picture. He also describes [the Caṇḍālas, who lived apart and had to warn others of their approach]({c:Faxian also described the Chandalas}). They were people treated as untouchable. And [he never names the king]({c:Faxian never names the king}): he came for Buddhism, and [he saw the country through Buddhist eyes]({c:Even Vincent Smith, who admired}).",
        ].join("\n\n"),
      },
    },
    {
      block: "culture-prose",
      was: ["da9dddf392", "c23716d0d8", "4d620bb811"],
      why: "Daśapura (Mandsaur) as on the chip; guild and Tīrthaṅkara glossed; Āryabhaṭa's birth year",
      set: {
        markdown: [
          "The Sanskrit poet [Kālidāsa](entity:kalidasa) wrote plays such as Śakuntalā and poems such as the Cloud Messenger. [No one knows exactly when he lived]({c:Kālidāsa's dates are not known}), though most scholars place him in this period. [He clearly loved the city of Ujjain]({c:Kālidāsa's poems show}), in central India.",
          "[Āryabhaṭa](entity:aryabhata) tells us more about himself. [He says he was 23 at a date that his translator works out as 499]({c:Āryabhaṭa wrote that he was 23}), so he was born in 476. The book sets out [the astronomy honoured at Kusumapura, probably Pāṭaliputra]({c:Āryabhaṭa says}). [He compared the stars' movement to the shore seen from a boat]({c:Āryabhaṭa compared the stars'}), a passage read as saying the Earth turns.",
          "The inscriptions show ordinary people paying for worship. A [guild](entity:guild), or trade association, of silk weavers at Daśapura (Mandsaur) [built a temple of the Sun]({c:At Daśapura (Mandsaur)}) in about 437. [Some of them took up other trades, such as astrology]({c:The same inscription says that some of the weavers}). [A guild of oil-men looked after a lamp fund for another Sun temple]({c:A copper plate of 465–466}). [A Jain set up a pillar with five images]({c:In 460–461 CE}) of [Tīrthaṅkaras](entity:tirthankara), the great Jain teachers. And [the great monastery of Nālandā is said to have been founded by a Gupta king]({c:Xuanzang, who visited}), though [its date is uncertain]({c:The date is uncertain}).",
        ].join("\n\n"),
      },
    },
    {
      block: "ch-skandagupta",
      was: "ec74c2a242",
      set: { promise: "A king who slept on the bare ground, the first war with the Hūṇas (Huns), and a burst dam in Gujarat." },
    },
    {
      block: "skandagupta-prose",
      was: ["8431e11e81", "88fa27c0f4"],
      why: "one name for the Huns, with one sentence on the two groups; Junāgaḍh and the Girnar rock tied together; Surāṣṭra glossed",
      set: {
        markdown: [
          "By the 450s the empire was under pressure. [Skandagupta](entity:skandagupta)'s pillar at Bhitari, in eastern Uttar Pradesh, makes two boasts. [To restore his family's fortunes he spent a night sleeping on the bare ground]({c:Skandagupta's pillar at Bhitari says}). And [the earth shook when he fought the Hūṇas]({c:The Bhitari pillar also says}).",
          "Hūṇa is the Indian name for the [Huns](entity:huna), peoples from Central Asia. Historians see two main groups behind it. [The Hūṇas Skandagupta fought around 455 were probably the Kidarites]({c:The Bhitari pillar also says}). [Those who broke through around 500 are identified as the Alchon Huns]({c:The Hūṇas who invaded India around 500}). This page calls them all Hūṇas.",
          "Far to the west, at Junāgaḍh in Gujarat, Aśoka's edicts are carved on a great boulder: the Girnar rock. [On the same stone, Skandagupta's governor recorded how a reservoir's dam burst in heavy rain and was rebuilt in two months]({c:On the same boulder at Junāgaḍh}). [The king had chosen that governor of Surāṣṭra (Saurashtra) with care]({c:The Junāgaḍh inscription says Skandagupta appointed}). The same inscription says [no one in his kingdom was poor or miserable]({c:The same inscription claims that while}). That tells us how kings wished to be seen.",
        ].join("\n\n"),
      },
    },
    {
      block: "end-prose",
      was: ["431516d457", "bbb1e3a82d"],
      why: "Eran placed; satī glossed; Daśapura (Mandsaur) as on the chip",
      set: {
        markdown: [
          "The town of [Eran](entity:eran), in today's Madhya Pradesh, tells the story in three stones. In 484 [two brothers set up a pillar for Viṣṇu there, naming Budhagupta as their king]({c:A pillar at Eran dated}). A few years later [the surviving brother dated a new temple by the reign of the Hūṇa king Toramāṇa]({c:A few years later, “in the first year”}). In 510 [a memorial recorded a battle, a dead nobleman, and his wife who died on his funeral pyre]({c:A memorial at Eran}). It is [an early instance of satī]({c:Fleet called the Goparāja}), the burning of a widow.",
          "[By 500 the Hūṇas had overrun much of the north-west]({c:Historians date the Hūṇa breakthrough}). [Toramāṇa's son Mihirakula ruled as far as Gwalior]({c:At Gwalior, an inscription}). Then [Yaśodharman, a king of Daśapura (Mandsaur), boasted that Mihirakula had bowed at his feet]({c:Yaśodharman of Daśapura boasted}). [Rebellious subordinates and the Hūṇa wars wore the empire down]({c:Historians explain the empire's end}), and [the main line ended around 550]({c:The last recognised king}).",
        ].join("\n\n"),
      },
    },
    {
      block: "end-care",
      was: "490887396f",
      why: "Xuanzang introduced; shorter sentences",
      set: {
        markdown:
          "Read with care. Who the Hūṇas were is still debated. Xuanzang, a Chinese pilgrim of the seventh century, records a Buddhist tradition that Mihirakula persecuted monks. It is a hostile tradition, written down a century or more later. Yaśodharman's boast is a praise poem, like the Gupta inscriptions.",
      },
    },
    {
      block: "golden-prose",
      was: ["24688bed7d", "63c5132990", "c71b05e909", "3d3f416cfe", "edf457dc1d"],
      why: "Smith quoted others' comparisons (as the claim says); Periclean Athens explained; opening continues from the brief",
      set: {
        markdown: [
          "The phrase is not ancient. Smith used it [in a book of 1904]({c:In 1904 the British historian Vincent Smith}), where [he also called Samudragupta “the Indian Napoleon”]({c:Smith also called Samudragupta}). Reading Faxian, [he judged that India had probably never been better governed]({c:Drawing on Faxian}). [In 1919 he went further. He agreed with one writer who compared the period to Athens at its height, and another who called it “the Hindu Renaissance”]({c:In 1919 Smith}). [Others called it the golden age of Sanskrit literature]({c:The art historian E. B. Havell}). [The label still colours how the art of the period is described]({c:The label lives on in art history}).",
          "The evidence for the label is real: the poetry, the astronomy, the temples, Faxian's account. But [other historians question it]({c:The golden-age label is disputed}), pointing to caste growing more rigid and towns declining. And the label leans on sources that wanted to praise: [royal praise poems]({c:The same inscription claims that while}) and [a pilgrim with his own ideals]({c:Even Vincent Smith, who admired}).",
        ].join("\n\n"),
      },
    },
    {
      block: "golden-method",
      was: "45ebbd5d5b",
      set: {
        markdown:
          "How we know the dates. Fleet's work of 1888 still underlies the dates of the Gupta kings, but he also got things wrong. [He put the Vākāṭakas three centuries too late]({c:Fleet (1888) dated the Vākāṭaka}). Historians have also changed their minds several times about who the iron pillar's king was. The scholars who built our picture of the period are part of its story.",
      },
    },
  ],
  inserts: [
    {
      after: "samudragupta-claims",
      why: "the rest of Part 2's claims, moved from the list above",
      block: {
        id: "samudragupta-more",
        type: "claims",
        title: "All the kings the poem names, and more on Samudragupta",
        claimIds: [
          "{c:Historians identify Viṣṇugopa}",
          "{c:Frontier kingdoms to the east and north}",
          "{c:Distant rulers, the Daivaputra}",
          "{c:Alexander Cunningham, quoted by Fleet}",
          "{c:The inscription praises Samudragupta as a “king of poets”}",
          "{c:Later Gupta inscriptions call Samudragupta}",
        ],
      },
      moves: {
        from: "samudragupta-claims",
        claims: [
          "Historians identify Viṣṇugopa",
          "Frontier kingdoms to the east and north",
          "Distant rulers, the Daivaputra",
          "Alexander Cunningham, quoted by Fleet",
          "The inscription praises Samudragupta as a “king of poets”",
          "Later Gupta inscriptions call Samudragupta",
        ],
      },
    },
  ],
  claims: [
    {
      claim: "Beside Aśoka's stūpa",
      was: "82c7d2eed2",
      why: "stūpa glossed; “Hīnayāna” replaced by “the early schools”",
      set: {
        text: "Beside Aśoka's stūpa (a Buddhist relic mound) at Pāṭaliputra there were two monasteries, one of the Mahāyāna and one of the early schools of Buddhism, with 600 or 700 monks between them, and every year the city held a procession of images.",
      },
    },
    {
      claim: "Āryabhaṭa wrote that he was 23",
      // 803f5c66a4 is this edit's earlier wording (before content's Kali Yuga fix), which briefly replaced theirs in preview.
      was: ["bfc3e9cdf9", "803f5c66a4", "20c70dc4f1"],
      why: "the great age glossed as a yuga (with content's support-check fix: Clark's Kali Yuga reckoning)",
      set: {
        text: "Āryabhaṭa wrote that he was 23 years old when three quarters of the current great age of the world (a yuga) and 3,600 years had passed. His translator W. E. Clark, taking the Kali Yuga to begin in 3102 BCE as later astronomers did, worked this out as 499 CE, so he was born in 476.",
      },
    },
    {
      claim: "Many historians now dispute the golden-age label",
      also: ["The golden-age label is disputed"],
      was: ["5a71207b3b", "1e45e3e159", "8fc7049552", "4ebac54aeb"],
      why: "worded as the source words it (“disputed by others”, not a count of historians); the Kushan dates left out, as content dropped them (no quote gives them)",
      set: {
        text: "The golden-age label is disputed. D. N. Jha argued that caste distinctions grew more rigid in this period, and archaeology suggests that towns had been more prosperous before it, under the Kushans, so that some historians argue for an urban decline under the Guptas.",
        assessmentNote:
          "Reported from an encyclopedia. Jha's and the other historians' own words, and the archaeological evidence, are not yet quoted on this page.",
      },
    },
    {
      claim: "Chandragupta I is usually taken",
      was: "da9d8a7dc3",
      why: "reign date without the slash",
      set: { when: relabel("c. 319–335") },
    },
    {
      claim: "Chandragupta I married Kumāradevī",
      was: "6373888033",
      set: { assessmentNote: "The marriage is in the inscriptions. That it brought Chandragupta power is an inference by modern historians." },
    },
    {
      claim: "Historians identify Viṣṇugopa",
      was: "e5a3d063a8",
      set: {
        assessmentNote: "Fleet (1888) gives the name without saying which dynasty Viṣṇugopa belonged to. Calling him a Pallava is the work of later historians.",
      },
    },
    {
      claim: "Historians think the poem presents diplomacy as submission",
      was: "646c79de26",
      set: {
        assessmentNote: "A modern historian's reading, reported from an encyclopedia. The Chinese sources it relies on are not yet quoted on this page.",
      },
    },
    {
      claim: "Chandragupta II conquered the Western Satraps",
      was: "bcb994780c",
      set: {
        assessmentNote: "The conquest is generally accepted, but its date is uncertain. The later dates come from a modern survey (Kulke and Rothermund), not yet quoted here.",
      },
    },
    {
      claim: "Chandragupta II's daughter",
      was: "de9ade0dcd",
      set: {
        assessmentNote: "The Vākāṭaka records call her father Devagupta; historians take that to be another name for Chandragupta II. The dates of her regency are only a rough estimate.",
      },
    },
    {
      claim: "Chandra of the iron pillar is now generally identified",
      was: "0ccde6e535",
      set: { assessmentNote: "The view of most historians today, reported from an encyclopedia. Their arguments are not yet quoted on this page." },
    },
    {
      claim: "The Bhitari pillar also says",
      was: "1f93586739",
      set: { assessmentNote: "The war is in the inscription. Its date, and which Huns these were, are modern historians' inferences." },
    },
    {
      claim: "The Hūṇas who invaded India around 500",
      was: "35848e032b",
      set: { assessmentNote: "Current scholarship, reported from an encyclopedia. The evidence behind it is not yet quoted on this page." },
    },
    {
      claim: "The last recognised king",
      was: "9684f99aa9",
      set: { assessmentNote: "Who ruled after whom among the sixth-century Guptas is not entirely clear." },
    },
    {
      claim: "Around 390–410 the Kidarites",
      was: "631827af6c",
      set: { assessmentNote: "The dates are approximate, and come mostly from an encyclopedia." },
    },
  ],
  entities: [
    { entity: "chandragupta-i", was: "810848fb34", why: "reign label without the slash", set: reignLabel("c. 319–335") },
    { entity: "samudragupta", was: "aab7ff70b6", why: "reign label without the slash", set: reignLabel("c. 335–375") },
    {
      entity: "j-f-fleet",
      was: "4f8e45e279",
      why: "epigraphist explained",
      set: {
        description:
          "British scholar of inscriptions (an epigraphist). He edited and translated the Gupta inscriptions (1888) and worked out that the Gupta era began in 319–320 CE.",
      },
    },
  ],
  // People named only as the writer or speaker of a claim's source: “Who wrote about it”.
  authors: [
    { claim: "According to Faxian, nobody", authors: ["faxian"] },
    { claim: "At Pāṭaliputra, Faxian saw", authors: ["faxian"] },
    { claim: "Beside Aśoka's stūpa", authors: ["faxian"] },
    { claim: "Faxian also described the Chandalas", authors: ["faxian"] },
    { claim: "Faxian described the “Middle Kingdom”", authors: ["faxian"] },
    { claim: "Faxian says kings had long", authors: ["faxian"] },
    { claim: "Faxian wrote that the king governed", authors: ["faxian"] },
    { claim: "In the cities of Magadha, Faxian wrote", authors: ["faxian"] },
    { claim: "Drawing on Faxian, Smith judged", authors: ["vincent-a-smith"] },
    { claim: "Even Vincent Smith, who admired", authors: ["vincent-a-smith"] },
    { claim: "In 1904 the British historian Vincent Smith", authors: ["vincent-a-smith"] },
    { claim: "In 1919 Smith", authors: ["vincent-a-smith"] },
    { claim: "Smith also called Samudragupta", authors: ["vincent-a-smith"] },
    { claim: "Vincent Smith (1914) thought the iron pillar || Vincent Smith (1914) gave up identifying", authors: ["vincent-a-smith"] },
    { claim: "The art historian E. B. Havell", authors: ["e-b-havell"] },
    { claim: "Fleet (1888) dated the Vākāṭaka", authors: ["j-f-fleet"] },
    { claim: "Fleet (1888) leaned towards", authors: ["j-f-fleet"] },
    { claim: "How large the empire was depends", authors: ["j-f-fleet"] },
    { claim: "The Gupta kings dated their inscriptions", authors: ["j-f-fleet"] },
    { claim: "Cosmas also described Sri Lanka", authors: ["cosmas-indicopleustes"] },
    { claim: "In the sixth century", authors: ["cosmas-indicopleustes"] },
    { claim: "The poem was composed by Hariṣeṇa", authors: ["harishena-poet"] },
  ],
});
