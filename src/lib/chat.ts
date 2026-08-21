'use client';

// Two brothers, one thread.
//
// Deliberately not part of the board's sync. The board is a set of absolute
// values that can be replayed safely after a tunnel; a message is a thing that
// was said once, at a time, and replaying it would say it twice. So messages
// send straight to the server and a message that fails to send stays in the
// box for you to try again, rather than disappearing into an outbox.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Player } from './game';
import { supabase } from './supabase';

export interface Message {
  id: string;
  by: Player['id'];
  body: string;
  at: string;
}

/** The last message this phone has seen, so the tab can carry a dot. */
const SEEN = 'bragging-rights-chat-seen';

interface Row {
  id: string;
  player_id: Player['id'];
  body: string;
  created_at: string;
}

const toMessage = (r: Row): Message => ({
  id: r.id,
  by: r.player_id,
  body: r.body,
  at: r.created_at,
});

/**
 * Postgres has no messages table until somebody runs the SQL. Saying that
 * plainly beats a blank screen, so the error is recognised rather than
 * swallowed.
 */
const isMissingTable = (e: { code?: string; message?: string }): boolean =>
  e.code === 'PGRST205' ||
  e.code === '42P01' ||
  /relation .* does not exist|could not find the table/i.test(e.message ?? '');

export interface Chat {
  messages: Message[];
  /** True once the table has answered at least once. */
  ready: boolean;
  /** The messages table has not been created yet. */
  missing: boolean;
  trouble: string | null;
  send: (body: string) => Promise<boolean>;
  /** How many have arrived since this phone last looked. */
  unread: number;
  markSeen: () => void;
}

export function useChat(me: Player['id'] | null): Chat {
  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [seen, setSeen] = useState<string>('');
  const busy = useRef(false);

  useEffect(() => {
    setSeen(localStorage.getItem(SEEN) ?? '');
  }, []);

  const pull = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, player_id, body, created_at')
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) {
        if (isMissingTable(error)) {
          setMissing(true);
          setTrouble(null);
        } else {
          setTrouble(error.message);
        }
        return;
      }
      setMissing(false);
      setTrouble(null);
      setMessages(((data ?? []) as Row[]).map(toMessage));
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : 'Cannot reach the chat');
    } finally {
      busy.current = false;
      setReady(true);
    }
  }, []);

  // The other phone's messages as they land, plus the ordinary moments worth
  // checking: coming back to the app, and getting signal again.
  useEffect(() => {
    void pull();
    const channel = supabase
      .channel('chat')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void pull())
      .subscribe();
    const wake = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [pull]);

  const send = useCallback(
    async (body: string): Promise<boolean> => {
      const text = body.trim();
      if (!text || !me) return false;
      const { error } = await supabase.from('messages').insert({ player_id: me, body: text });
      if (error) {
        if (isMissingTable(error)) setMissing(true);
        else setTrouble(error.message);
        return false;
      }
      await pull();
      return true;
    },
    [me, pull],
  );

  const markSeen = useCallback(() => {
    const latest = messages[messages.length - 1]?.at;
    if (!latest) return;
    localStorage.setItem(SEEN, latest);
    setSeen(latest);
  }, [messages]);

  // Your own messages are not news to you.
  const unread = messages.filter(m => m.at > seen && m.by !== me).length;

  return { messages, ready, missing, trouble, send, unread, markSeen };
}

/** What has to be run once in the Supabase SQL editor before chat works. */
export const CHAT_SQL = `create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.players(id),
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- The board is already open to anyone with the address; the chat matches it.
create policy "messages are the board's" on public.messages
  for all using (true) with check (true);

alter publication supabase_realtime add table public.messages;`;
