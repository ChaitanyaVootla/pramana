import type { CanvasItemView, CanvasLinkView, CanvasView } from "@pramana/services";

/** Canvas data as the browser has it (dates arrive as strings from the JSON route). */
export type Canvas = CanvasView;
export type Item = CanvasItemView;
export type Link = CanvasLinkView;

/** The words for each relation a line can carry. */
export const RELATION_WORDS: Record<string, string> = {
  supports: "supports",
  contradicts: "contradicts",
  causes: "led to",
  precedes: "came before",
  same_as: "same as",
  questions: "questions",
  related: "related to",
};

/** What each kind of item is called on its tile. */
export const KIND_WORDS: Record<string, string> = {
  claim: "Claim",
  entity: "Person, place or thing",
  chapter: "Part of a page",
  excerpt: "Quotation",
  media: "Picture",
  map: "Map",
  timeline: "Timeline",
  note: "Study note",
  viz: "Chart",
  text: "Your text",
  section: "Section",
};
