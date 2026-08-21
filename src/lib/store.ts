// The board on this device.
//
// The shared board lives on the server now, but this file still matters: it
// holds the last copy this phone saw, so the app opens instantly and keeps
// working in a basement with no signal. Every function here is a pure change
// to the state; what gets sent to the server is worked out by diffing the
// before and after in sync.ts, which means none of the taps in the interface
// need to know a server exists.

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

const KEY = 'bragging-rights-v2';

let counter = 1;
export const newId = () => `h${Date.now().toString(36)}${counter++}`;

/**
 * What the app shows before the first board arrives: the two names and
 * nothing else. The habits are seeded once by the database, with readable ids,
 * so both phones always mean the same habit by the same id.
 */
export function emptyState(): GameState {
  return {
    players: [
      { id: 'p1', name: 'ED', emoji: '', colour: '#FFB224' },
      { id: 'p2', name: 'ALFIE', emoji: '', colour: '#46C7F0' },
    ],
    habits: [],
    completions: [],
    history: [],
    proposals: [],
  };
}

export function load(): GameState {
  if (typeof window === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.players || !parsed.habits) return emptyState();
    return sealPastWeeks(parsed);
  } catch {
    return emptyState();
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
 * headline gets written once. Both phones compute the same numbers from the
 * same rows, so sealing on both is the same answer written twice.
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
    const p1 = weekXp(state, 'p1', monday);
    const p2 = weekXp(state, 'p2', monday);
    // A week nobody scored in is not a draw, it is a week nobody played. It
    // would otherwise land in the ledger as 0-0 and count as an honours-even
    // week in the record, which is exactly wrong: logging a ciggie and
    // nothing else is not a tie.
    if (p1 === 0 && p2 === 0) continue;
    history.push({ weekOf: monday, p1, p2 });
  }
  return { ...state, history };
}

/**
 * Set a day's tick count for one player on one habit (upsert).
 * The count is absolute, never a delta, which is what makes it safe to send
 * again once the signal comes back.
 *
 * Changing the count clears any hand-entered spend for that day: the number of
 * units changed, so the habit's usual price applies again. Use setSpend to say
 * what was actually paid.
 */
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

/** Record what a day actually cost, when it was not the usual price. */
export function setSpend(
  state: GameState,
  habitId: string,
  playerId: Player['id'],
  date: string,
  pence: number | null,
): GameState {
  return {
    ...state,
    completions: state.completions.map(c =>
      c.habitId === habitId && c.playerId === playerId && c.date === date
        ? pence === null
          ? { habitId: c.habitId, playerId: c.playerId, date: c.date, count: c.count }
          : { ...c, spentPence: Math.max(0, Math.round(pence)) }
        : c,
    ),
  };
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

/** Set the price of one unit of a habit that costs money, in pence. */
export function setUnitCost(state: GameState, habitId: string, pence: number | null): GameState {
  return {
    ...state,
    habits: state.habits.map(h => {
      if (h.id !== habitId) return h;
      const next: Habit = { ...h };
      if (pence === null) delete next.unitCost;
      else next.unitCost = Math.max(0, Math.round(pence));
      return next;
    }),
  };
}
