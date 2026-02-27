import type { CaseWorkspace } from '@/lib/api';

import { formatDate, formatDateInput } from '../utils';

type TimelineSectionProps = {
  workspace: CaseWorkspace;
  missingDocuments: number;
  pendingPaymentsAmount: number;
};

export function TimelineSection({ workspace, missingDocuments, pendingPaymentsAmount }: TimelineSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Timeline & Estimates</h2>
        <p className="text-gray-600">Configure estimated timeline and completion dates</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Estimated Timeline</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={formatDateInput(workspace.case.start_date)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Completion (From)</label>
            <input
              type="date"
              value={formatDateInput(workspace.case.estimated_completion_from)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Completion (To)</label>
            <input
              type="date"
              value={formatDateInput(workspace.case.estimated_completion_to)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confidence Level: {workspace.case.completion_confidence ?? workspace.case.progress_percent}%
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={workspace.case.completion_confidence ?? workspace.case.progress_percent}
            className="w-full"
            readOnly
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low confidence</span>
            <span>High confidence</span>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">What Can Delay This (Client-Visible)</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={`Pending required documents: ${missingDocuments}. Pending payment amount: $${pendingPaymentsAmount.toLocaleString()}.`}
            readOnly
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Internal Risk Notes (Lawyer Only)</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            value={workspace.case.internal_notes ?? 'No internal notes available.'}
            readOnly
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Timeline Visualization</h3>
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{formatDate(workspace.case.start_date)}</span>
            <span className="text-sm text-gray-600">{formatDate(workspace.case.estimated_completion_to)}</span>
          </div>
          <div className="bg-gray-200 rounded-full h-4">
            <div
              className="bg-gradient-to-r from-green-500 via-blue-500 to-gray-300 h-4 rounded-full"
              style={{ width: `${workspace.case.progress_percent}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-green-600">Started</span>
            <span className="text-xs text-blue-600">Current ({workspace.case.progress_percent}%)</span>
            <span className="text-xs text-gray-500">Target</span>
          </div>
        </div>
      </div>
    </div>
  );
}
