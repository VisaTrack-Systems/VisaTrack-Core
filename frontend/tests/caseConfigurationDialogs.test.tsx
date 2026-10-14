/** caseConfigurationDialogs: Component tests for the rename, delete, and milestone dialogs in case configuration. */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteDocumentDialog } from '../design-system/components/case-configuration/dialogs/DeleteDocumentDialog';
import { MilestoneDialog } from '../design-system/components/case-configuration/dialogs/MilestoneDialog';
import { RenameDocumentDialog } from '../design-system/components/case-configuration/dialogs/RenameDocumentDialog';

describe('RenameDocumentDialog', () => {
  function renderRenameDialog(options?: { submitting?: boolean; result?: boolean }) {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async () => options?.result ?? true);
    render(
      <RenameDocumentDialog
        initialName="Passport scan"
        submitting={options?.submitting ?? false}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
    return { onClose, onSubmit };
  }

  it('CT-DIALOG-01: starts with the current name', () => {
    renderRenameDialog();

    expect(screen.getByRole('dialog', { name: 'Rename Document' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('Passport scan');
  });

  it('CT-DIALOG-02: requires a non-blank name', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderRenameDialog();

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Document name is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('CT-DIALOG-03: submits the trimmed name and closes on success', async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderRenameDialog();

    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '  Passport (renewed)  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith('Passport (renewed)');
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('CT-DIALOG-04: stays open when saving fails', async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderRenameDialog({ result: false });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('CT-DIALOG-05: disables actions while saving', () => {
    renderRenameDialog({ submitting: true });

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

describe('DeleteDocumentDialog', () => {
  it('CT-DIALOG-06: names the document and confirms deletion', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(
      <DeleteDocumentDialog documentName="Passport scan" submitting={false} onClose={onClose} onConfirm={onConfirm} />
    );

    expect(screen.getByRole('dialog', { name: 'Delete Document' })).toHaveTextContent('Delete Passport scan?');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('CT-DIALOG-07: closes from the header close button without deleting', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(
      <DeleteDocumentDialog documentName="Passport scan" submitting={false} onClose={onClose} onConfirm={onConfirm} />
    );

    await user.click(screen.getByRole('button', { name: 'Close Delete Document' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('CT-DIALOG-08: disables actions while deleting', () => {
    render(
      <DeleteDocumentDialog documentName="Passport scan" submitting onClose={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

describe('MilestoneDialog', () => {
  function renderMilestoneDialog(initialValue?: Parameters<typeof MilestoneDialog>[0]['initialValue']) {
    const onClose = vi.fn();
    const onSubmit = vi.fn(async () => true);
    render(
      <MilestoneDialog
        title="Add Milestone"
        submitLabel="Add Milestone"
        submitting={false}
        initialValue={initialValue}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    );
    return { onClose, onSubmit };
  }

  it('CT-DIALOG-09: requires a milestone name', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderMilestoneDialog();

    await user.click(screen.getByRole('button', { name: 'Add Milestone' }));

    expect(screen.getByText('Milestone name is required.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('CT-DIALOG-10: defaults to a client-visible, not-started milestone with no description or due date', async () => {
    const user = userEvent.setup();
    const { onClose, onSubmit } = renderMilestoneDialog();

    await user.type(screen.getByPlaceholderText('e.g., Application submitted to IRCC'), '  Biometrics  ');
    await user.click(screen.getByRole('button', { name: 'Add Milestone' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Biometrics',
      description: null,
      due_date: null,
      status: 'not_started',
      client_visible: true,
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('CT-DIALOG-11: lists the milestone statuses with readable labels', () => {
    renderMilestoneDialog();

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['Not Started', 'In Progress', 'Blocked', 'Completed', 'Skipped']);
  });

  it('CT-DIALOG-12: submits edits to an existing milestone', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderMilestoneDialog({
      name: 'Medical exam',
      description: 'Book with panel physician',
      due_date: '2026-11-01',
      status: 'in_progress',
      client_visible: true,
    });

    await user.selectOptions(screen.getByRole('combobox'), 'completed');
    await user.click(screen.getByRole('checkbox', { name: 'Visible in client portal' }));
    await user.click(screen.getByRole('button', { name: 'Add Milestone' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Medical exam',
      description: 'Book with panel physician',
      due_date: '2026-11-01',
      status: 'completed',
      client_visible: false,
    });
  });
});
