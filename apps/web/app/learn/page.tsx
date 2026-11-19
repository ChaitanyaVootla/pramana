import type { VerificationLevel } from "@pramana/core";
import {
  agesStrip,
  dueCards,
  firstSteps,
  getProgress,
  humanContext,
  learnedToday,
  learnerSignals,
  listPages,
  newCardsLeftToday,
  nextPart,
  studyMap,
  type PageProgress,
} from "@pramana/services";
import { BookOpen, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { EvidenceSeal, sealWords } from "@/components/evidence/EvidenceSeal";
import { Disclosure } from "@/components/pages/Disclosure";
import { LINK, Lede, PageContainer, PageTitle, RailBlock } from "@/components/pages/Shell";
import { LiveNotes } from "@/components/ai/LiveNotes";
import { AgesStrip } from "@/components/learn/AgesStrip";
import { FirstSteps } from "@/components/learn/FirstSteps";
import { LearnedToday } from "@/components/learn/LearnedToday";
import { OfflineSetup } from "@/components/learn/OfflineSetup";
import { StudyMap } from "@/components/learn/StudyMap";
import { StudyWithAI, type AiPrompt } from "@/components/learn/StudyWithAI";
import { StudySession } from "@/components/StudySession";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SEAL_NOT_TRUTH } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { SignInPrompt } from "@/components/shell/Account";
import { currentAccount } from "@/lib/auth";

export const metadata = { title: "Learn" };

/**
 * Where your answers stand: one sentence about the week ("This week: 26
 * cards, 52% right; you were sure and wrong 10 times."), and the rest of the
 * detail in sentences behind "More".
 */
function standing(
  progress: Awaited<ReturnType<typeof getProgress>>,
): { headline: string; detail: string[] } | null {
  const { deck, reviews } = progress;
  const parts: string[] = [];
  const { effort } = progress;
  // Effort first; "remembered" only counts cards that have been reviewed (new ones are new, not forgotten).
  const did = [
    effort.partsRead ? `${effort.partsRead} ${effort.partsRead === 1 ? "part" : "parts"} read` : "",
    effort.partsSkimmed ? `${effort.partsSkimmed} skimmed` : "",
    effort.guesses ? `${effort.guesses} ${effort.guesses === 1 ? "guess" : "guesses"}` : "",
    effort.checks ? `${effort.checks} check ${effort.checks === 1 ? "question" : "questions"}` : "",
    effort.reviews ? `${effort.reviews} ${effort.reviews === 1 ? "card" : "cards"} reviewed` : "",
  ].filter(Boolean);
  if (did.length) parts.push(`So far: ${did.join(", ")}.`);
  if (effort.seen === 1)
    parts.push(
      deck.known
        ? "You remembered the one card you have reviewed."
        : "The one card you have reviewed comes back soon.",
    );
  else if (effort.seen > 1)
    parts.push(
      `Of the ${effort.seen} cards you have reviewed, you remembered ${deck.known} the last time.`,
    );
  if (reviews.accuracy !== null)
    parts.push(
      `In the last week you were right ${Math.round(reviews.accuracy * 100)}% of the time.`,
    );
  const gap = reviews.calibrationGap;
  if (gap !== null) {
    const pts = Math.abs(Math.round(gap * 100));
    parts.push(
      gap > 0.05
        ? `You felt ${pts} points surer than you turned out to be.`
        : gap < -0.05
          ? `You knew more than you thought, by ${pts} points.`
          : "Your confidence matches what you know.",
    );
  }
  const { practice } = progress;
  if (practice.checks.answered > 0)
    parts.push(
      `This week you answered ${practice.checks.answered} end-of-chapter ${practice.checks.answered === 1 ? "question" : "questions"} and got ${practice.checks.right} right.`,
    );
  if (practice.confidentErrors > 0)
    parts.push(
      `${practice.confidentErrors === 1 ? "Once" : `${practice.confidentErrors} times`} this week you were sure and wrong.${practice.toRecheck > 0 ? ` ${practice.toRecheck} ${practice.toRecheck === 1 ? "card comes" : "cards come"} back sooner to check the correction held.` : ""}`,
    );
  const { answered, held } = practice.beliefs;
  if (answered === 1)
    parts.push(
      held
        ? "You had believed the one popular belief you were asked about."
        : "You had not believed the one popular belief you were asked about.",
    );
  else if (answered > 1)
    parts.push(`You had believed ${held} of the ${answered} popular beliefs you were asked about.`);
  if (!parts.length) return null;
  const sureWrong = practice.confidentErrors;
  const headline =
    reviews.last7Days > 0
      ? `This week: ${reviews.last7Days} ${reviews.last7Days === 1 ? "card" : "cards"}${reviews.accuracy !== null ? `, ${Math.round(reviews.accuracy * 100)}% right` : ""}${sureWrong ? `; you were sure and wrong ${sureWrong === 1 ? "once" : `${sureWrong} times`}` : ""}.`
      : parts[0]!;
  return { headline, detail: reviews.last7Days > 0 ? parts : parts.slice(1) };
}

function AiSessionHint({ className }: { className?: string }) {
  return (
    <div className={cn("font-sans text-note text-ink-2", className)}>
      <p className="flex gap-2 text-ink">
        <MessageSquareText className="mt-0.5 size-4 shrink-0 text-indigo" aria-hidden />
        Your AI&rsquo;s answers appear next to the page you are reading.
      </p>
      <p className="mt-1 pl-6 text-ui">
        <Link href="/connect" className={LINK}>
          Connect your AI
        </Link>{" "}
        <span className="text-ink-2">
          (such as Claude Desktop or Claude Code). Its notes appear next to what they are about,
          and in{" "}
          <Link href="/notes" className={LINK}>
            your notes
          </Link>
          . Any change it suggests waits for you to approve, under Proposed changes.
        </span>
      </p>
    </div>
  );
}

/** "later today", "tomorrow", "on Tue 21 Oct". */
function comesBack(at: Date): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(new Date())) / 86_400_000);
  if (days <= 0) return "later today";
  if (days === 1) return "tomorrow";
  return `on ${at.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
}

/** "Today: 12 reviews and 20 new cards (89 more new ones wait for the coming days)." */
function todayWords(t: Awaited<ReturnType<typeof getProgress>>["today"]): string {
  const parts = [
    t.reviews ? `${t.reviews} ${t.reviews === 1 ? "review" : "reviews"}` : "",
    t.fresh ? `${t.fresh} new ${t.fresh === 1 ? "card" : "cards"}` : "",
  ].filter(Boolean);
  const later = t.waiting
    ? ` ${t.waiting} more new ${t.waiting === 1 ? "card waits" : "cards wait"} for the coming days, ${t.perDay} a day.`
    : "";
  return `Today: ${parts.join(" and ")}.${later}`;
}

/** Requests to copy into an AI session, each naming the tools that do it the way /learn does. */
function studyPrompts({
  due,
  signals,
  part,
}: {
  due: number;
  signals: Awaited<ReturnType<typeof learnerSignals>>;
  part: Awaited<ReturnType<typeof nextPart>>;
}): AiPrompt[] {
  const out: AiPrompt[] = [];
  if (due > 0)
    out.push({
      id: "quiz-due",
      label: "Quiz me on what is due",
      detail: `${due} ${due === 1 ? "card" : "cards"} due`,
      button: "Copy a quiz request for your AI",
      question: "Quiz me on my due cards, one at a time, and wait for my answer before showing the source.",
      prompt:
        "On Pramāṇa, quiz me on my due cards (due_reviews), one at a time. Ask the question, wait for my answer and how sure I am (just a guess, fairly sure or sure), then show the claim with its source and record it with record_review. Never answer for me.",
    });
  const wrong = signals.summary.confused + signals.summary.forgotten;
  if (wrong > 0)
    out.push({
      id: "explain-wrong",
      label: "Explain what I got wrong",
      detail: [
        signals.summary.confused ? `${signals.summary.confused} mixed up` : "",
        signals.summary.forgotten ? `${signals.summary.forgotten} forgotten` : "",
      ]
        .filter(Boolean)
        .join(", "),
      button: "Copy a request to explain my mistakes",
      question: "Explain what I mixed up or forgot, from the sources' own words, then ask me again.",
      prompt:
        "On Pramāṇa, look at what I have confused or forgotten (learner_signals). For each one, explain what the evidence shows, using the claim and the exact words of its sources (get_claim), and point to the part of the page it comes from. Then ask me again to check that it stuck, and record my answer.",
    });
  if (part)
    out.push({
      id: "quiz-part",
      label: `Quiz me on part ${part.number} of ${part.pageTitle}`,
      detail: part.title,
      button: "Copy a request to study this part",
      question: `Take me through part ${part.number} of ${part.pageTitle}: ask me to guess first, then check what I remember.`,
      prompt: `On Pramāṇa, take me through part ${part.number} of ${part.pageTitle}, "${part.title}" (chapter_questions for ${part.pageSlug}, chapter ${part.chapterId}). Ask the guess-first question before telling me anything, then the end-of-part check, and record my own answers with record_guess and record_check_answer.`,
    });
  return out;
}

/** What to do after the reviews: the next part to read on the page read last, and checks to try again. */
function nextSteps(
  progress: Awaited<ReturnType<typeof getProgress>>,
  map: PageProgress[],
  /** The session's part: when there is one, the button above offers it, so the list does not name another. */
  sessionPart: Awaited<ReturnType<typeof nextPart>>,
) {
  const steps: { href: string; label: string; detail: string }[] = [];
  const order = [...progress.pages.map((p) => p.slug), ...map.map((p) => p.slug)];
  const pages = [...new Set(order)]
    .map((slug) => map.find((p) => p.slug === slug))
    .filter((p): p is PageProgress => Boolean(p));
  // The part whose guess was furthest off, not yet read in full: the answer is worth meeting in its context.
  const missed = pages
    .flatMap((p) => p.chapters.map((c, i) => ({ p, c, i })))
    .filter(({ c }) => c.guess && c.guess.miss > 0 && !c.steps.read)
    .sort((a, b) => b.c.guess!.miss - a.c.guess!.miss)[0];
  if (missed)
    steps.push({
      href: `/p/${missed.p.slug}#${missed.c.id}`,
      label: `Read part ${missed.i + 1} of ${missed.p.title} in full: ${missed.c.title}`,
      detail: `You guessed ${missed.c.guess!.guessed}; it was ${missed.c.guess!.answer}.`,
    });
  const current = sessionPart ? null : pages[0];
  if (current) {
    const i = current.chapters.findIndex((c) =>
      c.checkItems > 0 ? c.checked === 0 : !c.guessed && c.inDeck === 0,
    );
    const c = current.chapters[i];
    if (c)
      steps.push({
        href: `/p/${current.slug}#${c.guessId ?? c.id}`,
        label: `Read part ${i + 1} of ${current.title}: ${c.title}`,
        detail:
          c.guessId && !c.guessed
            ? "It opens with a question to guess first."
            : "It ends with a short check.",
      });
  }
  for (const p of pages)
    for (const c of p.chapters)
      if (c.checkId && c.checked > 0 && c.checkedRight < c.checked && steps.length < 4)
        steps.push({
          href: `/p/${p.slug}#${c.checkId}`,
          label: `Try the check on “${c.title}” again`,
          detail: `${c.checkedRight} of ${c.checked} answered right${c.checkItems > c.checked ? `, ${c.checkItems - c.checked} not tried` : ""}, in ${p.title}.`,
        });
  return steps;
}

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ "first-steps"?: string; era?: string }>;
}) {
  if ((await currentAccount()).mode === "guest")
    return <SignInPrompt title="Learn with your own review cards" />;
  const ctx = await humanContext();
  const params = await searchParams;
  // In development, /learn?first-steps shows the first steps to any learner, for checking the component.
  const showFirstSteps =
    process.env.NODE_ENV !== "production" && params["first-steps"] !== undefined;
  // /learn?era=<page slug>: review only that era's cards.
  const eraPages = await listPages({ kind: "era" }).catch(() => []);
  const era = eraPages.find((p) => p.slug === params.era) ?? null;
  const [cards, progress, pages, map, first, firstResult, part, today, strip, signals, fresh] =
    await Promise.all([
      dueCards(ctx, { limit: 30, ...(era ? { pageId: era.id } : {}) }),
      getProgress(ctx),
      Promise.resolve(eraPages),
      studyMap(ctx),
      firstSteps(ctx, { always: showFirstSteps }),
      firstSteps(ctx, { result: true }),
      nextPart(ctx),
      learnedToday(ctx),
      agesStrip(ctx),
      learnerSignals(ctx),
      newCardsLeftToday(ctx),
    ]);
  // Once today's new cards are all met, the session offers no new part: it waits for tomorrow (as /learn/today says).
  const sessionPart = part && fresh.left > 0 ? part : null;
  const readNext = progress.pages[0] ?? pages[0];
  const steps = nextSteps(progress, map, part);
  const stand = standing(progress);
  // One name for the way in, here and on home: "today's session", started once and then continued.
  const { effort } = progress;
  // Begun as home counts it too: any page opened (home's card then says "Continue"), or anything answered.
  const begun =
    progress.pages.length > 0 ||
    effort.seen + effort.guesses + effort.checks + effort.partsRead + effort.partsSkimmed > 0;
  // While the first steps are open their answer decides the first part, so no part is suggested yet.
  const aiPrompts = studyPrompts({ due: progress.deck.due, signals, part: first ? null : part });

  // Wide screens spread the page over three columns, each carrying content down the page: what to
  // do next and where you started on the left, the session in the middle, your eras on the right
  // (from 1024px, in the rail beside the session). Narrower, they keep their reading order in the
  // session column. Each is rendered for one of the
  // two layouts (`where`), the other copy hidden, so ids carry the layout.
  const nextSection = (where: "wide" | "narrow") =>
    steps.length > 0 && (
      <section aria-labelledby={`next-${where}`} className={where === "wide" ? "hidden xl:block" : "xl:hidden"}>
        <h2 id={`next-${where}`} className={where === "wide" ? "font-sans text-ui font-semibold text-ink" : "text-xl text-ink"}>
          {cards.length > 0 ? "After your reviews" : "Next"}
        </h2>
        <ul className="mt-3 divide-y divide-rule-soft font-sans">
          {steps.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="group block py-2.5 no-underline">
                <span>
                  <span className="text-ui text-ink group-hover:underline group-hover:decoration-indigo-tint group-hover:underline-offset-3">
                    {s.label}
                  </span>
                  <span className="block text-sm text-ink-3">{s.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  // Where you started: the left column when wide, the rail beside the session from 1024px, else in the session column.
  const startedSection = (where: "wide" | "rail" | "narrow") =>
    !first &&
    firstResult && (
      <div className={{ wide: "hidden xl:block", rail: "hidden lg:block xl:hidden", narrow: "lg:hidden" }[where]}>
        <FirstSteps data={firstResult} asResult />
      </div>
    );
  const erasSection = (where: "wide" | "narrow") =>
    map.length > 0 && (
      <section aria-labelledby={`eras-${where}`} className={where === "wide" ? "hidden lg:block" : "lg:hidden"}>
        <h2 id={`eras-${where}`} className={where === "wide" ? "font-sans text-ui font-semibold text-ink" : "text-xl text-ink"}>
          Your eras
        </h2>
        <p className="mt-1 max-w-(--measure) font-sans text-sm text-ink-3">
          Each era part by part, in its own time span. Open one to see what you guessed,
          checked and remember.
        </p>
        <div className="mt-4">
          <StudyMap pages={map} known={Object.fromEntries(progress.pages.map((p) => [p.slug, p]))} />
        </div>
      </section>
    );

  // Wide: where you have been, what next, where you started | the session's reading-width column (--reading-w, shrinking when the wide line width leaves no room) | what is due, the squares, your eras. Medium: reading | rail. Phone: one column, in this order.
  return (
    <PageContainer>
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_auto_1fr] xl:grid-rows-[auto_1fr] xl:grid-cols-[minmax(14rem,1fr)_minmax(0,var(--reading-w))_minmax(17rem,1fr)] xl:gap-x-14">
        <header className="min-w-0 lg:col-start-1 lg:row-start-1 xl:col-start-2">
          <PageTitle>Learn</PageTitle>
          <Lede>
            {progress.deck.due > 0
              ? `${todayWords(progress.today)} Say how sure you are before you look.`
              : progress.deck.total === 0 &&
                  progress.effort.guesses +
                    progress.effort.checks +
                    progress.effort.partsSkimmed ===
                    0
                ? first
                  ? "Start with two guesses about the whole of Indian history. Every question you answer becomes a card here, timed to come back just before you would forget it."
                  : "Pick an age and guess before you read. Every question you answer becomes a card here, timed to come back just before you would forget it."
                : "Nothing is due. Read on, and the cards come back just before you would forget them."}
          </Lede>
          {!first && (sessionPart || cards.length > 0) && (
            <Button
              className="mt-5 h-auto min-h-11 w-full items-center gap-3 py-2.5 text-left whitespace-normal sm:w-auto"
              size="lg"
              nativeButton={false}
              render={
                <Link
                  href={
                    sessionPart ? `/learn/today?part=${sessionPart.pageSlug}/${sessionPart.chapterId}` : "/learn/today"
                  }
                />
              }
            >
              <span className="flex flex-col">
                <span>{begun ? "Continue today's session" : "Start today's session"}</span>
                <span className="text-sm font-normal text-primary-foreground">
                  {[
                    sessionPart ? `Part ${sessionPart.number} of ${sessionPart.pageTitle}` : "",
                    cards.length ? `${cards.length} ${cards.length === 1 ? "card" : "cards"}` : "",
                  ]
                    .filter(Boolean)
                    .join(", then ")}
                </span>
              </span>
            </Button>
          )}
          {!first && part && !sessionPart && (
            <p className="mt-3 font-sans text-sm text-ink-3">
              Part {part.number} of {part.pageTitle} waits until tomorrow: you have reached today's limit of {fresh.perDay} new cards.
            </p>
          )}
        </header>

        {/* Where you have been, the week, and how this works (open until the learner has begun). */}
        <aside
          aria-label="Your progress"
          className="min-w-0 space-y-8 font-sans lg:col-start-1 lg:row-start-2 xl:row-span-2 xl:row-start-1"
        >
          <AgesStrip ages={strip.ages} begun={strip.begun} spine={strip.spine} />
          {stand && (
            <div className="text-note text-ink-2 tnum">
              <p>{stand.headline}</p>
              {stand.detail.length > 0 && (
                <Disclosure summary="More" className="mt-1">
                  <p className="pb-1 text-ink-2">{stand.detail.join(" ")}</p>
                </Disclosure>
              )}
            </div>
          )}
          <Disclosure
            summary="How this works"
            defaultOpen={!begun}
            className="border-t border-rule pt-2"
            contentClassName="space-y-2 text-note text-ink-2"
          >
            <p>
              Each part opens with one question to guess before you read, and ends with two or
              three to answer without looking back. A wrong guess still helps you remember, and
              trying to recall helps more than reading again.
            </p>
            <p>
              Before each answer you say how sure you are. Over many cards, comparing that with
              whether you were right shows whether your confidence can be trusted.
            </p>
            <p>
              When you were sure and wrong, the card comes back within minutes, and again soon after
              you first get it right, because the old idea tends to return.
            </p>
          </Disclosure>
          {nextSection("wide")}
          {startedSection("wide")}
        </aside>

        <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-3 xl:col-start-2 xl:row-start-2">
          {first && <FirstSteps data={first} />}
          {/* The session also runs offline, from the cards kept on the device (see components/learn/offline.ts). */}
          <StudySession
            key={era?.slug ?? "all"}
            cards={cards}
            totalDue={
              era ? (map.find((p) => p.slug === era.slug)?.due ?? cards.length) : progress.deck.due
            }
          >
            {first ? null : (
              <EmptyState
                title={era ? `No cards due for ${era.title}` : "No cards due"}
                action={
                  sessionPart ? (
                    <Link
                      href={`/learn/today?part=${sessionPart.pageSlug}/${sessionPart.chapterId}`}
                      className={buttonVariants()}
                    >
                      Read the next part
                    </Link>
                  ) : readNext ? (
                    <Link href={`/p/${readNext.slug}`} className={buttonVariants()}>
                      <BookOpen /> Read {readNext.title}
                    </Link>
                  ) : undefined
                }
              >
                {era
                  ? "Pick another page under “Due, by page”, or read a part to add new cards."
                  : progress.deck.nextDue
                    ? `Your next reviews come back ${comesBack(new Date(progress.deck.nextDue))}; reading a part adds new ones.`
                    : "Reading a part and answering its questions adds cards here."}
              </EmptyState>
            )}
          </StudySession>
          <OfflineSetup />
          {nextSection("narrow")}


          {aiPrompts.length > 0 && (
            <section aria-labelledby="with-ai">
              <h2 id="with-ai" className="text-xl text-ink">
                Study with your AI
              </h2>
              <p className="mt-1 max-w-(--measure) font-sans text-sm text-ink-3">
                Copy one of these requests and paste it into your AI chat. It will quiz you or
                explain, using the same cards and sources as this page, and your answers count here too.
              </p>
              <StudyWithAI prompts={aiPrompts} className="mt-2" />
              <AiSessionHint className="mt-3" />
            </section>
          )}

          {/* The AI's latest notes, about anything on the site; nothing when there are none. */}
          <LiveNotes recent limit={5} title="From your AI" />

          {today.claims.length + (today.beliefs ?? []).length > 0 ? (
            <LearnedToday data={today} />
          ) : (
            begun &&
            (today.counts.first > 0 ? (
              // First-steps answers name ages and a city, not claims: said, not listed.
              <EmptyState size="sm" title={`You answered ${today.counts.first === 1 ? "one first-steps question" : "the first steps"} today`}>
                The answers to parts and cards you meet next are listed here, with what comes back.
              </EmptyState>
            ) : (
              <EmptyState size="sm" title="Nothing answered yet today">
                What you answer today is listed here, with what comes back.
              </EmptyState>
            ))
          )}
          {startedSection("narrow")}
          {erasSection("narrow")}
        </div>

        {/* What is due, page by page, and the seal key. */}
        <aside
          aria-label="Your cards"
          className="min-w-0 space-y-7 font-sans lg:col-start-2 lg:row-span-3 lg:row-start-1 xl:col-start-3 xl:row-span-2"
        >
          {map.some((p) => p.due > 0) && (
            <nav aria-labelledby="review-by-era">
              <h2 id="review-by-era" className="font-sans text-ui font-semibold text-ink">
                Due, by page
              </h2>
              <ul className="mt-2 divide-y divide-rule border-y border-rule text-ui">
                {[
                  { slug: null as string | null, title: "Everything", due: progress.deck.due },
                  ...map.filter((p) => p.due > 0),
                ].map((p) => {
                  const active = (era?.slug ?? null) === p.slug;
                  return (
                    <li key={p.slug ?? "all"}>
                      <Link
                        key={p.slug ?? "all"}
                        href={p.slug ? `/learn?era=${p.slug}` : "/learn"}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-10 items-baseline justify-between gap-3 py-2 no-underline",
                          active ? "font-medium text-ink" : "text-ink-2 hover:text-ink",
                        )}
                      >
                        <span>{p.title}</span>
                        <span className="text-sm text-ink-3 tnum">{p.due} due</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          <RailBlock title="What the squares mean">
            <ul className="space-y-1.5">
              {([0, 1, 2, 3, 4] as VerificationLevel[]).map((l) => (
                <li key={l} className="grid grid-cols-[3rem_1fr] items-baseline gap-2 text-sm">
                  <EvidenceSeal level={l} />
                  <span>{sealWords(l)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-sm text-ink-3">{SEAL_NOT_TRUTH}</p>
          </RailBlock>
          {startedSection("rail")}
          {erasSection("wide")}
        </aside>
      </div>
    </PageContainer>
  );
}
