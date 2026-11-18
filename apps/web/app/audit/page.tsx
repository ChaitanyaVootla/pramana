import { humanContext, listEvents } from "@pramana/services";
import Link from "next/link";
import { History } from "@/components/History";
import { Description, PageContainer, PageTitle } from "@/components/pages/Shell";

export const metadata = { title: "History of changes" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  // Your own study and workspace events, and content changes by anyone; never another learner's.
  const entries = await listEvents({ sessionId: session, limit: 300, viewer: (await humanContext()).actorId });
  return (
    <PageContainer>
      <PageTitle>History of changes</PageTitle>
      <Description>
        Every change and check, newest first: who made it, who they acted for, and, for an AI, which connection it came through. This record cannot be edited.
      </Description>
      {session && (
        <p className="mt-4 font-sans text-ui text-ink-2">
          Showing one AI connection, <span className="tnum">{session.slice(-8)}</span>.{" "}
          <Link href="/audit" className="text-indigo underline decoration-indigo-tint underline-offset-3 hover:decoration-indigo">
            Show everything
          </Link>
        </p>
      )}
      <div className="mt-6">
        <History entries={entries} showSubject />
      </div>
      {entries.length === 300 && <p className="mt-3 font-sans text-sm text-ink-3">Showing the latest 300 entries.</p>}
    </PageContainer>
  );
}
