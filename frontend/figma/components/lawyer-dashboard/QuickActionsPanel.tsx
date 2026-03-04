import { AlertTriangle, FilePlus2, Flag, FolderOpen } from 'lucide-react';

type QuickActionsPanelProps = {
  onCreateCase?: () => void | Promise<void>;
  onViewActiveCases?: () => void;
  onOpenNextDeadlineCase?: () => void;
  onOpenHighPriorityCase?: () => void;
};

export function QuickActionsPanel({
  onCreateCase,
  onViewActiveCases,
  onOpenNextDeadlineCase,
  onOpenHighPriorityCase,
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
        <button
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:bg-gray-50"
          onClick={onOpenNextDeadlineCase}
          disabled={!onOpenNextDeadlineCase}
          type="button"
        >
          <AlertTriangle className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Open Next Deadline Case</span>
        </button>
        <button
          className="w-full flex items-center gap-3 p-3 border border-gray-200 rounded-lg transition-colors text-left disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:bg-gray-50"
          onClick={onOpenHighPriorityCase}
          disabled={!onOpenHighPriorityCase}
          type="button"
        >
          <Flag className="w-5 h-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">Open Highest Priority Case</span>
        </button>
      </div>
    </div>
  );
}
