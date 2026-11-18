import { AskAi } from "@/components/ai/AskAi";
import { LiveNotes } from "@/components/ai/LiveNotes";
import { claimIdsInBlock, dateBounds, type DateBounds } from "@pramana/core";
import { getDb } from "@pramana/db";
import {
  getPageView,
  getSourceDetail,
  listPages,
  loadClaimCards,
  NotFoundError,
  type ClaimCard,
} from "@pramana/services";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { History } from "@/components/History";
import { CheckLine, Italics, licenceWords, quoteCheck } from "@/components/pages/checks";
import { CiteThis } from "@/components/pages/CiteThis";
import { Disclosure } from "@/components/pages/Disclosure";
import { CONTAINER, Empty, LINK, RailBlock, SectionHeading } from "@/components/pages/Shell";
import { EvidenceSeal } from "@/components/evidence/EvidenceSeal";
import { WrittenWhen, type Span } from "@/components/source/WrittenWhen";
import { Button } from "@/components/ui/button";
import { sourceCitation } from "@/lib/cite";
import { chapterTitle, claimTier, layoutEra } from "@/lib/era";
import { STANCE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getSourceDetail(id);
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      (error as Error).message?.includes("invalid input syntax")
    )
      notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: (await load(id)).source.short };
}

/** The reading column (--reading-w when wide) and a rail that takes the rest. */
const READING_GRID =
  "grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,var(--reading-w))_minmax(24rem,1fr)] xl:gap-x-14";

const TIER_SENTENCE: Record<string, string> = {
  primary: "A source from the time: written when it happened or soon after",
  secondary: "Modern scholarship",
  tertiary: "A reference work: useful for finding sources, weak as evidence",
};

const KIND_WORDS: Record<string, string> = {
  work: "the work itself, in any version",
  edition: "a published edition or translation",
  book: "a book",
  chapter: "a chapter in a book",
  article: "a journal article",
  inscription_corpus: "a collection of inscriptions",
  inscription: "an inscription",
  manuscript: "a manuscript",
  report: "an excavation or survey report",
  webpage: "a web page",
  wiki_article: "an encyclopaedia article",
  dataset: "a dataset",
  map: "a map",
  image: "an image",
};

const DAY = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function spanOf(b: DateBounds | null | undefined): Span | null {
  if (!b || b.startMin === null) return null;
  return { from: b.startMin, to: b.endMax ?? b.startMin + 1, approximate: b.approximate };
}

/** Where the claims resting on a source are read: page and part, in reading order. */
async function whereCited(claimIds: Set<string>) {
  const out: {
    slug: string;
    title: string;
    parts: { id: string; index: number; title: string; count: number }[];
    count: number;
    /** Each of the source's claims on this page, with the part it is read in. */
    at: Map<string, { id: string; index: number; title: string } | null>;
  }[] = [];
  if (!claimIds.size) return out;
  for (const p of await listPages()) {
    const view = await getPageView(p.slug).catch(() => null);
    if (!view) continue;
    const layout = layoutEra(view.page.blocks, claimIdsInBlock);
    const here = Object.keys(view.claims).filter((id) => claimIds.has(id));
    // A claim is counted once, in the first part it is read in (a later part, such as "often
    // said", may cite it again), so the parts add up to no more than the page's count.
    const at = new Map(
      here.map((id) => {
        const index = layout.chapters.findIndex((c) => c.claimIds.includes(id));
        const c = layout.chapters[index];
        return [id, c ? { id: c.id, index, title: chapterTitle(c) } : null] as const;
      }),
    );
    const parts = layout.chapters
      .map((c, index) => ({
        id: c.id,
        index,
        title: chapterTitle(c),
        count: [...at.values()].filter((a) => a?.id === c.id).length,
      }))
      .filter((c) => c.count > 0);
    if (here.length)
      out.push({ slug: p.slug, title: view.page.title, parts, count: here.length, at });
  }
  return out;
}

export default async function SourcePage({ params }: Params) {
  const { id } = await params;
  const { source, chain, derived, excerpts, snapshots, history } = await load(id);
  const ids = source.identifiers;
  const quoted = excerpts.filter((e) => e.quote).length;

  const claimIds = new Set(excerpts.flatMap((e) => e.claims.map((c) => c.id)));
  const [claimCards, cited] = await Promise.all([
    loadClaimCards(getDb(), [...claimIds]),
    whereCited(claimIds),
  ]);
  const claimBounds = [...claimCards.values()].flatMap((c: ClaimCard) => {
    try {
      return c.when ? [dateBounds(c.when)] : [];
    } catch {
      return [];
    }
  });
  const events: Span | null = claimBounds.some((b) => b.startMin !== null)
    ? {
        from: Math.min(...claimBounds.flatMap((b) => (b.startMin === null ? [] : [b.startMin]))),
        to: Math.max(
          ...claimBounds.flatMap((b) =>
            b.endMax === null ? (b.startMin === null ? [] : [b.startMin + 1]) : [b.endMax],
          ),
        ),
        approximate: claimBounds.some((b) => b.approximate),
      }
    : null;
  const written = spanOf(
    source.composedBounds ?? chain.find((c) => c.composedBounds)?.composedBounds,
  );
  // Excerpts in reading order: by the page, then the part, where each is first used.
  const rows = excerpts
    .map((e, i) => {
      for (const [order, p] of cited.entries())
        for (const c of e.claims)
          if (p.at.has(c.id)) {
            const part = p.at.get(c.id);
            return {
              e,
              rank: [order, part?.index ?? -1, i],
              label: part ? `${p.title}, Part ${part.index + 1}: ${part.title}` : p.title,
              href: part ? `/p/${p.slug}#${part.id}` : `/p/${p.slug}`,
            };
          }
      return { e, rank: [cited.length, 0, i], label: null, href: null };
    })
    .sort((a, b) => a.rank[0]! - b.rank[0]! || a.rank[1]! - b.rank[1]! || a.rank[2]! - b.rank[2]!);
  const issued = Number(source.csl.issued?.["date-parts"]?.[0]?.[0]);
  const edition = source.kind !== "work" && Number.isFinite(issued) ? issued : null;

  return (
    <div className={cn(CONTAINER, "pt-8 sm:pt-10")}>
      {/* Wide: the bibliographic head in the reading column, "Written when?" beside it. */}
      <header className={cn(READING_GRID, "pb-10")}>
        <div className="min-w-0">
          <p className="font-sans text-ui text-ink-2">
            {TIER_SENTENCE[source.tier] ?? source.tier}
            {KIND_WORDS[source.kind] ? `; ${KIND_WORDS[source.kind]}` : ""}
          </p>
          <h1
            className={cn(
              "mt-2 text-ink [font-variation-settings:'opsz'_72]",
              source.title.length > 60
                ? "text-2xl leading-tight sm:text-3xl"
                : "text-3xl sm:text-4xl",
            )}
          >
            {source.title}
          </h1>
          <p className="mt-4 max-w-[64ch] text-lg leading-relaxed text-ink-2">
            <Italics text={source.full} />
          </p>
          {source.composedLabel && (
            <p className="mt-2 font-sans text-ui text-ink-2">
              The work was composed {source.composedLabel}.
            </p>
          )}
          {chain.length > 1 && (
            <p className="mt-2 font-sans text-ui text-ink-2">
              A version of{" "}
              {chain.slice(1).map((s, i) => (
                <span key={s.id}>
                  {i > 0 && ", which is a version of "}
                  <Link href={`/s/${s.id}`} className={LINK}>
                    {s.short}
                  </Link>
                </span>
              ))}
              .
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {source.url && (
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={source.url} target="_blank" rel="noreferrer" />}
              >
                Open the source <ArrowUpRight />
              </Button>
            )}
            <AskAi
              subject={{ type: "source", id: source.id, label: source.title }}
              size="default"
            />
          </div>
        </div>
        <div className="min-w-0 xl:pt-7">
          <WrittenWhen
            events={events}
            written={written}
            edition={edition}
            editionIsWriting={source.tier !== "primary" && !source.derivedFromId}
          />
        </div>
      </header>

      <div className={READING_GRID}>
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="quoted">
            <SectionHeading
              id="quoted"
              aside={
                excerpts.length
                  ? `${excerpts.length} ${excerpts.length === 1 ? "passage" : "passages"}, ${quoted === excerpts.length ? (quoted === 1 ? "quoted" : "all quoted") : `${quoted} quoted`}`
                  : undefined
              }
            >
              What the site cites from it
            </SectionHeading>
            {excerpts.length === 0 ? (
              <Empty className="mt-3">
                Nothing is cited from this source yet. Claims that rest on it will list their words
                here.
              </Empty>
            ) : (
              <>
                <ExcerptList rows={rows.slice(0, 3)} claimCards={claimCards} className="mt-4" />
                {rows.length > 3 && (
                  <Disclosure
                    summary={`Show ${rows.length - 3} more`}
                    className="mt-3"
                    contentClassName="mt-3"
                  >
                    <ExcerptList
                      rows={rows.slice(3)}
                      claimCards={claimCards}
                      after={rows[2]!.label}
                    />
                  </Disclosure>
                )}
              </>
            )}
          </section>

          {derived.length > 0 && (
            <section aria-labelledby="derived">
              <SectionHeading id="derived">Editions and translations</SectionHeading>
              <ul className="mt-3 divide-y divide-rule border-y border-rule">
                {derived.map((d) => (
                  <li key={d.id} className="py-3">
                    <Link
                      href={`/s/${d.id}`}
                      className="text-base text-ink hover:underline hover:decoration-indigo-tint hover:underline-offset-3"
                    >
                      <Italics text={d.full} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* The source, then where its copies come from, then how to cite it. */}
          <section id="cite" aria-labelledby="cite-h" className="scroll-mt-24">
            <SectionHeading id="cite-h">Cite this source</SectionHeading>
            <CiteThis
              className="mt-3"
              intro="The source itself, from its catalogue record. To cite what this site says about it, cite the claim's page."
              citation={sourceCitation(source.csl, source.full, {
                id: source.id,
                url: source.url,
                accessed: new Date(),
              })}
            />
          </section>
        </div>

        <aside className="min-w-0 space-y-7">
          {cited.length > 0 && (
            <section aria-labelledby="cited-h">
              <SectionHeading
                id="cited-h"
                aside={`${claimIds.size} ${claimIds.size === 1 ? "claim rests" : "claims rest"} on it${
                  cited.reduce((n, p) => n + p.count, 0) > claimIds.size ? ", some read on more than one page" : ""
                }`}
              >
                Where it is cited
              </SectionHeading>
              <ul className="mt-4 grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
                {cited.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/p/${p.slug}`}
                      className="text-lg text-ink no-underline hover:underline"
                    >
                      {p.title}
                    </Link>
                    <p className="font-sans text-sm text-ink-3 tnum">
                      {p.count} {p.count === 1 ? "claim" : "claims"}
                    </p>
                    {p.parts.length > 0 && (
                      <ul className="mt-3 space-y-1 font-sans text-sm">
                        {p.parts.map((c) => (
                          <li key={c.id} className="flex items-baseline justify-between gap-3">
                            <Link
                              href={`/p/${p.slug}#${c.id}`}
                              className="min-w-0 text-indigo no-underline hover:underline"
                            >
                              <span className="text-ink-3 tnum">Part {c.index + 1}.</span> {c.title}
                            </Link>
                            <span className="shrink-0 text-ink-3 tnum">{c.count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <LiveNotes subject={{ type: "source", id: source.id }} />
          <RailBlock title="May we quote it?">
            <p className="text-ink">
              {licenceWords(source.license.status)}
              {source.license.spdx && <span className="text-ink-2"> ({source.license.spdx})</span>}.
            </p>
            {source.license.note && (
              <p className="mt-1 text-sm text-ink-3">{source.license.note}</p>
            )}
          </RailBlock>

          {snapshots.length > 0 && (
            <RailBlock title="Our stored copies">
              <p className="text-sm text-ink-3">Quotes are checked against these, word by word.</p>
              <ul className="mt-2 space-y-2">
                {snapshots.map((s) => (
                  <li key={s.id}>
                    <p className="text-ink">{s.title ?? s.origin}</p>
                    <p className="text-sm text-ink-3 tnum">
                      {s.charCount.toLocaleString("en-GB")} characters, stored{" "}
                      {DAY.format(s.capturedAt)}
                      {s.url && (
                        <>
                          {" "}
                          from{" "}
                          <a
                            href={s.url}
                            className="hover:text-ink hover:underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {new URL(s.url).host}
                          </a>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </RailBlock>
          )}

          {(ids.doi || ids.isbn?.length || ids.ia || ids.wikidata || ids.wikipedia) && (
            <RailBlock title="Find it elsewhere">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ui">
                {ids.doi && (
                  <>
                    <dt className="text-ink-3">DOI</dt>
                    <dd className="break-all">
                      <a href={`https://doi.org/${ids.doi}`} className={LINK}>
                        {ids.doi}
                      </a>
                    </dd>
                  </>
                )}
                {ids.isbn?.length ? (
                  <>
                    <dt className="text-ink-3">ISBN</dt>
                    <dd className="tnum">{ids.isbn.join(", ")}</dd>
                  </>
                ) : null}
                {ids.ia && (
                  <>
                    <dt className="text-ink-3">Internet Archive</dt>
                    <dd className="break-all">
                      <a href={`https://archive.org/details/${ids.ia}`} className={LINK}>
                        {ids.ia}
                      </a>
                    </dd>
                  </>
                )}
                {ids.wikidata && (
                  <>
                    <dt className="text-ink-3">Wikidata</dt>
                    <dd>
                      <a href={`https://www.wikidata.org/wiki/${ids.wikidata}`} className={LINK}>
                        {ids.wikidata}
                      </a>
                    </dd>
                  </>
                )}
                {ids.wikipedia && (
                  <>
                    <dt className="text-ink-3">Wikipedia</dt>
                    <dd className="tnum">revision {ids.wikipedia.revisionId}</dd>
                  </>
                )}
              </dl>
            </RailBlock>
          )}
        </aside>
      </div>

      <section aria-label="Record of changes" className="mt-12 lg:max-w-[calc(100%-23rem)]">
        <Disclosure
          summary={`Show the record of changes to this source`}
          aside={`${history.length} ${history.length === 1 ? "entry" : "entries"}`}
          className="border-t border-rule pt-2"
        >
          <History entries={history} />
        </Disclosure>
      </section>
    </div>
  );
}

type Excerpt = Awaited<ReturnType<typeof getSourceDetail>>["excerpts"][number];
type Row = { e: Excerpt; label: string | null; href: string | null };

/** Excerpts under a heading for the page and part they are read in; `after` is the last heading already shown. */
function ExcerptList({
  rows,
  claimCards,
  after = null,
  className,
}: {
  rows: Row[];
  claimCards: Map<string, ClaimCard>;
  after?: string | null;
  className?: string;
}) {
  return (
    <ol className={cn("divide-y divide-rule border-y border-rule", className)}>
      {rows.map(({ e, label, href }, i) => {
        const heading = label !== (i === 0 ? after : rows[i - 1]!.label) ? label : null;
        const q = quoteCheck(e.verification.status, e.verification.score);
        // Quotes in a row that back the same claims list them once, after the last of the run.
        const key = (r: Row) => r.e.claims.map((c) => `${c.id}:${c.stance}`).join();
        const nextRow = rows[i + 1];
        const sameAsNext = nextRow && nextRow.label === label && key(nextRow) === key(rows[i]!);
        const prevRow = rows[i - 1];
        const sameAsPrev = !heading && prevRow && key(prevRow) === key(rows[i]!);
        return (
          <Fragment key={e.id}>
            {heading && href && (
              <li className="border-b-0 pt-5 pb-1 font-sans text-sm">
                <Link href={href} className="text-indigo no-underline hover:underline">
                  {heading}
                </Link>
              </li>
            )}
            <li className={cn("py-5", sameAsPrev && "pt-1", sameAsNext && "border-b-0 pb-3")}>
              {e.locatorLabel && (
                <p className="font-sans text-sm text-ink-3 tnum">{e.locatorLabel}</p>
              )}
              {e.quote ? (
                <blockquote className="field mt-1.5 border-l-2 border-indigo px-4 py-3 text-base text-ink">
                  “{e.quote}”
                </blockquote>
              ) : (
                <p className="mt-1 text-base text-ink-2">Cited by page, without a quotation.</p>
              )}
              {e.original && (
                <p className="mt-1.5 pl-4 text-base text-ink-2" lang={e.original.lang}>
                  {e.original.text}
                </p>
              )}
              <CheckLine state={q.state} className="mt-2">
                {q.text}
              </CheckLine>
              {e.claims.length > 0 && !sameAsNext && (
                <ul className="mt-3 space-y-1.5 border-t border-rule-soft pt-3">
                  {e.claims.map((c) => (
                    <li
                      key={c.id}
                      className="grid items-start gap-x-3 sm:grid-cols-[6.5rem_1fr_auto]"
                    >
                      <span className="font-sans text-sm text-ink-3">
                        {STANCE_LABELS[c.stance] ?? c.stance}
                      </span>
                      <Link
                        href={`/c/${c.id}`}
                        className="text-note text-ink hover:underline hover:decoration-indigo-tint hover:underline-offset-3"
                      >
                        {c.text}
                      </Link>
                      {claimCards.get(c.id) && (
                        <EvidenceSeal
                          level={claimCards.get(c.id)!.level}
                          tier={claimTier(claimCards.get(c.id)!)}
                          className="mt-1 hidden sm:flex"
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
