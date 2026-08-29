// Property suites: the invariants that must hold over ARBITRARY legal
// histories, not just the examples in actions.test.js. New engine behaviour
// lands here first — see CLAUDE.md.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { apply, fold, initState, openSession, tallies, targetProgress } from "../src/engine/actions.js";
import { itemTitle, parseLine } from "../src/engine/parse.js";
import { sharpnessGrid, weeklyStreak, windowSessions } from "../src/engine/stats.js";
import { addDays, monthGrid, weekStart } from "../src/engine/dates.js";
import { arbOpSeed, actionFromSeed, BASE_DAY, deepFreeze, playSeeds } from "./helpers.js";

const arbSeeds = fc.array(arbOpSeed, { minLength: 1, maxLength: 60 });
const TODAY = addDays(BASE_DAY, 27); // past every date the driver can stamp

describe("the action log, under arbitrary legal histories", () => {
  it("never mutates its input (every state deep-frozen)", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      playSeeds(initState(), seeds); // any in-place write throws in strict mode
    }));
  });

  it("replays deterministically: fold(log) === fold(log), and state is plain JSON", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      const { state, log } = playSeeds(initState(), seeds);
      expect(fold(log)).toEqual(state);
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }));
  });

  it("ids never collide and never reach nextId", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      const { state } = playSeeds(initState(), seeds);
      const ids = [
        ...state.lists.map((l) => l.id),
        ...state.lists.flatMap((l) => l.items.map((it) => it.id)),
        ...state.sessions.map((s) => s.id),
      ];
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toBeLessThan(state.nextId);
    }));
  });

  it("keeps at most one session open, and every session's date well-formed", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      const { state } = playSeeds(initState(), seeds);
      expect(state.sessions.filter((s) => s.endedAt === null).length).toBeLessThanOrEqual(1);
      for (const s of state.sessions) expect(s.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }));
  });

  it("tap then undo is the identity", () => {
    fc.assert(fc.property(arbSeeds, fc.nat({ max: 999 }), fc.boolean(), (seeds, n, hit) => {
      const { state } = playSeeds(initState(), seeds);
      const open = openSession(state);
      const live = state.lists.flatMap((l) => l.items).filter((it) => !it.retiredAt);
      fc.pre(open !== null && live.length > 0);
      const at = `${TODAY}T12:00:00`;
      const tapped = apply(deepFreeze(state), {
        type: "tap",
        payload: { sessionId: open.id, itemId: live[n % live.length].id, kind: hit ? "hit" : "try" },
        at,
      });
      const undone = apply(tapped, { type: "undoTap", payload: { sessionId: open.id }, at });
      expect(undone).toEqual(state);
    }));
  });

  it("adjustTap +n then −n leaves every tally where it was", () => {
    fc.assert(fc.property(arbSeeds, fc.nat({ max: 999 }), fc.integer({ min: 1, max: 9 }), (seeds, n, d) => {
      const { state } = playSeeds(initState(), seeds);
      const items = state.lists.flatMap((l) => l.items);
      fc.pre(state.sessions.length > 0 && items.length > 0);
      const sid = state.sessions[n % state.sessions.length].id;
      const itemId = items[n % items.length].id;
      const at = `${TODAY}T12:00:00`;
      const up = apply(deepFreeze(state), { type: "adjustTap", payload: { sessionId: sid, itemId, kind: "hit", delta: d }, at });
      const down = apply(up, { type: "adjustTap", payload: { sessionId: sid, itemId, kind: "hit", delta: -d }, at });
      for (const [a, b] of state.sessions.map((s, i) => [s, down.sessions[i]]))
        expect(tallies(b)).toEqual(tallies(a));
    }));
  });

  it("tallies conserve taps: per session, tries + hits across items = taps.length", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      const { state } = playSeeds(initState(), seeds);
      for (const s of state.sessions) {
        let total = 0;
        for (const c of tallies(s).values()) {
          expect(c.tries).toBeGreaterThanOrEqual(0);
          expect(c.hits).toBeGreaterThanOrEqual(0);
          expect(c.total).toBe(c.tries + c.hits);
          total += c.total;
        }
        expect(total).toBe(s.taps.length);
      }
    }));
  });

  it("targetProgress stays inside its lap: 0 ≤ done ≤ target, met ⇔ done = target-full", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      const { state } = playSeeds(initState(), seeds);
      for (const item of state.lists.flatMap((l) => l.items)) {
        const p = targetProgress(state, item);
        if (!item.target) expect(p).toBe(null);
        else {
          expect(p.done).toBeGreaterThanOrEqual(0);
          expect(p.done).toBeLessThanOrEqual(p.target);
          expect(p.met).toBe(p.done >= p.target);
          expect(p.pct).toBeGreaterThanOrEqual(0);
          expect(p.pct).toBeLessThanOrEqual(100);
        }
      }
    }));
  });
});

describe("stats, under arbitrary legal histories", () => {
  it("windowSessions is a sorted, closed, in-window subset of sessions", () => {
    fc.assert(fc.property(arbSeeds, fc.nat({ max: 40 }), (seeds, offset) => {
      const { state } = playSeeds(initState(), seeds);
      const today = addDays(BASE_DAY, offset);
      const w = windowSessions(state, today);
      const from = addDays(today, -20);
      for (let i = 0; i < w.length; i++) {
        expect(w[i].endedAt).not.toBe(null);
        expect(w[i].date >= from && w[i].date <= today).toBe(true);
        if (i > 0) expect(w[i - 1].date <= w[i].date).toBe(true);
        expect(state.sessions).toContain(w[i]);
      }
    }));
  });

  it("grid consistencies are sane: hitIn ≤ triedIn ≤ window size, cells match counts", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      const { state } = playSeeds(initState(), seeds);
      for (const list of state.lists) {
        const { sessions, rows } = sharpnessGrid(state, list, TODAY);
        for (const r of rows) {
          expect(r.cells).toHaveLength(sessions.length);
          expect(r.hitIn).toBeLessThanOrEqual(r.triedIn);
          expect(r.triedIn).toBeLessThanOrEqual(sessions.length);
          expect(r.hitIn).toBe(r.cells.filter((c) => c && c.hits > 0).length);
          if (sessions.length === 0) expect(r.hitPct).toBe(null);
        }
      }
    }));
  });

  it("logging another session never shortens a streak", () => {
    fc.assert(fc.property(arbSeeds, fc.nat({ max: 27 }), (seeds, day) => {
      const { state } = playSeeds(initState(), seeds);
      const date = addDays(BASE_DAY, day);
      const more = apply(deepFreeze(state), { type: "createSession", payload: { date }, at: `${date}T12:00:00` });
      expect(weeklyStreak(more, TODAY)).toBeGreaterThanOrEqual(weeklyStreak(state, TODAY));
    }));
  });
});

describe("the parser, over arbitrary text", () => {
  it("is total: never throws, never yields an empty move", () => {
    fc.assert(fc.property(fc.string({ maxLength: 200 }), (s) => {
      const p = parseLine(s);
      if (p !== null) {
        expect(p.move.length).toBeGreaterThan(0);
        if (p.target !== null) expect(p.target).toBeGreaterThanOrEqual(1);
        if (p.position !== null) expect(p.position.length).toBeGreaterThan(0);
      }
    }));
  });

  const arbWord = fc.stringMatching(/^[a-zA-Z][a-zA-Z ,'|]{0,30}[a-zA-Z]$/);

  it("round-trips authored lines: position => move xN survives parse and retitle", () => {
    fc.assert(fc.property(arbWord, arbWord, fc.integer({ min: 1, max: 999 }), (position, move, n) => {
      const p = parseLine(`${position} => ${move} x${n}`);
      expect(p).toEqual({ position: position.trim(), move: move.trim(), target: n });
      // itemTitle → parseLine is stable for arrow-free content
      const again = parseLine(itemTitle(p));
      expect(again.position).toBe(p.position);
      expect(again.move).toBe(p.move);
    }));
  });
});

describe("calendar math", () => {
  const arbDay = fc
    .record({ y: fc.integer({ min: 1990, max: 2100 }), m: fc.integer({ min: 1, max: 12 }), d: fc.integer({ min: 1, max: 28 }) })
    .map(({ y, m, d }) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);

  it("monthGrid covers the whole month in Monday-started 7-day rows", () => {
    fc.assert(fc.property(arbDay, (iso) => {
      const rows = monthGrid(iso);
      expect(weekStart(rows[0][0])).toBe(rows[0][0]); // starts on a Monday
      const flat = rows.flat();
      for (const row of rows) expect(row).toHaveLength(7);
      for (let i = 1; i < flat.length; i++) expect(flat[i]).toBe(addDays(flat[i - 1], 1)); // consecutive
      const month = iso.slice(0, 7);
      const inMonth = flat.filter((d) => d.slice(0, 7) === month);
      expect(inMonth[0]).toBe(month + "-01"); // the 1st is present…
      expect(inMonth.length).toBeGreaterThanOrEqual(28); // …through the whole month
    }));
  });

  it("weekStart is idempotent and within 6 days back", () => {
    fc.assert(fc.property(arbDay, (iso) => {
      const w = weekStart(iso);
      expect(weekStart(w)).toBe(w);
      const diff = (Date.parse(iso) - Date.parse(w)) / 86400000;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(6);
    }));
  });
});

// The driver itself must only ever produce applicable actions — otherwise
// the suites above quietly test less than they claim.
describe("the seed driver", () => {
  it("every non-null action applies cleanly", () => {
    fc.assert(fc.property(arbSeeds, (seeds) => {
      let state = initState();
      for (const seed of seeds) {
        const action = actionFromSeed(state, seed);
        if (action) state = apply(state, action); // throws = property fails
      }
    }));
  });
});
