/**
 * Pictures for the Indus civilisation page, proposed THROUGH MCP as the agent
 * acting for the local user: media records for hand-checked Wikimedia Commons
 * files (licence, author and credit read from the API by the MCP server, never
 * typed here), then figures placed after the chapter prose whose claims they
 * show, and a lead image.
 *
 *   pnpm tsx scripts/seed/media-indus.ts                    # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Names the excavators gave ("Priest-King", "Pashupati", "dock") are captioned
 * as names, not findings. The only freely licensed photograph of the
 * "Priest-King" whose provenance is clear is of a cast, and it is marked so.
 * The Dancing Girl, the Dholavira signboard and the Harappa "granary" are left
 * out: no claim on the page is about them.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const PICKS: Pick[] = [
  {
    file: "File:Mohenjo-daro.jpg",
    ref: "i_mohenjodaro",
    title: "The excavated city at Mohenjo-daro",
    alt: "Rows of excavated brick walls and narrow streets stretching away, with a rounded brick mound and stupa on the skyline.",
    representation: "photograph_of_site",
    depicts: ["mohenjo-daro"],
    focus: { x: 0.5, y: 0.55 },
  },
  {
    file: "File:Great bath view Mohenjodaro.JPG",
    ref: "i_great_bath",
    title: "The Great Bath, Mohenjo-daro",
    alt: "A sunken rectangular brick tank with steps leading down at one end, surrounded by brick walls and rooms.",
    representation: "photograph_of_site",
    depicts: ["great-bath-mohenjo-daro"],
  },
  {
    file: "File:The Priest King of Moenjo Daro.jpg",
    ref: "i_priest_king_cast",
    title: "A cast of the so-called Priest-King",
    alt: "A museum display of a stone bust of a bearded man with a headband and a robe patterned with trefoils, labelled “King Priest (cast)”.",
    representation: "copy_of_object",
    representationNote: "A cast, labelled as such in the museum. The original is in the National Museum of Pakistan, Karachi.",
    depicts: ["priest-king-statue"],
  },
  {
    file: "File:Pasupati Seal, National Museum, New Delhi.jpg",
    ref: "i_pashupati",
    title: "The so-called Pashupati seal",
    alt: "A small square stone seal carved with a seated figure in a horned headdress, surrounded by animals, with signs of the Indus script above.",
    representation: "photograph_of_object",
    depicts: ["pashupati-seal"],
  },
  {
    file: "File:Stamp seal and modern impression- unicorn and incense burner (?) MET DP23101.jpg",
    ref: "i_unicorn_seal",
    title: "A unicorn seal and a modern impression",
    alt: "A small square stone seal and a clay impression made from it, showing a one-horned animal before a stand, with script signs above.",
    representation: "photograph_of_object",
    representationNote: "The seal (left) and a modern impression taken from it (right). Metropolitan Museum of Art, New York.",
    depicts: ["indus-script"],
  },
  {
    file: "File:Dock of Lothal - Gujarat, India (5933605155).jpg",
    ref: "i_lothal",
    title: "The basin at Lothal",
    alt: "A long rectangular basin lined with brick, partly filled with water, in flat open country.",
    representation: "photograph_of_site",
    depicts: ["lothal"],
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "cities-prose",
    block: {
      id: "gal-cities",
      type: "gallery",
      items: [
        {
          media: "i_mohenjodaro",
          caption:
            "The excavated lower city at Mohenjo-daro, [its streets crossing at right angles, with drains built into the plan]({claim:At Mohenjo-daro the buildings of the lower city}). The stupa on the skyline is [a Buddhist building of nearly two thousand years later]({claim:Mohenjo-daro was not rebuilt after its abandonment}).",
        },
        {
          media: "i_great_bath",
          caption:
            "[The Great Bath, a brick tank about 39 by 23 feet, made watertight with bitumen]({claim:The Great Bath at Mohenjo-daro, excavated in 1925–26}). [What it was for “can only be surmised”]({claim:Marshall wrote that the Great Bath's purpose}).",
        },
        {
          media: "i_lothal",
          caption:
            "The brick basin at Lothal in Gujarat: [a dock, in the Archaeological Survey's reading]({claim:The Archaeological Survey of India interpreted}), [or an irrigation tank, in others']({claim:Other archaeologists argue that the Lothal basin}).",
        },
      ],
    },
  },
  {
    after: "script-prose",
    block: {
      id: "fig-unicorn-seal",
      type: "figure",
      media: "i_unicorn_seal",
      caption:
        "A seal with a “unicorn” and a short line of signs, and a modern impression of it. [Indus inscriptions average about five signs]({claim:Three things make decipherment so hard}), and [none of the claimed decipherments is widely accepted]({claim:The Indus script has not been deciphered}). Metropolitan Museum of Art, New York.",
    },
  },
  {
    after: "religion-prose",
    block: {
      id: "fig-pashupati",
      type: "figure",
      media: "i_pashupati",
      caption:
        "The so-called Pashupati seal, now in the National Museum, New Delhi. [Marshall saw its horned figure as an early Shiva]({claim:Marshall identified the horned figure}); [later scholars dispute that reading]({claim:Later scholars have disputed Marshall's reading}).",
    },
  },
  {
    after: "myth-priestking",
    block: {
      id: "fig-priest-king",
      type: "figure",
      media: "i_priest_king_cast",
      caption:
        "A cast of the 17.5 cm statuette [commonly called the “Priest-King”; some now read it as evidence of contact with neighbouring peoples rather than of a ruling elite]({claim:“Priest-King” is the common name for a 17.5 cm statuette}). The original is in the National Museum of Pakistan, Karachi.",
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  await seedPageMedia(mcp, {
    page: "indus-civilisation",
    mediaTitle: "Pictures for the Indus civilisation page",
    mediaRationale: [
      "Freely licensed files from Wikimedia Commons for the Indus civilisation page: the excavated city and the Great Bath at Mohenjo-daro, a cast of the so-called Priest-King (marked as a cast), the so-called Pashupati seal in the National Museum, New Delhi, a unicorn seal with a modern impression (Metropolitan Museum, CC0), and the basin at Lothal.",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot; apply checks the records against it. Names the excavators gave are captioned as names. The Dancing Girl, the Dholavira signboard and the Harappa “granary” are left out because no claim on the page is about them.",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "Indus civilisation page: pictures in the chapters",
    pageRationale:
      "Adds figures after the chapter prose whose claims they show, and the Great Bath as the lead image. Captions link the claims already on the page. No block is removed or changed.",
    picks: PICKS,
    placements: PLACEMENTS,
    hero: "i_great_bath",
  });
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
