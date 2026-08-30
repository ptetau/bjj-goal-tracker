// Shell concerns: the clock, the disk, and this device's identity. The only
// module allowed to touch `Date`, randomness, and localStorage — the engine
// stays pure behind it.
//
// The persisted document is sync-shaped from the start:
//   { version: 2, server: [...], pending: [...], cursor: 0, tracker }
// `server` is the prefix of the log this device has pulled from the sync
// server, in server order; `pending` is this device's own actions not yet
// acknowledged. Local truth = fold(server ++ pending). Without sync turned
// on, `server` stays empty and `pending` is simply the whole log — the
// offline app is the degenerate case of the synced one.

import { apply, initState } from "../engine/actions.js";
import { migrateV1Log } from "./migrate.js";

const KEY = "tokui/v1";
const DEV_KEY = "tokui/device";

const pad = (n) => String(n).padStart(2, "0");

// Local wall-clock, not UTC — a 9pm class in Auckland is still today.
export function nowISO() {
  const d = new Date();
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

export const todayISO = () => nowISO().slice(0, 10);

// ---------------------------------------------------------------------------
// Device identity: action ids are "<deviceId>-<counter>", so uniqueness
// across devices needs no coordination.

const randomId = () =>
  (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36))
    .replaceAll("-", "")
    .slice(0, 12);

function device() {
  try {
    const d = JSON.parse(localStorage.getItem(DEV_KEY));
    if (d && typeof d.id === "string" && Number.isInteger(d.n)) return d;
  } catch {
    // fall through to a fresh identity
  }
  return { id: randomId(), n: 0 };
}

export function newActionId() {
  const d = device();
  d.n += 1;
  try {
    localStorage.setItem(DEV_KEY, JSON.stringify(d));
  } catch {
    // Unpersisted counter risks reuse only within this unpersistable session.
  }
  return `${d.id}-${d.n}`;
}

// ---------------------------------------------------------------------------
// The document

export const emptyDoc = () => ({ version: 2, server: [], pending: [], cursor: 0, tracker: null, auth: null });

export function loadDoc() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyDoc();
    const doc = JSON.parse(raw);
    if (doc?.version === 2 && Array.isArray(doc.server) && Array.isArray(doc.pending)) return doc;
    if (doc?.version === 1 && Array.isArray(doc.log))
      return { ...emptyDoc(), pending: migrateV1Log(doc.log) };
    return emptyDoc();
  } catch {
    return emptyDoc(); // private windows and blocked storage still get an app
  }
}

export function saveDoc(doc) {
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // Storage full or blocked: the session keeps working, it just won't persist.
  }
}

// Fold the document into app state. The server prefix is authoritative and
// expected to replay cleanly (a corrupt entry abandons the tail rather than
// the app). Pending actions that no longer apply — usually because another
// device's synced actions removed what they referenced — are dropped, and
// the cleaned document is reported back so the caller can persist it.
export function foldDoc(doc) {
  let state = initState();
  for (const action of doc.server) {
    try {
      state = apply(state, action);
    } catch {
      break;
    }
  }
  const kept = [];
  for (const action of doc.pending) {
    try {
      state = apply(state, action);
      kept.push(action);
    } catch {
      // dropped: superseded by server truth
    }
  }
  return {
    state,
    doc: kept.length === doc.pending.length ? doc : { ...doc, pending: kept },
  };
}
