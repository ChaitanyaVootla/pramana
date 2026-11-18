"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * One source's long form on the claim page, folded under a one-line heading:
 * the chain overview above already summarises it. It opens when it is the one
 * selected (its anchor in the URL, from the overview or the contents), or when
 * the reader opens it; `defaultOpen` for a claim with a single source.
 */
export function SourceFold({
  anchor,
  label,
  aside,
  defaultOpen = false,
  className,
  children,
}: {
  anchor: string;
  label: React.ReactNode;
  aside?: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const follow = (scroll: boolean) => {
      const selected = window.location.hash === `#${anchor}`;
      if (selected) {
        setOpen(true);
        if (scroll) requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start" }));
      } else if (window.location.hash.startsWith("#source-")) setOpen(false);
    };
    follow(true);
    const onHash = () => follow(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [anchor]);
  return (
    <section ref={ref} id={anchor} className={cn("scroll-mt-24", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="group/src flex w-full items-baseline gap-2 rounded-sm py-1 text-left font-sans text-ui text-ink-2 hover:text-ink">
          <ChevronRight
            className="size-3.5 shrink-0 translate-y-0.5 text-ink-3 transition-transform duration-150 group-data-[panel-open]/src:rotate-90"
            aria-hidden
          />
          <span className="min-w-0 flex-1">{label}</span>
          {aside && <span className="shrink-0 text-sm text-ink-3">{aside}</span>}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">{children}</CollapsibleContent>
      </Collapsible>
    </section>
  );
}
