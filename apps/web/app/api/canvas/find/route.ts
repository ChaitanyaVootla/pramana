import { findForCanvas } from "@pramana/services";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The canvas's insert search (?q=): claims, entities, parts of pages and pictures. */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 200);
  return NextResponse.json(await findForCanvas(q));
}
