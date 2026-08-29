// The functional core of TOKUI, shaped as an action log.
//
// Every mutation is a named action `{ type, payload, at }` folded through
// `apply` — pure: state in, state out, no mutation, no IO, no Math.random,
// no Date. `at` is a local ISO datetime ("YYYY-MM-DDTHH:MM:SS") stamped by
// the shell. Ids come from a counter. The payoff: today the shell persists
// the log in the browser and folds it on load; in milestone 2 clients queue
// the same actions offline and a server replays them through this exact
// module — the log is the sync protocol.
//
// Retire, don't delete: items and lists leave the working screens but their
// history stays. Renames keep ids, so history follows the item.

import { isISODate } from "./dates.js";
import { parseLine, parseLines } from "./parse.js";

export const LIST_TYPES = ["tokui", "growth"]; // exploit list / explore-and-grow list
export const TAP_KINDS = ["try", "hit"]; // a hit implies the attempt — one tap per event

export function initState() {
  return { version: 2, lists: [], sessions: [], nextId: 1 };
}

const fail = (msg) => {
  throw new Error(msg);
};

const clean = (v, label, { required = false, max = 200 } = {}) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) fail(`${label} is required`);
  return s.slice(0, max);
};

const dateOf = (at) => {
  const d = typeof at === "string" ? at.slice(0, 10) : "";
  if (!isISODate(d)) fail(`bad timestamp: ${at}`);
  return d;
};

// ---------------------------------------------------------------------------
// Lookups (exported for shells and views)

export const getList = (s, id) => s.lists.find((l) => l.id === id) || fail(`no list #${id}`);
export const getSession = (s, id) =>
  s.sessions.find((x) => x.id === id) || fail(`no session #${id}`);
export const getItem = (s, id) => {
  for (const l of s.lists) for (const it of l.items) if (it.id === id) return it;
  fail(`no item #${id}`);
};
export const listOfItem = (s, id) => s.lists.find((l) => l.items.some((it) => it.id === id));
export const openSession = (s) => s.sessions.find((x) => x.endedAt === null) || null;

const patchList = (s, id, fn) => ({
  ...s,
  lists: s.lists.map((l) => (l.id === id ? fn(l) : l)),
});
const patchItem = (s, id, fn) => ({
  ...s,
  lists: s.lists.map((l) =>
    l.items.some((it) => it.id === id)
      ? { ...l, items: l.items.map((it) => (it.id === id ? fn(it) : it)) }
      : l
  ),
});
const patchSession = (s, id, fn) => ({
  ...s,
  sessions: s.sessions.map((x) => (x.id === id ? fn(x) : x)),
});

// ---------------------------------------------------------------------------
// The reducer

const handlers = {
  // --- mission lists -------------------------------------------------------
  createList(s, { name, type, lines }, at) {
    const listName = clean(name, "list name", { required: true, max: 80 });
    if (!LIST_TYPES.includes(type)) fail(`unknown list type: ${type}`);
    const parsed = parseLines(lines || "");
    let nextId = s.nextId;
    const items = parsed.map((p) => makeItem(nextId++, p, at));
    const list = {
      id: nextId++,
      name: listName,
      type,
      createdAt: at,
      archivedAt: null,
      items,
    };
    return { ...s, nextId, lists: [...s.lists, list] };
  },

  renameList(s, { listId, name }) {
    getList(s, listId);
    const n = clean(name, "list name", { required: true, max: 80 });
    return patchList(s, listId, (l) => ({ ...l, name: n }));
  },

  archiveList(s, { listId }, at) {
    getList(s, listId);
    return patchList(s, listId, (l) => ({ ...l, archivedAt: at }));
  },

  restoreList(s, { listId }) {
    getList(s, listId);
    return patchList(s, listId, (l) => ({ ...l, archivedAt: null }));
  },

  addLines(s, { listId, lines }, at) {
    getList(s, listId);
    const parsed = parseLines(lines || "");
    if (parsed.length === 0) fail("nothing to add");
    let nextId = s.nextId;
    const items = parsed.map((p) => makeItem(nextId++, p, at));
    return { ...patchList(s, listId, (l) => ({ ...l, items: [...l.items, ...items] })), nextId };
  },

  // Retitling keeps the id, so the item's whole tally history follows it.
  retitleItem(s, { itemId, line }) {
    getItem(s, itemId);
    const p = parseLine(line || "");
    if (!p) fail("item title is required");
    return patchItem(s, itemId, (it) => ({ ...it, position: p.position, move: p.move }));
  },

  setTarget(s, { itemId, target }) {
    getItem(s, itemId);
    const t = target === null ? null : Math.floor(Number(target));
    if (t !== null && (!Number.isFinite(t) || t < 1)) fail("target must be a positive number");
    // A changed target restarts the lap count — laps only mean anything
    // against the target they were run at.
    return patchItem(s, itemId, (it) => ({ ...it, target: t, lap: 1 }));
  },

  retireItem(s, { itemId }, at) {
    getItem(s, itemId);
    return patchItem(s, itemId, (it) => ({ ...it, retiredAt: at }));
  },

  restoreItem(s, { itemId }) {
    getItem(s, itemId);
    return patchItem(s, itemId, (it) => ({ ...it, retiredAt: null }));
  },

  // "50/50 — go again?" Yes arms the next lap; the target stays the same and
  // progress counts from lap * target.
  startNextLap(s, { itemId }) {
    const it = getItem(s, itemId);
    if (!it.target) fail(`item #${itemId} has no target`);
    return patchItem(s, itemId, (x) => ({ ...x, lap: x.lap + 1 }));
  },

  // --- sessions ------------------------------------------------------------
  startSession(s, _p, at) {
    if (openSession(s)) fail("a session is already rolling");
    const session = {
      id: s.nextId,
      date: dateOf(at),
      startedAt: at,
      endedAt: null,
      note: "",
      taps: [], // { itemId, kind } in tap order — the source of truth for tallies
    };
    return { ...s, nextId: s.nextId + 1, sessions: [...s.sessions, session] };
  },

  endSession(s, { sessionId }, at) {
    const x = getSession(s, sessionId);
    if (x.endedAt !== null) fail(`session #${sessionId} already ended`);
    return patchSession(s, sessionId, (v) => ({ ...v, endedAt: at }));
  },

  // A session logged after the fact — same shape, just never "open".
  createSession(s, { date }, at) {
    const d = date || dateOf(at);
    if (!isISODate(d)) fail(`bad session date: ${date}`);
    const session = {
      id: s.nextId,
      date: d,
      startedAt: null,
      endedAt: at,
      note: "",
      taps: [],
    };
    return { ...s, nextId: s.nextId + 1, sessions: [...s.sessions, session] };
  },

  deleteSession(s, { sessionId }) {
    getSession(s, sessionId);
    return { ...s, sessions: s.sessions.filter((x) => x.id !== sessionId) };
  },

  setNote(s, { sessionId, note }) {
    getSession(s, sessionId);
    const n = clean(note, "note", { max: 4000 });
    return patchSession(s, sessionId, (x) => ({ ...x, note: n }));
  },

  // --- tallies -------------------------------------------------------------
  tap(s, { sessionId, itemId, kind }) {
    getSession(s, sessionId);
    const item = getItem(s, itemId);
    if (item.retiredAt) fail("item is retired");
    if (!TAP_KINDS.includes(kind)) fail(`unknown tap kind: ${kind}`);
    return patchSession(s, sessionId, (x) => ({ ...x, taps: [...x.taps, { itemId, kind }] }));
  },

  // The giant UNDO: takes back the most recent tap of the session, whatever
  // it was. Sweaty-hands insurance.
  undoTap(s, { sessionId }) {
    const x = getSession(s, sessionId);
    if (x.taps.length === 0) fail("nothing to undo");
    return patchSession(s, sessionId, (v) => ({ ...v, taps: v.taps.slice(0, -1) }));
  },

  // After-class correction: delta > 0 appends taps, delta < 0 removes the
  // most recent matching ones (floor at zero, silently).
  adjustTap(s, { sessionId, itemId, kind, delta }) {
    getSession(s, sessionId);
    getItem(s, itemId);
    if (!TAP_KINDS.includes(kind)) fail(`unknown tap kind: ${kind}`);
    const d = Math.floor(Number(delta));
    if (!Number.isFinite(d) || d === 0) fail("delta must be a non-zero number");
    return patchSession(s, sessionId, (x) => {
      if (d > 0) {
        const add = Array.from({ length: d }, () => ({ itemId, kind }));
        return { ...x, taps: [...x.taps, ...add] };
      }
      let remove = -d;
      const taps = [];
      for (let i = x.taps.length - 1; i >= 0; i--) {
        const t = x.taps[i];
        if (remove > 0 && t.itemId === itemId && t.kind === kind) remove--;
        else taps.unshift(t);
      }
      return { ...x, taps };
    });
  },
};

function makeItem(id, parsed, at) {
  return {
    id,
    position: parsed.position,
    move: parsed.move,
    target: parsed.target ?? null,
    lap: 1,
    createdAt: at,
    retiredAt: null,
  };
}

export function apply(state, action) {
  const h = handlers[action.type] || fail(`unknown action: ${action.type}`);
  return h(state, action.payload || {}, action.at);
}

export const fold = (log) => log.reduce(apply, initState());

// ---------------------------------------------------------------------------
// Derived tallies

// Per-item counts for one session: { tries, hits, total }. A hit implies the
// attempt, so total (= attempts) is tries + hits.
export function tallies(session) {
  const map = new Map();
  for (const t of session.taps) {
    const c = map.get(t.itemId) || { tries: 0, hits: 0, total: 0 };
    if (t.kind === "hit") c.hits++;
    else c.tries++;
    c.total++;
    map.set(t.itemId, c);
  }
  return map;
}

// Lifetime hit count for an item, across every session.
export const totalHits = (state, itemId) =>
  state.sessions.reduce(
    (n, x) => n + x.taps.reduce((m, t) => m + (t.itemId === itemId && t.kind === "hit" ? 1 : 0), 0),
    0
  );

// Progress against a cumulative target, lap-aware: lap 2 of x50 counts hits
// 51–100. `met` means the current lap is full — celebrate, then the user
// chooses: next lap or retirement. Nothing resets silently.
export function targetProgress(state, item) {
  if (!item.target) return null;
  const hits = totalHits(state, item.id);
  const done = Math.max(0, Math.min(item.target, hits - (item.lap - 1) * item.target));
  return {
    hits,
    lap: item.lap,
    target: item.target,
    done,
    pct: Math.round((100 * done) / item.target),
    met: done >= item.target,
  };
}
