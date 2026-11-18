/**
 * Sources for facts the novice copy on /p/gupta-empire wanted but no claim
 * supported (docs/research/2026-10-copy-needs-sources.md): that Prabhāvatīguptā
 * was regent for her young sons, and that the Western Satraps were Śakas,
 * Indo-Scythians. Used by copyedit-gupta.ts, which proposes them with the
 * prose that links them. Both rest on Wikipedia (tertiary), quoted from a
 * pinned revision; the Vākāṭaka grants themselves are not yet captured.
 */
import type { Mcp, PageViewJson } from "./copyedit-lib";
import { listNewClaims, newClaimOps, wikipedia, type ClaimSpec, type SourceSpec } from "./sources-lib";

const SOURCES = {
  wpPrabhavati: wikipedia("Prabhavatigupta"),
  wpSatraps: wikipedia("Western Satraps"),
} satisfies Record<string, SourceSpec>;

const CLAIMS: (ClaimSpec & { excerpts: { source: keyof typeof SOURCES }[] })[] = [
  {
    ref: "c_regency_sons",
    block: "chandragupta-claims",
    text: "Prabhāvatīguptā's three sons were all children when her husband died; she governed in the name of the eldest, the crown prince Divākarasena, and in her Pune grant calls herself “Mother of the Yuvaraja Divakarasena”.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From an encyclopedia, which reads it from her own copper-plate grant; the grant is not yet quoted here.",
    themes: ["polity"],
    entities: [{ entity: "prabhavatigupta", role: "subject" }],
    excerpts: [
      { source: "wpPrabhavati", quote: "Prabhavatigupta had three sons with Rudrasena - Divakarasena, Damodarasena, and Pravarasena – but none of them were adults at the time of their father's premature death.", locator: { section: "Early life" } },
      { source: "wpPrabhavati", quote: "Since he was still a child, Prabhavatigupta assumed the reigns of government and ruled in his name.", locator: { section: "Regent of the Vakataka Empire" } },
      { source: "wpPrabhavati", quote: "her Pune grant is dated to the thirteenth year of her own rule, where she calls herself \"Mother of the Yuvaraja Divakarasena\"", locator: { section: "Regent of the Vakataka Empire" } },
    ],
  },
  {
    ref: "c_satraps_saka",
    block: "chandragupta-claims",
    text: "The Western Satraps were Indo-Scythian, or Śaka, rulers of western and central India, whom Indians knew as Śakas.",
    kind: "fact",
    assessment: "supported",
    assessmentNote: "From an encyclopedia; their own coins and inscriptions are not yet quoted here.",
    themes: ["polity"],
    entities: [{ entity: "western-satraps", role: "subject" }],
    excerpts: [
      { source: "wpSatraps", quote: "were Indo-Scythian (Saka) rulers of the western and central parts of India", locator: { section: "Lead" } },
      { source: "wpSatraps", quote: "The western Kshatrapas were also known as Sakas to Indians.", locator: { section: "Name" } },
    ],
  },
];

export const guptaNewClaims = (mcp: Mcp, view: PageViewJson) => newClaimOps(SOURCES, CLAIMS, mcp, view);
export const listGuptaClaims = listNewClaims(CLAIMS);
