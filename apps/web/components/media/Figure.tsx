"use client";

import { isImagining } from "@pramana/core";
import type { MediaCard } from "@pramana/services";
import { Expand } from "lucide-react";
import { useState } from "react";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import { CommonsImage, ImaginingTag } from "./image";
import { mediaKindLine } from "./credit";
import { MediaCredit, MediaDialog } from "./MediaDialog";

/** Tallest a figure is drawn in the reading column; portrait images get narrower instead of taller. */
const MAX_H = { inline: "min(72vh, 34rem)", wide: "min(78vh, 42rem)" };

/**
 * An image in the reading column: the picture (space reserved at its aspect
 * ratio, loaded lazily), a caption in Markdown (claim links open the
 * evidence), and the credit line linking to the file on Commons. Imaginings
 * carry a "Not a likeness" tag and their note. Click to enlarge.
 */
export function Figure({
  media,
  caption,
  size = "inline",
  id,
  className,
}: {
  media: MediaCard;
  /** Markdown; falls back to the media title. */
  caption?: string;
  /** "wide" uses the whole column (and a little more on large screens). */
  size?: "inline" | "wide";
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ratio = media.width / media.height;
  return (
    <figure id={id} className={cn("scroll-mt-24", size === "wide" && "xl:-mx-6", className)}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative mx-auto block cursor-zoom-in overflow-hidden rounded-md bg-field ring-1 ring-rule transition-[box-shadow] outline-none hover:ring-ink-3/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
        style={{ width: `min(100%, calc(${MAX_H[size]} * ${ratio}))` }}
      >
        {/* The button's name comes from its content (this, the image's alt text, any tag), so it matches what is seen. */}
        <span className="sr-only">Enlarge picture: </span>
        <CommonsImage
          file={media}
          sizes={size === "wide" ? "(min-width: 1280px) 52rem, (min-width: 1024px) 60vw, 100vw" : "(min-width: 1024px) 44rem, 100vw"}
        />
        <ImaginingTag representation={media.representation} className="absolute top-2.5 left-2.5" />
        <span
          className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-md bg-paper/90 text-ink-2 opacity-0 ring-1 ring-rule backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          <Expand className="size-4" />
        </span>
      </button>
      <figcaption className="mx-auto mt-2.5 max-w-[var(--measure)] font-sans text-sm text-ink-2">
        <p className="leading-snug text-ink-3">{mediaKindLine(media)}</p>
        <Markdown className="mt-0.5 space-y-1.5 leading-snug">{caption ?? media.title}</Markdown>
        {isImagining(media.representation) && media.representationNote && (
          <p className="mt-1.5 text-sm text-turmeric-ink">{media.representationNote}</p>
        )}
        <p className="mt-1.5 text-xs text-ink-3">
          <MediaCredit media={media} />
          <AddToCanvas content={{ kind: "media", mediaId: media.id }} what={media.title} icon size="xs" className="ml-1 align-middle" />
        </p>
      </figcaption>
      <MediaDialog items={[{ media, caption }]} index={0} open={open} onOpenChange={setOpen} />
    </figure>
  );
}
