import type { AdminOperations } from '@/lib/api';

type Props = {
  workload: AdminOperations['lawyer_workload'];
};

export function LawyerWorkloadPanel({ workload }: Props) {
  const sorted = [...workload].sort((a, b) => b.active_cases - a.active_cases);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Lawyer Workload</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {sorted.length === 0 ? (
          <div className="px-6 py-5 text-sm text-gray-500">No active lawyers found.</div>
        ) : (
          sorted.map((lawyer) => (
            <div key={lawyer.lawyer_user_id} className="px-6 py-4 flex items-center justify-between">
              <p className="text-sm text-gray-800">{lawyer.full_name}</p>
              <span className="text-sm font-semibold text-gray-900">{lawyer.active_cases} active</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
