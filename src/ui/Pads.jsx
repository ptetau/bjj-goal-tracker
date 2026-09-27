// Training mode — the Roll tab itself. The whole screen is a drum machine:
// one fat pad per live item, split on the diagonal (top-left HIT, bottom-
// right TRY, each with its own count), two banks you swipe between (A for
// tokui, B for kaizen — the growth list; an empty bank says how to fill
// it), a display that shows the day and echoes the last tap, and one UNDO
// that takes back whatever the last tap was. Nothing is rolling until the
// first tap, which starts the session; the calendar key arms an earlier
// day for a session logged after the fact, and the deck changes colour so
// you can't mistake it for today. Built for wrecked hands between rolls:
// nothing here needs precision, and every mistake is one UNDO away.

import React, { useRef, useState } from "react";
import { liveBanks, openSession, tallies } from "../engine/actions.js";
import { itemTitle } from "../engine/parse.js";
import { buzz } from "../app/haptics.js";

const BANK_LABEL = { tokui: "Tokui", growth: "Kaizen" };
const BANK_EMPTY = {
  tokui: "No tokui waza yet. Your special techniques — the few things you hit every session.",
  growth: "Nothing in kaizen yet. Up to three things you're exploring.",
};
const dayLabel = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export default function Pads({ state, live, today, dispatch, onEnd, onExit, syncDot, error, clearError }) {
  const [lit, setLit] = useState(null); // { itemId, kind, tick } retriggers the flash
  const [bank, setBank] = useState(0);
  const [pastDate, setPastDate] = useState(null); // the day the next session is for, when not today
  const scroller = useRef(null);

  const banks = liveBanks(state);
  const taps = live ? live.taps : [];
  const counts = live ? tallies(live) : new Map();
  const lastTap = taps[taps.length - 1] || null;
  const lastItem = lastTap ? state.lists.flatMap((l) => l.items).find((it) => it.id === lastTap.itemId) : null;
  const lastLabel = lastTap && lastItem ? `${lastTap.kind.toUpperCase()} · ${itemTitle(lastItem)}` : null;
  const day = live ? live.date : pastDate || today;
  const past = day !== today;

  // The first tap starts the session — on the armed day if there is one.
  const tap = (itemId, kind) => {
    let s = state;
    if (!live) {
      s = dispatch("startSession", pastDate ? { date: pastDate } : {});
      if (!s) return;
    }
    if (dispatch("tap", { sessionId: openSession(s).id, itemId, kind })) {
      buzz(kind === "hit" ? [16, 30, 16] : 16);
      setLit({ itemId, kind, tick: Date.now() });
    }
  };

  const undo = () => {
    if (live && dispatch("undoTap", { sessionId: live.id })) buzz([10, 20, 10]);
  };

  const pickDay = (e) => {
    const d = e.target.value;
    setPastDate(d && d < today ? d : null);
  };

  const goBank = (i) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== bank) setBank(i);
  };

  return (
    <section className={`deck ${past ? "past" : ""}`} aria-label="Training mode">
      <header className="deck-top">
        <div className="deck-brand">
          TOKUI <span>得意</span>
          <i className={`led led-${syncDot}`} aria-label={`sync ${syncDot}`} />
        </div>
        <div className="deck-keys">
          <label className={`key key-cal ${past ? "on" : ""} ${live ? "off" : ""}`} aria-label="Session day" title={live ? "The day is set while a session is rolling" : "Log a session for an earlier day"}>
            <span aria-hidden="true">📅</span>
            <input type="date" value={pastDate || today} max={today} disabled={!!live} onChange={pickDay} />
          </label>
          <button className="key key-menu" onClick={onExit}>
            MENU
          </button>
        </div>
      </header>

      <div className="lcd" aria-live="polite">
        <div className="lcd-row">
          <span className="lcd-day">{past ? `PAST · ${dayLabel(day)}` : `TODAY · ${dayLabel(day)}`}</span>
          <span>TAPS {String(taps.length).padStart(3, "0")}</span>
        </div>
        <div className="lcd-row lcd-last">{lastLabel ? `LAST · ${lastLabel}` : live ? "ROLLING" : past ? "TAP A PAD TO LOG THIS DAY" : "TAP A PAD TO START"}</div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
          <button className="ghost" onClick={clearError} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <div className="bank-keys" role="tablist" aria-label="Banks">
        {banks.map((b, i) => (
          <button
            key={b.type}
            role="tab"
            aria-selected={bank === i}
            className={`key bank-key bank-${b.type} ${bank === i ? "on" : ""}`}
            onClick={() => goBank(i)}
          >
            <i className="led" aria-hidden="true" />
            {String.fromCharCode(65 + i)} · {BANK_LABEL[b.type].toUpperCase()}
          </button>
        ))}
      </div>

      <div className="banks" ref={scroller} onScroll={onScroll}>
        {banks.map((b) => (
          <div key={b.type} className={`bank bank-${b.type}`} aria-label={`${BANK_LABEL[b.type]} pads`}>
            {b.items.length === 0 && (
              <div className="bank-empty">
                <p>{BANK_EMPTY[b.type]}</p>
                <button className="key" onClick={onExit}>
                  ADD IN MISSIONS
                </button>
                {live && <small>The session keeps rolling while you do.</small>}
              </div>
            )}
            {b.items.map((item) => {
              const c = counts.get(item.id) || { hits: 0, tries: 0 };
              const flashing = lit && lit.itemId === item.id;
              const isLast = lastTap && lastTap.itemId === item.id;
              return (
                <div
                  key={flashing ? `${item.id}:${lit.tick}` : item.id}
                  className={`pad ${flashing ? `lit lit-${lit.kind}` : ""} ${isLast ? `last last-${lastTap.kind}` : ""}`}
                >
                  <i className="led" aria-hidden="true" />
                  <button className="zone zone-hit" onClick={() => tap(item.id, "hit")} aria-label={`Hit ${itemTitle(item)}`}>
                    <small>HIT</small>
                    <b className={`pad-count ${c.hits === 0 ? "zero" : ""}`}>{c.hits}</b>
                  </button>
                  <button className="zone zone-try" onClick={() => tap(item.id, "try")} aria-label={`Attempted ${itemTitle(item)}`}>
                    <small>TRY</small>
                    <b className={`pad-count ${c.tries === 0 ? "zero" : ""}`}>{c.tries}</b>
                  </button>
                  <span className="pad-name">
                    {item.position && <small>{item.position}</small>}
                    {item.move}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <footer className="transport">
        <button className="key key-undo" disabled={taps.length === 0} onClick={undo}>
          UNDO
          <small>{lastLabel || "nothing yet"}</small>
        </button>
        <button className="key key-end" disabled={!live} onClick={onEnd}>
          END
        </button>
      </footer>
    </section>
  );
}
