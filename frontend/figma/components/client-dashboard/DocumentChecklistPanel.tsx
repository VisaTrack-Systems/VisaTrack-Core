import { AlertCircle, CheckCircle, Clock, Download, FileText, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CaseConfigDialog } from '../case-configuration/dialogs/CaseConfigDialog';
import type { DashboardDocument, DashboardDocumentStatus } from './types';
import { DocumentUploadDialog } from './DocumentUploadDialog';

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
      return { color: 'text-red-600 bg-red-50', icon: AlertCircle, text: 'Requested' };
    case 'review':
      return { color: 'text-yellow-600 bg-yellow-50', icon: Clock, text: 'Received / Under Review' };
    case 'rejected':
      return { color: 'text-red-700 bg-red-100', icon: AlertCircle, text: 'Rejected' };
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
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Document Checklist</h2>
            <span className="text-sm text-gray-600">
              {completedRequiredDocuments} of {requiredDocuments} required
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {documents.map((document) => {
            const statusInfo = documentStatusMeta(document.status);
            const StatusIcon = statusInfo.icon;
            const isUploading = uploadingDocumentId === document.id;
            const isDeleting = deletingDocumentId === document.id;
            const isDownloading = downloadingDocumentId === document.id;
            const showViewButton = document.canDownload && document.status !== 'pending';

            return (
              <div key={document.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${statusInfo.color}`}
                      title={`Lawyer status: ${document.lawyerStatus}`}
                      aria-label={`Lawyer status: ${document.lawyerStatus}`}
                    >
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{document.name}</p>
                        {document.required ? <span className="text-xs text-red-600 font-medium">*Required</span> : null}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                          {document.lawyerStatus}
                        </span>
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
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">
                            Rejection note
                          </p>
                          <p className="mt-1 text-xs text-red-700 whitespace-pre-wrap">
                            {document.rejectionNote}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {showViewButton ? (
                      <button
                        className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-60"
                        onClick={() => void onDownloadDocument(document.id)}
                        disabled={isDownloading}
                      >
                        <Download className="w-4 h-4" />
                        {isDownloading ? 'Opening...' : 'View'}
                      </button>
                    ) : document.status === 'review' ? (
                      <span className="text-sm text-yellow-600 font-medium">Reviewing...</span>
                    ) : null}

                    <button
                      className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                        canUploadDocuments
                          ? ['pending', 'rejected'].includes(document.status)
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                      disabled={!canUploadDocuments || isUploading}
                      onClick={() => {
                        setDialogErrorMessage(null);
                        setUploadTargetId(document.id);
                      }}
                    >
                      <Upload className="w-4 h-4" />
                      {!canUploadDocuments ? 'Uploads Disabled' : isUploading ? 'Uploading...' : 'Upload'}
                    </button>
                    <button
                      className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
          <div className="px-6 py-5">
            <p className="text-sm text-gray-700">
              Delete <span className="font-semibold text-gray-900">{deleteTarget.name}</span>?
            </p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              disabled={deletingDocumentId === deleteTarget.id}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleDeleteConfirm();
              }}
              disabled={deletingDocumentId === deleteTarget.id}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deletingDocumentId === deleteTarget.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </CaseConfigDialog>
      ) : null}
    </>
  );
}
