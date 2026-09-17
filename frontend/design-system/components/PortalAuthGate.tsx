/** PortalAuthGate: Component for rendering and managing portalauthgate functionality. */

import { Check, ShieldCheck, Sparkles } from 'lucide-react';
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
    return <div className="min-h-screen bg-[#10182b] p-10 text-slate-300">Checking secure session…</div>;
  }

  if (currentUser && hasRequiredRole) {
    return null;
  }

  if (currentUser && !hasRequiredRole) {
    return (
      <div className="min-h-screen bg-[#f3f5fa] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-7 shadow-xl shadow-slate-300/30 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Access mismatch</h2>
          <p className="text-sm text-gray-600">
            You are signed in as <span className="font-medium">{currentUser.full_name}</span>, but this page requires one of:
            {' '}
            <span className="font-medium">{requiredRoles.join(', ')}</span>.
          </p>
          <button
            onClick={onLogout}
            className="bg-[#5b67d8] hover:bg-[#4f5bc8] text-white px-4 py-2 rounded-xl transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-[calc(100vh-73px)] bg-[#f3f5fa] lg:grid-cols-[minmax(24rem,0.95fr)_minmax(30rem,1.05fr)]">
      <section className="relative hidden overflow-hidden bg-[#10182b] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="relative z-10">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c8cff] to-[#35d0ba] shadow-lg shadow-slate-950/30">
            <Sparkles className="h-6 w-6" />
          </span>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-[#75e6d4]">
            Immigration practice, reimagined
          </p>
          <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight tracking-tight">
            One workspace for matter intelligence and legal operations.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            Move from source-grounded research to documents, deadlines, billing, and client collaboration without losing the matter context.
          </p>
        </div>
        <ul className="relative z-10 space-y-3 text-sm text-slate-300">
          {[
            'Case-scoped AI with visible sources',
            'Documents, forms, milestones, and reminders',
            'Retainers, invoices, and secure client payments',
            'Human review before legal reliance',
          ].map((item) => (
            <li key={item} className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#35c9b0]/15 text-[#75e6d4]">
                <Check className="h-3.5 w-3.5" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#6674e8]/20 blur-3xl" />
        <div className="absolute -bottom-32 left-16 h-80 w-80 rounded-full bg-[#35c9b0]/10 blur-3xl" />
      </section>

      <div className="flex items-center justify-center p-5 sm:p-10">
        <form className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-300/30 sm:p-9" onSubmit={handleSubmit}>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#5661ce]">
              <ShieldCheck className="h-4 w-4" />
              Secure firm access
            </div>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{portalTitle} Sign In</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Use credentials issued by your organization administrator.</p>
          </div>

          <div className="mt-7 space-y-4">
            {error ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
            ) : null}

            <div>
              <label htmlFor="organization-slug" className="mb-1.5 block text-sm font-medium text-slate-700">Organization slug</label>
              <input
                id="organization-slug"
                required
                type="text"
                autoComplete="organization"
                value={organizationSlug}
                onChange={(event) => setOrganizationSlug(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 focus:border-[#8f99e7] focus:outline-none"
                placeholder="acme-law"
              />
            </div>

            <div>
              <label htmlFor="sign-in-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
              <input
                id="sign-in-email"
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 focus:border-[#8f99e7] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="sign-in-password" className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
              <input
                id="sign-in-password"
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 focus:border-[#8f99e7] focus:outline-none"
              />
            </div>

            {mfaRequired ? (
              <div>
                <label htmlFor="sign-in-mfa" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Authenticator or recovery code
                </label>
                <input
                  id="sign-in-mfa"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 focus:border-[#8f99e7] focus:outline-none"
                />
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-[#5b67d8] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-[#4f5bc8] disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Enter workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
