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
