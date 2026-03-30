/** LawyerDashboard: Main dashboard view for lawyers and legal professionals. Shows assigned cases, workload, recent activity, and case management quick actions. */

import { Plus } from 'lucide-react';

import { ActiveCasesPanel } from './lawyer-dashboard/ActiveCasesPanel';
import { QuickActionsPanel } from './lawyer-dashboard/QuickActionsPanel';
import { RecentActivityPanel } from './lawyer-dashboard/RecentActivityPanel';
import { StatsGrid } from './lawyer-dashboard/StatsGrid';
import { useLawyerDashboardData } from './lawyer-dashboard/useLawyerDashboardData';

interface LawyerDashboardProps {
  onViewActiveCases?: () => void;
  onSelectCase?: (caseId: string) => void;
  onCreateCase?: () => void | Promise<void>;
  lawyerName?: string;
}

export function LawyerDashboard({
  onViewActiveCases,
  onSelectCase,
  onCreateCase,
  lawyerName,
}: LawyerDashboardProps) {
  const { cases, stats, derivedActivity, isLoading, error, retry } = useLawyerDashboardData();
  const displayName = lawyerName?.trim().split(/\s+/)[0] || 'Attorney';
  const showNoClients = !isLoading && !error && stats.totalUsers === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Welcome back, {displayName}</h1>
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
        {error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-red-700">{error}</p>
            <button
              className="text-sm font-medium text-red-700 hover:text-red-800"
              onClick={retry}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        <StatsGrid stats={stats} isLoading={isLoading} />

        {showNoClients ? (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <p className="text-sm text-gray-600">No clients found. Create your first case to add a client.</p>
          </div>
        ) : null}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <ActiveCasesPanel
              cases={cases}
              isLoading={isLoading}
              onViewActiveCases={onViewActiveCases}
              onSelectCase={onSelectCase}
            />
            <RecentActivityPanel activityItems={derivedActivity} isLoading={isLoading} />
          </div>

          <div className="space-y-6">
            <QuickActionsPanel
              onCreateCase={onCreateCase}
              onViewActiveCases={onViewActiveCases}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
