import { Plus } from 'lucide-react';

import { ActiveCasesPanel } from './lawyer-dashboard/ActiveCasesPanel';
import { QuickActionsPanel } from './lawyer-dashboard/QuickActionsPanel';
import { RecentActivityPanel } from './lawyer-dashboard/RecentActivityPanel';
import { StatsGrid } from './lawyer-dashboard/StatsGrid';
import { UpcomingDeadlinesPanel } from './lawyer-dashboard/UpcomingDeadlinesPanel';
import { useLawyerDashboardData } from './lawyer-dashboard/useLawyerDashboardData';

interface LawyerDashboardProps {
  onViewActiveCases?: () => void;
  onCreateCase?: () => void | Promise<void>;
}

export function LawyerDashboard({ onViewActiveCases, onCreateCase }: LawyerDashboardProps) {
  const { cases, stats, upcomingDeadlines, derivedActivity } = useLawyerDashboardData();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Welcome back, Attorney</h1>
              <p className="text-sm text-gray-500 mt-1">Here&apos;s what&apos;s happening with your cases today.</p>
            </div>
            <button
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              onClick={() => {
                void onCreateCase?.();
              }}
            >
              <Plus className="w-4 h-4" />
              New Case
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsGrid stats={stats} />

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ActiveCasesPanel cases={cases} onViewActiveCases={onViewActiveCases} />
            <RecentActivityPanel activityItems={derivedActivity} />
          </div>

          <div className="space-y-6">
            <UpcomingDeadlinesPanel deadlines={upcomingDeadlines} />
            <QuickActionsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
