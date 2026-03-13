import { Save } from 'lucide-react';
import { useState } from 'react';

import type { CaseWorkspace } from '@/lib/api';

import { formatDate, formatDateInput } from '../utils';

type CaseDetailsUpdate = {
  case_type: string;
  priority: string;
  status: string;
  target_filing_date: string | null;
  description: string | null;
  internal_notes: string | null;
};

type CaseDetailsSectionProps = {
  workspace: CaseWorkspace;
  saving: boolean;
  onSave: (updates: CaseDetailsUpdate) => Promise<boolean>;
  onNotify: (message: string) => void;
};

type CaseDetailsDraft = {
  case_type: string;
  priority: string;
  status: string;
  target_filing_date: string;
  description: string;
  internal_notes: string;
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replaceAll(' ', '_');
}

function toDraft(workspace: CaseWorkspace): CaseDetailsDraft {
  return {
    case_type: workspace.case.case_type,
    priority: workspace.case.priority,
    status: workspace.case.status,
    target_filing_date: formatDateInput(workspace.case.target_filing_date),
    description: workspace.case.description ?? '',
    internal_notes: workspace.case.internal_notes ?? '',
  };
}

export function CaseDetailsSection({ workspace, saving, onSave, onNotify }: CaseDetailsSectionProps) {
  const [draft, setDraft] = useState<CaseDetailsDraft>(() => toDraft(workspace));

  const handleReset = () => {
    if (saving) {
      return;
    }
    setDraft(toDraft(workspace));
    onNotify('Case details reset to current saved values.');
  };

  const handleSave = async () => {
    const updates: CaseDetailsUpdate = {
      case_type: draft.case_type.trim(),
      priority: normalizeToken(draft.priority),
      status: normalizeToken(draft.status),
      target_filing_date: draft.target_filing_date || null,
      description: draft.description.trim() ? draft.description.trim() : null,
      internal_notes: draft.internal_notes.trim() ? draft.internal_notes.trim() : null,
    };

    const success = await onSave(updates);
    if (!success) {
      return;
    }

    setDraft({
      ...draft,
      case_type: updates.case_type,
      priority: updates.priority,
      status: updates.status,
      target_filing_date: updates.target_filing_date ?? '',
      description: updates.description ?? '',
      internal_notes: updates.internal_notes ?? '',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Case Details</h2>
        <p className="text-gray-600">Configure case information and settings</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-semibold text-gray-900">Basic Information</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Case Type</label>
            <input
              type="text"
              value={draft.case_type}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              onChange={(event) => setDraft((previous) => ({ ...previous, case_type: event.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jurisdiction / Office</label>
            <input
              type="text"
              value="Federal - IRCC"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Assigned Lawyer</label>
            <input
              type="text"
              value={workspace.case.primary_lawyer_name ?? 'Unassigned'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={draft.priority}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
              onChange={(event) => setDraft((previous) => ({ ...previous, priority: event.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={draft.status}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 bg-white"
              onChange={(event) => setDraft((previous) => ({ ...previous, status: event.target.value }))}
            >
              <option value="intake">Intake</option>
              <option value="document_collection">Document Collection</option>
              <option value="document_review">Document Review</option>
              <option value="application_prep">In Progress</option>
              <option value="ready_to_submit">Ready To Submit</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="additional_documents_requested">Additional Documents Requested</option>
              <option value="decision_pending">Decision Pending</option>
              <option value="approved">Approved</option>
              <option value="refused">Refused</option>
              <option value="withdrawn">Withdrawn</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="text"
              value={formatDate(workspace.case.start_date)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Filing Date</label>
            <input
              type="date"
              value={draft.target_filing_date}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              onChange={(event) => setDraft((previous) => ({ ...previous, target_filing_date: event.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Completion</label>
            <input
              type="text"
              value={`${formatDate(workspace.case.estimated_completion_from)} - ${formatDate(workspace.case.estimated_completion_to)}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              readOnly
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client-Facing Description
            <span className="text-gray-500 font-normal ml-1">(visible to client)</span>
          </label>
          <textarea
            rows={3}
            value={draft.description}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            onChange={(event) => setDraft((previous) => ({ ...previous, description: event.target.value }))}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Internal Notes
            <span className="text-gray-500 font-normal ml-1">(lawyer only)</span>
          </label>
          <textarea
            rows={3}
            value={draft.internal_notes}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            onChange={(event) => setDraft((previous) => ({ ...previous, internal_notes: event.target.value }))}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleReset}
            disabled={saving}
          >
            Reset
          </button>
          <button
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              void handleSave();
            }}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
