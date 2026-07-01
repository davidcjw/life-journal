import { describe, expect, it, vi } from "vitest";

// entries.ts imports the service-role Supabase client at module load. Mock it so
// importing the pure transforms never touches the network or real credentials.
vi.mock("../supabase", () => ({
  getServiceClient: vi.fn(() => {
    throw new Error("Supabase must not be called from a unit test");
  }),
}));

import { imageExtToMime, normalizeImageExt } from "../entries";

describe("imageExtToMime", () => {
  it("maps known extensions to their MIME types", () => {
    expect(imageExtToMime("png")).toBe("image/png");
    expect(imageExtToMime("webp")).toBe("image/webp");
    expect(imageExtToMime("heic")).toBe("image/heic");
    expect(imageExtToMime("heif")).toBe("image/heif");
  });

  it("is case-insensitive", () => {
    expect(imageExtToMime("PNG")).toBe("image/png");
    expect(imageExtToMime("WebP")).toBe("image/webp");
  });

  it("defaults to jpeg for jpg and anything unknown", () => {
    expect(imageExtToMime("jpg")).toBe("image/jpeg");
    expect(imageExtToMime("jpeg")).toBe("image/jpeg");
    expect(imageExtToMime("gif")).toBe("image/jpeg");
    expect(imageExtToMime("")).toBe("image/jpeg");
  });
});

describe("normalizeImageExt", () => {
  it("keeps a supported bare extension", () => {
    expect(normalizeImageExt("png")).toBe("png");
    expect(normalizeImageExt("heic")).toBe("heic");
  });

  it("extracts the extension from a filename", () => {
    expect(normalizeImageExt("photo.PNG")).toBe("png");
    expect(normalizeImageExt("holiday.trip.jpeg")).toBe("jpeg");
  });

  it("lowercases the result", () => {
    expect(normalizeImageExt("IMG.WEBP")).toBe("webp");
  });

  it("falls back to jpg for unsupported or missing extensions", () => {
    expect(normalizeImageExt("document.pdf")).toBe("jpg");
    expect(normalizeImageExt("noextension")).toBe("jpg");
    expect(normalizeImageExt("")).toBe("jpg");
  });
});
