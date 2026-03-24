import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { AppointmentsPanel } from './AppointmentsPanel';
import { BillingSummaryPanel } from './BillingSummaryPanel';
import { CaseSummaryCard } from './CaseSummaryCard';
import { DocumentChecklistPanel } from './DocumentChecklistPanel';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { RemindersPanel } from './RemindersPanel';
import { MilestonesPanel } from './MilestonesPanel';
import {
  mockBillingInfo,
  mockCaseInfo,
  mockDashboardAppointments,
  mockDashboardDocuments,
  mockDashboardReminders,
  mockDashboardMilestones,
} from '../../storybook/fixtures';

const StoryHost = () => null;

const meta = {
  title: 'Components/Client Dashboard',
  component: StoryHost,
  tags: ['autodocs'],
} satisfies Meta<typeof StoryHost>;

export default meta;

type Story = StoryObj<typeof meta>;

const documentUploadSubmit = fn(async () => {});
const reminderMarkRead = fn(async () => {});

export const CaseSummary: Story = {
  render: () => <CaseSummaryCard caseInfo={mockCaseInfo} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByText('We are currently preparing your case package and reviewing the remaining supporting evidence before submission.')
    ).toBeInTheDocument();
  },
};

export const DocumentChecklist: Story = {
  render: () => (
    <DocumentChecklistPanel
      documents={mockDashboardDocuments}
      completedRequiredDocuments={1}
      requiredDocuments={3}
      canUploadDocuments
      onUploadDocument={async () => {}}
      onDeleteUploadedDocument={async () => {}}
      onDownloadDocument={async () => {}}
      uploadingDocumentId={null}
      deletingDocumentId={null}
      downloadingDocumentId={null}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rejectedRow = canvas.getByText('Employer Reference Letter').closest('.p-6');

    if (!(rejectedRow instanceof HTMLElement)) {
      throw new Error('Expected rejected document row');
    }

    const rejectedScope = within(rejectedRow);

    await expect(canvas.getByText('Rejection Note')).toBeInTheDocument();
    await expect(
      canvas.getByText('Please upload a revised letter that includes salary and a full duties breakdown.')
    ).toBeInTheDocument();
    await expect(rejectedScope.queryByText('File: reference-letter.pdf')).not.toBeInTheDocument();
    await expect(rejectedScope.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  },
};

export const DocumentUploadModal: Story = {
  render: () => (
    <DocumentUploadDialog
      isOpen
      document={mockDashboardDocuments[0]}
      submitting={false}
      errorMessage={null}
      onClose={() => {}}
      onSubmit={documentUploadSubmit}
    />
  ),
  play: async ({ canvasElement }) => {
    documentUploadSubmit.mockClear();
    const canvas = within(canvasElement);

    const fileInput = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['passport copy'], 'passport.pdf', { type: 'application/pdf' });

    if (!fileInput) {
      throw new Error('Expected file input to be rendered');
    }

    await userEvent.upload(fileInput, file);
    await expect(await canvas.findByText(/passport\.pdf/i)).toBeInTheDocument();
    await userEvent.type(
      canvas.getByPlaceholderText('Add context about this file, if needed.'),
      'Adding context for this upload.'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Upload Document' }));

    await expect(documentUploadSubmit).toHaveBeenCalledWith(
      expect.any(File),
      'Adding context for this upload.'
    );
  },
};

export const Milestones: Story = {
  render: () => <MilestonesPanel milestones={mockDashboardMilestones} />,
};

export const Reminders: Story = {
  render: () => (
    <RemindersPanel
      recentReminders={mockDashboardReminders}
      allReminders={mockDashboardReminders}
      onMarkRead={reminderMarkRead}
    />
  ),
  play: async ({ canvasElement }) => {
    reminderMarkRead.mockClear();
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: /updated review status/i }));
    await expect(reminderMarkRead).toHaveBeenCalledWith('dash-reminder-1');
    await expect(canvas.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument();
  },
};

export const Appointments: Story = {
  render: () => <AppointmentsPanel upcomingAppointments={mockDashboardAppointments} />,
};

export const BillingSummary: Story = {
  render: () => <BillingSummaryPanel billingInfo={mockBillingInfo} />,
};
