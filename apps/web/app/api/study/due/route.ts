import { dueCards, humanContext } from "@pramana/services";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The learner's cards due now and over the next few days (`?days=`, 0–14,
 * default 3), as JSON, so the study session can go on offline: the service
 * worker keeps the last copy, and the session shows each card once it is due.
 */
export async function GET(req: NextRequest) {
  const days = Math.min(14, Math.max(0, Number(req.nextUrl.searchParams.get("days") ?? 3) || 0));
  const generatedAt = new Date();
  const until = new Date(generatedAt.getTime() + days * 86_400_000);
  const cards = await dueCards(await humanContext(), { limit: 100, until });
  return NextResponse.json({ generatedAt, until, cards }, { headers: { "Cache-Control": "private, no-store" } });
}
