"use client";

import {
  dateBounds,
  formatGuessAnswer,
  formatGuessResponse,
  toFuzzyDate,
  type GuessResponse,
  type Sureness,
} from "@pramana/core";
import type { PageView } from "@pramana/services";
import { ArrowDown, CircleAlert, CircleHelp } from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import { recordGuessAction, skipGuessAction } from "@/app/learn/actions";
import { useReader } from "@/components/chips/reader";
import { ClaimItem } from "@/components/era/ClaimItem";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { briefAnswers, guessPlacements, type GuessBlock } from "./placement";
import { usePageLearning } from "./store";
import { radioArrows, SurenessPicker, surenessPhrase } from "./Sureness";

export { formatGuessAnswer, formatGuessResponse };

/** A number typed with or without thousands separators ("150,000", "150 000"). */
function parseNumber(text: string): number | null {
  const clean = text.replace(/[\s,_]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  return Number(clean);
}

export const revealId = (blockId: string) => `answer-${blockId}`;

function Shell({
  id,
  labelId,
  children,
  className,
}: {
  id?: string;
  labelId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelId}
      className={cn("field scroll-mt-28 px-4 py-3", className)}
    >
      {children}
    </section>
  );
}

/** Astronomical start year of the chapter a block is in, else of the page. */
function startYearAround(view: PageView, blockId: string): number | null {
  const chapterId = guessPlacements(view.page.blocks).chapterOf.get(blockId);
  const chapter = view.page.blocks.find((b) => b.id === chapterId);
  if (chapter?.type === "chapter" && chapter.when) {
    try {
      const start = dateBounds(toFuzzyDate(chapter.when)).startMin;
      if (start !== null) return start;
    } catch {
      // An unparseable chapter date falls back to the page's.
    }
  }
  return view.page.entity?.bounds?.startMin ?? null;
}


export type PartGuessStatus = "none" | "loading" | "open" | "answered" | "skipped";

/**
 * The state of a part's "Guess first" question: while it is "open" (or still
 * "loading"), a summary that holds the answer may keep it out of sight (as
 * Today's session does). "none": the part has no guess.
 */
export function usePartGuess(
  view: PageView,
  chapterId: string,
): { guessId: string | null; status: PartGuessStatus } {
  const { state } = usePageLearning(view.page.id);
  const guess = view.page.blocks.find(
    (b) =>
      b.type === "guess" && guessPlacements(view.page.blocks).chapterOf.get(b.id) === chapterId,
  );
  if (!guess) return { guessId: null, status: "none" };
  if (state.status !== "ready")
    return { guessId: guess.id, status: state.status === "error" ? "open" : "loading" };
  if (state.data.guesses[guess.id]) return { guessId: guess.id, status: "answered" };
  if (state.data.skipped.includes(guess.id)) return { guessId: guess.id, status: "skipped" };
  return { guessId: guess.id, status: "open" };
}

/** What a "Guess first" question needs, whichever way it is drawn: the answer being typed, saving it, skipping. */
function useGuessForm(block: GuessBlock, view: PageView) {
  const { state, update, retry } = usePageLearning(view.page.id);
  const [option, setOption] = useState<number | null>(null);
  const [text, setText] = useState("");
  // The era starts from the chapter's own period (not the answer's: that would
  // give it away); in a chapter wholly in CE with a CE answer there is no choice.
  const start0 = startYearAround(view, block.id);
  const a = block.answer;
  const allCE = start0 !== null && start0 >= 1 && (a.kind !== "year" || a.era === "CE");
  const [era, setEra] = useState<"BCE" | "CE">(start0 !== null && start0 < 1 ? "BCE" : "CE");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const guessed = state.data?.guesses[block.id];
  const skipped = state.data?.skipped.includes(block.id) ?? false;

  const response: GuessResponse | null =
    a.kind === "choice"
      ? option === null
        ? null
        : { kind: "choice", option }
      : a.kind === "number"
        ? (() => {
            const n = parseNumber(text);
            return n === null ? null : { kind: "number", value: n };
          })()
        : (() => {
            const n = parseNumber(text);
            return n === null || n < 1 || !Number.isInteger(n)
              ? null
              : { kind: "year", year: n, era };
          })();

  const submit = (sureness: Sureness) => {
    if (!response) return;
    start(async () => {
      const r = await recordGuessAction({
        page: view.page.id,
        blockId: block.id,
        response,
        sureness,
      });
      if (!r.ok) return setError(r.error);
      setError(null);
      const { already: _already, ...g } = r.data;
      const chapter = guessPlacements(view.page.blocks).chapterOf.get(block.id);
      update((d) => ({
        ...d,
        guesses: { ...d.guesses, [block.id]: g },
        inDeck: [...new Set([...d.inDeck, block.claimId])],
        chapters:
          chapter && d.chapters[chapter]
            ? { ...d.chapters, [chapter]: { ...d.chapters[chapter]!, guessed: true } }
            : d.chapters,
      }));
    });
  };

  const skip = (then?: () => void) =>
    start(async () => {
      const r = await skipGuessAction({ page: view.page.id, blockId: block.id });
      if (!r.ok) return setError(r.error);
      setError(null);
      then?.();
      update((d) => ({ ...d, skipped: [...new Set([...d.skipped, block.id])] }));
    });

  return {
    state,
    retry,
    option,
    setOption,
    text,
    setText,
    era,
    setEra,
    allCE,
    response,
    submit,
    skip,
    guessed,
    skipped,
    error,
    busy: state.status !== "ready" || pending,
  };
}

/** "Your answers could not be loaded" and a failed save, under either form of the question. */
function GuessErrors({ form }: { form: ReturnType<typeof useGuessForm> }) {
  return (
    <>
      {form.state.status === "error" && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 font-sans text-sm text-madder">
          <CircleAlert className="size-4" aria-hidden /> Your answers could not be loaded.
          <Button variant="link" size="xs" onClick={form.retry}>
            Try again
          </Button>
        </p>
      )}
      {form.error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 font-sans text-sm text-madder">
          <CircleAlert className="size-4" aria-hidden /> {form.error}
        </p>
      )}
    </>
  );
}

/** BCE or CE beside a typed year (nothing to choose in a chapter wholly in CE). */
function EraChoice({ form, size }: { form: ReturnType<typeof useGuessForm>; size: "xs" | "sm" }) {
  if (form.allCE) return <span className="text-ui text-ink-2">CE</span>;
  return (
    <span role="radiogroup" aria-label="Era" className="inline-flex gap-1" onKeyDown={radioArrows}>
      {(["BCE", "CE"] as const).map((e) => (
        <Button
          key={e}
          type="button"
          role="radio"
          aria-checked={form.era === e}
          tabIndex={form.era === e ? 0 : -1}
          size={size}
          variant={form.era === e ? "secondary" : "outline"}
          onClick={() => form.setEra(e)}
        >
          {e}
        </Button>
      ))}
    </span>
  );
}

/**
 * "Guess first", at the start of a chapter: one question answered before
 * reading. It stays a single line until the learner chooses to guess; "How
 * sure are you?" appears once there is a guess to be sure of. It can be
 * skipped. No score is kept or shown; the answer comes in the part's summary
 * when it has one, else at the part's end.
 */
export function GuessQuestion({
  block,
  view,
  revealNow = false,
}: {
  block: GuessBlock;
  view: PageView;
  /** Reading the summary only (as in Today's session): an answer the summary does not give is shown here once guessed. */
  revealNow?: boolean;
}) {
  const labelId = useId();
  const panelId = useId();
  const form = useGuessForm(block, view);
  const { state, option, setOption, text, setText, response, guessed, skipped, busy } = form;
  const [open, setOpen] = useState(false);
  const a = block.answer;
  // Point to the summary only when it states the answer; a part read in summary shows any other answer right here.
  const brief = briefAnswers(view.page.blocks, block);
  const chapterId = guessPlacements(view.page.blocks).chapterOf.get(block.id) ?? "";
  const partFolded = useReader().partFolded?.(chapterId) === true;
  const answerHere = !brief && (revealNow || partFolded);
  const answerLine = (
    <>
      The answer: <span className="font-medium text-ink">{formatGuessAnswer(a)}</span>.
      {guessed?.result.correct ? " Right." : guessed?.result.close ? " Close." : ""}
    </>
  );
  // The why is said once per page, at the first guess.
  const firstOnPage = view.page.blocks.find((b) => b.type === "guess")?.id === block.id;

  return (
    <Shell labelId={labelId} id={block.id}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        <p id={labelId} className="min-w-0 flex-1 font-sans text-note text-ink">
          <CircleHelp className="mr-1.5 inline size-4 -translate-y-px text-ink-3" aria-hidden />
          <span className="font-semibold">Guess first: </span>
          <span className="font-serif text-base">{block.question}</span>
        </p>
        {!guessed && !skipped && (
          <span className="flex items-center gap-1">
            {!open && (
              <Button
                variant="outline"
                size="sm"
                aria-expanded={false}
                aria-controls={panelId}
                disabled={state.status !== "ready"}
                onClick={() => setOpen(true)}
              >
                Guess
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-ink-3"
              disabled={busy}
              onClick={() => form.skip(() => setOpen(false))}
            >
              Skip
            </Button>
          </span>
        )}
      </div>

      {guessed ? (
        <p className="mt-1 font-sans text-sm text-ink-2">
          You guessed{" "}
          <span className="font-medium text-ink">{formatGuessResponse(a, guessed.response)}</span>
          {surenessPhrase(guessed.confidence) && <> ({surenessPhrase(guessed.confidence)})</>}.{" "}
          {brief ? (
            "The answer is in the summary below."
          ) : answerHere ? (
            answerLine
          ) : (
            <>
              The answer comes{" "}
              <a
                href={`#${revealId(block.id)}`}
                className="inline-flex items-center gap-0.5 text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo"
              >
                at the end of this part <ArrowDown className="size-3.5" aria-hidden />
              </a>
            </>
          )}
        </p>
      ) : skipped ? (
        <p className="mt-1 font-sans text-sm text-ink-3">
          Skipped.{" "}
          {brief ? "The answer is in the summary below." : answerHere ? answerLine : "The answer comes at the end of this part."}
        </p>
      ) : open ? (
        <div id={panelId} className="mt-3 space-y-4">
          {firstOnPage && (
            <p className="font-sans text-sm text-ink-3">
              Before you read. A wrong guess helps too: the answer sticks better once you have
              guessed.
            </p>
          )}
          {a.kind === "choice" ? (
            <div
              role="radiogroup"
              aria-labelledby={labelId}
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
              onKeyDown={radioArrows}
            >
              {a.options.map((o, i) => (
                <Button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={option === i}
                  tabIndex={(option ?? 0) === i ? 0 : -1}
                  variant={option === i ? "secondary" : "outline"}
                  className={cn(
                    "h-auto min-h-9 justify-start py-1.5 text-left whitespace-normal",
                    option === i && "ring-1 ring-indigo",
                  )}
                  disabled={busy}
                  onClick={() => setOption(i)}
                >
                  {o}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 font-sans">
              <label htmlFor={`${labelId}-n`} className="sr-only">
                Your guess{a.kind === "number" && a.unit ? `, in ${a.unit}` : ""}
              </label>
              <Input
                id={`${labelId}-n`}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={a.kind === "year" ? "Year" : "Your guess"}
                className="w-36 bg-paper"
                disabled={busy}
                aria-invalid={text !== "" && !response}
              />
              {a.kind === "number" &&
                a.unit &&
                !block.question.toLowerCase().includes(a.unit.toLowerCase()) && (
                  <span className="text-ui text-ink-2">{a.unit}</span>
                )}
              {a.kind === "year" && <EraChoice form={form} size="sm" />}
            </div>
          )}
          {response && (
            <SurenessPicker onPick={form.submit} disabled={busy} hint="Choosing one saves your guess." />
          )}
        </div>
      ) : null}
      <GuessErrors form={form} />
    </Shell>
  );
}

/**
 * "Guess first" as one line above a part's one-minute summary, for reading
 * the summaries: the question with the answer field right after it, then
 * Skip. Nothing is in the way of the summary until the learner starts to
 * answer; from then until they save or skip, `onAnswering(true)` lets the
 * part keep its summary (which gives the answer) out of sight. "How sure are
 * you?" follows once there is an answer, and choosing one saves it.
 */
export function GuessLine({
  block,
  view,
  onAnswering,
}: {
  block: GuessBlock;
  view: PageView;
  onAnswering?: (answering: boolean) => void;
}) {
  const labelId = useId();
  const form = useGuessForm(block, view);
  const { option, setOption, text, setText, response, guessed, skipped, busy } = form;
  const a = block.answer;
  const brief = briefAnswers(view.page.blocks, block);
  const answering = !guessed && !skipped && (option !== null || text.trim() !== "");
  useEffect(() => {
    onAnswering?.(answering);
  }, [answering, onAnswering]);
  const answerLine = (
    <>
      The answer: <span className="font-medium text-ink">{formatGuessAnswer(a)}</span>.
      {guessed?.result.correct ? " Right." : guessed?.result.close ? " Close." : ""}
    </>
  );
  const control = "h-8 rounded-md border border-rule bg-paper font-sans text-sm text-ink dark:bg-input/30";

  return (
    <section id={block.id} aria-labelledby={labelId} className="scroll-mt-28 font-sans text-note">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p id={labelId} className="min-w-0 text-ink-2">
          <span className="font-medium text-ink">Guess first: </span>
          <span className="font-serif text-base text-ink">{block.question}</span>
        </p>
        {!guessed && !skipped && (
          <span className="inline-flex flex-wrap items-center gap-2">
            {a.kind === "choice" ? (
              <>
                <label htmlFor={`${labelId}-c`} className="sr-only">
                  Your guess
                </label>
                <select
                  id={`${labelId}-c`}
                  value={option ?? ""}
                  disabled={busy}
                  onChange={(e) => setOption(e.target.value === "" ? null : Number(e.target.value))}
                  className={cn(control, "w-auto max-w-[min(100%,18rem)] min-w-0 px-2 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40")}
                >
                  <option value="">Your answer</option>
                  {a.options.map((o, i) => (
                    <option key={i} value={i}>
                      {o}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label htmlFor={`${labelId}-n`} className="sr-only">
                  Your guess{a.kind === "number" && a.unit ? `, in ${a.unit}` : ""}
                </label>
                <Input
                  id={`${labelId}-n`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={a.kind === "year" ? "Year" : "Your answer"}
                  className="h-8 w-32"
                  disabled={busy}
                  aria-invalid={text !== "" && !response}
                />
                {a.kind === "number" &&
                  a.unit &&
                  !block.question.toLowerCase().includes(a.unit.toLowerCase()) && (
                    <span className="text-ui text-ink-2">{a.unit}</span>
                  )}
                {a.kind === "year" && <EraChoice form={form} size="xs" />}
              </>
            )}
            <Button
              variant="ghost"
              size="xs"
              className="text-ink-3"
              disabled={busy}
              onClick={() =>
                form.skip(() => {
                  setText("");
                  setOption(null);
                })
              }
            >
              Skip
            </Button>
          </span>
        )}
      </div>
      {guessed ? (
        <p className="mt-0.5 text-sm text-ink-2">
          You guessed{" "}
          <span className="font-medium text-ink">{formatGuessResponse(a, guessed.response)}</span>
          {surenessPhrase(guessed.confidence) && <> ({surenessPhrase(guessed.confidence)})</>}.{" "}
          {brief ? "The summary below has the answer." : answerLine}
        </p>
      ) : skipped ? (
        <p className="mt-0.5 text-sm text-ink-3">Skipped. {brief ? null : answerLine}</p>
      ) : response ? (
        <SurenessPicker className="mt-2.5" onPick={form.submit} disabled={busy} hint="Choosing one saves your guess." />
      ) : null}
      <GuessErrors form={form} />
    </section>
  );
}

/**
 * The answer to a "Guess first" question, in a line or two: the guess, the
 * answer, and the claim that settles it one tap away.
 */
export function GuessReveal({
  block,
  view,
  selected,
  onSelect,
  embedded = false,
}: {
  block: GuessBlock;
  view: PageView;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Inside a check: no frame of its own. */
  embedded?: boolean;
}) {
  const labelId = useId();
  const { state } = usePageLearning(view.page.id);
  const [shown, setShown] = useState(false);
  const guessed = state.data?.guesses[block.id];
  const a = block.answer;
  const claim = view.claims[block.claimId];
  const brief = briefAnswers(view.page.blocks, block);
  // While the part is folded to its one-minute version, the reveal points at the summary (when the summary has it).
  const chapterId = guessPlacements(view.page.blocks).chapterOf.get(block.id) ?? "";
  const folded = useReader().partFolded?.(chapterId) === true;
  const sure =
    guessed?.confidence !== null && guessed?.confidence !== undefined && guessed.confidence >= 80;
  const verdict = guessed
    ? guessed.result.correct
      ? "Right."
      : guessed.result.close
        ? "Close."
        : null
    : null;

  const body = (
    <>
      <p id={labelId} className="font-sans text-note text-ink">
        <CircleHelp className="mr-1.5 inline size-4 -translate-y-px text-ink-3" aria-hidden />
        <span className="font-semibold">
          {guessed ? "Your guess, answered: " : "Guess first: "}
        </span>
        <span className="font-serif text-base">{block.question}</span>
      </p>
      {!guessed && !shown && !state.data?.skipped.includes(block.id) ? (
        <Button
          variant="link"
          size="xs"
          className="mt-1 px-0"
          onClick={() => setShown(true)}
          disabled={state.status === "loading"}
        >
          Show the answer
        </Button>
      ) : (
        <div aria-live="polite" className="mt-1 font-sans text-sm text-ink-2">
          <p>
            {guessed && (
              <>
                You guessed{" "}
                <span className="font-medium text-ink">
                  {formatGuessResponse(a, guessed.response)}
                </span>
                .{" "}
              </>
            )}
            {folded && brief ? (
              <>
                The answer is in the{" "}
                <a href={`#brief-${chapterId}`} className="text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo">
                  summary
                </a>
                : <span className="font-semibold text-ink">{formatGuessAnswer(a)}</span>. {verdict}
              </>
            ) : (
              <>
                The answer: <span className="font-semibold text-ink">{formatGuessAnswer(a)}</span>
                {brief ? ", as the summary above says" : ""}. {verdict}
              </>
            )}
          </p>
          {guessed && sure && !guessed.result.correct && !guessed.result.close && (
            <p className="mt-1.5 border-l-2 border-turmeric pl-3 text-ink">
              You were sure of this one. It is worth a second look.
            </p>
          )}
          {block.note && <Markdown className="mt-1">{block.note}</Markdown>}
          {claim && (
            <details className="mt-1">
              <summary className="cursor-pointer text-ink-3 hover:text-ink-2">
                The claim that answers it
              </summary>
              <ul className="-ml-4 mt-1">
                <ClaimItem claim={claim} selected={selected === claim.id} onSelect={onSelect} />
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
  if (embedded)
    return (
      <div id={revealId(block.id)} role="group" aria-labelledby={labelId} className="scroll-mt-28">
        {body}
      </div>
    );
  return (
    <Shell id={revealId(block.id)} labelId={labelId}>
      {body}
    </Shell>
  );
}
