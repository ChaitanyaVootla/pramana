"use client";

import { cn } from "@/lib/utils";

/**
 * The bench (docs/visual.md §4): the rail of a reading page. It is cut along
 * the right edge of the page, flush under the top bar and out to the edge of
 * the window, and it stays where it is while the reading scrolls. The map and
 * its year sit at the top; under them, one thing at a time, chosen by the
 * reader with the tabs. Sans throughout: the serif is for the reading.
 */
export function Bench({
  label,
  children,
  className,
}: {
  /** What the bench holds, for assistive tech ("Map and context"). */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // After the reading in the DOM (keyboard and screen readers meet the story first); the grid places it beside.
    <aside
      id="era-rail"
      aria-label={label}
      className={cn("era-rail bench hidden min-w-0 lg:block", className)}
    >
      <a
        href="#era-context"
        className="visually-hidden focus:not-sr-only focus:absolute focus:z-30 focus:rounded-md focus:bg-paper focus:px-3 focus:py-2 focus:font-sans focus:text-sm focus:shadow-pop"
      >
        Skip the map
      </a>
      <div className="sticky top-[var(--topbar-h)] flex h-[calc(100dvh-var(--topbar-h))] flex-col gap-3 pt-4 pl-4 xl:pl-5">
        {children}
      </div>
    </aside>
  );
}

export interface BenchTab<T extends string> {
  id: T;
  label: string;
  /** A count after the label ("From your AI 2"). */
  count?: number;
  /** Something new arrived under this tab while another was open: a small dot, no movement. */
  fresh?: boolean;
}

/**
 * The bench's one switch: what is shown under the map. Underlined words, not
 * pills (pills are the shell's). Arrow keys move between tabs.
 */
export function BenchTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  panelId,
}: {
  tabs: BenchTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  panelId: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex shrink-0 gap-x-5 border-b border-rule font-sans"
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const i = tabs.findIndex((t) => t.id === value);
        const next = tabs[(i + step + tabs.length) % tabs.length];
        if (!next) return;
        onChange(next.id);
        requestAnimationFrame(() => document.getElementById(`${panelId}-tab-${next.id}`)?.focus());
      }}
    >
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`${panelId}-tab-${t.id}`}
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative -mb-px inline-flex items-center gap-1.5 border-b-2 pt-1 pb-2 text-ui whitespace-nowrap transition-colors",
              on
                ? "border-ink font-medium text-ink"
                : "border-transparent text-ink-2 hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="text-xs text-ink-3 tnum">{t.count}</span>}
            {t.fresh && !on && (
              <span className="size-1.5 rounded-full bg-turmeric" aria-label="new" role="img" />
            )}
          </button>
        );
      })}
    </div>
  );
}
