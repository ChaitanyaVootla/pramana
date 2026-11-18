"use client";

import { commonsThumbUrl, isImagining } from "@pramana/core";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { MediaCard } from "@pramana/services";
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { copyableCredit, displayCredit, mediaKindLine, rightsInPlainWords } from "./credit";
import { CommonsImage, ImaginingTag } from "./image";

/**
 * What the viewer needs to show a picture and credit it fully. A MediaCard
 * has all of it; so does an EntityImage, so thumbnails can open the viewer too.
 */
export type ViewerMedia = Pick<
  MediaCard,
  | "title"
  | "alt"
  | "originalUrl"
  | "width"
  | "height"
  | "mime"
  | "focus"
  | "pageUrl"
  | "repository"
  | "representation"
  | "representationLabel"
  | "representationNote"
  | "description"
  | "artist"
  | "license"
  | "credit"
  | "attribution"
  | "objectDateLabel"
  | "imageDateLabel"
> & {
  /** The media record's id (MediaCard) or `mediaId` (EntityImage), for "Add to canvas". */
  id?: string;
  mediaId?: string;
};

export function mediaIdOf(m: ViewerMedia): string | undefined {
  return m.id ?? m.mediaId;
}

/** The credit line a licence asks for, tidied for readers (see credit.ts), linked to the file page on Commons. */
export function MediaCredit({ media, className }: { media: ViewerMedia; className?: string }) {
  return (
    <a
      href={media.pageUrl}
      target="_blank"
      rel="noreferrer"
      title={media.attribution}
      className={cn(
        "underline decoration-rule underline-offset-2 transition-colors hover:text-ink-2 hover:decoration-ink-3",
        className,
      )}
    >
      {displayCredit(media)}
    </a>
  );
}

/**
 * Keeps Tab inside the dialog: from the last control to the first and back.
 * Base UI's own focus guards let focus slip out to the page here, so the
 * dialog cycles its controls itself.
 */
function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.hasAttribute("data-base-ui-focus-guard") && el.offsetParent !== null,
  );
}

function trapTab(e: KeyboardEvent<HTMLElement>) {
  const root = e.currentTarget;
  const focusable = focusableIn(root);
  if (!focusable.length) return;
  const first = focusable[0]!;
  const last = focusable.at(-1)!;
  const active = document.activeElement;
  if (e.shiftKey && (active === first || !root.contains(active))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault();
    first.focus();
  }
}

/**
 * The enlarged image with everything we know about it: what it is, the
 * repository's description, the dates, and the full credit and licence.
 * `items` and `index` let a gallery step through its pictures.
 */
export function MediaDialog({
  items,
  index,
  onIndex,
  open,
  onOpenChange,
}: {
  items: { media: ViewerMedia; caption?: string }[];
  index: number;
  onIndex?: (i: number) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // The dialog is opened from our own buttons, not a Dialog.Trigger, so tell it where focus goes back to.
  // Read during render, before the dialog moves focus into itself.
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current && typeof document !== "undefined") opener.current = document.activeElement as HTMLElement | null;
  wasOpen.current = open;
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => setZoomed(false), [index, open]);
  // Tabbing out of a popover opened inside (Add to canvas) can land on the page behind: bring focus back in.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onFocusIn = (e: FocusEvent) => {
      const root = content.current;
      const target = e.target as HTMLElement;
      if (!root || root.contains(target) || target.closest('[data-slot="popover-content"], [data-sonner-toaster]')) return;
      focusableIn(root)[0]?.focus();
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open]);
  const item = items[index];
  if (!item) return null;
  const { media, caption } = item;
  const many = items.length > 1 && onIndex;
  const tall = media.height > media.width;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      // Once the page is interactive again (no longer inert), put focus back on the picture that opened us.
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) opener.current?.focus({ preventScroll: true });
      }}
    >
      <DialogContent
        ref={content}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-lg p-0 shadow-pop sm:max-w-5xl"
        aria-modal="true"
        finalFocus={false}
        onKeyDown={(e) => {
          // Keys from a popover opened inside (Add to canvas) bubble here through the portal: leave them to it.
          if (!e.currentTarget.contains(e.target as Node)) return;
          if (e.key === "Tab") trapTab(e);
          // While zoomed, the arrow keys look around the picture instead of changing it.
          if (!many || zoomed) return;
          if (e.key === "ArrowRight") onIndex!((index + 1) % items.length);
          if (e.key === "ArrowLeft") onIndex!((index - 1 + items.length) % items.length);
        }}
      >
        <div className={cn("grid", tall ? "md:grid-cols-[minmax(0,1fr)_20rem]" : "")}>
          <div className="relative flex items-center justify-center bg-field p-3 sm:p-4">
            {zoomed ? (
              <ZoomedImage media={media} />
            ) : (
              <div
                className="relative w-full"
                style={{ maxWidth: `min(100%, calc(${tall ? "78dvh" : "62dvh"} * ${media.width / media.height}))` }}
                onDoubleClick={() => setZoomed(true)}
              >
                <CommonsImage file={media} sizes="(min-width: 1024px) 64rem, 100vw" eager className="rounded-sm" />
                <ImaginingTag representation={media.representation} className="absolute top-2 left-2" />
              </div>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="absolute right-3 bottom-3"
              onClick={() => setZoomed((z) => !z)}
              aria-pressed={zoomed}
            >
              {zoomed ? <ZoomOut aria-hidden /> : <ZoomIn aria-hidden />}
              {zoomed ? "Fit" : "Zoom"}
            </Button>
            {many && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 left-2 -translate-y-1/2"
                  onClick={() => onIndex!((index - 1 + items.length) % items.length)}
                  aria-label="Previous picture"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-1/2 right-2 -translate-y-1/2"
                  onClick={() => onIndex!((index + 1) % items.length)}
                  aria-label="Next picture"
                >
                  <ChevronRight />
                </Button>
              </>
            )}
          </div>
          <div className="space-y-3 p-5 font-sans text-note text-ink-2">
            <div className="pr-8">
              <DialogTitle className="font-heading text-xl leading-snug text-ink">{media.title}</DialogTitle>
              <p className="mt-1 text-sm text-ink-3">
                {mediaKindLine(media)}
                {many && (
                  <span className="tnum">
                    , picture {index + 1} of {items.length}
                  </span>
                )}
              </p>
            </div>
            {isImagining(media.representation) && media.representationNote && (
              <p className="rounded-md border border-turmeric/30 bg-turmeric-wash px-3 py-2 text-ink">{media.representationNote}</p>
            )}
            {!isImagining(media.representation) && media.representationNote && <p>{media.representationNote}</p>}
            {caption && <Markdown className="space-y-2 text-ink">{caption}</Markdown>}
            {media.description && media.description !== media.title && (
              <DialogDescription className="text-sm text-ink-2">
                <span className="font-medium text-ink-3">The file's description on Commons, not checked by us: </span>
                {media.description.length > 600 ? `${media.description.slice(0, 597)}…` : media.description}
              </DialogDescription>
            )}
            <Rights media={media} />
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-rule pt-3 text-sm">
              {media.artist && (
                <>
                  <dt className="text-ink-3">By</dt>
                  <dd className="text-ink">{media.artist}</dd>
                </>
              )}
              <dt className="text-ink-3">Licence</dt>
              <dd className="text-ink">
                {media.license.url ? (
                  <a href={media.license.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-2 hover:decoration-ink-3">
                    {media.license.shortName}
                  </a>
                ) : (
                  media.license.shortName
                )}
              </dd>
              {usefulSource(media.credit) && (
                <>
                  <dt className="text-ink-3">Source</dt>
                  <dd className="break-words">{media.credit}</dd>
                </>
              )}
              <dt className="text-ink-3">Credit</dt>
              <dd>{media.attribution}</dd>
              <dt className="text-ink-3">From</dt>
              <dd>Credit and licence as Wikimedia Commons gives them</dd>
            </dl>
            <ReuseLinks media={media} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The picture at its full resolution (up to 3840 px wide, from Wikimedia's
 * own thumbnails), in a frame you can drag or scroll around. It opens on the
 * picture's focus point, or its centre.
 */
function ZoomedImage({ media }: { media: ViewerMedia }) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const width = Math.min(media.width, 3840);
  const height = Math.round((width * media.height) / media.width);
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fx = media.focus?.x ?? 0.5;
    const fy = media.focus?.y ?? 0.5;
    el.scrollLeft = Math.max(0, width * fx - el.clientWidth / 2);
    el.scrollTop = Math.max(0, height * fy - el.clientHeight / 2);
  }, [media, width, height]);
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = frame.current!;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    frame.current!.scrollLeft = d.left - (e.clientX - d.x);
    frame.current!.scrollTop = d.top - (e.clientY - d.y);
  };
  return (
    <div
      ref={frame}
      tabIndex={0}
      role="region"
      aria-label={`${media.title}, zoomed in. Drag or use the arrow keys to look around.`}
      className="h-[min(78dvh,52rem)] w-full cursor-grab touch-pan-x touch-pan-y overflow-auto rounded-md bg-rule-soft outline-none focus-visible:ring-2 focus-visible:ring-indigo active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Commons thumbnails, see image.tsx */}
      <img
        src={commonsThumbUrl(media, width)}
        alt={media.alt}
        width={width}
        height={height}
        draggable={false}
        decoding="async"
        className="max-w-none select-none"
        style={{ width, height }}
      />
    </div>
  );
}

/** The rights badge: what the licence lets a reader do, in plain words, with the licence named. */
function Rights({ media }: { media: ViewerMedia }) {
  const r = rightsInPlainWords(media.license);
  return (
    <div className="rounded-md bg-field px-3 py-2 text-sm">
      <p className="font-semibold text-ink">{r.label}</p>
      <p className="mt-0.5 leading-snug text-ink-2">{r.detail}</p>
    </div>
  );
}

const LINK =
  "inline-flex items-center gap-1.5 text-ui font-medium text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo";

/** Download the original, copy a full credit, or open the file page. */
function ReuseLinks({ media }: { media: ViewerMedia }) {
  const [copied, setCopied] = useState(false);
  // Browsers cannot show TIFFs, so offer the largest rendered copy as well as the original file.
  const viewable = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"].includes(media.mime);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyableCredit(media));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <a href={media.originalUrl} target="_blank" rel="noreferrer" download className={LINK}>
        <Download className="size-3.5" aria-hidden /> Download the original
        <span className="font-normal text-ink-3 tnum">
          ({media.width}×{media.height}
          {viewable ? "" : `, ${media.mime.replace("image/", "").toUpperCase()}`})
        </span>
      </a>
      {!viewable && (
        <a href={commonsThumbUrl(media, 3840)} target="_blank" rel="noreferrer" className={LINK}>
          <Download className="size-3.5" aria-hidden /> Download as JPEG
        </a>
      )}
      <button type="button" onClick={copy} className={LINK} aria-live="polite">
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Credit copied" : "Copy the credit"}
      </button>
      <a href={media.pageUrl} target="_blank" rel="noreferrer" className={LINK}>
        View on Wikimedia Commons <ExternalLink className="size-3.5" aria-hidden />
      </a>
      {mediaIdOf(media) && <AddToCanvas content={{ kind: "media", mediaId: mediaIdOf(media)! }} what={media.title} size="xs" className="-ml-1.5 self-start" />}
    </div>
  );
}

/** Commons source lines that lost their link text ("Detail of: .") say nothing; leave them out. */
function usefulSource(credit: string | null): credit is string {
  if (!credit) return false;
  const letters = credit.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length >= 6 && !/:\s*\.?$/.test(credit.trim());
}
