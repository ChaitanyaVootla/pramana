/**
 * Fixes for six claims on the independence page still short of L3 after the
 * AI support checks (verifier, round m10): a quote for each missing date, and
 * claims reworded to what their sources say. Claims and citations only; the
 * objects are found on the page by their opening words.
 *
 *   pnpm tsx scripts/seed/independence-fixes.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";

await runFixes({
  title: "The independence movement: support fixes for six claims",
  parents: [],
  page: "independence-movement",
  onPage: {
    claims: {
      c_inc_1885: "The first Indian National Congress met in Bombay in December 1885.",
      c_purna_swaraj: "On 26 January 1930 the Congress asked meetings",
      c_ncm_programme: "At a special session in Calcutta in September 1920",
      c_swadeshi_1906: "At Calcutta in 1906 the Congress declared",
      c_women_1930: "Women took part in the salt campaign",
      c_proclamation_1858: "After the revolt, Queen Victoria's proclamation of November 1858",
    },
    excerpts: {
      x_bonnerjee_first: "he might well be proud of being thus called on",
      x_ncm_session: "the special session of the Congress which met at Calcutta",
    },
  },
  excerpts: [
    { ref: "x5_bonnerjee_1892", like: "x_bonnerjee_first", quote: "I have the honour to be the person who inaugurated the Congress movement in Bombay, in the year 1885, as its first President. It is singular coincidence that the Bombay meeting was held on this very day, the 28th of December.", locator: { page: "113", label: "Part II, Congress Presidential Addresses: “Eighth Congress — Allahabad — 1892”, W. C. Bonnerjee" } },
    { ref: "x5_gandhi_1920", like: "x_ncm_session", quote: "her challenge was issued in the September of 1920 at Calcutta that India would be satisfied with nothing less than Swaraj and full redress of the Khilafat and the Punjab wrongs", locator: { page: "1183", label: "Gandhi, “Shaking the Manes” (Young India, February 1922)" } },
  ],
  reword: {
    c_purna_swaraj: {
      text: "On 26 January 1930, Purna Swaraj Day, public meetings across India were to adopt a Congress pledge that India must sever the British connection and attain Purna Swaraj, complete independence.",
      learning: { prompt: "On what day were meetings across India to adopt the Purna Swaraj pledge?", answer: "On 26 January 1930, Purna Swaraj Day." },
    },
    c_swadeshi_1906: { text: "At Calcutta in 1906 the Congress declared the boycott movement, begun in Bengal in protest against its partition, legitimate, and urged swadeshi: preferring Indian-made goods even at some sacrifice." },
    c_women_1930: { text: "Women took part in the salt campaign: in April 1930 women of Gujarat told the Viceroy that village women were already making illegal salt, and that they would carry out the boycott of foreign cloth and the prohibition of liquor through picketing." },
    c_proclamation_1858: {
      text: "After the revolt, Queen Victoria's proclamation of November 1858 declared her bound to the people of her Indian territories by the same obligations of duty as to all her other subjects; Naoroji later quoted it back at British rule.",
      learning: { prompt: "What did Queen Victoria's proclamation of November 1858 declare?" },
    },
  },
  add: [
    ["c_inc_1885", "x5_bonnerjee_1892", "supports", "Bonnerjee, presiding again in 1892, gives the day of the first meeting: 28 December 1885."],
    ["c_ncm_programme", "x5_gandhi_1920", "supports", "Gandhi gives the year of the Calcutta session."],
  ],
  remove: [],
  rationale: [
    "Six claims on the independence page were still short of L3 after the AI support checks (verifier round m10). Fixed from the snapshots already cited, without new sources.",
    "Dates the quotes lacked: “December” 1885, from Bonnerjee's own address of 1892 (“the Bombay meeting was held on this very day, the 28th of December”); the year 1920 for the Calcutta session, from Gandhi in Young India (“her challenge was issued in the September of 1920 at Calcutta”).",
    "Reworded to what the sources say: the 1906 resolution calls it “the Boycott Movement”, not a boycott of British goods; the Gujarat women's letter speaks of “picketing” for the boycott of foreign cloth and of liquor, not of shops; the Purna Swaraj resolution was issued “for adoption by public meetings … on Purna Swarajya Day, Sunday January 26th, 1930”, so the pledge was for that day, not asked on it; and the 1858 Proclamation binds the Queen to her Indian subjects, rather than promising them obligations (“We hold ourselves bound to the Natives of our Indian territories by the same obligations of duty which bind us to all our other subjects”). Two learning prompts follow the new wording.",
  ],
});
