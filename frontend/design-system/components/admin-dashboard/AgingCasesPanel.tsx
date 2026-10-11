/** AgingCasesPanel: Shows the organization's longest-open active cases (up to 12) with their assigned lawyer. */

import type { AdminOperations } from '@/lib/api';

import { Card, CardHeader } from '../ui';

type Props = {
  cases: AdminOperations['aging_cases'];
};

export function AgingCasesPanel({ cases }: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Aging Cases" />
      <ul className="divide-y divide-gray-200">
        {cases.length === 0 ? (
          <li className="px-5 py-4 text-sm text-gray-500">No active cases found.</li>
        ) : (
          cases.slice(0, 12).map((c) => (
            <li key={c.case_id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary-700">{c.case_number}</p>
                <p className="text-sm text-gray-600">
                  {c.case_type} • {c.status}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Lawyer: {c.primary_lawyer_name ?? 'Unassigned'}
                </p>
              </div>
              <p className="shrink-0 text-xs font-medium text-gray-600">{c.days_open} days open</p>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
