"use client";

import type { NoteSubjectType } from "@pramana/core";
import type { NoteView } from "@pramana/services";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setNoteStatusAction } from "@/app/notes/actions";
import { useLiveEvents } from "@/lib/useLiveEvents";
import type { NoteAction } from "./NoteCard";

// The notes' data, kept live, apart from how they are drawn (LiveNotes, NoteCard): the AI
// presence in the top bar is on every page and needs only this, not the markdown renderer.

export type NotesScope =
  /** Notes about one thing. `{ type: "general" }`: notes about nothing in particular. */
  | { subject: { type: NoteSubjectType; id?: string | null } }
  /** Notes that show on a page: about it, or posted while it was being read. */
  | { pageId: string }
  /** The latest notes about anything. */
  | { recent: true };

function query(scope: NotesScope, limit: number): string {
  const q = new URLSearchParams({ limit: String(limit) });
  if ("subject" in scope) {
    q.set("about", scope.subject.type);
    if (scope.subject.id) q.set("id", scope.subject.id);
  } else if ("pageId" in scope) q.set("page", scope.pageId);
  else q.set("scope", "all");
  return q.toString();
}

/** Link to the history, filtered to the same notes. */
export function historyHref(scope: NotesScope): string {
  if ("subject" in scope) {
    const q = new URLSearchParams({ about: scope.subject.type });
    if (scope.subject.id) q.set("id", scope.subject.id);
    return `/notes?${q}`;
  }
  if ("pageId" in scope) return `/notes?about=page&id=${scope.pageId}`;
  return "/notes";
}

/** Notes for a scope, kept live: new ones arrive over /api/events. */
export function useLiveNotes(
  scope: NotesScope,
  initial: NoteView[] | undefined,
  limit: number,
  /** The notes version `initial` was read at (notesWithVersion on the server). */
  initialVersion?: string,
) {
  const [notes, setNotes] = useState<NoteView[]>(initial ?? []);
  const [loaded, setLoaded] = useState(initial !== undefined);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const key = query(scope, limit + 1);
  const known = useRef<Set<string> | null>(initial ? new Set(initial.map((n) => n.id)) : null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The notes version the shown notes were read at, and the load in flight, if any.
  const version = useRef(initialVersion);
  const inflight = useRef<Promise<void> | null>(null);

  const load = useCallback(() => {
    inflight.current = (async () => {
      try {
        const res = await fetch(`/api/notes?${key}`, { cache: "no-store" });
        if (!res.ok) return;
        version.current = res.headers.get("X-Notes-Version") ?? undefined;
        const next = (await res.json()) as NoteView[];
        // The first load is not "new"; later arrivals fade in.
        if (known.current) {
          const before = known.current;
          const added = next.filter((n) => !before.has(n.id)).map((n) => n.id);
          if (added.length) setFresh(new Set(added));
        }
        known.current = new Set(next.map((n) => n.id));
        setNotes(next);
        setLoaded(true);
      } catch {
        // offline: keep what is shown
      }
    })().finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, [key]);

  useEffect(() => {
    if (!initial) void load();
  }, [key]);
  useLiveEvents((event) => {
    const reload = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(), 250);
    };
    if (event.table === "notes") return reload();
    // "hello" arrives on every (re)connect: catch up on anything posted while the stream was down,
    // once the load in flight has settled, and only if the notes changed since it was read.
    if (event.table === "hello")
      void (inflight.current ?? Promise.resolve()).then(() => {
        if (!event.notesVersion || event.notesVersion !== version.current) reload();
      });
  });

  const act = useCallback(
    async (note: NoteView, action: NoteAction) => {
      const status = action === "pin" ? "pinned" : action === "archive" ? "archived" : "live";
      const previous = notes;
      setNotes((list) =>
        action === "archive"
          ? list.filter((n) => n.id !== note.id)
          : list.map((n) => (n.id === note.id ? { ...n, status } : n)),
      );
      const result = await setNoteStatusAction(note.id, status);
      if (!result.ok) {
        setNotes(previous);
        toast.error(`Could not change the note: ${result.error}`);
        return;
      }
      if (action === "archive") {
        toast("Archived. It stays in your notes history.", {
          action: {
            label: "Undo",
            onClick: () => void setNoteStatusAction(note.id, note.status).then(() => load()),
          },
        });
      }
      void load();
    },
    [notes, load],
  );

  return { notes, loaded, fresh, act, reload: load };
}

