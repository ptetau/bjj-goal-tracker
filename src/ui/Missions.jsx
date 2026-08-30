// Authoring and stewardship of mission lists. Text-first: paste or type
// lines, the parser structures what it can and keeps the rest verbatim.
// Items retire rather than delete, and a met target celebrates and asks —
// next lap, or retirement — never resets itself.

import React, { useEffect, useMemo, useState } from "react";
import { LIST_TYPES, targetProgress } from "../engine/actions.js";
import { itemTitle, parseLines, toLine } from "../engine/parse.js";
import { DEFAULT_TEMPLATES, wazaCatalogue } from "../engine/templates.js";

// One fetch serves both pickers: the gym's server when reachable
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

const TYPE_LABEL = { tokui: "tokui · sharpen", growth: "growth · explore" };

const PLACEHOLDER = `Bottom => top
Back => strangle | arm bar
Top => pinning: tight weight and balance
Leg => inside heel x25`;

function Item({ item, state, dispatch }) {
  const p = targetProgress(state, item);
  const retitle = () => {
    const line = window.prompt("Item (Position => move, optional xN target):", itemTitle(item));
    if (line) dispatch("retitleItem", { itemId: item.id, line });
  };

  return (
    <li className={`mission ${p?.met ? "met" : ""} ${item.retiredAt ? "retired" : ""}`}>
      <div className="mission-head">
        <span className="mission-title">{itemTitle(item)}</span>
        <span className="mission-tools">
          {!item.retiredAt && (
            <button className="ghost tiny" onClick={retitle} aria-label={`Edit ${itemTitle(item)}`}>
              edit
            </button>
          )}
          {item.retiredAt ? (
            <button className="ghost tiny" onClick={() => dispatch("restoreItem", { itemId: item.id })}>
              restore
            </button>
          ) : (
            <button className="ghost tiny" onClick={() => dispatch("retireItem", { itemId: item.id })}>
              retire
            </button>
          )}
        </span>
      </div>

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
              <button onClick={() => dispatch("startNextLap", { itemId: item.id })}>
                next {p.target} →
              </button>
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
  const [lines, setLines] = useState("");
  const active = list.items.filter((it) => !it.retiredAt);
  const retired = list.items.filter((it) => it.retiredAt);
  const [showRetired, setShowRetired] = useState(false);

  const rename = () => {
    const name = window.prompt("List name:", list.name);
    if (name) dispatch("renameList", { listId: list.id, name });
  };

  const add = () => {
    if (dispatch("addLines", { listId: list.id, lines })) setLines("");
  };

  return (
    <div className="card list-card">
      <div className="list-head">
        <h3>
          {list.name} <span className={`list-tag list-${list.type}`}>{TYPE_LABEL[list.type]}</span>
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
          <Item key={it.id} item={it} state={state} dispatch={dispatch} />
        ))}
      </ul>
      {active.length === 0 && <p className="hint">Empty list — add some lines below.</p>}

      {retired.length > 0 && (
        <>
          <button className="ghost tiny" onClick={() => setShowRetired((v) => !v)}>
            {showRetired ? "hide" : "show"} retired ({retired.length})
          </button>
          {showRetired && (
            <ul className="mission-list">
              {retired.map((it) => (
                <Item key={it.id} item={it} state={state} dispatch={dispatch} />
              ))}
            </ul>
          )}
        </>
      )}

      <div className="add-lines">
        <textarea
          rows={2}
          value={lines}
          placeholder="Add lines — one item per line"
          onChange={(e) => setLines(e.target.value)}
        />
        <button className="ghost" onClick={add} disabled={!lines.trim()}>
          Add
        </button>
      </div>
    </div>
  );
}

// Whole starter sets: one tap creates a fully editable list.
function TemplatePicker({ templates, dispatch, onDone }) {
  const pick = (t) => {
    if (dispatch("createList", { name: t.name, type: t.type, lines: t.lines })) onDone?.();
  };

  return (
    <div className="card">
      <h3>Start from a mission set</h3>
      <div className="tpl-grid">
        {templates.map((t) => (
          <button key={t.key} className="tpl" onClick={() => pick(t)}>
            <strong>{t.name}</strong>
            <span>
              <em className={`list-tag list-${t.type}`}>{t.type}</em> {parseLines(t.lines).length} items
            </span>
          </button>
        ))}
      </div>
      <p className="hint">Every set is a starting point — retitle, retire, and retarget items to make it yours.</p>
    </div>
  );
}

// Pick-your-weapons: compose a personal tokui list technique by technique.
// The catalogue derives from the same template sets, so coach edits flow
// through; Fundamentals items arrive pre-checked as the default missions.
function WazaPicker({ templates, dispatch, onDone }) {
  const groups = useMemo(() => wazaCatalogue(templates), [templates]);
  const keyOf = (i) => `${i.position ?? ""}→${i.move}`.toLowerCase();
  const [picked, setPicked] = useState(
    () => new Set(groups.flatMap((g) => g.items.filter((i) => i.recommended).map(keyOf)))
  );

  const toggle = (i) =>
    setPicked((s) => {
      const next = new Set(s);
      const k = keyOf(i);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const create = () => {
    const items = groups.flatMap((g) => g.items.filter((i) => picked.has(keyOf(i))));
    const lines = items.map(toLine).join("\n");
    if (dispatch("createList", { name: "My tokui waza", type: "tokui", lines })) onDone?.();
  };

  return (
    <div className="card">
      <h3>Pick your tokui waza</h3>
      <p className="hint">
        Tap the techniques you want to hit every session. The starters are pre-picked — add your
        weapons, drop what isn't you.
      </p>
      {groups.map((g) => (
        <div key={g.label} className="waza-group">
          <h4>{g.label}</h4>
          <div className="chips-row">
            {g.items.map((i) => (
              <button
                key={keyOf(i)}
                className={`chip ${picked.has(keyOf(i)) ? "on" : ""}`}
                aria-pressed={picked.has(keyOf(i))}
                onClick={() => toggle(i)}
                title={`From: ${i.sources.join(", ")}`}
              >
                {i.move}
                {i.target ? <em> x{i.target}</em> : null}
              </button>
            ))}
          </div>
        </div>
      ))}
      <button className="primary wide" style={{ marginTop: 12 }} onClick={create} disabled={picked.size === 0}>
        Create my tokui list ({picked.size} waza)
      </button>
    </div>
  );
}

function NewList({ dispatch }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("tokui");
  const [lines, setLines] = useState("");

  if (!open)
    return (
      <button className="primary wide" onClick={() => setOpen(true)}>
        + New mission list
      </button>
    );

  const create = () => {
    if (dispatch("createList", { name, type, lines })) {
      setName("");
      setLines("");
      setOpen(false);
    }
  };

  return (
    <div className="card form">
      <div className="row">
        <label>
          List name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="A-game" autoFocus />
        </label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {LIST_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Items — one per line, <code>Position =&gt; move</code>, optional <code>x50</code> target
        <textarea rows={6} value={lines} placeholder={PLACEHOLDER} onChange={(e) => setLines(e.target.value)} />
      </label>
      <div className="row">
        <button className="primary" onClick={create}>
          Create list
        </button>
        <button className="ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Missions({ state, dispatch }) {
  const active = state.lists.filter((l) => !l.archivedAt);
  const archived = state.lists.filter((l) => l.archivedAt);
  const templates = useTemplates();
  const [showArchived, setShowArchived] = useState(false);
  // Which onboarding panel is open: waza picker by default on an empty tab.
  const [picker, setPicker] = useState(() => (state.lists.length === 0 ? "waza" : null));

  const pickerTabs = (
    <div className="row picker-switch">
      <button className={picker === "waza" ? "primary" : "ghost"} onClick={() => setPicker("waza")}>
        Pick tokui waza
      </button>
      <button className={picker === "sets" ? "primary" : "ghost"} onClick={() => setPicker("sets")}>
        Mission sets
      </button>
      {active.length > 0 && (
        <button className="ghost" onClick={() => setPicker(null)}>
          close
        </button>
      )}
    </div>
  );

  return (
    <section aria-label="Mission lists">
      {active.length === 0 && (
        <p className="empty">
          Two lists serve most people: a <strong>tokui</strong> list — the weapons you hit every
          session to stay sharp — and a <strong>growth</strong> list of what you're exploring.
          Pick your waza, grab a whole set, or write your own below.
        </p>
      )}
      {picker !== null && pickerTabs}
      {picker === "waza" && (
        <WazaPicker templates={templates} dispatch={dispatch} onDone={() => setPicker(null)} />
      )}
      {picker === "sets" && (
        <TemplatePicker templates={templates} dispatch={dispatch} onDone={() => setPicker(null)} />
      )}
      <NewList dispatch={dispatch} />
      {active.length > 0 && picker === null && (
        <button className="ghost wide" onClick={() => setPicker("waza")}>
          pick waza / browse mission sets
        </button>
      )}
      {active.map((l) => (
        <List key={l.id} list={l} state={state} dispatch={dispatch} />
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
                  <h3>{l.name}</h3>
                  <button className="ghost tiny" onClick={() => dispatch("restoreList", { listId: l.id })}>
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
