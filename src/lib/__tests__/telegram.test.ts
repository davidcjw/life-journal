import { describe, expect, it } from "vitest";
import { parseCommand, parseCallbackData } from "../telegram";

describe("parseCommand", () => {
  it("extracts a plain slash command", () => {
    expect(parseCommand("/new")).toBe("/new");
  });

  it("drops arguments after the command", () => {
    expect(parseCommand("/edit 3")).toBe("/edit");
  });

  it("strips a trailing @botname mention", () => {
    expect(parseCommand("/help@MyJournalBot")).toBe("/help");
  });

  it("lowercases and trims surrounding whitespace", () => {
    expect(parseCommand("  /Done  ")).toBe("/done");
  });

  it("returns null for non-command text", () => {
    expect(parseCommand("hello there")).toBeNull();
  });

  it("returns null for empty, whitespace, or missing input", () => {
    expect(parseCommand("")).toBeNull();
    expect(parseCommand("   ")).toBeNull();
    expect(parseCommand(null)).toBeNull();
    expect(parseCommand(undefined)).toBeNull();
  });
});

describe("parseCallbackData", () => {
  it("parses an edit:<id> action", () => {
    expect(parseCallbackData("edit:abc-123")).toEqual({ kind: "edit", id: "abc-123" });
  });

  it("parses the close action", () => {
    expect(parseCallbackData("ef:close")).toEqual({ kind: "close" });
  });

  it("parses a field action with its field and id", () => {
    expect(parseCallbackData("ef:title:abc-123")).toEqual({
      kind: "field",
      field: "title",
      id: "abc-123",
    });
    expect(parseCallbackData("ef:photos:xyz")).toEqual({
      kind: "field",
      field: "photos",
      id: "xyz",
    });
  });

  it("parses a removePhoto action with a numeric index", () => {
    expect(parseCallbackData("ef:rm:abc-123:2")).toEqual({
      kind: "removePhoto",
      id: "abc-123",
      index: 2,
    });
  });

  it("does not treat an unknown field as a field action", () => {
    expect(parseCallbackData("ef:bogus:abc")).toEqual({ kind: "unknown" });
  });

  it("returns unknown for unrecognized data", () => {
    expect(parseCallbackData("")).toEqual({ kind: "unknown" });
    expect(parseCallbackData("random")).toEqual({ kind: "unknown" });
  });
});
