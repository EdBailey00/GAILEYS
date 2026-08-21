'use client';

// The counters, in two places and two sizes.
//
// On the board they are three big circles and nothing else, because the moment
// you actually log one is the moment you are reaching for it: one tap, done,
// phone back in pocket. Everything you might want to read about them - how
// long since, how many this week, what it has cost - is a page away, because
// none of it is what you need while you are lighting one.

import type { GameState, Habit, Player } from '@/lib/game';
import { cleanRun, ticksOn } from '@/lib/game';
import { setTicks } from '@/lib/store';
import { Tracker } from './Tracker';

export function CounterCircles({
  state,
  counters,
  who,
  canTick,
  today,
  onChange,
  onPop,
  onOpen,
}: {
  state: GameState;
  counters: Habit[];
  who: Player['id'];
  canTick: boolean;
  today: string;
  onChange: (next: GameState) => void;
  onPop: (e: React.MouseEvent, text: string) => void;
  onOpen: () => void;
}) {
  if (counters.length === 0) return null;
  const me = state.players.find(p => p.id === who)!;

  return (
    <div className="mt-5">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${counters.length}, minmax(0, 1fr))` }}>
        {counters.map(habit => {
          const todayCount = ticksOn(state, habit.id, who, today);
          const since = cleanRun(state, habit.id, who, today);
          return (
            <div key={habit.id} className="flex flex-col items-center">
              <button
                onClick={e => {
                  if (!canTick) return;
                  onChange(setTicks(state, habit.id, who, today, todayCount + 1));
                  onPop(e, '+1');
                }}
                disabled={!canTick}
                aria-label={`One more ${habit.name}`}
                className="flex aspect-square w-full items-center justify-center rounded-full border-2 text-3xl transition-transform active:scale-95 disabled:opacity-40"
                style={{
                  borderColor: todayCount > 0 ? me.colour : 'var(--dust)',
                  background: todayCount > 0 ? 'var(--board-raised)' : 'transparent',
                }}
              >
                <span className="flex flex-col items-center leading-none">
                  <span>{habit.emoji}</span>
                  <span className="font-score mt-1 text-base font-black" style={{ color: me.colour }}>
                    {todayCount > 0 ? todayCount : ''}
                  </span>
                </span>
              </button>
              <span className="font-score mt-1.5 text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
                {since}d since
              </span>
              {todayCount > 0 && canTick ? (
                <button
                  onClick={() => onChange(setTicks(state, habit.id, who, today, todayCount - 1))}
                  className="font-score text-[10px] underline-offset-2 hover:underline"
                  style={{ color: 'var(--chalk-dim)' }}
                >
                  − one back
                </button>
              ) : (
                <span className="text-[10px]">&nbsp;</span>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={onOpen}
        className="font-score mt-2 w-full text-center text-[11px] underline-offset-2 hover:underline"
        style={{ color: 'var(--chalk-dim)' }}
      >
        the counters in full ›
      </button>
    </div>
  );
}

export function CountersPage({
  state,
  counters,
  who,
  canTick,
  today,
  monday,
  onChange,
}: {
  state: GameState;
  counters: Habit[];
  who: Player['id'];
  canTick: boolean;
  today: string;
  monday: string;
  onChange: (next: GameState) => void;
}) {
  if (counters.length === 0) {
    return (
      <p className="mt-6 text-sm leading-snug" style={{ color: 'var(--chalk-dim)' }}>
        No counters yet. Add one under players &amp; habits, as a counter, and it lands here.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-2">
      {counters.map(habit => (
        <Tracker
          key={habit.id}
          state={state}
          habit={habit}
          who={who}
          canTick={canTick}
          today={today}
          monday={monday}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
