/**
 * Learning prompts and answers on the Indus and Vedic pages, rewritten so
 * every name and number in them is in the claim's current text (the rule in
 * core's groundedAnswer): some were written for earlier wordings, or added
 * facts the claim does not state. Shared by the seed files' values and
 * learning-fixes.ts, which updates the stored claims.
 */
export const LEARNING: Record<string, { prompt: string; answer: string }> = {
  // Indus
  c_great_bath: { prompt: "How did the builders of the Great Bath make it watertight?", answer: "With fine brick, gypsum mortar and a backing of bitumen." },
  c_script_undeciphered: { prompt: "Has the Indus script been deciphered?", answer: "No. There have been many claimed decipherments, more than a hundred by one count, but none is widely accepted." },
  c_script_obstacles: { prompt: "Name two reasons the script is so hard to decipher.", answer: "No bilingual inscription has been found; the inscriptions are very short (about five signs); the language is unknown." },
  c_meluhha_id: { prompt: "What was Meluhha?", answer: "A seafaring land of the Mesopotamian texts, which most scholars identify with the Indus civilisation, though this is not proven." },
  c_standard: { prompt: "What was the same in cities far apart, such as Harappa and Mohenjo-daro?", answer: "Brick sizes, and a standard system of weights kept for centuries." },
  c_protoshiva: { prompt: "Whom did Marshall see in the horned figure on the so-called Pashupati seal?", answer: "The god Shiva: he concluded that Shiva's cult went back to the Indus period." },
  c_decline: { prompt: "Roughly when did the Indus cities decline?", answer: "From about 1900 BCE: the cities shrank and many sites were abandoned, while settlements grew in number further east." },
  c_wheeler_indra: { prompt: "Who wrote that “Indra stands accused”, and of what?", answer: "Mortimer Wheeler, in 1947: he argued that Aryan invaders deliberately destroyed the civilisation, pointing to skeletons at Mohenjo-daro." },
  c_no_destruction: { prompt: "What evidence would an invasion have left at Mohenjo-daro, and is it there?", answer: "A destruction layer, burning, weapons, signs of a last defence. There are none." },
  // Prompt as learn set it on both databases, with the answer content wrote into indus.ts (not stored on the claims).
  c_priestking_name: { prompt: "What is the “Priest-King”, and how do some now read it?", answer: "The common name for a 17.5 cm statuette from Mohenjo-daro; some now read it as evidence of contact with neighbouring peoples rather than of a ruling elite." },
  c_deurban: { prompt: "What disappeared as the cities emptied, and what carried on?", answer: "Writing, seals, standard weights, long-distance trade and large public buildings went; small settlements carried on and even multiplied." },
  // Vedic
  v_rv_size: { prompt: "How is the Ṛgveda organised?", answer: "As 1,028 hymns in ten books." },
  v_oral: { prompt: "How were the Vedic hymns preserved for most of their history?", answer: "By mouth: memorised with great precision, long before they were written down." },
  v_mm_nopower: { prompt: "What did Max Müller say about proving when the hymns were composed?", answer: "That whether it was 1000, 1500, 2000 or 3000 years BCE, “no power on earth will ever determine”." },
  v_mitanni: { prompt: "What do treaties of about 1400 BCE from Mitanni show?", answer: "They invoke Mitra, Varuṇa, Indra and the Nāsatyas, grouped as in the Ṛgveda." },
  v_modern_date: { prompt: "When is the Ṛgveda usually dated?", answer: "The bulk of it to about 1500–1000 BCE; a wider range of about 1900–1200 BCE is also given." },
  v_tenkings: { prompt: "What does Book 7 of the Ṛgveda tell of Sudās?", answer: "That Sudās, king of the Bharatas, with Indra's help defeated a confederation of ten kings by the river Paruṣṇī, the Ravi." },
  v_jones: { prompt: "What did William Jones point out in 1786?", answer: "That Sanskrit was so like Greek and Latin, in roots and grammar, that all three must have sprung from a common source." },
  v_mm_race: { prompt: "What did Max Müller say “Aryan” meant?", answer: "Those who speak an Aryan language, not a race: “Aryan blood” was as absurd as a long-headed dictionary." },
  v_purusha: { prompt: "How does the Puruṣa Sūkta describe the four orders of society?", answer: "As made from the body of the primeval Man: the brāhmaṇa was his mouth, the rājanya his arms, the vaiśya his thighs, and the śūdra came from his feet." },
  v_ayas: { prompt: "What does the Atharvaveda's “dark” ayas suggest, according to Macdonell?", answer: "That the distinction between iron and copper or bronze had only recently been drawn." },
};
