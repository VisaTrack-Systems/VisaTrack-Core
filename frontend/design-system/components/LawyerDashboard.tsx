/** LawyerDashboard: Main dashboard view for lawyers and legal professionals. Shows assigned cases, workload, recent activity, and case management quick actions. */

import { Plus } from 'lucide-react';

import { ActiveCasesPanel } from './lawyer-dashboard/ActiveCasesPanel';
import { QuickActionsPanel } from './lawyer-dashboard/QuickActionsPanel';
import { RecentActivityPanel } from './lawyer-dashboard/RecentActivityPanel';
import { StatsGrid } from './lawyer-dashboard/StatsGrid';
import { useLawyerDashboardData } from './lawyer-dashboard/useLawyerDashboardData';
import { PageHeader } from './AppShell';
import { Alert, Button } from './ui';

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
  const { cases, stats, derivedActivity, isLoading, error, retry,
    flagError, flaggingCaseNumbers, toggleFlag } = useLawyerDashboardData();
  const displayName = lawyerName?.trim().split(/\s+/)[0] || 'Attorney';
  const showNoClients = !isLoading && !error && stats.totalUsers === 0;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${displayName}`}
        description="Here's what's happening with your cases today."
        actions={
          <Button
            type="button"
            onClick={() => {
              void onCreateCase?.();
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Case
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {error ? (
          <Alert tone="danger" className="flex items-center justify-between gap-4">
            <p>{error}</p>
            <button className="font-medium underline underline-offset-2 hover:text-red-800" onClick={retry} type="button">
              Retry
            </button>
          </Alert>
        ) : null}

        {flagError ? <Alert tone="danger">{flagError}</Alert> : null}

        <StatsGrid stats={stats} isLoading={isLoading} />

        {showNoClients ? (
          <Alert>No clients found. Create your first case to add a client.</Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ActiveCasesPanel
              cases={cases}
              isLoading={isLoading}
              onViewActiveCases={onViewActiveCases}
              onSelectCase={onSelectCase}
              onToggleFlag={(caseNumber, isFlagged) => { void toggleFlag(caseNumber, isFlagged); }}
              flaggingCaseNumbers={flaggingCaseNumbers}
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
