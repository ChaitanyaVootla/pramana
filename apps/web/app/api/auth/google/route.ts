import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, authConfig, authEnabled, randomToken, safeNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Starts Google sign-in: remembers where to return, then sends the browser to Google. */
export async function GET(req: NextRequest) {
  if (!authEnabled()) return NextResponse.redirect(new URL("/", req.url));
  const config = authConfig();
  const state = randomToken();
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: `${config.origin}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: config.origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return res;
}
