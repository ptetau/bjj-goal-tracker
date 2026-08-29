# TOKUI 得意

Mission lists for the mat. A coach or student writes a list of *tokui waza* —
the techniques to hit every rolling session — and the app makes tallying them
possible with gassed hands between rolls: two fat zones per item (**TRY** /
**HIT**, a hit implies the attempt), one giant **UNDO**, a buzz and a flash on
every count.

This is **milestone 1: the offline core**, an installable PWA that works with
no signal and keeps everything on the device. Milestone 2 adds the single-gym
server behind it (see [docs/SPEC.md](docs/SPEC.md)).

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

A functional core with one thin shell, after the pattern of
[OVERTYPE](https://github.com/ptetau/overtype) — but the core is shaped as an
**action log**:

```
src/engine/   pure rules — no IO, no Math.random, no Date. Every mutation is
              a named action {type, payload, at} folded through apply().
src/app/      the shell: the clock (nowISO) and the disk (the log persists
              to localStorage and replays on load).
src/ui/       React components + one stylesheet.
public/       PWA: manifest, service worker (offline app shell), icons.
```

The log is the point: in milestone 2, clients queue these same actions
offline and a serverless referee replays them through this exact engine into
Postgres — persistence and sync are the same shape. Two phones tallying the
same account merge for free, because tally actions commute.

## Running it

```
npm install
npm run dev       # Vite dev server
npm test          # engine tests (vitest)
npm run build     # static PWA in dist/
```

Deploys anywhere that serves static files; `vercel.json` is included.
