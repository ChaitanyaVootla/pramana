"use client";

import { SITE_VIEW_ID } from "@pramana/core";
import type { UserViewState } from "@pramana/services";
import { Check, Monitor, Moon, SlidersHorizontal, Sun, Undo2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { setAppearanceAction, undoViewAction } from "@/app/canvas/actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segments } from "@/components/ui/segments";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveEvents } from "@/lib/useLiveEvents";
import { cn } from "@/lib/utils";
import {
  APPEARANCE_KEY,
  appearanceAttributes,
  appearanceCookie,
  DENSITIES as DENSITY,
  LINE_WIDTHS as WIDTH,
  parseAppearance,
  TEXT_SIZES as TEXT,
  THEMES,
  type AppearanceSettings as Appearance,
  type EvidenceDensity,
  type LineWidth,
  type TextSize,
  type Theme,
} from "./appearance-settings";

/*
 * The appearance panel (docs/visual.md §4): theme, text size, line width and
 * evidence density. The choices live as data attributes on <html>
 * (data-text, data-width, data-density), which the tokens in globals.css
 * respond to, so a page never reads them itself. They are kept per learner in
 * their site-wide view (services/userviews, subject "site"), so they follow
 * the learner to any device; a cookie and localStorage mirror them so the
 * server renders the right attributes before paint. A change made elsewhere
 * (another device, or the learner's AI over MCP) arrives live.
 */

/** Sets the attributes and the local mirrors; the view itself is saved by the caller. */
function applyLocal(a: Appearance) {
  const el = document.documentElement;
  for (const [k, v] of Object.entries(appearanceAttributes(a))) el.setAttribute(k, v);
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(a));
  document.cookie = appearanceCookie(a);
}

/**
 * Runs a change that reflows the page (text size, line width) without losing
 * the reader's place: a small block near the top of the viewport stays where
 * it was. Only small blocks in the flow anchor (never a whole section, whose
 * own top moves with everything above it; never sticky or fixed content, whose
 * top does not move with the page). The browser's own scroll anchoring is
 * switched off for the change, so the two corrections never add up.
 */
function keepPlace(change: () => void) {
  if (window.scrollY === 0) return change();
  const root = document.documentElement;
  const topBar = document.querySelector("header")?.getBoundingClientRect().bottom ?? 48;
  const blocks = "p, h1, h2, h3, h4, h5, li, figure, figcaption, blockquote, pre, table, dt, dd, label, summary";
  const inFlow = (el: Element) => {
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      const pos = getComputedStyle(n).position;
      if (pos === "sticky" || pos === "fixed") return false;
    }
    return true;
  };
  let anchor: Element | null = null;
  probe: for (let dy = 8; dy <= 400; dy += 16) {
    // The far-left column last: the open panel (right-aligned, wider at large text) can cover the middle.
    for (const x of [0.3, 0.42, 0.2, 0.55, 0.08]) {
      const el = document.elementFromPoint(window.innerWidth * x, topBar + dy)?.closest(blocks);
      if (el && !el.closest("header, [data-slot=popover-content], [data-slot=sheet-content]") && inFlow(el)) {
        anchor = el;
        break probe;
      }
    }
  }
  const before = anchor?.getBoundingClientRect().top;
  const anchoring = root.style.overflowAnchor;
  root.style.overflowAnchor = "none";
  change();
  const restore = () => {
    root.style.overflowAnchor = anchoring;
  };
  if (!anchor || before === undefined) return requestAnimationFrame(restore);
  // getBoundingClientRect forces the new layout, so the shift is known at once. Parts of the page re-lay
  // themselves out a frame or two later (a measured band or chart re-packing its labels at the new size),
  // so the anchor is held for a quarter of a second, frame by frame, before the browser's own anchoring
  // comes back.
  const hold = () => {
    const shift = anchor.getBoundingClientRect().top - before;
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "instant" as ScrollBehavior });
  };
  hold();
  const until = performance.now() + 250;
  const frame = () => {
    hold();
    if (performance.now() < until) requestAnimationFrame(frame);
    else restore();
  };
  requestAnimationFrame(frame);
}

const THEME_ROWS: { value: Theme; label: string; Icon: typeof Monitor }[] = [
  { value: "system", label: "Match my device", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

const TEXT_WORDS: Record<TextSize, string> = { small: "Small", standard: "Standard", large: "Large" };
const WIDTH_WORDS: Record<LineWidth, string> = { standard: "Standard", wide: "Wide" };
const DENSITY_WORDS: Record<EvidenceDensity, string> = { quiet: "Quiet", standard: "Standard", full: "Full" };
const DENSITY_HELP: Record<EvidenceDensity, string> = {
  quiet: "Just the evidence squares on each claim. Open a claim to see its sources.",
  standard: "The evidence squares, and the source next to each claim.",
  full: "Quotations and checks, shown in the text as you read.",
};

/** Theme, text size, line width and evidence density, from the top bar. */
export function Appearance({
  initial,
  stored = false,
  version = 0,
}: {
  initial: Appearance;
  /** `initial` came from the learner's site-wide view (not only the cookie). */
  stored?: boolean;
  /** The site-wide view's version `initial` was read at. */
  version?: number;
}) {
  const { theme = "system", setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [a, setA] = useState<Appearance>(initial);
  const seen = useRef(version);
  const busy = useRef<Promise<unknown>>(Promise.resolve());

  const save = useCallback((next: Appearance) => {
    busy.current = busy.current.then(async () => {
      const r = await setAppearanceAction(next);
      if (r.ok) seen.current = Math.max(seen.current, r.value.version);
      else toast.error("Your appearance choices were not saved.", { description: r.error });
    });
  }, []);

  useEffect(() => {
    setMounted(true);
    if (stored) {
      // The learner's view is the one copy; this device follows it.
      applyLocal(initial);
      if (initial.theme && initial.theme !== theme) setTheme(initial.theme);
      return;
    }
    // No view yet: the choices made on this device before views existed become the learner's.
    const local = localStorage.getItem(APPEARANCE_KEY);
    if (!local) return;
    const fromDevice = parseAppearance(local);
    const next = { ...fromDevice, ...(THEMES.includes(theme as Theme) && theme !== "system" ? { theme: theme as Theme } : {}) };
    setA(next);
    applyLocal(next);
    save(next);
    // Only on mount: later changes come through `set` and the live stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** A change from elsewhere (another device, the learner's AI): the panel and the page follow it. */
  const pull = useCallback(async () => {
    await busy.current;
    const res = await fetch(`/api/views?type=site&id=${SITE_VIEW_ID}`, { cache: "no-store" });
    if (!res.ok) return;
    const state = (await res.json()) as UserViewState;
    if (state.version <= seen.current) return;
    seen.current = state.version;
    const next = state.view.appearance ?? parseAppearance(null);
    setA(next);
    applyLocal(next);
    if (next.theme) setTheme(next.theme);
    const change = state.pendingAiChange;
    if (change)
      toast("Your AI changed how the site looks.", {
        description: [change.note, change.lines.join("; ")].filter(Boolean).join(" "),
        action: { label: "Undo", onClick: () => void undoViewAction({ type: "site", id: SITE_VIEW_ID }) },
        icon: <Undo2 className="size-4" aria-hidden />,
      });
  }, [setTheme]);
  useLiveEvents((e) => {
    if (e.table === "user_views" && e.id === SITE_VIEW_ID) void pull();
  });

  const set = (patch: Partial<Appearance>) => {
    const next = { ...a, ...patch };
    setA(next);
    if ("text" in patch || "width" in patch) keepPlace(() => applyLocal(next));
    else applyLocal(next);
    save(next);
  };
  const pickTheme = (value: Theme) => {
    setTheme(value);
    set({ theme: value });
  };

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 font-sans text-ui text-ink-2 transition-colors hover:bg-rule-soft hover:text-ink aria-expanded:bg-rule-soft aria-expanded:text-ink"
              aria-label="Appearance: theme, text size and evidence"
            />
          }
        >
          <SlidersHorizontal className="size-[18px]" aria-hidden />
          {/* A word beside the mark, so it does not read as a twin of the study partner's rings next to it. */}
          <span className="hidden sm:inline" aria-hidden>
            View
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Appearance: theme, text size and evidence</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72 gap-0 p-2 font-sans">
        <Group label="Theme">
          {THEME_ROWS.map(({ value, label, Icon }) => (
            <Row key={value} active={mounted && theme === value} onClick={() => pickTheme(value)}>
              <Icon className="size-4 text-ink-3" aria-hidden />
              {label}
            </Row>
          ))}
        </Group>
        <Group label="Text size">
          <Segments
            className="mx-2"
            options={TEXT.map((t) => ({ value: t, label: TEXT_WORDS[t] }))}
            value={a.text}
            onChange={(text) => set({ text })}
            sample
          />
        </Group>
        <Group label="Text width">
          <Segments className="mx-2" options={WIDTH.map((w) => ({ value: w, label: WIDTH_WORDS[w] }))} value={a.width} onChange={(width) => set({ width })} />
        </Group>
        <Group label="How much evidence to show">
          <Segments
            className="mx-2"
            options={DENSITY.map((d) => ({ value: d, label: DENSITY_WORDS[d] }))}
            value={a.density}
            onChange={(density) => set({ density })}
          />
          <p className="px-2 pt-1.5 text-xs text-ink-3">{DENSITY_HELP[a.density]}</p>
        </Group>
        <p className="border-t border-rule px-2 pt-2 pb-0.5 text-xs text-ink-3">Kept with your account, so every device you read on follows.</p>
      </PopoverContent>
    </Popover>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-rule py-1.5 first:border-t-0 first:pt-0">
      <p className="px-2 pt-1 pb-1 text-xs font-medium text-ink-3">{label}</p>
      {children}
    </div>
  );
}

function Row({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-ui transition-colors hover:bg-rule-soft",
        active ? "font-medium text-ink" : "text-ink-2",
      )}
    >
      {children}
      {active && <Check className="ml-auto size-4 text-indigo" aria-hidden />}
    </button>
  );
}
