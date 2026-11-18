import { dueCards, getPageView, getProgress, humanContext, newCardsLeftToday, nextPart, partAt } from "@pramana/services";
import { redirect } from "next/navigation";
import { TodaySession, type Step } from "@/components/learn/TodaySession";
import { PageContainer, PageTitle } from "@/components/pages/Shell";

export const metadata = { title: "Today" };
export const dynamic = "force-dynamic";

const STEPS: Step[] = ["part", "check", "cards", "end"];

/** Today's study, from one button: the next part, its check, the cards due, then a recap. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ part?: string; step?: string; plan?: string; n?: string }> }) {
  const ctx = await humanContext();
  const params = await searchParams;
  // The session is pinned to one part in the URL (?part=<page>/<part id>), so answering it, which moves
  // "the next part" on, never swaps the part mid-session, even if the page reloads. Once today's new
  // cards are all met, a session started without one has no part: the next waits for tomorrow.
  const pinned = params.part?.split("/");
  if (!pinned) {
    const [next, fresh] = await Promise.all([nextPart(ctx), newCardsLeftToday(ctx)]);
    if (next && fresh.left > 0) redirect(`/learn/today?part=${next.pageSlug}/${next.chapterId}`);
  }
  const step = STEPS.find((s) => s === params.step);
  // The plan the session started with (written into the URL by the session itself).
  const planSteps = params.plan?.split(",").filter((s): s is Step => STEPS.includes(s as Step));
  const plan = planSteps?.length ? { steps: planSteps, cards: Math.max(0, Number(params.n) || 0) } : undefined;
  const [part, cards, progress] = await Promise.all([
    pinned?.length === 2 ? partAt(ctx, pinned[0]!, pinned[1]!) : null,
    dueCards(ctx, { limit: 20 }),
    getProgress(ctx),
  ]);
  const view = part ? await getPageView(part.pageSlug).catch(() => null) : null;
  return (
    // The session is one reading-width column (--reading-w), centred.
    <PageContainer>
      <div className="mx-auto max-w-(--reading-w)">
        <PageTitle>Today</PageTitle>
        {/* Keyed by part, so "Keep going" to the next part starts a fresh session. */}
        <TodaySession key={params.part ?? ""} part={part} view={view} cards={cards} totalDue={progress.deck.due} step={step} plan={plan} />
      </div>
    </PageContainer>
  );
}
