// The functional core of the BJJ goal tracker.
//
// Everything here is pure: state in, state out, no mutation, no IO, no
// Math.random, no Date. "Today" always arrives as an ISO date string from
// whatever shell is driving the engine, so the same call replays identically
// in tests and in the browser. State is plain JSON — it serializes straight
// into localStorage and back.
//
// Progress is derived, not stored, wherever a source of truth already
// exists: a sessions- or hours-goal reads its progress off the training log,
// so deleting a session rolls its contribution back for free. Only rep
// counts (no log entry to derive from) accumulate on the goal itself.

import { isISODate } from "./dates.js";

export const BELTS = ["white", "blue", "purple", "brown", "black"];
export const MAX_STRIPES = 4;

export const SESSION_KINDS = ["gi", "nogi", "drilling", "open-mat", "comp", "private"];

// sessions — train N times (tagged sessions count)
// hours    — N hours on the mat (tagged sessions' minutes count)
// count    — N of anything countable: reps, submissions, comps entered
// milestone— done or not done: "get promoted", "survive Marcelo's class"
export const GOAL_TYPES = ["sessions", "hours", "count", "milestone"];

export function initState() {
  return {
    version: 1,
    profile: { belt: "white", stripes: 0, weeklyTarget: 3 },
    promotions: [], // { belt, stripes, date } — appended by setRank
    goals: [],
    sessions: [],
    nextId: 1, // ids are a counter, not randomness — replays stay identical
  };
}

const nextId = (state) => ({ id: state.nextId, state: { ...state, nextId: state.nextId + 1 } });

const fail = (msg) => {
  throw new Error(msg);
};

const cleanText = (v, label, { required = false, max = 200 } = {}) => {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) fail(`${label} is required`);
  return s.slice(0, max);
};

// ---------------------------------------------------------------------------
// Goals

export function addGoal(state, draft, today) {
  const title = cleanText(draft.title, "goal title", { required: true });
  const type = draft.type;
  if (!GOAL_TYPES.includes(type)) fail(`unknown goal type: ${type}`);

  let target = 1;
  if (type !== "milestone") {
    target = Math.floor(Number(draft.target));
    if (!Number.isFinite(target) || target < 1) fail("target must be a positive number");
  }

  const deadline = draft.deadline || null;
  if (deadline !== null && !isISODate(deadline)) fail(`bad deadline: ${deadline}`);

  const { id, state: next } = nextId(state);
  const goal = {
    id,
    title,
    notes: cleanText(draft.notes, "notes", { max: 1000 }),
    type,
    target,
    unit: type === "count" ? cleanText(draft.unit, "unit", { max: 30 }) || "reps" : null,
    deadline,
    createdAt: today,
    manual: 0, // count-goals only: reps logged straight onto the goal
    completedAt: null,
    archivedAt: null,
  };
  return { ...next, goals: [...next.goals, goal] };
}

export const getGoal = (state, id) =>
  state.goals.find((g) => g.id === id) || fail(`no goal #${id}`);

const patchGoal = (state, id, patch) => {
  getGoal(state, id);
  return { ...state, goals: state.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) };
};

// How far along a goal is, on whichever axis its type measures.
// `done` is fractional for hours-goals (90 tagged minutes = 1.5).
export function goalProgress(state, goal) {
  const tagged = state.sessions.filter((s) => s.goalIds.includes(goal.id));
  let done;
  if (goal.type === "sessions") done = tagged.length;
  else if (goal.type === "hours") done = tagged.reduce((m, s) => m + s.minutes, 0) / 60;
  else if (goal.type === "count") done = goal.manual;
  else done = goal.completedAt ? 1 : 0; // milestone
  const complete = goal.completedAt !== null || done >= goal.target;
  return {
    done,
    target: goal.target,
    pct: Math.min(100, Math.round((100 * done) / goal.target)),
    complete,
  };
}

// Log reps against a count-goal. Amount may be negative to undo a fat-finger;
// progress never drops below zero. Crossing the target stamps completion.
export function addProgress(state, goalId, amount, today) {
  const goal = getGoal(state, goalId);
  if (goal.type !== "count") fail(`goal #${goalId} is not a count goal`);
  if (goal.archivedAt) fail(`goal #${goalId} is archived`);
  const n = Math.floor(Number(amount));
  if (!Number.isFinite(n) || n === 0) fail("amount must be a non-zero number");
  const manual = Math.max(0, goal.manual + n);
  const completedAt =
    manual >= goal.target ? goal.completedAt ?? today : null; // dropping back reopens
  return patchGoal(state, goalId, { manual, completedAt });
}

export function completeGoal(state, goalId, today) {
  const goal = getGoal(state, goalId);
  if (goal.archivedAt) fail(`goal #${goalId} is archived`);
  return patchGoal(state, goalId, { completedAt: goal.completedAt ?? today });
}

export const reopenGoal = (state, goalId) => patchGoal(state, goalId, { completedAt: null });

export const archiveGoal = (state, goalId, today) =>
  patchGoal(state, goalId, { archivedAt: today });

export const unarchiveGoal = (state, goalId) => patchGoal(state, goalId, { archivedAt: null });

// Deleting a goal also unlinks it from the log, so no session points at a
// ghost. The sessions themselves stay — the training happened.
export function removeGoal(state, goalId) {
  getGoal(state, goalId);
  return {
    ...state,
    goals: state.goals.filter((g) => g.id !== goalId),
    sessions: state.sessions.map((s) =>
      s.goalIds.includes(goalId)
        ? { ...s, goalIds: s.goalIds.filter((id) => id !== goalId) }
        : s
    ),
  };
}

// ---------------------------------------------------------------------------
// Training log

export function logSession(state, draft, today) {
  const date = draft.date || today;
  if (!isISODate(date)) fail(`bad session date: ${date}`);
  const minutes = Math.floor(Number(draft.minutes));
  if (!Number.isFinite(minutes) || minutes < 1) fail("minutes must be a positive number");
  const kind = draft.kind;
  if (!SESSION_KINDS.includes(kind)) fail(`unknown session kind: ${kind}`);

  const goalIds = [...new Set(draft.goalIds || [])];
  for (const gid of goalIds) {
    const g = getGoal(state, gid);
    if (g.type !== "sessions" && g.type !== "hours")
      fail(`goal #${gid} (${g.type}) doesn't track sessions`);
  }

  const { id, state: next } = nextId(state);
  const session = {
    id,
    date,
    minutes,
    kind,
    notes: cleanText(draft.notes, "notes", { max: 1000 }),
    goalIds,
  };
  return { ...next, sessions: [...next.sessions, session] };
}

export function removeSession(state, sessionId) {
  if (!state.sessions.some((s) => s.id === sessionId)) fail(`no session #${sessionId}`);
  return { ...state, sessions: state.sessions.filter((s) => s.id !== sessionId) };
}

// ---------------------------------------------------------------------------
// Rank

export function setRank(state, belt, stripes, today) {
  if (!BELTS.includes(belt)) fail(`unknown belt: ${belt}`);
  const s = Math.floor(Number(stripes));
  if (!Number.isFinite(s) || s < 0 || s > MAX_STRIPES) fail(`stripes must be 0–${MAX_STRIPES}`);
  const p = state.profile;
  if (p.belt === belt && p.stripes === s) return state;
  return {
    ...state,
    profile: { ...p, belt, stripes: s },
    promotions: [...state.promotions, { belt, stripes: s, date: today }],
  };
}

export function setWeeklyTarget(state, target) {
  const t = Math.floor(Number(target));
  if (!Number.isFinite(t) || t < 1 || t > 14) fail("weekly target must be 1–14");
  return { ...state, profile: { ...state.profile, weeklyTarget: t } };
}
