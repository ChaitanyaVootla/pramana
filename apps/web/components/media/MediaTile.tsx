"use client";

import { isImagining } from "@pramana/core";
import { Expand } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import { mediaKindLine } from "./credit";
import { CommonsImage, ImaginingTag } from "./image";
import { MediaCredit, MediaDialog, type ViewerMedia } from "./MediaDialog";

/** Maps, copies and pictures far from the tile's shape are shown whole rather than cropped. */
function wantsWhole(m: ViewerMedia): boolean {
  const ratio = m.width / m.height;
  return ["historical_map", "modern_map", "diagram", "copy_of_object"].includes(m.representation) || ratio > 1.9 || ratio < 0.55;
}

/**
 * A picture as a free-standing item (a canvas card, a rail, a grid cell). It
 * fills the box it is given and adapts to that box, not to the window:
 * - under about 12rem wide: the picture alone, credit in the tooltip, the
 *   "Not a likeness" tag reduced to a dot;
 * - from 12rem: a one-line title and the credit under it;
 * - from 22rem: the caption (Markdown, claim links work), the kind and date
 *   line, and the credit.
 * The crop keeps the picture's focus point; "auto" shows maps, copies and
 * very wide or tall pictures whole. Click or Enter opens the viewer (zoom,
 * full credit and licence).
 */
export function MediaTile({
  media: base,
  title,
  caption,
  fit = "auto",
  interactive = true,
  className,
}: {
  media: ViewerMedia;
  /**
   * Click/Enter opens the viewer. Turn off where the tile is being dragged or
   * resized (a canvas in edit mode); the credit link still works.
   */
  interactive?: boolean;
  /** Overrides the media's own title (a canvas item's label). */
  title?: string;
  /** Markdown; falls back to the media title at medium sizes. */
  caption?: string;
  fit?: "cover" | "contain" | "auto";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const media = title ? { ...base, title } : base;
  const whole = fit === "contain" || (fit === "auto" && wantsWhole(media));
  const imagining = isImagining(media.representation);
  return (
    <figure className={cn("@container flex h-full min-h-0 w-full min-w-0 flex-col", className)}>
      <Frame
        interactive={interactive}
        onOpen={() => setOpen(true)}
        title={`${imagining ? "A later imagining, not a likeness. " : ""}${media.attribution}`}
      >
        <CommonsImage
          file={media}
          fill
          max={1280}
          sizes="(min-width: 1024px) 40vw, 90vw"
          className={whole ? "bg-paper object-contain p-1" : undefined}
        />
        {imagining && (
          <>
            <ImaginingTag representation={media.representation} className="absolute top-2 left-2 hidden @[12rem]:inline-flex" />
            <span className="absolute top-1.5 left-1.5 size-2.5 rounded-sm bg-turmeric ring-2 ring-paper @[12rem]:hidden" aria-hidden />
          </>
        )}
        <span
          className="absolute right-2 bottom-2 hidden size-7 place-items-center rounded-md bg-paper/90 text-ink-2 opacity-0 ring-1 ring-rule backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 @[12rem]:grid"
          aria-hidden
        >
          <Expand className="size-3.5" />
        </span>
      </Frame>
      <figcaption className="hidden shrink-0 pt-2 font-sans @[12rem]:block">
        <span className="block truncate text-sm leading-snug text-ink @[22rem]:hidden">{media.title}</span>
        <span className="hidden text-sm leading-snug text-ink-3 @[22rem]:block">{mediaKindLine(media)}</span>
        {caption ? (
          <Markdown className="mt-0.5 hidden space-y-1 text-sm leading-snug text-ink-2 @[22rem]:block">{caption}</Markdown>
        ) : (
          <span className="mt-0.5 hidden text-sm leading-snug text-ink-2 @[22rem]:block">{media.title}</span>
        )}
        <span className="mt-0.5 block text-xs leading-snug text-ink-3">
          <MediaCredit media={media} />
        </span>
      </figcaption>
      {interactive && <MediaDialog items={[{ media, caption }]} index={0} open={open} onOpenChange={setOpen} />}
    </figure>
  );
}

const FRAME = "group relative min-h-16 w-full flex-1 overflow-hidden rounded-md bg-field ring-1 ring-rule";

/** A button that opens the viewer, or, when the tile is not interactive, a plain box. */
function Frame({
  interactive,
  onOpen,
  title,
  children,
}: {
  interactive: boolean;
  onOpen: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!interactive)
    return (
      <div className={FRAME} title={title}>
        {children}
      </div>
    );
  return (
    <button
      type="button"
      onClick={onOpen}
      title={title}
      className={`${FRAME} cursor-zoom-in outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo`}
    >
      <span className="sr-only">Enlarge picture: </span>
      {children}
    </button>
  );
}
