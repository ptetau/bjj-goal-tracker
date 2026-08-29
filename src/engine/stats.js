// Read-only views over the training log. Pure, like everything in engine/ —
// `today` is always passed in.

import { addDays, daysBetween, weekStart } from "./dates.js";

const inWeek = (session, start) => {
  const d = daysBetween(start, session.date);
  return d >= 0 && d < 7;
};

export function totals(state) {
  const byKind = {};
  let minutes = 0;
  for (const s of state.sessions) {
    minutes += s.minutes;
    byKind[s.kind] = (byKind[s.kind] || 0) + 1;
  }
  return { sessions: state.sessions.length, minutes, hours: minutes / 60, byKind };
}

export function thisWeek(state, today) {
  const start = weekStart(today);
  const sessions = state.sessions.filter((s) => inWeek(s, start));
  return {
    start,
    sessions: sessions.length,
    minutes: sessions.reduce((m, s) => m + s.minutes, 0),
  };
}

// Consecutive weeks with at least `min` sessions, counting back from the
// current week. The week in progress can't break a streak — you may just not
// have trained *yet* — so it counts when it qualifies and is skipped (not
// zeroed) when it doesn't.
export function weeklyStreak(state, today, min = 1) {
  const counts = new Map();
  for (const s of state.sessions) {
    const w = weekStart(s.date);
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  let week = weekStart(today);
  let streak = 0;
  if ((counts.get(week) || 0) >= min) streak++;
  week = addDays(week, -7);
  while ((counts.get(week) || 0) >= min) {
    streak++;
    week = addDays(week, -7);
  }
  return streak;
}

// The last `n` weeks, oldest first, current week last — fuel for a bar chart.
export function recentWeeks(state, today, n = 8) {
  const weeks = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = addDays(weekStart(today), -7 * i);
    const sessions = state.sessions.filter((s) => inWeek(s, start));
    weeks.push({
      start,
      sessions: sessions.length,
      minutes: sessions.reduce((m, s) => m + s.minutes, 0),
    });
  }
  return weeks;
}

// null when there's no deadline; negative when it's behind you.
export const daysLeft = (goal, today) =>
  goal.deadline ? daysBetween(today, goal.deadline) : null;
