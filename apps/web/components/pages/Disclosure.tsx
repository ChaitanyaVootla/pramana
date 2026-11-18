"use client";

import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * A collapsed section whose summary is a sentence ("Show the scanned page
 * around the match"), not "Details". Content is not rendered until opened.
 */
export function Disclosure({
  summary,
  aside,
  children,
  defaultOpen = false,
  className,
  triggerClassName,
  contentClassName,
}: {
  summary: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={className}>
      <CollapsibleTrigger
        className={cn(
          "group/disc flex w-full items-baseline gap-2 rounded-sm py-1 text-left font-sans text-ui text-ink-2 hover:text-ink",
          triggerClassName,
        )}
      >
        <ChevronRight
          className="size-3.5 shrink-0 translate-y-0.5 text-ink-3 transition-transform duration-150 group-data-[panel-open]/disc:rotate-90"
          aria-hidden
        />
        <span className="min-w-0 flex-1">{summary}</span>
        {aside && <span className="shrink-0 text-sm text-ink-3 tnum">{aside}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent className={cn("pt-3", contentClassName)}>{children}</CollapsibleContent>
    </Collapsible>
  );
}
