/**
 * "Guess first" questions and end-of-chapter checks for the Maurya Empire,
 * Independence movement, Gupta Empire, Indus civilisation, Mahājanapadas,
 * Vedic period and early medieval kingdoms pages. Every question is answered by a claim already on the page:
 *
 * - a guess names its claim by a unique prefix and quotes the words in the
 *   claim that settle it (`grounding`); the runner refuses a guess whose claim
 *   does not contain them;
 * - order questions are graded against the claims' stored dates, and the
 *   runner refuses claims that are undated or whose dates overlap;
 * - place questions use entities whose coordinates came from Wikidata (the
 *   runner checks the entity has a QID and a point), with a tolerance in km.
 *
 * Labels in order questions name an event without its date; prompts restate
 * what the claim says, in a question.
 */

export interface GuessSpec {
  chapter: string;
  question: string;
  claim: string;
  /** Words in the claim's text that give the answer. */
  grounding: string;
  answer:
    | { kind: "choice"; options: string[]; correct: number }
    | { kind: "number"; value: number; unit?: string; tolerance?: number }
    | { kind: "year"; year: number; era: "BCE" | "CE"; tolerance?: number };
  note?: string;
}

export type CheckSpecItem =
  | { kind: "recall"; id: string; claim: string; prompt?: string }
  | { kind: "order"; id: string; prompt?: string; items: { claim: string; label: string }[] }
  | {
      kind: "place";
      id: string;
      entity: string;
      /** For places added by learn-places.ts, which may still be waiting for review. */
      qid?: string;
      prompt?: string;
      toleranceKm?: number;
    };

/** Places map questions need that the platform may not have yet (proposed by learn-places.ts, from Wikidata). */
export const PLACES: { qid: string; slug: string; why: string }[] = [
  { qid: "Q48403", slug: "amritsar", why: "Amritsar, where Jallianwala Bagh is, on the independence movement page" },
];

export interface CheckSpec {
  chapter: string;
  title?: string;
  items: CheckSpecItem[];
}

export interface PageLearnSpec {
  page: string;
  title: string;
  rationale: string[];
  guesses: GuessSpec[];
  checks: CheckSpec[];
}

export const MAURYA: PageLearnSpec = {
  page: "maurya-empire",
  title: "Maurya Empire page: guess-first questions and chapter checks",
  rationale: [
    "Adds a “Guess first” question at the start of eight chapters and a short retrieval check at the end of each, for learning (pretesting, then practice testing). Nothing new is asserted: each answer is a claim already on the page, shown with its evidence when the answer is revealed.",
    "Number and year answers are the claim's own figures (150,000 deported, 570 towers, the twentieth regnal year, seven classes, 1838). Order questions are graded against the claims' stored dates. Place questions use Pāṭaliputra, Dhauli, Lumbinī and the Kalsi rock edicts, whose coordinates come from Wikidata (Q389755, Q3498218, Q9213, Q56064770); tolerances are generous because the points are approximate.",
    "The often-said chapter gets no new blocks: its misconceptions already carry “Did you believe this?”.",
  ],
  guesses: [
    {
      chapter: "ch-empire",
      question: "Under Aśoka, how far did the Maurya Empire reach?",
      claim: "Under Aśoka the empire",
      grounding: "except the far south",
      answer: { kind: "choice", options: ["Only the Ganges plain", "Most of the subcontinent, except the far south", "All of South and South-East Asia", "Only Magadha"], correct: 1 },
    },
    {
      chapter: "ch-kalinga",
      question: "How many people does Aśoka say were deported from Kalinga after his conquest?",
      claim: "Rock Edict XIII puts the toll",
      grounding: "150,000 people deported",
      answer: { kind: "number", value: 150000, unit: "people" },
      note: "The figure is the king's own, in the edict where he says he regrets the war.",
    },
    {
      chapter: "ch-dhamma",
      question: "How many years after his consecration, the ceremony that made him king, did Aśoka visit Lumbinī, the Buddha's birthplace?",
      claim: "In the twentieth year after his consecration",
      grounding: "twentieth year after his consecration",
      answer: { kind: "number", value: 20, unit: "years" },
    },
    {
      chapter: "ch-greek",
      question: "Aśoka's Rock Edict XIII names a Greek king, Antiyoga. Whom do scholars identify him with?",
      claim: "Scholars identify these kings",
      grounding: "Antiochus II of Syria",
      answer: { kind: "choice", options: ["Alexander the Great", "Antiochus II of Syria", "Darius I of Persia", "Julius Caesar"], correct: 1 },
    },
    {
      chapter: "ch-running",
      question: "In the Arthaśāstra's story of how kingship began, what share of their grain did people allot the king?",
      claim: "The Arthaśāstra justifies kingship as a bargain",
      grounding: "one-sixth of their grain",
      answer: { kind: "choice", options: ["One-half", "One-quarter", "One-sixth", "None"], correct: 2 },
    },
    {
      chapter: "ch-roads",
      question: "Besides digging wells, what does Aśoka say he had planted along the roads?",
      claim: "Aśoka records having trees planted along roads",
      grounding: "trees planted along roads",
      answer: { kind: "choice", options: ["Trees", "Shrines", "Milestones", "Fields of grain"], correct: 0 },
    },
    {
      chapter: "ch-society",
      question: "What does Arrian, citing Megasthenes, say about slavery among Indians?",
      claim: "Arrian, citing Megasthenes, says",
      grounding: "all Indians are free",
      answer: { kind: "choice", options: ["Most Indians were slaves", "All Indians are free, and none is a slave", "Only foreigners were slaves", "Slaves served only the king"], correct: 1 },
    },
    {
      chapter: "ch-stone",
      question: "What did James Prinsep complete before he published translations of the rock edicts?",
      claim: "James Prinsep completed the decipherment",
      grounding: "completed the decipherment of the Brāhmī script",
      answer: { kind: "choice", options: ["The decipherment of the Brāhmī script", "The first map of India", "A translation of the Arthaśāstra", "The excavation of Pāṭaliputra"], correct: 0 },
    },
  ],
  checks: [
    {
      chapter: "ch-empire",
      items: [
        { kind: "recall", id: "founded", claim: "The Maurya Empire was founded by Chandragupta Maurya" },
        { kind: "place", id: "pataliputra", entity: "pataliputra", prompt: "Tap where Pāṭaliputra was.", toleranceKm: 150 },
        { kind: "recall", id: "sources", claim: "The main written sources for Mauryan times" },
      ],
    },
    {
      chapter: "ch-kalinga",
      items: [
        { kind: "recall", id: "year", claim: "Aśoka conquered Kalinga in the eighth year" },
        {
          kind: "place",
          id: "dhauli",
          entity: "dhauli",
          prompt: "Aśoka's edicts at Dhauli stand in the old land of Kalinga. Tap where Dhauli is.",
          toleranceKm: 150,
        },
        {
          kind: "recall",
          id: "remorse",
          claim: "Aśoka publicly declared his repentance",
          prompt: "What did Aśoka declare, in public, about the conquest of Kalinga?",
        },
      ],
    },
    {
      chapter: "ch-dhamma",
      items: [
        {
          kind: "order",
          id: "reign",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "Aśoka conquered Kalinga in the eighth year", label: "Aśoka conquers Kalinga" },
            { claim: "In the twentieth year after his consecration", label: "Aśoka visits Lumbinī" },
            { claim: "The Maurya Empire was founded by Chandragupta Maurya", label: "Chandragupta founds the empire" },
          ],
        },
        { kind: "place", id: "lumbini", entity: "lumbini", prompt: "Tap where Lumbinī is, the Buddha's birthplace.", toleranceKm: 100 },
        { kind: "recall", id: "zeal", claim: "By his own account, Aśoka had been a lay Buddhist" },
      ],
    },
    {
      chapter: "ch-greek",
      items: [
        { kind: "recall", id: "dating", claim: "Because these Hellenistic kings' reigns are known" },
        {
          kind: "recall",
          id: "morality",
          claim: "Aśoka claimed to have won a “conquest by morality”",
          prompt: "What kind of conquest did Aśoka claim among his neighbours, and how far did he say it reached?",
        },
        { kind: "place", id: "kalsi", entity: "kalsi-rock-edicts", prompt: "Tap where the rock edicts of Kalsi are.", toleranceKm: 150 },
      ],
    },
    {
      chapter: "ch-running",
      items: [
        {
          kind: "recall",
          id: "spies",
          claim: "The Arthaśāstra prescribes a network of spies",
          prompt: "What does the Arthaśāstra say a king's spies should disguise themselves as?",
        },
        {
          kind: "recall",
          id: "officials",
          claim: "Megasthenes describes officials who measured land",
          prompt: "What did Megasthenes say officials did with land and canal water?",
        },
      ],
    },
    {
      chapter: "ch-roads",
      items: [
        { kind: "recall", id: "trees", claim: "Aśoka records having trees planted along roads" },
        {
          kind: "recall",
          id: "milestones",
          claim: "Megasthenes reports that officials built roads",
          prompt: "What did Megasthenes say officials set up along the roads, and how often?",
        },
      ],
    },
    {
      chapter: "ch-society",
      items: [
        {
          kind: "recall",
          id: "medicine",
          claim: "Aśoka claims to have provided medical treatment",
          prompt: "What care does Aśoka claim to have provided, and for whom?",
        },
        {
          kind: "recall",
          id: "dasa",
          claim: "The Arthaśāstra has a chapter of rules on dāsas",
          prompt: "What does the Arthaśāstra's chapter on dāsas forbid, and what does it allow?",
        },
      ],
    },
    {
      chapter: "ch-stone",
      items: [
        {
          kind: "recall",
          id: "kangle",
          claim: "R. P. Kangle held that no substantial part",
          prompt: "What did R. P. Kangle hold about the parts of the surviving Arthaśāstra?",
        },
        {
          kind: "recall",
          id: "self",
          claim: "The Arthaśāstra presents itself as the work",
          prompt: "How does the Arthaśāstra present its own author and its sources?",
        },
      ],
    },
  ],
};

export const INDEPENDENCE: PageLearnSpec = {
  page: "independence-movement",
  title: "Independence movement page: guess-first questions and chapter checks",
  rationale: [
    "Adds a “Guess first” question at the start of eight chapters and a short retrieval check at the end of each, for learning (pretesting, then practice testing). Nothing new is asserted: each answer is a claim already on the page, shown with its evidence when the answer is revealed.",
    "Order questions are graded against the claims' stored day dates (13 April 1919, 26 January 1930, 8 August 1942, 15 August 1947 and the 1919–1922 sequence). Place questions use Bombay, Calcutta, Amritsar, Dandi and Lahore, whose coordinates come from Wikidata (Q1156, Q1348, Q48403, Q1026197, Q11739); Amritsar is added by its own changeset, “Places for map questions, from Wikidata”.",
    "The often-said chapter gets no new blocks: its misconceptions already carry “Did you believe this?”.",
  ],
  guesses: [
    {
      chapter: "ch-1857",
      question: "What did reports at the time say set off the first disturbances of 1857?",
      claim: "Marx, reporting in 1857",
      grounding: "greased with the fat of cattle and pigs",
      answer: {
        kind: "choice",
        options: ["A new tax on salt", "Rifle cartridges said to be greased with cattle and pig fat", "The arrest of the Mughal emperor", "A famine in Bengal"],
        correct: 1,
      },
    },
    {
      chapter: "ch-congress",
      question: "What did the first Indian National Congress, in 1885, say it wanted?",
      claim: "The first Indian National Congress met in Bombay",
      grounding: "wanted only a proper share in government",
      answer: {
        kind: "choice",
        options: ["Complete independence", "A proper share in government, under British rule", "A separate state for Muslims", "The return of Mughal rule"],
        correct: 1,
      },
    },
    {
      chapter: "ch-swaraj",
      question: "When Dadabhai Naoroji summed up the Congress's demand as Swaraj in 1906, what did he mean by it?",
      claim: "Presiding over the Congress in 1906",
      grounding: "self-government like that of the United Kingdom or the colonies",
      answer: {
        kind: "choice",
        options: ["Leaving the British Empire at once", "Self-government like that of the United Kingdom or the colonies", "Rule by the princes", "Home rule for Bengal only"],
        correct: 1,
      },
    },
    {
      chapter: "ch-amritsar",
      question: "For about how many minutes did the troops fire on the crowd at Jallianwala Bagh?",
      claim: "On 13 April 1919, at Jallianwala Bagh",
      grounding: "for about ten minutes",
      answer: { kind: "number", value: 10, unit: "minutes" },
    },
    {
      chapter: "ch-1930",
      question: "What did the 1930 pledge put India's average income at?",
      claim: "The 1930 pledge blamed British rule",
      grounding: "seven pice",
      answer: { kind: "choice", options: ["Seven pice (less than two pence) a day", "A rupee a day", "Ten shillings a week", "Nothing at all"], correct: 0 },
    },
    {
      chapter: "ch-nations",
      question: "On 23 March 1940, what did the Muslim League resolve that the Muslim-majority areas should become?",
      claim: "On 23 March 1940 the Muslim League resolved",
      grounding: "“independent states”",
      answer: { kind: "choice", options: ["Provinces of a united India", "“Independent states”", "Princely states", "Part of Afghanistan"], correct: 1 },
    },
    {
      chapter: "ch-war",
      question: "About how many people did the famine in Bengal of 1943 kill, by the estimates?",
      claim: "In 1943, during the war, a famine in Bengal",
      grounding: "800,000 to 3.8 million",
      answer: { kind: "choice", options: ["About 3,000", "800,000 to 3.8 million", "About 20 million", "Fewer than 1,000"], correct: 1 },
    },
    {
      chapter: "ch-1947",
      question: "In February 1947 the British government set itself a deadline for handing over power. What was it?",
      claim: "On 20 February 1947 the British government",
      grounding: "by June 1948 at the latest",
      answer: { kind: "choice", options: ["August 1947", "June 1948 at the latest", "January 1950", "It set no date"], correct: 1 },
    },
  ],
  checks: [
    {
      chapter: "ch-1857",
      items: [
        { kind: "recall", id: "savarkar", claim: "In 1909 V. D. Savarkar recast" },
        {
          kind: "recall",
          id: "unity",
          claim: "Writing as the revolt unfolded, Marx noted",
          prompt: "What did Marx notice about Hindu and Muslim sepoys in 1857?",
        },
      ],
    },
    {
      chapter: "ch-congress",
      items: [
        { kind: "recall", id: "drain", claim: "Dadabhai Naoroji argued that British rule drained" },
        { kind: "place", id: "bombay", entity: "bombay", prompt: "The first Congress met in Bombay. Tap where Bombay is.", toleranceKm: 120 },
        {
          kind: "recall",
          id: "demands",
          claim: "The first Congress asked for elected members",
          prompt: "What two reforms did the first Congress ask for?",
        },
      ],
    },
    {
      chapter: "ch-swaraj",
      items: [
        {
          kind: "recall",
          id: "swadeshi",
          claim: "At Calcutta in 1906 the Congress declared",
          prompt: "What did the Congress declare at Calcutta in 1906, and what did it urge?",
        },
        {
          kind: "recall",
          id: "tiger",
          claim: "In Hind Swaraj (1909) Gandhi criticised",
          prompt: "In Hind Swaraj, what did Gandhi criticise those who wanted?",
        },
        { kind: "place", id: "calcutta", entity: "calcutta", prompt: "Tap where Calcutta is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-amritsar",
      items: [
        {
          kind: "order",
          id: "1919",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "In February 1922, after a crowd at Chauri Chaura", label: "Gandhi calls off non-cooperation" },
            { claim: "On 13 April 1919, at Jallianwala Bagh", label: "The firing at Jallianwala Bagh" },
            { claim: "The disorders of 1919 began with a hartal", label: "A hartal in Delhi" },
          ],
        },
        { kind: "place", id: "amritsar", entity: "amritsar", qid: "Q48403", prompt: "The troops fired at Jallianwala Bagh, in Amritsar. Tap where Amritsar is.", toleranceKm: 120 },
        {
          kind: "recall",
          id: "chauri",
          claim: "In February 1922, after a crowd at Chauri Chaura",
          // Without the year: the order question above asks when it happened.
          prompt: "Why did Gandhi call off the non-cooperation movement?",
        },
      ],
    },
    {
      chapter: "ch-1930",
      items: [
        { kind: "place", id: "dandi", entity: "dandi", prompt: "The salt march ended at the sea, at Dandi. Tap where Dandi is.", toleranceKm: 120 },
        { kind: "recall", id: "salt", claim: "Before the Salt March, Gandhi wrote to the Viceroy" },
        { kind: "recall", id: "ambedkar", claim: "In Annihilation of Caste (1936)" },
      ],
    },
    {
      chapter: "ch-nations",
      items: [
        { kind: "recall", id: "two-nations", claim: "At Lahore in March 1940 Jinnah" },
        { kind: "recall", id: "quit-india", claim: "On 8 August 1942, during the Second World War" },
        { kind: "place", id: "lahore", entity: "lahore", prompt: "The Muslim League met at Lahore in 1940. Tap where Lahore is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-war",
      items: [
        {
          kind: "recall",
          id: "famine",
          claim: "In 1943, during the war, a famine in Bengal",
          prompt: "How many people did the Bengal famine of 1943 kill, by the estimates?",
        },
        {
          kind: "recall",
          id: "mission",
          claim: "On 19 February 1946 the British government announced",
          prompt: "What did the British government announce on 19 February 1946?",
        },
      ],
    },
    {
      chapter: "ch-1947",
      items: [
        {
          kind: "order",
          id: "road",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "On 8 August 1942, during the Second World War", label: "The Quit India resolution" },
            { claim: "The Indian Independence Act 1947", label: "India and Pakistan become dominions" },
            { claim: "On 13 April 1919, at Jallianwala Bagh", label: "The firing at Jallianwala Bagh" },
            { claim: "On 26 January 1930, Purna Swaraj Day", label: "The Purna Swaraj pledge" },
          ],
        },
        { kind: "recall", id: "toll", claim: "Partition displaced between 12 and 20 million" },
        {
          kind: "recall",
          id: "princes",
          claim: "Under the 1947 Act, the Crown's suzerainty",
          prompt: "What happened to the princely states' treaties with Britain under the 1947 Act?",
        },
      ],
    },
  ],
};


export const GUPTA: PageLearnSpec = {
  page: "gupta-empire",
  title: "Gupta Empire page: guess-first questions and chapter checks",
  rationale: [
    "Adds a “Guess first” question at the start of eight chapters and a short retrieval check at the end of each, for learning (pretesting, then practice testing). Nothing new is asserted: each answer is a claim already on the page, shown with its evidence when the answer is revealed.",
    "Year answers are the claims' own (Āryabhaṭa born in 476, Smith's “golden age” in 1904). Order questions are graded against the claims' stored dates, which come from the inscriptions' Gupta-era years. Place questions use Pāṭaliputra, the Allahabad pillar, the Udayagiri caves, Sarnath, Ujjain, Girnar and Eran, whose coordinates come from Wikidata (Q389755, Q4730345, Q4250472, Q324394, Q200119, Q1747217, Q1347967).",
    "The often-said chapter gets no new blocks: its misconceptions already carry “Did you believe this?”.",
  ],
  guesses: [
    {
      chapter: "ch-rise",
      question: "Al-Bīrūnī reported how people counted the Gupta era. From when?",
      claim: "Writing about 1030, al-Bīrūnī reported",
      grounding: "counted from the time they ceased to exist",
      answer: { kind: "choice", options: ["From the year the Guptas came to power", "From the time the Guptas ceased to exist", "From the Buddha's death", "From Alexander's invasion"], correct: 1 },
    },
    {
      chapter: "ch-samudragupta",
      question: "What do Samudragupta's gold coins of the “lyrist type” show him doing?",
      claim: "The inscription praises Samudragupta as a “king of poets”",
      grounding: "playing a stringed instrument",
      answer: { kind: "choice", options: ["Riding a horse", "Playing a stringed instrument", "Hunting a lion", "Praying at a shrine"], correct: 1 },
    },
    {
      chapter: "ch-chandragupta",
      question: "At Sanchi, a donor who lived by Chandragupta II's favour made a gift so that monks would be fed and a lamp kept burning. How many monks?",
      claim: "At the Buddhist monastery of Sanchi, a donor",
      grounding: "five monks",
      answer: { kind: "number", value: 5, unit: "monks" },
    },
    {
      chapter: "ch-faxian",
      question: "The Chinese pilgrim Faxian travelled through the Gupta lands around 400. Does he name their king?",
      claim: "Faxian never names the king",
      grounding: "never names the king",
      answer: { kind: "choice", options: ["Yes: Chandragupta II", "Yes: Samudragupta", "No: he names no king"], correct: 2 },
    },
    {
      chapter: "ch-culture",
      question: "In what year was the astronomer Āryabhaṭa born, working from what he wrote about his own age?",
      claim: "Āryabhaṭa wrote that he was 23 years old",
      grounding: "born in 476",
      answer: { kind: "year", year: 476, era: "CE", tolerance: 25 },
    },
    {
      chapter: "ch-skandagupta",
      question: "What disaster does Skandagupta's governor record on the rock at Junāgaḍh?",
      claim: "On the same boulder at Junāgaḍh as Aśoka's edicts",
      grounding: "embankment of the Sudarśana lake burst",
      answer: { kind: "choice", options: ["An earthquake", "The lake's embankment burst in heavy rain", "A great fire", "A famine"], correct: 1 },
    },
    {
      chapter: "ch-end",
      question: "About 532 CE, a king boasted on pillars that even the Hūṇa king Mihirakula had bowed at his feet. Who?",
      claim: "Yaśodharman of Daśapura boasted",
      grounding: "Yaśodharman of Daśapura",
      answer: { kind: "choice", options: ["Skandagupta", "Yaśodharman of Daśapura", "Toramāṇa", "Budhagupta"], correct: 1 },
    },
    {
      chapter: "ch-golden-age",
      question: "Which reason do some historians give for doubting that the Gupta period was a “golden age”?",
      claim: "The golden-age label is disputed",
      grounding: "towns had been more prosperous before it",
      answer: { kind: "choice", options: ["Towns had been more prosperous before, under the Kushans", "There were no kings", "Sanskrit was not yet written", "No temples were built"], correct: 0 },
    },
  ],
  checks: [
    {
      chapter: "ch-rise",
      items: [
        { kind: "recall", id: "era", claim: "The Gupta kings dated their inscriptions in their own era" },
        {
          kind: "recall",
          id: "marriage",
          claim: "Chandragupta I married Kumāradevī",
          prompt: "Whom did Chandragupta I marry, and why do historians think it mattered?",
        },
        { kind: "place", id: "pataliputra", entity: "pataliputra", prompt: "Tap where Pāṭaliputra was.", toleranceKm: 150 },
      ],
    },
    {
      chapter: "ch-samudragupta",
      items: [
        { kind: "recall", id: "lyrist", claim: "The inscription praises Samudragupta as a “king of poets”" },
        { kind: "recall", id: "north", claim: "In the north (Āryāvarta), the inscription says" },
        { kind: "place", id: "pillar", entity: "allahabad-pillar", prompt: "Tap where the Allahabad pillar stands.", toleranceKm: 100 },
      ],
    },
    {
      chapter: "ch-chandragupta",
      items: [
        {
          kind: "order",
          id: "years",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "At the Buddhist monastery of Sanchi, a donor", label: "A donor's gift to the monks at Sanchi" },
            { claim: "The Gupta kings dated their inscriptions in their own era", label: "The Gupta era begins" },
            { claim: "At Udayagiri near Vidiśā, a cave inscription", label: "A local king's gift at Udayagiri" },
          ],
        },
        { kind: "recall", id: "iron-pillar", claim: "The iron pillar's inscription is not dated" },
        { kind: "place", id: "udayagiri", entity: "udayagiri-caves", prompt: "Tap where the Udayagiri caves are.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-faxian",
      items: [
        { kind: "recall", id: "punishment", claim: "Faxian wrote that the king governed without beheadings" },
        { kind: "recall", id: "medicine", claim: "In the cities of Magadha, Faxian wrote" },
        { kind: "place", id: "sarnath", entity: "sarnath", prompt: "Faxian visited the Deer Park at Sarnath. Tap where Sarnath is.", toleranceKm: 100 },
      ],
    },
    {
      chapter: "ch-culture",
      items: [
        { kind: "recall", id: "weavers", claim: "At Daśapura (Mandsaur), a guild of silk weavers" },
        { kind: "recall", id: "zero", claim: "Āryabhaṭa used a place-value system" },
        { kind: "place", id: "ujjain", entity: "ujjain", prompt: "Kālidāsa praised Ujjain as a “gem” of the Avanti country. Tap where Ujjain is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-skandagupta",
      items: [
        { kind: "recall", id: "lake", claim: "On the same boulder at Junāgaḍh as Aśoka's edicts" },
        {
          kind: "recall",
          id: "ground",
          claim: "Skandagupta's pillar at Bhitari says that",
          prompt: "What does the Bhitari pillar say Skandagupta did to restore his family's fortunes, and whom did he defeat?",
        },
        { kind: "place", id: "girnar", entity: "girnar", prompt: "Skandagupta's governor wrote on the same rock as Aśoka, at Girnar. Tap where Girnar is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-end",
      items: [
        {
          kind: "order",
          id: "end",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "A memorial at Eran of Gupta year 191", label: "Goparāja's memorial at Eran" },
            { claim: "The last recognised king of the main Gupta line", label: "The last known Gupta inscription" },
            { claim: "A pillar at Eran dated 484–485 CE", label: "Budhagupta named on a pillar at Eran" },
            { claim: "Yaśodharman of Daśapura boasted", label: "Yaśodharman's boast at Mandsaur" },
          ],
        },
        { kind: "recall", id: "boar", claim: "A few years later, “in the first year” of the Hūṇa king" },
        { kind: "place", id: "eran", entity: "eran", prompt: "Tap where Eran is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-golden-age",
      items: [
        { kind: "recall", id: "doubts", claim: "The golden-age label is disputed" },
        {
          kind: "recall",
          id: "napoleon",
          claim: "Smith also called Samudragupta",
          prompt: "What did Vincent Smith call Samudragupta in 1904?",
        },
      ],
    },
  ],
};

export const INDUS: PageLearnSpec = {
  page: "indus-civilisation",
  title: "Indus civilisation page: guess-first questions and chapter checks",
  rationale: [
    "Adds a “Guess first” question at the start of eight chapters and a short retrieval check at the end of each, for learning (pretesting, then practice testing). Nothing new is asserted: each answer is a claim already on the page, shown with its evidence when the answer is revealed.",
    "Counts are the claims' own words (more than a thousand sites, more than 3,800 inscriptions); choices that are not the answer assert nothing. Order questions are graded against the claims' stored dates (Masson 1826, Cunningham 1875, the excavations of 1920–22, Marshall 1924; Oldham 1893, Wheeler 1947, Dales 1964, Giosan 2012). Place questions use Mohenjo-daro, Lothal, Dholavira and Rakhigarhi, whose single points come from Wikidata (Q5725, Q9443, Q9468, Q3418050).",
    "The often-said chapter gets no new blocks: its misconceptions already carry “Did you believe this?”.",
  ],
  guesses: [
    {
      chapter: "ch-found",
      question: "What did the traveller Charles Masson take the mounds of Harappa to be?",
      claim: "Masson took the mounds of Harappa for Sangala",
      grounding: "a town besieged by Alexander the Great",
      answer: { kind: "choice", options: ["A Buddhist monastery", "A town besieged by Alexander the Great", "A Mughal fort", "A natural hill"], correct: 1 },
    },
    {
      chapter: "ch-cities",
      question: "How many sites of the Mature Harappan phase, when the big cities flourished, are known?",
      claim: "More than a thousand Mature Harappan sites are known",
      grounding: "More than a thousand",
      answer: { kind: "choice", options: ["About 50", "About 200", "More than a thousand", "More than 50,000"], correct: 2 },
    },
    {
      chapter: "ch-script",
      question: "How many Indus inscriptions are known, on seals, tablets and pottery?",
      claim: "More than 3,800 Indus inscriptions are known",
      grounding: "More than 3,800",
      answer: { kind: "choice", options: ["About 40", "About 400", "More than 3,800", "More than 100,000"], correct: 2 },
    },
    {
      chapter: "ch-trade",
      question: "Why did Indus objects found at Akkadian sites, in Mesopotamia, matter so much to Mortimer Wheeler?",
      claim: "Wheeler stressed in 1947",
      grounding: "gave the only firm dates",
      answer: { kind: "choice", options: ["They gave the only firm dates for the civilisation", "They proved an invasion", "They named the Indus kings", "They were made of gold"], correct: 0 },
    },
    {
      chapter: "ch-life",
      question: "Which animal did John Marshall notice was missing from the Indus seals?",
      claim: "In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall noted that the horse",
      grounding: "the horse did not appear on the seals",
      answer: { kind: "choice", options: ["The bull", "The elephant", "The horse", "The tiger"], correct: 2 },
    },
    {
      chapter: "ch-religion",
      question: "A tablet of faience, a glazed material made from crushed quartz, shows a seated figure with kneeling worshippers and snakes. What did its first describer judge the figure to be?",
      claim: "In his note in the Archaeological Survey's report for 1924–25 (printed in 1927), Marshall described a faience tablet",
      grounding: "more likely a god than a king",
      answer: { kind: "choice", options: ["A king", "More likely a god than a king", "A merchant", "A dancer"], correct: 1 },
    },
    {
      chapter: "ch-end",
      question: "Re-examining the “massacre” at Mohenjo-daro in 1964, about how many skeletons of the Indus period did George Dales count, from nine years of digging?",
      claim: "Re-examining the “massacre” in 1964",
      grounding: "about 37 skeletons",
      answer: { kind: "number", value: 37, unit: "skeletons" },
    },
    {
      chapter: "ch-after",
      question: "As the Indus cities emptied, which of these disappeared?",
      claim: "As the cities emptied, writing, seals",
      grounding: "writing, seals",
      answer: { kind: "choice", options: ["Small farming settlements", "Writing and seals", "Farming itself", "All settlement in the north-west"], correct: 1 },
    },
  ],
  checks: [
    {
      chapter: "ch-found",
      items: [
        {
          kind: "order",
          id: "found",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "In 1875 Cunningham published a seal from Harappa", label: "Cunningham publishes a strange seal" },
            { claim: "Marshall announced the discovery in the Illustrated London News", label: "Marshall announces a lost civilisation" },
            { claim: "The traveller Charles Masson visited Harappa", label: "Masson visits the mounds of Harappa" },
            { claim: "Excavation began at Harappa under Daya Ram Sahni", label: "Digging begins at Harappa and Mohenjo-daro" },
          ],
        },
        { kind: "recall", id: "diggers", claim: "Excavation began at Harappa under Daya Ram Sahni" },
        { kind: "place", id: "mohenjo-daro", entity: "mohenjo-daro", prompt: "Tap where Mohenjo-daro is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-cities",
      items: [
        { kind: "recall", id: "plan", claim: "At Mohenjo-daro the buildings of the lower city" },
        {
          kind: "recall",
          id: "dholavira",
          claim: "Dholavira, on the arid island of Khadir",
          prompt: "What was Dholavira built of, and how did its people deal with scarce water?",
        },
        { kind: "place", id: "lothal", entity: "lothal", prompt: "Tap where Lothal is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-script",
      items: [
        { kind: "recall", id: "undeciphered", claim: "The Indus script has not been deciphered" },
        { kind: "recall", id: "why-hard", claim: "Three things make decipherment so hard" },
      ],
    },
    {
      chapter: "ch-trade",
      items: [
        { kind: "recall", id: "sargon", claim: "Sargon of Akkad (reigned c. 2334–2279 BCE)" },
        {
          kind: "recall",
          id: "magan",
          claim: "Magan, named with Meluhha",
          prompt: "Where are Magan and Dilmun, named with Meluhha, placed today?",
        },
        { kind: "place", id: "dholavira", entity: "dholavira", prompt: "Finds at Dholavira show trade with Mesopotamia. Tap where Dholavira is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-life",
      items: [
        {
          kind: "recall",
          id: "no-palaces",
          claim: "No palaces, rich royal tombs",
          prompt: "What have archaeologists not found in the Indus cities that a kingdom would usually leave?",
        },
        {
          kind: "recall",
          id: "crafts",
          claim: "Marshall found that the people of Mohenjo-daro worked copper",
          prompt: "Which metals and crafts did Marshall find at Mohenjo-daro?",
        },
      ],
    },
    {
      chapter: "ch-religion",
      items: [
        { kind: "recall", id: "pashupati", claim: "Marshall identified the horned figure" },
        {
          kind: "recall",
          id: "disputed",
          claim: "Later scholars have disputed Marshall's reading",
          prompt: "How have later scholars read the “Pashupati” figure differently from Marshall?",
        },
      ],
    },
    {
      chapter: "ch-end",
      items: [
        {
          kind: "order",
          id: "explanations",
          prompt: "Put these explanations in the order they were put forward, earliest first.",
          items: [
            { claim: "Re-examining the “massacre” in 1964", label: "Dales counts the skeletons" },
            { claim: "In 1893, before the Indus civilisation was known", label: "Oldham links the Hakra to the Sarasvatī" },
            { claim: "Giosan and colleagues (2012) argue", label: "A weakening monsoon dried the rivers" },
            { claim: "In 1947 Mortimer Wheeler argued", label: "Wheeler blames Aryan invaders" },
          ],
        },
        { kind: "recall", id: "no-layer", claim: "There is no destruction layer" },
      ],
    },
    {
      chapter: "ch-after",
      items: [
        { kind: "recall", id: "lost", claim: "As the cities emptied, writing, seals" },
        { kind: "place", id: "rakhigarhi", entity: "rakhigarhi", prompt: "Tap where Rakhigarhi is.", toleranceKm: 120 },
      ],
    },
  ],
};

export const MAHAJANAPADAS: PageLearnSpec = {
  page: "mahajanapadas",
  title: "Mahājanapadas page: guess-first questions and chapter checks",
  rationale: [
    "Adds a “Guess first” question at the start of nine chapters and a short retrieval check at the end of each, for learning (pretesting, then practice testing). Nothing new is asserted: each answer is a claim already on the page, shown with its evidence when the answer is revealed.",
    "Number answers are the claims' own words (eighty years, seventy-two, 218 years). The one order question uses the claims' stored dates (Cyrus c. 535, Behistun by 518, Xerxes 480, Gaugamela 331 BCE). Place questions use Rājagaha, Vesālī, Sāvatthi, Pāṭaliputra, Benares, Taxila and Lumbinī, whose points come from Wikidata (Q863683, Q1509463, Q2594448, Q389755, Q79980, Q156093, Q9213); Kapilavatthu is left out because which excavated site it is remains debated.",
    "The often-said chapter gets no new blocks: its misconceptions already carry “Did you believe this?”.",
  ],
  guesses: [
    {
      chapter: "ch-sixteen",
      question: "Rhys Davids noticed something about the names in the list of sixteen great countries. What?",
      claim: "Rhys Davids noticed that the sixteen are names",
      grounding: "names of peoples, not of countries",
      answer: { kind: "choice", options: ["They are names of peoples, not of countries", "They are all names of rivers", "They are Persian words", "They were invented later"], correct: 0 },
    },
    {
      chapter: "ch-republics",
      question: "How did the Sakyas, the Buddha's own clan, do their business?",
      claim: "The Sakya clan, the Buddha's own",
      grounding: "public assembly of young and old",
      answer: { kind: "choice", options: ["Their king decided alone", "In a public assembly of young and old", "Through priests at a temple", "Through a Persian governor"], correct: 1 },
    },
    {
      chapter: "ch-cities",
      question: "When the Buddha lay dying at Kusinārā, how did Ānanda describe the place?",
      claim: "When the Buddha lay dying, Ānanda begged him",
      grounding: "little wattel and daub town",
      answer: { kind: "choice", options: ["A great capital", "A little wattle-and-daub town", "A port on the sea", "A walled fortress"], correct: 1 },
    },
    {
      chapter: "ch-magadha",
      question: "According to Buddhist tradition, how did Ajātasattu become king of Magadha?",
      claim: "Buddhist tradition says Ajātasattu killed his father",
      grounding: "killed his father Bimbisāra",
      answer: { kind: "choice", options: ["An assembly elected him", "He killed his father, Bimbisāra", "He married the king's daughter", "Persia put him on the throne"], correct: 1 },
    },
    {
      chapter: "ch-buddha",
      question: "Near the end of his life, how old does the Buddha say he is?",
      claim: "Near the end the Buddha says he is",
      grounding: "turning eighty years of age",
      answer: { kind: "number", value: 80, unit: "years" },
    },
    {
      chapter: "ch-teachers",
      question: "How old was Mahāvīra when he died, according to the Kalpa Sūtra?",
      claim: "The Kalpa Sūtra says Mahāvīra lived thirty years",
      grounding: "aged seventy-two",
      answer: { kind: "number", value: 72, unit: "years" },
    },
    {
      chapter: "ch-persia",
      question: "According to Herodotus, which people paid Persia the largest tribute of all?",
      claim: "According to Herodotus the Indians paid Persia",
      grounding: "the Indians paid Persia the largest tribute",
      answer: { kind: "choice", options: ["The Greeks", "The Indians", "The Egyptians", "The Babylonians"], correct: 1 },
    },
    {
      chapter: "ch-nandas",
      question: "At which river did Alexander's army refuse to go further east?",
      claim: "At the Hyphasis (Beas) Alexander's army refused",
      grounding: "At the Hyphasis (Beas)",
      answer: { kind: "choice", options: ["The Indus", "The Hydaspes (Jhelum)", "The Hyphasis (Beas)", "The Ganges"], correct: 2 },
    },
    {
      chapter: "ch-dating",
      question: "How many years do the Sri Lankan chronicles count from the Buddha's death to Aśoka's consecration, the ceremony that made him king?",
      claim: "The Sri Lankan chronicles count 218 years",
      grounding: "218 years",
      answer: { kind: "number", value: 218, unit: "years" },
    },
  ],
  checks: [
    {
      chapter: "ch-sixteen",
      items: [
        { kind: "recall", id: "list", claim: "Early Buddhist texts keep a stock list" },
        { kind: "recall", id: "four", claim: "The four kingdoms were Magadha" },
        { kind: "place", id: "rajagaha", entity: "rajagaha", prompt: "Magadha's capital was Rājagaha. Tap where it was.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-republics",
      items: [
        { kind: "recall", id: "vajjians", claim: "In the Mahāparinibbāna Sutta the Buddha says the Vajjians" },
        {
          kind: "recall",
          id: "licchavis",
          claim: "Most of these clan states were aristocratic",
          prompt: "What do the texts say about the ruling body of the Licchavis, and who belonged to it?",
        },
        { kind: "place", id: "vesali", entity: "vesali", prompt: "Tap where Vesālī was.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-cities",
      items: [
        { kind: "recall", id: "great-cities", claim: "When the Buddha lay dying, Ānanda begged him" },
        {
          kind: "recall",
          id: "vesali-only",
          claim: "Vesālī, Rhys Davids noted, was the only great city",
          prompt: "What did Rhys Davids note about Vesālī among the territories of the free clans?",
        },
        { kind: "place", id: "savatthi", entity: "savatthi", prompt: "Sāvatthi was the capital of Kosala. Tap where it was.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-magadha",
      items: [
        { kind: "recall", id: "confession", claim: "Buddhist tradition says Ajātasattu killed his father" },
        {
          kind: "recall",
          id: "kusumapura",
          claim: "The Purāṇas say Udayin, who came after Ajātasattu",
          prompt: "Which city did Udayin make his capital, according to the Purāṇas, and what was it later called?",
        },
        { kind: "place", id: "pataliputra", entity: "pataliputra", prompt: "Tap where Pāṭaliputra was.", toleranceKm: 150 },
      ],
    },
    {
      chapter: "ch-buddha",
      items: [
        { kind: "recall", id: "sermon", claim: "The Buddha's first sermon, given to five monks" },
        {
          kind: "recall",
          id: "four-places",
          claim: "The Mahāparinibbāna Sutta names four places",
          prompt: "Which four places does the Mahāparinibbāna Sutta tell a believer to visit?",
        },
        { kind: "place", id: "benares", entity: "varanasi", prompt: "The first sermon was given in the Deer Park at Benares. Tap where Benares is.", toleranceKm: 100 },
      ],
    },
    {
      chapter: "ch-teachers",
      items: [
        {
          kind: "recall",
          id: "non-harm",
          claim: "The Ācārāṅga Sūtra teaches",
          prompt: "What does the Ācārāṅga Sūtra teach about living creatures?",
        },
        {
          kind: "recall",
          id: "tirthankara",
          claim: "For Jains, Mahāvīra is the twenty-fourth",
          prompt: "What is Mahāvīra's place in the Jain tradition?",
        },
      ],
    },
    {
      chapter: "ch-persia",
      items: [
        {
          kind: "order",
          id: "persia",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "Indian soldiers marched with Xerxes", label: "Indian soldiers march with Xerxes" },
            { claim: "Around 535 BCE the Persian king Cyrus", label: "Cyrus campaigns towards the Indus" },
            { claim: "Indians still fought for Persia in 331 BCE", label: "Indians fight for Persia at Gaugamela" },
            { claim: "Darius I's inscription at Behistun", label: "Darius lists Gandhāra at Behistun" },
          ],
        },
        { kind: "recall", id: "tribute", claim: "According to Herodotus the Indians paid Persia" },
      ],
    },
    {
      chapter: "ch-nandas",
      items: [
        { kind: "recall", id: "mahapadma", claim: "The Purāṇas say Mahāpadma Nanda" },
        {
          kind: "recall",
          id: "androkottos",
          claim: "Plutarch says the young Androkottos",
          prompt: "What did Plutarch say the young Chandragupta Maurya later said about Alexander and the king of the Ganges plain?",
        },
        { kind: "place", id: "taxila", entity: "taxila", prompt: "Alexander reached Taxila in 326 BCE. Tap where Taxila is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-dating",
      items: [
        { kind: "recall", id: "geiger", claim: "Wilhelm Geiger (1912) combined the chronicles'" },
        {
          kind: "recall",
          id: "lumbini-dig",
          claim: "Excavations at Lumbini found a small wooden structure",
          prompt: "What did excavations at Lumbini find, and what does the find date?",
        },
        { kind: "place", id: "lumbini", entity: "lumbini", prompt: "Tap where Lumbinī is.", toleranceKm: 100 },
      ],
    },
  ],
};

export const VEDIC: PageLearnSpec = {
  page: "vedic-period",
  title: "Vedic period page: guess-first questions and chapter checks",
  rationale: [
    "Adds a “Guess first” question at the start of nine chapters and a short retrieval check at the end of each, for learning (pretesting, then practice testing). Nothing new is asserted: each answer is a claim already on the page, shown with its evidence when the answer is revealed. The parts' one-minute summaries keep the answer hidden until the guess is made or skipped.",
    "Number and year answers are the claims' own (1,028 hymns, one hymn naming the four varṇas, 1786). The one order question uses the claims' stored dates (Max Müller 1890, Macdonell 1900, Jacobi 1909). The one place question uses Kurukshetra, whose point comes from Wikidata (Q593256).",
    "The often-said chapter gets no new blocks: its misconceptions already carry “Did you believe this?”.",
  ],
  guesses: [
    {
      chapter: "ch-text",
      question: "How were the Vedic hymns kept for centuries before they were written down?",
      claim: "The Vedic hymns were composed and handed down by mouth",
      grounding: "handed down by mouth",
      answer: { kind: "choice", options: ["Carved in stone", "Written on palm leaves", "Handed down by mouth, memorised with great precision", "Painted on pottery"], correct: 2 },
    },
    {
      chapter: "ch-dating",
      question: "To about when is the bulk of the Ṛgveda usually dated?",
      claim: "The bulk of the Ṛgveda is usually dated",
      grounding: "about 1500–1000 BCE",
      answer: { kind: "choice", options: ["About 3000–2500 BCE", "About 1500–1000 BCE", "About 600–300 BCE", "About 100 CE"], correct: 1 },
    },
    {
      chapter: "ch-hymns",
      question: "Which god do the hymns praise for slaying the serpent Vṛtra and freeing the rivers?",
      claim: "Indra is the great warrior god of the hymns",
      grounding: "he slays the serpent Vṛtra",
      answer: { kind: "choice", options: ["Agni", "Indra", "Varuṇa", "Soma"], correct: 1 },
    },
    {
      chapter: "ch-languages",
      question: "In 1786 William Jones told the Asiatick Society that Sanskrit, Greek and Latin had something. What?",
      claim: "In 1786 William Jones told the Asiatick Society",
      grounding: "sprung from a common source",
      answer: { kind: "choice", options: ["A common source", "Nothing in common", "The same alphabet", "The same gods"], correct: 0 },
    },
    {
      chapter: "ch-politics",
      question: "In 1888 Max Müller insisted that the word “Aryan” named what?",
      claim: "Max Müller insisted in 1888",
      grounding: "not a race",
      answer: { kind: "choice", options: ["A race", "Those who speak an Aryan language, not a race", "A religion", "A homeland"], correct: 1 },
    },
    {
      chapter: "ch-brahmanas",
      question: "The Śatapatha Brāhmaṇa forbids eating the flesh of cow or ox. What does it then record Yājñavalkya saying?",
      claim: "The Śatapatha Brāhmaṇa (3.1.2.21) forbids",
      grounding: "I, for one, eat it",
      answer: { kind: "choice", options: ["That no one should ever eat it", "“I, for one, eat it, provided that it is tender”", "That only kings may eat it", "Nothing: he stays silent"], correct: 1 },
    },
    {
      chapter: "ch-upanishads",
      question: "What refrain does the Chāndogya Upaniṣad say to the student Śvetaketu?",
      claim: "The Chāndogya Upaniṣad teaches that the self",
      grounding: "That art thou",
      answer: { kind: "choice", options: ["“Know thyself”", "“That art thou”", "“All is suffering”", "“Do no harm”"], correct: 1 },
    },
    {
      chapter: "ch-varna",
      question: "In the Puruṣa Sūkta, which order of society “was his mouth”, the primeval Man's?",
      claim: "One hymn of the Ṛgveda, the Puruṣa Sūkta",
      grounding: "the brāhmaṇa “was his mouth”",
      answer: { kind: "choice", options: ["The brāhmaṇa", "The rājanya", "The vaiśya", "The śūdra"], correct: 0 },
    },
    {
      chapter: "ch-iron",
      question: "Painted Grey Ware sites reappear along the middle Ghaggar-Hakra in the Iron Age. Why, perhaps?",
      claim: "Painted Grey Ware sites reappear along",
      grounding: "seasonal river flow revived",
      answer: { kind: "choice", options: ["Seasonal river flow may have revived", "A new capital was built there", "Trade with Rome began", "The sea rose"], correct: 0 },
    },
  ],
  checks: [
    {
      chapter: "ch-text",
      items: [
        { kind: "recall", id: "oral", claim: "The Vedic hymns were composed and handed down by mouth" },
        {
          kind: "recall",
          id: "tenth",
          claim: "The tenth book of the Ṛgveda is later",
          prompt: "What do scholars say about the tenth book of the Ṛgveda?",
        },
      ],
    },
    {
      chapter: "ch-dating",
      items: [
        {
          kind: "order",
          id: "datings",
          prompt: "Put these in the order they were said, earliest first.",
          items: [
            { claim: "Hermann Jacobi argued from astronomical references", label: "Jacobi argues from astronomy" },
            { claim: "In 1890 Max Müller reported general agreement", label: "Max Müller reports the scholars' consensus" },
            { claim: "Macdonell (1900) placed the hymns", label: "Macdonell argues from Vedic and Iranian" },
          ],
        },
        { kind: "recall", id: "no-power", claim: "Max Müller also admitted that no starting date" },
        {
          kind: "recall",
          id: "end",
          claim: "The end of the Vedic period is fixed from outside",
          prompt: "How is the end of the Vedic period fixed?",
        },
      ],
    },
    {
      chapter: "ch-hymns",
      items: [
        {
          kind: "recall",
          id: "indra",
          claim: "Indra is the great warrior god of the hymns",
          prompt: "What deeds do the hymns credit to Indra?",
        },
        { kind: "recall", id: "sarasvati", claim: "The Rigveda praises the river Sarasvatī" },
      ],
    },
    {
      chapter: "ch-languages",
      items: [
        { kind: "recall", id: "rakhigarhi", claim: "An ancient genome from Rakhigarhi" },
        {
          kind: "recall",
          id: "steppe",
          claim: "Most steppe ancestry in South Asia came through men",
          prompt: "Through whom did most steppe ancestry reach South Asia, and which groups tend to have more of it?",
        },
        {
          kind: "recall",
          id: "agree",
          claim: "Scholars on both sides now agree",
          prompt: "What do scholars on both sides now agree about, and what is still argued?",
        },
      ],
    },
    {
      chapter: "ch-politics",
      items: [
        { kind: "recall", id: "dasyus", claim: "In his note in the Archaeological Survey's report" },
        {
          kind: "recall",
          id: "ambedkar",
          claim: "In 1946 B. R. Ambedkar rejected",
          prompt: "What did B. R. Ambedkar say in 1946 about the “theory of invasion”?",
        },
        {
          kind: "recall",
          id: "tilak",
          claim: "The nationalist leader B. G. Tilak argued",
          prompt: "Where did B. G. Tilak argue the ancestors of the Vedic seers had lived?",
        },
      ],
    },
    {
      chapter: "ch-brahmanas",
      items: [
        {
          kind: "recall",
          id: "weber",
          claim: "Albrecht Weber, followed by the translator Eggeling",
          prompt: "How did Albrecht Weber and Eggeling read the legend of the sacred fire?",
        },
        { kind: "recall", id: "yajnavalkya", claim: "The Śatapatha Brāhmaṇa (3.1.2.21) forbids" },
      ],
    },
    {
      chapter: "ch-upanishads",
      items: [
        {
          kind: "recall",
          id: "karma",
          claim: "The Bṛhadāraṇyaka Upaniṣad states the idea of karma",
          prompt: "How does the Bṛhadāraṇyaka Upaniṣad state the idea of karma?",
        },
        {
          kind: "recall",
          id: "rebirth",
          claim: "By the time of the Chāndogya Upaniṣad, birth into a varṇa",
          prompt: "What did the Chāndogya Upaniṣad teach about birth into a varṇa?",
        },
      ],
    },
    {
      chapter: "ch-varna",
      items: [
        { kind: "recall", id: "purusha", claim: "One hymn of the Ṛgveda, the Puruṣa Sūkta" },
        {
          kind: "recall",
          id: "macdonell",
          claim: "Macdonell held that in the older hymns",
          prompt: "What did Macdonell hold about the priesthood in the older hymns, and when the four castes took shape?",
        },
      ],
    },
    {
      chapter: "ch-iron",
      items: [
        {
          kind: "recall",
          id: "pgw",
          claim: "Painted Grey Ware, an Iron Age culture",
          prompt: "What is Painted Grey Ware, and how is it usually dated?",
        },
        {
          kind: "recall",
          id: "kuru",
          claim: "The Kuru realm of the later Vedic period",
          prompt: "How is the Kuru realm of the later Vedic period often described?",
        },
        { kind: "place", id: "kurukshetra", entity: "kurukshetra", prompt: "Tap where Kurukshetra is.", toleranceKm: 120 },
      ],
    },
  ],
};

export const EARLY_MEDIEVAL: PageLearnSpec = {
  page: "early-medieval-kingdoms",
  title: "Early medieval kingdoms page: guess-first questions and chapter checks",
  rationale: [
    "Adds a “Guess first” question at the start of nine chapters and a short retrieval check at the end of each, for learning (pretesting, then practice testing). Nothing new is asserted: each answer is a claim already on the page, shown with its evidence when the answer is revealed. Guesses avoid what a chapter's title or date already says.",
    "Number and year answers are the claims' own (816, about 200 feet, about 1070, seventeen raids, 1148–49). The one order question uses the claims' stored dates (Aihole 634–635, Vātāpi taken about 642, Dantidurga 753). Place questions use Kannauj, Badami, the Bṛhadīśvara temple, Gangaikonda Cholapuram, Uttaramerūr and Somnāth, whose points come from Wikidata (Q614890, Q590751, Q916943, Q1493439, Q264443, Q1143887).",
    "The often-said chapter gets no new blocks: its misconceptions already carry “Did you believe this?”.",
  ],
  guesses: [
    {
      chapter: "ch-harsha",
      question: "Where was the battle between Harṣa and the Chalukya king fought, the river that then became their border?",
      claim: "The battle was fought on the Narmadā",
      grounding: "fought on the Narmadā",
      answer: { kind: "choice", options: ["On the Ganges", "On the Narmadā", "On the Kaveri", "On the Indus"], correct: 1 },
    },
    {
      chapter: "ch-deccan",
      question: "The Aihole poem says the Chalukya king besieged Purī on the western sea. With what?",
      claim: "The Aihole poem says Pulakeśin besieged Purī",
      grounding: "with hundreds of ships",
      answer: { kind: "choice", options: ["With hundreds of ships", "With war elephants alone", "With a Greek army", "With siege towers"], correct: 0 },
    },
    {
      chapter: "ch-kannauj",
      question: "Pāla grants say Dharmapāla installed a king of Kanyākubja. With whose approval?",
      claim: "Pāla grants say Gopāla's son Dharmapāla",
      grounding: "with the ready approval",
      answer: { kind: "choice", options: ["The kings of the north and west", "The Caliph in Baghdad", "The Chola king", "The Buddhist monks of Nālandā"], correct: 0 },
    },
    {
      chapter: "ch-thanjavur",
      question: "How many women, evidently dancers, do the Thanjavur temple's records show transferred to it from other temples?",
      claim: "The temple's records show 400 women",
      grounding: "400 women",
      answer: { kind: "number", value: 400, unit: "women" },
    },
    {
      chapter: "ch-sea",
      question: "From about when did the Cholas begin to lose almost all their overseas territories?",
      claim: "The expedition did not bring lasting Chola rule",
      grounding: "from about 1070",
      answer: { kind: "year", year: 1070, era: "CE", tolerance: 30 },
    },
    {
      chapter: "ch-villages",
      question: "By a royal order of 919, how were the committees of Uttaramerūr's assembly chosen?",
      claim: "Two inscriptions of Parāntaka I's twelfth and fourteenth years",
      grounding: "pot-tickets",
      answer: {
        kind: "choice",
        options: ["By a vote of every villager", "By drawing tickets from a pot", "By the king's officers", "By inheritance"],
        correct: 1,
      },
    },
    {
      chapter: "ch-feudal",
      question: "Weakened by its dependence on its sāmantas, the Pāla kingdom was replaced in the twelfth century. By whom?",
      claim: "The Pāla kingdom was weakened by its heavy dependence",
      grounding: "the Senas replaced it",
      answer: { kind: "choice", options: ["The Senas", "The Cholas", "The Guptas", "The Rāṣṭrakūṭas"], correct: 0 },
    },
    {
      chapter: "ch-mahmud",
      question: "How many times, by tradition, did Mahmud of Ghazni raid India?",
      claim: "Mahmud of Ghazni raided India again and again",
      grounding: "seventeen times",
      answer: { kind: "number", value: 17, unit: "times" },
    },
    {
      chapter: "ch-sources",
      question: "How many works of former scholars does Kalhaṇa say he read for his history of Kashmir?",
      claim: "Kalhaṇa, writing his Rājataraṅgiṇī in 1148–49",
      grounding: "eleven works",
      answer: { kind: "number", value: 11, unit: "works" },
    },
  ],
  checks: [
    {
      chapter: "ch-harsha",
      items: [
        { kind: "recall", id: "reign", claim: "Harṣa ruled from 606 to 647" },
        {
          kind: "recall",
          id: "army",
          claim: "Xuanzang, Harṣa's guest, wrote",
          prompt: "What did Xuanzang say about Harṣa's campaigns and his army?",
        },
        { kind: "place", id: "kannauj", entity: "kannauj", prompt: "Harṣa made Kannauj his capital. Tap where Kannauj is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-deccan",
      items: [
        {
          kind: "order",
          id: "deccan",
          prompt: "Put these in order, earliest first.",
          items: [
            { claim: "In 753 the Rāṣṭrakūṭa Dantidurga", label: "Dantidurga defeats the Chalukyas" },
            { claim: "Pulakeśin II's Aihole inscription", label: "Pulakeśin's poet boasts of beating Harṣa" },
            { claim: "The Pallava king Narasiṃhavarman I took", label: "The Pallavas take Vātāpi" },
          ],
        },
        {
          kind: "recall",
          id: "mamalla",
          claim: "Narasiṃhavarman I's title Mamalla",
          prompt: "Where does the name Mamallapuram come from?",
        },
        { kind: "place", id: "badami", entity: "badami", prompt: "The Chalukyas ruled from Vātāpi, today Badami. Tap where Badami is.", toleranceKm: 120 },
      ],
    },
    {
      chapter: "ch-kannauj",
      items: [
        {
          kind: "recall",
          id: "gopala",
          claim: "The Pāla dynasty of Bengal began when",
          prompt: "How did the Pāla dynasty begin, as a Pāla grant puts it?",
        },
        {
          kind: "recall",
          id: "amoghavarsha",
          claim: "The Rāṣṭrakūṭa Amoghavarṣa I (814–878)",
          prompt: "Where did Amoghavarṣa I rule from, and what work is linked to him?",
        },
      ],
    },
    {
      chapter: "ch-thanjavur",
      items: [
        { kind: "recall", id: "temple", claim: "Rājarāja built the great temple at Thanjavur" },
        {
          kind: "recall",
          id: "kundavai",
          claim: "Rājarāja's elder sister Kundavai",
          prompt: "What did Rājarāja's elder sister Kundavai give, and what does she seem to have founded?",
        },
        { kind: "place", id: "temple-place", entity: "brihadisvara-temple", prompt: "Tap where the great temple at Thanjavur is.", toleranceKm: 100 },
      ],
    },
    {
      chapter: "ch-sea",
      items: [
        { kind: "recall", id: "ganges", claim: "Rājendra's armies went north to the Ganges" },
        { kind: "recall", id: "kadaram", claim: "Rājendra's inscriptions say he “despatched many ships" },
        {
          kind: "place",
          id: "capital",
          entity: "gangaikonda-cholapuram",
          prompt: "Rājendra's new capital was Gangaikonda Cholapuram. Tap where it is.",
          toleranceKm: 100,
        },
      ],
    },
    {
      chapter: "ch-villages",
      items: [
        {
          kind: "recall",
          id: "qualified",
          claim: "To be named on a ticket, a man had to own",
          prompt: "What did a man need, to be named on a ticket at Uttaramerūr?",
        },
        {
          kind: "recall",
          id: "assemblies",
          claim: "Uttaramerūr had two assemblies",
          prompt: "What were Uttaramerūr's two assemblies, and who could belong to each?",
        },
        { kind: "place", id: "uttaramerur", entity: "uttaramerur", prompt: "Tap where Uttaramerūr is.", toleranceKm: 100 },
      ],
    },
    {
      chapter: "ch-feudal",
      items: [
        {
          kind: "recall",
          id: "samanta",
          claim: "The word sāmanta, once “neighbour”",
          prompt: "What did the word sāmanta come to mean by the end of the Gupta period?",
        },
        {
          kind: "recall",
          id: "european",
          claim: "Calling India feudal applies a European idea",
          prompt: "What European idea does calling India feudal apply?",
        },
      ],
    },
    {
      chapter: "ch-mahmud",
      items: [
        { kind: "recall", id: "somnath", claim: "Alberuni, who at times travelled with Mahmud's troops" },
        {
          kind: "recall",
          id: "thapar",
          claim: "Thapar points out that the temple seems to have been repaired",
          prompt: "What does Romila Thapar point out about the temple at Somnāth after the raid, and about the “50,000 killed”?",
        },
        { kind: "place", id: "somnath-place", entity: "somnath-temple", prompt: "Tap where Somnāth is.", toleranceKm: 100 },
      ],
    },
    {
      chapter: "ch-sources",
      items: [
        { kind: "recall", id: "legend", claim: "Yet the early books of the Rājataraṅgiṇī are legend" },
        {
          kind: "recall",
          id: "method",
          claim: "Kalhaṇa, writing his Rājataraṅgiṇī in 1148–49",
          prompt: "How does Kalhaṇa say he worked, and what should a historian be like?",
        },
      ],
    },
  ],
};

export const PAGES: PageLearnSpec[] = [MAURYA, INDEPENDENCE, GUPTA, INDUS, MAHAJANAPADAS, VEDIC, EARLY_MEDIEVAL];
