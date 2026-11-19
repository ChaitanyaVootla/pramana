import { EntityKind, type ChangeOp } from "@pramana/core";
import {
  canEditContent,
  getChangeset,
  getPageView,
  humanContext,
  listEntities,
  listEvents,
  NotFoundError,
  type ChangesetView,
} from "@pramana/services";
import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { History } from "@/components/History";
import { Markdown } from "@/components/Markdown";
import { Disclosure } from "@/components/pages/Disclosure";
import {
  BordersGroup,
  GROUPS,
  OpView,
  PageEditDiff,
  StatusBadge,
  groupCounts,
  opsJson,
  type EntityNames,
  type Op,
} from "@/components/pages/review";
import { CONTAINER, LINK, RailBlock, TWO_COL } from "@/components/pages/Shell";
import { ReviewActions } from "@/components/ReviewActions";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { actorName } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  try {
    return await getChangeset(id);
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
  return { title: `Review: ${(await load(id)).title}` };
}

const WHEN = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Names for every entity a reviewer might meet: those proposed here or in earlier proposals, then the site's own. */
async function entityNames(changesets: ChangesetView[]): Promise<EntityNames> {
  const names: EntityNames = new Map();
  const existing = await listEntities([...EntityKind.options]).catch(() => []);
  for (const e of existing) {
    const n = { label: e.label, slug: e.slug, existing: true };
    names.set(e.id, n);
    names.set(e.slug, n);
  }
  for (const cs of changesets) {
    for (const op of cs.ops as Op[]) {
      if (op.op !== "create_entity") continue;
      const n = { label: op.label, slug: op.slug, existing: false };
      if (op.id && !names.has(op.id)) names.set(op.id, n);
      if (op.ref && !names.has(op.ref)) names.set(op.ref, n);
      if (op.slug && !names.has(op.slug)) names.set(op.slug, n);
    }
  }
  return names;
}

const PROSE =
  "max-w-[66ch] space-y-3 text-base text-ink-2 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1 [&_ul]:font-sans [&_ul]:text-ui [&_code]:font-sans [&_code]:text-ink";

/** The author's reasons. Long notes (dataset caveats, row lists) open on request after the first paragraphs. */
function Rationale({ text }: { text: string }) {
  const paras = text.trim().split(/\n\s*\n/);
  let lead = paras[0] ?? "";
  let i = 1;
  while (
    i < paras.length &&
    lead.length + paras[i]!.length < 700 &&
    !paras[i]!.trimStart().startsWith("-")
  )
    lead += `\n\n${paras[i++]}`;
  let rest = paras.slice(i).join("\n\n");
  if (rest.length < 400) {
    lead = text.trim();
    rest = "";
  }
  return (
    // The author's note reads as marginalia: the AI's words beside the draft, not the draft itself.
    <div className="marginalia mt-4">
      <Markdown className={PROSE}>{lead}</Markdown>
      {rest && (
        <Disclosure
          summary="Read the rest of the author's notes"
          aside={`${rest.length.toLocaleString("en-GB")} characters`}
          className="mt-3 max-w-[66ch]"
        >
          <Markdown className={PROSE}>{rest}</Markdown>
        </Disclosure>
      )}
    </div>
  );
}

export default async function ReviewDetail({ params }: Params) {
  const editor = canEditContent(await humanContext());
  const { id } = await params;
  const cs = await load(id);
  const deps = await Promise.all(cs.dependsOn.map((d) => getChangeset(d).catch(() => null)));
  const pendingDeps = deps.filter((d) => d?.status === "proposed").length;
  const [history, names] = await Promise.all([
    listEvents({ changesetId: cs.id, limit: 200 }),
    entityNames([cs, ...deps.filter((d): d is ChangesetView => Boolean(d))]),
  ]);
  const ops = cs.ops as Op[];
  // Page edits are compared with the page as it is now (while the proposal waits).
  const pageRefs = [
    ...new Set(
      ops.flatMap((o) => (o.op === "update_page" || o.op === "patch_page" ? [o.page] : [])),
    ),
  ];
  const currentPages = new Map(
    await Promise.all(
      pageRefs.map(async (ref) => {
        const v = cs.status === "proposed" ? await getPageView(ref).catch(() => null) : null;
        return [
          ref,
          v
            ? {
                title: v.page.title,
                summary: v.page.summary,
                blocks: v.page.blocks,
                version: v.page.version,
                spec: v.page.spec as Record<string, unknown>,
              }
            : null,
        ] as const;
      }),
    ),
  );
  const quoteChecks = cs.report.excerptChecks ?? [];
  const exact = quoteChecks.filter((q) => q.status === "exact").length;
  const fuzzy = quoteChecks.filter((q) => q.status === "fuzzy").length;
  const notFoundCount = quoteChecks.filter((q) => q.status === "not_found").length;
  const locationOnly = quoteChecks.filter((q) => q.status === "no_quote").length;
  const warnings = (cs.report.claims ?? []).reduce(
    (n, c) => n + c.issues.filter((i) => i.severity === "warning").length,
    0,
  );
  const counts = groupCounts(ops);
  const groupsPresent = GROUPS.filter((g) =>
    ops.some((o) => (g.ops as string[]).includes(o.op)),
  ).length;
  const hasBorders = ops.some((o) => o.op === "create_extent" || o.op === "update_extent");

  return (
    <div className={cn(CONTAINER, "pt-8 sm:pt-10")}>
      <Breadcrumb className="font-sans">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/review" />}>Proposed changes</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>One proposal</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className={cn(TWO_COL, "mt-5")}>
        <div className="min-w-0">
          {/* ------------------------------------------------ what this proposal is */}
          <header>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-sans text-ui text-ink-2">
              <StatusBadge status={cs.status} delegated={cs.delegated} />
              <span>
                Proposed by {actorName(cs.author)}
                {cs.author.kind !== "human" && <span className="text-ink-3"> (AI agent)</span>}
                {cs.onBehalfOf && ` for ${cs.onBehalfOf.displayName}`},{" "}
                <span className="tnum">{WHEN.format(cs.createdAt)}</span>
                {cs.sessionId && (
                  <>
                    {" "}
                    in{" "}
                    <Link
                      href={`/audit?session=${encodeURIComponent(cs.sessionId)}`}
                      className="hover:text-ink hover:underline"
                    >
                      session {cs.sessionId.slice(-8)}
                    </Link>
                  </>
                )}
              </span>
            </div>
            <h1 className="mt-3 text-2xl leading-tight text-ink sm:text-3xl">{cs.title}</h1>
            {cs.rationale && <Rationale text={cs.rationale} />}
            {cs.status === "proposed" && (
              <a
                href="#decision"
                className="mt-4 inline-block font-sans text-ui text-indigo underline decoration-indigo-tint underline-offset-3 lg:hidden"
              >
                Go to your decision
              </a>
            )}
          </header>

          {(cs.error || cs.decidedBy || deps.length > 0 || notFoundCount > 0) && (
            <div className="mt-6 space-y-3 font-sans text-ui">
              {cs.error && (
                <p className="flex gap-2 rounded-sm bg-madder-wash px-4 py-3 text-ink">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-madder" aria-hidden />
                  <span>Could not apply: {cs.error}</span>
                </p>
              )}
              {notFoundCount > 0 && (
                <p className="flex gap-2 rounded-sm bg-madder-wash px-4 py-3 text-ink">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-madder" aria-hidden />
                  <span>
                    {notFoundCount} {notFoundCount === 1 ? "quotation was" : "quotations were"} not
                    found in the stored source text. Check {notFoundCount === 1 ? "it" : "them"}{" "}
                    before approving.
                  </span>
                </p>
              )}
              {cs.decidedBy &&
                (cs.delegated ? (
                  <div className="rounded-sm bg-rule-soft px-4 py-3 text-ink-2">
                    <p className="text-ink">
                      {cs.decidedBy.kind === "agent"
                        ? "Approved by your AI for you, as you asked, "
                        : `Approved automatically by ${actorName(cs.decidedBy)}, `}
                      <span className="tnum">{cs.decidedAt ? WHEN.format(cs.decidedAt) : ""}</span>.
                      You did not review it yourself.
                    </p>
                    {cs.decisionNote && (
                      <p className="mt-1 text-sm text-ink-3">{cs.decisionNote}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-ink-2">
                    {cs.status === "applied"
                      ? "Approved"
                      : cs.status === "rejected"
                        ? "Rejected"
                        : "Decided"}{" "}
                    by {actorName(cs.decidedBy)},{" "}
                    <span className="tnum">{cs.decidedAt ? WHEN.format(cs.decidedAt) : ""}</span>
                    {cs.decisionNote && <span className="text-ink">: “{cs.decisionNote}”</span>}
                  </p>
                ))}
              {deps.length > 0 && (
                <div className="text-ink-2">
                  <p>
                    Builds on{" "}
                    {deps.length === 1 ? "an earlier proposal" : `${deps.length} earlier proposals`}
                    :
                  </p>
                  <ul className="mt-1 space-y-1">
                    {deps.map((d, i) =>
                      d ? (
                        <li key={d.id} className="flex flex-wrap items-center gap-2">
                          <Link href={`/review/${d.id}`} className={LINK}>
                            {d.title}
                          </Link>
                          <StatusBadge status={d.status} className="h-5 text-xs" />
                        </li>
                      ) : (
                        <li key={i} className="text-ink-3">
                          A proposal that can no longer be found ({cs.dependsOn[i]?.slice(-8)})
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------ the changes, grouped */}
          <h2 className="mt-10 text-xl text-ink">
            The draft: {ops.length.toLocaleString("en-GB")} {ops.length === 1 ? "change" : "changes"}
          </h2>
          {counts && counts.includes(",") && (
            <p className="mt-1 font-sans text-note text-ink-2">{counts}.</p>
          )}

          <div className="mt-4 divide-y divide-rule border-y border-rule">
            {GROUPS.map((g) => {
              const items = ops
                .map((op, i) => ({ op, i }))
                .filter(({ op }) => (g.ops as string[]).includes(op.op));
              if (!items.length) return null;
              return (
                <Disclosure
                  key={g.key}
                  defaultOpen={g.open || groupsPresent === 1}
                  className="py-3"
                  triggerClassName="py-1.5 text-note font-medium text-ink"
                  summary={`${items.length.toLocaleString("en-GB")} ${items.length === 1 ? g.one : g.many}`}
                  contentClassName="pb-3"
                >
                  {g.key === "borders" ? (
                    <BordersGroup
                      ops={
                        items.map(({ op }) => op) as Extract<
                          ChangeOp,
                          { op: "create_extent" | "update_extent" }
                        >[]
                      }
                      names={names}
                      refs={cs.refs}
                    />
                  ) : (
                    <ol className="divide-y divide-rule-soft">
                      {items.map(({ op, i }) => (
                        <li key={i} className="py-3 first:pt-1">
                          {(op.op === "update_page" || op.op === "patch_page") &&
                          cs.status === "proposed" ? (
                            <PageEditDiff op={op} current={currentPages.get(op.page) ?? null} />
                          ) : (
                            <OpView op={op} cs={cs} names={names} />
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </Disclosure>
              );
            })}
          </div>

          <div className="mt-8 divide-y divide-rule border-b border-rule">
            <Disclosure
              summary="Show the exact operations, as JSON"
              aside={hasBorders ? "border outlines shortened" : undefined}
              className="py-2"
            >
              <pre className="field max-h-[32rem] overflow-auto p-3 font-mono text-xs leading-relaxed text-ink-2">
                {opsJson(ops)}
              </pre>
            </Disclosure>
            <Disclosure
              summary="Show the record of this proposal"
              aside={`${history.length} ${history.length === 1 ? "entry" : "entries"}`}
              className="py-2"
            >
              <History entries={history} showSubject />
            </Disclosure>
          </div>
        </div>

        {/* ------------------------------------------------ rail: the checks, then the decision */}
        <aside className="min-w-0">
          <div className="space-y-7 lg:sticky lg:top-20">
            <RailBlock title="What was checked">
              {quoteChecks.length === 0 && warnings === 0 ? (
                <p>
                  This proposal adds no quotations or claims, so there is nothing to check against a
                  source.
                </p>
              ) : (
                <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 tnum">
                  <dt>Quotes found word for word</dt>
                  <dd className="text-right text-ink">{exact}</dd>
                  <dt>Found, with scanning differences</dt>
                  <dd className="text-right text-ink">{fuzzy}</dd>
                  <dt className={notFoundCount ? "text-madder" : undefined}>
                    Not found in the source
                  </dt>
                  <dd
                    className={cn(
                      "text-right",
                      notFoundCount ? "font-semibold text-madder" : "text-ink",
                    )}
                  >
                    {notFoundCount}
                  </dd>
                  <dt>Cited by page, no quote</dt>
                  <dd className="text-right text-ink">{locationOnly}</dd>
                  <dt className={warnings ? "text-turmeric-ink" : undefined}>Sourcing warnings</dt>
                  <dd
                    className={cn(
                      "text-right",
                      warnings ? "font-semibold text-turmeric-ink" : "text-ink",
                    )}
                  >
                    {warnings}
                  </dd>
                </dl>
              )}
            </RailBlock>
            {cs.status === "proposed" && !editor ? (
              <RailBlock title="Decision">
                <p className="text-sm text-ink-3">Waiting for the site's editor to read it.</p>
              </RailBlock>
            ) : cs.status === "proposed" ? (
              <RailBlock title="Your decision" className="scroll-mt-20" id="decision">
                <p className="mb-3 text-sm text-ink-3">
                  Nothing appears on the site until you approve it.
                </p>
                <ReviewActions
                  id={cs.id}
                  waitingOn={deps
                    .filter((d): d is ChangesetView => d?.status === "proposed")
                    .map((d) => ({ id: d.id, title: d.title }))}
                />
              </RailBlock>
            ) : (
              <RailBlock title="Decision">
                <StatusBadge status={cs.status} delegated={cs.delegated} />
              </RailBlock>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
