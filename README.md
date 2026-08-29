# BJJ GOAL TRACKER

Set jiu-jitsu goals, log your mat time, and watch the belt fill in. Everything
lives in your browser — no account, no server, no telemetry. Your whole
history is one JSON document in localStorage.

### Goals come in four shapes

| Type | Measures | Progress comes from |
| --- | --- | --- |
| **sessions** | train N times | tagging the goal when you log a session |
| **hours** | N hours on the mat | the minutes of tagged sessions |
| **count** | N of anything — reps, subs, comps | the **+1 / +10** buttons on the goal |
| **milestone** | done or not | you saying so |

Sessions- and hours-goals never store progress: they *read it off the
training log*. Delete a session and every goal it fed rolls back by itself.
Deadlines are optional; a goal that has one shows the days remaining and
turns red when it's behind you.

### Mat time

Log a session with a date, minutes, and a kind — gi, no-gi, drilling, open
mat, competition, or private — plus notes and the goals it counts toward.
The log view tracks the week in progress against your sessions-per-week aim.

### Journey

Your belt, drawn as a belt: rank colour, black tab (red once you're a black
belt), stripes on the tab. Setting a new rank appends to a promotion
history. Below it: lifetime sessions and mat hours, your unbroken-weeks
streak, weeks on target, and an eight-week bar chart — bars that hit the
weekly aim glow green. Training weeks run Monday–Sunday, and the week in
progress can't break a streak: you may just not have trained *yet*.

## Architecture

A functional core with one thin shell, after the pattern of
[OVERTYPE](https://github.com/ptetau/overtype):

```
src/engine/   pure rules — no IO, no Math.random, no Date. JSON in, JSON out.
src/app/      the shell: the clock (todayISO) and the disk (localStorage)
src/ui/       React components + one stylesheet
```

"Today" is always an ISO date string passed *into* the engine, so every rule
replays identically in tests. Ids come from a counter, not randomness. Date
math runs on UTC midnights so a calendar date is the same date everywhere
and daylight saving can't make a day 23 hours.

## Running it

```
npm install
npm run dev       # Vite dev server
npm test          # engine tests (vitest)
npm run build     # static site in dist/
```

Deploys anywhere that serves static files; `vercel.json` is included.
