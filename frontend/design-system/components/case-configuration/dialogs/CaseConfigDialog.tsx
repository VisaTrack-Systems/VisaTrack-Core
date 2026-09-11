/** CaseConfigDialog: Modal dialog for CaseConfig management and configuration. */

import { X } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { DialogPanel } from '../../DialogPanel';

type CaseConfigDialogProps = {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export function CaseConfigDialog({
  title,
  description,
  children,
  onClose,
}: CaseConfigDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  return (
    <div className="fixed inset-0 z-[120] w-screen h-screen bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <DialogPanel
        labelledBy={titleId}
        describedBy={description ? descriptionId : undefined}
        onClose={onClose}
        className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-xl"
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">{title}</h2>
            {description ? <p id={descriptionId} className="text-sm text-gray-600 mt-1">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </DialogPanel>
    </div>
  );
}
