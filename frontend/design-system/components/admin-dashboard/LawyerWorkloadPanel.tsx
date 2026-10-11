/** LawyerWorkloadPanel: Lists each lawyer in the organization with their active case count, busiest first. */

import type { AdminOperations } from '@/lib/api';

import { Badge, Card, CardHeader } from '../ui';

type Props = {
  workload: AdminOperations['lawyer_workload'];
};

export function LawyerWorkloadPanel({ workload }: Props) {
  const sorted = [...workload].sort((a, b) => b.active_cases - a.active_cases);

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Lawyer Workload" />
      <ul className="divide-y divide-gray-200">
        {sorted.length === 0 ? (
          <li className="px-5 py-4 text-sm text-gray-500">No active lawyers found.</li>
        ) : (
          sorted.map((lawyer) => (
            <li key={lawyer.lawyer_user_id} className="flex items-center justify-between gap-3 px-5 py-3">
              <p className="truncate text-sm font-medium text-gray-900">{lawyer.full_name}</p>
              <Badge tone={lawyer.active_cases > 0 ? 'primary' : 'neutral'}>{lawyer.active_cases} active</Badge>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
