"use client";

import { Expand } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { MediaDialog, type ViewerMedia } from "./MediaDialog";

/**
 * A small "enlarge" button to lay over a picture that is itself part of a
 * link (a page card, a search result), so the picture viewer is still one
 * click away without nesting a button in the link. Place it as a sibling of
 * the link, absolutely positioned over the picture.
 */
export function ZoomButton({ media, className }: { media: ViewerMedia; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "grid size-8 cursor-zoom-in place-items-center rounded-md bg-paper/90 text-ink-2 ring-1 ring-rule backdrop-blur outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo",
          className,
        )}
      >
        <Expand className="size-4" aria-hidden />
        <span className="sr-only">Enlarge picture: {media.title}</span>
      </button>
      <MediaDialog items={[{ media }]} index={0} open={open} onOpenChange={setOpen} />
    </>
  );
}
