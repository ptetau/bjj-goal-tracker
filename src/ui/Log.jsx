import React, { useState } from "react";
import { SESSION_KINDS } from "../engine/engine.js";
import { thisWeek } from "../engine/stats.js";

export const KIND_LABEL = {
  gi: "gi",
  nogi: "no-gi",
  drilling: "drilling",
  "open-mat": "open mat",
  comp: "competition",
  private: "private",
};

function SessionForm({ state, actions, today }) {
  const blank = { date: today, minutes: 60, kind: "gi", notes: "", goalIds: [] };
  const [draft, setDraft] = useState(blank);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  // Only goals that read the log can be tagged.
  const taggable = state.goals.filter(
    (g) => !g.archivedAt && (g.type === "sessions" || g.type === "hours")
  );

  const toggleGoal = (id) =>
    setDraft((d) => ({
      ...d,
      goalIds: d.goalIds.includes(id) ? d.goalIds.filter((x) => x !== id) : [...d.goalIds, id],
    }));

  const submit = (e) => {
    e.preventDefault();
    if (actions.logSession(draft)) setDraft({ ...blank, kind: draft.kind, minutes: draft.minutes });
  };

  return (
    <form className="card form" onSubmit={submit}>
      <div className="row">
        <label>
          Date
          <input type="date" value={draft.date} max={today} onChange={set("date")} />
        </label>
        <label>
          Minutes
          <input type="number" min="1" value={draft.minutes} onChange={set("minutes")} />
        </label>
        <label>
          Kind
          <select value={draft.kind} onChange={set("kind")}>
            {SESSION_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {taggable.length > 0 && (
        <fieldset className="tags">
          <legend>Counts toward</legend>
          {taggable.map((g) => (
            <label key={g.id} className="tag">
              <input
                type="checkbox"
                checked={draft.goalIds.includes(g.id)}
                onChange={() => toggleGoal(g.id)}
              />
              {g.title}
            </label>
          ))}
        </fieldset>
      )}
      <label>
        Notes <small>(optional)</small>
        <input value={draft.notes} onChange={set("notes")} placeholder="What did you work on?" />
      </label>
      <button className="primary" type="submit">
        Log session
      </button>
    </form>
  );
}

export default function Log({ state, actions, today }) {
  const week = thisWeek(state, today);
  const target = state.profile.weeklyTarget;
  const sessions = [...state.sessions].sort((a, b) =>
    a.date === b.date ? b.id - a.id : b.date.localeCompare(a.date)
  );
  const goalTitle = (id) => state.goals.find((g) => g.id === id)?.title;

  return (
    <section aria-label="Mat time">
      <p className="week-line">
        This week: <strong>{week.sessions}</strong> of {target} sessions
        {week.minutes > 0 && <> · {Math.round(week.minutes / 6) / 10} h</>}
      </p>
      <SessionForm state={state} actions={actions} today={today} />
      {sessions.length === 0 ? (
        <p className="empty">Nothing logged yet. The mat remembers what you don't write down — badly.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id} className="session">
              <span className="session-date">{s.date}</span>
              <span className={`kind kind-${s.kind}`}>{KIND_LABEL[s.kind]}</span>
              <span className="session-min">{s.minutes} min</span>
              <span className="session-notes">
                {s.notes}
                {s.goalIds.length > 0 && (
                  <em className="session-goals"> → {s.goalIds.map(goalTitle).filter(Boolean).join(", ")}</em>
                )}
              </span>
              <button
                className="ghost danger"
                aria-label={`Delete session on ${s.date}`}
                onClick={() => {
                  if (window.confirm(`Delete the ${s.date} session?`)) actions.removeSession(s.id);
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
