// Read-only views over the log: the sharpness grid, streaks, calendar data.
// Pure like the rest of engine/ — `today` always arrives as an ISO date.
//
// Sharpness is calendar-honest: the window is the last WINDOW_DAYS real
// days, because skills rust in real time — three weeks off the mat should
// read as going cold. Inside the window every session weighs the same, so a
// coach can recompute any number in their head from the grid.

import { addDays, daysBetween, weekStart } from "./dates.js";
import { tallies } from "./actions.js";

export const WINDOW_DAYS = 21;

// Sessions whose date falls in the window, oldest first. Only closed
// sessions count — the one you're rolling right now isn't evidence yet.
export function windowSessions(state, today, windowDays = WINDOW_DAYS) {
  const from = addDays(today, -(windowDays - 1));
  return state.sessions
    .filter((x) => x.endedAt !== null && x.date >= from && x.date <= today)
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
}

// The grid for one list: columns are the window's sessions, rows its active
// items. Cells carry {tries, hits}; a row's consistency is the fraction of
// window sessions where the item was hit (and, separately, attempted at
// all) — both are shown, because on a growth list going for it IS the win.
export function sharpnessGrid(state, list, today, windowDays = WINDOW_DAYS) {
  const sessions = windowSessions(state, today, windowDays);
  const perSession = sessions.map((x) => tallies(x));
  const rows = list.items
    .filter((it) => !it.retiredAt)
    .map((item) => {
      const cells = perSession.map((t) => {
        const c = t.get(item.id);
        return c ? { tries: c.tries, hits: c.hits } : null;
      });
      const hitIn = cells.filter((c) => c && c.hits > 0).length;
      const triedIn = cells.filter((c) => c !== null).length; // a cell exists only if tapped
      const n = sessions.length;
      return {
        item,
        cells,
        hitIn,
        triedIn,
        hitPct: n ? Math.round((100 * hitIn) / n) : null,
        triedPct: n ? Math.round((100 * triedIn) / n) : null,
      };
    });
  return { sessions, rows };
}

// --- consistency ----------------------------------------------------------

export function weeklyStreak(state, today) {
  const weeks = new Set(state.sessions.map((x) => weekStart(x.date)));
  let week = weekStart(today);
  let streak = 0;
  // The week in progress can't break a streak — you may just not have
  // trained yet — so it counts when it qualifies and is skipped otherwise.
  if (weeks.has(week)) streak++;
  week = addDays(week, -7);
  while (weeks.has(week)) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

export function summary(state, today) {
  const inWindow = windowSessions(state, today);
  const thisWeek = state.sessions.filter((x) => x.date >= weekStart(today)).length;
  let hits = 0;
  for (const x of state.sessions) for (const t of x.taps) if (t.kind === "hit") hits++;
  return {
    sessions: state.sessions.length,
    hits,
    inWindow: inWindow.length,
    thisWeek,
    streak: weeklyStreak(state, today),
  };
}

// --- calendar -------------------------------------------------------------

// Sessions per date, for painting intensity dots on a month grid.
export function sessionsByDate(state) {
  const map = new Map();
  for (const x of state.sessions) map.set(x.date, [...(map.get(x.date) || []), x]);
  for (const list of map.values()) list.sort((a, b) => a.id - b.id);
  return map;
}

// null without a target date; negative when it's behind you.
export const daysUntil = (today, date) => (date ? daysBetween(today, date) : null);
