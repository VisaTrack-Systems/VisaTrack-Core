/** CreateSuiteDialog: Modal dialog for CreateSuite management and configuration. */

import { useState } from 'react';

import type { NewDocumentSuiteInput } from '../types';
import { CaseConfigDialog } from './CaseConfigDialog';
import { buttonClasses, fieldClasses } from '../../ui';

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
            className={fieldClasses}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Optional description for this suite."
            className={fieldClasses}
          />
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className={buttonClasses('secondary')}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className={buttonClasses('primary')}
        >
          {submitting ? 'Creating...' : 'Create Suite'}
        </button>
      </div>
    </CaseConfigDialog>
  );
}
