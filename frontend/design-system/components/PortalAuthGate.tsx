/** PortalAuthGate: Component for rendering and managing portalauthgate functionality. */

import { FormEvent, useMemo, useState } from 'react';

import type { AuthLoginInput, CurrentUser } from '@/lib/api';

type PortalAuthGateProps = {
  portalTitle: string;
  requiredRoles: string[];
  currentUser: CurrentUser | null;
  authLoading: boolean;
  onLogin: (input: AuthLoginInput) => Promise<void>;
  onLogout: () => void;
};

export function PortalAuthGate({
  portalTitle,
  requiredRoles,
  currentUser,
  authLoading,
  onLogin,
  onLogout,
}: PortalAuthGateProps) {
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRequiredRole = useMemo(() => {
    if (!currentUser) {
      return false;
    }
    if (requiredRoles.length === 0) {
      return true;
    }
    return requiredRoles.some((role) => currentUser.roles.includes(role));
  }, [currentUser, requiredRoles]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await onLogin({
        organization_slug: organizationSlug.trim(),
        email: email.trim(),
        password,
        mfa_code: mfaCode.trim() || undefined,
      });
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Failed to sign in';
      if (message.includes('MFA code required')) {
        setMfaRequired(true);
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 p-10 text-gray-600">Checking session...</div>;
  }

  if (currentUser && hasRequiredRole) {
    return null;
  }

  if (currentUser && !hasRequiredRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Access mismatch</h2>
          <p className="text-sm text-gray-600">
            You are signed in as <span className="font-medium">{currentUser.full_name}</span>, but this page requires one of:
            {' '}
            <span className="font-medium">{requiredRoles.join(', ')}</span>.
          </p>
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <form className="w-full max-w-lg bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4" onSubmit={handleSubmit}>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{portalTitle} Sign In</h2>
          <p className="text-sm text-gray-600 mt-1">Use credentials issued by your organization admin.</p>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>
        ) : null}

        <div>
          <label htmlFor="organization-slug" className="block text-sm font-medium text-gray-700 mb-1">Organization slug</label>
          <input
            id="organization-slug"
            required
            type="text"
            autoComplete="organization"
            value={organizationSlug}
            onChange={(event) => setOrganizationSlug(event.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
            placeholder="acme-law"
          />
        </div>

        <div>
          <label htmlFor="sign-in-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="sign-in-email"
            required
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="sign-in-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            id="sign-in-password"
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        {mfaRequired ? (
          <div>
            <label htmlFor="sign-in-mfa" className="block text-sm font-medium text-gray-700 mb-1">
              Authenticator or recovery code
            </label>
            <input
              id="sign-in-mfa"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
