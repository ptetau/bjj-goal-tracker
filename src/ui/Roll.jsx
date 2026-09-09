// The Roll tab when nothing is rolling: one fat START, and a way to log a
// past session. Once a session starts, App swaps the whole screen for the
// pads (Pads.jsx) until it ends.

import React, { useState } from "react";
import { todayISO } from "../app/store.js";

export default function Roll({ state, dispatch, setEditing }) {
  const [date, setDate] = useState(todayISO());
  const hasItems = state.lists.some((l) => !l.archivedAt && l.items.some((it) => !it.retiredAt));

  const startPast = () => {
    const next = dispatch("createSession", { date });
    if (next) setEditing(next.sessions[next.sessions.length - 1].id);
  };

  return (
    <section aria-label="Start rolling" className="idle">
      {hasItems ? (
        <button className="start" onClick={() => dispatch("startSession")}>
          START ROLLING
        </button>
      ) : (
        <p className="empty">No missions yet — write your first list in the Missions tab, then come back to roll.</p>
      )}
      <div className="card form past-session">
        <h3>Log a past session</h3>
        <div className="row">
          <label>
            Date
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </label>
          <button className="ghost" onClick={startPast} disabled={!hasItems}>
            Add &amp; fill in
          </button>
        </div>
      </div>
    </section>
  );
}
