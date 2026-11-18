/** Recall prompts for claims on /p/maurya-empire, keyed by a unique prefix of the claim's text (see ../learn-prompts.ts). */
export const PROMPTS: Record<string, string> = {
  "James Prinsep completed the decipherment": "Who completed the decipherment of the Brāhmī script, and when did he publish the rock edicts?",
  "Scholars identify these kings with": "With which kings do scholars identify the kings named in the edict?",
  "Rock Edict XIII names a Greek (Yona) king": "Which kings does Rock Edict XIII name in the west?",
  "The Arthaśāstra presents itself as the work": "How does the Arthaśāstra present its own author and its sources?",
  "The Arthaśāstra prescribes a network of spies": "What disguises does the Arthaśāstra prescribe for a king's spies?",
  "Megasthenes reports that officials built roads": "What did Megasthenes say officials set up along the roads, and how often?",
  "In the twentieth year after his consecration": "When did Aśoka visit Lumbinī, and what did he set up there?",
  "Arrian, citing Megasthenes, says": "What does Arrian, citing Megasthenes, say about slavery among Indians?",
  "Aśoka appointed special officers, the dhamma-mahāmātras": "How did Aśoka spread dhamma through officers and pillars?",
  "Under Aśoka the empire": "How far did the empire reach under Aśoka?",
  "Aśoka publicly declared his repentance": "What did Aśoka declare in public about the conquest of Kalinga?",
  "The Arthaśāstra has a chapter of rules on dāsas": "What does the Arthaśāstra's chapter on dāsas forbid, and what does it allow?",
  "Aśoka claims to have provided medical treatment": "What care does Aśoka claim to have provided, and for whom?",
  "Kangle argued that the rights the Arthaśāstra gives a dāsa": "What do the rights the Arthaśāstra gives a dāsa suggest the word meant?",
  "The Arthaśāstra justifies kingship as a bargain": "How does the Arthaśāstra justify kingship, and what did people allot the king?",
  "The surviving Arthaśāstra was probably edited": "When does most text-critical scholarship think the Arthaśāstra reached its present form?",
  "Megasthenes divided Indian society": "How did Megasthenes divide Indian society, and who came first?",
  "R. P. Kangle held that no substantial part": "Is any substantial part of the surviving Arthaśāstra later than the rest?",
  "Where medicinal herbs, roots and fruits were lacking": "What does Aśoka say he did where medicinal plants were lacking?",
  "After taking Kalinga, Aśoka says he devoted himself": "What does Aśoka say he devoted himself to after taking Kalinga?",
  "Megasthenes describes officials who measured land": "What did Megasthenes say officials did with land and canal water?",
  "Aśoka claimed to have won a “conquest by morality”": "What kind of conquest did Aśoka claim, and how far did he say it reached?",
  "Because these Hellenistic kings' reigns are known": "How do the Hellenistic kings named in the edict help historians?",
};

/** Claims whose stored prompt no longer fits the claim's reworded text: these replace it. */
export const REWORD = new Set([
  "Kangle argued that the rights the Arthaśāstra gives a dāsa",
  "R. P. Kangle held that no substantial part",
  "Because these Hellenistic kings' reigns are known",
]);
