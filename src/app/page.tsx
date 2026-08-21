'use client';

// Bragging Rights - the brothers' scoreboard.
//
// One screen, thumb-first. The tug-of-war bar at the top is the product:
// two colours pushing against each other, the meeting point is who is
// winning the week. Everything below exists to shove it.

import { useMemo, useRef, useState } from 'react';
import {
  type GameState,
  type Habit,
  type Player,
  challengeClaimed,
  challengeKey,
  challengesFor,
  dailyCap,
  levelFor,
  ticksInWeek,
  ticksOn,
  today,
  totalXp,
  weekOf,
  weekXp,
} from '@/lib/game';
import { acceptProposal, rejectProposal, setTicks, unclaimChallenge, untickWeek } from '@/lib/store';
import { useBoard } from '@/lib/useBoard';
import { useChat } from '@/lib/chat';
import { isDemo } from '@/lib/demo';
import { ChooseBrother } from '@/components/Gate';
import { Chat } from '@/components/Chat';
import { CounterCircles, CountersPage } from '@/components/Counters';
import { Nav, type View } from '@/components/Nav';
import { Stats } from '@/components/Stats';
import { Manage, SectionTitle } from '@/components/Manage';
import { UpdateBanner } from '@/components/Update';
import { VERSION } from '@/lib/version';

// A floating "+10" that rises off whatever was tapped.
interface FloatScore {
  id: number;
  x: number;
  y: number;
  text: string;
}

export default function Page() {
  const board = useBoard();
  const { state, update } = board;
  const chat = useChat(board.me);
  // Which board is on screen. It starts on yours and you can look at your
  // brother's, but only your own has anything you can tap.
  const [viewing, setViewing] = useState<Player['id'] | null>(null);
  // Four places to be: the board, the counters in full, the long view, and
  // the thread.
  const [view, setView] = useState<View>('board');
  const [demo] = useState(isDemo);
  const [manage, setManage] = useState(false);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [stamped, setStamped] = useState<string | null>(null);
  const floatId = useRef(1);

  const t = today();
  const monday = weekOf(t);

  const scores = useMemo(() => {
    const p1 = weekXp(state, 'p1', monday);
    const p2 = weekXp(state, 'p2', monday);
    return { p1, p2 };
  }, [state, monday]);

  if (board.stage === 'loading') {
    return <main className="min-h-screen" />;
  }
  if (board.stage === 'choosing') {
    return (
      <ChooseBrother
        players={state.players.map(p => ({ id: p.id, name: p.name, colour: p.colour }))}
        onPick={board.setMe}
      />
    );
  }

  const who = viewing ?? board.me ?? 'p1';
  // Scoring for your brother is not a thing the database will accept, so the
  // interface does not offer it either.
  const canTick = who === board.me;
  const [p1, p2] = state.players;
  const me = state.players.find(p => p.id === who)!;
  const share = scores.p1 + scores.p2 === 0 ? 0.5 : scores.p1 / (scores.p1 + scores.p2);
  const lead = scores.p1 - scores.p2;
  const leadLine =
    lead === 0
      ? 'Dead level. Someone do the dishes.'
      : `${(lead > 0 ? p1 : p2).name} leads by ${Math.abs(lead)}`;

  // The same habits on both boards: identical lists, separate ticks.
  const active = state.habits.filter(h => !h.archived);
  const daily = active.filter(h => h.kind === 'daily' || h.kind === 'multi');
  const weekly = active.filter(h => h.kind === 'weekly');
  const counters = active.filter(h => h.kind === 'tally');

  const myTotal = totalXp(state, who, t);
  const level = levelFor(myTotal);

  const pop = (e: React.MouseEvent, text: string) => {
    const id = floatId.current++;
    setFloats(f => [...f, { id, x: e.clientX, y: e.clientY, text }]);
    setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 950);
  };

  const stamp = (habitId: string) => {
    setStamped(habitId);
    setTimeout(() => setStamped(s => (s === habitId ? null : s)), 300);
  };

  const tick = (e: React.MouseEvent, habit: Habit) => {
    if (!canTick) return;
    const now = ticksOn(state, habit.id, who, t);
    const cap = dailyCap(habit);
    if (habit.kind === 'daily' && now >= 1) {
      update(setTicks(state, habit.id, who, t, 0)); // undo a mis-tap
      return;
    }
    if (now >= cap) return;
    update(setTicks(state, habit.id, who, t, now + 1));
    stamp(habit.id);
    pop(e, `+${habit.xp}`);
  };

  // A weekly target is once a day and no more - nobody goes to the gym four
  // times before lunch. A second tap on a day already ticked takes it back,
  // which is the same way a daily habit undoes a mis-tap.
  const weeklyTick = (e: React.MouseEvent, habit: Habit) => {
    if (!canTick) return;
    if (ticksOn(state, habit.id, who, t) >= dailyCap(habit)) {
      update(setTicks(state, habit.id, who, t, 0));
      return;
    }
    update(setTicks(state, habit.id, who, t, 1));
    stamp(habit.id);
    pop(e, `+${habit.xp}`);
  };

  const rename = (playerId: Player['id'], name: string) => {
    update({
      ...state,
      players: state.players.map(p => (p.id === playerId ? { ...p, name } : p)) as GameState['players'],
    });
  };

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-4" style={{ minHeight: '100dvh' }}>
      {/* Somebody having a go should never be left wondering whose numbers
          these are, or whether pressing something matters. */}
      {demo && (
        <div
          className="mb-3 rounded-xl border px-3 py-2 text-center"
          style={{ borderColor: 'var(--score)', background: 'var(--board-raised)' }}
        >
          <div className="font-score text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--score)' }}>
            Demo
          </div>
          <div className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--chalk-dim)' }}>
            Made-up board, made-up players. Press anything you like - none of it reaches anyone.
          </div>
        </div>
      )}
      {/* ---- The week, and the tug of war ---------------------------------- */}
      {view === 'board' && (
      <header>
        <div className="font-score flex items-baseline justify-between text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--chalk-dim)' }}>
          <span>Week of {new Date(monday + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          <span>Round {state.history.length + 1}</span>
        </div>

        {/* The scoreline, read like a fixture: ED 40 - 0 ALFIE */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="min-w-0 text-left">
            <div className="truncate text-xl font-black uppercase tracking-tight" style={{ color: p1.colour }}>
              {lead > 0 ? '👑 ' : ''}{p1.name}
            </div>
          </div>
          <div className="font-score flex items-baseline gap-2 text-5xl font-black leading-none" style={{ transform: 'rotate(-1.5deg)' }}>
            <span style={{ color: p1.colour }}>{scores.p1}</span>
            <span className="text-2xl" style={{ color: 'var(--chalk-dim)' }}>–</span>
            <span style={{ color: p2.colour }}>{scores.p2}</span>
          </div>
          <div className="min-w-0 text-right">
            <div className="truncate text-xl font-black uppercase tracking-tight" style={{ color: p2.colour }}>
              {p2.name}{lead < 0 ? ' 👑' : ''}
            </div>
          </div>
        </div>

        {/* The tug-of-war bar */}
        <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full" style={{ background: 'var(--dust)' }}>
          <div className="tug h-full" style={{ width: `${share * 100}%`, background: p1.colour }} />
          <div className="tug h-full flex-1" style={{ background: p2.colour }} />
        </div>
        <p className="mt-2 text-center text-sm" style={{ color: 'var(--chalk-dim)' }}>{leadLine}</p>
      </header>
      )}

      {/* ---- Whose board ---------------------------------------------------- */}
      {view !== 'chat' && (
      <div className="mt-5 flex overflow-hidden rounded-xl border" style={{ borderColor: 'var(--dust)' }}>
        {state.players.map(p => (
          <button
            key={p.id}
            onClick={() => setViewing(p.id)}
            className="flex-1 py-3 text-center text-lg font-black uppercase tracking-wide transition-colors"
            style={
              who === p.id
                ? { background: p.colour, color: 'var(--board)' }
                : { background: 'transparent', color: 'var(--chalk-dim)' }
            }
          >
            {p.name}
          </button>
        ))}
      </div>
      )}

      {/* Level line for whoever is ticking */}
      {view !== 'chat' && (
      <div className="mt-2 flex items-center gap-3 px-1">
        <span className="font-score text-xs font-bold whitespace-nowrap" style={{ color: me.colour }}>
          LV {level.level}
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--dust)' }}>
          <div className="tug h-full rounded-full" style={{ width: `${(level.into / level.needed) * 100}%`, background: me.colour }} />
        </div>
        <span className="font-score text-[10px] whitespace-nowrap" style={{ color: 'var(--chalk-dim)' }}>
          {level.into}/{level.needed}
        </span>
      </div>
      )}

      {/* ---- The counters, one tap each -------------------------------------- */}
      {view === 'board' && (
        <CounterCircles
          state={state}
          counters={counters}
          who={who}
          canTick={canTick}
          today={t}
          onChange={update}
          onPop={pop}
          onOpen={() => setView('counters')}
        />
      )}

      {view === 'board' && (
        <>
        {/* ---- Changes waiting on this player's yes ---------------------------- */}
        {state.proposals.filter(p => p.by !== who).length > 0 && (
          <>
            <SectionTitle>Needs your yes</SectionTitle>
            <div className="space-y-2">
              {state.proposals
                .filter(p => p.by !== who)
                .map(p => {
                  const byName = state.players.find(x => x.id === p.by)!.name;
                  const target = p.kind === 'retire' ? state.habits.find(h => h.id === p.habitId) : p.habit;
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border px-4 py-3"
                      style={{ borderColor: state.players.find(x => x.id === p.by)!.colour, background: 'var(--board-raised)' }}
                    >
                      <div className="text-sm">
                        <span className="font-black uppercase">{byName}</span>{' '}
                        wants to {p.kind === 'add' ? 'add' : p.kind === 'retire' ? 'retire' : 'change'}{' '}
                        <span className="font-semibold">
                          {target ? `${target.emoji} ${target.name}` : 'a habit that no longer exists'}
                        </span>
                        {p.kind !== 'retire' && p.habit ? (
                          <span className="font-score text-xs" style={{ color: 'var(--chalk-dim)' }}>
                            {' '}(+{p.habit.xp}
                            {p.habit.kind === 'multi' || p.habit.kind === 'weekly' ? `, x${p.habit.target}` : ''})
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => update(acceptProposal(state, p.id))}
                          className="rounded-lg px-4 py-1.5 text-xs font-bold"
                          style={{ background: 'var(--score)', color: 'var(--board)' }}
                        >
                          Go on then
                        </button>
                        <button
                          onClick={() => update(rejectProposal(state, p.id))}
                          className="rounded-lg border px-4 py-1.5 text-xs font-semibold"
                          style={{ borderColor: 'var(--dust)', color: 'var(--chalk-dim)' }}
                        >
                          No chance
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* ---- Today ---------------------------------------------------------- */}
        <SectionTitle>Today</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {daily.map(habit => {
            const mine = ticksOn(state, habit.id, who, t);
            const other = ticksOn(state, habit.id, who === 'p1' ? 'p2' : 'p1', t);
            const done = habit.kind === 'multi' ? mine >= habit.target : mine >= 1;
            return (
              <div
                key={habit.id}
                role="button"
                tabIndex={0}
                onClick={e => tick(e, habit)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') tick(e as unknown as React.MouseEvent, habit);
                }}
                className={`cursor-pointer rounded-2xl border p-3 text-left transition-transform active:scale-[0.97] ${stamped === habit.id ? 'stamp' : ''}`}
                style={{
                  borderColor: done ? me.colour : 'var(--dust)',
                  background: done ? 'var(--board-raised)' : 'transparent',
                }}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{habit.emoji}</span>
                  <span className="font-score text-[11px]" style={{ color: done ? 'var(--score)' : 'var(--chalk-dim)' }}>
                    {done ? 'done' : `+${habit.xp}`}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold leading-tight">{habit.name}</div>
                {habit.detail && (
                  <div className="mt-0.5 text-[10px] leading-snug" style={{ color: 'var(--chalk-dim)' }}>
                    {habit.detail}
                  </div>
                )}
                {habit.kind === 'multi' ? (
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: habit.target }, (_, i) => (
                      <span
                        key={i}
                        className="h-2 flex-1 rounded-full"
                        style={{ background: i < mine ? me.colour : 'var(--dust)' }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 h-2 rounded-full" style={{ background: done ? me.colour : 'var(--dust)' }} />
                )}
                {other > 0 && (
                  <div className="font-score mt-1.5 text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
                    {state.players.find(p => p.id !== who)!.name} has this ✓
                  </div>
                )}
                {habit.kind === 'multi' && mine > 0 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      update(setTicks(state, habit.id, who, t, mine - 1));
                    }}
                    className="font-score mt-1.5 text-[10px] underline-offset-2 hover:underline"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    − take one back
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* ---- This week ------------------------------------------------------ */}
        <SectionTitle>This week</SectionTitle>
        <div className="space-y-2">
          {weekly.map(habit => {
            const mine = ticksInWeek(state, habit.id, who, monday);
            const others = ticksInWeek(state, habit.id, who === 'p1' ? 'p2' : 'p1', monday);
            const done = mine >= habit.target;
            const doneToday = ticksOn(state, habit.id, who, t) > 0;
            return (
              <div
                key={habit.id}
                role="button"
                tabIndex={0}
                onClick={e => weeklyTick(e, habit)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') weeklyTick(e as unknown as React.MouseEvent, habit);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-transform active:scale-[0.98] ${stamped === habit.id ? 'stamp' : ''}`}
                style={{ borderColor: done ? me.colour : 'var(--dust)', background: done ? 'var(--board-raised)' : 'transparent' }}
              >
                <span className="text-2xl">{habit.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">{habit.name}</span>
                  {habit.detail && (
                    <span className="mt-0.5 block text-[10px] leading-snug" style={{ color: 'var(--chalk-dim)' }}>
                      {habit.detail}
                    </span>
                  )}
                  {doneToday && (
                    <span className="font-score mt-0.5 block text-[10px]" style={{ color: 'var(--score)' }}>
                      done today · tap to undo
                    </span>
                  )}
                  <span className="mt-1.5 flex gap-1">
                    {Array.from({ length: Math.max(habit.target, mine) }, (_, i) => (
                      <span
                        key={i}
                        className="h-2 w-5 rounded-full"
                        style={{ background: i < mine ? me.colour : 'var(--dust)' }}
                      />
                    ))}
                  </span>
                  {mine > 0 && !doneToday && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        update(untickWeek(state, habit.id, who, monday));
                      }}
                      className="font-score mt-1 text-[10px] underline-offset-2 hover:underline"
                      style={{ color: 'var(--chalk-dim)' }}
                    >
                      − take an earlier day back
                    </button>
                  )}
                </span>
                <span className="text-right">
                  <span className="font-score block text-sm font-bold">
                    {mine}/{habit.target}
                  </span>
                  <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
                    {state.players.find(p => p.id !== who)!.name}: {others}/{habit.target}
                  </span>
                </span>
              </div>
            );
          })}
        </div>

        {/* ---- This week's challenges ----------------------------------------- */}
        <SectionTitle>This week&apos;s challenges</SectionTitle>
        <div className="space-y-2">
          {challengesFor(monday).map(ch => {
            const mineDone = challengeClaimed(state, ch.id, who, monday);
            const otherDone = challengeClaimed(state, ch.id, who === 'p1' ? 'p2' : 'p1', monday);
            return (
              <button
                key={ch.id}
                onClick={e => {
                  if (!canTick) return;
                  if (mineDone) {
                    // Claimed by mistake: taking it back is one tap too.
                    update(unclaimChallenge(state, challengeKey(ch.id), who, monday));
                    return;
                  }
                  update(setTicks(state, challengeKey(ch.id), who, t, 1));
                  stamp(challengeKey(ch.id));
                  pop(e, `+${ch.xp}`);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-transform active:scale-[0.98] ${stamped === challengeKey(ch.id) ? 'stamp' : ''}`}
                style={{
                  borderColor: mineDone ? 'var(--score)' : 'var(--dust)',
                  background: mineDone ? 'var(--board-raised)' : 'transparent',
                }}
              >
                <span className="text-2xl">{ch.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-tight">{ch.name}</span>
                  <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
                    {mineDone ? 'tap to take it back' : 'once a week'}
                    {otherDone ? ` · ${state.players.find(p => p.id !== who)!.name} has it` : ''}
                  </span>
                </span>
                <span
                  className="font-score text-sm font-bold"
                  style={{ color: mineDone ? 'var(--score)' : 'var(--chalk)' }}
                >
                  {mineDone ? 'claimed' : `+${ch.xp}`}
                </span>
              </button>
            );
          })}
        </div>

        {/* ---- The ledger ------------------------------------------------------ */}
        {state.history.length > 0 && (
          <>
            <SectionTitle>Bragging rights</SectionTitle>
            <div className="space-y-1.5">
              {[...state.history].reverse().slice(0, 8).map(w => {
                const winner = w.p1 === w.p2 ? null : w.p1 > w.p2 ? p1 : p2;
                return (
                  <div
                    key={w.weekOf}
                    className="font-score flex items-center justify-between rounded-xl border px-3 py-2 text-xs"
                    style={{ borderColor: 'var(--dust)' }}
                  >
                    <span style={{ color: 'var(--chalk-dim)' }}>
                      {new Date(w.weekOf + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                    <span>
                      <span style={{ color: p1.colour }}>{w.p1}</span>
                      <span style={{ color: 'var(--chalk-dim)' }}> - </span>
                      <span style={{ color: p2.colour }}>{w.p2}</span>
                    </span>
                    <span className="font-semibold">{winner ? `${winner.emoji} ${winner.name}` : 'draw'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        </>
      )}

      {view === 'counters' && (
        <CountersPage
          state={state}
          counters={counters}
          who={who}
          canTick={canTick}
          today={t}
          monday={monday}
          onChange={update}
        />
      )}

      {view === 'stats' && (
        <Stats state={state} who={who} today={t} monday={monday} counters={counters} />
      )}

      {view === 'chat' && <Chat chat={chat} state={state} me={board.me} />}

      {/* ---- Where things stand ---------------------------------------------- */}
      {view !== 'chat' && (
      <div className="mt-6 space-y-1 text-center">
        {!canTick && (
          <p className="text-xs" style={{ color: 'var(--chalk-dim)' }}>
            You are looking at {me.name}&apos;s board. Tap your own name to score.
          </p>
        )}
        {board.waiting > 0 && (
          <p className="font-score text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
            {board.waiting} change{board.waiting === 1 ? '' : 's'} waiting for signal
          </p>
        )}
        {board.trouble && (
          <p className="font-score text-[11px]" style={{ color: 'var(--care)' }}>
            {board.trouble}
          </p>
        )}
      </div>
      )}

      {/* ---- Manage ---------------------------------------------------------- */}
      {view !== 'chat' && (
      <div className="mt-8 text-center">
        <button
          onClick={() => setManage(m => !m)}
          className="font-score text-xs underline-offset-2 hover:underline"
          style={{ color: 'var(--chalk-dim)' }}
        >
          {manage ? 'close settings' : 'players & habits'}
        </button>
        <div className="font-score mt-3 text-[10px] tracking-[0.14em]" style={{ color: 'var(--chalk-dim)' }}>
          {VERSION}
          {demo ? ' · demo' : ''}
        </div>
      </div>
      )}
      {manage && view !== 'chat' && (
        <Manage
          state={state}
          who={who}
          me={board.me}
          onChange={update}
          onRename={rename}
          onSetMe={board.setMe}
        />
      )}

      <Nav view={view} onGo={setView} unread={chat.unread} />
      <UpdateBanner />

      {/* Floating scores */}
      {floats.map(f => (
        <span
          key={f.id}
          className="rise font-score fixed z-50 text-lg font-black"
          style={{ left: f.x - 16, top: f.y - 28, color: 'var(--score)' }}
        >
          {f.text}
        </span>
      ))}
    </main>
  );
}
