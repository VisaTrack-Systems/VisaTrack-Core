import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import {
  mockAdminOperations,
  mockAdminRoles,
  mockAdminUsers,
  mockCurrentUserAdmin,
  mockOrganizations,
} from '../storybook/fixtures';
import { jsonRoute } from '../storybook/mockApi';
import { AdminDashboard } from './AdminDashboard';

const meta = {
  title: 'Components/Admin Dashboard',
  component: AdminDashboard,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    mockApi: [
      jsonRoute('GET', '/api/v1/admin/organizations', mockOrganizations),
      jsonRoute('GET', '/api/v1/admin/users', mockAdminUsers),
      jsonRoute('GET', '/api/v1/admin/roles', mockAdminRoles),
      jsonRoute('GET', '/api/v1/admin/operations', mockAdminOperations),
    ],
  },
  args: {
    currentUser: mockCurrentUserAdmin,
  },
} satisfies Meta<typeof AdminDashboard>;

export default meta;

type Story = StoryObj<typeof meta>;

// ─── Assign Role ────────────────────────────────────────────────────────────

/**
 * Clicking "Add" in the Manage Roles column triggers the role assignment API
 * and shows a success flash message. The mock returns the same user list so
 * the table re-renders without error.
 */
export const AssignRoleSuccess: Story = {
  parameters: {
    mockApi: [
      jsonRoute('GET', '/api/v1/admin/organizations', mockOrganizations),
      jsonRoute('GET', '/api/v1/admin/users', mockAdminUsers),
      jsonRoute('GET', '/api/v1/admin/roles', mockAdminRoles),
      jsonRoute('GET', '/api/v1/admin/operations', mockAdminOperations),
      jsonRoute('POST', /^\/api\/v1\/admin\/users\/[^/]+\/roles$/, {}),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for the table to load
    await canvas.findByRole('heading', { name: 'All Users' });

    // Click the first "Add" button in the Manage Roles column
    const addButtons = await canvas.findAllByRole('button', { name: 'Add' });
    await userEvent.click(addButtons[0]);

    // The flash message should confirm success (the role assigned will vary
    // by whatever the dropdown defaulted to for the first user)
    await expect(
      await canvas.findByText(/assigned/i)
    ).toBeInTheDocument();
  },
};

// ─── Remove Role ─────────────────────────────────────────────────────────────

/**
 * Clicking a role badge (e.g. "lawyer ×") calls the remove-role API and
 * shows a success flash message.
 */
export const RemoveRoleSuccess: Story = {
  parameters: {
    mockApi: [
      jsonRoute('GET', '/api/v1/admin/organizations', mockOrganizations),
      jsonRoute('GET', '/api/v1/admin/users', mockAdminUsers),
      jsonRoute('GET', '/api/v1/admin/roles', mockAdminRoles),
      jsonRoute('GET', '/api/v1/admin/operations', mockAdminOperations),
      jsonRoute('DELETE', /^\/api\/v1\/admin\/users\/[^/]+\/roles\/[^/]+$/, {}),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole('heading', { name: 'All Users' });

    // Each user role renders as "slug ×" — click the first one
    const roleBadges = await canvas.findAllByTitle('Remove role');
    await userEvent.click(roleBadges[0]);

    await expect(
      await canvas.findByText(/removed/i)
    ).toBeInTheDocument();
  },
};

// ─── Delete User ─────────────────────────────────────────────────────────────

/**
 * Clicking "Delete" triggers window.confirm. When confirmed, the API is called
 * and a success flash appears.
 */
export const DeleteUserConfirmed: Story = {
  parameters: {
    mockApi: [
      jsonRoute('GET', '/api/v1/admin/organizations', mockOrganizations),
      jsonRoute('GET', '/api/v1/admin/users', mockAdminUsers),
      jsonRoute('GET', '/api/v1/admin/roles', mockAdminRoles),
      jsonRoute('GET', '/api/v1/admin/operations', mockAdminOperations),
      jsonRoute('DELETE', /^\/api\/v1\/admin\/users\/[^/]+$/, {}, 204),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole('heading', { name: 'All Users' });

    // Stub window.confirm to accept the deletion
    const originalConfirm = window.confirm;
    window.confirm = () => true;

    try {
      const deleteButtons = await canvas.findAllByRole('button', { name: 'Delete' });
      // The first enabled Delete button (admin can't delete themselves)
      const enabled = deleteButtons.find((btn) => !btn.hasAttribute('disabled'));
      if (!enabled) throw new Error('No enabled Delete button found');
      await userEvent.click(enabled);

      await expect(
        await canvas.findByText(/deleted user/i)
      ).toBeInTheDocument();
    } finally {
      window.confirm = originalConfirm;
    }
  },
};

// ─── Create User — Confirmation Dialog ───────────────────────────────────────

/**
 * Filling in the Create User form and submitting shows the confirmation
 * dialog with all entered field values before the API is called.
 */
export const CreateUserConfirmationDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for form to be available
    await canvas.findByRole('heading', { name: 'Create User' });

    await userEvent.type(canvas.getByPlaceholderText('first@example.com'), 'test@example.com');
    await userEvent.type(canvas.getByPlaceholderText('First'), 'Alice');
    await userEvent.type(canvas.getByPlaceholderText('Last'), 'Example');
    await userEvent.type(canvas.getByPlaceholderText('Min. 8 characters'), 'password123');

    await userEvent.click(canvas.getByRole('button', { name: 'Create User' }));

    // Confirmation dialog should appear with the entered values
    await expect(
      await canvas.findByRole('heading', { name: 'Confirm Create User' })
    ).toBeInTheDocument();

    await expect(canvas.getByText('Alice')).toBeInTheDocument();
    await expect(canvas.getByText('Example')).toBeInTheDocument();
    await expect(canvas.getByText('test@example.com')).toBeInTheDocument();
  },
};

// ─── Invitation Email — Success ───────────────────────────────────────────────

/**
 * When a user is created with status "invited", the invitation link modal
 * appears. Entering an email and clicking "Send" calls the send-email API and
 * displays a success message.
 */
export const SendInvitationEmailSuccess: Story = {
  parameters: {
    mockApi: [
      jsonRoute('GET', '/api/v1/admin/organizations', mockOrganizations),
      jsonRoute('GET', '/api/v1/admin/users', mockAdminUsers),
      jsonRoute('GET', '/api/v1/admin/roles', mockAdminRoles),
      jsonRoute('GET', '/api/v1/admin/operations', mockAdminOperations),
      jsonRoute('POST', '/api/v1/admin/users', {
        id: 'new-user-id',
        email: 'invited@example.com',
        full_name: 'Bob Invited',
        status: 'invited',
        organization_id: mockOrganizations[0].id,
        created_at: new Date().toISOString(),
        roles: ['lawyer'],
        invitation_url: 'http://localhost:3000/invite?token=test-token-abc123',
      }),
      jsonRoute('POST', '/api/v1/admin/send-invitation-email', {}, 204),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole('heading', { name: 'Create User' });

    // Fill in the form
    await userEvent.type(canvas.getByPlaceholderText('first@example.com'), 'invited@example.com');
    await userEvent.type(canvas.getByPlaceholderText('First'), 'Bob');
    await userEvent.type(canvas.getByPlaceholderText('Last'), 'Invited');

    // Set status to "Invited" — no password needed for this path
    await userEvent.selectOptions(
      canvas.getAllByRole('combobox').find((el) => el.textContent?.includes('Active'))!,
      'invited'
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Create User' }));

    // Confirm the creation dialog
    await canvas.findByRole('heading', { name: 'Confirm Create User' });
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));

    // Invitation link modal should appear
    await canvas.findByRole('heading', { name: 'Invitation link ready' });

    // Type an email address and send
    await userEvent.type(canvas.getByPlaceholderText('recipient@example.com'), 'recipient@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));

    // Success feedback
    await expect(
      await canvas.findByText('Email sent successfully.')
    ).toBeInTheDocument();
  },
};

// ─── Invitation Email — Error ─────────────────────────────────────────────────

/**
 * When the send-invitation-email endpoint returns an error, the modal shows
 * an inline error message so the admin can copy the link manually instead.
 */
export const SendInvitationEmailError: Story = {
  parameters: {
    mockApi: [
      jsonRoute('GET', '/api/v1/admin/organizations', mockOrganizations),
      jsonRoute('GET', '/api/v1/admin/users', mockAdminUsers),
      jsonRoute('GET', '/api/v1/admin/roles', mockAdminRoles),
      jsonRoute('GET', '/api/v1/admin/operations', mockAdminOperations),
      jsonRoute('POST', '/api/v1/admin/users', {
        id: 'new-user-id-2',
        email: 'invited2@example.com',
        full_name: 'Carol Invited',
        status: 'invited',
        organization_id: mockOrganizations[0].id,
        created_at: new Date().toISOString(),
        roles: ['lawyer'],
        invitation_url: 'http://localhost:3000/invite?token=test-token-xyz789',
      }),
      jsonRoute('POST', '/api/v1/admin/send-invitation-email', { detail: 'SMTP not configured' }, 503),
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByRole('heading', { name: 'Create User' });

    await userEvent.type(canvas.getByPlaceholderText('first@example.com'), 'invited2@example.com');
    await userEvent.type(canvas.getByPlaceholderText('First'), 'Carol');
    await userEvent.type(canvas.getByPlaceholderText('Last'), 'Invited');

    await userEvent.selectOptions(
      canvas.getAllByRole('combobox').find((el) => el.textContent?.includes('Active'))!,
      'invited'
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Create User' }));
    await canvas.findByRole('heading', { name: 'Confirm Create User' });
    await userEvent.click(canvas.getByRole('button', { name: 'Create' }));

    await canvas.findByRole('heading', { name: 'Invitation link ready' });

    await userEvent.type(canvas.getByPlaceholderText('recipient@example.com'), 'recipient@example.com');
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }));

    // The error detail from the API should appear inline
    await expect(
      await canvas.findByText(/request failed: 503/i)
    ).toBeInTheDocument();

    // The invitation link input should still be visible so admin can copy it
    await waitFor(() => {
      expect(canvas.getByDisplayValue('http://localhost:3000/invite?token=test-token-xyz789')).toBeInTheDocument();
    });
  },
};
