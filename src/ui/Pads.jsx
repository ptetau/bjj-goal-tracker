// Training mode. While a session is rolling the whole screen is a drum
// machine: one fat pad per live item, two banks you swipe between (A for
// tokui, B for kaizen — the growth list; an empty bank says how to fill
// it), a display that echoes the last tap, and
// one UNDO that takes back whatever the last tap was. A pad tap records a
// hit; latch the TRY key and pad taps record attempts until you unlatch it
// (the pads warm up and count attempts while it is latched).
// Built for wrecked hands between rolls: nothing here needs precision, and
// every mistake is one UNDO away.

import React, { useRef, useState } from "react";
import { liveBanks, tallies } from "../engine/actions.js";
import { itemTitle } from "../engine/parse.js";
import { buzz } from "../app/haptics.js";

const BANK_LABEL = { tokui: "Tokui", growth: "Kaizen" };
const BANK_EMPTY = {
  tokui: "No tokui waza yet. Your special techniques — the few things you hit every session.",
  growth: "Nothing in kaizen yet. Up to three things you're exploring.",
};

export default function Pads({ state, live, dispatch, onEnd, onExit, syncDot, error, clearError }) {
  const [mode, setMode] = useState("hit"); // what a pad tap records
  const [lit, setLit] = useState(null); // { itemId, kind, tick } retriggers the flash
  const [bank, setBank] = useState(0);
  const scroller = useRef(null);

  const banks = liveBanks(state);
  const counts = tallies(live);
  const lastTap = live.taps[live.taps.length - 1] || null;
  const lastItem = lastTap ? state.lists.flatMap((l) => l.items).find((it) => it.id === lastTap.itemId) : null;
  const lastLabel = lastTap && lastItem ? `${lastTap.kind.toUpperCase()} · ${itemTitle(lastItem)}` : null;

  const tap = (itemId) => {
    if (dispatch("tap", { sessionId: live.id, itemId, kind: mode })) {
      buzz(mode === "hit" ? [16, 30, 16] : 16);
      setLit({ itemId, kind: mode, tick: Date.now() });
    }
  };

  const undo = () => {
    if (dispatch("undoTap", { sessionId: live.id })) buzz([10, 20, 10]);
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
    <section className={`deck mode-${mode}`} aria-label="Training mode">
      <header className="deck-top">
        <div className="deck-brand">
          TOKUI <span>得意</span>
          <i className={`led led-${syncDot}`} aria-label={`sync ${syncDot}`} />
        </div>
        <button className="key key-menu" onClick={onExit}>
          MENU
        </button>
      </header>

      <div className="lcd" aria-live="polite">
        <div className="lcd-row">
          <span>MODE {mode.toUpperCase()}</span>
          <span>TAPS {String(live.taps.length).padStart(3, "0")}</span>
        </div>
        <div className="lcd-row lcd-last">{lastLabel ? `LAST · ${lastLabel}` : "READY"}</div>
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
                <small>The session keeps rolling while you do.</small>
              </div>
            )}
            {b.items.map((item) => {
              const c = counts.get(item.id) || { hits: 0, tries: 0 };
              const big = mode === "hit" ? c.hits : c.tries; // the count this mode is adding to
              const flashing = lit && lit.itemId === item.id;
              const isLast = lastTap && lastTap.itemId === item.id;
              return (
                <button
                  key={flashing ? `${item.id}:${lit.tick}` : item.id}
                  className={`pad ${flashing ? `lit lit-${lit.kind}` : ""} ${isLast ? `last last-${lastTap.kind}` : ""}`}
                  onClick={() => tap(item.id)}
                  aria-label={`${mode === "hit" ? "Hit" : "Attempted"} ${itemTitle(item)}`}
                >
                  <i className="led" aria-hidden="true" />
                  <b className={`pad-count ${big === 0 ? "zero" : ""}`} aria-hidden="true">
                    {big}
                  </b>
                  <span className="pad-name">
                    {item.position && <small>{item.position}</small>}
                    {item.move}
                  </span>
                  <span className="pad-tally">
                    {c.hits} hit · {c.tries} try
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <footer className="transport">
        <button
          className={`key key-try ${mode === "try" ? "on" : ""}`}
          aria-pressed={mode === "try"}
          onClick={() => setMode(mode === "hit" ? "try" : "hit")}
        >
          <i className="led" aria-hidden="true" />
          TRY
        </button>
        <button className="key key-undo" disabled={live.taps.length === 0} onClick={undo}>
          UNDO
          <small>{lastLabel || "nothing yet"}</small>
        </button>
        <button className="key key-end" onClick={onEnd}>
          END
        </button>
      </footer>
    </section>
  );
}
