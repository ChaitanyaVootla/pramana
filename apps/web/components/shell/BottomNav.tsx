"use client";

import { GraduationCap, Layers, MapPin, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePresence } from "@/components/ai/usePresence";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { DESK, LIBRARY, RECORD } from "./NavLinks";
import { openSearch } from "./SearchCommand";

const ITEMS = [
  { href: "/", label: "Ages", Icon: Layers, match: (p: string) => p === "/" || p.startsWith("/p/") },
  { href: "/places", label: "Places", Icon: MapPin, match: (p: string) => p.startsWith("/places") },
  null, // search
  { href: "/learn", label: "Learn", Icon: GraduationCap, match: (p: string) => p.startsWith("/learn") },
] as const;

/** Everything the bar itself does not carry, in the More sheet. */
const MORE = [
  { title: "The library", items: LIBRARY.filter((s) => s.href === "/timeline" || s.href === "/people") },
  { title: "Your desk", items: [...DESK.filter((s) => s.href !== "/learn"), ...RECORD.filter((s) => s.href === "/insights")] },
  { title: "The record", items: RECORD.filter((s) => s.href !== "/insights") },
];

/**
 * App-style navigation for small screens: fixed to the bottom, inside the
 * safe area, 44px targets, labels always shown. Hidden from 768px up, where
 * the top bar has the sections. Four places and More, a sheet with every other
 * section, so nothing a desktop reaches is out of reach on a phone.
 * `connected` draws the partner's dot on Search.
 */
export function BottomNav({ connected: initialConnected = false }: { connected?: boolean }) {
  const pathname = usePathname();
  // Live from the event stream once the tab has fetched it; the server's value until then.
  const presence = usePresence();
  const connected = presence ? presence.connected : initialConnected;
  const [more, setMore] = useState(false);
  // Following a link in the sheet closes it.
  useEffect(() => setMore(false), [pathname]);
  const inMore = MORE.some((g) => g.items.some((s) => s.match(pathname)));
  const item =
    "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 font-sans text-[0.75rem] leading-none font-medium no-underline transition-colors active:bg-rule-soft";
  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper pb-[var(--safe-bottom)] md:hidden"
      >
        <div className="mx-auto flex h-[var(--bottomnav-h)] max-w-lg items-stretch gap-0.5 px-2">
          {ITEMS.map((it) => {
            if (!it)
              return (
                <button key="search" type="button" onClick={openSearch} className={cn(item, "text-ink-2")}>
                  <Search className="size-5" strokeWidth={1.75} aria-hidden />
                  Search
                  {connected && (
                    <span
                      className="absolute top-1.5 right-[calc(50%-0.9rem)] size-1.5 rounded-full bg-indigo"
                      title="Your AI is connected"
                      aria-hidden
                    />
                  )}
                </button>
              );
            const on = it.match(pathname);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={cn(item, on ? "text-indigo" : "text-ink-2")}
              >
                <it.Icon className="size-5" strokeWidth={on ? 2.25 : 1.75} aria-hidden />
                {it.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-haspopup="dialog"
            aria-expanded={more}
            className={cn(item, inMore ? "text-indigo" : "text-ink-2")}
          >
            <Menu className="size-5" strokeWidth={inMore ? 2.25 : 1.75} aria-hidden />
            More
          </button>
        </div>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-lg pb-[calc(var(--safe-bottom)+0.75rem)] font-sans md:hidden"
        >
          <SheetHeader className="pb-1">
            <SheetTitle className="text-xl">Everything else</SheetTitle>
            <SheetDescription className="sr-only">The other sections of Pramāṇa</SheetDescription>
          </SheetHeader>
          {MORE.map((g) => (
            <section key={g.title} className="px-4 pt-3">
              <h3 className="font-sans text-sm text-ink-3">{g.title}</h3>
              <ul className="mt-1">
                {g.items.map((s) => {
                  const on = s.match(pathname);
                  return (
                    <li key={s.href} className="border-b border-rule last:border-b-0">
                      <Link
                        href={s.href}
                        aria-current={on ? "page" : undefined}
                        className="flex min-h-12 items-baseline justify-between gap-4 py-3 no-underline"
                      >
                        <span className={cn("text-note font-medium", on ? "text-indigo" : "text-ink")}>{s.label}</span>
                        <span className="text-right text-sm text-ink-3">{s.hint}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </SheetContent>
      </Sheet>
    </>
  );
}
