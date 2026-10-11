/** utils: Formatting and status helpers for the case list. */

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

export function completionFromStatus(status: string): number {
  switch (status) {
    case 'closed':
      return 100;
    case 'in_progress':
      return 75;
    case 'awaiting_client':
      return 45;
    case 'intake':
      return 15;
    default:
      return 50;
  }
}

/** Badge tone for a case status. */
export function statusTone(status: string): Tone {
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

/** Badge tone for a case priority. */
export function priorityTone(priority: string): Tone {
  switch (priority) {
    case 'high':
    case 'urgent':
      return 'danger';
    case 'medium':
      return 'warning';
    case 'low':
      return 'success';
    default:
      return 'neutral';
  }
}
