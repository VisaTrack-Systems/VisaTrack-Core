/** MilestoneDialog: Modal dialog for Milestone management and configuration. */

import { useState } from 'react';

import { titleize } from '../utils';
import { CaseConfigDialog } from './CaseConfigDialog';
import { buttonClasses, fieldClasses } from '../../ui';

export type MilestoneDialogInput = {
  name: string;
  description: string | null;
  due_date: string | null;
  status: string;
  client_visible: boolean;
};

type MilestoneDialogProps = {
  title: string;
  description?: string;
  submitLabel: string;
  submitting: boolean;
  initialValue?: Partial<MilestoneDialogInput>;
  onClose: () => void;
  onSubmit: (input: MilestoneDialogInput) => Promise<boolean>;
};

const MILESTONE_STATUS_OPTIONS = ['not_started', 'in_progress', 'blocked', 'completed', 'skipped'] as const;

export function MilestoneDialog({
  title,
  description,
  submitLabel,
  submitting,
  initialValue,
  onClose,
  onSubmit,
}: MilestoneDialogProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [details, setDetails] = useState(initialValue?.description ?? '');
  const [dueDate, setDueDate] = useState(initialValue?.due_date ?? '');
  const [status, setStatus] = useState(initialValue?.status ?? 'not_started');
  const [clientVisible, setClientVisible] = useState(initialValue?.client_visible ?? true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Milestone name is required.');
      return;
    }

    setError(null);
    const success = await onSubmit({
      name: normalizedName,
      description: details.trim() || null,
      due_date: dueDate || null,
      status,
      client_visible: clientVisible,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <CaseConfigDialog title={title} description={description} onClose={onClose}>
      <div className="px-6 py-5 space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Milestone Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g., Application submitted to IRCC"
            className={fieldClasses}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            rows={3}
            placeholder="Optional details visible in timeline."
            className={fieldClasses}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={fieldClasses}
            >
              {MILESTONE_STATUS_OPTIONS.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {titleize(statusOption)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={clientVisible}
            onChange={(event) => setClientVisible(event.target.checked)}
          />
          Visible in client portal
        </label>
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
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </CaseConfigDialog>
  );
}
