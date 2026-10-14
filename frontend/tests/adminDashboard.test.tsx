/** adminDashboard: Component tests for the admin dashboard (stats, case assignment, members, invitations, organizations). */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getAdminOrganizations: vi.fn(),
  getAdminUsers: vi.fn(),
  getAdminRoles: vi.fn(),
  getAdminOperations: vi.fn(),
  getLawyerCases: vi.fn(async () => []),
  getLawyerClients: vi.fn(async () => []),
  assignAdminRole: vi.fn(async () => ({})),
  assignAdminCaseLawyer: vi.fn(async () => ({})),
  createAdminOrganization: vi.fn(),
  createAdminUser: vi.fn(),
  deleteAdminOrganization: vi.fn(async () => undefined),
  deleteAdminUser: vi.fn(async () => undefined),
  removeAdminRole: vi.fn(async () => ({})),
  revokeAdminInvitation: vi.fn(async () => undefined),
  resendAdminInvitation: vi.fn(),
  sendInvitationEmail: vi.fn(),
  getInvitationTemplate: vi.fn(async () => null),
  saveInvitationTemplate: vi.fn(),
}));

import {
  assignAdminCaseLawyer,
  assignAdminRole,
  createAdminOrganization,
  createAdminUser,
  deleteAdminUser,
  getAdminOperations,
  getAdminOrganizations,
  getAdminRoles,
  getAdminUsers,
  removeAdminRole,
  resendAdminInvitation,
  revokeAdminInvitation,
  type AdminOperations,
  type CurrentUser,
  type UserListItem,
} from '@/lib/api';

import { AdminDashboard } from '../design-system/components/AdminDashboard';
import {
  mockAdminRoles,
  mockAdminUsers,
  mockCurrentUserAdmin,
  mockOrganizations,
  organizationId,
} from '../design-system/storybook/fixtures';
import { failOnUnmockedNetwork, rowStartingWith, statValue } from './support/componentTestKit';

const adminRow: UserListItem = {
  id: mockCurrentUserAdmin.id,
  email: mockCurrentUserAdmin.email,
  full_name: mockCurrentUserAdmin.full_name,
  status: 'active',
  organization_id: organizationId,
  created_at: '2026-01-10T09:00:00Z',
  roles: ['org_admin'],
};

const users: UserListItem[] = [...mockAdminUsers, adminRow];

const operations: AdminOperations = {
  organization_id: organizationId,
  unassigned_cases: [
    {
      case_id: 'case-unassigned',
      case_number: 'C-2026-050',
      case_type: 'Study Permit',
      status: 'intake',
      priority: 'high',
      created_at: '2026-02-01T00:00:00Z',
      days_open: 12,
      primary_lawyer_id: null,
      primary_lawyer_name: null,
    },
  ],
  aging_cases: [],
  lawyer_workload: [
    { lawyer_user_id: 'lawyer-1', full_name: 'Avery Counsel', active_cases: 4 },
    { lawyer_user_id: 'lawyer-2', full_name: 'Riley Barrister', active_cases: 1 },
  ],
  invitations: [
    {
      invitation_id: 'inv-pending',
      user_id: 'user-pending',
      email: 'pending@example.test',
      role_slug: 'lawyer',
      created_at: '2026-02-01T00:00:00Z',
      expires_at: '2026-02-08T00:00:00Z',
      status: 'pending',
      invited_by_name: 'Morgan Admin',
    },
    {
      invitation_id: 'inv-expired',
      user_id: clientUserIdFromUsers(),
      email: 'client@example.com',
      role_slug: 'client',
      created_at: '2026-01-01T00:00:00Z',
      expires_at: '2026-01-08T00:00:00Z',
      status: 'expired',
      invited_by_name: null,
    },
  ],
};

function clientUserIdFromUsers() {
  return mockAdminUsers.find((user) => user.email === 'client@example.com')!.id;
}

async function renderDashboard(currentUser: CurrentUser = mockCurrentUserAdmin) {
  const onSelectCase = vi.fn();
  render(<AdminDashboard currentUser={currentUser} onSelectCase={onSelectCase} />);
  await screen.findByRole('heading', { level: 1, name: /Welcome back/ });
  return { onSelectCase };
}

async function openMembers(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Members' }));
  await screen.findByRole('heading', { level: 1, name: 'Members' });
}

failOnUnmockedNetwork();

beforeEach(() => {
  vi.mocked(getAdminOrganizations).mockResolvedValue(mockOrganizations);
  vi.mocked(getAdminUsers).mockResolvedValue(users);
  vi.mocked(getAdminRoles).mockResolvedValue(mockAdminRoles);
  vi.mocked(getAdminOperations).mockResolvedValue(operations);
});

afterEach(() => {
  cleanup();
});

describe('AdminDashboard home', () => {
  it('CT-ADMIN-01: shows a loading message, then the organization stats', async () => {
    render(<AdminDashboard currentUser={mockCurrentUserAdmin} />);

    expect(screen.getByText('Loading admin dashboard...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Welcome back, Morgan' })).toBeInTheDocument();
    expect(statValue('Total Members')).toBe('3');
    expect(statValue('Pending Invitations')).toBe('1');
    expect(statValue('Unassigned Cases')).toBe('1');
  });

  it('CT-ADMIN-02: shows an error when admin data fails to load', async () => {
    vi.mocked(getAdminUsers).mockRejectedValue(new Error('Forbidden'));
    render(<AdminDashboard currentUser={mockCurrentUserAdmin} />);

    expect(await screen.findByText('Failed to load admin dashboard: Forbidden')).toBeInTheDocument();
  });

  it('CT-ADMIN-03: assigns an unassigned case to the selected lawyer', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    const lawyerSelect = screen.getByRole('combobox', { name: 'Lawyer for C-2026-050' });
    expect(lawyerSelect).toHaveValue('lawyer-1');
    await user.selectOptions(lawyerSelect, 'lawyer-2');
    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(assignAdminCaseLawyer).toHaveBeenCalledWith('C-2026-050', { lawyer_user_id: 'lawyer-2' });
    expect(await screen.findByText('Assigned case C-2026-050')).toBeInTheDocument();
    await waitFor(() => expect(getAdminOperations).toHaveBeenCalledTimes(2));
  });

  it('CT-ADMIN-04: reports a failed case assignment', async () => {
    const user = userEvent.setup();
    vi.mocked(assignAdminCaseLawyer).mockRejectedValueOnce(new Error('Lawyer is at capacity'));
    await renderDashboard();

    await user.click(screen.getByRole('button', { name: 'Assign' }));

    expect(await screen.findByText('Lawyer is at capacity')).toBeInTheDocument();
  });

  it('CT-ADMIN-05: reloads data from the Refresh button', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    await waitFor(() => expect(getAdminUsers).toHaveBeenCalledTimes(2));
  });
});

describe('AdminDashboard members', () => {
  it('CT-ADMIN-06: filters members by name and resets the filter', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openMembers(user);

    await user.type(screen.getByRole('textbox', { name: 'Filter by name' }), 'avery');
    expect(screen.getByRole('cell', { name: 'Avery Counsel' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Jordan Client' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByRole('cell', { name: 'Jordan Client' })).toBeInTheDocument();
  });

  it('CT-ADMIN-07: adds a role after confirmation', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openMembers(user);

    const row = rowStartingWith('Avery Counsel');
    expect(within(row).getByRole('combobox', { name: 'Role to add for Avery Counsel' })).toHaveValue('client');
    await user.click(within(row).getByRole('button', { name: 'Add' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Assign Role' })).getByRole('button', { name: 'Assign' }));

    expect(assignAdminRole).toHaveBeenCalledWith(mockAdminUsers[0].id, 'client');
    expect(await screen.findByText('Assigned client to Avery Counsel')).toBeInTheDocument();
  });

  it('CT-ADMIN-08: removes a role after confirmation', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openMembers(user);

    await user.click(within(rowStartingWith('Avery Counsel')).getByRole('button', { name: 'lawyer ×' }));
    const dialog = screen.getByRole('dialog', { name: 'Remove Role' });
    expect(dialog).toHaveTextContent('Remove "lawyer" from Avery Counsel?');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(removeAdminRole).toHaveBeenCalledWith(mockAdminUsers[0].id, 'lawyer');
  });

  it('CT-ADMIN-09: deletes another member but never the signed-in admin', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openMembers(user);

    expect(within(rowStartingWith('Morgan Admin')).getByRole('button', { name: 'Delete' })).toBeDisabled();

    await user.click(within(rowStartingWith('Jordan Client')).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete User' })).getByRole('button', { name: 'Delete' }));

    expect(deleteAdminUser).toHaveBeenCalledWith(clientUserIdFromUsers());
    expect(await screen.findByText('Deleted user: Jordan Client')).toBeInTheDocument();
  });

  it('CT-ADMIN-10: does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    await renderDashboard();
    await openMembers(user);

    await user.click(within(rowStartingWith('Jordan Client')).getByRole('button', { name: 'Delete' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete User' })).getByRole('button', { name: 'Cancel' }));

    expect(deleteAdminUser).not.toHaveBeenCalled();
  });

  it('CT-ADMIN-11: creates an active user after reviewing a summary', async () => {
    const user = userEvent.setup();
    vi.mocked(createAdminUser).mockResolvedValue({ ...mockAdminUsers[0], full_name: 'Sam Lee', invitation_url: null });
    await renderDashboard();
    await openMembers(user);

    await user.type(screen.getByLabelText('First Name'), 'Sam');
    await user.type(screen.getByLabelText('Last Name'), 'Lee');
    await user.type(screen.getByLabelText('Email'), 'sam@example.test');
    await user.type(screen.getByLabelText('Temporary Password'), 'Synthetic-password-1');
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    const summary = screen.getByRole('dialog', { name: 'Confirm Create User' });
    expect(within(summary).getByText('North Star Immigration')).toBeInTheDocument();
    expect(within(summary).getByText('••••••••')).toBeInTheDocument();
    expect(within(summary).queryByText('Synthetic-password-1')).not.toBeInTheDocument();
    await user.click(within(summary).getByRole('button', { name: 'Create' }));

    expect(createAdminUser).toHaveBeenCalledWith({
      organization_id: organizationId,
      email: 'sam@example.test',
      first_name: 'Sam',
      last_name: 'Lee',
      password: 'Synthetic-password-1',
      status: 'active',
      role_slug: 'lawyer',
    });
    expect(await screen.findByText('User created: Sam Lee')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toHaveValue('');
  });

  it('CT-ADMIN-12: invites a user without a password and shows the invitation link', async () => {
    const user = userEvent.setup();
    vi.mocked(createAdminUser).mockResolvedValue({
      ...mockAdminUsers[0],
      full_name: 'Sam Lee',
      invitation_url: 'https://app.example.test/invite?token=synthetic',
    });
    await renderDashboard();
    await openMembers(user);

    await user.selectOptions(screen.getByLabelText('Status'), 'invited');
    await user.type(screen.getByLabelText('First Name'), 'Sam');
    await user.type(screen.getByLabelText('Last Name'), 'Lee');
    await user.type(screen.getByLabelText('Email'), 'sam@example.test');
    await user.click(screen.getByRole('button', { name: 'Create User' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Confirm Create User' })).getByRole('button', { name: 'Create' }));

    expect(createAdminUser).toHaveBeenCalledWith(expect.objectContaining({ status: 'invited', password: undefined }));
    expect(await screen.findByRole('dialog', { name: 'Invitation link ready' })).toBeInTheDocument();
  });

  it('CT-ADMIN-13: revokes a pending invitation and resends an expired one', async () => {
    const user = userEvent.setup();
    vi.mocked(resendAdminInvitation).mockResolvedValue({ invitation_url: 'https://app.example.test/invite?token=new' });
    await renderDashboard();
    await openMembers(user);

    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(revokeAdminInvitation).toHaveBeenCalledWith('inv-pending');
    expect(await screen.findByText('Revoked invitation for pending@example.test')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Resend' }));
    expect(resendAdminInvitation).toHaveBeenCalledWith('inv-expired');
    expect(await screen.findByRole('dialog', { name: 'Invitation link ready' })).toBeInTheDocument();
  });
});

describe('AdminDashboard navigation and roles', () => {
  it('CT-ADMIN-14: navigates to Case History from the sidebar', async () => {
    const user = userEvent.setup();
    await renderDashboard();

    await user.click(screen.getByRole('button', { name: 'Case History' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Case History' })).toBeInTheDocument();
  });

  it('CT-ADMIN-15: hides the sidebar when the section is controlled by the app shell', async () => {
    render(<AdminDashboard currentUser={mockCurrentUserAdmin} activeSection="org-members" onSectionChange={vi.fn()} />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Members' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Case History' })).not.toBeInTheDocument();
  });

  it('CT-ADMIN-16: sends super admins to Home instead of org-only sections', async () => {
    const superAdmin: CurrentUser = { ...mockCurrentUserAdmin, roles: ['super_admin'], active_role: 'super_admin' };
    render(<AdminDashboard currentUser={superAdmin} activeSection="settings-general" onSectionChange={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: 'Welcome back, Morgan' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create Organization' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Case Assignment Queue' })).not.toBeInTheDocument();
  });

  it('CT-ADMIN-17: lets super admins create an organization after reviewing a summary', async () => {
    const user = userEvent.setup();
    const superAdmin: CurrentUser = {
      ...mockCurrentUserAdmin,
      organization_id: 'platform-org',
      roles: ['super_admin'],
      active_role: 'super_admin',
    };
    vi.mocked(createAdminOrganization).mockResolvedValue({ ...mockOrganizations[0], name: 'Maple Law' });
    await renderDashboard(superAdmin);

    expect(screen.queryByRole('button', { name: 'Case History' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Organization Name'), 'Maple Law');
    await user.type(screen.getByLabelText('Contact Email'), 'hello@maple.example.test');
    await user.type(screen.getByLabelText('Slug'), '  maple-law  ');
    await user.selectOptions(screen.getByLabelText('Tier'), 'pro');
    await user.click(screen.getByRole('button', { name: 'Create Organization' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Confirm Create Organization' })).getByRole('button', { name: 'Create' })
    );

    expect(createAdminOrganization).toHaveBeenCalledWith({
      name: 'Maple Law',
      contact_email: 'hello@maple.example.test',
      slug: 'maple-law',
      subscription_tier: 'pro',
      subscription_status: 'active',
    });
    expect(await screen.findByText('Organization created: Maple Law')).toBeInTheDocument();
  });
});
