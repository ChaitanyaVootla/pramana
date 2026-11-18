"use client";

import type { NextPart, PageView, StudyCard } from "@pramana/services";
import type { LearnedToday as LearnedTodayData } from "@pramana/services";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { keepGoingAction, learnedTodayAction } from "@/app/learn/actions";
import { Markdown } from "@/components/Markdown";
import { Lede } from "@/components/pages/Shell";
import { StudySession } from "@/components/StudySession";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChapterSkimmed } from "./ChapterProgressSeal";
import { CheckView } from "./Check";
import { GuessQuestion, usePartGuess } from "./Guess";
import { LearnedToday } from "./LearnedToday";
import { guessPlacements, type CheckBlock, type GuessBlock } from "./placement";

export type Step = "part" | "check" | "cards" | "end";
const ORDER: Step[] = ["part", "check", "cards", "end"];

/**
 * Today's study in one place, step by step: the next part's guess and its
 * one-minute summary, that part's check (only what the summary answers), the
 * cards due, then what was learned today. Steps with nothing in them are
 * passed over. Everything is recorded exactly as it is on the era page and on
 * /learn. The step is kept in the URL (&step=), so a reload carries on where
 * the learner was; a step with nothing left in it then moves on to the next.
 * So is the plan (&plan=, &n=): the steps and the number of cards the session
 * started with, so the plan line and the steps never change mid-session, even
 * when answering the check adds cards or a reload fetches them again.
 */
export function TodaySession(props: {
  part: NextPart | null;
  view: PageView | null;
  cards: StudyCard[];
  totalDue: number;
  step?: Step;
  plan?: { steps: Step[]; cards: number };
}) {
  // Held as first given: answering refreshes the page's server data, which would
  // otherwise move "the next part" on mid-session.
  const [{ part, view, cards, totalDue }] = useState(props);
  const router = useRouter();
  const chapter = view?.page.blocks.find((b) => b.id === part?.chapterId);
  const inPart = view && part ? view.page.blocks.filter((b) => guessPlacements(view.page.blocks).chapterOf.get(b.id) === part.chapterId) : [];
  const guess = inPart.find((b): b is GuessBlock => b.type === "guess");
  const check = inPart.find((b): b is CheckBlock => b.type === "check");
  const fresh: Step[] = [...(part && view ? (["part"] as Step[]) : []), ...(check ? (["check"] as Step[]) : []), ...(cards.length ? (["cards"] as Step[]) : []), "end"];
  const planned = props.plan?.steps.filter((s) => s === "cards" || s === "end" || fresh.includes(s));
  const steps: Step[] = planned?.includes("end") ? planned : fresh;
  const planCards = props.plan?.cards ?? cards.length;
  const [at, setAt] = useState(() => (props.step ? steps.findIndex((s) => ORDER.indexOf(s) >= ORDER.indexOf(props.step!)) : 0));
  const step = steps[Math.min(at, steps.length - 1)]!;
  const first = steps[0];
  const next = () => setAt((i) => Math.min(i + 1, steps.length - 1));
  useEffect(() => {
    const url = new URL(window.location.href);
    const before = url.search;
    if (!url.searchParams.has("plan")) {
      url.searchParams.set("plan", steps.join(","));
      url.searchParams.set("n", String(planCards));
    }
    if (url.searchParams.has("step") || step !== first) url.searchParams.set("step", step);
    if (url.search !== before) window.history.replaceState(null, "", url);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the plan is written once, as the session started
  }, [step, first]);
  const labels: Record<Step, string> = { part: "Read", check: "Check", cards: "Review", end: "Done" };

  const minutes = (part ? 2 : 0) + Math.ceil(planCards / 3);
  return (
    <div>
      {/* Said once, from the plan the session started with. */}
      <Lede className="mb-8">
        {part ? `Part ${part.number} of ${part.pageTitle}, ` : ""}
        {planCards ? `then ${planCards} ${planCards === 1 ? "card" : "cards"}` : part ? "and its check" : "Nothing new today"}
        {minutes ? `: about ${minutes} minutes.` : "."}
      </Lede>
      <ol className="flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm" aria-label="Today's steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined} className={cn("flex items-center gap-1.5", s === step ? "font-semibold text-ink" : i < at ? "text-ink-2" : "text-ink-3")}>
            <span className={cn("grid size-5 place-items-center rounded-full text-xs tnum", s === step ? "bg-indigo text-white" : i < at ? "bg-indigo-tint text-ink" : "bg-rule text-ink-3")}>{i + 1}</span>
            {labels[s]}
          </li>
        ))}
      </ol>

      <div className="mt-6">
        {step === "part" && view && part && chapter?.type === "chapter" && (
          <section aria-labelledby="today-part" className="space-y-4 font-sans">
            <div>
              <p className="text-sm text-ink-3 tnum">
                {part.pageTitle}, part {part.number} of {part.parts}
              </p>
              <h2 id="today-part" className="mt-1 font-heading text-2xl text-ink">
                {chapter.title}
              </h2>
              {part.reason && <p className="mt-1 text-sm text-ink-3">{part.reason}</p>}
            </div>
            {guess && <GuessQuestion block={guess} view={view} revealNow />}
            <PartSummary view={view} chapterId={chapter.id} />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={next}>
                {check ? "On to the check" : steps.includes("cards") ? "On to your cards" : "Finish"}
              </Button>
              <Link href={`/p/${part.pageSlug}#${chapter.id}-title`} className="text-ui text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo">
                Read the whole part
              </Link>
            </div>
          </section>
        )}

        {step === "check" && view && check && (
          <section aria-label="Check yourself" className="space-y-4">
            <CheckView block={check} view={view} selected={null} onSelect={(id) => router.push(`/c/${id}`)} guesses={[]} skimOnly />
            <Button onClick={next}>
              {steps.includes("cards") ? "On to your cards" : "Finish"}
            </Button>
          </section>
        )}

        {step === "cards" && (
          <section aria-label="Your cards" className="space-y-4">
            <StudySession cards={cards} totalDue={totalDue} />
            <Button variant="outline" onClick={next}>
              Finish for today
            </Button>
          </section>
        )}

        {step === "end" && <TodayEnd part={part} />}
      </div>
    </div>
  );
}

/** The part's one-minute summary, held back while its guess is still open (it gives the answer away). */
function PartSummary({ view, chapterId }: { view: PageView; chapterId: string }) {
  const chapter = view.page.blocks.find((b) => b.id === chapterId);
  const { status } = usePartGuess(view, chapterId);
  if (chapter?.type !== "chapter") return null;
  if (!chapter.brief)
    return chapter.promise ? <p className="max-w-(--measure) font-serif text-lg leading-relaxed text-ink">{chapter.promise}</p> : null;
  if (status === "open" || status === "loading")
    return <p className="text-sm text-ink-3">The summary of this part comes once you have guessed, or skipped the guess.</p>;
  return (
    <section data-brief aria-label={`In a minute: ${chapter.title}`} className="border-l-2 border-indigo-tint pl-4">
      <p className="text-xs font-medium text-ink-3">What happened</p>
      <Markdown className="mt-1 font-serif text-lg leading-relaxed text-ink">{chapter.brief.happened}</Markdown>
      <p className="mt-3 text-xs font-medium text-ink-3">How we know</p>
      <Markdown className="mt-1 text-note text-ink-2">{chapter.brief.howWeKnow}</Markdown>
      <ChapterSkimmed view={view} chapterId={chapterId} />
    </section>
  );
}

function TodayEnd({ part }: { part: NextPart | null }) {
  const [data, setData] = useState<LearnedTodayData | null>(null);
  const [more, setMore] = useState<{ part: NextPart | null; left: number; perDay: number } | null>(null);
  useEffect(() => {
    learnedTodayAction().then((r) => r.ok && setData(r.data));
    keepGoingAction(part?.chapterId ?? null).then((r) => r.ok && setMore(r.data));
  }, [part?.chapterId]);
  const next = more?.part ?? null;
  const nextName = next ? (next.pageSlug === part?.pageSlug ? `Part ${next.number}` : `Part ${next.number} of ${next.pageTitle}`) : "";
  const goOn = next && more!.left > 0;
  return (
    <section aria-labelledby="today-end" className="space-y-6 font-sans">
      <div>
        <h2 id="today-end" className="font-heading text-2xl text-ink">
          {part ? `Part ${part.number} done.` : "That's today."}
        </h2>
        <p className="mt-1 text-note text-ink-2">
          Your cards come back just before you would forget them.
          {more &&
            (goOn
              ? ` ${nextName} is ready if you want to keep going.`
              : next
                ? ` You have reached today's limit of ${more.perDay} new cards, so ${nextName} waits until tomorrow: more new cards today would pile up faster than you can review them.`
                : " You have studied every part there is.")}
        </p>
      </div>
      {data && <LearnedToday data={data} title="What you met today" />}
      <div className="flex flex-wrap gap-3">
        {goOn && (
          <Button nativeButton={false} render={<Link href={`/learn/today?part=${next.pageSlug}/${next.chapterId}`} />}>
            Keep going: {nextName}
          </Button>
        )}
        {part && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/p/${part.pageSlug}#${part.chapterId}-title`} />}>
            Read Part {part.number} in full
          </Button>
        )}
        <Button variant="ghost" nativeButton={false} render={<Link href="/learn" />}>
          Back to Learn
        </Button>
      </div>
    </section>
  );
}
