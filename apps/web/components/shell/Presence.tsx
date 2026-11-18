"use client";

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The study partner's presence (docs/visual.md §7): two concentric rings in
 * ink. Connected, the inner ring is filled indigo; not connected, both rings
 * are dotted. It links to /connect and says what it is on hover and focus.
 * No colour of its own, no bubble.
 */
export function PresenceGlyph({ connected, className }: { connected: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", className)} aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeDasharray={connected ? undefined : "1.6 1.8"}
      />
      {connected ? (
        <circle cx="8" cy="8" r="3" fill="var(--indigo)" />
      ) : (
        <circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="1.2 1.6" />
      )}
    </svg>
  );
}

export function Presence({ connected, className }: { connected: boolean; className?: string }) {
  const label = connected ? "Your AI is connected" : "Connect your AI";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href="/connect"
            aria-label={label}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-2 no-underline transition-colors hover:bg-rule-soft hover:text-ink",
              className,
            )}
          />
        }
      >
        <PresenceGlyph connected={connected} />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label}
        {connected ? "" : ": connect an AI app, such as Claude"}
      </TooltipContent>
    </Tooltip>
  );
}
