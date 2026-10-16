/** PortalAuthGate: Public landing page and sign-in form. Shows the Clio-style hero with the sign-in card, a feature summary, and the legal footer. Renders nothing once a user with an allowed role is signed in. */

import { CircleCheck, CreditCard, FileUp, FolderKanban, type LucideIcon, Users } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

import { LegalFooter } from '@/components/compliance/LegalFooter';
import { SiteHeader } from '@/components/compliance/SiteHeader';
import type { AuthLoginInput, CurrentUser } from '@/lib/api';

import { Alert, Button, Card, Input, Label } from './ui';

// Landing copy describes only features the product ships today.
const HERO_POINTS = [
  'Track milestones and deadlines for every case',
  'Request and review client documents securely',
  'Give clients a portal to follow their case',
];

const FEATURES: Array<{ title: string; description: string; icon: LucideIcon }> = [
  {
    title: 'Case management',
    description: 'Open cases, assign lawyers, and follow each milestone from intake to filing.',
    icon: FolderKanban,
  },
  {
    title: 'Document collection',
    description: 'Request documents from clients and review uploads in one encrypted place.',
    icon: FileUp,
  },
  {
    title: 'Client portal',
    description: 'Clients see their checklist, milestones, and reminders without chasing emails.',
    icon: Users,
  },
  {
    title: 'Payments & invoices',
    description: 'Track what has been billed and paid on each case.',
    icon: CreditCard,
  },
];

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
    return <div className="min-h-screen bg-canvas p-10 text-gray-600">Checking session...</div>;
  }

  if (currentUser && hasRequiredRole) {
    return null;
  }

  if (currentUser && !hasRequiredRole) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <Card className="w-full max-w-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Access mismatch</h2>
          <p className="text-sm text-gray-600">
            You are signed in as <span className="font-medium">{currentUser.full_name}</span>, but this page requires one of:
            {' '}
            <span className="font-medium">{requiredRoles.join(', ')}</span>.
          </p>
          <Button onClick={onLogout}>Sign out</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ── Public header ── */}
      <SiteHeader title={portalTitle} />

      {/* ── Hero with sign-in card ── */}
      <section className="bg-linear-to-br from-navy-900 via-navy-900 to-navy-800 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary-300">
              Immigration case management
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Every case, document, and deadline in one place.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              {portalTitle} gives immigration consulting firms one secure workspace to run cases from intake to
              decision, collect client documents, and keep clients informed.
            </p>
            <ul className="mt-8 space-y-3 text-white/90">
              {HERO_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary-300" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div id="sign-in" className="scroll-mt-6">
            <form
              className="mx-auto w-full max-w-md space-y-4 rounded-md bg-white p-6 text-gray-900 shadow-popover sm:p-8"
              onSubmit={handleSubmit}
            >
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{portalTitle} Sign In</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Use credentials issued by your organization admin. VisaTrack tracks case documents and
                  status. It does not provide legal advice, publish reviews, or guarantee an application result.
                </p>
              </div>

              {error ? <Alert tone="danger">{error}</Alert> : null}

              <div>
                <Label htmlFor="organization-slug">Organization slug</Label>
                <Input
                  id="organization-slug"
                  required
                  type="text"
                  autoComplete="organization"
                  value={organizationSlug}
                  onChange={(event) => setOrganizationSlug(event.target.value)}
                  placeholder="acme-law"
                />
              </div>

              <div>
                <Label htmlFor="sign-in-email">Email</Label>
                <Input
                  id="sign-in-email"
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="sign-in-password">Password</Label>
                <Input
                  id="sign-in-password"
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {mfaRequired ? (
                <div>
                  <Label htmlFor="sign-in-mfa">Authenticator or recovery code</Label>
                  <Input
                    id="sign-in-mfa"
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                  />
                </div>
              ) : null}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Value summary ── */}
      <section className="flex-1 bg-canvas">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Built for the way your firm works</h2>
          <p className="mt-2 max-w-2xl text-gray-600">
            Lawyers, administrators, and clients each get a workspace tailored to their role.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-50 text-primary-600">
                  <feature.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
