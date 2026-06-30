import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

/**
 * Optional site-wide password gate (Next.js 16 "proxy").
 * Enabled only when SITE_PASSWORD is set. Unauthenticated visitors are sent to
 * a /login page; a valid session cookie lets them through. The Telegram webhook
 * and the login route itself are always allowed.
 */
export async function proxy(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && token === (await sessionToken(password))) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Gate everything except the Telegram webhook and Next internals/assets.
  matcher: ["/((?!api/telegram|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
