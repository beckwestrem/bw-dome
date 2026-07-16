import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geist = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  display: "swap",
  variable: "--font-geist",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Buffalo Billsaver | LADWP EZ-SAVE Application Helper",
  description:
    "Check your likely LADWP EZ-SAVE eligibility, prepare the application, and automate the fax submission or download the PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
