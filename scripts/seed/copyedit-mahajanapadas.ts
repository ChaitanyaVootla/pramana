/**
 * Copy edits for a first-time reader on /p/mahajanapadas, proposed THROUGH
 * MCP (machinery in ./copyedit-lib.ts): modern places for the old names
 * (Gandhāra, Aṅga, the four kingdoms, the six great cities, Kapilavatthu,
 * Vesālī, Kusinārā, Taxila, the Jhelum and the Beas), terms glossed where
 * they are used (brahmin, rājā, śūdra and varṇa, Nigaṇṭha, Tīrthaṅkara,
 * tribute, suttas), scholars and sources introduced, attributions kept with
 * the claims (Jacobi on Mahāvīra's birth, Rhys Davids on writing), shorter
 * sentences, and two claim notes rewritten for the learner. No claim's
 * text changes, so captions that link claims by their opening words still
 * find them.
 *
 *   pnpm tsx scripts/seed/copyedit-mahajanapadas.ts                    # propose
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *   … --fingerprints      # print the current fingerprints and exit
 */
import { runCopyEdit } from "./copyedit-lib";
import { listMahajanapadasClaims, mahajanapadasNewClaims } from "./sources-mahajanapadas";

type Item = { text: string } & Record<string, unknown>;

await runCopyEdit({
  page: "mahajanapadas",
  newClaims: mahajanapadasNewClaims,
  title: "Mahājanapadas: plainer words for a first-time reader",
  rationale: [
    "After the support checks the prose says no more than its claims: the pottery is “black polished” (no quote calls it glossy); Herodotus gives no year for Xerxes' march, so “480 BCE” goes; and the six teachers were named before Ajātasattu went to the Buddha, not teachers older than him",
    "A copy edit for readers new to the period, after a review of the era pages for novice clarity. Old names get modern ones at first use, from the entity descriptions where they give them: Gandhāra (around Peshawar), Aṅga (eastern Bihar), Magadha (south Bihar), Kosala, the Vatsas and Avanti, the six great cities (near Bhagalpur, Rajgir, Shravasti, around Ayodhya, Kosam near Prayagraj, Varanasi), Kapilavatthu, Vesālī, Kusinārā (Kushinagar), Taxila, the Hydaspes (Jhelum) and the Hyphasis (Beas).",
    "Terms are glossed where they are used: brahmin, rājā, śūdra and the varṇas (from the varṇa entry), Nigaṇṭha (from its entry), Tīrthaṅkara, austerities, tribute, the suttas and the Mahāvaṃsa. Rhys Davids, Jacobi and Herodotus are introduced. Two sentences now keep the attribution their claims give: Mahāvīra's birthplace is Jacobi's argument, and that writing was known but not used for books is Rhys Davids's reading.",
    "The varṇa glossary entry is trimmed to its definition: its sentence on the Nandas' śūdra mother belongs to Part 8, where the prose already says it, linked to the Purāṇas claim.",
    "A new claim from Rhys Davids's Buddhist India (1903), already a source on the page, places Aṅga and its capital Campā near Bhagalpur; the intro links it.",
    "Two claim notes that read as editors' to-dos (“the synchronism depends on the long chronology”, and the urbanisation note) are rewritten for the learner; the Sāmaññaphala note is left to the content agent, who has quoted the names it said were too blurred. The Mahājanapadas age's one-line description explains Mahāvīra and says where the list comes from.",
  ],
  moves: [{ block: "meanwhile", after: "persia-prose", why: "next to the part on Persia and the Greek sources, which it belongs to" }],
  blocks: [
    {
      block: "often-prose",
      was: ["b5170714b2"],
      why: "opening continues from the brief",
      set: { markdown: "Each belief below is set against the claims on this page that correct or qualify it." },
    },
    ...listMahajanapadasClaims,
    {
      block: "intro",
      was: ["f24ba7bba9", "6c47169b12", "dbdbdd7f5e"],
      why: "Gandhāra, Aṅga and Magadha placed; Mahāvīra and brahmins explained; shorter sentences",
      set: {
        markdown: [
          "In the centuries before the Mauryas, northern India was a patchwork of kingdoms and clan republics. Buddhist texts remember [sixteen “great countries”]({c:Early Buddhist texts keep a stock list}). They ran from Gandhāra, around Peshawar in today's Pakistan, to [Aṅga, east of Magadha, near today's Bhagalpur]({c:Rhys Davids placed the Aṅgas}). [Towns grew up again]({c:From about 600 BCE towns grew up again}), for the first time since the Indus cities. In them [wandering teachers questioned the old rituals]({c:The growing towns of the seventh}). Among them were [the Buddha](entity:gautama-buddha) and [Mahāvīra](entity:mahavira), the great teacher of the Jains.",
          "One kingdom, [Magadha](entity:magadha) in south Bihar, swallowed its neighbours. Around 322 BCE [Chandragupta Maurya took it over, with the help of a brahmin]({c:Both the Purāṇas and the Mahāvaṃsa say a brahmin}). Brahmins were the priestly order. Meanwhile the Persian empire [ruled Gandhāra]({c:Darius I's inscription at Behistun}), and [Alexander of Macedon fought his way to the Jhelum river]({c:Alexander defeated Porus}), in today's Pakistan. Almost every date here is uncertain: [no one can fix the reigns of the kings before the Mauryas]({c:Even Vincent Smith (1914)}), and [even the Buddha's dates are argued over]({c:Many historians now put the Buddha's death}).",
        ].join("\n\n"),
      },
    },
    {
      block: "already-know",
      was: "547bc44473",
      why: "Pāṭaliputra's modern name",
      set: {
        items: (items: Item[]) =>
          items.map((it) =>
            it.text.startsWith("Later the Maurya capital.") ? { ...it, text: it.text.replace("Later the Maurya capital.", "Later the Maurya capital, at today's Patna.") } : it,
          ),
      },
    },
    {
      block: "sixteen-prose",
      was: ["7981490062", "a62487265f"],
      why: "the four kingdoms placed; shorter sentences; opening continues from the brief",
      set: {
        markdown: [
          "The [mahājanapadas](entity:mahajanapada), as the list calls them, are not a map. [Their names are peoples, not countries]({c:Rhys Davids noticed}), and [other texts list twelve, or a different sixteen]({c:The lists do not agree}).",
          "By the Buddha's time [no one ruled them all]({c:When Buddhism arose}). Four kingdoms stood out: [Magadha, Kosala, the Vatsas and Avanti]({c:The four kingdoms were Magadha}). Magadha lay in south Bihar, and Kosala north of the Ganges, ruled from Sāvatthi (Shravasti). The Vatsas ruled from Kosambī on the Yamunā, near today's Prayagraj, and Avanti from Ujjain. Their royal families [married one another and fought one another]({c:Their royal families married}).",
          "Most of what we know comes from Buddhist and Jain texts. [The brahmins' own books say little about the clan states]({c:Rhys Davids argued that earlier scholars}).",
        ].join("\n\n"),
      },
    },
    {
      block: "sixteen-care",
      was: "5192737309",
      set: {
        markdown:
          "Read with care. The borders on the map are a modern reconstruction, from a dataset of historical borders (Cliopatria). They are drawn from lists like this one, not from surveyed frontiers. Treat them as “roughly here”.",
      },
    },
    {
      block: "republics-prose",
      was: "4593eadf81",
      why: "clan states and rājā glossed; Kapilavatthu and Vesālī placed; Jacobi named; one idea per sentence",
      set: {
        markdown: [
          "Beside the kingdoms lived [clan states](entity:gana-sangha), ruled through assemblies rather than by hereditary kings. The Buddha's own clan, [the Sakyas, met in an assembly hall at Kapilavatthu]({c:The Sakya clan, the Buddha's own}), near today's border of India and Nepal. They had [a chosen chief who held the title rājā, “king”]({c:Rhys Davids thought a single chief}). The largest clan state was the Vajjian league at Vesālī (Vaishali, in north Bihar). [The Buddha said it would prosper so long as it held full and frequent assemblies]({c:In the Mahāparinibbāna Sutta the Buddha says}).",
          "Who sat in those assemblies? [Among the Licchavis of Vesālī, thousands of heads of warrior families]({c:Most of these clan states were aristocratic}). [The scholar Hermann Jacobi read the texts as describing a senate of nobles]({c:Summarising the Buddhist texts}). [Alexander's soldiers heard of a country ruled by its aristocracy]({c:Alexander's men heard of a country}). [Historians still disagree]({c:Historians disagree about what to call}) about the right word for them.",
        ].join("\n\n"),
      },
    },
    {
      block: "cities-prose",
      was: ["fce51648b1", "c8e61e683c", "ca41f3451f"],
      why: "the six cities placed; Rhys Davids's reading attributed to him; opening continues from the brief",
      set: {
        markdown: [
          "Archaeologists recognise these towns by a black polished pottery, [Northern Black Polished Ware](entity:northern-black-polished-ware), [made from about 700 to 200 BCE]({c:From about 600 BCE towns grew up again}). The texts know six great cities. When the Buddha lay dying, his follower [Ānanda listed Campā, Rājagaha, Sāvatthi, Sāketa, Kosambī and Benares]({c:When the Buddha lay dying, Ānanda}). Their remains lie near Bhagalpur, at Rajgir, at Shravasti, around Ayodhya, at Kosam near Prayagraj, and at Varanasi. Among the clan states, [only Vesālī was a great city]({c:Vesālī, Rhys Davids noted}).",
          "In the towns and on the roads between them moved [śramaṇas](entity:sramana): [ascetics who had left home and challenged the brahmins' rituals]({c:The growing towns of the seventh}). Their teachings were remembered by word of mouth. [The scholar T. W. Rhys Davids thought writing was known, but not yet used for books]({c:Rhys Davids read the early texts}).",
        ].join("\n\n"),
      },
    },
    {
      block: "magadha-prose",
      was: ["c68f6b292b", "3ccb1fc8a9", "296bebbc95"],
      why: "Pāṭaliputra and Avanti placed; one event per sentence",
      set: {
        markdown: [
          "[Bimbisāra](entity:bimbisara) of Magadha [reigned for half a century and took Aṅga, to the east]({c:Bimbisāra of Magadha reigned}). His son [Ajātasattu](entity:ajatasattu) came to the throne, Buddhist tradition says, [by killing him]({c:Buddhist tradition says Ajātasattu}). [The Jains tell it differently]({c:Jain scripture tells it differently}).",
          "Ajātasattu [set out to “root out” the Vajjian league]({c:Ajātasattu resolved to “root out”}). [He had a fort built against it at the village of Pāṭaligāma]({c:Ajātasattu's ministers built}), on the Ganges. The fort grew into Pāṭaliputra, today's Patna, and [a later king, Udayin, moved the capital there]({c:The Purāṇas say Udayin}). Later kings [took Avanti]({c:Pradyota of Avanti}), around Ujjain. Then [the throne passed to a minister, Susunāga]({c:The Mahāvaṃsa says the people}). Exact dates are out of reach: [they differ by half a century depending on whom you follow]({c:Even Vincent Smith (1914)}).",
        ].join("\n\n"),
      },
    },
    {
      block: "buddha-prose",
      was: "3c23ec9451",
      why: "Sarnath and Kusinārā placed; the Mahāvaṃsa introduced; shorter sentences",
      set: {
        markdown: [
          "[The Buddha](entity:gautama-buddha) was born into the Sakya clan and taught in the kingdoms of the Ganges plain. [He and Mahāvīra both taught in Magadha under Bimbisāra]({c:The Buddha and Mahāvīra both taught}). [Pasenadi, king of Kosala, became his follower]({c:Pasenadi of Kosala}). [His first sermon, in the Deer Park at Sarnath near Benares (Varanasi), taught a middle path between two extremes]({c:The Buddha's first sermon}).",
          "One text, the Mahāparinibbāna Sutta, tells the story of his last journey. [At eighty, his body “like a worn-out cart”, he died at Kusinārā]({c:Near the end the Buddha says}), today's Kushinagar. [Four places of his life became places of pilgrimage]({c:The Mahāparinibbāna Sutta names four places}). [The Mahāvaṃsa, a chronicle from Sri Lanka, dates his death to Ajātasattu's eighth year]({c:The Mahāvaṃsa dates the Buddha's death}). When that was is the subject of a later chapter.",
        ].join("\n\n"),
      },
    },
    {
      block: "buddha-care",
      was: "dbbcb1e091",
      set: {
        markdown:
          "Read with care. The suttas, the texts of the Buddha's teachings, were passed on by memory and written down centuries after him. They tell us what his followers remembered and believed, which is not always the same as what happened.",
      },
    },
    {
      block: "teachers-prose",
      was: ["c12686c8c1", "d11c20a56d"],
      why: "Nigaṇṭha, austerities and Tīrthaṅkara glossed; Mahāvīra's birthplace attributed to Jacobi",
      set: {
        markdown: [
          "When Ajātasattu went looking for wisdom, [his ministers named six famous teachers; in the end he went to the Buddha]({c:In the Sāmaññaphala Sutta}). [Makkhali Gosāla taught that fate ruled everything]({c:As the Buddhists report him}). [Ajita denied that good or bad deeds had any result]({c:Ajita of the hair-garment}). We know them only from their rivals, the Buddhists.",
          "One of the six was the Nigaṇṭha Nātaputta. [Scholars identify him with Mahāvīra]({c:Jacobi identified Mahāvīra}). [Nigaṇṭha](entity:nigantha), “without bonds”, is the Buddhists' name for a Jain monk. [Mahāvīra was born near Vesālī, Jacobi argued, and was related to the kings of Magadha]({c:Jains say Mahāvīra was the son}). [He spent twelve years in austerities, fasting and hardship, before attaining perfect knowledge, and died at seventy-two]({c:The Kalpa Sūtra says}). He taught [that no living creature should be harmed]({c:The Ācārāṅga Sūtra teaches}).",
          "But [Jains count him the twenty-fourth of their great teachers, not the first]({c:For Jains, Mahāvīra}). They call these teachers [Tīrthaṅkaras](entity:tirthankara). [The twenty-third, Pārśva, was probably a real teacher before him]({c:Jacobi argued that the Jain order}). [Mahāvīra's own dates are as uncertain as the Buddha's]({c:Jain tradition puts Mahāvīra's birth}).",
        ].join("\n\n"),
      },
    },
    {
      block: "persia-prose",
      was: ["3296076af3", "1c1d10dd0a"],
      why: "Behistun and Herodotus introduced; tribute glossed; Gaugamela named",
      set: {
        markdown: [
          "The first firm dates of Indian history come from Persia. [The Persian king Cyrus began pushing into the north-west around 535 BCE]({c:Around 535 BCE the Persian king Cyrus}). [Darius I's great inscription at Behistun, in western Iran, lists Gandāra (Gandhāra) among his lands]({c:Darius I's inscription at Behistun}). [Persian records name three Indus provinces]({c:Persian inscriptions name three}). The Greek historian Herodotus tells how [Darius sent Skylax down the Indus to the sea]({c:Herodotus says Darius sent Skylax}).",
          "The Indians, Herodotus says, [paid the largest tribute in the empire, in gold dust]({c:According to Herodotus the Indians}): a yearly payment to their overlord. Yet [some Indians lay beyond Persia's reach]({c:Herodotus knew the Persians' hold}). [Indian soldiers in cotton marched with the Persian king Xerxes against Greece]({c:Indian soldiers marched with Xerxes}). [Indians still fought for Persia in 331 BCE, at Gaugamela]({c:Indians still fought for Persia}), its last great battle against Alexander. [Persian rule seems to have lasted into the 330s]({c:The peoples of the Indus appear}).",
        ].join("\n\n"),
      },
    },
    {
      block: "nandas-prose",
      was: ["f75e7a1492", "6ba01a1f8a"],
      why: "śūdra and varṇa glossed; Taxila, the Jhelum and the Beas placed",
      set: {
        markdown: [
          "The last kings of Magadha before the Mauryas were the Nandas. [The Purāṇas call the founder, Mahāpadma, the son of a śūdra woman, and say he would destroy the warrior kings]({c:The Purāṇas say Mahāpadma Nanda}). Śūdras were the last of the four [varṇas](entity:varna), the orders of society in the brahmins' books. [Greek and Jain stories make him a barber's son]({c:The Greek and Roman writers heard}). [Their dates are uncertain]({c:The Nandas' dates are uncertain}).",
          "In 327 BCE Alexander of Macedon crossed into the north-west. [The ruler of Taxila, in today's Pakistan, welcomed him]({c:In 326 BCE Alexander reached Taxila}). [Porus fought him]({c:After his defeat, Porus asked}) and lost, [on the Hydaspes (Jhelum) river in 326]({c:Alexander defeated Porus}). [Told of the Nanda king's vast army]({c:Alexander's men were told}), [Alexander's soldiers refused to go further]({c:At the Hyphasis (Beas)}) at the Beas river. A young man who had seen Alexander, [Chandragupta Maurya]({c:Plutarch says the young Androkottos}), soon [overthrew the Nandas]({c:Both the Purāṇas and the Mahāvaṃsa}) with a brahmin's help.",
        ].join("\n\n"),
      },
    },
  ],
  claims: [
    {
      claim: "From about 600 BCE towns grew up again",
      was: "bbffbe7227",
      set: { assessmentNote: "When the second urbanisation began is debated, and the archaeological evidence is not yet quoted on this page." },
    },
    {
      claim: "Vincent Smith reckoned Bimbisāra",
      was: "f9a23c12e9",
      set: { assessmentNote: "This only works with the older dating of the Buddha, which puts his death around 483 BCE (see “When did the Buddha live?”)." },
    },
  ],
  entities: [
    {
      entity: "varna",
      was: "84fa86900d",
      why: "a glossary entry defines the word only; the Nandas' śūdra birth is in Part 8's prose, linked to the Purāṇas claim",
      set: { description: "One of the four orders of society in brahmin texts: brāhmaṇa (priests), kṣatriya (warriors and rulers), vaiśya and śūdra." },
    },
    {
      entity: "mahajanapadas",
      was: ["76f7c3cf3b", "4fea9866ee"],
      set: {
        description:
          "“Great countries”: the sixteen states of northern India named in early Buddhist texts, in the age of the Buddha and of Mahāvīra, the great teacher of the Jains.",
      },
    },
  ],
  // People named only as the writer or speaker of a claim's source: “Who wrote about it”.
  authors: [
    { claim: "According to Herodotus the Indians", authors: ["herodotus"] },
    { claim: "Herodotus knew the Persians' hold", authors: ["herodotus"] },
    { claim: "Herodotus says Darius sent Skylax", authors: ["herodotus"] },
    { claim: "Indian soldiers marched with Xerxes", authors: ["herodotus"] },
    { claim: "Rhys Davids argued in 1881", authors: ["t-w-rhys-davids"] },
    { claim: "Rhys Davids argued that earlier scholars", authors: ["t-w-rhys-davids"] },
    { claim: "Rhys Davids noticed", authors: ["t-w-rhys-davids"] },
    { claim: "Wherever power in a clan became hereditary", authors: ["t-w-rhys-davids"] },
    { claim: "Jacobi argued that the Jain order", authors: ["hermann-jacobi"] },
    { claim: "Jacobi identified Mahāvīra", authors: ["hermann-jacobi"] },
    { claim: "The Mahāvaṃsa says Prince Vijaya", authors: ["wilhelm-geiger"] },
    { claim: "Wilhelm Geiger (1912) combined", authors: ["wilhelm-geiger"] },
  ],
});
