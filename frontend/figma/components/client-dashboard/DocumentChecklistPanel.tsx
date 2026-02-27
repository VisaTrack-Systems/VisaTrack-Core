import { AlertCircle, CheckCircle, Clock, Download, FileText, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DashboardDocument, DashboardDocumentStatus } from './types';
import { DocumentUploadDialog } from './DocumentUploadDialog';

type DocumentChecklistPanelProps = {
  documents: DashboardDocument[];
  completedRequiredDocuments: number;
  requiredDocuments: number;
  canUploadDocuments: boolean;
  onUploadDocument: (documentId: string, file: File) => Promise<void>;
  onDownloadDocument: (documentId: string) => Promise<void>;
  uploadingDocumentId: string | null;
  downloadingDocumentId: string | null;
};

function documentStatusMeta(status: DashboardDocumentStatus) {
  switch (status) {
    case 'completed':
      return { color: 'text-green-600 bg-green-50', icon: CheckCircle, text: 'Uploaded' };
    case 'pending':
      return { color: 'text-red-600 bg-red-50', icon: AlertCircle, text: 'Required' };
    case 'review':
      return { color: 'text-yellow-600 bg-yellow-50', icon: Clock, text: 'Under Review' };
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
  onDownloadDocument,
  uploadingDocumentId,
  downloadingDocumentId,
}: DocumentChecklistPanelProps) {
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [dialogErrorMessage, setDialogErrorMessage] = useState<string | null>(null);

  const uploadTarget = useMemo(
    () => documents.find((document) => document.id === uploadTargetId) ?? null,
    [documents, uploadTargetId]
  );

  const handleUploadSubmit = async (file: File): Promise<void> => {
    if (!uploadTarget) {
      return;
    }

    setDialogErrorMessage(null);
    try {
      await onUploadDocument(uploadTarget.id, file);
      setUploadTargetId(null);
    } catch (error) {
      setDialogErrorMessage(error instanceof Error ? error.message : 'Upload failed');
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
            const isDownloading = downloadingDocumentId === document.id;
            const showViewButton = document.canDownload && document.status !== 'pending';

            return (
              <div key={document.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusInfo.color}`}>
                      <StatusIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{document.name}</p>
                        {document.required ? <span className="text-xs text-red-600 font-medium">*Required</span> : null}
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
                          ? document.status === 'pending'
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
    </>
  );
}
