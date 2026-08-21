'use client';

// The thread.
//
// Nothing clever: who said it, what they said, when. It is two people who
// share a kitchen, so there is no typing indicator, no read receipts and no
// reactions, because none of those would tell either of them anything they
// could not get by shouting through a wall.

import { useEffect, useRef, useState } from 'react';
import type { GameState, Player } from '@/lib/game';
import { CHAT_SQL, type Chat as ChatState } from '@/lib/chat';

const when = (at: string) => {
  const d = new Date(at);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
        ' ' +
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

export function Chat({
  chat,
  state,
  me,
}: {
  chat: ChatState;
  state: GameState;
  me: Player['id'] | null;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const foot = useRef<HTMLDivElement>(null);

  // Always land on the newest, the way every thread anyone has ever used does.
  useEffect(() => {
    foot.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages.length]);

  useEffect(() => {
    chat.markSeen();
  }, [chat]);

  if (chat.missing) return <NeedsTable />;

  const submit = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    const sent = await chat.send(draft);
    setSending(false);
    if (sent) setDraft('');
  };

  return (
    <div className="mt-4">
      {chat.trouble && (
        <p className="font-score mb-2 text-[11px]" style={{ color: 'var(--care)' }}>
          {chat.trouble}
        </p>
      )}

      <div className="space-y-2">
        {chat.ready && chat.messages.length === 0 && (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--chalk-dim)' }}>
            Nothing said yet.
          </p>
        )}
        {chat.messages.map(m => {
          const mine = m.by === me;
          const said = state.players.find(p => p.id === m.by);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[80%] rounded-2xl px-3 py-2"
                style={
                  mine
                    ? { background: said?.colour, color: 'var(--board)' }
                    : { background: 'var(--board-raised)', border: '1px solid var(--dust)' }
                }
              >
                {!mine && (
                  <div
                    className="font-score text-[10px] font-bold uppercase"
                    style={{ color: said?.colour }}
                  >
                    {said?.name}
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm leading-snug">{m.body}</div>
                <div
                  className="font-score mt-0.5 text-[9px]"
                  style={{ color: mine ? 'var(--board)' : 'var(--chalk-dim)', opacity: mine ? 0.7 : 1 }}
                >
                  {when(m.at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={foot} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder={me ? 'Say something' : 'Pick a name first'}
          disabled={!me}
          aria-label="Message"
          className="min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ background: 'var(--board)', borderColor: 'var(--dust)', color: 'var(--chalk)' }}
        />
        <button
          onClick={() => void submit()}
          disabled={!draft.trim() || sending || !me}
          className="rounded-xl px-4 py-2.5 text-sm font-bold disabled:opacity-40"
          style={{ background: 'var(--chalk)', color: 'var(--board)' }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}

/**
 * The one thing the app cannot do for itself. Creating a table is not
 * something a publishable key is allowed to do, and nor should it be, so this
 * says exactly what to run and where.
 */
function NeedsTable() {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--care)' }}>
      <h3 className="text-sm font-bold">Chat needs one thing setting up</h3>
      <p className="mt-1 text-xs leading-snug" style={{ color: 'var(--chalk-dim)' }}>
        There is no messages table in the database yet, and the app is not allowed to create one -
        that takes the SQL editor in the Supabase project. Paste this in, run it, and come back.
      </p>
      <pre
        className="font-score mt-2 max-h-56 overflow-auto rounded-xl border p-2 text-[10px] leading-relaxed"
        style={{ borderColor: 'var(--dust)', background: 'var(--board)' }}
      >
        {CHAT_SQL}
      </pre>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(CHAT_SQL).then(
            () => setCopied(true),
            () => setCopied(false),
          );
        }}
        className="mt-2 rounded-lg px-3 py-1.5 text-xs font-bold"
        style={{ background: 'var(--chalk)', color: 'var(--board)' }}
      >
        {copied ? 'Copied' : 'Copy the SQL'}
      </button>
    </div>
  );
}
