/** TopLevel.stories: Storybook stories for TopLevel components. Demonstrates various component states and usage patterns. */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { ActiveCases } from './ActiveCases';
import { AdminDashboard } from './AdminDashboard';
import { CaseConfiguration } from './CaseConfiguration';
import { ClientDashboard } from './ClientDashboard';
import { LawyerDashboard } from './LawyerDashboard';
import { NewCaseDialog } from './NewCaseDialog';
import { PortalAuthGate } from './PortalAuthGate';
import { ProfileSettingsDialog } from './ProfileSettingsDialog';
import {
  mockAdminOverview,
  mockAdminRoles,
  mockAdminUsers,
  mockCaseWorkspace,
  mockCaseWorkspaceSecondary,
  mockClientCases,
  mockCurrentUserAdmin,
  mockCurrentUserLawyer,
  mockCurrentUserSettings,
  mockLawyerCases,
  mockLawyerClients,
  mockOrganizations,
} from '../storybook/fixtures';
import { jsonRoute } from '../storybook/mockApi';

const StoryHost = () => null;

const meta = {
  title: 'App/Portal Pages',
  component: StoryHost,
  tags: ['autodocs'],
} satisfies Meta<typeof StoryHost>;

export default meta;

type Story = StoryObj<typeof meta>;

const newCaseSubmit = fn(async () => {});
const profileSettingsSubmit = fn(async () => {});

export const LawyerDashboardPage: Story = {
  parameters: {
    layout: 'fullscreen',
    mockApi: [jsonRoute('GET', '/api/v1/lawyer/cases', mockLawyerCases)],
  },
  render: () => <LawyerDashboard onViewActiveCases={async () => {}} onCreateCase={async () => {}} />,
};

export const ActiveCasesPage: Story = {
  parameters: {
    layout: 'fullscreen',
    mockApi: [jsonRoute('GET', '/api/v1/lawyer/cases', mockLawyerCases)],
  },
  render: () => <ActiveCases onSelectCase={async () => {}} onBack={() => {}} />,
};

export const AdminDashboardPage: Story = {
  parameters: {
    layout: 'fullscreen',
    mockApi: [
      jsonRoute('GET', '/api/v1/admin/overview', mockAdminOverview),
      jsonRoute('GET', '/api/v1/admin/organizations', mockOrganizations),
      jsonRoute('GET', '/api/v1/admin/users', mockAdminUsers),
      jsonRoute('GET', '/api/v1/admin/roles', mockAdminRoles),
    ],
  },
  render: () => <AdminDashboard currentUser={mockCurrentUserAdmin} />,
};

export const CaseConfigurationPage: Story = {
  parameters: {
    layout: 'fullscreen',
    mockApi: [
      jsonRoute('GET', '/api/v1/cases/by-number/C-2026-001/workspace', mockCaseWorkspace),
    ],
  },
  render: () => <CaseConfiguration caseId="C-2026-001" onBack={() => {}} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(await canvas.findByRole('button', { name: 'Document Requests' }));
    await expect(await canvas.findByRole('heading', { name: 'Document Requests' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Add Custom Document' }));
    await expect(await canvas.findByRole('heading', { name: 'Add Custom Document' })).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: 'Cancel' }));
    await waitFor(async () => {
      await expect(canvas.queryByRole('heading', { name: 'Add Custom Document' })).not.toBeInTheDocument();
    });

    await userEvent.click(canvas.getByRole('button', { name: 'Sharing / Permissions' }));
    await expect(await canvas.findByRole('heading', { name: 'Access Control' })).toBeInTheDocument();
  },
};

export const ClientDashboardPage: Story = {
  parameters: {
    layout: 'fullscreen',
    mockApi: [
      jsonRoute('GET', '/api/v1/client/cases', mockClientCases),
      jsonRoute('GET', '/api/v1/cases/by-number/C-2026-001/workspace', mockCaseWorkspace),
      jsonRoute('GET', '/api/v1/cases/by-number/C-2026-002/workspace', mockCaseWorkspaceSecondary),
    ],
  },
  render: () => <ClientDashboard />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByRole('heading', { name: /welcome back, jordan/i })).toBeInTheDocument();
    await expect(await canvas.findByText('Document Checklist')).toBeInTheDocument();

    const caseSwitcher = await canvas.findByRole('combobox');
    await expect(caseSwitcher).toHaveValue('C-2026-001');
    await expect(canvas.getByRole('option', { name: 'C-2026-002 - Work Permit Extension' })).toBeInTheDocument();

    await userEvent.click(canvas.getAllByRole('button', { name: 'Upload' })[0]);
    await expect(await canvas.findByRole('heading', { name: 'Upload Document' })).toBeInTheDocument();
  },
};

export const NewCaseDialogOpen: Story = {
  render: () => (
    <NewCaseDialog
      isOpen
      clients={mockLawyerClients}
      loadingClients={false}
      submitting={false}
      errorMessage={null}
      onClose={() => {}}
      onSubmit={newCaseSubmit}
    />
  ),
  play: async ({ canvasElement }) => {
    newCaseSubmit.mockClear();
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'New Client' }));
    await waitFor(() => {
      expect(
        Array.from(canvasElement.querySelectorAll('input')).filter(
          (input): input is HTMLInputElement => input instanceof HTMLInputElement && input.type === 'text'
        ).length
      ).toBeGreaterThanOrEqual(3);
    });
    const textInputs = Array.from(canvasElement.querySelectorAll('input')).filter(
      (input): input is HTMLInputElement => input instanceof HTMLInputElement && input.type === 'text'
    );
    await userEvent.type(canvas.getByPlaceholderText('client@example.com'), 'new.client@example.com');
    await userEvent.type(textInputs[1], 'New');
    await userEvent.type(textInputs[2], 'Client');
    await userEvent.click(canvas.getByRole('button', { name: 'Create Case' }));

    await expect(newCaseSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        client_mode: 'new',
        email: 'new.client@example.com',
        first_name: 'New',
        last_name: 'Client',
        case_type: 'Express Entry',
        priority: 'medium',
        target_filing_date: null,
      })
    );
  },
};

export const PortalSignIn: Story = {
  render: () => (
    <PortalAuthGate
      portalTitle="Lawyer Portal"
      requiredRoles={['lawyer']}
      currentUser={null}
      authLoading={false}
      onLogin={async () => {}}
      onLogout={() => {}}
    />
  ),
};

export const PortalAccessMismatch: Story = {
  render: () => (
    <PortalAuthGate
      portalTitle="Admin Portal"
      requiredRoles={['org_admin', 'super_admin']}
      currentUser={mockCurrentUserLawyer}
      authLoading={false}
      onLogin={async () => {}}
      onLogout={() => {}}
    />
  ),
};

export const ProfileSettingsOpen: Story = {
  render: () => (
    <ProfileSettingsDialog
      isOpen
      settings={mockCurrentUserSettings}
      loading={false}
      submitting={false}
      errorMessage={null}
      onClose={() => {}}
      onSubmit={profileSettingsSubmit}
    />
  ),
  play: async ({ canvasElement }) => {
    profileSettingsSubmit.mockClear();
    const canvas = within(canvasElement);

    const firstName = canvas.getByDisplayValue('Avery');
    await userEvent.clear(firstName);
    await userEvent.type(firstName, 'Avery Updated');
    await userEvent.click(canvas.getByRole('button', { name: 'Save Changes' }));

    await expect(profileSettingsSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: 'Avery Updated',
        last_name: 'Counsel',
        email: 'lawyer@example.com',
        timezone: 'America/Toronto',
        locale: 'en-CA',
      })
    );
  },
};

export const ProfileSettingsLoading: Story = {
  render: () => (
    <ProfileSettingsDialog
      isOpen
      settings={mockCurrentUserSettings}
      loading
      submitting={false}
      errorMessage={null}
      onClose={() => {}}
      onSubmit={async () => {}}
    />
  ),
};
