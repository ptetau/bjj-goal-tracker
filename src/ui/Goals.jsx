import React, { useState } from "react";
import { GOAL_TYPES, goalProgress } from "../engine/engine.js";
import { daysLeft } from "../engine/stats.js";

const TYPE_LABEL = {
  sessions: "sessions trained",
  hours: "hours on the mat",
  count: "count something",
  milestone: "milestone",
};

const fmtDone = (goal, p) =>
  goal.type === "hours"
    ? `${(Math.round(p.done * 10) / 10).toLocaleString()} / ${p.target} h`
    : `${p.done.toLocaleString()} / ${p.target}${goal.type === "count" ? ` ${goal.unit}` : ""}`;

function Deadline({ goal, today, complete }) {
  const left = daysLeft(goal, today);
  if (left === null || complete) return null;
  if (left < 0) return <span className="due overdue">{-left}d overdue</span>;
  if (left === 0) return <span className="due soon">due today</span>;
  return <span className={left <= 7 ? "due soon" : "due"}>{left}d left</span>;
}

function GoalCard({ goal, state, actions, today }) {
  const p = goalProgress(state, goal);
  return (
    <li className={`goal ${p.complete ? "complete" : ""} ${goal.archivedAt ? "archived" : ""}`}>
      <div className="goal-head">
        <h3>{goal.title}</h3>
        <Deadline goal={goal} today={today} complete={p.complete} />
      </div>
      {goal.notes && <p className="notes">{goal.notes}</p>}

      {goal.type === "milestone" ? (
        <p className="milestone-state">{p.complete ? "✔ done" : "not yet"}</p>
      ) : (
        <>
          <div
            className="bar"
            role="progressbar"
            aria-valuenow={Math.round(p.done)}
            aria-valuemin={0}
            aria-valuemax={p.target}
            aria-label={`${goal.title}: ${fmtDone(goal, p)}`}
          >
            <div className="bar-fill" style={{ width: `${p.pct}%` }} />
          </div>
          <p className="bar-caption">{fmtDone(goal, p)}</p>
        </>
      )}

      <div className="goal-actions">
        {goal.type === "count" && !goal.archivedAt && !p.complete && (
          <>
            <button onClick={() => actions.addProgress(goal.id, 1)}>+1</button>
            <button onClick={() => actions.addProgress(goal.id, 10)}>+10</button>
            {goal.manual > 0 && (
              <button className="ghost" onClick={() => actions.addProgress(goal.id, -1)}>
                −1
              </button>
            )}
          </>
        )}
        {goal.type === "milestone" && !goal.archivedAt && (
          <button onClick={() => (p.complete ? actions.reopenGoal(goal.id) : actions.completeGoal(goal.id))}>
            {p.complete ? "reopen" : "mark done"}
          </button>
        )}
        {goal.archivedAt ? (
          <>
            <button className="ghost" onClick={() => actions.unarchiveGoal(goal.id)}>
              restore
            </button>
            <button
              className="ghost danger"
              onClick={() => {
                if (window.confirm(`Delete "${goal.title}" for good?`)) actions.removeGoal(goal.id);
              }}
            >
              delete
            </button>
          </>
        ) : (
          <button className="ghost" onClick={() => actions.archiveGoal(goal.id)}>
            archive
          </button>
        )}
      </div>
    </li>
  );
}

function AddGoal({ actions }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", type: "sessions", target: 12, unit: "", deadline: "", notes: "" });
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  if (!open)
    return (
      <button className="primary wide" onClick={() => setOpen(true)}>
        + New goal
      </button>
    );

  const submit = (e) => {
    e.preventDefault();
    if (actions.addGoal(draft)) {
      setDraft({ title: "", type: "sessions", target: 12, unit: "", deadline: "", notes: "" });
      setOpen(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <label>
        Goal
        <input value={draft.title} onChange={set("title")} placeholder="Hit 50 armbars from guard" autoFocus />
      </label>
      <div className="row">
        <label>
          Type
          <select value={draft.type} onChange={set("type")}>
            {GOAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        {draft.type !== "milestone" && (
          <label>
            Target
            <input type="number" min="1" value={draft.target} onChange={set("target")} />
          </label>
        )}
        {draft.type === "count" && (
          <label>
            Unit
            <input value={draft.unit} onChange={set("unit")} placeholder="reps" />
          </label>
        )}
      </div>
      <div className="row">
        <label>
          Deadline <small>(optional)</small>
          <input type="date" value={draft.deadline} onChange={set("deadline")} />
        </label>
      </div>
      <label>
        Notes <small>(optional)</small>
        <input value={draft.notes} onChange={set("notes")} placeholder="Why this goal matters" />
      </label>
      <div className="row">
        <button className="primary" type="submit">
          Add goal
        </button>
        <button className="ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {(draft.type === "sessions" || draft.type === "hours") && (
        <p className="hint">Progress comes from the mat-time log — tag this goal when you log a session.</p>
      )}
    </form>
  );
}

export default function Goals({ state, actions, today }) {
  const [showDone, setShowDone] = useState(false);
  const live = state.goals.filter((g) => !g.archivedAt);
  const open = live.filter((g) => !goalProgress(state, g).complete);
  const done = live.filter((g) => goalProgress(state, g).complete);
  const archived = state.goals.filter((g) => g.archivedAt);

  return (
    <section aria-label="Goals">
      <AddGoal actions={actions} />
      {open.length === 0 && state.goals.length === 0 && (
        <p className="empty">No goals yet. Pick one thing to chase this cycle — a comp, a technique count, a training habit.</p>
      )}
      <ul className="goal-list">
        {open.map((g) => (
          <GoalCard key={g.id} goal={g} state={state} actions={actions} today={today} />
        ))}
      </ul>

      {(done.length > 0 || archived.length > 0) && (
        <button className="ghost wide" onClick={() => setShowDone((v) => !v)}>
          {showDone ? "hide" : "show"} finished &amp; archived ({done.length + archived.length})
        </button>
      )}
      {showDone && (
        <ul className="goal-list">
          {[...done, ...archived].map((g) => (
            <GoalCard key={g.id} goal={g} state={state} actions={actions} today={today} />
          ))}
        </ul>
      )}
    </section>
  );
}
