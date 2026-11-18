"use client";

import { formatYear, type CanvasItemContent, type CanvasLayout } from "@pramana/core";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  GripVertical,
  Link2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useState } from "react";
import type { MapEmbedConfig, TimelineEmbedConfig } from "@/components/atlas/embed";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ItemBody } from "./ItemBody";
import { KIND_WORDS, RELATION_WORDS, type Item } from "./types";

/** Another item on the board, as the "Link to…" picker names it. */
export interface BoardItemRef {
  id: string;
  kind: string;
  label: string;
}

/** An item named on its own, away from its kind (a line's words, the link dialog): "Map: 261 BCE". */
export function refName(ref: { kind: string; label: string }): string {
  return ref.kind === "map" || ref.kind === "timeline" ? `${KIND_WORDS[ref.kind]}: ${ref.label}` : ref.label;
}

/** A line from or to an item, as the list view shows it. */
export interface ItemLink {
  id: string;
  /** The item at the other end. */
  other: BoardItemRef;
  relation: string;
  label: string | null;
  /** This item is where the line starts. */
  outgoing: boolean;
  pending: boolean;
}

/** What a tile can ask the board to do. Provided once by the board, so node data stays small. */
export interface BoardActions {
  update: (id: string, content: CanvasItemContent) => void;
  remove: (id: string) => void;
  /** Keep (true) or take back (false) one item the AI added. */
  decide: (id: string, keep: boolean) => void;
  refreshPlaced: (id: string) => void;
  step: (id: string, delta: -1 | 1) => void;
  nudge: (id: string, change: Partial<CanvasLayout>, how: "move" | "resize") => void;
  /** Every item on the board, for "Link to…". */
  items: BoardItemRef[];
  link: (from: string, to: string, relation: string) => void;
  unlink: (linkId: string) => void;
  linksOf: (id: string) => ItemLink[];
  editable: boolean;
}

export const BoardContext = createContext<BoardActions | null>(null);
export function useBoard(): BoardActions {
  const b = useContext(BoardContext);
  if (!b) throw new Error("ItemTile outside a board");
  return b;
}

/** Where the item lives on the site, for "Open". */
function hrefOf(item: Item): string | null {
  const d = item.data;
  switch (d.kind) {
    case "claim":
      return `/c/${d.claim.id}`;
    case "entity":
      return d.entity.pageSlug ? `/p/${d.entity.pageSlug}` : `/e/${d.entity.slug}`;
    case "chapter":
      return `/p/${d.page.slug}#${d.chapter.id}`;
    case "excerpt":
      return `/s/${d.excerpt.source.id}`;
    default:
      return null;
  }
}

/** The words that stand for an item: its own title, else what it shows. A map or timeline adds its years ("Kalinga, 261 BCE"). */
export function headingOf(item: Item): string {
  const c = item.content;
  if (c.kind === "map" || c.kind === "timeline") {
    const years =
      c.kind === "map" && c.year !== undefined
        ? formatYear(c.year)
        : c.range
          ? `${formatYear(c.range[0])} to ${formatYear(c.range[1])}`
          : null;
    if (c.title) return years && !c.title.includes(years) ? `${c.title}, ${years}` : c.title;
    // Shown after the kind ("Map: 261 BCE"), so the years alone.
    if (years) return years;
  }
  if (item.content.title) return item.content.title;
  const d = item.data;
  if (d.kind === "chapter") return d.chapter.title;
  if (d.kind === "entity") return d.entity.label;
  if (d.kind === "media") return d.media.title;
  if (d.kind === "note") return d.note.title;
  if (d.kind === "claim") return d.claim.text;
  if (d.kind === "excerpt") return d.excerpt.quote ? `“${d.excerpt.quote}”` : d.excerpt.source.short;
  if (item.content.kind === "text") return item.content.markdown.replace(/[#*_>`[\]()]/g, "").slice(0, 160);
  return KIND_WORDS[item.kind] ?? item.kind;
}

/** Placed-text drift for "Use the current wording". */
function hasChanged(item: Item): boolean {
  const { content, data } = item;
  if (content.kind === "claim" && data.kind === "claim") return Boolean(content.placed && content.placed.text !== data.claim.text);
  if (content.kind === "excerpt" && data.kind === "excerpt")
    return Boolean(content.placed && (content.placed.quote !== data.excerpt.quote || content.placed.locator !== data.excerpt.locatorLabel));
  return false;
}

/**
 * One item on the board: a tile (paper, rule edge, 6px radius) with a header
 * that is the drag handle, the live content, and the learner's note. Items
 * the AI added and the learner has not kept yet have a dotted ink edge, and
 * say so, with Keep and Remove.
 */
export function ItemTile({
  item,
  bodyHeight,
  mode,
  titlesOnly = false,
  onMapChange,
  onTimelineChange,
}: {
  item: Item;
  /** Height for the body in px (board), or null (the phone list: natural height). */
  bodyHeight: number | null;
  mode: "board" | "list";
  titlesOnly?: boolean;
  onMapChange?: (c: MapEmbedConfig) => void;
  onTimelineChange?: (c: TimelineEmbedConfig) => void;
}) {
  const board = useBoard();
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  // The menu closes as soon as one of its choices opens something else (the link dialog, the editor).
  const [menuOpen, setMenuOpen] = useState(false);
  const choose = (then: () => void) => () => {
    setMenuOpen(false);
    then();
  };
  const pending = item.status === "pending";
  const ai = item.addedBy.kind === "agent";
  const heading = headingOf(item);
  const href = hrefOf(item);

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || !board.editable) return;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = arrows[e.key];
    if (d && mode === "board") {
      e.preventDefault();
      if (e.shiftKey) board.nudge(item.id, { w: d[0], h: d[1] }, "resize");
      else board.nudge(item.id, { x: d[0], y: d[1] }, "move");
    } else if (d && mode === "list" && d[1] !== 0) {
      e.preventDefault();
      board.step(item.id, d[1] as -1 | 1);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      board.remove(item.id);
    } else if (e.key === "Enter" || e.key === "e") {
      e.preventDefault();
      setEditing(true);
    } else if (e.key === "l") {
      e.preventDefault();
      setLinking(true);
    }
  };

  const menu = board.editable && (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          className="nodrag grid size-7 place-items-center rounded-sm text-ink-3 hover:bg-rule-soft hover:text-ink"
          aria-label={`Options for ${heading}`}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1 font-sans text-ui">
          <MenuButton icon={<Pencil />} onClick={choose(() => setEditing(true))}>
            Edit title and note
          </MenuButton>
          {board.items.length > 1 && (
            <MenuButton icon={<Link2 />} onClick={choose(() => setLinking(true))}>
              Link to another item
            </MenuButton>
          )}
          {href && (
            <Link href={href} className="flex h-8 items-center gap-2 rounded-sm px-2 text-ink no-underline hover:bg-rule-soft">
              <ExternalLink className="size-4 text-ink-3" aria-hidden /> Open on the site
            </Link>
          )}
          {hasChanged(item) && (
            <MenuButton icon={<RefreshCw />} onClick={choose(() => board.refreshPlaced(item.id))}>
              Use the current wording
            </MenuButton>
          )}
          <MenuButton icon={<ArrowUp />} onClick={choose(() => board.step(item.id, -1))}>
            Move earlier
          </MenuButton>
          <MenuButton icon={<ArrowDown />} onClick={choose(() => board.step(item.id, 1))}>
            Move later
          </MenuButton>
          <MenuButton icon={<Trash2 />} onClick={choose(() => board.remove(item.id))} danger>
            Remove from the canvas
          </MenuButton>
        </PopoverContent>
      </Popover>
      <LinkPicker item={item} heading={refName({ kind: item.kind, label: heading })} open={linking} onOpenChange={setLinking} />
    </>
  );

  if (item.kind === "section")
    return (
      <section
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`Section: ${heading}`}
        data-pending={pending || undefined}
        className={cn("canvas-tile group flex h-full items-end gap-2 border-b border-rule pb-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo", pending && "border-dotted border-ink-3")}
      >
        {mode === "board" && board.editable && (
          <GripVertical className="tile-handle size-4 shrink-0 cursor-grab text-ink-3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" aria-hidden />
        )}
        {editing ? (
          <Editor item={item} onDone={() => setEditing(false)} />
        ) : (
          <h2 className="tile-handle min-w-0 flex-1 truncate font-heading text-2xl leading-tight tracking-[-0.01em] text-ink">{heading}</h2>
        )}
        {pending && <PendingControls item={item} />}
        {menu}
      </section>
    );

  return (
    <article
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`${KIND_WORDS[item.kind]}: ${heading}${pending ? ", added by your AI, not kept yet" : ""}`}
      data-pending={pending || undefined}
      className={cn(
        "canvas-tile group flex h-full min-h-0 flex-col rounded-md border bg-paper outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo",
        pending ? "border-2 border-dotted border-ink-3" : "border-rule",
      )}
    >
      <header className={cn("tile-handle flex shrink-0 items-center gap-1.5 px-2.5 pt-2 pb-1", mode === "board" && board.editable && "cursor-grab active:cursor-grabbing")}>
        {mode === "board" && board.editable && (
          <GripVertical className="-ml-1 size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100" aria-hidden />
        )}
        <p className={cn("min-w-0 flex-1 truncate font-sans text-xs text-ink-3", titlesOnly && "invisible")}>
          {KIND_WORDS[item.kind]}
          {item.content.title && item.kind !== "text" ? `: ${item.content.title}` : ""}
          {ai ? ", added by your AI" : ""}
        </p>
        {pending && !titlesOnly && <PendingControls item={item} />}
        {menu}
      </header>
      {titlesOnly ? (
        // Seen from far out (zoom under 40%): the title alone, large enough to read at that scale.
        <p className="line-clamp-3 px-3 pb-3 font-serif text-[2.5rem] leading-[1.1] tracking-[-0.015em] text-ink">{heading}</p>
      ) : (
        <div
          className={cn("nodrag nowheel min-h-0 flex-1 px-3 pb-3", bodyHeight !== null && "scroll-thin overflow-y-auto")}
        >
          {editing ? (
            <Editor item={item} onDone={() => setEditing(false)} />
          ) : (
            <>
              <ItemBody
                item={item}
                height={bodyHeight}
                editing={mode === "board" && board.editable}
                onMapChange={onMapChange}
                onTimelineChange={onTimelineChange}
              />
              {item.content.caption && item.kind !== "media" && (
                <div className={cn("mt-3 font-sans text-note leading-snug text-ink-2", ai ? "marginalia" : "border-l-2 border-rule pl-3")}>
                  <Markdown className="[&_p]:mt-0">{item.content.caption}</Markdown>
                </div>
              )}
              {mode === "list" && <ListLinks item={item} />}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** The lines from and to this item, for the phone list, where there is no board to draw them on. */
function ListLinks({ item }: { item: Item }) {
  const board = useBoard();
  const links = board.linksOf(item.id);
  if (!links.length) return null;
  return (
    <ul className="mt-3 space-y-1 border-t border-rule-soft pt-2 font-sans text-sm text-ink-2" aria-label="Linked items">
      {links.map((l) => (
        <li key={l.id} className="flex items-start gap-2">
          <Link2 className={cn("mt-0.5 size-3.5 shrink-0", l.pending ? "text-ink-3" : "text-indigo")} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className={cn(l.pending && "italic")}>
              {l.outgoing ? RELATION_WORDS[l.relation] ?? l.relation : `${RELATION_WORDS[l.relation] ?? l.relation} this`}
            </span>{" "}
            <span className="text-ink">{l.outgoing ? refName(l.other) : `(${refName(l.other)})`}</span>
            {l.label ? <span className="text-ink-3">: {l.label}</span> : null}
          </span>
          {board.editable && (
            <Button size="icon-xs" variant="ghost" onClick={() => board.unlink(l.id)} aria-label={`Remove the line to ${refName(l.other)}`} title="Remove the line">
              <X />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * "Link to another item": pick the item, then how the two are related. The
 * same dialog on the board and in the phone list, so a line never needs a
 * drag between two dots.
 */
function LinkPicker({
  item,
  heading,
  open,
  onOpenChange,
}: {
  item: Item;
  heading: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const board = useBoard();
  const [target, setTarget] = useState<BoardItemRef | null>(null);
  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTarget(null);
  };
  const others = board.items.filter((i) => i.id !== item.id);
  return (
    <CommandDialog
      open={open}
      onOpenChange={close}
      title={target ? `How is “${short(heading)}” related to “${short(refName(target))}”?` : `Link “${short(heading)}” to…`}
      description={target ? "The line between them will say this." : "Choose another item on this canvas."}
    >
      {/* A fresh Command per step: cmdk would otherwise keep filtering the relations by the item search. */}
      <Command key={target ? "relation" : "item"}>
        <p className="border-b border-rule px-3 py-2.5 font-sans text-ui text-ink">
          {target ? (
            <>
              <span className="text-ink-3">“{short(heading)}”</span> … <span className="text-ink-3">“{short(refName(target))}”</span>
            </>
          ) : (
            <>
              Link <span className="text-ink-3">“{short(heading)}”</span> to another item
            </>
          )}
        </p>
        {target ? (
          <>
          {/* The field keeps the focus in the list, so the arrow keys and Enter pick a relation. */}
          <CommandInput placeholder="How are they related?" autoFocus aria-label="How are they related?" />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>No relation matches. Try “supports” or “led to”.</CommandEmpty>
            <CommandGroup heading={`“${short(heading)}” …`}>
              {Object.entries(RELATION_WORDS).map(([relation, words]) => {
                // A line already drawn is shown, not offered again.
                const drawn = board
                  .linksOf(item.id)
                  .some((l) => l.outgoing && l.other.id === target.id && l.relation === relation);
                return (
                  <CommandItem
                    key={relation}
                    value={words}
                    disabled={drawn}
                    className="data-[disabled=true]:text-ink-3 data-[disabled=true]:opacity-100"
                    onSelect={() => {
                      board.link(item.id, target.id, relation);
                      close(false);
                    }}
                  >
                    <Link2 className="text-ink-3" aria-hidden />
                    <span>
                      {words} <span className="text-ink-3">“{short(refName(target))}”</span>
                    </span>
                    {drawn && <span className="ml-auto text-xs text-ink-3">already linked</span>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandGroup>
              <CommandItem value="Choose a different item" onSelect={() => setTarget(null)}>
                <span className="text-ink-3">Choose a different item</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
          </>
        ) : (
          <>
            <CommandInput placeholder="Which item?" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>No item on this canvas matches.</CommandEmpty>
              <CommandGroup heading="Items on this canvas">
                {others.map((o) => (
                  <CommandItem key={o.id} value={`${o.label} ${KIND_WORDS[o.kind] ?? o.kind} ${o.id}`} onSelect={() => setTarget(o)}>
                    <span className="w-20 shrink-0 truncate text-xs text-ink-3">{KIND_WORDS[o.kind] ?? o.kind}</span>
                    <span className="line-clamp-2">{o.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </>
        )}
      </Command>
    </CommandDialog>
  );
}

function short(s: string, n = 48): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

/** Keep or remove one item the AI added (the toolbar does a whole batch). */
function PendingControls({ item }: { item: Item }) {
  const board = useBoard();
  return (
    <span className="nodrag flex shrink-0 gap-0.5">
      <Button size="xs" variant="ghost" onClick={() => board.decide(item.id, true)} title="Keep it on this canvas">
        <Check data-icon="inline-start" /> Keep
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={() => board.decide(item.id, false)}
        aria-label={`Remove what your AI added: ${KIND_WORDS[item.kind]}`}
        title="Remove"
      >
        <X />
      </Button>
    </span>
  );
}

function MenuButton({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left hover:bg-rule-soft [&_svg]:size-4 [&_svg]:text-ink-3",
        danger ? "text-madder [&_svg]:text-madder" : "text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** The learner's own words on an item: its title and note, the text of a text card, how a part shows. */
function Editor({ item, onDone }: { item: Item; onDone: () => void }) {
  const board = useBoard();
  const c = item.content;
  const [title, setTitle] = useState(c.kind === "section" ? c.title : (c.title ?? ""));
  const [caption, setCaption] = useState(c.caption ?? "");
  const [markdown, setMarkdown] = useState(c.kind === "text" ? c.markdown : "");
  const [show, setShow] = useState(c.kind === "chapter" ? c.show : "brief");
  const [citations, setCitations] = useState(c.kind === "claim" ? c.citations : true);
  const save = () => {
    const base = { ...c, title: title.trim() || undefined, caption: caption.trim() || undefined } as CanvasItemContent;
    let next: CanvasItemContent = base;
    if (c.kind === "section") next = { ...c, title: title.trim() || c.title, caption: caption.trim() || undefined };
    if (c.kind === "text") next = { ...(base as typeof c), markdown: markdown.trim() || c.markdown };
    if (c.kind === "chapter") next = { ...(base as typeof c), show };
    if (c.kind === "claim") next = { ...(base as typeof c), citations };
    board.update(item.id, next);
    onDone();
  };
  return (
    <form
      className="nodrag space-y-2 font-sans text-ui"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
    >
      <label className="block">
        <span className="text-sm text-ink-2">{c.kind === "section" ? "Section title" : "Title (optional)"}</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus className="mt-1" />
      </label>
      {c.kind === "text" && (
        <label className="block">
          <span className="text-sm text-ink-2">Text (Markdown)</span>
          <Textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={5} maxLength={20000} className="mt-1" />
        </label>
      )}
      {c.kind !== "section" && (
        <label className="block">
          <span className="text-sm text-ink-2">Your note (why it is here)</span>
          <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={2000} className="mt-1" />
        </label>
      )}
      {c.kind === "chapter" && (
        <fieldset className="flex gap-3 text-sm text-ink-2">
          <legend className="sr-only">How the part shows</legend>
          {(["brief", "full"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="radio" name={`show-${item.id}`} checked={show === v} onChange={() => setShow(v)} />
              {v === "brief" ? "The short version" : "The whole part"}
            </label>
          ))}
        </fieldset>
      )}
      {c.kind === "claim" && (
        <label className="flex items-center gap-1.5 text-sm text-ink-2">
          <input type="checkbox" checked={citations} onChange={(e) => setCitations(e.target.checked)} />
          Show the sources
        </label>
      )}
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm">
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
