"use client";

import type { MediaCard } from "@pramana/services";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { displayCredit } from "./credit";
import { CommonsImage, ImaginingTag } from "./image";
import { MediaDialog } from "./MediaDialog";

/**
 * The page's lead image: a wide crop kept around the media's focus point,
 * with the credit over the bottom edge. Loaded at once (it is above the
 * fold); click to see the whole picture and its full credit.
 */
export function HeroImage({
  media,
  className,
  aspect = "aspect-[16/9] sm:aspect-[21/9]",
  sizes = "(min-width: 1024px) 66vw, 100vw",
}: {
  media: MediaCard;
  className?: string;
  /** Tailwind aspect classes for the crop. */
  aspect?: string;
  sizes?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <figure className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group relative block w-full cursor-zoom-in overflow-hidden rounded-md bg-chuna ring-1 ring-rule outline-none focus-visible:ring-2 focus-visible:ring-indigo",
          aspect,
        )}
      >
        <span className="sr-only">Enlarge picture: </span>
        <CommonsImage file={media} fill eager sizes={sizes} className="transition-transform duration-700 ease-out group-hover:scale-[1.015]" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
        <ImaginingTag representation={media.representation} className="absolute top-3 left-3" />
        <figcaption className="absolute right-3 bottom-2 left-3 flex items-end justify-between gap-3 text-left font-sans text-xs text-white/85">
          <span className="line-clamp-1 font-medium">{media.title}</span>
          <span className="line-clamp-1 shrink-0">{displayCredit(media)}</span>
        </figcaption>
      </button>
      <MediaDialog items={[{ media }]} index={0} open={open} onOpenChange={setOpen} />
    </figure>
  );
}
