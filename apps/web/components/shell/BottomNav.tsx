"use client";

import { Clock, GraduationCap, Layers, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePresence } from "@/components/ai/usePresence";
import { cn } from "@/lib/utils";
import { openSearch } from "./SearchCommand";

const ITEMS = [
  { href: "/", label: "Ages", Icon: Layers, match: (p: string) => p === "/" || p.startsWith("/p/") },
  { href: "/timeline", label: "Timeline", Icon: Clock, match: (p: string) => p.startsWith("/timeline") },
  null, // search
  { href: "/places", label: "Places", Icon: MapPin, match: (p: string) => p.startsWith("/places") },
  { href: "/learn", label: "Learn", Icon: GraduationCap, match: (p: string) => p.startsWith("/learn") },
] as const;

/**
 * App-style navigation for small screens: fixed to the bottom, inside the
 * safe area, 44px targets, labels always shown. Hidden from 768px up, where
 * the top bar has the sections. `connected` draws the partner's dot on Search.
 */
export function BottomNav({ connected: initialConnected = false }: { connected?: boolean }) {
  const pathname = usePathname();
  // Live from the event stream once the tab has fetched it; the server's value until then.
  const presence = usePresence();
  const connected = presence ? presence.connected : initialConnected;
  const item =
    "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 font-sans text-[0.6875rem] font-medium no-underline transition-colors active:bg-rule-soft";
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-chuna pb-[var(--safe-bottom)] md:hidden"
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
      </div>
    </nav>
  );
}
