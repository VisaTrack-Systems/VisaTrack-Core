/** adminSettingsGeneral: Component tests for the settings groups, inline email template editor, toggles, and banner placement. */

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getEmailTemplates: vi.fn(),
  saveEmailTemplate: vi.fn(async () => undefined),
  saveEmailSettings: vi.fn(async () => undefined),
  extractTemplateText: vi.fn(),
  getInvitationTemplate: vi.fn(),
  saveInvitationTemplate: vi.fn(async () => undefined),
  getGeneralSettings: vi.fn(),
  saveGeneralSettings: vi.fn(),
}));

import {
  type EmailTemplatesOverview,
  extractTemplateText,
  getEmailTemplates,
  getGeneralSettings,
  getInvitationTemplate,
  saveEmailSettings,
  saveEmailTemplate,
  saveGeneralSettings,
  saveInvitationTemplate,
} from '@/lib/api';

import { AdminSettingsGeneral } from '../design-system/components/admin-dashboard/AdminSettingsGeneral';
import { failOnUnmockedNetwork } from './support/componentTestKit';

failOnUnmockedNetwork();

const STATUS_DEFAULT = "Your case status has been updated to '{status}'.";

const overview: EmailTemplatesOverview = {
  banner_position: 'top',
  invitation_enabled: true,
  invitation_variables: ['{recipient_name}', '{organization_name}', '{invitation_url}', '{portal_url}'],
  templates: [
    {
      key: 'case_status_update',
      label: 'Case status update',
      description: 'Sent to clients when their case status changes.',
      body: STATUS_DEFAULT,
      default_body: STATUS_DEFAULT,
      subject: 'Case {case_number}: status updated',
      default_subject: 'Case {case_number}: status updated',
      is_custom: false,
      enabled: true,
      variables: ['{client_name}', '{case_number}', '{organization_main_email}', '{organization_support_email}'],
    },
    {
      key: 'reminder',
      label: 'Reminder',
      description: 'Sent with reminders.',
      body: 'Hi {recipient_name}',
      default_body: 'Hi {recipient_name}',
      subject: 'Reminder: {reminder_title}',
      default_subject: 'Reminder: {reminder_title}',
      is_custom: false,
      enabled: false,
      variables: ['{recipient_name}'],
    },
  ],
};

const invitationStyles = {
  button_color: '#dc2626',
  button_label: 'Activate my account',
  subject: 'You have been invited to join {organization_name}',
  bold_org_name: true,
};

const generalSettings = {
  contact_email: 'hello@firm.com',
  support_email: '',
  timezone: 'America/Toronto',
  available_timezones: ['America/Toronto', 'America/Vancouver', 'UTC'],
};

beforeEach(() => {
  vi.mocked(getEmailTemplates).mockResolvedValue(overview);
  vi.mocked(getInvitationTemplate).mockResolvedValue({
    body: 'Hello {recipient_name}',
    is_custom: true,
    styles: invitationStyles,
  });
  vi.mocked(getGeneralSettings).mockResolvedValue(generalSettings);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderCommunication(user: ReturnType<typeof userEvent.setup>) {
  render(<AdminSettingsGeneral />);
  await user.click(screen.getByRole('button', { name: 'Communication' }));
  await screen.findByRole('switch', { name: 'Send invitation email emails' });
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('tab', { name }));
}

describe('AdminSettingsGeneral navigation', () => {
  it('CT-ADMSET-06: switches between General & Branding and Communication without dialogs', async () => {
    const user = userEvent.setup();
    render(<AdminSettingsGeneral />);

    expect(await screen.findByDisplayValue('hello@firm.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Branding & Customization' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Email Templates' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Communication' }));

    expect(screen.getByRole('button', { name: 'Communication' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { name: 'Email Templates' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Email Banner Placement' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'General Settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('AdminSettingsGeneral email templates', () => {
  it('CT-ADMSET-01: turns a template type off for the organization', async () => {
    const user = userEvent.setup();
    await renderCommunication(user);
    await openTab(user, 'Case Status Update');

    await user.click(screen.getByRole('switch', { name: 'Send case status update emails' }));

    expect(saveEmailSettings).toHaveBeenCalledWith({
      banner_position: 'top',
      enabled_templates: { case_status_update: false, reminder: false },
      invitation_enabled: true,
    });
    expect(screen.getByRole('switch', { name: 'Send case status update emails' })).toHaveAttribute('aria-checked', 'false');
  });

  it('CT-ADMSET-02: moves the banner to the bottom and reverts on failure', async () => {
    const user = userEvent.setup();
    vi.mocked(saveEmailSettings).mockRejectedValueOnce(new Error('Request failed: 500'));
    await renderCommunication(user);
    const positions = screen.getByRole('radiogroup', { name: 'Banner position' });

    await user.click(within(positions).getByRole('radio', { name: 'Bottom of email' }));

    expect(saveEmailSettings).toHaveBeenCalledWith(expect.objectContaining({ banner_position: 'bottom' }));
    expect(await screen.findByText('Request failed: 500')).toBeInTheDocument();
    expect(within(positions).getByRole('radio', { name: 'Top of email' })).toHaveAttribute('aria-checked', 'true');
  });

  it('CT-ADMSET-03: fills the body and subject from an uploaded file and saves them inline', async () => {
    const user = userEvent.setup();
    vi.mocked(extractTemplateText).mockResolvedValue('Subject: New on {case_number}\nUpdate: {status}');
    await renderCommunication(user);
    await openTab(user, 'Case Status Update');

    const file = new File(['%PDF'], 'status.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Upload template file'), file);

    expect(extractTemplateText).toHaveBeenCalledWith(file);
    expect(screen.getByRole('textbox', { name: 'Case Status Update message body' })).toHaveTextContent('Update: {status}');
    expect(screen.getByLabelText('Email Subject Line')).toHaveValue('New on {case_number}');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));

    expect(saveEmailTemplate).toHaveBeenCalledWith('case_status_update', '<p>Update: {status}</p>', 'New on {case_number}');
    expect(await screen.findByText('Custom template active.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Template saved.');
  });

  it('CT-ADMSET-04: rejects unsupported template files without uploading them', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await renderCommunication(user);
    await openTab(user, 'Case Status Update');

    await user.upload(
      screen.getByLabelText('Upload template file'),
      new File(['doc'], 'status.docx', { type: 'application/msword' })
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Only .txt and .pdf files can be used as email templates.');
    expect(extractTemplateText).not.toHaveBeenCalled();
  });

  it('CT-ADMSET-07: switching tabs loads each template, its subject, and its toggle state', async () => {
    const user = userEvent.setup();
    await renderCommunication(user);

    expect(screen.getByRole('tab', { name: 'Invitation Email' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Invitation Email message body' })).toHaveTextContent('Hello {recipient_name}');
    expect(screen.getByRole('switch', { name: 'Send invitation email emails' })).toHaveAttribute('aria-checked', 'true');

    await openTab(user, 'Reminder');

    expect(screen.getByRole('textbox', { name: 'Reminder message body' })).toHaveTextContent('Hi {recipient_name}');
    expect(screen.getByLabelText('Email Subject Line')).toHaveValue('Reminder: {reminder_title}');
    expect(screen.getByRole('switch', { name: 'Send reminder emails' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
  });

  it('CT-ADMSET-08: hovering the variable icon shows the reference table', async () => {
    const user = userEvent.setup();
    await renderCommunication(user);
    await openTab(user, 'Case Status Update');

    await user.hover(screen.getByRole('button', { name: 'Show template variables' }));

    const tooltip = screen.getByRole('tooltip');
    const rows = within(tooltip).getAllByRole('row');
    expect(rows[0]).toHaveTextContent('VariableDescription');
    expect(within(tooltip).getByRole('row', { name: /\{case_number\}/ })).toHaveTextContent('Unique case reference ID');
    expect(within(tooltip).getByRole('row', { name: /\{organization_main_email\}/ })).toHaveTextContent("Firm's main contact email");
    expect(within(tooltip).getByRole('row', { name: /\{organization_support_email\}/ })).toHaveTextContent("Firm's support email");

    await user.unhover(screen.getByRole('button', { name: 'Show template variables' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('CT-ADMSET-09: inserts a variable from the toolbar menu into the body', async () => {
    const user = userEvent.setup();
    await renderCommunication(user);
    await openTab(user, 'Case Status Update');

    await user.click(screen.getByRole('button', { name: /Insert Variable/ }));
    await user.click(screen.getByRole('menuitem', { name: /\{client_name\}/ }));

    expect(screen.getByRole('textbox', { name: 'Case Status Update message body' })).toHaveTextContent('{client_name}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    expect(saveEmailTemplate).toHaveBeenCalledWith('case_status_update', expect.stringContaining('{client_name}'), '');
  });

  it('CT-ADMSET-10: keeps unsaved edits when switching tabs and saves the invitation subject', async () => {
    const user = userEvent.setup();
    await renderCommunication(user);

    const subject = screen.getByLabelText('Email Subject Line');
    await user.clear(subject);
    await user.type(subject, 'Join us at {{organization_name}');
    await openTab(user, 'Reminder');
    await openTab(user, 'Invitation Email');

    expect(screen.getByLabelText('Email Subject Line')).toHaveValue('Join us at {organization_name}');
    await user.click(screen.getByRole('button', { name: 'Save Template' }));

    expect(saveInvitationTemplate).toHaveBeenCalledWith('<p>Hello {recipient_name}</p>', {
      ...invitationStyles,
      subject: 'Join us at {organization_name}',
    });
  });

  it('CT-ADMSET-11: reset restores the default text, which saves as "no custom template"', async () => {
    const user = userEvent.setup();
    vi.mocked(getEmailTemplates).mockResolvedValue({
      ...overview,
      templates: [{ ...overview.templates[0], body: 'Custom {status}', subject: 'Custom subject', is_custom: true }],
    });
    await renderCommunication(user);
    await openTab(user, 'Case Status Update');

    await user.click(screen.getByRole('button', { name: 'Reset to Default' }));

    expect(screen.getByRole('textbox', { name: 'Case Status Update message body' })).toHaveTextContent(STATUS_DEFAULT);
    await user.click(screen.getByRole('button', { name: 'Save Template' }));
    expect(saveEmailTemplate).toHaveBeenCalledWith('case_status_update', '', '');
  });

  it('CT-ADMSET-12: turns invitation emails off for the organization', async () => {
    const user = userEvent.setup();
    await renderCommunication(user);

    await user.click(screen.getByRole('switch', { name: 'Send invitation email emails' }));

    expect(saveEmailSettings).toHaveBeenCalledWith(expect.objectContaining({ invitation_enabled: false }));
  });
});

describe('AdminSettingsGeneral general settings', () => {
  it('CT-ADMSET-05: edits the main contact email, support email, and timezone', async () => {
    const user = userEvent.setup();
    vi.mocked(saveGeneralSettings).mockResolvedValue({
      ...generalSettings,
      contact_email: 'team@firm.com',
      support_email: 'help@firm.com',
      timezone: 'UTC',
    });
    render(<AdminSettingsGeneral />);

    const email = await screen.findByDisplayValue('hello@firm.com');
    expect(screen.getByLabelText('Main Contact Email')).toBe(email);
    await user.clear(email);
    await user.type(email, 'team@firm.com');
    await user.type(screen.getByLabelText('Support Email'), 'help@firm.com');
    await user.selectOptions(screen.getByLabelText('Timezone'), 'UTC');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(saveGeneralSettings).toHaveBeenCalledWith({
      contact_email: 'team@firm.com',
      support_email: 'help@firm.com',
      timezone: 'UTC',
    });
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
  });

  it('CT-ADMSET-13: rejects an invalid support email without saving', async () => {
    const user = userEvent.setup();
    render(<AdminSettingsGeneral />);
    await screen.findByDisplayValue('hello@firm.com');

    await user.type(screen.getByLabelText('Support Email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(saveGeneralSettings).not.toHaveBeenCalled();
  });
});
