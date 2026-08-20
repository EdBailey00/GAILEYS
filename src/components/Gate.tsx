'use client';

// The only question the app ever asks: which brother is this phone?
//
// Asked once, answered with one tap, remembered on the device. No account, no
// code, nothing to wait for. Changing your mind lives in settings, because it
// is a preference and not a security control: this is a scoreboard for two
// brothers who share a kitchen, and it is deliberately built as one.

import type { Player } from '@/lib/game';

export function ChooseBrother({
  players,
  onPick,
}: {
  players: { id: Player['id']; name: string; colour: string }[];
  onPick: (id: Player['id']) => void;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-6" style={{ minHeight: '100dvh' }}>
      <h1 className="text-3xl font-black uppercase tracking-tight" style={{ transform: 'rotate(-1.5deg)' }}>
        Which one are you?
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--chalk-dim)' }}>
        Tap your name. That is the whole thing.
      </p>
      <div className="mt-8 space-y-3">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className="w-full rounded-xl py-5 text-2xl font-black uppercase tracking-wide"
            style={{ background: p.colour, color: 'var(--board)' }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="mt-5 text-xs leading-snug" style={{ color: 'var(--chalk-dim)' }}>
        This phone remembers. Change it in settings if you tap the wrong one.
      </p>
    </main>
  );
}
