'use client';

// Getting in. An email, a six digit code, and which brother you are.
//
// A code typed into the app rather than a link followed in a browser, which
// is what makes the same screen work inside the Android app with no deep-link
// handling. You do this once.

import { useState } from 'react';
import type { Player } from '@/lib/game';
import { requestSeat } from '@/lib/remote';
import { supabase } from '@/lib/supabase';

const field =
  'w-full rounded-xl border bg-transparent px-4 py-3 text-base outline-none focus:border-current';

export function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setTrouble(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) setTrouble(error.message);
    else setSent(true);
  };

  const verify = async () => {
    setBusy(true);
    setTrouble(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) setTrouble(error.message);
    // No success branch: the session lands and useBoard picks it up.
  };

  return (
    <Frame title="Bragging Rights" line="The Bailey brothers' scoreboard.">
      {!sent ? (
        <>
          <label className="font-score block text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--chalk-dim)' }}>
            Your email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && email.includes('@')) void sendCode();
            }}
            placeholder="you@example.com"
            className={`${field} mt-2`}
            style={{ borderColor: 'var(--dust)', color: 'var(--chalk)' }}
          />
          <button
            onClick={() => void sendCode()}
            disabled={busy || !email.includes('@')}
            className="mt-3 w-full rounded-xl py-3 text-sm font-black uppercase tracking-wide disabled:opacity-40"
            style={{ background: 'var(--p1)', color: 'var(--board)' }}
          >
            {busy ? 'Sending' : 'Send me a code'}
          </button>
          <p className="mt-3 text-xs leading-snug" style={{ color: 'var(--chalk-dim)' }}>
            You do this once. The app stays signed in after that, on this phone.
          </p>
        </>
      ) : (
        <>
          <label className="font-score block text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--chalk-dim)' }}>
            The code sent to {email}
          </label>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => {
              if (e.key === 'Enter' && code.length === 6) void verify();
            }}
            placeholder="000000"
            className={`${field} font-score mt-2 text-center text-2xl font-black`}
            style={{ borderColor: 'var(--dust)', color: 'var(--chalk)', letterSpacing: '0.4em' }}
          />
          <button
            onClick={() => void verify()}
            disabled={busy || code.length !== 6}
            className="mt-3 w-full rounded-xl py-3 text-sm font-black uppercase tracking-wide disabled:opacity-40"
            style={{ background: 'var(--p1)', color: 'var(--board)' }}
          >
            {busy ? 'Checking' : 'Let me in'}
          </button>
          <button
            onClick={() => {
              setSent(false);
              setCode('');
              setTrouble(null);
            }}
            className="font-score mt-3 w-full text-xs underline-offset-2 hover:underline"
            style={{ color: 'var(--chalk-dim)' }}
          >
            wrong email? start again
          </button>
        </>
      )}
      <Trouble message={trouble} />
    </Frame>
  );
}

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
    <Frame title="Which one are you?" line="Pick once. It is how the board knows whose gym is whose.">
      <div className="mt-1 space-y-3">
        {players.map(p => (
          <button
            key={p.id}
            onClick={() => void ask(p.id)}
            disabled={busy}
            className="w-full rounded-xl py-4 text-2xl font-black uppercase tracking-wide disabled:opacity-40"
            style={{ background: p.colour, color: 'var(--board)' }}
          >
            {p.name}
          </button>
        ))}
      </div>
      <Trouble message={trouble} />
      <SignOutLink />
    </Frame>
  );
}

/** Asked for a seat, waiting on the brother already playing to say yes. */
export function Waiting({ name }: { name: string }) {
  return (
    <Frame
      title="Hang on"
      line={`Asked to join as ${name}. The board opens the moment your brother says yes.`}
    >
      <p className="text-sm leading-relaxed" style={{ color: 'var(--chalk-dim)' }}>
        Give him a nudge. It shows up at the top of his board with a yes and a no,
        and this screen lets you straight in as soon as he taps yes. You can leave
        the app; it will be waiting.
      </p>
      <SignOutLink />
    </Frame>
  );
}

function SignOutLink() {
  return (
    <button
      onClick={() => void supabase.auth.signOut()}
      className="font-score mt-4 w-full text-xs underline-offset-2 hover:underline"
      style={{ color: 'var(--chalk-dim)' }}
    >
      sign out
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
