/** AddDocumentDialog: Modal dialog for AddDocument management and configuration. */

import { useMemo, useState } from 'react';

import type { CaseWorkspace } from '@/lib/api';

import type { NewDocumentInput } from '../types';
import { CaseConfigDialog } from './CaseConfigDialog';
import { buttonClasses, fieldClasses } from '../../ui';

type AddDocumentDialogProps = {
  workspace: CaseWorkspace;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: NewDocumentInput) => Promise<boolean>;
};

export function AddDocumentDialog({
  workspace,
  submitting,
  onClose,
  onSubmit,
}: AddDocumentDialogProps) {
  const [suiteId, setSuiteId] = useState(workspace.document_suites[0]?.id ?? '');
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const suiteOptions = useMemo(
    () =>
      workspace.document_suites.map((suite) => ({
        id: suite.id,
        label: suite.name,
      })),
    [workspace.document_suites]
  );

  const handleSubmit = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Document name is required.');
      return;
    }

    setError(null);
    const success = await onSubmit({
      suiteId: suiteId || undefined,
      name: normalizedName,
      required,
      dueDate: dueDate || null,
      instructions: instructions.trim() || null,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <CaseConfigDialog
      title="Add Custom Document"
      description="Create a custom document request and attach it to a suite."
      onClose={onClose}
    >
      <div className="px-6 py-5 space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Suite</label>
          <select
            value={suiteId}
            onChange={(event) => setSuiteId(event.target.value)}
            className={fieldClasses}
          >
            {suiteOptions.map((suiteOption) => (
              <option key={suiteOption.id} value={suiteOption.id}>
                {suiteOption.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., Additional Proof of Employment"
            className={fieldClasses}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className={fieldClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requirement</label>
            <select
              value={required ? 'required' : 'optional'}
              onChange={(event) => setRequired(event.target.value === 'required')}
              className={fieldClasses}
            >
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={3}
            placeholder="Optional guidance for client uploads."
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
          onClick={() => {
            void handleSubmit();
          }}
          disabled={submitting}
          className={buttonClasses('primary')}
        >
          {submitting ? 'Adding...' : 'Add Document'}
        </button>
      </div>
    </CaseConfigDialog>
  );
}
