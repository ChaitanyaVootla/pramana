/**
 * Sources for facts the novice copy on /p/mahajanapadas wanted but no claim
 * supported (docs/research/2026-10-copy-needs-sources.md): where Aṅga and its
 * capital Campā lay. Used by copyedit-mahajanapadas.ts. Rhys Davids's
 * Buddhist India (1903), public domain, is already a source on the page; its
 * other identifications (Sāketa, Sāvatthi, Vesālī) are a century old and
 * partly superseded, so they are not used.
 */
import type { Mcp, PageViewJson } from "./copyedit-lib";
import { listNewClaims, newClaimOps, type ClaimSpec, type SourceSpec } from "./sources-lib";

const SOURCES = {
  buddhistIndia: { title: "Buddhist India", origin: { kind: "internet_archive", identifier: "buddhistindia00davirich" } },
} satisfies Record<string, SourceSpec>;

const CLAIMS: (ClaimSpec & { excerpts: { source: keyof typeof SOURCES }[] })[] = [
  {
    ref: "c_anga_champa",
    block: "sixteen-claims",
    text: "Rhys Davids placed the Aṅgas east of Magadha, with their capital at Campā, a site Cunningham identified with villages about twenty-four miles east of Bhagalpur; in the Buddha's time Aṅga was subject to Magadha.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "Rhys Davids (1903) following Cunningham's identification of the site.",
    themes: ["polity"],
    entities: [
      { entity: "magadha", role: "mention" },
      { entity: "t-w-rhys-davids", role: "author" },
    ],
    excerpts: [
      { source: "buddhistIndia", quote: "The Angas dwelt in the country to the east of Magadha, having their capital at Champa", locator: { page: "23", label: "“The Clans and Nations”" } },
      { source: "buddhistIndia", quote: "Its site has been identified by Cunningham with the modern villages of similar names twenty-four miles east of Bhagalpur", locator: { page: "35", label: "“The Clans and Nations”: on Campā" } },
      { source: "buddhistIndia", quote: "In the Buddha's time it was subject to Magadha, and we never hear of its having regained independence.", locator: { page: "24", label: "“The Clans and Nations”" } },
    ],
  },
];

export const mahajanapadasNewClaims = (mcp: Mcp, view: PageViewJson) => newClaimOps(SOURCES, CLAIMS, mcp, view);
export const listMahajanapadasClaims = listNewClaims(CLAIMS);
