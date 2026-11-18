import type { BlockInput, ChangeOpInput, DateInput } from "@pramana/core";
import type { Mcp } from "./mcp";

/**
 * The spine: the ages of Indian history as dated entities, and the overview
 * page that shows them on one timeline. Identity and multilingual names come
 * from Wikidata; the period boundaries are editorial (stated as such), because
 * periodisation is a convention, not a fact.
 */

const CONVENTIONAL =
  "Conventional periodisation used in survey histories; boundaries are approximate and debated.";

interface Era {
  ref: string;
  slug: string;
  label: string;
  kind: "period" | "polity" | "culture";
  wikipedia?: string;
  when: DateInput;
  description: string;
}

const bce = (year: number, approximate = true) => ({ year, era: "BCE" as const, approximate });
const ce = (year: number, approximate = true) => ({ year, era: "CE" as const, approximate });

export const ERAS: Era[] = [
  {
    ref: "era_neolithic",
    slug: "early-farming-communities",
    label: "Early farming communities",
    kind: "culture",
    wikipedia: "Mehrgarh",
    when: {
      start: bce(7000),
      end: bce(2600),
      basis: "Radiocarbon dates from Mehrgarh and related sites; " + CONVENTIONAL,
    },
    description:
      "Neolithic villages such as Mehrgarh, where farming and herding are attested in South Asia.",
  },
  {
    ref: "era_harappan",
    slug: "harappan-civilisation",
    label: "Harappan civilisation",
    kind: "culture",
    wikipedia: "Indus Valley Civilisation",
    when: {
      start: bce(3300),
      end: bce(1300),
      label: "c. 3300–1300 BCE (mature phase c. 2600–1900 BCE)",
      basis: "Archaeological phasing; " + CONVENTIONAL,
    },
    description: "The Bronze Age urban civilisation of the Indus and Ghaggar-Hakra river systems.",
  },
  {
    ref: "era_vedic",
    slug: "vedic-period",
    label: "Vedic period",
    kind: "period",
    wikipedia: "Vedic period",
    when: {
      start: bce(1500),
      end: bce(500),
      basis: "Dated mainly from the relative chronology of the Vedic texts; " + CONVENTIONAL,
    },
    description:
      "The age in which the Vedic texts were composed, in the north-west and then the Ganga plain.",
  },
  {
    ref: "era_mahajanapadas",
    slug: "mahajanapadas",
    label: "Mahājanapadas",
    kind: "period",
    wikipedia: "Mahajanapadas",
    when: { start: bce(600), end: bce(322), basis: CONVENTIONAL },
    description:
      "Sixteen great states of the Ganga plain and beyond; the age of the Buddha and Mahāvīra.",
  },
  {
    ref: "era_maurya",
    slug: "maurya-empire",
    label: "Maurya Empire",
    kind: "polity",
    wikipedia: "Maurya Empire",
    when: {
      start: bce(322),
      end: bce(185),
      basis: "Wikidata Q62943 (inception/dissolved); the founding year is approximate.",
    },
    description: "The first empire to rule most of the subcontinent, from Pāṭaliputra.",
  },
  {
    ref: "era_middle",
    slug: "middle-kingdoms",
    label: "Middle kingdoms",
    kind: "period",
    wikipedia: "Middle kingdoms of India",
    when: { start: bce(185), end: ce(320), basis: CONVENTIONAL },
    description:
      "Śuṅgas, Sātavāhanas, Indo-Greeks, Śakas and Kuṣāṇas, between the Mauryas and the Guptas.",
  },
  {
    ref: "era_gupta",
    slug: "gupta-empire",
    label: "Gupta Empire",
    kind: "polity",
    wikipedia: "Gupta Empire",
    when: { start: ce(320), end: ce(550), basis: "Gupta era begins 319/320 CE; " + CONVENTIONAL },
    description: "The north Indian empire often associated with classical Sanskrit culture.",
  },
  {
    ref: "era_early_medieval",
    slug: "early-medieval-india",
    label: "Early medieval India",
    kind: "period",
    when: { start: ce(550), end: ce(1200), basis: CONVENTIONAL },
    description:
      "Regional kingdoms such as the Pallavas, Cāḷukyas, Pālas, Pratihāras, Rāṣṭrakūṭas and Cōḷas.",
  },
  {
    ref: "era_sultanate",
    slug: "delhi-sultanate",
    label: "Delhi Sultanate",
    kind: "polity",
    wikipedia: "Delhi Sultanate",
    when: {
      start: ce(1206, false),
      end: ce(1526, false),
      basis: "From Qutb ud-Din Aibak's accession to the battle of Panipat.",
    },
    description: "Successive dynasties ruling from Delhi, from the Mamluks to the Lodis.",
  },
  {
    ref: "era_vijayanagara",
    slug: "vijayanagara-empire",
    label: "Vijayanagara Empire",
    kind: "polity",
    wikipedia: "Vijayanagara Empire",
    when: { start: ce(1336), end: ce(1646), basis: "Traditional founding date; " + CONVENTIONAL },
    description: "The south Indian empire centred on Hampi.",
  },
  {
    ref: "era_mughal",
    slug: "mughal-empire",
    label: "Mughal Empire",
    kind: "polity",
    wikipedia: "Mughal Empire",
    when: {
      start: ce(1526, false),
      end: ce(1857, false),
      label: "1526–1857 (effective power waned after c. 1720)",
      basis: "From the battle of Panipat to the deposition of Bahadur Shah II.",
    },
    description: "The empire founded by Babur; at its height it ruled most of the subcontinent.",
  },
  {
    ref: "era_maratha",
    slug: "maratha-confederacy",
    label: "Maratha Confederacy",
    kind: "polity",
    wikipedia: "Maratha Confederacy",
    when: {
      start: ce(1674, false),
      end: ce(1818, false),
      basis: "From Shivaji's coronation to the Third Anglo-Maratha War.",
    },
    description: "The Maratha state founded by Shivaji, later a confederacy led by the Peshwas.",
  },
  {
    ref: "era_company",
    slug: "company-rule",
    label: "Company rule",
    kind: "period",
    wikipedia: "Company rule in India",
    when: {
      start: ce(1757, false),
      end: ce(1858, false),
      basis: "From the battle of Plassey to the Government of India Act 1858.",
    },
    description: "Rule by the English East India Company.",
  },
  {
    ref: "era_raj",
    slug: "british-raj",
    label: "British Raj",
    kind: "polity",
    wikipedia: "British Raj",
    when: {
      start: ce(1858, false),
      end: { year: 1947, era: "CE", month: 8, day: 14 },
      basis: "Government of India Act 1858 to Independence.",
    },
    description: "Direct rule by the British Crown.",
  },
  {
    ref: "era_republic",
    slug: "independent-india",
    label: "Independent India",
    kind: "polity",
    when: {
      edtf: "1947-08-15/..",
      label: "from 15 August 1947 (a republic from 26 January 1950)",
      basis: "Indian Independence Act 1947; Constitution of India 1950.",
    },
    description: "India since Independence and Partition.",
  },
];

export async function spineOps(mcp: Mcp): Promise<ChangeOpInput[]> {
  const ops: ChangeOpInput[] = [];
  for (const era of ERAS) {
    let wikidataId: string | undefined;
    let aliases: { label: string; lang?: string; script?: string; note?: string }[] = [];
    if (era.wikipedia) {
      const wd = await mcp.call<{ qid: string; aliases: typeof aliases } | null>("wikidata", {
        wikipediaTitle: era.wikipedia,
      });
      if (wd) {
        wikidataId = wd.qid;
        aliases = wd.aliases
          .filter((a) => a.label.toLowerCase() !== era.label.toLowerCase())
          .slice(0, 8);
      }
    }
    if (era.slug === "harappan-civilisation") {
      // Names carry stances here; say who uses which.
      aliases = [
        {
          label: "Indus Valley Civilisation",
          lang: "en",
          note: "The most common name in international scholarship, after the river system where it was first found.",
        },
        {
          label: "Sindhu-Sarasvati Civilisation",
          lang: "en",
          note: "Used by some Indian scholars and in some Indian textbooks; it identifies the Ghaggar-Hakra with the Rigvedic Sarasvati river, which is debated.",
        },
        ...aliases.filter((a) => !/indus valley|saraswati|sarasvati/i.test(a.label)),
      ];
    }
    ops.push({
      op: "create_entity",
      ref: era.ref,
      slug: era.slug,
      kind: era.kind,
      label: era.label,
      description: era.description,
      when: era.when,
      ...(aliases.length ? { aliases } : {}),
      ...(wikidataId ? { wikidataId } : {}),
    });
  }

  const blocks: BlockInput[] = [
    {
      id: "intro",
      type: "prose",
      markdown:
        "This is the spine of the site: the ages historians commonly use to organise Indian history, from the first farming villages to the present. Each age gets its own page as it is written. Start with the [Maurya Empire](page:maurya-empire), the first page with its evidence fully attached.",
    },
    {
      id: "timeline",
      type: "viz",
      viz: { kind: "timeline", entityIds: ERAS.map((e) => `@${e.ref}`) },
      caption: "Drag to move through time. Soft ends mean the boundary is approximate.",
    },
    {
      id: "periodisation",
      type: "callout",
      tone: "method",
      markdown:
        "Ages are a convenience, not a fact. Their names and boundaries are choices historians make, and some choices carry arguments with them: naming periods by religion, for example, or by a single river. Each boundary here records how it was set.",
    },
    { id: "ages", type: "entities", title: "Ages", entityIds: ERAS.map((e) => `@${e.ref}`) },
  ];

  ops.push({
    op: "create_page",
    slug: "ages-of-indian-history",
    title: "Ages of Indian history",
    kind: "overview",
    summary: "From the first farming villages to the present, as one timeline.",
    blocks,
    status: "published",
    position: 0,
  });
  return ops;
}
