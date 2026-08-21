// What the numbers add up to over time.
//
// Everything here is read from the same rows the board already keeps - the
// completions log and the sealed weeks - so there is nothing extra to record
// and no second version of the truth to drift. Pure functions, no React, no
// SQL, same as game.ts.

import {
  type GameState,
  type Habit,
  type Player,
  type WeekResult,
  daysBetween,
  spentPence,
  ticksInWeek,
  weekDates,
  weekOf,
  weekXp,
} from './game';

/** The first day of the month containing `date`. */
export const monthStart = (date: string): string => `${date.slice(0, 7)}-01`;

/** The first day of the year containing `date`. */
export const yearStart = (date: string): string => `${date.slice(0, 4)}-01-01`;

/** The Monday `n` weeks before this one. */
export function weeksBack(monday: string, n: number): string {
  const d = new Date(`${monday}T12:00:00`);
  d.setDate(d.getDate() - 7 * n);
  return weekOf(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  );
}

// --- the scoreboard over time ------------------------------------------------

/**
 * Every week on record, oldest first: the sealed ledger plus the one in
 * progress. The current week is computed rather than read, because it has not
 * been sealed yet and will keep moving until Sunday night.
 */
export function weeklyScores(state: GameState, todayKey: string): WeekResult[] {
  const thisMonday = weekOf(todayKey);
  const sealed = state.history.filter(w => w.weekOf < thisMonday);
  return [
    ...[...sealed].sort((a, b) => (a.weekOf < b.weekOf ? -1 : 1)),
    { weekOf: thisMonday, p1: weekXp(state, 'p1', thisMonday), p2: weekXp(state, 'p2', thisMonday) },
  ];
}

export interface Standing {
  p1: number;
  p2: number;
  draws: number;
}

/** The head to head, sealed weeks only - the week in progress is not won yet. */
export function record(state: GameState): Standing {
  return state.history.reduce<Standing>(
    (acc, w) => {
      if (w.p1 > w.p2) acc.p1 += 1;
      else if (w.p2 > w.p1) acc.p2 += 1;
      else acc.draws += 1;
      return acc;
    },
    { p1: 0, p2: 0, draws: 0 },
  );
}

/** This player's highest scoring week, sealed or in progress. */
export function bestWeek(
  state: GameState,
  playerId: Player['id'],
  todayKey: string,
): WeekResult | null {
  const weeks = weeklyScores(state, todayKey);
  const scored = weeks.filter(w => (playerId === 'p1' ? w.p1 : w.p2) > 0);
  if (scored.length === 0) return null;
  return scored.reduce((best, w) =>
    (playerId === 'p1' ? w.p1 : w.p2) > (playerId === 'p1' ? best.p1 : best.p2) ? w : best,
  );
}

// --- the counters over time --------------------------------------------------

export interface WeekCount {
  weekOf: string;
  count: number;
}

/**
 * How many of this counter, week by week, oldest first, ending with the week
 * in progress. Weeks with nothing logged come back as zero rather than being
 * missing, so a chart of it has no holes in it.
 */
export function weeklyUse(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  weeks: number,
  todayKey: string,
): WeekCount[] {
  const thisMonday = weekOf(todayKey);
  const out: WeekCount[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = weeksBack(thisMonday, i);
    out.push({ weekOf: monday, count: ticksInWeek(state, habitId, playerId, monday) });
  }
  return out;
}

/** Whether this counter costs anything at all. No price, no money, anywhere. */
export const isPriced = (habit: Habit): boolean =>
  habit.unitCost !== undefined && habit.unitCost > 0;

/** Counters that cost money. Smoking is not one of them unless a price is set. */
export const pricedCounters = (state: GameState): Habit[] =>
  state.habits.filter(h => !h.archived && h.kind === 'tally' && isPriced(h));

export interface Spend {
  week: number;
  month: number;
  year: number;
  ever: number;
}

/** What the priced counters have cost this player, over the usual windows. */
export function spend(state: GameState, playerId: Player['id'], todayKey: string): Spend {
  const monday = weekOf(todayKey);
  return pricedCounters(state).reduce<Spend>(
    (acc, h) => ({
      week: acc.week + spentPence(state, h.id, playerId, monday, todayKey),
      month: acc.month + spentPence(state, h.id, playerId, monthStart(todayKey), todayKey),
      year: acc.year + spentPence(state, h.id, playerId, yearStart(todayKey), todayKey),
      ever: acc.ever + spentPence(state, h.id, playerId, '0000-01-01', todayKey),
    }),
    { week: 0, month: 0, year: 0, ever: 0 },
  );
}

/**
 * The most this counter has ever cost in a single week.
 *
 * This is the only honest baseline the log can offer. Money "saved" against a
 * rate nobody ever agreed to is a made-up number; money saved against the
 * worst week you actually had is a fact about you.
 */
export function worstWeekPence(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
): number {
  const mondays = new Set(
    state.completions
      .filter(c => c.habitId === habitId && c.playerId === playerId)
      .map(c => weekOf(c.date)),
  );
  let worst = 0;
  for (const monday of mondays) {
    const sunday = weekDates(monday)[6];
    worst = Math.max(worst, spentPence(state, habitId, playerId, monday, sunday));
  }
  return worst;
}

/**
 * How much better this week is than the worst week on record, across every
 * priced counter. Negative means this week is the worst one.
 */
export function betterThanWorstWeek(
  state: GameState,
  playerId: Player['id'],
  todayKey: string,
): { saved: number; worst: number; now: number } | null {
  const priced = pricedCounters(state);
  if (priced.length === 0) return null;
  const monday = weekOf(todayKey);
  let worst = 0;
  let now = 0;
  for (const h of priced) {
    worst += worstWeekPence(state, h.id, playerId);
    now += spentPence(state, h.id, playerId, monday, todayKey);
  }
  if (worst === 0) return null;
  return { saved: worst - now, worst, now };
}

// --- clean runs --------------------------------------------------------------

/**
 * The longest this player has gone without this counter, in days, and when it
 * ended. Read from the gaps between uses, so it cannot be fiddled.
 */
export function longestGap(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  todayKey: string,
): number {
  const uses = state.completions
    .filter(c => c.habitId === habitId && c.playerId === playerId && c.count > 0)
    .map(c => c.date)
    .sort();
  if (uses.length === 0) return 0;
  let best = daysBetween(uses[uses.length - 1], todayKey);
  for (let i = 1; i < uses.length; i++) {
    best = Math.max(best, daysBetween(uses[i - 1], uses[i]));
  }
  return best;
}
