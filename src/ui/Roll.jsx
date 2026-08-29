// The matside screen. Built for wrecked hands and five seconds between
// rolls: full-width rows, two fat zones per item (TRY / HIT — a hit implies
// the attempt), one giant UNDO for the whole session, a buzz and a flash on
// every count. Nothing here asks for precision or thought.

import React, { useState } from "react";
import { tallies } from "../engine/actions.js";
import { itemTitle } from "../engine/parse.js";
import { buzz } from "../app/haptics.js";
import { todayISO } from "../app/store.js";

export default function Roll({ state, dispatch, live, setEditing }) {
  const [flash, setFlash] = useState(null); // { itemId, kind, tick } retriggers the css animation

  if (!live) return <Idle state={state} dispatch={dispatch} setEditing={setEditing} />;

  const counts = tallies(live);
  const lists = state.lists.filter((l) => !l.archivedAt && l.items.some((it) => !it.retiredAt));
  const lastTap = live.taps[live.taps.length - 1];
  const lastItem = lastTap ? state.lists.flatMap((l) => l.items).find((it) => it.id === lastTap.itemId) : null;

  const tap = (itemId, kind) => {
    if (dispatch("tap", { sessionId: live.id, itemId, kind })) {
      buzz(kind === "hit" ? [16, 30, 16] : 16);
      setFlash({ itemId, kind, tick: Date.now() });
    }
  };

  const end = () => {
    dispatch("endSession", { sessionId: live.id });
    setEditing(live.id); // straight into notes and corrections
  };

  return (
    <section aria-label="Live session" className="roll">
      {lists.map((list) => (
        <div key={list.id} className="roll-list">
          <h2 className={`list-tag list-${list.type}`}>{list.name}</h2>
          {list.items.filter((it) => !it.retiredAt).map((item) => {
            const c = counts.get(item.id);
            const flashing = flash && flash.itemId === item.id;
            return (
              <div key={item.id} className="roll-row">
                <div className="roll-item">
                  <span className="roll-title">{itemTitle(item)}</span>
                  <span className="roll-counts" aria-live="polite">
                    {c ? `${c.hits} hit · ${c.tries} try` : "—"}
                  </span>
                </div>
                <button
                  className={`zone zone-try ${flashing && flash.kind === "try" ? "flash" : ""}`}
                  key={flashing && flash.kind === "try" ? flash.tick : "try"}
                  onClick={() => tap(item.id, "try")}
                  aria-label={`Attempted ${itemTitle(item)}`}
                >
                  TRY
                </button>
                <button
                  className={`zone zone-hit ${flashing && flash.kind === "hit" ? "flash" : ""}`}
                  key={flashing && flash.kind === "hit" ? flash.tick : "hit"}
                  onClick={() => tap(item.id, "hit")}
                  aria-label={`Hit ${itemTitle(item)}`}
                >
                  HIT
                </button>
              </div>
            );
          })}
        </div>
      ))}

      <footer className="roll-footer">
        <button
          className="undo"
          disabled={live.taps.length === 0}
          onClick={() => dispatch("undoTap", { sessionId: live.id })}
        >
          UNDO
          <small>{lastTap && lastItem ? `${itemTitle(lastItem)} · ${lastTap.kind.toUpperCase()}` : "nothing yet"}</small>
        </button>
        <button className="end" onClick={end}>
          END
          <small>{live.taps.length} taps</small>
        </button>
      </footer>
    </section>
  );
}

function Idle({ state, dispatch, setEditing }) {
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
