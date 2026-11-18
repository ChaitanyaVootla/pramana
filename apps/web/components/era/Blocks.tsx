"use client";

import type { Block } from "@pramana/core";
import type { PageView } from "@pramana/services";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { BeliefTap } from "@/components/learn/Belief";
import { ChapterEnd } from "@/components/learn/ChapterProgressSeal";
import { CheckView } from "@/components/learn/Check";
import { GuessQuestion, GuessReveal } from "@/components/learn/Guess";
import { guessPlacements } from "@/components/learn/placement";
import { Figure, Gallery } from "@/components/media";
import { Viz } from "@/components/Viz";
import { ASSESSMENT_LABELS, assessmentTone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { ClaimItem } from "./ClaimItem";

export interface BlockProps {
  view: PageView;
  selected: string | null;
  onSelect: (id: string) => void;
}

const PROSE = "prose-reading space-y-5 text-base text-ink [&_p]:leading-[1.65]";

/**
 * Renders one content block inside a chapter's reading surface, followed by
 * the answers to any "Guess first" questions revealed at that point and, after
 * a chapter's last block, the marker that counts the chapter as read (see
 * components/learn/placement.ts).
 */
export function BlockView(props: BlockProps & { block: Block }) {
  const placements = guessPlacements(props.view.page.blocks);
  const reveals = placements.after.get(props.block.id);
  const endOf = placements.chapterEnds.get(props.block.id);
  if (!reveals && !endOf) return <BlockBody {...props} />;
  return (
    <>
      <BlockBody {...props} />
      {reveals?.map((g) => (
        <GuessReveal
          key={g.id}
          block={g}
          view={props.view}
          selected={props.selected}
          onSelect={props.onSelect}
        />
      ))}
      {endOf && <ChapterEnd view={props.view} chapterId={endOf} />}
    </>
  );
}

/**
 * One block. Timeline and map blocks are not drawn inline: the context rail
 * and the hero carry the period timeline and the map, so the reading column
 * stays prose and claims.
 */
function BlockBody({ block: b, view, selected, onSelect }: BlockProps & { block: Block }) {
  switch (b.type) {
    case "heading":
      return (
        <h3 id={b.id} className="mt-8 scroll-mt-24 text-xl text-ink">
          {b.text}
        </h3>
      );
    case "prose":
      return <Markdown className={PROSE}>{b.markdown}</Markdown>;
    case "callout":
      // A quiet note beside the reading, not a box: a thin rule, small sans text. Caution notes
      // (how far to trust a source) keep a turmeric rule; "how we know" notes are ink.
      return (
        <div
          role="note"
          className={cn(
            "border-l-2 py-0.5 pl-4 font-sans text-note leading-snug text-ink-2",
            b.tone === "caution" ? "border-turmeric/70" : "border-rule",
          )}
        >
          {b.tone === "method" && (
            <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink">
              <ShieldAlert className="size-3.5 text-ink-3" aria-hidden /> How we know
            </p>
          )}
          <Markdown className="space-y-2">{b.markdown}</Markdown>
        </div>
      );
    case "key_facts":
    case "claims":
      return (
        <section id={b.id}>
          {b.title && (
            <h3 className="mb-2 font-sans text-sm font-semibold text-ink-2">{b.title}</h3>
          )}
          <ul className="-ml-4 space-y-0.5">
            {b.claimIds.map((id) => (
              <ClaimItem
                key={id}
                claim={view.claims[id]}
                selected={selected === id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </section>
      );
    case "misconception":
      return <OftenSaid block={b} view={view} selected={selected} onSelect={onSelect} />;
    case "debate":
      return (
        <section id={b.id} className="border-l-2 border-turmeric pl-4 sm:pl-5">
          <p className="font-sans text-xs font-medium text-turmeric-ink">Still argued over</p>
          <h3 className="mt-1 text-lg leading-snug text-ink">{b.question}</h3>
          {/* Each reading as a full-width row under its label, so no reading is squeezed into a narrow column. */}
          <div className="mt-4 divide-y divide-rule border-y border-rule">
            {b.positions.map((p) => (
              <div key={p.label} className="pt-3 pb-2">
                <p className="font-sans text-ui font-semibold text-ink">{p.label}</p>
                <ul className="-ml-3 mt-1 space-y-0.5">
                  {p.claimIds.map((id) => (
                    <ClaimItem
                      key={id}
                      claim={view.claims[id]}
                      selected={selected === id}
                      onSelect={onSelect}
                      unlabelled={["contested"]}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {b.note && <Markdown className="mt-3 font-sans text-note text-ink-2">{b.note}</Markdown>}
        </section>
      );
    case "quote": {
      const e = view.excerpts[b.excerptId];
      if (!e) return null;
      // Aśoka's own epithet in Brāhmī marks quotations from his edicts (and only his).
      const inscribed = /edict|a[sś]oka/i.test(`${e.source.title} ${e.locatorLabel}`);
      return (
        <figure id={b.id} className="field relative border-l-2 border-indigo px-6 py-5">
          <span
            className="pointer-events-none absolute top-2 left-4 font-serif text-5xl leading-none text-indigo-tint select-none"
            aria-hidden
          >
            “
          </span>
          {inscribed && (
            <span
              className="absolute top-3.5 right-4 font-brahmi text-sm text-indigo/60"
              aria-hidden
              title="devānaṃpiya, “beloved of the gods”: Aśoka's title, in the Brāhmī script of his edicts"
            >
              𑀤𑁂𑀯𑀸𑀦𑀁𑀧𑀺𑀬
            </span>
          )}
          <blockquote className="relative pt-3 pr-14 font-serif text-lg leading-[1.55] text-ink [font-variation-settings:'opsz'_20]">
            {e.quote}
          </blockquote>
          <figcaption className="mt-3 font-sans text-sm text-ink-2">
            <Link
              href={`/s/${e.source.id}`}
              className="text-ink underline decoration-rule underline-offset-3 transition-colors hover:decoration-ink-3"
            >
              {e.source.short}
            </Link>
            {e.locatorLabel && <>, {e.locatorLabel}</>}
            {b.caption && <span className="mt-0.5 block text-ink-3">{b.caption}</span>}
            {e.quote?.includes("(") && !/bracket/i.test(b.caption ?? "") && (
              <span className="block text-ink-3">Words in brackets are the translator's.</span>
            )}
          </figcaption>
        </figure>
      );
    }
    case "entities":
      return (
        <section id={b.id}>
          {b.title && (
            <h3 className="mb-2 font-sans text-sm font-semibold text-ink-2">{b.title}</h3>
          )}
          <ul className="flex flex-wrap gap-2 font-sans text-ui">
            {b.entityIds.map((id) => {
              const e = view.entities[id];
              if (!e) return null;
              return (
                <li key={id}>
                  <Link
                    href={e.pageSlug ? `/p/${e.pageSlug}` : `/e/${e.slug}`}
                    className="inline-flex min-h-8 items-baseline gap-2 rounded-sm border border-rule px-2.5 py-1 no-underline transition-colors hover:border-ink-3/60 hover:bg-rule-soft/50"
                  >
                    {e.label}
                    {e.whenLabel && <span className="text-sm text-ink-3 tnum">{e.whenLabel}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      );
    case "figure": {
      const media = view.media?.[b.media];
      if (!media) return null;
      return <Figure id={b.id} media={media} caption={b.caption} size={b.size} />;
    }
    case "gallery": {
      const items = b.items.flatMap((i) => {
        const media = view.media?.[i.media];
        return media ? [{ media, caption: i.caption }] : [];
      });
      if (!items.length) return null;
      if (items.length === 1)
        return <Figure id={b.id} media={items[0]!.media} caption={items[0]!.caption} />;
      return <Gallery id={b.id} items={items} title={b.title} label={chapterOf(view, b.id)} />;
    }
    case "viz":
      // The period timeline and the map live in the hero and the context rail.
      if (b.viz.kind === "timeline" || b.viz.kind === "map") return null;
      return (
        <figure id={b.id}>
          <Viz spec={b.viz} data={view.viz[b.id]} focusId={view.page.entity?.id} />
          {b.caption && (
            <figcaption className="mt-1.5 font-sans text-sm text-ink-3">{b.caption}</figcaption>
          )}
        </figure>
      );
    case "guess":
      return <GuessQuestion block={b} view={view} />;
    case "check":
      return (
        <CheckView
          block={b}
          view={view}
          selected={selected}
          onSelect={onSelect}
          guesses={guessPlacements(view.page.blocks).inCheck.get(b.id) ?? []}
        />
      );
    default:
      return null;
  }
}

/** "Often said": the verdict first, then the saying, then what the evidence shows. */
export function OftenSaid({
  block: b,
  view,
  selected,
  onSelect,
}: BlockProps & { block: Extract<Block, { type: "misconception" }> }) {
  const belief = view.claims[b.claimId];
  if (!belief) return null;
  const tone = assessmentTone(belief.assessment, belief.kind);
  const madder = tone === "madder";
  return (
    <section
      id={b.id}
      className={cn("border-l-2 pl-4 sm:pl-5", madder ? "border-madder" : "border-turmeric")}
    >
      <p className="flex flex-wrap items-center gap-2 font-sans text-sm">
        <span className="text-ink-2">Often said</span>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-sm px-2 text-xs font-semibold",
            madder
              ? "bg-madder text-white dark:text-[#1a1408]"
              : "border border-turmeric/40 bg-turmeric-wash text-turmeric-ink",
          )}
        >
          {ASSESSMENT_LABELS[belief.assessment] ?? belief.assessment}
        </span>
      </p>
      <button
        type="button"
        onClick={() => onSelect(belief.id)}
        aria-pressed={selected === belief.id}
        className={cn(
          "mt-2.5 rounded-md text-left font-serif text-lg leading-[1.45] text-ink italic transition-colors",
          selected === belief.id
            ? "underline decoration-indigo decoration-2 underline-offset-4"
            : "hover:text-ink/80",
        )}
      >
        “{belief.text.replace(/“/g, "‘").replace(/”/g, "’")}”
      </button>
      {belief.assessmentNote && (
        <p className="mt-2.5 font-sans text-note leading-snug text-ink-2">
          {belief.assessmentNote}
        </p>
      )}
      <BeliefTap blockId={b.id} claimId={belief.id} view={view} className="mt-3" />
      {b.correctionIds.length > 0 && (
        <div className="mt-4 rounded-lg bg-paper/70 p-2 dark:bg-paper/40">
          <p className="px-2 pt-1 font-sans text-sm font-semibold text-ink-2">
            What the evidence shows
          </p>
          <ul className="mt-1 space-y-0.5">
            {b.correctionIds.map((id) => (
              <ClaimItem
                key={id}
                claim={view.claims[id]}
                selected={selected === id}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** The title of the chapter a block sits in, to name its gallery for screen readers. */
function chapterOf(view: PageView, blockId: string): string | undefined {
  const blocks = view.page.blocks;
  for (let i = blocks.findIndex((x) => x.id === blockId); i >= 0; i--) {
    const x = blocks[i]!;
    if (x.type === "chapter") return x.title;
  }
  return undefined;
}
