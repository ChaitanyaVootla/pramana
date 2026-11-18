"use client";

import type { MediaCard } from "@pramana/services";
import { useState } from "react";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import { CommonsImage, ImaginingTag } from "./image";
import { mediaKindLine } from "./credit";
import { MediaCredit, MediaDialog } from "./MediaDialog";

const WHOLE = new Set(["historical_map", "modern_map", "diagram", "copy_of_object"]);

/**
 * Tiles are 4:3. Maps and copies are read, not glanced at, and pictures far
 * from that shape (a coin's two faces side by side, a tall pillar) would lose
 * what matters to the crop, so these are shown whole.
 */
function showWhole(m: MediaCard): boolean {
  const ratio = m.width / m.height;
  return WHOLE.has(m.representation) || ratio > 1.75 || ratio < 0.6;
}

export interface GalleryItem {
  media: MediaCard;
  /** Markdown; falls back to the media title. */
  caption?: string;
}

/**
 * Related pictures side by side: a swipeable strip that snaps on phones, a
 * grid on larger screens. Tiles share one shape (cropped around each image's
 * focus point); the enlarged view shows the whole picture and steps through
 * the set with the arrow keys.
 */
export function Gallery({
  items,
  title,
  label,
  id,
  className,
}: {
  items: GalleryItem[];
  title?: string;
  /** Names the gallery for screen readers when it has no title, e.g. the chapter: "Pictures: The war in Kalinga". */
  label?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  if (!items.length) return null;
  const cols = items.length === 2 || items.length === 4 ? "md:grid-cols-2" : "md:grid-cols-3";
  return (
    <section id={id} className={cn("scroll-mt-24", className)} aria-label={title ? `Pictures: ${title}` : label ? `Pictures: ${label}` : undefined}>
      {title && <h4 className="mb-2 font-sans text-sm font-semibold text-ink-2">{title}</h4>}
      <ul
        className={cn(
          "-mx-[var(--gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-[var(--gutter)] px-[var(--gutter)] pb-2 [scrollbar-width:thin]",
          "md:mx-0 md:grid md:snap-none md:overflow-visible md:px-0 md:pb-0",
          cols,
        )}
      >
        {items.map((item, i) => (
          <li key={`${item.media.id}-${i}`} className="w-[78%] max-w-80 shrink-0 snap-start md:w-auto md:max-w-none">
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden rounded-md bg-field ring-1 ring-rule transition-[box-shadow] outline-none hover:ring-ink-3/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo"
            >
              <span className="sr-only">Enlarge picture: </span>
              <CommonsImage
                file={item.media}
                fill
                max={960}
                sizes="(min-width: 768px) 18rem, 78vw"
                // Maps and copies of inscriptions are read, not glanced at: show them whole.
                className={showWhole(item.media) ? "bg-paper object-contain p-1.5" : undefined}
              />
              <ImaginingTag representation={item.media.representation} className="absolute top-2 left-2" />
            </button>
            <div className="mt-2 font-sans text-sm text-ink-2">
              <p className="leading-snug text-ink-3">{mediaKindLine(item.media)}</p>
              <Markdown className="mt-0.5 space-y-1 leading-snug">{item.caption ?? item.media.title}</Markdown>
              <p className="mt-1 text-xs text-ink-3">
                <MediaCredit media={item.media} />
                <AddToCanvas content={{ kind: "media", mediaId: item.media.id }} what={item.media.title} icon size="xs" className="ml-1 align-middle" />
              </p>
            </div>
          </li>
        ))}
      </ul>
      <MediaDialog items={items} index={index} onIndex={setIndex} open={open} onOpenChange={setOpen} />
    </section>
  );
}
