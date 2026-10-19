/** lawyerSettings: Component tests for the lawyer Settings page (Profile and Communication tabs). */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getCommunicationSettings: vi.fn(),
  updateCommunicationSettings: vi.fn(),
  uploadEmailBanner: vi.fn(),
  deleteEmailBanner: vi.fn(),
  createPrivacyRequest: vi.fn(),
  beginMfaEnrollment: vi.fn(),
  verifyMfaEnrollment: vi.fn(),
  disableMfa: vi.fn(),
}));

import {
  type LawyerCommunicationSettings,
  getCommunicationSettings,
  updateCommunicationSettings,
  uploadEmailBanner,
} from '@/lib/api';

import { LawyerSettings } from '../design-system/components/LawyerSettings';
import { mockCurrentUserSettings } from '../design-system/storybook/fixtures';
import { failOnUnmockedNetwork } from './support/componentTestKit';

failOnUnmockedNetwork();

const communicationSettings: LawyerCommunicationSettings = {
  banner: null,
  banner_position: 'top',
  templates: [
    { key: 'case_status_update', label: 'Case status update', description: 'Status changes.', org_enabled: true, enabled: true },
    { key: 'document_request', label: 'Document request', description: 'Document requests.', org_enabled: true, enabled: false },
    { key: 'reminder', label: 'Reminder', description: 'Reminders.', org_enabled: false, enabled: true },
  ],
};

beforeEach(() => {
  vi.mocked(getCommunicationSettings).mockResolvedValue(communicationSettings);
  // jsdom has no object URLs; the banner preview only needs a string.
  URL.createObjectURL = vi.fn(() => 'blob:banner-preview');
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSettings(onSubmitProfile = vi.fn(async () => true)) {
  render(
    <LawyerSettings
      profileSettings={mockCurrentUserSettings}
      loadingProfile={false}
      savingProfile={false}
      profileError={null}
      onSubmitProfile={onSubmitProfile}
    />
  );
  return { onSubmitProfile };
}

async function openCommunicationTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole('navigation', { name: 'Settings sections' })).getByRole('button', { name: 'Communication' }));
  await screen.findByRole('heading', { name: 'Email Banner' });
}

describe('LawyerSettings', () => {
  it('CT-LSET-01: opens on the Profile tab and saves the profile', async () => {
    const user = userEvent.setup();
    const { onSubmitProfile } = renderSettings();

    expect(screen.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByLabelText('First Name')).toHaveValue('Avery');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmitProfile).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'Avery' }));
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });

  it('CT-LSET-02: shows opt-ins and blocks types the admin turned off', async () => {
    const user = userEvent.setup();
    renderSettings();
    await openCommunicationTab(user);

    expect(screen.getByLabelText('Case status update')).toBeChecked();
    expect(screen.getByLabelText('Document request')).not.toBeChecked();
    expect(screen.getByLabelText('Reminder')).toBeDisabled();
    expect(screen.getByText(/Turned off for your organization by an admin/)).toBeInTheDocument();
  });

  it('CT-LSET-03: saves an opt-out and restores it when saving fails', async () => {
    const user = userEvent.setup();
    vi.mocked(updateCommunicationSettings).mockRejectedValueOnce(new Error('Request failed: 500'));
    renderSettings();
    await openCommunicationTab(user);

    await user.click(screen.getByLabelText('Case status update'));

    expect(updateCommunicationSettings).toHaveBeenCalledWith({ case_status_update: false });
    expect(await screen.findByText('Request failed: 500')).toBeInTheDocument();
    expect(screen.getByLabelText('Case status update')).toBeChecked();
  });

  it('CT-LSET-04: rejects banners with the wrong type or size before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderSettings();
    await openCommunicationTab(user);
    const input = screen.getByLabelText('Upload email banner');

    await user.upload(input, new File(['gif'], 'logo.gif', { type: 'image/gif' }));
    expect(await screen.findByText('Banner images must be .png, .jpg, .jpeg, or .webp files.')).toBeInTheDocument();

    const large = new File([new Uint8Array(1024 * 1024 + 1)], 'logo.png', { type: 'image/png' });
    await user.upload(input, large);
    expect(await screen.findByText(/Banner images must be 1 MB or smaller/)).toBeInTheDocument();
    expect(uploadEmailBanner).not.toHaveBeenCalled();
  });

  it('CT-LSET-05: uploads a banner and shows it in the email preview', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadEmailBanner).mockResolvedValue({
      ...communicationSettings,
      banner_position: 'bottom',
      banner: { file_name: 'logo.png', content_type: 'image/png', url: null },
    });
    renderSettings();
    await openCommunicationTab(user);

    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Upload email banner'), file);

    expect(uploadEmailBanner).toHaveBeenCalledWith(file);
    expect(await screen.findByText('Banner uploaded. It will appear in your notification emails.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Current email banner' })).toHaveAttribute('src', 'blob:banner-preview');
    expect(screen.getByRole('button', { name: 'Replace banner' })).toBeInTheDocument();
    expect(within(screen.getByRole('figure', { name: 'Email preview' })).getByText('bottom')).toBeInTheDocument();
  });
});
