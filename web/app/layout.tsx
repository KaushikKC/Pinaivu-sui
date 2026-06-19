import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title:       'Pinaivu',
  description: 'Decentralised AI on Sui',
  icons: { icon: '/Pinaivu_logo.jpg' },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full overflow-hidden bg-surface text-white">
        {children}
      </body>
    </html>
  );
}
