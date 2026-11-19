import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfig, authEnabled } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Signs out (a form POST from the top bar) and returns home. */
export async function POST(req: NextRequest) {
  const origin = authEnabled() ? authConfig().origin : new URL(req.url).origin;
  const res = NextResponse.redirect(`${origin}/`, 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
