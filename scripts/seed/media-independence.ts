/**
 * Pictures for the Independence movement page, proposed THROUGH MCP as the
 * agent acting for the local user: media records for hand-checked Wikimedia
 * Commons files (licence, author and credit read from the API by the MCP
 * server, never typed here), then figures and galleries in the chapters and a
 * lead image.
 *
 *   pnpm tsx scripts/seed/media-independence.ts             # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --withdraw          # dry run: propose, print the report, withdraw
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * Photographs are public domain in India by age; each must also be free in
 * the United States, which the Commons licence tags have to say (PD-1996,
 * PD-US-…), or `usBasis` gives the reasoning. That rules out the photographs
 * of 15 August 1947 and of Partition: they were still in copyright in India on
 * 1 January 1996, so their US copyright was restored and runs until 2042.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const PHOTO = { representation: "historical_photograph", needsUsBasis: true } as const;

const PICKS: Pick[] = [
  {
    ...PHOTO,
    file: "File:Marche sel.jpg",
    ref: "m_salt_march",
    title: "Gandhi on the Salt March, 1930",
    alt: "Gandhi, in a white cloth and holding a staff, walks among a crowd of marchers in white caps.",
    depicts: ["mahatma-gandhi", "salt-march"],
    focus: { x: 0.5, y: 0.4 },
  },
  {
    ...PHOTO,
    file: "File:Gandhi at Dandi 5 April 1930.jpg",
    ref: "m_dandi",
    title: "Gandhi at Dandi, April 1930",
    alt: "Gandhi bends to pick up salt from the ground, with men and a woman in white standing behind him.",
    depicts: ["mahatma-gandhi", "salt-march", "dandi"],
  },
  {
    ...PHOTO,
    file: "File:1st INC1885.jpg",
    ref: "m_inc_1885",
    title: "The first Indian National Congress, 1885",
    depicts: ["indian-national-congress"],
    alt: "A group photograph of the delegates, many in turbans or caps, seated and standing in rows in front of a building.",
  },
  {
    ...PHOTO,
    file: "File:Entrance to Jallianwala Bagh.jpg",
    ref: "m_jb_entrance",
    title: "The way into Jallianwala Bagh, 1919",
    alt: "A narrow lane between high walls, leading out to open ground and a palm tree.",
    depicts: ["jallianwala-bagh", "jallianwala-bagh-massacre"],
  },
  {
    file: "File:Map-of-Jallianwala-Bagh.jpg",
    ref: "m_jb_map",
    title: "Plan of Jallianwala Bagh, 1920",
    alt: "A printed site plan of Jallianwala Bagh: an irregular walled ground with its lanes, a well and trees marked.",
    representation: "historical_map",
    representationNote: "From the report of the Congress's inquiry, published in 1920.",
    needsUsBasis: true,
    depicts: ["jallianwala-bagh"],
  },
  {
    ...PHOTO,
    file: "File:Felice Beato (British, born Italy - (Ruins of the Residency) - Google Art Project.jpg",
    ref: "m_residency",
    title: "Ruins of the Residency, Lucknow, 1858",
    alt: "The shattered walls and empty window openings of large ruined buildings, with rubble and a few people in front.",
    depicts: ["revolt-of-1857"],
  },
  {
    file: "File:Indian Rebellion of 1857.jpg",
    ref: "m_1857_map",
    title: "“The Mutiny 1857–9”, a map of 1912",
    alt: "A printed map of northern India titled “North India: the Mutiny 1857–9”.",
    representation: "historical_map",
    representationNote: "Made in 1912 for the Cambridge Modern History Atlas, half a century after the events.",
    needsUsBasis: true,
    depicts: ["revolt-of-1857"],
  },
  {
    ...PHOTO,
    file: "File:Bhagat Singh 1929.jpg",
    ref: "m_bhagat_singh",
    title: "Bhagat Singh, 1929",
    alt: "Portrait of a young man in a felt hat and a collared shirt.",
    depicts: ["bhagat-singh"],
  },
  {
    ...PHOTO,
    file: "File:Bhagat singh noncooperation.jpg",
    ref: "m_national_college",
    title: "The National College, Lahore, 1921",
    alt: "A group photograph of young men in two rows, standing and seated on the ground, many in turbans.",
    depicts: ["bhagat-singh", "non-cooperation-movement"],
  },
  {
    ...PHOTO,
    file: "File:Jinnah and Gandhi.jpg",
    ref: "m_jinnah_gandhi",
    title: "Jinnah and Gandhi, 1944",
    alt: "Jinnah, in a suit, stands in a doorway; Gandhi, in a white shawl and holding a staff, gestures towards him.",
    depicts: ["muhammad-ali-jinnah", "mahatma-gandhi"],
  },
  {
    ...PHOTO,
    file: "File:Jinnah1945c.jpg",
    ref: "m_jinnah",
    title: "M. A. Jinnah, 1945",
    alt: "Portrait photograph of M. A. Jinnah.",
    depicts: ["muhammad-ali-jinnah"],
  },
  {
    ...PHOTO,
    file: "File:Benjamin Disraeli (1804–1881) cropped.png",
    ref: "m_disraeli",
    title: "Benjamin Disraeli, 1878",
    alt: "Portrait photograph of Benjamin Disraeli in old age.",
    depicts: ["benjamin-disraeli"],
  },
  {
    ...PHOTO,
    file: "File:Karl Marx 001 restored.jpg",
    ref: "m_marx",
    title: "Karl Marx, about 1875",
    alt: "Portrait photograph of Karl Marx.",
    depicts: ["karl-marx"],
  },
  {
    ...PHOTO,
    file: "File:Général Dyer, C.N. Londres (cliché Central News) - btv1b530372528.jpg",
    ref: "m_dyer",
    title: "Reginald Dyer, 1920",
    alt: "Press photograph of Reginald Dyer.",
    depicts: ["reginald-dyer"],
    usBasis:
      "a press photograph distributed by the Agence Rol in 1920 (Bibliothèque nationale de France, btv1b530372528): published before 1931, so public domain in the US.",
  },
  {
    file: "File:Partition of India 1947 en.svg",
    ref: "m_partition_map",
    title: "The partition of India, 1947",
    alt: "A map of the subcontinent: India in orange, West and East Pakistan in green, the divided provinces of Punjab and Bengal in darker shades, large princely states in grey, and arrows for the movement of refugees.",
    representation: "modern_map",
    representationNote: "A modern map; small princely states are shown as part of India or Pakistan.",
    depicts: ["partition-of-india"],
  },
  {
    file: "File:British Indian Empire 1909 Imperial Gazetteer of India.jpg",
    ref: "e_british_raj",
    title: "The British Indian Empire, a map of 1909",
    alt: "A printed map of British India and the princely states in colour, from the Imperial Gazetteer of India.",
    representation: "historical_map",
    representationNote: "From the Imperial Gazetteer of India, 1909.",
    needsUsBasis: true,
    usBasis: "published in 1909 in the Imperial Gazetteer of India: published before 1931, so public domain in the US.",
    depicts: ["british-raj"],
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "c1857-prose",
    block: {
      id: "gal-1857",
      type: "gallery",
      items: [
        {
          media: "m_residency",
          caption:
            "The ruins of the British Residency at Lucknow, photographed by Felice Beato in 1858, after the siege of 1857: the rising [Disraeli asked Parliament to see as a national revolt rather than a mutiny]({claim:In the House of Commons in July 1857, Disraeli}).",
        },
        {
          media: "m_1857_map",
          caption:
            "The fighting of 1857–59 as a British atlas mapped it in 1912, under the title “The Mutiny”: the name [Savarkar contested]({claim:In 1909 V. D. Savarkar recast}).",
        },
      ],
    },
  },
  {
    after: "congress-prose",
    block: {
      id: "fig-inc-1885",
      type: "figure",
      media: "m_inc_1885",
      size: "wide",
      caption:
        "Delegates to [the first Indian National Congress]({claim:The first Indian National Congress met in Bombay}), Bombay, December 1885. They asked for [elected members in the councils and civil-service examinations held in India]({claim:The first Congress asked}).",
    },
  },
  {
    after: "amritsar-prose",
    block: {
      id: "gal-amritsar",
      type: "gallery",
      items: [
        {
          media: "m_jb_entrance",
          caption:
            "The narrow way into Jallianwala Bagh, photographed in 1919. [Troops under General Dyer fired on the crowd]({claim:On 13 April 1919, at Jallianwala Bagh}) gathered in the walled ground beyond.",
        },
        {
          media: "m_jb_map",
          caption:
            "A plan of the Bagh from [the Congress's own inquiry]({claim:The Congress's own inquiry called}), published in 1920.",
        },
      ],
    },
  },
  {
    after: "c1930-prose",
    block: {
      id: "gal-1930",
      type: "gallery",
      items: [
        {
          media: "m_dandi",
          caption:
            "Gandhi picks up salt on the beach at Dandi at the end of [the Salt March]({claim:Before the Salt March, Gandhi wrote}), April 1930. Behind him are his son Manilal and Mithuben Petit.",
        },
        {
          media: "m_bhagat_singh",
          caption: "Bhagat Singh in 1929, the year he and B. K. Dutt [threw bombs into the Central Legislative Assembly]({claim:On 8 April 1929 Bhagat Singh}).",
        },
      ],
    },
  },
  {
    after: "c1947-prose",
    block: {
      id: "gal-1947",
      type: "gallery",
      items: [
        {
          media: "e_british_raj",
          caption:
            "India in 1909, from the Imperial Gazetteer: British India in red and pink, the princely states (“Native States”) in yellow. [In 1947 the Crown's suzerainty over those states lapsed]({claim:Under the 1947 Act, the Crown's suzerainty}).",
        },
        {
          media: "m_partition_map",
          caption:
            "India and Pakistan as they were divided in 1947, with Pakistan in two parts and Punjab and Bengal split between them; arrows show the refugees' movements. [The Indian Independence Act set up the two dominions]({claim:The Indian Independence Act 1947 set up}); [Partition displaced between 12 and 20 million people]({claim:Partition displaced}).",
        },
      ],
    },
  },
  {
    after: "nations-prose",
    block: {
      id: "fig-jinnah-gandhi",
      type: "figure",
      media: "m_jinnah_gandhi",
      caption:
        "Jinnah and Gandhi in 1944, photographed by Kulwant Roy. [Jinnah had told the Muslim League in 1940]({claim:At Lahore in March 1940 Jinnah}) that Hindus and Muslims were two nations; [Gandhi had written in 1909]({claim:Gandhi wrote in 1909}) that India could not cease to be one.",
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  await seedPageMedia(mcp, {
    page: "independence-movement",
    mediaTitle: "Pictures for the Independence movement page",
    mediaRationale: [
      "Freely licensed files from Wikimedia Commons for the Independence movement page: Felice Beato's 1858 photograph of the Lucknow Residency and a 1912 atlas map of the revolt; the first Congress in 1885; Jallianwala Bagh in 1919 and the Congress inquiry's plan of it; the Salt March and Dandi in 1930; Bhagat Singh in 1929 and at the National College, Lahore, in 1921; Jinnah and Gandhi in 1944; and portraits of people the page quotes (Jinnah, Disraeli, Marx, Dyer).",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot; apply checks the records against it. Every public-domain photograph also has a stated US status (PD-1996, PD-US or PD-old-100 tags) or the reasoning below. Photographs of 1947 were left out: still in copyright in India on 1 January 1996, their US copyright was restored. Partition is shown instead with a modern map under CC BY-SA 4.0.",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "Independence movement page: pictures in the chapters",
    pageRationale: [
      "Adds three figures (one a modern map of Partition) and three galleries, each beside the claims it shows, to the chapters, and the Salt March photograph as the lead image. Captions say what each picture shows, when it was made and by whom where Commons records it, and link the claims already on the page.",
      "No block is removed or changed; the new blocks follow the chapter prose they illustrate.",
    ].join("\n\n"),
    picks: PICKS,
    placements: PLACEMENTS,
    hero: "m_salt_march",
    retired: ["fig-partition-map"],
  });
// The National College photograph stays a record (and Bhagat Singh's entity picture) but is not placed: no claim on the page is about it.
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
