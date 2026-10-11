/** utils: Formatting helpers for the lawyer dashboard. */

import type { Tone } from '../ui';

export function titleize(value: string): string {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function relativeTime(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Just now';
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60 * 1000) {
    return 'Just now';
  }

  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

/** Badge tone for a dashboard case status. */
export function caseStatusTone(status: string): Tone {
  switch (status) {
    case 'Awaiting Client':
      return 'warning';
    case 'In Progress':
      return 'primary';
    case 'Closed':
      return 'success';
    default:
      return 'neutral';
  }
}
