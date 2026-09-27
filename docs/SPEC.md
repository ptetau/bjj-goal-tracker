# TOKUI — product & technical spec

The record of the decisions behind the app, as clarified with its owner.
Milestone 1 (this repo's current state) implements the offline core; the
rest is the committed direction, not speculation.

## What it is

A single gym's mission tracker. A coach or student writes **mission lists**
of jiu-jitsu items; students tally **attempts and hits** per item during
rolling sessions, with notes; sharpness and progress are visualized for
student and coach both.

## Decisions

### Product

| Question | Decision |
| --- | --- |
| Audience | One gym per deployment. Coaches see all students; students see their own data plus lists shared with them. |
| List kinds | **tokui** (exploit — stay sharp) and **growth** (explore, shown as "Kaizen") as one model; any item may carry a cumulative target (`x50`). |
| One short list each | You keep **one tokui list of at most 7 live items** — a submission, a guard, a sweep, a takedown, maybe one to three more — and **one kaizen list of at most 3**: more than that and you're working on nothing. The Missions tab has one slot per kind; a slot offers a way to make a list only while empty, and Add / restore go dark when the list is full. The cap is an engine query (`room`), honoured by the screens, not a rule the log enforces — a history that outgrew the cap still replays and simply shows "9 of 7". |
| Item shape | Semi-structured: `Position => move` parses for grouping/UX, but any line is accepted verbatim. Colons don't split; arrows do. |
| Authoring | Text-first: type or paste lines, the parser does the rest. |
| Capture | Live tally is primary; sessions stay editable after (± steppers, notes). Manual past sessions allowed. Sessions are freeform — several per day. |
| Tap semantics | Two zones per item: **TRY** (attempted, no finish) and **HIT** (finished — implies the attempt). Rate = hits ÷ (tries + hits). |
| Ergonomics | Giant undo-last-tap with label; haptic (Android) + visual flash on every count; live mode never demands re-auth. No wake lock. |
| Empty screens point at Missions | ✅ The Roll tab is the deck itself, and an empty bank on it carries an ADD IN MISSIONS key. The Grid tab always draws both grids — Tokui waza and Kaizen, the deck's two banks — with a key above them (hits and tries in a cell, tried-no-hit, not attempted, the sharp-to-cold lead column); an empty bank is one row saying so, an empty window is a grid with no session columns. |
| Training mode | ✅ **The Roll tab is the deck**: no START key, the pads are just there, and the first tap starts the session. Styled as a drum machine: one fat pad per live item, **split on the diagonal — top-left is HIT, bottom-right is TRY** — each half with its own count, so there is no mode to latch; two banks you swipe between or pick with A/B keys — A is the tokui list, B ("Kaizen") the growth list; both are always there, and an empty one says what it's for and sends you to Missions to fill it — a display showing the day and echoing the last tap, and one UNDO for whatever the last tap was. **A calendar key** (📅) picks an earlier day for a session logged after the fact: the next tap starts the session on that day (`startSession {date}`, never a later day than now), and the whole deck changes colour to a slate-blue chassis with a PAST banner in the display so you can't mistake it for today; the key is off while a session is rolling. MENU leaves the pads with the session still rolling; END closes it and opens the editor, and is off when nothing is rolling. No masthead, no tabs, nothing that needs precision. |
| Sharpness | Consistency over a **21-day calendar window**, every session equal weight — legible over smooth. Cells show hits *and* tries; tokui rows lead with hit-consistency, growth rows with try-consistency. Empty window shows "no data", not 0%. |
| Targets | Met target → celebrate → explicit choice: next lap or retire. Laps count on (lap 2 of x50 = hits 51–100). Changing a target resets laps. |
| Lifecycle | Items/lists retire or archive, never silently delete; renames keep ids so history follows the item. Sessions can be deleted. |
| Timeline | Calendar-first: month grid with intensity dots, day drill-down, Mon–Sun streaks with an in-progress-week grace. |
| Roles (M2) | Students share a list to a coach or training partner as read/comment/edit. Coaches assign lists; students accept and can archive. Comments attach to **lists and items** (not sessions). |
| Onboarding (M2) | Signup gated by a gym passphrase; coach role via an email allowlist (env/config). |
| The ladder | ✅ The gym trains connections — strong ties like a front headlock or a body lock — and every item is a step on the ladder, written `from => to`. The rung falls out of the two ends: disconnected → a connection is **Make**; a connection → Hold is **Maintain**; a connection → another connection is **Transition**; a connection → a finish (takedown, back, pin, submission) is **Profit**. Disconnected comes in four shapes — both standing, they're down, I'm down, both down — because "one of us is down" is two different fights. `src/engine/ladder.js` holds the vocabulary and `rungOf(from, to)`; a line it can't place is "off the ladder", shown grey, never refused. **Leg entanglements are two facts**: where my chest points (inside, toward their centreline, or outside) and which of my hips their entangled leg crosses (inside, nearer their centreline, or outside). Two by two, four cells with the gym's names — Saddle (inside, inside), SLX (inside, outside), 50/50 (outside, inside), Outside ashi (outside, outside) — and what you do from a cell (heel hook, a triangle or not) is a finish or a named step, not the cell. Old position-first lines keep working and take colour where an end is recognised (`Closed guard => Triangle` is a Profit). |
| Entry: the add sheet | ✅ Each slot is its list plus one Add button. Add opens a sheet with one step at a time, over **the graph the gym built** — the union of lines in the coach's sets (`ladderGraph`), not the whole vocabulary: first the "from" (the disconnected shapes and connections that have an edge), then only the edges the sets contain from there, grouped by what the step does to your control — **hold it, a better connection, a similar one, less control, a phase change** (submission, takedown, pin). Control is a rank per connection (`CONTROL` in ladder.js: weak, strong, dominant; the gym scores a takedown from a strong tie double) — one table, easy to argue with. From Front headlock that is Hold; Rear body lock; Takedown, Guillotine, Darce, Anaconda. **Tap a chip again to take it back**: the item retires (history kept), and a third tap restores it. **Named steps**: a line may carry the gym's name for a step — `Body lock => Takedown => Ko soto gari` — shown as its own chip beside the plain one ("Takedown · Ko soto gari"); the ladder classifies by the destination and keeps the name. The text box reaches the rest of the ladder and accepts `Takedown => Ko soto gari`. A tap writes the line — `Front headlock => Darce x25` — and stays on the second step, so two finishes from one connection are two taps. The first line of an empty slot creates its list. A target key (none / x25 / x50) sticks between taps; tokui defaults to x25, kaizen to x50. A destination that isn't on the ladder is typed in a box that suggests as you go. Chips already on the list go dark; at the cap the button gives way to a note. Empty slots also offer the coach's sets, trimmed to the cap. Rows show a progress bar only once there is progress. |
| Editing: the grid | ✅ Each item is one editable row: tap the from-pill to pick another from, type the "to" with the ladder suggesting, tap the target to cycle none → x25 → x50 (a change restarts laps, as targets always have), × retires. Ids never change, so history follows the edit. |
| Colour by rung | ✅ Make blue, Maintain green, Transition orange, Profit red, off-the-ladder grey — on the chips, the pills, and each row's left band, with a key at the top of the tab. A list shows at a glance whether it is all finishes and no entries. |
| Starter sets | ✅ 17 curated sets, every line a step on the ladder, **all of them kaizen sets** offered by an empty kaizen slot as chips (trimmed to the cap of 3) — fundamentals, front headlock, body lock, single leg, two-on-one, back attack, mount ties, closed guard, half guard, passing, standing, leg entanglements, DLR, RDLR, collar-sleeve, butterfly/K, triangle hub. Every set line targets x50. **Tokui waza has no presets**: the tokui slot never offers sets, because your special techniques are yours to name; the add sheet is how they go in. Templates are **coach-owned by design**: served from Postgres (`GET /api/templates`, seeded from shipped defaults), replaced wholesale with the `TEMPLATE_ADMIN_SECRET` (`PUT` with `x-template-secret`); offline or db-less, the shipped defaults stand. The server seeds only an empty table, so after the shipped sets change a deployment keeps the old ones until `npm run templates:push` (with `TEMPLATE_ADMIN_SECRET` and `APP_URL`) replaces them. |
| The catalogue file: the coach's backend, for now | ✅ The sets and the connection ranks live in one JSON file, `src/engine/catalogue.json`: each set is a key, a name, a kind and its lines (one step per line, `Body lock => Takedown => Ko soto gari x50`); the ranks are three lists, weak / strong / dominant. The app ships that file as its offline defaults, the server seeds an empty table from it, and `npm run templates:push` (with `TEMPLATE_ADMIN_SECRET` and `APP_URL`) sends sets and ranks to a running server whole, replacing what it holds (`PUT /api/templates` with `{templates, control}`). The Google Sheets path (`src/engine/sheet.js`, `server/sheet-sync.js`) is parked: the engine still reads and writes the sheet rows and the tests keep it honest, but no route or key reaches it. |

### Technical

| Question | Decision |
| --- | --- |
| Build order | M1: offline core ✅ → **M2.1: device sync ✅ (anonymous trackers)** → M2.2: accounts → M2.3: coach layer. |
| Offline | Installable PWA; taps land locally and instantly. |
| State | Everything is an **action log**: `{id, type, payload, at}` folded through a pure engine (no Date, no randomness). Action ids are `<deviceId>-<counter>`; created entities derive ids from them, so devices can't collide. |
| Sync | ✅ Action-log sync: clients queue the same actions offline; the referee (`server/referee.js`, one endpoint at `/api/sync`) replays them through the same engine into an append-only **Postgres** log, idempotent by action id, per-tracker serialized. Pre-auth, a "tracker" is named by a sync code (`trackerId.secret`) carried between devices; M2.2 accounts absorb it. Rejected actions (engine says no against server truth) are named and dropped client-side. |
| Auth | ✅ **Magic-link accounts** (M2.2 slice one): request a link with your email plus the gym passphrase (`GYM_PASSPHRASE` gates signup, not login; unset = open signup), redeem it and the device holds a 90-day session plus the account's tracker credentials — login IS the sync-code handover, so the referee is unchanged. Coaches flagged live from `COACH_EMAILS` at each login. Mail via Resend (`RESEND_API_KEY`, `MAIL_FROM`); without a key the link goes to server logs and the UI says so. Links are single-use, 15-minute, hash-stored. The tracker secret is stored server-side in the clear deliberately (re-issued to each new device; grants nothing beyond the session). **Passkeys are the next slice** — the magic link is their enrollment path. |
| Hosting | Static PWA now (Vercel config included); M2 adds `api/` serverless functions in the same deploy. |

## Milestone 2 sketch

- `api/` — one serverless action endpoint (`POST /api/actions` appends +
  folds; `GET` returns state/log since a cursor) plus auth routes
  (WebAuthn challenge/verify, magic-link issue/consume).
- Postgres tables: `users`, `credentials`, `lists`, `list_shares`,
  `assignments`, `comments`, `actions` (the log, per owner), with folded
  snapshots cached.
- The client's `src/app/store.js` grows a queue: actions append locally,
  flush when online, reconcile by replaying server truth + unacked local
  actions.
- Coach roster view; share/assign/accept/archive flows; comment threads on
  lists and items.

## Open micro-decisions (flagged, not blocking)

- Whether the grid's session columns cap at N with horizontal scroll beyond
  (currently: all window sessions scroll).
- Passphrase rotation UX for M2.
- Whether a coach's own training uses the same student-style account (assumed yes).
