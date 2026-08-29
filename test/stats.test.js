import { describe, expect, it } from "vitest";
import { fold, openSession } from "../src/engine/actions.js";
import { sharpnessGrid, summary, weeklyStreak, windowSessions, WINDOW_DAYS } from "../src/engine/stats.js";
import { monthGrid, addMonths } from "../src/engine/dates.js";

// 2026-08-29 is a Saturday.
const TODAY = "2026-08-29";
let seq = 0;
const act = (type, payload, at) => ({ id: `st${++seq}`, type, payload, at: at || `${TODAY}T12:00:00` });

// Build a state with a list and a closed session per date, tapping per spec:
// taps = { date: [[kind, times]...] } on the single item.
function build(taps) {
  const log = [act("createList", { name: "A", type: "tokui", lines: "Back => choke" })];
  let s = fold(log);
  const itemId = s.lists[0].items[0].id;
  for (const [date, kinds] of Object.entries(taps)) {
    log.push(act("createSession", { date }, `${date}T20:00:00`));
    s = fold(log);
    const sid = s.sessions[s.sessions.length - 1].id;
    for (const [kind, times] of kinds)
      log.push(act("adjustTap", { sessionId: sid, itemId, kind, delta: times }));
  }
  return { state: fold(log), itemId };
}

describe("windowSessions", () => {
  it("keeps the last 21 calendar days inclusive, oldest first", () => {
    const { state } = build({ "2026-08-09": [], "2026-08-10": [], "2026-08-29": [] });
    const w = windowSessions(state, TODAY);
    // A 21-day window ending Aug 29 starts Aug 9.
    expect(w.map((x) => x.date)).toEqual(["2026-08-09", "2026-08-10", "2026-08-29"]);
    // A day later, Aug 9 ages out.
    expect(windowSessions(state, "2026-08-30").map((x) => x.date)).toEqual(["2026-08-10", "2026-08-29"]);
    expect(WINDOW_DAYS).toBe(21);
  });

  it("excludes the session that is still rolling", () => {
    const log = [
      act("createList", { name: "A", type: "tokui", lines: "x" }),
      act("startSession", {}, `${TODAY}T19:00:00`),
    ];
    const state = fold(log);
    expect(openSession(state)).not.toBe(null);
    expect(windowSessions(state, TODAY)).toHaveLength(0);
  });
});

describe("sharpnessGrid", () => {
  it("counts sessions-with-a-hit and sessions-attempted, equal weight", () => {
    const { state } = build({
      "2026-08-12": [["hit", 2]],
      "2026-08-19": [["try", 1]],
      "2026-08-26": [],
    });
    const { sessions, rows } = sharpnessGrid(state, state.lists[0], TODAY);
    expect(sessions).toHaveLength(3);
    const r = rows[0];
    expect(r.cells).toEqual([{ tries: 0, hits: 2 }, { tries: 1, hits: 0 }, null]);
    expect(r).toMatchObject({ hitIn: 1, triedIn: 2, hitPct: 33, triedPct: 67 });
  });

  it("is calendar-honest: sessions age out of the window by date", () => {
    const { state } = build({ "2026-08-01": [["hit", 5]] }); // 4 weeks ago
    const { sessions, rows } = sharpnessGrid(state, state.lists[0], TODAY);
    expect(sessions).toHaveLength(0);
    expect(rows[0].hitPct).toBe(null); // empty window, not 0% — the window is empty, not you
  });

  it("retired items leave the grid", () => {
    const { state, itemId } = build({ "2026-08-26": [["hit", 1]] });
    const retired = { ...state, lists: state.lists.map((l) => ({
      ...l,
      items: l.items.map((it) => (it.id === itemId ? { ...it, retiredAt: `${TODAY}T12:00:00` } : it)),
    })) };
    expect(sharpnessGrid(state, state.lists[0], TODAY).rows).toHaveLength(1);
    expect(sharpnessGrid(retired, retired.lists[0], TODAY).rows).toHaveLength(0);
  });
});

describe("weeklyStreak and summary", () => {
  it("streaks over Mon–Sun weeks with an in-progress-week grace", () => {
    const { state } = build({ "2026-08-19": [], "2026-08-12": [] }); // last week + week before, not this week
    expect(weeklyStreak(state, TODAY)).toBe(2); // this week skipped, not zeroed
    const { state: gap } = build({ "2026-08-25": [], "2026-08-12": [] }); // this week + gap
    expect(weeklyStreak(gap, TODAY)).toBe(1);
  });

  it("summary totals hold together", () => {
    const { state } = build({ "2026-08-26": [["hit", 3], ["try", 2]], "2026-08-24": [] });
    expect(summary(state, TODAY)).toMatchObject({ sessions: 2, hits: 3, inWindow: 2, thisWeek: 2 });
  });
});

describe("calendar month grid", () => {
  it("covers the month in Monday-started full weeks", () => {
    const rows = monthGrid("2026-08-15");
    expect(rows[0][0]).toBe("2026-07-27"); // Aug 1 2026 is a Saturday
    expect(rows.at(-1).at(-1) >= "2026-08-31").toBe(true);
    for (const row of rows) expect(row).toHaveLength(7);
  });

  it("addMonths wraps years", () => {
    expect(addMonths("2026-12-01", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
  });
});
