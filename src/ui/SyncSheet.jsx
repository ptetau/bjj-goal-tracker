// Device sync, pre-auth: a tracker is a shared action log on the server,
// and the sync code ("trackerId.secret") is what you carry to a second
// device. Accounts (milestone 2.2) will absorb this — the code is the
// stopgap that makes phone + laptop one tracker today.

import React, { useState } from "react";
import { createTracker, parseSyncCode, syncCode } from "../app/sync.js";

export default function SyncSheet({ doc, syncInfo, setTracker, runSync, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [code, setCode] = useState("");

  const turnOn = async () => {
    setBusy(true);
    setErr(null);
    try {
      const t = await createTracker();
      setTracker(t, { rebase: true });
    } catch {
      setErr("Sync server unreachable — are you on the deployed app?");
    }
    setBusy(false);
  };

  const link = () => {
    const t = parseSyncCode(code);
    if (!t) return setErr("That doesn't look like a sync code (trackerId.secret).");
    setErr(null);
    setTracker(t, { rebase: true });
  };

  const unlink = () => {
    if (window.confirm("Turn off sync? This device keeps its data, but stops sharing."))
      setTracker(null, { rebase: true });
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Sync">
      <div className="sheet">
        <div className="sheet-head">
          <h2>Sync</h2>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>

        {doc.tracker ? (
          <>
            <p>
              Status:{" "}
              <strong>
                {syncInfo.status === "offline"
                  ? "unreachable — changes queued"
                  : doc.pending.length
                  ? `${doc.pending.length} change${doc.pending.length === 1 ? "" : "s"} queued`
                  : "everything synced"}
              </strong>
              {syncInfo.at && <span className="hint"> · last sync {syncInfo.at.slice(11, 16)}</span>}
            </p>
            <label className="note-label">
              Sync code — enter it on your other device to share this tracker
              <input readOnly value={syncCode(doc.tracker)} onFocus={(e) => e.target.select()} />
            </label>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="primary" onClick={runSync} disabled={busy}>
                Sync now
              </button>
              <button className="ghost danger" onClick={unlink}>
                Turn off
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="hint">
              Sync keeps your phone and laptop on one training log. Everything stays usable offline —
              taps queue and flush when there's signal.
            </p>
            <button className="primary wide" onClick={turnOn} disabled={busy}>
              {busy ? "…" : "Turn on sync (new code)"}
            </button>
            <label className="note-label">
              Or link this device with a code from another one
              <input
                value={code}
                placeholder="trackerId.secret"
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button className="ghost wide" style={{ marginTop: 8 }} onClick={link} disabled={!code.trim()}>
              Link device
            </button>
          </>
        )}
        {err && <p className="sync-err">{err}</p>}
      </div>
    </div>
  );
}
