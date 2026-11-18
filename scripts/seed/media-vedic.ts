/**
 * Pictures for the Vedic period page, proposed THROUGH MCP as the agent acting
 * for the local user: media records for hand-checked Wikimedia Commons files
 * (licence, author and credit read from the API by the MCP server, never typed
 * here), then figures placed after the chapter prose whose claims they show,
 * and a lead image.
 *
 *   pnpm tsx scripts/seed/media-vedic.ts                    # propose both changesets
 *   … --media-only        # only the media records (no page edit)
 *   … --depends-on=<id>   # a pending changeset that creates the depicted entities
 *   … --approve-preview   # also apply (only when DATABASE_URL names a preview db)
 *
 * The hymns were oral: every surviving manuscript is thousands of years
 * younger than the text, and the caption says so. (Several Commons files put
 * the hymns' date in the file name, "1500-1200 BCE, Rigveda manuscript …";
 * they are not used.) Painted Grey Ware is the period's own material.
 */
import { connectMcp } from "../lib/mcp-client";
import { closeDbIfOpen } from "../lib/proposal";
import { flags, seedPageMedia, usBasisNotes, type Pick, type Placement } from "./media-lib";

const PICKS: Pick[] = [
  {
    file: "File:PGW fragments BM.jpg",
    ref: "v_pgw",
    title: "Painted Grey Ware",
    alt: "Shards of light grey pottery painted with black dots, bands and curved lines, mounted in a museum case.",
    representation: "photograph_of_object",
    objectDate: { edtf: "-0999~", label: "about 1000 BCE", basis: "the British Museum's label" },
    depicts: ["painted-grey-ware", "hastinapur"],
    focus: { x: 0.5, y: 0.5 },
  },
  {
    file: "File:Rigveda MS2097.jpg",
    ref: "v_rigveda_ms",
    title: "A Ṛgveda manuscript of the early 19th century",
    alt: "Two pages of a paper manuscript written in Devanagari, with red marks and corrections in the margins.",
    representation: "photograph_of_object",
    representationNote: "Copied on paper in India in the early 19th century, much later than the hymns themselves.",
    needsUsBasis: true,
    usBasis: "a manuscript of the early 19th century, reproduced as a flat page (PD-Art): no copyright in the US or anywhere.",
    depicts: ["rigveda"],
  },
  {
    file: "File:Friedrich Max-Müller, negative, 1883 (by Alexander Bassano; NPG x96553).png",
    ref: "v_max_muller",
    title: "Max Müller, 1883",
    alt: "A photograph of Max Müller, an elderly man with white side-whiskers, seated writing at a desk.",
    representation: "historical_photograph",
    needsUsBasis: true,
    usBasis: "a photograph by Alexander Bassano, 1883: made more than 120 years ago, so public domain in the US whether or not published.",
    depicts: ["max-muller"],
  },
  {
    file: "File:Ghaggar river in Panchkula.jpg",
    ref: "e_ghaggar",
    title: "The Ghaggar river in Haryana",
    alt: "A wide, shallow river with sandy banks under a grey sky.",
    representation: "photograph_of_site",
    depicts: ["ghaggar-hakra-river"],
  },
];

const PLACEMENTS: Placement[] = [
  {
    after: "text-prose",
    block: {
      id: "fig-rigveda-ms",
      type: "figure",
      media: "v_rigveda_ms",
      caption:
        "A Ṛgveda manuscript on paper, which Commons dates to the early 19th century: much later than the hymns themselves, which [were composed and handed down by mouth long before they were written down]({claim:The Vedic hymns were composed and handed down by mouth}).",
    },
  },
  {
    after: "hymns-prose",
    block: {
      id: "fig-ghaggar",
      type: "figure",
      media: "e_ghaggar",
      caption:
        "The Ghaggar in Haryana today. [In 1893 C. F. Oldham argued that the dry Hakra channel continued the Sarasvatī]({claim:In 1893, before the Indus civilisation was known}), the river [the hymns praise as a great stream]({claim:The Rigveda praises the river Sarasvatī}).",
    },
  },
  {
    after: "politics-prose",
    block: {
      id: "fig-max-muller",
      type: "figure",
      media: "v_max_muller",
      caption:
        "Max Müller, photographed by Alexander Bassano in 1883. [In 1888 he insisted that “Aryan” named those who speak an Aryan language, not a race]({claim:Max Müller insisted in 1888}).",
    },
  },
  {
    after: "iron-prose",
    block: {
      id: "fig-pgw",
      type: "figure",
      media: "v_pgw",
      size: "wide",
      caption:
        "[Painted Grey Ware]({claim:Painted Grey Ware, an Iron Age culture}), from Hastinapura and other sites, about 1000 BCE: thin grey pottery painted in black. It [probably belongs to the later Vedic period and the Kuru-Pañcāla lands]({claim:Painted Grey Ware probably corresponds}). British Museum.",
    },
  },
];

const mcp = await connectMcp("pramana-seed");
try {
  await seedPageMedia(mcp, {
    page: "vedic-period",
    mediaTitle: "Pictures for the Vedic period page",
    mediaRationale: [
      "Freely licensed files from Wikimedia Commons for the Vedic period page: Painted Grey Ware shards in the British Museum, an early 19th-century Ṛgveda manuscript, Max Müller photographed by Bassano in 1883, and the Ghaggar river (already on the platform).",
      "Each file's licence, author and source were read from the Commons API and stored as a snapshot; apply checks the records against it. Commons files whose names give the hymns' date as if it were the manuscript's (“1500-1200 BCE, Rigveda manuscript page”) were not used.",
      usBasisNotes(PICKS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    pageTitle: "Vedic period page: pictures in the chapters",
    pageRationale:
      "Adds four figures after the chapter prose whose claims they show, and Painted Grey Ware as the lead image. The manuscript caption says plainly that it is much later than the hymns. No block is removed or changed.",
    picks: PICKS,
    placements: PLACEMENTS,
    hero: "v_pgw",
  });
} finally {
  await mcp.close();
  await closeDbIfOpen(flags);
}
