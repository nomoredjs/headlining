import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "headlin.ing — Basketball-Reference for Electronic Music",
  description:
    "Data-driven rankings and analytics for electronic music artists. Track festival billings, venue plays, streaming metrics, and scene authority scores.",
  openGraph: {
    title: "headlin.ing",
    description: "Basketball-Reference for electronic music",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-text antialiased min-h-screen">
        <header className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="font-sans font-extrabold text-xl tracking-tight">
              <span className="text-accent">headlin</span>
              <span className="text-text">.ing</span>
            </a>
            <nav className="flex items-center gap-6 font-mono text-sm text-muted">
              <a href="/" className="hover:text-text transition-colors">Leaderboard</a>
              <a href="/compare" className="hover:text-text transition-colors">Compare</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
