import { describe, expect, it } from "vitest";
import { initState, logSession, addGoal } from "../src/engine/engine.js";
import { daysLeft, recentWeeks, thisWeek, totals, weeklyStreak } from "../src/engine/stats.js";

// 2026-08-29 is a Saturday; its training week starts Monday 2026-08-24.
const TODAY = "2026-08-29";

const log = (s, date, minutes = 60, kind = "gi") =>
  logSession(s, { date, minutes, kind }, TODAY);

describe("totals", () => {
  it("sums minutes and counts by kind", () => {
    let s = initState();
    s = log(s, "2026-08-10", 90, "gi");
    s = log(s, "2026-08-11", 60, "nogi");
    s = log(s, "2026-08-12", 30, "gi");
    expect(totals(s)).toEqual({
      sessions: 3,
      minutes: 180,
      hours: 3,
      byKind: { gi: 2, nogi: 1 },
    });
  });
});

describe("thisWeek", () => {
  it("only counts Monday through today’s week, boundaries included", () => {
    let s = initState();
    s = log(s, "2026-08-23"); // Sunday — previous week
    s = log(s, "2026-08-24"); // Monday — this week
    s = log(s, "2026-08-29"); // Saturday — this week
    const w = thisWeek(s, TODAY);
    expect(w).toMatchObject({ start: "2026-08-24", sessions: 2, minutes: 120 });
  });
});

describe("weeklyStreak", () => {
  it("counts consecutive qualifying weeks back from now", () => {
    let s = initState();
    s = log(s, "2026-08-25"); // this week
    s = log(s, "2026-08-19"); // last week
    s = log(s, "2026-08-12"); // week before
    expect(weeklyStreak(s, TODAY)).toBe(3);
  });

  it("a gap week breaks it", () => {
    let s = initState();
    s = log(s, "2026-08-25"); // this week
    s = log(s, "2026-08-12"); // two weeks back — but last week is empty
    expect(weeklyStreak(s, TODAY)).toBe(1);
  });

  it("the week in progress is skipped, not counted as a miss", () => {
    let s = initState();
    s = log(s, "2026-08-19"); // last week only
    expect(weeklyStreak(s, TODAY)).toBe(1);
  });

  it("respects a minimum sessions-per-week bar", () => {
    let s = initState();
    s = log(s, "2026-08-24");
    s = log(s, "2026-08-25"); // 2 this week
    s = log(s, "2026-08-19"); // 1 last week
    expect(weeklyStreak(s, TODAY, 2)).toBe(1);
    expect(weeklyStreak(s, TODAY, 1)).toBe(2);
  });
});

describe("recentWeeks", () => {
  it("returns n weeks oldest-first ending with the current week", () => {
    let s = initState();
    s = log(s, "2026-08-25", 45);
    s = log(s, "2026-07-07", 60); // 7 weeks back
    const weeks = recentWeeks(s, TODAY, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toMatchObject({ start: "2026-07-06", sessions: 1, minutes: 60 });
    expect(weeks[7]).toMatchObject({ start: "2026-08-24", sessions: 1, minutes: 45 });
    expect(weeks.slice(1, 7).every((w) => w.sessions === 0)).toBe(true);
  });
});

describe("daysLeft", () => {
  it("is null without a deadline, signed with one", () => {
    let s = addGoal(initState(), { title: "a", type: "milestone" }, TODAY);
    expect(daysLeft(s.goals[0], TODAY)).toBe(null);
    s = addGoal(s, { title: "b", type: "milestone", deadline: "2026-09-05" }, TODAY);
    expect(daysLeft(s.goals[1], TODAY)).toBe(7);
    expect(daysLeft(s.goals[1], "2026-09-08")).toBe(-3);
  });
});
