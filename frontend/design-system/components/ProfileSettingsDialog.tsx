/** ProfileSettingsDialog: Modal dialog for user profile and account settings management. Allows profile updates, password changes, and preference configuration. */

import Link from 'next/link';
import { X } from 'lucide-react';
import { FormEvent, useState } from 'react';

import { createPrivacyRequest, type CurrentUserSettings, type UpdateCurrentUserSettingsInput } from '@/lib/api';
import { DialogPanel } from './DialogPanel';
import { MfaSettings } from './MfaSettings';
import { Alert, Button, FieldHint, Input, Label, Textarea } from './ui';

/** Lets the footer's Save button submit the profile form from outside it. */
const PROFILE_FORM_ID = 'profile-settings-form';

type ProfileSettingsDialogProps = {
  isOpen: boolean;
  settings: CurrentUserSettings | null;
  loading: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (payload: UpdateCurrentUserSettingsInput) => Promise<void>;
};

export function ProfileSettingsDialog({
  isOpen,
  settings,
  loading,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: ProfileSettingsDialogProps) {
  const [firstName, setFirstName] = useState(settings?.first_name ?? '');
  const [lastName, setLastName] = useState(settings?.last_name ?? '');
  const [email, setEmail] = useState(settings?.email ?? '');
  const [phone, setPhone] = useState(settings?.phone ?? '');
  const [timezone, setTimezone] = useState(settings?.timezone ?? '');
  const [locale, setLocale] = useState(settings?.locale ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim();
    const normalizedTimezone = timezone.trim();
    const normalizedLocale = locale.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setValidationError('First and last name are required.');
      return;
    }
    if (!normalizedEmail) {
      setValidationError('Email is required.');
      return;
    }
    if (!normalizedTimezone || !normalizedLocale) {
      setValidationError('Timezone and locale are required.');
      return;
    }

    await onSubmit({
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      email: normalizedEmail,
      phone: phone.trim() || null,
      avatar_url: settings?.avatar_url ?? null,
      timezone: normalizedTimezone,
      locale: normalizedLocale,
    });
  };

  if (!isOpen) {
    return null;
  }

  const fieldsDisabled = loading || submitting;

  return (
    <div className="fixed inset-0 z-[90] bg-navy-900/50 flex items-center justify-center p-4">
      <DialogPanel
        labelledBy="profile-settings-title"
        onClose={onClose}
        className="w-full max-w-2xl bg-white border border-gray-200 rounded-md shadow-popover flex flex-col max-h-[90vh]"
      >
        {/* Header: stays pinned at the top while the body scrolls */}
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 shrink-0">
          <div>
            <h2 id="profile-settings-title" className="text-base font-semibold text-gray-900">Profile Settings</h2>
            <p className="mt-0.5 text-sm text-gray-500">Manage your account details and security preferences.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="-m-1 rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-60"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 min-h-0">
          <form id={PROFILE_FORM_ID} onSubmit={handleSubmit} className="space-y-5 px-5 py-4">
            {validationError ? <Alert tone="warning">{validationError}</Alert> : null}

            {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}

            {loading ? <Alert>Loading profile settings...</Alert> : null}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="profile-first-name">First Name</Label>
                <Input
                  id="profile-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  disabled={fieldsDisabled}
                  required
                />
              </div>
              <div>
                <Label htmlFor="profile-last-name">Last Name</Label>
                <Input
                  id="profile-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  disabled={fieldsDisabled}
                  required
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={fieldsDisabled}
                  required
                />
                <FieldHint>Email verified: {settings?.email_verified ? 'Yes' : 'No'}</FieldHint>
              </div>
              <div>
                <Label htmlFor="profile-phone">Phone (optional)</Label>
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={fieldsDisabled}
                  placeholder="+1 555 123 4567"
                />
                <FieldHint>
                  Used only if your firm needs to call you about a case. Leave it blank to keep email as the only contact.
                  Phone verified: {settings?.phone_verified ? 'Yes' : 'No'}
                </FieldHint>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="profile-timezone">Timezone</Label>
                <Input
                  id="profile-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  disabled={fieldsDisabled}
                  placeholder="America/Toronto"
                  required
                />
              </div>
              <div>
                <Label htmlFor="profile-locale">Locale</Label>
                <Input
                  id="profile-locale"
                  value={locale}
                  onChange={(event) => setLocale(event.target.value)}
                  disabled={fieldsDisabled}
                  placeholder="en-CA"
                  required
                />
              </div>
            </div>
          </form>

          {settings ? (
            <div className="space-y-4 border-t border-gray-200 px-5 py-4">
              <MfaSettings initiallyEnabled={settings.mfa_enabled} />
              <DataDeletionPanel />
            </div>
          ) : null}
        </div>

        {/* Footer: stays pinned at the bottom. Save submits the profile form via the `form` attribute. */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3 shrink-0">
          <p className="text-xs text-gray-500">Account status: {settings?.status ?? 'active'}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form={PROFILE_FORM_ID} disabled={fieldsDisabled}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogPanel>
    </div>
  );
}

function DataDeletionPanel() {
  const [details, setDetails] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!confirmed) {
      setError('Confirm that you want your account data deleted.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await createPrivacyRequest({
        request_type: 'deletion',
        details: details.trim() || null,
      });
      setMessage(`Deletion request ${result.id} is ${result.status}.`);
      setConfirmed(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit the deletion request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="rounded-md border border-gray-200 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Delete my data</h3>
        <p className="mt-0.5 text-sm text-gray-600">
          Ask VisaTrack to delete the personal information on this account. A legal hold can delay deletion.
          You can also use the{' '}
          <Link className="text-primary-700 underline hover:text-primary-800" href="/privacy/deletion">public deletion request</Link>.
        </p>
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success" role="status">{message}</Alert> : null}
      <div>
        <Label htmlFor="profile-deletion-details">Details (optional)</Label>
        <Textarea
          id="profile-deletion-details"
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={3}
          maxLength={5000}
        />
      </div>
      <label htmlFor="profile-deletion-confirm" className="flex items-start gap-3 text-sm text-gray-700">
        <input
          id="profile-deletion-confirm"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary-600"
        />
        <span>I want my VisaTrack personal information deleted.</span>
      </label>
      <Button type="submit" variant="danger-subtle" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Request deletion'}
      </Button>
    </form>
  );
}
