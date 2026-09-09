import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RouteLoop — Adaptive LLM Gateway & Evaluation Platform',
  description:
    'Route real LLM traffic, trace every call, evaluate output quality, and optimize the cost-quality frontier.',
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
