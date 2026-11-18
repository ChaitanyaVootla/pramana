"use client";

import type { ChapterSteps, PageView } from "@pramana/services";
import { useEffect, useRef } from "react";
import { markChapterReadAction } from "@/app/learn/actions";
import { cn } from "@/lib/utils";
import { usePageLearning } from "./store";

const STEPS: { key: Exclude<keyof ChapterSteps, "skimmed">; done: string; todo: string }[] = [
  { key: "read", done: "read", todo: "not read yet" },
  { key: "guessed", done: "guessed first", todo: "not guessed" },
  { key: "checked", done: "checked", todo: "not checked" },
  { key: "remembered", done: "remembered later", todo: "not yet remembered later" },
];

/** "Read, guessed first, not checked, not yet remembered later." */
export function stepsWords(steps: ChapterSteps): string {
  const words = STEPS.map((s) =>
    steps[s.key] ? s.done : s.key === "read" && steps.skimmed ? "skimmed" : s.todo,
  ).join(", ");
  return `${words[0]!.toUpperCase()}${words.slice(1)}.`;
}

/**
 * The learner's own seal for a chapter: the evidence seal's four cells, one
 * per step (read to the end, guessed first, checked, remembered a day or more
 * later), each filled when done; the first is half-filled when the part was
 * only skimmed (its one-minute version). The same glyph means "how well checked" on a
 * claim and "how far you have got" on a chapter.
 */
export function ChapterStepsSeal({
  steps,
  className,
}: {
  steps: ChapterSteps;
  className?: string;
}) {
  const words = stepsWords(steps);
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-[3px] align-middle", className)}
      role="img"
      aria-label={`Your progress: ${words}`}
      title={`Your progress: ${words}`}
    >
      {STEPS.map((s) => (
        <i
          key={s.key}
          className={cn(
            "inline-block h-[9px] w-[6px] rounded-[2px] transition-colors",
            steps[s.key]
              ? "bg-ink-2"
              : s.key === "read" && steps.skimmed
                ? "bg-ink-3"
                : "bg-rule",
          )}
        />
      ))}
    </span>
  );
}

/**
 * The seal for one chapter of an era page, from the learner's answers on it
 * (loaded once per page, shared with the question blocks). Renders nothing
 * until they have loaded.
 */
export function ChapterProgressSeal({
  view,
  chapterId,
  className,
}: {
  view: PageView;
  chapterId: string;
  className?: string;
}) {
  const { state } = usePageLearning(view.page.id);
  const steps = state.data?.chapters[chapterId];
  if (!steps) return null;
  return <ChapterStepsSeal steps={steps} className={className} />;
}

/** Reading speed for the estimates below, in words a minute. */
const WORDS_PER_MINUTE = 230;
/** Share of a text's estimated reading time the reader must spend in it before it counts. */
const SHARE_OF_READING_TIME = 0.3;
/** The shortest dwell on a summary, however short it is. */
const SKIM_FLOOR_MS = 3000;
/**
 * Taller than any screen: a full-page capture (the viewport grown to the page),
 * where everything is "in view" at once and nothing has been read.
 */
const TALLER_THAN_A_SCREEN = 2400;

/** 30% of the time it takes to read `el` at WORDS_PER_MINUTE (never under `floor`). */
function dwellFor(el: HTMLElement, floor = 0): number {
  const words = (el.innerText.match(/\S+/g) ?? []).length;
  return Math.max(floor, (words / WORDS_PER_MINUTE) * 60_000 * SHARE_OF_READING_TIME);
}

/**
 * Records "read" or "skimmed" once the reader has spent time with the part,
 * never on a scroll past it.
 * - Skimmed: the summary the marker ends ([data-brief], else its parent) has
 *   been at least half in view (or filled half the screen) for 30% of its
 *   reading time, at least SKIM_FLOOR_MS.
 * - Read: the reader has spent 30% of the whole part's reading time with it
 *   in view (the part, the section with the part's id, filling at least half
 *   the screen or half in view), and its end marker has come on screen.
 * Time only counts while the tab is visible, and nothing counts in a viewport
 * taller than any screen.
 */
function useMarkWhenSeen(view: PageView, chapterId: string, how: "read" | "skimmed") {
  const ref = useRef<HTMLSpanElement>(null);
  const { state, update } = usePageLearning(view.page.id);
  const done = state.data?.chapters[chapterId]?.[how] ?? true;
  useEffect(() => {
    const marker = ref.current;
    if (!marker || done) return;
    const area =
      how === "skimmed"
        ? (marker.closest<HTMLElement>("[data-brief]") ?? marker.parentElement)
        : (document.getElementById(chapterId) ?? marker.parentElement);
    if (!area) return;
    const needed = how === "skimmed" ? dwellFor(area, SKIM_FLOOR_MS) : dwellFor(area);
    let sent = false;
    let inside = false;
    let since = 0; // when the current stretch inside began
    let spent = 0; // time inside so far, earlier stretches
    let endSeen = how === "skimmed"; // a summary has no separate end to reach
    const tooTall = () => window.innerHeight > TALLER_THAN_A_SCREEN;
    const total = () => spent + (inside ? performance.now() - since : 0);
    const send = () => {
      sent = true;
      cleanup();
      markChapterReadAction({ page: view.page.id, chapterId, how }).then((r) => {
        if (r.ok)
          update((d) => {
            const steps = d.chapters[chapterId];
            return steps
              ? { ...d, chapters: { ...d.chapters, [chapterId]: { ...steps, [how]: true } } }
              : d;
          });
      });
    };
    const check = () => {
      if (!sent && endSeen && total() >= needed && !tooTall()) send();
    };
    const setInside = (now: boolean) => {
      const counting = now && document.visibilityState === "visible" && !tooTall();
      if (counting === inside) return;
      if (inside) spent += performance.now() - since;
      else since = performance.now();
      inside = counting;
    };
    let lastEntry: IntersectionObserverEntry | null = null;
    const enough = (e: IntersectionObserverEntry) =>
      e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= window.innerHeight / 2);
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (!e) return;
        lastEntry = e;
        setInside(enough(e));
        check();
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    const end =
      how === "read"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting) && !tooTall()) {
                endSeen = true;
                check();
              }
            },
            { rootMargin: "0px 0px -20% 0px" },
          )
        : null;
    const onVisibility = () => {
      setInside(Boolean(lastEntry && enough(lastEntry)));
      check();
    };
    // While inside, check once a second: the time can run out with nothing on screen changing.
    const tick = setInterval(() => {
      if (inside) check();
    }, 1000);
    function cleanup() {
      io.disconnect();
      end?.disconnect();
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibility);
    }
    io.observe(area);
    end?.observe(marker);
    document.addEventListener("visibilitychange", onVisibility);
    return cleanup;
  }, [done, view.page.id, chapterId, how, update]);
  return ref;
}

/**
 * An invisible marker at the end of a chapter: once the reader has spent a
 * while in the part and reached this, the part counts as read (recorded once,
 * as the learner's own action; see useMarkWhenSeen).
 */
export function ChapterEnd({ view, chapterId }: { view: PageView; chapterId: string }) {
  const ref = useMarkWhenSeen(view, chapterId, "read");
  return <span ref={ref} aria-hidden className="block h-px" />;
}

/**
 * The same at the end of a part's one-minute summary: once the summary has
 * been in view a moment (see useMarkWhenSeen), the part counts as skimmed
 * (recorded once). Mount it as the summary's last child.
 */
export function ChapterSkimmed({ view, chapterId }: { view: PageView; chapterId: string }) {
  const ref = useMarkWhenSeen(view, chapterId, "skimmed");
  return <span ref={ref} aria-hidden className="block h-px" />;
}
