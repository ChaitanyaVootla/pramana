/**
 * Pictures for the Maurya Empire page, proposed THROUGH MCP as the agent
 * acting for the local user: media records for hand-checked Wikimedia Commons
 * files (licence, author and credit read from the API by the MCP server, never
 * typed here), then figures and galleries in the chapters and a lead image.
 *
 *   pnpm tsx scripts/seed/media-maurya.ts                   # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Every file below was looked at, and its Commons description read, before it
 * was listed. Captions say what the picture is, where the thing is now, and
 * why it matters, linking the page's claims ({claim:prefix}). Nothing here is
 * a portrait: no likeness of any Maurya ruler survives, and the two pictures
 * of rulers are marked as later imaginings.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const PICKS: Pick[] = [
  {
    file: "File:Lion capital of Ashoka, Sarnath.jpg",
    ref: "m_lion_capital",
    title: "Lion Capital of Aśoka",
    alt: "Four lions seated back to back on a round stone drum carved with wheels and animals, above an upturned lotus, in a museum gallery.",
    representation: "photograph_of_object",
    objectDate: { edtf: "-0299/-0200", label: "3rd century BCE", basis: "usually attributed to Aśoka's reign" },
    depicts: ["sarnath", "maurya-empire"],
    focus: { x: 0.5, y: 0.3 },
  },
  {
    file: "File:Rock inscription of the edicts of Asoka and the sculpture of elephant N-OR-59.jpg",
    ref: "m_dhauli",
    title: "The elephant rock at Dhauli",
    alt: "The front half of an elephant carved out of a large dark boulder, among trees.",
    representation: "photograph_of_site",
    depicts: ["dhauli"],
    focus: { x: 0.62, y: 0.45 },
  },
  {
    file: "File:AsokaKandahar.jpg",
    ref: "m_kandahar",
    title: "Kandahar bilingual inscription",
    alt: "A stone surface cut with about thirteen lines of Greek capital letters, and below them lines of Aramaic script.",
    representation: "photograph_of_object",
    depicts: ["kandahar-bilingual-rock-inscription"],
  },
  {
    file: "File:Mauryan Hall pillar.jpg",
    ref: "m_kumhrar",
    title: "Pillar from the hall at Kumhrar",
    alt: "A long, broken stone column lying on supports under a shelter, behind a railing in a park.",
    representation: "photograph_of_site",
    depicts: ["pataliputra"],
  },
  {
    file: "File:Stupa 1, Sanchi 01.jpg",
    ref: "m_sanchi",
    title: "The Great Stupa at Sanchi",
    alt: "A large hemispherical stone dome with a railing around its base and a small square railing on top, under a clear sky.",
    representation: "photograph_of_site",
    depicts: ["sanchi"],
    focus: { x: 0.55, y: 0.5 },
  },
  {
    file: "File:Girnar Major Rock Edict No13.jpg",
    ref: "m_girnar_re13",
    title: "Rock Edict XIII at Girnar, copied in 1877",
    alt: "A drawn copy of rows of Brāhmī letters inside the outline of a broken rock surface, with gaps where the stone is lost.",
    representation: "copy_of_object",
    representationNote: "A hand copy published by Alexander Cunningham in 1877, not a photograph of the stone.",
    needsUsBasis: true,
    usBasis: "printed in Alexander Cunningham's Inscriptions of Asoka (Corpus Inscriptionum Indicarum, vol. 1), 1877: published before 1931.",
    depicts: ["girnar"],
  },
  {
    file: "File:I42 1karshapana Maurya Bindusara MACW4165 1ar (8486583162).jpg",
    ref: "m_coin",
    title: "A Mauryan punch-marked coin",
    alt: "Both faces of a small, roughly square silver coin, one stamped with several symbols including a sun, the other with a single symbol.",
    representation: "photograph_of_object",
  },
  {
    file: "File:Didarganj Yakshi statue in the Bihar Museum.jpg",
    ref: "m_yakshi",
    title: "The Didarganj Yakshi",
    alt: "A polished stone statue of a standing woman holding a fly-whisk over her shoulder, wearing jewellery and a long skirt, in a museum.",
    representation: "photograph_of_object",
    focus: { x: 0.5, y: 0.22 },
  },
  {
    file: "File:Ashoka Pillar, Lumbini.jpg",
    ref: "m_lumbini",
    title: "Aśoka's pillar at Lumbinī",
    alt: "Close view of the lower part of a smooth stone pillar, with several lines of Brāhmī letters cut into it.",
    representation: "photograph_of_object",
    depicts: ["lumbini"],
  },
  {
    file: "File:Ashoka's visit to the Ramagrama stupa Sanchi Stupa 1 Southern gateway.jpg",
    ref: "m_ashoka_relief",
    title: "A king at the Rāmagrāma stupa, Sanchi",
    alt: "A stone relief crowded with figures: a crowned man in a chariot drawn by horses, with attendants and onlookers.",
    representation: "later_imagining",
    representationNote:
      "Carved on a gateway at Sanchi long after Aśoka's death; the scene is read as his visit to the Rāmagrāma stupa. No likeness of Aśoka survives.",
    depicts: ["ashoka"],
  },
  {
    file: "File:Chandragupt maurya Birla mandir 6 dec 2009 (31) (cropped).JPG",
    ref: "m_chandragupta",
    title: "Chandragupta Maurya, a modern carving",
    alt: "A painted modern relief of a standing crowned man holding a book, in an arched frame.",
    representation: "later_imagining",
    representationNote: "A modern carving at the Birla Mandir in Delhi. No likeness of Chandragupta survives.",
    depicts: ["chandragupta-maurya"],
  },
  {
    file: "File:Delhi-Topra pillar Ashoka inscriptions.jpg",
    ref: "m_delhi_topra",
    title: "The Delhi-Topra pillar edicts, printed in 1925",
    alt: "A printed plate of five long strips of dense Brāhmī writing, the four faces of a pillar and a band below them.",
    representation: "copy_of_object",
    representationNote: "A reproduction of the inscriptions printed in E. Hultzsch's 1925 edition, not a photograph of the pillar.",
    depicts: ["delhi-topra-pillar"],
  },
  {
    file: "File:Kalsi inscription south face.jpg",
    ref: "m_kalsi_re13",
    title: "Rock Edict XIII at Kālsī, as Hultzsch printed it",
    alt: "A printed plate headed “Kalsi rock; south face”: an ink impression of a rock surface densely cut with lines of Brāhmī letters, numbered in the margins, with XIV marking where the next edict begins.",
    representation: "copy_of_object",
    representationNote:
      "An ink impression of the rock's south face, printed in E. Hultzsch's Inscriptions of Asoka (1925), the edition whose translation this page quotes. Not a photograph of the stone.",
    needsUsBasis: true,
    depicts: ["kalsi-rock-edicts"],
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "kalinga-prose",
    block: {
      id: "fig-dhauli",
      type: "figure",
      media: "m_dhauli",
      caption:
        "At Dhauli, near Bhubaneswar in Odisha, in the old land of Kalinga, Aśoka's edicts are cut into the face of a rock, and the front of an elephant is carved from the stone above them.",
    },
  },
  {
    after: "kalinga-quote",
    block: {
      id: "fig-kalsi-re13",
      type: "figure",
      media: "m_kalsi_re13",
      caption:
        "The words quoted above, on the stone: Rock Edict XIII on the south face of the Kālsī rock in Uttarakhand, in the impression Hultzsch printed in the same edition as his translation. It is here that Aśoka [puts the toll of the Kalinga conquest]({claim:Rock Edict XIII puts the toll}).",
    },
  },
  {
    after: "dhamma-prose",
    block: {
      id: "gal-dhamma",
      type: "gallery",
      items: [
        {
          media: "m_lumbini",
          caption:
            "The pillar at Lumbinī, in Nepal, the Buddha's birthplace. Its inscription records that [Aśoka came here in the twentieth year after his consecration]({claim:In the twentieth year after his consecration}) and [lightened the village's taxes]({claim:Aśoka exempted the village of Lumbinī}).",
        },
        {
          media: "m_sanchi",
          caption:
            "The Great Stupa at Sanchi, in Madhya Pradesh, a Buddhist monument whose oldest part is thought to go back to Aśoka's time; the stone casing and gateways were added later. [Aśoka says he had been a lay Buddhist]({claim:By his own account, Aśoka had been a lay Buddhist}).",
        },
      ],
    },
  },
  {
    after: "greek-prose",
    block: {
      id: "fig-kandahar",
      type: "figure",
      media: "m_kandahar",
      caption:
        "Aśoka's words in Greek (above) and Aramaic (below), cut into a rock at Kandahar in Afghanistan, at the western edge of his empire. Greek was the language of his western neighbours, [the kings the edicts name]({claim:Rock Edict XIII names}).",
    },
  },
  {
    after: "running-prose",
    block: {
      id: "fig-lion-capital",
      type: "figure",
      media: "m_lion_capital",
      size: "wide",
      caption:
        "The Lion Capital, found at Sarnath, where the Buddha is said to have first taught, and now in the Sarnath Museum. It once crowned one of the [pillars Aśoka set up to spread dhamma]({claim:Aśoka appointed special officers}). Today it is the emblem of the Republic of India.",
    },
  },
  {
    after: "roads-prose",
    block: {
      id: "fig-kumhrar",
      type: "figure",
      media: "m_kumhrar",
      caption:
        "A broken pillar from a great hall excavated at Kumhrar, in Patna. The hall is usually dated to Mauryan times, and it stood in [the capital, Pāṭaliputra]({claim:The Maurya capital, Pāṭaliputra}), the city [Megasthenes described]({claim:Megasthenes described Pāṭaliputra}).",
    },
  },
  {
    after: "stone-prose",
    block: {
      id: "gal-stone",
      type: "gallery",
      items: [
        {
          media: "m_girnar_re13",
          caption:
            "Rock Edict XIII as it survives at Girnar in Gujarat, copied by hand for Alexander Cunningham's 1877 volume of Aśoka's inscriptions. Gaps mark where the stone has broken away.",
        },
        {
          media: "m_delhi_topra",
          caption:
            "The edicts on the Delhi-Topra pillar, as E. Hultzsch printed them in 1925. Editions like these, made after [Prinsep showed how to read the script]({claim:James Prinsep completed the decipherment}), let scholars compare every copy of an edict.",
        },
      ],
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  await seedPageMedia(mcp, {
    page: "maurya-empire",
    mediaTitle: "Pictures for the Maurya Empire page",
    mediaRationale: [
      "Freely licensed files from Wikimedia Commons for the Maurya Empire page: the Lion Capital in the Sarnath Museum, the elephant rock at Dhauli, the Kandahar Greek–Aramaic inscription, a pillar of the Kumhrar hall in Patna, the Great Stupa at Sanchi, the Lumbinī pillar, a punch-marked coin, the Didarganj Yakshi, Cunningham's 1877 copy of Rock Edict XIII at Girnar and Hultzsch's 1925 plate of the Delhi-Topra pillar.",
      "Two pictures of rulers are included only as marked imaginings (the Sanchi relief read as Aśoka at Rāmagrāma, and a modern carving of Chandragupta), so the people lists have a picture that says plainly it is not a likeness.",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot; apply checks the records against it. Only public domain, CC0, CC BY and CC BY-SA files are accepted.",
      "Each record says what the picture is (a photograph of the object, of the site, or a later hand copy). Dates of objects are given only where they are not in dispute.",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "Maurya Empire page: pictures in the chapters",
    pageRationale: [
      "Adds four figures and two galleries to the chapters, and the Lion Capital as the lead image. Each picture sits beside the claim it shows; the coin, the Yakshi and the Sanchi relief are kept as records (and entity pictures) but not placed, since no claim on the page is about them. Captions say what each picture shows and where it is now, and link the claims already on the page; they assert nothing new about the Mauryas beyond identifying the objects.",
      "No block is removed or changed; the new blocks follow the chapter prose they illustrate.",
    ].join("\n\n"),
    picks: PICKS,
    placements: PLACEMENTS,
    hero: "m_lion_capital",
    // Pictures not tied to a claim on the page distract more than they teach.
    retired: ["gal-made"],
  });
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
