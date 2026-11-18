/**
 * Second round of fixes on the Vedic page from the AI support checks
 * (verifier round 5): quotes for words the cited passages left out, and
 * stances that ground the assessment notes. Claims and citations only.
 *
 *   pnpm tsx scripts/seed/vedic-fixes2.ts [--withdraw | --approve-preview]
 */
import { runFixes } from "./fixes-lib";

const VEDIC = "The Vedic period (c. 1500–500 BCE): page, sources and entities";
const FIXES = "The Vedic period: accuracy fixes from the support checks";

await runFixes({
  title: "The Vedic period: support fixes, round 2",
  parents: [VEDIC, FIXES],
  page: "vedic-period",
  excerpts: [
    { ref: "vx3_mac_invalidated", like: "vx_mac_jacobi", quote: "The whole estimate is, however, invalidated by the assumption of a doubtful, and even improbable, meaning in a Vedic word, which forms the very starting-point of the theory.", locator: { page: "12" } },
    { ref: "vx3_jacobi_names", like: "vx_jacobi_gods", quote: "Here, then, we have Mitra, Varuna, Indra, and the Nasatyas or Asvins.", locator: { page: "723" } },
    { ref: "vx3_weber_first", like: "vx_eggeling_weber", quote: "To this important legend attention was first drawn by Professor Weber", locator: { volume: "1", page: "104", label: "Eggeling's note, after Weber" } },
    { ref: "vx3_weber_pointed", like: "vx_eggeling_weber", quote: "It was pointed out by Weber that this legend distinguishes three successive stages of the eastward migration of the Brahmanical Hindus.", locator: { volume: "1", page: "104", label: "Eggeling's note, after Weber" } },
    { ref: "vx3_rv_tenkings", like: "vx_rv_tenkings", quote: "Ten Kings who worshipped not, O Indra-Varuna, confederate, in war prevailed not o'er Sudas.", locator: { volume: "2", page: "80", verse: "RV 7.83.7" } },
    { ref: "vx3_rv_sindhu", like: "vx_rv_nadistuti", quote: "Sindhu in might surpasses all the streams that flow.", locator: { volume: "2", page: "490", verse: "RV 10.75.1" } },
  ],
  reword: {
    v_jacobi_early: {
      assessmentNote:
        "Macdonell (1900) rejected the astronomical dating as resting on “a doubtful, and even improbable, meaning in a Vedic word”. The Mitanni evidence shows Vedic gods by about 1400 BCE, not how much earlier.",
    },
  },
  add: [
    ["v_oit", "vx_wp_oit_status", "qualifies", "Grounds the assessment note: the standing of the idea in scholarship."],
    ["v_oit", "vx2_nar_plausible", "qualifies", "Grounds the assessment note: the genetic evidence against it."],
    ["v_indigenist_date", "vx_wp_oit_status", "qualifies", "Grounds the assessment note: the standing of the view in scholarship."],
    ["v_jacobi_early", "vx3_mac_invalidated", "qualifies", "Macdonell rejected the astronomical argument."],
    ["v_modern_date", "vx_mm_agreement", "supports", "The same range was already the consensus in 1890, though not proved."],
    ["v_mitanni", "vx3_jacobi_names", "supports"],
    ["v_videgha_reading", "vx3_weber_first", "supports"],
    ["v_videgha_reading", "vx3_weber_pointed", "supports"],
    ["v_tenkings", "vx3_rv_tenkings", "supports"],
    ["v_rivers", "vx3_rv_sindhu", "supports", "The hymn's first verse is to the Sindhu, the Indus."],
    ["v_ambedkar", "vx_ambedkar_inference", "mentions", "His argument against an Aryan race, background to the claim."],
  ],
  remove: [
    ["v_oit", "vx_wp_oit_status"],
    ["v_oit", "vx2_nar_plausible"],
    ["v_indigenist_date", "vx_wp_oit_status"],
    ["v_modern_date", "vx_mm_agreement"],
    ["v_ambedkar", "vx_ambedkar_inference"],
  ],
  rationale: [
    "Round 2 of fixes from the AI support checks of the Vedic page (verifier round 5).",
    "Stances: the Wikipedia status sentence and Narasimhan's “only plausible source” were cited as “mentions”, which does not ground the assessment notes; they are now “qualifies”. Max Müller's 1890 statement agrees with the 1500–1000 BCE range, so it now supports. Ambedkar's “inference only” becomes a mention, since the reworded claim rests on his other words.",
    "Quotes added from the same snapshots: Macdonell's rejection of Jacobi's astronomy (the note now says Macdonell rejected it, rather than “few scholars accepted”); Jacobi naming the four gods; Eggeling's credit to Weber; Ṛgveda 7.83.7 on the ten kings; 10.75.1 on the Sindhu.",
  ],
});
