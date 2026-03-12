import type { Meta, StoryObj } from '@storybook/react';

import { SidebarNav } from './SidebarNav';
import { CaseDetailsSection } from './sections/CaseDetailsSection';
import { DocumentsSection } from './sections/DocumentsSection';
import { MessagesSection } from './sections/MessagesSection';
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
      onOpenMessages={() => {}}
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
      documentStats={{ approved: 1, received: 1, pending: 1, rejected: 1 }}
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
      onUpdateDocumentStatus={async () => {}}
      updatingDocumentId={null}
      onSendDocumentReminder={async () => {}}
      sendingDocumentReminderId={null}
      onDeleteDocument={async () => true}
      deletingDocumentId={null}
    />
  ),
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

export const Messages: Story = {
  render: () => (
    <MessagesSection
      workspace={mockCaseWorkspace}
      caseNumber="C-2026-001"
      sending={false}
      onSendMessage={async () => true}
      onNotify={() => {}}
    />
  ),
};

export const Permissions: Story = {
  render: () => (
    <PermissionsSection
      workspace={mockCaseWorkspace}
      portalPermissions={mockPortalPermissions}
      saving={false}
      onChange={() => {}}
      onReset={() => {}}
      onSave={() => {}}
    />
  ),
};
