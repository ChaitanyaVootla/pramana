import Link from "next/link";
import { Frame } from "./Frame";
import { NavLinks } from "./NavLinks";
import { AiPresence } from "@/components/ai/AiPresence";
import type { Account as AccountState } from "@/lib/auth";
import { Account } from "./Account";
import { SearchCommand } from "./SearchCommand";

/**
 * The top bar (56px): the slab, indigo cloth with white type, in both themes
 * (docs/visual.md §4). Wordmark with its Brāhmī form, the library and the desk,
 * what is waiting for review, search, the study partner, appearance. Solid; no
 * blur. Compact on phones (the bottom bar carries the sections).
 */
export function TopBar({
  pending,
  themeSwitch,
  connected = false,
  account = { mode: "local" },
}: {
  pending: number;
  /** Who is reading, on a hosted site (sign-in link or their initial); nothing locally. */
  account?: AccountState;
  themeSwitch?: React.ReactNode;
  /** Whether an AI session is connected over MCP (see docs/visual.md §7). */
  connected?: boolean;
}) {
  return (
    <header data-chrome className="on-slab sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <a href="#main" className="visually-hidden focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-40 focus:rounded-md focus:bg-white focus:px-3 focus:py-1.5 focus:font-sans focus:text-ui focus:text-slab">
        Skip to content
      </a>
      <Frame className="flex h-[var(--topbar-h)] items-center gap-3 sm:gap-6">
        <Link href="/" className="flex shrink-0 items-baseline gap-2 no-underline" aria-label="Pramāṇa, home">
          <span className="font-display text-[1.625rem] leading-none text-ink">Pramāṇa</span>
          <span className="hidden font-brahmi text-[0.9rem] leading-none tracking-[0.04em] text-ink-3 sm:inline" lang="pra-Brah" aria-hidden>
            𑀧𑀭𑀫𑀸𑀡
          </span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-1.5">
          {/* The learner is also the only reviewer: a quiet link with a count, not a banner. */}
          {pending > 0 &&
            (account.mode === "local" || (account.mode === "signed-in" && account.owner)) && (
              <Link
                href="/review"
                className="hidden h-8 shrink-0 items-center gap-2 rounded-full px-3 font-sans text-ui text-ink-2 no-underline transition-colors hover:bg-rule-soft hover:text-ink xl:inline-flex"
                title={`${pending} ${pending === 1 ? "proposal" : "proposals"} waiting for you`}
              >
                <span className="size-2 rounded-full bg-turmeric" aria-hidden />
                <span>
                  <span className="tnum">{pending}</span> to review
                </span>
              </Link>
            )}
          <SearchCommand />
          {/* The study partner: opens its popover (on phones too). */}
          <AiPresence initialConnected={connected} />
          {themeSwitch}
          <Account account={account} className="ml-1" />
        </div>
      </Frame>
    </header>
  );
}
