import { QueuedReviewsInput } from "@pramana/core";
import { recordQueuedReviews, SignInRequired } from "@pramana/services";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { writerContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Review answers queued on the device (offline study), recorded as the local
 * learner. Idempotent per answer key. Only same-origin JSON is accepted, so
 * another site cannot post answers on the learner's behalf.
 */
export async function POST(req: NextRequest) {
  // Compare with the Host header: behind the dev server nextUrl may say "localhost" for 127.0.0.1.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "cross-origin request refused" }, { status: 403 });
  if (!req.headers.get("content-type")?.includes("application/json"))
    return NextResponse.json({ error: "send JSON" }, { status: 415 });
  try {
    const input = QueuedReviewsInput.parse(await req.json());
    const results = await recordQueuedReviews(await writerContext("Keeping your reviews"), input);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SignInRequired) return NextResponse.json({ error: error.message }, { status: 401 });
    const message = error instanceof z.ZodError ? z.prettifyError(error) : error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
