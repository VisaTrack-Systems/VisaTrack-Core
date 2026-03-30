/** AdminSettingsGeneral: adminsettingsgeneral implementation. */

import { Info } from 'lucide-react';

export function AdminSettingsGeneral() {
  return (
    <div className="space-y-8">
      {/* Branding */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Branding & Customization</h3>
          <p className="text-sm text-gray-500 mt-0.5">Customize your organization&apos;s identity within the platform.</p>
        </div>
        <div className="px-6 py-6 space-y-6">
          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <span className="text-xs text-gray-400">No logo</span>
              </div>
              <div>
                <button
                  type="button"
                  disabled
                  className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Upload logo
                </button>
                <p className="text-xs text-gray-500 mt-1">PNG or SVG, max 512 KB. Recommended: 256×256 px.</p>
              </div>
            </div>
          </div>

          {/* Organization display name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="org-display-name">
              Organization Display Name
            </label>
            <input
              id="org-display-name"
              type="text"
              disabled
              placeholder="Your organization name"
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          {/* Primary colour */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="brand-color">
              Brand Accent Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="brand-color"
                type="color"
                disabled
                defaultValue="#dc2626"
                className="w-10 h-10 rounded border border-gray-300 cursor-not-allowed disabled:opacity-50"
              />
              <span className="text-sm text-gray-500">#dc2626 (default)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <Info className="w-4 h-4 shrink-0" />
            Branding customization is not yet implemented. These controls are placeholders for a future release.
          </div>
        </div>
      </div>

      {/* General org settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">General Settings</h3>
          <p className="text-sm text-gray-500 mt-0.5">Basic organization configuration.</p>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="contact-email">
              Contact Email
            </label>
            <input
              id="contact-email"
              type="email"
              disabled
              placeholder="contact@yourfirm.com"
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="timezone">
              Timezone
            </label>
            <select
              id="timezone"
              disabled
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option>America/Toronto (Eastern)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <Info className="w-4 h-4 shrink-0" />
            General settings editing is not yet implemented. These controls are placeholders for a future release.
          </div>
        </div>
      </div>

      {/* Email templates */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Email Templates</h3>
          <p className="text-sm text-gray-500 mt-0.5">Customize automated emails sent to clients and staff.</p>
        </div>
        <div className="px-6 py-6 space-y-4">
          {[
            { label: 'Invitation email', description: 'Sent when a user is invited to the organization.' },
            { label: 'Case status update', description: 'Sent to clients when their case status changes.' },
            { label: 'Document request', description: 'Sent to clients when outstanding documents are needed.' },
          ].map(({ label, description }) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <button
                type="button"
                disabled
                className="border border-gray-300 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit template
              </button>
            </div>
          ))}

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              <strong>Note:</strong> Saving custom email templates requires a new database table (e.g.{' '}
              <code className="font-mono text-xs bg-blue-100 px-1 rounded">email_templates</code>) scoped per
              organization. Backend changes will be needed before this feature is usable.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
