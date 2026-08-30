// Account & sync. The normal path: enter your email (plus the gym
// passphrase the first time), tap the emailed link, and this device is
// signed in and syncing on your account's log — the link on a second
// device joins it to the same log. The hand-carried sync code survives
// underneath as the advanced path.

import React, { useState } from "react";
import { createTracker, parseSyncCode, requestLogin, syncCode } from "../app/sync.js";

export default function SyncSheet({ doc, syncInfo, setTracker, runSync, onClose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);
  const [email, setEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [code, setCode] = useState("");

  const sendLink = async () => {
    setBusy(true);
    setErr(null);
    setNote(null);
    try {
      const r = await requestLogin(email, passphrase);
      setNote(r.sent ? "Link sent — check your email and tap it on this device." : r.reason);
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  const signOut = () => {
    if (window.confirm("Sign out? This device keeps its data, but stops syncing."))
      setTracker(null, { rebase: true });
  };

  const turnOnCode = async () => {
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

  const linkCode = () => {
    const t = parseSyncCode(code);
    if (!t) return setErr("That doesn't look like a sync code (trackerId.secret).");
    setErr(null);
    setTracker(t, { rebase: true });
  };

  const status = doc.tracker ? (
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
  ) : null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Account and sync">
      <div className="sheet">
        <div className="sheet-head">
          <h2>Account</h2>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>

        {doc.auth ? (
          <>
            <p>
              Signed in as <strong>{doc.auth.email}</strong>
              {doc.auth.isCoach && <span className="list-tag list-tokui" style={{ marginLeft: 8 }}>coach</span>}
            </p>
            {status}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="primary" onClick={runSync} disabled={busy}>
                Sync now
              </button>
              <button className="ghost danger" onClick={signOut}>
                Sign out
              </button>
            </div>
            <p className="hint">Sign in with the same email on your other device and it joins this log.</p>
          </>
        ) : (
          <>
            <p className="hint">
              Sign in and your phone and laptop share one training log — taps land offline and sync
              when there's signal.
            </p>
            <label className="note-label">
              Email
              <input type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="note-label">
              Gym passphrase <small>(first sign-in only)</small>
              <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
            </label>
            <button className="primary wide" style={{ marginTop: 10 }} onClick={sendLink} disabled={busy || !email.trim()}>
              {busy ? "…" : "Email me a login link"}
            </button>
            {doc.tracker && status}

            <button className="ghost tiny" style={{ marginTop: 12 }} onClick={() => setAdvanced((v) => !v)}>
              {advanced ? "hide" : "advanced:"} sync codes
            </button>
            {advanced && (
              <>
                {doc.tracker ? (
                  <label className="note-label">
                    This device's sync code
                    <input readOnly value={syncCode(doc.tracker)} onFocus={(e) => e.target.select()} />
                  </label>
                ) : (
                  <button className="ghost wide" style={{ marginTop: 8 }} onClick={turnOnCode} disabled={busy}>
                    Turn on sync with a new code
                  </button>
                )}
                <label className="note-label">
                  Link this device with a code
                  <input value={code} placeholder="trackerId.secret" onChange={(e) => setCode(e.target.value)} />
                </label>
                <button className="ghost wide" style={{ marginTop: 8 }} onClick={linkCode} disabled={!code.trim()}>
                  Link device
                </button>
              </>
            )}
          </>
        )}
        {note && <p className="hint" style={{ marginTop: 10 }}>{note}</p>}
        {err && <p className="sync-err">{err}</p>}
      </div>
    </div>
  );
}
