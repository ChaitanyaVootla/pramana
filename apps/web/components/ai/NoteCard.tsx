"use client";

import type { VizSpec } from "@pramana/core";
import type { NoteView } from "@pramana/services";
import { Archive, ArchiveRestore, Pin, PinOff } from "lucide-react";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { Viz } from "@/components/Viz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clientLabel, SUBJECT_LABELS } from "./labels";
import { whenPosted } from "./time";

export type NoteAction = "pin" | "unpin" | "archive" | "restore";

/**
 * One note from the AI, as marginalia (docs/visual.md §7): sans, ink, a dotted
 * rule in ink-3; its visual in a field; who posted it and when in ink-3. A new
 * note fades in where it belongs.
 */
export function NoteCard({
  note,
  fresh = false,
  showSubject = false,
  onAction,
  className,
}: {
  note: NoteView;
  fresh?: boolean;
  /** Say what it is about (in the history and on general lists). */
  showSubject?: boolean;
  onAction?: (note: NoteView, action: NoteAction) => void;
  className?: string;
}) {
  const pinned = note.status === "pinned";
  const archived = note.status === "archived";
  const about = note.subject;
  return (
    <article
      className={cn(
        "marginalia font-sans",
        fresh && "animate-in fade-in-0 duration-200 motion-reduce:animate-none",
        archived && "opacity-70",
        className,
      )}
      aria-label={note.title}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-ui font-semibold text-ink">
          {pinned && (
            <Pin className="mr-1 inline size-3.5 -translate-y-px text-ink-3" aria-label="Pinned" />
          )}
          {note.title}
        </h3>
        {onAction && (
          <div className="-mt-1 -mr-1 flex shrink-0">
            {archived ? (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onAction(note, "restore")}
                title="Put back"
                aria-label={`Put back ${note.title}`}
              >
                <ArchiveRestore />
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onAction(note, pinned ? "unpin" : "pin")}
                  title={pinned ? "Unpin" : "Pin: keep it at the top"}
                  aria-label={`${pinned ? "Unpin" : "Pin"} ${note.title}`}
                  aria-pressed={pinned}
                >
                  {pinned ? <PinOff /> : <Pin />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onAction(note, "archive")}
                  title="Archive: take it off the page; it stays in your notes"
                  aria-label={`Archive ${note.title}`}
                >
                  <Archive />
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {(showSubject || note.anchorLabel) && (
        <p className="mt-0.5 text-sm text-ink-3">
          {showSubject && about.type !== "general" && (
            <>
              {SUBJECT_LABELS[about.type]}:{" "}
              {about.href ? (
                <Link
                  href={about.href}
                  className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink-3"
                >
                  {short(about.label) || "no longer here"}
                </Link>
              ) : (
                short(about.label) || "no longer here"
              )}
            </>
          )}
          {showSubject && about.type === "general" && "General"}
          {note.anchorLabel && (
            <>
              {showSubject ? ", " : ""}
              {note.anchorLabel}
            </>
          )}
        </p>
      )}
      <Markdown className="mt-1.5 space-y-2 text-ui text-ink [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-4 [&_li]:list-disc [&_ol>li]:list-decimal">
        {note.body}
      </Markdown>
      <NoteVisual note={note} />
      <p className="mt-1.5 text-sm text-ink-3">
        <time dateTime={new Date(note.createdAt).toISOString()} suppressHydrationWarning>
          {whenPosted(note.createdAt)}
        </time>
        , {byline(note)}
      </p>
    </article>
  );
}

/** Tallest a chart in a note may be, so a note stays marginalia (the field is capped at 14rem). */
const NOTE_PLOT_HEIGHT = 150;

/**
 * The note's visual in a field, capped in height. A timeline or map with
 * nothing to show is left out rather than drawn as an empty box.
 */
function NoteVisual({ note }: { note: NoteView }) {
  const viz = note.viz;
  if (!viz) return null;
  const data = note.vizData;
  if (viz.kind === "timeline" && (data?.kind !== "timeline" || data.items.length === 0))
    return null;
  if (viz.kind === "map" && (data?.kind !== "map" || data.features.length === 0)) return null;
  let spec: VizSpec = viz;
  if (viz.kind === "vega-lite") {
    const h = typeof viz.spec.height === "number" ? viz.spec.height : NOTE_PLOT_HEIGHT;
    spec = { ...viz, spec: { ...viz.spec, height: Math.min(h, NOTE_PLOT_HEIGHT) } };
  }
  return (
    <div
      className={cn(
        "field mt-2.5 p-2",
        viz.kind === "vega-lite" || viz.kind === "table"
          ? "max-h-56 overflow-auto"
          : "overflow-hidden",
      )}
    >
      <Viz spec={spec} data={data} />
    </div>
  );
}

/** "from your AI (Claude Code)", or just "from your AI" when the app's name would mean nothing to a reader. */
function byline(note: NoteView): string {
  if (!note.byAgent) return note.author;
  const app = clientLabel(note.client);
  return app ? `from your AI (${app})` : "from your AI";
}

function short(label: string): string {
  return label.length > 90 ? `${label.slice(0, 87)}…` : label;
}
