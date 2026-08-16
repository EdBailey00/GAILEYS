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
import { load, newId, resetStreak, save, setTicks } from '@/lib/store';

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

  const active = state.habits.filter(h => !h.archived);
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

        <div className="mt-3 flex items-end justify-between">
          <ScoreBig name={p1.name} score={scores.p1} colour={p1.colour} leading={lead > 0} align="left" />
          <span className="font-score pb-2 text-xs" style={{ color: 'var(--chalk-dim)' }}>vs</span>
          <ScoreBig name={p2.name} score={scores.p2} colour={p2.colour} leading={lead < 0} align="right" />
        </div>

        {/* The tug-of-war bar */}
        <div className="mt-2 flex h-4 w-full overflow-hidden rounded-full" style={{ background: 'var(--dust)' }}>
          <div className="tug h-full" style={{ width: `${share * 100}%`, background: p1.colour }} />
          <div className="tug h-full flex-1" style={{ background: p2.colour }} />
        </div>
        <p className="mt-2 text-center text-sm" style={{ color: 'var(--chalk-dim)' }}>{leadLine}</p>
      </header>

      {/* ---- Who's tapping -------------------------------------------------- */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        {state.players.map(p => (
          <button
            key={p.id}
            onClick={() => setWho(p.id)}
            className="rounded-2xl border px-3 py-3 text-left transition-transform active:scale-[0.98]"
            style={{
              borderColor: who === p.id ? p.colour : 'var(--dust)',
              background: who === p.id ? 'var(--board-raised)' : 'transparent',
              boxShadow: who === p.id ? `inset 0 0 0 1px ${p.colour}` : 'none',
            }}
          >
            <span className="text-xl">{p.emoji}</span>
            <span className="ml-2 font-semibold">{p.name}</span>
            <span className="font-score block text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
              {who === p.id ? 'ticking as this player' : 'tap to switch'}
            </span>
          </button>
        ))}
      </div>

      {/* Level line for whoever is ticking */}
      <div className="mt-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--dust)', background: 'var(--board-raised)' }}>
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">{me.name} · Level {level.level}</span>
          <span className="font-score text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
            {level.into}/{level.needed} to next
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: 'var(--dust)' }}>
          <div className="tug h-full rounded-full" style={{ width: `${(level.into / level.needed) * 100}%`, background: me.colour }} />
        </div>
      </div>

      {/* ---- Today ---------------------------------------------------------- */}
      <SectionTitle>Today</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {daily.map(habit => {
          const mine = ticksOn(state, habit.id, who, t);
          const other = ticksOn(state, habit.id, who === 'p1' ? 'p2' : 'p1', t);
          const done = habit.kind === 'multi' ? mine >= habit.target : mine >= 1;
          return (
            <button
              key={habit.id}
              onClick={e => tick(e, habit)}
              className={`rounded-2xl border p-3 text-left transition-transform active:scale-[0.97] ${stamped === habit.id ? 'stamp' : ''}`}
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
            </button>
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
            <button
              key={habit.id}
              onClick={e => weeklyTick(e, habit)}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-transform active:scale-[0.98] ${stamped === habit.id ? 'stamp' : ''}`}
              style={{ borderColor: done ? me.colour : 'var(--dust)', background: done ? 'var(--board-raised)' : 'transparent' }}
            >
              <span className="text-2xl">{habit.emoji}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight">{habit.name}</span>
                <span className="mt-1.5 flex gap-1">
                  {Array.from({ length: Math.max(habit.target, mine) }, (_, i) => (
                    <span
                      key={i}
                      className="h-2 w-5 rounded-full"
                      style={{ background: i < mine ? me.colour : 'var(--dust)' }}
                    />
                  ))}
                </span>
              </span>
              <span className="text-right">
                <span className="font-score block text-sm font-bold">
                  {mine}/{habit.target}
                </span>
                <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
                  {state.players.find(p => p.id !== who)!.name}: {others}/{habit.target}
                </span>
              </span>
            </button>
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
                if (mineDone) return;
                update(setTicks(state, challengeKey(ch.id), who, t, 1));
                stamp(challengeKey(ch.id));
                pop(e, `+${ch.xp}`);
              }}
              disabled={mineDone}
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
                  bonus · once this week
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
      {manage && <Manage state={state} onChange={update} onRename={rename} />}

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

function ScoreBig({
  name,
  score,
  colour,
  leading,
  align,
}: {
  name: string;
  score: number;
  colour: string;
  leading: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="font-score text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colour }}>
        {leading ? '👑 ' : ''}{name}
      </div>
      <div
        className="font-score text-4xl font-black leading-none"
        style={{ color: colour, transform: 'rotate(-1.5deg)' }}
      >
        {score}
      </div>
    </div>
  );
}

// Settings: names and the habit list. Deliberately plain - the game is the
// front page, this is the cupboard under the stairs.
function Manage({
  state,
  onChange,
  onRename,
}: {
  state: GameState;
  onChange: (s: GameState) => void;
  onRename: (id: Player['id'], name: string) => void;
}) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [kind, setKind] = useState<Habit['kind']>('daily');
  const [target, setTarget] = useState(1);
  const [xp, setXp] = useState(10);

  const addHabit = () => {
    if (!name.trim()) return;
    const habit: Habit = {
      id: newId(),
      name: name.trim(),
      emoji: emoji || '⭐',
      kind,
      target: kind === 'tally' ? 0 : Math.max(1, target),
      xp: Math.max(1, xp),
    };
    const streaks =
      kind === 'streak'
        ? [
            ...state.streaks,
            { habitId: habit.id, playerId: 'p1' as const, startedOn: today(), best: 0 },
            { habitId: habit.id, playerId: 'p2' as const, startedOn: today(), best: 0 },
          ]
        : state.streaks;
    onChange({ ...state, habits: [...state.habits, habit], streaks });
    setName('');
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
        <button
          onClick={addHabit}
          className="mt-2 w-full rounded-xl py-2.5 text-sm font-bold"
          style={{ background: 'var(--chalk)', color: 'var(--board)' }}
        >
          Add it
        </button>
      </div>

      <div>
        <div className="font-score mb-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--chalk-dim)' }}>
          Habits
        </div>
        <div className="space-y-1">
          {state.habits.map(h => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-lg px-2 py-1 text-sm"
              style={{ opacity: h.archived ? 0.4 : 1 }}
            >
              <span>
                {h.emoji} {h.name}
              </span>
              <button
                onClick={() =>
                  onChange({
                    ...state,
                    habits: state.habits.map(x => (x.id === h.id ? { ...x, archived: !x.archived } : x)),
                  })
                }
                className="font-score text-[11px] underline-offset-2 hover:underline"
                style={{ color: 'var(--chalk-dim)' }}
              >
                {h.archived ? 'bring back' : 'retire'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
