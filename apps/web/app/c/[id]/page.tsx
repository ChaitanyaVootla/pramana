import { claimIdsInBlock, dateBounds } from "@pramana/core";
import { getDb } from "@pramana/db";
import {
  getClaimDetail,
  getPageView,
  loadEntityCards,
  NotFoundError,
  readSnapshotRange,
  type ClaimDetail,
} from "@pramana/services";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DateChip } from "@/components/chips/Chips";
import { SourceFold } from "@/components/evidence/SourceFold";
import { ChainOverview, SealLadder, type ChainStep } from "@/components/evidence/ChainOverview";
import { EvidenceSeal, sealWords } from "@/components/evidence/EvidenceSeal";
import { History } from "@/components/History";
import { HumanChecks } from "@/components/HumanChecks";
import { AddToDeckButton } from "@/components/pages/AddToDeckButton";
import { AddToCanvas } from "@/components/canvas/AddToCanvas";
import {
  CheckLine,
  Italics,
  licenceWords,
  quoteCheck,
  jointSupportCheck,
  shownSupportStatus,
  supportCheck,
  supportNote,
} from "@/components/pages/checks";
import { CiteThis } from "@/components/pages/CiteThis";
import { Disclosure } from "@/components/pages/Disclosure";
import { EmptyState } from "@/components/ui/empty-state";
import { claimCitation } from "@/lib/cite";
import { otherNames } from "@/lib/era";
import { siteOrigin } from "@/lib/origin";
import { AskAi } from "@/components/ai/AskAi";
import { LiveNotes } from "@/components/ai/LiveNotes";
import { LINK, PageContainer, RailBlock, THREE_COL } from "@/components/pages/Shell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { chapterTitle, claimTier, layoutEra } from "@/lib/era";
import {
  ASSESSMENT_LABELS,
  KIND_LABELS,
  LENS_LABELS,
  ISSUE_PLAIN,
  TIER_GLOSS,
  TIER_LABELS,
  assessmentTone,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };
type Citation = ClaimDetail["claim"]["citations"][number];

async function load(id: string) {
  try {
    return await getClaimDetail(id);
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
  const { claim } = await load(id);
  return { title: claim.text.slice(0, 80) };
}

/** The passage around a verified quote, read from the stored snapshot. */
async function context(snapshotId: string | null, position: { start: number; end: number } | null) {
  if (!snapshotId || !position) return null;
  const radius = 220;
  const start = Math.max(0, position.start - radius);
  const range = await readSnapshotRange(snapshotId, start, position.end - start + radius);
  const offset = position.start - range.start;
  // OCR text is full of blank lines; tighten it so the highlighted match stays in view.
  const tidy = (t: string) => t.replace(/[ \t]*\n\s*\n\s*/g, "\n");
  return {
    before: tidy(range.text.slice(0, offset)),
    match: tidy(range.text.slice(offset, offset + (position.end - position.start))),
    after: tidy(range.text.slice(offset + (position.end - position.start))),
  };
}

/**
 * Scanned text, cleaned for reading: running heads and page numbers (whole lines
 * with no lower-case letters) and the scanner's stray dots and bullets are
 * dropped, and it is put on one line. The line touching the match is always
 * kept. The raw scan stays behind the toggle.
 */
function cleanScan(text: string, keep: "first" | "last"): string {
  const lines = text.split("\n");
  const touching = keep === "first" ? 0 : lines.length - 1;
  return lines
    .filter((line, i) => i === touching || /\p{Ll}/u.test(line))
    .join(" ")
    .replace(/(?:[•·*■□]\s*){1,}/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ");
}

/** The last words before a match (about a line), cleaned. */
function nearBefore(text: string): string {
  const t = cleanScan(text, "last");
  const cut = t.slice(-90);
  return cut.length < t.length ? cut.replace(/^\S*\s/, "") : cut;
}

/** The first words after a match (about a line), cleaned. */
function nearAfter(text: string): string {
  const t = cleanScan(text, "first");
  const cut = t.slice(0, 90);
  return cut.length < t.length ? cut.replace(/\s\S*$/, "") : cut;
}

const KIND_SENTENCE: Record<string, string> = {
  fact: "A statement of fact",
  interpretation: "A scholarly interpretation",
  misconception: "Something often said",
  debate: "An open debate",
  open_question: "An open question",
};

const STANCE_HEAD: Record<string, string> = {
  supports: "The words that support it",
  contradicts: "The words that contradict it",
  qualifies: "The words that qualify it",
};

const RELATION_OUT: Record<string, string> = {
  supports: "Supports",
  contradicts: "Contradicts",
  qualifies: "Qualifies",
  context_for: "Gives context for",
  corrects: "Corrects",
  same_as: "Says the same as",
};
const RELATION_IN: Record<string, string> = {
  supports: "Supported by",
  contradicts: "Contradicted by",
  qualifies: "Qualified by",
  context_for: "Read in the light of",
  corrects: "Corrected by",
  same_as: "Says the same as",
};

const DAY = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

function safeBounds(when: ClaimDetail["claim"]["when"]) {
  try {
    return when ? dateBounds(when) : null;
  } catch {
    return null;
  }
}

/** One step in the chain of custody: a node on the line, a label, then the evidence. */
function Step({
  label,
  children,
  state = "ok",
  last = false,
}: {
  label: string;
  children: React.ReactNode;
  state?: "ok" | "open" | "bad";
  last?: boolean;
}) {
  return (
    <li className="relative pb-7 pl-8 last:pb-0">
      {!last && (
        <span aria-hidden className="absolute top-3 bottom-0 left-[5px] w-[2px] bg-indigo-tint" />
      )}
      <span
        aria-hidden
        className={cn(
          "absolute top-[5px] left-0 size-3 rounded-full border-2",
          state === "ok"
            ? "border-indigo bg-indigo"
            : state === "bad"
              ? "border-madder bg-paper"
              : "border-ink-3 bg-paper",
        )}
      />
      <p className="font-sans text-ui font-semibold text-ink">{label}</p>
      <div className="mt-1.5 space-y-2">{children}</div>
    </li>
  );
}

/** The part of each page where a claim is read. */
async function contextParts(pages: { slug: string; title: string }[], claimId: string) {
  return Promise.all(
    pages.map(async (p) => {
      const view = await getPageView(p.slug).catch(() => null);
      const chapters = view ? layoutEra(view.page.blocks, claimIdsInBlock).chapters : [];
      const index = chapters.findIndex((c) => c.claimIds.includes(claimId));
      return {
        ...p,
        part:
          index >= 0
            ? { id: chapters[index]!.id, index, title: chapterTitle(chapters[index]!) }
            : null,
      };
    }),
  );
}

const ROLE_WORDS: Record<string, string> = {
  subject: "About",
  agent: "Who",
  place: "Where",
  mentions: "Mentioned",
};

function sourceAnchor(c: Citation, i: number) {
  return `source-${i + 1}-${c.excerpt.source.id.slice(-6)}`;
}

export default async function ClaimPage({ params }: Params) {
  const { id } = await params;
  const origin = await siteOrigin();
  const detail = await load(id);
  const { claim } = detail;
  const evidential = claim.citations.filter((c) => c.stance !== "mentions");
  const mentions = claim.citations.filter((c) => c.stance === "mentions");
  const [contexts, people] = await Promise.all([
    Promise.all(evidential.map((c) => context(c.excerpt.snapshotId, c.excerpt.position))),
    loadEntityCards(
      getDb(),
      claim.entities.map((e) => e.id),
    ),
  ]);
  const tone = assessmentTone(claim.assessment, claim.kind);
  const bounds = safeBounds(claim.when);
  const page = detail.pages[0];
  const warnings = claim.issues.filter((i) => i.severity === "warning");
  const read = await contextParts(detail.pages, claim.id);

  // The chain at a glance: one row per source, claim → words → stored copy → edition → work.
  const overview = evidential.map((c, i) => {
    const node = detail.lineage[c.id];
    const chain = node?.chain?.length ? node.chain : [c.excerpt.source];
    const q = quoteCheck(c.excerpt.verification.status, c.excerpt.verification.score);
    const sc = supportCheck(shownSupportStatus(c.supportCheck), c.stance);
    const anchor = `#${sourceAnchor(c, i)}`;
    const steps: ChainStep[] = [];
    const scanned = node?.snapshot?.origin === "internet_archive";
    const score = c.excerpt.verification.score;
    if (c.excerpt.quote) {
      steps.push({
        label: "The words",
        detail: `“${c.excerpt.quote.slice(0, 90)}${c.excerpt.quote.length > 90 ? "…" : ""}”`,
        note: supportNote(shownSupportStatus(c.supportCheck), c.stance),
        state: sc.state,
        href: anchor,
      });
      steps.push({
        label: "Checked",
        detail:
          q.state === "ok"
            ? `found in our ${scanned ? "scanned " : "stored "}copy${score && score < 1 ? ` (${Math.round(score * 100)}% match)` : ", word for word"}`
            : q.state === "bad"
              ? "not found in our copy"
              : "not checked yet",
        state: q.state,
        href: anchor,
      });
    } else {
      steps.push({
        label: "Cited by page",
        detail: c.excerpt.locatorLabel || "no quotation",
        state: "open",
        href: anchor,
      });
    }
    const [edition, ...works] = chain;
    if (edition)
      steps.push({
        label: "Where",
        detail: `${c.excerpt.locatorLabel ? `${c.excerpt.locatorLabel}, ` : ""}${edition.short}`,
        state: "ok",
        href: `/s/${edition.id}`,
      });
    works.forEach((w) =>
      steps.push({ label: "Of the work", detail: w.title, state: "ok", href: `/s/${w.id}` }),
    );
    return { key: c.id, steps };
  });

  return (
    <PageContainer>
      {/* At 1536 and up: contents, the reading column (--reading-w, wider when the reader picks Wide), and a rail that takes the rest. */}
      <div
        className={cn(
          THREE_COL,
          "2xl:grid-cols-[13rem_minmax(0,var(--reading-w))_minmax(24rem,1fr)]",
        )}
      >
        {/* ------------------------------------------------ left: where you came from, what is here */}
        <nav aria-label="On this page" className="hidden font-sans lg:row-span-2 lg:block">
          <div className="sticky top-20 space-y-6">
            {page && (
              <Link
                href={`/p/${page.slug}#claim-${claim.id}`}
                className="block text-ui text-ink-2 hover:text-ink"
              >
                Back to {page.title}
              </Link>
            )}
            <ol className="space-y-1.5 border-l border-rule text-ui">
              <li>
                <a href="#claim" className="-ml-px block border-l-2 border-indigo pl-3 text-ink">
                  The claim
                </a>
              </li>
              {evidential.map((c, i) => (
                <li key={c.id}>
                  <a
                    href={`#${sourceAnchor(c, i)}`}
                    className="-ml-px block border-l-2 border-transparent pl-3 text-ink-2 hover:text-ink"
                  >
                    {c.excerpt.source.short}
                    {c.excerpt.locatorLabel && (
                      <span className="block truncate text-sm text-ink-3">
                        {c.excerpt.locatorLabel}
                      </span>
                    )}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#cite"
                  className="-ml-px block border-l-2 border-transparent pl-3 text-ink-2 hover:text-ink"
                >
                  Cite this
                </a>
              </li>
              <li>
                <a
                  href="#record"
                  className="-ml-px block border-l-2 border-transparent pl-3 text-ink-2 hover:text-ink"
                >
                  Record of changes
                </a>
              </li>
            </ol>
          </div>
        </nav>

        {/* ------------------------------------------------ the reading column: claim and its chain */}
        {/* No card around the page: the claim stands on the ground; evidence is cut into fields. */}
        <article className="min-w-0 lg:col-start-2 lg:row-start-1">
          <Breadcrumb className="font-sans">
            <BreadcrumbList>
              {page && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link href={`/p/${page.slug}#claim-${claim.id}`} />}>
                      {page.title}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>How we know this</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <header id="claim" className="mt-5 scroll-mt-24">
            <h1 className="font-serif text-3xl leading-[1.12] tracking-[-0.015em] text-ink sm:text-4xl">
              {claim.text}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-ui text-ink-2">
              {claim.whenLabel && (
                <DateChip
                  label={claim.whenLabel}
                  bounds={bounds}
                  basis={claim.when?.basis ?? null}
                />
              )}
              <span>{KIND_SENTENCE[claim.kind] ?? KIND_LABELS[claim.kind] ?? claim.kind}</span>
              {/* A favourable assessment waits in "Where it stands" until a person has checked the claim;
                  doubts (contested, weak, refuted) are said up front. */}
              {claim.assessment !== "unassessed" &&
                (claim.level === 4 ||
                  !["supported", "well_supported"].includes(claim.assessment)) && (
                  <span
                    title="An editorial judgement of the claim as a whole, from all the evidence. The checks below are about each quotation."
                    className={cn(
                      "font-medium",
                      tone === "madder"
                        ? "text-madder"
                        : tone === "turmeric"
                          ? "text-turmeric-ink"
                          : tone === "indigo"
                            ? "text-indigo"
                            : "text-ink-2",
                    )}
                  >
                    <span className="font-normal text-ink-3">Our assessment: </span>
                    {ASSESSMENT_LABELS[claim.assessment] ?? claim.assessment}
                  </span>
                )}
            </div>
            <p className="mt-3 flex items-center gap-2.5 font-sans text-ui text-ink-2">
              <EvidenceSeal level={claim.level} tier={claimTier(claim)} />
              {sealWords(claim.level)}
            </p>
            <AskAi subject={{ type: "claim", id: claim.id, label: claim.text }} className="mt-4" />
          </header>

          {claim.assessmentNote && (
            <div className="mt-6 border-l-2 border-turmeric/70 py-0.5 pl-4 text-base text-ink-2">
              <span className="font-sans text-ui font-semibold">Read with care. </span>
              {claim.assessmentNote}
            </div>
          )}
          {warnings.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-md bg-rule-soft px-4 py-3 font-sans text-ui text-ink-2">
              {warnings.map((i) => (
                <li key={i.code}>{ISSUE_PLAIN[i.code] ?? i.message}</li>
              ))}
            </ul>
          )}

          <h2 className="mt-10 text-xl text-ink">The chain of evidence</h2>
          <p className="mt-1 max-w-[60ch] font-sans text-note text-ink-2">
            From the claim back to the words in the source, the copy we checked them in, and the
            work they come from.
          </p>

          {evidential.length === 0 && (
            <EmptyState className="mt-4" title="No source is cited for this claim yet">
              Treat it as unverified until one is.
            </EmptyState>
          )}
          {/* Several sources: the overview is the summary, and each long form folds until it is chosen.
              One source: its long form is the chain, so there is no overview to repeat it. */}
          {evidential.length > 1 && <ChainOverview rows={overview} />}

          {evidential.map((c, i) => {
            const node = detail.lineage[c.id];
            const ctx = contexts[i];
            const v = c.excerpt.verification;
            const q = quoteCheck(v.status, v.score);
            const sc = supportCheck(shownSupportStatus(c.supportCheck), c.stance);
            const quoteOk = ["exact", "fuzzy", "human_attested"].includes(v.status);
            const chain = node?.chain?.length ? node.chain : [c.excerpt.source];
            const scanned = node?.snapshot?.origin === "internet_archive";
            return (
              <SourceFold
                key={c.id}
                anchor={sourceAnchor(c, i)}
                defaultOpen={evidential.length === 1}
                className={cn("border-t border-rule", evidential.length > 1 ? (i === 0 ? "mt-8 pt-3" : "pt-3") : "mt-8 pt-6")}
                label={
                  <>
                    <span className="text-ink-3 tnum">
                      {evidential.length > 1 ? `Source ${i + 1} of ${evidential.length}: ` : "The full chain: "}
                    </span>
                    {c.excerpt.source.short}
                    {c.excerpt.locatorLabel ? `, ${c.excerpt.locatorLabel}` : ""}
                  </>
                }
              >
                <ol>
                  {c.excerpt.quote ? (
                    <>
                      <Step label={STANCE_HEAD[c.stance] ?? "The words"} state={sc.state}>
                        <blockquote
                          className={cn(
                            "field border-l-2 py-3 pr-4 pl-4 text-base text-ink",
                            c.stance === "contradicts"
                              ? "border-madder"
                              : c.stance === "qualifies"
                                ? "border-turmeric"
                                : "border-indigo",
                          )}
                        >
                          “{c.excerpt.quote}”
                        </blockquote>
                        {otherNames(c.excerpt.quote, [
                          ...new Map([...people.values()].map((e) => [e.id, e])).values(),
                        ]).map((n) => (
                          <p key={n.label} className="font-sans text-ui text-ink-2">
                            {n.label} is also known as <span lang={n.lang}>{n.alias}</span>.{" "}
                            {n.note}
                          </p>
                        ))}
                        {c.excerpt.original && (
                          <p className="text-base text-ink-2" lang={c.excerpt.original.lang}>
                            {c.excerpt.original.text}
                          </p>
                        )}
                        <CheckLine state={sc.state}>{sc.text}</CheckLine>
                        {/* When the reviewer agrees, its reasoning mostly repeats the quote: folded. When it doubts, it says why, in view. */}
                        {c.supportCheck.note &&
                          (sc.state === "ok" ? (
                            <Disclosure
                              summary="The reviewer's reasoning"
                              className="pl-6"
                              triggerClassName="text-sm"
                            >
                              <p className="font-sans text-ui text-ink-2">{c.supportCheck.note}</p>
                            </Disclosure>
                          ) : (
                            <p className="pl-6 font-sans text-ui text-ink-2">
                              {c.supportCheck.note}
                            </p>
                          ))}
                        {c.note && <p className="font-sans text-ui text-ink-3">{c.note}</p>}
                      </Step>
                      <Step label="Where we found them" state={q.state}>
                        <CheckLine state={q.state}>{q.text}</CheckLine>
                        {ctx && (
                          <figure className="mt-1">
                            <figcaption className="font-sans text-ui text-ink-2">
                              {scanned
                                ? "This is scanned text; errors like ‘Biihler’ are the scanner’s. The highlighted words are what we matched."
                                : "This is the stored copy around the quote. The highlighted words are what we matched."}
                            </figcaption>
                            {/* A few words either side by default; the raw scan around it on request. */}
                            <p className="field mt-2 px-4 py-3 font-serif text-note leading-relaxed text-ink-2">
                              …{nearBefore(ctx.before)}
                              <mark className="rounded-[2px] bg-indigo-wash box-decoration-clone px-0.5 text-ink ring-1 ring-indigo-tint">
                                {ctx.match.replace(/\s+/g, " ")}
                              </mark>
                              {nearAfter(ctx.after)}…
                            </p>
                            <Disclosure
                              summary={
                                scanned
                                  ? "Show the scanned page text around it"
                                  : "Show more of the stored text"
                              }
                              className="mt-2"
                              triggerClassName="text-sm"
                            >
                              <div className="field px-4 py-3 font-serif text-note leading-relaxed whitespace-pre-line text-ink-2">
                                …{ctx.before}
                                <mark className="rounded-[2px] bg-indigo-wash box-decoration-clone px-0.5 text-ink ring-1 ring-indigo-tint">
                                  {ctx.match}
                                </mark>
                                {ctx.after}…
                              </div>
                            </Disclosure>
                          </figure>
                        )}
                        {node?.snapshot && (
                          <p className="font-sans text-sm text-ink-3">
                            Copy stored {DAY.format(node.snapshot.capturedAt)} from{" "}
                            {node.snapshot.url ? (
                              <a
                                href={node.snapshot.url}
                                className={LINK}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {node.snapshot.title ?? new URL(node.snapshot.url).host}
                              </a>
                            ) : (
                              (node.snapshot.title ?? "pasted text")
                            )}
                            {node.snapshot.archiveUrl && (
                              <>
                                {" "}
                                (
                                <a
                                  href={node.snapshot.archiveUrl}
                                  className={LINK}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  archived copy
                                </a>
                                )
                              </>
                            )}
                            . Its fingerprint,{" "}
                            <span className="tnum">{node.snapshot.sha256.slice(0, 12)}</span>, would
                            change if the copy ever did.
                          </p>
                        )}
                      </Step>
                    </>
                  ) : (
                    <Step label="Cited by page, without a quotation" state="open">
                      <p className="text-base text-ink">
                        {c.stance === "supports"
                          ? "Said to support the claim at "
                          : `${STANCE_HEAD[c.stance]?.replace("The words that ", "Said to ").replace(" it", " the claim") ?? "Cited"} at `}
                        {c.excerpt.locatorLabel || "an unstated place"}.
                      </p>
                      <CheckLine state="open">
                        Nobody has checked the wording yet, and whether it supports the claim is not
                        yet judged.
                      </CheckLine>
                      {c.note && <p className="font-sans text-ui text-ink-3">{c.note}</p>}
                    </Step>
                  )}

                  {chain.map((s, j) => (
                    <Step
                      key={s.id}
                      label={
                        j === 0
                          ? `In ${s.kind === "edition" ? "this edition" : "this source"}${c.excerpt.locatorLabel ? `, ${c.excerpt.locatorLabel}` : ""}`
                          : "Which is a version of"
                      }
                      state="ok"
                      last={j === chain.length - 1}
                    >
                      <p className="text-base text-ink">
                        <Link
                          href={`/s/${s.id}`}
                          className="decoration-indigo-tint underline-offset-3 hover:underline"
                        >
                          <Italics text={s.full} />
                        </Link>
                      </p>
                      <p className="font-sans text-sm text-ink-3">
                        {TIER_LABELS[s.tier] ?? s.tier}
                        {TIER_GLOSS[s.tier] && <>: {TIER_GLOSS[s.tier]}</>}
                        {s.composedLabel && <>; composed {s.composedLabel}</>}.
                        {/* Whether we may quote it matters for the copy we quote from, not for the work behind it. */}
                        {(j === 0 || s.license.status !== "unknown") && (
                          <span title={s.license.note ?? undefined}>
                            {" "}
                            {licenceWords(s.license.status)}.
                          </span>
                        )}
                      </p>
                    </Step>
                  ))}
                </ol>
                <div className="mt-6 pl-8">
                  <HumanChecks
                    citationId={c.id}
                    excerptId={c.excerpt.id}
                    path={`/c/${claim.id}`}
                    quoteChecked={quoteOk}
                  />
                </div>
              </SourceFold>
            );
          })}

          {mentions.length > 0 && (
            <div className="mt-8 border-t border-rule pt-5">
              <Disclosure
                summary={`Also mentioned in ${mentions.length} ${mentions.length === 1 ? "source" : "sources"}, without bearing on it`}
              >
                <ul className="space-y-1.5 font-sans text-ui text-ink-2">
                  {mentions.map((c) => (
                    <li key={c.id}>
                      <Link href={`/s/${c.excerpt.source.id}`} className={LINK}>
                        {c.excerpt.source.short}
                      </Link>
                      {c.excerpt.locatorLabel && <>, {c.excerpt.locatorLabel}</>}
                    </li>
                  ))}
                </ul>
              </Disclosure>
            </div>
          )}

          {/* The thing, then where it came from, then how to cite it. */}
          <section
            id="cite"
            aria-labelledby="cite-h"
            className="mt-10 scroll-mt-24 border-t border-rule pt-6"
          >
            <h2 id="cite-h" className="text-xl text-ink">
              Cite this
            </h2>
            <CiteThis
              className="mt-2"
              intro="To cite the claim as this site states it. To cite the evidence itself, cite the source above."
              citation={claimCitation({
                id: claim.id,
                text: claim.text,
                url: `${origin}/c/${claim.id}`,
                updated: claim.updatedAt,
                accessed: new Date(),
              })}
            />
          </section>
        </article>

        {/* ------------------------------------------------ rail: standing, pages, relations */}
        <aside className="min-w-0 space-y-7 lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <LiveNotes subject={{ type: "claim", id: claim.id }} />
          <div className="space-y-7 lg:sticky lg:top-20 min-[1800px]:grid min-[1800px]:grid-cols-2 min-[1800px]:gap-x-10 min-[1800px]:gap-y-7 min-[1800px]:space-y-0">
            <RailBlock title="Where it stands">
              <p className="flex items-center gap-2">
                <EvidenceSeal level={claim.level} tier={claimTier(claim)} />
                <span className="text-ink">{claim.levelLabel}</span>
              </p>
              <p className="mt-1.5">
                {evidential.length === 0
                  ? "No source yet."
                  : `Rests on ${evidential.length} ${evidential.length === 1 ? "source" : "sources"}${
                      evidential.some((c) => c.excerpt.source.tier === "primary")
                        ? ", including one from the time"
                        : ""
                    }.`}
              </p>
              {claim.jointSupport &&
                (() => {
                  const j = jointSupportCheck(
                    claim.jointSupport.status,
                    claim.jointSupport.state === "stale",
                  );
                  return (
                    <CheckLine state={j.state} className="mt-1.5">
                      {j.text}
                    </CheckLine>
                  );
                })()}
              {claim.lenses.length > 0 && (
                <p className="mt-1.5 text-ink-3">
                  Where this reading comes from:{" "}
                  {claim.lenses
                    .map((l) => LENS_LABELS[l] ?? l)
                    .join(", ")
                    .toLowerCase()}
                  .
                </p>
              )}
              {["supported", "well_supported"].includes(claim.assessment) && claim.level < 4 && (
                <p className="mt-1.5 text-ink-2">
                  Our assessment:{" "}
                  {(ASSESSMENT_LABELS[claim.assessment] ?? claim.assessment).toLowerCase()}, not yet
                  reviewed by a person.
                </p>
              )}
              <Disclosure summary="What the squares mean" className="mt-2" triggerClassName="text-sm">
                <SealLadder level={claim.level} />
              </Disclosure>
              <AddToDeckButton claimIds={[claim.id]} className="mt-3" />
              <AddToCanvas
                content={{ kind: "claim", claimId: claim.id }}
                what="this claim"
                className="mt-3 ml-1"
              />
            </RailBlock>

            {read.length > 0 && (
              <RailBlock title="Read it in context">
                <ul className="space-y-2">
                  {read.map((p) => (
                    <li key={p.slug}>
                      <Link href={`/p/${p.slug}#claim-${claim.id}`} className={LINK}>
                        {p.title}
                      </Link>
                      {p.part && (
                        <span className="block text-sm text-ink-3">
                          <span className="tnum">Part {p.part.index + 1}:</span> {p.part.title}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </RailBlock>
            )}

            {claim.entities.length > 0 && (
              <RailBlock title="Who and where">
                <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {claim.entities.map((e) => (
                    <li key={`${e.id}-${e.role}`}>
                      <Link href={`/e/${e.slug}`} className={LINK}>
                        {e.label}
                      </Link>
                      {ROLE_WORDS[e.role] && e.role !== "subject" && (
                        <span className="ml-1 text-sm text-ink-3">
                          ({ROLE_WORDS[e.role]!.toLowerCase()})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </RailBlock>
            )}

            {detail.relations.length > 0 && (
              <RailBlock title="Related claims">
                <ul className="space-y-3">
                  {detail.relations.map((r) => (
                    <li key={r.id}>
                      <p className="text-sm text-ink-3">
                        {(r.direction === "out" ? RELATION_OUT : RELATION_IN)[r.type] ??
                          r.type.replace(/_/g, " ")}
                      </p>
                      <Link
                        href={`/c/${r.other.id}`}
                        className="font-serif text-note text-ink hover:underline hover:decoration-indigo-tint hover:underline-offset-3"
                      >
                        {r.other.text}
                      </Link>
                      {r.note && <p className="mt-0.5 text-sm text-ink-3">{r.note}</p>}
                    </li>
                  ))}
                </ul>
              </RailBlock>
            )}

            {claim.foundVia.length > 0 && (
              <RailBlock title="How it was found">
                <ul className="space-y-1">
                  {claim.foundVia.map((f, i) => (
                    <li key={i}>
                      {f.title ? (
                        f.url ? (
                          <a href={f.url} className={LINK} target="_blank" rel="noreferrer">
                            {f.title}
                            <ArrowUpRight className="ml-0.5 inline size-3" aria-hidden />
                          </a>
                        ) : (
                          f.title
                        )
                      ) : (
                        f.via
                      )}
                      {f.revisionId && (
                        <span className="text-ink-3">, revision {f.revisionId}</span>
                      )}
                      {f.note && <span className="text-ink-3"> ({f.note})</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-ink-3">
                  Finding a claim in a reference work is not evidence for it; the words in the chain
                  are.
                </p>
              </RailBlock>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------ the audit record, demoted */}
        <section
          id="record"
          aria-label="Record of changes"
          className="min-w-0 scroll-mt-24 lg:col-start-2 lg:row-start-2"
        >
          <Disclosure
            summary="Show the record of changes to this claim"
            aside={`${detail.history.length} ${detail.history.length === 1 ? "entry" : "entries"}`}
            className="border-t border-rule pt-2"
          >
            <History entries={detail.history} />
          </Disclosure>
        </section>
      </div>
    </PageContainer>
  );
}
