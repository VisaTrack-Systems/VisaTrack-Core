import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, userEvent, within } from 'storybook/test';

import { SidebarNav } from './SidebarNav';
import { CaseDetailsSection } from './sections/CaseDetailsSection';
import { DocumentsSection } from './sections/DocumentsSection';
import { RemindersSection } from './sections/RemindersSection';
import { MilestonesSection } from './sections/MilestonesSection';
import { OverviewSection } from './sections/OverviewSection';
import { PaymentsSection } from './sections/PaymentsSection';
import { PermissionsSection } from './sections/PermissionsSection';
import { TimelineSection } from './sections/TimelineSection';
import {
  mockCaseWorkspace,
  mockPortalPermissions,
} from '../../storybook/fixtures';

const StoryHost = () => null;

const meta = {
  title: 'Components/Case Configuration/Sections',
  component: StoryHost,
  tags: ['autodocs'],
} satisfies Meta<typeof StoryHost>;

export default meta;

type Story = StoryObj<typeof meta>;
const createReminder = fn(async () => true);
const notifyReminder = fn();
const updateDocumentStatus = fn(async () => {});

export const Sidebar: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <SidebarNav
      activeSection="overview"
      caseId="C-2026-001"
      onBack={() => {}}
      onSectionChange={() => {}}
      workspace={mockCaseWorkspace}
    />
  ),
};

export const Overview: Story = {
  render: () => (
    <OverviewSection
      workspace={mockCaseWorkspace}
      isLoadingCase={false}
      error={null}
      nextMilestone={mockCaseWorkspace.milestones[1]}
      missingDocuments={2}
      pendingPaymentsAmount={800}
      milestoneStats={{ completed: 1, inProgress: 1, notStarted: 1 }}
      onOpenDocuments={() => {}}
      onOpenMilestones={() => {}}
      onOpenPayments={() => {}}
      onOpenReminders={() => {}}
    />
  ),
};

export const CaseDetails: Story = {
  render: () => (
    <CaseDetailsSection
      workspace={mockCaseWorkspace}
      saving={false}
      onSave={async () => true}
      onNotify={() => {}}
    />
  ),
};

export const Documents: Story = {
  render: () => (
    <DocumentsSection
      workspace={mockCaseWorkspace}
      documentStats={{ accepted: 1, received: 1, requested: 1, notRequested: 1, rejected: 1 }}
      expandedSuites={mockCaseWorkspace.document_suites.map((suite) => suite.id)}
      onToggleSuite={() => {}}
      onAddCustomDocument={async () => true}
      addingDocument={false}
      onCreateSuite={async () => true}
      creatingSuite={false}
      onApplySuite={() => {}}
      onSendReminders={async () => {}}
      sendingBulkReminders={false}
      onDownloadAll={() => {}}
      onRenameDocument={async () => true}
      renamingDocumentId={null}
      onDownloadDocument={async () => {}}
      downloadingDocumentId={null}
      onViewDocument={async () => {}}
      viewingDocumentId={null}
      onUpdateDocumentStatus={updateDocumentStatus}
      updatingDocumentId={null}
      onDeleteDocument={async () => true}
      deletingDocumentId={null}
    />
  ),
  play: async ({ canvasElement }) => {
    updateDocumentStatus.mockClear();
    const canvas = within(canvasElement);
    const referenceRow = canvas.getByText('Employer Reference Letter').closest('tr');

    if (!referenceRow) {
      throw new Error('Expected employer reference document row');
    }

    const statusSelect = referenceRow.querySelector('select');
    if (!statusSelect) {
      throw new Error('Expected status select to be rendered');
    }

    await userEvent.selectOptions(statusSelect, 'rejected');
    await expect(canvas.getByRole('heading', { name: 'Reject Document' })).toBeInTheDocument();
    await userEvent.clear(canvas.getByLabelText('Rejection note'));
    await userEvent.type(
      canvas.getByLabelText('Rejection note'),
      'Please upload the complete signed letter with salary details.'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Reject Document' }));

    await expect(updateDocumentStatus).toHaveBeenCalledWith(
      'doc-reference',
      'rejected',
      'Please upload the complete signed letter with salary details.'
    );
  },
};

export const Milestones: Story = {
  render: () => (
    <MilestonesSection
      workspace={mockCaseWorkspace}
      creatingMilestone={false}
      updatingMilestoneId={null}
      deletingMilestoneId={null}
      onAddMilestone={async () => true}
      onUpdateMilestone={async () => true}
      onDeleteMilestone={async () => {}}
    />
  ),
};

export const Timeline: Story = {
  render: () => <TimelineSection workspace={mockCaseWorkspace} missingDocuments={2} pendingPaymentsAmount={800} />,
};

export const Payments: Story = {
  render: () => <PaymentsSection workspace={mockCaseWorkspace} />,
};

export const Reminders: Story = {
  render: () => (
    <RemindersSection
      workspace={mockCaseWorkspace}
      caseNumber="C-2026-001"
      creating={false}
      onCreateReminder={createReminder}
      onNotify={notifyReminder}
    />
  ),
  play: async ({ canvasElement }) => {
    createReminder.mockClear();
    notifyReminder.mockClear();
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Unread')).toBeInTheDocument();
    await expect(canvas.getByText('Acknowledged')).toBeInTheDocument();

    await userEvent.type(
      canvas.getByPlaceholderText('e.g., Document Submission Reminder'),
      'Portal Follow-up'
    );
    await userEvent.type(
      canvas.getByPlaceholderText('Write the reminder for the client...'),
      'Please upload the revised employer letter.'
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Post Reminder' }));

    await expect(createReminder).toHaveBeenCalledWith({
      title: 'Portal Follow-up',
      body: 'Please upload the revised employer letter.',
      sendEmail: false,
    });
  },
};

export const Permissions: Story = {
  render: () => (
    <PermissionsSection
      workspace={mockCaseWorkspace}
      portalPermissions={mockPortalPermissions}
      defaultPortalPermissions={mockPortalPermissions}
      saving={false}
      onReset={() => {}}
      onSave={async () => true}
    />
  ),
};
