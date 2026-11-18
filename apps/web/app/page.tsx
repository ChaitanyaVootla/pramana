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
  type MapFeature,
  type PageSummary,
  type PageView,
} from "@pramana/services";
import { BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";
import { LiveNotes } from "@/components/ai/LiveNotes";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { AgesExplorer, type AgeDetail, type AgeProgress } from "@/components/home/AgesExplorer";
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
 * The home page opens on the subject itself: the age band with the year
 * cursor and the atlas under it, full width (docs/visual.md §6). A short head
 * sits above; the written ages follow, the one the learner is in large.
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

  return (
    <Frame className="pt-5 pb-4 sm:pt-6">
      {/* On a phone the line is time comes first: every age on one compact rule, the atlas's year as the cursor.
          Wider screens have the full band with the atlas below. */}
      {ages.length > 0 && (
        <AgeLine ages={ages} mark={ATLAS.initialYear ?? null} progress={agesProgress} size="compact" className="mb-5 md:hidden" />
      )}
      {/* ------------------------------------------------ what this is, and what is next (docs/visual.md §6) */}
      <section className={cn("grid items-start gap-x-10 gap-y-5", featured && "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,30rem)]")}>
        <div className="min-w-0">
          <h1 className="max-w-[22ch] text-3xl text-ink sm:text-4xl">
            Indian history, with the evidence attached.
          </h1>
          <p className="mt-2 max-w-[56ch] font-sans text-note text-ink-2">
            Every statement points to the exact words it rests on, in a source you can open; where
            historians disagree, you see each reading.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm text-ink-2">
            {learned && <LearnedTodayLine data={learned} />}
            <p>
              <Link href="/canvas" className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink-3">
                Your canvases: anything on the site, side by side
              </Link>
            </p>
          </div>
        </div>
        {featured && (
          <ContinueBlock
            page={featured}
            view={views.get(featured.slug)!}
            progress={agesProgress[featured.slug]}
            today={today && today.pageSlug === featured.slug ? { ...today, cards: dueNow.length } : null}
            resume={resumeAt}
            startReason={
              !lastRead && recommended && recommended.pageSlug === featured.slug ? recommended.reason : null
            }
            startChapter={
              !lastRead && recommended && recommended.pageSlug === featured.slug ? recommended.chapterId : null
            }
            isResume={Boolean(lastRead)}
            effort={progress.effort}
            known={progress.deck.known}
            due={progress.deck.due}
          />
        )}
      </section>

      {first && <FirstSteps data={first} className="mt-6" />}

      {/* ------------------------------------------------ every age, and the map through time */}
      <section aria-labelledby="ages-h" className="mt-6 sm:mt-8">
        <h2 id="ages-h" className="sr-only">
          The ages, and the map through time
        </h2>
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
      </section>

      {/* ------------------------------------------------ the pages written so far, in time order, each with its own picture */}
      {written > 0 && (
        <section aria-labelledby="pages-h" className="mt-10 sm:mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="pages-h" className="text-2xl text-ink">
              Pages to read
            </h2>
            <p className="font-sans text-sm text-ink-3">
              {strip?.spine
                ? `${capital(word(written))} of the ${strip.spine} ages ${written === 1 ? "is" : "are"} written so far`
                : `${capital(word(written))} ${written === 1 ? "age is" : "ages are"} written so far`}
              , each a story in parts with its sources open beside it.
            </p>
          </div>
          {/* Tiles (docs/visual.md §4): 1 across on a phone, 2 from 640px, 3 from 1024px, 4 from 1536px. The one
              place that says "you are here" is the Continue block at the top; the tiles are uniform. */}
          <ol className="mt-5 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {eras.map((p) => (
              <li key={p.slug} className="min-w-0">
                <AgeTile page={p} view={views.get(p.slug)!} progress={agesProgress[p.slug]} />
              </li>
            ))}
          </ol>
          {ages.some((a) => !a.page) && (
            <p className="mt-4 font-sans text-sm text-ink-3">
              Not written yet:{" "}
              {ages
                .filter((a) => !a.page)
                .map((a, i, all) => (
                  <span key={a.id}>
                    <Link
                      href={`/e/${a.slug}`}
                      className="text-ink-2 underline decoration-rule underline-offset-2 hover:text-ink hover:decoration-ink-3"
                    >
                      {a.label}
                    </Link>
                    {i < all.length - 1 ? ", " : "."}
                  </span>
                ))}
            </p>
          )}
        </section>
      )}

      {/* The study partner's latest notes, as marginalia (docs/visual.md §7); nothing when there are none. */}
      <LiveNotes recent limit={3} layout="row" className="mt-10 sm:mt-12" />

      {/* ------------------------------------------------ what changed lately (every change is at /audit) */}
      {applied.length > 0 && (
        <section aria-labelledby="changes-h" className="mt-10 font-sans sm:mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 id="changes-h" className="font-serif text-xl text-ink">
              What changed lately
            </h2>
            <Link href="/audit" className="text-sm text-ink-3 no-underline hover:text-ink hover:underline">
              Every change
            </Link>
          </div>
          <RecentChanges items={applied.slice(0, 6)} />
        </section>
      )}
    </Frame>
  );
}

/**
 * What is next, beside the head on the first screen (docs/visual.md §6): the
 * age the learner is in, or should start with, one progress bar and two
 * buttons. Dense; the age's picture and story are in "Pages to read" below.
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
  const deva = devanagari(page.entity);
  const n = view.stats.claims;
  const parts = view.page.blocks.filter((b) => b.type === "chapter").length;
  const firstPart = startChapter ?? view.page.blocks.find((b) => b.type === "chapter")?.id;
  const button = cn(buttonVariants(), "h-9 px-3.5 text-ui");
  const outline = cn(buttonVariants({ variant: "outline" }), "h-9 px-3.5 text-ui");
  // One line of standing, not a run of counters: how far through this age, and how much is remembered ("remembered" counts only cards seen).
  const standing = [
    progress && progress.parts > 0 ? `${progress.partsStudied} of ${progress.parts} parts studied` : "",
    effort.seen > 0 ? `${known} of ${effort.seen} cards remembered` : "",
  ].filter(Boolean);
  return (
    <aside aria-labelledby="continue-h" className="min-w-0 font-sans lg:pt-1">
      <p id="continue-h" className="text-ui text-ink-2">
        {isResume ? "Continue learning" : "Start here"}
      </p>
      <p className="mt-0.5 font-serif text-xl leading-tight text-ink">
        <Link href={`/p/${page.slug}`} className="no-underline hover:text-indigo">
          {page.title}
        </Link>
        {deva && (
          <span lang="hi" className="ml-2 font-deva text-xl text-ink-2">
            {deva}
          </span>
        )}
        <span className="ml-2 font-sans text-sm text-ink-3 tnum">
          {page.entity?.whenLabel}
          {parts > 0 ? `, ${parts} parts` : ""}
        </span>
      </p>
      {startReason && <p className="mt-1.5 text-note leading-snug text-ink-2">{startReason}</p>}
      {isResume ? (
        <>
          {progress && progress.parts > 0 && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-rule" aria-hidden>
              <div
                className="h-full rounded-full bg-ink/75"
                style={{ width: `${Math.round((progress.partsStudied / progress.parts) * 100)}%` }}
              />
            </div>
          )}
          {standing.length > 0 && <p className="mt-1.5 text-sm text-ink-3 tnum">{standing.join(", ")}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={today ? "/learn/today" : "/learn"}
              className={cn(button, "h-auto min-h-9 max-w-full shrink py-1.5 text-left whitespace-normal")}
            >
              <GraduationCap className="size-4 shrink-0" aria-hidden />
              <span className="ml-2 min-w-0">
                {today ? (
                  <>
                    Continue today's session
                    <span className="block text-sm font-normal text-primary-foreground">
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
                <BookOpen className="size-4" aria-hidden /> Read only Part {today.number}
              </Link>
            ) : (
              <Link href={`/p/${page.slug}${resume ? `#${resume}` : ""}`} className={outline}>
                <BookOpen className="size-4" aria-hidden /> Keep reading
              </Link>
            )}
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/p/${page.slug}${firstPart ? `#${firstPart}-title` : ""}`} className={button}>
            <BookOpen className="size-4" aria-hidden /> Read the page
          </Link>
          {n > 0 && (
            <Link href="/learn" className={outline}>
              Quiz me on it
            </Link>
          )}
        </div>
      )}
    </aside>
  );
}

/**
 * A written age as a tile (docs/visual.md §4): a picture from inside its page
 * (never the lead picture, which the column beside the atlas shows; the lead
 * only when the page has no other), then its dates, title, one line of story,
 * what it holds, and how far the learner has got.
 */
function AgeTile({ page, view, progress }: { page: PageSummary; view: PageView; progress?: AgeProgress }) {
  const lead = leadImage(page, view);
  const picture = insidePicture(view, lead) ?? lead;
  const deva = devanagari(page.entity);
  const n = view.stats.claims;
  const found = n - (view.stats.byLevel[0] ?? 0) - (view.stats.byLevel[1] ?? 0);
  const human = view.stats.byLevel[4] ?? 0;
  const parts = view.page.blocks.filter((b) => b.type === "chapter").length;
  const ago = yearsAgo(page.entity?.bounds);
  const studied = progress && progress.state !== "untouched" && progress.parts > 0 ? progress : undefined;
  return (
    <Link href={`/p/${page.slug}`} className="tile group flex h-full flex-col no-underline" aria-label={`${page.title}: open the page`}>
      <span className="relative block aspect-[16/9] overflow-hidden bg-field">
        {picture ? (
          <>
            <CommonsImage file={picture} fill sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" decorative />
            <ImaginingTag representation={picture.representation} className="absolute top-2 left-2" />
          </>
        ) : (
          <PeriodBand bounds={page.entity?.bounds ?? null} className="h-full" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col px-4 pt-3 pb-4">
        <span className="font-sans text-xs text-ink-3 tnum">
          {page.entity?.whenLabel}
          {ago ? `, ${ago}` : ""}
        </span>
        <span className="mt-1 font-serif text-xl leading-tight text-ink transition-colors group-hover:text-indigo">
          {page.title}
          {deva && (
            <span lang="hi" className="ml-2 font-deva text-xl text-ink-3">
              {deva}
            </span>
          )}
        </span>
        {page.summary && <span className="mt-1.5 line-clamp-2 font-sans text-note leading-snug text-ink-2">{page.summary}</span>}
        <span className="mt-auto flex items-center gap-2 pt-3 font-sans text-xs text-ink-3">
          <EvidenceSeal level={human === n && n > 0 ? 4 : found === n && n > 0 ? 2 : 1} />
          <span className="tnum">
            {parts > 0 ? `${parts} parts, ` : ""}
            {n} claims
          </span>
          {studied && (
            <span className="ml-auto text-ink-2 tnum">
              {studied.partsStudied} of {studied.parts} studied
            </span>
          )}
        </span>
        {/* The learner's way through the age, as on the band: a hairline, not a card. */}
        {studied && (
          <span className="mt-2 block h-0.5 w-full overflow-hidden rounded-full bg-rule" aria-hidden>
            <span className="block h-full bg-ink/75" style={{ width: `${Math.round((studied.partsStudied / studied.parts) * 100)}%` }} />
          </span>
        )}
      </span>
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
    <div className="mt-2 grid gap-x-8 gap-y-4 border-t border-rule pt-3 sm:grid-cols-[repeat(auto-fit,minmax(20rem,1fr))]">
      {[...byDay.entries()].map(([day, list]) => (
        <div key={day} className="min-w-0">
          <p className="text-sm text-ink-3">{day}</p>
          <ul className="mt-1">
            {list.map((c) => (
              <li key={c.id} className="flex min-h-9 items-baseline gap-3 border-b border-rule py-1.5 last:border-b-0">
                <span className="w-12 shrink-0 text-xs text-ink-3 tnum">
                  {new Date(c.decidedAt ?? c.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="min-w-0 text-ui text-ink">
                  {c.title}
                  <span className="block text-xs text-ink-3">
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
        <div
          className="absolute inset-y-0 rounded-full bg-indigo"
          style={{ left: `${a}%`, width: `max(${b - a}%, 4px)` }}
        />
      </div>
      {!compact && (
        <div className="absolute inset-x-4 bottom-1.5 flex justify-between font-sans text-[0.6875rem] text-ink-3">
          <span>7000 BCE</span>
          <span>now</span>
        </div>
      )}
    </div>
  );
}
