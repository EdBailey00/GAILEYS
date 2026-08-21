# Bragging Rights

The Bailey brothers' scoreboard. Meals, chores and miles, all worth points;
whoever's ahead on Sunday night gets the bragging rights. The drink, the
ciggies and the ket are counted separately and score nothing.

**On Android:** install the app once, from the latest release at
https://github.com/EdBailey00/GAILEYS/releases/latest. Open that page on the
phone, tap the `.apk`, and allow installs from that source when Android asks.

Once. The apk is a shell around the deployed site rather than a copy of it, so
every push reaches it the same second it reaches the browser and there is
nothing to reinstall. The cost is that the very first launch needs signal;
after that the service worker has the files and it opens offline as before.

**In a browser:** https://edbailey00.github.io/GAILEYS/ - the same app, and
still installable from the browser menu ("Install app" / "Add to Home Screen")
on any phone, which is the route for an iPhone.

## One board, two phones

There is no sign-in. Open it, tap your name once, and you are on the board.
The phone remembers; both phones read and write the same board, live.

Both brothers carry exactly the same habits. There is no such thing as a
habit of your own: whatever goes on the board goes on both sides, which is the
only way the scoreline means anything. You can look at your brother's board,
but only your own has anything you can tap, so nobody fat-fingers a gym
session onto the wrong side. Which brother a
phone belongs to is a setting, not a password: this is a scoreboard for two
people who share a kitchen and it is deliberately built as one.

Which also means the board is open to anyone who has the address. That was a
deliberate trade, made knowingly: an account and an emailed code to look at a
scoreboard was more friction than the thing is worth. The row level security
is still in the project, so turning identity back on later is adding a policy
rather than a rebuild.

It works with no signal. The app opens on the copy this phone last saw before
it asks the server anything, changes go into an outbox, and the outbox empties
when the signal comes back. Every change carries an absolute value ("gym is 2
this Tuesday", never "+1"), which is what makes replaying it after a tunnel or
a flat battery safe rather than a guess.

## How it scores

- **Today**: daily ticks (2L of water, dishes) and multi-ticks (3 meals).
- **This week**: targets per week (gym x3, 5km, climbing) - Monday reset.
- **Challenges**: three bonus challenges a week, drawn from a pool.
- Sealed weeks land in the ledger at the bottom - the permanent record.

The counters are not in any of that. See below.

Every habit is definitive. "Drink 2L water", not "drank water": each one names
a number or an unambiguous finish line, with the detail underneath, so there is
never an argument about whether it counted.

### The counters

Three big circles sit on the board itself, under the scoreline. One tap is
one more, which is the whole point: the moment you log one is the moment you
are reaching for it, so it has to be doable in a second with one thumb. A
second tap under the circle takes it back.

Everything you might want to *read* about them is on the counters page, since
none of it is what you need while you are lighting one. They are not part of
the game at all. Two numbers each:

- **days since** the last one
- **how many this week**

Both are read from one log: you tap the number of what you actually had, and
everything else follows. Days since comes from the last use in the log, so it
cannot be fiddled and cannot be lost. Give a counter a price and it adds up
what it has cost this week, this month and all time.

None of it scores, and that is the point. A number you are scored on is a
number you have a reason to shade, and these are the ones that have to stay
true. Logging four ciggies costs nothing and a clean fortnight earns nothing;
the scoreline at the top is untouched either way.

Money is opt-in per counter and smoking has no price on it, so the cigarettes
carry no cost anywhere: not on the card, not in the stats, not in the totals.
Only counters with a price are in the money at all.

### Stats

The long view, all of it read from rows the board already keeps: weeks won
head to head, every week's score as a chart, your best week, what the priced
counters have cost this week, month and year, and per counter how many a week
you are having, how long since the last one and the longest you have gone.

"Saved" is measured against the worst week you actually had, because money
saved against a rate nobody ever agreed to is a made-up number.

The charts are hand-drawn svg. Three bars and an axis do not need a charting
library, and the app has to work in a basement with no signal.

### Chat

Two brothers, one thread, live. Deliberately outside the board's sync: the
board is absolute values that can be replayed safely after a tunnel, and a
message is a thing said once - replaying it would say it twice. So a message
that fails to send stays in the box for you to try again.

It needs a `messages` table, which the app is not allowed to create and nor
should it be. Open the chat tab and it prints the SQL to run in the Supabase
project, with a button to copy it.

## Working on it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # the game rules and the sync diff
```

Note the dev server is at the root now, not `/GAILEYS/`. The base path is set
by `NEXT_PUBLIC_BASE_PATH`, which the Pages workflow sets to `/GAILEYS` and the
Android build leaves unset.

The layers, smallest first:

| File | Job |
|---|---|
| `src/lib/game.ts` | the rules: XP, weeks, the counters, money. Pure |
| `src/lib/stats.ts` | what it all adds up to over time. Pure |
| `src/lib/chat.ts` | the thread. Its own sync, for good reason |
| `src/lib/store.ts` | this phone's copy, and every change as a pure function |
| `src/lib/sync.ts` | what changed, and the outbox that survives no signal |
| `src/lib/remote.ts` | rows in, rows out. The only file that knows SQL exists |
| `src/lib/useBoard.ts` | ties them together for the interface |

The database schema, its row level security and the seeded habit list live in
the Supabase project; the migrations that built it are named `core_schema`,
`row_level_security` and `seed_board`.

The url and publishable key in `src/lib/supabase.ts` are not secrets and are
not treated as any. Any static build inlines them and this repo is public.

## Showing somebody

`?demo` opens the same app on an invented board:
https://edbailey00.github.io/GAILEYS/?demo

It is not a screenshot and not a cut-down build - it is this code with a
different board underneath. Every page works, every tap lands, the numbers
move. What it does not do is speak to the server: in demo mode `useBoard` and
`useChat` never call it, so a stranger having a go cannot read the real board
or write a single row to it. Their taps go to their own localStorage key.

That matters because there is no sign-in. Anyone with the plain address gets
the real board, counters included, and can tick as either brother. So the
plain link is for the two of them and the `?demo` one is for everybody else.

## Updating

The app keeps itself current. It asks the server which push is live when it
opens, when you come back to it and when signal returns, and if that is a
different one it empties its caches and reloads onto it, without asking -
there is nothing to decide, and every tap is already saved on the phone and
the server before a reload could happen. The Android app does the same thing,
because it is the same site.

Only an apk from before this change cannot: those carry their own copy of the
files and nothing they can do replaces it. They fall back to pointing at the
latest release, which is the shell, which is the last one they need.

## Which push am I on

`src/lib/version.ts` holds one string, `gailey.v.NN`. It is printed at the
bottom of every screen in the app and used as the title of the apk release, so
the phone and the releases page name the same build. If the number at the
bottom of the app is not the one you just pushed, the phone is on an older
build and wants reopening (or reinstalling, for the apk).

Bump it on every push. Nothing enforces it.

The app checks for itself. In a browser it asks the server for
`version.json` (written into the build by `scripts/version-file.mjs`) when it
opens, when you come back to it and when signal returns; if that names a
different push, a bar appears at the bottom and one tap clears the cache and
reloads onto it. Inside the apk the files are baked in, so nothing the app can
do would update it - there it asks GitHub what the latest release is called
and, if it is a different push, points you at the apk. Installing is still a
tap on a file, because that is what sideloading is.

## Deployment

- `.github/workflows/pages.yml` - the browser version, on every push to main.
- `.github/workflows/android.yml` - the apk, on every push to main, published
  as a release.
