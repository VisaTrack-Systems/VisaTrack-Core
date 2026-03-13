import type { DashboardDocumentStatus } from './types';

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function relativeTime(value: string | null): string {
  if (!value) {
    return 'Just now';
  }

  const timestamp = new Date(value).getTime();
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

export function titleize(value: string): string {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function documentDisplayStatus(status: string, required: boolean): DashboardDocumentStatus {
  if (['accepted', 'approved', 'completed'].includes(status)) {
    return 'completed';
  }

  if (['received', 'under_review', 'review'].includes(status)) {
    return 'review';
  }

  if (!required && ['not_requested', 'optional'].includes(status)) {
    return 'optional';
  }

  if (['requested', 'pending', 'needs_revision', 'rejected', 'expired'].includes(status)) {
    return 'pending';
  }

  return 'pending';
}
