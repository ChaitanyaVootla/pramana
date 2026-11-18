"use client";

import type { MediaCard } from "@pramana/services";
import { Expand } from "lucide-react";
import { useState } from "react";
import {
  CommonsImage,
  ImaginingTag,
  MediaCredit,
  MediaDialog,
  mediaKindLine,
} from "@/components/media";
import { cn } from "@/lib/utils";

/**
 * The era page's lead image, set beside the lede: a crop kept around the
 * picture's focus point, then what it is and whose it is, in plain words
 * under it (never truncated over the picture). Imaginings keep their tag.
 * Click to see the whole picture and its full credit.
 */
export function LeadImage({ media, className }: { media: MediaCard; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <figure className={cn("min-w-0", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge: ${media.title}`}
        className="group relative block aspect-[3/2] w-full cursor-zoom-in overflow-hidden rounded-md bg-field ring-1 ring-rule outline-none focus-visible:ring-2 focus-visible:ring-indigo sm:aspect-[21/9] xl:aspect-[4/3]"
      >
        <CommonsImage
          file={media}
          fill
          eager
          sizes="(min-width: 1280px) 26rem, (min-width: 1024px) 60vw, 100vw"
          className="transition-transform duration-700 ease-out group-hover:scale-[1.015] motion-reduce:transition-none"
        />
        <ImaginingTag representation={media.representation} className="absolute top-3 left-3" />
        <span
          className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-paper/85 text-ink-2 opacity-0 shadow-card backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <Expand className="size-4" />
        </span>
      </button>
      <figcaption className="mt-2.5 font-sans">
        <span className="block text-note leading-snug text-ink">{media.title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-3">
          {mediaKindLine(media)}. <MediaCredit media={media} />
        </span>
      </figcaption>
      <MediaDialog items={[{ media }]} index={0} open={open} onOpenChange={setOpen} />
    </figure>
  );
}
