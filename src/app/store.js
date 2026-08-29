// Shell concerns: the clock and the disk. This is the only module that may
// touch `Date` or localStorage — the engine stays pure behind it.

import { initState } from "../engine/engine.js";

const KEY = "bjj-goal-tracker/v1";

// Local calendar date, not UTC — a 9pm class in Auckland is still today.
export function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initState();
    const state = JSON.parse(raw);
    if (state?.version !== 1 || !Array.isArray(state.goals)) return initState();
    return state;
  } catch {
    return initState(); // private windows and blocked storage still get an app
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the session keeps working, it just won't persist.
  }
}
