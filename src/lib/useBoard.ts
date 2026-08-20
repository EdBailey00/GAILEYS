'use client';

// The board, wired up: local copy first, server second, both kept in step.
//
// There is no sign-in. It is two brothers and one board, so the app opens
// straight onto it and the only question ever asked is which brother you are,
// once, on this phone. That answer lives here and nowhere else.
//
// The order matters. The app renders whatever this phone last saw before it
// asks the server anything, so opening it is instant and a dead signal changes
// nothing. Changes go into the outbox and the outbox empties whenever it can.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Player } from './game';
import { emptyState, load, save, sealPastWeeks } from './store';
import { pull, watch } from './remote';
import { diff, flush, pending, queue } from './sync';

const ME_KEY = 'bragging-rights-me';

export type Stage =
  | 'loading' // reading this phone's copy
  | 'choosing' // first run: which brother is this phone
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
  /** Say which brother this phone belongs to. Remembered. */
  setMe: (id: Player['id']) => void;
}

export function useBoard(): Board {
  const [state, setState] = useState<GameState>(emptyState);
  const [me, setMeState] = useState<Player['id'] | null>(null);
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

  // This phone's copy, and who it belongs to, before anything touches the
  // network. Both are on the device, so this is instant and works offline.
  useEffect(() => {
    setState(load());
    const stored = localStorage.getItem(ME_KEY);
    if (stored === 'p1' || stored === 'p2') {
      setMeState(stored);
      setStage('ready');
      void refresh();
    } else {
      setStage('choosing');
    }
  }, [refresh]);

  const setMe = useCallback(
    (id: Player['id']) => {
      localStorage.setItem(ME_KEY, id);
      setMeState(id);
      setStage('ready');
      void refresh();
    },
    [refresh],
  );

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

  return { state, me, stage, waiting, trouble, update, refresh, setMe };
}
