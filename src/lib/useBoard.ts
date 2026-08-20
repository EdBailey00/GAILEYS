'use client';

// The board, wired up: local copy first, server second, both kept in step.
//
// The order matters. The app renders whatever this phone last saw before it
// asks the server anything, so opening it is instant and a dead signal changes
// nothing. Changes go into the outbox and the outbox empties whenever it can.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Player } from './game';
import { emptyState, load, save, sealPastWeeks } from './store';
import { type SeatRequest, myPlayer, pull, pullSeatRequests, watch } from './remote';
import { diff, flush, pending, queue } from './sync';
import { supabase } from './supabase';

export type Stage =
  | 'loading' // still working out who this is
  | 'signed-out' // needs an email and a code
  | 'choosing' // signed in, has not said which brother he is
  | 'waiting' // asked for a seat, needs the other brother's yes
  | 'ready'; // playing

export interface Board {
  state: GameState;
  me: Player['id'] | null;
  stage: Stage;
  /** Changes still waiting for signal. */
  waiting: number;
  /** Something went wrong talking to the server, in plain words. */
  trouble: string | null;
  /** Anyone waiting to be let onto the board. */
  seatRequests: SeatRequest[];
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
  const [seatRequests, setSeatRequests] = useState<SeatRequest[]>([]);
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
      setSeatRequests(await pullSeatRequests());
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

  /** Who is this, and are they playing yet? */
  const settle = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // No signing in as such. The phone takes an anonymous identity, which
      // is real and distinct as far as the database is concerned, so a player
      // still cannot score for his brother. Nothing to type, nothing to wait
      // for. The auth listener runs this again once the session lands.
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        setMe(null);
        setTrouble(error.message);
        setStage('signed-out');
      }
      return;
    }
    try {
      const player = await myPlayer();
      setMe(player);
      if (player) {
        setStage('ready');
        void refresh();
        return;
      }
      // No seat yet. Either he has asked and is waiting on a yes, or he has
      // not asked at all. Without a seat the only request he can see is his
      // own, so one row here means he is waiting.
      const asked = await pullSeatRequests();
      setStage(asked.length > 0 ? 'waiting' : 'choosing');
    } catch (e) {
      setTrouble(e instanceof Error ? e.message : 'Cannot reach the board');
      setStage('choosing');
    }
  }, [refresh]);

  useEffect(() => {
    void settle();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void settle();
    });
    return () => sub.subscription.unsubscribe();
  }, [settle]);

  // Waiting on a yes: keep asking, so the moment he is let in the board opens
  // by itself rather than needing the app restarted.
  useEffect(() => {
    if (stage !== 'waiting') return;
    const tick = setInterval(() => void settle(), 5000);
    return () => clearInterval(tick);
  }, [stage, settle]);

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

  return { state, me, stage, waiting, trouble, seatRequests, update, refresh, setMe, setStage };
}
