/** CaseConfigurationDialogs.stories: Storybook stories for CaseConfigurationDialogs components. Demonstrates various component states and usage patterns. */

import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { AddDocumentDialog } from './dialogs/AddDocumentDialog';
import { CaseConfigDialog } from './dialogs/CaseConfigDialog';
import { CreateSuiteDialog } from './dialogs/CreateSuiteDialog';
import { DeleteDocumentDialog } from './dialogs/DeleteDocumentDialog';
import { DeleteMilestoneDialog } from './dialogs/DeleteMilestoneDialog';
import { MilestoneDialog } from './dialogs/MilestoneDialog';
import { RenameDocumentDialog } from './dialogs/RenameDocumentDialog';
import { mockCaseWorkspace } from '../../storybook/fixtures';

const StoryHost = () => null;

const meta = {
  title: 'Components/Case Configuration/Dialogs',
  component: StoryHost,
  tags: ['autodocs'],
} satisfies Meta<typeof StoryHost>;

export default meta;

type Story = StoryObj<typeof meta>;

const addDocumentSubmit = fn(async () => true);
const createSuiteSubmit = fn(async () => true);
const milestoneSubmit = fn(async () => true);
const renameDocumentSubmit = fn(async () => true);

export const BaseDialog: Story = {
  render: () => (
    <CaseConfigDialog title="Case Config" description="Shared dialog chrome" onClose={() => {}}>
      <div className="px-6 py-5 text-sm text-gray-700">Dialog body content.</div>
    </CaseConfigDialog>
  ),
};

export const AddDocument: Story = {
  render: () => (
    <AddDocumentDialog workspace={mockCaseWorkspace} submitting={false} onClose={() => {}} onSubmit={addDocumentSubmit} />
  ),
  play: async ({ canvasElement }) => {
    addDocumentSubmit.mockClear();
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Add Document' }));
    await expect(await canvas.findByText('Document name is required.')).toBeInTheDocument();

    await userEvent.type(canvas.getByPlaceholderText('e.g., Additional Proof of Employment'), 'Updated Police Certificate');
    await userEvent.type(canvas.getByPlaceholderText('Optional guidance for client uploads.'), 'Upload both sides if applicable.');
    await userEvent.click(canvas.getByRole('button', { name: 'Add Document' }));

    await expect(addDocumentSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Updated Police Certificate',
        required: true,
        instructions: 'Upload both sides if applicable.',
      })
    );
  },
};

export const CreateSuite: Story = {
  render: () => <CreateSuiteDialog submitting={false} onClose={() => {}} onSubmit={createSuiteSubmit} />,
  play: async ({ canvasElement }) => {
    createSuiteSubmit.mockClear();
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Create Suite' }));
    await expect(await canvas.findByText('Suite name is required.')).toBeInTheDocument();

    await userEvent.type(canvas.getByPlaceholderText('e.g., Country-Specific Requirements'), 'IRCC Follow-up');
    await userEvent.type(canvas.getByPlaceholderText('Optional description for this suite.'), 'Additional evidence requested after intake.');
    await userEvent.click(canvas.getByRole('button', { name: 'Create Suite' }));

    await expect(createSuiteSubmit).toHaveBeenCalledWith({
      name: 'IRCC Follow-up',
      description: 'Additional evidence requested after intake.',
    });
  },
};

export const DeleteDocument: Story = {
  render: () => (
    <DeleteDocumentDialog documentName="Employer Reference Letter" submitting={false} onClose={() => {}} onConfirm={async () => {}} />
  ),
};

export const DeleteMilestone: Story = {
  render: () => (
    <DeleteMilestoneDialog milestoneName="Lawyer review" submitting={false} onClose={() => {}} onConfirm={async () => {}} />
  ),
};

export const MilestoneEditor: Story = {
  render: () => (
    <MilestoneDialog
      title="Edit Milestone"
      description="Adjust milestone timing and visibility."
      submitLabel="Save Changes"
      submitting={false}
      initialValue={{
        name: 'Lawyer review',
        description: 'Review revised employment evidence.',
        due_date: '2026-03-04',
        status: 'in_progress',
        client_visible: true,
      }}
      onClose={() => {}}
      onSubmit={milestoneSubmit}
    />
  ),
  play: async ({ canvasElement }) => {
    milestoneSubmit.mockClear();
    const canvas = within(canvasElement);

    const nameInput = canvas.getByDisplayValue('Lawyer review');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Final lawyer review');
    await userEvent.click(canvas.getByRole('checkbox'));
    await userEvent.click(canvas.getByRole('button', { name: 'Save Changes' }));

    await expect(milestoneSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Final lawyer review',
        client_visible: false,
      })
    );
  },
};

export const RenameDocument: Story = {
  render: () => <RenameDocumentDialog initialName="Travel History Summary" submitting={false} onClose={() => {}} onSubmit={renameDocumentSubmit} />,
  play: async ({ canvasElement }) => {
    renameDocumentSubmit.mockClear();
    const canvas = within(canvasElement);

    const nameInput = canvas.getByDisplayValue('Travel History Summary');
    await userEvent.clear(nameInput);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText('Document name is required.')).toBeInTheDocument();

    await userEvent.type(nameInput, 'Travel History Timeline');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await expect(renameDocumentSubmit).toHaveBeenCalledWith('Travel History Timeline');
  },
};
