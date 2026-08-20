'use client';

// Getting in, with nothing to type.
//
// There is no sign-in screen any more. The phone takes an anonymous identity
// the moment the app opens, which the database treats as a real and distinct
// person, so a player still cannot score for his brother. All that is left is
// saying which brother you are.

import { useState } from 'react';
import type { Player } from '@/lib/game';
import { requestSeat } from '@/lib/remote';
import { supabase } from '@/lib/supabase';

export function ChooseBrother({
  players,
  onResult,
}: {
  players: { id: Player['id']; name: string; colour: string }[];
  onResult: (status: 'claimed' | 'pending', id: Player['id']) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const ask = async (id: Player['id']) => {
    setBusy(true);
    setTrouble(null);
    try {
      onResult(await requestSeat(id), id);
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : 'That did not work');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame title="Which one are you?" line="Tap your name. That is the whole sign-in.">
      <div className="mt-1 space-y-3">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => void ask(p.id)}
            disabled={busy}
            className="w-full rounded-xl py-5 text-2xl font-black uppercase tracking-wide disabled:opacity-40"
            style={{ background: p.colour, color: 'var(--board)' }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <Trouble message={trouble} />
      <p className="mt-4 text-xs leading-snug" style={{ color: 'var(--chalk-dim)' }}>
        This phone stays yours. If your brother is already playing, he gets a yes
        or no first.
      </p>
    </Frame>
  );
}

/**
 * Asked for a seat, waiting on the brother already playing to say yes. The
 * code is the point: with no email on the request, it is how he knows the
 * phone asking is yours and not somebody who found the link.
 */
export function Waiting({ name, code }: { name: string; code: string | null }) {
  return (
    <Frame title="Hang on" line={`Asked to join as ${name}.`}>
      {code && (
        <div className="rounded-2xl border px-4 py-5 text-center" style={{ borderColor: 'var(--dust)', background: 'var(--board-raised)' }}>
          <div className="font-score text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--chalk-dim)' }}>
            Read him this
          </div>
          <div
            className="font-score mt-2 text-5xl font-black"
            style={{ letterSpacing: '0.15em', transform: 'rotate(-1.5deg)' }}
          >
            {code}
          </div>
        </div>
      )}
      <p className="mt-5 text-sm leading-relaxed" style={{ color: 'var(--chalk-dim)' }}>
        Your brother sees this at the top of his board with the same four
        characters next to it. He taps yes and you are in, on this screen, without
        touching anything. You can put the phone down.
      </p>
      <SignOutLink label="start again" />
    </Frame>
  );
}

/** Only seen if the board cannot hand this phone an identity at all. */
export function CannotStart({ reason }: { reason: string | null }) {
  return (
    <Frame title="Cannot open the board" line="This phone could not get an identity from the server.">
      <p className="text-sm leading-relaxed" style={{ color: 'var(--chalk-dim)' }}>
        Anonymous sign-ins are switched off for this project. Turn them on in
        Supabase under Authentication, Sign In and Providers, and this screen
        goes away.
      </p>
      {reason && (
        <p className="font-score mt-3 text-xs leading-snug" style={{ color: 'var(--care)' }}>
          {reason}
        </p>
      )}
      <button
        onClick={() => window.location.reload()}
        className="mt-5 w-full rounded-xl py-3 text-sm font-black uppercase tracking-wide"
        style={{ background: 'var(--p1)', color: 'var(--board)' }}
      >
        Try again
      </button>
    </Frame>
  );
}

function SignOutLink({ label = 'sign out' }: { label?: string }) {
  return (
    <button
      onClick={() => {
        localStorage.clear();
        void supabase.auth.signOut();
      }}
      className="font-score mt-6 w-full text-xs underline-offset-2 hover:underline"
      style={{ color: 'var(--chalk-dim)' }}
    >
      {label}
    </button>
  );
}

function Frame({
  title,
  line,
  children,
}: {
  title: string;
  line: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-6" style={{ minHeight: '100dvh' }}>
      <h1 className="text-3xl font-black uppercase tracking-tight" style={{ transform: 'rotate(-1.5deg)' }}>
        {title}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--chalk-dim)' }}>
        {line}
      </p>
      <div className="mt-8">{children}</div>
    </main>
  );
}

function Trouble({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-3 text-sm leading-snug" style={{ color: 'var(--care)' }}>
      {message}
    </p>
  );
}
