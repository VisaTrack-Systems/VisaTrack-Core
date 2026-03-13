import { useState } from 'react';

import { ChevronDown, ChevronRight, Download, Edit2, Eye, FolderPlus, Plus, Send, StickyNote, Trash2, X } from 'lucide-react';

import type { CaseDocumentStatus, CaseWorkspace } from '@/lib/api';

import { AddDocumentDialog } from '../dialogs/AddDocumentDialog';
import { CreateSuiteDialog } from '../dialogs/CreateSuiteDialog';
import { DeleteDocumentDialog } from '../dialogs/DeleteDocumentDialog';
import { RenameDocumentDialog } from '../dialogs/RenameDocumentDialog';
import type { DocumentStats, NewDocumentInput, NewDocumentSuiteInput } from '../types';
import { formatDate, statusColor, titleize } from '../utils';

type DocumentsSectionProps = {
  workspace: CaseWorkspace;
  documentStats: DocumentStats;
  expandedSuites: string[];
  onToggleSuite: (suiteId: string) => void;
  onAddCustomDocument: (input: NewDocumentInput) => Promise<boolean>;
  addingDocument: boolean;
  onCreateSuite: (input: NewDocumentSuiteInput) => Promise<boolean>;
  creatingSuite: boolean;
  onApplySuite: () => void;
  onSendReminders: () => Promise<void>;
  sendingBulkReminders: boolean;
  onDownloadAll: () => void;
  onRenameDocument: (documentId: string, name: string) => Promise<boolean>;
  renamingDocumentId: string | null;
  onViewDocument: (documentId: string) => Promise<void>;
  viewingDocumentId: string | null;
  onDownloadDocument: (documentId: string) => Promise<void>;
  downloadingDocumentId: string | null;
  onUpdateDocumentStatus: (documentId: string, status: CaseDocumentStatus) => Promise<void>;
  updatingDocumentId: string | null;
  onSendDocumentReminder: (documentId: string) => Promise<void>;
  sendingDocumentReminderId: string | null;
  onDeleteDocument: (documentId: string) => Promise<boolean>;
  deletingDocumentId: string | null;
};

export function DocumentsSection({
  workspace,
  documentStats,
  expandedSuites,
  onToggleSuite,
  onAddCustomDocument,
  addingDocument,
  onCreateSuite,
  creatingSuite,
  onApplySuite,
  onSendReminders,
  sendingBulkReminders,
  onDownloadAll,
  onRenameDocument,
  renamingDocumentId,
  onViewDocument,
  viewingDocumentId,
  onDownloadDocument,
  downloadingDocumentId,
  onUpdateDocumentStatus,
  updatingDocumentId,
  onSendDocumentReminder,
  sendingDocumentReminderId,
  onDeleteDocument,
  deletingDocumentId,
}: DocumentsSectionProps) {
  const [isAddDocumentDialogOpen, setIsAddDocumentDialogOpen] = useState(false);
  const [isCreateSuiteDialogOpen, setIsCreateSuiteDialogOpen] = useState(false);
  const [isCreatingSuite, setIsCreatingSuite] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [noteTarget, setNoteTarget] = useState<{ name: string; note: string } | null>(null);

  const handleCreateSuite = async (input: NewDocumentSuiteInput): Promise<boolean> => {
    setIsCreatingSuite(true);
    try {
      return await onCreateSuite(input);
    } finally {
      setIsCreatingSuite(false);
    }
  };

  const handleRenameDocument = async (nextName: string): Promise<boolean> => {
    if (!renameTarget) {
      return false;
    }
    const success = await onRenameDocument(renameTarget.id, nextName);
    if (success) {
      setRenameTarget(null);
    }
    return success;
  };

  const handleDeleteDocument = async (): Promise<void> => {
    if (!deleteTarget) {
      return;
    }
    const success = await onDeleteDocument(deleteTarget.id);
    if (success) {
      setDeleteTarget(null);
    }
  };

  const documentStatusOptions: Array<{ value: CaseDocumentStatus; label: string }> = [
    { value: 'requested', label: 'Requested' },
    { value: 'received', label: 'Received' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'not_requested', label: 'Not Requested' },
  ];

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Document Requests</h2>
          <p className="text-gray-600">Configure and manage document requests for this case</p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-700">{documentStats.accepted}</div>
            <div className="text-sm text-green-600">Accepted</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-700">{documentStats.received}</div>
            <div className="text-sm text-blue-600">Received</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-700">{documentStats.requested}</div>
            <div className="text-sm text-yellow-600">Requested</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-700">{documentStats.notRequested}</div>
            <div className="text-sm text-gray-600">Not Requested</div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                onClick={() => setIsAddDocumentDialogOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Add Custom Document
              </button>
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                onClick={() => setIsCreateSuiteDialogOpen(true)}
              >
                <FolderPlus className="w-4 h-4" />
                Create Suite
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" onClick={onApplySuite}>
                Expand Suites
              </button>
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                onClick={() => {
                  void onSendReminders();
                }}
                disabled={sendingBulkReminders}
              >
                <Send className="w-4 h-4" />
                {sendingBulkReminders ? 'Sending...' : 'Send Reminders'}
              </button>
            </div>
            <button
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              onClick={onDownloadAll}
            >
              <Download className="w-4 h-4" />
              Download All
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {workspace.document_suites.map((suite) => (
            <div key={suite.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div
                onClick={() => onToggleSuite(suite.id)}
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedSuites.includes(suite.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{suite.name}</h3>
                      {suite.recommended ? (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">Recommended</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{suite.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    {suite.documents.filter((document) => document.status === 'accepted').length} /{' '}
                    {suite.documents.length} complete
                  </div>
                </div>
              </div>

              {expandedSuites.includes(suite.id) ? (
                <div className="border-t border-gray-200">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Document</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Due Date</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Required</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {suite.documents.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-sm text-gray-500">
                            No documents in this suite yet.
                          </td>
                        </tr>
                      ) : null}
                      {suite.documents.map((document) => (
                        <tr key={document.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{document.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{document.instructions ?? ''}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="space-y-2">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${statusColor(document.status)}`}
                              >
                                {titleize(document.status)}
                              </span>
                              <select
                                value={document.status}
                                onClick={(event) => event.stopPropagation()}
                                onChange={(event) =>
                                  void onUpdateDocumentStatus(
                                    document.id,
                                    event.target.value as CaseDocumentStatus
                                  )
                                }
                                disabled={updatingDocumentId === document.id}
                                className="w-40 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-800 disabled:opacity-60"
                              >
                                {documentStatusOptions.map((statusOption) => (
                                  <option key={statusOption.value} value={statusOption.value}>
                                    {statusOption.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDate(document.due_date)}</td>
                          <td className="px-4 py-3">
                            {document.required ? (
                              <span className="text-red-600 text-xs font-medium">Required</span>
                            ) : (
                              <span className="text-gray-500 text-xs">Optional</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                                disabled={!document.can_download || viewingDocumentId === document.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onViewDocument(document.id);
                                }}
                                title={document.can_download ? 'View submitted file in browser' : 'No file uploaded yet'}
                              >
                                <Eye className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                                disabled={!document.can_download || downloadingDocumentId === document.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onDownloadDocument(document.id);
                                }}
                                title={document.can_download ? 'Download submitted file' : 'No file uploaded yet'}
                              >
                                <Download className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!document.client_note?.trim()) {
                                    return;
                                  }
                                  setNoteTarget({
                                    name: document.name,
                                    note: document.client_note ?? '',
                                  });
                                }}
                                title={document.client_note?.trim() ? 'View client note' : 'No client note'}
                                disabled={!document.client_note?.trim()}
                              >
                                <StickyNote className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                className="p-1 hover:bg-gray-100 rounded"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setRenameTarget({ id: document.id, name: document.name });
                                }}
                              >
                                <Edit2 className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
                                disabled={sendingDocumentReminderId === document.id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void onSendDocumentReminder(document.id);
                                }}
                              >
                                <Send className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                className="p-1 hover:bg-gray-100 rounded"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setDeleteTarget({ id: document.id, name: document.name });
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {isAddDocumentDialogOpen ? (
        <AddDocumentDialog
          workspace={workspace}
          submitting={addingDocument}
          onClose={() => setIsAddDocumentDialogOpen(false)}
          onSubmit={onAddCustomDocument}
        />
      ) : null}
      {isCreateSuiteDialogOpen ? (
        <CreateSuiteDialog
          submitting={creatingSuite || isCreatingSuite}
          onClose={() => setIsCreateSuiteDialogOpen(false)}
          onSubmit={handleCreateSuite}
        />
      ) : null}
      {renameTarget ? (
        <RenameDocumentDialog
          initialName={renameTarget.name}
          submitting={renamingDocumentId === renameTarget.id}
          onClose={() => setRenameTarget(null)}
          onSubmit={handleRenameDocument}
        />
      ) : null}
      {deleteTarget ? (
        <DeleteDocumentDialog
          documentName={deleteTarget.name}
          submitting={deletingDocumentId === deleteTarget.id}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteDocument}
        />
      ) : null}
      {noteTarget ? (
        <div className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Client Note</h3>
                <p className="text-xs text-gray-500 mt-1">{noteTarget.name}</p>
              </div>
              <button
                type="button"
                className="p-1 rounded hover:bg-gray-100"
                onClick={() => setNoteTarget(null)}
                aria-label="Close note dialog"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{noteTarget.note}</p>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setNoteTarget(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
