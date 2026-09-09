import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://routeloop-ten.vercel.app'),
  title: 'RouteLoop — Adaptive LLM Gateway & Evaluation Platform',
  description:
    'Route real LLM traffic, trace every call, evaluate output quality, and optimize the cost-quality frontier.',
  openGraph: {
    title: 'RouteLoop — Adaptive LLM Gateway',
    description: 'Control every LLM request. Prove every routing decision.',
    url: '/',
    siteName: 'RouteLoop',
    images: ['/opengraph-image'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RouteLoop — Adaptive LLM Gateway',
    description: 'Control every LLM request. Prove every routing decision.',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
