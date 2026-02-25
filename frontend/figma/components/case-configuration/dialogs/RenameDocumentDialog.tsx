import { useState } from 'react';

import { CaseConfigDialog } from './CaseConfigDialog';

type RenameDocumentDialogProps = {
  initialName: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (nextName: string) => Promise<boolean>;
};

export function RenameDocumentDialog({
  initialName,
  submitting,
  onClose,
  onSubmit,
}: RenameDocumentDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError('Document name is required.');
      return;
    }

    setError(null);
    const success = await onSubmit(normalizedName);
    if (success) {
      onClose();
    }
  };

  return (
    <CaseConfigDialog
      title="Rename Document"
      description="Update this document label."
      onClose={onClose}
    >
      <div className="px-6 py-5 space-y-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
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
          onClick={() => {
            void handleSubmit();
          }}
          disabled={submitting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </div>
    </CaseConfigDialog>
  );
}
