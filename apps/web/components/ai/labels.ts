import type { NoteSubjectType } from "@pramana/core";

/** What a note can be about, in a reader's words. */
export const SUBJECT_LABELS: Record<NoteSubjectType, string> = {
  general: "General",
  page: "Page",
  entity: "Person, place or thing",
  claim: "Claim",
  source: "Source",
  canvas: "Canvas",
};

/** The same, as filter names on the notes history. */
export const SUBJECT_FILTERS: Record<NoteSubjectType, string> = {
  general: "General",
  page: "Pages and chapters",
  entity: "People, places and things",
  claim: "Claims",
  source: "Sources",
  canvas: "Canvases",
};

/** AI apps' self-reported names, in the words a reader knows. */
const CLIENT_NAMES: Record<string, string> = {
  "claude-code": "Claude Code",
  "claude-ai": "Claude Desktop",
  "claude-desktop": "Claude Desktop",
  cursor: "Cursor",
};

/**
 * The AI app a session or note came from ("Claude Desktop"), or null when it gave no name a reader
 * would know: a script's or test's own handle means nothing to them.
 */
export function clientLabel(name: string | null | undefined): string | null {
  // mcp-remote passes the app's own name through, with " (via mcp-remote …)" after it.
  const app = name?.replace(/\s*\(via mcp-remote[^)]*\)\s*$/i, "").trim().toLowerCase();
  return app ? (CLIENT_NAMES[app] ?? null) : null;
}
