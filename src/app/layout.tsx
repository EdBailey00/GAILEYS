import type { Metadata, Viewport } from 'next';
import './globals.css';

// Empty in the Android app, /GAILEYS on Pages. Every asset path is built from
// it so one build works in both homes.
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: 'Bragging Rights',
  description: 'The brothers’ scoreboard: meals, chores, miles and hard-won days, all worth points.',
  // Next generates the manifest from manifest.ts but links it without the
  // base path, which 404s on Pages and quietly stops the app being
  // installable. Naming it here is the fix.
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: `${base}/icon.svg`,
    apple: `${base}/icon-512.png`,
  },
  appleWebApp: {
    capable: true,
    title: 'Bragging Rights',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className="antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            // The service worker is what makes the browser version installable
            // and offline. Inside the Android app the files are already local,
            // so a failure to register there is expected and ignored.
            // updateViaCache:'none' so the worker itself is never served
            // from the http cache, and a check on every resume so a phone that
            // was left open for a week still notices a new one.
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${base}/sw.js',{updateViaCache:'none'}).then(function(r){document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')r.update()})}).catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
