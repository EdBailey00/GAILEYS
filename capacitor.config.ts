import type { CapacitorConfig } from '@capacitor/cli';

// The Android app is the same static export, loaded from inside the apk.
// Build it with NEXT_PUBLIC_BASE_PATH unset so every path is root-relative,
// then `npx cap sync android` copies out/ into the Android project.
const config: CapacitorConfig = {
  appId: 'uk.gaileys.braggingrights',
  appName: 'Bragging Rights',
  webDir: 'out',
  android: {
    // The board is the whole screen and the chalkboard runs to the edges.
    backgroundColor: '#1c1917',
  },
};

export default config;
