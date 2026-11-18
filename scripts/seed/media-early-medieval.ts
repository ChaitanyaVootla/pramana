/**
 * Pictures for the early medieval kingdoms page, proposed THROUGH MCP as the
 * agent acting for the local user: media records for hand-checked Wikimedia
 * Commons files (licence, author and credit read from the API by the MCP
 * server, never typed here), then figures and galleries placed after the
 * chapter prose whose claims they show, and a lead image.
 *
 *   pnpm tsx scripts/seed/media-early-medieval.ts           # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --depends-on=<id>   # a pending changeset that creates the depicted entities
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Claims are matched on their first words (the content agent may still revise
 * their endings). Left out: Chola bronzes and Pattadakal (no claim), Somnāth
 * (the present temple is a 1951 reconstruction, and a photograph of it would
 * show nothing the claims are about), and the Khalimpur plate (no freely
 * licensed photograph of that grant was found).
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const PICKS: Pick[] = [
  {
    file: "File:Thanjavur Brihadeeswarar Temple.jpg",
    ref: "x_thanjavur",
    title: "The Bṛhadīśvara temple, Thanjavur",
    alt: "A tall pyramidal stone tower rising in many carved tiers above the halls of a temple, under a cloudy sky.",
    representation: "photograph_of_site",
    depicts: ["brihadisvara-temple"],
    focus: { x: 0.45, y: 0.35 },
  },
  {
    file: "File:Gangaikonda Cholapuram-Temple-WUS02536.jpg",
    ref: "x_gangaikonda",
    title: "The temple at Gangaikonda Cholapuram",
    alt: "A tall stone temple tower and a long hall on a lawn, with palm trees and people resting on the grass.",
    representation: "photograph_of_site",
    depicts: ["gangaikonda-cholapuram"],
  },
  {
    file: "File:634 CE Aihole inscription by Ravikirti, Meguti Jain temple.jpg",
    ref: "x_aihole",
    title: "The Meguti temple at Aihole and its inscription",
    alt: "A low stone temple on a rocky hilltop; a circle and labels mark the place of the inscription on its wall.",
    representation: "photograph_of_site",
    representationNote: "The circle and labels were added by the photographer.",
    depicts: ["aihole"],
  },
  {
    file: "File:6th - 7th century Badami cave temples layout exterior.jpg",
    ref: "x_badami",
    title: "Badami: the cliffs and the cave temples",
    alt: "Red sandstone cliffs above a green lake, with rock-cut cave temples and stone steps at their foot.",
    representation: "photograph_of_site",
    depicts: ["badami"],
  },
  {
    file: "File:Mamallapuram, Shore Temple, India.jpg",
    ref: "x_shore_temple",
    title: "The Shore Temple, Mamallapuram",
    alt: "Two stepped stone temple towers on the seashore, with women in saris on the grass in front.",
    representation: "photograph_of_site",
    depicts: ["mamallapuram"],
  },
  {
    file: "File:Ellora Cave 16 Kailasa Temple.jpg",
    ref: "x_kailasa",
    title: "The Kailāsa temple, Ellora",
    alt: "A huge temple carved down into a hillside of dark rock, its towers and halls standing in a pit cut from the cliff.",
    representation: "photograph_of_site",
    depicts: ["kailasa-temple-ellora"],
  },
  {
    file: "File:Nalanda The Great Stupa.jpg",
    ref: "e_nalanda",
    title: "Nālandā: the ruins of the great stupa",
    alt: "The stepped brick ruins of a large stupa, with brick platforms in front, under trees.",
    representation: "photograph_of_site",
    depicts: ["nalanda"],
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "harsha-prose",
    block: {
      id: "fig-aihole",
      type: "figure",
      media: "x_aihole",
      caption:
        "The Meguti temple at Aihole, which carries [Pulakeśin II's inscription of 634–635 CE]({claim:Pulakeśin II's Aihole inscription}); [its poet, Ravikīrti, built the temple]({claim:The Aihole poem's author}).",
    },
  },
  {
    after: "deccan-prose",
    block: {
      id: "gal-deccan",
      type: "gallery",
      items: [
        {
          media: "x_badami",
          caption:
            "Badami, the old Vātāpi: [the Chalukyas ruled the Deccan from here]({claim:The Chalukyas ruled the Deccan from Vātāpi}), until [the Pallava king Narasiṃhavarman I took it]({claim:The Pallava king Narasiṃhavarman I took the Chalukya capital}).",
        },
        {
          media: "x_shore_temple",
          caption:
            "The Shore Temple at [Mamallapuram, named after Narasiṃhavarman I's title Mamalla]({claim:Narasiṃhavarman I's title Mamalla}).",
        },
      ],
    },
  },
  {
    after: "kannauj-prose",
    block: {
      id: "gal-kannauj",
      type: "gallery",
      items: [
        {
          media: "x_kailasa",
          caption:
            "[The Kailāsa temple at Ellora, believed to have been carved out of a single rock]({claim:The Kailāsa temple at Ellora}) under the Rāṣṭrakūṭas; which king did most of the work is not certain.",
        },
        {
          media: "e_nalanda",
          caption:
            "The ruins at Nālandā, one of the [great centres of learning the Pālas supported]({claim:The Pālas built Buddhist monasteries}).",
        },
      ],
    },
  },
  {
    after: "thanjavur-prose",
    block: {
      id: "fig-thanjavur",
      type: "figure",
      media: "x_thanjavur",
      size: "wide",
      caption:
        "[The great temple Rājarāja built at Thanjavur between 1003 and 1010]({claim:Rājarāja built the great temple at Thanjavur}), with its [granite tower about 200 feet high]({claim:The granite tower (vimāna)}).",
    },
  },
  {
    after: "sea-prose",
    block: {
      id: "fig-gangaikonda",
      type: "figure",
      media: "x_gangaikonda",
      caption:
        "The temple of [Gangaikonda Cholapuram, the capital Rājendra named after his armies' march to the Ganges]({claim:Rājendra's armies went north to the Ganges}).",
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  await seedPageMedia(mcp, {
    page: "early-medieval-kingdoms",
    mediaTitle: "Pictures for the early medieval kingdoms page",
    mediaRationale: [
      "Freely licensed files from Wikimedia Commons for the early medieval kingdoms page: the Bṛhadīśvara temple at Thanjavur and the temple at Gangaikonda Cholapuram, Badami, the Meguti temple at Aihole (the photographer's labels noted), the Shore Temple at Mamallapuram, the Kailāsa temple at Ellora, and Nālandā (already on the platform).",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot; apply checks the records against it. Left out: Chola bronzes and Pattadakal (no claim), Somnāth (the present temple is a 1951 reconstruction) and the Khalimpur plate (no freely licensed photograph found).",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "Early medieval kingdoms page: pictures in the chapters",
    pageRationale:
      "Adds three figures and two galleries after the chapter prose whose claims they show, and the Thanjavur temple as the lead image. Captions link the claims already on the page by their first words. No block is removed or changed.",
    picks: PICKS,
    placements: PLACEMENTS,
    hero: "x_thanjavur",
  });
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
