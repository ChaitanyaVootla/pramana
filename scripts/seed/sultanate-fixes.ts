/**
 * Fixes on the Delhi Sultanate page from its support self-check
 * (scripts/verify/support-dump.ts): quotes for parts of claims the cited
 * passages did not cover, and claims reworded where they said more than
 * their sources. See fixes-lib.ts for how objects are found.
 *
 *   pnpm tsx scripts/seed/sultanate-fixes.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";

const PAGE = "The Delhi Sultanate (1206–1526): page, sources and entities";
const BARANI = "Baranī, Tārīkh-i Fīrūz Shāhī";

await runFixes({
  title: "The Delhi Sultanate: fixes from the support self-check",
  parents: [PAGE],
  page: "delhi-sultanate",
  excerpts: [
    { ref: "sx2_wp_aram", like: "sx_wp_1398", quote: "After Aibak died, Aram Shah assumed power in 1210, but he was assassinated in 1211 by Aibak's son-in-law, Shams ud-Din Iltutmish.", locator: { section: "Mamluk dynasty (1206–1290)" } },
    { ref: "sx2_ed2_sons", like: "sx_ed2_heir", quote: "My sons are devoted to the pleasures of youth, and no one of them is qualified to be king. They are unfit to rule the country", locator: { volume: "2", page: "333", label: "Minhāj, Ṭabaqāt-i Nāṣirī: Sultan Raziya" } },
    { ref: "sx2_ed3_siri", like: "sx_ed3_forts", quote: "After this very serious danger, ’Alau-d din awoke from his sleep of neglect. He gave up his ideas of campaigning and fort-taking, and built a palace at Siri. He took up his residence there, and made it his capital, so that it became a flourishing place.", locator: { volume: "3", page: "191", label: BARANI } },
    { ref: "sx2_ed3_garrison", like: "sx_ed3_forts", quote: "Samana and Deobalpur were ordered to be garrisoned with strong selected forces, and to be kept in a state of defence", locator: { volume: "3", page: "191", label: BARANI } },
    { ref: "sx2_ed3_aslong", like: "sx_ed3_wonder", quote: "This scale of prices was maintained as long as ’Alau-d din lived, and grain never rose one dang", locator: { volume: "3", page: "192", label: BARANI } },
    { ref: "sx2_ed3_author", like: "sx_ed3_chitor", quote: "The author accompanied the expedition.", locator: { volume: "3", page: "77", label: "Amīr Khusrau, Khazāʾin al-Futūḥ (Taʾrīkh-i ʿAlāʾī), as abstracted by Elliot and Dowson" } },
    { ref: "sx2_ed3_current", like: "sx_ed3_mint", quote: "so he introduced his copper money, and gave orders that it should be used in buying and selling, and should pass current, just as the gold and silver coins had passed.", locator: { volume: "3", page: "240", label: BARANI } },
    { ref: "sx2_thomas_mint", like: "sx_thomas_legend", quote: "At the seat of royalty, Daulatabad, in the year (7)31.", locator: { page: "249", label: "Coin no. 196: brass, Daulatabad, AH 731–732" }, note: "The OCR reads “BaulatabM”." },
    { ref: "sx2_ed3_tobra", like: "sx_ed3_pillars", quote: "One was in the village of Tobra, in the district (shikk) of Salaura and Khizrabad, in the hills (koh-payah); the other in the vicinity of the town of Mirat.", locator: { volume: "3", page: "350", label: "ʿAfīf, Tārīkh-i Fīrūz Shāhī: transport of the stone obelisks" } },
    { ref: "sx2_ed3_killed", like: "sx_ed3_firuz_new", quote: "Under Divine guidance I destroyed these edifices, and I killed those leaders of infidelity who seduced others into error, and the lower orders I subjected to stripes and chastisement", locator: { volume: "3", page: "380", label: "Fīrūz Shāh, Futūḥāt-i Fīrūz Shāhī" } },
    { ref: "sx2_ed3_prisoners", like: "sx_ed3_timur_army", quote: "the spoil was so great that each man secured from fifty to a hundred prisoners, men, women, and children. There was no man who took less than twenty.", locator: { volume: "3", page: "446", label: "Malfūẓāt-i Tīmūrī" } },
    { ref: "sx2_lp_17dec", like: "sx_lp_ideas", quote: "On the 17th December, 1398, the decisive battle was fought.", locator: { page: "156" } },
    { ref: "sx2_kabir_temple", like: "sx_kabir_song", quote: "where dost thou seek Me? Lo! I am beside thee. I am neither in temple nor in mosque: I am neither in Kaaba nor in Kailash", locator: { page: "45", label: "Song I" } },
    { ref: "sx2_eaton_sources", like: "sx_eaton_eighty", quote: "by relying strictly on evidence found in contemporary or near-contemporary epigraphic and literary sources spanning a period of more than five centuries (1192-1729), one may identify eighty instances of temple desecration whose historicity appears reasonably certain", locator: { page: "66" } },
    { ref: "sx2_eaton_royaltemple", like: "sx_eaton_royal", quote: "When such authority was vested in a ruler whose own legitimacy was associated with a royal temple – typically one that housed an image of a ruling dynasty’s state-deity, or rastra-devata (usually Vishnu or Siva) – that temple was normally looted, redefined, or destroyed", locator: { page: "63" } },
  ],
  reword: {
    d_iltutmish: { text: "Iltutmish, Aibak's son-in-law, who took the throne in 1211, had also been bought as a slave: Aibak purchased him in Delhi and treated him as a son." },
    d_chittor: {
      text: "ʿAlāʾ al-Dīn took Chittor in August 1303; his court poet Amīr Khusrau, who went on the campaign, records the capture and a massacre.",
      assessmentNote: "From Elliot and Dowson's abstract of Khusrau's work, not a full translation. The abstract names no queen Padmāvatī.",
    },
    d_tokens: { text: "Muḥammad bin Tughluq issued copper tokens to pass current just as gold and silver coins did; they were forged on a large scale, and he withdrew them, exchanging them for gold coin." },
    d_lanepoole: { text: "Stanley Lane-Poole (1903) judged Muḥammad bin Tughluq a man with ideas far beyond his age, whose lack of balance and patience made him a “transcendent failure”." },
  },
  add: [
    ["d_iltutmish", "sx2_wp_aram", "supports", "Aram Shah reigned briefly between them."],
    ["d_raziya_heir", "sx2_ed2_sons", "supports"],
    ["d_mongol_forts", "sx2_ed3_siri", "supports"],
    ["d_mongol_forts", "sx2_ed3_garrison", "supports"],
    ["d_prices", "sx2_ed3_aslong", "supports"],
    ["d_chittor", "sx2_ed3_author", "supports"],
    ["d_tokens", "sx2_ed3_current", "supports"],
    ["d_token_legend", "sx2_thomas_mint", "supports"],
    ["d_pillars", "sx2_ed3_tobra", "supports", "Tobra is Topra; Mirat is Meerut."],
    ["d_firuz_temples", "sx2_ed3_killed", "supports"],
    ["d_timur_sack", "sx2_ed3_prisoners", "supports"],
    ["d_timur_sack", "sx2_lp_17dec", "supports", "The battle before the city; the sack followed in the next days."],
    ["d_kabir", "sx2_kabir_temple", "supports"],
    ["d_eaton_count", "sx2_eaton_sources", "supports"],
    ["d_eaton_political", "sx2_eaton_royaltemple", "supports"],
  ],
  remove: [],
  prose: [
    ["his own former slave Iltutmish followed him", "his former slave and son-in-law Iltutmish took the throne in 1211"],
    ["His successor Iltutmish had also been bought as a slave", "Iltutmish, Aibak's son-in-law, who took the throne in 1211, had also been bought as a slave"],
    ["issued brass and copper coins to pass as silver", "issued copper tokens to pass as gold and silver"],
    ["copper and brass coins decreed to be worth silver ones", "copper tokens decreed to pass current like gold and silver coins"],
    ["a coinage of brass", "a token coinage"],
  ],
  rationale: [
    "Fixes from the support self-check of the Delhi Sultanate page (support-dump over all 76 evidential citations), made before review.",
    "New quotes from the same snapshots for parts of claims the cited passages did not cover: Siri and the frontier garrisons; Iltutmish's “My sons … are unfit to rule”; prices “maintained as long as ʿAlāʾ al-Dīn lived”; Khusrau with the Chittor expedition; Baranī's “pass current, just as the gold and silver coins”; the token's mint and year; Tobra and Mirat; Fīrūz Shāh's “I killed those leaders”; Tīmūr's “from fifty to a hundred prisoners” and Lane-Poole's date; Kabīr's “neither in temple nor in mosque”; Eaton's sources and dates (1192–1729) and his royal-temple argument; Wikipedia on Aram Shah.",
    "Reworded where claims said more than their sources: Iltutmish did not directly succeed Aibak (Aram Shah reigned 1210–11); the tokens were to pass as gold and silver (Baranī), and copper (the brass ones are on the token claim); Lane-Poole says “no balance or patience”, not cruelty; the absence of Padmāvatī from Khusrau moves to the note, as it is not something a quote can show.",
  ],
});
