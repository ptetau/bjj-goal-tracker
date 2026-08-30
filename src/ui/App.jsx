import React, { useEffect, useMemo, useRef, useState } from "react";
import { apply, openSession } from "../engine/actions.js";
import { foldDoc, loadDoc, newActionId, nowISO, saveDoc } from "../app/store.js";
import { redeemLogin, syncDoc } from "../app/sync.js";
import Missions from "./Missions.jsx";
import Roll from "./Roll.jsx";
import Grid from "./Grid.jsx";
import Calendar from "./Calendar.jsx";
import SessionEditor from "./SessionEditor.jsx";
import SyncSheet from "./SyncSheet.jsx";

const TABS = [
  { id: "roll", label: "Roll" },
  { id: "missions", label: "Missions" },
  { id: "grid", label: "Grid" },
  { id: "calendar", label: "Calendar" },
];

export default function App() {
  const initial = useMemo(() => foldDoc(loadDoc()), []);
  const [doc, setDoc] = useState(initial.doc);
  const [state, setState] = useState(initial.state);
  const [tab, setTab] = useState(() =>
    openSession(initial.state) || initial.state.lists.length ? "roll" : "missions"
  );
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // session id under the editor overlay
  const [showSync, setShowSync] = useState(false);
  const [syncInfo, setSyncInfo] = useState({ status: "idle" });

  const docRef = useRef(doc);
  docRef.current = doc;
  const inFlight = useRef(false);

  const commit = (nextDoc, nextState) => {
    setDoc(nextDoc);
    saveDoc(nextDoc);
    if (nextState) setState(nextState);
  };

  // Dispatch stamps the action (device-unique id + local time), folds it
  // through the pure engine, and queues it for sync.
  const dispatch = (type, payload) => {
    const action = { id: newActionId(), type, payload, at: nowISO() };
    try {
      const next = apply(state, action);
      commit({ ...docRef.current, pending: [...docRef.current.pending, action] }, next);
      setError(null);
      return next;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  // Push pending, pull the rest of the log, refold. Actions dispatched while
  // a sync is in flight are re-attached before folding, so nothing is lost.
  const runSync = async () => {
    const base = docRef.current;
    if (inFlight.current || !base.tracker) return;
    inFlight.current = true;
    setSyncInfo({ status: "syncing" });
    const merged = await syncDoc(base);
    inFlight.current = false;
    if (!merged) {
      setSyncInfo({ status: "offline" });
      return;
    }
    const inBase = new Set(base.pending.map((a) => a.id));
    const addedMeanwhile = docRef.current.pending.filter((a) => !inBase.has(a.id));
    const { state: nextState, doc: nextDoc } = foldDoc({
      ...merged,
      pending: [...merged.pending, ...addedMeanwhile],
    });
    commit(nextDoc, nextState);
    setSyncInfo({ status: "ok", at: nowISO() });
    if (nextDoc.pending.length > 0) setTimeout(runSync, 500); // flush what arrived mid-flight
  };

  useEffect(() => {
    // Arriving via a magic link (?login=TOKEN) signs this device in and
    // binds it to the account's tracker; the token leaves the URL either way.
    const token = new URLSearchParams(window.location.search).get("login");
    if (token) {
      window.history.replaceState(null, "", window.location.pathname);
      redeemLogin(token)
        .then((r) => {
          setTracker({ id: r.tracker.id, secret: r.tracker.secret }, { rebase: true, auth: { session: r.session, ...r.user } });
          setShowSync(true); // show who you are and that sync is running
        })
        .catch((e) => setError(`Sign-in failed: ${e.message}`));
    }
    runSync();
    const onVisible = () => document.visibilityState === "visible" && runSync();
    window.addEventListener("online", runSync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", runSync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced push after activity — matside taps sync themselves in the gaps.
  useEffect(() => {
    if (!doc.tracker || doc.pending.length === 0) return;
    const t = setTimeout(runSync, 1500);
    return () => clearTimeout(t);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps

  const setTracker = (tracker, { rebase, auth = null } = {}) => {
    // Linking to another tracker rebases this device's whole history as
    // pending, so its data merges into the shared log on the next sync.
    const base = docRef.current;
    const next = rebase
      ? { ...base, tracker, auth, server: [], cursor: 0, pending: [...base.server, ...base.pending] }
      : { ...base, tracker, auth };
    commit(next);
    setTimeout(runSync, 0);
  };

  const dot =
    !doc.tracker ? "off" : syncInfo.status === "offline" ? "bad" : doc.pending.length ? "busy" : "ok";

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          TOKUI <span>得意</span>
          <button className={`sync-chip sync-${dot}`} onClick={() => setShowSync(true)} aria-label="Sync status">
            ⇅{doc.pending.length > 0 && doc.tracker ? ` ${doc.pending.length}` : ""}
          </button>
        </h1>
        <nav role="tablist" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "tab active" : "tab"}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === "roll" && openSession(state) && <span className="live-dot" aria-label="session in progress" />}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
          <button className="ghost" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <main>
        {tab === "roll" && <Roll state={state} dispatch={dispatch} live={openSession(state)} setEditing={setEditing} />}
        {tab === "missions" && <Missions state={state} dispatch={dispatch} />}
        {tab === "grid" && <Grid state={state} />}
        {tab === "calendar" && <Calendar state={state} dispatch={dispatch} setEditing={setEditing} />}
      </main>

      {editing !== null && (
        <SessionEditor state={state} dispatch={dispatch} sessionId={editing} onClose={() => setEditing(null)} />
      )}
      {showSync && (
        <SyncSheet
          doc={doc}
          syncInfo={syncInfo}
          setTracker={setTracker}
          runSync={runSync}
          onClose={() => setShowSync(false)}
        />
      )}
    </div>
  );
}
