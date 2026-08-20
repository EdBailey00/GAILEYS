// Keeping two phones on one board.
//
// The app never speaks to the server in the middle of a tap. It changes the
// board locally, works out what changed, and drops those changes in an outbox
// that empties whenever there is signal. Every operation carries an absolute
// value ("gym is 2 this Tuesday", never "+1"), which is what makes replaying
// the outbox after a tunnel, a gym session in flight mode or a dead battery
// safe rather than a guess.

import type { GameState, Habit, Player, Proposal } from './game';
import { send } from './remote';

export type Op =
  | { t: 'completion.set'; habitId: string; playerId: Player['id']; date: string; count: number; spentPence?: number }
  | { t: 'completion.del'; habitId: string; playerId: Player['id']; date: string }
  | { t: 'streak.set'; habitId: string; playerId: Player['id']; startedOn: string; best: number }
  | { t: 'habit.set'; habit: Habit }
  | { t: 'history.set'; weekOf: string; p1: number; p2: number }
  | { t: 'proposal.set'; proposal: Proposal }
  | { t: 'proposal.del'; id: string }
  | { t: 'player.set'; id: Player['id']; name: string; emoji: string; colour: string };

const cellKey = (habitId: string, playerId: string, date: string) => `${habitId}|${playerId}|${date}`;
const pairKey = (habitId: string, playerId: string) => `${habitId}|${playerId}`;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What changed between two boards, as rows to send. Deriving this from the
 * state means every existing mutation syncs without its call site knowing the
 * server exists.
 */
export function diff(before: GameState, after: GameState): Op[] {
  const ops: Op[] = [];

  for (const p of after.players) {
    const was = before.players.find(x => x.id === p.id);
    if (!was || !same(was, p)) {
      ops.push({ t: 'player.set', id: p.id, name: p.name, emoji: p.emoji, colour: p.colour });
    }
  }

  const habitsBefore = new Map(before.habits.map(h => [h.id, h]));
  for (const h of after.habits) {
    if (!same(habitsBefore.get(h.id), h)) ops.push({ t: 'habit.set', habit: h });
  }

  const cellsBefore = new Map(
    before.completions.map(c => [cellKey(c.habitId, c.playerId, c.date), c]),
  );
  const cellsAfter = new Map(
    after.completions.map(c => [cellKey(c.habitId, c.playerId, c.date), c]),
  );
  for (const [key, c] of cellsAfter) {
    if (!same(cellsBefore.get(key), c)) {
      ops.push({
        t: 'completion.set',
        habitId: c.habitId,
        playerId: c.playerId,
        date: c.date,
        count: c.count,
        spentPence: c.spentPence,
      });
    }
  }
  for (const [key, c] of cellsBefore) {
    if (!cellsAfter.has(key)) {
      ops.push({ t: 'completion.del', habitId: c.habitId, playerId: c.playerId, date: c.date });
    }
  }

  const streaksBefore = new Map(
    before.streaks.map(s => [pairKey(s.habitId, s.playerId), s]),
  );
  for (const s of after.streaks) {
    const key = pairKey(s.habitId, s.playerId);
    if (!same(streaksBefore.get(key), s)) {
      ops.push({
        t: 'streak.set',
        habitId: s.habitId,
        playerId: s.playerId,
        startedOn: s.startedOn,
        best: s.best,
      });
    }
  }

  const historyBefore = new Map(before.history.map(w => [w.weekOf, w]));
  for (const w of after.history) {
    if (!same(historyBefore.get(w.weekOf), w)) {
      ops.push({ t: 'history.set', weekOf: w.weekOf, p1: w.p1, p2: w.p2 });
    }
  }

  const proposalsBefore = new Map(before.proposals.map(p => [p.id, p]));
  for (const p of after.proposals) {
    if (!same(proposalsBefore.get(p.id), p)) ops.push({ t: 'proposal.set', proposal: p });
  }
  const proposalIdsAfter = new Set(after.proposals.map(p => p.id));
  for (const p of before.proposals) {
    if (!proposalIdsAfter.has(p.id)) ops.push({ t: 'proposal.del', id: p.id });
  }

  return ops;
}

/** The row each operation is about, so later words replace earlier ones. */
function target(op: Op): string {
  switch (op.t) {
    case 'completion.set':
    case 'completion.del':
      return `c|${op.habitId}|${op.playerId}|${op.date}`;
    case 'streak.set':
      return `s|${op.habitId}|${op.playerId}`;
    case 'habit.set':
      return `h|${op.habit.id}`;
    case 'history.set':
      return `w|${op.weekOf}`;
    case 'proposal.set':
      return `p|${op.proposal.id}`;
    case 'proposal.del':
      return `p|${op.id}`;
    case 'player.set':
      return `pl|${op.id}`;
  }
}

/**
 * Squash a backlog. Because every operation is an absolute value, the last
 * word about a row is the only one worth sending: tapping the gym five times
 * on the train is one row when the signal comes back, not five.
 */
export function compact(ops: Op[]): Op[] {
  const byTarget = new Map<string, Op>();
  for (const op of ops) byTarget.set(target(op), op);
  return [...byTarget.values()];
}

// --- the outbox ---------------------------------------------------------------

const OUTBOX_KEY = 'bragging-rights-outbox-v1';

function read(): Op[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as Op[];
  } catch {
    return [];
  }
}

function write(ops: Op[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(ops));
}

/** How many changes are still waiting for signal. */
export function pending(): number {
  return read().length;
}

/** Put changes in the outbox. They survive the app being closed. */
export function queue(ops: Op[]): void {
  if (ops.length === 0) return;
  write(compact([...read(), ...ops]));
}

/**
 * A rejection the server will give every time: a broken constraint, or a row
 * this player is not allowed to write. Retrying it forever would wedge the
 * queue behind it, so it is dropped. Anything else (no signal, an expired
 * token, a timeout) is kept and tried again.
 */
function permanent(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  return typeof code === 'string' && (code.startsWith('42') || code.startsWith('23'));
}

let flushing: Promise<void> | null = null;

/**
 * Empty the outbox, oldest first, stopping at the first change that could not
 * be sent so nothing is sent out of order. Safe to call whenever: it is a
 * no-op when the outbox is empty and it never runs twice at once.
 */
export function flush(): Promise<void> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      let ops = compact(read());
      while (ops.length > 0) {
        const [head, ...rest] = ops;
        try {
          await send(head);
        } catch (e) {
          if (!permanent(e)) return; // no signal: keep it, try later
          console.warn('Dropping a change the server will never accept', head, e);
        }
        ops = rest;
        write(ops);
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
