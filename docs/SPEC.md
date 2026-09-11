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
| Training mode | ✅ A rolling session takes the whole screen, styled as a drum machine: one fat pad per live item (tap = one hit), a latching TRY key that makes pad taps count attempts instead, two banks you swipe between or pick with A/B keys — A is the tokui list, B ("Kaizen") the growth list; both are always there, and an empty one says what it's for and sends you to Missions to fill it — a display echoing the last tap, and one UNDO for whatever the last tap was. MENU leaves the pads with the session still rolling; END closes it and opens the editor. No masthead, no tabs, nothing that needs precision. |
| Sharpness | Consistency over a **21-day calendar window**, every session equal weight — legible over smooth. Cells show hits *and* tries; tokui rows lead with hit-consistency, growth rows with try-consistency. Empty window shows "no data", not 0%. |
| Targets | Met target → celebrate → explicit choice: next lap or retire. Laps count on (lap 2 of x50 = hits 51–100). Changing a target resets laps. |
| Lifecycle | Items/lists retire or archive, never silently delete; renames keep ids so history follows the item. Sessions can be deleted. |
| Timeline | Calendar-first: month grid with intensity dots, day drill-down, Mon–Sun streaks with an in-progress-week grace. |
| Roles (M2) | Students share a list to a coach or training partner as read/comment/edit. Coaches assign lists; students accept and can archive. Comments attach to **lists and items** (not sessions). |
| Onboarding (M2) | Signup gated by a gym passphrase; coach role via an email allowlist (env/config). |
| The ladder | ✅ The gym trains connections — strong ties like a front headlock or a body lock — and every item is a step on the ladder, written `from => to`. The rung falls out of the two ends: disconnected → a connection is **Make**; a connection → Hold is **Maintain**; a connection → another connection is **Transition**; a connection → a finish (takedown, back, pin, submission) is **Profit**. Disconnected comes in four shapes — both standing, they're down, I'm down, both down — because "one of us is down" is two different fights. `src/engine/ladder.js` holds the vocabulary and `rungOf(from, to)`; a line it can't place is "off the ladder", shown grey, never refused. Old position-first lines keep working and take colour where an end is recognised (`Closed guard => Triangle` is a Profit). |
| Entry: the add sheet | ✅ Each slot is its list plus one Add button. Add opens a sheet with one step at a time, over **the graph the gym built** — the union of lines in the coach's sets (`ladderGraph`), not the whole vocabulary: first the "from" (the disconnected shapes and connections that have an edge), then only the edges the sets contain from there, grouped by what the step does to your control — **hold it, a better connection, a similar one, less control, a phase change** (submission, takedown, pin). Control is a rank per connection (`CONTROL` in ladder.js: weak, strong, dominant; the gym scores a takedown from a strong tie double) — one table, easy to argue with. From Front headlock that is Hold; Rear body lock; Takedown, Guillotine, Darce, Anaconda. **Tap a chip again to take it back**: the item retires (history kept), and a third tap restores it. **Named steps**: a line may carry the gym's name for a step — `Body lock => Takedown => Ko soto gari` — shown as its own chip beside the plain one ("Takedown · Ko soto gari"); the ladder classifies by the destination and keeps the name. The text box reaches the rest of the ladder and accepts `Takedown => Ko soto gari`. A tap writes the line — `Front headlock => Darce x25` — and stays on the second step, so two finishes from one connection are two taps. The first line of an empty slot creates its list. A target key (none / x25 / x50) sticks between taps; tokui defaults to x25, kaizen to x50. A destination that isn't on the ladder is typed in a box that suggests as you go. Chips already on the list go dark; at the cap the button gives way to a note. Empty slots also offer the coach's sets, trimmed to the cap. Rows show a progress bar only once there is progress. |
| Editing: the grid | ✅ Each item is one editable row: tap the from-pill to pick another from, type the "to" with the ladder suggesting, tap the target to cycle none → x25 → x50 (a change restarts laps, as targets always have), × retires. Ids never change, so history follows the edit. |
| Colour by rung | ✅ Make blue, Maintain green, Transition orange, Profit red, off-the-ladder grey — on the chips, the pills, and each row's left band, with a key at the top of the tab. A list shows at a glance whether it is all finishes and no entries. |
| Starter sets | ✅ 17 curated sets, every line a step on the ladder, offered by an empty slot as "Start from a set" chips (trimmed to the cap) — fundamentals, back attack, leg entanglement, pressure passing, the guard curriculum (closed/half/X/SLX/lasso/DLR/RDLR/collar-sleeve), loose/tight passing, standing, triangle hub. Tokui sets target finishes (x25); growth sets target everything x50 by default. Templates are **coach-owned by design**: served from Postgres (`GET /api/templates`, seeded from shipped defaults), replaced wholesale with the `TEMPLATE_ADMIN_SECRET` (`PUT` with `x-template-secret`); offline or db-less, the shipped defaults stand. The server seeds only an empty table, so after the shipped sets change a deployment keeps the old ones until `npm run templates:push` (with `TEMPLATE_ADMIN_SECRET` and `APP_URL`) replaces them, or the coach syncs from the sheets. |
| The sheets: the coach's backend | ✅ The coach keeps the gym's map in two Google Sheets, by hand: **the graph** (one row per step of every set: Set, Kind, From, To, Name, Target — plus Rung and Control change, written for reading and ignored on the way in) and **the ranks** (Connection, Rank: weak / strong / dominant). Each sheet is shared "anyone with the link" and the server holds its CSV export link (`TEMPLATE_SHEET_GRAPH_CSV`, `TEMPLATE_SHEET_RANKS_CSV`). **Sync is on demand, not live**: the "Sync from sheets" key at the foot of Missions (shown only when the server has links) asks for the admin secret and `POST /api/templates {op:"sync"}` fetches both CSVs, reads them through the engine (`src/engine/sheet.js`: columns found by header so the coach may reorder or add notes, blank rows skipped, kaizen = the growth list, a set's key is its name slugged, `Body lock / Takedown / Ko soto gari / 25` is the line `Body lock => Takedown => Ko soto gari x25`), and replaces sets and ranks in one transaction — a row it cannot read fails the whole sync and names the row ("graph row 14: kind "cardio" is not tokui or kaizen"), and the old catalogue stands. `npm run templates:sync` does the same from a terminal. The app reads climbs (better / similar / less control) against the synced ranks, the shipped `CONTROL` table until then. |

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
