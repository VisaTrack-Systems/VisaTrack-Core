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
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="space-y-3">
        <button
          className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-[#b8bef0] hover:bg-[#f7f7ff] transition-colors text-left"
          onClick={() => {
            void onCreateCase?.();
          }}
          type="button"
        >
          <FilePlus2 className="w-5 h-5 text-[#5661ce]" />
          <span className="text-sm font-medium text-gray-900">Create New Case</span>
        </button>
        <button
          className="w-full flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-[#b8bef0] hover:bg-[#f7f7ff] transition-colors text-left"
          onClick={onViewActiveCases}
          type="button"
        >
          <FolderOpen className="w-5 h-5 text-[#199a87]" />
          <span className="text-sm font-medium text-gray-900">View Active Cases</span>
        </button>
      </div>
    </div>
  );
}
