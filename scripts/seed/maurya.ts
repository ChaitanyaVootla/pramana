import type { BlockInput, ChangeOpInput } from "@pramana/core";

/**
 * The Maurya Empire page: the reference slice. Every quote below was located
 * in the captured snapshot of its source (public-domain scans on the Internet
 * Archive, or a pinned Wikipedia revision); the dry run re-checks each one.
 * Modern copyrighted scholarship is cited by location only, as found via
 * Wikipedia, and is labelled as such.
 */

export interface MauryaSnapshots {
  hultzsch: string;
  mccrindle: string;
  shamasastry: string;
  wpMaurya: { id: string; revisionId: number; url: string };
  wpArthashastra: { id: string; revisionId: number; url: string };
  wpEdicts: { id: string; revisionId: number; url: string };
  wpSlavery: { id: string; revisionId: number; url: string };
}

export interface Places {
  [slug: string]: { lon: number; lat: number; wikidataId?: string } | undefined;
}

const viaWikipedia = (title: string, wp: { revisionId: number; url: string }) => ({
  via: "wikipedia" as const,
  title: `Wikipedia: ${title}`,
  url: wp.url,
  revisionId: wp.revisionId,
});

export function mauryaOps(s: MauryaSnapshots, places: Places): ChangeOpInput[] {
  const geo = (slug: string, certainty: "exact" | "approximate" | "conjectural", note?: string) => {
    const p = places[slug];
    return p
      ? {
          geo: {
            geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] as [number, number] },
            certainty,
            ...(note ? { note } : {}),
          },
          ...(p.wikidataId ? { wikidataId: p.wikidataId } : {}),
        }
      : {};
  };

  const ops: ChangeOpInput[] = [
    // ------------------------------------------------------------ sources
    {
      op: "create_source",
      ref: "w_edicts",
      kind: "inscription_corpus",
      tier: "primary",
      csl: { type: "classic", title: "Inscriptions of Aśoka (rock, pillar and minor edicts)" },
      composed: {
        start: { year: 268, era: "BCE", approximate: true },
        end: { year: 232, era: "BCE", approximate: true },
        basis: "Dated by Aśoka's regnal years",
      },
      lenses: ["primary_source"],
      note: "The inscriptions themselves, on rocks and pillars across the subcontinent. Editions and translations are separate sources derived from this one.",
    },
    {
      op: "create_source",
      ref: "s_hultzsch",
      kind: "edition",
      tier: "primary",
      derivedFrom: "@w_edicts",
      csl: {
        type: "book",
        title: "Inscriptions of Asoka",
        "collection-title": "Corpus Inscriptionum Indicarum",
        "collection-number": 1,
        author: [{ family: "Hultzsch", given: "E." }],
        issued: { "date-parts": [[1925]] },
        publisher: "Clarendon Press for the Government of India",
        "publisher-place": "Oxford",
        edition: "New edition",
      },
      identifiers: {
        ia: "InscriptionsOfAsoka.NewEditionByE.Hultzsch",
        url: "https://archive.org/details/InscriptionsOfAsoka.NewEditionByE.Hultzsch",
      },
      license: {
        status: "public_domain",
        note: "Published 1925; Hultzsch died 1927. Public domain in India (life + 60) and the US (published before 1931). Marked public domain on the Internet Archive.",
      },
      lenses: ["philological"],
      note: "Texts and English translations of all the Aśokan inscriptions known by 1925. Quotes are checked against the Internet Archive OCR text, which has scanning errors.",
    },
    {
      op: "create_source",
      ref: "w_indica",
      kind: "work",
      tier: "primary",
      csl: { type: "classic", title: "Indica", author: [{ literal: "Megasthenes" }] },
      composed: {
        start: { year: 300, era: "BCE", approximate: true },
        basis: "Megasthenes was an envoy of Seleucus I to Chandragupta's court",
      },
      lenses: ["primary_source"],
      note: "Lost. Known only from quotations and summaries in later Greek and Roman writers (Diodorus, Strabo, Arrian, Pliny), centuries later.",
    },
    {
      op: "create_source",
      ref: "s_mccrindle",
      kind: "edition",
      tier: "primary",
      derivedFrom: "@w_indica",
      csl: {
        type: "book",
        title: "Ancient India as Described by Megasthenês and Arrian",
        translator: [{ family: "McCrindle", given: "J. W." }],
        issued: { "date-parts": [[1877]] },
        publisher: "Trübner & Co.",
        "publisher-place": "London",
      },
      identifiers: {
        ia: "AncientIndiaAsDescribedByMegasthenesAndArrian",
        url: "https://archive.org/details/AncientIndiaAsDescribedByMegasthenesAndArrian",
      },
      license: { status: "public_domain", note: "Published 1877; McCrindle died 1913." },
      lenses: ["colonial_orientalist"],
      note: "English translation of the Megasthenes fragments (after Schwanbeck) and of Arrian's Indika.",
    },
    {
      op: "create_source",
      ref: "w_arthashastra",
      kind: "work",
      tier: "primary",
      csl: {
        type: "classic",
        title: "Arthaśāstra",
        author: [{ literal: "Kauṭilya (attributed)" }],
      },
      composed: {
        start: { year: 300, era: "BCE", approximate: true, uncertain: true },
        end: { year: 300, era: "CE", approximate: true },
        label: "between the 4th century BCE and the 3rd century CE (debated)",
        basis: "See the dating debate on the Maurya Empire page",
      },
      lenses: ["primary_source"],
      note: "A Sanskrit treatise on statecraft. Its date and authorship are debated.",
    },
    {
      op: "create_source",
      ref: "s_shamasastry",
      kind: "edition",
      tier: "primary",
      derivedFrom: "@w_arthashastra",
      csl: {
        type: "book",
        title: "Kautilya's Arthashastra",
        translator: [{ family: "Shamasastry", given: "R." }],
        issued: { "date-parts": [[1915]] },
        publisher: "Government Press",
        "publisher-place": "Bangalore",
      },
      identifiers: {
        ia: "kautilyas-arthashastra",
        url: "https://archive.org/details/kautilyas-arthashastra",
      },
      license: {
        status: "public_domain",
        note: "Published 1915; Shamasastry died 1944. Public domain in India (life + 60) and the US (published before 1931).",
      },
      lenses: ["philological"],
      note: "The first English translation, from the manuscript Shamasastry identified in 1905. Later translations (Kangle, Olivelle) differ in places.",
    },
    {
      op: "create_source",
      ref: "s_wp_maurya",
      kind: "wiki_article",
      tier: "tertiary",
      csl: {
        type: "entry-encyclopedia",
        title: "Maurya Empire",
        "container-title": "Wikipedia",
        issued: { "date-parts": [[2026]] },
        URL: s.wpMaurya.url,
      },
      identifiers: {
        url: s.wpMaurya.url,
        wikipedia: { lang: "en", title: "Maurya Empire", revisionId: s.wpMaurya.revisionId },
      },
      license: { status: "open", spdx: "CC-BY-SA-4.0" },
    },
    {
      op: "create_source",
      ref: "s_wp_arthashastra",
      kind: "wiki_article",
      tier: "tertiary",
      csl: {
        type: "entry-encyclopedia",
        title: "Arthashastra",
        "container-title": "Wikipedia",
        issued: { "date-parts": [[2026]] },
        URL: s.wpArthashastra.url,
      },
      identifiers: {
        url: s.wpArthashastra.url,
        wikipedia: { lang: "en", title: "Arthashastra", revisionId: s.wpArthashastra.revisionId },
      },
      license: { status: "open", spdx: "CC-BY-SA-4.0" },
    },
    {
      op: "create_source",
      ref: "s_wp_edicts",
      kind: "wiki_article",
      tier: "tertiary",
      csl: {
        type: "entry-encyclopedia",
        title: "Edicts of Ashoka",
        "container-title": "Wikipedia",
        issued: { "date-parts": [[2026]] },
        URL: s.wpEdicts.url,
      },
      identifiers: {
        url: s.wpEdicts.url,
        wikipedia: { lang: "en", title: "Edicts of Ashoka", revisionId: s.wpEdicts.revisionId },
      },
      license: { status: "open", spdx: "CC-BY-SA-4.0" },
    },
    {
      op: "create_source",
      ref: "s_wp_slavery",
      kind: "wiki_article",
      tier: "tertiary",
      csl: {
        type: "entry-encyclopedia",
        title: "Slavery in India",
        "container-title": "Wikipedia",
        issued: { "date-parts": [[2026]] },
        URL: s.wpSlavery.url,
      },
      identifiers: {
        url: s.wpSlavery.url,
        wikipedia: { lang: "en", title: "Slavery in India", revisionId: s.wpSlavery.revisionId },
      },
      license: { status: "open", spdx: "CC-BY-SA-4.0" },
    },
    {
      op: "create_source",
      ref: "s_olivelle",
      kind: "book",
      tier: "secondary",
      derivedFrom: "@w_arthashastra",
      csl: {
        type: "book",
        title: "King, Governance, and Law in Ancient India: Kauṭilya's Arthaśāstra",
        author: [{ family: "Olivelle", given: "Patrick" }],
        issued: { "date-parts": [[2013]] },
        publisher: "Oxford University Press",
      },
      identifiers: { isbn: ["978-0199891825"] },
      license: { status: "copyrighted", note: "Cited by location only; not quoted." },
      lenses: ["philological", "mainstream_academic"],
    },
    {
      op: "create_source",
      ref: "s_trautmann",
      kind: "book",
      tier: "secondary",
      csl: {
        type: "book",
        title:
          "Kauṭilya and the Arthaśāstra: A Statistical Investigation of the Authorship and Evolution of the Text",
        author: [{ family: "Trautmann", given: "Thomas R." }],
        issued: { "date-parts": [[1971]] },
        publisher: "E. J. Brill",
        "publisher-place": "Leiden",
      },
      license: { status: "copyrighted", note: "Cited by location only; not quoted." },
      lenses: ["philological"],
    },

    // ------------------------------------------------------------ entities
    {
      op: "create_entity",
      ref: "ashoka",
      slug: "ashoka",
      kind: "person",
      label: "Aśoka",
      aliases: [
        { label: "Ashoka", lang: "en" },
        {
          label: "Devānaṃpiya Piyadasi",
          lang: "pra-Latn",
          note: "“Beloved of the gods, of gracious mien”: the title by which the edicts name their author.",
        },
        { label: "अशोक", lang: "sa", script: "Deva" },
      ],
      description: "Third Maurya emperor, grandson of Chandragupta; author of the edicts.",
      when: {
        start: { year: 268, era: "BCE", approximate: true },
        end: { year: 232, era: "BCE", approximate: true },
        label: "reigned c. 268–232 BCE",
        basis:
          "Conventional regnal dates, reconstructed from the edicts, Hellenistic synchronisms and Sri Lankan chronicles",
      },
    },
    {
      op: "create_entity",
      ref: "chandragupta",
      slug: "chandragupta-maurya",
      kind: "person",
      label: "Chandragupta Maurya",
      aliases: [
        { label: "चन्द्रगुप्त मौर्य", lang: "sa", script: "Deva" },
        { label: "Sandrokottos", lang: "grc-Latn", note: "His name in Greek sources." },
      ],
      description: "Founder of the Maurya Empire.",
      when: {
        start: { year: 322, era: "BCE", approximate: true },
        end: { year: 298, era: "BCE", approximate: true },
        label: "reigned c. 322–298 BCE",
        basis: "Conventional regnal dates",
      },
    },
    {
      op: "create_entity",
      ref: "kautilya",
      slug: "kautilya",
      kind: "person",
      label: "Kauṭilya",
      aliases: [
        { label: "Chanakya", lang: "en" },
        { label: "Viṣṇugupta", lang: "sa-Latn" },
        { label: "चाणक्य", lang: "sa", script: "Deva" },
      ],
      description:
        "Traditionally, Chandragupta's minister and the author of the Arthaśāstra. How much of the surviving text is his is debated.",
      when: {
        start: { year: 350, era: "BCE", approximate: true, uncertain: true },
        end: { year: 275, era: "BCE", approximate: true, uncertain: true },
        label: "late 4th century BCE (traditional)",
        basis: "Tradition; no contemporary record",
      },
    },
    {
      op: "create_entity",
      ref: "megasthenes",
      slug: "megasthenes",
      kind: "person",
      label: "Megasthenes",
      description: "Greek envoy of Seleucus I to Chandragupta's court; author of the lost Indica.",
      when: {
        start: { year: 350, era: "BCE", approximate: true },
        end: { year: 290, era: "BCE", approximate: true },
        basis: "Approximate; visited Pāṭaliputra around 300 BCE",
      },
    },
    {
      op: "create_entity",
      ref: "pataliputra",
      slug: "pataliputra",
      kind: "place",
      label: "Pāṭaliputra",
      aliases: [
        { label: "Patna", lang: "en", note: "The modern city on the site." },
        { label: "Palibothra", lang: "grc-Latn", note: "Greek form, in Megasthenes." },
      ],
      description: "Capital of the Maurya Empire, at modern Patna.",
      ...geo("pataliputra", "approximate", "Modern Patna; the ancient city lies beneath it."),
    },
    {
      op: "create_entity",
      ref: "kalinga_war",
      slug: "kalinga-war",
      kind: "event",
      label: "Kalinga War",
      description:
        "Aśoka's conquest of Kalinga, on the east coast, described in his Rock Edict XIII.",
      when: {
        start: { year: 261, era: "BCE", approximate: true },
        asStated: {
          text: "When king Devanampriya Priyadarsin had been anointed eight years",
          calendar: "regnal",
        },
        basis:
          "Eighth regnal year, from Rock Edict XIII; the absolute date depends on dating Aśoka's consecration",
      },
      ...geo(
        "dhauli",
        "conjectural",
        "Traditionally associated with Dhauli near Bhubaneswar, where a set of Aśoka's edicts stands; the battlefield itself is not identified.",
      ),
    },
    {
      op: "create_entity",
      ref: "lumbini",
      slug: "lumbini",
      kind: "site",
      label: "Lumbinī (Rummindei pillar)",
      aliases: [{ label: "Rummindei", lang: "en" }],
      description: "Birthplace of the Buddha, where Aśoka set up an inscribed pillar.",
      ...geo("lumbini", "exact"),
    },
    {
      op: "create_entity",
      ref: "kalsi",
      slug: "kalsi-rock-edicts",
      kind: "inscription",
      label: "Kālsī rock edicts",
      description:
        "A rock in the western Himalayan foothills inscribed with Aśoka's fourteen major rock edicts.",
      ...geo("kalsi", "approximate"),
    },
    {
      op: "create_entity",
      ref: "topra",
      slug: "delhi-topra-pillar",
      kind: "inscription",
      label: "Delhi-Topra pillar",
      description:
        "An Aśokan pillar moved from Topra to Delhi by Firuz Shah Tughlaq in the 14th century; the only one carrying Pillar Edict VII.",
      ...geo(
        "topra",
        "approximate",
        "Shown at its present site in Delhi; it originally stood at Topra.",
      ),
    },
    {
      op: "create_entity",
      ref: "rupnath",
      slug: "rupnath-inscription",
      kind: "inscription",
      label: "Rūpnāth minor rock edict",
      description: "A copy of Aśoka's Minor Rock Edict I, in central India.",
      ...geo("rupnath", "approximate"),
    },
    { op: "link_entities", from: "@ashoka", to: "maurya-empire", type: "ruled" },
    { op: "link_entities", from: "@chandragupta", to: "maurya-empire", type: "ruled" },
    {
      op: "link_entities",
      from: "@kautilya",
      to: "@chandragupta",
      type: "contemporary_of",
      note: "Traditionally his minister.",
    },
    {
      op: "link_entities",
      from: "@megasthenes",
      to: "@chandragupta",
      type: "contemporary_of",
      note: "Envoy at his court.",
    },
    { op: "link_entities", from: "@kautilya", to: "maurya-empire", type: "related_to" },
    { op: "link_entities", from: "@megasthenes", to: "maurya-empire", type: "related_to" },
    {
      op: "link_entities",
      from: "@pataliputra",
      to: "maurya-empire",
      type: "part_of",
      note: "Capital.",
    },
    { op: "link_entities", from: "@kalinga_war", to: "maurya-empire", type: "part_of" },
    { op: "link_entities", from: "@lumbini", to: "maurya-empire", type: "related_to" },
    { op: "link_entities", from: "@kalsi", to: "maurya-empire", type: "part_of" },
    { op: "link_entities", from: "@topra", to: "maurya-empire", type: "part_of" },
    { op: "link_entities", from: "@rupnath", to: "maurya-empire", type: "part_of" },

    // ------------------------------------------------------------ excerpts
    // Hultzsch 1925
    {
      op: "create_excerpt",
      ref: "x_re13_conquest",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "(the country of) the Kalingyas was conquered by (him). One hundred and fifty thousand in number were the men who were deported thence, one hundred thousand in number were those who were slain there, and many times as many those who died.",
      locator: { label: "Rock Edict XIII (Kālsī version), translation, sections A–B", page: "47" },
    },
    {
      op: "create_excerpt",
      ref: "x_re13_anointed",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "When king Devanampriya Priyadarsin had been anointed eight years, (the country of) the Kalingyas was conquered by (him).",
      locator: { label: "Rock Edict XIII (Kālsī version), translation, section A", page: "47" },
    },
    {
      op: "create_excerpt",
      ref: "x_re13_repentance",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "This is the repentance of Devanampriya on account of his conquest of (the country of) the Kalingyas.",
      locator: { label: "Rock Edict XIII (Kālsī version), translation, section D", page: "47" },
    },
    {
      op: "create_excerpt",
      ref: "x_re13_zealous",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "After that, now that (the country of) the Kalingyas has been taken, Devanampriya (is devoted) to a zealous study of morality, to the love of morality, and to the instruction (of people) in morality.",
      locator: { label: "Rock Edict XIII (Kālsī version), translation, section C", page: "47" },
    },
    {
      op: "create_excerpt",
      ref: "x_re13_kings",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "where the Yona king named Antiyoga (is ruling), and beyond this Antiyoga, (where) four kings (are ruling), (viz. the king) named Tulamaya, (the king) named Antekina, (the king) named Maka, (and the king) named Alikyashudala",
      locator: { label: "Rock Edict XIII (Kālsī version), translation, section Q", page: "48" },
    },
    {
      op: "create_excerpt",
      ref: "x_re13_morality_conquest",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "And this (conquest) has been won repeatedly by Devanampriya both [here] and among all (his) borderers, even as far as at (the distance of) six hundred yojanas",
      locator: { label: "Rock Edict XIII (Kālsī version), translation, section Q", page: "48" },
    },
    {
      op: "create_excerpt",
      ref: "x_hultzsch_synchronism",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "the mention of these five contemporaries in the inscriptions of king Devanampriya Priyadarsin confirms in a general way the correctness of Prinsep's identification of the latter with Asoka",
      locator: { label: "Introduction", page: "xxxi" },
    },
    {
      op: "create_excerpt",
      ref: "x_hultzsch_dates",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "his son Antiochus II Theos 261-246, Ptolemy II Philadelphia of Egypt 285-247, Antigonus Gonatas of Macedonia 276-239, Magas of Cyrene c. 300- c. 250, Alexander of Epirus 272-c. 255, and Alexander of Corinth 252-c. 244",
      locator: { label: "Introduction", page: "xxxi" },
      note: "“Philadelphia” is the OCR's reading of Philadelphus.",
    },
    {
      op: "create_excerpt",
      ref: "x_re2_medical",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "were established by king Devanampriya Priyadarsin, (viz.) medical treatment for men and medical treatment for cattle.",
      locator: { label: "Rock Edict II (Kālsī version), translation, section A", page: "29" },
    },
    {
      op: "create_excerpt",
      ref: "x_re2_herbs",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "Wherever there were no herbs beneficial to men and beneficial to cattle, everywhere they were caused to be imported and to be planted.",
      locator: { label: "Rock Edict II (Kālsī version), translation, section B", page: "29" },
    },
    {
      op: "create_excerpt",
      ref: "x_re2_roads",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "On the roads trees were planted, and wells were caused to be dug for the use of cattle and men.",
      locator: { label: "Rock Edict II (Kālsī version), translation, section D", page: "29" },
    },
    {
      op: "create_excerpt",
      ref: "x_pe7_banyan",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "On the roads banyan-trees were caused to be planted by me, (in order that) they might afford shade to cattle and men, (and) mango-groves were caused to be planted.",
      locator: { label: "Pillar Edict VII (Delhi-Topra), translation, section R", page: "133" },
    },
    {
      op: "create_excerpt",
      ref: "x_pe7_mahamatras",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "I have set up pillars of morality, appointed Mahamatras of morality, (and) issued [proclamations] on morality",
      locator: { label: "Pillar Edict VII (Delhi-Topra), translation, section P", page: "133" },
    },
    {
      op: "create_excerpt",
      ref: "x_rupnath",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "Two and a half years and somewhat more (have passed) since I am openly a Sakya. But (I had) not been very zealous. But a year and somewhat more (has passed) since I have visited the Samgha and have been very zealous.",
      locator: { label: "Rūpnāth minor rock edict, translation, sections B–D", page: "167" },
    },
    {
      op: "create_excerpt",
      ref: "x_rummindei_visit",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "When king Devanampriya Priyadarsin had been anointed twenty years, he came himself and worshipped (this spot), because the Buddha Sakyamuni was born here.",
      locator: { label: "Rummindei pillar inscription, translation, section A", page: "164" },
    },
    {
      op: "create_excerpt",
      ref: "x_rummindei_tax",
      source: "@s_hultzsch",
      snapshotId: s.hultzsch,
      quote:
        "(He) made the village of Lummini free of taxes, and paying (only) an eighth share (of the produce).",
      locator: { label: "Rummindei pillar inscription, translation, section C", page: "165" },
    },
    // McCrindle 1877
    {
      op: "create_excerpt",
      ref: "x_megas_slaves",
      source: "@s_mccrindle",
      snapshotId: s.mccrindle,
      quote:
        "remarkable fact about India, that all the Indians are free, and not one of them is a slave.",
      locator: { label: "Arrian, Indika X (citing Megasthenes)", page: "206" },
    },
    {
      op: "create_excerpt",
      ref: "x_megas_palibothra",
      source: "@s_mccrindle",
      snapshotId: s.mccrindle,
      quote:
        "the inhabited part of it stretched on either side to an extreme length of eighty stadia, and that its breadth was fifteen stadia, and that a ditch encompassed it all round, which was six plethra in breadth and thirty cubits in depth, and that the wall was crowned with five hundred and seventy towers and had four-and-sixty gates.",
      locator: { label: "Arrian, Indika X (citing Megasthenes on Palibothra)", page: "205" },
    },
    {
      op: "create_excerpt",
      ref: "x_megas_roads",
      source: "@s_mccrindle",
      snapshotId: s.mccrindle,
      quote:
        "They construct roads, and at every ten stadia set up a pillar to show the by-roads and distances.",
      locator: { label: "Megasthenes, Fragm. XXXIV (from Strabo XV.1.50)" },
    },
    {
      op: "create_excerpt",
      ref: "x_megas_sluices",
      source: "@s_mccrindle",
      snapshotId: s.mccrindle,
      quote:
        "Some superintend the rivers, measure the land, as is done in Egypt, and inspect the sluices by which water is let out from the main canals into their branches, so that every one may have an equal supply of it.",
      locator: { label: "Megasthenes, Fragm. XXXIV (from Strabo XV.1.50)" },
    },
    {
      op: "create_excerpt",
      ref: "x_megas_castes",
      source: "@s_mccrindle",
      snapshotId: s.mccrindle,
      quote:
        "The whole population of India is divided into seven castes, of which the first is formed by the collective body of the Philosophers",
      locator: { label: "Megasthenes, Fragm. I (from Diodorus II.40)", page: "40" },
    },
    // Shamasastry 1915
    {
      op: "create_excerpt",
      ref: "x_arth_slaves",
      source: "@s_shamasastry",
      snapshotId: s.shamasastry,
      quote:
        "It is no crime for Mlechchhas to sell or mortgage the life of their own offspring. But never shall an Arya be subjected to slavery.",
      locator: { label: "Book III, Chapter XIII, “Rules regarding slaves and labourers”" },
    },
    {
      op: "create_excerpt",
      ref: "x_arth_spies",
      source: "@s_shamasastry",
      snapshotId: s.shamasastry,
      quote:
        "the king shall proceed to create spies: —Spies under the guise of a fraudulent disciple (kapatika-chhatra), a recluse (udasthita), a householder (grihapaitika), a merchant (vaidehaka), an ascetic practising austerities (tapasa)",
      locator: { label: "Book I, Chapter XI, “The institution of spies”" },
    },
    {
      op: "create_excerpt",
      ref: "x_arth_sixth",
      source: "@s_shamasastry",
      snapshotId: s.shamasastry,
      quote:
        "first elected Manu, the Vaivasvata, to be their king; and allotted one-sixth of the grains grown and one-tenth of merchandise as sovereign dues.",
      locator: {
        label:
          "Book I, Chapter XIII, “Protection of parties for or against one's own cause in one's own state”",
      },
    },
    {
      op: "create_excerpt",
      ref: "x_arth_author",
      source: "@s_shamasastry",
      snapshotId: s.shamasastry,
      quote:
        "This Sastra has been made by him who from intolerance (of misrule) quickly rescued the scriptures and the science of weapons and the earth which had passed to the Nanda king.",
      locator: { label: "Book XV, Chapter I (closing verse)" },
    },
    {
      op: "create_excerpt",
      ref: "x_arth_compendium",
      source: "@s_shamasastry",
      snapshotId: s.shamasastry,
      quote:
        "This Arthasastra is made as a compendium of almost all the Arthasastras, which, in view of acquisition and maintenance of the earth, have been composed by ancient teachers.",
      locator: { label: "Book I, Chapter I (opening)" },
    },
    // Wikipedia (tertiary, verifiable against the pinned revision)
    {
      op: "create_excerpt",
      ref: "x_wp_founded",
      source: "@s_wp_maurya",
      snapshotId: s.wpMaurya.id,
      quote:
        "Founded by Chandragupta Maurya around c. 320 BCE, it existed in loose-knit fashion until 185 BCE.",
      locator: { section: "Lead" },
    },
    {
      op: "create_excerpt",
      ref: "x_wp_sources",
      source: "@s_wp_maurya",
      snapshotId: s.wpMaurya.id,
      quote:
        "The primary sources for the written records of the Mauryan times are partial records of the lost history of Megasthenes in Roman texts of several centuries later; and the Edicts of Ashoka.",
      locator: { section: "Lead" },
    },
    {
      op: "create_excerpt",
      ref: "x_wp_capital",
      source: "@s_wp_maurya",
      snapshotId: s.wpMaurya.id,
      quote: "The Mauryan capital (what is today Patna) was located in Magadha",
      locator: { section: "Lead" },
    },
    {
      op: "create_excerpt",
      ref: "x_wp_extent",
      source: "@s_wp_maurya",
      snapshotId: s.wpMaurya.id,
      quote:
        "During the rule of Chandragupta's grandson, Ashoka (ca. 268–232 BCE), the empire briefly controlled the major urban hubs and arteries of the subcontinent excepting the deep south.",
      locator: { section: "Lead" },
    },
    {
      op: "create_excerpt",
      ref: "x_wp_prinsep",
      source: "@s_wp_edicts",
      snapshotId: s.wpEdicts.id,
      quote:
        "In a series of results that he published in March 1838 Prinsep was able to translate the inscriptions on a large number of rock edicts found around India",
      locator: { section: "Decipherment" },
    },
    {
      op: "create_excerpt",
      ref: "x_wp_arth_date",
      source: "@s_wp_arthashastra",
      snapshotId: s.wpArthashastra.id,
      quote:
        "The authorship and date of writing are unknown, and there is evidence that the surviving manuscripts are not original, and are based on texts which were modified and edited in their history, but were most likely completed in the available form between the 1st and 3rd century CE.",
      locator: { section: "Structure, dating, and authorship" },
    },
    {
      op: "create_excerpt",
      ref: "x_wp_kangle_single",
      source: "@s_wp_arthashastra",
      snapshotId: s.wpArthashastra.id,
      quote:
        'While Kangle stated that "[i]t is not possible to point out any substantial parts of the present work as belonging to a later age or as the work of a later hand," early on philologists and text critics have proposed that the Arthashastra consisted of multiple layers of redaction.',
      locator: { section: "Single or multiple authorship" },
    },
    {
      op: "create_excerpt",
      ref: "x_wp_kangle_dasa",
      source: "@s_wp_slavery",
      snapshotId: s.wpSlavery.id,
      quote:
        "Kangle suggests that the context and rights granted to dasa by Kautilya implies that the word had a different meaning than the modern word slave, as well as the meaning of the word slave in Greek or other ancient and medieval civilizations.",
      locator: { section: "Slavery in Ancient India" },
    },
    // Copyrighted scholarship, by location only (as cited by Wikipedia)
    {
      op: "create_excerpt",
      ref: "x_olivelle_layers",
      source: "@s_olivelle",
      locator: { page: "3", pageEnd: "4", label: "Introduction" },
      note: "Location as given by Wikipedia's citation; not checked against the book.",
    },
    {
      op: "create_excerpt",
      ref: "x_trautmann",
      source: "@s_trautmann",
      locator: { page: "174" },
      note: "Location as given by Wikipedia's citation; not checked against the book.",
    },

    // ------------------------------------------------------------ claims
    {
      op: "create_claim",
      ref: "c_founded",
      text: "The Maurya Empire was founded by Chandragupta Maurya around 320 BCE and lasted, in loose-knit form, until 185 BCE.",
      kind: "fact",
      assessment: "supported",
      when: { start: { year: 320, era: "BCE", approximate: true }, end: { year: 185, era: "BCE" } },
      themes: ["overview", "polity"],
      entities: [{ entity: "maurya-empire" }, { entity: "@chandragupta", role: "participant" }],
      foundVia: [viaWikipedia("Maurya Empire", s.wpMaurya)],
      learning: {
        prompt: "Who founded the Maurya Empire, and roughly when did it end?",
        answer: "Chandragupta Maurya, around 320 BCE; it lasted until 185 BCE.",
      },
    },
    {
      op: "create_claim",
      ref: "c_capital",
      text: "The Maurya capital, Pāṭaliputra, lay in Magadha at what is today Patna.",
      kind: "fact",
      assessment: "supported",
      themes: ["overview", "polity", "infrastructure"],
      entities: [{ entity: "@pataliputra", role: "place" }, { entity: "maurya-empire" }],
      foundVia: [viaWikipedia("Maurya Empire", s.wpMaurya)],
      learning: {
        prompt: "What was the Maurya capital, and which modern city stands on it?",
        answer: "Pāṭaliputra, modern Patna.",
      },
    },
    {
      op: "create_claim",
      ref: "c_extent",
      text: "Under Aśoka the empire controlled the major cities and routes of the subcontinent, except the far south.",
      kind: "fact",
      assessment: "supported",
      themes: ["overview", "polity"],
      entities: [{ entity: "@ashoka" }, { entity: "maurya-empire" }],
      foundVia: [viaWikipedia("Maurya Empire", s.wpMaurya)],
    },
    {
      op: "create_claim",
      ref: "c_sources",
      text: "The main written sources for Mauryan times are Aśoka's own inscriptions and fragments of Megasthenes' lost account, preserved in Greek and Roman writers centuries later.",
      kind: "fact",
      assessment: "supported",
      themes: ["sources"],
      entities: [
        { entity: "maurya-empire" },
        { entity: "@megasthenes", role: "mention" },
        { entity: "@ashoka", role: "mention" },
      ],
      foundVia: [viaWikipedia("Maurya Empire", s.wpMaurya)],
      learning: {
        prompt: "What are the two main written sources for Mauryan times?",
        answer:
          "Aśoka's own inscriptions, and fragments of Megasthenes' lost account, preserved in Greek and Roman writers centuries later.",
      },
    },
    {
      op: "create_claim",
      ref: "c_kalinga_year",
      text: "Aśoka conquered Kalinga in the eighth year after his consecration.",
      kind: "fact",
      assessment: "supported",
      assessmentNote:
        "Aśoka's own statement in Rock Edict XIII. In absolute terms this is usually put around 261 BCE, which depends on the date of his consecration.",
      when: {
        start: { year: 261, era: "BCE", approximate: true },
        asStated: { text: "had been anointed eight years", calendar: "regnal" },
      },
      themes: ["war"],
      entities: [{ entity: "@kalinga_war" }, { entity: "@ashoka", role: "participant" }],
      learning: {
        prompt: "In which year after his consecration did Aśoka conquer Kalinga?",
        answer:
          "The eighth year after his consecration.",
      },
    },
    {
      op: "create_claim",
      ref: "c_kalinga_toll",
      text: "Rock Edict XIII puts the toll of the Kalinga conquest at 150,000 people deported and 100,000 killed, with many times that number dying.",
      kind: "fact",
      assessment: "supported",
      assessmentNote:
        "This is what the edict says. The figures are the king's own, in a text written to show remorse; there is no independent count.",
      themes: ["war"],
      entities: [{ entity: "@kalinga_war" }],
      learning: {
        prompt: "What toll does Rock Edict XIII give for the Kalinga conquest?",
        answer:
          "150,000 people deported and 100,000 killed, with many times that number dying.",
      },
    },
    {
      op: "create_claim",
      ref: "c_remorse",
      text: "Aśoka publicly declared his repentance for the suffering caused by the conquest of Kalinga.",
      kind: "fact",
      assessment: "supported",
      themes: ["war", "religion"],
      entities: [{ entity: "@ashoka" }, { entity: "@kalinga_war" }],
    },
    {
      op: "create_claim",
      ref: "c_dhamma_after",
      text: "After taking Kalinga, Aśoka says he devoted himself to the study, love and teaching of dhamma (morality).",
      kind: "fact",
      assessment: "supported",
      themes: ["religion", "war"],
      entities: [{ entity: "@ashoka" }],
    },
    {
      op: "create_claim",
      ref: "c_dhamma_conquest",
      text: "Aśoka claimed to have won a “conquest by morality” among his neighbours and as far as the Greek kingdoms of the west.",
      kind: "fact",
      assessment: "supported",
      assessmentNote: "The king's own claim, in his own inscription.",
      themes: ["polity", "religion"],
      entities: [{ entity: "@ashoka" }],
    },
    {
      op: "create_claim",
      ref: "c_greek_names",
      text: "Rock Edict XIII names a Greek (Yona) king, Antiyoga, and four kings beyond him: Tulamaya, Antekina, Maka and Alikyashudala.",
      kind: "fact",
      assessment: "supported",
      themes: ["polity", "sources"],
      entities: [{ entity: "@ashoka" }, { entity: "@kalsi", role: "place" }],
    },
    {
      op: "create_claim",
      ref: "c_greek_ids",
      text: "Scholars identify these kings with Antiochus II of Syria, Ptolemy II of Egypt, Antigonus Gonatas of Macedonia, Magas of Cyrene, and Alexander of Epirus or of Corinth.",
      kind: "interpretation",
      assessment: "supported",
      assessmentNote:
        "The identifications go back to the 19th century and are generally accepted; which Alexander is meant is debated.",
      themes: ["polity", "sources"],
      lenses: ["philological", "mainstream_academic"],
      entities: [{ entity: "@ashoka" }],
    },
    {
      op: "create_claim",
      ref: "c_synchronism",
      text: "Because these Hellenistic kings' reigns are known from Greek sources, the edict both confirms that its author is Aśoka and helps date his reign.",
      kind: "interpretation",
      assessment: "supported",
      themes: ["sources", "historiography"],
      lenses: ["philological"],
      entities: [{ entity: "@ashoka" }],
      learning: {
        prompt: "How do the Hellenistic kings named in the edict help historians?",
        answer:
          "Their reigns are known from Greek sources, so the edict broadly confirms that its author is Aśoka and helps date his reign.",
      },
    },
    {
      op: "create_claim",
      ref: "c_prinsep",
      text: "James Prinsep completed the decipherment of the Brāhmī script and published translations of the rock edicts in 1838.",
      kind: "fact",
      assessment: "supported",
      when: { start: { year: 1838, era: "CE", month: 3 } },
      themes: ["sources", "historiography"],
      foundVia: [viaWikipedia("Edicts of Ashoka", s.wpEdicts)],
    },
    {
      op: "create_claim",
      ref: "c_spies",
      text: "The Arthaśāstra prescribes a network of spies in disguise, such as recluses, householders, merchants and ascetics.",
      kind: "fact",
      assessment: "supported",
      assessmentNote:
        "This is what the text recommends. A treatise's prescriptions are not, by themselves, evidence of how the Mauryan state actually worked.",
      themes: ["governance"],
      entities: [{ entity: "@kautilya", role: "mention" }],
    },
    {
      op: "create_claim",
      ref: "c_sixth",
      text: "The Arthaśāstra justifies kingship as a bargain: people chose a king to end anarchy and allotted him one-sixth of their grain and one-tenth of merchandise.",
      kind: "fact",
      assessment: "supported",
      assessmentNote:
        "In the text this is a speech that the king's spies are told to make in public, so it is propaganda as well as theory.",
      themes: ["governance", "economy"],
    },
    {
      op: "create_claim",
      ref: "c_mahamatras",
      text: "Aśoka appointed special officers, the dhamma-mahāmātras (“ministers of morality”), and set up inscribed pillars to spread dhamma.",
      kind: "fact",
      assessment: "supported",
      themes: ["governance", "religion"],
      entities: [{ entity: "@ashoka" }, { entity: "@topra", role: "place" }],
    },
    {
      op: "create_claim",
      ref: "c_sluices",
      text: "Megasthenes describes officials who measured land and inspected the sluices that shared canal water fairly.",
      kind: "fact",
      assessment: "supported",
      assessmentNote:
        "Known only through Strabo's summary of Megasthenes, about three centuries later.",
      themes: ["governance", "infrastructure"],
      entities: [{ entity: "@megasthenes", role: "mention" }],
    },
    {
      op: "create_claim",
      ref: "c_road_pillars",
      text: "Megasthenes reports that officials built roads and set up a pillar every ten stadia to mark side roads and distances.",
      kind: "fact",
      assessment: "supported",
      themes: ["infrastructure"],
      entities: [{ entity: "@megasthenes", role: "mention" }],
    },
    {
      op: "create_claim",
      ref: "c_roads_trees",
      text: "Aśoka records having trees planted along roads and wells dug for the use of people and animals.",
      kind: "fact",
      assessment: "supported",
      themes: ["infrastructure"],
      entities: [{ entity: "@ashoka" }],
      learning: {
        prompt: "What does Aśoka say he did along the roads?",
        answer:
          "Planted trees (banyans for shade, mango groves) and had wells dug for people and animals.",
      },
    },
    {
      op: "create_claim",
      ref: "c_palibothra",
      text: "Megasthenes described Pāṭaliputra as about 80 stadia long and 15 wide, ringed by a moat and a wall with 570 towers and 64 gates.",
      kind: "fact",
      assessment: "supported",
      assessmentNote: "Megasthenes' description, as reported by Arrian about four centuries later.",
      themes: ["infrastructure"],
      entities: [
        { entity: "@pataliputra", role: "place" },
        { entity: "@megasthenes", role: "mention" },
      ],
      learning: {
        prompt: "How did Megasthenes describe the walls of Pāṭaliputra?",
        answer:
          "A wall with 570 towers and 64 gates, surrounded by a moat; the city about 80 by 15 stadia.",
      },
    },
    {
      op: "create_claim",
      ref: "c_medical",
      text: "Aśoka claims to have provided medical treatment for both people and animals, in his own lands and among neighbouring kings.",
      kind: "fact",
      assessment: "supported",
      themes: ["society"],
      entities: [{ entity: "@ashoka" }],
    },
    {
      op: "create_claim",
      ref: "c_herbs",
      text: "Where medicinal herbs, roots and fruits were lacking, Aśoka says he had them imported and planted.",
      kind: "fact",
      assessment: "supported",
      themes: ["society", "economy"],
      entities: [{ entity: "@ashoka" }],
    },
    {
      op: "create_claim",
      ref: "c_seven_classes",
      text: "Megasthenes divided Indian society into seven classes, with philosophers first.",
      kind: "fact",
      assessment: "supported",
      themes: ["society"],
      entities: [{ entity: "@megasthenes", role: "mention" }],
    },
    {
      op: "create_claim",
      ref: "c_upasaka",
      text: "By his own account, Aśoka had been a lay Buddhist for over two and a half years but was not very zealous at first; he became zealous only after visiting the Saṅgha, more than a year before the edict.",
      kind: "fact",
      assessment: "supported",
      themes: ["religion"],
      entities: [{ entity: "@ashoka" }, { entity: "@rupnath", role: "place" }],
      learning: {
        prompt: "What does Aśoka's minor rock edict say about how he became a zealous Buddhist?",
        answer:
          "He had been a lay Buddhist for over two and a half years, not very zealous at first, and became zealous after visiting the Saṅgha.",
      },
    },
    {
      op: "create_claim",
      ref: "c_lumbini_visit",
      text: "In the twentieth year after his consecration, Aśoka visited Lumbinī, the Buddha's birthplace, and set up a stone pillar there.",
      kind: "fact",
      assessment: "supported",
      when: {
        start: { year: 249, era: "BCE", approximate: true },
        asStated: { text: "had been anointed twenty years", calendar: "regnal" },
      },
      themes: ["religion"],
      entities: [{ entity: "@lumbini", role: "place" }, { entity: "@ashoka" }],
    },
    {
      op: "create_claim",
      ref: "c_lumbini_tax",
      text: "Aśoka exempted the village of Lumbinī from taxes and reduced its share of produce owed to one-eighth.",
      kind: "fact",
      assessment: "supported",
      themes: ["economy", "religion"],
      entities: [{ entity: "@lumbini", role: "place" }],
      learning: {
        prompt: "What tax concession did Aśoka grant at Lumbinī?",
        answer: "He freed the village from taxes and set its share of produce at one-eighth.",
      },
    },
    {
      op: "create_claim",
      ref: "c_arth_self",
      text: "The Arthaśāstra presents itself as the work of the man who rescued the land from the Nanda king, and as a digest of earlier treatises.",
      kind: "fact",
      assessment: "supported",
      themes: ["sources", "historiography"],
      lenses: ["primary_source"],
      entities: [{ entity: "@kautilya", role: "mention" }],
    },
    {
      op: "create_claim",
      ref: "c_kangle_single",
      text: "R. P. Kangle held that no substantial part of the surviving Arthaśāstra can be shown to be later than the rest.",
      kind: "interpretation",
      assessment: "supported",
      themes: ["sources", "historiography"],
      lenses: ["philological"],
      foundVia: [viaWikipedia("Arthashastra", s.wpArthashastra)],
    },
    {
      op: "create_claim",
      ref: "c_arth_layers",
      text: "Most text-critical scholarship holds that the surviving Arthaśāstra was revised over time and reached its present form between the 1st and 3rd centuries CE.",
      kind: "interpretation",
      assessment: "supported",
      assessmentNote:
        "Based on stylistic and statistical analysis (Trautmann 1971) and on the text's structure (Olivelle 2013). Those books are cited here by location only.",
      themes: ["sources", "historiography"],
      lenses: ["philological", "mainstream_academic"],
      foundVia: [viaWikipedia("Arthashastra", s.wpArthashastra)],
    },
    {
      op: "create_claim",
      ref: "c_megas_no_slaves",
      text: "Arrian, citing Megasthenes, says that all Indians are free and none of them is a slave.",
      kind: "fact",
      assessment: "supported",
      themes: ["society"],
      entities: [{ entity: "@megasthenes", role: "mention" }],
    },
    {
      op: "create_claim",
      ref: "c_arth_slaves",
      text: "The Arthaśāstra has a chapter of rules on dāsas (slaves) and labourers, forbidding the enslavement of an Ārya while allowing others to sell or pledge their children.",
      kind: "fact",
      assessment: "supported",
      themes: ["society"],
    },
    {
      op: "create_claim",
      ref: "c_kangle_dasa",
      text: "Kangle argued that the rights the Arthaśāstra gives a dāsa show the word did not mean a slave in the Greek sense.",
      kind: "interpretation",
      assessment: "supported",
      themes: ["society", "historiography"],
      lenses: ["philological"],
      foundVia: [viaWikipedia("Slavery in India", s.wpSlavery)],
    },

    // Misconceptions
    {
      op: "create_claim",
      ref: "m_sudden_conversion",
      text: "Aśoka became a Buddhist suddenly, in a moment of horror on the battlefield of Kalinga.",
      kind: "misconception",
      assessment: "weak",
      assessmentNote:
        "A popular retelling. The edicts cited here describe remorse after the conquest and a commitment that deepened over years, not a moment of conversion on the battlefield.",
      themes: ["religion", "war"],
      lenses: ["popular"],
      entities: [{ entity: "@ashoka" }, { entity: "@kalinga_war" }],
    },
    {
      op: "create_claim",
      ref: "m_no_slavery",
      text: "Megasthenes said no Indian was a slave, so there was no slavery in Mauryan India.",
      kind: "misconception",
      assessment: "refuted",
      assessmentNote:
        "Megasthenes' remark is real, but the Arthaśāstra legislates in detail for dāsas. What the word meant, and how far it matches Greek slavery, is debated.",
      themes: ["society"],
      lenses: ["popular"],
    },
    {
      op: "create_claim",
      ref: "m_arth_chanakya",
      text: "The Arthaśāstra as we have it was written by Chanakya in the 4th century BCE as a handbook for Chandragupta.",
      kind: "misconception",
      assessment: "contested",
      assessmentNote:
        "This is the traditional attribution and the text supports it in part, but most text critics think the surviving version was revised and completed centuries later. A real debate, not settled.",
      themes: ["sources", "historiography"],
      lenses: ["popular", "nationalist"],
      entities: [{ entity: "@kautilya" }],
    },

    // ------------------------------------------------------------ citations
    { op: "cite", claim: "@c_founded", excerpt: "@x_wp_founded", stance: "supports" },
    { op: "cite", claim: "@c_capital", excerpt: "@x_wp_capital", stance: "supports" },
    { op: "cite", claim: "@c_extent", excerpt: "@x_wp_extent", stance: "supports" },
    { op: "cite", claim: "@c_sources", excerpt: "@x_wp_sources", stance: "supports" },
    { op: "cite", claim: "@c_kalinga_year", excerpt: "@x_re13_anointed", stance: "supports" },
    { op: "cite", claim: "@c_kalinga_toll", excerpt: "@x_re13_conquest", stance: "supports" },
    { op: "cite", claim: "@c_remorse", excerpt: "@x_re13_repentance", stance: "supports" },
    { op: "cite", claim: "@c_dhamma_after", excerpt: "@x_re13_zealous", stance: "supports" },
    {
      op: "cite",
      claim: "@c_dhamma_conquest",
      excerpt: "@x_re13_morality_conquest",
      stance: "supports",
    },
    { op: "cite", claim: "@c_dhamma_conquest", excerpt: "@x_re13_kings", stance: "supports" },
    { op: "cite", claim: "@c_greek_names", excerpt: "@x_re13_kings", stance: "supports" },
    { op: "cite", claim: "@c_greek_ids", excerpt: "@x_hultzsch_dates", stance: "supports" },
    { op: "cite", claim: "@c_greek_ids", excerpt: "@x_hultzsch_synchronism", stance: "supports" },
    { op: "cite", claim: "@c_synchronism", excerpt: "@x_hultzsch_synchronism", stance: "supports" },
    { op: "cite", claim: "@c_synchronism", excerpt: "@x_hultzsch_dates", stance: "supports" },
    { op: "cite", claim: "@c_prinsep", excerpt: "@x_wp_prinsep", stance: "supports" },
    { op: "cite", claim: "@c_spies", excerpt: "@x_arth_spies", stance: "supports" },
    { op: "cite", claim: "@c_sixth", excerpt: "@x_arth_sixth", stance: "supports" },
    { op: "cite", claim: "@c_mahamatras", excerpt: "@x_pe7_mahamatras", stance: "supports" },
    { op: "cite", claim: "@c_sluices", excerpt: "@x_megas_sluices", stance: "supports" },
    { op: "cite", claim: "@c_road_pillars", excerpt: "@x_megas_roads", stance: "supports" },
    { op: "cite", claim: "@c_roads_trees", excerpt: "@x_re2_roads", stance: "supports" },
    { op: "cite", claim: "@c_roads_trees", excerpt: "@x_pe7_banyan", stance: "supports" },
    { op: "cite", claim: "@c_palibothra", excerpt: "@x_megas_palibothra", stance: "supports" },
    { op: "cite", claim: "@c_medical", excerpt: "@x_re2_medical", stance: "supports" },
    { op: "cite", claim: "@c_herbs", excerpt: "@x_re2_herbs", stance: "supports" },
    { op: "cite", claim: "@c_seven_classes", excerpt: "@x_megas_castes", stance: "supports" },
    { op: "cite", claim: "@c_upasaka", excerpt: "@x_rupnath", stance: "supports" },
    { op: "cite", claim: "@c_lumbini_visit", excerpt: "@x_rummindei_visit", stance: "supports" },
    { op: "cite", claim: "@c_lumbini_tax", excerpt: "@x_rummindei_tax", stance: "supports" },
    { op: "cite", claim: "@c_arth_self", excerpt: "@x_arth_author", stance: "supports" },
    { op: "cite", claim: "@c_arth_self", excerpt: "@x_arth_compendium", stance: "supports" },
    { op: "cite", claim: "@c_kangle_single", excerpt: "@x_wp_kangle_single", stance: "supports" },
    { op: "cite", claim: "@c_arth_layers", excerpt: "@x_wp_arth_date", stance: "supports" },
    {
      op: "cite",
      claim: "@c_arth_layers",
      excerpt: "@x_wp_kangle_single",
      stance: "qualifies",
      note: "Kangle disagreed.",
    },
    { op: "cite", claim: "@c_arth_layers", excerpt: "@x_olivelle_layers", stance: "supports" },
    { op: "cite", claim: "@c_arth_layers", excerpt: "@x_trautmann", stance: "supports" },
    { op: "cite", claim: "@c_megas_no_slaves", excerpt: "@x_megas_slaves", stance: "supports" },
    { op: "cite", claim: "@c_arth_slaves", excerpt: "@x_arth_slaves", stance: "supports" },
    { op: "cite", claim: "@c_kangle_dasa", excerpt: "@x_wp_kangle_dasa", stance: "supports" },
    { op: "cite", claim: "@m_sudden_conversion", excerpt: "@x_rupnath", stance: "contradicts" },
    {
      op: "cite",
      claim: "@m_no_slavery",
      excerpt: "@x_megas_slaves",
      stance: "mentions",
      note: "The source of the belief.",
    },
    { op: "cite", claim: "@m_no_slavery", excerpt: "@x_arth_slaves", stance: "contradicts" },
    {
      op: "cite",
      claim: "@m_arth_chanakya",
      excerpt: "@x_arth_author",
      stance: "supports",
      note: "The text's own attribution.",
    },
    { op: "cite", claim: "@m_arth_chanakya", excerpt: "@x_wp_arth_date", stance: "contradicts" },

    // ------------------------------------------------------------ relations
    { op: "relate_claims", from: "@c_upasaka", to: "@m_sudden_conversion", type: "corrects" },
    {
      op: "relate_claims",
      from: "@c_dhamma_after",
      to: "@m_sudden_conversion",
      type: "qualifies",
      note: "The edict links his devotion to dhamma to the aftermath of Kalinga, not to the battle itself.",
    },
    { op: "relate_claims", from: "@c_arth_slaves", to: "@m_no_slavery", type: "corrects" },
    { op: "relate_claims", from: "@c_kangle_dasa", to: "@m_no_slavery", type: "context_for" },
    { op: "relate_claims", from: "@c_arth_layers", to: "@m_arth_chanakya", type: "corrects" },
    { op: "relate_claims", from: "@c_kangle_single", to: "@c_arth_layers", type: "contradicts" },
    { op: "relate_claims", from: "@c_greek_ids", to: "@c_synchronism", type: "supports" },
    { op: "relate_claims", from: "@c_kalinga_year", to: "@c_kalinga_toll", type: "context_for" },
  ];

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      theme: "overview",
      markdown:
        "[Founded by Chandragupta Maurya around 320 BCE](claim:@c_founded), the Maurya Empire ruled from [Pāṭaliputra](entity:pataliputra), at modern Patna, and [under Aśoka controlled the main cities and routes of the subcontinent except the far south](claim:@c_extent). It is the first Indian empire we can see in the words of its own ruler, through the inscriptions Aśoka had cut into rocks and pillars. Almost everything else comes from [a Greek envoy's lost book, quoted centuries later](claim:@c_sources), and from a treatise on statecraft [whose date is still argued over](claim:@c_arth_layers).",
    },
    {
      id: "keyfacts",
      type: "key_facts",
      theme: "overview",
      title: "Key facts",
      claimIds: ["@c_founded", "@c_capital", "@c_kalinga_year", "@c_upasaka", "@c_sources"],
    },
    {
      id: "timeline",
      type: "viz",
      theme: "overview",
      viz: { kind: "timeline", linkedTo: "maurya-empire" },
      caption: "People, events and inscriptions linked to the empire.",
    },
    {
      id: "map",
      type: "viz",
      theme: "overview",
      viz: { kind: "map", linkedTo: "maurya-empire" },
      caption: "Places on this page. Dotted outlines and faded points are uncertain locations.",
    },

    {
      id: "h-war",
      type: "heading",
      theme: "war",
      text: "Kalinga and the turn to dhamma",
      level: 2,
    },
    {
      id: "war-prose",
      type: "prose",
      theme: "war",
      markdown:
        "The one war we know from the winner's own account is [Kalinga, conquered in the eighth year after Aśoka's consecration](claim:@c_kalinga_year). In Rock Edict XIII he gives the toll and then, unusually for a king, [declares his repentance](claim:@c_remorse).",
    },
    {
      id: "war-claims",
      type: "claims",
      theme: "war",
      claimIds: ["@c_kalinga_year", "@c_kalinga_toll", "@c_remorse", "@c_dhamma_after"],
    },
    {
      id: "war-quote",
      type: "quote",
      theme: "war",
      excerptId: "@x_re13_conquest",
      caption: "Rock Edict XIII, in Hultzsch's 1925 translation.",
    },

    {
      id: "h-world",
      type: "heading",
      theme: "polity",
      text: "The empire and the Greek world",
      level: 2,
    },
    {
      id: "world-claims",
      type: "claims",
      theme: "polity",
      claimIds: ["@c_dhamma_conquest", "@c_greek_names", "@c_greek_ids"],
    },

    { id: "h-gov", type: "heading", theme: "governance", text: "Government", level: 2 },
    {
      id: "gov-prose",
      type: "prose",
      theme: "governance",
      markdown:
        "Two very different kinds of evidence describe Mauryan government. The edicts show what Aśoka wanted known: [new officers to spread dhamma](claim:@c_mahamatras). The Arthaśāstra describes how a king should rule, [down to the disguises his spies should wear](claim:@c_spies).",
    },
    {
      id: "gov-claims",
      type: "claims",
      theme: "governance",
      claimIds: ["@c_mahamatras", "@c_spies", "@c_sixth", "@c_sluices"],
    },
    {
      id: "gov-method",
      type: "callout",
      theme: "governance",
      tone: "method",
      markdown:
        "Read the Arthaśāstra as a manual of what a king *should* do, not a record of what the Mauryas did. Its date is also uncertain (see How we know), so using it to describe Mauryan government is itself a choice.",
    },

    {
      id: "h-infra",
      type: "heading",
      theme: "infrastructure",
      text: "Roads, wells and the capital",
      level: 2,
    },
    {
      id: "infra-claims",
      type: "claims",
      theme: "infrastructure",
      claimIds: ["@c_roads_trees", "@c_road_pillars", "@c_palibothra", "@c_capital"],
    },

    { id: "h-society", type: "heading", theme: "society", text: "Health and society", level: 2 },
    {
      id: "society-claims",
      type: "claims",
      theme: "society",
      claimIds: ["@c_medical", "@c_herbs", "@c_seven_classes"],
    },

    { id: "h-religion", type: "heading", theme: "religion", text: "Aśoka's Buddhism", level: 2 },
    {
      id: "religion-claims",
      type: "claims",
      theme: "religion",
      claimIds: ["@c_upasaka", "@c_lumbini_visit", "@c_lumbini_tax", "@c_dhamma_after"],
    },

    { id: "h-sources", type: "heading", theme: "sources", text: "How we know", level: 2 },
    {
      id: "sources-prose",
      type: "prose",
      theme: "sources",
      markdown:
        "Most of the edicts name their author only as “Devānaṃpiya Piyadasi”. [Prinsep deciphered the script](claim:@c_prinsep) in the 1830s and identified the king with Aśoka; [the Greek kings named in Rock Edict XIII](claim:@c_greek_names) [confirm the identification and anchor his dates](claim:@c_synchronism).",
    },
    {
      id: "sources-claims",
      type: "claims",
      theme: "sources",
      claimIds: ["@c_sources", "@c_prinsep", "@c_synchronism"],
    },
    {
      id: "arth-debate",
      type: "debate",
      theme: "sources",
      question: "When was the Arthaśāstra written, and by whom?",
      positions: [
        {
          label: "Kauṭilya, in Chandragupta's time",
          claimIds: ["@c_arth_self", "@c_kangle_single"],
        },
        { label: "A text revised over centuries", claimIds: ["@c_arth_layers"] },
      ],
      note: "Both sides agree the text draws on earlier treatises and contains later glosses. The disagreement is over how much of it is a single author's work.",
    },

    { id: "h-myths", type: "heading", text: "Common misconceptions", level: 2 },
    {
      id: "myth-conversion",
      type: "misconception",
      theme: "religion",
      claimId: "@m_sudden_conversion",
      correctionIds: ["@c_upasaka", "@c_dhamma_after"],
    },
    {
      id: "myth-slavery",
      type: "misconception",
      theme: "society",
      claimId: "@m_no_slavery",
      correctionIds: ["@c_megas_no_slaves", "@c_arth_slaves", "@c_kangle_dasa"],
    },
    {
      id: "myth-arthashastra",
      type: "misconception",
      theme: "sources",
      claimId: "@m_arth_chanakya",
      correctionIds: ["@c_arth_layers", "@c_arth_self"],
    },
  ];

  ops.push({
    op: "create_page",
    slug: "maurya-empire",
    title: "Maurya Empire",
    kind: "era",
    entity: "maurya-empire",
    summary:
      "The first empire to rule most of the subcontinent, c. 322–185 BCE, seen through Aśoka's edicts, Megasthenes and the Arthaśāstra.",
    blocks,
    status: "published",
    position: 5,
  });
  return ops;
}
