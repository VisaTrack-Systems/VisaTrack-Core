/** newCaseDialog: Component tests for creating a case for an existing or new client. */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { UserListItem } from '@/lib/api';

import { NewCaseDialog } from '../design-system/components/NewCaseDialog';
import { mockLawyerClients } from '../design-system/storybook/fixtures';

function renderDialog(overrides?: {
  isOpen?: boolean;
  clients?: UserListItem[];
  loadingClients?: boolean;
  submitting?: boolean;
  errorMessage?: string | null;
}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn(async () => undefined);
  const result = render(
    <NewCaseDialog
      isOpen={overrides?.isOpen ?? true}
      clients={overrides?.clients ?? mockLawyerClients}
      loadingClients={overrides?.loadingClients ?? false}
      submitting={overrides?.submitting ?? false}
      errorMessage={overrides?.errorMessage ?? null}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
  return { ...result, onClose, onSubmit };
}

describe('NewCaseDialog', () => {
  it('CT-NEWCASE-01: renders nothing when closed', () => {
    const { container } = renderDialog({ isOpen: false });

    expect(container).toBeEmptyDOMElement();
  });

  it('CT-NEWCASE-02: creates a case for the first existing client by default', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    expect(screen.getByRole('button', { name: 'Existing Client' })).toHaveAttribute('aria-pressed', 'true');
    await user.selectOptions(screen.getByLabelText('Priority'), 'urgent');
    await user.type(screen.getByLabelText('Target Filing Date (Optional)'), '2026-12-01');
    await user.click(screen.getByRole('button', { name: 'Create Case' }));

    expect(onSubmit).toHaveBeenCalledWith({
      client_mode: 'existing',
      client_user_id: mockLawyerClients[0].id,
      case_type: 'Express Entry',
      priority: 'urgent',
      target_filing_date: '2026-12-01',
    });
  });

  it('CT-NEWCASE-03: creates a case with a new client', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'New Client' }));
    await user.clear(screen.getByLabelText('Case Type'));
    await user.type(screen.getByLabelText('Case Type'), ' Study Permit ');
    await user.type(screen.getByLabelText('Client Email'), 'new.client@example.test');
    await user.type(screen.getByLabelText('First Name'), ' Sam ');
    await user.type(screen.getByLabelText('Last Name'), ' Lee ');
    await user.click(screen.getByRole('button', { name: 'Create Case' }));

    expect(onSubmit).toHaveBeenCalledWith({
      client_mode: 'new',
      email: 'new.client@example.test',
      first_name: 'Sam',
      last_name: 'Lee',
      case_type: 'Study Permit',
      priority: 'medium',
      target_filing_date: null,
    });
  });

  it('CT-NEWCASE-04: starts in new-client mode when there are no clients', () => {
    renderDialog({ clients: [] });

    expect(screen.getByRole('button', { name: 'Existing Client' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New Client' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Client Email')).toBeRequired();
  });

  it('CT-NEWCASE-05: rejects a blank case type', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.clear(screen.getByLabelText('Case Type'));
    await user.type(screen.getByLabelText('Case Type'), '   ');
    await user.click(screen.getByRole('button', { name: 'Create Case' }));

    expect(screen.getByText('Case type is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('CT-NEWCASE-06: rejects a new client with only whitespace names', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({ clients: [] });

    await user.type(screen.getByLabelText('Client Email'), 'new.client@example.test');
    await user.type(screen.getByLabelText('First Name'), '  ');
    await user.type(screen.getByLabelText('Last Name'), '  ');
    await user.click(screen.getByRole('button', { name: 'Create Case' }));

    expect(screen.getByText('New client email, first name, and last name are required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('CT-NEWCASE-07: shows server errors and disables actions while creating', () => {
    renderDialog({ submitting: true, errorMessage: 'Client email already exists' });

    expect(screen.getByText('Client email already exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Creating Case...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  });

  it('CT-NEWCASE-08: waits for clients to load before creating', () => {
    renderDialog({ loadingClients: true });

    expect(screen.getByText('Loading clients...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Case' })).toBeDisabled();
  });

  it('CT-NEWCASE-09: closes from Cancel', async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
