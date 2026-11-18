/**
 * Pictures for the Gupta Empire page, proposed THROUGH MCP as the agent
 * acting for the local user: media records for hand-checked Wikimedia Commons
 * files (licence, author and credit read from the API by the MCP server, never
 * typed here), then figures and galleries placed after the chapter prose whose
 * claims they show, and a lead image.
 *
 *   pnpm tsx scripts/seed/media-gupta.ts                    # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Every picture is tied to a claim on the page: the objects the inscriptions
 * and coins are about, the sites the claims name. Pictures with no claim to
 * stand beside (the Deogarh temple, for one) are left out, however handsome.
 * Coins are the only images of these kings made in their lifetimes; they are
 * stylised royal images, and the records say so.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const COIN_NOTE = "A stylised royal image on the king's own coin, not a portrait from life.";

const PICKS: Pick[] = [
  {
    file: "File:Varahavtar Panel.jpg",
    ref: "g_udayagiri_varaha",
    title: "The Varāha relief at Udayagiri",
    alt: "A huge relief cut into a rock face: a giant figure with a boar's head and a man's body, one foot raised, a small female figure at his tusk, and rows of tiny carved onlookers behind.",
    representation: "photograph_of_object",
    depicts: ["udayagiri-caves"],
    focus: { x: 0.45, y: 0.45 },
  },
  {
    file: "File:Samudragupta inscription on the Allahabad pillar of Ashoka.jpg",
    ref: "g_allahabad",
    title: "The Allahabad pillar and Samudragupta's inscription",
    alt: "Three panels: an old photograph of a tall stone column with a section marked in red, a closer view of that section, and an ink impression of the dense inscription carved there.",
    representation: "copy_of_object",
    representationNote: "A photograph of the pillar from about 1870, beside an ink impression of the inscription.",
    needsUsBasis: true,
    usBasis:
      "a photograph of about 1870 (Thomas A. Rust) and a 19th-century impression of the inscription: made more than 120 years ago, so public domain in the US whether or not published.",
    depicts: ["allahabad-pillar"],
  },
  {
    file: "File:Samudragupta Circa 335-380 CE Lyrist type.jpg",
    ref: "g_coin_lyrist",
    title: "Samudragupta's “lyrist type” gold coin",
    alt: "Both faces of a gold coin: a king seated on a couch playing a stringed instrument, and a goddess seated on a stool.",
    representation: "photograph_of_object",
    representationNote: COIN_NOTE,
    depicts: ["samudragupta"],
  },
  {
    file: "File:Samudragupta circa 335-380 CE Ashvameda type.jpg",
    ref: "g_coin_ashvamedha",
    title: "Samudragupta's horse-sacrifice gold coin",
    alt: "Both faces of a gold coin: a horse standing before a sacrificial post, and a queen holding a fly-whisk.",
    representation: "photograph_of_object",
    depicts: ["samudragupta"],
  },
  {
    file: "File:The Iron pillar of Delhi 01.jpg",
    ref: "g_iron_pillar",
    title: "The iron pillar at Mehrauli",
    alt: "A dark iron column standing inside a low railing in a courtyard, framed by tall ruined stone arches.",
    representation: "photograph_of_object",
    depicts: ["iron-pillar-of-delhi"],
  },
  {
    file: "File:India, Chandragupta II, Gupta Period - Coin with Figure of an Archer - 1977.62 - Cleveland Museum of Art.jpg",
    ref: "g_coin_archer",
    title: "Chandragupta II's “archer type” gold coin",
    alt: "Both faces of a small gold coin: a standing king holding a bow, and a goddess seated cross-legged on a lotus.",
    representation: "photograph_of_object",
    representationNote: COIN_NOTE,
    depicts: ["chandragupta-ii"],
  },
  {
    file: "File:Bhitari pillar of Skandagupta.jpg",
    ref: "g_bhitari",
    title: "The Bhitari pillar, about 1870",
    alt: "An old photograph of a single stone column standing in open ground, a man beside its base.",
    representation: "historical_photograph",
    needsUsBasis: true,
    depicts: ["bhitari-pillar"],
  },
  {
    file: "File:Ashoka Rock Edict at Junagadh.jpg",
    ref: "g_junagadh",
    title: "The inscribed boulder at Junāgaḍh",
    alt: "A huge rounded boulder inside a building, its surface cut with faint lines of writing.",
    representation: "photograph_of_object",
    depicts: ["girnar"],
  },
  {
    file: "File:0112321 Varaha at Ancient Hindu site Eran, Madhya Pradesh 024.jpg",
    ref: "g_eran_boar",
    title: "The stone boar at Eran",
    alt: "A colossal red sandstone boar standing on a platform, its body covered in rows of tiny carved figures, a small female figure hanging from its tusk, beside ruined pillars.",
    representation: "photograph_of_object",
    depicts: ["eran"],
  },
  {
    file: "File:Ajanta Cave 1 Padmapani.jpg",
    ref: "g_ajanta",
    title: "The Padmapāṇi painting, Ajanta Cave 1",
    alt: "A wall painting of a crowned figure holding a lotus, his head tilted, surrounded by smaller figures, on a darkened cave wall.",
    representation: "photograph_of_object",
    depicts: ["ajanta-caves"],
  },
  {
    file: "File:Preaching Buddha in the Indian Museum, Kolkata.jpg",
    ref: "g_sarnath_buddha",
    title: "A Buddha from Sarnath, 5th century",
    alt: "A sandstone relief of the Buddha seated cross-legged with his hands at his chest, flanked by two standing attendants.",
    representation: "photograph_of_object",
    objectDate: { edtf: "04XX", label: "5th century CE", basis: "the museum's label (Indian Museum, Kolkata)" },
    depicts: ["sarnath"],
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "samudragupta-prose",
    block: {
      id: "gal-samudragupta",
      type: "gallery",
      items: [
        {
          media: "g_allahabad",
          caption:
            "The pillar at Allahabad, photographed about 1870, and an impression of [Samudragupta's praise poem, carved on a column that already bore Aśoka's edicts]({claim:Samudragupta's praise poem was carved}).",
        },
        {
          media: "g_coin_lyrist",
          caption: "A gold coin of the “lyrist type”: the [“king of poets” playing a stringed instrument]({claim:The inscription praises Samudragupta as}).",
        },
        {
          media: "g_coin_ashvamedha",
          caption:
            "A horse before a sacrificial post: the [horse sacrifice later inscriptions say he restored]({claim:Later Gupta inscriptions call Samudragupta}).",
        },
      ],
    },
  },
  {
    after: "chandragupta-prose",
    block: {
      id: "gal-chandragupta",
      type: "gallery",
      items: [
        {
          media: "g_iron_pillar",
          caption:
            "The iron pillar in the Qutb complex at Mehrauli, Delhi. Its undated inscription [praises a king named Chandra]({claim:The iron pillar at Mehrauli}), [now usually, though not certainly, identified with Chandragupta II]({claim:Chandra of the iron pillar is now generally identified}); [where it first stood is debated]({claim:Where the iron pillar first stood}).",
        },
        {
          media: "g_udayagiri_varaha",
          caption: "[The colossal Varāha at Udayagiri]({claim:One of the Udayagiri shrines}): Viṣṇu as a boar, with the Earth goddess at his tusk.",
        },
        {
          media: "g_coin_archer",
          caption:
            "A gold coin of Chandragupta II, whose [dated inscriptions run from about 401 to 414 CE]({claim:Chandragupta II's dated inscriptions}). Now in the Cleveland Museum of Art.",
        },
      ],
    },
  },
  {
    after: "faxian-prose",
    block: {
      id: "fig-sarnath-buddha",
      type: "figure",
      media: "g_sarnath_buddha",
      caption:
        "A Buddha from Sarnath, dated by the Indian Museum in Kolkata, where it is now, to the 5th century. Sarnath is the Deer Park [Faxian visited on his way]({claim:Faxian stayed three years at Pāṭaliputra}).",
    },
  },
  {
    after: "skandagupta-prose",
    block: {
      id: "gal-skandagupta",
      type: "gallery",
      items: [
        {
          media: "g_bhitari",
          caption:
            "The Bhitari pillar, photographed about 1870. [Its inscription says Skandagupta slept a night on the bare ground]({claim:Skandagupta's pillar at Bhitari}) and [fought the Hūṇas]({claim:The Bhitari pillar also says}).",
        },
        {
          media: "g_junagadh",
          caption:
            "The boulder at Junāgaḍh, in Gujarat, that carries Aśoka's edicts and, [on the same stone, the record of the Sudarśana lake rebuilt in 456–457]({claim:On the same boulder at Junāgaḍh}).",
        },
      ],
    },
  },
  {
    after: "end-prose",
    block: {
      id: "fig-eran-boar",
      type: "figure",
      media: "g_eran_boar",
      caption:
        "The stone boar at Eran, in Madhya Pradesh, [set up “in the first year” of the Hūṇa king Toramāṇa]({claim:A few years later, “in the first year”}). The inscription is cut across its chest.",
    },
  },
  {
    after: "myth-ajanta",
    block: {
      id: "fig-ajanta",
      type: "figure",
      media: "g_ajanta",
      caption:
        "The Padmapāṇi painting in Ajanta Cave 1, often shown as “Gupta art”. [The great later caves were made under the Vākāṭakas]({claim:The most famous monuments in a broadly “Gupta style”}), and [their dates are argued over]({claim:Walter Spink argued}).",
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  await seedPageMedia(mcp, {
    page: "gupta-empire",
    mediaTitle: "Pictures for the Gupta Empire page",
    mediaRationale: [
      "Freely licensed files from Wikimedia Commons for the Gupta Empire page: the Udayagiri Varāha relief, the Allahabad pillar and an impression of Samudragupta's inscription, his lyrist and horse-sacrifice gold coins, the Mehrauli iron pillar, a gold coin of Chandragupta II (Cleveland Museum of Art, CC0), the Bhitari pillar about 1870, the Junāgaḍh boulder, the Eran boar, the Padmapāṇi painting at Ajanta, and a 5th-century Buddha from Sarnath.",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot; apply checks the records against it. Coins are marked as stylised royal images, not portraits. The Ajanta painting is placed beside the misconception that Ajanta is Gupta art, with the claims that correct it.",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "Gupta Empire page: pictures in the chapters",
    pageRationale: [
      "Adds three figures and three galleries, each placed after the chapter prose whose claims it shows, and the Udayagiri Varāha as the lead image. Captions link the claims already on the page and add only identifications (where an object is now).",
      "No block is removed or changed.",
    ].join("\n\n"),
    picks: PICKS,
    placements: PLACEMENTS,
    hero: "g_udayagiri_varaha",
  });
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
