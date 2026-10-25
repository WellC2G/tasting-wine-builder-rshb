import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Tasting Constructor',
    template: '%s · Tasting Constructor',
  },
  description:
    'Run blind wine tastings with the Robert Parker 100-point scale, real-time ' +
    'state synchronisation and statistically validated results.',
  applicationName: 'Tasting Constructor',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0c0a09',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-950 text-stone-100 antialiased">
        {children}
      </body>
    </html>
  );
}
