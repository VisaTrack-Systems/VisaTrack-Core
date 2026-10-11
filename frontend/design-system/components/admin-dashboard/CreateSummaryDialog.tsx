/** CreateSummaryDialog: Modal showing the entered details of a new user or organization for review before creating it. */

import { X } from 'lucide-react';

import { DialogPanel } from '../DialogPanel';
import { Button } from '../ui';

type Field = { label: string; value: string };

export function CreateSummaryDialog({
  title,
  fields,
  onConfirm,
  onClose,
}: {
  title: string;
  fields: Field[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-navy-900/50 flex items-center justify-center p-4">
      <DialogPanel
        labelledBy="create-summary-title"
        onClose={onClose}
        className="w-full max-w-md bg-white border border-gray-200 rounded-md shadow-popover"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <h2 id="create-summary-title" className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1 p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-500 mb-4">Please review the details below before confirming.</p>
          <dl className="divide-y divide-gray-100 rounded-md border border-gray-200">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 px-3 py-2 text-sm">
                <dt className="text-gray-500 font-medium shrink-0">{label}</dt>
                <dd className="text-gray-900 text-right break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-md flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Create
          </Button>
        </div>
      </DialogPanel>
    </div>
  );
}
