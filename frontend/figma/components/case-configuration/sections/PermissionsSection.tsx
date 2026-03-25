import { AlertCircle, Save } from 'lucide-react';
import { useState } from 'react';

import type { CasePortalPermissions } from '@/lib/api';

type PermissionsSectionProps = {
  portalPermissions: CasePortalPermissions;
  defaultPortalPermissions: CasePortalPermissions;
  saving: boolean;
  onReset: () => void;
  onSave: (next: CasePortalPermissions) => Promise<boolean>;
};

function hasPermissionChanges(
  current: CasePortalPermissions,
  baseline: CasePortalPermissions
): boolean {
  return (
    current.show_case_status_progress !== baseline.show_case_status_progress ||
    current.show_milestone_details !== baseline.show_milestone_details ||
    current.show_document_requirements !== baseline.show_document_requirements ||
    current.portal_access !== baseline.portal_access ||
    current.document_upload !== baseline.document_upload ||
    current.reminders !== baseline.reminders
  );
}

function VisibilityRow({
  title,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
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
        disabled={disabled}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
          enabled
            ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
            : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {enabled ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  );
}

export function PermissionsSection({
  portalPermissions,
  defaultPortalPermissions,
  saving,
  onReset,
  onSave,
}: PermissionsSectionProps) {
  const [draftPermissions, setDraftPermissions] = useState<CasePortalPermissions>(portalPermissions);
  const [hasLocalChanges, setHasLocalChanges] = useState(false);

  const effectivePermissions = hasLocalChanges ? draftPermissions : portalPermissions;

  const isDisabled = saving;
  const hasUnsavedChanges = hasPermissionChanges(effectivePermissions, portalPermissions);

  const handleResetToDefault = () => {
    if (saving) {
      return;
    }

    setDraftPermissions(defaultPortalPermissions);
    setHasLocalChanges(true);
    onReset();
  };

  const handleSave = async () => {
    const success = await onSave(effectivePermissions);
    if (success) {
      setHasLocalChanges(false);
    }
  };

  const toggleVisibility = (key: keyof Pick<CasePortalPermissions, 'show_case_status_progress' | 'show_milestone_details' | 'show_document_requirements'>) => {
    if (isDisabled) {
      return;
    }

    const currentPermissions = hasLocalChanges ? draftPermissions : portalPermissions;
    setDraftPermissions((previous) => ({
      ...(hasLocalChanges ? previous : currentPermissions),
      [key]: !currentPermissions[key],
    }));
    setHasLocalChanges(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sharing / Permissions</h2>
        <p className="text-gray-600">Control what information is visible to the client</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Access Control</h3>

        <div className="mb-4 text-sm">
          {hasUnsavedChanges ? (
            <p className="text-amber-700">Unsaved changes. Click “Save Permissions” to apply them.</p>
          ) : (
            <p className="text-gray-600">Changes here are editable by default.</p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client Portal Access</label>
            <select
              value={effectivePermissions.portal_access}
              onChange={(event) => {
                setDraftPermissions((previous) => ({
                  ...(hasLocalChanges ? previous : portalPermissions),
                  portal_access: event.target.value as CasePortalPermissions['portal_access'],
                }));
                setHasLocalChanges(true);
              }}
              disabled={isDisabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="full_access">Full Access - Client can view all enabled sections (status, milestones, and checklist)</option>
              <option value="limited_access">Limited Access - Client sees core updates only (checklist and reminders)</option>
              <option value="read_only">Read Only - Client can view enabled information but cannot upload or respond</option>
              <option value="disabled">Disabled - Client portal access suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Document Upload Permissions</label>
            <select
              value={effectivePermissions.document_upload}
              onChange={(event) => {
                setDraftPermissions((previous) => ({
                  ...(hasLocalChanges ? previous : portalPermissions),
                  document_upload: event.target.value as CasePortalPermissions['document_upload'],
                }));
                setHasLocalChanges(true);
              }}
              disabled={isDisabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="enabled">Enabled - Client can upload requested documents</option>
              <option value="disabled">Disabled - Document upload suspended</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reminder Visibility</label>
            <select
              value={effectivePermissions.reminders}
              onChange={(event) => {
                setDraftPermissions((previous) => ({
                  ...(hasLocalChanges ? previous : portalPermissions),
                  reminders: event.target.value as CasePortalPermissions['reminders'],
                }));
                setHasLocalChanges(true);
              }}
              disabled={isDisabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-500"
            >
              <option value="enabled">Enabled - Client can view case reminders</option>
              <option value="disabled">Disabled - Hide reminders from client portal</option>
            </select>
          </div>

          <div className="pt-2 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Client Portal Visibility</h4>
            <div className="space-y-4">
              <VisibilityRow
                title="Case Status"
                description="Show the current case status to the client"
                enabled={effectivePermissions.show_case_status_progress}
                disabled={isDisabled}
                onToggle={() => toggleVisibility('show_case_status_progress')}
              />

              <VisibilityRow
                title="Milestones"
                description="Show milestone names, details, and due dates"
                enabled={effectivePermissions.show_milestone_details}
                disabled={isDisabled}
                onToggle={() => toggleVisibility('show_milestone_details')}
              />

              <VisibilityRow
                title="Document Checklist"
                description="Show required and optional document items"
                enabled={effectivePermissions.show_document_requirements}
                disabled={isDisabled}
                onToggle={() => toggleVisibility('show_document_requirements')}
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
            <div>
              <div className="font-medium text-gray-900">Internal Notes</div>
              <div className="text-sm text-gray-600">Lawyer-only notes (never visible to client)</div>
            </div>
            <div className="text-sm text-red-700 font-medium">Disabled</div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleResetToDefault}
            disabled={isDisabled}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            Reset to Default
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={isDisabled}
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
