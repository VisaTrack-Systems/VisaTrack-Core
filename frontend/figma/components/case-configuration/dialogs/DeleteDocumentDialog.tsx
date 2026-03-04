import { CaseConfigDialog } from './CaseConfigDialog';

type DeleteDocumentDialogProps = {
  documentName: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteDocumentDialog({
  documentName,
  submitting,
  onClose,
  onConfirm,
}: DeleteDocumentDialogProps) {
  return (
    <CaseConfigDialog
      title="Delete Document"
      description="This action removes the document from the current case configuration."
      onClose={onClose}
    >
      <div className="px-6 py-5">
        <p className="text-sm text-gray-700">
          Delete <span className="font-semibold text-gray-900">{documentName}</span>?
        </p>
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
          disabled={submitting}
          onClick={() => {
            void onConfirm();
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </CaseConfigDialog>
  );
}
