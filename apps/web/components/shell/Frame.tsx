import { cn } from "@/lib/utils";

/*
 * The one page frame. Width and gutters are CSS variables in globals.css
 * (--frame-max, --gutter, --toc-w, --rail-w), so every page grows the same
 * way on wide screens and keeps the same safe-area-aware gutters on phones.
 */

/** Class for a full-width frame when a component cannot use <Frame>. */
export const FRAME = "frame";

/**
 * The twelve-column page grid for pages that are not a reading column (home,
 * places, timeline): children span with `col-span-*` / `lg:col-span-*`. Gaps
 * are 16px, 24px from 1280px.
 */
export const PAGE_GRID = "grid grid-cols-12 gap-4 xl:gap-6";

/** Desktop three-column reading grid: chapters | reading column | context rail. */
export const READING_GRID =
  "grid gap-x-8 gap-y-8 lg:grid-cols-[var(--toc-w)_minmax(0,1fr)_var(--rail-w)] xl:gap-x-12 2xl:grid-cols-[var(--toc-w)_minmax(0,var(--reading-w))_minmax(var(--rail-w),1fr)] 2xl:gap-x-14";
/** Two columns: reading column | rail. */
export const TWO_COL_GRID =
  "grid gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_var(--rail-w)] xl:gap-x-12";

/**
 * The era page grid. The hero and the chapters share the reading columns, and
 * the rail (atlas and context card) spans both rows so it stays put from the
 * top of the page to the end. The outline column appears from 1280px; below
 * that the chapters live in a floating pill. Children carry `era-hero`,
 * `era-rail`, `era-outline` and `era-body`; the placement is here.
 */
// Plain join: these placement classes must not be merged away.
const join = (...c: string[]) => c.join(" ");

export function ERA_GRID({ outline, rail }: { outline: boolean; rail: boolean }) {
  const base = "grid gap-x-8 gap-y-8 xl:gap-x-12 2xl:gap-x-14";
  if (outline && rail)
    return join(
      base,
      "lg:grid-cols-[minmax(0,1fr)_var(--rail-w)] xl:grid-cols-[var(--toc-w)_minmax(0,1fr)_var(--rail-w)] 2xl:grid-cols-[var(--toc-w)_minmax(0,var(--reading-w))_minmax(var(--rail-w),1fr)]",
      "lg:[&>.era-hero]:col-start-1 lg:[&>.era-hero]:row-start-1 xl:[&>.era-hero]:col-span-2",
      "lg:[&>.era-rail]:col-start-2 lg:[&>.era-rail]:row-span-2 lg:[&>.era-rail]:row-start-1 xl:[&>.era-rail]:col-start-3",
      "xl:[&>.era-outline]:col-start-1 xl:[&>.era-outline]:row-start-2",
      "lg:[&>.era-body]:col-start-1 lg:[&>.era-body]:row-start-2 xl:[&>.era-body]:col-start-2",
    );
  if (rail)
    return join(
      base,
      "lg:grid-cols-[minmax(0,1fr)_var(--rail-w)] 2xl:grid-cols-[minmax(0,calc(var(--reading-w)+12rem))_minmax(var(--rail-w),1fr)]",
      "lg:[&>.era-hero]:col-start-1 lg:[&>.era-hero]:row-start-1 lg:[&>.era-body]:col-start-1 lg:[&>.era-body]:row-start-2",
      "lg:[&>.era-rail]:col-start-2 lg:[&>.era-rail]:row-span-2 lg:[&>.era-rail]:row-start-1",
    );
  if (outline)
    return join(
      base,
      "xl:grid-cols-[var(--toc-w)_minmax(0,calc(var(--reading-w)+12rem))]",
      "xl:[&>.era-hero]:col-span-2 xl:[&>.era-outline]:col-start-1 xl:[&>.era-outline]:row-start-2 xl:[&>.era-body]:col-start-2 xl:[&>.era-body]:row-start-2",
    );
  return join(base, "lg:grid-cols-[minmax(0,calc(var(--reading-w)+12rem))]");
}

export function Frame({
  as: Tag = "div",
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "header" | "footer" | "nav" | "main";
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Tag className={cn(FRAME, className)} {...rest}>
      {children}
    </Tag>
  );
}
