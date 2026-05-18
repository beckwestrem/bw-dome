import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en" className={geistMono.variable}>
      <body className={geistMono.className}>
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
