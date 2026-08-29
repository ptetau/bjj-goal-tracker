import { describe, expect, it } from "vitest";
import {
  apply,
  fold,
  initState,
  openSession,
  tallies,
  targetProgress,
  totalHits,
} from "../src/engine/actions.js";

const AT = "2026-08-29T19:30:00";
const act = (type, payload, at = AT) => ({ type, payload, at });

// A state with one tokui list (2 items) and one growth list (1 item).
const base = fold([
  act("createList", { name: "A-game", type: "tokui", lines: "Back => strangle x50\nBottom => top" }),
  act("createList", { name: "Lab", type: "growth", lines: "Leg => inside heel" }),
]);
const [strangle, sweep] = base.lists[0].items;
const heel = base.lists[1].items[0];

describe("lists and items", () => {
  it("creates lists with parsed items and stable ids", () => {
    expect(base.lists.map((l) => l.type)).toEqual(["tokui", "growth"]);
    expect(strangle).toMatchObject({ position: "Back", move: "strangle", target: 50, lap: 1 });
    expect(sweep.target).toBe(null);
    const ids = [strangle.id, sweep.id, heel.id, base.lists[0].id, base.lists[1].id];
    expect(new Set(ids).size).toBe(5);
  });

  it("validates list drafts", () => {
    expect(() => apply(base, act("createList", { name: " ", type: "tokui", lines: "" }))).toThrow(/name/);
    expect(() => apply(base, act("createList", { name: "x", type: "cardio", lines: "" }))).toThrow(/type/);
    expect(() => apply(base, act("addLines", { listId: base.lists[0].id, lines: "\n \n" }))).toThrow(/nothing/);
  });

  it("retitling keeps the id — history follows the item", () => {
    const s = apply(base, act("retitleItem", { itemId: strangle.id, line: "Back => bow and arrow x50" }));
    const it = s.lists[0].items[0];
    expect(it.id).toBe(strangle.id);
    expect(it.move).toBe("bow and arrow");
    expect(it.target).toBe(50); // retitle does not touch the target
  });

  it("retire hides from work, restore brings back", () => {
    let s = apply(base, act("retireItem", { itemId: sweep.id }));
    expect(s.lists[0].items[1].retiredAt).toBe(AT);
    s = apply(s, act("restoreItem", { itemId: sweep.id }));
    expect(s.lists[0].items[1].retiredAt).toBe(null);
  });

  it("never mutates its input", () => {
    const frozen = JSON.stringify(base);
    apply(base, act("startSession"));
    apply(base, act("retireItem", { itemId: heel.id }));
    expect(JSON.stringify(base)).toBe(frozen);
  });
});

describe("live sessions and taps", () => {
  const live = apply(base, act("startSession"));
  const sid = openSession(live).id;

  it("one open session at a time, dated from the timestamp", () => {
    expect(openSession(live).date).toBe("2026-08-29");
    expect(() => apply(live, act("startSession"))).toThrow(/already rolling/);
  });

  it("taps tally; a hit implies the attempt", () => {
    let s = apply(live, act("tap", { sessionId: sid, itemId: strangle.id, kind: "hit" }));
    s = apply(s, act("tap", { sessionId: sid, itemId: strangle.id, kind: "try" }));
    s = apply(s, act("tap", { sessionId: sid, itemId: heel.id, kind: "hit" }));
    const t = tallies(openSession(s));
    expect(t.get(strangle.id)).toEqual({ tries: 1, hits: 1, total: 2 });
    expect(t.get(heel.id)).toEqual({ tries: 0, hits: 1, total: 1 });
  });

  it("undo takes back the most recent tap, whatever it was", () => {
    let s = apply(live, act("tap", { sessionId: sid, itemId: strangle.id, kind: "hit" }));
    s = apply(s, act("tap", { sessionId: sid, itemId: sweep.id, kind: "try" }));
    s = apply(s, act("undoTap", { sessionId: sid }));
    expect(openSession(s).taps).toEqual([{ itemId: strangle.id, kind: "hit" }]);
    s = apply(s, act("undoTap", { sessionId: sid }));
    expect(() => apply(s, act("undoTap", { sessionId: sid }))).toThrow(/nothing to undo/);
  });

  it("refuses taps on retired items and unknown kinds", () => {
    const s = apply(live, act("retireItem", { itemId: sweep.id }));
    expect(() => apply(s, act("tap", { sessionId: sid, itemId: sweep.id, kind: "hit" }))).toThrow(/retired/);
    expect(() => apply(s, act("tap", { sessionId: sid, itemId: strangle.id, kind: "slam" }))).toThrow(/kind/);
  });

  it("ends once, then edits still apply", () => {
    let s = apply(live, act("endSession", { sessionId: sid }, "2026-08-29T21:00:00"));
    expect(() => apply(s, act("endSession", { sessionId: sid }))).toThrow(/already ended/);
    s = apply(s, act("setNote", { sessionId: sid, note: "good day" }));
    expect(s.sessions[0].note).toBe("good day");
  });
});

describe("after-class corrections", () => {
  let s = apply(base, act("createSession", { date: "2026-08-27" }));
  const sid = s.sessions[0].id;

  it("adjustTap appends and removes matching taps, floored at zero", () => {
    s = apply(s, act("adjustTap", { sessionId: sid, itemId: strangle.id, kind: "hit", delta: 3 }));
    s = apply(s, act("adjustTap", { sessionId: sid, itemId: strangle.id, kind: "try", delta: 2 }));
    s = apply(s, act("adjustTap", { sessionId: sid, itemId: strangle.id, kind: "hit", delta: -1 }));
    expect(tallies(s.sessions[0]).get(strangle.id)).toEqual({ tries: 2, hits: 2, total: 4 });
    // over-removal floors silently
    s = apply(s, act("adjustTap", { sessionId: sid, itemId: strangle.id, kind: "hit", delta: -10 }));
    expect(tallies(s.sessions[0]).get(strangle.id)).toEqual({ tries: 2, hits: 0, total: 2 });
  });

  it("manual sessions carry their own date and are already closed", () => {
    expect(s.sessions[0]).toMatchObject({ date: "2026-08-27", startedAt: null });
    expect(openSession(s)).toBe(null);
  });

  it("deleting a session rolls its counts out of everything", () => {
    const gone = apply(s, act("deleteSession", { sessionId: sid }));
    expect(totalHits(gone, strangle.id)).toBe(0);
  });
});

describe("targets and laps", () => {
  const logHits = (state, n) => {
    let s = apply(state, act("createSession", { date: "2026-08-28" }));
    const sid = s.sessions[s.sessions.length - 1].id;
    return apply(s, act("adjustTap", { sessionId: sid, itemId: strangle.id, kind: "hit", delta: n }));
  };

  it("progress tracks the current lap and flags met", () => {
    let s = logHits(base, 49);
    expect(targetProgress(s, s.lists[0].items[0])).toMatchObject({ done: 49, met: false, lap: 1 });
    s = logHits(s, 1);
    expect(targetProgress(s, s.lists[0].items[0])).toMatchObject({ done: 50, met: true });
  });

  it("nothing resets silently: the next lap is an explicit action", () => {
    let s = logHits(base, 55);
    expect(targetProgress(s, s.lists[0].items[0])).toMatchObject({ done: 50, met: true, lap: 1 });
    s = apply(s, act("startNextLap", { itemId: strangle.id }));
    // lap 2 counts hits 51+: the 5 overflow hits carry in
    expect(targetProgress(s, s.lists[0].items[0])).toMatchObject({ done: 5, met: false, lap: 2 });
    expect(() => apply(s, act("startNextLap", { itemId: sweep.id }))).toThrow(/no target/);
  });

  it("items without targets have no progress", () => {
    expect(targetProgress(base, sweep)).toBe(null);
  });

  it("changing the target restarts laps", () => {
    let s = apply(base, act("startNextLap", { itemId: strangle.id }));
    s = apply(s, act("setTarget", { itemId: strangle.id, target: 100 }));
    expect(s.lists[0].items[0]).toMatchObject({ target: 100, lap: 1 });
  });
});

describe("the log is the protocol", () => {
  it("folding a log replays to the same state, always", () => {
    const log = [
      act("createList", { name: "A", type: "tokui", lines: "Back => choke x10" }),
      act("startSession"),
    ];
    const a = fold(log);
    const withTap = [...log, act("tap", { sessionId: openSession(a).id, itemId: a.lists[0].items[0].id, kind: "hit" })];
    expect(fold(withTap)).toEqual(fold(withTap));
    expect(JSON.parse(JSON.stringify(fold(withTap)))).toEqual(fold(withTap)); // plain JSON throughout
  });

  it("unknown actions fail loudly", () => {
    expect(() => apply(initState(), act("teleport", {}))).toThrow(/unknown action/);
  });
});
