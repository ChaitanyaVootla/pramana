"use client";

import { TimeStrip } from "@/components/time/TimeStrip";
import { cn } from "@/lib/utils";

/** Scrolls to a block on the page, smoothly unless the reader prefers less motion, and keeps the link in the address bar. */
/**
 * Keeps an element at the top of the view while the page above it settles
 * (folded parts measuring themselves, fonts, images, maps): scrolls now, then
 * again whenever the page's height changes, for up to 1.5 seconds or until the
 * reader scrolls themselves.
 */
export function scrollWhenSettled(
  el: Element,
  opts: { smooth?: boolean; block?: ScrollLogicalPosition } = {},
) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const block = opts.block ?? "start";
  el.scrollIntoView({ behavior: opts.smooth && !reduce ? "smooth" : "auto", block });
  let done = false;
  const stop = () => {
    done = true;
    ro.disconnect();
    window.removeEventListener("wheel", stop);
    window.removeEventListener("touchstart", stop);
    window.removeEventListener("keydown", stop);
  };
  const ro = new ResizeObserver(() => {
    if (!done) el.scrollIntoView({ behavior: "auto", block });
  });
  ro.observe(document.body);
  window.addEventListener("wheel", stop, { passive: true, once: true });
  window.addEventListener("touchstart", stop, { passive: true, once: true });
  window.addEventListener("keydown", stop, { once: true });
  window.setTimeout(stop, 1500);
}

/**
 * Scrolls to a block on the page, smoothly unless the reader prefers less
 * motion, and keeps the link in the address bar. A folded part holding the
 * target is opened first (the page listens for "pramana:reveal").
 */
export function jumpTo(id: string, e?: React.MouseEvent) {
  const el = document.getElementById(id);
  if (!el || e?.metaKey || e?.ctrlKey || e?.shiftKey) return;
  e?.preventDefault();
  window.dispatchEvent(new CustomEvent("pramana:reveal", { detail: id }));
  requestAnimationFrame(() => scrollWhenSettled(el, { smooth: true }));
  history.replaceState(null, "", `#${id}`);
}

export interface OutlineItem {
  id: string;
  title: string;
  /** One line: what this part will tell you. */
  promise: string | null;
  /** "c. 261 BCE", or "throughout" / "afterwards" for undated parts. */
  whenLabel: string;
  /** Where the part sits in the period: a year, a span, or the whole period. */
  mark: number | [number, number] | null;
  approximate: boolean;
  /** The part is about how we know, after the period. */
  later: boolean;
  /** The learner's progress through the part (read, guessed, checked, remembered). */
  seal?: React.ReactNode;
}

/**
 * The story in N parts, as the chapter list beside the reading: each part's
 * number, title, date and a small strip placing it in the period. The part
 * being read is marked and opens to show its one-line promise; the marker
 * moves with the reader and nothing else on the page redraws.
 */
export function Outline({
  items,
  active,
  within,
  footer,
  dense = false,
  onNavigate,
}: {
  items: OutlineItem[];
  active: string | null;
  within: [number, number] | null;
  footer?: React.ReactNode;
  /** Inside a popover: no heading, larger touch targets. */
  dense?: boolean;
  onNavigate?: (id: string) => void;
}) {
  return (
    <nav aria-label="Chapters" className="font-sans">
      {!dense && (
        <p className="mb-2.5 pl-3 text-xs font-medium text-ink-3">
          The story in {items.length} parts
        </p>
      )}
      <ol className="relative">
        {items.map((item, i) => {
          const on = item.id === active;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  jumpTo(item.id, e);
                  onNavigate?.(item.id);
                }}
                aria-current={on ? "location" : undefined}
                aria-describedby={
                  item.promise ? `outline-promise-${dense ? "p" : "s"}-${item.id}` : undefined
                }
                className={cn(
                  "group relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-1.5 rounded-md py-2 pr-2 pl-3 no-underline transition-colors duration-200",
                  "before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[2px] before:rounded-full before:transition-colors before:duration-200",
                  on ? "bg-indigo-wash/70 before:bg-indigo" : "before:bg-rule hover:bg-rule-soft",
                  dense && "py-2.5",
                )}
              >
                <span
                  className={cn(
                    "pt-px text-xs tnum transition-colors duration-200",
                    on ? "font-medium text-indigo" : "text-ink-3",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-ui leading-snug transition-colors duration-200",
                      on ? "font-medium text-ink" : "text-ink-2 group-hover:text-ink",
                    )}
                  >
                    {item.title}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3 tnum">
                    {within && <Strip item={item} within={within} />}
                    <span>{item.whenLabel}</span>
                    {item.seal && <span className="ml-auto shrink-0">{item.seal}</span>}
                  </span>
                  {item.promise && (
                    <span
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-200 ease-[var(--ease-out-quart)]",
                        on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                      aria-hidden
                    >
                      <span className="overflow-hidden">
                        <span
                          id={`outline-promise-${dense ? "p" : "s"}-${item.id}`}
                          className="block pt-1.5 text-sm leading-snug text-ink-2"
                        >
                          {item.promise}
                        </span>
                      </span>
                    </span>
                  )}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
      {footer && <div className="mt-4 pl-0.5">{footer}</div>}
    </nav>
  );
}

function Strip({ item, within }: { item: OutlineItem; within: [number, number] }) {
  // Parts about how we know sit after the period: the strip shows an arrow off its right end.
  const mark = item.later ? within[1] + 10 : (item.mark ?? within);
  return (
    <TimeStrip within={within} mark={mark} approximate={item.approximate} width={44} height={5} />
  );
}
