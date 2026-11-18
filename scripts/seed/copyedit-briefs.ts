/**
 * One-minute briefs for every chapter of the five era pages, proposed THROUGH
 * MCP (machinery in ./copyedit-lib.ts), one changeset per page. A brief is
 * the chapter's skeleton for a first-time reader: `happened`, one or two
 * plain sentences (30 words at most) in which every fact links to the claim
 * it rests on, and `howWeKnow`, one sentence naming the kind of evidence,
 * with a claim link. Briefs add no fact that the linked claims do not state.
 *
 * Only a chapter's `brief` is set, and only where the chapter has none yet
 * (or has exactly this one), so other edits to the chapter are kept.
 *
 *   pnpm tsx scripts/seed/copyedit-briefs.ts [--page gupta-empire,…]   # propose
 *   … --withdraw          # dry run: propose, print the reports, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 */
import { runCopyEdit, type CopyEdit } from "./copyedit-lib";

interface Brief {
  happened: string;
  howWeKnow: string;
}

/** Fingerprint of a chapter with no brief yet. */
const NO_BRIEF = "44136fa355";

/** Earlier versions of each brief (fingerprints), which the current one replaces: the first version, then the skim-mode revision. */
const EARLIER: Record<string, string[]> = {
  "maurya-empire/ch-greek": ["91ef27ef07", "7923ed0ae1", "94cb2c60b3"],
  "maurya-empire/ch-running": ["8b286e0fa3", "f3f806407d", "f4817e702a"],
  "independence-movement/ch-1930": ["2f08ddf383", "b20fcc26ab"],
  "independence-movement/ch-war": ["b98f9259e4", "495c53907f"],
  "gupta-empire/ch-rise": ["5937d0b704", "7943d2d995", "c220bd34b3"],
  "gupta-empire/ch-samudragupta": ["20b397d176", "8949414431", "9620071e84"],
  "mahajanapadas/ch-sixteen": ["a369ed91c6", "6df4f15b01", "60822ead37"],
  "maurya-empire/ch-empire": ["a310eba326"],
  "maurya-empire/ch-kalinga": ["0c9a6c2de7"],
  "maurya-empire/ch-dhamma": ["469e197a44"],
  "maurya-empire/ch-roads": ["0ac3f00d6f"],
  "maurya-empire/ch-society": ["4d9eacc0a1"],
  "maurya-empire/ch-stone": ["246f456ba9"],
  "maurya-empire/ch-often-said": ["a99b795f96"],
  "independence-movement/ch-1857": ["f356e0f0fa"],
  "independence-movement/ch-congress": ["dad2bcb4f8"],
  "independence-movement/ch-swaraj": ["dee5f15237", "5e8f700829"],
  "independence-movement/ch-amritsar": ["d34529dbb8"],
  "independence-movement/ch-nations": ["164ad8f675"],
  "independence-movement/ch-1947": ["c947981adb", "cfd06ba9a5"],
  "independence-movement/ch-often-said": ["2ccd56d732"],
  "gupta-empire/ch-chandragupta": ["1451541e3a", "af0bb78675", "cbb045d291"],
  "gupta-empire/ch-faxian": ["57c2785ca5"],
  "gupta-empire/ch-culture": ["0ddc72c7e9", "b41a4a62cf"],
  "gupta-empire/ch-skandagupta": ["cea393d753"],
  "gupta-empire/ch-end": ["bd73598746", "f54789e757"],
  "gupta-empire/ch-golden-age": ["62a01b6bba"],
  "gupta-empire/ch-often-said": ["594b05f3eb"],
  "indus-civilisation/ch-found": ["0b0e03d89d", "b099e6b6a4"],
  "indus-civilisation/ch-cities": ["b374ea8bd9"],
  "indus-civilisation/ch-script": ["01c677c847"],
  "indus-civilisation/ch-trade": ["57adb7e9ab", "79ea1cb5f0"],
  "indus-civilisation/ch-life": ["75e9bb41e0", "dd521f8e89"],
  "indus-civilisation/ch-religion": ["41ccb8770c", "16dafaf08f"],
  "indus-civilisation/ch-end": ["40409f1ec3"],
  "indus-civilisation/ch-after": ["0c34d20345"],
  "indus-civilisation/ch-how": ["3054335859"],
  "indus-civilisation/ch-often": ["ba19b6d16f"],
  "mahajanapadas/ch-republics": ["ae1633a290"],
  "mahajanapadas/ch-cities": ["5de9d66a1f", "f066976f50"],
  "mahajanapadas/ch-magadha": ["78c9b2fb18", "5e6a701b1a"],
  "mahajanapadas/ch-buddha": ["0608a903df"],
  "mahajanapadas/ch-teachers": ["8c5431ce9a", "a967714ff4"],
  "mahajanapadas/ch-persia": ["2d103c72f7"],
  "mahajanapadas/ch-nandas": ["93e4ea0fbe"],
  "mahajanapadas/ch-dating": ["5e2a246f35"],
  "mahajanapadas/ch-often-said": ["71f0afb10c"],
  "early-medieval-kingdoms/ch-mahmud": ["3ed402200b"],
  "early-medieval-kingdoms/ch-often-said": ["6861352bb9"],
  "early-medieval-kingdoms/ch-harsha": ["1551496258"],
  "early-medieval-kingdoms/ch-thanjavur": ["218fd557a8"],
  "early-medieval-kingdoms/ch-feudal": ["453552f323"],
};

const BRIEFS: Record<string, { title: string; briefs: Record<string, Brief> }> = {
  "maurya-empire": {
    title: "Maurya Empire",
    briefs: {
      "ch-empire": {
        happened: "[Around 320 BCE Chandragupta Maurya founded an empire]({c:The Maurya Empire was founded}), ruled from [Pāṭaliputra, today's Patna]({c:The Maurya capital, Pāṭaliputra}). [Under Aśoka it briefly held the main cities and routes of the subcontinent]({c:Under Aśoka the empire}).",
        howWeKnow: "Mostly from [Aśoka's own inscriptions, and fragments of a lost Greek account by Megasthenes]({c:The main written sources for Mauryan times}).",
      },
      "ch-kalinga": {
        happened: "[Around 261 BCE, eight years into his reign, Aśoka conquered Kalinga]({c:Aśoka conquered Kalinga}). [He counted 150,000 deported and 100,000 killed]({c:Rock Edict XIII puts the toll}), and [declared his repentance]({c:Aśoka publicly declared}).",
        howWeKnow: "From [Aśoka's own words in Rock Edict XIII]({c:Rock Edict XIII puts the toll}), carved on rocks across his empire; no other count survives.",
      },
      "ch-dhamma": {
        happened: "[After Kalinga, Aśoka says, he turned to dhamma, right conduct]({c:After taking Kalinga, Aśoka says}). [He appointed officers of dhamma and raised inscribed pillars]({c:Aśoka appointed special officers}), one [at the Buddha's birthplace, Lumbinī]({c:In the twentieth year after}).",
        howWeKnow: "From [the pillar Aśoka set up at Lumbinī]({c:In the twentieth year after}) and [his edict on his own change of heart]({c:By his own account, Aśoka}).",
      },
      "ch-greek": {
        happened: "[Aśoka claimed a “conquest by morality” reaching the Greek kingdoms]({c:Aśoka claimed to have won}). [Rock Edict XIII names five kings]({c:Rock Edict XIII names a Greek}): [rulers of Syria, Egypt, Macedonia, Cyrene and Epirus or Corinth]({c:Scholars identify these kings}).",
        howWeKnow: "From the edict itself; [the Greek kings' known reigns help date it]({c:Because these Hellenistic kings'}).",
      },
      "ch-running": {
        happened: "The Arthaśāstra, a statecraft manual, [tells of a first king granted a sixth of the grain]({c:The Arthaśāstra justifies kingship}) and [prescribes spies in disguise]({c:The Arthaśāstra prescribes}). [Megasthenes describes officials who measured land and shared water]({c:Megasthenes describes officials}).",
        howWeKnow: "From a manual [probably completed centuries after the Mauryas]({c:The surviving Arthaśāstra was probably}), and a Greek envoy known only through [Strabo's summary]({c:Megasthenes describes officials}).",
      },
      "ch-roads": {
        happened: "[Megasthenes describes roads with a pillar every ten stadia]({c:Megasthenes reports that officials}) and [a capital walled with 570 towers]({c:Megasthenes described Pāṭaliputra}). [Aśoka planted trees and dug wells along the roads]({c:Aśoka records having trees}).",
        howWeKnow: "From [Aśoka's Pillar Edict VII]({c:Aśoka records having trees}), and from Megasthenes [as Arrian reported him, four centuries later]({c:Megasthenes described Pāṭaliputra}).",
      },
      "ch-society": {
        happened: "[Aśoka claims to have provided medical care for people and animals]({c:Aśoka claims to have provided}). [Megasthenes said no Indian was a slave]({c:Arrian, citing Megasthenes}), but [the Arthaśāstra has rules for slaves]({c:The Arthaśāstra has a chapter of rules}).",
        howWeKnow: "From [Aśoka's Rock Edict II]({c:Aśoka claims to have provided}), Megasthenes as Arrian quotes him, and [a chapter of the Arthaśāstra]({c:The Arthaśāstra has a chapter of rules}).",
      },
      "ch-stone": {
        happened: "[In 1838 James Prinsep published translations of the edicts]({c:James Prinsep completed}). [Their Greek kings broadly confirm that the author was Aśoka]({c:Because these Hellenistic kings'}). [The Arthaśāstra was probably completed centuries later]({c:The surviving Arthaśāstra was probably}).",
        howWeKnow: "From [Prinsep's decipherment of the script]({c:James Prinsep completed}), [Hultzsch's edition of 1925]({c:Because these Hellenistic kings'}), and Shamasastry's translation of the Arthaśāstra.",
      },
      "ch-often-said": {
        happened: "Three beliefs: [that Aśoka converted in a flash at Kalinga]({c:Aśoka became a Buddhist suddenly}), [that Mauryan India had no slaves]({c:Megasthenes said no Indian was a slave}), and [that Chanakya wrote the Arthaśāstra as we have it]({c:The Arthaśāstra as we have it}).",
        howWeKnow: "Against them stand [Aśoka's own account of a slow change]({c:By his own account, Aśoka}), [the Arthaśāstra's rules for slaves]({c:The Arthaśāstra has a chapter of rules}) and [the text's later date]({c:The surviving Arthaśāstra was probably}).",
      },
    },
  },
  "independence-movement": {
    title: "Independence movement",
    briefs: {
      "ch-1857": {
        happened: "[In 1857 Hindu and Muslim sepoys rose together against their British officers]({c:Writing as the revolt unfolded}), [set off by greased cartridges]({c:Marx, reporting in 1857}). [Queen Victoria then promised to treat Indians like her other subjects]({c:After the revolt, Queen Victoria's}).",
        howWeKnow: "From reports of the time: [Marx's articles for a New York newspaper]({c:Marx, reporting in 1857}) and [Disraeli's speech in the Commons]({c:In the House of Commons in July 1857}).",
      },
      "ch-congress": {
        happened: "[In 1885 the first Indian National Congress met in Bombay, loyal to Britain]({c:The first Indian National Congress met}). [It asked for elected councillors]({c:The first Congress asked}); [Naoroji said British rule drained India's wealth]({c:Dadabhai Naoroji argued}).",
        howWeKnow: "From [the Congress's own printed addresses and resolutions]({c:The first Congress asked}) and [Naoroji's book of 1901]({c:Dadabhai Naoroji argued}).",
      },
      "ch-swaraj": {
        happened: "[After Bengal was partitioned, the Congress backed Bengal's boycott movement]({c:At Calcutta in 1906}). [Naoroji named the goal Swaraj]({c:Presiding over the Congress in 1906}); [in 1917 Britain promised gradual self-government]({c:On 20 August 1917}).",
        howWeKnow: "From [the Congress resolutions of 1906]({c:At Calcutta in 1906}), [Gandhi's Hind Swaraj]({c:In Hind Swaraj (1909)}) and [the British announcement of 1917]({c:On 20 August 1917}).",
      },
      "ch-amritsar": {
        happened: "[On 13 April 1919 General Dyer's troops fired without warning on a crowd in Amritsar]({c:On 13 April 1919, at Jallianwala Bagh}). [In 1922 Gandhi called off non-cooperation after violence at Chauri Chaura]({c:In February 1922}).",
        howWeKnow: "From two rival inquiries, [the government's Hunter Committee]({c:The official Hunter Committee}) and [the Congress's own]({c:The Congress's own inquiry}), which disagree about the dead.",
      },
      "ch-1930": {
        happened: "[In 1930 the Congress pledged itself to complete independence]({c:On 26 January 1930}), and [Gandhi marched to Dandi against the salt tax]({c:Before the Salt March, Gandhi wrote}). [Ambedkar called caste a worse tyranny]({c:In Annihilation of Caste}).",
        howWeKnow: "From the participants' own words: [the pledge]({c:The 1930 pledge blamed}), [Gandhi's letter to the Viceroy]({c:Before the Salt March, Gandhi wrote}) and [Ambedkar's published speech]({c:In Annihilation of Caste}).",
      },
      "ch-nations": {
        happened: "[In 1940 Jinnah said Hindus and Muslims could never be one nation]({c:At Lahore in March 1940}), and [the Muslim League asked for “independent states”]({c:On 23 March 1940}). [In 1942 the Congress demanded that Britain leave]({c:On 8 August 1942}).",
        howWeKnow: "From [the Lahore resolution]({c:On 23 March 1940}), [the Quit India resolution]({c:On 8 August 1942}) and [the government's case against the Congress]({c:The Government of India blamed}).",
      },
      "ch-war": {
        happened: "[A Bengal famine in 1943 killed 800,000 to 3.8 million people]({c:In 1943, during the war}). [In 1946 sailors in Bombay mutinied]({c:On 18 February 1946}); [some historians think the Indian National Army trials decisively shifted British policy]({c:Historians including Sumit Sarkar}).",
        howWeKnow: "From [the Prime Minister's statements to Parliament]({c:On 18 February 1946}), and from famine estimates that [differ widely]({c:In 1943, during the war}).",
      },
      "ch-1947": {
        happened: "[An Act of Parliament made India and Pakistan independent dominions on 15 August 1947]({c:The Indian Independence Act 1947}). [Partition drove 12 to 20 million people from their homes]({c:Partition displaced between}).",
        howWeKnow: "From [Britain's announcement of a June 1948 deadline]({c:On 20 February 1947}), [the Indian Independence Act itself]({c:The Indian Independence Act 1947}), and [estimates of the displaced and the dead]({c:Partition displaced between}), since no one counted them.",
      },
      "ch-often-said": {
        happened: "Two beliefs: [that the Congress wanted independence from 1885]({c:The Indian National Congress demanded independence}), and [that non-violence alone won it]({c:The independence movement was non-violent}). Then the argument of 1940: [one nation or two]({c:At Lahore in March 1940}).",
        howWeKnow: "Against them stand [the first Congress's words of loyalty]({c:The first Indian National Congress met}) and [the Assembly bombing of 1929]({c:On 8 April 1929}).",
      },
    },
  },
  "gupta-empire": {
    title: "Gupta Empire",
    briefs: {
      "ch-rise": {
        happened: "[Chandragupta I took the title “great king of kings”]({c:Samudragupta's inscription calls his great-grandfather}) and [married Kumāradevī of the Licchavis]({c:Chandragupta I married Kumāradevī}). [The Gupta calendar, from 319–320 CE, is usually dated from his reign]({c:Chandragupta I is usually taken}).",
        howWeKnow: "From [his descendants' inscriptions, dated in the Gupta era]({c:The Gupta kings dated their inscriptions}), which Fleet converted to our years in 1888, and [al-Bīrūnī's report that it counted from their fall]({c:Writing about 1030, al-Bīrūnī}).",
      },
      "ch-samudragupta": {
        happened: "[A praise poem on Aśoka's pillar at Allahabad]({c:Samudragupta's praise poem was carved}) says [Samudragupta]({c:Samudragupta's inscription says his father}) [destroyed northern kings]({c:In the north (Āryāvarta)}) and [captured and released southern ones]({c:In the south (Dakṣiṇāpatha)}). [Historians read it as diplomacy dressed up]({c:Historians think the poem presents}).",
        howWeKnow: "Almost only from that poem, [written by one of the king's own officers]({c:The poem was composed by Hariṣeṇa}), and [gold coins that show him playing a stringed instrument]({c:The inscription praises Samudragupta}).",
      },
      "ch-chandragupta": {
        happened: "[Chandragupta II conquered the Western Satraps of Saurashtra]({c:Chandragupta II conquered the Western Satraps}). [His daughter ruled the Vākāṭaka kingdom as regent]({c:Chandragupta II's daughter}). [His dated records run from 401 to 414 CE]({c:Chandragupta II's dated inscriptions}).",
        howWeKnow: "From dated inscriptions, such as [the cave inscription at Udayagiri of 401–402 CE]({c:At Udayagiri near Vidiśā}) and [a gift at Sanchi to feed five monks]({c:At the Buddhist monastery of Sanchi}).",
      },
      "ch-faxian": {
        happened: "[In 399 the Chinese monk Faxian set out for India]({c:The Chinese monk Faxian set out}). [He found the Ganges plain mild and content]({c:Faxian described the “Middle Kingdom”}), but also [the Caṇḍālas, treated as untouchable]({c:Faxian also described the Chandalas}).",
        howWeKnow: "From [Faxian's own travel record]({c:Faxian described the “Middle Kingdom”}), written for Buddhist readers, which [never names the king]({c:Faxian never names the king}).",
      },
      "ch-culture": {
        happened: "[By his translator's reckoning, Āryabhaṭa was 23 in 499]({c:Āryabhaṭa wrote that he was 23}). [Kālidāsa's dates are unknown]({c:Kālidāsa's dates are not known}). [A guild of silk weavers built a temple of the Sun]({c:At Daśapura (Mandsaur)}).",
        howWeKnow: "From [Āryabhaṭa's own verse on his age]({c:Āryabhaṭa wrote that he was 23}), and [the silk weavers' inscription at Mandsaur]({c:At Daśapura (Mandsaur)}).",
      },
      "ch-skandagupta": {
        happened: "[Skandagupta's pillar at Bhitari says he fought the Hūṇas (Huns), probably about 455]({c:The Bhitari pillar also says}). [In Gujarat his governor rebuilt a burst dam]({c:On the same boulder at Junāgaḍh}).",
        howWeKnow: "From his own praise inscriptions: [the Bhitari pillar]({c:Skandagupta's pillar at Bhitari says}) and [the Junāgaḍh rock]({c:The same inscription claims that while}).",
      },
      "ch-end": {
        happened: "[By 500 the Hūṇas had overrun much of the north-west]({c:Historians date the Hūṇa breakthrough}). [At Eran a Hūṇa king soon followed a Gupta one]({c:A few years later, “in the first year”}); [the Gupta line ended around 550]({c:The last recognised king}).",
        howWeKnow: "From dated stones at Eran: [Budhagupta's pillar of 484–485 CE]({c:A pillar at Eran dated}) and [Toramāṇa's boar]({c:A few years later, “in the first year”}); and from [Yaśodharman's boast at Mandsaur that Mihirakula bowed to him]({c:Yaśodharman of Daśapura boasted}).",
      },
      "ch-golden-age": {
        happened: "[In 1904 the historian Vincent Smith called it “the golden age of the Guptas”]({c:In 1904 the British historian Vincent Smith}). [Others dispute the label, pointing to harder caste lines and declining towns]({c:The golden-age label is disputed}).",
        howWeKnow: "From the historians' own books: [Smith's history of 1904]({c:In 1904 the British historian Vincent Smith}) and [D. N. Jha's critique]({c:The golden-age label is disputed}).",
      },
      "ch-often-said": {
        happened: "Five beliefs, among them [a golden age for everyone]({c:The Gupta period was a golden age}), [Āryabhaṭa's zero]({c:Āryabhaṭa invented zero}) and [Ajanta's paintings as Gupta art]({c:The Ajanta paintings are Gupta art}).",
        howWeKnow: "Against them stand [Faxian's Caṇḍālas]({c:Faxian also described the Chandalas}), [Āryabhaṭa's numbers without a zero sign]({c:Āryabhaṭa used a place-value system}) and [Ajanta's Vākāṭaka donors]({c:Cave XVI at Ajanta}).",
      },
    },
  },
  "indus-civilisation": {
    title: "Indus civilisation",
    briefs: {
      "ch-found": {
        happened: "[Masson took Harappa for a town Alexander besieged]({c:Masson took the mounds of Harappa}). [In 1924 Marshall saw that Harappa and Mohenjo-daro shared one unknown culture]({c:In the summer of 1924 John Marshall compared}). [Sumerian parallels dated it to the third millennium BCE]({c:Readers of Marshall's article}).",
        howWeKnow: "From [Marshall's announcement in the Illustrated London News]({c:Marshall announced the discovery}) and the excavators' reports.",
      },
      "ch-cities": {
        happened: "[From about 2600 to 1900 BCE]({c:The Indus civilisation is usually dated}) cities like Mohenjo-daro [had straight streets and drains]({c:At Mohenjo-daro the buildings}). [Over a thousand settlements are known; few were cities]({c:More than a thousand Mature Harappan sites}).",
        howWeKnow: "From excavation alone, such as [Marshall's digs at Mohenjo-daro]({c:Marshall found Mohenjo-daro's houses}) and [the later digs at Dholavira]({c:Dholavira was discovered in 1968}).",
      },
      "ch-script": {
        happened: "[More than 3,800 short Indus inscriptions are known]({c:More than 3,800 Indus inscriptions}), but [no one can read them]({c:The Indus script has not been deciphered}). [Some scholars doubt they are writing at all]({c:Farmer, Sproat and Witzel}).",
        howWeKnow: "From [the seals and tablets themselves]({c:More than 3,800 Indus inscriptions}); [no bilingual inscription has been found]({c:Three things make decipherment}).",
      },
      "ch-trade": {
        happened: "[Sargon of Akkad boasted of Meluhha's ships at his capital]({c:Sargon of Akkad (reigned}). [Most scholars take Meluhha to be the Indus]({c:Most scholars identify Meluhha}); [Indus seals turn up in Mesopotamia]({c:Indus objects, including seals}).",
        howWeKnow: "From [Sargon's own inscription]({c:Sargon of Akkad (reigned}), and [Indus objects dug up in Mesopotamia]({c:Indus objects, including seals}), [which gave Wheeler the only firm dates]({c:Wheeler stressed in 1947}).",
      },
      "ch-life": {
        happened: "[Mohenjo-daro's people made gold jewellery and faience, but used stone blades]({c:Marshall found that the people of Mohenjo-daro}). [Cities shared brick sizes and weights]({c:Cities far apart, such as Harappa}); [no palace has been found]({c:No palaces, rich royal tombs}), and [the seals show no horse]({c:In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall noted}).",
        howWeKnow: "From objects found in houses and workshops, such as [Dholavira's bead workshops]({c:Dholavira had bead workshops}).",
      },
      "ch-religion": {
        happened: "Without texts, every reading is a guess. [Marshall linked the Great Bath to religion]({c:Marshall wrote that the Great Bath's purpose}) and [saw an early Shiva on a seal]({c:Marshall identified the horned figure}); [later scholars disagree]({c:Later scholars have disputed}).",
        howWeKnow: "From objects alone, such as [the so-called Pashupati seal]({c:Marshall identified the horned figure}) and [a faience tablet Marshall took for a god]({c:In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall described a faience}), read by analogy with much later religion.",
      },
      "ch-end": {
        happened: "[From about 1900 BCE the cities shrank]({c:From about 1900 BCE the Indus cities}). [No destruction layer points to invasion]({c:There is no destruction layer}); one leading explanation is [a weakening monsoon drying the rivers]({c:Giosan and colleagues (2012) argue}).",
        howWeKnow: "From excavation, such as [Dales's count of the skeletons]({c:Re-examining the “massacre”}), and [geologists' studies of the rivers]({c:Giosan and colleagues (2012) argue}).",
      },
      "ch-after": {
        happened: "[Writing, seals and big buildings disappeared, but villages carried on]({c:As the cities emptied}). [One ancient genome suggests their kind of ancestry was a main ancestor of later South Asians]({c:An ancient genome from Rakhigarhi}).",
        howWeKnow: "From village sites, and [the DNA of one person from Rakhigarhi]({c:An ancient genome from Rakhigarhi}), which [cannot speak for a whole civilisation]({c:The authors of the Rakhigarhi genome study}).",
      },
      "ch-how": {
        happened: "[There are no Indus histories, king lists or letters]({c:No historical texts about the Indus}). [The early digs were poorly recorded]({c:The early excavations were poorly recorded}), so old ideas lasted.",
        howWeKnow: "From a century of digging, [survey from the air]({c:In 1924–25 an experimental aeroplane}), and now river geology and ancient DNA.",
      },
      "ch-often": {
        happened: "Five beliefs, among them [an Aryan invasion]({c:The Indus cities were destroyed by an Aryan}), [a deciphered script]({c:The Indus script has been deciphered}) and [one king ruling one empire]({c:The Indus civilisation was a single empire}).",
        howWeKnow: "Against them stand [the missing destruction layer]({c:There is no destruction layer}), [the unread signs]({c:The Indus script has not been deciphered}) and [the absence of palaces]({c:No palaces, rich royal tombs}).",
      },
    },
  },
  "early-medieval-kingdoms": {
    title: "Early medieval kingdoms",
    briefs: {
      "ch-harsha": {
        happened: "[Harṣa ruled from Kannauj from 606 to 647]({c:Harṣa ruled from 606}). [His guest Xuanzang describes long wars, then peace]({c:Xuanzang, Harṣa's guest}), but [the Deccan king Pulakeśin II stopped him]({c:Pulakeśin II's Aihole inscription}) [at the Narmadā]({c:The battle was fought on the Narmadā}).",
        howWeKnow: "From [the Chinese pilgrim Xuanzang]({c:Xuanzang, Harṣa's guest}), [the court poet Bāṇa]({c:Bāṇa's Harṣacarita}), and [Pulakeśin's own inscription at Aihole]({c:Pulakeśin II's Aihole inscription}).",
      },
      "ch-deccan": {
        happened: "[The Chalukyas ruled the Deccan from Vātāpi (Badami)]({c:The Chalukyas ruled the Deccan}), [the Pallavas the Tamil north from Kāñcī]({c:The Pallavas ruled the Tamil north}). [Around 642 the Pallavas took Vātāpi]({c:The Pallava king Narasiṃhavarman I took}).",
        howWeKnow: "From both sides' inscriptions: [the Aihole poem]({c:The Aihole poem says Pulakeśin}) and [Pallava grants praising the king who destroyed Vātāpi]({c:The Pallava king Narasiṃhavarman I took}).",
      },
      "ch-kannauj": {
        happened: "[The Pratihāras, Pālas and Rāṣṭrakūṭas fought for Kannauj until 816]({c:Kannauj became the prize}). [An Arab merchant judged the Rāṣṭrakūṭa king the greatest in India]({c:Sulaimān called the Balharā}).",
        howWeKnow: "From the dynasties' copper-plate grants, such as [the Pālas']({c:Pāla grants say Gopāla's son}), and [Sulaimān's account of 851]({c:The Pratihāras held the Arab armies}).",
      },
      "ch-thanjavur": {
        happened: "[Rājarāja I inherited a small Chola kingdom in 985]({c:The imperial Chola line began}) and [listed conquests as far as Sri Lanka]({c:Rājarāja's inscriptions open}). [He built the great temple at Thanjavur by 1010]({c:Rājarāja built the great temple}).",
        howWeKnow: "From [the inscriptions on the temple's own walls]({c:Rājarāja built the great temple}), [dated by the years of his reign]({c:Chola inscriptions are dated}). They record [400 women, evidently dancers, brought from other temples]({c:The temple's records show 400 women}).",
      },
      "ch-sea": {
        happened: "[Rājendra I's armies reached the Ganges]({c:Rājendra's armies went north}). [About 1025 his fleet captured the king of Kaḍāram]({c:Rājendra's inscriptions say}), [in the realm of Śrīvijaya]({c:Where Kaḍāram was}): [a raid, not lasting rule]({c:The expedition did not bring}).",
        howWeKnow: "From [Rājendra's own inscriptions]({c:Rājendra's inscriptions say}), which boast of treasure but [give no reason for the raid]({c:Why Rājendra attacked}).",
      },
      "ch-villages": {
        happened: "[In 919 a royal order made Uttaramerūr's assembly choose its committees by lot]({c:Two inscriptions of Parāntaka I's}). [Only landowners aged 35 to 70 who knew the Veda could be drawn]({c:To be named on a ticket}), [from a Brahmin assembly]({c:Uttaramerūr had two assemblies}).",
        howWeKnow: "From [the two inscriptions at Uttaramerūr]({c:Two inscriptions of Parāntaka I's}), read by historians [who disagree about how far the king ruled]({c:The historian Burton Stein}).",
      },
      "ch-feudal": {
        happened: "[Inscriptions are full of sāmantas, subordinate lords]({c:The word sāmanta, once}); [the Senas replaced the Pālas, weakened by theirs]({c:The Pāla kingdom was weakened}). [In 1965 R. S. Sharma called India feudal]({c:R. S. Sharma's Indian Feudalism}); [others doubt the European word fits]({c:Calling India feudal applies}).",
        howWeKnow: "From the inscriptions' own word, sāmanta, and [historians' books since Sharma's of 1965]({c:R. S. Sharma's Indian Feudalism}); his critics are not yet quoted here.",
      },
      "ch-mahmud": {
        happened: "[Mahmud of Ghazni raided India for thirty years]({c:Mahmud of Ghazni raided India}). [In 1025–26 he broke the image at Somnāth]({c:Alberuni, who at times travelled}); [the temple seems to have been repaired soon after]({c:Thapar points out}).",
        howWeKnow: "From [Alberuni, who at times travelled with Mahmud's troops]({c:Alberuni, who at times travelled}), and from [a chronicler born more than a century later]({c:The fuller story of a “dreadful slaughter”}).",
      },
      "ch-sources": {
        happened: "[Kings dated their records by the years of their reigns]({c:Chola inscriptions are dated}). [Kalhaṇa's history of Kashmir, of 1148–49, checked books against inscriptions]({c:Kalhaṇa, writing his Rājataraṅgiṇī}), but [its early books are legend]({c:Yet the early books}).",
        howWeKnow: "From [Kalhaṇa's own account of his method]({c:Kalhaṇa, writing his Rājataraṅgiṇī}), checked against [other evidence, which matches him only from the ninth century]({c:Yet the early books}).",
      },
      "ch-often-said": {
        happened: "Five beliefs, among them [a Chola empire in South-East Asia]({c:The Cholas ruled an empire}), [democratic Chola villages]({c:Chola villages were democracies}) and [a dark age after the Guptas]({c:After the Guptas India fell}).",
        howWeKnow: "Against them stand [the short Śrīvijaya raid]({c:The expedition did not bring}), [Uttaramerūr's committees, drawn by lot for its Brahmin assembly only]({c:Uttaramerūr had two assemblies}) and [the Kailāsa and Thanjavur temples]({c:Rājarāja built the great temple}).",
      },
    },
  },
  mahajanapadas: {
    title: "Mahājanapadas",
    briefs: {
      "ch-sixteen": {
        happened: "[Buddhist texts list sixteen “great countries”]({c:Early Buddhist texts keep a stock list}), [placed in the sixth to fourth centuries BCE]({c:Historians place the sixteen states}). [No one ruled them all]({c:When Buddhism arose}); [four kingdoms led]({c:The four kingdoms were Magadha}).",
        howWeKnow: "From [Buddhist and Jain lists that do not agree]({c:The lists do not agree}): [lists of peoples, Rhys Davids saw, not of countries]({c:Rhys Davids noticed that the sixteen}).",
      },
      "ch-republics": {
        happened: "Some states had no king: [clans like the Sakyas met in assembly halls]({c:The Sakya clan, the Buddha's own}). [Power lay with warrior families]({c:Most of these clan states were aristocratic}); [historians disagree about calling them republics]({c:Historians disagree about what to call}).",
        howWeKnow: "From Buddhist texts, such as [the Buddha's words on the Vajjians' assemblies]({c:In the Mahāparinibbāna Sutta the Buddha says}), and [what Alexander's soldiers heard]({c:Alexander's men heard of a country}).",
      },
      "ch-cities": {
        happened: "[From about 600 BCE towns grew again in the Ganges plain]({c:From about 600 BCE towns grew up again}). [In them wandering ascetics challenged the brahmins' rituals]({c:The growing towns of the seventh}).",
        howWeKnow: "From [a black polished pottery that marks the towns]({c:From about 600 BCE towns grew up again}), and [the six great cities the texts name]({c:When the Buddha lay dying, Ānanda}).",
      },
      "ch-magadha": {
        happened: "[Bimbisāra of Magadha took Aṅga]({c:Bimbisāra of Magadha reigned}). [Buddhist tradition says his son Ajātasattu killed him]({c:Buddhist tradition says Ajātasattu}), then [attacked the Vajjians]({c:Ajātasattu resolved}) and [built the fort that became Pāṭaliputra]({c:Ajātasattu's ministers built}). [Their dates cannot be fixed]({c:Even Vincent Smith (1914)}).",
        howWeKnow: "From later chronicles, and [Buddhist and Jain accounts that disagree]({c:Jain scripture tells it differently}).",
      },
      "ch-buddha": {
        happened: "[The Buddha taught in Magadha under Bimbisāra]({c:The Buddha and Mahāvīra both taught}) and [preached a middle path]({c:The Buddha's first sermon}). [He died at Kusinārā, at about eighty]({c:Near the end the Buddha says}); [when is debated]({c:Many historians now put the Buddha's death}).",
        howWeKnow: "From [the suttas]({c:Near the end the Buddha says}), remembered by his followers and written down centuries later.",
      },
      "ch-teachers": {
        happened: "[Ajātasattu's ministers named six famous teachers]({c:In the Sāmaññaphala Sutta}). [One, Mahāvīra, taught non-harm]({c:The Ācārāṅga Sūtra teaches}) [and died at seventy-two]({c:The Kalpa Sūtra says Mahāvīra}); [Jains count him their twenty-fourth great teacher]({c:For Jains, Mahāvīra}).",
        howWeKnow: "From [Jain scriptures such as the Ācārāṅga Sūtra]({c:The Ācārāṅga Sūtra teaches}), and [the Buddhists' accounts of their rivals]({c:As the Buddhists report him}).",
      },
      "ch-persia": {
        happened: "[From about 535 BCE Persia pushed into the north-west]({c:Around 535 BCE the Persian king Cyrus}), and [Darius I listed Gandhāra among his lands]({c:Darius I's inscription at Behistun}). [Indians paid Persia tribute in gold]({c:According to Herodotus the Indians}).",
        howWeKnow: "From [Darius's inscription at Behistun]({c:Darius I's inscription at Behistun}), and [the Greek historian Herodotus]({c:According to Herodotus the Indians}), who wrote from report.",
      },
      "ch-nandas": {
        happened: "[The Nandas, said to be low-born]({c:The Purāṇas say Mahāpadma Nanda}), ruled the Ganges plain. [Alexander beat Porus in 326 BCE]({c:Alexander defeated Porus}), but [his army turned back at the Beas]({c:At the Hyphasis (Beas)}). [A brahmin crowned Chandragupta]({c:Both the Purāṇas and the Mahāvaṃsa}).",
        howWeKnow: "From [Greek and Roman writers centuries after Alexander]({c:Plutarch says the young Androkottos}), and from [the Purāṇas]({c:The Purāṇas say Mahāpadma Nanda}).",
      },
      "ch-dating": {
        happened: "[Sri Lankan chronicles count 218 years from the Buddha's death to Aśoka]({c:The Sri Lankan chronicles count}). That gives [544 BCE]({c:Taking Aśoka's consecration}) or [483]({c:Wilhelm Geiger (1912) combined}); [many historians now prefer about 400]({c:Many historians now put the Buddha's death}).",
        howWeKnow: "From [the Mahāvaṃsa, a devotional chronicle]({c:The Mahāvaṃsa says Prince Vijaya}), checked against Greek dates for Chandragupta and Aśoka.",
      },
      "ch-often-said": {
        happened: "Five beliefs, among them [Mahāvīra founding Jainism]({c:Mahāvīra founded Jainism}), [settled dates for the Buddha]({c:The Buddha's dates are settled}) and [Alexander conquering India]({c:Alexander the Great conquered India}).",
        howWeKnow: "Against them stand [the twenty-three Jain teachers before Mahāvīra]({c:For Jains, Mahāvīra}), [the chronicles' rival dates]({c:Taking Aśoka's consecration}) and [Alexander's turn at the Beas]({c:At the Hyphasis (Beas)}).",
      },
    },
  },
};

const only = process.argv.includes("--page") ? process.argv[process.argv.indexOf("--page") + 1]!.split(",") : null;

const words = (md: string) => md.replace(/\]\([^)]*\)/g, "]").replace(/[[\]]/g, "").split(/\s+/).filter(Boolean).length;
for (const [page, { briefs }] of Object.entries(BRIEFS))
  for (const [chapter, b] of Object.entries(briefs))
    if (words(b.happened) > 30) throw new Error(`${page}/${chapter}: “happened” has ${words(b.happened)} words (at most 30)`);

const specs: CopyEdit[] = Object.entries(BRIEFS)
  .filter(([page]) => !only || only.includes(page))
  .map(([page, { title, briefs }]) => ({
    page,
    title: `${title}: one-minute summaries for every part`,
    rationale: [
      "Each chapter gets a brief: what happened, in one or two plain sentences (30 words at most) with every fact linked to the claim it rests on, and how we know, in one sentence naming the kind of evidence. Read together, a page's briefs give a first-time reader the skeleton of the era in a few minutes.",
      "The briefs add no fact beyond the linked claims. Hedges are kept: debated dates are given as debated, and no reign before the Mauryas gets an absolute date.",
    ],
    blocks: Object.entries(briefs).map(([chapter, brief]) => ({
      block: chapter,
      was: [NO_BRIEF, ...(EARLIER[`${page}/${chapter}`] ?? [])],
      set: { brief },
    })),
  }));

await runCopyEdit(...specs);
