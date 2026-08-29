import React, { useMemo, useRef, useState } from "react";
import { apply, openSession } from "../engine/actions.js";
import { loadLog, loadState, nowISO, saveLog } from "../app/store.js";
import Missions from "./Missions.jsx";
import Roll from "./Roll.jsx";
import Grid from "./Grid.jsx";
import Calendar from "./Calendar.jsx";
import SessionEditor from "./SessionEditor.jsx";

const TABS = [
  { id: "roll", label: "Roll" },
  { id: "missions", label: "Missions" },
  { id: "grid", label: "Grid" },
  { id: "calendar", label: "Calendar" },
];

export default function App() {
  const logRef = useRef(null);
  if (logRef.current === null) logRef.current = loadLog();
  const [state, setState] = useState(() => loadState(logRef.current));
  const [tab, setTab] = useState(() =>
    openSession(loadState(logRef.current)) || loadState(logRef.current).lists.length
      ? "roll"
      : "missions"
  );
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // session id under the editor overlay

  // Dispatch stamps the action, folds it through the pure engine, and
  // appends it to the persisted log — errors surface in one banner.
  const dispatch = (type, payload) => {
    const action = { type, payload, at: nowISO() };
    try {
      const next = apply(state, action);
      logRef.current = [...logRef.current, action];
      saveLog(logRef.current);
      setState(next);
      setError(null);
      return next;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  const live = useMemo(() => openSession(state), [state]);
  const props = { state, dispatch, live, setEditing };

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          TOKUI <span>得意</span>
        </h1>
        <nav role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "roll" && live && <span className="live-dot" aria-label="session in progress" />}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
          <button className="ghost" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <main>
        {tab === "roll" && <Roll {...props} />}
        {tab === "missions" && <Missions {...props} />}
        {tab === "grid" && <Grid {...props} />}
        {tab === "calendar" && <Calendar {...props} />}
      </main>

      {editing !== null && (
        <SessionEditor
          state={state}
          dispatch={dispatch}
          sessionId={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
