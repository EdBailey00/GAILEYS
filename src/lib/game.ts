// The rules of the game: types, week arithmetic, XP and levels.
//
// Pure functions only - no storage, no React - so the whole game can move to
// a shared backend later without touching its logic.

export type HabitKind =
  | 'daily' // one tick a day (dishes done, cooked dinner)
  | 'multi' // several ticks a day (3 meals = target 3)
  | 'weekly' // target per week (gym x3, 5km x1)
  | 'streak' // count-up days (days without beer), resettable, worth more the longer it runs
  | 'tally'; // counting a habit you are cutting down (ciggies) - logging is honest, zero days score

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  kind: HabitKind;
  /** multi: ticks per day. weekly: times per week. Others ignore it. */
  target: number;
  /** XP per tick (daily/multi/weekly) or per held day (streak). */
  xp: number;
  /**
   * Whose habit this is. Absent = shared, both players compete on it.
   * Set = personal: only that player sees it and scores from it (Alfie's
   * work-from-Ed's-room day is not on Ed's board).
   */
  owner?: 'p1' | 'p2';
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
}

/** A running count-up streak. Reset = new startedOn (history keeps the best). */
export interface StreakState {
  habitId: string;
  playerId: Player['id'];
  /** YYYY-MM-DD the current run started. */
  startedOn: string;
  /** Longest run ever, in days, for the bragging. */
  best: number;
}

export interface WeekResult {
  /** Monday of the week, YYYY-MM-DD. */
  weekOf: string;
  p1: number;
  p2: number;
}

/**
 * A change to the shared board, waiting on the other brother's yes.
 * Personal habits skip this; the shared game is nobody's to change alone.
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
  streaks: StreakState[];
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

/** Whole days from startedOn to today (day 0 = started today). */
export function streakDays(startedOn: string, todayKey: string): number {
  const a = new Date(startedOn + 'T12:00:00').getTime();
  const b = new Date(todayKey + 'T12:00:00').getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
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

export function streakFor(state: GameState, habitId: string, playerId: Player['id']): StreakState | undefined {
  return state.streaks.find(s => s.habitId === habitId && s.playerId === playerId);
}

// --- XP ----------------------------------------------------------------------

/**
 * Streaks are worth more the longer they run - the whole point of a hard-won
 * day 40 is that it beats a day 4. Multiplier by days held:
 * under a week 1x, then 1.5x, a month 2x, a hundred days 3x.
 */
export function streakMultiplier(days: number): number {
  if (days >= 100) return 3;
  if (days >= 30) return 2;
  if (days >= 7) return 1.5;
  return 1;
}

/**
 * A player's XP earned inside one week: every tick at its habit's rate; each
 * held streak day at its escalating rate; and for tally habits, a zero-day
 * bonus - logging the number is always safe, a clean day scores.
 */
export function weekXp(state: GameState, playerId: Player['id'], monday: string, todayKey: string): number {
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
    if (habit.owner && habit.owner !== playerId) continue;
    // Tally counts are the thing being cut down - they never earn per tick.
    if (habit.kind !== 'tally') xp += habit.xp * c.count;
  }
  for (const s of state.streaks) {
    if (s.playerId !== playerId) continue;
    const habit = state.habits.find(h => h.id === s.habitId);
    if (!habit || habit.kind !== 'streak' || habit.archived) continue;
    if (habit.owner && habit.owner !== playerId) continue;
    // Days of this run that fall inside this week, up to today, each at the
    // rate the streak had reached on that day.
    for (const d of weekDates(monday)) {
      if (d > todayKey) break;
      const held = streakDays(s.startedOn, d);
      if (d >= s.startedOn && held > 0) xp += Math.round(habit.xp * streakMultiplier(held));
    }
  }
  // Tally zero-days: a day DECLARED clean (a zero log exists) earns the
  // habit's xp once. Days never logged earn nothing either way - the bonus
  // rewards the declaration, and unopened apps are not mistaken for clean days.
  for (const habit of state.habits) {
    if (habit.kind !== 'tally' || habit.archived) continue;
    if (habit.owner && habit.owner !== playerId) continue;
    for (const d of weekDates(monday)) {
      if (d > todayKey) break;
      const log = state.completions.find(
        c => c.habitId === habit.id && c.playerId === playerId && c.date === d,
      );
      if (log && log.count === 0) xp += habit.xp;
    }
  }
  return xp;
}

/** All-time XP: sealed weeks plus the current one. */
export function totalXp(state: GameState, playerId: Player['id'], todayKey: string): number {
  const sealed = state.history.reduce((n, w) => n + (playerId === 'p1' ? w.p1 : w.p2), 0);
  return sealed + weekXp(state, playerId, weekOf(todayKey), todayKey);
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

/** Streak milestones worth shouting about. */
export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

export function nextMilestone(days: number): number | null {
  return MILESTONES.find(m => m > days) ?? null;
}

// --- weekly challenges -------------------------------------------------------
//
// Three bonus challenges appear each week, picked deterministically from the
// pool by the week's own date - so two phones with no server between them
// still show the same three. Claiming one is a single honest tap, once per
// player per week.

export interface Challenge {
  id: string;
  name: string;
  emoji: string;
  xp: number;
}

export const CHALLENGE_POOL: Challenge[] = [
  { id: 'date', name: 'Went on a date', emoji: '💐', xp: 30 },
  { id: 'dry-week', name: '0% alcohol all week', emoji: '🚱', xp: 40 },
  { id: 'plants-all', name: 'Watered every plant', emoji: '🪴', xp: 15 },
  { id: 'hoover', name: 'Hoovered the place', emoji: '🌀', xp: 20 },
  { id: 'new-recipe', name: 'Cooked something new', emoji: '🍲', xp: 25 },
  { id: 'called-family', name: 'Rang mum or nan', emoji: '📞', xp: 20 },
  { id: 'outside-hour', name: 'An hour outside', emoji: '🌤️', xp: 15 },
  { id: 'ten-k', name: 'A 10,000-step day', emoji: '👣', xp: 20 },
  { id: 'bed-every-day', name: 'Made the bed every day', emoji: '🛏️', xp: 20 },
  { id: 'no-takeaway', name: 'No takeaway all week', emoji: '🥡', xp: 30 },
  { id: 'early-night', name: 'In bed before 11, twice', emoji: '🌙', xp: 20 },
  { id: 'swim-or-sauna', name: 'Swim, sauna or cold shower', emoji: '🧊', xp: 20 },
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
