"use client";

import {
  clampLayout,
  listOrder,
  moveItem,
  stepItem,
  tidy,
  wrapToWidth,
  CANVAS_COLUMNS,
  toAstronomicalYear,
  type CanvasItemContent,
  type CanvasItemContentInput,
  type CanvasLayout,
  type Placed,
} from "@pramana/core";
import { ReactFlowProvider, Panel } from "@xyflow/react";
import {
  ChartNoAxesGantt,
  Check,
  ChevronLeft,
  LayoutGrid,
  List,
  Map as MapIcon,
  Maximize,
  Minus,
  NotebookPen,
  Plus,
  Rows3,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addItemsAction,
  addLinksAction,
  arrangeAction,
  decideBatchAction,
  refreshPlacedAction,
  removeItemsAction,
  removeLinksAction,
  renameCanvasAction,
  updateItemAction,
  updateLinkAction,
} from "@/app/canvas/actions";
import { AtlasProvider } from "@/components/atlas/bus";
import { AskAi } from "@/components/ai/AskAi";
import { useLiveNotes } from "@/components/ai/LiveNotes";
import { NoteCard } from "@/components/ai/NoteCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import "./canvas.css";
import { FlowBoard, screenColumns, useBoardView } from "./FlowBoard";
import { sameLayout } from "./geometry";
import { InsertSearch } from "./InsertSearch";
import { BoardContext, headingOf, ItemTile, type BoardActions, type BoardItemRef } from "./ItemTile";
import type { Canvas, Item } from "./types";

type SaveState = "idle" | "saving" | "saved" | "error";

const placedOf = (items: Item[], layouts: Record<string, CanvasLayout>): Placed[] =>
  items.map((i) => ({ id: i.id, layout: layouts[i.id] ?? i.layout, ...(i.kind === "section" ? { section: true } : {}) }));

const layoutsOf = (items: Item[]) => Object.fromEntries(items.map((i) => [i.id, i.layout]));

/** "260 BCE", "-259", "1857 CE", "1857": an astronomical year, or null. */
function parseYear(text: string): number | null {
  const m = /^\s*(-?\d{1,4})\s*(bce|bc|ce|ad)?\s*$/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  if (!m[2]) return n;
  return toAstronomicalYear(Math.abs(n), /^b/i.test(m[2]) ? "BCE" : "CE");
}

/**
 * A canvas: the learner's board. Wide screens get the spatial board (React
 * Flow) under a thin floating toolbar (docs/visual.md §6); phones get the
 * items as a list in reading order, with the board one tap away (read-only
 * until "Edit layout"). Every change saves at once through the services;
 * changes made elsewhere (the learner's AI over MCP) arrive live and are
 * marked with a dotted edge until the learner keeps them.
 */
export function CanvasBoard({ initial }: { initial: Canvas }) {
  const router = useRouter();
  const [canvas, setCanvas] = useState(initial);
  const [layouts, setLayouts] = useState<Record<string, CanvasLayout>>(() => layoutsOf(initial.items));
  const [save, setSave] = useState<SaveState>("idle");
  const [deleted, setDeleted] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const narrow = !useMediaQuery("(min-width: 768px)");
  const wide = useMediaQuery("(min-width: 1024px)");
  const [view, setView] = useState<"board" | "list" | null>(null);
  const [editLayout, setEditLayout] = useState(false);
  const mode = view ?? (narrow ? "list" : "board");
  const editable = mode === "list" || !narrow || editLayout;

  // The study partner's notes about this canvas, kept live; the toolbar can fold them away.
  const notes = useLiveNotes({ subject: { type: "canvas", id: canvas.id } }, initial.notes, 3);
  // Closed by default: the toolbar says how many there are ("Notes 1"); a fresh note opens the panel.
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    if (notes.fresh.size) setNotesOpen(true);
  }, [notes.fresh]);

  // Saves run one after another; a refresh waits for them.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);
  const known = useRef(new Set(initial.items.map((i) => i.id)));
  const version = useRef(initial.version);

  const refresh = useCallback(async () => {
    await queue.current;
    const res = await fetch(`/api/canvas/${canvas.id}`, { cache: "no-store" });
    if (res.status === 404) return setDeleted(true);
    if (!res.ok) return;
    const next = (await res.json()) as Canvas;
    if (inFlight.current > 0 || next.version < version.current) return;
    version.current = next.version;
    const fresh = next.items.filter((i) => !known.current.has(i.id));
    known.current = new Set(next.items.map((i) => i.id));
    const byAi = fresh.filter((i) => i.addedBy.kind === "agent");
    if (byAi.length) {
      const words = `Your AI added ${byAi.length} ${byAi.length === 1 ? "item" : "items"} to this canvas.`;
      setAnnounce(words);
      toast(words, { description: "They're marked until you choose Keep or Remove." });
    }
    setCanvas(next);
    setLayouts(layoutsOf(next.items));
  }, [canvas.id]);

  useLiveEvents((e) => {
    if (e.table !== "canvases" || e.id !== canvas.id) return;
    if (e.op === "DELETE") setDeleted(true);
    else void refresh();
  });

  /** Runs a write; on failure says so and reloads the board as stored. */
  const run = useCallback(
    <T,>(fn: () => Promise<{ ok: true; value: T } | { ok: false; error: string }>, then?: (v: T) => void) => {
      inFlight.current += 1;
      setSave("saving");
      const p = queue.current.then(async () => {
        const r = await fn();
        inFlight.current -= 1;
        if (r.ok) {
          const v = r.value as { version?: number };
          if (typeof v?.version === "number") version.current = Math.max(version.current, v.version);
          setSave("saved");
          then?.(r.value);
        } else {
          setSave("error");
          toast.error(r.error);
          void refresh();
        }
      });
      queue.current = p.catch(() => {});
      return p;
    },
    [refresh],
  );

  const commitLayouts = useCallback(
    (next: Placed[]) => {
      const changed = next.filter((p) => {
        const before = layouts[p.id];
        return !before || !sameLayout(before, p.layout);
      });
      if (!changed.length) return;
      setLayouts((cur) => ({ ...cur, ...Object.fromEntries(changed.map((p) => [p.id, p.layout])) }));
      void run(() => arrangeAction(canvas.id, { layouts: changed.map((p) => ({ id: p.id, layout: p.layout })) }));
    },
    [layouts, run, canvas.id],
  );

  const onMove = useCallback(
    (id: string, layout: CanvasLayout) => commitLayouts(moveItem(placedOf(canvas.items, layouts), id, layout)),
    [canvas.items, layouts, commitLayouts],
  );

  // Every item by name, for "Link to…" and the lines in the phone list.
  const itemRefs = useMemo<BoardItemRef[]>(
    () => canvas.items.map((i) => ({ id: i.id, kind: i.kind, label: headingOf(i) })),
    [canvas.items],
  );
  const addLink = useCallback(
    (from: string, to: string, relation: string) =>
      void run(() => addLinksAction(canvas.id, [{ from, to, relation }]), () => {
        setAnnounce("Linked.");
        void refresh();
      }),
    [run, canvas.id, refresh],
  );

  // Keyboard nudges move at once and save after a pause.
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNudge = useRef<Placed[] | null>(null);
  const actions: BoardActions = useMemo(
    () => ({
      editable,
      items: itemRefs,
      link: addLink,
      unlink: (linkId) => {
        setCanvas((c) => ({ ...c, links: c.links.filter((l) => l.id !== linkId) }));
        void run(() => removeLinksAction(canvas.id, [linkId]), () => void refresh());
      },
      linksOf: (id) =>
        canvas.links.flatMap((l) => {
          if (l.from !== id && l.to !== id) return [];
          const other = itemRefs.find((r) => r.id === (l.from === id ? l.to : l.from));
          if (!other) return [];
          return [{ id: l.id, other, relation: l.relation, label: l.label, outgoing: l.from === id, pending: l.status === "pending" }];
        }),
      update: (id, content) => {
        setCanvas((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, content } : i)) }));
        void run(() => updateItemAction(canvas.id, id, { content }), () => void refresh());
      },
      remove: (id) => {
        const item = canvas.items.find((i) => i.id === id);
        if (!item) return;
        setCanvas((c) => ({ ...c, items: c.items.filter((i) => i.id !== id), links: c.links.filter((l) => l.from !== id && l.to !== id) }));
        void run(() => removeItemsAction(canvas.id, [id]));
        setAnnounce("Removed from the canvas.");
        toast("Removed from the canvas.", {
          action: {
            label: "Undo",
            onClick: () =>
              void run(() => addItemsAction(canvas.id, [{ content: item.content, layout: layouts[id] ?? item.layout }]), () => void refresh()),
          },
        });
      },
      decide: (id, keep) => {
        setCanvas((c) => ({
          ...c,
          items: keep ? c.items.map((i) => (i.id === id ? { ...i, status: "kept" } : i)) : c.items.filter((i) => i.id !== id),
        }));
        void run(() => decideBatchAction(canvas.id, { items: [id], keep }), () => void refresh());
      },
      refreshPlaced: (id) => void run(() => refreshPlacedAction(canvas.id, id), () => void refresh()),
      step: (id, delta) => {
        commitLayouts(stepItem(placedOf(canvas.items, layouts), id, delta));
        setAnnounce(delta < 0 ? "Moved earlier." : "Moved later.");
      },
      nudge: (id, change, how) => {
        const base = pendingNudge.current ?? placedOf(canvas.items, layouts);
        const cur = base.find((p) => p.id === id)!.layout;
        const target = clampLayout(
          how === "move"
            ? { ...cur, x: cur.x + (change.x ?? 0), y: cur.y + (change.y ?? 0) }
            : { ...cur, w: cur.w + (change.w ?? 0), h: cur.h + (change.h ?? 0) },
        );
        const next = moveItem(base, id, target);
        pendingNudge.current = next;
        setLayouts(Object.fromEntries(next.map((p) => [p.id, p.layout])));
        setAnnounce(how === "move" ? `Column ${target.x + 1}, row ${target.y + 1}.` : `${target.w} columns wide, ${target.h} rows tall.`);
        if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
        nudgeTimer.current = setTimeout(() => {
          const moved = pendingNudge.current!;
          pendingNudge.current = null;
          const changed = moved.filter((p) => !sameLayout(p.layout, canvas.items.find((i) => i.id === p.id)?.layout ?? p.layout));
          if (changed.length)
            void run(() => arrangeAction(canvas.id, { layouts: changed.map((p) => ({ id: p.id, layout: p.layout })) }));
        }, 600);
      },
    }),
    [editable, canvas.id, canvas.items, canvas.links, itemRefs, addLink, layouts, run, refresh, commitLayouts],
  );

  // What the learner has just added, for the board to bring into view once it is drawn.
  const [revealIds, setRevealIds] = useState<string[]>([]);
  const [refit, setRefit] = useState(0);
  const revealed = useCallback(() => setRevealIds([]), []);
  const insert = useCallback(
    (content: CanvasItemContentInput) =>
      run(
        () => addItemsAction(canvas.id, [{ content }]),
        (v) => {
          setAnnounce("Added to the canvas.");
          setRevealIds((cur) => [...cur, ...v.ids]);
          void refresh();
        },
      ),
    [run, canvas.id, refresh],
  );

  // "/" or Cmd-K opens the insert search (not while typing somewhere).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true]")) return;
      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        e.stopPropagation();
        setInsertOpen(true);
      }
    };
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, []);

  const pendingBatches = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of canvas.items) if (i.status === "pending" && i.batchId) m.set(i.batchId, (m.get(i.batchId) ?? 0) + 1);
    return [...m.entries()];
  }, [canvas.items]);

  const boardEntities = useMemo(
    () => canvas.items.flatMap((i) => (i.data.kind === "entity" ? [i.data.entity] : [])),
    [canvas.items],
  );

  const onConfig = useCallback(
    (id: string, content: CanvasItemContent) => void run(() => updateItemAction(canvas.id, id, { content })),
    [run, canvas.id],
  );

  if (deleted)
    return (
      <div className="mx-auto max-w-[40rem] px-6 py-16 font-sans">
        <p className="text-ui text-ink">This canvas was deleted.</p>
        <Link href="/canvas" className="mt-2 inline-block text-indigo">
          Your canvases
        </Link>
      </div>
    );

  const onDecideBatch = (batch: string, keep: boolean) =>
    void run(() => decideBatchAction(canvas.id, { batch, keep }), () => {
      setAnnounce(keep ? "Kept." : "Removed.");
      void refresh();
    });

  const toolbar = (
    <Toolbar
      canvas={canvas}
      save={save}
      mode={mode}
      narrow={narrow}
      editLayout={editLayout}
      onEditLayout={setEditLayout}
      onMode={setView}
      onInsert={() => setInsertOpen(true)}
      onAdd={insert}
      onTidy={() => {
        // On the board, columns set side by side wrap into rows as wide as the screen at a legible size.
        const cols = mode === "board" ? screenColumns() : null;
        const placed = placedOf(canvas.items, layouts);
        commitLayouts(tidy(cols ? wrapToWidth(placed, Math.max(CANVAS_COLUMNS, cols)) : placed));
        if (mode === "board") setRefit((n) => n + 1);
      }}
      onRename={(title) => {
        setCanvas((c) => ({ ...c, title }));
        void run(() => renameCanvasAction(canvas.id, { title }));
        router.refresh();
      }}
      entities={boardEntities}
      noteCount={mode === "board" ? notes.notes.length : 0}
      notesOpen={notesOpen}
      onNotes={() => setNotesOpen((o) => !o)}
      pendingBatches={pendingBatches}
      onDecideBatch={onDecideBatch}
      // With the notes docked at the right, the toolbar stops short of them and wraps instead.
      className={mode === "board" && notesOpen && notes.notes.length > 0 && wide ? "max-w-[calc(100vw-24rem-2.5rem)]" : undefined}
    />
  );

  return (
    <BoardContext.Provider value={actions}>
      {/* The page's heading; the toolbar shows the title as the field that renames it. */}
      <h1 className="sr-only">{canvas.title}</h1>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      <AtlasProvider initialYear={null}>
        {mode === "board" ? (
          <div className="fixed inset-x-0 top-[var(--topbar-h)] bottom-[calc(var(--bottomnav-h)+var(--safe-bottom))] z-10 md:bottom-0">
            <ReactFlowProvider>
              <FlowBoard
                items={canvas.items}
                links={canvas.links}
                layouts={layouts}
                onMove={onMove}
                onConfig={onConfig}
                onConnect={(from, to) => addLink(from, to, "related")}
                onRelation={(linkId, relation) =>
                  void run(
                    () => (relation ? updateLinkAction(canvas.id, linkId, { relation }) : removeLinksAction(canvas.id, [linkId])),
                    () => void refresh(),
                  )
                }
                fitKey={canvas.id}
                revealIds={revealIds}
                onRevealed={revealed}
                refit={refit}
                chrome={
                  <Panel position="top-left" className="canvas-chrome !m-3 flex flex-col items-start gap-2">
                    {toolbar}
                  </Panel>
                }
                aside={
                  notesOpen && notes.notes.length > 0 ? (
                    // Docked to the right edge, the board's full height, so the fit leaves it room.
                    <Panel position="top-right" className={cn("!m-0 h-full", !wide && "!w-full")}>
                      <AiNotes canvasId={canvas.id} notes={notes} onFold={() => setNotesOpen(false)} docked />
                    </Panel>
                  ) : null
                }
                asideOpen={notesOpen && notes.notes.length > 0}
              />
            </ReactFlowProvider>
            {canvas.items.length === 0 && <EmptyBoard onInsert={() => setInsertOpen(true)} onAdd={insert} />}
          </div>
        ) : (
          <StackList
            canvas={canvas}
            layouts={layouts}
            chrome={toolbar}
            notes={notes.notes.length > 0 ? <AiNotes canvasId={canvas.id} notes={notes} folded /> : null}
            onInsert={() => setInsertOpen(true)}
            onAdd={insert}
          />
        )}
      </AtlasProvider>
      <InsertSearch open={insertOpen} onOpenChange={setInsertOpen} onInsert={(c) => void insert(c)} />
    </BoardContext.Provider>
  );
}

/** A few ways to begin, for a blank canvas: each adds a first card or two the learner can build on. */
function StarterIdeas({ onAdd }: { onAdd: (c: CanvasItemContentInput) => void }) {
  const ideas: { label: string; items: CanvasItemContentInput[] }[] = [
    {
      label: "Compare two empires",
      items: [
        { kind: "section", title: "Two empires side by side" },
        { kind: "map", title: "Maurya Empire, 250 BCE", year: -249, focus: ["maurya-empire"] },
        { kind: "map", title: "Gupta Empire, 400 CE", year: 400, focus: ["gupta-empire"] },
      ],
    },
    {
      label: "A question to answer",
      items: [{ kind: "text", title: "My question", markdown: "What do I want to find out? Add the claims that answer it." }],
    },
    {
      label: "A time and a place",
      items: [{ kind: "map", title: "A year to look at", year: -259, range: [-359, -159] }],
    },
  ];
  return (
    <div className="mt-5 text-center">
      <p className="text-sm text-ink-3">Or start from an idea</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {ideas.map((i) => (
          <Button key={i.label} size="sm" variant="outline" onClick={() => i.items.forEach(onAdd)}>
            {i.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * The empty board: a field cut into the ground (docs/visual.md §4) with the
 * one action that fills it, the "/" shortcut, and a few starting ideas. On
 * the board it sits in the middle; in the phone list it follows the toolbar.
 */
function EmptyBoard({
  onInsert,
  onAdd,
  inline = false,
}: {
  onInsert: () => void;
  onAdd: (c: CanvasItemContentInput) => void;
  inline?: boolean;
}) {
  const body = (
    <div className="w-full max-w-[30rem] font-sans">
      <div role="status" className="field flex flex-col items-center px-6 py-9 text-center sm:px-10">
        <p className="font-heading text-2xl tracking-[-0.01em] text-ink">A blank canvas</p>
        <p className="mt-2 max-w-[42ch] text-note text-ink-2">
          Put anything from the site side by side: claims with their evidence, people and places, a part of a page, a
          quotation, a picture, a map of a year, a timeline, and your own words.
        </p>
        <Button className="mt-5" onClick={onInsert}>
          <Plus data-icon="inline-start" /> Add something
        </Button>
        <p className="mt-3 text-sm text-ink-3">
          Press <Kbd>/</Kbd> to search the site, or use “Add to a canvas” wherever you read.
        </p>
      </div>
      <StarterIdeas onAdd={onAdd} />
    </div>
  );
  if (inline) return <div className="mx-auto mt-6 flex justify-center">{body}</div>;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
      <div className="pointer-events-auto flex w-full justify-center">{body}</div>
    </div>
  );
}

/**
 * The study partner's notes about this canvas (docs/visual.md §7): marginalia
 * in a floating panel at the right of the board, which the toolbar can fold;
 * on a phone, a fold under the toolbar.
 */
function AiNotes({
  canvasId,
  notes,
  onFold,
  folded = false,
  docked = false,
}: {
  canvasId: string;
  notes: ReturnType<typeof useLiveNotes>;
  onFold?: () => void;
  folded?: boolean;
  /** Docked to the board's right edge: a side panel the full height of the board, not a floating card. */
  docked?: boolean;
}) {
  const shown = notes.notes.slice(0, 3);
  const list = (
    <ol className="mt-3 space-y-5">
      {shown.map((n) => (
        <li key={n.id}>
          <NoteCard note={n} fresh={notes.fresh.has(n.id)} onAction={notes.act} />
        </li>
      ))}
    </ol>
  );
  const history = (
    <Link href={`/notes?about=canvas&id=${canvasId}`} className="text-sm text-ink-3 hover:text-ink">
      {notes.notes.length > 3 ? "All notes" : "Notes history"}
    </Link>
  );
  if (folded)
    return (
      <details className="floating w-full px-3 py-2 font-sans">
        <summary className="flex min-h-7 cursor-pointer items-center justify-between gap-3 text-ui font-medium text-ink">
          <span>From your AI, about this canvas</span>
          <span className="text-sm font-normal text-ink-3 tnum">{notes.notes.length}</span>
        </summary>
        {list}
        <p className="mt-3">{history}</p>
      </details>
    );
  return (
    <section
      className={cn(
        "canvas-aside scroll-thin overflow-y-auto p-4 font-sans",
        docked
          ? "h-full w-[min(24rem,100vw)] border-l border-rule bg-paper"
          : "floating max-h-[min(60dvh,34rem)] w-[min(24rem,calc(100vw-1.5rem))]",
      )}
      aria-label="From your AI, about this canvas"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-ui font-semibold text-ink">From your AI, about this canvas</h2>
        <div className="-mt-1 -mr-1.5 flex shrink-0 items-center gap-1">
          {history}
          {onFold && (
            <Button variant="ghost" size="icon-xs" onClick={onFold} aria-label="Fold the notes away">
              <X />
            </Button>
          )}
        </div>
      </div>
      {list}
    </section>
  );
}

/**
 * "Your AI added n items", as one segment of the toolbar: the batch waits, marked with the partner's
 * dotted rule, until the learner keeps or removes it.
 */
function PendingSegment({
  batches,
  onDecide,
}: {
  batches: [string, number][];
  onDecide: (batch: string, keep: boolean) => void;
}) {
  const n = batches.reduce((sum, [, k]) => sum + k, 0);
  return (
    <span role="status" className="marginalia ml-1 flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5 pr-0.5 text-sm text-ink">
      <span>
        Your AI added {n} {n === 1 ? "item" : "items"}
      </span>
      {batches.map(([batch], i) => (
        <span key={batch} className="flex items-center gap-1">
          {batches.length > 1 && <span className="text-ink-3">Batch {i + 1}:</span>}
          <Button size="xs" variant="outline" onClick={() => onDecide(batch, true)}>
            <Check data-icon="inline-start" /> Keep all
          </Button>
          <Button size="xs" variant="ghost" onClick={() => onDecide(batch, false)}>
            <X data-icon="inline-start" /> Remove all
          </Button>
        </span>
      ))}
    </span>
  );
}

/** Phones: the items in reading order, sections as headings, natural heights. */
function StackList({
  canvas,
  layouts,
  chrome,
  notes,
  onInsert,
  onAdd,
}: {
  canvas: Canvas;
  layouts: Record<string, CanvasLayout>;
  chrome: React.ReactNode;
  notes: React.ReactNode;
  onInsert: () => void;
  onAdd: (c: CanvasItemContentInput) => void;
}) {
  const ordered = listOrder(
    canvas.items.map((i) => ({ ...i, layout: layouts[i.id] ?? i.layout, ...(i.kind === "section" ? { section: true } : {}) })),
  );
  return (
    <div className="canvas-ground min-h-[calc(100dvh-var(--topbar-h))] px-3 pt-3 pb-24">
      <div className="mx-auto flex max-w-[40rem] flex-col items-start gap-2">
        {chrome}
        {notes}
      </div>
      {ordered.length === 0 ? (
        <EmptyBoard inline onInsert={onInsert} onAdd={onAdd} />
      ) : (
        <ol className="mx-auto mt-4 max-w-[40rem] space-y-3" aria-label={`Items on ${canvas.title}`}>
          {ordered.map((item) => (
            <li key={item.id} className={cn(item.kind === "section" && "pt-4")}>
              <ItemTile item={item} mode="list" bodyHeight={null} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** An icon button that says what it is on hover and focus (and always to a screen reader). */
function IconButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={label} aria-pressed={pressed} onClick={onClick} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

const Divider = () => <span className="mx-0.5 h-5 w-px shrink-0 bg-rule" aria-hidden />;

/**
 * The toolbar (docs/visual.md §6): one thin floating row. Where the canvas
 * sits and what it is called, then what you can add, then the view, then the
 * study partner. It wraps on a phone.
 */
function Toolbar({
  canvas,
  save,
  mode,
  narrow,
  editLayout,
  onEditLayout,
  onMode,
  onInsert,
  onAdd,
  onTidy,
  onRename,
  entities,
  noteCount,
  notesOpen,
  onNotes,
  pendingBatches,
  onDecideBatch,
  className,
}: {
  canvas: Canvas;
  save: SaveState;
  mode: "board" | "list";
  narrow: boolean;
  editLayout: boolean;
  onEditLayout: (on: boolean) => void;
  onMode: (m: "board" | "list") => void;
  onInsert: () => void;
  onAdd: (c: CanvasItemContentInput) => void;
  onTidy: () => void;
  onRename: (title: string) => void;
  entities: { id: string; kind: string }[];
  /** Notes from the AI the board can show in its own panel (0 on the phone list, which shows them inline). */
  noteCount: number;
  notesOpen: boolean;
  onNotes: () => void;
  /** Items the AI added that wait for a decision, by batch. */
  pendingBatches: [string, number][];
  onDecideBatch: (batch: string, keep: boolean) => void;
  className?: string;
}) {
  const [title, setTitle] = useState(canvas.title);
  useEffect(() => setTitle(canvas.title), [canvas.title]);
  const commitTitle = () => {
    const t = title.trim();
    if (t && t !== canvas.title) onRename(t);
    else setTitle(canvas.title);
  };
  return (
    <div className={cn("canvas-toolbar floating flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-0.5 p-1.5 font-sans", className)}>
      <Link
        href="/canvas"
        className="flex h-8 shrink-0 items-center gap-0.5 rounded-md pr-2 pl-1 text-sm text-ink-3 no-underline transition-colors hover:bg-rule-soft hover:text-ink"
      >
        <ChevronLeft className="size-3.5" aria-hidden />
        Canvases
      </Link>
      <form
        className="min-w-0"
        onSubmit={(e) => {
          e.preventDefault();
          commitTitle();
          (document.activeElement as HTMLElement | null)?.blur();
        }}
      >
        <label className="sr-only" htmlFor="canvas-title">
          Canvas title
        </label>
        <input
          id="canvas-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          className="h-8 w-[min(18rem,42vw)] rounded-md border border-transparent bg-transparent px-2 font-heading text-xl text-ink outline-none transition-colors hover:border-rule focus:border-indigo"
        />
      </form>
      <Divider />
      <Button size="sm" onClick={onInsert}>
        <Plus data-icon="inline-start" /> Add
      </Button>
      <AddPlace kind="map" entities={entities} onAdd={onAdd} />
      <AddPlace kind="timeline" entities={entities} onAdd={onAdd} />
      {mode === "board" && (
        <>
          <Divider />
          <IconButton label="Tidy up: close the gaps and fit the screen" onClick={onTidy}>
            <Rows3 />
          </IconButton>
          <ZoomButtons />
        </>
      )}
      {narrow && (
        <>
          <Divider />
          <Button size="sm" variant="ghost" onClick={() => onMode(mode === "board" ? "list" : "board")}>
            {mode === "board" ? <List data-icon="inline-start" /> : <LayoutGrid data-icon="inline-start" />}
            {mode === "board" ? "List" : "Spread out"}
          </Button>
          {mode === "board" && (
            <Button size="sm" variant={editLayout ? "secondary" : "ghost"} aria-pressed={editLayout} onClick={() => onEditLayout(!editLayout)}>
              {editLayout ? "Done" : "Edit layout"}
            </Button>
          )}
        </>
      )}
      <Divider />
      <AskAi
        subject={{ type: "canvas", id: canvas.id, label: canvas.title }}
        size="sm"
        label="Ask your AI"
        className="border-transparent bg-transparent text-ink-2 hover:border-transparent hover:bg-rule-soft hover:text-ink"
      />
      {noteCount > 0 && (
        <Button size="sm" variant="ghost" aria-pressed={notesOpen} onClick={onNotes} aria-label={`${notesOpen ? "Fold" : "Show"} the ${noteCount} ${noteCount === 1 ? "note" : "notes"} from your AI`}>
          <NotebookPen data-icon="inline-start" /> Notes <span className="text-ink-3 tnum">{noteCount}</span>
        </Button>
      )}
      {pendingBatches.length > 0 && (
        <>
          <Divider />
          <PendingSegment batches={pendingBatches} onDecide={onDecideBatch} />
        </>
      )}
      <span className="min-w-[4.5rem] px-2 text-right text-sm text-ink-3" aria-live="polite">
        {save === "saving" ? "Saving" : save === "error" ? "Not saved" : save === "saved" ? "Saved" : ""}
      </span>
    </div>
  );
}

function ZoomButtons() {
  const v = useBoardView();
  return (
    <>
      <IconButton label="Zoom out" onClick={v.zoomOut}>
        <Minus />
      </IconButton>
      <IconButton label="Zoom in" onClick={v.zoomIn}>
        <Plus />
      </IconButton>
      <IconButton label="Show the whole canvas" onClick={v.fit}>
        <Maximize />
      </IconButton>
    </>
  );
}

/** "Map of a year" and "Timeline": of the people, places and polities already on the board. */
function AddPlace({
  kind,
  entities,
  onAdd,
}: {
  kind: "map" | "timeline";
  entities: { id: string; kind: string }[];
  onAdd: (c: CanvasItemContentInput) => void;
}) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(kind === "map" ? "260 BCE" : "330 BCE");
  const [b, setB] = useState("180 BCE");
  const ya = parseYear(a);
  const yb = parseYear(b);
  const ok = kind === "map" ? ya !== null : ya !== null && yb !== null && ya < yb;
  const places = entities.filter((e) => ["place", "site", "inscription", "event"].includes(e.kind)).map((e) => e.id);
  const polities = entities.filter((e) => e.kind === "polity").map((e) => e.id);
  const label = kind === "map" ? "Add a map of a year" : "Add a timeline";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label={label}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-rule-soft hover:text-ink aria-expanded:bg-rule-soft aria-expanded:text-ink"
            />
          }
        >
          {kind === "map" ? <MapIcon className="size-4" aria-hidden /> : <ChartNoAxesGantt className="size-4" aria-hidden />}
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 font-sans text-ui">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ok) return;
            if (kind === "map")
              onAdd({ kind: "map", year: ya!, range: [ya! - 100, ya! + 100], places, focus: polities.slice(0, 12) });
            else onAdd({ kind: "timeline", range: [ya!, yb!], entities: entities.map((e) => e.id).slice(0, 200) });
            setOpen(false);
          }}
        >
          <p className="font-medium text-ink">{kind === "map" ? "A map of a year" : "A timeline"}</p>
          <label className="block">
            <span className="text-sm text-ink-2">{kind === "map" ? "Year" : "From"}</span>
            <Input value={a} onChange={(e) => setA(e.target.value)} className="mt-1" placeholder="260 BCE" />
          </label>
          {kind === "timeline" && (
            <label className="block">
              <span className="text-sm text-ink-2">To</span>
              <Input value={b} onChange={(e) => setB(e.target.value)} className="mt-1" placeholder="180 BCE" />
            </label>
          )}
          <p className="text-sm text-ink-3">
            {kind === "map"
              ? places.length || polities.length
                ? `With the ${places.length + polities.length} places and polities on this canvas.`
                : "Borders of that year. Add places to this canvas to have them named."
              : entities.length
                ? `With the ${entities.length} people, places and events on this canvas.`
                : "The ages. Add people or events to this canvas to see them here."}
          </p>
          <Button type="submit" size="sm" disabled={!ok}>
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
