/** DeleteMilestoneDialog: Modal dialog for DeleteMilestone management and configuration. */

import { CaseConfigDialog } from './CaseConfigDialog';
import { buttonClasses } from '../../ui';

type DeleteMilestoneDialogProps = {
  milestoneName: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function DeleteMilestoneDialog({
  milestoneName,
  submitting,
  onClose,
  onConfirm,
}: DeleteMilestoneDialogProps) {
  return (
    <CaseConfigDialog
      title="Delete Milestone"
      description="This removes the milestone from this case timeline."
      onClose={onClose}
    >
      <div className="px-6 py-5">
        <p className="text-sm text-gray-700">
          Delete <span className="font-semibold text-gray-900">{milestoneName}</span>?
        </p>
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
          disabled={submitting}
          onClick={() => {
            void onConfirm();
          }}
          className={buttonClasses('danger')}
        >
          {submitting ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </CaseConfigDialog>
  );
}
