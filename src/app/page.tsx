'use client';

// Bragging Rights - the brothers' scoreboard.
//
// One screen, thumb-first. The tug-of-war bar at the top is the product:
// two colours pushing against each other, the meeting point is who is
// winning the week. Everything below exists to shove it.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type GameState,
  type Habit,
  type Player,
  challengeClaimed,
  challengeKey,
  challengesFor,
  levelFor,
  nextMilestone,
  streakDays,
  streakFor,
  streakMultiplier,
  ticksInWeek,
  ticksOn,
  today,
  totalXp,
  weekOf,
  weekXp,
} from '@/lib/game';
import {
  acceptProposal,
  freshState,
  load,
  newId,
  propose,
  rejectProposal,
  resetStreak,
  save,
  setTicks,
  unclaimChallenge,
  untickWeek,
} from '@/lib/store';

// A floating "+10" that rises off whatever was tapped.
interface FloatScore {
  id: number;
  x: number;
  y: number;
  text: string;
}

export default function Page() {
  const [state, setState] = useState<GameState | null>(null);
  const [who, setWho] = useState<Player['id']>('p1');
  const [manage, setManage] = useState(false);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatScore[]>([]);
  const [stamped, setStamped] = useState<string | null>(null);
  const floatId = useRef(1);

  useEffect(() => {
    setState(load());
  }, []);

  const update = (next: GameState) => {
    setState(next);
    save(next);
  };

  const t = today();
  const monday = weekOf(t);

  const scores = useMemo(() => {
    if (!state) return null;
    const p1 = weekXp(state, 'p1', monday, t);
    const p2 = weekXp(state, 'p2', monday, t);
    return { p1, p2 };
  }, [state, monday, t]);

  if (!state || !scores) {
    return <main className="min-h-screen" />;
  }

  const [p1, p2] = state.players;
  const me = state.players.find(p => p.id === who)!;
  const share = scores.p1 + scores.p2 === 0 ? 0.5 : scores.p1 / (scores.p1 + scores.p2);
  const lead = scores.p1 - scores.p2;
  const leadLine =
    lead === 0
      ? 'Dead level. Someone do the dishes.'
      : `${(lead > 0 ? p1 : p2).name} leads by ${Math.abs(lead)}`;

  // This player's board: everything shared, plus what is theirs alone.
  const active = state.habits.filter(h => !h.archived && (!h.owner || h.owner === who));
  const daily = active.filter(h => h.kind === 'daily' || h.kind === 'multi');
  const weekly = active.filter(h => h.kind === 'weekly');
  const streaks = active.filter(h => h.kind === 'streak');
  const tallies = active.filter(h => h.kind === 'tally');

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
    const now = ticksOn(state, habit.id, who, t);
    const cap = habit.kind === 'multi' ? habit.target : habit.kind === 'daily' ? 1 : Infinity;
    if (habit.kind === 'daily' && now >= 1) {
      update(setTicks(state, habit.id, who, t, 0)); // undo a mis-tap
      return;
    }
    if (now >= cap) return;
    update(setTicks(state, habit.id, who, t, now + 1));
    stamp(habit.id);
    pop(e, `+${habit.xp}`);
  };

  const weeklyTick = (e: React.MouseEvent, habit: Habit) => {
    update(setTicks(state, habit.id, who, t, ticksOn(state, habit.id, who, t) + 1));
    stamp(habit.id);
    pop(e, `+${habit.xp}`);
  };

  const tallyAdd = (habit: Habit, n: number) => {
    const now = ticksOn(state, habit.id, who, t);
    update(setTicks(state, habit.id, who, t, Math.max(0, now + n)));
    stamp(habit.id);
  };

  const declareClean = (e: React.MouseEvent, habit: Habit) => {
    update(setTicks(state, habit.id, who, t, 0));
    stamp(habit.id);
    pop(e, `+${habit.xp} clean`);
  };

  const rename = (playerId: Player['id'], name: string) => {
    update({
      ...state,
      players: state.players.map(p => (p.id === playerId ? { ...p, name } : p)) as GameState['players'],
    });
  };

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-4" style={{ minHeight: '100dvh' }}>
      {/* ---- The week, and the tug of war ---------------------------------- */}
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

      {/* ---- Whose board ---------------------------------------------------- */}
      <div className="mt-5 flex overflow-hidden rounded-xl border" style={{ borderColor: 'var(--dust)' }}>
        {state.players.map(p => (
          <button
            key={p.id}
            onClick={() => setWho(p.id)}
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

      {/* Level line for whoever is ticking */}
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
              <div className="mt-1 text-sm font-semibold leading-tight">
                {habit.name}
                {habit.owner && (
                  <span className="font-score ml-1.5 text-[9px] font-bold uppercase" style={{ color: me.colour }}>
                    yours
                  </span>
                )}
              </div>
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
              {!habit.owner && other > 0 && (
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
                <span className="block text-sm font-semibold leading-tight">
                  {habit.name}
                  {habit.owner && (
                    <span className="font-score ml-1.5 text-[9px] font-bold uppercase" style={{ color: me.colour }}>
                      yours
                    </span>
                  )}
                </span>
                <span className="mt-1.5 flex gap-1">
                  {Array.from({ length: Math.max(habit.target, mine) }, (_, i) => (
                    <span
                      key={i}
                      className="h-2 w-5 rounded-full"
                      style={{ background: i < mine ? me.colour : 'var(--dust)' }}
                    />
                  ))}
                </span>
                {mine > 0 && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      update(untickWeek(state, habit.id, who, monday));
                    }}
                    className="font-score mt-1 text-[10px] underline-offset-2 hover:underline"
                    style={{ color: 'var(--chalk-dim)' }}
                  >
                    − take one back
                  </button>
                )}
              </span>
              <span className="text-right">
                <span className="font-score block text-sm font-bold">
                  {mine}/{habit.target}
                </span>
                {!habit.owner && (
                  <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
                    {state.players.find(p => p.id !== who)!.name}: {others}/{habit.target}
                  </span>
                )}
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

      {/* ---- The hard-won days ---------------------------------------------- */}
      <SectionTitle>The hard-won days</SectionTitle>
      <div className="space-y-2">
        {streaks.map(habit => {
          const s = streakFor(state, habit.id, who);
          const days = s ? streakDays(s.startedOn, t) : 0;
          const mult = streakMultiplier(days);
          const next = nextMilestone(days);
          const otherS = streakFor(state, habit.id, who === 'p1' ? 'p2' : 'p1');
          const otherDays = otherS ? streakDays(otherS.startedOn, t) : 0;
          return (
            <div
              key={habit.id}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: 'var(--dust)', background: 'var(--board-raised)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{habit.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold leading-tight">{habit.name}</div>
                  <div className="font-score mt-0.5 text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
                    {next ? `${next - days} to day ${next}` : 'past every milestone'}
                    {s && s.best > 0 ? ` · best ${s.best}` : ''}
                    {` · ${state.players.find(p => p.id !== who)!.name}: ${otherDays}`}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="font-score block text-3xl font-black leading-none"
                    style={{ color: me.colour, transform: 'rotate(-1.5deg)' }}
                  >
                    {days}
                  </span>
                  <span className="font-score text-[10px]" style={{ color: 'var(--score)' }}>
                    +{Math.round(habit.xp * mult)}/day{mult > 1 ? ` · x${mult}` : ''}
                  </span>
                </div>
              </div>
              {confirmReset === habit.id ? (
                <div className="mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: 'var(--care)' }}>
                  <p className="text-xs leading-snug" style={{ color: 'var(--chalk)' }}>
                    Day 0 it is - telling the truth is the hard part, and the {Math.max(days, s?.best ?? 0)}-day
                    best stays yours. Back on it tomorrow.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => {
                        update(resetStreak(state, habit.id, who));
                        setConfirmReset(null);
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: 'var(--care)', color: 'var(--board)' }}
                    >
                      Reset to day 0
                    </button>
                    <button
                      onClick={() => setConfirmReset(null)}
                      className="rounded-lg border px-3 py-1.5 text-xs"
                      style={{ borderColor: 'var(--dust)' }}
                    >
                      Keep counting
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(habit.id)}
                  className="font-score mt-2 text-[11px] underline-offset-2 hover:underline"
                  style={{ color: 'var(--chalk-dim)' }}
                >
                  slipped? reset honestly
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Cutting down --------------------------------------------------- */}
      {tallies.length > 0 && (
        <>
          <SectionTitle>Cutting down</SectionTitle>
          <div className="space-y-2">
            {tallies.map(habit => {
              const mine = ticksOn(state, habit.id, who, t);
              const logged = state.completions.some(
                c => c.habitId === habit.id && c.playerId === who && c.date === t,
              );
              const week = ticksInWeek(state, habit.id, who, monday);
              const lastMonday = new Date(monday + 'T12:00:00');
              lastMonday.setDate(lastMonday.getDate() - 7);
              const lastKey = `${lastMonday.getFullYear()}-${String(lastMonday.getMonth() + 1).padStart(2, '0')}-${String(lastMonday.getDate()).padStart(2, '0')}`;
              const lastWeek = ticksInWeek(state, habit.id, who, lastKey);
              const otherWeek = ticksInWeek(state, habit.id, who === 'p1' ? 'p2' : 'p1', monday);
              return (
                <div
                  key={habit.id}
                  className={`rounded-2xl border px-4 py-3 ${stamped === habit.id ? 'stamp' : ''}`}
                  style={{ borderColor: 'var(--dust)', background: 'var(--board-raised)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{habit.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-tight">{habit.name}</div>
                      <div className="font-score mt-0.5 text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
                        {week} this week{lastWeek > 0 ? ` · ${lastWeek} last week${week < lastWeek ? ' ↓' : ''}` : ''}
                        {!habit.owner && ` · ${state.players.find(p => p.id !== who)!.name}: ${otherWeek}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => tallyAdd(habit, -1)}
                        aria-label={`One less ${habit.name}`}
                        className="h-9 w-9 rounded-full border text-lg font-bold"
                        style={{ borderColor: 'var(--dust)' }}
                      >
                        −
                      </button>
                      <span className="font-score w-8 text-center text-2xl font-black" style={{ transform: 'rotate(-1.5deg)' }}>
                        {logged ? mine : '·'}
                      </span>
                      <button
                        onClick={() => tallyAdd(habit, 1)}
                        aria-label={`One more ${habit.name}`}
                        className="h-9 w-9 rounded-full border text-lg font-bold"
                        style={{ borderColor: 'var(--dust)' }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {!logged && (
                    <button
                      onClick={e => declareClean(e, habit)}
                      className="font-score mt-2 rounded-lg border px-3 py-1.5 text-[11px] font-semibold"
                      style={{ borderColor: 'var(--score)', color: 'var(--score)' }}
                    >
                      none today · +{habit.xp}
                    </button>
                  )}
                  {logged && mine === 0 && (
                    <div className="font-score mt-2 text-[11px]" style={{ color: 'var(--score)' }}>
                      clean day banked · +{habit.xp}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

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

      {/* ---- Manage ---------------------------------------------------------- */}
      <div className="mt-8 text-center">
        <button
          onClick={() => setManage(m => !m)}
          className="font-score text-xs underline-offset-2 hover:underline"
          style={{ color: 'var(--chalk-dim)' }}
        >
          {manage ? 'close settings' : 'players & habits'}
        </button>
      </div>
      {manage && <Manage state={state} who={who} onChange={update} onRename={rename} />}

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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-score mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.18em]"
      style={{ color: 'var(--chalk-dim)' }}
    >
      {children}
    </h2>
  );
}

// Settings: names and the habit list. Deliberately plain - the game is the
// front page, this is the cupboard under the stairs.
function Manage({
  state,
  who,
  onChange,
  onRename,
}: {
  state: GameState;
  who: Player['id'];
  onChange: (s: GameState) => void;
  onRename: (id: Player['id'], name: string) => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [kind, setKind] = useState<Habit['kind']>('daily');
  const [target, setTarget] = useState(1);
  const [xp, setXp] = useState(10);
  const [whose, setWhose] = useState<'both' | 'mine'>('both');
  const [notice, setNotice] = useState('');

  const otherName = state.players.find(p => p.id !== who)!.name;

  const addHabit = () => {
    if (!name.trim()) return;
    const habit: Habit = {
      id: newId(),
      name: name.trim(),
      emoji: emoji || '⭐',
      kind,
      target: kind === 'tally' ? 0 : Math.max(1, target),
      xp: Math.max(1, xp),
      ...(whose === 'mine' ? { owner: who } : {}),
    };
    if (whose === 'mine') {
      // Your own board is yours to change.
      const streaks =
        kind === 'streak'
          ? [...state.streaks, { habitId: habit.id, playerId: who, startedOn: today(), best: 0 }]
          : state.streaks;
      onChange({ ...state, habits: [...state.habits, habit], streaks });
      setNotice(`${habit.name} is on your board.`);
    } else {
      // The shared board is nobody's to change alone.
      onChange(propose(state, { by: who, kind: 'add', habit }));
      setNotice(`Sent to ${otherName} for a yes.`);
    }
    setName('');
  };

  const retire = (h: Habit) => {
    if (h.archived || h.owner) {
      // Bringing back, or your own habit: instant.
      onChange({
        ...state,
        habits: state.habits.map(x => (x.id === h.id ? { ...x, archived: !x.archived } : x)),
      });
      return;
    }
    if (state.proposals.some(p => p.kind === 'retire' && p.habitId === h.id)) return;
    onChange(propose(state, { by: who, kind: 'retire', habitId: h.id }));
    setNotice(`Retiring ${h.name} needs ${otherName}'s yes.`);
  };

  // Inline habit editing. Your own habits change on the spot; shared ones go
  // to the other player as an edit proposal.
  const [editing, setEditing] = useState<Habit | null>(null);

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) return;
    const clean: Habit = {
      ...editing,
      name: editing.name.trim(),
      target: editing.kind === 'tally' ? 0 : Math.max(1, editing.target),
      xp: Math.max(1, editing.xp),
    };
    if (clean.owner) {
      onChange({ ...state, habits: state.habits.map(x => (x.id === clean.id ? clean : x)) });
      setNotice(`${clean.name} updated.`);
    } else {
      onChange(propose(state, { by: who, kind: 'edit', habit: clean }));
      setNotice(`Change to ${clean.name} sent to ${otherName} for a yes.`);
    }
    setEditing(null);
  };

  const inputStyle = {
    background: 'var(--board)',
    borderColor: 'var(--dust)',
    color: 'var(--chalk)',
  } as const;

  return (
    <div className="mt-4 space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--dust)' }}>
      <div>
        <div className="font-score mb-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--chalk-dim)' }}>
          Players
        </div>
        <div className="grid grid-cols-2 gap-2">
          {state.players.map(p => (
            <input
              key={p.id}
              value={p.name}
              onChange={e => onRename(p.id, e.target.value)}
              aria-label={`Rename ${p.name}`}
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ ...inputStyle, borderColor: p.colour }}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="font-score mb-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--chalk-dim)' }}>
          New habit
        </div>
        <div className="grid grid-cols-[1fr_64px] gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Name it"
            className="rounded-xl border px-3 py-2 text-sm"
            style={inputStyle}
          />
          <input
            value={emoji}
            onChange={e => setEmoji(e.target.value)}
            aria-label="Emoji"
            className="rounded-xl border px-3 py-2 text-center text-sm"
            style={inputStyle}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <select
            value={kind}
            onChange={e => setKind(e.target.value as Habit['kind'])}
            aria-label="Habit type"
            className="rounded-xl border px-2 py-2 text-sm"
            style={inputStyle}
          >
            <option value="daily">Daily tick</option>
            <option value="multi">Times a day</option>
            <option value="weekly">Times a week</option>
            <option value="streak">Days without</option>
            <option value="tally">Cutting down</option>
          </select>
          <input
            type="number"
            min={1}
            value={target}
            onChange={e => setTarget(Number(e.target.value))}
            disabled={kind === 'daily' || kind === 'streak' || kind === 'tally'}
            aria-label="Target"
            className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
            style={inputStyle}
          />
          <input
            type="number"
            min={1}
            value={xp}
            onChange={e => setXp(Number(e.target.value))}
            aria-label="XP"
            className="rounded-xl border px-3 py-2 text-sm"
            style={inputStyle}
          />
        </div>
        <div className="mt-2 flex overflow-hidden rounded-xl border text-sm" style={{ borderColor: 'var(--dust)' }}>
          <button
            onClick={() => setWhose('both')}
            className="flex-1 py-2 font-semibold"
            style={whose === 'both' ? { background: 'var(--chalk)', color: 'var(--board)' } : { color: 'var(--chalk-dim)' }}
          >
            Both of us
          </button>
          <button
            onClick={() => setWhose('mine')}
            className="flex-1 py-2 font-semibold"
            style={whose === 'mine' ? { background: 'var(--chalk)', color: 'var(--board)' } : { color: 'var(--chalk-dim)' }}
          >
            Just mine
          </button>
        </div>
        <button
          onClick={addHabit}
          className="mt-2 w-full rounded-xl py-2.5 text-sm font-bold"
          style={{ background: 'var(--chalk)', color: 'var(--board)' }}
        >
          {whose === 'both' ? `Add it (${otherName} gets a say)` : 'Add it'}
        </button>
        {notice && (
          <p className="font-score mt-2 text-[11px]" style={{ color: 'var(--score)' }}>
            {notice}
          </p>
        )}
      </div>

      <div>
        <div className="font-score mb-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--chalk-dim)' }}>
          Habits
        </div>
        <div className="space-y-1">
          {state.habits.map(h => {
            const pendingRetire = state.proposals.some(p => p.kind === 'retire' && p.habitId === h.id);
            return (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-lg px-2 py-1 text-sm"
                style={{ opacity: h.archived ? 0.4 : 1 }}
              >
                <span>
                  {h.emoji} {h.name}
                  {h.owner && (
                    <span
                      className="font-score ml-1.5 text-[9px] font-bold uppercase"
                      style={{ color: state.players.find(p => p.id === h.owner)!.colour }}
                    >
                      {state.players.find(p => p.id === h.owner)!.name}&apos;s
                    </span>
                  )}
                </span>
                {pendingRetire ? (
                  <span className="font-score text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
                    waiting on {otherName}
                  </span>
                ) : (
                  <span className="flex gap-3">
                    {!h.archived && (
                      <button
                        onClick={() => setEditing(editing?.id === h.id ? null : { ...h })}
                        className="font-score text-[11px] underline-offset-2 hover:underline"
                        style={{ color: 'var(--chalk-dim)' }}
                      >
                        edit
                      </button>
                    )}
                    <button
                      onClick={() => retire(h)}
                      className="font-score text-[11px] underline-offset-2 hover:underline"
                      style={{ color: 'var(--chalk-dim)' }}
                    >
                      {h.archived ? 'bring back' : 'retire'}
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* The one habit being edited, right under the list */}
        {editing && (
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--chalk-dim)' }}>
            <div className="grid grid-cols-[1fr_56px] gap-2">
              <input
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                aria-label="Habit name"
                className="rounded-xl border px-3 py-2 text-sm"
                style={inputStyle}
              />
              <input
                value={editing.emoji}
                onChange={e => setEditing({ ...editing, emoji: e.target.value })}
                aria-label="Emoji"
                className="rounded-xl border px-3 py-2 text-center text-sm"
                style={inputStyle}
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="font-score text-[10px] uppercase" style={{ color: 'var(--chalk-dim)' }}>
                target
                <input
                  type="number"
                  min={1}
                  value={editing.target}
                  onChange={e => setEditing({ ...editing, target: Number(e.target.value) })}
                  disabled={editing.kind === 'daily' || editing.kind === 'streak' || editing.kind === 'tally'}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
                  style={inputStyle}
                />
              </label>
              <label className="font-score text-[10px] uppercase" style={{ color: 'var(--chalk-dim)' }}>
                points
                <input
                  type="number"
                  min={1}
                  value={editing.xp}
                  onChange={e => setEditing({ ...editing, xp: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                  style={inputStyle}
                />
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={saveEdit}
                className="rounded-lg px-4 py-1.5 text-xs font-bold"
                style={{ background: 'var(--chalk)', color: 'var(--board)' }}
              >
                {editing.owner ? 'Save' : `Save (${otherName} gets a say)`}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border px-4 py-1.5 text-xs"
                style={{ borderColor: 'var(--dust)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* My own proposals still out for a yes */}
        {state.proposals.filter(p => p.by === who && p.kind === 'add').length > 0 && (
          <div className="mt-3 space-y-1">
            {state.proposals
              .filter(p => p.by === who && p.kind === 'add')
              .map(p => (
                <div key={p.id} className="font-score px-2 text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
                  {p.habit?.emoji} {p.habit?.name} - waiting on {otherName}&apos;s yes
                </div>
              ))}
          </div>
        )}
      </div>

      <FreshStart onChange={onChange} />
    </div>
  );
}

// The nuclear option, two taps deep and honest about what it does.
function FreshStart({ onChange }: { onChange: (s: GameState) => void }) {
  const [arming, setArming] = useState(false);
  return (
    <div className="border-t pt-3" style={{ borderColor: 'var(--dust)' }}>
      {arming ? (
        <div>
          <p className="text-xs" style={{ color: 'var(--chalk)' }}>
            Everything goes: scores, streaks, the ledger, the lot. No getting it back.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                localStorage.clear();
                onChange(freshState());
                setArming(false);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--care)', color: 'var(--board)' }}
            >
              Wipe it all
            </button>
            <button
              onClick={() => setArming(false)}
              className="rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--dust)' }}
            >
              Keep the board
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setArming(true)}
          className="font-score text-[11px] underline-offset-2 hover:underline"
          style={{ color: 'var(--chalk-dim)' }}
        >
          start the whole board fresh
        </button>
      )}
    </div>
  );
}
