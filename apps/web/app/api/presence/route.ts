import { checkLocalRequest, getPresence, humanContext } from "@pramana/services";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Is the reader's AI connected? Agent sessions acting for the local user, active in the last few minutes. */
export async function GET(request: Request) {
  const local = checkLocalRequest(request.headers);
  if (!local.ok) return NextResponse.json({ error: local.reason }, { status: local.status });
  const human = await humanContext();
  return NextResponse.json(await getPresence(human.actorId));
}
