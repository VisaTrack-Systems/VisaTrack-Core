/**
 * LawyerSettings: Settings page in the lawyer view. A horizontal tab strip (same style as the
 * case workspace tabs) switches between:
 *   - Profile: the account controls also shown in the Profile dialog.
 *   - Communication: the lawyer's email banner and which notification emails they send.
 */

import { ImageIcon, Mail, Upload, User, type LucideIcon } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import {
  type CurrentUserSettings,
  type LawyerCommunicationSettings,
  type NotificationTemplateKey,
  type UpdateCurrentUserSettingsInput,
  deleteEmailBanner,
  getCommunicationSettings,
  updateCommunicationSettings,
  uploadEmailBanner,
} from '@/lib/api';

import { PageHeader } from './AppShell';
import { ProfileSettingsForm } from './ProfileSettingsDialog';
import { Alert, Button, Card, CardHeader, FieldHint } from './ui';

export type LawyerSettingsTab = 'profile' | 'communication';

const TABS: Array<{ id: LawyerSettingsTab; label: string; icon: LucideIcon }> = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'communication', label: 'Communication', icon: Mail },
];

const PROFILE_PAGE_FORM_ID = 'lawyer-settings-profile-form';

// Must match the server limits in backend/app/services/email_notifications.py.
const BANNER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const BANNER_MAX_BYTES = 1024 * 1024;

type LawyerSettingsProps = {
  profileSettings: CurrentUserSettings | null;
  loadingProfile: boolean;
  savingProfile: boolean;
  profileError: string | null;
  /** Resolves to true when the profile was saved. */
  onSubmitProfile: (payload: UpdateCurrentUserSettingsInput) => Promise<boolean>;
};

export function LawyerSettings({
  profileSettings,
  loadingProfile,
  savingProfile,
  profileError,
  onSubmitProfile,
}: LawyerSettingsProps) {
  const [activeTab, setActiveTab] = useState<LawyerSettingsTab>('profile');

  return (
    <>
      <PageHeader title="Settings" description="Manage your profile and how your emails to clients look.">
        {/* No overflow-x-auto: with only two tabs it never needs to scroll, and the tabs' -mb-px
            overlap made the browser show a stray scrollbar. */}
        <nav aria-label="Settings sections" className="px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.id)}
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
        </nav>
      </PageHeader>

      <div className="px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'profile' ? (
          <ProfileTab
            // Re-mount when settings load so the fields start from the loaded values.
            key={profileSettings ? profileSettings.id : 'profile-loading'}
            settings={profileSettings}
            loading={loadingProfile}
            submitting={savingProfile}
            errorMessage={profileError}
            onSubmit={onSubmitProfile}
          />
        ) : (
          <CommunicationTab />
        )}
      </div>
    </>
  );
}

// ── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab({
  settings,
  loading,
  submitting,
  errorMessage,
  onSubmit,
}: {
  settings: CurrentUserSettings | null;
  loading: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (payload: UpdateCurrentUserSettingsInput) => Promise<boolean>;
}) {
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (payload: UpdateCurrentUserSettingsInput) => {
    setSaved(false);
    setSaved(await onSubmit(payload));
  };

  return (
    <Card className="max-w-3xl">
      <CardHeader title="Profile" description="Manage your account details and security preferences." />
      <ProfileSettingsForm
        formId={PROFILE_PAGE_FORM_ID}
        settings={settings}
        loading={loading}
        submitting={submitting}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
      />
      <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3">
        <p className="text-xs text-gray-500">Account status: {settings?.status ?? 'active'}</p>
        <div className="flex items-center gap-3">
          {saved ? <p role="status" className="text-xs text-green-700">Profile saved.</p> : null}
          <Button type="submit" form={PROFILE_PAGE_FORM_ID} disabled={loading || submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Communication tab ────────────────────────────────────────────────────────

function CommunicationTab() {
  const [settings, setSettings] = useState<LawyerCommunicationSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    getCommunicationSettings()
      .then((result) => {
        if (!ignore) setSettings(result);
      })
      .catch((err) => {
        if (!ignore) setLoadError(err instanceof Error ? err.message : 'Failed to load communication settings.');
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loadError) {
    return <Alert tone="danger">{loadError}</Alert>;
  }
  if (!settings) {
    return <p className="text-sm text-gray-500">Loading communication settings…</p>;
  }

  return (
    <div className="space-y-6">
      <BannerSection settings={settings} onChange={setSettings} />
      <NotificationToggles settings={settings} onChange={setSettings} />
    </div>
  );
}

type SectionProps = {
  settings: LawyerCommunicationSettings;
  onChange: (settings: LawyerCommunicationSettings) => void;
};

function BannerSection({ settings, onChange }: SectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Shows the image the lawyer just picked, even if the server cannot hand back a preview link.
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

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
    if (!BANNER_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
      setError('Banner images must be .png, .jpg, .jpeg, or .webp files.');
      return;
    }
    if (file.size > BANNER_MAX_BYTES) {
      setError(`This image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Banner images must be 1 MB or smaller.`);
      return;
    }

    setBusy(true);
    try {
      onChange(await uploadEmailBanner(file));
      setLocalPreviewUrl(URL.createObjectURL(file));
      setMessage('Banner uploaded. It will appear in your notification emails.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload the banner.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      onChange(await deleteEmailBanner());
      setLocalPreviewUrl(null);
      setMessage('Banner removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove the banner.');
    } finally {
      setBusy(false);
    }
  };

  const previewUrl = settings.banner ? localPreviewUrl ?? settings.banner.url : null;

  return (
    <Card>
      <CardHeader
        title="Email Banner"
        description="Add your branding (logo and contact details) to the notification emails sent to your clients."
      />
      <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
        {/* Upload field */}
        <div className="space-y-3">
          <div className="flex min-h-24 items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-gray-300 bg-gray-50">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a short-lived storage link, not a static asset
              <img src={previewUrl} alt="Current email banner" className="max-h-32 w-full object-contain" />
            ) : (
              <span className="flex items-center gap-2 py-6 text-sm text-gray-600">
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                {settings.banner ? settings.banner.file_name : 'No banner uploaded'}
              </span>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Upload email banner"
            onChange={(event) => void handleFile(event)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {busy ? 'Working…' : settings.banner ? 'Replace banner' : 'Upload banner'}
            </Button>
            {settings.banner ? (
              <Button type="button" variant="danger-subtle" onClick={() => void handleRemove()} disabled={busy}>
                Remove
              </Button>
            ) : null}
          </div>
          <FieldHint>
            Accepted files: .png, .jpg, .jpeg, or .webp, up to 1 MB. A wide image about 600 px across looks best.
          </FieldHint>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {message ? <Alert tone="success" role="status">{message}</Alert> : null}
        </div>

        {/* Preview */}
        <EmailPreview bannerUrl={previewUrl} hasBanner={settings.banner !== null} position={settings.banner_position} />
      </div>
    </Card>
  );
}

function EmailPreview({
  bannerUrl,
  hasBanner,
  position,
}: {
  bannerUrl: string | null;
  hasBanner: boolean;
  position: LawyerCommunicationSettings['banner_position'];
}) {
  const banner = (
    <div className="flex h-16 items-center justify-center bg-gray-100 text-xs text-gray-600">
      {bannerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived storage link, not a static asset
        <img src={bannerUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <span>{hasBanner ? 'Your banner' : 'Your banner will appear here'}</span>
      )}
    </div>
  );

  return (
    <figure aria-label="Email preview" className="space-y-2">
      <figcaption className="text-sm font-medium text-gray-700">Email preview</figcaption>
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-card">
        <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <p><span className="font-medium">Subject:</span> Case C-2026-001: status updated</p>
        </div>
        {position === 'top' ? banner : null}
        <div className="space-y-2 px-4 py-4 text-sm text-gray-700">
          <p>Your case status has been updated to &apos;In Progress&apos;.</p>
          <p className="border-t border-gray-200 pt-2 text-[11px] text-gray-500">
            Business address · Privacy contact · Unsubscribe
          </p>
        </div>
        {position === 'bottom' ? banner : null}
      </div>
      <p className="text-xs text-gray-600">
        Your organization places banners at the <strong>{position}</strong> of emails. An admin can change this in
        General Settings.
      </p>
    </figure>
  );
}

function NotificationToggles({ settings, onChange }: SectionProps) {
  const [savingKey, setSavingKey] = useState<NotificationTemplateKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (key: NotificationTemplateKey, enabled: boolean) => {
    const previous = settings;
    // Show the change right away; put it back if saving fails.
    onChange({ ...settings, templates: settings.templates.map((t) => (t.key === key ? { ...t, enabled } : t)) });
    setSavingKey(key);
    setError(null);
    try {
      onChange(await updateCommunicationSettings({ [key]: enabled }));
    } catch (err) {
      onChange(previous);
      setError(err instanceof Error ? err.message : 'Failed to save your email preferences.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Email Notifications"
        description="Choose which automatic emails are sent to your clients on your cases."
      />
      <div className="px-5 py-4">
        <fieldset className="space-y-3">
          <legend className="sr-only">Notification emails</legend>
          {settings.templates.map((template) => {
            const inputId = `notification-${template.key}`;
            return (
              <div key={template.key} className="flex items-start gap-3">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={template.enabled}
                  disabled={!template.org_enabled || savingKey !== null}
                  onChange={(event) => void handleToggle(template.key, event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary-600 disabled:opacity-50"
                  aria-describedby={`${inputId}-hint`}
                />
                <div>
                  <label htmlFor={inputId} className="text-sm font-medium text-gray-900">
                    {template.label}
                  </label>
                  <p id={`${inputId}-hint`} className="text-xs text-gray-600">
                    {template.description}
                    {!template.org_enabled ? (
                      <span className="ml-1 font-medium text-amber-700">
                        Turned off for your organization by an admin, so it is not sent.
                      </span>
                    ) : null}
                  </p>
                </div>
              </div>
            );
          })}
        </fieldset>
        <p className="mt-4 text-xs text-gray-600">
          An email is sent only when the type is on for your organization <em>and</em> checked here.
        </p>
        {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      </div>
    </Card>
  );
}
