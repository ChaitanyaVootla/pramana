"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type Section = { href: string; label: string; match: (p: string) => boolean; hint: string };

/**
 * The library: four ways into the same history (by age, by year, by place, by person).
 * See docs/visual.md §3 for the site map.
 */
export const LIBRARY: Section[] = [
  { href: "/", label: "Ages", match: (p) => p === "/" || p.startsWith("/p/"), hint: "Every age, in order" },
  { href: "/timeline", label: "Timeline", match: (p) => p.startsWith("/timeline"), hint: "Everything by year" },
  { href: "/places", label: "Places", match: (p) => p.startsWith("/places"), hint: "The map, and every place" },
  { href: "/people", label: "People", match: (p) => p.startsWith("/people"), hint: "Who was who" },
];

/** The desk: what the learner does with it. */
export const DESK: Section[] = [
  { href: "/learn", label: "Learn", match: (p) => p.startsWith("/learn"), hint: "Today’s session and your cards" },
  { href: "/canvas", label: "Canvas", match: (p) => p.startsWith("/canvas"), hint: "Lay things side by side" },
  { href: "/notes", label: "Notes", match: (p) => p.startsWith("/notes"), hint: "What your AI left for you" },
];

/** The record: how the content came to be, and who changed it. */
export const RECORD: Section[] = [
  { href: "/review", label: "Proposed changes", match: (p) => p.startsWith("/review"), hint: "Waiting for a decision" },
  { href: "/audit", label: "History of changes", match: (p) => p.startsWith("/audit"), hint: "Every change, by whom" },
  { href: "/insights", label: "Insights", match: (p) => p.startsWith("/insights"), hint: "How the learning is going" },
  { href: "/connect", label: "Connect your AI", match: (p) => p.startsWith("/connect"), hint: "Claude and other apps" },
];

export const SECTIONS = [...LIBRARY, ...DESK];

function Item({ s, active, className }: { s: Section; active: boolean; className?: string }) {
  return (
    <Link
      href={s.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 items-center rounded-full px-3 no-underline transition-colors hover:bg-rule-soft hover:text-ink",
        active ? "bg-indigo-wash font-medium text-ink" : "text-ink-2",
        className,
      )}
    >
      {s.label}
    </Link>
  );
}

/**
 * Main sections in the top bar, from 768px up: the library, a hairline, then the
 * desk. The current one is a filled pill. Canvas and Notes join from 1024px; on
 * smaller screens they are under More in the bottom bar.
 */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-0.5 font-sans text-note md:flex">
      {LIBRARY.map((s) => (
        <Item key={s.href} s={s} active={s.match(pathname)} />
      ))}
      <span className="mx-2 h-4 w-px bg-rule" aria-hidden />
      {DESK.map((s, i) => (
        <Item key={s.href} s={s} active={s.match(pathname)} className={i > 0 ? "hidden lg:flex" : undefined} />
      ))}
    </nav>
  );
}
