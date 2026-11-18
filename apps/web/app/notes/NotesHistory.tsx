"use client";

import type { NoteView } from "@pramana/services";
import { useRouter } from "next/navigation";
import { useOptimistic, useRef, useTransition } from "react";
import { toast } from "sonner";
import { NoteCard, type NoteAction } from "@/components/ai/NoteCard";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { cn } from "@/lib/utils";
import { setNoteStatusAction } from "./actions";

const STATUS: Record<NoteAction, NoteView["status"]> = {
  pin: "pinned",
  unpin: "live",
  archive: "archived",
  restore: "live",
};

/** The history list: every note with what it is about; pin, archive and put back. Live. */
export function NotesHistory({ notes, className }: { notes: NoteView[]; className?: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [shown, setShown] = useOptimistic(
    notes,
    (list, change: { id: string; status: NoteView["status"] }) =>
      list.map((n) => (n.id === change.id ? { ...n, status: change.status } : n)),
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useLiveEvents((event) => {
    if (event.table !== "notes") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 300);
  });

  const act = (note: NoteView, action: NoteAction) =>
    start(async () => {
      setShown({ id: note.id, status: STATUS[action] });
      const result = await setNoteStatusAction(note.id, STATUS[action]);
      if (!result.ok) toast.error(`Could not change the note: ${result.error}`);
      router.refresh();
    });

  if (!shown.length) return null;
  return (
    <section aria-labelledby="notes-list-heading" className={className}>
      {/* Each note's title is an h3, so the list needs its h2. */}
      <h2 id="notes-list-heading" className="sr-only">
        The notes
      </h2>
      {/* Wide screens hold two columns of notes (docs/visual.md §3); the rows read down each column. */}
      <ol className="space-y-8 2xl:grid 2xl:grid-cols-2 2xl:gap-x-14 2xl:gap-y-8 2xl:space-y-0">
        {shown.map((n) => (
          <li key={n.id}>
            <NoteCard note={n} showSubject onAction={act} />
          </li>
        ))}
      </ol>
    </section>
  );
}
