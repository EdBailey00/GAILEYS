import { describe, expect, test } from 'vitest';
import {
  type GameState,
  type Habit,
  bestCleanRun,
  cleanRun,
  lastUseDate,
  spentPence,
  weekXp,
} from './game';

/** A board with one tally habit and nothing else in the way. */
function boardWith(habit: Partial<Habit>, logs: Array<[string, number, number?]>): GameState {
  const h: Habit = {
    id: 'h-ket',
    name: 'Ketamine',
    emoji: '',
    kind: 'tally',
    target: 0,
    xp: 15,
    ...habit,
  };
  return {
    players: [
      { id: 'p1', name: 'ED', emoji: '', colour: '#000' },
      { id: 'p2', name: 'ALFIE', emoji: '', colour: '#fff' },
    ],
    habits: [h],
    completions: logs.map(([date, count, pence]) => ({
      habitId: h.id,
      playerId: 'p1' as const,
      date,
      count,
      ...(pence === undefined ? {} : { spentPence: pence }),
    })),
    streaks: [],
    history: [],
    proposals: [],
  };
}

describe('lastUseDate', () => {
  test('finds the most recent day with a use on it', () => {
    const state = boardWith({}, [
      ['2026-08-01', 2],
      ['2026-08-09', 1],
      ['2026-08-05', 3],
    ]);
    expect(lastUseDate(state, 'h-ket', 'p1')).toBe('2026-08-09');
  });

  test('is null when every log is a clean day', () => {
    const state = boardWith({}, [
      ['2026-08-01', 0],
      ['2026-08-02', 0],
    ]);
    expect(lastUseDate(state, 'h-ket', 'p1')).toBeNull();
  });
});

describe('cleanRun', () => {
  test('counts the days since the last use', () => {
    const state = boardWith({}, [['2026-08-10', 1]]);
    expect(cleanRun(state, 'h-ket', 'p1', '2026-08-20')).toBe(10);
  });

  test('counts from the first log when there has never been a use', () => {
    const state = boardWith({}, [
      ['2026-08-13', 0],
      ['2026-08-18', 0],
    ]);
    expect(cleanRun(state, 'h-ket', 'p1', '2026-08-20')).toBe(7);
  });

  test('is zero when nothing has been logged at all', () => {
    const state = boardWith({}, []);
    expect(cleanRun(state, 'h-ket', 'p1', '2026-08-20')).toBe(0);
  });
});

describe('bestCleanRun', () => {
  test('remembers the longest gap between two uses', () => {
    const state = boardWith({}, [
      ['2026-07-01', 1],
      ['2026-07-21', 1], // a 20 day run, the best
      ['2026-07-26', 1], // then only 5
    ]);
    expect(bestCleanRun(state, 'h-ket', 'p1', '2026-07-30')).toBe(20);
  });

  test('counts the run happening right now when it is the longest', () => {
    const state = boardWith({}, [
      ['2026-07-01', 1],
      ['2026-07-06', 1],
    ]);
    expect(bestCleanRun(state, 'h-ket', 'p1', '2026-08-20')).toBe(45);
  });
});

describe('spentPence', () => {
  test('multiplies the count by the price of one unit', () => {
    const state = boardWith({ unitCost: 2500 }, [['2026-08-10', 2]]);
    expect(spentPence(state, 'h-ket', 'p1', '2026-08-01', '2026-08-31')).toBe(5000);
  });

  test('prefers what was actually spent when the log records it', () => {
    const state = boardWith({ unitCost: 2500 }, [['2026-08-10', 2, 4000]]);
    expect(spentPence(state, 'h-ket', 'p1', '2026-08-01', '2026-08-31')).toBe(4000);
  });

  test('ignores days outside the range', () => {
    const state = boardWith({ unitCost: 2500 }, [
      ['2026-07-31', 1],
      ['2026-08-10', 1],
      ['2026-09-01', 1],
    ]);
    expect(spentPence(state, 'h-ket', 'p1', '2026-08-01', '2026-08-31')).toBe(2500);
  });

  test('is zero when no price has been set yet', () => {
    const state = boardWith({}, [['2026-08-10', 2]]);
    expect(spentPence(state, 'h-ket', 'p1', '2026-08-01', '2026-08-31')).toBe(0);
  });
});

describe('weekXp for a clean day', () => {
  test('pays more for a clean day deep into a run', () => {
    // Last use 38 days before, so the clean day is past the month mark: x2.
    const long = boardWith({}, [
      ['2026-07-10', 1],
      ['2026-08-17', 0],
    ]);
    // Used on the Sunday, so Monday is day 1: no multiplier.
    const short = boardWith({}, [
      ['2026-08-16', 1],
      ['2026-08-17', 0],
    ]);
    expect(weekXp(long, 'p1', '2026-08-17', '2026-08-17')).toBe(30);
    expect(weekXp(short, 'p1', '2026-08-17', '2026-08-17')).toBe(15);
  });
});
