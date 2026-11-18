"use client";

import type { EntityImage } from "@pramana/services";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { displayCredit } from "./credit";
import { CommonsImage } from "./image";
import { MediaDialog } from "./MediaDialog";

/**
 * A small picture beside an entity's name (hover cards, people lists). The
 * credit is in the tooltip; imaginings get a dashed turmeric outline so a
 * later painting is never mistaken for a portrait.
 *
 * Decorative thumbnails (inside a link, next to the name) are plain images.
 * Otherwise the thumbnail is a button that opens the picture viewer with the
 * full credit, like every other picture on the site.
 */
export function EntityThumb({
  image,
  size = 40,
  shape = "rounded",
  decorative = false,
  className,
}: {
  image: EntityImage;
  /** Edge length in px. */
  size?: number;
  shape?: "rounded" | "circle";
  /** Next to the entity's name, the picture adds nothing for a screen reader, and it must not be a second link. */
  decorative?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const imagining = image.representation === "later_imagining";
  const frame = cn(
    "relative inline-block shrink-0 overflow-hidden bg-chuna ring-1 ring-rule",
    shape === "circle" ? "rounded-full" : "rounded-md",
    imagining && "outline-2 outline-offset-1 outline-turmeric/80 outline-dashed",
    className,
  );
  const title = `${imagining ? "A later imagining, not a likeness. " : ""}${displayCredit(image)}`;
  const picture = (
    <CommonsImage file={image} fill max={size * 3 > 330 ? 500 : 330} sizes={`${size}px`} decorative={decorative} />
  );
  if (decorative)
    return (
      <span className={frame} style={{ width: size, height: size }} title={title}>
        {picture}
      </span>
    );
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(frame, "cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo focus-visible:outline-solid", !imagining && "outline-none")}
        style={{ width: size, height: size }}
        title={title}
      >
        <span className="sr-only">Enlarge picture: </span>
        {picture}
      </button>
      <MediaDialog items={[{ media: image }]} index={0} open={open} onOpenChange={setOpen} />
    </>
  );
}
