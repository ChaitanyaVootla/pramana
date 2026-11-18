import { getDb } from "@pramana/db";
import {
  listPages,
  loadClaimCards,
  loadEntityCards,
  search,
  type ClaimCard,
  type EntityCard,
} from "@pramana/services";
import { BookOpen, Landmark, MapPin, ScrollText, Search, Tag, User } from "lucide-react";
import Link from "next/link";
import { initialOf } from "@/lib/names";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { CommonsImage, EntityThumb } from "@/components/media";
import { Empty, PageContainer, PageTitle } from "@/components/pages/Shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { claimTier, datedLabel } from "@/lib/era";
import { ASSESSMENT_LABELS, assessmentTone } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata = { title: "Search" };

const KIND_WORDS: Record<string, string> = {
  period: "an age",
  polity: "a state",
  culture: "a culture",
  event: "an event",
  person: "a person",
  group: "a dynasty or community",
  place: "a place",
  site: "a site",
  text: "a text",
  inscription: "an inscription",
  artifact: "an object",
  concept: "an idea",
  institution: "an institution",
  term: "a word to know",
};

const TIER_WORDS: Record<string, string> = {
  primary: "source from the time",
  secondary: "modern scholarship",
  tertiary: "reference work",
};

/** Entity results, grouped the way a reader thinks of them. */
const GROUPS: { title: string; kinds: string[] }[] = [
  { title: "People", kinds: ["person", "group"] },
  { title: "Places and inscriptions", kinds: ["place", "site", "inscription"] },
  {
    title: "Ages, states and events",
    kinds: ["period", "polity", "culture", "event", "institution"],
  },
  { title: "Words to know", kinds: ["term", "concept", "text", "artifact"] },
];

function iconOf(kind: string) {
  if (kind === "person" || kind === "group") return User;
  if (kind === "place" || kind === "site" || kind === "inscription") return MapPin;
  if (kind === "term" || kind === "concept") return Tag;
  return Landmark;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? await search(query, { limit: 30 }) : null;
  const db = getDb();
  const [cards, claims, pages] = results
    ? await Promise.all([
        loadEntityCards(
          db,
          results.entities.map((e) => e.id),
        ),
        loadClaimCards(
          db,
          results.claims.map((c) => c.id),
        ),
        listPages(),
      ])
    : [new Map<string, EntityCard>(), new Map<string, ClaimCard>(), []];
  // The entity the query names comes first, before the pages about it.
  const match = results?.match ? (cards.get(results.match.id) ?? null) : null;
  const entities = results
    ? results.entities
        .filter((e) => e.id !== match?.id)
        .map((e) => cards.get(e.id))
        .filter((e): e is EntityCard => Boolean(e))
    : [];
  const total = results
    ? results.pages.length +
      results.entities.length +
      results.claims.length +
      results.sources.length
    : 0;

  return (
    <PageContainer>
      <PageTitle>Search</PageTitle>
      <form action="/search" role="search" className="mt-5 flex max-w-[48rem] gap-2">
        <label htmlFor="q" className="visually-hidden">
          Search people, places, claims and sources
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Aśoka, Kalinga, “seven classes”…"
            className="h-11 pl-9 md:text-base"
            autoFocus={!query}
          />
        </div>
        <Button type="submit" size="lg" className="h-11">
          Search
        </Button>
      </form>
      <p className="mt-2 font-sans text-sm text-ink-3">
        Type names as you’d spell them: “ashoka” finds “Aśoka”.
      </p>

      {query && total === 0 && (
        <Empty className="mt-8">
          Nothing matches “{query}”. Try a shorter word or another spelling, or{" "}
          <Link
            href="/people"
            className="text-indigo underline decoration-indigo-tint underline-offset-3"
          >
            browse the people
          </Link>{" "}
          and{" "}
          <Link
            href="/places"
            className="text-indigo underline decoration-indigo-tint underline-offset-3"
          >
            places
          </Link>
          .
        </Empty>
      )}
      {results && total > 0 && (
        <nav
          aria-label="Jump to a group of results"
          className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-sans text-sm text-ink-3 tnum"
        >
          <span className="text-ui text-ink-2">
            {total} {total === 1 ? "result" : "results"} for “{query}”
          </span>
          {results.pages.length > 0 && (
            <a href="#r-pages" className="hover:text-ink">
              {results.pages.length} {results.pages.length === 1 ? "page" : "pages"}
            </a>
          )}
          {entities.length > 0 && (
            <a href="#r-entities" className="hover:text-ink">
              {entities.length} more people, places and things
            </a>
          )}
          {results.claims.length > 0 && (
            <a href="#r-claims" className="hover:text-ink">
              {results.claims.length} claims
            </a>
          )}
          {results.sources.length > 0 && (
            <a href="#r-sources" className="hover:text-ink">
              {results.sources.length} sources
            </a>
          )}
        </nav>
      )}

      {match && (
        <Section title="Best match">
          <BestMatch entity={match} />
        </Section>
      )}

      {results && results.pages.length > 0 && (
        <Section id="r-pages" title="Pages to read">
          <ul className="grid gap-3 sm:grid-cols-2">
            {results.pages.map((p) => {
              const summary = pages.find((x) => x.slug === p.slug);
              const image = summary?.entity?.image;
              return (
                <li key={p.id}>
                  <Link
                    href={`/p/${p.slug}`}
                    className="tile group flex h-full items-start gap-3.5 p-4"
                  >
                    {image ? (
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-chuna ring-1 ring-rule">
                        <CommonsImage file={image} fill decorative max={330} sizes="56px" />
                      </span>
                    ) : (
                      <BookOpen className="mt-1 size-5 shrink-0 text-indigo" aria-hidden />
                    )}
                    <span className="min-w-0">
                      <span className="block font-heading text-lg leading-snug text-ink group-hover:text-indigo">
                        {p.title}
                      </span>
                      {summary?.entity?.whenLabel && (
                        <span className="block font-sans text-sm text-ink-3 tnum">
                          {summary.entity.whenLabel}
                        </span>
                      )}
                      {summary?.summary && (
                        <span className="mt-1 line-clamp-2 block font-sans text-note leading-snug text-ink-2">
                          {summary.summary}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {entities.length > 0 && (
        <div id="r-entities" className="scroll-mt-24">
          {GROUPS.map((g) => {
            const items = entities.filter((e) => g.kinds.includes(e.kind));
            if (!items.length) return null;
            return (
              <Section key={g.title} title={g.title} count={items.length}>
                <ul className="-mx-3 grid gap-x-4 sm:grid-cols-2">
                  {items.map((e) => (
                    <EntityResult key={e.id} entity={e} />
                  ))}
                </ul>
              </Section>
            );
          })}
        </div>
      )}

      {results && results.claims.length > 0 && (
        <Section id="r-claims" title="Claims, with their evidence" count={results.claims.length}>
          <ul className="-mx-3 space-y-0.5">
            {results.claims.map((r) => {
              const c = claims.get(r.id);
              const tone = assessmentTone(r.assessment, r.kind);
              const notable = tone === "turmeric" || tone === "madder";
              return (
                <li key={r.id}>
                  <Link
                    href={`/c/${r.id}`}
                    className="group flex items-start gap-3 rounded-md px-3 py-2.5 no-underline hover:bg-rule-soft/70"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block max-w-[72ch] text-base leading-snug text-ink group-hover:underline group-hover:decoration-indigo-tint group-hover:underline-offset-4">
                        {r.text}
                      </span>
                      {(c?.whenLabel || notable) && (
                        <span className="mt-0.5 flex flex-wrap gap-x-3 font-sans text-sm text-ink-3">
                          {c?.whenLabel && <span className="tnum">{c.whenLabel}</span>}
                          {notable && (
                            <span
                              className={cn(
                                "font-medium",
                                tone === "madder" ? "text-madder" : "text-turmeric-ink",
                              )}
                            >
                              {ASSESSMENT_LABELS[r.assessment] ?? r.assessment}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                    {c && <EvidenceSeal level={c.level} tier={claimTier(c)} className="mt-1.5" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {results && results.sources.length > 0 && (
        <Section id="r-sources" title="Sources" count={results.sources.length}>
          <ul className="-mx-3 space-y-0.5">
            {results.sources.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/s/${s.id}`}
                  className="group flex items-baseline gap-3 rounded-md px-3 py-2 no-underline hover:bg-rule-soft/70"
                >
                  <ScrollText className="size-4 shrink-0 translate-y-0.5 text-ink-3" aria-hidden />
                  <span className="min-w-0">
                    <span className="text-base text-ink group-hover:underline group-hover:decoration-indigo-tint group-hover:underline-offset-4">
                      {s.title}
                    </span>
                    <span className="ml-2 font-sans text-sm text-ink-3">
                      {s.short !== s.title && `${s.short}, `}
                      {TIER_WORDS[s.tier] ?? s.tier}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageContainer>
  );
}

/** The entity the query names, larger, with its own page and the page that tells its story. */
function BestMatch({ entity: e }: { entity: EntityCard }) {
  const Icon = iconOf(e.kind);
  const initial = initialOf(e);
  const page = e.pageSlug ? `/p/${e.pageSlug}` : null;
  return (
    <div className="tile flex max-w-[48rem] items-start gap-4 p-4">
      {e.image ? (
        <EntityThumb image={e.image} size={64} decorative />
      ) : (
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-md bg-indigo-wash font-heading text-2xl text-indigo"
          lang={e.kind === "person" ? initial.lang : undefined}
          aria-hidden
        >
          {e.kind === "person" ? initial.char : <Icon className="size-6" />}
        </span>
      )}
      <div className="min-w-0">
        <Link
          href={`/e/${e.slug}`}
          className="font-heading text-xl leading-snug text-ink underline decoration-transparent underline-offset-4 hover:text-indigo hover:decoration-indigo-tint"
        >
          {e.label}
        </Link>
        <p className="font-sans text-sm text-ink-3 tnum">
          {KIND_WORDS[e.kind] ?? e.kind}
          {datedLabel(e) && `, ${datedLabel(e)}`}
        </p>
        {e.description && (
          <p className="mt-1 max-w-[60ch] font-sans text-note leading-snug text-ink-2">
            {e.description}
          </p>
        )}
        {page && (
          <Link
            href={page}
            className="mt-2 inline-flex items-center gap-1.5 font-sans text-sm text-indigo underline decoration-indigo-tint underline-offset-3"
          >
            <BookOpen className="size-4" aria-hidden />
            Read the page
          </Link>
        )}
      </div>
    </div>
  );
}

function EntityResult({ entity: e }: { entity: EntityCard }) {
  const Icon = iconOf(e.kind);
  const place = ["place", "site", "inscription"].includes(e.kind);
  const initial = initialOf(e);
  return (
    <li>
      <Link
        href={e.pageSlug ? `/p/${e.pageSlug}` : `/e/${e.slug}`}
        className="group flex items-start gap-3 rounded-md px-3 py-2 no-underline hover:bg-rule-soft/70"
      >
        {e.image ? (
          <EntityThumb image={e.image} size={40} decorative />
        ) : e.kind === "person" ? (
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-indigo-wash font-heading text-lg text-indigo"
            lang={initial.lang}
            aria-hidden
          >
            {initial.char}
          </span>
        ) : (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-md",
              place ? "bg-sandstone-wash text-sandstone" : "bg-rule-soft text-ink-3",
            )}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-heading text-lg leading-snug text-ink group-hover:underline group-hover:decoration-indigo-tint group-hover:underline-offset-4">
            {e.label}
          </span>
          <span className="block font-sans text-sm text-ink-3 tnum">
            {KIND_WORDS[e.kind] ?? e.kind}
            {datedLabel(e) && `, ${datedLabel(e)}`}
          </span>
          {e.description && (
            <span className="mt-0.5 line-clamp-1 block font-sans text-sm text-ink-2">
              {e.description}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function Section({
  id,
  title,
  count,
  children,
}: {
  id?: string;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-9 scroll-mt-24">
      <h2 className="mb-3 flex items-baseline justify-between border-b border-rule pb-2 font-sans text-ui font-semibold text-ink">
        {title}
        {count !== undefined && <span className="font-normal text-ink-3 tnum">{count}</span>}
      </h2>
      {children}
    </section>
  );
}
