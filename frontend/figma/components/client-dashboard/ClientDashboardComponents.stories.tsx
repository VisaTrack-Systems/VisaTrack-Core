import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { AppointmentsPanel } from './AppointmentsPanel';
import { BillingSummaryPanel } from './BillingSummaryPanel';
import { CaseSummaryCard } from './CaseSummaryCard';
import { DocumentChecklistPanel } from './DocumentChecklistPanel';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { MessagesPanel } from './MessagesPanel';
import { MilestonesPanel } from './MilestonesPanel';
import {
  mockBillingInfo,
  mockCaseInfo,
  mockDashboardAppointments,
  mockDashboardDocuments,
  mockDashboardMessages,
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

export const CaseSummary: Story = {
  render: () => <CaseSummaryCard caseInfo={mockCaseInfo} />,
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

    await expect(await canvas.findByText('Requested')).toBeInTheDocument();
    await expect(await canvas.findByText('Received / Under Review')).toBeInTheDocument();
    await expect(await canvas.findByText('Rejected')).toBeInTheDocument();
    await expect(await canvas.findByText('Rejection note')).toBeInTheDocument();
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

export const Messages: Story = {
  render: () => <MessagesPanel recentMessages={mockDashboardMessages} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(await canvas.findByRole('heading', { name: 'Lawyer Messages' })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /send message/i })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /messaging disabled/i })).not.toBeInTheDocument();
  },
};

export const Appointments: Story = {
  render: () => <AppointmentsPanel upcomingAppointments={mockDashboardAppointments} />,
};

export const BillingSummary: Story = {
  render: () => <BillingSummaryPanel billingInfo={mockBillingInfo} />,
};
