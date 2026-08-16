import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bragging Rights',
  description: 'The brothers’ scoreboard: meals, chores, miles and hard-won days, all worth points.',
  manifest: '/GAILEYS/manifest.webmanifest',
  icons: {
    icon: '/GAILEYS/icon.svg',
    apple: '/GAILEYS/icon-512.png',
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
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/GAILEYS/sw.js').catch(()=>{}))}",
          }}
        />
      </body>
    </html>
  );
}
