"use client";

import { useEffect, useState } from "react";

import { COOKIE_CONSENT_KEY, readCookieChoice, type CookieChoice } from "./CookieConsent";

export function CookieSettings() {
  const [choice, setChoice] = useState<CookieChoice | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setChoice(readCookieChoice());
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const choose = (next: CookieChoice) => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, next);
    setChoice(next);
  };

  return (
    <div className="rounded-lg border border-gray-300 bg-gray-50 p-4">
      <h2 className="text-lg font-semibold text-gray-900">Your cookie choice</h2>
      <p className="mt-2 text-sm leading-6 text-gray-800">
        Current choice: {choice === "all" ? "Allow all" : choice === "essential" ? "Essential only" : "Not set"}.
        Both choices are optional. Essential sign-in still works if you choose essential only.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg border-2 border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900"
          onClick={() => choose("essential")}
        >
          Essential only
        </button>
        <button
          type="button"
          className="rounded-lg border-2 border-gray-900 bg-white px-4 py-2 text-sm font-semibold text-gray-900"
          onClick={() => choose("all")}
        >
          Allow all
        </button>
      </div>
    </div>
  );
}
