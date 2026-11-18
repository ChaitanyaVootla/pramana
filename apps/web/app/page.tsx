import { AtlasSpec, toAstronomicalYear } from "@pramana/core";
import {
  allDatedEntities,
  agesStrip,
  dueCards,
  firstSteps,
  firstStepsRecommendation,
  learnedToday,
  listChangesets,
  nextPart,
  pageLearning,
  getPageView,
  getProgress,
  humanContext,
  listEntities,
  listPages,
  type AgeStripItem,
  type ChangesetView,
  type ClaimCard,
  type MapFeature,
  type PageSummary,
  type PageView,
} from "@pramana/services";
import { BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";
import { LiveNotes } from "@/components/ai/LiveNotes";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { AgesExplorer, type Age, type AgeDetail, type AgeProgress } from "@/components/home/AgesExplorer";
import { AgeLine } from "@/components/time/AgeLine";
import { FirstSteps } from "@/components/learn/FirstSteps";
import { LearnedTodayLine } from "@/components/learn/LearnedToday";
import { CommonsImage, ImaginingTag } from "@/components/media";
import { Frame } from "@/components/shell/Frame";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { yearsAgo } from "@/lib/era";
import { agesOf, devanagari } from "@/lib/ages";
import { NOW, unitScale } from "@/lib/time";
import { actorName, approverName } from "@/lib/labels";
import { cn } from "@/lib/utils";

/** The atlas on the home page covers every border we have, from the Mahajanapadas to independence. */
const ATLAS = AtlasSpec.parse({
  range: [-600, 1950],
  initialYear: toAstronomicalYear(250, "BCE"),
  bounds: [61, 5, 99, 37],
});
const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
const word = (n: number) => WORDS[n] ?? String(n);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const DAY_LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

async function resumeHeading(
  ctx: Awaited<ReturnType<typeof humanContext>>,
  slug: string,
  view: PageView,
): Promise<string | null> {
  const chapters = view.page.blocks.filter((b) => b.type === "chapter").map((b) => b.id);
  if (!chapters.length) return null;
  const learning = await pageLearning(ctx, slug).catch(() => null);
  const steps = learning?.chapters ?? {};
  const id =
    chapters.find((c) => !steps[c]?.read && !steps[c]?.skimmed) ??
    chapters.find((c) => !steps[c]?.read);
  // The part's heading (#<id>-title): lands there without unfolding it.
  return id ? `${id}-title` : null;
}

/** The page's lead image, else the best picture of its subject. */
function leadImage(page: PageSummary, view: PageView) {
  return (
    (view.page.spec.hero.media ? view.media[view.page.spec.hero.media] : undefined) ??
    page.entity?.image
  );
}

/**
 * A picture from inside the page (a figure, or a gallery item) other than `not`. The featured block uses it
 * so the lead picture, which the column beside the atlas already shows, never appears twice on one screen.
 */
function insidePicture(view: PageView, not?: { originalUrl: string } | null) {
  for (const b of view.page.blocks) {
    const refs = b.type === "figure" ? [b.media] : b.type === "gallery" ? b.items.map((i) => i.media) : [];
    for (const r of refs) {
      const m = view.media[r];
      if (m && m.originalUrl !== not?.originalUrl) return m;
    }
  }
  return undefined;
}

/** What an age's page holds, for the column beside the atlas. */
function ageDetail(page: PageSummary, view: PageView): AgeDetail {
  const lead = leadImage(page, view);
  // The view keys an entity by id and by slug; count each once.
  const entities = [...new Map(Object.values(view.entities).map((e) => [e.id, e])).values()];
  const own = page.entity?.id;
  return {
    image: lead
      ? {
          originalUrl: lead.originalUrl,
          width: lead.width,
          height: lead.height,
          mime: lead.mime,
          alt: lead.alt,
          focus: lead.focus,
          attribution: lead.attribution,
          representation: lead.representation,
        }
      : null,
    people: entities
      .filter((e) => e.kind === "person")
      .slice(0, 4)
      .map((e) => ({ slug: e.slug, label: e.label })),
    places: entities
      .filter((e) => (e.kind === "place" || e.kind === "site" || e.kind === "inscription") && e.id !== own)
      .slice(0, 4)
      .map((e) => ({ slug: e.slug, label: e.label })),
    claims: Object.values(view.claims)
      .filter((c) => c.kind === "fact" && c.text.length <= 160)
      .sort((a, b) => b.level - a.level)
      .slice(0, 2)
      .map((c) => ({ id: c.id, text: c.text, level: c.level })),
  };
}

/**
 * The home page (docs/visual.md §6). It opens on the slab: the promise in one
 * line, what to do next, and one real claim with the words it rests on. Then
 * the subject itself (the age band with the year cursor and the atlas under
 * it), and the chronicle: every age in order, the written ones in full.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ "first-steps"?: string }>;
}) {
  // In development, /?first-steps shows the first steps to any learner (as /learn does).
  const showFirstSteps =
    process.env.NODE_ENV !== "production" && (await searchParams)["first-steps"] !== undefined;
  const ctx = await humanContext();
  const [pages, progress, placeCards, timeline, first, recommended, today, dueNow, learned, strip, applied] =
    await Promise.all([
      listPages(),
      getProgress(ctx),
      listEntities(["place", "site", "inscription", "event"]),
      allDatedEntities(["period", "polity", "culture", "person", "event"]),
      // A guided first question for someone who has not studied anything yet.
      firstSteps(ctx, { always: showFirstSteps }).catch(() => null),
      // After first steps: where they suggest starting, and why.
      firstStepsRecommendation(ctx).catch(() => null),
      // The next step of study (a part to read, then its check and due cards), and what was met today.
      nextPart(ctx).catch(() => null),
      dueCards(ctx, { limit: 100 }).catch(() => []),
      learnedToday(ctx).catch(() => null),
      agesStrip(ctx).catch(() => null),
      // What changed on the site lately (every change is at /audit).
      listChangesets({ status: ["applied"], limit: 8 }).catch(() => [] as ChangesetView[]),
    ]);
  const views = new Map<string, PageView>();
  await Promise.all(
    pages.map(async (p) => {
      try {
        views.set(p.slug, await getPageView(p.slug));
      } catch {
        // A page that fails to load is left off the list.
      }
    }),
  );
  const overview = pages.find((p) => p.kind === "overview");
  const eras = pages
    .filter((p) => p.kind === "era" && views.has(p.slug))
    .sort((a, b) => (a.entity?.bounds?.startMin ?? 0) - (b.entity?.bounds?.startMin ?? 0));
  const ages = agesOf(overview ? views.get(overview.slug) : undefined, pages, views);
  const pageByEntity = Object.fromEntries(
    pages.flatMap((p) => (p.entity && p.kind !== "overview" ? [[p.entity.id, p.slug]] : [])),
  );
  const places: MapFeature[] = placeCards
    .filter((p) => p.geo)
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      label: p.label,
      kind: p.kind,
      whenLabel: p.whenLabel,
      geo: p.geo!,
    }));
  // The learner's way through each written age, drawn on the band under its bar.
  const agesProgress: Record<string, AgeProgress> = Object.fromEntries(
    (strip?.ages ?? []).map((a: AgeStripItem) => [
      a.slug,
      { state: a.state, partsStudied: a.partsStudied, parts: a.parts },
    ]),
  );
  // Each written age's picture, people, places and two claims, for the column beside the atlas.
  const details: Record<string, AgeDetail> = Object.fromEntries(
    ages.flatMap((a) => {
      const page = a.page ? eras.find((p) => p.slug === a.page!.slug) : undefined;
      const view = page ? views.get(page.slug) : undefined;
      return page && view ? [[a.id, ageDetail(page, view)]] : [];
    }),
  );

  const lastRead = [...progress.pages]
    .sort((a, b) => +new Date(b.lastSeenAt) - +new Date(a.lastSeenAt))
    .find((p) => views.get(p.slug)?.page.kind === "era");
  // "Start here" follows the first steps' recommendation when there is one, else the first written age.
  const start =
    (recommended && eras.find((p) => p.slug === recommended.pageSlug)) ??
    eras.find((p) => p.status === "published") ??
    eras[0];
  // "Keep reading" goes to the first part not yet skimmed or read (else not yet read in full).
  const resumeAt = lastRead
    ? await resumeHeading(ctx, lastRead.slug, views.get(lastRead.slug)!)
    : null;
  const written = eras.length;
  // The age the learner is in (or should start with), shown large; the rest in time order.
  const featuredSlug = lastRead?.slug ?? (first ? null : (start?.slug ?? null));
  const featured = featuredSlug ? eras.find((p) => p.slug === featuredSlug) : undefined;

  // One real claim with the words it rests on, shown in the opening: the promise, demonstrated.
  const example = specimen([
    ...(featured ? [views.get(featured.slug)!] : []),
    ...eras.filter((p) => p.slug !== featured?.slug).map((p) => views.get(p.slug)!),
  ]);
  // The whole spine in time order: written ages as full rows, the rest as one quiet line each.
  const eraBySlug = new Map(eras.map((p) => [p.slug, p]));
  const spine = [...ages].sort((a, b) => a.from - b.from);
  const offSpine = eras.filter((p) => !spine.some((a) => a.page?.slug === p.slug));

  return (
    <>
      {/* ------------------------------------------------ the opening: the slab runs on from the top bar (docs/visual.md §6) */}
      <section className="on-slab">
        <Frame className={cn("grid items-end gap-x-14 gap-y-10 pt-8 pb-10 sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-16", example && "lg:grid-cols-[minmax(0,1fr)_minmax(24rem,34rem)]")}>
          <div className="min-w-0">
            <h1 className="max-w-[14ch] font-display text-5xl text-ink sm:text-6xl 2xl:text-[5.5rem] 2xl:leading-[0.94]">
              Indian history, with the evidence attached.
            </h1>
            <p className="mt-5 max-w-[52ch] font-sans text-lg text-ink-2">
              Every statement points to the exact words it rests on, in a source you can open. Where historians
              disagree, you see each reading.
            </p>
            {featured && (
              <ContinueBlock
                page={featured}
                view={views.get(featured.slug)!}
                progress={agesProgress[featured.slug]}
                today={today && today.pageSlug === featured.slug ? { ...today, cards: dueNow.length } : null}
                resume={resumeAt}
                startReason={!lastRead && recommended && recommended.pageSlug === featured.slug ? recommended.reason : null}
                startChapter={!lastRead && recommended && recommended.pageSlug === featured.slug ? recommended.chapterId : null}
                isResume={Boolean(lastRead)}
                effort={progress.effort}
                known={progress.deck.known}
                due={progress.deck.due}
              />
            )}
          </div>
          {example && <Specimen {...example} />}
        </Frame>
      </section>

      <Frame className="pt-6 pb-4 sm:pt-8">
        {/* What the learner met today, and their canvases: one quiet line under the opening. */}
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-sans text-sm text-ink-2">
          {learned && <LearnedTodayLine data={learned} />}
          <p>
            <Link href="/canvas" className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink-3">
              Your canvases: anything on the site, side by side
            </Link>
          </p>
        </div>

        {/* On a phone the line is time: every age on one compact rule, the atlas's year as the cursor.
            Wider screens have the full band with the atlas below. */}
        {ages.length > 0 && (
          <AgeLine ages={ages} mark={ATLAS.initialYear ?? null} progress={agesProgress} size="compact" className="mt-6 md:hidden" />
        )}

        {first && <FirstSteps data={first} className="mt-6" />}

        {/* ------------------------------------------------ every age, and the map through time */}
        <section aria-labelledby="ages-h" className="mt-8 sm:mt-12">
          <SectionHead id="ages-h" title="Nine thousand years on one line" aside="Pick an age to see its borders, or move the year and watch them change." />
          <div className="mt-5">
            {ages.length ? (
              <AgesExplorer
                ages={ages}
                places={places}
                timeline={timeline}
                pageByEntity={pageByEntity}
                spec={ATLAS}
                progress={agesProgress}
                details={details}
                overviewHref={overview ? `/p/${overview.slug}` : null}
              />
            ) : (
              <EmptyState
                title="No ages yet."
                action={
                  <Link href="/connect" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-3.5 text-ui")}>
                    Connect your AI
                  </Link>
                }
              >
                Ask your AI to propose the spine of Indian history, then see it under Proposed changes; the
                band and the map appear here.
              </EmptyState>
            )}
          </div>
        </section>

        {/* ------------------------------------------------ the chronicle: every age in order, the written ones in full */}
        {written > 0 && (
          <section aria-labelledby="pages-h" className="mt-14 sm:mt-20">
            <SectionHead
              id="pages-h"
              title="The ages, in order"
              aside={`${
                strip?.spine
                  ? `${capital(word(written))} of the ${strip.spine} ages ${written === 1 ? "is" : "are"} written so far`
                  : `${capital(word(written))} ${written === 1 ? "age is" : "ages are"} written so far`
              }, each a story in parts with its sources open beside it.`}
            />
            <ol className="mt-5 border-b border-rule">
              {spine.map((a, i) => {
                const page = a.page ? eraBySlug.get(a.page.slug) : undefined;
                return (
                  <li key={a.id} className="border-t border-rule">
                    {page ? (
                      <AgeRow n={i + 1} page={page} view={views.get(page.slug)!} progress={agesProgress[page.slug]} />
                    ) : (
                      <UnwrittenRow n={i + 1} age={a} />
                    )}
                  </li>
                );
              })}
              {offSpine.map((p) => (
                <li key={p.slug} className="border-t border-rule">
                  <AgeRow n={null} page={p} view={views.get(p.slug)!} progress={agesProgress[p.slug]} />
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* The study partner's latest notes, as marginalia (docs/visual.md §7); nothing when there are none. */}
        <LiveNotes recent limit={3} layout="row" className="mt-14 sm:mt-20" />

        {/* ------------------------------------------------ what changed lately (every change is at /audit) */}
        {applied.length > 0 && (
          <section aria-labelledby="changes-h" className="mt-14 font-sans sm:mt-20">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="changes-h" className="text-2xl text-ink">
                What changed lately
              </h2>
              <Link href="/audit" className="text-sm text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink-3">
                Every change
              </Link>
            </div>
            <RecentChanges items={applied.slice(0, 6)} />
          </section>
        )}
      </Frame>
    </>
  );
}

/** A section's head: the title, with one sentence of explanation on the same baseline at the right. */
function SectionHead({ id, title, aside }: { id: string; title: string; aside?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-1">
      <h2 id={id} className="text-3xl text-ink sm:text-4xl">
        {title}
      </h2>
      {aside && <p className="max-w-[52ch] font-sans text-note text-ink-2">{aside}</p>}
    </div>
  );
}

interface SpecimenData {
  claim: { id: string; text: string; level: ClaimCard["level"] };
  quote: string;
  source: string;
  locator: string;
  page: { slug: string; title: string };
}

/**
 * Picks the claim shown in the opening: a short statement of fact whose quote
 * was found word for word in the stored copy of its source. The best checked
 * wins, then the nearest to the events (a primary source before a later one).
 * Deterministic, so the opening does not change between visits.
 */
function specimen(views: PageView[]): SpecimenData | null {
  let best: SpecimenData | null = null;
  let bestScore = -1;
  for (const view of views) {
    for (const c of Object.values(view.claims)) {
      if (c.kind !== "fact" || c.text.length > 150 || c.level < 2) continue;
      for (const cit of c.citations) {
        const quote = cit.excerpt.quote?.trim();
        const status = cit.excerpt.verification.status;
        if (!quote || quote.length < 40 || quote.length > 240 || cit.stance !== "supports") continue;
        if (status !== "exact" && status !== "human_attested") continue;
        const tier = cit.excerpt.source.tier;
        const score = c.level * 10 + (tier === "primary" ? 6 : tier === "secondary" ? 3 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = {
            claim: { id: c.id, text: c.text, level: c.level },
            quote,
            source: cit.excerpt.source.short || cit.excerpt.source.title,
            locator: cit.excerpt.locatorLabel,
            page: { slug: view.page.slug, title: view.page.title },
          };
        }
      }
    }
  }
  return best;
}

/**
 * The promise, shown rather than said: one claim from the site, the words it
 * rests on cut into a field under it, and where those words are. The line
 * between them is the chain of evidence in miniature (the claim page draws it
 * in full).
 */
function Specimen({ claim, quote, source, locator, page }: SpecimenData) {
  return (
    <aside aria-labelledby="specimen-h" className="min-w-0 font-sans">
      <p id="specimen-h" className="text-ui text-ink-3">
        One claim from {page.title}, and what it rests on
      </p>
      <ol className="mt-3">
        <li className="relative pb-5 pl-7">
          <span className="absolute top-2 left-0 size-2.5 rounded-full bg-ink" aria-hidden />
          <span className="absolute top-5 bottom-0 left-[4.5px] w-px bg-rule" aria-hidden />
          <p className="font-heading text-xl leading-snug text-ink sm:text-2xl sm:leading-snug">{claim.text}</p>
        </li>
        <li className="relative pb-5 pl-7">
          <span className="absolute top-2 left-0 size-2.5 rounded-full border-2 border-ink" aria-hidden />
          <span className="absolute top-5 bottom-0 left-[4.5px] w-px bg-rule" aria-hidden />
          <p className="text-sm text-ink-3">The words, as the source has them</p>
          <blockquote className="field mt-1.5 px-4 py-3 font-serif text-base leading-relaxed text-ink">
            “{quote}”
          </blockquote>
        </li>
        <li className="relative pl-7">
          <span className="absolute top-1.5 left-0 size-2.5 rounded-full border-2 border-ink" aria-hidden />
          <p className="text-ui text-ink-2">
            {source}
            {locator ? `, ${locator}` : ""}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui">
            <EvidenceSeal level={claim.level} />
            <Link href={`/c/${claim.id}`} className="text-ink underline decoration-ink-3 underline-offset-4 hover:decoration-ink">
              Follow the whole chain
            </Link>
          </p>
        </li>
      </ol>
    </aside>
  );
}

/**
 * What is next, under the opening's headline (docs/visual.md §6): the age the
 * learner is in, or should start with, where they stand in one line, and two
 * buttons. On the slab, so the filled button is white.
 */
function ContinueBlock({
  page,
  view,
  progress,
  today,
  resume,
  startReason,
  startChapter,
  isResume,
  effort,
  known,
  due,
}: {
  page: PageSummary;
  view: PageView;
  progress?: AgeProgress;
  /** The next step of study on this page, run as a session at /learn/today. */
  today: {
    title: string;
    number: number;
    pageSlug: string;
    chapterId: string;
    cards: number;
  } | null;
  /** The part to land on (its heading id). */
  resume: string | null;
  /** Why this page, from the first steps ("Your pin was about 1,056 km from Pāṭaliputra…"). */
  startReason: string | null;
  startChapter: string | null;
  isResume: boolean;
  effort: { partsRead: number; partsSkimmed: number; guesses: number; reviews: number; seen: number };
  known: number;
  /** Cards due now, across the deck. */
  due: number;
}) {
  const n = view.stats.claims;
  const parts = view.page.blocks.filter((b) => b.type === "chapter").length;
  const firstPart = startChapter ?? view.page.blocks.find((b) => b.type === "chapter")?.id;
  const button = cn(buttonVariants({ size: "lg" }), "h-auto min-h-11 max-w-full shrink py-2 text-left whitespace-normal");
  const outline = cn(buttonVariants({ variant: "outline", size: "lg" }), "border-rule bg-transparent hover:bg-rule-soft");
  // One line of standing, not a run of counters: how far through this age, and how much is remembered ("remembered" counts only cards seen).
  const standing = [
    progress && progress.parts > 0 ? `${progress.partsStudied} of ${progress.parts} parts studied` : parts > 0 ? `${parts} parts` : "",
    effort.seen > 0 ? `${known} of ${effort.seen} cards remembered` : "",
  ].filter(Boolean);
  return (
    <aside aria-labelledby="continue-h" className="mt-8 min-w-0 border-t border-rule pt-5 font-sans sm:mt-10">
      <p id="continue-h" className="text-note text-ink-2">
        {isResume ? "You are reading" : "Start with"}{" "}
        <Link href={`/p/${page.slug}`} className="font-medium text-ink underline decoration-ink-3 underline-offset-4 hover:decoration-ink">
          {page.title}
        </Link>
        <span className="text-ink-3 tnum">
          {page.entity?.whenLabel ? `, ${page.entity.whenLabel}` : ""}
          {standing.length ? `. ${capital(standing.join(", "))}.` : "."}
        </span>
      </p>
      {startReason && <p className="mt-1.5 max-w-[60ch] text-note leading-snug text-ink-2">{startReason}</p>}
      {isResume && progress && progress.parts > 0 && (
        <div className="mt-3 h-1 max-w-md overflow-hidden rounded-full bg-rule-soft" aria-hidden>
          <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round((progress.partsStudied / progress.parts) * 100)}%` }} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2.5">
        {isResume ? (
          <>
            <Link href={today ? "/learn/today" : "/learn"} className={button}>
              <GraduationCap className="size-[18px] shrink-0" aria-hidden />
              <span className="min-w-0">
                {today ? (
                  <>
                    Continue today’s session
                    <span className="block text-sm font-normal">
                      Part {today.number}, {today.title}
                      {today.cards ? `, then ${today.cards} ${today.cards === 1 ? "card" : "cards"}` : ""}
                    </span>
                  </>
                ) : due > 0 ? (
                  `Review ${due} ${due === 1 ? "card" : "cards"}`
                ) : (
                  "Your reviews"
                )}
              </span>
            </Link>
            {today ? (
              <Link href={`/p/${today.pageSlug}#${today.chapterId}-title`} className={outline}>
                <BookOpen className="size-[18px]" aria-hidden /> Read only Part {today.number}
              </Link>
            ) : (
              <Link href={`/p/${page.slug}${resume ? `#${resume}` : ""}`} className={outline}>
                <BookOpen className="size-[18px]" aria-hidden /> Keep reading
              </Link>
            )}
          </>
        ) : (
          <>
            <Link href={`/p/${page.slug}${firstPart ? `#${firstPart}-title` : ""}`} className={button}>
              <BookOpen className="size-[18px]" aria-hidden /> Read the page
            </Link>
            {n > 0 && (
              <Link href="/learn" className={outline}>
                Quiz me on it
              </Link>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/**
 * A written age as a row of the chronicle (docs/visual.md §6): its place in
 * the spine and its dates, then its title and one line of story, a picture
 * from inside its page, and what it holds with how far the learner has got.
 * The whole row is one link.
 */
function AgeRow({ n, page, view, progress }: { n: number | null; page: PageSummary; view: PageView; progress?: AgeProgress }) {
  const lead = leadImage(page, view);
  const picture = insidePicture(view, lead) ?? lead;
  const deva = devanagari(page.entity);
  const claims = view.stats.claims;
  const found = claims - (view.stats.byLevel[0] ?? 0) - (view.stats.byLevel[1] ?? 0);
  const human = view.stats.byLevel[4] ?? 0;
  const parts = view.page.blocks.filter((b) => b.type === "chapter").length;
  const ago = yearsAgo(page.entity?.bounds);
  const studied = progress && progress.state !== "untouched" && progress.parts > 0 ? progress : undefined;
  return (
    <Link
      href={`/p/${page.slug}`}
      aria-label={`${page.title}: open the page`}
      className="group -mx-3 grid grid-cols-[minmax(0,1fr)_4.5rem] items-start gap-x-4 gap-y-2 rounded-md px-3 py-5 no-underline transition-colors hover:bg-paper sm:grid-cols-[minmax(0,1fr)_11rem] md:grid-cols-[11rem_minmax(0,1fr)_13rem] md:gap-x-8 xl:grid-cols-[13rem_minmax(0,1fr)_14rem_16rem] xl:py-6"
    >
      <span className="col-span-2 flex items-baseline gap-3 font-sans md:col-span-1 md:block">
        {n !== null && <span className="text-sm text-ink-3 tnum md:block">{String(n).padStart(2, "0")}</span>}
        <span className="font-heading text-lg text-ink tnum md:mt-1 md:block md:text-xl">{page.entity?.whenLabel}</span>
        {ago && <span className="text-sm text-ink-3 md:mt-0.5 md:block">{ago}</span>}
      </span>
      <span className="min-w-0">
        <span className="block font-heading text-2xl leading-tight text-ink transition-colors group-hover:text-indigo sm:text-3xl">
          {page.title}
          {deva && (
            <span lang="hi" className="ml-2.5 text-[0.82em] text-ink-3">
              {deva}
            </span>
          )}
        </span>
        {page.summary && <span className="mt-2 block max-w-[62ch] font-serif text-base leading-normal text-ink-2 max-sm:hidden">{page.summary}</span>}
        <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm text-ink-3 max-sm:hidden xl:hidden">
          <EvidenceSeal level={human === claims && claims > 0 ? 4 : found === claims && claims > 0 ? 2 : 1} />
          <span className="tnum">
            {parts > 0 ? `${parts} parts, ` : ""}
            {claims} claims
            {studied ? `, ${studied.partsStudied} of ${studied.parts} studied` : ""}
          </span>
        </span>
      </span>
      <span className="relative block aspect-square overflow-hidden rounded-md bg-field sm:aspect-[16/10]">
        {picture ? (
          <>
            <CommonsImage file={picture} fill sizes="(min-width: 768px) 14rem, 11rem" decorative />
            <ImaginingTag representation={picture.representation} className="absolute top-1.5 left-1.5 max-sm:hidden" />
          </>
        ) : (
          <PeriodBand bounds={page.entity?.bounds ?? null} className="h-full" compact />
        )}
      </span>
      {/* Phones: the story and the counts run the full width under the title and its picture. */}
      <span className="col-span-2 min-w-0 sm:hidden">
        {page.summary && <span className="block font-serif text-base leading-normal text-ink-2">{page.summary}</span>}
        <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm text-ink-3">
          <EvidenceSeal level={human === claims && claims > 0 ? 4 : found === claims && claims > 0 ? 2 : 1} />
          <span className="tnum">
            {parts > 0 ? `${parts} parts, ` : ""}
            {claims} claims
            {studied ? `, ${studied.partsStudied} of ${studied.parts} studied` : ""}
          </span>
        </span>
      </span>
      <span className="hidden min-w-0 font-sans text-sm text-ink-2 xl:block">
        <span className="flex items-center gap-2.5">
          <EvidenceSeal level={human === claims && claims > 0 ? 4 : found === claims && claims > 0 ? 2 : 1} />
          <span className="tnum">
            {parts > 0 ? `${parts} parts, ` : ""}
            {claims} claims
          </span>
        </span>
        {studied ? (
          <>
            <span className="mt-3 block h-1 w-full overflow-hidden rounded-full bg-rule" aria-hidden>
              <span className="block h-full rounded-full bg-indigo" style={{ width: `${Math.round((studied.partsStudied / studied.parts) * 100)}%` }} />
            </span>
            <span className="mt-1.5 block text-ink-3 tnum">
              {studied.partsStudied} of {studied.parts} parts studied
            </span>
          </>
        ) : (
          <span className="mt-2 block text-ink-3">Not started</span>
        )}
      </span>
    </Link>
  );
}

/** An age with no page yet: one quiet line in its place in the chronicle, linked to what is known of it. */
function UnwrittenRow({ n, age }: { n: number; age: Age }) {
  return (
    <Link
      href={`/e/${age.slug}`}
      className="group -mx-3 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 rounded-md px-3 py-3 font-sans no-underline transition-colors hover:bg-paper md:grid-cols-[11rem_minmax(0,1fr)_auto] md:gap-x-8 xl:grid-cols-[13rem_minmax(0,1fr)_auto]"
    >
      <span className="hidden items-baseline gap-3 text-sm text-ink-3 tnum md:flex">
        <span>{String(n).padStart(2, "0")}</span>
        <span>{age.whenLabel}</span>
      </span>
      <span className="min-w-0 text-note text-ink-2 group-hover:text-ink">
        {age.label}
        <span className="ml-2 text-sm text-ink-3 tnum md:hidden">{age.whenLabel}</span>
      </span>
      <span className="text-sm text-ink-3">Not written yet</span>
    </Link>
  );
}

/** Applied changes, grouped by day, each by its own title. */
function RecentChanges({ items }: { items: ChangesetView[] }) {
  const byDay = new Map<string, ChangesetView[]>();
  for (const c of items) {
    const d = DAY_LONG.format(new Date(c.decidedAt ?? c.createdAt));
    byDay.set(d, [...(byDay.get(d) ?? []), c]);
  }
  return (
    <div className="mt-3 grid gap-x-10 gap-y-5 border-t border-rule pt-4 sm:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]">
      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="min-w-0">
          <p className="text-sm text-ink-3">{day}</p>
          <ul className="mt-1">
            {list.map((c) => (
              <li key={c.id} className="flex min-h-9 items-baseline gap-3 border-b border-rule py-2 last:border-b-0">
                <span className="w-12 shrink-0 text-sm text-ink-3 tnum">
                  {new Date(c.decidedAt ?? c.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0 text-note text-ink">
                  {c.title}
                  <span className="block text-sm text-ink-3">
                    {actorName(c.author).replace(/^\w/, (l) => l.toUpperCase())}
                    {c.onBehalfOf ? ` for ${c.onBehalfOf.displayName}` : ""}
                    {c.decidedBy ? `, approved by ${approverName(c.decidedBy, c.delegated)}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** No picture yet: where the age sits in the whole of Indian history, as a quiet band. */
function PeriodBand({
  bounds,
  className,
  compact = false,
}: {
  bounds: { startMin: number | null; endMax: number | null } | null;
  className?: string;
  compact?: boolean;
}) {
  if (bounds?.startMin == null) return null;
  const u = unitScale("stretched", -6999, NOW);
  const a = u(bounds.startMin) * 100;
  const b = u(bounds.endMax ?? bounds.startMin + 1) * 100;
  return (
    <div className={cn("relative overflow-hidden bg-field px-4", compact ? "px-2" : "h-14", className)} aria-hidden>
      <div className={cn("absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-rule", compact ? "inset-x-2" : "inset-x-4")}>
        <div className="absolute inset-y-0 rounded-full bg-indigo" style={{ left: `${a}%`, width: `max(${b - a}%, 4px)` }} />
      </div>
      {!compact && (
        <div className="absolute inset-x-4 bottom-1.5 flex justify-between font-sans text-xs text-ink-3">
          <span>7000 BCE</span>
          <span>now</span>
        </div>
      )}
    </div>
  );
}
