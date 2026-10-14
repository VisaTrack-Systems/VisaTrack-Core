/** componentTestKit: Shared helpers for component tests that render screens with a mocked `@/lib/api`. */

import { screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';

import type { CaseListItem, CaseWorkspace } from '@/lib/api';

import { mockCaseWorkspace } from '../../design-system/storybook/fixtures';

/**
 * Fails the test if anything reaches the network. Screens must get data from a
 * mocked `@/lib/api` function; a test may still stub `fetch` itself for storage uploads.
 */
export function failOnUnmockedNetwork() {
  const unexpected: string[] = [];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        unexpected.push(url);
        throw new Error(`Unmocked network request: ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    const requests = unexpected.splice(0);
    expect(requests, 'Mock the @/lib/api function instead of reaching the network').toEqual([]);
  });
}

/** Reads the number shown under a StatCard label. The label <p> distinguishes it from same-named headings. */
export function statValue(label: string): string | null {
  const statLabel = screen.getAllByText(label).find((element) => element.tagName === 'P');
  if (!statLabel) {
    throw new Error(`No stat card labelled "${label}"`);
  }
  return statLabel.parentElement?.nextElementSibling?.textContent ?? null;
}

/**
 * Finds the table row whose first cell starts with `text`. Matching the start of the row's
 * accessible name avoids picking a different row that merely contains the same words.
 */
export function rowStartingWith(text: string): HTMLElement {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return screen.getByRole('row', { name: new RegExp(`^${escaped}(\\s|$)`) });
}

/** Formats a timestamp the way the app shows dates, in the machine's time zone, so assertions hold in any zone. */
export function displayDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** A lawyer case list row with sensible defaults. */
export function buildCase(overrides: Partial<CaseListItem>): CaseListItem {
  return {
    id: crypto.randomUUID(),
    organization_id: 'org-1',
    case_number: 'C-0000',
    case_type: 'Express Entry',
    status: 'intake',
    priority: 'medium',
    client_name: 'Client',
    primary_lawyer_name: 'Avery Counsel',
    target_filing_date: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** A deep copy of a workspace fixture, so tests can change it without leaking into other tests. */
export function cloneWorkspace(workspace: CaseWorkspace = mockCaseWorkspace): CaseWorkspace {
  return JSON.parse(JSON.stringify(workspace)) as CaseWorkspace;
}
