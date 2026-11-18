import type { BlockInput, ChangeOpInput } from "@pramana/core";

/**
 * Rewrites the Maurya Empire page as a novice-first story in chapters (design
 * direction §3.1, §5, §6): a plain lede, "You may already know", "Meanwhile in
 * the Greek world", then chapters that each open with a short introduction.
 *
 * Nothing new is asserted. Every claim already on the page is kept (moved, not
 * dropped); prose only restates existing claims and links them. The one new
 * kind of content is a set of glossary entities (kind "term"), each defined
 * plainly; where a definition rests on a source (a translator's rendering),
 * the description says so. Unit conversions are marked as ours.
 *
 * Claim and excerpt ids differ between databases, so they are looked up on the
 * live page by their text.
 */

export interface PageViewLite {
  page: { id: string; version: number; blocks: { id: string; type: string }[] };
  claims: Record<
    string,
    {
      id: string;
      text: string;
      citations: { excerpt: { id: string; quote: string | null } }[];
    }
  >;
}

/** Claim refs used below → a unique prefix of the claim text on the page. */
const CLAIMS = {
  c_founded: "The Maurya Empire was founded by Chandragupta Maurya",
  c_capital: "The Maurya capital, Pāṭaliputra",
  c_extent: "Under Aśoka the empire",
  c_sources: "The main written sources for Mauryan times",
  c_kalinga_year: "Aśoka conquered Kalinga in the eighth year",
  c_kalinga_toll: "Rock Edict XIII puts the toll",
  c_remorse: "Aśoka publicly declared his repentance",
  c_dhamma_after: "After taking Kalinga, Aśoka says he devoted himself",
  c_dhamma_conquest: "Aśoka claimed to have won a “conquest by morality”",
  c_greek_names: "Rock Edict XIII names a Greek (Yona) king",
  c_greek_ids: "Scholars identify these kings",
  c_synchronism: "Because these Hellenistic kings' reigns",
  c_prinsep: "James Prinsep completed the decipherment",
  c_spies: "The Arthaśāstra prescribes a network of spies",
  c_sixth: "The Arthaśāstra justifies kingship as a bargain",
  c_mahamatras: "Aśoka appointed special officers",
  c_sluices: "Megasthenes describes officials who measured land",
  c_road_pillars: "Megasthenes reports that officials built roads",
  c_roads_trees: "Aśoka records having trees planted",
  c_palibothra: "Megasthenes described Pāṭaliputra",
  c_medical: "Aśoka claims to have provided medical treatment",
  c_herbs: "Where medicinal herbs",
  c_seven_classes: "Megasthenes divided Indian society",
  c_upasaka: "By his own account, Aśoka had been a lay Buddhist",
  c_lumbini_visit: "In the twentieth year after his consecration",
  c_lumbini_tax: "Aśoka exempted the village of Lumbinī",
  c_arth_self: "The Arthaśāstra presents itself",
  c_kangle_single: "R. P. Kangle held",
  c_arth_layers: "The surviving Arthaśāstra was probably",
  c_megas_no_slaves: "Arrian, citing Megasthenes",
  c_arth_slaves: "The Arthaśāstra has a chapter of rules on dāsas",
  c_kangle_dasa: "Kangle argued that the rights",
  m_sudden_conversion: "Aśoka became a Buddhist suddenly",
  m_no_slavery: "Megasthenes said no Indian was a slave",
  m_arth_chanakya: "The Arthaśāstra as we have it",
} as const;
type ClaimRef = keyof typeof CLAIMS;

/** Excerpts quoted in chapters → the claim citing them and a unique quote prefix. */
const EXCERPTS = {
  x_re13_conquest: ["c_kalinga_toll", "(the country of) the Kalingyas was conquered"],
  x_rupnath: ["c_upasaka", "Two and a half years"],
  x_re13_kings: ["c_greek_names", "where the Yona king"],
  x_arth_spies: ["c_spies", "the king shall proceed to create spies"],
  x_pe7_banyan: ["c_roads_trees", "On the roads banyan-trees"],
  x_re2_medical: ["c_medical", "were established by king"],
  x_hultzsch_synchronism: ["c_synchronism", "the mention of these five contemporaries"],
} as const satisfies Record<string, readonly [ClaimRef, string]>;
type ExcerptRef = keyof typeof EXCERPTS;

/** Glossary terms (new entities of kind "term"). */
const TERMS = [
  {
    ref: "t_consecration",
    slug: "consecration",
    label: "consecration",
    description:
      "The ceremony that began a king's reign. Aśoka dates events by the years since his; Hultzsch translates the word as “anointed”.",
    aliases: [{ label: "abhiṣeka", lang: "sa-Latn" }],
  },
  {
    ref: "t_rock_edict",
    slug: "rock-edict",
    label: "Rock Edict",
    description:
      "One of fourteen messages Aśoka had carved on rock faces at sites across his empire; modern editors number them I–XIV.",
  },
  {
    ref: "t_pillar_edict",
    slug: "pillar-edict",
    label: "Pillar Edict",
    description:
      "One of the messages Aśoka had carved on stone pillars; modern editors number them. Pillar Edict VII survives only on the Delhi-Topra pillar.",
  },
  {
    ref: "t_dhamma",
    slug: "dhamma",
    label: "dhamma",
    description:
      "The edicts' own word for the right conduct Aśoka set out to teach; Hultzsch translates it “morality”. The Sanskrit form is dharma.",
    aliases: [
      { label: "dharma", lang: "sa-Latn", note: "Sanskrit form" },
      { label: "धम्म", lang: "pra", script: "Deva" },
    ],
  },
  {
    ref: "t_mahamatra",
    slug: "dhamma-mahamatra",
    label: "dhamma-mahāmātra",
    description:
      "One of the officers Aśoka appointed to spread dhamma; Hultzsch translates the title “Mahāmātras of morality”.",
    aliases: [{ label: "dhamma-mahamatra", lang: "en" }],
  },
  {
    ref: "t_sangha",
    slug: "sangha",
    label: "Saṅgha",
    description:
      "The community of Buddhist monks and nuns. Aśoka says he visited it; Hultzsch spells it “Samgha”.",
    aliases: [
      { label: "Sangha", lang: "en" },
      { label: "Samgha", lang: "en", note: "Hultzsch's spelling" },
    ],
  },
  {
    ref: "t_brahmi",
    slug: "brahmi",
    label: "Brāhmī",
    description:
      "The script in which most of Aśoka's inscriptions are written. James Prinsep completed its decipherment in the 1830s.",
    aliases: [{ label: "Brahmi", lang: "en" }],
  },
  {
    ref: "t_yona",
    slug: "yona",
    label: "Yona",
    description: "The edicts' word for Greeks, from “Ionian”.",
    aliases: [{ label: "Yavana", lang: "sa-Latn", note: "Sanskrit form" }],
  },
  {
    ref: "t_yojana",
    slug: "yojana",
    label: "yojana",
    description:
      "An old Indian measure of distance, used in the edicts. How long it was is uncertain, so this page does not convert it.",
  },
  {
    ref: "t_stadion",
    slug: "stadion",
    label: "stadion",
    description:
      "A Greek unit of length (plural stadia), used by Megasthenes and the writers who quote him. Its length varied; this page takes it as about 185 m, and conversions using that figure are ours, not the source's.",
    aliases: [{ label: "stadia", lang: "en", note: "plural" }],
  },
  {
    ref: "t_dasa",
    slug: "dasa",
    label: "dāsa",
    description:
      "The Arthaśāstra's word usually translated “slave”; Kangle argued that it did not mean a slave in the Greek sense.",
    aliases: [
      { label: "dasa", lang: "en" },
      { label: "दास", lang: "sa", script: "Deva" },
    ],
  },
  {
    ref: "t_arthashastra",
    slug: "arthashastra",
    label: "Arthaśāstra",
    description:
      "A Sanskrit treatise on statecraft, traditionally attributed to Kauṭilya. When it was written, and by how many hands, is debated.",
    aliases: [{ label: "Arthashastra", lang: "en" }],
  },
] as const;

export function mauryaChaptersOps(view: PageViewLite): ChangeOpInput[] {
  const all = Object.values(view.claims);
  const claim = (ref: ClaimRef): string => {
    const hits = all.filter((c) => c.text.startsWith(CLAIMS[ref]));
    if (hits.length !== 1)
      throw new Error(`claim ${ref}: expected 1 match on the page, found ${hits.length}`);
    return hits[0]!.id;
  };
  // Every claim on the page must be accounted for: move, don't drop.
  const known = new Set((Object.keys(CLAIMS) as ClaimRef[]).map(claim));
  const unknown = all.filter((c) => !known.has(c.id));
  if (unknown.length)
    throw new Error(`claims on the page not placed in the rewrite: ${unknown.map((c) => c.text).join(" | ")}`);

  const excerpt = (ref: ExcerptRef): string => {
    const [c, prefix] = EXCERPTS[ref];
    const hit = view.claims[claim(c)]!.citations.find((x) => x.excerpt.quote?.startsWith(prefix));
    if (!hit) throw new Error(`excerpt ${ref} not found among the citations of ${c}`);
    return hit.excerpt.id;
  };

  // Markdown link helpers.
  const C = (ref: ClaimRef, text: string) => `[${text}](claim:${claim(ref)})`;
  const E = (slug: string, text: string) => `[${text}](entity:${slug})`;
  const T = (ref: (typeof TERMS)[number]["ref"], text: string) => `[${text}](entity:@${ref})`;
  const ids = (...refs: ClaimRef[]) => refs.map(claim);

  const ops: ChangeOpInput[] = TERMS.map((t) => ({
    op: "create_entity" as const,
    ref: t.ref,
    slug: t.slug,
    kind: "term" as const,
    label: t.label,
    description: t.description,
    ...("aliases" in t ? { aliases: t.aliases.map((a) => ({ ...a })) } : {}),
  }));

  const blocks: BlockInput[] = [
    // ------------------------------------------------------------ lede
    {
      id: "intro",
      type: "prose",
      markdown: [
        `About 2,300 years ago a family called the Mauryas built the first empire to rule most of India. ${C("c_founded", "It began around 320 BCE under Chandragupta Maurya")} and was governed from ${E("pataliputra", "Pāṭaliputra")}, ${C("c_capital", "the city that lies beneath modern Patna")}. Two generations later his grandson ${E("ashoka", "Aśoka")} ${C("c_extent", "held the main cities and routes of the subcontinent, all but the far south")}.`,
        `What makes this empire unusual is how we know about it. Aśoka had messages carved into rocks and pillars across his lands, and they still stand: for the first time an Indian ruler speaks to us in his own words. Nearly everything else comes from two books that are harder to trust: ${C("c_sources", "a Greek ambassador's report, lost and known only from later quotations")}, and a manual of statecraft ${C("c_arth_layers", "whose date is still argued over")}.`,
      ].join("\n\n"),
    },
    {
      id: "already-know",
      type: "already_know",
      items: [
        {
          entity: "ashoka",
          text: `Conquered Kalinga, then ${C("c_remorse", "carved his regret into rock")}. Most of what we know about this empire is in his own words.`,
          target: "ch-kalinga",
          targetLabel: "The war in Kalinga",
        },
        {
          entity: "kautilya",
          text: `Also called Chanakya. Traditionally Chandragupta's minister and the author of the Arthaśāstra; ${C("c_arth_layers", "how much of the surviving book is his is debated")}.`,
          target: "ch-running",
          targetLabel: "Running the empire",
        },
        {
          entity: "pataliputra",
          text: `Modern Patna, and the Maurya capital. ${C("c_palibothra", "A Greek visitor described a wall with 570 towers and 64 gates")}.`,
          target: "ch-roads",
          targetLabel: "Roads, wells and the capital",
        },
        {
          entity: "kalinga-war",
          text: `The one war we know from the winner's own account: ${C("c_kalinga_toll", "150,000 deported and 100,000 killed, by his count")}.`,
          target: "ch-kalinga",
          targetLabel: "The war in Kalinga",
        },
      ],
    },
    {
      id: "meanwhile",
      type: "meanwhile",
      title: "Meanwhile, in the Greek world",
      items: [
        { region: "Syria", label: "Antiochus II Theos, 261–246 BCE", claimIds: ids("c_greek_names", "c_greek_ids") },
        { region: "Egypt", label: "Ptolemy II Philadelphus, 285–247 BCE", claimIds: ids("c_greek_names", "c_greek_ids") },
        { region: "Macedonia", label: "Antigonus Gonatas, 276–239 BCE", claimIds: ids("c_greek_names", "c_greek_ids") },
        { region: "Cyrene", label: "Magas, c. 300–c. 250 BCE", claimIds: ids("c_greek_names", "c_greek_ids") },
        {
          region: "Epirus or Corinth",
          label: "Alexander: of Epirus (272–c. 255 BCE) or of Corinth (252–c. 244 BCE)",
          claimIds: ids("c_greek_names", "c_greek_ids"),
        },
      ],
      note: "These are not a guess about who lived at the same time: Aśoka names these kings himself in Rock Edict XIII. Matching his names to known Greek rulers is the scholars' work, and the reign dates are as E. Hultzsch gives them (1925). Which Alexander is meant is debated.",
    },

    // ------------------------------------------------------------ 1
    {
      id: "ch-empire",
      type: "chapter",
      title: "A new empire from Pāṭaliputra",
      promise:
        "Who founded the empire, where it was ruled from, how far it reached, and the few kinds of evidence we have.",
      when: {
        start: { year: 320, era: "BCE", approximate: true },
        basis: "Founding date as in the claim cited in this chapter",
      },
      places: ["pataliputra"],
      people: ["chandragupta-maurya", "ashoka", "megasthenes"],
    },
    {
      id: "empire-prose",
      type: "prose",
      markdown: [
        `The story starts in Magadha, in what is now the Indian state of Bihar. ${C("c_founded", "Around 320 BCE Chandragupta Maurya founded an empire")} there that lasted, in loose-knit form, until 185 BCE. It was ruled from ${E("pataliputra", "Pāṭaliputra")}, ${C("c_capital", "at what is today Patna")}. Under his grandson ${E("ashoka", "Aśoka")} ${C("c_extent", "it reached the main cities and routes of the subcontinent, except the far south")}.`,
        `Almost everything we know comes from ${C("c_sources", "two kinds of writing")}: Aśoka's own inscriptions, and pieces of a lost book by ${E("megasthenes", "Megasthenes")}, a Greek envoy at Chandragupta's court, quoted by Greek and Roman writers centuries later. A third text, the ${T("t_arthashastra", "Arthaśāstra")}, a manual of statecraft, is often added. “Running the empire” explains why using it is a choice.`,
      ].join("\n\n"),
    },
    { id: "empire-claims", type: "claims", claimIds: ids("c_founded", "c_capital", "c_extent", "c_sources") },
    {
      id: "empire-care",
      type: "callout",
      tone: "caution",
      markdown:
        "Read with care. The founding date, the capital and the empire's reach are taken here from an encyclopedia (Wikipedia), not yet from the scholarship it cites. Treat the dates as approximate: Maurya dates are reconstructed from the edicts, Greek synchronisms and later chronicles, not recorded in a calendar we share.",
    },
    {
      id: "map",
      type: "viz",
      viz: { kind: "map", linkedTo: "maurya-empire" },
      caption: "Places on this page. Dotted outlines and faded points are uncertain locations.",
    },
    {
      id: "timeline",
      type: "viz",
      viz: { kind: "timeline", linkedTo: "maurya-empire" },
      caption: "People, events and inscriptions linked to the empire.",
    },

    // ------------------------------------------------------------ 2
    {
      id: "ch-kalinga",
      type: "chapter",
      title: "The war in Kalinga",
      promise: "The one war we know from the winner's own account, and why he said he regretted it.",
      when: {
        start: { year: 261, era: "BCE", approximate: true },
        asStated: {
          text: "When king Devanampriya Priyadarsin had been anointed eight years",
          calendar: "regnal",
        },
        basis:
          "Eighth regnal year, from Rock Edict XIII; the absolute date depends on dating Aśoka's consecration",
      },
      places: ["kalsi-rock-edicts"],
      people: ["ashoka"],
      terms: ["@t_consecration", "@t_rock_edict"],
    },
    {
      id: "kalinga-prose",
      type: "prose",
      markdown: `Kings usually boast about their wars. Aśoka did something stranger: he carved his regret into stone. ${C("c_kalinga_year", `In the eighth year after his ${"consecration"}`)}, around 261 BCE, he conquered ${E("kalinga-war", "Kalinga")}, a country on India's east coast. In a long inscription that modern editors call ${T("t_rock_edict", "Rock Edict")} XIII he ${C("c_kalinga_toll", "gives the toll")} and then ${C("c_remorse", "declares his repentance")}. A ${T("t_consecration", "consecration")} began a king's reign, and Aśoka counts his years from his own.`,
    },
    { id: "kalinga-claims", type: "claims", claimIds: ids("c_kalinga_year", "c_kalinga_toll", "c_remorse") },
    {
      id: "kalinga-quote",
      type: "quote",
      excerptId: excerpt("x_re13_conquest"),
      caption:
        "Aśoka, Rock Edict XIII, the copy carved at Kālsī. English by E. Hultzsch, Inscriptions of Asoka (Oxford, 1925), p. 47. Brackets are the translator's.",
    },
    {
      id: "kalinga-care",
      type: "callout",
      tone: "caution",
      markdown:
        "Read the numbers with care. They are the king's own, in a text written to show remorse; there is no independent count. The year is his too: “eight years” after his consecration. Turning that into 261 BCE depends on when the consecration was, which is itself worked out from other evidence.",
    },

    // ------------------------------------------------------------ 3
    {
      id: "ch-dhamma",
      type: "chapter",
      title: "The turn to dhamma",
      promise: "How Aśoka's change of heart unfolded over years, and what he did with it.",
      when: {
        start: { year: 261, era: "BCE", approximate: true },
        end: { year: 232, era: "BCE", approximate: true },
        basis: "From the Kalinga conquest (eighth regnal year) to the end of Aśoka's conventional reign",
      },
      places: ["lumbini", "rupnath-inscription", "delhi-topra-pillar"],
      people: ["ashoka"],
      terms: ["@t_dhamma", "@t_sangha", "@t_mahamatra"],
    },
    {
      id: "dhamma-prose",
      type: "prose",
      markdown: [
        `The edicts tie Aśoka's change of heart to the aftermath of Kalinga, not to the battle itself: ${C("c_dhamma_after", "after taking Kalinga, he says, he devoted himself to the study, love and teaching of dhamma")}. ${T("t_dhamma", "Dhamma")} is the edicts' word for right conduct. By his own account ${C("c_upasaka", "he had been a lay Buddhist for over two and a half years and “not very zealous”; the change deepened after he visited the Saṅgha")}, the ${T("t_sangha", "community of Buddhist monks and nuns")}.`,
        `He then made dhamma a matter of government. He ${C("c_mahamatras", "appointed officers of dhamma and raised inscribed pillars")}, the ${T("t_mahamatra", "dhamma-mahāmātras")}. ${C("c_lumbini_visit", "In the twentieth year after his consecration he visited Lumbinī, the Buddha's birthplace")}, set up a pillar there, and ${C("c_lumbini_tax", "freed the village from taxes, cutting its share of the harvest to an eighth")}.`,
      ].join("\n\n"),
    },
    {
      id: "dhamma-claims",
      type: "claims",
      claimIds: ids("c_dhamma_after", "c_upasaka", "c_lumbini_visit", "c_lumbini_tax"),
    },
    {
      id: "dhamma-quote",
      type: "quote",
      excerptId: excerpt("x_rupnath"),
      caption:
        "Aśoka, the minor rock edict at Rūpnāth. English by E. Hultzsch, 1925, p. 167. A “Sakya” is a follower of the Buddha Śākyamuni.",
    },

    // ------------------------------------------------------------ 4
    {
      id: "ch-greek",
      type: "chapter",
      title: "The empire and the Greek world",
      promise: "Five kings Aśoka names in one edict, and why they matter so much to historians.",
      places: ["kalsi-rock-edicts"],
      people: ["ashoka"],
      terms: ["@t_yona", "@t_yojana"],
    },
    {
      id: "greek-prose",
      type: "prose",
      markdown: [
        `Aśoka's world was wider than India. He ${C("c_dhamma_conquest", "claims a “conquest by morality” among his neighbours and as far as the Greek kingdoms of the west")}, “six hundred ${T("t_yojana", "yojanas")}” away. In Rock Edict XIII ${C("c_greek_names", `he names a Greek king, Antiyoga, and four kings beyond him`)}; ${T("t_yona", "Yona")} is the edicts' word for Greek. ${C("c_greek_ids", "Scholars read these as Antiochus II of Syria, Ptolemy II of Egypt, Antigonus Gonatas of Macedonia, Magas of Cyrene and an Alexander, of Epirus or of Corinth")}.`,
        `${C("c_synchronism", "Because their reigns are known from Greek sources, this one passage both confirms that the author of the edicts is Aśoka and helps fix his reign in time")}. “Reading the stone” tells that part of the story.`,
      ].join("\n\n"),
    },
    {
      id: "greek-claims",
      type: "claims",
      claimIds: ids("c_dhamma_conquest", "c_greek_names", "c_greek_ids"),
    },
    {
      id: "greek-quote",
      type: "quote",
      excerptId: excerpt("x_re13_kings"),
      caption: "Aśoka, Rock Edict XIII, Kālsī copy, section Q. English by E. Hultzsch, 1925, p. 48.",
    },
    {
      id: "greek-care",
      type: "callout",
      tone: "caution",
      markdown:
        "Read with care. The stone gives the names in Prakrit forms: Antiyoga, Tulamaya, Antekina, Maka, Alikyashudala. Matching them to Greek kings is a scholarly identification, generally accepted since the 19th century; which Alexander is meant is still debated. The “conquest by morality” is the king's own claim, in his own inscription.",
    },

    // ------------------------------------------------------------ 5
    {
      id: "ch-running",
      type: "chapter",
      title: "Running the empire",
      promise: "Two very different witnesses to Mauryan government, and why they should not be read the same way.",
      people: ["ashoka", "kautilya", "megasthenes"],
      terms: ["@t_arthashastra", "@t_mahamatra"],
    },
    {
      id: "running-prose",
      type: "prose",
      markdown: [
        `Two kinds of evidence describe how the Mauryas governed, and they do not describe the same thing. The edicts tell us what Aśoka wanted known: ${C("c_mahamatras", "officers of dhamma and inscribed pillars")}. The ${T("t_arthashastra", "Arthaśāstra")} tells us what a king *should* do, ${C("c_spies", "down to the disguises his spies should wear")}.`,
        `It is a manual, not a report, and ${C("c_arth_layers", "most text critics think the surviving version was finished centuries after the Mauryas")}. Using it to describe their state is a choice, and this page says so where it does. A third witness, Megasthenes, describes ${C("c_sluices", "officials who measured land and inspected the sluices that shared out canal water")}.`,
      ].join("\n\n"),
    },
    {
      id: "running-claims",
      type: "claims",
      claimIds: ids("c_mahamatras", "c_spies", "c_sixth", "c_sluices"),
    },
    {
      id: "running-quote",
      type: "quote",
      excerptId: excerpt("x_arth_spies"),
      caption: "Arthaśāstra, Book I, chapter XI, “The institution of spies”. English by R. Shamasastry, 1915.",
    },
    {
      id: "running-method",
      type: "callout",
      tone: "method",
      markdown:
        "Read the Arthaśāstra as a manual of what a king *should* do, not a record of what the Mauryas did. Its date is also uncertain (see “Reading the stone”), so using it to describe Mauryan government is itself a choice.",
    },
    {
      id: "running-care",
      type: "callout",
      tone: "caution",
      markdown: `Read with care. The Arthaśāstra's account of how kingship began, ${C("c_sixth", "people choosing a king and paying him a sixth of their grain")}, is a speech the king's spies are told to make in public. It is propaganda as well as theory.`,
    },

    // ------------------------------------------------------------ 6
    {
      id: "ch-roads",
      type: "chapter",
      title: "Roads, wells and the capital",
      promise: "What the Mauryas built, as a Greek visitor and Aśoka himself describe it.",
      places: ["pataliputra", "delhi-topra-pillar"],
      people: ["megasthenes", "ashoka"],
      terms: ["@t_stadion", "@t_pillar_edict"],
    },
    {
      id: "roads-prose",
      type: "prose",
      markdown: [
        `Both witnesses agree on one thing: the Mauryas built. Megasthenes reports ${C("c_road_pillars", "roads with a pillar every ten stadia to mark side roads and distances")}, and ${C("c_palibothra", "a capital, Pāṭaliputra, ringed by a moat and a wall with 570 towers and 64 gates")}. Aśoka says, in a ${T("t_pillar_edict", "Pillar Edict")} and a Rock Edict, that ${C("c_roads_trees", "he had trees planted and wells dug along the roads for people and animals")}. ${C("c_capital", "Patna stands on the site of the capital today")}.`,
        `By Megasthenes' figures the city was about 80 ${T("t_stadion", "stadia")} long and 15 wide: roughly 15 km by 3 km, with a road pillar about every 2 km. Those conversions are ours, not the source's. They take a stadion as about 185 m, and the Greek unit varied.`,
      ].join("\n\n"),
    },
    {
      id: "roads-claims",
      type: "claims",
      claimIds: ids("c_road_pillars", "c_palibothra", "c_roads_trees"),
    },
    {
      id: "roads-quote",
      type: "quote",
      excerptId: excerpt("x_pe7_banyan"),
      caption: "Aśoka, Pillar Edict VII on the Delhi-Topra pillar. English by E. Hultzsch, 1925, p. 133.",
    },
    {
      id: "roads-care",
      type: "callout",
      tone: "caution",
      markdown:
        "Read with care. Megasthenes' book is lost. His description of the capital survives through Arrian, about four centuries later, and his account of the officials and the roads through Strabo, about three centuries later.",
    },

    // ------------------------------------------------------------ 7
    {
      id: "ch-society",
      type: "chapter",
      title: "Health and society",
      promise: "Medicine for people and animals, seven classes of people, and the question of slavery.",
      people: ["ashoka", "megasthenes"],
      terms: ["@t_dasa"],
    },
    {
      id: "society-prose",
      type: "prose",
      markdown: [
        `${C("c_medical", "Aśoka claims to have provided medical care for people and for animals")}, in his own lands and in his neighbours', and ${C("c_herbs", "to have imported and planted healing herbs where they were lacking")}. Megasthenes, looking from outside, ${C("c_seven_classes", "sorted Indian society into seven classes with the philosophers first")}.`,
        `On slavery the witnesses seem to disagree. ${C("c_megas_no_slaves", "Arrian, citing Megasthenes, says no Indian was a slave")}, but ${C("c_arth_slaves", "the Arthaśāstra has a whole chapter of rules for dāsas")}. ${C("c_kangle_dasa", "Kangle argued that a dāsa was not a slave in the Greek sense")}; what the word ${T("t_dasa", "dāsa")} covered is itself debated.`,
      ].join("\n\n"),
    },
    {
      id: "society-claims",
      type: "claims",
      claimIds: ids(
        "c_medical",
        "c_herbs",
        "c_seven_classes",
        "c_megas_no_slaves",
        "c_arth_slaves",
        "c_kangle_dasa",
      ),
    },
    {
      id: "society-quote",
      type: "quote",
      excerptId: excerpt("x_re2_medical"),
      caption: "Aśoka, Rock Edict II, Kālsī copy. English by E. Hultzsch, 1925, p. 29.",
    },
    {
      id: "society-care",
      type: "callout",
      tone: "caution",
      markdown:
        "Read with care. These are claims by interested witnesses. Aśoka is describing his own good works; Megasthenes was an outsider, and we read him through later writers.",
    },

    // ------------------------------------------------------------ 8
    {
      id: "ch-stone",
      type: "chapter",
      title: "Reading the stone",
      promise:
        "How the edicts were deciphered, how we know their author was Aśoka, and the argument over the Arthaśāstra's date.",
      phase: "later",
      when: {
        start: { year: 1838, era: "CE" },
        end: { year: 1925, era: "CE" },
        basis: "From Prinsep's published translations (1838) to Hultzsch's edition (1925)",
      },
      people: ["ashoka", "kautilya"],
      terms: ["@t_brahmi", "@t_rock_edict"],
    },
    {
      id: "stone-prose",
      type: "prose",
      markdown: [
        `For a long time the edicts could not be read, and most of them name their author only as “Devānaṃpiya Piyadasi”, beloved of the gods. ${C("c_prinsep", "James Prinsep completed the decipherment of the script")}, ${T("t_brahmi", "Brāhmī")}, and published translations in 1838. ${C("c_greek_names", "The Greek kings named in Rock Edict XIII")}, whose dates are known from Greek sources, ${C("c_synchronism", "confirmed that this king was Aśoka and helped fix when he reigned")}. E. Hultzsch's 1925 edition is the translation quoted on this page.`,
        `The Arthaśāstra has a puzzle of its own. ${C("c_arth_self", "The text presents itself as the work of the man who rescued the land from the Nanda king")}, by tradition Kauṭilya, Chandragupta's minister. ${C("c_kangle_single", "Kangle found no substantial part that could be shown to be later")}; ${C("c_arth_layers", "most text critics think it was revised over time and reached its present form between the 1st and 3rd centuries CE")}.`,
      ].join("\n\n"),
    },
    { id: "stone-claims", type: "claims", claimIds: ids("c_prinsep", "c_synchronism") },
    {
      id: "stone-quote",
      type: "quote",
      excerptId: excerpt("x_hultzsch_synchronism"),
      caption: "E. Hultzsch, Inscriptions of Asoka (Oxford, 1925), introduction, p. xxxi.",
    },
    {
      id: "arth-debate",
      type: "debate",
      question: "When was the Arthaśāstra written, and by whom?",
      positions: [
        { label: "Kauṭilya, in Chandragupta's time", claimIds: ids("c_arth_self", "c_kangle_single") },
        { label: "A text revised over centuries", claimIds: ids("c_arth_layers") },
      ],
      note: "Both sides agree the text draws on earlier treatises and contains later glosses. The disagreement is over how much of it is a single author's work.",
    },
    {
      id: "stone-method",
      type: "callout",
      tone: "method",
      markdown:
        "Prinsep's date comes from an encyclopedia (Wikipedia) for now. The modern scholarship on the Arthaśāstra's date (Trautmann 1971, Olivelle 2013) is cited by its page numbers only, because those books are still in copyright.",
    },

    // ------------------------------------------------------------ 9
    {
      id: "ch-often-said",
      type: "chapter",
      title: "Often said, and what the evidence shows",
      promise: "Three popular beliefs about the Mauryas, set against the sources on this page.",
      phase: "later",
    },
    {
      id: "often-prose",
      type: "prose",
      markdown:
        "Some stories about the Mauryas are repeated more often than the evidence allows. Here are three, each with what the sources on this page say about it: one is weakly supported, one is refuted, and one is a real argument among scholars.",
    },
    {
      id: "myth-conversion",
      type: "misconception",
      theme: "religion",
      claimId: claim("m_sudden_conversion"),
      correctionIds: ids("c_upasaka", "c_dhamma_after"),
    },
    {
      id: "myth-slavery",
      type: "misconception",
      theme: "society",
      claimId: claim("m_no_slavery"),
      correctionIds: ids("c_megas_no_slaves", "c_arth_slaves", "c_kangle_dasa"),
    },
    {
      id: "myth-arthashastra",
      type: "misconception",
      theme: "sources",
      claimId: claim("m_arth_chanakya"),
      correctionIds: ids("c_arth_layers", "c_arth_self"),
    },
  ];

  ops.push({
    op: "update_page",
    page: "maurya-empire",
    baseVersion: view.page.version,
    set: { blocks },
  });
  return ops;
}
