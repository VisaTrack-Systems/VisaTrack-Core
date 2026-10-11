/** ConfirmDialog: Modal asking the admin to confirm an action (danger or info variant) before it runs. */

import { X } from 'lucide-react';

import { DialogPanel } from '../DialogPanel';
import { Button } from '../ui';
import type { ConfirmDialogState } from './types';

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  variant,
  onConfirm,
  onClose,
}: ConfirmDialogState & { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] bg-navy-900/50 flex items-center justify-center p-4">
      <DialogPanel
        labelledBy="confirm-dialog-title"
        onClose={onClose}
        className="w-full max-w-md bg-white border border-gray-200 rounded-md shadow-popover"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <h2 id="confirm-dialog-title" className="text-base font-semibold text-gray-900">{title}</h2>
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
          <p className="text-sm text-gray-700">{message}</p>
        </div>
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-md flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogPanel>
    </div>
  );
}
