import { AlertCircle, Save } from 'lucide-react';

import type { CasePortalPermissions, CaseWorkspace } from '@/lib/api';

import { formatDate, titleize } from '../utils';

type PermissionsSectionProps = {
  workspace: CaseWorkspace;
  portalPermissions: CasePortalPermissions;
  saving: boolean;
  onChange: (next: CasePortalPermissions) => void;
  onReset: () => void;
  onSave: () => void;
};

function VisibilityRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div>
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-sm text-gray-600">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          enabled
            ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
            : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
        }`}
      >
        {enabled ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

export function PermissionsSection({
  workspace,
  portalPermissions,
  saving,
  onChange,
  onReset,
  onSave,
}: PermissionsSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sharing / Permissions</h2>
        <p className="text-gray-600">Control what information is visible to the client</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Active Case Assignments</h3>
        <div className="space-y-3">
          {workspace.assignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{assignment.member_name}</div>
                <div className="text-sm text-gray-600">Role: {titleize(assignment.role)}</div>
              </div>
              <div className="text-xs text-gray-500">Assigned {formatDate(assignment.assigned_at)}</div>
            </div>
          ))}
          {workspace.assignments.length === 0 ? <p className="text-sm text-gray-500">No active assignments found for this case.</p> : null}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Client Portal Visibility</h3>

        <div className="space-y-4">
          <VisibilityRow
            title="Case Status & Progress"
            description="Show current status and completion percentage"
            enabled={portalPermissions.show_case_status_progress}
            onToggle={() =>
              onChange({
                ...portalPermissions,
                show_case_status_progress: !portalPermissions.show_case_status_progress,
              })
            }
          />

          <VisibilityRow
            title="Milestone Details"
            description="Show milestone descriptions and due dates"
            enabled={portalPermissions.show_milestone_details}
            onToggle={() =>
              onChange({
                ...portalPermissions,
                show_milestone_details: !portalPermissions.show_milestone_details,
              })
            }
          />

          <VisibilityRow
            title="Document Requirements"
            description="Show required and optional document list"
            enabled={portalPermissions.show_document_requirements}
            onToggle={() =>
              onChange({
                ...portalPermissions,
                show_document_requirements: !portalPermissions.show_document_requirements,
              })
            }
          />

          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div>
              <div className="font-medium text-gray-900">Internal Notes</div>
              <div className="text-sm text-gray-600">Lawyer-only notes (never visible to client)</div>
            </div>
            <div className="text-sm text-red-700 font-medium">Disabled</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Access Control</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client Portal Access</label>
            <select
              value={portalPermissions.portal_access}
              onChange={(event) =>
                onChange({
                  ...portalPermissions,
                  portal_access: event.target.value as CasePortalPermissions['portal_access'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="full_access">Full Access - Client can view all enabled sections</option>
              <option value="limited_access">Limited Access - Client can only view documents and reminders</option>
              <option value="read_only">Read Only - Client cannot upload or respond</option>
              <option value="disabled">Disabled - Client portal access suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Upload Permissions</label>
            <select
              value={portalPermissions.document_upload}
              onChange={(event) =>
                onChange({
                  ...portalPermissions,
                  document_upload: event.target.value as CasePortalPermissions['document_upload'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="enabled">Enabled - Client can upload requested documents</option>
              <option value="disabled">Disabled - Document upload suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Visibility</label>
            <select
              value={portalPermissions.reminders}
              onChange={(event) =>
                onChange({
                  ...portalPermissions,
                  reminders: event.target.value as CasePortalPermissions['reminders'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            >
              <option value="enabled">Enabled - Client can view lawyer reminders</option>
              <option value="disabled">Disabled - Hide reminders from client portal</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Reset to Default
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Permissions'}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">Important Note</p>
            <p className="text-sm text-amber-700 mt-1">
              Permission changes affect the client portal immediately. Internal notes remain hidden regardless of portal settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
