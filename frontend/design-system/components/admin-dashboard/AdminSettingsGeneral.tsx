import { ChevronDown, Info, X } from 'lucide-react';
import { useState } from 'react';

import { type InvitationStyles, getInvitationTemplate, saveInvitationTemplate } from '@/lib/api';
import { DialogPanel } from '../DialogPanel';

const DEFAULT_INVITATION_TEMPLATE =
  'Hi {recipient_name},\n\n' +
  'You have been invited to join {organization_name} on VisaTrack. ' +
  'Click the link below to set your password and activate your account.\n\n' +
  '{invitation_url}\n\n' +
  'This link expires in 72 hours. If you did not expect this invitation, ' +
  'you can safely ignore this email.\n\n' +
  '— The {organization_name} Team';

const DEFAULT_STYLES: InvitationStyles = {
  button_color: '#dc2626',
  button_label: 'Activate my account',
  subject: 'You have been invited to join {organization_name}',
  bold_org_name: true,
};

const TEMPLATE_VARIABLES = ['{recipient_name}', '{organization_name}', '{invitation_url}'];

// ── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-9 h-5 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 ${checked ? 'bg-red-600' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block w-4 h-4 mt-0.5 ml-0.5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  );
}

// ── Template dialog ──────────────────────────────────────────────────────────

type TemplateDialogProps = {
  body: string;
  onBodyChange: (value: string) => void;
  styles: InvitationStyles;
  onStylesChange: (styles: InvitationStyles) => void;
  isCustom: boolean;
  onSave: (body: string, styles: InvitationStyles) => Promise<void>;
  onClose: () => void;
};

function TemplateDialog({
  body,
  onBodyChange,
  styles,
  onStylesChange,
  isCustom,
  onSave,
  onClose,
}: TemplateDialogProps) {
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(body, styles);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    onBodyChange(DEFAULT_INVITATION_TEMPLATE);
    onStylesChange(DEFAULT_STYLES);
    setError(null);
  };

  const set = (field: keyof InvitationStyles) => (value: string | boolean) =>
    onStylesChange({ ...styles, [field]: value });

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <DialogPanel
        labelledBy="invitation-template-title"
        onClose={onClose}
        className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-xl flex flex-col max-h-[90vh]"
      >

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 id="invitation-template-title" className="text-lg font-semibold text-gray-900">Edit Invitation Email</h2>
            {isCustom && (
              <span className="inline-block mt-1 text-xs text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                Custom template active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invitation email editor"
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Message body section */}
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm text-gray-600">
              Edit the message body sent to invitees. Leave blank to reset to the default.
            </p>
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs text-gray-500">Variables:</span>
              {TEMPLATE_VARIABLES.map((v) => (
                <code key={v} className="text-xs font-mono bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">
                  {v}
                </code>
              ))}
            </div>
            <textarea
              rows={9}
              value={body}
              onChange={(e) => { onBodyChange(e.target.value); setError(null); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
              placeholder="Leave blank to use the default template."
            />
          </div>

          {/* Appearance section (collapsible) */}
          <div className="border-t border-gray-200">
            <button
              type="button"
              onClick={() => setAppearanceOpen((o) => !o)}
              className="w-full flex items-center justify-between px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Appearance
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
            </button>

            {appearanceOpen && (
              <div className="px-6 pb-5 space-y-4">

                {/* Button color */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Button color</p>
                    <p className="text-xs text-gray-500">The &quot;Activate my account&quot; button background.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="color"
                      value={styles.button_color}
                      onChange={(e) => set('button_color')(e.target.value)}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={styles.button_color}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9a-fA-F]{0,6}$/.test(val)) set('button_color')(val);
                      }}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm font-mono"
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Button label */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Button label</p>
                    <p className="text-xs text-gray-500">Text shown on the activation button.</p>
                  </div>
                  <input
                    type="text"
                    value={styles.button_label}
                    onChange={(e) => set('button_label')(e.target.value)}
                    className="w-48 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    maxLength={100}
                  />
                </div>

                {/* Email subject */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700">Email subject</p>
                  <p className="text-xs text-gray-500">Supports the <code className="font-mono bg-gray-100 px-1 rounded">{'{organization_name}'}</code> variable.</p>
                  <input
                    type="text"
                    value={styles.subject}
                    onChange={(e) => set('subject')(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    maxLength={255}
                  />
                </div>

                {/* Bold org name */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Bold organization name</p>
                    <p className="text-xs text-gray-500">Renders <code className="font-mono bg-gray-100 px-1 rounded">{'{organization_name}'}</code> in bold in the email.</p>
                  </div>
                  <Toggle checked={styles.bold_org_name} onChange={(v) => set('bold_org_name')(v)} />
                </div>

              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-500 underline hover:text-gray-700 transition-colors"
          >
            Reset to default
          </button>
          <div className="flex items-center gap-3">
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white transition-colors"
            >
              {saving ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </div>
      </DialogPanel>
    </div>
  );
}

// ── Main settings component ──────────────────────────────────────────────────

export function AdminSettingsGeneral() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateBody, setTemplateBody] = useState('');
  const [styles, setStyles] = useState<InvitationStyles>(DEFAULT_STYLES);
  const [isCustom, setIsCustom] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleOpenDialog = async () => {
    setLoadingTemplate(true);
    setLoadError(null);
    try {
      const result = await getInvitationTemplate();
      setTemplateBody(result.body);
      setStyles(result.styles);
      setIsCustom(result.is_custom);
      setDialogOpen(true);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load template.');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleSave = async (body: string, updatedStyles: InvitationStyles) => {
    await saveInvitationTemplate(body, updatedStyles);
    setTemplateBody(body);
    setStyles(updatedStyles);
    setIsCustom(body.trim().length > 0);
  };

  return (
    <div className="space-y-8">
      {/* Branding */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Branding & Customization</h3>
          <p className="text-sm text-gray-500 mt-0.5">Customize your organization&apos;s identity within the platform.</p>
        </div>
        <div className="px-6 py-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <span className="text-xs text-gray-400">No logo</span>
              </div>
              <div>
                <button type="button" disabled className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                  Upload logo
                </button>
                <p className="text-xs text-gray-500 mt-1">PNG or SVG, max 512 KB. Recommended: 256×256 px.</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="org-display-name">Organization Display Name</label>
            <input id="org-display-name" type="text" disabled placeholder="Your organization name"
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="brand-color">Brand Accent Color</label>
            <div className="flex items-center gap-3">
              <input id="brand-color" type="color" disabled defaultValue="#dc2626"
                className="w-10 h-10 rounded border border-gray-300 cursor-not-allowed disabled:opacity-50" />
              <span className="text-sm text-gray-500">#dc2626 (default)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <Info className="w-4 h-4 shrink-0" />
            Branding customization is not yet implemented. These controls are placeholders for a future release.
          </div>
        </div>
      </div>

      {/* General settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">General Settings</h3>
          <p className="text-sm text-gray-500 mt-0.5">Basic organization configuration.</p>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="contact-email">Contact Email</label>
            <input id="contact-email" type="email" disabled placeholder="contact@yourfirm.com"
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="timezone">Timezone</label>
            <select id="timezone" disabled
              className="w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50 disabled:text-gray-500">
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

          {/* Invitation email — enabled */}
          <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-900">Invitation email</p>
              <p className="text-xs text-gray-500">
                Sent when a user is invited to the organization.
                {isCustom && <span className="ml-1 text-blue-600">Custom template active.</span>}
              </p>
              {loadError ? <p className="text-xs text-red-600 mt-0.5">{loadError}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void handleOpenDialog()}
              disabled={loadingTemplate}
              className="border border-gray-300 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loadingTemplate ? 'Loading…' : 'Edit template'}
            </button>
          </div>

          {/* Other templates — still placeholder */}
          {[
            { label: 'Case status update', description: 'Sent to clients when their case status changes.' },
            { label: 'Document request', description: 'Sent to clients when outstanding documents are needed.' },
          ].map(({ label, description }) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <button type="button" disabled
                className="border border-gray-300 px-3 py-1.5 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                Edit template
              </button>
            </div>
          ))}
        </div>
      </div>

      {dialogOpen && (
        <TemplateDialog
          body={templateBody}
          onBodyChange={setTemplateBody}
          styles={styles}
          onStylesChange={setStyles}
          isCustom={isCustom}
          onSave={handleSave}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
