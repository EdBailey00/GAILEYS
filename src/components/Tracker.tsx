'use client';

// A counter: the drink, the ciggies, the ket.
//
// One log, and every number on this card is read from it: days since the last
// one, how many this week, and what it has cost. None of it is worth points
// and none of it moves the scoreline - that is deliberate. A number you are
// scored on is a number you have a reason to shade, and these are the ones
// that have to stay true.

import { useState } from 'react';
import {
  type GameState,
  type Habit,
  type Player,
  bestCleanRun,
  cleanRun,
  lastUseDate,
  money,
  spentPence,
  ticksInWeek,
  ticksOn,
} from '@/lib/game';
import { setSpend, setTicks, setUnitCost } from '@/lib/store';

export function Tracker({
  state,
  habit,
  who,
  canTick,
  today,
  monday,
  onChange,
}: {
  state: GameState;
  habit: Habit;
  who: Player['id'];
  canTick: boolean;
  today: string;
  monday: string;
  onChange: (next: GameState) => void;
}) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [price, setPrice] = useState('');
  const [editingSpend, setEditingSpend] = useState(false);
  const [spend, setSpendField] = useState('');

  const me = state.players.find(p => p.id === who)!;
  const other = state.players.find(p => p.id !== who)!;
  const countToday = ticksOn(state, habit.id, who, today);
  const loggedToday = state.completions.some(
    c => c.habitId === habit.id && c.playerId === who && c.date === today,
  );
  const run = cleanRun(state, habit.id, who, today);
  const best = bestCleanRun(state, habit.id, who, today);
  const everUsed = lastUseDate(state, habit.id, who) !== null;
  const thisWeek = ticksInWeek(state, habit.id, who, monday);

  const monthStart = today.slice(0, 8) + '01';
  const week = spentPence(state, habit.id, who, monday, today);
  const month = spentPence(state, habit.id, who, monthStart, today);
  const ever = spentPence(state, habit.id, who, '0000-01-01', today);
  const spentToday = spentPence(state, habit.id, who, today, today);

  const add = (n: number) => {
    if (!canTick) return;
    onChange(setTicks(state, habit.id, who, today, Math.max(0, countToday + n)));
  };

  const savePrice = () => {
    const pounds = Number(price.replace(/[^0-9.]/g, ''));
    onChange(setUnitCost(state, habit.id, Number.isFinite(pounds) && pounds > 0 ? Math.round(pounds * 100) : null));
    setEditingPrice(false);
    setPrice('');
  };

  const saveSpend = () => {
    const pounds = Number(spend.replace(/[^0-9.]/g, ''));
    onChange(
      setSpend(state, habit.id, who, today, Number.isFinite(pounds) && pounds > 0 ? Math.round(pounds * 100) : null),
    );
    setEditingSpend(false);
    setSpendField('');
  };

  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: 'var(--dust)', background: 'var(--board-raised)' }}
    >
      {/* The headline: how long since the last one, read from the log itself. */}
      <div className="flex items-start gap-3">
        <span className="text-2xl">{habit.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold leading-tight">{habit.name}</div>
          {habit.detail && (
            <div className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--chalk-dim)' }}>
              {habit.detail}
            </div>
          )}
          <div className="font-score mt-1 text-[11px]" style={{ color: 'var(--chalk-dim)' }}>
            {everUsed ? 'since the last one' : 'nothing logged yet'}
            {best > run ? ` · best ${best}` : ''}
            {` · ${other.name}: ${cleanRun(state, habit.id, other.id, today)}`}
          </div>
        </div>
        <div className="text-right">
          <span
            className="font-score block text-3xl font-black leading-none"
            style={{ color: me.colour, transform: 'rotate(-1.5deg)' }}
          >
            {run}
          </span>
          <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
            days since
          </span>
        </div>
      </div>

      {/* Today's log. Counting up never costs points. */}
      <div className="mt-3 flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--dust)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => add(-1)}
            disabled={!canTick}
            aria-label={`One less ${habit.name} today`}
            className="h-9 w-9 rounded-full border text-lg font-bold disabled:opacity-30"
            style={{ borderColor: 'var(--dust)' }}
          >
            −
          </button>
          <span className="font-score w-8 text-center text-2xl font-black" style={{ transform: 'rotate(-1.5deg)' }}>
            {loggedToday ? countToday : '·'}
          </span>
          <button
            onClick={() => add(1)}
            disabled={!canTick}
            aria-label={`One more ${habit.name} today`}
            className="h-9 w-9 rounded-full border text-lg font-bold disabled:opacity-30"
            style={{ borderColor: 'var(--dust)' }}
          >
            +
          </button>
          <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
            today
          </span>
        </div>
        <div className="text-right">
          <span className="font-score block text-xl font-black leading-none">{thisWeek}</span>
          <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
            this week
          </span>
        </div>
      </div>

      {/* What it costs. Plain numbers, no commentary. */}
      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--dust)' }}>
        {habit.unitCost === undefined ? (
          editingPrice ? (
            <PriceField
              label={`What does one ${habit.name.toLowerCase()} cost?`}
              value={price}
              onChange={setPrice}
              onSave={savePrice}
              onCancel={() => setEditingPrice(false)}
            />
          ) : (
            <button
              onClick={() => setEditingPrice(true)}
              disabled={!canTick}
              className="font-score text-[11px] underline-offset-2 hover:underline disabled:opacity-30"
              style={{ color: 'var(--chalk-dim)' }}
            >
              set a price and this starts counting the money
            </button>
          )
        ) : editingPrice ? (
          <PriceField
            label="Price of one"
            value={price}
            onChange={setPrice}
            onSave={savePrice}
            onCancel={() => setEditingPrice(false)}
          />
        ) : (
          <>
            <div className="font-score flex items-baseline justify-between text-sm">
              <span style={{ color: 'var(--chalk-dim)' }}>this week</span>
              <span className="font-bold">{money(week)}</span>
            </div>
            <div className="font-score mt-1 flex items-baseline justify-between text-sm">
              <span style={{ color: 'var(--chalk-dim)' }}>this month</span>
              <span className="font-bold">{money(month)}</span>
            </div>
            <div className="font-score mt-1 flex items-baseline justify-between text-base">
              <span style={{ color: 'var(--chalk-dim)' }}>all time</span>
              <span className="font-black">{money(ever)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => setEditingPrice(true)}
                disabled={!canTick}
                className="font-score text-[10px] underline-offset-2 hover:underline disabled:opacity-30"
                style={{ color: 'var(--chalk-dim)' }}
              >
                {money(habit.unitCost)} each · change
              </button>
              {countToday > 0 && canTick && !editingSpend && (
                <button
                  onClick={() => setEditingSpend(true)}
                  className="font-score text-[10px] underline-offset-2 hover:underline"
                  style={{ color: 'var(--chalk-dim)' }}
                >
                  today cost {money(spentToday)} · not right?
                </button>
              )}
            </div>
            {editingSpend && (
              <div className="mt-2">
                <PriceField
                  label="What today actually cost"
                  value={spend}
                  onChange={setSpendField}
                  onSave={saveSpend}
                  onCancel={() => setEditingSpend(false)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <label className="font-score block text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--chalk-dim)' }}>
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="font-score text-lg">£</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="25"
          autoFocus
          className="font-score w-20 rounded-lg border bg-transparent px-2 py-1.5 text-base outline-none"
          style={{ borderColor: 'var(--dust)', color: 'var(--chalk)' }}
        />
        <button
          onClick={onSave}
          className="rounded-lg px-3 py-1.5 text-xs font-bold"
          style={{ background: 'var(--score)', color: 'var(--board)' }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="font-score text-[11px] underline-offset-2 hover:underline"
          style={{ color: 'var(--chalk-dim)' }}
        >
          cancel
        </button>
      </div>
    </div>
  );
}
