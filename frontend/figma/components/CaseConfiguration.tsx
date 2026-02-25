import { useEffect, useMemo, useRef, useState } from 'react';

import {
  createCaseCustomDocument,
  createCaseMilestone,
  createCaseCustomDocumentSuite,
  deleteCaseDocument,
  deleteCaseMilestone,
  type CaseDocumentStatus,
  type CasePortalPermissions,
  type CaseWorkspace,
  renameCaseDocument,
  sendCaseMessage,
  updateCaseMilestone,
  getCaseWorkspaceByNumber,
  updateCaseDetails,
  updateCaseDocumentStatus,
  updateCasePortalPermissions,
} from '@/lib/api';

import { SidebarNav } from './case-configuration/SidebarNav';
import { CaseDetailsSection } from './case-configuration/sections/CaseDetailsSection';
import { DocumentsSection } from './case-configuration/sections/DocumentsSection';
import { MessagesSection } from './case-configuration/sections/MessagesSection';
import { MilestonesSection } from './case-configuration/sections/MilestonesSection';
import { OverviewSection } from './case-configuration/sections/OverviewSection';
import { PaymentsSection } from './case-configuration/sections/PaymentsSection';
import { PermissionsSection } from './case-configuration/sections/PermissionsSection';
import { TimelineSection } from './case-configuration/sections/TimelineSection';
import type {
  CaseConfigurationProps,
  DocumentStats,
  MilestoneStats,
  NewDocumentInput,
  NewDocumentSuiteInput,
  SectionType,
} from './case-configuration/types';
import { milestoneStatus } from './case-configuration/utils';

type NoticeKind = 'success' | 'info' | 'error';

type Notice = {
  kind: NoticeKind;
  message: string;
};

type CaseDetailsUpdate = {
  case_type: string;
  priority: string;
  status: string;
  target_filing_date: string | null;
  description: string | null;
  internal_notes: string | null;
};

type NewMilestoneInput = {
  name: string;
  description: string | null;
  due_date: string | null;
  status: string;
  client_visible: boolean;
};

type MilestoneUpdate = {
  name?: string;
  description?: string | null;
  due_date?: string | null;
  status?: string;
  client_visible?: boolean;
};

type OutboundMessage = {
  subject: string;
  body: string;
  sendEmail: boolean;
};

const DEFAULT_PORTAL_PERMISSIONS: CasePortalPermissions = {
  show_case_status_progress: true,
  show_milestone_details: true,
  show_document_requirements: true,
  portal_access: 'full_access',
  document_upload: 'enabled',
  messaging: 'two_way',
};

function normalizePortalPermissions(
  value: CasePortalPermissions | undefined
): CasePortalPermissions {
  if (!value) {
    return DEFAULT_PORTAL_PERMISSIONS;
  }

  return {
    ...DEFAULT_PORTAL_PERMISSIONS,
    ...value,
  };
}

export function CaseConfiguration({ caseId, onBack }: CaseConfigurationProps) {
  const [activeSection, setActiveSection] = useState<SectionType>('overview');
  const [expandedSuites, setExpandedSuites] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<CaseWorkspace | null>(null);
  const [isLoadingCase, setIsLoadingCase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [isSavingCaseDetails, setIsSavingCaseDetails] = useState(false);
  const [isCreatingMilestone, setIsCreatingMilestone] = useState(false);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<string | null>(null);
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isCreatingDocumentSuite, setIsCreatingDocumentSuite] = useState(false);
  const [isAddingDocument, setIsAddingDocument] = useState(false);
  const [isSendingBulkReminders, setIsSendingBulkReminders] = useState(false);
  const [sendingDocumentReminderId, setSendingDocumentReminderId] = useState<string | null>(null);
  const [renamingDocumentId, setRenamingDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [updatingDocumentId, setUpdatingDocumentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNotice = (kind: NoticeKind, message: string) => {
    setNotice({ kind, message });

    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }

    noticeTimerRef.current = setTimeout(() => {
      setNotice(null);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadWorkspace() {
      setIsLoadingCase(true);
      setError(null);

      try {
        const data = await getCaseWorkspaceByNumber(caseId);
        if (!ignore) {
          setWorkspace({
            ...data,
            portal_permissions: normalizePortalPermissions(data.portal_permissions),
          });
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown error');
        }
      } finally {
        if (!ignore) {
          setIsLoadingCase(false);
        }
      }
    }

    loadWorkspace();

    return () => {
      ignore = true;
    };
  }, [caseId]);

  const updateWorkspace = (updater: (current: CaseWorkspace) => CaseWorkspace) => {
    setWorkspace((current) => (current ? updater(current) : current));
  };

  const refreshWorkspace = async (caseNumber: string): Promise<void> => {
    const refreshed = await getCaseWorkspaceByNumber(caseNumber);
    setWorkspace({
      ...refreshed,
      portal_permissions: normalizePortalPermissions(refreshed.portal_permissions),
    });
  };

  const documentStats = useMemo<DocumentStats>(() => {
    const stats = {
      approved: 0,
      received: 0,
      pending: 0,
      needsRevision: 0,
    };

    if (!workspace) {
      return stats;
    }

    for (const document of workspace.documents) {
      if (document.status === 'approved') {
        stats.approved += 1;
      } else if (document.status === 'received') {
        stats.received += 1;
      } else if (['needs_revision', 'needs-revision'].includes(document.status)) {
        stats.needsRevision += 1;
      } else {
        stats.pending += 1;
      }
    }

    return stats;
  }, [workspace]);

  const milestoneStats = useMemo<MilestoneStats>(() => {
    const stats = {
      completed: 0,
      inProgress: 0,
      notStarted: 0,
    };

    if (!workspace) {
      return stats;
    }

    for (const milestone of workspace.milestones) {
      const normalizedStatus = milestoneStatus(milestone.status);
      if (normalizedStatus === 'completed') {
        stats.completed += 1;
      } else if (normalizedStatus === 'in-progress') {
        stats.inProgress += 1;
      } else {
        stats.notStarted += 1;
      }
    }

    return stats;
  }, [workspace]);

  const nextMilestone = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return (
      workspace.milestones
        .filter((milestone) => milestone.status !== 'completed' && milestone.due_date)
        .sort((a, b) => {
          const aDate = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          const bDate = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        })[0] ?? null
    );
  }, [workspace]);

  const pendingPaymentsAmount = useMemo(() => {
    if (!workspace) {
      return 0;
    }

    return workspace.payment_items.reduce((sum, item) => sum + item.amount_due, 0);
  }, [workspace]);

  const missingDocuments = useMemo(() => {
    if (!workspace) {
      return 0;
    }

    return workspace.documents.filter((document) => document.required && !['approved', 'received'].includes(document.status)).length;
  }, [workspace]);

  const toggleSuite = (suiteId: string) => {
    setExpandedSuites((previous) =>
      previous.includes(suiteId) ? previous.filter((id) => id !== suiteId) : [...previous, suiteId]
    );
  };

  const handleSaveCaseDetails = async (updates: CaseDetailsUpdate): Promise<boolean> => {
    if (!workspace) {
      return false;
    }

    setIsSavingCaseDetails(true);
    try {
      const saved = await updateCaseDetails(workspace.case.case_number, updates);
      updateWorkspace((current) => ({
        ...current,
        case: {
          ...current.case,
          case_type: saved.case_type,
          priority: saved.priority,
          status: saved.status,
          target_filing_date: saved.target_filing_date,
          description: saved.description,
          internal_notes: saved.internal_notes,
        },
      }));
      showNotice('success', 'Case details updated.');
      return true;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unknown error';
      showNotice('error', `Failed to update case details: ${message}`);
      return false;
    } finally {
      setIsSavingCaseDetails(false);
    }
  };

  const handleAddCustomDocument = async (input: NewDocumentInput): Promise<boolean> => {
    if (!workspace || workspace.document_suites.length === 0) {
      showNotice('error', 'No document suite available to add a document.');
      return false;
    }

    setIsAddingDocument(true);
    try {
      const suiteId = input.suiteId ?? workspace.document_suites[0].id;
      await createCaseCustomDocument(workspace.case.case_number, {
        name: input.name,
        suite_id: suiteId,
        required: input.required,
        due_date: input.dueDate,
        instructions: input.instructions,
      });
      await refreshWorkspace(workspace.case.case_number);
      setExpandedSuites((previous) => (previous.includes(suiteId) ? previous : [...previous, suiteId]));
      showNotice('success', `Added document: ${input.name}`);
      return true;
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unknown error';
      showNotice('error', `Failed to add document: ${message}`);
      return false;
    } finally {
      setIsAddingDocument(false);
    }
  };

  const handleApplySuite = () => {
    if (!workspace || workspace.document_suites.length === 0) {
      showNotice('info', 'No suites available.');
      return;
    }

    setExpandedSuites(workspace.document_suites.map((suite) => suite.id));
    showNotice('success', 'All document suites expanded.');
  };

  const handleCreateDocumentSuite = async (input: NewDocumentSuiteInput): Promise<boolean> => {
    if (!workspace) {
      return false;
    }

    setIsCreatingDocumentSuite(true);
    try {
      const createdSuite = await createCaseCustomDocumentSuite(workspace.case.case_number, {
        name: input.name,
        description: input.description,
      });

      updateWorkspace((current) => {
        const hasSuite = current.document_suites.some((suite) => suite.id === createdSuite.id);
        if (hasSuite) {
          return current;
        }

        return {
          ...current,
          document_suites: [...current.document_suites, createdSuite],
        };
      });

      setExpandedSuites((previous) =>
        previous.includes(createdSuite.id) ? previous : [...previous, createdSuite.id]
      );
      showNotice('success', `Created suite: ${createdSuite.name}`);
      return true;
    } catch (createSuiteError) {
      const message = createSuiteError instanceof Error ? createSuiteError.message : 'Unknown error';
      showNotice('error', `Failed to create suite: ${message}`);
      return false;
    } finally {
      setIsCreatingDocumentSuite(false);
    }
  };

  const handleSendReminders = async (): Promise<void> => {
    if (!workspace) {
      return;
    }

    const pendingRequiredDocuments = workspace.documents.filter(
      (document) => document.required && !['approved', 'received', 'completed'].includes(document.status)
    );
    if (pendingRequiredDocuments.length === 0) {
      showNotice('info', 'No pending required documents for reminders.');
      return;
    }

    const documentList = pendingRequiredDocuments.map((document) => `- ${document.name}`).join('\n');
    setIsSendingBulkReminders(true);
    try {
      await sendCaseMessage(workspace.case.case_number, {
        subject: 'Document Submission Reminder',
        body: `Please upload the following pending required documents:\n${documentList}`,
        send_email: true,
        visible_to_client: true,
      });
      await refreshWorkspace(workspace.case.case_number);
      showNotice('success', `Reminder sent for ${pendingRequiredDocuments.length} required document${pendingRequiredDocuments.length === 1 ? '' : 's'}.`);
    } catch (reminderError) {
      const message = reminderError instanceof Error ? reminderError.message : 'Unknown error';
      showNotice('error', `Failed to send reminders: ${message}`);
    } finally {
      setIsSendingBulkReminders(false);
    }
  };

  const handleDownloadAllDocuments = () => {
    if (!workspace) {
      return;
    }

    const snapshot = workspace.documents.map((document) => ({
      name: document.name,
      status: document.status,
      required: document.required,
      due_date: document.due_date,
      uploaded_at: document.uploaded_at,
      instructions: document.instructions,
    }));

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${workspace.case.case_number}-documents.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);

    showNotice('success', 'Document snapshot downloaded.');
  };

  const handleRenameDocument = async (documentId: string, name: string): Promise<boolean> => {
    if (!workspace) {
      return false;
    }

    setRenamingDocumentId(documentId);
    try {
      await renameCaseDocument(workspace.case.case_number, documentId, { name });
      await refreshWorkspace(workspace.case.case_number);
      showNotice('success', 'Document renamed.');
      return true;
    } catch (renameError) {
      const message = renameError instanceof Error ? renameError.message : 'Unknown error';
      showNotice('error', `Failed to rename document: ${message}`);
      return false;
    } finally {
      setRenamingDocumentId(null);
    }
  };

  const handleUpdateDocumentStatus = async (documentId: string, status: CaseDocumentStatus) => {
    if (!workspace) {
      return;
    }

    setUpdatingDocumentId(documentId);
    try {
      const updated = await updateCaseDocumentStatus(
        workspace.case.case_number,
        documentId,
        status
      );

      updateWorkspace((current) => ({
        ...current,
        document_suites: current.document_suites.map((suite) => ({
          ...suite,
          documents: suite.documents.map((document) =>
            document.id === updated.document_id
              ? {
                  ...document,
                  status: updated.status,
                }
              : document
          ),
        })),
        documents: current.documents.map((document) =>
          document.id === updated.document_id
            ? {
                ...document,
                status: updated.status,
              }
            : document
        ),
      }));
      showNotice('success', 'Document status updated.');
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unknown error';
      showNotice('error', `Failed to update document status: ${message}`);
    } finally {
      setUpdatingDocumentId(null);
    }
  };

  const handleSendDocumentReminder = async (documentId: string): Promise<void> => {
    if (!workspace) {
      return;
    }

    const documentName = workspace?.documents.find((document) => document.id === documentId)?.name ?? 'document';
    setSendingDocumentReminderId(documentId);
    try {
      await sendCaseMessage(workspace.case.case_number, {
        subject: 'Document Reminder',
        body: `Please upload or update this document in your client portal: ${documentName}.`,
        send_email: true,
        visible_to_client: true,
      });
      await refreshWorkspace(workspace.case.case_number);
      showNotice('success', `Reminder sent for ${documentName}.`);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Unknown error';
      showNotice('error', `Failed to send reminder: ${message}`);
    } finally {
      setSendingDocumentReminderId(null);
    }
  };

  const handleDeleteDocument = async (documentId: string): Promise<boolean> => {
    if (!workspace) {
      return false;
    }

    setDeletingDocumentId(documentId);
    try {
      await deleteCaseDocument(workspace.case.case_number, documentId);
      await refreshWorkspace(workspace.case.case_number);
      showNotice('success', 'Document deleted.');
      return true;
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unknown error';
      showNotice('error', `Failed to delete document: ${message}`);
      return false;
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleAddMilestone = async (input: NewMilestoneInput): Promise<boolean> => {
    if (!workspace) {
      return false;
    }

    setIsCreatingMilestone(true);
    try {
      const createdMilestone = await createCaseMilestone(workspace.case.case_number, input);
      updateWorkspace((current) => ({
        ...current,
        milestones: [...current.milestones, createdMilestone],
      }));
      showNotice('success', `Milestone added: ${createdMilestone.name}`);
      return true;
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unknown error';
      showNotice('error', `Failed to add milestone: ${message}`);
      return false;
    } finally {
      setIsCreatingMilestone(false);
    }
  };

  const handleUpdateMilestone = async (
    milestoneId: string,
    updates: MilestoneUpdate
  ): Promise<boolean> => {
    if (!workspace) {
      return false;
    }

    setUpdatingMilestoneId(milestoneId);
    try {
      const updatedMilestone = await updateCaseMilestone(workspace.case.case_number, milestoneId, updates);
      updateWorkspace((current) => ({
        ...current,
        milestones: current.milestones.map((milestone) =>
          milestone.id === updatedMilestone.id ? updatedMilestone : milestone
        ),
      }));
      showNotice('success', 'Milestone updated.');
      return true;
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : 'Unknown error';
      showNotice('error', `Failed to update milestone: ${message}`);
      return false;
    } finally {
      setUpdatingMilestoneId(null);
    }
  };

  const handleDeleteMilestone = async (milestoneId: string): Promise<void> => {
    if (!workspace) {
      return;
    }

    setDeletingMilestoneId(milestoneId);
    try {
      await deleteCaseMilestone(workspace.case.case_number, milestoneId);
      updateWorkspace((current) => ({
        ...current,
        milestones: current.milestones.filter((milestone) => milestone.id !== milestoneId),
      }));
      showNotice('success', 'Milestone deleted.');
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : 'Unknown error';
      showNotice('error', `Failed to delete milestone: ${message}`);
    } finally {
      setDeletingMilestoneId(null);
    }
  };

  const handleSendMessage = async (message: OutboundMessage): Promise<boolean> => {
    if (!workspace) {
      return false;
    }

    setIsSendingMessage(true);
    try {
      const sentMessage = await sendCaseMessage(workspace.case.case_number, {
        subject: message.subject,
        body: message.body,
        send_email: message.sendEmail,
        visible_to_client: true,
      });

      updateWorkspace((current) => ({
        ...current,
        messages: [sentMessage, ...current.messages],
      }));

      showNotice('success', message.sendEmail ? 'Message sent to client portal and email queued.' : 'Message sent to client portal.');
      return true;
    } catch (sendError) {
      const messageText = sendError instanceof Error ? sendError.message : 'Unknown error';
      showNotice('error', `Failed to send message: ${messageText}`);
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handlePortalPermissionsChange = (nextPermissions: CasePortalPermissions) => {
    updateWorkspace((current) => ({
      ...current,
      portal_permissions: normalizePortalPermissions(nextPermissions),
    }));
  };

  const handleResetPortalPermissions = () => {
    updateWorkspace((current) => ({
      ...current,
      portal_permissions: DEFAULT_PORTAL_PERMISSIONS,
    }));
    showNotice('info', 'Portal permissions reset to default values.');
  };

  const handleSavePortalPermissions = async () => {
    if (!workspace) {
      return;
    }

    setIsSavingPermissions(true);
    try {
      const savedPermissions = await updateCasePortalPermissions(
        workspace.case.case_number,
        normalizePortalPermissions(workspace.portal_permissions)
      );

      updateWorkspace((current) => ({
        ...current,
        portal_permissions: normalizePortalPermissions(savedPermissions),
      }));

      showNotice('success', 'Client portal visibility updated.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unknown error';
      showNotice('error', `Failed to save permissions: ${message}`);
    } finally {
      setIsSavingPermissions(false);
    }
  };

  if (isLoadingCase && !workspace) {
    return <div className="min-h-screen bg-gray-50 p-8 text-gray-600">Loading case configuration...</div>;
  }

  if (error && !workspace) {
    return <div className="min-h-screen bg-gray-50 p-8 text-red-600">Failed to load case: {error}</div>;
  }

  const renderSection = () => {
    if (!workspace) {
      return <p className="text-gray-600">No case data available.</p>;
    }

    if (activeSection === 'overview') {
      return (
        <OverviewSection
          workspace={workspace}
          isLoadingCase={isLoadingCase}
          error={error}
          nextMilestone={nextMilestone}
          missingDocuments={missingDocuments}
          pendingPaymentsAmount={pendingPaymentsAmount}
          milestoneStats={milestoneStats}
          onOpenDocuments={() => setActiveSection('documents')}
          onOpenMilestones={() => setActiveSection('milestones')}
          onOpenPayments={() => setActiveSection('payments')}
          onOpenMessages={() => setActiveSection('messages')}
        />
      );
    }

    if (activeSection === 'details') {
      return (
        <CaseDetailsSection
          key={workspace.case.id}
          workspace={workspace}
          saving={isSavingCaseDetails}
          onSave={handleSaveCaseDetails}
          onNotify={(message) => showNotice('info', message)}
        />
      );
    }

    if (activeSection === 'documents') {
      return (
        <DocumentsSection
          workspace={workspace}
          documentStats={documentStats}
          expandedSuites={expandedSuites}
          onToggleSuite={toggleSuite}
          onAddCustomDocument={handleAddCustomDocument}
          addingDocument={isAddingDocument}
          onCreateSuite={handleCreateDocumentSuite}
          creatingSuite={isCreatingDocumentSuite}
          onApplySuite={handleApplySuite}
          onSendReminders={handleSendReminders}
          sendingBulkReminders={isSendingBulkReminders}
          onDownloadAll={handleDownloadAllDocuments}
          onRenameDocument={handleRenameDocument}
          renamingDocumentId={renamingDocumentId}
          onUpdateDocumentStatus={handleUpdateDocumentStatus}
          updatingDocumentId={updatingDocumentId}
          onSendDocumentReminder={handleSendDocumentReminder}
          sendingDocumentReminderId={sendingDocumentReminderId}
          onDeleteDocument={handleDeleteDocument}
          deletingDocumentId={deletingDocumentId}
        />
      );
    }

    if (activeSection === 'milestones') {
      return (
        <MilestonesSection
          workspace={workspace}
          creatingMilestone={isCreatingMilestone}
          updatingMilestoneId={updatingMilestoneId}
          deletingMilestoneId={deletingMilestoneId}
          onAddMilestone={handleAddMilestone}
          onUpdateMilestone={handleUpdateMilestone}
          onDeleteMilestone={handleDeleteMilestone}
        />
      );
    }

    if (activeSection === 'timeline') {
      return (
        <TimelineSection
          workspace={workspace}
          missingDocuments={missingDocuments}
          pendingPaymentsAmount={pendingPaymentsAmount}
        />
      );
    }

    if (activeSection === 'payments') {
      return <PaymentsSection workspace={workspace} />;
    }

    if (activeSection === 'messages') {
      return (
        <MessagesSection
          key={workspace.case.case_number}
          workspace={workspace}
          caseNumber={workspace.case.case_number}
          sending={isSendingMessage}
          onSendMessage={handleSendMessage}
          onNotify={(message) => showNotice('info', message)}
        />
      );
    }

    return (
      <PermissionsSection
        workspace={workspace}
        portalPermissions={normalizePortalPermissions(workspace.portal_permissions)}
        saving={isSavingPermissions}
        onChange={handlePortalPermissionsChange}
        onReset={handleResetPortalPermissions}
        onSave={handleSavePortalPermissions}
      />
    );
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <SidebarNav
        activeSection={activeSection}
        caseId={caseId}
        onBack={onBack}
        onSectionChange={setActiveSection}
        workspace={workspace}
      />

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {notice ? (
            <div
              className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                notice.kind === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : notice.kind === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              {notice.message}
            </div>
          ) : null}

          {renderSection()}
        </div>
      </div>
    </div>
  );
}
