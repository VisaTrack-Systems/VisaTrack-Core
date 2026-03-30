/** AgingCasesPanel: agingcasespanel implementation. */

import type { AdminOperations } from '@/lib/api';

type Props = {
  cases: AdminOperations['aging_cases'];
};

export function AgingCasesPanel({ cases }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Aging Cases</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {cases.length === 0 ? (
          <div className="px-6 py-5 text-sm text-gray-500">No active cases found.</div>
        ) : (
          cases.slice(0, 12).map((c) => (
            <div key={c.case_id} className="px-6 py-4">
              <p className="font-medium text-gray-900">{c.case_number}</p>
              <p className="text-sm text-gray-600">
                {c.case_type} • {c.status} • {c.days_open} days open
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Lawyer: {c.primary_lawyer_name ?? 'Unassigned'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
