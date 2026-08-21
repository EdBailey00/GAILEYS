'use client';

// The long view.
//
// Everything on this page is read from rows the board already keeps, so there
// is nothing here that can disagree with what you see on the board itself.
// The charts are hand-drawn svg rather than a charting library: three bars and
// an axis do not need 200kb of javascript, and the app has to work in a
// basement with no signal.

import { type GameState, type Habit, type Player, cleanRun, money, ticksInWeek } from '@/lib/game';
import {
  bestWeek,
  betterThanWorstWeek,
  isPriced,
  longestGap,
  record,
  spend,
  weeklyUse,
  weeklyScores,
} from '@/lib/stats';
import { SectionTitle } from './Manage';

const shortDate = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * A row of bars. Deliberately plain: the tallest bar is full height and every
 * other bar is read against it, which is the only comparison that matters on a
 * phone-width chart.
 */
function Bars({
  points,
  colour,
  label,
}: {
  points: Array<{ key: string; value: number; second?: number }>;
  colour: string;
  /** Colour of the second series, when there is one. */
  label?: string;
}) {
  const top = Math.max(1, ...points.flatMap(p => [p.value, p.second ?? 0]));
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {points.map(p => (
          <div key={p.key} className="flex h-full flex-1 items-end gap-[2px]">
            <div
              className="min-h-[2px] flex-1 rounded-t"
              style={{ height: `${(p.value / top) * 100}%`, background: colour }}
              title={`${p.key}: ${p.value}`}
            />
            {p.second !== undefined && (
              <div
                className="min-h-[2px] flex-1 rounded-t"
                style={{ height: `${(p.second / top) * 100}%`, background: label }}
                title={`${p.key}: ${p.second}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="font-score mt-1 flex justify-between text-[9px]" style={{ color: 'var(--chalk-dim)' }}>
        <span>{points.length > 0 ? shortDate(points[0].key) : ''}</span>
        <span>peak {top}</span>
        <span>{points.length > 0 ? shortDate(points[points.length - 1].key) : ''}</span>
      </div>
    </div>
  );
}

function Line({ children, value }: { children: React.ReactNode; value: string }) {
  return (
    <div className="font-score flex items-baseline justify-between text-sm">
      <span style={{ color: 'var(--chalk-dim)' }}>{children}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

export function Stats({
  state,
  who,
  today,
  monday,
  counters,
}: {
  state: GameState;
  who: Player['id'];
  today: string;
  monday: string;
  counters: Habit[];
}) {
  const [p1, p2] = state.players;
  const me = state.players.find(p => p.id === who)!;
  const weeks = weeklyScores(state, today).slice(-10);
  const standing = record(state);
  const myBest = bestWeek(state, who, today);
  const purse = spend(state, who, today);
  const versus = betterThanWorstWeek(state, who, today);
  const priced = counters.filter(isPriced);

  return (
    <div>
      {/* ---- The head to head ------------------------------------------------ */}
      <SectionTitle>Bragging rights so far</SectionTitle>
      <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--dust)', background: 'var(--board-raised)' }}>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <div className="font-score text-3xl font-black leading-none" style={{ color: p1.colour }}>
              {standing.p1}
            </div>
            <div className="font-score mt-1 text-[10px] uppercase" style={{ color: 'var(--chalk-dim)' }}>
              {p1.name}
            </div>
          </div>
          <div className="text-center">
            <div className="font-score text-xl font-black leading-none" style={{ color: 'var(--chalk-dim)' }}>
              {standing.draws}
            </div>
            <div className="font-score mt-1 text-[10px] uppercase" style={{ color: 'var(--chalk-dim)' }}>
              drawn
            </div>
          </div>
          <div className="text-center">
            <div className="font-score text-3xl font-black leading-none" style={{ color: p2.colour }}>
              {standing.p2}
            </div>
            <div className="font-score mt-1 text-[10px] uppercase" style={{ color: 'var(--chalk-dim)' }}>
              {p2.name}
            </div>
          </div>
        </div>
        <p className="font-score mt-2 text-center text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
          weeks won · this week is not counted until Sunday
        </p>
      </div>

      {/* ---- Week by week ----------------------------------------------------- */}
      <SectionTitle>Week by week</SectionTitle>
      <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--dust)' }}>
        {weeks.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--chalk-dim)' }}>
            Nothing scored yet.
          </p>
        ) : (
          <>
            <Bars
              points={weeks.map(w => ({ key: w.weekOf, value: w.p1, second: w.p2 }))}
              colour={p1.colour}
              label={p2.colour}
            />
            <div className="font-score mt-2 flex justify-center gap-4 text-[10px]">
              <span style={{ color: p1.colour }}>■ {p1.name}</span>
              <span style={{ color: p2.colour }}>■ {p2.name}</span>
            </div>
          </>
        )}
      </div>

      {myBest && (
        <div className="mt-2 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--dust)' }}>
          <Line value={`${who === 'p1' ? myBest.p1 : myBest.p2} pts`}>
            your best week · {shortDate(myBest.weekOf)}
          </Line>
          <Line value={`${weeklyScores(state, today).slice(-1)[0]?.[who] ?? 0} pts`}>this week so far</Line>
        </div>
      )}

      {/* ---- The money -------------------------------------------------------- */}
      {priced.length > 0 && (
        <>
          <SectionTitle>What it is costing you</SectionTitle>
          <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--dust)' }}>
            <Line value={money(purse.week)}>this week</Line>
            <Line value={money(purse.month)}>this month</Line>
            <Line value={money(purse.year)}>this year</Line>
            <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--dust)' }}>
              <Line value={money(purse.ever)}>all time</Line>
            </div>
            {versus && (
              <p className="mt-2 text-xs leading-snug" style={{ color: versus.saved >= 0 ? 'var(--score)' : 'var(--care)' }}>
                {versus.now === 0
                  ? `Nothing at all this week. The worst one cost ${money(versus.worst)}.`
                  : versus.saved >= 0
                    ? `${money(versus.saved)} less than your worst week, which cost ${money(versus.worst)}.`
                    : `${money(-versus.saved)} more than your previous worst week.`}
              </p>
            )}
            <p className="font-score mt-2 text-[10px] leading-snug" style={{ color: 'var(--chalk-dim)' }}>
              only counters with a price are in here
            </p>
          </div>
        </>
      )}

      {/* ---- Each counter ------------------------------------------------------ */}
      {counters.map(habit => {
        const perWeek = weeklyUse(state, habit.id, who, 8, today);
        const since = cleanRun(state, habit.id, who, today);
        const best = longestGap(state, habit.id, who, today);
        const thisWeek = ticksInWeek(state, habit.id, who, monday);
        const total = state.completions
          .filter(c => c.habitId === habit.id && c.playerId === who)
          .reduce((n, c) => n + c.count, 0);
        return (
          <div key={habit.id}>
            <SectionTitle>
              {habit.emoji} {habit.name}
            </SectionTitle>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--dust)' }}>
              <Bars points={perWeek.map(w => ({ key: w.weekOf, value: w.count }))} colour={me.colour} />
              <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--dust)' }}>
                <Line value={`${since} days`}>since the last one</Line>
                <Line value={`${best} days`}>longest you have gone</Line>
                <Line value={String(thisWeek)}>this week</Line>
                <Line value={String(total)}>logged in total</Line>
                {isPriced(habit) && (
                  <Line value={money(total * (habit.unitCost ?? 0))}>what that came to</Line>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
