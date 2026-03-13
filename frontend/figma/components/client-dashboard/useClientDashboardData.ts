import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type CasePortalPermissions,
  type CaseWorkspace,
  type ClientCaseListItem,
  completeCaseDocumentUpload,
  deleteClientUploadedDocument,
  getCaseWorkspaceByNumber,
  getCaseDocumentDownloadUrl,
  getClientCases,
  initiateCaseDocumentUpload,
} from '@/lib/api';

import {
  type BillingInfo,
  type CaseInfo,
  type DashboardAppointment,
  type DashboardDocument,
  type DashboardMessage,
  type DashboardMilestone,
  type ClientPortalCapabilities,
} from './types';
import { documentDisplayStatus, formatDate, relativeTime, titleize } from './utils';
import { triggerFileDownload } from '../../../lib/download';

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
  allMessages: DashboardMessage[];
  recentMessages: DashboardMessage[];
  upcomingAppointments: DashboardAppointment[];
  billingInfo: BillingInfo;
  requiredDocuments: number;
  completedRequiredDocuments: number;
  capabilities: ClientPortalCapabilities;
  uploadDocument: (documentId: string, file: File, note: string | null) => Promise<void>;
  deleteUploadedDocument: (documentId: string) => Promise<void>;
  downloadDocument: (documentId: string) => Promise<void>;
  uploadingDocumentId: string | null;
  deletingDocumentId: string | null;
  downloadingDocumentId: string | null;
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
  messaging: 'two_way',
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
    const canViewMessages = baseReadable && permissions.messaging !== 'disabled';
    const canViewBilling = portalAccess === 'full_access' || portalAccess === 'read_only';
    const canUploadDocuments =
      canViewDocuments &&
      portalAccess !== 'read_only' &&
      permissions.document_upload === 'enabled';
    const canSendMessages =
      canViewMessages && portalAccess !== 'read_only' && permissions.messaging === 'two_way';

    return {
      portalAccess,
      canViewCaseStatus,
      canViewMilestones,
      canViewDocuments,
      canViewMessages,
      canViewBilling,
      canUploadDocuments,
      canSendMessages,
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
      progress: workspace.case.progress_percent,
    };
  }, [workspace, capabilities.canViewCaseStatus]);

  const documents = useMemo<DashboardDocument[]>(() => {
    if (!workspace || !capabilities.canViewDocuments) {
      return [];
    }

    return workspace.documents.map((document) => ({
      id: document.id,
      name: document.name,
      status: documentDisplayStatus(document.status, document.required),
      lawyerStatus: titleize(document.status),
      uploadedDate: formatDate(document.uploaded_at),
      required: document.required,
      instructions: document.instructions,
      fileName: document.file_name,
      canDownload: document.can_download,
    }));
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

      const uploadHeaders = new Headers(uploadSession.upload_headers);
      if (!uploadHeaders.has('Content-Type')) {
        uploadHeaders.set('Content-Type', file.type || 'application/octet-stream');
      }

      const uploadResponse = await fetch(uploadSession.upload_url, {
        method: 'PUT',
        headers: uploadHeaders,
        body: file,
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

  const allMessages = useMemo<DashboardMessage[]>(() => {
    if (!workspace || !capabilities.canViewMessages) {
      return [];
    }

    return workspace.messages.map((message) => ({
      from: message.sender_name,
      subject: message.subject,
      preview: message.body.slice(0, 96),
      body: message.body,
      time: relativeTime(message.sent_at),
      unread: !message.read_at,
    }));
  }, [workspace, capabilities.canViewMessages]);

  const recentMessages = useMemo<DashboardMessage[]>(
    () => allMessages.slice(0, 4),
    [allMessages]
  );

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
    allMessages,
    recentMessages,
    upcomingAppointments,
    billingInfo,
    requiredDocuments,
    completedRequiredDocuments,
    capabilities,
    uploadDocument,
    deleteUploadedDocument,
    downloadDocument,
    uploadingDocumentId,
    deletingDocumentId,
    downloadingDocumentId,
  };
}
