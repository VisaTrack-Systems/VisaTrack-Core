import { ChevronDown, Info, X } from 'lucide-react';
import { useState } from 'react';

import { type InvitationStyles, getInvitationTemplate, saveInvitationTemplate } from '@/lib/api';
import { DialogPanel } from '../DialogPanel';
import { Alert, Button, Card, CardHeader, Input, Label, Select, Textarea } from '../ui';

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
      className={`relative inline-flex w-9 h-5 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${checked ? 'bg-primary-600' : 'bg-gray-300'}`}
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
    <div className="fixed inset-0 z-[80] bg-navy-900/50 flex items-center justify-center p-4">
      <DialogPanel
        labelledBy="invitation-template-title"
        onClose={onClose}
        className="w-full max-w-lg bg-white border border-gray-200 rounded-md shadow-popover flex flex-col max-h-[90vh]"
      >

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 id="invitation-template-title" className="text-base font-semibold text-gray-900">Edit Invitation Email</h2>
            {isCustom && (
              <span className="inline-block mt-1 text-xs font-medium text-primary-700 bg-primary-50 ring-1 ring-inset ring-primary-200 px-2 py-0.5 rounded">
                Custom template active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invitation email editor"
            className="-m-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">

          {/* Message body section */}
          <div className="px-5 py-4 space-y-3">
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
            <Textarea
              rows={9}
              aria-label="Invitation message body"
              value={body}
              onChange={(e) => { onBodyChange(e.target.value); setError(null); }}
              className="font-mono resize-y"
              placeholder="Leave blank to use the default template."
            />
          </div>

          {/* Appearance section (collapsible) */}
          <div className="border-t border-gray-200">
            <button
              type="button"
              onClick={() => setAppearanceOpen((o) => !o)}
              aria-expanded={appearanceOpen}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Appearance
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${appearanceOpen ? 'rotate-180' : ''}`} />
            </button>

            {appearanceOpen && (
              <div className="px-5 pb-5 space-y-4">

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
                      aria-label="Button color picker"
                      className="w-8 h-8 rounded-md border border-gray-300 cursor-pointer p-0.5"
                    />
                    <div className="w-24">
                      <Input
                        compact
                        type="text"
                        aria-label="Button color hex value"
                        value={styles.button_color}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (/^#[0-9a-fA-F]{0,6}$/.test(val)) set('button_color')(val);
                        }}
                        className="font-mono"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>

                {/* Button label */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Button label</p>
                    <p className="text-xs text-gray-500">Text shown on the activation button.</p>
                  </div>
                  <div className="w-48 shrink-0">
                    <Input
                      compact
                      type="text"
                      aria-label="Button label"
                      value={styles.button_label}
                      onChange={(e) => set('button_label')(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                </div>

                {/* Email subject */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700">Email subject</p>
                  <p className="text-xs text-gray-500">Supports the <code className="font-mono bg-gray-100 px-1 rounded">{'{organization_name}'}</code> variable.</p>
                  <Input
                    compact
                    type="text"
                    aria-label="Email subject"
                    value={styles.subject}
                    onChange={(e) => set('subject')(e.target.value)}
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
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-md flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-primary-700 underline underline-offset-2 hover:text-primary-800 transition-colors"
          >
            Reset to default
          </button>
          <div className="flex items-center gap-3">
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save template'}
            </Button>
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
    <div className="space-y-6">
      {/* Branding */}
      <Card>
        <CardHeader
          title="Branding & Customization"
          description="Customize your organization's identity within the platform."
        />
        <div className="px-5 py-5 space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Company Logo</p>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-md border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                <span className="text-xs text-gray-700">No logo</span>
              </div>
              <div>
                <Button type="button" variant="secondary" disabled>
                  Upload logo
                </Button>
                <p className="text-xs text-gray-500 mt-1">PNG or SVG, max 512 KB. Recommended: 256×256 px.</p>
              </div>
            </div>
          </div>
          <div className="max-w-sm">
            <Label htmlFor="org-display-name">Organization Display Name</Label>
            <Input id="org-display-name" type="text" disabled placeholder="Your organization name" />
          </div>
          <div>
            <Label htmlFor="brand-color">Brand Accent Color</Label>
            <div className="flex items-center gap-3">
              <input id="brand-color" type="color" disabled defaultValue="#dc2626"
                className="w-10 h-10 rounded-md border border-gray-300 cursor-not-allowed disabled:opacity-50" />
              <span className="text-sm text-gray-500">#dc2626 (default)</span>
            </div>
          </div>
          <Alert tone="warning" className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            Branding customization is not yet implemented. These controls are placeholders for a future release.
          </Alert>
        </div>
      </Card>

      {/* General settings */}
      <Card>
        <CardHeader title="General Settings" description="Basic organization configuration." />
        <div className="px-5 py-5 space-y-5">
          <div className="max-w-sm">
            <Label htmlFor="contact-email">Contact Email</Label>
            <Input id="contact-email" type="email" disabled placeholder="contact@yourfirm.com" />
          </div>
          <div className="max-w-sm">
            <Label htmlFor="timezone">Timezone</Label>
            <Select id="timezone" disabled>
              <option>America/Toronto (Eastern)</option>
            </Select>
          </div>
          <Alert tone="warning" className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
            General settings editing is not yet implemented. These controls are placeholders for a future release.
          </Alert>
        </div>
      </Card>

      {/* Email templates */}
      <Card>
        <CardHeader title="Email Templates" description="Customize automated emails sent to clients and staff." />
        <div className="px-5 divide-y divide-gray-200">

          {/* Invitation email — enabled */}
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Invitation email</p>
              <p className="text-xs text-gray-700">
                Sent when a user is invited to the organization. Every email adds the business
                address and an unsubscribe link automatically.
                {isCustom && <span className="ml-1 font-medium text-primary-700">Custom template active.</span>}
              </p>
              {loadError ? <p className="text-xs text-red-600 mt-0.5">{loadError}</p> : null}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => void handleOpenDialog()}
              disabled={loadingTemplate}
            >
              {loadingTemplate ? 'Loading…' : 'Edit template'}
            </Button>
          </div>

          {/* Other templates — still placeholder */}
          {[
            { label: 'Case status update', description: 'Sent to clients when their case status changes.' },
            { label: 'Document request', description: 'Sent to clients when outstanding documents are needed.' },
          ].map(({ label, description }) => (
            <div key={label} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
              </div>
              <Button type="button" variant="secondary" size="sm" className="shrink-0" disabled>
                Edit template
              </Button>
            </div>
          ))}
        </div>
      </Card>

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
