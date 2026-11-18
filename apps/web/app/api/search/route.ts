import { search } from "@pramana/services";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Search for the ⌘K palette. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200);
  return NextResponse.json(await search(q, { limit: 6 }));
}
