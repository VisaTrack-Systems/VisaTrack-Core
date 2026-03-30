/** CaseSummaryCard: casesummarycard implementation. */

import type { CaseInfo } from './types';

type CaseSummaryCardProps = {
  caseInfo: CaseInfo;
};

export function CaseSummaryCard({ caseInfo }: CaseSummaryCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{caseInfo.type}</h2>
          <p className="text-sm text-gray-600">Case ID: {caseInfo.id}</p>
        </div>
        <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          {caseInfo.status}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div>
          <p className="text-sm text-gray-600 mb-1">Assigned Lawyer</p>
          <p className="font-medium text-gray-900">{caseInfo.assignedLawyer}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Start Date</p>
          <p className="font-medium text-gray-900">{caseInfo.startDate}</p>
        </div>
        <div>
          <p className="text-sm text-gray-600 mb-1">Estimated Completion</p>
          <p className="font-medium text-gray-900">{caseInfo.estimatedCompletion}</p>
        </div>
      </div>

      {caseInfo.description ? (
        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-600 mb-2">Case Description</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{caseInfo.description}</p>
        </div>
      ) : null}
    </div>
  );
}
