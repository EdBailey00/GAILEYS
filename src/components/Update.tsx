'use client';

// Telling you when there is a newer push than the one on your screen.
//
// The two homes update differently and there is no pretending otherwise.
//
// In a browser the files come off the server, so a reload is the whole update:
// the service worker is network-first, so the next fetch is already the new
// build. The app asks the server for out/version.json and compares it with the
// version compiled into itself.
//
// Inside the apk the files are baked in. Nothing the app can do changes them,
// so asking its own bundle would only ever agree with itself. There it asks
// GitHub what the latest release is called and, if that is a different push,
// says so and points at it. Installing is still a tap on an apk, because that
// is what sideloading is.

import { useCallback, useEffect, useState } from 'react';
import { VERSION } from '@/lib/version';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const RELEASES = 'https://github.com/EdBailey00/GAILEYS/releases/latest';
const LATEST = 'https://api.github.com/repos/EdBailey00/GAILEYS/releases/latest';

/** GitHub allows 60 calls an hour to an unauthenticated caller. Twice an hour. */
const NATIVE_GAP_MS = 30 * 60 * 1000;
const CHECKED_AT = 'bragging-rights-update-checked';

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

export function UpdateBanner() {
  const [newer, setNewer] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [working, setWorking] = useState(false);

  const check = useCallback(async () => {
    try {
      const current = await currentVersion();
      // Only a different string is news. Not newer, not older: different,
      // because the version is a name and not a number to compare.
      if (current && current !== VERSION) setNewer(current);
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
    // Empty the service worker's cache before reloading, so the new build is
    // fetched rather than the old one served back.
    try {
      if ('caches' in window) {
        await Promise.all((await caches.keys()).map(k => caches.delete(k)));
      }
    } catch {
      // Nothing to clear, or not allowed to. The reload is still worth doing.
    }
    window.location.reload();
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <div
        className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg"
        style={{ borderColor: 'var(--score)', background: 'var(--board-raised)' }}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-tight">{newer} is out</span>
          <span className="font-score text-[10px]" style={{ color: 'var(--chalk-dim)' }}>
            you are on {VERSION}
            {isNative() ? ' · opens the release to install' : ''}
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
