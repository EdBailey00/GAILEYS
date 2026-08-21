'use client';

// Keeping the app on the current push.
//
// The two homes update differently and there is no pretending otherwise.
//
// In a browser it just updates. It asks the server for version.json when it
// opens, when you come back to it and when signal returns; a different answer
// means it empties the caches and reloads onto the new build on its own. You
// are not asked, because there is nothing to decide: nobody wants to be on
// last week's build, and every tap is already saved on the phone and on the
// server before a reload could take it.
//
// The exception is a reload that does not take - a stale copy in front of the
// server, say. Reloading a second time for the same version would be a loop,
// so that one falls back to asking, once.
//
// Inside the apk the files are baked in. Nothing the app can do changes them,
// so there it asks GitHub what the latest release is called and points at it.
// Installing is still a tap on an apk, because that is what sideloading is.

import { useCallback, useEffect, useState } from 'react';
import { VERSION } from '@/lib/version';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const RELEASES = 'https://github.com/EdBailey00/GAILEYS/releases/latest';
const LATEST = 'https://api.github.com/repos/EdBailey00/GAILEYS/releases/latest';

/** GitHub allows 60 calls an hour to an unauthenticated caller. Twice an hour. */
const NATIVE_GAP_MS = 30 * 60 * 1000;
const CHECKED_AT = 'bragging-rights-update-checked';
/** The version we already reloaded for, so one that will not take is not a loop. */
const RELOADED_FOR = 'bragging-rights-reloaded-for';

interface Capacitored {
  Capacitor?: { isNativePlatform?: () => boolean };
}

const isNative = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean((window as Capacitored).Capacitor?.isNativePlatform?.());

/** Which push is current, or null if there is no answer worth acting on. */
async function currentVersion(): Promise<string | null> {
  if (isNative()) {
    const last = Number(localStorage.getItem(CHECKED_AT) ?? 0);
    if (Date.now() - last < NATIVE_GAP_MS) return null;
    localStorage.setItem(CHECKED_AT, String(Date.now()));
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    return ((await res.json()) as { name?: string }).name ?? null;
  }
  const res = await fetch(`${BASE}/version.json`, { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { version?: string }).version ?? null;
}

/** Empty every cache, so the reload fetches the build rather than a copy. */
async function emptyCaches(): Promise<void> {
  try {
    if ('caches' in window) {
      await Promise.all((await caches.keys()).map(k => caches.delete(k)));
    }
  } catch {
    // Nothing to clear, or not allowed to. The reload is still worth doing.
  }
}

export function UpdateBanner() {
  const [newer, setNewer] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [working, setWorking] = useState(false);

  const check = useCallback(async () => {
    try {
      const current = await currentVersion();
      // Only a different string is news. Not newer, not older: different,
      // because the version is a name and not a number to compare.
      if (!current || current === VERSION) return;
      if (isNative()) {
        setNewer(current);
        return;
      }
      if (sessionStorage.getItem(RELOADED_FOR) === current) {
        // Already reloaded for this one and still not on it. Something is
        // holding an old copy, so stop and let it be tapped.
        setNewer(current);
        return;
      }
      sessionStorage.setItem(RELOADED_FOR, current);
      setWorking(true);
      await emptyCaches();
      window.location.reload();
    } catch {
      // No signal is not a problem worth a banner. The app works offline.
    }
  }, []);

  // On open, on coming back to the app, and on getting signal again - the same
  // three moments the board itself refreshes on.
  useEffect(() => {
    void check();
    const wake = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [check]);

  if (!newer || dismissed) return null;

  const update = async () => {
    if (isNative()) {
      window.open(RELEASES, '_blank');
      return;
    }
    setWorking(true);
    await emptyCaches();
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-x-0 z-40 px-4"
      style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
    >
      <div
        className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg"
        style={{ borderColor: 'var(--score)', background: 'var(--board-raised)' }}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">{newer} is out</span>
          <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
            you are on {VERSION}
            {isNative() ? ' · opens the release to install' : ' · could not update on its own'}
          </span>
        </span>
        <button
          onClick={update}
          disabled={working}
          className="rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          style={{ background: 'var(--score)', color: 'var(--board)' }}
        >
          {working ? 'updating' : isNative() ? 'Get it' : 'Update'}
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Not now"
          className="font-score text-[11px]"
          style={{ color: 'var(--chalk-dim)' }}
        >
          later
        </button>
      </div>
    </div>
  );
}
