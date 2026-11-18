/**
 * "Ask your AI about this": a ready-made prompt naming exactly one thing on the
 * site, with its id, for the reader to paste into their AI client. The same
 * text backs the MCP prompts, so a client that lists prompts gets the same ask.
 */

export type AskSubject =
  | { type: "claim"; id: string; label: string }
  | { type: "chapter"; page: string; chapter: string; label: string; pageTitle?: string }
  | { type: "page"; page: string; label: string }
  | { type: "entity"; entity: string; label: string }
  | { type: "source"; id: string; label: string }
  | { type: "canvas"; id: string; label: string };

/**
 * The six asks, in the order /connect lists them: the MCP prompt's name and title, what the reader
 * gets, and where the "Ask your AI" button for it is on the site.
 */
export const ASKS = [
  {
    prompt: "explain_claim",
    title: "Explain a claim and its evidence",
    description: "The evidence behind one claim: sources, passages, how far it is checked.",
    where: "On any claim",
  },
  {
    prompt: "explain_chapter",
    title: "Explain a chapter",
    description: "One chapter of a page in plain words: what is certain, what is debated.",
    where: "Beside each part of a page",
  },
  {
    prompt: "explain_page",
    title: "Give an overview of a page",
    description: "The big picture of a page: turning points and where historians disagree.",
    where: "At the top of a page",
  },
  {
    prompt: "explain_entity",
    title: "Tell me about a person, place or event",
    description: "Who or what it was, when, why it matters, and the evidence.",
    where: "On any person, place or event",
  },
  {
    prompt: "explain_source",
    title: "Tell me about a source",
    description: "What kind of source it is, how reliable, and which claims rest on it.",
    where: "On any source",
  },
  {
    prompt: "explain_canvas",
    title: "Look at my canvas",
    description: "How the pieces on a canvas connect, and what is missing or contested.",
    where: "On your canvases",
  },
] as const;

export type AskPromptName = (typeof ASKS)[number]["prompt"];

/** Quotes a label for a prompt: one line, at most 160 characters. */
function q(label: string): string {
  const flat = label.replace(/\s+/g, " ").trim();
  return `“${flat.length > 160 ? `${flat.slice(0, 157)}…` : flat}”`;
}

/** Retrieval first: the reader tries before being told (it is what makes it stick). */
const TRY_FIRST =
  "Before you explain, ask me one short question about what I already think, and wait for my answer.";

export function askPrompt(s: AskSubject): string {
  const tail = (about: string) =>
    `Cite claim ids and say how well each is verified. Then put a short answer beside it in Pramāṇa with post_note (about: ${about}).`;
  switch (s.type) {
    case "claim":
      return [
        `In Pramāṇa, explain the claim ${q(s.label)} (claim ${s.id}).`,
        TRY_FIRST,
        "Use get_claim to show me the evidence behind it: the sources, the exact passages, how far each has been checked, and any claims that disagree or correct it.",
        tail(`{"type": "claim", "id": "${s.id}"}`),
      ].join(" ");
    case "chapter":
      return [
        `In Pramāṇa, help me understand the chapter ${q(s.label)}${s.pageTitle ? ` of ${q(s.pageTitle)}` : ""} (page ${s.page}, chapter ${s.chapter}).`,
        TRY_FIRST,
        "Use get_page to read it, then explain the main points in plain words, what is certain and what is debated, and how we know.",
        tail(`{"type": "page", "page": "${s.page}", "chapter": "${s.chapter}"}`),
      ].join(" ");
    case "page":
      return [
        `In Pramāṇa, give me an overview of the page ${q(s.label)} (page ${s.page}).`,
        TRY_FIRST,
        "Use get_page to read it, then explain the big picture, the key turning points and where historians disagree.",
        tail(`{"type": "page", "page": "${s.page}"}`),
      ].join(" ");
    case "entity":
      return [
        `In Pramāṇa, tell me about ${q(s.label)} (entity ${s.entity}).`,
        TRY_FIRST,
        "Use get_entity for its dates, names, links and claims: who or what it was, when, why it matters, and what the evidence is.",
        tail(`{"type": "entity", "entity": "${s.entity}"}`),
      ].join(" ");
    case "source":
      return [
        `In Pramāṇa, tell me about the source ${q(s.label)} (source ${s.id}).`,
        TRY_FIRST,
        "Use get_source: what kind of source it is, who wrote it and when, how reliable it is for what, and which claims rest on it.",
        tail(`{"type": "source", "id": "${s.id}"}`),
      ].join(" ");
    case "canvas":
      return [
        `In Pramāṇa, look at my canvas ${q(s.label)} (canvas ${s.id}).`,
        TRY_FIRST,
        "Use canvas_get to read what is on it, then explain how the pieces connect, and point out what is missing or contested.",
        tail(`{"type": "canvas", "id": "${s.id}"}`),
      ].join(" ");
  }
}

/**
 * The ask in a reader's words, without ids or tool names (those stay in askPrompt, for the AI):
 * what the button's tooltip and previews show.
 */
export function askQuestion(s: AskSubject): string {
  switch (s.type) {
    case "claim":
      return `Explain the claim ${q(s.label)} and the evidence behind it, asking first what I think.`;
    case "chapter":
      return `Help me understand ${q(s.label)}${s.pageTitle ? ` in ${q(s.pageTitle)}` : ""}: what is certain, what is debated, and how we know.`;
    case "page":
      return `Give me an overview of ${q(s.label)}: the turning points and where historians disagree.`;
    case "entity":
      return `Tell me about ${q(s.label)}: who or what it was, when, why it matters, and the evidence.`;
    case "source":
      return `Tell me about the source ${q(s.label)}: what kind it is, how reliable, and which claims rest on it.`;
    case "canvas":
      return `Look at my canvas ${q(s.label)}: how the pieces connect, and what is missing or contested.`;
  }
}
