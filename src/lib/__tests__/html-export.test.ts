import { describe, expect, it } from "vitest";
import { buildExportHtml, type ExportEntry } from "../html-export";

function entry(overrides: Partial<ExportEntry> = {}): ExportEntry {
  return {
    event_date: "2026-06-30",
    title: "A day out",
    description: "It was lovely",
    photoDataUris: [],
    ...overrides,
  };
}

const base = {
  title: "Our Journal",
  subtitle: "A book of moments",
  generatedAt: "1 July 2026",
};

describe("buildExportHtml", () => {
  it("produces a full HTML document", () => {
    const html = buildExportHtml({ ...base, entries: [entry()] });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Our Journal</title>");
  });

  it("escapes HTML-special characters in titles and descriptions", () => {
    const html = buildExportHtml({
      ...base,
      entries: [entry({ title: "Tom & Jerry <b>fun</b>", description: 'She said "hi"' })],
    });
    expect(html).toContain("Tom &amp; Jerry &lt;b&gt;fun&lt;/b&gt;");
    expect(html).toContain("She said &quot;hi&quot;");
    // The raw, unescaped script must never survive into the output.
    expect(html).not.toContain("<b>fun</b>");
  });

  it("escapes a script payload in the export title", () => {
    const html = buildExportHtml({
      ...base,
      title: "<script>alert(1)</script>",
      entries: [entry()],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("omits the description block when the entry has none", () => {
    const html = buildExportHtml({ ...base, entries: [entry({ description: null })] });
    expect(html).not.toContain('class="desc"');
  });

  it("renders a photo frame for each supplied photo", () => {
    const html = buildExportHtml({
      ...base,
      entries: [entry({ photoDataUris: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"] })],
    });
    expect(html).toContain("data:image/png;base64,AAA");
    expect(html).toContain("data:image/png;base64,BBB");
    expect(html).not.toContain("a moment, remembered");
    expect((html.match(/<img /g) ?? []).length).toBe(2);
  });

  it("shows an empty-collage placeholder when an entry has no photos", () => {
    const html = buildExportHtml({ ...base, entries: [entry({ photoDataUris: [] })] });
    expect(html).toContain("a moment, remembered");
  });

  it("pluralizes the memory count", () => {
    const one = buildExportHtml({ ...base, entries: [entry()] });
    const two = buildExportHtml({ ...base, entries: [entry(), entry()] });
    expect(one).toContain("1 memory");
    expect(two).toContain("2 memories");
  });

  it("falls back to a starter page when there are no entries", () => {
    const html = buildExportHtml({ ...base, entries: [] });
    expect(html).toContain("Your story starts here");
    expect(html).toContain("0 memories");
  });
});
