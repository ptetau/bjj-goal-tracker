# CLAUDE.md — TOKUI

Mission lists for the mat: tokui/growth lists, TRY/HIT tallies between
rolls, sharpness over a 21-day window. `docs/SPEC.md` is the decision
record — consult it before "improving" a behaviour; most of what looks like
a quirk was chosen on purpose (equal-weight window, hit-implies-attempt,
retire-don't-delete, explicit laps).

## Architecture

```
src/engine/   pure functional core, shaped as an ACTION LOG.
              actions.js — {type, payload, at} folded through apply(); ids
                           from a counter; `at` is a local ISO datetime the
                           shell stamps. No Date, no Math.random, no IO.
              parse.js   — total line parser (never rejects input)
              stats.js   — sharpness grid, streaks, calendar views
              dates.js   — ISO-string calendar math (UTC midnights)
src/app/      the shell: clock (nowISO) + disk (log → localStorage)
src/ui/       React + one stylesheet (theme.css). No logic worth testing
              lives here — if a component needs a rule, the rule moves to
              the engine first.
public/       PWA: manifest, sw.js, icons
```

The log is milestone 2's sync protocol (serverless replay into Postgres) —
so treat the action vocabulary as a wire format: additive changes only,
never repurpose an existing action's meaning.

## Commands

```
npm test          # vitest: example + property suites (must pass before any push)
npm run test:watch
npm run dev       # Vite dev server (SW disabled in dev)
npm run build     # static PWA in dist/
```

## Development discipline: TDD with property-based testing

This repo is developed test-first, and engine work is **property-first**.
Non-negotiables:

1. **Red before green.** No engine change lands without a test that failed
   before the implementation existed. Write it, watch it fail, then code.
   A test that never failed proves nothing — if you can't make it fail,
   you're testing the wrong thing.

2. **Properties for invariants, examples for rules.** Anything phrased
   "for all histories/inputs…" goes in `test/engine.props.test.js` with
   fast-check. Specific behaviours and regressions get example tests in
   the per-module suites (`actions.test.js`, `parse.test.js`,
   `stats.test.js`, `dates.test.js`). A bug fix gets BOTH when possible:
   the example that reproduces it, and the property that would have caught
   the whole class.

3. **The seed driver is the generator.** `test/helpers.js` maps fast-check
   integer records onto valid actions for the current state
   (`actionFromSeed` / `playSeeds`, every intermediate state deep-frozen).
   **Adding an action type means extending the driver in the same commit**
   — an action the driver can't reach is an action no property exercises.
   The "seed driver" suite at the bottom of the props file keeps the
   driver honest: every action it emits must apply cleanly.

4. **Standing invariants every new action must preserve** (already
   enforced by the props suite — run it, don't re-derive):
   - purity: no mutation of the input state (deep-freeze catches it)
   - determinism: `fold(log)` replays to the identical state
   - state is plain JSON (survives stringify/parse)
   - ids unique and below `nextId`; at most one open session
   - tallies conserve taps; undo/adjust round-trips are identities

5. **Engine stays pure.** "Today"/"now" arrive as ISO strings from the
   shell. If a change needs `Date`, randomness, or IO inside `src/engine/`,
   the design is wrong — push it to `src/app/`.

6. **UI is exempt from PBT, not from verification.** Before pushing UI
   changes, drive the real built app in headless Chromium (Playwright,
   `executablePath: '/opt/pw-browsers/chromium'`, phone viewport) through
   the touched flow. HTML form quirks (constraint validation, blur timing)
   have already produced bugs unit tests can't see.

7. **fast-check idioms** (match `engine.props.test.js`): `fc.assert(
   fc.property(...))`, `fc.pre()` for conditioned runs, seeds/records over
   bespoke generators, bounded sizes (histories ≤ 60 ops). Keep the whole
   suite under a few seconds — a slow property gets its `numRuns` bounded,
   not deleted.
