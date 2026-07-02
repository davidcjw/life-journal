import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "lj_session";

/**
 * Derive an opaque session token from the site password. Used by both the
 * proxy (edge) and the login route (node) — Web Crypto is available in both.
 * The raw password never lands in the cookie.
 */
export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`life-journal:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time string comparison. Guards against length mismatch first
 * (timingSafeEqual throws on unequal-length Buffers), then defers to
 * crypto.timingSafeEqual so the comparison does not short-circuit and leak
 * timing information about the password/token.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Authorize a mutating request. WRITE endpoints (create/edit/delete) must
 * always require a valid owner session, independent of whether SITE_PASSWORD
 * gates public reads. When SITE_PASSWORD is unset there is no owner session to
 * validate against, so writes fail closed (401) rather than falling open.
 *
 * Returns a 401 NextResponse when the caller is unauthenticated/invalid, or
 * `null` when the request is authorized and the handler may proceed.
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const unauthorized = () =>
    NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const password = process.env.SITE_PASSWORD ?? "";
  if (!password) return unauthorized();

  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (!token) return unauthorized();

  const expected = await sessionToken(password);
  if (!timingSafeStringEqual(token, expected)) return unauthorized();

  return null;
}
