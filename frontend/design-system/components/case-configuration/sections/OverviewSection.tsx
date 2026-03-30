/** OverviewSection: Configuration section for Overview settings and options. */

import { AlertCircle, CheckCircle, DollarSign, FileText, Send, Upload } from 'lucide-react';

import type { CaseWorkspace } from '@/lib/api';

import type { MilestoneStats } from '../types';
import { formatDate, statusColor, titleize } from '../utils';

type OverviewSectionProps = {
  workspace: CaseWorkspace;
  isLoadingCase: boolean;
  error: string | null;
  nextMilestone: CaseWorkspace['milestones'][number] | null;
  missingDocuments: number;
  pendingPaymentsAmount: number;
  milestoneStats: MilestoneStats;
  onOpenDocuments: () => void;
  onOpenMilestones: () => void;
  onOpenPayments: () => void;
  onOpenReminders: () => void;
};

export function OverviewSection({
  workspace,
  isLoadingCase,
  error,
  nextMilestone,
  missingDocuments,
  pendingPaymentsAmount,
  milestoneStats,
  onOpenDocuments,
  onOpenMilestones,
  onOpenPayments,
  onOpenReminders,
}: OverviewSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Case Overview</h2>
        <p className="text-gray-600">Summary and quick actions for {workspace.case.client_name}&apos;s case</p>
        {isLoadingCase ? <p className="text-xs text-gray-500 mt-1">Syncing case data...</p> : null}
        {error ? <p className="text-xs text-red-600 mt-1">Failed to sync: {error}</p> : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Status</span>
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{titleize(workspace.case.status)}</p>
          <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${statusColor(workspace.case.status)}`}>
            {titleize(workspace.case.status)}
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Next Milestone</span>
            <CheckCircle className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{nextMilestone ? nextMilestone.name : 'No pending milestone'}</p>
          <p className="text-xs text-gray-500 mt-2">Due: {nextMilestone ? formatDate(nextMilestone.due_date) : 'Not set'}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Missing Documents</span>
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{missingDocuments}</p>
          <p className="text-xs text-gray-500 mt-2">Required but not complete</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Payment Status</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">${pendingPaymentsAmount.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-2">Outstanding</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            onClick={onOpenDocuments}
          >
            <Upload className="w-5 h-5 text-red-600" />
            <div>
              <div className="font-medium text-gray-900">Request Documents</div>
              <div className="text-xs text-gray-500">Send document request to client</div>
            </div>
          </button>
          <button
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            onClick={onOpenMilestones}
          >
            <CheckCircle className="w-5 h-5 text-red-600" />
            <div>
              <div className="font-medium text-gray-900">Add Milestone</div>
              <div className="text-xs text-gray-500">Create new case milestone</div>
            </div>
          </button>
          <button
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            onClick={onOpenPayments}
          >
            <DollarSign className="w-5 h-5 text-red-600" />
            <div>
              <div className="font-medium text-gray-900">Send Payment Request</div>
              <div className="text-xs text-gray-500">Request payment from client</div>
            </div>
          </button>
          <button
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
            onClick={onOpenReminders}
          >
            <Send className="w-5 h-5 text-red-600" />
            <div>
              <div className="font-medium text-gray-900">Send Reminder</div>
              <div className="text-xs text-gray-500">Post one-way reminder to client portal</div>
            </div>
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Milestone Summary</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{milestoneStats.completed}</div>
            <div className="text-xs text-gray-600">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{milestoneStats.inProgress}</div>
            <div className="text-xs text-gray-600">In Progress</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-400">{milestoneStats.notStarted}</div>
            <div className="text-xs text-gray-600">Not Started</div>
          </div>
        </div>
      </div>
    </div>
  );
}
