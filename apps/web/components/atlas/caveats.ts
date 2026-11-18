/**
 * Known limits of the border datasets, said where the reader is looking: on
 * hover or tap of an outline, and in a note under the atlas while such an
 * outline is drawn. Each is a statement about what the dataset draws (checked
 * against our copy of Cliopatria v0.2.1; see
 * docs/research/2026-10-ui-data-roadmap.md, "Cliopatria gap analysis"), not a
 * historical claim of our own; those belong in claims, with sources.
 *
 * Years are astronomical and inclusive.
 */
export interface Caveat {
  dataset: string;
  /** The dataset's own name for the row. */
  name: string;
  from: number;
  to: number;
  text: string;
}

const CLIOPATRIA = "cliopatria-v0.2.1";

export const CAVEATS: Caveat[] = [
  {
    dataset: CLIOPATRIA,
    name: "British Empire",
    from: 1757,
    to: 1858,
    text: "Company territory and the treaty states are drawn as one block.",
  },
  {
    dataset: CLIOPATRIA,
    name: "British Raj",
    from: 1859,
    to: 1947,
    text: "British-ruled India and the princely states are drawn as one block.",
  },
  {
    dataset: CLIOPATRIA,
    name: "Mughal Empire",
    from: 1811,
    to: 1856,
    text: "Drawn unchanged from 1811 to 1856; read it with care.",
  },
  {
    dataset: CLIOPATRIA,
    name: "Indus Valley Civilization",
    from: -2999,
    to: -1700,
    text: "A culture area, not a state; whether it was one polity is debated.",
  },
];

export function caveatFor(dataset: string, name: string, from: number, to: number): string | null {
  return (
    CAVEATS.find((c) => c.dataset === dataset && c.name === name && from <= c.to && to >= c.from)
      ?.text ?? null
  );
}

/**
 * What the atlas says when a year has no borders, for the gaps we know of.
 * Cliopatria has no South Asian state before 600 BCE except the Indus outline.
 */
/** The same, as an empty state over the map: what is missing, and why nothing is drawn. */
export function gapState(year: number): { title: string; why: string } {
  if (year >= -1699 && year < -599)
    return {
      title: "No borders are known for this time",
      why: "Cliopatria, the dataset we draw from, has no states here between the Indus civilisation and 600 BCE; nothing is drawn rather than something guessed.",
    };
  if (year < -2999)
    return {
      title: "No borders are drawn this early",
      why: "The datasets we draw from begin at 3000 BCE.",
    };
  return {
    title: "No borders are recorded for this year",
    why: "Nothing is drawn rather than something guessed.",
  };
}

export function gapNote(year: number): string {
  if (year >= -1699 && year < -599)
    return "No borders for this time: Cliopatria has no states here between the Indus civilisation and 600 BCE.";
  if (year < -2999) return "No borders are drawn this early.";
  return "No borders recorded for this year.";
}

/** Which reconstruction an outline is ("Cliopatria"), for "as drawn by …". */
export const DATASET_NAME: Record<string, string> = { [CLIOPATRIA]: "Cliopatria" };
