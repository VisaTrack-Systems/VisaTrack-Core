import { AlertCircle, CheckCircle, Clock, Download, FileText, Upload } from 'lucide-react';

import type { DashboardDocument, DashboardDocumentStatus } from './types';

type DocumentChecklistPanelProps = {
  documents: DashboardDocument[];
  completedRequiredDocuments: number;
  requiredDocuments: number;
  canUploadDocuments: boolean;
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
}: DocumentChecklistPanelProps) {
  return (
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
        {documents.map((document, index) => {
          const statusInfo = documentStatusMeta(document.status);
          const StatusIcon = statusInfo.icon;

          return (
            <div key={`${document.name}-${index}`} className="p-6 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
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
                  </div>
                </div>
                {document.status === 'pending' ? (
                  <button
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      canUploadDocuments
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!canUploadDocuments}
                  >
                    <Upload className="w-4 h-4" />
                    {canUploadDocuments ? 'Upload' : 'Uploads Disabled'}
                  </button>
                ) : document.status === 'completed' ? (
                  <button className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                    <Download className="w-4 h-4" />
                    View
                  </button>
                ) : document.status === 'review' ? (
                  <span className="text-sm text-yellow-600 font-medium">Reviewing...</span>
                ) : (
                  <button
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors border ${
                      canUploadDocuments
                        ? 'border-gray-300 hover:bg-gray-50 text-gray-700'
                        : 'border-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                    disabled={!canUploadDocuments}
                  >
                    <Upload className="w-4 h-4" />
                    {canUploadDocuments ? 'Upload' : 'Uploads Disabled'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
