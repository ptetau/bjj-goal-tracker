// After-class corrections: fix miscounts with ± steppers, write the note.
// Opens right after END, and from any session on the calendar. Every change
// dispatches immediately — closing is just closing.

import React from "react";
import { getSession, tallies, TAP_KINDS } from "../engine/actions.js";
import { itemTitle } from "../engine/parse.js";

export default function SessionEditor({ state, dispatch, sessionId, onClose }) {
  let session;
  try {
    session = getSession(state, sessionId);
  } catch {
    onClose(); // deleted underneath the overlay
    return null;
  }
  const counts = tallies(session);
  // Retired items with taps in this session stay editable — the history is theirs.
  const lists = state.lists
    .map((l) => ({
      ...l,
      items: l.items.filter((it) => !it.retiredAt || counts.has(it.id)),
    }))
    .filter((l) => (!l.archivedAt || l.items.some((it) => counts.has(it.id))) && l.items.length > 0);

  const adjust = (itemId, kind, delta) =>
    dispatch("adjustTap", { sessionId, itemId, kind, delta });

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={`Session on ${session.date}`}>
      <div className="sheet">
        <div className="sheet-head">
          <h2>{session.date}</h2>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>

        {lists.map((l) => (
          <div key={l.id} className="edit-list">
            <h3 className={`list-tag list-${l.type}`}>{l.name}</h3>
            {l.items.map((item) => {
              const c = counts.get(item.id) || { tries: 0, hits: 0 };
              return (
                <div key={item.id} className="edit-row">
                  <span className="edit-title">{itemTitle(item)}</span>
                  {TAP_KINDS.map((kind) => (
                    <span key={kind} className={`stepper stepper-${kind}`}>
                      <button
                        aria-label={`One less ${kind} of ${itemTitle(item)}`}
                        disabled={c[kind === "hit" ? "hits" : "tries"] === 0}
                        onClick={() => adjust(item.id, kind, -1)}
                      >
                        −
                      </button>
                      <b>
                        {c[kind === "hit" ? "hits" : "tries"]} {kind}
                      </b>
                      <button
                        aria-label={`One more ${kind} of ${itemTitle(item)}`}
                        onClick={() => adjust(item.id, kind, 1)}
                      >
                        +
                      </button>
                    </span>
                  ))}
                </div>
              );
            })}
          </div>
        ))}

        <label className="note-label">
          Session notes
          {/* Committed on blur, not per keystroke — one log action per edit,
              and clicking Done blurs first so nothing is lost. */}
          <textarea
            rows={4}
            defaultValue={session.note}
            placeholder="What worked, what got you, what to ask coach…"
            onBlur={(e) => {
              if (e.target.value !== session.note)
                dispatch("setNote", { sessionId, note: e.target.value });
            }}
          />
        </label>
      </div>
    </div>
  );
}
