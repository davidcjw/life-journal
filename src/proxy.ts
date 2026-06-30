import { NextRequest, NextResponse } from "next/server";

/**
 * Optional site-wide password gate via HTTP Basic auth (Next.js 16 "proxy").
 * Enabled only when SITE_PASSWORD is set. The Telegram webhook is excluded
 * (it authenticates with its own secret token).
 */
export function proxy(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const supplied = decoded.slice(decoded.indexOf(":") + 1);
      if (supplied === password) return NextResponse.next();
    } catch {
      /* fall through to 401 */
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Live Journal", charset="UTF-8"' },
  });
}

export const config = {
  // Gate everything except the Telegram webhook and Next internals/assets.
  matcher: ["/((?!api/telegram|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
