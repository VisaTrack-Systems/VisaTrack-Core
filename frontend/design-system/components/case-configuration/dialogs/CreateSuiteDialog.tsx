/** CreateSuiteDialog: Modal dialog for CreateSuite management and configuration. */

import { useState } from 'react';

import type { NewDocumentSuiteInput } from '../types';
import { CaseConfigDialog } from './CaseConfigDialog';

type CreateSuiteDialogProps = {
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: NewDocumentSuiteInput) => Promise<boolean>;
};

export function CreateSuiteDialog({
  submitting,
  onClose,
  onSubmit,
}: CreateSuiteDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Suite name is required.');
      return;
    }

    setError(null);
    const success = await onSubmit({
      name: normalizedName,
      description: description.trim() || null,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <CaseConfigDialog
      title="Create Custom Suite"
      description="Create a case-specific suite for additional document requests."
      onClose={onClose}
    >
      <div className="px-6 py-5 space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Suite Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., Country-Specific Requirements"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Optional description for this suite."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-gray-900"
          />
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Creating...' : 'Create Suite'}
        </button>
      </div>
    </CaseConfigDialog>
  );
}
