"use client";

import type { CheckResponse, LearnResult, Sureness } from "@pramana/core";
import type { FirstSteps as FirstStepsData } from "@pramana/services";
import { CircleAlert, Compass } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState, useTransition } from "react";
import { recordFirstStepAction } from "@/app/learn/actions";
import { LINK } from "@/components/pages/Shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapAnswer, MapResult } from "./MapQuestion";
import { OrderPicker, OrderResult } from "./Order";
import { SurenessPicker, surenessPhrase } from "./Sureness";

const SKIPPED = "pramana.firstSteps.skipped";

type Answer = { response: CheckResponse; result: LearnResult; confidence: number | null };

/**
 * A guided first five minutes for a new learner: put the ages of Indian
 * history in order, then tap where Pāṭaliputra was, then see the answers with
 * links into the era pages. Guessing before reading helps even when the
 * guesses are wrong, so nothing is scored. Answers are graded on the server
 * against the ages' stored dates and the city's Wikidata point, and recorded
 * like any other answer. Skippable (remembered in this browser).
 *
 * Load `data` on the server with `firstSteps(ctx)` from @pramana/services and
 * mount only when it is not null (it is null once the learner has done
 * anything else).
 */
/** Link to a page's first part (its heading, `<chapterId>-title`), not the top of the page. */
const partLink = (slug: string, chapterId: string | null) => `/p/${slug}${chapterId ? `#${chapterId}-title` : ""}`;

export function FirstSteps({
  data,
  className,
  asResult = false,
}: {
  data: FirstStepsData;
  className?: string;
  /** Shown later, on /learn, as "Your first guesses" (no skip, no intro). */
  asResult?: boolean;
}) {
  const titleId = useId();
  const [skipped, setSkipped] = useState(false);
  const [started, setStarted] = useState(Boolean(data.answered.ages));
  const [ages, setAges] = useState<Answer | undefined>(data.answered.ages);
  const [place, setPlace] = useState<Answer | undefined>(data.answered.place);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (localStorage.getItem(SKIPPED)) setSkipped(true);
  }, []);
  if (skipped && !asResult) return null;

  const skip = () => {
    localStorage.setItem(SKIPPED, "1");
    setSkipped(true);
  };
  const answer = (step: "ages" | "place", response: CheckResponse, sureness: Sureness) =>
    start(async () => {
      const r = await recordFirstStepAction({ step, response, sureness });
      if (!r.ok) return setError(r.error);
      setError(null);
      const a = { response, result: r.data.result, confidence: r.data.confidence };
      if (step === "ages") setAges(a);
      else setPlace(a);
    });

  const ids = data.ages.map((a) => a.entityId);
  const labels = new Map(data.ages.map((a) => [a.entityId, a.label]));
  const done = Boolean(ages && (place || !data.place));
  const step = !started ? 0 : !ages ? 1 : !done ? 2 : 3;

  return (
    // Questions are cut into the page (a field); the result afterwards is laid out on the page itself.
    <section aria-labelledby={titleId} className={cn("font-sans", step < 3 && "field px-5 py-5 sm:px-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-2">
            <Compass className="size-4 text-indigo" aria-hidden />
            {/* One flex item, so the gap sits after the icon and not before the comma. */}
            <span>
              {asResult ? "Your first guesses" : "First steps"}
              {step > 0 && step < 3 && <span className="font-normal text-ink-3 tnum">, {step} of {data.place ? 2 : 1}</span>}
            </span>
          </p>
          <h2 id={titleId} className="mt-1 font-heading text-xl text-ink">
            {step === 0 ? "New to Indian history? Start with two guesses." : step === 3 ? (asResult ? "Where you started" : "Here is where your guesses stand") : step === 1 ? "Put these ages in order, earliest first." : `Where was ${data.place!.entity.label}?`}
          </h2>
        </div>
        {step < 3 && (
          <Button variant="ghost" size="sm" className="text-ink-3" onClick={skip}>
            Skip
          </Button>
        )}
      </div>

      {step === 0 && (
        <>
          <p className="mt-2 max-w-(--measure) text-note text-ink-2">
            Two quick questions before you read anything: the order of four ages, and where one great city stood. Wrong guesses are fine. Guessing first makes the answers stick when you meet them.
          </p>
          <Button className="mt-4" onClick={() => setStarted(true)}>
            Start
          </Button>
        </>
      )}

      {step === 1 && <OrderPicker ids={ids} right={[...ids]} labels={labels} hints={new Map(data.ages.map((a) => [a.entityId, a.description]))} disabled={pending} onSubmit={(order, s) => answer("ages", { kind: "order", order }, s)} />}

      {step === 2 && data.place && (
        <div className="mt-3">
          <p className="mb-3 text-note text-ink-2">It was the capital of the Maurya Empire, about 2,300 years ago. Tap the map where you think it was.</p>
          <MapAnswer pin={pin} onPin={setPin} disabled={pending} label={data.place.entity.label} />
          {pin && <SurenessPicker className="mt-4" disabled={pending} onPick={(s) => answer("place", { kind: "place", at: pin }, s)} hint="Choosing one checks your pin." />}
        </div>
      )}

      {step === 3 && ages?.response.kind === "order" && (
        <div className="mt-2" aria-live="polite">
          <p className="text-note text-ink-2">
            {ages.result.correct ? "You had the ages in the right order." : `You put ${ages.result.placed ?? 0} of ${ids.length} ages in the right place.`}
            {surenessPhrase(ages.confidence) && <span className="text-ink-3"> You said: {surenessPhrase(ages.confidence)}.</span>}
          </p>
          <OrderResult
            order={ages.result.order ?? ids}
            given={ages.response.order}
            labels={labels}
            years={new Map(data.ages.map((a) => [a.entityId, a.start]))}
            dates={new Map(data.ages.map((a) => [a.entityId, a.whenLabel]))}
          />
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {(ages.result.order ?? ids).map((id) => {
              const age = data.ages.find((a) => a.entityId === id)!;
              return (
                <li key={id}>
                  <Link href={partLink(age.pageSlug, age.firstChapterId)} className={cn(LINK, "inline-flex min-h-8 items-center text-ui")}>
                    Read {age.pageTitle}
                  </Link>
                </li>
              );
            })}
          </ul>
          {data.place && place?.response.kind === "place" && (
            <div className="mt-6">
              <p className="text-note text-ink-2">
                {place.result.distanceKm === 0
                  ? `Right on ${data.place.entity.label}.`
                  : `Your pin was about ${(place.result.distanceKm ?? 0).toLocaleString("en-GB")} km from ${data.place.entity.label}${place.result.correct ? ", close enough" : ""}.`}{" "}
                {data.place.entity.description}
              </p>
              <div className="mt-3">
                <MapResult entity={data.place.entity} pin={place.response.at} />
              </div>
              {/* Later, on /learn, the session button above is the one next step. */}
              {data.place.pageSlug && !asResult && (
                <Button
                  className="mt-4 h-auto min-h-9 w-full justify-center py-2 whitespace-normal sm:w-auto"
                  nativeButton={false}
                  render={<Link href={partLink(data.place.pageSlug, data.place.firstChapterId)} />}
                >
                  Start reading: the empire ruled from {data.place.entity.label}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-madder">
          <CircleAlert className="size-4" aria-hidden /> {error}
        </p>
      )}
    </section>
  );
}
