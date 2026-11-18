"use client";

import type { NoteView } from "@pramana/services";
import dynamic from "next/dynamic";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { historyHref, useLiveNotes, type NotesScope } from "./live-notes";

export { historyHref, useLiveNotes, type NotesScope } from "./live-notes";

// Loaded only when there is a note to show: it brings the markdown and chart renderers.
const NoteCard = dynamic(() => import("./NoteCard").then((m) => m.NoteCard));

/**
 * The AI's notes beside whatever the reader is looking at (marginalia, see
 * docs/visual.md §7). Renders nothing until there is a note, so it can sit on
 * any page. Pinned notes come first; the history at /notes keeps the rest.
 */
export function LiveNotes({
  initial,
  initialVersion,
  limit = 3,
  title = "From your AI",
  showSubject,
  layout = "stack",
  className,
  headingClassName,
  ...scope
}: NotesScope & {
  /** Server-rendered notes (avoids a fetch on load). */
  initial?: NoteView[];
  /** The notes version `initial` was read at (notesWithVersion), so "hello" reloads only if notes changed. */
  initialVersion?: string;
  limit?: number;
  title?: string;
  /** Say what each note is about (default: only for the latest notes about anything). */
  showSubject?: boolean;
  /** "row": side by side on wide screens (home, /learn); "stack" for rails and reading columns. */
  layout?: "stack" | "row";
  className?: string;
  headingClassName?: string;
}) {
  const s = scope as NotesScope;
  const { notes, fresh, act } = useLiveNotes(s, initial, limit, initialVersion);
  if (!notes.length) return null;
  const shown = notes.slice(0, limit);
  return (
    <section className={cn("font-sans", className)} aria-label={title}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={cn("text-ui font-semibold text-ink", headingClassName)}>{title}</h2>
        <Link href={historyHref(s)} className="text-sm text-ink-3 hover:text-ink">
          {notes.length > limit ? "All notes" : "Notes history"}
        </Link>
      </div>
      <ol
        className={cn(
          "mt-3",
          layout === "row" && shown.length > 1
            ? "grid gap-x-8 gap-y-6 lg:grid-cols-2 2xl:grid-cols-3"
            : "space-y-5",
        )}
      >
        {shown.map((n) => (
          <li key={n.id}>
            <NoteCard
              note={n}
              fresh={fresh.has(n.id)}
              showSubject={showSubject ?? "recent" in s}
              onAction={act}
            />
          </li>
        ))}
      </ol>
    </section>
  );
}
