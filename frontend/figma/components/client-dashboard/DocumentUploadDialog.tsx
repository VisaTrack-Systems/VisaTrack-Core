import { FormEvent, useState } from 'react';
import { Upload, X } from 'lucide-react';

import type { DashboardDocument } from './types';

type DocumentUploadDialogProps = {
  isOpen: boolean;
  document: DashboardDocument | null;
  submitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (file: File, note: string | null) => Promise<void>;
};

export function DocumentUploadDialog({
  isOpen,
  document,
  submitting,
  errorMessage,
  onClose,
  onSubmit,
}: DocumentUploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(null);

    if (!selectedFile) {
      setValidationError('Select a file before uploading.');
      return;
    }

    const normalizedNote = note.trim() ? note.trim() : null;
    await onSubmit(selectedFile, normalizedNote);
  };

  if (!isOpen || !document) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-black text-white flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">Upload Document</h2>
            <p className="text-xs text-gray-300 mt-1">Attach a file for {document.name}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-60"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {validationError ? (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm px-3 py-2">
              {validationError}
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {errorMessage}
            </div>
          ) : null}

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">{document.name}</p>
            {document.instructions ? (
              <p className="mt-1 text-sm text-gray-600">{document.instructions}</p>
            ) : null}
            <p className="mt-2 text-xs text-gray-500">
              {document.required ? 'Required document' : 'Optional document'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select File</label>
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-red-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-red-700"
              disabled={submitting}
            />
            {selectedFile ? (
              <p className="mt-2 text-xs text-gray-500">
                {selectedFile.name} ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note for your lawyer (optional)
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Add context about this file, if needed."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-red-500 focus:outline-none"
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-gray-500">{note.length}/2000</p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-60"
            >
              <Upload className="w-4 h-4" />
              {submitting ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
