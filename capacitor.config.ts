import type { CapacitorConfig } from '@capacitor/cli';

// The Android app is a shell around the live site, not a copy of it.
//
// It used to bundle the built files inside the apk, which meant every push
// needed installing by hand - and a sideloaded apk cannot patch itself, so
// there was no way round that other than not doing it. Pointing it at the
// deployed site instead means the app is always on whatever was last pushed,
// the same second the browser version is, and the apk only ever gets
// installed once.
//
// The trade: the very first launch needs signal. After that the service
// worker on the site has the files cached and it opens offline like before,
// so this costs one connected launch, once, ever.
//
// To go back to a self-contained apk, delete the server block: the build
// still produces out/ and cap sync still copies it in, so the bundled app is
// one line away if this ever turns out to be the wrong trade.
const config: CapacitorConfig = {
  appId: 'uk.gaileys.braggingrights',
  appName: 'Bragging Rights',
  webDir: 'out',
  server: {
    url: 'https://edbailey00.github.io/GAILEYS/',
    // Https only. There is nothing here worth sending in the clear.
    cleartext: false,
  },
  android: {
    // The board is the whole screen and the chalkboard runs to the edges.
    backgroundColor: '#1c1917',
  },
};

export default config;
