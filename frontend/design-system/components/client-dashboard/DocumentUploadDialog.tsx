/** DocumentUploadDialog: Modal dialog for DocumentUpload management and configuration. */

import { FormEvent, useState } from 'react';
import { Upload, X } from 'lucide-react';

import type { DashboardDocument } from './types';
import { DialogPanel } from '../DialogPanel';
import { Alert, Button, Label, Textarea } from '../ui';

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
    <div className="fixed inset-0 z-[120] w-screen h-screen bg-navy-900/50 flex items-center justify-center p-4 overflow-y-auto">
      <DialogPanel
        labelledBy="document-upload-title"
        describedBy="document-upload-description"
        onClose={onClose}
        className="w-full max-w-xl bg-white rounded-md shadow-popover border border-gray-200 overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 id="document-upload-title" className="text-base font-semibold text-gray-900">Upload Document</h2>
            <p id="document-upload-description" className="text-sm text-gray-500 mt-0.5">Attach a file for {document.name}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="-m-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors disabled:opacity-60"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-5">
          {validationError ? (
            <Alert tone="warning" role="alert">{validationError}</Alert>
          ) : null}

          {errorMessage ? (
            <Alert tone="danger">{errorMessage}</Alert>
          ) : null}

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">{document.name}</p>
            {document.instructions ? (
              <p className="mt-1 text-sm text-gray-600">{document.instructions}</p>
            ) : null}
            <p className="mt-2 text-xs text-gray-500">
              {document.required ? 'Required document' : 'Optional document'}
            </p>
          </div>

          <div>
            <Label htmlFor="document-upload-file">Select File</Label>
            <input
              id="document-upload-file"
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border file:border-gray-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-50"
              disabled={submitting}
            />
            {selectedFile ? (
              <p className="mt-2 text-xs text-gray-500">
                {selectedFile.name} ({Math.max(1, Math.round(selectedFile.size / 1024))} KB)
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="document-upload-note">Note for your lawyer (optional)</Label>
            <Textarea
              id="document-upload-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Add context about this file, if needed."
              disabled={submitting}
            />
            <p className="mt-1 text-xs text-gray-500">{note.length}/2000</p>
          </div>

          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              <Upload className="w-4 h-4" aria-hidden="true" />
              {submitting ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        </form>
      </DialogPanel>
    </div>
  );
}
