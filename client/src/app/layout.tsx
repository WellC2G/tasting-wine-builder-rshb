import type { Metadata, Viewport } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Конструктор дегустаций',
    template: '%s · Конструктор дегустаций',
  },
  description:
    'Проведение слепых дегустаций вин по 100-балльной шкале Роберта ' +
    'Паркера с синхронизацией состояния в реальном времени и статистически ' +
    'выверенными результатами.',
  applicationName: 'Конструктор дегустаций',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Дегустация',
  },
  formatDetection: {
    telephone: false,
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
    <html lang="ru">
      <body className="min-h-screen bg-stone-950 text-stone-100 antialiased">
        {children}
      </body>
    </html>
  );
}
