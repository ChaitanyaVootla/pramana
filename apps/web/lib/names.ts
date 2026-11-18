import type { EntityCard } from "@pramana/services";

/** The first letter of an entity's name, in Devanagari when it has a Devanagari name: the stand-in when there is no picture. */
export function initialOf(entity: Pick<EntityCard, "aliases" | "label">): {
  char: string;
  lang?: string;
} {
  const deva = entity.aliases.find((a) => a.script === "Deva");
  if (deva) return { char: [...deva.label][0] ?? "", lang: deva.lang };
  return { char: [...entity.label][0] ?? "" };
}
