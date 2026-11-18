import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * Layout pieces shared by the secondary pages (lineage, entity, source,
 * review, learn, search, history). Ground is `chuna`; the one reading
 * surface on a page is `paper` (see `Surface`).
 */

export const CONTAINER = "frame w-full";

/** Desktop three-column grid: navigation | reading column | context rail. */
export const THREE_COL =
  "grid gap-x-12 gap-y-10 lg:grid-cols-[13rem_minmax(0,1fr)_20rem] xl:gap-x-14";
/** Two columns: reading column | rail. */
export const TWO_COL = "grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem] xl:gap-x-14";

export function PageContainer({
  className,
  children,
  narrow = false,
}: {
  className?: string;
  children: React.ReactNode;
  /** Reading-width page (about 44rem). */
  narrow?: boolean;
}) {
  return <div className={cn(CONTAINER, "pt-8 sm:pt-10", narrow && "max-w-[56rem]", className)}>{children}</div>;
}

/** The context line above a title: what kind of thing this is, in a sentence fragment. */
export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("font-sans text-ui text-ink-2", className)}>{children}</p>;
}

export function PageTitle({ children, className, size = "lg" }: { children: React.ReactNode; className?: string; size?: "lg" | "md" }) {
  return (
    <h1
      className={cn(
        "text-ink [font-variation-settings:'opsz'_72]",
        size === "lg" ? "text-3xl sm:text-4xl" : "text-2xl leading-tight sm:text-[2.125rem] sm:leading-[1.15]",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function Lede({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-3 max-w-[62ch] text-lg leading-relaxed text-ink-2", className)}>{children}</p>;
}

/** The one-line description under a utility page's title (review, audit, insights, search): sans, not a serif lede. */
export function Description({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("mt-2 max-w-[64ch] font-sans text-note text-ink-2", className)}>{children}</p>;
}

/** Section heading: a noun, serif, with optional count or aside on the right. */
export function SectionHeading({
  children,
  aside,
  id,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1", className)}>
      <h2 id={id} className="scroll-mt-24 text-xl text-ink">
        {children}
      </h2>
      {aside && <span className="font-sans text-sm text-ink-3 tnum">{aside}</span>}
    </div>
  );
}

/** The reading surface: the only paper-coloured panel on a page. */
export function Surface({ children, className, as: Tag = "article" }: { children: React.ReactNode; className?: string; as?: "article" | "section" | "div" }) {
  return <Tag className={cn("min-w-0 rounded-md border border-rule bg-paper px-5 py-7 sm:px-10 sm:py-9", className)}>{children}</Tag>;
}

/** A small rail block: heading in sans, then content. */
export function RailBlock({
  title,
  children,
  className,
  action,
  id,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn("border-t border-rule pt-3 font-sans", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans text-ui font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-2 text-note text-ink-2">{children}</div>
    </section>
  );
}

/** Empty states give a next step, in the interface's voice (a small EmptyState, docs/visual.md §4). */
export function Empty({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <EmptyState size="sm" title={children} className={cn("items-start text-left", className)} />
  );
}

/** Inline link in reading or UI text: tinted underline, indigo on hover. */
export const LINK =
  "text-indigo underline decoration-indigo-tint decoration-[1.5px] underline-offset-3 hover:decoration-indigo";
