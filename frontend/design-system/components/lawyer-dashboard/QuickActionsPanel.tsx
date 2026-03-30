/** QuickActionsPanel: quickactionspanel implementation. */

import { FilePlus2, FolderOpen } from 'lucide-react';

type QuickActionsPanelProps = {
  onCreateCase?: () => void | Promise<void>;
  onViewActiveCases?: () => void;
};

export function QuickActionsPanel({
  onCreateCase,
  onViewActiveCases,
}: QuickActionsPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="space-y-3">
        <button
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          onClick={() => {
            void onCreateCase?.();
          }}
          type="button"
        >
          <FilePlus2 className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Create New Case</span>
        </button>
        <button
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
          onClick={onViewActiveCases}
          type="button"
        >
          <FolderOpen className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">View Active Cases</span>
        </button>
      </div>
    </div>
  );
}
