import { FormEvent, useState } from 'react';

import {
  beginMfaEnrollment,
  disableMfa,
  verifyMfaEnrollment,
  type MfaEnrollment,
} from '@/lib/api';
import { Alert, Button, Input, Label } from './ui';

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
    <section className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4" aria-labelledby="mfa-heading">
      <div>
        <h3 id="mfa-heading" className="text-sm font-semibold text-gray-900">Multi-factor authentication</h3>
        <p className="mt-0.5 text-sm text-gray-600">
          {enabled ? 'Enabled. A code is required when you sign in.' : 'Use an authenticator app to protect your account.'}
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {recoveryCodes.length > 0 ? (
        <Alert tone="warning">
          <p className="font-semibold">Save these recovery codes now</p>
          <p className="text-xs">Each code works once and will not be shown again.</p>
          <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
            {recoveryCodes.map((recoveryCode) => <li key={recoveryCode}>{recoveryCode}</li>)}
          </ul>
        </Alert>
      ) : null}

      {!enabled && !enrollment ? (
        <form onSubmit={beginEnrollment} className="flex flex-wrap items-end gap-2">
          <div className="min-w-56 flex-1">
            <Label htmlFor="mfa-current-password">Current password</Label>
            <Input
              id="mfa-current-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={submitting}>
            Set up authenticator
          </Button>
        </form>
      ) : null}

      {!enabled && enrollment ? (
        <form onSubmit={confirmEnrollment} className="space-y-3">
          <p className="text-sm text-gray-700">
            Enter this secret in your authenticator app: <code className="select-all font-mono font-semibold">{enrollment.secret}</code>
          </p>
          <div>
            <Label htmlFor="mfa-enrollment-code">Six-digit code</Label>
            <Input
              id="mfa-enrollment-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={submitting}>
            Verify and enable
          </Button>
        </form>
      ) : null}

      {enabled ? (
        <form onSubmit={turnOff} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="mfa-disable-password">Current password</Label>
            <Input id="mfa-disable-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="mfa-disable-code">Authenticator or recovery code</Label>
            <Input id="mfa-disable-code" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <Button type="submit" variant="danger-subtle" disabled={submitting} className="sm:col-span-2">
            Disable MFA and sign out all sessions
          </Button>
        </form>
      ) : null}
    </section>
  );
}
