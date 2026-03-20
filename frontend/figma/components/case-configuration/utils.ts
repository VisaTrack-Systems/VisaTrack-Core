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

export function formatDateInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not set';
  }

  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function titleize(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function statusColor(status: string): string {
  switch (status) {
    case 'accepted':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'received':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'requested':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'rejected':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'not_requested':
    case 'not-requested':
      return 'bg-gray-100 text-gray-700 border-gray-200';
    case 'intake':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'awaiting_client':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'in_progress':
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'closed':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'in-progress':
      return 'bg-blue-100 text-blue-700';
    case 'not_started':
    case 'not-started':
      return 'bg-gray-100 text-gray-700';
    case 'blocked':
      return 'bg-red-100 text-red-700';
    case 'paid':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

export type NormalizedMilestoneStatus = 'completed' | 'in-progress' | 'not-started' | 'blocked';

export function milestoneStatus(status: string): NormalizedMilestoneStatus {
  if (status === 'completed') {
    return 'completed';
  }
  if (['in_progress', 'in-progress'].includes(status)) {
    return 'in-progress';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  return 'not-started';
}
