import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "LADWP EZ-SAVE Application Helper",
  description:
    "Check LADWP EZ-SAVE eligibility and prepare a filled application PDF.",
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
              EZ-SAVE check
            </Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
