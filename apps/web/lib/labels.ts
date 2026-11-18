import type { Theme } from "@pramana/core";

/** User-facing words for internal vocabularies. One place, so the interface stays consistent. */

export const THEME_LABELS: Record<Theme, string> = {
  overview: "Overview",
  polity: "Empire and state",
  governance: "Governance",
  war: "War",
  economy: "Economy and trade",
  society: "Society and daily life",
  religion: "Religion and thought",
  culture: "Art and language",
  technology: "Technology",
  infrastructure: "Cities and infrastructure",
  sources: "How we know",
  historiography: "Changing interpretations",
};

export const ASSESSMENT_LABELS: Record<string, string> = {
  unassessed: "Not yet assessed",
  well_supported: "Well supported",
  supported: "Supported",
  contested: "Contested",
  weak: "Weakly supported",
  refuted: "Refuted",
};

export const KIND_LABELS: Record<string, string> = {
  fact: "Fact",
  interpretation: "Interpretation",
  misconception: "Popular belief",
  debate: "Open debate",
  open_question: "Open question",
};

export const STANCE_LABELS: Record<string, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  qualifies: "Qualifies",
  mentions: "Mentions",
};

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  unchecked: "Quote not yet checked",
  exact: "Quote exact: found word for word in the stored source text",
  fuzzy: "Quote found in the stored source text, with small differences (likely scanning errors)",
  not_found: "Quote not found in the stored source text",
  no_snapshot: "No stored copy of the source to check against",
  no_quote: "Cited by location only; no quotation recorded",
  human_attested: "Checked by a person against the source",
};

export const SUPPORT_LABELS: Record<string, string> = {
  unchecked: "Support not yet reviewed",
  ai_supports: "An AI reviewer judged that this quotation supports the claim",
  ai_partial: "An AI reviewer judged that this quotation backs only part of the claim",
  ai_unsupported: "An AI reviewer judged that this quotation does not support the claim",
  human_confirmed: "Confirmed by a person",
  human_partial: "A person judged that this quotation backs only part of the claim",
  human_rejected: "Rejected by a person",
};

export const LENS_LABELS: Record<string, string> = {
  primary_source: "Sources of the time",
  archaeological: "Archaeology",
  philological: "Philology",
  genetic: "Genetics",
  colonial_orientalist: "Colonial-era scholarship",
  nationalist: "Nationalist historiography",
  marxist: "Marxist historiography",
  cambridge_school: "Cambridge school",
  subaltern: "Subaltern studies",
  revisionist: "Revisionist",
  indigenist: "Indigenist",
  popular: "Popular belief",
  mainstream_academic: "Current scholarship",
};

export const TIER_LABELS: Record<string, string> = {
  primary: "Source from the time",
  secondary: "Modern scholarship",
  tertiary: "Reference work",
};

/** What each kind of source is, for a first-time reader. */
export const TIER_GLOSS: Record<string, string> = {
  primary: "the nearest evidence to the events, told from its writer's point of view",
  secondary: "a modern historian's study",
  tertiary: "an encyclopedia or handbook: good for finding sources, weak as evidence",
};

export function assessmentTone(
  assessment: string,
  kind?: string,
): "indigo" | "turmeric" | "madder" | "neutral" {
  if (assessment === "refuted") return "madder";
  if (
    assessment === "contested" ||
    assessment === "weak" ||
    kind === "misconception" ||
    kind === "debate"
  )
    return "turmeric";
  if (assessment === "well_supported" || assessment === "supported") return "indigo";
  return "neutral";
}

/** What each kind of thing in the history of changes is called (event subjects and action nouns). */
export const RECORD_NOUNS: Record<string, string> = {
  changeset: "proposed change",
  entity: "subject",
  entity_link: "link between subjects",
  source: "source",
  excerpt: "quotation",
  claim: "claim",
  citation: "citation",
  claim_relation: "link between claims",
  page: "page",
  snapshot: "stored copy of a source",
  note: "AI note",
  card: "card",
  cards: "cards",
  canvas: "canvas",
  chapter: "part",
  check: "check question",
  guess: "guess",
  belief: "belief",
  first_steps: "first steps",
  extent: "border",
  media: "picture",
  view: "your view",
  user_view: "your view",
  learner: "learner",
  maintenance: "upkeep",
};

/** Whole phrases where noun and verb together would read oddly. */
const ACTION_PHRASES: Record<string, string> = {
  "belief.recorded": "Answered “Did you believe this?”",
  "guess.recorded": "Guess answered",
  "guess.skipped": "Guess skipped",
  "check.answered": "Check question answered",
  "chapter.read": "Part read in full",
  "chapter.skimmed": "Part's summary read",
  "first_steps.answered": "First steps answered",
  "cards.added": "Cards added to your reviews",
  "card.reviewed": "Card reviewed",
  "view.changed": "Your view changed",
  "view.undone": "Your view put back",
  "maintenance.bounds_recomputed": "Dates worked out again",
  "maintenance.search_recomputed": "Search rebuilt",
};

const ACTION_VERBS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "removed",
  proposed: "proposed",
  applied: "approved and applied",
  rejected: "rejected",
  withdrawn: "withdrawn",
  failed: "failed to apply",
  captured: "stored",
  verified: "re-checked",
  attested: "checked by a person",
  support_checked: "support reviewed",
  posted: "posted",
  archived: "archived",
  reviewed: "reviewed",
  added: "added",
  arranged: "tidied",
  items_added: "items added",
  items_removed: "items removed",
  links_added: "links added",
  links_removed: "links removed",
  kept: "kept",
  taken_back: "taken back",
};

/** "claim.created" as "Claim created", "canvas.items_added" as "Canvas items added". */
export function humanizeAction(action: string): string {
  if (ACTION_PHRASES[action]) return ACTION_PHRASES[action];
  const [subject = "", verb = ""] = action.split(".");
  const noun = RECORD_NOUNS[subject] ?? subject.replace(/_/g, " ");
  const words = `${noun} ${ACTION_VERBS[verb] ?? verb.replace(/_/g, " ")}`.trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Who did something, in plain words, never a raw handle: a person by name,
 * an AI agent as "your AI", the preview's automatic approvals as "the preview
 * pipeline", an import as "an importer".
 */
export function actorName(actor: { kind: string; displayName: string } | null | undefined): string {
  if (!actor) return "someone";
  if (actor.kind === "human") return actor.displayName;
  if (actor.kind === "agent") return "your AI";
  if (actor.kind === "importer") return "an importer";
  return "the preview pipeline";
}

/** Who approved a change: "Chaitanya", "your AI, as you asked" (the standing instruction), "the preview pipeline". */
export function approverName(decidedBy: { kind: string; displayName: string } | null | undefined, delegated: boolean): string {
  const name = actorName(decidedBy);
  return delegated && decidedBy?.kind === "agent" ? `${name}, as you asked` : name;
}

/** 4 → "4th". */
export function ordinal(n: number): string {
  const t = n % 100;
  const suffix = t >= 11 && t <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** "How sure are you?", asked before an answer is shown (see SURENESS_PERCENT in core). */
export const SURENESS_LABELS: Record<"low" | "medium" | "high", string> = {
  low: "Just a guess",
  medium: "Fairly sure",
  high: "Sure",
};

/** "Did you believe this?" on a misconception. */
export const BELIEF_LABELS: Record<"yes" | "no" | "unsure", string> = {
  yes: "Yes, I did",
  no: "No",
  unsure: "Not sure",
};

/**
 * What an assessment means, in a sentence: it judges the claim against all the
 * evidence and scholarship, which is not the same as how well its quotation
 * has been checked (the seal).
 */
export const ASSESSMENT_GLOSS: Record<string, string> = {
  unassessed: "Nobody has yet weighed this claim against the evidence.",
  well_supported: "Our judgement: several independent sources agree.",
  supported: "Our judgement: the evidence supports it.",
  contested: "Our judgement: historians disagree about this.",
  weak: "Our judgement: the evidence for this reading is thin, or few historians now hold it. The squares are about the quotation, not this.",
  refuted: "Our judgement: the evidence is against it.",
};

/**
 * Why each evidence-seal level matters to a reader: one plain sentence per
 * level, for the seal key (the "what" is `sealWords` in EvidenceSeal). The seal
 * measures how far the sourcing has been checked, not whether a claim is true.
 */
export const SEAL_WHY: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "Treat it as a lead, not a fact, until someone says where it comes from.",
  1: "You know where to look, but no one has yet confirmed the source says this.",
  2: "The words really are in the source. Whether they back the claim is a separate question.",
  3: "A second reading agrees the quote says what it is cited for: that it backs the claim, or goes against it. AI readers can be wrong, so it is not the last word.",
  4: "Someone compared the claim with the source and confirmed it: the most the squares can say.",
};

export const SEAL_NOT_TRUTH =
  "The squares are about the sourcing, not the truth: a well-checked claim can still be contested, and our assessment says how it stands.";

/** Lint warnings a reader sees, in plain words (the codes' messages are written for editors). */
export const ISSUE_PLAIN: Record<string, string> = {
  tertiary_only:
    "So far this rests only on an encyclopedia. The next step is to trace it to the sources the encyclopedia cites.",
  well_supported_needs_two:
    "Judged well supported, but fewer than two independent sources have been checked yet.",
  quote_not_found: "One quotation was not found in our copy of its source. Read it with care.",
};
