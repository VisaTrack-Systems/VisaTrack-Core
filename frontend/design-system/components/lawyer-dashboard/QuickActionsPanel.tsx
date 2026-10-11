/** QuickActionsPanel: Shortcuts on the lawyer dashboard to create a case or open the case list. */

import { ChevronRight, FilePlus2, FolderOpen } from 'lucide-react';

import { Card, CardHeader } from '../ui';

type QuickActionsPanelProps = {
  onCreateCase?: () => void | Promise<void>;
  onViewActiveCases?: () => void;
};

const ACTION_CLASSES =
  'group flex w-full items-center gap-3 rounded-md border border-gray-200 px-3 py-2.5 text-left transition-colors hover:border-primary-200 hover:bg-primary-50';

export function QuickActionsPanel({
  onCreateCase,
  onViewActiveCases,
}: QuickActionsPanelProps) {
  return (
    <Card>
      <CardHeader title="Quick Actions" />
      <div className="space-y-2 px-5 py-4">
        <button
          className={ACTION_CLASSES}
          onClick={() => {
            void onCreateCase?.();
          }}
          type="button"
        >
          <FilePlus2 className="h-5 w-5 text-primary-600" aria-hidden="true" />
          <span className="flex-1 text-sm font-medium text-gray-900">Create New Case</span>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary-600" aria-hidden="true" />
        </button>
        <button className={ACTION_CLASSES} onClick={onViewActiveCases} type="button">
          <FolderOpen className="h-5 w-5 text-primary-600" aria-hidden="true" />
          <span className="flex-1 text-sm font-medium text-gray-900">View Active Cases</span>
          <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-primary-600" aria-hidden="true" />
        </button>
      </div>
    </Card>
  );
}
