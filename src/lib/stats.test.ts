import { describe, expect, test } from 'vitest';
import type { GameState, Habit } from './game';
import {
  bestWeek,
  betterThanWorstWeek,
  longestGap,
  pricedCounters,
  record,
  spend,
  weeklyUse,
  weeklyScores,
  weeksBack,
  worstWeekPence,
} from './stats';

const counter = (id: string, unitCost?: number): Habit => ({
  id,
  name: id,
  emoji: '',
  kind: 'tally',
  target: 0,
  xp: 10,
  ...(unitCost === undefined ? {} : { unitCost }),
});

function board(habits: Habit[], logs: Array<[string, string, number]>, history: GameState['history'] = []): GameState {
  return {
    players: [
      { id: 'p1', name: 'ED', emoji: '', colour: '#000' },
      { id: 'p2', name: 'ALFIE', emoji: '', colour: '#fff' },
    ],
    habits,
    completions: logs.map(([habitId, date, count]) => ({ habitId, playerId: 'p1' as const, date, count })),
    history,
    proposals: [],
  };
}

describe('weeksBack', () => {
  test('walks back a Monday at a time', () => {
    expect(weeksBack('2026-08-17', 0)).toBe('2026-08-17');
    expect(weeksBack('2026-08-17', 1)).toBe('2026-08-10');
    expect(weeksBack('2026-08-17', 5)).toBe('2026-07-13');
  });
});

describe('weeklyScores', () => {
  test('sealed weeks then the one still running', () => {
    const state = board([counter('h-ket')], [], [
      { weekOf: '2026-08-03', p1: 120, p2: 90 },
      { weekOf: '2026-08-10', p1: 60, p2: 140 },
    ]);
    const weeks = weeklyScores(state, '2026-08-19');
    expect(weeks.map(w => w.weekOf)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17']);
    // The week in progress is computed, not read from the ledger.
    expect(weeks[2]).toEqual({ weekOf: '2026-08-17', p1: 0, p2: 0 });
  });

  test('a week already sealed is not also counted as in progress', () => {
    const state = board([], [], [{ weekOf: '2026-08-17', p1: 10, p2: 10 }]);
    const weeks = weeklyScores(state, '2026-08-19');
    expect(weeks).toHaveLength(1);
    expect(weeks[0].weekOf).toBe('2026-08-17');
  });
});

describe('record', () => {
  test('counts the sealed weeks each way, draws apart', () => {
    const state = board([], [], [
      { weekOf: '2026-08-03', p1: 120, p2: 90 },
      { weekOf: '2026-08-10', p1: 60, p2: 140 },
      { weekOf: '2026-08-17', p1: 50, p2: 50 },
    ]);
    expect(record(state)).toEqual({ p1: 1, p2: 1, draws: 1 });
  });
});

describe('bestWeek', () => {
  test('the highest week on record', () => {
    const state = board([], [], [
      { weekOf: '2026-08-03', p1: 120, p2: 90 },
      { weekOf: '2026-08-10', p1: 60, p2: 140 },
    ]);
    expect(bestWeek(state, 'p1', '2026-08-19')?.weekOf).toBe('2026-08-03');
    expect(bestWeek(state, 'p2', '2026-08-19')?.weekOf).toBe('2026-08-10');
  });

  test('nothing scored yet is null, not week zero', () => {
    expect(bestWeek(board([], []), 'p1', '2026-08-19')).toBeNull();
  });
});

describe('weeklyUse', () => {
  test('one point per week, oldest first, holes filled with zero', () => {
    const state = board(
      [counter('h-ciggies')],
      [
        ['h-ciggies', '2026-08-04', 9],
        ['h-ciggies', '2026-08-18', 3],
        ['h-ciggies', '2026-08-19', 2],
      ],
    );
    expect(weeklyUse(state, 'h-ciggies', 'p1', 3, '2026-08-19')).toEqual([
      { weekOf: '2026-08-03', count: 9 },
      { weekOf: '2026-08-10', count: 0 },
      { weekOf: '2026-08-17', count: 5 },
    ]);
  });
});

describe('money', () => {
  test('a counter with no price is not in the money at all', () => {
    // Smoking carries no cost, so it contributes nothing however much is
    // logged against it.
    const state = board(
      [counter('h-ciggies'), counter('h-ket', 2500)],
      [
        ['h-ciggies', '2026-08-19', 20],
        ['h-ket', '2026-08-19', 2],
      ],
    );
    expect(pricedCounters(state).map(h => h.id)).toEqual(['h-ket']);
    expect(spend(state, 'p1', '2026-08-19')).toEqual({
      week: 5000,
      month: 5000,
      year: 5000,
      ever: 5000,
    });
  });

  test('the worst week is the week that cost the most', () => {
    const state = board(
      [counter('h-ket', 2500)],
      [
        ['h-ket', '2026-08-04', 4], // £100 that week
        ['h-ket', '2026-08-19', 1], // £25 this week
      ],
    );
    expect(worstWeekPence(state, 'h-ket', 'p1')).toBe(10000);
    expect(betterThanWorstWeek(state, 'p1', '2026-08-19')).toEqual({
      saved: 7500,
      worst: 10000,
      now: 2500,
    });
  });

  test('no priced counters means no saved number rather than a zero', () => {
    const state = board([counter('h-ciggies')], [['h-ciggies', '2026-08-19', 20]]);
    expect(betterThanWorstWeek(state, 'p1', '2026-08-19')).toBeNull();
  });
});

describe('longestGap', () => {
  test('the longest stretch between two uses, run in progress included', () => {
    const state = board(
      [counter('h-ket')],
      [
        ['h-ket', '2026-06-01', 1],
        ['h-ket', '2026-07-11', 1], // 40 days
        ['h-ket', '2026-07-20', 1], // 9 days
      ],
    );
    expect(longestGap(state, 'h-ket', 'p1', '2026-08-19')).toBe(40);
  });

  test('a run in progress can be the longest', () => {
    const state = board([counter('h-ket')], [['h-ket', '2026-06-01', 1]]);
    expect(longestGap(state, 'h-ket', 'p1', '2026-08-19')).toBe(79);
  });
});
