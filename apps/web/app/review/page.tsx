import { orderForReview } from "@pramana/core";
import {
  activeApprovalDelegation,
  humanContext,
  listChangesets,
  listPages,
  type ChangesetView,
  type PageSummary,
} from "@pramana/services";
import Link from "next/link";
import { Disclosure } from "@/components/pages/Disclosure";
import { StopAutoApproval } from "@/components/StopAutoApproval";
import { groupCounts, StatusBadge } from "@/components/pages/review";
import { Description, Empty, PageContainer, PageTitle, SectionHeading } from "@/components/pages/Shell";
import { actorName, approverName, ordinal } from "@/lib/labels";

export const metadata = { title: "Proposed changes" };

const WHEN = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
/** On phones: "18 Oct, 21:41". */
const WHEN_SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** "your AI" at the start of a line: "Your AI". */
const capitalised = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** How it was decided, in a few words, for the phone's one meta line. */
function decision(c: ChangesetView, tries: number | undefined): string {
  const version = tries ? ` on the ${ordinal(tries)} version` : "";
  switch (c.status) {
    case "proposed":
      return "waiting for you";
    case "applied":
      return c.delegated ? `approved for you by ${approverName(c.decidedBy, c.delegated)}${version}` : `approved${version}`;
    case "rejected":
      return `rejected${version}`;
    case "failed":
      return "could not be applied";
    default:
      return c.status;
  }
}

export default async function ReviewList() {
  const [pending, recent, pages] = await Promise.all([
    listChangesets({ status: ["proposed"], limit: 100 }),
    listChangesets({ status: ["applied", "rejected", "withdrawn", "failed"], limit: 120 }),
    // Drafts too: proposals about a draft page are grouped under it.
    listPages({ includeDrafts: true }),
  ]);
  const ctx = await humanContext();
  const delegation =
    ctx.kind === "human" ? await activeApprovalDelegation(ctx.actorId).catch(() => null) : null;
  const order = orderForReview(pending);
  const groups = groupByPage(order, pages);
  const position = new Map(order.map((o, i) => [o.item.id, i + 1]));
  return (
    <PageContainer>
      <PageTitle>Proposed changes</PageTitle>
      <Description>
        {delegation
          ? "Nothing changes on the site until it is approved: by you, or for you under the instruction below."
          : "Nothing changes on the site until you approve it."}{" "}
        Each proposal is a draft: what it adds, which quotations were found in their sources, and any
        sourcing problems.
      </Description>

      {delegation && (
        <StopAutoApproval
          since={delegation.at.toISOString()}
          instruction={delegation.instruction}
        />
      )}

      <section aria-labelledby="waiting" className="mt-8">
        <SectionHeading
          id="waiting"
          aside={pending.length ? `${pending.length} waiting` : undefined}
        >
          Waiting for you
        </SectionHeading>
        {pending.length === 0 ? (
          <Empty className="mt-3">
            Nothing is waiting. When your AI proposes a change, it appears here for you to approve or
            reject.
          </Empty>
        ) : (
          <>
            <p className="mt-2 max-w-[64ch] font-sans text-note text-ink-2">
              In the order to review them: each proposal comes after the ones it builds on, so every
              approval stands on its own. Open one, read it, then approve or reject it.
            </p>
            <ol className="mt-5 space-y-8">
              {groups.map((g) => (
                <li key={g.key}>
                  <h3 className="font-sans text-ui font-semibold text-ink">
                    {g.page ? (
                      <Link href={`/p/${g.page.slug}`} className="no-underline hover:underline">
                        {g.page.title}
                      </Link>
                    ) : (
                      "Across the site"
                    )}
                    <span className="ml-2 font-normal text-ink-3 tnum">{g.rows.length}</span>
                  </h3>
                  <ChangesetRows
                    rows={g.rows.map((r) => r.item)}
                    order={g.rows}
                    position={position}
                  />
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      <section aria-labelledby="decided" className="mt-10">
        <SectionHeading id="decided">Recently decided</SectionHeading>
        {(() => {
          const { decided, withdrawn } = foldDecided(recent);
          if (!decided.length && !withdrawn.length)
            return <Empty className="mt-3">No decisions yet.</Empty>;
          return (
            <>
              {decided.length > 0 && (
                <ChangesetRows rows={decided.map((d) => d.item)} tries={tries(decided)} />
              )}
              {withdrawn.length > 0 && (
                <Disclosure
                  summary={`Show ${withdrawn.length} withdrawn ${withdrawn.length === 1 ? "proposal" : "proposals"}`}
                  className="mt-4"
                  triggerClassName="text-sm"
                >
                  <ChangesetRows rows={withdrawn.map((d) => d.item)} tries={tries(withdrawn)} />
                </Disclosure>
              )}
            </>
          );
        })()}
      </section>
    </PageContainer>
  );
}

type Folded = { item: ChangesetView; tries: number };

/**
 * Decided proposals as a reviewer wants them: the platform's own test runs
 * (actors named platform-*, or titled "platform check …") left out, retries with the same title folded
 * into their latest decision, and withdrawn ones kept apart.
 */
function foldDecided(rows: ChangesetView[]): { decided: Folded[]; withdrawn: Folded[] } {
  const byTitle = new Map<string, Folded>();
  for (const c of rows) {
    // The platform's own checks, whoever filed them.
    if (c.author.handle.startsWith("platform-") || /^platform check\b/i.test(c.title)) continue;
    const f = byTitle.get(c.title);
    // Rows come newest first: the first seen is the latest decision.
    if (f) f.tries += 1;
    else byTitle.set(c.title, { item: c, tries: 1 });
  }
  const all = [...byTitle.values()].slice(0, 40);
  return {
    decided: all.filter((f) => f.item.status !== "withdrawn"),
    withdrawn: all.filter((f) => f.item.status === "withdrawn"),
  };
}

function tries(rows: Folded[]): Map<string, number> {
  return new Map(rows.filter((r) => r.tries > 1).map((r) => [r.item.id, r.tries]));
}

type Ordered = ReturnType<typeof orderForReview<ChangesetView>>[number];

/** The page a proposal is about: the page it edits, else the page its title names. */
function pageOf(c: ChangesetView, pages: PageSummary[]): PageSummary | null {
  for (const op of c.ops) {
    const ref =
      op.op === "update_page" || op.op === "patch_page"
        ? op.page
        : op.op === "create_page"
          ? op.slug
          : null;
    const page = ref ? pages.find((p) => p.slug === ref || p.id === ref) : undefined;
    if (page) return page;
    if (op.op === "create_page") return { slug: op.slug, title: op.title } as PageSummary;
  }
  // Else the page whose name the title uses: its title, its subject's name, or its title's first phrase.
  const t = c.title.toLowerCase();
  const names = (p: PageSummary) =>
    [p.title, p.entity?.label ?? "", p.title.split(/\s+and\s+|:\s/)[0]!]
      .map((n) => n.toLowerCase().replace(/^the /, "").trim())
      .filter((n) => n.length > 3);
  let best: { page: PageSummary; len: number } | null = null;
  for (const p of pages)
    for (const n of names(p))
      if (t.includes(n) && (!best || n.length > best.len)) best = { page: p, len: n.length };
  return best?.page ?? null;
}

/** Waiting proposals by page, in review order (a page's group appears where its first proposal does). */
function groupByPage(order: Ordered[], pages: PageSummary[]) {
  const groups = new Map<string, { key: string; page: PageSummary | null; rows: Ordered[] }>();
  for (const o of order) {
    const page = pageOf(o.item, pages);
    const key = page?.slug ?? "site";
    const g = groups.get(key) ?? { key, page, rows: [] };
    g.rows.push(o);
    groups.set(key, g);
  }
  return [...groups.values()];
}

function ChangesetRows({
  rows,
  order,
  position,
  tries,
}: {
  rows: Awaited<ReturnType<typeof listChangesets>>;
  /** Proposals that took several tries: how many (the row shows the latest). */
  tries?: Map<string, number>;
  order?: Ordered[];
  position?: Map<string, number>;
}) {
  return (
    <ul className="mt-3 border-t border-rule">
      {rows.map((c) => {
        // Location-only citations have no quote to find, so they are not counted.
        const quotes = (c.report.excerptChecks ?? []).filter((q) => q.status !== "no_quote");
        const found = quotes.filter((q) => q.status === "exact" || q.status === "fuzzy").length;
        const missing = quotes.filter((q) => q.status === "not_found").length;
        const warnings = (c.report.claims ?? []).reduce(
          (n, cl) => n + cl.issues.filter((i) => i.severity === "warning").length,
          0,
        );
        return (
          <li
            key={c.id}
            className="grid gap-x-8 gap-y-1.5 border-b border-rule py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="min-w-0">
              {position?.get(c.id) && (
                <p className="mb-1 font-sans text-xs font-medium text-ink-3 tnum">
                  {position.get(c.id)}.{" "}
                  {(() => {
                    const o = order?.find((x) => x.item.id === c.id);
                    if (!o || o.ready)
                      return <span className="text-sage">Ready to review</span>;
                    return (
                      <span className="text-turmeric-ink">
                        Review first:{" "}
                        {o.waitingOn.map((d, i) => (
                          <span key={d.id}>
                            {i > 0 && ", "}
                            <Link href={`/review/${d.id}`} className="underline underline-offset-2">
                              {position.get(d.id)}. {d.title}
                            </Link>
                          </span>
                        ))}
                      </span>
                    );
                  })()}
                </p>
              )}
              <Link
                href={`/review/${c.id}`}
                className="font-heading text-lg leading-snug text-ink no-underline hover:text-indigo"
              >
                {c.title}
              </Link>
              {/* Phones: who, when and how it was decided, on one line. */}
              <p className="mt-0.5 font-sans text-sm text-ink-3 sm:hidden">
                {capitalised(actorName(c.author))}, <span className="tnum">{WHEN_SHORT.format(c.createdAt)}</span>,{" "}
                {decision(c, tries?.get(c.id))}
                <span className="text-ink-2 tnum">; {groupCounts(c.ops) || `${c.ops.length} changes`}</span>
                {quotes.length > 0 && (
                  <span className="tnum">
                    ; {found} of {quotes.length} quotes found
                    {missing > 0 && <span className="text-madder">, {missing} not found</span>}
                  </span>
                )}
                {warnings > 0 && (
                  <span className="text-turmeric-ink tnum">
                    ; {warnings} sourcing {warnings === 1 ? "warning" : "warnings"}
                  </span>
                )}
              </p>
              <p className="mt-0.5 hidden font-sans text-sm text-ink-3 sm:block">
                Proposed by {actorName(c.author)}
                {c.onBehalfOf && ` for ${c.onBehalfOf.displayName}`},{" "}
                <span className="tnum">{WHEN.format(c.createdAt)}</span>
                <span className="text-ink-2 tnum">; {groupCounts(c.ops) || `${c.ops.length} changes`}</span>
              </p>
            </div>
            {/* The decision and its facts on one line at the row's end, not a column of stacked lines. */}
            <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm text-ink-3 sm:flex sm:justify-end sm:pt-0.5 sm:text-right">
              {quotes.length > 0 && (
                <span className="text-ink-2 tnum">
                  {found} of {quotes.length} quotes found
                  {missing > 0 && <span className="text-madder">, {missing} not found</span>}
                </span>
              )}
              {warnings > 0 && (
                <span className="text-turmeric-ink tnum">
                  {warnings} sourcing {warnings === 1 ? "warning" : "warnings"}
                </span>
              )}
              {tries?.get(c.id) && (
                <span className="tnum">
                  {c.status === "applied" ? "approved" : "decided"} on the {ordinal(tries.get(c.id)!)} version
                </span>
              )}
              {c.delegated && <span>by {approverName(c.decidedBy, c.delegated)}</span>}
              <StatusBadge status={c.status} delegated={c.delegated} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
