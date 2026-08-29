// The sharpness grid: one table per list, rows are active items, columns
// the sessions of the last three weeks. Cells show hits and tries both —
// on a growth list, going for it IS the win — and each row carries its
// hit- and try-consistency over the window, plainly computable from the
// cells a coach is looking at.

import React from "react";
import { sharpnessGrid, windowSessions, WINDOW_DAYS } from "../engine/stats.js";
import { itemTitle } from "../engine/parse.js";
import { todayISO } from "../app/store.js";

const dayLabel = (iso) => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;

// 0–100 → cold to sharp, as a step class rather than a gradient so adjacent
// rows are comparable at a glance.
const heat = (pct) => (pct === null ? "" : pct >= 75 ? "hot" : pct >= 40 ? "warm" : pct > 0 ? "cool" : "cold");

function ListGrid({ list, state, today }) {
  const { sessions, rows } = sharpnessGrid(state, list, today);
  if (rows.length === 0) return null;
  const growth = list.type === "growth";

  return (
    <div className="card grid-card">
      <h3>
        {list.name} <span className={`list-tag list-${list.type}`}>{list.type}</span>
      </h3>
      {sessions.length === 0 ? (
        <p className="hint">No sessions in the last {WINDOW_DAYS} days — the window is empty, not you.</p>
      ) : (
        <div className="grid-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th className="grid-item-col">item</th>
                {sessions.map((s) => (
                  <th key={s.id}>{dayLabel(s.date)}</th>
                ))}
                <th className="grid-pct">hit</th>
                <th className="grid-pct">try</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.item.id}>
                  <th className="grid-item-col">{itemTitle(r.item)}</th>
                  {r.cells.map((c, i) => (
                    <td key={sessions[i].id} className={c ? (c.hits > 0 ? "cell-hit" : "cell-try") : "cell-none"}>
                      {c ? (
                        <>
                          <b>{c.hits}</b>
                          <i>{c.tries}</i>
                        </>
                      ) : (
                        "·"
                      )}
                    </td>
                  ))}
                  {/* Growth lists lead with try-consistency: the primary chip colors by what the list is for. */}
                  <td className={`grid-pct ${!growth ? "lead " + heat(r.hitPct) : ""}`}>
                    {r.hitPct === null ? "—" : `${r.hitIn}/${sessions.length}`}
                  </td>
                  <td className={`grid-pct ${growth ? "lead " + heat(r.triedPct) : ""}`}>
                    {r.triedPct === null ? "—" : `${r.triedIn}/${sessions.length}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Grid({ state }) {
  const today = todayISO();
  const lists = state.lists.filter((l) => !l.archivedAt && l.items.some((it) => !it.retiredAt));
  const n = windowSessions(state, today).length;

  return (
    <section aria-label="Sharpness">
      <p className="week-line">
        Last {WINDOW_DAYS} days: <strong>{n}</strong> session{n === 1 ? "" : "s"}. Cells read{" "}
        <b>hits</b>
        <i className="legend-try">tries</i>; the hit/try columns count sessions where the item landed
        / was attempted.
      </p>
      {lists.length === 0 ? (
        <p className="empty">No active missions to measure yet.</p>
      ) : (
        lists.map((l) => <ListGrid key={l.id} list={l} state={state} today={today} />)
      )}
    </section>
  );
}
