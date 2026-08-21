'use client';

// Settings, and the section heading the board shares.
//
// The game is the front page; this is the cupboard under the stairs. Changing
// a shared habit goes in front of the other brother before it happens, which
// is why half of this file is about asking rather than doing.

import { useState } from 'react';
import type { GameState, Habit, Player } from '@/lib/game';
import { newId, propose } from '@/lib/store';
import { supabase } from '@/lib/supabase';

export function SectionTitle({ children }: { children: React.ReactNode }) {
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
export function Manage({
  state,
  who,
  me,
  onChange,
  onRename,
  onSetMe,
}: {
  state: GameState;
  who: Player['id'];
  /** Which brother this phone belongs to. */
  me: Player['id'] | null;
  onChange: (s: GameState) => void;
  onRename: (id: Player['id'], name: string) => void;
  onSetMe: (id: Player['id']) => void;
}) {
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [emoji, setEmoji] = useState('⭐');
  const [kind, setKind] = useState<Habit['kind']>('daily');
  const [target, setTarget] = useState(1);
  const [xp, setXp] = useState(10);
  const [notice, setNotice] = useState('');

  const otherName = state.players.find(p => p.id !== who)!.name;

  const addHabit = () => {
    if (!name.trim()) return;
    const habit: Habit = {
      id: newId(),
      name: name.trim(),
      ...(detail.trim() ? { detail: detail.trim() } : {}),
      emoji: emoji || '⭐',
      kind,
      target: kind === 'tally' ? 0 : Math.max(1, target),
      xp: Math.max(1, xp),
    };
    // One board, both brothers on it, so it is nobody's to change alone.
    onChange(propose(state, { by: who, kind: 'add', habit }));
    setNotice(`Sent to ${otherName} for a yes.`);
    setName('');
    setDetail('');
  };

  const retire = (h: Habit) => {
    if (h.archived) {
      // Bringing one back is instant - it was already agreed once.
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

  // Inline habit editing. Every habit is shared, so a change is a proposal.
  const [editing, setEditing] = useState<Habit | null>(null);

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) return;
    const clean: Habit = {
      ...editing,
      name: editing.name.trim(),
      target: editing.kind === 'tally' ? 0 : Math.max(1, editing.target),
      xp: Math.max(1, editing.xp),
    };
    onChange(propose(state, { by: who, kind: 'edit', habit: clean }));
    setNotice(`Change to ${clean.name} sent to ${otherName} for a yes.`);
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
          This phone is
        </div>
        <div className="flex overflow-hidden rounded-xl border" style={{ borderColor: 'var(--dust)' }}>
          {state.players.map(p => (
            <button
              key={p.id}
              onClick={() => onSetMe(p.id)}
              className="flex-1 py-2.5 text-center text-sm font-black uppercase tracking-wide"
              style={
                me === p.id
                  ? { background: p.colour, color: 'var(--board)' }
                  : { background: 'transparent', color: 'var(--chalk-dim)' }
              }
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--chalk-dim)' }}>
          Only this phone&apos;s own board can be ticked, so this is worth getting right.
        </p>
      </div>

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
            placeholder="Name it, with the number"
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
          <input
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder="The finish line (optional)"
            className="col-span-2 rounded-xl border px-3 py-2 text-sm"
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
            <option value="tally">A counter (cutting down)</option>
          </select>
          <input
            type="number"
            min={1}
            value={target}
            onChange={e => setTarget(Number(e.target.value))}
            disabled={kind === 'daily' || kind === 'tally'}
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
          Add it ({otherName} gets a say)
        </button>
        <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'var(--chalk-dim)' }}>
          Every habit is both of yours. Whatever goes on, you both get it.
        </p>
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
                  disabled={editing.kind === 'daily' || editing.kind === 'tally'}
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
                Save ({otherName} gets a say)
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

      <SignOut />
    </div>
  );
}

// Leaving this phone. The board lives on the server now, so this is about the
// device and not about the game: nothing is lost, and signing back in brings
// the whole board down again.
function SignOut() {
  const [arming, setArming] = useState(false);
  return (
    <div className="border-t pt-3" style={{ borderColor: 'var(--dust)' }}>
      {arming ? (
        <div>
          <p className="text-xs" style={{ color: 'var(--chalk)' }}>
            This phone forgets you. The board keeps everything, and signing back in
            with your email brings it all back.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => {
                localStorage.clear();
                void supabase.auth.signOut();
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--care)', color: 'var(--board)' }}
            >
              Sign out
            </button>
            <button
              onClick={() => setArming(false)}
              className="rounded-lg border px-3 py-1.5 text-xs"
              style={{ borderColor: 'var(--dust)' }}
            >
              Stay signed in
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setArming(true)}
          className="font-score text-[11px] underline-offset-2 hover:underline"
          style={{ color: 'var(--chalk-dim)' }}
        >
          sign out of this phone
        </button>
      )}
    </div>
  );
}
