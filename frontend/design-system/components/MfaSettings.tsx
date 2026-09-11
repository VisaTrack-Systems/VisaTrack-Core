import { FormEvent, useState } from 'react';

import {
  beginMfaEnrollment,
  disableMfa,
  verifyMfaEnrollment,
  type MfaEnrollment,
} from '@/lib/api';

export function MfaSettings({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const beginEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setEnrollment(await beginMfaEnrollment(password));
      setPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start MFA enrollment');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmEnrollment = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      setRecoveryCodes(await verifyMfaEnrollment(code));
      setEnabled(true);
      setEnrollment(null);
      setCode('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to verify MFA code');
    } finally {
      setSubmitting(false);
    }
  };

  const turnOff = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await disableMfa(password, code);
      setEnabled(false);
      setPassword('');
      setCode('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to disable MFA');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4" aria-labelledby="mfa-heading">
      <div>
        <h3 id="mfa-heading" className="text-sm font-semibold text-gray-900">Multi-factor authentication</h3>
        <p className="text-xs text-gray-600">
          {enabled ? 'Enabled. A code is required when you sign in.' : 'Use an authenticator app to protect your account.'}
        </p>
      </div>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      {recoveryCodes.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-900">Save these recovery codes now</p>
          <p className="text-xs text-amber-800">Each code works once and will not be shown again.</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
            {recoveryCodes.map((recoveryCode) => <li key={recoveryCode}>{recoveryCode}</li>)}
          </ul>
        </div>
      ) : null}

      {!enabled && !enrollment ? (
        <form onSubmit={beginEnrollment} className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <label htmlFor="mfa-current-password" className="block text-xs font-medium text-gray-700">Current password</label>
            <input
              id="mfa-current-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white disabled:opacity-60">
            Set up authenticator
          </button>
        </form>
      ) : null}

      {!enabled && enrollment ? (
        <form onSubmit={confirmEnrollment} className="space-y-3">
          <p className="text-xs text-gray-700">
            Enter this secret in your authenticator app: <code className="select-all font-mono font-semibold">{enrollment.secret}</code>
          </p>
          <div>
            <label htmlFor="mfa-enrollment-code" className="block text-xs font-medium text-gray-700">Six-digit code</label>
            <input
              id="mfa-enrollment-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-60">
            Verify and enable
          </button>
        </form>
      ) : null}

      {enabled ? (
        <form onSubmit={turnOff} className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="mfa-disable-password" className="block text-xs font-medium text-gray-700">Current password</label>
            <input id="mfa-disable-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="mfa-disable-code" className="block text-xs font-medium text-gray-700">Authenticator or recovery code</label>
            <input id="mfa-disable-code" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60 sm:col-span-2">
            Disable MFA and sign out all sessions
          </button>
        </form>
      ) : null}
    </section>
  );
}
