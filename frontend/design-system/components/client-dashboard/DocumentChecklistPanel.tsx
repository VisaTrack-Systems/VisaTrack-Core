/** DocumentChecklistPanel: Client's document checklist with status, rejection notes, and view/upload/delete actions. */

import { AlertCircle, CheckCircle, Clock, Download, FileText, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CaseConfigDialog } from '../case-configuration/dialogs/CaseConfigDialog';
import type { DashboardDocument, DashboardDocumentStatus } from './types';
import { DocumentUploadDialog } from './DocumentUploadDialog';
import { Badge, Button, Card } from '../ui';

type DocumentChecklistPanelProps = {
  documents: DashboardDocument[];
  completedRequiredDocuments: number;
  requiredDocuments: number;
  canUploadDocuments: boolean;
  onUploadDocument: (documentId: string, file: File, note: string | null) => Promise<void>;
  onDeleteUploadedDocument: (documentId: string) => Promise<void>;
  onDownloadDocument: (documentId: string) => Promise<void>;
  uploadingDocumentId: string | null;
  deletingDocumentId: string | null;
  downloadingDocumentId: string | null;
};

function documentStatusMeta(status: DashboardDocumentStatus) {
  switch (status) {
    case 'completed':
      return { color: 'text-green-600 bg-green-50', icon: CheckCircle, text: 'Uploaded' };
    case 'pending':
      return { color: 'text-amber-700 bg-amber-50', icon: AlertCircle, text: 'Required' };
    case 'review':
      return { color: 'text-primary-600 bg-primary-50', icon: Clock, text: 'Under Review' };
    default:
      return { color: 'text-gray-600 bg-gray-50', icon: FileText, text: 'Optional' };
  }
}

export function DocumentChecklistPanel({
  documents,
  completedRequiredDocuments,
  requiredDocuments,
  canUploadDocuments,
  onUploadDocument,
  onDeleteUploadedDocument,
  onDownloadDocument,
  uploadingDocumentId,
  deletingDocumentId,
  downloadingDocumentId,
}: DocumentChecklistPanelProps) {
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [dialogErrorMessage, setDialogErrorMessage] = useState<string | null>(null);

  const uploadTarget = useMemo(
    () => documents.find((document) => document.id === uploadTargetId) ?? null,
    [documents, uploadTargetId]
  );
  const deleteTarget = useMemo(
    () => documents.find((document) => document.id === deleteTargetId) ?? null,
    [documents, deleteTargetId]
  );

  const handleUploadSubmit = async (file: File, note: string | null): Promise<void> => {
    if (!uploadTarget) {
      return;
    }

    setDialogErrorMessage(null);
    try {
      await onUploadDocument(uploadTarget.id, file, note);
      setUploadTargetId(null);
    } catch (error) {
      setDialogErrorMessage(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }

    setDialogErrorMessage(null);
    try {
      await onDeleteUploadedDocument(deleteTarget.id);
      setDeleteTargetId(null);
    } catch (error) {
      setDialogErrorMessage(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Document Checklist</h2>
            <Badge tone={completedRequiredDocuments >= requiredDocuments ? 'success' : 'neutral'}>
              {completedRequiredDocuments} of {requiredDocuments} required
            </Badge>
          </div>
        </div>
        <ul className="divide-y divide-gray-200">
          {documents.map((document) => {
            const statusInfo = documentStatusMeta(document.status);
            const StatusIcon = statusInfo.icon;
            const isUploading = uploadingDocumentId === document.id;
            const isDeleting = deletingDocumentId === document.id;
            const isDownloading = downloadingDocumentId === document.id;
            const showViewButton = document.canDownload && document.status !== 'pending';

            return (
              <li key={document.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${statusInfo.color}`}
                      title={`Lawyer status: ${document.lawyerStatus}`}
                      aria-label={`Lawyer status: ${document.lawyerStatus}`}
                    >
                      <StatusIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-gray-900">{document.name}</p>
                        <Badge>{document.lawyerStatus}</Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {document.uploadedDate !== 'Not set' ? `Uploaded ${document.uploadedDate}` : statusInfo.text}
                      </p>
                      {document.fileName ? (
                        <p className="mt-1 text-xs text-gray-500">File: {document.fileName}</p>
                      ) : null}
                      {document.instructions ? (
                        <p className="mt-2 text-xs text-gray-500">{document.instructions}</p>
                      ) : null}
                      {document.rejectionNote ? (
                        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                            Rejection Note
                          </p>
                          <p className="mt-1 text-sm text-red-700">{document.rejectionNote}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {showViewButton ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void onDownloadDocument(document.id)}
                        disabled={isDownloading}
                      >
                        <Download className="w-4 h-4" />
                        {isDownloading ? 'Opening...' : 'View'}
                      </Button>
                    ) : document.status === 'review' ? (
                      <span className="text-sm text-primary-700 font-medium">Reviewing...</span>
                    ) : null}

                    <Button
                      type="button"
                      size="sm"
                      variant={canUploadDocuments && document.status === 'pending' ? 'primary' : 'secondary'}
                      disabled={!canUploadDocuments || isUploading}
                      onClick={() => {
                        setDialogErrorMessage(null);
                        setUploadTargetId(document.id);
                      }}
                    >
                      <Upload className="w-4 h-4" />
                      {!canUploadDocuments ? 'Uploads Disabled' : isUploading ? 'Uploading...' : 'Upload'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={!canUploadDocuments || !document.canDownload || isDeleting}
                      onClick={() => {
                        if (!document.canDownload || isDeleting) {
                          return;
                        }
                        setDialogErrorMessage(null);
                        setDeleteTargetId(document.id);
                      }}
                      title={
                        document.canDownload
                          ? 'Delete your uploaded file and note'
                          : 'No uploaded file to delete'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      <DocumentUploadDialog
        key={uploadTarget?.id ?? 'closed'}
        isOpen={uploadTarget !== null}
        document={uploadTarget}
        submitting={uploadTargetId !== null && uploadingDocumentId === uploadTargetId}
        errorMessage={dialogErrorMessage}
        onClose={() => {
          setUploadTargetId(null);
          setDialogErrorMessage(null);
        }}
        onSubmit={handleUploadSubmit}
      />
      {deleteTarget ? (
        <CaseConfigDialog
          title="Delete Document"
          description="This action removes the uploaded file for this document from your case and deletes the note if you sent one with it."
          onClose={() => setDeleteTargetId(null)}
        >
          <div className="px-5 py-4">
            <p className="text-sm text-gray-700">
              Delete <span className="font-semibold text-gray-900">{deleteTarget.name}</span>?
            </p>
          </div>
          <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-md flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleteTargetId(null)}
              disabled={deletingDocumentId === deleteTarget.id}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                void handleDeleteConfirm();
              }}
              disabled={deletingDocumentId === deleteTarget.id}
            >
              {deletingDocumentId === deleteTarget.id ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </CaseConfigDialog>
      ) : null}
    </>
  );
}
