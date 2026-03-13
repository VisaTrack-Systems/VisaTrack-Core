export function titleize(value: string): string {
  return value
    .replaceAll('_', ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join(' ');
}

export function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const hours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function caseStatusColor(status: string): string {
  switch (status) {
    case 'Intake':
      return 'bg-slate-100 text-slate-700';
    case 'Awaiting Client':
      return 'bg-yellow-100 text-yellow-700';
    case 'In Progress':
      return 'bg-purple-100 text-purple-700';
    case 'Closed':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
