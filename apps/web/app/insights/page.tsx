import { getInsights, type Insights } from "@pramana/services";
import Link from "next/link";
import { CountList, LEVEL_PARTS, partsOf, pct, QUOTE_PARTS, StackBar, SUPPORT_PARTS, TIER_PARTS, Withheld } from "@/components/insights/Bars";
import { Description, PageContainer, PageTitle, RailBlock, SectionHeading, TWO_COL } from "@/components/pages/Shell";
import { cn } from "@/lib/utils";

export const metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const LINK = "text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo";

const ACTOR_KINDS: Record<string, string> = {
  human: "People",
  agent: "AI agents",
  importer: "Importers",
  system: "System (automatic approval in a preview copy)",
  unknown: "Unknown",
};

const STATUS_PARTS = {
  applied: { label: "Applied", className: "bg-indigo" },
  proposed: { label: "Waiting for review", className: "bg-indigo/35" },
  rejected: { label: "Rejected", className: "bg-ink/70" },
  withdrawn: { label: "Withdrawn", className: "bg-ink-3/40" },
  failed: { label: "Failed", className: "bg-turmeric" },
};

const LICENCE_LABELS: Record<string, string> = {
  public_domain: "Public domain",
  open: "Open licence",
  copyrighted: "In copyright",
  unknown: "Not yet recorded",
};

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const OP_LABELS: Record<string, string> = {
  cite: "Citations",
  relate_claims: "Links between claims",
  link_entities: "Links between subjects",
  create_entity: "New subjects (people, places, ideas)",
  update_entity: "Edited subjects",
  create_excerpt: "New quotations",
  delete_excerpt: "Removed quotations",
  create_extent: "New borders",
  update_extent: "Edited borders",
  create_media: "New pictures",
  update_media: "Edited pictures",
  create_claim: "New claims",
  update_claim: "Edited claims",
  create_page: "New pages",
  update_page: "Edited pages",
  create_source: "New sources",
  update_source: "Edited sources",
};
const opWords = (op: string) => {
  if (OP_LABELS[op]) return OP_LABELS[op];
  const [verb = "", ...rest] = op.split("_");
  const thing = rest.join(" ");
  return `${{ create: "New", update: "Edited", link: "Linked", delete: "Removed" }[verb] ?? verb} ${thing}`.trim();
};

/** The level sentence: where the sourcing stands, in words. */
function evidenceSummary(e: Insights["evidence"]["total"]): string {
  const checked = e.byLevel[3] + e.byLevel[4];
  const found = e.byLevel[2] + checked;
  return [
    `${e.claims} claims.`,
    `${pct(found, e.claims)} have their quote found in a stored copy of the source${checked ? `, and ${checked} have also been checked for support` : ", but none has yet been checked for support by an AI reviewer or a person"}.`,
    `${pct(e.byTier.primary, e.claims)} rest on a source from the time.`,
    e.tertiaryOnly ? `${e.tertiaryOnly} rest only on reference works such as encyclopedias.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

const unsupported = (e: Insights["evidence"]["total"]) => (e.support.ai_unsupported ?? 0) + (e.support.human_rejected ?? 0);

/** The support sentence: how the judged citations came out, and what the citations carry only together. */
function supportSummary(e: Insights["evidence"]["total"]): string {
  const n = (k: string) => e.support[k] ?? 0;
  const yes = n("ai_supports") + n("human_confirmed");
  const partly = n("ai_partial") + n("human_partial");
  const no = n("ai_unsupported") + n("human_rejected");
  const judged = yes + partly + no;
  if (!judged) return "No citation has been judged for support yet.";
  const jointYes = (e.joint.ai_supports ?? 0) + (e.joint.human_confirmed ?? 0);
  return [
    `${judged} citations have been judged for whether their words support the claim: ${yes} do, ${partly} only partly, and ${no} do not.`,
    partly ? "A partial citation usually carries one part of a claim whose other parts rest on other citations." : "",
    jointYes ? `${jointYes} claims are supported only by their citations read together.` : "",
    e.support.stale ? `${e.support.stale} ${e.support.stale === 1 ? "judgment no longer applies" : "judgments no longer apply"} because the claim, the quote or how it is cited has changed since.` : "",
    e.joint.stale ? `${e.joint.stale} joint ${e.joint.stale === 1 ? "judgment no longer applies" : "judgments no longer apply"} because the claim has changed since.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default async function InsightsPage() {
  const ins = await getInsights();
  const { evidence: ev, changes: ch, learning: le } = ins;
  const months = [...new Set(ch.opsByMonth.map((o) => o.month))].sort();
  const opTotals: Record<string, number> = {};
  for (const o of ch.opsByMonth) opTotals[o.op] = (opTotals[o.op] ?? 0) + o.count;

  return (
    <PageContainer>
      <PageTitle>Insights</PageTitle>
      <Description>How well the content is sourced, who changes it, and how learners answer its questions. Open, so patterns and biases are easy to see.</Description>

      <div className={cn(TWO_COL, "mt-8")}>
        <div className="min-w-0 space-y-14">
          {/* ---------------------------------------------------- evidence */}
          <section aria-labelledby="evidence" className="space-y-6">
            <SectionHeading id="evidence">Evidence health</SectionHeading>
            <p className="max-w-[62ch] font-sans text-note text-ink-2 tnum">{evidenceSummary(ev.total)}</p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-sans text-ui font-semibold text-ink">How far each claim's sourcing has been checked</h3>
                <StackBar className="mt-2" label="How far each claim's sourcing has been checked" parts={partsOf(ev.total.byLevel, LEVEL_PARTS)} />
              </div>
              <div>
                <h3 className="font-sans text-ui font-semibold text-ink">The best kind of source behind each claim</h3>
                <StackBar className="mt-2" label="The best kind of source behind each claim" parts={partsOf(ev.total.byTier, TIER_PARTS)} />
              </div>
              <div className="sm:col-span-2">
                <h3 className="font-sans text-ui font-semibold text-ink">Quotations cited, by how they were checked</h3>
                <StackBar className="mt-2" label="Quotations cited, by how they were checked" parts={partsOf(ev.total.quotes, QUOTE_PARTS)} />
              </div>
              <div className="sm:col-span-2">
                <h3 className="font-sans text-ui font-semibold text-ink">Citations, by whether their words support the claim</h3>
                <p className="mt-0.5 max-w-[62ch] font-sans text-sm text-ink-3 tnum">{supportSummary(ev.total)}</p>
                <StackBar className="mt-2" label="Citations, by whether their words support the claim" parts={partsOf(ev.total.support, SUPPORT_PARTS)} />
              </div>
            </div>

            <div>
              <h3 className="font-sans text-ui font-semibold text-ink">Page by page</h3>
              <ul className="mt-2 divide-y divide-rule-soft border-y border-rule-soft">
                {ev.pages.map((p) => (
                  <li key={p.slug} className="grid gap-x-6 gap-y-2 py-3 sm:grid-cols-[12rem_1fr_1fr]">
                    <div className="font-sans">
                      <Link href={`/p/${p.slug}`} className="font-heading text-lg text-ink hover:underline hover:decoration-indigo-tint hover:underline-offset-3">
                        {p.title}
                      </Link>
                      <p className="text-sm text-ink-3 tnum">
                        {p.claims} claims{p.tertiaryOnly ? `, ${p.tertiaryOnly} on reference works only` : ""}
                        {unsupported(p) === 1 ? ", 1 citation judged not to support its claim" : unsupported(p) ? `, ${unsupported(p)} citations judged not to support their claims` : ""}
                      </p>
                    </div>
                    <StackBar label={`${p.title}: how far each claim's sourcing has been checked`} parts={partsOf(p.byLevel, LEVEL_PARTS)} />
                    <StackBar label={`${p.title}: the best kind of source behind each claim`} parts={partsOf(p.byTier, TIER_PARTS)} />
                  </li>
                ))}
              </ul>
            </div>

            {ev.thinChapters.length > 0 && (
              <div>
                <h3 className="font-sans text-ui font-semibold text-ink">Where the evidence is thin</h3>
                <p className="mt-0.5 font-sans text-sm text-ink-3">Chapters where at least a third of the claims have no quote found in a stored source, or rest only on reference works.</p>
                <ul className="mt-2 space-y-1 font-sans text-ui">
                  {ev.thinChapters.map((c) => (
                    <li key={`${c.page}#${c.chapterId}`} className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <Link href={`/p/${c.page}#${c.chapterId}`} className={LINK}>
                        {c.title}
                      </Link>
                      <span className="text-sm text-ink-3 tnum">
                        {c.thin} of {c.claims} claims thin, in {ev.pages.find((p) => p.slug === c.page)?.title ?? c.page}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="font-sans text-ui font-semibold text-ink">The {ev.sources.total} sources</h3>
              <div className="mt-2 grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="mb-1 font-sans text-sm text-ink-3">By how close to the events</p>
                  <CountList counts={ev.sources.byTier} labels={{ primary: "From the time", secondary: "Modern scholarship", tertiary: "Reference work" }} />
                </div>
                <div>
                  <p className="mb-1 font-sans text-sm text-ink-3">By form</p>
                  <CountList counts={ev.sources.byKind} />
                </div>
                <div>
                  <p className="mb-1 font-sans text-sm text-ink-3">By licence</p>
                  <CountList counts={ev.sources.byLicence} labels={LICENCE_LABELS} />
                </div>
              </div>
            </div>
          </section>

          {/* ----------------------------------------------------- changes */}
          <section aria-labelledby="changes" className="space-y-6">
            <SectionHeading id="changes" aside={`${ch.total} proposed changes`}>
              Who changes what
            </SectionHeading>
            <p className="max-w-[62ch] font-sans text-note text-ink-2">
              Every change is first proposed, checked by a trial run that writes nothing, and made only when someone approves it. Who proposed and who decided comes from the{" "}
              <Link href="/audit" className={LINK}>
                history of changes
              </Link>
              , which cannot be edited.
            </p>
            <div>
              <h3 className="font-sans text-ui font-semibold text-ink">Proposed by, and what became of them</h3>
              <ul className="mt-2 space-y-3">
                {ch.byAuthor.map((a) => (
                  <li key={a.kind} className="grid gap-x-6 gap-y-1 sm:grid-cols-[12rem_1fr]">
                    <span className="font-sans text-ui text-ink">
                      {ACTOR_KINDS[a.kind] ?? a.kind} <span className="text-sm text-ink-3 tnum">{a.total}</span>
                    </span>
                    <StackBar label={`Changes proposed by ${ACTOR_KINDS[a.kind] ?? a.kind}`} parts={partsOf(a.byStatus, STATUS_PARTS)} />
                  </li>
                ))}
              </ul>
              {Object.keys(ch.decidedBy).length > 0 && (
                <p className="mt-3 font-sans text-sm text-ink-3 tnum">
                  Decided by:{" "}
                  {Object.entries(ch.decidedBy)
                    .map(([k, n]) => `${(ACTOR_KINDS[k] ?? k).toLowerCase()} ${n}`)
                    .join(", ")}
                  . On the main site only a person can approve; in a preview copy, changes are approved automatically.
                </p>
              )}
            </div>
            {ch.opsByMonth.length > 0 && (
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="font-sans text-ui font-semibold text-ink">What was changed</h3>
                  <CountList className="mt-2" counts={opTotals} labels={Object.fromEntries(Object.keys(opTotals).map((op) => [op, opWords(op)]))} />
                </div>
                <div>
                  <h3 className="font-sans text-ui font-semibold text-ink">Edits by month</h3>
                  <CountList
                    className="mt-2"
                    counts={Object.fromEntries(months.map((m) => [m, ch.opsByMonth.filter((o) => o.month === m).reduce((x, o) => x + o.count, 0)]))}
                    labels={Object.fromEntries(months.map((m) => [m, MONTH.format(new Date(`${m}-01T00:00:00Z`))]))}
                  />
                </div>
              </div>
            )}
          </section>

          {/* ---------------------------------------------------- learning */}
          <section aria-labelledby="learning" className="space-y-6">
            <SectionHeading id="learning" aside={`${le.learners} ${le.learners === 1 ? "learner" : "learners"}`}>
              How learners answer
            </SectionHeading>
            <p className="max-w-[62ch] font-sans text-note text-ink-2">
              Only totals across learners are shown, never anyone's own answers. A share is shown once at least {ins.minGroup} learners have answered; until then you see only how many answers there are.
            </p>

            <div>
              <h3 className="font-sans text-ui font-semibold text-ink">Sure, and wrong</h3>
              <p className="mt-1 font-sans text-note text-ink-2 tnum">
                {le.confidentErrors.value
                  ? `Of ${le.confidentErrors.value.sure} answers given as “sure”, ${le.confidentErrors.value.wrong} (${pct(le.confidentErrors.value.wrong, le.confidentErrors.value.sure)}) were wrong. Those cards come back sooner.`
                  : "How often learners are sure and wrong."}{" "}
                <Withheld a={le.confidentErrors} minGroup={ins.minGroup} />
              </p>
            </div>

            <div>
              <h3 className="font-sans text-ui font-semibold text-ink">Popular beliefs: who believed them before reading</h3>
              {le.beliefs.length === 0 ? (
                <p className="mt-1 font-sans text-sm text-ink-3">No one has answered “Did you believe this?” yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-rule-soft border-y border-rule-soft">
                  {le.beliefs.map((b) => (
                    <li key={b.claimId} className="grid gap-x-6 gap-y-1 py-2.5 sm:grid-cols-[1fr_14rem]">
                      <Link href={`/c/${b.claimId}`} className="font-serif text-base text-ink italic hover:underline hover:decoration-indigo-tint hover:underline-offset-3">
                        “{b.text}”
                      </Link>
                      <div>
                        {b.answers.value && (
                          <StackBar
                            label="Did you believe this?"
                            parts={[
                              { key: "yes", label: "Believed it", value: b.answers.value.yes, className: "bg-turmeric" },
                              { key: "unsure", label: "Not sure", value: b.answers.value.unsure, className: "bg-ink-3/35" },
                              { key: "no", label: "Did not", value: b.answers.value.no, className: "bg-indigo/55" },
                            ]}
                          />
                        )}
                        <Withheld a={b.answers} minGroup={ins.minGroup} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-sans text-ui font-semibold text-ink">Guess first: how close the first guesses were</h3>
              {le.guesses.length === 0 ? (
                <p className="mt-1 font-sans text-sm text-ink-3">No guesses yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-rule-soft border-y border-rule-soft">
                  {le.guesses.map((g) => (
                    <li key={`${g.page}#${g.blockId}`} className="grid gap-x-6 gap-y-1 py-2.5 sm:grid-cols-[1fr_14rem]">
                      <Link href={`/p/${g.page}#${g.blockId}`} className="font-sans text-ui text-ink hover:underline hover:decoration-indigo-tint hover:underline-offset-3">
                        {g.question}
                      </Link>
                      <div>
                        {g.answers.value && (
                          <StackBar
                            label="First guesses"
                            parts={[
                              { key: "right", label: "Right", value: g.answers.value.right, className: "bg-indigo" },
                              { key: "close", label: "Close", value: g.answers.value.close, className: "bg-indigo/45" },
                              { key: "off", label: "Off", value: g.answers.learners - g.answers.value.right - g.answers.value.close, className: "bg-ink-3/25" },
                            ]}
                          />
                        )}
                        <Withheld a={g.answers} minGroup={ins.minGroup} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-sans text-ui font-semibold text-ink">The hardest claims to remember</h3>
              {le.hardest.length > 0 ? (
                <ol className="mt-2 space-y-1.5 font-sans text-ui">
                  {le.hardest.map((h) => (
                    <li key={h.claimId} className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <Link href={`/c/${h.claimId}`} className="text-ink hover:underline hover:decoration-indigo-tint hover:underline-offset-3">
                        {h.text}
                      </Link>
                      <span className="text-sm text-ink-3 tnum">
                        forgotten {h.reviews.value!.lapses} times, by {h.reviews.value!.learnersLapsed} of {h.reviews.learners} learners
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <p className="mt-1 font-sans text-sm text-ink-3 tnum">
                {le.hardestWithheld > 0
                  ? `${le.hardestWithheld} ${le.hardestWithheld === 1 ? "claim has" : "claims have"} been reviewed by fewer than ${ins.minGroup} learners, so ${le.hardestWithheld === 1 ? "it is" : "they are"} not ranked yet.`
                  : le.hardest.length === 0
                    ? "No reviews yet."
                    : ""}
              </p>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-7">
          <RailBlock title="What the levels mean">
            <p>
              A claim's level says how far its sourcing has been checked, not whether it is true: cited; quote found in a stored copy of the source; support
              judged by an AI reviewer; checked by a person. Whether it is true is the separate assessment.
            </p>
          </RailBlock>
          <RailBlock title="Privacy">
            <p>
              Learning figures are totals over learners. A share appears only when {ins.minGroup} or more learners have answered, so no one's answer can be
              read off a small group. Test accounts are left out.
            </p>
          </RailBlock>
          <RailBlock title="Ask your AI">
            <p>
              A connected AI can read the same figures. Ask it, for example: &ldquo;Which chapters have
              the thinnest evidence?&rdquo;
            </p>
          </RailBlock>
        </aside>
      </div>
    </PageContainer>
  );
}
