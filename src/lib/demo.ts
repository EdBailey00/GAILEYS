'use client';

// A board to hand to somebody who wants a go.
//
// The real board has no sign-in, which is a fine trade between two brothers
// who share a kitchen and a bad one the moment the address goes any further:
// it carries what they drink, what they smoke and what that costs. So a
// stranger gets this instead - the whole app, every page, nothing real.
//
// It is not a screenshot and not a cut-down build. It is the same code with a
// different board underneath: every tap works, the numbers move, and nothing
// it does reaches the server, because in demo mode the server is never asked.

import type { GameState } from './game';
import { dayKey, weekOf } from './game';

/** ?demo on the url, and nothing else, decides this. */
export const isDemo = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

/** This tester's taps, kept apart from the real board's copy. */
export const DEMO_KEY = 'bragging-rights-demo';

const back = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dayKey(d);
};

/**
 * A board mid-week, with enough behind it that the stats page has something to
 * draw. Two invented players: nobody should be able to tell whose app this is
 * from playing with it.
 */
export function demoBoard(): GameState {
  const thisMonday = weekOf(dayKey(new Date()));
  const mondayBack = (weeks: number): string => {
    const d = new Date(`${thisMonday}T12:00:00`);
    d.setDate(d.getDate() - 7 * weeks);
    return dayKey(d);
  };

  return {
    players: [
      { id: 'p1', name: 'SAM', emoji: '', colour: '#FFB224' },
      { id: 'p2', name: 'JAMIE', emoji: '', colour: '#46C7F0' },
    ],
    habits: [
      { id: 'd-water', name: 'Drink 2L water', detail: 'four 500ml bottles', emoji: '💧', kind: 'daily', target: 1, xp: 5 },
      { id: 'd-bed', name: 'Make the bed', detail: 'before you leave the room', emoji: '🛏️', kind: 'daily', target: 1, xp: 5 },
      { id: 'd-meals', name: 'Eat 3 proper meals', detail: 'one tick per meal', emoji: '🍽️', kind: 'multi', target: 3, xp: 5 },
      { id: 'd-cook', name: 'Cook dinner', detail: 'a jar is fine, just not a microwave meal or a pizza', emoji: '👨‍🍳', kind: 'daily', target: 1, xp: 15 },
      { id: 'd-washup', name: 'Wash up and clear the sides', detail: 'sink empty before bed', emoji: '🧽', kind: 'daily', target: 1, xp: 10 },
      { id: 'd-bathroom', name: 'Clean the bathroom', detail: 'sink, toilet, shower, mirror', emoji: '🚿', kind: 'weekly', target: 1, xp: 30 },
      { id: 'd-gym', name: 'Gym', emoji: '🏋️', kind: 'weekly', target: 3, xp: 20 },
      { id: 'd-run', name: 'Run', emoji: '🏃', kind: 'weekly', target: 1, xp: 20 },
      { id: 'd-bins', name: 'Put the bins out', detail: 'on collection day, and bring them back', emoji: '🗑️', kind: 'weekly', target: 1, xp: 10 },
      { id: 'd-beers', name: 'Beers', detail: 'one tap per drink - any alcohol, not just beer', emoji: '🍺', kind: 'tally', target: 0, xp: 10, unitCost: 550 },
      { id: 'd-ciggies', name: 'Cigarettes', detail: 'one tap per cigarette', emoji: '🚬', kind: 'tally', target: 0, xp: 10 },
    ],
    completions: [
      { habitId: 'd-water', playerId: 'p1', date: back(0), count: 1 },
      { habitId: 'd-meals', playerId: 'p1', date: back(0), count: 2 },
      { habitId: 'd-cook', playerId: 'p1', date: back(1), count: 1 },
      { habitId: 'd-gym', playerId: 'p1', date: back(2), count: 1 },
      { habitId: 'd-gym', playerId: 'p2', date: back(1), count: 2 },
      { habitId: 'd-run', playerId: 'p2', date: back(3), count: 1 },
      { habitId: 'd-bathroom', playerId: 'p2', date: back(2), count: 1 },
      { habitId: 'd-beers', playerId: 'p1', date: back(9), count: 4 },
      { habitId: 'd-beers', playerId: 'p1', date: back(23), count: 6 },
      { habitId: 'd-beers', playerId: 'p2', date: back(2), count: 3 },
      { habitId: 'd-ciggies', playerId: 'p1', date: back(9), count: 7 },
      { habitId: 'd-ciggies', playerId: 'p2', date: back(0), count: 3 },
      { habitId: 'd-ciggies', playerId: 'p2', date: back(1), count: 5 },
    ],
    history: [
      { weekOf: mondayBack(4), p1: 180, p2: 140 },
      { weekOf: mondayBack(3), p1: 95, p2: 210 },
      { weekOf: mondayBack(2), p1: 240, p2: 150 },
      { weekOf: mondayBack(1), p1: 130, p2: 130 },
    ],
    proposals: [],
  };
}

/** A thread with something already in it, so the tab is not just a box. */
export const DEMO_MESSAGES = [
  { id: 'm1', by: 'p2' as const, body: 'bins are still out', at: new Date(Date.now() - 5400000).toISOString() },
  { id: 'm2', by: 'p1' as const, body: 'doing them now. did you do the bathroom?', at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'm3', by: 'p2' as const, body: 'tuesday. it is on the board', at: new Date(Date.now() - 3000000).toISOString() },
];
