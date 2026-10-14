/** mfaSettings: Component tests for MFA enrollment, verification, and disabling. */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  beginMfaEnrollment: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  disableMfa: vi.fn(),
}));

import { beginMfaEnrollment, disableMfa, verifyMfaEnrollment } from '@/lib/api';

import { MfaSettings } from '../design-system/components/MfaSettings';
import { failOnUnmockedNetwork } from './support/componentTestKit';

failOnUnmockedNetwork();

afterEach(() => {
  cleanup();
});

describe('MfaSettings', () => {
  it('CT-MFA-01: enrolls an authenticator and shows one-time recovery codes', async () => {
    const user = userEvent.setup();
    vi.mocked(beginMfaEnrollment).mockResolvedValue({
      secret: 'SYNTHETICSECRET',
      provisioning_uri: 'otpauth://totp/VisaTrack:test',
    });
    vi.mocked(verifyMfaEnrollment).mockResolvedValue(['code-one', 'code-two']);
    render(<MfaSettings initiallyEnabled={false} />);

    expect(screen.getByText('Use an authenticator app to protect your account.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Current password'), 'Synthetic-password-1');
    await user.click(screen.getByRole('button', { name: 'Set up authenticator' }));

    expect(beginMfaEnrollment).toHaveBeenCalledWith('Synthetic-password-1');
    expect(await screen.findByText('SYNTHETICSECRET')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Six-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(verifyMfaEnrollment).toHaveBeenCalledWith('123456');
    expect(await screen.findByText('Save these recovery codes now')).toBeInTheDocument();
    expect(screen.getByText('code-one')).toBeInTheDocument();
    expect(screen.getByText('code-two')).toBeInTheDocument();
    expect(screen.getByText('Enabled. A code is required when you sign in.')).toBeInTheDocument();
  });

  it('CT-MFA-02: shows an error when the password is rejected', async () => {
    const user = userEvent.setup();
    vi.mocked(beginMfaEnrollment).mockRejectedValue(new Error('Current password is incorrect'));
    render(<MfaSettings initiallyEnabled={false} />);

    await user.type(screen.getByLabelText('Current password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Set up authenticator' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
    expect(screen.getByRole('button', { name: 'Set up authenticator' })).toBeEnabled();
  });

  it('CT-MFA-03: keeps the enrollment open when the code is wrong', async () => {
    const user = userEvent.setup();
    vi.mocked(beginMfaEnrollment).mockResolvedValue({ secret: 'SYNTHETICSECRET', provisioning_uri: 'otpauth://x' });
    vi.mocked(verifyMfaEnrollment).mockRejectedValue(new Error('Invalid MFA code'));
    render(<MfaSettings initiallyEnabled={false} />);

    await user.type(screen.getByLabelText('Current password'), 'Synthetic-password-1');
    await user.click(screen.getByRole('button', { name: 'Set up authenticator' }));
    await user.type(await screen.findByLabelText('Six-digit code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Verify and enable' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid MFA code');
    expect(screen.getByText('SYNTHETICSECRET')).toBeInTheDocument();
  });

  it('CT-MFA-04: disables MFA with the password and a code', async () => {
    const user = userEvent.setup();
    vi.mocked(disableMfa).mockResolvedValue(undefined);
    render(<MfaSettings initiallyEnabled />);

    await user.type(screen.getByLabelText('Current password'), 'Synthetic-password-1');
    await user.type(screen.getByLabelText('Authenticator or recovery code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Disable MFA and sign out all sessions' }));

    expect(disableMfa).toHaveBeenCalledWith('Synthetic-password-1', '654321');
    expect(await screen.findByRole('button', { name: 'Set up authenticator' })).toBeInTheDocument();
  });

  it('CT-MFA-05: stays enabled when disabling fails', async () => {
    const user = userEvent.setup();
    vi.mocked(disableMfa).mockRejectedValue(new Error('Invalid MFA code'));
    render(<MfaSettings initiallyEnabled />);

    await user.type(screen.getByLabelText('Current password'), 'Synthetic-password-1');
    await user.type(screen.getByLabelText('Authenticator or recovery code'), '000000');
    await user.click(screen.getByRole('button', { name: 'Disable MFA and sign out all sessions' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid MFA code');
    expect(screen.getByText('Enabled. A code is required when you sign in.')).toBeInTheDocument();
  });
});
