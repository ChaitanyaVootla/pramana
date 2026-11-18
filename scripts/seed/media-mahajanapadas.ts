/**
 * Pictures for the Mahājanapadas page, proposed THROUGH MCP as the agent
 * acting for the local user: media records for hand-checked Wikimedia Commons
 * files (licence, author and credit read from the API by the MCP server, never
 * typed here), then figures and galleries placed after the chapter prose whose
 * claims they show, and a lead image.
 *
 *   pnpm tsx scripts/seed/media-mahajanapadas.ts            # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --depends-on=<id>   # a pending changeset that creates the depicted entities
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Almost nothing visible survives from the Buddha's own time: the sites of
 * his life are marked by monuments built centuries later, and the captions say
 * so. The Bharhut relief of Ajātasattu is a later depiction of a story, not a
 * record. Persian reliefs and inscriptions are of the period itself.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const PICKS: Pick[] = [
  {
    file: "File:Cyclopean Wall of Rajgir.jpg",
    ref: "j_rajgir_wall",
    title: "The old stone wall of Rājgīr",
    alt: "A long wall of rough, unmortared stones running up a scrubby hillside.",
    representation: "photograph_of_site",
    depicts: ["rajagaha"],
  },
  {
    file: "File:NBPW fragments BM.jpg",
    ref: "j_nbpw",
    title: "Northern Black Polished Ware",
    alt: "Shards of thin, glossy black pottery laid out in a museum case.",
    representation: "photograph_of_object",
    depicts: ["northern-black-polished-ware", "kosambi"],
  },
  {
    file: "File:Ananda Stupa with Ashok lion pillar at vaishali, Bihar 03.jpg",
    ref: "j_vesali",
    title: "Vaishali: a stupa and a later pillar",
    alt: "The brick mound of a ruined stupa beside a tall stone pillar topped by a lion, among excavated brick foundations.",
    representation: "photograph_of_site",
    depicts: ["vesali"],
  },
  {
    file: "File:007 Ajatasatru Worships the Buddha.jpg",
    ref: "j_ajatasattu_relief",
    title: "Ajātasattu visits the Buddha, a Bharhut relief",
    alt: "A carved stone railing pillar: a crowd of figures, in several panels, gathered before a seat under a canopy.",
    representation: "later_imagining",
    representationNote:
      "Carved at Bharhut in the 2nd or 1st century BCE, long after the events; the Buddha is shown by a symbol, not in human form. Indian Museum, Kolkata.",
    depicts: ["ajatasattu"],
  },
  {
    file: "File:Mahabodhi Temple South Side.jpg",
    ref: "j_bodh_gaya",
    title: "Bodh Gaya: the Mahābodhi temple",
    alt: "Monks in orange robes sitting in a stone-railed courtyard at the foot of a carved temple wall.",
    representation: "photograph_of_site",
    depicts: ["bodh-gaya"],
  },
  {
    file: "File:Dhamek Stupa, 2025.jpg",
    ref: "j_sarnath_dhamek",
    title: "Sarnath: the Dhamek stupa",
    alt: "A tall cylindrical stupa of stone and brick standing on a lawn under a cloudy sky.",
    representation: "photograph_of_site",
    depicts: ["sarnath"],
  },
  {
    file: "File:Parinirvana stupa of Kushinagar.jpg",
    ref: "j_kusinara",
    title: "Kushinagar: the Parinirvāṇa temple and stupa",
    alt: "A white domed stupa and an adjoining temple reflected in a pond, under a cloudy sky.",
    representation: "photograph_of_site",
    depicts: ["kusinara"],
  },
  {
    file: "File:Behistun inscription reliefs.jpg",
    ref: "j_behistun",
    title: "Darius I's relief and inscription at Behistun",
    alt: "A rock-cut relief: a king with attendants faces a line of bound captives under a winged symbol, with panels of cuneiform text around them.",
    representation: "photograph_of_object",
    needsUsBasis: true,
    depicts: ["behistun-inscription", "darius-i"],
  },
  {
    file: "File:Apadana Palace Indians.jpg",
    ref: "j_apadana_indians",
    title: "Indian tribute bearers at Persepolis",
    alt: "A long stone relief of men in short kilts walking in procession, one leading an animal, others carrying vessels and tools.",
    representation: "photograph_of_object",
    representationNote: "On the Apadāna stairway at Persepolis. The delegation is identified as Indian by its place among the Persian empire's peoples.",
    depicts: ["achaemenid-empire"],
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "sixteen-prose",
    block: {
      id: "fig-rajgir-wall",
      type: "figure",
      media: "j_rajgir_wall",
      caption:
        "The rough stone wall that runs over the hills around Rājgīr, the old [Magadhan capital Rājagaha]({claim:The four kingdoms were Magadha (capital Rājagaha)}). It is usually thought early, but it has not been closely dated.",
    },
  },
  {
    after: "cities-prose",
    block: {
      id: "gal-cities",
      type: "gallery",
      items: [
        {
          media: "j_nbpw",
          caption:
            "Shards of [Northern Black Polished Ware, the black polished pottery that marks the new towns]({claim:From about 600 BCE towns grew up again}), from Kosambī and Rajghat. British Museum.",
        },
        {
          media: "j_vesali",
          caption:
            "Vaishali today: a ruined stupa, and a pillar of Aśoka's time set up two centuries after the Buddha. Vesālī was [the only great city of the free clans]({claim:Vesālī, Rhys Davids noted}).",
        },
      ],
    },
  },
  {
    after: "magadha-prose",
    block: {
      id: "fig-ajatasattu",
      type: "figure",
      media: "j_ajatasattu_relief",
      caption:
        "Ajātasattu comes to the Buddha, as a Bharhut sculptor imagined it centuries later. In the sutta [he confesses to having killed his father]({claim:Buddhist tradition says Ajātasattu killed his father}); [Jain scripture tells it differently]({claim:Jain scripture tells it differently}).",
    },
  },
  {
    after: "buddha-prose",
    block: {
      id: "gal-four-places",
      type: "gallery",
      title: "The four places",
      items: [
        {
          media: "m_lumbini",
          caption:
            "Lumbinī, the birthplace: [one of the four places the sutta tells believers to visit]({claim:The Mahāparinibbāna Sutta names four places}). The pillar is Aśoka's, two centuries later.",
        },
        {
          media: "j_bodh_gaya",
          caption: "Bodh Gaya, where he attained insight. The Mahābodhi temple was built and rebuilt many centuries afterwards.",
        },
        {
          media: "j_sarnath_dhamek",
          caption:
            "Sarnath, the Deer Park of [the first sermon]({claim:The Buddha's first sermon, given to five monks}). The Dhamek stupa is centuries later.",
        },
        {
          media: "j_kusinara",
          caption: "Kushinagar, the [Kusinārā where he died]({claim:Near the end the Buddha says}). The temple and stupa over the ancient remains are modern.",
        },
      ],
    },
  },
  {
    after: "persia-prose",
    block: {
      id: "gal-persia",
      type: "gallery",
      items: [
        {
          media: "j_behistun",
          caption:
            "Darius I's relief at Behistun, in western Iran. [Its inscription lists Gandāra among the lands “subject unto me”]({claim:Darius I's inscription at Behistun}).",
        },
        {
          media: "j_apadana_indians",
          caption:
            "Men identified as Indians bring tribute on the stairway of the Apadāna at Persepolis; [Herodotus says the Indians paid the largest tribute of all]({claim:According to Herodotus the Indians paid Persia}).",
        },
      ],
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  // m_lumbini is already on the platform (Maurya page); declaring it reuses that record.
  const lumbini: Pick = {
    file: "File:Ashoka Pillar, Lumbini.jpg",
    ref: "m_lumbini",
    title: "Aśoka's pillar at Lumbinī",
    alt: "Close view of the lower part of a smooth stone pillar, with several lines of Brāhmī letters cut into it.",
    representation: "photograph_of_object",
    depicts: ["lumbini"],
  };
  await seedPageMedia(mcp, {
    page: "mahajanapadas",
    mediaTitle: "Pictures for the Mahājanapadas page",
    mediaRationale: [
      "Freely licensed files from Wikimedia Commons for the Mahājanapadas page: the stone wall of Rājgīr, Northern Black Polished Ware in the British Museum, Vaishali, a Bharhut relief of Ajātasattu visiting the Buddha (marked as a later depiction), Bodh Gaya, Sarnath, Kushinagar, Darius I's relief at Behistun and the Indian delegation on the Apadāna at Persepolis (CC0). The Lumbinī pillar already on the platform is reused.",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot; apply checks the records against it. Captions say plainly that the monuments at the Buddha's places are centuries later than him.",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "Mahājanapadas page: pictures in the chapters",
    pageRationale:
      "Adds two figures and three galleries after the chapter prose whose claims they show, and the Rājgīr wall as the lead image. Captions link the claims already on the page. No block is removed or changed.",
    picks: [...PICKS, lumbini],
    placements: PLACEMENTS,
    hero: "j_rajgir_wall",
  });
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
