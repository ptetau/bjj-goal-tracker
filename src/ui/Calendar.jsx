// Calendar-first timeline: a month of intensity dots, a day's sessions on
// tap, and the consistency stats above it. History drills down; it doesn't
// scroll past you.

import React, { useState } from "react";
import { monthGrid, monthLabel, addMonths } from "../engine/dates.js";
import { sessionsByDate, summary } from "../engine/stats.js";
import { tallies } from "../engine/actions.js";
import { itemTitle } from "../engine/parse.js";
import { todayISO } from "../app/store.js";

function SessionRow({ session, state, setEditing, dispatch }) {
  const items = new Map(state.lists.flatMap((l) => l.items).map((it) => [it.id, it]));
  const chips = [...tallies(session).entries()].map(([id, c]) => {
    const it = items.get(id);
    return it ? `${c.hits > 0 ? `${c.hits}× ` : ""}${itemTitle(it)}${c.tries ? ` (${c.tries} try)` : ""}` : null;
  });

  return (
    <div className="card session-card">
      <div className="session-line">
        <strong>{session.endedAt === null ? "rolling now" : `${session.taps.length} taps`}</strong>
        <span className="mission-tools">
          <button className="ghost tiny" onClick={() => setEditing(session.id)}>
            edit
          </button>
          <button
            className="ghost tiny danger"
            onClick={() => {
              if (window.confirm(`Delete the ${session.date} session?`))
                dispatch("deleteSession", { sessionId: session.id });
            }}
          >
            delete
          </button>
        </span>
      </div>
      {chips.length > 0 && <p className="chips">{chips.filter(Boolean).join(" · ")}</p>}
      {session.note && <p className="notes">{session.note}</p>}
    </div>
  );
}

export default function Calendar({ state, dispatch, setEditing }) {
  const today = todayISO();
  const [month, setMonth] = useState(today.slice(0, 8) + "01");
  const [selected, setSelected] = useState(today);
  const byDate = sessionsByDate(state);
  const stats = summary(state, today);
  const daySessions = byDate.get(selected) || [];

  return (
    <section aria-label="Calendar">
      <div className="stat-row">
        <div className="stat">
          <strong>{stats.thisWeek}</strong>
          <span>this week</span>
        </div>
        <div className="stat">
          <strong>{stats.streak}</strong>
          <span>week streak</span>
        </div>
        <div className="stat">
          <strong>{stats.sessions}</strong>
          <span>sessions</span>
        </div>
        <div className="stat">
          <strong>{stats.hits}</strong>
          <span>hits ever</span>
        </div>
      </div>

      <div className="card cal-card">
        <div className="cal-head">
          <button className="ghost" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
            ‹
          </button>
          <h3>{monthLabel(month)}</h3>
          <button className="ghost" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <table className="cal">
          <thead>
            <tr>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <th key={i}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthGrid(month).map((row, i) => (
              <tr key={i}>
                {row.map((day) => {
                  const n = (byDate.get(day) || []).length;
                  const inMonth = day.slice(0, 7) === month.slice(0, 7);
                  return (
                    <td key={day}>
                      <button
                        className={[
                          "cal-day",
                          inMonth ? "" : "out",
                          day === today ? "today" : "",
                          day === selected ? "selected" : "",
                        ].join(" ")}
                        onClick={() => setSelected(day)}
                        aria-label={`${day}: ${n} session${n === 1 ? "" : "s"}`}
                      >
                        {+day.slice(8, 10)}
                        <span className="dots">{"•".repeat(Math.min(n, 3))}</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="day-heading">{selected}</h3>
      {daySessions.length === 0 ? (
        <p className="hint">No sessions this day.</p>
      ) : (
        daySessions.map((s) => (
          <SessionRow key={s.id} session={s} state={state} setEditing={setEditing} dispatch={dispatch} />
        ))
      )}
    </section>
  );
}
