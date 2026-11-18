"use client";

import { chronologicalOrder, claimIdsInBlock, claimIdsInCheckItem, dateBounds, extractLinks, groundedAnswer, type CheckItem, type CheckResponse, type Sureness } from "@pramana/core";
import type { CheckItemState, ClaimCard, PageView } from "@pramana/services";
import { Check as CheckIcon, CircleAlert, ListChecks, RotateCcw, X } from "lucide-react";
import { useId, useMemo, useState, useTransition } from "react";
import { addChapterToDeckAction, recordCheckAnswerAction } from "@/app/learn/actions";
import { useReader } from "@/components/chips/reader";
import { ClaimItem } from "@/components/era/ClaimItem";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { GuessReveal } from "./Guess";
import { MapAnswer, MapResult } from "./MapQuestion";
import { OrderPicker, OrderResult } from "./Order";
import { briefAnswers, guessPlacements, type CheckBlock, type GuessBlock } from "./placement";
import { usePageLearning } from "./store";
import { SurenessPicker, surenessPhrase } from "./Sureness";

interface Ctx {
  block: CheckBlock;
  view: PageView;
  selected: string | null;
  onSelect: (id: string) => void;
}

/**
 * The end-of-chapter retrieval check, folded into one row ("Check yourself:
 * 3 questions, about a minute") until the learner starts it; then one question
 * at a time, with "How sure are you?" once they have an answer and before it
 * is revealed. Answers are graded by the server against the stored claims
 * (dates) and entities (coordinates); recall is graded by the learner against
 * the claim. Once something is answered, "Add to my reviews" hands the claims
 * to the FSRS deck. The answer to the chapter's guess sits in the row too.
 */
export function CheckView({
  block,
  view,
  selected,
  onSelect,
  guesses,
  skimOnly = false,
  quiet = false,
}: Ctx & {
  guesses: GuessBlock[];
  /** Ask only what the part's summary answers (as when the part is folded). */
  skimOnly?: boolean;
  /** Under a part's summary: one plain line until started, a field only once open. */
  quiet?: boolean;
}) {
  const labelId = useId();
  const panelId = useId();
  const { state, update } = usePageLearning(view.page.id);
  const [pending, start] = useTransition();
  const [deckMsg, setDeckMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const all = block.items.filter((i) => askable(i, view));
  // A part folded to its one-minute version asks only what that summary answers.
  const chapterOf = guessPlacements(view.page.blocks).chapterOf.get(block.id) ?? "";
  const folded = useReader().partFolded?.(chapterOf) === true || skimOnly;
  const chapterHead = view.page.blocks.find((b) => b.id === chapterOf);
  const brief = chapterHead?.type === "chapter" ? chapterHead.brief : undefined;
  const items = folded && brief ? all.filter((i) => answerableFromBrief(i, brief, view)) : all;
  const later = all.length - items.length;
  // "Add this part": every claim in the chapter, not only those the check asks about.
  const placements = guessPlacements(view.page.blocks);
  const claimIds = [
    ...new Set(view.page.blocks.filter((b) => placements.chapterOf.get(b.id) === chapterOf).flatMap(claimIdsInBlock)),
  ].filter((id) => view.claims[id]);
  const inDeck = new Set(state.data?.inDeck ?? []);
  const missing = claimIds.filter((id) => !inDeck.has(id));
  const done = state.data?.checks[block.id] ?? {};
  const answered = items.filter((i) => done[i.id]);
  const right = answered.filter((i) => done[i.id]!.result.correct).length;
  // The why is said once per page, at the first check.
  const firstOnPage = view.page.blocks.find((b) => b.type === "check")?.id === block.id;
  // Each check is a landmark, so its name says which part it belongs to.
  const chapterBlock = chapterHead;
  const chapterTitle = chapterBlock?.type === "chapter" ? chapterBlock.title : null;
  // A guess the part's summary answers is answered there (once guessed or skipped), so the row leaves it out.
  // While folded, the guess card above already gives the answer or says where it is, so the row does not repeat it.
  const shownGuesses = folded
    ? []
    : guesses.filter((g) => !briefAnswers(view.page.blocks, g) || state.data?.guesses[g.id] || state.data?.skipped.includes(g.id));
  if (!items.length && !shownGuesses.length && !later) return null;
  // The quiet line has nothing to start until the whole part is read.
  if (quiet && !items.length && !shownGuesses.length) return null;

  const minutes = Math.max(1, Math.round((items.length * 25) / 60));
  const begin = () => {
    const next = items.findIndex((i) => !done[i.id]);
    setIndex(next >= 0 ? next : 0);
    setOpen(true);
  };
  const addToDeck = () =>
    start(async () => {
      const r = await addChapterToDeckAction(view.page.id, chapterOf);
      if (!r.ok) return setDeckMsg(r.error);
      update((d) => ({ ...d, inDeck: [...new Set([...d.inDeck, ...claimIds])] }));
      setDeckMsg(r.data.added ? `Added ${r.data.added} to your reviews.` : "Already in your reviews.");
    });
  const item = items[index];

  return (
    <section id={block.id} aria-label={chapterTitle ? `Check yourself: ${chapterTitle}` : undefined} aria-labelledby={chapterTitle ? undefined : labelId} className={cn("scroll-mt-28", quiet && !open ? "py-0.5" : "field px-4 py-3")}>
      {items.length === 0 && later > 0 && (
        <p className="font-sans text-sm text-ink-3">
          <ListChecks className="mr-1.5 inline size-4 -translate-y-px text-ink-3" aria-hidden />
          {later === 1 ? "One question" : `${later} questions`} for after you have read the whole part.
        </p>
      )}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-sans">
          <h3 id={labelId} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 font-sans text-note">
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <ListChecks className="size-4 text-indigo" aria-hidden /> {block.title ?? "Check yourself"}
            </span>
            <span className="text-sm text-ink-3 tnum">
              {items.length === 1 ? "1 question" : `${items.length} questions`}, about {minutes === 1 ? "a minute" : `${minutes} minutes`}
              {answered.length > 0 && `; ${right} of ${answered.length} answered right`}
              {later > 0 && `; ${later} more after the whole part`}
            </span>
          </h3>
          <Button
            variant={open ? "ghost" : "outline"}
            size={quiet ? "xs" : "sm"}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => (open ? setOpen(false) : begin())}
          >
            {open ? "Close" : answered.length === 0 ? "Start" : answered.length < items.length ? "Continue" : "Look again"}
          </Button>
        </div>
      )}

      {shownGuesses.length > 0 && (
        <div className={cn("space-y-2", items.length > 0 && "mt-3 border-t border-rule-soft pt-3")}>
          {shownGuesses.map((g) => (
            <GuessReveal key={g.id} block={g} view={view} selected={selected} onSelect={onSelect} embedded />
          ))}
        </div>
      )}

      {open && item && (
        <div id={panelId} className="mt-3 border-t border-rule-soft pt-4">
          {firstOnPage && <p className="mb-3 font-sans text-sm text-ink-3">Without looking back. Trying to remember is what makes it stay.</p>}
          <div role="group" aria-label={`Question ${index + 1} of ${items.length}`}>
            <p className="font-sans text-xs font-medium text-ink-3 tnum">
              {index + 1} of {items.length}
            </p>
            <Question
              key={item.id}
              item={item}
              block={block}
              view={view}
              selected={selected}
              onSelect={onSelect}
              next={index < items.length - 1 ? { label: "Next question", go: () => setIndex((i) => i + 1) } : { label: "Done", go: () => setOpen(false) }}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-2 font-sans">
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Previous
            </Button>
            {!done[item.id] && (
              <Button variant="ghost" size="sm" className="text-ink-3" onClick={() => (index < items.length - 1 ? setIndex((i) => i + 1) : setOpen(false))}>
                {index < items.length - 1 ? "Skip this one" : "Close"}
              </Button>
            )}
          </div>
        </div>
      )}

      {answered.length > 0 && claimIds.length > 0 && state.status === "ready" && (!quiet || open) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-rule-soft pt-3 font-sans text-sm text-ink-2">
          {missing.length > 0 ? (
            <>
              <Button variant="secondary" size="sm" onClick={addToDeck} disabled={pending}>
                Add this part to my reviews
              </Button>
              <span>
                {missing.length} more {missing.length === 1 ? "claim" : "claims"}; what you answered is in already.
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1.5">
              <CheckIcon className="size-4 text-ink-2" aria-hidden /> {deckMsg ?? "This part is in your reviews."}
            </span>
          )}
          {deckMsg && missing.length > 0 && <span role="status">{deckMsg}</span>}
        </div>
      )}
    </section>
  );
}

/** Whether the part's one-minute summary answers a check item: its claims are linked there, or its place is named. */
function answerableFromBrief(item: CheckItem, brief: { happened: string; howWeKnow: string }, view: PageView): boolean {
  const md = `${brief.happened}\n${brief.howWeKnow}`;
  const links = extractLinks(md);
  const claims = new Set(links.filter((l) => l.scheme === "claim").map((l) => l.target));
  if (item.kind === "recall") return claims.has(item.claimId);
  if (item.kind === "order") return item.items.every((x) => claims.has(x.claimId));
  const e = view.entities[item.entity];
  if (!e) return false;
  return links.some((l) => l.scheme === "entity" && (l.target === e.slug || l.target === e.id)) || md.normalize("NFC").includes(e.label.normalize("NFC"));
}

/** Items the page has the data to grade: a prompt to recall, dated claims to order, a place with coordinates. */
function askable(item: CheckItem, view: PageView): boolean {
  if (item.kind === "recall") return Boolean(view.claims[item.claimId] && (item.prompt ?? view.claims[item.claimId]!.learning?.prompt));
  if (item.kind === "order") return "order" in rightOrder(item, view);
  return Boolean(view.entities[item.entity]?.geo);
}

function rightOrder(item: Extract<CheckItem, { kind: "order" }>, view: PageView) {
  return chronologicalOrder(
    item.items.map((x) => {
      const when = view.claims[x.claimId]?.when;
      return { claimId: x.claimId, bounds: when ? dateBounds(when) : null };
    }),
  );
}

function Question({ item, next, ...ctx }: Ctx & { item: CheckItem; next: { label: string; go: () => void } }) {
  const { state, update } = usePageLearning(ctx.view.page.id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [again, setAgain] = useState(false);
  // Kept here, not in the question, so what the learner wrote survives the answer being recorded.
  const [notes, setNotes] = useState("");
  const latest = state.data?.checks[ctx.block.id]?.[item.id];
  const done = latest && !again ? latest : null;

  const submit = (response: CheckResponse, sureness: Sureness) =>
    start(async () => {
      const r = await recordCheckAnswerAction({ page: ctx.view.page.id, blockId: ctx.block.id, itemId: item.id, response, sureness });
      if (!r.ok) return setError(r.error);
      setError(null);
      setAgain(false);
      update((d) => {
        const prev = d.checks[ctx.block.id] ?? {};
        const attempts = (prev[item.id]?.attempts ?? 0) + 1;
        const chapter = guessPlacements(ctx.view.page.blocks).chapterOf.get(ctx.block.id);
        return {
          ...d,
          checks: { ...d.checks, [ctx.block.id]: { ...prev, [item.id]: { response, result: r.data.result, confidence: r.data.confidence, attempts, at: new Date() } } },
          chapters: chapter && d.chapters[chapter] ? { ...d.chapters, [chapter]: { ...d.chapters[chapter]!, checked: true } } : d.chapters,
          // The server adds the claims behind an answered question to the reviews.
          inDeck: [...new Set([...d.inDeck, ...claimIdsInCheckItem(item)])],
        };
      });
    });

  const disabled = pending || state.status !== "ready";
  const attemptKey = `${latest?.attempts ?? 0}-${again}`;
  return (
    <div className="mt-1">
      {/* Keyed by attempt, so "Try again" starts from a clean question. */}
      {item.kind === "recall" && (
        <Recall key={attemptKey} item={item} {...ctx} done={done} disabled={disabled} onSubmit={submit} notes={notes} setNotes={setNotes} />
      )}
      {item.kind === "order" && <Order key={attemptKey} item={item} {...ctx} done={done} disabled={disabled} onSubmit={submit} />}
      {item.kind === "place" && <Place key={attemptKey} item={item} {...ctx} done={done} disabled={disabled} onSubmit={submit} />}
      {/* Once answered, the way on is the main button, right under the verdict; trying again is secondary. */}
      {done && (
        <div className="mt-3 flex flex-wrap items-center gap-2 font-sans">
          <Button size="sm" onClick={next.go} autoFocus>
            {next.label}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-ink-3"
            onClick={() => {
              setNotes("");
              setAgain(true);
            }}
          >
            <RotateCcw aria-hidden /> Try again
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 font-sans text-sm text-madder">
          <CircleAlert className="size-4" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}

type Done = CheckItemState | null;
interface Answering<K extends CheckItem["kind"]> extends Ctx {
  item: Extract<CheckItem, { kind: K }>;
  done: Done;
  disabled: boolean;
  onSubmit: (r: CheckResponse, s: Sureness) => void;
}

function Verdict({ correct, children, confidence }: { correct: boolean; children?: React.ReactNode; confidence: number | null }) {
  const sure = confidence !== null && confidence >= 80;
  return (
    <div aria-live="polite" className="mt-3 font-sans text-note">
      <p className="flex items-start gap-1.5 text-ink">
        {correct ? <CheckIcon className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />}
        <span>
          {children}
          {surenessPhrase(confidence) && <span className="text-ink-3"> You said: {surenessPhrase(confidence)}.</span>}
        </span>
      </p>
      {!correct && sure && <p className="mt-2 border-l-2 border-turmeric pl-3 text-ink">You were sure of this one. It is worth a second look.</p>}
    </div>
  );
}

function ClaimList({ ids, view, selected, onSelect }: { ids: string[]; view: PageView; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="-ml-4 mt-2">
      {ids.map((id) => (
        <ClaimItem key={id} claim={view.claims[id]} selected={selected === id} onSelect={onSelect} />
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ recall

function Recall({
  item,
  view,
  selected,
  onSelect,
  done,
  disabled,
  onSubmit,
  notes,
  setNotes,
}: Answering<"recall"> & { notes: string; setNotes: (s: string) => void }) {
  const claim = view.claims[item.claimId] as ClaimCard;
  const prompt = item.prompt ?? claim.learning?.prompt ?? "";
  const answer = groundedAnswer(claim.learning, claim.text);
  const [ready, setReady] = useState(false);
  const [sureness, setSureness] = useState<Sureness | null>(null);
  const noteId = useId();
  const shown = done !== null || sureness !== null;
  return (
    <>
      <p className="font-serif text-lg leading-snug text-ink">{prompt}</p>
      {!shown && (
        <div className="mt-3 space-y-3">
          <label htmlFor={noteId} className="sr-only">
            Your answer
          </label>
          <Textarea id={noteId} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Type your answer, just for you" className="bg-paper font-sans" />
          {notes.trim() || ready ? (
            <SurenessPicker onPick={setSureness} disabled={disabled} hint="Choose one to see the answer." />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setReady(true)}>
              I have an answer in mind
            </Button>
          )}
        </div>
      )}
      {shown && (
        <div className="mt-3">
          {notes.trim() && (
            <div className="mb-3 font-sans text-sm">
              <p className="font-medium text-ink-2">You wrote</p>
              <p className="mt-0.5 whitespace-pre-wrap text-ink">{notes}</p>
            </div>
          )}
          <p className="font-sans text-sm font-medium text-ink-2">The answer</p>
          {answer && answer !== claim.text && <p className="mt-0.5 text-base text-ink">{answer}</p>}
          <ClaimList ids={[claim.id]} view={view} selected={selected} onSelect={onSelect} />
          {done ? (
            <Verdict correct={done.result.correct} confidence={done.confidence}>
              {done.result.correct ? "You had it." : "Not this time."}
            </Verdict>
          ) : (
            <fieldset className="mt-3 font-sans">
              <legend className="text-ui text-ink">Did you have it?</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" disabled={disabled} onClick={() => onSubmit({ kind: "recall", recalled: true }, sureness!)}>
                  <CheckIcon aria-hidden /> I had it
                </Button>
                <Button variant="outline" disabled={disabled} onClick={() => onSubmit({ kind: "recall", recalled: false }, sureness!)}>
                  <X aria-hidden /> Not quite
                </Button>
              </div>
            </fieldset>
          )}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------- order

function Order({ item, view, selected, onSelect, done, disabled, onSubmit }: Answering<"order">) {
  const right = rightOrder(item, view);
  const order = useMemo(() => ("order" in right ? right.order : []), [right]);
  const ids = useMemo(() => item.items.map((x) => x.claimId), [item]);
  const labels = new Map(item.items.map((x) => [x.claimId, x.label]));
  const prompt = <p className="font-serif text-lg leading-snug text-ink">{item.prompt ?? "Put these in order, earliest first."}</p>;
  if (done && done.response.kind === "order") {
    const years = new Map(ids.map((id) => {
      const when = view.claims[id]?.when;
      return [id, (when ? dateBounds(when).startMin : null) ?? 0] as const;
    }));
    const dates = new Map(ids.map((id) => [id, view.claims[id]?.whenLabel ?? null] as const));
    return (
      <>
        {prompt}
        <OrderResult order={order} given={done.response.order} labels={labels} years={years} dates={dates} />
        <Verdict correct={done.result.correct} confidence={done.confidence}>
          {done.result.correct ? "All in the right order." : `${done.result.placed ?? 0} of ${order.length} in the right place.`}
        </Verdict>
        <details className="mt-2 font-sans text-sm text-ink-3">
          <summary className="cursor-pointer hover:text-ink-2">The claims these dates come from</summary>
          <ClaimList ids={order} view={view} selected={selected} onSelect={onSelect} />
        </details>
      </>
    );
  }
  return (
    <>
      {prompt}
      <OrderPicker ids={ids} right={order} labels={labels} disabled={disabled} onSubmit={(o, s) => onSubmit({ kind: "order", order: o }, s)} />
    </>
  );
}

// ------------------------------------------------------------------- place

function Place({ item, view, done, disabled, onSubmit }: Answering<"place">) {
  const entity = view.entities[item.entity]!;
  const [pin, setPin] = useState<[number, number] | null>(null);
  const prompt = item.prompt ?? `Where was ${entity.label}? Tap the map.`;
  if (done && done.response.kind === "place") {
    const km = done.result.distanceKm ?? 0;
    return (
      <>
        <p className="font-serif text-lg leading-snug text-ink">{prompt}</p>
        <div className="mt-3">
          <MapResult entity={entity} pin={done.response.at} />
        </div>
        <Verdict correct={done.result.correct} confidence={done.confidence}>
          {km === 0 ? "Right on it." : `Your pin was about ${km.toLocaleString("en-GB")} km from ${entity.label}.`} {done.result.correct ? "Close enough." : ""}
        </Verdict>
        {entity.geo?.certainty !== "exact" && (
          <p className="mt-1 font-sans text-sm text-ink-3">
            The point is {entity.geo?.certainty === "conjectural" ? "a scholarly reconstruction" : "approximate"}
            {entity.wikidataId ? ", from Wikidata" : ""}, so anything within {item.toleranceKm} km counts.
          </p>
        )}
      </>
    );
  }
  return (
    <>
      <p className="font-serif text-lg leading-snug text-ink">{prompt}</p>
      <div className="mt-3">
        <MapAnswer pin={pin} onPin={setPin} disabled={disabled} label={entity.label} />
      </div>
      {pin && <SurenessPicker className="mt-4" onPick={(s) => onSubmit({ kind: "place", at: pin }, s)} disabled={disabled} hint="Choosing one checks your pin." />}
    </>
  );
}
