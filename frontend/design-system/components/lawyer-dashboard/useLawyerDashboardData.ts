/** useLawyerDashboardData: React hook for handling lawyerdashboarddata logic and state management. */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getLawyerClients } from '@/lib/api';
import { loadAllLawyerCases, sortFlaggedCases } from '@/lib/lawyerCases';

import { useCaseFlagging } from '../useCaseFlagging';

import type { ActivityItem, DashboardCase, DashboardStats } from './types';
import { relativeTime, titleize } from './utils';

const fallbackStats: DashboardStats = {
  activeCases: 0,
  totalUsers: 0,
  upcomingMilestones: 0,
  completedCases: 0,
};

type LawyerDashboardData = {
  cases: DashboardCase[];
  stats: DashboardStats;
  derivedActivity: ActivityItem[];
  isLoading: boolean;
  error: string | null;
  retry: () => void;
  flaggingCaseNumbers: string[];
  flagError: string | null;
  toggleFlag: (caseNumber: string, isFlagged: boolean) => Promise<void>;
};

export function useLawyerDashboardData(): LawyerDashboardData {
  const [allCases, setCases] = useState<DashboardCase[]>([]);
  const [stats, setStats] = useState<DashboardStats>(fallbackStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const onFlagSaved = useCallback((caseNumber: string, isFlagged: boolean) => {
    setCases((current) => sortFlaggedCases(current.map((entry) =>
      entry.id === caseNumber ? { ...entry, isFlagged } : entry
    )));
  }, []);
  const flagging = useCaseFlagging(onFlagSaved);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const [caseRows, clients] = await Promise.all([
          loadAllLawyerCases(),
          getLawyerClients(200).catch(() => null),
        ]);
        if (ignore) {
          return;
        }

        const totalUsersFromCases = new Set(caseRows.map((entry) => entry.client_name)).size;
        const totalUsers = clients ? clients.length : totalUsersFromCases;

        setCases(
          sortFlaggedCases(caseRows.map((entry) => ({
            id: entry.case_number,
            clientName: entry.client_name,
            caseType: entry.case_type,
            status: titleize(entry.status),
            lastUpdate: relativeTime(entry.created_at),
            priority: entry.priority,
            isFlagged: entry.is_flagged ?? false,
            createdAt: entry.created_at,
            nextDeadline: entry.target_filing_date
              ? new Date(entry.target_filing_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not set',
          })))
        );

        const activeCases = caseRows.filter((entry) => entry.status !== 'closed').length;
        const completedCases = caseRows.filter((entry) => entry.status === 'closed').length;

        setStats({
          activeCases,
          totalUsers,
          upcomingMilestones: caseRows.filter((entry) => !!entry.target_filing_date).length,
          completedCases,
        });
      } catch {
        if (ignore) {
          return;
        }

        setError('Failed to load dashboard data.');
        setCases([]);
        setStats(fallbackStats);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  const cases = useMemo(() => {
    const flagged = allCases.filter((entry) => entry.isFlagged);
    const recent = allCases.filter((entry) => !entry.isFlagged).slice(0, Math.max(0, 8 - flagged.length));
    return [...flagged, ...recent];
  }, [allCases]);

  const derivedActivity = useMemo<ActivityItem[]>(
    () =>
      [...allCases].sort((a, b) => (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0))
        .slice(0, 4).map((entry, index) => ({
        action: 'Case updated',
        client: entry.clientName,
        detail: `${entry.caseType} (${entry.id})`,
        time: entry.lastUpdate,
        type: (['document', 'reminder', 'payment', 'milestone'] as ActivityItem['type'][])[index % 4],
      })),
    [allCases]
  );

  const retry = () => {
    setReloadToken((current) => current + 1);
  };

  return { cases, stats, derivedActivity, isLoading, error, retry, ...flagging };
}
