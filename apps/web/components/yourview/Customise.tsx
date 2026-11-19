"use client";

import { describeUserView, isEmptyView, panelWords, type AtlasStop, type ViewPanel } from "@pramana/core";
import type { NoteView } from "@pramana/services";
import { Bookmark, CircleHelp, NotebookPen, SlidersHorizontal, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segments } from "@/components/ui/segments";
import { formatYear } from "@pramana/core";
import { cn } from "@/lib/utils";
import { useYourView } from "./YourView";

/**
 * "Customise this page": a quiet control that opens a panel *beside* the page,
 * never over it: docked at the right on wide screens (the page makes room), a
 * bottom sheet on phones with Undo and Put back always in reach. A few fixed
 * choices, not every knob: how the parts read, what the page shows, the map's
 * names and turning points. Every change shows at once and can be undone.
 */
export function CustomiseButton({
  panels,
  stops = [],
  hasAtlas = false,
  reading = false,
  opensOn,
  className,
}: {
  /** The panels this page has, in the order to offer them. */
  panels: readonly ViewPanel[];
  /** The page's own turning points on the map. */
  stops?: AtlasStop[];
  hasAtlas?: boolean;
  /** The page has short versions to skim. */
  reading?: boolean;
  /** How the page opens as published (a page with short versions opens on them). */
  opensOn?: "skim" | "full";
  className?: string;
}) {
  const yv = useYourView();
  const wide = useMediaQuery("(min-width: 1024px)");
  // Only with room to spare does the page move over for the panel: below this the reading page's own grid
  // (viewport-based) would squeeze its columns, so the panel floats over the rail instead, never over the text.
  const push = useMediaQuery("(min-width: 1680px)");
  const [open, setOpen] = useState(false);
  // Docked, the page's frames make room for the panel (globals.css: html[data-dock]), so it covers nothing.
  useEffect(() => {
    if (!(open && wide && push)) return;
    document.documentElement.dataset.dock = "right";
    return () => {
      delete document.documentElement.dataset.dock;
    };
  }, [open, wide, push]);
  useEffect(() => {
    if (!(open && wide)) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, wide]);
  if (!yv) return null;
  const { view } = yv;
  const changed = !isEmptyView(view);
  const lines = describeUserView(view);
  const published = opensOn ?? (reading ? "skim" : undefined);
  const toggle = (panel: ViewPanel) =>
    yv.set({ hide: view.hide.includes(panel) ? view.hide.filter((p) => p !== panel) : [...view.hide, panel] });

  // What the reading choice does, said plainly: the critic found "Short versions" changed nothing on a page
  // that already opened on them.
  const readingHint = !view.reading
    ? published
      ? `As published, the page opens on ${published === "skim" ? "the short versions" : "every part in full"}.`
      : "The page opens as it was published."
    : view.reading === published
      ? "The page already opens this way; your view keeps it so."
      : view.reading === "skim"
        ? "Parts fold to their short versions now, and whenever the page opens."
        : "Every part opens in full now, and whenever the page opens.";

  const trigger = (
    <Button
      variant="outline"
      size="sm"
      className={className}
      aria-expanded={open}
      aria-controls="customise-panel"
      aria-label={changed ? `Customise this page (${lines.length} changes of yours)` : "Customise this page"}
      onClick={() => setOpen((o) => !o)}
    >
      <SlidersHorizontal data-icon="inline-start" aria-hidden />
      {changed ? "Your view" : "Customise this page"}
    </Button>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={!changed} onClick={yv.reset}>
        Put the page back as published
      </Button>
      <Button size="sm" variant="ghost" disabled={!yv.state.changes.length} onClick={yv.undo}>
        <Undo2 data-icon="inline-start" /> Undo
      </Button>
    </div>
  );

  const body = (
    <>
      {reading && (
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-ink-3">How the parts read</legend>
          <Segments
            className="mt-1.5"
            aria-label="How the parts read"
            options={[
              { value: "published", label: "As published" },
              { value: "skim", label: "Short versions" },
              { value: "full", label: "Every part in full" },
            ]}
            value={view.reading ?? "published"}
            onChange={(mode) => yv.set({ reading: mode === "published" ? null : mode })}
          />
          <p className="mt-1.5 text-xs text-ink-3">{readingHint}</p>
          <Check
            checked={view.foldKnown}
            onChange={(on) => yv.set({ foldKnown: on })}
            label="Keep the parts I have read folded"
          />
        </fieldset>
      )}
      <Check
        checked={view.explainWords}
        onChange={(on) => yv.set({ explainWords: on })}
        label="Explain words where they appear"
      />

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-ink-3">Show</legend>
        {panels.map((p) => (
          <Check key={p} checked={!view.hide.includes(p)} onChange={() => toggle(p)} label={cap(panelWords(p))} />
        ))}
      </fieldset>

      {hasAtlas && (
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-ink-3">The map</legend>
          <Check
            checked={view.atlas.modernLabels ?? false}
            onChange={(on) => yv.set({ atlas: { modernLabels: on ? true : null } })}
            label="Today's place names (from the next visit)"
          />
          <Check
            checked={view.railOrder?.[0] === "notes"}
            onChange={(on) => yv.set({ railOrder: on ? ["notes", "in_this_part", "atlas"] : null })}
            label="My AI's notes first, beside the reading"
          />
          {stops.length > 0 && <p className="mt-2 text-sm text-ink-3">Turning points on the year scrubber</p>}
          {stops.map((s) => (
            <Check
              key={s.year}
              checked={!view.atlas.hideStops.includes(s.year)}
              onChange={(on) =>
                yv.set({
                  atlas: {
                    hideStops: on ? view.atlas.hideStops.filter((y) => y !== s.year) : [...view.atlas.hideStops, s.year],
                  },
                })
              }
              label={`${s.label}, ${formatYear(s.year)}`}
            />
          ))}
        </fieldset>
      )}

      {lines.length > 0 && (
        <div className="mt-4 border-t border-rule-soft pt-3">
          <p className="text-xs font-medium text-ink-3">What your view changes</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-ink-2">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}
      {yv.state.changes.length > 0 && (
        <details className="mt-3 text-sm text-ink-3">
          <summary className="cursor-pointer">Recent changes</summary>
          <ul className="mt-1 space-y-1.5">
            {yv.state.changes.slice(0, 8).map((c) => (
              <li key={c.at} className={cn(c.by.kind === "agent" && "marginalia")}>
                <span className="text-ink-2">{c.by.kind === "agent" ? "Your AI" : "You"}</span>,{" "}
                {new Date(c.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                {c.note ? `: ${c.note}` : ""}
                {c.lines.length > 0 && <span className="block">{c.lines.join("; ")}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );

  // Wide screens: a panel at the right edge; with room to spare the page moves over for it, else it floats
  // over the rail. Either way the reading column stays in view, so every change shows at once.
  if (wide)
    return (
      <>
        {trigger}
        {open &&
          createPortal(
            <aside
              id="customise-panel"
              aria-label="Your view of this page"
              className={cn(
                "fixed top-[var(--topbar-h)] right-0 bottom-0 z-20 flex w-[var(--dock-w,22rem)] flex-col border-l border-rule bg-paper font-sans text-ui",
                !push && "shadow-pop",
              )}
            >
              <div className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
                <div>
                  <p className="font-medium text-ink">Your view of this page</p>
                  <p className="mt-0.5 text-sm text-ink-3">Only for you. The page itself stays as published.</p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mt-1 -mr-1.5" onClick={() => setOpen(false)}>
                  <X />
                </Button>
              </div>
              <div className="border-b border-rule px-4 py-3">{actions}</div>
              <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-6">{body}</div>
            </aside>,
            document.body,
          )}
      </>
    );

  // Phones and tablets: a bottom sheet over the lower half only, with no backdrop and the page still live
  // above it, so each change shows as it is made; Undo and Put back stay in reach in a footer that does not
  // scroll away.
  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen} modal={false}>
        <SheetContent side="bottom" showOverlay={false} className="max-h-[52dvh] gap-0 rounded-t-[10px] p-0 font-sans text-ui shadow-pop">
          <SheetHeader className="border-b border-rule pr-12">
            <SheetTitle className="font-sans text-ui font-medium text-ink">Your view of this page</SheetTitle>
            <SheetDescription className="text-ink-3">Only for you. The page itself stays as published.</SheetDescription>
          </SheetHeader>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 pb-4">{body}</div>
          <SheetFooter className="flex-row flex-wrap border-t border-rule bg-paper p-3 pb-[max(0.75rem,var(--safe-bottom))]">{actions}</SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <label className="mt-1.5 flex min-h-7 cursor-pointer items-start gap-2 text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-[var(--indigo)]" />
      <span>{label}</span>
    </label>
  );
}

/**
 * "Your AI changed this view": one quiet line in place, with Undo, drawn as the
 * partner's marginalia (dotted rule, ink). The reason, what changed and "Keep
 * it" are in the partner's popover (the AI mark in the top bar), so the page
 * is not pushed down by a notice.
 */
export function AiChangeNotice({ className }: { className?: string }) {
  const yv = useYourView();
  const c = yv?.state.pendingAiChange;
  if (!yv || !c) return null;
  return (
    <p
      role="status"
      title={[c.note, c.lines.join("; ")].filter(Boolean).join(" ")}
      className={cn("marginalia flex flex-wrap items-baseline gap-x-3 font-sans text-sm text-ink-2", className)}
    >
      <span>Your AI changed this view.</span>
      <button
        type="button"
        onClick={yv.undo}
        className="inline-flex items-center gap-1 text-ink underline decoration-rule underline-offset-2 hover:decoration-ink-3"
      >
        <Undo2 className="size-3.5" aria-hidden /> Undo
      </button>
    </p>
  );
}

/** The learner's own notes on a part, and study notes pinned to it for them. */
export function YourPartExtras({ blockId, notes }: { blockId: string; notes: NoteView[] }) {
  const yv = useYourView();
  if (!yv) return null;
  const mine = yv.view.annotations.filter((a) => a.blockId === blockId);
  const pinned = yv.view.pinnedNotes
    .filter((p) => p.blockId === blockId)
    .map((p) => notes.find((n) => n.id === p.noteId))
    .filter((n): n is NoteView => Boolean(n));
  if (!mine.length && !pinned.length) return null;
  return (
    <div className="mt-5 max-w-[66ch] space-y-3 font-sans text-note leading-snug">
      {pinned.map((n) => (
        <aside key={n.id} className="marginalia text-ink" aria-label={`Study note for you: ${n.title}`}>
          <p className="text-sm text-ink-3">Explained for you</p>
          <p className="font-medium">{n.title}</p>
          <Markdown className="mt-1 space-y-2 [&_p]:mt-0">{n.body}</Markdown>
        </aside>
      ))}
      {mine.map((a) => (
        <aside key={a.id} className="border-l-2 border-rule pl-3 text-ink-2" aria-label="Your note">
          <p className="text-sm text-ink-3">Your note</p>
          <Markdown className="[&_p]:mt-0">{a.markdown}</Markdown>
        </aside>
      ))}
    </div>
  );
}

/** A claim's mark in the learner's view: to remember, or to come back to. */
export function HighlightMark({ claimId }: { claimId: string }) {
  const tone = useYourView()?.highlight(claimId);
  if (!tone) return null;
  const Icon = tone === "question" ? CircleHelp : Bookmark;
  return (
    <span className="inline-flex items-center gap-1 font-sans text-xs text-ink-3" title={tone === "question" ? "You marked this to come back to" : "You marked this to remember"}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{tone === "question" ? "Marked to come back to" : "Marked to remember"}</span>
    </span>
  );
}

/** "Mark to remember" / "Come back to this", for the evidence drawer. */
export function HighlightButtons({ claimId }: { claimId: string }) {
  const yv = useYourView();
  if (!yv) return null;
  const tone = yv.highlight(claimId);
  const set = (t: "remember" | "question") =>
    yv.set({
      highlights:
        tone === t
          ? yv.view.highlights.filter((h) => h.claimId !== claimId)
          : [...yv.view.highlights.filter((h) => h.claimId !== claimId), { claimId, tone: t }],
    });
  return (
    <>
      <Button size="sm" variant={tone === "remember" ? "secondary" : "ghost"} aria-pressed={tone === "remember"} onClick={() => set("remember")}>
        <Bookmark data-icon="inline-start" /> Mark to remember
      </Button>
      <Button size="sm" variant={tone === "question" ? "secondary" : "ghost"} aria-pressed={tone === "question"} onClick={() => set("question")}>
        <CircleHelp data-icon="inline-start" /> Come back to this
      </Button>
    </>
  );
}

/**
 * "Your note": the learner's own words on a part or a claim, kept in their view
 * (never on the page). One note per thing; empty text removes it.
 */
export function YourNoteButton({
  blockId,
  claimId,
  icon = false,
  what = "this",
}: {
  blockId?: string;
  claimId?: string;
  icon?: boolean;
  what?: string;
}) {
  const yv = useYourView();
  const id = blockId ? `b-${blockId}`.slice(0, 64) : `c-${claimId}`.slice(0, 64);
  const existing = yv?.view.annotations.find((a) => a.id === id);
  const [text, setText] = useState(existing?.markdown ?? "");
  const [open, setOpen] = useState(false);
  if (!yv) return null;
  const save = () => {
    const rest = yv.view.annotations.filter((a) => a.id !== id);
    const t = text.trim();
    yv.set({
      annotations: t ? [...rest, { id, ...(blockId ? { blockId } : { claimId }), markdown: t.slice(0, 2000) }] : rest,
    });
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setText(existing?.markdown ?? "");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size={icon ? "icon-xs" : "sm"}
            className={icon ? "self-center text-ink-3 hover:text-ink" : "text-ink-2"}
            aria-label={`${existing ? "Edit your note on" : "Write a note on"} ${what}`}
            title={icon ? (existing ? "Edit your note" : "Write a note of your own") : undefined}
          />
        }
      >
        <NotebookPen data-icon="inline-start" aria-hidden />
        {!icon && (existing ? "Your note" : "Write a note")}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 font-sans text-ui">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-2"
        >
          <label className="block text-sm text-ink-2" htmlFor={`note-${id}`}>
            Your note on {what} (only you see it)
          </label>
          <Textarea id={`note-${id}`} value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={2000} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              {text.trim() || !existing ? "Save" : "Remove the note"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** The learner's note on a claim (theirs or their AI's), for the evidence drawer. */
export function YourClaimNote({ claimId }: { claimId: string }) {
  const yv = useYourView();
  const notes = yv?.view.annotations.filter((a) => a.claimId === claimId) ?? [];
  if (!notes.length) return null;
  return (
    <div className="mt-4 space-y-2 font-sans text-note leading-snug">
      {notes.map((a) => (
        <aside key={a.id} className="border-l-2 border-rule pl-3 text-ink-2" aria-label="Your note">
          <p className="text-sm text-ink-3">Your note</p>
          <Markdown className="[&_p]:mt-0">{a.markdown}</Markdown>
        </aside>
      ))}
    </div>
  );
}
