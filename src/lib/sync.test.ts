import { describe, expect, test } from 'vitest';
import type { GameState } from './game';
import { compact, diff } from './sync';

function base(): GameState {
  return {
    players: [
      { id: 'p1', name: 'ED', emoji: '', colour: '#FFB224' },
      { id: 'p2', name: 'ALFIE', emoji: '', colour: '#46C7F0' },
    ],
    habits: [
      { id: 'h-gym', name: 'Gym, 45 minutes', emoji: '', kind: 'weekly', target: 3, xp: 20 },
    ],
    completions: [],
    history: [],
    proposals: [],
  };
}

describe('diff', () => {
  test('an unchanged board produces nothing to send', () => {
    expect(diff(base(), base())).toEqual([]);
  });

  test('a new tick becomes one completion with an absolute count', () => {
    const before = base();
    const after: GameState = {
      ...before,
      completions: [{ habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 2 }],
    };
    expect(diff(before, after)).toEqual([
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 2, spentPence: undefined },
    ]);
  });

  test('taking a tick back removes the row rather than sending a zero', () => {
    const before: GameState = {
      ...base(),
      completions: [{ habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 1 }],
    };
    const after = { ...before, completions: [] };
    expect(diff(before, after)).toEqual([
      { t: 'completion.del', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20' },
    ]);
  });

  test('a declared clean day is a real row, not an absence', () => {
    const before = base();
    const after: GameState = {
      ...before,
      completions: [{ habitId: 'h-ket', playerId: 'p1', date: '2026-08-20', count: 0 }],
    };
    expect(diff(before, after)).toEqual([
      { t: 'completion.set', habitId: 'h-ket', playerId: 'p1', date: '2026-08-20', count: 0, spentPence: undefined },
    ]);
  });

  test('what was actually spent travels with the log', () => {
    const before = base();
    const after: GameState = {
      ...before,
      completions: [{ habitId: 'h-ket', playerId: 'p1', date: '2026-08-20', count: 1, spentPence: 4000 }],
    };
    expect(diff(before, after)).toEqual([
      { t: 'completion.set', habitId: 'h-ket', playerId: 'p1', date: '2026-08-20', count: 1, spentPence: 4000 },
    ]);
  });

  test('renaming a player sends that player', () => {
    const before = base();
    const after: GameState = {
      ...before,
      players: [{ ...before.players[0], name: 'EDMUND' }, before.players[1]],
    };
    expect(diff(before, after)).toEqual([
      { t: 'player.set', id: 'p1', name: 'EDMUND', emoji: '', colour: '#FFB224' },
    ]);
  });

  test('retiring a habit sends the habit, archived', () => {
    const before = base();
    const after: GameState = {
      ...before,
      habits: [{ ...before.habits[0], archived: true }],
    };
    expect(diff(before, after)).toEqual([
      { t: 'habit.set', habit: { ...before.habits[0], archived: true } },
    ]);
  });

  test('answering a proposal sends the habit and clears the proposal', () => {
    const habit = { id: 'h-new', name: 'Swim 1km', emoji: '', kind: 'weekly' as const, target: 1, xp: 20 };
    const before: GameState = {
      ...base(),
      proposals: [{ id: 'pr1', by: 'p2', kind: 'add', habit }],
    };
    const after: GameState = {
      ...before,
      habits: [...before.habits, habit],
      proposals: [],
    };
    expect(diff(before, after)).toEqual([
      { t: 'habit.set', habit },
      { t: 'proposal.del', id: 'pr1' },
    ]);
  });

  test('a sealed week goes to the ledger', () => {
    const before = base();
    const after: GameState = {
      ...before,
      history: [{ weekOf: '2026-08-10', p1: 240, p2: 195 }],
    };
    expect(diff(before, after)).toEqual([
      { t: 'history.set', weekOf: '2026-08-10', p1: 240, p2: 195 },
    ]);
  });
});

describe('compact', () => {
  test('keeps only the last word on a cell, because counts are absolute', () => {
    const ops = compact([
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 1 },
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 2 },
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 3 },
    ]);
    expect(ops).toEqual([
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 3 },
    ]);
  });

  test('a delete after a set on the same cell wins', () => {
    const ops = compact([
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 1 },
      { t: 'completion.del', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20' },
    ]);
    expect(ops).toEqual([
      { t: 'completion.del', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20' },
    ]);
  });

  test('different cells and different days all survive', () => {
    const ops = compact([
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-20', count: 1 },
      { t: 'completion.set', habitId: 'h-gym', playerId: 'p1', date: '2026-08-19', count: 1 },
      { t: 'completion.set', habitId: 'h-run5k', playerId: 'p1', date: '2026-08-20', count: 1 },
    ]);
    expect(ops).toHaveLength(3);
  });

  test('keeps the order the taps happened in', () => {
    const ops = compact([
      { t: 'habit.set', habit: { id: 'h-a', name: 'A', emoji: '', kind: 'daily', target: 1, xp: 5 } },
      { t: 'completion.set', habitId: 'h-a', playerId: 'p1', date: '2026-08-20', count: 1 },
      { t: 'proposal.del', id: 'pr1' },
    ]);
    expect(ops.map(o => o.t)).toEqual(['habit.set', 'completion.set', 'proposal.del']);
  });
});
