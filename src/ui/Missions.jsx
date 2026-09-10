// Two short lists, and only two. TOKUI WAZA is the handful of techniques
// you do all the time — a submission, a guard, a sweep, a takedown, maybe
// one to three more (cap 7). KAIZEN is what you're working on right now
// (cap 3 — more than that and you're working on nothing).
//
// Every item is a step on the ladder, "from => to" (see engine/ladder.js).
// Entry is a sheet with one step at a time: pick the "from" — one of the
// four disconnected shapes, or a connection — then tap where it goes: a
// connection to make or transition to, Hold to maintain, or a finish to
// profit. Editing is a grid: tap the from-pill to change it, type the "to"
// (with the ladder suggesting), tap the target to cycle it. Colour is by
// rung, so a list shows at a glance whether it is all finishes and no
// entries. Items retire rather than delete, and a met target celebrates
// and asks — next lap, or retirement — never resets.

import React, { useEffect, useMemo, useState } from "react";
import { LIST_TYPES, room, targetProgress } from "../engine/actions.js";
import { itemTitle, parseLines, toLine } from "../engine/parse.js";
import { DEFAULT_TEMPLATES } from "../engine/templates.js";
import { CONNECTIONS, DISCONNECTED, FINISHES, RUNGS, isDisconnected, ladderGraph, rungOf, toOptions } from "../engine/ladder.js";

// One fetch serves the rail: the gym's server when reachable
// (coach-owned), the shipped defaults offline.
function useTemplates() {
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  useEffect(() => {
    let alive = true;
    fetch("/api/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (alive && Array.isArray(body?.templates) && body.templates.length) setTemplates(body.templates);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return templates;
}

const KIND = {
  tokui: {
    title: "Tokui waza",
    tag: "tokui · sharpen",
    blurb: "Your special techniques: a submission, a guard, a sweep, a takedown, maybe one to three more. Hit them every session.",
    defaultName: "My tokui waza",
    defaultTarget: 25,
  },
  growth: {
    title: "Kaizen",
    tag: "kaizen · explore",
    blurb: "What you're working on right now. More than three and you're working on nothing.",
    defaultName: "Kaizen",
    defaultTarget: 50,
  },
};

const TARGETS = [
  [null, "no target"],
  [25, "x25"],
  [50, "x50"],
];
const same = (a, b) =>
  String(a ?? "").trim().toLowerCase().replace(/[’']/g, "") === String(b ?? "").trim().toLowerCase().replace(/[’']/g, "");

// The first tap's rail: the four disconnected shapes, then every connection.
const FROMS = [...DISCONNECTED.map((d) => d.label), ...CONNECTIONS];
const RUNG_LABEL = Object.fromEntries(RUNGS.map((r) => [r.key, r.label]));
const KIND_LABEL = { takedown: "Takedown", position: "Pins and back", submission: "Submissions" };

// The "from" pill, coloured by the rung the whole item lands on.
function FromPill({ item, onClick, label }) {
  const rung = rungOf(item.position, item.move);
  return (
    <button className={`pos-pill r-${rung} ${isDisconnected(item.position) ? "open" : ""}`} onClick={onClick} aria-label={label}>
      {item.position || "free"}
    </button>
  );
}

// The second step's options, grouped for headings: Hold, connections (make
// or transition), finishes by kind.
function groupOptions(opts) {
  const groups = [];
  const hold = opts.filter((o) => o.rung === "maintain");
  const conns = opts.filter((o) => o.rung === "make" || o.rung === "transition");
  if (hold.length) groups.push({ title: "Maintain", rung: "maintain", options: hold });
  if (conns.length) groups.push({ title: conns[0].rung === "make" ? "Make the connection" : "Transition to", rung: conns[0].rung, options: conns });
  for (const kind of ["takedown", "position", "submission"]) {
    const fin = opts.filter((o) => o.rung === "profit" && finishKind(o.to) === kind);
    if (fin.length) groups.push({ title: `Profit · ${KIND_LABEL[kind]}`, rung: "profit", options: fin });
  }
  const off = opts.filter((o) => o.rung === "other");
  if (off.length) groups.push({ title: "Off the ladder", rung: "other", options: off });
  return groups;
}
const finishKind = (to) => FINISHES.find((f) => same(f.label, to))?.kind;

// The add sheet: one step at a time, over the graph the gym built (the
// coach's sets). Step one picks the "from" — a disconnected shape or a
// connection that has an edge; step two picks where it goes, only the
// edges the sets contain, grouped by rung. A tap adds the line and stays
// on step two, so "Front headlock → Darce" then "→ Guillotine" is two
// taps, not four. The text box reaches the rest of the ladder. The first
// line of an empty slot creates its list.
function AddSheet({ type, state, dispatch, list, templates, onClose }) {
  const kind = KIND[type];
  const graph = useMemo(() => ladderGraph(templates), [templates]);
  const [from, setFrom] = useState(null);
  const [target, setTarget] = useState(kind.defaultTarget);
  const [custom, setCustom] = useState("");
  const r = room(state, type);
  const full = r.left <= 0;
  const live = list ? list.items.filter((it) => !it.retiredAt) : [];
  const has = (to) => live.some((it) => same(it.position, from) && same(it.move, to));
  const groups = useMemo(() => (from ? groupOptions(graph.edges.get(from) || []) : []), [from, graph]);
  const added = live.filter((it) => same(it.position, from)).length;

  const addLines = (lines) => {
    if (list) return dispatch("addLines", { listId: list.id, lines });
    return dispatch("createList", { name: kind.defaultName, type, lines });
  };
  const addTo = (to) => {
    if (full || !to.trim() || has(to)) return;
    if (addLines(toLine({ position: from, move: to.trim(), target }))) setCustom("");
  };

  const q = custom.trim().toLowerCase();
  const suggestions = q && from ? toOptions(from).filter((o) => o.to.toLowerCase().includes(q) && !same(o.to, custom)).slice(0, 6) : [];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`Add to ${kind.title}`}>
      <div className="sheet add-sheet">
        <div className="sheet-head">
          {from ? (
            <button className="ghost" onClick={() => setFrom(null)} aria-label="Back to from">
              ‹ {from}
            </button>
          ) : (
            <h2>From</h2>
          )}
          <span className="count">{r.live} of {r.max}</span>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>

        {!from && (
          <>
            <h4 className="taps-label">Disconnected</h4>
            <div className="chips-row">
              {graph.froms.filter(isDisconnected).map((f) => (
                <button key={f} className="chip open" title={DISCONNECTED.find((d) => same(d.label, f))?.hint} onClick={() => setFrom(f)}>
                  {f}
                </button>
              ))}
            </div>
            <h4 className="taps-label">Connections</h4>
            <div className="chips-row">
              {graph.froms.filter((f) => !isDisconnected(f)).map((f) => (
                <button key={f} className="chip r-other" onClick={() => setFrom(f)}>
                  {f}
                </button>
              ))}
            </div>
          </>
        )}

        {from && full && (
          <p className="hint">Full — {r.max} is the cap for {kind.title.toLowerCase()}. Retire something to make room.</p>
        )}

        {from && !full && (
          <>
            <div className="tseg" role="group" aria-label="Target">
              {TARGETS.map(([v, label]) => (
                <button key={label} aria-pressed={target === v} onClick={() => setTarget(v)}>
                  {label}
                </button>
              ))}
            </div>
            {groups.map((g) => (
              <div key={g.title}>
                <h4 className="taps-label">
                  <span className={`rung-tag r-${g.rung}`}>{g.title}</span>
                </h4>
                <div className="chips-row">
                  {g.options.map((o) => (
                    <button
                      key={o.to}
                      className={`chip r-${o.rung} ${has(o.to) ? "on" : ""}`}
                      disabled={has(o.to)}
                      onClick={() => addTo(o.to)}
                      aria-label={`Add ${from} → ${o.to}`}
                    >
                      {o.to}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="row taps-custom">
              <div className="acwrap">
                <input
                  type="text"
                  value={custom}
                  placeholder="Or type where it goes (the rest of the ladder)"
                  autoCapitalize="off"
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-label={`Custom destination from ${from}`}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTo(custom);
                    }
                  }}
                />
                {suggestions.length > 0 && (
                  <div className="ac">
                    {suggestions.map((o) => (
                      <button key={o.to} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addTo(o.to)}>
                        <b className={`r-${o.rung}`}>{RUNG_LABEL[o.rung]}</b> {o.to}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="primary" onClick={() => addTo(custom)} disabled={!custom.trim() || has(custom)}>
                Add
              </button>
            </div>
            {added > 0 && (
              <p className="hint">
                {added} on the list from {from}. Tap another, or Done.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// One editable row of the grid.
function Row({ item, state, dispatch, canRestore }) {
  const [picking, setPicking] = useState(false);
  const [move, setMove] = useState(item.move);
  const [focus, setFocus] = useState(false);
  useEffect(() => setMove(item.move), [item.move]);
  const p = targetProgress(state, item);
  const rung = rungOf(item.position, item.move);

  const retitle = (position, nextMove) => {
    const m = (nextMove ?? move).trim();
    if (!m) {
      setMove(item.move);
      return;
    }
    if (same(position, item.position) && m === item.move) return;
    dispatch("retitleItem", { itemId: item.id, line: toLine({ position, move: m, target: null }) });
  };
  const cycleTarget = () => {
    const next = item.target === null ? 25 : item.target === 25 ? 50 : null;
    dispatch("setTarget", { itemId: item.id, target: next });
  };

  const q = move.trim().toLowerCase();
  const suggestions = focus && q ? toOptions(item.position).filter((o) => o.to.toLowerCase().includes(q) && o.to !== move).slice(0, 5) : [];
  const known = [...FROMS];
  if (item.position && !known.some((x) => same(x, item.position))) known.unshift(item.position);

  return (
    <li className={`mission row-edit r-${rung} ${p?.met ? "met" : ""} ${item.retiredAt ? "retired" : ""}`}>
      <div className="row-line">
        <FromPill
          item={item}
          label={`From: ${item.position || "free-form"}. Tap to change`}
          onClick={() => !item.retiredAt && setPicking((v) => !v)}
        />
        {item.retiredAt ? (
          <span className="row-move">{item.move}</span>
        ) : (
          <div className="acwrap row-move">
            <input
              type="text"
              value={move}
              aria-label={`Destination for ${itemTitle(item)}`}
              autoCapitalize="off"
              autoComplete="off"
              onChange={(e) => setMove(e.target.value)}
              onFocus={() => setFocus(true)}
              onBlur={() => {
                setFocus(false);
                retitle(item.position);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
            />
            {suggestions.length > 0 && (
              <div className="ac">
                {suggestions.map((o) => (
                  <button key={o.to} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setMove(o.to); retitle(item.position, o.to); }}>
                    <b className={`r-${o.rung}`}>{RUNG_LABEL[o.rung]}</b> {o.to}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!item.retiredAt && (
          <button className="tgt-btn" onClick={cycleTarget} aria-label={`Target ${item.target ? `x${item.target}` : "none"}. Tap to change`}>
            {item.target ? `x${item.target}` : "—"}
          </button>
        )}
        {item.retiredAt ? (
          <button
            className="ghost tiny"
            disabled={!canRestore}
            title={canRestore ? "" : "The list is full — retire something first"}
            onClick={() => dispatch("restoreItem", { itemId: item.id })}
          >
            restore
          </button>
        ) : (
          <button className="xbtn" onClick={() => dispatch("retireItem", { itemId: item.id })} aria-label={`Retire ${itemTitle(item)}`}>
            ×
          </button>
        )}
      </div>

      {picking && (
        <div className="chips-row picker">
          {known.map((x) => (
            <button
              key={x}
              className={`chip ${isDisconnected(x) ? "open" : "r-other"} ${same(x, item.position) ? "on" : ""}`}
              onClick={() => {
                setPicking(false);
                retitle(x);
              }}
            >
              {x}
            </button>
          ))}
          <button
            className={`chip r-other ${!item.position ? "on" : ""}`}
            onClick={() => {
              setPicking(false);
              retitle(null);
            }}
          >
            free-form
          </button>
        </div>
      )}

      {p && (p.done > 0 || p.met) && (
        <>
          <div
            className="bar"
            role="progressbar"
            aria-valuenow={p.done}
            aria-valuemin={0}
            aria-valuemax={p.target}
            aria-label={`${itemTitle(item)}: ${p.done} of ${p.target} hits${p.lap > 1 ? `, lap ${p.lap}` : ""}`}
          >
            <div className="bar-fill" style={{ width: `${p.pct}%` }} />
          </div>
          <p className="bar-caption">
            {p.done} / {p.target} hits{p.lap > 1 && <span className="lap"> · lap {p.lap}</span>}
          </p>
          {p.met && !item.retiredAt && (
            <div className="celebrate">
              <strong>🏅 Lap {p.lap} done!</strong>
              <button onClick={() => dispatch("startNextLap", { itemId: item.id })}>next {p.target} →</button>
              <button className="ghost" onClick={() => dispatch("retireItem", { itemId: item.id })}>
                retire it
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

function List({ list, state, dispatch }) {
  const active = list.items.filter((it) => !it.retiredAt);
  const retired = list.items.filter((it) => it.retiredAt);
  const [showRetired, setShowRetired] = useState(false);
  const r = room(state, list.type);

  const rename = () => {
    const name = window.prompt("List name:", list.name);
    if (name) dispatch("renameList", { listId: list.id, name });
  };

  return (
    <div className="card list-card">
      <ul className="mission-list">
        {active.map((it) => (
          <Row key={it.id} item={it} state={state} dispatch={dispatch} />
        ))}
      </ul>
      {active.length === 0 && <p className="hint">Empty list — tap Add below.</p>}

      {retired.length > 0 && (
        <>
          <button className="ghost tiny" onClick={() => setShowRetired((v) => !v)}>
            {showRetired ? "hide" : "show"} retired ({retired.length})
          </button>
          {showRetired && (
            <ul className="mission-list">
              {retired.map((it) => (
                <Row key={it.id} item={it} state={state} dispatch={dispatch} canRestore={r.left > 0} />
              ))}
            </ul>
          )}
        </>
      )}

    </div>
  );
}

// One slot per kind: the list (if any), one Add button, and the sheet it
// opens. An empty slot also offers the coach's sets, trimmed to the cap.
function Slot({ type, state, dispatch, templates }) {
  const kind = KIND[type];
  const lists = state.lists.filter((l) => l.type === type && !l.archivedAt);
  const list = lists[0] || null;
  const r = room(state, type);
  const [adding, setAdding] = useState(false);

  const loadSet = (t) => {
    const lines = parseLines(t.lines).slice(0, r.max).map(toLine).join("\n");
    dispatch("createList", { name: t.name, type, lines });
  };

  return (
    <div className="slot">
      <h2 className="slot-title">
        {kind.title} <span className={`list-tag list-${type}`}>{r.live} of {r.max}</span>
      </h2>
      {!list && <p className="hint">{kind.blurb}</p>}
      {lists.map((l) => (
        <List key={l.id} list={l} state={state} dispatch={dispatch} />
      ))}
      {!list && (
        <div className="chips-row sets">
          {templates
            .filter((t) => t.type === type)
            .map((t) => (
              <button key={t.key} className="chip r-other" onClick={() => loadSet(t)}>
                {t.name} <em>{Math.min(r.max, parseLines(t.lines).length)}</em>
              </button>
            ))}
        </div>
      )}
      {r.left > 0 ? (
        <button className="primary wide add-btn" onClick={() => setAdding(true)}>
          + Add to {kind.title.toLowerCase()}
        </button>
      ) : (
        <p className="hint">Full — {r.max} is the cap. Retire something to make room.</p>
      )}
      {lists.length > 1 && (
        <p className="hint">
          {kind.title} is one list — archive the extras. Their history stays.
        </p>
      )}
      {adding && (
        <AddSheet type={type} state={state} dispatch={dispatch} list={list} templates={templates} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}

export default function Missions({ state, dispatch }) {
  const archived = state.lists.filter((l) => l.archivedAt);
  const templates = useTemplates();
  const [showArchived, setShowArchived] = useState(false);

  return (
    <section aria-label="Mission lists">
      <div className="legend" aria-label="Colour key">
        {RUNGS.filter((r) => r.key !== "other").map((r) => (
          <span key={r.key} title={r.blurb}>
            <i className={`r-${r.key}`} aria-hidden="true" /> {r.label}
          </span>
        ))}
      </div>
      {LIST_TYPES.map((type) => (
        <Slot key={type} type={type} state={state} dispatch={dispatch} templates={templates} />
      ))}
      {archived.length > 0 && (
        <>
          <button className="ghost wide" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? "hide" : "show"} archived lists ({archived.length})
          </button>
          {showArchived &&
            archived.map((l) => (
              <div key={l.id} className="card list-card archived">
                <div className="list-head">
                  <h3>
                    {l.name} <span className={`list-tag list-${l.type}`}>{KIND[l.type].tag}</span>
                  </h3>
                  <button
                    className="ghost tiny"
                    disabled={state.lists.some((x) => x.type === l.type && !x.archivedAt)}
                    title="Archive the current list of this kind first"
                    onClick={() => dispatch("restoreList", { listId: l.id })}
                  >
                    restore
                  </button>
                </div>
              </div>
            ))}
        </>
      )}
    </section>
  );
}
