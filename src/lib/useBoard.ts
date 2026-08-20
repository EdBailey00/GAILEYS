'use client';

// The board, wired up: local copy first, server second, both kept in step.
//
// The order matters. The app renders whatever this phone last saw before it
// asks the server anything, so opening it is instant and a dead signal changes
// nothing. Changes go into the outbox and the outbox empties whenever it can.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Player } from './game';
import { emptyState, load, save, sealPastWeeks } from './store';
import { myPlayer, pull, watch } from './remote';
import { diff, flush, pending, queue } from './sync';
import { supabase } from './supabase';

export type Stage =
  | 'loading' // still working out who this is
  | 'signed-out' // needs an email and a code
  | 'choosing' // signed in, has not said which brother he is
  | 'ready'; // playing

export interface Board {
  state: GameState;
  me: Player['id'] | null;
  stage: Stage;
  /** Changes still waiting for signal. */
  waiting: number;
  /** Something went wrong talking to the server, in plain words. */
  trouble: string | null;
  update: (next: GameState) => void;
  refresh: () => Promise<void>;
  setMe: (id: Player['id']) => void;
  setStage: (s: Stage) => void;
}

export function useBoard(): Board {
  const [state, setState] = useState<GameState>(emptyState);
  const [me, setMe] = useState<Player['id'] | null>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [waiting, setWaiting] = useState(0);
  const [trouble, setTrouble] = useState<string | null>(null);
  const busy = useRef(false);

  /** Empty the outbox, then take the server's copy, then seal any dead weeks. */
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      await flush();
      setWaiting(pending());
      // Anything still queued is a change the server has not accepted yet.
      // Pulling now would rub it off the screen, so leave it for next time.
      if (pending() > 0) return;
      const board = sealPastWeeks(await pull());
      setState(board);
      save(board);
      setTrouble(null);
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : 'Cannot reach the board');
    } finally {
      busy.current = false;
    }
  }, []);

  // The local copy, straight away, before anything touches the network.
  useEffect(() => {
    setState(load());
  }, []);

  // Who is this, and are they playing yet?
  useEffect(() => {
    let live = true;

    const settle = async () => {
      const { data } = await supabase.auth.getSession();
      if (!live) return;
      if (!data.session) {
        setMe(null);
        setStage('signed-out');
        return;
      }
      try {
        const player = await myPlayer();
        if (!live) return;
        setMe(player);
        setStage(player ? 'ready' : 'choosing');
        if (player) void refresh();
      } catch (e) {
        if (!live) return;
        setTrouble(e instanceof Error ? e.message : 'Cannot reach the board');
        setStage('choosing');
      }
    };

    void settle();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void settle();
    });
    return () => {
      live = false;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  // The other phone's taps, as they happen. Plus the ordinary moments worth
  // checking: coming back to the app, and getting signal again.
  useEffect(() => {
    if (stage !== 'ready') return;
    const stop = watch(() => void refresh());
    const wake = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [stage, refresh]);

  const update = useCallback(
    (next: GameState) => {
      queue(diff(state, next));
      setState(next);
      save(next);
      setWaiting(pending());
      void flush().then(() => setWaiting(pending()));
    },
    [state],
  );

  return { state, me, stage, waiting, trouble, update, refresh, setMe, setStage };
}
