/**
 * Root Layout: Root layout component for Next.js application.
 * Configures global styling, metadata, and application-wide providers.
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { BugReportWidget } from "../design-system/components/BugReportWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VisaTrack",
    template: "%s | VisaTrack",
  },
  description: "Secure immigration case and document management.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only z-[200] rounded bg-white px-4 py-2 text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        <main id="main-content">{children}</main>
        <Suspense fallback={null}>
          <BugReportWidget />
        </Suspense>
      </body>
    </html>
  );
}
