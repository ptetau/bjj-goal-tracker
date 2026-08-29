import React from "react";
import { BELTS, MAX_STRIPES } from "../engine/engine.js";
import { recentWeeks, thisWeek, totals, weeklyStreak } from "../engine/stats.js";
import { KIND_LABEL } from "./Log.jsx";

// A belt drawn as a belt: rank-coloured band, the tab at one end (red for
// black belts), stripes on the tab.
function Belt({ belt, stripes }) {
  return (
    <div className={`belt belt-${belt}`} role="img" aria-label={`${belt} belt, ${stripes} stripe${stripes === 1 ? "" : "s"}`}>
      <div className="belt-tab">
        {Array.from({ length: stripes }, (_, i) => (
          <span key={i} className="stripe" />
        ))}
      </div>
    </div>
  );
}

export default function Journey({ state, actions, today }) {
  const { belt, stripes, weeklyTarget } = state.profile;
  const t = totals(state);
  const week = thisWeek(state, today);
  const streak = weeklyStreak(state, today);
  const onTargetStreak = weeklyStreak(state, today, weeklyTarget);
  const weeks = recentWeeks(state, today);
  const peak = Math.max(1, ...weeks.map((w) => w.sessions));

  return (
    <section aria-label="Journey">
      <div className="card rank-card">
        <Belt belt={belt} stripes={stripes} />
        <div className="row rank-controls">
          <label>
            Belt
            <select value={belt} onChange={(e) => actions.setRank(e.target.value, stripes)}>
              {BELTS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label>
            Stripes
            <select value={stripes} onChange={(e) => actions.setRank(belt, Number(e.target.value))}>
              {Array.from({ length: MAX_STRIPES + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sessions/week aim
            <select value={weeklyTarget} onChange={(e) => actions.setWeeklyTarget(Number(e.target.value))}>
              {Array.from({ length: 14 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <strong>{t.sessions}</strong>
          <span>sessions</span>
        </div>
        <div className="stat">
          <strong>{Math.round(t.hours * 10) / 10}</strong>
          <span>mat hours</span>
        </div>
        <div className="stat">
          <strong>{streak}</strong>
          <span>week streak</span>
        </div>
        <div className="stat">
          <strong>{onTargetStreak}</strong>
          <span>weeks on target</span>
        </div>
      </div>

      <div className="card">
        <h3>Last 8 weeks</h3>
        <div className="weeks" role="img" aria-label={`Sessions per week, oldest first: ${weeks.map((w) => w.sessions).join(", ")}`}>
          {weeks.map((w) => (
            <div key={w.start} className="week-col">
              <div
                className={`week-bar ${w.sessions >= weeklyTarget ? "hit" : ""}`}
                style={{ height: `${Math.max(4, (100 * w.sessions) / peak)}%` }}
                title={`Week of ${w.start}: ${w.sessions} session${w.sessions === 1 ? "" : "s"}`}
              />
              <span className="week-n">{w.sessions}</span>
            </div>
          ))}
        </div>
        <p className="hint">
          This week: {week.sessions}/{weeklyTarget}. Bars that hit the weekly aim glow.
        </p>
      </div>

      {Object.keys(t.byKind).length > 0 && (
        <div className="card">
          <h3>Where the hours went</h3>
          <ul className="kind-list">
            {Object.entries(t.byKind)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <li key={k}>
                  <span className={`kind kind-${k}`}>{KIND_LABEL[k]}</span> × {n}
                </li>
              ))}
          </ul>
        </div>
      )}

      {state.promotions.length > 0 && (
        <div className="card">
          <h3>Promotions</h3>
          <ul className="promo-list">
            {[...state.promotions].reverse().map((p, i) => (
              <li key={state.promotions.length - i}>
                <span className="session-date">{p.date}</span> {p.belt} belt, {p.stripes} stripe
                {p.stripes === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
