/** profileSettingsDialog: Component tests for profile editing, validation, and the data deletion request. */

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  createPrivacyRequest: vi.fn(),
  beginMfaEnrollment: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  disableMfa: vi.fn(),
}));

import { createPrivacyRequest, type CurrentUserSettings } from '@/lib/api';

import { ProfileSettingsDialog } from '../design-system/components/ProfileSettingsDialog';
import { failOnUnmockedNetwork } from './support/componentTestKit';
import { mockCurrentUserSettings } from '../design-system/storybook/fixtures';

failOnUnmockedNetwork();

afterEach(() => {
  cleanup();
});

function renderDialog(overrides?: {
  isOpen?: boolean;
  settings?: CurrentUserSettings | null;
  loading?: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn(async () => undefined);
  const result = render(
    <ProfileSettingsDialog
      isOpen={overrides?.isOpen ?? true}
      settings={overrides && 'settings' in overrides ? overrides.settings ?? null : mockCurrentUserSettings}
      loading={overrides?.loading ?? false}
      submitting={overrides?.submitting ?? false}
      errorMessage={overrides?.errorMessage ?? null}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
  return { ...result, onClose, onSubmit };
}

describe('ProfileSettingsDialog profile form', () => {
  it('CT-PROFILE-01: renders nothing when closed', () => {
    const { container } = renderDialog({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });

  it('CT-PROFILE-02: prefills the form from the current settings', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Profile Settings' })).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toHaveValue('Avery');
    expect(screen.getByLabelText('Last Name')).toHaveValue('Counsel');
    expect(screen.getByLabelText('Email')).toHaveValue('lawyer@example.com');
    expect(screen.getByLabelText('Timezone')).toHaveValue('America/Toronto');
    expect(screen.getByText('Email verified: Yes')).toBeInTheDocument();
  });

  it('CT-PROFILE-03: saves trimmed values and clears a blank phone number', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.clear(screen.getByLabelText('First Name'));
    await user.type(screen.getByLabelText('First Name'), '  Avery-Jo ');
    await user.clear(screen.getByLabelText('Phone (optional)'));
    await user.type(screen.getByLabelText('Phone (optional)'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledWith({
      first_name: 'Avery-Jo',
      last_name: 'Counsel',
      email: 'lawyer@example.com',
      phone: null,
      avatar_url: mockCurrentUserSettings.avatar_url,
      timezone: 'America/Toronto',
      locale: 'en-CA',
    });
  });

  it.each([
    ['First Name', 'First and last name are required.'],
    ['Locale', 'Timezone and locale are required.'],
  ])('CT-PROFILE-04: blocks saving when %s is only whitespace', async (field, message) => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.clear(screen.getByLabelText(field));
    await user.type(screen.getByLabelText(field), '   ');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('CT-PROFILE-05: blocks saving a blank email', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    // type="email" strips whitespace, so the browser's required check stops the submit.
    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('CT-PROFILE-06: locks the form while loading and hides account security panels without settings', () => {
    renderDialog({ loading: true, settings: null });

    expect(screen.getByText('Loading profile settings...')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Multi-factor authentication' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Delete my data' })).not.toBeInTheDocument();
  });

  it('CT-PROFILE-07: shows server errors and the saving state', () => {
    renderDialog({ submitting: true, errorMessage: 'Email already in use' });

    expect(screen.getByText('Email already in use')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

describe('ProfileSettingsDialog data deletion', () => {
  it('CT-PROFILE-08: requires confirmation before requesting deletion', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Request deletion' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Confirm that you want your account data deleted.');
    expect(createPrivacyRequest).not.toHaveBeenCalled();
  });

  it('CT-PROFILE-09: submits a deletion request and reports its status', async () => {
    const user = userEvent.setup();
    vi.mocked(createPrivacyRequest).mockResolvedValue({ id: 'req-123', status: 'received', due_at: '2026-04-01T00:00:00Z' });
    renderDialog();

    await user.type(screen.getByLabelText('Details (optional)'), '  Closing my account  ');
    await user.click(screen.getByRole('checkbox', { name: 'I want my VisaTrack personal information deleted.' }));
    await user.click(screen.getByRole('button', { name: 'Request deletion' }));

    expect(createPrivacyRequest).toHaveBeenCalledWith({ request_type: 'deletion', details: 'Closing my account' });
    expect(await screen.findByRole('status')).toHaveTextContent('Deletion request req-123 is received.');
    expect(screen.getByRole('checkbox', { name: 'I want my VisaTrack personal information deleted.' })).not.toBeChecked();
  });

  it('CT-PROFILE-10: shows an error when the deletion request fails', async () => {
    const user = userEvent.setup();
    vi.mocked(createPrivacyRequest).mockRejectedValue(new Error('Too many requests'));
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: 'I want my VisaTrack personal information deleted.' }));
    await user.click(screen.getByRole('button', { name: 'Request deletion' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests');
  });
});
