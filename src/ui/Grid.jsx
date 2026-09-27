// The sharpness grid: one table per kind — A your tokui waza, B kaizen,
// the same two banks as the deck — rows are the live items, columns the
// sessions of the last three weeks. Cells show hits and tries both — on a
// kaizen list, going for it IS the win — and each row carries its hit- and
// try-consistency over the window, plainly computable from the cells a
// coach is looking at. Both grids are always drawn: an empty bank is one
// row that says so, an empty window is a grid with no session columns.

import React from "react";
import { liveBanks } from "../engine/actions.js";
import { sharpnessGrid, windowSessions, WINDOW_DAYS } from "../engine/stats.js";
import { itemTitle } from "../engine/parse.js";
import { todayISO } from "../app/store.js";

const dayLabel = (iso) => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;

// 0–100 → cold to sharp, as a step class rather than a gradient so adjacent
// rows are comparable at a glance.
const heat = (pct) => (pct === null ? "" : pct >= 75 ? "hot" : pct >= 40 ? "warm" : pct > 0 ? "cool" : "cold");

const BANKS = {
  tokui: { title: "Tokui waza", empty: "Nothing here yet — add your tokui waza in Missions." },
  growth: { title: "Kaizen", empty: "Nothing here yet — pick what you're working on in Missions." },
};

function BankGrid({ bank, state, today }) {
  const { sessions, rows } = sharpnessGrid(state, bank, today);
  const growth = bank.type === "growth";
  const width = sessions.length + 3;

  return (
    <div className="card grid-card">
      <h3>
        {BANKS[bank.type].title} <span className={`list-tag list-${bank.type}`}>{bank.type === "growth" ? "kaizen" : "tokui"}</span>
      </h3>
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
            {rows.length === 0 && (
              <tr className="grid-empty">
                <td colSpan={width}>{BANKS[bank.type].empty}</td>
              </tr>
            )}
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
                {/* Kaizen leads with try-consistency: the lead chip colours by what the bank is for. */}
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
    </div>
  );
}

export default function Grid({ state }) {
  const today = todayISO();
  const n = windowSessions(state, today).length;

  return (
    <section aria-label="Sharpness">
      <p className="week-line">
        Last {WINDOW_DAYS} days: <strong>{n}</strong> session{n === 1 ? "" : "s"}, one column each. The hit / try columns count the sessions an item landed / was tried in.
      </p>
      <div className="legend grid-key" aria-label="Grid key">
        <span>
          <i className="k-hit" aria-hidden="true" /> <b>2</b>
          <small>3</small> hits, tries
        </span>
        <span>
          <i className="k-try" aria-hidden="true" /> tried, no hit
        </span>
        <span>
          <i className="k-none" aria-hidden="true" /> not attempted
        </span>
        <span>
          <i className="k-hot" aria-hidden="true" /> sharp
        </span>
        <span>
          <i className="k-cold" aria-hidden="true" /> cold
        </span>
      </div>
      {liveBanks(state).map((bank) => (
        <BankGrid key={bank.type} bank={bank} state={state} today={today} />
      ))}
    </section>
  );
}
