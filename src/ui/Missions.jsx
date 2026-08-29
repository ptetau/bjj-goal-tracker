// Authoring and stewardship of mission lists. Text-first: paste or type
// lines, the parser structures what it can and keeps the rest verbatim.
// Items retire rather than delete, and a met target celebrates and asks —
// next lap, or retirement — never resets itself.

import React, { useState } from "react";
import { LIST_TYPES, targetProgress } from "../engine/actions.js";
import { itemTitle } from "../engine/parse.js";

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
  const [showArchived, setShowArchived] = useState(false);

  return (
    <section aria-label="Mission lists">
      <NewList dispatch={dispatch} />
      {active.length === 0 && (
        <p className="empty">
          Two lists serve most people: a <strong>tokui</strong> list — the weapons you hit every
          session to stay sharp — and a <strong>growth</strong> list of what you're exploring.
        </p>
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
