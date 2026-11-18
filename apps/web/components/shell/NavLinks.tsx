"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const SECTIONS = [
  { href: "/", label: "Ages", match: (p: string) => p === "/" || p.startsWith("/p/") },
  { href: "/timeline", label: "Timeline", match: (p: string) => p.startsWith("/timeline") },
  { href: "/people", label: "People", match: (p: string) => p.startsWith("/people") },
  { href: "/places", label: "Places", match: (p: string) => p.startsWith("/places") },
  { href: "/learn", label: "Learn", match: (p: string) => p.startsWith("/learn") },
  { href: "/canvas", label: "Canvas", match: (p: string) => p.startsWith("/canvas") },
];

/** Main sections, from 768px up. The current one is ink with a short rule under it. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-0.5 font-sans text-ui md:flex">
      {SECTIONS.map((l) => {
        const active = l.match(pathname);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-8 items-center rounded-md px-2.5 no-underline transition-colors hover:bg-rule-soft hover:text-ink",
              "after:absolute after:inset-x-2.5 after:-bottom-[calc((var(--topbar-h)-2rem)/2)] after:h-0.5 after:bg-indigo after:opacity-0 after:transition-opacity",
              active ? "font-medium text-ink after:opacity-100" : "text-ink-2",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
