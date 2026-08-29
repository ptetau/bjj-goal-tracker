// The sync driver: pushes this device's pending actions and pulls everyone
// else's, against the referee at /api/sync. Transport-injected (`fetchFn`)
// so tests drive it against an in-process server.
//
// Protocol (one endpoint, the action log IS the payload):
//   {op:"create"}                                  -> { trackerId, secret }
//   {op:"sync", trackerId, secret, cursor, actions} -> { actions, cursor, rejected }
// The response's `actions` are everything after `cursor` in server order —
// including this device's own, now sequenced — so appending them to the
// server prefix and clearing acked/rejected ids from pending converges every
// device on the same log.

export async function createTracker(fetchFn = fetch) {
  const res = await call(fetchFn, { op: "create" });
  return { id: res.trackerId, secret: res.secret };
}

// Returns the updated doc, or null when sync isn't on / the server is
// unreachable (callers treat null as "try again later").
export async function syncDoc(doc, fetchFn = fetch) {
  if (!doc.tracker) return null;
  let res;
  try {
    res = await call(fetchFn, {
      op: "sync",
      trackerId: doc.tracker.id,
      secret: doc.tracker.secret,
      cursor: doc.cursor,
      actions: doc.pending,
    });
  } catch {
    return null; // offline or server down — pending stays queued
  }
  const seen = new Set([...res.actions.map((a) => a.id), ...(res.rejected || [])]);
  return {
    ...doc,
    server: [...doc.server, ...res.actions],
    pending: doc.pending.filter((a) => !seen.has(a.id)),
    cursor: res.cursor,
  };
}

// The sync code a person carries between devices: "trackerId.secret".
export const syncCode = (tracker) => `${tracker.id}.${tracker.secret}`;
export function parseSyncCode(code) {
  const m = String(code).trim().match(/^([A-Za-z0-9]+)\.([A-Za-z0-9_-]+)$/);
  return m ? { id: m[1], secret: m[2] } : null;
}

async function call(fetchFn, body) {
  const res = await fetchFn("/api/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return res.json();
}
