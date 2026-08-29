import { describe, expect, it } from "vitest";
import {
  addGoal,
  addProgress,
  archiveGoal,
  completeGoal,
  goalProgress,
  initState,
  logSession,
  removeGoal,
  removeSession,
  reopenGoal,
  setRank,
  setWeeklyTarget,
  unarchiveGoal,
} from "../src/engine/engine.js";

const TODAY = "2026-08-29";

const goalOf = (state) => state.goals[state.goals.length - 1];

describe("addGoal", () => {
  it("creates each goal type with sane defaults", () => {
    let s = initState();
    s = addGoal(s, { title: "Train consistently", type: "sessions", target: 12 }, TODAY);
    s = addGoal(s, { title: "100 mat hours", type: "hours", target: 100 }, TODAY);
    s = addGoal(s, { title: "Armbar reps", type: "count", target: 50 }, TODAY);
    s = addGoal(s, { title: "Blue belt", type: "milestone" }, TODAY);
    expect(s.goals.map((g) => g.type)).toEqual(["sessions", "hours", "count", "milestone"]);
    expect(s.goals[2].unit).toBe("reps"); // default unit
    expect(s.goals[3].target).toBe(1); // milestones are binary
    expect(new Set(s.goals.map((g) => g.id)).size).toBe(4);
  });

  it("rejects bad drafts", () => {
    const s = initState();
    expect(() => addGoal(s, { title: "  ", type: "count", target: 5 }, TODAY)).toThrow(/title/);
    expect(() => addGoal(s, { title: "x", type: "nope", target: 5 }, TODAY)).toThrow(/type/);
    expect(() => addGoal(s, { title: "x", type: "count", target: 0 }, TODAY)).toThrow(/target/);
    expect(() => addGoal(s, { title: "x", type: "count", target: 5, deadline: "soonish" }, TODAY)).toThrow(/deadline/);
  });

  it("never mutates its input", () => {
    const s = initState();
    const frozen = JSON.stringify(s);
    addGoal(s, { title: "x", type: "milestone" }, TODAY);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe("count goals and addProgress", () => {
  const base = addGoal(initState(), { title: "Armbars", type: "count", target: 10, unit: "reps" }, TODAY);
  const id = goalOf(base).id;

  it("accumulates, clamps at zero, and completes at target", () => {
    let s = addProgress(base, id, 4, TODAY);
    expect(goalProgress(s, goalOf(s))).toMatchObject({ done: 4, pct: 40, complete: false });

    s = addProgress(s, id, -100, TODAY);
    expect(goalOf(s).manual).toBe(0);

    s = addProgress(s, id, 10, TODAY);
    const p = goalProgress(s, goalOf(s));
    expect(p.complete).toBe(true);
    expect(goalOf(s).completedAt).toBe(TODAY);
  });

  it("reopens when progress drops back under target", () => {
    let s = addProgress(base, id, 10, TODAY);
    expect(goalOf(s).completedAt).toBe(TODAY);
    s = addProgress(s, id, -1, "2026-08-30");
    expect(goalOf(s).completedAt).toBe(null);
    expect(goalProgress(s, goalOf(s)).complete).toBe(false);
  });

  it("only count goals take manual progress", () => {
    let s = addGoal(base, { title: "Blue", type: "milestone" }, TODAY);
    expect(() => addProgress(s, goalOf(s).id, 1, TODAY)).toThrow(/not a count goal/);
  });
});

describe("sessions/hours goals derive from the log", () => {
  let s = initState();
  s = addGoal(s, { title: "12 sessions", type: "sessions", target: 12 }, TODAY);
  s = addGoal(s, { title: "2 hours", type: "hours", target: 2 }, TODAY);
  const [sessGoal, hourGoal] = s.goals.map((g) => g.id);

  it("tagged sessions advance both kinds; untagged don't", () => {
    let t = logSession(s, { minutes: 90, kind: "gi", goalIds: [sessGoal, hourGoal] }, TODAY);
    t = logSession(t, { minutes: 60, kind: "nogi", goalIds: [] }, TODAY);
    expect(goalProgress(t, t.goals[0]).done).toBe(1);
    expect(goalProgress(t, t.goals[1]).done).toBe(1.5);

    t = logSession(t, { minutes: 30, kind: "drilling", goalIds: [hourGoal] }, TODAY);
    expect(goalProgress(t, t.goals[1])).toMatchObject({ done: 2, complete: true });
  });

  it("deleting a session rolls its contribution back", () => {
    let t = logSession(s, { minutes: 60, kind: "gi", goalIds: [sessGoal] }, TODAY);
    const sid = t.sessions[0].id;
    expect(goalProgress(t, t.goals[0]).done).toBe(1);
    t = removeSession(t, sid);
    expect(goalProgress(t, t.goals[0]).done).toBe(0);
  });

  it("refuses tags on goals that don't read the log", () => {
    let t = addGoal(s, { title: "Reps", type: "count", target: 5 }, TODAY);
    const countId = goalOf(t).id;
    expect(() => logSession(t, { minutes: 60, kind: "gi", goalIds: [countId] }, TODAY)).toThrow(/doesn't track/);
    expect(() => logSession(t, { minutes: 60, kind: "gi", goalIds: [999] }, TODAY)).toThrow(/no goal/);
  });
});

describe("logSession validation", () => {
  const s = initState();
  it("defaults the date to today and validates the rest", () => {
    const t = logSession(s, { minutes: 45, kind: "open-mat" }, TODAY);
    expect(t.sessions[0]).toMatchObject({ date: TODAY, minutes: 45, kind: "open-mat", goalIds: [] });

    expect(() => logSession(s, { minutes: 0, kind: "gi" }, TODAY)).toThrow(/minutes/);
    expect(() => logSession(s, { minutes: 60, kind: "swimming" }, TODAY)).toThrow(/kind/);
    expect(() => logSession(s, { minutes: 60, kind: "gi", date: "yesterday" }, TODAY)).toThrow(/date/);
  });

  it("dedupes tags", () => {
    let t = addGoal(s, { title: "g", type: "sessions", target: 3 }, TODAY);
    const id = goalOf(t).id;
    t = logSession(t, { minutes: 60, kind: "gi", goalIds: [id, id] }, TODAY);
    expect(t.sessions[0].goalIds).toEqual([id]);
  });
});

describe("milestones, archive, delete", () => {
  let s = addGoal(initState(), { title: "Blue belt", type: "milestone" }, TODAY);
  const id = goalOf(s).id;

  it("completes and reopens", () => {
    let t = completeGoal(s, id, TODAY);
    expect(goalProgress(t, goalOf(t)).complete).toBe(true);
    t = reopenGoal(t, id);
    expect(goalProgress(t, goalOf(t)).complete).toBe(false);
  });

  it("archived goals refuse progress until restored", () => {
    let t = addGoal(s, { title: "Reps", type: "count", target: 5 }, TODAY);
    const cid = goalOf(t).id;
    t = archiveGoal(t, cid, TODAY);
    expect(() => addProgress(t, cid, 1, TODAY)).toThrow(/archived/);
    t = unarchiveGoal(t, cid);
    expect(goalOf(addProgress(t, cid, 1, TODAY)).manual).toBe(1);
  });

  it("removeGoal unlinks it from sessions but keeps the sessions", () => {
    let t = addGoal(initState(), { title: "g", type: "sessions", target: 3 }, TODAY);
    const gid = goalOf(t).id;
    t = logSession(t, { minutes: 60, kind: "gi", goalIds: [gid] }, TODAY);
    t = removeGoal(t, gid);
    expect(t.goals).toHaveLength(0);
    expect(t.sessions).toHaveLength(1);
    expect(t.sessions[0].goalIds).toEqual([]);
  });
});

describe("rank", () => {
  it("records promotions and ignores no-ops", () => {
    let s = initState();
    s = setRank(s, "white", 0, TODAY); // already white 0 — no promotion entry
    expect(s.promotions).toHaveLength(0);
    s = setRank(s, "white", 2, TODAY);
    s = setRank(s, "blue", 0, "2027-03-01");
    expect(s.profile).toMatchObject({ belt: "blue", stripes: 0 });
    expect(s.promotions).toEqual([
      { belt: "white", stripes: 2, date: TODAY },
      { belt: "blue", stripes: 0, date: "2027-03-01" },
    ]);
    expect(() => setRank(s, "rainbow", 0, TODAY)).toThrow(/belt/);
    expect(() => setRank(s, "blue", 9, TODAY)).toThrow(/stripes/);
  });

  it("bounds the weekly target", () => {
    let s = setWeeklyTarget(initState(), 5);
    expect(s.profile.weeklyTarget).toBe(5);
    expect(() => setWeeklyTarget(s, 0)).toThrow();
    expect(() => setWeeklyTarget(s, 20)).toThrow();
  });
});
