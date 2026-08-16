// Device storage for the model. One JSON blob in localStorage, loaded once
// and saved on every change. The whole game state goes through here so a
// shared backend later is a swap of this file, not a rewrite of the app.

import {
  type GameState,
  type Habit,
  type Completion,
  type Player,
  type Proposal,
  today,
  weekDates,
  weekOf,
  weekXp,
} from './game';

const KEY = 'bragging-rights-v1';

let counter = 1;
export const newId = () => `h${Date.now().toString(36)}${counter++}`;

/** The starting habit list - the things the brothers actually named. */
function seedHabits(): Habit[] {
  return [
    ...simpleHabits(),
    { id: newId(), name: 'Ate 3 meals', emoji: '🍳', kind: 'multi', target: 3, xp: 5 },
    { id: newId(), name: 'Ate good today', emoji: '🥦', kind: 'daily', target: 1, xp: 10 },
    { id: newId(), name: 'Cooked dinner', emoji: '👨‍🍳', kind: 'daily', target: 1, xp: 15 },
    { id: newId(), name: 'Dishes done', emoji: '🍽️', kind: 'daily', target: 1, xp: 10 },
    { id: newId(), name: 'Washing done', emoji: '🧺', kind: 'weekly', target: 2, xp: 15 },
    ...choreHabits(),
    { id: newId(), name: 'Watered the plants', emoji: '🪴', kind: 'weekly', target: 2, xp: 10 },
    { id: newId(), name: 'Gym', emoji: '🏋️', kind: 'weekly', target: 3, xp: 20 },
    { id: newId(), name: '5km run', emoji: '🏃', kind: 'weekly', target: 1, xp: 25 },
    { id: newId(), name: 'Climbing', emoji: '🧗', kind: 'weekly', target: 1, xp: 25 },
    { id: newId(), name: 'Days without beer', emoji: '🍺', kind: 'streak', target: 1, xp: 10 },
    { id: newId(), name: 'Days without drugs', emoji: '🚫', kind: 'streak', target: 1, xp: 15 },
    { id: newId(), name: 'Ciggies', emoji: '🚬', kind: 'tally', target: 0, xp: 10 },
    ...alfieHabits(),
  ];
}

/** The simple things. Small points, every day, for both - they count most. */
function simpleHabits(): Habit[] {
  return [
    { id: newId(), name: 'Drank water', emoji: '💧', kind: 'daily', target: 1, xp: 5 },
    { id: newId(), name: 'Made the bed', emoji: '🛌', kind: 'daily', target: 1, xp: 5 },
    { id: newId(), name: 'Got outside', emoji: '🌤️', kind: 'daily', target: 1, xp: 5 },
  ];
}

/** Alfie's own board - only he sees these, only he scores them. */
function alfieHabits(): Habit[] {
  return [
    { id: newId(), name: "Worked from Ed's room", emoji: '💻', kind: 'daily', target: 1, xp: 10, owner: 'p2' },
    { id: newId(), name: 'Ate something', emoji: '🍞', kind: 'daily', target: 1, xp: 10, owner: 'p2' },
  ];
}

/** The chores, each its own tick - six quick wins, not one vague blob. */
function choreHabits(): Habit[] {
  return [
    { id: newId(), name: 'Hoovered', emoji: '🌀', kind: 'weekly', target: 1, xp: 10 },
    { id: newId(), name: 'Bins out', emoji: '🗑️', kind: 'weekly', target: 1, xp: 5 },
    { id: newId(), name: 'Bathroom cleaned', emoji: '🛁', kind: 'weekly', target: 1, xp: 15 },
    { id: newId(), name: 'Kitchen wiped down', emoji: '🧽', kind: 'weekly', target: 2, xp: 10 },
    { id: newId(), name: 'Bedsheets changed', emoji: '🛏️', kind: 'weekly', target: 1, xp: 10 },
    { id: newId(), name: 'Floors mopped', emoji: '🧴', kind: 'weekly', target: 1, xp: 10 },
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
      { id: 'p1', name: 'ED', emoji: '', colour: '#FFB224' },
      { id: 'p2', name: 'ALFIE', emoji: '', colour: '#46C7F0' },
    ],
    habits,
    completions: [],
    streaks,
    history: [],
    proposals: [],
  };
}

export function load(): GameState {
  if (typeof window === 'undefined') return freshState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.players || !parsed.habits) return freshState();
    return sealPastWeeks(migrate(parsed));
  } catch {
    return freshState();
  }
}

/**
 * Bring a board saved by an older build up to date. Only placeholder names
 * are touched - anything the brothers typed themselves stays theirs.
 */
function migrate(state: GameState): GameState {
  let next = state;
  // Boards saved before the confirmation system have no proposals list.
  if (!next.proposals) next = { ...next, proposals: [] };
  // The first release seeded p2 as 'Bro' before Alfie was Alfie.
  if (next.players[1].name === 'Bro' || next.players[1].name === 'ALFIE'.toLowerCase()) {
    next = {
      ...next,
      players: [next.players[0], { ...next.players[1], name: 'ALFIE' }] as GameState['players'],
    };
  }
  // Habits added after launch (the simple things, the separate chores,
  // Alfie's personal board): create what is missing, matched by name so
  // re-running never duplicates.
  const have = new Set(next.habits.map(h => h.name.toLowerCase()));
  const missing = [...simpleHabits(), ...choreHabits(), ...alfieHabits()].filter(
    h => !have.has(h.name.toLowerCase()),
  );
  if (missing.length > 0) next = { ...next, habits: [...next.habits, ...missing] };
  // The one vague chore blob the separates replace.
  if (next.habits.some(h => h.name === 'Tidy / chores' && !h.archived)) {
    next = {
      ...next,
      habits: next.habits.map(h => (h.name === 'Tidy / chores' ? { ...h, archived: true } : h)),
    };
  }
  return next;
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

/**
 * Take back the most recent tick of the week - a Tuesday mis-tap is still
 * undoable on Wednesday. Ticks are found newest-first within the week.
 */
export function untickWeek(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  monday: string,
): GameState {
  const days = new Set(weekDates(monday));
  const latest = state.completions
    .filter(c => c.habitId === habitId && c.playerId === playerId && days.has(c.date) && c.count > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!latest) return state;
  return setTicks(state, habitId, playerId, latest.date, latest.count - 1);
}

/** Take back a challenge claim, whichever day this week it was tapped on. */
export function unclaimChallenge(
  state: GameState,
  challengeKeyId: string,
  playerId: Player['id'],
  monday: string,
): GameState {
  const days = new Set(weekDates(monday));
  return {
    ...state,
    completions: state.completions.filter(
      c => !(c.habitId === challengeKeyId && c.playerId === playerId && days.has(c.date)),
    ),
  };
}

/**
 * Put a shared-board change in front of the other brother. Nothing happens
 * to the board until they say yes.
 */
export function propose(state: GameState, proposal: Omit<Proposal, 'id'>): GameState {
  return { ...state, proposals: [...state.proposals, { ...proposal, id: newId() }] };
}

/** The other brother said yes: apply the change and clear the proposal. */
export function acceptProposal(state: GameState, proposalId: string): GameState {
  const p = state.proposals.find(x => x.id === proposalId);
  if (!p) return state;
  let next: GameState = { ...state, proposals: state.proposals.filter(x => x.id !== proposalId) };
  if (p.kind === 'add' && p.habit) {
    next = { ...next, habits: [...next.habits, p.habit] };
    if (p.habit.kind === 'streak') {
      next = {
        ...next,
        streaks: [
          ...next.streaks,
          { habitId: p.habit.id, playerId: 'p1', startedOn: today(), best: 0 },
          { habitId: p.habit.id, playerId: 'p2', startedOn: today(), best: 0 },
        ],
      };
    }
  }
  if (p.kind === 'retire' && p.habitId) {
    next = {
      ...next,
      habits: next.habits.map(h => (h.id === p.habitId ? { ...h, archived: true } : h)),
    };
  }
  if (p.kind === 'edit' && p.habit) {
    const edited = p.habit;
    next = {
      ...next,
      habits: next.habits.map(h => (h.id === edited.id ? edited : h)),
    };
  }
  return next;
}

/** The other brother said no. The proposal disappears, the board stands. */
export function rejectProposal(state: GameState, proposalId: string): GameState {
  return { ...state, proposals: state.proposals.filter(x => x.id !== proposalId) };
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
