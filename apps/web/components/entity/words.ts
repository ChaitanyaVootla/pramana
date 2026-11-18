import type { EntityDetail } from "@pramana/services";

/** What kind of thing this is, as the line above the name. */
export const KIND_SENTENCE: Record<string, string> = {
  period: "An age of Indian history",
  polity: "A state: an empire, kingdom or republic",
  culture: "An archaeological culture",
  event: "An event",
  person: "A person",
  group: "A dynasty or community",
  place: "A place",
  site: "An archaeological site",
  text: "A text",
  inscription: "An inscription",
  artifact: "An object",
  concept: "An idea",
  institution: "An institution",
  term: "A word to know",
};

export const SPAN_ROLE: Record<string, string> = {
  life: "Lifetime",
  reign: "Reign",
  floruit: "Known to be active",
  existence: "Existed",
  construction: "Made",
  activity: "Took place",
};

const LINK_OUT: Record<string, string> = {
  part_of: "Part of",
  located_in: "Located in",
  ruled: "Ruled",
  member_of: "Member of",
  successor_of: "Came after",
  predecessor_of: "Came before",
  participant_in: "Took part in",
  author_of: "Author of",
  contemporary_of: "At the same time as",
  related_to: "Related to",
};
const LINK_IN: Record<string, string> = {
  part_of: "Includes",
  located_in: "Here",
  ruled: "Ruled by",
  member_of: "Members",
  successor_of: "Followed by",
  predecessor_of: "Preceded by",
  participant_in: "Who took part",
  author_of: "Written by",
  contemporary_of: "At the same time as",
  related_to: "Related to",
};

export const CERTAINTY_SENTENCE: Record<string, string> = {
  exact: "The location is known.",
  approximate: "The location is approximate.",
  conjectural: "The location is a scholarly guess.",
};

const LANGS = new Intl.DisplayNames(["en"], { type: "language" });
const LANG_EXTRA: Record<string, string> = {
  pra: "Prakrit",
  pi: "Pali",
  inc: "Indic",
  grc: "Ancient Greek",
  "sa-Latn": "Sanskrit, romanised",
};

/** "Prakrit, in Latin letters" for "pra-Latn". Call on the server: ICU data differs between Node and browsers. */
export function languageName(tag: string | undefined): string | null {
  if (!tag) return null;
  if (LANG_EXTRA[tag]) return LANG_EXTRA[tag];
  const [base, script] = tag.split("-");
  let name = LANG_EXTRA[base!] ?? base!;
  try {
    if (!LANG_EXTRA[base!]) name = LANGS.of(base!) ?? base!;
  } catch {
    /* keep the tag */
  }
  return script === "Latn" ? `${name}, in Latin letters` : name;
}

/** Links grouped by a plain phrase for their direction ("Ruled", "Ruled by"). */
export function groupLinks(links: EntityDetail["links"]) {
  const groups = new Map<string, EntityDetail["links"]>();
  for (const l of links) {
    if (!l.other) continue;
    const phrase =
      (l.direction === "out" ? LINK_OUT : LINK_IN)[l.type] ?? l.type.replace(/_/g, " ");
    groups.set(phrase, [...(groups.get(phrase) ?? []), l]);
  }
  return [...groups.entries()];
}
