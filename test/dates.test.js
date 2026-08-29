import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isISODate, weekStart } from "../src/engine/dates.js";

describe("isISODate", () => {
  it("accepts real calendar dates", () => {
    expect(isISODate("2026-08-29")).toBe(true);
    expect(isISODate("2024-02-29")).toBe(true); // leap day
  });

  it("rejects malformed and impossible dates", () => {
    expect(isISODate("2026-2-9")).toBe(false);
    expect(isISODate("2026-02-31")).toBe(false);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("2023-02-29")).toBe(false); // not a leap year
    expect(isISODate("")).toBe(false);
    expect(isISODate(null)).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("daysBetween", () => {
  it("is signed", () => {
    expect(daysBetween("2026-08-01", "2026-08-29")).toBe(28);
    expect(daysBetween("2026-08-29", "2026-08-01")).toBe(-28);
    expect(daysBetween("2026-08-29", "2026-08-29")).toBe(0);
  });
});

describe("weekStart", () => {
  it("returns the Monday of the week", () => {
    expect(weekStart("2026-08-29")).toBe("2026-08-24"); // a Saturday
    expect(weekStart("2026-08-24")).toBe("2026-08-24"); // Monday is its own start
    expect(weekStart("2026-08-30")).toBe("2026-08-24"); // Sunday belongs to the week behind it
    expect(weekStart("2026-08-31")).toBe("2026-08-31"); // next Monday starts fresh
  });
});
