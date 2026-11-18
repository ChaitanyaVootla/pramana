import { z } from "zod";

/**
 * Controlled vocabularies. These are deliberately small and editorial; adding
 * a value is a schema change. Free-form nuance belongs in notes.
 */

export const ActorKind = z.enum(["human", "agent", "importer", "system"]);
export type ActorKind = z.infer<typeof ActorKind>;

export const EntityKind = z.enum([
  "period", // an age or era: "Mauryan period"
  "polity", // a state, empire, kingdom, republic
  "culture", // an archaeological culture or civilisation
  "event", // a battle, council, treaty, famine
  "person",
  "group", // a dynasty, community, sect, guild
  "place", // a city, region, river
  "site", // an archaeological site
  "text", // a literary or religious work (as an object of study)
  "inscription",
  "artifact",
  "concept", // dhamma, varna, a technology
  "institution",
  "term", // a glossary word explained for readers: "consecration", "stadion"
]);
export type EntityKind = z.infer<typeof EntityKind>;

export const EntityLinkType = z.enum([
  "part_of", // event part_of period; site part_of culture
  "located_in",
  "ruled", // person ruled polity
  "member_of", // person member_of dynasty
  "successor_of",
  "predecessor_of",
  "participant_in",
  "author_of",
  "contemporary_of",
  "related_to",
]);
export type EntityLinkType = z.infer<typeof EntityLinkType>;

/** Lenses for pages: the themes the user wants to learn by. */
export const Theme = z.enum([
  "overview",
  "polity", // empires, kingdoms, dynasties
  "governance", // administration, law, taxation
  "war", // conflict, military
  "economy", // trade, agriculture, money
  "society", // social structure, lifestyle, daily life
  "religion", // belief and practice, philosophy
  "culture", // art, literature, language
  "technology", // tools, metallurgy, science
  "infrastructure", // cities, roads, water
  "sources", // what the evidence is and how we know
  "historiography", // how interpretations changed
]);
export type Theme = z.infer<typeof Theme>;

/**
 * Historiographical schools and viewpoints a claim can be associated with.
 * A tag, not a judgment: it records where a reading comes from.
 */
export const Lens = z.enum([
  "primary_source", // what the source itself says
  "archaeological",
  "philological",
  "genetic",
  "colonial_orientalist",
  "nationalist",
  "marxist",
  "cambridge_school",
  "subaltern",
  "revisionist",
  "indigenist", // e.g. "Out of India" readings
  "popular", // textbooks, media, folk belief
  "mainstream_academic", // current scholarly consensus, where one exists
]);
export type Lens = z.infer<typeof Lens>;

export const ClaimKind = z.enum([
  "fact", // a statement about what happened or existed
  "interpretation", // a reading of evidence; schools may differ
  "misconception", // a popular belief, recorded so it can be examined
  "debate", // a question on which scholars disagree
  "open_question", // unknown with current evidence
]);
export type ClaimKind = z.infer<typeof ClaimKind>;

/** Editorial assessment of the evidence for a claim. Never a vote count. */
export const Assessment = z.enum([
  "unassessed",
  "well_supported", // multiple independent, reliable sources; little dispute
  "supported",
  "contested", // serious scholars disagree
  "weak", // thin or unreliable evidence
  "refuted", // the evidence is against it
]);
export type Assessment = z.infer<typeof Assessment>;

export const ClaimRelationType = z.enum([
  "supports",
  "contradicts",
  "qualifies", // adds a condition or nuance
  "context_for",
  "corrects", // the source claim corrects a misconception (target)
  "same_as", // duplicate wording of the same proposition
]);
export type ClaimRelationType = z.infer<typeof ClaimRelationType>;

/** How an excerpt bears on a claim (cf. scite.ai's supporting/contrasting/mentioning). */
export const Stance = z.enum(["supports", "contradicts", "qualifies", "mentions"]);
export type Stance = z.infer<typeof Stance>;

export const SourceKind = z.enum([
  "work", // an abstract work (the Arthashastra, the Rigveda)
  "edition", // a published edition or translation of a work
  "book",
  "chapter",
  "article",
  "inscription_corpus",
  "inscription",
  "manuscript",
  "report", // excavation or survey report
  "webpage",
  "wiki_article", // Wikipedia and similar: tertiary, discovery only
  "dataset",
  "map",
  "image",
  "other",
]);
export type SourceKind = z.infer<typeof SourceKind>;

/** Primary: from the period or direct evidence. Secondary: scholarship. Tertiary: encyclopedias, textbooks. */
export const SourceTier = z.enum(["primary", "secondary", "tertiary"]);
export type SourceTier = z.infer<typeof SourceTier>;

export const LicenseStatus = z.enum([
  "public_domain",
  "open", // an open licence (see spdx)
  "copyrighted", // quote briefly with attribution only
  "unknown",
]);
export type LicenseStatus = z.infer<typeof LicenseStatus>;

export const PageKind = z.enum(["overview", "era", "entity", "theme", "misconceptions", "guide"]);
export type PageKind = z.infer<typeof PageKind>;

export const PageStatus = z.enum(["draft", "published"]);
export type PageStatus = z.infer<typeof PageStatus>;

export const ChangesetStatus = z.enum(["proposed", "applied", "rejected", "withdrawn", "failed"]);
export type ChangesetStatus = z.infer<typeof ChangesetStatus>;
