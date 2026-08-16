# Bragging Rights

The Bailey brothers' scoreboard. Meals, chores, miles and hard-won days, all
worth points; whoever's ahead on Sunday night gets the bragging rights.

**Play it:** https://edbailey00.github.io/GAILEYS/

On a phone, open that link and add it to the home screen (Android: browser
menu, "Install app" / "Add to Home screen". iPhone: Share, "Add to Home
Screen"). It opens full-screen like an app and works offline.

## How it scores

- **Today**: daily ticks (dishes, cooked dinner) and multi-ticks (3 meals).
- **This week**: targets per week (gym x3, 5km, climbing) - Monday reset.
- **Challenges**: three bonus challenges a week, drawn from a pool - both
  phones independently draw the same three.
- **The hard-won days**: count-up streaks (days without beer / drugs). Worth
  more the longer they run: x1.5 after a week, x2 after a month, x3 after a
  hundred days. Resetting is honest and keeps your best run.
- **Cutting down**: tallies for things being cut (ciggies). Logging never
  costs points; a declared clean day earns them.
- Sealed weeks land in the ledger at the bottom - the permanent record.

## The honest limitation

Scores live on each phone (no server). Two phones means two boards - compare
across the kitchen table. Live sync is the designed next step: the game logic
is already pure (`src/lib/game.ts`) with storage isolated in
`src/lib/store.ts`, so a shared backend swaps in behind one file.

## Working on it

```bash
npm install
npm run dev
```

Static export deploys to GitHub Pages on every push to main
(`.github/workflows/pages.yml`).
