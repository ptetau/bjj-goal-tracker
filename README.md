# TOKUI 得意

Mission lists for the mat. A coach or student writes a list of *tokui waza* —
the techniques to hit every rolling session — and the app makes tallying them
possible with gassed hands between rolls: two fat zones per item (**TRY** /
**HIT**, a hit implies the attempt), one giant **UNDO**, a buzz and a flash on
every count.

An installable PWA that works with no signal and keeps everything on the
device — plus **device sync** (milestone 2.1): turn sync on, carry the code
to your other device, and phone + laptop converge on one training log.
Accounts and the coach layer come next (see [docs/SPEC.md](docs/SPEC.md)).

### Mission lists

Two kinds, one model:

- **tokui** — the exploit list: weapons you hit every session to stay sharp.
- **growth** — the explore list: what you're adding. Going for it is the win,
  so its sharpness leads with attempt-consistency instead of hits.

Lists are authored as text, one item per line. The parser structures what it
can and keeps the rest verbatim — nothing is ever rejected:

```
Bottom => top
Back => strangle | arm bar
Top => pinning: tight weight and balance
Leg => inside heel x25          ← optional cumulative target
```

Items **retire** rather than delete (history stays), renames keep identity,
and a met target celebrates and asks — next lap, or retirement. Nothing
resets silently.

### Rolling

**START ROLLING** turns the screen into the merged tally board for every
active list. After **END** (or from any calendar day) the session opens for
corrections — ± steppers per item — and notes. Past sessions can be logged
manually; sessions are freeform, several per day if you trained twice.

### Reading the results

- **Grid** — the sharpness grid: items × the last 21 days' sessions, cells
  showing hits and tries, each row's hit- and try-consistency computable in
  your head from the cells. Calendar-honest: three weeks off the mat reads
  as going cold, because it is.
- **Missions** — target progress bars with lap counters.
- **Calendar** — a month of intensity dots; tap a day for its sessions and
  notes. Streaks run Mon–Sun and the week in progress can't break one.

## Architecture

A functional core with thin shells, after the pattern of
[OVERTYPE](https://github.com/ptetau/overtype) — but the core is shaped as an
**action log**:

```
src/engine/   pure rules — no IO, no Math.random, no Date. Every mutation is
              a named action {id, type, payload, at} folded through apply();
              entities derive their ids from the action's device-unique id.
src/app/      the client shell: clock, device identity, the persisted
              document (server log prefix + pending queue), the sync driver.
src/ui/       React components + one stylesheet.
api/          shell #1: the sync referee as a Vercel function (Postgres).
server/       shell #2: the same referee as a long-lived node server,
              serving the built app (PGlite fallback without DATABASE_URL).
public/       PWA: manifest, service worker (offline app shell), icons.
```

The log IS the sync protocol: clients queue actions offline; the referee
authenticates the tracker, replays incoming actions through the same engine,
sequences the valid ones into an append-only Postgres log, and returns
everything after the client's cursor. Devices converge because ids can't
collide (they derive from per-device action ids) and tally actions commute.
Local truth is always `fold(serverPrefix ++ pending)` — the offline app is
just the degenerate case with an empty server prefix.

## Running it

```
npm install
npm run dev       # Vite dev server (no sync endpoint)
npm test          # engine + referee tests: examples, fast-check properties,
                  #   and the referee against in-process Postgres (PGlite)
npm run start     # build + serve app AND sync locally (PGlite, ./.data)
npm run build     # static PWA in dist/
npm run db:migrate  # apply server/schema.sql to DATABASE_URL
```

Deploying to Vercel: the static app plus `api/sync.js` deploy together;
set `DATABASE_URL` (a pooled Postgres connection string — Neon/Vercel
Postgres) in the project's environment variables. Without it the app still
works, just without sync.
