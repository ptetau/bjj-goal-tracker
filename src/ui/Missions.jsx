// Two short lists, and only two. TOKUI WAZA is the handful of techniques
// you do all the time — a submission, a guard, a sweep, a takedown, maybe
// one to three more (cap 7). KAIZEN is what you're working on right now
// (cap 3 — more than that and you're working on nothing).
//
// Entry is two taps: pick the position on a rail, tap the move. Editing is
// a grid: tap the position pill to change it, type the move (with the
// catalogue suggesting), tap the target to cycle it. Colour is by position
// family, so a list reads at a glance. Items retire rather than delete, and
// a met target celebrates and asks — next lap, or retirement — never resets.

import React, { useEffect, useMemo, useState } from "react";
import { LIST_TYPES, room, targetProgress } from "../engine/actions.js";
import { itemTitle, parseLines, toLine } from "../engine/parse.js";
import { DEFAULT_TEMPLATES, FAMILIES, familyOf, wazaCatalogue } from "../engine/templates.js";

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
const famIndex = (p) => FAMILIES.findIndex((f) => f.key === familyOf(p));
const same = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

// The catalogue as a rail: positions in family order, each with its moves.
function usePositions(templates) {
  return useMemo(() => {
    const groups = wazaCatalogue(templates).filter((g) => g.position);
    return groups
      .map((g, i) => ({ position: g.position, family: familyOf(g.position), items: g.items, order: i }))
      .sort((a, b) => famIndex(a.position) - famIndex(b.position) || a.order - b.order);
  }, [templates]);
}

function PositionPill({ position, onClick, label }) {
  return (
    <button className={`pos-pill f-${familyOf(position)}`} onClick={onClick} aria-label={label}>
      {position || "free"}
    </button>
  );
}

// The rail + move grid. Two taps adds a line to the list; when the slot has
// no list yet, the first tap creates it.
function Taps({ type, state, dispatch, templates, list }) {
  const kind = KIND[type];
  const positions = usePositions(templates);
  const [pos, setPos] = useState(positions[0]?.position ?? null);
  const [target, setTarget] = useState(kind.defaultTarget);
  const [custom, setCustom] = useState("");
  const r = room(state, type);
  const full = r.left <= 0;
  const group = positions.find((g) => g.position === pos) || positions[0];
  const live = list ? list.items.filter((it) => !it.retiredAt) : [];
  const has = (move) => live.some((it) => same(it.position, group?.position) && same(it.move, move));

  const addLines = (lines) => {
    if (list) return dispatch("addLines", { listId: list.id, lines });
    return dispatch("createList", { name: kind.defaultName, type, lines });
  };
  const addMove = (move) => {
    if (full || !move.trim() || has(move)) return;
    if (addLines(toLine({ position: group.position, move: move.trim(), target }))) setCustom("");
  };
  const loadSet = (t) => {
    const lines = parseLines(t.lines).slice(0, r.max).map(toLine).join("\n");
    dispatch("createList", { name: t.name, type, lines });
  };

  const q = custom.trim().toLowerCase();
  const suggestions = q ? (group?.items || []).filter((i) => i.move.toLowerCase().includes(q) && !same(i.move, custom)).slice(0, 6) : [];

  return (
    <div className="taps">
      {!list && (
        <>
          <h4 className="taps-label">Start from a set</h4>
          <div className="chips-row">
            {templates
              .filter((t) => t.type === type)
              .map((t) => (
                <button key={t.key} className="chip f-other" onClick={() => loadSet(t)}>
                  {t.name} <em>{Math.min(r.max, parseLines(t.lines).length)}</em>
                </button>
              ))}
          </div>
          <h4 className="taps-label">Or pick position, then move</h4>
        </>
      )}
      <div className="rail" role="group" aria-label="Position">
        {positions.map((g) => (
          <button
            key={g.position}
            className={`chip f-${g.family} ${g === group ? "on" : ""}`}
            aria-pressed={g === group}
            onClick={() => setPos(g.position)}
          >
            {g.position}
          </button>
        ))}
      </div>
      <div className="tseg" role="group" aria-label="Target">
        {TARGETS.map(([v, label]) => (
          <button key={label} aria-pressed={target === v} onClick={() => setTarget(v)}>
            {label}
          </button>
        ))}
      </div>
      {full ? (
        <p className="hint">Full — {r.max} is the cap for {kind.title.toLowerCase()}. Retire something to make room.</p>
      ) : (
        group && (
          <>
            <h4 className="taps-label">
              {group.position} — tap to add
            </h4>
            <div className="chips-row">
              {group.items.map((i) => (
                <button
                  key={i.move}
                  className={`chip f-${group.family} ${has(i.move) ? "on" : ""}`}
                  disabled={has(i.move)}
                  onClick={() => addMove(i.move)}
                  aria-label={`Add ${group.position} → ${i.move}`}
                >
                  {i.move}
                </button>
              ))}
            </div>
            <div className="row taps-custom">
              <div className="acwrap">
                <input
                  type="text"
                  value={custom}
                  placeholder={`Or type a ${group.position} move`}
                  autoCapitalize="off"
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-label={`Custom ${group.position} move`}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMove(custom);
                    }
                  }}
                />
                {suggestions.length > 0 && (
                  <div className="ac">
                    {suggestions.map((i) => (
                      <button key={i.move} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => addMove(i.move)}>
                        {i.move}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="primary" onClick={() => addMove(custom)} disabled={!custom.trim() || has(custom)}>
                Add
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}

// One editable row of the grid.
function Row({ item, state, dispatch, positions, canRestore }) {
  const [picking, setPicking] = useState(false);
  const [move, setMove] = useState(item.move);
  const [focus, setFocus] = useState(false);
  useEffect(() => setMove(item.move), [item.move]);
  const p = targetProgress(state, item);
  const family = familyOf(item.position);
  const group = positions.find((g) => same(g.position, item.position));

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
  const pool = group ? group.items : [];
  const suggestions = focus && q ? pool.filter((i) => i.move.toLowerCase().includes(q) && i.move !== move).slice(0, 5) : [];
  const known = [...positions.map((g) => g.position)];
  if (item.position && !known.some((x) => same(x, item.position))) known.unshift(item.position);

  return (
    <li className={`mission row-edit f-${family} ${p?.met ? "met" : ""} ${item.retiredAt ? "retired" : ""}`}>
      <div className="row-line">
        <PositionPill
          position={item.position}
          label={`Position: ${item.position || "free-form"}. Tap to change`}
          onClick={() => !item.retiredAt && setPicking((v) => !v)}
        />
        {item.retiredAt ? (
          <span className="row-move">{item.move}</span>
        ) : (
          <div className="acwrap row-move">
            <input
              type="text"
              value={move}
              aria-label={`Move for ${itemTitle(item)}`}
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
                {suggestions.map((i) => (
                  <button key={i.move} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setMove(i.move); retitle(item.position, i.move); }}>
                    {i.move}
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
              className={`chip f-${familyOf(x)} ${same(x, item.position) ? "on" : ""}`}
              onClick={() => {
                setPicking(false);
                retitle(x);
              }}
            >
              {x}
            </button>
          ))}
          <button
            className={`chip f-other ${!item.position ? "on" : ""}`}
            onClick={() => {
              setPicking(false);
              retitle(null);
            }}
          >
            free-form
          </button>
        </div>
      )}

      {p && (
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

function List({ list, state, dispatch, templates }) {
  const positions = usePositions(templates);
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
      <div className="list-head">
        <h3>
          {list.name} <span className={`list-tag list-${list.type}`}>{KIND[list.type].tag}</span>
        </h3>
        <span className="mission-tools">
          <button className="ghost tiny" onClick={rename}>rename</button>
          <button className="ghost tiny" onClick={() => dispatch("archiveList", { listId: list.id })}>
            archive
          </button>
        </span>
      </div>

      <ul className="mission-list">
        {active.map((it) => (
          <Row key={it.id} item={it} state={state} dispatch={dispatch} positions={positions} />
        ))}
      </ul>
      {active.length === 0 && <p className="hint">Empty list — tap a position and a move below.</p>}

      {retired.length > 0 && (
        <>
          <button className="ghost tiny" onClick={() => setShowRetired((v) => !v)}>
            {showRetired ? "hide" : "show"} retired ({retired.length})
          </button>
          {showRetired && (
            <ul className="mission-list">
              {retired.map((it) => (
                <Row key={it.id} item={it} state={state} dispatch={dispatch} positions={positions} canRestore={r.left > 0} />
              ))}
            </ul>
          )}
        </>
      )}

    </div>
  );
}

// One slot per kind. While the slot has a list, it shows it; while it is
// empty, the same two taps create it.
function Slot({ type, state, dispatch, templates }) {
  const kind = KIND[type];
  const lists = state.lists.filter((l) => l.type === type && !l.archivedAt);
  const r = room(state, type);

  return (
    <div className="slot">
      <h2 className="slot-title">
        {kind.title} <span className={`list-tag list-${type}`}>{r.live} of {r.max}</span>
      </h2>
      <p className="hint">{kind.blurb}</p>
      {/* Keyed siblings, so the rail keeps its position when the first tap
          turns an empty slot into a list card above it. */}
      {[
        ...lists.map((l) => <List key={l.id} list={l} state={state} dispatch={dispatch} templates={templates} />),
        <div key="taps" className="card taps-card">
          <Taps type={type} state={state} dispatch={dispatch} templates={templates} list={lists[0] || null} />
        </div>,
      ]}
      {lists.length > 1 && (
        <p className="hint">
          {kind.title} is one list — archive the extras. Their history stays.
        </p>
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
        {FAMILIES.map((f) => (
          <span key={f.key}>
            <i className={`f-${f.key}`} aria-hidden="true" /> {f.label}
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
