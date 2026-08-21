// The rules of the game: types, week arithmetic, XP and levels.
//
// Pure functions only - no storage, no React - so the whole game can move to
// a shared backend later without touching its logic.

export type HabitKind =
  | 'daily' // one tick a day (dishes done, cooked dinner)
  | 'multi' // several ticks a day (3 meals = target 3)
  | 'weekly' // target per week (gym x3, 5km x1)
  | 'tally'; // a counter: the drink, the ciggies, the ket. Scores nothing, ever.

export interface Habit {
  id: string;
  name: string;
  /**
   * The finish line, shown small under the name. Every habit is definitive:
   * it names a number or an unambiguous end, so there is never an argument
   * about whether it counted. "Drink 2L water", not "drank water".
   */
  detail?: string;
  emoji: string;
  kind: HabitKind;
  /** multi: ticks per day. weekly: times per week. Others ignore it. */
  target: number;
  /** XP per tick. Counters ignore it: they are not part of the scoring. */
  xp: number;
  /**
   * Tally habits that cost money: the price of one unit, in pence. Set it and
   * the habit counts what it has cost as well as how often.
   */
  unitCost?: number;
  archived?: boolean;
}

export interface Player {
  id: 'p1' | 'p2';
  name: string;
  emoji: string;
  /** Tailwind-free hex so the two sides always keep their colours. */
  colour: string;
}

/** One player's ticks against one habit on one date (YYYY-MM-DD). */
export interface Completion {
  habitId: string;
  playerId: Player['id'];
  date: string;
  count: number;
  /** What was actually spent that day, when it differs from count x unitCost. */
  spentPence?: number;
}

export interface WeekResult {
  /** Monday of the week, YYYY-MM-DD. */
  weekOf: string;
  p1: number;
  p2: number;
}

/**
 * A change to the shared board, waiting on the other brother's yes.
 * There is one board and both brothers play it, so it is nobody's to change
 * alone.
 */
export interface Proposal {
  id: string;
  /** Who proposed it - the OTHER player accepts or rejects. */
  by: Player['id'];
  kind: 'add' | 'retire' | 'edit';
  /** 'add': the habit as it would join. 'edit': the habit as it would become
   *  (same id as the one it replaces). */
  habit?: Habit;
  /** kind 'retire': which existing habit to retire. */
  habitId?: string;
}

export interface GameState {
  players: [Player, Player];
  habits: Habit[];
  completions: Completion[];
  /** Sealed results of past weeks - the bragging-rights ledger. */
  history: WeekResult[];
  /** Shared-board changes awaiting the other player's yes. */
  proposals: Proposal[];
}

// --- dates -------------------------------------------------------------------

export const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const today = (): string => dayKey(new Date());

/** Monday of the week containing `date`, as YYYY-MM-DD. Weeks run Mon-Sun. */
export function weekOf(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const shift = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - shift);
  return dayKey(d);
}

/** Every date key of the week starting at monday. */
export function weekDates(monday: string): string[] {
  const out: string[] = [];
  const d = new Date(monday + 'T12:00:00');
  for (let i = 0; i < 7; i++) {
    out.push(dayKey(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** Whole days between two dates (same day = 0). */
export function daysBetween(from: string, to: string): number {
  const a = new Date(from + 'T12:00:00').getTime();
  const b = new Date(to + 'T12:00:00').getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * How many times a habit can honestly be ticked in one day.
 *
 * A weekly target is a thing you do once in a day and no more: gym x3 is
 * three days in the week, not three taps in one afternoon. Multi habits say
 * how many a day they mean (three meals), daily habits mean one, and a
 * counter is however many it actually was.
 */
export function dailyCap(habit: Habit): number {
  switch (habit.kind) {
    case 'multi':
      return habit.target;
    case 'daily':
    case 'weekly':
      return 1;
    default:
      // A counter records what actually happened. Capping it would only make
      // an honest number a lie.
      return Infinity;
  }
}

// --- lookups -----------------------------------------------------------------

export function ticksOn(state: GameState, habitId: string, playerId: Player['id'], date: string): number {
  return (
    state.completions.find(c => c.habitId === habitId && c.playerId === playerId && c.date === date)
      ?.count ?? 0
  );
}

export function ticksInWeek(state: GameState, habitId: string, playerId: Player['id'], monday: string): number {
  const days = new Set(weekDates(monday));
  return state.completions
    .filter(c => c.habitId === habitId && c.playerId === playerId && days.has(c.date))
    .reduce((n, c) => n + c.count, 0);
}

// --- the counters: days since, how many, what it cost -------------------------
//
// A counter is the honest record of something you are cutting down - the
// drink, the ciggies, the ket. Every number below is read from that one log,
// so there is no second thing to keep in step with it and nothing to remember
// to press, and none of it touches the scoreboard.

/** Days this player logged a use of this habit, oldest first. */
function daysUsed(state: GameState, habitId: string, playerId: Player['id']): string[] {
  return state.completions
    .filter(c => c.habitId === habitId && c.playerId === playerId && c.count > 0)
    .map(c => c.date)
    .sort();
}

/** Every day this player logged anything at all, clean days included. */
function logDates(state: GameState, habitId: string, playerId: Player['id']): string[] {
  return state.completions
    .filter(c => c.habitId === habitId && c.playerId === playerId)
    .map(c => c.date)
    .sort();
}

/** The last day this player used, or null if the log has never shown one. */
export function lastUseDate(state: GameState, habitId: string, playerId: Player['id']): string | null {
  const uses = daysUsed(state, habitId, playerId);
  return uses.length > 0 ? uses[uses.length - 1] : null;
}

/**
 * Days clean as at `dateKey`: since the last use, or since the first day
 * logged if there has never been one. Zero if nothing is logged, because a
 * board nobody has opened is not a clean run.
 */
export function cleanRunOn(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  dateKey: string,
): number {
  const uses = daysUsed(state, habitId, playerId).filter(d => d <= dateKey);
  if (uses.length > 0) return daysBetween(uses[uses.length - 1], dateKey);
  const logs = logDates(state, habitId, playerId).filter(d => d <= dateKey);
  return logs.length > 0 ? daysBetween(logs[0], dateKey) : 0;
}

/** Days clean right now. */
export function cleanRun(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  todayKey: string,
): number {
  return cleanRunOn(state, habitId, playerId, todayKey);
}

/**
 * The longest clean run this log has ever held, the run in progress included.
 * Read from the gaps between uses, so it cannot be fiddled and cannot be lost.
 */
export function bestCleanRun(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  todayKey: string,
): number {
  const uses = daysUsed(state, habitId, playerId);
  if (uses.length === 0) return cleanRunOn(state, habitId, playerId, todayKey);
  const logs = logDates(state, habitId, playerId);
  let best = daysBetween(logs[0], uses[0]); // the run before the first use
  for (let i = 1; i < uses.length; i++) {
    best = Math.max(best, daysBetween(uses[i - 1], uses[i]));
  }
  return Math.max(best, daysBetween(uses[uses.length - 1], todayKey));
}

/**
 * What this habit has cost between two dates, inclusive, in pence. A log that
 * records what was actually paid wins over the habit's usual price, because
 * prices are not tidy.
 */
export function spentPence(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  fromKey: string,
  toKey: string,
): number {
  const unit = state.habits.find(h => h.id === habitId)?.unitCost ?? 0;
  return state.completions
    .filter(
      c =>
        c.habitId === habitId &&
        c.playerId === playerId &&
        c.date >= fromKey &&
        c.date <= toKey,
    )
    .reduce((total, c) => total + (c.spentPence ?? c.count * unit), 0);
}

/** Pence as money, for reading on a phone: 4000 becomes "£40". */
export function money(pence: number): string {
  const pounds = pence / 100;
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
}

// --- XP ----------------------------------------------------------------------

/**
 * A player's XP earned inside one week: every tick at its habit's rate.
 *
 * Counters are not in here at all, by design. Days clean and how many you
 * have had this week are facts about you, not moves in a game against your
 * brother, and mixing the two makes both of them worse: it turns an honest
 * log into something with a score riding on it.
 */
export function weekXp(state: GameState, playerId: Player['id'], monday: string): number {
  const days = new Set(weekDates(monday));
  let xp = 0;
  for (const c of state.completions) {
    if (c.playerId !== playerId || !days.has(c.date)) continue;
    // A claimed weekly challenge, stored under its ch: pseudo-habit id.
    if (c.habitId.startsWith('ch:')) {
      const challenge = CHALLENGE_POOL.find(ch => challengeKey(ch.id) === c.habitId);
      if (challenge && c.count > 0) xp += challenge.xp;
      continue;
    }
    const habit = state.habits.find(h => h.id === c.habitId);
    if (!habit) continue;
    if (habit.kind !== 'tally') xp += habit.xp * c.count;
  }
  return xp;
}

/** All-time XP: sealed weeks plus the current one. */
export function totalXp(state: GameState, playerId: Player['id'], todayKey: string): number {
  const sealed = state.history.reduce((n, w) => n + (playerId === 'p1' ? w.p1 : w.p2), 0);
  return sealed + weekXp(state, playerId, weekOf(todayKey));
}

/**
 * Level curve: each level needs a little more than the last.
 * L1 at 0, L2 at 100, then +150, +200, ... (50 more each level).
 */
export function levelFor(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  let threshold = 100;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    threshold += 50;
    level += 1;
  }
  return { level, into: remaining, needed: threshold };
}

// --- weekly challenges -------------------------------------------------------
//
// Three bonus challenges appear each week, picked deterministically from the
// pool by the week's own date. They are priced above the weekly jobs on
// purpose: a challenge is a whole week held to something, not one job done.
// Picked deterministically from the pool by the week's own date - so two phones with no server between them
// still show the same three. Claiming one is a single honest tap, once per
// player per week.

export interface Challenge {
  id: string;
  name: string;
  emoji: string;
  xp: number;
}

export const CHALLENGE_POOL: Challenge[] = [
  { id: 'date', name: 'Went on a date', emoji: '💐', xp: 50 },
  { id: 'dry-week', name: '0% alcohol all week', emoji: '🚱', xp: 60 },
  { id: 'plants-all', name: 'Watered every plant', emoji: '🪴', xp: 25 },
  { id: 'hoover', name: 'Hoovered the place', emoji: '🌀', xp: 35 },
  { id: 'new-recipe', name: 'Cooked something new', emoji: '🍲', xp: 40 },
  { id: 'called-family', name: 'Rang mum or nan', emoji: '📞', xp: 30 },
  { id: 'outside-hour', name: 'An hour outside', emoji: '🌤️', xp: 25 },
  { id: 'ten-k', name: 'A 10,000-step day', emoji: '👣', xp: 30 },
  { id: 'bed-every-day', name: 'Made the bed every day', emoji: '🛏️', xp: 35 },
  { id: 'no-takeaway', name: 'No takeaway all week', emoji: '🥡', xp: 45 },
  { id: 'early-night', name: 'In bed before 11, twice', emoji: '🌙', xp: 30 },
  { id: 'swim-or-sauna', name: 'Swim, sauna or cold shower', emoji: '🧊', xp: 30 },
];

/** Tiny deterministic hash so both phones agree on the week's picks. */
function hashWeek(monday: string): number {
  let h = 0;
  for (let i = 0; i < monday.length; i++) h = (h * 31 + monday.charCodeAt(i)) >>> 0;
  return h;
}

/** The week's three challenges, same answer on every device. */
export function challengesFor(monday: string): Challenge[] {
  const picks: Challenge[] = [];
  let h = hashWeek(monday);
  const pool = [...CHALLENGE_POOL];
  while (picks.length < 3 && pool.length > 0) {
    h = (h * 1103515245 + 12345) >>> 0;
    picks.push(pool.splice(h % pool.length, 1)[0]);
  }
  return picks;
}

/** Challenge claims live in completions under this prefixed pseudo-habit id. */
export const challengeKey = (challengeId: string) => `ch:${challengeId}`;

export function challengeClaimed(
  state: GameState,
  challengeId: string,
  playerId: Player['id'],
  monday: string,
): boolean {
  const days = new Set(weekDates(monday));
  return state.completions.some(
    c => c.habitId === challengeKey(challengeId) && c.playerId === playerId && days.has(c.date) && c.count > 0,
  );
}
