// One-time migration of v1 logs (numeric counter ids, no action ids) into
// the v2 world where actions carry ids and entities derive theirs from
// them. The v1 engine assigned ids from state.nextId in a fixed order —
// createList: k parsed items then the list; addLines: k items;
// start/createSession: one id — so the old assignments can be replayed
// exactly and every payload reference rewritten onto the new derived ids.

import { parseLines } from "../engine/parse.js";

const REF_KEYS = ["listId", "itemId", "sessionId"];

export function migrateV1Log(log) {
  if (log.every((a) => typeof a.id === "string" && a.id)) return log; // already v2

  const map = new Map(); // old numeric id -> new derived id
  let counter = 1; // v1 initState started nextId at 1
  const remap = (payload) => {
    const out = { ...payload };
    for (const k of REF_KEYS) if (k in out && map.has(out[k])) out[k] = map.get(out[k]);
    return out;
  };

  return log.map((action, i) => {
    const id = `v1-${i + 1}`;
    const payload = remap(action.payload || {});
    const k = () => parseLines(action.payload?.lines || "").length;

    if (action.type === "createList") {
      const n = k();
      for (let j = 0; j < n; j++) map.set(counter++, `${id}.${j + 1}`);
      map.set(counter++, id); // the list came after its items
    } else if (action.type === "addLines") {
      const n = k();
      for (let j = 0; j < n; j++) map.set(counter++, `${id}.${j + 1}`);
    } else if (action.type === "startSession" || action.type === "createSession") {
      map.set(counter++, id);
    }

    return { id, type: action.type, payload, at: action.at };
  });
}
