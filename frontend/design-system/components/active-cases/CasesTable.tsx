/** CasesTable: casestable implementation. */

import { Calendar, Clock, DollarSign, FileText } from 'lucide-react';

import type { UiCase } from './types';
import { priorityColor, statusColor } from './utils';

type CasesTableProps = {
  filteredCases: UiCase[];
  onSelectCase: (caseId: string) => void;
};

export function CasesTable({ filteredCases, onSelectCase }: CasesTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Client / Case</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Next Milestone</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Deadline</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Outstanding</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredCases.map((case_) => (
              <tr key={case_.id} onClick={() => onSelectCase(case_.id)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <div className="font-semibold text-gray-900">{case_.clientName}</div>
                    <div className="text-sm text-gray-600">{case_.caseType}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{case_.id}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(case_.status)}`}>
                    {case_.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityColor(case_.priority)}`}>
                    {case_.priority.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{case_.nextMilestone}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {case_.lastActivity}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-gray-900">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {case_.nextDeadline}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {case_.outstandingDocs > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-yellow-700">
                        <FileText className="w-3 h-3" />
                        {case_.outstandingDocs} docs
                      </span>
                    )}
                    {case_.outstandingPayments > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700">
                        <DollarSign className="w-3 h-3" />
                        {case_.outstandingPayments} payment{case_.outstandingPayments > 1 ? 's' : ''}
                      </span>
                    )}
                    {case_.outstandingDocs === 0 && case_.outstandingPayments === 0 && (
                      <span className="text-xs text-green-600">All clear</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[80px]">
                      <div className="bg-red-600 h-2 rounded-full" style={{ width: `${case_.completionPercent}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-700 min-w-[40px]">{case_.completionPercent}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredCases.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No cases found matching your search criteria</p>
        </div>
      )}
    </div>
  );
}
