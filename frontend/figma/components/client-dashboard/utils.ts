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

  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
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

export function documentStatusLabel(status: string): string {
  switch (status) {
    case 'requested':
    case 'pending':
      return 'Requested';
    case 'received_under_review':
    case 'received':
    case 'under_review':
      return 'Received / Under Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
    case 'needs_revision':
      return 'Rejected';
    case 'not_requested':
      return 'Not Requested';
    default:
      return titleize(status);
  }
}

export function documentDisplayStatus(status: string, required: boolean): DashboardDocumentStatus {
  if (status === 'rejected' || status === 'needs_revision') {
    return 'rejected';
  }

  if (['approved', 'completed'].includes(status)) {
    return 'completed';
  }

  if (['received_under_review', 'received', 'under_review', 'review'].includes(status)) {
    return 'review';
  }

  if (!required && ['not_requested', 'optional'].includes(status)) {
    return 'optional';
  }

  return 'pending';
}
