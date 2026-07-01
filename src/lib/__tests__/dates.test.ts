import { describe, expect, it } from "vitest";
import {
  parseDateInput,
  formatLongDate,
  formatShortDate,
  monthLabel,
  todayInTz,
} from "../dates";

const TZ = "Asia/Singapore";
const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe("parseDateInput", () => {
  it("accepts ISO YYYY-MM-DD and zero-pads it", () => {
    expect(parseDateInput("2026-6-3", TZ)).toBe("2026-06-03");
    expect(parseDateInput("2026-12-25", TZ)).toBe("2026-12-25");
  });

  it("accepts DD/MM/YYYY and DD-MM-YYYY and DD.MM.YYYY", () => {
    expect(parseDateInput("30/06/2026", TZ)).toBe("2026-06-30");
    expect(parseDateInput("30-06-2026", TZ)).toBe("2026-06-30");
    expect(parseDateInput("30.06.2026", TZ)).toBe("2026-06-30");
  });

  it("resolves the 'today' and '/today' keywords to a valid ISO date", () => {
    expect(parseDateInput("today", TZ)).toMatch(ISO);
    expect(parseDateInput("/today", TZ)).toBe(parseDateInput("today", TZ));
  });

  it("resolves 'yesterday' to the day before today", () => {
    expect(parseDateInput("yesterday", TZ)).toMatch(ISO);
    expect(parseDateInput("yesterday", TZ)).not.toBe(parseDateInput("today", TZ));
  });

  it("rejects impossible calendar dates", () => {
    expect(parseDateInput("2026-02-30", TZ)).toBeNull();
    expect(parseDateInput("31/02/2026", TZ)).toBeNull();
    expect(parseDateInput("2026-13-01", TZ)).toBeNull();
  });

  it("returns null for unrecognized or empty input", () => {
    expect(parseDateInput("", TZ)).toBeNull();
    expect(parseDateInput("not a date", TZ)).toBeNull();
    expect(parseDateInput("2026/06/30", TZ)).toBeNull(); // YYYY/MM/DD not supported
  });
});

describe("date formatting", () => {
  it("formatLongDate renders weekday, day, month and year", () => {
    expect(formatLongDate("2026-06-30")).toBe("Tuesday, 30 June 2026");
  });

  it("formatShortDate renders an abbreviated month", () => {
    expect(formatShortDate("2026-06-30")).toBe("30 Jun 2026");
  });

  it("monthLabel groups by month and year only", () => {
    expect(monthLabel("2026-06-30")).toBe("June 2026");
    expect(monthLabel("2026-06-01")).toBe(monthLabel("2026-06-30"));
  });

  it("formatting is not off-by-one at UTC day boundaries", () => {
    // A day is stored as plain YYYY-MM-DD; formatting must not shift it.
    expect(formatShortDate("2026-01-01")).toBe("1 Jan 2026");
  });
});

describe("todayInTz", () => {
  it("returns a YYYY-MM-DD string", () => {
    expect(todayInTz(TZ)).toMatch(ISO);
  });
});
