import { useEffect, useMemo, useState } from 'react';

import { getLawyerCases, getLawyerClients } from '@/lib/api';

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
};

export function useLawyerDashboardData(): LawyerDashboardData {
  const [cases, setCases] = useState<DashboardCase[]>([]);
  const [stats, setStats] = useState<DashboardStats>(fallbackStats);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function loadDashboard() {
      setIsLoading(true);
      setError(null);

      try {
        const [caseRows, clients] = await Promise.all([
          getLawyerCases(100),
          getLawyerClients(200).catch(() => null),
        ]);
        if (ignore) {
          return;
        }

        const totalUsersFromCases = new Set(caseRows.map((entry) => entry.client_name)).size;
        const totalUsers = clients ? clients.length : totalUsersFromCases;

        setCases(
          caseRows.slice(0, 8).map((entry) => ({
            id: entry.case_number,
            clientName: entry.client_name,
            caseType: entry.case_type,
            status: titleize(entry.status),
            lastUpdate: relativeTime(entry.created_at),
            priority: entry.priority,
            nextDeadline: entry.target_filing_date
              ? new Date(entry.target_filing_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Not set',
          }))
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

  const derivedActivity = useMemo<ActivityItem[]>(
    () =>
      cases.slice(0, 4).map((entry, index) => ({
        action: 'Case updated',
        client: entry.clientName,
        detail: `${entry.caseType} (${entry.id})`,
        time: entry.lastUpdate,
        type: (['document', 'reminder', 'payment', 'milestone'] as ActivityItem['type'][])[index % 4],
      })),
    [cases]
  );

  const retry = () => {
    setReloadToken((current) => current + 1);
  };

  return { cases, stats, derivedActivity, isLoading, error, retry };
}
