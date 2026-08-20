// Reading and writing the shared board.
//
// One file, one job: turn database rows into the GameState the rest of the app
// already understands, and turn outbox operations into row writes. Nothing in
// here knows about React, and nothing above here knows about SQL.

import type {
  Completion,
  GameState,
  Habit,
  Player,
  Proposal,
  StreakState,
  WeekResult,
} from './game';
import type { Op } from './sync';
import { supabase } from './supabase';

interface PlayerRow {
  id: 'p1' | 'p2';
  name: string;
  emoji: string;
  colour: string;
}

interface HabitRow {
  id: string;
  name: string;
  detail: string | null;
  emoji: string;
  kind: Habit['kind'];
  target: number;
  xp: number;
  owner: 'p1' | 'p2' | null;
  archived: boolean;
  unit_cost_pence: number | null;
  sort: number;
}

interface CompletionRow {
  habit_id: string;
  player_id: 'p1' | 'p2';
  date: string;
  count: number;
  spent_pence: number | null;
}

interface StreakRow {
  habit_id: string;
  player_id: 'p1' | 'p2';
  started_on: string;
  best: number;
}

interface HistoryRow {
  week_of: string;
  p1: number;
  p2: number;
}

interface ProposalRow {
  id: string;
  by: 'p1' | 'p2';
  kind: Proposal['kind'];
  habit: Habit | null;
  habit_id: string | null;
}

/** Which brother is signed in on this device, or null if none yet. */
export async function myPlayer(): Promise<Player['id'] | null> {
  const { data, error } = await supabase.rpc('current_player');
  if (error) throw error;
  return (data as Player['id'] | null) ?? null;
}

/** Take a player, once, if the email is on the board and the seat is free. */
export async function claimPlayer(playerId: Player['id']): Promise<void> {
  const { error } = await supabase.rpc('claim_player', { p_player: playerId });
  if (error) throw error;
}

/** The whole board. It is a few kilobytes, so there is nothing to page. */
export async function pull(): Promise<GameState> {
  const [players, habits, completions, streaks, history, proposals] = await Promise.all([
    supabase.from('players').select('id, name, emoji, colour').order('id'),
    supabase
      .from('habits')
      .select('id, name, detail, emoji, kind, target, xp, owner, archived, unit_cost_pence, sort')
      .order('sort'),
    supabase.from('completions').select('habit_id, player_id, date, count, spent_pence'),
    supabase.from('streaks').select('habit_id, player_id, started_on, best'),
    supabase.from('history').select('week_of, p1, p2').order('week_of'),
    supabase.from('proposals').select('id, by, kind, habit, habit_id'),
  ]);

  const failed = [players, habits, completions, streaks, history, proposals].find(r => r.error);
  if (failed?.error) throw failed.error;

  const playerRows = (players.data ?? []) as PlayerRow[];
  const mapped: GameState = {
    players: [
      playerRows.find(p => p.id === 'p1') ?? { id: 'p1', name: 'ED', emoji: '', colour: '#FFB224' },
      playerRows.find(p => p.id === 'p2') ?? { id: 'p2', name: 'ALFIE', emoji: '', colour: '#46C7F0' },
    ],
    habits: ((habits.data ?? []) as HabitRow[]).map(toHabit),
    completions: ((completions.data ?? []) as CompletionRow[]).map(toCompletion),
    streaks: ((streaks.data ?? []) as StreakRow[]).map(toStreak),
    history: ((history.data ?? []) as HistoryRow[]).map(toWeek),
    proposals: ((proposals.data ?? []) as ProposalRow[]).map(toProposal),
  };
  return mapped;
}

function toHabit(r: HabitRow): Habit {
  const h: Habit = {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    kind: r.kind,
    target: r.target,
    xp: r.xp,
  };
  if (r.detail) h.detail = r.detail;
  if (r.owner) h.owner = r.owner;
  if (r.archived) h.archived = true;
  if (r.unit_cost_pence !== null) h.unitCost = r.unit_cost_pence;
  return h;
}

function toCompletion(r: CompletionRow): Completion {
  const c: Completion = {
    habitId: r.habit_id,
    playerId: r.player_id,
    date: r.date,
    count: r.count,
  };
  if (r.spent_pence !== null) c.spentPence = r.spent_pence;
  return c;
}

const toStreak = (r: StreakRow): StreakState => ({
  habitId: r.habit_id,
  playerId: r.player_id,
  startedOn: r.started_on,
  best: r.best,
});

const toWeek = (r: HistoryRow): WeekResult => ({ weekOf: r.week_of, p1: r.p1, p2: r.p2 });

const toProposal = (r: ProposalRow): Proposal => ({
  id: r.id,
  by: r.by,
  kind: r.kind,
  ...(r.habit ? { habit: r.habit } : {}),
  ...(r.habit_id ? { habitId: r.habit_id } : {}),
});

/**
 * Send one operation. Every one is an upsert or a delete keyed on the row's
 * own identity, so sending it twice is the same as sending it once. That is
 * what lets the outbox be replayed without thought.
 */
export async function send(op: Op): Promise<void> {
  switch (op.t) {
    case 'completion.set': {
      const { error } = await supabase.from('completions').upsert(
        {
          habit_id: op.habitId,
          player_id: op.playerId,
          date: op.date,
          count: op.count,
          spent_pence: op.spentPence ?? null,
        },
        { onConflict: 'habit_id,player_id,date' },
      );
      if (error) throw error;
      return;
    }
    case 'completion.del': {
      const { error } = await supabase
        .from('completions')
        .delete()
        .eq('habit_id', op.habitId)
        .eq('player_id', op.playerId)
        .eq('date', op.date);
      if (error) throw error;
      return;
    }
    case 'streak.set': {
      const { error } = await supabase.from('streaks').upsert(
        {
          habit_id: op.habitId,
          player_id: op.playerId,
          started_on: op.startedOn,
          best: op.best,
        },
        { onConflict: 'habit_id,player_id' },
      );
      if (error) throw error;
      return;
    }
    case 'habit.set': {
      const h = op.habit;
      const { error } = await supabase.from('habits').upsert({
        id: h.id,
        name: h.name,
        detail: h.detail ?? null,
        emoji: h.emoji,
        kind: h.kind,
        target: h.target,
        xp: h.xp,
        owner: h.owner ?? null,
        archived: h.archived ?? false,
        unit_cost_pence: h.unitCost ?? null,
      });
      if (error) throw error;
      return;
    }
    case 'history.set': {
      const { error } = await supabase
        .from('history')
        .upsert({ week_of: op.weekOf, p1: op.p1, p2: op.p2 });
      if (error) throw error;
      return;
    }
    case 'proposal.set': {
      const p = op.proposal;
      const { error } = await supabase.from('proposals').upsert({
        id: p.id,
        by: p.by,
        kind: p.kind,
        habit: p.habit ?? null,
        habit_id: p.habitId ?? null,
      });
      if (error) throw error;
      return;
    }
    case 'proposal.del': {
      const { error } = await supabase.from('proposals').delete().eq('id', op.id);
      if (error) throw error;
      return;
    }
    case 'player.set': {
      const { error } = await supabase
        .from('players')
        .update({ name: op.name, emoji: op.emoji, colour: op.colour })
        .eq('id', op.id);
      if (error) throw error;
      return;
    }
  }
}

/** Tell me when anything on the board changes, on any device. */
export function watch(onChange: () => void): () => void {
  const channel = supabase
    .channel('board')
    .on('postgres_changes', { event: '*', schema: 'public' }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
