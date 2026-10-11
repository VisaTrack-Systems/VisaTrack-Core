/** CaseAssignmentQueue: Lists active cases with no lawyer and lets the admin pick a lawyer and assign each one. */

import type { AdminOperations } from '@/lib/api';

import { Button, Card, CardHeader, Select } from '../ui';

type Props = {
  unassignedCases: AdminOperations['unassigned_cases'];
  lawyerWorkload: AdminOperations['lawyer_workload'];
  assignmentDraft: Record<string, string>;
  busyCaseNumber: string | null;
  onDraftChange: (caseNumber: string, lawyerId: string) => void;
  onAssign: (caseNumber: string) => void;
};

export function CaseAssignmentQueue({
  unassignedCases,
  lawyerWorkload,
  assignmentDraft,
  busyCaseNumber,
  onDraftChange,
  onAssign,
}: Props) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Case Assignment Queue" />
      <ul className="divide-y divide-gray-200">
        {unassignedCases.length === 0 ? (
          <li className="px-5 py-4 text-sm text-gray-500">No unassigned active cases.</li>
        ) : (
          unassignedCases.map((c) => (
            <li key={c.case_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary-700">{c.case_number}</p>
                <p className="text-sm text-gray-600">
                  {c.case_type} • {c.status} • Open {c.days_open} days
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-48">
                  <Select
                    compact
                    aria-label={`Lawyer for ${c.case_number}`}
                    value={assignmentDraft[c.case_number] ?? ''}
                    onChange={(event) => onDraftChange(c.case_number, event.target.value)}
                    disabled={lawyerWorkload.length === 0 || busyCaseNumber === c.case_number}
                  >
                    {lawyerWorkload.length === 0 ? (
                      <option value="">No lawyers available</option>
                    ) : (
                      lawyerWorkload.map((lawyer) => (
                        <option key={lawyer.lawyer_user_id} value={lawyer.lawyer_user_id}>
                          {lawyer.full_name} ({lawyer.active_cases})
                        </option>
                      ))
                    )}
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={busyCaseNumber === c.case_number || !assignmentDraft[c.case_number]}
                  onClick={() => onAssign(c.case_number)}
                >
                  Assign
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}
