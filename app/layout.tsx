import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RouteLoop — Evaluation-driven LLM routing',
  description: 'Route every LLM request using production quality, latency, reliability, and cost signals.',
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
