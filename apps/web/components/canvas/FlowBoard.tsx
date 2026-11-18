"use client";

import "@xyflow/react/dist/base.css";
import type { CanvasItemContent, CanvasLayout } from "@pramana/core";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  NodeResizer,
  Position,
  ReactFlow,
  useInternalNode,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
  applyNodeChanges,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COL, fromPx, GAP, ROW, toPx } from "./geometry";
import { ItemTile, useBoard } from "./ItemTile";
import { RELATION_WORDS, type Item, type Link } from "./types";

/**
 * The board on wide screens (and on phones after "Edit layout"): React Flow
 * (MIT, xyflow) drives pan, zoom, drag and resize; the tiles are ours. Tiles
 * snap to the 96 × 48 px grid; when one is dropped on others, they move down
 * (the layout rules are in packages/core/src/canvas.ts). Lines between tiles
 * carry a relation; drag from a tile's edge dot to another tile to draw one.
 */

type Box = { x: number; y: number; width: number; height: number };
type TileData = {
  item: Item;
  onConfig: (id: string, content: CanvasItemContent) => void;
  onResized: (id: string, box: Box) => void;
};
type TileNode = Node<TileData, "tile">;
type RelationEdge = Edge<{ link: Link; onRelation: (id: string, relation: string | null) => void }, "relation">;

const HEADER = 34;
/** Below this zoom the words would be too small to read, so tiles show their titles only. */
const FAR = 0.4;

const Tile = memo(function Tile({ data, selected, width, height }: NodeProps<TileNode>) {
  const board = useBoard();
  const far = useStore((s) => s.transform[2] < FAR);
  const { item } = data;
  const h = (height ?? toPx(item.layout).height) - HEADER;
  return (
    <div className="h-full w-full" style={{ width, height }}>
      {board.editable && (
        <NodeResizer
          isVisible={selected}
          minWidth={80}
          minHeight={item.kind === "section" ? ROW - GAP : 2 * ROW - GAP}
          lineClassName="!border-indigo/50"
          handleClassName="!size-2.5 !rounded-sm !border-indigo !bg-paper"
          onResizeEnd={(_e, p) => data.onResized(item.id, p)}
        />
      )}
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={Position[(side.charAt(0).toUpperCase() + side.slice(1)) as "Top"]}
          className={cn(
            "!size-3.5 !border-[1.5px] !border-indigo !bg-paper opacity-0 transition-opacity group-hover/tile:opacity-100 hover:!bg-indigo-wash",
            !board.editable && "!hidden",
          )}
          title="Drag onto another tile to link them (or use the tile's menu)"
          // A pointer affordance only; links are also made through the tile's menu ("Link to another item").
          aria-hidden
        />
      ))}
      <ItemTile
        item={item}
        mode="board"
        bodyHeight={Math.max(40, h)}
        titlesOnly={far && item.kind !== "section"}
        onMapChange={(c) => item.content.kind === "map" && c.year !== item.content.year && data.onConfig(item.id, { ...item.content, year: c.year })}
        onTimelineChange={(c) =>
          item.content.kind === "timeline" &&
          (c.range[0] !== item.content.range[0] || c.range[1] !== item.content.range[1]) &&
          data.onConfig(item.id, { ...item.content, range: c.range })
        }
      />
    </div>
  );
});

/* Colour is meaning: a supporting line is indigo (evidence), a contradicting one turmeric (contested); the rest ink. */
const RELATION_TONE: Record<string, string> = {
  supports: "var(--indigo)",
  contradicts: "var(--turmeric)",
};

/** The nearest sides of two tiles, so a line runs between their facing edges, never top to top over the headers. */
function facing(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): { sourceX: number; sourceY: number; sourcePosition: Position; targetX: number; targetY: number; targetPosition: Position } {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  // Side by side (with a gap): leave from the facing vertical edges; otherwise from the facing horizontal ones.
  const gapX = Math.abs(dx) - (a.w + b.w) / 2;
  const gapY = Math.abs(dy) - (a.h + b.h) / 2;
  if (gapX > gapY) {
    const right = dx > 0;
    return {
      sourceX: right ? a.x + a.w : a.x,
      sourceY: ac.y,
      sourcePosition: right ? Position.Right : Position.Left,
      targetX: right ? b.x : b.x + b.w,
      targetY: bc.y,
      targetPosition: right ? Position.Left : Position.Right,
    };
  }
  const below = dy > 0;
  return {
    sourceX: ac.x,
    sourceY: below ? a.y + a.h : a.y,
    sourcePosition: below ? Position.Bottom : Position.Top,
    targetX: bc.x,
    targetY: below ? b.y : b.y + b.h,
    targetPosition: below ? Position.Top : Position.Bottom,
  };
}

function boxOf(n: ReturnType<typeof useInternalNode>) {
  if (!n) return null;
  return {
    x: n.internals.positionAbsolute.x,
    y: n.internals.positionAbsolute.y,
    w: n.measured.width ?? n.width ?? 0,
    h: n.measured.height ?? n.height ?? 0,
  };
}

function RelationLine({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<RelationEdge>) {
  const a = boxOf(useInternalNode(source));
  const b = boxOf(useInternalNode(target));
  const ends = a && b ? facing(a, b) : { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition };
  const [path, midX, midY] = getBezierPath(ends);
  const board = useBoard();
  const link = data!.link;
  const pending = link.status === "pending";
  const words = `${RELATION_WORDS[link.relation] ?? link.relation}${link.label ? `: ${link.label}` : ""}`;
  // The words sit on the line where there is room. Between two tiles side by side the gap is too
  // narrow for them, so they go just above the gap, clear of both tiles.
  let labelX = midX;
  let labelY = midY;
  if (a && b && (ends.sourcePosition === Position.Left || ends.sourcePosition === Position.Right)) {
    const gap = Math.abs(ends.targetX - ends.sourceX);
    if (gap < labelWidth(words) + 8) labelY = Math.min(a.y, b.y) - 14;
  }
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: RELATION_TONE[link.relation] ?? "var(--ink-3)",
          strokeWidth: 1.5,
          strokeDasharray: pending ? "2 4" : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan pointer-events-auto absolute"
          // Above the tiles, so a label in a narrow gap is never cut by their edges.
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, zIndex: 1001 }}
        >
          <Popover>
            <PopoverTrigger
              disabled={!board.editable}
              title={words}
              className={cn(
                "max-w-52 truncate rounded-sm border bg-paper px-1.5 py-0.5 font-sans text-xs text-ink-2 transition-colors hover:text-ink",
                pending ? "border-dotted border-ink-3" : "border-rule",
              )}
            >
              {words}
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1 font-sans text-ui">
              <p className="px-2 py-1 text-sm text-ink-3">How are these related?</p>
              {Object.entries(RELATION_WORDS).map(([r, w]) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={link.relation === r}
                  onClick={() => data!.onRelation(link.id, r)}
                  className={cn("flex h-8 w-full items-center rounded-sm px-2 text-left hover:bg-rule-soft", link.relation === r && "font-medium text-indigo")}
                >
                  {w}
                </button>
              ))}
              <button
                type="button"
                onClick={() => data!.onRelation(link.id, null)}
                className="mt-1 flex h-8 w-full items-center rounded-sm border-t border-rule-soft px-2 text-left text-madder hover:bg-rule-soft"
              >
                Remove the line
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

/** About how wide a line's words are drawn (12px Inter, padding and edge), capped as the tag is (max-w-52). */
function labelWidth(words: string): number {
  return Math.min(208, words.length * 6.6 + 16);
}

const nodeTypes = { tile: Tile };
const edgeTypes = { relation: RelationLine };

/** The smallest zoom a fit goes to: below it the tiles' words are too small to read. */
const FIT_FLOOR = 0.6;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The room the floating chrome leaves on the board (under the toolbar, left of the notes), in screen px. */
function freeArea(el: HTMLElement) {
  const frame = el.getBoundingClientRect();
  const chrome = el.querySelector(".canvas-chrome")?.getBoundingClientRect();
  const aside = el.querySelector(".canvas-aside")?.getBoundingClientRect();
  const pad = 32;
  const top = chrome ? chrome.bottom - frame.top + 24 : pad;
  const right = aside && aside.top - frame.top < el.clientHeight / 2 ? aside.width + 24 : 0;
  return {
    pad,
    top,
    w: Math.max(120, el.clientWidth - pad - right - pad),
    h: Math.max(120, el.clientHeight - top - pad),
  };
}

/** How many board columns fit across the screen at the smallest legible zoom (for "Tidy up"). */
export function screenColumns(): number | null {
  const el = document.querySelector<HTMLElement>(".canvas-ground");
  if (!el) return null;
  return Math.floor((freeArea(el).w + GAP * FIT_FLOOR) / (COL * FIT_FLOOR));
}

/**
 * Brings tiles into the free part of the board, moving the view as little as
 * it can: a pan, and a zoom out only when they would not fit at the current
 * zoom (never below the legible floor).
 */
function reveal(rf: ReactFlowInstance<TileNode, RelationEdge>, el: HTMLElement, nodes: TileNode[], duration = 200) {
  if (!nodes.length) return;
  const b = rf.getNodesBounds(nodes);
  const { pad, top, w, h } = freeArea(el);
  const [left, right, bottom] = [pad, pad + w, top + h];
  let { x, y, zoom } = rf.getViewport();
  zoom = Math.max(FIT_FLOOR, Math.min(zoom, w / b.width, h / b.height));
  const sx = b.x * zoom + x;
  const sy = b.y * zoom + y;
  const ex = sx + b.width * zoom;
  const ey = sy + b.height * zoom;
  if (sx < left || b.width * zoom > w) x += left - sx;
  else if (ex > right) x -= ex - right;
  if (sy < top || b.height * zoom > h) y += top - sy;
  else if (ey > bottom) y -= ey - bottom;
  const now = rf.getViewport();
  if (x === now.x && y === now.y && zoom === now.zoom) return;
  void rf.setViewport({ x, y, zoom }, { duration: reducedMotion() ? 0 : duration });
}

/**
 * Shows every tile in the free part of the board, never larger than life. A
 * board too big to show whole at a legible size opens at its start (top left)
 * at that size instead; the rest is a pan away.
 */
export function fitAll(rf: ReactFlowInstance<TileNode, RelationEdge>, el: HTMLElement, nodes: TileNode[], duration = 0) {
  if (!nodes.length) return;
  const bounds = rf.getNodesBounds(nodes);
  const { pad, top, w, h } = freeArea(el);
  const whole = Math.min(1, w / bounds.width, h / bounds.height);
  const zoom = Math.max(FIT_FLOOR, whole);
  const across = bounds.width * zoom <= w;
  const down = bounds.height * zoom <= h;
  void rf.setViewport(
    {
      x: across ? pad + (w - bounds.width * zoom) / 2 - bounds.x * zoom : pad - bounds.x * zoom,
      y: down ? top + Math.min(h - bounds.height * zoom, 48) / 2 - bounds.y * zoom : top - bounds.y * zoom,
      zoom,
    },
    { duration: duration && reducedMotion() ? 0 : duration },
  );
}

export function FlowBoard({
  items,
  links,
  layouts,
  onMove,
  onConfig,
  onConnect,
  onRelation,
  chrome,
  aside,
  asideOpen = false,
  fitKey,
  revealIds,
  onRevealed,
  refit,
}: {
  items: Item[];
  links: Link[];
  layouts: Record<string, CanvasLayout>;
  onMove: (id: string, layout: CanvasLayout) => void;
  onConfig: (id: string, content: CanvasItemContent) => void;
  onConnect: (from: string, to: string) => void;
  onRelation: (linkId: string, relation: string | null) => void;
  /** The toolbar and what hangs under it, floating at the top left. */
  chrome: React.ReactNode;
  /** The study partner's notes, docked at the right edge (or nothing). */
  aside?: React.ReactNode;
  /** Whether the aside is open: the board fits its items again when this changes, so the panel never covers them. */
  asideOpen?: boolean;
  /** Changes when the board should fit its items again (first load). */
  fitKey: string;
  /** Items the learner just added: brought into view, clear of the toolbar, once they are drawn. */
  revealIds?: string[];
  /** Changes when the learner rearranged the board (Tidy up): fit it again once drawn. */
  refit?: number;
  onRevealed?: () => void;
}) {
  const board = useBoard();
  const { resolvedTheme } = useTheme();
  // The theme is known only in the browser: render "light" on the server and the first paint, then follow it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const wrap = useRef<HTMLDivElement>(null);
  const onResized = useCallback((id: string, box: Box) => onMove(id, fromPx(box)), [onMove]);
  const derived = useMemo<TileNode[]>(
    () =>
      items.map((item) => {
        const px = toPx(layouts[item.id] ?? item.layout);
        return {
          id: item.id,
          type: "tile",
          position: { x: px.x, y: px.y },
          width: px.width,
          height: px.height,
          dragHandle: ".tile-handle",
          className: "group/tile",
          data: { item, onConfig, onResized },
          ariaLabel: undefined,
          focusable: false,
        };
      }),
    [items, layouts, onConfig, onResized],
  );
  const [nodes, setNodes] = useState<TileNode[]>(derived);
  // Keep selection while the server's layout replaces the local one.
  useEffect(() => {
    setNodes((cur) => {
      const selected = new Set(cur.filter((n) => n.selected).map((n) => n.id));
      return derived.map((n) => (selected.has(n.id) ? { ...n, selected: true } : n));
    });
  }, [derived]);

  const edges = useMemo<RelationEdge[]>(
    () =>
      links.map((l) => ({
        id: l.id,
        source: l.from,
        target: l.to,
        type: "relation",
        data: { link: l, onRelation },
      })),
    [links, onRelation],
  );

  // Only the learner's own additions move the view (what their AI adds arrives where it is put).
  const rfRef = useRef<ReactFlowInstance<TileNode, RelationEdge> | null>(null);
  useEffect(() => {
    if (!revealIds?.length) return;
    const shown = nodes.filter((n) => revealIds.includes(n.id));
    if (shown.length < revealIds.length) return;
    const frame = requestAnimationFrame(() => {
      const rf = rfRef.current;
      const el = wrap.current;
      if (rf && el) reveal(rf, el, shown);
      onRevealed?.();
    });
    return () => cancelAnimationFrame(frame);
  }, [revealIds, nodes, onRevealed]);

  const lastRefit = useRef(refit);
  useEffect(() => {
    if (refit === lastRefit.current) return;
    lastRefit.current = refit;
    const frame = requestAnimationFrame(() => {
      const rf = rfRef.current;
      const el = wrap.current;
      if (rf && el) fitAll(rf, el, rf.getNodes(), 250);
    });
    return () => cancelAnimationFrame(frame);
  }, [refit, nodes]);

  // The notes panel docking or leaving the right edge: fit the tiles into the room that is left
  // (a frame later, once the panel is in the layout for freeArea to measure).
  const lastAside = useRef(asideOpen);
  useEffect(() => {
    if (asideOpen === lastAside.current) return;
    lastAside.current = asideOpen;
    // Two frames: the panel is in the DOM after the first, and has its width after the second.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const rf = rfRef.current;
        const el = wrap.current;
        if (rf && el) fitAll(rf, el, rf.getNodes(), 250);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [asideOpen]);

  const onNodesChange = useCallback((changes: NodeChange<TileNode>[]) => {
    // Removing goes through the tile's own menu (with undo), never the Delete key here.
    setNodes((ns) => applyNodeChanges(changes.filter((c) => c.type !== "remove"), ns));
  }, []);

  const commit = useCallback(
    (node: TileNode) => {
      const width = node.width ?? node.measured?.width ?? 0;
      const height = node.height ?? node.measured?.height ?? 0;
      onMove(node.id, fromPx({ x: node.position.x, y: node.position.y, width, height }));
    },
    [onMove],
  );

  return (
    <div ref={wrap} className="canvas-ground absolute inset-0">
      <ReactFlow<TileNode, RelationEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_e, node) => commit(node)}
        onConnect={(c) => c.source && c.target && c.source !== c.target && onConnect(c.source, c.target)}
        onConnectEnd={(event, state: { fromNode?: { id: string } | null; toNode?: { id: string } | null }) => {
          // Dropped on a tile's body rather than a dot: link to that tile.
          if (state.toNode || !state.fromNode) return;
          const point = "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent);
          if (!point) return;
          const el = document.elementFromPoint(point.clientX, point.clientY)?.closest<HTMLElement>(".react-flow__node");
          const to = el?.dataset.id;
          if (to && to !== state.fromNode.id) onConnect(state.fromNode.id, to);
        }}
        connectionRadius={40}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={board.editable}
        nodesConnectable={board.editable}
        elementsSelectable
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        snapToGrid
        snapGrid={[16, 16]}
        minZoom={0.15}
        maxZoom={1.75}
        deleteKeyCode={null}
        disableKeyboardA11y
        colorMode={mounted && resolvedTheme === "dark" ? "dark" : "light"}
        proOptions={{ hideAttribution: false }}
        onInit={(rf) => {
          // Open on the whole board, in the room the chrome leaves. Or, with ?focus=<item> (from
          // "On your canvases"), centred on that item.
          rfRef.current = rf;
          const el = wrap.current;
          if (!el) return;
          const focus = new URLSearchParams(window.location.search).get("focus");
          const target = focus ? nodes.find((n) => n.id === focus) : undefined;
          if (target) {
            void rf.setCenter(target.position.x + (target.width ?? 0) / 2, target.position.y + (target.height ?? 0) / 2, {
              zoom: 1,
            });
            setNodes((ns) => ns.map((n) => (n.id === focus ? { ...n, selected: true } : n)));
            return;
          }
          fitAll(rf, el, nodes);
        }}
        key={fitKey}
        onlyRenderVisibleElements={items.length > 60}
      >
        {/* The ground's 16px dot grid (docs/visual.md §6), moving with the board. */}
        <Background variant={BackgroundVariant.Dots} gap={16} size={1.6} color="color-mix(in oklch, var(--ink-3) 32%, transparent)" />
        {chrome}
        {aside}
      </ReactFlow>
    </div>
  );
}

/** Fit, zoom in and out, for the toolbar (inside the board's provider). */
export function useBoardView() {
  const rf = useReactFlow<TileNode, RelationEdge>();
  return {
    fit: () => {
      const el = document.querySelector<HTMLElement>(".canvas-ground");
      if (el) fitAll(rf, el, rf.getNodes(), 200);
    },
    zoomIn: () => void rf.zoomIn({ duration: 150 }),
    zoomOut: () => void rf.zoomOut({ duration: 150 }),
  };
}
