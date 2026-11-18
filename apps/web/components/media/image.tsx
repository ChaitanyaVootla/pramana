"use client";

import { commonsSrcSet, commonsThumbUrl, isImagining, type MediaFocus, type Representation } from "@pramana/core";
import type { CSSProperties } from "react";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Images are plain <img> elements with a srcset of Wikimedia's own
 * thumbnails. Commons pre-renders and caches a fixed set of widths
 * (COMMONS_THUMB_WIDTHS) on its CDN and refuses others, so the browser picks
 * from those directly; next/image would turn this server into an image proxy
 * that re-encodes what Commons already serves, at widths of its own.
 */

export interface ImageFile {
  originalUrl: string;
  width: number;
  height: number;
  mime: string;
  alt: string;
  focus?: MediaFocus | null;
}

export function objectPosition(focus: MediaFocus | null | undefined): string | undefined {
  return focus ? `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%` : undefined;
}

/**
 * One responsive image. `fill` covers its (sized) parent, cropped around the
 * focus point; otherwise it keeps its own aspect ratio, so the space is
 * reserved before it loads and nothing below it jumps.
 */
export function CommonsImage({
  file,
  sizes,
  fill = false,
  eager = false,
  // 1280 covers a 640px-wide picture on a 2x screen; the 1920 thumb or the
  // original (several MB for a photograph) was rarely worth its weight.
  max = 1280,
  decorative = false,
  className,
  style,
}: {
  file: ImageFile;
  /** The `sizes` attribute: how wide the image is drawn at each breakpoint. */
  sizes: string;
  fill?: boolean;
  /** Load at once (the hero); everything else loads lazily. */
  eager?: boolean;
  /** Largest width worth offering. */
  max?: number;
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see the note above
    <img
      src={commonsThumbUrl(file, Math.min(960, max))}
      srcSet={commonsSrcSet(file, max) || undefined}
      // A lazy image is laid out before it loads, so the browser can pick by its real width
      // ("auto"; a tile in a narrow rail was fetching the original); the rest is the fallback.
      sizes={eager ? sizes : `auto, ${sizes}`}
      width={file.width}
      height={file.height}
      alt={decorative ? "" : file.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      className={cn(
        "block bg-rule-soft dark:brightness-[0.92]",
        fill ? "absolute inset-0 size-full object-cover" : "h-auto w-full",
        className,
      )}
      style={{ objectPosition: objectPosition(file.focus), ...style }}
    />
  );
}

/** The "Not a likeness" tag on imaginings: a contested tag (visual.md §4), never a pill. */
export function ImaginingTag({ representation, className }: { representation: Representation; className?: string }) {
  if (!isImagining(representation)) return null;
  return (
    <span className={cn(badgeVariants({ variant: "contested" }), "pointer-events-none ring-1 ring-turmeric/40", className)}>
      Not a likeness
    </span>
  );
}
