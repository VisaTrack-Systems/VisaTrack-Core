/** portalAuthGate: Component tests for the sign-in gate (session states, role checks, sign-in and MFA flow). */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AuthLoginInput, CurrentUser } from '@/lib/api';

import { PortalAuthGate } from '../design-system/components/PortalAuthGate';
import { mockCurrentUserClient, mockCurrentUserLawyer } from '../design-system/storybook/fixtures';

function renderGate(overrides?: {
  currentUser?: CurrentUser | null;
  authLoading?: boolean;
  requiredRoles?: string[];
  onLogin?: (input: AuthLoginInput) => Promise<void>;
}) {
  const onLogin = vi.fn(overrides?.onLogin ?? (async () => undefined));
  const onLogout = vi.fn();
  const result = render(
    <PortalAuthGate
      portalTitle="VisaTrack"
      requiredRoles={overrides?.requiredRoles ?? ['lawyer']}
      currentUser={overrides?.currentUser ?? null}
      authLoading={overrides?.authLoading ?? false}
      onLogin={onLogin}
      onLogout={onLogout}
    />
  );
  return { ...result, onLogin, onLogout };
}

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Organization slug'), '  acme-law  ');
  await user.type(screen.getByLabelText('Email'), '  lawyer@example.test ');
  await user.type(screen.getByLabelText('Password'), 'Synthetic-password-1');
}

describe('PortalAuthGate session states', () => {
  it('CT-AUTH-01: shows a loading message while the session is checked', () => {
    renderGate({ authLoading: true });

    expect(screen.getByText('Checking session...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('CT-AUTH-02: renders nothing once a user with an allowed role is signed in', () => {
    const { container } = renderGate({ currentUser: mockCurrentUserLawyer });

    expect(container).toBeEmptyDOMElement();
  });

  it('CT-AUTH-03: lets any signed-in user through when no roles are required', () => {
    const { container } = renderGate({ currentUser: mockCurrentUserClient, requiredRoles: [] });

    expect(container).toBeEmptyDOMElement();
  });

  it('CT-AUTH-04: blocks a signed-in user without the required role and offers sign out', async () => {
    const user = userEvent.setup();
    const { onLogout } = renderGate({ currentUser: mockCurrentUserClient, requiredRoles: ['lawyer', 'org_admin'] });

    expect(screen.getByRole('heading', { name: 'Access mismatch' })).toBeInTheDocument();
    expect(screen.getByText('lawyer, org_admin')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalledOnce();
  });
});

describe('PortalAuthGate sign-in form', () => {
  it('CT-AUTH-05: sends trimmed credentials without an MFA code', async () => {
    const user = userEvent.setup();
    const { onLogin } = renderGate();

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onLogin).toHaveBeenCalledWith({
      organization_slug: 'acme-law',
      email: 'lawyer@example.test',
      password: 'Synthetic-password-1',
      mfa_code: undefined,
    });
  });

  it('CT-AUTH-06: disables the button while signing in', async () => {
    const user = userEvent.setup();
    let finishLogin!: () => void;
    renderGate({ onLogin: () => new Promise<void>((resolve) => { finishLogin = resolve; }) });

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    finishLogin();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled());
  });

  it('CT-AUTH-07: shows the error when sign-in fails', async () => {
    const user = userEvent.setup();
    renderGate({ onLogin: async () => { throw new Error('Invalid credentials'); } });

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.queryByLabelText('Authenticator or recovery code')).not.toBeInTheDocument();
  });

  it('CT-AUTH-08: asks for an MFA code when the server requires one and sends it on retry', async () => {
    const user = userEvent.setup();
    const onLogin = vi
      .fn<(input: AuthLoginInput) => Promise<void>>()
      .mockRejectedValueOnce(new Error('MFA code required'))
      .mockResolvedValueOnce(undefined);
    renderGate({ onLogin });

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const mfaInput = await screen.findByLabelText('Authenticator or recovery code');
    await user.type(mfaInput, ' 123456 ');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onLogin).toHaveBeenLastCalledWith(expect.objectContaining({ mfa_code: '123456' }));
  });
});
