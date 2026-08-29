// v1 logs (numeric counter ids, no action ids) must replay into the v2
// world without losing a tap. The migration reconstructs the old counter's
// assignments and rewrites every payload reference onto the new derived ids.

import { describe, expect, it } from "vitest";
import { migrateV1Log } from "../src/app/migrate.js";
import { fold, tallies } from "../src/engine/actions.js";

// A faithful v1 log: createList assigned item ids 1,2 then list id 3;
// startSession took 4; addLines took 5; createSession took 6.
const V1 = [
  { type: "createList", payload: { name: "A-game", type: "tokui", lines: "Back => choke x50\nBottom => top" }, at: "2026-08-20T19:00:00" },
  { type: "startSession", payload: {}, at: "2026-08-20T19:05:00" },
  { type: "tap", payload: { sessionId: 4, itemId: 1, kind: "hit" }, at: "2026-08-20T19:10:00" },
  { type: "tap", payload: { sessionId: 4, itemId: 2, kind: "try" }, at: "2026-08-20T19:11:00" },
  { type: "undoTap", payload: { sessionId: 4 }, at: "2026-08-20T19:12:00" },
  { type: "endSession", payload: { sessionId: 4 }, at: "2026-08-20T20:00:00" },
  { type: "addLines", payload: { listId: 3, lines: "Leg => heel" }, at: "2026-08-21T09:00:00" },
  { type: "createSession", payload: { date: "2026-08-21" }, at: "2026-08-21T21:00:00" },
  { type: "adjustTap", payload: { sessionId: 6, itemId: 5, kind: "hit", delta: 3 }, at: "2026-08-21T21:01:00" },
  { type: "setNote", payload: { sessionId: 6, note: "good heels" }, at: "2026-08-21T21:02:00" },
  { type: "setTarget", payload: { itemId: 2, target: 25 }, at: "2026-08-22T08:00:00" },
];

describe("migrateV1Log", () => {
  const log = migrateV1Log(V1);
  const state = fold(log);

  it("produces a log the v2 engine folds cleanly, same length", () => {
    expect(log).toHaveLength(V1.length);
    for (const a of log) expect(typeof a.id).toBe("string");
  });

  it("preserves structure: lists, items, sessions, targets", () => {
    expect(state.lists).toHaveLength(1);
    expect(state.lists[0].items.map((it) => it.move)).toEqual(["choke", "top", "heel"]);
    expect(state.lists[0].items[0].target).toBe(50);
    expect(state.lists[0].items[1].target).toBe(25); // setTarget followed the ref
    expect(state.sessions).toHaveLength(2);
  });

  it("preserves every tally through the reference rewrite", () => {
    const [live, manual] = state.sessions;
    // hit on choke stayed; the try on top was undone
    expect([...tallies(live).values()]).toEqual([{ tries: 0, hits: 1, total: 1 }]);
    expect(tallies(live).keys().next().value).toBe(state.lists[0].items[0].id);
    // 3 hits landed on the item added later (old id 5 = heel)
    expect(tallies(manual).get(state.lists[0].items[2].id)).toEqual({ tries: 0, hits: 3, total: 3 });
    expect(manual.note).toBe("good heels");
  });

  it("is idempotent-safe: a v2 log passes through untouched", () => {
    expect(migrateV1Log(log)).toEqual(log);
  });
});
