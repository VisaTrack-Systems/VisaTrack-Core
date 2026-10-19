/**
 * AdminSettingsGeneral: the admin Settings page. A horizontal tab strip (same style as the
 * lawyer Settings page) switches between two groups:
 *   - General & Branding: branding placeholders and the organization's contact email/timezone.
 *   - Communication: the email templates (edited inline) and where lawyers' banners appear.
 */

import {
  Building2,
  Check,
  Clock,
  CloudUpload,
  FileText,
  Info,
  Mail,
  RefreshCw,
  Send,
  type LucideIcon,
} from 'lucide-react';
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';

import {
  type BannerPosition,
  type EmailTemplatesOverview,
  type InvitationStyles,
  type NotificationTemplateKey,
  extractTemplateText,
  getEmailTemplates,
  getGeneralSettings,
  getInvitationTemplate,
  saveEmailSettings,
  saveEmailTemplate,
  saveGeneralSettings,
  saveInvitationTemplate,
} from '@/lib/api';
import { PageHeader } from '../AppShell';
import { Alert, Button, Card, CardHeader, FieldHint, Input, Label, Select } from '../ui';
import {
  InsertVariableMenu,
  RichTextEditor,
  type RichTextEditorHandle,
  VariableReference,
  isHtmlEmpty,
  normalizeHtml,
  plainTextToHtml,
  templateBodyToHtml,
} from './EmailTemplateEditor';

// Must match DEFAULT_INVITATION_TEMPLATE in backend/app/services/email.py.
const DEFAULT_INVITATION_TEMPLATE =
  'Hi {recipient_name},\n\n' +
  'You have been invited by {lawyer_name} to join {organization_name} on VisaTrack, ' +
  'a secure legal workflow platform.\n\n' +
  'To activate your account and set your password, please click the link below:\n' +
  '{invitation_url}\n\n' +
  'This link is secure and will expire in 72 hours. If you were not expecting this invitation, ' +
  'please disregard this email or contact us immediately.\n\n' +
  '---\n\n' +
  'IMPORTANT CONFIDENTIALITY & LEGAL NOTICE:\n' +
  'This email and any attachments are intended solely for the confidential use of the intended ' +
  'recipient. VisaTrack is a software platform provider and does not provide legal representation ' +
  'or immigration advice. Legal services are provided directly by {organization_name}.\n\n' +
  '{organization_name}\n' +
  'Contact: {organization_main_email}\n' +
  'RCIC / Law Society License #: {license_number}\n\n' +
  'VisaTrack Technologies Inc. | support@visatrack.ca';

// Must match DEFAULT_INVITATION_SUBJECT in backend/app/services/email.py.
const DEFAULT_STYLES: InvitationStyles = {
  button_color: '#dc2626',
  button_label: 'Activate my account',
  subject: 'Invitation to join {organization_name} on VisaTrack',
  bold_org_name: true,
};

// Must match the server limits in backend/app/services/email_notifications.py.
const TEMPLATE_FILE_EXTENSIONS = ['.txt', '.pdf'];
const TEMPLATE_FILE_MAX_BYTES = 2 * 1024 * 1024;
// A "Subject: ..." line in an uploaded file fills the subject field.
const SUBJECT_LINE = /^[ \t]*subject[ \t]*:[ \t]*(.+?)[ \t]*$/im;

type SettingsGroup = 'general' | 'communication';

const SETTINGS_GROUPS: Array<{ id: SettingsGroup; label: string; icon: LucideIcon }> = [
  { id: 'general', label: 'General & Branding', icon: Building2 },
  { id: 'communication', label: 'Communication', icon: Mail },
];

type TemplateTabKey = 'invitation' | NotificationTemplateKey;

const TEMPLATE_TABS: Array<{ key: TemplateTabKey; label: string; icon: LucideIcon }> = [
  { key: 'invitation', label: 'Invitation Email', icon: Send },
  { key: 'case_status_update', label: 'Case Status Update', icon: RefreshCw },
  { key: 'document_request', label: 'Document Request', icon: FileText },
  { key: 'reminder', label: 'Reminder', icon: Clock },
];

// ── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  large = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  large?: boolean;
}) {
  const track = large ? 'w-11 h-6' : 'w-9 h-5';
  const thumb = large ? 'w-5 h-5' : 'w-4 h-4';
  const offset = large ? 'translate-x-5' : 'translate-x-4';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex ${track} shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:opacity-50 ${checked ? 'bg-primary-600' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block ${thumb} mt-0.5 ml-0.5 bg-white rounded-full shadow transition-transform ${checked ? offset : 'translate-x-0'}`}
      />
    </button>
  );
}

// ── Branding (placeholders) ──────────────────────────────────────────────────

function BrandingCard() {
  return (
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
  );
}

// ── General settings (contact email, timezone) ───────────────────────────────

function GeneralSettingsCard() {
  const [contactEmail, setContactEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [timezone, setTimezone] = useState('');
  const [timezones, setTimezones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let ignore = false;
    getGeneralSettings()
      .then((result) => {
        if (ignore) return;
        setContactEmail(result.contact_email);
        setSupportEmail(result.support_email);
        setLicenseNumber(result.license_number);
        setTimezone(result.timezone);
        setTimezones(result.available_timezones);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof Error ? err.message : 'Failed to load general settings.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    const email = contactEmail.trim();
    const support = supportEmail.trim();
    if (!email.includes('@')) {
      setError('Enter a valid main contact email.');
      return;
    }
    if (support && !support.includes('@')) {
      setError('Enter a valid support email, or leave it blank.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveGeneralSettings({
        contact_email: email,
        support_email: support,
        license_number: licenseNumber.trim(),
        timezone,
      });
      setContactEmail(result.contact_email);
      setSupportEmail(result.support_email);
      setLicenseNumber(result.license_number);
      setTimezone(result.timezone);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save general settings.');
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <Card>
      <CardHeader title="General Settings" description="Basic organization configuration." />
      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="max-w-sm">
          <Label htmlFor="contact-email">Main Contact Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={contactEmail}
            onChange={(event) => {
              setContactEmail(event.target.value);
              setSaved(false);
            }}
            disabled={disabled}
            placeholder="contact@yourfirm.com"
            required
          />
          <FieldHint>
            The main address clients and VisaTrack use to reach your firm. 
          </FieldHint>
        </div>
        <div className="max-w-sm">
          <Label htmlFor="support-email">Support Email</Label>
          <Input
            id="support-email"
            type="email"
            value={supportEmail}
            onChange={(event) => {
              setSupportEmail(event.target.value);
              setSaved(false);
            }}
            disabled={disabled}
            placeholder="support@yourfirm.com"
          />
          <FieldHint>
            Where clients can get help. Leave blank to use the main contact email.
          </FieldHint>
        </div>
        <div className="max-w-sm">
          <Label htmlFor="license-number">RCIC / Law Society License #</Label>
          <Input
            id="license-number"
            type="text"
            value={licenseNumber}
            maxLength={100}
            onChange={(event) => {
              setLicenseNumber(event.target.value);
              setSaved(false);
            }}
            disabled={disabled}
            placeholder="R123456"
          />
          <FieldHint>Shown in emails that use the {'{license_number}'} variable.</FieldHint>
        </div>
        <div className="max-w-sm">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            id="timezone"
            value={timezone}
            onChange={(event) => {
              setTimezone(event.target.value);
              setSaved(false);
            }}
            disabled={disabled}
          >
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
          <FieldHint>Your organization&apos;s default timezone.</FieldHint>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={disabled}>
            {saving ? 'Saving...' : 'Save settings'}
          </Button>
          {saved ? (
            <p role="status" className="text-sm text-green-700">
              Settings saved.
            </p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

// ── Email template panel (one tab) ───────────────────────────────────────────

/** One template as the editor sees it, whether it is the invitation or a case notification. */
type EditableTemplate = {
  key: TemplateTabKey;
  label: string;
  body: string;
  defaultBody: string;
  subject: string;
  defaultSubject: string;
  enabled: boolean;
  isCustom: boolean;
  variables: string[];
};

/** Unsaved edits, kept while the admin switches between template tabs. */
type TemplateDraft = { body: string; subject: string };

type TemplatePanelProps = {
  template: EditableTemplate;
  draft: TemplateDraft | undefined;
  onDraftChange: (draft: TemplateDraft) => void;
  onToggle: (enabled: boolean) => void;
  toggleDisabled: boolean;
  /** An empty body or subject means "use the default". */
  onSave: (body: string, subject: string) => Promise<void>;
};

function TemplatePanel({ template, draft, onDraftChange, onToggle, toggleDisabled, onSave }: TemplatePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichTextEditorHandle>(null);
  // The one Insert Variable menu fills whichever field the admin was last in.
  const [activeField, setActiveField] = useState<'subject' | 'body'>('body');
  const [body, setBody] = useState(() => draft?.body ?? templateBodyToHtml(template.body));
  const [subject, setSubject] = useState(draft?.subject ?? template.subject);
  // Bumped to reload the editor after its content is replaced (file upload, reset).
  const [editorVersion, setEditorVersion] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const subjectId = `template-subject-${template.key}`;

  const updateDraft = (next: TemplateDraft) => {
    setBody(next.body);
    setSubject(next.subject);
    onDraftChange(next);
  };

  const replaceContent = (next: TemplateDraft) => {
    updateDraft(next);
    setEditorVersion((version) => version + 1);
  };

  // Puts the variable where the cursor is in the subject (or at the end), then moves the cursor after it.
  const insertSubjectVariable = (variable: string) => {
    const input = subjectInputRef.current;
    const start = input?.selectionStart ?? subject.length;
    const end = input?.selectionEnd ?? subject.length;
    updateDraft({ body, subject: subject.slice(0, start) + variable + subject.slice(end) });
    const cursor = start + variable.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(cursor, cursor);
    });
  };

  const insertVariable = (variable: string) => {
    if (activeField === 'subject') {
      insertSubjectVariable(variable);
    } else {
      editorRef.current?.insertText(variable);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so choosing the same file again still fires onChange.
    event.target.value = '';
    if (!file) {
      return;
    }

    setError(null);
    setMessage(null);
    const lowerName = file.name.toLowerCase();
    if (!TEMPLATE_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
      setError('Only .txt and .pdf files can be used as email templates.');
      return;
    }
    if (file.size > TEMPLATE_FILE_MAX_BYTES) {
      setError('Template files must be 2 MB or smaller.');
      return;
    }

    setReadingFile(true);
    try {
      let text = await extractTemplateText(file);
      let nextSubject = subject;
      const subjectMatch = SUBJECT_LINE.exec(text);
      if (subjectMatch) {
        nextSubject = subjectMatch[1];
        text = text.replace(subjectMatch[0], '');
      }
      replaceContent({ body: plainTextToHtml(text), subject: nextSubject });
      setMessage(`Imported text from ${file.name}. Review it, then save the template.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the file.');
    } finally {
      setReadingFile(false);
    }
  };

  const handleReset = () => {
    replaceContent({ body: templateBodyToHtml(template.defaultBody), subject: template.defaultSubject });
    setError(null);
    setMessage('Default template restored. Save the template to apply it.');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    const defaultHtml = normalizeHtml(templateBodyToHtml(template.defaultBody));
    // An empty editor, or the default text unchanged, is stored as "no custom template".
    const usesDefaultBody = isHtmlEmpty(body) || normalizeHtml(body) === defaultHtml;
    const trimmedSubject = subject.trim();
    try {
      await onSave(usesDefaultBody ? '' : body, trimmedSubject === template.defaultSubject ? '' : trimmedSubject);
      if (isHtmlEmpty(body) || !trimmedSubject) {
        replaceContent({
          body: isHtmlEmpty(body) ? defaultHtml : body,
          subject: trimmedSubject || template.defaultSubject,
        });
      }
      setMessage(usesDefaultBody ? 'Saved. This email uses the default text.' : 'Template saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const isInvitation = template.key === 'invitation';

  return (
    <div className="space-y-5 px-5 py-5">
      {/* Activation + upload */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 px-4 py-4">
        <div className="flex items-center gap-3">
          <Toggle
            large
            checked={template.enabled}
            onChange={onToggle}
            disabled={toggleDisabled}
            label={`Send ${template.label.toLowerCase()} emails`}
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Enable Template for Organization</p>
            <p className="text-xs text-gray-600">
              {isInvitation
                ? 'When active, admins and lawyers can email invitation links.'
                : 'When active, lawyers can send this notification type.'}
              {template.isCustom ? <span className="ml-1 font-medium text-primary-700">Custom template active.</span> : null}
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,text/plain,application/pdf"
          className="sr-only"
          aria-label="Upload template file"
          onChange={(event) => void handleFile(event)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          disabled={readingFile}
          title="Accepted files: .txt or .pdf, up to 2 MB. Scanned PDFs cannot be read."
        >
          <CloudUpload className="h-4 w-4" aria-hidden="true" />
          {readingFile ? 'Reading file…' : 'Upload Template (.pdf / .txt)'}
        </Button>
      </div>

      {/* Editor header: one variable menu for both the subject and the body */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-3">
        <h3 className="text-base font-semibold text-gray-900">Template Editor: {template.label}</h3>
        <div className="flex items-center gap-1">
          <VariableReference variables={template.variables} />
          <InsertVariableMenu
            // In the subject the full case number is left out: subject lines show without signing in.
            variables={
              activeField === 'subject'
                ? template.variables.filter((variable) => variable !== '{case_number}')
                : template.variables
            }
            disabled={false}
            onInsert={insertVariable}
          />
        </div>
      </div>

      {/* Subject */}
      <div>
        <label htmlFor={subjectId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-700">
          Email Subject Line
        </label>
        <Input
          ref={subjectInputRef}
          id={subjectId}
          type="text"
          value={subject}
          maxLength={255}
          onFocus={() => setActiveField('subject')}
          onChange={(event) => updateDraft({ body, subject: event.target.value })}
          placeholder={template.defaultSubject}
        />
      </div>

      {/* Body */}
      <RichTextEditor
        ref={editorRef}
        key={`${template.key}-${editorVersion}`}
        initialHtml={body}
        onChange={(html) => updateDraft({ body: html, subject })}
        onFocus={() => setActiveField('body')}
        label={`${template.label} message body`}
      />

      {error ? <Alert tone="danger" role="alert">{error}</Alert> : null}
      {message ? <Alert tone="success" role="status">{message}</Alert> : null}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-md text-xs italic text-gray-500">
          {isInvitation
            ? '*Turning invitations off stops VisaTrack from emailing invitation links. You can still copy a link and share it yourself.'
            : '*Turning a type off stops that email for everyone in the organization, even lawyers who opted in. Lawyers can also opt out of each type in their own Settings → Communication tab.'}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={handleReset}>
            Reset to Default
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            <Check className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Saving…' : 'Save Template'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Communication group (templates + banner placement) ───────────────────────

type InvitationTemplateState = { body: string; isCustom: boolean; styles: InvitationStyles };

function CommunicationSettings() {
  const [overview, setOverview] = useState<EmailTemplatesOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationTemplateState | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<TemplateTabKey>('invitation');
  const [drafts, setDrafts] = useState<Partial<Record<TemplateTabKey, TemplateDraft>>>({});

  useEffect(() => {
    let ignore = false;
    getEmailTemplates()
      .then((result) => {
        if (!ignore) setOverview(result);
      })
      .catch((err) => {
        if (!ignore) setOverviewError(err instanceof Error ? err.message : 'Failed to load email templates.');
      });
    getInvitationTemplate()
      .then((result) => {
        if (!ignore) setInvitation({ body: result.body, isCustom: result.is_custom, styles: result.styles });
      })
      .catch((err) => {
        if (!ignore) setInvitationError(err instanceof Error ? err.message : 'Failed to load the invitation template.');
      });
    return () => {
      ignore = true;
    };
  }, []);

  /** Saves toggles and banner position immediately; restores the previous values if saving fails. */
  const updateSettings = async (next: EmailTemplatesOverview) => {
    if (!overview) {
      return;
    }
    const previous = overview;
    setOverview(next);
    setSettingsError(null);
    setSavingSettings(true);
    try {
      await saveEmailSettings({
        banner_position: next.banner_position,
        enabled_templates: Object.fromEntries(next.templates.map((t) => [t.key, t.enabled])),
        invitation_enabled: next.invitation_enabled,
      });
    } catch (err) {
      setOverview(previous);
      setSettingsError(err instanceof Error ? err.message : 'Failed to save email settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggle = (key: TemplateTabKey, enabled: boolean) => {
    if (!overview) return;
    if (key === 'invitation') {
      void updateSettings({ ...overview, invitation_enabled: enabled });
      return;
    }
    void updateSettings({
      ...overview,
      templates: overview.templates.map((t) => (t.key === key ? { ...t, enabled } : t)),
    });
  };

  const handleBannerPosition = (position: BannerPosition) => {
    if (!overview || overview.banner_position === position) return;
    void updateSettings({ ...overview, banner_position: position });
  };

  const clearDraft = (key: TemplateTabKey) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSave = async (key: TemplateTabKey, body: string, subject: string) => {
    if (key === 'invitation') {
      const styles = { ...(invitation?.styles ?? DEFAULT_STYLES), subject: subject || DEFAULT_STYLES.subject };
      await saveInvitationTemplate(body, styles);
      setInvitation({ body: body || DEFAULT_INVITATION_TEMPLATE, isCustom: body.length > 0, styles });
    } else {
      await saveEmailTemplate(key, body, subject);
      setOverview((current) =>
        current
          ? {
              ...current,
              templates: current.templates.map((t) =>
                t.key === key
                  ? { ...t, body: body || t.default_body, subject: subject || t.default_subject, is_custom: body.length > 0 }
                  : t
              ),
            }
          : current
      );
    }
    clearDraft(key);
  };

  /** The template shown on a tab, or null while it is loading (or if it failed to load). */
  const editableTemplate = (key: TemplateTabKey, label: string): EditableTemplate | null => {
    if (!overview) return null;
    if (key === 'invitation') {
      if (!invitation) return null;
      return {
        key,
        label,
        body: invitation.body,
        defaultBody: DEFAULT_INVITATION_TEMPLATE,
        subject: invitation.styles.subject || DEFAULT_STYLES.subject,
        defaultSubject: DEFAULT_STYLES.subject,
        enabled: overview.invitation_enabled,
        isCustom: invitation.isCustom,
        variables: overview.invitation_variables,
      };
    }
    const template = overview.templates.find((t) => t.key === key);
    if (!template) return null;
    return {
      key,
      label,
      body: template.body,
      defaultBody: template.default_body,
      subject: template.subject,
      defaultSubject: template.default_subject,
      enabled: template.enabled,
      isCustom: template.is_custom,
      variables: template.variables,
    };
  };

  // Show the invitation tab plus each notification type the server knows about.
  const tabs = TEMPLATE_TABS.filter(
    (tab) => tab.key === 'invitation' || overview?.templates.some((t) => t.key === tab.key)
  );
  const activeTabInfo = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];
  const activeTemplate = editableTemplate(activeTabInfo.key, activeTabInfo.label);
  const activeTabError = activeTabInfo.key === 'invitation' ? invitationError : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Email Templates" description="Customize automated emails sent to clients and staff." />
        {overviewError ? (
          <div className="px-5 py-4">
            <Alert tone="danger">{overviewError}</Alert>
          </div>
        ) : null}
        {!overview && !overviewError ? <p className="px-5 py-4 text-sm text-gray-500">Loading email templates…</p> : null}

        {overview ? (
          <>
            <div role="tablist" aria-label="Email templates" className="flex gap-1 overflow-x-auto border-b border-gray-200 px-5">
              {tabs.map((tab) => {
                const isActive = tab.key === activeTabInfo.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`template-tab-${tab.key}`}
                    aria-selected={isActive}
                    aria-controls="template-tab-panel"
                    onClick={() => setActiveTab(tab.key)}
                    className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                      isActive
                        ? 'border-primary-600 font-semibold text-primary-700'
                        : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div role="tabpanel" id="template-tab-panel" aria-labelledby={`template-tab-${activeTabInfo.key}`}>
              {settingsError ? (
                <div className="px-5 pt-4">
                  <Alert tone="danger">{settingsError}</Alert>
                </div>
              ) : null}
              {activeTemplate ? (
                <TemplatePanel
                  // A new panel per tab, so each starts from its own template (or unsaved draft).
                  key={activeTemplate.key}
                  template={activeTemplate}
                  draft={drafts[activeTemplate.key]}
                  onDraftChange={(draft) => setDrafts((current) => ({ ...current, [activeTemplate.key]: draft }))}
                  onToggle={(enabled) => handleToggle(activeTemplate.key, enabled)}
                  toggleDisabled={savingSettings}
                  onSave={(body, subject) => handleSave(activeTemplate.key, body, subject)}
                />
              ) : (
                <div className="px-5 py-4">
                  {activeTabError ? (
                    <Alert tone="danger">{activeTabError}</Alert>
                  ) : (
                    <p className="text-sm text-gray-500">Loading template…</p>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </Card>

      {overview ? (
        <Card>
          <CardHeader
            title="Email Banner Placement"
            description="Where lawyers' branding banners appear in notification emails."
          />
          <div className="px-5 py-5 space-y-3">
            <p className="text-sm text-gray-700">
              Lawyers can upload an email banner in Communication settings and choose whether it displays at the top or bottom.
            </p>
            <div role="radiogroup" aria-label="Banner position" className="inline-flex rounded-md border border-gray-300 p-0.5">
              {(['top', 'bottom'] as const).map((position) => {
                const selected = overview.banner_position === position;
                return (
                  <button
                    key={position}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={savingSettings}
                    onClick={() => handleBannerPosition(position)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                      selected ? 'bg-primary-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {position === 'top' ? 'Top of email' : 'Bottom of email'}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

// ── Main settings component ──────────────────────────────────────────────────

export function AdminSettingsGeneral({ headerActions }: { headerActions?: ReactNode }) {
  const [activeGroup, setActiveGroup] = useState<SettingsGroup>('general');

  return (
    <>
      <PageHeader
        title="Organization Settings"
        description="Branding, organization configuration, and email communication."
        actions={headerActions}
      >
        <nav aria-label="Settings sections" className="px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {SETTINGS_GROUPS.map((group) => {
              const isActive = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveGroup(group.id)}
                  className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'border-primary-600 font-semibold text-primary-700'
                      : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
                  }`}
                >
                  <group.icon className="h-4 w-4" aria-hidden="true" />
                  {group.label}
                </button>
              );
            })}
          </div>
        </nav>
      </PageHeader>

      {/* Both groups stay mounted (just hidden) so switching keeps loaded data and unsaved edits. */}
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div hidden={activeGroup !== 'general'} className="space-y-6">
          <BrandingCard />
          <GeneralSettingsCard />
        </div>
        <div hidden={activeGroup !== 'communication'}>
          <CommunicationSettings />
        </div>
      </div>
    </>
  );
}
