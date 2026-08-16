// Device storage for the model. One JSON blob in localStorage, loaded once
// and saved on every change. The whole game state goes through here so a
// shared backend later is a swap of this file, not a rewrite of the app.

import {
  type GameState,
  type Habit,
  type Completion,
  type Player,
  today,
  weekOf,
  weekXp,
} from './game';

const KEY = 'bragging-rights-v1';

let counter = 1;
export const newId = () => `h${Date.now().toString(36)}${counter++}`;

/** The starting habit list - the things the brothers actually named. */
function seedHabits(): Habit[] {
  return [
    { id: newId(), name: 'Ate 3 meals', emoji: '🍳', kind: 'multi', target: 3, xp: 5 },
    { id: newId(), name: 'Ate good today', emoji: '🥦', kind: 'daily', target: 1, xp: 10 },
    { id: newId(), name: 'Cooked dinner', emoji: '👨‍🍳', kind: 'daily', target: 1, xp: 15 },
    { id: newId(), name: 'Dishes done', emoji: '🍽️', kind: 'daily', target: 1, xp: 10 },
    { id: newId(), name: 'Washing done', emoji: '🧺', kind: 'weekly', target: 2, xp: 15 },
    { id: newId(), name: 'Tidy / chores', emoji: '🧹', kind: 'weekly', target: 3, xp: 15 },
    { id: newId(), name: 'Watered the plants', emoji: '🪴', kind: 'weekly', target: 2, xp: 10 },
    { id: newId(), name: 'Gym', emoji: '🏋️', kind: 'weekly', target: 3, xp: 20 },
    { id: newId(), name: '5km run', emoji: '🏃', kind: 'weekly', target: 1, xp: 25 },
    { id: newId(), name: 'Climbing', emoji: '🧗', kind: 'weekly', target: 1, xp: 25 },
    { id: newId(), name: 'Days without beer', emoji: '🍺', kind: 'streak', target: 1, xp: 10 },
    { id: newId(), name: 'Days without drugs', emoji: '🚫', kind: 'streak', target: 1, xp: 15 },
    { id: newId(), name: 'Ciggies', emoji: '🚬', kind: 'tally', target: 0, xp: 10 },
  ];
}

export function freshState(): GameState {
  const start = today();
  const habits = seedHabits();
  const streaks = habits
    .filter(h => h.kind === 'streak')
    .flatMap(h => (['p1', 'p2'] as const).map(playerId => ({
      habitId: h.id,
      playerId,
      startedOn: start,
      best: 0,
    })));
  return {
    players: [
      { id: 'p1', name: 'Ed', emoji: '🦁', colour: '#FFB224' },
      { id: 'p2', name: 'Bro', emoji: '🐻', colour: '#46C7F0' },
    ],
    habits,
    completions: [],
    streaks,
    history: [],
  };
}

export function load(): GameState {
  if (typeof window === 'undefined') return freshState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.players || !parsed.habits) return freshState();
    return sealPastWeeks(parsed);
  } catch {
    return freshState();
  }
}

export function save(state: GameState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
}

/**
 * Seal any finished weeks into history on load, so the race resets each
 * Monday and past weeks become the permanent bragging-rights ledger.
 * Completion rows for sealed weeks stay (they are the record); only the
 * headline gets written once.
 */
export function sealPastWeeks(state: GameState): GameState {
  const thisMonday = weekOf(today());
  const sealed = new Set(state.history.map(w => w.weekOf));
  const mondaysWithPlay = new Set(
    state.completions.map(c => weekOf(c.date)).filter(m => m < thisMonday && !sealed.has(m)),
  );
  if (mondaysWithPlay.size === 0) return state;
  const history = [...state.history];
  for (const monday of [...mondaysWithPlay].sort()) {
    // The week is over: XP up to its Sunday.
    const sunday = new Date(monday + 'T12:00:00');
    sunday.setDate(sunday.getDate() + 6);
    const sundayKey = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
    history.push({
      weekOf: monday,
      p1: weekXp(state, 'p1', monday, sundayKey),
      p2: weekXp(state, 'p2', monday, sundayKey),
    });
  }
  return { ...state, history };
}

/** Set a day's tick count for one player on one habit (upsert). */
export function setTicks(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  date: string,
  count: number,
): GameState {
  const rest = state.completions.filter(
    c => !(c.habitId === habitId && c.playerId === playerId && c.date === date),
  );
  const completions: Completion[] =
    count <= 0 && !isTally(state, habitId)
      ? rest
      : [...rest, { habitId, playerId, date, count: Math.max(0, count) }];
  return { ...state, completions };
}

function isTally(state: GameState, habitId: string): boolean {
  return state.habits.find(h => h.id === habitId)?.kind === 'tally';
}

/** Reset a streak to day zero, keeping the best run for the record. */
export function resetStreak(state: GameState, habitId: string, playerId: Player['id']): GameState {
  const t = today();
  const streaks = state.streaks.map(s => {
    if (s.habitId !== habitId || s.playerId !== playerId) return s;
    const run = Math.max(
      0,
      Math.round((new Date(t + 'T12:00:00').getTime() - new Date(s.startedOn + 'T12:00:00').getTime()) / 86_400_000),
    );
    return { ...s, startedOn: t, best: Math.max(s.best, run) };
  });
  return { ...state, streaks };
}
