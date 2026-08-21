# Bragging Rights

The Bailey brothers' scoreboard. Meals, chores, miles and hard-won days, all
worth points; whoever's ahead on Sunday night gets the bragging rights.

**On Android:** install the app from the latest release, at
https://github.com/EdBailey00/GAILEYS/releases/latest. Open that page on the
phone, tap the `.apk`, and allow installs from that source when Android asks.
Every push to `main` builds a new one.

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
- **The hard-won days**: count-up streaks, worth more the longer they run:
  x1.5 after a week, x2 after a month, x3 after a hundred days. Resetting is
  honest and keeps your best run.
- **Cutting down**: its own tab, not part of the board. Logging a use never
  costs points and a declared clean day scores, on the same escalating scale,
  so a clean day on day 40 is worth more than one on day 4.
- Sealed weeks land in the ledger at the bottom - the permanent record.

Every habit is definitive. "Drink 2L water", not "drank water": each one names
a number or an unambiguous finish line, with the detail underneath, so there is
never an argument about whether it counted.

### The tracker

The beer, the ciggies and the ket live behind the second tab, away from the
ticking. They are not habits you are trying to do more of, their numbers read
the other way round, and they should not be the thing you scroll past on the
way to ticking the dishes off.

A tally habit given a price becomes a proper tracker: days clean, the longest
clean run ever held, and what it has cost this week, this month and all time.
Every one of those numbers is read from the same log, so there is nothing to
keep in step and nothing to remember to press. Days clean comes from the last
use in the log, and the best run from the gaps between uses, which means it
cannot be fiddled and cannot be lost.

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
| `src/lib/game.ts` | the rules: XP, weeks, streaks, clean runs, money. Pure |
| `src/lib/store.ts` | this phone's copy, and every change as a pure function |
| `src/lib/sync.ts` | what changed, and the outbox that survives no signal |
| `src/lib/remote.ts` | rows in, rows out. The only file that knows SQL exists |
| `src/lib/useBoard.ts` | ties them together for the interface |

The database schema, its row level security and the seeded habit list live in
the Supabase project; the migrations that built it are named `core_schema`,
`row_level_security` and `seed_board`.

The url and publishable key in `src/lib/supabase.ts` are not secrets and are
not treated as any. Any static build inlines them and this repo is public.

## Deployment

- `.github/workflows/pages.yml` - the browser version, on every push to main.
- `.github/workflows/android.yml` - the apk, on every push to main, published
  as a release.
