<<<<<<< Updated upstream
<<<<<<< Updated upstream:frontend/figma/components/ProfileSettingsDialog.tsx
import { X } from 'lucide-react';
=======
=======
>>>>>>> Stashed changes
/** ProfileSettingsDialog: Modal dialog for user profile and account settings management. Allows profile updates, password changes, and preference configuration. */

import { ShieldCheck, X } from 'lucide-react';
>>>>>>> Stashed changes:frontend/design-system/components/ProfileSettingsDialog.tsx
import { FormEvent, useState } from 'react';

import type { CurrentUserSettings, UpdateCurrentUserSettingsInput } from '@/lib/api';

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
      mfa_enabled: settings?.mfa_enabled ?? false,
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-black text-white flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Profile Settings</h2>
            <p className="text-xs text-gray-300 mt-1">Manage your account details and security preferences.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-60"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {validationError ? (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm px-3 py-2">
              {validationError}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {errorMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm px-3 py-2">
              Loading profile settings...
            </div>
          ) : null}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                disabled={loading || submitting}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                disabled={loading || submitting}
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                disabled={loading || submitting}
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Email verified: {settings?.email_verified ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                disabled={loading || submitting}
                placeholder="+1 555 123 4567"
              />
              <p className="mt-1 text-xs text-gray-500">
                Phone verified: {settings?.phone_verified ? 'Yes' : 'No'}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                disabled={loading || submitting}
                placeholder="America/Toronto"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Locale</label>
              <input
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500"
                disabled={loading || submitting}
                placeholder="en-CA"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-gray-500">Account status: {settings?.status ?? 'active'}</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                disabled={loading || submitting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
