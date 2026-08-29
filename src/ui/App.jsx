import React, { useEffect, useState } from "react";
import * as engine from "../engine/engine.js";
import { load, save, todayISO } from "../app/store.js";
import Goals from "./Goals.jsx";
import Log from "./Log.jsx";
import Journey from "./Journey.jsx";

const TABS = [
  { id: "goals", label: "Goals" },
  { id: "log", label: "Mat time" },
  { id: "journey", label: "Journey" },
];

export default function App() {
  const [state, setState] = useState(load);
  const [tab, setTab] = useState("goals");
  const [error, setError] = useState(null);
  const today = todayISO();

  useEffect(() => save(state), [state]);

  // Every engine action funnels through here: validation errors surface in
  // one banner instead of blowing up the render.
  const act = (fn, ...args) => {
    try {
      setState((s) => fn(s, ...args));
      setError(null);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const actions = {
    addGoal: (draft) => act(engine.addGoal, draft, today),
    addProgress: (id, n) => act(engine.addProgress, id, n, today),
    completeGoal: (id) => act(engine.completeGoal, id, today),
    reopenGoal: (id) => act(engine.reopenGoal, id),
    archiveGoal: (id) => act(engine.archiveGoal, id, today),
    unarchiveGoal: (id) => act(engine.unarchiveGoal, id),
    removeGoal: (id) => act(engine.removeGoal, id),
    logSession: (draft) => act(engine.logSession, draft, today),
    removeSession: (id) => act(engine.removeSession, id),
    setRank: (belt, stripes) => act(engine.setRank, belt, stripes, today),
    setWeeklyTarget: (t) => act(engine.setWeeklyTarget, t),
  };

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          BJJ <span>goal tracker</span>
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
        {tab === "goals" && <Goals state={state} actions={actions} today={today} />}
        {tab === "log" && <Log state={state} actions={actions} today={today} />}
        {tab === "journey" && <Journey state={state} actions={actions} today={today} />}
      </main>
    </div>
  );
}
