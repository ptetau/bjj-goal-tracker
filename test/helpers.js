// Shared machinery for the property suites.
//
// The centrepiece is the seed→action driver: fast-check generates arrays of
// small integer records, and `actionFromSeed` maps each onto a *valid*
// action for whatever state the run has reached (indexes resolve modulo the
// things that exist; impossible ops are skipped). That lets properties
// quantify over arbitrary legal histories without hand-writing a generator
// per action type — the same trick overtype's props suite uses for moves.

import fc from "fast-check";
import { apply } from "../src/engine/actions.js";
import { addDays } from "../src/engine/dates.js";

export function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

export const BASE_DAY = "2026-08-01";

const LINES = [
  "Back => choke",
  "Bottom => top x10",
  "free form drill",
  "Leg => inside heel x3",
  "Top => pinning: tight weight",
];

export const arbOpSeed = fc.record({
  op: fc.nat({ max: 14 }),
  a: fc.nat({ max: 999 }),
  b: fc.nat({ max: 999 }),
  c: fc.nat({ max: 27 }),
});

const pick = (arr, n) => (arr.length ? arr[n % arr.length] : null);

// Turn one seed into a valid action for this state, or null when the op has
// no legal target yet (no lists, no open session, ...).
export function actionFromSeed(state, { op, a, b, c }) {
  const at = `${addDays(BASE_DAY, c)}T12:00:00`;
  const lists = state.lists;
  const items = lists.flatMap((l) => l.items);
  const sessions = state.sessions;
  const open = sessions.find((s) => s.endedAt === null) || null;
  const act = (type, payload) => ({ type, payload, at });

  switch (op) {
    case 0:
      return act("createList", {
        name: `list-${a}`,
        type: a % 2 ? "tokui" : "growth",
        lines: `${pick(LINES, a)}\n${pick(LINES, b)}`,
      });
    case 1:
      return lists.length ? act("addLines", { listId: pick(lists, a).id, lines: pick(LINES, b) }) : null;
    case 2:
      return items.length ? act("retitleItem", { itemId: pick(items, a).id, line: pick(LINES, b) }) : null;
    case 3:
      return items.length
        ? act("setTarget", { itemId: pick(items, a).id, target: b % 3 ? (b % 20) + 1 : null })
        : null;
    case 4:
      return items.length ? act("retireItem", { itemId: pick(items, a).id }) : null;
    case 5: {
      const retired = items.filter((it) => it.retiredAt);
      return retired.length ? act("restoreItem", { itemId: pick(retired, a).id }) : null;
    }
    case 6: {
      const targeted = items.filter((it) => it.target);
      return targeted.length ? act("startNextLap", { itemId: pick(targeted, a).id }) : null;
    }
    case 7:
      return open ? null : act("startSession");
    case 8:
      return open ? act("endSession", { sessionId: open.id }) : null;
    case 9:
      return act("createSession", { date: addDays(BASE_DAY, c) });
    case 10:
      return sessions.length ? act("deleteSession", { sessionId: pick(sessions, a).id }) : null;
    case 11:
      return sessions.length ? act("setNote", { sessionId: pick(sessions, a).id, note: `note ${a}` }) : null;
    case 12: {
      const live = items.filter((it) => !it.retiredAt);
      return open && live.length
        ? act("tap", { sessionId: open.id, itemId: pick(live, a).id, kind: b % 2 ? "hit" : "try" })
        : null;
    }
    case 13:
      return open && open.taps.length ? act("undoTap", { sessionId: open.id }) : null;
    default:
      return sessions.length && items.length
        ? act("adjustTap", {
            sessionId: pick(sessions, a).id,
            itemId: pick(items, b).id,
            kind: a % 2 ? "hit" : "try",
            delta: (b % 7) - 3 || 1,
          })
        : null;
  }
}

// Drive a run from seeds. Every intermediate state is deep-frozen, so any
// in-place write inside the engine throws in strict mode. Returns the final
// state and the log of actions that actually applied.
export function playSeeds(initial, seeds) {
  let state = deepFreeze(initial);
  const log = [];
  for (const seed of seeds) {
    const action = actionFromSeed(state, seed);
    if (!action) continue;
    state = deepFreeze(apply(state, action));
    log.push(action);
  }
  return { state, log };
}
