"use client";

import type { PageView } from "@pramana/services";
import { ArrowDown, ChevronDown, Map as MapIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChapterSkimmed } from "@/components/learn/ChapterProgressSeal";
import { GuessLine } from "@/components/learn/Guess";
import type { GuessBlock } from "@/components/learn/placement";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

/**
 * The one-minute version of a part: what happened (its sentences link the
 * claims they rest on) and how we know. The part's date is in the chip row
 * above it. Below, a control opens the whole part; once open, the brief
 * shrinks to one "In short" line so the part does not say it twice.
 *
 * The summary is always there to read. The part's "Guess first" sits above it
 * as one line; only while the learner is answering it does the summary (which
 * gives the answer) step aside, and it is back as soon as they save or skip.
 * On wide screens the part's picture stands beside the summary.
 */
export function PartBrief({
  id,
  label,
  happened,
  howWeKnow,
  open,
  onToggle,
  length,
  next,
  onShowOnMap,
  check,
  guess,
  picture,
  view,
  chapterId,
}: {
  view: PageView;
  chapterId: string;
  /** Anchor for "the answer is in the summary". */
  id: string;
  /** "Part 2 in a minute: The war in Kalinga": names the section (each part's must differ). */
  label: string;
  happened: string;
  howWeKnow: string;
  open: boolean;
  onToggle: () => void;
  /** "about 6 min": how long the whole part takes. */
  length: string;
  /** While skimming, the next part, and whether going there shows its year on the map. */
  next?: { label: string; onGo: () => void; mapYear: string | null } | null;
  /** "Show on map: 261 BCE", when the part has a date and the page an atlas. */
  onShowOnMap?: { year: string; go: () => void } | null;
  /** The part's "Check yourself" line, shown here while the part is folded. */
  check?: React.ReactNode;
  /** The part's "Guess first", drawn as one line above the summary while the part is folded. */
  guess?: GuessBlock | null;
  /** The part's picture, beside the summary from 1280px while the part is folded. */
  picture?: React.ReactNode;
}) {
  const [answering, setAnswering] = useState(false);
  if (open)
    return (
      <section
        id={id}
        data-brief
        aria-label={label}
        className="mt-6 max-w-[66ch] scroll-mt-28 font-sans"
      >
        <div className="text-note leading-snug text-ink-2">
          <span className="font-medium text-ink-3">In short: </span>
          <Markdown className="inline [&_p]:inline">{happened}</Markdown>{" "}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded
            className="inline-flex items-center gap-1 rounded-sm text-sm text-indigo hover:underline"
          >
            <ChevronDown className="size-3.5 rotate-180" aria-hidden /> Fold the part
          </button>
        </div>
      </section>
    );
  return (
    <>
      {guess && (
        <div className="mt-6 max-w-[66ch]">
          <GuessLine block={guess} view={view} onAnswering={setAnswering} />
        </div>
      )}
      <section
        id={id}
        data-brief
        aria-label={label}
        className={cn(
          "scroll-mt-28",
          guess ? "mt-4" : "mt-6",
          picture
            ? "xl:grid xl:max-w-none xl:grid-cols-[minmax(0,1fr)_12rem] xl:items-start xl:gap-x-7"
            : "max-w-[66ch]",
        )}
      >
        {/* The summary is prose with a thin indigo rule, not a box (docs/visual.md §6). */}
        <div className="max-w-[66ch] min-w-0 border-l-2 border-indigo pl-4 sm:pl-5">
          {answering ? (
            <p className="font-sans text-note text-ink-3">
              The summary is back once you save or skip your guess.
            </p>
          ) : (
            <dl className="space-y-3">
              <div>
                <dt className="font-sans text-xs font-medium text-ink-3">What happened</dt>
                <dd className="mt-0.5">
                  <Markdown className="text-base leading-[1.55] text-ink sm:text-lg [&_p]:inline">
                    {happened}
                  </Markdown>
                </dd>
              </div>
              <div>
                <dt className="font-sans text-xs font-medium text-ink-3">How we know</dt>
                <dd className="mt-0.5">
                  <Markdown className="font-sans text-note leading-snug text-ink-2">
                    {howWeKnow}
                  </Markdown>
                </dd>
              </div>
            </dl>
          )}
          {check && <div className="mt-4">{check}</div>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule-soft pt-3 font-sans text-sm">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={false}
              className="inline-flex items-center gap-1.5 rounded-sm font-medium text-indigo hover:underline"
            >
              <ChevronDown className="size-4" aria-hidden />
              Read the whole part
              <span className="font-normal text-ink-3">{length}</span>
            </button>
            {onShowOnMap && (
              <button
                type="button"
                onClick={onShowOnMap.go}
                className="hidden items-center gap-1.5 rounded-sm text-ink-2 hover:text-ink hover:underline lg:inline-flex"
              >
                <MapIcon className="size-3.5" aria-hidden /> Show on map
                <span className="text-ink-3">{onShowOnMap.year}</span>
              </button>
            )}
            {next && (
              <button
                type="button"
                onClick={next.onGo}
                className="ml-auto inline-flex items-center gap-1.5 rounded-sm text-ink-2 hover:text-ink hover:underline"
              >
                <ArrowDown className="size-3.5" aria-hidden />
                Next: {next.label}
                {next.mapYear && (
                  <span
                    className="hidden text-ink-3 sm:inline"
                    title={`The map moves to ${next.mapYear}`}
                  >
                    {next.mapYear}
                  </span>
                )}
              </button>
            )}
          </div>
          {!answering && <ChapterSkimmed view={view} chapterId={chapterId} />}
        </div>
        {picture && <div className="hidden min-w-0 xl:block">{picture}</div>}
      </section>
    </>
  );
}

/**
 * The rest of a part. Folded, it stays in the page as hidden="until-found":
 * find-in-page still reaches it (and opens it), and print shows it. Its
 * controls are out of the tab order while folded.
 */
export function PartBody({
  open,
  onReveal,
  children,
}: {
  open: boolean;
  onReveal: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.removeAttribute("hidden");
    else el.setAttribute("hidden", "until-found");
    const on = () => onReveal();
    el.addEventListener("beforematch", on);
    return () => el.removeEventListener("beforematch", on);
  }, [open, onReveal]);
  return (
    // Hidden from the first paint (React writes hidden=""; the effect makes it "until-found").
    // hidden="until-found" keeps it out of the tab order and the accessibility tree while staying
    // reachable by find-in-page (inert would not be); nothing here sets aria-hidden.
    <div ref={ref} className={cn("part-body")} {...({ hidden: !open } as object)}>
      {children}
    </div>
  );
}
