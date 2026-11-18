"use client";

import { diffWords, type Block } from "@pramana/core";
import type { ClaimCard } from "@pramana/services";
import Link from "next/link";
import type { MapEmbedConfig, TimelineEmbedConfig } from "@/components/atlas/embed";
import { MapEmbed, TimelineEmbed } from "@/components/atlas/embed";
import { quoteCheckWords, supportCheckWords } from "@/components/evidence/EvidenceDrawer";
import { EvidenceSeal, sealWords } from "@/components/evidence/EvidenceSeal";
import { Markdown } from "@/components/Markdown";
import { EntityThumb } from "@/components/media/EntityThumb";
import { MediaTile } from "@/components/media";
import { Viz } from "@/components/Viz";
import { claimTier } from "@/lib/era";
import { ASSESSMENT_LABELS, assessmentTone, KIND_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Item } from "./types";

/**
 * What one canvas item shows, rendered live from the content as it is now.
 * Evidence (quotations, a claim's sources) sits in a field inside the tile;
 * a reference to something since deleted says so plainly.
 */
export function ItemBody({
  item,
  height,
  onMapChange,
  onTimelineChange,
  editing = false,
}: {
  item: Item;
  /** The board's layout can be edited (the picture then does not open on click). */
  editing?: boolean;
  /** The tile body's height in px (maps and timelines pick a size from it); null in the phone list. */
  height: number | null;
  onMapChange?: (c: MapEmbedConfig) => void;
  onTimelineChange?: (c: TimelineEmbedConfig) => void;
}) {
  const { data, content } = item;
  if (data.kind === "missing")
    return (
      <p className="font-sans text-ui text-ink-3">
        The {data.what} this showed is no longer on the site. You can remove it from the board.
      </p>
    );
  switch (data.kind) {
    case "claim":
      return (
        <ClaimBody
          claim={data.claim}
          citations={content.kind === "claim" ? content.citations : true}
          placed={content.kind === "claim" ? content.placed?.text : undefined}
        />
      );
    case "entity": {
      const e = data.entity;
      const href = e.pageSlug ? `/p/${e.pageSlug}` : `/e/${e.slug}`;
      return (
        <div className="flex gap-3">
          {e.image && <EntityThumb image={e.image} size={72} />}
          <div className="min-w-0">
            <Link href={href} className="font-heading text-xl leading-tight text-ink no-underline hover:text-indigo">
              {e.label}
            </Link>
            <p className="mt-1 font-sans text-sm text-ink-3 tnum">
              {[e.kind === "place" || e.kind === "site" ? undefined : e.kind, e.whenLabel].filter(Boolean).join(", ")}
            </p>
            {e.description && <p className="mt-2 font-sans text-note leading-snug text-ink-2">{e.description}</p>}
          </div>
        </div>
      );
    }
    case "chapter": {
      const show = content.kind === "chapter" ? content.show : "brief";
      const c = data.chapter;
      return (
        <div>
          <p className="font-sans text-sm text-ink-3">
            Part {c.index + 1} of {c.total},{" "}
            <Link href={`/p/${data.page.slug}`} className="text-ink-3 hover:text-indigo">
              {data.page.title}
            </Link>
            {c.when ? `, ${c.when}` : ""}
          </p>
          <Link
            href={`/p/${data.page.slug}#${c.id}`}
            className="mt-1 block font-heading text-xl leading-tight text-ink no-underline hover:text-indigo"
          >
            {c.title}
          </Link>
          {c.promise && <p className="mt-1 font-sans text-note text-ink-2">{c.promise}</p>}
          {c.brief && (
            <div className="mt-3 space-y-2 border-l-2 border-indigo-tint pl-3 font-sans text-note leading-snug text-ink">
              <div>
                <p className="text-sm font-medium text-ink-2">What happened</p>
                <Markdown className="[&_p]:mt-0.5">{c.brief.happened}</Markdown>
              </div>
              <div>
                <p className="text-sm font-medium text-ink-2">How we know</p>
                <Markdown className="[&_p]:mt-0.5">{c.brief.howWeKnow}</Markdown>
              </div>
            </div>
          )}
          {show === "full" && <PartText blocks={data.blocks} />}
          {(show === "full" || !c.brief) && <ClaimRows claims={Object.values(data.claims)} />}
        </div>
      );
    }
    case "excerpt": {
      const x = data.excerpt;
      const placed = content.kind === "excerpt" ? content.placed : undefined;
      const changed = placed && (placed.quote !== x.quote || placed.locator !== x.locatorLabel);
      return (
        <div>
          <blockquote className="field border-l-2 border-l-indigo px-3 py-2.5 font-serif text-base leading-relaxed text-ink">
            {x.quote ? <>&ldquo;{x.quote}&rdquo;</> : <span className="font-sans text-ui text-ink-3">Cited by location only; no quotation recorded.</span>}
          </blockquote>
          <p className="mt-2 font-sans text-sm text-ink-2">
            <Link href={`/s/${x.source.id}`} className="text-ink-2 hover:text-indigo">
              {x.source.short}
            </Link>
            {x.locatorLabel ? `, ${x.locatorLabel}` : ""}
          </p>
          {changed && <Changed before={`${placed.quote ?? ""} ${placed.locator}`} after={`${x.quote ?? ""} ${x.locatorLabel}`} />}
          {data.claims.length > 0 && (
            <ul className="mt-2 space-y-1 font-sans text-sm">
              {data.claims.map((c) => (
                <li key={c.id}>
                  <Link href={`/c/${c.id}`} className="claim-link text-ink-2">
                    {c.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case "media":
      // While the layout can be edited, the picture is a plain box, so dragging never opens the viewer.
      return (
        <MediaTile
          media={data.media}
          title={content.title}
          caption={content.caption}
          fit="auto"
          interactive={!editing}
          className="h-full min-h-0"
        />
      );
    case "map": {
      if (content.kind !== "map") return null;
      const size = height === null ? "m" : height < 260 ? "s" : height < 440 ? "m" : "l";
      return (
        <MapEmbed
          year={content.year}
          range={content.range}
          places={content.places}
          focus={content.focus}
          borders={content.borders}
          bounds={content.bounds}
          title={content.title}
          size={size}
          onChange={onMapChange}
        />
      );
    }
    case "timeline":
      if (content.kind !== "timeline") return null;
      return (
        <TimelineEmbed
          range={content.range}
          items={content.entities.length ? content.entities : undefined}
          year={content.year}
          lanes={content.lanes}
          title={content.title}
          size={height !== null && height < 180 ? "s" : "m"}
          onChange={onTimelineChange}
        />
      );
    case "note": {
      const n = data.note;
      return (
        <div className="marginalia font-sans text-ui text-ink">
          <p className="font-medium">{n.title}</p>
          <Markdown className="mt-1 space-y-2 text-note leading-snug [&_p]:mt-0">{n.body}</Markdown>
          {n.viz && (
            <div className="field mt-2 p-2">
              <Viz spec={n.viz} data={n.vizData} />
            </div>
          )}
          <p className="mt-2 text-sm text-ink-3">
            {n.author}, {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
      );
    }
    case "viz":
      return content.kind === "viz" ? <Viz spec={content.viz} data={data.data} /> : null;
    case "text":
      return content.kind === "text" ? (
        <Markdown className="space-y-2 font-sans text-note leading-relaxed text-ink [&_p]:mt-0">{content.markdown}</Markdown>
      ) : null;
    case "section":
      return null;
  }
}

function ClaimBody({ claim, citations, placed }: { claim: ClaimCard; citations: boolean; placed?: string }) {
  const tone = assessmentTone(claim.assessment, claim.kind);
  const shown = claim.citations.filter((c) => c.stance !== "mentions");
  return (
    <div>
      <p className="font-sans text-xs text-ink-3">
        {claim.kind === "fact" ? null : <span className={cn(tone === "turmeric" && "text-turmeric-ink", tone === "madder" && "text-madder")}>{KIND_LABELS[claim.kind] ?? claim.kind}, </span>}
        <span className={cn(tone === "turmeric" && "text-turmeric-ink", tone === "madder" && "text-madder")}>
          {ASSESSMENT_LABELS[claim.assessment] ?? claim.assessment}
        </span>
        {claim.whenLabel ? <span className="tnum">, {claim.whenLabel}</span> : null}
      </p>
      <Link href={`/c/${claim.id}`} className="mt-1 block font-serif text-base leading-[1.5] text-ink no-underline hover:text-indigo">
        {claim.text}
      </Link>
      {/* With the sources shown, each quote carries its own verdict (the evidence panel's words); the seal's
          one-line summary stands in only when they are folded away. */}
      <p className="mt-2 flex items-center gap-2 font-sans text-sm text-ink-3">
        <EvidenceSeal level={claim.level} tier={claimTier(claim)} />
        {!(citations && shown.length > 0) && <span>{sealWords(claim.level)}</span>}
      </p>
      {placed && placed !== claim.text && <Changed before={placed} after={claim.text} />}
      {citations && shown.length > 0 && (
        <ul className="mt-3 space-y-2">
          {shown.slice(0, 2).map((c) => {
            const q = quoteCheckWords(c.excerpt.verification.status, c.excerpt.verification.score);
            const sc = supportCheckWords(c.supportCheck.state === "stale" ? "stale" : c.supportCheck.status, q.ok);
            return (
              <li key={c.id} className="field px-3 py-2">
                {c.excerpt.quote && (
                  <p className="line-clamp-4 font-serif text-note leading-relaxed text-ink">&ldquo;{c.excerpt.quote}&rdquo;</p>
                )}
                <p className="mt-1 font-sans text-xs text-ink-3">
                  {c.excerpt.source.short}
                  {c.excerpt.locatorLabel ? `, ${c.excerpt.locatorLabel}` : ""}
                </p>
                <p className={cn("mt-1 font-sans text-xs leading-snug", q.ok && sc.ok ? "text-ink-3" : "text-turmeric-ink")}>
                  {q.text} {sc.text}
                </p>
              </li>
            );
          })}
          {shown.length > 2 && (
            <li className="font-sans text-sm">
              <Link href={`/c/${claim.id}`} className="text-indigo">
                {shown.length - 2} more {shown.length - 2 === 1 ? "source" : "sources"}
              </Link>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/** "Changed since you added it", with the words that changed. */
function Changed({ before, after }: { before: string; after: string }) {
  const diff = diffWords(before, after);
  return (
    <details className="mt-2 rounded-sm bg-turmeric-wash px-2 py-1 font-sans text-sm text-turmeric-ink">
      <summary className="cursor-pointer">Changed since you added it</summary>
      <p className="mt-1 leading-snug text-ink-2">
        {diff.map((d, i) =>
          d.kind === "same" ? (
            <span key={i}>{d.text}</span>
          ) : d.kind === "added" ? (
            <ins key={i} className="bg-indigo-wash text-indigo no-underline">
              {d.text}
            </ins>
          ) : (
            <del key={i} className="text-ink-3">
              {d.text}
            </del>
          ),
        )}
      </p>
    </details>
  );
}

function ClaimRows({ claims }: { claims: ClaimCard[] }) {
  if (!claims.length) return null;
  return (
    <ul className="mt-3 divide-y divide-rule-soft font-sans text-ui">
      {claims.map((c) => (
        <li key={c.id} className="flex items-start justify-between gap-3 py-1.5">
          <Link href={`/c/${c.id}`} className="text-ink no-underline hover:text-indigo">
            {c.text}
          </Link>
          <EvidenceSeal level={c.level} tier={claimTier(c)} className="mt-1" />
        </li>
      ))}
    </ul>
  );
}

/** A part's own text, for "full": prose and callouts as written; lists are the claim rows. */
function PartText({ blocks }: { blocks: Block[] }) {
  const md = blocks.flatMap((b) => (b.type === "prose" || b.type === "callout" ? [{ id: b.id, md: b.markdown }] : []));
  if (!md.length) return null;
  return (
    <div className="mt-3 space-y-3 font-serif text-base leading-[1.6] text-ink">
      {md.map((b) => (
        <Markdown key={b.id} className="space-y-3">
          {b.md}
        </Markdown>
      ))}
    </div>
  );
}
