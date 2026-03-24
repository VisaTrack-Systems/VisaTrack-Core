import type { AdminOperations } from '@/lib/api';

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Case Assignment Queue</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {unassignedCases.length === 0 ? (
          <div className="px-6 py-5 text-sm text-gray-500">No unassigned active cases.</div>
        ) : (
          unassignedCases.map((c) => (
            <div key={c.case_id} className="px-6 py-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{c.case_number}</p>
                <p className="text-sm text-gray-600">
                  {c.case_type} • {c.status} • Open {c.days_open} days
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={assignmentDraft[c.case_number] ?? ''}
                  onChange={(event) => onDraftChange(c.case_number, event.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-xs"
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
                </select>
                <button
                  type="button"
                  className="border border-gray-300 px-3 py-1 rounded-lg text-xs hover:bg-gray-100 disabled:opacity-50"
                  disabled={busyCaseNumber === c.case_number || !assignmentDraft[c.case_number]}
                  onClick={() => onAssign(c.case_number)}
                >
                  Assign
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
