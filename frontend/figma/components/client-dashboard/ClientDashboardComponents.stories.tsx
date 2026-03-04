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
    await userEvent.click(canvas.getByRole('button', { name: 'Upload Document' }));

    await expect(documentUploadSubmit).toHaveBeenCalledWith(expect.any(File), null);
  },
};

export const Milestones: Story = {
  render: () => <MilestonesPanel milestones={mockDashboardMilestones} />,
};

export const Messages: Story = {
  render: () => <MessagesPanel recentMessages={mockDashboardMessages} canSendMessages />,
};

export const Appointments: Story = {
  render: () => <AppointmentsPanel upcomingAppointments={mockDashboardAppointments} />,
};

export const BillingSummary: Story = {
  render: () => <BillingSummaryPanel billingInfo={mockBillingInfo} />,
};
