"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export const COOKIE_CONSENT_KEY = "visatrack-cookie-consent";

export type CookieChoice = "essential" | "all";

export function readCookieChoice(): CookieChoice | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  return stored === "essential" || stored === "all" ? stored : null;
}

export function allowsNonEssentialCookies(): boolean {
  return readCookieChoice() === "all";
}

const buttonClass =
  "rounded-lg border-2 border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-100";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setVisible(readCookieChoice() === null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const choose = (choice: CookieChoice) => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, choice);
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <section
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-gray-300 bg-white px-4 py-4 text-gray-900 shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6">
          VisaTrack uses one essential sign-in cookie. We do not load analytics or advertising
          cookies unless you allow them. Read the{" "}
          <Link href="/legal/cookies" className="text-blue-800 underline">
            cookie policy
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass} onClick={() => choose("essential")}>
            Essential only
          </button>
          <button type="button" className={buttonClass} onClick={() => choose("all")}>
            Allow all
          </button>
        </div>
      </div>
    </section>
  );
}
