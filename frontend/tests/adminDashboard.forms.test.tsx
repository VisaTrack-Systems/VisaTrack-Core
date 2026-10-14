/** adminDashboard.forms: Component tests for the admin ConfirmDialog and CreateUserForm. */

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { AdminCreateUserInput } from '@/lib/api';

import { ConfirmDialog } from '../design-system/components/admin-dashboard/ConfirmDialog';
import { CreateUserForm } from '../design-system/components/admin-dashboard/CreateUserForm';
import { mockAdminRoles, mockOrganizations, organizationId } from '../design-system/storybook/fixtures';

describe('ConfirmDialog', () => {
  function renderConfirmDialog(variant: 'danger' | 'info' = 'danger') {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        title="Disable user?"
        message="They will no longer be able to sign in."
        confirmLabel="Disable"
        variant={variant}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );
    return { onConfirm, onClose };
  }

  it('CT-ADMINFORM-01: renders an accessible dialog with the title and message', () => {
    renderConfirmDialog();

    const dialog = screen.getByRole('dialog', { name: 'Disable user?' });
    expect(within(dialog).getByText('They will no longer be able to sign in.')).toBeInTheDocument();
  });

  it('CT-ADMINFORM-02: runs the action and then closes when confirmed', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderConfirmDialog();

    await user.click(screen.getByRole('button', { name: 'Disable' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it.each(['Cancel', 'Close'])('CT-ADMINFORM-03: closes without running the action via %s', async (buttonName) => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderConfirmDialog('info');

    await user.click(screen.getByRole('button', { name: buttonName }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('CreateUserForm', () => {
  const baseForm: AdminCreateUserInput = {
    organization_id: organizationId,
    email: '',
    first_name: '',
    last_name: '',
    password: '',
    status: 'active',
    role_slug: 'lawyer',
  };

  function renderCreateUserForm(overrides?: {
    userForm?: Partial<AdminCreateUserInput>;
    roles?: typeof mockAdminRoles;
  }) {
    const onFormChange = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <CreateUserForm
        organizations={mockOrganizations}
        roles={overrides?.roles ?? mockAdminRoles}
        userForm={{ ...baseForm, ...overrides?.userForm }}
        onFormChange={onFormChange}
        onSubmit={onSubmit}
      />
    );
    return { onFormChange, onSubmit };
  }

  it('CT-ADMINFORM-04: merges each field edit into the existing form', () => {
    const { onFormChange } = renderCreateUserForm({ userForm: { first_name: 'Riley' } });

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'riley@example.test' } });

    expect(onFormChange).toHaveBeenCalledWith({
      ...baseForm,
      first_name: 'Riley',
      email: 'riley@example.test',
    });
  });

  it('CT-ADMINFORM-05: asks for a temporary password for active users', () => {
    renderCreateUserForm();

    const password = screen.getByLabelText('Temporary Password');
    expect(password).toBeRequired();
    expect(password).toHaveAttribute('minLength', '8');
  });

  it('CT-ADMINFORM-06: skips the password field for invited users', () => {
    renderCreateUserForm({ userForm: { status: 'invited' } });

    expect(screen.queryByLabelText('Temporary Password')).not.toBeInTheDocument();
    expect(screen.getByText(/the user will set one via the invitation link/)).toBeInTheDocument();
  });

  it('CT-ADMINFORM-07: never offers the super_admin role', () => {
    renderCreateUserForm({
      roles: [
        ...mockAdminRoles,
        { ...mockAdminRoles[0], id: 'role-super', name: 'Super Admin', slug: 'super_admin' },
      ],
    });

    const roleOptions = within(screen.getByLabelText('Role')).getAllByRole('option');
    expect(roleOptions.map((option) => option.textContent)).toEqual(['Lawyer', 'Client']);
  });

  it('CT-ADMINFORM-08: falls back to a Lawyer role option when roles have not loaded', () => {
    renderCreateUserForm({ roles: [] });

    const roleOptions = within(screen.getByLabelText('Role')).getAllByRole('option');
    expect(roleOptions.map((option) => option.textContent)).toEqual(['Lawyer']);
  });

  it('CT-ADMINFORM-09: submits the form', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderCreateUserForm({
      userForm: {
        first_name: 'Riley',
        last_name: 'Park',
        email: 'riley@example.test',
        password: 'Synthetic-password-1',
      },
    });

    await user.click(screen.getByRole('button', { name: 'Create User' }));

    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
