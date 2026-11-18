import { openHttpSessions, selfTest } from "@pramana/mcp/http";
import { checkLocalRequest, getPresence, humanContext } from "@pramana/services";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** "Check Pramāṇa is ready" on /connect: does the endpoint answer, and is an AI using it? */
export async function GET(request: Request) {
  const local = checkLocalRequest(request.headers);
  if (!local.ok) return NextResponse.json({ error: local.reason }, { status: local.status });
  const origin = new URL(request.url).origin;
  const [endpoint, presence] = await Promise.all([
    selfTest(origin),
    humanContext().then((h) => getPresence(h.actorId)),
  ]);
  return NextResponse.json({
    url: `${origin}/api/mcp`,
    endpoint,
    openSessions: openHttpSessions(),
    presence,
  });
}
