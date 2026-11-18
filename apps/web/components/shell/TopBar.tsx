import Link from "next/link";
import { Frame } from "./Frame";
import { NavLinks } from "./NavLinks";
import { AiPresence } from "@/components/ai/AiPresence";
import { SearchCommand } from "./SearchCommand";

/**
 * The top bar (48px): wordmark with its Brāhmī form, main sections, the review
 * dot, search, the study partner's presence, appearance. Solid ground with one
 * rule; no blur. Compact on phones (the bottom bar carries the sections).
 */
export function TopBar({
  pending,
  themeSwitch,
  connected = false,
}: {
  pending: number;
  themeSwitch?: React.ReactNode;
  /** Whether an AI session is connected over MCP (see docs/visual.md §7). */
  connected?: boolean;
}) {
  return (
    <header data-chrome className="sticky top-0 z-30 border-b border-rule bg-chuna pt-[env(safe-area-inset-top)]">
      <a href="#main" className="visually-hidden focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-md focus:bg-paper focus:px-3 focus:py-1.5 focus:font-sans focus:text-ui">
        Skip to content
      </a>
      <Frame className="flex h-[var(--topbar-h)] items-center gap-3 sm:gap-5">
        <Link href="/" className="flex shrink-0 items-baseline gap-2 no-underline" aria-label="Pramāṇa, home">
          <span className="font-serif text-[1.25rem] leading-none tracking-[-0.01em] text-ink">Pramāṇa</span>
          <span className="hidden font-brahmi text-[0.85rem] leading-none tracking-[0.04em] text-indigo sm:inline" lang="pra-Brah" aria-hidden>
            𑀧𑀭𑀫𑀸𑀡
          </span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {/* The learner is also the only reviewer: a quiet link with a dot, not a banner. */}
          {pending > 0 && (
            <Link
              href="/review"
              className="hidden h-8 shrink-0 items-center gap-1.5 rounded-md px-2 font-sans text-ui text-ink-2 no-underline transition-colors hover:bg-rule-soft hover:text-ink lg:inline-flex"
              title={`${pending} ${pending === 1 ? "proposal" : "proposals"} waiting for you`}
            >
              <span className="size-1.5 rounded-full bg-turmeric" aria-hidden />
              Proposed changes
              <span className="sr-only">
                : {pending} {pending === 1 ? "proposal" : "proposals"} waiting
              </span>
            </Link>
          )}
          <SearchCommand />
          {/* The study partner: opens its popover (on phones too). */}
          <AiPresence initialConnected={connected} />
          {themeSwitch}
        </div>
      </Frame>
    </header>
  );
}
