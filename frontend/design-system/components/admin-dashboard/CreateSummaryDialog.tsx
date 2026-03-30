/** CreateSummaryDialog: Modal dialog for CreateSummary management and configuration. */

import { X } from 'lucide-react';

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
    <div className="fixed inset-0 z-80 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-xl">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-500 mb-4">Please review the details below before confirming.</p>
          <dl className="space-y-3">
            {fields.map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <dt className="text-gray-500 font-medium shrink-0">{label}</dt>
                <dd className="text-gray-900 text-right break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
