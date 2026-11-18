import { commonsThumbUrl, REPRESENTATION_LABELS, type ChangeOp } from "@pramana/core";

type CreateMedia = Extract<ChangeOp, { op: "create_media" }>;

/**
 * A proposed media record as a reviewer needs to see it: the picture, what it
 * is said to be, and the credit and licence the Commons API gave, with a link
 * to check the file page. Server-renderable (no client state).
 */
export function MediaOpCard({ op }: { op: CreateMedia }) {
  const ratio = op.width / op.height;
  return (
    <div className="flex gap-4">
      <a
        href={op.pageUrl}
        target="_blank"
        rel="noreferrer"
        className="relative block h-24 shrink-0 overflow-hidden rounded-md bg-chuna ring-1 ring-rule"
        style={{ width: `${Math.round(Math.min(Math.max(ratio, 0.6), 1.8) * 96)}px` }}
        title="Open the file on Wikimedia Commons"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Commons thumbnails, see components/media/image.tsx */}
        <img src={commonsThumbUrl(op, 250)} alt={op.alt} loading="lazy" decoding="async" className="size-full object-cover" />
      </a>
      <div className="min-w-0 font-sans text-ui text-ink-2">
        <p className="font-semibold text-ink">{op.title}</p>
        <p className={op.representation === "later_imagining" ? "text-turmeric-ink" : undefined}>
          {REPRESENTATION_LABELS[op.representation]}
          {op.representationNote && <span className="text-ink-2">. {op.representationNote}</span>}
        </p>
        <p className="text-sm text-ink-3">
          {op.attribution}
          {op.license.basis && <>. {op.license.basis}</>}
        </p>
        <p className="mt-0.5 truncate text-sm text-ink-3">Alt text: {op.alt}</p>
      </div>
    </div>
  );
}
