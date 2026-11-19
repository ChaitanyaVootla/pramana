"use client";

import { LogIn, LogOut } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Account as AccountState } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** The sign-in link for this page: Google, then back here. */
export function useSignInHref(): string {
  const pathname = usePathname();
  const search = useSearchParams()?.toString();
  const here = search ? `${pathname}?${search}` : pathname;
  return `/api/auth/google?next=${encodeURIComponent(here || "/")}`;
}

/**
 * Who is reading, on a hosted site: "Sign in" for a guest, else their initial,
 * which opens their name and Sign out. Nothing at all on a local install.
 */
export function Account({ account, className }: { account: AccountState; className?: string }) {
  const signIn = useSignInHref();
  if (account.mode === "local") return null;
  if (account.mode === "guest") {
    return (
      <a
        href={signIn}
        className={cn(
          "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 font-sans text-ui text-slab no-underline transition-colors hover:bg-white/90",
          className,
        )}
      >
        <LogIn className="size-4" strokeWidth={2} aria-hidden />
        Sign in
      </a>
    );
  }
  const initial = account.name.trim().charAt(0).toUpperCase() || "?";
  return (
    <Popover>
      <PopoverTrigger
        aria-label={`Signed in as ${account.name}`}
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white font-display text-[1.05rem] leading-none text-slab transition-colors hover:bg-white/90",
          className,
        )}
      >
        {initial}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-64 gap-3 p-4 font-sans text-ui text-ink"
      >
        <div>
          <p className="font-heading text-lg leading-tight">{account.name}</p>
          <p className="mt-1 text-sm text-ink-3">
            {account.owner
              ? "You edit this site: proposals wait for you."
              : "Your notes, cards and canvases are kept for you alone."}
          </p>
        </div>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rule px-3 text-ui text-ink-2 transition-colors hover:bg-rule-soft hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** For a guest on a page that keeps things: what signing in gives them. */
export function SignInPrompt({ title, children }: { title: string; children?: React.ReactNode }) {
  const signIn = useSignInHref();
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:py-28">
      <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-[46ch] font-serif text-lg text-ink-2">
        {children ??
          "Sign in with Google to keep your own notes, review cards and canvases. Reading needs no account."}
      </p>
      <a
        href={signIn}
        className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-indigo px-5 font-sans text-ui text-paper no-underline transition-colors hover:bg-indigo/90"
      >
        <LogIn className="size-4" aria-hidden />
        Sign in with Google
      </a>
    </div>
  );
}
