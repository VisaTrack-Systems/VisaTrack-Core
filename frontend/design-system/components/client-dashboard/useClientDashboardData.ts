/** useClientDashboardData: React hook for handling clientdashboarddata logic and state management. */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type CasePortalPermissions,
  type CaseWorkspace,
  type ClientCaseListItem,
  acknowledgeCaseReminder,
  completeCaseDocumentUpload,
  deleteClientUploadedDocument,
  getCaseWorkspaceByNumber,
  getCaseDocumentDownloadUrl,
  getClientCases,
  initiateCaseDocumentUpload,
  markCaseReminderRead,
} from '@/lib/api';

import {
  type BillingInfo,
  type CaseInfo,
  type DashboardAppointment,
  type DashboardDocument,
  type DashboardReminder,
  type DashboardMilestone,
  type ClientPortalCapabilities,
} from './types';
import { documentDisplayStatus, formatDate, relativeTime, titleize } from './utils';
import { triggerFileDownload } from '../../../lib/download';

const AUTO_REFRESH_INTERVAL_MS = 15000;

type ClientDashboardData = {
  clientCases: ClientCaseListItem[];
  selectedCaseNumber: string | null;
  setSelectedCaseNumber: (caseNumber: string) => void;
  workspace: CaseWorkspace | null;
  loading: boolean;
  switchingCase: boolean;
  error: string | null;
  caseInfo: CaseInfo | null;
  documents: DashboardDocument[];
  milestones: DashboardMilestone[];
  allReminders: DashboardReminder[];
  recentReminders: DashboardReminder[];
  upcomingAppointments: DashboardAppointment[];
  billingInfo: BillingInfo;
  requiredDocuments: number;
  completedRequiredDocuments: number;
  capabilities: ClientPortalCapabilities;
  uploadDocument: (documentId: string, file: File, note: string | null) => Promise<void>;
  deleteUploadedDocument: (documentId: string) => Promise<void>;
  downloadDocument: (documentId: string) => Promise<void>;
  markReminderRead: (reminderId: string) => Promise<void>;
  acknowledgeReminder: (reminderId: string) => Promise<void>;
  uploadingDocumentId: string | null;
  deletingDocumentId: string | null;
  downloadingDocumentId: string | null;
  updatingReminderId: string | null;
};

const fallbackBillingInfo: BillingInfo = {
  totalFees: 0,
  paid: 0,
  remaining: 0,
  nextPayment: 'Not set',
  paymentMethod: 'Not set',
};

const defaultPortalPermissions: CasePortalPermissions = {
  show_case_status_progress: true,
  show_milestone_details: true,
  show_document_requirements: true,
  portal_access: 'full_access',
  document_upload: 'enabled',
  reminders: 'enabled',
};

function normalizePortalPermissions(
  value: CasePortalPermissions | undefined
): CasePortalPermissions {
  if (!value) {
    return defaultPortalPermissions;
  }
  return {
    ...defaultPortalPermissions,
    ...value,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function shouldRetryUploadComplete(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('uploaded file not found') ||
    message.includes('failed to validate uploaded file') ||
    message.includes('request failed: 500') ||
    message.includes('request failed: 502') ||
    message.includes('request failed: 503') ||
    message.includes('networkerror') ||
    message.includes('failed to fetch')
  );
}

export function useClientDashboardData(): ClientDashboardData {
  const hasLoadedInitialWorkspaceRef = useRef(false);
  const [clientCases, setClientCases] = useState<ClientCaseListItem[]>([]);
  const [selectedCaseNumber, setSelectedCaseNumberState] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<CaseWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingCase, setSwitchingCase] = useState(false);
  const [uploadingDocumentId, setUploadingDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [downloadingDocumentId, setDownloadingDocumentId] = useState<string | null>(null);
  const [updatingReminderId, setUpdatingReminderId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const cases = await getClientCases();
        if (ignore) {
          return;
        }

        setClientCases(cases);

        if (cases.length === 0) {
          setWorkspace(null);
          setLoading(false);
          return;
        }

        setSelectedCaseNumberState(cases[0].case_number);
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown error');
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSelectedCaseWorkspace() {
      if (!selectedCaseNumber) {
        setWorkspace(null);
        return;
      }

      if (hasLoadedInitialWorkspaceRef.current) {
        setSwitchingCase(true);
      }
      setError(null);

      try {
        const data = await getCaseWorkspaceByNumber(selectedCaseNumber);
        if (!ignore) {
          setWorkspace(data);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : 'Unknown error');
        }
      } finally {
        if (!ignore) {
          setSwitchingCase(false);
          setLoading(false);
          hasLoadedInitialWorkspaceRef.current = true;
        }
      }
    }

    void loadSelectedCaseWorkspace();

    return () => {
      ignore = true;
    };
  }, [selectedCaseNumber]);

  useEffect(() => {
    if (!selectedCaseNumber) {
      return;
    }

    let ignore = false;
    const refreshIfVisible = async (): Promise<void> => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      try {
        const data = await getCaseWorkspaceByNumber(selectedCaseNumber);
        if (!ignore) {
          setWorkspace(data);
          setError(null);
        }
      } catch {
        // Keep stale dashboard state in place for background refresh failures.
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshIfVisible();
    }, AUTO_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      void refreshIfVisible();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshIfVisible();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedCaseNumber]);

  const setSelectedCaseNumber = (caseNumber: string) => {
    setSelectedCaseNumberState(caseNumber);
  };

  const refreshSelectedCaseWorkspace = async (): Promise<void> => {
    if (!selectedCaseNumber) {
      return;
    }

    const data = await getCaseWorkspaceByNumber(selectedCaseNumber);
    setWorkspace(data);
  };

  const capabilities = useMemo<ClientPortalCapabilities>(() => {
    const permissions = normalizePortalPermissions(workspace?.portal_permissions);
    const portalAccess = permissions.portal_access;
    const baseReadable = portalAccess !== 'disabled';
    const canViewCaseStatus =
      baseReadable &&
      portalAccess !== 'limited_access' &&
      permissions.show_case_status_progress;
    const canViewMilestones =
      portalAccess === 'full_access' && permissions.show_milestone_details;
    const canViewDocuments = baseReadable && permissions.show_document_requirements;
    const canViewReminders = baseReadable && permissions.reminders === 'enabled';
    const canViewBilling = portalAccess === 'full_access' || portalAccess === 'read_only';
    const canUploadDocuments =
      canViewDocuments &&
      portalAccess !== 'read_only' &&
      permissions.document_upload === 'enabled';
    const canAcknowledgeReminders =
      canViewReminders && portalAccess !== 'read_only';

    return {
      portalAccess,
      canViewCaseStatus,
      canViewMilestones,
      canViewDocuments,
      canViewReminders,
      canViewBilling,
      canUploadDocuments,
      canAcknowledgeReminders,
    };
  }, [workspace]);

  const caseInfo = useMemo<CaseInfo | null>(() => {
    if (!workspace || !capabilities.canViewCaseStatus) {
      return null;
    }

    const estimatedCompletion =
      workspace.case.estimated_completion_from && workspace.case.estimated_completion_to
        ? `${formatDate(workspace.case.estimated_completion_from)} - ${formatDate(workspace.case.estimated_completion_to)}`
        : 'Not set';

    return {
      id: workspace.case.case_number,
      type: workspace.case.case_type,
      status: titleize(workspace.case.status),
      assignedLawyer: workspace.case.primary_lawyer_name ?? 'Unassigned',
      startDate: formatDate(workspace.case.start_date),
      estimatedCompletion,
      description: workspace.case.description ?? null,
    };
  }, [workspace, capabilities.canViewCaseStatus]);

  const documents = useMemo<DashboardDocument[]>(() => {
    if (!workspace || !capabilities.canViewDocuments) {
      return [];
    }

    return workspace.documents.map((document) => {
      const isRejected = document.status === 'rejected';

      return {
        id: document.id,
        name: document.name,
        status: documentDisplayStatus(document.status, document.required),
        lawyerStatus: titleize(document.status),
        rejectionNote: document.rejection_note ?? null,
        uploadedDate: isRejected ? 'Not set' : formatDate(document.uploaded_at),
        required: document.required,
        instructions: document.instructions,
        fileName: isRejected ? null : document.file_name,
        canDownload: isRejected ? false : document.can_download,
      };
    });
  }, [workspace, capabilities.canViewDocuments]);

  const uploadDocument = async (
    documentId: string,
    file: File,
    note: string | null
  ): Promise<void> => {
    if (!selectedCaseNumber) {
      throw new Error('No active case selected');
    }

    setUploadingDocumentId(documentId);
    try {
      const uploadSession = await initiateCaseDocumentUpload(selectedCaseNumber, documentId, {
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
      });

      const uploadForm = new FormData();
      Object.entries(uploadSession.upload_fields).forEach(([key, value]) => {
        uploadForm.append(key, value);
      });
      uploadForm.append('file', file);

      const uploadResponse = await fetch(uploadSession.upload_url, {
        method: uploadSession.upload_method,
        body: uploadForm,
      });

      if (!uploadResponse.ok) {
        const responseBody = await uploadResponse.text().catch(() => '');
        const detail = responseBody ? ` - ${responseBody.slice(0, 300)}` : '';
        throw new Error(`Storage upload failed: ${uploadResponse.status}${detail}`);
      }

      const completionPayload = {
        storage_key: uploadSession.storage_key,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size_bytes: file.size,
        client_note: note,
      };

      const retryDelaysMs = [0, 400, 900];
      let completionError: unknown = null;
      for (const delayMs of retryDelaysMs) {
        if (delayMs > 0) {
          await sleep(delayMs);
        }

        try {
          await completeCaseDocumentUpload(selectedCaseNumber, documentId, completionPayload);
          completionError = null;
          break;
        } catch (error) {
          completionError = error;
          if (!shouldRetryUploadComplete(error)) {
            break;
          }
        }
      }

      if (completionError) {
        throw completionError;
      }

      await refreshSelectedCaseWorkspace();
    } finally {
      setUploadingDocumentId(null);
    }
  };

  const downloadDocument = async (documentId: string): Promise<void> => {
    if (!selectedCaseNumber) {
      throw new Error('No active case selected');
    }

    setDownloadingDocumentId(documentId);
    try {
      const response = await getCaseDocumentDownloadUrl(selectedCaseNumber, documentId);
      await triggerFileDownload(response.download_url, response.file_name);
    } finally {
      setDownloadingDocumentId(null);
    }
  };

  const deleteUploadedDocument = async (documentId: string): Promise<void> => {
    if (!selectedCaseNumber) {
      throw new Error('No active case selected');
    }

    setDeletingDocumentId(documentId);
    try {
      await deleteClientUploadedDocument(selectedCaseNumber, documentId);
      await refreshSelectedCaseWorkspace();
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const milestones = useMemo<DashboardMilestone[]>(() => {
    if (!workspace || !capabilities.canViewMilestones) {
      return [];
    }

    return workspace.milestones
      .filter((milestone) => milestone.client_visible)
      .map((milestone) => {
        const status =
          milestone.status === 'completed'
            ? 'completed'
            : ['in_progress', 'blocked'].includes(milestone.status)
              ? 'in-progress'
              : 'upcoming';

        return {
          title: milestone.name,
          status,
          date: formatDate(milestone.due_date),
          description: milestone.description ?? 'No description provided.',
        };
      });
  }, [workspace, capabilities.canViewMilestones]);

  const allReminders = useMemo<DashboardReminder[]>(() => {
    if (!workspace || !capabilities.canViewReminders) {
      return [];
    }

    return workspace.reminders.map((reminder) => ({
      id: reminder.id,
      from: reminder.sender_name,
      title: reminder.title,
      preview: reminder.body.slice(0, 96),
      body: reminder.body,
      time: relativeTime(reminder.sent_at),
      unread: !reminder.read_at,
      acknowledged: Boolean(reminder.acknowledged_at),
    }));
  }, [workspace, capabilities.canViewReminders]);

  const recentReminders = useMemo<DashboardReminder[]>(
    () => allReminders.slice(0, 4),
    [allReminders]
  );

  const markReminderReadAction = async (reminderId: string): Promise<void> => {
    if (!selectedCaseNumber) {
      throw new Error('No active case selected');
    }
    setWorkspace((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        reminders: current.reminders.map((reminder) =>
          reminder.id === reminderId && !reminder.read_at
            ? { ...reminder, read_at: new Date().toISOString() }
            : reminder
        ),
      };
    });
    setUpdatingReminderId(reminderId);
    try {
      await markCaseReminderRead(selectedCaseNumber, reminderId);
      await refreshSelectedCaseWorkspace();
    } catch (markError) {
      // Non-blocking sync failure: keep dashboard usable even if read receipt call fails.
      console.warn('Failed to sync reminder read state:', markError);
    } finally {
      setUpdatingReminderId(null);
    }
  };

  const acknowledgeReminderAction = async (reminderId: string): Promise<void> => {
    if (!selectedCaseNumber) {
      throw new Error('No active case selected');
    }
    const nowIso = new Date().toISOString();
    setWorkspace((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        reminders: current.reminders.map((reminder) =>
          reminder.id === reminderId
            ? {
                ...reminder,
                read_at: reminder.read_at ?? nowIso,
                acknowledged_at: reminder.acknowledged_at ?? nowIso,
              }
            : reminder
        ),
      };
    });
    setUpdatingReminderId(reminderId);
    try {
      await acknowledgeCaseReminder(selectedCaseNumber, reminderId);
      await refreshSelectedCaseWorkspace();
    } catch (ackError) {
      // Non-blocking sync failure: keep dashboard usable even if acknowledgement call fails.
      console.warn('Failed to sync reminder acknowledgement:', ackError);
    } finally {
      setUpdatingReminderId(null);
    }
  };

  const upcomingAppointments = useMemo<DashboardAppointment[]>(() => {
    if (!workspace || !capabilities.canViewMilestones) {
      return [];
    }

    return workspace.appointments.map((appointment) => ({
      title: appointment.title,
      date: formatDate(appointment.date),
      time: appointment.time,
      type: appointment.appointment_type,
    }));
  }, [workspace, capabilities.canViewMilestones]);

  const billingInfo = useMemo<BillingInfo>(() => {
    if (!workspace || !capabilities.canViewBilling) {
      return fallbackBillingInfo;
    }

    return {
      totalFees: workspace.billing_summary.total_fees,
      paid: workspace.billing_summary.paid,
      remaining: workspace.billing_summary.remaining,
      nextPayment: workspace.billing_summary.next_payment
        ? `Due ${formatDate(workspace.billing_summary.next_payment)}`
        : 'No pending payment',
      paymentMethod: workspace.billing_summary.payment_method ?? 'Not set',
    };
  }, [workspace, capabilities.canViewBilling]);

  const requiredDocuments = useMemo(
    () => documents.filter((document) => document.required).length,
    [documents]
  );
  const completedRequiredDocuments = useMemo(
    () => documents.filter((document) => document.required && document.status === 'completed').length,
    [documents]
  );

  return {
    clientCases,
    selectedCaseNumber,
    setSelectedCaseNumber,
    workspace,
    loading,
    switchingCase,
    error,
    caseInfo,
    documents,
    milestones,
    allReminders,
    recentReminders,
    upcomingAppointments,
    billingInfo,
    requiredDocuments,
    completedRequiredDocuments,
    capabilities,
    uploadDocument,
    deleteUploadedDocument,
    downloadDocument,
    markReminderRead: markReminderReadAction,
    acknowledgeReminder: acknowledgeReminderAction,
    uploadingDocumentId,
    deletingDocumentId,
    downloadingDocumentId,
    updatingReminderId,
  };
}
