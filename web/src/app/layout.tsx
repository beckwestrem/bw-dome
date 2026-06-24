import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "Buffalo",
  description: "Fast checks for business queues and utility bill savings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="app-frame">
          <div className="app-frame__rays" aria-hidden />
          <div className="app-frame__stripe" aria-hidden />
          <nav className="app-top-nav" aria-label="Site">
            <Link className="button secondary app-top-nav__home" href="/">
              home
            </Link>
            <Link className="button secondary" href="/utility-discounts">
              bill check
            </Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
