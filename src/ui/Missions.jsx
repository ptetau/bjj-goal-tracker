// Two short lists, and only two. TOKUI WAZA is the handful of techniques
// you do all the time — a submission, a guard, a sweep, a takedown, maybe
// one to three more (cap 7). KAIZEN is what you're working on right now
// (cap 3 — more than that and you're working on nothing). Each is one
// list you keep; the tab offers a way to make one only while the slot is
// empty. Text-first authoring: the parser structures what it can and
// keeps the rest verbatim. Items retire rather than delete, and a met
// target celebrates and asks — next lap, or retirement — never resets.

import React, { useEffect, useMemo, useState } from "react";
import { LIST_TYPES, room, targetProgress } from "../engine/actions.js";
import { itemTitle, parseLines, toLine } from "../engine/parse.js";
import { DEFAULT_TEMPLATES, wazaCatalogue } from "../engine/templates.js";

// One fetch serves the picker: the gym's server when reachable
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
    placeholder: `Back => strangle x25
Closed guard => sweep to mount
Standing => single leg x25`,
  },
  growth: {
    title: "Kaizen",
    tag: "kaizen · explore",
    blurb: "What you're working on right now. More than three and you're working on nothing.",
    defaultName: "Kaizen",
    placeholder: `Leg => inside heel hook x50
DLR => berimbolo`,
  },
};

function Item({ item, state, dispatch, canRestore }) {
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
            <button
              className="ghost tiny"
              disabled={!canRestore}
              title={canRestore ? "" : "The list is full — retire something first"}
              onClick={() => dispatch("restoreItem", { itemId: item.id })}
            >
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
  const r = room(state, list.type);
  const adding = parseLines(lines).length;

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
                <Item key={it.id} item={it} state={state} dispatch={dispatch} canRestore={r.left > 0} />
              ))}
            </ul>
          )}
        </>
      )}

      {r.left > 0 ? (
        <div className="add-lines">
          <textarea
            rows={2}
            value={lines}
            placeholder={`Add up to ${r.left} more — one per line`}
            onChange={(e) => setLines(e.target.value)}
          />
          <button className="ghost" onClick={add} disabled={adding === 0 || adding > r.left}>
            Add
          </button>
        </div>
      ) : (
        <p className="hint">
          Full — {r.max} is the cap for {KIND[list.type].title.toLowerCase()}. Retire something to make room.
        </p>
      )}
      {adding > r.left && r.left > 0 && (
        <p className="hint">
          That's {adding} lines, room for {r.left}. Trim it, or retire something first.
        </p>
      )}
    </div>
  );
}

// Pick-your-weapons: compose the tokui list technique by technique, up to
// the cap. The catalogue derives from the coach's template sets, so their
// edits flow through; Fundamentals items arrive pre-checked, and any set
// can be loaded as a preset (trimmed to the cap) to start from.
function WazaPicker({ templates, dispatch, max, onWrite }) {
  const groups = useMemo(() => wazaCatalogue(templates), [templates]);
  const keyOf = (i) => `${i.position ?? ""}→${i.move}`.toLowerCase();
  const [picked, setPicked] = useState(
    () => new Set(groups.flatMap((g) => g.items.filter((i) => i.recommended).map(keyOf)).slice(0, max))
  );
  const full = picked.size >= max;

  const toggle = (i) =>
    setPicked((s) => {
      const next = new Set(s);
      const k = keyOf(i);
      if (next.has(k)) next.delete(k);
      else if (next.size < max) next.add(k);
      return next;
    });

  const loadSet = (t) =>
    setPicked(new Set(parseLines(t.lines).map((p) => `${p.position ?? ""}→${p.move}`.toLowerCase()).slice(0, max)));

  const create = () => {
    const items = groups.flatMap((g) => g.items.filter((i) => picked.has(keyOf(i))));
    const lines = items.map(toLine).join("\n");
    dispatch("createList", { name: KIND.tokui.defaultName, type: "tokui", lines });
  };

  return (
    <div className="card">
      <h3>Pick your tokui waza</h3>
      <p className="hint">
        Tap up to {max}. The starters are pre-picked — add your weapons, drop what isn't you.
      </p>
      <div className="waza-group">
        <h4>Start from a set</h4>
        <div className="chips-row">
          {templates
            .filter((t) => t.type === "tokui")
            .map((t) => (
              <button key={t.key} className="chip" onClick={() => loadSet(t)}>
                {t.name}
              </button>
            ))}
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.label} className="waza-group">
          <h4>{g.label}</h4>
          <div className="chips-row">
            {g.items.map((i) => {
              const on = picked.has(keyOf(i));
              return (
                <button
                  key={keyOf(i)}
                  className={`chip ${on ? "on" : ""}`}
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => toggle(i)}
                  title={`From: ${i.sources.join(", ")}`}
                >
                  {i.move}
                  {i.target ? <em> x{i.target}</em> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button className="primary wide" style={{ marginTop: 12 }} onClick={create} disabled={picked.size === 0}>
        Create my tokui list ({picked.size} of {max})
      </button>
      <button className="ghost wide" onClick={onWrite}>
        or write your own lines
      </button>
    </div>
  );
}

// Write the list as lines — the only way to make a kaizen list, and the
// alternative to the picker for tokui. Capped like everything else.
function NewList({ type, dispatch, max }) {
  const kind = KIND[type];
  const [name, setName] = useState(kind.defaultName);
  const [lines, setLines] = useState("");
  const n = parseLines(lines).length;

  return (
    <div className="card form">
      <h3>Write your {kind.title.toLowerCase()} list</h3>
      <label>
        List name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Up to {max} items — one per line, <code>Position =&gt; move</code>, optional <code>x50</code> target
        <textarea rows={type === "tokui" ? 6 : 3} value={lines} placeholder={kind.placeholder} onChange={(e) => setLines(e.target.value)} />
      </label>
      {n > max && (
        <p className="hint">
          That's {n} lines — the cap is {max}. Keep the ones you'll actually do.
        </p>
      )}
      <button className="primary" onClick={() => dispatch("createList", { name, type, lines })} disabled={n === 0 || n > max}>
        Create list ({n} of {max})
      </button>
    </div>
  );
}

// One slot per kind. While the slot has a list, it shows it; while it is
// empty, it offers the one way to fill it.
function Slot({ type, state, dispatch, templates }) {
  const kind = KIND[type];
  const lists = state.lists.filter((l) => l.type === type && !l.archivedAt);
  const r = room(state, type);
  const [writing, setWriting] = useState(false);

  return (
    <div className="slot">
      <h2 className="slot-title">
        {kind.title} <span className={`list-tag list-${type}`}>{r.live} of {r.max}</span>
      </h2>
      <p className="hint">{kind.blurb}</p>
      {lists.length === 0 &&
        (type === "tokui" && !writing ? (
          <WazaPicker templates={templates} dispatch={dispatch} max={r.max} onWrite={() => setWriting(true)} />
        ) : (
          <NewList type={type} dispatch={dispatch} max={r.max} />
        ))}
      {lists.map((l) => (
        <List key={l.id} list={l} state={state} dispatch={dispatch} />
      ))}
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
