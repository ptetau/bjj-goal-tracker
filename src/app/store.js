// Shell concerns: the clock and the disk. The only module allowed to touch
// `Date` and localStorage — the engine stays pure behind it.
//
// What persists is the ACTION LOG, not the folded state: dispatch stamps an
// action with local time, folds it through the pure engine, and appends it
// to the stored log. On load the log replays through the same engine. In
// milestone 2 the identical log entries queue for a server that replays
// them too — persistence and sync are the same shape.

import { apply, fold, initState } from "../engine/actions.js";

const KEY = "tokui/v1";

const pad = (n) => String(n).padStart(2, "0");

// Local wall-clock, not UTC — a 9pm class in Auckland is still today.
export function nowISO() {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export const todayISO = () => nowISO().slice(0, 10);

export function loadLog() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const doc = JSON.parse(raw);
    return doc?.version === 1 && Array.isArray(doc.log) ? doc.log : [];
  } catch {
    return []; // private windows and blocked storage still get an app
  }
}

export function saveLog(log) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, log }));
  } catch {
    // Storage full or blocked: the session keeps working, it just won't persist.
  }
}

// Replay the stored log; a corrupt entry abandons the tail rather than the app.
export function loadState(log) {
  try {
    return fold(log);
  } catch {
    let state = initState();
    for (const action of log) {
      try {
        state = apply(state, action);
      } catch {
        break;
      }
    }
    return state;
  }
}
