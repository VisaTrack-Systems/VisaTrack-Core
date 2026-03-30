/** relativeTime: Unit tests for relativeTime component/module. Validates component behavior and interactions. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { relativeTime as activeCasesRelativeTime } from '../design-system/components/active-cases/utils';
import { relativeTime as clientDashboardRelativeTime } from '../design-system/components/client-dashboard/utils';
import { relativeTime as lawyerDashboardRelativeTime } from '../design-system/components/lawyer-dashboard/utils';

const NOW = new Date('2026-03-13T12:00:00.000Z');

describe('relativeTime helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Just now" for null/invalid/under-a-minute timestamps', () => {
    expect(clientDashboardRelativeTime(null)).toBe('Just now');
    expect(clientDashboardRelativeTime('not-a-date')).toBe('Just now');
    expect(activeCasesRelativeTime('not-a-date')).toBe('Just now');
    expect(lawyerDashboardRelativeTime('not-a-date')).toBe('Just now');

    const fortyFiveSecondsAgo = new Date(NOW.getTime() - 45 * 1000).toISOString();
    expect(clientDashboardRelativeTime(fortyFiveSecondsAgo)).toBe('Just now');
    expect(activeCasesRelativeTime(fortyFiveSecondsAgo)).toBe('Just now');
    expect(lawyerDashboardRelativeTime(fortyFiveSecondsAgo)).toBe('Just now');
  });

  it('formats minutes, hours, and days correctly', () => {
    const oneMinuteAgo = new Date(NOW.getTime() - 60 * 1000).toISOString();
    const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    const twoHoursAgo = new Date(NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(NOW.getTime() - 26 * 60 * 60 * 1000).toISOString();

    expect(clientDashboardRelativeTime(oneMinuteAgo)).toBe('1 minute ago');
    expect(activeCasesRelativeTime(fiveMinutesAgo)).toBe('5 minutes ago');
    expect(lawyerDashboardRelativeTime(twoHoursAgo)).toBe('2 hours ago');
    expect(clientDashboardRelativeTime(oneDayAgo)).toBe('1 day ago');
  });
});
