/** cookieConsent: Component tests for the cookie banner, the cookie settings panel, and the stored-choice helpers. */

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  allowsNonEssentialCookies,
  COOKIE_CONSENT_KEY,
  CookieConsent,
  readCookieChoice,
} from '@/components/compliance/CookieConsent';
import { CookieSettings } from '@/components/compliance/CookieSettings';

beforeEach(() => {
  window.localStorage.clear();
});

describe('CookieConsent banner', () => {
  it('CT-COOKIE-01: appears when no choice has been stored', async () => {
    render(<CookieConsent />);

    expect(await screen.findByRole('region', { name: 'Cookie consent' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'cookie policy' })).toHaveAttribute('href', '/legal/cookies');
  });

  it('CT-COOKIE-02: stays hidden when a choice already exists', async () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'essential');
    render(<CookieConsent />);

    // The banner decides on the next animation frame; act() waits for that frame and for React to render the result.
    await act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeInTheDocument();
  });

  it.each([
    ['Essential only', 'essential', false],
    ['Allow all', 'all', true],
  ])('CT-COOKIE-03: stores "%s" and hides the banner', async (buttonName, stored, allowsNonEssential) => {
    const user = userEvent.setup();
    render(<CookieConsent />);

    await user.click(await screen.findByRole('button', { name: buttonName }));

    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBe(stored);
    expect(allowsNonEssentialCookies()).toBe(allowsNonEssential);
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeInTheDocument();
  });
});

describe('readCookieChoice', () => {
  it('CT-COOKIE-04: ignores unknown stored values', () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'tracking');

    expect(readCookieChoice()).toBeNull();
    expect(allowsNonEssentialCookies()).toBe(false);
  });
});

describe('CookieSettings', () => {
  it('CT-COOKIE-05: shows the stored choice and lets the user change it', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'all');
    render(<CookieSettings />);

    expect(await screen.findByText(/Current choice: Allow all\./)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Essential only' }));

    expect(screen.getByText(/Current choice: Essential only\./)).toBeInTheDocument();
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('essential');
  });

  it('CT-COOKIE-06: reports "Not set" when no choice has been made', async () => {
    render(<CookieSettings />);

    expect(await screen.findByText(/Current choice: Not set\./)).toBeInTheDocument();
  });
});
