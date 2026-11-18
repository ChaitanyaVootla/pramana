import { repoRoot } from "@pramana/db";
import { checkLocalRequest, getMcpToken, humanContext, listAgentSessions } from "@pramana/services";
import { headers } from "next/headers";
import { LiveNotes } from "@/components/ai/LiveNotes";
import { Disclosure } from "@/components/pages/Disclosure";
import { PageContainer, PageTitle, Lede } from "@/components/pages/Shell";
import { ConnectSetup, YourKey } from "./ConnectSetup";
import { ConnectStatus } from "./ConnectStatus";
import { SessionList } from "./SessionList";
import { WhatYourAiCanDo } from "./WhatYourAiCanDo";

export const metadata = { title: "Connect your AI" };
export const dynamic = "force-dynamic";

/**
 * How to connect the reader's own AI (Claude Code, Claude Desktop, any MCP
 * client) to this copy of Pramāṇa: a one-click extension for Claude Desktop,
 * a copy-ready set-up for the others, a check, the key, and recent sessions.
 */
export default async function ConnectPage() {
  const h = await headers();
  const local = checkLocalRequest(h);
  if (!local.ok) {
    // Never show the token to a page that is not this computer's (DNS rebinding).
    return (
      <PageContainer narrow>
        <PageTitle>Connect your AI</PageTitle>
        <Lede>
          Open this page at http://127.0.0.1 on the computer running Pramāṇa to see how to connect.
        </Lede>
      </PageContainer>
    );
  }
  // 127.0.0.1, as the extension uses: "localhost" may be looked up as ::1, where nothing listens.
  const port = /:(\d+)$/.exec(h.get("host")!)?.[1];
  const url = `http://127.0.0.1${port ? `:${port}` : ""}/api/mcp`;
  const extension = port && port !== "3000" ? `pramana-${port}.mcpb` : "pramana.mcpb";
  const token = getMcpToken();
  const human = await humanContext();
  const sessions = await listAgentSessions({ forActorId: human.actorId, limit: 60 });
  return (
    <PageContainer>
      <div className="xl:grid xl:grid-cols-[minmax(0,48rem)_minmax(0,1fr)] xl:gap-x-16">
        <div className="max-w-[48rem]">
          <PageTitle>Connect your AI</PageTitle>
          {/* The state first, then two sentences; the rest folds (a phone shows the steps sooner). */}
          <ConnectStatus className="mt-4" />
          <Lede className="mt-6">
            Pramāṇa has no AI of its own. Connect yours, such as Claude, and it can quiz you, explain
            the evidence, and leave notes beside what you read.
          </Lede>
          <Disclosure
            summary="What it can change, and how you see it"
            className="mt-2 font-sans"
            triggerClassName="text-ui text-ink-2"
          >
            <p className="pb-1 text-ui text-ink-2">
              Any change it suggests to the site waits for you to approve. Your own views and
              canvases it can change at once, and you can undo it. Everything it does is shown under
              its own name, in the history of changes.
            </p>
          </Disclosure>
          <p className="mt-3 font-sans text-ui text-ink-2 md:hidden">
            Do this on the computer where Pramāṇa runs: your AI app connects to it there.
          </p>
          <ConnectSetup
            className="mt-10"
            url={url}
            token={token}
            root={repoRoot()}
            node={process.execPath}
            extension={extension}
          />
        </div>
        {/* The rail: one column (what it can do, sessions, notes, key) below 2xl, two side by side from there. */}
        <aside className="mt-12 flex max-w-[48rem] flex-col gap-12 xl:mt-0 xl:max-w-none xl:pt-2 2xl:grid 2xl:grid-cols-2 2xl:items-start 2xl:gap-x-12">
          <div className="contents 2xl:block 2xl:space-y-12">
            <WhatYourAiCanDo className="order-1" />
            <YourKey className="order-4" token={token} />
          </div>
          <div className="contents 2xl:block 2xl:space-y-12">
            <SessionList className="order-2" sessions={sessions} />
            <LiveNotes
              recent
              limit={3}
              title="Latest notes from your AI"
              headingClassName="font-serif text-xl font-normal"
              className="order-3"
            />
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
