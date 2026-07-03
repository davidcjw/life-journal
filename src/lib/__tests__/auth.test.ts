import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  requireAuth,
  sessionToken,
  timingSafeStringEqual,
} from "../auth";

/**
 * Build a minimal NextRequest-like object exposing only the `cookies.get`
 * surface that requireAuth touches. Passing `undefined` for the token omits
 * the session cookie entirely.
 */
function fakeRequest(token?: string): NextRequest {
  return {
    cookies: {
      get(name: string) {
        if (name === SESSION_COOKIE && token !== undefined) {
          return { name, value: token };
        }
        return undefined;
      },
    },
  } as unknown as NextRequest;
}

describe("sessionToken", () => {
  it("returns a 64-char lowercase hex SHA-256 string", async () => {
    const token = await sessionToken("hunter2");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across calls for the same password", async () => {
    const a = await sessionToken("hunter2");
    const b = await sessionToken("hunter2");
    expect(a).toBe(b);
  });

  it("produces different tokens for different passwords", async () => {
    const a = await sessionToken("hunter2");
    const b = await sessionToken("hunter3");
    expect(a).not.toBe(b);
  });
});

describe("timingSafeStringEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeStringEqual("correct-horse", "correct-horse")).toBe(true);
  });

  it("returns true for identical multi-byte/unicode strings", () => {
    expect(timingSafeStringEqual("héllo-🌍-世界", "héllo-🌍-世界")).toBe(true);
  });

  it("returns false for different strings of equal length", () => {
    expect(timingSafeStringEqual("abcdef", "abcxyz")).toBe(false);
  });

  it("returns false for different-length strings without throwing", () => {
    expect(() => timingSafeStringEqual("short", "much-longer-value")).not.toThrow();
    expect(timingSafeStringEqual("short", "much-longer-value")).toBe(false);
  });

  it("handles empty strings correctly", () => {
    expect(timingSafeStringEqual("", "")).toBe(true);
    expect(timingSafeStringEqual("", "x")).toBe(false);
    expect(timingSafeStringEqual("x", "")).toBe(false);
  });
});

describe("requireAuth", () => {
  const PASSWORD = "s3cret-password";
  let savedPassword: string | undefined;

  beforeEach(() => {
    savedPassword = process.env.SITE_PASSWORD;
  });

  afterEach(() => {
    if (savedPassword === undefined) {
      delete process.env.SITE_PASSWORD;
    } else {
      process.env.SITE_PASSWORD = savedPassword;
    }
  });

  it("returns 401 when SITE_PASSWORD is unset", async () => {
    delete process.env.SITE_PASSWORD;
    const res = await requireAuth(fakeRequest(await sessionToken(PASSWORD)));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("returns 401 when the session cookie is missing", async () => {
    process.env.SITE_PASSWORD = PASSWORD;
    const res = await requireAuth(fakeRequest());
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("returns 401 when the cookie value is wrong", async () => {
    process.env.SITE_PASSWORD = PASSWORD;
    const res = await requireAuth(fakeRequest("not-the-right-token"));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it("returns null (authorized) when the cookie matches the expected token", async () => {
    process.env.SITE_PASSWORD = PASSWORD;
    const res = await requireAuth(fakeRequest(await sessionToken(PASSWORD)));
    expect(res).toBeNull();
  });
});
