import { ensureActor } from "@pramana/services";
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  STATE_COOKIE,
  authConfig,
  authEnabled,
  encodeSession,
  identityFor,
  safeNext,
  safePicture,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

interface IdClaims {
  iss: string;
  aud: string;
  sub: string;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
}

/**
 * Google sends the browser back here with a code. The code is exchanged for an
 * ID token directly with Google over TLS, so its claims can be trusted without
 * checking the signature (OpenID Connect Core 3.1.3.7); issuer, audience and
 * expiry are still checked.
 */
export async function GET(req: NextRequest) {
  const origin = authEnabled() ? authConfig().origin : new URL(req.url).origin;
  const fail = (why: string) =>
    NextResponse.redirect(`${origin}/?signin=${encodeURIComponent(why)}`);
  if (!authEnabled()) return fail("off");
  const config = authConfig();

  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? "{}");
  } catch {
    // treated as a missing state below
  }
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("cancelled");
  const code = params.get("code");
  if (!code || !saved.state || params.get("state") !== saved.state) return fail("expired");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: `${config.origin}/api/auth/callback/google`,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!tokenRes.ok) {
    console.warn(
      "google token exchange failed",
      tokenRes.status,
      (await tokenRes.text()).slice(0, 300),
    );
    return fail("google");
  }
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  const part = idToken?.split(".")[1];
  if (!part) return fail("google");
  const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as IdClaims;
  const issuerOk =
    claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!issuerOk || claims.aud !== config.clientId || claims.exp * 1000 < Date.now() || !claims.sub)
    return fail("google");

  const who = identityFor(claims, config);
  await ensureActor(who.handle, "human", who.name);
  const picture = safePicture(claims.picture);
  const session = encodeSession({ h: who.handle, n: who.name, ...(picture ? { p: picture } : {}) }, config.secret);
  const res = NextResponse.redirect(`${config.origin}${safeNext(saved.next)}`);
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    secure: config.origin.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth" });
  return res;
}
